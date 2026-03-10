import Foundation

enum PermissionStatus: String {
    case authorized
    case denied
    case notDetermined
    case restricted
    case unknown

    var label: String {
        switch self {
        case .authorized:
            return "已允许"
        case .denied:
            return "已拒绝"
        case .notDetermined:
            return "未请求"
        case .restricted:
            return "受限制"
        case .unknown:
            return "未知"
        }
    }
}
