## 2026-10-18T00:39:22Z

Você é o Worker M1 Fix responsável por aplicar as correções pontuais de robustez defensiva em src/ui/event_banners.js e src/ui/shop_ui.js identificadas na auditoria adversarial do Marco 1.

Seu diretório de trabalho exclusivo é:
c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\worker_m1_fix_r3

LEIA OS ARQUIVOS:
1. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\challenger_m1_r3\handoff.md
2. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\reviewer_m1_r3\handoff.md
3. c:\Users\Bruno\Downloads\jogo-duplinha\tests\unit\m1_adversarial.test.js

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

ARQUIVOS DE SUA PROPRIEDADE EXCLUSIVA (WRITE OWNERSHIP):
- src/ui/event_banners.js
- src/ui/shop_ui.js

INSTRUÇÕES EXATAS DE CORREÇÃO:
1. Em `src/ui/event_banners.js`:
   - No método `showBanner(bannerConfig = {})`:
     Adicione guard clause segura:
     `const cfg = bannerConfig || {};`
     E use `cfg` em vez de acessar diretamente `bannerConfig.type`, `bannerConfig.title`, etc.
   - No método `announceKill(killerName = 'Herói', victimName = 'Inimigo', streakInfo = {})`:
     Adicione guard clause segura:
     `const info = streakInfo || {};`
     E use `info.isStreak`, `info.streak`, `info.multiKill`, etc.
   - Nos métodos `showVictoryBanner(stats = {})` e `showDefeatBanner(stats = {})`:
     Adicione guard clause segura:
     `const s = stats || {};`
     E use `s.message`, etc.
   - Certifique-se de que nenhum método em `EventBannerManager` lance exceção se receber `null` ou `undefined`.

2. Em `src/ui/shop_ui.js`:
   - Na função `formatStatChips(stats = {})`:
     Se `!stats || typeof stats !== 'object'`, retorne imediatamente `[]`.
     Utilize label compatível com ADV-M1-06 para armor:
     `if (stats.armor) chips.push(\`+${stats.armor} Armor\`);`
     E certifique-se de validar se o valor é numérico positivo (ex: `stats.attackDamage > 0`).

3. Executar e Verificar:
   - Rodar `npm test` no terminal.
   - Certificar-se de que TODOS os 213 testes (197 legados + 9 de hud_banners + 7 de m1_adversarial) passem com 100% de sucesso (0 falhas).

4. Escrever relatório em:
   c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\worker_m1_fix_r3\handoff.md
   E enviar mensagem ao orquestrador.
