import SwiftUI
import UIKit

struct VoiceSessionView: View {
    @ObservedObject var viewModel: VoiceSessionViewModel
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                statusSection
                controlsSection
                personaSection
                transcriptSection
                assistantSection
            }
            .padding()
        }
        .background(AppTheme.background.ignoresSafeArea())
        .navigationTitle("语音")
        .onAppear {
            viewModel.syncPreferences()
        }
    }

    private var statusSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("语音会话")
                .font(.title2.bold())
                .foregroundStyle(AppTheme.ink)

            Text(statusDescription)
                .font(.subheadline)
                .foregroundStyle(AppTheme.inkSecondary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 8) {
                Text(viewModel.voiceBackend == .liveKit ? "LiveKit 通道" : "阿里云直连")
                    .pill(background: AppTheme.surfaceMuted, foreground: AppTheme.inkSecondary)
                Text(statusTitle)
                    .pill(background: statusTint.opacity(0.12), foreground: statusTint)
                Text(viewModel.formattedElapsedTime)
                    .pill(background: AppTheme.surfaceMuted, foreground: AppTheme.inkSecondary)
                if viewModel.sessionID != nil {
                    Text("会话已就绪")
                        .pill(background: AppTheme.surfaceMuted, foreground: AppTheme.inkSecondary)
                }
            }

            if case let .error(message) = viewModel.state {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(AppTheme.danger)
            }

            if viewModel.microphonePermissionStatus() == .denied {
                Button("打开系统设置开启麦克风") {
                    openAppSettings()
                }
                .buttonStyle(SecondaryActionButtonStyle(tint: AppTheme.danger))
            }
        }
        .themeCard()
    }

    private var controlsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("控制")
                .font(.headline)
                .foregroundStyle(AppTheme.ink)

            Button(isConnectedReady ? "已连接" : "开始连接") {
                Task { await viewModel.startSession() }
            }
            .buttonStyle(PrimaryActionButtonStyle())
            .disabled(viewModel.state == .connecting || viewModel.state == .finalizing || isConnectedReady)

            Button(viewModel.state == .listening ? "停止录音" : "开始录音") {
                if viewModel.state == .listening {
                    viewModel.stopListening()
                } else {
                    Task { await viewModel.beginConversation() }
                }
            }
            .buttonStyle(SecondaryActionButtonStyle(tint: viewModel.state == .listening ? AppTheme.danger : AppTheme.success))
            .disabled(viewModel.state == .connecting || viewModel.state == .finalizing)

            Button("结束整理") {
                Task { await viewModel.finalizeSession() }
            }
            .buttonStyle(SecondaryActionButtonStyle(tint: AppTheme.accent))
            .disabled(viewModel.sessionID == nil || viewModel.transcript.isEmpty || viewModel.state == .finalizing)
        }
        .themeCard()
    }

    private var personaSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("角色与语速")
                .font(.headline)
                .foregroundStyle(AppTheme.ink)

            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 12) {
                    ForEach(VoicePersonaCatalog.all) { persona in
                        personaCard(persona)
                    }
                }
                .padding(.vertical, 2)
            }

            VStack(alignment: .leading, spacing: 10) {
                Text(viewModel.selectedPersona.name)
                    .font(.headline)
                    .foregroundStyle(AppTheme.ink)

                Text(viewModel.selectedPersona.styleLine)
                    .pill(background: AppTheme.accentSoft, foreground: AppTheme.inkSecondary)

                Text(viewModel.selectedPersona.personality)
                    .font(.footnote)
                    .foregroundStyle(AppTheme.inkSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                Text("通话中可以随时切换角色，下一轮回复会立即用新的音色和风格。")
                    .font(.footnote)
                    .foregroundStyle(AppTheme.inkSecondary)
            }
            .padding(14)
            .background(AppTheme.surfaceMuted.opacity(0.55))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            VStack(alignment: .leading, spacing: 8) {
                Text("语速 \(viewModel.playbackRate, format: .number.precision(.fractionLength(2))) 倍")
                    .foregroundStyle(AppTheme.inkSecondary)

                Slider(
                    value: Binding(
                        get: { viewModel.playbackRate },
                        set: { viewModel.updatePlaybackRate($0) }
                    ),
                    in: 0.1 ... 3.0,
                    step: 0.05
                )
                .tint(AppTheme.accent)

                HStack {
                    Text("慢一点")
                    Spacer()
                    Text("快一点")
                }
                .font(.caption)
                .foregroundStyle(AppTheme.inkSecondary)
            }
        }
        .themeCard()
    }

    private var transcriptSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("实时字幕")
                .font(.headline)
                .foregroundStyle(AppTheme.ink)

            if viewModel.transcript.isEmpty {
                Text("开始录音后，这里会显示你和助手的实时字幕。")
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.inkSecondary)
            } else {
                ForEach(viewModel.transcript) { item in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.role.label)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(item.role == .assistant ? AppTheme.success : AppTheme.accent)
                        Text(item.content)
                            .foregroundStyle(AppTheme.ink)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(AppTheme.surfaceMuted.opacity(0.55))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
        }
        .themeCard()
    }

    private var assistantSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("助手回复")
                .font(.headline)
                .foregroundStyle(AppTheme.ink)

            Text(assistantCapabilityText)
                .font(.footnote)
                .foregroundStyle(AppTheme.inkSecondary)

            if viewModel.assistantReply.isEmpty {
                Text("助手的回复内容会显示在这里。")
                    .font(.subheadline)
                    .foregroundStyle(AppTheme.inkSecondary)
            } else {
                Text(viewModel.assistantReply)
                    .foregroundStyle(AppTheme.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .themeCard()
    }

    private func personaCard(_ persona: VoicePersona) -> some View {
        let isSelected = viewModel.selectedVoice == persona.id

        return Button {
            viewModel.updateSelectedVoice(persona.id)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Text(persona.name)
                    .font(.headline)
                    .foregroundStyle(isSelected ? AppTheme.accent : AppTheme.ink)
                Text(persona.styleLine)
                    .font(.caption)
                    .foregroundStyle(AppTheme.inkSecondary)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
                Spacer(minLength: 0)
                Text(isSelected ? "当前角色" : "切换到此角色")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(isSelected ? AppTheme.accent : AppTheme.inkSecondary)
            }
            .padding(14)
            .frame(width: 172, height: 122, alignment: .topLeading)
            .background(isSelected ? AppTheme.accentSoft.opacity(0.95) : AppTheme.surfaceMuted.opacity(0.55))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(isSelected ? AppTheme.accent.opacity(0.45) : AppTheme.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var isConnectedReady: Bool {
        viewModel.sessionID != nil && viewModel.state == .idle
    }

    private var statusTitle: String {
        switch viewModel.state {
        case .idle:
            return isConnectedReady ? "已连接" : "待命"
        case .connecting:
            return "连接中"
        case .listening:
            return "录音中"
        case .waitingForAssistant:
            return "等待回复"
        case .playingAssistant:
            return "播放中"
        case .finalizing:
            return "整理中"
        case .error:
            return "异常"
        }
    }

    private var statusDescription: String {
        switch viewModel.state {
        case .idle:
            return isConnectedReady ? "连接已建立，可以开始说话了。" : "先建立连接，再开始一轮语音聊天。"
        case .connecting:
            return "正在连接服务端和实时语音链路。"
        case .listening:
            return "正在采集你的语音，说完后点一次“停止录音”。"
        case .waitingForAssistant:
            return "你的语音已经上传，助手正在组织回复。"
        case .playingAssistant:
            return "助手正在用语音和字幕一起回复你。"
        case .finalizing:
            return "正在生成今日日记和明日安排。"
        case .error:
            return "当前链路有异常，请先看上面的错误提示。"
        }
    }

    private var assistantCapabilityText: String {
        switch viewModel.voiceBackend {
        case .aliyunLegacy:
            return "当前使用阿里云直连链路，已经支持边聊边回；切换角色后，下一轮回复会立即切到新音色。"
        case .liveKit:
            return "LiveKit 是后续迁移方向，目标是把体验继续推向更接近电话通话。"
        }
    }

    private var statusTint: Color {
        switch viewModel.state {
        case .idle:
            return isConnectedReady ? AppTheme.success : AppTheme.inkSecondary
        case .connecting, .waitingForAssistant, .finalizing:
            return AppTheme.accent
        case .listening, .playingAssistant:
            return AppTheme.success
        case .error:
            return AppTheme.danger
        }
    }

    private func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            return
        }

        openURL(url)
    }
}
