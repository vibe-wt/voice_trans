import type { PlannedTask } from "@/types/task";
import type { JournalEntry } from "@/types/journal";

export interface VoiceTranscriptItem {
  role: "user" | "assistant";
  content: string;
}

export interface FinalizePayload {
  sessionId: string;
  journal: JournalEntry;
  candidateEvents: PlannedTask[];
}

export interface ParsedRealtimeState {
  transcript: VoiceTranscriptItem[];
  assistantReply: string;
  assistantAudioChunkCount: number;
  assistantAudioChunks: string[];
}

export class BrowserVoiceSessionClient {
  private sessionId: string | null = null;
  private transcript: VoiceTranscriptItem[] = [];
  private uploadedAudioChunks = 0;
  private assistantReply = "";
  private assistantAudioChunkCount = 0;
  private lastTransport: "mock" | "provider_websocket" = "mock";
  private selectedVoice = "Cherry";

  getSessionId() {
    return this.sessionId;
  }

  getTranscript() {
    return [...this.transcript];
  }

  getUploadedAudioChunks() {
    return this.uploadedAudioChunks;
  }

  getAssistantReply() {
    return this.assistantReply;
  }

  getAssistantAudioChunkCount() {
    return this.assistantAudioChunkCount;
  }

  hydrateDraft(input: {
    sessionId: string | null;
    transcript: VoiceTranscriptItem[];
    uploadedAudioChunks: number;
  }) {
    this.sessionId = input.sessionId;
    this.transcript = [...input.transcript];
    this.uploadedAudioChunks = input.uploadedAudioChunks;
  }

  async start(preferences?: { voice?: string }) {
    const startResponse = await fetch("/api/session/start", { method: "POST" });
    const startJson = await startResponse.json();

    if (!startResponse.ok || !startJson.ok) {
      throw new Error(startJson.error?.message ?? "Unable to start session.");
    }

    this.sessionId = startJson.data.sessionId as string;

    const connectResponse = await fetch("/api/realtime/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId: this.sessionId,
        userId: "demo-user",
        provider: startJson.data.provider,
        voice: preferences?.voice
      })
    });

    const connectJson = await connectResponse.json();

    if (!connectResponse.ok || !connectJson.ok) {
      throw new Error(connectJson.error?.message ?? "Unable to connect realtime session.");
    }

    const data = connectJson.data as {
      transport: "mock" | "provider_websocket";
      provider: string;
      sessionId: string;
    };

    this.rememberTransport(data.transport);
    this.selectedVoice = preferences?.voice ?? this.selectedVoice;
    return data;
  }

  async submitText(text: string) {
    return this.submitRealtimePayload({
      sessionId: this.requireSessionId(),
      text
    });
  }

  async submitAudioChunk(input: Blob | ArrayBuffer) {
    const chunkBase64 = await encodeChunkToBase64(input);
    this.uploadedAudioChunks += 1;

    const response = await this.submitRealtimePayload({
      sessionId: this.requireSessionId(),
      chunkBase64,
      userId: "demo-user",
      voice: this.selectedVoice
    });

    return {
      ...response,
      uploadedAudioChunks: this.uploadedAudioChunks
    };
  }

  async finalize() {
    const response = await fetch("/api/session/finalize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId: this.requireSessionId(),
        transcript: this.transcript
      })
    });

    const json = await response.json();

    if (!response.ok || !json.ok) {
      throw new Error(json.error?.message ?? "Unable to finalize session.");
    }

    return {
      sessionId: json.data.sessionId as string,
      journal: json.data.journal as JournalEntry,
      candidateEvents: json.data.candidateEvents as PlannedTask[]
    } satisfies FinalizePayload;
  }

  async commitAudioInput() {
    const response = await fetch("/api/realtime/commit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId: this.requireSessionId(),
        userId: "demo-user",
        voice: this.selectedVoice
      })
    });

    const json = await response.json();

    if (!response.ok || !json.ok) {
      throw new Error(json.error?.message ?? "Unable to commit audio input.");
    }

    return {
      transport: this.rememberTransport(json.data.transport as "mock" | "provider_websocket"),
      ...this.consumeRealtimeEvents(json.data.events ?? [])
    };
  }

  async pollRealtimeEvents() {
    const response = await fetch("/api/realtime/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId: this.requireSessionId(),
        userId: "demo-user",
        voice: this.selectedVoice
      })
    });

    const json = await response.json();

    if (!response.ok || !json.ok) {
      throw new Error(json.error?.message ?? "Unable to poll realtime events.");
    }

    return {
      transport: this.rememberTransport(json.data.transport as "mock" | "provider_websocket"),
      ...this.consumeRealtimeEvents(json.data.events ?? [])
    };
  }

  reset() {
    this.sessionId = null;
    this.transcript = [];
    this.uploadedAudioChunks = 0;
    this.assistantReply = "";
    this.assistantAudioChunkCount = 0;
    this.lastTransport = "mock";
    this.selectedVoice = "Cherry";
  }

  private async submitRealtimePayload(payload: Record<string, unknown>) {
    const response = await fetch("/api/realtime/chunk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const json = await response.json();

    if (!response.ok || !json.ok) {
      throw new Error(json.error?.message ?? "Unable to send realtime payload.");
    }

    return {
      transport: this.rememberTransport(json.data.transport as "mock" | "provider_websocket"),
      ...this.consumeRealtimeEvents(json.data.events ?? [])
    };
  }

  private consumeRealtimeEvents(rawEvents: unknown[]): ParsedRealtimeState {
    const events = rawEvents as Array<{
      type: string;
      text?: string;
      role?: "user" | "assistant";
      chunkBase64?: string;
    }>;
    const assistantAudioChunks: string[] = [];

    for (const event of events) {
      if (event.type === "assistant_text_delta" && event.text) {
        this.assistantReply = `${this.assistantReply}${event.text}`.trim();
      }

      if (event.type === "assistant_audio_chunk" && event.chunkBase64) {
        this.assistantAudioChunkCount += 1;
        assistantAudioChunks.push(event.chunkBase64);
      }

      if (event.type === "final_transcript" && event.text && event.role) {
        this.transcript.push({
          role: event.role,
          content: event.text
        });

        if (event.role === "assistant") {
          this.assistantReply = event.text;
        }
      }
    }

    return {
      transcript: this.getTranscript(),
      assistantReply: this.getAssistantReply(),
      assistantAudioChunkCount: this.getAssistantAudioChunkCount(),
      assistantAudioChunks
    };
  }

  private requireSessionId() {
    if (!this.sessionId) {
      throw new Error("Session not started.");
    }

    return this.sessionId;
  }

  private rememberTransport(transport: "mock" | "provider_websocket") {
    this.lastTransport = transport;
    return this.lastTransport;
  }
}

async function encodeChunkToBase64(input: Blob | ArrayBuffer) {
  const arrayBuffer = input instanceof Blob ? await input.arrayBuffer() : input;
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
