# Plano: animações de combate dos cinco heróis

Criar 25 atlas com image_gen integrado: ataque básico e Q/W/E/R para cada herói. Preservar identidade, estilo chibi e PNG transparente. Integrar ações visuais sem alterar regras de combate; sincronizar sequência e tempo decorrido entre jogadores.

## Etapas
1. Gerar e conferir as cinco ações do Cavaleiro no renderizador real.
2. Integrar ciclo único, prioridade das habilidades, encerramento na morte, fallback e rede.
3. Gerar e empacotar as outras vinte ações; revisar 100 poses no navegador.
4. Validar arquivos e suíte completa, revisar diff e registrar prompts.
5. Commit, publicação no GitHub, deploy Vercel e verificação dos arquivos publicados.

## Aceitação
- Todos os 25 atlas têm quatro poses em grade 2x2, RGBA 768x768 e quadros de 384px.
- Ataques duram até 400ms, limitados pelo intervalo de ataque; Q/W/E duram 500ms; R dura 700ms.
- Habilidades substituem ações; ataques não interrompem habilidades; morte encerra ações.
- Atualizações repetidas de rede não reiniciam as poses. Clientes antigos continuam aceitos.
- npm test passa; imagens e código publicados correspondem ao workspace.

## Recuperação
Antes da alteração: dpl_5rkjYQFpvCTZKeQbFxYLpwC85Fk1, https://jogo-duplinha-lmrxgmmg5-raixu01s-projects.vercel.app. Em regressão de produção, promover esse deploy novamente e reverter os commits da mudança.
