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

## 2. Ricombinare i menu ad alto gradimento — la personalizzazione sulla cliente

> **In coda per decisione di Simone (11/8)**, dopo le 12 settimane di catalogo. Precondizione vera:
> con 5 piatti per pasto non c'è niente da ricombinare, quindi questa voce si apre quando il catalogo
> è pieno.

Richiesta: «considera che i menu ad alto gradimento li puoi riutilizzare, magari prendi la cena di uno
ci metti il pranzo dell'altro… cercando le combinazioni che fanno **1** perdere più peso alla cliente
**2** i menu che la gratificano (soprattutto quando l'umore scende)».

### Metà c'è già, e va detto prima di riprogettare

`menu/day-combo.service.ts` compone la giornata prendendo **un piatto per pasto** dal pool della dieta
della cliente, dentro la banda calorica del suo livello e con una penalità sulla quota proteica fuori
banda, massimizzando `efficacia appresa + gradimento` e ruotando fra le tre migliori combinazioni per
varietà. «La cena di uno con il pranzo dell'altro» è esattamente quello che fa.

I due segnali esistono e sono per cliente: **efficacia** da `MenuWeight` (`score/samples`, appresa sul
calo peso) e **gradimento** da `RecipeRating` (stelle 1-5). Anche la modulazione sull'umore c'è:
`diet-agent.service.ts` mette lo stato `conforto` quando l'umore recente è basso, e in quello stato
`menu.service.ts` moltiplica il peso del gradimento per `menu_state_boost` — cioè fa già «menu più
amati quando l'umore scende», con il guardrail `agent_comfort_max_days` che dopo qualche giorno passa a
`rientro` per non lasciarla ferma nei piatti coccola.

### Cosa manca davvero — quattro cose, in ordine di valore

1. **Il gradimento COLLETTIVO non esiste.** Il punteggio usa `starOf.get(id) ?? 5`: una cliente senza
   voti vede ogni piatto come un cinque stelle. Un piatto che duecento clienti hanno bocciato parte
   pari a uno amato da tutte. Serve una media di popolazione (con un minimo di voti perché conti) come
   punto di partenza, sostituita dai voti suoi appena ne ha. È la cosa che vale di più e costa meno.
2. **L'efficacia collettiva nemmeno.** `MenuWeight` è per cliente: quali piatti facciano perdere peso
   *in generale* non lo sa nessuno, quindi ogni cliente riparte da zero e i primi due mesi la scelta è
   cieca.
3. **Nessuna memoria della COMBINAZIONE.** Il punteggio di una giornata è la somma dei punteggi dei
   piatti: «questo pranzo con quella cena» non è un'entità che il sistema impara, e la richiesta è
   proprio sulle combinazioni. Servirebbe una tabella tipo `combo_weight` (la coppia/terna di ricette,
   l'esito sul peso, il gradimento) e una ricerca sulle combinazioni migliori, non sui piatti migliori.
4. **Il tetto dell'enumerazione, che diventa un problema con le 12 settimane.** `maxCombos = 20.000`:
   con 5 piatti per pasto le combinazioni sono 5⁵ = 3.125, quindi si enumerano tutte e si ruota fra le
   tre migliori. Con 84 piatti per pasto sono 84⁵ ≈ 4 miliardi → si passa alla `greedy`, che produce
   **una sola** combinazione: se cade fuori dalla banda calorica la giornata torna `null` e si ricade
   sui template. Cioè la ricombinazione si spegne proprio quando il catalogo diventa abbastanza ricco
   da renderla interessante. La correzione è una **preselezione**: i migliori 7 per pasto (7⁵ = 16.807,
   sotto il tetto) e poi enumerazione su quelli. La varietà non si perde, la garantisce già la penalità
   di ripetizione `menu_repeat_window_days`.

### Decisioni che servono prima di scrivere codice

- Quanto peso dare al gradimento collettivo rispetto al suo, e il minimo di voti perché un piatto
  conti come «amato».
- Se l'efficacia collettiva è accettabile per la nutrizionista: «questo piatto fa perdere peso»,
  misurato su una popolazione, è un'affermazione clinica e la decide lei, non noi.
- Se la ricerca sulle combinazioni può cambiare le giornate di una cliente **già in corso** o solo dal
  ciclo successivo.

---

## Chiuse l'11/8 (restano qui solo le decisioni che valgono per il futuro)

- **La testa delle tabelle** ora si incolla in alto dall'helper (`testaFissa`), titoli **e** riga dei
  filtri: lo scostamento della seconda riga si misura, perché un numero fisso sbaglia appena un
  titolo va a capo. Vale per Utenti, Home coach, Agenti, Posta e lead.
- **`LeadsTable` condivide la testa, non il filtro.** L'ordinamento e i titoli cliccabili vengono da
  `useOrdinamentoServer`; il filtro resta suo e lato server, e non è un lavoro rimasto a metà: lì ci
  sono intervalli di valore e di data su decine di migliaia di lead, che l'helper (tutto in memoria,
  filtri «testo» o «scelta») non sa né disegnare né sostenere. Se un giorno servisse unificare anche
  quello, la cosa da aggiungere all'helper è un tipo di filtro «intervallo» e una modalità che emette
  parametri di query invece di ordinare in memoria — non il contrario.
