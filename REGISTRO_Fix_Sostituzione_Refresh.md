# Registro modifiche — Sostituzione ingrediente: la Home non si aggiornava (#4)

**Data:** 22 luglio 2026 · Base: origin/main 1c847ee. (Richiesta #4 del file, Rosaria.)

## Summary
Segnalazione: "se sulla sostituzione si vuole fare una sostituzione di nuovo, si ritorna al 'sì
lo cancello' e non cancella niente." Causa: dopo la sostituzione la **card del menu nella Home non
si ricaricava**, quindi mostrava ancora il piatto vecchio → sembrava che non fosse successo nulla e
si riprovava. Ora, appena si conferma una sostituzione (temporanea o "per sempre"), la card **si
aggiorna da sola** col piatto nuovo.

## Description
`app/src/pages/Home.tsx`
- Estratto il caricamento del menu di oggi in una funzione **`loadMenu()`** (con `useCallback`),
  usata sia al mount sia come callback di refresh.
- Il popup **`SubstituteIngredient`** ora riceve `onChanged` e lo chiama **dopo la sostituzione**
  (POST `/me/menu/substitute`) e **dopo l'esclusione "per sempre"** (`forever: true`). `onChanged`
  = `loadMenu`, quindi la card "Il menu di oggi" rilegge i piatti aggiornati.

## Perché è la causa
Il backend faceva già la cosa giusta: `substituteDisliked` sostituisce i piatti dei prossimi giorni
e (se "per sempre") aggiunge il cibo a `dislikedFoods`. Ma la Home aveva letto il menu solo al primo
caricamento e non lo rileggeva dopo la modifica: la UI restava indietro rispetto al dato. Rileggere
il menu dopo l'azione allinea ciò che si vede a ciò che è stato fatto. È lo stesso pattern del fix
"cibi esclusi" (Profilo).

## Note
- Se per un certo slot non esiste un'alternativa sicura (esclusioni + intolleranze esauriscono il
  pool), la sostituzione non cambia il piatto e il messaggio lo spiega: è un limite di catalogo, non
  un bug. La domanda di Rosaria "limitare le sostituzioni?" resta una scelta di prodotto (non
  introdotto un limite ora).
- Nessuna migration. Verifica: `tsc --noEmit` app **OK**.
