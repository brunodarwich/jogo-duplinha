/**
 * Specification Reference Oracle: Gold Economy, Passive Generation & Objective Bounties
 * Source: PROJECT.md §4 & spec_miner_systems_r0/handoff.md §4.3 (A)
 */

export const STARTING_GOLD = 500;
export const PASSIVE_GOLD_RATE = 2.0; // 2.0 gold/sec

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
    const KILLER_BONUS = 100;
    const TEAM_BONUS = 150;

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
      if (killerHeroId) this.goldPool[killerHeroId] = (this.goldPool[killerHeroId] || 0) + 500;
      return;
    }

    const KILLER_BONUS = 150;
    const TEAM_BONUS = 150;
    for (const id of alliedHeroIds) {
      if (!this.goldPool[id]) this.goldPool[id] = 0;
      this.goldPool[id] += TEAM_BONUS;
    }
    if (killerHeroId && this.goldPool[killerHeroId] !== undefined) {
      this.goldPool[killerHeroId] += KILLER_BONUS;
    }
  }
}
