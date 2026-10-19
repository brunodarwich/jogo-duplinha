# Dispatch Assignment: Survey Explorer 1 (R1 Death & Respawn)

## Identity
- Role: Technical Explorer
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_1\
- Parent Orchestrator: orchestrator_r2

## Objective
Investigate the codebase for Requirement R1: Hero Death & Resurrection System.
Evaluate current implementation in `src/entities/hero.js`, `src/game.js`, `src/ui/hud.js`, and existing tests.
Map out how fatal damage is currently handled, whether the hero is permanently removed, how to implement the respawn timer (4s + 1s per level), how to disable controls/collisions during death, HUD timer display, and respawn at Allied Fountain (400, 400) with full HP/Mana.

## Authoritative Requirements
Read `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md` (specifically under `## 2026-10-17T14:55:25Z`).

## Deliverable
Write a structured handoff report in `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_1\handoff.md` with:
- Observation (verified line-by-line evidence in existing code)
- Logic Chain (exact architecture & changes needed for R1)
- Caveats & Dependencies (interactions with combat, recall, HUD, netcode)
- Recommended Fix Strategy / Implementation Plan
- Verification Method (unit test specifications for death & respawn)


## 2026-10-17T14:59:14Z
You are Survey Explorer 1 for the 2.5D Isometric MOBA project.
Your working directory is: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_1\
Read your assignment at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_1\DISPATCH.md
MANDATORY: Read the authoritative user request at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md (specifically under header ## 2026-10-17T14:55:25Z).

Your objective: Investigate R1 (Hero Death & Respawn System) across the codebase (e.g. src/entities/hero.js, src/game.js, src/ui/hud.js, tests/unit/heroes.test.js).
Examine how lethal damage, entity death, respawn timer (4s + 1s per level), disabled controls/collisions during death, HUD timer display, and respawn at Allied Fountain (400, 400) with full HP/Mana are currently structured or need to be implemented.
Write your structured handoff report to: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_1\handoff.md
Notify the orchestrator via send_message when done.
