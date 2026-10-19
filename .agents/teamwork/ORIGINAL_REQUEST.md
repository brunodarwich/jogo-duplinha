# Original User Request

## 2026-10-17T00:15:08Z

Construir um jogo cooperativo estilo MOBA / Lane Push 2.5D isométrico no navegador para 1 a 3 jogadores (WebRTC P2P) e modo Solo offline completo, com 5 heróis únicos com 4 habilidades ativas (Q/W/E/R) e passivas, hordas contínuas de lacaios, mini-bosses periódicos, torres defensivas e ofensivas, loja de 6 itens na base e teleporte de retorno (Recall).

Working directory: c:\Users\Bruno\Downloads\jogo-duplinha
Integrity mode: development

## Requirements

### R1. Mecânicas de Jogo e Renderização Isométrica 2.5D
Renderizador gráfico 2.5D isométrico rodando em HTML5 Canvas no navegador, com movimentação por clique do mouse, mira de habilidades, e HUD completo (vida, mana, barra de habilidades Q/W/E/R, ouro, cronômetro de partida e minimapa).

### R2. Roster de 5 Heróis Únicos
Implementar 5 heróis selecionáveis com papéis complementares (Cavaleiro Guardião, Feiticeira Elemental, Patrulheiro Arqueiro, Sombra Assassina, Clérigo da Luz), cada um com ataque básico, passiva e 4 habilidades com efeitos, custos de mana e tempos de recarga distintos.

### R3. Estrutura do Mapa, Hordas e Bosses
Mapa de trilha progressiva com base aliada e base inimiga, torres com raio de ataque e projéteis em ambos os lados, hordas de lacaios (corpo a corpo e à distância) geradas a cada 60s, mini-bosses periódicos a cada 5 ondas com mecânicas especiais, e o Boss Supremo no Nexus inimigo.

### R4. Economia e Loja de Itens
Sistema de ouro por abates (last-hits em minions, mini-bosses e torres), loja acessível na base contendo itens de atributos variados (dano, vida, armadura, poder mágico, velocidade, roubo de vida), 6 slots de inventário no herói e canalização de Recall (B) para retorno seguro à base.

### R5. Suporte Multiplayer P2P (1-3 Jogadores) e Modo Solo
Arquitetura de rede P2P direta no navegador via WebRTC (PeerJS) com criação e entrada em salas por código para 1 a 3 jogadores cooperativos, sincronizando movimento, habilidades e vida, com fallback automático para modo Solo offline completo sem dependências externas.

## Acceptance Criteria

### Jogabilidade e Controles
- [ ] O jogador move o herói pelo clique direito do mouse na perspectiva isométrica e dispara habilidades com Q/W/E/R e mira no cursor.
- [ ] O teleporte de Recall (B) canaliza por 5 segundos e teletransporta o herói para a base ao concluir sem tomar dano.

### Heróis e Habilidades
- [ ] Os 5 heróis estão disponíveis na tela de seleção e possuem valores balanceados de vida, mana, dano e velocidade.
- [ ] Cada habilidade possui partículas/efeitos visuais no canvas, alcance visível e respeita recargas e custos de mana.

### Trilha, Torres e Inimigos
- [ ] As torres disparam projéteis automáticos contra creeps ou heróis que entrarem no seu alcance.
- [ ] Hordas surgem na base inimiga e avançam pela trilha enfrentando as tropas aliadas.
- [ ] Ao atingir a onda 5, o primeiro Mini-Boss surge na trilha com barra de vida de chefe e habilidades especiais.
- [ ] A destruição do Nexus Inimigo/Boss Supremo gera tela de Vitória; a queda do Nexus Aliado gera Derrota.

### Loja e Inventário
- [ ] O jogador ganha ouro por abates e pode abrir a loja quando estiver na base para comprar e vender até 6 itens.
- [ ] Os atributos do herói (dano, vida máxima, etc.) são atualizados em tempo real ao equipar os itens.

### Conectividade
- [ ] O jogo pode ser iniciado instantaneamente em modo Solo sem precisar de servidor dedicado.
- [ ] É possível criar uma sala com código e conectar um segundo jogador na mesma partida compartilhando o código.


## 2026-10-17T14:55:25Z

Revisão e consolidação das mecânicas fundamentais de jogabilidade do jogo 2.5D isométrico: ataque básico e mira (clique no alvo / A-click), ressurreição do herói após a morte com timer (escalando com nível: 4s + 1s por nível) e respawn na fonte, movimentação fluida com parada/hold, zoom dinâmico na câmera por scroll do mouse com coordenadas perfeitamente calibradas, e rotação direcional tanto do personagem quanto de perspectiva isométrica.

Working directory: c:\Users\Bruno\Downloads\jogo-duplinha
Integrity mode: development

## Requirements

### R1. Sistema de Morte e Ressurreição do Herói (Death & Respawn System)
O herói jogador não deve ser permanentemente removido da simulação ao morrer. Ao sofrer dano fatal (`hp <= 0`), ele entra em estado de morte com contagem regressiva de ressurreição baseada no nível (`4s + 1s` por nível atual do herói). Durante a morte, o herói fica desativado para comandos e colisões, mas sua contagem é exibida na interface. Quando o contador zera, o herói renasce na Fonte Aliada (`x: 400, y: 400`) com HP e Mana restaurados ao máximo e capacidade total de movimentação e combate restaurada.

### R2. Ataque Básico e Mecânica de Clique e Ataque (Target Click & Auto-Attack)
Ataque contra inimigos ao clicar com botão direito ou esquerdo em unidades hostis. O herói se desloca até a distância exata de ataque (`attackRange + targetRadius`) e executa ataques respeitando o cooldown de ataque e animações/projéteis. Suporte ao comando de Attack-Move ('A') no chão ou diretamente no alvo. Encadeamento inteligente no próximo alvo hostil após abate (caso o herói não esteja em estado de parada).

### R3. Movimentação e Comando de Parada (Movement & Hold/Stop)
Movimentação responsiva via clique com botão direito ou arrasto contínuo com botão direito. Tecla 'S' ou 'H' cancela qualquer ação imediata (movimento, auto-ataque, channeling de habilidades ou recall) e mantém o herói parado sem buscar novos alvos por agressividade automática até receber nova ordem.

### R4. Zoom Dinâmico da Câmera (Mouse Wheel Zoom)
Zoom in e zoom out suave através da roda do mouse (scroll wheel) entre os limites de 0.6x e 1.6x. Toda a projeção isométrica e o mapeamento de coordenadas de clique da tela para o mundo (`screenToWorld`) e vice-versa devem permanecer perfeitamente alinhados e calibrados em qualquer nível de zoom.

### R5. Rotação Direcional do Personagem e Perspectiva de Câmera
- O herói orienta suavemente seu ângulo de visão (`facing`) na direção em que se move, na direção do alvo de ataque ou da habilidade mirada.
- Suporte a rotação de perspectiva da câmera / mapa (alternar visualização de perspectiva ou ângulos isométricos através de tecla ou rotação gradual), mantendo a fidelidade das direções e coordenadas de controle.

### R6. Integridade da Infraestrutura de Testes
Toda a suíte existente de testes unitários e E2E (`npm test`) deve continuar passando limpa (0 falhas). Novos testes devem ser adicionados para validar o timer de ressurreição, zoom com cálculo de mouse unprojection e a integridade de rotação e mira de ataque.

## Acceptance Criteria

### Hero Death & Resurrection
- [ ] Ao ter seu HP zerado, o herói não é excluído irrecuperavelmente do array de entidades.
- [ ] Um contador de ressurreição regressivo é iniciado e decrementado a cada tick (duração: 4s + 1s por nível do herói).
- [ ] O HUD exibe o contador regressivo de morte de forma clara para o jogador.
- [ ] Durante a morte, ações de movimento, ataque e conjuração são rejeitadas.
- [ ] Ao terminar o contador, o herói é teleportado para as coordenadas da Fonte Aliada (400, 400), com HP e Mana totalmente cheios e status limpo.

### Target Click & Attack
- [ ] Clicar com botão direito em uma unidade hostil comanda perseguição até o alcance efetivo de ataque e executa ataques básicos periódicos.
- [ ] Clicar com botão esquerdo em uma unidade hostil seleciona e ataca o alvo.
- [ ] Tecla 'A' no chão move atacando qualquer inimigo encontrado pelo caminho.
- [ ] Eliminar o alvo transfere o ataque para o inimigo mais próximo no raio de encadeamento se não estiver em Hold/Stop.

### Movement & Controls
- [ ] Clicar no chão com botão direito direciona o herói ao ponto clicado e desvincula alvos de ataque.
- [ ] Pressionar 'S' interrompe movimento e combate imediatamente, ativando `holdPosition`.

### Zoom & Viewport Accuracy
- [ ] Rolar o mouse wheel altera dinamicamente `camera.zoom` entre 0.6x e 1.6x.
- [ ] Clicar no chão ou sobre entidades em qualquer nível de zoom (ex: 0.6x, 1.0x, 1.6x) mapeia para as coordenadas mundiais exatas sem desvio.

### Rotation & Facing
- [ ] O vetor `facing` do herói aponta na direção de caminhada ao mover-se e na direção do alvo ao atacar.
- [ ] A perspectiva isométrica permite alternância/ajuste de ângulo sem quebrar a lógica de movimentação nem a profundidade de renderização.

### Test Automation
- [ ] `npm test` executa com sucesso todos os testes existentes sem erros.
- [ ] Novos testes unitários cobrindo o timer de ressurreição e a precisão do zoom e clique passam com sucesso.


## 2026-10-17T15:47:57Z

Diretriz do usuário: Otimizar o ritmo e tornar a equipe mais ágil e veloz. Reduza sobrecargas ou ciclos redundantes de auditoria. Priorize implementação direta, validação rápida com os testes automatizados ('npm test') e avance rapidamente pelos Marcos restantes (M2: Ataque/Click/Hold, M3: Zoom/Rotação e M4: Integração final).

## 2026-10-18T00:03:50Z

Melhoria e modernização completa de UI, UX e FX (visual e áudio procedural) para o MOBA Duplinha 2.5D, elevando o jogo a um nível profissional de polimento, dinamismo e clareza de combate em tempo real.

Working directory: c:\Users\Bruno\Downloads\jogo-duplinha
Integrity mode: development

## Requirements

### R1. Interface de Usuário (UI) Moderna e Responsiva
Aprimorar o design visual e a clareza de todos os elementos de interface (HUD em partida, status de torres, cronômetro de partida, barra de vida/mana/experiência, slots de habilidades com cooldowns radiais nítidos, inventário de itens, e loja de compras). Incluir banners dinâmicos de eventos de partida (anúncio de First Blood, abates, destruição de torres, surgimento e morte de chefes, vitória e derrota).

### R2. Experiência de Jogador (UX) e Feedback Tátil
Implementar feedback imediato e claro para as ações do jogador: indicador visual animado no chão ao emitir comando de movimento (retículo/onda de clique com botão direito), cursor de mouse adaptativo com indicação de alvo/ataque, tooltips detalhados para itens e habilidades com atributos claros, e feedback intuitivo ao tentar conjurar habilidades sem mana ou em recarga.

### R3. Efeitos Visuais (VFX) e Dinamismo de Câmera
Enriquecer o sistema de partículas com novos efeitos de impacto para ataques básicos e habilidades de cada herói, auras ou rastros de projéteis, efeito de celebração ao subir de nível (level up), anéis de impacto para atordoamento e controle de grupo, e efeito sutil de impacto na câmera (screen shake) configurável durante acertos críticos e mortes de estruturas/chefes.

### R4. Motor de Som e Efeitos Sonoros (SFX) com Web Audio API
Implementar um sistema de áudio procedural e leve utilizando a Web Audio API nativa do navegador, sem dependência de download de arquivos externos pesados. O sistema deve fornecer sintetização sonora para cliques de interface, ataques e conjuração de habilidades, acertos e danos críticos, subida de nível, compra e venda na loja, início/interrupção de recall, e alertas de combate, acompanhado de botão de alternar áudio/mute e controle de volume no HUD.

## Acceptance Criteria

### Integridade e Cobertura de Testes
- [ ] Todos os 197 testes automatizados preexistentes continuam passando com 100% de aprovação (`npm test`).
- [ ] Novos testes unitários e de integração são adicionados cobrindo os sistemas de UI, UX, partículas/screen shake e o sintetizador de áudio procedural.
- [ ] Nenhuma quebra de regressão de comandos de movimento, rotação de câmera, ou cálculos de combate.

### Performance e Execução no Navegador
- [ ] A renderização e a simulação mantêm 60 FPS estáveis sem engasgos ou vazamentos de memória (memory leaks) em loops contínuos de partículas ou nós de áudio.
- [ ] O áudio é inicializado em conformidade com as políticas de autoplay dos navegadores modernos (iniciando no primeiro gesto/clique do usuário) e possui botão de ativar/desativar som visível no HUD.
- [ ] Todos os elementos de UI mantêm proporção e legibilidade responsiva em diferentes resoluções de tela.

## 2026-10-18T02:33:50Z

Continue de onde parou: finalize o Marco 5 (validação final) e a auditoria de vitória independente, depois reporte o resumo final.
