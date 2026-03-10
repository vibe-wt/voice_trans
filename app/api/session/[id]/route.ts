import { apiError, apiOk } from "@/lib/api";
import { getViewerContext } from "@/lib/auth";
import { closeManagedSession } from "@/lib/realtime/session-manager";
import { deleteSessionById, getTranscriptBySessionId } from "@/lib/repositories/session-repository";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const viewer = await getViewerContext();
  const { id } = await context.params;

  if (!viewer.isDemoMode && !viewer.user) {
    return apiError("Authentication required.", 401);
  }

  const transcript = await getTranscriptBySessionId(id, viewer.user?.id);
  return apiOk({ transcript });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const viewer = await getViewerContext();
  const { id } = await context.params;

  if (!viewer.isDemoMode && !viewer.user) {
    return apiError("Authentication required.", 401);
  }

  await closeManagedSession(id);
  const result = await deleteSessionById(id, viewer.user?.id);
  return apiOk(result);
}
