# ⚔️ MOBA Duplinha 2.5D (Cooperativo 1 a 3 Jogadores & Solo)

Jogo cooperativo estilo MOBA / Lane Push em perspectiva Isométrica 2.5D jogável diretamente no navegador, desenvolvido em HTML5 Canvas e WebSockets/WebRTC (P2P via PeerJS) com suporte instantâneo para 1 a 3 jogadores e modo Solo offline completo.

---

## Novidades da versão 2.3

A versão **2.3** facilita a mira das habilidades: no celular, um toque lança no inimigo focado ou próximo ao alcance; arraste do botão para escolher direção e distância, solte para lançar ou volte ao centro do botão para cancelar. No desktop, Q/W/E/R preparam a mira com encaixe suave em alvos próximos do cursor; clique ou repita a tecla para confirmar, ou use Shift + tecla para lançamento direto. Habilidades ao redor do próprio herói são imediatas. Curas automáticas do Clérigo priorizam heróis aliados feridos, e saltos/teleportes seguem a direção escolhida sem puxar para inimigos. O indicador usa o alcance real de cada rank e destaca o alvo assistido.

A versão **2.1** acrescenta uma tela inicial promocional com os cinco heróis e as torres do jogo. A arte aparece inteira em desktop e celular; o original e o prompt ficam em assets/ui/promo-arena-v2.png e assets/ui/promo-arena-v2.prompt.json. O site usa uma cópia WebP otimizada.

O anfitrião mantém um único mundo para a equipe: ondas, torres, chefes, dano, ouro e resultado são compartilhados. Convidados enviam comandos, e a entrada tardia recebe o estado da partida em andamento. Todos precisam recarregar a versão atual antes de entrar na mesma sala; clientes com versões incompatíveis recebem uma mensagem.

O HUD segue a [interface aprovada e o registro de medidas](tasks/hud-design.md): minimapa e placar no alto à esquerda, relógio e objetivo centrais, loja e configurações à direita. Retrato, vida, mana e XP ficam separados dos botões circulares de combate. Os cinco heróis têm quatro ícones ilustrados próprios, com recarga, mana e evolução sobrepostos em código. **Partida** reúne atributos, inventário, próxima onda, rede e zoom; a engrenagem abre áudio, redução de movimento e guia. A loja mostra o saldo; compras e vendas exigem estar na base.

No celular e tablet, o joystick é fixo e permite mover com um dedo enquanto o outro ataca ou mira uma habilidade. Soltar, cancelar, girar a tela ou abrir uma janela encerra o movimento. As orientações horizontal e vertical funcionam sem aviso bloqueante. Desktop preserva mouse e teclado e mantém o botão Atacar disponível.

As habilidades começam sem rank: use **+** para aprender/evoluir Q/W/E. A suprema exige os níveis 6, 11 e 15 para os respectivos ranks. Evolução, defesas e controle de grupo afetam o combate real. Abates concedem ouro ao autor; aliados vivos a até 800 unidades recebem a assistência de 30% prevista para lacaios.

O jogo detecta falhas do canal cooperativo e mostra o encerramento quando o anfitrião cai. Não há migração automática de anfitrião nem reconexão de uma sessão encerrada. Cheats que alteram o mundo são restritos ao anfitrião.

---

## 🎮 Como Iniciar e Jogar

### Opção 1: Via Node.js (Recomendado)
No terminal do projeto, execute:
```bash
npm start
```
E abra no seu navegador: **[http://localhost:3000](http://localhost:3000)**

### Opção 2: Abrir Diretamente no Navegador
Você também pode abrir o arquivo `index.html` com qualquer servidor local (Live Server do VS Code, `npx serve .`, Python `python -m http.server`, etc.).

---

## 🕹️ Controles e Comandos

A câmera inicia em 125% para destacar o herói. O painel de zoom dentro de **Partida** oferece botões −/+, controle deslizante de 60% a 160% e restauração para 125%. A roda do mouse também ajusta o zoom suavemente.

| Comando | Ação |
|---|---|
| **Botão Direito do Mouse** | Mover herói / Focar ataque em alvos ou torres |
| **Q** | Habilidade 1 (Golpe principal / Projétil / Cura) |
| **W** | Habilidade 2 (Controle de Grupo / Nevasca / Escudo / Veneno) |
| **E** | Habilidade 3 (Mobilidade / Dash / Cutilada / Julgamento) |
| **R** | Habilidade Suprema (Meteoro / Fortaleza / Sniper / Dança Letal / Milagre) |
| **Repetir Q / W / E / R** | Confirmar a habilidade que está sendo mirada |
| **Shift + Q / W / E / R** | Lançar diretamente na mira do cursor |
| **B** | **Recall**: Canaliza por 5 segundos para retornar à base com vida e mana |
| **P** ou **Loja** | Abre os itens; comprar/vender exige estar na base |
| **Clique no Minimapa** | Botão Esquerdo move a câmera; Botão Direito move o herói |
| **Espaço** | Recentraliza a câmera suavemente no seu herói |
| **M** | **Áudio / Mute**: Ativa ou desativa os efeitos sonoros procedurais (Web Audio API) |

---

## 🛡️ Os 5 Heróis Jogáveis

Cada herói possui animações próprias de ataque básico e Q/W/E/R, totalizando 25 sequências com quatro poses transparentes. As ações acompanham o combate e são sincronizadas entre jogadores, retornando à caminhada ou ao repouso ao terminar. Imagens, prompts e detalhes estão em `assets/sprites/combat-prompts.json` e `assets/sprites/ANIMATIONS.md`.

| Herói | Papel | Habilidades (Q / W / E / R) | Estilo de Jogo |
|---|---|---|---|
| **Cavaleiro Guardião** | Tanque / Controle | Golpe de Escudo, Provocação em Área, Cutilada, Fortaleza Inabalável | Alta resistência, atordoamento e criação de barreiras protetoras. |
| **Feiticeira Elemental** | Maga / Burst AoE | Bola de Fogo, Nevasca Congelante, Teleporte Arcano (Blink), Meteoro Devastador | Dano mágico explosivo em área e controle de multidões com gelo. |
| **Patrulheiro Arqueiro** | Atirador DPS Físico | Disparo Perfurante, Chuva de Flechas, Salto Acrobático, Tiro Snipe Global | Dano físico à longa distância, agilidade e execução de alvos feridos. |
| **Sombra Assassina** | Assassino / Burst | Passo das Sombras, Lâminas Envenenadas, Mortalha Sombria, Dança Letal | Teleporte ao alvo, golpes em área e inalvejabilidade temporária com velocidade. |
| **Clérigo da Luz** | Suporte / Curador | Luz Sagrada, Santuário Radiante, Julgamento Solar, Milagre Divino | Cura de aliados, atordoamento solar e barreira própria. |

---

## 🏰 Dinâmica da Trilha (Lane Push & Bosses)

- **Trilha & Torres**: 2 Torres Aliadas defendem sua base e 2 Torres Inimigas barram o avanço. As torres possuem raio de ataque, priorizam agressores de aliados e aumentam o dano a cada disparo consecutivo (*heat scaling*).
- **Hordas Periódicas**: A primeira onda surge aos 8s e as seguintes a cada 25s, com lacaios corpo a corpo e magos à distância avançando pela trilha. A cada 3 ondas, surge um *Minion Canhoneiro*.
- **Mini-Bosses em Turnos**:
  - **Onda 5**: Surge o **Stone Colossus** (alta resistência a torres e pisão com atordoamento em área).
  - **Onda 10**: Surge o **Abyssal Behemoth** (poças de dano contínuo e rugido com silenciamento).
- **Boss Supremo no Nexus**: Protege o cristal inimigo em 3 fases com poderes devastadores. O Nexus fica vulnerável assim que as duas torres anteriores da equipe caem, mesmo com o chefe vivo. A mesma regra vale para o Nexus aliado.
- **Condição de Vitória**: Destruir o Nexus Inimigo.
- **Condição de Derrota**: Ter o Nexus Aliado destruído.

---

## 💰 Loja de Itens e Economia (6 Slots)

- **Ouro**: 1.200 iniciais e renda passiva de 10 ouro/s (600/min), inclusive durante a morte. Abates de lacaios rendem 42g (corpo a corpo), 28g (atirador) e 90g (canhão); torres rendem 600g, mini-chefes 900g e o chefe supremo 1.500g. A renda para ao terminar a partida.
- **Imagens dos itens**: 18 ilustrações individuais em `assets/items/`, usadas na loja, nos detalhes e nos seis espaços de equipamento. A loja inclui o ponto inicial junto ao Nexus.
- **Catálogo de 18 Itens**: Divididos em 3 Tiers (Ataque, Magia, Defesa e Botas):
  - *Tier 1*: Adaga Ágil, Botas Simples, Cristal de Rubi, Espada Curta, Tomo Arcano, Colete de Malha.
  - *Tier 2*: Grevas de Batalha, Passo do Arcano, Martelo de Guerra, Cetro Esmeralda, Foice Sangrenta, Armadura de Ferro.
  - *Tier 3*: Lâmina do Destino, Báculo Celestial, Coração do Colosso, Égide dos Espinhos, Glaive Sombria, Cálice da Alvorada.
- **Venda de Itens**: Devolve 70% do valor em ouro para reinvestir em novos equipamentos.

---

## 🌐 Multiplayer P2P (WebRTC) ou Solo

1. **Solo Offline**: Jogue instantaneamente no navegador com IA completa sem precisar de conexões externas.
2. **Criar Sala**: Gera um código de sala compartilhável (ex: `SALA77`).
3. **Entrar em Sala**: Insira o código da sala de um amigo para jogar cooperativamente em dupla ou trio.

---

## 🧪 Testes Automatizados

Para rodar a suíte completa com **394 testes automatizados** (regras de combate, economia, entrada, UI, efeitos e simulações cooperativas):
```bash
npm test
```
Resultado desta versão: **394/394 testes aprovados em 56 arquivos**. O targeting tem regressões para assistência, gestos, alcance, recursos e cancelamento no convidado. As verificações de navegador e o processo de publicação estão em [tasks/skill-targeting.md](tasks/skill-targeting.md). As verificações anteriores de WebRTC e tela inicial permanecem registradas em tasks/browser-checklist.md e tasks/promo-release.md; celular físico e duas máquinas distintas ficam como validação adicional.

### Verificação do HUD responsivo

`npm test` executa os testes de lógica. Com Playwright e Chrome instalados, `node tools/check-mobile-hud.mjs` verifica sete tamanhos de toque (320×568 a 1440×810), quatro larguras de desktop, limites/sobreposições e áreas de toque, menus, configurações, compra/venda e recursos, cinco heróis, estados de habilidades, dois dedos reais via CDP, cancelamento, rotação e fallback de arte. O teste serve os arquivos locais por interceptação e substitui somente o PeerJS externo para testar solo sem rede. As capturas e as coordenadas medidas ficam em uma pasta temporária impressa ao concluir. Defina `PLAYWRIGHT_MODULE` para usar outra instalação e `HUD_SCREENSHOT_DIR` para escolher o destino. As capturas de referência desta implementação estão em `output/ui-concepts/before/` e `output/ui-concepts/after/`.
