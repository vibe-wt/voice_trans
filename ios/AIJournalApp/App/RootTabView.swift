import SwiftUI

struct RootTabView: View {
    private let apiClient: APIClient
    private let calendarService: CalendarService
    private let audioCaptureService: AudioCaptureService
    @StateObject private var settings: AppSettings
    @StateObject private var coordinator: AppCoordinator
    @StateObject private var voiceSessionViewModel: VoiceSessionViewModel

    init() {
        let settings = AppSettings()
        let apiClient = APIClient(settings: settings)
        let calendarService = CalendarService()
        let audioCaptureService = AudioCaptureService()
        let coordinator = AppCoordinator()
        let liveKitService = LiveKitRealtimeService(apiClient: apiClient)

        self.apiClient = apiClient
        self.calendarService = calendarService
        self.audioCaptureService = audioCaptureService
        _settings = StateObject(wrappedValue: settings)
        _coordinator = StateObject(wrappedValue: coordinator)
        _voiceSessionViewModel = StateObject(
            wrappedValue: VoiceSessionViewModel(
                apiClient: apiClient,
                coordinator: coordinator,
                settings: settings,
                realtimeService: RealtimePollingService(settings: settings),
                liveKitService: liveKitService,
                audioCaptureService: audioCaptureService,
                playbackService: AssistantPlaybackService()
            )
        )
    }

    var body: some View {
        TabView {
            NavigationStack {
                VoiceSessionView(viewModel: voiceSessionViewModel)
            }
            .tabItem {
                Label("语音", systemImage: "waveform")
            }

            NavigationStack {
                TodayJournalView(
                    coordinator: coordinator,
                    apiClient: apiClient
                )
            }
            .tabItem {
                Label("今日", systemImage: "book")
            }

            NavigationStack {
                TomorrowPlanView(
                    coordinator: coordinator,
                    apiClient: apiClient,
                    calendarService: calendarService
                )
            }
            .tabItem {
                Label("明日", systemImage: "calendar")
            }

            NavigationStack {
                HistoryView(
                    coordinator: coordinator,
                    apiClient: apiClient
                )
            }
            .tabItem {
                Label("历史", systemImage: "clock.arrow.circlepath")
            }

            NavigationStack {
                SettingsView(
                    settings: settings,
                    apiClient: apiClient,
                    audioCaptureService: audioCaptureService,
                    calendarService: calendarService
                )
            }
            .tabItem {
                Label("设置", systemImage: "gearshape")
            }
        }
        .id(settings.themeStyle.rawValue)
        .toolbarBackground(AppTheme.background, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
        .background(AppTheme.background.ignoresSafeArea())
    }
}
