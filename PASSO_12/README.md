# Passo 12: o dia a dia

O tablet está entregue. Este passo é o que aprendemos a viver com ele: bateria, rede, cópias, e o que fazer quando algo não bate certo.

## Bateria

É o ponto fraco. O nosso tablet ficou sem bateria ao segundo dia, com o ecrã meio aceso toda a noite, e a pessoa passou dois dias sem jogar. Desde então:

- O ecrã apaga-se ao fim de 10 minutos sem toque (passo 7 diz onde mudar). Acende com o botão de ligar, direto nos jogos.
- A app avisa em voz alta aos 20 % e aos 10 %: "A bateria está a acabar. Pede a alguém para pôr o tablet a carregar."
- Carregue todos os dias, com o carregador de parede e o cabo original. Um carregador fraco (porta USB do computador, carregador de telemóvel antigo) carrega mais devagar do que o tablet gasta a jogar.
- Num hospital ou lar, deixe um carregador e um cabo comprido junto à cama, e marque-os com o nome.
- O painel do servidor (passo 10) mostra o nível da bateria no último envio e avisa quando está fraca e sem carregador.

## A rede num hospital ou lar

As redes de visitantes costumam ter uma página de entrada (termos a aceitar). Com o tablet fechado em modo quiosque, essa página não aparece. Se o Android mostrar "Iniciar sessão na rede": ecrã da família, **Desbloquear por 15 minutos**, puxe a barra de notificações, toque na notícia, aceite, e **Bloquear já**. Se a rede do sítio não funciona (acontece), o tablet não precisa dela: os registos ficam em fila e seguem com a próxima rede que apanhar, por exemplo o hotspot do seu telemóvel durante a visita (`app/tools/adicionar_hotspot.ps1` guarda-o no tablet; nome e palavra-passe em `.SECRETS/SECRETS.txt` como `MAE_HOTSPOT_SSID` e `MAE_HOTSPOT_PASS`).

## Copiar os registos por cabo

Mesmo sem servidor, o tablet guarda uma cópia legível dos registos no cartão de memória (ou na memória interna), um ficheiro por dia. Com o tablet por USB, na pasta do kit:

```powershell
pwsh -File app\tools\puxar_metricas.ps1
```

Fica em `dados/tablet/<data>/`. Nada é apagado do tablet. Para um resumo em números (minutos por dia, por jogo, níveis ao longo do tempo, bateria), na pasta `app`:

```powershell
python tools/analisar_metricas.py ..\dados\tablet
```

Antes de dar o tablet a outra pessoa ou de o repor de fábrica, guarde também o estado da app (níveis, azulejos, fila de registos): `python tools/guardar_dados_app.py` (na pasta `app`, com o tablet por USB).

## Dias difíceis

Há dias em que nada sai. No ecrã da família, **Dia difícil: tudo um nível mais fácil** baixa todos os jogos um nível; os níveis voltam a subir sozinhos quando os dias melhoram. Deixar uma ronda a meio nunca baixa nada. As atividades que não pedem nada (fotografias, música, a casa, o jardim, o aquário) estão sempre no ecrã inicial.

## Mudar a pessoa

Se o tablet passar a outra pessoa da família: passo 4 (`PESSOA` ou o botão do ecrã da família, se definiu `PESSOA_2`), e no ecrã da família **Recomeçar do zero**, para apagar os níveis e os azulejos da pessoa anterior. Os registos antigos ficam, marcados com a pessoa a que pertencem (`player` nos registos).

## Problemas e soluções

| Sintoma | O que fazer |
| --- | --- |
| O tablet não aparece no `adb devices` | Cabo de dados (os cabos só de carga não servem); no tablet, modo USB "Apenas carregar" ou "Transferência de ficheiros", conforme o tablet; `adb kill-server` e ligar de novo; a pergunta de autorização pode estar escondida pelo modo quiosque: **Desbloquear por 15 minutos** e volte a ligar o cabo. |
| "INSTALL_FAILED_UPDATE_INCOMPATIBLE" ao instalar | O `.apk` foi assinado com outra chave. Use a chave guardada no passo 8 (`debug.keystore`) e construa outra vez. |
| "INSTALL_FAILED_VERSION_DOWNGRADE" | O `versionCode` do `.apk` é menor do que o instalado. Suba-o (passo 8). |
| O gato não fala, só mostra o balão | Não há ficheiros de voz para essas frases: passo 5 (`gerar_voz.py`), e construir e instalar outra vez. |
| O ecrã da família não abre | Segure no gato (não noutro sítio) quinze segundos sem mexer o dedo. |
| Um aviso do Android aparece por cima dos jogos | Veja o nome da app que avisa e acrescente o pacote a `app/tools/limpar_tablet.ps1` (passo 9). |
| A pessoa apagou o ecrã e não sabe acender | É o botão de ligar. Marque-o na capa com um autocolante ou um risco de marcador, como fizemos. |
| Quer tirar o modo quiosque | Ecrã da família, **Deixar o modo quiosque**, duas confirmações. Antes, `limpar_tablet.ps1 -Repor`, para o Android voltar a ter o seu ecrã inicial. |
| O ecrã da família diz "fotografias: ficaram muito para trás, levar por USB" | O tablet esteve desligado durante mais de 31 pacotes de media. Ligue o cabo e corra `python tools/enviar_media.py --so-enviar` na pasta `app` (passo 6). |
| Mudou o token ou o endereço do servidor | `python tools/enviar_config.py` (passo 10). A app lê o ficheiro novo no envio seguinte, sem reiniciar. |
| Perdeu a chave de assinatura | Só repondo o tablet de fábrica (os registos no cartão de memória e no servidor ficam). Guarde a nova chave melhor. |

## Mudar coisas depois

Para qualquer mudança (uma frase, um jogo escondido, fotografias novas): o passo respetivo, depois construir (passo 8) se tocou em `app/`, e instalar por USB (passo 9) ou publicar (passo 11). As fotografias e a música não precisam de nova app: só de `enviar_media.py` ou de um pacote de media.

Obrigado por fazer um tablet para alguém. Que seja boa companhia.
