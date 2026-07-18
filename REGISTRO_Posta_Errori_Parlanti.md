# Registro modifiche — Posta: errori di collegamento casella parlanti

**Data:** 18 luglio 2026 · Base: origin/main 64e8362.

## Summary
Il "Collega casella" mostrava SEMPRE "controlla indirizzo e password", qualunque fosse la causa
(timeout del server, DNS, certificato, porta chiusa o credenziali). Caso reale: la posta ha
smesso di funzionare dall'oggi al domani e non si capiva se fosse la password o l'hosting.
Ora il messaggio distingue le cause e l'errore grezzo finisce nei log del backend.

## Description
- **mailbox.service.setAccount**: l'errore di connessione IMAP viene classificato —
  credenziali rifiutate dal server / server non trovato (DNS) / server che non risponde
  (timeout → problema hosting, non password) / connessione rifiutata (porta chiusa) /
  certificato SSL — e mostrato all'utente; il dettaglio tecnico (code, authenticationFailed,
  message) è loggato lato server (Logger) per la diagnosi su Render.

## Note
- Nessuna migration. Dopo il deploy: ripetere "Collega casella" e leggere il nuovo messaggio
  (e/o i log Render) per individuare la causa reale.
