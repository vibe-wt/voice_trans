import Foundation

protocol APIClientProtocol {
    var baseURL: URL { get }
    func startVoiceSession() async throws -> StartSessionResponseDTO
    func finalizeVoiceSession(sessionID: String, transcript: [TranscriptItem]) async throws -> FinalizeResponseDTO
    func testConnection() async throws -> [SessionSummaryDTO]
    func fetchJournal(sessionID: String) async throws -> JournalEntryDTO
    func fetchTasks(sessionID: String) async throws -> [PlannedTaskDTO]
    func fetchTranscript(sessionID: String) async throws -> [TranscriptItem]
    func fetchSessions() async throws -> [SessionSummaryDTO]
    func deleteSession(sessionID: String) async throws
    func fetchLiveKitToken(sessionID: String, participantName: String?) async throws -> LiveKitTokenResponseDTO
    func updateTask(taskID: String, title: String, notes: String?, startTime: String?, endTime: String?) async throws -> PlannedTaskDTO
    func linkCalendarEvent(taskID: String, calendarEventID: String, source: String, status: String) async throws -> PlannedTaskDTO
    func unlinkCalendarEvent(taskID: String) async throws -> PlannedTaskDTO
}

final class APIClient: APIClientProtocol {
    private let settings: AppSettings
    private let session: URLSession

    var baseURL: URL { settings.apiBaseURL }

    init(
        settings: AppSettings,
        session: URLSession = .shared
    ) {
        self.settings = settings
        self.session = session
    }

    func startVoiceSession() async throws -> StartSessionResponseDTO {
        try await send(
            path: "/api/session/start",
            method: "POST",
            body: EmptyRequestBody()
        )
    }

    func finalizeVoiceSession(sessionID: String, transcript: [TranscriptItem]) async throws -> FinalizeResponseDTO {
        try await send(
            path: "/api/session/finalize",
            method: "POST",
            body: FinalizeRequestBody(
                sessionId: sessionID,
                transcript: transcript.map(TranscriptPayload.init)
            )
        )
    }

    func testConnection() async throws -> [SessionSummaryDTO] {
        try await fetchSessions()
    }

    func fetchJournal(sessionID: String) async throws -> JournalEntryDTO {
        try await send(
            path: "/api/journal/\(sessionID)",
            method: "GET",
            body: Optional<EmptyRequestBody>.none
        )
    }

    func fetchTasks(sessionID: String) async throws -> [PlannedTaskDTO] {
        try await send(
            path: "/api/tasks/\(sessionID)",
            method: "GET",
            body: Optional<EmptyRequestBody>.none
        )
    }

    func fetchTranscript(sessionID: String) async throws -> [TranscriptItem] {
        let response: TranscriptResponseDTO = try await send(
            path: "/api/session/\(sessionID)",
            method: "GET",
            body: Optional<EmptyRequestBody>.none
        )

        return response.transcript.map { segment in
            TranscriptItem(
                id: UUID(uuidString: segment.id) ?? UUID(),
                role: TranscriptItem.Role(rawValue: segment.role) ?? .system,
                content: segment.content
            )
        }
    }

    func fetchSessions() async throws -> [SessionSummaryDTO] {
        try await send(
            path: "/api/sessions",
            method: "GET",
            body: Optional<EmptyRequestBody>.none
        )
    }

    func deleteSession(sessionID: String) async throws {
        let response: DeleteSessionResponseDTO = try await send(
            path: "/api/session/\(sessionID)",
            method: "DELETE",
            body: Optional<EmptyRequestBody>.none
        )

        guard response.deleted else {
            throw APIErrorPayload(message: "删除会话失败。")
        }
    }

    func fetchLiveKitToken(sessionID: String, participantName: String? = nil) async throws -> LiveKitTokenResponseDTO {
        try await send(
            path: "/api/livekit/token",
            method: "POST",
            body: LiveKitTokenRequestBody(
                sessionId: sessionID,
                participantName: participantName
            )
        )
    }

    func updateTask(taskID: String, title: String, notes: String?, startTime: String?, endTime: String?) async throws -> PlannedTaskDTO {
        try await send(
            path: "/api/tasks/\(taskID)",
            method: "PATCH",
            body: UpdateTaskRequestBody(
                title: title,
                notes: notes,
                startTime: startTime,
                endTime: endTime
            )
        )
    }

    func linkCalendarEvent(taskID: String, calendarEventID: String, source: String = "ios_eventkit", status: String = "exported") async throws -> PlannedTaskDTO {
        try await send(
            path: "/api/tasks/\(taskID)/calendar-link",
            method: "POST",
            body: CalendarLinkRequestBody(
                calendarEventId: calendarEventID,
                calendarSource: source,
                status: status
            )
        )
    }

    func unlinkCalendarEvent(taskID: String) async throws -> PlannedTaskDTO {
        try await send(
            path: "/api/tasks/\(taskID)/calendar-link",
            method: "DELETE",
            body: Optional<EmptyRequestBody>.none
        )
    }

    func send<Response: Decodable, Body: Encodable>(
        path: String,
        method: String,
        body: Body? = nil
    ) async throws -> Response {
        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        var request = URLRequest(url: baseURL.appendingPathComponent(normalizedPath))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw mappedTransportError(error, baseURL: baseURL)
        }
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIErrorPayload(message: "服务器响应无效。")
        }

        let envelope = try JSONDecoder().decode(APIEnvelope<Response>.self, from: data)

        if !(200 ... 299).contains(httpResponse.statusCode) || !envelope.ok {
            throw envelope.error ?? APIErrorPayload(message: "请求失败。")
        }

        guard let payload = envelope.data else {
            throw APIErrorPayload(message: "响应缺少必要数据。")
        }

        return payload
    }

    private func mappedTransportError(_ error: Error, baseURL: URL) -> APIErrorPayload {
        let nsError = error as NSError

        if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorCannotConnectToHost {
            if baseURL.host == "localhost" || baseURL.host == "127.0.0.1" {
                return APIErrorPayload(message: "当前 API 地址是 localhost。iPhone 真机请改成 Mac 的局域网地址，例如 \(AppSettings.recommendedBaseURL)")
            }

            return APIErrorPayload(message: "无法连接到服务器 \(baseURL.absoluteString)。请确认 Mac 上的 Next.js 服务正在运行，且手机和电脑在同一 Wi‑Fi。")
        }

        return APIErrorPayload(message: nsError.localizedDescription)
    }
}

private struct EmptyRequestBody: Encodable {}

private struct FinalizeRequestBody: Encodable {
    let sessionId: String
    let transcript: [TranscriptPayload]
}

private struct CalendarLinkRequestBody: Encodable {
    let calendarEventId: String
    let calendarSource: String
    let status: String
}

private struct UpdateTaskRequestBody: Encodable {
    let title: String
    let notes: String?
    let startTime: String?
    let endTime: String?
}

private struct LiveKitTokenRequestBody: Encodable {
    let sessionId: String
    let participantName: String?
}

private struct TranscriptPayload: Encodable {
    let role: String
    let content: String

    init(item: TranscriptItem) {
        self.role = item.role.rawValue
        self.content = item.content
    }
}
