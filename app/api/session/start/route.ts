import { apiError, apiOk } from "@/lib/api";
import { env } from "@/lib/env";
import { getViewerContext } from "@/lib/auth";
import { startVoiceSession } from "@/lib/repositories/session-repository";

export async function POST() {
  const viewer = await getViewerContext();
  const userId = viewer.user?.id ?? "demo-user";

  if (!viewer.isDemoMode && !viewer.user) {
    return apiError("Authentication required.", 401);
  }

  const session = await startVoiceSession({
    userId,
    provider: env.REALTIME_PROVIDER
  });

  return apiOk({
    sessionId: session.id,
    provider: session.provider,
    status: session.status
  });
}
