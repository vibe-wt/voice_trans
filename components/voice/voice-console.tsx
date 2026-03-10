"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Mic, Pause, PhoneOff, Send, ShieldAlert, Volume2, VolumeX, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { BrowserVoiceSessionClient } from "@/lib/voice/browser-session";
import {
  ALIYUN_VOICE_OPTIONS,
  loadVoicePreference,
  saveVoicePreference
} from "@/lib/voice/preferences";
import { useAssistantAudioPlayer } from "@/lib/voice/use-assistant-audio-player";
import { clearVoiceDraft, loadVoiceDraft, saveVoiceDraft } from "@/lib/voice/draft-store";
import { useMediaRecorder } from "@/lib/voice/use-media-recorder";
import { usePcmRecorder } from "@/lib/voice/use-pcm-recorder";

type VoiceStatus = "idle" | "connecting" | "listening" | "waiting" | "speaking" | "processing" | "error";

export function VoiceConsole() {
  const clientRef = useRef<BrowserVoiceSessionClient>(new BrowserVoiceSessionClient());
  const pollingRef = useRef<number | null>(null);
  const pollingInFlightRef = useRef(false);
  const transcriptLengthRef = useRef(0);
  const assistantReplyRef = useRef("");
  const assistantAudioChunkCountRef = useRef(0);
  const [provider, setProvider] = useState<string | null>(null);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transport, setTransport] = useState<"mock" | "provider_websocket" | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [spokenText, setSpokenText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [audioChunkCount, setAudioChunkCount] = useState(0);
  const [audioNote, setAudioNote] = useState("");
  const [audioMode, setAudioMode] = useState<"pcm16" | "mediarecorder">("mediarecorder");
  const [selectedVoice, setSelectedVoice] = useState("Cherry");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [assistantReply, setAssistantReply] = useState("");
  const [assistantAudioChunkCount, setAssistantAudioChunkCount] = useState(0);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [persistDraft, setPersistDraft] = useState(false);
  const [finalizeAttempts, setFinalizeAttempts] = useState(0);
  const [result, setResult] = useState<{
    sessionId: string;
    candidateCount: number;
  } | null>(null);
  const assistantPlayer = useAssistantAudioPlayer();

  useEffect(() => {
    const preference = loadVoicePreference();
    setSelectedVoice(preference.voice);
    setPlaybackRate(preference.playbackRate);
    assistantPlayer.setPlaybackRate(preference.playbackRate);
    // mount only: restore locally persisted conversation prefs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    assistantPlayer.setPlaybackRate(playbackRate);
    saveVoicePreference({
      voice: selectedVoice,
      playbackRate
    });
    // keep playback speed and voice choice persisted locally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackRate, selectedVoice]);

  const recorder = useMediaRecorder({
    onChunk: async (blob) => {
      const response = await clientRef.current.submitAudioChunk(blob);
      await applyRealtimeUpdate(
        {
          ...response,
          uploadedAudioChunks: response.uploadedAudioChunks
        },
        "audio_chunk"
      );
      setPersistDraft(true);
      setFinalizeAttempts(0);
    }
  });
  const pcmRecorder = usePcmRecorder({
    onChunk: async (chunk) => {
      const response = await clientRef.current.submitAudioChunk(chunk);
      await applyRealtimeUpdate(
        {
          ...response,
          uploadedAudioChunks: response.uploadedAudioChunks
        },
        "audio_chunk"
      );
      setPersistDraft(true);
      setFinalizeAttempts(0);
    }
  });

  const canSubmitLine = useMemo(
    () => sessionId !== null && spokenText.trim().length > 0 && status !== "processing",
    [sessionId, spokenText, status]
  );
  const canFinalize = status !== "processing" && (transcript.length > 0 || audioChunkCount > 0);

  useEffect(() => {
    transcriptLengthRef.current = transcript.length;
    assistantReplyRef.current = assistantReply;
    assistantAudioChunkCountRef.current = assistantAudioChunkCount;
  }, [transcript.length, assistantReply, assistantAudioChunkCount]);

  useEffect(() => {
    if (status === "speaking" && !assistantPlayer.isPlaying) {
      const timer = window.setTimeout(() => {
        setStatus((current) => (current === "speaking" ? "idle" : current));
        setAudioNote((current) =>
          current || assistantReplyRef.current ? "助手已说完，可以开始下一轮。" : current
        );
      }, 280);

      return () => window.clearTimeout(timer);
    }
  }, [assistantPlayer.isPlaying, status]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  useEffect(() => {
    const draft = loadVoiceDraft();
    if (!draft || !draft.sessionId) {
      return;
    }

    clientRef.current.hydrateDraft({
      sessionId: draft.sessionId,
      transcript: draft.transcript,
      uploadedAudioChunks: draft.audioChunkCount
    });
    setSessionId(draft.sessionId);
    setProvider(draft.provider);
    setTransport(draft.transport);
    setTranscript(draft.transcript);
    setSpokenText(draft.spokenText);
    setAudioChunkCount(draft.audioChunkCount);
    setAudioNote(draft.audioNote);
    setAudioMode(draft.provider === "aliyun" && pcmRecorder.isSupported ? "pcm16" : "mediarecorder");
    setAssistantReply(clientRef.current.getAssistantReply());
    setAssistantAudioChunkCount(clientRef.current.getAssistantAudioChunkCount());
    setDraftRecovered(true);
    setPersistDraft(true);
  }, [pcmRecorder.isSupported]);

  useEffect(() => {
    if (!persistDraft) {
      clearVoiceDraft();
      return;
    }

    if (!sessionId && transcript.length === 0 && audioChunkCount === 0 && !spokenText) {
      clearVoiceDraft();
      return;
    }

    saveVoiceDraft({
      sessionId,
      provider,
      transport,
      transcript,
      spokenText,
      audioChunkCount,
      audioNote
    });
  }, [persistDraft, sessionId, provider, transport, transcript, spokenText, audioChunkCount, audioNote]);

  async function handleStart() {
    try {
      setErrorMessage("");
      setResult(null);
      setDraftRecovered(false);
      setPersistDraft(true);
      setStatus("connecting");
      const session = await clientRef.current.start({
        voice: selectedVoice
      });
      setSessionId(session.sessionId);
      setProvider(session.provider);
      setTransport(session.transport);
      setAudioMode(session.provider === "aliyun" && pcmRecorder.isSupported ? "pcm16" : "mediarecorder");
      startPolling();
      setStatus("idle");
      setAudioNote("已连接。点击开始录音后，说完一句停顿一下，助手会自动接话。");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "启动会话失败。");
    }
  }

  async function handleSubmitLine() {
    try {
      setErrorMessage("");
      const response = await clientRef.current.submitText(spokenText.trim());
      await applyRealtimeUpdate(response, "text_fallback");
      setSpokenText("");
      setPersistDraft(true);
      setFinalizeAttempts(0);
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "发送语音内容失败。");
    }
  }

  async function handleStartRecording() {
    if (!sessionId) {
      setErrorMessage("请先开始连接，再启动录音。");
      return;
    }

    setErrorMessage("");
    const started =
      audioMode === "pcm16" ? await pcmRecorder.start() : await recorder.start();
    if (started) {
      startPolling();
      setStatus("listening");
      setAudioNote("正在聆听。说完一句后停顿 1 到 2 秒，助手会自动回复。");
    } else {
      setStatus("error");
    }
  }

  function handlePauseRecording() {
    if (audioMode === "pcm16") {
      pcmRecorder.pause();
    } else {
      recorder.pause();
    }
    setStatus("waiting");
    setAudioNote("已暂停录音。可以继续录音，或等待当前回合处理完成。");
  }

  async function handleStopRecording() {
    if (audioMode === "pcm16") {
      await pcmRecorder.stop();
    } else {
      recorder.stop();
    }
    startPolling();
    setAudioNote("已停止本地录音，继续等待服务端 VAD 结束本轮并返回助手语音。");
    setStatus("waiting");
  }

  async function handleFinalize() {
    try {
      setErrorMessage("");
      setStatus("processing");
      const payload = await clientRef.current.finalize();
      setResult({
        sessionId: payload.sessionId,
        candidateCount: payload.candidateEvents.length
      });
      stopPolling();
      setPersistDraft(false);
      clearVoiceDraft();
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setFinalizeAttempts((attempts) => attempts + 1);
      setErrorMessage(error instanceof Error ? error.message : "整理会话失败。");
    }
  }

  function handleReset() {
    stopPolling();
    recorder.reset();
    void pcmRecorder.reset();
    clientRef.current.reset();
    setStatus("idle");
    setSessionId(null);
    setTransport(null);
    setProvider(null);
    setTranscript([]);
    setSpokenText("");
    setAudioChunkCount(0);
    setAudioNote("");
    setAssistantReply("");
    setAssistantAudioChunkCount(0);
    setDraftRecovered(false);
    setPersistDraft(false);
    setFinalizeAttempts(0);
    setResult(null);
    setErrorMessage("");
    clearVoiceDraft();
  }

  function startPolling() {
    if (pollingRef.current !== null) {
      return;
    }

    const tick = async () => {
      if (pollingInFlightRef.current) {
        return;
      }

      pollingInFlightRef.current = true;
      try {
        await pollRealtimeEvents();
      } finally {
        pollingInFlightRef.current = false;
      }
    };

    void tick();
    pollingRef.current = window.setInterval(() => {
      void tick();
    }, 1100);
  }

  function stopPolling() {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    pollingInFlightRef.current = false;
  }

  async function pollRealtimeEvents() {
    if (!clientRef.current.getSessionId()) {
      return;
    }

    try {
      const response = await clientRef.current.pollRealtimeEvents();
      if (
        response.transcript.length === transcriptLengthRef.current &&
        response.assistantAudioChunkCount === assistantAudioChunkCountRef.current &&
        response.assistantReply === assistantReplyRef.current &&
        response.assistantAudioChunks.length === 0
      ) {
        return;
      }

      await applyRealtimeUpdate(response, "poll");
    } catch (error) {
      stopPolling();
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "拉取实时事件失败。");
    }
  }

  async function applyRealtimeUpdate(
    response: {
      transport: "mock" | "provider_websocket";
      transcript: Array<{ role: "user" | "assistant"; content: string }>;
      assistantReply: string;
      assistantAudioChunkCount: number;
      assistantAudioChunks: string[];
      uploadedAudioChunks?: number;
    },
    source: "audio_chunk" | "poll" | "text_fallback"
  ) {
    const hadAssistantReply = assistantReplyRef.current;
    const previousAssistantAudioChunkCount = assistantAudioChunkCountRef.current;
    const hasNewAssistantText = response.assistantReply !== hadAssistantReply && response.assistantReply.length > 0;
    const hasNewAssistantAudio = response.assistantAudioChunkCount > previousAssistantAudioChunkCount;

    setTransport(response.transport);
    setTranscript(response.transcript);
    setAssistantReply(response.assistantReply);
    setAssistantAudioChunkCount(response.assistantAudioChunkCount);

    if (typeof response.uploadedAudioChunks === "number") {
      setAudioChunkCount(response.uploadedAudioChunks);
    }

    await assistantPlayer.enqueueBase64Chunks(response.assistantAudioChunks);

    if (hasNewAssistantText || hasNewAssistantAudio) {
      setStatus("speaking");
      setAudioNote(
        hasNewAssistantAudio ? "助手正在回复语音，字幕会同步更新。" : "助手正在回复，字幕已更新。"
      );
      return;
    }

    if (source === "audio_chunk") {
      setStatus("listening");
      setAudioNote(
        response.transport === "mock"
          ? "音频片段已上传，当前仍需真实 provider 才能得到自动转写。"
          : "正在聆听。说完一句后停顿一下，等待助手接话。"
      );
      return;
    }

    if (source === "text_fallback") {
      setStatus(response.assistantReply ? "speaking" : "idle");
      setAudioNote("文本 fallback 已提交，当前回合已更新。");
      return;
    }

    setStatus((current) =>
      current === "listening" || current === "processing" || current === "error" ? current : "waiting"
    );
    setAudioNote("等待当前回合结束或下一段助手回复。");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Panel className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.24em] text-muted">Realtime Session</p>
          <h1 className="text-3xl font-semibold">语音会话</h1>
          <p className="text-sm text-muted">MVP 目标是低打断语音输入、清晰状态反馈和会话结束后的快速总结。</p>
        </div>

        <div className="grid gap-3 rounded-[1.5rem] border border-border bg-slate-50 p-4 md:grid-cols-3">
          <StatusPill
            icon={Waves}
            label="连接状态"
            value={
              status === "connecting"
                ? "连接中"
                : sessionId
                  ? transport === "mock"
                    ? "Demo 网关"
                    : "Provider 已连接"
                  : "待连接"
            }
          />
          <StatusPill
            icon={Mic}
            label="录音状态"
            value={
              status === "processing"
                ? "处理中"
                : status === "listening" || currentRecorderStatus(audioMode, pcmRecorder.status, recorder.status) === "recording"
                  ? "录音中"
                  : status === "waiting"
                    ? "等待回合结束"
                    : currentRecorderStatus(audioMode, pcmRecorder.status, recorder.status) === "paused"
                    ? "已暂停"
                    : currentRecorderStatus(audioMode, pcmRecorder.status, recorder.status) === "stopped"
                      ? "已停止"
                      : "未开始"
            }
          />
          <StatusPill
            icon={status === "error" ? ShieldAlert : LoaderCircle}
            label="AI 状态"
            value={
              status === "processing"
                ? "总结中"
                : status === "speaking" || assistantPlayer.isPlaying
                  ? "播放中"
                  : status === "listening"
                    ? "聆听中"
                    : status === "waiting"
                      ? "等待回复"
                      : assistantReply
                        ? "已回复"
                        : "待命"
            }
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button disabled={status === "connecting" || sessionId !== null} onClick={handleStart}>
            开始连接
          </Button>
          <Button
            disabled={
              !sessionId ||
              currentRecorderStatus(audioMode, pcmRecorder.status, recorder.status) === "recording" ||
              status === "waiting" ||
              status === "speaking"
            }
            onClick={handleStartRecording}
            variant="secondary"
          >
            <Mic className="size-4" />
            开始录音
          </Button>
          <Button
            disabled={currentRecorderStatus(audioMode, pcmRecorder.status, recorder.status) !== "recording"}
            onClick={handlePauseRecording}
            variant="ghost"
          >
            <Pause className="size-4" />
            暂停
          </Button>
          <Button
            disabled={!["recording", "paused"].includes(currentRecorderStatus(audioMode, pcmRecorder.status, recorder.status))}
            onClick={handleStopRecording}
            variant="ghost"
          >
            <PhoneOff className="size-4" />
            停止录音
          </Button>
          <Button disabled={!canFinalize} onClick={handleFinalize} variant="secondary">
            <PhoneOff className="size-4" />
            结束并整理
          </Button>
          <Button onClick={handleReset} variant="secondary">
            重置
          </Button>
          {status === "error" && canFinalize ? (
            <Button onClick={handleFinalize} variant="ghost">
              重试整理
            </Button>
          ) : null}
        </div>

        {draftRecovered ? (
          <Panel className="border-accent/20 bg-accent/5">
            <p className="text-sm text-foreground">
              已恢复上一次未完成的会话草稿。你可以继续补充 transcript，或直接重新整理。
            </p>
          </Panel>
        ) : null}

        <div className="space-y-3 rounded-[1.5rem] border border-border bg-white p-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">对话角色</h2>
            <p className="text-sm text-muted">切换助手音色，并调整当前播放语速。角色会在下一次建立连接时生效。</p>
          </div>
          <div className="grid gap-3 rounded-[1.2rem] bg-slate-50 p-4 md:grid-cols-[1fr_0.9fr]">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">音色角色</span>
              <select
                className="w-full rounded-[1rem] border border-border bg-white px-3 py-2 outline-none transition focus:border-accent"
                onChange={(event) => setSelectedVoice(event.target.value)}
                value={selectedVoice}
              >
                {ALIYUN_VOICE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} · {option.description}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">播放语速 {playbackRate.toFixed(2)}x</span>
              <input
                className="w-full accent-accent"
                max="1.4"
                min="0.8"
                onChange={(event) => setPlaybackRate(Number(event.target.value))}
                step="0.05"
                type="range"
                value={playbackRate}
              />
            </label>
          </div>
          <p className="text-sm text-muted">
            当前角色：{ALIYUN_VOICE_OPTIONS.find((option) => option.value === selectedVoice)?.label ?? selectedVoice}
          </p>
        </div>

        <div className="space-y-3 rounded-[1.5rem] border border-border bg-white p-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">麦克风采集</h2>
            <p className="text-sm text-muted">
              当前会优先使用适配阿里云的 `pcm16` 录音链路；若浏览器不支持，则回退到 `MediaRecorder`。
            </p>
          </div>
          <div className="grid gap-3 rounded-[1.2rem] bg-slate-50 p-4 md:grid-cols-4">
            <Metric
              label="权限"
              value={
                (audioMode === "pcm16" ? pcmRecorder.permission : recorder.permission) === "unknown"
                  ? "待请求"
                  : audioMode === "pcm16"
                    ? pcmRecorder.permission
                    : recorder.permission
              }
            />
            <Metric label="模式" value={audioMode} />
            <Metric label="已上传片段" value={String(audioChunkCount || activeChunkCount(audioMode, pcmRecorder.chunkCount, recorder.chunkCount))} />
            <Metric label="助手音频块" value={String(assistantAudioChunkCount)} />
          </div>
          {activeRecorderError(audioMode, pcmRecorder.errorMessage, recorder.errorMessage) ? (
            <p className="text-sm text-danger">
              {activeRecorderError(audioMode, pcmRecorder.errorMessage, recorder.errorMessage)}
            </p>
          ) : null}
          {assistantPlayer.errorMessage ? (
            <p className="text-sm text-danger">{assistantPlayer.errorMessage}</p>
          ) : null}
          {audioNote ? <p className="text-sm text-muted">{audioNote}</p> : null}
        </div>

        <div className="space-y-3 rounded-[1.5rem] border border-border bg-white p-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">文本 fallback</h2>
            <p className="text-sm text-muted">
              文本输入继续保留，方便在未接真实转写服务时验证 transcript、finalize 和总结链路。
            </p>
          </div>
          <textarea
            className="min-h-28 w-full rounded-[1.2rem] border border-border bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-accent"
            onChange={(event) => setSpokenText(event.target.value)}
            placeholder="例如：今天我推进了需求整理，明天早上要先跟进预算。"
            value={spokenText}
          />
          <div className="flex flex-wrap gap-3">
            <Button disabled={!canSubmitLine} onClick={handleSubmitLine}>
              <Send className="size-4" />
              发送本轮口述
            </Button>
            <span className="self-center text-sm text-muted">
              {sessionId ? `Session: ${sessionId}` : "尚未建立 session"}
            </span>
          </div>
          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
          {finalizeAttempts > 0 ? (
            <p className="text-sm text-muted">整理失败重试次数：{finalizeAttempts}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">实时字幕</h2>
          <div className="space-y-3 rounded-[1.5rem] border border-border bg-slate-950 p-4 text-slate-100">
            {transcript.length ? (
              transcript.map((item, index) => (
                <div key={`${item.role}-${index}`} className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{item.role}</p>
                  <p className="text-sm leading-6">{item.content}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">
                开始连接后，你说话的 transcript 和助手回复都会显示在这里。
              </p>
            )}
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel className="space-y-3">
          <h2 className="text-lg font-semibold">助手回复</h2>
          <div className="flex flex-wrap gap-3">
            <Button onClick={assistantPlayer.toggleMute} variant="secondary">
              {assistantPlayer.isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              {assistantPlayer.isMuted ? "取消静音" : "静音"}
            </Button>
            <span className="self-center text-sm text-muted">
              {assistantPlayer.isPlaying || status === "speaking" ? "正在播放助手语音" : "等待下一轮助手语音"}
            </span>
          </div>
          {assistantReply ? (
            <div className="space-y-2 text-sm text-muted">
              <p className="rounded-[1.2rem] bg-slate-50 p-4 text-foreground">{assistantReply}</p>
              <p>当前会话已收到 {assistantAudioChunkCount} 个助手音频块。</p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              当前是回合式语音对话。你说完一句停顿一下，助手会开始回语音并更新字幕。
            </p>
          )}
        </Panel>

        <Panel className="space-y-3">
          <h2 className="text-lg font-semibold">会后输出</h2>
          {result ? (
            <div className="space-y-3 text-sm text-muted">
              <p>已完成整理，生成了 {result.candidateCount} 个候选日历事件。</p>
              <div className="flex flex-col gap-2">
                <Link className="font-medium text-accent" href={`/today/${result.sessionId}`}>
                  查看今日日记
                </Link>
                <Link className="font-medium text-accent" href={`/tomorrow/${result.sessionId}`}>
                  查看明日安排
                </Link>
              </div>
            </div>
          ) : (
            <ul className="space-y-2 text-sm text-muted">
              <li>今日日记</li>
              <li>明日安排</li>
              <li>候选日历事件</li>
              <li>原始 transcript 分段</li>
            </ul>
          )}
        </Panel>

        <Panel className="space-y-3">
          <h2 className="text-lg font-semibold">异常处理</h2>
          <ul className="space-y-2 text-sm text-muted">
            <li>麦克风权限拒绝</li>
            <li>实时连接中断</li>
            <li>provider 超时</li>
            <li>总结失败后重试</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.2rem] bg-white p-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-accent" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-2 text-sm text-muted">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.24em] text-muted">{label}</p>
      <p className="mt-2 text-sm">{value}</p>
    </div>
  );
}

function currentRecorderStatus(
  audioMode: "pcm16" | "mediarecorder",
  pcmStatus: string,
  mediaStatus: string
) {
  return audioMode === "pcm16" ? pcmStatus : mediaStatus;
}

function activeChunkCount(audioMode: "pcm16" | "mediarecorder", pcmCount: number, mediaCount: number) {
  return audioMode === "pcm16" ? pcmCount : mediaCount;
}

function activeRecorderError(
  audioMode: "pcm16" | "mediarecorder",
  pcmError: string,
  mediaError: string
) {
  return audioMode === "pcm16" ? pcmError : mediaError;
}
