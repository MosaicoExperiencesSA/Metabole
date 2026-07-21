# Registro modifiche — Analisi, Blocco 3 (dati sanitari per ruolo, GDPR)

**Data:** 21 luglio 2026 · Base: origin/main db671e9.

## Summary
La scheda cliente (`GET /admin/clients/:id`) restituiva l'**intero** profilo — incluso lo
screening sanitario, il questionario clinico e i consensi — a **tutti** i ruoli con accesso
alla scheda (coach, Responsabile Coach/`sales`, admin, marketing). Dato che `sales`/admin
vedono **tutti** i clienti, era un'esposizione di dato particolare (GDPR art. 9) a personale
non clinico. Ora questi campi sono **riservati allo staff clinico** (nutrizioniste).

## Description
- **clients.service.ts (`getDetail`)**: se il ruolo di chi apre la scheda **non** è
  `nutritionist`/`head_nutritionist`, dalla risposta vengono rimossi **`screeningFlag`,
  `onboardingAnswers`** (questionario: patologie/farmaci) **e `consents`**. Restano
  `allergie`/`intolleranze` (servono per i menu) e tutto il resto.
- **ClientDetail.tsx**: la riga "Percorso supervisionato" ora mostra "Riservato allo staff
  clinico" quando il dato è oscurato (prima avrebbe mostrato un fuorviante "No"). Patologie/
  Farmaci mostravano già "—" quando il dato manca.

## Note
- Nessuna migration. I dati NON vengono cancellati: sono solo **non inviati** ai ruoli non
  clinici. Le nutrizioniste continuano a vederli (dalla loro area clinica e dalla scheda).
- Coerente con la regola già applicata a note cliniche e documenti sanitari (riservati).
- Verifica consigliata col riferimento privacy per la classificazione dei ruoli.
