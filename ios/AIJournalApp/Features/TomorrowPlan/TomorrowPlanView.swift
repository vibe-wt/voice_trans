import SwiftUI

struct TomorrowPlanView: View {
    @ObservedObject var coordinator: AppCoordinator
    let apiClient: APIClientProtocol
    let calendarService: CalendarServiceProtocol

    @State private var syncingTaskID: String?
    @State private var editingTaskID: String?
    @State private var errorMessage: String?
    @State private var noticeMessage: String?
    @State private var drafts: [String: TaskDraft] = [:]
    @State private var shareText: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerCard

                if let noticeMessage {
                    Text(noticeMessage)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .foregroundStyle(AppTheme.success)
                        .themeCard()
                }

                if let errorMessage {
                    Text(errorMessage)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .foregroundStyle(AppTheme.danger)
                        .themeCard()
                }

                if coordinator.latestTasks.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Image(systemName: "calendar.badge.plus")
                            .font(.system(size: 28, weight: .semibold))
                            .foregroundStyle(AppTheme.accent)
                        Text("还没有生成明日安排")
                            .font(.headline)
                            .foregroundStyle(AppTheme.ink)
                        Text("先完成一轮语音会话整理，这里会显示明日任务，并支持写入系统日历。")
                            .foregroundStyle(AppTheme.inkSecondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .themeCard()
                } else {
                    sectionHeader

                    ForEach(coordinator.latestTasks) { task in
                        taskCard(task)
                    }
                }
            }
            .padding()
        }
        .navigationTitle("明日")
        .background(AppTheme.background.ignoresSafeArea())
        .toolbar {
            if !coordinator.latestTasks.isEmpty {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        shareText = tasksShareText
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
            await loadTasksIfNeeded()
        }
    }

    private var headerCard: some View {
        HStack(alignment: .top, spacing: 14) {
            ThemeIconBadge(systemName: "calendar.badge.clock", tint: AppTheme.accent)

            VStack(alignment: .leading, spacing: 10) {
                Text("明日安排")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AppTheme.accent)
                Text("把明天安排成可执行的一天")
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .foregroundStyle(AppTheme.ink)
                Text("从语音会话里提取出的任务，可以直接同步到 iPhone 系统日历。")
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.inkSecondary)
            }
        }
        .themeCard()
    }

    private var sectionHeader: some View {
        Label("待同步到系统日历", systemImage: "apple.logo")
            .font(.headline)
            .foregroundStyle(AppTheme.ink)
    }

    @ViewBuilder
    private func taskCard(_ task: PlannedTaskDTO) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            taskCardHeader(task)
            taskCardActions(task)
        }
        .themeCard()
    }

    @ViewBuilder
    private func taskCardHeader(_ task: PlannedTaskDTO) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 6) {
                taskTitle(task)
                taskMetaRow(task)
                taskLocation(task)
                taskNotesOrEditor(task)
                taskCalendarBinding(task)
            }

            Spacer(minLength: 12)

            Text(task.priorityLabel)
                .pill(background: AppTheme.surfaceMuted, foreground: AppTheme.accent)
        }
    }

    @ViewBuilder
    private func taskTitle(_ task: PlannedTaskDTO) -> some View {
        if editingTaskID == task.id {
            TextField("任务标题", text: binding(for: task).title)
                .font(.headline)
                .textInputAutocapitalization(.never)
                .padding(12)
                .background(AppTheme.surfaceMuted.opacity(0.7))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        } else {
            Text(task.title)
                .font(.headline)
                .foregroundStyle(AppTheme.ink)
        }
    }

    @ViewBuilder
    private func taskMetaRow(_ task: PlannedTaskDTO) -> some View {
        HStack(spacing: 8) {
            Text(task.taskDate)
                .pill(background: AppTheme.surfaceMuted, foreground: AppTheme.inkSecondary)

            if let timeLabel = timeRangeLabel(for: currentTask(for: task)) {
                Text(timeLabel)
                    .pill(background: AppTheme.accentSoft, foreground: AppTheme.inkSecondary)
            }
        }
    }

    @ViewBuilder
    private func taskLocation(_ task: PlannedTaskDTO) -> some View {
        if let location = task.location, !location.isEmpty {
            Label(location, systemImage: "mappin.and.ellipse")
                .font(.footnote)
                .foregroundStyle(AppTheme.inkSecondary)
        }
    }

    @ViewBuilder
    private func taskNotesOrEditor(_ task: PlannedTaskDTO) -> some View {
        if editingTaskID == task.id {
            VStack(alignment: .leading, spacing: 8) {
                TextField("备注", text: binding(for: task).notes, axis: .vertical)
                    .lineLimit(2 ... 4)
                    .padding(12)
                    .background(AppTheme.surfaceMuted.opacity(0.7))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                DatePicker(
                    "开始时间",
                    selection: binding(for: task).startDate,
                    displayedComponents: [.hourAndMinute]
                )
                .foregroundStyle(AppTheme.inkSecondary)

                DatePicker(
                    "结束时间",
                    selection: binding(for: task).endDate,
                    displayedComponents: [.hourAndMinute]
                )
                .foregroundStyle(AppTheme.inkSecondary)
            }
        } else if let notes = task.notes, !notes.isEmpty {
            Text(notes)
                .font(.footnote)
                .foregroundStyle(AppTheme.inkSecondary)
        }
    }

    @ViewBuilder
    private func taskCalendarBinding(_ task: PlannedTaskDTO) -> some View {
        if let calendarEventID = task.calendarEventId, !calendarEventID.isEmpty {
            Text("已同步到日历")
                .pill(background: AppTheme.success.opacity(0.14), foreground: AppTheme.success)
            Text(calendarEventID)
                .font(.caption2)
                .foregroundStyle(AppTheme.inkSecondary)
        }
    }

    @ViewBuilder
    private func taskCardActions(_ task: PlannedTaskDTO) -> some View {
        HStack {
            if editingTaskID == task.id {
                Button("保存修改") {
                    saveDraft(for: task)
                }
                .buttonStyle(PrimaryActionButtonStyle())

                Button("取消") {
                    cancelEditing(taskID: task.id)
                }
                .buttonStyle(SecondaryActionButtonStyle(tint: AppTheme.inkSecondary))
            } else {
                Button("编辑") {
                    beginEditing(task)
                }
                .buttonStyle(SecondaryActionButtonStyle(tint: AppTheme.accent))
            }

            Button(task.calendarEventId == nil ? "写入日历" : "更新日历") {
                Task {
                    await syncTaskToCalendar(currentTask(for: task))
                }
            }
            .buttonStyle(PrimaryActionButtonStyle())
            .disabled(syncingTaskID == task.id)

            if let calendarEventID = task.calendarEventId, !calendarEventID.isEmpty {
                Button("移除绑定") {
                    Task {
                        await removeTaskFromCalendar(currentTask(for: task))
                    }
                }
                .buttonStyle(SecondaryActionButtonStyle(tint: AppTheme.inkSecondary))
                .disabled(syncingTaskID == task.id)
            }

            if syncingTaskID == task.id {
                ProgressView()
            }
        }
    }

    private func syncTaskToCalendar(_ task: PlannedTaskDTO) async {
        syncingTaskID = task.id
        errorMessage = nil

        do {
            let calendarEventID = try await calendarService.createOrUpdateEvent(for: task)
            let updatedTask = try await apiClient.linkCalendarEvent(
                taskID: task.id,
                calendarEventID: calendarEventID,
                source: "ios_eventkit",
                status: "exported"
            )

            replaceTask(updatedTask)
            noticeMessage = "已同步 \(updatedTask.title) 到系统日历。"
        } catch {
            errorMessage = error.localizedDescription
        }

        syncingTaskID = nil
    }

    private func removeTaskFromCalendar(_ task: PlannedTaskDTO) async {
        syncingTaskID = task.id
        errorMessage = nil

        do {
            if let calendarEventID = task.calendarEventId, !calendarEventID.isEmpty {
                try await calendarService.removeEvent(identifier: calendarEventID)
            }

            let updatedTask = try await apiClient.unlinkCalendarEvent(taskID: task.id)
            replaceTask(updatedTask)
            noticeMessage = "已解除 \(updatedTask.title) 的日历绑定。"
        } catch {
            errorMessage = error.localizedDescription
        }

        syncingTaskID = nil
    }

    private func replaceTask(_ updatedTask: PlannedTaskDTO) {
        guard let index = coordinator.latestTasks.firstIndex(where: { $0.id == updatedTask.id }) else {
            return
        }

        coordinator.latestTasks[index] = updatedTask
        drafts[updatedTask.id] = TaskDraft(task: updatedTask)
    }

    private func timeRangeLabel(for task: PlannedTaskDTO) -> String? {
        let formatter = ISO8601DateFormatter()

        guard let startRaw = task.startTime,
              let startDate = formatter.date(from: startRaw) ?? fallbackISODate(startRaw) else {
            return nil
        }

        let output = DateFormatter()
        output.timeStyle = .short

        if let endRaw = task.endTime,
           let endDate = formatter.date(from: endRaw) ?? fallbackISODate(endRaw) {
            return "\(output.string(from: startDate)) - \(output.string(from: endDate))"
        }

        return output.string(from: startDate)
    }

    private func fallbackISODate(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }

    private func loadTasksIfNeeded() async {
        guard coordinator.latestTasks.isEmpty, let sessionID = coordinator.currentSessionID else {
            return
        }

        errorMessage = nil

        do {
            coordinator.latestTasks = try await apiClient.fetchTasks(sessionID: sessionID)
            for task in coordinator.latestTasks {
                drafts[task.id] = TaskDraft(task: task)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func beginEditing(_ task: PlannedTaskDTO) {
        drafts[task.id] = TaskDraft(task: currentTask(for: task))
        editingTaskID = task.id
    }

    private func cancelEditing(taskID: String) {
        editingTaskID = nil
        if let current = coordinator.latestTasks.first(where: { $0.id == taskID }) {
            drafts[taskID] = TaskDraft(task: current)
        }
    }

    private func saveDraft(for task: PlannedTaskDTO) {
        let updated = currentTask(for: task)

        Task {
            do {
                let persisted = try await apiClient.updateTask(
                    taskID: task.id,
                    title: updated.title,
                    notes: updated.notes,
                    startTime: updated.startTime,
                    endTime: updated.endTime
                )

                await MainActor.run {
                    replaceTask(persisted)
                    editingTaskID = nil
                    noticeMessage = "已保存 \(persisted.title) 的任务修改。"
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private func currentTask(for task: PlannedTaskDTO) -> PlannedTaskDTO {
        guard let draft = drafts[task.id] else {
            return task
        }

        return PlannedTaskDTO(
            id: task.id,
            sessionId: task.sessionId,
            userId: task.userId,
            taskDate: task.taskDate,
            title: draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? task.title : draft.title,
            notes: draft.notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : draft.notes,
            location: task.location,
            priority: task.priority,
            confidence: task.confidence,
            startTime: isoDateTimeString(for: draft.startDate, taskDate: task.taskDate),
            endTime: isoDateTimeString(for: draft.endDate, taskDate: task.taskDate),
            sourceType: task.sourceType,
            calendarEventId: task.calendarEventId,
            calendarSource: task.calendarSource,
            status: task.status
        )
    }

    private func binding(for task: PlannedTaskDTO) -> TaskDraftBinding {
        if drafts[task.id] == nil {
            drafts[task.id] = TaskDraft(task: task)
        }

        return TaskDraftBinding(
            title: Binding(
                get: { drafts[task.id]?.title ?? task.title },
                set: { drafts[task.id]?.title = $0 }
            ),
            notes: Binding(
                get: { drafts[task.id]?.notes ?? (task.notes ?? "") },
                set: { drafts[task.id]?.notes = $0 }
            ),
            startDate: Binding(
                get: { drafts[task.id]?.startDate ?? dateFromTask(task) ?? Date() },
                set: { drafts[task.id]?.startDate = $0 }
            ),
            endDate: Binding(
                get: { drafts[task.id]?.endDate ?? endDateFromTask(task) ?? (dateFromTask(task)?.addingTimeInterval(1800) ?? Date().addingTimeInterval(1800)) },
                set: { drafts[task.id]?.endDate = $0 }
            )
        )
    }

    private func dateFromTask(_ task: PlannedTaskDTO) -> Date? {
        guard let raw = task.startTime else { return nil }
        return ISO8601DateFormatter().date(from: raw) ?? fallbackISODate(raw)
    }

    private func endDateFromTask(_ task: PlannedTaskDTO) -> Date? {
        guard let raw = task.endTime else { return nil }
        return ISO8601DateFormatter().date(from: raw) ?? fallbackISODate(raw)
    }

    private func isoDateTimeString(for time: Date, taskDate: String) -> String? {
        let dayFormatter = DateFormatter()
        dayFormatter.locale = Locale(identifier: "en_US_POSIX")
        dayFormatter.timeZone = TimeZone.current
        dayFormatter.dateFormat = "yyyy-MM-dd"

        guard let day = dayFormatter.date(from: taskDate) else {
            return nil
        }

        let calendar = Calendar.current
        let components = calendar.dateComponents([.hour, .minute], from: time)
        guard let merged = calendar.date(bySettingHour: components.hour ?? 9, minute: components.minute ?? 0, second: 0, of: day) else {
            return nil
        }

        return ISO8601DateFormatter().string(from: merged)
    }

    private var tasksShareText: String {
        var lines: [String] = []
        lines.append("明日安排")

        for task in coordinator.latestTasks {
            let current = currentTask(for: task)
            var row = "- \(current.title)"

            if let label = timeRangeLabel(for: current) {
                row += "（\(label)）"
            }

            lines.append(row)

            if let notes = current.notes, !notes.isEmpty {
                lines.append("  备注：\(notes)")
            }

            if let location = current.location, !location.isEmpty {
                lines.append("  地点：\(location)")
            }
        }

        return lines.joined(separator: "\n")
    }
}

private struct TaskDraft {
    var title: String
    var notes: String
    var startDate: Date
    var endDate: Date

    init(task: PlannedTaskDTO) {
        let start = ISO8601DateFormatter().date(from: task.startTime ?? "") ?? Date()
        let end = ISO8601DateFormatter().date(from: task.endTime ?? "") ?? start.addingTimeInterval(1800)

        self.title = task.title
        self.notes = task.notes ?? ""
        self.startDate = start
        self.endDate = end
    }
}

private struct TaskDraftBinding {
    let title: Binding<String>
    let notes: Binding<String>
    let startDate: Binding<Date>
    let endDate: Binding<Date>
}

private struct SharePayload: Identifiable {
    let id = UUID()
    let value: String
}
