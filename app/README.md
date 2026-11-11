# Jogos da Mãe

Jogos de tablet simples e alegres, em português de Portugal, feitos para um familiar mais velho que nunca usou um tablet. Imagens grandes, um gato que diz todas as instruções em voz alta, sem maneira de perder, e níveis que sobem e descem em silêncio conforme a pessoa vai jogando. O tablet só corre esta app, por isso não há mais nada onde se perder.

É uma app web simples (HTML, CSS e módulos JavaScript, sem frameworks e sem passo de compilação), embrulhada como app Android com o [Capacitor 8](https://capacitorjs.com). Versão 0.7.0.

Para quem é o tablet (como o gato trata a pessoa, o género, o título, e uma segunda pessoa opcional para um tablet que muda de mãos) define-se no início de `tools/falas.py` (`PESSOA`, `PESSOA_2`). Esse script escreve `www/data/falas.json` e `www/data/pessoa.json`. No kit público, os passos (`PASSO_1` a `PASSO_12`) estão um nível acima desta pasta.

## O que tem

32 atividades no ecrã inicial: 4 de recordações (fotografias da família, música, um passeio em 360 graus pela casa da pessoa, vistas em 360 graus de sítios de que gosta) e 28 jogos (cartas, dominó, loto, jogos de palavras e de imagens, cozinha, compras na feira, um jardim, um aquário e mais). Há mais quatro jogos feitos mas escondidos até a família os experimentar, entre eles **Quem é quem** (uma fotografia da família e três ou quatro nomes; precisa de pelo menos quatro fotografias com nomes e fica fora do ecrã inicial até elas estarem no tablet). A lista completa e o estado de cada jogo estão em `www/js/jogos/registo.js`.

| Parte | Ficheiro |
| --- | --- |
| Arranque, ecrã inicial, introdução, painel de azulejos | `www/js/main.js` |
| Todas as atividades, pela ordem do ecrã inicial | `www/js/jogos/registo.js`, e um módulo por jogo em `www/js/jogos/` |
| Peças de ecrã partilhadas, botões, ecrã do prémio | `www/js/ui.js` |
| Som e voz | `www/js/som.js`, `www/js/fundo.js` (música de fundo) |
| Progresso guardado e a regra silenciosa dos níveis | `www/js/estado.js` |
| Registos de jogo, e a cópia no cartão de memória | `www/js/metricas.js` |
| Envio dos registos para um servidor da família (opcional) | `www/js/sincronizar.js` |
| Aviso de bateria fraca | `www/js/bateria.js` |
| Ecrã escondido da família (estatísticas, envio, quiosque, recomeçar) | `www/js/familia.js` |
| Todas as frases ditas (fonte única) | `tools/falas.py` e `tools/falas/<jogo>.json` |
| Ecrãs da introdução | `www/data/intro.json` |
| Modo quiosque, cópia no cartão de memória, atualizações e pacotes de media (Android) | `android/app/src/main/java/pt/mae/jogos/` (`Atualizar.java`, `Media.java`) |
| Ecrã sossegado ao fim de 10 minutos sem toque: apagado, ou só escurecido no carregador se `APAGAR_NO_CARREGADOR` for falso (Android) | `android/app/src/main/java/pt/mae/jogos/MainActivity.java`; o registo `ecra_apagado_bateria` em `www/js/main.js` |
| Conteúdos da família: preparar, nomes das pessoas nas fotografias | `tools/enviar_media.py`, `tools/nomes_fotos.py`, `exemplos/nomes-exemplo.txt` |

Como se escreve um jogo: `GUIA-JOGOS.md`. Imagens, sons, tipo de letra e biblioteca de terceiros: `CREDITOS.md`.

## Construir

Precisa do Node.js 22 ou mais recente, do Java 21, e do Android SDK com a API 36, um pacote de build-tools e as platform-tools (passo 2 do kit; `tools/verificar_pc.ps1` confere tudo). O tablet precisa do Android 7.0 ou mais recente.

```powershell
npm install

npm run apk
```

O APK fica em `android/app/build/outputs/apk/debug/app-debug.apk`. Instale-o no tablet ligado por USB (o script lê a variável de utilizador `ANDROID_HOME`):

```powershell
pwsh -File tools/instalar.ps1
```

As atualizações mantêm o progresso guardado no tablet.

## Atualizações pela internet

A partir da versão 0.4.0 o tablet atualiza-se sozinho sempre que tem internet (o hotspot do telemóvel da família, numa visita, chega). Pergunta ao servidor da família cerca de 60 segundos depois de arrancar, de 6 em 6 horas, quando aparece uma rede, e a partir do ecrã da família (**Procurar atualizações**). Só descarrega quando é anunciado algo mais novo, e retoma uma descarga interrompida.

Há três tipos de atualização, descritos por um só ficheiro no servidor, `publico/versao.json`:

| Tipo | O que muda | Como entra em uso |
| --- | --- | --- |
| Pacote de media (`media/media-<n>.zip`, desde a 0.5.0) | Fotografias da família, os seus nomes e legendas, música, imagens em 360 | O pacote n leva só os ficheiros novos ou mudados desde o pacote n-1, mais `pack.json` (por coleção: itens a acrescentar ou substituir, chaves a remover, a ordem completa; e os ficheiros a apagar). O tablet confere primeiro o espaço livre no cartão de memória, descomprime ao lado da pasta de media, depois move os ficheiros e reescreve o manifesto de media (ficheiro temporário, depois troca de nome). Só apaga os ficheiros que o pacote nomeia. Um tablet que falhou pacotes apanha-os um a um, por ordem (`versao.json` lista os pacotes anteriores em `anteriores`; os ficheiros antigos ficam no servidor). Limites: 500 MB de descarga, 1 GB descomprimido. |
| Pacote web (`bundles/www-<n>.zip`) | Tudo o que está em `www`: jogos, frases ditas, imagens, o ecrã da família | Descomprimido na pasta privada da app e servido em vez dos ficheiros que vêm dentro dela. Fica à experiência até o ecrã inicial ser desenhado; se isso não acontecer em 60 segundos, ou se a app reiniciar antes, a versão anterior volta sozinha e essa versão nunca mais é tentada. |
| APK (`apk/jogos-da-mae-<código>.apk`) | A parte Java (quiosque, plugins, manifesto) | Instalado em silêncio pelo instalador de pacotes do Android, que o permite ao dono do aparelho. A app reinicia em modo quiosque. |

Cada ficheiro tem de bater certo com o seu SHA-256 e com uma assinatura ECDSA P-256 feita com a chave privada da família (`../.SECRETS/atualizacoes/privada.pem`, nunca no git); a chave pública vai dentro do APK (`Atualizar.java`). Tudo o resto é recusado e registado, e o tablet fica com o que tem. A troca só acontece no ecrã inicial sem ninguém lhe tocar há 5 minutos, com o ecrã escurecido ou apagado, ou no arranque seguinte; nunca dentro de um jogo. Um pacote web que precise de código Java mais novo do que o do tablet (`nativo_minimo`) espera pelo APK.

Publicar (primeiro em ensaio; mostra o que enviaria):

```powershell
python tools/publicar_atualizacao.py --bundle

python tools/publicar_atualizacao.py --bundle --enviar
```

Para uma mudança no Java, suba `versionCode` e `versionName` em `android/app/build.gradle`, em `package.json` e `VERSAO_APP` em `www/js/metricas.js`, corra `npm run apk`, e depois:

```powershell
python tools/publicar_atualizacao.py --apk android/app/build/outputs/apk/debug/app-debug.apk --enviar
```

A ferramenta só sobe o número do pacote web em `www/js/atualizar.js` depois de um envio bem sucedido, para o APK seguinte o levar como versão de origem. Todos os registos que a app faz levam `app_version` e `bundle`. Registos de atualização: `atualizacao_verificada`, `atualizacao_descarregada`, `atualizacao_aplicada`, `atualizacao_recusada` (motivo `sha256`, `assinatura`, `nativo`, `zip`, `apk` ou `instalacao`; nos pacotes de media também `espaco`, `tamanho` e `base`) e `atualizacao_revertida`. Os registos de pacotes de media levam `kind: "media"`.

Conteúdos da família (fotografias e os seus nomes, música, imagens em 360), desde a 0.5.0:

```powershell
python tools/enviar_media.py --so-preparar

python tools/publicar_atualizacao.py --media

python tools/publicar_atualizacao.py --media --enviar
```

A primeira ordem prepara tudo o que está em `../media` para a pasta `../media/_preparado` (fotografias reduzidas e sem metadados, nomes e legendas ditos pela voz do Piper). A segunda é o ensaio: compara essa pasta com o que foi publicado da última vez (`../builds/atualizacoes/media-estado.json`), constrói e assina o pacote e mostra o que enviaria. A terceira envia o pacote, depois o `versao.json`, e regista o novo estado. Uma vez, antes do primeiro pacote de media, registe como versão 0 o que um envio por USB anterior deixou no tablet, para o primeiro pacote não o repetir. Faça-o logo a seguir ao envio por USB, antes de preparar mais alguma coisa:

```powershell
python tools/publicar_atualizacao.py --media-base
```

Lê `../media/_preparado/manifest.json` (ou, se essa pasta não existir, `../media/_tablet/manifest.json`, a pasta que o envio por USB usava antes da 0.5.0; também aceita o caminho de outro manifesto) e é recusado depois de haver um pacote publicado.

O caminho por USB continua a funcionar como alternativa: `tools/enviar_media.py` (prepara e envia) ou `--so-enviar` (envia o que está preparado). Havendo pacotes publicados, o envio por USB só escreve no tablet a versão publicada se a media preparada for igual à publicada (os mesmos ficheiros, byte a byte, e o mesmo manifesto); se for diferente, para e pede para publicar primeiro. É isto que garante que os pacotes seguintes, que são diferenças, assentam bem.

O `versao.json` anuncia o pacote de media mais novo e os 30 anteriores (`MAX_ANTERIORES`). Um tablet mais atrasado do que isso deixa de encontrar a sua continuação (`media_sem_base`) e recebe a media por USB.

Quem está em cada fotografia: `../media/fotos/nomes.txt`, uma linha por fotografia, `número; nome verdadeiro; nomes falsos separados por vírgulas; legenda opcional` (2 a 4 campos separados por `;`; as linhas que começam por `#` são comentários). A regra completa e os exemplos estão em `exemplos/nomes-exemplo.txt`. Confira um ficheiro com `python tools/nomes_fotos.py`. Os nomes e as legendas só vão para o manifesto de media no tablet, nunca para os ficheiros da app nem para os registos de jogo (o Quem é quem só regista números de fotografias).

Desde a 0.4.0 o APK não é `testOnly`: o instalador de pacotes do Android recusa APK de teste, e a app não se conseguiria atualizar. O modo quiosque desfaz-se a partir do ecrã da família (ver "Preparar o tablet").

## Preparar o tablet

1. Reponha o tablet de fábrica ou comece com um novo, salte a conta Google, escolha Português (Portugal), ligue a depuração USB (passo 1 do kit).
2. Instale a app como acima.
3. Modo quiosque, para o tablet abrir direto nos jogos e os botões do Android não fazerem nada: `adb shell dpm set-device-owner pt.mae.jogos/.Admin`. Só funciona enquanto não houver nenhuma conta no tablet. Para desfazer, no ecrã da família: **Deixar o modo quiosque**, duas confirmações. Num tablet cujo modo quiosque foi ligado com uma versão de teste instalada (0.3.0 ou mais antiga), `adb shell dpm remove-active-admin pt.mae.jogos/.Admin` também continua a funcionar: o Android guarda a marca de teste quando o dono do aparelho é definido.
4. Desligue as apps do sistema que aparecem por cima dos jogos: `pwsh -File tools/limpar_tablet.ps1` (volta atrás com `-Repor`; a lista foi escrita para um Alcatel 1T 7 de 2023 e pode precisar de mudanças noutro tablet).
5. Conteúdos da família: ponha fotografias, música e imagens em 360 graus numa pasta `media` ao lado desta (a arrumação está no cabeçalho de `tools/enviar_media.py`, os nomes das pessoas nas fotografias em `media/fotos/nomes.txt`) e corra `tools/enviar_media.py` (USB), ou publique um pacote de media (ver "Atualizações pela internet"). As fotografias são reduzidas e ficam sem metadados antes de saírem do computador.

O ecrã da família abre-se no tablet segurando um dedo no gato durante quinze segundos. Mostra as estatísticas de jogo, pausa o quiosque por 15 minutos, liga e desliga a música de fundo, e pode recomeçar o progresso do zero.

## Registos de jogo e o servidor opcional

Cada ronda acabada é guardada no tablet: jogo, nível, tempos, contagens, e um número aleatório que identifica o aparelho. Sem nomes e sem texto livre: das fotografias só fica o número, e das listas de música, dos lugares e das divisões da casa só quantos foram abertos (os registos feitos por versões anteriores à 0.7.0 de 11 de novembro de 2026 ainda levavam os nomes das listas e dos lugares). Os resumos do ecrã da família contam a partir do último "Recomeçar do zero", como o painel do servidor. Vai uma cópia para o cartão de memória, um ficheiro por dia, que `tools/puxar_metricas.ps1` traz para o computador por USB.

O envio dos registos para um servidor está desligado, a não ser que se ponha na pasta da app no tablet um `config.json` com o endereço do servidor e um token (`tools/enviar_config.py`). O servidor é um pequeno programa à parte; não faz parte desta pasta.

## Mudar os conteúdos

| Para mudar | Fazer |
| --- | --- |
| A pessoa (tratamento, género, título, segunda pessoa) | Mudar `PESSOA` e `PESSOA_2` no início de `tools/falas.py`, correr `npm run falas`, depois `npm run voz` |
| Uma frase dita ou o seu texto | Mudar `tools/falas.py` ou `tools/falas/<jogo>.json` (modelos: `{T}` é o tratamento, e um par entre chavetas separado por uma barra vertical dá as formas feminina e masculina), correr `npm run falas`, depois `npm run voz` |
| Acrescentar gravações da família | Ver o passo 5 do kit e `../AUDIO-LINHAS.md`. Depois correr `python tools/importar_gravacoes.py`, e a seguir `npm run voz` |
| Acrescentar um ecrã à introdução | Acrescentá-lo a `www/data/intro.json` com uma `versao` mais alta. Passa uma vez sozinho depois da atualização. |
| Imagens e sons de terceiros | Mudar `tools/preparar_recursos.py`, correr `npm run recursos` |

Construa o APK outra vez depois de qualquer mudança.

## Experimentar sem tablet

Sirva a pasta `www` e abra-a num browser:

```powershell
python -m http.server 8765 --bind 127.0.0.1 --directory www
```

Abra `http://127.0.0.1:8765/#jogo=<id>` para saltar para um jogo. Jogadas automáticas: `tools/testar_tudo.ps1` corre todos os testes de `tools/testes/` e uma volta com capturas de ecrã por todas as atividades, com o Playwright. Os testes das Fotografias e do Quem é quem usam fotografias de substituição e nomes inventados, feitos uma vez com `python tools/criar_fotos_teste.py` e depois `python tools/enviar_media.py --so-preparar --origem ../media-exemplo-quem` (um Python com o Piper e o Pillow). O leitor de nomes tem a sua própria verificação: `python tools/testes/nomes_teste.py`.

## Privado e fora da cópia pública

- As gravações da família (`www/voz/familia/`) e a voz do computador (`www/voz/tts/`), cujo modelo de base tem uma licença pouco clara.
- Fotografias, música e imagens em 360 graus (`../media/`), e os registos trazidos do tablet (`../dados/`).
- O endereço e o token do servidor (`config.json`), o nome e a palavra-passe do hotspot, e tudo o que está em `.SECRETS`.
- Capturas de ecrã dos testes e as construções.

Os ficheiros `.gitignore` mantêm tudo isto fora do repositório.

## Licença

O nosso código, os desenhos e os textos: CC0 1.0, ver `LICENSE`. As partes de terceiros mantêm as suas licenças, ver `CREDITOS.md`. A voz do computador e as gravações da família não são para redistribuir.
