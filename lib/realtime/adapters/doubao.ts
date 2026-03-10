import { BaseRealtimeAdapter } from "@/lib/realtime/adapters/base";
import type { RealtimeAdapterConfig } from "@/lib/realtime/types";

export class DoubaoRealtimeAdapter extends BaseRealtimeAdapter {
  constructor(config: RealtimeAdapterConfig) {
    super(config);
  }

  async connect(_sessionId: string): Promise<void> {
    if (!this.config.endpoint || !this.config.apiKey) {
      return Promise.resolve();
    }

    return Promise.resolve();
  }

  async sendAudioChunk(_chunk: ArrayBuffer): Promise<void> {
    return Promise.resolve();
  }

  async close(): Promise<void> {
    return Promise.resolve();
  }
}
