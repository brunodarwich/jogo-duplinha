import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertCloseTo, assertTrue } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: 2:1 Dimetric Isometric Projection & Math', () => {
  it('TC-ISO-01: Projects ground origin (0, 0, 0) to viewport center', async () => {
    const { module: iso } = await resolveModule('core/isometric');
    const viewport = { width: 1280, height: 720 };
    const camera = { x: 0, y: 0 };
    const screen = iso.worldToScreen(0, 0, 0, camera, 1.0, viewport);

    assertEqual(screen.sx, 640, 'Screen X should be centered at vw/2 (640)');
    assertEqual(screen.sy, 360, 'Screen Y should be centered at vh/2 (360)');
  });

  it('TC-ISO-02: Round-trip invertibility: screenToWorld(worldToScreen(x, y))', async () => {
    const { module: iso } = await resolveModule('core/isometric');
    const viewport = { width: 1920, height: 1080 };
    const camera = { x: 150, y: 220 };
    const zoom = 1.25;

    const testCoords = [
      { x: 0, y: 0 },
      { x: 500, y: 350 },
      { x: 1250.5, y: 840.25 },
      { x: 2800, y: 2800 }
    ];

    for (const c of testCoords) {
      const screen = iso.worldToScreen(c.x, c.y, 0, camera, zoom, viewport);
      const world = iso.screenToWorld(screen.sx, screen.sy, camera, zoom, viewport);
      assertCloseTo(world.wx, c.x, 0.001, `World X mismatch for coord (${c.x}, ${c.y})`);
      assertCloseTo(world.wy, c.y, 0.001, `World Y mismatch for coord (${c.x}, ${c.y})`);
    }
  });

  it('TC-ISO-03: Elevation Wz reduces screen Y without altering screen X', async () => {
    const { module: iso } = await resolveModule('core/isometric');
    const ground = iso.worldToScreen(100, 100, 0);
    const elevated = iso.worldToScreen(100, 100, 50);

    assertEqual(ground.sx, elevated.sx, 'Elevation should not change horizontal projection (sx)');
    assertEqual(ground.sy - elevated.sy, 50, 'Elevation of +50 should move screen position up by 50px');
  });

  it('TC-ISO-04: Camera translation shifts screen projection inversely', async () => {
    const { module: iso } = await resolveModule('core/isometric');
    const pos1 = iso.worldToScreen(100, 100, 0, { x: 0, y: 0 });
    const pos2 = iso.worldToScreen(100, 100, 0, { x: 100, y: 50 });

    assertEqual(pos1.sx - pos2.sx, 100, 'Camera X offset +100 should shift screen left by 100');
    assertEqual(pos1.sy - pos2.sy, 50, 'Camera Y offset +50 should shift screen up by 50');
  });

  it('TC-ISO-05: Zoom factor scales offsets from screen center', async () => {
    const { module: iso } = await resolveModule('core/isometric');
    const viewport = { width: 1000, height: 1000 };
    const pNormal = iso.worldToScreen(10, 0, 0, { x: 0, y: 0 }, 1.0, viewport);
    const pZoomed = iso.worldToScreen(10, 0, 0, { x: 0, y: 0 }, 2.0, viewport);

    const offsetNormalX = pNormal.sx - 500;
    const offsetZoomedX = pZoomed.sx - 500;
    assertCloseTo(offsetZoomedX, offsetNormalX * 2, 0.001, 'Zoom 2.0x should double distance from center');
  });

  it('TC-ISO-06: DepthKey Wx + Wy provides monotonic depth order', async () => {
    const { module: iso } = await resolveModule('core/isometric');
    const entityA = { x: 100, y: 100 };
    const entityB = { x: 150, y: 100 };
    const entityC = { x: 200, y: 200 };

    const depthA = iso.getDepthKey(entityA.x, entityA.y);
    const depthB = iso.getDepthKey(entityB.x, entityB.y);
    const depthC = iso.getDepthKey(entityC.x, entityC.y);

    assertTrue(depthA < depthB, 'Entity A should be behind Entity B');
    assertTrue(depthB < depthC, 'Entity B should be behind Entity C');
  });

  it('TC-ISO-07: Sanitizes NaN and non-finite inputs gracefully', async () => {
    const { module: iso } = await resolveModule('core/isometric');
    const screen = iso.worldToScreen(NaN, Infinity, undefined);
    assertTrue(Number.isFinite(screen.sx), 'Screen sx must be finite');
    assertTrue(Number.isFinite(screen.sy), 'Screen sy must be finite');
  });
});
