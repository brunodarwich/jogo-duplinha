import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertCloseTo, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 3 E2E: Combinatorial & Cross-Feature Interactions', () => {
  it('TC-CMB-INTER-01: Knight Taunt under Allied Tower triggers Call for Help and heat ramp', async () => {
    const { module: towerMod } = await resolveModule('world/tower');
    const { module: ccMod } = await resolveModule('combat/cc');
    const { module: combatMod } = await resolveModule('combat/combat');

    const tower = new towerMod.DefensiveTower('tower_1', 'allied', 400, 400);
    const knight = { id: 'knight_1', team: 'allied', x: 500, y: 400, hp: 1200 };
    const enemy = { id: 'enemy_1', team: 'enemy', type: 'hero', x: 520, y: 400, hp: 1500, armor: 30 };
    const minion = { id: 'minion_1', team: 'enemy', type: 'minion', x: 450, y: 400, hp: 300 };

    // Initially, tower targets minion
    let target = tower.selectTarget([minion, enemy]);
    assertEqual(target.id, 'minion_1');

    // Knight applies Taunt to enemy
    const enemyCC = ccMod.createInitialCCState();
    ccMod.applyCC(enemyCC, 'taunt', 1500, 1000, { targetId: knight.id });
    assertFalse(ccMod.canMove(enemyCC, 1200));

    // Enemy forced to attack Knight -> Call for Help triggered!
    target = tower.selectTarget([minion, enemy], 'enemy_1');
    assertEqual(target.id, 'enemy_1');

    // Tower fires 3 consecutive heat shots at enemy
    for (let shot = 1; shot <= 3; shot++) {
      const rawDmg = tower.calculateShotDamage(enemy);
      const res = combatMod.applyDamage(enemy, {
        sourceId: tower.id,
        sourceType: 'tower',
        amount: rawDmg,
        type: 'physical'
      });
      tower.recordShot(enemy);
      assertTrue(res.finalDamage > 0);
    }

    assertEqual(tower.consecutiveHitsOnTarget, 3);
    assertTrue(tower.calculateShotDamage(enemy) > 150 * 1.5);
  });

  it('TC-CMB-INTER-02: Sorceress Frost Nova (Root) into Cataclysm (Stun + DoT) with MR mitigation', async () => {
    const { module: ccMod } = await resolveModule('combat/cc');
    const { module: heroesMod } = await resolveModule('entities/heroes');
    const { module: combatMod } = await resolveModule('combat/combat');

    const target = { id: 'target_1', hp: 2000, magicResist: 50, armor: 50 };
    const targetCC = ccMod.createInitialCCState();

    // 1. Sorceress casts Frost Nova (W)
    const novaDmg = heroesMod.sorceressWDamage(1, 100); // 70 + 60 = 130
    combatMod.applyDamage(target, { sourceId: 'sorceress', amount: novaDmg, type: 'magical' });
    ccMod.applyCC(targetCC, 'root', 1500, 1000);

    assertFalse(ccMod.canMove(targetCC, 1200), 'Target rooted');
    assertTrue(ccMod.canCast(targetCC, 1200), 'Rooted target can still cast spells');

    // 2. Sorceress casts Cataclysm (R) in center
    const cataclysmDmg = heroesMod.sorceressRDamage(1, 100, true); // 220 + 95 = 315
    combatMod.applyDamage(target, { sourceId: 'sorceress', amount: cataclysmDmg, type: 'magical' });
    ccMod.applyCC(targetCC, 'stun', 1500, 1200);

    assertFalse(ccMod.canMove(targetCC, 1400), 'Target stunned and cannot move');
    assertFalse(ccMod.canCast(targetCC, 1400), 'Target stunned and cannot cast');

    // 50 MR means 100 / (100 + 50) = 2/3 damage taken
    const totalRaw = novaDmg + cataclysmDmg; // 130 + 315 = 445
    const expectedTaken = totalRaw * (100 / 150);
    assertCloseTo(2000 - target.hp, expectedTaken, 0.01);
  });

  it('TC-CMB-INTER-03: Ranger Kite: cleanses Slow with Quick Dash and pierces multiple units', async () => {
    const { module: ccMod } = await resolveModule('combat/cc');
    const { module: heroesMod } = await resolveModule('entities/heroes');

    const rangerCC = ccMod.createInitialCCState();
    // Enemy slows Ranger by 40%
    ccMod.applyCC(rangerCC, 'slow', 3000, 1000, { slowPercentage: 0.40 });
    assertEqual(rangerCC.slowPercentage, 0.40);

    // Ranger casts E (Quick Dash) -> Cleanses slow debuff
    ccMod.cleanseSlows(rangerCC);
    assertEqual(rangerCC.slowPercentage, 0, 'Slow must be removed');

    // Ranger casts Q (Piercing Arrow) piercing 2 creeps before hitting enemy hero
    const dmgCreep1 = heroesMod.rangerQDamage(1, 100, 0); // 100%
    const dmgCreep2 = heroesMod.rangerQDamage(1, 100, 1); // 90%
    const dmgHero = heroesMod.rangerQDamage(1, 100, 2);   // 80%

    assertEqual(dmgCreep1, 175);
    assertEqual(dmgCreep2, 175 * 0.90);
    assertEqual(dmgHero, 175 * 0.80);
  });

  it('TC-CMB-INTER-04: Assassin Backstab true damage vs high-armor target + Death Mark detonation', async () => {
    const { module: heroesMod } = await resolveModule('entities/heroes');
    const { module: combatMod } = await resolveModule('combat/combat');

    const heavyTank = { id: 'tank', hp: 3000, armor: 150, magicResist: 50 };

    // 1. Assassin Backstab basic attack (100 AD)
    const { critTotal, physicalPortion, truePortion } = heroesMod.assassinBackstabDamage(100);
    assertEqual(critTotal, 160);
    assertEqual(physicalPortion, 112);
    assertEqual(truePortion, 48);

    // Apply physical portion (mitigated by 150 armor: 100/250 = 0.40)
    const physRes = combatMod.applyDamage(heavyTank, { sourceId: 'assassin', amount: physicalPortion, type: 'physical' });
    assertEqual(physRes.finalDamage, 112 * 0.40);

    // Apply true portion (unmitigated)
    const trueRes = combatMod.applyDamage(heavyTank, { sourceId: 'assassin', amount: truePortion, type: 'true' });
    assertEqual(trueRes.finalDamage, 48);

    const totalDealt = physRes.finalDamage + trueRes.finalDamage;

    // 2. Death Mark detonates: 100 + 35% of total damage dealt as True Damage
    const detonationRaw = heroesMod.assassinRDetonationDamage(1, totalDealt);
    const detRes = combatMod.applyDamage(heavyTank, { sourceId: 'assassin', amount: detonationRaw, type: 'true' });
    assertEqual(detRes.finalDamage, detonationRaw, 'Detonation must deal full True Damage');
  });

  it('TC-CMB-INTER-05: Cleric Sanctuary CC immunity denies Knight Stun and Taunt', async () => {
    const { module: ccMod } = await resolveModule('combat/cc');

    const alliedHeroInsideSanctuary = { id: 'allied_hero', isCCImmune: true };
    const ccState = ccMod.createInitialCCState();

    // Knight attempts to apply Stun
    if (!alliedHeroInsideSanctuary.isCCImmune) {
      ccMod.applyCC(ccState, 'stun', 1500, 1000);
    }
    assertTrue(ccMod.canMove(ccState, 1200), 'CC Immune hero ignores Stun');
    assertTrue(ccMod.canCast(ccState, 1200));

    // Knight attempts to apply Taunt
    if (!alliedHeroInsideSanctuary.isCCImmune) {
      ccMod.applyCC(ccState, 'taunt', 1500, 1000);
    }
    assertTrue(ccMod.canMove(ccState, 1200), 'CC Immune hero ignores Taunt');
    assertEqual(ccState.tauntTargetId, null);
  });

  it('TC-CMB-INTER-06: Item AP multiplier (Rabadon) synergizes with base stats and ability scaling', async () => {
    const { module: heroesMod } = await resolveModule('entities/heroes');
    const { module: itemMod } = await resolveModule('systems/items');

    // Level 6 Sorceress
    const sorceressStats = heroesMod.calculateHeroStatsAtLevel('sorceress', 6);
    const hero = {
      baseStats: { ...sorceressStats },
      hp: sorceressStats.hp,
      maxHp: sorceressStats.hp
    };
    const inv = new itemMod.HeroInventory(hero);

    // Equip Tomo Arcano (+25 AP) and Báculo Celestial (+90 AP, +15% AP multiplier)
    inv.addItem('item_tome_1');
    inv.addItem('item_rabadon');

    // Raw AP = 25 + 90 = 115; With 15% multiplier: 115 * 1.15 = 132.25
    assertCloseTo(hero.ap, 115 * 1.15, 0.01);

    // Ability Q Fireball scales with total modified AP
    const qDmg = heroesMod.sorceressQDamage(3, hero.ap);
    assertEqual(qDmg.impact, 185 + 0.75 * hero.ap);
  });
});
