# Passo 6: fotografias, música e a casa

No fim deste passo os conteúdos da pessoa estão preparados numa pasta, prontos a ir para o tablet (passo 9) ou pela internet (passo 11). Nada disto entra na app em si: fica numa pasta à parte no tablet, e só sai do seu computador para o tablet ou para o seu próprio servidor.

## A pasta `media`

Crie uma pasta `media` na pasta do kit, ao lado de `app`, com estas subpastas (só as que quiser):

| Pasta | O que pôr | Como aparece |
| --- | --- | --- |
| `media/fotos/` | Fotografias da família, JPEG ou PNG, com nome de número: `001.jpg`, `002.jpg` e assim por diante | A atividade **Fotografias**: uma de cada vez, com o nome dito pelo gato e, se quiser, uma legenda. Alimenta também o jogo **Quem é quem**. |
| `media/musica/` | Músicas em MP3, M4A, FLAC, OGG ou WAV. Cada subpasta é uma lista: `media/musica/Natal/`, `media/musica/Fados/`. | A atividade **Música**: listas, uma a tocar de cada vez, com o título e o artista das etiquetas do ficheiro (ou de "Artista - Título.mp3"). |
| `media/casa/` | Fotografias em 360 graus da casa da pessoa (JPEG equirretangular, como as de uma câmara Ricoh Theta ou da app de panorama do telemóvel). O nome é a divisão: `01 Sala.jpg`, `02 Cozinha.jpg`. | **A minha casa**: olha-se à volta com o dedo. |
| `media/passeios/<Lugar>/` | Fotografias em 360 de sítios de que a pessoa gosta, por lugar: `media/passeios/Praia/01 Areal.jpg`. | **Passeios**. |

### Os nomes das fotografias

Os números são para sempre: a família fala das fotografias pelo número ("a 014 é o primo João"), e os registos de jogo só guardam números. Nunca renumere.

Quem está em cada fotografia escreve-se em `media/fotos/nomes.txt`, uma linha por fotografia:

```text
número; nome verdadeiro; nomes falsos separados por vírgulas; legenda opcional
```

O exemplo completo, com as regras, está em `app/exemplos/nomes-exemplo.txt`: copie-o para `media/fotos/nomes.txt` e troque pelos nomes verdadeiros. Em resumo:

- O nome leva o artigo: "a Tia Rosa", "o Primo João", "os Primos". O gato diz "Olha, é a Tia Rosa!".
- Os nomes falsos (dois ou mais, parecidos com o verdadeiro) fazem a fotografia entrar no jogo Quem é quem. Sem nomes falsos, a fotografia aparece só nas Fotografias.
- A legenda é dita a seguir ao nome: "No casamento da Ana."
- Uma fotografia sem linha no ficheiro usa o nome do ficheiro como legenda ("01 Os netos no Natal.jpg").
- Uma gravação `media/fotos/vozes/<número>.wav` (ou .m4a, .mp3) substitui a voz do computador na legenda dessa fotografia.

Verifique o ficheiro com `python tools/nomes_fotos.py ..\media\fotos\nomes.txt` (na pasta `app`): diz o que leu e o que não percebeu.

Se recebeu uma remessa de fotografias com nomes de ficheiro quaisquer, `python tools/numerar_fotos.py <pasta recebida>` numera-as a seguir às que já há, guarda de onde veio cada uma, e faz folhas de contacto numeradas (precisa do ImageMagick) para mandar à família e pedir os nomes.

### A casa em 360

A pessoa vê uma lista com um botão grande por divisão, pela ordem dos números dos ficheiros. Um toque abre a divisão em ecrã inteiro, e a seta de voltar regressa à lista. Dentro da fotografia não há setas para outras divisões: assim ninguém se perde.

Para escolher para onde se olha ao entrar numa divisão, crie `media/casa/casa.json`:

```json
{"inicio": {"Sala": 180, "Cozinha": 90}}
```

Cada número é um ângulo (0 a 359), visto de dentro da fotografia. Faça à tentativa: prepare, veja no browser, ajuste. Nos passeios é igual, com um ficheiro `lugar.json` dentro da pasta de cada lugar.

## Preparar

Na pasta `app`:

```powershell
python tools/enviar_media.py --so-preparar
```

Fica tudo em `media/_preparado`: fotografias rodadas, reduzidas a 1600 px e **sem metadados** (nem GPS nem câmara saem do seu computador), músicas niveladas ao mesmo volume, legendas ditas pela voz do computador (precisa do modelo do passo 5), e o `manifest.json` que a app lê. Só refaz o que mudou.

Para ver no browser antes de ir para o tablet:

```powershell
python tools/enviar_media.py --teste
```

Isto prepara para `app/www/media-teste/` (uma cópia de teste; nunca vai para a app construída). Sirva a app (passo 3) e abra Fotografias, Música e A minha casa.

Ainda não tem fotografias à mão e quer só ver como fica? `python tools/criar_media_teste.py` faz uma pasta `media-exemplo` com três fotografias de cores, duas músicas de teste e duas divisões em 360. Copie o que lá está para `media` e prepare como acima.

## Enviar para o tablet

Com o tablet ligado por USB (passo 9 explica a ligação), na pasta `app`:

```powershell
python tools/enviar_media.py --so-enviar
```

Vai para a pasta da app no cartão de memória, se houver, senão para a memória interna. Pode repetir sempre que mudar algo: só envia o que mudou. Com a app aberta, os conteúdos novos aparecem ao voltar ao ecrã inicial, passado meio minuto. Pela internet, sem cabo, é o passo 11.

Se já publica media pela internet (passo 11), a ferramenta confere primeiro se o que preparou é igual ao que publicou. Se não for, para e diz o que fazer: publicar primeiro, enviar por USB depois. Assim o tablet nunca fica com uma mistura que os pacotes seguintes não conseguem acertar.

## Como saber que ficou bem

No browser com `--teste`, ou no tablet depois de enviar: as Fotografias mostram as fotografias com os nomes ditos, a Música toca as listas, A minha casa mostra a lista das divisões, e cada uma abre e roda com o dedo.

O jogo Quem é quem vem escondido, como os outros jogos ainda por experimentar. Para o pôr no ecrã inicial são precisas duas coisas: pelo menos quatro fotografias com nomes falsos, e tirar `oculto: true` da linha dele em `app/www/js/jogos/registo.js` (passo 7). Antes disso pode experimentá-lo no browser em `http://127.0.0.1:8765/#jogo=quem`, ou no tablet pelo ecrã da família.
