# Dispatch: M2 Targeting Explorer 1 — Cooldown Single-Decrement & 'A' Key Dispatch

## Identity
- Role: Technical Explorer
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_1\
- Parent Orchestrator: orchestrator_r2

## Mandatory Input Documents
- Authoritative User Request: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md` (read `## 2026-10-17T14:55:25Z`)
- Master Plan: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md`
- Survey Explorer 2 Report: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_2\handoff.md`

## Objective
Formulate exact code modifications for:
1. Eliminating the duplicate `attackCooldown` decrement in `src/game.js` (lines 694–696). Because `HeroEntity.update(dt)` in `src/entities/entity.js:412` already decrements `attackCooldown` by `dt`, having `sim.updateHeroCombat` also decrement it causes 200% cooldown recovery speed during simulation ticks.
2. Adding 'A' key dispatch support in `InputDispatcher.handleKeyDown` (`src/core/input.js:113-172`) so headless testing and headless dispatchers return `{ type: CommandType.ATTACK_TARGET, ... }` when pressing 'A' on targets or ground.

## Deliverable
Write your report to `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_1\handoff.md`.
Notify the orchestrator via send_message when finished.


## 2026-10-17T15:48:11Z
You are M2 Targeting Explorer 1 for Milestone 2 (Target Click, Auto-Attack & Hold/Stop Mechanics).
Your working directory is: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_1\
Read assignment: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_1\DISPATCH.md
MANDATORY: Read ORIGINAL_REQUEST.md at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md (header ## 2026-10-17T14:55:25Z).
Read PROJECT.md at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md
Read survey report at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_2\handoff.md

Focus: Formulate exact code replacements for eliminating the duplicate attackCooldown decrement in src/game.js (lines 694-696) and adding 'A' key handling to InputDispatcher.handleKeyDown in src/core/input.js.
Write report to: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m2_targeting_explorer_1\handoff.md
Notify orchestrator via send_message when done.
