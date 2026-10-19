import { worldToScreen, screenToWorld, sanitize, getDepthKey, compareDepth } from '../../../src/core/isometric.js';
import { Camera } from '../../../src/core/camera.js';
import { InputDispatcher, InputManager, CommandType, IndicatorType } from '../../../src/core/input.js';
import { GameLoop } from '../../../src/core/loop.js';
import { Entity, HeroEntity, TowerEntity, MinionEntity } from '../../../src/entities/entity.js';
import { Renderer } from '../../../src/render/renderer.js';

console.log('=== ADVERSARIAL STRESS TEST SUITE: REVIEWER M1-2 ===\n');

// ─────────────────────────────────────────────────────────────
// 1. NON-FINITE AND BOUNDARY UNPROJECTION TESTING
// ─────────────────────────────────────────────────────────────
console.log('--- TEST 1: Non-finite Numbers & Boundary Clamping ---');
const cam = { x: 0, y: 0, width: 1280, height: 720, zoom: 1.0 };

const nonFiniteInputs = [
  { name: 'NaN', sx: NaN, sy: NaN },
  { name: 'Infinity', sx: Infinity, sy: Infinity },
  { name: '-Infinity', sx: -Infinity, sy: -Infinity },
  { name: 'undefined', sx: undefined, sy: undefined },
  { name: 'null', sx: null, sy: null },
  { name: 'string', sx: 'foo', sy: 'bar' },
  { name: 'extreme negative', sx: -1e12, sy: -1e12 },
  { name: 'extreme positive', sx: 1e12, sy: 1e12 }
];

for (const input of nonFiniteInputs) {
  const res = screenToWorld(input.sx, input.sy, cam, 1.0);
  const isValid = Number.isFinite(res.wx) && Number.isFinite(res.wy);
  console.log(`screenToWorld with ${input.name}: wx=${res.wx}, wy=${res.wy} -> Finite? ${isValid}`);
  if (!isValid) {
    console.error(`FAIL: screenToWorld failed for ${input.name}`);
  }
}

// InputDispatcher boundary clamping
const dispatcher = new InputDispatcher({ x: 0, y: 0 }, 1.0, { width: 1280, height: 720 });
const cmdNeg = dispatcher.handleMouseDown(2, -999999, -999999);
const cmdPos = dispatcher.handleMouseDown(2, 999999, 999999);
const cmdNaN = dispatcher.handleMouseDown(2, NaN, NaN);
console.log('InputDispatcher cmdNeg:', cmdNeg);
console.log('InputDispatcher cmdPos:', cmdPos);
console.log('InputDispatcher cmdNaN:', cmdNaN);

const clampedNeg = cmdNeg.x >= 0 && cmdNeg.x <= 3200 && cmdNeg.y >= 0 && cmdNeg.y <= 3200;
const clampedPos = cmdPos.x >= 0 && cmdPos.x <= 3200 && cmdPos.y >= 0 && cmdPos.y <= 3200;
const clampedNaN = cmdNaN.x >= 0 && cmdNaN.x <= 3200 && cmdNaN.y >= 0 && cmdNaN.y <= 3200;

console.log(`Clamped Neg: ${clampedNeg}, Clamped Pos: ${clampedPos}, Clamped NaN: ${clampedNaN}\n`);


// ─────────────────────────────────────────────────────────────
// 2. PICKING HIERARCHY STRESS TESTING
// ─────────────────────────────────────────────────────────────
console.log('--- TEST 2: Entity Picking Hierarchy ---');
// Hierarchy required: Enemy Hero > Creep > Boss/Tower > Neutral > Ally
const manager = new InputManager(null, new Camera());
manager.worldX = 1000;
manager.worldY = 1000;

const playerHero = { id: 'player', team: 'allied', x: 900, y: 900 };

// Create stacked entities at exact same cursor position (1000, 1000)
const enemyHero = { id: 'enemy_hero', type: 'hero', team: 'enemy', x: 1000, y: 1000, radius: 30, hp: 1000 };
const enemyCreep = { id: 'enemy_creep', type: 'minion', team: 'enemy', x: 1000, y: 1000, radius: 30, hp: 500 };
const enemyTower = { id: 'enemy_tower', type: 'tower', team: 'enemy', x: 1000, y: 1000, radius: 40, hp: 3000 };
const enemyBoss = { id: 'enemy_boss', type: 'boss', team: 'enemy', x: 1000, y: 1000, radius: 50, hp: 5000 };
const neutralCreep = { id: 'neutral_creep', type: 'minion', team: 'neutral', x: 1000, y: 1000, radius: 30, hp: 500 };
const neutralMonster = { id: 'neutral_monster', type: 'neutral', team: 'neutral', x: 1000, y: 1000, radius: 30, hp: 500 };
const alliedHero = { id: 'allied_hero', type: 'hero', team: 'allied', x: 1000, y: 1000, radius: 30, hp: 1000 };
const alliedCreep = { id: 'allied_creep', type: 'minion', team: 'allied', x: 1000, y: 1000, radius: 30, hp: 500 };

// Pairwise / subset tests
// A: Enemy Hero vs Enemy Creep
let pick = manager.pickEntity([enemyCreep, enemyHero], playerHero);
console.log('Pick [Creep, Hero]:', pick.id, 'Expected: enemy_hero ->', pick.id === 'enemy_hero');

// B: Enemy Creep vs Enemy Tower
pick = manager.pickEntity([enemyTower, enemyCreep], playerHero);
console.log('Pick [Tower, Creep]:', pick.id, 'Expected: enemy_creep ->', pick.id === 'enemy_creep');

// C: Enemy Tower vs Neutral
pick = manager.pickEntity([neutralMonster, enemyTower], playerHero);
console.log('Pick [Neutral, Tower]:', pick.id, 'Expected: enemy_tower ->', pick.id === 'enemy_tower');

// D: Neutral vs Ally
pick = manager.pickEntity([alliedHero, neutralMonster], playerHero);
console.log('Pick [Ally, Neutral]:', pick.id, 'Expected: neutral_monster ->', pick.id === 'neutral_monster');

// E: All entities stacked together
const allStacked = [alliedCreep, alliedHero, neutralMonster, enemyTower, enemyCreep, enemyHero];
pick = manager.pickEntity(allStacked, playerHero);
console.log('Pick all stacked:', pick.id, 'Expected: enemy_hero ->', pick.id === 'enemy_hero');

// Remove enemy hero: should pick enemy creep
pick = manager.pickEntity([alliedCreep, alliedHero, neutralMonster, enemyTower, enemyCreep], playerHero);
console.log('Pick stacked without hero:', pick.id, 'Expected: enemy_creep ->', pick.id === 'enemy_creep');

// Remove creep: should pick enemy tower
pick = manager.pickEntity([alliedCreep, alliedHero, neutralMonster, enemyTower], playerHero);
console.log('Pick stacked without creep:', pick.id, 'Expected: enemy_tower ->', pick.id === 'enemy_tower');

// Remove tower: should pick neutral
pick = manager.pickEntity([alliedCreep, alliedHero, neutralMonster], playerHero);
console.log('Pick stacked neutral vs allies:', pick.id, 'Expected: neutral_monster ->', pick.id === 'neutral_monster');

// What about neutral creep (type: 'minion', team: 'neutral') vs Enemy Tower?
// In the current code:
// isHostile(neutralCreep) -> true ('neutral' !== 'allied')
// If type === 'minion' -> priority = 3!
// But Enemy Tower has priority = 2!
// Does neutral creep beat enemy tower?
const pickNeutralCreepVsTower = manager.pickEntity([enemyTower, neutralCreep], playerHero);
console.log('Pick [Enemy Tower, Neutral Creep (type minion)]:', pickNeutralCreepVsTower.id);

console.log('\n--- TEST 3: QWER Targeting, Cancel & Stop ---');
// ─────────────────────────────────────────────────────────────
// 3. QWER TARGETING, CANCEL AND STOP
// ─────────────────────────────────────────────────────────────
const hero = new HeroEntity({
  x: 500, y: 500, hp: 1000, maxHp: 1000, mana: 100, maxMana: 100,
  abilities: {
    Q: { name: 'Q Skill', manaCost: 40, cooldown: 5, cooldownRemaining: 0, targetingType: IndicatorType.GROUND_AOE, range: 400 },
    W: { name: 'W Skill', manaCost: 50, cooldown: 8, cooldownRemaining: 0, targetingType: IndicatorType.DIRECTIONAL_LINE, range: 500 },
    E: { name: 'E Skill', manaCost: 60, cooldown: 10, cooldownRemaining: 5, targetingType: IndicatorType.TARGET_UNIT, range: 300 }, // On cooldown
    R: { name: 'R Skill', manaCost: 150, cooldown: 60, cooldownRemaining: 0, targetingType: IndicatorType.GROUND_AOE, range: 600 } // Not enough mana
  }
});

const d = new InputDispatcher();

// 1. Trigger Q
const startQ = d.handleKeyDown('Q', hero);
console.log('Start Q:', startQ);
console.log('d.targetingSkill:', d.targetingSkill);

// 2. Right-click cancels Q targeting without moving
const cancelRight = d.handleMouseDown(2, 600, 300);
console.log('Cancel via Right-click:', cancelRight);
console.log('d.targetingSkill after cancel:', d.targetingSkill);

// 3. Trigger W
d.handleKeyDown('W', hero);
console.log('d.targetingSkill after W:', d.targetingSkill);

// 4. Escape cancels W targeting
const cancelEsc = d.handleKeyDown('Escape');
console.log('Cancel via Escape:', cancelEsc);
console.log('d.targetingSkill after Esc:', d.targetingSkill);

// 5. Try E on cooldown
const tryE = d.handleKeyDown('E', hero);
console.log('Try E (on cooldown):', tryE);

// 6. Try R without mana
const tryR = d.handleKeyDown('R', hero);
console.log('Try R (no mana):', tryR);

// 7. Stop 'S' command while targeting
d.handleKeyDown('Q', hero);
const stopCmd = d.handleKeyDown('S');
console.log('Stop while targeting Q:', stopCmd);
console.log('d.targetingSkill after S:', d.targetingSkill);

// 8. Stop 'S' halts hero movement
hero.moveTo(1200, 1200);
console.log('Hero moving before stop?', hero.isMoving, hero.targetX, hero.targetY);
hero.stop();
console.log('Hero moving after stop?', hero.isMoving, hero.targetX, hero.targetY);

// 9. Stop cancels Recall
hero.isRecalling = true;
hero.recallElapsed = 2500;
hero.stop();
console.log('Hero recall after stop?', hero.isRecalling, hero.recallElapsed);


// ─────────────────────────────────────────────────────────────
// 4. HIGH-DPI CANVAS SCALING & RESIZE ROBUSTNESS
// ─────────────────────────────────────────────────────────────
console.log('\n--- TEST 4: High-DPI Scaling & Viewport Resizing ---');
const mockCalls = [];
const mockCtx = {
  scale: (...args) => mockCalls.push(['scale', args]),
  clearRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  closePath: () => {},
  fill: () => {},
  stroke: () => {}
};
const mockCanvas = {
  width: 1280,
  height: 720,
  getContext: () => mockCtx
};

const renderer = new Renderer(mockCanvas, { width: 1280, height: 720 });
renderer.resize(1920, 1080, 2);
console.log('Renderer viewport after 2x DPR resize:', renderer.viewportWidth, renderer.viewportHeight, 'Canvas buffer:', mockCanvas.width, mockCanvas.height);
console.log('Scale calls on mockCtx:', mockCalls);

// Boundary resize: 0 or negative
renderer.resize(0, 0, 1);
console.log('Renderer viewport after resize(0, 0):', renderer.viewportWidth, renderer.viewportHeight);

const camera = new Camera({ viewportWidth: 1280, viewportHeight: 720 });
camera.resize(1920, 1080);
console.log('Camera viewport after resize(1920, 1080):', camera.viewportWidth, camera.viewportHeight);
camera.resize(-100, NaN);
console.log('Camera viewport after invalid resize(-100, NaN):', camera.viewportWidth, camera.viewportHeight);
