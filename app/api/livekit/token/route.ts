import { randomUUID } from "node:crypto";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { getViewerContext } from "@/lib/auth";
import { env } from "@/lib/env";
import { createLiveKitAccessToken } from "@/lib/livekit/token";

const payloadSchema = z.object({
  sessionId: z.string().min(1),
  participantName: z.string().min(1).max(80).optional(),
  identity: z.string().min(1).max(120).optional()
});

export async function POST(request: Request) {
  const viewer = await getViewerContext();

  if (!viewer.isDemoMode && !viewer.user) {
    return apiError("Authentication required.", 401);
  }

  if (!env.LIVEKIT_WS_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    return apiError("LiveKit is not configured on the server.", 501);
  }

  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return apiError("Invalid LiveKit token payload.");
  }

  const roomName = `${env.LIVEKIT_ROOM_PREFIX}-${parsed.data.sessionId}`;
  const participantIdentity =
    parsed.data.identity ?? `${viewer.user?.id ?? "demo-user"}-${randomUUID()}`;

  const token = createLiveKitAccessToken({
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
    roomName,
    identity: participantIdentity,
    name: parsed.data.participantName ?? "iPhone Voice Client",
    metadata: {
      sessionId: parsed.data.sessionId,
      userId: viewer.user?.id ?? "demo-user",
      source: "ios_app"
    },
    ttlMinutes: env.LIVEKIT_TOKEN_TTL_MINUTES
  });

  return apiOk({
    serverUrl: env.LIVEKIT_WS_URL,
    roomName,
    participantIdentity: token.identity,
    token: token.token,
    expiresAt: token.expiresAt
  });
}
