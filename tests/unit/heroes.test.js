import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertCloseTo, assertTrue } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: 5 Hero Base Stats, Growth & Skill Damage Calculations', () => {
  it('TC-HERO-01: Validates Level 1 base stats for all 5 heroes', async () => {
    const { module: heroesMod } = await resolveModule('entities/heroes');

    const knight = heroesMod.calculateHeroStatsAtLevel('knight', 1);
    assertEqual(knight.hp, 680);
    assertEqual(knight.mana, 300);
    assertEqual(knight.armor, 38);
    assertEqual(knight.attackDamage, 58);
    assertEqual(knight.attackRange, 130);

    const sorceress = heroesMod.calculateHeroStatsAtLevel('sorceress', 1);
    assertEqual(sorceress.hp, 480);
    assertEqual(sorceress.mana, 460);
    assertEqual(sorceress.armor, 18);
    assertEqual(sorceress.attackRange, 480);

    const ranger = heroesMod.calculateHeroStatsAtLevel('ranger', 1);
    assertEqual(ranger.hp, 520);
    assertEqual(ranger.mana, 320);
    assertEqual(ranger.attackDamage, 55);
    assertEqual(ranger.attackRange, 520);

    const assassin = heroesMod.calculateHeroStatsAtLevel('assassin', 1);
    assertEqual(assassin.hp, 540);
    assertEqual(assassin.attackDamage, 62);
    assertEqual(assassin.movementSpeed, 345);

    const cleric = heroesMod.calculateHeroStatsAtLevel('cleric', 1);
    assertEqual(cleric.hp, 530);
    assertEqual(cleric.mana, 440);
    assertEqual(cleric.attackRange, 440);
  });

  it('TC-HERO-02: Validates Level 12 growth formula matching spec table', async () => {
    const { module: heroesMod } = await resolveModule('entities/heroes');

    const knight12 = heroesMod.calculateHeroStatsAtLevel('knight', 12);
    // 680 + 11 * 95 = 1725 HP
    assertEqual(knight12.hp, 1725);
    // 38 + 11 * 4 = 82 Armor
    assertEqual(knight12.armor, 82);
    // 58 + 11 * 3.5 = 96.5 -> ~96.5 AD
    assertCloseTo(knight12.attackDamage, 96.5, 0.5);

    const sorceress12 = heroesMod.calculateHeroStatsAtLevel('sorceress', 12);
    // 480 + 11 * 72 = 1272 HP
    assertEqual(sorceress12.hp, 1272);
    // 460 + 11 * 55 = 1065 Mana
    assertEqual(sorceress12.mana, 1065);

    const ranger12 = heroesMod.calculateHeroStatsAtLevel('ranger', 12);
    // 520 + 11 * 78 = 1378 HP
    assertEqual(ranger12.hp, 1378);

    const assassin12 = heroesMod.calculateHeroStatsAtLevel('assassin', 12);
    // 540 + 11 * 82 = 1442 HP
    assertEqual(assassin12.hp, 1442);

    const cleric12 = heroesMod.calculateHeroStatsAtLevel('cleric', 12);
    // 530 + 11 * 78 = 1388 HP
    assertEqual(cleric12.hp, 1388);
  });

  it('TC-HERO-03: Cavaleiro Guardião skills damage and barrier scaling', async () => {
    const { module: heroesMod } = await resolveModule('entities/heroes');

    // Passive: 100 + 12% Max HP
    const barrier = heroesMod.knightPassiveBarrier(1000);
    assertEqual(barrier, 220);

    // Q: 80 + 60% AD + 8% bonus HP
    const qRank1 = heroesMod.knightQDamage(1, 100, 500);
    // 80 + 60 + 40 = 180
    assertEqual(qRank1, 180);

    // W: 40 + 40% Armor
    const wRank1 = heroesMod.knightWDamage(1, 50);
    assertEqual(wRank1, 60);

    // E: 70 + 85% AD; Minion bonus +25%
    const eHero = heroesMod.knightEDamage(1, 100, false);
    const eMinion = heroesMod.knightEDamage(1, 100, true);
    assertEqual(eHero, 155);
    assertEqual(eMinion, 155 * 1.25);

    // R: 150 + 70% AD
    const rRank1 = heroesMod.knightRDamage(1, 100);
    assertEqual(rRank1, 220);
  });

  it('TC-HERO-04: Feiticeira Elemental skills damage and bounce decay', async () => {
    const { module: heroesMod } = await resolveModule('entities/heroes');

    // Passive: 40 + 15*lvl + 40% AP
    const passiveDmg = heroesMod.sorceressPassiveDamage(10, 200);
    assertEqual(passiveDmg, 40 + 150 + 80);

    // Q: Fireball impact (85 + 75% AP) + DoT (30 + 20% AP)
    const qDmg = heroesMod.sorceressQDamage(1, 100);
    assertEqual(qDmg.impact, 160);
    assertEqual(qDmg.dot, 50);
    assertEqual(qDmg.total, 210);

    // E: Lightning Arc bounces (-15% per bounce, floor 60%)
    const eBase = heroesMod.sorceressEDamage(1, 100, 0); // 100%
    const eBounce1 = heroesMod.sorceressEDamage(1, 100, 1); // 85%
    const eBounce2 = heroesMod.sorceressEDamage(1, 100, 2); // 70%
    const eBounce3 = heroesMod.sorceressEDamage(1, 100, 3); // 60% floor
    assertEqual(eBase, 150);
    assertCloseTo(eBounce1, 150 * 0.85, 0.001);
    assertCloseTo(eBounce2, 150 * 0.70, 0.001);
    assertCloseTo(eBounce3, 150 * 0.60, 0.001);

    // R: Cataclysm Center vs Outer
    const rCenter = heroesMod.sorceressRDamage(1, 100, true);
    const rOuter = heroesMod.sorceressRDamage(1, 100, false);
    assertEqual(rCenter, 315);
    assertEqual(rOuter, 315 * 0.70);
  });

  it('TC-HERO-05: Patrulheiro Arqueiro distance crit passive and pierce falloff', async () => {
    const { module: heroesMod } = await resolveModule('entities/heroes');

    // Passive: +1.2% Crit per 50 units
    assertCloseTo(heroesMod.rangerPassiveCritBonus(250), 0.06, 0.001);
    assertCloseTo(heroesMod.rangerPassiveCritBonus(500), 0.12, 0.001);
    assertCloseTo(heroesMod.rangerPassiveCritBonus(800), 0.12, 0.001, 'Cap at 12%');

    // Q: Piercing Arrow 10% falloff per unit, floor 60%
    const qHit1 = heroesMod.rangerQDamage(1, 100, 0); // 100%
    const qHit2 = heroesMod.rangerQDamage(1, 100, 1); // 90%
    const qHit5 = heroesMod.rangerQDamage(1, 100, 5); // 60% floor
    assertEqual(qHit1, 175);
    assertCloseTo(qHit2, 175 * 0.90, 0.001);
    assertCloseTo(qHit5, 175 * 0.60, 0.001);
  });

  it('TC-HERO-06: Sombra Assassina backstab true damage & Death Mark detonation', async () => {
    const { module: heroesMod } = await resolveModule('entities/heroes');

    // Backstab: 160% crit, 70% physical, 30% true
    const backstab = heroesMod.assassinBackstabDamage(100);
    assertEqual(backstab.critTotal, 160);
    assertEqual(backstab.physicalPortion, 112);
    assertEqual(backstab.truePortion, 48);

    // R Death Mark: 100 + 35% of damage dealt during mark
    const markDetonation = heroesMod.assassinRDetonationDamage(1, 1000);
    assertEqual(markDetonation, 100 + 350);
  });

  it('TC-HERO-07: Clérigo da Luz holy heal amplification on low HP', async () => {
    const { module: heroesMod } = await resolveModule('entities/heroes');

    // Normal heal: 90 + 70% AP = 160
    const normalHeal = heroesMod.clericQHealing(1, 100, 0.80);
    assertEqual(normalHeal, 160);

    // Low HP heal (<40%): amplified by 40% = 224
    const lowHpHeal = heroesMod.clericQHealing(1, 100, 0.35);
    assertEqual(lowHpHeal, 160 * 1.40);
  });
});
