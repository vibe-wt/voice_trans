import AVFoundation
import Foundation

@MainActor
protocol AssistantPlaybackServiceProtocol: AnyObject {
    func enqueue(chunkBase64: String) async throws
    func setPlaybackRate(_ rate: Double)
}

@MainActor
final class AssistantPlaybackService: NSObject, AssistantPlaybackServiceProtocol {
    private let inputSampleRate: Double = 24_000
    private let inputChannels: AVAudioChannelCount = 1
    private let minimumBatchBytes = 4_800

    private let engine = AVAudioEngine()
    private let playerNode = AVAudioPlayerNode()
    private let timePitchNode = AVAudioUnitTimePitch()

    private var playbackRate: Double = 1.0
    private var inputFormat: AVAudioFormat?
    private var outputFormat: AVAudioFormat?
    private var converter: AVAudioConverter?
    private var pendingPCMData = Data()
    private var flushTask: Task<Void, Never>?
    private var isPrepared = false

    override init() {
        super.init()
        engine.attach(playerNode)
        engine.attach(timePitchNode)
    }

    func enqueue(chunkBase64: String) async throws {
        try configureAudioSessionIfNeeded()
        try prepareEngineIfNeeded()

        guard let pcmData = Data(base64Encoded: chunkBase64) else {
            throw AssistantPlaybackError.invalidChunk
        }

        pendingPCMData.append(pcmData)

        if pendingPCMData.count >= minimumBatchBytes {
            try flushPendingPCMData()
        } else {
            scheduleFlushIfNeeded()
        }
    }

    func setPlaybackRate(_ rate: Double) {
        let normalizedRate = min(max(rate, 0.1), 3.0)
        playbackRate = normalizedRate
        timePitchNode.rate = Float(normalizedRate)
    }

    private func configureAudioSessionIfNeeded() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetoothHFP])
        try session.setPreferredSampleRate(inputSampleRate)
        try session.setActive(true, options: [])
    }

    private func prepareEngineIfNeeded() throws {
        guard !isPrepared else {
            if !engine.isRunning {
                try engine.start()
            }
            if !playerNode.isPlaying {
                playerNode.play()
            }
            return
        }

        guard let inputFormat else {
            inputFormat = AVAudioFormat(
                commonFormat: .pcmFormatInt16,
                sampleRate: inputSampleRate,
                channels: inputChannels,
                interleaved: false
            )
            return try prepareEngineIfNeeded()
        }

        let outputFormat = engine.mainMixerNode.outputFormat(forBus: 0)
        self.outputFormat = outputFormat
        converter = AVAudioConverter(from: inputFormat, to: outputFormat)

        engine.connect(playerNode, to: timePitchNode, format: outputFormat)
        engine.connect(timePitchNode, to: engine.mainMixerNode, format: outputFormat)
        timePitchNode.rate = Float(playbackRate)

        engine.prepare()
        try engine.start()
        playerNode.play()
        isPrepared = true
    }

    private func scheduleFlushIfNeeded() {
        guard flushTask == nil else {
            return
        }

        flushTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(35))
            guard let self else { return }
            try? self.flushPendingPCMData()
            self.flushTask = nil
        }
    }

    private func flushPendingPCMData() throws {
        guard !pendingPCMData.isEmpty else {
            return
        }

        try prepareEngineIfNeeded()

        guard let inputFormat, let outputFormat, let converter else {
            throw AssistantPlaybackError.playerNotReady
        }

        let frameCount = pendingPCMData.count / MemoryLayout<Int16>.stride
        guard frameCount > 0 else {
            pendingPCMData.removeAll(keepingCapacity: true)
            return
        }

        guard let sourceBuffer = AVAudioPCMBuffer(
            pcmFormat: inputFormat,
            frameCapacity: AVAudioFrameCount(frameCount)
        ) else {
            throw AssistantPlaybackError.playerNotReady
        }

        sourceBuffer.frameLength = AVAudioFrameCount(frameCount)
        pendingPCMData.withUnsafeBytes { rawBuffer in
            guard let source = rawBuffer.bindMemory(to: Int16.self).baseAddress,
                  let channelData = sourceBuffer.int16ChannelData?[0]
            else {
                return
            }

            channelData.assign(from: source, count: frameCount)
        }

        let estimatedRatio = outputFormat.sampleRate / inputFormat.sampleRate
        let targetFrameCapacity = AVAudioFrameCount(Double(sourceBuffer.frameLength) * estimatedRatio) + 512
        guard let convertedBuffer = AVAudioPCMBuffer(
            pcmFormat: outputFormat,
            frameCapacity: targetFrameCapacity
        ) else {
            throw AssistantPlaybackError.playerNotReady
        }

        var conversionError: NSError?
        var didProvideInput = false
        let status = converter.convert(to: convertedBuffer, error: &conversionError) { _, outStatus in
            if didProvideInput {
                outStatus.pointee = .noDataNow
                return nil
            }

            didProvideInput = true
            outStatus.pointee = .haveData
            return sourceBuffer
        }

        pendingPCMData.removeAll(keepingCapacity: true)
        flushTask?.cancel()
        flushTask = nil

        guard status != .error, conversionError == nil, convertedBuffer.frameLength > 0 else {
            throw conversionError ?? AssistantPlaybackError.playerNotReady
        }

        playerNode.scheduleBuffer(convertedBuffer, completionHandler: nil)
        if !playerNode.isPlaying {
            playerNode.play()
        }
    }
}

final class StubAssistantPlaybackService: AssistantPlaybackServiceProtocol {
    func enqueue(chunkBase64: String) async throws {}
    func setPlaybackRate(_ rate: Double) {}
}

enum AssistantPlaybackError: LocalizedError {
    case invalidChunk
    case playerNotReady

    var errorDescription: String? {
        switch self {
        case .invalidChunk:
            "助手音频块解码失败。"
        case .playerNotReady:
            "助手播放链路还未准备好。"
        }
    }
}
