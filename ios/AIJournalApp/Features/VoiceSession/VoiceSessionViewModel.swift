import Foundation
import Combine

@MainActor
final class VoiceSessionViewModel: ObservableObject {
    @Published var state: VoiceSessionState = .idle
    @Published var sessionID: String?
    @Published var transcript: [TranscriptItem] = []
    @Published var assistantReply = ""
    @Published var selectedVoice = VoicePersonaCatalog.defaultID
    @Published var playbackRate: Double = 1.0
    @Published var elapsedSeconds: TimeInterval = 0
    @Published var audioLevel: Float = 0

    private let apiClient: APIClientProtocol
    private let coordinator: AppCoordinator
    private let settings: AppSettings
    private let realtimeService: RealtimeServiceProtocol
    private let liveKitService: LiveKitRealtimeServiceProtocol
    private let audioCaptureService: AudioCaptureServiceProtocol
    private let playbackService: AssistantPlaybackServiceProtocol
    private var elapsedTimer: Timer?
    private var sessionStartedAt: Date?

    init(
        apiClient: APIClientProtocol,
        coordinator: AppCoordinator,
        settings: AppSettings,
        realtimeService: RealtimeServiceProtocol,
        liveKitService: LiveKitRealtimeServiceProtocol,
        audioCaptureService: AudioCaptureServiceProtocol,
        playbackService: AssistantPlaybackServiceProtocol
    ) {
        self.apiClient = apiClient
        self.coordinator = coordinator
        self.settings = settings
        self.realtimeService = realtimeService
        self.liveKitService = liveKitService
        self.audioCaptureService = audioCaptureService
        self.playbackService = playbackService
        self.selectedVoice = VoicePersonaCatalog.resolve(id: settings.defaultVoice).id
        self.playbackRate = settings.defaultPlaybackRate
        self.playbackService.setPlaybackRate(settings.defaultPlaybackRate)
        self.audioCaptureService.setChunkHandler { [weak self] base64Chunk in
            guard let self else { return }

            let context = await MainActor.run { () -> (sessionID: String, voice: String)? in
                guard let sessionID = self.sessionID else {
                    return nil
                }

                return (sessionID, self.selectedVoice)
            }

            guard let context else { return }

            do {
                let events = try await self.realtimeService.sendAudioChunk(
                    sessionID: context.sessionID,
                    base64Chunk: base64Chunk,
                    voice: context.voice
                )
                await self.consume(events: events)
            } catch {
                await MainActor.run {
                    self.state = .error(error.localizedDescription)
                }
            }
        }
        self.audioCaptureService.setLevelHandler { [weak self] level in
            Task { @MainActor [weak self] in
                self?.audioLevel = level
            }
        }
    }

    func startSession() async {
        do {
            state = .connecting
            transcript = []
            assistantReply = ""
            elapsedSeconds = 0
            audioLevel = 0
            let session = try await apiClient.startVoiceSession()
            sessionID = session.sessionId
            sessionStartedAt = Date()
            startElapsedTimer()
            coordinator.currentSessionID = session.sessionId
            coordinator.latestTranscript = []
            coordinator.latestJournal = nil
            coordinator.latestTasks = []
            if settings.voiceBackend == .liveKit {
                try await liveKitService.connect(sessionID: session.sessionId, participantName: "iPhone Voice Client")
            } else {
                try await realtimeService.connect(sessionID: session.sessionId, voice: selectedVoice)
                startEventStream()
            }
            state = .idle
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    func beginConversation() async {
        if sessionID == nil {
            await startSession()
        }

        guard state == .idle else {
            return
        }

        await startListening()
    }

    func startListening() async {
        guard sessionID != nil else {
            state = .error("请先建立会话。")
            return
        }

        do {
            if settings.voiceBackend == .liveKit {
                try await liveKitService.setMicrophone(enabled: true)
            } else {
                try await audioCaptureService.startCapture()
            }
            state = .listening
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    func stopListening() {
        guard state == .listening else {
            return
        }

        if settings.voiceBackend == .liveKit {
            Task {
                try? await liveKitService.setMicrophone(enabled: false)
            }
        } else {
            Task {
                await audioCaptureService.stopCapture()
            }
        }
        audioLevel = 0.05
        state = .waitingForAssistant
    }

    func handleAssistantStart() {
        state = .playingAssistant
    }

    func handleAssistantFinish() {
        audioLevel = 0
        state = .idle
    }

    func finalizeSession() async {
        guard let sessionID else { return }

        do {
            state = .finalizing
            let result = try await apiClient.finalizeVoiceSession(sessionID: sessionID, transcript: transcript)
            coordinator.latestJournal = result.journal
            coordinator.latestTasks = result.candidateEvents
            coordinator.latestTranscript = transcript
            stopElapsedTimer()
            audioLevel = 0
            if settings.voiceBackend == .liveKit {
                await liveKitService.disconnect()
            } else {
                realtimeService.closeEventStream()
            }
            state = .idle
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    func updatePlaybackRate(_ rate: Double) {
        let normalizedRate = min(max(rate, 0.1), 3.0)
        playbackRate = normalizedRate
        settings.defaultPlaybackRate = normalizedRate
        playbackService.setPlaybackRate(normalizedRate)
    }

    func updateSelectedVoice(_ voice: String) {
        let normalizedVoice = VoicePersonaCatalog.resolve(id: voice).id
        selectedVoice = normalizedVoice
        settings.defaultVoice = normalizedVoice

        if sessionID != nil && settings.voiceBackend == .aliyunLegacy && state == .idle {
            Task {
                await refreshRealtimeVoice()
            }
        }
    }

    func syncPreferences() {
        let storedVoice = VoicePersonaCatalog.resolve(id: settings.defaultVoice).id
        if selectedVoice != storedVoice {
            selectedVoice = storedVoice
        }

        if playbackRate != settings.defaultPlaybackRate {
            playbackRate = settings.defaultPlaybackRate
            playbackService.setPlaybackRate(settings.defaultPlaybackRate)
        }
    }

    func microphonePermissionStatus() -> PermissionStatus {
        audioCaptureService.permissionStatus()
    }

    var voiceBackend: VoiceBackend {
        settings.voiceBackend
    }

    var selectedPersona: VoicePersona {
        VoicePersonaCatalog.resolve(id: selectedVoice)
    }

    deinit {
        realtimeService.closeEventStream()
        elapsedTimer?.invalidate()
    }

    private func startEventStream() {
        guard let sessionID else {
            return
        }

        realtimeService.openEventStream(
            sessionID: sessionID,
            voice: selectedVoice,
            onEvent: { [weak self] event in
                await self?.consume(events: [event])
            },
            onError: { [weak self] error in
                Task { @MainActor [weak self] in
                    self?.state = .error(error.localizedDescription)
                }
            }
        )
    }

    private func consume(events: [RealtimeEventDTO]) async {
        for event in events {
            switch event.type {
            case "final_transcript":
                if let content = event.text, let role = TranscriptItem.Role(rawValue: event.role ?? "user") {
                    appendTranscriptIfNeeded(role: role, content: content)
                    if role == .assistant {
                        assistantReply = content
                        state = .playingAssistant
                    }
                }
            case "assistant_text_delta":
                if let text = event.text {
                    assistantReply += text
                    state = .waitingForAssistant
                }
            case "assistant_audio_chunk":
                if let chunk = event.chunkBase64 {
                    do {
                        try await playbackService.enqueue(chunkBase64: chunk)
                        audioLevel = max(audioLevel, 0.35)
                        state = .playingAssistant
                    } catch {
                        state = .error(error.localizedDescription)
                    }
                }
            case "provider_error":
                state = .error(event.text ?? "实时语音服务出错了。")
            case "session_end":
                if case .playingAssistant = state {
                    audioLevel = 0
                    state = .idle
                }
            default:
                continue
            }
        }
    }

    private func appendTranscriptIfNeeded(role: TranscriptItem.Role, content: String) {
        let normalizedContent = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedContent.isEmpty else {
            return
        }

        if let last = transcript.last,
           last.role == role,
           last.content.trimmingCharacters(in: .whitespacesAndNewlines) == normalizedContent {
            return
        }

        transcript.append(TranscriptItem(role: role, content: normalizedContent))
        coordinator.latestTranscript = transcript
    }

    private func startElapsedTimer() {
        elapsedTimer?.invalidate()
        elapsedTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, let startedAt = self.sessionStartedAt else {
                    return
                }

                self.elapsedSeconds = Date().timeIntervalSince(startedAt)
            }
        }
    }

    private func stopElapsedTimer() {
        elapsedTimer?.invalidate()
        elapsedTimer = nil
    }

    private func refreshRealtimeVoice() async {
        guard let sessionID, settings.voiceBackend == .aliyunLegacy else {
            return
        }

        do {
            try await realtimeService.connect(sessionID: sessionID, voice: selectedVoice)
            startEventStream()
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    var formattedElapsedTime: String {
        let totalSeconds = Int(elapsedSeconds)
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }
}
