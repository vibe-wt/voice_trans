import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  REALTIME_PROVIDER: z.enum(["aliyun", "doubao"]).default("doubao"),
  DOUBAO_API_KEY: z.string().optional(),
  DOUBAO_REALTIME_URL: z.string().url().optional(),
  ALIYUN_API_KEY: z.string().optional(),
  ALIYUN_REALTIME_URL: z.string().url().optional(),
  ALIYUN_REALTIME_MODEL: z.string().default("qwen3-omni-flash-realtime"),
  ALIYUN_REALTIME_VOICE: z.string().default("Cherry"),
  LIVEKIT_WS_URL: z.string().url().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  LIVEKIT_ROOM_PREFIX: z.string().default("voice-session"),
  LIVEKIT_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  SUMMARY_MODEL: z.string().optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000")
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  REALTIME_PROVIDER: process.env.REALTIME_PROVIDER,
  DOUBAO_API_KEY: process.env.DOUBAO_API_KEY,
  DOUBAO_REALTIME_URL: process.env.DOUBAO_REALTIME_URL,
  ALIYUN_API_KEY: process.env.ALIYUN_API_KEY,
  ALIYUN_REALTIME_URL: process.env.ALIYUN_REALTIME_URL,
  ALIYUN_REALTIME_MODEL: process.env.ALIYUN_REALTIME_MODEL,
  ALIYUN_REALTIME_VOICE: process.env.ALIYUN_REALTIME_VOICE,
  LIVEKIT_WS_URL: process.env.LIVEKIT_WS_URL,
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
  LIVEKIT_ROOM_PREFIX: process.env.LIVEKIT_ROOM_PREFIX,
  LIVEKIT_TOKEN_TTL_MINUTES: process.env.LIVEKIT_TOKEN_TTL_MINUTES,
  SUMMARY_MODEL: process.env.SUMMARY_MODEL,
  APP_BASE_URL: process.env.APP_BASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
});
