import { apiError, apiOk } from "@/lib/api";
import { getViewerContext } from "@/lib/auth";
import { getJournalBySessionId } from "@/lib/repositories/session-repository";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const viewer = await getViewerContext();

  if (!viewer.isDemoMode && !viewer.user) {
    return apiError("Authentication required.", 401);
  }

  const journal = await getJournalBySessionId(id, viewer.user?.id);

  if (!journal) {
    return apiError("Journal entry not found.", 404);
  }

  return apiOk(journal);
}
