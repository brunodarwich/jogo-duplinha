import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertCloseTo, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Hero Death & Resurrection System (R1)', () => {
  it('TC-HERO-08: Level scaling formula calculates 4s + 1s * level', async () => {
    const { module: heroesMod } = await resolveModule('entities/heroes');
    assertEqual(typeof heroesMod.calculateRespawnTime, 'function', 'calculateRespawnTime must be exported');
    assertEqual(heroesMod.calculateRespawnTime(1), 5.0, 'Level 1 respawn duration must be exactly 5.0s');
    assertEqual(heroesMod.calculateRespawnTime(2), 6.0, 'Level 2 respawn duration must be exactly 6.0s');
    assertEqual(heroesMod.calculateRespawnTime(6), 10.0, 'Level 6 respawn duration must be exactly 10.0s');
    assertEqual(heroesMod.calculateRespawnTime(12), 16.0, 'Level 12 respawn duration must be exactly 16.0s');
    assertEqual(heroesMod.calculateRespawnTime(0), 5.0, 'Level <= 0 clamps to minimum level 1 (5.0s)');
    assertEqual(heroesMod.calculateRespawnTime(null), 5.0, 'Default/null level evaluates to level 1 (5.0s)');
  });

  it('TC-HERO-09: Lethal damage transitions hero into death state with initialized respawn timer', async () => {
    const { module: entityMod } = await resolveModule('entities/entity');
    const hero = new entityMod.HeroEntity({
      heroId: 'knight',
      hp: 680,
      maxHp: 680,
      mana: 300,
      maxMana: 300,
      level: 3
    });
    hero.level = 3;

    assertEqual(hero.isDead, false);
    assertTrue(hero.isAlive());
    assertEqual(hero.respawnTimer, 0);

    // Inflict lethal damage
    const damageDealt = hero.takeDamage(1000, 'true');
    assertEqual(damageDealt, 1000);
    assertEqual(hero.hp, 0, 'HP must be clamped to 0 upon death');
    assertTrue(hero.isDead, 'Hero must be flagged as dead');
    assertFalse(hero.isAlive(), 'isAlive() must return false');
    assertEqual(hero.respawnDuration, 7.0, 'Duration at level 3 must be 4 + 3 = 7.0s');
    assertEqual(hero.respawnTimer, 7.0, 'Initial respawn timer must match respawn duration (7.0s)');
  });

  it('TC-HERO-10: Actions and commands are rejected while dead (moveTo, setAttackTarget, canMove, canAttack, canCast)', async () => {
    const { module: entityMod } = await resolveModule('entities/entity');
    const hero = new entityMod.HeroEntity({
      heroId: 'ranger',
      hp: 520,
      maxHp: 520,
      x: 1000,
      y: 1000
    });

    hero.die();
    assertTrue(hero.isDead);

    // Attempt movement
    hero.moveTo(1500, 1500);
    assertEqual(hero.targetX, null, 'Movement targetX must not be set while dead');
    assertEqual(hero.targetY, null, 'Movement targetY must not be set while dead');
    assertFalse(hero.isMoving, 'Hero must not enter isMoving state while dead');

    // Attempt attack targeting
    const dummyTarget = { id: 'dummy_target', x: 1050, y: 1000, hp: 100 };
    hero.setAttackTarget(dummyTarget);
    assertEqual(hero.attackTarget, null, 'Attack target must remain null while dead');

    // Action readiness predicates
    assertFalse(hero.canMove(), 'canMove() must return false while dead');
    assertFalse(hero.canAttack(), 'canAttack() must return false while dead');
    assertFalse(hero.canCast(), 'canCast() must return false while dead');
  });

  it('TC-HERO-11: Dead hero entities are retained in simulation array during cleanup', async () => {
    const { module: entityMod } = await resolveModule('entities/entity');
    const { module: minionMod } = await resolveModule('world/minion');

    const hero = new entityMod.HeroEntity({ id: 'player_hero', hp: 680, maxHp: 680, team: 'allied' });
    const minion = new minionMod.MinionUnit({ id: 'enemy_minion', hp: 200, maxHp: 200, team: 'enemy' });
    const tower = { id: 'allied_tower', type: 'tower', team: 'allied', hp: 1000, maxHp: 1000 };

    let entities = [hero, minion, tower];

    // Kill minion and hero
    minion.hp = 0;
    minion.isDeadState = true;
    hero.takeDamage(1000);
    assertTrue(hero.isDead);
    assertTrue(minion.hp <= 0);

    // Apply simulation cleanup filter (matching src/game.js logic)
    entities = entities.filter(ent => {
      if (ent.type === 'tower' || ent.type === 'nexus' || ent.type === 'hero') return true;
      const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
      return !isDead && (typeof ent.hp !== 'number' || ent.hp > 0);
    });

    assertTrue(entities.some(e => e.id === 'player_hero'), 'Dead hero must be retained in entities array');
    assertTrue(entities.some(e => e.id === 'allied_tower'), 'Tower must be retained in entities array');
    assertFalse(entities.some(e => e.id === 'enemy_minion'), 'Dead minion must be removed from entities array');
    assertEqual(entities.length, 2);
  });

  it('TC-HERO-12: Respawn countdown decrements each tick and resurrects hero at Allied Fountain (400, 400) with cleansed status', async () => {
    const { module: entityMod } = await resolveModule('entities/entity');
    const hero = new entityMod.HeroEntity({
      heroId: 'knight',
      hp: 680,
      maxHp: 680,
      mana: 300,
      maxMana: 300,
      x: 1800,
      y: 1800,
      level: 1
    });

    // Inflict lethal damage
    hero.takeDamage(1000);
    assertTrue(hero.isDead);
    assertEqual(hero.respawnTimer, 5.0);

    // Inflict status debuffs / CC while dead to test status cleansing
    hero.stunnedUntil = Date.now() + 60000;
    hero.silencedUntil = Date.now() + 60000;
    hero.slowPercentage = 0.5;
    hero.mana = 0;

    // Simulate 2.5 seconds elapse
    hero.update(2.5);
    assertEqual(hero.isDead, true);
    assertCloseTo(hero.respawnTimer, 2.5, 0.01, 'Respawn timer should decrement to 2.5s');
    assertEqual(hero.x, 1800, 'Hero coordinates should not change while dead');

    // Simulate remaining 2.5 seconds elapse (triggers respawn)
    hero.update(2.5);
    assertEqual(hero.isDead, false, 'Hero isDead must be false after timer completes');
    assertTrue(hero.isAlive(), 'Hero isAlive() must return true after respawn');
    assertEqual(hero.respawnTimer, 0, 'Respawn timer must be reset to 0');
    assertEqual(hero.x, 400, 'Hero must respawn at Allied Fountain X (400)');
    assertEqual(hero.y, 400, 'Hero must respawn at Allied Fountain Y (400)');
    assertEqual(hero.hp, hero.maxHp, 'HP must be fully restored to maxHp (680)');
    assertEqual(hero.mana, hero.maxMana, 'Mana must be fully restored to maxMana (300)');
    assertEqual(hero.stunnedUntil, 0, 'Stun must be cleansed on respawn');
    assertEqual(hero.silencedUntil, 0, 'Silence must be cleansed on respawn');
    assertEqual(hero.slowPercentage, 0, 'Slow must be cleansed on respawn');
    assertTrue(hero.canMove(), 'Hero must be able to move immediately upon respawn');
    assertTrue(hero.canAttack(), 'Hero must be able to attack immediately upon respawn');
    assertTrue(hero.canCast(), 'Hero must be able to cast immediately upon respawn');
  });

  it('TC-HERO-13: Ability cooldowns continue ticking while dead', async () => {
    const { module: entityMod } = await resolveModule('entities/entity');
    const hero = new entityMod.HeroEntity({
      heroId: 'knight',
      hp: 680,
      maxHp: 680,
      level: 1
    });

    hero.abilities.Q.cooldownRemaining = 6.0;
    hero.abilities.R.cooldownRemaining = 40.0;

    hero.die();
    assertTrue(hero.isDead);

    // Tick 2 seconds
    hero.update(2.0);
    assertCloseTo(hero.abilities.Q.cooldownRemaining, 4.0, 0.01, 'Q cooldown must decrement while dead');
    assertCloseTo(hero.abilities.R.cooldownRemaining, 38.0, 0.01, 'R cooldown must decrement while dead');
  });

  it('TC-HUD-01: HUDController update reveals death overlay and formats countdown', async () => {
    const { module: hudMod } = await resolveModule('ui/hud');
    const hud = new hudMod.HUDController();

    // Temporarily mock minimal document elements for headless test
    const prevDoc = globalThis.document;
    try {
      globalThis.document = {}; // satisfy typeof document !== 'undefined'
      const overlayMock = {
        classList: {
          classes: new Set(['hidden']),
          remove(c) { this.classes.delete(c); },
          add(c) { this.classes.add(c); },
          contains(c) { return this.classes.has(c); }
        }
      };
      const countdownMock = { textContent: '' };
      const portraitMock = {
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          contains(c) { return this.classes.has(c); }
        }
      };

      hud.elements = {
        deathOverlay: overlayMock,
        deathCountdown: countdownMock,
        heroPortrait: portraitMock
      };

      const deadHero = {
        heroId: 'knight',
        isDead: true,
        respawnTimer: 4.2
      };

      hud.update(deadHero, null);
      assertFalse(overlayMock.classList.contains('hidden'), 'Overlay must unhide when hero is dead');
      assertEqual(countdownMock.textContent, '5s', 'Math.ceil(4.2) -> 5s');
      assertTrue(portraitMock.classList.contains('is-dead'), 'Portrait must have is-dead class');

      const aliveHero = {
        heroId: 'knight',
        isDead: false,
        respawnTimer: 0
      };

      hud.update(aliveHero, null);
      assertTrue(overlayMock.classList.contains('hidden'), 'Overlay must hide when hero is alive');
      assertFalse(portraitMock.classList.contains('is-dead'), 'Portrait must remove is-dead class');
    } finally {
      globalThis.document = prevDoc;
    }
  });

  it('TC-INPUT-DEAD-01: InputManager suppresses movement, attacks and skills when hero is dead', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const { module: entityMod } = await resolveModule('entities/entity');

    const hero = new entityMod.HeroEntity({
      heroId: 'knight',
      hp: 680,
      maxHp: 680
    });
    hero.die();
    assertTrue(hero.isDead);

    const commands = [];
    const input = new inputMod.InputManager(null, null, null, null, null, (cmd) => commands.push(cmd));
    input.playerHeroRef = hero;

    // Attempt smart right click
    input.dispatchSmartRightClick(hero);
    assertEqual(commands.length, 0, 'No MOVE_TO or ATTACK_TARGET command dispatched for dead hero');

    // Attempt 'A' key (Attack-Move)
    input.handleKeyDown({ code: 'KeyA', key: 'a' });
    assertEqual(commands.length, 0, 'No ATTACK_TARGET command dispatched on KeyA for dead hero');

    // Attempt ability trigger
    input.triggerAbility('Q');
    assertEqual(commands.length, 0, 'No ability cast dispatched for dead hero');
  });

  it('TC-SIM-DEAD-01: GameSimulation drops commands and emits death and resurrection VFX', async () => {
    const { module: gameMod } = await resolveModule('game');
    const { module: entityMod } = await resolveModule('entities/entity');

    const hero = new entityMod.HeroEntity({
      heroId: 'knight',
      hp: 680,
      maxHp: 680,
      level: 1,
      x: 1000,
      y: 1000
    });

    const floatingTexts = [];
    const emittedParticles = [];
    const particlesMock = {
      emit(type, opts) { emittedParticles.push({ type, ...opts }); },
      addFloatingText(text, x, y, opts) { floatingTexts.push({ text, x, y, ...opts }); },
      update(dt) {}
    };

    const sim = new gameMod.GameSimulation();
    sim.playerHero = hero;
    sim.entities = [hero];
    sim.particles = particlesMock;
    hero._lastKnownAlive = true;

    // Simulate hero death
    hero.takeDamage(1000);
    assertTrue(hero.isDead);

    // Verify handleCommand drops move command
    sim.handleCommand({ type: 'MOVE_TO', x: 2000, y: 2000 });
    assertEqual(hero.targetX, null, 'Move command dropped while dead');

    // Update sim tick -> should emit death particles & floating text
    sim.update(0.1);
    assertTrue(floatingTexts.some(ft => ft.text === '💀 MORREU!'), 'Death floating text emitted');

    // Fast-forward respawn timer (remaining 4.9s)
    sim.update(4.9);
    assertTrue(hero.isAlive(), 'Hero resurrected');
    assertEqual(hero.x, 400, 'Hero at Allied Fountain');
    assertTrue(floatingTexts.some(ft => ft.text === '✨ RESSURGIU!'), 'Respawn floating text emitted');
  });
});
