import EventKit
import Foundation

protocol CalendarServiceProtocol {
    func permissionStatus() -> PermissionStatus
    func requestAccess() async throws -> Bool
    func createOrUpdateEvent(for task: PlannedTaskDTO) async throws -> String
    func removeEvent(identifier: String) async throws
}

enum CalendarServiceError: LocalizedError {
    case accessDenied
    case invalidDateRange
    case eventNotFound
    case calendarUnavailable

    var errorDescription: String? {
        switch self {
        case .accessDenied:
            return "没有获得日历权限。"
        case .invalidDateRange:
            return "任务缺少可写入日历的有效日期。"
        case .eventNotFound:
            return "没有找到对应的日历事件。"
        case .calendarUnavailable:
            return "当前设备没有可写入的系统日历。"
        }
    }
}

final class CalendarService: CalendarServiceProtocol {
    private let store = EKEventStore()
    private let calendarTitle = "AI Voice Journal"

    func permissionStatus() -> PermissionStatus {
        switch EKEventStore.authorizationStatus(for: .event) {
        case .fullAccess, .writeOnly:
            return .authorized
        case .denied:
            return .denied
        case .notDetermined:
            return .notDetermined
        case .restricted:
            return .restricted
        @unknown default:
            return .unknown
        }
    }

    func requestAccess() async throws -> Bool {
        try await withCheckedThrowingContinuation { continuation in
            store.requestFullAccessToEvents { granted, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: granted)
                }
            }
        }
    }

    func createOrUpdateEvent(for task: PlannedTaskDTO) async throws -> String {
        let granted = try await requestAccess()
        guard granted else {
            throw CalendarServiceError.accessDenied
        }

        guard let dateRange = Self.resolveDateRange(for: task) else {
            throw CalendarServiceError.invalidDateRange
        }

        let event: EKEvent
        if let existingID = task.calendarEventId,
           let existing = store.event(withIdentifier: existingID) {
            event = existing
        } else {
            let newEvent = EKEvent(eventStore: store)
            newEvent.calendar = try preferredCalendar()
            event = newEvent
        }

        event.title = task.title
        event.startDate = dateRange.start
        event.endDate = dateRange.end
        event.isAllDay = dateRange.isAllDay
        event.location = task.location
        event.notes = Self.composeNotes(for: task)

        try store.save(event, span: .thisEvent)
        return event.eventIdentifier
    }

    func removeEvent(identifier: String) async throws {
        let granted = try await requestAccess()
        guard granted else {
            throw CalendarServiceError.accessDenied
        }

        guard let event = store.event(withIdentifier: identifier) else {
            throw CalendarServiceError.eventNotFound
        }

        try store.remove(event, span: .thisEvent)
    }

    private func preferredCalendar() throws -> EKCalendar {
        if let existing = store.calendars(for: .event).first(where: { $0.title == calendarTitle }) {
            return existing
        }

        if let calendar = store.defaultCalendarForNewEvents ?? store.calendars(for: .event).first {
            return calendar
        }

        throw CalendarServiceError.calendarUnavailable
    }

    private static func resolveDateRange(for task: PlannedTaskDTO) -> (start: Date, end: Date, isAllDay: Bool)? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let startTime = task.startTime, let start = iso.date(from: startTime) ?? fallbackISODate(from: startTime) {
            let end = task.endTime.flatMap { iso.date(from: $0) ?? fallbackISODate(from: $0) } ?? start.addingTimeInterval(60 * 30)
            return (start, max(end, start.addingTimeInterval(60 * 15)), false)
        }

        let dayFormatter = DateFormatter()
        dayFormatter.calendar = Calendar(identifier: .gregorian)
        dayFormatter.locale = Locale(identifier: "en_US_POSIX")
        dayFormatter.timeZone = TimeZone.current
        dayFormatter.dateFormat = "yyyy-MM-dd"

        guard let day = dayFormatter.date(from: task.taskDate) else {
            return nil
        }

        let nextDay = Calendar.current.date(byAdding: .day, value: 1, to: day) ?? day.addingTimeInterval(60 * 60 * 24)
        return (day, nextDay, true)
    }

    private static func fallbackISODate(from value: String) -> Date? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        return iso.date(from: value)
    }

    private static func composeNotes(for task: PlannedTaskDTO) -> String {
        var lines: [String] = []

        if let notes = task.notes, !notes.isEmpty {
            lines.append(notes)
        }

        lines.append("来源：AI Voice Journal")
        lines.append("任务 ID：\(task.id)")
        lines.append("会话 ID：\(task.sessionId)")

        return lines.joined(separator: "\n")
    }
}

struct StubCalendarService: CalendarServiceProtocol {
    func permissionStatus() -> PermissionStatus { .authorized }
    func requestAccess() async throws -> Bool { true }
    func createOrUpdateEvent(for task: PlannedTaskDTO) async throws -> String { task.id }
    func removeEvent(identifier: String) async throws {}
}
