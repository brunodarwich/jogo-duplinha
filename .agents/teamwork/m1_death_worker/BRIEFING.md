# BRIEFING — 2026-10-17T15:34:00Z

## Mission
Implement Milestone 1: Hero Death & Resurrection System (R1) across entities, simulation, input suppression, HUD overlay, and comprehensive test suite with 100% pass rate.

## 🔒 My Identity
- Archetype: implementer
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_worker\
- Original parent: 64dd4762-525a-4a03-89f0-efbf6a6f4332
- Milestone: M1 (Hero Death & Resurrection System)

## 🔒 Key Constraints
- DO NOT CHEAT: Genuine implementation only. No hardcoded test outputs or dummy facades.
- Minimal change principle: only edit what is strictly required.
- Do not break existing 147 tests. Maintain 100% pass rate.
- Exclusive write ownership: `src/entities/heroes.js`, `src/entities/entity.js`, `src/game.js`, `src/core/input.js`, `src/ui/hud.js`, `index.html`, `style.css`, `tests/unit/respawn.test.js`.

## Current Parent
- Conversation ID: 64dd4762-525a-4a03-89f0-efbf6a6f4332
- Updated: 2026-10-17T15:23:25Z

## Task Summary
- **What to build**: Level-scaled hero respawn timer formula ($4s + 1s \times L$), death lifecycle on `HeroEntity` (`die()`, `respawn()`, `takeDamage()`, action guards, ability ticks), entity retention in `GameSimulation` cleanup filter, input/command suppression while dead, floating text/particles for death & respawn transitions, DOM overlay & styling for death modal & countdown, HUDController integration, and complete unit test suite `tests/unit/respawn.test.js`.
- **Success criteria**: All baseline 147 tests pass + new respawn unit tests pass with 0 failures (`npm test`).
- **Interface contracts**: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md` § Interface Contracts
- **Code layout**: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md` § Code Layout

## Key Decisions Made
- Used `4.0 + Math.max(1, Math.floor(Number(level) || 1)) * 1.0` in `calculateRespawnTime` for defensive level handling.
- Retained dead heroes in `this.entities` cleanup filter via `ent.type === 'hero'`.
- Cleanse all CC effects (stun, silence, root, taunt, slow) on hero respawn at fountain (400, 400).
- Suppressed inputs at both `InputManager` and `GameSimulation` levels for defense in depth.
- Support headless execution by guarding all DOM and particle operations.

## Artifact Index
- `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_worker\DISPATCH.md` — Assigned task specification
- `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_worker\handoff.md` — Final deliverable report
- `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_worker\progress.md` — Liveness heartbeat

## Change Tracker
- **Files modified**:
  - `src/entities/heroes.js`: exported `calculateRespawnTime`
  - `src/entities/entity.js`: added respawn timers, action guards, `die()`, `respawn()`, `takeDamage()`, and dead `update()`
  - `src/game.js`: retained heroes in entity filter, added alive guards in commands/combat/skills, tracked death/respawn VFX
  - `src/core/input.js`: suppressed clicks, right-drag, 'A'-move, stop, recall, skills while dead
  - `index.html`: added `#death-timer-overlay` markup
  - `style.css`: added styles for modal, countdown, pulsing skull, dead portrait
  - `src/ui/hud.js`: cached and updated death overlay and countdown
  - `tests/unit/respawn.test.js`: created comprehensive test suite (9 test cases)
- **Build status**: 156/156 tests passing (0 failures)
- **Pending issues**: None

## Quality Status
- **Build/test result**: 156 passed (100% pass rate in 1.42s)
- **Lint status**: Clean (no lint errors introduced)
- **Tests added/modified**: `tests/unit/respawn.test.js` covering TC-HERO-08 through TC-HERO-13, TC-HUD-01, TC-INPUT-DEAD-01, TC-SIM-DEAD-01

## Loaded Skills
- None
