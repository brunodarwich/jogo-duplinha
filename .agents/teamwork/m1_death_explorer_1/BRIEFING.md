# BRIEFING — 2026-10-17T15:20:00Z

## Mission
Formulate exact code modifications for src/entities/heroes.js and src/entities/entity.js for Hero Death & Resurrection System (R1 / Milestone 1).

## 🔒 My Identity
- Archetype: explorer
- Roles: Technical Explorer, Code Synthesis
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_1\
- Original parent: 64dd4762-525a-4a03-89f0-efbf6a6f4332
- Milestone: M1 (Hero Death & Resurrection System)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in src/
- Strict alignment with R1 specifications: respawn duration formula 4s + 1s/lvl, fountain respawn at (400, 400), clean status, action rejection
- Output structured handoff report in m1_death_explorer_1/handoff.md
- Notify parent orchestrator via send_message when done

## Current Parent
- Conversation ID: 64dd4762-525a-4a03-89f0-efbf6a6f4332
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/entities/heroes.js` (lines 104-125, exports)
  - `src/entities/entity.js` (Entity lines 1-325, HeroEntity lines 329-472)
  - `src/game.js` (entity update loop lines 956-961, cleanup filter lines 981-986, updateHeroCombat lines 690-775)
  - `src/core/input.js` (line 619 ability checks)
  - `src/combat/combat.js` & `src/combat/cc.js` (CC fields: stunnedUntil, silencedUntil, rootedUntil, tauntedUntil, slowedUntil, slowPercentage, stealthedUntil)
  - `tests/unit/heroes.test.js` & `tests/unit/combat.test.js` & `tests/unit/cc.test.js` & `tests/unit/m1_math.test.js`
- **Key findings**:
  - `calculateRespawnTime(level = 1)` formula: `4.0 + Math.max(1, Math.floor(Number(level) || 1)) * 1.0`. Placed directly after `calculateHeroStatsAtLevel` in `heroes.js`.
  - In `src/entities/entity.js`:
    - Import `calculateRespawnTime` from `./heroes.js`.
    - `Entity.moveTo`: add `if (!this.isAlive()) return;`.
    - `HeroEntity` constructor: add `this.respawnTimer = options.respawnTimer ?? 0; this.respawnDuration = options.respawnDuration ?? 0;`.
    - `HeroEntity.setAttackTarget`: add `if (!this.isAlive()) return;`.
    - `HeroEntity.moveTo`: add `if (!this.isAlive()) return;`.
    - `HeroEntity.die()`: clamps `hp = 0`, sets `isDeadState = true`, calls `stop()`, clears targets, cancels recall, sets `respawnDuration = calculateRespawnTime(this.level)` and `respawnTimer = this.respawnDuration`.
    - `HeroEntity.respawn()`: coordinates `(400, 400, 0)`, velocity `(0, 0)`, targets `null`, `isMoving = false`, restores `hp = maxHp, mana = maxMana`, resets `barrier = 0, isDeadState = false, respawnTimer = 0, respawnDuration = 0, holdPosition = false, attackTarget = null, attackMoveDestination = null, attackCooldown = 0, recall = false/0`, cleanses all CC fields.
    - `HeroEntity.takeDamage(amount, type)`: delegates to `super.takeDamage(amount, type)`, and if `this.hp <= 0`, calls `this.die()`.
    - `HeroEntity.update(dt)`: when dead (`this.isDead`), ability cooldowns decrement, `respawnTimer = Math.max(0, (this.respawnTimer || 0) - dt)`, if `respawnTimer === 0` calls `this.respawn()`, and returns early.
- **Unexplored areas**: None. Scope for `heroes.js` and `entity.js` completely resolved and verified against existing codebase.

## Key Decisions Made
- Confirmed acyclic import of `calculateRespawnTime` into `entity.js`.
- Separated `die()` and `respawn()` methods for clean programmatic invocation and testability.
- Guaranteed all CC flags and status effects are completely cleansed upon resurrection ("status limpo").
- Formulated exact replacement code chunks with line numbers for M1 Worker.

## Artifact Index
- DISPATCH.md — Task assignment and input documents
- BRIEFING.md — Persistent working memory and state
- progress.md — Liveness heartbeat
- handoff.md — Structured 5-component handoff report
