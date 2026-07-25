# Registro modifiche — Rete di sicurezza sulla durata dei piani gratuiti

**Data:** 23 luglio 2026 · Base: main.

## Summary
Un piano **gratuito** (attivazione a €0) con la **durata (`period`) non configurata** o in un
formato non valido non deve più ricevere il fallback lungo di `subscriptionEnd` (**3 mesi**):
sarebbe accesso gratuito per mesi. Ora in questi casi si applica un **default prudente di 8
giorni** (durata prova) e si scrive un evento in audit per rendere visibile la mala-configurazione.

## Description
`backend/src/commerce/commerce.service.ts`
- Nuova funzione esportata `isKnownPeriod(period)`: `true` solo se il period è `Nd/Nw/Nm/Ny`
  oppure `maintenance`. Costante `FREE_PLAN_FALLBACK_PERIOD = '8d'`.
- In `finalizeApproval`, alla scrittura di `endDate`: se l'attivazione è **gratuita**
  (`payment.amountCents === 0`) **e** il period del piano **non è valido**, si usa `8d` invece
  del fallback a 3 mesi. Se scatta la rete, si registra `commerce.free_plan_period_fallback`
  in audit (rawPeriod → appliedPeriod).
- I piani con period valido non cambiano: `8d` resta 8 giorni, `maintenance` resta 1 mese, i
  piani a pagamento non sono toccati (la rete agisce solo sulle attivazioni a €0).

## Cosa NON copre (importante)
La rete interviene solo quando la durata è **non valida**. Se un piano gratuito è configurato con
un period **valido ma "sbagliato"** (es. `maintenance` = 1 mese), la durata resta quella: in quel
caso il problema è la scelta del piano, non un fallback. Vedi nota sull'account qui sotto.

## Verifica
- Transpile `commerce.service.ts`: OK (0 diagnostics), NUL check OK.
- Nessuna migration, nessun cambio schema/API.
