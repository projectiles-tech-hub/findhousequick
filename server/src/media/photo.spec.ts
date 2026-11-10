import sharp from 'sharp';
import { analysePhoto, cleanPhoto, differenceHash, displayCopies, hashDistance } from './photo.js';

/** A detailed test photo: a fine checkerboard with a brightness gradient, like a room with texture. */
async function sharpPhoto(width = 1600, height = 1200, light = 1): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const check = ((x >> 3) + (y >> 3)) % 2 === 0 ? 200 : 60;
      const v = Math.round(check * light * (0.7 + (0.3 * x) / width));
      raw.fill(v, (y * width + x) * 3, (y * width + x) * 3 + 3);
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .withMetadata({ exif: { IFD0: { Make: 'TestPhone' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '6/1 24/1 0/1' } } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe('photo processing', () => {
  it('accepts a sharp, bright photo of good size', async () => {
    const a = await analysePhoto(await cleanPhoto(await sharpPhoto()));
    expect(a.problems).toEqual([]);
    expect(a.width).toBe(1600);
    expect(a.fingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  it('flags blurred, dark and small photos', async () => {
    const blurred = await sharp(await sharpPhoto()).blur(12).jpeg().toBuffer();
    expect((await analysePhoto(await cleanPhoto(blurred))).problems).toContain('BLURRY');

    const dark = await sharpPhoto(1600, 1200, 0.15);
    expect((await analysePhoto(await cleanPhoto(dark))).problems).toContain('TOO_DARK');

    const small = await sharpPhoto(640, 480);
    expect((await analysePhoto(await cleanPhoto(small))).problems).toContain('LOW_RESOLUTION');
  });

  it('removes hidden location and camera data', async () => {
    const original = await sharpPhoto();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const clean = await cleanPhoto(original);
    const meta = await sharp(clean).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it('gives near-identical hashes for a resized copy and different hashes for another picture', async () => {
    const photo = await sharpPhoto();
    const resized = await sharp(photo).resize({ width: 800 }).toBuffer();
    expect(hashDistance(await differenceHash(photo), await differenceHash(resized))).toBeLessThanOrEqual(4);

    const other = await sharp(photo).flop().toBuffer();
    expect(hashDistance(await differenceHash(photo), await differenceHash(other))).toBeGreaterThan(10);
  });

  it('makes three watermarked display copies no wider than the original', async () => {
    const copies = await displayCopies(await cleanPhoto(await sharpPhoto(1200, 900)), 'U-1234ABCD');
    const widths = await Promise.all(Object.values(copies).map(async (b) => (await sharp(b).metadata()).width));
    expect(widths).toEqual([480, 960, 1200]);
    // The watermark changes the pixels in the bottom-right corner.
    const plain = await sharp(await cleanPhoto(await sharpPhoto(1200, 900))).resize({ width: 480 }).raw().toBuffer();
    const marked = await sharp(copies.small).raw().toBuffer();
    expect(Buffer.compare(plain.subarray(-2000), marked.subarray(-2000))).not.toBe(0);
  });
});
