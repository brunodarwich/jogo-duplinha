# Dispatch: M2 Targeting Explorer 3 — Cast Facing, Hold/Stop Invariants & Unit Test Specifications

## Identity
- Role: Technical Explorer
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_3\
- Parent Orchestrator: orchestrator_r2

## Mandatory Input Documents
- Authoritative User Request: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md` (read `## 2026-10-17T14:55:25Z`)
- Master Plan: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md`
- Survey Explorer 2 Report: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_2\handoff.md`

## Objective
Formulate exact code modifications and unit test specifications for:
1. In `src/game.js` (`executeHeroSkill`, line 449): updating `hero.facing = Math.atan2(targetY - hero.y, targetX - hero.x)` so hero orients towards skill target on cast.
2. Verifying that Stop / Hold ('S' / 'H') invariants strictly hold: immediate velocity zeroing, clearing `attackTarget` and `attackMoveDestination`, cancelling Recall, and setting `holdPosition = true` which suppresses idle auto-attacks and kill-chaining.
3. Formulate unit tests in `tests/unit/player_attack.test.js` or `tests/unit/input.test.js` covering:
   - Single attack cooldown recovery rate (1.0s / attackSpeed per second)
   - 'A' key handling in `InputDispatcher`
   - Attack-move continuation to destination after slaying intermediate target
   - Crowd control halt during pursuit
   - Hero facing orientation update upon skill execution

## Deliverable
Write your report to `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_3\handoff.md`.
Notify the orchestrator via send_message when finished.


## 2026-10-17T15:48:12Z
[Message] timestamp=2026-10-17T15:48:12Z sender=64dd4762-525a-4a03-89f0-efbf6a6f4332 priority=MESSAGE_PRIORITY_HIGH content=You are M2 Targeting Explorer 3 for Milestone 2 (Target Click, Auto-Attack & Hold/Stop Mechanics).
Your working directory is: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_3\
Read assignment: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_3\DISPATCH.md
MANDATORY: Read ORIGINAL_REQUEST.md at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md (header ## 2026-10-17T14:55:25Z).
Read PROJECT.md at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md
Read survey report at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_2\handoff.md

Focus: Formulate exact code replacements for hero facing update on ability cast in src/game.js, hold/stop invariant verification, and unit test specifications for tests/unit/player_attack.test.js.
Write report to: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_3\handoff.md
Notify orchestrator via send_message when done.
