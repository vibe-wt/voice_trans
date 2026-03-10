import Foundation

struct RealtimeEventDTO: Codable, Hashable {
    let type: String
    let role: String?
    let text: String?
    let chunkBase64: String?
}
