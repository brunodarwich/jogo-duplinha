## 2026-10-18T01:12:44Z
Você é o Worker M2 Fix responsável por aplicar as 4 correções pontuais em src/ui/tooltip.js identificadas na auditoria adversarial do Marco 2.

Seu diretório de trabalho exclusivo é:
c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\worker_m2_fix_r3

LEIA OS ARQUIVOS:
1. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\challenger_m2_r3\handoff.md
2. c:\Users\Bruno\Downloads\jogo-duplinha\tests\unit\tactile_ux_adversarial.test.js
3. c:\Users\Bruno\Downloads\jogo-duplinha\src\ui\tooltip.js

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

ARQUIVOS DE SUA PROPRIEDADE EXCLUSIVA (WRITE OWNERSHIP):
- src/ui/tooltip.js
- src/ui/hud.js
- src/game.js

INSTRUÇÕES EXATAS DE IMPLEMENTAÇÃO:
1. Em `src/ui/tooltip.js`:
   a) Validação defensiva de stats em `formatAbilityScaling`:
      const parseStat = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };
      const ad = parseStat(hero?.attackDamage ?? hero?.ad);
      const ap = parseStat(hero?.ap ?? hero?.abilityPower);
      const armor = parseStat(hero?.armor);
   b) Formatação limpa de bônus negativo (evitar '+-'):
      const bonusSign = bonus >= 0 ? '+' : '';
      const scalingText = `${bonusSign}${bonus} [${Math.round(ratio * 100)}% ${stat}] ${type}`;
      const summaryText = `${total} (${base} ${bonusSign}${bonus} [${Math.round(ratio * 100)}% ${stat}] ${type})`;
   c) Clamping de índice de rank de habilidade:
      Criar helper:
      const getRankBase = (arr) => arr[Math.min(Math.max(0, rank - 1), arr.length - 1)] || arr[0];
      E utilizá-lo nas definições de dano base de cada habilidade para evitar regressão ao rank 1 quando rank > arr.length.
   d) Filtro de `NaN` em `formatItemStats`:
      if (typeof val !== 'number' || Number.isNaN(val) || val === 0) continue;

2. Em `src/ui/hud.js` e `src/game.js`:
   - Assegurar que `flashAbilityError(slot, reason)` esteja definido nativamente em `HUDController` e limpar monkey-patching duplicado.

3. Executar e Verificar:
   - Rodar 'npm test' e certificar-se de que TODOS os 225 testes passem com 100% de sucesso (30/30 arquivos, 0 falhas).

4. Escrever relatório em:
   c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\worker_m2_fix_r3\handoff.md
   E enviar mensagem ao orquestrador.
