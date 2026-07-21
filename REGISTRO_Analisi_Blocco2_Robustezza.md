# Registro modifiche — Analisi, Blocco 2 (robustezza)

**Data:** 21 luglio 2026 · Base: origin/main cddb2d7.

Interventi dai punti dell'analisi a rischio basso e valore alto.

## 1) Refresh token "single-flight" (analisi #8) — app + backoffice
`app/src/api/client.ts`, `backoffice/src/api/client.ts`: se più chiamate ricevono 401
contemporaneamente, ora **un solo** refresh gira e le altre ne condividono il risultato
(`refreshInFlight`). Prima ogni chiamata rinnovava per conto suo: il primo ruotava il
refresh token, gli altri usavano quello vecchio (revocato) → **logout involontario** in
mezzo al lavoro. Risolto.

## 2) ErrorBoundary globale (analisi #8) — app + backoffice
Nuovo `components/ErrorBoundary.tsx`, montato in cima in `main.tsx`. Un errore di rendering
in un punto qualsiasi non azzera più l'intera interfaccia (**schermo bianco**): compare un
messaggio con "Ricarica". Logga l'errore in console (aggancio futuro a un error tracker).

## 3) Secret "fail-closed" (analisi #3) — backend
- `auth/auth.module.ts`: `JWT_ACCESS_SECRET` ora **obbligatorio sempre** (rimosso il fallback
  pubblico `dev-only-insecure-secret` e la condizione su `NODE_ENV`).
- `commerce/commerce.service.ts`: `FILE_ENCRYPTION_KEY` obbligatoria (rimosso
  `dev-only-file-key`).
- `marketing/marketing.service.ts` + `marketing/lifecycle.service.ts`: il secret del token
  preferenze usa `PREFS_TOKEN_SECRET` o, in mancanza, `JWT_ACCESS_SECRET`; se nessuno è
  presente → errore (niente più `dev-only-...`).
- **Impatto zero in produzione**: su Render `JWT_ACCESS_SECRET` e `FILE_ENCRYPTION_KEY` sono
  generate automaticamente (`generateValue`) → sempre presenti. Il cambiamento fa solo
  fallire l'avvio in un ambiente mal configurato invece di firmare con un secret pubblico.

## Note
- Nessuna migration. Solo hardening + resilienza UI.
- CI bloccante + test rosso (analisi #4): NON in questo blocco — richiede un ambiente con
  Prisma generato per verificare l'intera suite, che nella sandbox non è disponibile; lo
  tratto a parte con cautela.
