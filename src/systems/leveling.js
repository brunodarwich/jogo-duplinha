/**
 * Player Leveling & Progression System (Levels 1 to 15).
 * Defines XP curve, kill bounties, proximity XP sharing rules,
 * and ability point allocation validation.
 */

export const MAX_LEVEL = 15;

/**
 * XP required to advance from current level to next level.
 * Level 15 is the maximum cap.
 */
export const XP_REQUIREMENTS_BY_LEVEL = Object.freeze({
  1: 240,
  2: 360,
  3: 500,
  4: 660,
  5: 840,
  6: 1050,
  7: 1280,
  8: 1530,
  9: 1800,
  10: 2100,
  11: 2450,
  12: 2850,
  13: 3300,
  14: 3800,
  15: 0
});

/**
 * Cumulative XP required to reach each level from level 1.
 */
export const TOTAL_XP_BY_LEVEL = Object.freeze({
  1: 0,
  2: 240,
  3: 600,
  4: 1100,
  5: 1760,
  6: 2600,
  7: 3650,
  8: 4930,
  9: 6460,
  10: 8260,
  11: 10360,
  12: 12810,
  13: 15660,
  14: 18960,
  15: 22760
});

export const XP_VALUES = Object.freeze({
  MINION_MELEE: 60,
  MINION_RANGED: 45,
  MINION_CANNON: 110,
  MINION_LAST_HIT_BONUS: 0.15,
  PROXIMITY_RADIUS: 800,
  HERO_BASE: 180,
  HERO_PER_LEVEL: 40,
  TOWER: 250,
  BOSS_COLOSSUS: 400,
  BOSS_NEXUS_GUARDIAN: 750
});

/**
 * Returns XP needed to advance to the next level.
 * @param {number} level 
 * @returns {number}
 */
export function getXpForNextLevel(level) {
  const lvl = Math.max(1, Math.floor(Number(level) || 1));
  if (lvl >= MAX_LEVEL) return 0;
  return XP_REQUIREMENTS_BY_LEVEL[lvl] || 0;
}

/**
 * Returns cumulative XP required to reach the given level.
 * @param {number} level 
 * @returns {number}
 */
export function getTotalXpForLevel(level) {
  const lvl = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(level) || 1)));
  return TOTAL_XP_BY_LEVEL[lvl] || 0;
}

/**
 * Checks if current XP is enough to level up.
 * @param {number} currentXp 
 * @param {number} currentLevel 
 * @returns {boolean}
 */
export function canLevelUp(currentXp, currentLevel) {
  if (currentLevel >= MAX_LEVEL) return false;
  const needed = getXpForNextLevel(currentLevel);
  return needed > 0 && currentXp >= needed;
}

/**
 * Calculates XP awarded for killing a target.
 * @param {'minion' | 'hero' | 'tower' | 'boss'} targetType 
 * @param {number} [targetLevel=1] 
 * @param {Object} [options={}] 
 * @param {string} [options.subType='melee']
 * @param {boolean} [options.isLastHit=false]
 * @param {boolean} [options.isSupreme=false]
 * @returns {number}
 */
export function calculateKillXp(targetType, targetLevel = 1, options = {}) {
  switch (targetType) {
    case 'minion': {
      const sub = (options.subType || 'melee').toLowerCase();
      let base = XP_VALUES.MINION_MELEE;
      if (sub === 'ranged') base = XP_VALUES.MINION_RANGED;
      else if (sub === 'cannon' || sub === 'siege') base = XP_VALUES.MINION_CANNON;

      if (options.isLastHit) {
        return base + Math.round(base * XP_VALUES.MINION_LAST_HIT_BONUS);
      }
      return base;
    }

    case 'hero': {
      const lvl = Math.max(1, Math.floor(Number(targetLevel) || 1));
      return XP_VALUES.HERO_BASE + lvl * XP_VALUES.HERO_PER_LEVEL;
    }

    case 'tower':
      return XP_VALUES.TOWER;

    case 'boss':
      return options.isSupreme ? XP_VALUES.BOSS_NEXUS_GUARDIAN : XP_VALUES.BOSS_COLOSSUS;

    default:
      return 0;
  }
}

/**
 * Validates whether an ability slot can be leveled up by the hero.
 * Rules:
 * - Hero must have skillPoints > 0
 * - Q, W, E max rank 4
 * - R (Ultimate) max rank 3, unlocked at hero levels 6, 11, 15
 * @param {Object} hero 
 * @param {'Q' | 'W' | 'E' | 'R'} slot 
 * @returns {boolean}
 */
export function canUpgradeAbility(hero, slot) {
  if (!hero || (hero.skillPoints || 0) <= 0) return false;
  if (!slot) return false;

  const key = String(slot).toUpperCase();
  const ability = hero.abilities ? hero.abilities[key] : (hero.skills ? hero.skills[key] : null);
  if (!ability) return false;

  const currentRank = ability.rank || 0;
  const heroLevel = hero.level || 1;

  if (key === 'R') {
    if (currentRank >= 3) return false;
    if (currentRank === 0 && heroLevel < 6) return false;
    if (currentRank === 1 && heroLevel < 11) return false;
    if (currentRank === 2 && heroLevel < 15) return false;
    return true;
  }

  if (['Q', 'W', 'E'].includes(key)) {
    return currentRank < 4;
  }

  return false;
}

/**
 * Resolves proximity XP sharing on minion death.
 * Living opposing heroes within 800 units receive base XP.
 * If killer is a hero on that team, killer receives last-hit bonus (+15%).
 * @param {Object} minionEntity 
 * @param {Array<Object>} entities 
 * @param {Object|null} [killerHero=null] 
 * @returns {Array<{ hero: Object, xp: number, isLastHit: boolean }>}
 */
export function resolveMinionXpDistribution(minionEntity, entities = [], killerHero = null) {
  if (!minionEntity) return [];

  const minionTeam = minionEntity.team;
  const radius = XP_VALUES.PROXIMITY_RADIUS;
  const subType = minionEntity.subType || 'melee';

  // Base minion XP
  const baseXp = calculateKillXp('minion', 1, { subType, isLastHit: false });
  const lastHitXp = calculateKillXp('minion', 1, { subType, isLastHit: true });

  const awards = [];
  const processedHeroIds = new Set();

  // Find heroes on opposing team in proximity
  for (const ent of entities) {
    if (!ent || ent.type !== 'hero' || ent.team === minionTeam) continue;
    const isAlive = typeof ent.isAlive === 'function'
      ? ent.isAlive()
      : (!ent.isDead && (typeof ent.hp !== 'number' || ent.hp > 0));
    if (!isAlive) continue;

    const dist = Math.hypot(ent.x - minionEntity.x, ent.y - minionEntity.y);
    if (dist <= radius) {
      const isKiller = killerHero && killerHero.id === ent.id;
      awards.push({
        hero: ent,
        xp: isKiller ? lastHitXp : baseXp,
        isLastHit: isKiller
      });
      processedHeroIds.add(ent.id);
    }
  }

  // If killer hero exists and was outside 800 units, they still receive last-hit XP
  if (killerHero && killerHero.type === 'hero' && killerHero.team !== minionTeam && !processedHeroIds.has(killerHero.id)) {
    const isAlive = typeof killerHero.isAlive === 'function'
      ? killerHero.isAlive()
      : (!killerHero.isDead && (typeof killerHero.hp !== 'number' || killerHero.hp > 0));
    if (isAlive) {
      awards.push({
        hero: killerHero,
        xp: lastHitXp,
        isLastHit: true
      });
    }
  }

  return awards;
}
