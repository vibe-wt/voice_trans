import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { env } from "@/lib/env";
import { collectAliyunRealtimeEvents, ensureAliyunRealtimeSession } from "@/lib/realtime/session-manager";

const eventsSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().optional().default("demo-user"),
  voice: z.string().min(1).optional()
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = eventsSchema.safeParse(json);

  if (!parsed.success) {
    return apiError("Invalid realtime events payload.");
  }

  if (env.REALTIME_PROVIDER !== "aliyun") {
    return apiOk({
      sessionId: parsed.data.sessionId,
      transport: "mock",
      events: []
    });
  }

  try {
    await ensureAliyunRealtimeSession(parsed.data.sessionId, parsed.data.userId, parsed.data.voice);

    const events = await collectAliyunRealtimeEvents(parsed.data.sessionId);
    return apiOk({
      sessionId: parsed.data.sessionId,
      transport: "provider_websocket",
      events
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unable to collect realtime events.", 502);
  }
}
