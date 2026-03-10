import type { JournalEntry } from "@/types/journal";
import type { CalendarExportRecord } from "@/types/calendar";
import type { PlannedTask } from "@/types/task";
import type { TranscriptSegment, VoiceSession } from "@/types/session";
import { getMockJournalEntry, getMockTasksForSession, mockSessions } from "@/lib/mock-data";

interface DemoStore {
  sessions: Map<string, VoiceSession>;
  journals: Map<string, JournalEntry>;
  tasks: Map<string, PlannedTask[]>;
  transcripts: Map<string, TranscriptSegment[]>;
  calendarExports: Map<string, CalendarExportRecord>;
}

declare global {
  var __aiVoiceJournalDemoStore__: DemoStore | undefined;
}

function getStore(): DemoStore {
  if (!globalThis.__aiVoiceJournalDemoStore__) {
    const sessions = new Map<string, VoiceSession>();
    const journals = new Map<string, JournalEntry>();
    const tasks = new Map<string, PlannedTask[]>();
    const transcripts = new Map<string, TranscriptSegment[]>();
    const calendarExports = new Map<string, CalendarExportRecord>();

    sessions.set("demo-session", {
      id: "demo-session",
      userId: "demo-user",
      provider: "doubao",
      startedAt: "2026-03-09T08:00:00+08:00",
      endedAt: "2026-03-09T08:18:00+08:00",
      status: "finalized",
      rawSummary: "项目推进与明日安排"
    });

    const journal = getMockJournalEntry("demo-session");
    if (journal) {
      journals.set("demo-session", journal);
    }

    tasks.set("demo-session", getMockTasksForSession("demo-session"));
    transcripts.set("demo-session", [
      {
        id: "demo-seg-1",
        sessionId: "demo-session",
        role: "user",
        content: "今天我主要整理了语音日记 MVP 的需求，明天要先跟进预算。",
        seq: 1
      },
      {
        id: "demo-seg-2",
        sessionId: "demo-session",
        role: "assistant",
        content: "我记下了，预算跟进是明天优先事项。",
        seq: 2
      }
    ]);

    globalThis.__aiVoiceJournalDemoStore__ = {
      sessions,
      journals,
      tasks,
      transcripts,
      calendarExports
    };
  }

  if (!globalThis.__aiVoiceJournalDemoStore__.calendarExports) {
    globalThis.__aiVoiceJournalDemoStore__.calendarExports = new Map<string, CalendarExportRecord>();
  }

  return globalThis.__aiVoiceJournalDemoStore__;
}

export function saveDemoSession(session: VoiceSession) {
  getStore().sessions.set(session.id, session);
}

export function saveDemoFinalize(payload: {
  session: VoiceSession;
  journal: JournalEntry;
  tasks: PlannedTask[];
  transcriptSegments: TranscriptSegment[];
}) {
  const store = getStore();
  store.sessions.set(payload.session.id, payload.session);
  store.journals.set(payload.session.id, payload.journal);
  store.tasks.set(payload.session.id, payload.tasks);
  store.transcripts.set(payload.session.id, payload.transcriptSegments);
}

export function getDemoJournal(sessionId: string) {
  return getStore().journals.get(sessionId) ?? null;
}

export function getDemoTasks(sessionId: string) {
  return getStore().tasks.get(sessionId) ?? [];
}

export function getDemoTranscript(sessionId: string) {
  return getStore().transcripts.get(sessionId) ?? [];
}

export function deleteDemoSession(sessionId: string) {
  const store = getStore();
  store.sessions.delete(sessionId);
  store.journals.delete(sessionId);
  store.tasks.delete(sessionId);
  store.transcripts.delete(sessionId);
  for (const [id, record] of store.calendarExports.entries()) {
    if (record.sessionId === sessionId) {
      store.calendarExports.delete(id);
    }
  }
}

export function listDemoSessions() {
  const store = getStore();
  const dynamicSessions = Array.from(store.sessions.values()).map((session) => ({
    id: session.id,
    title: session.rawSummary || "语音会话",
    date: session.startedAt.slice(0, 10),
    provider: session.provider,
    status: session.status
  }));

  const seen = new Set(dynamicSessions.map((session) => session.id));
  const seeded = mockSessions.filter((session) => !seen.has(session.id));

  return [...dynamicSessions, ...seeded].sort((left, right) => right.date.localeCompare(left.date));
}

export function saveDemoCalendarExport(record: CalendarExportRecord) {
  getStore().calendarExports.set(record.id, record);
}

export function findDemoCalendarExportByExternalRef(externalRef: string) {
  for (const record of getStore().calendarExports.values()) {
    if (record.externalRef === externalRef) {
      return record;
    }
  }

  return null;
}

export function findDemoCalendarExportBySessionId(sessionId: string, exportType: CalendarExportRecord["exportType"]) {
  for (const record of getStore().calendarExports.values()) {
    if (record.sessionId === sessionId && record.exportType === exportType) {
      return record;
    }
  }

  return null;
}

export function updateDemoTaskCalendarLink(input: {
  taskId: string;
  calendarEventId?: string;
  calendarSource?: "ios_eventkit" | "ics_single" | "ics_feed";
  status?: PlannedTask["status"];
}) {
  const store = getStore();
  let updatedTask: PlannedTask | null = null;

  for (const [sessionId, tasks] of store.tasks.entries()) {
    const nextTasks = tasks.map((task) =>
      task.id === input.taskId
        ? ((updatedTask = {
            ...task,
            calendarEventId: input.calendarEventId,
            calendarSource: input.calendarSource,
            status: input.status ?? task.status
          }),
          updatedTask)
        : task
    );

    store.tasks.set(sessionId, nextTasks);
  }

  return updatedTask;
}

export function updateDemoTask(input: {
  taskId: string;
  title?: string;
  notes?: string;
  startTime?: string;
  endTime?: string;
}) {
  const store = getStore();
  let updatedTask: PlannedTask | null = null;

  for (const [sessionId, tasks] of store.tasks.entries()) {
    const nextTasks = tasks.map((task) =>
      task.id === input.taskId
        ? ((updatedTask = {
            ...task,
            title: input.title ?? task.title,
            notes: input.notes,
            startTime: input.startTime,
            endTime: input.endTime
          }),
          updatedTask)
        : task
    );

    store.tasks.set(sessionId, nextTasks);
  }

  return updatedTask;
}
