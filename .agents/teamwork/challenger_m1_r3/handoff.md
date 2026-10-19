# Handoff Report — Challenger Marco 1 (M1: UI Moderna e Banners de Evento)

**Challenger:** Challenger M1 R3  
**Data:** 2026-10-18  
**Diretório de Trabalho:** `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\challenger_m1_r3`  
**Veredicto:** **REQUEST_CHANGES**

---

## 1. Observation (Observações Empíricas Diretas)

1. **Execução da Suíte Adversarial**:
   - Criada a suíte de testes de estresse em `tests/unit/m1_adversarial.test.js` cobrindo 7 cenários adversariais:
     - `ADV-M1-01`: Spam de 100 eventos simultâneos (abates, kill streaks, torres, bosses, vitória).
     - `ADV-M1-02`: Preempção estrita de prioridade (Prioridade 1 interrompendo Prioridade 6, cadeias em cascata 6 -> 4 -> 2 -> 1 e re-enfileiramento).
     - `ADV-M1-03`: Invocação repetida com parâmetros nulos, vazios ou indefinidos em modo headless.
     - `ADV-M1-04`: Cancelamento e limpeza de timeouts com `clear()` em estados ativo e saindo (`exiting`).
     - `ADV-M1-05`: Tolerância a falhas na função de áudio `onEventPlaySound` (exceções lançadas no handler).
     - `ADV-M1-06`: Função utilitária `formatStatChips` com atributos nulos, vazios ou corrompidos.
     - `ADV-M1-07`: `HUDController.update` com herói e `gameState` nulos ou corrompidos.

2. **Comando Executado e Saída do Runner**:
   - Comando: `npm test`
   - Resultado: 211 testes passaram, 2 testes falharam com erro fatal:

```
FAILURES DETAIL:

● Tier 1 Unit: M1 Adversarial Stress & Empirical Challenge > ADV-M1-03: Defensive resilience with null, undefined, and empty parameters
AssertionError: EventBannerManager crashed on null/empty arguments: showBanner(null), showBanner(), announceKill(hero, victim, null), showVictoryBanner(null), showDefeatBanner(null)
    at assertEqual (file:///C:/Users/Bruno/Downloads/jogo-duplinha/tests/helpers/assert.js:16:11)
    at Object.fn (file:///C:/Users/Bruno/Downloads/jogo-duplinha/tests/unit/m1_adversarial.test.js:201:5)

● Tier 1 Unit: M1 Adversarial Stress & Empirical Challenge > ADV-M1-06: ShopUI formatStatChips defensive handling with edge-case attributes
AssertionError: formatStatChips(null) must not throw
    at assertFalse (file:///C:/Users/Bruno/Downloads/jogo-duplinha/tests/helpers/assert.js:42:11)
    at Object.fn (file:///C:/Users/Bruno/Downloads/jogo-duplinha/tests/unit/m1_adversarial.test.js:327:5)
```

3. **Inspeção de Código — Localização Exata das Vulnerabilidades**:
   - **`src/ui/event_banners.js:79`**:
     ```javascript
     showBanner(bannerConfig) {
       const banner = {
         id: `banner_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
         type: bannerConfig.type || 'kill',
     ```
     *Problema:* Não há valor padrão `bannerConfig = {}` nem salvaguarda contra `null`. Chamar `showBanner()` ou `showBanner(null)` lança imediatamente `TypeError: Cannot read properties of undefined/null (reading 'type')`.
   
   - **`src/ui/event_banners.js:224-225`**:
     ```javascript
     announceKill(killerName = 'Herói', victimName = 'Inimigo', streakInfo = {}) {
       const isStreak = streakInfo.isStreak || (streakInfo.streak && streakInfo.streak >= 2) || (streakInfo.multiKill && streakInfo.multiKill >= 2);
     ```
     *Problema:* O valor padrão do JavaScript `streakInfo = {}` só atua quando o argumento é `undefined`. Se for passado `null` (ex: `announceKill('Knight', 'Enemy', null)`), `streakInfo.isStreak` lança `TypeError: Cannot read properties of null (reading 'isStreak')`.

   - **`src/ui/event_banners.js:305 e 317`**:
     ```javascript
     showVictoryBanner(stats = {}) {
       ... subtitle: stats.message || '...'
     showDefeatBanner(stats = {}) {
       ... subtitle: stats.message || '...'
     ```
     *Problema:* Se `stats` for passado como `null`, o acesso a `stats.message` lança `TypeError: Cannot read properties of null (reading 'message')`.

   - **`src/ui/shop_ui.js:8-10`**:
     ```javascript
     export function formatStatChips(stats = {}) {
       const chips = [];
       if (stats.attackDamage) chips.push(`+${stats.attackDamage} AD`);
     ```
     *Problema:* Se `stats` for passado como `null` (por exemplo, de um item sem bloco de atributos ou chamada direta), `stats.attackDamage` lança `TypeError: Cannot read properties of null (reading 'attackDamage')`.

4. **Comportamentos Aprovados nos Testes Adversariais**:
   - Spam simultâneo de 100 eventos (`ADV-M1-01`): A fila de prioridade manteve ordenação estrita e integridade de histórico sem corrupção de estado.
   - Preempção de prioridade (`ADV-M1-02`): Banners de prioridade superior (ex: Vitória = 1, Boss = 2) interrompem instantaneamente banners de prioridade inferior (ex: Kill = 6), re-enfileiram o banner interrompido e retomam a exibição após a conclusão.
   - Limpeza e timeouts (`ADV-M1-04`): `clear()` cancela tanto o timer de exibição (`timeoutId`) quanto o timer de transição CSS (`exitTimeoutId`), desanexando os elementos DOM e esvaziando a fila com idempotência.
   - Resiliência de áudio (`ADV-M1-05`): Erros atirados pelo callback `onEventPlaySound` são engolidos com segurança em bloco `try/catch`.
   - HUD Controller (`ADV-M1-07`): Atualizações com herói vazio ou campos corrompidos não derrubam a interface.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Requisito Direto do Dispatch**:
   - O orquestrador instruiu explicitamente no dispatch:
     *"Invocação repetida com parâmetros nulos, vazios ou indefinidos em modo headless."*
2. **Avaliação do Impacto no Jogo em Tempo Real**:
   - Durante partidas multiplayer P2P ou combate intenso, eventos de rede ou callbacks do simulador podem emitir notificações com payloads parciais ou nulos.
   - Qualquer `TypeError` não tratado dentro de `showBanner` ou `formatStatChips` quebra o loop principal de simulação ou a renderização do HUD, travando o cliente do jogador.
3. **Causa Raiz Identificada**:
   - Uso de atribuições padrão de parâmetro ES6 (`foo = {}`) sem coalescência nula interna (`const safe = foo || {};`), vulnerável a chamadas com argumento explícito `null`.
4. **Resolução de Baixo Risco**:
   - Adicionar `bannerConfig = {}` e `const cfg = bannerConfig || {};` em `showBanner`.
   - Adicionar `const info = streakInfo || {};` em `announceKill`.
   - Adicionar `const s = stats || {};` em `showVictoryBanner` e `showDefeatBanner`.
   - Adicionar `const s = stats || {};` em `formatStatChips`.

---

## 3. Caveats (Ressalvas)

- A arquitetura geral do `EventBannerManager`, estilos CSS, animações, 4 breakpoints responsivos e integração do HUD foram muito bem implementados e resistiram a 100 eventos simultâneos e preempções complexas sem memory leaks.
- A reprovação limita-se estritamente à falta de salvaguarda defensiva contra parâmetros `null` nas funções públicas mencionadas.
- O Challenger não corrigiu o código de implementação diretamente, cumprindo a restrição arquitetural `Review-only — do NOT modify implementation code`.

---

## 4. Conclusion (Conclusão e Ações Necessárias)

**Veredicto: REQUEST_CHANGES**

O Worker M1 deve realizar os seguintes pequenos ajustes defensivos para alcançar 100% de aprovação na suíte de testes (213/213):

1. **Em `src/ui/event_banners.js`**:
   - Na linha 79: Modificar assinatura para `showBanner(bannerConfig = {})` e adicionar `const cfg = bannerConfig || {};`, substituindo os acessos `bannerConfig.` por `cfg.`.
   - Na linha 224 (`announceKill`): Adicionar no topo `const info = streakInfo || {};` e usar `info.` em vez de `streakInfo.`.
   - Na linha 305 (`showVictoryBanner`): Adicionar `const s = stats || {};` e usar `s.message`.
   - Na linha 317 (`showDefeatBanner`): Adicionar `const s = stats || {};` e usar `s.message`.

2. **Em `src/ui/shop_ui.js`**:
   - Na linha 8 (`formatStatChips`): Adicionar `const s = stats || {};` e usar `s.attackDamage`, `s.ap`, etc.

Assim que essas salvaguardas forem adicionadas, todos os 213 testes passarão automaticamente.

---

## 5. Verification Method (Método de Verificação Independente)

Execute o comando padrão de testes do projeto:

```powershell
npm test
```

**Condição de Invalidação do Relatório / Aprovação Final:**
O relatório é considerado atendido quando o comando acima exibir:
```
Test Files:   28 passed (28 total)
Total Tests:  213
Passed:       213
Failed:       0
✔ ALL TEST SUITES PASSED CLEANLY!
```
