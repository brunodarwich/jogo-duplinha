import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertCloseTo, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Dynamic Camera Zoom & Unprojection Accuracy (R4)', () => {
  it('TC-ZOOM-01: Default zoom resolution reads camera.zoom when zoom argument is omitted or null', async () => {
    const { module: iso } = await resolveModule('core/isometric');

    const cameraA = { x: 0, y: 0, worldX: 500, worldY: 500, zoom: 1.4 };
    const screenA = iso.worldToScreen(600, 600, 0, cameraA);
    const worldA = iso.screenToWorld(screenA.sx, screenA.sy, cameraA);
    assertCloseTo(worldA.wx, 600, 0.001, 'worldA.wx must match 600 at camera zoom 1.4');
    assertCloseTo(worldA.wy, 600, 0.001, 'worldA.wy must match 600 at camera zoom 1.4');

    const cameraB = { x: 0, y: 0, worldX: 500, worldY: 500, zoom: 0.8 };
    const screenB = iso.worldToScreen(750, 400, 0, cameraB);
    const worldB = iso.screenToWorld(screenB.sx, screenB.sy, cameraB);
    assertCloseTo(worldB.wx, 750, 0.001, 'worldB.wx must match 750 at camera zoom 0.8');
    assertCloseTo(worldB.wy, 400, 0.001, 'worldB.wy must match 400 at camera zoom 0.8');

    // Explicit zoom override takes precedence over camera.zoom
    const screenOverride = iso.worldToScreen(600, 600, 0, cameraA, 0.7);
    const worldOverride = iso.screenToWorld(screenOverride.sx, screenOverride.sy, cameraA, 0.7);
    assertCloseTo(worldOverride.wx, 600, 0.001, 'Explicit zoom override 0.7 must invert accurately');
    assertCloseTo(worldOverride.wy, 600, 0.001, 'Explicit zoom override 0.7 must invert accurately');

    // When both camera and zoom are null, defaults to 1.0
    const screenDefault = iso.worldToScreen(500, 500, 0, null, null);
    const worldDefault = iso.screenToWorld(screenDefault.sx, screenDefault.sy, null, null);
    assertCloseTo(worldDefault.wx, 500, 0.001, 'Default zoom 1.0 must invert accurately');
    assertCloseTo(worldDefault.wy, 500, 0.001, 'Default zoom 1.0 must invert accurately');
  });

  it('TC-ZOOM-02: Camera zoom clamping strictly enforces [0.6, 1.6] boundaries', async () => {
    const { module: cameraMod } = await resolveModule('core/camera');

    // Under-bound constructor clamping
    const camUnder = new cameraMod.Camera({ zoom: 0.2 });
    assertEqual(camUnder.minZoom, 0.6, 'minZoom must be 0.6');
    assertEqual(camUnder.maxZoom, 1.6, 'maxZoom must be 1.6');
    assertEqual(camUnder.zoom, 0.6, 'Constructor zoom 0.2 must clamp to minZoom 0.6');
    assertEqual(camUnder.targetZoom, 0.6, 'Constructor targetZoom 0.2 must clamp to minZoom 0.6');

    // Over-bound constructor clamping
    const camOver = new cameraMod.Camera({ zoom: 3.5 });
    assertEqual(camOver.zoom, 1.6, 'Constructor zoom 3.5 must clamp to maxZoom 1.6');
    assertEqual(camOver.targetZoom, 1.6, 'Constructor targetZoom 3.5 must clamp to maxZoom 1.6');

    // setZoom clamping
    const cam = new cameraMod.Camera({ zoom: 1.0 });
    cam.setZoom(0.1);
    assertEqual(cam.targetZoom, 0.6, 'setZoom(0.1) must clamp targetZoom to 0.6');

    cam.setZoom(2.8);
    assertEqual(cam.targetZoom, 1.6, 'setZoom(2.8) must clamp targetZoom to 1.6');

    // zoomBy clamping
    cam.snapZoom(1.0);
    assertEqual(cam.zoom, 1.0);
    cam.zoomBy(-0.8);
    assertEqual(cam.targetZoom, 0.6, 'zoomBy(-0.8) must clamp targetZoom to 0.6');

    cam.zoomBy(1.5);
    assertEqual(cam.targetZoom, 1.6, 'zoomBy(1.5) must clamp targetZoom to 1.6');

    // snapZoom instant clamp
    cam.snapZoom(0.3);
    assertEqual(cam.zoom, 0.6, 'snapZoom(0.3) must instantly set zoom to 0.6');
    assertEqual(cam.targetZoom, 0.6, 'snapZoom(0.3) must instantly set targetZoom to 0.6');

    cam.snapZoom(2.2);
    assertEqual(cam.zoom, 1.6, 'snapZoom(2.2) must instantly set zoom to 1.6');
    assertEqual(cam.targetZoom, 1.6, 'snapZoom(2.2) must instantly set targetZoom to 1.6');
  });

  it('TC-ZOOM-03: Camera smoothly interpolates zoom towards targetZoom via exponential decay lerp', async () => {
    const { module: cameraMod } = await resolveModule('core/camera');

    const cam = new cameraMod.Camera({ zoom: 1.0, zoomSmoothing: 12.0 });
    cam.setZoom(1.5);
    assertEqual(cam.zoom, 1.0, 'zoom should not instantly jump on setZoom');
    assertEqual(cam.targetZoom, 1.5, 'targetZoom is set to 1.5');

    // Advance 1 frame (16.67ms)
    cam.update(0.01667);
    assertTrue(cam.zoom > 1.0, `zoom must have increased from 1.0, got ${cam.zoom}`);
    assertTrue(cam.zoom < 1.5, `zoom must not have reached 1.5 on first tick, got ${cam.zoom}`);

    // Advance 0.5s of simulation time (multiple frames)
    for (let i = 0; i < 30; i++) {
      cam.update(0.01667);
    }
    assertCloseTo(cam.zoom, 1.5, 0.005, 'After 0.5s, zoom must smoothly converge to targetZoom 1.5');

    // Zoom out smoothly towards 0.6
    cam.setZoom(0.6);
    for (let i = 0; i < 40; i++) {
      cam.update(0.01667);
    }
    assertCloseTo(cam.zoom, 0.6, 0.005, 'After 0.67s, zoom must smoothly converge to targetZoom 0.6');
  });

  it('TC-ZOOM-04: Non-passive wheel event handling invokes preventDefault and adjusts camera zoom', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const { module: cameraMod } = await resolveModule('core/camera');

    const camera = new cameraMod.Camera({ worldX: 1000, worldY: 1000, zoom: 1.0 });

    let preventDefaultCalled = false;
    const fakeCanvas = {
      addEventListener() {},
      removeEventListener() {},
      getBoundingClientRect() {
        return { left: 0, top: 0, width: 1280, height: 720 };
      },
      width: 1280,
      height: 720
    };

    const input = new inputMod.InputManager(fakeCanvas, camera);

    // Wheel Up (zoom in, deltaY < 0)
    const wheelInEvent = {
      deltaY: -100,
      clientX: 640,
      clientY: 360,
      preventDefault: () => { preventDefaultCalled = true; }
    };

    input.handleWheel(wheelInEvent);
    assertTrue(preventDefaultCalled, 'preventDefault must be called on wheel event');
    assertCloseTo(camera.targetZoom, 1.1, 0.001, 'Wheel up should increment targetZoom by 0.1');

    // Wheel Down (zoom out, deltaY > 0)
    preventDefaultCalled = false;
    const wheelOutEvent = {
      deltaY: 120,
      clientX: 640,
      clientY: 360,
      preventDefault: () => { preventDefaultCalled = true; }
    };

    input.handleWheel(wheelOutEvent);
    assertTrue(preventDefaultCalled, 'preventDefault must be called on wheel down');
    assertCloseTo(camera.targetZoom, 1.0, 0.001, 'Wheel down should decrement targetZoom by 0.1');

    // Cursor coordinates updated accurately
    assertCloseTo(input.worldX, 1000, 1.0, 'Center screen cursor must unproject to camera world center');
    assertCloseTo(input.worldY, 1000, 1.0, 'Center screen cursor must unproject to camera world center');
  });

  it('TC-ZOOM-05: InputDispatcher dynamically resolves effectiveZoom from camera', async () => {
    const { module: inputMod } = await resolveModule('core/input');

    const camera = { x: 0, y: 0, worldX: 600, worldY: 600, zoom: 1.0, viewportWidth: 1280, viewportHeight: 720 };
    const dispatcher = new inputMod.InputDispatcher(camera);

    assertEqual(dispatcher.effectiveZoom, 1.0, 'Initial effectiveZoom should be 1.0');

    // Change camera zoom dynamically
    camera.zoom = 1.4;
    assertEqual(dispatcher.effectiveZoom, 1.4, 'effectiveZoom must dynamically track camera.zoom = 1.4');

    // Mouse click unprojects with dynamic zoom
    const cmd = dispatcher.handleMouseDown(2, 640, 360);
    assertEqual(cmd.type, inputMod.CommandType.MOVE_TO);
    assertCloseTo(cmd.x, 600, 0.001, 'Center click must unproject to world center (600, 600)');
    assertCloseTo(cmd.y, 600, 0.001, 'Center click must unproject to world center (600, 600)');
  });

  it('TC-ZOOM-06: 1,000-Point round-trip unprojection accuracy across 0.6x, 1.0x, 1.6x zoom levels', async () => {
    const { module: iso } = await resolveModule('core/isometric');

    const testZoomLevels = [0.6, 1.0, 1.6];
    const camera = { x: 0, y: 0, worldX: 1600, worldY: 1600, viewportWidth: 1280, viewportHeight: 720 };

    for (const zoom of testZoomLevels) {
      camera.zoom = zoom;
      let maxDelta = 0;

      for (let i = 0; i < 1000; i++) {
        // Deterministic pseudo-random coordinates covering the 3200x3200 game map
        const wx = ((i * 7919 + 31) % 32000) / 10.0;
        const wy = ((i * 6271 + 17) % 32000) / 10.0;

        const screen = iso.worldToScreen(wx, wy, 0, camera, zoom);
        const unprojected = iso.screenToWorld(screen.sx, screen.sy, camera, zoom);

        const deltaX = Math.abs(unprojected.wx - wx);
        const deltaY = Math.abs(unprojected.wy - wy);
        if (deltaX > maxDelta) maxDelta = deltaX;
        if (deltaY > maxDelta) maxDelta = deltaY;

        if (deltaX > 0.001 || deltaY > 0.001) {
          throw new Error(`Round-trip mismatch at zoom ${zoom} for point (${wx}, ${wy}): got (${unprojected.wx}, ${unprojected.wy})`);
        }
      }

      assertTrue(maxDelta < 0.001, `Max unprojection delta at zoom ${zoom} must be < 0.001, was ${maxDelta}`);
    }
  });

  it('TC-ZOOM-07: Entity picking precision across different zoom levels', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const { module: cameraMod } = await resolveModule('core/camera');
    const { module: iso } = await resolveModule('core/isometric');

    const camera = new cameraMod.Camera({ worldX: 1500, worldY: 1500, viewportWidth: 1280, viewportHeight: 720 });
    const fakeCanvas = {
      addEventListener() {},
      removeEventListener() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; },
      width: 1280,
      height: 720
    };
    const input = new inputMod.InputManager(fakeCanvas, camera);

    const targetEntity = {
      id: 'target_minion_1',
      type: 'minion',
      team: 'enemy',
      x: 1550,
      y: 1480,
      z: 0,
      radius: 20,
      selectionRadius: 30,
      hp: 200,
      isAlive: () => true
    };
    const entityManager = [targetEntity];

    // Test picking at 0.6x, 1.0x, 1.6x
    const zoomLevels = [0.6, 1.0, 1.6];
    for (const zoom of zoomLevels) {
      camera.snapZoom(zoom);
      const screenPos = iso.worldToScreen(targetEntity.x, targetEntity.y, 0, camera, zoom);

      // Move cursor right onto target projected position
      input.updateCursor(screenPos.sx, screenPos.sy);
      const picked = input.pickEntity(entityManager, null);
      assertTrue(picked !== null, `Target must be picked at zoom ${zoom}`);
      assertEqual(picked.id, 'target_minion_1', `Target id must match at zoom ${zoom}`);
    }
  });
});
