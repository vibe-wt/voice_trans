import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { getViewerContext } from "@/lib/auth";
import { buildIcsFile } from "@/lib/calendar/ics";
import { env } from "@/lib/env";
import {
  createOrGetCalendarFeedExport,
  getCalendarFeedExportByToken,
  getTasksBySessionId
} from "@/lib/repositories/session-repository";

const feedCreateSchema = z.object({
  sessionId: z.string().min(1)
});

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");
  const sessionId = searchParams.get("sessionId");

  if (token) {
    const record = await getCalendarFeedExportByToken(token);

    if (!record) {
      return apiError("Calendar feed not found.", 404);
    }

    const tasks = await getTasksBySessionId(record.sessionId, record.userId);
    if (!tasks.length) {
      return apiError("No calendar candidates found for feed.", 404);
    }

    return new Response(buildIcsFile(tasks), {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="ai-feed-${record.sessionId}.ics"`
      }
    });
  }

  const viewer = await getViewerContext();
  if (!sessionId) {
    return apiError("Missing sessionId query parameter.");
  }

  if (!viewer.isDemoMode && !viewer.user) {
    return apiError("Authentication required.", 401);
  }

  const record = await createOrGetCalendarFeedExport(sessionId, viewer.user?.id);
  const feedPath = `/api/calendar/feed?token=${record.externalRef}`;
  const baseUrl = env.NEXT_PUBLIC_APP_URL || origin;

  return apiOk({
    sessionId,
    token: record.externalRef,
    feedUrl: `${baseUrl}${feedPath}`,
    webcalUrl: `${baseUrl}${feedPath}`.replace(/^http/, "webcal")
  });
}

export async function POST(request: Request) {
  const viewer = await getViewerContext();

  if (!viewer.isDemoMode && !viewer.user) {
    return apiError("Authentication required.", 401);
  }

  const json = await request.json().catch(() => null);
  const parsed = feedCreateSchema.safeParse(json);

  if (!parsed.success) {
    return apiError("Invalid calendar feed payload.");
  }

  const record = await createOrGetCalendarFeedExport(parsed.data.sessionId, viewer.user?.id);
  const origin = env.NEXT_PUBLIC_APP_URL || env.APP_BASE_URL;
  const feedPath = `/api/calendar/feed?token=${record.externalRef}`;

  return apiOk({
    sessionId: parsed.data.sessionId,
    token: record.externalRef,
    feedUrl: `${origin}${feedPath}`,
    webcalUrl: `${origin}${feedPath}`.replace(/^http/, "webcal")
  });
}
