# Project: MOBA Duplinha 2.5D — Modernização de UI, UX, VFX e SFX Procedural

## Architecture

O MOBA Duplinha 2.5D é estruturado em camadas desacopladas que operam em 60 FPS no navegador:
1. **Camada de Simulação e Entidades (`src/game.js`, `src/entities/`, `src/combat/`, `src/world/`)**:
   - Loop de simulação com passo de tempo fixo/variável seguro (`dt`).
   - Gerencia heróis, lacaios, torres, chefes, projéteis, estado de morte/ressurreição e combate.
2. **Camada de Entrada e Controles (`src/core/input.js`)**:
   - `InputManager` captura ponteiro, teclado, roda do mouse (zoom), rotação de perspectiva e comandos de habilidades.
   - Atualiza cursores adaptativos e despacha comandos para a simulação.
3. **Camada de Projeção e Câmera (`src/core/isometric.js`, `src/core/camera.js`)**:
   - Projeção dimétrica 2:1 rotacionável com unprojection precisa em qualquer nível de zoom (0.6x a 1.6x).
   - Suporte a trauma e deslocamentos de screen shake não-linear (`shakeOffsetX`, `shakeOffsetY`, `shakeRoll`).
4. **Camada de Renderização Isométrica (`src/render/renderer.js`, `src/render/particles.js`)**:
   - 7 passes de renderização ordenados por profundidade.
   - Aplicação de screen shake nos Passes 1 a 6 (mundo/entidades/partículas) preservando o Pass 7 (HUD estático).
   - Emissores de partículas para faíscas, chamas, anéis, confetes, auras/rastros e textos flutuantes de combate.
5. **Camada de Interface de Usuário & Feedback (`src/ui/`)**:
   - `HUDController` (`src/ui/hud.js`): barras de status, cooldowns radiais de habilidades, retrato e inventário.
   - `EventBannerManager` (`src/ui/event_banners.js`): fila de prioridade de banners de First Blood, abates, torres, bosses, vitória e derrota.
   - `TooltipController` (`src/ui/tooltip.js`): inspeção instantânea rica de habilidades (com escalamentos dinâmicos de dano) e itens de loja.
   - `ShopUI` (`src/ui/shop_ui.js`): catálogo de 18 itens, filtros, badges de atributos e sincronização de tiers.
6. **Camada de Áudio Procedural (`src/audio/sound.js`)**:
   - `SoundEngine`: síntese sonora nativa via Web Audio API (sem arquivos externos de áudio pesados).
   - Síntese com OscillatorNode, BiquadFilterNode, GainNode e Buffer de ruído branco em memória.
   - Conformidade com políticas de autoplay de navegadores (ativação no primeiro gesto de ponteiro/teclado).
   - Controles de alternar áudio (mute) e volume no HUD.
   - Salvaguarda defensiva para execução headless em Node.js (`npm test`).

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Banners Dinâmicos de Eventos | Fila de prioridade e banners animados para First Blood, kill streaks, destruição de torres, surgimento/morte de bosses e vitória/derrota | M1 | R1 Survey Explorer 1 |
| 2 | Modernização Visual do HUD | Glassmorphism, pulso de Low HP (<25%), animação "Skill Ready", botão de controle de áudio `#btn-audio-toggle` | M1 | R1 Survey Explorer 1 |
| 3 | Responsividade Multi-Resolução | 4 breakpoints (desktop amplo, compacto, tablet com inventário mini-strip preservado, mobile) sem colisão minimapa vs console | M1 | R1 Survey Explorer 1 |
| 4 | Loja e Inventário Aprimorados | Badges de atributos nos cards de itens, cores de tier sincronizadas entre itens da loja e slots do HUD | M1 | R1 Survey Explorer 1 |
| 5 | Indicador de Movimento Animado | Retículo central convergente + 3 ondas concêntricas elípticas 2:1 no chão com código de cor para movimento vs ataque | M2 | R2 Survey Explorer 2 |
| 6 | Cursor de Mouse Adaptativo | Cursores SVG vetoriais nítidos embutidos: default, hostil (espada/mira carmesim), aliado (radiante), loja (moedas), mira de skill | M2 | R2 Survey Explorer 2 |
| 7 | Sistema de Tooltips Ricos | Componente DOM flutuante instantâneo para habilidades (dano base + escalamento AD/AP) e itens com atributos e preços | M2 | R2 Survey Explorer 2 |
| 8 | Feedback de Conjuração Falha | Alertas imediatos: flash/shake vermelho no slot do HUD, texto flutuante ("Sem Mana!", "Em Recarga!") e gancho de som | M2 | R2 Survey Explorer 2 |
| 9 | Dinamismo de Câmera (Screen Shake) | Modelo de trauma não-linear em `Camera`, aplicado no `Renderer` (Passes 1-6) em acertos críticos, morte de herói, torres e bosses | M3 | R3 Survey Explorer 3 |
| 10 | Partículas Temáticas dos 5 Heróis | Efeitos de impacto de ataque básico e habilidades personalizados para Cavaleiro, Feiticeira, Patrulheiro, Assassina e Clérigo | M3 | R3 Survey Explorer 3 |
| 11 | Auras e Rastros de Projétil | Efeito `'trail'` contínuo de curta duração acompanhando flechas, feixes de luz e projéteis arcanos em voo | M3 | R3 Survey Explorer 3 |
| 12 | Celebração de Level Up & Anéis de CC | Partículas `'confetti'` com oscilação e rotação em level up, e `'cc_ring'` elíptico expansivo com orbes em Stun/Slow | M3 | R3 Survey Explorer 3 |
| 13 | Motor de Som Web Audio API | Classe `SoundEngine` procedural nativa (sem downloads externos), grafo com Oscillators, Noise Buffer, BiquadFilters e ADSR | M4 | R4 Survey Explorer 3 |
| 14 | Sintetização Procedural Completa | Áudio para cliques de UI, ataques básicos, habilidades Q/W/E/R, acertos/críticos, level up, compra/venda na loja, recall e alertas | M4 | R4 Survey Explorer 3 |
| 15 | Autoplay e Controles de Áudio | Desbloqueio seguro no primeiro gesto do usuário, botão de mute e controle de volume integrados ao HUD | M4 | R4 Survey Explorer 3 |
| 16 | Integridade de Testes & Headless Safety | Todos os 197 testes legados passando limpos + novas suítes de testes unitários para UI, UX, VFX e SFX | M5 | R1–R4 Acceptance Criteria |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Modern UI & Event Banners | `src/ui/event_banners.js`, `index.html`, `style.css`, `src/ui/hud.js`, `src/ui/shop_ui.js`, `tests/unit/hud_banners.test.js` | none | DONE (213 tests passed) |
| M2 | Tactile UX & Controls Feedback | `src/ui/tooltip.js`, `src/core/input.js`, `src/render/particles.js`, `src/game.js`, `style.css`, `tests/unit/tactile_ux.test.js` | none (parallel with M1) | DONE (225 tests passed) |
| M3 | Dynamic VFX & Screen Shake | `src/core/camera.js`, `src/render/renderer.js`, `src/render/particles.js`, `src/combat/projectile.js`, `src/game.js`, `tests/unit/vfx_shake.test.js`, `tests/unit/vfx_adversarial.test.js` | none (parallel with M1/M2) | DONE (238 tests passed) |
| M4 | Procedural Web Audio SFX Engine | `src/audio/sound.js`, `src/ui/hud.js`, `src/game.js`, `index.html`, `style.css`, `tests/unit/sound_engine.test.js`, `tests/unit/sound_engine_adversarial.test.js` | M1, M2, M3 | DONE (256 tests passed) |
| M5 | Final Integration & Test Verification | Execução integral de `npm test` (197 legados + todos os novos), validação de 60 FPS, verificação de memory leaks e handoff | M1, M2, M3, M4 | IN_PROGRESS |

---

## Interface Contracts

### M1: `EventBannerManager` (`src/ui/event_banners.js`)
```javascript
export class EventBannerManager {
  constructor(containerEl = null) {}
  showBanner({ type, title, subtitle, icon, team, priority, duration }) {}
  announceFirstBlood(killerName, victimName, team) {}
  announceKill(killerName, victimName, streakInfo) {}
  announceTowerDestroyed(towerTeam, killerName) {}
  announceBossSpawn(bossName, waveNumber) {}
  announceBossSlain(bossName, killerTeam, killerName) {}
  showVictoryBanner(stats) {}
  showDefeatBanner(stats) {}
  clear() {}
}
```

### M2: `TooltipController` (`src/ui/tooltip.js`)
```javascript
export class TooltipController {
  constructor() {}
  showAbilityTooltip(ability, hero, element) {}
  showItemTooltip(item, element) {}
  hide() {}
}
```

### M3: Camera Trauma & Screen Shake (`src/core/camera.js`)
```javascript
class Camera {
  addTrauma(amount) {} // amount in [0.0, 1.0]
  setShakeEnabled(enabled) {} // boolean
  // Properties: trauma, shakeOffsetX, shakeOffsetY, shakeRoll
}
```

### M4: `SoundEngine` (`src/audio/sound.js`)
```javascript
export class SoundEngine {
  constructor() {}
  init() {} // Safe browser & headless initialization
  resume() {} // Autoplay unlock
  setMuted(muted) {}
  toggleMute() {}
  setVolume(volume) {} // 0.0 to 1.0
  play(soundName, options = {}) {}
  playUiClick() {}
  playAttack(heroType, isRanged) {}
  playHit(isCrit = false) {}
  playSkill(slot, heroId) {}
  playLevelUp() {}
  playShopBuy() {}
  playShopSell() {}
  playRecallStart() {}
  playRecallInterrupt() {}
  playRecallComplete() {}
  playAlertBoss() {}
  playVictory() {}
  playDefeat() {}
}
```

---

## Code Layout

- `src/ui/event_banners.js` — Módulo de banners de eventos (M1)
- `src/ui/hud.js` — Integração de HUD, banners, feedback de habilidades e botões de áudio (M1, M4)
- `src/ui/tooltip.js` — Módulo de tooltips ricos para itens e habilidades (M2)
- `src/ui/shop_ui.js` — Loja com atributos visíveis e cores de tier (M1, M2)
- `src/core/input.js` — Cursores adaptativos e despachos de erro de conjuração (M2)
- `src/core/camera.js` — Sistema de trauma e screen shake (M3)
- `src/render/renderer.js` — Aplicação do tremor de câmera nos passes de mundo (M3)
- `src/render/particles.js` — Novos emissores: retículo/ondas de movimento, confetes, auras, CC rings (M2, M3)
- `src/audio/sound.js` — Motor de som procedural nativo Web Audio API (M4)
- `src/game.js` — Orquestração de eventos, combate, áudio, partículas e câmera (M1–M4)
- `tests/unit/hud_banners.test.js` — Testes de UI e Banners (M1)
- `tests/unit/tactile_ux.test.js` — Testes de UX, cursores e tooltips (M2)
- `tests/unit/vfx_shake.test.js` — Testes de partículas e screen shake (M3)
- `tests/unit/sound_engine.test.js` — Testes do sintetizador procedural de áudio (M4)
