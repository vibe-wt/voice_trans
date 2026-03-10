import Link from "next/link";
import { DeleteSessionButton } from "@/components/history/delete-session-button";
import { Panel } from "@/components/ui/panel";
import { getViewerContext } from "@/lib/auth";
import { listSessions } from "@/lib/repositories/session-repository";

export default async function HistoryPage() {
  const viewer = await getViewerContext();
  const sessions = await listSessions(viewer.user?.id);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.24em] text-muted">History</p>
        <h1 className="text-3xl font-semibold">最近会话</h1>
      </div>

      <div className="grid gap-4">
        {sessions.map((session) => (
          <Panel key={session.id} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{session.title}</h2>
              <p className="text-sm text-muted">
                {session.date} | {session.provider} | {session.status}
              </p>
            </div>
            <div className="flex gap-3 text-sm font-medium text-accent">
              <Link href={`/history/${session.id}`}>Transcript</Link>
              <Link href={`/today/${session.id}`}>今日日记</Link>
              <Link href={`/tomorrow/${session.id}`}>明日安排</Link>
            </div>
            <DeleteSessionButton sessionId={session.id} />
          </Panel>
        ))}
      </div>
    </div>
  );
}
