# Registro modifiche — Fix pulsante "Seguita" + notifica "Cliente silenziosa" ({days})

**Data:** 23 luglio 2026 · Base: main (dopo #1–#11 + phone2 + bonifica + deep-link notifiche).

## Bug 1 — Pulsante "Seguita" non evidenzia la selezione (web + app)

### Summary
Nel popup "Com'è andata ieri?" (valutazione menu del giorno prima), premendo **Seguita**
non si vedeva alcun cambiamento: il pulsante restava identico. Il **No** invece funzionava.

### Description
`app/src/components/MenuReviewPopup.tsx`. Causa: la classe `.btn-recipe` (theme.css) ha già
come sfondo di default `var(--teal)` — lo stesso colore usato per lo stato "selezionato" di
Seguita. Quindi selezionato e non-selezionato erano visivamente **identici**. Il No si vedeva
solo perché usa un colore diverso (arancione).
Fix: entrambi i pulsanti ora hanno uno **stile esplicito anche da non selezionati**
(`background:#EEF3F1; color:#2E3E3B`), così la selezione (teal per Seguita, arancione per No)
è sempre ben visibile. La logica di salvataggio (`tags: ['seguita'] / ['non_seguita']`) era
già corretta: era solo il feedback visivo a mancare.

## Bug 2 — La notifica "Cliente silenziosa" mostrava `{days}` invece del numero di giorni

### Summary
L'alert alla coach "Cliente silenziosa" arrivava col testo letterale `{days}` al posto del
numero di giorni senza check-in.

### Description
`backend/src/notifications/notifications.service.ts` + `backend/src/i18n/messages.ts`.
Causa: quando una cliente **non ha MAI fatto un check-in**, `daysSinceCheckin` valeva
`Infinity`, quindi il parametro `days` veniva passato come `null`. L'interpolatore i18n, per
scelta di sicurezza, **lascia il segnaposto** `{days}` quando il valore è `null/undefined`
(così in sviluppo si notano i parametri mancanti) → in produzione l'utente vedeva `{days}`.
(Il testo effettivo arrivava riformulato dal layer AI, che ha mantenuto fedelmente il
segnaposto ricevuto in ingresso.)
Fix:
- Se non c'è alcun check-in, ora conto i giorni **dall'onboarding** (`onboardingCompletedAt`,
  sempre valorizzato) invece di `Infinity`. Così `days` è **sempre un numero reale**
  (mai `null`), la soglia continua a funzionare, e l'eventuale riformulazione AII riceve già
  il numero.
- Testo messaggio reso naturale: "nessun check-in da **{days} giorni**" (IT) /
  "no check-in for **{days} days**" (EN) — prima diceva solo "da {days}".

## Verifica
- Backend: transpile di `notifications.service.ts` e `messages.ts` OK (0 diagnostics), NUL check OK.
- Frontend: `tsc --noEmit` sull'app OK.

## Note
- Nessuna migration, nessun cambio di schema o API. Solo comportamento a runtime.
- Nessun testo hard-coded in DB da cambiare: il fix agisce a monte, sul valore passato.
