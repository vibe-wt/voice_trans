import Foundation
import Combine

final class AppCoordinator: ObservableObject {
    @Published var apiBaseURL = URL(string: AppSettings.recommendedBaseURL)!
    @Published var isAuthenticated = false
    @Published var currentSessionID: String?
    @Published var latestJournal: JournalEntryDTO?
    @Published var latestTasks: [PlannedTaskDTO] = []
    @Published var latestTranscript: [TranscriptItem] = []
}
