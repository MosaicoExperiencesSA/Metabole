# Registro modifiche — Contabilità: provvigioni maturate, pagate e accantonamento

**Data:** 17 luglio 2026 · Base: origin/main 6154499.

## Summary
In **Contabilità** tre nuovi indicatori sulle provvigioni: **accantonate** (maturate nel mese),
**pagate** (saldate nel mese) e **accantonamento provvigioni** (totale maturate − totale pagate,
cioè quanto c'è "nel fondo" ancora da versare allo staff). Per distinguerle serviva l'atto di
pagamento, che prima non esisteva: nella pagina **Compensi**, scelto un mese, ora si segna il
compenso di ciascuna persona come **Pagato** (e si può annullare).

## Description

Backend
- **schema.prisma + migration `20260719090000_compensation_settlement`**: colonna `settled_at`
  (nullable) su `staff_compensation` = quando il compenso del periodo (persona+mese) è stato
  pagato; null = ancora accantonato.
- **compensation.controller**:
  - `GET /admin/compensation?period=YYYY-MM` ora restituisce anche `compensationId` e `settledAt`
    (solo in vista mensile) per il toggle.
  - Nuovo `PATCH /admin/compensation/:id/paid` con `{ paid: true|false }`: imposta/azzera
    `settledAt`, con audit (`compensation.paid`/`compensation.unpaid` + importo e periodo).
- **accounting.service.report()**: nuovo blocco `commissions` nel report:
  `accruedPeriodCents` (uscite a ledger `sales_commission`+`visit_compensation` nel periodo),
  `paidPeriodCents` (compensi con `settledAt` nel periodo), `accruedTotalCents`/`paidTotalCents`
  (totali storici), `reserveCents` = accantonamento (maturate tot. − pagate tot.),
  `pendingCents` = provvigioni in attesa di assegnazione (pending_commission).
  Le stesse voci compaiono nel **CSV** e nel **PDF** del report (sezione "Provvigioni").

Backoffice
- **Contabilita.tsx**: nuova riga di card sotto i KPI: "Provvigioni accantonate" (maturate nel
  mese, incl. compensi visite), "Provvigioni pagate" (saldate nel mese), "Accantonamento
  provvigioni" (rosso se > 0, verde a zero; nota con l'eventuale importo in attesa di
  assegnazione).
- **Compensi.tsx**: con un mese selezionato, colonna "Pagamento": bottone **"Segna pagato"** →
  chip verde "Pagato gg/mm/aaaa" (cliccabile per tornare a "da pagare"). Nella vista "Tutto" il
  toggle non c'è (si paga per mese). Aggiunto il ruolo Coordinatrice coach alle etichette.

## Note
- **Serve la migration** al deploy (preDeploy la applica): un ADD COLUMN, nessun dato toccato.
- Il perimetro è lo stesso su entrambi i lati del saldo: provvigioni vendita + compensi visite
  (il fondo è unico, come nella pagina Compensi).
- Le provvigioni "in attesa di assegnazione" (cliente senza coach/nutrizionista) non sono ancora
  nel maturato: entrano a ledger quando vengono assegnate; in Contabilità si vedono come nota.
