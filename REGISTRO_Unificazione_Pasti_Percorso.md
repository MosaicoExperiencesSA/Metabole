# Registro modifiche — Unificazione "Pasti al giorno" + "Percorso" in un'unica scelta

**Data:** 17 luglio 2026 · Base: origin/main b326e55 (con le varianti diete 3/5/digiuno del socio).

## Summary
"Pasti al giorno" e "Percorso" erano due campi che dicevano la stessa cosa. Ora c'è **un'unica
scelta 3 pasti / 5 pasti / digiuno intermittente**, sia in registrazione sia nella scheda cliente
del backoffice; il numero di pasti (`mealsPerDay`) si **deduce** dalla scelta.

## Description
Nel modello restano due campi (`pathType` = scelta, `mealsPerDay` = numero) perché il `pickDiet`
del socio li usa entrambi (pathType=digiuno → varianti fasting; altrimenti match 3/5 pasti). Ma
all'utente si chiede UNA volta sola, e mealsPerDay si deriva: classic3 → 3, five → 5, digiuno → 3.

- **backend/onboarding.questions.ts**: rimossa la domanda separata "Quanti pasti riesci a fare?".
  Resta solo "Quanti pasti / che percorso preferisci?" (pathType: 3 pasti / 5 pasti / digiuno).
  L'app deriva già `mealsPerDay` dal percorso (mappa `mealsByPath` in Onboarding.tsx, commento
  "la schermata Quanti pasti non c'è più") e lo invia comunque, quindi nessun'altra modifica app.
- **backoffice/ClientDetail.tsx**: rimosso il select "Pasti" (3/4/5); "Percorso" diventa l'unica
  scelta **"Pasti / percorso"** (3 pasti / 5 pasti / digiuno intermittente, tolto "Con integratori").
  Al salvataggio `mealsPerDay` è derivato dal percorso. In visualizzazione una sola riga
  "Pasti / percorso" (tolta la riga ridondante "Pasti al giorno").

## Compatibilità col lavoro del socio (b326e55)
- pickDiet del socio: pathType=intermittent_fasting → varianti fasting; altrimenti 3/5 pasti +
  fallback per regime ("mai senza menu"). L'unica scelta imposta pathType + mealsPerDay coerenti → OK.
- Nessun conflitto: onboarding e backoffice sono lato profilo cliente; il wizard diete del socio è
  lato creazione diete (intatto).

## Note
- DTO submit lascia `@IsIn([3,4,5])` / pathType con 'supplements': innocuo (l'app non invia più
  quei valori), utile per compatibilità con profili esistenti.
- Redeploy backend su Render per servire il nuovo set di domande onboarding.
