# Dispatch: M1 Death Challenger 1 — Stress Testing & State Invariant Verification

## Identity
- Role: Adversarial Challenger
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_challenger_1\
- Parent Orchestrator: orchestrator_r2

## Mandatory Input Documents
- Authoritative User Request: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md` (read `## 2026-10-17T14:55:25Z`)
- Master Plan: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md`
- Worker Implementation Report: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_worker\handoff.md`

## Objective
Stress-test the Milestone 1 Hero Death & Resurrection implementation:
1. Write and execute an empirical test harness or fuzz script to stress-test:
   - Repeated lethal damage in quick succession (overkill damage, negative damage, NaN damage).
   - Invariant: while dead (`isDead === true`), `hp === 0`, `isMoving === false`, `canMove() === false`, `canAttack() === false`, `canCast() === false`, `vx === 0`, `vy === 0`.
   - Invariant: hero is NEVER filtered out of `sim.entities` after lethal damage across 100 simulation ticks.
   - Invariant: on resurrection tick, position is strictly `(400, 400)`, `hp === maxHp`, `mana === maxMana`, all CC timers `=== 0`.
   - Invariant: abilities continue to cool down while dead.
2. Run your harness and `npm test`.

## Deliverable
Write your report to `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_challenger_1\handoff.md` with:
- Verdict: APPROVE or REJECT
- Detailed empirical test results and invariant proof
Notify the orchestrator via send_message when finished.

## 2026-10-17T15:35:49Z
You are M1 Death Challenger 1 for Milestone 1.
Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_challenger_1\
Read assignment: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_challenger_1\DISPATCH.md
MANDATORY: Read ORIGINAL_REQUEST.md at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md (header ## 2026-10-17T14:55:25Z).
Read PROJECT.md at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r2\PROJECT.md
Read Worker report at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_worker\handoff.md

Adversarially challenge and stress-test Hero Death & Resurrection: repeated lethal damage, state invariants while dead, retention in sim.entities, and resurrection at (400, 400).
Run your test script and npm test.
Write report to: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_challenger_1\handoff.md
Verdict must be APPROVE or REJECT.
Notify orchestrator via send_message when done.
