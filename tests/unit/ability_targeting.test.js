import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse, assertCloseTo } from '../helpers/assert.js';
import { worldToScreen, screenToWorld } from '../../src/core/isometric.js';
import { resolveAbilityAim } from '../../src/core/ability_targeting.js';

const hero = (overrides = {}) => ({ id: 'player', heroId: 'sorceress', type: 'hero', team: 'allied', x: 1000, y: 1000, hp: 100, maxHp: 100, facing: 0, ...overrides });
const enemy = (id, x, y = 1000, overrides = {}) => ({ id, type: 'minion', team: 'enemy', x, y, hp: 100, maxHp: 100, radius: 20, ...overrides });
const area = { targetingType: 'GROUND_AOE', range: 500, radius: 90 };
const unit = { targetingType: 'TARGET_UNIT', range: 400 };
const line = { targetingType: 'DIRECTIONAL_LINE', range: 650 };

describe('Assisted ability targeting', () => {
  it('Self abilities resolve at the hero without selecting an enemy', () => {
    const caster = hero();
    for (const targetingType of ['SELF_AOE', 'INSTANT_SELF']) {
      const aim = resolveAbilityAim(caster, 'W', { targetingType }, [enemy('near', 1030)], { x: 1200, y: 1200, autoAim: true });
      assertEqual(aim.x, caster.x);
      assertEqual(aim.y, caster.y);
      assertEqual(aim.targetEntity, null);
      assertTrue(aim.isValidTarget);
    }
  });

  it('Manual aiming snaps to a nearby eligible enemy and leaves distant empty ground alone', () => {
    const target = enemy('near', 1200);
    const snapped = resolveAbilityAim(hero(), 'Q', area, [target], { x: 1240, y: 1010 });
    assertEqual(snapped.targetEntity, target);
    assertEqual(snapped.x, target.x);
    assertTrue(snapped.assisted);
    const free = resolveAbilityAim(hero(), 'Q', area, [target], { x: 1400, y: 1000 });
    assertEqual(free.targetEntity, null);
    assertEqual(free.x, 1400);
    assertFalse(free.assisted);
  });

  it('A directly hovered valid target takes precedence over nearby candidates', () => {
    const hovered = enemy('hovered', 1300);
    const closer = enemy('closer', 1200);
    assertEqual(resolveAbilityAim(hero(), 'Q', area, [hovered, closer], { x: 1200, y: 1000, hoveredEntity: hovered }).targetEntity, hovered);
  });

  it('Offensive assistance skips allies, dead, untargetable, invulnerable and shielded units', () => {
    const invalid = [
      enemy('ally', 1100, 1000, { team: 'allied' }),
      enemy('dead', 1100, 1000, { hp: 0 }),
      enemy('untargetable', 1100, 1000, { isUntargetable: () => true }),
      enemy('invulnerable', 1100, 1000, { isInvulnerable: () => true }),
      enemy('shield', 1100, 1000, { shieldActive: true })
    ];
    assertEqual(resolveAbilityAim(hero(), 'Q', area, invalid, { x: 1100, y: 1000 }).targetEntity, null);
    assertFalse(resolveAbilityAim(hero({ heroId: 'assassin' }), 'Q', unit, invalid, { autoAim: true }).isValidTarget);
  });

  it('Unit targeting accepts the target edge at range but never a unit farther away', () => {
    const edge = enemy('edge', 1420);
    const far = enemy('far', 1421);
    assertTrue(resolveAbilityAim(hero(), 'Q', unit, [edge], { x: edge.x, y: edge.y }).isValidTarget);
    assertFalse(resolveAbilityAim(hero(), 'Q', unit, [far], { x: far.x, y: far.y, hoveredEntity: far, autoAim: true }).isValidTarget);
  });

  it('Ground casts clamp to range without snapping to out-of-range units', () => {
    const outside = enemy('outside', 1501);
    const aim = resolveAbilityAim(hero(), 'Q', area, [outside], { x: 2000, y: 1000, hoveredEntity: outside });
    assertEqual(aim.x, 1500);
    assertEqual(aim.y, 1000);
    assertEqual(aim.targetEntity, null);
  });

  it('Automatic offense retains the current attack target while it remains eligible', () => {
    const current = enemy('current', 1400);
    const caster = hero({ attackTarget: current });
    assertEqual(resolveAbilityAim(caster, 'Q', area, [enemy('nearer', 1100), current], { autoAim: true }).targetEntity, current);
    current.hp = 0;
    assertEqual(resolveAbilityAim(caster, 'Q', area, [enemy('nearer', 1100), current], { autoAim: true }).targetEntity.id, 'nearer');
  });

  it('Automatic offense selects the closest eligible enemy rather than a distant high-priority unit', () => {
    const near = enemy('near', 1100);
    const boss = enemy('boss', 1480, 1000, { type: 'boss' });
    assertEqual(resolveAbilityAim(hero(), 'Q', area, [boss, near], { autoAim: true }).targetEntity, near);
  });

  it('Cleric automatically heals the lowest health percentage hero, including self', () => {
    const caster = hero({ heroId: 'cleric', hp: 40 });
    const wounded = hero({ id: 'friend', hp: 50, maxHp: 200, x: 1200 });
    const minion = enemy('ally-minion', 1100, 1000, { team: 'allied', hp: 1 });
    const outside = hero({ id: 'distant', hp: 1, x: 2000 });
    for (const slot of ['Q', 'W']) {
      assertEqual(resolveAbilityAim(caster, slot, area, [caster, wounded, minion, outside], { autoAim: true }).targetEntity, wounded);
    }
    wounded.hp = 200;
    assertEqual(resolveAbilityAim(caster, 'W', area, [wounded], { autoAim: true }).targetEntity, caster);
  });

  it('Cleric W defaults to self when allies are healthy, while Q can attack an enemy', () => {
    const caster = hero({ heroId: 'cleric' });
    const target = enemy('foe', 1200);
    assertEqual(resolveAbilityAim(caster, 'W', area, [target], { autoAim: true }).targetEntity, caster);
    assertEqual(resolveAbilityAim(caster, 'Q', area, [target], { autoAim: true }).targetEntity, target);
    assertEqual(resolveAbilityAim(caster, 'W', area, [target], { x: target.x, y: target.y, hoveredEntity: target }).targetEntity, null);
    assertEqual(resolveAbilityAim(caster, 'Q', area, [target], { x: target.x, y: target.y }).targetEntity, target);
  });

  it('Cleric manual healing permits an allied unit under the cursor', () => {
    const caster = hero({ heroId: 'cleric' });
    const ally = enemy('ally', 1200, 1000, { team: 'allied' });
    assertEqual(resolveAbilityAim(caster, 'W', area, [ally], { x: 1230, y: 1000 }).targetEntity, ally);
    assertEqual(resolveAbilityAim(caster, 'Q', area, [ally], { x: 1230, y: 1000 }).targetEntity, ally);
  });

  it('Mobility never snaps to enemies and automatically follows movement or facing', () => {
    const target = enemy('foe', 1200);
    for (const heroId of ['sorceress', 'ranger']) {
      const caster = hero({ heroId, targetX: 1000, targetY: 1300, attackTarget: target });
      const mobility = { ...line, range: 350 };
      const manual = resolveAbilityAim(caster, 'E', mobility, [target], { x: 1230, y: 1010, hoveredEntity: target });
      assertEqual(manual.targetEntity, null);
      assertEqual(manual.x, 1230);
      const moving = resolveAbilityAim(caster, 'E', mobility, [target], { autoAim: true });
      assertCloseTo(moving.x, 1000);
      assertCloseTo(moving.y, 1350);
      caster.targetX = caster.targetY = null;
      caster.facing = Math.PI;
      assertCloseTo(resolveAbilityAim(caster, 'E', mobility, [target], { autoAim: true }).x, 650);
    }
  });

  it('Screen tolerance stays consistent across zoom and rotated cameras', () => {
    const caster = hero();
    const target = enemy('foe', 1200);
    for (const zoom of [0.6, 1.6]) {
      const camera = { worldX: 1000, worldY: 1000, viewportWidth: 1280, viewportHeight: 720, zoom, rotation: Math.PI / 4 };
      const screen = worldToScreen(target.x, target.y, 0, camera);
      const near = screenToWorld(screen.sx + 40, screen.sy, camera);
      const far = screenToWorld(screen.sx + 60, screen.sy, camera);
      assertEqual(resolveAbilityAim(caster, 'Q', area, [target], { x: near.wx, y: near.wy, camera }).targetEntity, target);
      assertEqual(resolveAbilityAim(caster, 'Q', area, [target], { x: far.wx, y: far.wy, camera }).targetEntity, null);
    }
  });

  it('A line resolves the chosen aim point while malformed cursor coordinates stay finite', () => {
    const target = enemy('foe', 1250, 1120);
    const aim = resolveAbilityAim(hero({ heroId: 'ranger' }), 'Q', line, [target], { x: 1260, y: 1120 });
    assertEqual(aim.x, target.x);
    assertEqual(aim.y, target.y);
    const fallback = resolveAbilityAim(hero(), 'Q', area, [], { x: NaN, y: Infinity });
    assertTrue(Number.isFinite(fallback.x) && Number.isFinite(fallback.y));
    assertTrue(fallback.isValidTarget);
  });
});
