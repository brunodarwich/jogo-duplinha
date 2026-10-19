## 2026-10-17T02:13:21Z
You are Explorer 2 for Milestone 3 (5 Playable Hero Kits & Abilities).

Your working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\explorer_m3_2\
Original request file (MANDATORY TO READ): c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md
Master Project Plan: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator\PROJECT.md

Your mission:
Analyze and formulate the exact concrete implementation strategy for the Hero Base Class and the 5 Playable Hero Kits:
1. `src/entities/hero.js` (HeroEntity extending Entity):
   - Base stats, level scaling (level 1-18), health & mana pools, mana regeneration.
   - Basic attack execution: windup delay, cooldown timer based on attack speed, range (melee ~125-150, ranged ~500-600), basic attack projectiles for ranged heroes.
   - 4 Ability slots (Q, W, E, R) + 1 Passive trait. Cooldown tracking, mana verification, casting state machine.
2. The 5 Playable Hero Kits in `src/entities/heroes/`:
   - `knight.js` (Cavaleiro Guardião — Tank): Passive Barrier (shield at low HP), Q Shield Slam (damage + stun), W Taunt (forces enemy to attack Knight), E Cleave (arc physical damage), R Fortress (damage reduction & tenacity).
   - `sorceress.js` (Feiticeira Elemental — Mage): Passive Overload (ability hits empower next basic attack / burst), Q Fireball (linear skillshot with area detonation), W Frost Nova (circular AoE around caster with damage + slow/root), E Lightning Arc (chain lightning), R Cataclysm (high-impact targeted circular meteor).
   - `ranger.js` (Patrulheiro Arqueiro — Marksman): Passive Focus (consecutive attacks grant stacking attack speed), Q Piercing Shot (long-range linear skillshot piercing targets), W Volley (cone of arrows), E Wind Dash (mobility dash + temporary speed boost), R Arrow Storm (barrage of arrows).
   - `assassin.js` (Sombra Assassina — Assassin): Passive Backstab (guaranteed crit or bonus damage from behind), Q Shadow Strike (dash to target with high burst), W Smoke Screen (cloud granting stealth and speed), E Shuriken Toss (skillshot slow), R Death Mark (marks target; detonates for % of damage dealt during duration).
   - `cleric.js` (Clérigo da Luz — Support): Passive Grace (aura providing HP regen to nearby allies), Q Holy Heal (targeted heal on lowest HP ally or self), W Smite (targeted damage + slow/silence), E Divine Ward (bubble shield absorbing damage), R Sanctuary (large circular aura with heavy healing + slow resistance).
3. Review existing unit test and oracle:
   - `tests/unit/heroes.test.js`
   - `tests/oracles/entities/heroes.js`

Do NOT implement code directly. Provide exact class hierarchies, base stats tables, ability definitions (damage formulas, cooldowns, mana costs, ranges, target types), and step-by-step instructions for the Worker.
Write your report to:
`c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\explorer_m3_2\handoff.md`.
When done, notify the orchestrator via send_message.
