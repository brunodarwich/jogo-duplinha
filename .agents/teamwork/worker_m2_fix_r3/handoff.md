# Relatório de Handoff — Correções Adversariais do Marco 2 (M2 Fix)

**Data**: 2026-10-18T01:18:00Z  
**Autor**: Worker M2 Fix (Implementer / QA / Specialist)  
**Diretório de Trabalho**: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\worker_m2_fix_r3`  
**Escopo**: Correções pontuais em `src/ui/tooltip.js`, `src/ui/hud.js` e `src/game.js`  
**Veredicto**: **COMPLETE / READY FOR REVIEW**

---

## 1. Observation (Observações Diretas)

1. **Estado Inicial dos Testes**:
   - `npm test` falhava em `tests/unit/tactile_ux_adversarial.test.js`:
     ```
     ● Tier 1 Unit: Adversarial Stress — Tactile UX, Particle Spam, Cursor State Machine & Tooltip Edge Cases (M2) > TC-ADV-UX-01: TooltipController with extreme, negative, malformed and missing values
     AssertionError: Negative bonus should not format with "+-" (e.g. "+-75")
     Passed: 224, Failed: 1 (Total: 225)
     ```
2. **Defeitos Identificados pelo Challenger em `src/ui/tooltip.js`**:
   - Validação frágil de stats em `formatAbilityScaling`: `Number('not_a_number') ?? 0` resultava em `NaN`, propagando `bonus: NaN` e `total: NaN`.
   - Formatação com sinal fixo `+${bonus}` gerava `+-75` quando `bonus < 0`.
   - Indexação de dano base `[...][rank - 1] || default` regredia para o dano de rank 1 quando `rank > arr.length` (ex: Rank 5 de Sorceress Q caía para 85 em vez de clampar no rank 4 de 235).
   - `formatItemStats` deixava passar propriedades com valor `NaN`, renderizando `"⭐ NaN nanStat"`.
3. **Acoplamento em `src/game.js`**:
   - `HUDController.prototype.flashAbilityError` e `this.hud.flashAbilityError` eram injetados via monkey-patching em tempo de execução no arquivo `src/game.js` ao invés de residirem nativamente na classe `HUDController` em `src/ui/hud.js`.

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Validação Defensiva de Atributos (`src/ui/tooltip.js`)**:
   - Adicionada a função helper `parseStat(v)` com `Number.isFinite(n) ? n : 0`.
   - Atributos `ad`, `ap` e `armor` agora são saneados contra strings não numéricas, objetos corrompidos, `null` ou `undefined`, garantindo que cálculos de escalonamento nunca produzam `NaN`.

2. **Formatação Limpa de Bônus Negativos (`src/ui/tooltip.js`)**:
   - Implementado `const bonusSign = bonus >= 0 ? '+' : '';`.
   - Para valores negativos, o sinal de menos intrínseco do número é exibido sem o prefixo `+`, resultando em `-75 [75% AP] Dano Mágico` e prevenindo `+-75`.

3. **Clamping Robusto de Ranks de Habilidades (`src/ui/tooltip.js`)**:
   - Implementado o helper:
     ```javascript
     const getRankBase = (arr) => arr[Math.min(Math.max(0, rank - 1), arr.length - 1)] || arr[0];
     ```
   - Aplicado a todas as definições de dano base por classe (Sorceress, Knight, Ranger, Assassin, Cleric).
   - Ranks superiores ao tamanho do array agora clampam no valor do rank máximo (ex: rank 5 de Sorceress Q resulta em 235 de dano base em vez de 85).

4. **Filtro de `NaN` em Itens (`src/ui/tooltip.js`)**:
   - Adicionada a cláusula `Number.isNaN(val)` em `formatItemStats`:
     ```javascript
     if (typeof val !== 'number' || Number.isNaN(val) || val === 0) continue;
     ```
   - Itens com atributos corrompidos (`NaN`) são descartados e não geram badges inválidos.

5. **Definição Nativa de `flashAbilityError` (`src/ui/hud.js` & `src/game.js`)**:
   - Adicionado o método nativo `flashAbilityError(slot, reason)` à classe `HUDController` em `src/ui/hud.js`.
   - Removido o monkey-patching duplicado no protótipo e na instância presente em `src/game.js` (linhas 26–40 e 76–88).

---

## 3. Caveats (Ressalvas e Premissas)

- Nenhuma funcionalidade além das 4 correções especificadas em `tooltip.js` e do refactoring de modularidade de `flashAbilityError` foi alterada.
- A integridade de compatibilidade regressiva de `summary` e `summaryText` foi preservada no retorno de `formatAbilityScaling`.
- Não houve necessidade de alterar arquivos de teste existentes.

---

## 4. Conclusion (Conclusão)

Todas as 4 correções identificadas pelo Challenger e solicitadas no despacho foram implementadas com integridade genuína.
- O monkey-patching de `flashAbilityError` foi eliminado, tornando a arquitetura modular e aderente ao padrão da classe.
- A suíte completa de testes passou com 100% de sucesso: **30 arquivos de teste, 225 testes executados, 225 testes aprovados, 0 falhas**.

---

## 5. Verification Method (Método de Verificação Independente)

Para reproduzir e auditar de forma independente:

1. **Sintaxe dos arquivos modificados**:
   ```powershell
   node -c src/ui/tooltip.js src/ui/hud.js src/game.js
   ```
   *Resultado esperado*: Exit code 0, sem erros.

2. **Verificação empírica dos 4 casos de borda**:
   ```powershell
   node -e "
   import('./src/ui/tooltip.js').then(({ TooltipController }) => {
     const tc = new TooltipController();
     console.log('1. Corrupted string stat:', tc.formatAbilityScaling({ id: 'Q' }, { attackDamage: 'not_a_number' }));
     console.log('2. NaN item stat:', tc.formatItemStats({ stats: { nanStat: NaN } }));
     console.log('3. Negative bonus scalingText:', tc.formatAbilityScaling({ id: 'Q' }, { heroId: 'sorceress', ap: -100 }).scalingText);
     console.log('4. Rank 4 vs Rank 5 base:', 
       tc.formatAbilityScaling({ id: 'Q', rank: 4 }, { heroId: 'sorceress' }).base,
       tc.formatAbilityScaling({ id: 'Q', rank: 5 }, { heroId: 'sorceress' }).base
     );
   });
   "
   ```
   *Resultados esperados*:
   - `Corrupted string stat`: `bonus: 0`, `total: 60`, `scalingText: '+0 [60% AD] Dano Físico'`
   - `NaN item stat`: `[]`
   - `Negative bonus scalingText`: `-75 [75% AP] Dano Mágico`
   - `Rank 4 vs Rank 5 base`: `235 235`

3. **Execução completa dos testes**:
   ```powershell
   npm test
   ```
   *Resultado esperado*: 30/30 arquivos aprovados, **225/225 testes aprovados (0 falhas)**.
