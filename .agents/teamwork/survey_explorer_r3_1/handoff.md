# Relatório de Investigação Técnica — Requisito R1: Interface de Usuário (UI) Moderna e Responsiva

**Especialista:** Survey Explorer 1 (UI/HUD Specialist)  
**Data:** 2026-10-18  
**Diretório de Trabalho:** `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r3_1`  
**Escopo:** Mapeamento minucioso do estado atual, gaps arquiteturais, e plano de implementação para o Requisito R1 (HUD, Banners Dinâmicos de Eventos, Loja de Itens, Responsividade e Testes).

---

## 1. Observation (Observações Diretas do Código)

### 1.1 Estrutura do HUD e Overlays (`index.html`)
- **Containers do HUD (`index.html:17-172`)**:
  - `#hud-overlay` (`linha 17`): container com `pointer-events: none` contendo os elementos de interface.
  - `.top-hud` (`linhas 19-31`): contém `.tower-status.allied` (`#allied-towers-count`), `.match-timer-container` (`#match-timer`), e `.tower-status.enemy` (`#enemy-towers-count`). Não há placar de KDA, não há indicador de torres individuais (Tier 1 / Tier 2 / Nexus), nem botão de controle de áudio (Mute/Volume).
  - `#death-timer-overlay` (`linhas 34-46`): overlay de contagem regressiva de ressurreição já estilizado com `.death-timer-card`, título "VOCÊ FOI DERROTADO" e `#death-timer-countdown`.
  - `.bottom-hud` (`linhas 58-171`):
    - `.hud-portrait-box` (`linhas 60-63`): retrato (`#hero-portrait`) e nível (`#hero-level-badge`).
    - `.hud-stats-box` (`linhas 66-73`): matriz com AD, AP, Armor, MR, Speed e Gold.
    - `.hud-center-console` (`linhas 76-155`): barras de status (HP, Mana, XP) e barra de habilidades (Q, W, E, R, B).
    - `.hud-inventory` (`linhas 158-165`): 6 slots estáticos (`.inv-slot[data-slot="0..5"]`).
    - `#minimap-container` (`linhas 168-170`): canvas minimapa 200x200 fixado na tela.
  - **Ausências Críticas**:
    - Não existe container para Banners Dinâmicos de Eventos (`#event-banner-container`).
    - Não existe overlay dinâmico dedicado para Vitória e Derrota épicos no HTML (hoje é injetado via JS dinâmico básico no DOM e canvas 2D cru).
    - Não existe botão de alternar áudio / mute no HUD (exigido no Requisito R4 e Critérios de Aceitação de Performance).

### 1.2 Estilização e Cooldowns Radiais (`style.css`)
- **Cooldowns Radiais de Habilidades (`style.css:371-390`)**:
  ```css
  .ability-cooldown-sweep {
    position: absolute;
    inset: 0;
    background: conic-gradient(rgba(0, 0, 0, 0.75) var(--cooldown-angle, 0deg), transparent var(--cooldown-angle, 0deg));
    pointer-events: none;
  }
  .cooldown-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 800;
    color: #ffffff;
    text-shadow: 0 2px 6px #000;
    pointer-events: none;
  }
  ```
  - A varredura cônica usa `conic-gradient` controlado pela variável CSS `--cooldown-angle`.
  - Falta: animação de brilho ("ready burst") quando a habilidade sai de recarga (`angle == 0`), feedback visual de clique/ativação, e molduras temáticas de slots.
- **Barras de Status (`style.css:172-225`)**:
  - Largura fixa de 320px (`.status-bars { width: 320px; }`).
  - Gradientes lineares estáticos: HP verde (`#15803d` -> `#22c55e`), Mana azul (`#1d4ed8` -> `#3b82f6`), XP roxo (`#7c3aed` -> `#a855f7`).
  - Falta: animação de pulso/alerta de vida baixa (Low HP warning quando `< 25%`), marcas de graduação (ticks de 100/250 HP) e feedback de cura/dano.
- **Loja da Base (`style.css:949-1140`)**:
  - Modal com `width: 900px; max-width: 95vw; height: 600px; max-height: 90vh;`.
  - Layout de 3 colunas fixas: `grid-template-columns: 140px 1fr 260px;`.
  - Cards de item possuem indicadores de Tier na borda esquerda (`tier-1`, `tier-2`, `tier-3`), mas os slots de inventário na barra inferior (`.inv-slot`) não refletem essa hierarquia de cor de Tier.
- **Responsividade Atual (`style.css:1767-1807`)**:
  - Há apenas uma única media query: `@media (max-width: 900px)`.
  - Em telas `<= 900px`:
    ```css
    .hud-stats-box, .hud-inventory {
      display: none !important;
    }
    ```
    Isso remove completamente o inventário de 6 itens e os atributos do herói em tablets e telas menores!
  - Em telas desktop entre 900px e 1150px, o `.bottom-hud` centralizado (largura total ~720px) colide com o minimapa fixado à direita (`right: 16px; width: 200px`), cobrindo parte do inventário.

### 1.3 Controladores de Interface Existentes
- **`src/ui/hud.js`**:
  - `HUDController`: faz cache dos elementos DOM (`linhas 212-271`) e atualiza no loop via `update(playerHero, gameState, inputManager)` (`linhas 288-460`).
  - Cooldown radial calculado em `linhas 429-440`:
    ```javascript
    const fraction = Math.min(1.0, remaining / cooldown);
    const angle = Math.round(fraction * 360);
    if (sweepEl) sweepEl.style.setProperty('--cooldown-angle', `${angle}deg`);
    if (textEl) textEl.textContent = remaining >= 1.0 ? remaining.toFixed(0) : remaining.toFixed(1);
    ```
  - Protegido contra ambiente headless: `if (typeof document === 'undefined') return;` em todas as funções de entrada.
- **`src/ui/shop_ui.js`**:
  - Gerencia o modal da loja, catálogo de 18 itens, filtros por 5 categorias e compra/venda vinculada à zona da fonte (`dist <= 280` de `{ x: 400, y: 400 }`).
  - Função `updateHUDInventory()` (`linhas 309-334`) atualiza os 6 slots com o ícone do item e tooltip de descrição.
  - Cards de item mostram apenas nome e custo, não exibindo os atributos-chave diretamente no card (ex: "+35 AD, +10% CDR"), exigindo clique individual para visualização.

### 1.4 Sistema de Eventos de Partida Existente
- **Estado Atual**:
  - **Inexistência de Banners de Eventos**: Não há nenhum sistema de banners dinâmicos no jogo atualmente. Kills de heróis apenas geram floating text local ("+100 XP (Abate!)" em `src/game.js:768`).
  - **Surgimento de Chefes (`src/world/boss.js:744-770`)**:
    - Stone Colossus (onda 5) e Abyssal Behemoth (onda 10) apenas disparam `particles.addFloatingText('⚠️ MINI-BOSS...')` em coordenadas no mundo, que não fica fixado no HUD e pode estar fora da visão do jogador.
  - **Destruição de Torres (`src/game.js:789-802`)**:
    - Apenas concede XP e floating text aos aliados próximos, sem aviso global de qual torre caiu.
  - **Vitória e Derrota (`src/game.js:1549-1600` e `src/render/renderer.js:444-466`)**:
    - `renderer.js` desenha no canvas 2D um texto estático simples `VITÓRIA` / `DERROTA`.
    - `game.js` injeta um modal DOM rudimentar (`#game-over-modal`) com um botão "Jogar Novamente". Não há animação épica, banner temático de vitória, efeitos de celebração ou estatísticas de final de partida.

### 1.5 Infraestrutura de Testes Existente
- **Execução**: `npm test` executa 26 arquivos de teste com 197 testes unitários e E2E, rodando em ~3.27s com 100% de sucesso.
- **Testes de UI existentes**:
  - `tests/unit/respawn.test.js`: `TC-HUD-01` testa se `HUDController.update` exibe o overlay de morte e formata a contagem regressiva em segundos.
  - `tests/unit/boost.test.js`: valida integridade do `shopUI` em modo headless.
  - `tests/unit/inventory.test.js`: valida os 6 slots, catálogo de 18 itens e recálculo de atributos.
- **Padrão dos Testes**: O runner roda em Node.js (sem JSDOM nativo). Testes que validam UI injetam mocks mínimos em `globalThis.document`.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Apresentação Visual e Clareza do HUD**:
   - *Fato:* O HUD existente já possui a infraestrutura básica (barras, minimapa, 5 slots Q/W/E/R/B, 6 slots de inventário e retrato).
   - *Problema:* Elementos visuais carecem de feedback imediato de combate (ex: sem pulso de vida baixa, sem aviso de mana insuficiente ao clicar, sem animação de habilidade pronta ao zerar cooldown).
   - *Solução:* Modernizar com CSS Glassmorphism aprimorado, efeito de pulso para Low HP (`animation: lowHpPulse`), animação "Skill Ready" ao término do cooldown radial, e tooltips enriquecidos com badges de atributos.

2. **Necessidade do Sistema de Banners Dinâmicos de Eventos**:
   - *Fato:* O Requisito R1 exige expressamente: "anúncio de First Blood, abates, destruição de torres, surgimento e morte de chefes, vitória e derrota".
   - *Problema:* Hoje esses eventos ou são invisíveis globalmente (apenas floating text local no mapa) ou usam renderização crua no canvas.
   - *Solução:* Projetar e implementar o módulo `src/ui/event_banners.js` (`EventBannerManager`), operando como uma fila de prioridade (Priority Queue) para banners dinâmicos:
     - Prioridade 1: Vitória / Derrota (Fim de partida épico).
     - Prioridade 2: Chefes (Surgimento e Morte de Mini-Bosses e Boss Supremo).
     - Prioridade 3: First Blood ("PRIMEIRO ABATE!").
     - Prioridade 4: Destruição de Estruturas (Torre Aliada Ruída vs Torre Inimiga Destruída).
     - Prioridade 5: Kill Streaks & Multi-Kills (Double Kill, Triple Kill, Em Chamas, Lendário).
     - Prioridade 6: Abate Comum.
   - Os banners devem apresentar animações de entrada CSS (`bannerSlideDown`, `glowPulse`), ícones de evento correspondentes, duração ajustável (3.5s - 5s) e transição de saída suave.

3. **Responsividade Multi-Resolução**:
   - *Fato:* Em resoluções entre 900px e 1150px, o minimapa colide com o inventário. Em resoluções `< 900px`, o inventário é completamente suprimido.
   - *Problema:* Em telas menores (laptops compactos, 1024x768, tablets), o jogador perde o acesso ao inventário ou tem a visão bloqueada.
   - *Solução:* Implementar 4 tiers de breakpoints responsivos:
     - Desktop Amplo (`> 1200px`): layout completo espaçoso.
     - Desktop Compacto / Laptops (`961px - 1200px`): minimapa reduz de 200px para 160px, gaps do console inferior diminuem de 16px para 8px, prevenindo qualquer sobreposição.
     - Tablets / Telas Médias (`641px - 960px`): inventário permanece visível em linha única compacta (6 slots de 28px); stats box condensa para formato horizontal; minimapa reposicionado com segurança.
     - Mobile / Telas Pequenas (`<= 640px`): slots de habilidades com tamanho tátil otimizado, Top HUD compacto e loja responsiva em coluna única rolável.

4. **Loja de Compras (`ShopUI`) UX Upgrade**:
   - *Fato:* Os cards de itens na loja requerem clique manual individual para descobrir o que o item faz, desacelerando a compra durante a partida.
   - *Solução:* Adicionar badges de atributos diretos nos cards (ex: `<span class="stat-pill">+35 AD</span>`), destacar se o item é acessível com o ouro atual (borda dourada de compra imediata), e refletir cores de tier (Cinza/Azul/Dourado) tanto nos cards quanto nos slots do HUD.

5. **Compatibilidade Headless e Testabilidade**:
   - *Fato:* Toda a suíte de 197 testes roda em Node.js headless. Se `EventBannerManager` ou novos elementos do HUD acessarem `document` sem checagem de existência, quebrarão o comando `npm test`.
   - *Solução:* Implementar padrão defensivo estrito (`if (typeof document === 'undefined') return;`) em todos os novos componentes de UI, e criar testes unitários dedicados em `tests/unit/hud_banners.test.js` com mocks DOM leves.

---

## 3. Caveats (Ressalvas e Limitações do Escopo)

1. **Separação de Responsabilidades entre Requisitos**:
   - **R4 (Áudio Web Audio API):** Embora o HUD precise de um botão visível de alternar som/mute (`#btn-audio-toggle`) e os banners devam disparar hooks de som, a síntese de som procedural em si pertence ao Requisito R4. O `EventBannerManager` deve emitir eventos/callbacks desacoplados (`onEventPlaySound?.(soundType)`).
   - **R3 (VFX e Partículas):** Efeitos de explosão e screen shake na morte de torres/chefes pertencem ao módulo de partículas R3. Os banners cuidam da camada DOM/HUD sobreposta.
2. **Multiplayer P2P & Sincronização**:
   - Em partidas cooperativas de 2 a 3 jogadores, eventos globais (First Blood, destruição de torres, morte de chefes) devem ser disparados a partir de eventos da simulação (`GameSimulation`) que já são sincronizados via host, evitando discrepâncias entre clientes.
3. **Restrição Estrita de Não-Modificação**:
   - Conforme diretriz recebida, este relatório NÃO alterou arquivos de código de produção, limitando-se à pesquisa, mapeamento e formulação técnica para os agentes de implementação.

---

## 4. Conclusion (Proposta Técnica e Plano de Implementação)

### 4.1 Novos Módulos e Arquivos a Criar
1. **`src/ui/event_banners.js`**:
   - Exporta a classe `EventBannerManager`.
   - Gerencia fila de eventos, renderização de banners animados no DOM e auto-dismiss com timers limpos.
   - Métodos principais:
     - `showBanner({ type, title, subtitle, icon, team, priority, duration })`
     - `announceFirstBlood(killer, victim, team)`
     - `announceKill(killer, victim, streakInfo)`
     - `announceTowerDestroyed(towerTeam, killerName)`
     - `announceBossSpawn(bossName, waveNumber)`
     - `announceBossSlain(bossName, killerTeam, killerName)`
     - `showVictoryBanner(stats)`
     - `showDefeatBanner(stats)`
     - `clear()`

2. **`tests/unit/hud_banners.test.js`**:
   - Suíte de testes unitários automatizados validando:
     - Injeção e formatação de banners de First Blood, Torres e Chefes.
     - Lógica de ordenação de prioridade da fila.
     - Respeito ao timeout e remoção do banner.
     - Operação segura em ambiente headless sem crashes.

### 4.2 Arquivos Existentes a Modificar
1. **`index.html`**:
   - Adicionar container para banners: `<div id="event-banner-container" class="event-banner-container"></div>`.
   - Adicionar botão de alternar áudio no Top HUD: `<button id="btn-audio-toggle" class="audio-toggle-btn" title="Alternar Áudio (Mute/Unmute)">🔊</button>`.
   - Adicionar container de Vitória/Derrota épicos: `<div id="endgame-modal" class="endgame-modal hidden">...</div>`.
2. **`style.css`**:
   - Adicionar classes e keyframes para os Banners Dinâmicos:
     - `.event-banner`, `.event-banner.first-blood`, `.event-banner.tower-destroyed`, `.event-banner.boss-event`, `.event-banner.kill-streak`.
     - Keyframes `@keyframes bannerEntrance` (slide-down com escala 0.95 -> 1.05 -> 1.0 e bloom de brilho).
     - Keyframes `@keyframes bannerExit` (fade e slide-up).
   - Estilos épicos para tela de Vitória (`.endgame-modal.victory` com raios dourados celestiais) e Derrota (`.endgame-modal.defeat` com aura abissal rubra).
   - Estilos para botão de áudio `#btn-audio-toggle`.
   - Animação de pulso Low HP (`.hp-bar.critical`).
   - Breakpoints de responsividade modernos:
     - `@media (max-width: 1200px)`: ajuste de espaçamentos e minimapa compacto (160px).
     - `@media (max-width: 960px)`: preservação do inventário em formato mini-strip (evitando que suma da tela).
     - `@media (max-width: 640px)`: adaptação móvel ultra-compacta.
3. **`src/ui/hud.js`**:
   - Integrar `EventBannerManager` ao `HUDController`.
   - No método `update()`:
     - Adicionar classe `.critical` na barra de HP quando `playerHero.hp / playerHero.maxHp <= 0.25`.
     - Detectar quando uma habilidade conclui o cooldown e disparar classe efêmera `.ready-burst`.
     - Suportar clique no `#btn-audio-toggle`.
4. **`src/ui/shop_ui.js`**:
   - Exibir chips de atributos nos cards (`+X Dano`, `+Y Vida`).
   - Sincronizar cores de Tier (tier-1, tier-2, tier-3) com os slots de inventário do HUD.
5. **`src/game.js`**:
   - Adicionar rastreador de estatísticas de partida:
     - `this.firstBloodClaimed = false;`
     - `this.heroKillStreaks = new Map();`
   - Nos pontos de abate (`awardDeathXp`, `handleAttackHit`, `takeDamage`):
     - Disparar `hud.eventBanners.announceFirstBlood(...)` se for o primeiro abate.
     - Disparar `hud.eventBanners.announceKill(...)` com cálculo de streak (Double Kill, Killing Spree, etc.).
     - Ao destruir torre: disparar `hud.eventBanners.announceTowerDestroyed(...)`.
     - Ao surgir boss em `bossManager.checkWaveSpawns`: disparar `hud.eventBanners.announceBossSpawn(...)`.
     - Ao morrer boss: disparar `hud.eventBanners.announceBossSlain(...)`.
     - Ao disparar vitória/derrota em `evaluateMatchOutcome`: invocar `hud.eventBanners.showVictoryBanner(...)` ou `showDefeatBanner(...)`.

---

## 5. Verification Method (Método de Verificação Independente)

Para que qualquer outro agente verifique e aprove esta especificação de forma independente:

### 5.1 Testes Automatizados da Base
Execute o comando principal do projeto:
```powershell
npm test
```
*Critério:* Todos os 197 testes pré-existentes devem continuar passando sem regressões.

### 5.2 Validação da Nova Suíte de Testes de UI/HUD
Após implementação dos arquivos propostos, execute:
```powershell
node tests/runner.js
```
*Critério:* A nova suíte `tests/unit/hud_banners.test.js` deve ser executada pelo runner, adicionando ~8 novos testes aprovados (totalizando >= 205 testes limpos).

### 5.3 Verificação de Responsividade Visual (Viewports)
Testar as seguintes resoluções no navegador (DevTools Device Mode):
1. **1920x1080 (Desktop FHD):** Minimapa em 200x200 à direita, console inferior perfeitamente centralizado sem sobreposição, Top HUD equilibrado.
2. **1024x768 (Laptop / iPad 4:3):** Verificar se minimapa (escalado para 160x160) e barra inferior possuem folga mínima de 24px entre si (zero colisão com o inventário).
3. **800x600 / 820x1180 (Telas Compactas):** Confirmar que os 6 slots de inventário continuam visíveis e clicáveis (não ficam ocultos como na versão legada).
4. **414x896 / 375x667 (Mobile Landscape):** Banners centralizados no topo, botões de habilidade com tamanho de toque acessível.

### 5.4 Verificação dos Banners Dinâmicos em Jogo
1. Iniciar partida Solo.
2. Executar `/gold` no chat para adquirir itens e acelerar combate.
3. Abater um herói ou minion de elite: verificar surgimento do banner de First Blood animado no topo.
4. Conduzir tropas até a primeira torre inimiga e destruí-la: verificar banner "TORRE INIMIGA DERRUBADA!".
5. Aguardar onda 5 ou digitar `/horde`: verificar anúncio épico do Colosso de Pedra.
6. Destruir o Cristal Inimigo: verificar tela épica de VITÓRIA com estatísticas e botão funcional de reiniciar.
