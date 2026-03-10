import Foundation

enum DisplayText {
    static func provider(_ rawValue: String) -> String {
        switch rawValue.lowercased() {
        case "aliyun":
            return "阿里云"
        case "doubao":
            return "豆包"
        case "livekit":
            return "LiveKit"
        default:
            return rawValue
        }
    }

    static func sessionStatus(_ rawValue: String) -> String {
        switch rawValue.lowercased() {
        case "completed":
            return "已完成"
        case "active":
            return "进行中"
        case "draft":
            return "草稿"
        case "exported":
            return "已导出"
        default:
            return rawValue
        }
    }

    static func taskPriority(_ rawValue: String) -> String {
        switch rawValue.lowercased() {
        case "high":
            return "高优先级"
        case "medium":
            return "中优先级"
        case "low":
            return "低优先级"
        default:
            return rawValue
        }
    }
}

extension SessionSummaryDTO {
    var providerLabel: String {
        DisplayText.provider(provider)
    }

    var statusLabel: String {
        DisplayText.sessionStatus(status)
    }
}

extension PlannedTaskDTO {
    var priorityLabel: String {
        DisplayText.taskPriority(priority)
    }
}

extension TranscriptItem.Role {
    var label: String {
        switch self {
        case .user:
            return "我"
        case .assistant:
            return "助手"
        case .system:
            return "系统"
        }
    }
}
