# Registro modifiche — Invito "sconti esclusivi" accanto al prezzo nel report

**Data:** 23 luglio 2026 · Base: main.

## Summary
Nel report di fine periodo, sotto il prezzo del pacchetto consigliato, ora compare l'invito:
"**Chiedi alla tua coach per avere accesso a sconti esclusivi riservati a te.**"

## Description
`app/src/pages/Report.tsx` — blocco offerta "CONSIGLIATO". La riga compare **solo se la cliente
non ha già un codice personale** in quel report (`!r.offer.code`): se il codice riservato è già
presente lo sconto ce l'ha di suo, quindi invitarla a chiederlo alla coach sarebbe ridondante.
Testo piccolo/muted, subito sotto il prezzo, coerente con lo stile del box.

## Verifica
- `tsc --noEmit` app: OK.
- Nessun cambio backend: usa i campi `offer` già presenti in `PlanReportData`.
