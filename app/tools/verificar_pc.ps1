# Confere se este PC com Windows tem todos os programas de que o kit precisa, e diz onde obter o que falta.
# Uso: pwsh -File tools\verificar_pc.ps1
# Nada é instalado nem mudado; só olha.
$ErrorActionPreference = 'SilentlyContinue'

# A primeira linha que um programa escreve para a opção de versão, ou $null se o programa não existe.
# O texto escrito no canal de erros (java -version) também conta.
function Versao($programa, $opcao) {
    $c = Get-Command $programa -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $c) { return $null }
    return PrimeiraLinha $c.Source $opcao
}
function PrimeiraLinha($exe, $opcao) {
    $ErrorActionPreference = 'Continue'   # sem isto, o Windows PowerShell 5.1 perde o texto do canal de erros
    $linhas = & $exe $opcao 2>&1 | ForEach-Object { "$_" } | Where-Object { $_.Trim() }
    return "$($linhas | Select-Object -First 1)".Trim()
}

$linhas = @()
function Linha($nome, $ok, $detalhe, $onde) {
    $script:linhas += [pscustomobject]@{ Programa = $nome; Estado = $(if ($ok) { 'OK' } else { 'FALTA' }); Detalhe = $detalhe; Onde = $onde }
}

# Git
$v = Versao 'git' '--version'
Linha 'Git' ($null -ne $v) $v 'https://git-scm.com/install/windows'

# Python 3.10 ou mais recente
$v = Versao 'python' '--version'
$okPy = $false
if ($v -match 'Python (\d+)\.(\d+)') { $okPy = ([int]$Matches[1] -gt 3) -or ([int]$Matches[1] -eq 3 -and [int]$Matches[2] -ge 10) }
Linha 'Python 3.10+' $okPy $v 'https://www.python.org/downloads/ (marque "Add python.exe to PATH")'

# Node.js 22 ou mais recente (Capacitor 8) e npm
$v = Versao 'node' '--version'
$okNode = $false
if ($v -match 'v(\d+)') { $okNode = [int]$Matches[1] -ge 22 }
Linha 'Node.js 22+ (LTS)' $okNode $v 'https://nodejs.org/en/download'
$v = Versao 'npm' '--version'
Linha 'npm' ($null -ne $v) $v '(vem com o Node.js)'

# Java 21 (de preferência por JAVA_HOME)
$java = $null
if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) { $java = Join-Path $env:JAVA_HOME 'bin\java.exe' }
elseif (Get-Command java -ErrorAction SilentlyContinue) { $java = (Get-Command java).Source }
$okJava = $false; $vJava = 'não encontrado'
if ($java) {
    $vJava = PrimeiraLinha $java '-version'
    if ($vJava -match '"(\d+)') { $okJava = [int]$Matches[1] -ge 21 }
}
Linha 'Java (JDK) 21+' $okJava "$vJava (JAVA_HOME=$env:JAVA_HOME)" 'https://adoptium.net/temurin/releases/ (JDK 21 LTS) e defina JAVA_HOME'

# Android SDK: platform-tools (adb), ferramentas de linha de comandos, build-tools, plataforma 36
. (Join-Path $PSScriptRoot 'ambiente.ps1') 2>$null
$sdk = $null
foreach ($c in @($env:ANDROID_HOME, [Environment]::GetEnvironmentVariable('ANDROID_HOME', 'User'), (Join-Path $env:LOCALAPPDATA 'Android\Sdk')) + $sdkExtra) {
    if ($c -and (Test-Path (Join-Path $c 'platform-tools\adb.exe'))) { $sdk = $c; break }
}
Linha 'Android SDK (ANDROID_HOME)' ($null -ne $sdk) "$sdk" 'https://developer.android.com/studio#command-line-tools-only e defina ANDROID_HOME'
if ($sdk) {
    Linha '  platform-tools (adb)' (Test-Path (Join-Path $sdk 'platform-tools\adb.exe')) '' 'https://developer.android.com/tools/releases/platform-tools'
    Linha '  cmdline-tools (sdkmanager)' (Test-Path (Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat')) '' 'https://developer.android.com/studio#command-line-tools-only'
    $bt = Get-ChildItem (Join-Path $sdk 'build-tools') -Directory -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -Last 1
    Linha '  build-tools' ($null -ne $bt) "$($bt.Name)" 'sdkmanager "build-tools;35.0.0"'
    Linha '  platforms;android-36' (Test-Path (Join-Path $sdk 'platforms\android-36')) '' 'sdkmanager "platforms;android-36"'
} else {
    Linha '  platform-tools (adb)' $false '' 'https://developer.android.com/tools/releases/platform-tools'
}

# ffmpeg (voz e media), ImageMagick (opcional: folhas de contacto e fotografias de teste)
$v = Versao 'ffmpeg' '-version'
Linha 'ffmpeg' ($null -ne $v) $v 'https://ffmpeg.org/download.html (Windows builds: gyan.dev ou BtbN) e ponha a pasta bin no PATH'
$v = Versao 'magick' '-version'
Linha 'ImageMagick (opcional)' ($null -ne $v) $v 'https://imagemagick.org/script/download.php'

# Piper (voz): um Python que consiga importar o piper
$okPiper = $false
if ($okPy) { $r = & python -c "import piper, PIL; print('piper ok')" 2>&1 | ForEach-Object { "$_" } | Out-String; $okPiper = $r -match 'piper ok' }
Linha 'Piper e Pillow (voz e imagens)' $okPiper '' 'passo 3: pip install pillow piper-tts'

# Opcional: Docker ou Podman para o servidor da família (passo 10)
$v = Versao 'docker' '--version'; $v2 = Versao 'podman' '--version'
Linha 'Docker ou Podman (opcional, passo 10)' (($null -ne $v) -or ($null -ne $v2)) "$v $v2" 'https://docs.docker.com/engine/install/ ou https://podman.io/docs/installation'

$linhas | Format-Table Programa, Estado, Detalhe -AutoSize | Out-String -Width 160
$emFalta = @($linhas | Where-Object { $_.Estado -eq 'FALTA' })
if ($emFalta.Count) { 'Onde obter o que falta:'; $emFalta | ForEach-Object { "  $($_.Programa.Trim()): $($_.Onde)" }; '' }
$faltam = @($linhas | Where-Object { $_.Estado -eq 'FALTA' -and $_.Programa -notmatch 'opcional|Piper|Docker' })
if ($faltam.Count) { Write-Output "Faltam $($faltam.Count) programas obrigatórios. Instale-os e corra outra vez."; exit 1 }
Write-Output 'Tudo o que é obrigatório está instalado.'
