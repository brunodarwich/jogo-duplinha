## 2026-10-18T01:48:10Z
Você é o Worker M4 responsável pela implementação do Marco 4: Motor de Som Procedural (SFX) com Web Audio API nativa e Controles de Áudio.

Seu diretório de trabalho exclusivo é:
c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\worker_m4_r3

LEIA OS ARQUIVOS AUTORITATIVOS:
1. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md (Requisito R4 e critérios de aceitação)
2. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r3\PROJECT.md (Milestone 4 e contratos de interface)
3. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r3_3\handoff.md (Seção 3.2: Audio Graph Pipeline, White Noise Buffer em memória, Tabela de 18 receitas procedurais, desbloqueio de autoplay e headless safety)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

ARQUIVOS DE SUA PROPRIEDADE EXCLUSIVA (WRITE OWNERSHIP):
- src/audio/sound.js (criar novo)
- src/ui/hud.js (atualizar com fio dos controles de áudio e atalho M)
- src/game.js (integrar instância de SoundEngine nos ganchos de combate, habilidades, level up, recall, loja e vitória/derrota)
- index.html (atualizar elementos de áudio se necessário)
- style.css (atualizar estilos do botão e controles de áudio)
- tests/unit/sound_engine.test.js (criar novos testes unitários)

INSTRUÇÕES DETALHADAS DE IMPLEMENTAÇÃO:
1. Em `src/audio/sound.js`:
   - Criar classe `SoundEngine`:
     * Compatibilidade Headless Estrita: Se `typeof window === 'undefined'` ou `typeof AudioContext === 'undefined'` (ou `webkitAudioContext`), inicialize silenciosamente: `this.isSupported = false`, `this.ctx = null`, `this.volume = options.volume ?? 0.7`, `this.isMuted = !!options.muted`. Todos os métodos de reprodução retornam `null` de forma segura sem lançar exceções.
     * Quando no navegador com Web Audio API:
       - `this.ctx = new AudioCtx()`.
       - Criar `this.masterGain` e `this.sfxGain` conectados a `this.ctx.destination`.
       - Pré-compilar `this.noiseBuffer` em memória (buffer de 1 segundo de ruído branco com `Math.random() * 2 - 1`) para reaproveitamento zero-GC em impactos, explosões e lâminas.
       - Desbloqueio de Autoplay: ouvir `pointerdown`, `keydown`, `touchstart` e executar `this.ctx.resume()` no primeiro gesto do usuário, marcando `this.unlocked = true`.
       - Volume e Mute: métodos `setVolume(vol)` (clampado em [0, 1]), `getVolume()`, `setMuted(muted)`, `toggleMute()`, `isMuted`.
       - Persistência: carregar e salvar preferências de volume e mute no `localStorage` ('moba_sound_volume', 'moba_sound_muted') com tratamento try/catch defensivo.
       - Implementar as 18 receitas de síntese sonora procedural usando Oscillators (sine, triangle, sawtooth), BiquadFilter (lowpass, highpass, bandpass), ADSR Gain envelopes e Noise Buffer:
         * `playUiClick()`: sine 800Hz -> 400Hz (0.04s).
         * `playAttack(heroType, isRanged)`:
           - Melee (Knight/Assassin): Noise + Bandpass 800Hz + Sine 180Hz -> 60Hz (0.09s).
           - Ranged (Ranger): Triangle 500Hz -> 950Hz + Highpass Noise (0.06s).
           - Mage (Sorceress): Sawtooth com Lowpass 900Hz (350Hz -> 150Hz) + Noise (0.14s).
           - Cleric: Acorde de dois senos em C5 (523Hz) e E5 (659Hz) (0.20s).
         * `playHit(isCrit = false)`:
           - Normal: Sine 160Hz -> 45Hz + Lowpass noise 300Hz (0.08s).
           - Crit: Sub-bass 110Hz -> 30Hz + Highpass noise 1500Hz (0.22s, gain 0.5).
         * `playSkill(slot, heroId)`:
           - Q: Impacto explosivo (Sine 300Hz -> 50Hz + Bandpass noise, 0.25s).
           - W: Filtro ressonante varrendo 200Hz -> 800Hz (0.40s, aura/buff).
           - E: Chirp sweep rápido 200Hz -> 1200Hz (0.12s, dash/teleporte).
           - R: Acorde triplo harmônico + sub-bass rumble 45Hz (0.8s, ultimate).
         * `playLevelUp()`: Fanfarra em arpeggio maior ascendente C4-E4-G4-C5 (261, 329, 392, 523 Hz, 65ms por nota, decay brilhante).
         * `playShopBuy()`: Duas notas de sino agudas B5 (987Hz) -> E6 (1318Hz), 0.15s, moedas de ouro.
         * `playShopSell()`: Nota média descendente A5 (880Hz) -> E5 (659Hz), 0.12s.
         * `playRecallStart()`: Tom misterioso contínuo em 220Hz com modulação sutil.
         * `playRecallInterrupt()`: Buzzer dissonante 440Hz -> 100Hz (0.1s).
         * `playRecallComplete()`: Feixe ascendente ressonante até 1400Hz + shimmer.
         * `playAlertBoss()`: Corneta bitonal de guerra (330Hz e 440Hz em 2 pulsos).
         * `playVictory()`: Acorde triunfante maior (C-E-G-C sustentado por 2.0s).
         * `playDefeat()`: Tom menor escuro em queda livre (150Hz -> 40Hz, 1.8s).

2. Em `src/ui/hud.js`:
   - Conectar o botão `#btn-audio-toggle` ao `soundEngine.toggleMute()`.
   - Atualizar o ícone visual: 🔊 quando ativo, 🔇 quando mudo.
   - Adicionar listener para tecla 'M' no teclado para alternar o mudo rapidamente.
   - Suportar controle deslizante de volume ou popup se presente.

3. Em `src/game.js`:
   - Instanciar `this.sound = new SoundEngine()` no construtor do GameSimulation.
   - Integrar chamadas a `this.sound` nos momentos chave:
     * Disparo de ataque básico: `this.sound.playAttack(...)`.
     * Impacto de acerto: `this.sound.playHit(isCrit)`.
     * Execução de habilidade: `this.sound.playSkill(slot, heroId)`.
     * Level Up: `this.sound.playLevelUp()`.
     * Compra e Venda de itens na loja: `this.sound.playShopBuy()` e `this.sound.playShopSell()`.
     * Início, interrupção e conclusão de Recall: `this.sound.playRecallStart()`, `playRecallInterrupt()`, `playRecallComplete()`.
     * Surgimento de Boss: `this.sound.playAlertBoss()`.
     * Vitória e Derrota: `this.sound.playVictory()` e `this.sound.playDefeat()`.

4. Em `tests/unit/sound_engine.test.js`:
   - Criar suíte completa de testes unitários:
     * Instanciação e operação headless limpa (sem erros nem alertas).
     * Controle de volume com clamping de valores fora da faixa [0, 1].
     * Controle de mudo e alternância de estado (toggleMute).
     * Execução de todas as 18 receitas sonoras em modo headless (verificando que retornam null e não lançam exceção).
     * Teste com Mock Web Audio API (`MockAudioContext`, `MockOscillatorNode`, `MockGainNode`, `MockBiquadFilterNode`, `MockAudioBuffer`): validar criação dos nós, conexões de grafo, chamadas `start`/`stop`, frequências e envelopes de ganho.
     * Desbloqueio seguro de autoplay na presença de eventos de ponteiro/teclado.

5. Executar e Verificar:
   - Rodar `npm test` no terminal.
   - Todos os 238 testes preexistentes + novos testes unitários de som DEVEM passar com 100% de sucesso (0 falhas).

6. Escrever relatório final em:
   c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\worker_m4_r3\handoff.md
   E enviar mensagem com o resumo ao orquestrador.
