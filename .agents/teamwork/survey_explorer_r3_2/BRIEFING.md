# BRIEFING — 2026-10-18T00:14:30Z

## Mission
Mapear minuciosamente o estado atual e o plano de implementação técnico para o Requisito R2 (UX e Feedback Tátil: indicador visual de clique de movimento, cursor adaptativo, tooltips detalhados, feedback de conjuração de habilidades falha por mana/cd).

## 🔒 My Identity
- Archetype: explorer
- Roles: UX and Tactile Feedback Specialist
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r3_2
- Original parent: 0ceb04ba-c109-4009-85b1-44c6c0395c2f
- Milestone: Survey & Planning R2 (UX / Tactile Feedback)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Focus strictly on R2 and its acceptance criteria
- Map existing architecture across input.js, game.js, hud.js, style.css, tests
- Deliver comprehensive handoff.md with 5-component structure

## Current Parent
- Conversation ID: 0ceb04ba-c109-4009-85b1-44c6c0395c2f
- Updated: 2026-10-18T00:14:30Z

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md`: Identified all R2 requirements and acceptance criteria.
  - `src/core/input.js`: InputDispatcher, InputManager, updateCanvasCursor, pickEntity, triggerAbility, smart move/attack dispatch.
  - `src/game.js`: handleCommand (MOVE_TO, ATTACK_TARGET, CAST_ABILITY), particles integration, updateHUDForHero.
  - `src/render/particles.js`: ParticleSystem (ring, floatingText, 2:1 ellipse rendering, life, alpha).
  - `src/render/renderer.js`: 7-pass rendering pipeline (pass 2 decals, pass 5 particles).
  - `src/ui/hud.js`: DOM bindings, ability slots, radial cooldown sweep, insufficient-mana class.
  - `src/ui/shop_ui.js`: Item catalog browsing, buying/selling, inventory slots.
  - `style.css`: Ability slots, cursor styles, inventory slots, lack of rich tooltips and adaptive cursor SVGs.
  - `src/entities/heroes.js`: 5 hero kits (Q/W/E/R/B), base stats, growth formulas, damage scaling functions.
  - `src/systems/items.js`: 18-item catalog with stats, tiers, descriptions, sell refund (70%).
  - Tests: `tests/unit/player_attack.test.js`, `input.test.js`, `respawn.test.js`, `m1_math.test.js`, `boundary_cases.test.js`, adversarial suites.
- **Key findings**:
  - `updateCanvasCursor()` is overly simplistic (`default` vs `crosshair`), lacks custom SVG cursors for hostile units, allies, shops, and abilities.
  - Movement click currently only emits a single `ring` particle; lacks concentric waves and converging central reticle.
  - Tooltips currently rely 100% on native HTML `title` attributes with 1.5s delay, no styling, and no dynamic damage/stat scalings.
  - Ability trigger failures (out of mana, on cooldown, silenced/disabled) return silently in `InputManager.triggerAbility`; lack HUD shake/flash, floating error text, and audio hooks.
  - All 197 existing tests pass cleanly; new UX tests should be created in `tests/unit/ux_feedback.test.js`.
- **Unexplored areas**: None for R2 scope.

## Key Decisions Made
- Design `emitMoveIndicator` in `ParticleSystem` with 2-3 concentric 2:1 dimetric expanding rings + 4 converging chevrons/reticle.
- Design adaptive cursor system using zero-dependency SVG Data-URIs and CSS cursor classes for instant responsiveness.
- Design `TooltipController` in `src/ui/tooltip.js` for instant, non-blocking DOM tooltips with dynamic AD/AP/CD/Mana formulas.
- Design `onSkillError` notification pipeline from `InputManager` to `GameSimulation`, driving `HUDController.flashAbilityError` and floating combat error text.

## Artifact Index
- `DISPATCH.md` — Log of dispatch instructions
- `progress.md` — Heartbeat and task progress
- `BRIEFING.md` — Persistent context & identity
- `handoff.md` — Final survey and implementation plan
