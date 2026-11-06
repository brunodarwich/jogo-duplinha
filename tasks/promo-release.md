# Tela inicial promocional — versão 2.1.0

Solicitação: criar arte dos heróis/torres, colocá-la na tela de carregamento e fazer deploy. Publicação autorizada pelo usuário.

## Arte

- Gerada com image_gen integrado usando como referências os cinco sprites atuais. Torres/cidadela descritas a partir das estruturas existentes.
- PNG original: assets/ui/promo-arena-v2.png, 1672×941, 3.061.873 bytes.
- WebP de execução: assets/ui/promo-arena-v2.webp, 456.236 bytes; conversão de formato com FFmpeg, sem recorte ou alteração de composição/resolução.
- Prompt e referências: assets/ui/promo-arena-v2.prompt.json.
- PNG e prompt permanecem no GitHub/workspace; o deploy serve apenas a cópia WebP de execução.

## Validação

- npm test: 349/349 em 51 arquivos.
- Oito regressões novas: prontidão depende de arte/sprites, fallback/decode, falha dupla, timeout, cancelamento/cleanup, teclado e transição única.
- Mutação isolada retirando a espera da arte foi detectada pelo teste; código em disco permaneceu íntegro.
- Chrome isolado: 1440×900, 1280×720, 390×844, 844×390, 320×568 e 568×320. Arte inteira com contain, botão visível e nenhum overflow horizontal.
- Espaço abre um único lobby; retorno à tela inicial funciona.
- Atraso da imagem mantém o botão desabilitado até a arte estar pronta. Falha simulada carrega a ilustração anterior e permite jogar.
- Convite mantém a transição automática e o código PROMO1 preenchido.
- Capturas locais em .playwright-cli/promo-*.png; logs em .playwright-cli/promo-test-results.log. Pasta já ignorada pelo Git.
- Layout e código revisados; nenhuma regra de combate ou protocolo cooperativo alterados.

## Publicação

- GitHub main/tag v2.1.0: 647d0a0 (código e pacote).
- Vercel: dpl_CV9Kw1srLyuxmvp9sau6LqiqonBk — Ready.
- URL pública: https://jogo-duplinha-blush.vercel.app/.
- Verificados por HTTP200 e SHA-256: index, CSS, loader, manifesto de sprites e WebP. MIME image/webp correto. PNG original/prompt retornam404 na aplicação, conforme exclusões do pacote.
- Chrome em produção: arte1672×941 pronta, progresso100%, entrada no lobby e partida solo iniciada; nenhum pageerror. Captura .playwright-cli/production-promo.png.
- Recuperação: promover o deploy anterior dpl_3ETM7KghLTyrxYEmqQnPfvBHbSeU, jogo-duplinha-io4whi6dt-raixu01s-projects.vercel.app.
- Prévia PNG/zoom pré-existentes permaneceram sem versionamento e fora do deploy.
