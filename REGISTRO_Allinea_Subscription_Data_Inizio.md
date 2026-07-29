# Registro modifiche — Data d'inizio scelta dalla cliente allinea la subscription

**Data:** 29 luglio 2026 · Base: main.

## Problema (confermato: lurve.gioia@gmail.com)
Inizio piano 27/07, ma badge "Nessun piano attivo / Prova Gratuita · Scaduto". Dettaglio:
subscription **20/07 → 28/07** (attivata al pagamento), `planStartDate` **27/07** (scelta dopo).
La prova scade il 28 (sulle date vecchie) pur avendo la cliente iniziato il 27.

## Causa
La prova viene attivata al pagamento con la data di allora (start = giorno di attivazione, perché
`planStartDate` è ancora vuoto). Poi lo **StartDatePrompt** dell'app chiede la data (compare solo se
`planStartDate` è vuoto) e la salva via `PATCH /me/client-profile` → `ProfileService.updateProfile`,
che aggiornava **solo il profilo, non la subscription**. Risultato: date disallineate → scaduta.

## Fix — `backend/src/profile/profile.service.ts`
- Quando `planStartDate` viene impostato **per la prima volta** (era vuoto), ora si **allinea la
  subscription** principale (attivo > in attesa > scaduto > annullato): `startDate` = data scelta,
  `endDate` = `subscriptionEnd(data, period)`, e se la nuova fine è nel futuro e l'abbonamento era
  approvato (attivo/scaduto) → **riattivazione** a `active`. Con audit
  (`profile.plan_start.align_subscription`). Non bloccante (un errore non ferma il salvataggio).
- Solo al PRIMO inserimento: cambi successivi restano di competenza staff (`updatePlanStart`,
  permesso `change_plan_start`), quindi niente estensioni ripetute della prova dal client.
- Onboarding pre-pagamento invariato: se non c'è ancora una subscription, non fa nulla; poi
  `finalizeApproval` userà già la data scelta.

## Sistemare lurve (e simili) SUBITO
Dalla scheda cliente: **ri-salvare la data di inizio** con la matita ("sposta inizio piano") →
`updatePlanStart` ricalcola fine (+8 giorni) e **riattiva** (fix già in produzione). In alternativa,
per i casi con fine futura: `npm run reactivate:future-expired -- --apply`.

## Verifica
- Transpile `profile.service.ts`: OK, NUL check OK.

## Impatto / deploy
- **Solo backend (Render)**: nessun aggiornamento app/store. Nessuna migration/env.
