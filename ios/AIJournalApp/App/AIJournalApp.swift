import SwiftUI

@main
struct AIJournalApp: App {
    var body: some Scene {
        WindowGroup {
            RootTabView()
                .tint(AppTheme.accent)
                .preferredColorScheme(.light)
        }
    }
}
