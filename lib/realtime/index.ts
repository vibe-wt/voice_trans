import { env } from "@/lib/env";
import { AliyunRealtimeAdapter } from "@/lib/realtime/adapters/aliyun";
import { DoubaoRealtimeAdapter } from "@/lib/realtime/adapters/doubao";
import type { ProviderGatewayInfo, RealtimeAdapter, RealtimeAdapterConfig } from "@/lib/realtime/types";
import type { Provider } from "@/types/provider";

export function createRealtimeAdapter(
  config: RealtimeAdapterConfig = {
    provider: env.REALTIME_PROVIDER,
    sessionId: "",
    userId: "demo-user"
  }
): RealtimeAdapter {
  const provider = config.provider;

  if (provider === "aliyun") {
    return new AliyunRealtimeAdapter({
      ...config,
      endpoint: config.endpoint ?? env.ALIYUN_REALTIME_URL,
      apiKey: config.apiKey ?? env.ALIYUN_API_KEY,
      model: config.model ?? env.ALIYUN_REALTIME_MODEL,
      voice: config.voice ?? env.ALIYUN_REALTIME_VOICE
    });
  }

  return new DoubaoRealtimeAdapter({
    ...config,
    endpoint: config.endpoint ?? env.DOUBAO_REALTIME_URL,
    apiKey: config.apiKey ?? env.DOUBAO_API_KEY
  });
}

export function getProviderGatewayInfo(
  provider: Provider,
  sessionId: string,
  userId: string
): ProviderGatewayInfo {
  const endpoint = provider === "aliyun" ? env.ALIYUN_REALTIME_URL : env.DOUBAO_REALTIME_URL;
  const apiKey = provider === "aliyun" ? env.ALIYUN_API_KEY : env.DOUBAO_API_KEY;

  return {
    provider,
    sessionId,
    transport: endpoint && apiKey ? "provider_websocket" : "mock",
    endpoint: endpoint || undefined
  };
}
