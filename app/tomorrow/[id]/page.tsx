import { notFound } from "next/navigation";
import { getViewerContext } from "@/lib/auth";
import { getTasksBySessionId } from "@/lib/repositories/session-repository";
import { TomorrowExportPanel } from "@/components/tomorrow/tomorrow-export-panel";

interface TomorrowPageProps {
  params: Promise<{ id: string }>;
}

export default async function TomorrowPage({ params }: TomorrowPageProps) {
  const { id } = await params;
  const viewer = await getViewerContext();
  const tasks = await getTasksBySessionId(id, viewer.user?.id);

  if (!tasks.length) {
    notFound();
  }

  return <TomorrowExportPanel sessionId={id} tasks={tasks} />;
}
