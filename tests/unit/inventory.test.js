import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: 6-Slot Inventory, 18 Items & Stat Recomputation', () => {
  it('TC-INV-01: Initializes with exactly 6 empty slots', async () => {
    const { module: itemMod } = await resolveModule('systems/items');
    const hero = { baseStats: { hp: 500, attackDamage: 50, armor: 20, magicResist: 20, movementSpeed: 300 } };
    const inv = new itemMod.HeroInventory(hero);

    assertEqual(inv.slots.length, 6);
    assertTrue(inv.slots.every(s => s === null));
    assertFalse(inv.isFull());
  });

  it('TC-INV-02: Item catalog contains 18 items with valid stats across 3 tiers', async () => {
    const { module: itemMod } = await resolveModule('systems/items');
    const catalog = itemMod.ITEM_CATALOG;

    const itemKeys = Object.keys(catalog);
    assertEqual(itemKeys.length, 18, 'Catalog must contain exactly 18 items');

    const tier1 = itemKeys.filter(k => catalog[k].tier === 1);
    const tier2 = itemKeys.filter(k => catalog[k].tier === 2);
    const tier3 = itemKeys.filter(k => catalog[k].tier === 3);

    assertEqual(tier1.length, 6, '6 Tier-1 items');
    assertEqual(tier2.length, 6, '6 Tier-2 items');
    assertEqual(tier3.length, 6, '6 Tier-3 items');
  });

  it('TC-INV-03: Equipping item recalculates hero stats and updates current/max HP', async () => {
    const { module: itemMod } = await resolveModule('systems/items');
    const hero = {
      baseStats: { hp: 600, attackDamage: 60, armor: 30, magicResist: 30, movementSpeed: 320 },
      hp: 600,
      maxHp: 600
    };
    const inv = new itemMod.HeroInventory(hero);

    // Equip item_ruby (+150 HP)
    const res = inv.addItem('item_ruby');
    assertTrue(res.success);
    assertEqual(hero.maxHp, 750);
    assertEqual(hero.hp, 750);

    // Equip item_sword_1 (+15 AD, +5% Lifesteal)
    inv.addItem('item_sword_1');
    assertEqual(hero.attackDamage, 75);
    assertEqual(hero.lifesteal, 0.05);
  });

  it('TC-INV-04: Selling item refunds 70% of cost and recalculates stats', async () => {
    const { module: itemMod } = await resolveModule('systems/items');
    const hero = {
      baseStats: { hp: 500, attackDamage: 50, armor: 20, magicResist: 20, movementSpeed: 300 },
      hp: 500, maxHp: 500
    };
    const inv = new itemMod.HeroInventory(hero);

    // Equip item_hammer_war (cost 1200)
    inv.addItem('item_hammer_war');
    assertEqual(hero.attackDamage, 80);

    // Sell item at slot 0: 70% of 1200 = 840
    const sellRes = inv.removeItem(0);
    assertTrue(sellRes.success);
    assertEqual(sellRes.refund, 840);
    assertEqual(inv.slots[0], null);
    assertEqual(hero.attackDamage, 50, 'Stats must revert upon selling');
  });

  it('TC-INV-05: Cooldown Reduction (CDR) is strictly clamped at 40% cap', async () => {
    const { module: itemMod } = await resolveModule('systems/items');
    const hero = {
      baseStats: { hp: 500, attackDamage: 50, armor: 20, magicResist: 20, movementSpeed: 300 },
      hp: 500, maxHp: 500
    };
    const inv = new itemMod.HeroInventory(hero);

    // Equip items totaling >40% CDR
    inv.addItem('item_dawn_chalice'); // +20% CDR
    inv.addItem('item_rabadon');      // +15% CDR
    inv.addItem('item_hammer_war');   // +10% CDR
    // Total raw CDR = 45%

    assertEqual(hero.cdr, 0.40, 'Effective CDR must clamp to 40% (0.40)');
  });

  it('TC-INV-06: Selling +HP item clamps current HP when current HP > new Max HP', async () => {
    const { module: itemMod } = await resolveModule('systems/items');
    const hero = {
      baseStats: { hp: 800, attackDamage: 50, armor: 20, magicResist: 20, movementSpeed: 300 },
      hp: 800, maxHp: 800
    };
    const inv = new itemMod.HeroInventory(hero);

    inv.addItem('item_heart_colossus'); // +700 HP => Max HP = 1500, current HP = 1500
    hero.hp = 1150; // Damaged to 1150/1500

    inv.removeItem(0); // Sells item => Max HP reverts to 800
    assertEqual(hero.maxHp, 800);
    assertEqual(hero.hp, 800, 'Current HP (1150) must clamp to new Max HP (800)');
  });

  it('TC-INV-07: Full inventory prevents adding 7th item and returns error', async () => {
    const { module: itemMod } = await resolveModule('systems/items');
    const hero = {
      baseStats: { hp: 500, attackDamage: 50, armor: 20, magicResist: 20, movementSpeed: 300 },
      hp: 500, maxHp: 500
    };
    const inv = new itemMod.HeroInventory(hero);

    // Fill 6 slots
    for (let i = 0; i < 6; i++) {
      const res = inv.addItem('item_dagger');
      assertTrue(res.success);
    }
    assertTrue(inv.isFull());

    // 7th item attempt
    const res7 = inv.addItem('item_boots_1');
    assertFalse(res7.success);
    assertEqual(res7.reason, 'inventory_full');
  });

  it('TC-INV-08: recalculateHeroStats helper delegates to inventory instance', async () => {
    const { module: itemMod } = await resolveModule('systems/items');
    assertTrue(typeof itemMod.recalculateHeroStats === 'function', 'recalculateHeroStats must be an exported function');
    const hero = {
      baseStats: { hp: 500, attackDamage: 50, armor: 20, magicResist: 20, movementSpeed: 300 },
      hp: 500, maxHp: 500
    };
    hero.inventoryInstance = new itemMod.HeroInventory(hero);
    hero.inventoryInstance.addItem('item_ruby');
    assertEqual(hero.maxHp, 650);
    hero.baseStats.hp = 700;
    itemMod.recalculateHeroStats(hero);
    assertEqual(hero.maxHp, 850);
  });
});

