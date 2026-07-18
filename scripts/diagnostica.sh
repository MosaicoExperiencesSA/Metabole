#!/usr/bin/env bash
#
# diagnostica.sh — audit rapido di un codebase (default: progetto Node/JS/TS web)
# (versione corretta dei pattern find/grep rispetto alla bozza: '*.js' con asterisco,
#  '*/node_modules' nel prune, regex password sistemata — vedi REGISTRO)
#
# Uso: ./diagnostica.sh /percorso/del/progetto
# Non modifica nulla: scrive solo un report in ./report-diagnostica/
# ---------------------------------------------------------------------------
set -uo pipefail
TARGET="${1:-.}"
OUT="report-diagnostica"
mkdir -p "$OUT"
STAMP="$(date +%Y%m%d-%H%M%S)"
NOME="$(basename "$(cd "$TARGET" && pwd)")"
REPORT="$OUT/report-$NOME-$STAMP.txt"
# Regole semgrep: di default 'auto' (scarica da semgrep.dev); se offline si può
# passare un file locale:  SEMGREP_CONFIG=scripts/diagnostica-regole.yml ./scripts/diagnostica.sh backend
SEMGREP_CONFIG="${SEMGREP_CONFIG:-auto}"
log()  { echo -e "$1" | tee -a "$REPORT"; }
sect() { log "\n================================================================"; log "$1"; log "================================================================"; }
has()  { command -v "$1" >/dev/null 2>&1; }
log "Diagnostica codebase — $STAMP"
log "Target: $TARGET"
# ---------------------------------------------------------------------------
sect "0) Verifica strumenti"
has node    && log "[ok] node    $(node -v)"    || log "[!] node non trovato"
has npm     && log "[ok] npm     $(npm -v)"     || log "[!] npm non trovato"
has semgrep && log "[ok] semgrep $(semgrep --version 2>/dev/null)" || log "[!] semgrep mancante (pip install semgrep)"
has gitleaks && log "[ok] gitleaks presente"    || log "[!] gitleaks mancante (per scansione segreti dedicata)"
# ---------------------------------------------------------------------------
sect "1) PUNTI DEBOLI"
if [ -f "$TARGET/package.json" ]; then
  log "\n-- Dipendenze obsolete (npm outdated) --"
  (cd "$TARGET" && npm outdated) 2>&1 | tee -a "$REPORT"
  log "\n-- TODO / FIXME / HACK nel codice --"
  grep -rn -E "TODO|FIXME|HACK|XXX" "$TARGET/src" "$TARGET/app" "$TARGET/pages" 2>/dev/null | head -50 | tee -a "$REPORT"
  log "\n-- File molto grandi (possibile debito tecnico, >500 righe) --"
  find "$TARGET" -path '*/node_modules' -prune -o \( -name '*.js' -o -name '*.ts' -o -name '*.tsx' -o -name '*.jsx' \) -print 2>/dev/null \
    | xargs wc -l 2>/dev/null | awk '$1>500{print}' | sort -rn | head -20 | tee -a "$REPORT"
else
  log "[!] package.json non trovato in $TARGET — salto i controlli Node."
fi
# ---------------------------------------------------------------------------
sect "2) BUCHI DA CHIUDERE (sicurezza)"
if [ -f "$TARGET/package.json" ]; then
  log "\n-- Vulnerabilità dipendenze (npm audit) --"
  (cd "$TARGET" && npm audit) 2>&1 | tee -a "$REPORT"
fi
log "\n-- Ricerca segreti hardcoded (API key, token, password, chiavi private) --"
if has gitleaks; then
  gitleaks detect --source "$TARGET" --no-git --report-format csv --report-path "$OUT/segreti-$STAMP.csv" 2>&1 | tee -a "$REPORT"
  log "Dettaglio segreti -> $OUT/segreti-$STAMP.csv"
else
  grep -rn -E "(api[_-]?key|secret|passw(or)?d|token|private[_-]?key|BEGIN (RSA|EC|OPENSSH) PRIVATE)[\"']?\s*[:=]\s*[\"'][^\"']{8,}" \
    "$TARGET" --include='*.js' --include='*.ts' --include='*.tsx' --include='*.jsx' --include='*.env' \
    2>/dev/null | grep -v node_modules | grep -viE "process\.env|import\.meta\.env|config\.get|例" | head -50 | tee -a "$REPORT"
fi
log "\n-- File .env committati (NON dovrebbero stare nel repo) --"
find "$TARGET" -path '*/node_modules' -prune -o -name '.env' -print 2>/dev/null | tee -a "$REPORT"
if has semgrep; then
  log "\n-- SAST: pattern insicuri (semgrep, regole: $SEMGREP_CONFIG) --"
  semgrep --config="$SEMGREP_CONFIG" --metrics=off --quiet "$TARGET" 2>&1 | tail -200 | tee -a "$REPORT"
else
  log "[!] semgrep mancante: salto l'analisi statica di sicurezza (fortemente consigliato installarlo)."
fi
# ---------------------------------------------------------------------------
sect "3) FRONTEND vs SERVER"
log "Elementi trovati nel codice client che è più sicuro/efficiente spostare sul server."
CLIENT_DIRS="$TARGET/src $TARGET/app $TARGET/pages $TARGET/components $TARGET/public"
log "\n-- Chiavi/segreti esposti al browser (variabili VITE_/NEXT_PUBLIC_ con valori sensibili) --"
grep -rn -E "(NEXT_PUBLIC_|REACT_APP_|VITE_)[A-Z_]*(SECRET|KEY|TOKEN|PASSWORD|PRIVATE)" $CLIENT_DIRS 2>/dev/null | grep -v node_modules | tee -a "$REPORT"
log "\n-- Logica sensibile lato client (prezzi, commissioni, calcoli finanziari, auth) --"
grep -rni -E "(commission|payout|bonus|discount|balance|withdraw|verify.?password|is.?admin|role.?==?.?.admin)" \
  $CLIENT_DIRS 2>/dev/null | grep -v node_modules | head -40 | tee -a "$REPORT"
log "\n-- Chiamate DB / query dirette in codice client (dovrebbero stare in API/backend) --"
grep -rn -E "(SELECT .* FROM|INSERT INTO|mongoose|prisma\.)" $CLIENT_DIRS 2>/dev/null | grep -v node_modules | head -30 | tee -a "$REPORT"
log "\n-- Validazione presente SOLO lato client (rischio: bypassabile) --"
grep -rln -E "(schema\.parse|yup|zod)" $CLIENT_DIRS 2>/dev/null | grep -v node_modules | tee -a "$REPORT"
log "   (verifica manuale: la stessa validazione esiste anche nell'API server?)"
# ---------------------------------------------------------------------------
sect "FATTO"
log "Report completo: $REPORT"
log ""
log "Priorità di lettura:"
log "  1. Segreti esposti (sez. 2 e 3)  -> chiudere SUBITO"
log "  2. npm audit 'high/critical'      -> aggiornare"
log "  3. Logica finanziaria nel client  -> spostare su API server"
