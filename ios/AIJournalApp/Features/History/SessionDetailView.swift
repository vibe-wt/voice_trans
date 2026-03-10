import SwiftUI

struct SessionDetailView: View {
    let session: SessionSummaryDTO
    @ObservedObject var coordinator: AppCoordinator
    let apiClient: APIClientProtocol
    var onDelete: ((String) -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var isLoading = false
    @State private var isDeleting = false
    @State private var errorMessage: String?
    @State private var journal: JournalEntryDTO?
    @State private var tasks: [PlannedTaskDTO] = []
    @State private var transcript: [TranscriptItem] = []
    @State private var showDeleteConfirmation = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerCard

                if let errorMessage {
                    Text(errorMessage)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .foregroundStyle(AppTheme.danger)
                        .themeCard()
                }

                if let journal {
                    journalCard(journal)
                }

                if !tasks.isEmpty {
                    tasksCard
                }

                transcriptCard
                actionButtons
            }
            .padding()
        }
        .background(AppTheme.background.ignoresSafeArea())
        .overlay {
            if isLoading {
                ProgressView("正在加载会话详情…")
            }
        }
        .navigationTitle("会话详情")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(role: .destructive) {
                    showDeleteConfirmation = true
                } label: {
                    Image(systemName: "trash")
                }
                .disabled(isDeleting)
            }
        }
        .task {
            await loadDetails()
        }
        .confirmationDialog(
            "删除这条会话？",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("删除", role: .destructive) {
                Task {
                    await deleteSession()
                }
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text("删除后将无法恢复：\(session.title)")
        }
    }

    private var headerCard: some View {
        HStack(alignment: .top, spacing: 14) {
            ThemeIconBadge(systemName: "waveform.path.ecg", tint: AppTheme.accent)

            VStack(alignment: .leading, spacing: 10) {
                Text("会话详情")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.accent)
                Text(session.title)
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(AppTheme.ink)

                HStack(spacing: 8) {
                    Text(session.date)
                        .pill(background: AppTheme.surfaceMuted, foreground: AppTheme.inkSecondary)
                    Text(session.providerLabel)
                        .pill(background: AppTheme.surfaceMuted, foreground: AppTheme.accent)
                    Text(session.statusLabel)
                        .pill(background: AppTheme.surfaceMuted, foreground: AppTheme.success)
                }
            }
        }
        .themeCard()
    }

    private func journalCard(_ journal: JournalEntryDTO) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("今日日记", systemImage: "book")
                .font(.headline)
                .foregroundStyle(AppTheme.ink)

            Text(journal.title)
                .font(.title3.bold())
                .foregroundStyle(AppTheme.ink)

            if let mood = journal.mood, !mood.isEmpty {
                Text("情绪：\(mood)")
                    .pill(background: AppTheme.accentSoft, foreground: AppTheme.inkSecondary)
            }

            if !journal.markdown.isEmpty {
                Text(journal.markdown)
                    .foregroundStyle(AppTheme.inkSecondary)
            }
        }
        .themeCard()
    }

    private var tasksCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("明日安排", systemImage: "calendar")
                .font(.headline)
                .foregroundStyle(AppTheme.ink)

            ForEach(tasks) { task in
                taskRow(task)
            }
        }
        .themeCard()
    }

    private func taskRow(_ task: PlannedTaskDTO) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(task.title)
                .font(.headline)
                .foregroundStyle(AppTheme.ink)
            Text(task.taskDate)
                .foregroundStyle(AppTheme.inkSecondary)
            if let notes = task.notes, !notes.isEmpty {
                Text(notes)
                    .font(.footnote)
                    .foregroundStyle(AppTheme.inkSecondary)
            }
        }
        .padding(12)
        .background(AppTheme.surfaceMuted.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var transcriptCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("对话字幕", systemImage: "text.quote")
                .font(.headline)
                .foregroundStyle(AppTheme.ink)

            if transcript.isEmpty, !isLoading {
                Text("暂无 transcript。")
                    .foregroundStyle(AppTheme.inkSecondary)
            } else {
                ForEach(transcript) { item in
                    transcriptRow(item)
                }
            }
        }
        .themeCard()
    }

    private func transcriptRow(_ item: TranscriptItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.role.label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(item.role == .assistant ? AppTheme.success : AppTheme.accent)
            Text(item.content)
                .foregroundStyle(AppTheme.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(AppTheme.surfaceMuted.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var actionButtons: some View {
        VStack(spacing: 12) {
            Button("设为当前会话") {
                coordinator.currentSessionID = session.id
                coordinator.latestJournal = journal
                coordinator.latestTasks = tasks
                coordinator.latestTranscript = transcript
            }
            .buttonStyle(PrimaryActionButtonStyle())

            Button(role: .destructive) {
                showDeleteConfirmation = true
            } label: {
                if isDeleting {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Text("删除这条会话")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(SecondaryActionButtonStyle(tint: AppTheme.danger))
            .disabled(isDeleting)
        }
    }

    private func loadDetails() async {
        isLoading = true
        errorMessage = nil

        do {
            async let journalRequest = apiClient.fetchJournal(sessionID: session.id)
            async let tasksRequest = apiClient.fetchTasks(sessionID: session.id)
            async let transcriptRequest = apiClient.fetchTranscript(sessionID: session.id)

            journal = try await journalRequest
            tasks = try await tasksRequest
            transcript = try await transcriptRequest
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private func deleteSession() async {
        isDeleting = true
        errorMessage = nil

        do {
            try await apiClient.deleteSession(sessionID: session.id)

            if coordinator.currentSessionID == session.id {
                coordinator.currentSessionID = nil
                coordinator.latestJournal = nil
                coordinator.latestTasks = []
                coordinator.latestTranscript = []
            }

            onDelete?(session.id)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }

        isDeleting = false
    }
}
