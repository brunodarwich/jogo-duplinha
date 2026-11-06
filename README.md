# ⚔️ MOBA Duplinha 2.5D (Cooperativo 1 a 3 Jogadores & Solo)

Jogo cooperativo estilo MOBA / Lane Push em perspectiva Isométrica 2.5D jogável diretamente no navegador, desenvolvido em HTML5 Canvas e WebSockets/WebRTC (P2P via PeerJS) com suporte instantâneo para 1 a 3 jogadores e modo Solo offline completo.

---

## Novidades da versão 2.0

O anfitrião mantém um único mundo para a equipe: ondas, torres, chefes, dano, ouro e resultado são compartilhados. Convidados enviam comandos, e a entrada tardia recebe o estado da partida em andamento. Todos precisam recarregar a versão atual antes de entrar na mesma sala; clientes com versões incompatíveis recebem uma mensagem.

O HUD mostra o próximo objetivo e a próxima onda. O botão **?** abre um guia curto e a opção de reduzir movimento/tremor; **Loja** abre os equipamentos. A seleção de heróis e os controles da interface aceitam Tab, Enter e Espaço. No toque, o aviso de orientação pode ser dispensado e ATACAR usa apenas ataque básico.

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

A câmera inicia em 125% para destacar o herói. O painel de zoom no canto superior direito oferece botões −/+, controle deslizante de 60% a 160% e restauração para 125%. A roda do mouse também ajusta o zoom suavemente.

| Comando | Ação |
|---|---|
| **Botão Direito do Mouse** | Mover herói / Focar ataque em alvos ou torres |
| **Q** | Habilidade 1 (Golpe principal / Projétil / Cura) |
| **W** | Habilidade 2 (Controle de Grupo / Nevasca / Escudo / Veneno) |
| **E** | Habilidade 3 (Mobilidade / Dash / Cutilada / Julgamento) |
| **R** | Habilidade Suprema (Meteoro / Fortaleza / Sniper / Dança Letal / Milagre) |
| **B** | **Recall**: Canaliza por 5 segundos para retornar à base com vida e mana |
| **P** ou **Clique no Ouro** | Abre a **Loja de Itens** quando estiver dentro da base |
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

Para rodar a suíte completa com **341 testes automatizados** (regras de combate, economia, entrada, UI, efeitos e simulações cooperativas):
```bash
npm test
```
Resultado desta versão: **341/341 testes aprovados em 50 arquivos**. Os testes Node não substituem o navegador: foram verificados solo/teclado/toque emulado e WebRTC real em duas/três abas. Celular físico e duas máquinas distintas ficam como validação adicional. O roteiro e as evidências estão em tasks/browser-checklist.md.
