# Passo 10: o servidor da família (opcional)

No fim deste passo o tablet envia os registos de jogo para um servidor seu, e a família vê num painel, de qualquer lado, quanto a pessoa jogou, a que horas, e como está a bateria. É opcional: sem servidor, tudo o resto funciona na mesma, e os registos ficam no tablet (passo 12 diz como os copiar por cabo).

## O que precisa

- Uma máquina Linux sempre ligada, com Docker (e o Docker Compose, que vem com ele) ou com Podman. Pode ser um servidor alugado barato, um computador pequeno em casa, ou um NAS que corra Docker.
- Um nome de domínio apontado para essa máquina (por exemplo `jogos.exemplo.pt`). É obrigatório: a app só fala com um servidor em `https://` com certificado verdadeiro, e recusa `http://` simples. O Caddy trata do certificado sozinho quando o domínio aponta para a máquina.
- As portas 80 e 443 chegáveis da internet (ou da rede onde o tablet está).

## O que o servidor guarda

Cada ronda jogada: o jogo, o nível, as horas, contagens (acertos, toques, tempo), um número aleatório que identifica o tablet, e eventos como "app aberta", "ecrã apagado", "bateria a 30 %". **Nunca nomes, nem fotografias, nem texto livre.** Os nomes das fotografias nunca saem do tablet. O painel mostra atividade: minutos por dia, jogos, horas do dia, bateria. Não é um instrumento clínico e não deve ser lido como tal.

## Pôr a correr com Docker Compose

Tudo está em `servidor/`. Copie essa pasta para a máquina Linux (por exemplo para `/srv/jogos`) e lá:

1. O token do tablet. No **seu computador**, na pasta do kit, corra uma vez `python servidor/ferramentas/segredos.py`. Cria o token, guarda-o em `.SECRETS/SECRETS.txt` (nunca o mostra) e imprime a linha `MAE_TOKEN_SHA256=...`. Na máquina Linux, copie `.env.exemplo` para `.env` e cole lá essa linha.
2. O `Caddyfile`: troque `jogos.exemplo.pt` pelo seu domínio. Troque a palavra-passe da família: corra `docker run --rm -it caddy:2 caddy hash-password`, escreva a palavra-passe quando ele pedir (assim não fica no histórico da linha de comandos) e cole o resultado no lugar de `$2a$14$TROQUE...`. O utilizador é `familia`; pode mudar o nome na mesma linha.
3. O `compose.yaml`: a linha `user: "1000:1000"` é o número do seu utilizador Linux. Veja com `id -u` e `id -g` e corrija se for diferente. Mude `MAE_TITULO` para o título que quiser no painel.
4. Crie a pasta dos dados com o seu utilizador normal, e arranque:

```bash
mkdir -p dados

docker compose up -d --build
```

A primeira vez compila o programa (um minuto) e o Caddy pede o certificado HTTPS (segundos, se o domínio já aponta para a máquina). `docker compose logs -f` mostra o que se passa; `mae à escuta em :8080` é bom sinal.

## Pôr a correr com Podman e quadlets

Em vez do Compose, `servidor/quadlet/mae.container` é a mesma coisa como serviço do systemd, para um utilizador sem root. As instruções estão no cabeçalho do ficheiro. Não testámos este caminho num servidor real: o ficheiro segue a documentação do Podman, e o Compose acima é o caminho que usámos. O Caddy (ou outro proxy com HTTPS) corre à parte, na máquina, e envia para `127.0.0.1:8100`; o `Caddyfile` serve, trocando `mae:8080` por `127.0.0.1:8100`.

## Verificar o servidor

- `https://jogos.exemplo.pt/healthz` responde `ok`.
- `https://jogos.exemplo.pt/` pede utilizador e palavra-passe, e mostra o painel (ainda vazio: "Último envio do tablet: nunca").

Para quem tem o Go instalado (versão 1.21 ou mais recente; ele próprio descarrega a versão que o programa pede) e quer ir mais fundo, `python servidor/ferramentas/testar_local.py` compila o programa e corre uma bateria de verificações no próprio computador, sem Docker.

## Ligar o tablet

No **seu computador**, na pasta do kit, acrescente ao ficheiro `.SECRETS/SECRETS.txt` uma linha com o endereço:

```text
MAE_SERVIDOR=https://jogos.exemplo.pt
```

Tem de começar por `https://`. O token já lá está, do passo 1. Com o tablet ligado por USB, na pasta `app`:

```powershell
python tools/enviar_config.py
```

Isto escreve um pequeno ficheiro de configuração na pasta da app no tablet. Quem ligar o tablet a um computador consegue lê-lo: o token que lá está dá para enviar registos e para descarregar as atualizações (com as fotografias, se usar o passo 11). Se o tablet se perder, apague a linha `MAE_TABLET_TOKEN` de `.SECRETS/SECRETS.txt`, repita o ponto 1 e reinicie o servidor: o token antigo deixa de servir. Sem este ficheiro, a app não envia nada a ninguém; com ele, envia o que tem em fila ao arrancar, de 15 em 15 minutos, quando apanha rede, e quando o ecrã se apaga. Nada se perde sem rede: fica em fila no tablet.

## Como saber que ficou bem

No tablet, abra o ecrã da família (gato, quinze segundos) e toque em **Enviar agora**: diz quantos registos enviou. No painel do servidor, "Último envio do tablet" passa a ter uma hora, e as tabelas enchem-se com o que a pessoa jogou.

## Cópias de segurança

A base de dados é o ficheiro `dados/mae.db` na pasta do servidor. Copie-o de vez em quando, de uma destas duas maneiras:

- Com o servidor parado: `docker compose stop mae`, copiar `dados/mae.db`, `docker compose start mae`. Ao parar, o programa junta tudo nesse ficheiro.
- Com o servidor a correr: `sqlite3 dados/mae.db ".backup copia.db"`.

Nunca copie só o `mae.db` com o servidor ligado: os registos mais recentes estão num ficheiro ao lado (`mae.db-wal`) e a cópia ficaria incompleta.
