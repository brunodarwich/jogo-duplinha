import { describe, it } from '../helpers/framework.js';
import { assertEqual, assertTrue, assertFalse, assertCloseTo } from '../helpers/assert.js';
import { resolveModule } from '../helpers/module_resolver.js';

describe('Tier 1 Unit: Tactile UX, Movement Wave & Reticle, Adaptive Cursors & Rich Tooltips (M2 / R2)', () => {

  it('TC-UX-01: emitMoveIndicator generates concentric 2:1 isometric waves and converging reticle markers', async () => {
    const { module: particleMod } = await resolveModule('render/particles');
    assertEqual(typeof particleMod.ParticleSystem, 'function', 'ParticleSystem must be exported');

    const ps = new particleMod.ParticleSystem();
    assertEqual(ps.particles.length, 0);

    // 1. Emit move indicator (green ground move)
    ps.emitMoveIndicator(500, 600, '#10b981', false);

    // Should create 3 concentric waves (type 'ring') + 4 reticle chevrons (type 'reticle_marker') = 7 particles
    assertEqual(ps.particles.length, 7, 'Must generate exactly 3 waves + 4 reticle markers');

    const rings = ps.particles.filter(p => p.type === 'ring');
    assertEqual(rings.length, 3, 'Must contain 3 concentric rings');
    assertEqual(rings[0].color, '#10b981');
    assertEqual(rings[0].delay, 0.00, 'Wave 1 should have 0s delay');
    assertTrue(rings[1].delay > 0, 'Wave 2 should have staggered delay');
    assertTrue(rings[2].delay > rings[1].delay, 'Wave 3 should have greater delay');
    assertTrue(rings[0].maxRadius > rings[1].maxRadius, 'Wave 1 should expand further than wave 2');

    const markers = ps.particles.filter(p => p.type === 'reticle_marker');
    assertEqual(markers.length, 4, 'Must contain 4 reticle markers');
    assertEqual(markers[0].color, '#10b981');
    assertEqual(markers[0].dist, 24, 'Initial marker distance should be 24');
    assertTrue(markers[0].convergeSpeed > 0, 'Marker must have positive converge speed');

    // 2. Test particle update lifecycle and converging motion
    ps.update(0.1); // Advance 100ms
    assertTrue(markers[0].dist < 24, 'Markers must converge inward towards target center');

    // 3. Emit attack indicator (isAttack = true -> red color)
    ps.clear();
    ps.emitMoveIndicator(800, 900, '#10b981', true);
    assertEqual(ps.particles.length, 7);
    assertTrue(ps.particles.every(p => p.color === '#ef4444'), 'All attack indicator particles must default to #ef4444');

    // 4. Test draw call with mocked canvas context
    let ellipseCalled = false;
    let lineToCalled = false;
    const ctxMock = {
      save() {},
      restore() {},
      beginPath() {},
      ellipse() { ellipseCalled = true; },
      moveTo() {},
      lineTo() { lineToCalled = true; },
      stroke() {},
      arc() {},
      fill() {}
    };

    const cameraMock = { x: 500, y: 600, viewportWidth: 1280, viewportHeight: 720 };
    ps.draw(ctxMock, cameraMock, 1.0);
    assertTrue(ellipseCalled, 'Ring waves must be drawn via ctx.ellipse');
    assertTrue(lineToCalled, 'Reticle chevrons must be drawn via ctx.lineTo');
  });

  it('TC-UX-02: InputManager adaptive cursor state transitions', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    assertEqual(typeof inputMod.InputManager, 'function', 'InputManager must be exported');
    assertEqual(typeof inputMod.CURSOR_SVGS, 'object', 'CURSOR_SVGS must be exported');

    const canvasMock = {
      style: { cursor: 'default' },
      getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
    };
    const camera = { x: 1600, y: 1600, viewportWidth: 1280, viewportHeight: 720, zoom: 1.0 };
    const input = new inputMod.InputManager(canvasMock, camera);
    const hero = { id: 'hero_1', team: 'allied', x: 1600, y: 1600, isAlive: () => true };
    input.playerHeroRef = hero;

    // 1. Neutral / default terrain (far from shop, no target)
    input.worldX = 1600;
    input.worldY = 1600;
    input.hoveredEntity = null;
    input.targetingState = null;
    input.updateCanvasCursor();
    assertEqual(input.currentCursorType, 'default');
    assertTrue(canvasMock.style.cursor.includes('default'));

    // 2. Targeting State active (skill aiming crosshair)
    input.targetingState = { slot: 'Q', ability: { name: 'Fireball' } };
    input.updateCanvasCursor();
    assertEqual(input.currentCursorType, 'target');
    assertTrue(canvasMock.style.cursor.includes('crosshair'));
    input.targetingState = null;

    // 3. Hovering hostile entity (attack sword / crimson reticle)
    input.hoveredEntity = { id: 'minion_enemy', team: 'enemy', x: 1650, y: 1650, hp: 100 };
    input.updateCanvasCursor();
    assertEqual(input.currentCursorType, 'attack');
    assertTrue(canvasMock.style.cursor.includes('%23ef4444') || canvasMock.style.cursor.includes('crosshair'));

    // 4. Hovering allied entity (radiant blue cursor)
    input.hoveredEntity = { id: 'minion_ally', team: 'allied', x: 1550, y: 1550, hp: 100 };
    input.updateCanvasCursor();
    assertEqual(input.currentCursorType, 'ally');
    assertTrue(canvasMock.style.cursor.includes('%2338bdf8') || canvasMock.style.cursor.includes('pointer'));

    // 5. Over Allied Shop / Fountain (x: 400, y: 400)
    input.hoveredEntity = null;
    input.worldX = 420;
    input.worldY = 410;
    input.updateCanvasCursor();
    assertEqual(input.currentCursorType, 'shop');
    assertTrue(canvasMock.style.cursor.includes('%23fbbf24') || canvasMock.style.cursor.includes('pointer'));
  });

  it('TC-UX-03: triggerAbility dispatches onSkillError callback for cooldown, mana and CC', async () => {
    const { module: inputMod } = await resolveModule('core/input');
    const input = new inputMod.InputManager();

    const hero = {
      id: 'knight_1',
      team: 'allied',
      hp: 800,
      maxHp: 800,
      mana: 30,
      maxMana: 300,
      isAlive: () => true,
      canCast: () => true,
      abilities: {
        Q: { id: 'Q', name: 'Shield Slam', cooldownRemaining: 4.5, manaCost: 50 },
        W: { id: 'W', name: 'Taunt', cooldownRemaining: 0, manaCost: 60 },
        E: { id: 'E', name: 'Spin', cooldownRemaining: 0, manaCost: 20 },
        R: { id: 'R', name: 'Fortress', cooldownRemaining: 0, manaCost: 100 }
      }
    };
    input.playerHeroRef = hero;

    let errorCaptured = null;
    input.onSkillError = (slot, reason, details) => {
      errorCaptured = { slot, reason, details };
    };

    // 1. Cooldown error
    input.triggerAbility('Q');
    assertEqual(errorCaptured.slot, 'Q');
    assertEqual(errorCaptured.reason, 'cooldown');
    assertEqual(errorCaptured.details, 4.5);

    // 2. Insufficient mana error (mana: 30 < manaCost: 60)
    errorCaptured = null;
    input.triggerAbility('W');
    assertEqual(errorCaptured.slot, 'W');
    assertEqual(errorCaptured.reason, 'mana');
    assertEqual(errorCaptured.details, 30); // 60 - 30 = 30 missing mana

    // 3. Crowd control lock (hero.canCast() returns false)
    hero.mana = 200;
    hero.canCast = () => false;
    errorCaptured = null;
    input.triggerAbility('E');
    assertEqual(errorCaptured.slot, 'E');
    assertEqual(errorCaptured.reason, 'cc');

    // 4. Silenced when dead
    hero.isAlive = () => false;
    errorCaptured = null;
    input.triggerAbility('E');
    assertEqual(errorCaptured, null, 'No skill error callback should trigger when dead');
  });

  it('TC-UX-04: GameSimulation skill error triggers HUD vibration and floating combat text', async () => {
    const { module: gameMod } = await resolveModule('game');
    const sim = new gameMod.GameSimulation({ isHost: true });

    let flashedSlot = null;
    let flashedReason = null;
    sim.hud.flashAbilityError = (slot, reason) => {
      flashedSlot = slot;
      flashedReason = reason;
    };

    // Test mana error
    sim.handleSkillError('Q', 'mana', 25);
    assertEqual(flashedSlot, 'Q');
    assertEqual(flashedReason, 'mana');

    const lastFt = sim.particles.floatingTexts[sim.particles.floatingTexts.length - 1];
    assertEqual(lastFt.text, 'Sem Mana!');
    assertEqual(lastFt.color, '#38bdf8');

    // Test cooldown error
    sim.handleSkillError('W', 'cooldown', 2.0);
    assertEqual(flashedSlot, 'W');
    assertEqual(flashedReason, 'cooldown');
    const cdFt = sim.particles.floatingTexts[sim.particles.floatingTexts.length - 1];
    assertEqual(cdFt.text, 'Em Recarga!');
    assertEqual(cdFt.color, '#f59e0b');

    // Test CC error
    sim.handleSkillError('E', 'cc');
    assertEqual(flashedSlot, 'E');
    assertEqual(flashedReason, 'cc');
    const ccFt = sim.particles.floatingTexts[sim.particles.floatingTexts.length - 1];
    assertEqual(ccFt.text, 'Impossibilitado!');
    assertEqual(ccFt.color, '#c084fc');
  });

  it('TC-UX-05: HUDController flashAbilityError applies and clears .cast-error-shake class', async () => {
    const { module: gameMod } = await resolveModule('game');
    const sim = new gameMod.GameSimulation({ isHost: true });
    const hud = sim.hud;

    const slotMock = {
      classList: {
        classes: new Set(),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      offsetWidth: 44
    };

    hud.elements = {
      abilityQ: slotMock
    };

    hud.flashAbilityError('Q', 'mana');
    assertTrue(slotMock.classList.contains('cast-error-shake'), 'Slot must receive .cast-error-shake class');

    // Wait 380ms for timeout removal
    await new Promise(resolve => setTimeout(resolve, 380));
    assertFalse(slotMock.classList.contains('cast-error-shake'), '.cast-error-shake class must be removed after 350ms');
  });

  it('TC-UX-06: TooltipController real-time AD and AP scaling for all 5 hero archetypes', async () => {
    const { module: tooltipMod } = await resolveModule('ui/tooltip');
    assertEqual(typeof tooltipMod.TooltipController, 'function', 'TooltipController must be exported');

    const tc = new tooltipMod.TooltipController();

    // 1. Sorceress Q (Bola de Fogo): Base 85 + 75% AP
    const sorc = { id: 'sorceress', heroId: 'sorceress', ap: 100, attackDamage: 50 };
    const sorcQ = { id: 'Q', rank: 1, name: 'Bola de Fogo' };
    const scalingSorcQ = tc.formatAbilityScaling(sorcQ, sorc);
    assertEqual(scalingSorcQ.base, 85);
    assertEqual(scalingSorcQ.bonus, 75, '100 AP * 75% = 75 bonus');
    assertEqual(scalingSorcQ.total, 160);
    assertTrue(scalingSorcQ.scalingText.includes('[75% AP] Dano Mágico'));

    // 2. Knight Q (Golpe de Escudo): Base 80 + 60% AD
    const knight = { id: 'knight', heroId: 'knight', attackDamage: 120, ap: 0 };
    const knightQ = { id: 'Q', rank: 1, name: 'Golpe de Escudo' };
    const scalingKnightQ = tc.formatAbilityScaling(knightQ, knight);
    assertEqual(scalingKnightQ.base, 80);
    assertEqual(scalingKnightQ.bonus, 72, '120 AD * 60% = 72 bonus');
    assertEqual(scalingKnightQ.total, 152);
    assertTrue(scalingKnightQ.scalingText.includes('[60% AD] Dano Físico'));

    // 3. Ranger Q (Disparo Perfurante): Rank 2 Base 125 + 100% AD
    const ranger = { id: 'ranger', heroId: 'ranger', attackDamage: 110 };
    const rangerQ = { id: 'Q', rank: 2, name: 'Disparo Perfurante' };
    const scalingRangerQ = tc.formatAbilityScaling(rangerQ, ranger);
    assertEqual(scalingRangerQ.base, 125);
    assertEqual(scalingRangerQ.bonus, 110, '110 AD * 100% = 110 bonus');
    assertEqual(scalingRangerQ.total, 235);

    // 4. Assassin R (Dança Letal): Base 240 + 130% AD
    const assassin = { id: 'assassin', heroId: 'assassin', attackDamage: 100 };
    const assassinR = { id: 'R', rank: 1, name: 'Dança Letal' };
    const scalingAssnR = tc.formatAbilityScaling(assassinR, assassin);
    assertEqual(scalingAssnR.base, 240);
    assertEqual(scalingAssnR.bonus, 130, '100 AD * 130% = 130 bonus');
    assertEqual(scalingAssnR.total, 370);

    // 5. Cleric Q (Luz Sagrada): Base 90 + 70% AP
    const cleric = { id: 'cleric', heroId: 'cleric', ap: 80 };
    const clericQ = { id: 'Q', rank: 1, name: 'Luz Sagrada' };
    const scalingClericQ = tc.formatAbilityScaling(clericQ, cleric);
    assertEqual(scalingClericQ.base, 90);
    assertEqual(scalingClericQ.bonus, 56, '80 AP * 70% = 56 bonus');
    assertEqual(scalingClericQ.total, 146);
    assertTrue(scalingClericQ.scalingText.includes('[70% AP] Cura / Dano Sagrado'));
  });

  it('TC-UX-07: TooltipController item formatting, tier labels and 70% refund calculation', async () => {
    const { module: tooltipMod } = await resolveModule('ui/tooltip');
    const { module: itemsMod } = await resolveModule('systems/items');

    const tc = new tooltipMod.TooltipController();

    const infinityEdge = itemsMod.ITEM_CATALOG.item_infinity_edge;
    const chips = tc.formatItemStats(infinityEdge);

    assertTrue(chips.length >= 4);
    const adChip = chips.find(c => c.key === 'attackDamage');
    assertTrue(adChip.value.includes('75'));
    const critChip = chips.find(c => c.key === 'critChance');
    assertTrue(critChip.value.includes('25%'));

    const refund = itemsMod.getSellRefund(infinityEdge.cost);
    assertEqual(refund, 2100, '3000 gold * 70% = 2100 refund');
  });

  it('TC-UX-08: TooltipController DOM rendering, boundary clamping and headless safety', async () => {
    const { module: tooltipMod } = await resolveModule('ui/tooltip');
    const tc = new tooltipMod.TooltipController();

    // 1. Headless safety (document undefined -> no throw)
    tc.hide();
    tc.showAbilityTooltip(null);
    tc.showItemTooltip(null);

    // 2. DOM Mock for browser-like testing
    const tooltipElMock = {
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

    const targetElMock = {
      getBoundingClientRect() {
        return { left: 500, top: 400, width: 44, height: 44, right: 544, bottom: 444 };
      }
    };

    const prevDoc = globalThis.document;
    const prevWin = globalThis.window;
    try {
      globalThis.document = {
        getElementById(id) {
          if (id === 'game-tooltip') return tooltipElMock;
          return null;
        },
        createElement() { return tooltipElMock; },
        body: { appendChild() {} }
      };

      globalThis.window = {
        innerWidth: 1280,
        innerHeight: 720
      };

      tc.element = tooltipElMock;

      // Show ability tooltip
      const ab = { id: 'Q', name: 'Bola de Fogo', manaCost: 55, cooldown: 6.0, range: 500, description: 'Explode em chamas' };
      const hero = { heroId: 'sorceress', ap: 60 };
      tc.showAbilityTooltip(ab, hero, targetElMock);

      assertFalse(tooltipElMock.classList.contains('hidden'), 'Tooltip must become visible');
      assertTrue(tooltipElMock.innerHTML.includes('Bola de Fogo'));
      assertTrue(tooltipElMock.innerHTML.includes('55 Mana'));
      assertTrue(tooltipElMock.innerHTML.includes('6s Recarga'));
      assertTrue(tooltipElMock.innerHTML.includes('[75% AP] Dano Mágico'));

      // Test boundary clamping when target is at the very top (top: 5)
      const topEdgeElMock = {
        getBoundingClientRect() {
          return { left: 500, top: 5, width: 44, height: 44, right: 544, bottom: 49 };
        }
      };

      tc.updatePosition(topEdgeElMock);
      // When overflowing top (< 12), tooltip should flip below target (bottom: 49 + 12 = 61)
      const numericTop = parseInt(tooltipElMock.style.top, 10);
      assertTrue(numericTop >= 49, 'Tooltip must flip below element when overflowing top window boundary');

      // Test boundary clamping when target is at right edge
      const rightEdgeElMock = {
        getBoundingClientRect() {
          return { left: 1250, top: 300, width: 44, height: 44, right: 1294, bottom: 344 };
        }
      };
      tc.updatePosition(rightEdgeElMock);
      const numericLeft = parseInt(tooltipElMock.style.left, 10);
      assertTrue(numericLeft <= 1280 - 280 - 12, 'Tooltip must clamp inside right window boundary');

      // Hide tooltip
      tc.hide();
      assertTrue(tooltipElMock.classList.contains('hidden'), 'hide() must re-add .hidden class');
    } finally {
      globalThis.document = prevDoc;
      globalThis.window = prevWin;
    }
  });

});
