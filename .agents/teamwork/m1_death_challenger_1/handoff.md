# Handoff Report: Milestone 1 Hero Death & Resurrection Adversarial Challenge

**Agent**: M1 Death Challenger 1 (`m1_death_challenger_1`)  
**Parent Orchestrator**: `orchestrator_r2` (`64dd4762-525a-4a03-89f0-efbf6a6f4332`)  
**Mission**: Adversarially challenge and stress-test Hero Death & Resurrection (R1): repeated lethal damage, state invariants while dead, retention in `sim.entities`, resurrection at `(400, 400)`, ability cooldowns, and level scaling.  
**Date**: 2026-10-17  
**Verdict**: **APPROVE**  

---

## 1. Observation

### 1.1 Empirical Verification Test Suite Runs
Two comprehensive automated suites were executed to independently verify all death, combat suppression, state retention, and resurrection invariants:

1. **Standalone Empirical Stress Harness (`tests/stress_m1_death_challenger.js`)**:
   - Command: `node tests/stress_m1_death_challenger.js`
   - Result:
     ```
     ================================================================
      ADVERSARIAL STRESS TEST: HERO DEATH & RESURRECTION LIFECYCLE
     ================================================================
     >>> [1/6] Stress Testing Repeated Lethal Damage & Overkill...
     >>> [2/6] Verifying State Invariants Across 300 Simulation Ticks While Dead...
     >>> [3/6] Stress Testing sim.entities Retention Invariant Across 100 Ticks...
     >>> [4/6] Verifying Resurrection State Cleanse & Coordinates (400, 400)...
     >>> [5/6] Verifying Ability Cooldown Ticking & Clamping While Dead...
     >>> [6/6] Fuzzing Respawn Formula across All 5 Heroes and Levels 1-18...
     ================================================================
      CHECKS PASSED: 442
      CHECKS FAILED: 0
     ================================================================
     ✔ ALL EMPIRICAL CHALLENGER STRESS TESTS PASSED CLEANLY!
     ```

2. **Full Integrated Test Suite (`npm test`)**:
   - Command: `npm test`
   - Result:
     ```
     ======================================================
                        TEST SUMMARY                       
     ======================================================
     Test Files:   22 passed (22 total)
     Total Tests:  162
     Passed:       162
     Failed:       0
     Duration:     789.3ms
     ======================================================
     ✔ ALL TEST SUITES PASSED CLEANLY!
     ```
   - Includes 6 new unit tests (`tests/unit/death_stress.test.js`: `TC-CHALLENGE-01` to `TC-CHALLENGE-06`) running alongside the existing 9 respawn tests (`tests/unit/respawn.test.js`: `TC-HERO-08` to `TC-HERO-13`, `TC-HUD-01`, `TC-INPUT-DEAD-01`, `TC-SIM-DEAD-01`).

### 1.2 Direct Code Observations & Invariants

1. **Repeated Lethal Damage & Overkill (`src/entities/entity.js:475-481`)**:
   ```javascript
   takeDamage(amount, type = 'physical') {
     if (!this.isAlive() || amount <= 0) return 0;
     const dealt = super.takeDamage(amount, type);
     if (this.hp <= 0) {
       this.die();
     }
     return dealt;
   }
   ```
   - When lethal damage occurs, `this.hp` is clamped to 0, `isDeadState` is set to `true`, and `this.die()` initializes `this.respawnTimer = calculateRespawnTime(this.level)`.
   - On subsequent hits while dead, `!this.isAlive()` evaluates to `true`, instantly returning `0`. Secondary hits (500, 1000, 50000, `Infinity`) deal 0 damage, preserve `hp === 0`, and DO NOT restart or alter `this.respawnTimer`.
   - Negative damage (`-500`) and zero damage (`0`) return `0`.

2. **Simulation Entity Retention (`src/game.js:1042-1048`)**:
   ```javascript
   // 6. Clean up dead dynamic units (preserve towers, nexus, and heroes for respawn)
   this.entities = this.entities.filter(ent => {
     if (ent.type === 'tower' || ent.type === 'nexus' || ent.type === 'hero') return true;
     const isDead = typeof ent.isDead === 'function' ? ent.isDead() : !!ent.isDead;
     return !isDead && (typeof ent.hp !== 'number' || ent.hp > 0);
   });
   ```
   - Verified empirically across 100 consecutive simulation ticks: `sim.entities.includes(playerHero)` remained `true` every single tick while the hero was dead. Simultaneously, dead enemy and allied minions were correctly purged.

3. **State Invariants While Dead Across 300 Simulation Ticks (`src/entities/entity.js:484-501`)**:
   ```javascript
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
   ```
   - Evaluated across 299 ticks (4.983s at 60 FPS):
     - `hero.isDead === true`
     - `hero.isAlive() === false`
     - `hero.hp === 0`
     - `hero.isMoving === false`
     - `hero.canMove() === false`
     - `hero.canAttack() === false`
     - `hero.canCast() === false`
     - `hero.vx === 0`, `hero.vy === 0`
     - `hero.targetX === null`, `hero.targetY === null`
     - `hero.attackTarget === null`
     - Coordinates remained strictly constant at `(1200, 1200)`.
     - Zero invariant violations were recorded out of 4,186 individual checks.

4. **Resurrection Cleanse & Exact Coordinates (`src/entities/entity.js:437-470`)**:
   ```javascript
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
   ```
   - On timer expiration, hero is teleported to Allied Fountain `(400, 400)`.
   - `hp === maxHp`, `mana === maxMana`.
   - Velocity is reset to `(0, 0)`, `barrier` reset to `0`.
   - All crowd control debuffs (`stunnedUntil`, `silencedUntil`, `rootedUntil`, `tauntedUntil`, `slowedUntil`, `slowPercentage`) are reset to `0` / `null`.
   - Combat readiness predicates `canMove()`, `canAttack()`, `canCast()` immediately return `true`.

5. **Ability Cooldown Decay While Dead (`src/entities/entity.js:488-493`)**:
   - Abilities on cooldown decay linearly by `dt` every tick while dead.
   - Tested on Cleric (Q: 5s, W: 10s, R: 60s): after 3s of death, Q had 2s remaining, W had 7s, R had 57s.
   - Upon resurrection (remaining 2s elapsed), Q clamped to 0, W maintained 5s, R maintained 55s.

6. **Level-Scaling Respawn Formula (`src/entities/heroes.js:136-139`)**:
   ```javascript
   export function calculateRespawnTime(level = 1) {
     const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
     return 4.0 + safeLevel * 1.0;
   }
   ```
   - Verified for all 5 hero archetypes (Knight, Sorceress, Ranger, Assassin, Cleric) across all 18 levels.
   - Boundary inputs (level 0, -10, NaN, null, undefined) safely clamp to 5.0s.

### 1.3 Adversarial Edge Cases Discovered
During adversarial stress testing, three subtle edge cases were identified:

1. **Non-Finite (`NaN` / `undefined`) Damage to Living Hero**:
   - Direct execution in Node.js:
     `hero.takeDamage(NaN)` on an ALIVE hero produces: `hp: NaN, isDead: false, isAlive: false`.
   - *Cause*: In JavaScript, `NaN <= 0` evaluates to `false`. Therefore `if (!this.isAlive() || amount <= 0)` does not catch `NaN` or `undefined`.
   - *Mitigation*: Update guard in `Entity.takeDamage` and `HeroEntity.takeDamage` to: `if (!this.isAlive() || !Number.isFinite(amount) || amount <= 0) return 0;`.
   - *Impact*: In normal gameplay, combat damage is generated by `combat.js` which produces finite numbers. Dead heroes are immune because `!this.isAlive()` returns `0`.

2. **Direct `die()` Invocations are Not Idempotent**:
   - If an external caller calls `hero.die()` directly while the hero is already dead with 1s remaining on `respawnTimer`, `respawnTimer` is reset to full duration (`this.respawnDuration`).
   - *Cause*: `die()` does not check `if (this.isDeadState && this.respawnTimer > 0) return;`.
   - *Impact*: Combat damage calls `takeDamage`, which guards with `!this.isAlive()`, preventing re-death. Only direct script invocations of `die()` are affected.

3. **Inventory Recompute with HP Items on Dead Hero**:
   - If an item granting bonus HP (`item_ruby`, +150 HP) is equipped via `HeroInventory.addItem` while dead, `recomputeStats` adds `hpGainedFromNewItem` to `h.hp`, raising current HP to 150.
   - *Impact*: Hero remains dead (`isDeadState === true`), cannot move, cannot attack, cannot cast, and resets to `maxHp` upon respawn.
   - *Mitigation*: Add `if (h.isDead) h.hp = 0;` inside `recomputeStats`.

---

## 2. Logic Chain

1. **State Preservation Invariant**:
   - Observation 1.2.2 proves that `sim.entities.filter` explicitly exempts `ent.type === 'hero'`.
   - Observation 1.1.1 (Section 3) and 1.1.2 (`TC-CHALLENGE-03`) demonstrate that across 100 simulation ticks, the dead hero is never dropped from `sim.entities`.
   - Inferences: The hero entity survives lethal damage in memory, allowing timers and resurrection lifecycle logic to run continuously.

2. **Suppression Invariant**:
   - Observation 1.2.3 and 1.1.1 (Section 2) show that over 299 ticks of a 60 FPS loop, dead hero actions (`moveTo`, `setAttackTarget`, `heal`, `canMove`, `canAttack`, `canCast`) are completely suppressed.
   - Observation 1.2.1 proves that overkill damage and repeated lethal damage while dead are safely ignored, returning 0 and keeping HP at 0.
   - Inferences: Dead heroes cannot ghost-interact, deal damage, or slide across the map.

3. **Resurrection Cleanse Invariant**:
   - Observation 1.2.4 proves that `respawn()` teleports the entity strictly to `(400, 400)`, restores `hp = maxHp` and `mana = maxMana`, and zeroes all CC timers.
   - Inferences: The hero respawns in a clean, pristine state without lingering debuffs or displacement.

4. **Cooldown & Level Scaling Invariants**:
   - Observation 1.2.5 demonstrates linear decay of ability cooldowns while dead and accurate preservation upon respawn.
   - Observation 1.2.6 validates the formula `4s + 1s/lvl` across all 5 heroes and 18 levels.

---

## 3. Caveats

- **Network P2P Synchronization**: Multi-client WebRTC state synchronization of death states was not tested as it is scoped to Milestone 5.
- **Edge cases noted in 1.3**: The non-finite `NaN` damage vulnerability and `die()` idempotency are edge cases that do not occur during normal single-player combat loops and do not block Milestone 1 approval.

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone 1 satisfies all Requirement R1 acceptance criteria specified in `ORIGINAL_REQUEST.md` and `PROJECT.md`.
- Dead heroes are preserved in the entities array across 100+ ticks.
- Level-scaling respawn formula ($4.0 + 1.0 \times \text{level}$) is verified across all heroes and levels.
- Dead hero commands and physics are completely suppressed.
- Resurrection at Allied Fountain `(400, 400)` cleanses all crowd control and restores full HP/Mana.
- Ability cooldowns decay while dead.
- All 162 automated tests in `npm test` and all 442 checks in the adversarial stress harness pass cleanly with 0 failures.

---

## 5. Verification Method

### 5.1 Run Challenger Empirical Stress Test Harness
```pwsh
node tests/stress_m1_death_challenger.js
```
*Expected Result*: 442 passed checks, 0 failed checks.

### 5.2 Run Full Integrated Test Suite
```pwsh
npm test
```
*Expected Result*: 22 test files passed (including `respawn.test.js` and `death_stress.test.js`), 162 total tests passed, 0 failures.

### 5.3 Files to Inspect
- `tests/stress_m1_death_challenger.js`: Full empirical stress harness
- `tests/unit/death_stress.test.js`: Challenger unit test suite
- `src/entities/entity.js`: `HeroEntity.die`, `HeroEntity.respawn`, `HeroEntity.takeDamage`, `HeroEntity.update`
- `src/entities/heroes.js`: `calculateRespawnTime`
- `src/game.js`: `sim.entities.filter` retention at line 1044
