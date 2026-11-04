// Mechanical atlas packing only; character art is generated with image_gen.
// Usage: node tools/build-sprite-atlases.mjs sources.json
// Install sharp locally or set SHARP_MODULE_PATH to an existing sharp package.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE_PATH || 'sharp');
const jobs = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));

for (const job of jobs) {
  const size = job.key.startsWith('boss_') ? 512 : job.key.startsWith('hero_') ? 384 : 256;
  const { data, info } = await sharp(job.source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cellW = Math.floor(info.width / 2);
  const cellH = Math.floor(info.height / 2);
  const bounds = [];
  for (let frame = 0; frame < 4; frame++) {
    const ox = (frame % 2) * cellW;
    const oy = Math.floor(frame / 2) * cellH;
    let left = cellW, top = cellH, right = 0, bottom = 0;
    for (let y = 0; y < cellH; y++) {
      for (let x = 0; x < cellW; x++) {
        if (data[((oy + y) * info.width + ox + x) * 4 + 3] < 16) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    if (right <= left || bottom <= top) throw new Error(`Empty frame: ${job.key}/${frame}`);
    bounds.push({ left: ox + left, top: oy + top, width: right - left + 1, height: bottom - top + 1 });
  }
  // A single scale for all poses keeps character size stable; every sole sits
  // on the same 90% baseline. Preserve source alpha without painting pixels.
  const scale = Math.min(size * 0.84 / Math.max(...bounds.map(b => b.width)), size * 0.86 / Math.max(...bounds.map(b => b.height)));
  const frames = [];
  for (const box of bounds) {
    const width = Math.round(box.width * scale);
    const height = Math.round(box.height * scale);
    const pixels = await sharp(job.source).extract(box).resize(width, height).png().toBuffer();
    frames.push(await sharp({ create: { width: size, height: size, channels: 4, background: '#00000000' } })
      .composite([{ input: pixels, left: Math.round((size - width) / 2), top: Math.round(size * 0.9) - height }]).png().toBuffer());
  }
  const atlasPath = job.output.replace(/\.png$/, '_walk.png');
  await fs.mkdir(path.dirname(atlasPath), { recursive: true });
  await sharp({ create: { width: size * 2, height: size * 2, channels: 4, background: '#00000000' } })
    .composite(frames.map((input, i) => ({ input, left: (i % 2) * size, top: Math.floor(i / 2) * size })))
    .png({ compressionLevel: 9 }).toFile(atlasPath);
  // The grounded contact pose also supplies the portrait / static fallback.
  await fs.writeFile(job.output, frames[0]);
  console.log(`${job.key}: ${atlasPath}`);
}
