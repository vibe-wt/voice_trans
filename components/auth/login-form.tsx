"use client";

import { useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/db/supabase-browser";
import { Button } from "@/components/ui/button";

export function LoginForm({ isDemoMode }: { isDemoMode: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const canSubmit = useMemo(() => isDemoMode || /\S+@\S+\.\S+/.test(email), [email, isDemoMode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isDemoMode) {
      setStatus("sent");
      setMessage("当前未配置 Supabase，项目以 demo 模式运行。");
      return;
    }

    try {
      setStatus("loading");
      setMessage("");

      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/auth/callback`
        }
      });

      if (error) {
        throw error;
      }

      setStatus("sent");
      setMessage("登录链接已发送，请在邮箱中完成登录。");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "登录请求失败。");
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          邮箱
        </label>
        <input
          id="email"
          className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          type="email"
          value={email}
        />
      </div>

      <Button className="w-full" disabled={!canSubmit || status === "loading"} type="submit">
        {isDemoMode ? "进入 Demo 模式" : status === "loading" ? "发送中..." : "发送登录链接"}
      </Button>

      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </form>
  );
}
