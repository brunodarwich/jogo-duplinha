/**
 * Specification Reference: 5.0-Second Recall Channeling & Interruption Logic
 */

export const RECALL_CHANNEL_TIME = 5.0; // 5000 ms
export const RECALL_PENALTY_COOLDOWN = 1.0; // 1.0s on interrupt
export const FOUNTAIN_RADIUS = 250.0;

export class RecallSystem {
  constructor(fountainCoords = { x: 400, y: 400 }) {
    this.fountain = fountainCoords;
  }

  isInsideShopZone(entity) {
    const dist = Math.hypot(entity.x - this.fountain.x, entity.y - this.fountain.y);
    return dist <= FOUNTAIN_RADIUS;
  }

  startRecall(hero) {
    if (hero.isDead || (hero.cc && hero.cc.stunnedUntil > Date.now())) {
      return { success: false, reason: 'cannot_recall_while_disabled' };
    }
    if (hero.recallCooldownRemaining > 0) {
      return { success: false, reason: 'recall_on_cooldown' };
    }
    if (hero.isRecalling) {
      // Already recalling: ignore keypress
      return { success: false, reason: 'already_recalling' };
    }

    hero.isRecalling = true;
    hero.recallProgress = 0.0;
    hero.isMoving = false;
    return { success: true };
  }

  update(hero, dt) {
    if (!hero.isRecalling) {
      if (hero.recallCooldownRemaining > 0) {
        hero.recallCooldownRemaining = Math.max(0, hero.recallCooldownRemaining - dt);
      }
      return null;
    }

    hero.recallProgress += dt;
    if (hero.recallProgress >= RECALL_CHANNEL_TIME) {
      // Recall completed! Teleport hero to fountain
      hero.isRecalling = false;
      hero.recallProgress = 0.0;
      hero.x = this.fountain.x;
      hero.y = this.fountain.y;
      hero.isMoving = false;
      return { completed: true, x: hero.x, y: hero.y };
    }

    return { completed: false, progress: hero.recallProgress / RECALL_CHANNEL_TIME };
  }

  interrupt(hero, reason) {
    if (!hero || !hero.isRecalling) return false;

    // Healing or fountain regen does NOT interrupt recall
    if (reason === 'heal' || reason === 'regen') return false;

    hero.isRecalling = false;
    hero.recallProgress = 0.0;
    hero.recallCooldownRemaining = RECALL_PENALTY_COOLDOWN;
    return true;
  }

  applyFountainRegen(hero, dt) {
    if (this.isInsideShopZone(hero)) {
      const maxHp = hero.maxHp || hero.baseStats?.hp || 1000;
      const maxMana = hero.maxMana || hero.baseStats?.mana || 500;
      hero.hp = Math.min(maxHp, hero.hp + maxHp * 0.10 * dt);
      hero.mana = Math.min(maxMana, hero.mana + maxMana * 0.10 * dt);
      return true;
    }
    return false;
  }
}
