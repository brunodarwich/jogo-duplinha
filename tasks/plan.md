# Plano de melhorias: MOBA Duplinha

Data: 05/11/2026. Estado: planejamento concluído; implementação aguarda revisão do usuário.

## Objetivo

Melhorar os três focos confirmados pelo usuário: jogabilidade, visual e cooperação. Corrigir primeiro as regras que invalidam decisões de combate, tornar o mundo consistente para a equipe e melhorar a leitura da partida. Manter Canvas 2D, JavaScript nativo, PeerJS, os cinco heróis e a arte já produzida.

As tarefas com critérios, dependências e verificações estão em [todo.md](todo.md). O acompanhamento de execução deve ocorrer nesse arquivo.

## Diagnóstico

Base: commit 39a6fca, versão 1.2.0. npm test passou: 284 testes em 38 arquivos. Não há comando de build; o projeto serve arquivos estáticos.

| Área | Evidência encontrada | Consequência |
|------|---------------------|--------------|
| Aprendizado | Reprodução Node: Feiticeira nível 1 lança R de rank 0, gastando 110 de mana. game.js:418 e :1010 não impõem aprendizado. | Suprema pode ignorar a progressão. |
| Evolução | Reprodução Node: Q de rank 1 e 4 causa os mesmos 85 de dano. game.js:1065 usa constantes; heroes.js:181 já oferece fórmulas por rank. | Evoluir uma habilidade pode não melhorar seu efeito real. |
| Controle | Reprodução Node: lacaio atordoado se move em update(0.1), apesar de canMove() retornar false. minion.js:302 e entity.js:194 têm caminhos próprios de movimento. | Efeito visual não garante controle real. |
| Defesa | Ataque básico usa applyDamage em game.js:1532; habilidades/unidades usam takeDamage diretamente em game.js:1182, tower.js:94 e outros. Evidência estática, ainda sem matriz integrada completa. | Resistências podem agir de forma diferente conforme a fonte. |
| Recompensas | Reprodução Node: Q remoto mata lacaio; local recebe 42g, autor recebe zero. game.js:1209–1223 usa this.playerHero. | Último golpe é creditado ao jogador errado. |
| Mundo cooperativo | game.js:1646–1734 avança ondas, torres e chefes em todos os clientes; pacotes atuais transmitem sobretudo heróis/habilidades. IDs de lacaios são aleatórios. | Não há estado único de mundo garantido; divergência ainda precisa ser medida em duas máquinas. |
| Controle móvel | Reprodução direta de handleTouchAttack: sem inimigo, ATACAR chama Q. virtual_joystick.js:302. | Ataque básico pode gastar habilidade. |
| Layout | Chrome isolado: HUD encobre parte da barra do chefe em 1280×720; janela desktop 390×844 recebe aviso de rotação integral e sem saída. | Informação coberta e janela estreita bloqueada. |
| Descoberta | Ajuda está sobretudo em /help; HUD superior mostra torres e relógio. Heróis e habilidades usam divs sem ativação nativa pelo teclado. | Primeira partida depende de conhecimento prévio e mouse. |

Reproduções Node foram feitas sem alterar código. Os casos deverão virar regressões nas tarefas correspondentes.

## Limites da avaliação

- Navegador: carregamento, seleção e início do solo; capturas desktop/retrato. Console registrou apenas 404 de favicon.ico. Não houve partida completa nem WebRTC entre máquinas.
- Evidências temporárias: .playwright-cli/plan-desktop.png e .playwright-cli/plan-portrait.png, pasta já ignorada pelo Git.
- Os E2E atuais executam Node com mocks, não navegador/WebRTC. Scripts stress_*.js fora de tests/unit e tests/e2e não entram em npm test.
- Os dois listeners de toque em ATACAR indicam risco de duplicação; confirmar em dispositivo físico.
- O plano anterior estava concluído e foi preservado em archive/combat-animations-plan.md e archive/combat-animations-todo.md.

## Decisões de arquitetura

1. Corrigir o caminho real da simulação. Testes devem passar por handleCommand, executeHeroSkill e update, conforme o caso; testar apenas fórmulas não é suficiente.
2. Usar um contrato de dano com autor e tipo explícitos. Preservar mitigação única, barreiras, invulnerabilidade, particularidades de chefes/estruturas, morte e recompensas.
3. Respeitar regras de aprendizado e escalar os efeitos que o combate atual realmente executa. Reutilizar apenas fórmulas compatíveis: há helpers antigos, como sorceressEDamage para um E que hoje é teleporte e clericEShield para um E que hoje causa dano. Não conectar esses helpers cegamente nem introduzir venenos/auras ausentes por constarem em textos antigos.
4. No cooperativo, o anfitrião decide IA, combate, economia e resultado. Convidados enviam intenções validadas e recebem snapshots versionados com IDs estáveis e sequência monotônica. Solo usa as mesmas regras localmente. Integrar as tarefas 9–12 sob opção interna de desenvolvimento e manter o caminho atual como padrão até validar o conjunto; só então ativar o novo caminho por padrão.
5. Snapshots incluem mundo, heróis, recursos, ranks, inventários, cooldowns, barreiras, efeitos temporários, ondas e resultado. Converter tempos absolutos em durações restantes/ticks; não comparar Date.now entre máquinas. Temporizadores de mobilidade/invisibilidade também devem seguir o relógio do anfitrião.
6. Começar com snapshots completos na cadência atual de até 20 Hz, medindo tamanho/custo. Apresentação de ações visuais não deve reaplicar dano.
7. Identidade do comando vem da conexão. Cliente não decide dano, ouro, posição final ou inventário. Começar com interpolação visual; previsão complexa fica fora desta rodada.
8. Impedir mistura silenciosa de versões incompatíveis. Início e entrada tardia já suportada usam um snapshot completo do anfitrião antes de liberar comandos. Preservar o cenário de entrada tardia coberto pelo teste TC-MP-06.
9. Queda de anfitrião encerra a sessão explicitamente; queda de convidado é indicada e seu herói deixa de agir. Sem migração automática nem reconexão completa nesta rodada.
10. Melhorar visual com hierarquia do HUD, contornos/padrões de alvo e perigo e opção de movimento reduzido. Reutilizar sprites/animações atuais.
11. Ajuda curta, pulável e reabrível mostra o objetivo real: torres vulnerabilizam o Nexus; chefe vivo não deve ser apresentado como impedimento obrigatório para vencer.

## Sequência de entregas

| Fase | Tarefas | Resultado verificável |
|------|---------|----------------------|
| 1 — Risco e progressão | 1. Contrato cooperativo; 2. Aprendizado; 3. Escalas por rank | Contrato entre duas instâncias e evolução funcionando no combate. |
| 2 — Controle e defesa | 4. Controle do herói; 5. Controle dos lacaios; 6. Dano de habilidades | Atordoar, desacelerar e comprar defesa têm efeitos reais. |
| 3 — Mundo compartilhado | 7. Dano das unidades; 8. Autoria dos abates; 9. Replicação do mundo | Dano coerente, crédito correto e convidados exibindo o mundo do host. |
| 4 — Cooperação | 10. Comandos de combate; 11. Economia/progressão; 12. Quedas/versões | Ações e resultado decididos uma vez e compartilhados. |
| 5 — Leitura da partida | 13. Toque/responsividade; 14. HUD/objetivos; 15. Indicadores | Controle previsível e informações/perigos legíveis. |
| 6 — Primeira partida | 16. Guia; 17. Teclado; 18. Validação integrada | Descobrir comandos, operar a interface e revisar os três focos. |

## Dependências

    1 ──────────────────────> 9 ──> 10 ──> 11 ──> 12 ──> 18
    2 ──> 3 ──> 6 ──> 7 ──> 8 ────> 10, 11
    4 ──> 5 ────────────────────────> 10
    13 ──> 14 ──> 15 ──> 16 ──> 17 ──> 18

Os detalhes no todo.md prevalecem. Checkpoints após cada três tarefas repetem a suíte. Tarefa 1 testa cedo o maior risco técnico. Nas tarefas 9–11, a integração parcial é exercitada explicitamente com a opção interna ativada; não substituir o cooperativo padrão antes de completar a tarefa 12.

## Paralelização

- Contrato (1), movimento (4–5) e investigação de layout (13) podem avançar em paralelo após aprovação.
- Com o contrato definido, UI e rede podem ser executadas por agentes diferentes.
- Serializar alterações em src/game.js e style.css, compartilhados por várias fatias.
- Revisão independente e testes de fatias concluídas podem ocorrer em paralelo.

## Verificação

- Regressão: npm test. Baseline 284/284; preservar os casos e acrescentar testes dos defeitos, sem enfraquecer expectativas.
- Foco: node tests/runner.js "expressão". Testes novos listados no todo.md ainda serão criados.
- Build não se aplica. Suíte verifica sintaxe/imports; npm start permite conferir módulos, imagens e console no navegador.
- Layout: 1366×768, 1280×720, 900×600, 390×844 e 844×390; zoom 60%, 125% e 160%.
- Rede: duas/três instâncias com duplicatas, atraso e reordenação controlados; sessão real em duas máquinas. Comparar IDs, HP de torres, recursos, ranks e resultado.
- Desempenho: medir frame time e tamanho/cadência dos snapshots no mesmo cenário/dispositivo. Não declarar 60 FPS a partir de benchmark Node.
- Checkpoints são revisões técnicas. Pedir nova aprovação humana apenas diante de mudança material de escopo.

## Riscos e mitigação

| Risco | Impacto | Mitigação |
|------|---------|-----------|
| Migração do cooperativo toca vários caminhos | Alto | Contrato entre duas instâncias antes da integração e fatias sequenciais 9–12. |
| Mitigação/recompensas duplicadas | Alto | Testar dano efetivo e transição vivo→morto uma única vez, com autor explícito. |
| Ranks alteram ritmo/dificuldade | Médio | Fórmulas existentes, exemplos antes/depois e playtest dos cinco heróis. |
| Relógios diferentes mudam controle | Alto | Durações restantes/ticks nos pacotes e relógio controlável nos testes. |
| Snapshot incompleto causa simulação duplicada | Alto | Incluir objetos dinâmicos necessários e impedir IA/dano no convidado. |
| Emulação não representa toque real | Médio | Verificar ponteiro fino/grosso e celular físico. |
| Trabalho visual cresce sem benefício na partida | Médio | Reutilizar arte e priorizar HUD/indicadores. |

## Fora desta rodada

Novos heróis/mapas, ranked, contas, backend dedicado, reconexão completa, migração do anfitrião, reconstrução dos kits e nova geração de sprites. Divergências entre textos e mecânicas persistentes ficam em rodada própria, uma habilidade por tarefa.

## Revisão

O usuário confirmou os três eixos. Falta revisar este plano concreto antes da implementação, conforme a skill planning-and-task-breakdown invocada. Este turno alterou apenas documentos de planejamento.
