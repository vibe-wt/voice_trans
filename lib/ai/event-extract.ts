import type { PlannedTask } from "@/types/task";
import type { SummaryOutput } from "@/lib/ai/summarize";

export function extractCandidateEvents(summary: SummaryOutput, sessionId: string): PlannedTask[] {
  const datedBlocks = summary.tomorrow_plan.schedule_blocks.map(
    (block, index) =>
      ({
        id: `${sessionId}-task-${index + 1}`,
        sessionId,
        userId: "demo-user",
        taskDate: extractTaskDate(block.start_time, summary.date),
        title: block.title,
        notes: buildTaskNotes(summary, block.title),
        priority: block.priority,
        confidence: block.confidence,
        startTime: block.start_time,
        endTime: block.end_time,
        sourceType: "explicit",
        status: "draft"
      }) satisfies PlannedTask
  );

  const untimedTasks = [
    ...summary.tomorrow_plan.must_do.map((title) => ({
      title,
      priority: "high" as const,
      confidence: "medium" as const,
      sourceType: "explicit" as const
    })),
    ...summary.tomorrow_plan.follow_ups.map((title) => ({
      title,
      priority: "medium" as const,
      confidence: "medium" as const,
      sourceType: "inferred" as const
    })),
    ...summary.tomorrow_plan.reminders.map((title) => ({
      title,
      priority: "low" as const,
      confidence: "medium" as const,
      sourceType: "inferred" as const
    }))
  ]
    .filter((item) => !datedBlocks.some((block) => normalizeTitle(block.title) === normalizeTitle(item.title)))
    .map(
      (item, index) =>
        ({
          id: `${sessionId}-task-extra-${index + 1}`,
          sessionId,
          userId: "demo-user",
          taskDate: summary.date,
          title: item.title,
          notes: buildTaskNotes(summary, item.title),
          priority: item.priority,
          confidence: item.confidence,
          sourceType: item.sourceType,
          status: "draft"
        }) satisfies PlannedTask
    );

  return [...datedBlocks, ...untimedTasks];
}

function extractTaskDate(isoTime: string | undefined, fallbackDate: string) {
  return isoTime?.slice(0, 10) ?? fallbackDate;
}

function normalizeTitle(title: string) {
  return title.replace(/\s+/g, "").trim();
}

function buildTaskNotes(summary: SummaryOutput, title: string) {
  const relatedHints = [
    ...summary.tomorrow_plan.follow_ups,
    ...summary.tomorrow_plan.reminders
  ].filter((item) => normalizeTitle(item) !== normalizeTitle(title));

  const segments = [
    `来源：AI Voice Journal`,
    relatedHints.length ? `相关提示：${relatedHints.slice(0, 2).join("；")}` : ""
  ].filter(Boolean);

  return segments.join("\n");
}
