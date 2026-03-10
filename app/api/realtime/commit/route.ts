import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { env } from "@/lib/env";
import { commitAliyunAudioInput, ensureAliyunRealtimeSession } from "@/lib/realtime/session-manager";

const commitSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().optional().default("demo-user"),
  voice: z.string().min(1).optional()
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = commitSchema.safeParse(json);

  if (!parsed.success) {
    return apiError("Invalid realtime commit payload.");
  }

  if (env.REALTIME_PROVIDER !== "aliyun") {
    return apiOk({
      sessionId: parsed.data.sessionId,
      transport: "mock",
      accepted: true,
      events: []
    });
  }

  try {
    await ensureAliyunRealtimeSession(parsed.data.sessionId, parsed.data.userId, parsed.data.voice);

    const events = await commitAliyunAudioInput(parsed.data.sessionId);
    return apiOk({
      sessionId: parsed.data.sessionId,
      transport: "provider_websocket",
      accepted: true,
      events
    });
  } catch (error) {
    console.error("[realtime-commit] failed", {
      sessionId: parsed.data.sessionId,
      provider: env.REALTIME_PROVIDER,
      message: error instanceof Error ? error.message : "Aliyun realtime commit failed."
    });
    return apiError(error instanceof Error ? error.message : "Aliyun realtime commit failed.", 502);
  }
}
