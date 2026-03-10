# AI Voice Journal

面向 `iPhone / AirPods / Apple Calendar` 场景的 AI 语音日记与明日安排助手。

用户在开车、散步、跑步、通勤等不方便打字的场景中，与 AI 进行连续语音聊天；会话结束后，系统自动沉淀为：
- 今日日记
- 明日安排
- 候选日历事件

再通过 Apple Calendar Bridge 完成闭环：

`实时语音聊天 -> transcript 落库 -> 结构化总结 -> 候选事件确认 -> ICS 导出`

## 当前仓库状态

当前仓库已完成的是 `MVP 骨架`，不是完整可交付版本。

已具备：
- Next.js App Router + TypeScript + Tailwind 工程结构
- `/voice`、`/today/[id]`、`/tomorrow/[id]`、`/history`、`/settings` 页面骨架
- Realtime provider adapter 抽象
- session / realtime / finalize / calendar API 路由骨架
- 浏览器侧 voice session client，可从 `/voice` 跑通开始会话、发送模拟口述、finalize
- 浏览器麦克风采集与音频 chunk 上传
- transcript 查询与单次会话删除 API
- `/voice` 本地草稿恢复与 finalize 重试
- 阿里云 realtime adapter 服务端连接池与事件归一化
- Supabase schema
- ICS 单次导出基础实现
- 需求拆解文档

尚未完成：
- 真实 Supabase Auth 登录态
- 真实 transcript 落库
- 真实 provider 联调
- finalize 落库与重试
- 历史数据真实查询
- ICS feed / Shortcuts

## Product Vision

这个产品不是普通聊天机器人，也不是纯录音转写工具，而是一个面向移动场景的语音闭环工具：

- 用户自然表达，不需要频繁点击
- AI 在实时阶段只做短陪聊和重点确认
- 会话结束后再输出正式长文本
- 输出必须可回顾、可执行、可加入苹果日历

核心体验是：

**实时语音陪聊 + 自动整理 + Apple Calendar 桥接**

## MVP Scope

### In Scope

MVP 目标包含：
- 实时语音对话
- 实时字幕展示
- 会话结束后生成今日日记
- 会话结束后生成明日安排
- 候选日历事件提取
- 单次 `.ics` 导出
- 历史会话查看
- Supabase 持久化
- 支持通过配置切换 Realtime Provider

### Out of Scope

以下能力不进入第一版：
- 原生 iOS App
- EventKit 直写苹果日历
- 多人协作
- 团队知识库
- 复杂长期记忆/RAG
- iCloud 账户级双向同步
- 周报/月报自动生成

## Target Users

主要面向：
- 高压工作者
- 习惯运动时复盘的人
- 高频思考型个人用户
- 使用 iPhone / AirPods / Mac 的苹果生态用户

典型场景：
- 开车通勤复盘
- 跑步/散步时整理工作想法
- 睡前快速口述今天总结与明日重点

## Tech Stack

### Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui 风格组件抽象

### Backend

- Next.js Route Handlers
- Node.js runtime
- Zod 校验

### AI / Realtime

- 阿里云百炼 Qwen-Omni-Realtime
- 或 火山引擎豆包 Realtime API
- 通过服务端 Realtime Adapter 解耦供应商协议

### Data Layer

- Supabase Auth
- Supabase Postgres
- Supabase Storage

### Apple Calendar Bridge

- Phase 1: 单次 `.ics` 导出
- Phase 2: ICS Feed
- Phase 3: Apple Shortcuts
- 后续原生壳再考虑 EventKit

## High-Level Architecture

```text
User (iPhone / AirPods)
  -> Next.js Web App / PWA
    -> /api/session/start
    -> /api/realtime/*
      -> Provider Adapter
        -> Aliyun / Doubao Realtime API
    -> /api/session/finalize
      -> Summary Engine
      -> Candidate Event Extractor
      -> Supabase
    -> /api/calendar/ics
      -> Apple Calendar Import
```

### Architecture Principles

必须遵守：
- Realtime 层与总结层分离
- 前端不直接依赖供应商原始协议
- Provider 密钥只允许服务端使用
- 原始 transcript 必须保留，支持重总结
- Apple Calendar 先走 ICS / Shortcuts，不追求 Web 端复杂双向同步

## Core User Flow

### Flow A: Voice Session

1. 用户打开 `/voice`
2. 请求麦克风权限
3. 创建 session：`POST /api/session/start`
4. 建立 realtime 连接：`POST /api/realtime/connect`
5. 用户和 AI 连续语音聊天
6. 页面展示实时字幕和状态
7. 用户点击结束
8. 调用 `POST /api/session/finalize`
9. 生成今日日记、明日安排、候选日历事件
10. 跳转到结果页

### Flow B: Add to Apple Calendar

1. 用户在 `/tomorrow/[id]` 查看候选事件
2. 勾选准备导出的事件
3. 点击导出
4. 调用 `GET /api/calendar/ics`
5. 返回 `.ics` 文件供系统导入

## Pages

### `/voice`

包含：
- 开始、暂停、结束
- 连接状态
- 录音状态
- AI 状态
- 实时字幕
- 异常提示

### `/today/[id]`

包含：
- 日记标题
- 今日事件
- 想法/感受
- 情绪
- 收获
- 问题
- 灵感

### `/tomorrow/[id]`

包含：
- 明日重点事项
- 时间块建议
- 候选日历事件
- 勾选确认
- 导出 ICS

### `/history`

包含：
- 历史会话列表
- 日期维度查看
- 详情入口
- transcript 查看
- 删除单次会话

### `/settings`

包含：
- Provider 选择
- 日历桥接偏好
- 隐私说明
- 账户相关设置

## Directory Structure

```text
app/
  voice/page.tsx
  today/[id]/page.tsx
  tomorrow/[id]/page.tsx
  history/page.tsx
  settings/page.tsx
  api/
    session/start/route.ts
    session/finalize/route.ts
    realtime/connect/route.ts
    realtime/chunk/route.ts
    journal/[id]/route.ts
    tasks/[id]/route.ts
    calendar/ics/route.ts
    calendar/feed/route.ts
    shortcuts/payload/route.ts

components/
  layout/
  ui/
  voice/

lib/
  realtime/
    adapters/
      aliyun.ts
      doubao.ts
    index.ts
    types.ts
  ai/
    summarize.ts
    event-extract.ts
  calendar/
    ics.ts
  db/
    supabase.ts

types/
  provider.ts
  session.ts
  journal.ts
  task.ts
  calendar.ts

supabase/
  schema.sql

docs/
  ai_voice_journal_task_breakdown.md
```

## Database Schema

数据库 schema 在 [schema.sql](/Users/wutong/Desktop/My_Project/voice_trans/supabase/schema.sql)。

核心表：
- `voice_sessions`
- `transcript_segments`
- `journal_entries`
- `planned_tasks`
- `calendar_exports`

设计原则：
- 会话层、转写层、沉淀层、导出层分离
- transcript 保留原始分段
- 支持后续重总结与新增导出方式
- 配置 Supabase RLS，确保用户只能访问自己的数据

## API Design

### `POST /api/session/start`

创建语音会话。

示例响应：

```json
{
  "ok": true,
  "data": {
    "sessionId": "uuid",
    "provider": "doubao",
    "status": "active"
  }
}
```

### `POST /api/realtime/connect`

由服务端返回统一网关信息。

当前实现：
- 如果 provider URL 和 API Key 已配置，返回 `provider_websocket`
- 如果未配置，返回 `mock`

### `POST /api/realtime/chunk`

发送音频 chunk 或文本事件。

当前为了保证闭环可演示，`/voice` 默认通过文本模拟口述内容，`/api/realtime/chunk` 会返回统一事件格式的 demo 响应。

同时，浏览器侧已经支持 `MediaRecorder` 录音和分段上传。当前在 mock 模式下，这条链路只验证音频上传，不会自动生成真实 transcript。

为降低中断损失，`/voice` 现在会把当前 session、transcript、文本草稿和音频上传计数保存在本地；刷新页面后可恢复草稿，finalize 失败时可直接重试。

仓库中已经加入阿里云 realtime adapter 的服务端连接管理与官方事件归一化：
- `conversation.item.input_audio_transcription.completed`
- `response.audio_transcript.delta`
- `response.audio_transcript.done`
- `response.audio.delta`

浏览器侧现在会优先使用 `AudioContext + ScriptProcessor` 产出 `pcm16` 分片，以适配阿里云 realtime 输入格式；若浏览器不支持该链路，则回退到 `MediaRecorder`。

在阿里云模式下，停止录音或执行 finalize 前，前端会显式调用 `input_audio_buffer.commit + response.create`，避免只有音频 append 而没有触发正式转写。

当前仍有一个明确风险：这套 Aliyun 实时链路还没有经过本地真实联调验证，因此服务端事件映射和浏览器 PCM 编码虽然已经接入，但仍需要一次带真实密钥和真实音频的端到端验证。

### `POST /api/session/finalize`

结束会话，生成总结结果并提取候选事件。

当前仓库返回的是结构化 summary 占位数据和候选事件 mock。

### `GET /api/journal/[id]`

读取单次日记详情。

### `GET /api/tasks/[id]`

读取单次明日安排。

### `GET /api/calendar/ics`

生成单次 `.ics` 文件。

### `GET /api/calendar/feed`

预留用户级订阅式 ICS Feed。

### `POST /api/shortcuts/payload`

预留 Apple Shortcuts 结构化 payload。

## Realtime Adapter Requirements

必须通过统一 Adapter 层屏蔽供应商协议差异。

当前代码里的内部事件命名采用 spec 版本：
- `partial_transcript`
- `final_transcript`
- `assistant_audio_chunk`
- `session_end`
- `provider_error`

如果后续要兼容另一套事件名，例如：
- `session.started`
- `session.ended`
- `transcript.partial`
- `transcript.final`
- `assistant.audio.chunk`
- `assistant.text.delta`
- `error`

建议只作为 adapter 内部映射层处理，不要把多套事件协议泄漏给 UI。

Adapter 规则：
- 所有 Provider 都映射到统一内部事件
- Provider 密钥只允许服务端使用
- Provider 连接异常必须可观测
- Provider 应可通过配置切换
- 音频编码细节不应泄漏到 UI 层

## AI Output Requirements

总结引擎必须输出结构化 JSON。

### Journal Output

至少包含：
- 标题
- 今日主要事件
- 今日想法/感受
- 今日收获
- 今日问题
- 今日灵感
- Markdown 正文

### Tomorrow Plan Output

至少包含：
- 明日最重要事项
- 可选时间块建议
- 待跟进事项
- 候选日历事件
- 每个事件的 `confidence`

### Constraints

- 不得伪造明确时间
- 推断型事项必须标记 `source_type = inferred`
- 事项描述尽量短句化、可执行化
- 原始 transcript 必须保留，用于重新生成结果

## Non-Functional Requirements

### Performance

- 页面首次加载尽量轻量
- 实时字幕更新应流畅
- 会话结束后总结时间目标小于 15 秒

### Reliability

- Realtime 断连要有重试或错误提示
- finalize 失败不能导致 transcript 丢失
- `.ics` 导出失败应可追踪

### Security

- Provider API Key 只保留在服务端
- Supabase RLS 必须配置
- 用户只能访问自己的 sessions / journals / plans

### Privacy

- 明确提示用户数据会发送到 AI 服务处理
- 提供删除历史会话能力
- 默认不对外共享用户数据

## Success Metrics

产品指标：
- 会话完成率
- 会话后查看总结率
- 候选日历事件导出率
- 次日任务确认率
- 7 日留存

质量指标：
- 明日安排可执行率
- 用户对总结准确性的主观评分
- 用户对时间建议合理性的主观评分

## Local Development

1. 安装依赖

```bash
npm install
```

2. 配置环境变量

```bash
cp .env.example .env.local
```

至少需要配置：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `REALTIME_PROVIDER`
- 对应 provider 的 API Key 和 URL

3. 启动开发环境

```bash
npm run dev
```

4. 访问页面

- [http://localhost:3000](http://localhost:3000)
- [http://localhost:3000/voice](http://localhost:3000/voice)
- [http://localhost:3000/today/demo-session](http://localhost:3000/today/demo-session)
- [http://localhost:3000/tomorrow/demo-session](http://localhost:3000/tomorrow/demo-session)

## Recommended Build Order

建议按下面顺序继续开发：

1. 接入 Supabase Auth
2. 完成一个真实 Provider 的 Realtime Adapter
3. 完成一个真实 provider 的音频转写与 assistant 回复
4. 跑通 transcript 持久化
5. 完成 finalize 真正落库
6. 替换 mock 数据为真实查询
7. 完成删除单次会话
8. 再扩展 ICS Feed / Shortcuts

## Auth Behavior

- 已配置 Supabase 时：`/login` 使用邮箱魔法链接登录，页面与 API 读取真实用户上下文
- 未配置 Supabase 时：应用自动退回 demo 模式，继续使用 mock 数据跑通页面和接口骨架

## Acceptance Criteria

满足以下条件时，可视为 MVP 完成：

1. 用户可以在网页中发起一段实时语音会话
2. 页面能显示实时字幕
3. 用户结束后，系统能生成今日日记
4. 系统能生成明日安排
5. 能提取候选日历事件
6. 用户可以导出 `.ics`
7. 用户可以查看历史记录
8. Supabase 中可以查询完整会话数据
9. Provider 可以通过配置切换

## Notes About Differences

当前我对原始 `README` 的思路只做了两点调整：
- `ICS Feed` 不放在 MVP 必做，而是放到下一阶段。原因是 PRD 和 spec 都把单次 `.ics` 作为 MVP 必须项，Feed 更适合作为 V1.1。
- 内部事件协议优先沿用 spec 中已经更明确的命名。原因是当前代码与说明书已经围绕这一组事件展开，实现成本更低。

除此之外，整体思路没有本质变化：仍然是先打通 `voice -> finalize -> today/tomorrow -> ics` 最小闭环，再补历史、设置、删除能力和桥接扩展。
