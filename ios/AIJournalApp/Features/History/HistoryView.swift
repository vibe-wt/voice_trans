import SwiftUI

struct HistoryView: View {
    @ObservedObject var coordinator: AppCoordinator
    let apiClient: APIClientProtocol

    @State private var sessions: [SessionSummaryDTO] = []
    @State private var searchText = ""
    @State private var selectedStatusFilter = "全部状态"
    @State private var selectedProviderFilter = "全部来源"
    @State private var isLoading = false
    @State private var deletingSessionID: String?
    @State private var errorMessage: String?
    @State private var pendingDeleteSession: SessionSummaryDTO?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 14) {
                    ThemeIconBadge(systemName: "clock.arrow.trianglehead.counterclockwise.rotate.90", tint: AppTheme.accent)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("历史会话")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(AppTheme.accent)
                        Text("回看之前的语音会话")
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .foregroundStyle(AppTheme.ink)
                        Text("查看历史 transcript、日记和明日安排。")
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.inkSecondary)
                    }
                }
                .themeCard()

                VStack(alignment: .leading, spacing: 10) {
                    Label("搜索历史会话", systemImage: "magnifyingglass")
                        .font(.headline)
                        .foregroundStyle(AppTheme.ink)

                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(AppTheme.inkSecondary)

                        TextField("按标题、日期、来源或状态搜索", text: $searchText)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()

                        if !searchText.isEmpty {
                            Button {
                                searchText = ""
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(AppTheme.inkSecondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(14)
                    .background(AppTheme.surfaceMuted.opacity(0.7))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .themeCard()

                VStack(alignment: .leading, spacing: 12) {
                    Label("快速筛选", systemImage: "line.3.horizontal.decrease.circle")
                        .font(.headline)
                        .foregroundStyle(AppTheme.ink)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(statusFilterOptions, id: \.self) { option in
                                filterChip(
                                    title: option,
                                    isSelected: selectedStatusFilter == option
                                ) {
                                    selectedStatusFilter = option
                                }
                            }
                        }
                    }

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(providerFilterOptions, id: \.self) { option in
                                filterChip(
                                    title: option,
                                    isSelected: selectedProviderFilter == option
                                ) {
                                    selectedProviderFilter = option
                                }
                            }
                        }
                    }
                }
                .themeCard()

                if let errorMessage {
                    Text(errorMessage)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .foregroundStyle(AppTheme.danger)
                        .themeCard()
                }

                if sessions.isEmpty, !isLoading {
                    VStack(alignment: .leading, spacing: 12) {
                        Image(systemName: "clock.arrow.circlepath")
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundStyle(AppTheme.accent)
                        Text("还没有历史会话")
                            .font(.headline)
                            .foregroundStyle(AppTheme.ink)
                        Text("完成几轮语音对话后，这里会出现你的历史记录。")
                            .foregroundStyle(AppTheme.inkSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .themeCard()
                } else if filteredSessions.isEmpty, !isLoading {
                    VStack(alignment: .leading, spacing: 12) {
                        Image(systemName: "magnifyingglass.circle")
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundStyle(AppTheme.accent)
                        Text("没有匹配的历史会话")
                            .font(.headline)
                            .foregroundStyle(AppTheme.ink)
                        Text("试试改短关键词，或者放宽状态、来源筛选。")
                            .foregroundStyle(AppTheme.inkSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .themeCard()
                } else {
                    HStack {
                        Text("搜索结果")
                            .font(.headline)
                            .foregroundStyle(AppTheme.ink)
                        Spacer()
                        Text("\(filteredSessions.count) 条")
                            .pill(background: AppTheme.surfaceMuted, foreground: AppTheme.inkSecondary)
                    }

                    ForEach(groupedSessions) { group in
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Label(group.title, systemImage: "calendar")
                                    .font(.headline)
                                    .foregroundStyle(AppTheme.ink)
                                Spacer()
                                Text("\(group.sessions.count) 条")
                                    .pill(background: AppTheme.surfaceMuted, foreground: AppTheme.inkSecondary)
                            }

                            ForEach(group.sessions) { session in
                                HStack(alignment: .top, spacing: 12) {
                                    NavigationLink {
                                        SessionDetailView(
                                            session: session,
                                            coordinator: coordinator,
                                            apiClient: apiClient,
                                            onDelete: { deletedID in
                                                handleDeletedSession(id: deletedID)
                                            }
                                        )
                                    } label: {
                                        HStack(alignment: .top, spacing: 14) {
                                            ZStack {
                                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                                    .fill(AppTheme.accentSoft)
                                                    .frame(width: 52, height: 52)
                                                Image(systemName: "waveform")
                                                    .font(.system(size: 20, weight: .semibold))
                                                    .foregroundStyle(AppTheme.accent)
                                            }

                                            VStack(alignment: .leading, spacing: 8) {
                                                Text(session.title)
                                                    .font(.headline)
                                                    .foregroundStyle(AppTheme.ink)
                                                    .multilineTextAlignment(.leading)

                                                HStack(spacing: 8) {
                                                    Text(session.date)
                                                        .pill(background: AppTheme.surfaceMuted, foreground: AppTheme.inkSecondary)
                                                    Text(session.providerLabel)
                                                        .pill(background: AppTheme.surfaceMuted, foreground: AppTheme.accent)
                                                    Text(session.statusLabel)
                                                        .pill(background: AppTheme.surfaceMuted, foreground: AppTheme.success)
                                                }
                                            }

                                            Spacer(minLength: 0)
                                        }
                                    }
                                    .buttonStyle(.plain)

                                    Button(role: .destructive) {
                                        pendingDeleteSession = session
                                    } label: {
                                        if deletingSessionID == session.id {
                                            ProgressView()
                                                .tint(AppTheme.danger)
                                                .frame(width: 28, height: 28)
                                        } else {
                                            Image(systemName: "trash")
                                                .font(.system(size: 16, weight: .semibold))
                                                .foregroundStyle(AppTheme.danger)
                                                .frame(width: 28, height: 28)
                                        }
                                    }
                                    .buttonStyle(.plain)
                                    .disabled(deletingSessionID != nil)
                                }
                                .themeCard()
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .background(AppTheme.background.ignoresSafeArea())
        .overlay {
            if isLoading {
                ProgressView("正在加载历史会话…")
            }
        }
        .navigationTitle("历史")
        .task {
            await loadSessions()
        }
        .confirmationDialog(
            "删除这条历史会话？",
            isPresented: Binding(
                get: { pendingDeleteSession != nil },
                set: { isPresented in
                    if !isPresented {
                        pendingDeleteSession = nil
                    }
                }
            ),
            titleVisibility: .visible
        ) {
            Button("删除", role: .destructive) {
                if let session = pendingDeleteSession {
                    Task {
                        await deleteSession(session)
                        pendingDeleteSession = nil
                    }
                }
            }
            Button("取消", role: .cancel) {
                pendingDeleteSession = nil
            }
        } message: {
            Text("会同时删除这条会话的 transcript、今日日记和明日安排：\(pendingDeleteSession?.title ?? "")")
        }
    }

    private func loadSessions() async {
        isLoading = true
        errorMessage = nil

        do {
            sessions = try await apiClient.fetchSessions()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private var filteredSessions: [SessionSummaryDTO] {
        let keyword = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return sessions.filter { session in
            let matchesKeyword = keyword.isEmpty
                || session.title.lowercased().contains(keyword)
                || session.date.lowercased().contains(keyword)
                || session.provider.lowercased().contains(keyword)
                || session.status.lowercased().contains(keyword)
                || session.providerLabel.lowercased().contains(keyword)
                || session.statusLabel.lowercased().contains(keyword)

            let matchesStatus = selectedStatusFilter == "全部状态"
                || session.statusLabel == selectedStatusFilter

            let matchesProvider = selectedProviderFilter == "全部来源"
                || session.providerLabel == selectedProviderFilter

            return matchesKeyword && matchesStatus && matchesProvider
        }
    }

    private var statusFilterOptions: [String] {
        let values = Set(sessions.map(\.statusLabel)).sorted()
        return ["全部状态"] + values
    }

    private var providerFilterOptions: [String] {
        let values = Set(sessions.map(\.providerLabel)).sorted()
        return ["全部来源"] + values
    }

    private var groupedSessions: [SessionGroup] {
        let grouped = Dictionary(grouping: filteredSessions, by: \.date)

        return grouped
            .map { date, sessions in
                SessionGroup(
                    id: date,
                    title: displayTitle(for: date),
                    sessions: sessions.sorted { $0.title.localizedCompare($1.title) == .orderedAscending }
                )
            }
            .sorted { $0.id > $1.id }
    }

    private func displayTitle(for date: String) -> String {
        if date == Self.todayString {
            return "今天"
        }

        if date == Self.yesterdayString {
            return "昨天"
        }

        return date
    }

    @ViewBuilder
    private func filterChip(title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isSelected ? Color.white : AppTheme.inkSecondary)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(isSelected ? AppTheme.accent : AppTheme.surfaceMuted)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func deleteSession(_ session: SessionSummaryDTO) async {
        deletingSessionID = session.id
        errorMessage = nil

        do {
            try await apiClient.deleteSession(sessionID: session.id)
            handleDeletedSession(id: session.id)
        } catch {
            errorMessage = error.localizedDescription
        }

        deletingSessionID = nil
    }

    private func handleDeletedSession(id: String) {
        sessions.removeAll { $0.id == id }

        if coordinator.currentSessionID == id {
            coordinator.currentSessionID = nil
            coordinator.latestJournal = nil
            coordinator.latestTasks = []
            coordinator.latestTranscript = []
        }
    }

    private struct SessionGroup: Identifiable {
        let id: String
        let title: String
        let sessions: [SessionSummaryDTO]
    }

    private static let todayString: String = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }()

    private static let yesterdayString: String = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date())
    }()
}
