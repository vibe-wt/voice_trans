import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { getViewerContext } from "@/lib/auth";
import { finalizeVoiceSession } from "@/lib/repositories/session-repository";
import { env } from "@/lib/env";
import { closeManagedSession, getManagedTranscript } from "@/lib/realtime/session-manager";

const finalizeSchema = z.object({
  sessionId: z.string().min(1),
  transcript: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().min(1)
    })
  )
});

export async function POST(request: Request) {
  const viewer = await getViewerContext();
  const json = await request.json().catch(() => null);
  const parsed = finalizeSchema.safeParse(json);

  if (!parsed.success) {
    return apiError("Invalid finalize payload.");
  }

  if (!viewer.isDemoMode && !viewer.user) {
    return apiError("Authentication required.", 401);
  }

  const providerTranscript =
    env.REALTIME_PROVIDER === "aliyun" ? getManagedTranscript(parsed.data.sessionId) : [];
  const transcript = mergeTranscript(parsed.data.transcript, providerTranscript);

  const result = await finalizeVoiceSession({
    sessionId: parsed.data.sessionId,
    userId: viewer.user?.id ?? "demo-user",
    provider: env.REALTIME_PROVIDER,
    transcript
  });

  if (env.REALTIME_PROVIDER === "aliyun") {
    await closeManagedSession(parsed.data.sessionId);
  }

  return apiOk({
    sessionId: parsed.data.sessionId,
    status: result.session.status,
    journal: result.journal,
    candidateEvents: result.tasks
  });
}

function mergeTranscript(
  clientTranscript: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  providerTranscript: Array<{ role: "user" | "assistant"; content: string }>
) {
  const merged = [...clientTranscript];
  const seen = new Set(merged.map((item) => `${item.role}:${item.content}`));

  for (const item of providerTranscript) {
    const key = `${item.role}:${item.content}`;
    if (!seen.has(key)) {
      merged.push(item);
      seen.add(key);
    }
  }

  return merged;
}
