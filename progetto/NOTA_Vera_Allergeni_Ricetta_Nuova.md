# Gli allergeni della ricetta nuova, proposti dall'assistente — voce 227

Scritta prima del codice, 16/8/2026.

---

## Il buco, verificato nel codice

- Il capo approva una ricetta nuova → `registro.approvaRicetta` la **accende** (`active: true`).
- `allergensReviewed` resta **false**.
- `catalog.collegaRicetta` (riga 896) si rifiuta di metterla in una giornata finché resta false.
- Risultato: la ricetta è "approvata", non compare da nessuna parte, e **il capo lo scopre dal
  fatto che non compare**. Oggi la frase di Vera lo dice («servono ancora gli allergeni, dalla
  scheda»), ma è un rimando: bisogna ricordarsene, aprire la scheda, trovarla.

`catalog.recipeAllergenSuggestions(id)` esiste già e risponde alla domanda giusta: `suggestAllergens`
legge gli ingredienti e propone i codici, dicendo anche **quale parola** li ha fatti scattare.

---

## ⚠️ Il secondo buco, trovato guardando (questo NON lo chiudo da solo)

`catalog.updateRecipe` (riga 1187) scrive `ingredients` **senza toccare `allergensReviewed`**.

Quindi: una ricetta con allergeni confermati a cui qualcuno cambia gli ingredienti dal backoffice
resta `allergensReviewed: true` — con la conferma di **prima**, data su un piatto diverso. Nessun
errore, nessuna riga rossa, e il filtro degli allergeni continua a girare su un'informazione vecchia.

Non lo chiudo in questa consegna perché azzerare `allergensReviewed` a ogni modifica di ingredienti
**toglie dai menu** ogni ricetta che qualcuno tocca, finché non la si rivede: è una decisione
operativa su 315 clienti, non un dettaglio tecnico. Va in elenco lavori come voce aperta, per Simone.

Quello che **posso** chiudere qui è la metà che passa da Vera: se la modifica approvata cambia gli
ingredienti, la stessa domanda si rifà — perché la conferma di prima parlava di un altro piatto.

---

## Come funziona

Subito dopo l'approvazione, nella stessa chat, senza cambiare pagina:

```
Ricetta «Orata al forno con patate» attivata.

Dagli ingredienti leggo questi allergeni:
• Pesce — da «orata»
• Glutine — da «pangrattato»

Confermo questi due? Oppure dimmi tu l'elenco giusto («latte e uova»),
o «nessuno» se questa ricetta non ne ha.
```

| cosa risponde | cosa succede |
|---|---|
| «sì» / «confermo» | si scrivono **quelli mostrati** — sono già stati letti |
| un elenco («latte e uova») | si **rimostra** quello che ho capito, e si chiede conferma |
| «nessuno» | si **rimostra** («scrivo che non ha allergeni»), e si chiede conferma |
| altro | non si indovina: si richiede |

### ⚠️ Perché un elenco dettato ha un giro in più

Il «sì» conferma una lista che il capo ha appena **letto**. Un elenco dettato no: è contenuto nuovo,
e qui la regola di casa — *i numeri e le liste si mostrano prima di scriverle* — vale doppio, perché
questa lista è ciò che decide se una cliente allergica riceve quel piatto.

### ⚠️ Un allergene che NON era fra i suggeriti si accetta

`suggestAllergens` cerca parole negli ingredienti: **può non vederci qualcosa**. Quindi se il capo
nomina un allergene che io non avevo proposto, si prende — al contrario di quello che fa
`allargaFamiglia`, che tiene solo i nomi che aveva proposto lui.

Non è un'incoerenza: lì il rischio era simmetrico, qui no. **Aggiungere un allergene di troppo costa
una ricetta in meno; dimenticarne uno costa una cliente.** Fra i due errori si sceglie sempre lo
stesso.

### ⚠️ Si scrive dalla porta della scheda

`CatalogService.setRecipeAllergens`, la stessa funzione del pulsante in scheda: filtra sui 14 codici
UE, mette `allergensReviewed: true` e lascia la traccia in audit. Nessuna seconda strada per un dato
sanitario — è la regola che questo progetto ha già pagato due volte per impararla.

### E se non risponde?

Non succede niente di male: la ricetta resta accesa e non revisionata, esattamente com'è oggi. La
domanda non blocca nulla, toglie solo il giro in scheda a chi risponde.
