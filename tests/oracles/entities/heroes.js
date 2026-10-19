/**
 * Specification Reference Oracle: 5 Heroes Base Stats, Growth & Skill Damage Calculations
 * Source: spec_miner_heroes_r0/handoff.md §3
 */

export const HERO_DEFINITIONS = {
  knight: {
    id: 'knight',
    name: 'Cavaleiro Guardião',
    role: 'Tank / Vanguard',
    base: {
      hp: 680, hpRegen: 2.0, mana: 300, manaRegen: 1.2,
      armor: 38, magicResist: 32, attackDamage: 58, attackSpeed: 0.65,
      attackRange: 130, movementSpeed: 325
    },
    growth: {
      hp: 95, hpRegen: 0.2, mana: 38, manaRegen: 0.1,
      armor: 4.0, magicResist: 2.0, attackDamage: 3.5, attackSpeed: 0.0127
    }
  },
  sorceress: {
    id: 'sorceress',
    name: 'Feiticeira Elemental',
    role: 'Mage / Burst AoE',
    base: {
      hp: 480, hpRegen: 1.0, mana: 460, manaRegen: 2.2,
      armor: 18, magicResist: 30, attackDamage: 45, attackSpeed: 0.62,
      attackRange: 480, movementSpeed: 315
    },
    growth: {
      hp: 72, hpRegen: 0.1, mana: 55, manaRegen: 0.2,
      armor: 2.7, magicResist: 1.0, attackDamage: 2.5, attackSpeed: 0.01
    }
  },
  ranger: {
    id: 'ranger',
    name: 'Patrulheiro Arqueiro',
    role: 'Marksman / Sustained DPS',
    base: {
      hp: 520, hpRegen: 1.2, mana: 320, manaRegen: 1.4,
      armor: 24, magicResist: 30, attackDamage: 55, attackSpeed: 0.68,
      attackRange: 520, movementSpeed: 335
    },
    growth: {
      hp: 78, hpRegen: 0.1, mana: 38, manaRegen: 0.1,
      armor: 3.0, magicResist: 1.0, attackDamage: 4.0, attackSpeed: 0.0236
    }
  },
  assassin: {
    id: 'assassin',
    name: 'Sombra Assassina',
    role: 'Assassin / Melee Burst',
    base: {
      hp: 540, hpRegen: 1.4, mana: 300, manaRegen: 1.6,
      armor: 26, magicResist: 32, attackDamage: 62, attackSpeed: 0.74,
      attackRange: 125, movementSpeed: 345
    },
    growth: {
      hp: 82, hpRegen: 0.11, mana: 35, manaRegen: 0.11,
      armor: 3.2, magicResist: 1.6, attackDamage: 4.2, attackSpeed: 0.0218
    }
  },
  cleric: {
    id: 'cleric',
    name: 'Clérigo da Luz',
    role: 'Healer / Support',
    base: {
      hp: 530, hpRegen: 1.5, mana: 440, manaRegen: 2.0,
      armor: 24, magicResist: 32, attackDamage: 48, attackSpeed: 0.64,
      attackRange: 440, movementSpeed: 320
    },
    growth: {
      hp: 78, hpRegen: 0.12, mana: 50, manaRegen: 0.2,
      armor: 3.0, magicResist: 1.6, attackDamage: 2.5, attackSpeed: 0.01
    }
  }
};

export function calculateHeroStatsAtLevel(heroId, level = 1) {
  const def = HERO_DEFINITIONS[heroId];
  if (!def) throw new Error(`Unknown hero: ${heroId}`);
  const lvl = Math.max(1, Math.min(12, level));
  const lvlOffset = lvl - 1;

  return {
    level: lvl,
    hp: def.base.hp + lvlOffset * def.growth.hp,
    hpRegen: +(def.base.hpRegen + lvlOffset * def.growth.hpRegen).toFixed(2),
    mana: def.base.mana + lvlOffset * def.growth.mana,
    manaRegen: +(def.base.manaRegen + lvlOffset * def.growth.manaRegen).toFixed(2),
    armor: +(def.base.armor + lvlOffset * def.growth.armor).toFixed(2),
    magicResist: +(def.base.magicResist + lvlOffset * def.growth.magicResist).toFixed(2),
    attackDamage: +(def.base.attackDamage + lvlOffset * def.growth.attackDamage).toFixed(2),
    attackSpeed: +(def.base.attackSpeed + lvlOffset * def.growth.attackSpeed).toFixed(2),
    attackRange: def.base.attackRange,
    movementSpeed: def.base.movementSpeed
  };
}

// Knight Skill Formulas
export function knightPassiveBarrier(maxHp) {
  return 100 + 0.12 * maxHp;
}

export function knightQDamage(rank, ad, bonusHp = 0) {
  const base = [80, 120, 160, 200][rank - 1] || 80;
  return base + 0.60 * ad + 0.08 * bonusHp;
}

export function knightWDamage(rank, armor) {
  const base = [40, 65, 90, 115][rank - 1] || 40;
  return base + 0.40 * armor;
}

export function knightEDamage(rank, ad, isMinion = false) {
  const base = [70, 110, 150, 190][rank - 1] || 70;
  const raw = base + 0.85 * ad;
  return isMinion ? raw * 1.25 : raw;
}

export function knightRDamage(rank, ad) {
  const base = [150, 250, 350][rank - 1] || 150;
  return base + 0.70 * ad;
}

// Sorceress Skill Formulas
export function sorceressPassiveDamage(level, ap) {
  return 40 + 15 * level + 0.40 * ap;
}

export function sorceressQDamage(rank, ap) {
  const baseImpact = [85, 135, 185, 235][rank - 1] || 85;
  const baseDot = [30, 50, 70, 90][rank - 1] || 30;
  return {
    impact: baseImpact + 0.75 * ap,
    dot: baseDot + 0.20 * ap,
    total: (baseImpact + 0.75 * ap) + (baseDot + 0.20 * ap)
  };
}

export function sorceressWDamage(rank, ap) {
  const base = [70, 110, 150, 190][rank - 1] || 70;
  return base + 0.60 * ap;
}

export function sorceressEDamage(rank, ap, bounceIndex = 0) {
  const base = [80, 125, 170, 215][rank - 1] || 80;
  const raw = base + 0.70 * ap;
  // 15% reduction per bounce, floor 60%
  const factor = Math.max(0.60, 1.0 - bounceIndex * 0.15);
  return raw * factor;
}

export function sorceressRDamage(rank, ap, isCenter = true) {
  const base = [220, 360, 500][rank - 1] || 220;
  const fullDamage = base + 0.95 * ap;
  return isCenter ? fullDamage : fullDamage * 0.70;
}

// Ranger Skill Formulas
export function rangerPassiveCritBonus(distance) {
  const steps = Math.min(10, Math.floor(distance / 50));
  return steps * 0.012; // up to 12% bonus
}

export function rangerQDamage(rank, ad, unitsPierced = 0) {
  const base = [75, 125, 175, 225][rank - 1] || 75;
  const raw = base + 1.00 * ad;
  const factor = Math.max(0.60, 1.0 - unitsPierced * 0.10);
  return raw * factor;
}

export function rangerWDamage(rank, ad, arrowHitIndex = 0) {
  const base = [50, 80, 110, 140][rank - 1] || 50;
  const raw = base + 0.50 * ad;
  return arrowHitIndex === 0 ? raw : raw * 0.35;
}

export function rangerRDamage(rank, ad, wavesHit = 6) {
  const basePerWave = [40, 70, 100][rank - 1] || 40;
  const waveDamage = basePerWave + 0.30 * ad;
  return waveDamage * wavesHit;
}

// Assassin Skill Formulas
export function assassinBackstabDamage(ad, targetArmor = 0) {
  const critTotal = ad * 1.60;
  const physicalPortion = critTotal * 0.70;
  const truePortion = critTotal * 0.30;
  return { critTotal, physicalPortion, truePortion };
}

export function assassinQDamage(rank, bonusAd) {
  const base = [70, 115, 160, 205][rank - 1] || 70;
  return base + 0.90 * bonusAd;
}

export function assassinEDamage(rank, ad) {
  const base = [60, 95, 130, 165][rank - 1] || 60;
  return base + 0.65 * ad;
}

export function assassinRDetonationDamage(rank, totalDamageDealtDuringMark) {
  const base = [100, 175, 250][rank - 1] || 100;
  const percent = [0.35, 0.40, 0.45][rank - 1] || 0.35;
  return base + totalDamageDealtDuringMark * percent;
}

// Cleric Skill Formulas
export function clericPassiveBonusDamage(level, ap) {
  return 20 + 10 * level + 0.25 * ap;
}

export function clericQHealing(rank, ap, targetHpPercent = 1.0) {
  const base = [90, 140, 190, 240][rank - 1] || 90;
  const raw = base + 0.70 * ap;
  return targetHpPercent < 0.40 ? raw * 1.40 : raw;
}

export function clericWDamage(rank, ap) {
  const base = [75, 115, 155, 195][rank - 1] || 75;
  return base + 0.65 * ap;
}

export function clericEShield(rank, ap) {
  const base = [80, 130, 180, 230][rank - 1] || 80;
  return base + 0.60 * ap;
}

export function clericRTotalHealing(rank, ap, durationSeconds = 5.0) {
  const basePerSec = [40, 70, 100][rank - 1] || 40;
  const healPerSec = basePerSec + 0.25 * ap;
  return healPerSec * durationSeconds;
}
