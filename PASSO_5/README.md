# Passo 5: a voz

No fim deste passo o gato diz todas as frases em voz alta. Primeiro com uma voz de computador, feita no seu PC e guardada dentro da app (o tablet não precisa de internet nem de "texto para voz" próprio). Depois, se quiser, com vozes da família por cima.

## Como funciona

A app tem cerca de 2100 frases (contagem em `app/www/data/falas.json`), em 42 secções: as frases gerais, a introdução, e as de cada jogo. Cada frase tem um ficheiro de som em `app/www/voz/tts/<secção>/<chave>.ogg`. A ferramenta `gerar_voz.py` faz esses ficheiros com o Piper, um programa de voz que corre no seu computador, sem internet.

Uma gravação da família substitui a voz do computador frase a frase: pode gravar só as 50 frases mais ouvidas e deixar o resto ao computador. Nada é obrigatório: sem gravações, os jogos funcionam na mesma.

## A voz do computador (Piper)

Não podemos distribuir a voz dentro do kit: o programa Piper tem a sua licença (GPL-3.0) e cada modelo de voz tem a sua. Obtém-nos assim:

1. O programa já ficou instalado no passo 3 (`pip install piper-tts`). Se não, faça-o agora. Página do projeto: [github.com/OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl) ("piper tts").
2. Um modelo de voz em português de Portugal. A lista de vozes do Piper está em [huggingface.co/rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices/tree/main/pt/pt_PT) ("piper voices pt_PT"). A 10 de novembro de 2026 só há uma voz pt_PT, chamada "tugão" (pasta `pt/pt_PT/tugão/medium`); há quatro em português do Brasil (`pt/pt_BR`). Descarregue os dois ficheiros da voz: o `.onnx` (o modelo, uns 60 MB) e o `.onnx.json` ao lado.
3. Leia o `MODEL_CARD` da voz antes de a usar. O da "tugão" diz que o conjunto de dados é CC0 e nada mais; a voz foi afinada a partir de uma voz inglesa cujos dados podem ter condições próprias. Para uso em família não vemos problema; para distribuir a app com a voz dentro, decida por si. É por isso que o kit vem sem voz.
4. Ponha o `.onnx` e o `.onnx.json` na pasta `app/tools/voz/`. Só pode lá estar um modelo.

Depois, na pasta `app`:

```powershell
python tools/gerar_voz.py
```

A primeira vez faz as 2100 frases: conte com uns minutos, mais ou menos conforme o computador. As vezes seguintes só refaz as frases cujo texto mudou (passo 4) e apaga as que já não existem. No fim diz quantos ficheiros fez.

Para a voz falar mais devagar ou mais depressa: `LENTO` no início de `app/tools/gerar_voz.py` (1.25 é um pouco mais lento do que o normal, o que ajuda a perceber). Mude e corra outra vez; nesse caso apague antes `app/www/voz/tts/textos.json`, para refazer tudo.

## Vozes da família (opcional, mas vale a pena)

Uma voz conhecida a dizer "Muito bem!" vale mais do que todos os jogos. Faz-se assim:

1. Abra `AUDIO-LINHAS.md` (na pasta do kit; refaz-se com `python tools/gerar_audio_md.py` depois do passo 4). Tem todas as frases, secção a secção, pela ordem certa. Se definiu uma segunda pessoa (passo 4), as frases dela vêm no fim de cada secção. A secção `nora` é para uma segunda voz da família: os mesmos elogios ditos por outra pessoa, que o gato usa de vez em quando.
2. Comece pela secção `geral` (as frases gerais, uns 40 segundos a dizer) e pela `intro`. Depois as dos jogos que a pessoa mais joga. Não precisa de gravar tudo.
3. Grave uma secção inteira numa só gravação, frase a frase pela ordem do ficheiro, com **dois segundos de silêncio entre frases**. Use o telemóvel ou o computador, num sítio sossegado, perto da boca. Diga as frases com calma e carinho; não leia depressa.
4. Guarde cada gravação como `audio/raw/<secção>.wav` na pasta do kit (por exemplo `audio/raw/geral.wav`). Se o telemóvel grava em `.m4a`, converta com `ffmpeg -i geral.m4a geral.wav`.
5. Na pasta `app`:

```powershell
python tools/importar_gravacoes.py

python tools/gerar_voz.py
```

A primeira ferramenta corta a gravação nos silêncios, confere que o número de pedaços é exatamente o número de frases da secção, limpa e nivela o som, e guarda `app/www/voz/familia/<secção>/<chave>.ogg`. Se o número não bate certo (uma frase a mais, uma a menos, uma pausa curta demais), a secção é ignorada e avisada: assim nunca fica uma frase com o nome errado. Grave essa secção outra vez. A segunda ferramenta atualiza a lista de que frases têm voz da família.

As legendas das fotografias também podem ter voz da família: ver o passo 6.

## Como saber que ficou bem

Sirva a app (passo 3) e abra-a no browser. Toque em **Começar**: o gato fala. Abra um jogo: as instruções são ditas. Se gravou a família, a secção `geral` é a que mais se ouve: "Muito bem!", "Quase!".

Se o browser não toca som: os browsers só tocam depois do primeiro toque na página; toque uma vez em qualquer sítio.
