import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Minion Wave Timers, Composition & Leash AI', () => {
  it('TC-MIN-01: Waves 1 and 2 spawn standard 3 Melee + 3 Ranged minions', async () => {
    const { module: minionMod } = await resolveModule('world/minion');

    const wave1 = minionMod.getWaveComposition(1);
    assertEqual(wave1.meleeCount, 3);
    assertEqual(wave1.rangedCount, 3);
    assertEqual(wave1.cannonCount, 0);
    assertEqual(wave1.totalUnits, 6);

    const wave2 = minionMod.getWaveComposition(2);
    assertEqual(wave2.meleeCount, 3);
    assertEqual(wave2.rangedCount, 3);
    assertEqual(wave2.cannonCount, 0);
  });

  it('TC-MIN-02: Every 3rd wave (Cannon wave) includes 1 Siege Minion (7 units)', async () => {
    const { module: minionMod } = await resolveModule('world/minion');

    const wave3 = minionMod.getWaveComposition(3);
    assertEqual(wave3.cannonCount, 1);
    assertEqual(wave3.totalUnits, 7);

    const wave6 = minionMod.getWaveComposition(6);
    assertEqual(wave6.cannonCount, 1);
    assertEqual(wave6.totalUnits, 7);
  });

  it('TC-MIN-03: Lane waypoint array contains ordered progression WP0..WP6', async () => {
    const { module: minionMod } = await resolveModule('world/minion');

    assertTrue(Array.isArray(minionMod.LANE_WAYPOINTS));
    assertEqual(minionMod.LANE_WAYPOINTS.length, 7);
    assertEqual(minionMod.LANE_WAYPOINTS[0].x, 400); // Allied base
    assertEqual(minionMod.LANE_WAYPOINTS[6].x, 2800); // Enemy base
  });

  it('TC-MIN-04: AI leash disengages when pulled >400 units away from waypoint', async () => {
    const { module: minionMod } = await resolveModule('world/minion');
    const wp = { x: 1000, y: 1000 };

    const withinLeash = { x: 1200, y: 1200 }; // dist ~282
    const beyondLeash = { x: 1400, y: 1400 }; // dist ~565

    assertFalse(minionMod.shouldDisengageLeash(withinLeash, wp));
    assertTrue(minionMod.shouldDisengageLeash(beyondLeash, wp));
  });

  it('TC-MIN-05: Hero last-hit grants full gold bounty for Melee, Ranged, and Cannon', async () => {
    const { module: minionMod } = await resolveModule('world/minion');
    const hero = { id: 'player_1', type: 'hero' };

    const meleeKill = minionMod.resolveMinionDeath('melee', hero);
    assertEqual(meleeKill.awardedKillerGold, 21);

    const rangedKill = minionMod.resolveMinionDeath('ranged', hero);
    assertEqual(rangedKill.awardedKillerGold, 14);

    const cannonKill = minionMod.resolveMinionDeath('cannon', hero);
    assertEqual(cannonKill.awardedKillerGold, 45);
  });

  it('TC-MIN-06: Non-hero last-hit (tower/creep) grants 0 gold to players', async () => {
    const { module: minionMod } = await resolveModule('world/minion');
    const towerKiller = { id: 'tower_1', type: 'tower' };
    const creepKiller = { id: 'minion_allied_1', type: 'minion' };

    const towerRes = minionMod.resolveMinionDeath('melee', towerKiller);
    assertEqual(towerRes.awardedKillerGold, 0);
    assertEqual(towerRes.reason, 'denied_by_non_hero');

    const creepRes = minionMod.resolveMinionDeath('ranged', creepKiller);
    assertEqual(creepRes.awardedKillerGold, 0);
    assertEqual(creepRes.reason, 'denied_by_non_hero');
  });

  it('TC-MIN-07: Proximity assist awards 30% of bounty to nearby allied heroes', async () => {
    const { module: minionMod } = await resolveModule('world/minion');
    const killer = { id: 'player_1', type: 'hero' };
    const ally2 = { id: 'player_2', type: 'hero' };
    const ally3 = { id: 'player_3', type: 'hero' };

    const res = minionMod.resolveMinionDeath('cannon', killer, [killer, ally2, ally3]);
    assertEqual(res.awardedKillerGold, 45);
    // 30% of 45 = 13g assist
    assertEqual(res.awardedAssistGold.length, 2);
    assertEqual(res.awardedAssistGold[0].heroId, 'player_2');
    assertEqual(res.awardedAssistGold[0].gold, 13);
  });
});
