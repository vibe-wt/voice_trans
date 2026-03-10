import { setTimeout as delay } from "node:timers/promises";
import { env } from "@/lib/env";
import { AliyunRealtimeAdapter } from "@/lib/realtime/adapters/aliyun";
import { resolveVoicePersonaConfig } from "@/lib/realtime/personas";
import type { NormalizedRealtimeEvent } from "@/lib/realtime/types";
import type { VoiceTranscriptItem } from "@/lib/voice/browser-session";

interface ManagedRealtimeSession {
  sessionId: string;
  userId: string;
  provider: "aliyun";
  voice: string;
  backendVoice: string;
  instructions: string;
  adapter: AliyunRealtimeAdapter;
  transcript: VoiceTranscriptItem[];
}

declare global {
  var __aiVoiceRealtimeSessions__: Map<string, ManagedRealtimeSession> | undefined;
  var __aiVoiceRealtimeSessionEnsures__: Map<string, Promise<ManagedRealtimeSession>> | undefined;
}

function getSessionMap() {
  if (!globalThis.__aiVoiceRealtimeSessions__) {
    globalThis.__aiVoiceRealtimeSessions__ = new Map<string, ManagedRealtimeSession>();
  }

  return globalThis.__aiVoiceRealtimeSessions__;
}

function getPendingEnsureMap() {
  if (!globalThis.__aiVoiceRealtimeSessionEnsures__) {
    globalThis.__aiVoiceRealtimeSessionEnsures__ = new Map<string, Promise<ManagedRealtimeSession>>();
  }

  return globalThis.__aiVoiceRealtimeSessionEnsures__;
}

export async function ensureAliyunRealtimeSession(sessionId: string, userId: string, voice = env.ALIYUN_REALTIME_VOICE) {
  const persona = resolveVoicePersonaConfig(voice, env.ALIYUN_REALTIME_VOICE);
  const sessions = getSessionMap();
  const pendingEnsures = getPendingEnsureMap();
  const compatibleExisting = sessions.get(sessionId);

  if (
    compatibleExisting &&
    isCompatibleAliyunAdapter(compatibleExisting.adapter) &&
    compatibleExisting.voice === persona.id
  ) {
    return compatibleExisting;
  }

  const inflight = pendingEnsures.get(sessionId);
  if (inflight) {
    const managed = await inflight;
    if (managed.voice === persona.id && isCompatibleAliyunAdapter(managed.adapter)) {
      return managed;
    }
  }

  const establishing = (async () => {
    const existing = sessions.get(sessionId);

    if (existing) {
      if (!isCompatibleAliyunAdapter(existing.adapter) || existing.voice !== persona.id) {
        await existing.adapter.close().catch(() => undefined);
        sessions.delete(sessionId);
      } else {
        return existing;
      }
    }

    const adapter = new AliyunRealtimeAdapter({
      provider: "aliyun",
      sessionId,
      userId,
      endpoint: env.ALIYUN_REALTIME_URL,
      apiKey: env.ALIYUN_API_KEY,
      model: env.ALIYUN_REALTIME_MODEL,
      voice: persona.voice,
      instructions: persona.instructions
    });

    const managed: ManagedRealtimeSession = {
      sessionId,
      userId,
      provider: "aliyun",
      voice: persona.id,
      backendVoice: persona.voice,
      instructions: persona.instructions,
      adapter,
      transcript: existing?.transcript ?? []
    };

    await adapter.connect(sessionId);
    sessions.set(sessionId, managed);
    return managed;
  })();

  pendingEnsures.set(sessionId, establishing);

  try {
    return await establishing;
  } finally {
    if (pendingEnsures.get(sessionId) === establishing) {
      pendingEnsures.delete(sessionId);
    }
  }
}

export async function appendAliyunAudioChunk(
  sessionId: string,
  chunkBase64: string,
  options?: {
    drainAfterSend?: boolean;
  }
) {
  const session = await requireCompatibleSession(sessionId);
  const chunk = Uint8Array.from(Buffer.from(chunkBase64, "base64")).buffer;
  await session.adapter.sendAudioChunk(chunk);
  await delay(60);
  if (options?.drainAfterSend === false) {
    return [];
  }
  return drainSessionEvents(sessionId);
}

export async function commitAliyunAudioInput(sessionId: string) {
  const session = await requireCompatibleSession(sessionId);
  await session.adapter.commitAudioInput();
  return waitForAliyunResponse(sessionId);
}

export function hasManagedSession(sessionId: string) {
  return getSessionMap().has(sessionId);
}

export function drainSessionEvents(sessionId: string): NormalizedRealtimeEvent[] {
  const session = getSessionMap().get(sessionId);
  if (!session) {
    return [];
  }

  const events = session.adapter.drainEvents();
  for (const event of events) {
    if (event.type === "final_transcript") {
      session.transcript.push({
        role: event.role,
        content: event.text
      });
    }
  }
  return events;
}

export async function collectAliyunRealtimeEvents(sessionId: string, durationMs = 220) {
  await requireCompatibleSession(sessionId);
  const collected: NormalizedRealtimeEvent[] = [];
  const startedAt = Date.now();

  while (Date.now() - startedAt < durationMs) {
    await delay(60);
    const events = drainSessionEvents(sessionId);
    if (events.length) {
      collected.push(...events);
    }
  }

  return collected;
}

export function getManagedTranscript(sessionId: string) {
  const session = getSessionMap().get(sessionId);
  return session ? [...session.transcript] : [];
}

export async function closeManagedSession(sessionId: string) {
  const sessions = getSessionMap();
  const session = sessions.get(sessionId);
  if (!session) {
    return;
  }

  await session.adapter.close();
  sessions.delete(sessionId);
}

async function requireCompatibleSession(sessionId: string) {
  const sessions = getSessionMap();
  const session = sessions.get(sessionId);

  if (!session) {
    throw new Error("Realtime session not found.");
  }

  if (!isCompatibleAliyunAdapter(session.adapter)) {
    await session.adapter.close().catch(() => undefined);
    sessions.delete(sessionId);
    throw new Error("Realtime session became stale. Please start the session again.");
  }

  if (session.adapter.shouldRecycleSession()) {
    await session.adapter.close().catch(() => undefined);
    sessions.delete(sessionId);
    return ensureAliyunRealtimeSession(sessionId, session.userId, session.voice);
  }

  if (isCompatibleAliyunAdapter(session.adapter)) {
    return session;
  }

  throw new Error("Realtime session became unavailable.");
}

async function waitForAliyunResponse(sessionId: string) {
  const collected: NormalizedRealtimeEvent[] = [];
  const startedAt = Date.now();
  let lastEventAt = 0;
  let sawAssistantOutput = false;

  while (Date.now() - startedAt < 8000) {
    await delay(120);
    const events = drainSessionEvents(sessionId);

    if (events.length) {
      collected.push(...events);
      lastEventAt = Date.now();
    }

    if (
      events.some((event) =>
        event.type === "assistant_text_delta" ||
        event.type === "assistant_audio_chunk" ||
        (event.type === "final_transcript" && event.role === "assistant")
      )
    ) {
      sawAssistantOutput = true;
    }

    if (collected.some((event) => event.type === "provider_error" || event.type === "session_end")) {
      break;
    }

    if (sawAssistantOutput && lastEventAt > 0 && Date.now() - lastEventAt > 1200) {
      break;
    }
  }

  return collected;
}

function isCompatibleAliyunAdapter(adapter: AliyunRealtimeAdapter) {
  return (
    typeof adapter.sendAudioChunk === "function" &&
    typeof adapter.commitAudioInput === "function" &&
    typeof adapter.drainEvents === "function" &&
    typeof adapter.close === "function" &&
    typeof adapter.shouldRecycleSession === "function"
  );
}
