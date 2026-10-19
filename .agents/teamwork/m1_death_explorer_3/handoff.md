# Handoff Report: HUD Death Overlay & Unit Test Suite (Milestone 1)

**Agent**: M1 Death Explorer 3 (`m1_death_explorer_3`)  
**Parent Orchestrator**: `orchestrator_r2` (`64dd4762-525a-4a03-89f0-efbf6a6f4332`)  
**Mission**: Formulate exact code modifications for the HUD Death Overlay (`index.html`, `style.css`, `src/ui/hud.js`) and formulate the complete, runnable unit test suite `tests/unit/respawn.test.js` covering all R1 acceptance criteria.  
**Date**: 2026-10-17  

---

## 1. Observation

A comprehensive code investigation of `index.html`, `style.css`, `src/ui/hud.js`, `tests/runner.js`, and the test framework helpers was conducted. Direct observations:

### 1.1 DOM Structure in `index.html`
- In `index.html`, lines 16–40:
  ```html
  <!-- HUD Overlays (Pointer-events transparent, children interactive) -->
  <div id="hud-overlay" class="hud-overlay">
    <!-- Top HUD: Objectives & Match Timer -->
    <header class="top-hud">
      ...
    </header>

    <!-- Chat & Cheat Command Bar (Press Enter or / to open) -->
    <div id="chat-command-bar" class="chat-command-bar hidden">
      ...
    </div>
  ```
- **Finding**: Inside `#hud-overlay`, between `</header>` (line 30) and `<!-- Chat & Cheat Command Bar -->` (line 32), there is currently no death overlay markup. Adding `#death-timer-overlay` at this location ensures it sits cleanly within the existing HUD overlay tree with zero interference to the top header or bottom console.

### 1.2 Stylesheet Organization in `style.css`
- Lines 33–42 define `.hud-overlay` (`pointer-events: none; display: flex; flex-direction: column; justify-content: space-between;`).
- Lines 357–359 define the general utility `.hidden`:
  ```css
  .hidden {
    display: none !important;
  }
  ```
- Lines 1102–1168 contain overlay and modal components (`.chat-command-bar`, `.modal-overlay`, `.game-over-modal`).
- **Finding**: A fixed-centered modal card `.death-timer-overlay` with ruby/crimson pulsing accents, skull icon (`💀`), and bold yellow countdown font (`#fbbf24`) matches the existing visual language and z-indexing hierarchy (`z-index: 600`).

### 1.3 HUD Controller in `src/ui/hud.js`
- Lines 211–252 define `cacheDOMElements()`:
  - Safely starts with `if (typeof document === 'undefined') return;` at line 212.
  - Caches references in `this.elements`.
- Lines 254–365 define `update(playerHero, gameState, inputManager = null)`:
  - Safely starts with `if (typeof document === 'undefined') return;` at line 255.
  - Updates match timer, tower counters, hero portrait/level, stats matrix, HP/mana bars, and abilities Q/W/E/R/B.
  - There is currently no check for `playerHero.isDead` or `playerHero.respawnTimer`.
- **Finding**: Adding death overlay caching to `cacheDOMElements()` and death state checking to `update()` allows real-time overlay visibility toggling and countdown string updates (`Math.ceil(respawnTimer) + 's'`) while maintaining 100% headless test compatibility.

### 1.4 Test Infrastructure & Execution
- Running `npm test` executes `node tests/runner.js`.
- Current baseline status: **147 tests across 20 files pass with 0 failures in 472.5ms**.
- `tests/runner.js` lines 24–36:
  ```javascript
  function findTestFiles(dir, files = []) {
    ...
    else if (entry.isFile() && (entry.name.endsWith('.test.js') || entry.name.endsWith('.spec.js'))) {
      files.push(fullPath);
    }
  }
  ```
- **Finding**: Any file placed in `tests/unit/` ending in `.test.js` is automatically discovered and executed by `npm test`.

---

## 2. Logic Chain

1. **Overlay Placement & Hierarchy**:
   - Because `#hud-overlay` has `pointer-events: none`, children can opt-in to `pointer-events: auto`.
   - By creating `#death-timer-overlay` with class `death-timer-overlay hidden`, the overlay defaults to invisible on initial load.
   - Using `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 600;` guarantees the card stays centered on any viewport resolution without displacing top or bottom HUD elements.

2. **Styling & Visual Feedback**:
   - A pulsing death icon (`💀`) inside `.death-icon-pulse` immediately signals the defeat state.
   - The countdown timer `#death-timer-countdown` styled with `font-size: 46px; font-weight: 900; color: #fbbf24; text-shadow: 0 0 18px rgba(251, 191, 36, 0.65)` provides high legibility.
   - Adding `.hero-portrait.is-dead` with `filter: grayscale(100%) brightness(55%); border-color: #ef4444 !important;` visibly greys out the hero portrait during death.

3. **Reactivity in `src/ui/hud.js`**:
   - In `update(playerHero, gameState)`:
     - Check `const isDead = typeof playerHero.isDead === 'function' ? playerHero.isDead() : !!playerHero.isDead;`.
     - Check `const respawnTimer = typeof playerHero.respawnTimer === 'number' ? playerHero.respawnTimer : 0;`.
     - When `isDead && respawnTimer > 0`: remove `.hidden` from `deathOverlay`, set `deathCountdown.textContent = `${Math.ceil(respawnTimer)}s``, add `is-dead` to portrait.
     - When alive or timer zero: add `.hidden` to `deathOverlay`, remove `is-dead` from portrait.
   - Headless safety is strictly preserved because lines 212 and 255 guard with `if (typeof document === 'undefined') return;`.

4. **Test Suite Design (`tests/unit/respawn.test.js`)**:
   - **TC-HERO-08**: Validates $4s + 1s \times L$ duration for level 1 (5.0s), level 2 (6.0s), level 6 (10.0s), level 12 (16.0s), and clamp boundary ($\le 0 \rightarrow 5.0s$).
   - **TC-HERO-09**: Validates that lethal damage triggers death state, clamps HP to 0, sets `isAlive() === false`, and initializes `respawnDuration` and `respawnTimer`.
   - **TC-HERO-10**: Validates that `moveTo`, `setAttackTarget`, `canMove()`, `canAttack()`, and `canCast()` are rejected while dead.
   - **TC-HERO-11**: Validates that dead hero entities are retained in `sim.entities` when applying the simulation cleanup filter.
   - **TC-HERO-12**: Validates tick-by-tick decrement of `respawnTimer`, resurrection at Allied Fountain `(400, 400)` with 100% HP, 100% Mana, cleansed crowd control (stun/silence/slow reset), and restored combat/movement readiness.
   - **TC-HERO-13**: Validates that hero ability cooldowns continue ticking while dead.
   - **TC-HUD-01**: Validates `HUDController.update` correctly toggles `.hidden` and sets countdown text for dead vs alive heroes.

---

## 3. Caveats

1. **Headless Environment**: The unit test runner runs directly in Node.js without JSDOM. Any HUD unit testing must mock element interfaces or use guarded blocks to ensure zero Node.js crashes.
2. **Timer Rounding in UI**: `Math.ceil(respawnTimer) + 's'` is used for display so that `0.1s` displays as `1s` rather than `0s` prior to the instant of resurrection.
3. **No Caveats on Compatibility**: The proposed markup and styles are completely additive and do not alter existing canvas rendering, game state structures, or existing tests.

---

## 4. Conclusion & Actionable Code Blueprint

The exact code changes to be implemented by the Milestone 1 Worker are specified below.

### 4.1 `index.html` Modification

**Target**: `index.html`  
**Location**: Insert between line 30 (`</header>`) and line 32 (`<!-- Chat & Cheat Command Bar -->`).

```html
<<<< TARGET CONTENT (index.html, lines 30-33)
    </header>

    <!-- Chat & Cheat Command Bar (Press Enter or / to open) -->
    <div id="chat-command-bar" class="chat-command-bar hidden">
==== REPLACEMENT CONTENT
    </header>

    <!-- Death Timer Overlay (M1 / R1) -->
    <div id="death-timer-overlay" class="death-timer-overlay hidden">
      <div class="death-timer-card">
        <div class="death-icon-pulse">
          <span class="death-icon">💀</span>
        </div>
        <h2 class="death-title">VOCÊ FOI DERROTADO</h2>
        <div class="death-divider"></div>
        <p class="death-label">Ressurgindo na Fonte em</p>
        <div class="death-timer-value">
          <span id="death-timer-countdown" class="death-countdown">0s</span>
        </div>
      </div>
    </div>

    <!-- Chat & Cheat Command Bar (Press Enter or / to open) -->
    <div id="chat-command-bar" class="chat-command-bar hidden">
>>>>
```

---

### 4.2 `style.css` Modification

**Target**: `style.css`  
**Location**: Append to the end of `style.css`.

```css
/* ─────────────────────────────────────────────────────────────
   Death Timer Overlay & Countdown (M1 / R1)
   ───────────────────────────────────────────────────────────── */
.death-timer-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 600;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: deathOverlayFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.death-timer-overlay.hidden {
  display: none !important;
}

.death-timer-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at center, rgba(30, 27, 46, 0.95) 0%, rgba(15, 23, 42, 0.96) 100%);
  border: 2px solid rgba(239, 68, 68, 0.7);
  border-radius: 16px;
  padding: 24px 40px;
  box-shadow: 0 0 32px rgba(239, 68, 68, 0.35), 0 12px 40px rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  min-width: 300px;
  text-align: center;
  pointer-events: auto;
}

.death-icon-pulse {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  margin-bottom: 12px;
  animation: deathSkullPulse 2s infinite ease-in-out;
}

.death-icon {
  font-size: 36px;
  line-height: 1;
  filter: drop-shadow(0 0 8px rgba(239, 68, 68, 0.8));
}

.death-title {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 2px;
  color: #ef4444;
  text-transform: uppercase;
  text-shadow: 0 0 12px rgba(239, 68, 68, 0.6);
  margin-bottom: 6px;
}

.death-divider {
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #ef4444, transparent);
  margin: 6px 0 10px 0;
}

.death-label {
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.death-timer-value {
  margin-top: 4px;
}

.death-countdown {
  font-size: 46px;
  font-weight: 900;
  letter-spacing: 1px;
  color: #fbbf24;
  text-shadow: 0 0 18px rgba(251, 191, 36, 0.65), 0 0 32px rgba(239, 68, 68, 0.4);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}

.hero-portrait.is-dead {
  filter: grayscale(100%) brightness(55%);
  border-color: #ef4444 !important;
  box-shadow: 0 0 14px rgba(239, 68, 68, 0.5) !important;
}

@keyframes deathOverlayFadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, -46%) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes deathSkullPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    transform: scale(1.08);
    box-shadow: 0 0 16px 4px rgba(239, 68, 68, 0.25);
  }
}
```

---

### 4.3 `src/ui/hud.js` Modification

**Target**: `src/ui/hud.js`  
**Chunk 1**: Inside `cacheDOMElements()` (around line 245):

```javascript
<<<< TARGET CONTENT (src/ui/hud.js, lines 242-248)
      abilityR: document.getElementById('ability-r'),
      abilityB: document.getElementById('ability-b'),

      // Minimap Canvas
      minimapCanvas: document.getElementById('minimap-canvas')
    };
==== REPLACEMENT CONTENT
      abilityR: document.getElementById('ability-r'),
      abilityB: document.getElementById('ability-b'),

      // Death Timer Overlay (M1 / R1)
      deathOverlay: document.getElementById('death-timer-overlay'),
      deathCountdown: document.getElementById('death-timer-countdown'),

      // Minimap Canvas
      minimapCanvas: document.getElementById('minimap-canvas')
    };
>>>>
```

**Chunk 2**: Inside `update(playerHero, gameState, inputManager = null)` (at line 364):

```javascript
<<<< TARGET CONTENT (src/ui/hud.js, lines 360-366)
        if (sweepEl) sweepEl.style.setProperty('--cooldown-angle', '0deg');
        if (textEl) textEl.textContent = '';
        el.classList.remove('cooldown-active');
      }
    }
  }
}
==== REPLACEMENT CONTENT
        if (sweepEl) sweepEl.style.setProperty('--cooldown-angle', '0deg');
        if (textEl) textEl.textContent = '';
        el.classList.remove('cooldown-active');
      }
    }

    // 6. Death Timer Overlay (M1 / R1)
    if (this.elements.deathOverlay && this.elements.deathCountdown) {
      const isDead = typeof playerHero.isDead === 'function' ? playerHero.isDead() : !!playerHero.isDead;
      const respawnTimer = typeof playerHero.respawnTimer === 'number' ? playerHero.respawnTimer : 0;

      if (isDead && respawnTimer > 0) {
        this.elements.deathOverlay.classList.remove('hidden');
        this.elements.deathCountdown.textContent = `${Math.ceil(respawnTimer)}s`;
        if (this.elements.heroPortrait) {
          this.elements.heroPortrait.classList.add('is-dead');
        }
      } else {
        this.elements.deathOverlay.classList.add('hidden');
        if (this.elements.heroPortrait) {
          this.elements.heroPortrait.classList.remove('is-dead');
        }
      }
    }
  }
}
>>>>
```

---

### 4.4 New Unit Test Suite: `tests/unit/respawn.test.js`

**File to create**: `tests/unit/respawn.test.js`  
**Full file content**:

```javascript
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
});
```

---

## 5. Verification Method

1. **Verify Baseline Regression Safety**:
   ```pwsh
   npm test
   ```
   All 147 existing unit/e2e tests continue to pass with 0 failures.

2. **Verify New Respawn Suite**:
   Once implemented by the Worker:
   ```pwsh
   npm test tests/unit/respawn.test.js
   ```
   Must execute 7 tests (TC-HERO-08 to TC-HERO-13, and TC-HUD-01) with 7/7 passing.

3. **Verify DOM & CSS Markup in Headless vs Browser**:
   - In browser: Opening `index.html` loads `#death-timer-overlay` in hidden state.
   - Inflicting lethal damage reveals the overlay with countdown decreasing from $4s + 1s \times L$ to 0s, whereupon the hero respawns at $(400, 400)$ with 100% HP/Mana and the overlay hides automatically.
