import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse, assertGreater } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 4 E2E: Real-World Match End-to-End Simulation', () => {
  it('TC-E2E-MATCH-01: Full match walkthrough from Level 1 spawn to Nexus victory', async () => {
    // 1. Module resolution
    const { module: heroesMod } = await resolveModule('entities/heroes');
    const { module: ecoMod } = await resolveModule('systems/economy');
    const { module: itemMod } = await resolveModule('systems/items');
    const { module: recallMod } = await resolveModule('systems/recall');
    const { module: minionMod } = await resolveModule('world/minion');
    const { module: towerMod } = await resolveModule('world/tower');
    const { module: bossMod } = await resolveModule('world/boss');
    const { module: combatMod } = await resolveModule('combat/combat');

    // ==========================================
    // STAGE 1: Match Spawn & Starter Item Purchase
    // ==========================================
    const fountainCoords = { x: 400, y: 400 };
    const knightBase = heroesMod.calculateHeroStatsAtLevel('knight', 1);
    const hero = {
      id: 'player_knight',
      team: 'allied',
      type: 'hero',
      x: fountainCoords.x,
      y: fountainCoords.y,
      baseStats: knightBase,
      hp: knightBase.hp,
      maxHp: knightBase.hp,
      mana: knightBase.mana,
      maxMana: knightBase.mana,
      isRecalling: false,
      recallProgress: 0,
      recallCooldownRemaining: 0
    };

    const eco = new ecoMod.EconomyManager([hero]);
    const inv = new itemMod.HeroInventory(hero);
    const recallSys = new recallMod.RecallSystem(fountainCoords);

    // Initial 500 gold
    assertEqual(eco.getGold(hero.id), 500);
    assertTrue(recallSys.isInsideShopZone(hero), 'Hero spawns inside shop zone');

    // Buy Espada Curta (450g)
    const starterCost = itemMod.ITEM_CATALOG['item_sword_1'].cost; // 450
    eco.setGold(hero.id, eco.getGold(hero.id) - starterCost);
    const buyRes = inv.addItem('item_sword_1');
    assertTrue(buyRes.success);
    assertEqual(eco.getGold(hero.id), 50);
    assertEqual(hero.attackDamage, knightBase.attackDamage + 15);
    assertEqual(hero.lifesteal, 0.05);

    // ==========================================
    // STAGE 2: Lane March
    // ==========================================
    hero.x = 1200;
    hero.y = 1200;
    assertFalse(recallSys.isInsideShopZone(hero), 'Hero left base');

    // ==========================================
    // STAGE 3: Minion Wave Spawning & Farming
    // ==========================================
    // Advance 60s: passive gold generates 60 * 2 = 120g
    eco.updatePassiveGold(60.0);
    assertEqual(eco.getGold(hero.id), 50 + 120); // 170g

    // Wave 1 spawns
    const wave1 = minionMod.getWaveComposition(1);
    assertEqual(wave1.meleeCount, 3);
    assertEqual(wave1.rangedCount, 3);

    // Hero last-hits 2 melee minions (+21g each) and 1 ranged minion (+14g)
    const kill1 = minionMod.resolveMinionDeath('melee', hero);
    eco.awardLastHit(hero.id, kill1.awardedKillerGold);
    const kill2 = minionMod.resolveMinionDeath('melee', hero);
    eco.awardLastHit(hero.id, kill2.awardedKillerGold);
    const kill3 = minionMod.resolveMinionDeath('ranged', hero);
    eco.awardLastHit(hero.id, kill3.awardedKillerGold);

    // 170 + 21 + 21 + 14 = 226g
    assertEqual(eco.getGold(hero.id), 226);

    // ==========================================
    // STAGE 4: Combat Engagement & Low HP
    // ==========================================
    // Hero takes heavy damage in lane trade
    hero.hp = 180;
    assertTrue(hero.hp < hero.maxHp * 0.30);

    // ==========================================
    // STAGE 5: Channeled Recall (B) & Rapid Fountain Healing
    // ==========================================
    const recallStart = recallSys.startRecall(hero);
    assertTrue(recallStart.success);
    assertTrue(hero.isRecalling);

    // Channel for 5.0 seconds uninterrupted
    const recallResult = recallSys.update(hero, 5.0);
    assertTrue(recallResult.completed);
    assertEqual(hero.x, fountainCoords.x, 'Hero teleported to fountain');
    assertEqual(hero.y, fountainCoords.y);

    // In fountain, heal back to full over 8.5 seconds
    for (let sec = 0; sec < 9; sec++) {
      recallSys.applyFountainRegen(hero, 1.0);
    }
    assertEqual(hero.hp, hero.maxHp, 'Healed to 100% full HP');

    // ==========================================
    // STAGE 6: Base Shop Upgrade
    // ==========================================
    // Sell starter sword: 70% of 450 = 315g
    const sellRes = inv.removeItem(0);
    assertTrue(sellRes.success);
    assertEqual(sellRes.refund, 315);
    eco.awardLastHit(hero.id, sellRes.refund); // 226 + 315 = 541g

    // Add gold from continued match farming
    eco.awardLastHit(hero.id, 800); // Now 1341g

    // Buy Martelo de Guerra (1200g)
    const hammerCost = itemMod.ITEM_CATALOG['item_hammer_war'].cost;
    eco.setGold(hero.id, eco.getGold(hero.id) - hammerCost);
    const hammerBuy = inv.addItem('item_hammer_war');
    assertTrue(hammerBuy.success);
    assertEqual(hero.attackDamage, knightBase.attackDamage + 30);
    assertEqual(hero.cdr, 0.10);

    // ==========================================
    // STAGE 7: Wave 5 Mini-Boss: Stone Colossus
    // ==========================================
    const colossusConfig = bossMod.BOSS_CONFIGS.colossus;
    assertEqual(colossusConfig.spawnWave, 5);

    // Battle and slay Colossus
    eco.awardBossBounty(hero.id, [hero.id], false);
    // +150 killer + 150 team = +300g
    assertGreater(eco.getGold(hero.id), 300);

    // ==========================================
    // STAGE 8: Tower Push, Supreme Boss & Victory
    // ==========================================
    // Outer tower destroyed
    const outerTower = new towerMod.DefensiveTower('tower_enemy_outer', 'enemy', 2400, 2400);
    outerTower.takeDamage(3000);
    assertTrue(outerTower.hp <= 0);
    eco.awardTowerBounty(hero.id, [hero.id]);

    // Supreme Boss engaged at Enemy Nexus
    const supremeBoss = new bossMod.SupremeBoss();
    assertEqual(supremeBoss.phase, 1);

    // Damage through phase 2 and 3
    supremeBoss.takeDamage(4500);
    assertEqual(supremeBoss.phase, 2);
    supremeBoss.takeDamage(4500);
    assertEqual(supremeBoss.phase, 3);
    supremeBoss.takeDamage(3000);
    assertTrue(supremeBoss.hp <= 0);

    // Enemy Nexus destroyed after supreme boss is down
    const enemyNexusHp = 0;
    const finalOutcome = bossMod.evaluateMatchOutcome(1000, enemyNexusHp, false);

    assertTrue(finalOutcome.isOver);
    assertEqual(finalOutcome.outcome, 'VICTORY', 'Cooperative players achieve VICTORY!');
  });
});
