import type { JournalEntry } from "@/types/journal";
import type { PlannedTask } from "@/types/task";

export const mockSessions = [
  {
    id: "demo-session",
    title: "项目推进与明日安排",
    date: "2026-03-09",
    provider: "doubao",
    status: "finalized"
  }
];

const journalEntry: JournalEntry = {
  id: "journal-demo",
  sessionId: "demo-session",
  userId: "demo-user",
  entryDate: "2026-03-09",
  title: "今天的项目推进与思路整理",
  events: ["梳理了 AI 语音日记 MVP 要求", "确认了数据模型和 API 路线"],
  thoughts: ["先打通闭环，再补体验优化"],
  mood: "专注且略有压力",
  wins: ["开发顺序清晰了", "需求边界收敛了"],
  problems: ["provider 联调还没开始"],
  ideas: ["让 tomorrow 页支持编辑后再导出"],
  markdown:
    "### 今日事件\n- 梳理了语音日记 MVP 范围。\n- 确认了 Next.js、Supabase、provider adapter 三条主线。\n\n### 感受\n- 整体方向已经稳定，接下来重点是打通语音到总结的最小闭环。"
};

const plannedTasks: PlannedTask[] = [
  {
    id: "task-1",
    sessionId: "demo-session",
    userId: "demo-user",
    taskDate: "2026-03-10",
    title: "跟进预算沟通",
    notes: "和预算相关同事确认本周预算口径，并同步下一步处理方式。",
    priority: "high",
    confidence: "high",
    startTime: "2026-03-10T09:00:00+08:00",
    endTime: "2026-03-10T09:30:00+08:00",
    sourceType: "explicit",
    status: "draft"
  },
  {
    id: "task-2",
    sessionId: "demo-session",
    userId: "demo-user",
    taskDate: "2026-03-10",
    title: "完成 finalize 接口",
    location: "Home Office",
    priority: "high",
    confidence: "medium",
    startTime: "2026-03-10T10:00:00+08:00",
    endTime: "2026-03-10T12:00:00+08:00",
    sourceType: "inferred",
    status: "draft"
  }
];

export function getMockJournalEntry(sessionId: string) {
  return sessionId === journalEntry.sessionId ? journalEntry : null;
}

export function getMockTasksForSession(sessionId: string) {
  return plannedTasks.filter((task) => task.sessionId === sessionId);
}
