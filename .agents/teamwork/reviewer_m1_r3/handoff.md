# Handoff Report — Review & Adversarial Stress Test do Marco 1 (M1)

**Reviewer & Adversarial Critic:** Reviewer M1  
**Data:** 2026-10-18  
**Diretório de Trabalho:** `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\reviewer_m1_r3`  
**Escopo de Auditoria:** Marco 1 (Interface de Usuário Moderna, Banners Dinâmicos de Eventos, Loja e Responsividade)  
**Veredicto Oficial:** **REQUEST_CHANGES**

---

## 1. Observation (Observações Diretas do Código e Execução de Testes)

### 1.1 Execução Automatizada de Testes (`npm test`)

Comando executado:
```powershell
npm test
```

Saída observada:
```
======================================================
                   TEST SUMMARY                       
======================================================
Test Files:   28 passed (28 total)
Total Tests:  213
Passed:       211
Failed:       2
Duration:     3.64s
======================================================

FAILURES DETAIL:

● Tier 1 Unit: M1 Adversarial Stress & Empirical Challenge > ADV-M1-03: Defensive resilience with null, undefined, and empty parameters
AssertionError: EventBannerManager crashed on null/empty arguments: showBanner(null), showBanner(), announceKill(hero, victim, null), showVictoryBanner(null), showDefeatBanner(null)
    at assertEqual (file:///C:/Users/Bruno/Downloads/jogo-duplinha/tests/helpers/assert.js:16:11)
    at Object.fn (file:///C:/Users/Bruno/Downloads/jogo-duplinha/tests/unit/m1_adversarial.test.js:201:5)
    at async runSuite (file:///C:/Users/Bruno/Downloads/jogo-duplinha/tests/runner.js:64:7)
    at async main (file:///C:/Users/Bruno/Downloads/jogo-duplinha/tests/runner.js:163:22)

● Tier 1 Unit: M1 Adversarial Stress & Empirical Challenge > ADV-M1-06: ShopUI formatStatChips defensive handling with edge-case attributes
AssertionError: formatStatChips(null) must not throw
    at assertFalse (file:///C:/Users/Bruno/Downloads/jogo-duplinha/tests/helpers/assert.js:42:11)
    at Object.fn (file:///C:/Users/Bruno/Downloads/jogo-duplinha/tests/unit/m1_adversarial.test.js:327:5)
    at async runSuite (file:///C:/Users/Bruno/Downloads/jogo-duplinha/tests/runner.js:64:7)
    at async main (file:///C:/Users/Bruno/Downloads/jogo-duplinha/tests/runner.js:163:22)
```

Código de saída: `1` (Falha na suíte).

---

### 1.2 Código-Fonte Examinado

1. **`src/ui/event_banners.js`**:
   - Linha 79: `showBanner(bannerConfig)` não possui fallback de default para valores `null` ou `undefined`. Ao executar `showBanner(null)` ou `showBanner()`, o acesso `bannerConfig.type` na linha 82 dispara `TypeError: Cannot read properties of null (reading 'type')`.
   - Linha 224: `announceKill(killerName = 'Herói', victimName = 'Inimigo', streakInfo = {})`: o parâmetro default `{}` só é acionado para `undefined`. Quando `null` é passado explicitamente (`announceKill('Hero', 'Enemy', null)`), `streakInfo.isStreak` dispara `TypeError: Cannot read properties of null (reading 'isStreak')`.
   - Linha 305 e 317: `showVictoryBanner(stats = {})` e `showDefeatBanner(stats = {})`: se `stats` for `null`, `stats.message` dispara `TypeError: Cannot read properties of null (reading 'message')`.

2. **`src/ui/shop_ui.js`**:
   - Linha 8: `export function formatStatChips(stats = {})` só aplica `{}` se `stats === undefined`. Se `formatStatChips(null)` for invocado, a linha 10 (`if (stats.attackDamage)`) dispara `TypeError: Cannot read properties of null (reading 'attackDamage')`.
   - Linha 13: `if (stats.armor) chips.push('+${stats.armor} Armadura');` utiliza a string `'Armadura'`. O teste unitário adversarial em `tests/unit/m1_adversarial.test.js:346` valida `assertTrue(partialChips.includes('+15 Armor'))`, exigindo alinhamento ou suporte a `'Armor'`/`'Armadura'`.

3. **`index.html`**:
   - Linha 31: `#btn-audio-toggle` inserido corretamente no `.top-hud`.
   - Linha 35: `#event-banner-container` inserido com z-index e layout dedicados.
   - Linhas 53-70: `#endgame-modal` com badge de vitória/derrota, título, subtítulo e botão de restart.

4. **`style.css`**:
   - Linhas 1770-1790: `.bar-container.hp-bar.critical` com animação `@keyframes lowHpPulse`.
   - Linhas 1792-1810: `.ability-slot.ready-burst` com animação `@keyframes readyBurstGlow`.
   - Linhas 1812-1842: `.audio-toggle-btn` e `.audio-toggle-btn.muted`.
   - Linhas 1844-1875: Cores de tier (`tier-1`, `tier-2`, `tier-3`) e chips de atributos `.item-stat-chips`.
   - Linhas 1877-2045: Banners de eventos glassmorphic, temas por tipo de evento e animações `bannerSlideDown` / `bannerExit`.
   - Linhas 2156-2323: 4 breakpoints responsivos (`> 1200px`, `961px-1200px`, `641px-960px`, `<= 640px`). No breakpoint de 641px a 960px, o inventário é preservado em mini-strip horizontal (`inv-slot` de 28px).

5. **`src/ui/hud.js`**:
   - Instanciação de `EventBannerManager`.
   - Aplicação de `.critical` quando `hp / maxHp <= 0.25`.
   - Disparo da classe temporária `.ready-burst` por 600ms quando a recarga chega a 0 a partir de um valor positivo anterior.
   - Método `setAudioMuted` para controle visual do botão de som.

6. **`src/game.js`**:
   - Rastreamento de `firstBloodClaimed` e `heroKillStreaks`.
   - Integração com `this.hud.eventBanners` para First Blood, Kills, Torres, Bosses e Vitória/Derrota.
   - Suporte defensivo a modal com fallback.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Critério Autoritativo de Aceitação**:
   - A diretriz fundamental do projeto e o dispatch exigem: *"Executar 'npm test' no terminal e confirmar 100% de sucesso sem regressões"*.
   - A suíte completa de testes (`npm test`) roda todos os arquivos sob `tests/`, incluindo os testes legados, os testes unitários do M1 e os testes de estresse adversarial.

2. **Detecção de Falha Concreta**:
   - Conforme demonstrado na Observação 1.1, `npm test` finalizou com código 1 e 2 testes falharam (`ADV-M1-03` e `ADV-M1-06`).
   - A falha não é cosmética: é um `TypeError` real em runtime quando os métodos públicos `showBanner`, `announceKill`, `showVictoryBanner`, `showDefeatBanner` ou `formatStatChips` recebem argumentos nulos ou indefinidos.

3. **Verificação de Integridade (Anti-Cheat / Anti-Bypass)**:
   - Não foi encontrada nenhuma implementação facade, dados hardcoded nem atalhos fraudulentos.
   - A lógica da fila de prioridades, preempção, responsividade de 4 breakpoints e HUD é autêntica e substancial.
   - O trabalho possui qualidade técnica altíssima, restando apenas sanar a defensividade dos parâmetros nos pontos observados.

4. **Princípio de Não-Modificação do Reviewer**:
   - As regras da persona estipulam que o Reviewer deve ser estritamente de revisão e crítica adversarial: *"Review-only — do NOT modify implementation code. Report any failures as findings — do NOT fix them yourself"*.
   - Portanto, a correção deve ser atribuída de volta ao Worker M1.

---

## 3. Caveats (Ressalvas)

- Todos os 197 testes legados e os 9 testes criados em `tests/unit/hud_banners.test.js` continuam passando perfeitamente (totalizando 206 testes verdes).
- As únicas 2 falhas originam-se da suíte adversarial `tests/unit/m1_adversarial.test.js`, criada para stress-testing de robustez extrema.
- Nenhuma outra quebra de regressão foi detectada no jogo.

---

## 4. Conclusion (Conclusão e Veredicto)

**Veredicto Oficial: REQUEST_CHANGES**

O Worker M1 deve aplicar os seguintes ajustes pontuais de robustez:

### Ajustes Solicitados:

1. **Em `src/ui/event_banners.js`**:
   - Em `showBanner(bannerConfig)`:
     Substituir acessos diretos por fallback seguro de objeto:
     ```javascript
     const config = bannerConfig || {};
     ```
     e utilizar `config.type`, `config.title`, etc.
   - Em `announceKill(killerName = 'Herói', victimName = 'Inimigo', streakInfo = {})`:
     Garantir fallback para `null`:
     ```javascript
     const info = streakInfo || {};
     const isStreak = info.isStreak || (info.streak && info.streak >= 2) || (info.multiKill && info.multiKill >= 2);
     ```
   - Em `showVictoryBanner(stats = {})` e `showDefeatBanner(stats = {})`:
     Garantir fallback para `null`:
     ```javascript
     const s = stats || {};
     subtitle: s.message || '...'
     ```

2. **Em `src/ui/shop_ui.js`**:
   - Em `formatStatChips(stats = {})`:
     Garantir fallback para `null`:
     ```javascript
     const s = stats || {};
     ```
     e verificar se `s.armor` deve emitir `Armor` (ex: `+${s.armor} Armor`) para satisfazer o teste unitário adversarial `ADV-M1-06`, ou suportar ambos.

Após essas correções simples, `npm test` atingirá 213/213 testes aprovados (100% de sucesso).

---

## 5. Verification Method (Método de Verificação Independente)

Para auditar e confirmar as correções:

```powershell
npm test
```

**Condição de Invalidação / Sucesso**:
- O comando deve retornar exit code `0`.
- Saída: `Test Files: 28 passed (28 total)`, `Total Tests: 213 passed`, `Failed: 0`.
