# BRIEFING — 2026-10-17T15:22:00Z

## Mission
Formulate exact code modifications for `src/game.js` (entity cleanup preservation, command rejection on dead hero) and `src/core/input.js` (input rejection on dead hero).

## 🔒 My Identity
- Archetype: explorer
- Roles: Technical Explorer
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\m1_death_explorer_2\
- Original parent: 64dd4762-525a-4a03-89f0-efbf6a6f4332
- Milestone: Milestone 1 (Hero Death & Resurrection System)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Preserving heroes in sim.entities cleanup, command rejection on dead hero in src/game.js
- Input rejection on dead hero in src/core/input.js

## Current Parent
- Conversation ID: 64dd4762-525a-4a03-89f0-efbf6a6f4332
- Updated: 2026-10-17T15:20:38Z

## Investigation State
- **Explored paths**:
  - `src/game.js`: lines 150-326 (`handleCommand`), 445-480 (`executeHeroSkill`), 650-760 (`findNearestEnemy`, `updateHeroCombat`), 860-933 (`performAttack`), 935-1015 (`sim.update`, entity filter line 983)
  - `src/core/input.js`: lines 41-172 (`InputDispatcher`), 174-350 (`InputManager`, drag throttle, `dispatchSmartRightClick`), 432-490 (`handlePointerDown`), 498-610 (`handleKeyDown`), 613-650 (`triggerAbility`), 747-798 (`confirmCast`, `cancelTargeting`)
  - `src/render/renderer.js`: lines 366-418 (verification that dead entities are already skipped during rendering)
  - `tests/`: ran baseline unit tests (147 passing), adversarial and stress input test suites
- **Key findings**:
  - `src/game.js` line 983: `if (ent.type === 'tower' || ent.type === 'nexus') return true;` excludes dead heroes. Expanding to `|| ent.type === 'hero'` preserves dead heroes across simulation ticks.
  - `src/game.js` lines 192-194: `handleCommand` drops commands if `!this.playerHero.isAlive()`. Made robust against duck-typed boolean/function states.
  - `src/game.js` line 445: `executeHeroSkill` lacks dead state guard; adding `!hero.isAlive()` prevents skill execution while dead.
  - `src/game.js` line 690: `updateHeroCombat` already begins with `!hero.isAlive()`.
  - `src/game.js` line 957: hero update loop enhanced with `_lastKnownAlive` state tracking to emit '💀 MORREU!' on death and '✨ RESSURGIU!' on respawn.
  - `src/core/input.js`: `dispatchSmartRightClick`, `handlePointerDown`, continuous right-drag in `update`, Attack-Move ('A') in `handleKeyDown`, `confirmCast`, and `InputDispatcher.handleKeyDown` guarded with hero alive checks.
- **Unexplored areas**: none (all assigned targets fully analyzed).

## Key Decisions Made
- Use state transition tracking on `hero._lastKnownAlive` within `sim.update` step 4 to cleanly catch all death sources (towers, minions, boss AOEs, spells) and emit exactly one death VFX/text and one resurrection VFX/text.
- Guard `InputManager` at all 5 dispatch points (`dispatchSmartRightClick`, left-click attack, right-drag throttle, 'A'-click, `confirmCast`) so zero commands are emitted to `handleCommand` when dead, providing defense-in-depth alongside `sim.handleCommand`'s root rejection.

## Artifact Index
- handoff.md — Complete 5-component technical blueprint and code patches for Worker
