import { BaseRealtimeAdapter } from "@/lib/realtime/adapters/base";
import type { NormalizedRealtimeEvent, RealtimeAdapterConfig } from "@/lib/realtime/types";

export class AliyunRealtimeAdapter extends BaseRealtimeAdapter {
  private socket: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private readonly eventQueue: NormalizedRealtimeEvent[] = [];
  private lastCloseCode: number | null = null;
  private lastCloseReason: string | null = null;
  private lastEventSignature: string | null = null;
  private lastEventAt = 0;

  constructor(config: RealtimeAdapterConfig) {
    super(config);
  }

  async connect(_sessionId: string): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    if (!this.config.endpoint || !this.config.apiKey) {
      throw new Error("Aliyun realtime endpoint or API key is missing.");
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const wsUrl = buildAliyunRealtimeUrl(this.config.endpoint!, this.config.model);
      const NodeWebSocket = WebSocket as unknown as {
        new (url: string, options?: { headers?: Record<string, string> }): WebSocket;
      };
      const socket = new NodeWebSocket(wsUrl, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "X-DashScope-DataInspection": "disable"
        }
      });

      socket.addEventListener("open", () => {
        this.socket = socket;
        this.lastCloseCode = null;
        this.lastCloseReason = null;
        this.sendJson({
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions:
              this.config.instructions ??
              "你是一名中文实时语音助手。实时语音回复保持自然、简短，优先接住用户情绪和要点。",
            voice: this.config.voice ?? "Cherry",
            input_audio_format: "pcm16",
            output_audio_format: "pcm16",
            input_audio_transcription: {
              model: "gummy-realtime-v1"
            },
            turn_detection: {
              type: "server_vad",
              silence_duration_ms: 700
            },
            smooth_output: true
          }
        });
        resolve();
      });

      socket.addEventListener("message", (event) => {
        this.handleMessage(String(event.data));
      });

      socket.addEventListener("error", () => {
        const error = new Error("Aliyun realtime websocket error.");
        console.error("[aliyun-realtime] websocket error", {
          sessionId: this.config.sessionId
        });
        this.eventQueue.push({ type: "provider_error", message: error.message });
        this.errorHandler?.(error);
      });

      socket.addEventListener("close", (event) => {
        console.warn("[aliyun-realtime] websocket closed", {
          sessionId: this.config.sessionId,
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        this.lastCloseCode = event.code;
        this.lastCloseReason = event.reason;
        this.eventQueue.push({ type: "session_end" });
        this.socket = null;
      });

      const timeout = setTimeout(() => {
        reject(new Error("Aliyun realtime connect timeout."));
      }, 8000);

      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timeout);
        },
        { once: true }
      );

      socket.addEventListener(
        "error",
        () => {
          clearTimeout(timeout);
          reject(new Error("Aliyun realtime websocket failed to open."));
        },
        { once: true }
      );
    }).finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  async sendAudioChunk(chunk: ArrayBuffer): Promise<void> {
    await this.connect(this.config.sessionId);
    const audio = bufferToBase64(chunk);
    this.sendJson({
      type: "input_audio_buffer.append",
      audio
    });
  }

  async commitAudioInput(): Promise<void> {
    await this.connect(this.config.sessionId);
    this.sendJson({
      type: "input_audio_buffer.commit"
    });
    this.sendJson({
      type: "response.create",
      response: {
        modalities: ["text", "audio"]
      }
    });
  }

  async close(): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }

    this.socket = null;
  }

  drainEvents() {
    return this.eventQueue.splice(0, this.eventQueue.length);
  }

  shouldRecycleSession() {
    return this.lastCloseCode === 1011 || /timeout|backend response failed/i.test(this.lastCloseReason ?? "");
  }

  private handleMessage(payload: string) {
    let message: Record<string, unknown>;

    try {
      message = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return;
    }

    const type = typeof message.type === "string" ? message.type : "";

    switch (type) {
      case "conversation.item.input_audio_transcription.completed": {
        const transcript = getString(message.transcript);
        if (transcript) {
          this.pushEvent({
            type: "final_transcript",
            role: "user",
            text: transcript
          });
        }
        return;
      }
      case "response.audio_transcript.delta": {
        const text = getString(message.delta);
        if (text) {
          this.pushEvent({
            type: "assistant_text_delta",
            text
          });
        }
        return;
      }
      case "response.audio_transcript.done": {
        const text = getString(message.transcript);
        if (text) {
          this.pushEvent({
            type: "final_transcript",
            role: "assistant",
            text
          });
        }
        return;
      }
      case "response.content_part.done": {
        const part =
          typeof message.part === "object" && message.part ? (message.part as Record<string, unknown>) : null;
        const text = part ? getString(part.text) : undefined;
        if (text) {
          this.pushEvent({
            type: "final_transcript",
            role: "assistant",
            text
          });
        }
        return;
      }
      case "response.audio.delta": {
        const delta = getString(message.delta);
        if (delta) {
          this.pushEvent({
            type: "assistant_audio_chunk",
            chunkBase64: delta
          });
        }
        return;
      }
      case "response.done": {
        this.pushEvent({ type: "session_end" });
        return;
      }
      case "error": {
        const eventId = getString(message.event_id);
        const detail = typeof message.error === "object" && message.error ? (message.error as Record<string, unknown>) : {};
        const providerMessage = getString(detail.message) ?? "Aliyun realtime provider error.";
        console.error("[aliyun-realtime] provider error", {
          sessionId: this.config.sessionId,
          eventId,
          providerMessage,
          raw: message
        });
        this.pushEvent({
          type: "provider_error",
          message: eventId ? `${providerMessage} (${eventId})` : providerMessage
        });
        return;
      }
      default:
        if (type) {
          console.info("[aliyun-realtime] unhandled event", {
            sessionId: this.config.sessionId,
            type,
            raw: message
          });
        }
        return;
    }
  }

  private pushEvent(event: NormalizedRealtimeEvent) {
    if (this.isDuplicateEvent(event)) {
      return;
    }

    this.eventQueue.push(event);
    this.emitNormalizedEvent(event);
  }

  private isDuplicateEvent(event: NormalizedRealtimeEvent) {
    const signature = buildEventSignature(event);
    const now = Date.now();
    const isDuplicate = this.lastEventSignature === signature && now - this.lastEventAt < 1500;

    this.lastEventSignature = signature;
    this.lastEventAt = now;

    return isDuplicate;
  }

  private sendJson(payload: Record<string, unknown>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Aliyun realtime socket is not open.");
    }

    this.socket.send(
      JSON.stringify({
        event_id: payload.event_id ?? buildEventId(),
        ...payload
      })
    );
  }
}

function buildAliyunRealtimeUrl(endpoint: string, model?: string) {
  const url = new URL(endpoint);
  if (model) {
    url.searchParams.set("model", model);
  }
  return url.toString();
}

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function bufferToBase64(chunk: ArrayBuffer) {
  return Buffer.from(chunk).toString("base64");
}

function buildEventId() {
  return `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildEventSignature(event: NormalizedRealtimeEvent) {
  switch (event.type) {
    case "final_transcript":
      return `${event.type}:${event.role}:${event.text}`;
    case "assistant_text_delta":
      return `${event.type}:${event.text}`;
    case "assistant_audio_chunk":
      return `${event.type}:${event.chunkBase64.slice(0, 48)}`;
    case "provider_error":
      return `${event.type}:${event.message}`;
    case "partial_transcript":
      return `${event.type}:${event.role}:${event.text}`;
    case "session_end":
      return event.type;
  }
}
