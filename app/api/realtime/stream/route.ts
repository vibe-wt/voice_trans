import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { env } from "@/lib/env";
import {
  drainSessionEvents,
  ensureAliyunRealtimeSession
} from "@/lib/realtime/session-manager";
import type { NormalizedRealtimeEvent } from "@/lib/realtime/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const streamQuerySchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().optional().default("demo-user"),
  voice: z.string().min(1).optional()
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = streamQuerySchema.safeParse({
    sessionId: url.searchParams.get("sessionId"),
    userId: url.searchParams.get("userId") ?? undefined,
    voice: url.searchParams.get("voice") ?? undefined
  });

  if (!parsed.success) {
    return new Response("event: error\ndata: Invalid realtime stream query.\n\n", {
      status: 400,
      headers: sseHeaders()
    });
  }

  if (env.REALTIME_PROVIDER !== "aliyun") {
    return new Response(new ReadableStream(), {
      headers: sseHeaders()
    });
  }

  try {
    await ensureAliyunRealtimeSession(parsed.data.sessionId, parsed.data.userId, parsed.data.voice);
  } catch (error) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({
        type: "provider_error",
        message: error instanceof Error ? error.message : "Unable to open realtime stream."
      })}\n\n`,
      {
        status: 502,
        headers: sseHeaders()
      }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        try {
          controller.close();
        } catch {}
      };

      const send = (chunk: string) => {
        if (closed) {
          return;
        }

        controller.enqueue(encoder.encode(chunk));
      };

      request.signal.addEventListener("abort", close);
      send(": connected\n\n");

      let keepAliveAt = Date.now();

      while (!closed && !request.signal.aborted) {
        const events = coalesceRealtimeEvents(drainSessionEvents(parsed.data.sessionId));

        if (events.length) {
          for (const event of events) {
            send(`data: ${JSON.stringify(event)}\n\n`);
          }
        } else if (Date.now() - keepAliveAt > 10_000) {
          keepAliveAt = Date.now();
          send(": keep-alive\n\n");
        }

        await delay(40);
      }

      close();
    }
  });

  return new Response(stream, {
    headers: sseHeaders()
  });
}

function sseHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  };
}

function coalesceRealtimeEvents(events: NormalizedRealtimeEvent[]) {
  const merged: NormalizedRealtimeEvent[] = [];

  for (const event of events) {
    const last = merged[merged.length - 1];

    if (
      last?.type === "assistant_audio_chunk" &&
      event.type === "assistant_audio_chunk" &&
      last.chunkBase64 &&
      event.chunkBase64
    ) {
      last.chunkBase64 += event.chunkBase64;
      continue;
    }

    if (
      last?.type === "assistant_text_delta" &&
      event.type === "assistant_text_delta" &&
      last.text &&
      event.text
    ) {
      last.text += event.text;
      continue;
    }

    merged.push({ ...event });
  }

  return merged;
}
