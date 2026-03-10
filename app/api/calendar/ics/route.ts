import { z } from "zod";
import { apiError } from "@/lib/api";
import { getViewerContext } from "@/lib/auth";
import { buildIcsFile } from "@/lib/calendar/ics";
import { getTasksBySessionId } from "@/lib/repositories/session-repository";

const exportSchema = z.object({
  sessionId: z.string().min(1),
  taskIds: z.array(z.string().min(1)).optional()
});

export async function GET(request: Request) {
  return buildCalendarExport(request.url);
}

export async function POST(request: Request) {
  const viewer = await getViewerContext();
  const json = await request.json().catch(() => null);
  const parsed = exportSchema.safeParse(json);

  if (!parsed.success) {
    return apiError("Invalid calendar export payload.");
  }

  return buildCalendarExport(undefined, {
    viewer,
    sessionId: parsed.data.sessionId,
    taskIds: parsed.data.taskIds
  });
}

async function buildCalendarExport(
  requestUrl?: string,
  input?: {
    viewer: Awaited<ReturnType<typeof getViewerContext>>;
    sessionId: string;
    taskIds?: string[];
  }
) {
  const viewer = input?.viewer ?? (await getViewerContext());
  const searchParams = requestUrl ? new URL(requestUrl).searchParams : null;
  const sessionId = input?.sessionId ?? searchParams?.get("sessionId");
  const selectedIds = input?.taskIds;

  if (!sessionId) {
    return apiError("Missing sessionId query parameter.");
  }

  if (!viewer.isDemoMode && !viewer.user) {
    return apiError("Authentication required.", 401);
  }

  const tasks = await getTasksBySessionId(sessionId, viewer.user?.id);
  const filteredTasks =
    selectedIds && selectedIds.length ? tasks.filter((task) => selectedIds.includes(task.id)) : tasks;

  if (!filteredTasks.length) {
    return apiError("No calendar candidates found for session.", 404);
  }

  const fileName = `ai-plan-${filteredTasks[0]?.taskDate ?? "today"}.ics`;
  const body = buildIcsFile(filteredTasks);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`
    }
  });
}
