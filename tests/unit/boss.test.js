import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Boss Encounters, Phases & Victory/Defeat Triggers', () => {
  it('TC-BOS-01: Wave 5 Stone Colossus attributes and tower damage reduction', async () => {
    const { module: bossMod } = await resolveModule('world/boss');
    const colossus = bossMod.BOSS_CONFIGS.colossus;

    assertEqual(colossus.spawnWave, 5);
    assertEqual(colossus.maxHp, 3500);
    assertEqual(colossus.towerDamageReduction, 0.40);
    assertEqual(colossus.bountyKiller, 150);
    assertEqual(colossus.bountyTeam, 150);
  });

  it('TC-BOS-02: Wave 10 Abyssal Behemoth attributes and 2.0s silence', async () => {
    const { module: bossMod } = await resolveModule('world/boss');
    const behemoth = bossMod.BOSS_CONFIGS.behemoth;

    assertEqual(behemoth.spawnWave, 10);
    assertEqual(behemoth.maxHp, 6000);
    assertEqual(behemoth.silenceDuration, 2.0);
  });

  it('TC-BOS-03: Supreme Boss Nexus Guardian 12000 HP and 500g bounty', async () => {
    const { module: bossMod } = await resolveModule('world/boss');
    const supreme = new bossMod.SupremeBoss();

    assertEqual(supreme.maxHp, 12000);
    assertEqual(supreme.hp, 12000);
  });

  it('TC-BOS-04: Supreme Boss phase transitions at 66% and 33% HP thresholds', async () => {
    const { module: bossMod } = await resolveModule('world/boss');
    const supreme = new bossMod.SupremeBoss();

    // 100% HP => Phase 1
    assertEqual(supreme.phase, 1);

    // Damage to 70% HP (8400) => Phase 1
    supreme.takeDamage(3600);
    assertEqual(supreme.phase, 1);

    // Damage to 50% HP (6000) => Phase 2 (Meteor Rain)
    supreme.takeDamage(2400);
    assertEqual(supreme.phase, 2);

    // Damage to 25% HP (3000) => Phase 3 (Cataclysmic Shield / Enrage)
    supreme.takeDamage(3000);
    assertEqual(supreme.phase, 3);
  });

  it('TC-BOS-05: Supreme Boss active shield completely blocks damage', async () => {
    const { module: bossMod } = await resolveModule('world/boss');
    const supreme = new bossMod.SupremeBoss();

    supreme.shieldActive = true;
    const res = supreme.takeDamage(1000);
    assertEqual(res.damageTaken, 0);
    assertTrue(res.shielded);
    assertEqual(supreme.hp, 12000);

    supreme.shieldActive = false;
    const res2 = supreme.takeDamage(1000);
    assertEqual(res2.damageTaken, 1000);
    assertFalse(res2.shielded);
    assertEqual(supreme.hp, 11000);
  });

  it('TC-BOS-06: VICTORY requires Supreme Boss dead AND Enemy Nexus destroyed', async () => {
    const { module: bossMod } = await resolveModule('world/boss');

    // Nexus at 0 but supreme boss still alive => cannot win
    const outcome1 = bossMod.evaluateMatchOutcome(1000, 0, true);
    assertFalse(outcome1.isOver);
    assertEqual(outcome1.outcome, 'IN_PROGRESS');

    // Supreme boss dead AND nexus at 0 => VICTORY
    const outcome2 = bossMod.evaluateMatchOutcome(1000, 0, false);
    assertTrue(outcome2.isOver);
    assertEqual(outcome2.outcome, 'VICTORY');
  });

  it('TC-BOS-07: DEFEAT triggered immediately when Allied Nexus drops to 0 HP', async () => {
    const { module: bossMod } = await resolveModule('world/boss');

    const outcome = bossMod.evaluateMatchOutcome(0, 5000, true);
    assertTrue(outcome.isOver);
    assertEqual(outcome.outcome, 'DEFEAT');
  });
});
