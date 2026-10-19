# Dispatch: M1 Death Worker — Implementation of R1 Hero Death & Respawn System

## Identity
- Role: Implementation Worker
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_worker\
- Parent Orchestrator: orchestrator_r2

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Mandatory Input Documents to Read
- Authoritative User Request: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md` (read `## 2026-10-17T14:55:25Z`)
- Master Plan: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md`
- Explorer 1 Report: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_1\handoff.md`
- Explorer 2 Report: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_2\handoff.md`
- Explorer 3 Report: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_3\handoff.md`

## Exclusive Write Ownership
You have exclusive write access to:
1. `src/entities/heroes.js`
2. `src/entities/entity.js`
3. `src/game.js`
4. `src/core/input.js`
5. `src/ui/hud.js`
6. `index.html`
7. `style.css`
8. `tests/unit/respawn.test.js`

## Implementation Tasks
1. `src/entities/heroes.js`: Export `calculateRespawnTime(level = 1)` implementing `4.0 + Math.max(1, Math.floor(Number(level) || 1)) * 1.0`.
2. `src/entities/entity.js`:
   - Import `calculateRespawnTime` from `./heroes.js`.
   - In `HeroEntity`, add `respawnTimer = 0`, `respawnDuration = 0`.
   - Guard `Entity.moveTo`, `HeroEntity.moveTo`, and `HeroEntity.setAttackTarget` with `if (!this.isAlive()) return;`.
   - Implement `HeroEntity.die()`: clamp `hp = 0`, set `isDeadState = true`, `stop()`, clear targets, cancel recall, set `respawnDuration = calculateRespawnTime(this.level)` and `respawnTimer = this.respawnDuration`.
   - Implement `HeroEntity.respawn()`: teleport to `(400, 400)`, reset velocity, restore `hp = maxHp` and `mana = maxMana`, reset `isDeadState = false`, clean all CC timers to 0, reset `holdPosition = false`.
   - Update `HeroEntity.takeDamage(amount, type)` to call `this.die()` on lethal damage.
   - Update `HeroEntity.update(dt)`: when dead, tick ability cooldowns and decrement `respawnTimer`. If `respawnTimer === 0`, call `this.respawn()`. Return early so movement/physics/regen do not run while dead.
3. `src/game.js`:
   - Line 983 entity cleanup: update filter to include `|| ent.type === 'hero'`.
   - Add defensive alive checks in `handleCommand`, `executeHeroSkill`, and `updateHeroCombat`.
   - Track hero death/respawn transitions in `sim.update` and emit visual particles and floating text.
4. `src/core/input.js`:
   - Suppress pointer clicks, right-drag throttled move, Attack-Move ('A'), and ability triggers when `playerHero` is dead.
5. `index.html` & `style.css`:
   - Add `#death-timer-overlay` markup inside `#hud-overlay`.
   - Add styling in `style.css` for centered death modal card, pulsing skull icon, countdown timer font, and greyscale dead portrait.
6. `src/ui/hud.js`:
   - Cache `#death-timer-overlay` and `#death-timer-countdown`.
   - In `update()`, toggle `.hidden` and update `Math.ceil(respawnTimer) + 's'` when hero is dead.
7. `tests/unit/respawn.test.js`:
   - Create comprehensive unit test suite implementing TC-HERO-08 through TC-HERO-13 and TC-HUD-01.

## Verification
Run tests via:
`npm test`
Verify that all existing 147 baseline tests pass AND the new unit tests pass cleanly with 0 failures.

## Deliverable
Write your completion handoff report to `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_worker\handoff.md`.
Notify the orchestrator via send_message when finished.


## 2026-10-17T15:23:25Z
You are M1 Death Worker for Milestone 1 (Hero Death & Resurrection System).
Your working directory is: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_worker\
Read your assignment at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_worker\DISPATCH.md
MANDATORY: Read the authoritative user request at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md (specifically under header ## 2026-10-17T14:55:25Z).
Read the master plan at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md
Read the reports:
- c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_1\handoff.md
- c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_2\handoff.md
- c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your task:
Implement R1 Hero Death & Resurrection across:
1. src/entities/heroes.js (calculateRespawnTime formula 4s + 1s/lvl)
2. src/entities/entity.js (HeroEntity respawn properties, die, respawn, takeDamage, action rejection, update loop)
3. src/game.js (entity array retention ent.type === 'hero', defensive alive guards, transition particles/text)
4. src/core/input.js (input suppression for dead heroes)
5. index.html & style.css (death overlay modal, pulsing skull, countdown timer, dead portrait)
6. src/ui/hud.js (HUDController death overlay caching and update)
7. tests/unit/respawn.test.js (complete unit test suite)

Execute:
npm test
Verify 100% passing tests with 0 failures.

Write your report to: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_worker\handoff.md
Notify the orchestrator via send_message when complete.
