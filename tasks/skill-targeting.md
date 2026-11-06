# Mira assistida das habilidades — 2.3.0

Pedido: facilitar o sistema de alvos das skills, atualizar e publicar o jogo.

## Critérios de aceitação

- Desktop mantém mira pelo cursor com assistência limitada a 48 pixels; segunda tecla confirma e Shift + tecla lança diretamente.
- Toque breve em Q/W/E/R escolhe o alvo focado válido ou um inimigo próximo ao alcance; arraste permite mirar sem interromper o joystick do outro dedo.
- Soltar o arraste lança; retornar até 12 pixels do ponto inicial, perder foco/captura ou mudar orientação cancela sem gasto.
- Skills próprias são imediatas; arrastar permite visualizar a área sem gastar antes da confirmação.
- Clérigo prioriza aliados feridos nas curas, incluindo o próprio herói; mobilidade segue direção/distância escolhidas.
- Alcance, mana, rank, recarga e validação autoritativa continuam governando o combate.

## Implementação

`ability_targeting.js` resolve apenas a intenção local. `InputManager` gera comandos normais com coordenadas e ID para skills de alvo único; o anfitrião continua validando a execução. A interface usa o mesmo runtime de alcance da simulação. A assistência mantém tolerância em pixels sob zoom/rotação e não altera atributos ou dano.

`ability_button.js` acompanha um ponteiro por botão, captura gestos e remove listeners no fim da partida. O handler genérico de toque permanece nos botões de evolução e recall. O guia descreve os controles novos.

## Verificação e publicação

- Testes de regressão em `ability_targeting.test.js`, `skill_input.test.js` e `ability_button.test.js`.
- `npm test`: 394/394 testes aprovados em 56 arquivos.
- `tools/check-ability-targeting.mjs` para teclado, mouse, toque e multitouch no Chrome; `TARGET_BASE_URL` permite repetir em produção.
- `tools/verify-hud-production.mjs` confere HTTP 200 e SHA-256 dos módulos publicados e abre solo/loja em três resoluções; `PRODUCTION_SCREENSHOT_DIR` direciona as capturas.
- `tools/check-mobile-hud.mjs`: Chrome aprovado em sete resoluções de toque, quatro larguras desktop, cinco heróis, teclado, multitouch, loja e fallback de arte.
- Projeto Vercel existente: `jogo-duplinha`; produção em https://jogo-duplinha-blush.vercel.app/.
- Recuperação: `vercel rollback https://jogo-duplinha-bysgsuaeq-raixu01s-projects.vercel.app --yes` ou reverter os commits desta versão e publicar. Sem migração de dados.

## Release publicado em 2026-11-06

- Código: commit `2ba0aa7759e5d969908dccb314fac8764f697d8b`, tag `v2.3.0`, enviado para `origin/main`.
- Deploy Vercel `dpl_D1jttV3Juym8hX7DYQ2oMG97S7tU`, estado `READY`.
- URL imutável: https://jogo-duplinha-eeecre0ay-raixu01s-projects.vercel.app/.
- URL de produção: https://jogo-duplinha-blush.vercel.app/.
- Os 13 cenários de targeting passaram no Chrome local, sem exceções de runtime. A inspeção visual conferiu o alvo assistido e os indicadores de arraste em desktop, celular horizontal e retrato.
- Revisão independente sem bloqueadores; mutações de proteção de alvo e cancelamento de gesto foram detectadas pelos testes.
- Produção verificada sem substituir assets: 13/13 cenários de targeting aprovados, sem exceções de runtime. Resultados e nove capturas em `.playwright-cli/targeting-production/`.
- HTTP 200 e SHA-256 conferidos para 18 arquivos publicados (módulos, HUD e cinco atlas). Solo, joystick, arte e compra na loja aprovados em 844×390, 390×844 e 1280×800, sem exceções de runtime.
