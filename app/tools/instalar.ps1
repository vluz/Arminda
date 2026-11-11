# Instala (ou atualiza) a app no tablet ligado por USB e abre-a.
# Uso: pwsh -File tools\instalar.ps1 [caminho-do-apk]
# O progresso no tablet fica: -r substitui a app sem apagar os dados dela.
# O APK tem de estar assinado com a mesma chave do que está no tablet (a chave de depuração,
# normalmente %USERPROFILE%\.android\debug.keystore, ou em ANDROID_SDK_HOME quando essa variável
# existe; guarde uma cópia, passo 8 do kit): uma chave diferente é recusada com
# INSTALL_FAILED_UPDATE_INCOMPATIBLE, e uma app dona do aparelho não se pode desinstalar para
# contornar isso.

param([string] $Apk = (Join-Path (Split-Path $PSScriptRoot) 'android\app\build\outputs\apk\debug\app-debug.apk'))

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'ambiente.ps1')
if (-not (Test-Path $Apk)) { Write-Output "APK em falta: $Apk (construa-o primeiro: passo 8 do kit)"; exit 1 }

$devices = & $adb devices | Select-String '\tdevice$'
if (-not $devices) {
    Write-Output 'Nenhum tablet encontrado. Veja o cabo e a depuração USB, e aceite a pergunta no tablet.'
    & $adb devices
    exit 1
}
if (@($devices).Count -gt 1) {
    Write-Output 'Há mais de um aparelho ligado. Deixe ligado só o tablet.'
    exit 1
}

Write-Output "A instalar $Apk"
# -t: aceita também uma construção marcada como de teste (a nossa não é desde a 0.4.0; não faz mal)
& $adb install -r -t $Apk
if ($LASTEXITCODE -ne 0) { Write-Output 'A instalação falhou (ver a mensagem do adb acima). Nada mudou no tablet.'; exit 1 }
# Em modo quiosque a atualização já reinicia a app (ela é o ecrã inicial); isto trata do outro caso.
& $adb shell monkey -p pt.mae.jogos -c android.intent.category.LAUNCHER 1 | Out-Null
Write-Output 'Instalada e aberta.'
