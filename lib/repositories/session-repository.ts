import { randomUUID } from "node:crypto";
import type { CalendarExportRecord } from "@/types/calendar";
import type { JournalEntry } from "@/types/journal";
import type { PlannedTask } from "@/types/task";
import type { Provider } from "@/types/provider";
import type { TranscriptSegment, VoiceSession } from "@/types/session";
import { isSupabaseConfigured } from "@/lib/db/supabase-common";
import { createAdminSupabaseClient } from "@/lib/db/supabase-server";
import {
  deleteDemoSession,
  findDemoCalendarExportByExternalRef,
  findDemoCalendarExportBySessionId,
  getDemoJournal,
  getDemoTasks,
  getDemoTranscript,
  listDemoSessions,
  saveDemoCalendarExport,
  saveDemoFinalize,
  saveDemoSession,
  updateDemoTask,
  updateDemoTaskCalendarLink
} from "@/lib/demo-store";
import { getMockJournalEntry, getMockTasksForSession } from "@/lib/mock-data";
import { extractCandidateEvents } from "@/lib/ai/event-extract";
import { summarizeTranscript } from "@/lib/ai/summarize";

export interface FinalizeInput {
  sessionId: string;
  userId: string;
  provider: Provider;
  transcript: Array<Pick<TranscriptSegment, "role" | "content">>;
}

export interface FinalizeResult {
  session: VoiceSession;
  journal: JournalEntry;
  tasks: PlannedTask[];
  transcriptSegments: TranscriptSegment[];
}

export async function startVoiceSession({
  userId,
  provider
}: {
  userId: string;
  provider: Provider;
}): Promise<VoiceSession> {
  const session: VoiceSession = {
    id: randomUUID(),
    userId,
    provider,
    startedAt: new Date().toISOString(),
    status: "active"
  };

  if (!isSupabaseConfigured()) {
    saveDemoSession(session);
    return session;
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("voice_sessions").insert({
    id: session.id,
    user_id: session.userId,
    provider: session.provider,
    started_at: session.startedAt,
    status: session.status
  });

  if (error) {
    throw error;
  }

  return session;
}

export async function finalizeVoiceSession(input: FinalizeInput): Promise<FinalizeResult> {
  const transcriptText = input.transcript.map((item) => `${item.role}: ${item.content}`).join("\n");
  const summary = await summarizeTranscript(transcriptText);
  const transcriptSegments: TranscriptSegment[] = input.transcript.map((item, index) => ({
    id: `${input.sessionId}-segment-${index + 1}`,
    sessionId: input.sessionId,
    role: item.role,
    content: item.content,
    seq: index + 1
  }));
  const tasks = extractCandidateEvents(summary, input.sessionId).map((task) => ({
    ...task,
    userId: input.userId,
    sessionId: input.sessionId
  }));

  const session: VoiceSession = {
    id: input.sessionId,
    userId: input.userId,
    provider: input.provider,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    durationSec: undefined,
    status: "finalized",
    rawSummary: summary.raw_summary
  };

  const journal: JournalEntry = {
    id: `${input.sessionId}-journal`,
    sessionId: input.sessionId,
    userId: input.userId,
    entryDate: summary.date,
    title: summary.journal.title,
    events: summary.journal.events,
    thoughts: summary.journal.thoughts,
    mood: summary.journal.mood,
    wins: summary.journal.wins,
    problems: summary.journal.problems,
    ideas: summary.journal.ideas,
    markdown: summary.journal.markdown
  };

  if (!isSupabaseConfigured()) {
    saveDemoFinalize({ session, journal, tasks, transcriptSegments });
    return { session, journal, tasks, transcriptSegments };
  }

  const supabase = createAdminSupabaseClient();
  const transcriptRows = transcriptSegments.map((item) => ({
    id: item.id,
    session_id: item.sessionId,
    role: item.role,
    content: item.content,
    seq: item.seq
  }));

  const { error: sessionError } = await supabase
    .from("voice_sessions")
    .update({
      ended_at: session.endedAt,
      status: session.status,
      raw_summary: session.rawSummary
    })
    .eq("id", input.sessionId)
    .eq("user_id", input.userId);

  if (sessionError) {
    throw sessionError;
  }

  const { error: transcriptError } = await supabase.from("transcript_segments").insert(transcriptRows);

  if (transcriptError) {
    throw transcriptError;
  }

  const { error: journalError } = await supabase.from("journal_entries").insert({
    id: journal.id,
    session_id: journal.sessionId,
    user_id: journal.userId,
    entry_date: journal.entryDate,
    title: journal.title,
    events: journal.events,
    thoughts: journal.thoughts,
    mood: journal.mood,
    wins: journal.wins,
    problems: journal.problems,
    ideas: journal.ideas,
    markdown: journal.markdown
  });

  if (journalError) {
    throw journalError;
  }

  const { error: tasksError } = await supabase.from("planned_tasks").insert(
    tasks.map((task) => ({
      id: task.id,
      session_id: task.sessionId,
      user_id: task.userId,
      task_date: task.taskDate,
      title: task.title,
      notes: task.notes ?? null,
      location: task.location ?? null,
      priority: task.priority,
      confidence: task.confidence,
      start_time: task.startTime,
      end_time: task.endTime,
      source_type: task.sourceType,
      calendar_event_id: task.calendarEventId ?? null,
      calendar_source: task.calendarSource ?? null,
      status: task.status
    }))
  );

  if (tasksError) {
    throw tasksError;
  }

  return { session, journal, tasks, transcriptSegments };
}

export async function getJournalBySessionId(sessionId: string, userId?: string) {
  if (!isSupabaseConfigured() || !userId) {
    return getDemoJournal(sessionId) ?? getMockJournalEntry(sessionId);
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    sessionId: data.session_id,
    userId: data.user_id,
    entryDate: data.entry_date,
    title: data.title,
    events: data.events ?? [],
    thoughts: data.thoughts ?? [],
    mood: data.mood ?? undefined,
    wins: data.wins ?? [],
    problems: data.problems ?? [],
    ideas: data.ideas ?? [],
    markdown: data.markdown
  } satisfies JournalEntry;
}

export async function getTasksBySessionId(sessionId: string, userId?: string) {
  if (!isSupabaseConfigured() || !userId) {
    const demoTasks = getDemoTasks(sessionId);
    return demoTasks.length ? demoTasks : getMockTasksForSession(sessionId);
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("planned_tasks")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("start_time", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (task) =>
      ({
        id: task.id,
        sessionId: task.session_id,
        userId: task.user_id,
        taskDate: task.task_date,
        title: task.title,
        notes: task.notes ?? undefined,
        location: task.location ?? undefined,
        priority: task.priority,
        confidence: task.confidence,
        startTime: task.start_time ?? undefined,
        endTime: task.end_time ?? undefined,
        sourceType: task.source_type,
        calendarEventId: task.calendar_event_id ?? undefined,
        calendarSource: task.calendar_source ?? undefined,
        status: task.status
      }) satisfies PlannedTask
  );
}

export async function getTranscriptBySessionId(sessionId: string, userId?: string) {
  if (!isSupabaseConfigured() || !userId) {
    return getDemoTranscript(sessionId);
  }

  const supabase = createAdminSupabaseClient();
  const { data: ownedSession, error: sessionError } = await supabase
    .from("voice_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionError) {
    throw sessionError;
  }

  if (!ownedSession) {
    return [];
  }

  const { data, error } = await supabase
    .from("transcript_segments")
    .select("*")
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(
    (segment) =>
      ({
        id: segment.id,
        sessionId: segment.session_id,
        role: segment.role,
        content: segment.content,
        seq: segment.seq,
        startedAt: segment.started_at ?? undefined,
        endedAt: segment.ended_at ?? undefined
      }) satisfies TranscriptSegment
  );
}

export async function listSessions(userId?: string) {
  if (!isSupabaseConfigured() || !userId) {
    return listDemoSessions();
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("voice_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(14);

  if (error) {
    throw error;
  }

  return (data ?? []).map((session) => ({
    id: session.id,
    title: session.raw_summary || "语音会话",
    date: session.started_at?.slice(0, 10) ?? "",
    provider: session.provider,
    status: session.status
  }));
}

export async function deleteSessionById(sessionId: string, userId?: string) {
  if (!isSupabaseConfigured() || !userId) {
    deleteDemoSession(sessionId);
    return { deleted: true };
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("voice_sessions").delete().eq("id", sessionId).eq("user_id", userId);

  if (error) {
    throw error;
  }

  return { deleted: true };
}

export async function createOrGetCalendarFeedExport(sessionId: string, userId?: string) {
  if (!isSupabaseConfigured() || !userId) {
    const existing = findDemoCalendarExportBySessionId(sessionId, "ics_feed");
    if (existing) {
      return existing;
    }

    const record: CalendarExportRecord = {
      id: randomUUID(),
      userId: userId ?? "demo-user",
      sessionId,
      exportType: "ics_feed",
      externalRef: randomUUID(),
      createdAt: new Date().toISOString()
    };
    saveDemoCalendarExport(record);
    return record;
  }

  const supabase = createAdminSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("calendar_exports")
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .eq("export_type", "ics_feed")
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return {
      id: existing.id,
      userId: existing.user_id,
      sessionId: existing.session_id,
      exportType: existing.export_type,
      externalRef: existing.external_ref,
      createdAt: existing.created_at
    } satisfies CalendarExportRecord;
  }

  const token = randomUUID();
  const payload = {
    id: randomUUID(),
    user_id: userId,
    session_id: sessionId,
    export_type: "ics_feed",
    external_ref: token
  };

  const { data, error } = await supabase.from("calendar_exports").insert(payload).select("*").single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    userId: data.user_id,
    sessionId: data.session_id,
    exportType: data.export_type,
    externalRef: data.external_ref,
    createdAt: data.created_at
  } satisfies CalendarExportRecord;
}

export async function getCalendarFeedExportByToken(token: string) {
  if (!isSupabaseConfigured()) {
    return findDemoCalendarExportByExternalRef(token);
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("calendar_exports")
    .select("*")
    .eq("external_ref", token)
    .eq("export_type", "ics_feed")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    sessionId: data.session_id,
    exportType: data.export_type,
    externalRef: data.external_ref,
    createdAt: data.created_at
  } satisfies CalendarExportRecord;
}

export async function updateTaskCalendarLink(input: {
  taskId: string;
  userId?: string;
  calendarEventId?: string;
  calendarSource?: PlannedTask["calendarSource"];
  status?: PlannedTask["status"];
}) {
  if (!isSupabaseConfigured() || !input.userId) {
    const task = updateDemoTaskCalendarLink({
      taskId: input.taskId,
      calendarEventId: input.calendarEventId,
      calendarSource: input.calendarSource,
      status: input.status
    });

    if (!task) {
      throw new Error("Task not found.");
    }

    return task;
  }

  const supabase = createAdminSupabaseClient();
  const updates = {
    calendar_event_id: input.calendarEventId ?? null,
    calendar_source: input.calendarSource ?? null,
    status: input.status ?? "exported"
  };

  const { data, error } = await supabase
    .from("planned_tasks")
    .update(updates)
    .eq("id", input.taskId)
    .eq("user_id", input.userId);
    
  if (error) {
    throw error;
  }

  const { data: row, error: selectError } = await supabase
    .from("planned_tasks")
    .select("*")
    .eq("id", input.taskId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (!row) {
    throw new Error("Task not found.");
  }

  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    taskDate: row.task_date,
    title: row.title,
    notes: row.notes ?? undefined,
    location: row.location ?? undefined,
    priority: row.priority,
    confidence: row.confidence,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    sourceType: row.source_type,
    calendarEventId: row.calendar_event_id ?? undefined,
    calendarSource: row.calendar_source ?? undefined,
    status: row.status
  } satisfies PlannedTask;
}

export async function clearTaskCalendarLink(input: {
  taskId: string;
  userId?: string;
  status?: PlannedTask["status"];
}) {
  return updateTaskCalendarLink({
    taskId: input.taskId,
    userId: input.userId,
    calendarEventId: undefined,
    calendarSource: undefined,
    status: input.status ?? "draft"
  });
}

export async function updateTaskById(input: {
  taskId: string;
  userId?: string;
  title?: string;
  notes?: string;
  startTime?: string;
  endTime?: string;
}) {
  if (!isSupabaseConfigured() || !input.userId) {
    const task = updateDemoTask({
      taskId: input.taskId,
      title: input.title,
      notes: input.notes,
      startTime: input.startTime,
      endTime: input.endTime
    });

    if (!task) {
      throw new Error("Task not found.");
    }

    return task;
  }

  const supabase = createAdminSupabaseClient();
  const updates = {
    title: input.title,
    notes: input.notes ?? null,
    start_time: input.startTime ?? null,
    end_time: input.endTime ?? null
  };

  const { error } = await supabase
    .from("planned_tasks")
    .update(updates)
    .eq("id", input.taskId)
    .eq("user_id", input.userId);

  if (error) {
    throw error;
  }

  const { data: row, error: selectError } = await supabase
    .from("planned_tasks")
    .select("*")
    .eq("id", input.taskId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (!row) {
    throw new Error("Task not found.");
  }

  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    taskDate: row.task_date,
    title: row.title,
    notes: row.notes ?? undefined,
    location: row.location ?? undefined,
    priority: row.priority,
    confidence: row.confidence,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    sourceType: row.source_type,
    calendarEventId: row.calendar_event_id ?? undefined,
    calendarSource: row.calendar_source ?? undefined,
    status: row.status
  } satisfies PlannedTask;
}
