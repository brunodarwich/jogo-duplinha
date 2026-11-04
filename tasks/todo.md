# Tarefas

## 1. Heróis (dependências: nenhuma)
- [x] Gerar os cinco ciclos com quatro poses, revisar proporções e transparência.
- [x] Verificar imagens e caminhos no workspace.

## 2. Soldados (dependências: 1 para referência de estilo)
- [x] Gerar seis ciclos distintos, preservando equipes azul/vermelha e classes.
- [x] Verificar imagens e transparência.

## 3. Chefes (dependências: 1 para referência de estilo)
- [x] Gerar três ciclos distintos com proporções chibi.
- [x] Verificar imagens e transparência.

## Checkpoint: arte
- [x] Todos os personagens revisados com quadros alinhados.

## 4. Reprodução (dependências: 1–3)
- [x] Integrar ciclos e seleção de quadros sem modificar gameplay.
- [x] Testar repetição, repouso, espelhamento e fallback.
- [x] Executar npm test e verificar no navegador (275 testes, revisão visual dos 14 personagens).

## 5. Publicação (dependências: 4)
- [x] Revisar diff e registrar prompts e arquivos finais.
- [x] Commits locais de arte e integração; tag v1.1.0.
- [x] Push GitHub concluído com a conta brunodarwich: branch main e tag v1.1.0 publicadas em brunodarwich/jogo-duplinha.
- [x] Deploy Vercel em https://jogo-duplinha-blush.vercel.app (dpl_5rkjYQFpvCTZKeQbFxYLpwC85Fk1).
- [x] Verificar jogo e sprites em produção: HTTP 200 e SHA-256 idêntico ao workspace para index, renderizador e os 14 atlas; tela inicial abre no Chrome.
