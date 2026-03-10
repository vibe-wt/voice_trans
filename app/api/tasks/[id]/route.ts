import { apiError, apiOk } from "@/lib/api";
import { getViewerContext } from "@/lib/auth";
import { getTasksBySessionId, updateTaskById } from "@/lib/repositories/session-repository";
import { z } from "zod";

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().optional(),
  startTime: z.string().min(1).nullable().optional(),
  endTime: z.string().min(1).nullable().optional()
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const viewer = await getViewerContext();

  if (!viewer.isDemoMode && !viewer.user) {
    return apiError("Authentication required.", 401);
  }

  const tasks = await getTasksBySessionId(id, viewer.user?.id);

  if (!tasks.length) {
    return apiError("Tasks not found.", 404);
  }

  return apiOk(tasks);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const viewer = await getViewerContext();
  const json = await request.json().catch(() => null);
  const parsed = updateTaskSchema.safeParse(json);

  if (!parsed.success) {
    return apiError("Invalid task update payload.");
  }

  if (!viewer.isDemoMode && !viewer.user) {
    return apiError("Authentication required.", 401);
  }

  const task = await updateTaskById({
    taskId: id,
    userId: viewer.user?.id,
    title: parsed.data.title,
    notes: parsed.data.notes,
    startTime: parsed.data.startTime ?? undefined,
    endTime: parsed.data.endTime ?? undefined
  });

  return apiOk(task);
}
