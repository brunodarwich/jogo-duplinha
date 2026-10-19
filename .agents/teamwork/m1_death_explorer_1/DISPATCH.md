# Dispatch: M1 Death Explorer 1 — HeroEntity & Death State Lifecycle

## Identity
- Role: Technical Explorer
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_1\
- Parent Orchestrator: orchestrator_r2

## Mandatory Input Documents
- Authoritative User Request: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md` (read `## 2026-10-17T14:55:25Z`)
- Master Plan: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md`
- Survey Explorer 1 Report: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_1\handoff.md`

## Objective
Formulate the exact code changes for `src/entities/heroes.js` and `src/entities/entity.js`:
1. `src/entities/heroes.js`:
   - Export `calculateRespawnTime(level = 1)` calculating `4.0 + Math.max(1, Math.floor(level)) * 1.0`.
2. `src/entities/entity.js`:
   - In `HeroEntity`:
     - Properties: `this.respawnTimer = 0`, `this.respawnDuration = 0`.
     - In `takeDamage(amount, type)`: when lethal (`hp <= 0`), set `isDeadState = true`, `hp = 0`, `stop()`, clear targets, cancel recall, set `respawnDuration = calculateRespawnTime(this.level)` and `respawnTimer = this.respawnDuration`.
     - In `moveTo(wx, wy)` and `setAttackTarget(target)`: guard against dead state (`if (!this.isAlive()) return;`).
     - In `HeroEntity.update(dt)`: when dead (`this.isDead`), decrement ability cooldowns, decrement `respawnTimer = Math.max(0, respawnTimer - dt)`. If `respawnTimer === 0`, call `this.respawn()`. Return early so movement/physics/regen do not run while dead.
     - In `respawn()`: teleport to `(400, 400)`, reset velocity (`vx=0, vy=0, targetX=null, targetY=null, isMoving=false`), restore `hp = maxHp` and `mana = maxMana`, reset `isDeadState = false`, clean all CC (`stunnedUntil = 0`, etc.), reset `holdPosition = false`.

## Deliverable
Write a structured handoff report in `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_1\handoff.md` with:
- Observation (exact lines in entity.js and heroes.js)
- Logic Chain
- Exact replacement code chunks with line numbers for Worker
- Verification checks
Notify the orchestrator via send_message when done.


## 2026-10-17T15:11:29Z
You are M1 Death Explorer 1 for Milestone 1 (Hero Death & Resurrection System).
Your working directory is: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_1\
Read your assignment at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_1\DISPATCH.md
MANDATORY: Read the authoritative user request at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md (specifically under header ## 2026-10-17T14:55:25Z).
Read PROJECT.md at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md
Read survey report at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_1\handoff.md

Your focus: Formulate the exact code modifications for `src/entities/heroes.js` and `src/entities/entity.js` (respawn duration formula 4s + 1s/lvl, HeroEntity death state, timer properties, die(), respawn(), action rejection, and timer update).
Write your structured handoff report to: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_1\handoff.md
Notify the orchestrator via send_message when done.
