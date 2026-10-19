# Handoff Report: R1 Hero Death & Respawn System Investigation

**Agent**: Survey Explorer 1 (`survey_explorer_r2_1`)  
**Parent Orchestrator**: `orchestrator_r2` (`64dd4762-525a-4a03-89f0-efbf6a6f4332`)  
**Mission**: Investigate Requirement R1 (Hero Death & Respawn System) across the codebase and provide a complete architectural blueprint for implementation.  
**Date**: 2026-10-17  

---

## 1. Observation

A full code audit and test execution of the repository (`c:\Users\Bruno\Downloads\jogo-duplinha`) was performed. The baseline test suite currently passes cleanly with 147/147 tests passing across 20 files (`npm test`).

The investigation revealed the following concrete observations across the codebase:

### 1.1 Fatal Damage Handling & Permanent Hero Exclusion in `src/game.js`
In `src/game.js`, the main simulation update loop cleans up dead entities at lines 981–986:
```javascript
// 6. Clean up dead dynamic units
this.entities = this.entities.filter(ent => {
  if (ent.type === 'tower' || ent.type === 'nexus') return true;
  const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
  return !isDead && (typeof ent.hp !== 'number' || ent.hp > 0);
});
```
- **Direct observation**: `ent.type === 'hero'` is **not** exempted from cleanup. When a hero's `hp <= 0` or `isDead` is true, the hero is filtered out of `this.entities`.
- This directly violates Requirement R1 / Acceptance Criteria ("*Ao ter seu HP zerado, o herói não é excluído irrecuperavelmente do array de entidades*").

### 1.2 Entity Base & Hero Entity Death State in `src/entities/entity.js`
In `src/entities/entity.js`:
- Lines 53, 69–75:
  ```javascript
  this.isDeadState = false;
  get isDead() { return this.isDeadState || this.hp <= 0; }
  set isDead(val) { this.isDeadState = !!val; }
  isAlive() { return !this.isDead && this.hp > 0; }
  ```
- Lines 128–150:
  ```javascript
  takeDamage(amount, type = 'physical') {
    if (!this.isAlive() || amount <= 0) return 0;
    ...
    this.hp = Math.max(0, this.hp - remaining);
    if (this.hp <= 0) {
      this.isDeadState = true;
      this.stop();
    }
    if (this.isRecalling) {
      this.isRecalling = false;
      this.recallElapsed = 0;
    }
    return amount;
  }
  ```
- Lines 329–435 (`HeroEntity`):
  - `HeroEntity` has **no respawn timer** properties (`respawnTimer`, `respawnDuration`).
  - `HeroEntity.update(dt)` calls `super.update(dt)`. Because `Entity.update(dt)` immediately returns `if (!this.isAlive()) return;` (line 160), no countdown or update runs when the hero is dead.
  - `HeroEntity` has no `die()` or `respawn()` methods.
  - `HeroEntity.moveTo(wx, wy)` (lines 391–398) and `HeroEntity.setAttackTarget(target)` (lines 381–389) do **not** check `this.isAlive()`. If called directly while dead, they update target positions and attack references.

### 1.3 Command Dispatching & Input Handling
- In `src/game.js` line 192–194:
  ```javascript
  handleCommand(cmd) {
    if (!cmd || !this.playerHero || !this.playerHero.isAlive()) return;
  ```
  `game.handleCommand` currently drops all incoming commands when `!this.playerHero.isAlive()`.
- In `src/core/input.js` lines 619–620:
  ```javascript
  const isDead = typeof hero.isDead === 'function' ? hero.isDead() : !!hero.isDead;
  if (isDead) return;
  ```
  Ability trigger (`triggerAbility`) checks `isDead` and returns, but pointer clicks (`handlePointerDown`, `dispatchSmartRightClick`) and Attack-Move key (`KeyA`) do not check hero death state before dispatching.

### 1.4 Map Collisions & Fountain Healing on Dead Units
- In `src/world/map.js` lines 550–554:
  ```javascript
  resolveEntityCollision(entity) {
    if (!entity) return;
    const isDead = typeof entity.isDead === 'function' ? entity.isDead() : !!entity.isDead;
    if (isDead || (typeof entity.hp === 'number' && entity.hp <= 0)) return;
  ```
  Terrain and structure collisions are **already skipped** for dead entities.
- In `src/world/map.js` lines 627–629:
  ```javascript
  applyFountainRegen(entities = [], dt = 0.01667) {
    ...
    if (isDead || (typeof ent.hp === 'number' && ent.hp <= 0)) continue;
  ```
  Fountain rapid regeneration **already ignores** dead entities.

### 1.5 Projectiles & AI Targeting on Dead Units
- In `src/combat/projectile.js` lines 37–41:
  ```javascript
  const isTargetAlive = target && (typeof target.isAlive === 'function' ? target.isAlive() : target.hp > 0);
  if (!isTargetAlive) {
    this.isDead = true;
    return;
  }
  ```
  Hero projectiles dissipate mid-air if the target dies.
- In `src/world/tower.js` lines 60–65 and 314–315:
  Tower projectiles dissipate if the target dies; towers ignore dead entities when acquiring targets.
- In `src/world/minion.js` lines 334–343 and 353–355:
  Minions ignore dead entities and disengage if their target dies.

### 1.6 HUD Controller & DOM Representation in `src/ui/hud.js` and `index.html`
- In `src/ui/hud.js`:
  - `HUDController.update` (lines 254–365) updates match timer, tower counts, stats matrix, HP/mana bars, and ability slots.
  - There is currently **no death timer tracking or countdown display**.
- In `index.html`:
  - There is currently **no death overlay modal or countdown container** in `#hud-overlay`.

---

## 2. Logic Chain

From the observations above, the required changes to implement R1 with 100% adherence to the user request and acceptance criteria are derived as follows:

1. **Respawn Duration Formula**:
   - User Request: `4s + 1s` per current hero level.
   - Level 1: $4 + 1 = 5$ seconds.
   - Level $L$: $4 + L \times 1$ seconds.
   - A pure helper function `calculateRespawnTime(level = 1)` should be exported from `src/entities/heroes.js`.

2. **Entity Preservation**:
   - In `src/game.js` line 983, change:
     ```javascript
     if (ent.type === 'tower' || ent.type === 'nexus' || ent.type === 'hero') return true;
     ```
     This prevents heroes from ever being filtered out of `this.entities`.

3. **Death State & Timer Lifecycle in `HeroEntity`**:
   - Add properties:
     `this.respawnTimer = 0;`
     `this.respawnDuration = 0;`
   - In `HeroEntity.takeDamage(amount, type)`:
     When lethal damage brings `this.hp <= 0`:
     - Set `this.isDeadState = true`.
     - Clamp `this.hp = 0`.
     - Call `this.stop()` and clear targets (`this.attackTarget = null; this.attackMoveDestination = null;`).
     - Calculate duration: `this.respawnDuration = calculateRespawnTime(this.level); this.respawnTimer = this.respawnDuration;`.
     - Cancel recall (`this.isRecalling = false; this.recallElapsed = 0;`).
   - In `HeroEntity.update(dt)`:
     If `this.isDead`:
     - Decrement ability cooldowns so abilities continue ticking while dead.
     - Decrement `this.respawnTimer = Math.max(0, this.respawnTimer - dt)`.
     - If `this.respawnTimer === 0`, execute `this.respawn()`.
     - Return early so movement/physics/natural regen do not run.

4. **Action Rejection during Death**:
   - In `HeroEntity.moveTo(wx, wy)`: guard with `if (!this.isAlive()) return;`.
   - In `HeroEntity.setAttackTarget(target)`: guard with `if (!this.isAlive()) return;`.
   - In `src/core/input.js`: ensure mouse clicks and 'A'-click check `if (!hero.isAlive()) return;`.
   - `game.handleCommand` already enforces `if (!this.playerHero.isAlive()) return;`.

5. **Respawn Execution (`hero.respawn()`)**:
   - Coordinate reset: Allied Fountain center `(400, 400)`.
   - Physics reset: `this.vx = 0; this.vy = 0; this.targetX = null; this.targetY = null; this.isMoving = false;`.
   - Health and Mana: restored to 100% (`this.hp = this.maxHp; this.mana = this.maxMana;`).
   - State reset: `this.isDeadState = false; this.respawnTimer = 0; this.respawnDuration = 0;`.
   - Status Cleansing ("status limpo"): reset CC timers (`this.stunnedUntil = 0; this.silencedUntil = 0; this.rootedUntil = 0; this.tauntedUntil = 0; this.slowedUntil = 0; this.slowPercentage = 0; this.barrier = 0;`).
   - Restore combat and movement readiness: `this.holdPosition = false; this.attackTarget = null;`.

6. **HUD Display**:
   - In `index.html`: add a `#death-timer-overlay` within `#hud-overlay`:
     ```html
     <div id="death-timer-overlay" class="death-timer-overlay hidden">
       <div class="death-timer-card">
         <span class="death-icon">💀</span>
         <span class="death-title">VOCÊ MORREU</span>
         <span class="death-label">Ressurgindo em:</span>
         <span id="death-timer-countdown" class="death-countdown">0s</span>
       </div>
     </div>
     ```
   - In `src/ui/hud.js`:
     Cache `deathOverlay` and `deathCountdown` in `cacheDOMElements()`.
     In `update(playerHero, gameState)`:
     - If `playerHero.isDead` and `playerHero.respawnTimer > 0`:
       - Remove `hidden` class from `deathOverlay`.
       - Update `deathCountdown.textContent = `${Math.ceil(playerHero.respawnTimer)}s``.
       - Update portrait with death indicator or grayed out class.
     - Else:
       - Add `hidden` class to `deathOverlay`.
     - All DOM updates retain existing `if (typeof document === 'undefined') return;` guards for headless testing.

---

## 3. Caveats & Dependencies

1. **Multiplayer P2P & Multiple Heroes**:
   Exempting `ent.type === 'hero'` from removal in `game.js` line 983 correctly handles both local solo play and any peer heroes present in co-op.
2. **Headless Node.js Unit Testing**:
   The test framework (`node tests/runner.js`) runs in pure Node.js without a DOM. Any HUD or DOM extensions must maintain non-breaking guards (`typeof document !== 'undefined'`) to prevent test crashes.
3. **Fountain Regeneration vs Immediate Full Respawn**:
   R1 specifies the hero respawns with full HP/Mana immediately at `(400, 400)`. `applyFountainRegen` in `map.js` clamps to `maxHp`, so the hero is at 100% upon resurrecting and fountain regen safely does nothing until damage is taken.
4. **Camera Centering on Respawn**:
   `camera.follow(hero)` smoothly pans to the hero's new location at `(400, 400)`, or `camera.lookAt(400, 400)` can be called on respawn.

---

## 4. Recommended Fix Strategy / Implementation Plan

| Step | File | Action |
|------|------|--------|
| **1** | `src/entities/heroes.js` | Export `calculateRespawnTime(level = 1)` implementing $4 + \text{level} \times 1$. |
| **2** | `src/entities/entity.js` | In `HeroEntity`: add `respawnTimer`, `respawnDuration`, `die()`, `respawn()`. Update `takeDamage()`, `moveTo()`, `setAttackTarget()`, and `update(dt)` to decrement timer and trigger respawn. |
| **3** | `src/game.js` | Update line 983 entity cleanup filter to include `|| ent.type === 'hero'`. Emit floating text/particles on death and respawn. |
| **4** | `src/core/input.js` | Ensure mouse clicks and attack commands check `hero.isAlive()`. |
| **5** | `index.html` & `style.css` | Add `#death-timer-overlay` markup and CSS animation/styling. |
| **6** | `src/ui/hud.js` | Cache `#death-timer-overlay` and `#death-timer-countdown` and update them in `HUDController.update()`. |
| **7** | `tests/unit/heroes.test.js` | Add 5 new unit tests (TC-HERO-08 to TC-HERO-12) covering respawn duration scaling, death state entry, action rejection, array preservation, and resurrection at `(400, 400)`. |

---

## 5. Verification Method

### 5.1 Test Execution Command
Run from project root:
```pwsh
npm test
```
All existing 147 tests must continue passing (0 failures), and the new unit tests for R1 must pass cleanly.

### 5.2 Unit Test Specifications to Add to `tests/unit/heroes.test.js`

1. **TC-HERO-08: Respawn time calculation formula**
   - Level 1: returns exactly 5.0 seconds.
   - Level 6: returns exactly 10.0 seconds.
   - Level 12: returns exactly 16.0 seconds.

2. **TC-HERO-09: Hero enters death state upon lethal damage**
   - Create a `HeroEntity` at level 1 with 680 HP.
   - Call `hero.takeDamage(1000)`.
   - Assert `hero.hp === 0`, `hero.isDead === true`, `hero.isAlive() === false`.
   - Assert `hero.respawnTimer === 5.0` and `hero.respawnDuration === 5.0`.

3. **TC-HERO-10: Actions rejected during death**
   - With dead hero, call `hero.moveTo(800, 800)`.
   - Assert `hero.targetX === null`, `hero.isMoving === false`.
   - Call `hero.setAttackTarget({ id: 'dummy', x: 500, y: 500 })`.
   - Assert `hero.attackTarget === null`.
   - Assert `hero.canMove() === false`, `hero.canAttack() === false`, `hero.canCast() === false`.

4. **TC-HERO-11: Hero entity is preserved in simulation array on death**
   - Simulate game entity array containing `[hero, minion, tower]`.
   - Inflict lethal damage on hero and minion.
   - Apply filter: `entities = entities.filter(...)`.
   - Assert `entities.some(e => e.id === hero.id) === true` (hero preserved).
   - Assert minion was removed.

5. **TC-HERO-12: Respawn countdown decrement & resurrection at Allied Fountain (400, 400)**
   - Start with dead hero at `(1500, 1500)` with `respawnTimer = 5.0`, `hp = 0`, `mana = 0`, `stunnedUntil = Date.now() + 10000`.
   - Update `hero.update(2.5)`: assert `hero.respawnTimer === 2.5`, still dead.
   - Update `hero.update(2.5)`: assert timer hits 0.
   - Assert `hero.isDead === false`, `hero.isAlive() === true`.
   - Assert `hero.x === 400` and `hero.y === 400`.
   - Assert `hero.hp === hero.maxHp` and `hero.mana === hero.maxMana`.
   - Assert `hero.stunnedUntil === 0` (clean status).
   - Assert `hero.canMove() === true`.
