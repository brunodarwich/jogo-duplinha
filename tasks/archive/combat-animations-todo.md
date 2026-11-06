# Tarefas: combate dos heróis

- [x] Gerar ataque e Q/W/E/R do Cavaleiro com imagegen integrado.
- [x] Conferir as cinco sequências no renderizador real, alinhadas com o repouso.
- [x] Integrar ações, prioridade, duração, morte e fallback.
- [x] Sincronizar ações por sequência e tempo decorrido; testar duplicatas e pacotes antigos.
- [x] Testar a ligação das 25 ações aos comandos de combate, incluindo comandos rejeitados.
- [x] Confirmar que os testes detectam mutação na prioridade das ações.
- [x] Gerar e empacotar as vinte sequências restantes.
- [x] Conferir transparência, quatro poses distintas e 25 sequências no navegador.
- [x] Executar npm test e revisar o diff final.
- [x] Publicar commits no GitHub e deploy em produção na Vercel.
- [x] Verificar carregamento do jogo e integridade dos arquivos publicados.

## Resultado
- 284/284 testes aprovados em 38 arquivos; 25 sequências e 100 poses verificadas no Chrome, incluindo zoom 160%, espelhamento, transparência e quatro quadros distintos.
- GitHub main: fc75caa (arte), 824c04c (integração); tag v1.2.0.
- Produção: https://jogo-duplinha-blush.vercel.app/ — dpl_EXxUb89etxevHKSxPdFKGUSjH6g6.
- HTTP 200 e SHA-256 idêntico ao workspace para os 25 atlas e seis arquivos principais. Tela inicial publicada abre no Chrome; partida solo verificada localmente.
