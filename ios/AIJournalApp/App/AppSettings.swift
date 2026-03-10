import Combine
import Foundation

final class AppSettings: ObservableObject {
    static let availableVoices = VoicePersonaCatalog.all.map(\.id)
    static let recommendedBaseURL = "http://192.168.137.82:3000"

    @Published var apiBaseURLString: String {
        didSet { UserDefaults.standard.set(apiBaseURLString, forKey: Keys.apiBaseURLString) }
    }

    @Published var defaultVoice: String {
        didSet { UserDefaults.standard.set(defaultVoice, forKey: Keys.defaultVoice) }
    }

    @Published var voiceBackend: VoiceBackend {
        didSet { UserDefaults.standard.set(voiceBackend.rawValue, forKey: Keys.voiceBackend) }
    }

    @Published var liveKitURLString: String {
        didSet { UserDefaults.standard.set(liveKitURLString, forKey: Keys.liveKitURLString) }
    }

    @Published var liveKitTokenEndpointString: String {
        didSet { UserDefaults.standard.set(liveKitTokenEndpointString, forKey: Keys.liveKitTokenEndpointString) }
    }

    @Published var themeStyle: AppThemeStyle {
        didSet { UserDefaults.standard.set(themeStyle.rawValue, forKey: Keys.themeStyle) }
    }

    @Published var defaultPlaybackRate: Double {
        didSet { UserDefaults.standard.set(defaultPlaybackRate, forKey: Keys.defaultPlaybackRate) }
    }

    var apiBaseURL: URL {
        URL(string: apiBaseURLString) ?? URL(string: Self.recommendedBaseURL)!
    }

    var liveKitURL: URL? {
        URL(string: liveKitURLString)
    }

    var liveKitTokenEndpoint: URL? {
        URL(string: liveKitTokenEndpointString)
    }

    init(defaults: UserDefaults = .standard) {
        let storedURL = defaults.string(forKey: Keys.apiBaseURLString)
        if let storedURL, !storedURL.contains("localhost") {
            self.apiBaseURLString = storedURL
        } else {
            self.apiBaseURLString = Self.recommendedBaseURL
        }
        let storedVoice = defaults.string(forKey: Keys.defaultVoice)
        self.defaultVoice = VoicePersonaCatalog.resolve(id: storedVoice).id
        self.voiceBackend = VoiceBackend(rawValue: defaults.string(forKey: Keys.voiceBackend) ?? VoiceBackend.aliyunLegacy.rawValue) ?? .aliyunLegacy
        self.liveKitURLString = defaults.string(forKey: Keys.liveKitURLString) ?? ""
        self.liveKitTokenEndpointString = defaults.string(forKey: Keys.liveKitTokenEndpointString) ?? ""
        self.themeStyle = AppThemeStyle(rawValue: defaults.string(forKey: Keys.themeStyle) ?? AppThemeStyle.calmPaper.rawValue) ?? .calmPaper

        let storedRate = defaults.object(forKey: Keys.defaultPlaybackRate) as? Double
        self.defaultPlaybackRate = min(max(storedRate ?? 1.0, 0.1), 3.0)
    }
}

private enum Keys {
    static let apiBaseURLString = "app_settings.api_base_url"
    static let defaultVoice = "app_settings.default_voice"
    static let voiceBackend = "app_settings.voice_backend"
    static let liveKitURLString = "app_settings.livekit_url"
    static let liveKitTokenEndpointString = "app_settings.livekit_token_endpoint"
    static let themeStyle = "app_settings.theme_style"
    static let defaultPlaybackRate = "app_settings.default_playback_rate"
}
