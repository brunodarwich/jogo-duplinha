// Presentation only: actions never delay damage, projectiles or movement.
export const HERO_ACTIONS = ['attack', 'skill_q', 'skill_w', 'skill_e', 'skill_r'];
export const HERO_ACTION_DISPLAY_SCALE = 1.6;
export const HERO_ACTION_GROUND_ANCHOR = 0.72;

function isAlive(hero) {
  return hero && !hero.isDead && !hero.isDeadState && !(hero.hp <= 0);
}

export function clearHeroAction(hero) {
  hero.visualAction = null;
}

export function getHeroAction(hero, now = Date.now()) {
  if (!isAlive(hero)) {
    if (hero) clearHeroAction(hero);
    return null;
  }
  const state = hero.visualAction;
  if (!state) return null;
  const elapsedMs = Math.max(0, now - state.startedAt);
  if (elapsedMs >= state.durationMs) {
    clearHeroAction(hero);
    return null;
  }
  return { ...state, elapsedMs, frame: Math.min(3, Math.floor(elapsedMs / state.durationMs * 4)) };
}

export function startHeroAction(hero, action, now = Date.now()) {
  if (!isAlive(hero) || !HERO_ACTIONS.includes(action)) return false;
  const current = getHeroAction(hero, now);
  if (action === 'attack' && current?.action.startsWith('skill_')) return false;
  const durationMs = action === 'attack'
    ? Math.min(400, 1000 / Math.max(0.2, hero.attackSpeed || 0.65))
    : action === 'skill_r' ? 700 : 500;
  hero.visualActionSequence = (hero.visualActionSequence || 0) + 1;
  hero.visualAction = { action, sequence: hero.visualActionSequence, startedAt: now, durationMs };
  return true;
}

export function serializeHeroAction(hero, now = Date.now()) {
  const state = getHeroAction(hero, now);
  if (!state) return undefined;
  const { sequence, action, durationMs, elapsedMs } = state;
  return { sequence, action, durationMs, elapsedMs: Math.round(elapsedMs) };
}

export function receiveHeroAction(hero, packet, now = Date.now()) {
  if (!packet || !Number.isSafeInteger(packet.sequence) || packet.sequence <= (hero.visualActionSequence || 0)
      || !HERO_ACTIONS.includes(packet.action) || !Number.isFinite(packet.durationMs)
      || packet.durationMs <= 0 || packet.durationMs > 700 || !Number.isFinite(packet.elapsedMs)
      || packet.elapsedMs < 0) return false;
  hero.visualActionSequence = packet.sequence;
  if (!isAlive(hero) || packet.elapsedMs >= packet.durationMs) {
    clearHeroAction(hero);
    return false;
  }
  hero.visualAction = {
    sequence: packet.sequence, action: packet.action, durationMs: packet.durationMs,
    startedAt: now - packet.elapsedMs
  };
  return true;
}
