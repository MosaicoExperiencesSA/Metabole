# Registro modifiche — Pasti 3/5/digiuno · Checkout indirizzo · Fase in home · Video coach annullato

**Data:** 17 luglio 2026 · Base: origin/main 2bc3a68.

## Summary
1. Onboarding: opzioni pasti ridotte a **3 / 5 / digiuno intermittente** (tolti "4 pasti" e "Con integratori").
2. Checkout: **indirizzo di spedizione condizionale** (chiesto solo se non è già in scheda; salvato al pagamento).
3. Home: **badge della fase** attuale (Dimagrimento / Mantenimento).
4. Video di presentazione coach: **annullato** (non era implementato; rimosso dal backlog).

## Description

### 1. Pasti (onboarding.questions.ts)
- Domanda "meals" (`mealsPerDay`): opzioni **[3, 5]** (prima 3/4/5).
- Domanda "path" (`pathType`): opzioni **classic3 / five / intermittent_fasting** (tolto `supplements`),
  sottotitolo aggiornato.
- ATTENZIONE (dati): perché chi sceglie 3 pasti o digiuno veda il menu, il nutrizionista deve creare
  nel catalogo le diete a 3 pasti e per il digiuno (oggi ci sono solo diete a 5 pasti — vedi backlog).
- Da decidere: unificare le due domande (meals + path si sovrappongono) — lasciato com'è per ora.

### 2. Checkout indirizzo condizionale (Checkout.tsx)
- Al caricamento legge `/me/profile`. Se via/CAP/città/provincia sono già presenti → mostra
  l'indirizzo in sola lettura con "Modifica" (nessun passaggio in più). Se manca → apre il form.
- Al pagamento, se il form è aperto, valida (tutti i campi) e salva l'indirizzo in scheda
  (`PATCH /me/profile`) prima di procedere. Il bottone paga è disabilitato finché l'indirizzo è incompleto.

### 3. Fase in home (signals.service.ts + Home.tsx)
- `signals.todayStatus` (`/me/today`) ora ritorna `objective` (dimagrimento | mantenimento) dal ClientProfile.
- Home: badge con icona e colore (Dimagrimento verde ↓ / Mantenimento blu =). Solo lettura: la fase
  resta decisa dallo staff.

### 4. Video coach — annullato
Nessun codice: la presentazione video coach non era mai stata implementata nell'app (i "La tua coach"
sono solo testo/etichette). Rimosso l'item dal backlog.

## Note aperte
- Diete a 3 pasti e digiuno da creare nel catalogo (nutrizionista) — è ciò che sblocca davvero il menu.
- Backoffice: il campo "Pasti" della scheda cliente ha ancora l'opzione 4 → allinearlo a 3/5 (codice socio).
- Redeploy backend su Render per `objective` in /me/today e le opzioni onboarding.
