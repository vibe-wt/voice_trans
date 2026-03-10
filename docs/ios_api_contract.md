# iOS API Contract

## 目的

这份文档定义 `iPhone 客户端` 与当前服务端之间的接口契约。

目标：

- 让 iOS 端不依赖 Web 页面内部逻辑
- 固定请求 / 响应结构
- 固定 realtime 事件语义
- 为后续原生语音页开发提供稳定边界

---

## 通用约定

### Base URL

开发环境示例：

```text
http://localhost:3000
```

生产环境应替换为正式域名。

### 鉴权

当前建议：

- 登录态走 Supabase Auth
- iOS 持有用户 session
- 服务端通过登录态识别用户

Demo 模式下：

- 允许使用 `demo-user`

### 响应格式

成功：

```json
{
  "ok": true,
  "data": {}
}
```

失败：

```json
{
  "ok": false,
  "error": {
    "message": "..."
  }
}
```

---

## 数据模型

### VoiceSession

```json
{
  "id": "uuid",
  "provider": "aliyun",
  "status": "active"
}
```

### TranscriptItem

```json
{
  "role": "user",
  "content": "今天我处理了预算问题"
}
```

### JournalEntry

```json
{
  "id": "journal-id",
  "sessionId": "session-id",
  "userId": "user-id",
  "entryDate": "2026-03-09",
  "title": "今天的推进整理",
  "events": ["..."],
  "thoughts": ["..."],
  "mood": "平稳",
  "wins": ["..."],
  "problems": ["..."],
  "ideas": ["..."],
  "markdown": "..."
}
```

### PlannedTask

```json
{
  "id": "task-id",
  "sessionId": "session-id",
  "userId": "user-id",
  "taskDate": "2026-03-10",
  "title": "跟进预算",
  "priority": "high",
  "confidence": "medium",
  "startTime": "2026-03-10T10:00:00+08:00",
  "endTime": "2026-03-10T11:00:00+08:00",
  "sourceType": "explicit",
  "status": "draft"
}
```

---

## REST API

## `POST /api/session/start`

### 作用

创建一次新的语音会话。

### 请求体

当前无需请求体。

### 响应

```json
{
  "ok": true,
  "data": {
    "sessionId": "uuid",
    "provider": "aliyun",
    "status": "active"
  }
}
```

### iOS 用途

- 建立会话
- 保存当前 `sessionId`

---

## `POST /api/realtime/connect`

### 作用

建立 provider 会话上下文。

### 请求体

```json
{
  "sessionId": "uuid",
  "userId": "user-id-or-demo-user",
  "provider": "aliyun",
  "voice": "Cherry"
}
```

### 响应

```json
{
  "ok": true,
  "data": {
    "sessionId": "uuid",
    "provider": "aliyun",
    "transport": "provider_websocket",
    "endpoint": "wss://..."
  }
}
```

### iOS 用途

- 初始化会话
- 告知服务端当前音色角色

---

## `POST /api/realtime/chunk`

### 作用

发送一段用户音频，或发送文本 fallback。

### 请求体：音频

```json
{
  "sessionId": "uuid",
  "userId": "user-id-or-demo-user",
  "voice": "Cherry",
  "chunkBase64": "..."
}
```

### 请求体：文本 fallback

```json
{
  "sessionId": "uuid",
  "text": "今天我推进了语音会话联调"
}
```

### 响应

```json
{
  "ok": true,
  "data": {
    "sessionId": "uuid",
    "transport": "provider_websocket",
    "accepted": true,
    "events": []
  }
}
```

### iOS 用途

- 连续发送音频片段
- 从返回事件中即时更新字幕 / 播放队列

---

## `POST /api/realtime/events`

### 作用

轮询获取 provider 产生的实时事件。

### 请求体

```json
{
  "sessionId": "uuid",
  "userId": "user-id-or-demo-user",
  "voice": "Cherry"
}
```

### 响应

```json
{
  "ok": true,
  "data": {
    "sessionId": "uuid",
    "transport": "provider_websocket",
    "events": []
  }
}
```

### iOS 用途

- 轮询助手回复事件
- 拉取用户最终转写
- 拉取助手文字和音频

---

## `POST /api/session/finalize`

### 作用

结束会话并生成今日日记与明日安排。

### 请求体

```json
{
  "sessionId": "uuid",
  "transcript": [
    {
      "role": "user",
      "content": "今天我处理了预算问题"
    },
    {
      "role": "assistant",
      "content": "我记下了，预算是明日优先事项。"
    }
  ]
}
```

### 响应

```json
{
  "ok": true,
  "data": {
    "sessionId": "uuid",
    "status": "finalized",
    "journal": {},
    "candidateEvents": []
  }
}
```

### iOS 用途

- 结束当前会话
- 获取日记与候选任务

---

## `GET /api/journal/[id]`

### 作用

获取当前会话的今日日记。

### 响应

```json
{
  "ok": true,
  "data": {
    "id": "journal-id",
    "sessionId": "session-id",
    "title": "今天的推进整理"
  }
}
```

### iOS 用途

- 展示日记详情页

---

## `GET /api/tasks/[id]`

### 作用

获取当前会话的明日安排候选事项。

### 响应

```json
{
  "ok": true,
  "data": [
    {
      "id": "task-id",
      "title": "跟进预算"
    }
  ]
}
```

### iOS 用途

- 展示明日安排页
- 提供后续日历导入

---

## `POST /api/tasks/[id]/calendar-link`

### 作用

iOS 在使用 `EventKit` 成功创建或更新系统日历事件后，把本地 `eventIdentifier` 回写到服务端。

### 请求体

```json
{
  "calendarEventId": "ios-event-identifier",
  "calendarSource": "ios_eventkit",
  "status": "exported"
}
```

### 响应

```json
{
  "ok": true,
  "data": {
    "updated": true
  }
}
```

### iOS 用途

- 标记任务已进入系统日历
- 防止重复导入
- 后续支持更新映射

---

## `DELETE /api/tasks/[id]/calendar-link`

### 作用

iOS 在删除本地系统日历事件后，解除服务端任务与日历事件的绑定。

### 响应

```json
{
  "ok": true,
  "data": {
    "updated": true
  }
}
```

### iOS 用途

- 用户在 App 内删除 EventKit 事件后同步服务端状态
- Web 侧取消“已绑定日历”标记

---

## `GET /api/session/[id]`

### 作用

获取 transcript。

### iOS 用途

- 历史详情页
- 重放会话记录

---

## Realtime 事件协议

当前 iOS 最重要的是稳定消费以下事件：

### `partial_transcript`

```json
{
  "type": "partial_transcript",
  "role": "user",
  "text": "今天我..."
}
```

语义：

- 用户临时字幕
- 不一定落库

### `final_transcript`

```json
{
  "type": "final_transcript",
  "role": "user",
  "text": "今天我处理了预算问题"
}
```

或：

```json
{
  "type": "final_transcript",
  "role": "assistant",
  "text": "我记下了，预算是明日优先事项。"
}
```

语义：

- 一条稳定字幕
- 应进入最终 transcript

### `assistant_text_delta`

```json
{
  "type": "assistant_text_delta",
  "text": "我记下了"
}
```

语义：

- 助手文字流式增量
- 用来实时更新字幕

### `assistant_audio_chunk`

```json
{
  "type": "assistant_audio_chunk",
  "chunkBase64": "..."
}
```

语义：

- 助手音频片段
- iOS 应进入播放队列

### `provider_error`

```json
{
  "type": "provider_error",
  "message": "Aliyun realtime provider error"
}
```

语义：

- provider 层失败
- iOS 应提示并决定是否重连

### `session_end`

```json
{
  "type": "session_end"
}
```

语义：

- 当前 provider 会话结束
- iOS 应切换到等待或重建状态

---

## iOS 端建议状态机

客户端应至少维护以下状态：

- `idle`
- `connecting`
- `listening`
- `waiting_for_assistant`
- `playing_assistant`
- `finalizing`
- `error`

### 推荐状态迁移

`idle -> connecting -> listening`

用户说完后：

`listening -> waiting_for_assistant -> playing_assistant -> listening`

结束时：

`listening / waiting_for_assistant / playing_assistant -> finalizing -> idle`

---

## 错误语义建议

### 可恢复错误

- 网络抖动
- provider timeout
- provider session closed

处理建议：

- 自动重建 session
- 保留 transcript
- 页面提示“已重连”

### 不可恢复错误

- 登录失效
- 权限拒绝
- provider key 配置错误

处理建议：

- 直接提示用户
- 停止当前会话

---

## 日历能力建议

iOS 客户端不应把 `.ics` 作为主路径。

推荐：

- 主路径：`EventKit`
- fallback：`.ics / webcal`

也就是：

1. 服务端返回结构化 `tasks`
2. iOS 客户端自己调用 `EventKit` 写入系统日历
3. 当权限拒绝时，再回退到 `.ics / webcal`

---

## 版本建议

### V1

- 轮询式 realtime events
- 原生录音
- 原生播放
- finalize
- journal/tasks 查看
- EventKit 写入

### V1.1

- 更稳定的断线重连
- 用户级长期 feed
- Shortcuts

### V2

- 更细粒度的双向打断
- 真正接近通话的交互体验

---

## 当前实现与契约的差距

当前仓库已经接近，但还存在这些差距：

- realtime 仍主要是轮询式，不是推送式
- provider 超时恢复仍在继续加强
- iOS 端还未开始实现
- 日历系统写入还未原生化

---

## 一句话结论

这份契约定义了：

`当前服务端如何成为 iPhone 原生客户端的后端`

后面不管是继续改 Web，还是正式开 iOS 工程，都应以这份 API 边界为准。
