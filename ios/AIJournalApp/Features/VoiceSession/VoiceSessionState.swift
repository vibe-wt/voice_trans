import Foundation

enum VoiceSessionState: Equatable {
    case idle
    case connecting
    case listening
    case waitingForAssistant
    case playingAssistant
    case finalizing
    case error(String)

    var statusLabel: String {
        switch self {
        case .idle:
            "待命"
        case .connecting:
            "连接中"
        case .listening:
            "聆听中"
        case .waitingForAssistant:
            "等待回复"
        case .playingAssistant:
            "播放中"
        case .finalizing:
            "整理中"
        case .error:
            "错误"
        }
    }
}
