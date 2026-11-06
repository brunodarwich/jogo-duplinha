# Changelog

## [2.1.0] - 2026-11-05

### Added
- Nova ilustração promocional com os cinco heróis atuais, torres de cristal azul/rubi e a cidadela do Nexus.
- Tela inicial com a arte inteira, título destacado e carregamento/entrada em áreas próprias; layout adaptado para celular e paisagem curta.

### Changed
- Arte servida em WebP de aproximadamente 456 KB; PNG original e prompt preservados no repositório.
- Entrada aguarda o carregamento da arte e dos sprites, com fallback para a imagem anterior e timeout para não bloquear o jogo.

### Validation
- 349/349 testes em 51 arquivos, incluindo oito regressões da tela inicial.
- Navegador: seis resoluções de 320×568 a 1440×900, teclado, retorno à tela inicial, carregamento lento, falha da arte e convite.

## [2.0.0] - 2026-11-05

### Added
- Objetivo contextual e próxima onda no HUD, guia de primeira partida e preferências de movimento reduzido.
- Controles de interface operáveis por teclado, retrato dispensável e indicadores de perigo com texto/contorno.
- Mundo cooperativo decidido pelo anfitrião, entrada tardia com estado completo e interpolação visual.

### Changed
- Protocolo cooperativo v2: todos os participantes precisam atualizar/recarregar o jogo antes de jogar juntos.
- Evoluir habilidades agora modifica os efeitos reais dos cinco heróis; descrições correspondem às mecânicas executadas.
- Compras, vendas, evolução e comandos de combate de convidados são validados pelo anfitrião.
- Comandos de treino que alteram o mundo ficam restritos ao anfitrião.

### Fixed
- Habilidades não aprendidas, sem recursos ou bloqueadas por controle deixam de executar.
- Lentidão/atordoamento afetam movimento e IA; dano respeita defesa, barreiras e invulnerabilidade de forma consistente.
- Ouro de último golpe é atribuído ao autor; aliados elegíveis recebem assistência, sem prêmio duplicado.
- ATACAR no toque não usa Q; controles não disparam duas vezes no mesmo toque.
- Falhas de RTC, cancelamento de sala e troca de modo limpam canais e mostram erros explícitos.
- HUD do chefe, objetivos e controles têm espaço próprio; listeners são removidos ao encerrar a partida.

### Validation
- 341 testes passaram em 50 arquivos, incluindo regressões e três simulações independentes.
- Chrome: solo com os cinco heróis, teclado, cinco resoluções e toque emulado.
- WebRTC real com duas/três abas: estado comum, compras, evolução, habilidade, entrada tardia e queda do anfitrião.
- Celular físico e conexão entre duas máquinas distintas não foram testados nesta sessão.

## [1.2.0] - 2026-11-04

### Added
- Ataques básicos e quatro habilidades com poses próprias para cada um dos cinco heróis: 25 sequências de combate transparentes.
- Ações visuais sincronizadas entre jogadores, com reprodução única e retorno ao movimento ou repouso.

## [1.1.0] - 2026-11-04

### Added
- Ciclos de movimento com quatro poses desenhadas para os cinco heróis, seis soldados e três chefes.

### Changed
- Personagens com proporção chibi de 1,5 cabeças, preservando cores e equipamentos.
- Pés alinhados entre quadros e pose de repouso ao parar; soldados com canhão também animam as rodas.

### Fixed
- Minichefes deixam de simular caminhada quando já alcançaram seu alvo.
