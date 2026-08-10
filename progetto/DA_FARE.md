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

## 2. La riga dei filtri non è «sticky» in Utenti (11/8)

In `Users.tsx` le intestazioni restano attaccate in alto scorrendo (`position: sticky`), la riga dei
filtri no: gli stili di `rigaFiltri()` stanno dentro l'helper, e per cambiare un filtro si deve
tornare in cima. Si sistema nell'helper (un'opzione per lo scostamento della riga sotto
l'intestazione) o nel CSS, non nella pagina.

## 3. `LeadsTable` resta fuori dall'helper (11/8)

È l'unica tabella che filtra e ordina **lato server** (decine di migliaia di lead: `page` +
`pageSize=100`, `sortKey`/`sortDir` come parametri di query). L'helper è tutto client e non la
copre: servirebbe una modalità «emetti parametri di query invece di ordinare in memoria». Le altre
quattro copie divergenti (`Clienti`, `Diete`, `Users`, `Ricette`) sono state unificate l'11/8.
