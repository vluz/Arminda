# Passo 8: construir a app (APK)

No fim deste passo tem um ficheiro `.apk` em `builds/`, pronto a instalar no tablet, e a chave que o assinou guardada em lugar seguro.

## Construir

Na pasta do kit:

```powershell
pwsh -File app\tools\construir_apk.ps1
```

O script faz quatro coisas: copia `www` para `www-build` sem os ficheiros de teste, sincroniza a parte Android (Capacitor), corre o Gradle, e confere o resultado. No fim imprime o caminho do `.apk`, a versão, e a impressão digital da chave que o assinou.

A primeira vez descarrega o Gradle e as bibliotecas Android (umas centenas de MB) e demora vários minutos; depois demora cerca de um minuto. Precisa de internet só nessa primeira vez.

Alternativa sem script, na pasta `app`: `npm run apk`. Faz o mesmo, sem a verificação final.

## A chave de assinatura

O Android só aceita atualizar uma app com um `.apk` assinado pela **mesma chave** que a primeira instalação. O Gradle cria uma chave de depuração sozinho na primeira vez, em `C:\Users\<o seu nome>\.android\debug.keystore` (ou em `%ANDROID_SDK_HOME%\.android\` se essa variável existir). Com o tablet fechado em modo quiosque, não há como desinstalar e começar de novo; perder esta chave obriga a repor o tablet de fábrica.

Por isso, agora:

1. Copie `debug.keystore` para `.SECRETS\android-keys\` na pasta do kit (crie a pasta). A pasta `.SECRETS` nunca vai para o git.
2. Guarde outra cópia fora deste computador (uma pen, outro disco).
3. Se um dia mudar de computador, ponha a cópia no mesmo sítio antes de construir.

Esta chave de depuração chega para um tablet de família: o `.apk` nunca vai para a Play Store. A palavra-passe dela é a de origem do Android, `android`.

## O que fica a saber do `.apk`

O script mostra, por exemplo:

```text
APK: C:\Jogos\builds\jogos-0.7.0.apk
Versão 0.7.0 (código 7), 24504368 bytes
Signer #1 certificate SHA-256 digest: (64 letras e números, a impressão digital da chave)
```

O `código` é o número que o Android compara para aceitar uma atualização: tem de subir a cada nova versão que instale. Os dois números estão no início de `app/android/app/build.gradle` (`versionCode`, `versionName`) e em `app/package.json` e `VERSAO_APP` em `app/www/js/metricas.js`. Para uma nova versão, suba os três no mesmo sentido.

## Como saber que ficou bem

O script terminou com "APK:" e a linha "Signer". A chave está copiada em `.SECRETS\android-keys\`. Pode seguir para o passo 9.

## Se correr mal

- "JAVA_HOME não está definido": o passo 2, Java. Defina a variável de ambiente para a pasta do JDK 21.
- "SDK location not found" ou "platforms;android-36": o passo 2, Android SDK; confirme `ANDROID_HOME` e corra o `sdkmanager` outra vez.
- "Corra primeiro 'npm install'": o passo 3.
- Ficou sem espaço ou demora imenso: o Gradle guarda tudo em `C:\Users\<nome>\.gradle`. Para o pôr noutro disco, defina a variável de ambiente `GRADLE_USER_HOME`.
