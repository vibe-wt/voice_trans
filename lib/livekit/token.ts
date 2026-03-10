import { createHmac, randomUUID } from "node:crypto";

interface LiveKitTokenOptions {
  apiKey: string;
  apiSecret: string;
  roomName: string;
  identity?: string;
  name?: string;
  metadata?: Record<string, unknown>;
  ttlMinutes?: number;
}

interface LiveKitGrant {
  room: string;
  roomJoin: true;
  canPublish: true;
  canSubscribe: true;
  canPublishData: true;
}

interface LiveKitAccessTokenPayload {
  iss: string;
  sub: string;
  iat: number;
  nbf: number;
  exp: number;
  name?: string;
  metadata?: string;
  video: LiveKitGrant;
}

export function createLiveKitAccessToken(options: LiveKitTokenOptions) {
  const identity = options.identity ?? `ios-${randomUUID()}`;
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + (options.ttlMinutes ?? 30) * 60;

  const header = {
    alg: "HS256",
    typ: "JWT"
  };

  const payload: LiveKitAccessTokenPayload = {
    iss: options.apiKey,
    sub: identity,
    iat: issuedAt,
    nbf: issuedAt,
    exp: expiresAt,
    video: {
      room: options.roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    }
  };

  if (options.name) {
    payload.name = options.name;
  }

  if (options.metadata) {
    payload.metadata = JSON.stringify(options.metadata);
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", options.apiSecret).update(signingInput).digest("base64url");

  return {
    token: `${signingInput}.${signature}`,
    identity,
    expiresAt: new Date(expiresAt * 1000).toISOString()
  };
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}
