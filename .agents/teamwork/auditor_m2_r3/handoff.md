# Forensic Audit Report — Marco 2: UX, Feedback Tátil, Cursor Adaptativo, Tooltips Ricos e Retículo de Movimento

**Data**: 2026-10-18T01:10:00Z  
**Auditor**: Forensic Auditor (auditor_m2_r3)  
**Work Product**: Entregáveis do Milestone 2 (`src/ui/tooltip.js`, `src/render/particles.js`, `src/core/input.js`, `src/game.js`, `style.css`, `tests/unit/tactile_ux.test.js`)  
**Profile**: General Project (Development Mode — conforme `ORIGINAL_REQUEST.md`)  
**Verdict**: **CLEAN**

---

## 1. Observation (Observações Empíricas Diretas)

1. **Implementação de `TooltipController` em `src/ui/tooltip.js:60–189`**:
   - O método `formatAbilityScaling(ability, hero)` calcula dinamicamente o dano base e o escalamento para os 5 arquétipos de heróis:
     * Sorceress: AP scaling em Q (75%), W (60%), E (70%), R (95%) com base damage por rank.
     * Knight: AD scaling em Q (60%), E (85%), R (70%) e Armadura em W (40%).
     * Ranger: AD scaling em Q (100%), W (60%), R (120%).
     * Assassin: AD scaling em Q (90%), W (65%), R (130%).
     * Cleric: AP scaling em Q (70%), W (65%), E (60%), R (125%).
   - Cálculo aritmético real:
     ```javascript
     const statVal = stat === 'AP' ? ap : (stat === 'Armadura' ? armor : ad);
     const bonus = Math.round(statVal * ratio);
     const total = base + bonus;
     const scalingText = `+${bonus} [${Math.round(ratio * 100)}% ${stat}] ${type}`;
     ```
   - Nenhum retorno estático ou constante hardcoded para contornar asserções.
   - Formatação de itens com `formatItemStats` mapeia 13 atributos distintos em `STAT_META` e aplica `getSellRefund(cost)` (70% do valor de compra).

2. **Geometria de `emitMoveIndicator` em `src/render/particles.js:112–164, 227–273`**:
   - `emitMoveIndicator(x, y, color = '#10b981', isAttack = false)` gera:
     * 3 partículas do tipo `'ring'` com delays escalonados (0.00s, 0.08s, 0.16s), raio inicial de 6/4/2 e taxa de expansão de 58/50/42.
     * 4 marcadores do tipo `'reticle_marker'` nos ângulos isométricos `[π/4, 3π/4, 5π/4, 7π/4]`, com distância inicial 24 convergindo a 52 px/s.
   - Na renderização (`draw` em `particles.js:230–272`):
     * O anel usa `ctx.ellipse(sx, sy, p.radius * zoom, (p.radius * 0.5) * zoom, 0, 0, Math.PI * 2)` — exata proporção 2:1 da projeção dimétrica isométrica.
     * O chevron projeta `tipY = sy + sinA * 0.5 * d` aplicando o achatamento 2:1 em Y e traça dois braços angulados via `ctx.moveTo(p1x, p1y)`, `ctx.lineTo(tipX, tipY)`, `ctx.lineTo(p2x, p2y)` com `ctx.stroke()`.

3. **Ganchos de Erro e Cursores Adaptativos em `src/core/input.js` e `src/game.js`**:
   - `CURSOR_SVGS` (`src/core/input.js:276–282`) define 5 cursores SVG embutidos em formato Data-URI de alta definição (`default`, `attack`, `ally`, `shop`, `target`).
   - `updateCanvasCursor()` (`src/core/input.js:480–499`) implementa a máquina de estados com hierarquia estrita:
     `targetingState` ('target') > `isHostile` ('attack') > `isAlly` ('ally') > `isNearShopOrFountain` ('shop') > 'default'.
   - `triggerAbility` (`src/core/input.js:841–864`) verifica:
     * `ability.cooldownRemaining > 0` -> despacha `this.onSkillError?.(slot, 'cooldown', ...)`
     * `hero.mana < ability.manaCost` -> despacha `this.onSkillError?.(slot, 'mana', ...)`
     * `!hero.canCast()` -> despacha `this.onSkillError?.(slot, 'cc')`
     * Herói morto -> suprime comandos e não emite erros.
   - `GameSimulation` (`src/game.js:229–271, 331–373`):
     * Conecta `this.input.onSkillError` a `this.handleSkillError()`.
     * `handleSkillError()` invoca `this.hud.flashAbilityError(slot, reason)` e adiciona Floating Combat Text com cores temáticas ('Sem Mana!' em `#38bdf8`, 'Em Recarga!' em `#f59e0b`, 'Impossibilitado!' em `#c084fc`).
     * `handleCommand()` aciona `this.particles.emitMoveIndicator(...)` tanto em `MOVE_TO` (verde `#10b981`) quanto em `ATTACK_TARGET` (vermelho `#ef4444`).
     * `updateHUDForHero()` adiciona listeners nos botões de habilidade chamando `this.tooltip.showAbilityTooltip` e `this.tooltip.hide()`.

4. **Estilização e Animações em `style.css:2355–2520`**:
   - `@keyframes castErrorShake` implementa vibração horizontal (`translateX(-6px)` a `translateX(6px)`).
   - `@keyframes castErrorFlash` implementa pulso de brilho e borda vermelha (`#ef4444`).
   - Classe `.cast-error-shake` aplica ambas as animações combinadas por 0.35s com `!important`.
   - Regras completas de glassmorphism para `#game-tooltip` e `.game-tooltip` com badges de custo, recarga e fórmulas de dano.

5. **Asserções em `tests/unit/tactile_ux.test.js`**:
   - 8 casos de teste (`TC-UX-01` a `TC-UX-08`) examinados linha por linha.
   - Nenhuma asserção tautológica (`assert(x === x)`). Todas validam mutações de estado reais, cálculos matemáticos, transições de máquina de estados, timers assíncronos (`setTimeout` 380ms) e chamadas a mocks de canvas.

6. **Execução de `npm test`**:
   - Comando: `npm test`
   - Saída: 29 arquivos de teste aprovados (29 total), 221 testes executados, 221 aprovados, 0 falhas em 4.57s.

---

## 2. Logic Chain (Cadeia Lógica)

1. A premissa de integridade exige comprovação de que as mecânicas solicitadas em R2 (`ORIGINAL_REQUEST.md`) foram construídas com código genuíno, funcional e sem atalhos.
2. A inspeção de `src/ui/tooltip.js` demonstrou que as fórmulas de dano e escalamento de atributos (AD/AP/Armadura) para cada um dos 5 heróis utilizam aritmética em tempo real dependente dos atributos dinâmicos do herói (`ap`, `ad`, `armor`) e do rank da habilidade (`rank - 1`). O teste de estresse com `rank: 99` e `ap: 1000` comprovou cálculo aritmético correto (bônus 750, total 835) em vez de valores pré-gravados.
3. A inspeção de `src/render/particles.js` comprovou que `ctx.ellipse` aplica raio X `radius * zoom` e raio Y `radius * 0.5 * zoom`, cumprindo a proporção isométrica exata 2:1, enquanto os chevrons de retículo aplicam `0.5 * d` no eixo Y e convergem fisicamente em direção ao ponto clicado conforme o tempo avança (`update(dt)`).
4. O teste de estresse de memória em `particles.js` submetido a 200 emissões consecutivas (1.400 partículas criadas) manteve o array estritamente limitado ao teto `maxParticles: 500`, e após 1.0s de simulação o array de partículas esvaziou para 0, confirmando a inexistência de vazamento de memória (*memory leaks*).
5. A inspeção de `src/core/input.js` e `src/game.js` confirmou a conexão orgânica de eventos: `onSkillError` flui do input para o game loop, aciona o HUD e o sistema de partículas (Floating Combat Text), e os cursores adaptativos mudam de acordo com o contexto do mouse (alvo, hostil, aliado, loja, chão).
6. A auditoria dos 8 testes unitários de `tactile_ux.test.js` confirmou que nenhum teste é tautológico ou auto-certificante.
7. O conjunto de 221 testes de regressão passou com 100% de sucesso.
8. Logo, todos os critérios de integridade foram plenamente satisfeitos, sem nenhuma violação.

---

## 3. Caveats (Ressalvas)

- Não foram investigados os módulos de áudio Web Audio API (`src/audio/sound.js`), pois pertencem ao escopo do Marco 4. Os ganchos de erro em `GameSimulation` já estão estruturados para receber os despachos de áudio no M4.
- Nenhum código-fonte foi alterado durante esta auditoria (estrita conformidade com a restrição de auditor-only).

---

## 4. Conclusion (Conclusão e Veredicto)

**Veredicto Oficial: CLEAN**

A implementação do Milestone 2 (Tactile UX, Feedback Tátil, Cursores Adaptativos SVG, Retículo Dimétrico 2:1 e Tooltips Ricos) é autêntica, robusta, livre de fachadas ou valores hardcoded, perfeitamente integrada ao game loop e validada com 100% de aprovação na suíte automatizada de testes. O produto de trabalho do Marco 2 está **APROVADO**.

---

## 5. Verification Method (Método de Verificação Independente)

Para reproduzir e auditar independentemente estes resultados:

1. Executar a suíte completa de testes do projeto:
   ```powershell
   npm test
   ```
   *Critério de Invalidação*: Qualquer falha entre os 221 testes.

2. Executar o teste de integridade matemática e clamping de tooltips:
   ```powershell
   node -e "import('./src/ui/tooltip.js').then(m => { const tc = new m.TooltipController(); const r = tc.formatAbilityScaling({ id: 'Q', rank: 2 }, { heroId: 'sorceress', ap: 100 }); if (r.total !== 210) throw new Error('Falha no escalamento Sorceress Q'); console.log('Escalamento verificado: ' + r.summary); });"
   ```

3. Executar o teste de estresse de ciclo de vida de partículas e retículo:
   ```powershell
   node -e "import('./src/render/particles.js').then(m => { const ps = new m.ParticleSystem(); ps.emitMoveIndicator(100, 100, '#10b981', false); if (ps.particles.length !== 7) throw new Error('Esperado 7 partículas'); ps.update(0.5); if (ps.particles.length !== 0) throw new Error('Vazamento de partículas'); console.log('Retículo e ondas verificados com 0 vazamentos'); });"
   ```
