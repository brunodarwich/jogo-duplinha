## 2026-10-18T01:24:13Z
Você é o Worker M3 responsável pela implementação do Marco 3: Efeitos Visuais (VFX), Dinamismo de Câmera (Screen Shake) e Partículas Temáticas dos 5 Heróis.

Seu diretório de trabalho exclusivo é:
c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\worker_m3_r3

LEIA OS ARQUIVOS AUTORITATIVOS:
1. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md (Requisito R3 e critérios)
2. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r3\PROJECT.md (Milestone 3 e contratos)
3. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\survey_explorer_r3_3\handoff.md (Especificação minuciosa do Explorer 3 com fórmulas e presets)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

ARQUIVOS DE SUA PROPRIEDADE EXCLUSIVA (WRITE OWNERSHIP):
- src/core/camera.js
- src/render/renderer.js
- src/render/particles.js
- src/combat/projectile.js
- src/game.js
- tests/unit/vfx_shake.test.js (criar)

INSTRUÇÕES DETALHADAS DE IMPLEMENTAÇÃO:
1. Em `src/core/camera.js`:
   - Adicionar modelo de trauma e screen shake:
     * `this.trauma = 0.0;`
     * `this.traumaDecay = options.traumaDecay ?? 2.0;`
     * `this.maxShakeX = options.maxShakeX ?? 14;`
     * `this.maxShakeY = options.maxShakeY ?? 10;`
     * `this.maxShakeRoll = options.maxShakeRoll ?? 0.02;`
     * `this.shakeOffsetX = 0;`
     * `this.shakeOffsetY = 0;`
     * `this.shakeRoll = 0;`
     * `this.shakeEnabled = true;`
   - Métodos:
     * `addTrauma(amount)`: incrementa trauma clampado em [0, 1.0].
     * `setShakeEnabled(enabled)`: liga/desliga o tremor.
   - Em `update(dt)`:
     * Se `this.trauma > 0`, decai linearmente `this.trauma = Math.max(0, this.trauma - this.traumaDecay * safeDt)`.
     * Calcula intensidade não-linear: `const shake = this.trauma * this.trauma`.
     * Se `shake > 0 && this.shakeEnabled`, calcula deslocamentos aleatórios `shakeOffsetX`, `shakeOffsetY` e rotação angular `shakeRoll`. Caso contrário, zera-os.

2. Em `src/render/renderer.js`:
   - No método `render(...)`:
     * Envolver os Passes 1 a 6 dentro de um bloco de translação de screen shake:
       ctx.save();
       if (camera && camera.shakeEnabled && (camera.shakeOffsetX || camera.shakeOffsetY || camera.shakeRoll)) {
         ctx.translate(camera.shakeOffsetX, camera.shakeOffsetY);
         if (camera.shakeRoll) {
           ctx.translate(this.viewportWidth / 2, this.viewportHeight / 2);
           ctx.rotate(camera.shakeRoll);
           ctx.translate(-this.viewportWidth / 2, -this.viewportHeight / 2);
         }
       }
       // Passes 1 a 6 executados com o tremor
       ctx.restore();
       // Pass 7 (Screen HUD e vinheta) executado fixo, sem tremor, garantindo legibilidade perfeita.

3. Em `src/render/particles.js`:
   - Adicionar novos tipos de partículas:
     * `'confetti'`: celebração multicolorida que cai suavemente com rotação angular (`angle += angularVelocity * dt`) e oscilação senoidal horizontal (`Math.sin(life * 10)`).
     * `'trail'`: rastro de projétil de curta duração (life: 0.15s), desaceleração suave, decaimento de raio e sem gravidade.
     * `'cc_ring'`: anel expansivo de atordoamento/controle de grupo com partículas orbes em órbita suspensa.
   - Adicionar método `emitHeroAttackHit(heroId, x, y, isCrit = false)`:
     * Knight: faíscas branco/dourado (`#fef08a`), anel de impacto metálico azul (`#60a5fa`).
     * Sorceress: fagulhas de fogo (`#f97316` / `#ef4444`) e anel de calor radiante.
     * Ranger: fragmentos esmeralda perfurantes (`#34d399` / `#10b981`).
     * Assassin: faíscas venenosas violeta (`#a855f7`) e fumaça sombria (`#1e1b4b`).
     * Cleric: partículas solares cintilantes (`#fde047`) e anel de irradiação sagrada (`#fef08a`).
     * Se `isCrit`: dobra contagem de faíscas, adiciona anel extra e flash branco.

4. Em `src/combat/projectile.js`:
   - Em `HeroProjectile.update(dt, simulation)`:
     * Emitir partículas do tipo `'trail'` na posição atual `(this.x, this.y, this.z)` durante a trajetória de voo em direção ao alvo.

5. Em `src/game.js`:
   - Disparar `this.camera.addTrauma(...)`:
     * Em acertos críticos (`isCrit`): `0.18`.
     * Na morte do herói jogador: `0.35`.
     * Na destruição de torres: `0.50`.
     * Na derrota de Mini-Boss ou Boss Supremo: `0.65`.
   - Em `triggerLevelUpVFX`:
     * Disparar 40 confetes coloridos (`'confetti'`), 25 faíscas ascendentes, 2 anéis dourados concêntricos e texto flutuante épico.
   - Em impactos de combate de heróis:
     * Utilizar `this.particles.emitHeroAttackHit(...)`.
   - Na aplicação de Stun / CC:
     * Emitir `'cc_ring'`.

6. Em `tests/unit/vfx_shake.test.js`:
   - Criar testes unitários cobrindo:
     * `addTrauma`, decaimento de trauma e cálculo quadrático de tremor.
     * Respeito a `setShakeEnabled(false)`.
     * Emissão e ciclo de vida de partículas `'confetti'`, `'trail'`, `'cc_ring'`.
     * Presets temáticos de impacto dos 5 heróis.
     * Segurança headless total.

7. Executar 'npm test':
   - Todos os 225 testes anteriores + novos testes unitários DEVEM passar com 100% de sucesso.
8. Escrever relatório em:
   c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\worker_m3_r3\handoff.md
   E enviar mensagem ao orquestrador.
