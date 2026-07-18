# Registro modifiche — Contabilità: provvigioni maturate, prelievi pagati e accantonamento

**Data:** 17 luglio 2026 · Base: origin/main 6154499.

## Summary
In **Contabilità** tre nuovi indicatori sulle provvigioni, agganciati al **flusso prelievi già
esistente** (lo staff richiede dal portafoglio, l'admin paga e conferma in "Prelievi", parte
l'email e i fondi passano da Saldo a Prelevato): **Provvigioni accantonate** (maturate nel mese),
**Provvigioni pagate** (prelievi confermati nel mese) e **Accantonamento provvigioni**
(maturate totali − prelevate totali = il fondo ancora da versare). Alla conferma del prelievo
ora parte anche la **notifica in app** allo staff, oltre all'email.

## Verifica flusso esistente (nessuna modifica, solo conferma)
- **App staff (Guadagni)**: portafoglio con In maturazione / Saldo prelevabile / Prelevato,
  richiesta di prelievo (finestra giorni 1–7 del mese, IBAN, ricevuta) e **Storico prelievi**.
- **Backoffice**: widget Portafoglio per lo staff (con storico richieste) e pagina **Prelievi**
  (admin) con richieste in attesa, verifica di congruità col saldo, Conferma/Rifiuta e storico
  per stato.
- **Conferma** (`payout.confirm`): stato → paid, `paidAt`, email di pagamento avvenuto; il
  "passaggio da Saldo a Prelevato" è automatico perché il portafoglio è calcolato dal ledger
  meno i prelievi pagati.

## Description

Backend
- **accounting.service.report()**: nuovo blocco `commissions` nel report:
  `accruedPeriodCents` (uscite a ledger `sales_commission`+`visit_compensation` nel periodo),
  `paidPeriodCents` (prelievi `paid` con `paidAt` nel periodo), `accruedTotalCents` /
  `paidTotalCents` (storici), `reserveCents` = accantonamento (maturate tot. − prelevate tot.),
  `requestedCents` (richieste di prelievo in attesa), `pendingCents` (provvigioni in attesa di
  assegnazione coach/nutrizionista). Stesse voci in **CSV** e **PDF** (sezione "Provvigioni").
- **payouts.service.confirmWithdrawal**: oltre all'email, **notifica in app** `payout_paid`
  allo staff ("Prelievo pagato 💸", importo + ultime 4 cifre IBAN), best-effort.

Backoffice
- **Contabilita.tsx**: riga di card sotto i KPI: "Provvigioni accantonate" (maturate nel mese,
  incl. compensi visite), "Provvigioni pagate" (prelievi confermati nel mese), "Accantonamento
  provvigioni" (rosso se > 0, verde a zero; nella nota gli eventuali importi "richiesti da
  pagare" e "in attesa di assegnazione").

## Note
- **Nessuna migration**: la prima versione di questa feature aggiungeva `settled_at` su
  `staff_compensation` con un toggle manuale in Compensi; è stata SCARTATA (Compensi e
  compensation.controller tornati com'erano) perché il pagamento passa dal flusso prelievi.
  Se sul disco è rimasta la cartella `backend/prisma/migrations/20260719090000_compensation_settlement`,
  va eliminata prima del commit.
- Il perimetro è lo stesso del portafoglio staff: provvigioni vendita + compensi visite.
