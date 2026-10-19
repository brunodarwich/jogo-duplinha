# ⚔️ MOBA Duplinha 2.5D (Cooperativo 1 a 3 Jogadores & Solo)

Jogo cooperativo estilo MOBA / Lane Push em perspectiva Isométrica 2.5D jogável diretamente no navegador, desenvolvido em HTML5 Canvas e WebSockets/WebRTC (P2P via PeerJS) com suporte instantâneo para 1 a 3 jogadores e modo Solo offline completo.

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

| Herói | Papel | Habilidades (Q / W / E / R) | Estilo de Jogo |
|---|---|---|---|
| **Cavaleiro Guardião** | Tanque / Controle | Golpe de Escudo, Provocação em Área, Cutilada, Fortaleza Inabalável | Alta resistência, atordoamento e criação de barreiras protetoras. |
| **Feiticeira Elemental** | Maga / Burst AoE | Bola de Fogo, Nevasca Congelante, Teleporte Arcano (Blink), Meteoro Devastador | Dano mágico explosivo em área e controle de multidões com gelo. |
| **Patrulheiro Arqueiro** | Atirador DPS Físico | Disparo Perfurante, Chuva de Flechas, Salto Acrobático, Tiro Snipe Global | Dano físico à longa distância, agilidade e execução de alvos feridos. |
| **Sombra Assassina** | Assassino / Burst | Passo das Sombras, Lâminas Envenenadas, Mortalha Sombria, Dança Letal | Teleporte atrás do alvo, dano crítico massivo, invisibilidade e veneno. |
| **Clérigo da Luz** | Suporte / Curador | Luz Sagrada, Santuário Radiante, Julgamento Solar, Milagre Divino | Cura contínua da equipe, auras sagradas, cegueira solar e invulnerabilidade. |

---

## 🏰 Dinâmica da Trilha (Lane Push & Bosses)

- **Trilha & Torres**: 2 Torres Aliadas defendem sua base e 2 Torres Inimigas barram o avanço. As torres possuem raio de ataque, priorizam agressores de aliados e aumentam o dano a cada disparo consecutivo (*heat scaling*).
- **Hordas Periódicas**: A cada 60s surge uma nova onda de lacaios corpo-a-corpo e magos à distância, avançando pelos waypoints da trilha. A cada 3 ondas, surge um *Minion Canhoneiro*.
- **Mini-Bosses em Turnos**:
  - **Onda 5**: Surge o **Stone Colossus** (alta resistência a torres e pisão com atordoamento em área).
  - **Onda 10**: Surge o **Abyssal Behemoth** (poças de dano contínuo e rugido com silenciamento).
- **Boss Supremo no Nexus**: Protege o cristal inimigo em 3 fases com poderes devastadores. O Nexus só pode ser destruído após a derrota do Boss Supremo!
- **Condição de Vitória**: Destruir o Nexus Inimigo.
- **Condição de Derrota**: Ter o Nexus Aliado destruído.

---

## 💰 Loja de Itens e Economia (6 Slots)

- **Ouro**: Ganho passivo contínuo (+2 ouro/s) + bônus de abates em lacaios (+25g), torres (+300g) e chefes (+150g a +500g).
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

Para rodar a suíte completa com **262 testes automatizados** (testes unitários, matemáticos, de combate, economia, UI, UX, VFX, SFX e simulações E2E completas):
```bash
npm test
```
Resultados certificados: **262/262 testes aprovados com 100% de sucesso em 35 suítes!**
