import SwiftUI

struct TodayJournalView: View {
    @ObservedObject var coordinator: AppCoordinator
    let apiClient: APIClientProtocol

    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var shareText: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView("正在加载今日总结…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let journal = coordinator.latestJournal {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack(alignment: .top, spacing: 14) {
                            ThemeIconBadge(systemName: "book.closed.fill", tint: AppTheme.accent)

                            VStack(alignment: .leading, spacing: 10) {
                                Text("今日记录")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(AppTheme.accent)
                                Text(journal.title)
                                    .font(.system(size: 28, weight: .bold, design: .rounded))
                                    .foregroundStyle(AppTheme.ink)

                                if let mood = journal.mood, !mood.isEmpty {
                                    Label(mood, systemImage: "face.smiling")
                                        .pill(background: AppTheme.accentSoft, foreground: AppTheme.inkSecondary)
                                }
                            }
                        }
                        .themeCard()

                        if !journal.events.isEmpty {
                            section("今天发生了什么", items: journal.events)
                        }

                        if !journal.thoughts.isEmpty {
                            section("想法与感受", items: journal.thoughts)
                        }

                        if !journal.wins.isEmpty {
                            section("进展", items: journal.wins)
                        }

                        if !journal.problems.isEmpty {
                            section("问题", items: journal.problems)
                        }

                        if !journal.ideas.isEmpty {
                            section("灵感", items: journal.ideas)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                }
            } else {
                ContentUnavailableView(
                    "今日总结",
                    systemImage: "book.closed",
                    description: Text(errorMessage ?? "先完成一轮语音会话整理，这里会展示生成的今日日记。")
                )
            }
        }
        .navigationTitle("今日")
        .background(AppTheme.background.ignoresSafeArea())
        .toolbar {
            if coordinator.latestJournal != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        shareText = journalShareText
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
        }
        .sheet(item: Binding(
            get: { shareText.map(SharePayload.init) },
            set: { shareText = $0?.value }
        )) { payload in
            ShareSheet(items: [payload.value])
        }
        .task(id: coordinator.currentSessionID) {
            await loadJournalIfNeeded()
        }
    }

    @ViewBuilder
    private func section(_ title: String, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: iconName(for: title))
                .font(.headline)
                .foregroundStyle(AppTheme.ink)
            ForEach(items, id: \.self) { item in
                Text("• \(item)")
                    .foregroundStyle(AppTheme.inkSecondary)
            }
        }
        .themeCard()
    }

    private func iconName(for title: String) -> String {
        switch title {
        case "今天发生了什么":
            return "sun.max"
        case "想法与感受":
            return "bubble.left.and.text.bubble.right"
        case "进展":
            return "checkmark.seal"
        case "问题":
            return "exclamationmark.circle"
        case "灵感":
            return "lightbulb"
        default:
            return "square.text.square"
        }
    }

    private func loadJournalIfNeeded() async {
        guard coordinator.latestJournal == nil, let sessionID = coordinator.currentSessionID else {
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            coordinator.latestJournal = try await apiClient.fetchJournal(sessionID: sessionID)
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private var journalShareText: String {
        guard let journal = coordinator.latestJournal else {
            return ""
        }

        var lines: [String] = []
        lines.append("今日总结")
        lines.append(journal.title)

        if let mood = journal.mood, !mood.isEmpty {
            lines.append("情绪：\(mood)")
        }

        if !journal.events.isEmpty {
            lines.append("")
            lines.append("今天发生了什么")
            lines.append(contentsOf: journal.events.map { "- \($0)" })
        }

        if !journal.thoughts.isEmpty {
            lines.append("")
            lines.append("想法与感受")
            lines.append(contentsOf: journal.thoughts.map { "- \($0)" })
        }

        if !journal.wins.isEmpty {
            lines.append("")
            lines.append("进展")
            lines.append(contentsOf: journal.wins.map { "- \($0)" })
        }

        if !journal.problems.isEmpty {
            lines.append("")
            lines.append("问题")
            lines.append(contentsOf: journal.problems.map { "- \($0)" })
        }

        if !journal.ideas.isEmpty {
            lines.append("")
            lines.append("灵感")
            lines.append(contentsOf: journal.ideas.map { "- \($0)" })
        }

        return lines.joined(separator: "\n")
    }
}

private struct SharePayload: Identifiable {
    let id = UUID()
    let value: String
}
