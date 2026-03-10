import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { env } from "@/lib/env";
import { getProviderGatewayInfo } from "@/lib/realtime";
import { ensureAliyunRealtimeSession } from "@/lib/realtime/session-manager";

const payloadSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1).default("demo-user"),
  provider: z.enum(["aliyun", "doubao"]).optional(),
  voice: z.string().min(1).optional()
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return apiError("Invalid realtime connect payload.");
  }

  const provider = parsed.data.provider ?? env.REALTIME_PROVIDER;
  const gateway = getProviderGatewayInfo(provider, parsed.data.sessionId, parsed.data.userId);

  if (provider === "aliyun" && gateway.transport === "provider_websocket") {
    try {
      await ensureAliyunRealtimeSession(parsed.data.sessionId, parsed.data.userId, parsed.data.voice);
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "Aliyun realtime connect failed.", 502);
    }
  }

  return apiOk({
    sessionId: parsed.data.sessionId,
    provider,
    transport: gateway.transport,
    endpoint: gateway.endpoint,
    eventProtocol: [
      "partial_transcript",
      "final_transcript",
      "assistant_text_delta",
      "assistant_audio_chunk",
      "session_end",
      "provider_error"
    ]
  });
}
