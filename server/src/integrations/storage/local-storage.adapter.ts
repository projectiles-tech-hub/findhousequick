import { Controller, Get, HttpCode, Param, Put, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Public } from '../../accounts/auth.js';
import { apiError } from '../../common/api-error.js';
import type { Env } from '../../config/env.js';
import type { PrivateStorage, StoredFile, UploadLink, UploadRequirements } from './private-storage.js';

/**
 * Development storage provider: keeps files in a folder on the server, and accepts uploads and serves views through
 * the API itself (`/v1/storage/local/...`), with signed links that run out like a real provider's. Refused in
 * production by the configuration check.
 *
 * Links are signed with a key made fresh each time the server starts, so links from before a restart stop working.
 */
export class LocalStorageAdapter implements PrivateStorage {
  readonly provider = 'local';
  private readonly signingKey = randomBytes(32);
  private readonly root: string;

  constructor(
    dir: string,
    private readonly apiUrl: string,
  ) {
    this.root = resolve(dir);
  }

  async createUploadLink(key: string, file: UploadRequirements, expiresAt: Date): Promise<UploadLink> {
    const token = this.sign({ op: 'put', key, exp: expiresAt.getTime(), type: file.contentType, size: file.sizeBytes });
    return { url: `${this.apiUrl}/v1/storage/local/${token}`, headers: { 'Content-Type': file.contentType } };
  }

  async inspect(key: string): Promise<StoredFile | null> {
    try {
      const data = await readFile(this.pathOf(key));
      return { sizeBytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
    } catch {
      return null;
    }
  }

  async createViewLink(key: string, expiresAt: Date): Promise<string> {
    return `${this.apiUrl}/v1/storage/local/${this.sign({ op: 'get', key, exp: expiresAt.getTime() })}`;
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  async createPartUploadLinks(key: string, partCount: number, maxPartBytes: number, contentType: string, expiresAt: Date): Promise<UploadLink[]> {
    const links: UploadLink[] = [];
    for (let n = 1; n <= partCount; n++) {
      const token = this.sign({ op: 'put', key: partKey(key, n), exp: expiresAt.getTime(), type: contentType, size: maxPartBytes });
      links.push({ url: `${this.apiUrl}/v1/storage/local/${token}`, headers: { 'Content-Type': contentType } });
    }
    return links;
  }

  async uploadedParts(key: string, partCount: number): Promise<number[]> {
    const got: number[] = [];
    for (let n = 1; n <= partCount; n++) if (await this.exists(partKey(key, n))) got.push(n);
    return got;
  }

  async assembleParts(key: string, partCount: number): Promise<StoredFile | null> {
    const parts: Buffer[] = [];
    for (let n = 1; n <= partCount; n++) {
      try {
        parts.push(await readFile(this.pathOf(partKey(key, n))));
      } catch {
        // Already joined earlier: the parts are gone but the file is there.
        return n === 1 ? this.inspect(key) : null;
      }
    }
    await this.write(key, Buffer.concat(parts));
    for (let n = 1; n <= partCount; n++) await rm(this.pathOf(partKey(key, n)), { force: true });
    return this.inspect(key);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.pathOf(key));
  }

  /** Reads a signed link back. Returns null if it was altered or has run out. */
  verify(token: string): LinkClaims | null {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = createHmac('sha256', this.signingKey).update(payload).digest();
    const given = Buffer.from(sig, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as LinkClaims;
    return claims.exp > Date.now() ? claims : null;
  }

  async write(key: string, data: Buffer, _contentType?: string): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async exists(key: string): Promise<boolean> {
    return stat(this.pathOf(key)).then(
      () => true,
      () => false,
    );
  }

  readStream(key: string) {
    return createReadStream(this.pathOf(key));
  }

  private sign(claims: LinkClaims): string {
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `${payload}.${createHmac('sha256', this.signingKey).update(payload).digest('base64url')}`;
  }

  /** The file's place in the folder. Keys are made by the server, but a key can never point outside the folder. */
  private pathOf(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error('Storage key outside the storage folder');
    return path;
  }
}

/** Where one part of a resumable upload is kept until the parts are joined. */
function partKey(key: string, n: number): string {
  return `${key}.part-${String(n).padStart(5, '0')}`;
}

interface LinkClaims {
  op: 'put' | 'get';
  key: string;
  exp: number;
  type?: string;
  size?: number;
}

/** Upload and view addresses for the local storage provider. They answer only when STORAGE_PROVIDER is "local". */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('storage/local')
export class LocalStorageController {
  constructor(
    private readonly storage: LocalStorageAdapter,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private inUse(): void {
    if (this.config.get('STORAGE_PROVIDER', { infer: true }) !== 'local') throw apiError(404, 'NOT_FOUND', 'Not found.');
  }

  @Put(':token')
  @HttpCode(200)
  async upload(@Param('token') token: string, @Req() req: Request): Promise<void> {
    this.inUse();
    const claims = this.storage.verify(token);
    if (!claims || claims.op !== 'put') throw apiError(403, 'LINK_INVALID', 'This upload link is not valid or has run out.');
    if (req.headers['content-type'] !== claims.type) {
      throw apiError(400, 'WRONG_CONTENT_TYPE', `Send the file with Content-Type ${claims.type}.`);
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > (claims.size ?? 0)) throw apiError(413, 'FILE_TOO_LARGE', 'The file is larger than declared.');
      chunks.push(chunk as Buffer);
    }
    await this.storage.write(claims.key, Buffer.concat(chunks));
  }

  @Get(':token')
  async view(@Param('token') token: string, @Res() res: Response): Promise<void> {
    this.inUse();
    const claims = this.storage.verify(token);
    if (!claims || claims.op !== 'get' || !(await this.storage.exists(claims.key))) {
      throw apiError(404, 'NOT_FOUND', 'This link is not valid or has run out.');
    }
    res.setHeader('Cache-Control', 'no-store');
    // The website and the web app show photos from their own addresses; the signed link is the permission.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    this.storage.readStream(claims.key).pipe(res);
  }
}
