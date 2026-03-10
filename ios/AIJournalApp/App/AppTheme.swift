import SwiftUI

enum AppThemeStyle: String, CaseIterable, Identifiable {
    case calmPaper
    case midnightVoice
    case warmEditorial
    case freshFocus
    case camelliaMorning
    case burgundyTheater
    case jadeMist
    case peachPop

    var id: String { rawValue }

    var title: String {
        switch self {
        case .calmPaper:
            "晨雾纸页"
        case .midnightVoice:
            "深夜电台"
        case .warmEditorial:
            "琥珀专栏"
        case .freshFocus:
            "青柚薄荷"
        case .camelliaMorning:
            "山茶晨光"
        case .burgundyTheater:
            "酒红剧场"
        case .jadeMist:
            "月白青瓷"
        case .peachPop:
            "蜜桃霓虹"
        }
    }

    var subtitle: String {
        switch self {
        case .calmPaper:
            "米白纸感 + 陶土橙"
        case .midnightVoice:
            "深海夜色 + 青绿霓光"
        case .warmEditorial:
            "奶油纸面 + 砖橘金棕"
        case .freshFocus:
            "雾绿效率感 + 清爽白"
        case .camelliaMorning:
            "山茶粉雾 + 晨光奶白"
        case .burgundyTheater:
            "酒红幕布 + 香槟金"
        case .jadeMist:
            "青瓷灰绿 + 月白雾面"
        case .peachPop:
            "蜜桃珊瑚 + 霓光薄荷"
        }
    }
}

struct AppPalette {
    let background: Color
    let surface: Color
    let surfaceMuted: Color
    let ink: Color
    let inkSecondary: Color
    let accent: Color
    let accentSoft: Color
    let success: Color
    let border: Color
    let danger: Color
}

enum AppTheme {
    static var currentStyle: AppThemeStyle {
        let rawValue = UserDefaults.standard.string(forKey: "app_settings.theme_style") ?? AppThemeStyle.calmPaper.rawValue
        return AppThemeStyle(rawValue: rawValue) ?? .calmPaper
    }

    static func palette(for style: AppThemeStyle) -> AppPalette {
        switch style {
        case .calmPaper:
            return AppPalette(
                background: Color(red: 246 / 255, green: 241 / 255, blue: 232 / 255),
                surface: Color(red: 1.0, green: 253 / 255, blue: 248 / 255),
                surfaceMuted: Color(red: 242 / 255, green: 232 / 255, blue: 221 / 255),
                ink: Color(red: 43 / 255, green: 36 / 255, blue: 31 / 255),
                inkSecondary: Color(red: 110 / 255, green: 98 / 255, blue: 88 / 255),
                accent: Color(red: 201 / 255, green: 111 / 255, blue: 74 / 255),
                accentSoft: Color(red: 232 / 255, green: 204 / 255, blue: 191 / 255),
                success: Color(red: 126 / 255, green: 156 / 255, blue: 140 / 255),
                border: Color(red: 224 / 255, green: 214 / 255, blue: 204 / 255),
                danger: Color(red: 176 / 255, green: 83 / 255, blue: 69 / 255)
            )
        case .midnightVoice:
            return AppPalette(
                background: Color(red: 15 / 255, green: 23 / 255, blue: 34 / 255),
                surface: Color(red: 24 / 255, green: 34 / 255, blue: 49 / 255),
                surfaceMuted: Color(red: 34 / 255, green: 47 / 255, blue: 66 / 255),
                ink: Color(red: 243 / 255, green: 246 / 255, blue: 251 / 255),
                inkSecondary: Color(red: 151 / 255, green: 166 / 255, blue: 186 / 255),
                accent: Color(red: 92 / 255, green: 200 / 255, blue: 190 / 255),
                accentSoft: Color(red: 39 / 255, green: 78 / 255, blue: 88 / 255),
                success: Color(red: 242 / 255, green: 166 / 255, blue: 90 / 255),
                border: Color(red: 49 / 255, green: 64 / 255, blue: 85 / 255),
                danger: Color(red: 235 / 255, green: 116 / 255, blue: 108 / 255)
            )
        case .warmEditorial:
            return AppPalette(
                background: Color(red: 251 / 255, green: 247 / 255, blue: 242 / 255),
                surface: Color(red: 1.0, green: 250 / 255, blue: 245 / 255),
                surfaceMuted: Color(red: 242 / 255, green: 233 / 255, blue: 221 / 255),
                ink: Color(red: 52 / 255, green: 42 / 255, blue: 36 / 255),
                inkSecondary: Color(red: 122 / 255, green: 108 / 255, blue: 98 / 255),
                accent: Color(red: 184 / 255, green: 92 / 255, blue: 56 / 255),
                accentSoft: Color(red: 234 / 255, green: 209 / 255, blue: 191 / 255),
                success: Color(red: 217 / 255, green: 164 / 255, blue: 65 / 255),
                border: Color(red: 228 / 255, green: 216 / 255, blue: 205 / 255),
                danger: Color(red: 160 / 255, green: 74 / 255, blue: 60 / 255)
            )
        case .freshFocus:
            return AppPalette(
                background: Color(red: 244 / 255, green: 248 / 255, blue: 246 / 255),
                surface: Color.white,
                surfaceMuted: Color(red: 228 / 255, green: 240 / 255, blue: 234 / 255),
                ink: Color(red: 31 / 255, green: 42 / 255, blue: 36 / 255),
                inkSecondary: Color(red: 102 / 255, green: 117 / 255, blue: 109 / 255),
                accent: Color(red: 46 / 255, green: 139 / 255, blue: 87 / 255),
                accentSoft: Color(red: 206 / 255, green: 233 / 255, blue: 220 / 255),
                success: Color(red: 124 / 255, green: 198 / 255, blue: 166 / 255),
                border: Color(red: 214 / 255, green: 229 / 255, blue: 221 / 255),
                danger: Color(red: 198 / 255, green: 96 / 255, blue: 84 / 255)
            )
        case .camelliaMorning:
            return AppPalette(
                background: Color(red: 252 / 255, green: 244 / 255, blue: 242 / 255),
                surface: Color(red: 255 / 255, green: 250 / 255, blue: 248 / 255),
                surfaceMuted: Color(red: 247 / 255, green: 227 / 255, blue: 225 / 255),
                ink: Color(red: 72 / 255, green: 44 / 255, blue: 48 / 255),
                inkSecondary: Color(red: 132 / 255, green: 103 / 255, blue: 108 / 255),
                accent: Color(red: 203 / 255, green: 102 / 255, blue: 122 / 255),
                accentSoft: Color(red: 243 / 255, green: 202 / 255, blue: 210 / 255),
                success: Color(red: 124 / 255, green: 162 / 255, blue: 128 / 255),
                border: Color(red: 237 / 255, green: 213 / 255, blue: 217 / 255),
                danger: Color(red: 181 / 255, green: 82 / 255, blue: 94 / 255)
            )
        case .burgundyTheater:
            return AppPalette(
                background: Color(red: 31 / 255, green: 18 / 255, blue: 24 / 255),
                surface: Color(red: 54 / 255, green: 30 / 255, blue: 41 / 255),
                surfaceMuted: Color(red: 78 / 255, green: 45 / 255, blue: 57 / 255),
                ink: Color(red: 248 / 255, green: 241 / 255, blue: 236 / 255),
                inkSecondary: Color(red: 203 / 255, green: 178 / 255, blue: 169 / 255),
                accent: Color(red: 207 / 255, green: 133 / 255, blue: 84 / 255),
                accentSoft: Color(red: 102 / 255, green: 63 / 255, blue: 55 / 255),
                success: Color(red: 215 / 255, green: 180 / 255, blue: 111 / 255),
                border: Color(red: 112 / 255, green: 72 / 255, blue: 83 / 255),
                danger: Color(red: 233 / 255, green: 112 / 255, blue: 104 / 255)
            )
        case .jadeMist:
            return AppPalette(
                background: Color(red: 241 / 255, green: 245 / 255, blue: 241 / 255),
                surface: Color(red: 250 / 255, green: 252 / 255, blue: 250 / 255),
                surfaceMuted: Color(red: 224 / 255, green: 233 / 255, blue: 228 / 255),
                ink: Color(red: 36 / 255, green: 53 / 255, blue: 49 / 255),
                inkSecondary: Color(red: 98 / 255, green: 116 / 255, blue: 109 / 255),
                accent: Color(red: 74 / 255, green: 133 / 255, blue: 124 / 255),
                accentSoft: Color(red: 192 / 255, green: 219 / 255, blue: 214 / 255),
                success: Color(red: 121 / 255, green: 154 / 255, blue: 112 / 255),
                border: Color(red: 206 / 255, green: 220 / 255, blue: 213 / 255),
                danger: Color(red: 177 / 255, green: 96 / 255, blue: 88 / 255)
            )
        case .peachPop:
            return AppPalette(
                background: Color(red: 255 / 255, green: 244 / 255, blue: 245 / 255),
                surface: Color(red: 255 / 255, green: 251 / 255, blue: 250 / 255),
                surfaceMuted: Color(red: 255 / 255, green: 223 / 255, blue: 227 / 255),
                ink: Color(red: 73 / 255, green: 34 / 255, blue: 44 / 255),
                inkSecondary: Color(red: 132 / 255, green: 88 / 255, blue: 99 / 255),
                accent: Color(red: 242 / 255, green: 111 / 255, blue: 135 / 255),
                accentSoft: Color(red: 255 / 255, green: 202 / 255, blue: 214 / 255),
                success: Color(red: 69 / 255, green: 190 / 255, blue: 165 / 255),
                border: Color(red: 246 / 255, green: 207 / 255, blue: 214 / 255),
                danger: Color(red: 215 / 255, green: 93 / 255, blue: 107 / 255)
            )
        }
    }

    private static var palette: AppPalette { palette(for: currentStyle) }

    static var background: Color { palette.background }
    static var surface: Color { palette.surface }
    static var surfaceMuted: Color { palette.surfaceMuted }
    static var ink: Color { palette.ink }
    static var inkSecondary: Color { palette.inkSecondary }
    static var accent: Color { palette.accent }
    static var accentSoft: Color { palette.accentSoft }
    static var success: Color { palette.success }
    static var border: Color { palette.border }
    static var danger: Color { palette.danger }
}

struct ThemeCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(AppTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(AppTheme.border, lineWidth: 1)
            )
    }
}

struct PillModifier: ViewModifier {
    let background: Color
    let foreground: Color

    func body(content: Content) -> some View {
        content
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(background)
            .foregroundStyle(foreground)
            .clipShape(Capsule())
    }
}

struct PrimaryActionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity)
            .background(configuration.isPressed ? AppTheme.accent.opacity(0.85) : AppTheme.accent)
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .shadow(color: AppTheme.accent.opacity(0.18), radius: 12, y: 6)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

struct SecondaryActionButtonStyle: ButtonStyle {
    let tint: Color

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity)
            .background(tint.opacity(configuration.isPressed ? 0.18 : 0.1))
            .foregroundStyle(tint)
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(tint.opacity(0.25), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

extension View {
    func themeCard() -> some View {
        modifier(ThemeCardModifier())
    }

    func pill(background: Color, foreground: Color) -> some View {
        modifier(PillModifier(background: background, foreground: foreground))
    }
}

struct ThemeIconBadge: View {
    let systemName: String
    let tint: Color

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(tint.opacity(0.14))
                .frame(width: 58, height: 58)
            Image(systemName: systemName)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(tint)
        }
    }
}
