/**
 * Runs identity checks: looks up an ID number (NIN or a national equivalent) and compares a live selfie with the
 * photo held for that ID. Each identity company (Smile ID, Dojah, Prembly and so on) gets its own adapter that
 * implements this interface, so the rest of the server never depends on which company is used (ADR 0007).
 *
 * The usual flow with these companies:
 *   1. The server starts a check and gets back values for the company's camera component in the app.
 *   2. The app runs the camera (selfie and liveness) with those values.
 *   3. The company sends the result to the server's results address, signed so the server can tell it is genuine.
 */

export interface IdentityCheckStart {
  /** Our identity check id, so the company can quote it back. */
  checkId: string;
  countryCode: string;
  idType: string;
  /** The ID number, already in standard form. Never logged. */
  idNumber: string;
  firstName: string;
  lastName: string;
}

export interface StartedIdentityCheck {
  /** The company's own reference for this check. */
  reference: string;
  /** Values the app passes to the company's camera component. Must not contain the ID number. */
  session: Record<string, unknown>;
}

/** What the company found. The server, not the adapter, decides what the result means (ADR 0007). */
export interface IdentityCheckResult {
  reference: string;
  /** The ID number exists in the official database. */
  idFound: boolean;
  /** Full name held for the ID, if the company returns it. */
  nameOnId: string | null;
  /** The selfie came from a live person, not a photo or a screen. */
  livenessPassed: boolean;
  /** The selfie matches the photo held for the ID. */
  faceMatched: boolean;
  /** The company's match score from 0 to 100, if it gives one. */
  faceMatchScore: number | null;
}

/** The parts of an incoming results request an adapter needs to check its signature and read it. */
export interface IncomingResult {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

export interface IdentityProvider {
  /** Short name, used in country settings (verification.identityProvider) and in the results address. */
  readonly name: string;
  /** Starts a check. Throws if the company cannot be reached or refuses. */
  start(check: IdentityCheckStart): Promise<StartedIdentityCheck>;
  /** Checks that a results request really came from the company, and reads it. Throws if it did not. */
  readResult(incoming: IncomingResult): Promise<IdentityCheckResult>;
}

/** Thrown by readResult when a results request is not genuine or cannot be read. */
export class UntrustedResultError extends Error {}

/** Injection token for the identity adapters available on this server, by name. */
export const IDENTITY_PROVIDERS = Symbol('IDENTITY_PROVIDERS');
export type IdentityProviders = ReadonlyMap<string, IdentityProvider>;
