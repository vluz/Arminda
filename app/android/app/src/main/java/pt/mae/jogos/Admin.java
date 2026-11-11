package pt.mae.jogos;

import android.app.admin.DeviceAdminReceiver;

// Administrador do aparelho para o modo quiosque. Torna-se dono do aparelho uma vez, por USB:
//   adb shell dpm set-device-owner pt.mae.jogos/.Admin
// Desfazer: ecrã da família > "Deixar o modo quiosque" (duas confirmações), que chama
// DevicePolicyManager.clearDeviceOwnerApp. As construções até à 0.3.0 eram testOnly e também se
// desfaziam com adb shell dpm remove-active-admin pt.mae.jogos/.Admin; desde a 0.4.0 não são,
// porque o PackageInstaller recusa APK testOnly e a app não se conseguiria atualizar.
public class Admin extends DeviceAdminReceiver {}
