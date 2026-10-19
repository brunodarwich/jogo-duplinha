/**
 * Specification Reference Oracle: Mini-Bosses, Supreme Boss & Victory/Defeat Triggers
 * Source: PROJECT.md §2 & spec_miner_engine_r0/handoff.md §3 (Features 30-33)
 */

export const BOSS_CONFIGS = {
  colossus: {
    id: 'boss_colossus',
    name: 'Stone Colossus',
    spawnWave: 5,
    maxHp: 3500,
    towerDamageReduction: 0.40, // takes 40% less damage from towers
    slamRadius: 220,
    slamStunDuration: 1.5,
    bountyKiller: 150,
    bountyTeam: 150,
    buff: { name: 'Colossus Might', duration: 60, adBonusPercent: 0.15, apBonusPercent: 0.15 }
  },
  behemoth: {
    id: 'boss_behemoth',
    name: 'Abyssal Behemoth',
    spawnWave: 10,
    maxHp: 6000,
    silenceDuration: 2.0,
    bountyKiller: 150,
    bountyTeam: 150
  },
  supreme: {
    id: 'boss_supreme',
    name: 'Nexus Guardian',
    maxHp: 12000,
    bountyKiller: 500,
    bountyTeam: 500
  }
};

export class SupremeBoss {
  constructor() {
    this.id = BOSS_CONFIGS.supreme.id;
    this.name = BOSS_CONFIGS.supreme.name;
    this.maxHp = BOSS_CONFIGS.supreme.maxHp;
    this.hp = this.maxHp;
    this.shieldActive = false;
  }

  get phase() {
    const ratio = this.hp / this.maxHp;
    if (ratio > 0.66) return 1; // Frontal Cleave
    if (ratio > 0.33) return 2; // Meteor Rain
    return 3;                   // Cataclysmic Shield / Enrage
  }

  takeDamage(amount) {
    if (this.shieldActive) {
      return { damageTaken: 0, shielded: true, isDead: false };
    }
    const taken = Math.min(this.hp, amount);
    this.hp -= taken;
    return { damageTaken: taken, shielded: false, isDead: this.hp <= 0 };
  }
}

export function evaluateMatchOutcome(alliedNexusHp, enemyNexusHp, supremeBossAlive) {
  if (alliedNexusHp <= 0) {
    return { outcome: 'DEFEAT', isOver: true };
  }
  // Enemy nexus cannot be destroyed while supreme boss is alive
  if (enemyNexusHp <= 0 && !supremeBossAlive) {
    return { outcome: 'VICTORY', isOver: true };
  }
  return { outcome: 'IN_PROGRESS', isOver: false };
}
