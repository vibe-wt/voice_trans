"use client";

import type { VoiceTranscriptItem } from "@/lib/voice/browser-session";

const STORAGE_KEY = "ai-voice-journal:draft";

export interface VoiceDraft {
  sessionId: string | null;
  provider: string | null;
  transport: "mock" | "provider_websocket" | null;
  transcript: VoiceTranscriptItem[];
  spokenText: string;
  audioChunkCount: number;
  audioNote: string;
}

export function loadVoiceDraft(): VoiceDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as VoiceDraft;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveVoiceDraft(draft: VoiceDraft) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearVoiceDraft() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
