import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Defensive Tower Aggro Rules & Heat Scaling', () => {
  it('TC-TOW-01: Validates 400-unit attack radius boundary', async () => {
    const { module: towerMod } = await resolveModule('world/tower');
    const tower = new towerMod.DefensiveTower('tower_blue_1', 'allied', 400, 400);

    const insideUnit = { x: 600, y: 400 };  // dist = 200
    const edgeUnit = { x: 800, y: 400 };    // dist = 400
    const outsideUnit = { x: 801, y: 400 }; // dist = 401

    assertTrue(tower.isWithinRange(insideUnit));
    assertTrue(tower.isWithinRange(edgeUnit));
    assertFalse(tower.isWithinRange(outsideUnit));
  });

  it('TC-TOW-02: Call for Help switches tower aggro to enemy hero attacking ally', async () => {
    const { module: towerMod } = await resolveModule('world/tower');
    const tower = new towerMod.DefensiveTower('tower_blue_1', 'allied', 400, 400);

    const minion = { id: 'm1', type: 'minion', x: 450, y: 450, hp: 300 };
    const aggressorHero = { id: 'enemy_hero_1', type: 'hero', x: 500, y: 400, hp: 1000 };

    // Tower targets minion first
    let target = tower.selectTarget([minion, aggressorHero]);
    assertEqual(target.id, 'm1');

    // Aggressor hero attacks allied hero => Call for Help
    target = tower.selectTarget([minion, aggressorHero], 'enemy_hero_1');
    assertEqual(target.id, 'enemy_hero_1', 'Tower must immediately prioritize hero attacking ally');
  });

  it('TC-TOW-03: Prefers closest minion over closest hero when no aggro call occurs', async () => {
    const { module: towerMod } = await resolveModule('world/tower');
    const tower = new towerMod.DefensiveTower('tower_blue_1', 'allied', 400, 400);

    const hero = { id: 'hero_1', type: 'hero', x: 450, y: 400, hp: 1000 };
    const minion = { id: 'minion_1', type: 'minion', x: 550, y: 400, hp: 400 };

    const target = tower.selectTarget([hero, minion]);
    assertEqual(target.id, 'minion_1', 'Minion must be targeted over hero under peacetime rules');
  });

  it('TC-TOW-04: Consecutive hit heat scaling adds +25% damage per shot up to +100%', async () => {
    const { module: towerMod } = await resolveModule('world/tower');
    const tower = new towerMod.DefensiveTower('tower_blue_1', 'allied', 400, 400);
    const hero = { id: 'enemy_hero_1', type: 'hero', hp: 2000 };

    // Shot 0: Base damage (150)
    assertEqual(tower.calculateShotDamage(hero), 150);

    // Shot 1
    tower.recordShot(hero);
    assertEqual(tower.calculateShotDamage(hero), 150 * 1.25);

    // Shot 2
    tower.recordShot(hero);
    assertEqual(tower.calculateShotDamage(hero), 150 * 1.50);

    // Shot 3
    tower.recordShot(hero);
    assertEqual(tower.calculateShotDamage(hero), 150 * 1.75);

    // Shot 4: Max cap (+100% = 2.0x = 300)
    tower.recordShot(hero);
    assertEqual(tower.calculateShotDamage(hero), 300);

    // Shot 5: Still capped at 300
    tower.recordShot(hero);
    assertEqual(tower.calculateShotDamage(hero), 300);
  });

  it('TC-TOW-05: Heat resets to baseline immediately when target switches', async () => {
    const { module: towerMod } = await resolveModule('world/tower');
    const tower = new towerMod.DefensiveTower('tower_blue_1', 'allied', 400, 400);
    const heroA = { id: 'hero_A', type: 'hero', hp: 2000 };
    const heroB = { id: 'hero_B', type: 'hero', hp: 2000 };

    tower.recordShot(heroA);
    tower.recordShot(heroA);
    assertEqual(tower.calculateShotDamage(heroA), 150 * 1.50);

    // Switch to heroB
    tower.recordShot(heroB);
    assertEqual(tower.calculateShotDamage(heroB), 150 * 1.25, 'Heat reset to 1st shot on new target');
  });

  it('TC-TOW-06: Structure invulnerability hierarchy protects inner towers', async () => {
    const { module: towerMod } = await resolveModule('world/tower');
    const outerTower = new towerMod.DefensiveTower('outer', 'allied', 800, 800, 'outer', null);
    const innerTower = new towerMod.DefensiveTower('inner', 'allied', 400, 400, 'inner', outerTower);

    assertTrue(innerTower.isInvulnerable(), 'Inner tower is invulnerable while outer is alive');
    const res = innerTower.takeDamage(500);
    assertEqual(res.damageTaken, 0);
    assertTrue(res.invulnerable);
    assertEqual(innerTower.hp, 2500);

    // Destroy outer tower
    outerTower.takeDamage(3000);
    assertEqual(outerTower.hp, 0);

    assertFalse(innerTower.isInvulnerable(), 'Inner tower becomes vulnerable once outer falls');
    const res2 = innerTower.takeDamage(500);
    assertEqual(res2.damageTaken, 500);
    assertEqual(innerTower.hp, 2000);
  });
});
