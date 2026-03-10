import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { env } from "@/lib/env";
import { getProviderGatewayInfo } from "@/lib/realtime";
import { appendAliyunAudioChunk, ensureAliyunRealtimeSession } from "@/lib/realtime/session-manager";

const chunkSchema = z.object({
  sessionId: z.string().min(1),
  chunkBase64: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  userId: z.string().optional().default("demo-user"),
  voice: z.string().min(1).optional(),
  deliveryMode: z.enum(["response", "stream"]).optional().default("response")
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = chunkSchema.safeParse(json);

  if (!parsed.success) {
    return apiError("Invalid realtime audio chunk payload.");
  }

  if (!parsed.data.chunkBase64 && !parsed.data.text) {
    return apiError("Either chunkBase64 or text is required.");
  }

  const gateway = getProviderGatewayInfo(env.REALTIME_PROVIDER, parsed.data.sessionId, parsed.data.userId);

  if (parsed.data.chunkBase64) {
    if (env.REALTIME_PROVIDER === "aliyun" && gateway.transport === "provider_websocket") {
      try {
        await ensureAliyunRealtimeSession(parsed.data.sessionId, parsed.data.userId, parsed.data.voice);

        const events = await appendAliyunAudioChunk(parsed.data.sessionId, parsed.data.chunkBase64, {
          drainAfterSend: parsed.data.deliveryMode !== "stream"
        });

        return apiOk({
          sessionId: parsed.data.sessionId,
          transport: gateway.transport,
          accepted: true,
          events
        });
      } catch (error) {
        return apiError(error instanceof Error ? error.message : "Aliyun realtime chunk forwarding failed.", 502);
      }
    }

    return apiOk({
      sessionId: parsed.data.sessionId,
      transport: gateway.transport,
      accepted: true,
      events: [
        {
          type: "assistant_text_delta",
          text:
            gateway.transport === "mock"
              ? "已接收语音片段，当前 mock 模式只验证音频上传链路。"
              : "音频片段已转发到 provider 网关。"
        }
      ]
    });
  }

  if (parsed.data.text) {
    const assistantReply = buildAssistantReply(parsed.data.text);

    return apiOk({
      sessionId: parsed.data.sessionId,
      transport: gateway.transport,
      accepted: true,
      events: [
        {
          type: "partial_transcript",
          role: "user",
          text: parsed.data.text.slice(0, Math.max(1, Math.floor(parsed.data.text.length / 2)))
        },
        {
          type: "final_transcript",
          role: "user",
          text: parsed.data.text
        },
        {
          type: "assistant_text_delta",
          text: assistantReply
        },
        {
          type: "final_transcript",
          role: "assistant",
          text: assistantReply
        }
      ]
    });
  }

  return apiOk({
    sessionId: parsed.data.sessionId,
    transport: gateway.transport,
    accepted: true
  });
}

function buildAssistantReply(text: string) {
  if (/预算|跟进/.test(text)) {
    return "我记下了，这像是明早优先处理的明确事项。";
  }

  if (/明天|明日/.test(text)) {
    return "收到，我会把它归入明日安排，并尽量给出时间块建议。";
  }

  return "我先帮你确认重点，结束后会整理成今日日记和明日安排。";
}
