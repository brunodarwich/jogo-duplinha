# BRIEFING — 2026-10-17T15:07:00Z

## Mission
Investigate codebase architecture for Requirement R1: Hero Death & Respawn System.

## 🔒 My Identity
- Archetype: explorer
- Roles: Technical Explorer, Synthesis
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_1\
- Original parent: 64dd4762-525a-4a03-89f0-efbf6a6f4332
- Milestone: R1 Hero Death & Respawn System Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Analyze R1: lethal damage, entity death, respawn timer (4s + 1s per level), disabled controls/collisions during death, HUD timer display, respawn at Allied Fountain (400, 400) with full HP/Mana
- Produce handoff report at c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_1\handoff.md
- Notify orchestrator via send_message when done

## Current Parent
- Conversation ID: 64dd4762-525a-4a03-89f0-efbf6a6f4332
- Updated: not yet

## Investigation State
- **Explored paths**: `src/entities/entity.js`, `src/entities/heroes.js`, `src/game.js`, `src/ui/hud.js`, `src/world/map.js`, `src/world/tower.js`, `src/world/minion.js`, `src/combat/combat.js`, `src/combat/projectile.js`, `src/core/input.js`, `index.html`, `style.css`, `tests/unit/heroes.test.js`
- **Key findings**:
  1. `src/game.js` line 983 filters dead entities without exempting `hero`, permanently deleting dead heroes from `entities`.
  2. `HeroEntity` in `src/entities/entity.js` lacks `respawnTimer`, `die()`, and `respawn()` methods.
  3. `calculateRespawnTime(level)` formula `4 + level * 1` needs to be exported from `src/entities/heroes.js`.
  4. Movement/attack commands on `HeroEntity` require guards (`if (!this.isAlive()) return;`).
  5. `index.html` and `src/ui/hud.js` need a `#death-timer-overlay` element and countdown text update.
  6. Collision and tower/minion targeting already ignore dead units (`isDead || hp <= 0`).
  7. All 147 baseline tests pass cleanly.
- **Unexplored areas**: None for R1.

## Key Decisions Made
- Formulated complete 5-step implementation plan for R1 without breaking existing test baseline.
- Outlined 5 new unit tests (TC-HERO-08 to TC-HERO-12) for `tests/unit/heroes.test.js`.

## Artifact Index
- `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r2_1\handoff.md` — Final R1 handoff report
