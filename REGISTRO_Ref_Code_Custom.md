# Registro modifiche — Ref code coach: impostazione codice a scelta (cambio MOREND01→MORENO01)

**Data:** 21 luglio 2026 · Base: origin/main ffcf7f2.

## Summary
Il backoffice ora permette di **digitare** il ref code di una coach (prima lo generava solo
in automatico). Serve per cambi mirati come **MOREND01 → MORENO01**. Cambiare il codice è
**sicuro e non perde dati**: le clienti e i lead sono legati all'**id della coach**
(`assignedCoachId`), non alla stringa del codice — quindi restano attribuiti com'erano.

## Description
- **backoffice/src/pages/Users.tsx (`generateRefCode`)**: il pulsante ref code ora apre un
  prompt in cui l'admin può **scrivere il codice** (3-12 lettere/numeri, maiuscole) oppure
  lasciarlo vuoto per generarne uno automatico. Il codice digitato viene inviato
  all'endpoint `POST /crm/coaches/:id/refcode` nel body `{ code }`.
- Il backend (già esistente) valida formato + **unicità** (contro altri staff e contro i
  codici "porta un'amica" delle clienti), mette in **maiuscolo**, aggiorna `Staff.refCode`
  e scrive l'audit `staff.refcode.generate`.

## Perché è sicuro (nessun dato perso)
- All'iscrizione con `?ref=CODICE`, il codice si risolve nell'**id staff** e si salva
  `assignedCoachId`/`assignedNutritionistId` = quell'id (vedi `autoAssignByRefCode`). La
  **stringa** del codice NON viene mai memorizzata su cliente/lead.
- Quindi cambiare `Staff.refCode` **non tocca** alcuna attribuzione esistente: tutte le
  clienti e i lead di quella coach restano collegati.
- Unico effetto: i **link di invito già condivisi** col vecchio codice non funzioneranno più
  (il nuovo codice sì). Le registrazioni già avvenute sono al sicuro.

## Come eseguire il cambio MOREND01 → MORENO01 (dopo il deploy del backoffice)
1. Backoffice → **Utenti** → riga della coach → pulsante ref code (**↻**).
2. Nel prompt digita **MORENO01** → Conferma.
3. Fatto: il codice è cambiato, le clienti/lead restano attribuite.
   (Se "MORENO01" risultasse già in uso, il sistema lo segnala: scegliere un altro.)

## Note
- Nessuna migration. Solo UI backoffice (l'endpoint accettava già un codice a scelta).
