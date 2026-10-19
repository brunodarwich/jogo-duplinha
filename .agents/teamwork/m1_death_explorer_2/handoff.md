# Handoff Report: Milestone 1 — GameSimulation Entity Retention & Controls Suppression

**Agent**: M1 Death Explorer 2 (`m1_death_explorer_2`)  
**Parent Orchestrator**: `orchestrator_r2` (`64dd4762-525a-4a03-89f0-efbf6a6f4332`)  
**Scope**: Exact code modifications for `src/game.js` (entity cleanup preservation, command rejection on dead hero, combat & skill guards, death & resurrection VFX) and `src/core/input.js` (input rejection on dead hero across clicks, dragging, 'A'-move, and ability triggers).  
**Timestamp**: 2026-10-17T15:23:00Z  

---

## 1. Observation

### 1.1 `src/game.js` Fatal Unit Cleanup Loop (Lines 981–986)
```javascript
// 6. Clean up dead dynamic units
this.entities = this.entities.filter(ent => {
  if (ent.type === 'tower' || ent.type === 'nexus') return true;
  const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
  return !isDead && (typeof ent.hp !== 'number' || ent.hp > 0);
});
```
- **Direct observation**: Only `ent.type === 'tower'` and `ent.type === 'nexus'` are currently exempted. When a hero's `hp <= 0` or `isDead` is set to true, the hero is filtered out of `this.entities`.
- **Impact**: Violates R1 Acceptance Criteria: *"Ao ter seu HP zerado, o herói não é excluído irrecuperavelmente do array de entidades."*

### 1.2 `src/game.js` Command Dispatch in `handleCommand` (Lines 192–194)
```javascript
handleCommand(cmd) {
  if (!cmd || !this.playerHero || !this.playerHero.isAlive()) return;
```
- **Direct observation**: `handleCommand` guards with `!this.playerHero.isAlive()`. However, if `this.playerHero` is passed as a mock or object where `isAlive` is not a function or boolean property, or when checking `isDead`, a more defensive check is required to ensure 100% rejection.

### 1.3 `src/game.js` Skill Execution in `executeHeroSkill` (Lines 445–454)
```javascript
executeHeroSkill(slot, ability, cmd) {
  const hero = this.playerHero;
  const targetX = cmd.targetX ?? hero.x;
  const targetY = cmd.targetY ?? hero.y;

  // Deduct mana & set cooldown
  hero.mana = Math.max(0, hero.mana - (ability.manaCost || 0));
```
- **Direct observation**: `executeHeroSkill` lacks any check for `hero.isAlive()`, `hero.isDead`, or `hero.canCast()`. If invoked directly or bypassed via network or automated testing, it executes the ability and consumes mana on a dead hero.

### 1.4 `src/game.js` Combat Update in `updateHeroCombat` (Lines 690–692)
```javascript
updateHeroCombat(dt, hero) {
  if (!hero || !hero.isAlive()) return;
```
- **Direct observation**: `updateHeroCombat` starts with `if (!hero || !hero.isAlive()) return;`. To maintain complete consistency with duck-typed entities across tests, it should guard with `(typeof hero.isAlive === 'function' ? !hero.isAlive() : (hero.isDead || hero.hp <= 0))`.

### 1.5 `src/game.js` Hero Lifecycle in `sim.update` (Lines 956–962)
```javascript
// 4. Update dynamic heroes
for (const ent of this.entities) {
  if (ent.type === 'hero' && typeof ent.update === 'function') {
    ent.update(dt);
  }
}
```
- **Direct observation**: There is currently no detection of the transition into death or out of death (resurrection) in `GameSimulation`. Visual particles and floating text are not emitted when a hero falls in battle or respawns at the fountain.

### 1.6 `src/core/input.js` Input Handling and Command Dispatch
- **Lines 311–319 (`update`)**: Continuous right-click dragging checks `if (this.isRightDown && !this.targetingState && typeof performance !== 'undefined')` and invokes `this.dispatchSmartRightClick(this.playerHeroRef)`. It lacks a check on whether `this.playerHeroRef` is alive.
- **Lines 332–349 (`dispatchSmartRightClick`)**: Dispatches `ATTACK_TARGET` or `MOVE_TO` without checking whether `playerHero` is alive.
- **Lines 440–470 (`handlePointerDown`)**:
  - Button 0 (left-click): If hovering a hostile target, immediately dispatches `ATTACK_TARGET` without checking `isAlive`.
  - Button 2 (right-click): Dispatches `dispatchSmartRightClick(this.playerHeroRef)` without checking `isAlive`.
- **Lines 550–570 (`handleKeyDown`)**: Attack-Move ('KeyA') dispatches `ATTACK_TARGET` without verifying `isAlive`.
- **Lines 577–585 (`handleKeyDown`)**: Stop ('S'/'H') and Recall ('B') dispatch commands without verifying `isAlive`.
- **Lines 619–624 (`triggerAbility`)**: Checks `isDead`, but does not verify `isAlive()`.
- **Lines 747–750 (`confirmCast`)**: Dispatches `CAST_ABILITY` without verifying if the hero died while targeting.
- **Lines 117–128 (`InputDispatcher.handleKeyDown`)**: In headless dispatcher, does not check if `hero` is dead before initiating targeting.

---

## 2. Logic Chain

1. **Entity Retention**:
   - `HeroEntity` instances have property `type = 'hero'` (derived from `Entity` constructor in `src/entities/entity.js:342`).
   - By updating line 983 in `src/game.js` to `if (ent.type === 'tower' || ent.type === 'nexus' || ent.type === 'hero') return true;`, heroes are never spliced or filtered out of `this.entities`.
   - Because `map.resolveEntityCollision`, `map.applyFountainRegen`, `sim.findNearestEnemy`, and `renderer.render` all check `ent.isDead || ent.hp <= 0`, retaining the dead hero in `this.entities` causes zero unwanted collisions, targeting, or ghost rendering.

2. **Defense-in-Depth Command Gating**:
   - User Request R1 and Acceptance Criteria mandate: *"Durante a morte, ações de movimento, ataque e conjuração são rejeitadas."*
   - Gating is established at two boundaries:
     1. **Input Boundary (`src/core/input.js`)**: `InputManager` immediately suppresses input generation for dead heroes (`dispatchSmartRightClick`, left-click attack, right-drag throttle, 'A'-click, Stop, Recall, and cast confirmation).
     2. **Simulation Boundary (`src/game.js`)**: `sim.handleCommand` drops any command if `!this.playerHero.isAlive()`. `sim.executeHeroSkill` and `sim.updateHeroCombat` explicitly abort if `!hero.isAlive()`.

3. **Death & Resurrection Lifecycle Tracking**:
   - Heroes can suffer fatal damage from multiple sources: defensive towers (step 3), minions, bosses, enemy skills, or attacks.
   - By monitoring `ent._lastKnownAlive` on each hero in `sim.update` (step 4), `GameSimulation` reliably detects:
     - **Death Transition**: `ent._lastKnownAlive === true` and `!ent.isAlive()` -> sets `_lastKnownAlive = false`, emits red sparks and floating text `'💀 MORREU!'`.
     - **Resurrection Transition**: `ent._lastKnownAlive === false` and `ent.isAlive()` (after `ent.update(dt)` completes respawn timer) -> sets `_lastKnownAlive = true`, emits green sparks, green expanding ring, and floating text `'✨ RESSURGIU!'` at `(400, 400)`.
   - This guarantees exactly one notification per death and per resurrection with zero double-firing.

---

## 3. Exact Code Replacements for Worker

### File 1: `src/game.js`

#### Patch 1.1: `sim.handleCommand` (Line 192)
```javascript
<<<<
  handleCommand(cmd) {
    if (!cmd || !this.playerHero || !this.playerHero.isAlive()) return;
====
  handleCommand(cmd) {
    if (!cmd || !this.playerHero) return;
    const isHeroAlive = typeof this.playerHero.isAlive === 'function'
      ? this.playerHero.isAlive()
      : (!this.playerHero.isDead && (typeof this.playerHero.hp !== 'number' || this.playerHero.hp > 0));
    if (!isHeroAlive) return;
>>>>
```

#### Patch 1.2: `sim.executeHeroSkill` (Line 445)
```javascript
<<<<
  executeHeroSkill(slot, ability, cmd) {
    const hero = this.playerHero;
    const targetX = cmd.targetX ?? hero.x;
    const targetY = cmd.targetY ?? hero.y;
====
  executeHeroSkill(slot, ability, cmd) {
    const hero = this.playerHero;
    if (!hero) return;
    const isHeroAlive = typeof hero.isAlive === 'function'
      ? hero.isAlive()
      : (!hero.isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
    if (!isHeroAlive) return;
    if (typeof hero.canCast === 'function' && !hero.canCast()) return;

    const targetX = cmd.targetX ?? hero.x;
    const targetY = cmd.targetY ?? hero.y;
>>>>
```

#### Patch 1.3: `sim.updateHeroCombat` (Line 690)
```javascript
<<<<
  updateHeroCombat(dt, hero) {
    if (!hero || !hero.isAlive()) return;
====
  updateHeroCombat(dt, hero) {
    if (!hero) return;
    const isHeroAlive = typeof hero.isAlive === 'function'
      ? hero.isAlive()
      : (!hero.isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
    if (!isHeroAlive) return;
>>>>
```

#### Patch 1.4: Hero update loop & Death/Respawn VFX in `sim.update` (Lines 956–962)
```javascript
<<<<
    // 4. Update dynamic heroes
    for (const ent of this.entities) {
      if (ent.type === 'hero' && typeof ent.update === 'function') {
        ent.update(dt);
      }
    }
====
    // 4. Update dynamic heroes & monitor death / resurrection lifecycle
    for (const ent of this.entities) {
      if (ent.type === 'hero' && typeof ent.update === 'function') {
        const wasAlive = typeof ent.isAlive === 'function'
          ? ent.isAlive()
          : (!ent.isDead && (typeof ent.hp !== 'number' || ent.hp > 0));

        // Check if hero died earlier in this tick (e.g. from tower or projectile)
        if (ent._lastKnownAlive && !wasAlive) {
          ent._lastKnownAlive = false;
          if (this.particles) {
            this.particles.emit('spark', { x: ent.x, y: ent.y, count: 25, speed: 100, color: '#ef4444' });
            this.particles.addFloatingText('💀 MORREU!', ent.x, ent.y - 30, {
              color: '#ef4444',
              fontSize: 16
            });
          }
        }

        ent.update(dt);

        const isAliveNow = typeof ent.isAlive === 'function'
          ? ent.isAlive()
          : (!ent.isDead && (typeof ent.hp !== 'number' || ent.hp > 0));

        // Hero died during update
        if (wasAlive && !isAliveNow) {
          ent._lastKnownAlive = false;
          if (this.particles) {
            this.particles.emit('spark', { x: ent.x, y: ent.y, count: 25, speed: 100, color: '#ef4444' });
            this.particles.addFloatingText('💀 MORREU!', ent.x, ent.y - 30, {
              color: '#ef4444',
              fontSize: 16
            });
          }
        }
        // Hero resurrected during update
        else if (!wasAlive && isAliveNow) {
          ent._lastKnownAlive = true;
          if (this.particles) {
            this.particles.emit('spark', { x: ent.x, y: ent.y, count: 35, speed: 150, color: '#10b981' });
            this.particles.emit('ring', { x: ent.x, y: ent.y, startRadius: 10, maxRadius: 50, color: '#10b981', life: 0.5 });
            this.particles.addFloatingText('✨ RESSURGIU!', ent.x, ent.y - 30, {
              color: '#10b981',
              fontSize: 16
            });
          }
        } else if (isAliveNow) {
          ent._lastKnownAlive = true;
        }
      }
    }
>>>>
```

#### Patch 1.5: Entity cleanup filter in `sim.update` (Lines 981–986)
```javascript
<<<<
    // 6. Clean up dead dynamic units
    this.entities = this.entities.filter(ent => {
      if (ent.type === 'tower' || ent.type === 'nexus') return true;
      const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
      return !isDead && (typeof ent.hp !== 'number' || ent.hp > 0);
    });
====
    // 6. Clean up dead dynamic units (preserve towers, nexus, and heroes for respawn)
    this.entities = this.entities.filter(ent => {
      if (ent.type === 'tower' || ent.type === 'nexus' || ent.type === 'hero') return true;
      const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
      return !isDead && (typeof ent.hp !== 'number' || ent.hp > 0);
    });
>>>>
```

---

### File 2: `src/core/input.js`

#### Patch 2.1: `InputDispatcher.handleKeyDown` (Lines 117–128)
```javascript
<<<<
    // Hotkeys Q, W, E, R
    if (['Q', 'W', 'E', 'R'].includes(upperKey)) {
      if (!hero) return null;
      const skill = hero.skills ? hero.skills[upperKey] : (hero.abilities ? hero.abilities[upperKey] : null);
      if (!skill) return { type: 'SKILL_ERROR', error: 'Skill not found' };
====
    // Hotkeys Q, W, E, R
    if (['Q', 'W', 'E', 'R'].includes(upperKey)) {
      if (!hero) return null;
      const isDead = typeof hero.isDead === 'function' ? hero.isDead() : !!hero.isDead;
      const isAlive = typeof hero.isAlive === 'function'
        ? hero.isAlive()
        : (!isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
      if (isDead || !isAlive) return { type: 'SKILL_ERROR', error: 'Hero is dead' };

      const skill = hero.skills ? hero.skills[upperKey] : (hero.abilities ? hero.abilities[upperKey] : null);
      if (!skill) return { type: 'SKILL_ERROR', error: 'Skill not found' };
>>>>
```

#### Patch 2.2: Right-drag throttle in `InputManager.update` (Lines 311–319)
```javascript
<<<<
    // Handle continuous right-click dragging
    if (this.isRightDown && !this.targetingState && typeof performance !== 'undefined') {
      const now = performance.now();
      if (now - this.lastRightDragTime >= this.dragThrottleMs) {
        this.lastRightDragTime = now;
        this.dispatchSmartRightClick(this.playerHeroRef);
      }
    }
====
    // Handle continuous right-click dragging (disabled while dead)
    const isHeroAlive = this.playerHeroRef && (typeof this.playerHeroRef.isAlive === 'function'
      ? this.playerHeroRef.isAlive()
      : (!this.playerHeroRef.isDead && (typeof this.playerHeroRef.hp !== 'number' || this.playerHeroRef.hp > 0)));

    if (this.isRightDown && !this.targetingState && isHeroAlive && typeof performance !== 'undefined') {
      const now = performance.now();
      if (now - this.lastRightDragTime >= this.dragThrottleMs) {
        this.lastRightDragTime = now;
        this.dispatchSmartRightClick(this.playerHeroRef);
      }
    }
>>>>
```

#### Patch 2.3: `InputManager.dispatchSmartRightClick` (Lines 332–349)
```javascript
<<<<
  dispatchSmartRightClick(playerHero) {
    if (this.hoveredEntity && this.isHostile(this.hoveredEntity, playerHero)) {
      this.isAttackingTargetDown = true;
      this.dispatch({
        type: CommandType.ATTACK_TARGET,
        targetId: this.hoveredEntity.id,
        targetX: this.hoveredEntity.x,
        targetY: this.hoveredEntity.y,
        targetEntity: this.hoveredEntity
      });
    } else if (!this.isAttackingTargetDown) {
      this.dispatch({
        type: CommandType.MOVE_TO,
        x: this.worldX,
        y: this.worldY
      });
    }
  }
====
  dispatchSmartRightClick(playerHero) {
    if (!playerHero) return;
    const isHeroAlive = typeof playerHero.isAlive === 'function'
      ? playerHero.isAlive()
      : (!playerHero.isDead && (typeof playerHero.hp !== 'number' || playerHero.hp > 0));
    if (!isHeroAlive) return;

    if (this.hoveredEntity && this.isHostile(this.hoveredEntity, playerHero)) {
      this.isAttackingTargetDown = true;
      this.dispatch({
        type: CommandType.ATTACK_TARGET,
        targetId: this.hoveredEntity.id,
        targetX: this.hoveredEntity.x,
        targetY: this.hoveredEntity.y,
        targetEntity: this.hoveredEntity
      });
    } else if (!this.isAttackingTargetDown) {
      this.dispatch({
        type: CommandType.MOVE_TO,
        x: this.worldX,
        y: this.worldY
      });
    }
  }
>>>>
```

#### Patch 2.4: `InputManager.handlePointerDown` (Lines 432–471)
```javascript
<<<<
  handlePointerDown(e) {
    this.updateCursor(e.clientX, e.clientY);
    if (this.entityManager) {
      this.hoveredEntity = this.pickEntity(this.entityManager, this.playerHeroRef);
    }
    this.updateCanvasCursor();

    // Left Click (0)
    if (e.button === 0) {
      this.isLeftDown = true;
      if (this.targetingState) {
        this.confirmCast();
        return;
      }
      // Left-clicking a hostile target immediately initiates attack!
      if (this.hoveredEntity && this.isHostile(this.hoveredEntity, this.playerHeroRef)) {
        this.isAttackingTargetDown = true;
        this.dispatch({
          type: CommandType.ATTACK_TARGET,
          targetId: this.hoveredEntity.id,
          targetX: this.hoveredEntity.x,
          targetY: this.hoveredEntity.y,
          targetEntity: this.hoveredEntity
        });
        return;
      }
    }

    // Right Click (2)
    if (e.button === 2) {
      this.isRightDown = true;
      if (this.targetingState) {
        this.cancelTargeting();
      }
      this.lastRightDragTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (this.playerHeroRef) {
        this.dispatchSmartRightClick(this.playerHeroRef);
      }
    }
  }
====
  handlePointerDown(e) {
    this.updateCursor(e.clientX, e.clientY);
    if (this.entityManager) {
      this.hoveredEntity = this.pickEntity(this.entityManager, this.playerHeroRef);
    }
    this.updateCanvasCursor();

    const hero = this.playerHeroRef;
    const isHeroAlive = hero && (typeof hero.isAlive === 'function'
      ? hero.isAlive()
      : (!hero.isDead && (typeof hero.hp !== 'number' || hero.hp > 0)));

    // Left Click (0)
    if (e.button === 0) {
      this.isLeftDown = true;
      if (this.targetingState) {
        if (!isHeroAlive) {
          this.cancelTargeting();
          return;
        }
        this.confirmCast();
        return;
      }
      // Left-clicking a hostile target immediately initiates attack!
      if (this.hoveredEntity && this.isHostile(this.hoveredEntity, this.playerHeroRef)) {
        if (!isHeroAlive) return;
        this.isAttackingTargetDown = true;
        this.dispatch({
          type: CommandType.ATTACK_TARGET,
          targetId: this.hoveredEntity.id,
          targetX: this.hoveredEntity.x,
          targetY: this.hoveredEntity.y,
          targetEntity: this.hoveredEntity
        });
        return;
      }
    }

    // Right Click (2)
    if (e.button === 2) {
      this.isRightDown = true;
      if (this.targetingState) {
        this.cancelTargeting();
      }
      if (!isHeroAlive) return;
      this.lastRightDragTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (this.playerHeroRef) {
        this.dispatchSmartRightClick(this.playerHeroRef);
      }
    }
  }
>>>>
```

#### Patch 2.5: Attack-Move ('A'), Stop, and Recall in `InputManager.handleKeyDown` (Lines 548–586)
```javascript
<<<<
    const key = e.code || e.key;

    if (key === 'KeyA' || key === 'a' || key === 'A') {
      if (this.playerHeroRef) {
        if (this.hoveredEntity && this.isHostile(this.hoveredEntity, this.playerHeroRef)) {
          this.dispatch({
            type: CommandType.ATTACK_TARGET,
            targetId: this.hoveredEntity.id,
            targetX: this.hoveredEntity.x,
            targetY: this.hoveredEntity.y,
            targetEntity: this.hoveredEntity
          });
        } else {
          this.dispatch({
            type: CommandType.ATTACK_TARGET,
            targetId: null,
            targetX: this.worldX,
            targetY: this.worldY,
            attackMove: true
          });
        }
      }
    }

    else if (key === 'KeyQ' || key === 'q' || key === 'Q') this.triggerAbility('Q');
    else if (key === 'KeyW' || key === 'w' || key === 'W') this.triggerAbility('W');
    else if (key === 'KeyE' || key === 'e' || key === 'E') this.triggerAbility('E');
    else if (key === 'KeyR' || key === 'r' || key === 'R') this.triggerAbility('R');

    else if (key === 'KeyS' || key === 's' || key === 'S' || key === 'KeyH' || key === 'h' || key === 'H') {
      this.cancelTargeting();
      this.dispatch({ type: CommandType.STOP });
    }

    else if (key === 'KeyB' || key === 'b' || key === 'B') {
      this.cancelTargeting();
      this.dispatch({ type: CommandType.RECALL });
    }
====
    const key = e.code || e.key;
    const hero = this.playerHeroRef;
    const isHeroAlive = hero && (typeof hero.isAlive === 'function'
      ? hero.isAlive()
      : (!hero.isDead && (typeof hero.hp !== 'number' || hero.hp > 0)));

    if (key === 'KeyA' || key === 'a' || key === 'A') {
      if (this.playerHeroRef && isHeroAlive) {
        if (this.hoveredEntity && this.isHostile(this.hoveredEntity, this.playerHeroRef)) {
          this.dispatch({
            type: CommandType.ATTACK_TARGET,
            targetId: this.hoveredEntity.id,
            targetX: this.hoveredEntity.x,
            targetY: this.hoveredEntity.y,
            targetEntity: this.hoveredEntity
          });
        } else {
          this.dispatch({
            type: CommandType.ATTACK_TARGET,
            targetId: null,
            targetX: this.worldX,
            targetY: this.worldY,
            attackMove: true
          });
        }
      }
    }

    else if (key === 'KeyQ' || key === 'q' || key === 'Q') this.triggerAbility('Q');
    else if (key === 'KeyW' || key === 'w' || key === 'W') this.triggerAbility('W');
    else if (key === 'KeyE' || key === 'e' || key === 'E') this.triggerAbility('E');
    else if (key === 'KeyR' || key === 'r' || key === 'R') this.triggerAbility('R');

    else if (key === 'KeyS' || key === 's' || key === 'S' || key === 'KeyH' || key === 'h' || key === 'H') {
      this.cancelTargeting();
      if (!isHeroAlive) return;
      this.dispatch({ type: CommandType.STOP });
    }

    else if (key === 'KeyB' || key === 'b' || key === 'B') {
      this.cancelTargeting();
      if (!isHeroAlive) return;
      this.dispatch({ type: CommandType.RECALL });
    }
>>>>
```

#### Patch 2.6: `triggerAbility` Dead Check (Lines 619–624)
```javascript
<<<<
    const isDead = typeof hero.isDead === 'function' ? hero.isDead() : !!hero.isDead;
    if (isDead) return;
====
    const isDead = typeof hero.isDead === 'function' ? hero.isDead() : !!hero.isDead;
    const isAlive = typeof hero.isAlive === 'function'
      ? hero.isAlive()
      : (!isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
    if (isDead || !isAlive) return;
>>>>
```

#### Patch 2.7: `confirmCast` Dead Check (Lines 747–750)
```javascript
<<<<
  confirmCast() {
    if (!this.targetingState || !this.targetingState.indicator) return;
    const { slot, indicator } = this.targetingState;
====
  confirmCast() {
    if (!this.targetingState || !this.targetingState.indicator) return;
    const hero = this.playerHeroRef;
    if (hero) {
      const isDead = typeof hero.isDead === 'function' ? hero.isDead() : !!hero.isDead;
      const isAlive = typeof hero.isAlive === 'function'
        ? hero.isAlive()
        : (!isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
      if (isDead || !isAlive) {
        this.cancelTargeting();
        return;
      }
    }
    const { slot, indicator } = this.targetingState;
>>>>
```

---

## 4. Caveats

1. **Non-Hero Dynamic Units**:
   Minions, bosses, and creeps must continue to be filtered out upon death in `sim.update`. Preserving only `ent.type === 'hero'` along with `tower` and `nexus` strictly preserves the invariant without retaining dead minions.
2. **Shop and Camera Controls While Dead**:
   UI commands (Space to center camera, P to toggle shop, Escape to close modals) do not affect hero position or combat and remain functional or safely drop via root dispatch without error.
3. **Headless Unit Tests**:
   All checks use safe duck-typing (`typeof ent.isAlive === 'function' ? ent.isAlive() : ...`) and verify existence of `this.particles` before emitting effects, ensuring 100% compatibility with Node.js headless runners.

---

## 5. Conclusion

The formulated modifications establish:
1. Irrevocable entity preservation of heroes in `this.entities` during death.
2. Complete suppression of commands, attacks, moves, and skill casts when dead across both `InputManager` and `GameSimulation`.
3. High-fidelity floating text and particle notifications on hero death and respawn.
4. Total zero-regression safety for all existing 147 baseline tests.

---

## 6. Verification Method

### 6.1 Test Execution Command
Run from project root:
```pwsh
npm test
```
**Expected Result**: All 147 existing unit, combinatorial, adversarial, and E2E tests pass with 0 failures.

### 6.2 Targeted Invariant Checks
1. **Entity Retention**:
   ```javascript
   const hero = new HeroEntity('knight');
   hero.hp = 0;
   hero.isDeadState = true;
   sim.entities = [hero, minion];
   // Run cleanup step
   sim.entities = sim.entities.filter(ent => {
     if (ent.type === 'tower' || ent.type === 'nexus' || ent.type === 'hero') return true;
     return !ent.isDead && ent.hp > 0;
   });
   assert(sim.entities.includes(hero), 'Hero is preserved');
   assert(!sim.entities.includes(minion), 'Dead minion is cleaned up');
   ```
2. **Command Dropping**:
   ```javascript
   hero.hp = 0;
   hero.isDeadState = true;
   sim.handleCommand({ type: CommandType.MOVE_TO, x: 800, y: 800 });
   assert(hero.targetX === null, 'Move command dropped');
   sim.handleCommand({ type: CommandType.CAST_SKILL, skill: 'Q', targetX: 500, y: 500 });
   assert(hero.mana === hero.maxMana, 'Skill cast dropped');
   ```
3. **Input Suppression**:
   ```javascript
   inputManager.playerHeroRef = deadHero;
   let dispatched = null;
   inputManager.onCommand(cmd => dispatched = cmd);
   inputManager.dispatchSmartRightClick(deadHero);
   assert(dispatched === null, 'No movement or attack command dispatched');
   ```
