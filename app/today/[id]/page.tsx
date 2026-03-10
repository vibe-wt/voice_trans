import { notFound } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { getViewerContext } from "@/lib/auth";
import { getJournalBySessionId } from "@/lib/repositories/session-repository";

interface TodayPageProps {
  params: Promise<{ id: string }>;
}

export default async function TodayPage({ params }: TodayPageProps) {
  const { id } = await params;
  const viewer = await getViewerContext();
  const journal = await getJournalBySessionId(id, viewer.user?.id);

  if (!journal) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.24em] text-muted">Today Journal</p>
        <h1 className="text-3xl font-semibold">{journal.title}</h1>
        <p className="text-sm text-muted">情绪：{journal.mood ?? "未标注"}</p>
      </div>

      <Panel className="space-y-4">
        <article className="prose prose-slate max-w-none whitespace-pre-wrap text-sm leading-7">
          {journal.markdown}
        </article>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <h2 className="mb-3 text-lg font-semibold">关键事件</h2>
          <ul className="space-y-2 text-sm text-muted">
            {journal.events.map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <h2 className="mb-3 text-lg font-semibold">灵感与问题</h2>
          <ul className="space-y-2 text-sm text-muted">
            {[...journal.ideas, ...journal.problems].map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
