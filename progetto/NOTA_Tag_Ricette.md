# I tag delle ricette — a cosa servono davvero

> Scritto l'11/8/2026 su domanda di Simone («leggi tutto il progetto e dimmi i tag a cosa
> servono»), leggendo il codice riga per riga. **Prima di questa nota nessun documento del progetto
> definiva i prefissi `gen:`, `dieta:` e `sett:`**: la specifica backend cita `tags[]` con un
> esempio («da portare») e basta. La semantica viveva solo nel codice, in una riga.

## In una frase

**Nessun tag influenza la composizione dei menu.** Il motore di erogazione non legge mai
`Recipe.tags`. L'unico tag su cui il sistema prende una decisione è `dieta:<nome>`, e la decisione
non riguarda le clienti: riguarda i soldi che si spendono in AI.

## I quattro insiemi

| Tag | Chi lo scrive | Chi lo legge | Cosa fa |
|---|---|---|---|
| `dieta:<nome famiglia>` | il generatore, **alla nascita** della ricetta (`engine-rules.service.ts`) | `ricetteOrfane()`, in una query | **L'unico vivo.** Serve a ritrovare le ricette già generate e rimaste fuori dal ciclo, per riusarle invece di ricomprarle dall'AI |
| `gen:<stile>` | idem, stessa riga | un solo script di pulizia (`dedupe-diets.ts`) | Traccia di provenienza: «questa l'ha fatta la macchina». Dieci valori, uno per stile di preset |
| `sett:N` | `menu/tag-settimane.ts`, dopo la scrittura delle giornate | nessuno in esecuzione; solo lo script diagnostico `diag:dieta` | Informativo. Il dato buono è calcolato dalle giornate a ogni richiesta |
| liberi («Da portare», «Leggera», «cucina italiana») | la nutrizionista, dalla scheda ricetta | nessuno | Solo descrittivi |

## Le cinque cose che non si scoprono leggendo i nomi

**1. Il motore non li guarda.** La scelta dei piatti gira su colonne vere — `regime`, `mealSlot`,
`active`, `kcal`, `seasons`, `difficulty`, `allergens` — e sui gruppi di equivalenza. Non è un caso:
il 14/7 la proposta di usare i tag come meccanismo per le equivalenze fu **respinta** in favore di un
modello dedicato (`EquivalenceGroup`). I tag sono stati esplicitamente esclusi dal ruolo di
meccanismo.

**2. `cucina italiana` non fa niente.** La preferenza «ricette semplici» della cliente filtra su
`difficulty = 'semplice'`, **non** sul tag. Quindi una ricetta con la spunta «Cucina italiana» e
difficoltà «Media» non entrerà mai fra le semplici, e una «semplice» senza spunta ci entra eccome.
Il testo di aiuto della spunta («adatto alle clienti che vogliono ricette semplici») promette un
comportamento che non esiste: sono due controlli indipendenti e solo la tendina Difficoltà conta.

**3. `dieta:` dice dov'è NATA la ricetta, non a chi appartiene.** Le ricette non appartengono a una
dieta: `Recipe` non ha un `dietId`, è la giornata a puntare al piatto. Il generatore riusa apposta i
piatti fra famiglie diverse — sono già pagati e spesso già corretti a mano — e chi viene riusato
**non viene ri-taggato**. Quindi un piatto nato Mediterraneo e finito nella Keto-Mediterranea porta
`dieta:Mediterranea` per sempre.

**4. Rompere `dieta:` costa denaro, e in silenzio.** Il campo Tag della scheda ricetta è testo
libero senza nessuna validazione: contiene anche i tag con prefisso, e salvando li riscrive tutti. Se
qualcuno cancella o storpia `dieta:Pescetariana`, quella ricetta diventa invisibile alla query che
cerca le orfane: il generatore non la ritrova e chiama l'AI per rifare un piatto che esiste già.
Nessun errore, nessun avviso. Lo stesso vale se una dieta viene **rinominata**: il tag resta col
vecchio nome.

**5. I tag interni finiscono sotto gli occhi della cliente.** L'app mostra `recipe.tags` come chip
nella scheda del piatto, e `GET /recipes/:id` restituisce la riga intera a ogni utente autenticato.
Quindi nella scheda di una ricetta la cliente legge `gen:flexible`, `dieta:Pescetariana`, `sett:1`.

## Cosa è cambiato l'11/8

La tabella del catalogo ricette **non mostra più la colonna Tag**: al suo posto ci sono **Dieta** e
**Settimana n.**, tutte e due lette dalle giornate a ogni richiesta invece che dai tag. Cioè le due
domande per cui si guardavano i tag ora hanno una risposta che non può essere vecchia né sbagliata,
e che dice *dove la ricetta è usata* invece di *dov'è nata*.

I tag restano nel database e nella scheda ricetta, perché `dieta:` serve ancora al generatore.

## Cosa resterebbe da fare

- **Proteggere i tag con prefisso** dalla modifica manuale: oggi un salvataggio distratto della
  scheda ricetta può cancellare `dieta:` e far ricomprare all'AI un piatto già pagato.
- **Riallineare `dieta:` quando una dieta viene rinominata**, o smettere di usare il nome come chiave.
- **Non mostrare i tag interni in app**: filtrare i prefissi lato server o lato app.
- **Decidere che fine fa `cucina italiana`**: o lo si collega a qualcosa, o si toglie la spunta che
  promette un effetto che non ha.
- **`npm run fix:tag-settimane`** è ancora da lanciare sui dati esistenti (dry-run senza `CONFERMA=1`).
  Dopo la modifica dell'11/8 non serve più alle colonne del catalogo, ma i tag `sett:` sul database
  restano quelli vecchi finché non gira.
- **`diag-dieta.ts`** racconta ancora la vecchia semantica di `sett:N` («messo dal generatore»): chi
  lancia quella diagnostica legge una legenda sbagliata.
