# Registro modifiche — Mantenimento visibile solo a obiettivo raggiunto

**Data:** 29 luglio 2026 · Base: main.

## Problema
Il piano **Mantenimento** era visibile a **tutti** nel Negozio. Deve comparire **solo quando la
cliente ha raggiunto l'obiettivo**.

## Fix — `backend/src/commerce/commerce.service.ts`
- `listPlansForClient` (endpoint `/me/plans`, usato dal Negozio dell'app) ora **nasconde i piani
  con `period = 'maintenance'`** se la cliente **non ha raggiunto l'obiettivo**.
- Nuovo helper `hasReachedObjective(clientId)`: obiettivo raggiunto = **peso attuale ≤ peso
  obiettivo** (ultima misura vs `objective.targetWeightKg`) — stessa regola usata nel report
  (scelta 2a).

## Verifica
- Transpile `commerce.service.ts`: OK, NUL check OK. Nessuno spec da aggiornare.

## Impatto / deploy
- **Solo backend (Render).** Il Negozio dell'app consuma già `/me/plans`, quindi nessuna modifica
  app. Nessuna migration.
- Coerente con la progressione dei piani nel report (obiettivo → mantenimento → monitoraggio):
  ora anche lo **shop** rispetta la stessa regola per il mantenimento.
