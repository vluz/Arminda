package pt.mae.jogos;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.util.Log;

// Dois trabalhos:
// - A resposta do PackageInstaller a uma atualização do próprio APK (Atualizar.instalarApk). Quando
//   corre bem, este processo é morto antes de a resposta chegar, por isso normalmente só chegam aqui
//   as falhas; são registadas e o ficheiro descarregado é largado. Um pedido de ação ao utilizador
//   nunca é mostrado: em modo quiosque ninguém lhe conseguiria responder, e a app tem de ficar à frente.
// - MY_PACKAGE_REPLACED: logo depois de a app ser atualizada, abri-la outra vez, para o tablet voltar
//   aos jogos em modo quiosque (o Android também reinicia a app do ecrã inicial; isto é a segurança).
public class ResultadoInstalacao extends BroadcastReceiver {

    @Override
    public void onReceive(Context c, Intent intent) {
        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) {
            Log.i(Atualizar.TAG, "atualização: pacote substituído, a abrir a app");
            try {
                c.startActivity(new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception e) {
                Log.e(Atualizar.TAG, "atualização: não se conseguiu reabrir a app", e);
            }
            return;
        }
        int estado = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        int versao = intent.getIntExtra("versao", 0);
        if (estado == PackageInstaller.STATUS_SUCCESS) {
            Log.i(Atualizar.TAG, "atualização: apk " + versao + " instalado");
            return;
        }
        if (estado == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            // Precisaria de um toque num diálogo do sistema: nunca em modo quiosque. Abandonar a sessão.
            int sessao = intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1);
            if (sessao >= 0) {
                try {
                    c.getPackageManager().getPackageInstaller().abandonSession(sessao);
                } catch (Exception e) {
                    // Já não existe.
                }
            }
        }
        Log.w(Atualizar.TAG, "atualização: a instalação do apk " + versao + " falhou, estado " + estado + ": "
            + intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE));
        Atualizar.falhouInstalacao(c, versao, estado);
    }
}
