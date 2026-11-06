/**
 * Combat Engine, Mitigation & Damage Formulas
 */

export function calculateMitigation(damage, resistance) {
  if (resistance <= 0) return damage;
  return damage * (100 / (100 + resistance));
}

export function applyDamage(target, damageEvent = {}) {
  const {
    sourceId,
    sourceType = 'hero',
    amount = 0,
    type = 'physical',
    isCrit = false,
    critMultiplier = 2.0,
    lifesteal = 0
  } = damageEvent;

  const emptyResult = {
    rawDamage: 0, finalDamage: 0, actualDamageDealt: 0,
    wasLethal: false, killerId: null, lifestealHealed: 0
  };
  if (!target || !Number.isFinite(target.hp) || target.hp <= 0 ||
      !Number.isFinite(amount) || amount <= 0 ||
      (typeof target.isAlive === 'function' && !target.isAlive()) ||
      target.isDead === true || target.shieldActive ||
      (typeof target.isInvulnerable === 'function' && target.isInvulnerable())) {
    return emptyResult;
  }

  let rawDamage = amount;
  if (isCrit) {
    rawDamage *= Number.isFinite(critMultiplier) && critMultiplier > 0 ? critMultiplier : 2;
  }
  if (!Number.isFinite(rawDamage)) return emptyResult;

  if (sourceType === 'tower' && Number.isFinite(target.towerDamageReduction)) {
    rawDamage *= 1 - Math.max(0, Math.min(1, target.towerDamageReduction));
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

  finalDamage = Math.max(0, finalDamage);

  const previousHp = target.hp;
  const previousBarrier = target.barrier || 0;
  // takeDamage is the HP/barrier/lifecycle primitive. Mitigation belongs here,
  // so an entity never receives a second resistance or barrier calculation.
  if (typeof target.takeDamage === 'function') {
    target.takeDamage(finalDamage, type);
  } else {
    let remaining = finalDamage;
    if (target.barrier > 0) {
      const absorbed = Math.min(target.barrier, remaining);
      target.barrier -= absorbed;
      remaining -= absorbed;
    }
    target.hp = Math.max(0, target.hp - remaining);
  }
  const actualDamageDealt = previousHp - target.hp;
  const wasLethal = target.hp <= 0 && previousHp > 0;
  if (sourceId && (actualDamageDealt > 0 || (target.barrier || 0) < previousBarrier)) {
    target.lastDamagerId = sourceId;
    target.lastDamageSourceType = sourceType;
  }

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
