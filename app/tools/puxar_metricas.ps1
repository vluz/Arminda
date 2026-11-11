# Traz do tablet ligado por USB para o PC a cópia dos registos de jogo que está no cartão de memória.
# Uso: pwsh -File tools\puxar_metricas.ps1
# A app escreve uma linha JSON por registo em <pasta da app>/files/metricas/<aaaa-mm-dd>.jsonl,
# no cartão de memória se houver, senão na memória interna. Os dois sítios são vistos.
# Resultado: <kit>\dados\tablet\<hoje>\sd\... e \interna\..., com a contagem de linhas por ficheiro.
# Só leitura no tablet: nada é apagado nem mudado lá.

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'ambiente.ps1')

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

# Os cartões de memória aparecem em /storage com identificadores como 0A07-12FD.
$volumes = & $adb shell ls /storage 2>$null | ForEach-Object { $_.Trim() } |
    Where-Object { $_ -match '^[0-9A-F]{4}-[0-9A-F]{4}$' }
$origens = @()
foreach ($v in $volumes) { $origens += [pscustomobject]@{ Nome = "sd-$v"; Caminho = "/storage/$v/Android/data/$pacote/files/metricas" } }
$origens += [pscustomobject]@{ Nome = 'interna'; Caminho = "/storage/emulated/0/Android/data/$pacote/files/metricas" }

$destino = Join-Path (Join-Path $raiz 'dados\tablet') (Get-Date -Format 'yyyy-MM-dd')
New-Item -ItemType Directory -Force -Path $destino | Out-Null

$algum = $false
foreach ($o in $origens) {
    $existe = & $adb shell "[ -d '$($o.Caminho)' ] && echo sim" 2>$null
    if ("$existe".Trim() -ne 'sim') {
        Write-Output "Não existe: $($o.Caminho)"
        continue
    }
    $alvo = Join-Path $destino $o.Nome
    New-Item -ItemType Directory -Force -Path $alvo | Out-Null
    Write-Output "A trazer $($o.Caminho)"
    # Trazer o conteúdo da pasta (o /. no fim evita uma pasta metricas\metricas).
    & $adb pull "$($o.Caminho)/." $alvo
    if ($LASTEXITCODE -ne 0) { Write-Output "o adb pull falhou em $($o.Caminho)"; continue }
    $algum = $true
    Get-ChildItem -Path $alvo -Filter '*.jsonl' | Sort-Object Name | ForEach-Object {
        $n = 0
        foreach ($l in [System.IO.File]::ReadLines($_.FullName)) { if ($l.Trim()) { $n++ } }
        Write-Output ('{0,-12} {1,-18} {2,8} linhas {3,10} bytes' -f $o.Nome, $_.Name, $n, $_.Length)
    }
}

if (-not $algum) {
    Write-Output 'Não há pasta de registos no tablet. A app instalada é uma versão com a cópia no cartão de memória?'
    exit 1
}
Write-Output "Guardado em $destino"
