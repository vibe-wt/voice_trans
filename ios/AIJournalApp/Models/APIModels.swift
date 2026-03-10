import Foundation

struct APIEnvelope<T: Decodable>: Decodable {
    let ok: Bool
    let data: T?
    let error: APIErrorPayload?
}

struct APIErrorPayload: Decodable, Error, LocalizedError {
    let message: String

    var errorDescription: String? {
        message
    }
}

struct StartSessionResponseDTO: Decodable {
    let sessionId: String
    let provider: String
    let status: String
}

struct RealtimeConnectResponseDTO: Decodable {
    let sessionId: String
    let provider: String
    let transport: String
    let endpoint: String?
}

struct RealtimeEventsResponseDTO: Decodable {
    let sessionId: String
    let transport: String
    let events: [RealtimeEventDTO]
}

struct FinalizeResponseDTO: Decodable {
    let sessionId: String
    let status: String
    let journal: JournalEntryDTO
    let candidateEvents: [PlannedTaskDTO]
}

struct DeleteSessionResponseDTO: Decodable {
    let deleted: Bool
}

struct LiveKitTokenResponseDTO: Decodable {
    let serverUrl: String
    let roomName: String
    let participantIdentity: String
    let token: String
    let expiresAt: String
}

struct JournalEntryDTO: Codable, Hashable {
    let id: String
    let sessionId: String
    let userId: String
    let entryDate: String
    let title: String
    let events: [String]
    let thoughts: [String]
    let mood: String?
    let wins: [String]
    let problems: [String]
    let ideas: [String]
    let markdown: String
}

struct SessionSummaryDTO: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let date: String
    let provider: String
    let status: String
}

struct TranscriptSegmentDTO: Codable, Identifiable, Hashable {
    let id: String
    let sessionId: String
    let role: String
    let content: String
    let seq: Int
    let startedAt: String?
    let endedAt: String?
}

struct TranscriptResponseDTO: Codable, Hashable {
    let transcript: [TranscriptSegmentDTO]
}
