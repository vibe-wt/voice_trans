import Foundation

@MainActor
protocol LiveKitRealtimeServiceProtocol: AnyObject {
    func connect(sessionID: String, participantName: String?) async throws
    func setMicrophone(enabled: Bool) async throws
    func disconnect() async
    var isConnected: Bool { get }
}

#if canImport(LiveKit)
import LiveKit

@MainActor
final class LiveKitRealtimeService: NSObject, LiveKitRealtimeServiceProtocol, RoomDelegate {
    private let apiClient: APIClientProtocol
    private var room: Room?

    var isConnected: Bool {
        room?.connectionState == .connected
    }

    init(apiClient: APIClientProtocol) {
        self.apiClient = apiClient
    }

    func connect(sessionID: String, participantName: String?) async throws {
        if room?.connectionState == .connected {
            return
        }

        let tokenPayload = try await apiClient.fetchLiveKitToken(
            sessionID: sessionID,
            participantName: participantName
        )

        let room = Room(delegate: self)
        self.room = room

        try await AudioManager.shared.setRecordingAlwaysPreparedMode(true)
        try await room.connect(url: tokenPayload.serverUrl, token: tokenPayload.token)
    }

    func setMicrophone(enabled: Bool) async throws {
        guard let room else {
            throw APIErrorPayload(message: "LiveKit 房间还没有连接成功。")
        }

        try await room.localParticipant.setMicrophone(enabled: enabled)
    }

    func disconnect() async {
        guard let room else {
            return
        }

        await room.disconnect()
        self.room = nil
    }
}

#else

final class LiveKitRealtimeService: LiveKitRealtimeServiceProtocol {
    private let apiClient: APIClientProtocol

    var isConnected: Bool { false }

    init(apiClient: APIClientProtocol) {
        self.apiClient = apiClient
    }

    func connect(sessionID: String, participantName: String?) async throws {
        _ = apiClient
        _ = sessionID
        _ = participantName
        throw APIErrorPayload(message: "iOS 工程里还没有完成 LiveKit SDK 接入。")
    }

    func setMicrophone(enabled: Bool) async throws {
        _ = enabled
        throw APIErrorPayload(message: "iOS 工程里还没有完成 LiveKit SDK 接入。")
    }

    func disconnect() async {}
}

#endif
