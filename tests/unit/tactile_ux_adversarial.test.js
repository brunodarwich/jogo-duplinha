import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Adversarial Stress — Tactile UX, Particle Spam, Cursor State Machine & Tooltip Edge Cases (M2)', () => {

  it('TC-ADV-UX-01: TooltipController with extreme, negative, malformed and missing values', async () => {
    const { module: tooltipMod } = await resolveModule('ui/tooltip');
    assertEqual(typeof tooltipMod.TooltipController, 'function', 'TooltipController must be exported');

    const tc = new tooltipMod.TooltipController();

    // 1. Extreme 0 AD and 0 AP hero
    const zeroHero = { id: 'knight_zero', heroId: 'knight', attackDamage: 0, ap: 0, armor: 0 };
    const qAbility = { id: 'Q', rank: 1, name: 'Golpe de Escudo' };
    const zeroScaling = tc.formatAbilityScaling(qAbility, zeroHero);
    assertEqual(zeroScaling.base, 80);
    assertEqual(zeroScaling.bonus, 0, '0 AD * ratio must be 0');
    assertEqual(zeroScaling.total, 80);
    assertFalse(Number.isNaN(zeroScaling.total), 'Total must not be NaN');

    // 2. Negative stats (debuffs / curses)
    const debuffedHero = { id: 'sorc_cursed', heroId: 'sorceress', ap: -100, attackDamage: -50 };
    const sorcQ = { id: 'Q', rank: 1, name: 'Bola de Fogo' };
    const negScaling = tc.formatAbilityScaling(sorcQ, debuffedHero);
    assertEqual(negScaling.base, 85);
    assertEqual(negScaling.bonus, -75, '-100 AP * 0.75 = -75');
    assertEqual(negScaling.total, 10, '85 + (-75) = 10');
    assertFalse(Number.isNaN(negScaling.total), 'Negative stats must compute without NaN');
    assertFalse(negScaling.scalingText.includes('+-'), 'Negative bonus should not format with "+-" (e.g. "+-75")');

    // 3. Gigantic / Extreme stats (overflow testing)
    const titanHero = { id: 'titan', heroId: 'ranger', attackDamage: 10000000 };
    const rangerQ = { id: 'Q', rank: 1, name: 'Disparo' };
    const titanScaling = tc.formatAbilityScaling(rangerQ, titanHero);
    assertEqual(titanScaling.base, 75);
    assertEqual(titanScaling.bonus, 10000000);
    assertEqual(titanScaling.total, 10000075);
    assertTrue(Number.isFinite(titanScaling.total), 'Giant stats must remain finite');

    // 4. Ability Rank Clamping: Rank 5 must clamp to max rank (235) rather than falling back to Rank 1 (85)
    const rank5Scaling = tc.formatAbilityScaling({ id: 'Q', rank: 5 }, { heroId: 'sorceress', ap: 0 });
    assertEqual(rank5Scaling.base, 235, 'Rank exceeding max must clamp to highest rank base damage (235), not revert to rank 1 (85)');

    // 5. Malformed, corrupted or missing ability and hero fields
    const emptyAbilityResult = tc.formatAbilityScaling({});
    assertEqual(emptyAbilityResult.base, 60, 'Empty ability falls back to default base');
    assertEqual(emptyAbilityResult.total, 60);

    const nullAbilityResult = tc.formatAbilityScaling(null, null);
    assertEqual(nullAbilityResult.total, 0, 'Null ability returns safe 0 total');

    const corruptedHero = { heroId: 12345, attackDamage: 'not_a_number' };
    const corruptedResult = tc.formatAbilityScaling({ id: 'Q' }, corruptedHero);
    assertEqual(corruptedResult.bonus, 0, 'Invalid string stat must be safely coerced to 0, not NaN');
    assertFalse(Number.isNaN(corruptedResult.total), 'Total must not be NaN when stat is invalid');

    // 6. Item stats: missing attributes, unknown keys, negative values, NaNs
    assertEqual(tc.formatItemStats(null).length, 0);
    assertEqual(tc.formatItemStats({}).length, 0);
    assertEqual(tc.formatItemStats({ stats: null }).length, 0);
    assertEqual(tc.formatItemStats({ stats: { attackDamage: 0, hp: 0 } }).length, 0, 'Zero stats omitted');

    const weirdItem = {
      name: 'Artefato Bizarro',
      stats: {
        attackDamage: 50,
        unknownExoticStat: 30,
        corruptedString: 'string',
        nanStat: NaN,
        movementSpeed: -15
      }
    };
    const chips = tc.formatItemStats(weirdItem);
    assertFalse(chips.some(c => c.value === 'NaN' || c.chipText?.includes('NaN')), 'NaN stats must be excluded from item stat chips');
    const adChip = chips.find(c => c.key === 'attackDamage');
    assertEqual(adChip.value, '+50');
    const exoticChip = chips.find(c => c.key === 'unknownExoticStat');
    assertTrue(exoticChip.value.includes('30'));
    const negChip = chips.find(c => c.key === 'movementSpeed');
    assertEqual(negChip.value, '-15', 'Negative item stat displays negative sign');

    // 7. DOM rendering with flexible argument permutations and boundary positions
    const elMock = {
      id: 'game-tooltip',
      className: 'game-tooltip hidden',
      innerHTML: '',
      style: {},
      offsetWidth: 280,
      offsetHeight: 140,
      classList: {
        classes: new Set(['game-tooltip', 'hidden']),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      setAttribute() {}
    };

    const prevDoc = globalThis.document;
    const prevWin = globalThis.window;
    try {
      globalThis.document = {
        getElementById(id) { return id === 'game-tooltip' ? elMock : null; },
        createElement() { return elMock; },
        body: { appendChild() {} }
      };
      globalThis.window = { innerWidth: 1280, innerHeight: 720 };
      tc.element = elMock;

      const targetEl = {
        getBoundingClientRect() { return { left: 600, top: 400, width: 40, height: 40, right: 640, bottom: 440 }; }
      };

      // Inverted argument orders
      tc.showAbilityTooltip(targetEl, { id: 'Q', name: 'Teste' }, { heroId: 'knight' });
      assertFalse(elMock.classList.contains('hidden'));
      assertTrue(elMock.innerHTML.includes('Teste'));

      tc.showItemTooltip(targetEl, { name: 'Espada Teste', cost: 1000 });
      assertFalse(elMock.classList.contains('hidden'));
      assertTrue(elMock.innerHTML.includes('Espada Teste'));

      // Viewport bounds: negative coordinates
      const negTarget = {
        getBoundingClientRect() { return { left: -500, top: -500, width: 40, height: 40, right: -460, bottom: -460 }; }
      };
      tc.updatePosition(negTarget);
      assertEqual(parseInt(elMock.style.left, 10), 12, 'Left must be clamped to minimum 12px');
      assertEqual(parseInt(elMock.style.top, 10), 12, 'Top must be clamped to minimum 12px');

      // Viewport bounds: overflowing far right and bottom
      const farTarget = {
        getBoundingClientRect() { return { left: 3000, top: 3000, width: 40, height: 40, right: 3040, bottom: 3040 }; }
      };
      tc.updatePosition(farTarget);
      assertEqual(parseInt(elMock.style.left, 10), 1280 - 280 - 12, 'Left must be clamped to right edge');
      assertEqual(parseInt(elMock.style.top, 10), 720 - 140 - 12, 'Top must be clamped to bottom edge');
    } finally {
      globalThis.document = prevDoc;
      globalThis.window = prevWin;
    }
  });

  it('TC-ADV-UX-02: emitMoveIndicator under continuous spam (100 to 1000 clicks) and memory leak safety', async () => {
    const { module: particleMod } = await resolveModule('render/particles');
    const ps = new particleMod.ParticleSystem();

    assertEqual(ps.particles.length, 0);
    assertEqual(ps.maxParticles, 500, 'Max particles should be capped at 500');

    // 1. Spam 100 continuous clicks in rapid succession (100 * 7 = 700 particles)
    for (let i = 0; i < 100; i++) {
      ps.emitMoveIndicator(100 + i, 200 + i, '#10b981', false);
    }
    assertEqual(ps.particles.length, 500, 'Particle pool must strictly cap at maxParticles (500)');

    // 2. Spam another 500 continuous clicks (total 600 clicks = 4,200 particle emissions)
    for (let i = 0; i < 500; i++) {
      ps.emitMoveIndicator(500, 500, '#ef4444', true);
    }
    assertEqual(ps.particles.length, 500, 'Particle pool must never exceed 500 even under 600 spam clicks');

    // 3. Test draw call during maximum capacity
    let ellipseDrawn = 0;
    let chevronDrawn = 0;
    const ctxMock = {
      save() {},
      restore() {},
      beginPath() {},
      ellipse() { ellipseDrawn++; },
      moveTo() {},
      lineTo() { chevronDrawn++; },
      stroke() {},
      arc() {},
      fill() {}
    };
    const camera = { x: 500, y: 500, viewportWidth: 1280, viewportHeight: 720 };
    ps.draw(ctxMock, camera, 1.0);
    assertTrue(ellipseDrawn > 0, 'Rings drawn under load');
    assertTrue(chevronDrawn > 0, 'Chevrons drawn under load');

    // 4. Verify clean lifecycle cleanup: run simulation updates until all 500 particles expire
    // Max life of indicators is 0.45s. Running 1.0s in 50ms steps should drain all particles.
    for (let t = 0; t < 20; t++) {
      ps.update(0.05);
    }
    assertEqual(ps.particles.length, 0, 'All particles must expire and be collected cleanly without memory leak');
  });

  it('TC-ADV-UX-03: Cursor state machine rapid transitions, null entities and dead heroes', async () => {
    const { module: inputMod } = await resolveModule('core/input');

    const canvasMock = {
      style: { cursor: 'default' }
    };
    const camera = { x: 1600, y: 1600, viewportWidth: 1280, viewportHeight: 720, zoom: 1.0 };
    const input = new inputMod.InputManager(canvasMock, camera);

    // 1. Completely null player hero and hovered entity
    input.playerHeroRef = null;
    input.hoveredEntity = null;
    input.updateCanvasCursor();
    assertEqual(input.currentCursorType, 'default', 'Must safely default when hero is null');

    // 2. Dead player hero: commands must be rejected
    const deadHero = {
      id: 'hero_dead',
      team: 'allied',
      hp: 0,
      isDead: true,
      isAlive: () => false,
      abilities: { Q: { id: 'Q', cooldownRemaining: 0, manaCost: 50 } }
    };
    input.playerHeroRef = deadHero;

    let dispatchedCmd = null;
    input.onCommand(cmd => { dispatchedCmd = cmd; });
    input.dispatchSmartRightClick(deadHero);
    assertEqual(dispatchedCmd, null, 'dispatchSmartRightClick must be rejected when dead');

    let errorFired = false;
    input.onSkillError = () => { errorFired = true; };
    input.triggerAbility('Q');
    assertFalse(errorFired, 'triggerAbility must silently ignore triggers when hero is dead');

    // 3. Entity hostility logic under diverse scenarios
    const liveHero = { id: 'hero_live', team: 'allied', hp: 800, isAlive: () => true };
    input.playerHeroRef = liveHero;

    assertFalse(input.isHostile(null, liveHero), 'Null target is not hostile');
    assertFalse(input.isHostile(liveHero, liveHero), 'Self hero is not hostile');

    const enemyTarget = { id: 'enemy_1', team: 'enemy' };
    assertTrue(input.isHostile(enemyTarget, liveHero), 'Enemy team target is hostile');

    const alliedTarget = { id: 'ally_1', team: 'allied' };
    assertFalse(input.isHostile(alliedTarget, liveHero), 'Allied team target is not hostile');

    // 4. Cursor Precedence Stress Test
    // Scenario A: targetingState takes precedence over hovered enemy
    input.targetingState = { slot: 'Q' };
    input.hoveredEntity = enemyTarget;
    input.updateCanvasCursor();
    assertEqual(input.currentCursorType, 'target', 'targetingState overrides enemy hover');

    // Scenario B: Enemy hover takes precedence over shop radius
    input.targetingState = null;
    input.worldX = 400; // Right at fountain shop (400, 400)
    input.worldY = 400;
    input.hoveredEntity = enemyTarget;
    input.updateCanvasCursor();
    assertEqual(input.currentCursorType, 'attack', 'Hostile hover overrides shop cursor');

    // Scenario C: Ally hover takes precedence over shop radius
    input.hoveredEntity = alliedTarget;
    input.updateCanvasCursor();
    assertEqual(input.currentCursorType, 'ally', 'Allied hover overrides shop cursor');

    // Scenario D: Self hero hover does NOT trigger 'ally' cursor, defaults to shop in fountain
    input.hoveredEntity = liveHero;
    input.updateCanvasCursor();
    assertEqual(input.currentCursorType, 'shop', 'Self hero hover falls through to shop when near fountain');

    // Scenario E: Rapid flapping between 5 states (200 iterations = 1000 transitions)
    for (let i = 0; i < 200; i++) {
      input.targetingState = { slot: 'R' };
      input.updateCanvasCursor();
      assertEqual(input.currentCursorType, 'target');

      input.targetingState = null;
      input.hoveredEntity = enemyTarget;
      input.updateCanvasCursor();
      assertEqual(input.currentCursorType, 'attack');

      input.hoveredEntity = alliedTarget;
      input.updateCanvasCursor();
      assertEqual(input.currentCursorType, 'ally');

      input.hoveredEntity = null;
      input.worldX = 400;
      input.worldY = 400;
      input.updateCanvasCursor();
      assertEqual(input.currentCursorType, 'shop');

      input.worldX = 2000;
      input.worldY = 2000;
      input.updateCanvasCursor();
      assertEqual(input.currentCursorType, 'default');
    }
  });

  it('TC-ADV-UX-04: onSkillError continuous flood under cooldown, mana deprivation and CC', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const { module: gameMod } = await resolveModule('game');

    const input = new inputMod.InputManager();
    const sim = new gameMod.GameSimulation({ isHost: true });

    const hero = {
      id: 'knight_flood',
      team: 'allied',
      hp: 1000,
      maxHp: 1000,
      mana: 10,
      maxMana: 300,
      isAlive: () => true,
      canCast: () => true,
      abilities: {
        Q: { id: 'Q', cooldownRemaining: 3.5, manaCost: 50 },
        W: { id: 'W', cooldownRemaining: 0, manaCost: 80 },
        E: { id: 'E', cooldownRemaining: 0, manaCost: 10 },
        R: { id: 'R', cooldownRemaining: 0, manaCost: 100 }
      }
    };
    input.playerHeroRef = hero;

    let errorCount = 0;
    const errorsCaptured = [];
    input.onSkillError = (slot, reason, details) => {
      errorCount++;
      errorsCaptured.push({ slot, reason, details });
    };

    // 1. Flood 250 presses on Q (on cooldown)
    for (let i = 0; i < 250; i++) {
      input.triggerAbility('Q');
    }
    assertEqual(errorCount, 250);
    assertTrue(errorsCaptured.every(e => e.slot === 'Q' && e.reason === 'cooldown'));

    // 2. Flood 250 presses on W (insufficient mana: 10 < 80)
    errorCount = 0;
    errorsCaptured.length = 0;
    for (let i = 0; i < 250; i++) {
      input.triggerAbility('W');
    }
    assertEqual(errorCount, 250);
    assertTrue(errorsCaptured.every(e => e.slot === 'W' && e.reason === 'mana' && e.details === 70));

    // 3. Flood 250 presses on E under Crowd Control lock
    hero.canCast = () => false;
    errorCount = 0;
    errorsCaptured.length = 0;
    for (let i = 0; i < 250; i++) {
      input.triggerAbility('E');
    }
    assertEqual(errorCount, 250);
    assertTrue(errorsCaptured.every(e => e.slot === 'E' && e.reason === 'cc'));

    // 4. GameSimulation floating text generation and lifecycle drainage
    sim.playerHero = hero;
    sim.particles.clear();
    assertEqual(sim.particles.floatingTexts.length, 0);

    for (let i = 0; i < 50; i++) {
      sim.handleSkillError('Q', 'cooldown', 3.5);
      sim.handleSkillError('W', 'mana', 70);
    }
    assertEqual(sim.particles.floatingTexts.length, 100);

    // Advance simulation time until floating texts expire
    for (let step = 0; step < 25; step++) {
      sim.particles.update(0.05); // 1.25 seconds total (maxLife is 1.0)
    }
    assertEqual(sim.particles.floatingTexts.length, 0, 'All floating texts must expire and clean up cleanly');
  });

});
