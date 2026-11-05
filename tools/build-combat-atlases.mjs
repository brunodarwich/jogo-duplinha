// Mechanical packing only. Poses and effects must come from image_gen.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { HERO_ACTION_DISPLAY_SCALE, HERO_ACTION_GROUND_ANCHOR } from '../src/render/hero_action.js';
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE_PATH || 'sharp');
const manifest = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
const size = 384;
const displayScale = HERO_ACTION_DISPLAY_SCALE;

// Opaque dark outlines locate the body independently of translucent spell glow.
function bodyAnchor(data, width, height, channels, ox = 0, oy = 0, stride = width) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = 0; x < width; x++) {
      const p = ((y + oy) * stride + x + ox) * channels;
      if (data[p + 3] > 230 && data[p] + data[p + 1] + data[p + 2] < 210) count++;
    }
    if (count >= width * 0.018) rows.push(y);
  }
  if (!rows.length) throw new Error('No opaque character outlines');
  return { top: rows[0], bottom: rows.at(-1), height: rows.at(-1) - rows[0] + 1 };
}

for (const job of manifest.assets) {
  const ref = await sharp(job.reference).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const refBody = bodyAnchor(ref.data, ref.info.width, ref.info.height, 4);
  const src = await sharp(job.source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = Math.floor(src.info.width / 2), h = Math.floor(src.info.height / 2);
  // Optional normalized crop boxes handle poses whose effects cross an empty
  // grid gutter, without synthesizing or painting any image pixels.
  const boxes = Array.from({ length: 4 }, (_, i) => {
    const b = job.frameBoxes?.[i];
    if (!b) return { left: i % 2 * w, top: Math.floor(i / 2) * h, width: w, height: h, centerX: (i % 2 + 0.5) * w };
    const left = Math.round(b.left * src.info.width), top = Math.round(b.top * src.info.height);
    return { left, top, width: Math.round(b.right * src.info.width) - left, height: Math.round(b.bottom * src.info.height) - top, centerX: b.centerX * src.info.width };
  });
  const anchors = boxes.map(b => bodyAnchor(src.data, b.width, b.height, 4, b.left, b.top, src.info.width));
  const heights = anchors.map(a => a.height).sort((a, b) => a - b);
  const scale = (refBody.height / ref.info.height * size) / displayScale / ((heights[1] + heights[2]) / 2);
  const frames = [];
  for (let i = 0; i < 4; i++) {
    const { centerX, ...box } = boxes[i];
    const frame = await sharp(job.source).extract(box)
      .resize(Math.round(box.width * scale), Math.round(box.height * scale)).png().toBuffer();
    const trimmed = await sharp(frame).trim({ threshold: 16 }).png().toBuffer({ resolveWithObject: true });
    const left = Math.round(size / 2 - (centerX - box.left) * scale) - trimmed.info.trimOffsetLeft;
    const top = Math.round(size * HERO_ACTION_GROUND_ANCHOR - anchors[i].bottom * scale) - trimmed.info.trimOffsetTop;
    if (left < 0 || top < 0 || left + trimmed.info.width > size || top + trimmed.info.height > size) throw new Error(`Frame needs manual padding: ${job.key}/${i} ${JSON.stringify({left,top,width:trimmed.info.width,height:trimmed.info.height,scale,anchors})}`);
    frames.push(await sharp({ create: { width: size, height: size, channels: 4, background: '#00000000' } })
      .composite([{ input: trimmed.data, left, top }]).png().toBuffer());
  }
  await sharp({ create: { width: size * 2, height: size * 2, channels: 4, background: '#00000000' } })
    .composite(frames.map((input, i) => ({ input, left: i % 2 * size, top: Math.floor(i / 2) * size })))
    .png({ compressionLevel: 9 }).toFile(job.atlas);
  console.log(job.atlas);
}
