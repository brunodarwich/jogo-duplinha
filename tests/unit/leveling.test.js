import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse, assertCloseTo } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Player Leveling & Progression System (Levels 1-15)', () => {
  it('TC-LVL-01: Validates XP curve requirements and cumulative totals up to level 15', async () => {
    const { module: lvlMod } = await resolveModule('systems/leveling');

    assertEqual(lvlMod.MAX_LEVEL, 15);

    // Per-level requirements
    const expectedRequirements = {
      1: 240, 2: 360, 3: 500, 4: 660, 5: 840,
      6: 1050, 7: 1280, 8: 1530, 9: 1800, 10: 2100,
      11: 2450, 12: 2850, 13: 3300, 14: 3800, 15: 0
    };

    for (let lvl = 1; lvl <= 15; lvl++) {
      assertEqual(lvlMod.getXpForNextLevel(lvl), expectedRequirements[lvl], `Level ${lvl} XP requirement`);
    }

    // Cumulative XP totals
    const expectedTotals = {
      1: 0, 2: 240, 3: 600, 4: 1100, 5: 1760,
      6: 2600, 7: 3650, 8: 4930, 9: 6460, 10: 8260,
      11: 10360, 12: 12810, 13: 15660, 14: 18960, 15: 22760
    };

    for (let lvl = 1; lvl <= 15; lvl++) {
      assertEqual(lvlMod.getTotalXpForLevel(lvl), expectedTotals[lvl], `Total XP to reach level ${lvl}`);
    }

    // Level up check
    assertTrue(lvlMod.canLevelUp(240, 1));
    assertFalse(lvlMod.canLevelUp(239, 1));
    assertFalse(lvlMod.canLevelUp(99999, 15), 'Level 15 cannot level up further');
  });

  it('TC-LVL-02: Incremental and burst XP transitions clamp cleanly at Level 15', async () => {
    const { module: entityMod } = await resolveModule('entities/entity');
    const { module: lvlMod } = await resolveModule('systems/leveling');

    const hero = new entityMod.HeroEntity({
      heroId: 'knight',
      level: 1,
      hp: 680,
      maxHp: 680,
      mana: 300,
      maxMana: 300
    });

    assertEqual(hero.level, 1);
    assertEqual(hero.xp, 0);
    assertEqual(hero.maxXp, 240);
    assertEqual(hero.skillPoints, 1);

    // Gain partial XP (no level up)
    hero.gainXp(100);
    assertEqual(hero.level, 1);
    assertEqual(hero.xp, 100);
    assertEqual(hero.skillPoints, 1);

    // Gain remainder to hit Level 2
    hero.gainXp(140);
    assertEqual(hero.level, 2);
    assertEqual(hero.xp, 0);
    assertEqual(hero.maxXp, 360);
    assertEqual(hero.skillPoints, 2);

    // Massive burst XP to shoot directly to Level 15
    hero.gainXp(100000);
    assertEqual(hero.level, 15);
    assertEqual(hero.xp, 0);
    assertEqual(hero.maxXp, 0);
    assertEqual(hero.skillPoints, 15);

    // Further XP gains at max level are ignored
    hero.gainXp(5000);
    assertEqual(hero.level, 15);
    assertEqual(hero.xp, 0);
  });

  it('TC-LVL-03: Validates stat scaling across all 15 levels and proportional HP/Mana restoration', async () => {
    const { module: heroesMod } = await resolveModule('entities/heroes');
    const { module: entityMod } = await resolveModule('entities/entity');

    const archetypes = ['knight', 'sorceress', 'ranger', 'assassin', 'cleric'];

    for (const id of archetypes) {
      const def = heroesMod.HERO_DEFINITIONS[id];
      const statsLvl15 = heroesMod.calculateHeroStatsAtLevel(id, 15);

      const expectedHp = def.base.hp + 14 * def.growth.hp;
      const expectedMana = def.base.mana + 14 * def.growth.mana;
      assertEqual(statsLvl15.hp, expectedHp, `${id} HP at level 15`);
      assertEqual(statsLvl15.mana, expectedMana, `${id} Mana at level 15`);
      assertFalse(Number.isNaN(statsLvl15.armor), `${id} armor not NaN`);
      assertFalse(Number.isNaN(statsLvl15.magicResist), `${id} MR not NaN`);
      assertFalse(Number.isNaN(statsLvl15.attackDamage), `${id} AD not NaN`);
      assertFalse(Number.isNaN(statsLvl15.attackSpeed), `${id} AS not NaN`);
    }

    // Test proportional HP/Mana restoration on level up
    const hero = new entityMod.HeroEntity({
      heroId: 'knight',
      level: 1,
      hp: 300, // damaged (300/680)
      maxHp: 680,
      mana: 150, // depleted (150/300)
      maxMana: 300
    });

    const oldMaxHp = hero.maxHp;
    const oldMaxMana = hero.maxMana;
    hero.gainXp(240); // level 1 -> level 2 (+95 maxHp, +38 maxMana)

    assertEqual(hero.level, 2);
    assertEqual(hero.maxHp, oldMaxHp + 95);
    assertEqual(hero.maxMana, oldMaxMana + 38);
    assertEqual(hero.hp, 300 + 95, 'Current HP increases by deltaMaxHp');
    assertEqual(hero.mana, 150 + 38, 'Current Mana increases by deltaMaxMana');
  });

  it('TC-LVL-04: Skill point allocation rules, level gating on R, and 15-point total cap', async () => {
    const { module: entityMod } = await resolveModule('entities/entity');
    const { module: lvlMod } = await resolveModule('systems/leveling');

    const hero = new entityMod.HeroEntity({
      heroId: 'knight',
      level: 1,
      skillPoints: 1
    });

    // Level 1: R is locked
    assertFalse(lvlMod.canUpgradeAbility(hero, 'R'), 'R cannot be upgraded at level 1');
    assertFalse(hero.upgradeAbility('R'));

    // Upgrade Q to rank 1
    assertTrue(lvlMod.canUpgradeAbility(hero, 'Q'));
    assertTrue(hero.upgradeAbility('Q'));
    assertEqual(hero.abilities.Q.rank, 1);
    assertEqual(hero.skillPoints, 0);

    // No skill points left
    assertFalse(hero.upgradeAbility('Q'));
    assertFalse(hero.upgradeAbility('W'));

    // Level up to 5 (4 more points -> total 4 points available)
    hero.gainXp(360 + 500 + 660 + 840);
    assertEqual(hero.level, 5);
    assertEqual(hero.skillPoints, 4);
    assertFalse(lvlMod.canUpgradeAbility(hero, 'R'), 'R still locked at level 5');

    // Upgrade Q to rank 4 (cap)
    assertTrue(hero.upgradeAbility('Q')); // rank 2
    assertTrue(hero.upgradeAbility('Q')); // rank 3
    assertTrue(hero.upgradeAbility('Q')); // rank 4
    assertEqual(hero.abilities.Q.rank, 4);
    assertFalse(hero.upgradeAbility('Q'), 'Q cannot exceed rank 4');

    // Level up to 6 (R unlocks!)
    hero.gainXp(1050);
    assertEqual(hero.level, 6);
    assertTrue(lvlMod.canUpgradeAbility(hero, 'R'), 'R unlocks at level 6');
    assertTrue(hero.upgradeAbility('R')); // rank 1
    assertEqual(hero.abilities.R.rank, 1);

    // R rank 2 requires level 11
    hero.skillPoints = 1;
    assertFalse(lvlMod.canUpgradeAbility(hero, 'R'), 'R rank 2 locked before level 11');

    // Level up to 11 -> R rank 2 unlocks
    hero.level = 11;
    assertTrue(lvlMod.canUpgradeAbility(hero, 'R'));
    assertTrue(hero.upgradeAbility('R'));
    assertEqual(hero.abilities.R.rank, 2);

    // R rank 3 requires level 15
    hero.skillPoints = 1;
    assertFalse(lvlMod.canUpgradeAbility(hero, 'R'), 'R rank 3 locked before level 15');

    // Level up to 15 -> R rank 3 unlocks
    hero.level = 15;
    assertTrue(lvlMod.canUpgradeAbility(hero, 'R'));
    assertTrue(hero.upgradeAbility('R'));
    assertEqual(hero.abilities.R.rank, 3);
    assertFalse(hero.upgradeAbility('R'), 'R cannot exceed rank 3');

    // Validate 15 total points fully maximizes kit: Q(4) + W(4) + E(4) + R(3) = 15
    hero.abilities.Q.rank = 0;
    hero.abilities.W.rank = 0;
    hero.abilities.E.rank = 0;
    hero.abilities.R.rank = 0;
    hero.skillPoints = 15;

    for (let i = 0; i < 4; i++) assertTrue(hero.upgradeAbility('Q'));
    for (let i = 0; i < 4; i++) assertTrue(hero.upgradeAbility('W'));
    for (let i = 0; i < 4; i++) assertTrue(hero.upgradeAbility('E'));
    for (let i = 0; i < 3; i++) assertTrue(hero.upgradeAbility('R'));

    assertEqual(hero.abilities.Q.rank, 4);
    assertEqual(hero.abilities.W.rank, 4);
    assertEqual(hero.abilities.E.rank, 4);
    assertEqual(hero.abilities.R.rank, 3);
    assertEqual(hero.skillPoints, 0);
  });

  it('TC-LVL-05: Minion proximity XP distribution within 800 units and last-hit bonus', async () => {
    const { module: lvlMod } = await resolveModule('systems/leveling');

    const minion = { id: 'min_1', type: 'minion', subType: 'melee', team: 'enemy', x: 1000, y: 1000 };
    const killerHero = { id: 'hero_1', type: 'hero', team: 'allied', x: 1100, y: 1000, isAlive: () => true, hp: 500 };
    const nearAlly = { id: 'hero_2', type: 'hero', team: 'allied', x: 1400, y: 1000, isAlive: () => true, hp: 500 }; // dist 400 <= 800
    const farAlly = { id: 'hero_3', type: 'hero', team: 'allied', x: 2200, y: 1000, isAlive: () => true, hp: 500 }; // dist 1200 > 800
    const enemyHero = { id: 'enemy_1', type: 'hero', team: 'enemy', x: 1050, y: 1000, isAlive: () => true, hp: 500 };

    const entities = [minion, killerHero, nearAlly, farAlly, enemyHero];

    const distribution = lvlMod.resolveMinionXpDistribution(minion, entities, killerHero);

    // Killer gets base + 15% bonus: 60 * 1.15 = 69 XP
    const killerReward = distribution.find(d => d.hero.id === killerHero.id);
    assertTrue(!!killerReward);
    assertEqual(killerReward.xp, 69);
    assertTrue(killerReward.isLastHit);

    // Nearby ally gets base 60 XP
    const allyReward = distribution.find(d => d.hero.id === nearAlly.id);
    assertTrue(!!allyReward);
    assertEqual(allyReward.xp, 60);
    assertFalse(allyReward.isLastHit);

    // Far ally outside 800 units gets nothing
    const farReward = distribution.find(d => d.hero.id === farAlly.id);
    assertTrue(!farReward);

    // Enemy hero on minion's own team gets nothing
    const enemyReward = distribution.find(d => d.hero.id === enemyHero.id);
    assertTrue(!enemyReward);
  });

  it('TC-LVL-06: Tower, Boss, and Enemy Hero kill XP formulas', async () => {
    const { module: lvlMod } = await resolveModule('systems/leveling');

    // Minion kill XP
    assertEqual(lvlMod.calculateKillXp('minion', 1, { subType: 'melee' }), 60);
    assertEqual(lvlMod.calculateKillXp('minion', 1, { subType: 'melee', isLastHit: true }), 69);
    assertEqual(lvlMod.calculateKillXp('minion', 1, { subType: 'ranged' }), 45);
    assertEqual(lvlMod.calculateKillXp('minion', 1, { subType: 'ranged', isLastHit: true }), 52);
    assertEqual(lvlMod.calculateKillXp('minion', 1, { subType: 'cannon' }), 110);
    assertEqual(lvlMod.calculateKillXp('minion', 1, { subType: 'cannon', isLastHit: true }), 127);

    // Hero kill XP: 180 + lvl * 40
    assertEqual(lvlMod.calculateKillXp('hero', 1), 220);
    assertEqual(lvlMod.calculateKillXp('hero', 6), 420);
    assertEqual(lvlMod.calculateKillXp('hero', 15), 780);

    // Tower & Boss XP
    assertEqual(lvlMod.calculateKillXp('tower'), 250);
    assertEqual(lvlMod.calculateKillXp('boss', 1, { isSupreme: false }), 400);
    assertEqual(lvlMod.calculateKillXp('boss', 1, { isSupreme: true }), 750);
  });

  it('TC-LVL-07: Ctrl + Q/W/E/R triggers UPGRADE_ABILITY command in InputDispatcher and GameSimulation', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const { module: gameMod } = await resolveModule('game');

    const dispatcher = new inputMod.InputDispatcher();
    const heroMock = { id: 'hero_1', isDead: false, isAlive: () => true };

    // Ctrl + Q
    const cmdQ = dispatcher.handleKeyDown({ code: 'KeyQ', key: 'q', ctrlKey: true }, heroMock);
    assertTrue(!!cmdQ);
    assertEqual(cmdQ.type, inputMod.CommandType.UPGRADE_ABILITY);
    assertEqual(cmdQ.slot, 'Q');

    // Ctrl + R
    const cmdR = dispatcher.handleKeyDown({ code: 'KeyR', key: 'r', ctrlKey: true }, heroMock);
    assertTrue(!!cmdR);
    assertEqual(cmdR.type, inputMod.CommandType.UPGRADE_ABILITY);
    assertEqual(cmdR.slot, 'R');

    // Simulation integration: dispatching UPGRADE_ABILITY upgrades hero ability
    const sim = new gameMod.GameSimulation({ heroClass: 'knight' });
    assertEqual(sim.playerHero.abilities.Q.rank, 0);
    assertEqual(sim.playerHero.skillPoints, 1);

    sim.handleCommand({
      type: inputMod.CommandType.UPGRADE_ABILITY,
      slot: 'Q'
    });

    assertEqual(sim.playerHero.abilities.Q.rank, 1);
    assertEqual(sim.playerHero.skillPoints, 0);
  });

  it('TC-LVL-08: Level-up VFX callback emits floating text and ring/spark particles', async () => {
    const { module: gameMod } = await resolveModule('game');

    const sim = new gameMod.GameSimulation({ heroClass: 'knight' });
    let textFound = false;
    let ringFound = false;

    // Gain enough XP to level up
    sim.playerHero.gainXp(240);
    assertEqual(sim.playerHero.level, 2);

    for (const txt of sim.particles.floatingTexts) {
      if (txt.text.includes('LEVEL UP') && txt.text.includes('2')) {
        textFound = true;
      }
    }

    for (const p of sim.particles.particles) {
      if (p.type === 'ring') {
        ringFound = true;
      }
    }

    assertTrue(textFound, 'Floating text must announce level up');
    assertTrue(ringFound, 'Level up particle ring must be emitted');
  });
});
