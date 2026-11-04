import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue } from '../helpers/assert.js';
import { readFileSync } from 'node:fs';

describe('Chibi walk animation', () => {
  it('ships a complete transparent 2x2 atlas for all fourteen characters', async () => {
    const { SPRITE_PATHS } = await import('../../src/render/sprite_loader.js');
    const paths = Object.entries(SPRITE_PATHS).filter(([key]) => key.endsWith('_walk'));
    assertEqual(paths.length, 14);
    for (const [, path] of paths) {
      const png = readFileSync(new URL(`../../${path}`, import.meta.url));
      assertEqual(png.toString('ascii', 1, 4), 'PNG');
      assertEqual(png.readUInt32BE(16), png.readUInt32BE(20));
      assertEqual(png.readUInt32BE(16) % 2, 0);
      assertEqual(png[25], 6, `${path} must retain RGBA`);
    }
  });

  it('advances four frames, loops seamlessly and holds a neutral pose at rest', async () => {
    const { getWalkFrame } = await import('../../src/render/sprite_loader.js');
    for (let frame = 0; frame < 4; frame++) {
      assertEqual(getWalkFrame(frame * 125, true), frame);
    }
    assertEqual(getWalkFrame(500, true), 0);
    assertEqual(getWalkFrame(990, false), 0);
  });

  it('crops one frame, keeps feet anchored and preserves facing', async () => {
    const previousWindow = globalThis.window;
    const previousImage = globalThis.Image;
    try {
      globalThis.window = {};
      globalThis.Image = class {
        set src(value) {
          this.width = this.naturalWidth = value.includes('_walk') ? 1024 : 512;
          this.height = this.naturalHeight = this.width;
          this.complete = true;
          this.onload();
        }
      };
      const { getHeroSprite, drawChibiSprite } = await import('../../src/render/sprite_loader.js?animation-test');
      const calls = [];
      const ctx = {
        save() {}, restore() {}, translate(...args) { calls.push(['translate', ...args]); },
        scale(...args) { calls.push(['scale', ...args]); },
        drawImage(...args) { calls.push(['drawImage', ...args]); }
      };
      const img = getHeroSprite('knight');
      assertTrue(drawChibiSprite(ctx, img, 100, 200, 78, 78, { isMoving: true, flipX: true, now: 250 }));
      const draw = calls.find(call => call[0] === 'drawImage');
      assertEqual(draw.length, 10);
      assertEqual(draw[2], 0);
      assertEqual(draw[3], 512);
      assertEqual(draw[4], 512);
      assertEqual(draw[5], 512);
      assertEqual(calls[0][2], 200);
      assertEqual(calls[1][1], -1);
      assertEqual(calls[1][2], 1);
      calls.length = 0;
      drawChibiSprite(ctx, img, 100, 200, 78, 78, { isMoving: false, now: 250 });
      const idle = calls.find(call => call[0] === 'drawImage');
      assertEqual(idle[2], 0);
      assertEqual(idle[3], 0);
    } finally {
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
      if (previousImage === undefined) delete globalThis.Image;
      else globalThis.Image = previousImage;
    }
  });

  it('retains static rendering for unregistered images and procedural fallback when absent', async () => {
    const { drawChibiSprite } = await import('../../src/render/sprite_loader.js');
    let args;
    const ctx = { save() {}, restore() {}, drawImage(...values) { args = values; } };
    assertTrue(drawChibiSprite(ctx, { width: 512, height: 512 }, 0, 0, 78, 78));
    assertEqual(args.length, 5);
    assertEqual(drawChibiSprite(ctx, null, 0, 0, 78, 78), false);
  });

  it('keeps a visible character when its walk atlas fails to load', async () => {
    const previousWindow = globalThis.window;
    const previousImage = globalThis.Image;
    try {
      globalThis.window = {};
      globalThis.Image = class {
        set src(value) {
          if (value.includes('_walk')) { this.onerror(); return; }
          this.width = this.height = this.naturalWidth = 512;
          this.complete = true;
          this.onload();
        }
      };
      const { getHeroSprite, drawChibiSprite } = await import('../../src/render/sprite_loader.js?fallback-test');
      const img = getHeroSprite('sorceress');
      let args;
      const ctx = { save() {}, restore() {}, drawImage(...values) { args = values; } };
      assertTrue(drawChibiSprite(ctx, img, 100, 200, 78, 78, { isMoving: true }));
      assertEqual(args[0], img);
      assertEqual(args.length, 5);
    } finally {
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
      if (previousImage === undefined) delete globalThis.Image;
      else globalThis.Image = previousImage;
    }
  });

  it('only marks bosses as walking when their position actually advances', async () => {
    const { StoneColossusBoss, AbyssalBehemothBoss } = await import('../../src/world/boss.js');
    for (const Boss of [StoneColossusBoss, AbyssalBehemothBoss]) {
      const boss = new Boss({ x: 1000, y: 1000 });
      const target = { id: 'ally', x: 1400, y: 1000, hp: 1000, team: 'allied' };
      boss.update(0.016, [target]);
      assertEqual(boss.isMoving, true);
      target.x = boss.x + 20;
      boss.update(0.016, [target]);
      assertEqual(boss.isMoving, false);
    }
  });
});
