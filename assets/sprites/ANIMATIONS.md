# Personagens chibi animados

14 personagens refeitos com image_gen integrado, com fundo realmente transparente, cabeça com cerca de dois terços da altura anatômica e corpo/pernas com um terço (1,5 cabeças). Cores e equipamentos identificam cada herói, equipe e chefe.

## Arquivos e reprodução

Cada sprite estático `nome.png` possui uma sequência `nome_walk.png` na mesma pasta. São 5 heróis em `heroes/`, 6 soldados em `minions/` e 3 chefes em `bosses/`. A lista completa dos 28 arquivos finais e os prompts exatos estão em [animation-prompts.json](animation-prompts.json).

- Grade 2x2, ordem: superior esquerdo, superior direito, inferior esquerdo, inferior direito.
- Quatro poses distintas de passos alternados, a 8 fps, ciclo de 500 ms.
- Quadros de 384 px para heróis, 256 px para soldados e 512 px para chefes. Margens transparentes, escala comum entre poses e apoio em 90% da altura.
- Repouso usa o quadro 0, com pés apoiados. Direção à esquerda espelha horizontalmente a imagem. Fallback estático é mantido se o atlas falhar ou estiver carregando.
- O Guardião do Nexus continua estacionário por regra do jogo; seu ciclo está disponível no atlas, mas em partida usa a pose de repouso. Os minichefes animam ao avançar e param ao alcançar o alvo.

## Preparação

`tools/build-sprite-atlases.mjs` faz somente recorte, ajuste proporcional, alinhamento e empacotamento da arte gerada; não sintetiza poses. Requer o pacote sharp local ou `SHARP_MODULE_PATH` apontando para uma instalação existente.

Entrada: JSON com lista de objetos `{key, source, output}`. `source` aponta à imagem gerada original (grade 2x2); `output` ao PNG estático final. O script grava também o atlas com sufixo `_walk.png`. Comando: `node tools/build-sprite-atlases.mjs sources.json`. As imagens originais da geração permanecem no diretório padrão do image_gen; todos os arquivos consumidos pelo jogo estão no repositório.

## Verificação e recuperação

`npm test` inclui integridade dos 14 atlas RGBA, ciclo/repouso, recorte, espelhamento, fallback e estado de movimento dos minichefes. Revisão no Chrome verificou as quatro poses distintas, repetição em 500 ms, repouso estável e espelhamento para os 14 personagens.

Para recuperar o visual anterior, reverter os commits desta mudança e publicar novamente. O deploy anterior da Vercel é `jogo-duplinha-p1ingo45e-raixu01s-projects.vercel.app` e pode ser promovido se necessário.
