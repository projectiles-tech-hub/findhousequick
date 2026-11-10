/**
 * The calling service for voice calls inside the app (decision 44). Each service (Agora, Twilio Voice, Daily and so
 * on) gets its own adapter, so the rest of the server never depends on which one is used. The server only sets a
 * call up and ends it; the voice itself flows between the apps and the calling service, so phone numbers are never
 * involved.
 */
export interface CallSetup {
  /** The service's own reference for the call. */
  providerRef: string;
  /** What the caller's app passes to the service's software to join the call. Short-lived. */
  callerConnection: Record<string, unknown>;
}

export interface CallProvider {
  readonly provider: string;
  /** Prepares a call between two users. */
  createCall(callId: string, callerId: string, calleeId: string): Promise<CallSetup>;
  /** What another user's app passes to the service to join an open call (the person answering). Short-lived. */
  joinCall(providerRef: string, userId: string): Promise<Record<string, unknown>>;
  /** Closes the call at the service, if it is still open. Closing a closed call is not an error. */
  endCall(providerRef: string): Promise<void>;
}

export const CALL_PROVIDER = Symbol('CALL_PROVIDER');
