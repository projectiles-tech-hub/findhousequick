/**
 * Private file storage for identity and ownership documents. Files here are never publicly reachable: the apps upload
 * through a short-lived link, and staff view through a short-lived link that is recorded in the audit log.
 *
 * Each storage company (Cloudflare R2, Amazon S3 and so on) gets its own adapter implementing this interface, so the
 * rest of the server never depends on which one is used (ADR 0007).
 */

export interface UploadRequirements {
  contentType: string;
  sizeBytes: number;
  /** SHA-256 of the file in lower-case hex. */
  sha256: string;
}

export interface UploadLink {
  /** Address the app sends the file to, with an HTTP PUT. */
  url: string;
  /** Headers the app must send with the file. */
  headers: Record<string, string>;
}

export interface StoredFile {
  sizeBytes: number;
  /** SHA-256 of the stored file in lower-case hex. */
  sha256: string;
}

export interface PrivateStorage {
  /** Short name of the provider, recorded for support. */
  readonly provider: string;
  /** A link the app can upload one file to, until `expiresAt`. */
  createUploadLink(key: string, file: UploadRequirements, expiresAt: Date): Promise<UploadLink>;
  /** What is stored under `key`, or null if nothing is. */
  inspect(key: string): Promise<StoredFile | null>;
  /** A link that shows the file until `expiresAt`. */
  createViewLink(key: string, expiresAt: Date): Promise<string>;
  /** Removes the file. Removing a file that is not there is not an error. */
  delete(key: string): Promise<void>;
}

/** Injection token for the storage adapter chosen in configuration (STORAGE_PROVIDER). */
export const PRIVATE_STORAGE = Symbol('PRIVATE_STORAGE');
