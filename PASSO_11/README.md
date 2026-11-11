# Passo 11: atualizações pela internet (opcional)

No fim deste passo o tablet atualiza-se sozinho, sem cabo: novas versões da app, novas frases ou vozes, novas fotografias. Precisa do servidor do passo 10. Sem isto, as atualizações fazem-se por USB (passo 9, "Instalar a app", e passo 6, "Enviar para o tablet"), o que também é perfeitamente aceitável para um tablet que vê todas as semanas.

## Como funciona

O tablet pergunta ao servidor, um minuto depois de arrancar e de seis em seis horas, se há algo novo. Há três tipos de coisa: um **pacote de media** (fotografias, música, casa), um **pacote web** (os jogos, as frases, as vozes: tudo o que está em `www`) e um **APK** (a parte Android). Descarrega só o que é mais novo, confere o resumo (SHA-256) e a **assinatura** de cada ficheiro com a sua chave pública, que vai dentro da app, e só aplica em momentos seguros: no ecrã inicial sem toques há 5 minutos, com o ecrã apagado, ou no arranque seguinte. Nunca a meio de um jogo. Um pacote web que não arranca bem é desfeito sozinho em 60 segundos.

Por isso o servidor, mesmo que alguém lhe entre, não consegue mandar código novo para o tablet: só é aceite o que foi assinado com a sua chave privada, que nunca sai do seu computador. O pior que um intruso consegue é voltar a oferecer um pacote web antigo, já assinado por si, ou travar as atualizações até à próxima versão da app.

## 1. A sua chave

Uma vez só, na pasta do kit, no Git Bash (vem com o Git; no menu Iniciar, **Git Bash**):

```bash
mkdir -p .SECRETS/atualizacoes

openssl ecparam -name prime256v1 -genkey -noout -out .SECRETS/atualizacoes/privada.pem

openssl ec -in .SECRETS/atualizacoes/privada.pem -pubout -out .SECRETS/atualizacoes/publica.pem

openssl ec -in .SECRETS/atualizacoes/privada.pem -pubout -outform DER -out .SECRETS/atualizacoes/publica.der

openssl base64 -A -in .SECRETS/atualizacoes/publica.der
```

A última ordem imprime uma linha longa de letras e números: é a chave pública em base64. Copie-a para dentro das aspas de `CHAVE_PUBLICA` em `app/android/app/src/main/java/pt/mae/jogos/Atualizar.java` (está logo no início, vazia no kit). Guarde uma cópia da pasta `.SECRETS/atualizacoes` fora do computador, com a chave do passo 8.

Depois, construa a app (passo 8) e instale-a por USB (passo 9): a partir dessa versão o tablet conhece a sua chave.

## 2. Como os ficheiros chegam ao servidor

A ferramenta de publicar copia ficheiros para a pasta `publico/` dos dados do servidor (com o Compose do passo 10: `/srv/jogos/dados/publico`). Diga-lhe como, com uma linha em `.SECRETS/SECRETS.txt`, usando `{local}` e `{remoto}`:

```text
MAE_ENVIO=ssh jogos@servidor.exemplo.pt "mkdir -p /srv/jogos/dados/publico/$(dirname {remoto})" && scp {local} jogos@servidor.exemplo.pt:/srv/jogos/dados/publico/{remoto}
```

`jogos@servidor.exemplo.pt` é o utilizador Linux do passo 10 (o mesmo número que pôs em `user:` no `compose.yaml`), com entrada por chave SSH sem palavra-passe (procure "ssh-keygen ssh-copy-id windows" se nunca o fez). Se o servidor está no mesmo computador, em vez disto use a opção `--publico-local <pasta>` nas ordens abaixo, com a pasta `dados/publico` do servidor.

Com o quadlet do Podman, os dados estão num volume e não numa pasta sua: ou muda a linha `Volume=` do `mae.container` para uma pasta, ou copia os ficheiros de `builds/atualizacoes/` para dentro do volume com `podman cp`. Não testámos esse caminho.

## 3. Publicar

Na pasta `app`. Primeiro sem `--enviar`: a ferramenta constrói, assina e mostra o que faria; depois com `--enviar`.

Uma nova versão da app (depois de subir os números de versão e construir, passo 8):

```powershell
python tools/publicar_atualizacao.py --apk ..\builds\jogos-0.8.0.apk --bundle

python tools/publicar_atualizacao.py --apk ..\builds\jogos-0.8.0.apk --bundle --enviar
```

Só frases, vozes ou jogos, sem mexer na parte Android (chega o pacote web, mais pequeno):

```powershell
python tools/publicar_atualizacao.py --bundle --enviar
```

Fotografias, música ou casa novas (depois de `enviar_media.py --so-preparar`, passo 6):

```powershell
python tools/publicar_atualizacao.py --media --enviar
```

Os pacotes de media são incrementais: cada um leva só o que mudou desde o anterior, e um tablet que faltou a um apanha-os por ordem.

Se já tinha enviado media por USB antes do primeiro pacote, registe-a como ponto de partida, para o primeiro pacote não repetir nada. Faça-o logo a seguir ao envio por USB, antes de preparar mais alguma coisa, porque o registo tem de descrever exatamente o que está no tablet:

```powershell
python tools/publicar_atualizacao.py --media-base
```

Lê a pasta preparada, `media/_preparado`. Depois do primeiro pacote publicado já não se pode repetir.

Daí em diante, a ordem é publicar primeiro e, se quiser, enviar por USB depois. O `enviar_media.py` confere se o que vai enviar é igual ao que foi publicado, e para se não for.

O servidor anuncia os últimos 31 pacotes de media. Um tablet que tenha ficado mais do que isso para trás (muitos meses desligado) já não encontra a sua continuação: o ecrã da família diz "fotografias: ficaram muito para trás, levar por USB". Resolve-se com o cabo: `python tools/enviar_media.py --so-enviar` põe o tablet igual à última versão publicada.

Tudo o que é publicado fica também em `builds/atualizacoes/` no seu computador, com o `versao.json` que o servidor anuncia.

## Como saber que ficou bem

No tablet, ecrã da família, **Procurar atualizações**: diz o que encontrou e o que vai fazer. Deixe o tablet no ecrã inicial, sem tocar, uns minutos: aplica-se, e o ecrã da família passa a mostrar a versão nova.

Se diz "esta aplicação não tem chave de atualizações", a app instalada foi construída antes de colar a chave: construa e instale por USB uma vez. Se diz "recusada (ficheiro não confere)", a chave dentro da app não é o par da que assinou. A ferramenta de publicar confere isso antes de assinar e para com um aviso, por isso só acontece se o tablet tiver uma app mais antiga do que a chave.
