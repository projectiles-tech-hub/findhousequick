import sharp from 'sharp';
import { blurRegions, embedHiddenMark, markNumber, readHiddenMark } from './photo.js';

/** A room-like test photo: broad light and dark areas, edges and some grain. */
async function roomPhoto(width = 1600, height = 1200): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  let seed = 7;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const wall = x < width * 0.6 ? 190 : 120;
      const floor = y > height * 0.7 ? -70 : 0;
      const window = x > width * 0.2 && x < width * 0.4 && y > height * 0.2 && y < height * 0.5 ? 50 : 0;
      const v = Math.max(0, Math.min(255, wall + floor + window + ((seed >> 16) % 13) - 6));
      raw[(y * width + x) * 3] = v;
      raw[(y * width + x) * 3 + 1] = Math.max(0, v - 10);
      raw[(y * width + x) * 3 + 2] = Math.max(0, v - 25);
    }
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
}

const KEY = 'test-hidden-mark-key-0123456789';
const ID = 'a1b2c3d4-0000-4000-8000-000000000001';

describe('hidden watermark', () => {
  it('can be read back from the display copy, after it is shrunk and compressed again', async () => {
    const marked = await embedHiddenMark(await roomPhoto(), ID, KEY);
    expect(await readHiddenMark(marked, KEY)).toBe(markNumber(ID));
    const copied = await sharp(marked).resize({ width: 700 }).jpeg({ quality: 70 }).toBuffer();
    expect(await readHiddenMark(copied, KEY)).toBe(markNumber(ID));
  });

  it('is not found in an unmarked photo, nor with another key', async () => {
    const photo = await roomPhoto();
    expect(await readHiddenMark(photo, KEY)).toBeNull();
    const marked = await embedHiddenMark(photo, ID, KEY);
    expect(await readHiddenMark(marked, 'another-key-entirely-9876543210')).toBeNull();
  });

  it('cannot be seen: the photo changes by only a few levels of brightness', async () => {
    const photo = await roomPhoto(800, 600);
    const marked = await embedHiddenMark(photo, ID, KEY);
    const a = await sharp(photo).raw().toBuffer();
    const b = await sharp(marked).raw().toBuffer();
    let total = 0;
    for (let i = 0; i < a.length; i++) total += Math.abs(a[i]! - b[i]!);
    expect(total / a.length).toBeLessThan(4);
  });
});

describe('automatic blurring', () => {
  it('blurs the region so its detail is gone, and leaves the rest of the photo alone', async () => {
    // A fine checkerboard: detail that a blur removes.
    const w = 800;
    const h = 600;
    const raw = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.fill(((x >> 2) + (y >> 2)) % 2 ? 230 : 20, (y * w + x) * 3, (y * w + x) * 3 + 3);
    const photo = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
    const out = await blurRegions(photo, [{ kind: 'FACE', left: 0.5, top: 0.5, width: 0.2, height: 0.2 }]);
    const spread = async (img: Buffer, left: number, top: number) => {
      // stats() looks at the input, so the cut-out is made first.
      const s = await sharp(await sharp(img).extract({ left, top, width: 40, height: 40 }).greyscale().toBuffer()).stats();
      return s.channels[0]!.stdev;
    };
    expect(await spread(out, 460, 360)).toBeLessThan(30);
    expect(await spread(out, 40, 40)).toBeGreaterThan(80);
  });

  it('returns the photo unchanged when nothing is found', async () => {
    const photo = await roomPhoto(400, 300);
    expect(await blurRegions(photo, [])).toBe(photo);
  });
});
