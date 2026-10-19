## 2026-10-17T02:13:21Z
You are Explorer 3 for Milestone 3 (VFX Particles, HUD & Hero Selection).

Your working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\explorer_m3_3\
Original request file (MANDATORY TO READ): c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md
Master Project Plan: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator\PROJECT.md

Your mission:
Analyze and formulate the exact concrete implementation strategy for Visual Effects, HUD Ability Bar, and Hero Selection:
1. `src/render/particles.js`:
   - 60 FPS lightweight procedural particle emitters for spells and combat:
     - Fire/flame particles for Sorceress Q Fireball and R Cataclysm.
     - Ice crystals / frost rings for Sorceress W Frost Nova.
     - Electric arcs for Sorceress E Lightning.
     - Golden holy light glows and sparkles for Cleric heals and shields.
     - Dark smoke puffs for Assassin W Smoke Screen.
     - Arrow projectile trails and impact sparks for Ranger.
     - Shield glow and metallic impacts for Knight.
2. Targeting Previews & Indicators in `src/render/renderer.js`:
   - Accurate isometric decals for Q/W/E/R ability aiming:
     - Circle AoE indicators with normalized radii ($rx = R \times 0.5$, $ry = R \times 0.25$).
     - Line arrow skillshots with directional orientation.
     - Cone sector indicators.
     - Range boundary circles centered on the hero.
3. HUD Enhancements in `src/ui/hud.js`:
   - Dynamic ability bar showing the active hero's Q, W, E, R abilities.
   - Cooldown radial sweep animation (clock wipe) when ability is on cooldown.
   - Mana availability indicator (greys out or displays insufficient mana warning).
   - Ability level badges / rank indicators.
   - Detailed stat panel showing AD, AP, Armor, MR, Move Speed, Attack Speed, Crit Chance, and Lifesteal.
   - Passive trait icon with tooltip and active/cooldown status.
4. Hero Selection & Game Loop Integration in `src/game.js`:
   - Hero selection interface allowing player to choose any of the 5 heroes at match start.
   - Testing hook / key to switch active hero during development/testing.
   - Spawning selected hero at Allied Base Fountain $(400, 400)$.

Do NOT implement code directly. Provide exact classes, canvas drawing routines, particle emitter methods, HUD updates, and step-by-step instructions for the Worker.
Write your report to:
`c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\explorer_m3_3\handoff.md`.
When done, notify the orchestrator via send_message.
