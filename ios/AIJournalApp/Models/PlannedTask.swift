import Foundation

struct PlannedTaskDTO: Codable, Identifiable, Hashable {
    let id: String
    let sessionId: String
    let userId: String
    let taskDate: String
    let title: String
    let notes: String?
    let location: String?
    let priority: String
    let confidence: String
    let startTime: String?
    let endTime: String?
    let sourceType: String
    let calendarEventId: String?
    let calendarSource: String?
    let status: String
}
