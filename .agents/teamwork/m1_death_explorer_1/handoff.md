# Handoff Report: Hero Death & Resurrection Lifecycle Code Specifications (M1)

**Agent**: M1 Death Explorer 1 (`m1_death_explorer_1`)  
**Parent Orchestrator**: `orchestrator_r2` (`64dd4762-525a-4a03-89f0-efbf6a6f4332`)  
**Mission**: Formulate exact code modifications for `src/entities/heroes.js` and `src/entities/entity.js` implementing Requirement R1 (Hero Death & Respawn System)  
**Date**: 2026-10-17  
**Status**: COMPLETE (Hard Handoff)  

---

## 1. Observation

A full code audit was performed on `src/entities/heroes.js`, `src/entities/entity.js`, `src/game.js`, `src/combat/cc.js`, and the unit test suite (`npm test`, 147 tests passing).

### 1.1 `src/entities/heroes.js`
- **File Path**: `c:\Users\Bruno\Downloads\jogo-duplinha\src\entities\heroes.js` (355 lines)
- **Lines 104–123**: Contains `calculateHeroStatsAtLevel(heroId, level = 1)` calculating hero base stats with level scaling ($L \in [1, 12]$).
- **Lines 125–354**: Contains damage, shield, and ability kit formulas for the 5 heroes.
- **Finding**: There is currently no `calculateRespawnTime` exported from `heroes.js`.
- **Requirement**: Export `calculateRespawnTime(level = 1)` implementing the scaling formula $4.0\text{s} + 1.0\text{s} \times \text{level}$ (e.g. Level 1 = 5.0s, Level 6 = 10.0s, Level 12 = 16.0s).

### 1.2 `src/entities/entity.js`
- **File Path**: `c:\Users\Bruno\Downloads\jogo-duplinha\src\entities\entity.js` (565 lines)
- **Lines 8–9**:
  ```javascript
  import { worldToScreen, getDepthKey } from '../core/isometric.js';
  ```
  Does not import `calculateRespawnTime`.
- **Lines 110–114 (`Entity.moveTo`)**:
  ```javascript
  moveTo(wx, wy) {
    this.targetX = wx;
    this.targetY = wy;
    this.isMoving = true;
  }
  ```
  Does not check `this.isAlive()`.
- **Lines 359–366 (`HeroEntity` constructor)**:
  `HeroEntity` lacks `respawnTimer` and `respawnDuration` properties.
- **Lines 381–398 (`HeroEntity.setAttackTarget` and `moveTo`)**:
  ```javascript
  setAttackTarget(target) {
    this.attackTarget = target;
    this.holdPosition = false;
    this.attackMoveDestination = null;
    ...
  }

  moveTo(wx, wy, isAttackMove = false) {
    super.moveTo(wx, wy);
    this.attackTarget = null;
    ...
  }
  ```
  Neither checks `this.isAlive()`. If called directly while dead, they mutate target references and destination vectors.
- **Lines 400–435 (`HeroEntity.stop` & `HeroEntity.update`)**:
  `HeroEntity` has no `die()` or `respawn()` methods.
  `HeroEntity.takeDamage(amount, type)` is inherited directly from `Entity`, which sets `isDeadState = true` and calls `this.stop()`, but does not initialize respawn timers, clear attack targets, or cancel recall.
  `HeroEntity.update(dt)` calls `super.update(dt)`. Because `Entity.update(dt)` returns early when `!this.isAlive()`, no ability cooldown decrements or respawn countdown occur while dead.

### 1.3 Crowd Control & Status Cleanse
- In `src/combat/cc.js` (lines 5–15) and `src/entities/entity.js` (lines 57–62):
  Entity CC state includes `stunnedUntil`, `silencedUntil`, `rootedUntil`, `tauntedUntil`, `tauntTargetId`, `slowedUntil`, `slowPercentage`, `stealthedUntil`, and `barrier`.
  Requirement R1 mandates "status limpo" (clean status) upon resurrection: all CC timers and slow percentages must be cleared to 0 / null.

---

## 2. Logic Chain

1. **Formula Derivation**:
   The user specification explicitly requires: *"contagem regressiva de ressurreição baseada no nível (4s + 1s por nível atual do herói)"*.
   - Level 1: $4.0 + 1 \times 1.0 = 5.0\text{s}$
   - Level 6: $4.0 + 6 \times 1.0 = 10.0\text{s}$
   - Level 12: $4.0 + 12 \times 1.0 = 16.0\text{s}$
   Using `Math.max(1, Math.floor(Number(level) || 1))` ensures robust behavior if `level` is undefined, 0, or fractional.

2. **Acyclic Dependency**:
   `src/entities/heroes.js` imports zero external modules. Importing `calculateRespawnTime` from `./heroes.js` into `src/entities/entity.js` introduces zero circular dependencies.

3. **Death State Lifecycle (`die()`)**:
   Lethal damage can occur via `takeDamage(amount)` or directly via `die()`.
   Centralizing lethal state initialization in `HeroEntity.die()` guarantees:
   - `this.hp = 0` (clean clamp)
   - `this.isDeadState = true`
   - `this.stop()` (cancels velocity, pathing)
   - `this.attackTarget = null` and `this.attackMoveDestination = null`
   - `this.isRecalling = false` and `this.recallElapsed = 0`
   - `this.respawnDuration = calculateRespawnTime(this.level)`
   - `this.respawnTimer = this.respawnDuration`

4. **Action Rejection during Death**:
   - `canMove()`, `canAttack()`, and `canCast()` in `Entity` already check `if (!this.isAlive()) return false;`.
   - Adding `if (!this.isAlive()) return;` to `Entity.moveTo`, `HeroEntity.moveTo`, and `HeroEntity.setAttackTarget` prevents any direct commands from modifying positions or targets during death.

5. **Countdown & Ability Tick in `HeroEntity.update(dt)`**:
   When `this.isDead` is true:
   - Abilities cooldowns must continue ticking (`ab.cooldownRemaining = Math.max(0, ab.cooldownRemaining - dt)`).
   - `this.respawnTimer = Math.max(0, (this.respawnTimer || 0) - dt)`.
   - When `this.respawnTimer === 0`, trigger `this.respawn()`.
   - Return early from `update(dt)` so physics, pathing, and natural regeneration do not run while dead.

6. **Full Restoration on `respawn()`**:
   - Teleport to Allied Fountain: `this.x = 400; this.y = 400; this.z = 0;`
   - Reset velocity and movement: `this.vx = 0; this.vy = 0; this.targetX = null; this.targetY = null; this.isMoving = false;`
   - Restore health and mana: `this.hp = this.maxHp; this.mana = this.maxMana; this.barrier = 0;`
   - Reset death state and timers: `this.isDeadState = false; this.respawnTimer = 0; this.respawnDuration = 0;`
   - Reset combat state: `this.holdPosition = false; this.attackTarget = null; this.attackMoveDestination = null; this.attackCooldown = 0;`
   - Reset recall: `this.isRecalling = false; this.recallElapsed = 0;`
   - Clean status (CC reset): `stunnedUntil = 0; silencedUntil = 0; rootedUntil = 0; tauntedUntil = 0; tauntTargetId = null; slowedUntil = 0; slowPercentage = 0; stealthedUntil = 0;`

---

## 3. Caveats

1. **Array Retention**: `src/game.js` line 983 (`this.entities.filter(...)`) must exempt `ent.type === 'hero'` so dead heroes are retained in the simulation array. This is within Milestone 1 scope and coordinated with `m1_worker_1`.
2. **Headless Safety**: `respawn()` and `die()` do not access browser DOM objects (`window`, `document`), preserving full headless Node.js test runner compatibility.
3. **Facing on Respawn**: Hero facing is preserved or can reset to default without impacting game mechanics.

---

## 4. Conclusion & Concrete Code Specifications

Here are the exact code modifications for `src/entities/heroes.js` and `src/entities/entity.js`.

### 4.1 Modification 1: `src/entities/heroes.js`

**Target File**: `c:\Users\Bruno\Downloads\jogo-duplinha\src\entities\heroes.js`  
**Location**: Insert immediately after line 123 (after `calculateHeroStatsAtLevel`).

```javascript
/**
 * Calculates hero respawn duration in seconds based on hero level.
 * Scaling Formula: 4.0s base + 1.0s per hero level (minimum level 1).
 * Examples:
 *   Level 1:  4.0 + 1 * 1.0 = 5.0 seconds
 *   Level 6:  4.0 + 6 * 1.0 = 10.0 seconds
 *   Level 12: 4.0 + 12 * 1.0 = 16.0 seconds
 *
 * @param {number} [level=1] Current hero level
 * @returns {number} Respawn duration in seconds
 */
export function calculateRespawnTime(level = 1) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return 4.0 + safeLevel * 1.0;
}
```

---

### 4.2 Modification 2: `src/entities/entity.js` — Imports

**Target File**: `c:\Users\Bruno\Downloads\jogo-duplinha\src\entities\entity.js`  
**Location**: Lines 8–9  

```javascript
// BEFORE:
import { worldToScreen, getDepthKey } from '../core/isometric.js';

// AFTER:
import { worldToScreen, getDepthKey } from '../core/isometric.js';
import { calculateRespawnTime } from './heroes.js';
```

---

### 4.3 Modification 3: `src/entities/entity.js` — `Entity.moveTo` Action Guard

**Target File**: `c:\Users\Bruno\Downloads\jogo-duplinha\src\entities\entity.js`  
**Location**: Lines 110–115  

```javascript
// BEFORE:
  moveTo(wx, wy) {
    this.targetX = wx;
    this.targetY = wy;
    this.isMoving = true;
  }

// AFTER:
  moveTo(wx, wy) {
    if (!this.isAlive()) return;
    this.targetX = wx;
    this.targetY = wy;
    this.isMoving = true;
  }
```

---

### 4.4 Modification 4: `src/entities/entity.js` — `HeroEntity` Constructor

**Target File**: `c:\Users\Bruno\Downloads\jogo-duplinha\src\entities\entity.js`  
**Location**: Lines 359–368  

```javascript
// BEFORE:
    // Basic attack tracking & state
    this.attackCooldown = 0;
    this.attackTarget = null;
    this.holdPosition = false;
    this.attackMoveDestination = null;
    this.critChance = options.critChance || 0;
    this.lifesteal = options.lifesteal || 0;

    // Abilities dictionary (Q, W, E, R)

// AFTER:
    // Basic attack tracking & state
    this.attackCooldown = 0;
    this.attackTarget = null;
    this.holdPosition = false;
    this.attackMoveDestination = null;
    this.critChance = options.critChance || 0;
    this.lifesteal = options.lifesteal || 0;

    // Respawn state properties (PROJECT.md M1 / R1)
    this.respawnTimer = options.respawnTimer ?? 0;
    this.respawnDuration = options.respawnDuration ?? 0;

    // Abilities dictionary (Q, W, E, R)
```

---

### 4.5 Modification 5: `src/entities/entity.js` — `HeroEntity` Actions, `die()`, `respawn()`, `takeDamage()`

**Target File**: `c:\Users\Bruno\Downloads\jogo-duplinha\src\entities\entity.js`  
**Location**: Lines 381–406  

```javascript
// BEFORE:
  setAttackTarget(target) {
    this.attackTarget = target;
    this.holdPosition = false;
    this.attackMoveDestination = null;
    if (this.isRecalling) {
      this.isRecalling = false;
      this.recallElapsed = 0;
    }
  }

  moveTo(wx, wy, isAttackMove = false) {
    super.moveTo(wx, wy);
    this.attackTarget = null;
    if (!isAttackMove) {
      this.attackMoveDestination = null;
    }
    this.holdPosition = false;
  }

  stop() {
    super.stop();
    this.attackTarget = null;
    this.attackMoveDestination = null;
    this.holdPosition = true;
  }

// AFTER:
  setAttackTarget(target) {
    if (!this.isAlive()) return;
    this.attackTarget = target;
    this.holdPosition = false;
    this.attackMoveDestination = null;
    if (this.isRecalling) {
      this.isRecalling = false;
      this.recallElapsed = 0;
    }
  }

  moveTo(wx, wy, isAttackMove = false) {
    if (!this.isAlive()) return;
    super.moveTo(wx, wy);
    this.attackTarget = null;
    if (!isAttackMove) {
      this.attackMoveDestination = null;
    }
    this.holdPosition = false;
  }

  stop() {
    super.stop();
    this.attackTarget = null;
    this.attackMoveDestination = null;
    this.holdPosition = true;
  }

  /**
   * Enters dead state: clamps HP to 0, stops movement, cancels recall, clears targets,
   * and initializes level-scaled respawn countdown.
   */
  die() {
    this.hp = 0;
    this.isDeadState = true;
    this.stop();
    this.attackTarget = null;
    this.attackMoveDestination = null;
    if (this.isRecalling) {
      this.isRecalling = false;
      this.recallElapsed = 0;
    }
    this.respawnDuration = calculateRespawnTime(this.level);
    this.respawnTimer = this.respawnDuration;
  }

  /**
   * Resurrects hero at Allied Fountain (400, 400) with full HP/Mana,
   * reset velocity, cleansed crowd control effects, and cleared hold/attack states.
   */
  respawn() {
    this.x = 400;
    this.y = 400;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.targetX = null;
    this.targetY = null;
    this.isMoving = false;
    this.hp = this.maxHp;
    this.mana = this.maxMana;
    this.barrier = 0;
    this.isDeadState = false;
    this.respawnTimer = 0;
    this.respawnDuration = 0;
    this.holdPosition = false;
    this.attackTarget = null;
    this.attackMoveDestination = null;
    this.attackCooldown = 0;
    if (this.isRecalling) {
      this.isRecalling = false;
      this.recallElapsed = 0;
    }

    // Cleanse all crowd control debuffs
    this.stunnedUntil = 0;
    this.silencedUntil = 0;
    this.rootedUntil = 0;
    this.tauntedUntil = 0;
    this.tauntTargetId = null;
    this.slowedUntil = 0;
    this.slowPercentage = 0;
    this.stealthedUntil = 0;
  }

  /**
   * Applies damage, cancels recall, and triggers die() if damage is lethal.
   */
  takeDamage(amount, type = 'physical') {
    if (!this.isAlive() || amount <= 0) return 0;
    const dealt = super.takeDamage(amount, type);
    if (this.hp <= 0) {
      this.die();
    }
    return dealt;
  }
```

---

### 4.6 Modification 6: `src/entities/entity.js` — `HeroEntity.update(dt)`

**Target File**: `c:\Users\Bruno\Downloads\jogo-duplinha\src\entities\entity.js`  
**Location**: Lines 407–434  

```javascript
// BEFORE:
  update(dt = 0.01667) {
    super.update(dt);

    // Basic attack cooldown tick
    if (this.attackCooldown > 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    }

    // Cooldown ticks for abilities
    for (const key of Object.keys(this.abilities)) {
      const ab = this.abilities[key];
      if (ab && ab.cooldownRemaining > 0) {
        ab.cooldownRemaining = Math.max(0, ab.cooldownRemaining - dt);
      }
    }

    // Recall channel update
    if (this.isRecalling) {
      this.recallElapsed += dt * 1000;
      if (this.recallElapsed >= 5000) {
        this.isRecalling = false;
        this.recallElapsed = 0;
        this.x = 400; // Fountain center
        this.y = 400;
        this.stop();
      }
    }
  }

// AFTER:
  update(dt = 0.01667) {
    // 1. Dead Hero Lifecycle
    if (this.isDead) {
      // Cooldown ticks for abilities continue ticking while dead
      for (const key of Object.keys(this.abilities)) {
        const ab = this.abilities[key];
        if (ab && ab.cooldownRemaining > 0) {
          ab.cooldownRemaining = Math.max(0, ab.cooldownRemaining - dt);
        }
      }

      // Decrement respawn countdown
      this.respawnTimer = Math.max(0, (this.respawnTimer || 0) - dt);
      if (this.respawnTimer === 0) {
        this.respawn();
      }
      return;
    }

    super.update(dt);

    // Basic attack cooldown tick
    if (this.attackCooldown > 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    }

    // Cooldown ticks for abilities
    for (const key of Object.keys(this.abilities)) {
      const ab = this.abilities[key];
      if (ab && ab.cooldownRemaining > 0) {
        ab.cooldownRemaining = Math.max(0, ab.cooldownRemaining - dt);
      }
    }

    // Recall channel update
    if (this.isRecalling) {
      this.recallElapsed += dt * 1000;
      if (this.recallElapsed >= 5000) {
        this.isRecalling = false;
        this.recallElapsed = 0;
        this.x = 400; // Fountain center
        this.y = 400;
        this.stop();
      }
    }
  }
```

---

## 5. Verification Method

### 5.1 Test Command
Execute:
```pwsh
npm test
```
Baseline: 147 tests pass. All 147 tests must remain passing cleanly with 0 regressions.

### 5.2 Unit Test Assertions
To be added to `tests/unit/heroes.test.js` or `tests/unit/respawn.test.js`:

1. **Respawn Scaling Formula Test**:
   - `calculateRespawnTime(1) === 5.0`
   - `calculateRespawnTime(6) === 10.0`
   - `calculateRespawnTime(12) === 16.0`
   - `calculateRespawnTime() === 5.0` (default parameter)
   - `calculateRespawnTime(-1) === 5.0` (floor guard)

2. **Lethal Damage & Death State Test**:
   - `hero = new HeroEntity({ hp: 680, level: 1 })`
   - `hero.takeDamage(1000)`
   - Assert `hero.hp === 0`
   - Assert `hero.isDead === true`
   - Assert `hero.isAlive() === false`
   - Assert `hero.respawnTimer === 5.0`
   - Assert `hero.respawnDuration === 5.0`

3. **Action Rejection Test**:
   - With dead hero, call `hero.moveTo(1200, 1200)`
   - Assert `hero.targetX === null` and `hero.isMoving === false`
   - Call `hero.setAttackTarget({ id: 'dummy' })`
   - Assert `hero.attackTarget === null`
   - Assert `hero.canMove() === false`
   - Assert `hero.canAttack() === false`
   - Assert `hero.canCast() === false`

4. **Respawn Tick & Fountain Resurrection Test**:
   - Start with dead hero at `(1500, 1500)` with `respawnTimer = 5.0`, `hp = 0`, `mana = 0`, `stunnedUntil = Date.now() + 10000`
   - Call `hero.update(2.5)`
   - Assert `hero.respawnTimer === 2.5` and `hero.isDead === true`
   - Call `hero.update(2.5)`
   - Assert `hero.respawnTimer === 0` and `hero.isDead === false`
   - Assert `hero.isAlive() === true`
   - Assert `hero.x === 400` and `hero.y === 400`
   - Assert `hero.hp === hero.maxHp` and `hero.mana === hero.maxMana`
   - Assert `hero.stunnedUntil === 0` (clean status)
   - Assert `hero.canMove() === true`
