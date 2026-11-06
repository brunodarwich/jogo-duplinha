import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertGreater, assertCloseTo } from '../helpers/assert.js';
import { GameSimulation } from '../../src/game.js';
import { MinionUnit } from '../../src/world/minion.js';

function encounter(heroClass = 'sorceress') {
  const sim = new GameSimulation({ heroClass });
  const hero = sim.playerHero;
  const target = new MinionUnit({ id: 'skill-target', team: 'enemy', x: hero.x + 50, y: hero.y, hp: 10000, maxHp: 10000 });
  target.armor = target.magicResist = 0;
  sim.entities = [hero, target];
  hero.level = 15;
  return { sim, hero, target };
}
function cast(sim, slot, rank = 1) {
  const hero = sim.playerHero;
  hero.abilities[slot].rank = rank;
  hero.abilities[slot].cooldownRemaining = 0;
  hero.mana = hero.maxMana;
  return sim.handleCommand({ type: 'CAST_SKILL', slot, targetX: hero.x + 50, targetY: hero.y });
}

describe('Ability rules in the running simulation', () => {
  it('rejects an unlearned ultimate without mana, cooldown, damage or animation', () => {
    const { sim, hero, target } = encounter();
    hero.level = 1;
    const mana = hero.mana;
    sim.handleCommand({ type: 'CAST_SKILL', slot: 'R', targetX: target.x, targetY: target.y });
    assertEqual(hero.mana, mana);
    assertEqual(hero.abilities.R.cooldownRemaining, 0);
    assertEqual(target.hp, 10000);
    assertTrue(!hero.visualAction);
  });

  it('validates direct execution as well as commands, including non-local casters', () => {
    const { sim, hero, target } = encounter();
    hero.isLocalPlayer = false;
    hero.abilities.Q.rank = 1;
    hero.silencedUntil = Date.now() + 10000;
    const mana = hero.mana;
    sim.executeHeroSkill('Q', hero.abilities.Q, { targetX: target.x, targetY: target.y }, hero);
    assertEqual(hero.mana, mana);
    assertEqual(target.hp, 10000);
    hero.silencedUntil = 0;
    hero.abilities.Q.cooldownRemaining = 5;
    sim.executeHeroSkill('Q', hero.abilities.Q, { targetX: target.x, targetY: target.y }, hero);
    assertEqual(target.hp, 10000);
  });

  it('makes damaging ranks stronger for each of the five heroes', () => {
    for (const heroClass of ['knight', 'sorceress', 'ranger', 'assassin', 'cleric']) {
      const { sim, hero, target } = encounter(heroClass);
      cast(sim, 'Q', 1);
      const firstDamage = 10000 - target.hp;
      target.hp = 10000;
      hero.x = 650; hero.y = 650;
      cast(sim, 'Q', 4);
      assertGreater(10000 - target.hp, firstDamage, heroClass + ' Q must scale with rank');
    }
  });

  it('makes support healing and protection stronger with rank', () => {
    const { sim, hero } = encounter('cleric');
    hero.hp = 1; cast(sim, 'W', 1); const lowHeal = hero.hp - 1;
    hero.hp = 1; cast(sim, 'W', 4);
    assertGreater(hero.hp - 1, lowHeal);
    cast(sim, 'R', 1); const firstBarrier = hero.barrier;
    hero.barrier = 0; cast(sim, 'R', 3);
    assertGreater(hero.barrier, firstBarrier);
  });

  it('clamps ground targets to skill range and rejects non-finite coordinates', () => {
    const { sim, hero, target } = encounter();
    hero.abilities.Q.rank = 1;
    target.x = hero.x + 5000;
    sim.handleCommand({ type: 'CAST_SKILL', slot: 'Q', targetX: target.x, targetY: target.y });
    assertEqual(target.hp, 10000);
    hero.abilities.Q.cooldownRemaining = 0;
    const mana = hero.mana;
    sim.handleCommand({ type: 'CAST_SKILL', slot: 'Q', targetX: NaN, targetY: 0 });
    assertEqual(hero.mana, mana);
  });

  it('credits a remote skill kill once to its caster and respects resistance', () => {
    const { sim, hero, target } = encounter();
    const remote = sim.spawnRemoteHero({ id: 'remote-caster', heroId: 'sorceress' });
    remote.level = 15; remote.abilities.Q.rank = 1;
    target.hp = 1;
    const localGold = hero.gold, remoteGold = remote.gold;
    sim.executeHeroSkill('Q', remote.abilities.Q, { targetX: target.x, targetY: target.y }, remote);
    assertEqual(hero.gold - localGold, 12); // Nearby ally receives the existing 30% assist share, not the last hit.
    assertEqual(remote.gold - remoteGold, 42);
    sim.damageEnemiesInRadius(target.x, target.y, 90, 100, 'magical', null, remote);
    assertEqual(remote.gold - remoteGold, 42);
  });

  it('scales mobility and expires speed/shroud by simulation time without changing base speed', () => {
    const { sim, hero } = encounter('sorceress');
    hero.abilities.E.rank = 1;
    sim.handleCommand({ type: 'CAST_SKILL', slot: 'E', targetX: 1650, targetY: 1650 });
    const first = Math.hypot(hero.x - 650, hero.y - 650), cooldown = hero.abilities.E.cooldownRemaining;
    hero.x = hero.y = 650; hero.mana = hero.maxMana;
    hero.abilities.E.rank = 4; hero.abilities.E.cooldownRemaining = 0;
    sim.handleCommand({ type: 'CAST_SKILL', slot: 'E', targetX: 1650, targetY: 1650 });
    assertGreater(Math.hypot(hero.x - 650, hero.y - 650), first);
    assertTrue(hero.abilities.E.cooldownRemaining < cooldown);
    for (const heroClass of ['ranger', 'assassin']) {
      const { sim, hero } = encounter(heroClass);
      const base = hero.speed;
      cast(sim, 'E', 4);
      assertGreater(hero.getMovementSpeed(), base);
      assertEqual(hero.speed, base);
      sim.update(4);
      assertEqual(hero.skillSpeedBonus, 0);
      assertEqual(hero.speed, base);
      assertTrue(!hero.isUntargetableFlag);
    }
  });

  it('rejects shadow step outside caster range before consuming resources', () => {
    const { sim, hero, target } = encounter('assassin');
    hero.abilities.Q.rank = 1;
    target.x = hero.x + 790;
    const mana = hero.mana;
    sim.handleCommand({ type: 'CAST_SKILL', slot: 'Q', targetId: target.id, targetX: target.x, targetY: target.y });
    assertEqual(hero.x, 650);
    assertEqual(hero.mana, mana);
    assertEqual(hero.abilities.Q.cooldownRemaining, 0);
  });
});
