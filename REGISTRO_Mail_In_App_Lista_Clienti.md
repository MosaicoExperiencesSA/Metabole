# Registro modifiche — Tasto Email in-app nella lista clienti/lead

**Data:** 23 luglio 2026 · Base: main.

## Summary
Nella lista "Le tue clienti" (coach) e "Pazienti" (nutrizionista), il tasto **Email** (bustina)
apriva il chooser di Android ("Apri con": Gmail, Outlook, PayPal, Proton Mail…) perché usava un
link `mailto:`. Ora apre la **Posta interna** dell'app: la stessa modale usata nella scheda lead,
che invia dalla casella `@metabole.eu` dell'operatore via `POST /me/mailbox/send` — senza uscire
dall'app.

## Description
`app/src/components/../staff/shared/ContactActions.tsx` (usato da `CoachClienti` e `NutriPazienti`):
- Import di `EmailComposeModal` (già esistente, usato anche in `CoachLeadDetail`).
- Il tasto Email non è più un link `mailto:` ma un pulsante che apre `EmailComposeModal`
  (`to = email`, `name`). Stato `modal` esteso con `'email'`.
- Se il contatto non ha email, il tasto resta disabilitato come prima.

## Verifica
- `tsc --noEmit` sull'app: OK.
- Nessun cambio backend/API: riusa l'endpoint mailbox già in produzione.

## Note
- La casella `@metabole.eu` dell'operatore dev'essere configurata nel backoffice; se non lo è,
  il backend risponde con un messaggio chiaro che la modale mostra così com'è.
