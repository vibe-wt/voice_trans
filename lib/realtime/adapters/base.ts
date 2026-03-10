import type {
  NormalizedRealtimeEvent,
  RealtimeAdapter,
  RealtimeAdapterConfig
} from "@/lib/realtime/types";

type TranscriptHandler = (text: string) => void;
type AudioHandler = (chunk: ArrayBuffer) => void;
type ErrorHandler = (error: Error) => void;

export abstract class BaseRealtimeAdapter implements RealtimeAdapter {
  protected readonly config: RealtimeAdapterConfig;
  protected partialTranscriptHandler?: TranscriptHandler;
  protected finalTranscriptHandler?: TranscriptHandler;
  protected assistantAudioHandler?: AudioHandler;
  protected assistantTextDeltaHandler?: TranscriptHandler;
  protected errorHandler?: ErrorHandler;

  protected constructor(config: RealtimeAdapterConfig) {
    this.config = config;
  }

  abstract connect(sessionId: string): Promise<void>;
  abstract sendAudioChunk(chunk: ArrayBuffer): Promise<void>;
  abstract close(): Promise<void>;

  onPartialTranscript(cb: TranscriptHandler): void {
    this.partialTranscriptHandler = cb;
  }

  onFinalTranscript(cb: TranscriptHandler): void {
    this.finalTranscriptHandler = cb;
  }

  onAssistantAudio(cb: AudioHandler): void {
    this.assistantAudioHandler = cb;
  }

  onAssistantTextDelta(cb: TranscriptHandler): void {
    this.assistantTextDeltaHandler = cb;
  }

  onError(cb: ErrorHandler): void {
    this.errorHandler = cb;
  }

  protected emitNormalizedEvent(event: NormalizedRealtimeEvent) {
    switch (event.type) {
      case "partial_transcript":
        this.partialTranscriptHandler?.(event.text);
        return;
      case "final_transcript":
        this.finalTranscriptHandler?.(event.text);
        return;
      case "assistant_audio_chunk":
        this.assistantAudioHandler?.(Uint8Array.from(atob(event.chunkBase64), (char) => char.charCodeAt(0)).buffer);
        return;
      case "assistant_text_delta":
        this.assistantTextDeltaHandler?.(event.text);
        return;
      case "provider_error":
        this.errorHandler?.(new Error(event.message));
        return;
      case "session_end":
        return;
    }
  }
}
