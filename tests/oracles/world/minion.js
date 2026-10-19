/**
 * Specification Reference Oracle: Minion Wave Spawning, Waypoints & AI Leash
 * Source: PROJECT.md §2 & spec_miner_engine_r0/handoff.md §3 (Features 25-29)
 */

export const WAVE_INTERVAL = 60.0; // 60s
export const LEASH_MAX_DISTANCE = 400;

export const LANE_WAYPOINTS = [
  { x: 400, y: 400 },   // Allied base
  { x: 800, y: 800 },   // Outer allied
  { x: 1200, y: 1200 },
  { x: 1600, y: 1600 }, // Center of map
  { x: 2000, y: 2000 },
  { x: 2400, y: 2400 }, // Outer enemy
  { x: 2800, y: 2800 }  // Enemy base
];

export function getWaveComposition(waveIndex) {
  const isCannonWave = waveIndex % 3 === 0;
  return {
    waveIndex,
    meleeCount: 3,
    rangedCount: 3,
    cannonCount: isCannonWave ? 1 : 0,
    totalUnits: isCannonWave ? 7 : 6
  };
}

export function shouldDisengageLeash(minionPos, currentWaypointPos) {
  const dist = Math.hypot(minionPos.x - currentWaypointPos.x, minionPos.y - currentWaypointPos.y);
  return dist > LEASH_MAX_DISTANCE;
}

export function resolveMinionDeath(minionType, killerEntity, nearbyAllies = []) {
  const bounties = {
    melee: 21,
    ranged: 14,
    cannon: 45
  };

  const baseBounty = bounties[minionType] || 0;

  // Last-hit gold ONLY awarded if killer is a player hero
  if (!killerEntity || killerEntity.type !== 'hero') {
    return {
      awardedKillerGold: 0,
      awardedAssistGold: [],
      reason: 'denied_by_non_hero'
    };
  }

  const assists = [];
  if (nearbyAllies.length > 0) {
    const assistAmount = Math.floor(baseBounty * 0.30);
    for (const ally of nearbyAllies) {
      if (ally.id !== killerEntity.id) {
        assists.push({
          heroId: ally.id,
          gold: assistAmount
        });
      }
    }
  }

  return {
    awardedKillerGold: baseBounty,
    awardedAssistGold: assists,
    reason: 'hero_last_hit'
  };
}
