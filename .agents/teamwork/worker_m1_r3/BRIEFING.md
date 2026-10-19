# BRIEFING — 2026-10-18T00:30:00Z

## Mission
Implement Milestone 1 (M1): Modern UI, Dynamic Event Banners, Shop Polish, and Multi-breakpoint Responsiveness for Jogo Duplinha.

## 🔒 My Identity
- Archetype: implementer / qa / specialist
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\worker_m1_r3
- Original parent: 0ceb04ba-c109-4009-85b1-44c6c0395c2f
- Milestone: M1 (Modern UI, Event Banners, Shop Polish, Responsiveness)

## 🔒 Key Constraints
- DO NOT CHEAT: genuine logic, real state, no hardcoding, no dummy/facade implementations.
- Write ownership restricted to:
  * src/ui/event_banners.js (create)
  * index.html (update)
  * style.css (update)
  * src/ui/hud.js (update)
  * src/ui/shop_ui.js (update)
  * src/game.js (update event hooks)
  * tests/unit/hud_banners.test.js (create)
  * .agents/teamwork/worker_m1_r3/ (workspace metadata)
- All 197 existing tests must pass + new tests must pass.
- Headless safety: operate smoothly without document/DOM in node.js test environment.

## Current Parent
- Conversation ID: 0ceb04ba-c109-4009-85b1-44c6c0395c2f
- Updated: 2026-10-18T00:30:00Z

## Task Summary
- **What to build**:
  1. `EventBannerManager` with priority queue (Victory/Defeat: 1 > Boss: 2 > First Blood: 3 > Tower: 4 > Killstreaks: 5 > Normal Kill: 6) and headless safety.
  2. `index.html` structure: `#event-banner-container`, `#btn-audio-toggle`, `#endgame-modal`.
  3. `style.css`: Glassmorphism, animations (`bannerSlideDown`, `bannerGlow`, `bannerExit`, `lowHpPulse`, `readyBurstGlow`), 4 responsive breakpoints (>1200px, 961-1200px, 641-960px mini-strip inventory, <=640px compact), audio toggle button.
  4. `src/ui/hud.js`: EventBannerManager integration, `.critical` class on HP bar when <= 25%, `.ready-burst` when ability cooldown expires, `#btn-audio-toggle` cache and `setAudioMuted`.
  5. `src/ui/shop_ui.js`: Stat chips (+35 AD, +300 HP, etc.), item tier color classes (tier-1, tier-2, tier-3) on cards and slots.
  6. `src/game.js`: Kill tracking (first blood, streaks), tower, boss, victory/defeat banner hooks.
  7. `tests/unit/hud_banners.test.js`: comprehensive unit test suite (9 test cases).
- **Success criteria**: 100% test pass rate across all suites (206 passing: 197 prior + 9 new), clean responsive styles, zero regressions.
- **Interface contracts**: PROJECT.md and survey_explorer_r3_1 handoff.md.

## Key Decisions Made
- `EventBannerManager` implements preemption when a strictly higher priority event arrives (lower numeric value), immediately re-queuing the preempted banner to ensure high-priority game announcements take instant precedence while preserving full announcement history.
- `ShopUI.formatStatChips` formats concise chips for all primary RPG stats (AD, AP, HP, Armor, MR, Speed, Lifesteal, Crit, CDR, Heal/Shield).
- 4-breakpoint responsive design strictly guarantees the 6 inventory slots remain accessible in a compact horizontal mini-strip on viewports 641px - 960px, reversing the legacy bug that hid inventory entirely on <= 900px.

## Artifact Index
- `.agents/teamwork/worker_m1_r3/DISPATCH.md` — Assigned instructions
- `.agents/teamwork/worker_m1_r3/BRIEFING.md` — Active briefing
- `.agents/teamwork/worker_m1_r3/progress.md` — Heartbeat and step tracking
- `.agents/teamwork/worker_m1_r3/handoff.md` — Final handoff report
- `src/ui/event_banners.js` — Priority Queue Event Banner Manager module
- `index.html` — Updated HUD markup with banner container, audio button, endgame modal
- `style.css` — Modern glassmorphism, animations, responsive breakpoints, tier styles
- `src/ui/hud.js` — Integrated EventBannerManager, low HP critical alert, ready burst
- `src/ui/shop_ui.js` — Attribute chips and inventory slot tier synchronization
- `src/game.js` — Game simulation hooks for event banners and streaks
- `tests/unit/hud_banners.test.js` — Test suite for M1

## Change Tracker
- **Files modified**:
  * `src/ui/event_banners.js`: created EventBannerManager
  * `index.html`: added event banner container, audio toggle button, endgame modal
  * `style.css`: added banner styles, animations, 4 responsive tiers, audio toggle, stat chips
  * `src/ui/hud.js`: integrated EventBannerManager, critical HP pulse, ready burst, audio button hook
  * `src/ui/shop_ui.js`: exported formatStatChips, rendered chips, synced tier-1/tier-2/tier-3
  * `src/game.js`: tracked firstBloodClaimed and heroKillStreaks, added banner triggers
  * `tests/unit/hud_banners.test.js`: 9 unit tests
- **Build status**: PASS (206/206 tests passing)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (100% success rate, 27 files, 206 tests, duration 3.24s)
- **Lint status**: Clean
- **Tests added/modified**: 9 new tests in `tests/unit/hud_banners.test.js`

## Loaded Skills
- None requested/required for this specific task.
