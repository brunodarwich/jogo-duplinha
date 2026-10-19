# Relatório Técnico de Pesquisa e Plano de Implementação: Requisito R2 (UX e Feedback Tátil)

**Data**: 2026-10-18T00:15:00Z  
**Autor**: Survey Explorer 2 (Especialista em UX e Feedback Tátil)  
**Diretório de Trabalho**: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r3_2`  
**Escopo**: Requisito R2 — Experiência do Jogador (UX) e Feedback Tátil  
- Indicador visual animado no chão ao emitir comando de movimento (retículo e onda concêntrica em projeção isométrica 2:1)  
- Cursor de mouse adaptativo com indicação de alvo/ataque (ponteiro normal, espada/mira vermelha em hostis, cursor interativo em aliados/loja/habilidades)  
- Tooltips detalhados e imediatos para itens (loja e inventário) e habilidades (Q/W/E/R/B) com custos de mana, recargas, danos base e escalamentos dinâmicos  
- Feedback intuitivo ao tentar conjurar habilidades sem mana ou em recarga (pulso/flash no HUD, mensagens flutuantes na tela e ganchos de áudio)  

---

## 1. Observation (Observações Diretas do Código Existente)

### 1.1 Estado Atual do Indicador de Movimento no Chão
- **`src/game.js` (linhas 251–266 e 270–311)**:
  ```javascript
  case CommandType.MOVE_TO: {
    this.playerHero.setAttackTarget(null);
    this.playerHero.attackMoveDestination = null;
    this.playerHero.holdPosition = false;
    const walkable = this.map.findNearestWalkable(cmd.x, cmd.y, this.playerHero.radius);
    this.playerHero.moveTo(walkable.x, walkable.y);
    // Visual green ripple
    this.particles.emit('ring', {
      x: walkable.x,
      y: walkable.y,
      color: '#10b981',
      startRadius: 6,
      maxRadius: 24,
      life: 0.35
    });
    break;
  }
  ```
  Ao emitir `MOVE_TO` ou `ATTACK_TARGET`, o código atual dispara apenas um único anel simples (`this.particles.emit('ring', ...)`).
- **`src/render/particles.js` (linhas 33–49 e 156–164)**:
  ```javascript
  if (p.type === 'ring') {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(sx, sy, p.radius * zoom, (p.radius * 0.5) * zoom, 0, 0, Math.PI * 2);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.lineWidth || 2;
    ctx.globalAlpha = p.alpha;
    ctx.stroke();
    ctx.restore();
  }
  ```
  A projeção isométrica dimétrica 2:1 já é respeitada no desenho de elipses (`radius * zoom` por `(radius * 0.5) * zoom`), porém inexiste retículo central (marcadores convergentes/setas chevrons) ou ondas concêntricas sequenciais (múltiplos anéis com defasagem temporal de propagação).

### 1.2 Estado Atual do Cursor do Mouse
- **`src/core/input.js` (linhas 459–468)**:
  ```javascript
  updateCanvasCursor() {
    if (!this.canvas || !this.canvas.style) return;
    if (this.targetingState) {
      this.canvas.style.cursor = 'crosshair';
    } else if (this.hoveredEntity && this.isHostile(this.hoveredEntity, this.playerHeroRef)) {
      this.canvas.style.cursor = 'crosshair';
    } else {
      this.canvas.style.cursor = 'default';
    }
  }
  ```
  O cursor do Canvas utiliza exclusivamente strings nativas do sistema operacional (`'crosshair'` e `'default'`). Não há cursor de espada ou mira vermelha estilizada para inimigos, cursor interativo para aliados e loja da base, nem classe CSS ou SVG data-URI customizada.
- **`style.css`**: Não possui nenhuma regra de cursor estilizado nem classes para cursores MOBA customizados.

### 1.3 Estado Atual dos Tooltips de Habilidades e Itens
- **`index.html` (linhas 95–150 e 158–165)**:
  ```html
  <div id="ability-q" class="ability-slot" data-key="Q" title="Q: Shield Slam (Golpe de Escudo)">
  ```
- **`src/game.js` (linhas 224–230)**:
  ```javascript
  btn.title = `${key}: ${ab.name} — ${ab.description}`;
  ```
- **`src/ui/shop_ui.js` (linhas 319–320)**:
  ```javascript
  slotEl.innerHTML = `<span class="slot-item-icon" title="${item.name}: ${item.description}">${item.icon || '📦'}</span>`;
  ```
  O sistema depende 100% do atributo HTML nativo `title="..."`. Isso acarreta:
  1. Atraso irritante de 1,5 a 2 segundos do navegador para exibir o balão amarelo padrão do SO.
  2. Impossibilidade de formatação (sem cores, sem quebras estilizadas, sem badges de mana/recarrega).
  3. Ausência de cálculo dinâmico de dano atualizado com o AD/AP/nível do herói e sem distinção de dano físico vs mágico vs cura.

### 1.4 Estado Atual do Feedback de Conjuração Falha (Sem Mana / Cooldown)
- **`src/core/input.js` (linhas 816–824)**:
  ```javascript
  const isDead = typeof hero.isDead === 'function' ? hero.isDead() : !!hero.isDead;
  const isAlive = typeof hero.isAlive === 'function'
    ? hero.isAlive()
    : (!isDead && (typeof hero.hp !== 'number' || hero.hp > 0));
  if (isDead || !isAlive) return;
  if (typeof ability.cooldownRemaining === 'number' && ability.cooldownRemaining > 0) return;
  if (typeof hero.mana === 'number' && typeof ability.manaCost === 'number' && hero.mana < ability.manaCost) return;
  if (typeof hero.canCast === 'function' && !hero.canCast()) return;
  ```
  Ao pressionar a tecla ou clicar na habilidade quando sem mana ou em recarga, o `InputManager.triggerAbility` simplesmente executa `return;` silencioso.
- **`src/game.js` (linhas 318–324)**:
  ```javascript
  const ability = this.playerHero.abilities ? this.playerHero.abilities[slot] : null;
  if (ability && (this.playerHero.mana || 0) >= (ability.manaCost || 0) && (!ability.cooldownRemaining || ability.cooldownRemaining <= 0)) {
    this.executeHeroSkill(slot, ability, cmd);
  }
  ```
  Também rejeita silenciosamente sem disparar eventos para o HUD, partículas ou áudio.
- **`src/ui/hud.js` (linhas 421–439)**:
  Possui classes `.insufficient-mana` (que aplica `grayscale(60%) brightness(50%)`) e `.cooldown-active` com sweep radial, mas **não possui** animação de rejeição (shake/pulse/flash) quando o jogador tenta forçar a conjuração.

### 1.5 Estado da Suíte de Testes
- Execução de `npm test` realizada com sucesso:
  - **26 arquivos de teste**, **197 testes no total**, **100% de aprovação (0 falhas)** em 3.23s.
  - Testes cobrem rigorosamente: ataques básicos, corrida ao alcance, morte e ressurreição, zoom com unprojection, perspectiva rotacional e interações combinatórias.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio Técnico)

1. **Indicador de Movimento Animado (Retículo + Onda Concêntrica)**:
   - *Premissa*: O clique do botão direito no chão deve transmitir firmeza e responsividade tátil visual ao jogador.
   - *Dedução*: A emissão de um único anel simples de raio 24 é imperceptível em telas de alta resolução e não atende o critério de "retículo e onda concêntrica".
   - *Solução Arquitetural*:
     - No `ParticleSystem`, introduzir `emitMoveIndicator(x, y, color = '#10b981', isAttack = false)`.
     - Gerar 3 ondas concêntricas com raios escalonados (ex: Onda 1: raio 6 -> 32, Onda 2 com atraso: raio 4 -> 24, Onda 3: raio 2 -> 16).
     - Gerar o retículo central composto por 4 marcadores/chevrons dispostos nos eixos diagonais isométricos que convergem em direção ao ponto de clique `(x, y)` nos primeiros 150ms e desaparecem junto ao desvanecimento das ondas em 400ms.
     - As cores devem expressar a intenção: `#10b981` (verde) para movimento puro, `#ef4444` (vermelho) para ataque/A-move no chão, `#38bdf8` (azul/ciano) para cliques em aliados/fountain.
     - Todas as primitivas são desenhadas na Pass 5 (ou Pass 2) com transformação elíptica 2:1 dimétrica (`ctx.ellipse(sx, sy, r * zoom, r * 0.5 * zoom)`), preservando a fidelidade da câmera e dos 197 testes.

2. **Cursor Adaptativo (Hostil, Aliado, Loja, Mira de Habilidade)**:
   - *Premissa*: Jogadores de MOBA precisam de confirmação visual instantânea de qual alvo está sob o mouse antes de clicar.
   - *Dedução*: Cursors baseados em arquivos de imagem externos `.png`/`.cur` falhariam em ambientes offline ou introduziriam latência de carregamento.
   - *Solução Arquitetural*:
     - Construir cursores vetoriais nítidos através de **SVG Data-URIs embutidos** diretamente no CSS / JS:
       - `cursor-default`: Ponteiro dourado/metálico chanfrado com contorno escuro nítido (hotspot: `0 0`).
       - `cursor-attack`: Espada afiada inclinada carmesim (`#ef4444`) ou mira vermelha com centro oco para alvo hostil (hotspot: `4 4` ou `16 16`).
       - `cursor-ally`: Mão de comando radiante em tons azul/verde com runa sagrada para aliados (hotspot: `0 0`).
       - `cursor-shop`: Ícone de bolsa de moedas / engrenagem interativa dourada quando sobre a zona da loja na base (hotspot: `8 8`).
       - `cursor-target`: Mira de precisão ciano brilhante (`#00e5ff`) com linhas de retículo para conjuração de habilidade (`targetingState`).
     - No `InputManager.updateCanvasCursor()`:
       Avaliar na ordem de prioridade:
       1) Se `this.targetingState` -> `cursor-target`.
       2) Se `this.hoveredEntity`:
          - Se `isHostile(this.hoveredEntity, this.playerHeroRef)` -> `cursor-attack`.
          - Se aliada (`ent.team === 'allied'`) -> `cursor-ally`.
       3) Se o mouse está sobre a Fonte/Loja aliada (distância <= 280 da Fountain) -> `cursor-shop`.
       4) Caso contrário -> `cursor-default`.

3. **Sistema de Tooltips Profissionais Ricos (Habilidades e Itens)**:
   - *Premissa*: O atributo nativo `title` é lento, feio e estático. Habilidades no MOBA possuem escalamento dinâmico (AD, AP, vida bônus) e itens possuem atributos variados.
   - *Dedução*: Precisamos de um componente DOM flutuante dedicado (`TooltipController`) que renderize em tempo real sem delay.
   - *Solução Arquitetural*:
     - Criar `src/ui/tooltip.js` gerenciando uma div única `#game-tooltip` anexada ao `document.body` com `pointer-events: none`.
     - **Para Habilidades (Q/W/E/R/B)**:
       - Ler os metadados do herói em `HERO_DEFINITIONS` e `getHeroKit` (`src/entities/heroes.js`).
       - Ler o rank atual da habilidade (`ability.rank || 1`).
       - Calcular em tempo real o dano/cura/escudo com base no AD e AP atuais do herói (ex: se Feiticeira possui 80 AP, exibir `135 (+60 [75% AP]) Dano Mágico`).
       - Exibir badges coloridas:
         - Azul para Mana: `💧 55 Mana`.
         - Amarelo para Recarga: `⏱️ 6.0s Recarga` (e exibir em vermelho se estiver em recarga ativa com o tempo restante).
         - Verde para Alcance/Área: `🎯 Alcance: 500 | Raio: 90`.
       - Exibir descrição detalhada dos efeitos secundários (atordoamento, queima, lentidão).
       - Para Recall (B): Detalhar os 5.0s de canalização e regras de cancelamento por dano/movimento.
     - **Para Itens (Loja e Inventário)**:
       - Ler o catálogo `ITEM_CATALOG` (`src/systems/items.js`).
       - Exibir Tier (Tier 1 Básico, Tier 2 Intermediário, Tier 3 Lendário).
       - Exibir Preço de Compra (`💰 ${cost}`) e Preço de Venda (`💰 ${refund} [70%]`).
       - Exibir cada atributo com ícone e cor correspondente (`+Dano de Ataque`, `+Poder Mágico`, `+Armadura`, `+Resistência Mágica`, `+Velocidade`, `+Roubo de Vida`, `+CDR`, `+Crítico`).
       - Exibir passivas únicas destacadas.
     - **Posicionamento e Viewport Clamping**:
       - O tooltip se posiciona adjacente ao elemento hovered (ou segue o mouse suavemente), calculando limites da janela (`window.innerWidth`, `window.innerHeight`) para evitar que ultrapasse qualquer borda da tela.

4. **Feedback de Conjuração Falha (Mana Insuficiente ou Recarga)**:
   - *Premissa*: Clicar ou teclar uma habilidade e nada acontecer frustra o jogador, que não sabe se a tecla falhou ou se está sem mana/em recarga.
   - *Dedução*: A falha deve ser comunicada por múltiplos canais sensoriais simultâneos (HUD, Mundo/Tela e Áudio).
   - *Solução Arquitetural*:
     - Em `InputManager.triggerAbility(slot)`:
       - Se `ability.cooldownRemaining > 0`: disparar notificação `this.dispatchSkillError(slot, 'cooldown', ability.cooldownRemaining)`.
       - Se `hero.mana < ability.manaCost`: disparar notificação `this.dispatchSkillError(slot, 'insufficient_mana', ability.manaCost - hero.mana)`.
       - Se herói estiver sob CC (`!hero.canCast()`): disparar notificação `this.dispatchSkillError(slot, 'crowd_control')`.
     - Em `GameSimulation`:
       - Conectar o ouvinte `onSkillError`.
       - Disparar `this.hud.flashAbilityError(slot, reason)`:
         - Adiciona classe CSS `.cast-error-shake` e `.cast-error-flash` no botão da habilidade no HUD por 350ms.
       - Disparar `this.particles.addFloatingText(...)` sobre o herói:
         - Se sem mana: `"Sem Mana!"` em ciano vívido (`#38bdf8`) com tamanho 15px e subida rápida.
         - Se em recarga: `"Em Recarga (${rem.toFixed(1)}s)!"` em amarelo alaranjado (`#f59e0b`).
         - Se sob CC: `"Impossibilitado!"` em roxo (`#c084fc`).
       - Disparar gancho de áudio procedural (`this.sound?.play('error_buzz')` ou evento customizado), pronto para a integração do Requisito R4.

---

## 3. Caveats (Ressalvas, Limitações e Premissas)

1. **Execução Headless em Node.js (`npm test`)**:
   - O ambiente de testes de unidade roda em Node.js onde `document` e `window` não existem globalmente a menos que mockados.
   - Todo código novo que acesse o DOM (como `TooltipController` e manipulação de estilos do Canvas) **deve impreterivelmente** conter a salvaguarda:
     ```javascript
     if (typeof document === 'undefined') return;
     ```
   - Isso garante que a suíte existente de 197 testes continue executando com 100% de sucesso.
2. **Sistema de Som Procedural (Requisito R4)**:
   - O motor Web Audio API pertence ao Requisito R4 e está sob pesquisa de outro explorador. O Requisito R2 não deve tentar sintetizar áudio final, mas sim **expor interfaces e ganchos limpos** (callbacks/eventos) que o motor de áudio possa plugar diretamente.
3. **Performance a 60 FPS**:
   - A criação de ondas e retículos no `ParticleSystem` deve reciclar objetos ou usar um limite estrito de partículas ativas (`maxParticles = 500`), garantindo zero vazamento de memória mesmo com cliques contínuos e frenéticos do jogador.

---

## 4. Conclusion (Arquitetura Proposta e Contratos Técnicos)

### 4.1 Novos Arquivos a Criar
1. **`src/ui/tooltip.js`**:
   - Classe `TooltipController` com métodos:
     - `init()`: Injeta `<div id="game-tooltip" class="game-tooltip hidden"></div>` no DOM.
     - `showAbility(element, slot, ability, hero)`: Gera HTML estilizado com custos, cooldowns, alcance, dano base e bônus escalados por AD/AP/HP.
     - `showItem(element, item, hero, isInventory, slotIndex)`: Gera HTML estilizado com atributos do item, tier, custos e passivas.
     - `showStat(element, statName, value, description)`: Tooltip rápido para a matriz de atributos do HUD.
     - `hide()`: Oculta o tooltip imediatamente.
     - `updatePosition(targetElementOrCoords)`: Aplica clamping de tela.
2. **`tests/unit/ux_feedback.test.js`**:
   - Bateria de testes unitários dedicada aos novos recursos de UX:
     - Validação do indicador de movimento e anéis concêntricos no `ParticleSystem`.
     - Validação da máquina de estados do cursor adaptativo no `InputManager`.
     - Validação do despacho de erro de habilidade (`onSkillError`) por mana e cooldown.
     - Validação das classes e animações de erro no `HUDController`.
     - Validação da formatação dos tooltips para os 5 heróis (Knight, Sorceress, Ranger, Assassin, Cleric) e itens.

### 4.2 Arquivos Existentes a Modificar
1. **`src/render/particles.js`**:
   - Adicionar suporte a tipo `'reticle_wave'` e o método `emitMoveIndicator(x, y, color, isAttack)`.
   - Gerar 3 anéis concêntricos com raios e atrasos calibrados.
   - Gerar os marcadores de retículo central em formato de diamante/chevron com projeção 2:1 dimétrica.
2. **`src/core/input.js`**:
   - Expandir `updateCanvasCursor()` para suportar as 4 categorias de cursor adaptativo:
     - `target`: mira de habilidade (ciano).
     - `attack`: espada/mira vermelha em unidades hostis.
     - `interact`: mãozinha mágica em unidades aliadas e na loja.
     - `default`: ponteiro estilizado do MOBA.
   - Em `triggerAbility(slot)`: substituir os `return;` silenciosos por chamadas ao callback de erro de conjuração `this.dispatchSkillError(slot, reason, details)`.
   - Adicionar método `onSkillError(callback)` no `InputManager`.
3. **`src/game.js`**:
   - Em `handleCommand`:
     - Chamar `this.particles.emitMoveIndicator(...)` em `MOVE_TO` e `ATTACK_TARGET`.
   - No `init()`:
     - Conectar `this.input.onSkillError` para acionar `this.hud.flashAbilityError(slot, reason)` e `this.particles.addFloatingText(...)`.
     - Inicializar `this.tooltip = new TooltipController(this)`.
     - Vincular listeners de hover nos slots de habilidades e itens.
4. **`src/ui/hud.js`**:
   - Adicionar método `flashAbilityError(slot, reason)` que aplica `.cast-error-pulse` e vibração por 350ms.
5. **`src/ui/shop_ui.js`**:
   - Conectar os cards de itens da loja e slots do inventário ao `TooltipController` para hover enriquecido sem delay.
6. **`style.css`**:
   - Definir cursores customizados com SVG Data-URIs embutidos em alta resolução para `#game-canvas`.
   - Definir estilos do `#game-tooltip` (card translúcido com `backdrop-filter`, bordas suaves, tipografia com destaques de cores).
   - Definir animações CSS `@keyframes ability-error-shake` e `@keyframes ability-error-pulse`.

---

## 5. Verification Method (Método de Verificação Independente)

Para auditar e verificar independentemente a implementação proposta:

1. **Verificação de Integridade dos Testes Preexistentes**:
   ```powershell
   npm test
   ```
   *Critério de Sucesso*: Todos os 197 testes preexistentes continuam passando com 100% de sucesso (0 regressões).

2. **Verificação da Nova Suíte de UX (`tests/unit/ux_feedback.test.js`)**:
   ```powershell
   node tests/runner.js
   ```
   *Critérios de Sucesso*:
   - TC-UX-01: `emitMoveIndicator` gera partículas de ondas concêntricas e retículo nas coordenadas mundiais especificadas.
   - TC-UX-02: `updateCanvasCursor` seleciona cursor de ataque em unidade hostil, cursor aliado em herói aliado e cursor de mira em targeting.
   - TC-UX-03: `triggerAbility` dispara evento de erro com motivo `'insufficient_mana'` quando o herói não possui mana suficiente.
   - TC-UX-04: `triggerAbility` dispara evento de erro com motivo `'cooldown'` quando a habilidade está em recarga.
   - TC-UX-05: `HUDController.flashAbilityError` aplica e remove classes CSS de animação de erro no slot.
   - TC-UX-06: `TooltipController` gera dados precisos de dano base e escalamento proporcional para as habilidades dos 5 heróis.
   - TC-UX-07: `TooltipController` gera metadados completos de atributos e valores de venda (70%) para itens do inventário.

3. **Verificação Visual no Navegador**:
   - Iniciar o servidor HTTP local (`node server.js` ou duplo-clique em `iniciar_jogo.bat`).
   - Clicar com o botão direito no chão: conferir retículo central verde e ondas concêntricas se expandindo em perspectiva isométrica 2:1.
   - Passar o mouse sobre minions ou torres inimigas: conferir cursor alternando imediatamente para espada/mira vermelha de ataque.
   - Passar o mouse sobre habilidades (Q/W/E/R/B) e itens: conferir exibição instantânea do tooltip estilizado com custos de mana, tempos de recarga e dano dinâmico.
   - Tentar conjurar habilidade sem mana suficiente ou em recarga: conferir slot vibrando no HUD e mensagem flutuante ("Sem Mana!" / "Em Recarga!") subindo suavemente sobre o herói.

---
**Fim do Relatório do Survey Explorer 2.**
