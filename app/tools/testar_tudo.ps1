# Corre todos os testes de jogada e o teste rápido de cada atividade, contra um servidor em $Porta.
# Uso: pwsh -File tools\testar_tudo.ps1 [-Porta 8765]
# Precisa do Playwright em tools\testes (lá: npm install, depois npx playwright install chromium) e
# de um servidor:  python -m http.server 8765 --bind 127.0.0.1 --directory app\www
# Mostra uma linha de resumo por teste; os pormenores de uma falha vêm a seguir à linha dela.
param([string] $Porta = '8765')

$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
$tools = $PSScriptRoot
$app = Split-Path $tools
$testes = Join-Path $tools 'testes'
if (-not (Test-Path (Join-Path $testes 'node_modules\playwright'))) {
    Write-Output "O Playwright não está instalado: em $testes corra 'npm install' e depois 'npx playwright install chromium'."
    exit 1
}
# tools\ambiente_local.ps1 (afinações de um só PC, se existir) pode definir PLAYWRIGHT_BROWSERS_PATH.
$local = Join-Path $tools 'ambiente_local.ps1'
if (Test-Path $local) { . $local }
Set-Location $testes

# media-teste/config.json aponta o envio de registos para 127.0.0.1:8780. A maior parte dos testes
# conta uma ligação recusada aí como erro da página, por isso o servidor de substituição corre
# durante todos os testes.
$servidor = Start-Process python -ArgumentList '-I', (Join-Path $tools 'servidor_teste.py'), '8780' -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2

$TAMANHOS = 3   # o teste rápido tem de dar uma linha por tamanho de ecrã
$falhas = @()
try {
    foreach ($t in Get-ChildItem $testes -Filter *.mjs) {
        $saida = node $t.Name $Porta 2>&1 | Out-String
        $codigo = $LASTEXITCODE
        $premios = ([regex]::Matches($saida, 'prémio true')).Count
        "{0,-16} saída {1}  prémios {2}" -f $t.BaseName, $codigo, $premios
        if ($codigo -ne 0) {
            $falhas += $t.BaseName
            # Só as linhas que dizem o que correu mal: as boas também têm "erros: nenhum" e "prémio true".
            $mas = @($saida -split "`n" | Where-Object { $_ -match 'FALH|Error|error|prémio false|erros: \[' -and $_ -notmatch '^\s*registo:' })
            if ($mas.Count -eq 0) { $mas = @($saida -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 5) }
            $mas | Select-Object -First 8 | ForEach-Object { "    " + $_.Substring(0, [Math]::Min(400, $_.Length)) }
        }
    }

    $ids = [regex]::Matches((Get-Content (Join-Path $app 'www\js\jogos\registo.js') -Raw), '\{ id: "(\w+)"') | ForEach-Object { $_.Groups[1].Value }
    foreach ($id in $ids) {
        $saida = node lib\testar_jogo.mjs $id $Porta 5 2>&1 | Out-String
        $codigo = $LASTEXITCODE
        $linhas = @($saida -split "`n" | Where-Object { $_ -match '^\d+x\d+' })
        $mau = @($linhas | Where-Object { $_ -notmatch 'erros: nenhum; botões pequenos: nenhum' })
        # Bem só com o código de saída 0, as três linhas de resultado, e todas boas: um teste que
        # rebenta sem escrever nada não pode passar por bom.
        if ($codigo -ne 0 -or $linhas.Count -ne $TAMANHOS -or $mau.Count -gt 0) {
            $falhas += "rápido:$id"
            "rápido {0,-12} PROBLEMA (saída {1}, {2} de {3} tamanhos)" -f $id, $codigo, $linhas.Count, $TAMANHOS
            if ($mau.Count -gt 0) { $mau | ForEach-Object { "    $_" } }
            else { ($saida -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 5) | ForEach-Object { "    $_" } }
        } else { "rápido {0,-12} bem ({1} tamanhos)" -f $id, $TAMANHOS }
    }
    "FALHARAM: " + ($(if ($falhas) { $falhas -join ', ' } else { 'nenhum' }))
} finally {
    if ($servidor -and -not $servidor.HasExited) { Stop-Process -Id $servidor.Id -Force }
}
# O código de saída diz o mesmo que a última linha, para outro programa poder confiar nele.
if ($falhas.Count -gt 0) { exit 1 }
exit 0
