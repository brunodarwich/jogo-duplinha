## 2026-10-18T00:17:47Z
Você é o Worker M1 responsável pela implementação do Marco 1: Interface de Usuário Moderna, Banners Dinâmicos de Eventos, Loja e Responsividade.

Seu diretório de trabalho exclusivo é:
c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\worker_m1_r3

ARQUIVOS AUTORITATIVOS QUE VOCÊ DEVE LER ANTES DE COMEÇAR:
1. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md (Requisito R1 e critérios)
2. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r3\PROJECT.md (Arquitetura, Milestone 1 e Contratos)
3. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r3_1\handoff.md (Especificação minuciosa do Explorer 1)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

ARQUIVOS DE SUA PROPRIEDADE EXCLUSIVA (WRITE OWNERSHIP):
- src/ui/event_banners.js (criar)
- index.html (atualizar)
- style.css (atualizar)
- src/ui/hud.js (atualizar)
- src/ui/shop_ui.js (atualizar)
- src/game.js (atualizar ganchos de eventos)
- tests/unit/hud_banners.test.js (criar)

INSTRUÇÕES DE IMPLEMENTAÇÃO:
1. Criar src/ui/event_banners.js exportando EventBannerManager:
   - Fila de prioridade: Fim de Jogo Vitória/Derrota (1) > Boss Spawn/Slain (2) > First Blood (3) > Torres (4) > Kill Streaks (5) > Abate Normal (6).
   - Suporte a showBanner, announceFirstBlood, announceKill, announceTowerDestroyed, announceBossSpawn, announceBossSlain, showVictoryBanner, showDefeatBanner, clear.
   - Timers limpos de remoção de banner e suporte headless rigoroso (se typeof document === 'undefined', operar sem crash).
2. Atualizar index.html:
   - Inserir container de banners: <div id="event-banner-container" class="event-banner-container"></div> dentro de #hud-overlay.
   - Inserir botão de controle de áudio no top-hud: <button id="btn-audio-toggle" class="audio-toggle-btn" title="Alternar Áudio (Mute/Ativar)">🔊</button>.
   - Adicionar modal épico de fim de jogo #endgame-modal.
3. Atualizar style.css:
   - Estilos refinados com glassmorphism, sombras neon e gradientes para banners de evento.
   - Animações CSS: bannerSlideDown, bannerGlow, bannerExit, lowHpPulse (pulso vermelho quando vida <= 25%), e animação de habilidade pronta.
   - Breakpoints de responsividade:
     * > 1200px: layout pleno.
     * 961px - 1200px: minimapa reduzido para 160px e espaçamentos ajustados para zero colisão com inventário.
     * 641px - 960px: inventário preservado em linha mini-strip (NÃO ocultar o inventário!).
     * <= 640px: adaptação compacta.
   - Estilização do botão de áudio #btn-audio-toggle.
4. Atualizar src/ui/hud.js:
   - Integrar EventBannerManager ao HUDController.
   - Detectar e aplicar classe .critical na barra de vida quando HP <= 25%.
   - Detectar fim de cooldown e aplicar classe efêmera .ready-burst.
5. Atualizar src/ui/shop_ui.js:
   - Exibir chips de atributos nos cards de item (+35 AD, +300 HP, etc.).
   - Sincronizar classes de cor de tier (tier-1, tier-2, tier-3) nos cards e slots.
6. Integrar em src/game.js:
   - Rastrear firstBloodClaimed e kill streaks.
   - Disparar anúncios no EventBannerManager ao abater heróis, torres, bosses e na vitória/derrota.
7. Criar tests/unit/hud_banners.test.js:
   - Testar instanciamento, prioridade da fila, criação de banners para cada tipo de evento, remoção por timeout e segurança headless.
8. Executar e Verificar:
   - Rodar 'npm test' e certificar-se de que TODOS os 197 testes pré-existentes + novos testes passem com 100% de sucesso.
9. Escrever relatório final em:
   c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\worker_m1_r3\handoff.md
   E enviar mensagem ao orquestrador.
