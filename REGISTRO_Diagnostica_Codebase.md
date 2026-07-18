# Registro modifiche — Diagnostica codebase (script del socio, corretto ed eseguito)

**Data:** 18 luglio 2026 · Base: origin/main 141ed19.

## Summary
Lo script `diagnostica.sh` inviato dal socio è un **audit read-only del codice** (non va
"caricato" da nessuna parte: si lancia sulla cartella del progetto e scrive un report).
La bozza aveva alcuni pattern rotti che avrebbero prodotto risultati vuoti o sbagliati:
è stata **corretta e salvata nel repo** come `scripts/diagnostica.sh`, poi **eseguita sui
tre progetti** (backend, backoffice, app). Esito: **nessun segreto nel codice, nessun
file .env committato, zero finding SAST** — restano solo dipendenze da aggiornare
(dettaglio sotto).

## Description

### Correzioni alla bozza del socio
- `find -path '/node_modules'` → `-path '*/node_modules'` (senza asterisco non escludeva nulla).
- `-name '.js'` / `--include='.js'` → `'*.js'` ecc. (senza asterisco non trovava alcun file).
- Regex segreti: la bozza aveva `passw/1` (refuso) e non richiedeva un valore assegnato →
  ora cerca `chiave[:=]"valore di almeno 8 caratteri"` ed esclude i falsi positivi
  `process.env` / `import.meta.env` / `config.get`.
- Rimossa la sezione "computazioni pesanti" (regex non funzionante, troppi falsi positivi).
- Aggiunte: nome progetto nel nome del report (`report-backend-…txt`), variabile
  `SEMGREP_CONFIG` per usare regole locali quando semgrep.dev non è raggiungibile, e
  `scripts/diagnostica-regole.yml` (8 regole: eval, command injection, SQL raw interpolato,
  dangerouslySetInnerHTML, TLS disattivato, MD5/SHA1 per password, segreto JWT nel codice,
  CORS aperto con credenziali).

### Come si usa
```
./scripts/diagnostica.sh backend      # oppure backoffice, app
# offline (senza accesso a semgrep.dev):
SEMGREP_CONFIG=scripts/diagnostica-regole.yml ./scripts/diagnostica.sh backend
```
Il report finisce in `report-diagnostica/` (aggiunta al `.gitignore`: i report possono
citare stringhe sensibili e non vanno committati).

### Esito dell'esecuzione (18/07/2026)
**Sicurezza — tutto pulito:**
- Nessun segreto hardcoded (le uniche righe trovate sono `password123` nei file di TEST
  `*.spec.ts`: dati finti, nessun rischio).
- Nessun file `.env` nel repo; nessuna variabile `VITE_*` con segreti esposta al browser.
- Semgrep: **0 finding su 437 file** (8 regole).
- Sez. 3 "logica sensibile nel client": i match in backoffice/app sono **falsi positivi
  legittimi** — UI admin che MOSTRA provvigioni/prelievi/sconti; i calcoli veri stanno tutti
  nel backend e lo sconto in Checkout è validato dal server (`/me/discounts/validate`).

**Dipendenze (unica vera area di lavoro, nessuna critica):**
- `app`: **3 high** da `tar` via `@capacitor/cli` (solo tool di build, non finisce
  nell'app) + 1 moderate `esbuild` (solo dev server Vite). Fix = Capacitor 8 / Vite 8,
  entrambi breaking → da pianificare DOPO il collaudo, non urgente.
- `backoffice`: 1 moderate `esbuild` (dev server, stesso discorso).
- `backend`: 8 moderate da `uuid` via `firebase-admin` (fix = firebase-admin 14, breaking).
- Obsolete principali: React 18→19, Vite 5→8, Prisma 6→7, Capacitor 6→8 — aggiornamenti
  major da fare con calma in una finestra dedicata.

**Debito tecnico (informativo):** file >500 righe segnalati (commerce.service.ts 1591,
seed.ts 1219, ClientDetail.tsx 1283, …) — funzionano, ma sono i candidati a uno split
futuro. Un solo TODO nel codice (un commento descrittivo, non un lavoro mancante).

## Note
- Lo script non modifica nulla: solo lettura + report.
- `gitleaks` non era disponibile nella sandbox → usato il fallback grep previsto dallo
  script; sul computer del socio con gitleaks installato la scansione segreti è più ricca.
- Consiglio: rilanciare la diagnostica prima di ogni release importante.
