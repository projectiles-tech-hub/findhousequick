import sharp, { type OverlayOptions } from 'sharp';

/**
 * Photo processing (ADR 0009; Technical Architecture Section 11). Pure functions on image bytes, so they can be
 * tested without storage or a database.
 */

/** Quality limits. They are about cameras and screens, not countries, so they are fixed here. */
export const PHOTO_QUALITY = {
  /** The shorter side must be at least this many pixels. */
  minShortSidePx: 720,
  /** Average brightness (0 to 255) below this is too dark. */
  minBrightness: 40,
  /** Edge sharpness (the variance of a Laplacian filter on a 512-pixel-wide copy) below this is blurred. */
  minSharpness: 40,
} as const;

/** Widths of the display copies, in pixels. Copies are never wider than the original. */
export const DISPLAY_WIDTHS = { small: 480, medium: 960, large: 1600 } as const;
export type DisplaySize = keyof typeof DISPLAY_WIDTHS;

export type PhotoProblem = 'BLURRY' | 'TOO_DARK' | 'LOW_RESOLUTION' | 'UNREADABLE';

export interface PhotoAnalysis {
  width: number;
  height: number;
  brightness: number;
  sharpness: number;
  /** 64-bit difference hash in hex, for spotting the same photo even when resized or slightly cropped. */
  fingerprint: string;
  problems: PhotoProblem[];
}

/**
 * Turns the photo upright and removes every piece of hidden data (GPS location, camera, time). The result is the
 * clean original that display copies are made from.
 */
export async function cleanPhoto(input: Buffer): Promise<Buffer> {
  // rotate() with no angle applies the camera's orientation; sharp drops metadata unless asked to keep it.
  return sharp(input, { failOn: 'error' }).rotate().jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

export async function analysePhoto(clean: Buffer): Promise<PhotoAnalysis> {
  const meta = await sharp(clean).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  const grey = sharp(clean).greyscale();
  const brightness = (await grey.clone().stats()).channels[0]!.mean;

  // Laplacian edge filter on a fixed-size grey copy, so the same scene scores alike at any resolution. A sharp photo
  // has strong edges, so its filtered values vary widely; a blurred one gives values close to zero.
  const sharpness = await laplacianVariance(clean);

  const problems: PhotoProblem[] = [];
  if (Math.min(width, height) < PHOTO_QUALITY.minShortSidePx) problems.push('LOW_RESOLUTION');
  if (brightness < PHOTO_QUALITY.minBrightness) problems.push('TOO_DARK');
  if (sharpness < PHOTO_QUALITY.minSharpness) problems.push('BLURRY');

  return {
    width,
    height,
    brightness: Math.round(brightness * 10) / 10,
    sharpness: Math.round(sharpness * 10) / 10,
    fingerprint: await differenceHash(clean),
    problems,
  };
}

async function laplacianVariance(input: Buffer): Promise<number> {
  const { data, info } = await sharp(input)
    .greyscale()
    .resize({ width: 512, kernel: 'linear' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = data[i - w]! + data[i + w]! + data[i - 1]! + data[i + 1]! - 4 * data[i]!;
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/**
 * Difference hash: shrink to 9 by 8 grey pixels and record, for each row, whether each pixel is brighter than the one
 * to its right. Near-identical photos give hashes that differ in only a few of the 64 bits.
 */
export async function differenceHash(input: Buffer): Promise<string> {
  const { data } = await sharp(input).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits = (bits << 1n) | (data[y * 9 + x]! > data[y * 9 + x + 1]! ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, '0');
}

/** How many of the 64 bits differ between two difference hashes. */
export function hashDistance(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

/**
 * The display copies, each with the visible watermark: the FindHouseQuick name and a reference that identifies the
 * property (Specification 15.3).
 */
export async function displayCopies(clean: Buffer, reference: string): Promise<Record<DisplaySize, Buffer>> {
  const meta = await sharp(clean).metadata();
  const out = {} as Record<DisplaySize, Buffer>;
  for (const [size, wanted] of Object.entries(DISPLAY_WIDTHS) as [DisplaySize, number][]) {
    const width = Math.min(wanted, meta.width ?? wanted);
    const resized = await sharp(clean).resize({ width }).toBuffer({ resolveWithObject: true });
    const mark = watermarkSvg(resized.info.width, resized.info.height, reference);
    out[size] = await sharp(resized.data)
      .composite([{ input: Buffer.from(mark), gravity: 'southeast' }])
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
  }
  return out;
}

export function watermarkSvg(width: number, height: number, reference: string): string {
  const fontSize = Math.max(12, Math.round(width / 32));
  const pad = Math.round(fontSize * 0.8);
  const text = `FindHouseQuick · ${escapeXml(reference)}`;
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${width - pad}" y="${height - pad}" text-anchor="end" font-family="sans-serif" font-weight="700"
        font-size="${fontSize}" fill="#FFFFFF" fill-opacity="0.75" stroke="#000000" stroke-opacity="0.35"
        stroke-width="${Math.max(1, Math.round(fontSize / 14))}">${text}</text>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
}

// ---------------------------------------------------------------------------------------------------------------
// Automatic blurring (Specification 15.3)
// ---------------------------------------------------------------------------------------------------------------

/** A part of a photo to blur, as fractions of its width and height (0 to 1), so it fits any size of the photo. */
export interface PrivateRegion {
  kind: 'FACE' | 'PLATE' | 'DOCUMENT' | 'PHOTO';
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Blurs each region heavily, with a margin around it, so faces, number plates, documents and family photographs
 * cannot be read. The private original is never changed; this is applied to the copy the display copies are made from.
 */
export async function blurRegions(clean: Buffer, regions: PrivateRegion[]): Promise<Buffer> {
  if (!regions.length) return clean;
  const meta = await sharp(clean).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  const layers: OverlayOptions[] = [];
  for (const r of regions) {
    // A margin of a fifth on each side, since detected boxes are often tight.
    const mx = r.width * 0.2;
    const my = r.height * 0.2;
    const left = Math.max(0, Math.floor((r.left - mx) * W));
    const top = Math.max(0, Math.floor((r.top - my) * H));
    const width = Math.min(W - left, Math.ceil((r.width + 2 * mx) * W));
    const height = Math.min(H - top, Math.ceil((r.height + 2 * my) * H));
    if (width < 2 || height < 2) continue;
    // Shrink then enlarge (large blocks) and blur on top: neither alone can be undone or read.
    const block = Math.max(2, Math.round(Math.min(width, height) / 8));
    const small = await sharp(clean)
      .extract({ left, top, width, height })
      // Averaging down (not picking single pixels) so each block is the mean of what it covers.
      .resize(Math.max(1, Math.round(width / block)), Math.max(1, Math.round(height / block)), { kernel: 'cubic' })
      .toBuffer();
    const patch = await sharp(small).resize(width, height, { kernel: 'nearest' }).blur(Math.max(2, block / 2)).toBuffer();
    layers.push({ input: patch, left, top });
  }
  return layers.length ? sharp(clean).composite(layers).jpeg({ quality: 92, mozjpeg: true }).toBuffer() : clean;
}

// ---------------------------------------------------------------------------------------------------------------
// Hidden watermark (Specification 15.3)
// ---------------------------------------------------------------------------------------------------------------

/** Bits carried by the hidden mark: 24 identify the photo, 8 are a check that a mark was really read. */
const MARK_BITS = 32;
/** The pattern grid: each bit is spread over the whole photo, in cells of this many across and down. */
const MARK_GRID = 64;
/** How strongly the pattern changes brightness (out of 255): too faint to see, strong enough to survive compression. */
const MARK_STRENGTH = 3;

/** The 24-bit number carried for a photo: taken from its id, so the photo can be found again from a copy. */
export function markNumber(mediaId: string): number {
  return Number.parseInt(mediaId.replace(/-/g, '').slice(0, 6), 16);
}

function checkByte(n: number): number {
  return ((n * 2654435761) >>> 24) & 0xff;
}

/** A repeatable ±1 pattern for one bit, made from the secret key; without the key the patterns cannot be made. */
function markPattern(key: string, bit: number): Int8Array {
  const out = new Int8Array(MARK_GRID * MARK_GRID);
  // A small seeded generator (xorshift), seeded from the key and the bit number.
  let seed = 2166136261;
  for (const ch of `${key}:${bit}`) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  let x = seed || 1;
  for (let i = 0; i < out.length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    out[i] = (x >>> 0) & 1 ? 1 : -1;
  }
  return out;
}

/**
 * Adds the hidden mark: each of the 32 bits adds its own faint pattern of lighter and darker cells across the whole
 * photo, lighter-first for a 1 and darker-first for a 0. It survives resizing and JPEG compression; heavy cropping
 * defeats it, which the visible mark and the photo fingerprint cover.
 */
export async function embedHiddenMark(image: Buffer, mediaId: string, key: string): Promise<Buffer> {
  const n = markNumber(mediaId);
  const payload = (n << 8) | checkByte(n);
  const sum = new Float32Array(MARK_GRID * MARK_GRID);
  for (let b = 0; b < MARK_BITS; b++) {
    const sign = (payload >>> (MARK_BITS - 1 - b)) & 1 ? 1 : -1;
    const p = markPattern(key, b);
    for (let i = 0; i < sum.length; i++) sum[i]! += sign * p[i]!;
  }
  // Scale the sum into a grey picture centred on 128, then stretch it over the photo and add it to every colour.
  const scale = MARK_STRENGTH / Math.sqrt(MARK_BITS);
  const grid = Buffer.alloc(sum.length);
  for (let i = 0; i < sum.length; i++) grid[i] = Math.max(0, Math.min(255, Math.round(128 + sum[i]! * scale * 4)));
  const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pattern = await sharp(grid, { raw: { width: MARK_GRID, height: MARK_GRID, channels: 1 } })
    .resize(info.width, info.height, { kernel: 'nearest', fit: 'fill' })
    // Keep one channel: sharp gives three after resizing unless asked.
    .extractChannel(0)
    .raw()
    .toBuffer();
  const out = Buffer.alloc(data.length);
  for (let y = 0, i = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++, i++) {
      const delta = (pattern[i]! - 128) / 4;
      for (let c = 0; c < info.channels; c++) {
        const k = i * info.channels + c;
        out[k] = Math.max(0, Math.min(255, Math.round(data[k]! + delta)));
      }
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: info.channels } }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}

/**
 * Reads the hidden mark from a copy of a photo found elsewhere. Returns the 24-bit number (see markNumber), or null
 * when no mark is found (the check byte does not match).
 */
export async function readHiddenMark(image: Buffer, key: string): Promise<number | null> {
  // Average each cell of the pattern grid over the middle of its area (a resize would blend neighbouring cells and
  // wash the pattern out). The photo's own broad shapes are then removed by subtracting a blurred copy.
  const { data: grey, info } = await sharp(image).greyscale().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const data = new Float32Array(MARK_GRID * MARK_GRID);
  for (let gy = 0; gy < MARK_GRID; gy++) {
    const y0 = Math.floor(((gy + 0.2) * info.height) / MARK_GRID);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 0.8) * info.height) / MARK_GRID));
    for (let gx = 0; gx < MARK_GRID; gx++) {
      const x0 = Math.floor(((gx + 0.2) * info.width) / MARK_GRID);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 0.8) * info.width) / MARK_GRID));
      let total = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) total += grey[(y * info.width + x) * channels]!;
      data[gy * MARK_GRID + gx] = total / ((y1 - y0) * (x1 - x0));
    }
  }
  // The blurred copy: the mean of the 5 by 5 cells around each cell.
  const smooth = new Float32Array(data.length);
  for (let gy = 0; gy < MARK_GRID; gy++) {
    for (let gx = 0; gx < MARK_GRID; gx++) {
      let total = 0;
      let count = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const y = gy + dy;
          const x = gx + dx;
          if (y < 0 || x < 0 || y >= MARK_GRID || x >= MARK_GRID) continue;
          total += data[y * MARK_GRID + x]!;
          count++;
        }
      }
      smooth[gy * MARK_GRID + gx] = total / count;
    }
  }
  const residual = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) residual[i] = data[i]! - smooth[i]!;
  let payload = 0;
  for (let b = 0; b < MARK_BITS; b++) {
    const p = markPattern(key, b);
    let corr = 0;
    for (let i = 0; i < residual.length; i++) corr += residual[i]! * p[i]!;
    payload = (payload << 1) | (corr > 0 ? 1 : 0);
  }
  payload >>>= 0;
  const n = payload >>> 8;
  return (payload & 0xff) === checkByte(n) ? n : null;
}
