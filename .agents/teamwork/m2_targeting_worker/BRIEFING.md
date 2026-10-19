# BRIEFING — 2026-10-17T16:04:00Z

## Mission
Implement Milestone 2 targeting, attack-move, cooldown, and input mechanics in src/game.js, src/core/input.js, and tests/unit/player_attack.test.js.

## 🔒 My Identity
- Archetype: implementer
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_worker\
- Original parent: 64dd4762-525a-4a03-89f0-efbf6a6f4332
- Milestone: M2 (Target Click, Auto-Attack & Hold/Stop Mechanics)

## 🔒 Key Constraints
- DO NOT CHEAT. All implementations must be genuine.
- Exclusive write ownership: `src/game.js`, `src/core/input.js`, `tests/unit/player_attack.test.js`.
- Minimal change principle.
- Full verification with `npm test`.

## Current Parent
- Conversation ID: 64dd4762-525a-4a03-89f0-efbf6a6f4332
- Updated: 2026-10-17T16:04:00Z

## Task Summary
- **What to build**:
  1. Fix duplicate `attackCooldown` decrement in `src/game.js` (updateHeroCombat lines 708-711).
  2. In `executeHeroSkill`, orient `hero.facing` (and `targetFacing`) toward target coordinates.
  3. In `updateHeroCombat`, resume pathing towards `hero.attackMoveDestination` when idle and no enemies in range; clear when within 10 units. Guard pursuit with `hero.canMove()`.
  4. In `src/core/input.js`, add upperKey `'A'` handling for ground and entity Attack-Move commands.
  5. In `tests/unit/player_attack.test.js`, add unit tests `TC-ATK-25` through `TC-ATK-28` and `TC-INP-08`, and update `TC-ATK-23` tick limit for single cooldown recovery rate.
- **Success criteria**: All unit & E2E tests pass (`npm test` with 0 failures).
- **Interface contracts**: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md`
- **Code layout**: standard project layout

## Key Decisions Made
- `HeroEntity.update(dt)` is the single authoritative source of basic attack cooldown ticks.
- In `InputDispatcher.handleKeyDown`, 'A' command unprojects screen coordinates if numeric or uses passed entity reference if present, falling back to hero coordinates, and cleanly rejects if the hero is dead.
- In `updateHeroCombat` and `applyHeroHit`, attack-move destination continuation smoothly reactivates waypoint pathing via `hero.moveTo(...)` whenever intermediate targets die and no enemies remain in chain range.

## Artifact Index
- `.agents/teamwork/m2_targeting_worker/progress.md` — Progress tracker
- `.agents/teamwork/m2_targeting_worker/handoff.md` — Handoff report

## Change Tracker
- **Files modified**:
  - `src/game.js`: Removed duplicate cooldown tick, added skill cast facing, added attack-move path continuation/clearance, guarded pursuit with `canMove()`.
  - `src/core/input.js`: Added 'A' / 'KeyA' dispatch in `InputDispatcher.handleKeyDown` supporting ground unprojection and hostile entity targeting.
  - `tests/unit/player_attack.test.js`: Added `TC-ATK-25` through `TC-ATK-28` and `TC-INP-08`; calibrated `TC-ATK-23` for 1.0x cooldown recovery.
- **Build status**: Pass (167 / 167 tests passing)
- **Pending issues**: None

## Quality Status
- **Build/test result**: 167 passed, 0 failed, 22 test files in 644.8ms.
- **Lint status**: Clean
- **Tests added/modified**: `TC-ATK-25`, `TC-ATK-26`, `TC-ATK-27`, `TC-ATK-28`, `TC-INP-08`, `TC-ATK-23` (calibrated).

## Loaded Skills
- None
