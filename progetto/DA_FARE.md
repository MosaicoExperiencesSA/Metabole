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

## 4. Correzione di un cambio piatto da parte della nutrizionista

Oggi la nutrizionista **vede** i cambi concordati in chat (scheda cliente, card Conversazioni) ma
non li può correggere: lo stato `corretta` esiste nel dato e non c'è il pulsante. Serve a chiudere
il cerchio dei cambi nati da Gaia.

Insieme a questo: **«lo voglio diverso» senza dire quale pasto** — oggi Gaia chiede lo slot solo
se il testo lo contiene; se manca, va chiesto invece di scegliere per lei.
