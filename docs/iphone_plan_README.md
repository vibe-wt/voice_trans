# iPhone 方案 README

## 目标

当前仓库已经具备：

- `Next.js` Web 端语音会话
- 实时字幕与语音回复基础链路
- 今日日记 / 明日安排生成
- `.ics` 导出与 `webcal` 订阅

但如果产品的核心使用场景是 `iPhone`，那么现阶段的网页实现只能算过渡方案，不能视为最终交付形态。

这份文档说明：

1. 为什么纯网页版不够
2. iPhone 端推荐架构
3. PWA 和原生壳的取舍
4. 推荐的实施顺序
5. 下一阶段开发清单

---

## 当前 Web 版的边界

现有实现适合：

- 快速验证产品闭环
- 跑通 `语音 -> 总结 -> 明日日程 -> iOS 日历`
- 低成本迭代提示词、总结逻辑、任务提取逻辑

但在 `iPhone Safari / PWA` 场景下，会长期遇到这些限制：

- 麦克风、扬声器、耳机切换受浏览器限制
- 后台保活能力弱
- 实时语音 WebSocket 稳定性不如原生
- 音频会话中断恢复能力弱
- 无法直接使用 `EventKit` 写入 iOS 系统日历
- 无法很好处理来电、锁屏、中断、听筒/扬声器路由等 iOS 原生音频问题

结论：

`Web` 可以继续作为业务层和管理层，但核心语音交互不应长期停留在纯网页实现。

---

## 推荐方向

推荐采用：

`Next.js + Supabase + Provider Adapter` 继续保留  
`iPhone 端增加原生壳 / 原生语音页`

推荐优先级：

1. 保留当前 `Next.js` 作为业务服务层
2. 新建 `iOS` 客户端
3. 先原生化语音会话页
4. 日记、明日安排、历史页可以分阶段复用 Web 或逐步原生化

---

## 两条路线对比

### 路线 A: 继续做 PWA

优点：

- 复用现有代码最多
- 上线快
- 成本最低

缺点：

- 实时语音体验上限低
- Safari 限制多
- 日历桥接只能主要依赖 `.ics / webcal`
- 很难做成长期高频使用的主产品

适合：

- 继续验证需求
- 做 MVP 演示
- 短期内先交付可用版本

### 路线 B: 做 iOS 原生壳

优点：

- 语音采集和播放更稳
- 可以直接使用 `AVAudioSession`
- 可以接 `EventKit`
- 可处理中断、后台、耳机、锁屏等真实移动场景
- 更接近最终产品形态

缺点：

- 开发成本更高
- 需要增加 iOS 工程

适合：

- 产品已明确主要运行在 iPhone
- 用户会高频使用语音交互
- 需要更接近系统级体验

结论：

如果这个产品是给你自己或真实用户长期在 iPhone 上使用，推荐走 `路线 B`。

---

## 推荐落地架构

### 保留的部分

继续保留当前仓库中的：

- `Next.js App Router`
- `Supabase Auth / DB`
- `voice_sessions / transcript_segments / journal_entries / planned_tasks / calendar_exports`
- `provider adapter`
- `summarize / event-extract / ics`

这些部分仍然适合作为后端与业务层。

### 新增的 iOS 客户端

建议新增一个独立目录，例如：

```text
ios/
  AIJournalApp.xcodeproj
  AIJournalApp/
    App/
    Features/
      VoiceSession/
      TodayJournal/
      TomorrowPlan/
      History/
      Settings/
    Services/
      Audio/
      Realtime/
      Calendar/
      Auth/
    Models/
```

推荐技术：

- `SwiftUI`
- `AVAudioSession`
- `AVAudioEngine`
- `URLSessionWebSocketTask` 或 HTTPS chunk 上传
- `EventKit`

---

## iPhone 端功能分层建议

### P0: 原生语音会话页

必须原生化：

- 麦克风采集
- 助手语音播放
- 实时字幕
- 回合状态机
- 音频中断恢复

这是整个产品体验的核心。

### P1: 原生日历写入

必须原生化：

- 请求日历权限
- 将候选事项写入 Apple Calendar
- 更新或删除已导入事件

这一步完成后，可以明显减少 `.ics` 手动导入的摩擦。

### P2: 日记 / 明日安排 / 历史

这部分可以两种做法：

- 短期先复用 Web 页面
- 中期逐步改成 `SwiftUI`

建议优先原生化：

- 明日安排确认页
- 历史会话列表

---

## 推荐 API 边界

iPhone 客户端与当前服务端之间建议保留这些接口边界：

- `POST /api/session/start`
- `POST /api/realtime/connect`
- `POST /api/realtime/chunk`
- `POST /api/realtime/events`
- `POST /api/session/finalize`
- `GET /api/journal/[id]`
- `GET /api/tasks/[id]`

对 iOS 来说，日历能力建议不要再依赖：

- `GET /api/calendar/ics`

而是改成：

- 服务端只返回结构化 `planned_tasks`
- iOS 本地使用 `EventKit` 直接写入系统日历

`.ics / webcal` 应继续保留，作为 Web 和跨设备 fallback。

---

## 推荐开发顺序

### Phase 1

建立 iOS 工程，打通：

- 登录态
- 会话创建
- 原生录音
- 音频上传
- 实时字幕显示
- 助手语音播放

### Phase 2

打通：

- 会话结束整理
- 今日日记查看
- 明日安排查看

### Phase 3

接入：

- `EventKit`
- 将候选事项写入系统日历
- 从 iOS 内完成“确认导入”

### Phase 4

增强：

- 后台恢复
- 音频中断恢复
- AirPods / 听筒 / 扬声器路由
- 更稳定的重连

---

## 当前仓库建议改造点

为了配合 iPhone 客户端，当前仓库建议逐步加这些能力：

### 1. 明确 API 与 UI 解耦

把现在部分页面逻辑中的 demo 文案和前端状态判断继续下沉，确保：

- API 返回稳定结构
- iOS 客户端可以不依赖网页页面逻辑

### 2. 保持结构化输出优先

继续坚持：

- transcript 原始落库
- summarize 输出严格 JSON
- tasks 与 journal 单独存储

这会让 iOS 客户端更容易消费。

### 3. 为 EventKit 准备字段

建议后续给 `planned_tasks` 增加：

- `notes`
- `location`
- `calendar_event_id`
- `calendar_source`

这样后续原生日历写入后，服务端也能追踪映射关系。

---

## 近期最合理的执行方案

如果从“产品推进效率”出发，建议：

1. 当前仓库继续完善 Web 闭环
2. 不再在 Web 上过度追求原生级语音体验
3. 立即开始 iOS 原生语音页开发

具体来说：

- Web 端继续负责：
  - 业务逻辑
  - 数据结构
  - 历史记录
  - 总结生成
  - 日历 fallback

- iPhone 原生端负责：
  - 语音采集
  - 实时播放
  - 字幕呈现
  - 日历写入
  - 移动端交互体验

---

## 一句话结论

这个项目如果要真正服务 `iPhone` 使用场景，正确方向不是把网页继续硬拗成原生，而是：

`保留当前 Next.js 业务层 + 新增 iOS 原生语音客户端`

网页继续承担“管理与业务闭环”，  
iPhone 原生端承担“语音交互与系统能力”。
