# Dispatch: M1 Death Explorer 3 — HUD Overlay & Unit Test Suite

## Identity
- Role: Technical Explorer
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_3\
- Parent Orchestrator: orchestrator_r2

## Mandatory Input Documents
- Authoritative User Request: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md` (read `## 2026-10-17T14:55:25Z`)
- Master Plan: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md`
- Survey Explorer 1 Report: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_1\handoff.md`

## Objective
Formulate the exact code changes for the HUD Death Overlay and the comprehensive Unit Test suite:
1. `index.html` & `style.css`:
   - Add `#death-timer-overlay` markup inside `#hud-overlay`.
   - Add responsive, stylized CSS in `style.css` (overlay styling, skull icon, bold timer countdown, glowing accent).
2. `src/ui/hud.js`:
   - Cache `#death-timer-overlay` and `#death-timer-countdown`.
   - In `update(playerHero, gameState)`: if `playerHero.isDead && playerHero.respawnTimer > 0`, unhide overlay, display `Math.ceil(playerHero.respawnTimer) + 's'`; otherwise hide overlay. Ensure all DOM access is safely guarded with `if (typeof document === 'undefined') return;` for headless testing.
3. `tests/unit/respawn.test.js`:
   - Formulate a complete, runnable unit test suite (or additions to `heroes.test.js`) testing:
     - TC-HERO-08: Level scaling formula ($4s + 1s \times L$).
     - TC-HERO-09: Lethal damage entry to death state with correct initial timer.
     - TC-HERO-10: Action rejection while dead (`moveTo`, `setAttackTarget`, `canMove`, `canAttack`, `canCast`).
     - TC-HERO-11: Entity array retention in `sim.entities`.
     - TC-HERO-12: Timer countdown decrement and resurrection at `(400, 400)` with full HP, full Mana, and cleansed status.

## Deliverable
Write a structured handoff report in `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_3\handoff.md` with:
- Observation
- Logic Chain
- Exact replacement code chunks for Worker
- Full runnable unit test suite code
Notify the orchestrator via send_message when done.


## 2026-10-17T15:11:30Z
You are M1 Death Explorer 3 for Milestone 1 (Hero Death & Resurrection System).
Your working directory is: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_3\
Read your assignment at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_3\DISPATCH.md
MANDATORY: Read the authoritative user request at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md (specifically under header ## 2026-10-17T14:55:25Z).
Read PROJECT.md at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md
Read survey report at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_1\handoff.md

Your focus: Formulate the exact code modifications for the HUD Death Overlay (`index.html`, `style.css`, `src/ui/hud.js`) and formulate the complete, runnable unit test suite `tests/unit/respawn.test.js` covering all R1 acceptance criteria.
Write your structured handoff report to: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_3\handoff.md
Notify the orchestrator via send_message when done.
