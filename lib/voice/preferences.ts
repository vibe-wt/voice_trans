"use client";

export interface VoicePreference {
  voice: string;
  playbackRate: number;
}

export const DEFAULT_VOICE_PREFERENCE: VoicePreference = {
  voice: "Cherry",
  playbackRate: 1
};

export const ALIYUN_VOICE_OPTIONS = [
  { value: "Cherry", label: "芊悦", description: "阳光自然女声" },
  { value: "Serena", label: "苏瑶", description: "温柔女声" },
  { value: "Ethan", label: "晨煦", description: "温暖男声" },
  { value: "Chelsie", label: "千雪", description: "二次元女声" },
  { value: "Momo", label: "茉兔", description: "活泼搞怪" },
  { value: "Nofish", label: "不吃鱼", description: "设计师感女声" },
  { value: "Jennifer", label: "Jennifer", description: "电影感美语女声" },
  { value: "Ryan", label: "Ryan", description: "张力男声" }
] as const;

const STORAGE_KEY = "ai-voice-journal:voice-preference";

export function loadVoicePreference(): VoicePreference {
  if (typeof window === "undefined") {
    return DEFAULT_VOICE_PREFERENCE;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_VOICE_PREFERENCE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<VoicePreference>;
    return {
      voice: typeof parsed.voice === "string" ? parsed.voice : DEFAULT_VOICE_PREFERENCE.voice,
      playbackRate:
        typeof parsed.playbackRate === "number" && parsed.playbackRate >= 0.8 && parsed.playbackRate <= 1.4
          ? parsed.playbackRate
          : DEFAULT_VOICE_PREFERENCE.playbackRate
    };
  } catch {
    return DEFAULT_VOICE_PREFERENCE;
  }
}

export function saveVoicePreference(preference: VoicePreference) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
}
