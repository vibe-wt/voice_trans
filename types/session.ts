import type { Provider } from "@/types/provider";

export interface VoiceSession {
  id: string;
  userId: string;
  provider: Provider;
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  status: "active" | "finalized" | "failed";
  rawSummary?: string;
}

export interface TranscriptSegment {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  seq: number;
  startedAt?: string;
  endedAt?: string;
}
