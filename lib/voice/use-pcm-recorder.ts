"use client";

import { useEffect, useRef, useState } from "react";

type RecorderStatus = "idle" | "ready" | "recording" | "paused" | "stopped" | "error";
type RecorderPermission = "unknown" | "granted" | "denied";

interface PcmRecorderOptions {
  onChunk: (chunk: ArrayBuffer) => Promise<void> | void;
  targetSampleRate?: number;
  chunkDurationMs?: number;
}

export function usePcmRecorder({
  onChunk,
  targetSampleRate = 16000,
  chunkDurationMs = 1000
}: PcmRecorderOptions) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const bufferedSamplesRef = useRef<Float32Array[]>([]);
  const bufferedLengthRef = useRef(0);
  const pausedRef = useRef(false);

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [permission, setPermission] = useState<RecorderPermission>("unknown");
  const [errorMessage, setErrorMessage] = useState("");
  const [chunkCount, setChunkCount] = useState(0);
  const [captureEngine, setCaptureEngine] = useState<"audio-worklet" | "script-processor">(
    "audio-worklet"
  );

  useEffect(() => {
    return () => {
      void teardown();
    };
  }, []);

  function isSupported() {
    return typeof window !== "undefined" && "AudioContext" in window && "mediaDevices" in navigator;
  }

  async function ensureRecorder() {
    if (!isSupported()) {
      throw new Error("当前浏览器不支持 PCM 录音链路。");
    }

    if (audioContextRef.current && sourceRef.current && (workletNodeRef.current || processorRef.current)) {
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("当前浏览器不支持 AudioContext。");
    }

    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);

    streamRef.current = stream;
    audioContextRef.current = audioContext;
    sourceRef.current = source;

    const workletReady = await setupAudioWorklet(audioContext, source);
    if (!workletReady) {
      setupScriptProcessor(audioContext, source);
    }

    setPermission("granted");
    setStatus("ready");
  }

  async function start() {
    try {
      setErrorMessage("");
      await ensureRecorder();

      pausedRef.current = false;
      if (audioContextRef.current?.state === "suspended") {
        await audioContextRef.current.resume();
      }

      setStatus("recording");
      return true;
    } catch (error) {
      setStatus("error");
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setPermission("denied");
        setErrorMessage("麦克风权限被拒绝。");
        return false;
      }
      setErrorMessage(error instanceof Error ? error.message : "无法启动 PCM 录音。");
      return false;
    }
  }

  function pause() {
    pausedRef.current = true;
    setStatus("paused");
  }

  async function stop() {
    pausedRef.current = true;
    const sourceRate = audioContextRef.current?.sampleRate;
    if (sourceRate && bufferedLengthRef.current > 0) {
      await flush(sourceRate);
    }
    setStatus("stopped");
  }

  async function reset() {
    await teardown();
    bufferedSamplesRef.current = [];
    bufferedLengthRef.current = 0;
    pausedRef.current = false;
    setStatus("idle");
    setPermission("unknown");
    setErrorMessage("");
    setChunkCount(0);
    setCaptureEngine("audio-worklet");
  }

  async function flush(sourceSampleRate: number) {
    if (bufferedLengthRef.current === 0) {
      return;
    }

    const merged = mergeFloat32Chunks(bufferedSamplesRef.current, bufferedLengthRef.current);
    bufferedSamplesRef.current = [];
    bufferedLengthRef.current = 0;

    const resampled = resampleFloat32(merged, sourceSampleRate, targetSampleRate);
    const pcm16Buffer = float32ToPcm16(resampled);

    setChunkCount((count) => count + 1);
    await onChunk(pcm16Buffer);
  }

  async function handleAudioSamples(channelData: Float32Array) {
    if (pausedRef.current) {
      return;
    }

    const copy = new Float32Array(channelData.length);
    copy.set(channelData);
    bufferedSamplesRef.current.push(copy);
    bufferedLengthRef.current += copy.length;

    const sourceRate = audioContextRef.current?.sampleRate;
    if (!sourceRate) {
      return;
    }

    const flushInputLength = Math.floor((sourceRate * chunkDurationMs) / 1000);
    if (bufferedLengthRef.current >= flushInputLength) {
      await flush(sourceRate);
    }
  }

  async function setupAudioWorklet(audioContext: AudioContext, source: MediaStreamAudioSourceNode) {
    if (!("audioWorklet" in audioContext)) {
      return false;
    }

    try {
      await audioContext.audioWorklet.addModule("/audio/pcm-recorder-worklet.js");
      const workletNode = new AudioWorkletNode(audioContext, "pcm-recorder-worklet", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1]
      });

      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        void handleAudioSamples(event.data);
      };

      source.connect(workletNode);

      // Connect through a zero-gain node so the worklet stays active without audible loopback.
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      workletNode.connect(silentGain);
      silentGain.connect(audioContext.destination);

      workletNodeRef.current = workletNode;
      setCaptureEngine("audio-worklet");
      return true;
    } catch {
      return false;
    }
  }

  function setupScriptProcessor(audioContext: AudioContext, source: MediaStreamAudioSourceNode) {
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      void handleAudioSamples(event.inputBuffer.getChannelData(0));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
    processorRef.current = processor;
    setCaptureEngine("script-processor");
  }

  async function teardown() {
    workletNodeRef.current?.disconnect();
    workletNodeRef.current?.port.close();
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    workletNodeRef.current = null;
    processorRef.current = null;
    sourceRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }

  return {
    status,
    permission,
    errorMessage,
    chunkCount,
    captureEngine,
    isSupported: isSupported(),
    start,
    pause,
    stop,
    reset
  };
}

function mergeFloat32Chunks(chunks: Float32Array[], totalLength: number) {
  const merged = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function resampleFloat32(input: Float32Array, sourceRate: number, targetRate: number) {
  if (sourceRate === targetRate) {
    return input;
  }

  const ratio = sourceRate / targetRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const weight = position - left;
    output[index] = input[left] * (1 - weight) + input[right] * weight;
  }

  return output;
}

function float32ToPcm16(input: Float32Array) {
  const output = new ArrayBuffer(input.length * 2);
  const view = new DataView(output);

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return output;
}
