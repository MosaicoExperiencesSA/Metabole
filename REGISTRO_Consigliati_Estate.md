# Registro modifiche — Consigliati stagionali (Vacanza estiva / Rientro estivo)

**Data:** 20 luglio 2026 · Base: origin/main 17f7937.

## Summary
Aggiunta la sezione **"Consigliati"** e i due prodotti stagionali **Vacanza estiva**
(`summer_holiday`) e **Rientro estivo** (`summer_return`), con bilanciamenti basati su una
ricerca di dietetica (vedi `progetto/Consigliati_Estate_Bilanciamenti.md`). Le diete
possono ora essere marcate come **Consigliato** dal backoffice e compaiono in evidenza,
in cima allo schermo 16 dell'app, con badge dedicato.

## Description

Backend
- **schema.prisma**: nuova colonna `Diet.recommended` (default false) + indice; migration
  `20260720140000_diet_recommended`.
- **onboarding.service.dietProducts()**: restituisce `recommended` e ordina i consigliati
  per primi (`orderBy: [{recommended:desc},{createdAt:asc}]`).
- **catalog DTO + createDiet**: nuovo campo `recommended` in creazione/modifica dieta e
  modifica scheda-prodotto.
- **seed.ts** (`seedSeasonalConsigliati`, solo ambiente demo): crea/aggiorna i due prodotti
  con `seasonalTag: 'estate'`, `recommended: true`, `clientVisible: true`, nome/descrizione/
  caratteristiche dalla ricerca, livello kcal (mantenimento 1700 / dimagrimento 1450). Se il
  catalogo ha ricette per tutti gli slot → dieta APPROVATA con rotazione a 2 giorni; altrimenti
  scheda-prodotto in bozza da completare. Idempotente.

Backoffice
- **Diete.tsx**: casella **"Consigliato"** sia in "Nuova dieta" sia nella "Scheda cliente".

App
- **Onboarding.tsx (schermo 16)**: sezione **"Consigliati"** in cima (con separatore dagli
  altri) e badge ⭐ "Consigliato" sulle card in evidenza; badge stagione già presente.

## Ricerca (bilanciamenti)
Sintesi in `progetto/Consigliati_Estate_Bilanciamenti.md`:
- **Vacanza estiva** (mantenimento): proteina+verdura a ogni pasto, 1 piacere pianificato/
  giorno, idratazione, alcol con misura; risultato realistico = 0 kg presi.
- **Rientro estivo** (dimagrimento leggero): proteine alte, carboidrati integrali+fibra,
  meno zuccheri/alcol/processati, meal-prep; risultato realistico = -1/-2 kg in 3-4 settimane.
Fonti: Cleveland Clinic, Physicians Plan, linee guida divulgative di nutrizionisti.

## Note
- Migration additiva (una colonna): applicata al deploy da `prisma migrate deploy`.
- **In PRODUZIONE** i due prodotti NON vengono seminati (il catalogo è gestito dal
  nutrizionista, come per le diete base): si creano una volta dal backoffice con i testi del
  documento di ricerca, spuntando "Consigliato" + "Visibile" e componendo i menu. Nell'app
  compaiono in "Consigliati" appena approvati. In demo/dev sono già pronti.
- I bilanciamenti sono una base divulgativa, non un consiglio medico personalizzato: la
  nutrizionista adatta al singolo caso.
