# Registro modifiche — Totale lead visibile in alto in Gestione Lead (#1)

**Data:** 22 luglio 2026 · Base: origin/main 17e2ffe. (Richiesta #1 del file "fix e richieste 1", Giusy.)

## Summary
In **Backoffice › CRM › Gestione Lead** il totale dei contatti si vedeva solo in fondo (nel
paginatore) o per colonna nella pipeline. Ora è mostrato **in alto**, ben visibile, e si aggiorna
in base ai filtri attivi.

## Description
`backoffice/src/pages/LeadsTable.tsx`
- Aggiunto in cima alla barra strumenti un badge **"Totale: N"** (numero formattato it-IT).
- Il valore è il `total` già restituito dall'endpoint `/crm/leads` (conteggio con gli stessi
  filtri della lista): senza filtri è il totale dell'intero database, con filtri è il conteggio del
  sottoinsieme. Tooltip che lo spiega.
- Nessuna chiamata aggiuntiva: si riusa il dato già disponibile (prima usato solo dal paginatore).

## Note
- Nessuna migration, nessun cambiamento backend. Verifica: `tsc --noEmit` backoffice **OK**.
