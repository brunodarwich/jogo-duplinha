# Tarefas: melhorar jogabilidade, visual e cooperativo

Estado: implementação concluída após aprovação do usuário; GitHub e deploy autorizados. Escopo: as três frentes confirmadas pelo usuário. O plano anterior foi concluído e está preservado em `tasks/archive/combat-animations-plan.md` e `tasks/archive/combat-animations-todo.md`.

Este arquivo é a lista oficial de execução; decisões e riscos ficam em `tasks/plan.md`. Cada tarefa entrega uma mudança verificável e deve manter o jogo funcionando. Depois da aprovação inicial, os checkpoints são verificações técnicas; nova aprovação só é necessária se o escopo mudar.

Comandos existentes: `npm test` executa a suíte completa; `node tests/runner.js "expressão"` seleciona arquivos por regex; `npm start` serve o jogo em `http://localhost:3000`. Não existe etapa de build. Os testes novos indicados abaixo precisam ser criados na respectiva tarefa; seus filtros ainda não comprovam cobertura antes disso. A suíte em Node não substitui os cenários de navegador.

## Fase 1: contratos e habilidades confiáveis

## Tarefa 1: definir o contrato de snapshots versionados

**Descrição:** Definir a representação do estado autoritativo para permitir a evolução do cooperativo em etapas, sem mudar o transporte ativo nesta tarefa. O contrato deve reconstruir o estado em uma simulação receptora sem depender dos objetos mutáveis do emissor.

**Critérios de aceitação:**
- [x] O snapshot inclui versão do protocolo, identificador de partida, sequência/tick, IDs estáveis, estado do mundo e dos heróis, recursos, inventários e tempos restantes de cooldowns, barreiras, efeitos temporários, mobilidade e invisibilidade, regidos pelo relógio do host.
- [x] Serialização e aplicação preservam os valores necessários ao jogo, sem compartilhar referências; dados inválidos, versões incompatíveis e snapshots repetidos ou antigos têm comportamento explícito e testado.
- [x] Um teste de ida e volta inclui unidades, estruturas, chefe, projéteis/efeitos persistentes e término da partida; o modo solo e a rede atual continuam funcionando enquanto o novo contrato ainda não é ativado.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "world_sync|protocol|multiplayer"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: iniciar solo e sala de teste e confirmar que seleção, início e comandos existentes continuam disponíveis.

**Dependências:** nenhuma.

**Arquivos prováveis:** `src/net/world_state.js` (novo), `src/net/protocol.js`, `tests/unit/world_sync.test.js` (novo).

**Escopo estimado:** médio, 3 arquivos.

## Tarefa 2: impedir lançamentos inválidos de habilidades

**Descrição:** Tornar coerente a validação de habilidades no comando executado, na entrada e no HUD. A habilidade não aprendida ou bloqueada deve explicar sua indisponibilidade sem consumir recursos nem produzir um ataque visual válido.

**Critérios de aceitação:**
- [x] Rank zero, morte, controle de grupo impeditivo, cooldown e mana insuficiente impedem o lançamento tanto por atalho quanto pelo HUD e pelo processamento direto do comando.
- [x] Um comando rejeitado preserva mana, cooldown, posição e estado de combate, sem criar dano, projétil ou animação de lançamento; a tentativa seguinte válida funciona.
- [x] O HUD diferencia habilidade não aprendida, em recarga e sem mana, mantendo os atalhos de evolução e o feedback de erro existentes.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "ability_runtime|input|leveling|hero_action"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: testar Q/W/E/R antes de aprender, depois de evoluir, sem mana e sob controle de grupo.

**Dependências:** nenhuma; pode ser preparada em paralelo à Tarefa 1, sem editar seus arquivos.

**Arquivos prováveis:** `src/game.js`, `src/core/input.js`, `src/ui/hud.js`, `tests/unit/ability_runtime.test.js` (novo).

**Escopo estimado:** médio, 4 arquivos.

## Tarefa 3: aplicar a progressão real dos cinco heróis

**Descrição:** Fazer a execução das habilidades usar valores coerentes com seu rank atual e sua apresentação. Abranger os cinco heróis e somente as mecânicas já presentes no código. Os helpers antigos de `heroes.js` não são uma especificação automática: `sorceressEDamage` não corresponde ao blink atual, e `clericEShield` não corresponde ao E de dano atual.

**Critérios de aceitação:**
- [x] Cada habilidade tem escala por rank definida para seu efeito atual; fórmulas existentes só são reutilizadas quando correspondem à mecânica vigente, e dano, cura, proteção, duração, alcance ou cooldown são aplicados conforme essa definição.
- [x] Testes de execução cobrem os cinco heróis, com comparação entre o primeiro e o último rank permitido e os desbloqueios de R; rank inválido não concede efeito.
- [x] Texto/valores apresentados e resultado executado coincidem; a tarefa não introduz uma mecânica nova para preencher descrições ainda não implementadas.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "ability_runtime|heroes|leveling|hero_action"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: comparar habilidades antes e depois de evoluir para cada herói, observando recursos e resultado no alvo.

**Dependências:** Tarefa 2.

**Arquivos prováveis:** `src/game.js`, `src/entities/heroes.js`, `tests/unit/ability_runtime.test.js`.

**Escopo estimado:** médio, 3 arquivos.

## Checkpoint: após as Tarefas 1–3

- [ ] Contrato de estado tem testes de ida e volta e rejeição de entradas inválidas.
- [ ] `npm test` passa; habilidades aprendidas e não aprendidas funcionam conforme os critérios.
- [ ] Uma partida solo inicia e permanece jogável no navegador, sem erros novos de console.

## Fase 2: movimento e dano coerentes

## Tarefa 4: respeitar controle de grupo no movimento do herói

**Descrição:** Corrigir o movimento efetivo do herói para que comandos e deslocamentos respeitem os controles de grupo já suportados, sem perder a referência de velocidade após a expiração dos efeitos.

**Critérios de aceitação:**
- [x] Atordoamento e imobilização impedem os deslocamentos que suas regras atuais devem bloquear; lentidão altera a distância percorrida no tempo simulado.
- [x] Expiração, sobreposição e morte removem/restauram corretamente os efeitos, sem acumular alterações permanentes na velocidade base ou nos bônus de itens.
- [x] Mouse e comando de movimento seguem a mesma regra; controle de grupo não permite atravessar limites ou terreno bloqueado.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "movement_cc|cc|input|player_attack"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: mover sob lentidão, raiz e atordoamento, depois confirmar recuperação do movimento.

**Dependências:** Tarefas 2 e 3.

**Arquivos prováveis:** `src/entities/entity.js`, `src/game.js`, `tests/unit/movement_cc.test.js` (novo).

**Escopo estimado:** médio, 3 arquivos.

## Tarefa 5: respeitar controle de grupo nos lacaios

**Descrição:** Fazer a marcha e perseguição dos lacaios respeitarem o controle de grupo que recebem, preservando sua rota e a retomada de decisões ao terminar o efeito.

**Critérios de aceitação:**
- [x] Lacaios corpo a corpo, à distância e canhoneiros têm deslocamento bloqueado ou reduzido de acordo com os efeitos existentes.
- [x] A expiração retoma a rota ou perseguição válida e não restaura um alvo morto, causa travamento ou altera permanentemente a velocidade.
- [x] Composições de ondas e comportamento de ataque fora do efeito permanecem consistentes com as regras atuais.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "movement_cc|minion|cc"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: atingir uma onda com controle de grupo e observar parada/lentidão e retomada.

**Dependências:** Tarefa 4.

**Arquivos prováveis:** `src/world/minion.js`, `tests/unit/movement_cc.test.js`.

**Escopo estimado:** pequeno, 2 arquivos.

## Tarefa 6: unificar o dano das habilidades

**Descrição:** Encaminhar o dano das habilidades pelo mesmo processamento de combate, preservando autoria, tipo de dano e as defesas já implementadas. O objetivo é evitar caminhos que alterem HP ignorando regras comuns.

**Critérios de aceitação:**
- [x] Dano direto e periódico das habilidades usa um caminho comum com origem, alvo e tipo de dano; resistências e proteções existentes são aplicadas exatamente uma vez.
- [x] Testes contrastam dano físico, mágico e verdadeiro onde suportados, incluindo alvo protegido, morte e dano periódico; HP não recebe valores inválidos ou dupla redução.
- [x] Cura e proteção mantêm sua semântica e os efeitos visuais refletem o dano efetivamente causado, sem inventar novas passivas.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "damage_runtime|combat|ability_runtime|inventory"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: comparar habilidade contra alvo sem defesa, com defesa e protegido, conferindo HP e feedback.

**Dependências:** Tarefa 3.

**Arquivos prováveis:** `src/combat/combat.js`, `src/game.js`, `src/entities/entity.js`, `tests/unit/damage_runtime.test.js` (novo).

**Escopo estimado:** médio, 4 arquivos.

## Checkpoint: após as Tarefas 4–6

- [ ] `npm test` passa e os testes de movimento medem distância real durante os efeitos.
- [ ] Habilidades têm um caminho de dano verificável com autoria e defesas consistentes.
- [ ] Uma luta com onda e herói no navegador confirma expiração dos efeitos e continuidade da partida.

## Fase 3: recompensas e estado compartilhado

## Tarefa 7: unificar o dano de unidades e estruturas

**Descrição:** Integrar ataques de lacaios, torres e chefes ao processamento comum de dano, mantendo as regras especiais existentes de cada unidade.

**Critérios de aceitação:**
- [x] Ataques e efeitos danosos de lacaios, torres e chefes percorrem o mesmo processamento de combate com atacante identificado e defesas coerentes.
- [x] Escalada de dano das torres, resistências específicas de chefes e vulnerabilidade das estruturas preservam suas regras atuais, sem aplicação duplicada.
- [x] Testes de confronto exercitam unidades contra herói e estrutura, inclusive morte e alvo inválido, sem dano após a resolução da morte.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "damage_runtime|minion|tower|boss|combat"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: verificar tiros consecutivos de torre, ataque de chefe e avanço de uma onda sobre estrutura.

**Dependências:** Tarefas 5 e 6.

**Arquivos prováveis:** `src/world/minion.js`, `src/world/tower.js`, `src/world/boss.js`, `src/combat/combat.js`, `tests/unit/damage_runtime.test.js`.

**Escopo estimado:** médio, 5 arquivos.

## Tarefa 8: atribuir recompensas ao participante correto

**Descrição:** Resolver recompensas a partir da autoria real do combate e do evento de morte, para que ouro e XP não dependam de qual herói é local na simulação observadora.

**Critérios de aceitação:**
- [x] Abate de lacaio concede recompensa ao autor elegível, e recompensas coletivas seguem as regras existentes para os participantes elegíveis.
- [x] Reprocessar uma morte não concede ouro ou XP outra vez; unidade sem autor válido não atribui arbitrariamente o abate ao herói local.
- [x] Cenários com dois e três heróis distinguem quem causou o abate e quem recebe a parcela coletiva, incluindo torre e chefe.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "economy_flow|economy|multiplayer|leveling"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: registrar ouro antes e depois de abates solo; cenários cooperativos completos serão repetidos após a Tarefa 11.

**Dependências:** Tarefas 6 e 7.

**Arquivos prováveis:** `src/game.js`, `tests/unit/economy_flow.test.js`, `tests/unit/multiplayer.test.js`.

**Escopo estimado:** médio, 3 arquivos.

## Tarefa 9: replicar o mundo simulado pelo host

**Descrição:** Integrar os snapshots sob uma opção interna de desenvolvimento, para que o host seja a origem do estado de mundo compartilhado e convidados recebam a mesma simulação de ondas, estruturas, chefe e efeitos. Manter o caminho cooperativo atual como padrão até a validação conjunta da Tarefa 12.

**Critérios de aceitação:**
- [x] Somente o host avança a simulação autoritativa de ondas, unidades, estruturas, chefe e término; convidados aplicam o estado replicado sem criar um segundo mundo independente.
- [x] IDs, HP, posições, spawns, remoções e tempos restantes convergem após cada snapshot; pacotes repetidos ou atrasados não ressuscitam entidades nem revertem o resultado da partida.
- [x] Solo permanece jogável e o cooperativo atual continua sendo o padrão durante a migração; o caminho novo é opt-in interno, com política de apresentação local explícita e sem depender de comandos ainda não implementados nas Tarefas 10–11 para preservar o fluxo atual.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "world_sync|multiplayer|protocol|hero_action"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: em duas abas, comparar a mesma onda, HP de torre, fase do chefe e destruição do Nexus.

**Dependências:** Tarefas 1, 7 e 8.

**Arquivos prováveis:** `src/game.js`, `src/net/peer_network.js`, `src/net/world_state.js`, `tests/unit/world_sync.test.js`.

**Escopo estimado:** médio, 4 arquivos.

## Checkpoint: após as Tarefas 7–9

- [ ] `npm test` passa; recompensas não dependem do observador e mortes são processadas uma vez.
- [ ] Host e convidado exibem o mesmo mundo e resultado ao destruir uma estrutura em teste real.
- [ ] Pacotes antigos/duplicados têm regressões automatizadas e solo continua jogável.

## Fase 4: cooperação autoritativa completa

## Tarefa 10: executar comandos de combate no host

**Descrição:** No caminho autoritativo habilitado pela opção interna de desenvolvimento, enviar intenções de movimento, ataque e habilidade dos convidados ao host, validando propriedade e elegibilidade antes de executar ações. O caminho atual permanece padrão até a Tarefa 12.

**Critérios de aceitação:**
- [x] Comandos carregam jogador, partida e sequência; o host aceita somente ações do herói associado à conexão e rejeita entradas inválidas, repetidas ou incompatíveis.
- [x] Movimento, ataque, habilidade, parar e recall são executados pelo host com as mesmas regras do solo; mana, cooldown, controle de grupo e dano pertencem a uma única execução.
- [x] Dois e três participantes veem o mesmo resultado, inclusive habilidades simultâneas; predição/apresentação local, se usada, é reconciliada sem duplicar efeitos ou recompensas.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "world_sync|multiplayer|input|ability_runtime"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: convidado move, ataca, lança habilidade e usa recall enquanto host observa o mesmo resultado.

**Dependências:** Tarefas 2, 4 e 9.

**Arquivos prováveis:** `src/core/input.js`, `src/game.js`, `src/net/peer_network.js`, `src/net/world_state.js`, `tests/unit/world_sync.test.js`.

**Escopo estimado:** médio, 5 arquivos.

## Tarefa 11: centralizar economia e progressão no host

**Descrição:** No caminho autoritativo habilitado pela opção interna de desenvolvimento, submeter compras, vendas, evolução de habilidades e alterações de recursos à mesma autoridade da partida. Manter os cheats existentes por um caminho coerente e restrito ao host; preservar o cooperativo atual como padrão até a Tarefa 12.

**Critérios de aceitação:**
- [x] Host valida ouro, slot, item, localização da loja e pontos de habilidade; convidados solicitam ações e exibem o estado confirmado de recursos, inventário e ranks.
- [x] Compra, venda, abate e evolução repetidos ou concorrentes não duplicam ouro/XP/itens, e uma solicitação rejeitada mantém o estado anterior com feedback.
- [x] Cheats existentes que alteram a partida só podem ser executados pelo host e replicam seus efeitos pelo caminho autoritativo; ajuda e controles locais continuam disponíveis aos convidados.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "world_sync|economy_flow|shop|inventory|leveling|boost"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: host e convidado compram, vendem e evoluem; comparar recursos após abate e confirmar rejeição de cheat do convidado.

**Dependências:** Tarefas 8 e 10.

**Arquivos prováveis:** `src/main.js`, `src/game.js`, `src/ui/shop_ui.js`, `src/net/peer_network.js`, `tests/unit/world_sync.test.js`.

**Escopo estimado:** médio, 5 arquivos.

## Tarefa 12: tornar explícito o ciclo da conexão

**Descrição:** Completar o ciclo de sala e partida com negociação de versão, início sincronizado, preservação da entrada tardia já existente e tratamento explícito de desconexão. Remover conexões e ouvintes encerrados e habilitar o novo caminho como padrão somente após validar conjuntamente as Tarefas 9–12. Reconexão completa e migração do host ficam fora deste escopo.

**Critérios de aceitação:**
- [x] Início e entrada tardia exigem versão compatível e snapshot completo antes de aceitar comandos, incluindo tick, ondas e recursos; versão divergente é rejeitada sem contaminar o roster, e contadores refletem o limite real de três jogadores.
- [x] Queda de convidado atualiza participantes e estado; queda do host interrompe a partida dos convidados com opção clara de voltar, sem migrar silenciosamente para um mundo solo divergente.
- [x] Voltar, desconectar ou tentar novamente limpa a sessão anterior; testes e navegador validam juntos mundo, comandos, economia e entrada tardia antes de tornar o novo caminho padrão, sem sala falsa ou partida parcialmente iniciada em caso de erro.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "world_sync|multiplayer|protocol"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: testar trio, início, entrada tardia com estado completo, versão incompatível, queda de cada papel e retorno à seleção; só depois habilitar o novo caminho como padrão.

**Dependências:** Tarefas 9, 10 e 11.

**Arquivos prováveis:** `src/net/peer_network.js`, `src/ui/lobby_ui.js`, `src/main.js`, `src/game.js`, `tests/unit/world_sync.test.js`.

**Escopo estimado:** médio, 5 arquivos.

## Checkpoint: após as Tarefas 10–12

- [ ] `npm test` passa; comandos de convidados são validados e executados uma vez no host.
- [ ] Partida em duas e três instâncias mantém mundo, recursos e progressão coerentes até vitória/derrota.
- [ ] Entrada tardia preservada recebe estado completo antes de comandos; desconexão tem recuperação explícita, sem erros novos de console, e o novo caminho só se torna padrão após esse conjunto passar.

## Fase 5: toque e leitura de combate

## Tarefa 13: tornar os controles por toque previsíveis

**Descrição:** Corrigir o botão ATACAR e a detecção dos controles móveis, ajustando posicionamento e interação para que não bloqueiem janelas desktop nem disputem gestos com o jogo e os modais.

**Critérios de aceitação:**
- [x] ATACAR não dispara Q quando não existe alvo; cada toque emite uma única intenção, e joystick/toque seguem o caminho autoritativo de comandos sem consumir habilidades indevidamente.
- [x] Controles móveis ficam restritos ao contexto adequado; janela desktop estreita não recebe bloqueio de orientação e o aviso móvel pode ser dispensado.
- [x] Em 390×844, 844×390, 900×600 e 1366×768, atacar, mirar, mover e abrir controles não se sobrepõem nem geram movimento ao interagir com modais; soltar/cancelar toque encerra a intenção contínua.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "touch_controls|input|world_sync"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: executar os tamanhos listados, emulação de toque e teste cooperativo de convidado com joystick.

**Dependências:** Tarefas 10 e 12.

**Arquivos prováveis:** `src/ui/virtual_joystick.js`, `style.css`, `tests/unit/touch_controls.test.js` (novo).

**Escopo estimado:** médio, 3 arquivos.

## Tarefa 14: expor o objetivo atual da partida

**Descrição:** Acrescentar ao HUD orientação contextual, contagem da próxima onda e barra do chefe, usando o estado compartilhado e preservando espaço para câmera, habilidades e minimapa.

**Critérios de aceitação:**
- [x] O objetivo acompanha torres e vulnerabilidade real do Nexus, e a próxima onda mostra tempo coerente entre host e convidados; textos não tornam obrigatório derrotar um chefe que não bloqueia o Nexus.
- [x] Chefe ativo tem barra de vida e identificação/fase legíveis, que desaparecem ou transitam corretamente ao morrer ou encerrar a partida.
- [x] Objetivo, onda, barra do chefe, banners e zoom não se sobrepõem nos tamanhos da Tarefa 13, inclusive em zoom de câmera 60%, 125% e 160%.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "hud_objectives|hud_banners|boss|world_sync"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: conferir início, onda com miniboss, queda das torres e Nexus vulnerável em solo e cooperativo.

**Dependências:** Tarefas 9, 12 e 13.

**Arquivos prováveis:** `index.html`, `style.css`, `src/ui/hud.js`, `src/render/renderer.js`, `tests/unit/hud_objectives.test.js` (novo).

**Escopo estimado:** médio, 5 arquivos.

## Tarefa 15: tornar perigos e impactos mais legíveis

**Descrição:** Refinar os indicadores de ataque de chefe, alvos e estados de combate, e oferecer preferência de movimento reduzido que conserve as informações necessárias para reagir.

**Critérios de aceitação:**
- [x] Áreas perigosas indicam preparação e impacto com forma/contorno além de cor, permanecendo alinhadas ao efeito real com rotação e zoom da câmera.
- [x] Alvo e estados importantes permanecem identificáveis em combates com ondas, sem adicionar efeitos que ocultem área de perigo, HP ou o herói.
- [x] Preferência de movimento reduzido respeita a configuração do sistema e pode ser ajustada pelo usuário, desativando tremor e animações decorativas intensas sem remover avisos de perigo; escolha persiste quando armazenamento está disponível.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "vfx_shake|vfx_adversarial|boss|hud_objectives"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: observar perigos em 60%, 125% e 160%, com movimento reduzido ligado/desligado e recarga da página.

**Dependências:** Tarefas 7, 12 e 14.

**Arquivos prováveis:** `src/render/renderer.js`, `src/world/boss.js`, `src/ui/hud.js`, `style.css`, `tests/unit/vfx_shake.test.js`.

**Escopo estimado:** médio, 5 arquivos.

## Checkpoint: após as Tarefas 13–15

- [ ] `npm test` passa; ATACAR não lança habilidade e gestos não duplicam comandos.
- [ ] Revisão visual nos quatro tamanhos confirma controles alcançáveis e ausência de sobreposição dos novos painéis.
- [ ] Objetivos e perigos continuam compreensíveis com movimento reduzido, rotação e zoom extremos.

## Fase 6: primeira partida e validação integrada

## Tarefa 16: orientar a primeira partida com ajuda curta

**Descrição:** Oferecer uma sequência curta de ajuda para mover/atacar, mirar habilidade, usar loja e recall, com acesso permanente pelo HUD e possibilidade de pular sem bloquear a partida.

**Critérios de aceitação:**
- [x] Ajuda usa comandos atuais e o objetivo real do jogo, explica compra/recall e pode ser pulada ou reaberta por controle visível no HUD.
- [x] Conclusão das etapas acompanha ações observáveis; pular ou fechar remove seus ouvintes e não dispara comandos, cheats ou efeitos de combate.
- [x] Em solo e cooperativo, ajuda é local ao participante e não pausa nem altera a simulação compartilhada; conteúdo cabe e pode ser operado nos tamanhos já validados.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "onboarding|input|hud_objectives"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: percorrer, pular e reabrir a ajuda na primeira partida solo e como convidado.

**Dependências:** Tarefas 12, 13 e 14.

**Arquivos prováveis:** `src/ui/help_ui.js` (novo), `src/game.js`, `src/ui/hud.js`, `style.css`, `tests/unit/onboarding.test.js` (novo).

**Escopo estimado:** médio, 5 arquivos.

## Tarefa 17: permitir operar seleção e controles por teclado

**Descrição:** Dar semântica e foco aos controles de seleção e HUD, permitindo operar menus e ações expostas por teclado sem conflitos com atalhos da partida.

**Critérios de aceitação:**
- [x] Tab, Enter e Espaço permitem selecionar qualquer um dos cinco heróis e operar os controles de modo/início e de habilidade; seleção e foco ficam visíveis.
- [x] Controles têm nomes acessíveis e estados de seleção/indisponibilidade coerentes; interagir com um controle focado não abre o chat nem dispara outro comando da partida.
- [x] Loja, ajuda e fim de partida mantêm uma ordem de foco utilizável; atalhos não interceptam digitação nos campos e fechar um painel devolve o foco de forma previsível.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "input|onboarding|tactile_ux"`.
- [x] Suíte completa: `npm test`.
- [ ] Navegador com `npm start`: sem mouse, selecionar cada herói, iniciar, ativar controles do HUD, abrir/fechar ajuda e confirmar foco visível.

**Dependências:** Tarefas 2, 12 e 16.

**Arquivos prováveis:** `index.html`, `src/ui/lobby_ui.js`, `src/main.js`, `style.css`, `tests/unit/input.test.js`.

**Escopo estimado:** médio, 5 arquivos.

## Tarefa 18: validar a experiência completa

**Descrição:** Consolidar regressões de uma partida compartilhada e registrar a verificação real de solo, dupla e trio, atualizando instruções e changelog somente com comportamento efetivamente verificado.

**Critérios de aceitação:**
- [x] Simulação integrada percorre movimento, habilidade, controle de grupo, dano, autoria de abate, compra, evolução, morte/respawn e vitória/derrota com host e convidados, incluindo pacotes repetidos e fora de ordem.
- [x] Checklist de navegador registra resultado, ambiente e evidência de solo, dupla e trio, toque, teclado, objetivos, chefe, versão incompatível, entrada tardia com snapshot completo e desconexão; simulações/mocks são identificados como tais.
- [x] README e changelog descrevem comandos, ajuda e limites reais do cooperativo; suíte completa e cenários obrigatórios passam, sem publicação/deploy incluídos nesta tarefa.

**Verificação:**
- [x] Testes focados: `node tests/runner.js "cooperative_match|world_sync|economy_flow|ability_runtime|movement_cc|damage_runtime"`.
- [x] Suíte completa: `npm test`, registrando contagem e resultado atuais, sem reutilizar totais antigos da documentação.
- [ ] Navegador com `npm start`: executar `tasks/browser-checklist.md` em instâncias reais; repetir rede em máquinas/dispositivos distintos para os cenários de conexão relevantes.

**Dependências:** Tarefas 1–17.

**Arquivos prováveis:** `tests/e2e/cooperative_match.test.js` (novo), `tasks/browser-checklist.md` (novo), `README.md`, `CHANGELOG.md`.

**Escopo estimado:** médio, 4 arquivos. Qualquer correção encontrada retorna à tarefa responsável antes da revalidação; não ampliar esta tarefa além desse limite.

## Checkpoint: conclusão

- [ ] Critérios de todas as 18 tarefas atendidos e `npm test` aprovado.
- [ ] Checklist real de navegador concluído, com eventuais limites ou cenários não executados registrados explicitamente.
- [ ] Solo, dupla e trio confirmados, sem regressões de combate, progressão, rede, toque ou teclado.
- [ ] Documentação corresponde ao comportamento final e o conjunto está pronto para revisão do usuário.

## Condição para iniciar implementação

- [x] Usuário revisou e aprovou `tasks/plan.md` e a sequência deste arquivo.

## Coordenação

Tarefas 1 e 2 podem começar em paralelo após aprovação. As demais seguem as dependências indicadas. `src/game.js`, `src/net/peer_network.js`, `src/ui/hud.js` e `style.css` exigem um responsável por vez quando houver edições concorrentes; revisões e execução de cenários já concluídos podem ocorrer em paralelo. O usuário autorizou explicitamente publicar no GitHub e fazer deploy após concluir.

## Resultado da implementação — 05/11/2026

- As 18 tarefas foram implementadas. Suíte final: 341/341 testes em 50 arquivos; revisão técnica independente sem bloqueadores.
- Cenários de navegador efetivamente verificados estão em browser-checklist.md. Caixas manuais ainda abertas são roteiros adicionais, não funcionalidades ausentes; não foram marcadas como executadas sem evidência.
- Cooperativo autoritativo ativado por padrão após teste WebRTC real com duas/três abas. Entrada tardia, compra, evolução, movimento/habilidade e queda do anfitrião foram observados.
- Validação adicional em celular físico e entre máquinas distintas não foi possível nesta sessão.
