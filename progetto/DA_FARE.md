# Da fare — richieste memorizzate, non ancora implementate

Lista unica delle cose che Simone ha chiesto di **ricordare** senza farle subito. Ogni voce ha
già dentro il posto dove va e la decisione che manca, così quando si apre non si riparte da zero.
Quando una voce viene fatta si sposta nel `REGISTRO.md` e si cancella da qui.

---

## 1. Revoca del consenso e cancellazione a 30 giorni (chiesta l'8/8)

**Dove**: profilo della cliente nell'app (`app/src/pages/Profilo.tsx`), più un cron e le mail.

Il pezzo visibile:

- card **«Consenso»** col testo «Consenso fornito il … alle ore …» (il dato c'è già:
  `clientProfile.consents.healthDataConsent.at`, scritto dall'onboarding);
- pulsante **«Revoca consenso»** → popup: «Sei consapevole che revocando il consenso i tuoi dati
  verranno cancellati entro 30 giorni?»;
- se conferma, deve **scrivere `ELIMINA`** a mano: da lì parte un timer di 30 giorni;
- **al 31° giorno** si cancella tutto, storico compreso.

Le mail, tutte e due con il pulsante **«Sospendi l'eliminazione»**:

- **subito**, alla cliente, in copia alla coach e alla manager coach;
- **il giorno prima** della cancellazione, agli stessi.

Decisioni ancora aperte (da prendere prima di scrivere il codice):

- **chi può premere «sospendi»**: solo la cliente, o anche la coach? Se anche la coach, serve un
  motivo scritto — è un dato che poi va difeso.
- **abbonamento Stripe**: la revoca disdice anche il rinnovo? Sono due volontà diverse, e
  cancellare i dati di chi continua a pagare non ha senso.
- **le fatture si tengono**: obbligo di legge (10 anni). La cancellazione riguarda i dati
  sanitari e il percorso, non la contabilità. Da dire in chiaro nella mail, o suona come una
  promessa non mantenuta.

## 2. Il «?» sulla dieta nel profilo (chiesto l'8/8)

**Dove**: `app/src/pages/Profilo.tsx`, riga `riga('book', 'La tua dieta', n.dietName, …)`.

Come nel questionario: un **«?»** accanto al nome che apre il popup con le caratteristiche di
quella dieta. Il mestiere è già fatto in due posti, va solo ricucito:

- il pattern del «?» + foglio che si apre sta in `app/src/pages/Onboarding.tsx` (`setInfo`,
  `sheet-overlay`, riga ~124);
- i contenuti stanno in `app/src/onboarding/dietInfo.ts` (`DIET_INFO`, con `DIET_INFO_FONTI`:
  le fonti ci sono già, ed è la parte che dà credibilità al popup).

Attenzione a una cosa: `DIET_INFO` è indicizzato per **stile** (`mediterranean`, `keto`,
`flexible`…), mentre nel profilo si mostra il **nome della dieta** assegnata («Flexitariana»).
Serve quindi mandare al client anche lo `style` della dieta (o usare
`Diet.clientDescription`, che esiste ed è scritto per le clienti). Da decidere quale delle due:
`clientDescription` è più specifico ma non sempre compilato, `DIET_INFO` è sempre presente e ha
le fonti. La strada meno rischiosa: `clientDescription` se c'è, altrimenti `DIET_INFO[style]`.

## 3. I grafici del fatturato e dei clienti (chiesti l'8/8)

**Dove**: `backend/src/analytics/analytics.service.ts` (la serie `monthly`),
`backoffice/src/pages/Grafici.tsx`, `backoffice/src/lib/dashboardModules.ts`.

Oggi la serie è **mensile e a 6 mesi fissi**, e questo non basta:

1. **Fatturato cumulato a giorni, che si azzera ogni mese.** L'asse deve essere i giorni del mese
   corrente (1 → oggi), non i mesi. E si deve poter **scorrere i mesi passati** (frecce avanti /
   indietro), tenendo la stessa scala.
2. **Nello stesso grafico il confronto col mese precedente, alla stessa giornata**: due linee — il
   mese in corso fino a oggi e il mese prima fino allo stesso giorno. È il confronto che dice
   qualcosa («l'8 agosto siamo sopra o sotto l'8 luglio»), mentre il totale di un mese finito
   contro un mese a metà non dice niente.
3. **Nuovi clienti per giornata**: stesso trattamento, oggi c'è solo il conteggio mensile
   (`newClients` nella serie `monthly`).

Nota tecnica: la serie giornaliera non si ricava dai dati che l'endpoint manda oggi — servono
`revenueByDay` (e `newClientsByDay`) con `mese` come parametro. Conviene un endpoint solo per
questo, che accetta l'anno-mese e restituisce le due serie affiancate (mese scelto + precedente),
invece di far ricalcolare al front-end una serie che non ha.

## 4. Tre cose viste nel collaudo dell'OTA 2.1.3 (notte del 9/8)

Il giro è andato: «Sostituisci» apre la chat, il motivo viene chiesto, il «no» non chiude più il
dialogo ma indaga. Nella schermata sono però visibili tre difetti, in ordine di quanto si notano:

1. **«non voglio lasciarti con il panna fresca nel piatto»** — errore di genere. In
   `testoChiediPercheNo` (`sostituzione-chat.ts`) l'articolo è scritto a mano (`il ${p.da}`) e gli
   alimenti hanno generi diversi. La strada già usata altrove nello stesso file è mettere il nome
   **fra virgolette** («panna fresca»), che evita di dover sapere il genere di ogni voce del
   ricettario. Correzione di cinque minuti, ma la legge la cliente.
2. **La controproposta non viene capita.** Alla conferma la cliente ha scritto «L'olio mi fa peso
   posso usare il burro vegetale?» e Gaia ha risposto «Non ho capito: confermi il cambio?». Dentro
   quella frase c'erano due informazioni: un **motivo** («mi fa peso» → digestione) e un **sostituto
   proposto da lei** («burro vegetale»). Oggi `passoConferma` legge solo sì/no e, se il testo non è
   nessuno dei due, chiede di nuovo. Da fare: se il messaggio nomina un alimento, trattarlo come
   controproposta — verificarlo contro allergeni ed esclusioni e, se regge, proporlo; se non regge,
   dirle perché (è la risposta che costruisce fiducia: «il burro vegetale sì, ma…»).
3. **La conversione ml → g non è stata collaudata.** Il sostituto proposto era l'olio evo, che è un
   liquido, quindi `unitaPerSostituto` ha correttamente tenuto `ml`. Il caso «70 ml panna → 70 g
   burro» si vede solo su un profilo **senza** lattosio fra le esclusioni: per provarlo serve un
   account di prova senza quell'esclusione.

Resta aperta, e viene prima di tutte: la **grammatura dei gruppi di grassi** (vedi sotto). In
schermata «70 ml di olio evo» al posto di 70 ml di panna sono ~630 kcal contro ~200.

## 5. Correzione di un cambio piatto da parte della nutrizionista

Oggi la nutrizionista **vede** i cambi concordati in chat (scheda cliente, card Conversazioni) ma
non li può correggere: lo stato `corretta` esiste nel dato e non c'è il pulsante. Serve a chiudere
il cerchio dei cambi nati da Gaia.

Insieme a questo: **«lo voglio diverso» senza dire quale pasto** — oggi Gaia chiede lo slot solo
se il testo lo contiene; se manca, va chiesto invece di scegliere per lei.

## 6. La pari grammatura non regge sui gruppi di grassi (per la nutrizionista)

Il cambio in chat propone sempre **pari grammatura**, ed è una scelta dichiarata: sui gruppi tipo
«carote / biete / spinaci» va bene. Sul gruppo dei **grassi** no: 70 ml di panna fresca sono ~200
kcal, 70 g di burro ~500, 70 g di olio ~630. Il collaudo del 9/8 l'ha mostrato in schermata.

Due strade, e la scelta è della nutrizionista, non nostra:

- **togliere i grassi dall'equivalenza**: chi vuole cambiare la panna passa da lei;
- **un fattore di conversione per gruppo** (es. 100 g di olio ≈ 300 ml di panna a pari grassi), da
  scrivere nel gruppo di equivalenza insieme ai membri.

Finché non è deciso, il controllo di plausibilità (`grammaturaAmmessa`) non se ne accorge: guarda il
rapporto fra le quantità, non le calorie.
