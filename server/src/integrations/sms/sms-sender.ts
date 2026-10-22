/**
 * Sends text messages. Each SMS company (Termii, Twilio and so on) gets its own adapter that implements
 * this interface, so the rest of the server never depends on which company is used.
 */
export interface SmsSender {
  /** Short name of the provider, recorded for support and audit. */
  readonly provider: string;
  /** Sends one message. Throws if the provider refuses it. */
  send(to: string, text: string): Promise<void>;
}

/** Injection token for the SMS adapter chosen in configuration (SMS_PROVIDER). */
export const SMS_SENDER = Symbol('SMS_SENDER');
