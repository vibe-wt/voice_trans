import Foundation

struct VoicePersona: Identifiable, Hashable {
    let id: String
    let name: String
    let styleLine: String
    let personality: String
    let backendVoice: String
}

enum VoicePersonaCatalog {
    static let all: [VoicePersona] = [
        VoicePersona(
            id: "sweet_girl",
            name: "甜妹风",
            styleLine: "活泼黏人、情绪价值高",
            personality: "说话轻快，爱先接住你的情绪，再用亲近自然的方式回应，适合轻松陪聊和日常碎碎念。",
            backendVoice: "Cherry"
        ),
        VoicePersona(
            id: "sunny_girl",
            name: "元气少女",
            styleLine: "明亮外放、反应很快",
            personality: "节奏更轻盈，语气元气、积极，会把你的计划说得更有行动感，适合打气和推进节奏。",
            backendVoice: "Momo"
        ),
        VoicePersona(
            id: "gentle_sister",
            name: "温柔姐姐",
            styleLine: "安抚感强、耐心细腻",
            personality: "语气柔和，不催不赶，擅长在你压力大或状态低的时候给出稳定、舒服的回应。",
            backendVoice: "Serena"
        ),
        VoicePersona(
            id: "queen_sister",
            name: "御姐风",
            styleLine: "干练直接、边界清楚",
            personality: "表达利落，不绕弯子，擅长帮你抓重点、下判断，适合推进决策和梳理优先级。",
            backendVoice: "Chelsie"
        ),
        VoicePersona(
            id: "mature_lady",
            name: "熟女风",
            styleLine: "沉稳温厚、很会共情",
            personality: "声音更成熟，回应里会带一点阅历感，适合聊情绪、关系和复杂生活压力。",
            backendVoice: "Jennifer"
        ),
        VoicePersona(
            id: "cool_director",
            name: "冷感总监",
            styleLine: "克制理性、执行导向",
            personality: "语气冷静专业，强调结构和结论，适合把散乱想法快速收束成可执行安排。",
            backendVoice: "Chelsie"
        ),
        VoicePersona(
            id: "warm_boyfriend",
            name: "温柔男友",
            styleLine: "松弛体贴、稳定陪伴",
            personality: "回应自然温和，不压迫，会给你一种被耐心听完的感觉，适合长时间陪聊。",
            backendVoice: "Ethan"
        ),
        VoicePersona(
            id: "gentle_senior",
            name: "温柔学长",
            styleLine: "清爽克制、带一点鼓励",
            personality: "语气比男友感更清爽，会给你适度鼓励和建议，适合聊学习、工作推进和日常计划。",
            backendVoice: "Ethan"
        ),
        VoicePersona(
            id: "steady_uncle",
            name: "沉稳大叔",
            styleLine: "低沉可靠、压得住场",
            personality: "说话更稳、更有分量，擅长帮你把混乱情绪压下来，适合需要安全感和清晰判断的时候。",
            backendVoice: "Ryan"
        ),
        VoicePersona(
            id: "rational_coach",
            name: "理性教练",
            styleLine: "目标导向、反馈清晰",
            personality: "更像陪跑型教练，会提醒你下一步怎么做，适合任务拆解、复盘和节奏管理。",
            backendVoice: "Nofish"
        )
    ]

    private static let legacyAliases: [String: String] = [
        "Cherry": "sweet_girl",
        "Momo": "sunny_girl",
        "Serena": "gentle_sister",
        "Chelsie": "queen_sister",
        "Jennifer": "mature_lady",
        "Ethan": "warm_boyfriend",
        "Ryan": "steady_uncle",
        "Nofish": "rational_coach"
    ]

    static let defaultID = "sweet_girl"

    static func resolve(id: String?) -> VoicePersona {
        if let id, let persona = all.first(where: { $0.id == id }) {
            return persona
        }

        if let id, let alias = legacyAliases[id], let persona = all.first(where: { $0.id == alias }) {
            return persona
        }

        return all.first(where: { $0.id == defaultID }) ?? all[0]
    }
}
