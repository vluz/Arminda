# Passo 3: obter o código e experimentar no computador

No fim deste passo a app corre no browser do seu computador. Ainda sem voz e com a pessoa por definir, mas já se joga.

## Obter o kit

Se ainda não o tem no disco: descarregue o kit inteiro (o botão **Code**, **Download ZIP** na página do projeto, ou `git clone` com o endereço da página) e descomprima para uma pasta sem espaços nem acentos no nome, por exemplo `C:\Jogos`. Nos passos seguintes, "a pasta do kit" é essa: tem lá dentro `app/`, `servidor/`, os `PASSO_n` e este `README.md`.

Dentro de `app/` o que interessa:

| Pasta | O que tem |
| --- | --- |
| `www/` | A app em si: `index.html`, `js/` (os jogos em `js/jogos/`), `css/`, `img/`, `snd/`, e `data/` (as frases, a pessoa, a introdução). |
| `tools/` | As ferramentas: cada uma explica-se nas primeiras linhas. |
| `tools/falas/` | As frases de cada jogo, um ficheiro por jogo. |
| `android/` | A parte Android (Capacitor). Não precisa de lá tocar, a não ser pelo passo 7. |
| `exemplos/` | Ficheiros de exemplo (o `nomes-exemplo.txt` das fotografias). |

## Instalar as peças da app

Numa janela de PowerShell, na pasta `app`:

```powershell
cd C:\Jogos\app

npm install
```

Isto descarrega o Capacitor (a "casca" Android) para `app/node_modules`. Demora um ou dois minutos e só se faz uma vez. No fim o npm pode avisar de "vulnerabilities": são das ferramentas de construção, que só correm no seu computador, e não entram na app do tablet.

Depois, as bibliotecas Python que as ferramentas usam (imagens, e já a voz, para o passo 5):

```powershell
pip install pillow piper-tts
```

## Experimentar no browser

A app é uma página web. Sirva-a com o servidor que vem com o Python, na pasta `app`:

```powershell
python -m http.server 8765 --bind 127.0.0.1 --directory www
```

Deixe essa janela aberta e abra no browser `http://127.0.0.1:8765/`. Aparece o ecrã inicial com o gato e o botão **Começar**. Toque nele: a introdução corre, e depois o ecrã dos jogos. No computador toca-se com o rato.

Coisas a saber nesta fase:

- O gato ainda não fala: a voz faz-se no passo 5. As frases aparecem no balão na mesma.
- O gato diz "Olá, mãe!": a pessoa define-se no passo 4.
- As fotografias, a música e a casa dizem que ainda não há nada: vêm no passo 6.
- Para abrir um jogo diretamente, use `http://127.0.0.1:8765/#jogo=pares` (o nome de cada jogo está em `app/www/js/jogos/registo.js`).
- O browser do computador é maior do que o tablet. Para ver como fica num tablet de 7 polegadas, abra as ferramentas de programador do browser (tecla F12), ligue o modo de dispositivo (o ícone de telemóvel) e escreva 1024 por 600.

Para parar o servidor, carregue em Ctrl+C na janela dele.

## Os registos de jogo no computador

A app guarda cada ronda jogada e, se houver um servidor configurado, envia-os. No browser do computador ela usa `app/www/media-teste/config.json`, que aponta para um servidor de teste na porta 8780 que não existe. É inofensivo: a app tenta, não consegue, e tenta mais tarde. Se quiser ver os registos a chegar, corra noutra janela `python tools/servidor_teste.py` na pasta `app`: ele imprime o que recebe.

## Como saber que ficou bem

Jogou uma ronda de Pares no browser até ao ecrã do prémio (o azulejo). Está pronto para o passo 4.
