# Execution Plan — Modernização de UI, UX, VFX e SFX Procedural

## 1. Survey Phase (Exploration)
Spawn 3 Explorers in parallel to map technical touchpoints, file boundaries, and existing implementations:
- **Explorer 1 (`survey_explorer_ui`)**:
  - Focus: R1 UI modernization, HUD elements, dynamic event banners (First Blood, kill streaks, tower destruction, boss events, victory/defeat), responsive layout, radial cooldowns.
  - Files to analyze: `index.html`, `style.css`, `src/ui/hud.js`, `src/ui/shop_ui.js`.
- **Explorer 2 (`survey_explorer_ux`)**:
  - Focus: R2 Tactile feedback, animated right-click ground reticle/wave, adaptive cursor states, tooltips for abilities and shop items, out-of-mana & cooldown warning cues.
  - Files to analyze: `src/core/input.js`, `src/game.js`, `src/ui/hud.js`, `style.css`.
- **Explorer 3 (`survey_explorer_fx`)**:
  - Focus: R3 & R4 VFX particles (hero abilities, basic attack impacts, projectile trails, level up fanfare, CC rings), camera screen shake, and procedural Web Audio API sound synthesizer engine (UI clicks, attack/ability sounds, hits/crits, level up, shop transactions, recall, mute/volume HUD controls, autoplay compliance).
  - Files to analyze: `src/render/particles.js`, `src/render/renderer.js`, `src/core/camera.js`, `src/game.js`, audio integration points.

## 2. Synthesis & Decomposition (`PROJECT.md`)
- Aggregate explorer findings into a comprehensive Feature Inventory with 100% assignment.
- Define architecture, interface contracts, and module boundaries.
- Decompose into distinct milestones:
  - Milestone 1: Modern Responsive UI & Match Event Banners
  - Milestone 2: Tactile UX, Movement Wave, Adaptive Cursor & Cast Alerts
  - Milestone 3: Dynamic VFX Particles & Camera Screen Shake
  - Milestone 4: Procedural Web Audio SFX Engine & Audio Controls
  - Milestone 5: Integration, 197 Legacy Test Protection & New Test Coverage

## 3. Execution & Verification Loop
- For each milestone: Explorer -> Worker -> Reviewers -> Challengers -> Forensic Auditor.
- Verification gates strictly enforced.
- Final validation: `npm test` passing 100% (all 197 legacy + all new tests).
- Final Hard Handoff to Sentinel.
