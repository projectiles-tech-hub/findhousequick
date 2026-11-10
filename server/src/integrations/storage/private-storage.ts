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

  // Resumable uploads (ADR 0009). A large file is sent in numbered parts (1 to partCount), each to its own link.
  // Real providers map these to their multipart uploads; the development provider keeps each part as a file.

  /** One upload link per part, in part order, valid until `expiresAt`. Each part may be up to `maxPartBytes`. */
  createPartUploadLinks(key: string, partCount: number, maxPartBytes: number, contentType: string, expiresAt: Date): Promise<UploadLink[]>;
  /** The part numbers already received for `key`, so an interrupted upload can carry on. */
  uploadedParts(key: string, partCount: number): Promise<number[]>;
  /**
   * Joins parts 1 to partCount into one file under `key` and removes the parts. Returns what is stored, or null if a
   * part is missing (nothing is changed then). Joining a file that was already joined returns it as stored.
   */
  assembleParts(key: string, partCount: number): Promise<StoredFile | null>;
  /** The stored file's bytes, for processing on the server. */
  read(key: string): Promise<Buffer>;
  /** Stores bytes made on the server, such as a display copy of a photo. */
  write(key: string, data: Buffer, contentType: string): Promise<void>;
}

/** Injection token for the storage adapter chosen in configuration (STORAGE_PROVIDER). */
export const PRIVATE_STORAGE = Symbol('PRIVATE_STORAGE');
