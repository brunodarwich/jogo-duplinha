import { worldToScreen } from './isometric.js';

function isAlive(entity) {
  if (!entity || !Number.isFinite(entity.x) || !Number.isFinite(entity.y)) return false;
  const dead = typeof entity.isDead === 'function' ? entity.isDead() : entity.isDead;
  return !dead && (typeof entity.hp !== 'number' || entity.hp > 0) &&
    (typeof entity.isAlive !== 'function' || entity.isAlive());
}

/** Resolve client aiming only. The simulation still validates and executes the cast. */
export function resolveAbilityAim(hero, slot, ability, entities = [], {
  x, y, hoveredEntity = null, autoAim = false, camera = null, viewport = null
} = {}) {
  const hx = hero.x, hy = hero.y;
  const type = ability.targetingType || ability.targetType || 'GROUND_AOE';
  if (['SELF_AOE', 'INSTANT_SELF', 'self', 'instant'].includes(type)) {
    return { x: hx, y: hy, targetEntity: null, isValidTarget: true, assisted: false };
  }

  const unitTargeting = ['TARGET_UNIT', 'unit', 'target'].includes(type);
  const range = Number.isFinite(ability.range) ? Math.max(0, ability.range) : (unitTargeting ? 500 : 600);
  const heroId = hero.heroId || hero.heroClass;
  const mobility = slot === 'E' && ['sorceress', 'ranger'].includes(heroId);
  const healing = heroId === 'cleric' && ['Q', 'W'].includes(slot);
  const healingOnly = healing && slot === 'W';
  const distance = entity => Math.hypot(entity.x - hx, entity.y - hy);
  const inRange = entity => distance(entity) <= range + (unitTargeting ? Math.max(0, entity.radius || 0) : 0);
  const eligible = entity => {
    if (!isAlive(entity) || !inRange(entity)) return false;
    if (entity.team === hero.team) return healing;
    return !healingOnly && !entity.isUntargetable?.() && !entity.isInvulnerable?.() && !entity.shieldActive;
  };

  let tx = Number.isFinite(x) ? x : hx;
  let ty = Number.isFinite(y) ? y : hy;
  let targetEntity = null;
  const candidates = Array.isArray(entities) ? entities.filter(eligible) : [];
  if (healing && !candidates.includes(hero) && eligible(hero)) candidates.push(hero);

  if (autoAim) {
    if (healing) {
      const wounded = candidates.filter(entity => entity.team === hero.team && entity.type === 'hero' &&
        entity.maxHp > 0 && entity.hp < entity.maxHp);
      wounded.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || distance(a) - distance(b));
      targetEntity = wounded[0] || (healingOnly ? hero : null);
    }
    if (!targetEntity && !mobility) {
      const enemies = candidates.filter(entity => entity.team !== hero.team);
      targetEntity = enemies.find(entity => entity === hero.attackTarget ||
        (hero.attackTarget?.id != null && entity.id === hero.attackTarget.id)) || null;
      if (!targetEntity) {
        // Prefer a hero or boss only when its distance is similar to the nearest creep.
        const score = entity => distance(entity) - (entity.type === 'hero' ? 40 : entity.type === 'boss' ? 20 : 0);
        targetEntity = enemies.reduce((best, entity) => !best || score(entity) < score(best) ? entity : best, null);
      }
    }
    if (!targetEntity) {
      const moveX = hero.targetX, moveY = hero.targetY;
      const moving = Number.isFinite(moveX) && Number.isFinite(moveY) && Math.hypot(moveX - hx, moveY - hy) > 1;
      const angle = moving ? Math.atan2(moveY - hy, moveX - hx) : (Number.isFinite(hero.facing) ? hero.facing : 0);
      tx = hx + Math.cos(angle) * range;
      ty = hy + Math.sin(angle) * range;
    }
  } else if (!mobility) {
    if (eligible(hoveredEntity)) targetEntity = hoveredEntity;
    else {
      const cursor = camera ? worldToScreen(tx, ty, 0, camera, null, viewport) : null;
      const tolerance = camera ? 48 : 80;
      let closest = tolerance;
      for (const entity of candidates) {
        const screen = camera ? worldToScreen(entity.x, entity.y, 0, camera, null, viewport) : null;
        const delta = camera ? Math.hypot(screen.sx - cursor.sx, screen.sy - cursor.sy) : Math.hypot(entity.x - tx, entity.y - ty);
        if (delta <= closest) {
          closest = delta;
          targetEntity = entity;
        }
      }
    }
  }

  if (targetEntity) {
    tx = targetEntity.x;
    ty = targetEntity.y;
  }
  const aimDistance = Math.hypot(tx - hx, ty - hy);
  if (!unitTargeting && aimDistance > range) {
    tx = hx + (tx - hx) * range / aimDistance;
    ty = hy + (ty - hy) * range / aimDistance;
  }
  return { x: tx, y: ty, targetEntity, isValidTarget: !unitTargeting || !!targetEntity, assisted: !!targetEntity };
}
