package pt.mae.jogos;

import android.os.Environment;
import android.os.StatFs;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

// Cópia extra de cada registo de jogo no cartão de memória, uma linha JSON por registo, um ficheiro por dia:
//   <pasta da app no cartão SD>/metricas/2026-10-19.jsonl
// A pasta externa da própria app não precisa de permissões. Sem cartão de memória usa a pasta da
// app na memória interna. A família traz os ficheiros com tools/puxar_metricas.ps1.
//   window.Capacitor.Plugins.CopiaSD.guardar({ linhas: ["{...}", ...] }) -> { escritas, ficheiro }
//   window.Capacitor.Plugins.CopiaSD.info() -> { pasta, ficheiro, removivel, bytesHoje, livre, total }
@CapacitorPlugin(name = "CopiaSD")
public class CopiaSD extends Plugin {

    private static final Object TRINCO = new Object();

    // O cartão amovível se houver um montado, senão a pasta da app na memória interna partilhada.
    private File raiz() {
        File[] todas = getContext().getExternalFilesDirs(null);
        if (todas != null) {
            for (File f : todas) {
                if (f == null) continue;
                try {
                    if (Environment.isExternalStorageRemovable(f)
                            && Environment.MEDIA_MOUNTED.equals(Environment.getExternalStorageState(f))) {
                        return f;
                    }
                } catch (IllegalArgumentException e) {
                    // Não é um volume de armazenamento que o Android conheça: saltar.
                }
            }
        }
        File interna = getContext().getExternalFilesDir(null);
        return interna != null ? interna : getContext().getFilesDir();
    }

    private boolean removivel(File f) {
        try {
            return Environment.isExternalStorageRemovable(f);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private File pasta() {
        File p = new File(raiz(), "metricas");
        if (!p.isDirectory()) p.mkdirs();
        return p;
    }

    private File ficheiroDeHoje(File pasta) {
        String dia = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date());
        return new File(pasta, dia + ".jsonl");
    }

    @PluginMethod
    public void guardar(PluginCall call) {
        JSArray linhas = call.getArray("linhas");
        if (linhas == null || linhas.length() == 0) {
            JSObject r = new JSObject();
            r.put("escritas", 0);
            call.resolve(r);
            return;
        }
        synchronized (TRINCO) {
            File f = ficheiroDeHoje(pasta());
            int n = 0;
            try (FileOutputStream fos = new FileOutputStream(f, true);
                 Writer w = new OutputStreamWriter(fos, StandardCharsets.UTF_8)) {
                for (int i = 0; i < linhas.length(); i++) {
                    Object o = linhas.get(i);
                    if (o == null) continue;
                    // Um registo por linha: tirar as mudanças de linha para uma linha ser sempre um registo.
                    String s = o.toString().replace('\n', ' ').replace('\r', ' ');
                    w.write(s);
                    w.write('\n');
                    n++;
                }
                w.flush();
                fos.getFD().sync();
            } catch (Exception e) {
                call.reject("Falhou a escrita em " + f.getAbsolutePath(), e);
                return;
            }
            JSObject r = new JSObject();
            r.put("escritas", n);
            r.put("ficheiro", f.getAbsolutePath());
            call.resolve(r);
        }
    }

    @PluginMethod
    public void info(PluginCall call) {
        File raiz = raiz();
        File pasta = pasta();
        File hoje = ficheiroDeHoje(pasta);
        JSObject r = new JSObject();
        r.put("pasta", pasta.getAbsolutePath());
        r.put("ficheiro", hoje.getAbsolutePath());
        r.put("removivel", removivel(raiz));
        r.put("bytesHoje", hoje.exists() ? hoje.length() : 0);
        try {
            StatFs s = new StatFs(raiz.getAbsolutePath());
            r.put("livre", s.getAvailableBytes());
            r.put("total", s.getTotalBytes());
        } catch (Exception e) {
            r.put("livre", -1);
            r.put("total", -1);
        }
        File[] dias = pasta.listFiles();
        r.put("ficheiros", dias == null ? 0 : dias.length);
        call.resolve(r);
    }
}
