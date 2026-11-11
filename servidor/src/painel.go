package main

import (
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"sort"
	"strconv"
	"time"
)

// Nomes das atividades como no ecrã inicial. Manter a par de app/www/js/jogos/registo.js
// (conferido com a versão 0.3.0 da app a 19 de outubro de 2026). Um jogo retirado da app fica
// aqui com "(retirado)" no nome, para os registos antigos se lerem bem.
var nomes = map[string]string{
	"fotos": "Fotografias", "musica": "Música", "casa": "A minha casa", "passeios": "Passeios",
	"pares": "Pares", "jardim": "Jardim", "loto": "Loto", "ditados": "Ditados", "domino": "Dominó",
	"cozinha": "Cozinha", "aquario": "Aquário", "sopa": "Sopa de letras", "palavras": "Palavras",
	"sequencia": "Sequência", "diferencas": "Diferenças", "puzzle": "Puzzle", "bisca": "Bisca",
	"sueca": "Sueca", "paciencia": "Paciência", "damas": "Damas", "galo": "Jogo do galo",
	"feira": "Feira", "sardinha": "Sardinhas", "montapratos": "Monta-pratos",
	"gato": "Gato aventureiro", "cores": "Cores", "intruso": "O intruso", "adivinhas": "Adivinhas",
	"sudoku": "Sudoku", "labirinto": "Labirinto", "estendal": "Estendal", "mesa": "Pôr a mesa",
	"pintar": "Azulejos", "quatro": "Quatro em linha", "saltos": "Saltos",
	"corrida": "Corrida (retirado)",
}

func nome(id string) string {
	if n, ok := nomes[id]; ok {
		return n
	}
	return id
}

type sessao struct {
	Device  string
	Game    string
	Inicio  time.Time
	Duracao time.Duration
	Ativo   time.Duration
	Toques  int
	SaiuPor string
}

type linhaAtividade struct {
	Nome                string
	Visitas7, Visitas30 int
	Minutos7, Ativos7   int
	Ativos30            int
	Rondas7             int
	Nivel               string
	Ultima              string
	minutos7, ativos7   time.Duration
	ativos30            time.Duration
}

type barra struct {
	Rotulo string
	Valor  int
	Pct    int
}

type dadosPainel struct {
	Titulo      string
	Gerado      string
	UltimoEnvio string
	Desde       string
	Registos    int
	HojeMin     int
	SemanaMin   int
	Dias        []barra
	Horas       []barra
	Atividades  []linhaAtividade
	Recentes    []linhaSessao
	Bateria     estadoBateria
}

// A bateria como o tablet a disse da última vez (registos "bateria": de 15 em 15 minutos e quando
// o carregador é ligado ou desligado), e as horas em que a app apagou o ecrã a bateria
// ("ecra_apagado_bateria", ao fim de 10 minutos de sossego fora do carregador).
type estadoBateria struct {
	Tem          bool   // há pelo menos um registo "bateria"
	Nivel        int    // último nível conhecido, 0-100
	ACarregar    bool   // a carregar no último registo
	Quando       string // hora de Lisboa do último registo
	TemHoje      bool   // há algum registo hoje (Lisboa)
	MinimoHoje   int    // nível mais baixo de hoje
	Fraca        bool   // último nível abaixo de 20% e sem carregar
	Apagados     []linhaApagado
	ApagadosHoje int
}

type linhaApagado struct {
	Quando string
	Nivel  string // "45%", ou "" quando o registo não tem nível
}

type linhaSessao struct {
	Quando, Nome    string
	Minutos, Ativos int
	SaiuPor         string
}

func (s *servidor) painel(w http.ResponseWriter, r *http.Request) {
	d, err := s.calcular(time.Now())
	if err != nil {
		log.Printf("painel: %v", err)
		http.Error(w, "erro", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	// A mesma política que o Caddy à frente põe, para a página ficar fechada mesmo sem o proxy.
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
	w.Header().Set("X-Frame-Options", "DENY")
	d.Titulo = s.titulo
	if err := modelo.Execute(w, d); err != nil {
		log.Printf("painel: %v", err)
	}
}

func (s *servidor) calcular(agora time.Time) (*dadosPainel, error) {
	desde := agora.AddDate(0, 0, -31).UTC().Format(time.RFC3339)
	d := &dadosPainel{Gerado: agora.In(s.lisboa).Format("02/01/2006 15:04")}

	var ultimo string
	if err := s.db.QueryRow(`SELECT COUNT(*), COALESCE(MAX(recebido), '') FROM registos`).Scan(&d.Registos, &ultimo); err != nil {
		return nil, err
	}
	if t, err := time.Parse(time.RFC3339, ultimo); err == nil {
		d.UltimoEnvio = t.In(s.lisboa).Format("02/01/2006 15:04")
	} else {
		d.UltimoEnvio = "nunca"
	}

	// As estatísticas começam no último registo "reset" de cada tablet (o "Recomeçar do zero" da
	// família antes de o entregar) e nunca antes de MAE_INICIO. As linhas anteriores ficam na base
	// de dados sem serem tocadas; são os testes da própria família.
	cortes, err := s.cortes()
	if err != nil {
		return nil, err
	}
	d.Desde = "o primeiro registo"
	var ultimoCorte time.Time
	for _, t := range cortes {
		if t.After(ultimoCorte) {
			ultimoCorte = t
		}
	}
	if !ultimoCorte.IsZero() {
		d.Desde = ultimoCorte.In(s.lisboa).Format("02/01/2006 15:04") + " (último recomeço do zero no tablet)"
	}
	if !s.inicio.IsZero() && s.inicio.After(ultimoCorte) {
		d.Desde = s.inicio.In(s.lisboa).Format("02/01/2006 15:04") + " (data de início definida no servidor)"
	}
	conta := func(device string, t time.Time) bool {
		if !s.inicio.IsZero() && t.Before(s.inicio) {
			return false
		}
		if c, ok := cortes[device]; ok && t.Before(c) {
			return false
		}
		return true
	}

	hoje := inicioDia(agora.In(s.lisboa))
	semana := hoje.AddDate(0, 0, -6)
	sessoes, err := s.sessoes(desde, conta)
	if err != nil {
		return nil, err
	}
	niveis, rondas7, err := s.rondas(desde, semana, conta)
	if err != nil {
		return nil, err
	}
	if d.Bateria, err = s.bateria(hoje, semana); err != nil {
		return nil, err
	}

	// Minutos ativos por dia, nos últimos 14 dias. As durações somam-se primeiro e arredondam-se uma
	// vez, como no ecrã da família no tablet (familia.js): muitas visitas curtas não podem dar zero.
	porDia := map[string]time.Duration{}
	porHora := make([]time.Duration, 24)
	var hojeAtivo, semanaAtivo time.Duration
	for _, x := range sessoes {
		l := x.Inicio.In(s.lisboa)
		porDia[l.Format("2006-01-02")] += x.Ativo
		if !l.Before(hoje.AddDate(0, 0, -13)) {
			porHora[l.Hour()] += x.Ativo
		}
		if !l.Before(hoje) {
			hojeAtivo += x.Ativo
		}
		if !l.Before(semana) {
			semanaAtivo += x.Ativo
		}
	}
	d.HojeMin = minutos(hojeAtivo)
	d.SemanaMin = minutos(semanaAtivo)
	diasPt := []string{"dom", "seg", "ter", "qua", "qui", "sex", "sáb"}
	for i := 13; i >= 0; i-- {
		dia := hoje.AddDate(0, 0, -i)
		d.Dias = append(d.Dias, barra{Rotulo: diasPt[dia.Weekday()] + " " + dia.Format("02/01"), Valor: minutos(porDia[dia.Format("2006-01-02")])})
	}
	for h, v := range porHora {
		d.Horas = append(d.Horas, barra{Rotulo: time.Date(2000, 1, 1, h, 0, 0, 0, time.UTC).Format("15h"), Valor: minutos(v)})
	}
	escalar(d.Dias)
	escalar(d.Horas)

	// Por atividade.
	por := map[string]*linhaAtividade{}
	ultimaVez := map[string]time.Time{}
	for _, x := range sessoes {
		a := por[x.Game]
		if a == nil {
			a = &linhaAtividade{Nome: nome(x.Game)}
			por[x.Game] = a
		}
		l := x.Inicio.In(s.lisboa)
		a.Visitas30++
		a.ativos30 += x.Ativo
		if !l.Before(semana) {
			a.Visitas7++
			a.minutos7 += x.Duracao
			a.ativos7 += x.Ativo
		}
		if l.After(ultimaVez[x.Game]) {
			ultimaVez[x.Game] = l
		}
	}
	for g, a := range por {
		a.Minutos7, a.Ativos7, a.Ativos30 = minutos(a.minutos7), minutos(a.ativos7), minutos(a.ativos30)
		a.Rondas7 = rondas7[g]
		a.Nivel = niveis[g]
		a.Ultima = ultimaVez[g].Format("02/01 15:04")
		d.Atividades = append(d.Atividades, *a)
	}
	sort.Slice(d.Atividades, func(i, j int) bool {
		if d.Atividades[i].Ativos7 != d.Atividades[j].Ativos7 {
			return d.Atividades[i].Ativos7 > d.Atividades[j].Ativos7
		}
		return d.Atividades[i].Ativos30 > d.Atividades[j].Ativos30
	})

	// Primeiro as visitas mais recentes.
	sort.Slice(sessoes, func(i, j int) bool { return sessoes[i].Inicio.After(sessoes[j].Inicio) })
	for i, x := range sessoes {
		if i == 40 {
			break
		}
		d.Recentes = append(d.Recentes, linhaSessao{
			Quando: x.Inicio.In(s.lisboa).Format("02/01 15:04"), Nome: nome(x.Game),
			Minutos: minutos(x.Duracao), Ativos: minutos(x.Ativo), SaiuPor: x.SaiuPor,
		})
	}
	return d, nil
}

// Arredonda ao minuto mais próximo, como Math.round(ms / 60000) faz no tablet.
func minutos(d time.Duration) int {
	return int((d + 30*time.Second) / time.Minute)
}

// Hora do último registo "reset" de cada tablet: a família apagou o progresso nesse momento,
// por isso tudo o que está antes era jogo de teste dela.
func (s *servidor) cortes() (map[string]time.Time, error) {
	linhas, err := s.db.Query(`SELECT device, MAX(quando) FROM registos WHERE tipo = 'reset' GROUP BY device`)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()
	out := map[string]time.Time{}
	for linhas.Next() {
		var device, quando string
		if err := linhas.Scan(&device, &quando); err != nil {
			return nil, err
		}
		if t, err := time.Parse(time.RFC3339, quando); err == nil {
			out[device] = t
		}
	}
	return out, linhas.Err()
}

func (s *servidor) sessoes(desde string, conta func(string, time.Time) bool) ([]sessao, error) {
	linhas, err := s.db.Query(`SELECT device, game, dados FROM registos WHERE tipo = 'sessao' AND quando >= ?`, desde)
	if err != nil {
		return nil, err
	}
	defer linhas.Close()
	var out []sessao
	for linhas.Next() {
		var device, game, bruto string
		if err := linhas.Scan(&device, &game, &bruto); err != nil {
			return nil, err
		}
		var x struct {
			StartedAt  string  `json:"started_at"`
			DurationMs float64 `json:"duration_ms"`
			ActiveMs   float64 `json:"active_ms"`
			Taps       int     `json:"taps"`
			LeftBy     string  `json:"left_by"`
		}
		if json.Unmarshal([]byte(bruto), &x) != nil {
			continue
		}
		t, err := time.Parse(time.RFC3339, x.StartedAt)
		if err != nil || !conta(device, t) {
			continue
		}
		out = append(out, sessao{Device: device, Game: game, Inicio: t, Duracao: time.Duration(x.DurationMs) * time.Millisecond,
			Ativo: time.Duration(x.ActiveMs) * time.Millisecond, Toques: x.Taps, SaiuPor: x.LeftBy})
	}
	return out, linhas.Err()
}

// Último nível por jogo, e rondas acabadas por jogo desde o início de "semana" (os mesmos
// 7 dias de calendário da coluna das visitas).
func (s *servidor) rondas(desde string, semana time.Time, conta func(string, time.Time) bool) (map[string]string, map[string]int, error) {
	linhas, err := s.db.Query(`SELECT device, game, quando, dados FROM registos WHERE tipo = 'ronda' AND quando >= ? ORDER BY quando`, desde)
	if err != nil {
		return nil, nil, err
	}
	defer linhas.Close()
	niveis := map[string]string{}
	completas := map[string]int{}
	for linhas.Next() {
		var device, game, quando, bruto string
		if err := linhas.Scan(&device, &game, &quando, &bruto); err != nil {
			return nil, nil, err
		}
		t, err := time.Parse(time.RFC3339, quando)
		if err != nil || !conta(device, t) {
			continue
		}
		var x struct {
			Level     json.Number `json:"level"`
			Completed bool        `json:"completed"`
		}
		if json.Unmarshal([]byte(bruto), &x) != nil {
			continue
		}
		niveis[game] = x.Level.String()
		if x.Completed && !t.Before(semana) {
			completas[game]++
		}
	}
	return niveis, completas, linhas.Err()
}

// Estado da bateria e horas de ecrã apagado. Não ficam sujeitos ao corte da entrega: descrevem o
// tablet, não o jogo da pessoa, e uma leitura de antes de um recomeço continua a ser verdadeira.
func (s *servidor) bateria(hoje, semana time.Time) (estadoBateria, error) {
	var b estadoBateria
	type leitura struct {
		Level    *float64 `json:"level"`
		Charging bool     `json:"charging"`
	}
	ler := func(bruto string) (leitura, bool) {
		var x leitura
		if json.Unmarshal([]byte(bruto), &x) != nil || x.Level == nil || *x.Level < 0 || *x.Level > 100 {
			return x, false
		}
		return x, true
	}

	// O último nível conhecido: o registo mais novo, seja de quando for (um tablet que ficou sem
	// bateria deixa de enviar, e é exatamente aí que a família precisa de ver o último nível).
	linhas, err := s.db.Query(`SELECT quando, dados FROM registos WHERE tipo = 'bateria' ORDER BY quando DESC LIMIT 20`)
	if err != nil {
		return b, err
	}
	var ultimo time.Time
	for linhas.Next() {
		var quando, bruto string
		if err := linhas.Scan(&quando, &bruto); err != nil {
			linhas.Close()
			return b, err
		}
		t, err := time.Parse(time.RFC3339, quando)
		x, ok := ler(bruto)
		if err != nil || !ok || !t.After(ultimo) {
			continue
		}
		ultimo = t
		b.Tem, b.Nivel, b.ACarregar = true, int(*x.Level+0.5), x.Charging
	}
	linhas.Close()
	if err := linhas.Err(); err != nil {
		return b, err
	}
	if b.Tem {
		b.Quando = ultimo.In(s.lisboa).Format("02/01/2006 15:04")
		b.Fraca = b.Nivel < 20 && !b.ACarregar
	}

	// O nível mais baixo de hoje (dia de Lisboa). A coluna tem a hora UTC em ISO do tablet, por isso
	// uma folga de um dia na pesquisa e a conferência exata na hora já lida.
	margem := hoje.AddDate(0, 0, -1).UTC().Format(time.RFC3339)
	linhas, err = s.db.Query(`SELECT quando, dados FROM registos WHERE tipo = 'bateria' AND quando >= ?`, margem)
	if err != nil {
		return b, err
	}
	for linhas.Next() {
		var quando, bruto string
		if err := linhas.Scan(&quando, &bruto); err != nil {
			linhas.Close()
			return b, err
		}
		t, err := time.Parse(time.RFC3339, quando)
		x, ok := ler(bruto)
		if err != nil || !ok || t.Before(hoje) {
			continue
		}
		n := int(*x.Level + 0.5)
		if !b.TemHoje || n < b.MinimoHoje {
			b.MinimoHoje = n
		}
		b.TemHoje = true
	}
	linhas.Close()
	if err := linhas.Err(); err != nil {
		return b, err
	}

	// Ecrã apagado a bateria, nos últimos 7 dias, do mais novo para o mais antigo (mostram-se 20 no máximo).
	linhas, err = s.db.Query(`SELECT quando, dados FROM registos WHERE tipo = 'ecra_apagado_bateria' AND quando >= ?`,
		semana.AddDate(0, 0, -1).UTC().Format(time.RFC3339))
	if err != nil {
		return b, err
	}
	type apagado struct {
		t     time.Time
		nivel string
	}
	var lista []apagado
	for linhas.Next() {
		var quando, bruto string
		if err := linhas.Scan(&quando, &bruto); err != nil {
			linhas.Close()
			return b, err
		}
		t, err := time.Parse(time.RFC3339, quando)
		if err != nil || t.Before(semana) {
			continue
		}
		a := apagado{t: t}
		if x, ok := ler(bruto); ok {
			a.nivel = strconv.Itoa(int(*x.Level+0.5)) + "%"
		}
		lista = append(lista, a)
		if !t.Before(hoje) {
			b.ApagadosHoje++
		}
	}
	linhas.Close()
	if err := linhas.Err(); err != nil {
		return b, err
	}
	sort.Slice(lista, func(i, j int) bool { return lista[i].t.After(lista[j].t) })
	for i, a := range lista {
		if i == 20 {
			break
		}
		b.Apagados = append(b.Apagados, linhaApagado{Quando: a.t.In(s.lisboa).Format("02/01 15:04"), Nivel: a.nivel})
	}
	return b, nil
}

func inicioDia(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}

func escalar(b []barra) {
	m := 1
	for _, x := range b {
		if x.Valor > m {
			m = x.Valor
		}
	}
	for i := range b {
		b[i].Pct = b[i].Valor * 100 / m
	}
}

var modelo = template.Must(template.New("painel").Parse(`<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>{{.Titulo}}</title>
<style>
:root{--f:#fff6e0;--t:#111;--v:#2b9348;--a:#0a6fd6;--c:#e8e1d0}
@media (prefers-color-scheme:dark){:root{--f:#1d1b17;--t:#f2efe8;--c:#3a362e}}
body{margin:0;padding:16px;background:var(--f);color:var(--t);font:16px/1.4 system-ui,sans-serif;max-width:1000px;margin:auto}
h1{font-size:1.5em;margin:.2em 0} h2{font-size:1.15em;margin:1.6em 0 .5em}
.resumo{display:flex;flex-wrap:wrap;gap:12px}.resumo div{background:var(--c);border-radius:10px;padding:10px 14px}
.resumo b{display:block;font-size:1.6em}
table{border-collapse:collapse;width:100%;font-size:.95em}th,td{padding:5px 8px;border-bottom:1px solid var(--c);text-align:left}
td.n{text-align:right;font-variant-numeric:tabular-nums}
.barras{display:grid;gap:3px}.barras div{display:grid;grid-template-columns:7em 1fr 3em;align-items:center;gap:8px}
.barras i{display:block;height:14px;background:var(--a);border-radius:3px;min-width:1px}
.barras span{text-align:right;font-variant-numeric:tabular-nums}
.tabela{overflow-x:auto}
.aviso{background:#b00020;color:#fff;border-radius:10px;padding:10px 14px;font-weight:bold}
</style></head><body>
<h1>{{.Titulo}}</h1>
<p>Atualizado às {{.Gerado}}. Último envio do tablet: {{.UltimoEnvio}}.</p>
<p>Estatísticas desde {{.Desde}}.</p>
{{with .Bateria}}{{if .Fraca}}<p class="aviso">Bateria fraca no último envio: {{.Nivel}}% e sem carregador ({{.Quando}}).</p>{{end}}{{end}}
<h2>Bateria</h2>
{{with .Bateria}}{{if .Tem}}<div class="resumo">
<div>Último nível<b>{{.Nivel}}%</b></div>
<div>Carregador<b>{{if .ACarregar}}ligado{{else}}desligado{{end}}</b></div>
<div>Mais baixo hoje<b>{{if .TemHoje}}{{.MinimoHoje}}%{{else}}sem dados{{end}}</b></div>
<div>Ecrã apagado hoje<b>{{.ApagadosHoje}}</b></div>
</div>
<p>Último registo de bateria: {{.Quando}}. Fora do carregador, o ecrã apaga-se após 10 minutos sem toques; liga-se no botão de ligar.</p>
{{if .Apagados}}<p>Ecrã apagado pela bateria (últimos 7 dias): {{range $i, $a := .Apagados}}{{if $i}}, {{end}}{{$a.Quando}}{{if $a.Nivel}} ({{$a.Nivel}}){{end}}{{end}}.</p>{{end}}
{{else}}<p>Ainda sem registos de bateria.</p>{{end}}{{end}}
<h2>Resumo</h2>
<div class="resumo">
<div>Hoje<b>{{.HojeMin}} min</b></div>
<div>Últimos 7 dias<b>{{.SemanaMin}} min</b></div>
<div>Registos recebidos<b>{{.Registos}}</b></div>
</div>
<p>Os minutos contam o tempo com toques no ecrã (no máximo um minuto sem tocar).</p>
<h2>Minutos a jogar por dia</h2>
<div class="barras">{{range .Dias}}<div><span style="text-align:left">{{.Rotulo}}</span><i style="width:{{.Pct}}%"></i><span>{{.Valor}}</span></div>{{end}}</div>
<h2>Atividades</h2>
<div class="tabela"><table>
<tr><th>Atividade</th><th>Visitas 7 dias</th><th>Minutos abertos 7 dias</th><th>Minutos a jogar 7 dias</th><th>Rondas completas 7 dias</th><th>Minutos a jogar 30 dias</th><th>Nível</th><th>Última vez</th></tr>
{{range .Atividades}}<tr><td>{{.Nome}}</td><td class="n">{{.Visitas7}}</td><td class="n">{{.Minutos7}}</td><td class="n">{{.Ativos7}}</td><td class="n">{{.Rondas7}}</td><td class="n">{{.Ativos30}}</td><td class="n">{{.Nivel}}</td><td>{{.Ultima}}</td></tr>
{{else}}<tr><td colspan="8">Ainda sem dados.</td></tr>{{end}}
</table></div>
<h2>A que horas joga (últimos 14 dias)</h2>
<div class="barras">{{range .Horas}}<div><span style="text-align:left">{{.Rotulo}}</span><i style="width:{{.Pct}}%"></i><span>{{.Valor}}</span></div>{{end}}</div>
<h2>Últimas visitas</h2>
<div class="tabela"><table>
<tr><th>Quando</th><th>Atividade</th><th>Minutos</th><th>A jogar</th><th>Saiu por</th></tr>
{{range .Recentes}}<tr><td>{{.Quando}}</td><td>{{.Nome}}</td><td class="n">{{.Minutos}}</td><td class="n">{{.Ativos}}</td><td>{{.SaiuPor}}</td></tr>
{{else}}<tr><td colspan="5">Ainda sem dados.</td></tr>{{end}}
</table></div>
</body></html>`))
