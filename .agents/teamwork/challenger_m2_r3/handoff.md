# Relatório de Handoff do Challenger — Marco 2: UX, Feedback Tátil, Cursor Adaptativo e Tooltips Ricos

**Data**: 2026-10-18T01:14:00Z  
**Autor**: Challenger M2 (Crítico Adversarial / QA Empírico / Especialista)  
**Diretório de Trabalho**: `c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\challenger_m2_r3`  
**Escopo**: Verificação empírica adversarial dos entregáveis do Marco 2 (M2)  
**Veredicto**: **REQUEST_CHANGES**

---

## 1. Observation (Observações Diretas)

Foi executada a bateria de testes do projeto e um novo conjunto de testes de estresse adversarial (`tests/unit/tactile_ux_adversarial.test.js`) criado especificamente para verificar os limites do Marco 2 conforme despachado pelo orquestrador.

### A. Execução Geral de Testes (`npm test`)
Comando: `npm test`  
Resultado:
```
Test Files:   30 passed (30 total)
Total Tests:  225
Passed:       224
Failed:       1
Duration:     4.41s

FAILURES DETAIL:

● Tier 1 Unit: Adversarial Stress — Tactile UX, Particle Spam, Cursor State Machine & Tooltip Edge Cases (M2) > TC-ADV-UX-01: TooltipController with extreme, negative, malformed and missing values
AssertionError: Negative bonus should not format with "+-" (e.g. "+-75")
    at assertFalse (file:///C:/Users/Bruno/Downloads/jogo-duplinha/tests/helpers/assert.js:42:11)
    at Object.fn (file:///C:/Users/Bruno/Downloads/jogo-duplinha/tests/unit/tactile_ux_adversarial.test.js:30:5)
```

### B. Inspeção e Testes Empíricos Diretos em Node.js
Executando diagnóstico direcionado via Node:
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
Saída Verbatim:
```
1. Corrupted string stat: {
  base: 60,
  bonus: NaN,
  total: NaN,
  ratio: 0.6,
  stat: 'AD',
  type: 'Dano Físico',
  scalingText: '+NaN [60% AD] Dano Físico',
  summary: 'NaN (60 +NaN [60% AD] Dano Físico)'
}
2. NaN item stat: [
  {
    key: 'nanStat',
    icon: '⭐',
    label: 'nanStat',
    value: 'NaN',
    chipText: '⭐ NaN nanStat'
  }
]
3. Negative bonus scalingText: +-75 [75% AP] Dano Mágico
4. Rank 4 vs Rank 5 base: 235 85
```

### C. Comportamento Robusto Confirmado (PASS)
1. **`emitMoveIndicator` sob Spam Severo (TC-ADV-UX-02)**:
   - 100 cliques contínuos (700 partículas emitidas) e 500 cliques contínuos adicionais (3.500 partículas) foram estressados em sucessão.
   - O pool `this.particles` permaneceu estritamente travado em `maxParticles = 500` por despejo FIFO (`this.particles.shift()`).
   - Ciclos de atualização de 1.0s drenaram 100% das partículas expiradas, retornando a zero (`ps.particles.length === 0`). Sem vazamento de memória.
2. **Máquina de Estados de Cursor Adaptativo (TC-ADV-UX-03)**:
   - 1.000 transições rápidas entre estados (`target`, `attack`, `ally`, `shop`, `default`).
   - Precedência de alvos validada: `targetingState` sobrepõe alvos hostis; alvos hostis sobrepõem raio da loja; alvos aliados sobrepõem loja; ponteiro sobre si mesmo não aciona cursor aliado.
   - Resiliência total com `playerHeroRef = null`, `hoveredEntity = null`, entidades mortas (`hp: 0`, `isDead: true`).
3. **Flood de Teclas e Erros de Habilidade (TC-ADV-UX-04)**:
   - 750 invocações de flood (250 cooldown, 250 mana insuficiente, 250 sob crowd control) dispararam callbacks `onSkillError` com 100% de precisão nos parâmetros.
   - Textos flutuantes em `GameSimulation` foram gerados e limpos automaticamente pelo loop de partículas (`floatingTexts.length === 0`).

---

## 2. Logic Chain (Cadeia Lógica de Raciocínio)

1. **Defeito 1 — Propagação de `NaN` em `formatAbilityScaling` (`src/ui/tooltip.js:66–68`)**:
   - Em `src/ui/tooltip.js`, as linhas 66–68 realizam:
     `const ad = Number(hero?.attackDamage ?? hero?.ad ?? 0);`
   - Se `hero.attackDamage` for uma string inválida ou `NaN`, o operador `?? 0` não é acionado (pois a string não é null/undefined) e `Number('string')` avalia para `NaN`.
   - Nas linhas 183–186, `bonus` e `total` tornam-se `NaN`, gerando a string de exibição visual `"+NaN [60% AD] Dano Físico"`.
   - **Correção requerida**: Usar validação defensiva com `Number.isFinite`:
     ```javascript
     const parseStat = (v) => {
       const n = Number(v);
       return Number.isFinite(n) ? n : 0;
     };
     const ad = parseStat(hero?.attackDamage ?? hero?.ad);
     const ap = parseStat(hero?.ap ?? hero?.abilityPower);
     const armor = parseStat(hero?.armor);
     ```

2. **Defeito 2 — Formatação de Bônus Negativo com `+-` (`src/ui/tooltip.js:185`)**:
   - Na linha 185:
     `const scalingText = `+${bonus} [${Math.round(ratio * 100)}% ${stat}] ${type}`;`
   - Quando `bonus` é negativo (ex: herói sob debuff de AP/AD com -100 AP), `${bonus}` já inclui o sinal de menos (`-75`). O caractere `+` fixo faz a string exibir `"+-75 [75% AP] Dano Mágico"`.
   - **Correção requerida**:
     ```javascript
     const bonusSign = bonus >= 0 ? '+' : '';
     const scalingText = `${bonusSign}${bonus} [${Math.round(ratio * 100)}% ${stat}] ${type}`;
     ```

3. **Defeito 3 — Queda de Dano Base em Ranks Maiores que o Array (`src/ui/tooltip.js:81–167`)**:
   - Nos arrays de dano base por rank (ex: Sorceress Q `[85, 135, 185, 235][rank - 1] || 85`), caso a habilidade possua rank maior que o tamanho do array (ex: rank 5), o índice 4 é `undefined`.
   - A expressão faz fallback para `|| 85`, fazendo com que uma habilidade de rank superior sofra regressão catastrófica de 235 de dano base de volta para 85 de dano.
   - **Correção requerida**: Clampar o índice ao topo do array:
     ```javascript
     const getRankBase = (arr) => arr[Math.min(Math.max(0, rank - 1), arr.length - 1)] || arr[0];
     ```

4. **Defeito 4 — Inclusão de `NaN` nos Chips de Atributos de Itens (`src/ui/tooltip.js:201`)**:
   - Na linha 201:
     `if (typeof val !== 'number' || val === 0) continue;`
   - Em JavaScript, `typeof NaN === 'number'` e `NaN === 0` é `false`. Portanto, propriedades com valor `NaN` passam pelo filtro e renderizam um badge quebrado com `"⭐ NaN nanStat"`.
   - **Correção requerida**:
     ```javascript
     if (typeof val !== 'number' || Number.isNaN(val) || val === 0) continue;
     ```

5. **Nota de Arquitetura — Monkey-patching de `HUDController.flashAbilityError` (`src/game.js:27–39, 76–88`)**:
   - O método `flashAbilityError` foi injetado dinamicamente em `src/game.js` ao invés de residir na própria classe `HUDController` em `src/ui/hud.js`. Mover o método para `src/ui/hud.js` elimina a necessidade do protótipo no arquivo de simulação e assegura integridade modular.

---

## 3. Caveats (Ressalvas e Premissas)

- O Requisito R2 do Marco 2 tem excelente base e 3 dos 4 pilares testados (Partículas de Movimento sob spam, Máquina de Estados de Cursor e Callbacks de Erro com FCT) apresentaram performance impecável e robustez comprovada.
- Os 4 defeitos encontrados concentram-se pontualmente em `src/ui/tooltip.js` e são de fácil e rápida correção pelo Worker M2 (menos de 15 linhas de ajuste).
- As regras de integridade do Challenger determinam **Review-only** (o Challenger não deve alterar código de implementação de terceiros), preservando a divisão estrita de responsabilidades entre implementador e auditor.

---

## 4. Conclusion (Conclusão e Veredicto)

**Veredicto**: **REQUEST_CHANGES**

O Marco 2 está em 90% de conformidade, mas não pode ser aprovado integralmente até que as 4 falhas identificadas em `src/ui/tooltip.js` sejam saneadas e a suíte passe com 100% de aprovação (225/225 testes) em `npm test`:

### Alterações Requeridas para o Worker M2:
1. **Em `src/ui/tooltip.js:66–68`**:
   Sanear valores de `ad`, `ap` e `armor` com `Number.isFinite()` para impedir que strings inválidas ou `NaN` gerem `bonus: NaN` e `total: NaN`.
2. **Em `src/ui/tooltip.js:185`**:
   Ajustar formatação do bônus para `${bonus >= 0 ? '+' : ''}${bonus}` prevenindo strings `+-75`.
3. **Em `src/ui/tooltip.js:81–167`**:
   Clampar o índice de rank `[rank - 1]` ao último elemento do array de dano base para evitar que ranks maiores regridam para o rank 1.
4. **Em `src/ui/tooltip.js:201`**:
   Adicionar verificação `Number.isNaN(val)` em `formatItemStats` para ignorar valores `NaN`.

---

## 5. Verification Method (Método de Verificação Independente)

Após o Worker M2 aplicar as correções em `src/ui/tooltip.js`, executar:

```powershell
npm test
```
*Critério de Sucesso*: 30 arquivos de teste aprovados, **225 testes executados, 225 aprovados, 0 falhas**.
