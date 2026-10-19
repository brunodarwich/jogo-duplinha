## 2026-10-18T02:04:32Z
Você é o Challenger do Marco 4 (M4: Motor de Som Procedural SFX com Web Audio API e Controles de Áudio).
Seu diretório de trabalho exclusivo é:
c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\challenger_m4_r3

LEIA OS ARQUIVOS AUTORITATIVOS:
1. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\orchestrator_r3\PROJECT.md
3. c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\worker_m4_r3\handoff.md

SUA MISSÃO:
1. Realizar verificação empírica e testes de estresse adversariais nas funcionalidades do Marco 4:
   - SoundEngine sob spam em rajada extrema (1.000+ chamadas consecutivas de playUiClick, playAttack, playHit, playSkill em 1 único frame) para verificar estabilidade e vazamentos.
   - Alternância rápida e concorrente de mute (toggleMute) durante a execução de sons sustentados (recall, vitória).
   - Teste com valores extremos de volume (volume negativo, volume > 10.0, volume NaN, volume null) garantindo clamping estrito em [0, 1].
   - Simulação de sandbox com erro de segurança ao acessar localStorage (SecurityError).
   - Prototipagem de nós Web Audio órfãos para assegurar que stop() e desconexão ocorrem sem reter referências de memória.
   - Segurança total para execução headless em Node.js (sem Canvas, sem DOM, sem AudioContext nativo).
2. Criar testes adversariais adicionais se necessário ou executar suíte empírica.
3. Executar 'npm test' e confirmar 100% de aprovação (mínimo 250 testes verdes).
4. Escrever seu relatório em:
   c:\Users\Bruno\Downloads\jogo-duplinha\.agents\teamwork\challenger_m4_r3\handoff.md
   com veredicto explícito: APPROVE ou REQUEST_CHANGES.
5. Enviar mensagem com o veredicto ao orquestrador.
