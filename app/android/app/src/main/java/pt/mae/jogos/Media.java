package pt.mae.jogos;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Environment;
import android.os.StatFs;
import android.util.Log;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

// Pacotes de media pela internet (fotografias, música, vistas em 360, os nomes do Quem é quem),
// feitos no PC por tools/publicar_atualizacao.py --media. Um pacote é incremental: o pack.json lista,
// por coleção, os itens a acrescentar ou substituir, as chaves a remover e a ordem completa, mais os
// ficheiros a apagar; o zip só leva ficheiros novos ou mudados.
//
// Onde as coisas ficam (os mesmos sítios para onde tools/enviar_media.py manda pelo adb):
//   ficheiros  <pasta da app no cartão de memória>/media/   (memória interna partilhada, sem cartão)
//   manifesto  <pasta da app na memória interna partilhada>/media/manifest.json, caminhos absolutos,
//              com "versao_media": o último pacote aplicado (0 = só o que o adb mandou)
//
// Passos: o Atualizar descarrega e confere o zip; preparar() descomprime-o ao lado da pasta de media
// (<cartão>/media/.novo) e confere-o; aplicar(), num momento seguro, move os ficheiros, reescreve o
// manifesto (ficheiro temporário, depois troca de nome) e apaga só o que o pacote lista. O aplicar()
// pode ser interrompido em qualquer ponto e corrido outra vez.
final class Media {

    static final String TAG = "MAE";
    static final long MAX_DESCOMPRIMIDO = 1024L * 1024 * 1024;
    static final int MAX_ENTRADAS = 20000;
    static final long FOLGA = 64L * 1024 * 1024;
    private static final Pattern CAMINHO = Pattern.compile("^(fotos|musica|casa|quem)/[A-Za-z0-9._-]{1,120}$");
    private static final String[] COLECOES = { "fotos", "musica", "casa", "passeios", "quem" };

    private Media() {}

    // A pasta da app num cartão de memória montado, senão a da memória interna partilhada (como o CopiaSD).
    static File raizFicheiros(Context c) {
        File[] todas = c.getExternalFilesDirs(null);
        if (todas != null) {
            for (File f : todas) {
                if (f == null) continue;
                try {
                    if (Environment.isExternalStorageRemovable(f)
                            && Environment.MEDIA_MOUNTED.equals(Environment.getExternalStorageState(f))) {
                        return new File(f, "media");
                    }
                } catch (IllegalArgumentException e) {
                    // Não é um volume de armazenamento que o Android conheça: saltar.
                }
            }
        }
        File interna = c.getExternalFilesDir(null);
        return new File(interna != null ? interna : c.getFilesDir(), "media");
    }

    // Verdadeiro quando a media fica na mesma memória que as descargas (não há cartão de memória
    // montado): a memória interna partilhada e a pasta privada da app são a mesma partição.
    static boolean mesmoVolume(Context c) {
        File raiz = raizFicheiros(c);
        try {
            return !Environment.isExternalStorageRemovable(raiz);
        } catch (IllegalArgumentException e) {
            return true;   // caiu na pasta privada da app
        }
    }

    static File pastaManifesto(Context c) {
        File interna = c.getExternalFilesDir(null);
        return new File(interna != null ? interna : c.getFilesDir(), "media");
    }

    static File manifesto(Context c) {
        return new File(pastaManifesto(c), "manifest.json");
    }

    static File preparacao(Context c) {
        return new File(raizFicheiros(c), ".novo");
    }

    static long livre(File f) {
        try {
            File x = f;
            while (x != null && !x.exists()) x = x.getParentFile();
            if (x == null) return -1;
            return new StatFs(x.getAbsolutePath()).getAvailableBytes();
        } catch (Exception e) {
            return -1;
        }
    }

    static JSONObject lerManifesto(Context c) {
        File f = manifesto(c);
        if (!f.isFile() || f.length() > 16L * 1024 * 1024) return new JSONObject();
        try {
            return new JSONObject(new String(Atualizar.lerTudo(new FileInputStream(f), 16L * 1024 * 1024), StandardCharsets.UTF_8));
        } catch (Exception e) {
            Log.w(TAG, "media: manifesto ilegível: " + e.getClass().getSimpleName());
            return new JSONObject();
        }
    }

    static int versaoAtual(Context c) {
        return lerManifesto(c).optInt("versao_media", 0);
    }

    static boolean caminhoSeguro(String rel) {
        return rel != null && !rel.contains("..") && CAMINHO.matcher(rel).matches();
    }

    // "/storage/0A07-12FD/Android/data/pt.mae.jogos/files/media/fotos/x.jpg" -> "fotos/x.jpg".
    static String relativo(String p) {
        if (p == null) return null;
        int i = p.indexOf("/files/media/");
        return i >= 0 ? p.substring(i + "/files/media/".length()) : p;
    }

    // Descomprime um pacote conferido para <media>/.novo e confere-o. null quando está bem, senão um motivo.
    static String preparar(Context c, File zip, int versao, int base) {
        File destino = preparacao(c);
        Atualizar.apagar(destino);
        try {
            Atualizar.descomprimir(zip, destino, MAX_DESCOMPRIMIDO, MAX_ENTRADAS);
        } catch (IOException e) {
            Atualizar.apagar(destino);
            Log.w(TAG, "pacote de media " + versao + " recusado ao descomprimir: " + e.getMessage());
            return livre(destino) >= 0 && livre(destino) < FOLGA ? "espaco" : "zip";
        }
        try {
            // Só o pack.json e as pastas de media, a um nível de profundidade, com nomes de ficheiro simples.
            File[] topo = destino.listFiles();
            if (topo == null) throw new IOException("vazio");
            for (File f : topo) {
                if (f.isFile() && f.getName().equals("pack.json")) continue;
                if (!f.isDirectory() || !f.getName().matches("fotos|musica|casa|quem")) throw new IOException("inesperado: " + f.getName());
                File[] dentro = f.listFiles();
                if (dentro == null) continue;
                for (File g : dentro) {
                    if (!g.isFile() || !caminhoSeguro(f.getName() + "/" + g.getName())) throw new IOException("ficheiro inesperado");
                }
            }
            JSONObject p = lerPack(destino);
            if (p.optInt("versao", -1) != versao || p.optInt("base", -1) != base) throw new IOException("versão");
            JSONArray fic = p.optJSONArray("ficheiros");
            JSONArray apagar = p.optJSONArray("apagar");
            JSONObject col = p.optJSONObject("colecoes");
            if (fic == null || apagar == null || col == null) throw new IOException("campos do pack.json");
            for (int i = 0; i < fic.length(); i++) {
                String rel = fic.optString(i, null);
                if (!caminhoSeguro(rel) || !new File(destino, rel).isFile()) throw new IOException("falta um ficheiro");
            }
            for (int i = 0; i < apagar.length(); i++) {
                if (!caminhoSeguro(apagar.optString(i, null))) throw new IOException("caminho a apagar inválido");
            }
            Iterator<String> k = col.keys();
            while (k.hasNext()) {
                String nome = k.next();
                boolean conhecida = false;
                for (String x : COLECOES) conhecida |= x.equals(nome);
                if (!conhecida || col.optJSONObject(nome) == null) throw new IOException("coleção inválida");
            }
        } catch (Exception e) {
            Atualizar.apagar(destino);
            Log.w(TAG, "pacote de media " + versao + " recusado: " + e.getMessage());
            return "zip";
        }
        return null;
    }

    private static JSONObject lerPack(File pasta) throws Exception {
        File f = new File(pasta, "pack.json");
        return new JSONObject(new String(Atualizar.lerTudo(new FileInputStream(f), 32L * 1024 * 1024), StandardCharsets.UTF_8));
    }

    // Todos os caminhos de media num valor do manifesto, tornados absolutos dentro de raiz.
    private static Object comPrefixo(Object v, String raiz) throws Exception {
        if (v instanceof String) {
            String s = (String) v;
            return caminhoSeguro(s) ? raiz + "/" + s : s;
        }
        if (v instanceof JSONObject) {
            JSONObject o = (JSONObject) v;
            JSONObject n = new JSONObject();
            Iterator<String> k = o.keys();
            while (k.hasNext()) {
                String x = k.next();
                n.put(x, comPrefixo(o.get(x), raiz));
            }
            return n;
        }
        if (v instanceof JSONArray) {
            JSONArray a = (JSONArray) v;
            JSONArray n = new JSONArray();
            for (int i = 0; i < a.length(); i++) n.put(comPrefixo(a.get(i), raiz));
            return n;
        }
        return v;
    }

    // Caminhos relativos de todos os ficheiros de media a que um valor do manifesto se refere.
    private static void usados(Object v, Set<String> fora) {
        if (v instanceof String) {
            String r = relativo((String) v);
            if (caminhoSeguro(r)) fora.add(r);
        } else if (v instanceof JSONObject) {
            JSONObject o = (JSONObject) v;
            Iterator<String> k = o.keys();
            while (k.hasNext()) usados(o.opt(k.next()), fora);
        } else if (v instanceof JSONArray) {
            JSONArray a = (JSONArray) v;
            for (int i = 0; i < a.length(); i++) usados(a.opt(i), fora);
        }
    }

    private static void mover(File de, File para) throws IOException {
        File pai = para.getParentFile();
        if (pai != null && !pai.isDirectory() && !pai.mkdirs()) throw new IOException("mkdir");
        if (para.exists() && !para.delete()) throw new IOException("não se consegue substituir");
        if (de.renameTo(para)) return;
        // Outro volume (não devia acontecer: .novo está dentro da pasta de media): copiar, depois apagar.
        try (InputStream in = new FileInputStream(de); OutputStream out = new FileOutputStream(para)) {
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
        if (!de.delete()) Log.w(TAG, "media: ficou para trás uma cópia preparada");
    }

    // Aplica o pacote à espera, se houver. Devolve a versão dele, ou 0 quando nada foi aplicado.
    static synchronized int aplicar(Context c) {
        SharedPreferences prefs = Atualizar.prefs(c);
        int v = prefs.getInt("mediaPendente", 0);
        if (v <= 0) return 0;
        File st = preparacao(c);
        try {
            JSONObject p = lerPack(st);
            int base = p.getInt("base");
            int atual = versaoAtual(c);
            if (atual != base) {
                prefs.edit().putInt("mediaPendente", 0).commit();
                Atualizar.apagar(st);
                if (atual < v) {
                    // A media mudou por baixo (um envio pelo adb): este pacote já não serve.
                    Atualizar.juntarEvento(c, "atualizacao_recusada", Atualizar.obj("kind", "media", "versao", v, "motivo", "base"));
                    Log.w(TAG, "o pacote de media " + v + " espera a versão " + base + ", o tablet tem a " + atual + ": largado");
                }
                return 0;
            }
            File raiz = raizFicheiros(c);
            String raizTxt = raiz.getAbsolutePath();
            // 1. Os ficheiros novos e mudados para o seu lugar (um ficheiro já movido por uma corrida
            //    anterior, interrompida, simplesmente já lá está).
            JSONArray fic = p.getJSONArray("ficheiros");
            for (int i = 0; i < fic.length(); i++) {
                String rel = fic.getString(i);
                File de = new File(st, rel);
                File para = new File(raiz, rel);
                if (de.isFile()) mover(de, para);
                else if (!para.isFile()) throw new IOException("perdeu-se um ficheiro preparado");
            }
            // 2. O manifesto: juntar coleção a coleção, depois escrevê-lo inteiro (ficheiro temporário, troca de nome).
            JSONObject man = lerManifesto(c);
            JSONObject col = p.getJSONObject("colecoes");
            Iterator<String> nomes = col.keys();
            while (nomes.hasNext()) {
                String nome = nomes.next();
                JSONObject mud = col.getJSONObject(nome);
                Map<String, Object> porChave = new LinkedHashMap<>();
                JSONArray atuais = man.optJSONArray(nome);
                if (atuais != null) {
                    for (int i = 0; i < atuais.length(); i++) {
                        JSONObject item = atuais.optJSONObject(i);
                        if (item != null) porChave.put(relativo(item.optString("ficheiro", "")), item);
                    }
                }
                JSONArray rem = mud.optJSONArray("remover");
                if (rem != null) for (int i = 0; i < rem.length(); i++) porChave.remove(rem.optString(i));
                JSONArray add = mud.optJSONArray("adicionar");
                if (add != null) {
                    for (int i = 0; i < add.length(); i++) {
                        JSONObject item = add.optJSONObject(i);
                        if (item != null) porChave.put(item.optString("ficheiro", ""), comPrefixo(item, raizTxt));
                    }
                }
                JSONArray ordem = mud.optJSONArray("ordem");
                JSONArray nova = new JSONArray();
                if (ordem != null) {
                    // A ordem do pacote é a coleção inteira: o que não está nela fica de fora.
                    for (int i = 0; i < ordem.length(); i++) {
                        Object item = porChave.get(ordem.optString(i));
                        if (item != null) nova.put(item);
                    }
                } else {
                    for (Object item : porChave.values()) nova.put(item);
                }
                man.put(nome, nova);
            }
            man.put("versao_media", v);
            File pasta = pastaManifesto(c);
            if (!pasta.isDirectory() && !pasta.mkdirs()) throw new IOException("mkdir do manifesto");
            File temp = new File(pasta, "manifest.json.tmp");
            try (OutputStream out = new FileOutputStream(temp)) {
                out.write(man.toString().getBytes(StandardCharsets.UTF_8));
                out.flush();
                ((FileOutputStream) out).getFD().sync();
            }
            if (!temp.renameTo(manifesto(c))) throw new IOException("troca de nome do manifesto");
            // 3. Apagar só o que o pacote lista, e nunca um ficheiro que o manifesto novo ainda usa.
            Set<String> emUso = new HashSet<>();
            usados(man, emUso);
            JSONArray apagar = p.getJSONArray("apagar");
            int apagados = 0;
            for (int i = 0; i < apagar.length(); i++) {
                String rel = apagar.getString(i);
                if (!caminhoSeguro(rel) || emUso.contains(rel)) continue;
                File f = new File(raiz, rel);
                if (f.isFile() && f.delete()) apagados++;
            }
            prefs.edit().putInt("mediaPendente", 0).commit();
            Atualizar.apagar(st);
            Atualizar.juntarEvento(c, "atualizacao_aplicada", Atualizar.obj("kind", "media", "versao", v,
                "ficheiros", fic.length(), "apagados", apagados));
            Log.i(TAG, "pacote de media " + v + " aplicado: " + fic.length() + " ficheiros postos, " + apagados + " apagados");
            return v;
        } catch (Exception e) {
            // Fica como está: o próximo momento seguro (ou arranque) tenta outra vez de onde parou.
            Log.e(TAG, "pacote de media " + v + " ainda não aplicado: " + e.getMessage());
            return 0;
        }
    }

    // Restos de um pacote que nunca vai ser aplicado (uma atualização do APK limpou o estado, o cartão foi trocado).
    static void limparPreparacao(Context c) {
        if (Atualizar.prefs(c).getInt("mediaPendente", 0) == 0) Atualizar.apagar(preparacao(c));
    }
}
