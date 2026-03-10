import SwiftUI
import UIKit

struct SettingsView: View {
    @ObservedObject var settings: AppSettings
    let apiClient: APIClientProtocol
    let audioCaptureService: AudioCaptureServiceProtocol
    let calendarService: CalendarServiceProtocol
    @Environment(\.openURL) private var openURL

    @State private var isTestingConnection = false
    @State private var connectionMessage: String?
    @State private var connectionSucceeded = false
    @State private var microphoneStatus: PermissionStatus = .unknown
    @State private var calendarStatus: PermissionStatus = .unknown
    @State private var isRequestingMicrophone = false
    @State private var isRequestingCalendar = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 14) {
                    ThemeIconBadge(systemName: "slider.horizontal.3", tint: AppTheme.accent)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("偏好设置")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(AppTheme.accent)
                        Text("配置你的 iPhone 语音助手")
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .foregroundStyle(AppTheme.ink)
                        Text("这里管理开发服务器地址、默认角色、权限和连接诊断。")
                            .font(.subheadline)
                            .foregroundStyle(AppTheme.inkSecondary)
                    }
                }
                .themeCard()

                VStack(alignment: .leading, spacing: 12) {
                    Text("联调地址")
                        .font(.headline)
                        .foregroundStyle(AppTheme.ink)

                    Text("当前默认实时服务：阿里云")
                        .foregroundStyle(AppTheme.ink)

                    TextField("服务端地址", text: $settings.apiBaseURLString)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()
                        .padding(14)
                        .background(AppTheme.surfaceMuted.opacity(0.7))
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    Text("iPhone 真机不要填 localhost。当前建议直接填 \(AppSettings.recommendedBaseURL)")
                        .font(.footnote)
                        .foregroundStyle(AppTheme.inkSecondary)

                    Text("当前地址：\(settings.apiBaseURL.absoluteString)")
                        .font(.footnote)
                        .foregroundStyle(AppTheme.inkSecondary)
                }
                .themeCard()

                VStack(alignment: .leading, spacing: 12) {
                    Text("语音后端")
                        .font(.headline)
                        .foregroundStyle(AppTheme.ink)

                    VStack(spacing: 12) {
                        ForEach(VoiceBackend.allCases) { backend in
                            Button {
                                settings.voiceBackend = backend
                            } label: {
                                HStack(alignment: .top, spacing: 12) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(backend.title)
                                            .font(.headline)
                                            .foregroundStyle(AppTheme.ink)
                                        Text(backend.subtitle)
                                            .font(.footnote)
                                            .foregroundStyle(AppTheme.inkSecondary)
                                    }

                                    Spacer()

                                    Image(systemName: settings.voiceBackend == backend ? "checkmark.circle.fill" : "circle")
                                        .font(.title3)
                                        .foregroundStyle(settings.voiceBackend == backend ? AppTheme.accent : AppTheme.inkSecondary.opacity(0.5))
                                }
                                .padding(14)
                                .background(AppTheme.surfaceMuted.opacity(0.55))
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    if settings.voiceBackend == .liveKit {
                        VStack(alignment: .leading, spacing: 10) {
                            TextField("LiveKit 服务器地址", text: $settings.liveKitURLString)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.URL)
                                .autocorrectionDisabled()
                                .padding(14)
                                .background(AppTheme.surfaceMuted.opacity(0.7))
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                            TextField("LiveKit Token 接口地址", text: $settings.liveKitTokenEndpointString)
                                .textInputAutocapitalization(.never)
                                .keyboardType(.URL)
                                .autocorrectionDisabled()
                                .padding(14)
                                .background(AppTheme.surfaceMuted.opacity(0.7))
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                            Text("LiveKit 是后续迁移方向，目标是继续压低延迟，让体验更接近电话式语音聊天。")
                                .font(.footnote)
                                .foregroundStyle(AppTheme.inkSecondary)
                        }
                    }
                }
                .themeCard()

                VStack(alignment: .leading, spacing: 12) {
                    Text("连接诊断")
                        .font(.headline)
                        .foregroundStyle(AppTheme.ink)

                    Button(isTestingConnection ? "测试中..." : "测试服务器连接") {
                        Task {
                            await testConnection()
                        }
                    }
                    .buttonStyle(PrimaryActionButtonStyle())
                    .disabled(isTestingConnection)

                    Button("恢复默认地址") {
                        settings.apiBaseURLString = AppSettings.recommendedBaseURL
                        connectionMessage = nil
                        connectionSucceeded = false
                    }
                    .buttonStyle(SecondaryActionButtonStyle(tint: AppTheme.inkSecondary))
                    .disabled(isTestingConnection)

                    if let connectionMessage {
                        Text(connectionMessage)
                            .foregroundStyle(connectionSucceeded ? AppTheme.success : AppTheme.danger)
                    }
                }
                .themeCard()

                VStack(alignment: .leading, spacing: 12) {
                    Text("主题风格")
                        .font(.headline)
                        .foregroundStyle(AppTheme.ink)

                    VStack(spacing: 12) {
                        ForEach(AppThemeStyle.allCases) { style in
                            Button {
                                settings.themeStyle = style
                            } label: {
                                HStack(spacing: 14) {
                                    HStack(spacing: 8) {
                                        Circle()
                                            .fill(AppTheme.palette(for: style).accent)
                                            .frame(width: 16, height: 16)
                                        Circle()
                                            .fill(AppTheme.palette(for: style).surfaceMuted)
                                            .frame(width: 16, height: 16)
                                        Circle()
                                            .fill(AppTheme.palette(for: style).ink)
                                            .frame(width: 16, height: 16)
                                    }

                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(style.title)
                                            .font(.headline)
                                            .foregroundStyle(AppTheme.ink)
                                        Text(style.subtitle)
                                            .font(.footnote)
                                            .foregroundStyle(AppTheme.inkSecondary)
                                    }

                                    Spacer()

                                    if settings.themeStyle == style {
                                        Image(systemName: "checkmark.circle.fill")
                                            .font(.title3)
                                            .foregroundStyle(AppTheme.accent)
                                    } else {
                                        Image(systemName: "circle")
                                            .font(.title3)
                                            .foregroundStyle(AppTheme.inkSecondary.opacity(0.5))
                                    }
                                }
                                .padding(14)
                                .background(AppTheme.surfaceMuted.opacity(0.55))
                                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .themeCard()

                VStack(alignment: .leading, spacing: 12) {
                    Text("默认对话")
                        .font(.headline)
                        .foregroundStyle(AppTheme.ink)

                    ScrollView(.horizontal, showsIndicators: false) {
                        LazyHStack(spacing: 12) {
                            ForEach(VoicePersonaCatalog.all) { persona in
                                defaultPersonaCard(persona)
                            }
                        }
                    }

                    let selectedPersona = VoicePersonaCatalog.resolve(id: settings.defaultVoice)

                    VStack(alignment: .leading, spacing: 8) {
                        Text(selectedPersona.name)
                            .font(.headline)
                            .foregroundStyle(AppTheme.ink)
                        Text(selectedPersona.styleLine)
                            .pill(background: AppTheme.accentSoft, foreground: AppTheme.inkSecondary)
                        Text(selectedPersona.personality)
                            .font(.footnote)
                            .foregroundStyle(AppTheme.inkSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(14)
                    .background(AppTheme.surfaceMuted.opacity(0.55))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                    VStack(alignment: .leading, spacing: 8) {
                        Text("默认语速 \(settings.defaultPlaybackRate, format: .number.precision(.fractionLength(2))) 倍")
                            .foregroundStyle(AppTheme.inkSecondary)
                        Slider(value: $settings.defaultPlaybackRate, in: 0.1 ... 3.0, step: 0.05)
                            .tint(AppTheme.accent)
                        HStack {
                            Text("0.1")
                            Spacer()
                            Text("3.0")
                        }
                        .font(.caption)
                        .foregroundStyle(AppTheme.inkSecondary)
                    }
                }
                .themeCard()

                VStack(alignment: .leading, spacing: 12) {
                    Text("权限")
                        .font(.headline)
                        .foregroundStyle(AppTheme.ink)

                    permissionRow(title: "麦克风", status: microphoneStatus)

                    if microphoneStatus != .authorized {
                        Button(isRequestingMicrophone ? "请求中..." : "请求麦克风权限") {
                            Task {
                                await requestMicrophonePermission()
                            }
                        }
                        .buttonStyle(SecondaryActionButtonStyle(tint: AppTheme.accent))
                        .disabled(isRequestingMicrophone)
                    }

                    permissionRow(title: "日历", status: calendarStatus)

                    if calendarStatus != .authorized {
                        Button(isRequestingCalendar ? "请求中..." : "请求日历权限") {
                            Task {
                                await requestCalendarPermission()
                            }
                        }
                        .buttonStyle(SecondaryActionButtonStyle(tint: AppTheme.success))
                        .disabled(isRequestingCalendar)
                    }

                    if microphoneStatus == .denied || calendarStatus == .denied {
                        Button("打开系统设置") {
                            openAppSettings()
                        }
                        .buttonStyle(SecondaryActionButtonStyle(tint: AppTheme.danger))
                    }
                }
                .themeCard()

                VStack(alignment: .leading, spacing: 10) {
                    Text("说明")
                        .font(.headline)
                        .foregroundStyle(AppTheme.ink)
                    Text("设置会保存在本机。修改 API 地址后，新的网络请求会直接使用新地址。")
                        .font(.footnote)
                        .foregroundStyle(AppTheme.inkSecondary)
                }
                .themeCard()
            }
            .padding()
        }
        .navigationTitle("设置")
        .background(AppTheme.background.ignoresSafeArea())
        .task {
            refreshPermissionStatus()
        }
    }

    private func permissionRow(title: String, status: PermissionStatus) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(AppTheme.ink)
            Spacer()
            Text(status.label)
                .pill(
                    background: status == .authorized ? AppTheme.success.opacity(0.14) : AppTheme.surfaceMuted,
                    foreground: status == .authorized ? AppTheme.success : AppTheme.inkSecondary
                )
        }
    }

    private func defaultPersonaCard(_ persona: VoicePersona) -> some View {
        let isSelected = settings.defaultVoice == persona.id

        return Button {
            settings.defaultVoice = persona.id
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
                Text(isSelected ? "默认角色" : "设为默认")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(isSelected ? AppTheme.accent : AppTheme.inkSecondary)
            }
            .padding(14)
            .frame(width: 172, height: 118, alignment: .topLeading)
            .background(isSelected ? AppTheme.accentSoft.opacity(0.95) : AppTheme.surfaceMuted.opacity(0.55))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(isSelected ? AppTheme.accent.opacity(0.45) : AppTheme.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func testConnection() async {
        isTestingConnection = true
        connectionMessage = nil
        connectionSucceeded = false

        guard URL(string: settings.apiBaseURLString) != nil else {
            connectionMessage = "API 地址无效。请检查协议、IP 和端口。"
            isTestingConnection = false
            return
        }

        if settings.apiBaseURLString.contains("localhost") {
            connectionMessage = "当前地址仍然是 localhost。iPhone 真机请改成 Mac 的局域网地址，例如 \(AppSettings.recommendedBaseURL)"
            isTestingConnection = false
            return
        }

        do {
            let sessions = try await apiClient.testConnection()
            connectionSucceeded = true
            connectionMessage = "连接成功。服务端可访问，当前返回 \(sessions.count) 条会话。"
        } catch {
            connectionMessage = """
            连接失败：\(error.localizedDescription)
            如果你在 iPhone 真机上联调，请确认：
            1. 手机和电脑在同一 Wi‑Fi
            2. 地址不是 localhost
            3. 电脑上的 Next.js 服务正在运行
            """
        }

        isTestingConnection = false
    }

    private func requestMicrophonePermission() async {
        isRequestingMicrophone = true
        _ = await audioCaptureService.requestPermission()
        microphoneStatus = audioCaptureService.permissionStatus()
        isRequestingMicrophone = false
    }

    private func requestCalendarPermission() async {
        isRequestingCalendar = true
        _ = try? await calendarService.requestAccess()
        calendarStatus = calendarService.permissionStatus()
        isRequestingCalendar = false
    }

    private func refreshPermissionStatus() {
        microphoneStatus = audioCaptureService.permissionStatus()
        calendarStatus = calendarService.permissionStatus()
    }

    private func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            return
        }

        openURL(url)
    }
}
