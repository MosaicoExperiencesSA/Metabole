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

## Aggiunta — errori parlanti su TUTTE le operazioni di posta (18/07, secondo blackout)
La posta si è fermata di nuovo (hosting SiteGround). Il primo giro di errori parlanti
copriva solo "Collega casella": lettura inbox, apertura messaggio e invio rispondevano
ancora col generico "Lettura della posta non riuscita", che non permette di capire se il
problema è la password, il server fermo o il firewall dell'hosting.

- La classificazione è stata estratta in un helper (`describeMailError`) e ora è usata da
  **tutte** le operazioni: collega casella, inbox, apertura messaggio, invio SMTP.
- Aggiunto il caso `ECONNRESET`/socket chiuso ("connessione INTERROTTA durante
  l'operazione: instabilità o protezione anti-abuso lato hosting") e, nei messaggi di
  timeout/rifiuto, il sospetto esplicito "IP del backend bloccato dal firewall".

### Perché il sospetto sul firewall SiteGround
Il quadro "ieri andava, oggi no, poi riparte da solo" con webmail funzionante è il
comportamento tipico della protezione anti-abuso di SiteGround che blocca TEMPORANEAMENTE
l'IP del backend (Render) dopo una serie di connessioni IMAP ravvicinate o login falliti.
Il webmail passa dal browser di Simone (IP diverso) e quindi continua a funzionare.

**Verifica/risoluzione (lato Simone, 10 minuti):**
1. Nel backoffice → Posta: leggere il NUOVO messaggio d'errore (ora dice la causa).
2. Se dice timeout/rifiutata ma il webmail funziona → è quasi certamente il blocco IP.
3. Render → servizio backend → scheda "Connect" → copiare gli **Outbound IP** (statici).
4. Chiedere al supporto SiteGround di metterli in **whitelist** per IMAP/SMTP
   (o Site Tools → Sicurezza). Da lì il problema non si ripresenta più.
