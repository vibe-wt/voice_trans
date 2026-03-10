"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import {
  ALIYUN_VOICE_OPTIONS,
  DEFAULT_VOICE_PREFERENCE,
  loadVoicePreference,
  saveVoicePreference
} from "@/lib/voice/preferences";

export default function SettingsPage() {
  const [provider, setProvider] = useState("aliyun");
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE_PREFERENCE.voice);
  const [playbackRate, setPlaybackRate] = useState(DEFAULT_VOICE_PREFERENCE.playbackRate);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const preference = loadVoicePreference();
    setSelectedVoice(preference.voice);
    setPlaybackRate(preference.playbackRate);
  }, []);

  function handleSave() {
    saveVoicePreference({
      voice: selectedVoice,
      playbackRate
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.24em] text-muted">Settings</p>
        <h1 className="text-3xl font-semibold">设置</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">实时供应商与音色</h2>
            <p className="mt-1 text-sm text-muted">音色角色会在下一次建立语音连接时生效，当前默认推荐阿里云百炼。</p>
          </div>
          <div className="grid gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input checked={provider === "doubao"} name="provider" onChange={() => setProvider("doubao")} type="radio" />
              豆包 Realtime
            </label>
            <label className="flex items-center gap-2">
              <input checked={provider === "aliyun"} name="provider" onChange={() => setProvider("aliyun")} type="radio" />
              阿里云百炼
            </label>
          </div>
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">对话角色</span>
            <select
              className="w-full rounded-[1rem] border border-border bg-slate-50 px-3 py-2 outline-none transition focus:border-accent"
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
            <span className="font-medium text-foreground">对话语速 {playbackRate.toFixed(2)}x</span>
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
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} variant="secondary">
              保存偏好
            </Button>
            {saved ? <span className="text-sm text-muted">已保存</span> : null}
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">隐私与日历桥接</h2>
            <p className="mt-1 text-sm text-muted">
              会话录音、转写、日记与安排会被存储，MVP 默认使用 ICS 单次导出桥接 Apple Calendar。
            </p>
          </div>
          <ul className="space-y-2 text-sm text-muted">
            <li>支持删除单次会话及关联数据</li>
            <li>后续预留 ICS Feed 与 Shortcuts</li>
            <li>所有密钥与 provider 鉴权只保留在服务端</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
