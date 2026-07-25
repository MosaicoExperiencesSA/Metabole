# Registro modifiche — Avviso backoffice: piano gratuito con durata non in giorni

**Data:** 23 luglio 2026 · Base: main.

## Summary
Nel form dei piani (Negozio) compare un **avviso** quando un piano è **gratuito (€ 0)** e il
**Periodo non è in giorni** (o è vuoto): una prova dovrebbe durare pochi giorni (es. `8d`), mentre
un periodo mensile/annuale darebbe accesso gratuito troppo a lungo. Serve a non ricreare il caso
"prova attiva un mese".

## Description
`backoffice/src/pages/GestioneNegozio.tsx` — sotto i campi del form "Modifica/Nuovo piano",
sopra i pulsanti, banner condizionale: si mostra se `toCents(price) === 0` **e** il Periodo non
matcha `^\d+\s*d$` (giorni). Testo: invita a impostare il Periodo in giorni (es. `8d`).
È solo un promemoria visivo: non blocca il salvataggio.

## Verifica
- `tsc --noEmit` backoffice: OK.
- Nessun cambio backend/API.

## Collegamento
Complementare alla rete di sicurezza lato server (commit rete di sicurezza durata piani gratuiti):
l'avviso previene la mala-configurazione a monte; il backend fa da paracadute all'attivazione.
