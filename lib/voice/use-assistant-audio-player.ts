"use client";

import { useEffect, useRef, useState } from "react";

interface AssistantAudioPlayerOptions {
  sampleRate?: number;
}

export function useAssistantAudioPlayer({
  sampleRate = 24000
}: AssistantAudioPlayerOptions = {}) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  async function enqueueBase64Chunks(chunks: string[]) {
    if (!chunks.length || isMuted) {
      return;
    }

    try {
      setErrorMessage("");
      const context = await ensureAudioContext();

      for (const chunk of chunks) {
        const pcmSamples = decodePcm16Base64(chunk);
        const source = context.createBufferSource();
        const audioBuffer = context.createBuffer(1, pcmSamples.length, sampleRate);
        const channel = audioBuffer.getChannelData(0);
        channel.set(pcmSamples);
        source.buffer = audioBuffer;
        source.playbackRate.value = playbackRate;
        source.connect(context.destination);

        const startAt = Math.max(context.currentTime, nextStartTimeRef.current);
        nextStartTimeRef.current = startAt + audioBuffer.duration;
        activeSourcesRef.current += 1;
        setIsPlaying(true);

        source.addEventListener("ended", () => {
          activeSourcesRef.current = Math.max(0, activeSourcesRef.current - 1);
          if (activeSourcesRef.current === 0) {
            setIsPlaying(false);
            nextStartTimeRef.current = context.currentTime;
          }
        });

        source.start(startAt);
      }
    } catch (error) {
      setIsPlaying(false);
      setErrorMessage(error instanceof Error ? error.message : "助手音频播放失败。");
    }
  }

  async function ensureAudioContext() {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("当前浏览器不支持 AudioContext 播放。");
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass({ sampleRate });
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }

  function toggleMute() {
    setIsMuted((value) => {
      const nextValue = !value;

      if (nextValue) {
        activeSourcesRef.current = 0;
        nextStartTimeRef.current = audioContextRef.current?.currentTime ?? 0;
        setIsPlaying(false);
      }

      if (audioContextRef.current) {
        if (nextValue) {
          void audioContextRef.current.suspend();
        } else {
          void audioContextRef.current.resume();
        }
      }

      return nextValue;
    });
  }

  return {
    isPlaying,
    isMuted,
    errorMessage,
    playbackRate,
    setPlaybackRate,
    enqueueBase64Chunks,
    toggleMute
  };
}

function decodePcm16Base64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const view = new DataView(bytes.buffer);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const output = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    output[index] = view.getInt16(index * 2, true) / 0x8000;
  }

  return output;
}
