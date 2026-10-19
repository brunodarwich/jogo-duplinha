/**
 * Crowd Control State Machine Matrix
 */

export function createInitialCCState() {
  return {
    stunnedUntil: 0,
    rootedUntil: 0,
    silencedUntil: 0,
    tauntedUntil: 0,
    tauntTargetId: null,
    slowedUntil: 0,
    slowPercentage: 0,
    stealthedUntil: 0
  };
}

export function canMove(ccState, now = 0) {
  return (
    now >= ccState.stunnedUntil &&
    now >= ccState.rootedUntil &&
    now >= ccState.tauntedUntil
  );
}

export function canAttack(ccState, now = 0) {
  return (
    now >= ccState.stunnedUntil &&
    now >= ccState.silencedUntil
  );
}

export function canCast(ccState, now = 0) {
  return (
    now >= ccState.stunnedUntil &&
    now >= ccState.silencedUntil &&
    now >= ccState.tauntedUntil
  );
}

export function breaksChannel(ccType) {
  const normalized = String(ccType).toLowerCase();
  return ['stun', 'taunt', 'silence', 'knockback'].includes(normalized);
}

export function applyCC(ccState, type, durationMs, now = 0, extra = {}) {
  const until = now + durationMs;
  const normalized = String(type).toLowerCase();

  switch (normalized) {
    case 'stun':
      ccState.stunnedUntil = Math.max(ccState.stunnedUntil, until);
      break;
    case 'root':
      ccState.rootedUntil = Math.max(ccState.rootedUntil, until);
      break;
    case 'silence':
      ccState.silencedUntil = Math.max(ccState.silencedUntil, until);
      break;
    case 'taunt':
      ccState.tauntedUntil = Math.max(ccState.tauntedUntil, until);
      ccState.tauntTargetId = extra.targetId || null;
      break;
    case 'slow':
      if (until > ccState.slowedUntil || (extra.slowPercentage || 0) > ccState.slowPercentage) {
        ccState.slowedUntil = Math.max(ccState.slowedUntil, until);
        ccState.slowPercentage = Math.max(ccState.slowPercentage, extra.slowPercentage || 0);
      }
      break;
    case 'stealth':
      ccState.stealthedUntil = Math.max(ccState.stealthedUntil, until);
      break;
    default:
      break;
  }
}

export function cleanseSlows(ccState) {
  ccState.slowedUntil = 0;
  ccState.slowPercentage = 0;
}
