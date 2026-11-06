# HUD aprovado — contrato visual e validação

Referência: [interface aprovada](../output/ui-concepts/reference-approved.png).
Captura anterior: [1440 × 810](../output/ui-concepts/before/hud-1440x810.png).

## Objetivo
Reproduzir a composição aprovada com dados reais, toque simultâneo, joystick fixo e suporte horizontal/vertical. Preservar mundo, economia e multiplayer. Não publicar nesta etapa.

## Tokens
Superfície #101c2c / 94%; superfície de controle #16283b; borda dourada #d7b75d; texto #f8fafc; secundário #cbd5e1; vida #20c563; mana #3385ed; XP #48cdeb; perigo #db4047. Espaçamento 4/8/12/16/24px. Borda 1–2px; raio de painel 8–12px; controles circulares. Alvo mínimo 44px e intervalo mínimo 8px entre controles independentes. Safe-area em todas as bordas; nenhuma transformação global para reduzir a interface.

## Inventário (px CSS)
|Elemento|Tablet horizontal >=1100w e >=650h|Horizontal compacto|Retrato|
|---|---|---|---|
|Margens|16|8|8|
|Minimapa superior esquerdo|128²|80²|64²|
|Placar ao lado do mapa / abaixo em retrato|160×48|104×40|88×32|
|Relógio central|120×44|80×36|72×36, segunda linha|
|Objetivo abaixo do relógio|até320×24|até240×20|linha dedicada, reticências|
|Chefe abaixo do objetivo|até480×48|até280×36|largura disponível×36|
|Loja superior direita|208×48|140×44|140×44|
|Partida / configurações|104×48 / 48²|76×44 / 44²|segunda linha / junto da loja|
|Joystick inferior esquerdo|160²|112²|96²|
|Q/W/E/R|88², gap16|52², gap8|48², duas linhas|
|Ataque inferior direito|136²|80²|68²|
|B acima de ataque|72²|48²|44²|
|Retrato e barras|360×88 entre joystick e combate|224×48 acima do joystick|faixa de48 acima dos controles|
|Evolução|símbolo28 em alvo44|alvo44|alvo44|

Em telas horizontais largas mas curtas, o cabeçalho pode usar uma segunda linha para objetivo/chefe; não colidir com loja ou placar. Em 320px, combate usa duas colunas de habilidades à esquerda de ataque, B acima de ataque, largura180 e altura120 (112px de habilidades mais 8px de separação para B). Evolução fica numa faixa imediatamente acima do grupo, sem interceptar a habilidade nem seus vizinhos. O rodapé cresce para acomodar essa faixa quando há pontos.

## Composições
```text
TABLET HORIZONTAL
[mapa][placar]          [relógio]              [LOJA][Partida][engrenagem]
                       [objetivo]
                       [chefe]
                          CAMPO LIVRE
                                                                  [B]
[joystick] [retrato | vida/mana/XP]             [Q][W][E][R] [ATACAR]

CELULAR HORIZONTAL
[mapa][placar]          [relógio]              [LOJA][Partida][engrenagem]
                       [objetivo/chefe]
                          CAMPO LIVRE
[retrato | barras]                                                [B]
[joystick]                                      [Q][W][E][R][ATACAR]

RETRATO
[mapa]                         [LOJA][engrenagem]
[placar]                    [relógio][Partida]
[objetivo-----------------------------------]
[chefe--------------------------------------]
                   CAMPO
[retrato | vida/mana/XP----------------------]
                            [+][+]   [B]
[joystick]                  [Q][W]
                            [+][+] [ATACAR]
                            [E][R]
```

## Recursos e estados
Cinco atlas ilustrados 2×2: quadrantes Q/W/E/R, sem texto ou moldura; molduras, números e rótulos são DOM/CSS. Símbolos SVG para loja, configurações, ataque e retorno. Retratos existentes. Fallback de arte com símbolo e letra legíveis.
Estados: não aprendida, pronta, mira, recarga radial + número, mana insuficiente, morte, retorno, ponto de evolução, chefe com escudo. Não depender só de cor. Partida contém atributos, inventário, onda, rede e zoom; configurações contém áudio, redução de movimento e guia.

## Entrada e camadas
Joystick fixo e visível apenas em toque; início limitado à sua área. Capture de ponteiro para seguir o dedo ao sair. Soltar/cancelar/desfocar/rotacionar/abrir janela encerra movimento. Não enviar STOP após apenas tocar sem mover. Dois dedos independentes para movimento e combate. Canvas abaixo dos controles, popovers acima de todos os controles, diálogos acima de popovers. Desktop mantém mouse/teclado e botão de ataque.

## Verificação
`npm test`; navegador em 320×568,390×844,768×1024,1024×768,844×390,1280×800,1440×810; cinco heróis; habilidades e recursos; multitouch/cancelamento/rotação; loja e inventário; teclado/foco/fallback; sobreposição e limites; capturas reais. Resultados e medidas observadas constam abaixo.


## Entrega validada — 6 de novembro de 2026

- `npm test`: **358 testes aprovados, 53 arquivos, zero falhas**. Os testes antigos de CSS e barra do chefe foram atualizados para verificar a folha dedicada e o HUD DOM, preservando o comportamento verificado.
- Navegador Chrome com toque: sete resoluções do contrato; desktop: larguras320/768/1024/1440. Sem exceções JavaScript. Falha de imagem foi provocada intencionalmente para conferir o fallback.
- Multitouch nativo via CDP: mover e atacar uma vez com o segundo dedo; preparar Q e confirmar o alvo no campo sem soltar o joystick; captura fora da área; cancelamento, desfoque, rotação, abertura de menus, loja e guia.
- Cinco heróis: artes, aprender Q, entrar em mira, falta de mana, recarga, morte e retorno. Loja: compra, venda, ouro insuficiente, fora da base e inventário com seis itens sem permitir o sétimo.
- Todos os controles de combate verificados com alvo mínimo44px, limites da tela, centro alcançável e ausência de sobreposições. Os valores do placar e do chefe permanecem reais; os nomes conhecidos de chefes são traduzidos apenas na apresentação.
- Nova folha central: `src/ui/hud.css`. Foram retiradas as regras antigas de posicionamento correspondentes de `style.css`.
- Artes geradas com a ferramenta integrada image_gen, sem serviço em tempo de execução: [conjuntos e prompts](../assets/ui/abilities/prompts.json). Cinco atlas PNG com quatro quadrantes cada; arquivos `knight.png`, `sorceress.png`, `ranger.png`, `assassin.png`, `cleric.png` em `assets/ui/abilities/`.

### Ajustes necessários para cumprir as áreas de toque

Em retrato, a altura efetiva do grupo de combate passou de112 para120px: B(44) + intervalo(8) + Atacar(68). A faixa de evolução tem quatro alvos44px separados por8px e cresce para a esquerda, acima do combate. As barras sobem52px somente enquanto existe evolução disponível. Abaixo de381px, os seis itens usam três colunas e duas linhas, garantindo alvos de pelo menos44px. Todos os demais elementos mantêm as medidas do contrato.

```text
RETRATO FINAL — controles
[retrato | vida/mana/XP-------------------------]
                    [+ Q][+ W][+ E][+ R]   (quando disponíveis)
                                      [B]
[joystick]                 [Q][W]      (8px)
                           [E][R]    [ATACAR]
```

### Capturas reais e evidência

| Composição | Antes | Depois |
|---|---|---|
| Celular horizontal844×390 | [antes](../output/ui-concepts/before/hud-844x390.png) | [depois](../output/ui-concepts/after/hud-844x390.png) |
| Celular vertical390×844 | [antes](../output/ui-concepts/before/hud-390x844.png) | [depois](../output/ui-concepts/after/hud-390x844.png) |
| Celular mínimo320×568 | [antes](../output/ui-concepts/before/hud-320x568.png) | [depois](../output/ui-concepts/after/hud-320x568.png) |
| Tablet horizontal1280×800 | [antes](../output/ui-concepts/before/hud-1280x800.png) | [depois](../output/ui-concepts/after/hud-1280x800.png) |
| Tablet vertical768×1024 | [antes](../output/ui-concepts/before/hud-768x1024.png) | [depois](../output/ui-concepts/after/hud-768x1024.png) |

[Loja em320px](../output/ui-concepts/after/shop-320.png) · [Geometria completa em JSON](../output/ui-concepts/after/measurements.json) · [Resultado dos testes](../output/ui-concepts/test-final.log) · [Resultado no navegador](../output/ui-concepts/browser-final.log).

As coordenadas abaixo foram medidas no navegador. Origem(0,0) no canto superior esquerdo; px CSS; estado inicial com pontos de evolução disponíveis. As margens seguras de cada aparelho são acrescentadas às âncoras CSS automaticamente.

### Medidas observadas — 1280x800

|Elemento|X|Y|Largura|Altura|
|---|---:|---:|---:|---:|
|Minimapa|16|16|128|128|
|Placar|156|16|160|48|
|Cronômetro|580|16|120|44|
|Objetivo|480|68|320|24|
|Chefe|400|100|480|48|
|Retrato + barras|200|680|360|88|
|Loja|888|16|208|48|
|Partida|1104|16|104|48|
|Configurações|1216|16|48|48|
|Joystick|16|608|160|160|
|Q|712|672|88|88|
|W|816|664|88|88|
|E|920|660|88|88|
|R|1024|664|88|88|
|B|1176|544|72|72|
|Atacar|1128|632|136|136|
|Evoluir Q|734|620|44|44|
|Evoluir W|838|612|44|44|
|Evoluir E|942|608|44|44|

### Medidas observadas — 844x390

|Elemento|X|Y|Largura|Altura|
|---|---:|---:|---:|---:|
|Minimapa|8|8|80|80|
|Placar|100|8|104|40|
|Cronômetro|382|8|80|36|
|Objetivo|302|52|240|20|
|Chefe|282|80|280|36|
|Retrato + barras|8|206|224|48|
|Loja|560|8|140|44|
|Partida|708|8|76|44|
|Configurações|792|8|44|44|
|Joystick|8|254|112|112|
|Q|508|306|52|52|
|W|568|298|52|52|
|E|628|294|52|52|
|R|688|298|52|52|
|B|772|222|48|48|
|Atacar|756|286|80|80|
|Evoluir Q|512|254|44|44|
|Evoluir W|572|246|44|44|
|Evoluir E|632|242|44|44|

### Medidas observadas — 320x568

|Elemento|X|Y|Largura|Altura|
|---|---:|---:|---:|---:|
|Minimapa|8|8|64|64|
|Placar|8|84|88|32|
|Cronômetro|152|60|72|36|
|Objetivo|8|124|304|24|
|Chefe|8|156|304|36|
|Retrato + barras|8|312|304|48|
|Loja|120|8|140|44|
|Partida|236|60|76|44|
|Configurações|268|8|44|44|
|Joystick|8|448|96|96|
|Q|132|432|48|48|
|W|188|432|48|48|
|E|132|496|48|48|
|R|188|496|48|48|
|B|256|424|44|44|
|Atacar|244|476|68|68|
|Evoluir Q|112|372|44|44|
|Evoluir W|164|372|44|44|
|Evoluir E|216|372|44|44|
