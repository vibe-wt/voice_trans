import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";

const payloadSchema = z.object({
  sessionId: z.string().min(1)
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return apiError("Invalid shortcuts payload.");
  }

  return apiOk({
    sessionId: parsed.data.sessionId,
    status: "not_implemented",
    target: "apple-shortcuts"
  });
}
