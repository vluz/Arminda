package pt.mae.jogos;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.json.JSONArray;
import org.json.JSONObject;

// Atualizações pela internet, de três tipos, com um só manifesto (GET <servidor>/api/versao, publico/versao.json):
//   { "bundle": { "versao", "ficheiro", "sha256", "assinatura", "nativo_minimo" },
//     "apk":    { "versionCode", "ficheiro", "sha256", "assinatura" },
//     "media":  { "versao", "base", "ficheiro", "sha256", "assinatura", "bytes", "bytes_descomprimidos",
//                 "anteriores": [ pacotes anteriores, com os mesmos campos ] } }
// Cada ficheiro tem de bater certo com o seu sha256 e com uma assinatura ECDSA P-256 / SHA-256 dos
// seus bytes, feita com a chave privada da família (a chave pública está abaixo). Tudo o resto é
// recusado e a versão atual fica.
//
// Pacote web: descarregado (pode retomar-se) para files/descargas, conferido, descomprimido para
// files/bundles/<n>, e depois servido em vez dos ficheiros que vêm na app, pelo caminho base do
// servidor do Capacitor (guardado em "CapWebViewSettings", que o Capacitor limpa sozinho depois de
// uma atualização do APK). A troca só acontece quando a página diz que é um momento seguro (aplicar)
// ou no arranque seguinte. O pacote novo fica à experiência até a página dele chamar ok() com a sua
// própria versão; sem isso em 60 s, ou se a app reiniciar durante a experiência, volta o pacote
// anterior (ou os ficheiros que vêm na app) e essa versão nunca mais é tentada. Ficam no disco no
// máximo dois pacotes.
//
// APK: descarregado e conferido da mesma maneira, com o nome do pacote e o versionCode lidos do
// próprio ficheiro, e depois instalado com o PackageInstaller quando a página diz que é um momento
// seguro. Como dona do aparelho, a instalação faz-se sem perguntas (documentação do PackageInstaller);
// o próprio Android recusa um APK assinado com outra chave.
//
// Pacote de media: conteúdos da família, incrementais (Media.java). O pacote n aplica-se por cima do
// pacote n-1 ("base"); o tablet escolhe, entre "media" e os seus "anteriores", o pacote cuja base é a
// versão que tem, e assim apanha um pacote de cada vez. O espaço livre no cartão é conferido antes da
// descarga; o pacote é descomprimido ao lado da pasta de media, e entra num momento seguro ou no
// arranque seguinte.
//
// A página comanda os momentos: verificar({bundle}), aplicar(), ok({bundle}), estado(), eventos().
// Os eventos (só números e códigos fixos) ficam aqui em fila e são entregues à página para o metricas.js.
@CapacitorPlugin(name = "Atualizar")
public class Atualizar extends Plugin {

    static final String TAG = "MAE";
    static final String PREFS = "atualizar";

    // Metade pública da chave em <kit>/.SECRETS/atualizacoes (X.509 SubjectPublicKeyInfo, DER, base64).
    private static final String CHAVE_PUBLICA =
        "";   // passo 11 do kit: colar aqui a chave pública em base64 feita lá

    private static final long PROVA_MS = 60000L;
    private static final long MAX_MANIFESTO = 64 * 1024L;
    private static final long MAX_BUNDLE = 150L * 1024 * 1024;
    private static final long MAX_APK = 150L * 1024 * 1024;
    private static final long MAX_DESCOMPRIMIDO = 400L * 1024 * 1024;
    private static final long MAX_MEDIA = 500L * 1024 * 1024;
    private static final int MAX_ENTRADAS = 20000;
    private static final int LIMITE_LIGACAO = 15000;
    private static final int LIMITE_LEITURA = 30000;
    private static final int MAX_TENTATIVAS_APK = 3;          // instalações falhadas até se largar o ficheiro
    private static final long ESPERA_APK = 60 * 60000L;       // espera entre duas tentativas de instalar

    private static final ExecutorService trabalho = Executors.newSingleThreadExecutor();
    private static volatile boolean aVerificar = false;
    private final Handler relogio = new Handler(Looper.getMainLooper());
    private final Runnable vigiaProva = this::fimDaProva;

    // ---------------------------------------------------------------------------------------
    // Estado (SharedPreferences "atualizar"):
    //   codigo        versionCode a que o estado pertence (uma atualização do APK recomeça tudo)
    //   ativo         pacote web descarregado que está a ser servido, 0 = ficheiros que vêm na app
    //   anterior      pacote a que se volta, 0 = ficheiros que vêm na app
    //   pendente      pacote conferido à espera de um momento seguro, 0 = nenhum
    //   prova         pacote à experiência (ainda não confirmado pela sua página), 0 = nenhum
    //   recusados     ",3,5," versões que falharam a experiência: nunca mais são tentadas
    //   nativoAvisado última versão de pacote recusada por nativo_minimo (registada uma vez)
    //   apkFicheiro, apkVersao   APK conferido à espera de um momento seguro
    //   apkTentativas, apkEspera instalações falhadas deste APK, e a hora a partir da qual se tenta outra vez
    //   mediaPendente pacote de media conferido e descomprimido em <media>/.novo, à espera (fica de uma
    //                 atualização do APK para a outra)
    //   mediaAvisado  última versão de media recusada por espaço ou por base (registada uma vez)
    //   eventos       lista JSON de eventos ainda não entregues à página
    //   verificadoEm, resultado  última verificação, para o ecrã da família
    // ---------------------------------------------------------------------------------------

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static File pastaBundles(Context c) {
        return new File(c.getFilesDir(), "bundles");
    }

    static File pastaBundle(Context c, int n) {
        return new File(pastaBundles(c), Integer.toString(n));
    }

    static File pastaDescargas(Context c) {
        return new File(c.getFilesDir(), "descargas");
    }

    static long codigoInstalado(Context c) {
        try {
            PackageInfo p = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    static synchronized void juntarEvento(Context c, String tipo, JSONObject dados) {
        try {
            SharedPreferences p = prefs(c);
            JSONArray a = new JSONArray(p.getString("eventos", "[]"));
            dados.put("tipo", tipo);
            a.put(dados);
            // Nunca deixar a fila crescer sem limite se a página nunca a vier buscar.
            while (a.length() > 50) a.remove(0);
            p.edit().putString("eventos", a.toString()).commit();
        } catch (Exception e) {
            Log.e(TAG, "atualização: evento não entrou na fila", e);
        }
    }

    static JSONObject obj(Object... kv) {
        JSONObject o = new JSONObject();
        try {
            for (int i = 0; i + 1 < kv.length; i += 2) o.put((String) kv[i], kv[i + 1]);
        } catch (Exception e) {
            // Só se usam chaves fixas.
        }
        return o;
    }

    // Escreve o caminho do servidor que o Capacitor guarda, para o pacote dado (0 = ficheiros que vêm na app).
    static void caminhoCapacitor(Context c, int n) {
        String caminho = n > 0 ? pastaBundle(c, n).getAbsolutePath() : "";
        c.getSharedPreferences(com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME, Activity.MODE_PRIVATE)
            .edit().putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, caminho).commit();
    }

    static boolean recusado(SharedPreferences p, int n) {
        return p.getString("recusados", ",").contains("," + n + ",");
    }

    static boolean bundleUtilizavel(Context c, int n) {
        return n > 0 && new File(pastaBundle(c, n), "index.html").isFile();
    }

    static void apagar(File f) {
        if (f == null || !f.exists()) return;
        File[] filhos = f.isDirectory() ? f.listFiles() : null;
        if (filhos != null) for (File x : filhos) apagar(x);
        if (!f.delete()) Log.w(TAG, "não se conseguiu apagar " + f.getName());
    }

    // Volta do pacote à experiência para o anterior. Devolve o pacote que fica ativo.
    static int reverter(Context c) {
        SharedPreferences p = prefs(c);
        int prova = p.getInt("prova", 0);
        int anterior = p.getInt("anterior", 0);
        if (!bundleUtilizavel(c, anterior)) anterior = 0;
        p.edit()
            .putInt("ativo", anterior)
            .putInt("anterior", 0)
            .putInt("prova", 0)
            .putInt("provaArranques", 0)
            .putString("recusados", p.getString("recusados", ",") + prova + ",")
            .commit();
        caminhoCapacitor(c, anterior);
        apagar(pastaBundle(c, prova));
        juntarEvento(c, "atualizacao_revertida", obj("versao", prova));
        Log.w(TAG, "atualização: o pacote web " + prova + " não confirmou, volta-se ao " + anterior);
        return anterior;
    }

    // Chamado pela MainActivity antes de super.onCreate, para a Bridge ler o caminho certo do servidor.
    // Devolve verdadeiro quando o pacote servido desta vez é diferente do servido da última vez.
    static boolean antesDeArrancar(Context c) {
        try {
            // Um arranque também é um momento seguro para um pacote de media à espera (mover ficheiros e
            // escrever o manifesto uma vez).
            Media.aplicar(c);
            Media.limparPreparacao(c);
        } catch (Exception e) {
            Log.e(TAG, "media: a verificação de arranque falhou", e);
        }
        try {
            SharedPreferences p = prefs(c);
            long codigo = codigoInstalado(c);
            long antigo = p.getLong("codigo", 0);
            if (antigo != codigo) {
                // Um APK novo (ou o primeiro arranque desta função): traz os seus próprios ficheiros web, e o
                // Capacitor larga sozinho o caminho de servidor guardado. Começar do limpo.
                String eventos = p.getString("eventos", "[]");
                // Um pacote de media à espera no cartão não depende do APK: fica.
                int mediaPendente = p.getInt("mediaPendente", 0);
                p.edit().clear().putLong("codigo", codigo).putString("eventos", eventos)
                    .putInt("mediaPendente", mediaPendente).commit();
                apagar(pastaBundles(c));
                apagar(pastaDescargas(c));
                apagar(new File(c.getFilesDir(), "apk"));
                caminhoCapacitor(c, 0);
                if (antigo > 0) juntarEvento(c, "atualizacao_aplicada", obj("kind", "apk", "versao", codigo));
                Log.i(TAG, "atualização: nativo " + antigo + " -> " + codigo);
                return antigo > 0;
            }
            int prova = p.getInt("prova", 0);
            if (prova > 0) {
                // A app reiniciou com um pacote à experiência: nunca chegou a confirmar. Voltar atrás.
                reverter(c);
                return true;
            }
            int pendente = p.getInt("pendente", 0);
            if (pendente > 0 && !recusado(p, pendente) && bundleUtilizavel(c, pendente)) {
                // Um arranque é um momento seguro: a pessoa não está num jogo.
                comecarProva(c, pendente, 1);
                return true;
            }
            // Manter o caminho do Capacitor a par do nosso estado (por exemplo depois de limpar um pendente).
            int ativo = p.getInt("ativo", 0);
            if (!bundleUtilizavel(c, ativo)) {
                if (ativo != 0) p.edit().putInt("ativo", 0).commit();
                ativo = 0;
            }
            caminhoCapacitor(c, ativo);
        } catch (Exception e) {
            Log.e(TAG, "atualização: a verificação de arranque falhou", e);
        }
        return false;
    }

    static void comecarProva(Context c, int n, int arranques) {
        SharedPreferences p = prefs(c);
        int ativo = p.getInt("ativo", 0);
        p.edit()
            .putInt("anterior", ativo)
            .putInt("ativo", n)
            .putInt("prova", n)
            .putInt("provaArranques", arranques)
            .putInt("pendente", 0)
            .commit();
        caminhoCapacitor(c, n);
        Log.i(TAG, "atualização: pacote web " + n + " à experiência (anterior " + ativo + ")");
    }

    @Override
    public void load() {
        if (prefs(getContext()).getInt("prova", 0) > 0) {
            relogio.removeCallbacks(vigiaProva);
            relogio.postDelayed(vigiaProva, PROVA_MS);
        }
    }

    @Override
    protected void handleOnDestroy() {
        relogio.removeCallbacks(vigiaProva);
    }

    private void fimDaProva() {
        if (prefs(getContext()).getInt("prova", 0) == 0) return;
        int volta = reverter(getContext());
        servir(volta);
    }

    // Mudar o WebView para um pacote, já (0 = ficheiros que vêm na app). Na thread principal.
    private void servir(int n) {
        try {
            if (getBridge().getWebView() != null) getBridge().getWebView().clearCache(true);
            if (n > 0) getBridge().setServerBasePath(pastaBundle(getContext(), n).getAbsolutePath());
            else getBridge().setServerAssetPath("public");
        } catch (Exception e) {
            Log.e(TAG, "atualização: a troca dos ficheiros web falhou", e);
        }
    }

    // ---- Métodos para a página ----

    @PluginMethod
    public void estado(PluginCall call) {
        SharedPreferences p = prefs(getContext());
        JSObject r = new JSObject();
        r.put("ativo", p.getInt("ativo", 0));
        r.put("pendente", p.getInt("pendente", 0));
        r.put("prova", p.getInt("prova", 0));
        r.put("apkPendente", p.getInt("apkVersao", 0));
        r.put("mediaVersao", Media.versaoAtual(getContext()));
        r.put("mediaPendente", p.getInt("mediaPendente", 0));
        r.put("versionCode", codigoInstalado(getContext()));
        try {
            r.put("versionName", getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0).versionName);
        } catch (Exception e) {
            r.put("versionName", "");
        }
        r.put("verificadoEm", p.getLong("verificadoEm", 0));
        r.put("resultado", p.getString("resultado", ""));
        r.put("aVerificar", aVerificar);
        call.resolve(r);
    }

    @PluginMethod
    public void eventos(PluginCall call) {
        JSObject r = new JSObject();
        synchronized (Atualizar.class) {
            SharedPreferences p = prefs(getContext());
            try {
                r.put("eventos", new JSArray(p.getString("eventos", "[]")));
            } catch (Exception e) {
                r.put("eventos", new JSArray());
            }
            p.edit().putString("eventos", "[]").commit();
        }
        call.resolve(r);
    }

    // A página desenhou o seu ecrã inicial. bundle: a versão escrita no código dela.
    @PluginMethod
    public void ok(PluginCall call) {
        int bundle = call.getInt("bundle", -1);
        Context c = getContext();
        SharedPreferences p = prefs(c);
        int prova = p.getInt("prova", 0);
        JSObject r = new JSObject();
        if (prova > 0 && bundle == prova) {
            relogio.removeCallbacks(vigiaProva);
            int ativo = p.getInt("ativo", 0);
            int anterior = p.getInt("anterior", 0);
            p.edit().putInt("prova", 0).putInt("provaArranques", 0).commit();
            juntarEvento(c, "atualizacao_aplicada", obj("kind", "bundle", "versao", prova));
            // Ficam o pacote ativo e o anterior; mais nada.
            File[] todas = pastaBundles(c).listFiles();
            if (todas != null) {
                for (File f : todas) {
                    if (!f.getName().equals(Integer.toString(ativo)) && !f.getName().equals(Integer.toString(anterior))) apagar(f);
                }
            }
            Log.i(TAG, "atualização: pacote web " + prova + " confirmado");
            r.put("confirmado", true);
        } else {
            r.put("confirmado", false);
        }
        call.resolve(r);
    }

    // Pergunta ao servidor o que há de novo e descarrega-o. Só usa a rede quando é anunciado algo
    // mais novo. Resolve com { resultado, tem_bundle, tem_apk, pronto_bundle, pronto_apk }.
    @PluginMethod
    public void verificar(PluginCall call) {
        int correnteBundle = call.getInt("bundle", 0);
        if (aVerificar) {
            JSObject r = new JSObject();
            r.put("resultado", "ocupado");
            call.resolve(r);
            return;
        }
        aVerificar = true;
        trabalho.execute(() -> {
            JSObject r = new JSObject();
            try {
                r = verificarAgora(correnteBundle);
            } catch (GrandeDemais e) {
                Log.w(TAG, "atualização: um ficheiro publicado passa o limite de tamanho");
                juntarEvento(getContext(), "atualizacao_recusada", obj("kind", "descarga", "motivo", "tamanho"));
                r.put("resultado", "recusado");
            } catch (Exception e) {
                Log.w(TAG, "atualização: a verificação falhou: " + e.getClass().getSimpleName());
                r.put("resultado", "sem_ligacao");
            } finally {
                aVerificar = false;
            }
            SharedPreferences p = prefs(getContext());
            p.edit().putLong("verificadoEm", System.currentTimeMillis()).putString("resultado", r.getString("resultado", "")).apply();
            r.put("pronto_bundle", p.getInt("pendente", 0));
            r.put("pronto_apk", p.getInt("apkVersao", 0));
            r.put("pronto_media", p.getInt("mediaPendente", 0));
            call.resolve(r);
        });
    }

    // Mudar já para o que está pronto: a página só chama isto num momento seguro.
    // Primeiro um pacote de media (sem recarregar), depois um pacote web; um APK só quando não há
    // pacote web à espera.
    // Resolve com { aplicado: "bundle" | "apk" | "media" | "", media: versão aplicada ou 0 }.
    @PluginMethod
    public void aplicar(PluginCall call) {
        Context c = getContext();
        SharedPreferences p = prefs(c);
        int pendente = p.getInt("pendente", 0);
        JSObject r = new JSObject();
        int media = 0;
        try {
            media = Media.aplicar(c);
        } catch (Exception e) {
            Log.e(TAG, "media: a aplicação falhou", e);
        }
        r.put("media", media);
        if (p.getInt("prova", 0) == 0 && pendente > 0 && !recusado(p, pendente) && bundleUtilizavel(c, pendente)) {
            comecarProva(c, pendente, 1);
            r.put("aplicado", "bundle");
            call.resolve(r);
            getActivity().runOnUiThread(() -> {
                relogio.removeCallbacks(vigiaProva);
                relogio.postDelayed(vigiaProva, PROVA_MS);
                servir(pendente);
            });
            return;
        }
        String apk = p.getString("apkFicheiro", "");
        // Depois de uma instalação falhada espera-se antes de tentar outra vez (falhouInstalacao).
        boolean apkPodeIr = System.currentTimeMillis() >= p.getLong("apkEspera", 0);
        if (p.getInt("prova", 0) == 0 && apkPodeIr && !apk.isEmpty() && new File(apk).isFile()) {
            r.put("aplicado", "apk");
            call.resolve(r);
            trabalho.execute(() -> instalarApk(new File(apk), p.getInt("apkVersao", 0)));
            return;
        }
        r.put("aplicado", media > 0 ? "media" : "");
        call.resolve(r);
    }

    // ---- Trabalho (thread de fundo) ----

    private JSONObject lerConfig() throws Exception {
        File f = new File(getContext().getExternalFilesDir(null), "config.json");
        if (!f.isFile() || f.length() > 16384) return null;
        return new JSONObject(new String(lerTudo(new FileInputStream(f), 16384), StandardCharsets.UTF_8));
    }

    private JSObject verificarAgora(int correnteBundle) throws Exception {
        Context c = getContext();
        SharedPreferences p = prefs(c);
        JSObject r = new JSObject();
        JSONObject cfg = lerConfig();
        String servidor = cfg == null ? "" : cfg.optString("servidor", "");
        String token = cfg == null ? "" : cfg.optString("token", "");
        if (servidor.isEmpty() || token.isEmpty() || !servidor.startsWith("https://") && !servidor.startsWith("http://10.0.2.2")) {
            r.put("resultado", "sem_config");
            return r;
        }
        // Uma construção sem a chave pública da família não consegue conferir nada: nem descarrega.
        if (CHAVE_PUBLICA.isEmpty()) {
            r.put("resultado", "sem_chave");
            return r;
        }
        while (servidor.endsWith("/")) servidor = servidor.substring(0, servidor.length() - 1);

        HttpURLConnection con = abrir(servidor + "/api/versao", token, 0);
        int estado = con.getResponseCode();
        if (estado != 200) {
            con.disconnect();
            r.put("resultado", "servidor_" + estado);
            return r;
        }
        JSONObject m;
        try (InputStream in = con.getInputStream()) {
            m = new JSONObject(new String(lerTudo(in, MAX_MANIFESTO), StandardCharsets.UTF_8));
        } finally {
            con.disconnect();
        }

        long codigo = codigoInstalado(c);
        int ativo = Math.max(correnteBundle, p.getInt("ativo", 0));
        JSONObject b = m.optJSONObject("bundle");
        JSONObject a = m.optJSONObject("apk");
        int bv = b == null ? 0 : b.optInt("versao", 0);
        long av = a == null ? 0 : a.optLong("versionCode", 0);
        boolean temBundle = bv > ativo && bv > p.getInt("prova", 0) && !recusado(p, bv);
        boolean temApk = av > codigo;
        r.put("tem_bundle", temBundle);
        r.put("tem_apk", temApk);
        String resultado = "nada_novo";

        if (temBundle) {
            if (b.optLong("nativo_minimo", 0) > codigo) {
                if (p.getInt("nativoAvisado", 0) != bv) {
                    juntarEvento(c, "atualizacao_recusada", obj("kind", "bundle", "versao", bv, "motivo", "nativo"));
                    p.edit().putInt("nativoAvisado", bv).commit();
                }
                resultado = "precisa_apk";
            } else if (p.getInt("pendente", 0) == bv && bundleUtilizavel(c, bv)) {
                resultado = "pronto";
            } else {
                resultado = obterBundle(servidor, token, b, bv);
            }
        }
        // O APK só depois de o pacote web correr bem (ou de não haver nenhum): uma descarga por visita
        // tem mais hipóteses de acabar em poucos minutos de hotspot.
        boolean bundleBem = resultado.equals("nada_novo") || resultado.equals("precisa_apk") || resultado.equals("pronto");
        if (temApk && bundleBem) {
            String ra;
            if (p.getInt("apkVersao", 0) == av && new File(p.getString("apkFicheiro", "")).isFile()) ra = "pronto";
            else ra = obterApk(servidor, token, a, av);
            // "pronto" se alguma coisa ficou pronta; senão, o que correu mal com o APK.
            if (!resultado.equals("pronto")) resultado = ra;
        }

        // A media no fim: é a descarga maior, e a que menos importa se esperar por outra visita.
        JSONObject md = m.optJSONObject("media");
        int mediaTem = Math.max(Media.versaoAtual(c), p.getInt("mediaPendente", 0));
        boolean temMedia = md != null && md.optInt("versao", 0) > mediaTem;
        r.put("tem_media", temMedia);
        boolean antesBem = resultado.equals("nada_novo") || resultado.equals("precisa_apk") || resultado.equals("pronto");
        if (temMedia && antesBem) {
            String rm;
            if (p.getInt("mediaPendente", 0) > 0) {
                rm = "pronto";   // um pacote de cada vez: o seguinte vem depois de este ser aplicado
            } else {
                JSONObject escolhido = escolherMedia(md, mediaTem);
                if (escolhido == null) {
                    avisarMedia(c, md.optInt("versao", 0), "base");
                    rm = "media_sem_base";
                } else {
                    rm = obterMedia(servidor, token, escolhido, mediaTem);
                }
            }
            if (!resultado.equals("pronto")) resultado = rm;
        }
        r.put("resultado", resultado);
        return r;
    }

    // O pacote que continua da versão que o tablet tem: o mais novo ou um anterior.
    static JSONObject escolherMedia(JSONObject md, int tem) {
        if (md.optInt("base", -1) == tem) return md;
        JSONArray ant = md.optJSONArray("anteriores");
        if (ant == null) return null;
        for (int i = 0; i < ant.length(); i++) {
            JSONObject x = ant.optJSONObject(i);
            if (x != null && x.optInt("base", -1) == tem && x.optInt("versao", 0) > tem) return x;
        }
        return null;
    }

    // Uma recusa que se repetiria em cada verificação é registada uma vez por versão.
    static void avisarMedia(Context c, int versao, String motivo) {
        SharedPreferences p = prefs(c);
        String marca = versao + ":" + motivo;
        if (marca.equals(p.getString("mediaAvisado", ""))) return;
        p.edit().putString("mediaAvisado", marca).commit();
        juntarEvento(c, "atualizacao_recusada", obj("kind", "media", "versao", versao, "motivo", motivo));
    }

    private String obterMedia(String servidor, String token, JSONObject a, int tem) throws Exception {
        Context c = getContext();
        int versao = a.optInt("versao", 0);
        String nome = nomeSeguro(a.optString("ficheiro", null));
        String sha = a.optString("sha256", "").toLowerCase(java.util.Locale.ROOT);
        String assinatura = a.optString("assinatura", "");
        long bytes = a.optLong("bytes", 0);
        long desc = a.optLong("bytes_descomprimidos", 0);
        if (nome == null || !sha.matches("[0-9a-f]{64}") || versao <= tem) return "manifesto_invalido";
        if (bytes > MAX_MEDIA || desc > Media.MAX_DESCOMPRIMIDO) {
            avisarMedia(c, versao, "tamanho");
            return "recusado";
        }
        if (shaRecusado(c, sha)) return "recusado";
        // Espaço para a descarga (memória interna) e para os ficheiros descomprimidos (o cartão), com folga.
        File parte = new File(pastaDescargas(c), sha + ".part");
        long jaTem = parte.isFile() ? parte.length() : 0;
        long livreInterno = Media.livre(c.getFilesDir());
        long livreCartao = Media.livre(Media.raizFicheiros(c));
        long falta = bytes - jaTem;
        // Sem cartão de memória o zip e os ficheiros descomprimidos gastam a mesma memória, ao mesmo
        // tempo: as duas contas somam-se.
        boolean cabe = Media.mesmoVolume(c)
            ? livreInterno < 0 || livreInterno >= falta + desc + Media.FOLGA
            : (livreInterno < 0 || livreInterno >= falta + Media.FOLGA) && (livreCartao < 0 || livreCartao >= desc + Media.FOLGA);
        if (!cabe) {
            Log.w(TAG, "atualização: a media " + versao + " precisa de mais espaço livre");
            avisarMedia(c, versao, "espaco");
            return "sem_espaco";
        }
        File zip = descarregar(servidor, token, nome, sha, MAX_MEDIA);
        if (zip == null) return "sem_ligacao";
        String motivo = verificarFicheiro(zip, sha, assinatura);
        if (motivo != null) {
            apagar(zip);
            if ("assinatura".equals(motivo)) lembrarRecusado(c, sha);
            juntarEvento(c, "atualizacao_recusada", obj("kind", "media", "versao", versao, "motivo", motivo));
            return "recusado";
        }
        juntarEvento(c, "atualizacao_descarregada", obj("kind", "media", "versao", versao, "bytes", zip.length()));
        String erro;
        synchronized (Media.class) {
            erro = Media.preparar(c, zip, versao, a.optInt("base", -1));
            if (erro == null) prefs(c).edit().putInt("mediaPendente", versao).commit();
        }
        apagar(zip);
        if (erro != null) {
            // Um pacote que não se descomprime bem não é descarregado outra vez; a falta de espaço pode passar.
            if ("zip".equals(erro)) lembrarRecusado(c, sha);
            juntarEvento(c, "atualizacao_recusada", obj("kind", "media", "versao", versao, "motivo", erro));
            return "espaco".equals(erro) ? "sem_espaco" : "recusado";
        }
        Log.i(TAG, "atualização: media " + versao + " pronta");
        return "pronto";
    }

    // Um ficheiro com assinatura má (o sha256 estava certo, por isso chegou inteiro) ou que o Android
    // se recusou a instalar não é descarregado outra vez (os dados do hotspot são preciosos): ao mesmo
    // sha256 responde-se logo "recusado". Um sha256 errado pode ser uma transferência estragada:
    // tenta-se mais tarde.
    static boolean shaRecusado(Context c, String sha) {
        return prefs(c).getString("shasRecusados", "").contains(sha);
    }

    static void lembrarRecusado(Context c, String sha) {
        String antes = prefs(c).getString("shasRecusados", "");
        String depois = antes.isEmpty() ? sha : antes + "," + sha;
        // Os últimos 10 chegam.
        String[] partes = depois.split(",");
        if (partes.length > 10) depois = String.join(",", java.util.Arrays.copyOfRange(partes, partes.length - 10, partes.length));
        prefs(c).edit().putString("shasRecusados", depois).commit();
    }

    private static String nomeSeguro(String ficheiro) {
        // Só caminhos relativos simples dentro de publico/: letras, algarismos, ponto, hífen, traço baixo, barra.
        if (ficheiro == null || ficheiro.isEmpty() || ficheiro.contains("..") || ficheiro.startsWith("/")
            || !ficheiro.matches("[A-Za-z0-9._/-]{1,200}")) return null;
        return ficheiro;
    }

    private String obterBundle(String servidor, String token, JSONObject b, int bv) throws Exception {
        Context c = getContext();
        String nome = nomeSeguro(b.optString("ficheiro", null));
        String sha = b.optString("sha256", "").toLowerCase(java.util.Locale.ROOT);
        String assinatura = b.optString("assinatura", "");
        if (nome == null || !sha.matches("[0-9a-f]{64}")) return "manifesto_invalido";
        if (shaRecusado(c, sha)) return "recusado";
        File zip = descarregar(servidor, token, nome, sha, MAX_BUNDLE);
        if (zip == null) return "sem_ligacao";
        String motivo = verificarFicheiro(zip, sha, assinatura);
        if (motivo != null) {
            apagar(zip);
            if ("assinatura".equals(motivo)) lembrarRecusado(c, sha);
            juntarEvento(c, "atualizacao_recusada", obj("kind", "bundle", "versao", bv, "motivo", motivo));
            return "recusado";
        }
        juntarEvento(c, "atualizacao_descarregada", obj("kind", "bundle", "versao", bv, "bytes", zip.length()));
        File destino = pastaBundle(c, bv);
        File temp = new File(pastaBundles(c), bv + ".novo");
        apagar(temp);
        apagar(destino);
        try {
            descomprimir(zip, temp);
        } catch (Exception e) {
            apagar(temp);
            apagar(zip);
            Log.w(TAG, "atualização: pacote web " + bv + " recusado ao descomprimir: " + e.getMessage());
            juntarEvento(c, "atualizacao_recusada", obj("kind", "bundle", "versao", bv, "motivo", "zip"));
            return "recusado";
        }
        if (!new File(temp, "index.html").isFile() || !temp.renameTo(destino)) {
            apagar(temp);
            apagar(zip);
            juntarEvento(c, "atualizacao_recusada", obj("kind", "bundle", "versao", bv, "motivo", "zip"));
            return "recusado";
        }
        apagar(zip);
        SharedPreferences p = prefs(c);
        int velho = p.getInt("pendente", 0);
        p.edit().putInt("pendente", bv).commit();
        if (velho > 0 && velho != bv && velho != p.getInt("ativo", 0) && velho != p.getInt("anterior", 0)) apagar(pastaBundle(c, velho));
        Log.i(TAG, "atualização: pacote web " + bv + " pronto");
        return "pronto";
    }

    private String obterApk(String servidor, String token, JSONObject a, long av) throws Exception {
        Context c = getContext();
        String nome = nomeSeguro(a.optString("ficheiro", null));
        String sha = a.optString("sha256", "").toLowerCase(java.util.Locale.ROOT);
        String assinatura = a.optString("assinatura", "");
        if (nome == null || !sha.matches("[0-9a-f]{64}")) return "manifesto_invalido";
        if (shaRecusado(c, sha)) return "recusado";
        File f = descarregar(servidor, token, nome, sha, MAX_APK);
        if (f == null) return "sem_ligacao";
        String motivo = verificarFicheiro(f, sha, assinatura);
        if (motivo == null) {
            // O próprio ficheiro tem de dizer que é esta app, na versão anunciada.
            PackageInfo info = c.getPackageManager().getPackageArchiveInfo(f.getAbsolutePath(), 0);
            long code = info == null ? -1 : (Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode);
            if (info == null || !c.getPackageName().equals(info.packageName) || code != av) motivo = "apk";
        }
        if (motivo != null) {
            apagar(f);
            if ("assinatura".equals(motivo)) lembrarRecusado(c, sha);
            juntarEvento(c, "atualizacao_recusada", obj("kind", "apk", "versao", av, "motivo", motivo));
            return "recusado";
        }
        File pasta = new File(c.getFilesDir(), "apk");
        apagar(pasta);
        pasta.mkdirs();
        File destino = new File(pasta, av + ".apk");
        if (!f.renameTo(destino)) {
            apagar(f);
            return "erro_disco";
        }
        juntarEvento(c, "atualizacao_descarregada", obj("kind", "apk", "versao", av, "bytes", destino.length()));
        prefs(c).edit().putString("apkFicheiro", destino.getAbsolutePath()).putInt("apkVersao", (int) av).putString("apkSha", sha)
            .remove("apkTentativas").remove("apkEspera").commit();
        Log.i(TAG, "atualização: apk " + av + " pronto");
        return "pronto";
    }

    private HttpURLConnection abrir(String url, String token, long desde) throws IOException {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(LIMITE_LIGACAO);
        con.setReadTimeout(LIMITE_LEITURA);
        con.setInstanceFollowRedirects(false);
        con.setUseCaches(false);
        con.setRequestProperty("Authorization", "Bearer " + token);
        con.setRequestProperty("Accept-Encoding", "identity");
        if (desde > 0) con.setRequestProperty("Range", "bytes=" + desde + "-");
        return con;
    }

    // Um ficheiro maior do que o limite do seu tipo. Tem classe própria para nunca se confundir com
    // uma falha de rede (que se retoma mais tarde).
    static final class GrandeDemais extends IOException {
        GrandeDemais() {
            super("ficheiro grande demais");
        }
    }

    // Descarrega publico/<nome> para files/descargas/<sha256>.part, retomando o que já lá está
    // (Range). Devolve o ficheiro completo, ou null quando a rede desistiu (fica para a próxima vez).
    private File descarregar(String servidor, String token, String nome, String sha, long maximo) throws Exception {
        File pasta = pastaDescargas(getContext());
        if (!pasta.isDirectory() && !pasta.mkdirs()) throw new IOException("sem pasta de descargas");
        File parte = new File(pasta, sha + ".part");
        // Só se guarda uma descarga: um ficheiro incompleto mais antigo, de outra versão, sai.
        File[] outras = pasta.listFiles();
        if (outras != null) for (File o : outras) if (!o.getName().equals(parte.getName())) apagar(o);
        long desde = parte.isFile() ? parte.length() : 0;
        HttpURLConnection con = abrir(servidor + "/api/ficheiros/" + nome, token, desde);
        try {
            int estado = con.getResponseCode();
            Log.i(TAG, "atualização, descarga: " + nome + " a partir do byte " + desde + ", HTTP " + estado);
            boolean anexar;
            if (estado == 206 && desde > 0) {
                anexar = true;
            } else if (estado == 200) {
                anexar = false;
                desde = 0;
            } else if (estado == 416 && desde > 0) {
                // Já está completo (ou o ficheiro mudou no servidor: a conferência do resumo o dirá).
                return parte;
            } else {
                Log.w(TAG, "atualização, descarga: HTTP " + estado);
                return null;
            }
            long total = con.getContentLengthLong();
            if (total > 0 && desde + total > maximo) {
                apagar(parte);
                throw new GrandeDemais();
            }
            byte[] buf = new byte[65536];
            long escritos = desde;
            try (InputStream in = con.getInputStream(); OutputStream out = new FileOutputStream(parte, anexar)) {
                int n;
                while ((n = in.read(buf)) > 0) {
                    escritos += n;
                    if (escritos > maximo) throw new GrandeDemais();
                    out.write(buf, 0, n);
                }
                out.flush();
            } catch (GrandeDemais e) {
                // Não é uma falha de rede: o bocado descarregado sai, e a verificação diz o que foi.
                apagar(parte);
                throw e;
            } catch (IOException e) {
                Log.w(TAG, "atualização: descarga interrompida aos " + parte.length() + " bytes (" + e.getClass().getSimpleName()
                    + "); retoma-se depois");
                return null;
            }
            if (total > 0 && escritos - desde < total) return null;
            return parte;
        } finally {
            con.disconnect();
        }
    }

    // null quando está bem, senão "sha256" ou "assinatura".
    static String verificarFicheiro(File f, String sha, String assinaturaB64) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            Signature s = Signature.getInstance("SHA256withECDSA");
            PublicKey chave = KeyFactory.getInstance("EC").generatePublic(
                new X509EncodedKeySpec(Base64.decode(CHAVE_PUBLICA, Base64.DEFAULT)));
            s.initVerify(chave);
            byte[] buf = new byte[65536];
            try (InputStream in = new FileInputStream(f)) {
                int n;
                while ((n = in.read(buf)) > 0) {
                    md.update(buf, 0, n);
                    s.update(buf, 0, n);
                }
            }
            StringBuilder hex = new StringBuilder();
            for (byte x : md.digest()) hex.append(String.format(java.util.Locale.ROOT, "%02x", x));
            if (!hex.toString().equals(sha)) return "sha256";
            byte[] assinatura;
            try {
                assinatura = Base64.decode(assinaturaB64, Base64.DEFAULT);
            } catch (IllegalArgumentException e) {
                return "assinatura";
            }
            return s.verify(assinatura) ? null : "assinatura";
        } catch (java.security.SignatureException e) {
            return "assinatura";
        } catch (Exception e) {
            Log.e(TAG, "atualização: a conferência falhou", e);
            return "assinatura";
        }
    }

    // Descomprime sem deixar nenhum caminho sair da pasta (zip slip), sem caminhos absolutos, e com
    // limites no número de entradas e no tamanho total.
    static void descomprimir(File zip, File destino) throws IOException {
        descomprimir(zip, destino, MAX_DESCOMPRIMIDO, MAX_ENTRADAS);
    }

    static void descomprimir(File zip, File destino, long maxTotal, int maxEntradas) throws IOException {
        if (!destino.mkdirs() && !destino.isDirectory()) throw new IOException("mkdir");
        String raiz = destino.getCanonicalPath() + File.separator;
        long total = 0;
        int entradas = 0;
        byte[] buf = new byte[65536];
        try (ZipInputStream z = new ZipInputStream(new FileInputStream(zip))) {
            ZipEntry e;
            while ((e = z.getNextEntry()) != null) {
                if (++entradas > maxEntradas) throw new IOException("entradas a mais");
                String nome = e.getName();
                if (nome.startsWith("/") || nome.startsWith("\\") || nome.contains("..") || nome.contains("\\") || nome.indexOf(':') >= 0) {
                    throw new IOException("nome de entrada inválido");
                }
                File f = new File(destino, nome);
                String canon = f.getCanonicalPath();
                if (!canon.startsWith(raiz)) throw new IOException("entrada fora da pasta");
                if (e.isDirectory()) {
                    if (!f.mkdirs() && !f.isDirectory()) throw new IOException("mkdir");
                    continue;
                }
                File pai = f.getParentFile();
                if (pai != null && !pai.isDirectory() && !pai.mkdirs()) throw new IOException("mkdir");
                try (OutputStream out = new FileOutputStream(f)) {
                    int n;
                    while ((n = z.read(buf)) > 0) {
                        total += n;
                        if (total > maxTotal) throw new IOException("grande demais");
                        out.write(buf, 0, n);
                    }
                }
            }
        }
    }

    static byte[] lerTudo(InputStream in, long maximo) throws IOException {
        try (InputStream i = in) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = i.read(buf)) > 0) {
                if (b.size() + n > maximo) throw new IOException("grande demais");
                b.write(buf, 0, n);
            }
            return b.toByteArray();
        }
    }

    // ---- Instalação do APK ----

    private void instalarApk(File apk, int versao) {
        Context c = getContext();
        PackageInstaller pi = c.getPackageManager().getPackageInstaller();
        int id = -1;
        try {
            PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            params.setAppPackageName(c.getPackageName());
            if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
            id = pi.createSession(params);
            try (PackageInstaller.Session s = pi.openSession(id)) {
                try (InputStream in = new FileInputStream(apk); OutputStream out = s.openWrite("base.apk", 0, apk.length())) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    s.fsync(out);
                }
                Intent resposta = new Intent(c, ResultadoInstalacao.class).putExtra("versao", versao);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                PendingIntent pend = PendingIntent.getBroadcast(c, 4242, resposta, flags);
                Log.i(TAG, "atualização: a instalar o apk " + versao);
                s.commit(pend.getIntentSender());
            }
        } catch (Exception e) {
            Log.e(TAG, "atualização: a instalação do apk não arrancou", e);
            if (id >= 0) {
                try { pi.abandonSession(id); } catch (Exception x) { /* já não existe*/ }
            }
            falhouInstalacao(c, versao, -1);
        }
    }

    // Uma instalação falhada, com o código de estado do Android (-1: a sessão nem arrancou).
    // O Android disse que o ficheiro não serve (inválido, incompatível, em conflito com a app
    // instalada): o ficheiro sai e não se descarrega outra vez, porque falharia da mesma maneira.
    // Qualquer outra falha pode passar (memória cheia, sessão interrompida): o ficheiro fica, e
    // tenta-se outra vez depois de ESPERA_APK, até MAX_TENTATIVAS_APK vezes.
    static void falhouInstalacao(Context c, int versao, int estado) {
        SharedPreferences p = prefs(c);
        boolean definitivo = estado == PackageInstaller.STATUS_FAILURE_INVALID
            || estado == PackageInstaller.STATUS_FAILURE_INCOMPATIBLE
            || estado == PackageInstaller.STATUS_FAILURE_CONFLICT;
        int tentativas = p.getInt("apkTentativas", 0) + 1;
        if (!definitivo && tentativas < MAX_TENTATIVAS_APK) {
            p.edit().putInt("apkTentativas", tentativas)
                .putLong("apkEspera", System.currentTimeMillis() + ESPERA_APK).commit();
            juntarEvento(c, "atualizacao_adiada", obj("kind", "apk", "versao", versao, "estado", estado, "tentativa", tentativas));
            return;
        }
        String f = p.getString("apkFicheiro", "");
        if (!f.isEmpty()) apagar(new File(f));
        String sha = p.getString("apkSha", "");
        if (!sha.isEmpty()) lembrarRecusado(c, sha);
        p.edit().remove("apkFicheiro").remove("apkVersao").remove("apkSha")
            .remove("apkTentativas").remove("apkEspera").commit();
        juntarEvento(c, "atualizacao_recusada", obj("kind", "apk", "versao", versao, "motivo", "instalacao", "estado", estado));
    }
}
