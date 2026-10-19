# Progress — M2 Targeting Worker

Last visited: 2026-10-17T16:04:00Z

## Status
- [x] Initialized BRIEFING.md and DISPATCH.md
- [x] Read ORIGINAL_REQUEST.md, PROJECT.md, and explorer handoffs
- [x] Inspect existing src/game.js, src/core/input.js, tests/unit/player_attack.test.js
- [x] Implement changes in src/game.js
  - [x] Remove duplicate attackCooldown decrement in updateHeroCombat
  - [x] Update hero.facing (and sync targetFacing) in executeHeroSkill
  - [x] Add attack-move continuation and arrival clearance (<= 10 units) in updateHeroCombat and applyHeroHit
  - [x] Guard pursuit branch with if (hero.canMove && !hero.canMove())
- [x] Implement changes in src/core/input.js
  - [x] Add upperKey 'A' handling in InputDispatcher.handleKeyDown
- [x] Add tests TC-ATK-25 through TC-ATK-28 and TC-INP-08 in tests/unit/player_attack.test.js
- [x] Run test suite (`npm test`) — 167/167 tests passing cleanly
- [x] Self-critique & finalize handoff.md
- [ ] Notify orchestrator
