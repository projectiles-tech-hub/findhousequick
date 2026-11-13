import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import type { Env } from '../config/env.js';
import { PRIVATE_REGION_FINDER, type PrivateRegionFinder } from '../integrations/privacy/private-regions.js';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PRIVATE_STORAGE, type PrivateStorage } from '../integrations/storage/private-storage.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { analysePhoto, blurRegions, cleanPhoto, displayCopies, embedHiddenMark, watermarkSvg } from './photo.js';

const run = promisify(execFile);

/** A walkthrough video shorter than this is rejected: one continuous take through the whole property. */
export const MIN_WALKTHROUGH_SECONDS = 20;
/** Media left processing for longer than this is put back on the queue. */
const STUCK_AFTER_MS = 15 * 60_000;

/** A short reference printed in the watermark, so a copied image can be traced to its property. */
export function unitReference(unitId: string): string {
  return `U-${unitId.replace(/-/g, '').slice(-8).toUpperCase()}`;
}

/**
 * Processes one uploaded photo or video (ADR 0009; Technical Architecture Section 11). Safe to run twice: media that
 * is no longer processing is left alone.
 */
@Injectable()
export class MediaProcessor {
  private readonly logger = new Logger('MediaProcessor');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PRIVATE_STORAGE) private readonly storage: PrivateStorage,
    @Inject(PRIVATE_REGION_FINDER) private readonly finder: PrivateRegionFinder,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async process(mediaId: string): Promise<string> {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId }, include: { unitPart: true } });
    if (!media || media.status !== 'PROCESSING') return 'skipped';
    const original = await this.storage.read(media.originalKey);
    if (media.kind === 'VIDEO') return this.processVideo(media.id, media.buildingId, media.unitId!, original, media.unitPart?.code === 'walkthrough');
    return this.processPhoto(media.id, media.buildingId, media.unitId!, original);
  }

  /** Media still processing long after it was confirmed: its job was probably lost. */
  async stuck(): Promise<string[]> {
    const rows = await this.prisma.mediaAsset.findMany({
      where: { status: 'PROCESSING', createdAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) } },
      select: { id: true },
      take: 500,
    });
    return rows.map((r) => r.id);
  }

  private async processPhoto(id: string, buildingId: string, unitId: string, original: Buffer): Promise<string> {
    let clean: Buffer;
    try {
      clean = await cleanPhoto(original);
    } catch {
      return this.reject(id, ['UNREADABLE']);
    }
    const a = await analysePhoto(clean);
    if (a.problems.length) {
      await this.prisma.mediaAsset.update({
        where: { id },
        data: { width: a.width, height: a.height, perceptualHash: a.fingerprint, qualityFlags: { rejectionReasons: a.problems, brightness: a.brightness, sharpness: a.sharpness } },
      });
      return this.reject(id, a.problems);
    }
    // Before any copy is made: faces, number plates, documents and family photographs blurred, then the hidden mark
    // added, so every display copy carries both (Specification 15.3). The private original is never changed.
    const regions = await this.finder.find(clean);
    const shown = await embedHiddenMark(await blurRegions(clean, regions), id, this.config.get('HIDDEN_MARK_KEY', { infer: true }));
    const copies = await displayCopies(shown, unitReference(unitId));
    const variants: Record<string, string> = {};
    for (const [size, data] of Object.entries(copies)) {
      const key = `media/${buildingId}/${id}/${size}.jpg`;
      await this.storage.write(key, data, 'image/jpeg');
      variants[size] = key;
    }
    const done = await this.prisma.mediaAsset.updateMany({
      where: { id, status: 'PROCESSING' },
      data: {
        status: 'READY',
        width: a.width,
        height: a.height,
        perceptualHash: a.fingerprint,
        variants,
        qualityFlags: { rejectionReasons: [], brightness: a.brightness, sharpness: a.sharpness, blurred: regions.map((r) => r.kind), blurredBy: this.finder.provider },
      },
    });
    return done.count ? 'ready' : 'skipped';
  }

  private async processVideo(id: string, buildingId: string, unitId: string, original: Buffer, isWalkthrough: boolean): Promise<string> {
    const seconds = await videoSeconds(original);
    if (seconds === null) return this.reject(id, ['UNREADABLE']);
    await this.prisma.mediaAsset.update({ where: { id }, data: { durationSeconds: Math.round(seconds) } });
    if (isWalkthrough && seconds < MIN_WALKTHROUGH_SECONDS) return this.reject(id, ['TOO_SHORT']);
    // The copy that is shown: at most 720 high, with the visible watermark, sound kept (ADR 0009). The original stays private.
    const copy = await watermarkedVideo(original, unitReference(unitId));
    if (!copy) return this.reject(id, ['UNREADABLE']);
    const key = `media/${buildingId}/${id}/video.mp4`;
    await this.storage.write(key, copy, 'video/mp4');
    const done = await this.prisma.mediaAsset.updateMany({
      where: { id, status: 'PROCESSING' },
      data: { status: 'READY', variants: { video: key }, qualityFlags: { rejectionReasons: [] } },
    });
    return done.count ? 'ready' : 'skipped';
  }

  private async reject(id: string, reasons: string[]): Promise<string> {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id }, select: { qualityFlags: true } });
    await this.prisma.mediaAsset.updateMany({
      where: { id, status: 'PROCESSING' },
      data: { status: 'REJECTED', qualityFlags: { ...((media?.qualityFlags ?? {}) as object), rejectionReasons: reasons } },
    });
    this.logger.log(`Media ${id} rejected: ${reasons.join(', ')}`);
    return 'rejected';
  }
}

/** The video's length in seconds, read with ffprobe, or null if it cannot be read as a video. */
export async function videoSeconds(data: Buffer): Promise<number | null> {
  const dir = await mkdtemp(join(tmpdir(), 'fhq-video-'));
  const file = join(dir, 'video.mp4');
  try {
    await writeFile(file, data);
    const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
      timeout: 60_000,
    });
    const seconds = Number.parseFloat(stdout.trim());
    return Number.isFinite(seconds) ? seconds : null;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Makes the shown copy of a video with ffmpeg (side note: the standard free program for video): at most 720 high,
 * H.264 for every phone and browser, the watermark in the corner. Null if the video cannot be read.
 */
export async function watermarkedVideo(original: Buffer, reference: string): Promise<Buffer | null> {
  const dir = await mkdtemp(join(tmpdir(), 'fhq-video-'));
  try {
    const input = join(dir, 'in');
    const mark = join(dir, 'mark.png');
    const output = join(dir, 'out.mp4');
    await writeFile(input, original);
    // The size of the shown copy, so the mark is drawn for it exactly (phone walkthroughs are often upright).
    const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation', '-of', 'json', input], { timeout: 60_000 });
    const stream = (JSON.parse(stdout) as { streams?: { width?: number; height?: number; side_data_list?: { rotation?: number }[] }[] }).streams?.[0];
    if (!stream?.width || !stream.height) return null;
    const turned = Math.abs(stream.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0) % 180 === 90;
    const [w0, h0] = turned ? [stream.height, stream.width] : [stream.width, stream.height];
    const height = Math.min(720, h0 - (h0 % 2));
    const width = Math.max(2, Math.round((w0 * height) / h0 / 2) * 2);
    await sharp(Buffer.from(watermarkSvg(width, height, reference))).png().toFile(mark);
    await run(
      'ffmpeg',
      [
        '-y', '-i', input, '-i', mark,
        '-filter_complex', `[0:v]scale=${width}:${height}[v];[v][1:v]overlay=0:0`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', output,
      ],
      { timeout: 10 * 60_000 },
    );
    return await readFile(output);
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
