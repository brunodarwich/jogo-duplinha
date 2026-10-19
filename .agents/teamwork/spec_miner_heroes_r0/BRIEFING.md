# BRIEFING — 2026-10-17T00:22:00Z

## Mission
Extract comprehensive functional and technical specifications for all 5 heroes, their passive and active skills (Q/W/E/R), canvas visual effects, combat calculation engine, and game balance model.

## 🔒 My Identity
- Archetype: spec_miner
- Roles: domain_explorer, specification_miner
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\spec_miner_heroes_r0
- Original parent: 47550c40-796a-4ccf-8ac6-09bde1de0183
- Milestone: Phase 0 - Survey & Specification Mining

## 🔒 Key Constraints
- Investigate and document all 5 heroes and their exact numerical specifications.
- Every skill must have exact mana costs, cooldowns, damage formulas, range, AoE, cast time, projectile speed, and Canvas particle visuals.
- Combat Calculation Engine must detail Physical/Magical/True damage, armor/resistance mitigation, crit, lifesteal, and CC states.
- Balance model for distinct, fair solo and co-op gameplay.
- Do NOT implement code — read-only domain explorer and spec miner.
- All final reports must be written to handoff.md following the 5-component protocol and required tables.

## Current Parent
- Conversation ID: 47550c40-796a-4ccf-8ac6-09bde1de0183
- Updated: 2026-10-17T00:22:00Z

## Task Summary
- **What to build**: Specification for 5 Heroes, Skills (Passives + Q/W/E/R), Combat Engine, CC state machine, Visual Effects, and Balance Model.
- **Success criteria**: Complete numeric tables, damage formulas, timing diagrams, CC state machine rules, and canvas rendering parameters.
- **Interface contracts**: PROJECT.md / ORIGINAL_REQUEST.md
- **Code layout**: src/entities/heroes/, src/combat/

## Key Decisions Made
- Fully specified complete stat matrices across levels 1 to 12 for all 5 heroes.
- Defined all 25 hero abilities (5 passives + 20 active skills) with exact numbers, timings, scalings, and lightweight 2D canvas VFX specs.
- Formulated non-linear Armor/MR mitigation formula: `Damage = Raw * 100 / (100 + R)` with negative resistance support.
- Established strict orthogonal CC state matrix (Stun, Root, Silence, Slow, Taunt, Blind, Stealth, Untargetable) with concurrent duration resolution and speed clamp.
- Validated solo mode viability (wave clear on every hero) and co-op synergies (2-3 players).

## Artifact Index
- c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md — Original User Request
- c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\spec_miner_heroes_r0\DISPATCH.md — Dispatch log
- c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\spec_miner_heroes_r0\BRIEFING.md — Working memory
- c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\spec_miner_heroes_r0\progress.md — Liveness & progress tracker
- c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\spec_miner_heroes_r0\handoff.md — Final specification report
