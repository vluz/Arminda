# Passo 4: dizer quem é a pessoa

No fim deste passo o gato chama a pessoa pelo nome certo ("Olá, avó!") e usa o género certo ("És uma campeã!" ou "És um campeão!").

## Onde se muda

Tudo está no início de um só ficheiro: `app/tools/falas.py`. Abra-o num editor de texto (o Bloco de Notas serve; o VS Code é melhor) e encontre `PESSOA`:

```python
PESSOA = {
    "tratamento": "mãe",        # como o gato trata a pessoa
    "genero": "f",              # "f" ou "m"
    "rotulo": "da mãe",         # ecrã da família: "Este tablet é da mãe"
    "titulo": "Jogos da Mãe",   # título da janela
}
```

Mude os quatro valores. Exemplos:

| Pessoa | tratamento | genero | rotulo | titulo |
| --- | --- | --- | --- | --- |
| A avó | `"avó"` | `"f"` | `"da avó"` | `"Jogos da Avó"` |
| O pai | `"pai"` | `"m"` | `"do pai"` | `"Jogos do Pai"` |
| A tia Maria | `"tia Maria"` | `"f"` | `"da tia Maria"` | `"Jogos da Tia Maria"` |
| O Manuel, pelo nome | `"Manuel"` | `"m"` | `"do Manuel"` | `"Jogos do Manuel"` |

O `tratamento` entra em frases como "Bom dia, avó!", "Olá, avó! Que bom ver-te!", "Até logo, avó!". Escreva-o como o diria em voz alta, em minúsculas (os nomes próprios com maiúscula).

O `genero` escolhe entre as duas formas das frases que mudam: "És uma campeã!" ou "És um campeão!", "Bem-vinda a casa!" ou "Bem-vindo a casa!", "Que cozinheira!" ou "Que cozinheiro!".

## Uma segunda pessoa (opcional)

Um tablet pode mudar de mãos, por exemplo da mãe para o pai. Para isso serve `PESSOA_2`, logo abaixo: uma segunda pessoa, com os mesmos quatro valores. A app gera as duas versões de cada frase que muda, e o ecrã da família (passo 12) tem dois botões, "É da mãe" e "É do pai", para trocar sem reinstalar nada.

Se o tablet é só para uma pessoa, ponha:

```python
PESSOA_2 = None
```

## Aplicar

Na pasta `app`:

```powershell
python tools/falas.py
```

Escreve `www/data/falas.json` (todas as frases, já com a pessoa) e `www/data/pessoa.json` (o que a app precisa de saber da pessoa). A última linha diz quantas frases ficaram e quantas têm uma gémea para a segunda pessoa (17 com os valores que vêm no kit).

Depois disto, a voz do computador tem de ser feita (ou refeita) para estas frases: é o passo 5. Se já tinha feito a voz, o passo 5 só refaz as frases que mudaram.

## Como saber que ficou bem

Sirva a app como no passo 3 e abra-a no browser: o ecrã inicial diz "Olá, avó!" (ou quem for), e o título do separador do browser é o `titulo`. Jogue uma ronda até ao prémio: o elogio vem no género certo.

## Se quiser ir mais longe

As frases são modelos. Em `app/tools/falas.py` e em `app/tools/falas/<jogo>.json`, `{T}` é o tratamento e `{feminino|masculino}` escolhe pelo género. Pode acrescentar `{T}` a mais frases, ou mudar qualquer frase; depois corra `falas.py` outra vez. Não mude as chaves (a primeira parte de cada linha, como `"bom_dia"`): os jogos chamam-nas por esse nome.
