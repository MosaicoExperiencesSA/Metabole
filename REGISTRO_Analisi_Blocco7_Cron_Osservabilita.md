# Registro modifiche — Analisi, Blocco 7 (robustezza cron + osservabilità)

**Data:** 21 luglio 2026 · Base: origin/main 44125c3.

## Summary
Il cron notturno (`POST /internal/cron/daily`) eseguiva ~13 job **in sequenza senza
protezione**: se uno falliva a metà, **tutti i successivi saltavano** per l'intera notte e il
log finale non veniva nemmeno scritto (nessuna traccia di cosa fosse girato). In più un
**webhook Stripe fallito** non lasciava traccia. Ora ogni job è **isolato**, il cron scrive
**sempre un heartbeat** con esiti e durata, e i webhook falliti vengono **tracciati**.

## Description
`cron.controller.ts` — metodo `daily()`
- Ogni job passa da un helper `step(nome, fn)` con **try/catch individuale**: se fallisce, si
  registra l'errore in `failures[]` e si **prosegue** con i job seguenti. Nessun job può più
  bloccare gli altri.
- **Heartbeat sempre scritto**: l'audit `cron.daily` viene registrato **anche con fallimenti
  parziali**, con `_meta = { durationMs, ok, failures }`. Così ogni notte si vede che il cron è
  girato, quanto ha impiegato e cosa è fallito. Se persino l'audit fallisce (DB giù),
  l'endpoint non cade: fallback su `console.error`.
- I fallimenti vengono anche stampati su `console.error` (visibili nei log di Render).

`commerce.controller.ts` — `StripeWebhookController.webhook()`
- L'elaborazione del webhook è avvolta in try/catch: in caso di errore si scrive l'audit
  **`payments.webhook_failed`** (tipo/id evento + messaggio) e si **rilancia** l'eccezione, così
  **Stripe riprova** l'evento (l'elaborazione è idempotente — vedi Blocco 4) invece di perderlo.
- Iniettato `AuditService` (modulo `@Global`, nessuna modifica ai moduli necessaria).

## Perché è la soluzione giusta
Un cron che orchestra molti job deve **degradare con grazia**: il fallimento di un singolo job
(es. un report che va in errore su un cliente) non deve privare gli utenti di tutti gli altri
(notifiche, motore, scadenze prove…). L'isolamento per-step + l'heartbeat garantito danno sia
**resilienza** sia **visibilità**: si sa sempre cosa è successo. Sul webhook, tracciare-e-
rilanciare sfrutta il retry nativo di Stripe senza rischiare doppie elaborazioni.

## Note
- Nessuna migration. Nessun cambto di contratto: la `daily` restituisce gli stessi campi per
  job, con in più `_meta` (durata/esito/fallimenti).
- **Interrogazione**: filtrando l'audit per `cron.daily` (con `_meta.ok=false`) o
  `payments.webhook_failed` si ha il quadro dei problemi notturni/pagamenti.
- **Sentry (rimandato)**: l'integrazione con un servizio esterno di error-tracking (Sentry)
  richiede una dipendenza npm + un `SENTRY_DSN` da configurare. Non aggiunta ora per non
  introdurre un pacchetto non ancora configurato; heartbeat e audit dedicati coprono già la
  visibilità essenziale. Da valutare come setup separato quando si vuole l'alerting esterno.
