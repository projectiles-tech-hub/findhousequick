/**
 * Sends email. Each email company (Resend, Postmark, Amazon SES and so on) gets its own adapter that implements
 * this interface, so the rest of the server never depends on which company is used (decision 35).
 */
export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text body. */
  text: string;
}

export interface EmailSender {
  /** Short name of the provider, recorded for support and audit. */
  readonly provider: string;
  /** Sends one email. Throws if the provider refuses it. */
  send(message: EmailMessage): Promise<void>;
}

/** Injection token for the email adapter chosen in configuration (EMAIL_PROVIDER). */
export const EMAIL_SENDER = Symbol('EMAIL_SENDER');
