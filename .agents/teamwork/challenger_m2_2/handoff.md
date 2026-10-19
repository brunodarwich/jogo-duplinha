# Milestone 2 Empirical Review & Challenge Report

**Agent**: Challenger 2 (`challenger_m2_2`)  
**Working Directory**: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\challenger_m2_2\`  
**Milestone**: Milestone 2 — Minions, Bosses & Game Over  
**Verdict**: **REJECT**  
**Date**: 2026-10-17T01:42:00Z  

---

## 1. Observation

1. **Test Execution & Tool Output**:
   - Primary test runner executed via `run_command`:
     ```bash
     node tests/runner.js
     ```
     **Result**: 17/17 test files passed, 118/118 tests passed, duration 290.8ms.
   - Empirical stress harness authored in `tests/stress_m2_bosses.js` and executed via `run_command`:
     ```bash
     node tests/stress_m2_bosses.js
     ```
     **Result**:
     ```
     ================================================================
      EMPIRICAL STRESS TEST SUMMARY
     ================================================================
     Total Checks Executed: 806
     Passed Checks:         665
     Failed Checks:         141

     >>> EMPIRICAL VERDICT: REJECT <<<
     Failures detected:
      - Wave 1 melee AD scaled to 20
      - Wave 1 ranged AD scaled to 28
      ...
      - Wave 10 ranged AD scaled to 46
      - Wave 11 melee AD scaled to 40
      - Next wave scheduled in future
      - Ally inside is stunned
      - Ally at 219 distance is stunned
      - Target inside is silenced
      - Silence duration is 2.0s (expected ~2, got NaN, diff NaN > 0.1)
      - Target at exact boundary (350) is silenced
     ```

2. **Source Code Observations**:
   - `src/world/minion.js` (lines 240-264):
     ```javascript
     const waveIndex = options.waveIndex || 1;
     const baseStats = MINION_BASE_STATS[subType] || MINION_BASE_STATS.melee;

     const maxHp = baseStats.hp + (waveIndex - 1) * baseStats.hpGrowth;
     const ad = baseStats.ad + (waveIndex - 1) * baseStats.adGrowth;

     super({
       ...
       attackDamage: ad
     });

     this.subType = subType;
     this.waveIndex = waveIndex;
     ...
     ```
     Neither `MinionUnit` nor its superclass `Entity` (`src/entities/entity.js`) assigns `this.attackDamage`. `minion.attackDamage` evaluates strictly to `undefined`.
   - `src/world/minion.js` (lines 409-421):
     ```javascript
     let damage = this.attackDamage;
     if (this.subType === 'cannon' && (this.targetEntity.type === 'tower' || this.targetEntity.type === 'nexus')) {
       damage *= this.structureDamageMultiplier;
     }

     if (this.subType === 'melee') {
       // Direct attack
       if (typeof this.targetEntity.takeDamage === 'function') {
         this.targetEntity.takeDamage(damage, 'physical');
       } else {
         this.targetEntity.hp = Math.max(0, this.targetEntity.hp - damage);
       }
     ```
     Because `this.attackDamage` is `undefined`, `damage` is `undefined`. When executing `this.targetEntity.hp = Math.max(0, this.targetEntity.hp - undefined)`, `targetEntity.hp` becomes `NaN`.
   - `src/world/boss.js` (lines 274-276):
     ```javascript
     if (ent.stunnedUntil !== undefined) {
       ent.stunnedUntil = Date.now() + this.slamStunDuration * 1000;
     }
     ```
     `Entity` (`src/entities/entity.js`) and `HeroEntity` (`src/entities/hero.js`) do not declare `stunnedUntil`. `ent.stunnedUntil` evaluates to `undefined` for all in-game entities. Consequently, the condition `if (ent.stunnedUntil !== undefined)` is always `false`, and Stone Colossus Ground Slam never stuns any player or unit.
   - `src/world/boss.js` (lines 452-454):
     ```javascript
     if (ent.silencedUntil !== undefined) {
       ent.silencedUntil = Date.now() + this.silenceDuration * 1000;
     }
     ```
     `silencedUntil` is uninitialized on all in-game entities. The condition is always `false`, and Abyssal Behemoth Roar of Fear never silences any player or unit.
   - `src/world/minion.js` (lines 570-575):
     ```javascript
     if (this.matchTime >= this.nextWaveTime) {
       this.waveIndex++;
       this.queueWave(this.waveIndex);
       this.nextWaveTime += this.waveInterval;
     }
     ```
     On an extreme lag spike (e.g. dt = 120s), `nextWaveTime` only increments once by `waveInterval` (60s), leaving `nextWaveTime < matchTime`.

---

## 2. Logic Chain

1. **Why Existing Unit Tests Passed (False Confidence)**:
   - `tests/unit/minion.test.js` only checked `getWaveComposition`, `shouldDisengageLeash`, and `resolveMinionDeath`. It never instantiated a `MinionUnit` in combat or checked if `attackDamage` was defined or dealt damage.
   - `tests/unit/boss.test.js` only checked static constants in `BOSS_CONFIGS` and the standalone `SupremeBoss` mock class. It never executed `StoneColossusBoss.update()` or `AbyssalBehemothBoss.update()` against an actual game entity.

2. **Root Cause Analysis of Defect 1 (Minion Attack Damage is Undefined / NaN)**:
   - In `src/world/minion.js`: `MinionUnit` computes `const ad = baseStats.ad + (waveIndex - 1) * baseStats.adGrowth;`.
   - It forwards `attackDamage: ad` to `super(options)`.
   - In `src/entities/entity.js`, `Entity`'s constructor explicitly extracts `radius`, `speed`, `maxHp`, `hp`, `maxMana`, etc., but does NOT assign `this.attackDamage = options.attackDamage` or `this.ad = options.ad`.
   - `MinionUnit` never sets `this.attackDamage = ad` on itself.
   - Direct empirical inspection in Node.js:
     ```
     u.attackDamage: undefined
     target.hp: NaN
     ```
   - When any minion hits another minion, hero, tower, or nexus, `this.attackDamage` is `undefined`, which corrupts target health to `NaN`.

3. **Root Cause Analysis of Defect 2 (Boss CC Stun and Silence are Dead Code)**:
   - In `src/world/boss.js`, lines 274 and 452 guard CC application with `if (ent.stunnedUntil !== undefined)` and `if (ent.silencedUntil !== undefined)`.
   - Neither `src/entities/entity.js` nor `src/entities/hero.js` initializes `stunnedUntil` or `silencedUntil`.
   - As demonstrated empirically:
     ```
     target.silencedUntil: undefined
     allyInside.stunnedUntil: undefined
     ```
   - Because all targets have `undefined` CC fields, both CC abilities fail silently and never apply crowd control.

4. **Robust Features Verified (665 Passed Checks)**:
   - Minion wave spawning interval (60s), 10 consecutive simulated waves, and cannon siege minion inclusion every 3rd wave (waves 3, 6, 9) function properly.
   - Minion leash disengagement strictly at >400 units from waypoint, state transition to `LEASH_RETURN`, target clearing, uninterruptible return, and re-acquisition at <= 50 units all work cleanly.
   - Stone Colossus -40% tower damage reduction works accurately against both base shots (150 * 0.6 = 90) and heat-scaled shots (up to 300 * 0.6 = 180).
   - Abyssal Behemoth acid pool ground hazard duration (6.0s) and tick intervals (0.5s dealing 20 magical damage for 12 ticks = 240 damage) work properly.
   - Supreme Boss 3-phase thresholds (>66%, >33%, <=33%) and Cataclysmic Shield immunity (8.0s damage absorption) function properly.
   - Structure invulnerability hierarchy (`Outer -> Inner -> Supreme Boss -> Enemy Nexus`) correctly protects the Enemy Nexus until the Supreme Boss is slain.
   - Simultaneous Nexus destruction (both Allied and Enemy Nexus falling to 0 on the same frame) resolves authoritatively to DEFEAT without dual-state conflict.

---

## 3. Caveats

- **Scope Boundary**: As Challenger 2 under strict Review-Only constraints, I have not modified implementation code in `src/`. The fixes must be applied by the worker agent (`worker_m2`).
- **Anticipated Fix Surface**:
  1. In `src/world/minion.js` (in `MinionUnit` constructor): Add `this.attackDamage = ad;`.
  2. In `src/world/boss.js` (line 274): Change `if (ent.stunnedUntil !== undefined)` to assign `ent.stunnedUntil = Date.now() + this.slamStunDuration * 1000;` directly (or ensure `ent.stunnedUntil` is initialized on `Entity`).
  3. In `src/world/boss.js` (line 452): Change `if (ent.silencedUntil !== undefined)` to assign `ent.silencedUntil = Date.now() + this.silenceDuration * 1000;` directly.
  4. In `src/world/minion.js` (line 570): In `WaveSpawner.update`, use a `while` loop or catch-up logic so `nextWaveTime` cannot lag behind `matchTime`.

---

## 4. Conclusion

**Verdict: REJECT**

Milestone 2 cannot be approved in its current state due to two high-severity defects:
1. `MinionUnit.attackDamage` is `undefined`, causing all minion auto-attacks to deal `undefined` / `NaN` damage.
2. Wave 5 Stone Colossus Ground Slam Stun (1.5s) and Wave 10 Abyssal Behemoth Roar Silence (2.0s) are dead code due to invalid `!== undefined` guards.

Once the worker fixes these items, re-running `node tests/stress_m2_bosses.js` will verify all 806 checks pass.

---

## 5. Verification Method

To independently reproduce this rejection and inspect the defects:
1. Run the empirical stress harness:
   ```bash
   node tests/stress_m2_bosses.js
   ```
   *Expected Output*: Exit code 1, `>>> EMPIRICAL VERDICT: REJECT <<<`, 141 failed checks.
2. Direct empirical verification of minion attackDamage bug:
   ```bash
   node -e "import('./src/world/minion.js').then(m => { const u = new m.MinionUnit({ subType: 'melee' }); console.log('u.attackDamage:', u.attackDamage); const target = { hp: 100 }; target.hp -= u.attackDamage; console.log('target.hp:', target.hp); });"
   ```
   *Output*: `u.attackDamage: undefined`, `target.hp: NaN`.
3. Direct empirical verification of boss CC dead-code bug:
   ```bash
   node -e "import('./src/world/boss.js').then(m => { const b = new m.AbyssalBehemothBoss({ x: 2000, y: 2000 }); b.roarTimer = 0; const target = { id: 'p', team: 'allied', x: 2100, y: 2000, hp: 1000 }; b.update(0.01667, [b, target]); console.log('target.silencedUntil:', target.silencedUntil); });"
   ```
   *Output*: `target.silencedUntil: undefined`.
