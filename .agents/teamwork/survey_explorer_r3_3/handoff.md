# Relatório de Pesquisa & Arquitetura — Requisitos R3 & R4 (VFX, Screen Shake e Áudio SFX Procedural)

**Data**: 2026-10-18T00:15:00Z  
**Autor**: Survey Explorer 3 (Especialista em VFX e Áudio SFX Procedural)  
**Escopo**: Mapeamento do estado atual e arquitetura detalhada para R3 (Efeitos Visuais e Câmera) e R4 (Motor de Som Procedural com Web Audio API).

---

## 1. Observação

### 1.1 Estado do Repositório e Suíte de Testes
- Comando executado: `npm test`
- Resultado: **197 testes executados com 100% de aprovação (0 falhas) em 2.95s** através de `tests/runner.js` em ambiente puro Node.js (`package.json` linha 8: `"test": "node -c src/main.js && node tests/runner.js"`).
- O ambiente de testes roda em Node.js headless: `window`, `document`, `HTMLCanvasElement` e `AudioContext` são nativamente `undefined`. Nenhuma dependência externa pesada (como jsdom) está instalada em `node_modules`.

### 1.2 Sistema Atual de Partículas (`src/render/particles.js`)
- Linhas 10-15: Classe `ParticleSystem` mantém `this.particles = []`, `this.floatingTexts = []` e limite de capacidade `this.maxParticles = 500`.
- Linhas 22-79: Método `emit(type, options)` suporta apenas tipos primitivos: `'spark'`, `'fire'`, `'frost'`, `'heal'`, `'ring'`.
- Linhas 104-140: `update(dt)` aplica gravidade (`vz -= 98 * dt`), arrasto (`vx *= drag; vy *= drag;`), expansão de anel (`radius += growthRate * dt`), e decaimento linear de `life` e `alpha`.
- Linhas 142-201: `draw(ctx, camera, zoom)` utiliza `worldToScreen(p.x, p.y, p.z, camera, zoom)` com `globalCompositeOperation = 'lighter'` para partículas e `source-over` para textos flutuantes.
- **Lacuna**: Não há suporte para partículas de confete oscilante (level up), rastros contínuos de projéteis (auras/trails), anéis de choque de controle de grupo (CC) com pulso dinâmico, nem presets de impacto específicos para os 5 heróis.

### 1.3 Sistema de Câmera (`src/core/camera.js`)
- Linhas 21-53: `Camera` suporta interpolação exponencial (`smoothing: 8.0`), zoom suavizado (`minZoom: 0.6`, `maxZoom: 1.6`, `zoomSmoothing: 12.0`) e rotação de perspectiva (`rotation`, `rotationSmoothing: 12.0`).
- Linhas 243-287: Método `update(dt)` atualiza zoom, rotação e segue o alvo (`target`), mas **não possui nenhum sistema de screen shake / trauma**.
- **Lacuna**: Ausência total de propriedades de trauma (`trauma`, `traumaDecay`), deslocamentos de tela (`shakeOffsetX`, `shakeOffsetY`, `shakeRoll`) e métodos de disparo de impacto (`addTrauma`, `shake`).

### 1.4 Renderizador Isométrico (`src/render/renderer.js`)
- Linhas 65-112: `render(gameState, camera, inputManager, particleSystem)` divide a renderização em 7 passes lineares:
  - Pass 1: Terreno
  - Pass 2: Decalques de chão e miras de habilidades
  - Pass 3: Sombras de unidades
  - Pass 4: Entidades ordenadas por profundidade Y
  - Pass 5: Partículas e textos flutuantes
  - Pass 6: Barras de vida e mana suspensas
  - Pass 7: Notificações de tela (HUD e vinheta de pouca vida)
- **Lacuna**: Nenhuma translação ou rotação de vibração de câmera é aplicada no contexto (`ctx`). A aplicação de screen shake nos Passes 1 a 6 é o ponto perfeito para tremer o mundo sem distorcer o HUD da tela.

### 1.5 Projéteis e Ataques Básicos (`src/combat/projectile.js` e `src/game.js`)
- `HeroProjectile` (`src/combat/projectile.js`, linhas 33-68): Em `update(dt, simulation)`, move-se linearmente em direção ao alvo, mas **não emite partículas de rastro durante o voo**.
- Melee Attacks (`src/game.js`, linhas 1232-1265): Emite apenas 12 faíscas azuis/roxas genéricas e 1 anel simples.
- Ranged Attacks (`src/game.js`, linhas 1267-1288): Instancia `HeroProjectile` e emite apenas 6 faíscas na conjuração; no impacto (`applyHeroHit`, linhas 1291-1347), emite apenas faíscas genéricas.
- **Lacuna**: Falta de identidade visual para os ataques de cada um dos 5 heróis (fogo e brasas para a Feiticeira, faíscas metálicas/ondas para o Cavaleiro, lascas esmeralda e penas para o Patrulheiro, fumaça sombria violeta para a Assassina, feixes dourados solares para o Clérigo).

### 1.6 Controle de Grupo (CC) e Level Up
- `src/systems/leveling.js` e `src/game.js` (linhas 720-742): `triggerLevelUpVFX` emite apenas 1 anel amarelo e 35 faíscas. Não há celebração de confetes, nem pilares luminosos ascendentes.
- `src/combat/cc.js` e `src/game.js` (linhas 986-995): A aplicação de Stun e Slow apenas atualiza `stunnedUntil` e `slowedUntil`, sem gerar anéis de impacto expansivos ou coroas visuais de atordoamento.

### 1.7 Estado do Motor de Som (SFX)
- `grep_search` por `AudioContext`, `sound`, `audio` em `src/`:
  - Não existe nenhum arquivo de áudio (`src/audio/` não existe).
  - Em `src/ui/shop_ui.js` (linha 251), há um comentário `// Audio/visual feedback`, mas apenas texto flutuante é exibido.
- **Lacuna**: Ausência completa de sintetizador de som procedural, controles de volume e mute no HUD, e tratamento de desbloqueio de áudio por gesto de usuário.

---

## 2. Cadeia Lógica (Logic Chain)

1. **Premissa de Testes e Headless Safety**: A suíte de testes existente roda com `node tests/runner.js` em Node.js puro sem navegador. Portanto, qualquer nova classe de áudio ou efeito visual deve inicializar de forma defensiva:
   - Se `typeof window === 'undefined'` ou `typeof AudioContext === 'undefined'`, a classe deve operar em modo silencioso (`this.isSupported = false`, `this.ctx = null`) sem lançar exceções.
2. **Premissa de Desempenho e Leveza (Web Audio API Procedural)**:
   - A especificação original (R4) exige explicitamente **nenhum download de arquivos externos pesados** (sem `.wav`/`.mp3` estáticos via fetch).
   - A Web Audio API nativa fornece todos os blocos necessários: `OscillatorNode` (para tons senoidais, triangulares e dente-de-serra), `BiquadFilterNode` (para modelagem acústica passa-baixa, passa-alta e passa-faixa), `GainNode` (para envelopes ADSR e controle mestre de volume), e `AudioBuffer` de ruído branco procedural sintetizado em memória (para ataques cortantes, impactos metálicos e explosões).
3. **Premissa de Conformidade com Políticas de Autoplay**:
   - Navegadores modernos inicializam `AudioContext` no estado `'suspended'` até que haja uma interação do usuário (`pointerdown`, `keydown`, `touchstart`).
   - O motor de som deve escutar os eventos globais de clique/teclado para chamar `ctx.resume()` automaticamente no primeiro gesto.
4. **Premissa do Dinamismo de Câmera (Trauma-based Screen Shake)**:
   - O modelo de trauma (Squirrel Eiserloh) é o padrão da indústria para câmeras 2D: o trauma decai linearmente com o tempo (`trauma = Math.max(0, trauma - decay * dt)`), enquanto a intensidade do tremor é não-linear quadrática (`shake = trauma * trauma`).
   - Isso garante que impactos leves (crítico) gerem um tremor sutil e imperceptível na jogabilidade, enquanto eventos massivos (queda de torre, morte de boss) gerem um tremor vigoroso e cinematográfico.
   - Aplicar a translação do tremor no `Renderer` entre o `ctx.save()` e `ctx.restore()` abrangendo os Passes 1 a 6 mantém os elementos de mundo alinhados, enquanto o Pass 7 (HUD e vinhetas de tela) permanece estável para clareza de leitura.
5. **Premissa de Identidade Visual dos 5 Heróis**:
   - Cada herói possui uma paleta de cores e tema definidos em `src/entities/heroes.js`:
     - Cavaleiro: `#3b82f6` / `#60a5fa` (Aço, choque físico)
     - Feiticeira: `#ef4444` / `#f97316` (Chamas, gelo, fagulhas arcanas)
     - Patrulheiro: `#10b981` / `#34d399` (Vento, flechas perfurantes esmeralda)
     - Assassina: `#8b5cf6` / `#a855f7` (Sombra, cortes críticos venenosos)
     - Clérigo: `#eab308` / `#fde047` (Luz solar, raios sagrados dourados)
   - Vincular os emissores de partículas e os timbres sintetizados a essas matrizes reforça a clareza visual e tátil do combate.

---

## 3. Arquitetura Detalhada & Especificações Técnicas

### 3.1 Arquitetura de VFX e Screen Shake (R3)

#### A. Dinamismo de Câmera em `src/core/camera.js`
Adicionar suporte a trauma e screen shake na classe `Camera`:
- **Propriedades**:
  - `this.trauma = 0.0;` (intervalo [0.0, 1.0])
  - `this.traumaDecay = 2.0;` (decaimento por segundo, duração total de 0.5s para trauma máximo)
  - `this.maxShakeX = 14;` (deslocamento máximo em pixels)
  - `this.maxShakeY = 10;`
  - `this.maxShakeRoll = 0.02;` (rotação angular em radianos)
  - `this.shakeOffsetX = 0;`
  - `this.shakeOffsetY = 0;`
  - `this.shakeRoll = 0;`
  - `this.shakeEnabled = true;` (para acessibilidade e configurações)
- **Métodos**:
  - `addTrauma(amount)`: `this.trauma = Math.min(1.0, this.trauma + Math.max(0, amount));`
  - `setShakeEnabled(enabled)`: liga/desliga o efeito.
  - No método `update(dt)`:
    ```javascript
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - this.traumaDecay * safeDt);
      const shake = this.trauma * this.trauma; // Não-linearidade
      if (shake > 0 && this.shakeEnabled) {
        this.shakeOffsetX = (Math.random() * 2 - 1) * this.maxShakeX * shake;
        this.shakeOffsetY = (Math.random() * 2 - 1) * this.maxShakeY * shake;
        this.shakeRoll = (Math.random() * 2 - 1) * this.maxShakeRoll * shake;
      } else {
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        this.shakeRoll = 0;
      }
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeRoll = 0;
    }
    ```

#### B. Aplicação do Shake no Pipeline em `src/render/renderer.js`
No método `render()`:
```javascript
// Aplicar Screen Shake nos passes de mundo e entidades (Pass 1 ao 6)
ctx.save();
if (camera && camera.shakeEnabled && (camera.shakeOffsetX || camera.shakeOffsetY || camera.shakeRoll)) {
  ctx.translate(camera.shakeOffsetX, camera.shakeOffsetY);
  if (camera.shakeRoll) {
    ctx.translate(this.viewportWidth / 2, this.viewportHeight / 2);
    ctx.rotate(camera.shakeRoll);
    ctx.translate(-this.viewportWidth / 2, -this.viewportHeight / 2);
  }
}

this.pass1_Terrain(ctx, camera, zoom);
this.pass2_GroundDecals(ctx, gameState, inputManager, camera, zoom);
this.pass3_GroundShadows(ctx, entities, camera, zoom);
this.pass4_SortedEntities(ctx, entities, camera, zoom);
this.pass5_Particles(ctx, particleSystem, camera, zoom);
this.pass6_OverheadHUD(ctx, entities, camera, zoom);

ctx.restore();

// Pass 7 (Notificações de tela cheia, vinheta de vida baixa) desenhado fixo
this.pass7_ScreenHUD(ctx, gameState, playerHero);
```

#### C. Gatilhos de Screen Shake no Jogo (`src/game.js`)
| Evento | Valor de Trauma (`addTrauma`) | Intensidade Percebida |
|---|---|---|
| Acerto Crítico (Hero Basic Attack / Skill) | `0.18` | Impacto sutil (~0.5px de vibração rápida, 0.09s) |
| Morte do Herói Jogador | `0.35` | Choque dramático (~1.7px de vibração, 0.18s) |
| Destruição de Torre (Aliada ou Inimiga) | `0.50` | Tremor moderado (~3.5px, 0.25s) |
| Derrota de Mini-Boss ou Boss Supremo | `0.65` | Tremor épico de conquista (~6.0px, 0.33s) |

#### D. Novos Efeitos no Sistema de Partículas (`src/render/particles.js`)
1. **Tipo `'confetti'`**:
   - Para celebração de Level Up: partículas retangulares coloridas (`size: 4x8`), que giram (`angle += angularVelocity * dt`) e caem lentamente sob gravidade suave (`vz = -30 * dt`) com oscilação horizontal de vento (`Math.sin(life * 10)`).
2. **Tipo `'trail'` (Auras e Rastros de Projétil)**:
   - Partícula de curta duração (`life: 0.15s`), sem gravidade (`drag: 0.98`, `vz: 0`), raio decrescente e alfa rápido, garantindo estela contínua atrás de flechas, bolas de fogo e feixes de luz.
3. **Tipo `'cc_ring'` / Anel de Choque de Atordoamento**:
   - Anel elíptico no solo com espessura variável e partículas em órbita suspensas (`z: 35`) simulando estrelas girando ao redor da cabeça da unidade atordoada.
4. **Presets de Impacto de Ataque Básico por Herói**:
   - **Cavaleiro**: 14 faíscas branco/dourado (`#fef08a`), 1 anel de pressão metálica (`#60a5fa`), flash de corte diagonal.
   - **Feiticeira**: 16 faíscas de fogo (`#f97316` / `#ef4444`), nuvem de brasa quente, anel de calor radiante.
   - **Patrulheiro**: 12 fragmentos esmeralda perfurantes (`#34d399` / `#10b981`), dispersão cônica na direção da trajetória.
   - **Assassina**: 18 faíscas venenosas violeta (`#a855f7`), puff de fumaça sombria (`#1e1b4b`), corte crítico em cruz vermelha se for crítico.
   - **Clérigo**: 14 partículas solares cintilantes (`#fde047`), anel de irradiação sagrada (`#fef08a`).

#### E. Celebração de Level Up (`triggerLevelUpVFX`)
- Disparo de 2 anéis concêntricos dourados (um veloz que se expande até raio 120 e outro retardado).
- Emissão de 40 partículas de confete multicor (`#f59e0b`, `#ec4899`, `#10b981`, `#3b82f6`, `#8b5cf6`, `#facc15`).
- Emissão de 25 faíscas celestes que sobem verticalmente (`vz = 140`, sem gravidade).
- Texto flutuante ampliado com contorno brilhante: `⭐ LEVEL UP! NÍVEL ${newLevel} ⭐`.

---

### 3.2 Arquitetura do Motor de Som (SFX) com Web Audio API (R4)

#### A. Arquivo a Criar: `src/audio/sound.js`
Classe principal: `SoundEngine`

##### 1. Grafo de Áudio (Audio Graph Pipeline)
```
[Sintetizadores Procedurais]
   ├── [OscillatorNode] ──> [GainNode ADSR] ──┐
   ├── [WhiteNoiseBufferSource] ─> [BiquadFilterNode] ──> [GainNode ADSR] ─┤
                                                                          ▼
                                                                 [SFX Master Gain]
                                                                          │
                                                                          ▼
                                                                 [Master Gain (Mute)]
                                                                          │
                                                                          ▼
                                                                 [ctx.destination]
```

##### 2. Buffer de Ruído Branco Pré-Compilado em Memória
Para evitar alocação de lixo no garbage collector a cada explosão ou golpe:
- Ao instanciar `SoundEngine`, criar um buffer de 1.0 segundo com taxa de amostragem do contexto (`sampleRate`):
  ```javascript
  const bufferSize = this.ctx.sampleRate;
  this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
  const output = this.noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  ```

##### 3. Tabela de Receitas de Síntese Procedural
| Efeito Sonoro | Método | Nós e Formas de Onda | Envelope / Frequências | Sensação Sonora |
|---|---|---|---|---|
| **Clique de UI** | `playUiClick()` | Oscillator (`sine`) | 800 Hz -> 400 Hz em 0.04s, Gain 0.2 -> 0.001 | Clique suave e limpo de interface |
| **Ataque Corpo a Corpo (Knight/Assassin)** | `playAttackMelee(isAssassin)` | Noise + BiquadFilter (Bandpass 800Hz) + Sine (180Hz -> 60Hz) | Duração 0.09s, Gain 0.3 -> 0.01 | Corte rápido de lâmina pelo ar |
| **Ataque À Distância (Ranger)** | `playAttackRanged()` | Oscillator (`triangle`) + Noise (Highpass 2000Hz) | 500 Hz -> 950 Hz em 0.06s | Zunido de corda solta e estalo de flecha |
| **Conjuração Magia (Sorceress)** | `playAttackMage()` | Oscillator (`sawtooth` com Lowpass 900Hz) + Noise | 350 Hz -> 150 Hz em 0.14s | Ignição de bola de fogo crepitante |
| **Conjuração Sagrada (Cleric)** | `playAttackCleric()` | Dois Oscillators (`sine` afinados em C5 e E5) | 523 Hz + 659 Hz em 0.20s | Acorde celestial cristalino |
| **Acerto Normal** | `playHit(isCrit=false)` | Oscillator (`sine`) + Ruído passa-baixo (300Hz) | 160 Hz -> 45 Hz em 0.08s, Gain 0.25 | Pancada seca física no corpo |
| **Acerto Crítico** | `playHit(true)` | Sub-Bass (`sine` 110Hz -> 30Hz) + Highpass Noise (1500Hz) | Duração 0.22s, Gain 0.5 | Impacto pesado de concussão com estalo metálico |
| **Habilidade Q** | `playSkillQ(heroId)` | Impacto explosivo: Sine 300Hz -> 50Hz + Bandpass Noise | Duração 0.25s, Gain 0.45 | Golpe de escudo ou impacto explosivo |
| **Habilidade W** | `playSkillW(heroId)` | Filtro ressonante varrendo 200Hz a 800Hz | Duração 0.40s, som de aura/provocação | Onda de expansão mágica |
| **Habilidade E** | `playSkillE(heroId)` | Chirp rápido ascendente 200Hz -> 1200Hz (0.12s) | High-pass zap / dash | Teleporte ou esquiva veloz |
| **Habilidade R (Ultimate)** | `playSkillR(heroId)` | Acorde poderoso triplo + Sub-bass rumble (45Hz) | Duração 0.8s, crescendo dramático | Momento de clímax cinematográfico |
| **Level Up** | `playLevelUp()` | Arpeggio maior ascendente (C4-E4-G4-C5: 261, 329, 392, 523 Hz) | 4 notas separadas por 65ms, decay brilhante | Fanfarra clássica de conquista |
| **Compra na Loja** | `playShopBuy()` | Duas notas de sino agudas (B5 987Hz -> E6 1318Hz) | Duração 0.15s, ondas triangulares | Moedas de ouro tilintando |
| **Venda na Loja** | `playShopSell()` | Nota média descendente (A5 880Hz -> E5 659Hz) | Duração 0.12s | Retirada de moedas da bolsa |
| **Início de Recall (B)** | `playRecallStart()` | Tom misterioso contínuo oscilando com LFO em 220Hz | Fade-in suave de canalização | Energia mágica se concentrando |
| **Interrupção de Recall** | `playRecallInterrupt()`| Buzzer dissonante descendente (440Hz -> 100Hz em 0.1s) | Quebra abrupta com corte de filtro | Alerta imediato de perigo |
| **Conclusão de Recall** | `playRecallComplete()` | Feixe ascendente ressonante para 1400Hz + Shimmer | Teleporte final para a base | Chegada segura na fonte |
| **Alerta de Chefe** | `playAlertBoss()` | Corneta de guerra bitonal (330Hz e 440Hz, staccato) | 2 pulsos de 0.18s | Advertência dramática na trilha |
| **Vitória** | `playVictory()` | Acorde triunfante maior (C-E-G-C sustentado) | Duração 2.0s com reverb simulado | Celebração heroica de vitória |
| **Derrota** | `playDefeat()` | Tom escuro menor em queda livre (150Hz -> 40Hz) | Duração 1.8s | Tom sombrio de queda do nexus |

##### 4. Desbloqueio de Autoplay do Navegador
No construtor de `SoundEngine`:
```javascript
this.unlocked = false;
const unlockHandler = () => {
  if (this.ctx && this.ctx.state === 'suspended') {
    this.ctx.resume().then(() => {
      this.unlocked = true;
    });
  } else {
    this.unlocked = true;
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointerdown', unlockHandler);
    window.removeEventListener('keydown', unlockHandler);
    window.removeEventListener('touchstart', unlockHandler);
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockHandler);
  window.addEventListener('keydown', unlockHandler);
  window.addEventListener('touchstart', unlockHandler);
}
```

##### 5. Persistência de Preferências e Controles no HUD
- Em `localStorage`:
  - `localStorage.getItem('moba_sound_volume')` (padrão: `0.7`)
  - `localStorage.getItem('moba_sound_muted')` (padrão: `'false'`)
- Elementos no HUD (`index.html`):
  - Botão de Mute: `<button id="sound-mute-btn" class="sound-mute-btn" title="Alternar Som (M)">🔊</button>`
  - Slider de Volume: `<input type="range" id="sound-volume-slider" class="sound-volume-slider" min="0" max="1" step="0.05" value="0.7">`
- Atalho de teclado: tecla **M** alterna o estado de mudo instantaneamente.

##### 6. Compatibilidade Estrita com Node.js Headless
```javascript
export class SoundEngine {
  constructor(options = {}) {
    const AudioCtx = typeof window !== 'undefined'
      ? (window.AudioContext || window.webkitAudioContext)
      : null;

    if (!AudioCtx) {
      this.isSupported = false;
      this.ctx = null;
      this.volume = options.volume ?? 0.7;
      this.isMuted = !!options.muted;
      return;
    }

    this.isSupported = true;
    this.ctx = new AudioCtx();
    // Setup nodes...
  }

  playUiClick() {
    if (!this.isSupported || this.isMuted || !this.ctx) return null;
    // Synthesis logic...
  }
}
```
Isso garante que 100% dos testes em `tests/runner.js` continuarão executando em velocidade máxima sem dependência de emulação de áudio.

---

## 4. Arquivos a Criar e Modificar

### 4.1 Arquivo a Criar
1. **`src/audio/sound.js`**:
   - Implementação completa do `SoundEngine` procedural nativo Web Audio API.
   - Gerenciamento de Master Gain, SFX Gain, volume, mute, persistência em localStorage e métodos de síntese para todas as ações do jogo.
2. **`tests/unit/vfx_sound.test.js`**:
   - Testes unitários para `Camera.addTrauma`, decaimento de tremor e clamping.
   - Testes unitários para `ParticleSystem` (novos tipos `confetti`, `trail`, `cc_ring`, despejo em limite de 500).
   - Testes unitários para `SoundEngine` em modo headless (verificando que todos os métodos executam sem lançar erros quando `AudioContext` é nulo).
   - Testes com Mock AudioContext validando a criação de nós e temporização de frequências.

### 4.2 Arquivos a Integrar (com escopo preciso)
1. **`src/core/camera.js`**:
   - Adicionar propriedades `trauma`, `traumaDecay`, `shakeOffsetX`, `shakeOffsetY`, `shakeRoll`, `shakeEnabled`.
   - Adicionar métodos `addTrauma(amount)` e `setShakeEnabled(enabled)`.
   - Atualizar `update(dt)` para calcular o deslocamento a cada frame.
2. **`src/render/renderer.js`**:
   - Aplicar `ctx.translate(camera.shakeOffsetX, camera.shakeOffsetY)` antes do Pass 1 e restaurar antes do Pass 7.
3. **`src/render/particles.js`**:
   - Adicionar suporte a partículas `'confetti'` com rotação e oscilação lateral.
   - Adicionar suporte a `'trail'` para projéteis em voo.
   - Adicionar método `emitHeroHitImpact(heroClass, targetX, targetY, isCrit)` com cores e características exclusivas para cada herói.
4. **`src/combat/projectile.js`**:
   - Em `update(dt, simulation)`, emitir partículas de rastro suaves com base na classe do herói.
5. **`src/game.js`**:
   - Instanciar `this.sound = new SoundEngine()` no construtor.
   - Integrar `this.sound.playAttack()` em `executeHeroBasicAttack()`.
   - Integrar `this.sound.playHit(isCrit)` e `this.camera.addTrauma(0.18)` em `applyHeroHit()`.
   - Integrar `this.sound.playSkill(heroId, slot)` em `executeHeroSkill()`.
   - Integrar `this.sound.playLevelUp()` e confetes aprimorados em `triggerLevelUpVFX()`.
   - Disparar `this.camera.addTrauma(0.50)` e `this.sound.playAlert('tower')` na queda de torres.
   - Disparar `this.camera.addTrauma(0.65)` e `this.sound.playAlert('boss')` na derrota de chefes.
   - Disparar `this.sound.playShopBuy()` e `playShopSell()` em `src/ui/shop_ui.js`.
   - Disparar `this.sound.playRecallStart()`, `playRecallInterrupt()` e `playRecallComplete()` nos eventos de Recall.
6. **`index.html` & `style.css`**:
   - Adicionar botão de mute e controle deslizante de volume no cabeçalho ou console superior do HUD.
   - Estilização moderna e responsiva com backdrop-filter e cores correspondentes à paleta do jogo.
7. **`src/ui/hud.js`**:
   - Conectar os eventos de clique e arrasto dos controles de som ao `gameSim.sound`.

---

## 5. Ressalvas (Caveats)

1. **Restrição de Leitura do Explorer**: Nenhuma modificação foi realizada em arquivos de código de produção nesta etapa, cumprindo rigorosamente as diretrizes de investigação do projeto.
2. **Qualidade Acústica em Navegadores Diferentes**: A Web Audio API utiliza sample rates que podem variar entre 44.1 kHz e 48 kHz dependendo da placa de som do usuário. O cálculo procedural com envelopes baseados em `ctx.currentTime` elimina qualquer discrepância de afinação ou tempo.
3. **Limite de Partículas para 60 FPS**: Para garantir estabilidade em máquinas de baixo custo ou celulares, o limite existente de 500 partículas em `ParticleSystem` deve ser respeitado, garantindo que partículas antigas sejam descartadas (`shift`) sem criar filas infinitas.

---

## 6. Conclusão

O plano para os Requisitos R3 e R4 está 100% estruturado, cobrindo todos os critérios de aceitação:
- **VFX e Câmera (R3)**: O sistema de partículas existente é altamente extensível e está pronto para receber os emissores temáticos dos 5 heróis, os rastros de projéteis e a celebração de subida de nível. A implementação de Screen Shake por trauma quadrático em `Camera` acoplada ao `Renderer` é matematicamente elegante, não altera o mapeamento de coordenadas isoméricas essenciais e respeita o isolamento do HUD.
- **Áudio SFX Procedural (R4)**: A Web Audio API oferece capacidade completa para sintetizar todos os sons de combate, interface, loja e alertas sem requisições HTTP adicionais ou arquivos estáticos pesados. A arquitetura projetada assegura compatibilidade total com as restrições de autoplay dos navegadores e total segurança para a suíte de testes headless do Node.js.

---

## 7. Método de Verificação (Verification Method)

Quando a implementação for executada pela equipe nos próximos marcos, a validação deve seguir estes passos objetivos:

1. **Execução da Suíte de Testes Automatizados**:
   ```powershell
   npm test
   ```
   *Critério de aprovação*: Todos os 197 testes preexistentes continuam passando com 100% de sucesso + novos testes de `vfx_sound.test.js` passando sem erros no ambiente headless do Node.js.

2. **Verificação de Ausência de Vazamentos de Memória e 60 FPS**:
   - Iniciar o servidor local (`npm start` ou `node server.js`) e abrir `http://localhost:3000`.
   - Monitorar a aba Performance do Chrome/Edge DevTools: confirmar 60 FPS estáveis durante tempestades de partículas e múltiplos disparos de som procedural.

3. **Verificação dos Controles de Áudio**:
   - Clicar em qualquer botão da interface: o som de clique deve tocar imediatamente após o primeiro gesto.
   - Ajustar o slider de volume: o volume dos efeitos deve variar proporcionalmente.
   - Clicar no botão de mute ou pressionar a tecla 'M': o áudio deve emudecer instantaneamente e o ícone mudar para 🔇.
   - Recarregar a página: as preferências de volume e mute devem persistir via `localStorage`.

4. **Verificação de Screen Shake e VFX**:
   - Desferir um ataque crítico: confirmar tremor sutil e concentrado na tela e faíscas ampliadas.
   - Destruir uma torre ou chefe: confirmar tremor cinematográfico perceptível sem perda do alinhamento do cursor do mouse.
   - Subir de nível: confirmar explosão festiva de confetes coloridos, anéis dourados e texto brilhante.
