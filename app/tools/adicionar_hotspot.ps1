# Guarda o hotspot do telemóvel da família como rede Wi-Fi conhecida no tablet, para ele enviar os
# registos em cada visita. Lê MAE_HOTSPOT_SSID e MAE_HOTSPOT_PASS de <kit>\.SECRETS\SECRETS.txt; não
# mostra nenhum dos dois.
# Correr: pwsh -File tools\adicionar_hotspot.ps1
. (Join-Path $PSScriptRoot 'ambiente.ps1')
Assert-Tablet
$s = Read-Secrets
if (-not $s.MAE_HOTSPOT_SSID -or -not $s.MAE_HOTSPOT_PASS) { 'hotspot em falta no SECRETS.txt'; exit 1 }
# O adb shell junta os argumentos numa só linha de comandos para a shell do tablet, por isso os dois
# valores vão entre plicas para essa shell (o SSID pode ter espaços ou parênteses; a palavra-passe
# pode ter $ ou &).
if (($s.MAE_HOTSPOT_SSID + $s.MAE_HOTSPOT_PASS).Contains("'")) { 'este script não aceita uma plica no SSID nem na palavra-passe'; exit 1 }
$ssid = "'" + $s.MAE_HOTSPOT_SSID + "'"
$pass = "'" + $s.MAE_HOTSPOT_PASS + "'"
& $adb shell cmd wifi add-network $ssid wpa2 $pass 2>&1 | Out-Null
$lista = & $adb shell cmd wifi list-networks
if ($lista -match [regex]::Escape($s.MAE_HOTSPOT_SSID)) { 'hotspot guardado no tablet' } else { 'hotspot NÃO guardado'; $lista }
