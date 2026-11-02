import sharp from 'sharp';

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

function watermarkSvg(width: number, height: number, reference: string): string {
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
