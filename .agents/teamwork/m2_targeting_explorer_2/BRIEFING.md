# BRIEFING — 2026-10-17T15:54:00Z

## Mission
Formulate exact code replacements for `src/game.js` for Attack-Move path continuation after target death & destination arrival clearance, and pursuit CC guard (`canMove` check) for Milestone 2.

## 🔒 My Identity
- Archetype: explorer
- Roles: Technical Explorer
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_2\
- Original parent: 64dd4762-525a-4a03-89f0-efbf6a6f4332
- Milestone: Milestone 2 (Target Click, Auto-Attack & Hold/Stop Mechanics)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in src/
- Output exact code replacements / diffs in handoff report
- Follow 5-component handoff report structure
- Respect PROJECT.md and ORIGINAL_REQUEST.md requirements

## Current Parent
- Conversation ID: 64dd4762-525a-4a03-89f0-efbf6a6f4332
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/game.js`: `updateHeroCombat` (lines 701–788), `applyHeroHit` (lines 942–946), `handleCommand` (lines 234–246)
  - `src/entities/entity.js`: `HeroEntity.moveTo`, `stop`, `die`, `respawn`, `Entity.canMove`, `Entity.update`
  - `tests/unit/player_attack.test.js`: `TC-ATK-08` and full test suite
- **Key findings**:
  1. Attack-Move destination continuation bug: When a hero engaged with an enemy during Attack-Move slays that enemy, if no additional enemies are in chain range, `hero.attackTarget` is cleared to `null` while `hero.isMoving` remains `false` with `targetX = null`. The hero remains stranded in place and never continues to `hero.attackMoveDestination`.
  2. Attack-Move destination arrival clearance bug: When a hero arrives at or near `attackMoveDestination` without encountering enemies, `hero.attackMoveDestination` is never cleared to `null`.
  3. Pursuit CC vulnerability: In `updateHeroCombat` pursuit branch (line 778), `hero.canMove()` is never checked before updating coordinates `hero.x += hero.vx * dt` and `hero.y += hero.vy * dt`. Rooted or stunned heroes continue pursuing targets.
- **Unexplored areas**: None within M2 Explorer 2 scope. All requirements thoroughly analyzed.

## Key Decisions Made
- Designed a three-layer continuation mechanism in `src/game.js`:
  1. In `updateHeroCombat` (lines 722–730) section 2: check distance to `attackMoveDestination`; if `<= 10`, clear destination and halt; else if no enemy and not moving, resume moving to destination.
  2. In `updateHeroCombat` (lines 746–752) when target dies: if no chained enemy, resume moving to `attackMoveDestination` if distance `> 10`, else clear destination.
  3. In `applyHeroHit` (lines 942–946) on kill: if no chained enemy, resume moving to `attackMoveDestination` if distance `> 10`, else clear destination.
- Designed pursuit CC guard in `updateHeroCombat` (line 778): `if (hero.canMove && !hero.canMove()) { hero.isMoving = false; hero.vx = 0; hero.vy = 0; return; }`.

## Artifact Index
- DISPATCH.md — Task assignment and instructions
- BRIEFING.md — Persistent working memory
- progress.md — Liveness heartbeat
- handoff.md — Final investigation report with exact code replacements
