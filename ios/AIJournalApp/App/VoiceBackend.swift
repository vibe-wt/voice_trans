import Foundation

enum VoiceBackend: String, CaseIterable, Identifiable {
    case aliyunLegacy
    case liveKit

    var id: String { rawValue }

    var title: String {
        switch self {
        case .aliyunLegacy:
            "阿里云直连"
        case .liveKit:
            "LiveKit 实时通道"
        }
    }

    var subtitle: String {
        switch self {
        case .aliyunLegacy:
            "当前直连阿里云的链路，已经可用，但还不是最终的通话级方案"
        case .liveKit:
            "后续切到 WebRTC 实时方案，用来逼近电话式对话体验"
        }
    }
}
