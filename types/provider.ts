export type Provider = "aliyun" | "doubao";

export type InternalRealtimeEvent =
  | "partial_transcript"
  | "final_transcript"
  | "assistant_audio_chunk"
  | "session_end"
  | "provider_error";
