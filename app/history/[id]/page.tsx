import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteSessionButton } from "@/components/history/delete-session-button";
import { Panel } from "@/components/ui/panel";
import { getViewerContext } from "@/lib/auth";
import { getJournalBySessionId, getTasksBySessionId, getTranscriptBySessionId } from "@/lib/repositories/session-repository";

interface HistoryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function HistoryDetailPage({ params }: HistoryDetailPageProps) {
  const viewer = await getViewerContext();
  const { id } = await params;
  const [journal, tasks, transcript] = await Promise.all([
    getJournalBySessionId(id, viewer.user?.id),
    getTasksBySessionId(id, viewer.user?.id),
    getTranscriptBySessionId(id, viewer.user?.id)
  ]);

  if (!journal && !tasks.length && !transcript.length) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.24em] text-muted">History Detail</p>
          <h1 className="text-3xl font-semibold">{journal?.title ?? "会话详情"}</h1>
          <p className="text-sm text-muted">查看原始 transcript、摘要结果和删除操作。</p>
        </div>
        <DeleteSessionButton redirectTo="/history" sessionId={id} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="space-y-3">
          <h2 className="text-lg font-semibold">摘要入口</h2>
          <div className="flex flex-col gap-2 text-sm font-medium text-accent">
            <Link href={`/today/${id}`}>打开今日日记</Link>
            <Link href={`/tomorrow/${id}`}>打开明日安排</Link>
          </div>
        </Panel>
        <Panel className="space-y-3">
          <h2 className="text-lg font-semibold">明日候选事项</h2>
          <ul className="space-y-2 text-sm text-muted">
            {tasks.length ? tasks.map((task) => <li key={task.id}>{task.title}</li>) : <li>暂无候选事项</li>}
          </ul>
        </Panel>
      </div>

      <Panel className="space-y-4">
        <h2 className="text-lg font-semibold">原始 Transcript</h2>
        <div className="space-y-3 rounded-[1.4rem] border border-border bg-slate-950 p-4 text-slate-100">
          {transcript.length ? (
            transcript.map((segment) => (
              <div key={segment.id} className="space-y-1">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  {segment.seq}. {segment.role}
                </p>
                <p className="text-sm leading-6">{segment.content}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">当前会话还没有 transcript 片段。</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
