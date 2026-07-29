# Registro modifiche — Script riallineamento abbonamenti alla data d'inizio (tutti i casi in essere)

**Data:** 29 luglio 2026 · Base: main.

## Scopo
Sistemare **tutti** gli account già disallineati (non solo Gioia): abbonamenti la cui subscription
non rispecchia la `planStartDate` scelta dalla cliente, e che perciò risultano "scaduti" pur avendo
un piano ancora in corso.

## Cosa fa — `backend/prisma/realign-plan-start.ts` (npm `realign:plan-start`)
- Scorre **tutti** gli abbonamenti con stato `active` o `expired`.
- Per ognuno legge `profile.planStartDate` e ricalcola la fine = `subscriptionEnd(planStartDate, period)`.
- Se la fine ricalcolata è **nel futuro** e la subscription è disallineata (start/fine diversi o non
  attiva), la **riallinea**: `startDate` = planStartDate, `endDate` = fine ricalcolata, `status` = `active`.
- **Sicuro:** non tocca `pending`/`cancelled`; agisce solo quando la cliente ha diritto a un piano
  ancora in corso (fine futura). Idempotente (rigirandolo non ritocca ciò che è già a posto).

## Uso (Shell di Render sul backend)
```
npm run realign:plan-start              # DRY-RUN: elenca TUTTI i casi da riallineare
npm run realign:plan-start -- --apply   # applica
```

## Relazione con gli altri script
- `reactivate:future-expired`: riattiva solo gli `expired` che hanno GIÀ `endDate` futura (non
  ricalcola le date). Non prende casi come Gioia (fine 28/07 nel passato).
- `realign:plan-start` (questo): **ricalcola** le date dalla planStartDate → copre anche Gioia e
  simili. È lo script da usare per questo problema.

## Verifica
- Transpile OK, package.json valido, NUL check OK.

## Nota
- Solo backend, sola manutenzione dati. Il fix di codice (in `updateProfile` e `updatePlanStart`)
  previene il ripetersi del disallineamento; questo script sistema lo storico "in essere".
