/**
 * Specification Reference Oracle: Defensive Towers, Aggro Priority & Heat Scaling
 * Source: PROJECT.md §2 & spec_miner_engine_r0/handoff.md §3 (Features 19-24)
 */

export const TOWER_RADIUS = 400;
export const TOWER_PROJECTILE_SPEED = 750;
export const BASE_TOWER_DAMAGE = 150;

export class DefensiveTower {
  constructor(id, team, x, y, tier = 'outer', parentTower = null) {
    this.id = id;
    this.team = team;
    this.x = x;
    this.y = y;
    this.tier = tier; // 'outer', 'inner', 'nexus'
    this.parentTower = parentTower;
    this.hp = 2500;
    this.maxHp = 2500;
    this.armor = 50;
    this.currentTarget = null;
    this.consecutiveHitsOnTarget = 0;
  }

  isInvulnerable() {
    if (this.parentTower && this.parentTower.hp > 0) {
      return true;
    }
    return false;
  }

  isWithinRange(entity) {
    const dist = Math.hypot(entity.x - this.x, entity.y - this.y);
    return dist <= TOWER_RADIUS;
  }

  /**
   * Evaluates tower aggro priority:
   * 1. Aggressor hero that attacked an allied hero in range (call for help)
   * 2. Unit attacking tower
   * 3. Closest enemy minion in range
   * 4. Closest enemy hero in range
   */
  selectTarget(enemiesInRange, callForHelpAggressorId = null, unitAttackingTowerId = null) {
    // Current target valid check
    const currentInList = enemiesInRange.find(e => e.id === this.currentTarget?.id);
    if (this.currentTarget && (!currentInList || currentInList.hp <= 0)) {
      this.currentTarget = null;
      this.consecutiveHitsOnTarget = 0;
    }

    // 1. Call for Help Aggressor
    if (callForHelpAggressorId) {
      const aggressor = enemiesInRange.find(e => e.id === callForHelpAggressorId && e.type === 'hero');
      if (aggressor) {
        if (this.currentTarget?.id !== aggressor.id) {
          this.currentTarget = aggressor;
          this.consecutiveHitsOnTarget = 0;
        }
        return this.currentTarget;
      }
    }

    // If currently targeting an enemy and still valid, maintain lock unless higher priority intervenes
    if (this.currentTarget) {
      return this.currentTarget;
    }

    // 2. Unit attacking tower
    if (unitAttackingTowerId) {
      const unit = enemiesInRange.find(e => e.id === unitAttackingTowerId);
      if (unit) {
        this.currentTarget = unit;
        this.consecutiveHitsOnTarget = 0;
        return this.currentTarget;
      }
    }

    // 3. Closest enemy minion
    const minions = enemiesInRange.filter(e => e.type === 'minion');
    if (minions.length > 0) {
      minions.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));
      this.currentTarget = minions[0];
      this.consecutiveHitsOnTarget = 0;
      return this.currentTarget;
    }

    // 4. Closest enemy hero
    const heroes = enemiesInRange.filter(e => e.type === 'hero');
    if (heroes.length > 0) {
      heroes.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));
      this.currentTarget = heroes[0];
      this.consecutiveHitsOnTarget = 0;
      return this.currentTarget;
    }

    this.currentTarget = null;
    this.consecutiveHitsOnTarget = 0;
    return null;
  }

  calculateShotDamage(target) {
    if (!target) return 0;
    let multiplier = 1.0;
    if (target.type === 'hero') {
      // +25% per hit up to +100% (max 2.0x)
      const bonus = Math.min(1.0, this.consecutiveHitsOnTarget * 0.25);
      multiplier = 1.0 + bonus;
    }
    return BASE_TOWER_DAMAGE * multiplier;
  }

  recordShot(target) {
    if (this.currentTarget && this.currentTarget.id === target.id) {
      if (target.type === 'hero') {
        this.consecutiveHitsOnTarget++;
      }
    } else {
      this.currentTarget = target;
      this.consecutiveHitsOnTarget = target.type === 'hero' ? 1 : 0;
    }
  }

  takeDamage(amount) {
    if (this.isInvulnerable()) {
      return { damageTaken: 0, invulnerable: true };
    }
    const damageTaken = Math.min(this.hp, amount);
    this.hp -= damageTaken;
    return { damageTaken, invulnerable: false, destroyed: this.hp <= 0 };
  }
}
