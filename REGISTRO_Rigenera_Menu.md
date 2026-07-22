# Registro modifiche — "Rigenera menu": correggere i menu vecchi sbagliati (#8)

**Data:** 22 luglio 2026 · Base: origin/main 90aaacf (+ #7). (Richiesta #8 del file, Rosaria.)

## Summary
La fix alla generazione dei menu (es. dieta che generava solo la colazione) vale per i menu
**nuovi**, ma quelli **già erogati** restavano sbagliati (un giorno già consegnato non viene mai
sovrascritto). Ora c'è un pulsante **"Rigenera menu"** nella scheda cliente del backoffice che
**ricrea i menu da oggi in poi** con la generazione corretta, **senza toccare lo storico passato**.

## Description
**Backend**
- `menu.service.ts` → nuovo `regenerateFromToday(clientId)`: cancella i `menuDay` con `date >= oggi`
  e richiama `deliverIfEligible` (la stessa erogazione normale, quindi rispetta gate misure,
  finestre di visibilità, abbonamento attivo, pause). Ritorna `{ removed, delivered }`. Non tocca i
  giorni passati.
- `clients.service.ts` → `regenerateMenu(userId, actorId)`: `assertClientAccess` + chiamata al
  metodo sopra + audit `client.menu.regenerated` (giorni rimossi/erogati).
- `clients.controller.ts` → `POST /admin/clients/:id/regenerate-menu`, protetto dallo **stesso
  permesso del cambio data inizio** (`change_plan_start`, manage): chi può far ripartire il piano
  può anche rigenerare i menu.

**Frontend backoffice**
- `ClientDetail.tsx` → pulsante **"Rigenera menu"** accanto a "cambia data inizio" (stesso permesso),
  con conferma. Mostra l'esito: quanti giorni ricreati, o un avviso se 0 (possibile causa: misure
  mancanti, piano non attivo o in pausa).

## Perché così (sicurezza)
- **Non cancella lo storico**: solo da oggi in poi (`date >= today`), così i giorni passati e i
  report restano intatti. Diverso da "cambia data inizio" che invece azzera tutto e riparte.
- **Riusa l'erogazione esistente** (`deliverIfEligible`): nessuna logica di generazione duplicata,
  stessi controlli di sempre. Se la cliente non è idonea (es. misure mancanti) rigenera 0 giorni e
  l'operatore lo vede subito, invece di lasciare uno stato incoerente.
- **Per-cliente, on-demand**: nessuna operazione di massa, nessun rischio di rovinare i menu buoni
  di altre clienti.

## Note
- Nessuna migration. Verifica: transpile backend OK (menu/clients service+controller), NUL check OK,
  `tsc --noEmit` backoffice OK.
- Uso tipico: aprire la scheda della cliente col menu sbagliato (es. account gmail di Rosaria con
  solo colazione) → "Rigenera menu" → i menu di oggi e dei prossimi giorni tornano completi.
