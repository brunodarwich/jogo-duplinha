# Dispatch: M2 Targeting Explorer 2 — Attack-Move Continuation & Pursuit CC Guard

## Identity
- Role: Technical Explorer
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_2\
- Parent Orchestrator: orchestrator_r2

## Mandatory Input Documents
- Authoritative User Request: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md` (read `## 2026-10-17T14:55:25Z`)
- Master Plan: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md`
- Survey Explorer 2 Report: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_2\handoff.md`

## Objective
Formulate exact code modifications for `src/game.js`:
1. In `updateHeroCombat`: when executing an Attack-Move command, if the engaged enemy dies and no additional enemies are in chain range, ensure the hero resumes moving towards `hero.attackMoveDestination`.
2. When the hero arrives within threshold distance (e.g. `dist <= 10`) of `attackMoveDestination`, ensure `hero.attackMoveDestination = null` is cleared and hero stops.
3. In `updateHeroCombat` pursuit branch (line 764): guard movement with `if (hero.canMove && !hero.canMove()) { hero.isMoving = false; hero.vx = 0; hero.vy = 0; return; }` so that rooted or stunned heroes cannot pursue.

## Deliverable
Write your report to `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_2\handoff.md`.
Notify the orchestrator via send_message when finished.


## 2026-10-17T15:48:11Z
You are M2 Targeting Explorer 2 for Milestone 2 (Target Click, Auto-Attack & Hold/Stop Mechanics).
Your working directory is: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_2\
Read assignment: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_2\DISPATCH.md
MANDATORY: Read ORIGINAL_REQUEST.md at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md (header ## 2026-10-17T14:55:25Z).
Read PROJECT.md at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md
Read survey report at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_2\handoff.md

Focus: Formulate exact code replacements for src/game.js for Attack-Move path continuation after target death & destination arrival clearance, and pursuit CC guard (canMove check).
Write report to: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_2\handoff.md
Notify orchestrator via send_message when done.
