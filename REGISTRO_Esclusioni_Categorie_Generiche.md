# Registro modifiche — Esclusioni per categoria generica ("frutta secca", "legumi")

**Data:** 23 luglio 2026 · Base: main.

## Problema
`Patrizia Sogari` ha indicato che **non mangia "frutta secca" e "legumi"**, ma continua a ricevere
menu con noci/mandorle/lenticchie/ceci. Domanda: la scritta generica non viene presa? Serve
elencare voce per voce?

## Perché succedeva
Il match tra cibi esclusi e ingredienti è per **parola chiave** (`testo.includes(keyword)`). La
mappa **categoria → ingredienti** (`INTOLERANCE_MAP`, es. "frutta secca" → noci, mandorle…) veniva
applicata **solo alle intolleranze/allergie**, **non ai cibi "non graditi" (`dislikedFoods`)**: per
questi si usava il termine così com'era. Inoltre **"legumi" non era nella mappa**. Quindi una
scritta generica ("frutta secca", "legumi") non intercettava i singoli alimenti.

## Fix — `backend/src/menu/menu.service.ts`
- Aggiunte le categorie **`legumi`** (lenticchie, ceci, fagioli, piselli, fave, lupini, borlotti,
  cannellini, cicerchie, edamame) e **`latticini`** alla mappa.
- Nuovo helper `expandExclusion(term)`: se il termine è una categoria nota → categoria + membri,
  altrimenti solo il termine. Ora usato **sia per le intolleranze sia per i dislikedFoods**, in
  **tutti** i punti che calcolano le esclusioni:
  - `evaluateMeals` (sicurezza/sostituzione in erogazione);
  - `swapDislikedDishes` (cambio piatto per cibo non gradito) — sia il set di esclusione dei
    candidati, sia soprattutto il **trigger**: prima scattava solo se il termine (non espanso) era
    nel NOME del piatto; ora scatta se il cibo (espanso per categoria) compare nel **nome O tra gli
    ingredienti** del piatto.

**Risposta a Simone:** no, non serve elencare voce per voce — la scritta generica ora viene presa.
Restano comunque valide anche le voci specifiche.

## Verifica
- Transpile `menu.service.ts`: OK, NUL check OK. Coerente con gli spec esistenti (intolleranze
  bloccanti/sostituibili invariate).

## Impatto / deploy
- **Solo backend (Render)**: nessun aggiornamento app/store. Nessuna migration.
- I menu **già erogati** non si aggiornano da soli: per Patrizia, dopo il deploy, usare **"Rigenera
  menu"** dalla scheda (rieroga applicando le esclusioni corrette) o attendere i prossimi cicli.
- Nota: il match è testuale, quindi possibili falsi positivi noti già prima (es. "noce moscata"
  contiene "noce"): accettabile, invariato.
