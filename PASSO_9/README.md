# Passo 9: instalar no tablet e fechar em modo quiosque

No fim deste passo o tablet liga direto para os jogos, os botões do Android não fazem nada, os conteúdos estão lá, e sabe como abrir o ecrã da família quando precisar.

Faça tudo isto com o tablet ligado ao computador por USB e a janela do PowerShell na pasta do kit.

## 1. Ver o tablet

```powershell
adb devices
```

Tem de aparecer uma linha com um número de série e a palavra `device`. Se diz `unauthorized`, olhe para o tablet: está a perguntar se permite a depuração USB. Marque "Permitir sempre" e **OK**. Se não aparece nada, veja o fim do passo 1 (modo USB) e o cabo. Se continua sem aparecer, `adb kill-server` e volte a ligar o cabo.

## 2. Instalar a app

```powershell
pwsh -File app\tools\instalar.ps1 builds\jogos-0.7.0.apk
```

(o nome do ficheiro é o que o passo 8 mostrou). Diz "Instalada e aberta." e a app abre no tablet. Esta mesma ordem serve para atualizar mais tarde: o progresso guardado no tablet fica.

## 3. Fechar em modo quiosque

```powershell
adb shell dpm set-device-owner pt.mae.jogos/.Admin
```

Tem de responder `Success`. A partir daqui a app é a "dona" do tablet: é o ecrã inicial, arranca sozinha depois de reiniciar, e tranca-se (o botão de início, a lista de apps e as notificações deixam de funcionar). Se responder que já há contas no aparelho, volte ao passo 1: o tablet tem de estar sem contas.

Reinicie o tablet uma vez (`adb reboot`): assim o Android dá à app o poder de apagar o ecrã ao fim dos minutos sem toque.

Para desfazer um dia: no ecrã da família (abaixo), **Deixar o modo quiosque**, com duas confirmações. O tablet volta a ser um tablet normal.

## 4. Calar o resto do Android

Tablets baratos vêm cheios de apps que mostram avisos por cima de tudo: atualizações do fabricante, calendário, publicidade. Este script desliga as mais comuns (não desinstala nada; `-Repor` volta tudo atrás):

```powershell
pwsh -File app\tools\limpar_tablet.ps1
```

A lista foi feita para um Alcatel 1T 7 de 2023. Noutro tablet, as linhas que não existem dão um erro inofensivo, e pode faltar alguma app chata: veja o que aparece por cima dos jogos nos primeiros dias e acrescente o nome do pacote à lista no início do script (`adb shell pm list packages` lista todos).

Faça `-Repor` antes de deixar o modo quiosque, se um dia o fizer: o script também desliga o ecrã inicial normal do Android, que o modo quiosque substitui.

## 5. Os conteúdos

Se preparou fotografias, música ou a casa (passo 6), na pasta `app`:

```powershell
python tools/enviar_media.py --so-enviar
```

## 6. A rede

O tablet não precisa de internet para nada, a não ser para enviar registos ao servidor (passo 10) e receber atualizações (passo 11). Deixe a rede de casa guardada. Se a pessoa vai estar num hospital ou num lar, a rede de lá pode ter uma página de entrada: ver o passo 12.

## O ecrã da família

É o ecrã de controlo, escondido da pessoa: segure um dedo **no gato** do ecrã inicial durante **quinze segundos** sem o mexer. Tem:

- O que a pessoa jogou nos últimos 14 dias, por dia, por jogo, por hora.
- **Enviar agora** (registos para o servidor, se houver) e o estado do envio.
- **Música de fundo** ligada ou desligada; a quem pertence o tablet (passo 4, se há duas pessoas).
- **Dia difícil: tudo um nível mais fácil**, para os dias em que nada sai.
- **Desbloquear por 15 minutos** e **Bloquear já**: pausa o modo quiosque para chegar às Definições do Android ou a uma página de entrada de Wi-Fi. Trava-se sozinho ao fim do tempo.
- **Procurar atualizações** (passo 11).
- **Recomeçar do zero**: apaga os níveis e os azulejos ganhos, para entregar o tablet como novo. Os registos ficam.
- **Deixar o modo quiosque**.

A casinha em cima volta aos jogos.

## Como saber que ficou bem

Desligue o cabo. Carregue no botão de início e no de voltar do tablet: nada acontece. Reinicie o tablet: liga direto para o ecrã dos jogos. Segure no gato quinze segundos: abre o ecrã da família; toque na casinha para voltar. Entregue o tablet carregado e com a capa.

## Quem tem o tablet na mão

O modo quiosque serve para a pessoa não se perder. Não é um cofre: o gesto do gato está escrito neste kit, não pede código, e do ecrã da família chega-se às Definições do Android. As fotografias e os registos estão no tablet sem palavra-passe. Para uma casa, um hospital ou um lar costuma chegar. Dois cuidados:

- Com tudo instalado, desligue a **Depuração USB**: ecrã da família, **Desbloquear por 15 minutos**, Definições, Sistema, Opções de programador. Volte a ligá-la quando precisar do cabo (para atualizar ou copiar registos).
- Se o tablet se perder e tinha servidor (passo 10), crie um token novo, como lá se explica.
