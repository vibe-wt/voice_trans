import { apiError, apiOk } from "@/lib/api";
import { getViewerContext } from "@/lib/auth";
import { listSessions } from "@/lib/repositories/session-repository";

export async function GET() {
  const viewer = await getViewerContext();

  if (!viewer.isDemoMode && !viewer.user) {
    return apiError("Authentication required.", 401);
  }

  const sessions = await listSessions(viewer.user?.id);
  return apiOk(sessions);
}
