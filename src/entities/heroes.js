/**
 * Heroes Architecture & 5-Hero Ability Kits.
 * Defines base stats, level scaling, and damage/shield formulas for all 5 heroes:
 * 1. Cavaleiro Guardião (Tank / Vanguard)
 * 2. Feiticeira Elemental (Mage / Burst AoE)
 * 3. Patrulheiro Arqueiro (Marksman / Sustained DPS)
 * 4. Sombra Assassina (Assassin / Melee Burst)
 * 5. Clérigo da Luz (Healer / Support)
 */

export const HERO_DEFINITIONS = {
  knight: {
    id: 'knight',
    name: 'Cavaleiro Guardião',
    role: 'Tank / Vanguard',
    icon: '🛡️',
    description: 'Resistente defensor com escudo pesado, capaz de atordoar inimigos e absorver dano com barreiras.',
    base: {
      hp: 680, hpRegen: 2.0, mana: 300, manaRegen: 1.2,
      armor: 38, magicResist: 32, attackDamage: 58, attackSpeed: 0.65,
      attackRange: 130, movementSpeed: 325
    },
    growth: {
      hp: 95, hpRegen: 0.2, mana: 38, manaRegen: 0.1,
      armor: 4.0, magicResist: 2.0, attackDamage: 3.5, attackSpeed: 0.0127
    },
    color: '#3b82f6',
    accentColor: '#60a5fa',
    sprite: 'assets/sprites/heroes/knight.png'
  },
  sorceress: {
    id: 'sorceress',
    name: 'Feiticeira Elemental',
    role: 'Mage / Burst AoE',
    icon: '🔥',
    description: 'Maga arcana destrutiva que domina fogo e gelo com alto dano explosivo e controle de multidões.',
    base: {
      hp: 480, hpRegen: 1.0, mana: 460, manaRegen: 2.2,
      armor: 18, magicResist: 30, attackDamage: 45, attackSpeed: 0.62,
      attackRange: 480, movementSpeed: 315
    },
    growth: {
      hp: 72, hpRegen: 0.1, mana: 55, manaRegen: 0.2,
      armor: 2.7, magicResist: 1.0, attackDamage: 2.5, attackSpeed: 0.01
    },
    color: '#ef4444',
    accentColor: '#f97316',
    sprite: 'assets/sprites/heroes/sorceress.png'
  },
  ranger: {
    id: 'ranger',
    name: 'Patrulheiro Arqueiro',
    role: 'Marksman / Sustained DPS',
    icon: '🏹',
    description: 'Atirador de precisão à longa distância com alto dano físico contínuo e disparos perfurantes.',
    base: {
      hp: 520, hpRegen: 1.2, mana: 320, manaRegen: 1.4,
      armor: 24, magicResist: 30, attackDamage: 55, attackSpeed: 0.68,
      attackRange: 520, movementSpeed: 335
    },
    growth: {
      hp: 78, hpRegen: 0.1, mana: 38, manaRegen: 0.1,
      armor: 3.0, magicResist: 1.0, attackDamage: 4.0, attackSpeed: 0.0236
    },
    color: '#10b981',
    accentColor: '#34d399',
    sprite: 'assets/sprites/heroes/ranger.png'
  },
  assassin: {
    id: 'assassin',
    name: 'Sombra Assassina',
    role: 'Assassin / Melee Burst',
    icon: '🗡️',
    description: 'Especialista em infiltração com lâminas envenenadas, teleporte nas costas e dano crítico letal.',
    base: {
      hp: 540, hpRegen: 1.4, mana: 300, manaRegen: 1.6,
      armor: 26, magicResist: 32, attackDamage: 62, attackSpeed: 0.74,
      attackRange: 125, movementSpeed: 345
    },
    growth: {
      hp: 82, hpRegen: 0.11, mana: 35, manaRegen: 0.11,
      armor: 3.2, magicResist: 1.6, attackDamage: 4.2, attackSpeed: 0.0218
    },
    color: '#8b5cf6',
    accentColor: '#a855f7',
    sprite: 'assets/sprites/heroes/assassin.png'
  },
  cleric: {
    id: 'cleric',
    name: 'Clérigo da Luz',
    role: 'Healer / Support',
    icon: '☀️',
    description: 'Suporte sagrado que cura aliados, emite auras radiantes de proteção e pune inimigos com luz solar.',
    base: {
      hp: 530, hpRegen: 1.5, mana: 440, manaRegen: 2.0,
      armor: 24, magicResist: 32, attackDamage: 48, attackSpeed: 0.64,
      attackRange: 440, movementSpeed: 320
    },
    growth: {
      hp: 78, hpRegen: 0.12, mana: 50, manaRegen: 0.2,
      armor: 3.0, magicResist: 1.6, attackDamage: 2.5, attackSpeed: 0.01
    },
    color: '#eab308',
    accentColor: '#fde047',
    sprite: 'assets/sprites/heroes/cleric.png'
  }
};

export function calculateHeroStatsAtLevel(heroId, level = 1) {
  const def = HERO_DEFINITIONS[heroId];
  if (!def) throw new Error(`Unknown hero: ${heroId}`);
  const lvl = Math.max(1, Math.min(15, level));
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

/**
 * Calculates hero respawn duration in seconds based on hero level.
 * Scaling Formula: 4.0s base + 1.0s per hero level (minimum level 1).
 * Examples:
 *   Level 1:  4.0 + 1 * 1.0 = 5.0 seconds
 *   Level 6:  4.0 + 6 * 1.0 = 10.0 seconds
 *   Level 12: 4.0 + 12 * 1.0 = 16.0 seconds
 *
 * @param {number} [level=1] Current hero level
 * @returns {number} Respawn duration in seconds
 */
export function calculateRespawnTime(level = 1) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return 4.0 + safeLevel * 1.0;
}

// -------------------------------------------------------------
// Knight Formulas
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// Sorceress Formulas
// -------------------------------------------------------------
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
  const factor = Math.max(0.60, 1.0 - bounceIndex * 0.15);
  return raw * factor;
}

export function sorceressRDamage(rank, ap, isCenter = true) {
  const base = [220, 360, 500][rank - 1] || 220;
  const fullDamage = base + 0.95 * ap;
  return isCenter ? fullDamage : fullDamage * 0.70;
}

// -------------------------------------------------------------
// Ranger Formulas
// -------------------------------------------------------------
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

export function rangerEDashSpeed(rank) {
  return [450, 500, 550, 600][rank - 1] || 450;
}

export function rangerRDamage(rank, ad, wavesHit = 6) {
  const basePerWave = [40, 70, 100][rank - 1] || 40;
  const waveDamage = basePerWave + 0.30 * ad;
  return waveDamage * wavesHit;
}

// -------------------------------------------------------------
// Assassin Formulas
// -------------------------------------------------------------
export function assassinBackstabDamage(ad, targetArmor = 0) {
  const critTotal = ad * 1.60;
  const physicalPortion = critTotal * 0.70;
  const truePortion = critTotal * 0.30;
  return { critTotal, physicalPortion, truePortion };
}

export function assassinBackstabMultiplier() {
  return 1.40;
}

export function assassinQDamage(rank, bonusAd) {
  const base = [70, 115, 160, 205][rank - 1] || 70;
  return base + 0.90 * bonusAd;
}

export function assassinWDamage(rank, ad) {
  const base = [65, 100, 135, 170][rank - 1] || 65;
  return base + 0.75 * ad;
}

export function assassinEDamage(rank, ad) {
  const base = [60, 95, 130, 165][rank - 1] || 60;
  return base + 0.65 * ad;
}

export function assassinEDuration(rank) {
  return [1.5, 2.0, 2.5, 3.0][rank - 1] || 1.5;
}

export function assassinRDetonationDamage(rank, totalDamageDealtDuringMark) {
  const base = [100, 175, 250][rank - 1] || 100;
  const percent = [0.35, 0.40, 0.45][rank - 1] || 0.35;
  return base + totalDamageDealtDuringMark * percent;
}

export function assassinRDamage(rank, ad) {
  const base = [240, 360, 480][rank - 1] || 240;
  return base + 1.30 * ad;
}

// -------------------------------------------------------------
// Cleric Formulas
// -------------------------------------------------------------
export function clericPassiveBonusDamage(level, ap) {
  return 20 + 10 * level + 0.25 * ap;
}

export function clericQHealing(rank, ap, targetHpPercent = 1.0) {
  const base = [90, 140, 190, 240][rank - 1] || 90;
  const raw = base + 0.70 * ap;
  return targetHpPercent < 0.40 ? raw * 1.40 : raw;
}

export function clericQHealDamage(rank, ap) {
  return clericQHealing(rank, ap, 1.0);
}

export function clericWDamage(rank, ap) {
  const base = [75, 115, 155, 195][rank - 1] || 75;
  return base + 0.65 * ap;
}

export function clericEShield(rank, ap) {
  const base = [80, 130, 180, 230][rank - 1] || 80;
  return base + 0.60 * ap;
}

export function clericWShield(rank, ap) {
  return clericEShield(rank, ap);
}

export function clericEDamage(rank, ap) {
  return clericWDamage(rank, ap);
}

export function clericRTotalHealing(rank, ap, durationSeconds = 5.0) {
  const basePerSec = [40, 70, 100][rank - 1] || 40;
  const healPerSec = basePerSec + 0.25 * ap;
  return healPerSec * durationSeconds;
}

export function clericRImmunityDuration(rank) {
  return [2.0, 2.75, 3.5][rank - 1] || 2.0;
}

/**
 * Returns ability metadata and kit configuration for each hero.
 */
export function getHeroKit(heroId) {
  switch (heroId) {
    case 'sorceress':
      return {
        Q: { id: 'Q', name: 'Bola de Fogo', icon: '🔥', manaCost: 55, cooldown: 6, cooldownRemaining: 0, range: 500, radius: 90, targetingType: 'GROUND_AOE', description: 'Dispara uma esfera flamejante que explode causando dano mágico em área.' },
        W: { id: 'W', name: 'Nevasca Congelante', icon: '❄️', manaCost: 65, cooldown: 10, cooldownRemaining: 0, range: 450, radius: 140, targetingType: 'GROUND_AOE', description: 'Cria uma tempestade de gelo que desacelera e causa dano contínuo.' },
        E: { id: 'E', name: 'Teleporte Arcano', icon: '⚡', manaCost: 70, cooldown: 12, cooldownRemaining: 0, range: 350, targetingType: 'DIRECTIONAL_LINE', description: 'Teleporta instantaneamente para a posição do cursor.' },
        R: { id: 'R', name: 'Meteoro Devastador', icon: '☄️', manaCost: 110, cooldown: 55, cooldownRemaining: 0, range: 600, radius: 200, targetingType: 'GROUND_AOE', description: 'Invoca um meteoro colossal causando dano massivo em grande área.' }
      };

    case 'ranger':
      return {
        Q: { id: 'Q', name: 'Disparo Perfurante', icon: '🎯', manaCost: 45, cooldown: 5, cooldownRemaining: 0, range: 650, targetingType: 'DIRECTIONAL_LINE', description: 'Dispara uma flecha de alta velocidade que atravessa múltiplos inimigos.' },
        W: { id: 'W', name: 'Chuva de Flechas', icon: '🌧️', manaCost: 55, cooldown: 9, cooldownRemaining: 0, range: 500, radius: 130, targetingType: 'GROUND_AOE', description: 'Saraivada de flechas em área causando dano contínuo e lentidão.' },
        E: { id: 'E', name: 'Salto Acrobático', icon: '💨', manaCost: 40, cooldown: 8, cooldownRemaining: 0, range: 320, targetingType: 'DIRECTIONAL_LINE', description: 'Cambalhota evasiva com bônus temporário de velocidade de movimento.' },
        R: { id: 'R', name: 'Tiro do Julgamento', icon: '🌟', manaCost: 100, cooldown: 50, cooldownRemaining: 0, range: 900, targetingType: 'DIRECTIONAL_LINE', description: 'Super tiro de alcance extremo com dano aumentado conforme a vida perdida do alvo.' }
      };

    case 'assassin':
      return {
        Q: { id: 'Q', name: 'Passo das Sombras', icon: '👤', manaCost: 50, cooldown: 7, cooldownRemaining: 0, range: 400, targetingType: 'TARGET_UNIT', description: 'Surge instantaneamente atrás do alvo desferindo um ataque crítico.' },
        W: { id: 'W', name: 'Lâminas Envenenadas', icon: '🗡️', manaCost: 45, cooldown: 6, cooldownRemaining: 0, range: 380, targetingType: 'DIRECTIONAL_LINE', description: 'Lança três adagas com veneno que causam sangramento contínuo.' },
        E: { id: 'E', name: 'Mortalha Sombria', icon: '🌫️', manaCost: 60, cooldown: 14, cooldownRemaining: 0, targetingType: 'SELF_AOE', description: 'Envolve-se em sombras ganhando invisibilidade temporária e velocidade.' },
        R: { id: 'R', name: 'Dança Letal', icon: '☠️', manaCost: 100, cooldown: 60, cooldownRemaining: 0, radius: 300, targetingType: 'SELF_AOE', description: 'Desfere uma sequência rápida de golpes letais em área com invulnerabilidade.' }
      };

    case 'cleric':
      return {
        Q: { id: 'Q', name: 'Luz Sagrada', icon: '✨', manaCost: 50, cooldown: 5, cooldownRemaining: 0, range: 500, targetingType: 'DIRECTIONAL_LINE', description: 'Feixe radiante que cura aliados e queima inimigos atingidos.' },
        W: { id: 'W', name: 'Santuário Radiante', icon: '💫', manaCost: 65, cooldown: 11, cooldownRemaining: 0, range: 450, radius: 150, targetingType: 'GROUND_AOE', description: 'Cria uma zona sagrada no solo que cura continuamente a equipe.' },
        E: { id: 'E', name: 'Julgamento Solar', icon: '☀️', manaCost: 60, cooldown: 9, cooldownRemaining: 0, range: 420, radius: 100, targetingType: 'GROUND_AOE', description: 'Explosão de luz solar que cega e atordoa inimigos pegos no centro.' },
        R: { id: 'R', name: 'Milagre Divino', icon: '🛡️', manaCost: 100, cooldown: 65, cooldownRemaining: 0, radius: 350, targetingType: 'SELF_AOE', description: 'Invoca uma barreira celestial tornando aliados próximos temporariamente invulneráveis.' }
      };

    case 'knight':
    default:
      return {
        Q: { id: 'Q', name: 'Golpe de Escudo', icon: '💥', manaCost: 50, cooldown: 7, cooldownRemaining: 0, range: 400, targetingType: 'DIRECTIONAL_LINE', description: 'Investe com o escudo causando dano e atordoando inimigos atingidos.' },
        W: { id: 'W', name: 'Provocação em Área', icon: '📢', manaCost: 60, cooldown: 11, cooldownRemaining: 0, radius: 260, targetingType: 'SELF_AOE', description: 'Grito de guerra que força inimigos a atacarem você e concede armadura.' },
        E: { id: 'E', name: 'Cutilada Rotativa', icon: '⚔️', manaCost: 40, cooldown: 5, cooldownRemaining: 0, range: 300, radius: 160, targetingType: 'SELF_AOE', description: 'Gira a espada em círculo causando dano adicional a lacaios.' },
        R: { id: 'R', name: 'Fortaleza Inabalável', icon: '🏰', manaCost: 100, cooldown: 55, cooldownRemaining: 0, range: 450, radius: 280, targetingType: 'GROUND_AOE', description: 'Salta no chão com impacto heróico, erguendo muralhas e desacelerando inimigos.' }
      };
  }
}
