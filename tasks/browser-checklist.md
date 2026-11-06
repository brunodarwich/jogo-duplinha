# Verificação de navegador — melhorias do MOBA Duplinha

Use npm start e um perfil isolado do navegador. Registre navegador/dispositivo, resultado e evidência ao verificar cada cenário. A suíte Node não substitui estas verificações. Estado: verificações executadas e limites registrados no resultado abaixo.

## Primeira partida e teclado

- [ ] Carregamento → seleção → início solo sem erros de aplicação ou recurso obrigatório ausente.
- [ ] Usar Tab/Enter/Espaço para escolher cada herói e iniciar a partida. A seleção tem nome acessível e estado selecionado.
- [ ] Primeira partida mostra guia de três etapas. Pular, concluir, reabrir pelo botão ? e fechar com Escape; foco retorna ao controle anterior.
- [ ] Guia aberto não permite acionar atalhos da batalha ao navegar seus controles. O aviso informa que a partida continua.
- [ ] Habilidade não aprendida informa indisponibilidade sem gastar mana. Aprender Q com +; ativar pelo teclado e por clique sem comando duplicado.
- [ ] Tooltip aparece em foco e hover e mostra os valores reais do rank atual, inclusive teleporte e cura.
- [ ] Abrir Loja pelo botão visível, comprar na base, vender pelo inventário e conferir saldo/atributos.

## Layout e combate

Para cada resolução 1366×768, 1280×720, 900×600, 390×844 e 844×390:

- [ ] Barra de objetivo, topo, barra do chefe e zoom não cobrem informação crítica.
- [ ] Habilidades, Loja, ajuda e inventário permanecem acessíveis; nenhuma rolagem horizontal da página.
- [ ] Desktop com ponteiro fino não mostra joystick/ATACAR nem aviso de orientação.
- [ ] Em toque/retrato, aviso de rotação pode ser dispensado e não reaparece ao redimensionar.
- [ ] ATACAR sem alvo não usa Q. Um toque perto de alvo vivo produz um ataque básico.
- [ ] Joystick move através do mesmo caminho de comando usado pelo mouse.

Nos zooms 60%, 125% e 160%:

- [ ] Mira acompanha o cursor e o alvo selecionado tem contorno distinguível além de cor.
- [ ] Área de perigo de torre e antecipação de chefe permanecem legíveis sob unidades.
- [ ] Reduzir movimento remove tremor/pulsos supérfluos e mantém mira/avisos essenciais.
- [ ] Preferência inicial segue o sistema; escolha explícita persiste após recarregar.

## Objetivos e progressão

- [ ] Os cinco heróis aprendem e evoluem habilidades; comparar efeito do primeiro/último rank.
- [ ] Atordoamento, raiz e lentidão alteram movimento conforme suas regras e expiram corretamente.
- [ ] Defesa reduz dano das fontes pertinentes; barreiras e proteção estrutural continuam funcionando.
- [ ] Objetivo muda de torre externa para interna e Nexus; contador de onda acompanha a simulação.
- [ ] Nexus vulnerável pode encerrar a partida com o chefe vivo; texto de vitória descreve o Nexus.

## Cooperativo real

Realizar com duas e três sessões e, quando houver dispositivo disponível, duas máquinas:

- [ ] Criar sala, escolher heróis diferentes, iniciar com snapshot comum e comparar onda, relógio e vida de torre.
- [ ] Convidados movem, atacam, usam habilidade e recall; todos observam os mesmos resultados.
- [ ] Comprar/vender/evoluir como convidado altera uma única vez ouro, inventário, atributos e rank.
- [ ] Abate por habilidade remota credita autor/recompensas elegíveis e não duplica prêmio.
- [ ] Entrada tardia recebe mundo completo antes de aceitar comandos.
- [ ] Versão incompatível é rejeitada com motivo, sem ocupar vaga nem alterar o mundo.
- [ ] Queda de convidado atualiza equipe; queda do anfitrião interrompe a sessão com saída clara.
- [ ] Retornar à seleção e começar de novo não acumula controles, timers ou conexões.
- [ ] Vitória/derrota e tempo final são iguais entre participantes.

## Evidências e limites

| Ambiente/cenário | Resultado | Evidência/limitação |
|------------------|-----------|--------------------|
| Navegador desktop | A validar | |
| Janela retrato com mouse | A validar | |
| Emulação de toque | A validar | |
| Celular físico | A validar | |
| Duas/três sessões WebRTC | A validar | |
| Duas máquinas | A validar | |
| Frame time e tamanho/cadência dos snapshots | A medir | Informar cenário e dispositivo; não inferir FPS do benchmark Node. |

## Resultado observado — 05/11/2026, versão 2.0.0

Ambiente: Chrome isolado via Playwright em Windows, servidor local. Testes de transporte usaram PeerJS/WebRTC real entre abas; testes de simulação em Node usam canais em memória e são descritos separadamente.

| Cenário | Resultado e evidência |
|---------|----------------------|
| Suíte automatizada | 341/341 em 50 arquivos; .playwright-cli/release-tests.log. Inclui regressões de rank, defesa, CC, autoria, identidade, snapshots, versões e cleanup. |
| Cinco heróis | Seleção por foco/Enter, início solo e aprendizado de Q nos cinco; sem pageerror. Resoluções 1366×768 e 900×600 sem overflow horizontal. |
| HUD | Capturas 1280×720, 390×844 e 844×390; boss/top separados e XP/+ separados após ajuste. .playwright-cli/release-desktop.png, release-portrait.png, release-landscape.png; as duas primeiras antecedem o último ajuste de espaçamento. |
| Toque emulado | Contexto hasTouch/isMobile, 390×844 e 844×390. Aviso de rotação dispensado; Q aprendida; ATACAR sem inimigo manteve mana300 e cooldown0. Capturas release-touch-portrait.png e release-touch-landscape.png. Nenhum pageerror. |
| Movimento reduzido | Checkbox pelo toque desativou camera.shakeEnabled; teste automatizado cobre preferência do sistema/persistida. |
| Guia/teclado | Guia aberto, pulado e reaberto; seleção e aprendizado via Enter. Testes automatizados cobrem três etapas/foco e ativação única. |
| Cooperação real | Duas e três abas com RTC connected. IDs das entidades e HP das torres idênticos em todos os observadores; diferença de relógio dentro de um snapshot (~33ms na amostra). |
| Compra/evolução | Convidado comprou Adaga e evoluiu Q pela interface; anfitrião e convidado confirmaram mesmo inventário e rank. |
| Movimento/habilidade | Clique direito e Q do convidado confirmados na simulação do anfitrião, com mesma recarga/posição dentro da cadência de rede. |
| Entrada tardia | Terceiro entrou aos 175,9s; recebeu snapshot completo, ID player_remote_3 e roster 3. IDs/torres convergiram entre os três. |
| Queda real | Fechar anfitrião com watcher corrigido pausou convidado, worldReady=false e modal CONEXÃO ENCERRADA após 13,2s no teste local. A espera inclui a detecção do RTC e a tolerância de desconexão; não é promessa de detecção instantânea. |
| Revisão | Revisão independente aprovou após corrigir spoof de HERO_SELECT, listeners acumulados e ativação do novo protocolo como padrão. Mutação temporária de rank-zero e de lentidão foi detectada; arquivos restaurados. |
| Recursos | Favicon SVG adicionado após o404 observado inicialmente. Nenhuma falha de recurso obrigatório ou erro de aplicação nos testes finais de início. |

### Medições de rede

Snapshot inicial de 14 entidades/três heróis: aproximadamente 16,6 KB JSON. Com 64 entidades: aproximadamente 59,9 KB; criação média 0,51 ms em 100 amostras Node. A 20 Hz e dois convidados, o cenário maior equivale a~2,40 MB/s JSON teórico antes do encoding/transporte. Não é medição de FPS do navegador nem da banda real em rede móvel.

### Validação adicional não executada

Celular físico, máquinas em redes distintas/NAT diferentes e partida longa completa até o fim para cada herói. Vitória compartilhada, barreiras/controle, abates e rejeições de versão foram exercitados em testes de simulação reais, sem alegar que esses cenários completos ocorreram no navegador. Os campos manuais ainda abertos acima permanecem como roteiro para esses playtests adicionais.

### Publicação e recuperação

GitHub e deploy em produção foram autorizados pelo usuário após a aprovação do plano. Deploy anterior confirmado pela CLI: dpl_EXxUb89etxevHKSxPdFKGUSjH6g6, URL jogo-duplinha-ihj4ypk26-raixu01s-projects.vercel.app. Em regressão de produção, promover esse deploy novamente. O resultado da publicação será registrado após a verificação do artefato.

## Publicação verificada

- GitHub main: 2129476 (código/pacote); tag v2.0.0 aponta para f73af28. O commit posterior de exclusões preserva os mesmos arquivos de execução.
- Vercel produção: dpl_3ETM7KghLTyrxYEmqQnPfvBHbSeU, https://jogo-duplinha-blush.vercel.app/ — Ready.
- 122 arquivos de execução/PNG: HTTP200 e SHA-256 idêntico ao workspace. Arquivos de testes, plano, fontes locais de sprites e imagens de prévia retornam404.
- Chrome na URL pública: guia concluído, sala criada, convite padrão sem flag experimental, WebRTC connected, host e convidado com protocolo autoritativo ativo e entidades iguais. Nenhum pageerror. Captura .playwright-cli/production-coop.png.
- As duas imagens de prévia que já estavam sem versionamento permaneceram fora dos commits e do deploy.
