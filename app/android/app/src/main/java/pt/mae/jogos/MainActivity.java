package pt.mae.jogos;

import android.app.ActivityManager;
import android.app.admin.DevicePolicyManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    // ---- O que uma família pode mudar (passo 7 do kit); explicado em "Ecrã sossegado", mais abaixo ----
    private static final long QUIETO_PADRAO = 10 * 60000L;        // sem toque durante este tempo: ecrã sossegado
    private static final boolean APAGAR_NO_CARREGADOR = true;     // true: apaga também no carregador; false: aí só escurece


    private final Handler relogio = new Handler(Looper.getMainLooper());
    private boolean emPrimeiroPlano = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(Quiosque.class);
        registerPlugin(CopiaSD.class);
        registerPlugin(Atualizar.class);
        // Antes de a Bridge arrancar: escolher os ficheiros web a servir (um pacote descarregado, um pacote
        // à experiência a voltar atrás depois de um reinício, ou os ficheiros que vêm na app). Ver Atualizar.java.
        boolean outroBundle = Atualizar.antesDeArrancar(this);
        super.onCreate(savedInstanceState);
        if (outroBundle && getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().clearCache(true);
            getBridge().reload();
        }
        // O ecrã fica ligado enquanto a pessoa joga; fora da app o tablet adormece como é normal.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        vigiarCarga();
        esconderBarras();
        sobreviverAoWebView();
        limparCacheSeAtualizada();
        configurarQuiosque();
    }

    @Override
    public void onResume() {
        super.onResume();
        emPrimeiroPlano = true;
        tentativas = 0;
        bloquearSeDevido();
        // De volta do ecrã apagado (botão de ligar) ou das Definições: brilho total, ecrã mantido ligado,
        // e os minutos de sossego recomeçam.
        if (escuro) definirBrilho(WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE);
        manterLigado();
        lerQuietoTeste();
        contarInatividade();
    }

    @Override
    public void onPause() {
        super.onPause();
        emPrimeiroPlano = false;
    }

    // ---- Sobreviver a uma queda do processo que desenha o WebView ----
    // Num tablet de 2 GB o processo que desenha o WebView pode ser morto por falta de memória. Sem
    // tratar disso, o Android mata a app inteira (WebViewClient.onRenderProcessGone, API 26). Em vez
    // disso a atividade é refeita com um WebView novo: a mesma tarefa, por isso o modo quiosque fica, e
    // a página recarrega do estado guardado em poucos segundos.
    private void sobreviverAoWebView() {
        if (getBridge() == null) return;
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                boolean crashed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && detail != null && detail.didCrash();
                Log.e("MAE", "o processo que desenha o WebView caiu (crashed=" + crashed + "): a refazer a atividade");
                // Handler próprio: a fila do relogio é limpa por bloquearSeDevido e não pode engolir isto.
                new Handler(Looper.getMainLooper()).post(() -> {
                    try { recreate(); } catch (Exception e) { Log.e("MAE", "refazer a atividade falhou", e); }
                });
                return true;
            }
        });
    }

    // ---- Ecrã sossegado: escurecer no carregador, apagar a bateria ----
    // A app mantém o ecrã ligado, e em modo quiosque está sempre aberta. Ao fim de 10 minutos sem toque:
    // - no carregador, o ecrã escurece quase até ao preto, em vez de iluminar o quarto a noite toda. O
    //   primeiro toque só o volta a acender e não passa para a página, para a pessoa nunca abrir um jogo
    //   sem querer. O som (a música, o gato) continua a tocar com o ecrã escuro.
    // - a bateria, o ecrã apaga-se (um ecrã escurecido ligado a noite toda esgota um tablet barato, e
    //   depois ninguém joga até alguém dar por isso). Como dona do aparelho, a app chama lockNow(); o
    //   bloqueio de ecrã está desligado, por isso o botão de ligar acorda direto na app, ainda em modo
    //   quiosque. Se o lockNow() for recusado, larga-se o pedido de manter o ecrã ligado e é o tempo de
    //   espera do próprio Android que o apaga. Tirar do carregador recomeça os 10 minutos; pôr a
    //   carregar com o ecrã escuro não faz mal.
    // APAGAR_NO_CARREGADOR: para uma pessoa que se entende com o botão de ligar, o ecrã apaga-se também
    // no carregador (a bateria é o ponto fraco de um tablet barato). Pôr false para uma pessoa que não
    // encontra o botão: um ecrã escuro ao lado da cama é melhor do que um tablet sem bateria.
    private long quietoMs = QUIETO_PADRAO;
    private boolean escuro = false;
    private boolean engolirGesto = false;
    private boolean aCarregar = true;          // até a bateria responder: o comportamento antigo e seguro (escurecer)
    private boolean semManterLigado = false;   // caminho alternativo: pedido de manter ligado largado, à espera do Android
    private long quietoDesde = SystemClock.elapsedRealtime();
    private final Handler relogioBrilho = new Handler(Looper.getMainLooper());
    private final Runnable quieto = this::quandoQuieto;

    private final BroadcastReceiver bateria = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            mudouCarga(i);
        }
    };

    private void definirBrilho(float valor) {
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.screenBrightness = valor;
        getWindow().setAttributes(lp);
        escuro = valor >= 0 && valor < 0.1f;
    }

    private void contarInatividade() {
        quietoDesde = SystemClock.elapsedRealtime();
        relogioBrilho.removeCallbacks(quieto);
        relogioBrilho.postDelayed(quieto, quietoMs);
    }

    private void manterLigado() {
        if (!semManterLigado) return;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        semManterLigado = false;
    }

    private void quandoQuieto() {
        // Os atrasos do Handler param enquanto o processador dorme: conferir com o relógio verdadeiro.
        long falta = quietoDesde + quietoMs - SystemClock.elapsedRealtime();
        if (falta > 1000) {
            relogioBrilho.postDelayed(quieto, falta);
            return;
        }
        if (!emPrimeiroPlano) return;   // a família está nas Definições: aí vale o tempo de espera do próprio Android
        if (aCarregar && !APAGAR_NO_CARREGADOR) definirBrilho(0.02f);
        else apagarEcra();
    }

    private void apagarEcra() {
        // O force-lock está em device_admin.xml, mas o Android dá as políticas a um administrador quando
        // ele se torna dono do aparelho: um tablet preparado com uma construção mais antiga só as recebe
        // depois de reiniciar (visto no emulador: recusado depois da atualização 4 -> 5, dado depois de um
        // reinício). Até lá: o tempo de espera.
        final boolean dono = podeTrancar();
        // Avisar primeiro a página (registo, e um jogo deixado aberto volta ao início), depois apagar.
        avisarPagina(dono ? "lock" : "tempo");
        relogioBrilho.postDelayed(() -> {
            if (!emPrimeiroPlano || (aCarregar && !APAGAR_NO_CARREGADOR)) return;
            if (dono) {
                try {
                    dpm().lockNow();
                    Log.i("MAE", "sossego: ecrã apagado (lockNow)");
                    return;
                } catch (Exception e) {
                    Log.e("MAE", "lockNow recusado, usa-se o tempo de espera do ecrã", e);
                }
            }
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            semManterLigado = true;
            Log.i("MAE", "sossego: pedido de manter o ecrã ligado largado");
        }, 700);
    }

    private boolean podeTrancar() {
        try {
            return ehDono() && dpm().hasGrantedPolicy(admin(), android.app.admin.DeviceAdminInfo.USES_POLICY_FORCE_LOCK);
        } catch (Exception e) {
            return false;   // não é administrador ativo: o caminho do tempo de espera
        }
    }

    private void avisarPagina(String modo) {
        try {
            PluginHandle h = getBridge() == null ? null : getBridge().getPlugin("Quiosque");
            if (h != null) ((Quiosque) h.getInstance()).ecraApagado(modo);
        } catch (Exception e) {
            Log.e("MAE", "evento de ecrã apagado não enviado", e);
        }
    }

    // ACTION_BATTERY_CHANGED fica guardado pelo sistema: ao registar recebe-se logo o estado atual.
    private void vigiarCarga() {
        Intent atual = ContextCompat.registerReceiver(this, bateria,
            new IntentFilter(Intent.ACTION_BATTERY_CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED);
        if (atual != null) aCarregar = atual.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0;
    }

    private void mudouCarga(Intent i) {
        boolean agora = i.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0;
        if (agora == aCarregar) return;
        aCarregar = agora;
        Log.i("MAE", agora ? "carregador ligado" : "carregador desligado");
        if (agora) {
            // Posto a carregar enquanto se esperava pelo tempo do Android: voltar a escurecer, nunca apagar
            // (só quando APAGAR_NO_CARREGADOR é false).
            if (semManterLigado && !APAGAR_NO_CARREGADOR) {
                manterLigado();
                if (emPrimeiroPlano) definirBrilho(0.02f);
            }
        } else {
            // Tirado do carregador: os 10 minutos recomeçam (um ecrã escurecido fica escuro até lá).
            contarInatividade();
        }
    }

    // Só para testes no emulador: um tempo de sossego mais curto, de um ficheiro que o PC escreve com
    //   adb shell run-as pt.mae.jogos sh -c "echo 60000 > files/quieto_ms"
    // (o run-as só funciona numa app de depuração). Sem o ficheiro: 10 minutos.
    private void lerQuietoTeste() {
        quietoMs = QUIETO_PADRAO;
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) == 0) return;
        java.io.File f = new java.io.File(getFilesDir(), "quieto_ms");
        if (!f.isFile()) return;
        try {
            byte[] b = java.nio.file.Files.readAllBytes(f.toPath());
            long v = Long.parseLong(new String(b, java.nio.charset.StandardCharsets.US_ASCII).trim());
            if (v >= 10000 && v <= QUIETO_PADRAO) quietoMs = v;
            Log.i("MAE", "tempo de sossego de teste: " + quietoMs + " ms");
        } catch (Exception e) {
            // Ficam os 10 minutos.
        }
    }

    @Override
    public void onDestroy() {
        relogioBrilho.removeCallbacksAndMessages(null);
        try { unregisterReceiver(bateria); } catch (Exception e) { /* não estava registado*/ }
        super.onDestroy();
    }

    @Override
    public boolean dispatchTouchEvent(android.view.MotionEvent ev) {
        contarInatividade();
        manterLigado();
        int acao = ev.getActionMasked();
        if (acao == android.view.MotionEvent.ACTION_DOWN && escuro) {
            definirBrilho(WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE);
            engolirGesto = true;
        }
        if (engolirGesto) {
            if (acao == android.view.MotionEvent.ACTION_UP || acao == android.view.MotionEvent.ACTION_CANCEL) engolirGesto = false;
            return true;
        }
        return super.dispatchTouchEvent(ev);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) esconderBarras();
    }

    // Ecrã inteiro: as barras de estado e de navegação escondidas, só voltam com um deslize de propósito.
    // Em modo quiosque o Android desliga também os botões dessas barras.
    private void esconderBarras() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    // Depois de cada instalação de um APK novo, esvaziar a cache HTTP do WebView, para os estilos e os
    // scripts novos carregarem em vez das cópias antigas. O progresso guardado (localStorage) não é tocado.
    private void limparCacheSeAtualizada() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            SharedPreferences prefs = getSharedPreferences("mae", MODE_PRIVATE);
            if (prefs.getLong("instalada", 0) != info.lastUpdateTime) {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().clearCache(true);
                    getBridge().reload();
                }
                prefs.edit().putLong("instalada", info.lastUpdateTime).apply();
            }
        } catch (Exception e) {
            // Nunca parar a app por causa de uma limpeza de cache.
        }
    }

    // ---- Modo quiosque (só quando a app é dona do aparelho, o que se faz uma vez por USB) ----

    private DevicePolicyManager dpm() {
        return (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
    }

    private ComponentName admin() {
        return new ComponentName(this, Admin.class);
    }

    boolean ehDono() {
        return dpm().isDeviceOwnerApp(getPackageName());
    }

    boolean estaBloqueado() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        return am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }

    // A pausa mede-se no relógio que conta o tempo desde o arranque (SystemClock.elapsedRealtime),
    // nunca no relógio da parede: a data do tablet pode saltar quando acerta a hora depois de ficar sem
    // bateria, e um salto para trás deixá-lo-ia desbloqueado durante horas. Um reinício acaba com
    // qualquer pausa: o prazo fica preso à contagem de arranques (Settings.Global.BOOT_COUNT, API 24),
    // por isso um prazo de um arranque anterior nunca vale.
    private int arranque() {
        try {
            return Settings.Global.getInt(getContentResolver(), Settings.Global.BOOT_COUNT);
        } catch (Settings.SettingNotFoundException e) {
            return 0;
        }
    }

    // Milissegundos de pausa que faltam; 0 ou menos quando está bloqueado.
    long pausaRestante() {
        SharedPreferences p = getSharedPreferences("mae", MODE_PRIVATE);
        if (p.getInt("pausaArranque", -1) != arranque()) return 0;
        return p.getLong("pausaAteRelogio", 0) - SystemClock.elapsedRealtime();
    }

    // Para o ecrã da família: a hora de parede em que a pausa acaba, 0 quando não há pausa.
    long pausaAte() {
        long resta = pausaRestante();
        return resta > 0 ? System.currentTimeMillis() + resta : 0;
    }

    // Pode bloquear-se a si própria, sem botões do sistema, avisos nem barra de estado enquanto está
    // bloqueada, e a app é o ecrã inicial do tablet, por isso um reinício abre direto nela.
    private void configurarQuiosque() {
        if (!ehDono()) return;
        try {
            dpm().setLockTaskPackages(admin(), new String[] { getPackageName() });
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                dpm().setLockTaskFeatures(admin(), DevicePolicyManager.LOCK_TASK_FEATURE_NONE);
            }
            IntentFilter casa = new IntentFilter(Intent.ACTION_MAIN);
            casa.addCategory(Intent.CATEGORY_HOME);
            casa.addCategory(Intent.CATEGORY_DEFAULT);
            dpm().addPersistentPreferredActivity(admin(), casa, new ComponentName(this, MainActivity.class));
            dpm().setKeyguardDisabled(admin(), true);
            Log.i("MAE", "quiosque configurado: " + java.util.Arrays.toString(dpm().getLockTaskPackages(admin())));
        } catch (Exception e) {
            // Sem isto a app funciona na mesma, como uma app normal.
            Log.e("MAE", "a configuração do quiosque falhou", e);
        }
    }

    // O startLockTask() pode ser ignorado sem dar erro (a atividade ainda não está à frente, há um
    // diálogo do sistema por cima). Cada tentativa é conferida uns segundos depois e repetida com um
    // atraso cada vez maior, até um minuto, até a tarefa ficar bloqueada.
    private int tentativas = 0;

    private void bloquearSeDevido() {
        if (!ehDono()) return;
        relogio.removeCallbacksAndMessages(null);
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        if (am.getLockTaskModeState() == ActivityManager.LOCK_TASK_MODE_LOCKED) {
            tentativas = 0;
            return;
        }
        long resta = pausaRestante();
        if (resta > 0) {
            relogio.postDelayed(this::bloquearSeDevido, resta + 500);
            return;
        }
        if (!emPrimeiroPlano) {
            // A pausa acabou com a família nas Definições ou na página de entrada do Wi-Fi: voltar para a
            // frente (permitido a partir do fundo porque a app é dona do aparelho), e depois o onResume
            // bloqueia. Repete-se para o caso de o arranque ser recusado.
            try {
                Intent eu = new Intent(this, MainActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                startActivity(eu);
            } catch (Exception e) {
                Log.e("MAE", "trazer para a frente falhou", e);
            }
            relogio.postDelayed(this::bloquearSeDevido, 30000);
            return;
        }
        // Fixado (a fixação de ecrã simples) é mais fraco do que bloqueado: entrar outra vez como quiosque a sério.
        if (am.getLockTaskModeState() == ActivityManager.LOCK_TASK_MODE_PINNED) {
            try { stopLockTask(); } catch (Exception e) { Log.e("MAE", "desafixar falhou", e); }
        }
        try {
            startLockTask();
        } catch (Exception e) {
            Log.e("MAE", "startLockTask falhou", e);
        }
        long espera = Math.min(60000L, 3000L << Math.min(tentativas, 5));
        tentativas++;
        relogio.postDelayed(this::bloquearSeDevido, espera);
    }

    // Ecrã da família: desbloquear por um bocado (página de entrada do Wi-Fi de um hospital, definições).
    void pausar(int minutos) {
        getSharedPreferences("mae", MODE_PRIVATE).edit()
            .putLong("pausaAteRelogio", SystemClock.elapsedRealtime() + minutos * 60000L)
            .putInt("pausaArranque", arranque())
            .remove("pausaAte")
            .apply();
        try {
            if (estaBloqueado()) stopLockTask();
        } catch (Exception e) {
            // Já está desbloqueado.
        }
        relogio.removeCallbacksAndMessages(null);
        relogio.postDelayed(this::bloquearSeDevido, minutos * 60000L + 500);
    }

    // Ecrã da família, depois de duas confirmações: deixar de ser dona do aparelho, para o tablet voltar
    // a ser um tablet normal sem reposição de fábrica (desde a 0.4.0 o APK não é testOnly, por isso o
    // dpm remove-active-admin do adb é recusado). Primeiro desfazem-se as definições de quiosque, depois
    // larga-se o lugar de dono.
    boolean desistirDono() {
        if (!ehDono()) return false;
        relogio.removeCallbacksAndMessages(null);
        try { if (estaBloqueado()) stopLockTask(); } catch (Exception e) { Log.e("MAE", "desbloquear falhou", e); }
        try {
            dpm().clearPackagePersistentPreferredActivities(admin(), getPackageName());
            dpm().setLockTaskPackages(admin(), new String[0]);
            dpm().setKeyguardDisabled(admin(), false);
        } catch (Exception e) {
            Log.e("MAE", "as definições de quiosque não foram desfeitas", e);
        }
        try {
            dpm().clearDeviceOwnerApp(getPackageName());
        } catch (Exception e) {
            Log.e("MAE", "clearDeviceOwnerApp falhou", e);
            return false;
        }
        Log.w("MAE", "lugar de dono do aparelho largado a partir do ecrã da família");
        return !ehDono();
    }

    void retomar() {
        getSharedPreferences("mae", MODE_PRIVATE).edit()
            .remove("pausaAteRelogio").remove("pausaArranque").remove("pausaAte").apply();
        tentativas = 0;
        bloquearSeDevido();
    }
}
