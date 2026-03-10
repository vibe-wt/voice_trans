# iOS Task Breakdown

## 目标

把当前 `AI Voice Journal` 从“Web 可用”推进到“iPhone 可长期使用”。

这份文档聚焦：

- iOS 客户端要做什么
- 哪些能力必须原生化
- 如何复用当前仓库
- 任务如何按优先级拆分

---

## 总体策略

采用双层结构：

- 当前仓库继续作为：
  - 业务层
  - API 层
  - 数据层
  - 总结与日历 fallback 层

- 新增 `iOS` 客户端作为：
  - 语音交互层
  - 音频播放层
  - 日历系统集成层
  - 移动端 UI 层

---

## iOS 工程建议结构

```text
ios/
  AIJournalApp.xcodeproj
  AIJournalApp/
    App/
      AIJournalApp.swift
      AppCoordinator.swift
    Features/
      Auth/
      VoiceSession/
      TodayJournal/
      TomorrowPlan/
      History/
      Settings/
    Services/
      Audio/
      Realtime/
      API/
      Auth/
      Calendar/
      Storage/
    Models/
    Shared/
```

---

## 技术选型

推荐：

- `SwiftUI`
- `AVAudioSession`
- `AVAudioEngine`
- `URLSession`
- `EventKit`
- `Observation` 或 `ObservableObject`

不建议第一版就做：

- React Native
- Flutter
- Capacitor 纯壳

原因：

- 当前项目核心问题在实时语音与系统能力
- 这部分越接近原生越稳

---

## P0

### P0.1 建立 iOS 工程骨架

任务：

- 新建 `SwiftUI` App
- 建立 tab / navigation 结构
- 接入环境配置
- 配置 API base URL

验收：

- 工程可运行在 iPhone 真机
- 能访问当前服务端 API

### P0.2 登录态打通

任务：

- 接入 Supabase Auth 或服务端 session
- 处理登录 / 登出
- 处理 token 持久化

验收：

- iPhone 上可登录
- App 重启后可恢复登录态

### P0.3 原生语音会话页

任务：

- 设计 `listen -> wait -> speak` 状态机
- 使用 `AVAudioSession` 配置录音和播放模式
- 使用 `AVAudioEngine` 采集 PCM 音频
- 上传到现有 realtime API
- 接收实时事件
- 实时显示字幕
- 播放助手音频

验收：

- 用户可在 iPhone 上发起一轮语音对话
- 用户字幕可实时显示
- 助手字幕可实时显示
- 助手语音可正常播放

### P0.4 语音中断处理

任务：

- 处理中断
  - 来电
  - Siri
  - 耳机切换
  - 锁屏
- 音频会话恢复

验收：

- 中断后不会整段会话直接废掉
- 可以恢复或重建会话

---

## P1

### P1.1 会话结束整理

任务：

- 调用 `POST /api/session/finalize`
- 获取 journal / tasks
- 将结果在客户端落地缓存

验收：

- 一次对话后可看到今日日记和明日安排

### P1.2 今日日记页

任务：

- 展示：
  - 标题
  - 情绪
  - markdown 内容
  - 关键事件
  - 想法 / 问题 / 灵感

验收：

- 日记页在 iPhone 上可读性良好

### P1.3 明日安排页

任务：

- 展示候选任务
- 支持勾选
- 支持编辑标题 / 时间 / 优先级

验收：

- 用户可以在 iPhone 上确认明日安排

### P1.4 历史记录页

任务：

- 会话列表
- 详情页
- transcript 查看
- 删除会话

验收：

- 用户可以回看历史会话与总结

---

## P2

### P2.1 EventKit 日历写入

任务：

- 请求系统日历权限
- 将勾选任务写入 Apple Calendar
- 返回写入结果

验收：

- 用户在 App 内即可把任务写入系统日历
- 不依赖下载 `.ics`

### P2.2 日历事件映射

任务：

- 本地记录 `eventIdentifier`
- 服务端增加映射字段
- 支持更新 / 删除已导入事件

验收：

- 二次导入不会无脑重复创建

### P2.3 订阅与 fallback

任务：

- 保留 `.ics / webcal` fallback
- 在 App 内区分：
  - 本地直接写入
  - 使用订阅地址

验收：

- 非授权日历时仍有 fallback

---

## 状态机建议

语音页推荐采用以下状态：

- `idle`
- `connecting`
- `listening`
- `waiting_for_assistant`
- `playing_assistant`
- `finalizing`
- `error`

必须避免：

- UI 只有“录音中/未录音”两种状态
- 录音和播放同时无控制叠在一起

---

## iOS 客户端服务层建议

### AudioService

负责：

- 麦克风采集
- PCM 编码
- 播放队列
- 中断恢复

### RealtimeService

负责：

- `session/start`
- `realtime/connect`
- `realtime/chunk`
- `realtime/events`
- `session/finalize`

### CalendarService

负责：

- `EventKit` 权限
- 创建 / 更新 / 删除系统日历事件

### SessionStore

负责：

- 当前会话状态
- transcript
- assistant reply
- 本地草稿恢复

---

## 当前仓库需要配合的后端工作

为了更适合 iOS 客户端，当前仓库后续建议补：

### 1. 更明确的 realtime 事件协议

输出字段要稳定：

- `partial_transcript`
- `final_transcript`
- `assistant_text_delta`
- `assistant_audio_chunk`
- `provider_error`
- `session_end`

### 2. 更稳定的会话恢复能力

需要：

- provider session 重建策略
- transcript 与任务不丢失

### 3. Calendar 映射字段

建议未来给 `planned_tasks` 增加：

- `calendar_event_id`
- `calendar_source`
- `export_status`

---

## 推荐开发顺序

### 第 1 周

- iOS 工程初始化
- 登录
- API 调通

### 第 2 周

- 原生录音
- 原生播放
- 实时字幕

### 第 3 周

- finalize
- 今日日记 / 明日安排

### 第 4 周

- EventKit
- 日历写入
- 历史记录

---

## 验收标准

最低验收标准：

1. 用户可以在 iPhone 上发起一轮语音对话
2. 用户和助手的字幕都能实时显示
3. 助手语音可正常播放
4. 会话结束后可生成今日日记
5. 会话结束后可生成明日安排
6. 用户可在 App 内把安排写入 Apple Calendar

---

## 一句话结论

当前 Web 版已经能承担业务闭环，但真正适合 iPhone 的下一步，是：

`优先原生化语音会话页和日历写入`

也就是先把“说、听、看字幕、写日历”做成原生体验，再逐步把历史与设置迁移到 iOS。
