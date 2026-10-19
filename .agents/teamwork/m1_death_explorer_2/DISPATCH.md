# Dispatch: M1 Death Explorer 2 — GameSimulation Entity Retention & Controls Suppression

## Identity
- Role: Technical Explorer
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_2\
- Parent Orchestrator: orchestrator_r2

## Mandatory Input Documents
- Authoritative User Request: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md` (read `## 2026-10-17T14:55:25Z`)
- Master Plan: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md`
- Survey Explorer 1 Report: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_1\handoff.md`

## Objective
Formulate the exact code changes for `src/game.js` and `src/core/input.js`:
1. `src/game.js`:
   - Entity cleanup in `sim.update` (line 983): ensure `ent.type === 'hero'` is preserved along with tower and nexus (`if (ent.type === 'tower' || ent.type === 'nexus' || ent.type === 'hero') return true;`).
   - Command dispatch in `sim.handleCommand` (line 192): ensure all player commands are strictly rejected if `!this.playerHero.isAlive()`.
   - Combat and skill updates: ensure `updateHeroCombat` and `executeHeroSkill` do not execute when `!hero.isAlive()`.
   - Emit appropriate floating text/event on death and resurrection.
2. `src/core/input.js`:
   - Verify that pointer clicks (`handlePointerDown`, `dispatchSmartRightClick`), Attack-Move ('A'), and ability triggers check `if (!this.playerHeroRef || !this.playerHeroRef.isAlive()) return;` to reject inputs while dead.

## Deliverable
Write a structured handoff report in `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_2\handoff.md` with:
- Observation (exact lines in game.js and input.js)
- Logic Chain
- Exact replacement code chunks for Worker
- Verification checks
Notify the orchestrator via send_message when done.

## 2026-10-17T15:11:30Z
From: 64dd4762-525a-4a03-89f0-efbf6a6f4332
Content: You are M1 Death Explorer 2 for Milestone 1 (Hero Death & Resurrection System).
Your working directory is: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_2\
Read your assignment at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_2\DISPATCH.md
MANDATORY: Read the authoritative user request at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md (specifically under header ## 2026-10-17T14:55:25Z).
Read PROJECT.md at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md
Read survey report at: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_1\handoff.md

Your focus: Formulate the exact code modifications for `src/game.js` (preserving heroes in sim.entities cleanup, command rejection on dead hero) and `src/core/input.js` (input rejection on dead hero).
Write your structured handoff report to: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_2\handoff.md
Notify the orchestrator via send_message when done.

## 2026-10-17T15:20:38Z
From: 64dd4762-525a-4a03-89f0-efbf6a6f4332
Content: **Context**: M1 Death Explorer 2 Assignment
**Content**: Checking on the status of your investigation of src/game.js (entity cleanup filter, command handling) and src/core/input.js (click/attack rejection).
**Action**: Please report current progress and estimated time to handoff.md completion.
