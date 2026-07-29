# Registro modifiche — Percorso concluso: niente ultimo menu vecchio in dashboard

**Data:** 29 luglio 2026 · Base: main.

## Problema
In dashboard (Home e "Il tuo percorso") continuava a comparire **l'ultimo menu** come "IL MENU DI
OGGI" anche a distanza di giorni (ultimo menu erogato 26/07, oggi 29/07), invece di mostrare
"percorso concluso / nessun piano attivo".

## Cause (due)
1. **Fallback UI:** se non c'era il menu con data di oggi, Home/Percorso ripiegavano su `days[0]`
   (il primo giorno della lista = un menu vecchio) e lo mostravano come "menu di oggi".
2. **Stato piano:** avevo (per un fix precedente, poi rivelatosi mal diagnosticato) tolto il
   controllo su `endDate`, fidandomi del solo `status`. Ma se il cron di scadenza gira in ritardo,
   un piano con **fine già passata** resta `status='active'` → risultava ancora attivo e mostrava
   il menu.

## Fix
**`app/src/pages/Home.tsx` + `app/src/pages/Percorso.tsx`**
- "IL MENU DI OGGI" ora è **solo** il menu con data odierna: **niente ripiego su `days[0]`**. Se non
  c'è il menu di oggi → nessun pasto → compare il banner di stato (a piano concluso: "Nessun piano
  attivo"). Lo storico ("Menu passati") resta invariato.

**`backend/src/menu/menu.service.ts` + `backend/src/clients/clients.service.ts`**
- `hasActivePlan` (in `menuStatus` e nella scheda) ora richiede `status='active'` **e** `endDate`
  non ancora passata. Copre il ritardo del cron: un piano finito risulta concluso anche se lo stato
  è ancora 'active'. **Non** confligge coi piani spostati in avanti (endDate FUTURA → restano attivi:
  es. patty/lurve dopo l'allineamento).
- `deliverIfEligible` non eroga se `endDate` è già passata (coerenza con lo stato menu).

## Verifica
- Transpile `menu.service`, `clients.service`: OK, NUL check OK. `tsc --noEmit` app: OK.

## Impatto / deploy
- **Backend (Render)** + **App** (Home.tsx, Percorso.tsx → serve build store per l'app nativa; la
  web app va da sé su Vercel). Nessuna migration/env.
- Nota di riconciliazione: questo re-introduce il controllo `endDate` che avevo tolto nel commit
  "Fix falso piano scaduto" — quella diagnosi era errata (il caso patty era un abbonamento
  `expired` con date future, risolto dalla riattivazione in `updatePlanStart`, non dal togliere
  `endDate`).
