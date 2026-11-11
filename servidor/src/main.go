// mae: o servidor que acompanha a app de jogos do tablet.
//
//   - POST /api/registos   o tablet envia registos de jogo (token Bearer); repetir não duplica (id do registo)
//   - GET  /api/versao     o tablet pergunta pelas últimas versões da app, do pacote web e da media
//   - GET  /api/ficheiros/ o tablet descarrega ficheiros de atualização e de media (aceita Range)
//   - GET  /healthz        "ok", para a página de estado
//   - GET  /               painel da família (protegido por palavra-passe no Caddy, não aqui)
//
// Sem ligações para fora, sem análise de visitas. O registo do servidor só tem contagens, nunca o
// conteúdo dos registos de jogo.
// Configuração por variáveis de ambiente:
//
//	MAE_DATA          pasta dos dados (por omissão /data): mae.db, publico/ (ficheiros para descarregar)
//	MAE_ADDR          endereço de escuta (por omissão :8080)
//	MAE_TOKEN_SHA256  SHA-256 em hexadecimal do token do tablet (obrigatório para /api)
//	MAE_ORIGIN        origem CORS permitida (por omissão https://localhost, a app Capacitor)
//	MAE_INICIO        opcional: o painel não conta nada antes desta data ("2006-01-02",
//	                  meia-noite de Lisboa, ou RFC 3339). O último registo "reset" de cada tablet
//	                  é sempre um corte também (ver painel.go). Os registos em bruto nunca são tocados.
package main

import (
	"crypto/sha256"
	"crypto/subtle"
	"context"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
	_ "time/tzdata"

	_ "modernc.org/sqlite"
)

const (
	maxCorpo    = 4 << 20 // 4 MB por lote
	maxRegisto  = 16 << 10
	maxPorLote  = 1000
	maxRid      = 64
	esquemaBase = `
CREATE TABLE IF NOT EXISTS registos (
  rid      TEXT PRIMARY KEY,
  device   TEXT NOT NULL DEFAULT '',
  tipo     TEXT NOT NULL DEFAULT '',
  game     TEXT NOT NULL DEFAULT '',
  quando   TEXT NOT NULL DEFAULT '',
  recebido TEXT NOT NULL,
  dados    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS registos_tipo_quando ON registos(tipo, quando);
`
)

type servidor struct {
	db        *sql.DB
	publico   string
	tokenHash []byte
	origem    string
	lisboa    *time.Location
	inicio    time.Time // zero quando MAE_INICIO não está definido
	titulo    string    // título do painel, MAE_TITULO
}

func main() {
	dados := envOr("MAE_DATA", "/data")
	addr := envOr("MAE_ADDR", ":8080")
	origem := envOr("MAE_ORIGIN", "https://localhost")
	tokenHash, err := hex.DecodeString(strings.TrimSpace(os.Getenv("MAE_TOKEN_SHA256")))
	if err != nil || len(tokenHash) != sha256.Size {
		log.Fatal("MAE_TOKEN_SHA256 tem de ser o SHA-256 em hexadecimal do token do tablet")
	}
	lisboa, err := time.LoadLocation("Europe/Lisbon")
	if err != nil {
		log.Fatal(err)
	}
	var inicio time.Time
	if v := strings.TrimSpace(os.Getenv("MAE_INICIO")); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			t, err = time.ParseInLocation("2006-01-02", v, lisboa)
		}
		if err != nil {
			log.Fatal("MAE_INICIO tem de ser uma data (2006-01-02, Lisboa) ou uma hora RFC 3339")
		}
		inicio = t
	}
	publico := filepath.Join(dados, "publico")
	if err := os.MkdirAll(publico, 0o750); err != nil {
		log.Fatal(err)
	}
	db, err := abrirDB(filepath.Join(dados, "mae.db"))
	if err != nil {
		log.Fatal(err)
	}
	s := &servidor{db: db, publico: publico, tokenHash: tokenHash, origem: origem, lisboa: lisboa, inicio: inicio,
		titulo: envOr("MAE_TITULO", "Jogos da Mãe")}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { io.WriteString(w, "ok") })
	mux.HandleFunc("OPTIONS /api/", s.preflight)
	mux.HandleFunc("POST /api/registos", s.api(s.receberRegistos))
	mux.HandleFunc("GET /api/versao", s.api(s.versao))
	mux.HandleFunc("GET /api/ficheiros/", s.api(s.ficheiro))
	mux.HandleFunc("GET /{$}", s.painel)

	srv := &http.Server{
		Addr:              addr,
		Handler:           cabecalhos(mux),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	log.Printf("mae à escuta em %s", addr)
	// Com SIGTERM ou Ctrl+C: acabar os pedidos em curso, depois fechar a base de dados. Fechar a última
	// ligação junta o diário de escrita ao mae.db, por isso uma cópia desse ficheiro é uma cópia inteira.
	ctx, parar := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer parar()
	erros := make(chan error, 1)
	go func() { erros <- srv.ListenAndServe() }()
	select {
	case err := <-erros:
		db.Close()
		log.Fatal(err)
	case <-ctx.Done():
	}
	fim, cancelar := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelar()
	if err := srv.Shutdown(fim); err != nil {
		log.Printf("a parar: %v", err)
	}
	if err := db.Close(); err != nil {
		log.Printf("a fechar a base de dados: %v", err)
	}
	log.Print("mae parado")
}

func envOr(k, padrao string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return padrao
}

func abrirDB(caminho string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", "file:"+caminho+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=synchronous(NORMAL)&_pragma=temp_store(MEMORY)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(esquemaBase); err != nil {
		return nil, err
	}
	return db, nil
}

// Cabeçalhos em todas as respostas: nunca indexar, nunca adivinhar o tipo.
func cabecalhos(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Robots-Tag", "noindex, nofollow")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		h.ServeHTTP(w, r)
	})
}

func (s *servidor) cors(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Origin") == s.origem {
		w.Header().Set("Access-Control-Allow-Origin", s.origem)
		w.Header().Set("Vary", "Origin")
	}
}

// O pedido prévio é respondido antes de qualquer conferência de acesso: não traz credenciais.
func (s *servidor) preflight(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Origin") != s.origem {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	s.cors(w, r)
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
	w.Header().Set("Access-Control-Max-Age", "86400")
	w.WriteHeader(http.StatusNoContent)
}

// api envolve os pontos de acesso do tablet: CORS para a origem da app e conferência do token em tempo constante.
func (s *servidor) api(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s.cors(w, r)
		w.Header().Set("Cache-Control", "no-store")
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		soma := sha256.Sum256([]byte(token))
		if !ok || subtle.ConstantTimeCompare(soma[:], s.tokenHash) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		h(w, r)
	}
}

type lote struct {
	Registos []json.RawMessage `json:"registos"`
}

func (s *servidor) receberRegistos(w http.ResponseWriter, r *http.Request) {
	var l lote
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxCorpo)).Decode(&l); err != nil {
		http.Error(w, "pedido inválido", http.StatusBadRequest)
		return
	}
	if len(l.Registos) > maxPorLote {
		http.Error(w, "registos a mais", http.StatusRequestEntityTooLarge)
		return
	}
	// O ecrã da família no tablet sonda o servidor com um lote vazio cada vez que abre.
	// Nada a guardar: responder logo, sem transação e sem linha no registo do servidor.
	if len(l.Registos) == 0 {
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"aceites":[]}`+"\n")
		return
	}
	agora := time.Now().UTC().Format(time.RFC3339)
	tx, err := s.db.Begin()
	if err != nil {
		http.Error(w, "erro do servidor", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()
	ins, err := tx.Prepare(`INSERT OR IGNORE INTO registos(rid, device, tipo, game, quando, recebido, dados) VALUES(?,?,?,?,?,?,?)`)
	if err != nil {
		http.Error(w, "erro do servidor", http.StatusInternalServerError)
		return
	}
	defer ins.Close()

	// Um registo mau nunca recusa o lote: é saltado e fica fora de "aceites", por isso o tablet
	// guarda-o e manda-o outra vez no lote seguinte (inofensivo: a app dá sempre um rid a um
	// registo, e o maior registo que faz tem menos de 1 KB). Os bons passam.
	// Os rids já guardados são dados outra vez como aceites, para um lote repetido ficar marcado como enviado.
	aceites := make([]string, 0, len(l.Registos))
	novos := 0
	for _, bruto := range l.Registos {
		if len(bruto) > maxRegisto {
			continue
		}
		var reg struct {
			Rid       string `json:"rid"`
			Device    string `json:"device"`
			Tipo      string `json:"tipo"`
			Game      string `json:"game"`
			At        string `json:"at"`
			StartedAt string `json:"started_at"`
		}
		if json.Unmarshal(bruto, &reg) != nil || reg.Rid == "" || len(reg.Rid) > maxRid {
			continue
		}
		quando := reg.StartedAt
		if quando == "" {
			quando = reg.At
		}
		res, err := ins.Exec(reg.Rid, curto(reg.Device, 64), curto(reg.Tipo, 32), curto(reg.Game, 32), curto(quando, 40), agora, string(bruto))
		if err != nil {
			continue
		}
		if n, _ := res.RowsAffected(); n > 0 {
			novos++
		}
		aceites = append(aceites, reg.Rid)
	}
	if err := tx.Commit(); err != nil {
		http.Error(w, "erro do servidor", http.StatusInternalServerError)
		return
	}
	log.Printf("registos: lote %d, novos %d", len(l.Registos), novos)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"aceites": aceites})
}

func curto(t string, n int) string {
	if len(t) > n {
		return t[:n]
	}
	return t
}

// O versao.json em publico/ descreve o último pacote web e a última media, com o sha256 de cada ficheiro.
func (s *servidor) versao(w http.ResponseWriter, r *http.Request) {
	f, err := os.Open(filepath.Join(s.publico, "versao.json"))
	if errors.Is(err, os.ErrNotExist) {
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, "{}")
		return
	}
	if err != nil {
		http.Error(w, "erro do servidor", http.StatusInternalServerError)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", "application/json")
	io.Copy(w, f)
}

// Serve um ficheiro de publico/ com Range (descargas retomadas no Wi-Fi de um hospital).
func (s *servidor) ficheiro(w http.ResponseWriter, r *http.Request) {
	rel := path.Clean("/" + strings.TrimPrefix(r.URL.Path, "/api/ficheiros/"))
	if rel == "/" || strings.Contains(rel, "..") {
		http.NotFound(w, r)
		return
	}
	completo := filepath.Join(s.publico, filepath.FromSlash(rel))
	if !strings.HasPrefix(completo, s.publico+string(os.PathSeparator)) {
		http.NotFound(w, r)
		return
	}
	f, err := os.Open(completo)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || info.IsDir() {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "private, max-age=0")
	w.Header().Set("ETag", `"`+info.ModTime().UTC().Format("20060102150405")+"-"+strconv.FormatInt(info.Size(), 10)+`"`)
	http.ServeContent(w, r, info.Name(), info.ModTime(), f)
}
