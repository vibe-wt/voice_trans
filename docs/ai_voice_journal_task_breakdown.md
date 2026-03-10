# AI 语音日记与明日安排助手任务清单

基于以下文档整理：
- `/Users/wutong/Downloads/ai_voice_journal_prd.pdf`
- `/Users/wutong/Downloads/ai_voice_journal_codex_spec.pdf`

## 1. 项目一句话目标

做一个移动端优先的 Web App，支持用户在 iPhone 上进行连续语音聊天，并在结束后自动生成：
- 今日日记
- 明日安排
- 候选日历事件

最终形成闭环：

`实时语音聊天 -> transcript 落库 -> 结构化总结 -> 明日安排确认 -> Apple Calendar 导出`

## 2. 产品边界

### 2.1 MVP 必做

- 用户登录
- 新建语音会话
- 实时字幕
- AI 简短语音或文字回复
- 结束会话并触发总结
- 生成今日日记
- 生成明日安排
- 提取候选日历事件
- 导出单次 ICS 文件
- 历史记录列表与详情
- 移动端可用的 `/voice`、`/today`、`/tomorrow`、`/history`、`/settings`

### 2.2 MVP 不做

- 泛化全能助手
- 多人协作和团队空间
- 复杂长期记忆和 RAG
- Web 端深度双向同步 iCloud Calendar
- 原生 iOS App
- EventKit 直写

### 2.3 后续版本预留

- ICS Feed 私有订阅地址
- Apple Shortcuts payload
- EventKit
- Reminders 深度写入
- 周/月复盘

## 3. 成功标准

- 用户可以在 iPhone Safari 中开始并完成一次语音会话
- 用户可以看到实时字幕与明确的会话状态
- 会话结束后 5-15 秒内得到结构化总结
- 用户可以查看今日日记和明日安排
- 用户可以勾选候选事件并导出 `.ics`
- 用户可以查看最近至少 7 天历史记录
- 切换阿里云或豆包时，不需要重写前端页面逻辑

## 4. 核心用户流程

### 4.1 开始会话

1. 用户进入 `/voice`
2. 首次请求麦克风权限
3. 点击开始聊天
4. 前端调用 `POST /api/session/start`
5. 前端连接 `POST /api/realtime/connect`
6. 后端通过 provider adapter 连接实时语音服务
7. 前端持续采集音频并发送 chunk
8. 页面显示用户实时字幕、AI 状态和短回复

### 4.2 结束会话

1. 用户点击结束并整理
2. 后端关闭实时会话
3. transcript 分段落库
4. 调用总结引擎输出结构化 JSON
5. 写入 `journal_entries`、`planned_tasks`、`calendar_exports`
6. 前端跳转总结页

### 4.3 导出日历

1. 用户在 `/tomorrow/[id]` 勾选候选事件
2. 前端调用 `GET /api/calendar/ics`
3. 后端生成单次 `.ics`
4. 用户导入 Apple Calendar

## 5. 信息架构

### 5.1 页面

- `/voice`
  - 开始、暂停、结束
  - 实时字幕
  - AI 回复状态
  - 连接状态
  - 录音状态
  - 错误提示
- `/today/[id]`
  - 日记标题
  - 今日事件
  - 想法
  - 情绪
  - 收获
  - 问题
  - 灵感
- `/tomorrow/[id]`
  - 必做事项
  - 时间块
  - 候选日历事件
  - 勾选确认
  - 导出 ICS
- `/history`
  - 日期列表
  - 会话摘要
  - 详情入口
- `/settings`
  - provider 选择
  - 日历桥接偏好
  - 隐私说明
  - 账号设置

### 5.2 API

- `POST /api/session/start`
- `POST /api/session/finalize`
- `POST /api/realtime/connect`
- `POST /api/realtime/chunk`
- `GET /api/journal/[id]`
- `GET /api/tasks/[id]`
- `GET /api/calendar/ics`
- `GET /api/calendar/feed`
- `POST /api/shortcuts/payload`

## 6. 技术约束

- 技术栈固定为 `Next.js + TypeScript + Supabase + Tailwind + shadcn/ui`
- 前端不可直接接供应商协议
- 所有 provider 必须走服务端 adapter
- 实时语音链路和总结链路必须分离
- 结构化总结必须输出 JSON，再由服务端落库
- 所有核心数据必须持久化
- 密钥只能在服务端
- UI 必须移动端优先
- 风格偏效率工具，不做花哨社交风

## 7. 数据模型

### 7.1 必要实体

- `users`
- `voice_sessions`
- `transcript_segments`
- `journal_entries`
- `planned_tasks`
- `calendar_exports`

### 7.2 关键字段要求

#### voice_sessions

- `id`
- `user_id`
- `provider`
- `started_at`
- `ended_at`
- `duration_sec`
- `status`
- `raw_summary`

#### transcript_segments

- `id`
- `session_id`
- `role`
- `content`
- `seq`
- `started_at`
- `ended_at`

#### journal_entries

- `id`
- `session_id`
- `user_id`
- `entry_date`
- `title`
- `events`
- `thoughts`
- `mood`
- `wins`
- `problems`
- `ideas`
- `markdown`

#### planned_tasks

- `id`
- `session_id`
- `user_id`
- `task_date`
- `title`
- `priority`
- `confidence`
- `start_time`
- `end_time`
- `source_type`
- `status`

#### calendar_exports

- `id`
- `user_id`
- `session_id`
- `export_type`
- `external_ref`
- `created_at`

## 8. AI 能力要求

### 8.1 实时能力

- 必须支持阿里云百炼或豆包二选一接入
- 前端只能消费统一内部事件协议
- 实时阶段 AI 回复控制在 1-2 句
- 实时阶段以陪聊和确认重点为主，不输出长文本

建议统一事件：
- `partial_transcript`
- `final_transcript`
- `assistant_audio_chunk`
- `session_end`
- `provider_error`

### 8.2 总结能力

结束会话后，模型必须输出结构化 JSON，至少包含：
- `raw_summary`
- `journal`
- `tomorrow_plan`

#### journal 必含

- `title`
- `events`
- `thoughts`
- `mood`
- `wins`
- `problems`
- `ideas`
- `markdown`

#### tomorrow_plan 必含

- `must_do`
- `schedule_blocks`
- `follow_ups`
- `reminders`

每个候选事件至少要带：
- 标题
- 建议时间
- 时长
- 优先级
- 置信度
- 来源类型

## 9. 非功能需求

- 首屏可交互尽量小于 2.5 秒
- 结束后总结目标时间小于 15 秒
- 实时链路中断时尽量保留已转写内容
- 支持重试总结
- 支持权限拒绝、网络抖动、provider 超时的友好提示
- 提供隐私告知
- 提供删除单次会话能力
- 记录 provider、错误类型、失败原因

## 10. P0 / P1 / P2 任务拆解

### 10.1 P0：最小闭环

#### 基础工程

- 初始化 Next.js App Router + TypeScript 项目
- 接入 Tailwind CSS
- 接入 shadcn/ui
- 配置 ESLint、Prettier、基础别名
- 建立目录结构：`app`、`components`、`lib`、`types`
- 编写 `.env.example`
- 编写 `README`

#### Supabase

- 创建 Supabase 项目
- 接入 Auth
- 建立数据库 schema
- 添加 RLS 策略
- 配置服务端和客户端 Supabase SDK

#### 类型与领域模型

- 定义 `Provider`、`VoiceSession`、`TranscriptSegment`
- 定义 `JournalEntry`、`PlannedTask`
- 定义 API 输入输出 DTO
- 统一错误码和响应格式

#### 实时语音基础链路

- 实现 `RealtimeAdapter` 接口
- 新建阿里云或豆包 adapter
- 完成 `POST /api/session/start`
- 完成 `POST /api/realtime/connect`
- 完成 `POST /api/realtime/chunk`
- 支持会话开始、传输 chunk、结束关闭
- 把供应商原始事件映射为内部事件

#### `/voice` 页面

- 麦克风权限请求
- 开始按钮
- 暂停按钮
- 结束按钮
- 实时字幕区
- AI 状态区
- 连接状态区
- 处理中状态
- 错误提示

#### finalize 总结链路

- 完成 `POST /api/session/finalize`
- 汇总 transcript
- 调用总结模型
- 校验结构化 JSON
- 写入 `voice_sessions`
- 写入 `transcript_segments`
- 写入 `journal_entries`
- 写入 `planned_tasks`

#### 总结页面

- 完成 `/today/[id]`
- 完成 `/tomorrow/[id]`
- 渲染日记与安排
- 展示候选日历事件

#### ICS 导出

- 完成 `GET /api/calendar/ics`
- 根据勾选任务生成 `.ics`
- 文件名格式 `ai-plan-YYYY-MM-DD.ics`
- 浏览器下载链路可用

### 10.2 P1：完善可用性

#### 历史记录

- 完成 `/history`
- 按日期展示会话列表
- 支持查看单次详情
- 支持查看 transcript 片段

#### 设置页

- provider 切换
- 日历桥接说明
- 隐私说明
- 用户偏好保存

#### 健壮性

- 统一错误提示组件
- 断网重试
- finalize 重试
- provider 超时处理
- 麦克风权限拒绝引导

#### 数据治理

- 单次会话删除
- 删除关联 transcript / journal / tasks
- 审计日志或失败日志基础记录

### 10.3 P2：扩展能力

#### Apple Calendar Bridge 扩展

- `GET /api/calendar/feed`
- 私有 token 订阅地址
- `POST /api/shortcuts/payload`

#### 体验优化

- PWA 基础能力
- iPhone Safari 体验优化
- 录音状态动画
- 更好的 loading 与 skeleton

#### 总结优化

- 支持重跑总结
- 支持不同总结模板
- 支持手动编辑标题和任务

## 11. 建议目录结构

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
lib/
  realtime/
    adapters/
      aliyun.ts
      doubao.ts
    index.ts
    types.ts
  ai/
    summarize.ts
    plan.ts
    event-extract.ts
  db/
    supabase.ts
  calendar/
    ics.ts
    shortcuts.ts
components/
  voice/
  journal/
  task/
  common/
types/
  session.ts
  journal.ts
  task.ts
  provider.ts
  calendar.ts
```

## 12. 建议开发顺序

### Phase 1

- 项目初始化
- Supabase 接入
- 类型与目录结构
- 页面骨架

### Phase 2

- 实时语音 adapter
- `/voice` 页面
- 会话创建与连接链路
- 实时字幕

### Phase 3

- finalize 接口
- transcript 落库
- 结构化总结
- `/today/[id]`
- `/tomorrow/[id]`

### Phase 4

- ICS 导出
- `/history`
- 基础 `/settings`

### Phase 5

- 错误处理
- 删除能力
- PWA 和移动端体验优化

### Phase 6

- ICS Feed
- Shortcuts payload
- 总结重跑与编辑优化

## 13. 开发时必须守住的决策

- 不要让 React 组件直接解析供应商原始协议
- 不要把供应商鉴权放到前端
- 不要先做复杂 iCloud 同步
- 不要把总结内容只存 markdown，不存结构化字段
- 不要跳过 transcript 分段落库
- 不要把实时陪聊和会后总结混成同一个模型调用职责

## 14. 开工检查清单

- 是否先完成最小闭环，而不是同时铺太多高级能力
- 是否先实现统一 adapter，再接具体 provider
- 是否先保证 `/voice -> finalize -> today/tomorrow -> ics` 打通
- 是否所有核心类型已统一定义
- 是否数据库支持后续重跑总结和新增导出方式
- 是否移动端交互足够简单，适合开车/运动场景
- 是否已覆盖权限拒绝、网络异常、实时中断、总结失败

## 15. 建议下一步

按文档要求，实际开发建议从以下顺序启动：

1. 初始化 Next.js + Supabase + TypeScript 工程
2. 先选一个 provider 打通 adapter
3. 完成 `/voice` 和实时字幕
4. 完成 `finalize` 和结构化总结落库
5. 完成 `/today/[id]`、`/tomorrow/[id]`
6. 完成单次 ICS 导出
7. 再补 `/history`、`/settings`、删除能力和异常处理
