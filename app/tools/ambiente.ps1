# Partilhado pelas ferramentas em PowerShell: onde estão o adb e as pastas do kit. Usar assim:
#   . (Join-Path $PSScriptRoot 'ambiente.ps1')
# O adb procura-se primeiro no PATH, depois em ANDROID_HOME, depois nos sítios habituais do SDK.

$raiz = Split-Path (Split-Path $PSScriptRoot)     # a pasta que tem app/
$app = Split-Path $PSScriptRoot                   # a pasta da app
$pacote = 'pt.mae.jogos'
$sdkExtra = @()
# Afinações opcionais de um só PC (tools\ambiente_local.ps1, nunca no git): pode definir $sdkExtra
# e variáveis de ambiente como PLAYWRIGHT_BROWSERS_PATH.
$local = Join-Path $PSScriptRoot 'ambiente_local.ps1'
if (Test-Path $local) { . $local }

function Find-Adb {
    $c = Get-Command adb -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $candidatos = @(
        [Environment]::GetEnvironmentVariable('ANDROID_HOME', 'User'),
        $env:ANDROID_HOME,
        $env:ANDROID_SDK_ROOT,
        (Join-Path $env:LOCALAPPDATA 'Android\Sdk'),
        (Join-Path $env:USERPROFILE 'Android\Sdk')
    ) + $sdkExtra
    foreach ($sdk in $candidatos) {
        if ($sdk) {
            $p = Join-Path $sdk 'platform-tools\adb.exe'
            if (Test-Path $p) { return $p }
        }
    }
    Write-Output 'adb em falta. Instale as platform-tools do Android e ponha-as no PATH, ou defina ANDROID_HOME (passo 2 do kit).'
    exit 1
}

$adb = Find-Adb

# Um tablet, autorizado, ou parar com uma mensagem clara.
function Assert-Tablet {
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
}

# Linhas NOME=valor do ficheiro de segredos; os valores nunca são mostrados.
function Read-Secrets {
    $ficheiro = Join-Path $raiz '.SECRETS\SECRETS.txt'
    $s = @{}
    if (Test-Path $ficheiro) {
        foreach ($l in Get-Content $ficheiro) {
            if ($l -match '^\s*([A-Z_][A-Z0-9_]*)=(.*)$') { $s[$Matches[1]] = $Matches[2].Trim() }
        }
    }
    return $s
}
