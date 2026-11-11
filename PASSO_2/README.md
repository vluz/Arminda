# Passo 2: preparar o computador

No fim deste passo o computador tem todos os programas de que o kit precisa, e o verificador diz "tudo instalado".

Estas instruções são para Windows 10 ou 11. As ferramentas do kit são scripts em PowerShell e Python; em Linux ou Mac os scripts `.py` correm na mesma, e os `.ps1` precisam do PowerShell 7 (ou faça os mesmos passos à mão, que são poucos).

## Instalar, por esta ordem

Em cada ligação, descarregue a versão para Windows de 64 bits e instale com as opções que vêm por omissão, a não ser que se diga o contrário. Se uma ligação deixar de funcionar, procure na internet pelas palavras entre aspas.

| Programa | Onde | Notas |
| --- | --- | --- |
| Git | [git-scm.com/install/windows](https://git-scm.com/install/windows) ("git for windows") | Traz o Git Bash e o `openssl`, que o passo 11 usa. |
| Python 3 | [python.org/downloads](https://www.python.org/downloads/) ("python download windows") | Na primeira janela do instalador, marque **Add python.exe to PATH**. Precisa da versão 3.10 ou mais recente. |
| Node.js | [nodejs.org/en/download](https://nodejs.org/en/download) ("node.js download") | Escolha a versão **LTS**. A app precisa da versão 22 ou mais recente. |
| Java (JDK) 21 | [adoptium.net/temurin/releases](https://adoptium.net/temurin/releases/) ("temurin 21 windows") | Escolha **JDK 21 - LTS**, o instalador `.msi`. No instalador, ative **Set JAVA_HOME variable**. |
| Android SDK, só as ferramentas de linha de comandos | [developer.android.com/studio](https://developer.android.com/studio#command-line-tools-only), secção **Command line tools only** ("android command line tools") | Não precisa do Android Studio inteiro. Veja a secção seguinte. |
| ffmpeg | [ffmpeg.org/download.html](https://ffmpeg.org/download.html), Windows builds de gyan.dev ou BtbN ("ffmpeg windows build") | É um `.zip` sem instalador: descomprima, e ponha a pasta `bin` no PATH (ver abaixo). Converte a voz e a música. |
| ImageMagick (opcional) | [imagemagick.org](https://imagemagick.org/script/download.php) ("imagemagick windows") | Só para as folhas de contacto das fotografias e as fotografias de teste. |
| Docker ou Podman (opcional) | [docs.docker.com/engine/install](https://docs.docker.com/engine/install/) ou [podman.io/docs/installation](https://podman.io/docs/installation) | Só no computador ou servidor onde correr o servidor da família (passo 10). Normalmente não é este PC. |

### O Android SDK à mão

O Android SDK é o que constrói a app e fala com o tablet. Sem o Android Studio, faz-se assim:

1. Crie a pasta `C:\Android\Sdk` (ou outra à sua escolha, sem espaços nem acentos).
2. Descomprima o `.zip` das command line tools. Lá dentro vem uma pasta `cmdline-tools`. Mova-a para `C:\Android\Sdk\cmdline-tools\latest`, de modo que exista `C:\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat`.
3. Defina a variável de ambiente `ANDROID_HOME` com o valor `C:\Android\Sdk`: Definições do Windows, procure "variáveis de ambiente", **Editar as variáveis de ambiente da conta de utilizador**, **Novo**.
4. Abra um PowerShell novo e instale as peças que a app usa (aceite as licenças com `y`):

```powershell
& "$env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat" "platform-tools" "platforms;android-36" "build-tools;35.0.0"
```

5. Ponha `C:\Android\Sdk\platform-tools` no PATH (mesma janela das variáveis de ambiente, variável `Path`, **Editar**, **Novo**). É aí que fica o `adb`.

### Pôr uma pasta no PATH

O PATH é a lista de pastas onde o Windows procura programas. Para o ffmpeg (e o `platform-tools` acima): Definições do Windows, procure "variáveis de ambiente", **Editar as variáveis de ambiente da conta de utilizador**, selecione `Path`, **Editar**, **Novo**, cole o caminho da pasta `bin`. Feche e abra de novo o PowerShell para as mudanças contarem.

## Verificar

Abra um PowerShell na pasta do kit (a que tem `app/` e os `PASSO_n`) e corra:

```powershell
pwsh -File app\tools\verificar_pc.ps1
```

Se o `pwsh` não existir, escreva `powershell` em vez de `pwsh`. O verificador mostra uma tabela com OK ou FALTA em cada linha, e a ligação para o que falta. Repita até dizer "Tudo o que é obrigatório está instalado." O Piper (voz) e o Docker aparecem como opcionais: tratam-se nos passos 5 e 10.

## Se correr mal

- "python não é reconhecido": não marcou **Add python.exe to PATH**. Volte a correr o instalador do Python, escolha **Modify** e ative a opção, ou adicione a pasta à mão.
- O `java -version` mostra uma versão antiga: há outro Java no computador. Defina `JAVA_HOME` com a pasta do JDK 21 (por exemplo `C:\Program Files\Eclipse Adoptium\jdk-21.0.x-hotspot`).
- Windows diz que o `.ps1` "não pode ser carregado porque a execução de scripts está desativada": corra uma vez, num PowerShell aberto como administrador, `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
