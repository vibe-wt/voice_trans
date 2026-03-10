import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { getViewerContext } from "@/lib/auth";
import { clearTaskCalendarLink, updateTaskCalendarLink } from "@/lib/repositories/session-repository";

const calendarLinkSchema = z.object({
  calendarEventId: z.string().min(1).optional(),
  calendarSource: z.enum(["ios_eventkit", "ics_single", "ics_feed"]).optional(),
  status: z.enum(["draft", "confirmed", "exported"]).optional()
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const viewer = await getViewerContext();
  const json = await request.json().catch(() => null);
  const parsed = calendarLinkSchema.safeParse(json);

  if (!parsed.success) {
    return apiError("Invalid calendar link payload.");
  }

  if (!viewer.isDemoMode && !viewer.user) {
    return apiError("Authentication required.", 401);
  }

  const result = await updateTaskCalendarLink({
    taskId: id,
    userId: viewer.user?.id,
    calendarEventId: parsed.data.calendarEventId,
    calendarSource: parsed.data.calendarSource ?? "ios_eventkit",
    status: parsed.data.status ?? "exported"
  });

  return apiOk(result);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const viewer = await getViewerContext();

  if (!viewer.isDemoMode && !viewer.user) {
    return apiError("Authentication required.", 401);
  }

  const result = await clearTaskCalendarLink({
    taskId: id,
    userId: viewer.user?.id,
    status: "draft"
  });

  return apiOk(result);
}
