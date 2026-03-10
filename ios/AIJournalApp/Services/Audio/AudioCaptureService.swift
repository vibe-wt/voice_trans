import AVFoundation
import Foundation

protocol AudioCaptureServiceProtocol: AnyObject {
    func setChunkHandler(_ handler: @escaping @Sendable (String) async -> Void)
    func setLevelHandler(_ handler: @escaping @Sendable (Float) -> Void)
    func permissionStatus() -> PermissionStatus
    func requestPermission() async -> Bool
    func startCapture() async throws
    func stopCapture() async
}

final class AudioCaptureService: AudioCaptureServiceProtocol {
    private let engine = AVAudioEngine()
    private let targetFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16_000, channels: 1, interleaved: true)
    private var converter: AVAudioConverter?
    private var chunkHandler: (@Sendable (String) async -> Void)?
    private var levelHandler: (@Sendable (Float) -> Void)?
    private var bufferedData = Data()
    private let targetChunkBytes = 6_400

    func setChunkHandler(_ handler: @escaping @Sendable (String) async -> Void) {
        chunkHandler = handler
    }

    func setLevelHandler(_ handler: @escaping @Sendable (Float) -> Void) {
        levelHandler = handler
    }

    func permissionStatus() -> PermissionStatus {
        if #available(iOS 17.0, *) {
            switch AVAudioApplication.shared.recordPermission {
            case .granted:
                return .authorized
            case .denied:
                return .denied
            case .undetermined:
                return .notDetermined
            @unknown default:
                return .unknown
            }
        } else {
            switch AVAudioSession.sharedInstance().recordPermission {
            case .granted:
                return .authorized
            case .denied:
                return .denied
            case .undetermined:
                return .notDetermined
            @unknown default:
                return .unknown
            }
        }
    }

    func requestPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            if #available(iOS 17.0, *) {
                AVAudioApplication.requestRecordPermission { granted in
                    continuation.resume(returning: granted)
                }
            } else {
                AVAudioSession.sharedInstance().requestRecordPermission { granted in
                    continuation.resume(returning: granted)
                }
            }
        }
    }

    func startCapture() async throws {
        let granted = await requestPermission()
        guard granted else {
            throw AudioCaptureError.microphonePermissionDenied
        }

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetoothHFP])
        try session.setActive(true, options: [])

        let inputNode = engine.inputNode
        let inputFormat = inputNode.inputFormat(forBus: 0)

        guard let targetFormat else {
            throw AudioCaptureError.targetFormatUnavailable
        }

        converter = AVAudioConverter(from: inputFormat, to: targetFormat)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 2048, format: inputFormat) { [weak self] buffer, _ in
            self?.process(buffer: buffer)
        }

        engine.prepare()
        try engine.start()
    }

    func stopCapture() async {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        await flushRemaining()
        bufferedData.removeAll(keepingCapacity: false)
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }

    private func process(buffer: AVAudioPCMBuffer) {
        guard let converter, let targetFormat else {
            return
        }

        let ratio = targetFormat.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 512
        guard let convertedBuffer = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: capacity) else {
            return
        }

        var error: NSError?
        var didProvideInput = false

        let status = converter.convert(to: convertedBuffer, error: &error) { _, outStatus in
            if didProvideInput {
                outStatus.pointee = .noDataNow
                return nil
            }

            didProvideInput = true
            outStatus.pointee = .haveData
            return buffer
        }

        guard status != .error, error == nil else {
            return
        }

        guard let audioBuffer = convertedBuffer.audioBufferList.pointee.mBuffers.mData else {
            return
        }

        let byteCount = Int(convertedBuffer.audioBufferList.pointee.mBuffers.mDataByteSize)
        bufferedData.append(audioBuffer.assumingMemoryBound(to: UInt8.self), count: byteCount)
        emitLevel(from: audioBuffer.assumingMemoryBound(to: Int16.self), sampleCount: byteCount / MemoryLayout<Int16>.size)

        while bufferedData.count >= targetChunkBytes {
            let chunk = bufferedData.prefix(targetChunkBytes)
            bufferedData.removeFirst(targetChunkBytes)
            emit(chunk: Data(chunk))
        }
    }

    private func flushRemaining() async {
        guard !bufferedData.isEmpty else {
            return
        }

        emit(chunk: bufferedData)
    }

    private func emit(chunk: Data) {
        guard !chunk.isEmpty, let chunkHandler else {
            return
        }

        let base64 = chunk.base64EncodedString()
        Task {
            await chunkHandler(base64)
        }
    }

    private func emitLevel(from samples: UnsafePointer<Int16>, sampleCount: Int) {
        guard sampleCount > 0, let levelHandler else {
            return
        }

        var sum: Float = 0
        for index in 0 ..< sampleCount {
            let normalized = Float(samples[index]) / Float(Int16.max)
            sum += normalized * normalized
        }

        let rms = sqrt(sum / Float(sampleCount))
        let clamped = min(max(rms * 4.2, 0.03), 1.0)
        levelHandler(clamped)
    }
}

final class StubAudioCaptureService: AudioCaptureServiceProtocol {
    private var chunkHandler: (@Sendable (String) async -> Void)?

    func setChunkHandler(_ handler: @escaping @Sendable (String) async -> Void) {
        chunkHandler = handler
    }

    func setLevelHandler(_ handler: @escaping @Sendable (Float) -> Void) {}
    func permissionStatus() -> PermissionStatus { .authorized }
    func requestPermission() async -> Bool { true }
    func startCapture() async throws {}
    func stopCapture() async {}
}

enum AudioCaptureError: LocalizedError {
    case targetFormatUnavailable
    case microphonePermissionDenied

    var errorDescription: String? {
        switch self {
        case .targetFormatUnavailable:
            "无法创建目标 PCM 格式。"
        case .microphonePermissionDenied:
            "麦克风权限未开启。"
        }
    }
}
