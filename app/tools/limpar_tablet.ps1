# Desliga as apps do sistema que podem pôr diálogos, avisos ou atalhos por cima da app dos jogos.
# Volta atrás: correr com -Repor liga-as todas outra vez e repõe cada definição abaixo no valor de
# origem. Nada é desinstalado. As apps desligadas continuam desligadas depois de reiniciar (o estado
# é guardado pelo gestor de pacotes, como em Definições > Apps > Desativar).
# Ficam de propósito: a entrada em redes com página de acesso, Chrome, WebView, teclado, Definições,
# serviços do Google Play, o instalador de pacotes e o texto para voz (precisos para entrar no Wi-Fi
# de um hospital, para atualizações e para reparações).
# Nota: o ecrã inicial antigo (launcher3) é desligado porque em modo quiosque a app dos jogos é o
# ecrã inicial. Correr -Repor ANTES de tirar o dono do aparelho, senão o tablet fica sem ecrã inicial.
#
# Correr: pwsh -File tools\limpar_tablet.ps1 [-Repor]
param([switch]$Repor)

. (Join-Path $PSScriptRoot 'ambiente.ps1')
$devices = & $adb devices | Select-String '\tdevice$'
if (-not $devices) {
    Write-Output 'Nenhum tablet encontrado. Veja o cabo e a depuração USB, e aceite a pergunta no tablet.'
    & $adb devices
    exit 1
}
if (@($devices).Count -gt 1) { Write-Output 'Há mais de um aparelho ligado. Deixe ligado só o tablet.'; exit 1 }

$apps = @(
    'com.autoreboot.android',            # reinícios marcados
    'com.tcl.fota.system',               # pedidos de atualização do sistema
    'com.mediatek.batterywarning',       # diálogo de bateria fraca por cima do ecrã
    'com.google.android.marvin.talkback',# atalho de acessibilidade (as duas teclas de volume premidas)
    'com.google.android.deskclock',      # alarmes
    'com.google.android.calendar',       # lembretes
    'com.android.vending',               # avisos de atualização da Play Store
    'com.google.android.apps.wellbeing', # avisos de tempo de ecrã
    'com.google.android.apps.assistant', # assistente
    'com.google.android.apps.searchlite',
    'com.google.android.apps.setupwizard.searchselector',
    'com.google.android.feedback',
    'com.google.android.apps.messaging',
    'com.google.android.apps.tachyon',   # chamadas do Meet
    'com.google.android.gm',
    'com.google.android.apps.maps',
    'com.google.android.youtube',
    'com.google.android.videos',
    'com.google.android.apps.photosgo',
    'com.facebook.lite',
    'com.tcl.usercare',
    'com.tcl.tct.weather',
    'com.tct.gdpr',
    'com.tct.smart.dailyboard',
    'com.emdoor.parentalcontrol',
    'com.emdoor.digital.historyview',
    'com.demos.screensaver',
    'com.android.dreams.basic',
    'com.android.egg',
    'com.android.traceur',
    'com.debug.loggerui',
    'com.jrdcom.Elabel',
    'com.android.music',
    'com.tcl.tct.soundrecorder',
    'com.android.launcher3',             # ecrã inicial antigo, 97 MB parado; agora o ecrã inicial é a app dos jogos
    'com.google.android.partnersetup'
)
# Fica ligado apesar de grande: serviços do Google Play (cerca de 180 MB). Desligá-lo no Android Go
# traz diálogos de "parou de funcionar", o contrário do que este script quer.

foreach ($p in $apps) {
    if ($Repor) { $r = & $adb shell pm enable $p 2>&1 } else { $r = & $adb shell pm disable-user --user 0 $p 2>&1 }
    "{0,-55} {1}" -f $p, ($r -join ' ')
}

# Definições mudadas aqui. Com -Repor cada uma é apagada, o que repõe o valor de origem do Android
# (settings delete), em vez de adivinhar um valor.
$secure = @('screensaver_enabled', 'screensaver_activate_on_sleep', 'screensaver_activate_on_dock', 'location_mode')
$global = @('heads_up_notifications_enabled', 'audio_safe_volume_state', 'wifi_scan_always_enabled',
            'ble_scan_always_enabled', 'network_recommendations_enabled', 'mobile_data_always_on',
            'window_animation_scale', 'transition_animation_scale', 'animator_duration_scale')

if (-not $Repor) {
    # Sem protetor de ecrã, sem avisos a saltar por cima.
    & $adb shell settings put secure screensaver_enabled 0
    & $adb shell settings put secure screensaver_activate_on_sleep 0
    & $adb shell settings put secure screensaver_activate_on_dock 0
    & $adb shell settings put global heads_up_notifications_enabled 0
    # Auscultadores: sem o diálogo "subir o volume acima do nível seguro?" (estado 1 = desligado; o valor
    # de origem do Android é 3).
    & $adb shell settings put global audio_safe_volume_state 1
    # Bluetooth desligado poupa memória. Com auscultadores sem fios, correr: adb shell svc bluetooth enable
    & $adb shell svc bluetooth disable
    & $adb shell am force-stop com.google.android.inputmethod.latin
    # Memória, processador e bateria.
    & $adb shell settings put secure location_mode 0              # sem localização: os serviços de localização do Google ficam parados
    & $adb shell settings put global wifi_scan_always_enabled 0   # sem procuras de Wi-Fi em fundo para a localização
    & $adb shell settings put global ble_scan_always_enabled 0    # sem procuras de Bluetooth em fundo
    & $adb shell settings put global network_recommendations_enabled 0
    & $adb shell settings put global mobile_data_always_on 0      # tablet só com Wi-Fi
    & $adb shell settings put global window_animation_scale 0     # animações das janelas do sistema desligadas (os jogos usam CSS)
    & $adb shell settings put global transition_animation_scale 0
    & $adb shell settings put global animator_duration_scale 0.5  # fica ligado: o WebView usa-o
    & $adb shell dumpsys deviceidle whitelist +pt.mae.jogos       # o envio dos registos não é adiado pelo modo de poupança (Doze)
} else {
    foreach ($s in $secure) { & $adb shell settings delete secure $s | Out-Null }
    foreach ($g in $global) { & $adb shell settings delete global $g | Out-Null }
    & $adb shell dumpsys deviceidle whitelist -pt.mae.jogos | Out-Null
    & $adb shell svc bluetooth enable
    Write-Output 'Definições repostas nos valores de origem, Bluetooth ligado, exceção do modo de poupança retirada.'
}
