import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertCloseTo, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Directional Rotation & Camera Perspective (R5)', () => {
  it('TC-ROT-01: Smooth facing angular lerp towards move destination with shortest-arc wrapping', async () => {
    const { module: entityMod } = await resolveModule('entities/entity');

    const ent = new entityMod.Entity({
      x: 1000,
      y: 1000,
      facing: 0,
      speed: 300,
      turnSpeed: 10.0 // 10 rad/s
    });

    assertEqual(ent.facing, 0, 'Initial facing must be 0');
    assertEqual(ent.targetFacing, 0, 'Initial targetFacing must be 0');

    // Order move directly South (y: 1500) -> targetFacing = PI / 2 (~1.5708)
    ent.moveTo(1000, 1500);
    assertCloseTo(ent.targetFacing, Math.PI / 2, 0.001, 'targetFacing must be PI / 2');

    // 1 tick (16.67ms) at turnSpeed 10 rad/s: turnStep = 0.1667 rad
    ent.update(0.01667);
    assertTrue(ent.facing > 0, `facing must smoothly turn towards PI/2, got ${ent.facing}`);
    assertTrue(ent.facing < Math.PI / 2, `facing must not overshoot PI/2 on tick 1, got ${ent.facing}`);

    // Update for 0.2s: total turn budget = 2.0 rad, which exceeds PI/2 (~1.57 rad)
    for (let i = 0; i < 15; i++) {
      ent.update(0.01667);
    }
    assertCloseTo(ent.facing, Math.PI / 2, 0.001, 'facing must converge exactly to PI / 2');

    // Shortest-arc wrapping test across [-PI, PI] boundary:
    // From +3.0 rad to -3.0 rad: the angular difference is (+2 * PI - 6.0) = +0.2832 rad
    ent.facing = 3.0;
    ent.targetFacing = -3.0;
    ent.update(0.01); // 0.1 rad turn
    assertTrue(ent.facing > 3.0 || ent.facing < -3.1, 'Must turn along shortest arc across PI boundary');
  });

  it('TC-ROT-02: Hero facing updates on attack targeting and ability aiming', async () => {
    const { module: entityMod } = await resolveModule('entities/entity');
    const { module: inputMod } = await resolveModule('core/input');

    const hero = new entityMod.HeroEntity({
      id: 'player_hero',
      x: 1000,
      y: 1000,
      facing: 0,
      turnSpeed: 15.0
    });

    const fakeCanvas = {
      addEventListener() {},
      removeEventListener() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; },
      width: 1280,
      height: 720,
      style: {}
    };
    const camera = { x: 0, y: 0, worldX: 1000, worldY: 1000, zoom: 1.0, viewportWidth: 1280, viewportHeight: 720 };
    const input = new inputMod.InputManager(fakeCanvas, camera);
    input.setPlayerHero(hero);

    // Aiming ability: trigger Q targeting state
    input.targetingState = {
      slot: 'Q',
      ability: { range: 600, radius: 150, targetType: 'ground' },
      indicator: null
    };

    const { module: iso } = await resolveModule('core/isometric');
    const screenPos = iso.worldToScreen(1000, 500, 0, camera);
    input.updateCursor(screenPos.sx, screenPos.sy);
    input.update(0.01667, hero);

    assertCloseTo(hero.targetFacing, -Math.PI / 2, 0.001, 'hero.targetFacing must point North (-PI/2) when aiming');

    // Confirm ability cast towards cursor
    let dispatchedCommand = null;
    input.onCommand(cmd => { dispatchedCommand = cmd; });
    input.confirmCast();

    assertTrue(dispatchedCommand !== null, 'Ability cast must dispatch command');
    assertEqual(dispatchedCommand.slot, 'Q');
    assertCloseTo(hero.targetFacing, -Math.PI / 2, 0.001, 'targetFacing remains aligned with cast direction');
  });

  it('TC-ROT-03: Camera perspective rotation cycling across 90-degree increments', async () => {
    const { module: cameraMod } = await resolveModule('core/camera');
    const { module: gameMod } = await resolveModule('game');
    const { module: inputMod } = await resolveModule('core/input');

    const cam = new cameraMod.Camera({
      worldX: 1000,
      worldY: 1000,
      rotation: 0,
      rotationSmoothing: 12.0
    });

    assertEqual(cam.rotation, 0, 'Initial rotation is 0');
    assertEqual(cam.targetRotation, 0, 'Initial targetRotation is 0');

    // Cycle perspective clockwise (+90 degrees = PI/2)
    cam.cyclePerspective(1);
    assertCloseTo(cam.targetRotation, Math.PI / 2, 0.001, 'targetRotation should be PI / 2');

    // Smooth lerp in Camera.update
    cam.update(0.01667);
    assertTrue(cam.rotation > 0, `rotation must increase from 0, got ${cam.rotation}`);
    assertTrue(cam.rotation < Math.PI / 2, `rotation must not reach PI/2 on tick 1, got ${cam.rotation}`);

    // Converge to PI/2 after 0.5s
    for (let i = 0; i < 30; i++) {
      cam.update(0.01667);
    }
    assertCloseTo(cam.rotation, Math.PI / 2, 0.005, 'rotation must converge to PI / 2');

    // Cycle again to PI (180 degrees)
    cam.cyclePerspective(1);
    assertCloseTo(cam.targetRotation, Math.PI, 0.001, 'targetRotation should be PI');

    // Cycle counter-clockwise (-90 degrees)
    cam.cyclePerspective(-1);
    assertCloseTo(cam.targetRotation, Math.PI / 2, 0.001, 'targetRotation decrements back to PI / 2');

    // GameSimulation handleCommand integration
    const sim = new gameMod.GameSimulation();
    sim.camera = cam;
    sim.handleCommand({ type: inputMod.CommandType.CYCLE_PERSPECTIVE, direction: 1 });
    assertCloseTo(cam.targetRotation, Math.PI, 0.001, 'GameSimulation must cycle camera perspective on command');
  });

  it('TC-ROT-04: Rotated dimetric coordinate projection and 1:1 round-trip identity across all angles', async () => {
    const { module: iso } = await resolveModule('core/isometric');

    const camera = {
      worldX: 1600,
      worldY: 1600,
      zoom: 1.2,
      viewportWidth: 1280,
      viewportHeight: 720,
      rotation: 0
    };

    const angles = [0, Math.PI / 4, Math.PI / 2, Math.PI * 0.75, Math.PI, Math.PI * 1.5, Math.PI * 2];

    for (const theta of angles) {
      camera.rotation = theta;

      // Test multiple map coordinates
      const samplePoints = [
        { wx: 400, wy: 400 },
        { wx: 1600, wy: 1600 },
        { wx: 2800, wy: 2800 },
        { wx: 1200, wy: 2400 },
        { wx: 750.5, wy: 1820.25 }
      ];

      for (const pt of samplePoints) {
        const screen = iso.worldToScreen(pt.wx, pt.wy, 0, camera);
        const unprojected = iso.screenToWorld(screen.sx, screen.sy, camera);

        assertCloseTo(unprojected.wx, pt.wx, 0.001, `World X mismatch at angle ${theta.toFixed(2)} for (${pt.wx}, ${pt.wy})`);
        assertCloseTo(unprojected.wy, pt.wy, 0.001, `World Y mismatch at angle ${theta.toFixed(2)} for (${pt.wx}, ${pt.wy})`);
      }
    }
  });

  it('TC-ROT-05: Rotated painters algorithm depth sorting along camera view axis', async () => {
    const { module: iso } = await resolveModule('core/isometric');

    const camera = {
      worldX: 1000,
      worldY: 1000,
      rotation: 0
    };

    const entityA = { id: 'ent_A', x: 800, y: 800 };
    const entityB = { id: 'ent_B', x: 1200, y: 1200 };

    // Standard unrotated view (theta = 0): entityA is behind entityB
    const depthA0 = iso.getDepthKey(entityA.x, entityA.y, camera);
    const depthB0 = iso.getDepthKey(entityB.x, entityB.y, camera);
    assertTrue(depthA0 < depthB0, 'At theta = 0, entityA (800, 800) must be behind entityB (1200, 1200)');
    assertTrue(iso.compareDepth(entityA, entityB, camera) < 0, 'compareDepth puts entityA before entityB');

    // 180-degree rotated view (theta = PI): camera viewing from the opposite side
    camera.rotation = Math.PI;
    const depthA180 = iso.getDepthKey(entityA.x, entityA.y, camera);
    const depthB180 = iso.getDepthKey(entityB.x, entityB.y, camera);
    assertTrue(depthA180 > depthB180, 'At theta = PI, entityA must now have larger depth than entityB');
    assertTrue(iso.compareDepth(entityA, entityB, camera) > 0, 'compareDepth puts entityB before entityA when rotated 180');
  });

  it('TC-ROT-06: Hero visual facing notch projects correctly under camera rotation', async () => {
    const { module: entityMod } = await resolveModule('entities/entity');
    const { module: cameraMod } = await resolveModule('core/camera');

    const hero = new entityMod.HeroEntity({
      x: 1000,
      y: 1000,
      facing: Math.PI / 2, // Facing South in world
      radius: 20
    });

    const camera = new cameraMod.Camera({
      worldX: 1000,
      worldY: 1000,
      viewportWidth: 1280,
      viewportHeight: 720,
      rotation: 0
    });

    // Mock CanvasRenderingContext2D to record drawn notch endpoints
    const drawnLines = [];
    const mockCtx = {
      save() {},
      restore() {},
      beginPath() {},
      ellipse() {},
      fill() {},
      stroke() {},
      moveTo(x, y) { drawnLines.push({ type: 'move', x, y }); },
      lineTo(x, y) { drawnLines.push({ type: 'line', x, y }); },
      set fillStyle(v) {},
      set strokeStyle(v) {},
      set lineWidth(v) {}
    };

    // Draw with camera rotation = 0
    hero.draw(mockCtx, camera, 1.0);
    const line0 = drawnLines.filter(l => l.type === 'line').pop();
    assertTrue(line0 !== null, 'Visual facing line must be drawn at rotation 0');

    // Rotate camera by PI / 2
    camera.snapZoom(1.0);
    camera.setRotation(Math.PI / 2, true);
    drawnLines.length = 0;

    hero.draw(mockCtx, camera, 1.0);
    const lineRotated = drawnLines.filter(l => l.type === 'line').pop();
    assertTrue(lineRotated !== null, 'Visual facing line must be drawn under camera rotation');

    // Position of line end must differ under rotation because camera has turned 90 degrees
    assertTrue(
      Math.abs(lineRotated.x - line0.x) > 1.0 || Math.abs(lineRotated.y - line0.y) > 1.0,
      'Visual facing notch coordinates on screen must rotate with camera perspective'
    );
  });

  it('TC-ROT-07: Key C and V dispatch CYCLE_PERSPECTIVE in InputDispatcher and InputManager', async () => {
    const { module: inputMod } = await resolveModule('core/input');

    const dispatcher = new inputMod.InputDispatcher();

    // Hotkey 'C' -> clockwise (+1)
    const cmdC = dispatcher.handleKeyDown('C');
    assertEqual(cmdC.type, inputMod.CommandType.CYCLE_PERSPECTIVE);
    assertEqual(cmdC.direction, 1);

    const cmdKeyC = dispatcher.handleKeyDown('KeyC');
    assertEqual(cmdKeyC.type, inputMod.CommandType.CYCLE_PERSPECTIVE);
    assertEqual(cmdKeyC.direction, 1);

    // Hotkey 'V' -> counter-clockwise (-1)
    const cmdV = dispatcher.handleKeyDown('V');
    assertEqual(cmdV.type, inputMod.CommandType.CYCLE_PERSPECTIVE);
    assertEqual(cmdV.direction, -1);

    const cmdKeyV = dispatcher.handleKeyDown('KeyV');
    assertEqual(cmdKeyV.type, inputMod.CommandType.CYCLE_PERSPECTIVE);
    assertEqual(cmdKeyV.direction, -1);

    // InputManager integration
    const fakeCanvas = {
      addEventListener() {},
      removeEventListener() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
    };
    const input = new inputMod.InputManager(fakeCanvas);
    let lastDispatched = null;
    input.onCommand(c => { lastDispatched = c; });

    input.handleKeyDown({ code: 'KeyC' });
    assertEqual(lastDispatched.type, inputMod.CommandType.CYCLE_PERSPECTIVE);
    assertEqual(lastDispatched.direction, 1);

    input.handleKeyDown({ code: 'KeyV' });
    assertEqual(lastDispatched.type, inputMod.CommandType.CYCLE_PERSPECTIVE);
    assertEqual(lastDispatched.direction, -1);
  });
});
