# Da fare — richieste memorizzate, non ancora implementate

Lista unica delle cose che Simone ha chiesto di **ricordare** senza farle subito. Ogni voce ha
già dentro il posto dove va e la decisione che manca, così quando si apre non si riparte da zero.
Quando una voce viene fatta si sposta nel `REGISTRO.md` e si cancella da qui.

---

## 1. La pari grammatura non regge sui gruppi di grassi (per la nutrizionista)

> **Palla a Nocanty (10/8).** Le domande sono scritte in
> `progetto/Metabole_Grammature_Grassi_Domande.md` (c'è anche il PDF da mandarle). Bloccanti: **Q1**
> (fattore di conversione o grassi fuori dall'equivalenza) e **Q3** (la tabella dei numeri). Appena
> risponde: nessuna migrazione — il campo `members` dei gruppi è già JSON libero — colonna del
> fattore nell'editor dei gruppi, applicazione in `scegliSostituto`, e taratura del limite di
> plausibilità come da Q4.

Il cambio in chat propone sempre **pari grammatura**, ed è una scelta dichiarata: sui gruppi tipo
«carote / biete / spinaci» va bene. Sul gruppo dei **grassi** no: 70 ml di panna fresca sono ~200
kcal, 70 g di burro ~500, 70 g di olio ~630. Il collaudo del 9/8 l'ha mostrato in schermata.

Due strade, e la scelta è della nutrizionista, non nostra:

- **togliere i grassi dall'equivalenza**: chi vuole cambiare la panna passa da lei;
- **un fattore di conversione per gruppo** (es. 100 g di olio ≈ 300 ml di panna a pari grassi), da
  scrivere nel gruppo di equivalenza insieme ai membri.

Finché non è deciso, il controllo di plausibilità (`grammaturaAmmessa`) non se ne accorge: guarda il
rapporto fra le quantità, non le calorie.

**Cosa è cambiato attorno a questa voce (10/8)**: la nutrizionista adesso può **correggere a mano** i
grammi di un cambio nato in chat, dalla scheda cliente (card Conversazioni → matita), e la cliente
riceve la nota. Non risolve la regola — continua a servire una decisione, altrimenti ogni cambio sui
grassi passa da una persona — ma toglie l'urgenza: oggi un numero sbagliato si sistema, prima no.

**Terza cosa vista nel collaudo, ancora da provare**: la conversione ml → g («70 ml panna → 70 g
burro») non è mai stata collaudata su un profilo vero. Serve un'utenza di prova **senza lattosio fra
le esclusioni**, altrimenti il sostituto proposto è l'olio evo — un liquido, che resta in ml.

---

## 2. «Compenso per visita» nei Parametri: decisione da prendere (11/8)

> **Palla a Simone.** Non l'ho toccato di proposito.

Simone, davanti alla pagina Parametri: «questo non serve più, lo abbiamo inserito a livello di
prodotto». Le **provvigioni di vendita** sono davvero passate al prodotto il 14/07 (campi
`commission*Cents` su ogni piano). Il **compenso per visita** no: è ancora un parametro globale
(`visit_compensation_amount_cents`, 40 €) e viene ancora **pagato** — `FinanceService.creditVisitCompensation`
lo legge a ogni visita completata e scrive provvigione + uscita a ledger
(`backend/src/commerce/finance.service.ts:543`, chiamato da `health-area/visits.service.ts:196`).

Togliere solo la riga dalla pagina lo renderebbe **invisibile e non modificabile**, cioè esattamente
il difetto che `diag:parametri` esiste per intercettare. Le due strade:

- **a) La visita non si paga più a parte** (la nutrizionista guadagna dalla provvigione del piano):
  via la riga dai Parametri, via la chiamata da `visits.service`, via la chiave dal seed. Gli importi
  già registrati restano in contabilità e nei Compensi staff.
- **b) Il compenso va sul prodotto** come le provvigioni: campo nuovo sul piano, editabile in Gestione
  negozio, letto al posto del parametro globale. Serve una migrazione.

Con (a) le nutrizioniste smettono di essere pagate per visita: è un cambio di soldi e non lo faccio
senza un sì.

---

## 3. Le cinque copie vecchie dell'ordinamento (11/8)

`Clienti`, `Diete`, `Users`, `Ricette` e `LeadsTable` avevano già l'ordinamento **prima**
dell'helper condiviso, ognuna con la sua copia. Funzionano e non le ho toccate: cambiarle è un
refactoring senza nessun beneficio visibile e con la possibilità di rompere pagine che si usano ogni
giorno. Da fare quando una di quelle pagine va comunque aperta per un altro motivo.

`LeadsTable` è il caso a parte: filtra e ordina **lato server** (decine di migliaia di lead) e non
può usare l'helper così com'è — servirebbe una modalità «emetti parametri di query».

## 4. L'ordine delle voci nelle tendine di stato (11/8)

Le tendine `filtro: 'scelta'` ordinano le voci in alfabetico. Su una colonna «Stato» l'ordine utile
sarebbe quello del ciclo di vita (In attesa → Pagato → Rifiutato), non «In attesa, Pagato, Rifiutato»
per caso. Si risolve con un `ordineScelte?: string[]` in `Colonna`. Non urgente: le voci sono poche
e si trovano comunque.

