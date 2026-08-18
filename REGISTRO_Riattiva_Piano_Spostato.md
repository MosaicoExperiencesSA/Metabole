# Registro modifiche — Spostare l'inizio piano riattiva l'abbonamento scaduto

**Data:** 23 luglio 2026 · Base: main.

## Problema (confermato sui dati reali)
Patty — 1 abbonamento **`expired`** "Prova Gratuita" con date **NEL FUTURO**
(`start 30/07 → end 07/08`, oggi 28/07). Risultato: badge "Nessun piano attivo / Scaduto" e
nessun menu, pur avendo un piano che parte tra 2 giorni.

## Causa
`updatePlanStart` (spostamento "Inizio piano" dalla scheda) ricalcolava `startDate`/`endDate` dalla
durata del piano ma **non aggiornava lo `status`**. Se l'abbonamento era già scaduto (il cron
l'aveva portato a `expired` sulle date vecchie), restava `expired` anche con la nuova fine nel
futuro. Un abbonamento `expired` con `endDate` futura può nascere SOLO così (il cron scade solo se
`endDate < ora`).

## Fix
- `backend/src/clients/clients.service.ts` (`updatePlanStart`): se la **nuova fine è nel futuro** e
  l'abbonamento era già approvato (`active` o `expired`), lo **riporta ad `active`**. Non tocca
  `pending` (pagamento non approvato) né `cancelled` (stato terminale voluto). La riattivazione è
  registrata in audit (`after.reactivated`).
- **Script una-tantum** `backend/prisma/reactivate-future-expired.ts` + npm `reactivate:future-expired`
  (dry-run + `--apply`): riattiva TUTTI gli abbonamenti già rimasti `expired` con `endDate` nel
  futuro (sistema patty e ogni altro caso pregresso). Sicuro: quello stato deriva solo da uno
  spostamento in avanti.

## Come sistemare patty (e simili) SUBITO dopo il deploy backend
Dalla Shell di Render sul backend:
```
npm run reactivate:future-expired              # mostra chi verrebbe riattivato
npm run reactivate:future-expired -- --apply   # applica
```
In alternativa, dalla scheda cliente ri-salvare la data di inizio (ora riattiva da solo).

## Verifica
- Transpile `clients.service.ts` e lo script: OK. NUL check OK. package.json valido.

## Impatto / deploy
- **Solo backend (Render)**: nessun aggiornamento app/store. Nessuna migration, nessun env nuovo.
- Collegato al fix precedente "hasActivePlan basato sullo stato": ora lo stato è coerente e la
  scheda/app rispecchiano la realtà.
