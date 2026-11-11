package pt.mae.jogos;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Deixa o ecrã da família pausar o modo quiosque por um bocado (entrada no Wi-Fi de um hospital, definições).
// window.Capacitor.Plugins.Quiosque.estado() -> { dono, bloqueado, pausaAte (hora de parede em ms, 0 se não há), restaMs }
// pausar({ minutos }) / retomar() / desistir() -> { feito }
// Evento "ecraApagado" { modo: "lock" | "tempo" }: a app vai apagar o ecrã ao fim de 10 minutos de
// sossego a bateria (MainActivity.apagarEcra). Fica guardado até a página estar à escuta.
@CapacitorPlugin(name = "Quiosque")
public class Quiosque extends Plugin {

    void ecraApagado(String modo) {
        JSObject d = new JSObject();
        d.put("modo", modo);
        notifyListeners("ecraApagado", d, true);
    }

    private MainActivity atividade() {
        return (MainActivity) getActivity();
    }

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = new JSObject();
        r.put("dono", atividade().ehDono());
        r.put("bloqueado", atividade().estaBloqueado());
        r.put("pausaAte", atividade().pausaAte());
        r.put("restaMs", Math.max(0, atividade().pausaRestante()));
        call.resolve(r);
    }

    @PluginMethod
    public void pausar(PluginCall call) {
        int minutos = call.getInt("minutos", 15);
        getActivity().runOnUiThread(() -> {
            atividade().pausar(minutos);
            call.resolve();
        });
    }

    // Só no ecrã da família, atrás de duas confirmações: largar o lugar de dona do aparelho (quiosque
    // desligado de vez). Resolve com { feito: true } quando a app já não é dona do aparelho.
    @PluginMethod
    public void desistir(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            JSObject r = new JSObject();
            r.put("feito", atividade().desistirDono());
            call.resolve(r);
        });
    }

    @PluginMethod
    public void retomar(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            atividade().retomar();
            call.resolve();
        });
    }
}
