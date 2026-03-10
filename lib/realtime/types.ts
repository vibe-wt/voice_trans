import type { Provider } from "@/types/provider";

export interface RealtimeAdapterConfig {
  provider: Provider;
  sessionId: string;
  userId: string;
  endpoint?: string;
  apiKey?: string;
  model?: string;
  voice?: string;
  instructions?: string;
}

export interface RealtimeAdapter {
  connect(sessionId: string): Promise<void>;
  sendAudioChunk(chunk: ArrayBuffer): Promise<void>;
  close(): Promise<void>;
  onPartialTranscript(cb: (text: string) => void): void;
  onFinalTranscript(cb: (text: string) => void): void;
  onAssistantAudio(cb: (chunk: ArrayBuffer) => void): void;
  onAssistantTextDelta?(cb: (text: string) => void): void;
  onError(cb: (error: Error) => void): void;
}

export type NormalizedRealtimeEvent =
  | {
      type: "partial_transcript";
      text: string;
      role: "user";
    }
  | {
      type: "final_transcript";
      text: string;
      role: "user" | "assistant";
    }
  | {
      type: "assistant_audio_chunk";
      chunkBase64: string;
    }
  | {
      type: "assistant_text_delta";
      text: string;
    }
  | {
      type: "session_end";
    }
  | {
      type: "provider_error";
      message: string;
    };

export interface ProviderGatewayInfo {
  provider: Provider;
  sessionId: string;
  transport: "mock" | "provider_websocket";
  endpoint?: string;
  requiredHeaders?: Record<string, string>;
}
