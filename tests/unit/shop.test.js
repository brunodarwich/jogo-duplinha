import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Base Shop Boundary & Fountain Regeneration', () => {
  it('TC-SHP-01: Permits shop access within 250-unit fountain radius', async () => {
    const { module: recallMod } = await resolveModule('systems/recall');
    const recall = new recallMod.RecallSystem({ x: 400, y: 400 });

    const heroInside = { x: 500, y: 400 }; // dist = 100
    assertTrue(recall.isInsideShopZone(heroInside));
  });

  it('TC-SHP-02: Denies shop access outside 250-unit fountain radius', async () => {
    const { module: recallMod } = await resolveModule('systems/recall');
    const recall = new recallMod.RecallSystem({ x: 400, y: 400 });

    const heroOutside = { x: 700, y: 400 }; // dist = 300
    assertFalse(recall.isInsideShopZone(heroOutside));
  });

  it('TC-SHP-03: Precise boundary validation at exactly 250 units', async () => {
    const { module: recallMod } = await resolveModule('systems/recall');
    const recall = new recallMod.RecallSystem({ x: 400, y: 400 });

    const onBorder = { x: 650, y: 400 }; // dist = 250.0
    assertTrue(recall.isInsideShopZone(onBorder));

    const pastBorder = { x: 650.1, y: 400 }; // dist = 250.1
    assertFalse(recall.isInsideShopZone(pastBorder));
  });

  it('TC-SHP-04: Rapid fountain regeneration heals +10% HP/s and +10% Mana/s', async () => {
    const { module: recallMod } = await resolveModule('systems/recall');
    const recall = new recallMod.RecallSystem({ x: 400, y: 400 });
    const hero = {
      x: 400, y: 400,
      hp: 100, maxHp: 1000,
      mana: 50, maxMana: 500
    };

    // 1 second in fountain => +100 HP, +50 Mana
    const regen = recall.applyFountainRegen(hero, 1.0);
    assertTrue(regen);
    assertEqual(hero.hp, 200);
    assertEqual(hero.mana, 100);
  });

  it('TC-SHP-05: Fountain regeneration clamps cleanly at Max HP and Max Mana', async () => {
    const { module: recallMod } = await resolveModule('systems/recall');
    const recall = new recallMod.RecallSystem({ x: 400, y: 400 });
    const hero = {
      x: 400, y: 400,
      hp: 980, maxHp: 1000,
      mana: 490, maxMana: 500
    };

    recall.applyFountainRegen(hero, 1.0);
    assertEqual(hero.hp, 1000);
    assertEqual(hero.mana, 500);
  });

  it('TC-SHP-06: Fountain regeneration does not apply when hero is outside fountain', async () => {
    const { module: recallMod } = await resolveModule('systems/recall');
    const recall = new recallMod.RecallSystem({ x: 400, y: 400 });
    const hero = {
      x: 1000, y: 1000, // in lane
      hp: 100, maxHp: 1000,
      mana: 50, maxMana: 500
    };

    const regen = recall.applyFountainRegen(hero, 1.0);
    assertFalse(regen);
    assertEqual(hero.hp, 100);
    assertEqual(hero.mana, 50);
  });
});
