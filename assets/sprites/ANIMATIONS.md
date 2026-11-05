# Personagens chibi animados

## Combate dos heróis

Os cinco heróis têm atlas próprios para ataque básico e Q/W/E/R: `heroes/<heroi>_attack.png` e `heroes/<heroi>_skill_<q|w|e|r>.png`. Cada atlas RGBA de 768×768 contém quatro quadros de 384×384 em ordem superior esquerdo, superior direito, inferior esquerdo, inferior direito: preparação, execução, impacto e recuperação. Os prompts completos e referências estão em [combat-prompts.json](combat-prompts.json).

As ações reproduzem uma vez: ataque em até 400 ms, limitado pelo intervalo de ataque; Q/W/E em 500 ms; R em 700 ms. Habilidades substituem ações anteriores e não são interrompidas visualmente por ataques básicos. Ao terminar, o herói volta ao movimento ou repouso. Morte e renascimento limpam a ação. Dano, projéteis e movimentação continuam imediatos conforme as regras existentes.

`HERO_UPDATE` e `CAST_SKILL` incluem o campo opcional `visualAction: { sequence, action, durationMs, elapsedMs }`. A sequência crescente por herói impede que atualizações repetidas reiniciem a animação. O tempo decorrido é relativo, sem exigir relógios sincronizados. Pacotes antigos sem o campo continuam aceitos. Ações inválidas ou antigas são ignoradas.

`tools/build-combat-atlases.mjs assets/sprites/combat-prompts.json` empacota as poses geradas com imagegen integrado, sem sintetizar arte. Requer sharp, como o empacotador de caminhada. Os contornos opacos localizam o corpo para manter a altura compatível com a referência; os efeitos usam margem adicional. Atlas de combate são desenhados em 160% do tamanho do quadro normal, com apoio em 72%, compensando as margens transparentes. O fallback é caminhada, seguido do sprite estático.

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
