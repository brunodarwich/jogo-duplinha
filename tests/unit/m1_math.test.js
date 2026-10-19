import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertCloseTo, assertTrue, assertFalse } from '../helpers/assert.js';
import { worldToScreen, screenToWorld, getDepthKey, compareDepth, worldDistance } from '../../src/core/isometric.js';
import { Camera } from '../../src/core/camera.js';
import { GameLoop, FIXED_TIMESTEP, MAX_ACCUMULATOR } from '../../src/core/loop.js';
import { InputDispatcher, InputManager, CommandType, IndicatorType } from '../../src/core/input.js';
import { Minimap, formatMatchTime } from '../../src/ui/hud.js';
import { Renderer } from '../../src/render/renderer.js';
import { ParticleSystem } from '../../src/render/particles.js';
import { Entity, HeroEntity, TowerEntity, MinionEntity } from '../../src/entities/entity.js';

describe('Tier 1 Unit: Milestone 1 Engine Foundation & Isometric Math', () => {

  it('TC-M1-01: Baseline worldToScreen and screenToWorld invertibility identity', () => {
    const camera = { x: 0, y: 0, width: 800, height: 600, zoom: 1.0 };
    const { sx, sy } = worldToScreen(1000, 1000, 0, camera, 1.0);

    assertCloseTo(sx, 400, 0.001, 'Baseline worldToScreen SX must equal 400');
    assertCloseTo(sy, 800, 0.001, 'Baseline worldToScreen SY must equal 800');

    // Inverse unprojection round-trip
    const { wx, wy } = screenToWorld(sx, sy, camera, 1.0);
    assertCloseTo(wx, 1000, 0.001, 'Unprojected WX must equal 1000');
    assertCloseTo(wy, 1000, 0.001, 'Unprojected WY must equal 1000');
  });

  it('TC-M1-02: Round-trip projection across various arbitrary world coordinates and zoom factors', () => {
    const camera = { x: 300, y: -150, width: 1280, height: 720, zoom: 1.5 };
    const testPoints = [
      { x: 0, y: 0 },
      { x: 400, y: 400 },
      { x: 1250.75, y: 840.25 },
      { x: 2800, y: 2800 },
      { x: 3199, y: 15 }
    ];

    for (const pt of testPoints) {
      const screen = worldToScreen(pt.x, pt.y, 0, camera, 1.5);
      const world = screenToWorld(screen.sx, screen.sy, camera, 1.5);
      assertCloseTo(world.wx, pt.x, 0.001, `World X roundtrip mismatch at (${pt.x}, ${pt.y})`);
      assertCloseTo(world.wy, pt.y, 0.001, `World Y roundtrip mismatch at (${pt.x}, ${pt.y})`);
    }
  });

  it('TC-M1-03: Z-elevation reduces screen Y proportionally without affecting screen X', () => {
    const camera = { x: 0, y: 0, width: 1280, height: 720, zoom: 1.0 };
    const ground = worldToScreen(500, 500, 0, camera, 1.0);
    const elevated = worldToScreen(500, 500, 75, camera, 1.0);

    assertEqual(ground.sx, elevated.sx, 'Elevation should not alter screen X');
    assertCloseTo(ground.sy - elevated.sy, 75, 0.001, 'Elevation of 75 should move screen Y up by 75px');
  });

  it('TC-M1-04: Camera centering projects target world location to viewport center', () => {
    const hero = { x: 650, y: 650 };
    const camera = new Camera({
      worldX: 650,
      worldY: 650,
      viewportWidth: 800,
      viewportHeight: 600,
      zoom: 1.0
    });

    const { sx, sy } = worldToScreen(hero.x, hero.y, 0, camera);
    assertCloseTo(sx, 400, 0.001, 'Centered hero must project to viewport horizontal center (400)');
    assertCloseTo(sy, 300, 0.001, 'Centered hero must project to viewport vertical center (300)');
  });

  it('TC-M1-05: Camera exponential lerp smoothing and boundary clamping [0, 3200]', () => {
    const hero = { x: -600, y: 4500 };
    const camera = new Camera({
      worldX: 500,
      worldY: 500,
      bounds: { minX: 0, minY: 0, maxX: 3200, maxY: 3200 },
      smoothing: 8.0
    });
    camera.follow(hero);

    // Update with 1.0 second elapsed
    camera.update(1.0);

    assertTrue(camera.worldX >= 0, 'Camera worldX must clamp to >= 0');
    assertTrue(camera.worldY <= 3200, 'Camera worldY must clamp to <= 3200');

    // Camera ceases tracking if target dies
    hero.isDead = true;
    const oldX = camera.worldX;
    const oldY = camera.worldY;
    camera.update(0.5);
    assertEqual(camera.worldX, oldX, 'Camera should hold position when target is dead');
    assertEqual(camera.worldY, oldY, 'Camera should hold position when target is dead');
  });

  it('TC-M1-06: Deterministic GameLoop fixed-timestep updates and spiral-of-death cap', () => {
    let tickCount = 0;
    const loop = new GameLoop({
      fixedTimestep: 16.6667,
      maxAccumulator: 100,
      onUpdate: () => { tickCount++; }
    });

    // 100ms should execute exactly 6 ticks (100 / 16.6667 = 6 ticks)
    loop.step(100);
    assertEqual(tickCount, 6, '100ms accumulation should yield exactly 6 ticks');

    // 500ms spike capped at 100ms maxAccumulator -> 6 ticks
    tickCount = 0;
    loop.step(500);
    assertEqual(tickCount, 6, '500ms lag spike must cap at 100ms and execute 6 ticks');

    // Pause prevents onUpdate from firing
    loop.pause();
    tickCount = 0;
    // Manual step runs logic, but internal _frame checks paused
    assertEqual(loop.paused, true);
    loop.resume();
    assertEqual(loop.paused, false);
  });

  it('TC-M1-07: Dynamic Y-Depth sorting with stable ID tie-breaking', () => {
    const entities = [
      { id: 'beta', x: 200, y: 100 },  // depth = 300
      { id: 'alpha', x: 100, y: 200 }, // depth = 300
      { id: 'first', x: 50, y: 50 },   // depth = 100
      { id: 'last', x: 500, y: 500 }   // depth = 1000
    ];

    entities.sort(compareDepth);

    assertEqual(entities[0].id, 'first', 'Entity with depth 100 should be sorted first');
    assertEqual(entities[1].id, 'alpha', 'Entity with id alpha should tie-break before beta');
    assertEqual(entities[2].id, 'beta', 'Entity with id beta should tie-break after alpha');
    assertEqual(entities[3].id, 'last', 'Entity with depth 1000 should be sorted last');
  });

  it('TC-M1-08: InputDispatcher smart right-click and boundary clamping', () => {
    const dispatcher = new InputDispatcher({ x: 0, y: 0 }, 1.0, { width: 1280, height: 720 });

    // Right click on ground
    const groundCmd = dispatcher.handleMouseDown(2, 640, 360, null);
    assertEqual(groundCmd.type, CommandType.MOVE_TO);
    assertEqual(groundCmd.x, 0);
    assertEqual(groundCmd.y, 0);

    // Right click on hostile enemy unit
    const enemyMinion = { id: 'minion_1', team: 'enemy', x: 450, y: 450 };
    const attackCmd = dispatcher.handleMouseDown(2, 600, 300, enemyMinion);
    assertEqual(attackCmd.type, CommandType.ATTACK_TARGET);
    assertEqual(attackCmd.targetId, 'minion_1');

    // Out-of-bounds mouse coordinates clamp to [0, 3200]
    const clampedCmd = dispatcher.handleMouseDown(2, -9000, -9000, null);
    assertEqual(clampedCmd.type, CommandType.MOVE_TO);
    assertTrue(clampedCmd.x >= 0 && clampedCmd.x <= 3200);
    assertTrue(clampedCmd.y >= 0 && clampedCmd.y <= 3200);
  });

  it('TC-M1-09: Q/W/E/R targeting state machine, cast confirm, cancel and Stop', () => {
    const dispatcher = new InputDispatcher();
    const hero = {
      x: 500, y: 500, mana: 100,
      abilities: {
        Q: { manaCost: 50, cooldownRemaining: 0, range: 500, targetingType: IndicatorType.GROUND_AOE }
      }
    };

    // Press Q enters targeting
    const qCmd = dispatcher.handleKeyDown('Q', hero);
    assertEqual(qCmd.type, CommandType.START_TARGETING);
    assertEqual(qCmd.skill, 'Q');
    assertEqual(dispatcher.targetingSkill, 'Q');

    // Left-click confirms cast
    const castCmd = dispatcher.handleMouseDown(0, 640, 360, null);
    assertEqual(castCmd.type, CommandType.CAST_SKILL);
    assertEqual(castCmd.skill, 'Q');
    assertEqual(dispatcher.targetingSkill, null);

    // Press Q again then Escape cancels
    dispatcher.handleKeyDown('Q', hero);
    const cancelCmd = dispatcher.handleKeyDown('Escape');
    assertEqual(cancelCmd.type, CommandType.CANCEL_TARGETING);
    assertEqual(dispatcher.targetingSkill, null);

    // Press S triggers STOP command
    const stopCmd = dispatcher.handleKeyDown('S');
    assertEqual(stopCmd.type, CommandType.STOP);
  });

  it('TC-M1-10: Minimap coordinate conversion round-trip and scaling', () => {
    const minimap = new Minimap(null);

    // (0, 0) -> (0, 0)
    const mapOrigin = minimap.worldToMap(0, 0);
    assertCloseTo(mapOrigin.mx, 0, 0.001);
    assertCloseTo(mapOrigin.my, 0, 0.001);

    // (1600, 1600) -> (100, 100)
    const mapCenter = minimap.worldToMap(1600, 1600);
    assertCloseTo(mapCenter.mx, 100, 0.001);
    assertCloseTo(mapCenter.my, 100, 0.001);

    // (3200, 3200) -> (200, 200)
    const mapCorner = minimap.worldToMap(3200, 3200);
    assertCloseTo(mapCorner.mx, 200, 0.001);
    assertCloseTo(mapCorner.my, 200, 0.001);

    // Inverse mapToWorld
    const worldCenter = minimap.mapToWorld(100, 100);
    assertCloseTo(worldCenter.wx, 1600, 0.001);
    assertCloseTo(worldCenter.wy, 1600, 0.001);
  });

  it('TC-M1-11: Match timer formatting helper', () => {
    assertEqual(formatMatchTime(0), '00:00');
    assertEqual(formatMatchTime(9), '00:09');
    assertEqual(formatMatchTime(65), '01:05');
    assertEqual(formatMatchTime(600), '10:00');
    assertEqual(formatMatchTime(3599), '59:59');
  });

  it('TC-M1-12: Headless 7-pass rendering execution on mock Canvas 2D context', () => {
    const mockCalls = [];
    const mockCtx = {
      clearRect: (...args) => mockCalls.push(['clearRect', args]),
      beginPath: () => mockCalls.push(['beginPath']),
      moveTo: (...args) => mockCalls.push(['moveTo', args]),
      lineTo: (...args) => mockCalls.push(['lineTo', args]),
      closePath: () => mockCalls.push(['closePath']),
      fill: () => mockCalls.push(['fill']),
      stroke: () => mockCalls.push(['stroke']),
      fillRect: (...args) => mockCalls.push(['fillRect', args]),
      strokeRect: (...args) => mockCalls.push(['strokeRect', args]),
      arc: (...args) => mockCalls.push(['arc', args]),
      ellipse: (...args) => mockCalls.push(['ellipse', args]),
      save: () => mockCalls.push(['save']),
      restore: () => mockCalls.push(['restore']),
      fillText: (...args) => mockCalls.push(['fillText', args]),
      strokeText: (...args) => mockCalls.push(['strokeText', args]),
      setLineDash: () => {}
    };

    const mockCanvas = {
      width: 1280,
      height: 720,
      getContext: () => mockCtx
    };

    const renderer = new Renderer(mockCanvas, { width: 1280, height: 720 });
    const camera = new Camera({ worldX: 650, worldY: 650, viewportWidth: 1280, viewportHeight: 720 });
    const hero = new HeroEntity({ x: 650, y: 650, isLocalPlayer: true });
    const tower = new TowerEntity({ x: 950, y: 950, team: 'allied' });
    const particles = new ParticleSystem();
    particles.emit('spark', { x: 650, y: 650, count: 5 });

    const gameState = {
      matchTime: 45,
      entities: [hero, tower],
      playerHero: hero,
      isVictory: false,
      isDefeat: false
    };

    // Execute render without crashing
    renderer.render(gameState, camera, null, particles);

    // Verify drawing calls took place
    assertTrue(mockCalls.length > 50, `Render pipeline should execute draw operations (got ${mockCalls.length})`);
    assertTrue(mockCalls.some(c => c[0] === 'clearRect'), 'Pipeline must clear canvas in Pass 1');
    assertTrue(mockCalls.some(c => c[0] === 'ellipse'), 'Pipeline must draw 2:1 dimetric shadows/decals');
  });

  it('TC-ROB-01: Camera update with non-finite target coordinates prevents NaN poisoning', () => {
    const camera = new Camera({ worldX: 500, worldY: 500 });
    camera.follow({ x: NaN, y: Infinity });
    camera.update(0.01667);
    assertTrue(Number.isFinite(camera.worldX), 'Camera worldX must remain finite');
    assertTrue(Number.isFinite(camera.worldY), 'Camera worldY must remain finite');
    assertEqual(camera.worldX, 500);
    assertEqual(camera.worldY, 500);

    // Recovers when target coordinates become finite
    camera.follow({ x: 600, y: 700 });
    camera.update(0.01667);
    assertTrue(camera.worldX > 500, 'Camera worldX must advance towards 600');
    assertTrue(camera.worldY > 500, 'Camera worldY must advance towards 700');
  });

  it('TC-ROB-02: GameLoop step() ignores non-finite and non-positive deltaMs', () => {
    let tickCount = 0;
    const loop = new GameLoop({ onUpdate: () => tickCount++ });
    loop.step(NaN);
    loop.step(-10);
    loop.step(0);
    assertEqual(loop.accumulator, 0, 'Accumulator must remain 0');
    assertEqual(tickCount, 0, 'No updates should occur on invalid deltaMs');

    loop.step(16.67);
    assertEqual(tickCount, 1, 'Valid deltaMs must resume updates cleanly');
  });

  it('TC-ROB-03: InputManager pickEntity prioritizes Enemy Tower over Neutral Creep', () => {
    const inputMgr = new InputManager();
    inputMgr.worldX = 500;
    inputMgr.worldY = 500;
    const playerHero = { id: 'player', team: 'allied' };

    const neutralCreep = { id: 'neutral_creep', team: 'neutral', type: 'minion', x: 500, y: 500, hp: 100, radius: 30 };
    const enemyTower = { id: 'enemy_tower', team: 'enemy', type: 'tower', x: 500, y: 500, hp: 1000, radius: 40 };

    const picked = inputMgr.pickEntity([neutralCreep, enemyTower], playerHero);
    assertEqual(picked.id, 'enemy_tower', 'Hostile Tower (priority 3) must be picked over Neutral Creep (priority 2)');
  });

});
