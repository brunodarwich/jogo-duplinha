# Dispatch: M2 Targeting Worker — Implementation of R2 & R3 Core Mechanics

## Identity
- Role: Implementation Worker
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_worker\
- Parent Orchestrator: orchestrator_r2

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Mandatory Input Documents
- Authoritative User Request: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md` (read `## 2026-10-17T14:55:25Z`)
- Master Plan: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md`
- Explorer 1 Report: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_1\handoff.md`
- Explorer 2 Report: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_2\handoff.md`
- Explorer 3 Report: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_3\handoff.md`

## Exclusive Write Ownership
You have exclusive write access to:
1. `src/game.js`
2. `src/core/input.js`
3. `tests/unit/player_attack.test.js`

## Implementation Tasks
1. `src/game.js`:
   - Remove duplicate `attackCooldown` decrement in `updateHeroCombat` (lines 708–711).
   - In `executeHeroSkill` (line 458): update `hero.facing = Math.atan2(targetY - hero.y, targetX - hero.x)` and sync `if ('targetFacing' in hero) hero.targetFacing = hero.facing;`.
   - In `updateHeroCombat`:
     - When idle during Attack-Move and no target is currently engaged, if no enemies in range, ensure `hero.isMoving = true` and pathing towards `hero.attackMoveDestination` resumes.
     - When arriving within 10 units of `attackMoveDestination`, clear `hero.attackMoveDestination = null` and stop.
     - In pursuit branch, guard movement with `if (hero.canMove && !hero.canMove()) { hero.isMoving = false; hero.vx = 0; hero.vy = 0; return; }`.
2. `src/core/input.js`:
   - In `InputDispatcher.handleKeyDown`: add handling for upperKey `'A'` (returning `CommandType.ATTACK_TARGET`, either on hovered hostile entity or on ground destination with `attackMove: true`).
3. `tests/unit/player_attack.test.js`:
   - Add unit tests `TC-ATK-25` through `TC-ATK-28` and `TC-INP-08` verifying cooldown single decrement, 'A' key dispatch, attack-move resumption, CC pursuit guard, and cast facing orientation.

## Verification
Run tests via:
`npm test`
Verify that all 162+ unit and E2E tests pass cleanly with 0 failures.

## Deliverable
Write your report to `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_worker\handoff.md`.
Notify the orchestrator via send_message when finished.


## 2026-10-17T15:55:41Z
[Message] timestamp=2026-10-17T15:55:41Z sender=64dd4762-525a-4a03-89f0-efbf6a6f4332 priority=MESSAGE_PRIORITY_HIGH content=You are M2 Targeting Worker for Milestone 2 (Target Click, Auto-Attack & Hold/Stop Mechanics).
Your working directory is: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_worker\
Read assignment at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_worker\DISPATCH.md
MANDATORY: Read ORIGINAL_REQUEST.md at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md (header ## 2026-10-17T14:55:25Z).
Read PROJECT.md at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md
Read the explorer reports:
- c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_1\handoff.md
- c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_2\handoff.md
- c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_3\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your exclusive write ownership:
1. src/game.js
2. src/core/input.js
3. tests/unit/player_attack.test.js

Your implementation tasks:
1. src/game.js:
   - Remove duplicate attackCooldown decrement in updateHeroCombat (lines 708-711).
   - In executeHeroSkill: update hero.facing = Math.atan2(targetY - hero.y, targetX - hero.x) (and sync hero.targetFacing).
   - In updateHeroCombat: resume pathing towards hero.attackMoveDestination when idle and no enemies in range; clear hero.attackMoveDestination = null when within 10 units.
   - In pursuit branch: guard movement with if (hero.canMove && !hero.canMove()) { hero.isMoving = false; hero.vx = 0; hero.vy = 0; return; }.
2. src/core/input.js:
   - In InputDispatcher.handleKeyDown: add upperKey 'A' handling for ground and entity Attack-Move commands.
3. tests/unit/player_attack.test.js:
   - Add unit tests TC-ATK-25 through TC-ATK-28 and TC-INP-08.

Execute:
npm test
Verify that all tests pass cleanly with 0 failures.

Write your report to: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_worker\handoff.md
Notify the orchestrator via send_message when complete.
