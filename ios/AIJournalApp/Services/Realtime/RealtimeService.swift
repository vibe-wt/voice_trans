import Foundation

protocol RealtimeServiceProtocol {
    func connect(sessionID: String, voice: String) async throws
    func sendAudioChunk(sessionID: String, base64Chunk: String, voice: String) async throws -> [RealtimeEventDTO]
    func openEventStream(
        sessionID: String,
        voice: String,
        onEvent: @escaping @Sendable (RealtimeEventDTO) async -> Void,
        onError: @escaping @Sendable (Error) -> Void
    )
    func closeEventStream()
}

final class RealtimePollingService: RealtimeServiceProtocol {
    private let settings: AppSettings
    private let session: URLSession
    private var streamTask: Task<Void, Never>?

    init(
        settings: AppSettings,
        session: URLSession = .shared
    ) {
        self.settings = settings
        self.session = session
    }

    func connect(sessionID: String, voice: String) async throws {
        _ = try await send(
            path: "/api/realtime/connect",
            body: RealtimeSessionBody(
                sessionId: sessionID,
                userId: "demo-user",
                provider: "aliyun",
                voice: voice
            )
        ) as RealtimeConnectResponseDTO
    }

    func sendAudioChunk(sessionID: String, base64Chunk: String, voice: String) async throws -> [RealtimeEventDTO] {
        let response: RealtimeEventsResponseDTO = try await send(
            path: "/api/realtime/chunk",
            body: RealtimeChunkBody(
                sessionId: sessionID,
                chunkBase64: base64Chunk,
                userId: "demo-user",
                voice: voice,
                deliveryMode: "stream"
            )
        )
        return response.events
    }

    func openEventStream(
        sessionID: String,
        voice: String,
        onEvent: @escaping @Sendable (RealtimeEventDTO) async -> Void,
        onError: @escaping @Sendable (Error) -> Void
    ) {
        closeEventStream()

        streamTask = Task { [settings, session] in
            do {
                let url = try makeStreamURL(baseURL: settings.apiBaseURL, sessionID: sessionID, voice: voice)
                var request = URLRequest(url: url)
                request.httpMethod = "GET"
                request.setValue("text/event-stream", forHTTPHeaderField: "Accept")

                let (bytes, response) = try await session.bytes(for: request)
                guard let httpResponse = response as? HTTPURLResponse, (200 ... 299).contains(httpResponse.statusCode) else {
                    throw APIErrorPayload(message: "实时语音流连接失败。")
                }

                for try await line in bytes.lines {
                    if Task.isCancelled {
                        break
                    }

                    guard line.hasPrefix("data: ") else {
                        continue
                    }

                    let jsonString = String(line.dropFirst(6))
                    guard let data = jsonString.data(using: .utf8) else {
                        continue
                    }

                    do {
                        let event = try JSONDecoder().decode(RealtimeEventDTO.self, from: data)
                        await onEvent(event)
                    } catch {
                        onError(APIErrorPayload(message: "实时语音事件解析失败。"))
                    }
                }
            } catch {
                if !Task.isCancelled {
                    onError(error)
                }
            }
        }
    }

    func closeEventStream() {
        streamTask?.cancel()
        streamTask = nil
    }

    private func send<Response: Decodable, Body: Encodable>(
        path: String,
        body: Body
    ) async throws -> Response {
        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        var request = URLRequest(url: settings.apiBaseURL.appendingPathComponent(normalizedPath))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIErrorPayload(message: "实时语音响应无效。")
        }

        let envelope = try JSONDecoder().decode(APIEnvelope<Response>.self, from: data)
        if !(200 ... 299).contains(httpResponse.statusCode) || !envelope.ok {
            throw envelope.error ?? APIErrorPayload(message: "实时语音请求失败。")
        }

        guard let payload = envelope.data else {
            throw APIErrorPayload(message: "实时语音响应缺少数据。")
        }

        return payload
    }
}

private struct RealtimeSessionBody: Encodable {
    let sessionId: String
    let userId: String
    let provider: String
    let voice: String
}

private struct RealtimeChunkBody: Encodable {
    let sessionId: String
    let chunkBase64: String
    let userId: String
    let voice: String
    let deliveryMode: String
}

private struct RealtimeEventsBody: Encodable {
    let sessionId: String
    let userId: String
    let voice: String
}

private func makeStreamURL(baseURL: URL, sessionID: String, voice: String) throws -> URL {
    let normalizedPath = "api/realtime/stream"
    guard var components = URLComponents(url: baseURL.appendingPathComponent(normalizedPath), resolvingAgainstBaseURL: false) else {
        throw APIErrorPayload(message: "无法构建实时语音流地址。")
    }

    components.queryItems = [
        URLQueryItem(name: "sessionId", value: sessionID),
        URLQueryItem(name: "userId", value: "demo-user"),
        URLQueryItem(name: "voice", value: voice)
    ]

    guard let url = components.url else {
        throw APIErrorPayload(message: "无法构建实时语音流地址。")
    }

    return url
}
