#!/usr/bin/env bash
# Metabole — Smoke test API (endpoint pubblici + salute)
# Uso:  BASE=https://metabole-backend.onrender.com ./metabole_smoke.sh
#       (default BASE = produzione Render)
set -u
BASE="${BASE:-https://metabole-backend.onrender.com}"
PASS=0; FAIL=0
say(){ printf "%-42s" "$1"; }
ok(){ echo "  ✅ $1"; PASS=$((PASS+1)); }
ko(){ echo "  ❌ $1"; FAIL=$((FAIL+1)); }

echo "== Metabole smoke test =="
echo "BASE: $BASE"
echo

# 1) Health
say "GET /health"
BODY=$(curl -fsS --max-time 20 "$BASE/health" 2>/dev/null)
if echo "$BODY" | grep -q '"status":"ok"' && echo "$BODY" | grep -q '"database":"up"'; then ok "status ok, db up"; else ko "risposta inattesa: $BODY"; fi

# 2) Piani pubblici
say "GET /api/v1/plans"
CODE=$(curl -s -o /tmp/plans.json -w "%{http_code}" --max-time 20 "$BASE/api/v1/plans")
if [ "$CODE" = "200" ] && grep -q '"priceCents"' /tmp/plans.json; then ok "$(grep -o '"id"' /tmp/plans.json | wc -l | tr -d ' ') piani"; else ko "HTTP $CODE"; fi

# 3) Prodotti pubblici
say "GET /api/v1/products"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$BASE/api/v1/products")
[ "$CODE" = "200" ] && ok "HTTP 200" || ko "HTTP $CODE"

# 4) Metodi di pagamento
say "GET /api/v1/payment-methods"
BODY=$(curl -fsS --max-time 20 "$BASE/api/v1/payment-methods" 2>/dev/null)
echo "$BODY" | grep -q '"card"' && ok "$BODY" || ko "risposta inattesa: $BODY"

# 5) Endpoint pubblico lead (BLOCKER #1) — atteso 2xx quando implementato
say "POST /api/v1/public/leads"
CODE=$(curl -s -o /tmp/lead.json -w "%{http_code}" --max-time 20 \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke+test@metabole.eu","nome":"Smoke Test","website":"","fonte":"smoke_test","lingua":"it"}' \
  "$BASE/api/v1/public/leads")
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then ok "HTTP $CODE (endpoint attivo)";
elif [ "$CODE" = "404" ]; then ko "HTTP 404 — endpoint NON ancora implementato (blocker #1)";
else ko "HTTP $CODE — verificare"; fi

# 6) Auth protetta risponde (401 senza token = corretto)
say "GET /api/v1/me/menu (senza token)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 "$BASE/api/v1/me/menu")
{ [ "$CODE" = "401" ] || [ "$CODE" = "403" ]; } && ok "HTTP $CODE (protetto)" || ko "HTTP $CODE (atteso 401/403)"

echo
echo "== Risultato: $PASS passati, $FAIL falliti =="
[ "$FAIL" = "0" ] && exit 0 || exit 1
