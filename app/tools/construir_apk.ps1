# Constrói a app (APK) a partir da pasta da app: prepara o www, sincroniza o Capacitor, corre o
# Gradle, confere o resultado e copia-o para <kit>\builds\jogos-<versão>.apk.
# Uso: pwsh -File tools\construir_apk.ps1
# Precisa de: Node.js (npm install feito uma vez na pasta da app), Java 21 (JAVA_HOME), Android SDK
# (ANDROID_HOME com platforms;android-36 e um pacote de build-tools). A primeira construção descarrega
# o Gradle e as bibliotecas Android (centenas de MB) e demora vários minutos; as seguintes demoram
# cerca de um minuto.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'ambiente.ps1')

# Java: JAVA_HOME, senão um Temurin 21 em Program Files.
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
    $jdk = Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($jdk) { $env:JAVA_HOME = $jdk.FullName } else { Write-Output 'JAVA_HOME não está definido e não se encontrou um JDK 21 (passo 2 do kit).'; exit 1 }
}
$env:Path = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:Path
# Android SDK para o Gradle: ANDROID_HOME a partir da pasta do adb.
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Split-Path (Split-Path $adb) }
if (-not (Test-Path (Join-Path $app 'node_modules\@capacitor\cli'))) { Write-Output "Corra primeiro 'npm install' em $app (passo 3 do kit)."; exit 1 }

Set-Location $app
python (Join-Path $PSScriptRoot 'preparar_build.py')
if ($LASTEXITCODE -ne 0) { exit 1 }
npx cap sync android
if ($LASTEXITCODE -ne 0) { exit 1 }
Set-Location (Join-Path $app 'android')
.\gradlew.bat assembleDebug --console=plain
if ($LASTEXITCODE -ne 0) { Write-Output 'O Gradle falhou (ver acima).'; exit 1 }

$apk = Join-Path $app 'android\app\build\outputs\apk\debug\app-debug.apk'
$bt = Get-ChildItem (Join-Path $env:ANDROID_HOME 'build-tools') -Directory | Sort-Object Name | Select-Object -Last 1
$aapt2 = Join-Path $bt.FullName 'aapt2.exe'
$apksigner = Join-Path $bt.FullName 'apksigner.bat'
$badging = & $aapt2 dump badging $apk | Out-String
$versao = if ($badging -match "versionName='([^']+)'") { $Matches[1] } else { 'desconhecida' }
$codigo = if ($badging -match "versionCode='(\d+)'") { $Matches[1] } else { '?' }
$assinatura = (& $apksigner verify --print-certs $apk | Select-String 'SHA-256 digest' | Select-Object -First 1).ToString().Trim()
$destino = Join-Path $raiz 'builds'
New-Item -ItemType Directory -Force $destino | Out-Null
$final = Join-Path $destino "jogos-$versao.apk"
Copy-Item $apk $final -Force
Write-Output ''
Write-Output "APK: $final"
Write-Output "Versão $versao (código $codigo), $((Get-Item $final).Length) bytes"
Write-Output $assinatura
Write-Output 'Guarde bem a chave de assinatura (debug.keystore): todas as atualizações seguintes têm de ser assinadas com a mesma chave (passo 8 do kit).'
