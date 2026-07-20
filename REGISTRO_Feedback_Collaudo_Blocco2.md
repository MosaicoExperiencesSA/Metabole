# Registro modifiche — Feedback collaudo, blocco 2

**Data:** 20 luglio 2026 · Base: origin/main c38286a (sopra il blocco 1).

## Summary
Due lavori: **(1) il caso "tacchino"** — quando il cibo da togliere è l'ingrediente
PRINCIPALE del piatto ora si cambia proprio piatto (prima non succedeva nulla di
visibile); **(2) utenze collegate** — l'admin collega un'utenza cliente a una staff
della stessa persona, che poi passa da un profilo all'altro nell'app senza logout,
con barra rossa scorrevole "ATTENZIONE PROFILO TECNICO" quando è nel profilo staff.

## Description

### Fix "togli il tacchino" (segnalazione dal collaudo)
Il problema: la sostituzione lavorava solo a livello di INGREDIENTE dentro al piatto,
con una mappa di sostituti sicuri ("latte→bevanda vegetale"…). "Tacchino" non era in
mappa → nessun cambiamento visibile; e comunque il titolo del piatto non cambiava mai.
- **Nuova regola**: se il cibo escluso compare nel NOME del piatto (es. "Polpettine di
  tacchino…"), il PIATTO viene sostituito con un'alternativa equivalente: stesso pasto
  (slot), stesso regime, kcal più vicine, e senza NESSUN cibo escluso (né gli altri non
  graditi né le parole chiave delle intolleranze). Lo scambio è annotato sul pasto
  (from→to) come le sostituzioni.
- Vale sia nella correzione immediata dei 3 giorni ("Sostituisci un ingrediente") sia
  **in erogazione**: i menu futuri nascono già senza i piatti a base dei cibi esclusi.
- Se il cibo è solo tra gli ingredienti secondari resta la sostituzione annotata; il
  messaggio all'utente ora invita a scrivere alla coach se vede ancora il cibo.
- NB: serve il deploy; il collaudo di Simone era sulla versione precedente.

### Utenze collegate (cliente ↔ staff) + switch senza logout
- **Schema**: `User.linkedUserId` (unique, FK-less) + migration `20260720120000_linked_account`.
- **Admin, scheda cliente**: pulsante "Collega utenza staff" (chiede l'email dell'account
  staff; "Scollega" se già collegata). Regola: si collega UNA utenza cliente a UNA staff.
  Endpoint `PATCH /admin/users/:id/link` — audit `admin.user.link`/`unlink`.
- **Switch**: `POST /auth/switch` rilascia una coppia di token per l'utenza collegata
  (solo se attiva), audit `auth.switch_account`. Nell'app: pulsante "Passa al profilo
  staff" nel Profilo cliente e "Passa al profilo cliente" nel Profilo staff.
- **Banner**: se l'utenza staff è collegata (= profilo tecnico), in cima all'app staff
  compare una barra rossa fissa con scritta scorrevole "ATTENZIONE PROFILO TECNICO".

## Note
- Migration additiva (una colonna): al deploy `prisma migrate deploy` la applica; nessun
  impatto sui dati esistenti.
- Il vecchio comportamento aveva GIÀ salvato "tacchino" nei cibi esclusi della cliente
  del collaudo: dopo il deploy i suoi prossimi menu nasceranno senza piatti di tacchino,
  e la voce si vede/toglie da Profilo → Cibi esclusi.
- Restano per il blocco 3: app coach con scheda cliente/lead operativa, Summer
  Holiday/Return nei consigliati, lavori dell'allegato 3 (da riallegare).
