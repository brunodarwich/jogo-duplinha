# Plano: personagens chibi e ciclos de movimento

Refazer os cinco heróis, seis soldados e três chefes em chibi de 1,5 cabeças, preservando cores, equipamentos e identificação. Gerar imagens com image_gen integrado e transparência real. Cada personagem terá quatro poses de caminhada em uma grade 2x2; reprodução em loop de quatro quadros, pose neutra ao parar e espelhamento horizontal conforme direção.

## Sequência
1. Gerar e revisar os ciclos dos heróis; integrar o primeiro ciclo ao renderizador.
2. Gerar e revisar os seis soldados e os três chefes no mesmo padrão.
3. Integrar todos os ciclos, preservar retratos estáticos e fallback para falha de carregamento; verificar transição parado/movendo e ancoragem dos pés.
4. Executar testes automatizados e inspeção visual no navegador; revisar diff e tamanho dos arquivos.
5. Commit e push no GitHub; deploy no projeto Vercel existente e verificação HTTP dos assets publicados.

## Critérios
- Cabeça com aproximadamente dois terços da altura anatômica, corpo e pernas com um terço; equipamentos não entram nessa medição.
- Quatro poses distintas com passos alternados, mesma escala e ponto de apoio, sem cenário ou texto.
- Estruturas, regras de combate e rede preservadas. Animações são puramente visuais.
- Testes completos aprovados, sprites acessíveis em produção e jogo iniciando.

## Riscos e recuperação
Variações entre quadros exigem revisão visual. Preservar sprites anteriores como fallback; deploy anterior pode ser promovido novamente e commit pode ser revertido. Não incluir arquivos locais alheios à tarefa.

Tarefas em tasks/todo.md. Publicação autorizada pelo pedido do usuário e continuação da execução.
