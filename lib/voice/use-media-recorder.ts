"use client";

import { useEffect, useRef, useState } from "react";

type RecorderStatus = "idle" | "ready" | "recording" | "paused" | "stopped" | "error";
type RecorderPermission = "unknown" | "granted" | "denied";

export function useMediaRecorder({
  onChunk,
  mimeType = "audio/webm"
}: {
  onChunk: (blob: Blob) => Promise<void> | void;
  mimeType?: string;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [permission, setPermission] = useState<RecorderPermission>("unknown");
  const [errorMessage, setErrorMessage] = useState("");
  const [chunkCount, setChunkCount] = useState(0);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function ensureRecorder() {
    if (typeof window === "undefined" || !("MediaRecorder" in window)) {
      throw new Error("当前浏览器不支持 MediaRecorder。");
    }

    if (recorderRef.current) {
      return recorderRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined
    });

    recorder.addEventListener("dataavailable", async (event) => {
      if (!event.data || event.data.size === 0) {
        return;
      }

      setChunkCount((count) => count + 1);
      await onChunk(event.data);
    });

    recorder.addEventListener("start", () => setStatus("recording"));
    recorder.addEventListener("pause", () => setStatus("paused"));
    recorder.addEventListener("resume", () => setStatus("recording"));
    recorder.addEventListener("stop", () => setStatus("stopped"));

    streamRef.current = stream;
    recorderRef.current = recorder;
    setPermission("granted");
    setStatus("ready");
    return recorder;
  }

  async function start() {
    try {
      setErrorMessage("");
      const recorder = await ensureRecorder();

      if (recorder.state === "inactive") {
        recorder.start(2000);
      } else if (recorder.state === "paused") {
        recorder.resume();
      }

      return true;
    } catch (error) {
      setStatus("error");
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setPermission("denied");
        setErrorMessage("麦克风权限被拒绝。");
        return false;
      }
      setErrorMessage(error instanceof Error ? error.message : "无法启动录音。");
      return false;
    }
  }

  function pause() {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      recorder.pause();
    }
  }

  function stop() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  function reset() {
    stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setStatus("idle");
    setPermission("unknown");
    setErrorMessage("");
    setChunkCount(0);
  }

  return {
    status,
    permission,
    errorMessage,
    chunkCount,
    start,
    pause,
    stop,
    reset
  };
}
