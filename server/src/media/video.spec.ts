import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { videoSeconds, watermarkedVideo } from './media.processor.js';

const run = promisify(execFile);

async function testVideo(width: number, height: number): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'fhq-test-'));
  try {
    const out = join(dir, 'v.mp4');
    await run('ffmpeg', ['-y', '-f', 'lavfi', '-i', `testsrc=size=${width}x${height}:rate=15:duration=3`, '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', out]);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function size(video: Buffer): Promise<{ width: number; height: number }> {
  const dir = await mkdtemp(join(tmpdir(), 'fhq-test-'));
  try {
    const f = join(dir, 'v.mp4');
    await writeFile(f, video);
    const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', f]);
    return JSON.parse(stdout).streams[0];
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('the shown copy of a video', () => {
  it('is at most 720 high, keeps the shape of an upright phone video, and keeps its length', async () => {
    const copy = await watermarkedVideo(await testVideo(1080, 1920), 'U-ABCDEF12');
    expect(copy).not.toBeNull();
    expect(await size(copy!)).toEqual({ width: 406, height: 720 });
    expect(Math.round((await videoSeconds(copy!))!)).toBe(3);
  }, 60_000);

  it('leaves a small video its own size, and gives null for something that is not a video', async () => {
    expect(await size((await watermarkedVideo(await testVideo(640, 360), 'U-1'))!)).toEqual({ width: 640, height: 360 });
    expect(await watermarkedVideo(Buffer.alloc(5000, 7), 'U-1')).toBeNull();
  }, 60_000);
});
