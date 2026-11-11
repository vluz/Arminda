# Passo 1: escolher e preparar o tablet

No fim deste passo tem um tablet limpo, em português, sem contas, com a depuração USB ligada, pronto para o computador lhe instalar a app.

## Que tablet

A app é leve. Corre em quase qualquer tablet Android, mas há regras que aprendemos à custa.

| Precisa de | Porquê |
| --- | --- |
| Android 7.0 ou mais recente | É o mínimo que a app aceita. Android 10 ou mais recente é melhor: mais seguro, e o ecrã apaga-se sem truques. |
| 2 GB de memória RAM a sério, ou mais | Os tablets baratos anunciam "8 GB" ou "12 GB" contando memória virtual. Procure a RAM física na ficha técnica. |
| Ecrã de 7 a 11 polegadas | 7 polegadas chega (foi o nosso). Maior é mais fácil de ver, mas mais pesado para segurar na cama. |
| Marca conhecida | Alcatel, Lenovo, Samsung, TCL, SPC. Nada de tablets sem marca de lojas online: o FBI avisou em junho de 2025 que mais de um milhão de aparelhos Android sem marca vinham com malware de fábrica ([aviso](https://www.ic3.gov/PSA/2025/PSA250605)). Nada de Amazon Fire (não é Android normal). |
| Ligação USB ao computador | Para instalar a app e fechar o tablet em modo quiosque. Qualquer cabo USB de dados serve; os de carregar barato às vezes não passam dados. |

Compre também:

- Uma capa de borracha com pega, das de criança. Protege das quedas e dá por onde segurar.
- Um cartão de memória (32 GB chegam) se quiser pôr muita música e fotografias. A app também guarda lá uma cópia dos registos de jogo.
- Um carregador de parede com o cabo original. A bateria é o ponto fraco de qualquer tablet barato.

O nosso foi um Alcatel 1T 7 (2023), 7 polegadas, 2 GB, Android 12 Go, cerca de 50 euros. Chega, mas no limite: num tablet de 4 GB tudo é mais rápido.

## Preparar o tablet

Faça isto num tablet novo, ou depois de repor as definições de fábrica num tablet usado (Definições, Sistema, Repor opções, Apagar todos os dados).

1. Ligue o tablet e siga o assistente. Escolha **Português (Portugal)**.
2. Ligue-o à rede Wi-Fi de casa.
3. **Não entre com nenhuma conta Google. Salte esse passo.** O modo quiosque (passo 9) só se consegue ligar num tablet sem contas. Se já há uma conta, remova-a em Definições, Contas, ou volte a repor de fábrica.
4. Não ponha bloqueio de ecrã (nem PIN, nem padrão). A pessoa não vai conseguir desbloquear, e a app toma conta do tablet.
5. Ligue as opções de programador: Definições, Acerca do tablet, toque sete vezes em **Número de compilação** até dizer "Já é um programador".
6. Em Definições, Sistema, Opções de programador, ligue **Depuração USB**.
7. Se tem cartão de memória, meta-o agora. Quando o tablet perguntar, escolha usá-lo como **armazenamento portátil** (não como armazenamento interno).
8. Deixe o tablet a carregar até 100 %.

Os nomes dos menus variam um pouco de marca para marca. Se não encontrar algo, procure na internet "opções de programador" com o nome do seu tablet.

## Como saber que ficou bem

No passo 2 vai instalar o programa `adb` no computador. Quando ligar o tablet por USB, o tablet pergunta "Permitir depuração USB?". Marque "Permitir sempre a partir deste computador" e toque em **OK**. Se a pergunta não aparecer, no tablet puxe a barra de notificações, toque na notificação do USB e escolha **Transferência de ficheiros** ou **Apenas carregar**: em alguns tablets só um dos modos deixa passar o `adb`.

No computador, o passo 9 começa por `adb devices`, que tem de listar o tablet com a palavra `device` ao lado. Até lá, o tablet pode ficar guardado.
