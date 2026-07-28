# Registro modifiche — Progressione dei piani suggeriti a fine piano

**Data:** 23 luglio 2026 · Base: main. (Richiesta #3 — scelte Simone: 1b, 2a.)

## Obiettivo
A fine piano proporre UN solo passo pertinente, con questa progressione:
1. **Obiettivo NON raggiunto** → piano-obiettivo **1 o 3 mesi** (1 mese se la stima "al ritmo
   attuale" è ≤ 1 mese, altrimenti 3 mesi — **scelta 1b**);
2. **Obiettivo RAGGIUNTO** (peso **≤ obiettivo** — **scelta 2a**) → **Mantenimento**;
3. **dopo il Mantenimento** concluso → **Monitoraggio** (prima compariva subito a fine prova/piano).

## Fix
**`backend/src/reports/plan-report.service.ts`** (report di fine periodo)
- Esposta `monthsToGoal` (mesi stimati al traguardo) dalla stima ETA già calcolata.
- `objectiveReached = toGoKg ≤ 0` (peso ≤ obiettivo). `endedIsMaintenance = piano finito ha period
  'maintenance'`.
- **Offerta (box CONSIGLIATO):** solo se obiettivo NON raggiunto e piano finito non-mantenimento →
  1 mese se `monthsToGoal ≤ 1`, altrimenti 3 mesi (fallback all'altro o al più caro). Altrimenti `offer=null`.
- **Mantenimento (box):** solo se obiettivo RAGGIUNTO (e piano finito non-mantenimento). Altrimenti null.
- **Monitoraggio (box):** solo se il piano finito era il **mantenimento**. Altrimenti null.

**`app/src/pages/Report.tsx`**: il box "Monitoraggio · gratis" ora è condizionato a `r.monitoring`
(prima era sempre mostrato). Offerta e mantenimento erano già condizionati ai rispettivi campi.

**`backend/src/monitoring/monitoring.service.ts`** (card "Monitoraggio · gratis" in "Il tuo percorso")
- `eligible` ora richiede un **abbonamento di MANTENIMENTO** pregresso (`plan.period='maintenance'`),
  non più un abbonamento qualsiasi. Così la card non compare più subito a fine prova/piano, ma solo
  dopo il mantenimento.

## Verifica
- Transpile `plan-report.service`, `monitoring.service`: OK, NUL check OK. `tsc --noEmit` app: OK.

## Impatto / deploy
- **Backend (Render)**: report e idoneità monitoraggio.
- **App**: `Report.tsx` cambia → per l'app nativa serve la **build store** (vedi handoff store);
  la web app va da sé su Vercel.
- Nessuna migration, nessun env nuovo.
- Nota: i report sono snapshot generati a fine piano (idempotenti): la nuova logica vale per i
  report generati d'ora in poi.
