# Handoff pubblicazione — modifiche del 23/07/2026

Nota per l'agente che si occupa di deploy/pubblicazione. Tutte le modifiche sono su `main`
(committate). **Nessuna migration nuova, nessuna nuova variabile d'ambiente.**

## TL;DR deploy
- **Backend (Render):** deploy normale. Nessuna migration nuova, nessun comando extra, nessun env nuovo.
- **Backoffice (Vercel):** build & deploy normale.
- **App cliente (Vercel web + Capacitor Android):** deploy web normale. **Serve una nuova build
  Android + rilascio store** solo se l'app bundla gli asset web; se il wrapper Capacitor carica il
  web deployato, basta il deploy web. ⟵ decisione tua (vedi "App Android").

## Superfici toccate
- **backend** (NestJS su Render)
- **app** (client PWA / Capacitor Android su Vercel)
- **backoffice** (React su Vercel)

## Commit inclusi (su main, in ordine)
| Commit | Area | Cosa |
|---|---|---|
| a24c545 | app + backend | Pulsante "Seguita" ora si evidenzia; notifica "Cliente silenziosa" mostrava `{days}` → ora il numero |
| 4595c66 | app | Tasto Email nella lista clienti/lead → apre la Posta interna, non il chooser Android |
| d0aca7c | backend | Promemoria misure allineato al ciclo (primo menu 20 → misura il 21, non il 20) |
| 2d39a41 | app | Report: invito "chiedi alla coach per sconti esclusivi" sotto il prezzo |
| 2ffc538 | backend | Rete di sicurezza: piano gratuito con durata non valida → 8 giorni, non 3 mesi |
| 2504de7 | backoffice | Avviso nel form piani quando un piano €0 ha durata non in giorni |
| 5e0628e | backend | Script diagnostico abbonamenti (`npm run diag:subs`) — strumento manuale, non tocca il runtime |
| cc2998e | backend + app + backoffice | "Nessun piano attivo": niente menu senza abbonamento attivo; scheda backoffice coerente |
| e0ee7f4 | backend + app | Piano scaduto: nascosto solo il menu di oggi, storico sempre leggibile |

## Migration
- **Nessuna migration nuova** in questo batch (tutte modifiche di comportamento a runtime).
- ⚠ Verifica solo che la migration **`20260722180000_crm_phone2`** (colonna `phone2`, da un lavoro
  precedente) risulti **già applicata** in produzione (`prisma migrate deploy`). Se lo è già, niente
  da fare.

## Variabili d'ambiente
- Nessuna nuova.

## Azioni manuali (facoltative, NON bloccanti per il deploy)
- `npm run diag:subs -- <email>` dalla Shell di Render: strumento diagnostico in **sola lettura**
  (elenca abbonamenti/pagamenti di un account). Da usare on-demand, non al deploy.

## App Android (Capacitor) — richiede la tua valutazione
Le modifiche in `app/src/**` sono lato client (dashboard, popup misure, Posta, report, banner
"Nessun piano attivo"). Se l'app Android:
- **carica il web deployato** → basta il deploy web (Vercel), nessun rilascio store;
- **bundla gli asset web nel pacchetto** → serve `npm run build` dell'app + `npx cap sync android` +
  nuova build e rilascio su Play Store.
File client toccati: `app/src/pages/Home.tsx`, `app/src/pages/Report.tsx`,
`app/src/components/MenuReviewPopup.tsx`, `app/src/components/MenuStatusBanner.tsx`,
`app/src/staff/shared/ContactActions.tsx`.

## Test / verifica
- Validati con transpile per-file (backend) + `tsc --noEmit` (app e backoffice): tutti OK.
- La suite `jest` NON è stata eseguita in questo ambiente (il client Prisma non è generabile nel
  sandbox: errori "Property X does not exist on PrismaService" su tutti i file). **Da lanciare in
  CI/locale** (`npm test` nel backend, dove `prisma generate` è disponibile) prima del rilascio.
  Test aggiornati in questo batch: `notifications.service.spec.ts` (mock `menu.measurementGate`).

## Ordine di deploy consigliato
1. Backend (Render) — le modifiche menu/notifiche/commerce sono qui.
2. Backoffice (Vercel).
3. App cliente (Vercel web; poi eventuale build Android se serve).
Nessuna dipendenza stretta tra le tre: possono andare in qualsiasi ordine, ma il backend prima
evita finestre in cui l'app nuova chiama un backend vecchio.
