import Link from "next/link";
import { ArrowRight, CalendarClock, Mic, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

const highlights = [
  {
    title: "连续语音陪聊",
    description: "移动场景优先，面向通勤、开车和运动中的低打断语音交互。",
    icon: Mic
  },
  {
    title: "结构化日记沉淀",
    description: "会话结束后生成今日日记、关键想法、情绪、问题和灵感。",
    icon: ScrollText
  },
  {
    title: "明日安排与日历桥接",
    description: "提取候选事件，确认后导出 ICS 接入 Apple Calendar。",
    icon: CalendarClock
  }
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-[2rem] border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-panel md:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-5">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-200/80">Voice-First MVP</p>
          <h1 className="max-w-xl text-4xl font-semibold leading-tight md:text-5xl">
            AI 语音日记与明日安排助手
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-300">
            在连续语音对话结束后，自动沉淀今日日记、明日安排和可导入苹果日历的候选事件。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/voice">
                进入语音页
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/history">查看历史</Link>
            </Button>
          </div>
        </div>
        <Panel className="bg-white/8 text-slate-50">
          <div className="space-y-3">
            <p className="text-sm text-sky-200">当前骨架包含</p>
            <ul className="space-y-2 text-sm text-slate-200">
              <li>实时语音页与状态面板</li>
              <li>总结页与明日安排页</li>
              <li>Supabase 数据模型与 API 占位</li>
              <li>Provider adapter 抽象</li>
            </ul>
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {highlights.map(({ title, description, icon: Icon }) => (
          <Panel key={title} className="space-y-4">
            <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Icon className="size-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="text-sm leading-6 text-muted">{description}</p>
            </div>
          </Panel>
        ))}
      </section>
    </div>
  );
}
