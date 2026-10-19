# Progress — survey_explorer_r2_2

Last visited: 2026-10-17T15:09:00Z
Status: Completed

- [x] Initialized BRIEFING.md and DISPATCH.md
- [x] Inspect files: src/core/input.js, src/combat/combat.js, src/entities/heroes.js, src/entities/entity.js, src/game.js, src/combat/projectile.js, src/combat/cc.js, src/world/map.js, tests/unit/player_attack.test.js
- [x] Investigate R2: Right-click/left-click target attack, chase range, attack cooldowns, attack-move ('A'), target re-acquisition/chaining
- [x] Investigate R3: Movement & right-drag, Stop/Hold ('S'/'H') behavior, holdPosition flag and target seeking cancellation
- [x] Document exact line numbers, code snippets, discrepancies, and gaps:
  - Attack cooldown double-decrement bug in sim.update (entity.js:412 & game.js:695)
  - Missing 'A' key in InputDispatcher.handleKeyDown (input.js:113-172)
  - Missing attack-move destination resumption and arrival clearance (game.js:708-736)
  - Missing canMove() check during target pursuit (game.js:764 & entity.js:171)
  - Facing orientation during skill cast (game.js:445)
- [x] Synthesize findings into handoff.md
- [x] Update BRIEFING.md
- [x] Send completion message to parent
