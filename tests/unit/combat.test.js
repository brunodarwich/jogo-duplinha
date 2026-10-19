import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertCloseTo, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Combat Damage Mitigation & Combat Formulas', () => {
  it('TC-CMB-01: Armor mitigation reduces physical damage: 100/(100 + Armor)', async () => {
    const { module: combat } = await resolveModule('combat/combat');
    const target = { hp: 1000, armor: 100, magicResist: 0 };

    // 100 Armor should mitigate exactly 50%
    const res = combat.applyDamage(target, {
      sourceId: 'hero_1',
      amount: 200,
      type: 'physical'
    });

    assertEqual(res.finalDamage, 100, '200 physical vs 100 armor should deal 100 damage');
    assertEqual(target.hp, 900);
  });

  it('TC-CMB-02: Magic Resistance mitigates magical damage accurately', async () => {
    const { module: combat } = await resolveModule('combat/combat');
    const target = { hp: 1000, armor: 0, magicResist: 50 };

    // 50 MR => 100 / 150 = 2/3 damage taken
    const res = combat.applyDamage(target, {
      sourceId: 'sorceress',
      amount: 300,
      type: 'magical'
    });

    assertCloseTo(res.finalDamage, 200, 0.001);
    assertCloseTo(target.hp, 800, 0.001);
  });

  it('TC-CMB-03: True Damage bypasses Armor and Magic Resistance completely', async () => {
    const { module: combat } = await resolveModule('combat/combat');
    const target = { hp: 1000, armor: 200, magicResist: 200 };

    const res = combat.applyDamage(target, {
      sourceId: 'assassin',
      amount: 250,
      type: 'true'
    });

    assertEqual(res.finalDamage, 250, 'True damage must ignore 200 armor and 200 MR');
    assertEqual(target.hp, 750);
  });

  it('TC-CMB-04: Critical strike scales raw damage by multiplier (2.0x)', async () => {
    const { module: combat } = await resolveModule('combat/combat');
    const target = { hp: 1000, armor: 0, magicResist: 0 };

    const res = combat.applyDamage(target, {
      sourceId: 'ranger',
      amount: 150,
      type: 'physical',
      isCrit: true,
      critMultiplier: 2.0
    });

    assertEqual(res.rawDamage, 300);
    assertEqual(res.finalDamage, 300);
    assertEqual(target.hp, 700);
  });

  it('TC-CMB-05: Lifesteal restores health proportional to actual damage dealt', async () => {
    const { module: combat } = await resolveModule('combat/combat');
    const target = { hp: 1000, armor: 100, magicResist: 0 }; // 50% mitigation

    const res = combat.applyDamage(target, {
      sourceId: 'ranger',
      amount: 200,
      type: 'physical',
      lifesteal: 0.15 // 15% lifesteal
    });

    // Final damage dealt is 100
    assertEqual(res.actualDamageDealt, 100);
    assertEqual(res.lifestealHealed, 15, '15% of 100 damage is 15 HP healed');
  });

  it('TC-CMB-06: Effective Health formula accurately reflects resistance scaling', async () => {
    const { module: combat } = await resolveModule('combat/combat');
    // EHP = HP * (1 + Res / 100)
    assertEqual(combat.calculateEffectiveHealth(1000, 100), 2000);
    assertEqual(combat.calculateEffectiveHealth(1500, 50), 2250);
    assertEqual(combat.calculateEffectiveHealth(800, 0), 800);
  });

  it('TC-CMB-07: Lethal damage reduces HP to 0 and attributes killerId', async () => {
    const { module: combat } = await resolveModule('combat/combat');
    const target = { hp: 50, armor: 0, magicResist: 0 };

    const res = combat.applyDamage(target, {
      sourceId: 'knight',
      amount: 100,
      type: 'physical'
    });

    assertEqual(target.hp, 0, 'HP cannot drop below 0');
    assertTrue(res.wasLethal);
    assertEqual(res.killerId, 'knight');
  });
});
