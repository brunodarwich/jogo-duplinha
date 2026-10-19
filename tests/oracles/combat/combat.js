/**
 * Specification Reference Oracle: Combat Engine, Mitigation & Damage Formulas
 * Source: PROJECT.md §2 & spec_miner_heroes_r0/handoff.md §4
 */

export function calculateMitigation(damage, resistance) {
  if (resistance <= 0) return damage;
  return damage * (100 / (100 + resistance));
}

export function applyDamage(target, damageEvent) {
  const {
    sourceId,
    sourceType = 'hero',
    amount = 0,
    type = 'physical',
    isCrit = false,
    critMultiplier = 2.0,
    lifesteal = 0
  } = damageEvent;

  let rawDamage = amount;
  if (isCrit) {
    rawDamage *= critMultiplier;
  }

  let finalDamage = rawDamage;
  if (type === 'physical') {
    const armor = Math.max(0, target.armor || 0);
    finalDamage = calculateMitigation(rawDamage, armor);
  } else if (type === 'magical') {
    const mr = Math.max(0, target.magicResist || 0);
    finalDamage = calculateMitigation(rawDamage, mr);
  } else if (type === 'true') {
    finalDamage = rawDamage; // True damage ignores armor & MR
  }

  // Round or keep precision
  finalDamage = Math.max(0, finalDamage);

  const previousHp = target.hp;
  target.hp = Math.max(0, target.hp - finalDamage);
  const actualDamageDealt = previousHp - target.hp;
  const wasLethal = target.hp <= 0 && previousHp > 0;

  let lifestealHealed = 0;
  if (lifesteal > 0 && type === 'physical') {
    lifestealHealed = actualDamageDealt * lifesteal;
  }

  return {
    rawDamage,
    finalDamage,
    actualDamageDealt,
    wasLethal,
    killerId: wasLethal ? sourceId : null,
    lifestealHealed
  };
}

export function calculateEffectiveHealth(hp, resistance) {
  return hp * (1 + Math.max(0, resistance) / 100);
}
