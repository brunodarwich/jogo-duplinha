## 2026-10-18T00:49:13Z
Você é o Worker M2 responsável pela implementação do Marco 2: Experiência do Jogador (UX), Feedback Tátil, Retículo e Onda de Movimento, Cursor Adaptativo e Tooltips Ricos.

Seu diretório de trabalho exclusivo é:
c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\worker_m2_r3

LEIA OS ARQUIVOS AUTORITATIVOS:
1. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md (Requisito R2 e critérios)
2. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r3\PROJECT.md (Milestone 2 e contratos)
3. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r3_2\handoff.md (Especificação minuciosa do Explorer 2)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

ARQUIVOS DE SUA PROPRIEDADE EXCLUSIVA (WRITE OWNERSHIP):
- src/ui/tooltip.js (criar novo)
- src/core/input.js (atualizar cursor adaptativo e onSkillError)
- src/render/particles.js (adicionar emitMoveIndicator com ondas concêntricas 2:1 e retículo)
- src/game.js (conectar emitMoveIndicator e ganchos de erro de conjuração)
- style.css (estilos do tooltip, cursores SVG data-URI e animações de erro de cast)
- tests/unit/tactile_ux.test.js (criar)

INSTRUÇÕES DETALHADAS DE IMPLEMENTAÇÃO:
1. Em src/render/particles.js:
   - Adicionar método emitMoveIndicator(x, y, color = '#10b981', isAttack = false) na classe ParticleSystem:
     * Gera 3 ondas concêntricas expansivas em elipse isométrica 2:1 (radius * zoom por radius * 0.5 * zoom) com tempos de início escalonados.
     * Gera 4 marcadores/chevrons de retículo central convergindo para (x, y).
     * Cor '#10b981' para movimento puro no chão, '#ef4444' para ataque/A-move, '#38bdf8' para aliados/fountain.
2. Em src/core/input.js:
   - Implementar cursores adaptativos em updateCanvasCursor():
     * Se this.targetingState -> cursor de mira.
     * Se this.hoveredEntity hostil -> cursor de ataque (espada/mira carmesim).
     * Se this.hoveredEntity aliada -> cursor aliado radiante.
     * Se sobre a loja/fonte -> cursor de comércio/loja.
     * Caso contrário -> cursor default.
     * Utilizar SVG Data-URIs embutidos nítidos com hotspots calibrados ou classes CSS.
   - Em triggerAbility(slot):
     * Se em recarga: acionar callback this.onSkillError?.(slot, 'cooldown', ability.cooldownRemaining).
     * Se sem mana: acionar callback this.onSkillError?.(slot, 'mana', ability.manaCost - hero.mana).
     * Se sob CC: acionar callback this.onSkillError?.(slot, 'cc').
3. Em src/ui/tooltip.js:
   - Criar classe TooltipController com elemento singleton #game-tooltip:
     * showAbilityTooltip(ability, hero, targetEl): calcula dano base + escalamento AD/AP do herói em tempo real (ex: '+45 [60% AP] Dano Mágico'), badges de mana, recarga, alcance e descrição.
     * showItemTooltip(item, targetEl): exibe tier, badges de atributos (+AD, +HP, etc.), preço de compra, preço de venda e passivas.
     * hide(): esconde tooltip.
     * Boundary clamping: garante que o tooltip nunca transborde as bordas da janela.
     * Proteção estrita contra headless (if (typeof document === 'undefined') return;).
4. Em src/game.js:
   - No tratamento de MOVE_TO e ATTACK_TARGET, invocar this.particles.emitMoveIndicator(...).
   - Conectar ouvinte input.onSkillError:
     * Chamar this.hud.flashAbilityError(slot, reason) (aplicando classe .cast-error-shake no slot).
     * Emitir texto flutuante com particles.addFloatingText: 'Sem Mana!' (#38bdf8), 'Em Recarga!' (#f59e0b) ou 'Impossibilitado!' (#c084fc).
5. Em style.css:
   - Estilização moderna do #game-tooltip (glassmorphism, bordas suaves, tipografia refinada).
   - Animações CSS @keyframes castErrorShake e @keyframes castErrorFlash.
   - Regras de cursores customizados.
6. Em tests/unit/tactile_ux.test.js:
   - Testar emissão de ondas e retículo de movimento, transições de estado do cursor adaptativo, cálculos do TooltipController com escalamento de AD/AP, disparos de erro de conjuração e segurança headless.
7. Executar 'npm test':
   - Todos os 213 testes pré-existentes + novos testes DEVEM passar com 100% de sucesso.
8. Escrever relatório em:
   c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\worker_m2_r3\handoff.md
   E enviar mensagem ao orquestrador.
