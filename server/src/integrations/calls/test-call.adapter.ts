import { randomUUID } from 'node:crypto';
import type { CallProvider, CallSetup } from './call-provider.js';

/** Development calling service: makes made-up connection values and carries no voice. Refused in production. */
export class TestCallAdapter implements CallProvider {
  readonly provider = 'test';

  async createCall(callId: string, callerId: string): Promise<CallSetup> {
    const room = `test-room-${callId}`;
    return { providerRef: room, callerConnection: await this.joinCall(room, callerId) };
  }

  async joinCall(room: string, userId: string): Promise<Record<string, unknown>> {
    return { provider: 'test', room, token: `t-${randomUUID()}`, userId };
  }

  async endCall(): Promise<void> {}
}
