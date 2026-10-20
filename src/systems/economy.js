/**
 * Specification Reference: Gold Economy, Passive Generation & Objective Bounties
 */

export const STARTING_GOLD = 1200;
export const PASSIVE_GOLD_RATE = 10; // 600 gold/minute, including time spent dead
export const TOWER_BOUNTY = 600;
export const BOSS_BOUNTY = 900;
export const SUPREME_BOUNTY = 1500;

export function accruePassiveGold(hero, dt) {
  if (!hero || !Number.isFinite(dt) || dt <= 0) return 0;
  hero.passiveGoldAccumulator = (hero.passiveGoldAccumulator || 0) + dt * PASSIVE_GOLD_RATE;
  const grant = Math.floor(hero.passiveGoldAccumulator + 1e-9);
  hero.passiveGoldAccumulator -= grant;
  hero.gold = (hero.gold || 0) + grant;
  return grant;
}

export class EconomyManager {
  constructor(heroes = []) {
    this.goldPool = {};
    for (const h of heroes) {
      this.goldPool[h.id] = STARTING_GOLD;
    }
    this.passiveAccumulator = 0;
  }

  getGold(heroId) {
    return this.goldPool[heroId] || 0;
  }

  setGold(heroId, amount) {
    this.goldPool[heroId] = Math.max(0, amount);
  }

  updatePassiveGold(dt) {
    this.passiveAccumulator += dt * PASSIVE_GOLD_RATE;
    if (this.passiveAccumulator >= 1.0) {
      const grant = Math.floor(this.passiveAccumulator);
      this.passiveAccumulator -= grant;
      for (const id of Object.keys(this.goldPool)) {
        this.goldPool[id] += grant;
      }
      return grant;
    }
    return 0;
  }

  awardLastHit(heroId, bounty) {
    if (!this.goldPool[heroId] && this.goldPool[heroId] !== 0) {
      this.goldPool[heroId] = 0;
    }
    this.goldPool[heroId] += bounty;
    return this.goldPool[heroId];
  }

  awardTowerBounty(killerHeroId, alliedHeroIds = []) {
    const KILLER_BONUS = 250;
    const TEAM_BONUS = 350;

    for (const id of alliedHeroIds) {
      if (!this.goldPool[id]) this.goldPool[id] = 0;
      this.goldPool[id] += TEAM_BONUS;
    }

    if (killerHeroId && this.goldPool[killerHeroId] !== undefined) {
      this.goldPool[killerHeroId] += KILLER_BONUS;
    }
  }

  awardBossBounty(killerHeroId, alliedHeroIds = [], isSupreme = false) {
    if (isSupreme) {
      if (killerHeroId) {
        this.goldPool[killerHeroId] = (this.goldPool[killerHeroId] || 0) + SUPREME_BOUNTY;
      }
      return;
    }

    const KILLER_BONUS = 300;
    const TEAM_BONUS = 600;
    for (const id of alliedHeroIds) {
      if (!this.goldPool[id]) this.goldPool[id] = 0;
      this.goldPool[id] += TEAM_BONUS;
    }
    if (killerHeroId && this.goldPool[killerHeroId] !== undefined) {
      this.goldPool[killerHeroId] += KILLER_BONUS;
    }
  }

  canAfford(heroId, cost) {
    return (this.goldPool[heroId] || 0) >= cost;
  }

  deductGold(heroId, cost) {
    if (!this.canAfford(heroId, cost)) return false;
    this.goldPool[heroId] -= cost;
    return true;
  }
}
