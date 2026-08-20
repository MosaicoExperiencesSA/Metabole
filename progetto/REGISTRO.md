# Metabole — Registro delle modifiche

Log cronologico. **Si aggiunge in cima**, non si cancella. Formato: `data · [Team] · area — cosa`.
Autori: `[Sviluppo]` (Simone + Claude Cowork) · `[Prodotto]` (socio + AI).

> ⚠️ **Date riallineate l'11/8/2026.** Le sezioni erano avanti di uno o due giorni: il lavoro
> fatto la sera tardi veniva scritto sotto la data del giorno dopo, e lo scarto si è accumulato
> fino a due giorni. Le date sono state riportate a quelle vere dei commit su `origin/main`
> (`git log`), e tre sezioni si sono fuse con quelle sotto: l'ex «13» è l'11, l'ex «12» e l'ex «11»
> sono il 10, l'ex «10» è il 9. Da lì all'indietro (8/8 e prima) le date risultano già corrette.
> **Dentro ai testi delle voci del 9 e del 10 può essere rimasto qualche riferimento avanti di un
> giorno**: si controlla su `git log --date=format:'%F %H:%M'`, che è la sola fonte che non
> dipende da cosa credeva il calendario di chi scriveva.
>
> Il costo di non accorgersene: l'11/8, credendo che fosse il 13, ho letto «l'ultima decisione del
> motore è dell'11» come «il cron è fermo da due notti» e ho aperto un allarme su una cosa che
> stava funzionando. **La data si verifica, non si assume** — vale per me come per il resto.

---

## 2026-08-20

- `[Sviluppo]` 🔁 **Gli «aggiornamenti grossi» erano già fatti tutti e quattro, e stavo per rifarli.**
  Poche righe prima avevo detto a Simone che erano l'unica voce di codice rimasta **mia**; lui ha
  chiesto «c'è altro che puoi fare?» e sono partito. ⛔ React è già alla **18.3.1** (in `app/` e in
  `backoffice/`), Vite alla **5.4.6**, Prisma alla **6.10.0**, Capacitor alla **6.1.2**: la voce è
  del 13/8, quando quelli erano i bersagli, e sono stati raggiunti strada facendo dentro altri
  lavori senza che nessuno tornasse a spuntarla.
  ⚠️ **È la quarta volta in due giorni** — dopo «Schermate app 30 e 27-28», «Vera: rifare i giorni
  futuri» e il commento bugiardo in `applica-proposta.ts`. ⛔ *Il costo non è la voce aperta: è che
  ci si mette a farla.* Le prime tre le ho scoperte rileggendo il codice **prima** di scrivere;
  questa con `package.json` aperto e le mani già sulla tastiera — il controllo ha funzionato
  all'ultimo momento utile, e non per prudenza: perché la prima cosa da guardare era per caso la più
  ovvia.
  ⛔ **Non l'ho allargata ai major successivi** (React 19, Vite 6, Capacitor 7 esistono): sarebbe
  un'altra decisione, e la voce diceva «una sessione tranquilla, non insieme ad altro» — che vale per
  quella nuova esattamente come valeva per questa.
  Restano **cinque** voci, e quattro aspettano una persona. ⛔ Di codice che posso scrivere da solo,
  sulla lista, non c'è più niente — e questa volta l'ho **verificato** invece di dirlo.

- `[Sviluppo]` ✅ **Il difetto 6 dell'ordine menu è chiuso — e la ragione per cui non lo facevo era
  un'opinione travestita da conclusione.** Simone: «ma i punti aperti di codice perché non li fai?».
  Domanda giusta: delle quattro, due sono ferme su persone davvero (il numero di Nocanty, il
  `kcal-need` che cambia quante calorie mangia ogni cliente); **le altre due erano mie**.
  ⚠️ La voce diceva «non ne vale la pena finché il tetto degli 80 non dà fastidio» — e quel tetto
  **non l'ho mai misurato**. Avevo perfino offerto di contarlo, non ho avuto risposta, e ho lasciato
  cadere. *«Non conviene» senza un numero non è una conclusione.*
  ⛔ Rileggendo il codice il rimedio era un altro, e l'obiezione sparisce: una rotta salvata che non
  compare nella vista può essere **due cose diverse** — **nascosta** (la pagina esiste, manca il
  permesso → va tenuta dov'era, è il difetto 7) e **morta** (la pagina non esiste più → consuma una
  delle 80 righe per sempre). Distinguendole, la morta si toglie **nel momento in cui la persona
  salva comunque**: nessuna scrittura in più. ⚠️ *La voce aveva ragione sul rimedio che proponeva e
  torto sulla conclusione*: aveva guardato una sola strada, e da lì aveva dedotto che il difetto non
  si potesse chiudere a buon mercato.
  ⚠️ **E la rete vale più della correzione**: senza l'elenco delle rotte che il software ha davvero,
  non si toglie niente — un difetto lì cancellerebbe l'ordine del menu di tutti, e *«non lo so» deve
  costare meno di «ho indovinato»*.
  ⛔ **Resta di codice**: gli aggiornamenti grossi. Su Prisma c'è un vincolo vero (in questo
  contenitore il download del motore è bloccato, quindi non posso verificarlo); React e Vite nel
  backoffice si possono fare e verificare — e quelli non li ho fatti **per scelta mia**.

- `[Sviluppo]` 🚪 **I tre passi in un posto solo — e una mia ragione falsa, fermata prima di
  consegnarla.** «Questo ingrediente che riga è, e la posso usare?» la fanno in due (il conto dei
  macro e il passo notturno) e aveva due risposte in due file. Il **passo 2** è divergito davvero
  stamattina e ha fatto danno; ora i tre passi stanno in `per-la-ricetta.ts`.
  ⚠️ **La parte che vale più del modulo.** Nel commento avevo scritto che divergeva anche il passo 3
  — l'indice per nome-o-sinonimo contro l'uguaglianza sul nome — e l'avevo messo nero su bianco come
  un difetto trovato. ⛔ **Non può manifestarsi**: se un'altra riga porta quel nome, l'abbinamento la
  vede come un secondo candidato di pari peso e torna `null` («due righe che vanno bene uguale = non
  lo so»), quindi quando risponde quella riga è unica e i due criteri **coincidono sempre**.
  ⚠️ A dirmelo è stata **una mutazione che non mordeva**, non il ragionamento: avevo scritto un test
  per dimostrare la divergenza, il test passava anche col codice mutato, sono andato a verificare
  eseguendo. *Una ragione falsa in un commento è peggio di nessun commento* — chi legge si fida e ci
  costruisce sopra. Corretta, con dentro come me ne sono accorto.
  ⚠️ **E un secondo test mi ha smentito nello stesso giro**: «con la riga a crudo e quella bollita il
  nome non è un lavoro» — no, due righe con lo stesso nome fanno tornare `null` l'abbinamento, quindi
  in produzione quel nome **non si conta** e resta in elenco giustamente. *L'elenco diceva il vero;
  ero io ad aspettarmi la risposta sbagliata.*
  La porta è anche più grande: il test sul sorgente adesso guarda pure chi chiama `scegliPerRicetta`.

- `[Sviluppo]` 🧹 **L'elenco di lavoro conteneva cose già fatte, in due modi diversi.** Trovati
  partendo dalle cinque righe che Simone aveva appena corretto.
  ⛔ **Il lavoro appena fatto non spariva: si spostava nella lista sbagliata.** Un nome che smetteva
  di essere un problema prendeva `ricette: 0` e restava `open` — e la pagina divide i due elenchi
  proprio su `ricette`, quindi finiva in «**chiesti dalle clienti e non trovati**» con «— / —».
  ⚠️ Non era teorico: le cinque righe «non si applica» sarebbero riapparse **quella notte** fra le
  domande delle clienti. Ora un termine risolto esce con `status: 'risolto'` — ⚠️ e «risolto» **non
  è «filled»**: `filled` e `ignored` li scrive una **persona** e non si toccano più; `risolto` lo
  scrive il passo notturno, quindi il passo notturno può disfarlo se quel nome torna a essere un
  problema. *Chi ha chiuso una cosa decide chi può riaprirla.* E l'elenco «chiesti dalle clienti»
  adesso chiede `times > 0`: una riga che nessuna cliente ha chiesto non ci va, per definizione.
  ⛔ **E l'elenco contava come «da fare» i nomi che il sistema già sa trattare.** Un nome fuori
  tabella finiva in elenco anche quando l'abbinamento trovava una riga buona — ma se l'abbinamento
  ci arriva **il conto funziona già**. ⚠️ *Un elenco di lavoro che contiene cose già fatte non è
  lungo: è falso* — e il costo lo paga chi ci lavora, che dopo tre righe inutili smette di fidarsi
  anche delle altre. ⚠️ Ma se la riga raggiunta è **bollita**, il problema c'è ed è **quello**:
  adesso si dice col motivo giusto, perché «aggiungi la riga a crudo» è un'istruzione e «non in
  tabella» su un nome che in tabella ci arriva è una caccia al tesoro.
  ⚠️ **Due test dicevano il contrario e passavano.** Non li ho girati in silenzio: sopra c'è scritto
  cosa dicevano prima e perché era sbagliato.

- `[Sviluppo]` 🚪 **La diagnostica chiamava la regola in modo diverso dalla produzione, e mandava la
  nutrizionista a fare un lavoro inutile.** Simone ha lanciato `NOME='spinaci freschi' npm run
  diag:crudo-cotto` per capire perché 1350 ricette non si abbinano: ha risposto «NON si abbina», e ha
  risposto **male**. ⛔ Il difetto non era nei dati, era nello strumento: `abbina` prende `nomiDi` e
  `statoDi` come parametri — giusto, è una funzione pura — ma allora i chiamanti possono passarli
  **diversi**, e l'hanno fatto: `cercaPerIngrediente` passava lo stato della riga, `diag:crudo-cotto`
  **no**. Dal 19/8 sera una parola di stato si accetta solo se combacia con lo stato della riga:
  senza `statoDi` non combacia **mai**. ⚠️ E quella diagnostica è *il foglio da cui la nutrizionista
  decide quali righe scrivere a mano*: la stava mandando a scrivere righe che il codice vero sa già
  trattare. ⚠️ Stessa specie di errore di un test double che diverge dall'originale — sei volte in
  due giorni — ma **un test double lo scopre una mutazione; questa copia viveva in uno script**, dove
  nessuna mutazione arriva.
  ✅ Ora c'è `abbinaPerRicetta`: una porta sola, i due parametri decisi in un posto solo. E un test
  che **guarda il sorgente** (`una-porta-sola.spec.ts`) verifica che nessuno chiami `abbina` per
  conto suo, **compresi gli script di `prisma/`** — insolito, e per una ragione precisa: uno script
  non ha test, quindi è il posto dove una copia sbagliata resta per settimane senza diventare rossa.
  ⚠️ Il primo colpevole trovato dal test nuovo era **un test double**: le sue righe avevano la forma
  `{chiave, name}` invece di quella vera. Invece di metterlo in lista bianca gli ho dato la forma
  giusta — una divergenza tolta, non benedetta.
  ✅ **E la risposta sugli spinaci**: la riga «spinaci» ha lo **stato vuoto**, quindi «freschi» non ha
  niente con cui combaciare. Scrivere `crudo` in quel campo chiude 1350 ricette. La diagnostica ora
  lo **dice**, invece di rimandare la domanda a chi legge con un «qualificatori innocui? se no…».

- `[Sviluppo]` 📋 **Lista lavori aggiornata.** ⚠️ Da ieri sera l'allineamento gira **da solo** a ogni
  deploy, quindi qui non c'era da spuntare: c'era da **scrivere** quello che oggi è diventato un
  lavoro per una persona e che finora stava solo nei miei messaggi. Una voce nuova,
  `tabella-alimenti-igiene`, e ⚠️ **una sola per due cose**: le fa la stessa persona, sulla stessa
  tabella, nella stessa mezz'ora — due voci separate avrebbero fatto crescere l'elenco senza
  aggiungere una decisione, che è precisamente la domanda con cui questa pagina è nata («pensavo di
  chiudere la lista lavori ma invece che diminuire aumentano»).
  Dentro: le **cinque righe** che non hanno uno stato e non devono averlo (olio, olio evo, miele,
  sale, zucchero → «non si applica»), e i **1350 «spinaci freschi»** che non si abbinano. ⚠️ Su
  quest'ultimo la voce dice che la mia è un'**ipotesi** e come leggerla, invece di darla per buona:
  oggi ragionare su dati immaginati invece che letti mi ha morso due volte.
  Restano **sette** voci, cinque delle quali aspettano una persona.

- `[Sviluppo]` 🫒 **Lo stato che «non si applica»: olio, sale, miele.** In cima all'elenco degli
  alimenti da correggere c'erano `olio extravergine di oliva` (3025 ricette), `olio evo` (1706),
  `miele` (1331), tutti «Senza stato». ⚠️ Ma all'olio lo stato **non si applica**: crudo o cotto è la
  stessa cosa, 899 kcal restano 899. ⛔ Il danno era doppio e invisibile: ogni ricetta dettata a Vera
  con l'olio si portava dietro «la tabella non dice se il valore è a crudo» — *un avviso che compare
  sempre non è un avviso*, e compariva sull'ingrediente più usato del catalogo — e quelle righe
  occupavano i primi posti dell'elenco, **dove nascondevano le righe da correggere davvero**.
  ✅ La correzione è un patto che in quella tabella c'è già: `glycemicIndexReliability:
  'non_applicabile'`, dal 18/8, con scritto accanto «"non si applica" non è "non lo so"». Lo stesso,
  applicato allo stato: *vuoto = nessuno l'ha guardato; «non si applica» = qualcuno l'ha guardato e
  ha detto che non c'è.* ⚠️ **Non si deduce, si dichiara**: nessuna regola indovina quali alimenti
  non hanno stato — una regola così sbaglierebbe sul primo caso nuovo, in silenzio, ed è esattamente
  la scorciatoia che stamattina ha fatto uscire il limone come aroma. E una riga **bollita** resta
  «solo da cotto» qualunque cosa: il valore nuovo non è una scappatoia per far passare quello che
  non passa.
  In pagina una tendina di suggerimento sui due campi «Stato» — ⚠️ un **suggerimento**, non una
  regola: chi decide resta `normalizzaStato`, e scrivere a mano continua a funzionare.
  ⛔ **Resta da fare a mano, ed è lavoro di persone**: aprire la matita su olio, olio evo, sale,
  miele, zucchero e scrivere «non si applica». Cinque righe.

- `[Sviluppo]` 🔍 **Revisione avversariale sul lavoro di stamattina: 13 rilievi, e il primo l'ho
  confermato in un secondo provando la funzione sui nomi veri.**
  ⛔ **«Limone» usciva come aroma — 3146 ricette, per sempre.** L'elenco chiuso conteneva `limone`,
  `noce`, `succo`, `scorza`, `aceto`: premendo «Togli questi N» il limone (un frutto da 11 kcal)
  sarebbe uscito dall'elenco di lavoro e nessuno l'avrebbe rimesso. ⚠️ E il commento venti righe
  sopra diceva già che doveva restare fuori: `limone` l'avevo messo per far funzionare «succo di
  limone». *Una parola aggiunta per far passare un caso ne fa passare cento* — la stessa forma
  dell'errore delle `mele` di due ore prima, alla riga sotto quella che lo raccontava.
  ⛔ **`creaDaMancante` poteva creare due righe che rispondono allo stesso nome**: il controllo
  guardava `name` (che è `@unique`) e non i **sinonimi**, dove sta la collisione vera. Cioè la voce
  228 rimessa in piedi da un endpoint il cui commento dice di esistere per impedirla.
  ⛔ **«8OO» diventava «non lo so», in silenzio**: una riga nasceva senza calorie, confermata — e da
  quel momento il termine spariva dalla lista di lavoro mentre il conto continuava a saltarlo. *Una
  scorciatoia che nasconde un buco è peggio del buco*, la stessa frase scritta venti righe sopra
  sull'altro pulsante. E `kcal: -500` passava, **sottraendo** dal totale di una ricetta.
  ⛔ **Il rilascio richiudeva una voce riaperta a mano.** Il patto «una spunta messa a mano non si
  discute da un file» valeva sulle spunte **messe** e non su quelle **tolte** — cioè su un gesto che
  dice «questo lavoro non è finito», l'unico modo che Simone ha di contraddirmi. Ora una riga chiusa
  una volta dal file porta il segno e non si tocca più.
  ⛔ **I titoli che non combaciano sparivano nel silenzio**, e **il messaggio sulla scrittura in
  blocco veniva cancellato prima di comparire** (`setError` seguito da `carica()`, che azzera). *Uno
  strumento che dice solo quello che è riuscito a fare racconta sempre una giornata perfetta.*
  ⚠️ **E un errore mio nel leggere i test**: per tre giri ho letto «Tests: 28 passed» su una suite
  che **non compilava**, senza guardare la riga sopra — «Test Suites: 1 failed». I quattro test nuovi
  non stavano girando affatto. *Il verde non è una riga sola.*

- `[Sviluppo]` 🧂 **«Togli gli aromi», con la lista davanti** (scelta di Simone fra quattro strade).
  Metà dei primi venti posti dell'elenco «Alimenti da correggere» sono aglio (3886 ricette), sale
  (3296), pepe, acqua, prezzemolo, basilico: pesano **zero** nel conto e occupano lo spazio delle
  righe che servono davvero. ⚠️ **Prima si guardano, poi si scrivono**, e la separazione è la
  richiesta: due endpoint, uno dice *cosa* toglierebbe e non tocca niente. E il pulsante manda gli
  id che l'operatrice ha **visto**, ma il server **ricontrolla ognuno** contro l'elenco chiuso —
  fidarsi degli id vorrebbe dire che una pagina rimasta aperta da ieri può togliere un alimento
  vero, e nessuno lo rimette.
  ⛔ **Dire «è un aroma» vuol dire dire «le sue calorie non contano»**, e per questo l'elenco è
  chiuso, corto e scritto a mano. ⚠️ **Chi è rimasto fuori è la parte che conta**: cipolla (40
  kcal/100 g e in una ricetta ce ne va un etto), «limone» da solo (quasi sempre è il succo, ma «un
  limone» è un frutto — entrano solo «succo di limone» e «scorza di limone»), brodo vegetale (in un
  risotto ce ne vanno 500 ml), sedano e carota. *Sbagliare per prudenza costa un clic; sbagliare per
  comodità toglie un alimento vero e non se ne accorge nessuno.*
  ⚠️ **E il test ha bocciato la prima versione per una lettera**: avevo messo `mele`, `vino` e `riso`
  fra le parole innocue (per «aceto di mele»), e così «riso al curry» e «succo di **mele**»
  diventavano aromi — mentre «succo di **mela**», al singolare, no. Due piatti veri tolti dall'elenco
  per una `e` finale. Una terza mutazione ha poi mostrato che un nome fatto **solo** di parole di
  contorno («tritato fresco», «q.b.») passava per aroma: non lo è, è un nome storto — ed è
  esattamente quello che questa lista serve a scoprire.

- `[Sviluppo]` 🔗 **«Associa» e «dettaglio» sugli alimenti da correggere** (richiesta di Simone).
  ⚠️ **Restano due pulsanti, e tenerli separati è il punto**: «associa» dice *«questo nome è un
  altro modo di chiamare una riga che c'è già»* (l'olio scritto in tre modi, 6494 ricette),
  «dettaglio» dice *«questo alimento in tabella non c'è»* (melanzane, fagiolini, coda di
  pescatrice). ⛔ Un pulsante solo obbligherebbe a decidere **dopo** aver cliccato, e la scelta
  sbagliata qui non è un fastidio: *un sinonimo messo dove serviva una riga fa sparire il buco senza
  chiuderlo* — il termine esce dall'elenco, il passo notturno non lo riapre, e nessuno sa più che
  manca.
  **Associa** è una **tendina**, non un campo libero: si sceglie fra le righe che ci sono davvero,
  con lo stato accanto — un nome scritto a mano finirebbe attaccato a niente, o alla riga sbagliata
  per un errore di battitura. **Dettaglio** usa **gli stessi campi della matita**, non una seconda
  maschera: due form per la stessa cosa divergono. ⚠️ E il **nome non si scrive**, è il termine: se
  fosse libero si chiuderebbe il mancante creando un alimento che con quel mancante non c'entra
  niente. ⚠️ Un campo vuoto resta vuoto e non diventa `0`: su un valore nutrizionale la differenza
  fra «non lo so» e «zero» si vede nel piatto.
  ⚠️ **E un finto che rispondeva uguale a qualunque domanda — la sesta volta oggi.** Il test «se una
  riga con quel nome c'è già» aveva un doppio che tornava sempre la stessa riga, qualunque `where`
  gli arrivasse: passava anche mutando la query, cioè verificava che l'endpoint sa leggere una
  variabile, non che cerca la riga giusta.

- `[Sviluppo]` 🔎 **La lista della spesa adesso dice come lo scrivono davvero.** La sezione 1 di
  `diag:ricerca` stampava **parole**, non nomi interi — e da «denocciolate → nocciola» non si può
  sapere se serve una **riga nuova** in tabella o basta un **sinonimo**: dipende da com'è scritto
  l'ingrediente per intero. ⛔ Ci sono cascato io: ho ragionato su «denocciolate» come se
  l'ingrediente fosse «olive denocciolate» e stavo per allargare l'elenco chiuso dei qualificatori
  per chiudere 450 usi con la regola che abbiamo già — su un nome che **non ho mai visto**. ⚠️ È la
  seconda volta oggi che ragiono su un dato immaginato invece che letto (la prima è stata «pure»,
  due ore fa). Ora ogni riga porta i due nomi interi più frequenti in cui la parola compare, e si
  decide guardando. *Una diagnostica che costringe chi la legge a immaginare il dato si legge male —
  e la legge peggio chi l'ha scritta, perché crede di sapere già cosa c'è dentro.*

- `[Sviluppo]` 🙈 **La diagnostica mangiava gli accenti, e ho dato la colpa ai dati.** Leggendo
  `diag:ricerca` ho visto «purea → risponderebbe **pure**» e ho scritto a Simone che in tabella c'era
  una riga chiamata «pure», «probabilmente un *purè* a cui è caduto l'accento in fase di import», da
  guardare. ⛔ **Non era vero**: l'import scrive il nome verbatim, `normalizzaNome` serve solo ai
  confronti. Quel «pure» era la stampa di un «purè» perfettamente in ordine. ⚠️ Gli ho fatto cercare
  un fantasma — e l'ho fatto nello stesso messaggio in cui gli spiegavo che un avviso che non può
  scattare fa credere di proteggere qualcosa: **la stessa specie di errore, in mano mia, due
  paragrafi più sotto.** Ora la sezione lavora sui nomi normalizzati (deve: è così che si
  confrontano) ma **stampa il nome vero**. *Una diagnostica che mostra i nomi storpiati manda le
  persone a caccia di errori che non ci sono, e ci va per prima chi l'ha scritta.*

- `[Sviluppo]` 📢 **Un avviso che non poteva più scattare, e continuava a gridare quaranta.**
  `diag:ricerca` apriva con «⚠️ di queste ne possono scattare 40» — vero finché il modo era il pezzo
  di parola, **falso dalla sera del 19/8**, quando il modo è passato a `parole_intere`. E la riga
  stava venti righe sopra un'altra riga dello stesso programma che diceva «il modo in produzione
  adesso è: parole_intere». ⛔ *Un avviso che non può più scattare fa credere che stia proteggendo
  qualcosa* — la stessa regola per cui il 19/8 sera ho tolto un controllo morto da
  `abbinamento-alimenti.ts`; qui era peggio, perché il numero era grosso e allarmante. ✅ Adesso la
  frase **dipende dal modo**: col pezzo di parola grida, a parole intere dice quello che quelle righe
  sono davvero — la **lista della spesa** della tabella alimenti.
  ⚠️ E letta per quello che è, con 60 nomi invece di 20, dice cose nuove: «sottolio»→olio (il tonno
  sott'olio contato come olio d'oliva), «paneer»→pane, «rapanelli»→pane, «papera»→pera, e
  «purea»→**«pure»**, che vuol dire che in tabella c'è una riga chiamata così: da guardare.

- `[Sviluppo]` ⏳ **Quattro code sono fuori dalla rete di sicurezza nuova, e due partono il 22/08.**
  `diag:coda` è pulita (zero sovrapposizioni, zero code fermate, zero scadute), ma dice anche che
  quattro piani in coda sono ancora nella **forma vecchia** — `active` con la partenza nel futuro.
  ⛔ Dal 19/8 sera il lavoro notturno rifiuta di far partire una coda che finirebbe addosso a un
  piano ancora in corso e apre una segnalazione — ma cerca `status: 'queued'` e **quelle quattro non
  le vede**: partiranno da sole alla loro data, senza che nessuno controlli niente.
  `CONFERMA=1 npm run converti:code` le porta sotto la stessa rete, e va fatto **entro il 21/08**.
  ⚠️ La diagnostica diceva ancora «← le convertirà la consegna dopo», e la consegna è passata: *un
  testo che descrive un futuro già arrivato smette di essere un promemoria e diventa una scusa*.

- `[Sviluppo]` 🧯 **L'allineamento automatico della lista non si fa più fermare da una voce già
  creata.** Ieri sera ho consegnato uno script che gira **da solo** a ogni deploy e non l'avevo mai
  fatto girare — è esattamente il genere di cosa che ieri mi ha morso cinque volte. Fatto girare
  stamattina: il difetto non è nel codice, è nel **passaggio da pulsante ad automatismo**.
  ⛔ `chiave` è `@unique`, e due deploy ravvicinati sono un caso **già visto e documentato** in
  `render.yaml` (il retry sul lock delle migrazioni nasce da lì). Se il secondo giro incontrava una
  voce che il primo aveva appena creato, l'eccezione **abortiva tutto l'allineamento** — e le spunte
  vengono dopo le creazioni. Cioè «questa voce c'era già», la cosa più innocua che possa succedere,
  lasciava la lista a raccontare come aperto un lavoro finito: precisamente ciò che Simone mi aveva
  chiesto di smettere di fargli fare a mano. ⚠️ *Davanti al pulsante c'era una persona che leggeva
  l'errore e rilanciava. Qui no.*
  ⚠️ E si ingoia **solo** la violazione di unicità: un guasto che si ingoia diventa un automatismo
  che non fa niente e dice che è andato tutto bene — su un passo che gira senza nessuno davanti, è
  la cosa peggiore che possa fare.

## 2026-08-19

- `[Sviluppo]` 🤖 **La lista si allinea da sola a ogni rilascio** (Simone: «non devo spuntare io le
  voci, fallo tu»). ⚠️ La frase dice una cosa più grossa di quello che sembra: *se dopo ogni consegna
  una persona deve ricordarsi di premere un pulsante perché l'elenco dica la verità, quel pulsante è
  un lavoro* — e le cose che vanno ricordate ogni volta, prima o poi, non si ricordano. Poi qualcuno
  legge l'elenco, ci trova aperte delle voci già chiuse, e ci perde una giornata: è successo oggi,
  tre indagini su tre lavori già fatti.
  L'allineamento è nel `preDeployCommand`, accanto alle migrazioni, ed è **lo stesso codice del
  pulsante** — non una seconda copia: due strade che scrivono la stessa cosa in due modi divergono.
  ⛔ Con un `|| true` intorno: far fallire il rilascio di un'app che serve delle clienti **per la
  contabilità dei nostri compiti** sarebbe una sproporzione. ⚠️ E stampa i **titoli**, non i numeri:
  «3 voci spuntate» non si può verificare, «ho chiuso *Moduli fissi in dashboard*» sì — è l'unico
  modo in cui un automatismo che tocca l'elenco di qualcun altro si può controllare.
  ✅ **E il file è allineato alle risposte già date**: chiuse Colazioni, Riconoscitore allergeni,
  Vincolo piani sovrapposti, Nomi liberi degli ingredienti e File-e-pagina. Restano **sei** voci, e
  cinque aspettano una persona.
  ⚠️ **Sulla voce degli allergeni ho scritto cosa è stato verificato e cosa no**, e non è pignoleria:
  quello che c'è è il *giudizio* di chi conosce le ricette, non la misura che la voce chiedeva — il
  confronto fra un campione confermato a mano e quello che il riconoscitore avrebbe detto, coi due
  numeri separati. ⛔ Il primo dei due — quante volte **non** vede un allergene che c'è — è quello
  che fa male, e resta non misurato. Chiudere sulla parola di chi sa è una decisione legittima;
  crederla una misura no.

- `[Sviluppo]` 🔍 **Seconda revisione avversariale della giornata, sulle consegne che avevano visto
  solo i miei occhi: 27 rilievi.** Le sei che contano.
  ⛔ **La coda che non sarebbe mai partita, e nessuno l'avrebbe saputo.** Stasera avevo insegnato al
  cron a non promuovere una coda che finirebbe addosso a un altro piano — giusto. Ma su un
  abbonamento **ricorrente** ogni rinnovo sposta la scadenza avanti di un mese: la coda dietro resta
  sovrapposta **per sempre**, e quel piano già pagato non sarebbe mai partito. E lo raccontavo in tre
  posti che non legge nessuno. ⚠️ *Il difetto di famiglia di questo progetto — un dato che agisce e
  non si vede — commesso mentre lo stavo chiudendo.* Ora ogni coda ferma apre una **segnalazione**.
  ⛔ **La pausa contava i giorni in UTC e la matita a Roma.** `setHours(0,0,0,0)` con scritto accanto
  «mezzanotte locale»: su Render il processo è in UTC. Un piano che finisce alle 00:00Z del 26 e una
  coda che parte alle 22:00Z del 25 sono lo **stesso giorno a Roma** e due giorni diversi in UTC — la
  coda non scorreva e finiva dentro il piano allungato: il caso Lorena riaperto dal confine di
  giorno, dentro il modulo scritto per chiuderlo. ⚠️ E la suite non se ne accorgeva perché **tutte le
  date dei test erano a mezzanotte UTC**, dove i due modi coincidono sempre.
  ⛔ **«Le gallette e il riso» diventava «gallette di riso».** `cercaTutti` toglieva le paroline da
  entrambi i lati e riattaccava le parole: chi chiedeva di **due** alimenti riceveva **un** numero,
  sbagliato e plausibile. La stessa classe di errore chiusa stasera con «parole intere», riaperta da
  un'altra porta nella stessa funzione. ⚠️ E la prima correzione era ancora sbagliata («in mezzo si
  salta solo una parolina» — ma «e» e «il» *sono* paroline). La regola vera: **la domanda può
  togliere paroline, non aggiungerne**. Me ne sono accorto solo scrivendo la frase vera.
  ⛔ **Il passo notturno poteva far riavviare l'istanza**: ~5 secondi di CPU bloccante dentro il
  processo che serve le clienti, con l'health check a 5 secondi — e l'8/8 un'istanza è già stata
  uccisa così. Un indice preparato una volta: da 5000 ms a 40 ms, stesso risultato.
  ⛔ **L'elenco dei mancanti aveva sepolto la ragione per cui esiste**: ordinato su due unità diverse
  con un tetto unico, le prime 200 righe erano sempre e solo ingredienti di ricette e **nessun
  termine chiesto da una cliente** poteva più comparire. Ora due elenchi, due tetti, due conteggi.
  ⛔ **Il pulsante «è "X"» poteva nascondere un buco da tre volte**: «lenticchie bio» attaccato alla
  riga *bollita* usciva dall'elenco come risolto, e il lavoro vero (la riga a crudo, 325 contro 93
  kcal) spariva per sempre. Ora l'endpoint rifiuta e spiega.
  Più: il rinnovo Stripe che segnalava ogni mese senza aver scavalcato niente; `scritti` che contava
  le intenzioni e non gli esiti; i sinonimi con leggi-modifica-scrivi (due operatrici insieme e uno
  spariva); «Ripristina default» che filtrava i moduli sui permessi e **salvava il filtrato** — mia
  correzione di due ore prima, e sembrava più pulita.
  ⚠️ **E un finto a cui mancava un metodo, la quinta volta oggi**: senza `escalation` nel doppio di
  `commerce.spec`, `apriSegnalazione` avrebbe tirato un `TypeError`, il `.catch` l'avrebbe inghiottito
  e la segnalazione non sarebbe stata provata da nessuno. Ogni volta l'ha detto una mutazione o una
  revisione, **mai i test verdi**.

- `[Sviluppo]` 📋 **Le voci scritte a mano in pagina ora si possono chiudere — per titolo** (richiesta
  di Simone: «la lista è piena, aggiorna le cose fatte»). Una voce scritta dal backoffice ha
  `chiave: null`: il file non la vede, quindi **nessuna consegna la può spuntare**, nemmeno a lavoro
  finito. ⚠️ Oggi è costato **tre indagini** — «Schermate app 30 e 27-28», «Vera: rifare i giorni
  futuri», «Moduli fissi in dashboard»: tutte e tre già fatte, e ogni volta sono partito per rifarle.
  Ora il caricamento le chiude per titolo con `soloSeEsiste`: solo per chiudere, mai per creare, e
  ⛔ **solo se il titolo combacia con una riga sola** — due voci intitolate uguale sono due lavori
  diversi, e spuntarne una a caso è il genere di errore silenzioso che qui si passa le giornate a
  togliere.

- `[Sviluppo]` 🔁 **«Ripristina default» manteneva un terzo della promessa.** Ero partito per la
  voce «Moduli fissi in dashboard»: ⚠️ **era già fatta dal 18/8** — terza volta oggi che una voce in
  pagina risulta aperta su un lavoro chiuso. Ma rileggendo la richiesta fino in fondo («se un utente
  **si è perso** preme il pulsante e noi provvediamo») è saltato fuori un difetto vero: la home si
  personalizza in **quattro** posti — i moduli, i blocchi spenti (portafoglio, avvisi, tabella
  clienti), i grafici e le scorciatoie — e il pulsante rimetteva **solo i moduli**. ⛔ Chi si era
  perso spegnendo il portafoglio lo premeva e non tornava niente. *Un pulsante di soccorso che
  soccorre un terzo dei casi è peggio di nessun pulsante*: chi lo preme e non vede tornare la sua
  roba conclude che non si può più recuperare, e smette di provarci. «Si è perso» non vuol dire «ha
  spento un modulo».
  ✅ Ora rimette tutte e quattro, in **una PUT sola** — quattro chiamate separate possono riuscire a
  metà, e una home ripristinata a metà è esattamente lo stato da cui la persona stava cercando di
  uscire. ⚠️ Tre dettagli che sembrano pignoleria e non lo sono: **le scorciatoie si riscrivono per
  esteso** (chi le legge fa `?? DEFAULT`, e un array vuoto non è nullo — salvare `[]` darebbe una
  dashboard senza scorciatoie, l'opposto di «ripristina»); **i moduli si filtrano** su quelli che
  quel ruolo vede davvero, o si salverebbero righe morte che riemergono il giorno che il permesso
  arriva; **si tornano copie**, non le costanti.
  ⛔ **L'ordine del menu non è dentro, di proposito**: ha il suo pulsante nel suo riquadro, a tre
  centimetri. Un pulsante che fa una cosa che il suo testo non dice si paga la prima volta che
  qualcuno non capisce perché il menu è cambiato.
  ⚠️ E questa zona non aveva **nessun test**: adesso ne ha otto sul pezzo puro, con tre mutazioni
  che mordono.

- `[Sviluppo]` 🪤 **Un commento che mentiva, e ci sono andato vicino a rifare un lavoro già fatto.**
  Sono partito per la voce «Vera: rifare i giorni futuri non ancora aperti quando il capo approva un
  divieto di dieta» (priorità alta). ⚠️ **Era già fatta dal 18/8.** Il motivo per cui non si vedeva
  è un commento in `applica-proposta.ts`, **venti righe sopra il codice che lo fa**: diceva che i
  giorni si sarebbero rifatti «in un secondo momento» e rimandava a una voce di elenco lavori,
  `vera-regola-dieta-rifai-menu`, ⛔ **che non è mai esistita** — quella chiave compare in un solo
  posto in tutto il progetto, dentro quel commento. ⚠️ *Un commento che descrive un lavoro come da
  fare quando è fatto non è impreciso: è una trappola.* Chi apre il file per capire se la voce è
  aperta legge il commento, non le settanta righe sotto. Corretto, e con dentro la memoria di cosa
  diceva prima: **il codice non mente mai, i commenti sì**.
  ⚠️ **E il tetto dei 200 clienti non aveva nessun test sul ramo che conta.** Ce n'era uno, ma sul
  ramo della *restrizione a una cliente*; sul ramo della **dieta** — quello che decide se migliaia
  di giornate di menu vengono cancellate — nessuno. Tre casi nuovi: *oltre il tetto la regola si
  scrive e i giorni non si toccano* (le due metà non si possono scambiare: un test che guardasse
  solo «non ha cancellato» passerebbe anche se il capo avesse approvato un divieto che non vale);
  *esattamente 200 non è «oltre»* (senza questo caso `>` e `>=` sono indistinguibili, e la
  differenza è duecento persone); *il tetto conta le persone, non le giornate* (altrimenti
  scatterebbe su tre clienti con il trimestre già pronto, e il divieto non arriverebbe mai ai loro
  piatti). Tre mutazioni, tutte e tre mordono.

- `[Sviluppo]` 🗣️ **«Se non sai come prenderle, guarda il video toccando il pulsante» — e il pulsante
  non c'era.** Cercando cosa fossero l'«assaggio menu» e i «video onboarding» di una voce vecchia
  dell'elenco (Simone: «video onboarding cosa intendi? assaggio menu togliamolo da ovunque») ho
  trovato un difetto vivo: la pagina delle **misure di partenza** del questionario prometteva a ogni
  cliente un video e un pulsante **che non esistono** — in tutta l'app non c'è nessun `<video>`,
  nessun asset, nessun handler. La frase veniva dal prototipo, dalle schermate 28-29, ⛔ **annullate
  da Simone il 17/07**, ed è rimasta in produzione per settimane. ⚠️ *Un difetto di testo non è un
  difetto minore quando il testo è una promessa*: stava nel punto più delicato del questionario — le
  prime misure di una persona — e chi cercava il pulsante e non lo trovava pensava di aver sbagliato
  lei. ✅ Al suo posto una cosa vera («scrivimelo in chat: te lo spiego io»), più un test che
  impedisce ai testi del questionario di promettere un media che il prodotto non ha.
  ⚠️ **E le due cose della voce erano già morte tutte e due.** L'«assaggio del menu» non è mai
  esistito nel codice — zero rotte, zero componenti, zero endpoint — ed era già stato superato da
  «Conosciamoci» il 13/8; i video erano le schermate **28-29** e non 27-28 (la voce mescolava due
  numerazioni: il 27 è «Il tuo percorso è pronto», che c'è ed è fatto). ⛔ Cioè la voce teneva vive
  per un mese due cose annullate e un numero sbagliato, e ogni volta che qualcuno la leggeva ci
  perdeva del tempo.
  Allineati i **tre** documenti che raccontano lo stato di oggi (`DA_FARE.md`,
  `PUNTO_DELLA_SITUAZIONE.md`, `Checklist_Allineamento_STATO.md`). ⚠️ **Non** toccati i
  `DA_RIPRENDERE_*`: sono fotografie datate, e riscrivere una fotografia è il modo di non poter più
  ricostruire cosa si sapeva quel giorno.
  ⛔ Resta in elenco, priorità bassa: **come si prendono davvero le misure**. Vita e fianchi si
  misurano in modi diversi e la differenza è di centimetri — cioè di quello che il motore legge come
  progresso. Un disegno, tre righe della nutrizionista o un video vero: lo decidono Simone e Lucia.

- `[Sviluppo]` 🧾 **La tabella degli alimenti da correggere a mano** (risposta di Simone sulla voce
  dei nomi liberi: «crea una tabella dove possiamo correggere a mano»). L'elenco esisteva già, ma
  solo come **testo** dentro `diag:crudo-cotto` e `diag:ricerca`, cioè su una shell di Render. ⚠️ Un
  elenco di lavoro che vive dove chi deve lavorarci non entra è un elenco che nessuno lavora.
  ⚠️ **Non una pagina nuova e non una tabella nuova**: «quali alimenti ci mancano» è **una**
  domanda, e la risposta arrivava già da due parti — le clienti che li chiedono a Gaia e le ricette
  che li usano. Due tabelle divergono al primo giorno e fanno lavorare due volte sullo stesso nome.
  Stessa riga, stessa pagina (Valori nutrizionali), nessuna chiave di permesso nuova. ⚠️ E i due
  numeri **non si sommano**: «chiesto 40 volte» e «usato in 1025 ricette» sono unità diverse, e un
  totale inventato farebbe ordinare l'elenco su un numero che non vuol dire niente.
  ⚠️ **L'elenco dice anche PERCHÉ**, perché i tre casi si chiudono in tre modi diversi: *non in
  tabella* (una riga nuova), *solo da cotto* (la riga a crudo — nelle ricette le grammature sono a
  crudo), *senza stato* (lo stato dichiarato). Un elenco che dice solo «manca» obbliga chi lo lavora
  a ricapirlo ogni volta, e chi deve ricapire ogni volta dopo un po' non lo apre più.
  ✅ **Il pulsante che fa risparmiare il lavoro vero**: quando l'abbinamento saprebbe dove portare
  quel nome, l'elenco lo dice e offre «è "olio extravergine di oliva"» — un clic, e il nome diventa
  un **sinonimo** di quella riga. L'olio scritto in tre modi sono 6494 ricette, e si chiudono con
  tre sinonimi invece che con tre righe nuove — righe che sarebbero *lo stesso alimento contato due
  volte*, con numeri che prima o poi divergono. ⛔ Lo decide una persona: l'elenco suggerisce, non
  applica.
  ⚠️ **Tre cose che il passo notturno NON fa**: non tocca `status` (se qualcuno ha già detto «non è
  un alimento», l'automatismo non glielo riapre — un automatismo che disfa una decisione presa a
  mano ricompare all'infinito e nessuno capisce perché); non riscrive `times`; non nasconde il tetto
  (300 scritte, 200 mostrate, e tutti e due i numeri si dicono). ⚠️ **E l'elenco cala**: un nome che
  nessuna ricetta usa più torna a zero da solo — un elenco che cresce e non cala racconta un lavoro
  che non finisce mai, e chi lo guarda smette di guardarlo.

- `[Sviluppo]` ⏭️ **Le due strade che allungavano una data senza dirlo a nessuno — due domande a
  Simone, due risposte diverse, di proposito.**
  ✅ **La pausa: la coda scorre con il piano allungato.** `freezeSubscription` sommava i giorni di
  pausa alla fine del piano in corso e non guardava se dietro c'era una coda già pagata: quella
  restava dov'era e cominciava **dentro** il piano appena allungato. ⛔ E quei giorni la cliente li
  perdeva **due volte** — l'erogazione ne sceglie uno solo, e i giorni dell'altro scorrono senza che
  riceva niente. Glieli davamo con una mano e gliene toglievamo altrettanti con l'altra, e il conto
  non lo faceva vedere nessuno. ⚠️ **La pausa non si tocca**, è una promessa già fatta a voce: si
  sposta la coda, che è anche lei sua. Inizio **e** fine (solo l'inizio le accorcerebbe il piano),
  **tutta la fila** (spostandone una sola finirebbe addosso alla seconda), e ⚠️ **non** le righe che
  cominciano prima della vecchia fine: quelle si sovrappongono già, e una sovrapposizione che esiste
  oggi l'ha autorizzata **una persona**. Allungamento e spostamento in **una transazione sola**.
  ✅ **Il rinnovo Stripe: si scrive, non si sposta niente.** La scadenza nuova si scrive sempre — un
  rinnovo è un soldo incassato — ma se passa sopra una coda già pagata la cosa finisce nei log e in
  audit (`commerce.renewal.over_queue`). ⚠️ **E qui la coda NON si sposta, al contrario della
  pausa**: una pausa è un evento singolo, un abbonamento ricorrente si rinnova **ogni mese** —
  spostare la coda a ogni rinnovo la spingerebbe in avanti per sempre, e un percorso pagato non
  partirebbe mai, senza che nessuno se ne accorga perché ogni singolo spostamento è piccolo e
  sensato. ⚠️ Il controllo sta in un try/catch che non ferma il rinnovo: fallire lì vorrebbe dire
  non scrivere la scadenza a una cliente che ha pagato, per non essere riusciti a scrivere una riga
  di diario.
  ⚠️ **Due finti allargati insieme al codice**: al finto della pausa mancava `$transaction` (messo
  come `Promise.all`, non `mockResolvedValue([])` — un finto che risponde senza eseguire farebbe
  passare il test anche se le scritture non partissero) e al finto del rinnovo mancava
  `subscription.findMany`, senza il quale il `try` avrebbe inghiottito un `TypeError` e **il
  controllo nuovo non sarebbe stato provato da nessuno**. È la quarta volta oggi.

- `[Sviluppo]` 🔒 **Il vincolo in banca dati sui piani sovrapposti NON si mette — e al suo posto il
  cron notturno ha smesso di crearli.** La voce chiedeva un vincolo che vietasse due piani che
  erogano insieme. ⚠️ Prima di scriverlo ho chiesto a Simone: la matita della data d'inizio oggi
  permette di sovrapporli **apposta**, con un avviso e una conferma («conferma e non divieto: un
  divieto secco si aggira cambiando la riga a mano nel database»). Risposta: **«la teniamo»**. ⛔
  Allora il vincolo non si può mettere — trasformerebbe quella conferma in un errore secco. E
  indagando è emerso di peggio: farebbe fallire anche **il cron che fa partire le code** (un piano
  pagato che non parte) e **la concessione di una pausa** (un'operatrice che non riesce a dare una
  pausa promessa). *Un vincolo che rompe la cassa e il cron non protegge: sposta il danno addosso a
  chi non c'entra.*
  ✅ **Quindi si è fatto quello che il vincolo doveva ottenere, dove serviva davvero.**
  `promuoviCodeArrivate` guardava `id`, `status` e `startDate` — **non le altre righe della
  cliente**. Bastava che il piano precedente si fosse allungato dopo che la coda era stata messa in
  fila (una pausa concessa, un rinnovo Stripe) e la promozione della notte scriveva **due piani
  attivi insieme**: il caso Lorena, firmato da un automatismo invece che da una persona. ⛔ E la
  cliente ci perde davvero — `attivoInCorso` ne sceglie uno solo, e **i giorni dell'altro scorrono
  senza che riceva niente**. Ora quella coda non si promuove: resta `queued` (i menu continuano ad
  arrivarle dal piano in corso), si grida nei log e si vede in `npm run diag:coda`, che ha una
  sezione nuova. È la stessa forma già usata per le code arrivate a scadenza senza mai partire.
  ⚠️ **Toccarsi non è sovrapporsi, e senza quel test avrei spento ogni rinnovo**: la coda che
  `finalizeApproval` costruisce parte *esattamente* il giorno in cui finisce il piano prima — è il
  passaggio di testimone normale, ed è il caso più frequente di tutti. Un controllo scritto un
  filo più largo avrebbe bloccato la promozione notturna per tutte, in silenzio.
  ⚠️ E la regola di sovrapposizione è **quella della matita**, importata: due funzioni che
  rispondono alla stessa domanda divergono, e il giorno che divergono l'avviso in scheda e il cron
  raccontano due storie diverse sulla stessa cliente.
  ⚠️ **Il finto del test è stato allargato insieme al codice** — il metodo fa tre letture e non più
  due — e un fixture che modellava uno stato impossibile (due code della stessa cliente con le
  stesse date) è stato corretto: si sovrappongono davvero, ed era il test di un'altra cosa.
  ⛔ **Restano due strade che allungano al buio, e sono due domande per Simone**: la **pausa**
  (`pause.service` somma i giorni alla fine del piano in corso senza guardare se dietro c'è una coda
  già pagata — è ciò che nel caso Lorena ha portato il piano #2 al 01/09) e il **rinnovo Stripe**
  (`handleInvoicePaid` riscrive `endDate` incondizionatamente e scavalca la coda). Nessuna delle due
  oggi fa danno, e da stasera il cron non le trasforma più in due piani attivi.

- `[Sviluppo]` ✅ **La ricerca degli alimenti va a PAROLE INTERE — scelta di Simone, dopo la
  misura.** `npm run diag:ricerca` in produzione: **40 trappole, e tutte e 40 possono scattare**,
  perché in nessun caso la parola lunga è in tabella. «melanzane/melanzana»→**mela** (1025 usi),
  «denocciolate»→**nocciola** (385: le olive denocciolate contate a 628 kcal), «melagrana»→**grana**
  (il melograno che diventa il parmigiano), «cipollotto»→**pollo**, «pescatrice»→**pesca** (la coda
  di rospo che diventa una pesca), «surgelato»→**gelato**, «datterini»→**datteri** (18 kcal contro
  280), «fagiolini»→**fagioli** (31 contro 300). ⚠️ E quelle **giuste** erano tre in tutto:
  «pomodorini», «pomodorino» e «spinacino». **~1700 usi sbagliati contro 231 giusti.**
  ⚠️ Sulle domande vere, invece, il cambio non toglieva e non aggiungeva niente: in tutta la storia
  della chat ci sono **210 messaggi di clienti e una sola domanda nutrizionale**. Cioè la trappola
  era **carica ma non ancora scattata** — e si chiude adesso che costa zero, non il giorno che
  scatta su una cliente.
  ✅ **Perdere i tre casi buoni non è un danno**: quando Gaia non trova «pomodorini» dice «non ce
  l'ho» e il termine finisce fra i mancanti, che è *il modo in cui la tabella cresce guidata dalle
  domande vere*. Un «non lo so» si vede e diventa una riga; «44 kcal» detto dalla mela non si vede.
  ⚠️ **Il test che diceva il contrario è diventato rosso, ed è giusto così.** L'avevo scritto ieri
  fotografando il difetto — «oggi "le melanzane" trovano la MELA» — con accanto che il giorno della
  scelta sarebbe diventato rosso. È cambiato **insieme** al comportamento, nello stesso commit: un
  test aggiornato dopo, di nascosto, non avrebbe raccontato niente a nessuno.
  ⚠️ **I due modi restano tutti e due nel codice**: `diag:ricerca` continua a confrontarli, e il
  giorno che la tabella si riempie la stessa misura dirà se il pezzo di parola è tornato a valere
  qualcosa. Un modo tolto è una misura che non si può più rifare.
  ✅ **E la misura ha prodotto per caso la lista della spesa della tabella alimenti**: cercava le
  trappole e ha scoperto che i nomi che le fanno scattare sono tutti nomi **che in tabella non ci
  sono** — melanzane, olive denocciolate, melagrana, cipollotto, piselli sgranati, coda di
  pescatrice, datterini, fagiolini. Alimenti veri e comuni, non casi limite. È la lista 3b, in
  ordine di urgenza, e adesso sta scritta nella voce dei nomi liberi degli ingredienti.

- `[Sviluppo]` 📏 **La misura del «pezzo di parola»: `npm run diag:ricerca`.** Ieri sera avevo messo
  in elenco che la ricerca degli alimenti si incastra dove non deve — «melanzane» contiene «mela»,
  «risotto» contiene «riso» — e avevo scritto «quello lo misuro io, ma la scelta è di Simone».
  Questa è la misura, e **non** la correzione: `MODO_DI_OGGI` resta com'è.
  ⛔ **E la ragione che avevo scritto era falsa.** Avevo detto che non correggevo perché «a parole
  intere si perdono i plurali»: «le melanzane» non troverebbe più la riga «melanzana». Basta
  scriverlo per vederlo — **«melanzana» non è dentro «melanzane»**, finiscono diverse; né «mela»
  dentro «mele», né «carota» dentro «carote». Quei casi oggi non funzionano comunque. ⚠️ *Una
  ragione falsa fa scegliere per il motivo sbagliato, ed è peggio di una scelta sbagliata: la
  seconda si corregge, la prima si tramanda.* Corretta nel codice, nei test e nella voce.
  ✅ **La ragione vera è migliore**: lo stesso meccanismo che sbaglia è quello che salva —
  «pomodorini» trova «pomodori» esattamente come «melanzane» trova «mela», e da fuori non si
  distinguono. Quindi la diagnostica ripassa i messaggi veri delle clienti attraverso il codice di
  produzione **due volte** (com'è oggi e a parole intere) e mette in fila ogni riga che cambia,
  scritta come coppia «`mela` ⊂ `melanzane`». ⚠️ **E non dice quale sia giusta**: quella differenza
  la vede una persona in un secondo, mentre un programma che provasse a deciderla da solo
  sbaglierebbe in silenzio proprio sui casi nuovi. Chiamare «costo» tutta la colonna sarebbe la
  bugia comoda.
  ⚠️ **Il modo di cercare è un parametro del codice vero**, non una regola riscritta dentro lo
  script: una misura che si riscrive la regola misura la propria copia. E c'è un test che tiene in
  piedi proprio questo — se il parametro non arrivasse fin dentro il confronto, la diagnostica
  misurerebbe due volte la stessa cosa e direbbe «non cambia niente», che è la più tranquillizzante
  delle risposte sbagliate. Provato con una mutazione: morde.
  ⚠️ **Non stampa il testo dei messaggi**: escono i nomi degli alimenti e la singola parola che li
  conteneva, mai la frase.
  Trovata strada facendo: **`ValoriNutrizionaliService.cerca` non la chiama più nessuno** — la
  strada vera di ogni risposta di Gaia sui numeri è `cercaTutti`, da `schedaPerRisposta`. Ieri sera
  avevo indicato la funzione sbagliata come «quella che sbaglia»; la voce adesso lo dice.

- `[Sviluppo]` 🔍 **Prima di consegnare ho fatto girare due revisori avversariali sul lavoro di
  oggi, e hanno trovato 15 difetti.** ⚠️ La ragione per cui l'ho fatto è che oggi la produzione ne
  ha trovati due miei **entro l'ora dalla consegna**: la quinoa bocciata perché in tabella lo stato
  è «cruda» e non «crudo», e «semi di zucca» contato come zucca in 531 ricette — venti volte le
  calorie. Consegnare e aspettare che se ne accorga Simone non è un metodo. **Tre dei quindici
  scrivevano dati sbagliati e uno apriva un buco di permessi**, quindi non ho consegnato: ho
  corretto, e questa voce è quella consegna.
  ⛔ **Il buco di permessi**: la lista della mattina mostra il lavoro del nutrizionista che chiede,
  e se la lettura del suo perimetro tirava un errore il codice **proseguiva mostrando la lista di
  tutti** — cioè clienti di altri nutrizionisti, che sono dati sanitari. ⚠️ *Un errore non è un
  permesso*: adesso se il perimetro non si sa, la lista non si mostra.
  ⛔ **La convenzione del crudo si aggirava con un aggettivo**: «lenticchie» era bloccata come deve
  (in tabella sono bollite, la ricetta intende le secche), ma «lenticchie **bio**» prendeva l'altra
  strada — l'abbinamento per nome — e lì la convenzione non ci passava: **93 kcal invece di 282**.
  ⚠️ *Due strade per la stessa domanda, e una delle due non conosceva la regola*: adesso la porta è
  una sola.
  ⛔ **«Pasta fresca» prendeva la riga della pasta secca** (290 contro 350). «Fresco» era fra i
  qualificatori innocui, e sugli spinaci lo è davvero — «spinaci freschi» sono «spinaci», 1350
  ricette. Sulla pasta no. ⚠️ *La differenza non sta nella parola, sta nello stato della riga*: una
  parola di stato adesso si accetta solo se **combacia**. Con «fresco» sono usciti «grattugiato»
  (il pangrattato non è pane) e «intero» (che sceglieva da solo fra latte intero e scremato).
  ⛔ **Il peggiore degli altri: la lista si rinumerava in silenzio.** Depennata la 2, la vecchia 3
  diventava 2 — e un «faccio la 2» scritto guardando la lista di prima agiva **sul cliente
  sbagliato**, senza che nessuno se ne accorgesse perché l'azione riusciva. Adesso dopo ogni
  depennamento la lista si ristampa numerata da capo, davanti agli occhi.
  Gli altri undici, in breve: «annulla» che diventava il nome di un alimento; la chiave «mostra
  famiglia» che collideva; passi senza uscita; una domanda «la tolgo dalla lista?» a cui non
  seguiva l'azione; due liste diverse nello stesso conto dei macro; chiamate al motore senza
  try/catch; il plurale su un alimento solo; una riga contata anche quando la convenzione non
  permetteva di contarla; un nome di persona letto come alimento; il numero della voce letto anche
  senza lista aperta.

- `[Sviluppo]` ⚠️ **E una correzione che avevo scritto io non era tenuta ferma da nessun test — e
  l'ho scoperto solo perché ho provato a romperla apposta.** Corretta la «pasta fresca», i test
  erano verdi e sembrava fatta. Poi ho mutato la riga della correzione — far accettare qualunque
  parola di stato senza guardare la riga — e sono rimasti verdi **tutti e 786**. ⛔ *La correzione
  c'era e niente la teneva*: al primo che riscrive quella riga tornava «pasta fresca» = pasta
  secca, senza un rosso. Il caso che mancava era **il rifiuto**: «spinaci freschi» **sì** da solo
  passa anche con la regola sbagliata, perché entrambe le versioni lo accettano — serviva «pasta
  fresca» **no**. ⚠️ È la seconda volta oggi che una mutazione trova un test che non copre quello
  che credevo (la prima era «due righe pari = non lo so»), e la lezione è la stessa: **verde non
  vuol dire coperto**. Nella stessa riga c'era anche un pezzo di controllo che non poteva scattare
  mai — la mutazione dopo l'ha mostrato — ed è stato tolto: un controllo che non scatta mai fa
  credere che stia proteggendo qualcosa.

- `[Sviluppo]` 📋 **In elenco lavori, priorità bassa, una cosa che decide Simone: la ricerca degli
  alimenti va per pezzo di parola.** Trovata dalla stessa revisione, ⚠️ **non è un difetto nuovo** —
  è come la ricerca ha sempre funzionato: per rispondere a «quante calorie ha X?» si cerca il nome
  della tabella *dentro* la domanda, e i pezzi di testo si incastrano dove non dovrebbero
  («melanzane» contiene «mela», «risotto» contiene «riso»). ⛔ Gaia risponde con le calorie
  dell'alimento sbagliato, e il numero è **plausibile**. ⚠️ Non l'ho corretta di mia iniziativa
  perché la correzione ovvia — cercare solo parole intere — **cambia come Gaia risponde a ogni
  domanda**, non solo a quelle sbagliate: è una decisione, non una pulizia.

- `[Sviluppo]` 📋 **«Cosa devo fare oggi?» adesso è una lista numerata, non un conteggio** (richiesta
  di Simone). Dal 14/8 il **quadro** della giornata leggeva le tabelle vere, ⚠️ ma erano **conteggi**:
  «3 segnalazioni, 2 proposte» dice *quanto* lavoro c'è, non *quale* — non si può dire «faccio la 3»,
  non si vede chi aspetta, non si depenna. ⚠️ E la coda **«Da validare»** nel quadro **non c'era
  affatto**: viveva solo nel riquadro della home, e un elenco che dice «tutte le cose da fare»
  saltandone una categoria insegna a non fidarsi del resto.
  ⚠️ **È una decisione già presa che cambia, e va detto**: due test fissavano «cosa devo fare oggi?»
  sul quadro. Ora porta la lista — ma la lista **non dice meno**: catalogo e campanella, che non si
  numerano, restano in fondo come righe. Un miglioramento che perde pezzi non è un miglioramento.
  Tre cose si **dicono** invece di tacerle: il **taglio** oltre le dieci voci per fonte (un elenco
  troncato in silenzio si legge come «è tutto qui»), la **fonte rotta** («non lo so» ≠ «nessuno»,
  ogni fonte nel suo `try`), e il **nome di chi aspetta** su ogni riga. ⚠️ Le azioni della coda non si
  riscrivono qui: si **importano** da `engine/causa-decisione.ts`, o fra un mese la coda e la chat
  offrirebbero due cose diverse sulla stessa riga. ⛔ Resta: aprire una voce dicendo «la 3».
  239 suite / **3769 test verdi**, tre mutazioni provate e tutte e tre fanno fallire i test.


- `[Sviluppo]` 🔁 **«Aggiungi un'equivalenza»: Vera la sa fare** — dallo screenshot in cui rispondeva
  **due volte** «non ci arrivo nemmeno adesso» a una frase chiarissima, e per giunta rimandava «alla
  scheda della cliente», che con un gruppo di equivalenza non c'entra. ⚠️ **Non è la lista del
  dizionario**: quella dà un nome a un insieme e serve ai divieti, questo dice al motore quali
  alimenti può **scambiare nel piatto** — è una regola che cambia cosa mangia la gente. Tre passi
  come per le ricette: ⚠️ **il nome non si inventa** e la conferma si chiede; l'anteprima dice che il
  motore li scambierà e che nasce come **proposta** (`draft`, e avvisa i capi). ⚠️ Due alimenti o non
  è un'equivalenza, e quelli detti al secondo giro si **uniscono** ai primi.
  ⚠️ **E una ragione falsa, tolta**: avevo scritto che la causa era `daScartare`. Non è vero —
  provata, lascia passare la frase: nessun caso la prendeva, e basta. L'ha mostrato una mutazione che
  spostava la riga senza far fallire niente. Una ragione falsa è peggio di un ordine sbagliato,
  perché sembra aver già risolto il problema: è la lezione della mattina sul cron, e vale anche
  quando la scrivo io.

- `[Sviluppo]` 🧂 **`npm run importa:alimenti` — le 32 righe compilate dalla nutrizionista** sul
  foglio che Simone le ha fatto riempire (i buchi trovati da `diag:crudo-cotto`). ⚠️ **Il punto
  difficile: `NutrientFact.name` è unico**, e metà delle righe a crudo — carote, spinaci, zucca,
  patate, ceci, lenticchie, broccoli, polenta — **esiste già con quel nome** come bollita. La riga
  vecchia si **rinomina** col suo stato («carote» → «carote bollite») e il nome nudo va alla riga a
  crudo, perché è quello che scrivono le ricette. ⚠️ Il nome vecchio diventa un **sinonimo**, e le due
  righe con lo stesso sinonimo sono esattamente ciò che serve a `scegliPerStato`: da lì in avanti, a
  una domanda che non dice crudo o cotto, Gaia risponde «dipende» invece di dare un numero — prima
  non poteva, la riga era una sola. ⚠️ Non tocca i valori di una riga già a crudo (dati verificati) e
  la prova a vuoto è obbligatoria. ⚠️ I dati in un **modulo TS** e non in un JSON accanto: un file che
  in `dist/` non c'è fa fallire lo script il giorno che serve.
  239 suite / **3762 test verdi**.


- `[Sviluppo]` 🎃 **«Semi di zucca» non è la zucca.** Primo giro in produzione dell'abbinamento, e la
  lista proposta conteneva **«semi di zucca» → «zucca»** (531 ricette, ~550 kcal contro 26: **venti
  volte**), **«olio di cocco»** e **«olio di sesamo» → olio d'oliva** (682 ricette), **«lenticchie
  rosse secche» → «lenticchie»** che in tabella sono bollite. ⚠️ La causa è precisa: la regola diceva
  «tutte le parole della riga compaiono nel nome dell'ingrediente», e su una riga che si chiama
  **«zucca»** — o con un **sinonimo corto** come «olio» — ci casca dentro qualunque cosa. **Le parole
  in più non sono sempre aggettivi**: «semi di», «olio di», «farina di» fanno **un altro alimento**.
  ⚠️ La correzione rovescia l'elenco: non «tutto quello che non conosco è innocuo» ma **solo quello
  che conosco come innocuo** — un elenco chiuso di qualificatori (freschi, sgusciate, pelate, intere,
  bio…). Un elenco chiuso si legge e si discute, «tutto il resto» no. ⚠️ E dentro **non c'è nessuna
  parola di cottura o conservazione**: quelle cambiano i numeri e la loro casa è `scegliPerRicetta`
  — c'è una mutazione che lo prova.
  ⚠️ **E va scritto cosa ho sbagliato io**: la consegna prima diceva «prima si misura, poi si
  accende», e poi ho acceso sulla parola «lista confermata» **senza aver visto la lista**. Il giro in
  produzione l'aveva prodotta, e conteneva cinque accoppiamenti sbagliati su venti righe: bastava
  leggerla. La regola resta quella, e stavolta si aspetta la lettura.
  238 suite / **3743 test verdi**, due mutazioni provate e tutte e due fanno fallire i test.


- `[Sviluppo]` 🔗 **L'abbinamento dei nomi è acceso** (lista degli accoppiamenti confermata da Simone
  e dalla nutrizionista). ⚠️ **Due strade diverse, e tenerle separate è il punto**:
  `cercaPerIngrediente` — nuova, per il calcolo dei macro quando si detta una ricetta — riceve un
  **nome** e applica la regola «la ricetta è più specifica della tabella» (1350 ricette scrivono
  «spinaci freschi» dove c'è «spinaci», e prima si fermavano); `cercaTutti`, quella delle **domande**
  di Gaia, accende **solo** la parte delle paroline, perché su una frase lunga la regola «più
  specifica» si abbinerebbe a caso — ⚠️ e togliere le paroline da tutt'e due i lati non è una ricerca
  più larga, è la stessa ricerca su una scrittura normalizzata. ⚠️ C'è il test che tiene fermo il
  confine: **«riso» non diventa «riso integrale»**, la ricetta si ferma e lo dice.
  ⚠️ **E il doppio di prova che non si comportava come l'originale**: aggiungendo il metodo nuovo
  sono diventati rossi quattro test che col codice non c'entravano — il doppio della tabella aveva
  solo `cerca` e sul metodo nuovo rispondeva `undefined`. Stessa lezione della mattina su
  `audit.log`: ora il doppio usa lo **stesso** `abbina` del servizio vero.
  ⛔ Restano fuori di proposito «olio extravergine» da solo (2771 ricette: si chiude con **un
  sinonimo** scritto da una persona) e la lista 3b — sale, pepe, aglio, brodo — da aggiungere a mano.
  238 suite / **3738 test verdi**, due mutazioni provate e tutte e due fanno fallire i test.


- `[Sviluppo]` 🔤 **I nomi liberi degli ingredienti: le regole per abbinarli, e la misura prima di
  accenderle.** 7831 nomi usati nelle ricette non si trovano in tabella, ma non è un elenco da
  riempire: «olio extravergine d oliva» è «olio extravergine **di** oliva», «spinaci freschi» sono
  «spinaci». ⚠️ **E il danno è più piccolo di quello che avevo scritto**: le ricette generate portano
  le calorie dell'**AI**, non sommate dalla tabella — la somma la fa solo Vera quando la
  nutrizionista detta, e lì si dichiara e blocca. Il danno vero è che **Gaia dice «non ce l'ho» su
  alimenti che ci sono**. Due regole: le **paroline non contano**, e la **ricetta più specifica**
  prende la riga più generica. ⚠️ **La terza regola che avevo proposto — «manca solo una parolina» —
  il test l'ha bocciata prima che finisse in produzione**: se al nome manca una parola della tabella,
  quella parola **distingue** («olio extravergine» senza «oliva» può essere di girasole). Quei casi
  si chiudono con **un sinonimo scritto da una persona**: 2771 ricette, una riga. ⚠️ E davanti a due
  righe pari non si sceglie — la riga che lo garantisce **non era coperta**, l'ha scoperto una
  mutazione: il caso che credevo la provasse tornava `null` per un'altra ragione. ⚠️ **Le regole non
  sono attive**: per ora la diagnostica dice a quale riga ogni nome *si abbinerebbe*, così la si
  controlla con la nutrizionista prima di accenderla. Il «fuori tabella» si spacca in «si
  abbinerebbero» e «da aggiungere a mano», che sono due lavori diversi.
  237 suite / **3736 test verdi**. Nessuna migrazione, e in produzione non cambia niente: si guarda.


- `[Sviluppo]` 🥛 **«Il latte è sempre liquido»** — correzione di Simone sulla consegna di un'ora
  prima. ⚠️ **Se ogni latte è liquido, «liquido» non può essere un avviso**: è come scrivere «solido»
  sul pane, e uno stato che non distingue niente non può mettere in dubbio un numero. Avevo trattato
  `liquido` come «non lo so», e i quattro latti — oltre settecento ricette — finivano in un elenco di
  cose da guardare in cui non c'era niente da guardare. Lo stesso per `fresco` (ricotta, yogurt) e
  `viscoso` (sciroppo): dicono **com'è il prodotto che si compra e si pesa**, e fra la confezione e
  la bilancia non c'è nessuna cottura. `caldo` e `tiepido` sono invece cotti, che è il caso
  simmetrico. ⚠️ **Ma `tostato` non sta con gli altri**: tostare cambia peso e calorie — mandorle
  crude e tostate non sono la stessa cosa — e resta «non lo so», perché indovinare su una frutta
  secca da 600 kcal/100 g per far sparire una riga da un elenco non si fa. ⚠️ E c'era un errore anche
  nel racconto: avevo messo `viscoso` e `tostato` sotto «il latte», mentre erano lo sciroppo e gli
  anacardi — un elenco che unisce quattro cose per comodità di frase nasconde proprio la differenza
  che conta. 237 suite / **3724 test verdi**, tre mutazioni provate e tutte e tre fanno fallire i test.


- `[Sviluppo]` 🥣 **La quinoa bocciata perché il dato era giusto.** Primo giro in produzione di
  `diag:crudo-cotto`, un'ora dopo la consegna: due difetti miei, tutti e due nella prima schermata.
  ⚠️ **1)** In tabella lo stato è scritto al femminile e al plurale (`cruda`, `crude`, `bollite`) e
  il confronto andava con `['crudo','secco']`: **quinoa**, **patata dolce**, **patate** e **pasta
  integrale** (che ha *cruda, bollito*) finivano fra quelle da bloccare. Non era la diagnostica: era
  `scegliPerRicetta`, cioè il codice che decide se una ricetta dettata a Vera si può scrivere —
  avrebbe **rifiutato una ricetta con la quinoa proprio perché il dato era giusto**, che è il modo
  peggiore di sbagliare perché punisce chi ha fatto bene il lavoro. Ora si normalizza sulla radice.
  ⚠️ **2)** `liquido` (i latti), `fresco` (ricotta, yogurt), `viscoso` (sciroppo), `tostato`
  (anacardi) **non sono stati di cottura**, ed erano finiti fra i «solo da cotto»: il latte scremato,
  usato in 260 ricette, sarebbe stato bloccato. Per il latte quella domanda non esiste — diventano
  «non lo so», si contano e si dichiarano. ⚠️ **3)** E la classificazione era **ricopiata a mano**
  nella diagnostica: due punti sulla stessa domanda, e quello sbagliato era la copia. Ora chiama la
  funzione vera.
  ⛔ E il numero che dice più di tutti: **7831 ingredienti fuori tabella**, ma sono aromi (aglio
  3888, sale 3296, limone 3146) e **varianti dello stesso nome** — «olio extravergine», «olio
  extravergine d oliva», «olio extravergine oliva». Le ricette generate usano **nomi liberi**, e
  nessuna tabella li coprirà: voce `ingredienti-nomi-liberi`, con le tre strade.
  237 suite / **3722 test verdi**, due mutazioni provate e tutte e due fanno fallire i test.


- `[Sviluppo]` 🍚 **Le grammature delle ricette sono a crudo, e adesso il codice lo rispetta.**
  Convenzione di Simone, dalle domande sul grano saraceno: «come si fa nei libri». È la scelta giusta
  perché è **una sola** — le alternative erano un campo da riempire su diciannovemila ricette o
  dedurlo dai passi, cioè una regola per piatto. ⚠️ **Ma non la rispettavamo**: la tabella ha 37
  righe su 96 **solo da cotto**, e sono le più pesanti del piatto (pasta, riso, quinoa, legumi,
  patate). Contare «80 g di quinoa» con la riga bollita scriveva **96 kcal dove ce ne sono ~284** —
  tre volte meno, dentro `Recipe.kcal`, il campo su cui il motore calcola le giornate. Nessun errore,
  nessuna riga rossa. Ora `scegliPerRicetta` prende la riga a crudo o a secco; ⚠️ con **solo il
  cotto** non conta e lo dice, e la ricetta dettata a Vera **non si scrive** (stessa regola dei
  mancanti: l'unico modo di riempire `kcal` sarebbe indovinare); ⚠️ **senza stato** si conta e si
  **dichiara**, perché «senza stato» non è «cotto» ma «non lo so» e rifiutarle bloccherebbe quasi
  ogni ricetta. ⚠️ Diversa da `scegliPerStato`, che risponde a una **domanda**: lì se lo stato non è
  detto la risposta onesta è «dipende», qui lo dice la convenzione e la risposta onesta è «questo
  numero non lo so». E lo si **dice** da tutte e due le parti: nell'app sotto gli ingredienti (sempre,
  perché non è un avviso ma l'unità di misura) e nel form del backoffice a chi le scrive.
  `diag:crudo-cotto` cambia domanda di conseguenza e usa la **stessa** funzione del calcolo.
  237 suite / **3717 test verdi**, app 106, backoffice 31, tre mutazioni provate e tutte e tre fanno
  fallire i test. Nessuna migrazione.


- `[Sviluppo]` 🌾 **Le domande sul grano saraceno: `npm run diag:crudo-cotto`.** Segnalazione della
  nutrizionista. Crudo ~343 kcal, cotto ~92: ⚠️ quasi **quattro volte**, e chi pesa dalla parte
  sbagliata non ha un'imprecisione, ha un altro pasto (stesso guasto del farro, voce 228). Dal 18/8
  `stato-alimento.ts` fa la cosa giusta quando l'alimento è in tabella **due volte** con stati
  diversi: non sceglie e lo dichiara. ⚠️ **Ma con una riga sola non c'è nessuna ambiguità da
  dichiarare** e Gaia dice il numero: se quella riga è il crudo e lei pesa il cotto, il numero è
  giusto in tabella e sbagliato nel piatto — nessun errore, nessuna riga rossa. La diagnostica dice
  quali alimenti sono **senza stato e usati nelle ricette**, quali sono **fuori tabella**, e quanti
  sono già a posto, ordinati per **quante ricette attive li usano** (priorità oggettiva, non un
  giudizio clinico). ⚠️ Conta le ricette **attive** — una bozza non è nel piatto di nessuno — e lo
  stesso ingrediente ripetuto in una ricetta vale **una volta**. ⚠️ Non indovina nessuno stato:
  metterlo vorrebbe dire far dire a Gaia un numero deciso da chi non è nutrizionista. ⛔ E il buco
  vero è a monte: **la scheda ricetta non dice da che parte pesare** — voce
  `scheda-ricetta-crudo-o-cotto`, con le tre strade possibili e nessuna gratis.


- `[Sviluppo]` 🧭 **`diag:allergeni`, il secondo modo di guardare.** Il primo giro in produzione ha
  dato una risposta che è una risposta: le ricette confermate **a mano** sono **tre**, d'accordo 3 su
  3. ⚠️ Centopercento su tre righe non vuol dire niente — ma il numero è informativo: da quella
  pagina non c'era mai passato nessuno, ed è coerente con il difetto scoperto un'ora prima (chiedeva
  solo le ricette attive mentre quelle da rivedere sono bozze, e «Rivedi» rispondeva 404 su una
  bozza). Le tre conferme sono tutto quello che è passato da un cancello chiuso.
  Serviva quindi un modo di guardare che **non aspettasse nessuno**: ⚠️ il **titolo** della ricetta
  passa dallo stesso riconoscitore, e se nomina un allergene che negli allergeni scritti non c'è,
  quella riga va guardata. L'esempio è vero, da una schermata di oggi: «Acciughe fresche al pomodoro
  su **crostini integrali** e rucola» — crostini e integrali sono glutine, e se l'elenco ingredienti
  dice «base croccante» il riconoscitore non lo prende. ⚠️ Un sospetto **non è un errore** e non si
  corregge niente in automatico: un titolo non è un elenco di ingredienti, e scrivere un allergene
  per una parola nel nome metterebbe «pesce» su «insalata di mare finta». Serve una persona, ma su
  poche righe invece che su diciannovemila. ⚠️ Le ricette senza ingredienti si saltano e si contano
  a parte. Sola lettura, nessuna migrazione.


- `[Sviluppo]` 🔗 **«Aggiorna dal rilascio» dice quando il file è indietro rispetto alla pagina.**
  Dalla voce aperta la mattina del 19/8 nel modo peggiore: avevo fatto il punto della situazione
  leggendo `voci-iniziali.ts` invece della pagina, e avevo ripresentato come aperte la tabella IG e
  la conta allergie — già lanciate da Simone. ⚠️ **Il file non è lo stato**: può solo *chiudere* una
  voce, mai riaprirla, quindi quando qualcosa si chiude fuori da una consegna resta indietro **in
  silenzio**. ⚠️ E al contrario: le voci scritte a mano dalla pagina non hanno chiave, nel file non
  esistono, non ricevono la data di nascita né le riscritture — e chi legge il file non sa nemmeno
  che ci sono. Ora il pulsante dice **quali voci il file crede aperte e la pagina ha già chiuso**
  (col titolo, non con la chiave) e **quante vivono solo in pagina**. ⚠️ Non corregge niente, di
  proposito: quale versione vinca è una decisione, e togliere da solo una spunta messa a mano sarebbe
  peggio del problema — c'è un test che tiene ferma questa riga. ⚠️ E una voce che il file dichiara
  finita e la pagina ha spuntato **non è una divergenza**: è il caso normale, elencarla renderebbe
  l'avviso rumore. ⛔ Resta aperta la strada radicale (`npm run allinea:lavori`, il file rigenerato
  dalla pagina): fa vincere la pagina su un file che sta nel repository e si legge nei commit, e non
  si fa finché il segnale non si dimostra insufficiente — da oggi si può misurare invece di supporre.
  236 suite / **3696 test verdi**, backoffice 31, tre mutazioni provate e tutte e tre fanno fallire
  i test. Nessuna migrazione.


- `[Sviluppo]` 🗓️ **La giornata di oggi si rifà, e «quanto manca» nell'app è uno solo.** Due risposte
  di Simone, e in tutte e due il lavoro era togliere una risposta di troppo. **1)** «Quali giorni si
  possono rifare» era scritto in **tre posti**, e ⚠️ in uno dei tre il confine partiva da **domani**
  invece che da oggi: su una cliente che non aveva ancora aperto il menu di oggi, toglierle lo
  spuntino non glielo toglieva oggi ma vietarle un alimento sì — due comportamenti diversi, nessuno
  dei due scritto come scelta. Simone: «meglio rifare la giornata di oggi». Ora la risposta è una
  (`siPuoRifare`) e il confine sta in un posto solo. ⚠️ Ed è la **mezzanotte** di oggi, non «adesso»:
  `MenuDay.date` è una data senza ora, e confrontarla con l'istante corrente fa sparire la giornata
  di oggi appena passa mezzanotte, cioè sempre. ⚠️ La regola vera resta: un giorno **già aperto** non
  si rifà mai — decide `viewedAt`, non il calendario.
  **2)** `plan-report.service` **non alimenta il PDF firmato**: alimenta la **schermata Report dentro
  l'app**, quella di fine piano. Scriveva «−4,2 kg da oggi» sull'ultima pesata mentre la pagina
  Obiettivo della stessa app ne diceva un altro sulla media mobile. Simone ha scelto la tendenza, e
  ⚠️ cambia anche la decisione sotto — `objectiveReached` sceglie se offrire il Mantenimento, ed è la
  stessa domanda di `commerce.hasReachedObjective`, passata alla media mobile lo stesso giorno.
  ⚠️ La stima «quando arrivi» parte dallo stesso peso: due numeri accanto calcolati da due pesi
  diversi si contraddicono. ⚠️ Restano **misurati** i confronti A→B del periodo e i traguardi: la
  storia di una persona non si ridisegna con una media.
  236 suite / **3692 test verdi**, app 106, backoffice 31, tre mutazioni provate e tutte e tre fanno
  fallire i test. Nessuna migrazione.


- `[Sviluppo]` 🔬 **`npm run diag:allergeni` — quanto è buono il riconoscitore, con un numero invece
  che con un'impressione.** Dalla voce aperta con la conferma in blocco: da oggi migliaia di ricette
  entrano in catalogo con gli allergeni dedotti dagli ingredienti, e ⚠️ davanti al piatto di una
  cliente allergica c'è un elenco di parole chiave invece di una persona. Il metro sono le ricette
  che **una persona ha confermato a mano**, riconosciute dal registro (`...allergens.set`);
  ⚠️ le conferme in blocco (`...allergens.bulk`) **non fanno testo**, perché lì gli allergeni li ha
  scritti il riconoscitore e confrontarcisi vuol dire misurarlo con se stesso — è la ragione per cui
  il blocco scrive un'azione diversa. Due errori tenuti distinti: ⚠️ **mancato** (la persona vede un
  allergene che la macchina non vede: la ricetta entra dichiarata sicura per chi è allergica) e
  **inventato** (menu più povero, non salute). Divisi **per allergene**, perché «sbaglia il 4%» e
  «sbaglia il 4%, tutto sul glutine» sono due situazioni diverse. ⚠️ Senza ricette confermate a mano
  non stampa zeri: dice che manca il metro, perché «non lo so» non è «va tutto bene»; sotto le 30
  avverte che il campione è piccolo; e dichiara il limite vero — le confermate a mano sono le ricette
  **vecchie** dello staff, quelle del blocco sono **generate dall'AI**, quindi un buon voto qui non
  garantisce lo stesso voto là. Sola lettura, nessuna migrazione.


- `[Sviluppo]` 🚧 **Il rilascio a metà**, visto in produzione un'ora dopo la consegna sugli
  allergeni. Vercel pubblica il backoffice in un minuto, Render ci mette di più: in quella finestra
  la pagina Allergeni mandava `daRivedere=true` a un server che non lo conosceva, riceveva tutto il
  catalogo e scriveva «aspettano gli allergeni **19347** ricette». ⚠️ Un numero sbagliato con la
  faccia di un numero giusto — cioè il difetto che quella consegna toglieva, rifatto durante il
  rilascio che lo toglieva — e accanto il pulsante del blocco che rispondeva `Cannot POST`.
  Ora `GET /recipes` **dice se il filtro l'ha applicato** (`filtroDaRivedere`, scritto solo quando è
  stato chiesto: un campo che c'è sempre non distingue niente), e la pagina che non riceve l'eco lo
  dichiara in rosso e **nasconde** il pulsante invece di offrirlo e farlo fallire. ⚠️ È il
  ragionamento della transizione OTA dell'app applicato al backoffice: il pezzo pubblicato per primo
  non finge che l'altro ci sia già. 235 suite / **3683 test verdi**.

- `[Sviluppo]` 🔎 **Tre voci della pagina Lavori erano già fatte** — verificate leggendo il codice,
  non il file: **1)** «Schermate app 30 e 27-28» era **decisa il 13/8**
  (`Decisioni_Simone_20260813.md` §6): i video di coach e nutrizionista erano stati annullati il
  17/07 e nell'app non esiste nessun player né un campo video su `Staff`; l'assaggio del menu è
  superato da «Conosciamoci», e la parola «assaggio» non compare in nessun file del progetto.
  **2)** «Vera: rifare i giorni futuri quando il capo approva un divieto di dieta» è scritta in
  `applica-proposta.ts` + `vera/menu-da-rifare.ts`, tetto dei 200 clienti compreso, col riepilogo che
  dice quanti giorni sono rimasti indietro. **3)** «Moduli fissi in dashboard» è in
  `Impostazioni.tsx`: trascinamento per riordinare, predefiniti col bordo colorato e la pastiglia, e
  «Ripristina default» che chiede conferma con se stesso. ⚠️ Sono voci scritte **a mano dalla
  pagina**, senza chiave: il file non le può spuntare, deve farlo Simone — ed è la stessa divergenza
  file/pagina che oggi mi ha fatto ripresentare la tabella IG come aperta.
  ⚠️ Rileggendo la (2) è saltato fuori un difetto vero: «quali giorni si possono rifare» ha **tre**
  definizioni, e una delle tre **esclude la giornata di oggi** mentre le altre due la includono —
  quindi togliere uno spuntino non tocca il menu di oggi che la cliente non ha ancora aperto, ma
  vietare un alimento sì. Voce `giorni-da-rifare-tre-definizioni`, priorità bassa.


- `[Sviluppo]` ⚖️ **Gaia dice la grammatura del piatto, non quella di catalogo** (coda della voce
  284, chiusa dalla risposta di Simone: «il numero del piatto»). Dal 18/8 le porzioni si scalano sul
  fabbisogno: Gaia diceva «metti 120 g di biete al posto di 100 g di carote» mentre nel piatto ce
  n'erano 216 — e la chat è il posto dove la cliente ha detto «sì» e dove torna a controllare, cioè
  l'unico numero che non poteva usare in cucina. Stessa cosa nella tabella «cambi in chat» del
  backoffice, rimasta l'unica «ufficiale» da quando l'app quel numero non lo mostra più.
  ⚠️ **In banca dati i numeri restano di catalogo**: sono quelli scritti sul menu e il piatto si
  scala al momento di mostrarlo — salvarli già scalati vorrebbe dire scalarli due volte (120 → 216 →
  389), e nessuno se ne accorgerebbe finché una cliente non cucina. Il fattore viaggia accanto e si
  applica solo quando si parla. ⚠️ L'arrotondamento è la **stessa** `quantitaScalata` della scheda
  ricetta e della lista della spesa: «216 g» di là e «215 g» di qua si legge come un errore di
  misura, non come una regola. ⚠️ Sotto il 5% non si scala niente, che è la soglia che decide anche
  la riga «porzione più abbondante». ⚠️ Nel backoffice si dice pure **che il piatto è scalato**, col
  numero di catalogo accanto.
  ⚠️ **E i passi di cottura non si riscrivono**: la scheda diceva «biete» negli ingredienti e
  «carote» nei passi, ma cambiare una parola dentro una frase dà «la porro» e «biete tagliate a
  rondelle» — istruzioni sbagliate, la stessa ragione per cui su «pesce tranne salmone» non
  correggiamo noi. Si dice sopra i passi, e **solo** per gli alimenti nominati davvero lì, cercati
  come parola e non come sottostringa (l'errore che faceva sostituire i peperoni a chi scriveva
  «pepe»). Senza niente da dire la riga non compare: una nota che c'è sempre non è una nota.
  235 suite / **3681 test verdi**, app 106, backoffice 31. Nessuna migrazione.


- `[Sviluppo]` 🧪 **«4612 aspettano gli allergeni» e la pagina era vuota** — segnalazione del
  nutrizionista, girata da Simone. **Tre strati dello stesso difetto, e il primo da solo bastava.**
  ⚠️ **1)** Il generatore crea le ricette come **bozze** (`active: false`) e la pagina Allergeni
  chiedeva `includeInactive=false`: le 4612 non entravano nemmeno nella query. La pagina Ricette
  chiede `true` e infatti conta 19347 — due pagine sullo stesso catalogo con due domande diverse.
  ⚠️ **2)** Il filtro «Da rivedere» girava **in memoria** sulle mille righe già scelte dal tetto in
  ordine alfabetico: è testualmente il difetto che `listRecipes` racconta di aver chiuso l'11/8 per
  la pagina Ricette — «una ricetta che c'è ma non compare è peggio di un errore, perché chi cerca
  conclude che non esiste» — chiuso lì e non qui. ⚠️ **3)** E comunque non si sarebbero potute
  confermare: `getRecipe` risponde **404 su una ricetta non attiva**, giusto per la cliente che apre
  una scheda dall'app, e ci passavano sia i suggerimenti sia il salvataggio — le due cose che
  lavorano *esattamente* sulle bozze.
  **Due decisioni di Simone**: (a) confermare gli allergeni **fa entrare la ricetta in catalogo** —
  prima restava bozza e nessuna schermata diceva quante fossero in quello stato, e un secondo
  cancello senza porta è un magazzino — ⚠️ ma solo la ricetta **mai confermata prima**, perché una
  archiviata a mano lo è di proposito; (b) **conferma in blocco**, perché il generatore scrive ~4600
  ricette a settimana e una per una sono diciannove ore per svuotare un mucchio che nel frattempo si
  è riempito. ⚠️ Il blocco scrive gli allergeni **riconosciuti dagli ingredienti**, ricalcolati
  adesso, mai un elenco vuoto: «di queste mi fido del riconoscitore» non è «queste non hanno
  allergeni». A scaglioni di 500, e se cade a metà si dice quante erano già passate.
  ⚠️ E il numero accanto al collegamento adesso è quello che si trova arrivandoci: diceva quante ne
  aspettano fra le nate in sette giorni, e portava a una pagina che non filtra per data.
  ⛔ **Resta la domanda vera, e non è di software**: da oggi il cancello davanti al piatto di una
  cliente allergica è il **riconoscitore automatico**, non una persona — e quanto sia buono non l'ha
  misurato nessuno. Voce `allergeni-quanto-e-buono-il-riconoscitore`.
  234 suite / **3667 test verdi**, backoffice 31, 15 test nuovi, quattro mutazioni provate e tutte e
  quattro fanno fallire i test. Nessuna migrazione.


- `[Sviluppo]` 🗂️ **La lista lavori dice da quando esiste un punto, e Simone gli può dare la
  priorità.** Nasce da una frase sua: «pensavo di chiudere la lista lavori ma invece che diminuire
  aumentano». **1) Priorità Alta / Neutra / Bassa**, tre pulsanti su ogni riga che salvano al clic —
  se servisse aprire, cambiare e salvare, dopo tre voci si smetterebbe di darla, e una leva che non
  si usa non è una leva. ⚠️ **Non è il rosso**, e le due colonne restano separate di proposito:
  `blocca` è un fatto che chiunque può verificare, la priorità è un giudizio che dà una persona sola
  — con un campo solo non si potrebbe più dire «lo so che ferma la coda, aspetta lo stesso», e in un
  mese sarebbe tutto rosso. ⚠️ Default **neutra** e non bassa: una voce nuova non è meno importante,
  è una voce su cui nessuno si è pronunciato. **2) Da quando esiste il punto**: ⚠️ `createdAt` non
  risponde, perché le voci del file entrano tutte insieme col rilascio — cento voci nate in due
  settimane risulterebbero create nello stesso minuto, e **una data falsa è peggio di una assente**.
  Quindi «Aperta il …» quando si sa, «In elenco dal …» in corsivo quando si ha solo la data del
  caricamento, e l'ora si stampa solo se la sappiamo. ⚠️ Il rilascio **aggiunge** la data mancante e
  non la riscrive mai; la priorità vale solo alla nascita, perché riscrivere il suo giudizio a ogni
  rilascio gli toglierebbe di mano l'unica leva che ha chiesto.
  ⚠️ **E il difetto che ha fatto nascere tutto**: il punto della situazione l'avevo fatto leggendo
  `voci-iniziali.ts` invece della pagina, e gli ho ripresentato come aperte la **tabella IG** e la
  **conta allergie** — due cose già lanciate da lui («la tabella IG quante volte te la devo dare?»).
  Il file può solo *chiudere* una voce, mai riaprirla: resta indietro in silenzio ogni volta che
  qualcosa si chiude fuori da una consegna. Le tre voci si allineano, la coda «Da validare» prende la
  decisione del 19/8, e il difetto vero — come tenere allineati file e pagina — entra in elenco con
  **priorità bassa**, come ha chiesto lui. Migrazione `20260819140000_lavoro_priorita_nata`
  (additiva). 233 suite / **3652 test verdi**, backoffice 31, sei mutazioni provate e tutte e sei
  fanno fallire i test.


- `[Sviluppo]` 🧾 **Il piano in coda si scrive `queued`, e dodici letture che dicevano il falso**
  (voce 258, seconda metà). `finalizeApproval` scrive `queued` quando il piano comincia più avanti, e
  un passo notturno (`promuoviCodeArrivate`, **primo** del `daily` perché tutti gli altri leggono lo
  stato) fa partire le code arrivate. ⚠️ **Ma la parte grossa della consegna non è la scrittura**: il
  18/8 avevo adeguato una parte delle letture e dato per scontato il resto, e la revisione
  avversariale ha trovato **tredici punti** che confrontavano ancora `status === 'active'` a mano. Il
  peggiore stava in `menu.service`: a una cliente che compra oggi con partenza lunedì l'app scriveva
  «**Il tuo piano è terminato, riattiva un piano dal Negozio**» il giorno stesso del pagamento. Poi:
  spariva la finestra di anteprima di due giorni; il calcolo della coda non vedeva le code (due piani
  pagati sovrapposti — il caso Lorena riaperto da noi); l'abbonamento Stripe in coda non compariva
  nel profilo e **la disdetta rispondeva 404**; i giorni di «porta un'amica» e quelli di pausa si
  perdevano; scheda cliente, diagnostiche, contatori, check-in e messaggio quotidiano tacevano.
  ⚠️ **Cinque punti scrivevano** la data d'inizio decidendo ognuno per sé: adesso «attivo o in
  coda?» ha una risposta sola (`statoPerInizio`). ⚠️ **Tre difetti erano più vecchi della voce**:
  `actorId: 'system'` viola la chiave esterna su `user` e il registro non si scriveva — **e lo stesso
  difetto è in produzione da settimane sull'audit di tutti i pagamenti con carta**; chi comprava il
  rinnovo in anticipo **smetteva di ricevere menu**, perché la finestra si misurava sulla data del
  profilo che l'acquisto in coda riallinea al piano nuovo (dal 10/8); e la data scelta dopo il
  pagamento da una cliente **di ritorno** non muoveva l'abbonamento. ⚠️ Una coda arrivata a scadenza
  **senza mai partire non si promuove**: da attiva-e-finita prenderebbe, nella stessa notte, il
  report di fine percorso e la cancellazione della personalizzazione — e nessuna delle due si torna
  indietro. Resta `queued`, si grida nei log e si vede in `npm run diag:coda`. ⚠️ La motivazione che
  avevo scritto sull'ordine nel cron **era falsa** (`engine.runBatch()` non eroga menu: li compone
  `deliverIfEligible`, quando la cliente apre l'app) — l'ordine è giusto lo stesso, ma una ragione
  falsa è peggio di un ordine sbagliato, perché sembra aver già risolto il problema. ⚠️ E tre punti stavano nell'**app**, usciti solo alla quarta ronda: il Profilo
  scriveva «Non hai ancora un piano attivo» a chi aveva appena pagato, il Calendario stampava la
  parola inglese «queued» in una pastiglia verde. **Quattro** ronde di revisione avversariale — ognuna
  ha trovato difetti **introdotti dalle correzioni della precedente** — e due di mutation testing.
  229 suite, **3590 test verdi**. Nessuna migrazione.
  ⚠️ **L'ordine del rilascio**: prima il backend, poi la **pubblicazione dell'app**, e
  solo alla fine `npm run converti:code` per le 4 code vecchie (prova a vuoto, poi `CONFERMA=1`) —
  convertirle prima vuol dire far comparire il Profilo sbagliato proprio a loro. Foglio: `progetto/HANDOFF_2026-08-19.md`.

- `[Sviluppo]` 🧩 **Quattro decisioni chiuse in giornata**, e nessuna era una schermata nuova: erano
  quattro punti che dicevano una cosa e ne facevano un'altra. **1) Il Mantenimento si offre sulla
  tendenza**: `hasReachedObjective` guardava l'ultima pesata, e proporlo perché una mattina la
  bilancia ha detto 69,8 — con la media a 70,6 — vuol dire venderlo **un attimo prima che il peso
  risalga**, cioè quando è più contenta e con la settimana dopo che le dà torto. **2) «Pesce tranne
  salmone» diventa una telefonata** (voce 267, chiusa): l'avviso mentre scrive c'era dal 18/8 e
  ⚠️ non corregge — la correzione più ovvia toglierebbe tutto il pesce, salmone compreso — quindi
  adesso nasce un'**attività della coach**, come per la finestra del digiuno. ⚠️ Solo per le frasi
  con un'eccezione, che sono le uniche che possono fare l'**opposto**; «non mi piace la cicoria» al
  massimo non toglie la cicoria, e farne un'attività riempirebbe la colonna che si smette di
  leggere. ⚠️ Il riferimento è l'**impronta dell'elenco**: se lo riscrive con un'altra frase ambigua
  la domanda torna, se la coach la segna fatta non si ripropone. **3) Il pulsante che diceva
  «Conferma» senza confermare niente**: nella coda del nutrizionista «Conferma» e «Correggi» fanno la
  stessa cosa — scrivono «ho letto» — e ⚠️ la proposta del motore **non viene mai applicata**. Ora si
  chiama **«Presa visione»**, con una riga sopra che dice cosa fanno tutti e due; ⛔ applicarla
  davvero è bloccato sul numero di Nocanty. **4) Il Report resta sul peso misurato, e dice perché**:
  è un documento firmato che lei può portare dal medico, quindi deve dire il numero della bilancia —
  ⚠️ ma senza una riga che lo spieghi resterebbero due numeri diversi sulla stessa persona, cioè il
  difetto tolto da tutto il resto del prodotto lo stesso giorno. 233 suite, **3635 test**.

- `[Sviluppo]` 📊 **I due dati che la cliente non vedeva — e la percentuale che rispondeva in cinque
  modi.** Arrivate le cinque decisioni del foglio `DECISIONE_Due_Schermate_App.md` (Simone, 19/8):
  la percentuale passa alla **media mobile del server**, proiezione e giorni di stallo **restano
  fuori** dall'app, del ciclo si vedono **cotture + esito precedente**, e `getActiveCycle` **si
  separa** in lettura e scrittura. Il foglio aveva contato quattro punti che calcolavano la
  percentuale ognuno per conto suo; la revisione ne ha trovato ⚠️ **un quinto, il peggiore**: i
  **traguardi**. Si calcolavano sul peso di stamattina mentre la barra, **nella stessa schermata**,
  usa la media mobile: si poteva leggere «**-5 kg: che traguardo!**» sopra una barra che dice 43%, e
  «**Obiettivo raggiunto! 🎉**» per una pesata sotto il target mentre la tendenza è ancora sopra —
  ⚠️ e un traguardo **si scrive una volta sola e non si corregge**. Ora il conto è uno
  (`percentuale-obiettivo.ts`), con un **tetto alla finestra**: `moving_average_window` non ha né
  minimo né massimo nei Parametri, e sopra 120 i chiamanti sarebbero tornati a divergere. ⚠️ Il
  prezzo è detto in pagina: «sulla media degli ultimi giorni, non sul peso di stamattina» — senza
  quella riga la cliente pesa 300 g in meno, la barra non si muove e la schermata sembra rotta.
  ⚠️ Nella stessa pagina c'erano anche **due partenze diverse** («Obiettivo attuale -14,0 kg» sopra
  «di -10,0 kg»): adesso è una. **Il ciclo**: una scheda nel Menu con le cotture di questi giorni e
  com'è andato quello chiuso; ⚠️ la schermata **non scrive più** (`getActiveCycle` materializzava a
  ogni chiamata, e collegarci l'app voleva dire una scrittura a ogni apertura); ⛔ il «gradimento»
  resta fuori — non è il gradimento, è il minimo del massimo delle stelle **con default 5**, cioè le
  tre stelle inventate rifatte in una schermata. ⚠️ E due difetti della stessa famiglia trovati dalla
  revisione: le **cotture potevano essere inventate** da un ripiego, e «**precedente**» non voleva
  dire precedente — il feedback si scrive quando lei si pesa al secondo giorno, quindi la riga
  parlava a volte dei giorni che stava guardando. 232 suite, **3627 test**.

- `[Sviluppo]` ✅ **Chiusi i due punti della coda rimasti senza test, e le scadenze che rispondevano
  in due modi.** Nell'handoff (§4.4) c'era scritto che due letture erano state corrette **senza un
  test dedicato**, e che non era una dimenticanza: era scritto lì perché un giorno qualcuno le
  avrebbe rilette chiedendosi se erano coperte. **1)** I compiti G0…G7 della prova si contano dal
  giorno d'inizio, quindi ci si arriva solo a partenza avvenuta: se lì lo stato dice ancora `queued`
  la promozione notturna è in ritardo e quella cliente **sta già ricevendo i menu** — col solo
  `active` il riquadro la contava fra le prove attive e la coach non trovava la riga di lavoro.
  **2)** `trial_measures_ok` (il punto A del report A→B) non nasceva per una prova in coda, e il
  funnel del lancio contava meno prove di quelle vere — ⚠️ una differenza che non si vede da nessuna
  parte se non nel grafico, mesi dopo. **3)** Le **scadenze in arrivo**: la dashboard della coach le
  conta comprese le code, l'appunto in Calendario — che nasce per lo **stesso identico evento** — no.
  La coach vedeva il piano nell'elenco e non lo trovava in agenda, e ⚠️ quando due schermate
  rispondono diversamente alla stessa domanda non se ne crede più nessuna delle due. 4 test, e in
  tutti il finto Prisma **filtra come il database vero**: un doppio che risponde uguale a chiunque
  chieda avrebbe fatto passare i test anche sul codice sbagliato. 230 suite, 3595 test.

- `[Sviluppo]` 🌅 **Il messaggio quotidiano non si decide più a caso.** Trovato rifacendo **col grep**
  il censimento dei `findFirst` su `Subscription` — cioè applicando la lezione della giornata invece
  di fidarsi di quello che si ricordava. `generateDailyForClient` decideva se mandare «il tuo piano di
  oggi» con un `findFirst` **senza `orderBy`**: con una riga sola non si vedeva, ma due righe sulla
  stessa cliente sono legittime — una eroga, una è in coda — e senza ordinamento il database ne
  restituisce **una a caso**. Bastava uscisse quella sbagliata perché il messaggio sparisse a chi il
  piano ce l'ha, e tornasse il giorno dopo senza che nessuno capisse perché. ⚠️ È lo stesso difetto
  del caso Lorena, nella schermata che si guarda ogni mattina — e la consegna delle code di oggi lo
  rendeva **più probabile**, non meno: le righe candidate sono di più. Ora `attivoInCorso`, la stessa
  funzione dell'erogazione e della pausa. ⚠️ Restano due `findFirst` senza `orderBy`, ed è giusto:
  cercano un `pending` per rispondere «c'è già una richiesta non pagata?», e quella domanda non
  dipende da quale riga esce. 2 test.

- `[Sviluppo]` 📈 **I tre grafici della contabilità mostrano l'anno, non un punto solo** (segnalazione
  di Simone con lo screenshot: «il dato numerico va bene ma il grafico dovrebbe darmi l'anno»).
  «Incassi / mese», «Costi / mese» e «Utile / mese» leggevano la serie del **periodo selezionato**,
  che è un mese: un pallino con sotto «ago 26», e nemmeno la freccia ▲▼, perché il confronto è con il
  punto precedente e il punto precedente non c'era. Ora la serie dei grafici è quella degli **ultimi
  dodici mesi** che finiscono col mese scelto. ⚠️ **Finestra mobile e non anno solare** (scelta sua):
  da capodanno l'anno solare avrebbe riportato lo stesso difetto — un punto e undici caselle vuote.
  ⚠️ **I numeri grandi restano del mese**: sono due domande diverse («come è andato agosto» e «come
  sta andando») e prima avevano la stessa risposta. ⚠️ Una **seconda chiamata** e non un campo nuovo
  nell'API: l'endpoint sa già rispondere su un intervallo qualsiasi e riempie i mesi vuoti da solo.
  ⚠️ E le **etichette dell'asse si diradano** (`lib/etichetteAsse.ts`, 6 test): dodici «ago 26» su una
  scheda da 320 px diventano una riga grigia illeggibile, e un'etichetta illeggibile è come
  un'etichetta assente — solo che sembra messa apposta. Se ne scrivono al massimo sei, **contando
  all'indietro dall'ultima**, perché l'ultimo punto è il mese dei numeri grandi in cima: senza il suo
  nome il grafico direbbe un numero senza dire di quando. Si dirada l'etichetta, non il dato.

- `[Sviluppo]` 🧾 **L'attore che non esiste: di tutti i pagamenti con carta non restava una riga di
  registro.** `AuditLog.actorId` è una **chiave esterna su `user`**, ma chi scrive non sempre ha un
  utente per le mani e ci mette una stringa che spiega chi è stato: `'stripe-webhook'` sull'audit
  `commerce.payment.approve` di **tutti i pagamenti con carta**, `'public'` sul lead che arriva dal
  form del sito. L'INSERT viola il vincolo, `AuditService` assorbe l'eccezione — ed è giusto che la
  assorba, un pagamento non deve fallire per una riga di registro — ⚠️ **ma la riga si perdeva in
  silenzio**, e non c'era niente che lo dicesse: lo si scopre il giorno in cui si va a leggere il
  registro di un pagamento, cioè quando serve. ⚠️ **Scartato l'elenco di stringhe da riconoscere**
  («se è `public` allora…»): il giorno che qualcuno ne inventa una nuova siamo daccapo, ed è
  precisamente quello che è successo fra la prima e la seconda. Ora se l'INSERT fallisce e un attore
  c'era si riprova **una volta sola** senza attore, conservando nel `metadata` chi diceva di essere
  (`attoreNonUtente`) e lasciando un `warn` — un ripiego che non si vede diventa la norma. ⚠️ Se
  l'attore non c'era non si riprova: il guasto è un altro. Le righe perse **non tornano**: non ci
  sono i dati per ricostruirle. 3 test.

---

## 2026-08-18

- `[Sviluppo]` ⭐ **Le stelle mai date non orientano più il motore** (voce 270, chiusa nella notte con
  la decisione di Simone: **escluderle dal gradimento**). Se la cliente tocca solo «Seguita / Non
  seguita» l'app manda comunque `stars: 3` — e quella parte non cambia, è la sua risposta del 18/8 —
  ma ⚠️ **quel 3 non è un'opinione**: è un valore di scorta, e finiva nel segnale «gradimento» con
  cui il motore decide cosa riproporle. Chi diceva soltanto «non l'ho seguita» risultava aver dato
  **tre stelle** a quel piatto, e se lo rivedeva davanti con la faccia di uno che le era piaciuto.
  Ora i voti col tag `stelle_non_date` restano fuori da **tre letture**, quelle in cui le stelle
  orientano il motore: il punteggio del pool, il gradimento del ciclo e i segnali del motore.
  ⚠️ **Restano com'erano** i «piatti più apprezzati» del report e le schermate dello staff — scelta
  sua: là il numero è il resoconto di quello che è stato scritto, non una decisione su cosa arriverà
  nel piatto. ⚠️ **Si filtra nella query e non in memoria**: filtrando dopo bisognerebbe leggere i tag
  ovunque, e il primo posto che se ne dimentica torna a contare il valore di scorta senza che si
  veda. ⚠️ **I voti senza tag contano**: sono quelli di prima del 18/8, e trattarli come «non dati»
  butterebbe via la storia di chi le stelle le ha date davvero. ⚠️ E il prezzo detto ad alta voce:
  per chi non valuta quasi mai, il motore ha **meno segnale** e torna a scegliere per varietà e
  calorie — non peggio di prima, perché prima sceglieva **col segnale sbagliato**, ma diverso.
  Modulo `menu/stelle-che-contano.ts`, 6 test (225 suite, 3531 verdi). Nessuna migrazione.

- `[Sviluppo]` 🪤 **Via la trappola su `dietFamily`: aveva finito il suo lavoro** (era in elenco con
  la data «19/8», ed è la notte fra i due). ⚠️ **La data era un modo di dire una condizione** —
  «quando il colpevole è stato trovato e corretto» — e la condizione era vera dall'11/8. Dall'11/8
  `prisma/traccia-diet-family.ts` intercettava ogni scrittura su `dietFamily` e ne registrava lo
  stack: serviva a capire perché la dieta di una cliente, spostata **cinque volte da tre persone**,
  tornasse ogni volta indietro. ⚠️ **La risposta resta scritta, ed è la parte che conta**: non la
  riscriveva **nessuno**. La traccia ha mostrato una sola scrittura e nessuna riscrittura, e a quel
  punto la domanda giusta non era più «chi la sovrascrive» ma «questa scrittura viene eseguita?» —
  non veniva eseguita, perché `updateClient` costruiva le `ops` e non le lanciava mai (mancava il
  `$transaction`, e le operazioni di Prisma sono pigre). Non tornava indietro: non era mai partita. E
  non se ne accorgeva nessuno perché l'audit scriveva «cambiato da X a Y» calcolandolo dai valori
  **richiesti**. Il commento che spiega tutto questo resta in `prisma.service.ts`, dove la trappola
  stava. 223 suite, 3519 verdi (una suite in meno: era la sua). Nessuna migrazione. ⚠️ Su Render si
  può togliere la variabile `TRACCIA_DIET_FAMILY`, se c'era: non la legge più nessuno.

- `[Sviluppo]` 🔍 **La seconda revisione: il nome del piatto nel carrello, e «c'era già» detto come un
  errore.** Ho fatto rileggere anche le due consegne della notte — la revisione di prima e le
  sostituzioni — e ha trovato due cose vere, tutte e due **introdotte poche ore fa da quelle stesse
  correzioni**: è il rischio della correzione, chiudere il caso raccontato e aprire quello vicino.
  ⚠️ **Il nome del piatto finiva nella lista della spesa**: `swapDislikedDishes` scrive una
  sostituzione in cui `from` e `to` sono **nomi di ricetta**, e il ripiego di `ingredientiEffettivi`
  — «se non trovo l'origine aggiungo il sostituto», scritto per **un solo consumatore**, la chat —
  è diventato un'istruzione di acquisto: nel carrello compariva «Riso e lenticchie» in mezzo a farro
  e zucchine. Adesso chi chiama sceglie: la chat `aggiungi`, la spesa e la scheda `salta`. ⚠️ **E
  «c'era già» veniva detto come un errore**: `apriAttivita` tornava un booleano e il backoffice
  traduceva `false` in «l'attività NON risulta aperta» — un ramo irraggiungibile fino a tre ore
  prima, e diventato il **secondo salvataggio normale** da quando `refId` è il giorno. Peggio: è
  proprio il salvataggio che il banner nuovo induce («non ha una coach assegnata» → la assegna →
  risalva). Ora torna `'creata' | 'gia-presente'`, il testo dell'attività **si riscrive** quando è
  cambiato (era la fotografia del momento della nascita, e chi la legge la legge dopo) e si dice che
  la **push non riparte**. Corretta anche la voce che raccontava ancora il vecchio `refId`. ⛔ Voce
  **285 aperta e non chiusa**: il numero della sostituzione **nasce in chat**, e lì è ancora quello
  di catalogo — Gaia dice «120 g di biete» mentre nella ricetta ce ne sono 216, e lo stesso vale per
  la tabella del backoffice e per i passi di cottura, che continuano a dire «carote». Va deciso una
  volta sola per tutti e tre. 4 test (224 suite, 3525 verdi). Nessuna migrazione.

- `[Sviluppo]` 🥬 **Le sostituzioni di Gaia arrivano nel carrello e nella scheda ricetta** (voce 284,
  aperta e chiusa nella notte). Era il rilievo più grosso della revisione, e non una regressione: era
  lì da prima, e le consegne della sera l'hanno reso visibile. ⚠️ **La lista della spesa non
  applicava le sostituzioni** — `aggregaSpesa` leggeva gli ingredienti per `recipeId` e ignorava
  `pasto.substitutions`: chi aveva concordato «carote → biete» comprava le carote, per giunta
  scalate ×1,8, e zero biete. Un errore che non si vede nell'app: si vede al banco frigo. ⚠️ E la
  **scheda ricetta** faceva lo stesso. ⚠️ **La funzione giusta esisteva già** — `ingredientiEffettivi`
  — ma stava **dentro `sostituzione-chat.service.ts`**, un servizio che si porta dietro audit,
  config, segnalazioni e Vera: chi aveva bisogno solo di quella regola non poteva chiamarla senza
  tirarsi dietro tutto il resto, e infatti non la chiamava. **Una funzione difficile da chiamare è
  una funzione che qualcuno dimenticherà**: adesso vive da sola, senza dipendenze, e la importano
  tutti e tre i posti che rispondono alla stessa domanda. ⚠️ **Prima si sostituisce, poi si scala**:
  invertendo si scalerebbe un ingrediente che quella cliente non ha più. ⚠️ E `pastoDelGiorno` trova
  il pasto **anche senza moltiplicatore**, perché un piatto non scalato può avere lo stesso una
  sostituzione — porzione e sostituzioni sono due domande diverse sullo stesso pasto. ⚠️ Nell'app, sul
  piatto scalato la riga della sostituzione **non dice più le grammature**: `fromQty`/`toQty` sono di
  catalogo e scritte una volta sola, quindi diceva «100 g → 120 g» due righe sopra a una scheda che
  dice 216 — tre numeri per la stessa cosa. Si dice **cosa** è cambiato, e il **quanto** lo dice la
  ricetta, che ha una fonte sola. 9 test (224 suite, 3521 verdi; app 106). Nessuna migrazione.

- `[Sviluppo]` 🔍 **La revisione della sera: sette correzioni sul lavoro appena consegnato.** Prima
  di chiudere ho fatto rileggere le sei consegne della sera da due revisori avversariali, come il
  17/8 — e come il 17/8 hanno trovato roba vera su codice **già pushato, verde e testato**. ⚠️ **La
  più grave: l'attività «fissa la visita» a una cliente senza coach assegnata non la riceveva
  nessuno** (niente push, e l'elenco è filtrato per cliente assegnata), mentre il backoffice diceva
  «Ho aperto un'attività alla coach» — e capita proprio all'inizio del percorso, che è quando il via
  libera clinico si decide. Ora si dice, nell'attività e nella scheda. ⚠️ **E `refId` = id della nota
  non poteva collidere mai**: `decidiIdoneita` crea una nota nuova a ogni salvataggio, quindi
  risalvare la stessa valutazione apriva una seconda attività con una seconda push — il contrario di
  quello che il commento prometteva. Adesso è il **giorno** della decisione. Poi: ⚠️ nell'ordine menu
  la prima voce di un gruppo **scavalcava il titolo** e finiva in coda al gruppo precedente (e un
  gruppo di sole voci nascoste spariva); ⚠️ nella lista della spesa la somma **dipendeva
  dall'ordine** dei giorni («q.b. di farro il lunedì» cancellava i 100 g del martedì), mentre il
  commento prometteva il contrario; ⚠️ il **terzo stato** della scheda ricetta non compariva aprendo
  il piatto dalla home; la soglia 1,05 era in **tre** posti e non in due, e il terzo era scritto a
  mano fuori da ogni test; e un `if` morto in `stessaLista`. ⚠️ **Quattro regole non erano difese da
  nessun test** — verificate per mutazione dal revisore, ora coperte: fra queste `apriAttivita`, che
  non aveva **nessun** test pur essendo il punto unico da cui parte anche la push. **E i documenti
  dicevano cose che il codice smentisce**: la percentuale verso l'obiettivo non ha due risposte ma
  **quattro** (ci sono anche il widget e l'elenco clienti della coach, tutti e due sull'ultima
  misura — cambia la decisione n.1 del foglio), «`/me/cycle` lo chiama solo lo staff» era falso (non
  lo chiama nessuno), il docstring di `progress.service` diceva che l'app legge `/me/progress` — ed è
  **il motivo per cui la cosa era rimasta invisibile** — e una voce citava un foglio che non esiste.
  ⛔ Il rilievo più grosso **non è chiuso** ed è la voce 284: le sostituzioni di Gaia restano alle
  grammature di catalogo e non entrano nella lista della spesa, mentre `ingredientiEffettivi` esiste
  già e non la chiama nessuno dei due punti. 224 suite, 3516 verdi; app 103, backoffice 25. Nessuna
  migrazione.

- `[Sviluppo]` 🔭 **I due dati che la cliente non vede: l'analisi, e la scoperta che cambia la
  domanda** (voce 253, parte di analisi chiusa). Nessun codice di prodotto: un foglio,
  `progetto/DECISIONE_Due_Schermate_App.md`, da leggere prima di scrivere. ⚠️ **Il primo dei due non
  è una schermata mancante.** `Obiettivo.tsx:465` calcola la barra «verso il tuo obiettivo»
  sull'**ultima misura**; `GET /me/progress` la calcola sulla **media mobile**, perché la regola del
  progetto (spec 7.2) è «si ragiona sempre sulla tendenza, mai sul singolo dato». Quindi la cliente
  vede una percentuale che **balla con l'acqua** — due etti di ritenzione e la barra torna indietro
  in una giornata in cui non è successo niente — mentre il motore e l'allarme di stallo della coach
  ne leggono un'altra, più stabile, **sulla stessa persona**. Sono due risposte alla stessa domanda,
  ed è la cosa che questo progetto ha deciso di non fare più: il lavoro vero è **togliere il conto
  locale**, non aggiungere una pagina. ⚠️ E sul secondo, due trappole trovate nel codice: `GET
  /me/cycle` **scrive** (`clientCycle.update`/`create` a ogni chiamata — oggi lo chiama solo lo
  staff), e il campo `gradimento` **non è il gradimento** — è il minimo fra le ricette del ciclo del
  massimo delle loro stelle, con **default 5 quando una ricetta non è mai stata valutata**:
  mostrarlo rifarebbe il difetto delle tre stelle inventate (voce 270) dentro una schermata. Il
  foglio propone `/me/progress` dentro «I tuoi obiettivi» e il ciclo come scheda nel Menu (le due
  cotture, l'esito precedente), e ⛔ **finisce con cinque decisioni** — fra cui se mostrare la
  **proiezione della data obiettivo** (scritta a una cliente diventa una promessa) e i **giorni di
  stallo**, che ⚠️ vale la pena chiedere alla nutrizionista: «ferma da 11 giorni» può essere la
  spinta giusta o la frase che la fa smettere.

- `[Sviluppo]` 🧭 **Ordine del menu, difetto 7: le voci nascoste tornano DOVE le aveva messe.** La
  card lavora sulle voci **visibili**, quindi chi non ha un permesso quella riga non la vede e non
  può posizionarla — ma nelle sue preferenze c'è, ed è giusto che ci resti. `conNascoste` faceva la
  cosa giusta a metà: le teneva e le riattaccava **in fondo all'ultimo gruppo**, così il giorno che
  il permesso arrivava la pagina ricompariva in coda al menu, lontana da dove stava, e ⚠️ nessuno
  collegava le due cose: la personalizzazione era rispettata **solo di nome**. Ora
  `conNascosteAlLoroPosto` riaggancia ogni riga nascosta a quella che la precedeva. ⚠️ Si lavora
  sulla **lista salvata** e non sulla vista, perché la vista quelle righe non le contiene nemmeno.
  ⚠️ L'ancora è preferibilmente una **rotta** e non un titolo: due gruppi possono chiamarsi uguale
  (da stamattina i doppioni non si fondono più) e un'ancora ambigua rimetterebbe la voce nel gruppo
  sbagliato; senza rotte sopravvissute ci si aggancia al titolo, e senza nemmeno quello la riga
  torna **in cima**, dov'era. ⚠️ E se la riga precedente è sparita si risale ancora indietro: due
  nascoste di fila non devono finire in coda perché la prima non c'è più. 8 test (22 nel file, il
  backoffice i test ce li ha da stamattina). ⛔ **Resta il difetto 6 e resta di proposito**: una voce
  tolta dal software consuma una delle 80 righe finché la persona non risalva, e chiuderla vuol dire
  una **scrittura che nessuno ha chiesto**. Nessuna migrazione, backend non toccato.

- `[Sviluppo]` 📝 **Le esclusioni scritte come frasi: l'avviso adesso c'è anche nel QUESTIONARIO**
  (voce 283, coda della 267). La regola di stamattina era arrivata su quattro porte — profilo,
  «non gradisco», scheda backoffice, scheda coach — e ⚠️ **restava fuori proprio il questionario,
  che è la porta d'ingresso vera**: è lì che quasi tutte le esclusioni vengono scritte la prima
  volta, e «pesce tranne salmone» scritto lì non toglieva niente dal menu senza che nessuno glielo
  dicesse. ⚠️ **Qui non si scarta e non si blocca**, ed è la differenza con le altre quattro: là la
  voce non viene salvata e il testo torna nel campo, perché lei è a un dito da quel campo; qui
  siamo dentro il **cancello del carrello**, e fermare il questionario per una frase scritta male
  vuol dire lasciare una cliente in mezzo al percorso. Si salva, si dice cosa succede davvero, e si
  dice **dove correggerlo**. ⚠️ Si guarda quello che arriva **prima** del filtro spezie, come fa il
  profilo. ⚠️ Il campo di risposta è **suo** (`aiutoEsclusioni`) e non dentro `avvisiEsclusioni`:
  quella lista l'app la mostra sotto il titolo «Allergie e intolleranze», e questa non è né l'una né
  l'altra — così l'app pubblicata, che il campo nuovo non lo conosce, non mostra una frase sotto il
  cartello sbagliato. Le parole restano quelle del server: la regola vive in un posto solo. 3 test
  (223 suite, 3505 verdi; app 103). Nessuna migrazione. ⚠️ Arriva alle clienti con la prossima
  pubblicazione o OTA.

- `[Sviluppo]` 🩺 **«Serve una visita» adesso lo sa anche la coach: l'attività si apre da sola** (la
  voce «La visita nel calendario», aperta da giorni). La nutrizionista sceglieva «serve una visita»,
  scriveva la nota obbligatoria e salvava: la decisione finiva sul profilo, la nota nella lista note,
  le segnalazioni cliniche si chiudevano — ⚠️ **e la visita non la fissava nessuno**. L'unico modo
  perché succedesse qualcosa era che qualcuno si ricordasse di riaprire quella scheda, su una
  decisione **clinica**. ⚠️ **Scartato l'appuntamento creato da solo**: un appuntamento vuole un
  orario, e l'orario dipende dall'agenda della nutrizionista e da quando può la cliente — se ne
  metterebbe in calendario uno che qualcuno dovrà disdire. E c'è un secondo cancello:
  `prenotazioni.service` lascia prenotare **solo chi una visita l'ha comprata** (Simone, 12/8),
  quindi per chi non ce l'ha la strada non finisce con un orario ma con un acquisto — ed è
  esattamente il tipo di cosa che una persona deve dire a un'altra. Quindi nasce un'**attività della
  coach**, come per la finestra del digiuno. ⚠️ **Nel testo c'è quante visite le restano**, ed è il
  numero che cambia la telefonata: senza, la coach propone un orario e la cliente si sente
  rispondere dall'app «serve prima acquistarla dal negozio» — una figura fatta fare a lei su una
  cosa che sapevamo già. ⚠️ Tre stati: ne ha · non ne ha · **non lo so**. ⚠️ Il **motivo clinico non
  si copia**: la nota è già nella lista note con autore e ora, e due copie di un dato sanitario
  divergono — si dice dov'è. ⚠️ `refId` è l'**id della nota**: una valutazione nuova è un fatto nuovo
  e merita un'attività nuova, due salvataggi della stessa no. ⚠️ E l'attività passa da `apriAttivita`,
  il punto unico da cui nascono **e** da cui parte la push alla coach: scrivere su `coachTask` da qui
  avrebbe creato un tipo che non avvisa nessuno, e non si sarebbe visto perché in elenco ci sarebbe
  stato lo stesso. ⚠️ Sotto `catch` con l'errore nei log, e nel backoffice chi decide **legge se è
  successo** («Ho aperto un'attività alla coach» / «⚠️ NON risulta aperta: avvisala tu»): senza, la
  nutrizionista non distingue «l'ho detto a qualcuno» da «l'ho scritto e basta». 11 test (223 suite,
  3502 verdi; backoffice verde). Nessuna migrazione.

- `[Sviluppo]` 🧰 **Il kit di rientro non ricopia le giornate: le riporziona sul fabbisogno di
  adesso** (voce 282 — e con lei la 255 si chiude, tranne la decisione sui pezzi).
  `generateRientroMenus` sceglie i giorni che su quella cliente avevano fatto perdere di più e li
  ricrea nei giorni successivi copiando `meals` così com'è: ⚠️ **è l'unico posto del progetto dove
  una giornata di ieri diventa una giornata di domani senza passare da `deliverIfEligible`**, e
  copiarla di peso sbaglia in due modi. Una giornata scritta prima di stamattina **non è scalata**,
  quindi il kit rimetterebbe nel futuro una giornata al 65% — ⚠️ e **nessuno la aggiusterebbe più**,
  perché l'erogazione compone solo le date che non esistono ancora e il suo `upsert` ha
  `update: {}`: il rimedio delle porzioni le passerebbe accanto senza vederla. E una giornata
  scalata mesi fa porta un fattore dimensionato su un fabbisogno che oggi non è più il suo. ⚠️ **Il
  modo sbagliato di rimediare è scalare quello che è già scalato**: 891 × 1,8 fa 1603, cioè ×3,24
  sulla ricetta — si torna sempre alla porzione di catalogo prima di riscalare, ed è la stessa
  trappola dell'app vista dall'altra parte. ⚠️ `porzione` si **toglie** e non si mette a 1: l'app
  distingue «assente» da «presente». ⚠️ **Senza fabbisogno calcolabile non si tocca niente** —
  riportare la giornata al catalogo «perché non sappiamo» rimpicciolirebbe il piatto in silenzio, e
  «non si rimpicciolisce mai» è la regola con cui la strada C è stata decisa — **ma si scrive nei
  log**, perché quelle porzioni sono quelle di allora e non una scelta di adesso. La scalatura passa
  da `porzioniScalate`, la stessa funzione dell'erogazione. Modulo puro `menu/riporziona-giornata.ts`
  (8 test) e ⚠️ **il primo test di `generateRientroMenus`, che non ne aveva nessuno** (3):
  `MonitoringModule` importa `MenuModule` per `KcalNeedService`, senza cicli. 11 test (222 suite,
  3491 verdi). Nessuna migrazione.

- `[Sviluppo]` 🛒 **La lista della spesa si rifà a ogni apertura: quello che si conserva sono le
  spunte** (voce 281, ultima coda della 255 — ma il difetto è più vecchio di lei e più largo).
  `shoppingList` teneva una riga per `(cliente, dal, al)` e, se la trovava, **la restituiva così
  com'era**: nessuno la invalidava mai. Quindi tutto quello che cambia la giornata **dopo** che la
  lista è nata non arrivava nel carrello — le porzioni scalate di stamattina (chi aveva già la lista
  continuava a comprare il cibo della porzione piccola, cioè proprio l'errore che quella consegna
  voleva chiudere), il piatto **cambiato in chat** con Gaia, le «ricette semplici», il piatto non
  gradito sostituito in erogazione, la grammatura corretta in backoffice dalla nutrizionista. ⚠️ E
  non lo diceva nessuno: la lista **sembrava** la lista di quei giorni — il difetto di famiglia di
  questo progetto, dentro l'unica schermata che si guarda mentre si spinge un carrello. ⚠️ **La
  strada delle date è stata scartata**, ed è la parte che vale: «se un giorno è stato toccato dopo
  che la lista è nata, rifalla» non si può fare, perché `ShoppingList.updatedAt` lo muove **anche la
  spunta** (la lezione della voce 275, di stamattina) e `MenuDay.updatedAt` lo muove
  `deliverIfEligible`, che gira **a ogni apertura dell'app** — il confronto sarebbe stato sempre
  vero o sempre falso, e in tutti e due i casi sbagliato in silenzio. Ora la lista si **ricalcola** a
  ogni lettura, e costa la query sulle ricette dei sette giorni, cioè quello che costava comunque la
  prima volta: la riga in tabella smette di essere una **copia** e diventa il posto dove vive
  l'unica cosa che il server non sa ricostruire, **cosa hai già messo nel carrello**. ⚠️ Si scrive
  **solo se è cambiato qualcosa** (`stessaLista` confronta per contenuto e non per ordine: un giorno
  rigenerato con gli stessi piatti non è una lista diversa), o `updatedAt` si muoverebbe a ogni
  sguardo. ⚠️ **Si conserva la spunta, non la quantità**: se il piatto è cresciuto i 120 g diventano
  216 anche su una riga già spuntata — chi ha già comprato lo vede e decide, mentre tenere il numero
  vecchio le nasconderebbe che ora gliene serve di più. Modulo puro `menu/lista-della-spesa.ts`, 13
  test (220 suite, 3480 verdi). Nessuna migrazione. ⛔ Della voce 255 resta **solo il kit di
  rientro** e la decisione sui **pezzi**.

- `[Sviluppo]` 🥄 **La scheda della ricetta con le grammature di QUESTA cliente** (coda della voce
  255, ora voce 280). Era l'ultima delle quattro code delle porzioni scalate che una cliente **vede**:
  `GET /recipes/:id` risponde con la ricetta di **catalogo** perché non sa di quale giorno si parli,
  quindi chi ha la porzione ingrandita leggeva «Pranzo 891 kcal» nel menu, apriva la ricetta e
  trovava gli ingredienti per 495. Due numeri che si contraddicono sotto gli occhi della stessa
  persona, e a turare il buco c'era una **frase** — «pesa gli ingredienti per 1,8 volte» — cioè un
  conto a mano chiesto a chi sta cucinando. Ora la richiesta porta `?giorno=&slot=` e il server
  risponde con le grammature già scalate. ⚠️ **Il fattore non si passa, anche se l'app ce l'ha**:
  accettarlo vorrebbe dire che il telefono decide quanto cibo compare nella scheda — si rilegge
  dallo snapshot, e il giorno si legge sempre come **proprio** (`user.sub`). ⚠️ **Scala il server e
  non l'app**: la regola di arrotondamento è `quantitaScalata`, la stessa della lista della spesa, e
  riscriverla di là sarebbero due risposte alla stessa domanda — il giorno che si decidesse di
  arrotondare i pezzi, lista e scheda direbbero due numeri diversi per lo stesso piatto. ⚠️ **E la
  scalatura è a richiesta, non automatica**, che è la riga che protegge chi ha l'app di adesso: il
  backend si aggiorna col deploy e l'app con l'OTA, e l'app pubblicata dice ancora «pesa per 1,8
  volte» — riceverle già scalate le farebbe pesare **×3,24**. Chi non chiede riceve esattamente
  quello di prima, e c'è un test che tiene ferma quella riga. ⚠️ **Tre stati, e il terzo è quello
  che fa male**: se la giornata non si trova, o il piatto compare due volte nello stesso giorno con
  fattori diversi e non si sa in quale pasto si è, la scheda resta di catalogo **e lo dice**,
  rimettendo l'istruzione di pesare a mano — indovinare qui vorrebbe dire scrivere una grammatura
  sbagliata sotto il nome di un piatto vero. ⚠️ La soglia `PORZIONE_DA_DIRE` (1,05) è **una sola in
  due posti** che devono restare d'accordo, e un test per parte tiene fermo il numero nominando
  l'altro: se il server scalasse a un fattore che il menu tace, gli ingredienti cambierebbero senza
  che nessuno spieghi perché. Per strada: la riga nel menu non ordina più di moltiplicare (era il
  modo più diretto di far fare il conto due volte) e dalla home il pulsante «Ricetta» manda anche lo
  slot. ⚠️ **Verificato, non dedotto**: dei tre punti che restano alla voce 255, i giorni **già
  erogati** non si riscrivono, ma sono al massimo `menu_days_delivered` per cliente — il buco si
  chiude da sé quando rollano, non è un arretrato. 15 test nuovi (219 suite, 3467 verdi; app 94).
  Nessuna migrazione.

- `[Sviluppo]` 🛡 **La base certificata la vede anche lei.** `GET /me/personal-base` risponde dall'R8
  con quante ricette del catalogo sono state certificate sicure per quella cliente e con la firma del
  certificato di personalizzazione — e nell'app **non lo chiamava nessuno**. La promessa del prodotto
  è «il tuo menu è costruito su di te»: quel numero è la prova che è successo, e la sola persona a
  cui interessa era l'unica a non averlo. ⚠️ **E la nota che avevo scritto il 16/8 era sbagliata**:
  diceva «schermata nuova, va disegnata prima». Non serviva una schermata, serviva una **riga** — nel
  Profilo, subito sotto le allergie, perché è lì che nasce la domanda a cui risponde: ha appena letto
  le sue allergie e «le teniamo fuori dai menu sempre», e la domanda che segue è «e allora cosa mi
  resta?». Ora legge «148 ricette del catalogo sono state certificate sicure per te: il motore pesca
  solo da lì», con sotto, piccolo, numero e firma del certificato. ⚠️ Tre stati, e il terzo è il
  **silenzio**: se la lettura non riesce non compare niente, perché «0 ricette certificate sicure per
  te» detto per un errore di rete sarebbe falso e spaventoso. ⚠️ E «pronta con zero ricette» non è
  pronta. ⚠️ La lettura è separata e sotto `catch`: legarla al riepilogo avrebbe fatto sparire dieta,
  allergie e regime perché non si è saputo contare le ricette. Per strada: la rotta `/preferenze` era
  scritta due volte in `App.tsx`, e il censimento della voce 258 («47 letture, non rifarlo») era
  sbagliato di quasi il doppio — corretto. 9 test nuovi.

- `[Sviluppo]` 🧾 **Il piano «in coda» diventa uno stato suo — prima le letture, la scrittura dopo**
  (voce 258, la causa che restava dopo il caso Lorena). ⚠️ Questa consegna **non scrive** `queued`:
  crea lo stato e insegna a tutte le letture cosa farne. Non è prudenza generica, è la sola sequenza
  sicura — se la scrittura arrivasse oggi, un piano in coda sparirebbe da ogni query che filtra
  `status = 'active'`, e sparirebbe **in silenzio**. ⚠️ Il censimento ha contato una novantina di
  letture che scrivono quasi tutte la stessa stringa, e **non chiedono la stessa cosa**: «chi eroga
  oggi?», «ha un piano?», «ha già comprato?», «c'è qualcosa in ballo?». Finché la coda si scriveva
  `active` le quattro risposte coincidevano per caso e nessuno ha dovuto distinguerle. Ora
  `stati-abbonamento.ts` dà un nome a ciascuna, e il punto è che **la scelta si veda nel nome** di
  chi la fa. La decisione che regge tutto è di Simone (17/8): un piano in coda **è un contratto** —
  conta come «ha un piano» nelle schermate dello staff, **non** conta per l'erogazione. Quindi la
  coda entra nella lista clienti, nel contatore della dashboard, nella prova di benvenuto, nel
  monitoraggio, nelle campagne, nei percorsi conclusi; e ⚠️ **non entra** in motore, menu, notifiche,
  pause e report — `filtroClienteConPianoAttivo` resta `active` di proposito, e adesso c'è scritto
  perché. ⚠️ La coda ha **due forme** e si leggono entrambe: la migrazione è additiva e i piani messi
  in fila prima di oggi sono ancora `active` con la partenza nel futuro — leggere solo lo stato nuovo
  avrebbe chiuso il difetto per i piani nuovi lasciandolo aperto proprio su quelli dove è successo.
  ⚠️ E uno `queued` **non eroga mai**, nemmeno con la data già passata: lì è la promozione a essere in
  ritardo, e indovinare vorrebbe dire consegnare i menu di un piano che nessuno ha fatto partire.
  ⚠️ Difetto trovato per strada: `clientAgenda` prendeva la scadenza con un `findFirst` **senza
  `orderBy`** — con una riga non si vedeva, con la coda avrebbe preso una riga a caso. Niente vincolo
  in banca dati, di proposito: `npm run diag:coda` è la fotografia da guardare prima. 19 test nuovi
  (218 suite, 3452 verdi).

- `[Sviluppo]` 🥗 **I valori che mancavano, integrati e approvati dal capo nutrizionista.** Ha mandato
  la tabella completa dei 57 alimenti, tutte le righe «Confermato». ⚠️ Prima di toccare qualsiasi cosa
  l'ho trascritta e confrontata riga per riga col seed su dieci campi: **58 differenze, tutte nella
  stessa direzione** — un buco da noi, un valore da lui. **Zero contraddizioni**: nessun numero che
  avevamo è stato smentito, ed era il rischio del confronto. Entrano i sei IG che l'11/8 mancavano
  (borlotti 28, kiwi 52, latte parzialmente scremato 32, avocado 10, mandorle 15, noci 15) e i valori
  per 100 g di dieci righe. ⚠️ **Le note sono state riscritte, non lasciate lì**: tre dicevano «nessun
  IG da fonte affidabile, la riga resta senza indice», e lasciarle accanto a un numero avrebbe fatto
  un documento che si smentisce da solo. ⚠️ **E il pezzo che vale più dei numeri: «non si applica» non
  è «non lo so».** Quattordici alimenti (olio, parmigiano, petto di pollo, uovo, salmone…) hanno N.D.
  nella sua colonna dell'IG, perché un alimento senza carboidrati un indice glicemico **non ce l'ha**.
  Prima quel caso e «non lo sappiamo» erano lo stesso campo vuoto, e a «qual è l'indice glicemico del
  salmone?» Gaia rispondeva **tacendo sull'unica cosa che le era stata chiesta** — vero, e
  indistinguibile da una reticenza. Adesso lo dice, con **zero numeri autorizzati** (la guardia in
  uscita continua a rifiutare qualunque cifra inventata), e non è una nostra deduzione: è la sua
  dichiarazione. ⚠️ La tendina in backoffice aveva tre opzioni: aprire una di quelle righe e salvarla
  avrebbe riscritto «non lo so» sopra la sua firma, in silenzio — aggiunta la quarta. ⚠️ E il prezzo
  della firma, detto ad alta voce: da adesso il seed non governa più quelle 57 righe, quindi cambiare
  un numero nel file **non lo cambia più in produzione** — ci vuole una tabella nuova firmata, o la
  scheda. `tabella-capo.spec.ts` rifà da solo il confronto che ho fatto a mano (61 test): se fallisce,
  la domanda non è «come lo aggiusto», è «chi ha firmato il numero nuovo?». 217 suite, 3431 verdi.

- `[Sviluppo]` 🧭 **«Ordine del menu»: cinque difetti chiusi, e il backoffice adesso ha i test.**
  Nessuno era mai stato segnalato: sono usciti rileggendo `menuOrder.ts` per spiegare come funziona.
  ⚠️ Il più grave era **perdita di dati silenziosa**: `menuOrder` passava dalla `clean` comune a tutte
  le preferenze, che deduplica con un `Set` — giusto per le rotte, ma dall'11/8 i **titoli dei
  gruppi** vivono nella stessa lista, e due gruppi chiamati tutti e due «Vendite» producevano due
  righe identiche. La seconda spariva: i due gruppi diventavano uno, con dentro le voci di entrambi,
  senza un errore e senza un avviso — e chi lo subiva riprovava pensando di aver sbagliato lei. Ora
  `ordine-menu.ts` deduplica **solo le rotte**, fa `trim` («Vendite » e «Vendite» erano due gruppi
  diversi) e taglia a 64 caratteri **lato server**: ⚠️ la casella nell'editor ha `maxLength={24}`, ma
  il limite del browser non è un limite — vale per chi usa la schermata, non per chi parla con l'API.
  ⚠️ E il taglio viene **prima** del dedup, o due rotte lunghe uguali dopo il taglio resterebbero due.
  Poi: **l'icona segue le voci, non il titolo** (rinominare «CRM» in «Vendite» la faceva sparire, e
  nessuno collegava le due cose) — con il secondo criterio di ordinamento alfabetico di proposito, o
  l'icona di un gruppo misto cambierebbe da sola fra una visita e l'altra; via un `?? true` che **non
  scattava mai** e faceva credere che i gruppi a fisarmonica partissero aperti (partono chiusi, ed è
  voluto — ⚠️ col rovescio scritto nel commento: una pagina dentro un gruppo che si usa di rado è
  invisibile finché non ci si ricorda che quel gruppo esiste); e il **gruppo vuoto** ora dice
  nell'editor che non comparirà nel menu finché è vuoto, invece di sembrare un salvataggio fallito.
  ⚠️ **E il pezzo che stava sotto a tutti e cinque: il backoffice non aveva test.** Backend e app
  avevano i loro, il backoffice veniva solo *compilato* dalla CI — è il motivo per cui quattro
  difetti sono stati lì una settimana. Aggiunti vitest (stessa forma dell'app), il passo «Test» nella
  CI e `menuOrder.spec.ts` con 14 casi. I difetti 6 e 7 del foglio restano aperti di proposito: sono
  i più rari e costano una scrittura non richiesta.

- `[Sviluppo]` ✅ **Le tre code del catalogo passano da Vera, una riga per volta.** Richiesta di
  Simone: «se ci sono ricette da approvare, combinazioni da approvare, allergeni da approvare, vanno
  tutti inviati a vera che aiuta il nutrizionista a verificare uno per uno». Le tre code esistevano
  già, ma si svuotavano con tre pulsanti che agiscono **in blocco** sull'intera dieta — e ⚠️ un
  pulsante che verifica sessanta piatti in un colpo non verifica niente: è una firma in fondo a un
  foglio che nessuno ha letto. Ora si dice «approvazioni» (o si clicca la pastiglia in cima) e Vera
  porta una riga per volta, **con dentro cosa si sta approvando**: gli ingredienti della ricetta, gli
  alimenti del gruppo, il pasto e le calorie. ⚠️ **Gli allergeni vengono prima dell'accensione, e mai
  insieme sulla stessa ricetta**: finché sono da guardare, la domanda «la accendo?» non compare
  proprio — altrimenti un «sì» detto di corsa accende un piatto non verificato. ⚠️ E quella domanda
  non è nuova: è quella della voce 227, che la coda **chiama** invece di rifarla, con un marcatore
  perché a fine giro si torni in coda. ⚠️ **«Non lo so» è un salta, non un no**: su una coda di
  verifica il dubbio non è un rifiuto. ⚠️ **Il no non scrive niente** — una ricetta non approvata è
  già spenta, e inventare qui una cancellazione darebbe alla chat un potere che il pulsante
  equivalente non ha: si dice dove si cambia davvero. ⚠️ Si avanza perché la riga è stata **guardata**,
  non perché il database ha detto sì. Le scritture passano dalle porte di sempre (`updateRecipe`,
  `setRecipeAllergens`, `EquivalenceService.approve`). 56 test nuovi (215 suite, 3359 verdi).

- `[Sviluppo]` 🧱 **«Le ricette vanno sempre a riempimento delle settimane incomplete»** (Simone,
  18/8). Era già la regola del cron, ma la stessa domanda — «questa settimana è a posto?» — si
  rispondeva in due punti con due criteri: per il cron «magra» voleva dire *un pasto con meno di
  sette piatti diversi*, per il pulsante *genera* «fatta» voleva dire *esiste una giornata con quel
  numero*. ⚠️ E il conto delle settimane mente: quattro giornate scritte nella settimana 2 fanno «due
  settimane fatte», e da lì quella settimana resta a metà **per sempre** — il pulsante risponde «c'è
  già» e la generazione guarda avanti. Ora la risposta è una sola (`settimana-magra.ts`) e la
  chiamano tutti e due; il generatore legge le giornate e non più solo il giorno più alto; la
  settimana da fare è la prima magra, e «c'è già» si dice solo quando è davvero piena. ⚠️ Si contano i
  piatti **diversi**, non le giornate: 28 giornate con 19 piatti per pasto sono a posto per chi conta
  e sono la stessa colazione cinque volte al mese per chi mangia. ⚠️ Col suo rovescio a test: se la
  settimana chiesta è piena non si tocca niente. 12 test nuovi.

- `[Sviluppo]` 🤖 **«Non ho capito da dove vedo se le ricette vengono create»: il riquadro in cima
  alle Ricette.** Seconda domanda di Simone sul generatore, e aveva ragione: alla prima avevo
  risposto col battito e con `npm run diag:catalogo`, ma ⚠️ **una shell non è «vedere»**, e una
  diagnostica che nessuno lancia è una diagnostica che non esiste. Ora in cima alla pagina Ricette
  c'è un riquadro con le stesse informazioni, dove si guardano già: ultimo giro ed esito, ricette
  nate negli ultimi 7 giorni, quante aspettano gli allergeni — ⚠️ **col collegamento**, perché finché
  sono lì non entrano in nessuna dieta — giri, errori e settimane rimaste. Il giudizio sta in
  `stato-generatore.ts` con cinque esiti distinti, e ⚠️ **«mai partito» non è «tutto a posto»**: il
  messaggio manda a guardare su Render, non nel codice, e lo dice. ⚠️ «Fermo» vince sull'esito (se
  l'ultimo giro è di tre giorni fa, che sia andato bene non importa più) e dice **da quante ore**,
  non «da un po'». ⚠️ E questo riquadro **non sparisce quando va tutto bene**, al contrario di tutti
  gli altri: la domanda a cui risponde è «sta lavorando?», e un riquadro che compare solo quando c'è
  un problema risponde «non lo so» proprio a chi viene a controllare. 8 test (213 suite, 3292 verdi).

- `[Sviluppo]` 🍚 **Crudo o cotto: se la tabella ha due stati non si sceglie il primo — si chiede**
  (voce 228, chiusa col file caricato da Simone). La scheda «Crudo ↔ cotto» dà la misura: **farro
  perlato 353 kcal da crudo, 127 da bollito, rapporto 0,36×**. ⚠️ Dire il numero sbagliato non è
  un'imprecisione: sbaglia di quasi **tre volte**, sempre nello stesso verso. E `cerca` prendeva **la
  prima riga che combacia col nome**: con due righe «riso bianco» quale rispondeva lo decideva
  l'ordine di lettura del database. Ora se lo stato è scritto nella domanda si sceglie quella riga,
  se non c'è **non si sceglie**. ⚠️ Confronto per parola («crudo» dentro «crudité» non conta) e righe
  con lo stesso stato non sono ambigue, o l'avviso sarebbe diventato rumore. ⚠️ **E per strada è
  saltato fuori un difetto più vecchio e più grave**: `calcolaMacro` raccoglieva gli alimenti fuori
  tabella in `mancanti` — con un commento sopra che spiegava perché contano — e `raccontaMacro` **non
  li diceva mai**. Chi dettava una ricetta con dentro un alimento che non abbiamo leggeva un totale
  kcal più basso del vero, e niente glielo diceva. Ora si dicono, separati dagli ambigui perché
  portano a due azioni diverse. ⚠️ E le due tabelle sono **verificate riga per riga** contro i file
  di Simone: 96 + 57 righe, zero differenze.

- `[Sviluppo]` 📡 **Il generatore di ricette ora lascia un battito a ogni giro** (voce 279, dalla
  domanda di Simone «come facciamo a sapere se sta lavorando?»). La riga nel registro la lasciava
  solo la generazione **riuscita**, quindi ⚠️ i tre motivi per cui un giro finisce a mani vuote
  avevano lo stesso aspetto — nessuna riga: catalogo completo, AI fuori uso, e ⛔ **cron spento su
  Render**. Il terzo è quello che fa danno, perché un cron che non parte non lascia traccia da
  nessuna parte. Ora `cron.genera_catalogo` si scrive **sempre**, col motivo e con l'errore, in un
  `try` a parte (perdere una generazione per un battito sarebbe il rimedio peggiore del male). E
  nuovo **`npm run diag:catalogo`**: ultimo giro ed esito, giri ed errori nella finestra, settimane
  mancanti per variante, unità di lavoro rimaste, ricette nate e quante aspettano gli allergeni. ⚠️
  Senza **nessun** battito lo dice a chiare lettere, con le due cause in ordine di probabilità,
  invece di stampare zeri. ⚠️ Il conto delle settimane non è riscritto: `statoVarianti` è pubblica e
  la diagnostica chiama quella.

- `[Sviluppo]` 🎛️ **Dashboard: nessun modulo è fisso, i predefiniti si riconoscono, e c'è «Ripristina
  default»** (voce 278, dalla risposta di Simone). ⚠️ È la risposta giusta al problema dei blocchi
  fissi: invece di **togliere** la possibilità di spegnere un riquadro «perché poi non lo ritrova
  più», si dà **la strada di ritorno**. Un pulsante che rimette le cose a posto vale più di un
  divieto. ⚠️ E chiede conferma con se stesso invece che con un pop-up: un clic per sbaglio
  disferebbe la disposizione che qualcuno si è costruito. 33 test in tutto (212 suite, 3284 verdi).

- `[Sviluppo]` 📏 **La taglia del catalogo si calcola sulla mediana del fabbisogno delle clienti**
  (voce 273, chiusa con la risposta di Simone: «la taglia calorica va calcolata sulla base del
  fabbisogno della cliente»). Il generatore scriveva ogni pasto come `menu_daycombo_kcal_target ×
  quota` con un numero **fisso**, mentre l'erogazione punta al fabbisogno: ⚠️ chi sta sopra ~1765
  kcal riceveva giornate fuori banda **per costruzione, tutti i giorni**, e per lei nessun
  moltiplicatore di porzione cambia il fatto che le ricette sono scritte più piccole. Ora la taglia
  viene dalla **mediana** del fabbisogno delle clienti in corso su quel preset. ⚠️ **Mediana e non
  media, ed è tutto il modulo**: una cliente a 3200 in mezzo a dieci a 1600 sposterebbe la media a
  1745 e il catalogo con lei — dieci persone riceverebbero piatti pensati per una. ⚠️ Tre stati:
  senza clienti calcolabili resta la taglia del preset **e si dice il motivo**, perché un numero
  calcolato sul nulla ha lo stesso aspetto di uno calcolato bene. ⚠️ E si conta quante restano fuori
  banda **anche con la taglia scelta**, in tutt'e due i versi — su questo mi ha corretto un test:
  avevo scritto «due» guardando solo chi sta sopra, e sono tre, perché con la taglia a 1700 il
  pavimento è 1445 e anche la cliente a 1400 riceve piatti troppo grandi. È il numero che dice se
  serve una **seconda taglia** (`Diet.levels` nasce per quello, mai usato): la domanda resta aperta,
  ma ha una cifra davanti invece di un'impressione. ⚠️ **Vale solo per le bozze nuove**: le diete già
  approvate non cambiano, e la taglia arriva nel piatto quando la nutrizionista approva. Interruttore
  in `config_param` (`catalogo_taglia_dal_fabbisogno`). 12 test (211 suite, 3262 verdi).

- `[Sviluppo]` 🔁 **Il rilascio ora aggiorna il testo delle voci — tranne quelle corrette a mano
  dalla pagina** (voce 275, chiusa). ⚠️ **La domanda era scritta male**, e Simone l'ha detto («non
  capisco la domanda»): l'avevo posta da dentro il codice invece che dal caso vero. Il caso vero: la
  pagina tiene **la sua copia** del testo di ogni voce, e «Aggiorna dal rilascio» aggiungeva e
  spuntava senza toccare il testo di quelle già in elenco — mentre una voce si riscrive **a ogni
  giro**, perché si riscrive quando si scopre la causa vera. ⚠️ L'esempio che l'ha deciso: la
  bonifica delle email ha ripulito il file, e nell'estratto della pagina l'indirizzo di una cliente
  era ancora lì. Ora il testo si riscrive, ⛔ **tranne** dove l'ha scritto una persona dal backoffice:
  quelle non si toccano e si dicono a parte, perché una correzione che sparisce al rilascio dopo, in
  silenzio, sarebbe lo stesso difetto spostato di un metro — e questa è la pagina che serve a non
  farlo succedere altrove. ⚠️ `updatedAt` **non bastava**, ed è il motivo della colonna: lo muovono
  anche la spunta e la risposta, quindi una voce spuntata sarebbe risultata «toccata a mano» e
  avrebbe smesso di aggiornarsi — il difetto sarebbe tornato, solo più difficile da vedere. ⚠️ Si
  riscrivono **solo titolo e dettaglio**: categoria e ordine restano dove qualcuno li ha messi, o le
  voci si sposterebbero sotto gli occhi di chi le sta guardando. 3 test (3250 verdi). ⚠️ **Migrazione
  additiva** `20260818120000_lavoro_testo_a_mano`.

- `[Sviluppo]` 🥄 **«Vera vince sempre su Gaia»** (voce 264, chiusa con la risposta di Simone alla
  domanda «se la nutrizionista detta una spezia, cosa si fa?»). Le due porte di Vera —
  `scriviRestrizione` e `applicaRestrizione` — non passano più da `filtraSpezie`: chi detta è la
  professionista che firma le diete. ⚠️ **Ma l'altra metà di quella funzione resta, e la distinzione
  è tutto il lavoro**: `filtraSpezie` faceva due cose attaccate — **scartare** (una decisione di
  prodotto, e Vera la vince) e **spezzare** (correggere la forma di un dato perché continui a
  funzionare, che non c'entra col permesso di nessuno). «pepe, ceci» in una riga sola non compare in
  nessun piatto e smette di escludere — il caso del 17/8 — e sulla coorte si moltiplica per N
  profili. Confonderle avrebbe dato a Vera il potere di scrivere un tag rotto, che non è quello che
  «Vera vince» vuol dire. ⚠️ E il pool che si stringe resta **detto**: l'anteprima glielo mostra
  prima che scriva. 2 test.

- `[Sviluppo]` ⭐ **Le tre stelle messe dall'app ora si riconoscono** (voce 270, metà chiusa).
  Risposta di Simone: «se il cliente non specifica metti 3 stelle» — quindi **cosa si scrive** è
  deciso e non cambia. ⚠️ Ma quel 3 era **indistinguibile** da un 3 vero e finiva nel segnale
  «gradimento» che decide cosa il motore ripropone: chi diceva soltanto «non l'ho seguita»
  risultava averle dato tre stelle. Da oggi il popup aggiunge il tag **`stelle_non_date`** — il tag
  `seguita`/`non_seguita` da solo non bastava, perché c'è anche quando le stelle le ha date davvero.
  Non cambia niente per nessuno oggi: cambia che il dato è recuperabile e che il conto si può fare.
  ⛔ **Torna a Simone la seconda metà, ora con un numero davanti**: quel 3 marcato deve contare nel
  gradimento, o va escluso? Scriverlo è una riga; deciderlo no, perché sposta cosa arriva nel piatto.

- `[Sviluppo]` 📝 **Le esclusioni scritte come frasi ora vengono dette a chi le scrive** (voce 267,
  chiusa con la risposta di Simone: «le esclusioni devono essere un elenco, ogni parola seguita da
  una virgola, aiutiamo le clienti a scrivere in modo corretto»). Il campo accetta **frasi** e il
  motore legge **alimenti**: «pesce tranne salmone, tonno» non toglieva niente, e spezzato sulla
  virgola rendeva escluso il **tonno** — l'opposto di quello che la cliente aveva scritto, visto che
  lo elencava fra le eccezioni. Nuovo `common/esclusioni-scritte-bene.ts`: riconosce eccezioni,
  frasi e voci troppo lunghe, e torna la frase da mostrare. ⚠️ **Non corregge niente**, ed è la
  scelta che conta: su «pesce tranne salmone» la correzione più ovvia — tenere la prima parola —
  escluderebbe **tutto il pesce, salmone compreso**, cioè di nuovo il contrario. Chi ha scritto la
  frase è l'unica persona che sa cosa intendeva, e a lei si chiede; sulle frasi invece il
  suggerimento c'è («Volevi scrivere «cicoria»?»), perché lì non è indovinare. ⚠️ Il messaggio dice
  **cosa succede davvero** — «così com'è non toglie niente dal menu» — e non «formato non valido»:
  chi legge la seconda corregge la forma, chi legge la prima capisce cosa sta perdendo. ⚠️ Una
  parola di eccezione dentro un'altra non conta («marmellata» non contiene «ma»), o l'avviso avrebbe
  segnalato mezzo catalogo al primo giro. Quattro porte (profilo in app col testo che torna nel
  campo, pulsante «non gradisco», scheda backoffice, scheda coach), e ⚠️ l'avviso spezie e questo
  **si sommano** invece di coprirsi. La regola vive nel backend: nell'app sarebbe stata una seconda
  copia. ⛔ Resta fuori il **questionario**, che è la porta d'ingresso vera.

- `[Sviluppo]` 🧭 **«Quello che aspetta me»: c'è anche il pool sotto soglia** (voce 211, chiusa). La
  §13.3 chiedeva quattro moduli, il quarto mancava e la voce diceva «prima va deciso QUANDO
  calcolarlo». ⚠️ **Il pool non è della cliente: è della dieta.** Le esclusioni sono sue, il pool no
  — e le diete sono poche: si leggono i pool **una volta per dieta**, poi il conto è aritmetica in
  memoria, e la domanda si può fare a ogni apertura invece che in un lavoro notturno con un numero
  vecchio di ore. Nuovo `vera/clienti-pool-scoperto.ts` che **riusa** `calcolaPool` e non una sua
  copia. ⚠️ Tre stati e tre chip: «N col pool sotto soglia», «N da guardare a mano» (senza dieta: non
  è a posto, è **non lo so**) e «pool non calcolato» quando il conto fallisce. Contare le non
  valutabili fra le sane darebbe un numero rassicurante e falso. 37 test in tutto (3247 verdi).
  Nessuna migrazione.

- `[Sviluppo]` 🔬 **Indice glicemico: la trascrizione è verificata riga per riga contro la tabella
  vera — 96 su 96, zero differenze.** Simone ha caricato il file originale in xlsx e l'ho confrontato
  con `prisma/dati-ig.ts`, campo per campo: nome, categoria, stato, IG, IG min, IG max, kcal,
  proteine, carboidrati, grassi, fibre, affidabilità. **Nessuno scostamento, nessuna riga mancante,
  nessuna riga inventata.** ⚠️ Era la verifica che mancava, e non è una formalità: sono 96 righe di
  dati clinici trascritte a mano da un PDF, e un refuso su una kcal sarebbe finito dritto in quello
  che Gaia dice alle clienti. Il codice c'era da allora — `dati-ig.ts` e `npm run importa:ig` — e il
  crudo/cotto è sciolto perché **ogni riga porta lo stato esplicito**: la pasta lì è BOLLITA (158
  kcal/100 g), e usare il valore da crudo sbaglierebbe di due volte e mezzo. ⛔ **Resta solo da
  lanciarlo in produzione**: `npm run importa:ig` per l'anteprima, poi `CONFERMA=1`.

- `[Sviluppo]` 🧹 **Tre pulizie: i doppioni in pagina, il cartello di Vera, e lo script per spostare
  percorso.** ① **Voce 224** — il 13/8 le voci di Vera erano finite due volte nel file con chiavi
  diverse; il doppione è stato tolto, ma il caricamento era già girato e in pagina restavano tre
  righe aperte che duplicano voci esistenti. ⚠️ Marcarle `fatta: true` e basta non bastava: se in
  pagina **non** ci fossero, il caricamento le **creerebbe** — tre voci nuove già spuntate, cioè
  spazzatura scritta per pulire spazzatura. Nuovo campo `soloSeEsiste`: «se la trovi spuntala, se non
  c'è non è mai esistita». Non si cancella niente (in pagina può esserci sopra il commento di
  qualcuno) e queste righe non compaiono fra i «testi da allineare», che sarebbe rumore. ② **Voce
  231** — `HANDOFF_Vera_Sessione.md` esiste (308 righe): non è un lavoro, è un cartello da leggere
  prima di toccare `backend/src/vera/`, e resta in elenco perché si legga. ③ **`npm run
  sposta:percorso`**, lo strumento per la risposta di Simone su Maria («spostiamola su Mediterranea
  3 pasti»): è una scrittura in produzione, quindi la lancia lui. ⚠️ Scritto **generico**: uno script
  con un nome dentro è uno script che si riscrive la volta dopo, e la volta dopo qualcuno
  copia-incolla e sbaglia una riga. ⚠️ `SOLO` obbligatorio — uno script che cambia il percorso di
  tutte le clienti se lanciato senza argomenti non è uno strumento, è una trappola. ⚠️ Azzera
  `fastingWindow` fuori dal digiuno (lasciarla sarebbe un dato che torna ad agire mesi dopo) e dice
  **quante giornate future sono già scritte**, che restano costruite sul percorso vecchio finché non
  si rigenerano. 4 test (3210 verdi). **Dopo il deploy: «Aggiorna dal rilascio» nella pagina Lavori.**

- `[Sviluppo]` ⚖️ **Le porzioni si scalano sul fabbisogno: dal 65% al 100%** (voce 255, strada C).
  Decisione di Simone: «va riproporzionato il pasto correggendo le quantità in base al fabbisogno».
  Il buco: le ricette nascono dimensionate sulla giornata di **catalogo** (1500 kcal), l'erogazione
  punta al **fabbisogno**, e quando la finestra del digiuno toglieva dei pasti quello che restava
  non si ingrandiva — chi salta la cena riceveva il 65%, chi salta cena e colazione il 45%. Nuovo
  `menu/porzione-scalata.ts`: fattore **uniforme** con un **tetto per tipo di pasto** (principali
  ×1,8, colazione ×1,6, spuntini ×1,25, tutti e tre in `config_param`). ⚠️ Per tipo e non uno solo:
  a ×1,6 uno spuntino da 160 kcal diventa 256, e non è più uno spuntino. ⚠️ E chi non è al tetto
  cresce **della stessa percentuale** di chiunque altro non sia al tetto — il rapporto fra colazione
  e pranzo lo ha deciso la dieta, non noi. È la sfumatura che ho sbagliato alla prima scrittura:
  «in proporzione al margine» dava 478/193/929 invece di 509/200/891, cioè spostava cibo dalla
  colazione al pranzo senza che nessuno l'avesse deciso; l'ha bocciata un test, non una rilettura.
  ⚠️ **Non si rimpicciolisce mai**: scalare all'ingiù toccherebbe il menu di tutte le clienti sotto
  i 1500 kcal, ed è una decisione clinica diversa. ⚠️ La scalatura è **l'ultimo passo prima della
  misura**: la giornata la riscrivono la ripetizione bigiornaliera, le «ricette semplici» e il cambio
  dei piatti non graditi, e tutti e tre ricostruiscono i pasti campo per campo — scrivendo il fattore
  prima, lo butterebbero via senza un errore. ⚠️ E `daily_kcal_below_target` cambia significato: da
  oggi è «resta corta **anche col moltiplicatore al tetto**», più raro e più grave; i due test che lo
  difendevano sono stati **riscritti col significato nuovo**, non cancellati. Le `kcal` dello
  snapshot sono **già scalate** (l'app somma i totali da lì in tre schermate: il fattore a parte le
  avrebbe rese sbagliate in silenzio), con `kcalBase` e `porzione` accanto. Toccata anche la **lista
  della spesa**, che sommava le grammature di catalogo — la cliente comprava il cibo della porzione
  piccola e a metà settimana finiva: un errore che non si vede nell'app, si vede in cucina. E si
  legge: riga «Porzione più abbondante ×1,8 — pesa gli ingredienti per 1,8 volte» nel menu, pastiglia
  «×1,8» nella scheda del backoffice. ⛔ **Resta**: la scheda ricetta con le grammature di catalogo
  (per ora la colma la frase in app), i giorni già erogati, il kit di rientro, la lista della spesa
  già in cache, e ⚠️ **i pezzi** — ×1,5 di una mela è una mela e mezza, e il numero esce così com'è
  invece di essere arrotondato di nascosto: quella è una decisione della nutrizionista. 29 test (208
  suite, 3206 verdi; app 89). Nessuna migrazione.

- `[Sviluppo]` 🛡️ **Gli allergeni vincono sulle modifiche: cambiare gli ingredienti azzera la
  conferma.** Voce 252, chiusa con la risposta di Simone («gli allergeni vincono sempre sulle
  modifiche; in caso venga data una sostituzione incompatibile va segnalato»). Il difetto:
  `catalog.updateRecipe` scriveva `ingredients` **senza toccare** `allergensReviewed`, quindi una
  ricetta a cui qualcuno cambiava gli ingredienti restava «confermata» con la firma di un piatto
  diverso — e `collegaRicetta` la lasciava entrare nelle diete perché il campo diceva di sì. Una
  conferma è una firma su un contenuto: cambiato il contenuto, la firma non vale più. ⚠️ **Decade
  sui NOMI degli ingredienti, non su qualunque salvataggio**, ed è il modo di applicare «vincono
  sempre» che protegge davvero: una quantità non può introdurre né togliere un allergene, mentre
  azzerare per un peso corretto toglierebbe il piatto dai menu senza aggiungere un grammo di
  sicurezza. Confronto fra **insiemi di nomi** normalizzati: l'ordine non conta, e ⚠️ **stesso
  numero con uno scambiato conta** — la scorciatoia sulla lunghezza della lista avrebbe lasciato
  passare farina→mandorle. ⚠️ Ingredienti illeggibili: si azzera, perché su un campo di sicurezza
  «non ho capito» vale «non è confermato», mai il contrario. ⚠️ E un salvataggio che non manda
  `ingredients` non fa decadere niente: senza quel ramo, cambiare il **titolo** di una ricetta le
  avrebbe tolto la conferma. ⚠️ **Non è retroattivo**: vale dalla prossima modifica, così il
  catalogo non si svuota di colpo. Chi salva lo **legge** — la pagina Ricette dice la conseguenza
  («NON entra nei menu nuovi»), dove si rimedia e che i menu già consegnati non cambiano — e resta
  nel registro modifiche, perché chi un domani si chiede «perché questa ricetta è sparita dai menu?»
  deve trovare la risposta. **Sulla seconda metà della risposta**: verificato che è già vera su
  tutt'e due le porte — il dialogo di Gaia ferma il sostituto che tocca un allergene dichiarato e
  passa la mano a una persona, il pulsante «non gradisco» dell'app passa da `evaluateMeals`. Non ho
  aggiunto niente lì: lo scrivo perché «verificato» vale come risposta solo dicendo dove si è
  guardato. 15 test (207 suite, 3179 verdi). Nessuna migrazione.

- `[Sviluppo]` 👁️ **Due dei sei dati che l'app riceveva e non mostrava: adesso si vedono** (voce 253,
  restano i tre grossi). ⚠️ **`since` di `/me/measurement-gate`**: il backend lo manda da sempre e
  nessuna schermata lo leggeva. Il riquadro diceva «App in pausa — contatta la tua coach», che è uno
  **stato senza storia**: chi lo legge non sa se è successo stamattina o se va avanti da una
  settimana, e non ha modo di capire quanto sta perdendo. Ora dice da quanto il menu è fermo — «da
  ieri», «da 5 giorni», «da 2 settimane» — e ⚠️ **tace quando la data non c'è**, invece di scrivere
  «da 0 giorni»: non saperlo e «è appena successo» sono due cose diverse. I giorni si contano per
  **calendario** e non a multipli di 24 ore: bloccata alle 23 e riaperta alle 8, per lei è «da ieri»,
  non «da oggi». ⚠️ E nella frase «inserisci qui le misure» viene **prima** di «contatta la tua
  coach»: mandarla ad aspettare una risposta per una cosa che le costa trenta secondi è farle perdere
  un altro giorno di menu. ⚠️ **`thighsCm`**: lo staff poteva registrarle una circonferenza cosce che
  lei non avrebbe **mai** visto — il campo c'era in banca dati, nel form del backoffice e nella
  risposta di `GET /me/measurements`, e si fermava all'interfaccia TypeScript dell'app. Ora la vede
  nell'andamento **e la può scrivere**: mostrarla soltanto avrebbe lasciato un dato misurato sul suo
  corpo che governa solo lo staff, e la porta era già aperta (`CreateMeasurementDto` accetta
  `thighsCm` da sempre) — mancava la casella. Nessuna barra «verso il tuo obiettivo» per le cosce:
  `targetThighsCm` non esiste, e una barra senza traguardo misura la distanza da niente. ⚠️ Toccate
  **entrambe** le strade di salvataggio, inserimento e correzione: una sola avrebbe voluto dire che
  correggere una misura cancella le cosce appena scritte. 8 test (app: 11 file, 85 test verdi).
  Nessuna migrazione.

- `[Sviluppo]` 🍽️ **Digiuno senza finestra: la domanda non era mai stata fatta, e ora è un'attività
  della coach.** Voce 256, chiusa. ⚠️ Prima di tutto il resto: **il motore non è rotto** — senza
  finestra non si salta niente e arriva il 16:8 classico, che è il valore di scorta sensato
  («dovrebbe ricevere tutti e cinque i pasti» era una frase del mio primo script, falso positivo
  corretto il 17/8). Il difetto è più difficile da vedere: la finestra decide **quali pasti mangia**,
  e per lei l'ha decisa un valore di scorta. Il questionario la chiede, obbligatoria, da agosto:
  restavano fuori le clienti di prima. ⛔ **Scartato di farla chiedere a Gaia**: «quali pasti
  preferisci saltare?» arrivato a freddo, a chi mangia così da mesi, è una domanda che si risponde
  male — la risposta giusta dipende da come sta e da cosa le hanno detto in visita. Non è un dato da
  riempire, è **una conversazione da avere**, e il progetto ha già il posto dove una cosa da fare
  diventa lavoro di una persona. Nuova attività della coach dal cron notturno, per chi è in digiuno
  senza finestra **e ha un abbonamento attivo** (aprirla su chi ha finito il percorso mesi fa è il
  modo più rapido di insegnare alla coach a ignorare la colonna), con `refId` **fisso**: si chiede
  una volta sola. ⚠️ E il testo dice **cosa succede intanto** — «NON è ferma e non è rotta, riceve
  tutti i pasti della sua dieta» — perché «manca la finestra» letto da solo suona come un guasto, e
  una coach che chiama allarmata una cliente che sta bene fa più danno del dato mancante. Nel
  backoffice la finestra vuota non si legge più «li decide la dieta», che sembrava una scelta: ora è
  «⚠️ mai chiesta». Nell'app la card compariva coi pallini tutti spenti e nessuna spiegazione: ora
  dice che la domanda non c'era quando si è iscritta e a cosa serve dirlo — ⚠️ **senza promettere
  che le calorie del pasto saltato finiscono negli altri**, che non è vero finché la voce 255 è
  aperta. 8 test (206 suite, 3164 verdi). Nessuna migrazione.

- `[Sviluppo]` 💬 **Gaia ripeteva la stessa domanda all'infinito a chi non rispondeva: ora la chiude
  lei.** Segnalazione di Simone, con la chat di una cliente sotto gli occhi: tre volte di fila
  «Certo […], vediamo insieme. Quale alimento vuoi cambiare?» — 10/8 alle 13:07, 11/8 alle 16:00 e
  ancora — e in mezzo **nessuna risposta**. ⚠️ Ma non era Gaia che insisteva, e la ricostruzione
  conta perché cambia il rimedio: **nessun cron scrive quel messaggio**, lo scrive il pulsante
  «Sostituisci» della home. Erano **tre aperture**: la cliente tocca, legge — nel messaggio c'è
  anche il menu del giorno, che è metà del motivo per cui uno lo tocca — e se ne va. Il dialogo
  scade dopo un'ora, quindi l'apertura dopo riparte da zero e non sa di aver già chiesto. Ora la
  domanda rimasta senza risposta per 24 ore la chiude Gaia, dicendo che ha capito e **che si può
  ricominciare quando vuole** — senza quest'ultima riga, «ho capito che non ti interessa» è una
  porta chiusa in faccia a chi si era solo distratta. ⚠️ **Chiude il tempo, non un altro tocco del
  pulsante**: la strada alternativa — alla terza apertura rispondere con la chiusura — le direbbe
  «capisco che non ti interessa più» nell'istante esatto in cui sta chiedendo. E chiudendo a tempo
  la seconda domanda identica non arriva nemmeno. ⚠️ Nessuna tabella nuova e nessun contatore: **il
  marcatore è la riga**, come per la campagna allergie — `meta.sost` esiste solo finché il dialogo
  aspetta qualcosa, e il messaggio di chiusura non ce l'ha, quindi chiude il dialogo **ed** è ciò
  che impedisce di richiuderlo domani notte. ⚠️ Due guardie sul primo giro dopo il rilascio, che
  trova tutto l'arretrato: finestra di **30 giorni** all'indietro (svegliare qualcuno per una
  domanda di marzo non è chiudere una conversazione, è aprirne una) e **tetto di 100 per giro,
  dichiarato nell'esito** — un tetto silenzioso fa sembrare finito un giro che ne ha lasciate
  indietro cento. Soglia in `config_param` (`chat_chiusura_silenzio_ore`). Passo del cron
  **notturno** e non dei `reminders`, che girano ogni dieci minuti: questo scrive alla cliente, e
  c'è un test che tiene ferma anche questa. 26 test (205 suite, 3156 verdi). Nessuna migrazione.
  **Voce 277.**

- `[Sviluppo]` 🔒 **Le email di otto clienti erano nei file del repository, e il repository è
  pubblico.** Trovata guardando `docs/` per il workflow Pages rosso, quindi fuori da qualunque
  lavoro programmato. Gli indirizzi di **otto clienti reali** stavano in **21 file versionati** —
  i `REGISTRO_*.md` in radice, `progetto/` (REGISTRO, handoff, note, un `COMMIT_parte_*`), quattro
  script `prisma/diag-*`, `voci-iniziali.ts`, `struttura-per-digiuno.ts` e **tre file di test** —
  arrivati lì un po' per volta, ogni volta con la buona ragione di «così si capisce di chi si
  parla». ⚠️ Il problema non è l'email da sola: accanto c'erano **nome, finestra del digiuno,
  fabbisogno calorico, cibi non graditi**. Email + nome + dato sulla salute è la categoria che il
  GDPR protegge di più (art. 9), su un repository che chiunque può clonare. ⚠️ **E ci ho messo del
  mio**: il 17/8 sera ho scritto io uno di quegli indirizzi in
  `COMMIT_parte_bonifica_solo_email.txt`, seguendo la convenzione che trovavo nei file senza
  fermarmi a chiedermi se fosse giusta — è il difetto di famiglia visto dal di dentro, un dato che
  agisce e non si vede perché nessuno lo guarda mai come dato. **Fatto:** le 37 occorrenze
  sostituite con il **nome di battesimo** (Sonia, Maria, Giusy, Patty, Simona, Lorenzo, Gioia,
  Ilaria), i comandi d'esempio con un segnaposto — `cliente@esempio.it` negli script dove l'esempio
  è generico, `<email di Nome>` dove serve sapere di chi si parla perché quel comando va ancora
  lanciato — e via anche i **cognomi** dei clienti («Lorena Polidoro» → «Lorena», «Gioia Lurve» →
  «Gioia», «Ilaria Stefani», «Giusy Vita»), che erano rimasti in 16 file fra codice, registri e
  `lavori-storico.json`. ⚠️ **Ripulire i file non toglie il dato dallo storico**: `git log -p` ce
  l'ha ancora, e su un repository pubblico è leggibile come prima. Le due strade che chiudono
  davvero sono **rendere privato il repository** (immediata, un clic nelle Settings) o
  **riscrivere lo storico** con `git filter-repo` (invasiva: cambia tutti gli hash, serve un
  force-push e chi ha un clone deve riclonare) — ⛔ è una scelta di Simone, non una cosa da fare di
  iniziativa. **La regola da qui in avanti:** nei documenti e nei commenti si scrive il nome di
  battesimo o l'id interno, mai l'indirizzo; gli indirizzi restano solo dove servono a far girare
  qualcosa (`.env`, il seed, gli alias `+test` di Simone). ⚠️ E perché la regola non dipenda dalla
  memoria di nessuno, nuovo `common/email-nei-file.ts` + **una guardia che passa in rassegna i
  file versionati** (`git ls-files`) e diventa **rossa** se un indirizzo di un dominio di posta
  vero rientra, dicendo file e riga. Provata al contrario: rimessa un'email finta in
  `progetto/DA_FARE.md`, il test è diventato rosso indicandola. 8 test nuovi (204 suite, 3128 test
  verdi). Nessuna migrazione. **Voce 276.** ⚠️ Restano nel repository i **nomi e cognomi dello
  staff** (coach, responsabili) nei registri e in `lavori-storico.json`: sono dati di lavoro, molto
  meno esposti di un dato sanitario, ma se il repository resta pubblico vanno guardati anche
  quelli — non l'ho fatto di iniziativa perché toglierli costa in leggibilità e la decisione è di
  Simone.

- `[Sviluppo]` 📐 **`diag:porzioni` conta anche «LE TAGLIE»: per quante persone servirebbe un secondo
  catalogo.** Coda della scoperta di prima (voce 273): il catalogo ha **una** taglia calorica, la dieta
  se la porta scritta in `Diet.levels[0].kcal`, e l'erogazione punta al fabbisogno — chi sta sopra
  riceve corto per costruzione. La decisione che ne segue, cioè **se fare una seconda taglia**, dipende
  da un numero solo: **quante persone stanno sopra**. Se sono due è un caso da gestire a mano; se sono
  un terzo del parco è una funzionalità mancante. Ora l'ultimo blocco della diagnostica lo dice: per
  ogni cliente il **fabbisogno**, la **taglia del catalogo che riceve** (col nome della dieta) e il
  **rapporto** fra i due, con dentro solo chi sta **oltre il bordo della banda** (fabbisogno > taglia ÷
  0,85) — sotto quel confine il motore una giornata giusta la compone e non c'è niente da decidere.
  ⚠️ E la riga che conta, scritta nell'output: **per loro nessun moltiplicatore di porzione cambia il
  fatto che le ricette sono scritte più piccole**. Il moltiplicatore porta alle calorie giuste
  moltiplicando le grammature, la seconda taglia ci porta con piatti pensati per quella misura: sono
  due risposte diverse, e la tabella serve a scegliere sapendo su quante persone si sta decidendo.
  ⚠️ Le diete senza livelli dichiarati si contano a parte: da lì non si può dire niente. Sola lettura,
  nessuna migrazione, 3120 test in 203 suite.

- `[Sviluppo]` 🗂️ **«Aggiorna dal rilascio» non riscrive il testo delle voci già in elenco: adesso lo
  dice.** Voci 274 (chiusa) e 275 (aperta), da una domanda di Simone — «la lista lavori la stai tenendo
  allineata?». La risposta onesta era **sì per il file, no per la pagina**: il file è allineato (20 voci
  dalla 254 alla 273, nessun buco, nessun duplicato, ogni consegna del 17 e del 18/8 ha la sua), ma
  `caricaVociIniziali` fa **due** cose — crea le voci mancanti e spunta quelle che il file dà per
  finite — e il **testo** no. ⚠️ Quindi quando nel file un titolo o un dettaglio cambiano, e succede a
  ogni giro perché una voce si riscrive appena si scopre la causa vera, in pagina resta la versione di
  prima e chi legge crede di leggere l'ultima parola. Oggi stesso: la voce 255 riscritta due volte, la
  272 corretta stamattina. Un aggiornamento che non arriva e nessuno lo dice: la stessa famiglia di
  tutto il resto. ⚠️ **Non si riscrive di nascosto**, perché la pagina è **lo stato vivo** e una voce
  può essere stata corretta a mano dal backoffice: si **mostra**. Il riepilogo del pulsante ora elenca
  le voci il cui testo nel rilascio è più recente, dicendo che qui non viene riscritto — e il «non c'è
  niente da allineare» non compare più quando invece c'è qualcosa da sapere. 3 test, fra cui che
  **segnalarle non è aggiornarle** (nessuna scrittura tocca titolo o dettaglio). ⛔ La seconda metà è di
  Simone (voce 275): se si vuole che il rilascio porti anche i testi, bisogna decidere cosa fare di una
  voce corretta a mano in pagina — e la stessa domanda vale per `categoria` e `ordine`. Backend 3120
  test in 203 suite, backoffice verde, nessuna migrazione.
  ⚠️ *Questa voce è stata scritta in ritardo di un commit: il ponte verso il Mac era fermo quando la
  consegna è stata fatta, e il commit `e6c297e` è partito senza. È il motivo per cui compare qui sotto
  a una consegna più recente.*

- `[Sviluppo]` 🎯 **Il catalogo ha UNA taglia calorica (1500) e l'erogazione punta al fabbisogno: chi
  sta sopra riceve corto per costruzione.** Voce 273, e ⚠️ **questa domanda viene prima del tetto del
  moltiplicatore** (voce 255). Nata leggendo `diag:porzioni` in produzione — 84 giornate, 18 clienti,
  5 sotto banda, **quattro su cinque senza digiuno e senza spuntini tolti** — e poi **verificata nel
  codice, non dedotta dai numeri**: le ricette del catalogo le dimensiona `menu_daycombo_kcal_target`
  («Kcal target delle bozze generate», default **1500**, 1600–1800 in tre preset) e il generatore
  scrive ogni pasto come `targetKcal × quota`; l'erogazione invece punta al **fabbisogno della
  cliente**, e `DayCombo` compone dentro un pool che **giornate più grandi non le contiene**. ⇒ **chi
  ha un fabbisogno sopra ~1765 kcal** (1500 ÷ 0,85, il bordo della banda) **riceve giornate fuori banda
  per costruzione, tutti i giorni**. I numeri tornano quasi esattamente: 53% → ≈2830 kcal di
  fabbisogno, 60% → ≈2500, 72% → ≈2080, 75% → ≈2000. Antonio è al 53% su **nove giornate su nove**.
  ⚠️ La descrizione del parametro dichiara la separazione («non cambia i menu già erogati: quelli
  seguono il fabbisogno della cliente»), ma cosa succede quando le due non coincidono non era scritto
  da nessuna parte — e fino al segnale del 17/8 non lo diceva nessuno. ⚠️ E lo schema aveva già
  previsto la risposta: `Diet.levels` nasce come **più taglie** per la stessa dieta, e il livello 2 non
  esiste (315 diete a livello 1). **Cosa cambia per la strada C**: non è un cerotto per il digiuno, è
  il meccanismo che manca per servire **un** catalogo a **più** fabbisogni — ma il tetto cambia
  significato, perché ×1,54 per tre giorni di finestra è una porzione più generosa, mentre **×1,89 su
  ogni piatto di ogni giorno è un altro piano alimentare**, con la lista della spesa che raddoppia.
  Tre strade nella voce (seconda taglia di catalogo · porzione scalata · alzare il parametro e
  rigenerare); la proposta è **le prime due insieme**, con un tetto piccolo (×1,2–1,3). Analisi in
  `progetto/DECISIONE_Porzioni_Scalate_Strada_C.md` §3-bis. Nessun codice di produzione.

- `[Sviluppo]` 🔎 **La prima lettura vera delle porzioni, e due correzioni alla tabella che la mostra.**
  84 giornate erogate, 18 clienti, **5 con giornate sotto la banda del fabbisogno**. ⚠️ E il risultato
  non è quello che il foglio si aspettava: **quattro casi su cinque sono «nessuna esclusione: è il
  catalogo»** — niente digiuno, niente spuntini tolti da Vera. Per quelle persone il **moltiplicatore
  di porzione (strada C) non è la cura**: sarebbe un cerotto su un catalogo che non arriva al loro
  fabbisogno. Il quinto è in digiuno `skip_breakfast`, che secondo la tabella del foglio dovrebbe
  valere il **100%** delle kcal e invece sta al **75%**: è la stessa domanda. (Una delle cinque è
  l'account di revisione del Play Store, non una cliente.) ⚠️ **Due correzioni alla diagnostica, a
  caldo**: il verdetto sul tetto giudicava contro il **100%** e non contro la **banda** — con ×1,6 una
  cliente al 60% arriva al 96% e leggeva «NON basta», cioè faceva sembrare quel tetto peggiore di
  quanto sia, proprio nella tabella scritta per deciderlo; ora gli esiti sono tre (arriva al 100% ·
  dentro la banda · resta corta) e il riepilogo li conta separati. E mancavano i numeri che spiegano il
  caso: aggiunte le colonne **target**, **giornata più corta** in kcal e **sesso**, senza le quali non
  si distingue una giornata corta *per la finestra* da una corta perché il catalogo è dimensionato più
  in basso del fabbisogno di quella persona. Nessuna scrittura, nessuna migrazione.

- `[Sviluppo]` 📏 **`npm run diag:porzioni`: misura le giornate GIÀ erogate, senza aspettare che
  qualcuno apra l'app.** Voce 272, e nasce da un'esecuzione vera: `diag:kcal` legge gli **eventi** che
  l'erogazione scrive **quando eroga**, quindi risponde solo per chi ha aperto l'app dopo il rilascio
  del segnale — e alla prima prova, giustamente, non sapeva niente. Questa guarda i **giorni già in
  banca dati** e risponde oggi. ⚠️ **Il giudizio non è riscritto**: chiama `giornateSottoTarget`, la
  stessa funzione del motore, e il target lo calcola `KcalNeedService`, la stessa classe che usa
  l'erogazione — allo script si passa solo la porta per leggere i `config_param`. Due risposte diverse
  alla stessa domanda sarebbero un difetto, non un metodo diverso: è la lezione del 17/8, quando il
  motore e `diag:digiuni` si sono contraddetti in un pomeriggio. Per cliente stampa il **perché**
  (finestra del digiuno, spuntini tolti, o «è il catalogo»), la **quota peggiore**, il **fattore
  necessario** e se il tetto che stai provando basta — cioè i numeri con cui si rispondono le due
  domande cliniche della voce 255. ⚠️ E **dice i suoi due limiti**: si confrontano giornate già erogate
  col fabbisogno di **oggi** (se peso o obiettivo sono cambiati, il numero di ieri è misurato col metro
  di adesso — va bene per scegliere un tetto, non per dire a una cliente cosa ha mangiato), e le
  clienti **senza fabbisogno calcolabile** si contano a parte, perché per loro il motore usa le kcal
  del livello: non è un ✓, è un «non lo so». Nessuna scrittura, nessuna migrazione, 3117 test in 203
  suite.

- `[Sviluppo]` ✅❓ **«Nessuna giornata sotto il fabbisogno ✓» diceva ✓ anche quando non lo sapeva.**
  Voce 271, trovata alla **prima esecuzione in produzione** di `diag:kcal` — il giorno dopo averlo
  scritto. Zero eventi, e lo script ha stampato il ✓. ⚠️ Quel ✓ non era vero, era **«non lo so»**: il
  segnale scatta **all'erogazione**, e l'erogazione gira quando la cliente apre l'app — senza consegne
  nella finestra, zero eventi non dice niente sulle calorie di nessuno. Una diagnostica che mostra la
  faccia del «va tutto bene» su una domanda a cui non ha risposta è il difetto di famiglia di questo
  progetto, fatto con le nostre mani a ventiquattr'ore di distanza dalla riga in cui lo denunciamo.
  Ora gli stati sono **tre**, e il numero che li distingue è quante **giornate sono state erogate**
  nella finestra: nessuna erogazione → «non lo so, e non vuol dire che le calorie siano a posto»
  (con il suggerimento di allargare a `GIORNI=30`); erogazioni ma nessun evento → ✓ **col numero delle
  erogazioni accanto**, che è la prova che il controllo ha avuto occasione di scattare; eventi → la
  tabella. ⚠️ **E la seconda metà**: la scrittura dell'evento stava dentro un `.catch(() => undefined)`,
  quindi una scrittura fallita sarebbe stata **indistinguibile da un ✓** — `diag:kcal` legge solo
  quegli eventi. Ora degrada come prima (l'erogazione non si ferma per una riga di analytics) ma **lo
  scrive nei log**, e la stessa cura è andata al gemello `fasting_meals_missing`, che aveva lo stesso
  silenzio dal 17/8. Un test tiene fermo che il menu si eroga lo stesso **e** che l'avviso esce:
  rimettendo il catch muto, cade. Nessuna migrazione, 3117 test in 203 suite.

- `[Sviluppo]` ⭐ **Il popup «Com'è andata ieri?» richiedeva le stelle dei piatti già votati.** Voci 269
  (chiusa) e 270 (aperta). È il punto 6 della voce 253 — il giro sistematico sulle rotte `/me/*` del
  16/8: **`GET /me/ratings/pending` esiste dal principio**, torna i pasti degli ultimi tre giorni
  ancora senza valutazione, e **non la chiamava nessuno**. Il popup si costruiva l'elenco da
  `/me/menu`, cioè dal menu del giorno, e chiedeva le stelle di **tutti** i piatti di ieri. ⚠️ Si vede
  su due strade: chi valuta un piatto da un'altra schermata se lo ritrova nel popup, e chi apre l'app
  da un **secondo dispositivo** ricomincia da capo — il «già visto» di oggi vive nel `localStorage` di
  quel telefono, le valutazioni stanno sul server. ⚠️ Il **filtro sul giorno resta**: la rotta torna
  tre giorni, il popup ne chiede uno, e portare in primo piano anche l'altro ieri non è una
  correzione — è una domanda in più a una persona, e va decisa. ⚠️ Lo stesso piatto in due pasti dello
  stesso giorno si chiede **una volta sola**: la valutazione è unica per `(cliente, ricetta, giorno)`,
  e chiederla due volte vorrebbe dire far rispondere due volte per scrivere una riga sola, con la
  seconda risposta che cancella la prima senza dirlo. Regola in un modulo **puro**
  (`app/src/lib/valutazioni-da-chiedere.ts`), 5 test **vitest** visti cadere per mutazione — l'app ha
  la sua infrastruttura di test, a differenza del backoffice, e vale la pena usarla. ⚠️ **E la cosa
  trovata mentre lo sistemavo, voce 270**: se la cliente tocca **solo** l'aderenza (Seguita / Non
  seguita) senza dare le stelle, il popup manda comunque **`stars: 3`**, perché la rotta le stelle le
  pretende e l'aderenza viaggia come tag. Quel 3 non è un'informazione, è **un voto inventato
  dall'app**, e finisce nel segnale «gradimento» con cui il motore decide cosa riproporle: una che dice
  soltanto «non l'ho seguita» risulta averle dato tre stelle. Tre strade, decide Simone (porta sua per
  l'aderenza · non mandare niente senza stelle · escludere dal gradimento quelle col tag). Nessuna
  migrazione, backend invariato. ⚠️ Arriva alle clienti solo con la prossima pubblicazione o OTA.

- `[Sviluppo]` 📐 **`npm run diag:kcal`: quante giornate escono sotto il fabbisogno, e con che tetto si
  coprono.** Voce 268. Il segnale `daily_kcal_below_target` esiste dal 17/8 e da allora **accumula**:
  mancava il posto dove leggerlo, e per sapere quante giornate escono corte bisognava aprire il
  database. Ora una diagnostica di sola lettura lo mette in tabella — cliente, **perché** le manca
  (finestra del digiuno, spuntini tolti da Vera, o «nessuna esclusione: è il catalogo»), **quota
  peggiore** della giornata, **fattore necessario**, e se il tetto che stai provando basta. ⚠️ È qui
  che serve: le due domande cliniche ancora aperte del foglio delle porzioni — che tetto dare al
  moltiplicatore, e cosa fare quando non basta — diventano **due conteggi** invece che due opinioni
  (`TETTO=1.6 npm run diag:kcal` dice quante coperte e quante ancora corte, e di quanto). `GIORNI=`
  allarga la finestra, `SOLO=<email>` guarda una cliente sola. ⚠️ Si prende l'evento **più recente**
  per cliente: quello vecchio racconta una situazione già cambiata. ⚠️ E lo script **dice il suo
  limite** invece di lasciarlo dedurre: *chi non compare non è detto che stia bene* — vuol dire che in
  quella finestra non le è stata erogata una giornata sotto banda, o che non le è stata erogata
  affatto, perché l'erogazione gira quando la cliente apre l'app. Una diagnostica che tace su quello
  che non sa è il modo più rapido di far leggere «tutto a posto». ⚠️ Le clienti sotto target **senza**
  digiuno e **senza** spuntini tolti finiscono in un avviso a parte: lì il moltiplicatore non c'entra,
  è il catalogo che non ha giornate nella banda, e la strada è `diag:varieta` — mescolarle avrebbe
  fatto contare due problemi diversi come uno. Nessuna scrittura, nessuna migrazione; lo script non ha
  test come gli altri `prisma/*.ts`, ed è verificato dal compilatore. 3116 test in 203 suite.

- `[Sviluppo]` 🧹 **La bonifica dei cibi esclusi si applica a una cliente per volta, e le esclusioni
  con «tranne» dentro finiscono in elenco lavori.** Voci 266 (chiusa) e 267 (aperta). Ieri sera Simone
  ha lanciato l'anteprima di `npm run pulisci:spezie` in produzione, e mezz'ora di dati veri ha detto
  più di una giornata di ragionamenti. Due clienti: **Simona** aveva **una voce sola** — un blob di
  testo libero («Oatmeal, Fiocchi d avena, Fiocchi d'avena, Avena, Porridge…») che a valle non
  escludeva niente: chiedeva di non ricevere avena **e la riceveva**. Spezzata in otto voci comincia a
  funzionare. ⚠️ **Ilaria** no: nella sua lista c'è «pesce tranne salmone, tonno», e spezzata sulla
  virgola diventa «pesce tranne salmone» + «tonno» — cioè rende il **tonno** un cibo escluso, l'opposto
  di quello che aveva scritto, visto che lo elencava fra le eccezioni. Più «Non mi piace la cicoria»,
  che è una frase e non un alimento. E lo script scriveva **tutto o niente**: la scelta era fra
  applicare anche quella o non applicare niente. Ora c'è **`SOLO=<email>`** (anche più email separate
  da virgola), che vale sia in anteprima sia con `CONFERMA=1`. ⚠️ E un'email che non corrisponde a
  nessun profilo **viene detta**: senza, un refuso darebbe «nessuna spezia da ripulire ✓» — la faccia
  del «va tutto bene» su un lavoro che non è stato fatto, che è il difetto di famiglia di questo
  progetto in miniatura. ⛔ La seconda metà è una **decisione di Simone** (voce 267): il campo accetta
  **frasi** e il motore legge **alimenti**, e quello che c'è in mezzo si perde in silenzio — la stessa
  stringa esce grezza anche nel report PDF che riceve la cliente. Tre strade: che sia **Gaia (o il
  questionario) a chiedere** «quindi il tonno lo mangi?», che la **scheda avvisi chi salva** come già
  fa per le spezie, o che si **segnali** soltanto. Riconoscere la negazione è la parte facile; cosa si
  fa dopo è prodotto. ⚠️ Lo script non ha test, come gli altri `prisma/*.ts`: è verificato dal
  compilatore e resta di sola lettura senza `CONFERMA=1`. Nessuna migrazione, 3116 test in 203 suite.

## 2026-08-17

- `[Sviluppo]` 🔍 **La revisione delle cinque consegne di oggi: sette rilievi, tre seri.** Voce 265.
  Fatta rileggere la giornata da un revisore prima di chiuderla — ed è la regola che ogni volta trova
  cose che **compilano, passano i test e sarebbero arrivate in produzione**. ⚠️ **1) Un avviso che
  scatta sempre è un avviso che non c'è**: la matita (voce 259, consegnata due ore prima) contava il
  **passaggio di testimone** come sovrapposizione — piano A finisce il 25/08, piano B parte il 25/08 —
  ma quella è la coda che `finalizeApproval` costruisce **da sola**, mettendo l'inizio della coda alla
  fine del piano in corso. Sarebbe scattato su ogni cliente con un rinnovo, anche risalvando la stessa
  identica data, e nemmeno la cliente riceve due menu quel giorno (`attivoInCorso` ne sceglie uno).
  Ora toccarsi non è sovrapporsi. Il danno evitato non è il falso positivo: è che chi usa la matita
  impara a cliccare «Procedo comunque». ⚠️ **2) Il form della scheda rimanda tutti i campi a ogni
  salvataggio**: la pulizia dei gusti (voce 263, consegnata un'ora prima) riscriveva le intolleranze
  di una cliente quando una coach correggeva il **telefono**, e il log modifiche lo attribuiva a lei.
  Ora si pulisce solo ciò che è **davvero cambiato** — la stessa regola che `allergies` e
  `fastingWindow` applicano dieci righe più sotto: il permesso, e la modifica, valgono sul
  **cambiamento**, non sul salvataggio. E `null` non arriva più a Prisma (colonna `String[]`: era un
  500 in attesa). ⚠️ **3) Togliere `@Roles` toglie la rete sotto al fail-open**: `PageGuard` sugli
  errori di lettura tornava `true` «tanto `@Roles` resta applicato», premessa caduta con
  l'annullamento (oggi) e con `impersonate` (11/8). Un blip del database di trenta secondi e una
  **cliente loggata** poteva chiamare `POST /admin/subscriptions/:id/cancel` — che non verifica
  proprietà — e annullare il piano di chiunque, col proprio nome nel registro. Ora il fail-open vale
  **solo se la rotta ha ancora un `@Roles`**; dove il guardiano è l'unico cancello, un errore chiude.
  **Le altre quattro:** i due avvisi della matita si zittivano a vicenda (confermato il primo, il
  secondo non si vedeva — ora si chiedono in una domanda sola); il giorno era confrontato in **UTC** e
  non nel fuso aziendale, quindi fra mezzanotte e le due avvisi fantasma (⚠️ e sono le ore in cui si
  correggono le schede, cioè quelle del caso Lorena); la scheda coach **in app** ignorava
  `avvisiSpezie` esattamente come faceva il backoffice prima; un campo mancava nel tipo di
  `pulisci-spezie.ts`. Hanno retto senza rilievi il segnale kcal (il `create` è dentro un `.catch`, e
  il volume è uno per ciclo di erogazione), i `PAGE_GRANTS` (nessun hub regala la chiave nuova) e le
  pastiglie. 10 test nuovi — **3116 in 203 suite** — e i due frontend compilati. Nessuna migrazione.
  ⚠️ Nota di metodo: `npx tsc --noEmit -p tsconfig.json` sul progetto intero è rosso **da prima** su
  tre script in `prisma/`; la CI compila solo `src/**`.

- `[Sviluppo]` 🌿 **I gusti scritti dalla scheda passavano diritti in banca dati — quarta volta per la
  stessa riga.** Voci 263 (chiusa) e 264 (aperta). `latte` che non si espandeva l'8/8,
  `frutta_a_guscio` il 12/8, il tag `"Carne .ceci"` stamattina, e adesso il percorso dello staff.
  ⚠️ **Ogni correzione ha coperto il percorso da cui era arrivata la segnalazione**, e questo — la
  scheda della nutrizionista — è quello rimasto fuori ogni volta: `updateClient` riempie `profileData`
  **ciecamente** per tutte le `PROFILE_FIELDS`, e la scheda manda una stringa spezzata sulle **sole
  virgole**. Ora `dislikedFoods` passa da `filtraSpezie` (la stessa del questionario e del profilo in
  app: spezza **prima** di classificare) e `intolerances` perde i **non-alimenti** (`altro`, `other`,
  `nessuna`…), che il questionario toglie da sempre e la scheda no — `'altro'` salvato come
  intolleranza è una parola che il motore va a cercare dentro i piatti. ⚠️ **Due liste, due regole**:
  un'intolleranza NON si spezza (è un codice o un termine clinico, «frutta a guscio» non va spaccata) e
  il cancello spezie non la tocca, perché quella è **sicurezza e non gusto** — una spezia fra le
  intolleranze resta, e c'è un test che lo tiene fermo. ⚠️ **E le spezie scartate si dicono a chi ha
  premuto Salva**: `avvisiSpezie` torna nella risposta e la scheda lo scrive nel banner. La risposta
  della PATCH prima si **buttava via**, quindi «Scheda aggiornata.» nascondeva una riga non scritta:
  chi l'aveva digitata la riscriverebbe uguale la volta dopo. Non si chiude un difetto del silenzio
  aggiungendo silenzio — e chi scrive lì è una professionista, che ha diritto di sapere anche **perché**
  (escludere il pepe svuota il pool invece di togliere un piatto). ⚠️ Nello stesso colpo la **bonifica**
  `npm run pulisci:spezie`: valutava `classificaSpezia` sul termine **intero**, quindi «pepe, ceci» le
  sfuggiva; ora passa da `filtraSpezie` e riscrive anche le liste che non perdono niente ma **cambiano
  forma** — che sono le clienti per cui il difetto era invisibile. 10 test su cosa arriva davvero
  nell'upsert (fra cui «peperoni» che **non** è «pepe»: confronto per parola, non per sottostringa),
  visti cadere per mutazione 2 e 2. ⛔ **E il censimento di quello che resta, voce 264**: le porte che
  scrivono `dislikedFoods` sono **otto**, adesso tre sono pulite più lo script. Restano
  `substituteDisliked` con `scope: 'forever'`, Gaia, e ⚠️ **le due di Vera** — una cliente e una
  **coorte**, dove un termine sporco si moltiplica su N profili. Quelle due non le ho chiuse da solo:
  se la nutrizionista detta una spezia, scartarla in silenzio è il difetto di sempre, scartarla
  dicendolo vuol dire scrivere la frase che Vera risponde, tenerla vuol dire accettare che il pool si
  svuoti. È una scelta di Simone. Backend 3106 test in 202 suite, backoffice verde, nessuna migrazione.

- `[Sviluppo]` ✏️ **La matita delle date dice cosa sta per rompere.** Voce 259, l'ultima del caso
  Lorena. Il 16/8, quarantotto secondi dopo l'acquisto del secondo piano, qualcuno ha aperto quella
  scheda e ha spostato la data d'inizio: stava correggendo una data che la scheda mostrava sbagliata
  (quella del piano **in coda**), e il risultato sono stati due piani attivi insieme. ⚠️ **La matita
  non lo ha detto perché non lo sapeva**: spostava una data e non guardava le altre righe. Ora
  `clients/sovrapposizione-piani.ts` (modulo puro) dice quali piani lo spostamento farebbe sbattere e
  compone la frase, e `updatePlanStart` la restituisce come **409** — lo stesso meccanismo dell'altro
  avviso della stessa matita («con questa data il piano risulta già finito», 10/8). ⚠️ **La pagina non
  ha avuto bisogno di una riga**: il suo ramo 409 era già generico (mostra il messaggio del server e
  chiede «Procedo comunque?»); ho aggiornato solo il commento, perché ora i 409 sono due e chi legge
  quel codice non deve credere che ce ne sia uno. ⚠️ La frase dice **tre** cose, e sono le tre che il
  16/8 non c'erano: contro cosa si va a sbattere **col nome** («"Conosciamoci" sta erogando fino al
  25/08» oppure «"3 mesi" è in coda dal 25/08»), quando, e **cosa succede alla cliente** — «i menu
  glieli darà uno solo dei due, quello che finisce più tardi, e i giorni dell'altro scorreranno senza
  che riceva niente», che è la conseguenza vera secondo `attivoInCorso` e non un generico «attenzione:
  sovrapposizione», che è rumore. ⚠️ **Conferma e non divieto**: forzare a volte serve davvero, e un
  divieto secco si aggira cambiando la riga a mano nel database, dove non lascia traccia. ⚠️ **Un solo
  `conferma` per due avvisi**, di proposito: chi conferma risponde alla frase che ha letto, e la frase
  la compone il server — due flag vorrebbero dire che la pagina conosce le regole. ⚠️ E **chi supera
  l'avviso finisce nel registro** (`sovrapposizioneConfermata` nell'audit, coi piani coinvolti):
  l'`actorId` c'era già, mancava che l'avviso ci fosse stato — senza quella riga, fra un mese una
  sovrapposizione si rilegge come un difetto del software invece che come una decisione presa. I
  confini, che sono la parte che sbaglia da sola: il **giorno del passaggio di testimone è** una
  sovrapposizione (fine compresa: è il giorno in cui arrivano due menu); **fine assente = piano
  aperto**, si sovrappone a tutto ciò che viene dopo il suo inizio; inizio assente vale «già
  cominciato», come in `staErogando`; e non contano `cancelled`, `expired`, `pending` (un carrello non
  è una promessa) né un `active` con la fine già passata. 18 test — 15 sul giudizio e sulla frase, 3
  sul collegamento, fra cui che **il 409 non scrive niente**: un avviso che scrive comunque non è un
  avviso. Mutazione: collegamento staccato → cade 1 su 3; «sempre in corso» al posto del
  riconoscimento della coda → cadono 4. Nessuna migrazione. Backend 3096 test in 201 suite (prima
  3078 in 200), backoffice `npm run build` verde.

- `[Sviluppo]` 🔑 **Il × per annullare un piano non si vedeva dal capo nutrizionista.** Voce 261. Il
  pulsante è nato stamattina con `@Roles('admin')`, «come lo storno e la cancellazione di un acquisto,
  che sono i suoi vicini di casa per gravità». La gravità era giusta, **il cancello no**: chi gestisce i
  piani ogni giorno è il capo nutrizionista, e dalla sua utenza il × non compariva nemmeno. ⚠️ L'unica
  strada era **entrare come admin** — cioè fare la cosa grave con l'utenza sbagliata, e nel registro
  dell'annullamento resta scritto «admin» invece del nome di chi ha deciso. Ora la rotta chiede la
  chiave della matrice `cancel_subscription` in gestione (`@RequirePage`), **di default solo admin**:
  gli altri li abilita Simone dalla tabella dei permessi, senza un rilascio. È lo stesso passaggio
  fatto l'11/8 per «Entra come». ⚠️ **E il difetto non era solo nel backend**: nella pagina il pulsante
  era legato a `isAdmin`, che lì vuol dire «vede la pagina Permessi» (`can('permissions')`) e non «è
  admin» — cambiare la rotta e basta non l'avrebbe fatto comparire a nessuno. `isAdmin` non è stato
  toccato: gatezza altre cinque cose. ⚠️ Il permesso nasce con `view: true` e non solo `manage`, perché
  `getForRole` filtra su `canView` e un `manage` senza `view` non arriverebbe mai al frontend. 5 test
  **sui decoratori**, che è l'unico posto dove «chi può bussare» si vede senza avviare l'applicazione.

- `[Sviluppo]` 🎟️ **Due piani attivi erano due pastiglie identiche: ora dicono chi eroga e chi è in
  coda.** Voce 262, l'ultimo pezzo **visibile** del caso Polidoro. Le pastiglie dei piani scrivevano
  tutte «Piano · Attivo» più la **data d'inizio**: con due righe attive erano indistinguibili, e
  l'unica differenza stava nel tooltip — che a sua volta può mostrare un «+7 giorni» calcolato per la
  finestra dei menu, non una fine vera. Ora `getDetail` manda per ogni abbonamento `inCorso` e
  `inCoda`, e la pastiglia dice **«In coda · dal 25/08»** oppure **«Attivo · fino al 25/08»**. ⚠️ La
  data mostrata cambia perché è quella che serve a distinguerli: di chi eroga interessa **fino a
  quando** arrivano i menu, della coda **da quando** partirà. ⚠️ **Il giudizio non è stato riscritto
  nel browser**: `staErogando`/`eInCoda` stanno in `commerce/abbonamento-in-corso.ts` e le usano già
  motore, pause, coach e `pickMainSubscription` — ricalcolarle nella pagina sarebbe stata la quinta
  definizione di «chi sta erogando», e oggi due definizioni della stessa domanda sono divergite nello
  spazio di un'ora. ⚠️ La fine si scrive **solo se esiste** (senza scadenza la pastiglia lo dice), e
  non si riusa `periodo.to`, che quando la fine manca è un «+7 giorni» inventato per un'altra cosa.
  ⚠️ `abbonamentoInCoda`, scritta stamattina, non aveva ancora nessun chiamante: il commento in testa
  alla funzione descriveva letteralmente questa pastiglia. 4 test sul contratto che il DTO consuma —
  compreso l'`active` con la fine passata (cron di scadenza in ritardo), che **non** risulta in corso:
  la pastiglia non promette menu che non arrivano. ⛔ Restano senza test il DTO di `getDetail` (non ha
  spec) e tutto il frontend (il backoffice non ha infrastruttura di test): va detto, non nascosto.
  Backend 3078 test in 200 suite, backoffice `npm run build` (tsc + vite) verde. Nessuna migrazione.

- `[Sviluppo]` 📉 **Una giornata sotto il fabbisogno usciva identica a una giusta: ora lo dice.**
  Consegna 1 del foglio delle porzioni, quella che non aspetta nessuna decisione. Voce 260.
  `menu_kcal_balance_tolerance_pct` c'era già dal principio, ma era usata come **filtro** e non come
  **controllo**: `day-combo.service.ts:48-56` scarta le combinazioni fuori banda e, quando non ne resta
  nessuna, torna `null`; da lì `deliverIfEligible` compone col selettore per-slot ed **eroga comunque,
  senza una riga di log**. ⚠️ E venti righe sopra, nello stesso file, per i **pasti** mancanti il
  segnale era stato costruito il pomeriggio prima (`fasting_meals_missing` + `diag:digiuni`, cliente per
  cliente): per le **calorie** non esisteva l'equivalente. La stessa domanda, sullo stesso codice,
  lasciata senza risposta — e il difetto di famiglia di questo progetto è esattamente quello. Ora il
  giudizio sta in un modulo **puro** (`menu/giornata-sotto-target.ts`, come `struttura-per-digiuno` e
  `abbonamento-in-corso`) e l'erogazione scrive un `logger.warn` con la giornata **peggiore** più un
  `analyticsEvent` **`daily_kcal_below_target`** con tutte: target e sua provenienza (fabbisogno o
  livello dieta), tolleranza, kcal + scostamento + **quota del target** per ogni giornata (0,65 = il 65%
  arrivato nel piatto), slot non erogati, finestra, `pastiEsclusi`, dieta. ⚠️ **Non blocca niente**,
  come `fasting_meals_missing`: una giornata scarsa è meglio di nessun menu, e il rimedio — le porzioni
  scalate — non è nelle mani di chi apre l'app. ⚠️ **Un evento per erogazione e non uno per giorno**:
  `deliverIfEligible` gira a ogni apertura dell'app, e un evento per giornata farebbe contare le
  aperture invece delle giornate. ⚠️ Il controllo sta **dopo** la ripetizione bigiornaliera, le
  «ricette semplici» e il cambio dei piatti non graditi: sono tre passaggi che **riscrivono** la
  giornata, e prima di loro i pasti non sono ancora quelli che la cliente riceverà. ⚠️ La soglia è
  **quella che il motore usa per comporre**, non una costante nuova: due soglie sulla stessa domanda
  divergono in un pomeriggio, ed è successo ieri fra il motore e la diagnostica su Maria. ⚠️ Si guarda
  **solo il sotto**: una giornata troppo ricca è un'altra domanda, e mescolarle vorrebbe dire non poter
  contare né l'una né l'altra. ⚠️ E la guardia «senza target non giudico» non è cosmetica: togliendola
  **non compila** (TS2345/TS18049), perché è quella che restringe `number | null | undefined` — qui è
  il tipo a dire che «non lo so» non è «va bene». 22 test: 20 sul giudizio, con in tabella i numeri veri
  delle cinque finestre (100% · 65% Sonia · 65% · 55% · 45%) e dei due casi di `pastiEsclusi` (80% e
  90%), e **2 sul collegamento** in `menu.service.spec` — che è la parte che i test del modulo non
  possono vedere. Controllo per mutazione: soglia irraggiungibile → cadono 10; `Math.abs` al posto del
  solo «sotto» → cade 1; collegamento staccato → cade 1 dei 2 nuovi. Nessuna migrazione. In sandbox coi
  tipi Prisma veri: build verde e **3069 test in 199 suite** (baseline 3047 in 198).

- `[Sviluppo]` 🍽️ **Le porzioni si scalano all'erogazione: scritto il foglio della strada C, e trovato
  il segnale che manca.** Voce 255, la metà che la correzione del digiuno (voce 254) non chiude: Sonia
  ha i pasti giusti al **65%** del fabbisogno. La strada l'ha scelta Simone (C: un moltiplicatore di
  porzione all'erogazione, un catalogo solo), quindi il foglio
  (`progetto/DECISIONE_Porzioni_Scalate_Strada_C.md`) non ripropone il confronto con la B: mette per
  iscritto quanto manca, quanto costa, e le domande che la C non risolve. ⚠️ **Quanto manca l'ho
  contato, non stimato**, incrociando `FINESTRE_DIGIUNO` con `quoteKcalPerSlot` e col catalogo che la
  correzione del 17/8 serve a ciascuna finestra: «salta la cena» e «salta il pranzo» stanno al 65%
  (fattore ×1,54), «salta colazione e pranzo» al 55% (×1,82), **«salta cena e colazione» al 45%
  (×2,22)** — e i due spuntini tolti da Vera, fuori dal digiuno, valgono l'80% (×1,25). Le due
  finestre strette oggi non le usa nessuno, ⚠️ ma **la 20-4 il prodotto la propone**: la riga del
  ×2,22 è raggiungibile domani. Le tre domande per Simone, tutte cliniche, sono in testa al foglio: il
  **tetto** (uno solo, o uno per tipo di pasto — col tetto unico lo spuntino di Sonia diventa da 256
  kcal e non è più uno spuntino), **cosa si fa quando il tetto non basta**, e **se scalano tutti allo
  stesso modo**. ⚠️ **Ma la cosa che ho trovato scrivendo il foglio non aspetta nessuna decisione: una
  giornata sotto target oggi esce identica a una giusta.** `menu_kcal_balance_tolerance_pct` esiste ma
  è usata come **filtro**, non come controllo: `day-combo.service.ts:48-56` scarta le combinazioni
  fuori banda e torna `null`, e `menu.service.ts:718-723` compone col template ed **eroga comunque,
  senza una riga di log**. Nello stesso file, per i **pasti** mancanti, il segnale è stato costruito
  (`fasting_meals_missing`, warn + `analyticsEvent` + `diag:digiuni` cliente per cliente): per le
  **calorie** non esiste l'equivalente — e il controllo che manca al motore Vera ce l'ha già, per le
  giornate dettate (`giornata-dettata.ts`, che blocca e lo dice col numero). Per questo la prima
  consegna proposta non è la cura, è il numero che dice quante sono. ⚠️ E le **quattro frasi che
  promettono una cosa che il motore non fa** vanno sistemate in ogni caso: `Profilo.tsx:226` («le
  calorie di quel pasto sono ridistribuite sugli altri», alla cliente), `vera-chat.service.ts:926` e
  `:992` (Vera lo dice a voce), `schema.prisma:415`. I tre punti che romperebbero in silenzio sono nel
  foglio col numero di riga: la lista della spesa (somma le grammature senza fattore, **e ha una
  cache**), il dettaglio ricetta (chiama `GET /recipes/:id`, che non sa né di quale giorno né di quale
  pasto), e i **totali kcal che li somma il frontend** — quindi `kcal` va scritto già scalato, con
  `porzione` e `kcalBase` accanto. Nessuna migrazione, nessun codice di produzione.

- `[Sviluppo]` 🔎 **`vera_seconda_lettura` in `config_param`: era un falso allarme, e l'handoff della
  sera lo diceva sbagliato.** L'handoff (`progetto/HANDOFF_2026-08-17_sera.md`, recuperato dalla chat che
  si è bloccata) apriva con «il seed non gira su un database che esiste già» e chiedeva di creare la
  riga a mano. ⚠️ **Non è così, ed è lo stesso handoff a mettere al primo posto la regola che l'avrebbe
  evitato**: si verifica nel codice, non nei documenti. `render.yaml:48` →
  `preDeployCommand: (npx prisma migrate deploy || …) && npx prisma db seed`, `package.json:80-82`
  punta a `prisma/seed.ts`, e `seed.ts:1296-1300` fa `upsert` su tutti i `CONFIG_PARAMS` — `create` se
  la chiave manca, `update` che **non tocca `value`** perché «l'admin può averlo cambiato».
  `vera_seconda_lettura` è in quell'elenco (`seed.ts:512-526`). La riga nasce da sé al primo deploy
  dopo `0ca728f`: niente da lanciare. Lo diceva anche questo registro (⚠️ «alla riga 5268» era sbagliato — il numero non l'avevo verificato, si trova col grep: «il seed gira a
  ogni deploy»). Il §3.1 dell'handoff è stato corretto sul posto, col testo originale lasciato sotto
  per memoria: un handoff sbagliato che resta in giro costa più di uno mancante. Resta solo da guardare
  che il deploy sia verde e che la chiave si veda nella pagina Parametri.

- `[Sviluppo]` 🗣️ **Vera: la seconda lettura. Il modello traduce, `capisci` decide.** Sì di Simone la
  mattina, consegnata la sera. Quando il riconoscitore torna `null`, il modello **riscrive** la frase
  nella forma canonica e la si rilegge col riconoscitore deterministico. ⚠️ Il modello non vede i dati
  e non tocca il database: riceve una stringa e torna una stringa — il prompt è la frase più le forme
  canoniche, e c'è un test che verifica che stia **sotto i 200 caratteri**, cioè che non ci sia finito
  dentro nessun nome e nessun catalogo. A decidere resta `capisci`: il modello non allarga quello che
  Vera **sa fare**, allarga il modo in cui glielo si può **dire**. ⚠️ **La parte che conta di questa
  consegna non è la traduzione, è la guardia**: il modello può *riordinare* le parole della frase, non
  *aggiungerne* — ogni parola piena della riscrittura deve venire dalla frase (confronto per radice,
  così «sostitusci» → «sostituisci» passa) o essere una delle **parole della forma**, che sono un
  elenco chiuso in cui non entrano alimenti, nomi, numeri o diete. «a Giulia togli il pesce» → «…il
  pesce **e i crostacei**» viene rifiutata, e il rifiuto si scrive nei log. ⚠️ **E i numeri si
  controllano a parte, cosa che ha trovato un test e non un ragionamento**: il filtro delle parole
  scarta quelle sotto le tre lettere, quindi «riduci le calorie a Giulia» → «riduci le calorie **del
  30%** a Giulia» ci passava in mezzo — e `capisci` le percentuali le legge. Un numero inventato dal
  modello non è una parola in più in una frase: è il fabbisogno calorico di una persona cambiato da
  nessuno. ⚠️ Una **domanda** non arriva nemmeno al modello: `daScartare` gira prima, ed è stata solo
  **esportata** da `capisci.ts` — la difesa resta in un posto solo. ⚠️ Se il modello non risponde
  (credito, 503, timeout) si dice «non ci arrivo» come sempre: la seconda lettura è un **di più**, e se
  manca non manca niente. L'innesto sta in fondo a `nuovoGiro`, **dopo** il battesimo, «annulla» e la
  coda del capo — quelle sono risposte certe, e una traduzione non deve passare davanti a qualcosa che
  sappiamo già leggere — e **prima** del «non ci arrivo», perché è il giro che oggi va perso: il
  modello si paga solo lì. Vale anche al **ritentativo**, che è il momento in cui lei ha già riscritto
  una volta. ⚠️ Una chiamata per giro (`giaRiletta`): senza, una riscrittura capita a metà rimbalzerebbe
  fra i due spendendo a ogni rimbalzo. ⚠️ L'interruttore `vera_seconda_lettura` sta **nel seed** e non
  solo nel default del codice, perché `config-params.service.create` porta scritto che quella
  dimenticanza è già costata due volte: un interruttore che nessuno vede non si può spegnere quando
  serve. E il guadagno che non si paga: ogni riscrittura riuscita è una frase vera da aggiungere a
  `capisci` — il corpus esiste già, e il modello diventa il modo per **smettere** di aver bisogno del
  modello. 22 test, nessuna migrazione; 3 cadono spegnendo l'innesto e 4 spegnendo la guardia. Voce 215
  spuntata. ⚠️ In produzione serve `AI_API_KEY` su Render.

- `[Sviluppo]` 🎫 **Fra due piani attivi, quale «è» il piano: la scheda mostrava quello in coda.**
  ⚠️ La storia di Lorena è più precisa di come l'avevo scritta, e la parte che mancava è peggiore:
  `pickMainSubscription` faceva `find(s => s.status === 'active')` su una lista `createdAt desc`,
  quindi fra due righe attive vinceva **la più recente** — che alle 20:30:20 era il piano nato 48
  secondi prima, in coda dal 25/08. La scheda non è che *non avvisava*: **scriveva «Inizio piano:
  25/08»**, la data della coda, e la matita — che usa la stessa funzione — ha spostato quella riga.
  Chi l'ha aperta ha corretto una data sbagliata: ha fatto la cosa giusta con quello che le era stato
  mostrato. ⚠️ Lo si vede nel codice e combacia coi tempi dell'audit; non ho lo screenshot di cosa
  vedeva sullo schermo, ma la riga che sceglieva era sbagliata comunque sia andata quella sera. Gli
  altri tre punti, tutti difetti **già oggi** senza bisogno di `queued`: `menu.service` faceva
  `findFirst` **senza `orderBy`** e da quella riga escono «piano concluso?» e `planEnd`, cioè fino a
  che giorno arrivano i menu — quanti giorni riceveva una cliente con due piani dipendeva dall'ordine
  delle righe nella tabella; `pause.service` ordinava per `createdAt desc`, quindi i giorni di pausa
  si sommavano alla fine del piano in coda (concessi sulla carta, mai ricevuti); `coach.service`
  costruiva una `Map` che tiene l'ultima riga, e la `planEndDate` in lista clienti poteva essere
  quella sbagliata. Ora la scelta è **una sola funzione** (`commerce/abbonamento-in-corso.ts`, modulo
  puro): chi eroga oggi, e fra due sovrapposti **quello che finisce più tardi** — ⚠️ non «cominciato
  prima», perché con due piani sovrapposti la cliente ha pagato fino alla fine del secondo e la fine
  più vicina le taglierebbe giorni comprati. ⚠️ Le date sono **obbligatorie nel tipo**, e la guardia
  ha funzionato subito: il compilatore ha trovato un cast in `clients.service` che le buttava via —
  cioè il punto esatto da cui il difetto entrava nella scheda. Decisione di Simone: un piano in coda
  conta come «ha un piano» perché è un contratto, quindi il pallino della coach resta acceso e quello
  che cambia è la data mostrata; ⚠️ col prezzo scritto, che nei giorni fra acquisto e partenza lei
  legge «ha un piano» e la cliente non riceve niente — l'altra strada è quella che invita ad attivarne
  un secondo sopra. ⚠️ **Non è lo stato `queued`**: quello resta la causa (47 letture di
  `status:'active'` censite — 27 solo-active, 15 anche-queued, 5 da decidere). Qui si rende
  deterministico un comportamento che dipendeva dall'ordine delle righe, senza migrazione. 18 test,
  visti **rossi prima**, e 6 cadono se si rimette «la prima della lista». Foglio:
  `progetto/NOTA_Chi_Sta_Erogando_Adesso.md`. Elenco lavori: **257** spuntata, **258** (`queued` come
  stato, col censimento già dentro la voce così non lo rifà nessuno) e **259** (la matita che avvisa
  prima di sovrapporre) nuove; e la **215** di Vera passa da «Aspetta Simone» a codice da scrivere,
  perché il sì è arrivato.

- `[Sviluppo]` 🔕 **Verificato in produzione: Sonia mangia tre pasti. E `diag:digiuni` gridava su un
  caso sano.** Dopo il deploy: Sonia riceve colazione, spuntino e pranzo, servita da
  **Flexitariana · vegetarian · 5** — stessa famiglia, stesso regime, cambia solo la struttura: il
  ripiego di famiglia che avevo segnalato come rischio non è servito. Le cinque su «salto la
  colazione» sono rimaste su `fasting`, intatte. ⚠️ Ma la riga rossa non è sparita: al posto di Sonia
  c'era **Maria**, e lì era un **falso allarme** — senza finestra impostata non si salta niente e
  riceve il 16:8 classico; «dovrebbe ricevere tutti e cinque i pasti» era una frase del mio script,
  non una promessa fatta a lei. ⚠️ E la cosa seria è che **le due risposte avevano divergito nello
  spazio di un'ora**: `menu.service` su Maria taceva (giustamente) e la diagnostica la segnalava —
  due definizioni della stessa domanda, che è il difetto che questo progetto paga più spesso, e
  stavolta l'ho creato io fra un modulo e uno script che avrei dovuto far parlare subito. Adesso il
  giudizio lo dà `pastiPromessiCheMancano`, la stessa funzione che il motore usa per decidere se
  scrivere `fasting_meals_missing`; ⚠️ con una differenza voluta: se nessuna dieta è servita mancano
  **tutti** i pasti promessi e non si passa alla funzione una dieta finta, che la farebbe rispondere
  sulla struttura sbagliata proprio nel caso più grave. E chi è in digiuno senza finestra ha un elenco
  suo, che dice qual è il problema vero: **la domanda non le è mai stata fatta**. ⚠️ Un allarme che
  grida su un caso sano non è un dettaglio di forma — dopo due, alla lista non crede più nessuno, e
  quella lezione era già scritta in testa a `common/piano-attivo.ts`.

- `[Sviluppo]` 🍽️ **Sonia mangiava un pasto al giorno: il catalogo del digiuno adesso lo decide la
  finestra.** Sonia, finestra «salto la cena»: doveva ricevere colazione, spuntino e
  pranzo e riceveva **il solo pranzo** — il 45% delle sue calorie. La causa sta in tre righe messe in
  fila: la variante `fasting: true` del catalogo ha tre slot **fissi** (pranzo, merenda, cena), cioè è
  di fatto la variante «salta la colazione» e nessun campo lo dice; `pickDietFor` per chi digiuna
  cercava `{fasting: true}` e basta; l'erogazione toglie da quella giornata gli slot della finestra.
  ⚠️ **E non l'ha segnalato niente**: la rete di `dayComboPools` ferma la giornata *vuota*, non quella
  *monca* — il difetto di famiglia di questo progetto, applicato alle calorie di una persona. Adesso
  la regola è **«si serve un catalogo che abbia i pasti che la finestra promette»**, e ⚠️ **non** «il
  digiuno usa sempre il 5 pasti»: quella sarebbe stata la stessa cosa dall'altro lato, perché nel
  catalogo digiuno pranzo+merenda+cena valgono il 100% della giornata e nel 5 pasti il 70% — le cinque
  clienti che stanno bene avrebbero ricevuto i pasti giusti con un terzo di calorie in meno, in
  silenzio. Si spostano solo «salto la cena» e «salto il pranzo», che sono esattamente le due rotte, e
  si spostano **per la regola**: la funzione conta i pasti, non elenca le finestre, e un test gira su
  tutta `FINESTRE_DIGIUNO`. ⚠️ Finestra non impostata (Maria) → non si muove niente: il suo problema è
  una domanda mancata, non un catalogo. ⚠️ **Quello che NON risolve, detto chiaro:** Sonia passa da 1
  pasto (45%) a 3 pasti (65%) — i pasti giusti, ancora corti, perché quello che resta non si
  ingrandisce e un moltiplicatore di porzione non esiste. È il prezzo dichiarato della strada A della
  nota. ⚠️ E il buco che può restare **ora si vede**: se in catalogo manca la variante a 5 pasti di
  quella famiglia, l'ultimo ripiego serve comunque una dieta digiuno e la cliente torna a un pasto —
  `menu.service` scrive un warn e un `fasting_meals_missing`, e `npm run diag:digiuni` lo dice con nome
  ed email. La finestra è stata aggiunta a **tutti e cinque** i chiamanti di `pickDietFor` (erogazione,
  base personalizzata, pool di Vera, scheda dello staff, descrizione che legge la cliente): uno che non
  la passasse sceglierebbe una dieta diversa dagli altri, che è il difetto che `pick-diet.ts` esiste per
  evitare. 14 test, nessuna migrazione, controllo per mutazione fatto (4 test cadono tornando a
  «sempre digiuno», 3 passando a «sempre 5 pasti»).
  Elenco lavori: voce **254** spuntata, **255** (le porzioni non si scalano — Sonia resta al 65% del
  fabbisogno: decide Simone fra le strade B e C) e **256** (a Maria la finestra non è mai stata
  chiesta) nuove, e la **215** di Vera aggiornata con le prove del 17/8. ⚠️ E una cosa sul metodo, che
  ieri è costata una CI rossa: la verifica è stata fatta **coi tipi Prisma veri anche in sandbox** —
  `npm run typecheck` qui si pianta su `prisma generate`, ma la ricetta con le variabili d'ambiente
  funziona in 768 ms, e da lì `nest build` è verde e girano **3007 test in 196 suite**, cioè la CI
  intera. Lo stub non è un destino: si genera il client vero e si guarda.

- `[Sviluppo]` ✅ **Lorena sistemata dalla scheda, non dal database.** Il pulsante nuovo è
  stato usato in produzione e ha funzionato: uno dei due «Conosciamoci» annullato, l'altro resta in
  corso fino al 01/09 con i 7 giorni di pausa che le erano stati concessi. ⚠️ Annullato il piano nato
  il **09/08** e non il doppione del 16/08: la pausa vive sul secondo, e togliere quello le avrebbe
  tolto una settimana. È una cosa che si vede solo guardando le date — la prima indicazione che avevo
  dato era l'altra, e sarebbe costata a lei. ⚠️ Resta aperta la **causa**: `queued` non è uno stato,
  quindi il caso può ripresentarsi comunque sia nato (`progetto/NOTA_Due_Piani_Attivi_Lorena.md`). E
  resta che il pulsante è `@Roles('admin')`: da capo nutrizionista non si vede.

- `[Sviluppo]` ✏️ **«sostitusci»: Vera cadeva su una lettera.** «a jolanda **sostitusci** ceci con
  fagioli o lenticchie» → «Non ci arrivo». Passata la frase dentro `capisci` prima di toccare
  qualcosa: non era il nome minuscolo e non era «o lenticchie» — era il refuso sul verbo, e con la
  parola scritta giusta la frase veniva capita. La radice ora tollera le due lettere che si mangiano
  più spesso, ⚠️ e si ferma prima di «sostituzione»: «la sostituzione di X con Y è andata bene» è un
  **resoconto**, e leggerlo come ordine vorrebbe dire scrivere nel piatto di qualcuno una cosa che
  nessuno ha chiesto adesso. ⚠️ Il modulo è condiviso con Gaia, quindi la tolleranza vale anche per
  le clienti — che di refusi ne fanno di più, non di meno. **E la cosa che conta di più non è una
  riga di codice**: oggi Vera si è rotta tre volte e tre volte ho aggiunto un'espressione regolare.
  Le frasi vere sono infinite e le forme scritte a mano no, e chi sta dall'altra parte non impara «ho
  sbattuto un tasto» — impara «non funziona». La proposta è in
  `progetto/NOTA_Vera_Seconda_Lettura.md`: quando `capisci` torna `null`, il modello **riscrive** la
  frase e la si rilegge col riconoscitore deterministico. Il modello non vede i dati, non tocca il
  database e non decide: traduce. Serve un sì o un no.

- `[Sviluppo]` 🔴 **CI rossa: provider mancante nel test del cron.** Aggiungendo `EngineRulesService`
  al costruttore di `CronController` non l'ho messo fra i provider del suo TestingModule, che li
  elenca a mano: `nest build` passava, cadevano i 5 test di `cron.controller.spec.ts`. ⚠️ Non l'ho
  visto perché quella suite è una di quelle che **in sandbox non compilano** per lo stub di Prisma:
  la mia verifica «tsc pulito sui file toccati» non poteva vederlo, e non l'avevo detto abbastanza
  forte — **sul codice che tocca Prisma il controllo dei tipi in sandbox non vale**, vale sul Mac e
  in CI. Oltre alla toppa, quattro test che difendono la decisione: `daily` **non** genera catalogo
  (quella notte non deve chiamare l'AI), l'endpoint genera e dice cosa ha fatto, senza segreto non
  genera niente perché è un endpoint che **spende**, e se la generazione esplode non risponde 500.
  Il primo è quello che conta: adesso la dipendenza è nel costruttore, e senza quel test il giorno
  che qualcuno la infila fra gli step notturni se ne accorge la fattura.

- `[Sviluppo]` 🧾 **Due piani attivi su Lorena: trovata la causa, e fatto il rimedio.** La
  storia letta in audit (`npm run diag:storia`, nuovo): alle **20:29:32** «+ Attiva un piano» crea il
  secondo piano e la **coda scatta** correttamente (`commerce.plan.queued`, inizio 25/08); alle
  **20:30:20**, quarantotto secondi dopo, la matita lo riporta al 17/08 e i due si sovrappongono.
  ⚠️ Non è colpa di chi ha usato la matita: **nessuno le ha detto che stava disfacendo una decisione
  presa 48 secondi prima**, perché per il codice quel piano era un `active` con una data futura —
  indistinguibile da un piano normale da spostare. ⚠️ E la «fine incoerente» che avevo segnalato non
  era incoerente: 25/08 + 7 giorni di pausa = 01/09; era il mio avviso a non sapere delle pause, e
  l'ho corretto. **Consegnato il rimedio**: `POST /admin/subscriptions/:id/cancel`, perché fino a
  oggi l'unico modo di togliere il secondo piano era scrivere a mano nel database. ⚠️ Annullare non è
  stornare (i soldi hanno la loro porta, e in audit si registra «nessun movimento») e non cancella la
  riga. ⚠️ La conferma si chiede **solo** quando la cliente resta senza nessun piano in corso: una
  conferma chiesta sempre insegna a cliccare «sì» senza leggere. 10 test. **La causa resta aperta**:
  `queued` come stato, e la matita che dice cosa sta per rompere — il piano è in
  `progetto/NOTA_Due_Piani_Attivi_Lorena.md`.

- `[Sviluppo]` 💬 **Vera non usciva più da «su quale cliente?».** Dallo screenshot delle 11:02-11:52:
  fatta la domanda, **ogni** messaggio successivo veniva cercato come se fosse un nome di persona —
  l'istruzione riscritta per intero («non trovo nessuna cliente che si chiami "a Jolanda Todde non
  darle più i ceci"») e, quarantacinque minuti dopo, una domanda su tutt'altro. ⚠️ Il difetto non è
  il riconoscimento del nome: è che **dal passo non si esce**, e una domanda chiusa che non ammette
  nessun'altra risposta trasforma un fraintendimento di un minuto in una chat inutilizzabile. Adesso,
  se fra le clienti non si trova niente, la frase si rilegge e si riparte da lì. ⚠️ La ricerca resta
  prima — una cliente vera vince sempre — e se la rilettura non capisce si dice «non trovo» come
  prima: non si indovina. E in più: **la pastiglia «1 sostituzioni da verificare» chiedeva una cosa
  che Vera non sapeva leggere**. Un'interfaccia che annuncia qualcosa e poi non risponde quando
  gliela chiedi è peggio di una che non l'annuncia. 7 test.

- `[Sviluppo]` 🍳 **Il catalogo si riempie da solo, una settimana per chiamata.** Richiesta della
  nutrizionista: «invece di farlo lei una alla volta col pulsante *genera*, possiamo farli tutti noi
  fino alla settimana 12, poi lei piano piano le controlla». `POST /internal/cron/genera-catalogo`,
  su Render un Cron Job a parte. ⚠️ **Un'unità di lavoro per chiamata**, non un giro che macina
  tutto: un ciclo da ~500 chiamate all'AI che cade a metà lascia un lavoro di cui nessuno sa il
  punto, e rilanciarlo rischia di rifare. Qui lo stato **è il catalogo stesso**, quindi si spegne
  quando si vuole e non resta niente a metà. La priorità sta in un modulo puro (18 test): prima le
  famiglie con clienti sopra — su 306 diete quelle con qualcuno sopra sono 16 — e dentro un gruppo
  prima la variante a **5 pasti**, che si finisce tutta prima delle sorelle, perché le altre due
  riusano le sue ricette e generarle prima vorrebbe dire pagare all'AI piatti che avrebbe regalato.
  ⚠️ E una settimana **magra** viene prima di una settimana **nuova**: le varianti con clienti hanno
  28 giornate ma 19 piatti per pasto invece di 28, cioè il conto delle settimane dice «a posto»
  mentre la cliente vede la stessa colazione cinque volte al mese. ⚠️ Per chi valida non cambia
  niente: stessa funzione del pulsante, ricette in bozza con gli allergeni da confermare — l'unica
  cosa che le si toglie è stare lì a premere.

- `[Sviluppo]` 🏷️ **Il tag con due alimenti: adesso non si scrive nemmeno più storto.** Stamattina si
  è chiusa la metà di **lettura** (`expandExclusion` spezza un termine che non riconosce, e vale
  subito sulle schede già sporche); questa è quella di **scrittura**. Sta in `filtraSpezie`, che è la
  porta da cui i cibi non graditi passano prima di essere salvati — questionario e profilo dell'app.
  ⚠️ Effetto collaterale voluto: adesso il controllo sulle spezie vede anche **dentro** la voce. Su
  «pepe, ceci» prima non scattava, perché classificava la stringa intera: l'avviso sul pepe non è mai
  stato dato a chi scriveva così. ⚠️ Non si spezza sugli spazi, ed è la riga che conta di più —
  «frutta a guscio» diventerebbe «frutta», cioè un danno fatto mentre si crede di star correggendo
  qualcosa. ⚠️ Una sola definizione dei separatori, in `common/tag-alimenti.ts`, importata da
  `menu/exclusions.ts`: due elenchi leggermente diversi vorrebbero dire che la scrittura spezza e la
  lettura no, e nessuno se ne accorgerebbe. 13 test. Resta fuori il backoffice, che scrive
  `dislikedFoods` senza passare da lì — il lato lettura protegge comunque.

- `[Sviluppo]` 🔎 **`npm run diag:digiuni` — cosa mangia davvero chi ha scelto il digiuno, e cosa
  manca alle 18 varianti.** Sola lettura, non scrive niente. ⚠️ La variante `fasting: true` ha tre
  slot **fissi** (pranzo, merenda, cena): è di fatto la variante «salta la colazione», e nessun campo
  lo dice. Poi l'erogazione toglie da lì gli slot della finestra scelta dalla cliente — e chi ha
  scelto «salto la cena» resta **col solo pranzo, un pasto al giorno**. Lo script lo dice cliente per
  cliente, con nome ed email, confrontando i pasti che la finestra promette con quelli che restano.
  Seconda parte: la griglia 3 regimi × 2 obiettivi × 3 strutture per ogni famiglia, e — soprattutto —
  la divisione fra le varianti **riempibili subito senza AI** (manca solo la struttura pasti, e le
  sorelle hanno già le ricette: è il generatore stesso a dire che le condividono) e quelle **che
  richiedono di generare ricette nuove** (manca il regime o l'obiettivo, e lì non si ricicla niente —
  una ricetta onnivora in una dieta vegana è l'errore che il generatore evita apposta). Serve a non
  spendere in chiamate all'AI prima di sapere quante clienti stanno davvero su quelle caselle.

- `[Sviluppo]` 🫘 **Tre volte che non abbiamo ascoltato la cliente — caso Jolanda Todde.** Tre
  difetti diversi trovati in un'ora, con una cosa sola in comune, ed è quella seria: **nessuno dei
  tre dà errore.** La cliente dice qualcosa di sé, il sistema risponde come se l'avesse capita, e va
  avanti.
  **(a)** In scheda aveva `Cibi esclusi (1): "Carne .ceci"` — un tag solo. `expandExclusion` non
  riconosceva quella chiave, la restituiva intera, e il motore cercava la stringa `carne .ceci` nei
  piatti, dove non compare mai: **né la carne né i ceci sono mai stati esclusi**, e il giorno dopo le
  è arrivata un'insalata di ceci. ⚠️ È la **terza volta** per questa riga — `latte` che non espandeva
  i derivati (8/8), `frutta_a_guscio` con l'underscore (12/8) — e il difetto sta scritto in testa a
  `exclusions.ts` da allora: *una chiave che la mappa non riconosce si comporta come un'esclusione
  che non c'è, e non produce nessun errore*. Le prime due volte si è chiusa la forma singola; questa
  volta la forma generale. ⚠️ Si corregge in `expandExclusion` e non solo nel questionario, perché lì
  agisce **subito su chi ha già un tag sporco in scheda**, senza migrazioni. ⚠️ Non si spezza sugli
  spazi: «frutta a guscio» è un alimento solo.
  **(b)** «Sostituisci a pranzo i ceci» → «metti 200 g di **ceci secchi** al posto di 200 g di ceci
  cotti in scatola», con motivo «non mi piace». È il rovescio esatto della correzione dell'11/8 sui
  gruppi di equivalenza: da quando il filtro delle parole condivise vale solo per la mappa, un gruppo
  può restituire una preparazione diversa dello **stesso** alimento. Il confronto giusto non è col
  nome in ricetta — che porta con sé la preparazione — ma con **la parola che ha scritto lei**: ha
  detto «ceci», il sostituto non può essere un cece. ⚠️ La correzione dell'11/8 resta intatta: lì
  aveva scritto «pasta integrale», e «pasta di ceci» non la combacia.
  **(c)** «Jolanda Todde non darle più i ceci» → Vera: «su quale cliente?». Il divieto l'aveva capito
  benissimo; era il **nome** a non passare, perché si cercava solo dopo una preposizione. ⚠️ Due
  parole maiuscole di fila e in apertura, non una: «Togli i ceci a Jolanda» darebbe la cliente
  «Togli». ⚠️ E la preposizione ora si riconosce anche maiuscola — «A Simone non dare più il tonno»
  non veniva letto, cioè la forma dichiarata falliva su una frase normale.
  14 test nuovi, nessuna migrazione. Restano aperti il campo a tag dell'app (che quel dato lo scrive
  male) e `menuDay.upsert` con `update: {}`, per cui un cibo non gradito dichiarato **dopo** non
  tocca i giorni già erogati e nessuno lo dice a nessuno.

## 2026-08-16

- `[Sviluppo]` 🔏 **Firma iOS: `install-ios.mjs` non poteva riuscire, e aveva ragione a fermarsi.**
  Il controllo cercava `CODE_SIGN_IDENTITY` in tutto il pbxproj mentre `patchFirma` la toglieva solo
  dai due blocchi del target: lo script si fermava dicendo il vero senza via d'uscita. ⚠️ Ma il punto
  non è che il controllo fosse largo — è che **aveva ragione**: Capacitor scrive
  `CODE_SIGN_IDENTITY[sdk=iphoneos*] = "iPhone Developer"` anche nei blocchi di **progetto**, e il
  target li **eredita**. Ripulire solo il target lasciava in piedi la riga che il 6/8 ha firmato
  l'archivio in development — e le push non arrivarono a nessuno, senza un errore. Ora si toglie da
  tutto il file (sicuro: i Pods hanno il loro pbxproj) e l'identità la sceglie Xcode.
  ⚠️ E se resta, adesso il messaggio dice **anche dove**: un controllo che sa dire di no e non sa
  dire dove costringe la persona sbagliata a fare l'indagine, la sera sbagliata.

- `[Sviluppo]` 📱 **iOS: il deployment target sale a 15.0, e lo rimette lo script** (prima della 2.2,
  come avevi detto il 13/8). Capacitor genera 13.0 e dalla primavera 2027 App Store Connect rifiuta
  gli upload costruiti così: è una scadenza, e arrivarci il giorno della pubblicazione vuol dire
  scoprirlo mentre si carica. ⚠️ Sta in `scripts/install-ios.mjs` e non fatto a mano in Xcode, per la
  stessa ragione di tutto quel file: `ios/` viene rigenerato e quello che vive solo lì sparisce **senza
  dare errore**, con la build che passa lo stesso. ⚠️ Si tocca anche il **Podfile**: `platform :ios` a
  13 mentre l'app dichiara 15 è il disallineamento che fa saltare un pod la sera sbagliata. ⚠️ E lo
  script verifica il proprio risultato: se resta un solo target sotto il minimo, esce con errore.

- `[Sviluppo]` 🏆 **I traguardi e il calo rapido arrivano alla cliente** — trovati con un giro
  sistematico su tutte le rotte `/me/*`, cercando il difetto già pagato tre volte qui: un dato che
  agisce e non si vede. `POST /me/measurements` rispondeva **da sempre** i traguardi appena raggiunti
  e il guardrail del calo rapido, e l'app **buttava via la risposta**. Il momento in cui una persona
  raggiunge l'obiettivo per cui sta facendo tutto questo esisteva in banca dati e non le veniva
  detto; e una pesata poteva aprirle addosso una segnalazione clinica senza che la schermata
  cambiasse. ⚠️ Se la pesata è stata segnalata **il traguardo aspetta**: festeggiare accanto a un
  allarme è una schermata che si contraddice da sola. ⚠️ E il testo dice **cosa è successo**, non che
  c'è un problema — il guardrail apre una segnalazione, non fa una diagnosi. 7 test.
  ⚠️ Il giro ha trovato altri quattro casi, che sono **schermate nuove e non correzioni**: `/me/progress`
  (proiezione della data obiettivo, giorni di stallo) e `/me/cycle` non li chiama nessuno, il
  certificato di personalizzazione lo vede solo il nutrizionista, e il popup delle valutazioni
  ripropone i piatti già votati perché ignora `/me/ratings/pending`. Voce 253.

- `[Sviluppo]` ⚠️ **Allergie e intolleranze in cima al profilo dell'app** (richiesta di Simone).
  C'erano già, ma nel secondo riquadro insieme alla spiegazione lunga: ora salgono in **sintesi** nel
  primo, accanto alla dieta e al regime — quello che si legge come «il mio piano in una schermata».
  Sola lettura, e la riga sotto dice dove si cambiano. ⚠️ La riga delle allergie c'è **sempre, anche
  vuota**: se sparisse quando non ce ne sono, la sua assenza si leggerebbe come «non ne ho», e non
  tocca a una riga mancante fare un'affermazione. ⚠️ E «Nessuna» si scrive **solo se gliel'abbiamo
  chiesto davvero** — altrimenti «non risultano allergie dichiarate», che è la verità: «nessuna
  allergia» e «non ce l'hai mai detto» non sono la stessa cosa. ⚠️ Le allergie che ci sono valgono
  anche senza la data, perché chi si è iscritta prima della dichiarazione le ha in scheda col
  marcatore a null. Le intolleranze compaiono solo se ci sono: un elenco vuoto non afferma niente.
  11 test (4 backend + 7 app).

- `[Sviluppo]` 👂 **Le frasi che l'assistente non ha capito si vedono nella sua pagina** (voce
  `vera-corpus-prima-del-rilascio`). `GET /vera/corpus` c'era dal 12/8 e **non lo apriva nessuno**:
  era un endpoint, non un posto — e un rituale che nessuno ha l'abitudine di fare non è un rituale.
  ⚠️ Serve perché un traduttore smette di capire **senza dare nessun errore rosso**: il giorno in cui
  cambia il catalogo o una regola in `capisci.ts`, l'unico sintomo è che l'assistente comincia a
  sembrare più scema di prima. Ora le frasi stanno sotto la chat, dalla più ripetuta, con quante
  volte e se si è arresa — **com'è stato scritto**, perché ripulirle butterebbe via esattamente
  l'informazione che serve. Il riquadro non compare quando non ce n'è nessuna, ed è chiuso di
  default: è manutenzione, non una cosa che aspetta qualcuno.

- `[Sviluppo]` 🧹 **Elenco lavori: undici voci chiuse dopo averle verificate NEL CODICE.** Sei erano
  già fatte e la pagina non lo sapeva (il testo incollato che non comanda l'assistente, il registro
  allargato, il dizionario che invecchia, l'azione 3 con tutti e tre i meccanismi, le azioni a raggio
  largo, la campagna allergie); cinque erano già state decise da Simone o Nocanty **e consegnate**
  (kcal a termine, segnalazioni cliniche in testa, dizionario comune col conflitto mostrato al capo,
  «variante di piano» = pasti futuri, «chiedi quando non conosci una parola»). Due riscritte invece
  che chiuse, per dire cosa manca davvero: la dashboard «quello che aspetta me» (fatta, tranne il
  pool sotto soglia) e le due gemelle sull'azione 6, che confluiscono in `vera-esclusione-di-dieta`.
  ⚠️ Un elenco che dice 34 quando ne restano molte meno non è un elenco: è rumore che fa pianificare
  male. ⚠️ E la pagina resta più lunga del file, perché i doppioni del 13/8 hanno chiavi che nel file
  non esistono: quelli si spuntano a mano.

- `[Sviluppo]` 🥜 **Vera propone gli allergeni della ricetta appena approvata** (voce 227). Approvare
  una ricetta la accendeva ma non confermava gli allergeni, e `collegaRicetta` si rifiuta di metterla
  in una giornata finché restano da confermare: il capo si ritrovava una ricetta **accesa e
  invisibile**, e lo scopriva dal fatto che non compariva da nessuna parte. Ora la domanda gliela si
  fa subito, dove sta già decidendo, con la **parola dell'ingrediente** accanto a ogni allergene
  («Pesce — da “orata”») perché un elenco senza il perché si conferma senza guardarlo. ⚠️ Tre
  asimmetrie volute: il «sì» scrive subito (conferma una lista già letta) mentre un elenco dettato si
  rilegge prima; «sì, aggiungi anche il sesamo» **aggiunge** invece di sostituire; e un allergene non
  suggerito si accetta lo stesso — `suggestAllergens` può non vederci qualcosa, e aggiungerne uno di
  troppo costa una ricetta, dimenticarne uno costa una cliente. Si scrive da `setRecipeAllergens`, la
  porta del pulsante in scheda. 23 test, con controllo per mutazione.
  Decisione in `NOTA_Vera_Allergeni_Ricetta_Nuova.md`.

- `[Sviluppo]` ⚠️ **Trovato guardando, e lasciato aperto**: `catalog.updateRecipe` scrive gli
  ingredienti **senza azzerare `allergensReviewed`**. Una ricetta a cui si cambiano gli ingredienti
  dal backoffice resta «revisionata» con la conferma di prima, data su un piatto diverso — nessun
  errore, nessuna riga rossa, e il filtro degli allergeni gira su un'informazione vecchia. Non l'ho
  chiuso da solo: azzerarlo toglie dai menu ogni ricetta che qualcuno modifica finché non la si
  rivede, e su 315 clienti è una decisione operativa. La metà che passa da Vera è chiusa (la modifica
  approvata in chat rifà la domanda). Voce 252 in elenco lavori, per Simone.

---

## 2026-08-14

- `[Sviluppo]` 🔘 **Lavori: il pulsante del rilascio spunta anche, e adesso lo dice** (voce 251,
  difetto trovato sul vivo la sera stessa). Tre consegne finite, zero voci da aggiungere, tre da
  spuntare: la pagina rispondeva «non c'è niente di nuovo da caricare» e **non mostrava nemmeno il
  Conferma** — le spunte si sono dovute fare dalla shell di Render. Il server mandava già `spuntate`
  e `chiuse`: era la pagina a guardare solo `aggiunte`, cioè a non vedere il caso normale di una
  giornata in cui si chiudono lavori già in elenco. ⚠️ Anche il nome era parte del difetto: «Carica
  le voci nuove» diceva metà di quello che fa, ed è diventato «Aggiorna dal rilascio». Ora `chiuse`
  porta i titoli e non le chiavi, il riepilogo mostra le due liste separate, e sotto c'è sempre la
  promessa che una voce già spuntata non viene mai riaperta. 1 test.

- `[Sviluppo]` 👁️ **Gli spuntini tolti dall'assistente si vedono anche nell'app** (voce 235). «Togli
  lo spuntino» agisce sul motore dal 13/8 — giornate senza quel pasto, kcal ridistribuite sugli
  altri — e nell'app **non lo diceva niente**: la cliente riceveva un piano senza merenda e l'unica
  cosa che poteva fare era scrivere alla coach «mi manca un pasto», per una cosa decisa apposta per
  lei. Lo stesso buco delle allergie, e mancava proprio la metà che legge la persona interessata (il
  backoffice la riga ce l'aveva dall'11/8). Ora `/me/nutrition` manda `pastiEsclusi` — sempre un
  elenco, mai `null` — e il profilo lo mostra in sola lettura, **a parole e mai col codice del
  motore**, con sotto il fatto che risponde all'unica domanda che fa nascere: le calorie di quel
  pasto sono ridistribuite sugli altri. 10 test (4 backend + 6 app).

- `[Sviluppo]` ✅ **Vera fa verificare a voce i cambi concordati in chat** (voce 245, lettura A
  scelta da Simone). La coda arriva in chat una riga per volta — cliente, piatto, da/a, e **quante
  volte** l'ha chiesta, che è il dato che cambia la decisione — e si risponde «va bene» o «no»; il
  motivo si prende solo se lo dice lei, perché un campo obbligatorio su una coda veloce diventa
  «boh». ⚠️ Il punto che regge tutto: un numero dettato, **anche dentro un sì** («sì, ma metti 30
  g»), non vale come conferma, non scrive niente e manda in scheda — 70 ml di panna sono ~200 kcal
  contro i ~630 di 70 g di olio, e quel numero si scrive guardando il campo. Scrittura dalla stessa
  porta del pulsante in scheda (`FoodSwapsService.aggiorna`), riga riletta prima di scrivere.
  37 test, con controllo per mutazione. Decisione in `DECISIONE_Verificare_Cambi_A_Voce.md`.

- `[Sviluppo]` 📝 **Vera: la giornata dettata a parole** (voce 241, lettura B scelta da Simone). Il
  rischio della B — «pasta al pomodoro» sono più ricette con calorie diverse — si chiude con la
  regola di casa: una sola combacia si propone, più d'una si CHIEDE (con le kcal accanto), nessuna
  si dice. Solo dal pool certificato della cliente, totale contro l'obiettivo prima di scrivere,
  sopra il ±15% non si scrive, e si tocca un giorno solo — se non è ancora stato aperto. 25 test,
  col controllo per mutazione sul modulo puro. Decisione in `DECISIONE_Menu_Dettati.md`.

- `[Sviluppo]` 💪 **«Rifai con più proteine»: la quota proteica minima di UNA cliente** — la terza e
  ultima frase dell'azione 3 (decisione A di Simone, foglio in `DECISIONE_Piu_Proteine.md`). La
  banda esisteva già ma solo per dieta: ora `proteinMinPct` sul profilo vince SOLO sul minimo (il
  massimo resta della dieta). Vera la detta con l'anteprima in percentuale — «dal 20% al 30%», mai
  l'aggettivo —, +10 punti di scorta quando il numero non è detto, tetto al 60%, e si rifanno solo
  i giorni futuri non ancora aperti. Un valore fuori scala 0–1 si ignora: un 30 al posto di 0,30 è
  un errore di battitura. 20 test.

- `[Sviluppo]` 📖 **Il dizionario promosso a comune: il capo conferma sapendo** (domanda di Nocanty,
  risposta di Simone: «chiedi conferma al nutrizionista capo attraverso Vera»). La convivenza resta
  — la voce personale vince sempre sulla comune, e nessuno viene sovrascritto — ma prima del sì il
  capo legge chi ha già una sua versione diversa, con nome e differenze, e la frase dice anche cosa
  NON succede: «le loro restano e continuano a valere». Confronto per radice; chi ce l'ha identica
  non compare. 12 test. Decisione in `NOTA_Dizionario_Promosso_Conferma_Capo.md`.

- `[Sviluppo]` 🗣️ **Vera: «riduci le kcal del 10% a Giulia per 7 giorni»** — la seconda metà della
  richiesta di Nocanty («questa cosa vorrei farla anche dalla mia assistente»). L'anteprima dice il
  numero vero (da 1620 a 1460 kcal/giorno), non la percentuale; se la durata non c'è si chiede, con
  «per sempre» come risposta esplicita; la scrittura passa dalla porta della scheda (permesso,
  storico, avviso ai capi) col motivo = la frase originale. ⚠️ Sotto la soglia di sicurezza Vera si
  ferma e lo dice: quella conferma si dà dalla scheda, davanti al numero. 12 test.
  Decisione in `NOTA_Vera_Detta_La_Correzione_Kcal.md`.

- `[Sviluppo]` ⏳ **La correzione calorica ha una durata** («riduci del 10% per 7 giorni e poi
  riprendi col normale ritmo» — risposta di Nocanty al §15.2 punto 1). La percentuale c'era dall'11/8,
  mancava la scadenza: campo `kcalAdjustUntil` (migrazione additiva, NULL = come prima), guardata al
  momento del calcolo — nessun cron azzera niente —, ultimo giorno compreso e confronto per giorno.
  Il valore non si cancella: si spegne, e la spiegazione lo dice. In scheda `perGiorni` (1..90);
  togliere la correzione toglie la data. La dettatura a Vera è la voce 248.
  Decisione in `NOTA_Correzione_Kcal_A_Termine.md`.

- `[Prodotto]` ✅ **Chiusa la voce 246 «assistente per il coach»**: chiarimento di Simone — «non
  serve un assistente per le coach, alle coach devono solo arrivare le notifiche», e quelle sono
  già vive dalla voce 242 (push alla creazione + escalation alla manager).

- `[Sviluppo]` 🔁 **Vera porta le domande che Gaia gira alla nutrizionista** (richiesta di Simone,
  14/8: «da una parte o dall'altra il nutrizionista risponde»). La segnalazione resta dov'è e si
  aggiunge una porta: richiesta `girata_da_gaia` con chiave `gaia:<escalationId>` — idempotenza e
  legame insieme, senza colonne nuove. La risposta dettata a Vera arriva davvero alla cliente nel
  thread della nutrizionista e chiude la segnalazione; se la scrittura non riesce la segnalazione
  resta aperta e si dice. «La vedo io» chiude solo la domanda; una segnalazione già chiusa dalla
  pagina toglie la domanda da Vera. 12 test.
  Decisione in `NOTA_Vera_Porta_I_Girati_Di_Gaia.md`.

- `[Sviluppo]` 🧩 **Il pasto che manca si prende dalle settimane successive** (regola chiesta da
  Simone, 14/8: «settimana 2 giorno 2 mi manca la cena → la cerco nelle settimane successive»).
  Prima di scartare la giornata monca si ripara: stesso slot, dalle altre giornate della stessa
  dieta e livello, guardando avanti per prime; mai un doppione nella giornata; a parità comanda il
  target calorico. Le caratteristiche sono garantite dalla provenienza — il piatto è del catalogo
  di quella dieta, quindi esclusioni e allergeni restano a valle. Se resta monca, gemella →
  segnalazione come prima. Il ripiego si dice (log + `diet_day_repaired`) e il catalogo va comunque
  completato. Modulo puro `menu/ripara-giornata.ts`, 15 test.
  Decisione in `NOTA_Pasto_Mancante_Dalle_Settimane_Successive.md`.

- `[Sviluppo]` ⏰ **Attività coach: push alla creazione + escalation alla manager** (richieste di
  Simone, 14/8). Prima nascevano mute e si vedevano solo in pagina; ora la coach riceve in-app +
  push alla creazione (da `ensureTask`, l'unico punto in cui nasce ogni attività), e quelle ancora
  «da fare» il giorno dopo la scadenza vanno alla manager delle coach (sales; admin di riserva),
  una volta sola per attività — l'idempotenza è la notifica stessa, niente colonna nuova (schema
  conteso). Tetto 20 per giro, detto nei log. Decisione in `NOTA_Attivita_Coach_Push_Escalation.md`.

- `[Sviluppo]` 🔀 **Vera: «sposta Giulia sulla keto» — il cambio di dieta con «da quando?»**
  (azione 3, dalla risposta di Simone in pagina Lavori). La dieta si cerca nel catalogo (mai
  indovinata), «da subito» rifà i giorni da domani, «lascia i giorni già preparati» li tiene
  (flag nuovo sulla porta della scheda, mai scritto sul profilo); oggi e il passato restano
  fissi per costruzione. Scrittura via `updateClient` (permesso `change_diet_type`), registro
  `variante_cliente`. Il secondo meccanismo (menu dettati) è la voce 241. 22 test visti rossi.
  Decisione in `NOTA_Vera_Variante_Piano.md`.

- `[Sviluppo]` 🥐 **Gaia: sul cambio colazione chiede «dolce o salata?»** (richiesta di Simone,
  14/8, dallo screenshot della chat di Antonio). Passo nuovo `colazione_gusto`: solo la colazione
  e solo senza preferenza detta («una colazione proteica» non fa la domanda). Il gusto sono i TAG
  di Lucia (`piatto:dolce`/`piatto:salato`): senza tag non si partecipa. «Fa lo stesso» cerca
  senza filtro; niente dentro le calorie → nutrizionista, nominando il gusto. Il gusto chiesto
  finisce nel registro del cambio. 10 test visti rossi. Decisione in
  `NOTA_Gaia_Colazione_Dolce_Salata.md`.

- `[Sviluppo]` 🧭 **Vera guida la giornata: «hai segnalazioni per me?»** (richiesta di Simone,
  14/8 mattina — dallo screenshot la domanda cadeva su «non ci arrivo»). Intento `segnalazioni`
  ancorato all'intera frase; il quadro si compone dalle tabelle di origine con le segnalazioni
  CLINICHE in testa (risposta di Simone in pagina Lavori), poi coda del capo, domande aperte,
  sostituzioni e campanella (senza doppi conteggi); subito dopo Vera porta la prima cosa da fare.
  Una fonte rotta si dice («non lo so» ≠ «nessuno»). Decisione in `NOTA_Vera_Guida_Giornata.md`.

- `[Sviluppo]` 🔔 **La campanella del capo quando il team gli mette una proposta in coda**
  (`vera_proposta_in_coda`, solo in-app; l'email resta al conflitto sanitario; niente doppia
  campanella se la riga è anche un conflitto). Prima la coda si scopriva solo aprendo la pagina.

- `[Sviluppo]` 📋 **L'elenco delle clienti scoperte arriva al capo** (voce
  `vera-regola-dieta-scoperte`, decisione 13/8): all'approvazione di un divieto di dieta il
  messaggio dice chi resterebbe senza quale pasto, con nome; l'elenco si persiste nel dettaglio
  della riga. Chi aveva già lo slot vuoto per le sue esclusioni non è «scoperta dalla regola».

- `[Sviluppo]` ↕️ **Voce 237: la chat di Vera si ridimensiona** — bordo inferiore trascinabile,
  altezza ricordata (`metabole_bo_vera_chat_h`); si salva solo l'altezza scelta trascinando.
  36 test nuovi visti rossi (341 verdi su Vera); tsc e jest in sandbox al baseline.

- `[Sviluppo]` 📊 **La tabella dell'indice glicemico è pronta da importare** (voce rossa di ieri,
  sbloccata dal crudo/cotto §16). 96 righe trascritte dal PDF del capo nutrizionista
  (`prisma/dati-ig.ts`, International Tables 2008), OGNI riga con lo stato esplicito — la pasta è
  dichiarata bollita, e «80 g di spaghetti» a crudo non può più sbagliare di 2,5 volte. Script
  `npm run importa:ig` (prova di default, CONFERMA=1): le righe nuove nascono CONFERMATE dal capo
  (Decisioni §10); un nome già in tabella senza IG riceve SOLO l'indice (le macro curate non si
  toccano); un nome con l'IG non si tocca affatto. Si lancia dalla shell di Render. **LANCIATO il 14/8
  mattina: 63 nuove + 4 solo-IG + 29 già complete.** Voce chiusa.

## 2026-08-13

- `[Sviluppo]` 👋 **Vera: il saluto davanti non spiazza più** («Ciao Vera, hai la lista…?» cadeva
  su «non ci arrivo» — Nocanty, 18:05). Saluto e vocativo si tolgono prima di leggere, e il
  vocativo si mangia solo con la virgola: «Senti, a Giulia niente tonno» si tiene la sua Giulia.
  3 test nuovi (305 verdi su Vera).

- `[Sviluppo]` 📖 **Vera: la famiglia chiesta a secco (dalla prova di Nocanty, 17:47).** «Hai la
  lista dei formaggi molli?» mostra l'elenco del dizionario — è l'unica domanda che scavalca il
  filtro «le domande non si eseguono», perché mostrare non esegue niente. «Crea/rifai la lista
  dei…» apre l'apprendimento fuori da una regola, e quando l'elenco arriva si chiude lì: nessuna
  anteprima, nessuna cliente. 7 test nuovi visti rossi (302 verdi su Vera, corpus compreso).

- `[Sviluppo]` 📬 **Il report mensile di Vera parte da solo** (voce chiusa): il 1° del mese, ai capi
  nutrizionisti, notifica in app + email col riassunto (azioni scritte, in approvazione, conflitti,
  frasi non capite). Step `veraReportMensile` nel cron giornaliero — il metodo controlla da solo la
  data ed è idempotente (la notifica del mese fa da marcatore). 4 test visti rossi. E l'estrattore
  del battesimo capisce la SECONDA persona («ti chiamerai Vera», «voglio chiamarti Vera» — le frasi
  vere di Nocanty) + baco sulle accentate. Chiuse nel file anche: ai-assistant (acceso da Simone da
  Parametri), varianti-3-pasti (generate, risposta in pagina).

- `[Sviluppo]` 🕐 **La mezz'ora delle voci veloci (scelte da Simone):** (1) gli **spuntini esclusi
  da Vera si vedono in scheda cliente** (riga in sola lettura — voce 235, parte backoffice; l'app
  con la prossima OTA); (2) l'**avviso di conflitto sanitario va anche via EMAIL** ai capi
  (`MailService` opzionale in `avvisaConflittoSanitario`: una mail giù non ferma né le altre né
  l'in-app — 3 test visti rossi); (3) la **presentazione di Vera** senza «battezzarmi»: «che nome
  mi dai?». E la domanda §15.2 punto 1 è stata tradotta per Nocanty: percentuale standard e tetto
  della correzione calorica.

- `[Sviluppo]` ☕ **Colazioni, terza passata dalla pagina in uso:** «Selezione → salate/dolci» per
  le 472 senza proposta (il tipo lo dice chi seleziona), e il filtro dei composti impara i
  singolari — «pistacchio salato» e «nocciola salata» erano finti conflitti.

- `[Sviluppo]` 🩺 **«Serve la visita» parte in automatico — chiusi gli ultimi due rossi della pagina
  Lavori (Decisioni §15).** I criteri sono la risposta testuale di Nocanty: «allergia dichiarata,
  utilizzo farmaci, problemi sanitari» — cioè `allergies` non vuoto o `screeningFlag`, lo stesso
  criterio di `daValutare()`. La presa in carico ora parte da TUTTE e tre le strade (questionario,
  scheda in home, campagna in chat) — prima l'allergia da sola non apriva niente. Paletti: solo se
  `idoneita` è vuota (una valutazione scritta non si riapre da un automatismo), dedup di
  `apriSegnalazione`, evento e mai cron. E il «freno forte» è DECISO: non esiste («non fermiamo
  nessuno»), la campagna copre il buco. 4 test nuovi visti rossi.

- `[Sviluppo]` ✅ **La spunta viaggia col file (richiesta di Simone).** `voci-iniziali.ts` ha il
  campo `fatta`: il caricamento (pagina E script) SPUNTA le voci esistenti che il file dichiara
  finite — mai il contrario, una spunta tolta a mano non si riapre da un file. Chiuse dal file:
  solfiti, deploy, OTA 2.1.8, verifica Mac, §7 ri-domanda, scala passi, peso efficacia, battesimo,
  soglia visita, freno forte. 4 test nuovi visti rossi.

- `[Sviluppo]` 📦 **OTA 2.1.8, il pezzo mancante:** lo zip non era mai stato copiato in
  `backend/ota-bundles/` — Render annunciava la versione e i telefoni scaricavano un 404 (gli
  `ota_error` lo dicevano). Copiato e ripushato; i telefoni si aggiornano al doppio riavvio.

- `[Documenti]` 🥘 **Crudo/cotto: la tabella di Nocanty è arrivata (Decisioni §16).** Default crudo
  per amidi/legumi/carni/pesci, domanda alla nutrizionista sopra il 30% di scarto, conversion
  ratio. Sblocca la ricerca per nome dei valori nutrizionali e l'import dell'indice glicemico:
  codice domani, a mente fresca — tocca i numeri nel piatto.

- `[Sviluppo]` 🥪 **Vera, azione 3 — «togli lo spuntino» (Decisioni §14).** Campo nuovo
  `ClientProfile.pastiEsclusi` (migrazione additiva, solo spuntini: i pasti principali restano su
  `fastingWindow`). Le kcal NON si perdono: gli slot esclusi escono prima della composizione e il
  target si ridistribuisce sui pasti rimasti — stessa strada del digiuno, unificata in
  `slotEsclusiTotali()`. «Lo spuntino» secco → Vera chiede quale (mattina/merenda/tutti e due);
  «rimetti» fa il percorso inverso; niente ambito «per tutte» (sarebbe una regola di dieta, azione
  6). I giorni futuri mai aperti si rifanno con la regola dell'annulla — criterio ribaltato per il
  «rimetti». ⚠️ Trappola disinnescata: «togli lo spuntino» veniva letto dai DIVIETI come *vietare
  l'alimento «spuntino»*. 27 test nuovi visti rossi. Voce 235: il dato non si vede ancora in scheda.

- `[Sviluppo]` ☕ **Pagina Colazioni: selezione per riga e invio a pacchetti (richieste di Simone
  dalla produzione).** «Conferma le 986 proposte salate» sbatteva sul tetto dei 500 per chiamata:
  ora la pagina spezza in pacchetti da 500 e somma l'esito. Flag di selezione su ogni riga,
  «Seleziona la pagina», «Conferma la selezione (N)» — ogni riga spuntata si conferma con la SUA
  proposta; le spuntate senza proposta si saltano e si dice quante.

- `[Sviluppo]` ☕ **Colazioni dolci e salate: propone il sistema, conferma Lucia (Decisioni §12).**
  Nasce dall'azione 3 di Vera («a colazione qualcosa di salato»): il dato non esisteva, e non
  riguarda 14.000 ricette ma solo lo slot colazione. Convenzione `piatto:dolce`/`piatto:salato` su
  `Recipe.tags` — il tag scritto È la conferma, la proposta si calcola al volo e non si salva.
  Classificatore che NON indovina (conflitto = nessuna proposta; ricotta/pane/yogurt/pancake fuori
  dalle liste di proposito), pagina «Colazioni» nel backoffice con conferme in blocco, endpoint su
  `RecipesController`, permesso derivato da `recipes`. L'azione di Vera resta spenta finché le
  conferme non bastano. 19 test nuovi (visti rossi: «torta salata» usciva *dolce* — preso dal test).

- `[Sviluppo]` 🪥 **Vera: il battesimo non si perde più (dagli screenshot di Simone).** Il saluto
  chiedeva il nome ma lo stato scadeva in 2 ore: dopo, ogni risposta cadeva su «non ci arrivo» e il
  battesimo restava irraggiungibile per sempre. Ora è una **condizione sui dati** (`nomeAgente`
  vuoto), non uno stato appeso al messaggio; l'estrattore capisce «ti chiamerò X»/«sarà X»/il nome
  secco/«scegli tu» e non prende più la prima parola («Ciao ti chiamerò Vera» → si sarebbe chiamata
  «Ciao»). «Annulla» a vuoto ora lo dice. Finestra della chat a ~640px. 9 test nuovi, 214 di Vera verdi.

- `[Sviluppo]` 📣 **Campagna allergie a TUTTI i 48 (decisione di Simone, Decisioni §13).** La conta
  su Render: 0 intolleranze ignote, 3 da codificare, 24 mai risposto, 21 a posto. Trovato e chiuso
  un buco: `chiedi:allergie` scriveva solo la campanella in app, nessuna push al telefono — ora la
  push parte alla scrittura vera. Script nuovo `avvisa:allergie` per il complemento (24 → portati
  alla scheda in home; 21 → informativa sul profilo), prova di default, `CONFERMA=1` per mandare.
  Si lancia il 14/8 alle 11, DOPO Render + OTA; promemoria programmato.

- `[Sviluppo]` ☕ **Correzione al classificatore delle colazioni, dal primo sguardo in produzione:**
  «mais dolce» aveva proposto *dolci* le acciughe marinate. I composti (mais dolce, patata dolce,
  burro salato…) ora si tolgono prima di cercare gli indizi; acciughe/alici aggiunte ai salati.
  2 test visti rossi. I numeri: **2653 colazioni**, ~967 proposte salate, ~1204 dolci, ~480 da
  decidere a mano.

- `[Sviluppo]` 🗣️ **Gaia richiede quello che di un'allergia non sappiamo (§7 dell'handoff).** La
  scheda in home che esce stasera prende chi non ha **mai** risposto; restano fuori due cose che una
  casella da spuntare non sa fare, e per quelle serve parlare: chi ha segnato «Altro» fra le
  intolleranze e non ha mai potuto dire cosa (il campo non esisteva fino al 13/8), e chi ha
  un'allergia scritta a mano che nessuno ha tradotto — la scheda in home **aggiunge e non
  sostituisce**, quindi quel testo libero da lì non si tocca e continua a bloccare la base personale.
  Dialogo a due passi sul modello di `data-inizio-chat`, stato nel `meta` dell'ultimo messaggio di
  Gaia, nessuna tabella nuova.
  ⚠️ **Le allergie sono la prima delle tre chiavi** nell'ordine di precedenza: la risposta a «hai
  qualche allergia?» è un elenco di alimenti, e un elenco di alimenti somiglia moltissimo alla
  richiesta di sostituirne uno. Messa dopo, «il latte» avrebbe aperto un dialogo di sostituzione e
  l'allergia non sarebbe mai stata registrata, **senza nessun errore**.
  ⚠️ **Gaia non toglie niente**: se la risposta lascerebbe scoperto qualcosa che prima veniva
  escluso, si ferma e passa alla nutrizionista. Il confronto è sulle parole chiave con cui il motore
  esclude davvero (`exclusionKeys`), non sulle stringhe — «latte» codificato copre «il latte
  vaccino» scritto a mano, e un controllo sulle stringhe avrebbe mandato a una persona una coda di
  casi in cui non c'era niente da decidere.
  ⚠️ **E non salva quello che ha scritto**: propone, fa confermare, e quello che non riconosce va nel
  testo libero. Il dizionario sono le `keywords` di `catalog/allergens.ts`, non una seconda lista;
  le false amiche sono metà del lavoro («latte di mandorla» non è latte, «noce moscata» è una
  spezia), e lo spazio in fondo a `'pan '` si conserva o «panna» diventa glutine.
  ⚠️ **Due tentativi e poi la nutrizionista**, non la coach: il §5 dice che le allergie le scrivono
  solo lei e il capo nutrizionista, e girare alla coach una richiesta che non può soddisfare sposta
  il silenzio invece di toglierlo. Scrittura **dentro** la transazione dell'audit; se fallisce, la
  cliente non legge «fatto».
  Campagna `npm run chiedi:allergie`: prova di default, `CONFERMA=1` per mandare, popolazione da
  `common/da-ricontattare.ts` (la stessa funzione della conta), due popolazioni su tre — la terza la
  chiede la scheda in home. 60 test nuovi + 4 sull'app; type-check del backend senza errori nuovi.
  ⚠️ **Non entra nella OTA di stasera**, ma le due modifiche all'app sono inerti finché la campagna
  non gira: l'intento nasce solo da una notifica che ancora non esiste.

- `[Sviluppo]` 🍷 **I solfiti adesso tolgono qualcosa.** Era una delle voci rosse: fino a oggi
  «solfiti» era **solo la parola letterale**, e i solfiti negli ingredienti non si scrivono mai —
  quell'allergia dichiarata non toglieva un solo piatto. Era voluto e dichiarato: l'elenco decide cosa
  sparisce dal piatto di una persona, e lo doveva dare la nutrizionista. Il 13/8 Simone ha passato la
  sua tabella (Reg. UE 1129/2011 e 1169/2011) e le parole vengono da lì, categoria per categoria:
  frutta essiccata (2000 mg/kg), vino, aceto di vino e di mele, ortaggi sott'olio e in salamoia,
  crostacei freschi e congelati, pesce essiccato e salato, patate disidratate, succhi concentrati,
  senape.
  ⚠️ **Due voci sono larghe e stanno su righe loro**: `aceto` toglie quasi ogni insalata condita,
  `biscotti` la colazione dolce. Sono nella tabella quindi ci sono, ma se Lucia dice che è troppo si
  cancellano quelle due righe e basta.
  ⚠️ **E quello che NON entra conta quanto quello che entra**: «uva» no (l'uva fresca non ha solfiti,
  l'uvetta sì), «patate» no, «pomodoro» no, «limone» no. Si toglie «purè di patate» e «pomodori
  secchi», non la patata e il pomodoro: un divieto che porta via l'insalata di pomodoro non protegge
  nessuno, fa smettere di fidarsi dell'elenco — e a quel punto qualcuno lo disattiva. C'è un blocco di
  test dedicato a **quello che non si toglie**.
  ⚠️ Un test vecchio si è rotto, ed è giusto: diceva «vino: non scartato», che era la verità dichiarata
  finché l'elenco non c'era. Riscritto con la storia dentro. 5 test nuovi + 1 riscritto.

- `[Sviluppo]` 🙋 **Chiediamo le allergie a chi non ce le ha mai dette, dentro l'app.** Decisione di
  Simone: «non fermiamo nessuno; stasera gira un aggiornamento e andiamo a chiedere a tutti quelli
  che hanno l'app installata». Metà delle clienti — **24 su 48** — ha saltato quella pagina del
  questionario, e per loro `allergies: []` non vuol dire «non ne ho»: vuol dire che non lo sappiamo.
  Una **scheda in home**, in cima, che si toglie da sola a chi ha già risposto. ⚠️ Non un popup: il
  popup intercetta una persona che stava andando a vedere il menù, e la prima reazione a un popup è
  chiuderlo. ⚠️ **Si può rimandare** — la cosa che uccide questi avvisi è non poterli chiudere.
  ⚠️ **C'è il campo libero**, non solo i quattordici codici UE: chi ha un'allergia fuori elenco è
  proprio quella che conta di più. E quello che scrive lì **apre una domanda alla sua nutrizionista**
  invece di restare una parola che non toglie niente dal piatto — è quello che è successo con
  «Favismo» e «Carboidrati».
  ⚠️ **Qui la cliente scrive le allergie e in tutto il resto del prodotto non può**: la regola del §5
  protegge dalla *correzione*, qui non abbiamo mai *chiesto*. Da cui i due paletti: si risponde **una
  volta sola** (poi la porta si chiude e lo dice), e si **aggiunge, mai si sostituisce** — una
  risposta nuova non può far sparire un'allergia registrata da qualcun altro.
  ⚠️ «Non ne ho» è una risposta e timbra `allergieDichiarateIl`, che è l'unico modo di distinguerla
  dal silenzio. Scrittura in transazione con l'audit.
  ⚠️ **Doppione evitato**: l'altra sessione stava costruendo la stessa domanda in chat (§7). Decisione
  di Simone: stasera esce solo la scheda; il §7 resta il suo lavoro e uscirà con la sua consegna,
  scrivendo però dalla stessa funzione. 14 test nuovi, verificati rossi prima.

- `[Sviluppo]` 🍽️ **Il divieto di dieta arriva anche ai menu già preparati.** Completa la consegna di
  poco fa: quando il capo approva, i giorni futuri **non ancora aperti** che contengono davvero quel
  piatto si rifanno; quelli **già letti restano come sono** — decisione di Simone, ed è la stessa
  regola dell'annulla (rifare un menu che una cliente ha già aperto, magari dopo la spesa, è la cosa
  che fa scrivere «l'app è impazzita»).
  ⚠️ Si toccano **solo i giorni che contengono davvero il piatto**: buttare via tutti i giorni futuri
  della dieta sarebbe più semplice da scrivere e molto peggio da subire — si rimescolerebbero menu che
  non c'entrano niente per una regola su un solo alimento.
  ⚠️ «Rifare» vuol dire **cancellare** quei giorni e lasciare che la consegna li ricomponga con la
  regola già in vigore: il motore **non** si chiama da dentro l'approvazione, perché
  `applica-proposta.ts` prende `prisma` e basta di proposito — legarlo al modulo dei menu vorrebbe
  dire che un problema lì può far fallire un'approvazione.
  ⚠️ Sopra il tetto di 200 clienti **la regola resta e il rifacimento si salta**, dicendo quante
  persone sono rimaste indietro: il divieto sui menu nuovi costa zero, è il rifacimento a essere
  pesante. 10 test nuovi, verificati rossi prima (il giorno già aperto che veniva rifatto lo stesso, e
  i giorni contati al posto delle persone). Resta l'elenco delle scoperte al capo.

- `[Sviluppo]` 🚫 **La cliente può finalmente leggere cosa non le arriva nel piatto.** Richiesta di
  Simone: due pulsanti nel profilo dell'app — «Cibi assolutamente vietati» (le allergie) e «Cibi da
  evitare» (intolleranze e non graditi). ⚠️ **Il valore non sono i pulsanti, è l'espansione**: oggi
  una cliente sceglie «frutta a guscio» e non sa cosa comporta nel piatto; ora legge noci, mandorle,
  nocciole, pistacchi — **le stesse parole con cui il motore toglie i piatti**. E fa da controllo: se
  ci vede dentro qualcosa che non c'entra, lo dice alla nutrizionista.
  ⚠️ Le parole le dà il **server** (`GET /me/esclusioni`, che usa `menu/exclusions.ts`): se l'app se
  ne tenesse una copia, il giorno che la mappa cambia la cliente leggerebbe un elenco e ne mangerebbe
  un altro.
  ⚠️ **Una voce che nessuno sa tradurre si mostra lo stesso, vuota**: «Favismo» e «Carboidrati» oggi
  non tolgono niente perché quelle parole non compaiono in nessun ingrediente. Nasconderle le
  farebbe sparire una cosa che ha dichiarato lei; mostrarle piene le farebbe credere di essere
  protetta. Escono con la riga «la tua nutrizionista la sta traducendo».
  ⚠️ E resta scritto che **l'elenco non è il permesso di mangiare tutto il resto**: l'esclusione
  viaggia su due strade, e un elenco fa sempre credere di essere completo.
  ⚠️ **Ordine di rilascio obbligato**: l'endpoint in produzione PRIMA della OTA, o i due pulsanti
  danno errore su un'app aggiornata. 6 test nuovi, verificati rossi prima. Nessuna migrazione.

- `[Sviluppo]` 🐟 **Vera §6.2 — «nella mediterranea niente tonno» adesso si applica davvero.** Era
  l'ultimo pezzo che toccava la strada che porta il pasto nel piatto: l'assistente riconosceva la
  frase e apriva la proposta, ma **l'esclusione a livello di dieta non esisteva** — le primitive di
  `menu/exclusions.ts` sono agnostiche, ma ogni chiamante costruiva le chiavi dal `ClientProfile` e
  da nient'altro. Ora vive in `ProductRule` (`diet_excluded_terms`), **senza migrazione**, letta a
  parte e non da `dietRuleOverrides` — che tiene numeri e booleani e scarterebbe una lista di parole.
  ⚠️ **Il divieto è di PAROLE, non di ricette**: vietare gli id di oggi lascerebbe passare la ricetta
  col tonno pubblicata domani — è il difetto del dizionario che invecchia, già pagato una volta. E si
  guarda il **nome e gli ingredienti**, o «insalata di riso» col tonno dentro passerebbe.
  ⚠️ **Due reti, non una**: il pool non propone più quei piatti (filtro a monte) e `evaluateMeals` li
  fermerebbe comunque — è il punto obbligato di ogni erogazione.
  ⚠️ **Uno slot che resterebbe vuoto NON si svuota**: quella cliente resta com'era (decisione di
  Simone del 13/8: chi resta scoperta si salta e si segnala). Una giornata senza un pasto è peggio
  del piatto che si voleva togliere.
  ⚠️ **Riapprovare unisce, non sostituisce**: due approvazioni della stessa cosa non fanno due regole
  e nessuna cancella l'altra. Restano il **rifacimento dei giorni futuri non ancora aperti** e
  l'**elenco delle scoperte al capo**, in lista Lavori. 22 test nuovi, verificati rossi prima (il
  filtro sul solo nome e lo slot a zero che non si segnalava). Suite di Vera e del menu: 842 verdi.

- `[Sviluppo]` 📄 **Vera: passaggio di consegne.** La chat che ha costruito Vera (12-13/8) si è chiusa
  perché era diventata troppo lunga: tutto quello che serve per riprenderla sta in
  `progetto/HANDOFF_Vera_Sessione.md` — le regole di lavoro con Simone, la mappa dei file, le dodici
  regole che non si negoziano, come si verifica (baseline in sandbox, `app.module.spec` sul Mac),
  le trappole già pagate e le due decisioni aperte. ⚠️ Va letto prima di toccare `backend/src/vera/`:
  metà delle scelte che lì dentro sembrano strane sono difetti già pagati una volta.
  In lista Lavori tre voci: `vera-variante-cosa-significa` (cosa vuol dire davvero «una variante per
  questa cliente»), `vera-esclusione-di-dieta` (⚠️ nel motore l'esclusione per-dieta **non esiste**:
  oggi il filtro è solo per-cliente) e `vera-handoff-sessione`.

- `[Sviluppo]` ⚖️ **Quando comanda l'efficacia e quando comandano le stelle, e il via libera clinico
  che non arrivava al server.** Risposta di Simone dalla pagina Lavori — il primo giro completo di
  quel meccanismo: «se abbiamo un problema di umore vincono le 5 stelle, se il problema è il peso che
  non scende vince l'efficacia», e «tre pesi registrati consecutivi».
  **Cambia il segnale**: `plateau` si accendeva su due **cicli** senza calo, ora su **tre pesate**
  ferme o in aumento. ⚠️ Il ciclo dipende da un feedback che qualcuno deve compilare, la pesata è il
  fatto — e la regola vecchia **sparisce**: `agent_plateau_cycles` diventa `agent_plateau_pesate` in
  catalogo e nel seed, perché una manopola che non gira più niente è peggio di una che manca.
  ⚠️ **Soglia secca** (scelta di Simone fra tre): conta solo «fermo o salito». Chi cala di cinquanta
  grammi a pesata **non fa mai scattare l'efficacia** — è il caso «sto dimagrendo pianissimo», è
  voluto, e sta scritto in un test: il giorno che non andrà più bene, è quello a diventare rosso.
  **Quando ci sono tutti e due** nasce `plateau_conforto`: comanda l'efficacia, ma la **domenica**
  vincono le stelle. ⚠️ Stato suo e non flag, perché «peso fermo» e «peso fermo mentre sta giù» si
  guardano con occhi diversi; giorno **fisso e uguale per tutte**, perché uno che si sposta con la
  data di inizio sarebbe invisibile sia alla cliente sia alla coach. ⚠️ Il guardrail del conforto
  lungo resta davanti. Nel motore cambia il **contesto** del giorno e non i pesi, e il «servito di
  recente» si segna su entrambi i contesti — o la domenica riproporrebbe i piatti di sabato.
  **La scala dei passi è confermata** (6.000 → 12.000, +5% ogni due settimane, tetto +40%): il codice
  c'era dal 12/8, aspettava solo il sì. ⚠️ Tolta l'avvertenza «da confermare» dal file: uno che
  dichiara di aspettare un permesso già arrivato ferma la prossima persona che lo legge. Il caso
  clinico continua a non calcolarsi: passa dalla nutrizionista via Vera.
  ⚠️ **E il via libera clinico era rotto in produzione da stamattina**: `Cannot POST
  /api/v1/clients/<id>/idoneita` — mancava il prefisso `admin` che tutte le altre rotte della scheda
  hanno. Nessuna valutazione è mai arrivata al server. Si vedeva male perché il banner sta in cima e
  il pulsante in fondo: ora la pagina risale al banner anche quando va bene, perché una decisione
  clinica senza nessun segno visibile si rifà una seconda volta. La valutazione di Antonella va
  rifatta. 15 test nuovi, verificati rossi prima.

- `[Sviluppo]` 🤖 **Vera: le ricette si dettano (azioni 4 e 5).** «Inseriamo una ricetta per il menu
  keto» e «voglio cambiare la ricetta tonno alle olive». Lei la scrive come su un quaderno — nome,
  ingredienti con le quantità, pasto e regime — e l'assistente la legge con una funzione pura.
  ⚠️ **I valori non si dettano**: kcal e macro si sommano dalla tabella nutrienti, la stessa da cui
  Gaia cita i valori alle clienti. Se un alimento non c'è, la ricetta **si ferma**: `Recipe.kcal` è
  obbligatorio e l'unico modo di riempirlo sarebbe indovinarlo, mentre su quei numeri il motore
  calcola le giornate. Il termine finisce in `NutrientLookupMiss`, cioè nell'elenco di quali
  alimenti aggiungere per primi.
  ⚠️ **La ricetta nuova nasce spenta**: una ricetta attiva entra nel motore, e il motore non chiede
  il permesso a nessuno. La accende il capo approvando — e approvare non conferma gli allergeni.
  ⚠️ **La modifica non si scrive**: quella ricetta è già nei piatti di oggi. Vive nella proposta e
  diventa vera all'approvazione, dove `active` viene tolto dai campi — riscrivere `false` su una
  ricetta viva la farebbe sparire dai menu senza che nessuno l'abbia chiesto e senza nessun errore.
  ⚠️ Le approssimazioni si dicono: i millilitri contati come grammi, e «sale q.b.» lasciato fuori dal
  conto ed elencato.
  Decisioni di Simone del 13/8: bozza + coda del capo, macro calcolati e mai inventati.
  Verifica: type-check 43 = baseline, backoffice pulito, 1733 test contro 1670.

- `[Sviluppo]` 🤖 **Vera: «aspetta te» si vede dalla home.** Le cose che aspettano una persona
  stavano dentro la pagina dell'assistente, e una coda che si vede solo entrando è una coda che si
  guarda quando ci si ricorda di entrare. Ora sono in cima alla home della nutrizionista — proposte
  da approvare, domande aperte, sostituzioni da verificare — con il pulsante per aprire l'assistente.
  ⚠️ È un **blocco** (`b_assistente`) e non un modulo: i moduli funzionano a inclusione, quindi chi
  ha già personalizzato la dashboard ha una lista salvata che non può contenere un id nato oggi — e
  proprio chi usa di più il backoffice sarebbe l'unico a non vederlo mai. Come blocco si vede di
  default e si spegne da Impostazioni → «Blocchi della tua home», che è quello che ha chiesto Simone.
  ⚠️ `home: ['nutritionist']` fa da filtro di ruolo da solo: quella home la aprono nutrizionista e
  capo nutrizionista e nessun altro, quindi nessuna mappa di default per ruolo da inventare.
  ⚠️ Se non c'è niente da fare il blocco sparisce invece di dire «zero». Nessun cambio al backend:
  `/vera/aspetta-me` c'era già.

- `[Sviluppo]` 🤖 **Vera: il dizionario non invecchia più da solo.** «Formaggi molli» sono nove nomi
  spuntati un martedì: entra in catalogo la burrata, la lista non la contiene, e la regola della
  nutrizionista continua a esistere e a girare **su un elenco vecchio**. Nessun errore, nessuna riga
  rossa: copre meno di quello che lei crede, e la differenza si vede solo nel piatto di qualcuno.
  Ora l'assistente guarda cosa è entrato **da quando** le ha insegnato quella parola e glielo chiede.
  ⚠️ Lo chiede **lui e non una schermata del catalogo**: chi pubblica una ricetta non sa cosa vuol
  dire «molle» per Lucia, e chiederglielo lì vorrebbe dire far decidere a una persona il vocabolario
  di un'altra — o, più probabilmente, far premere «avanti».
  ⚠️ È **l'ultima** cosa che porta all'apertura: dietro le altre code c'è qualcuno che aspetta, qui
  dietro no. E **una famiglia per volta**: tre insieme sono un modulo da compilare, e a un modulo si
  risponde «va bene tutto» senza leggerlo.
  ⚠️ Il confronto è sulla **parola-testa** («yogurt greco» → *yogurt*) e non su una parola qualsiasi
  in comune: condividere l'aggettivo non vuol dire essere lo stesso cibo. Doppia radice, come
  `chiaveLarga`, altrimenti «formaggio» e «formaggi» non combaciano mai.
  ⚠️ Un «nessuno» **scrive lo stesso**: sposta la data della voce, che è la linea fra il vecchio e il
  nuovo. Senza, la stessa domanda tornerebbe identica per sempre — ed è il modo più rapido per
  insegnare a non leggerla.
  Verifica: type-check 43 = baseline, backoffice pulito, 1692 test.

- `[Sviluppo]` 🤖 **Vera, consegne 3c e 4: il registro dice CHI è stato, e l'assistente smette di
  poter marcire in silenzio.** Il registro sotto la chat non mostra più solo quello che ha fatto
  l'assistente: mostra **tutto quello che è cambiato** sulle sue clienti — lei, Gaia, la cliente
  dall'app, lo staff, il motore — con la colonna «Chi». ⚠️ Non è una tabella nuova: `unisciRegistro`
  fonde in lettura `AzioneVera`, `AuditLog` e `FoodSwap`, perché una quarta copia va tenuta allineata
  per sempre e il giorno che si disallinea nessuno se ne accorge — un registro sbagliato non produce
  nessun errore. ⚠️ Solo le righe dell'assistente si annullano da qui: disfare da questa pagina una
  scelta della cliente sul suo profilo sarebbe disfarla da una schermata che non è la sua.
  ⚠️ `profile.update` lo scrive la **cliente dall'app**, `client.update` lo scrive lo **staff**:
  confonderli vorrebbe dire attribuire alla nutrizionista una cosa che ha fatto la cliente, che è
  esattamente la domanda a cui quella colonna serve a rispondere.
  **La pagina ha la sua chiave di permesso** (`nutri_assistant`), come da nota dell'altra sessione e
  dalla regola di Simone del 13/8: con la chiave delle Sostituzioni le due voci di menu si davano e
  si toglievano insieme. ⚠️ La chiave nasce insieme alla guardia che la legge — **e** alla riga
  `can('nutri_assistant', 'manage')` dentro la pagina, che è il posto dove dimenticarsene non produce
  nessun errore: la pagina si aprirebbe lo stesso.
  **Il testo incollato è una citazione**: quello che sta dentro `>` o fra tre virgolette si legge,
  non si esegue. Andava fatto prima di aprire quella porta, non dopo. E **«fuori portata» non è più
  solo un no**: una regola su un tipo di dieta apre una proposta in coda al capo, invece di finire in
  un messaggio che scende.
  **Consegna 4.** (1) Una regola confermata sopra un vincolo sanitario **avvisa i capi il giorno
  stesso** — la regola si scrive comunque, comanda lei, ma a fine mese quella cliente ha già mangiato
  trenta giorni di menu; ⚠️ non avvisa l'autrice, che lo sa già: una notifica per una cosa appena
  fatta da soli insegna a chiudere le notifiche senza leggerle. (2) Il **report del mese** si apre
  dalla pagina e si ricalcola ogni volta — un report congelato comincia a mentire il giorno dopo —
  e non conta la produttività: conta **quante regole sono state scavalcate** e **quanto viene
  annullato**, che è l'unico numero che dice se l'assistente ha smesso di capire. (3) Il **corpus**:
  le frasi capite (dal registro) e quelle su cui si è fermato (accoppiando i messaggi, così funziona
  anche sulle conversazioni già avvenute) — l'elenco da rileggere prima di toccare `capisci.ts`.
  ⚠️ Tolto un doppione in `voci-iniziali.ts`: le voci di Vera c'erano **due volte** con chiavi diverse
  (le due sessioni hanno trascritto le stesse cose), e al primo `carica:lavori` sarebbero diventate
  quattro righe doppie in pagina.
  Verifica: type-check 43 = baseline, backoffice pulito, 1670 test contro 1627.

- `[Sviluppo]` 💬 **La pagina Lavori: le risposte si scrivono lì, e le voci nuove si caricano senza
  shell.** Due richieste di Simone. **Il campo Risposta** — «così posso consultarmi, inserire mano a
  mano, e poi te le esporto al momento giusto»: molte voci aspettano la risposta di qualcun altro, e
  quella risposta viveva in una chat o in una mail, cioè da nessuna parte. ⚠️ Campo suo e non dentro
  `dettaglio`: il dettaglio è la **domanda**, questa è **quello che è arrivato** — in un campo solo,
  per aggiungere ciò che si è saputo si riscriverebbe ciò che si voleva sapere. ⚠️ E **non spunta la
  voce**: «l'ho saputo» e «l'ho fatto» sono due stati diversi, e confonderli farebbe sparire
  dall'elenco proprio le voci pronte da lavorare. Svuotandola si azzerano chi e quando, come per la
  spunta.
  **«Copia per Claude»**: il testo lo fa il **server**, non la pagina — se se lo costruisse il client,
  fra un mese quello incollato in chat e quello mostrato direbbero due cose diverse, e chi legge in
  chat non avrebbe modo di accorgersene. Solo le voci **aperte** (lo storico sono 481 righe:
  annegherebbe le dieci che contano), blocchi per primi, risposta firmata.
  **«Carica le voci nuove»** al posto della shell. ⚠️ **Due gesti, non uno**: il primo clic non
  scrive, mostra cosa aggiungerebbe — è il `CONFERMA=1` dello script, e un pulsante che scrive al
  primo clic butterebbe via quella sicurezza dove è più facile premere per sbaglio. ⚠️ Non aggiorna
  ciò che trova (può essere stato spuntato o riscritto) e lo dice nel riepilogo.
  ⚠️ L'elenco si è spostato in `src/lavori/voci-iniziali.ts` e lo script lo **importa**: una lista
  sola. Con due copie, fra un mese shell e pagina caricherebbero elenchi diversi — è la stessa
  ragione per cui la conta delle allergie e la campagna passano da `common/da-ricontattare.ts`.
  ⚠️ Lo storico resta da shell: vive in un JSON accanto allo script, che in `dist/` non c'è.
  Migrazione additiva, **applicata sopra lo schema riletto dal disco** dopo il modello
  `RichiestaVera` dell'altra sessione — non è stata rimessa una copia parcheggiata. 6 test nuovi,
  verificati rossi prima. Suite dei lavori 17 verdi.

- `[Sviluppo]` 🙋 **Vera — Consegna 3b: le domande che aspettano una nutrizionista.**
  Implementa `progetto/CONTRATTO_Vera_Richieste.md`, il confine fra le due sessioni. Quando il
  sistema incontra una parola che **non sa tradurre** — «Favismo», che oggi non toglie un solo piatto
  perché non compare in nessun ingrediente — non inventa e non blocca: **apre una domanda**, e la
  domanda arriva a chi sa rispondere.
  `apriRichiestaVera(prisma, dati)` è una **funzione** e non un servizio da iniettare (come
  `registra-sostituzione.ts`): chi la chiama sta dentro il percorso che salva un questionario, e
  legarlo a un modulo di backoffice vorrebbe dire che un problema qui fa fallire il salvataggio di
  una cliente. **Non lancia mai**, ma l'errore va nei log — una coda che smette di riempirsi in
  silenzio è peggio di una coda vuota, perché sembra che non ci sia niente da fare.
  ⚠️ **Idempotente sulla chiave**, ed è il punto: senza, il primo lavoro programmato che gira ogni
  notte riaprirebbe la stessa domanda ogni notte e in una settimana la coda è illeggibile. La seconda
  chiamata **non fa niente e non è un errore** — e soprattutto **non rimanda la notifica**.
  ⚠️ **Le domande vivono in un ELENCO** (`richiesta_vera`), non solo come messaggi in chat. Se
  vivessero solo nel dialogo, in due settimane sarebbero una chat lunga in cui le cose scendono e
  nessuno saprebbe più cosa manca: è la stessa ragione per cui il 13/8 è nata la pagina Lavori invece
  di fidarsi del REGISTRO.
  ⚠️ **Da una risposta escono DUE scritture, e non si fondono.** Gli alimenti vanno sulle esclusioni
  di **quella** cliente, subito, **passando da `ClientsService.updateClient`** — il punto unico che
  controlla `change_allergies`, ricalcola `allergiesOther` e lascia la traccia; una seconda strada
  per lo stesso dato sanitario è il difetto che questo campo ha già avuto due volte. La parola nel
  dizionario **di tutte** è invece una **proposta in approvazione**, mai una scrittura diretta:
  una traduzione clinica data di fretta su una cliente non deve entrare nel vocabolario di tutte
  perché qualcuno ha risposto in fretta a una domanda.
  Dettagli che valgono oltre: la domanda si mostra **com'è stata scritta** da chi sa cosa manca
  (riformularla vorrebbe dire che quella che legge la nutrizionista è la versione di chi NON sa cosa
  manca); una cliente **senza nutrizionista assegnata** non fa sparire la domanda, la vede il capo;
  e per il capo **le proposte da approvare vengono prima delle domande** — dietro una proposta c'è
  una persona ferma.
  ⚠️ **`ClientsService` arriva per TOKEN e non per `import`** (`useExisting`, stessa istanza):
  importarlo trascinava mezza applicazione nel grafo di compilazione e i test di Vera smettevano di
  girare da soli per un errore in un file che non c'entra niente. Un modulo che si può collaudare in
  isolamento è un modulo che qualcuno collauderà.
  Aggiunte anche **8 voci alla pagina Lavori** (`carica-lavori.ts`, chiavi `vera-*`): quello che è
  stato scoperto scrivendo Vera e non è stato fatto.
  **Verifica**: type-check **43 = baseline**, backoffice `tsc -b` pulito, **1621 test** contro 1603.
  ⛔ Restano `npm run typecheck` e `npx jest src/app.module.spec.ts` **nel terminale del Mac**, e
  `CONFERMA=1 npm run carica:lavori` su Render dopo il deploy.

- `[Sviluppo]` 🤝 **Vera diventa la coda delle domande, e il confine fra le due sessioni è scritto.**
  Decisione di Simone: le domande e le richieste arrivano lì, «così la nutrizionista ha le chat con le
  clienti per le risposte base e la chat con Vera che aiuta tutta Metabole ad apprendere».
  Il caso: tre clienti hanno un'allergia scritta a mano che il motore non sa tradurre — ⚠️ e **due di
  quelle tre oggi non escludono niente**, perché «favismo» e «carboidrati» non compaiono in nessun
  ingrediente. Non è traducibile da noi.
  ⚠️ Perché Vera e non una notifica: da **una** risposta escono **due** scritture diverse —
  l'esclusione su quella cliente (dato sanitario: transazione, audit, permesso `change_allergies`) e
  la parola imparata **per tutte** (dizionario). Vera è l'unico pezzo che già le distingue: l'ambito
  si chiede quando la regola nasce, e «a tutte» non scrive, apre una proposta.
  Il contratto sta in `progetto/CONTRATTO_Vera_Richieste.md`: **una funzione sola**
  (`apriRichiestaVera`), nessuno scrive nelle tabelle dell'altro — ⚠️ due sessioni sulla stessa
  tabella con due idee dello stato è il guasto dello schema di stamattina, ma sui dati, e sui dati non
  c'è `git` che lo faccia vedere. La `chiave` è obbligatoria contro la domanda riaperta ogni notte, e
  le richieste devono vivere in un **elenco** e non solo dentro il dialogo. ⚠️ Finché non risponde
  **non si blocca niente**.
  Nel caricamento della pagina entrano le **otto voci** mandate dalla sessione di Vera, che sulla
  pagina non può scrivere. ⚠️ La nona no: era la stessa decisione di `decisione-blocco-percorso`, e
  due righe per la stessa decisione sono il modo in cui una lista smette di essere creduta.

- `[Sviluppo]` 🛃 **Vera — Consegna 3a: la coda di Nocanty, una proposta per volta e in ordine
  di rischio.** La Consegna 2 sapeva **creare** proposte «in approvazione» e non c'era modo di
  approvarle: restavano ferme. Ora il capo apre la stessa pagina e il suo agente gliele sottopone
  **una per volta**, già istruite — chi l'ha dettata, quando, **la frase originale**, e cosa comporta.
  «Già istruita» non è cortesia: se per sapere cosa approva deve aprire altre cinque schermate, non
  le apre. «Sì» applica; «no» **chiede il motivo**, obbligatorio, perché un no senza spiegazione è la
  cosa che insegna a smettere di proporre.
  ⚠️ **Ordine per rischio e non per data**: prima i conflitti sanitari, poi il raggio largo, poi la
  più vecchia. Una coda cronologica fa arrivare per ultima la cosa più importante.
  ⚠️ **L'approvazione in blocco non esiste, e non c'è nemmeno l'endpoint** (decisione di Simone del
  12/8): un «approva tutte» in tre settimane diventa l'unico pulsante che si preme.
  ⚠️ **Una nutrizionista non può approvarsi da sola**: il controllo del ruolo sta nel **servizio** e
  non solo nella guardia del controller — è la riga che rende la coda una coda.
  **Approvare è l'unica azione del progetto che scrive su molte persone in una volta**, ed è il
  motivo per cui la coda esiste. Il perimetro è quello di **chi ha proposto** e non di chi approva
  («a tutte» detto da una nutrizionista vuol dire «a tutte le mie»); è **idempotente**, così
  riapprovare non raddoppia niente e il conteggio resta vero; e **sopra le 200 clienti non scrive** —
  dice quante sarebbero e si ferma. In ogni caso **conta e racconta** quante ne ha toccate: un'azione
  che scrive su ottanta profili e risponde «fatto» è un'azione di cui nessuno saprà mai la portata.
  ⚠️ **Una sostituzione estesa NON diventa un gruppo di equivalenza da qui**: la promozione resta
  «promuovi a regola» nella tabella delle sostituzioni (§16.9). Una seconda strada per creare gruppi
  prima o poi decide in modo diverso dalla prima.
  **Verifica**: type-check **43 = baseline**, **1603 test** contro 1583.
  ⚠️ **Superficie di collisione zero, ed è voluto**: mentre scrivevo, un'altra sessione aveva
  modifiche non committate su `schema.prisma` e sui file della pagina Lavori. Tutti e 9 i file stanno
  dentro `backend/src/vera/` — nessuna migrazione, nessun campo nuovo, nessuna modifica al frontend
  (la revisione avviene nella chat, che la pagina sa già mostrare).
  ⛔ Restano `npm run typecheck` e `npx jest src/app.module.spec.ts` **nel terminale del Mac**.

- `[Prodotto]` 🎬 **Le schermate 28-30 dell'app: due decisioni che tolgono lavoro invece di
  aggiungerlo.** Erano in lista come «servono decisioni». Guardando il codice, una era **già decisa**
  e l'altra non ha più il problema per cui era nata.
  **I video di coach e nutrizionista (28-29) restano annullati**: la decisione è di Simone del 17/07,
  scritta in `metabole-backlog.md`, e il codice è d'accordo — nessun player nell'app, nessun campo
  video su `Staff`. ⚠️ Era rimasta in lista come un arretrato: una decisione presa che continua a
  girare fra le cose da fare costa due volte, la prima quando la si ridiscute e la seconda quando
  qualcuno la fa.
  **L'«assaggio del menu» (30) non si fa**: nasceva come vetrina prima del paywall, e dall'11/8 il
  paywall non c'è più — «Conosciamoci» dà un menu **vero**, gratis, per otto giorni. Un assaggio
  finto davanti a un menu vero è una schermata in più fra la cliente e la sua app.
  ⚠️ Il dubbio vero era chi sceglie una data lontana e non vede il menu fino a due giorni prima: ma
  `MenuStatusBanner` nello stato `scheduled` **già le dice** quando parte il piano, quando si sblocca
  il menu e che può chiedere a Gaia di spostare la data. Verificato nel codice prima di decidere, non
  dedotto dai documenti. Se un giorno si rifacesse, la forma è scritta: una giornata vera dal motore,
  e se il motore non ce la fa non si mostra niente. Nessun codice toccato, una voce in meno nella
  pagina Lavori.

- `[Sviluppo]` 🌍 **Tre test erano veri solo a Greenwich.** Rimessa in piedi la suite, tre casi di
  `benvenuto-conosciamoci.spec.ts` (§16.1, 11/8) fallivano sul Mac di Simone con «Expected
  2026-08-16, Received 2026-08-15» — **su codice che funziona**. L'helper del file faceva
  `toISOString().slice(0, 10)` su date che il prodotto costruisce a **mezzanotte locale**
  (`soloGiorno`): a Greenwich coincidono — ed è per questo che CI e Render sono sempre stati verdi —
  ma a Roma (UTC+2) mezzanotte del 16 è le 22:00Z del 15, e il test leggeva il giorno prima.
  ⚠️ **È il difetto peggiore che possa avere un test**: rosso solo sulla macchina di chi lavora,
  verde dove si decide se rilasciare. Chi lo incontra ha due strade, e sono entrambe sbagliate:
  smettere di fidarsi della suite, o «aggiustare» un prodotto che non ha niente che non va.
  Ora l'helper è `giornoLocale` di `common/date-only.ts`, la stessa funzione con cui il prodotto dice
  che giorno è: legge il fuso dell'**azienda**, non quello della macchina. Verificato con
  `TZ=Europe/Rome`, 28 verdi. Il prodotto non è stato toccato.

- `[Sviluppo]` 🧬 **Il type-check diceva verde e ventisei suite non compilavano: guardavano due copie
  diverse dei tipi di Prisma.** Trovato lanciando i test dopo un type-check pulito. `npm run typecheck`
  fa `prisma generate --no-engine`, che scrive in `node_modules/@prisma/client` — quello che legge
  `tsc`. **Jest arriva invece a `node_modules/.prisma/client`**, rimasta a prima delle migrazioni del
  13/8: 26 suite «failed to run» con `'idoneita' does not exist in type 'ClientProfileSelect'`, su un
  campo che nello schema c'era da ore.
  ⚠️ È il guasto peggiore da leggere: due strumenti si contraddicono sulla stessa riga e sembra che
  uno dei due menta. Non mente nessuno — e la conclusione facile («il codice nuovo è rotto») porta
  a rimettere le mani su codice che sta benissimo.
  Nuovo `npm run prisma:tipi`: generate **completo**, aggiorna tutte e due le copie. Il mirror finto
  dei binari (la trovata dell'11/8 contro il 403 di `binaries.prisma.sh`) è stato spostato in
  `scripts/mirror-prisma.mjs` perché ora serve a due comandi: ⚠️ la stessa trovata scritta in due
  file è quella che un giorno viene corretta in uno solo dei due.

- `[Sviluppo]` 🗂️ **La pagina «Lavori»: cosa manca, cosa è fatto, e cosa tiene ferme le altre cose.**
  Richiesta di Simone: «una pagina con modifiche e implementazioni, con l'elenco dei lavori da fare, e
  una volta fatto mettiamo la spunta — così è tutto registrato ed evidente. Visibile solo ad admin».
  Backoffice → **Lavori** (`/lavori`), tabella `lavoro`, migrazione additiva
  `20260813180000_lavori`.
  **Tre colori e una regola sola** (`tonoDi`): 🟢 fatto · 🟡 aspetta una persona o una decisione ·
  🔴 blocca altro lavoro. ⚠️ **Il rosso non vuol dire «importante»**: vuol dire che dietro c'è una
  fila ferma. Se diventasse un modo per dire «urgente», in un mese sarebbe tutto rosso e il colore
  smetterebbe di dire qualcosa — per questo `blocca` è un campo suo e non si deduce dalla categoria.
  I colori vengono dalle variabili del tema: il backoffice ha quattro temi, e un verde scritto a mano
  su fondo scuro è illeggibile in uno di quelli.
  ⚠️ **Il permesso è una chiave della matrice** (`dev_backlog`, default solo admin) **e non
  `@Roles('admin')` scritto nel codice**: è il difetto già raccontato in testa a `permissions/pages.ts`
  — `assignments` era un interruttore acceso nei permessi che non apriva niente, perché l'endpoint era
  inchiodato all'admin, e nessun errore lo diceva. La chiave nasce insieme alla guardia che la legge, e
  `@Roles` elenca tutto lo staff apposta: se elencasse tre ruoli scelti a mano, concederla a un quarto
  darebbe 403 su un permesso acceso.
  ⚠️ **Le fatte non spariscono** — restano in fondo con data e nome: una lista in cui il fatto sparisce
  risponde a «cosa resta» e non a «cosa è stato fatto», che è la domanda vera quando qualcuno chiede a
  che punto siamo. E **togliendo la spunta si azzerano chi e quando**: una voce riaperta che dice
  ancora «fatta il 13/8» fa perdere fiducia in tutta la lista. Chiudere un lavoro è **spuntarlo**, non
  cancellarlo: `Elimina` serve solo a chi ha scritto una voce per sbaglio.
  **Caricamento iniziale** `npm run carica:lavori` (prova a vuoto, scrive con `CONFERMA=1`): 20 voci
  aperte da `metabole-backlog.md`, `DA_RIPRENDERE` e le decisioni, più **481 voci storiche** estratte
  dal REGISTRO (dall'11/7), già spuntate con la loro data. ⚠️ Rilanciarlo **non aggiorna niente**:
  salta ciò che trova per `chiave` e lo dice — quella voce può essere stata spuntata o riscritta a
  mano, ed è la lezione di `accendi-automazioni.ts`, che pensato per accenderne tre ne ha spente venti.
  ⚠️ Lo storico è un **estratto**, non una copia: il REGISTRO resta la fonte del dettaglio, e sta
  scritto nella pagina. Istruzioni per chiunque ci lavori — altre sessioni comprese — in
  `progetto/ISTRUZIONI_Pagina_Lavori.md`. 11 test nuovi.

- `[Sviluppo]` 🩺 **La coda del via libera clinico si filtra, invece di cercarla con l'occhio.**
  La pastiglia «da valutare» consegnata stamattina diceva CHI, ma con centinaia di clienti in pagine
  da cento le da valutare si trovavano scorrendo l'elenco — e una coda che si legge scorrendo è una
  coda che si guarda il primo giorno. Ora è un interruttore nella barra dell'elenco Clienti.
  ⚠️ **Filtra nel database, non sulla pagina**: sulle cento righe già scaricate il totale in cima
  direbbe un numero e la tabella ne mostrerebbe un altro, e l'esportazione in Excel dichiarerebbe un
  filtro che non ha applicato.
  ⚠️ **La regola finisce scritta due volte, ed era inevitabile**: `daValutare()` guarda UNA cliente,
  un filtro che pagina e conta deve diventare una condizione che Postgres sa leggere. Le due stanno
  una sotto l'altra in `clients/idoneita.ts`, e `idoneita-filtro.spec.ts` le confronta **caso per
  caso** applicando il frammento Prisma a profili finti — se qualcuno aggiunge un motivo per essere
  valutate e lo scrive in una sola delle due, il test diventa rosso invece di lasciare la
  nutrizionista con un elenco che le sembra completo.
  ⚠️ `serve_visita` resta fuori, come nella pastiglia e nella scheda. E a elenco vuoto la pagina dice
  «Nessuna cliente in attesa: hanno tutte una decisione scritta»: con quel filtro acceso zero righe è
  una buona notizia, e «nessun lead con questi filtri» la farebbe leggere come una ricerca sbagliata.
  Solo nella pagina Clienti: in «Gestione lead» un contatto senza cliente collegata non può essere da
  valutare, e un filtro che non toglie mai niente insegna a diffidare dei filtri. 4 test nuovi,
  verificati rossi contro un `isEmpty: true` messo apposta.

- `[Sviluppo]` 🗨️ **Vera — Consegna 2: la chat parla, e non scrive mai senza mostrare prima
  cosa sta per fare.** La conversazione, le due azioni per-cliente e la pagina `/assistente` (chat
  sopra, registro sotto). L'ordine è tutto il progetto in cinque righe: **capisco** (deterministico)
  → **chiedo** quello che non so → **mostro** la regola tradotta e cosa comporta sul pool →
  **aspetto il sì** → **scrivo**. ⚠️ Non c'è nessuna scorciatoia che salti il terzo e il quarto
  passo: il giorno in cui una scrittura passa senza anteprima è il giorno in cui il registro smette
  di raccontare cosa è successo davvero.
  **⚠️ Il riconoscitore è deterministico, non un modello.** `capisci.ts` è puro, con 16 casi di
  prova. Un modello capirebbe più forme, ma qui la cosa che conta non è capire tanto: è **sapere
  quando non si è capito** — e una funzione pura si collauda con un elenco di frasi vere, che è la
  sola difesa contro il guasto peggiore (che un giorno l'agente smetta di capire le frasi che
  capiva, e nessuno sappia dire quando è iniziato). `AiService` c'è già e può entrare **dopo** e
  **mai al posto**: quando `capisci` torna `null`, una *proposta* — che resta una proposta.
  ⚠️ **«Nella dieta mediterranea niente tonno» NON diventa una regola su una cliente.** Senza quel
  caso, «mediterranea» verrebbe letta come nome di persona, o la regola finirebbe sull'ultima
  cliente nominata. *Dire «non lo so ancora fare» è una risposta; fare la cosa sbagliata con
  sicurezza non lo è.*
  **⚠️ Due difetti della stessa famiglia, trovati dai test, e valgono oltre Vera**: in JavaScript il
  confine di parola **`\b` è ASCII**, quindi dopo la «é» di «perché» e la «ì» di «sì» non c'è nessun
  confine e `perché\b` / `sì\b` **non combaciano mai**. Il primo faceva finire il motivo clinico
  («…perché ha il colesterolo alto») **dentro l'elenco degli alimenti da vietare**; il secondo faceva
  leggere «sì» come «non ho capito» — la risposta più naturale che esista a «Confermi?», cioè la
  funzione sarebbe stata inutilizzabile al primo uso vero. Rimedio: normalizzare gli accenti prima
  di confrontare, e per le parole accentate niente `\b`.
  **La restrizione finisce fra i NON GRADITI, non fra le intolleranze**, ed è una scelta: una
  intolleranza in quel campo **blocca il piano** quando il motore non trova un sostituto sicuro (R8),
  e una decisione dettata a voce non deve poter fermare l'erogazione di una cliente. La sostituzione
  va in `FoodSwap` come riga **`verificata`** con origine **`manuale`** — non `nutrizionista`, che
  vuol dire «letta da una sua frase» e segnala che a poter aver sbagliato è il programma.
  L'**ambito** si chiede quando la regola nasce, predefinito «solo per questa cliente»; «a tutte»
  **non scrive**: apre una proposta in approvazione. Il **conflitto sanitario si ricorda, non
  blocca** — comanda lei, ma mai in silenzio, e quel sì resta nel registro col suo badge.
  ⚠️ **Tabella messaggi propria** (`messaggio_vera`) e non `ChatThread`/`Message`: quelle sono le
  conversazioni **delle clienti**, ci si filtra per `client_id`, e un thread di nutrizionista lì
  dentro comparirebbe negli elenchi clienti di mezzo backoffice **senza dare nessun errore**. Lo
  stato del dialogo vive nel `meta` dell'ultimo messaggio, come per i flussi di Gaia; scade dopo
  **due ore** e non una — una nutrizionista lavora a sessioni, e rifarle dire «quale Giulia?» dopo
  sessantadue minuti è il dazio che insegna a non usare lo strumento.
  Nella pagina: bolle con le **variabili del tema** e non colori scritti a mano (il backoffice ha
  quattro temi, e quelle della chat clienti sono in `#12A386` letterale: si rompono in tre), e una
  **`textarea`** con Invio=manda — su una riga sola non si rilegge una frase che sta per far
  scrivere qualcosa a qualcun altro.
  **Rimandato di proposito**: il contenitore «citazione» per il testo incollato. Serve quando
  l'agente accetta testi altrui, e oggi esegue solo ciò che lei scrive di suo pugno.
  **Verifica**: type-check **42 = baseline di main** (nessuno nuovo, nessuno nei file di Vera),
  backoffice `tsc -b` pulito, **1545 test verdi** contro 1508. ⚠️ Il lavoro è stato **riportato sopra
  main aggiornato** (dopo i commit sulle allergie) e ricollaudato lì, non sulla copia vecchia.
  ⚠️ **Ripristinati tre pezzi dello schema che erano spariti.** Il commit sulle allergie (`67041fb`)
  ha riscritto `prisma/schema.prisma` da una copia vecchia e si è portato via quello che la Consegna 1
  aveva aggiunto il giorno prima: **`MenuDay.viewedAt`, `model FamigliaAlimento`, `model
  AzioneVera`**. I file di codice e la migrazione erano intatti: solo lo schema. Sintomo:
  `Property 'famigliaAlimento' does not exist on type 'PrismaService'` al type-check.
  Il build su Render l'avrebbe fermato (`nest build` fa lo stesso controllo), quindi non sarebbe
  arrivato in produzione — ma il tempo si sarebbe perso lì, a deploy partito. **È la seconda volta in
  due giorni** che una sessione parallela riscrive un file condiviso partendo da una copia vecchia:
  la prima è stata `REGISTRO.md`, con due voci perse. **Regola: prima di riscrivere `schema.prisma` o
  `REGISTRO.md`, rileggere il file dal disco e verificare col `grep` che ci sia ancora quello che
  c'era.**
  ⛔ Restano `npm run typecheck` e `npx jest src/app.module.spec.ts` **nel terminale del Mac**.

- `[Sviluppo]` 🔔 **La coda: chi non ha ancora avuto il via libera clinico si vede nell'elenco.**
  Completa la consegna precedente (§8 dell'handoff: «la cliente in coda nella lista della
  nutrizionista, con il motivo»). Il via libera si poteva **dare**, ma nessuno sapeva **su chi**: per
  scoprirlo bisognava aprire le schede una per una, ed è proprio il caso in cui non aprirne una ha
  una conseguenza. Una porta senza campanello.
  Pastiglia **«da valutare»** nell'elenco Clienti, accanto a «senza glutine», col **motivo** nel
  titolo — «allergie dichiarate» e «patologie o farmaci» non si guardano con la stessa fretta.
  ⚠️ La regola è la **stessa** della scheda (`clients/idoneita.ts`), importata e non riscritta, con un
  test che tiene ferme le due risposte insieme: se l'elenco contasse diversamente, la nutrizionista
  aprirebbe una «da valutare» e ci troverebbe «non serve» — e smetterebbe di fidarsi dell'elenco.
  ⚠️ `serve_visita` **non** compare fra le da valutare: qualcuno l'ha già guardata.
  ⚠️ Il conto sta in `crm.service` e **non** in `clients.service.listClients`: l'elenco Clienti è
  servito dalla lista CRM (tabelle unificate), mentre `/admin/clients` ormai alimenta solo un
  selettore dentro Sostituzioni — ed è il primo posto in cui l'avevo messo. Nessuna migrazione.
  Suite **2310** verde.

- `[Sviluppo]` 🩻 **Il via libera clinico: la nutrizionista può dire «può proseguire», e resta
  scritto.** Domanda di Simone: «se poi metti Visita obbligatoria e la nutrizionista decide che la
  cliente può proseguire, come fa a dircelo? Parte il messaggio sorveglianza sanitaria ma lei come fa
  a dirci ok può proseguire?». La risposta era che **non aveva un modo**.
  Il canale c'era — screening → segnalazione clinica → lei la chiude — ma ha la forma sbagliata:
  ⚠️ la tregua di `riapertura.ts` dura **14 giorni** e poi la segnalazione si riapre (giusto per il
  calo peso, che peggiora; sbagliato per un'allergia, che non passa e il cui via libera non scade su
  un timer); ⚠️ «risolta» dice uno stato, non **cosa** ha deciso; ⚠️ un flag derivato dalle allergie
  non si spegne chiudendo una segnalazione, si riaccende da solo per sempre.
  Ora è una **decisione scritta sulla cliente** — cosa, chi, quando — che **non scade**, e vale per
  tutta la sorveglianza sanitaria, non solo per le allergie: era la seconda metà della domanda.
  **La nota è obbligatoria** (richiesta di Simone: «in modo che anche la coach entrando vede la nota
  del nutrizionista, il campo note esiste già»). Esatto: **non è un campo nuovo**, è una riga della
  lista note che la coach apre già, con autore e ora. Il profilo ci **punta**, non ne tiene una copia.
  ⚠️ Minimo 10 caratteri — «ok» non è una spiegazione — e senza nota valida **non si scrive niente**:
  né la nota, né il profilo, né le segnalazioni.
  ⚠️ **Un gesto solo, non due**: le segnalazioni cliniche aperte si chiudono da sé, con `resolvedAt`
  valorizzato. Se dovesse decidere qui e chiudere di là, prima o poi ne farebbe una sola.
  ⚠️ **Nessun blocco**: percorso e menu continuano. E `serve_visita` **non** è «da valutare» —
  qualcuno l'ha guardata. Permesso `clinical_clearance`. 18 test nuovi, suite **2310** verde.

- `[Sviluppo]` 🔢 **«Non ho allergie» diventa una risposta, e un conteggio da leggere prima della
  campagna.** Chiude il §3 dell'handoff e prepara il §7.
  **L'opzione «Non ho allergie»** nel questionario: le intolleranze avevano già `'none'`, le allergie
  no — e senza, `allergies: []` voleva dire due cose indistinguibili. Il server la filtra come non
  alimento ma **timbra `allergieDichiarateIl`**: quella cliente esce dall'elenco di quelle a cui la
  domanda va ancora fatta.
  **`npm run conta:allergie`**, sola lettura — nessun `CONFERMA=1`, perché non c'è niente da
  confermare. È la conta che il §7.1 chiede **prima** di qualunque campagna: «se la popolazione 3
  sono 280 clienti su 315, non è una campagna, è un difetto del questionario da correggere prima».
  ⚠️ Le tre popolazioni si **escludono a vicenda**: ognuna compare una volta sola, nella categoria
  più urgente. Contarle separatamente darebbe una somma più grande del numero di clienti che
  esistono — ed è il numero da cui si decide se mandare centinaia di notifiche.
  ⚠️ Chi il questionario **non l'ha finito** non si ricontatta: non ha saltato la pagina, non ci è
  ancora arrivata.
  ⚠️ E se la terza popolazione è la maggioranza, lo script **lo dice**: quella non è una campagna, è
  il sintomo di una pagina che non raccoglie. La regola sta in `common/da-ricontattare.ts` con 11
  test, non dentro lo script: chi si riscrive il criterio conta una popolazione e poi ne contatta
  un'altra. 13 test nuovi, suite **2217** verde.

- `[Sviluppo]` ❓ **Chi ha scelto «Altro» fra le intolleranze aveva qualcosa che non sapevamo, e i
  menu la ignoravano.** Punto §1.3 dell'handoff, l'ultimo dei difetti del questionario. Le
  intolleranze avevano l'opzione «Altro» e **nessun campo dove scrivere cosa**: chi la sceglieva si
  portava in banca dati la stringa `'other'` — non è un alimento, non esclude niente, ed
  `expandExclusion('other')` andava a cercare quella parola nei nomi dei piatti. Cioè: aveva
  dichiarato un'intolleranza, e i suoi menu la ignoravano.
  Migrazione additiva `20260813120000_intolleranze_testo_libero` (verificata su PG16 con tutte le
  precedenti) più il campo nel questionario. ⚠️ Stesso disegno di `allergiesOther`: **marcatore, non
  spostamento** — il testo resta anche dentro `intolerances`, che è l'array che esclude davvero.
  ⚠️ **E `'other'` si toglie SOLO se lei ha detto cosa.** Se ha spuntato «Altro» senza compilare — o
  se il questionario arriva da un'app vecchia — la stringa **resta**: è inutile per i menu, ma è la
  sola traccia di quello che non sappiamo, ed è così che si trova chi ricontattare. Toglierla senza
  la risposta vorrebbe dire cancellare la domanda invece di rispondere.
  ⚠️ È anche **l'unica sottrazione ammessa** dentro la regola di ieri, che di norma non toglie mai
  niente: qui non si perde un dato, si **sostituisce una domanda con la sua risposta**. Tenere il
  flag dopo che l'ha spiegato la lascerebbe per sempre fra quelle da ricontattare per una cosa che
  ci ha appena detto.
  Nella scheda cliente ora si vede il testo libero e — quando ha scelto «Altro» senza mai dire cosa —
  una riga esplicita «da chiedere»: prima quella cliente era indistinguibile dalle altre.
  ⚠️ Il campo nel questionario è il **secondo caso speciale** in `campiVisibili`, gemello di
  `allergiesOther`: `showIf` confronta con `equals` e non sa guardare dentro un array. Due casi
  scritti a mano, e sta nel commento — se ne nasce un terzo, va esteso `showIf`. 12 test nuovi,
  suite **2204** verde.

- `[Sviluppo]` 🔐 **Le allergie: la nutrizionista le corregge, dalla scheda cliente e dalla scheda
  lead.** Richiesta di Simone: «nella scheda cliente e scheda lead il nutrizionista li deve leggere e
  poter modificare, magari mettiamo l'impostazione nei permessi». Nuovo permesso `change_allergies`
  («Modifica allergie»), di default a nutrizionista, capo nutrizionista e admin.
  ⚠️ **Flag suo e non «Clienti: gestisci»**, che ce l'ha anche la coach: un'allergia è un blocco
  duro, e chi ne toglie una decide che da domani quella cliente può trovarsi quell'alimento nel
  piatto. Il permesso serve a dare la penna a chi può **codificare** un testo libero in codice UE.
  ⚠️ **Si chiede solo se l'elenco cambia davvero**, come per il tipo di dieta: il form rimanda tutti
  i campi a ogni salvataggio, e chiederlo alla presenza del campo vorrebbe dire che una coach non
  riesce più a salvare nemmeno un numero di telefono — con un errore che parla di allergie.
  ⚠️ **`allergiesOther` si ricalcola qui, e solo qui.** Dedurre il testo libero per differenza dal
  catalogo UE è la cosa che `common/allergie.ts` evita — ma lì si indovina a posteriori su dati che
  nessuno ha riletto; qui una nutrizionista ha l'elenco davanti e preme Salva. È il ripopolamento
  «dalla nutrizionista» previsto quando la colonna è nata. Correggerle vale come **dichiararle**,
  così la cliente esce da quelle da ricontattare.
  La **scheda lead** scrive dallo **stesso endpoint** della scheda cliente: un endpoint dedicato
  sarebbe una seconda strada per lo stesso dato sanitario, ed è il difetto che questo campo ha già
  avuto due volte. Senza account collegato non si scrive e lo si dice, invece di mostrare un campo
  che sembra funzionare e non salva niente. Le **intolleranze** restano dov'erano: sono già
  modificabili anche dalla coach, e restringerle sarebbe una perdita che nessuno ha chiesto.
  ⚠️ **Correzione a me stesso:** ieri avevo scritto — nel codice e nel messaggio — che «allergie e
  intolleranze le scrive un solo punto in tutto il codice». Per le allergie era vero; per le
  **intolleranze no**, stanno in `PROFILE_FIELDS` da prima. Commenti corretti. La regola dell'unione
  resta, e regge su un motivo migliore: non è «chi può scrivere questo campo», è **«se lo
  cancelliamo per sbaglio, la cliente se ne accorge e lo rimette?»**. 9 test nuovi, suite **2196**
  verde.

- `[Sviluppo]` 🔒 **Il questionario può aggiungere le allergie, non cancellarle.** L'`upsert` del
  questionario è **replace, non merge**: se il DTO non porta `allergies`, il ramo `update` scrive
  `allergies: []` e le allergie della cliente **spariscono** — senza errore e senza traccia. Non è un
  caso di laboratorio: il questionario si rifà, **nessun campo di quella pagina è obbligatorio**, e
  un'app vecchia manda solo i campi che conosce.
  ⚠️ **È il terzo campo che questo stesso upsert perdeva**: l'8/8 il consenso sanitario (sei clienti
  bloccate al carrello, senza via d'uscita), l'11/8 il tipo di dieta (spostato dallo staff e tornato
  indietro due volte, in silenzio). Le altre due volte si è sistemato il campo saltato fuori; stavolta
  la regola sta **fuori**, in `common/non-perdere.ts`, così vale anche per il quarto.
  **La regola è asimmetrica, ed è voluto: non si cancella quello che la cliente non può rimettere da
  sola.** Allergie e intolleranze le scrive **un solo punto in tutto il codice** — non stanno nel DTO
  della PATCH cliente, non in `PROFILE_FIELDS`, non nel DTO staff — quindi lì si fa **unione**, mai
  sottrazione. I **cibi non graditi** invece li gestisce lei dal Profilo: lì il questionario è un
  editor legittimo e quello che manda vale, ma se **non manda il campo** non si tocca niente.
  ⚠️ `undefined` e `[]` sono cose diverse, ed è tutto il punto: «di questo non ti ho detto niente»
  contro «non ne ho nessuno».
  ⚠️ **Conseguenza:** dal questionario un'allergia non si toglie più. Era già la regola dichiarata —
  la correzione su un dato sanitario la fa una nutrizionista — solo che finora era aggirabile per
  sbaglio.
  **E non sparisce nei due sensi:** riga di audit `onboarding.esclusioni_non_tolte` per lo staff, e
  una schermata alla cliente prima di proseguire («Restano registrate: … si tolgono parlando con la
  tua nutrizionista»). Tenerle senza dirlo sarebbe metà lavoro: lei crede di averle tolte, i menu
  continuano a escluderle, e la volta dopo che ne parla con la coach nessuna delle due capisce.
  15 test nuovi, gli 8 sul servizio **verificati rossi** contro il comportamento di prima. Suite
  **2187** verde, app 50 verdi.

## 2026-08-12

> ⚠️ Le tre voci qui sotto sotto `2026-08-11` — «Piatto freddo», i gruppi a fisarmonica, «Modifica
> scheda non salvava niente» — sono in realtà commit del **12/8** (`git log`: 06:58, 07:06, 11:01).
> Lavoro notturno scritto sotto la data di ieri: lo stesso scarto del riquadro in testa, al
> contrario. Non le sposto per non riscrivere righe già lette, ma sta scritto qui.

- `[Sviluppo]` 🩺 **Le allergie adesso si vedono — e si sa se sono state chieste.** Punti B, C e D
  dell'handoff. Migrazione additiva `20260812250000_allergie_testo_libero`, applicata e verificata su
  PG16 insieme a tutte le precedenti: due colonne, nessun dato riscritto, nessun backfill.
  **`allergiesOther`** dice quali allergie sono **testo libero**, invece di dedurlo per differenza col
  catalogo UE — deduzione che funziona finché un codice non cambia nome, e allora sbaglia in silenzio.
  ⚠️ **Qui mi sono discostato dall'handoff, ed è una scelta.** Il §2 dice di *separare*: i codici in
  `allergies`, il testo in `allergiesOther`. Verificato in codice: **sette punti** leggono `allergies`
  per escludere davvero gli alimenti — generatore menu, sostituti di Gaia (due), base personale,
  report, CRM, scheda cliente. Spostare il testo libero altrove li disarma **tutti insieme e in
  silenzio**: è il difetto `frutta_a_guscio` rifatto in grande, su un dato la cui conseguenza è una
  reazione allergica. Quindi `allergiesOther` è un **marcatore**, non uno spostamento — una
  ridondanza scritta da un punto solo (`common/allergie.ts`) e verificata da un test, che costa meno
  di sette letture da ricordarsi di aggiornare.
  **`allergieDichiarateIl`** distingue «non ne ho» da «non me l'ha mai chiesto nessuno»: nessun campo
  di quella pagina è obbligatorio, quindi ci si passa sopra senza rispondere. ⛔ **Nessun blocco parte
  da quella colonna**: il «freno forte» lo definisce la nutrizionista — fermare 315 piani perché un
  campo nuovo è vuoto sarebbe un guasto di massa introdotto da una migrazione.
  **E si vedono.** Le allergie non comparivano in **nessuna** scheda: né backoffice, né profilo
  dell'app, né dalla coach. Sono il dato con la conseguenza più grave dei tre (R8: blocco duro, non
  sostituzione) e la cliente non poteva rivedere quello che aveva dichiarato — se ha spuntato la
  casella sbagliata lo scopre dal piatto. Ora una riga in **sola lettura** nel backoffice e in app,
  più le etichette nel registro modifiche (mancavano: una modifica alle allergie sarebbe comparsa col
  nome tecnico del campo). ⚠️ Dove non lo sappiamo **non si scrive «Nessuna»**: dire «nessuna
  allergia» a chi non se l'è mai sentito chiedere è un'affermazione nostra su un dato sanitario che
  non abbiamo mai raccolto. 13 test nuovi, suite **2170** verde, app 50 verdi. Stato punto per punto
  in testa a `progetto/HANDOFF_Allergie_Intolleranze.md`.

- `[Sviluppo]` 🥜 **Un'allergia dichiarata che non escludeva niente — e un test che lo certificava.**
  Primo punto dell'handoff su allergie e intolleranze (`HANDOFF_Allergie_Intolleranze.md`), l'unico
  che non poteva aspettare la OTA. Il questionario salva **`frutta_a_guscio`** con gli underscore; la
  mappa delle esclusioni conosce `'frutta a guscio'` con gli spazi. `expandExclusion` restituiva
  quindi la stringa grezza — che non compare in nessun nome di piatto e in nessun ingrediente — e
  sulla **strada testuale** (i sostituti proposti da Gaia, il pool «ricette semplici») quell'allergia
  **non escludeva niente**. È lo stesso difetto che l'8/8 ha fatto proporre il burro a Giusy,
  allergica al latte: una chiave che la mappa non riconosce si comporta come un'esclusione che non
  c'è, e non produce nessun errore.
  ⚠️ **E c'era un test che lo registrava come regola**: `expect(mancanti).toEqual(['frutta_a_guscio',
  …])`, col commento «non hanno derivati: la parola stessa basta». Per la frutta a guscio quel
  commento era falso — i derivati la mappa ce li ha, sotto l'altra chiave. Un test che fotografa il
  comportamento invece di affermare la regola non protegge: certifica. Ora l'elenco dev'essere vuoto.
  Si normalizzano gli underscore **dentro** `expandExclusion`, non con un alias a mano, così il buco
  non si riapre con la prossima opzione che nasce con l'underscore. ⚠️ Guardando la forma grezza
  **prima** di normalizzare, o l'alias `latticini_` — che esiste davvero — avrebbe smesso di
  funzionare. Aggiunti anche `sedano`, `senape` e `lupini`, opzioni del questionario senza nessuna
  espansione. ⛔ I **solfiti** hanno solo la parola, dichiarato nel codice e in un test: non si
  scrivono negli ingredienti (vino, aceto balsamico, frutta disidratata), e quell'elenco decide quali
  piatti si tolgono dal piatto di una cliente — **lo deve dare Nocanty**, non chi scrive il codice.
  **E «altro» non è un alimento**: era un flag d'interfaccia tolto **solo dal client React**, quindi
  un'app vecchia o una chiamata diretta salvava «altro» come allergene. Ora si filtra lato server,
  calcolato una volta per **entrambi i rami** dell'upsert, con un test per ciascuno. ⚠️ `'other'` fra
  le **intolleranze** non si tocca: non ha un campo libero associato, quindi è l'unica traccia del
  fatto che quella cliente ha un'intolleranza che non sappiamo — ed è la popolazione più urgente da
  ricontattare. 11 test nuovi, suite 2157 verde.

- `[Sviluppo]` ⭐🍽️ **Le stelle, «riceve i menu?» e la dieta assegnata — le ultime tre delle sette
  decisioni del 12/8.**
  **Un piatto mai votato vale ZERO, non cinque** (Simone: «i piatti non votati dalla paziente hanno 0
  stelline, non 5 così cambia tutto»). La formula stava dentro una closure e nessun test la guardava:
  un piatto mai provato entrava a **gradimento pieno**, quindi nello stato «conforto» — umore basso per
  tre giorni → menu più amati — le arrivavano piatti che non aveva mai visto invece di quelli che ama.
  Lo stato faceva il contrario di quello per cui esiste. Ora la formula sta in `menu/punteggio.ts` con
  17 test. ⚠️ La scala è `(stelle − 1) / 4`: **una stella vale come «mai provato»**, non 0,2. Con
  `stelle / 5` un piatto **bocciato** sarebbe rimasto sopra uno sconosciuto, e nel giorno peggiore le
  sarebbe potuta tornare nel piatto proprio una cosa che aveva rifiutato. ⚠️ Ma non va sotto zero: con
  un catalogo ancora poco votato, una penalità vera toglierebbe piatti dal pool di chi ha votato poco.
  ⚠️ Conseguenza da sapere: **con i pesi di default 5★ pareggia esattamente un piatto efficacissimo
  bocciato a 1★** — «lo adora» e «le fa perdere più peso» ora valgono uguale, e per spostare l'ago si
  alza `menu_select_w_eff` dai Parametri. È una manopola, non più un caso. Un test dei menu è cambiato
  per questo: la sua fixture era diventata un pareggio esatto e misurava i pareggi invece della regola
  che dichiarava.
  **«Riceve i menu?» — una regola sola, quella dell'erogazione.** La diagnostica dava per «attiva e
  riceve menu» chi è in **Monitoraggio**, in **pausa vacanza** o col piano **fermato** dal
  nutrizionista: a quelle persone `deliverIfEligible` non manda niente. Era il falso allarme del caso
  Rosaria — un avviso su una dieta incompleta che a lei non sarebbe mai arrivata. Ora `piano-attivo.ts`
  chiede le stesse tre esclusioni dell'erogazione (8 test nuovi). ⚠️ Se i due controlli in più
  falliscono, l'elenco esce lo stesso: una diagnostica che non parte perché un accessorio è andato
  storto non serve a nessuno.
  **«Qual è la dieta assegnata?» — una ricerca sola, la stessa dello staff.** L'11/8, col caso Cristina
  Urbani, la scheda del backoffice è stata corretta: cercava la dieta **per solo nome**, e una famiglia
  ha fino a diciotto varianti che condividono il nome. ⚠️ La correzione era stata applicata **solo al
  lato staff**: nel Profilo dell'app la riga sbagliata è rimasta, e lì la legge **la cliente**. Dalla
  stessa query non usciva solo il nome: uscivano lo **stile** — che decide quale scheda «cos'è la tua
  dieta» si apre — e la **descrizione** sotto il «?». Una cliente onnivora a 5 pasti poteva leggere la
  descrizione, e aprire la scheda, della variante **vegana a 3 pasti** della stessa famiglia. Ora la
  ricerca è una (`catalog/dieta-mostrata.ts`, 8 test) e la usano tutte e due le schermate: variante
  esatta (nome + stile + regime + pasti), altrimenti la dieta che l'erogazione **servirebbe davvero** —
  la sola che spiega i piatti che ha nel piatto. ⚠️ Il profilo ora legge anche `objective`, che entra in
  due dei sette ripieghi di `pick-diet.ts`: senza, cliente e staff sarebbero tornati a cercare due cose
  diverse. 2146 test verdi.

- `[Sviluppo]` 💧🚶 **Un obiettivo solo per l'acqua, uno su misura per i passi — e il prezzo mostrato
  è quello che si paga.** Prime quattro delle sette decisioni prese da Simone il 12/8, una domanda
  alla volta (scritte in `progetto/Decisioni_Simone_20260812.md` **prima** di toccare il codice).
  **Il prezzo.** Il carrello applicava la regola della promo, ma Negozio, primo acquisto, box
  Mantenimento del report ed **email G6** leggevano il prezzo grezzo — e l'email la regola se l'era
  perfino riscritta a mano, sbagliando proprio il ramo «promo scaduta». Con un listino valorizzato:
  tre schermate e una email dicono €249, Stripe addebita €297. ⚠️ Oggi non si vede perché nessun piano
  ha un listino: **si accende con un solo salvataggio da Gestione Negozio**, e chi lo farà non ha modo
  di sapere che sta armando questo. Ora tutti leggono `effectivePriceCents`.
  **L'acqua.** Home 33 ml/kg dai Parametri, report `peso × 30 / 1000` scritto a mano in due file: una
  cliente di 70 kg leggeva **2,25 L** in una schermata e **2,1 L** nell'altra, e chi ne beveva 2,2
  trovava «ci sei» nel report col cerchio incompleto in home. Ora la regola è una
  (`common/obiettivo-acqua.ts`) e il report parte dagli **stessi bicchieri**, limiti compresi — a
  130 kg il calcolo grezzo darebbe 4,29 L, la home 4,0. ⚠️ E i litri hanno **due decimali**: nove
  bicchieri fanno 2,25 L, con un decimale solo tornavano 2,3 — cioè lo stesso scarto di prima, più
  piccolo.
  **I passi, su misura** (domanda di Simone). Partono dalla sua fascia di attività — quella del
  questionario, la stessa che decide il fabbisogno calorico — e salgono del 5% ogni due settimane,
  con un tetto. ⚠️ **A chi si muove meno si chiede MENO**: 10.000 passi il primo giorno a chi ne fa
  3.000 non la fanno camminare, le fanno chiudere la schermata. ⚠️ L'obiettivo si scrive sulla **riga
  del giorno**: quello di oggi resta quello di oggi anche quando fra due settimane sale, o guardando
  indietro sembrerebbe aver mancato obiettivi che non le erano mai stati chiesti. ⚠️ La mediana
  personale — il modo che funziona meglio — **non si può fare**: i passi si scrivono solo `manual`,
  li digita a mano, e una mediana su tre giorni inseriti a caso è rumore con l'aria di un dato.
  **E un «?» accanto al numero**, che apre la spiegazione: quel numero cambia da solo, e un obiettivo
  che si muove senza una riga che lo spieghi si legge come un guasto — la reazione non è camminare di
  più, è smettere di fidarsi del numero. 2118 test verdi.

- `[Sviluppo]` 🌾 **La variante senza glutine non si cerca più per «stile» — e il documento è stato
  riallineato al codice.**
  Chiudendo §16.10 è saltato fuori l'ultimo bloccante vero, ed è quello che pesa di più:
  `assegnaSenzaGlutine` cercava la dieta con **`style: 'mediterranean'` scritto nel codice**. Se in
  catalogo quella variante avesse avuto un altro stile — un nutrizionista la crea «flexible», o la
  rinomina — la ricerca non l'avrebbe trovata, e alla cliente **celiaca** sarebbe arrivato «variante
  mancante» invece della sua dieta. Per una stringa che non combacia. Ora si cerca **per nome** — che
  è il prodotto — e lo stile si **legge dalla variante trovata**, poi si scrive sul profilo (serve:
  `pickDietFor` usa nome e stile insieme). La costante resta solo come ultimo ripiego, per non
  scrivere `null` su quel campo.
  **⚠️ Il `required: true` del questionario NON si tocca, ed è una scelta**: quella pagina la disegna
  `DietProductsBlock` e i `fields` non vengono renderizzati, quindi serve solo a tenere spento
  «Avanti». Spostare l'obbligo su `dietFamily` romperebbe le **app già installate**, che quella
  pagina la renderizzano dai `fields`: campo obbligatorio senza opzioni, pulsante spento, nessun modo
  di capire perché.
  **⚠️ E il documento era vecchio in tre punti.** §15.2 elencava sei decisioni «da implementare» che
  erano già fatte, §15.4 diceva «lavoro non iniziato» su codice che gira, e §4.3 segnalava un difetto
  del funnel non più vero. Il 12/8 ha portato a rispondere «cosa resta?» leggendo il documento invece
  del codice — cioè a dire due cose sbagliate. Le voci sono state verificate una per una **nel
  codice** e corrette. 2098 test verdi.

- `[Sviluppo]` 🍞 **«I menu sono ancora quelli della dieta precedente»: adesso l'app lo dice — e la
  regola era sbagliata proprio dalla parte della cliente.**
  Il flag `menuAncoraSullaDietaPrecedente` il backend lo mandava **da sempre** e nel sorgente
  dell'app non compariva in nessun file. Il motivo per cui esiste sta scritto accanto alla riga: «è
  la differenza fra "la tua dieta è cambiata e i menu arrivano appena sono pronti" e una cliente
  celiaca che legge *senza glutine* in profilo e trova il pane nel menu di domani».
  **⚠️ TROVATO collegandolo: due regole per la stessa frase, e quella sbagliata era la sua.** Il lato
  staff era stato corretto stamattina («se il menu è vecchio la segnalazione non ha senso, serve se i
  futuri saranno sbagliati», Simone) e guarda le **giornate future**; il lato cliente confrontava
  ancora l'**ultima giornata erogata** con quella assegnata. Bastava un menu vecchio in archivio per
  accendere l'avviso su piatti che nessuno riceverà mai più — la versione rumorosa era rimasta
  esattamente dove la legge lei. Ora la regola è la stessa da tutte e due le parti.
  ⚠️ Basta che **UNA** delle prossime giornate sia sulla dieta vecchia: una rigenerazione parziale ne
  lascia su due diete, e in quel giorno mangerebbe i piatti sbagliati.
  ⚠️ L'avviso dice **quale** dieta: «la dieta precedente» da sola non le fa capire cosa aspettarsi
  nel piatto. E chiude con la cosa utile — se trova qualcosa che non va bene per lei, lo scrive alla
  coach **prima di mangiarlo**. 2094 test verdi, il difetto verificato rosso.

- `[Sviluppo]` ⭐ **Un piatto mai votato vale ZERO stelle, non cinque — e lo stato «conforto»
  comincia a fare qualcosa.** Decisione di Simone (12/8), nata dalla sua domanda: «avevamo messo la
  regola che se il paziente ha l'umore basso per tre giorni di fila dobbiamo dargli i menu da lui più
  amati?».
  La regola c'era ma **al contrario di come la ricordava**: il conforto scatta al **primo** check-in
  con umore basso, e tre giorni (`agent_comfort_max_days`) è il **tetto** — oltre si passa a
  `rientro`, per non lasciarla ferma nei menu amati. Quello si è deciso di tenerlo com'è.
  **⚠️ Ma «menu più amati» non faceva quello che dice.** Il conforto moltiplica il peso del
  gradimento (×1.8), e il gradimento era `(stelle ?? 5) / 5`:
  · per una cliente **senza voti** — la maggioranza — ogni piatto valeva 1.0: una costante, e
    moltiplicare una costante non cambia l'ordine di niente. **Lo stato conforto era inerte.**
  · per una cliente **con qualche voto** faceva il contrario: un piatto mai votato (1.0) batteva uno
    valutato **quattro stelle** (0.8), e il boost allargava quel vantaggio. Nel giorno in cui sta
    peggio le arrivavano i piatti su cui non si era mai espressa.
  Con zero, «gradimento» torna a significare gradimento.
  **⚠️ Per chi non ha votato niente non cambia una virgola**: prima tutti 1.0, adesso tutti 0.0 — in
  entrambi i casi una costante, e l'ordine lo decidono efficacia, ripetizione e stagione. Il cambio
  morde solo dove ci sono voti, che è dove deve mordere.
  **La formula è uscita dal servizio** (`menu/punteggio.ts`): è la riga che decide cosa una persona
  si trova nel piatto domani mattina, e viveva dentro una closure di duecento righe che **nessun
  test guardava** — infatti il difetto ci è rimasto per mesi. Ora ha 11 test, verificati rossi
  rimettendo il 5. 2088 test verdi.

- `[Sviluppo]` 🎯 **§16.10, seconda parte: il questionario non chiede più lo STILE.** Era l'ultimo
  punto in cui lo stile sopravviveva come cosa che l'app deve sapere: il DTO lo pretendeva
  obbligatorio. La cliente sceglie un **prodotto** («Mediterranea senza glutine»); lo stile è una
  proprietà di quel prodotto e lo sa il catalogo (`stileDellaFamiglia`).
  **⚠️ Non si smette di SCRIVERLO, si smette di chiederlo**: `pickDietFor` usa lo stile come
  co-filtro della famiglia — «la famiglia va SEMPRE insieme allo stile» — e una famiglia senza stile
  può agganciare l'omonima di un altro stile.
  ⚠️ Si guarda solo fra le diete **approvate**: da una bozza si prenderebbe lo stile di un prodotto
  che nel Negozio non esiste.
  ⚠️ **Le app già installate** mandano solo `dietStyle` e continuano a funzionare senza toccare
  niente. Il controllo «almeno uno dei due» sta nel servizio e non nel DTO, perché lì si può dire
  alla cliente *cosa fare* («tocca una delle diete proposte») invece del nome di un campo.

- `[Sviluppo]` 🔴 **Il modulo Chat della dashboard: pallino rosso, «con chi», e aggiornamento ogni
  60 secondi.** Richiesta di Simone (12/8) su uno screenshot.
  **⚠️ TROVATO nello screenshot: nel modulo del capo nutrizionista i thread di GAIA stanno mescolati
  a quelli veri.** Per quel ruolo l'anteprima non filtra la controparte: cinque righe che sembrano
  messaggi per lui, e in mezzo conversazioni con Gaia — dove lo staff legge e **non può rispondere**.
  Ora ogni riga dice con chi è.
  **⚠️ Il pallino solo dove una risposta è attesa** (coach e nutrizionista, mai Gaia): un allarme su
  una conversazione a cui nessuno deve rispondere insegna a ignorare gli allarmi.
  L'aggiornamento salta il giro a scheda nascosta — sono cinque query per volta — e ricarica appena
  si torna. Vale sia per la dashboard generale sia per quella di coach e nutrizionista: è la stessa
  schermata, e un modulo che si aggiorna solo di là sarebbe la differenza più difficile da spiegare.
  2077 test verdi.

- `[Sviluppo]` 💶 **I prezzi nel testo alla coach si leggono dal Negozio — e la regola dello sconto
  era scritta due volte, in due modi diversi.**
  Il task G6 («oggi le è arrivato il codice personale») aveva i prezzi **dentro la frase**: «(1 mese
  €99 · 3 mesi €249)». Il giorno che si cambia un prezzo dal Negozio, la coach legge il vecchio e lo
  ripete alla cliente — e nessuno se ne accorge, perché una frase non dà errore. ⚠️ **Era già
  sbagliato**: a database il piano da 3 mesi costa €297.
  Ora i prezzi si leggono dai piani attivi, col prezzo del **codice personale** se la cliente ce
  l'ha: dirle 297 quando col suo codice paga 249 la manda a scoprire da sola che costava meno.
  ⚠️ Se i piani non si trovano la **parentesi sparisce**, come già fa `prezzoPiano` dall'11/8: meglio
  una parola in meno che una cifra sbagliata detta da una persona di cui si fida.
  **⚠️ TROVATO cercando: la regola dello sconto era scritta due volte, e le due copie divergevano.**
  `commerce.service.planPricing` e `plan-report.service.pricing`: con un `listPriceCents` **non
  maggiore** di `priceCents` — un listino che non è una promo — il report mostrava il numero più
  basso mentre il carrello chiedeva l'altro. Un report che prometteva alla cliente meno di quanto
  avrebbe poi pagato. Ora la regola è una sola, ed è quella di chi incassa.
  È lo stesso difetto dell'11/8 girato: non un prezzo scritto a mano, ma la stessa **regola** scritta
  due volte. Non divergono il giorno che le scrivi: divergono il mese dopo, e non lo dice nessuno.
  ⚠️ Nel farlo avevo creato un `common/prezzo-piano.ts` doppione di `commerce/prezzo-piano.ts`, che
  esisteva già dall'11/8 con lo stesso `euro()`: cancellato, tutto sta nel file che c'era.
  2065 test verdi.

- `[Sviluppo]` 🧭 **«Se il nutrizionista non è assegnato, ripiega sul capo» — ovunque, non solo in
  chat.** Regola generale data da Simone (12/8) dopo il ripiego appena messo nelle chat.
  Cercando gli altri punti, la stessa riga usciva **tre volte**, identica e ognuna per conto suo:
  `if (staffIds.length === 0) return;` — nelle **segnalazioni**
  (`escalation-routing.service.notifyAssignedStaff`), nell'avviso **«il peso sale durante la pausa»**
  e nella **richiesta di pausa da approvare**. Tre copie vogliono dire tre posti da correggere e uno
  che ci si dimentica: ora è una funzione sola, `destinatariStaffDellaCliente`.
  **⚠️ Il peggiore dei tre era la richiesta di pausa**: una cliente chiede una pausa più lunga di
  venti giorni, la richiesta resta `pending`, e se non le è stato ancora assegnato nessuno **nessuno
  veniva avvisato**. Lei aspetta una risposta che non può arrivare, e nella coda di nessuno c'è una
  riga.
  **⚠️ Il silenzio colpiva proprio le clienti più scoperte**: una segnalazione su una persona senza
  coach e senza nutrizionista è la più urgente che ci sia, ed era l'unica che non veniva detta a
  nessuno.
  **⚠️ Con qualcuno assegnato i capi NON si disturbano**: aggiungerli a ogni avviso li abituerebbe a
  ignorarli, e il ripiego servirebbe a niente il giorno che serve.
  **⚠️ Ripiego anche quando la scheda è assegnata ma non ha un'utenza dietro**: `assignedNutritionistId`
  valorizzato non garantisce che ci sia un account a cui scrivere.
  Le conversazioni restano l'eccezione dichiarata: lì il destinatario deve poter **aprire quel
  thread**, e nel thread «Coach» nessun altro può scrivere. 2053 test verdi.

- `[Sviluppo]` 📭 **Le notifiche dei messaggi al nutrizionista: il buco trovato, e lo strumento per
  vedere dov'è.** Segnalazione di Simone (12/8): «al nutrizionista continuano a non arrivare le
  notifiche dei messaggi».
  **⚠️ TROVATO: un avviso senza destinatario spariva in silenzio.** In `notifyCounterpartStaff` c'era
  un `return` muto: se alla cliente non è assegnata una nutrizionista, il messaggio veniva salvato e
  **nessuno lo sapeva** — non lei, che non c'è, e non il capo, a cui nessuno lo diceva. La cliente
  scriveva nel vuoto senza che niente, da nessuna parte, lo segnalasse. È la stessa lezione di
  luglio: tre segnalazioni gravi rimaste senza destinatario per venti giorni. Ora l'avviso ripiega
  sui **capi nutrizionisti**, che quel thread possono leggerlo e ci possono rispondere.
  **⚠️ Per la coach non c'è ripiego, e non è una dimenticanza**: nessun altro ruolo può scrivere nel
  thread «Coach» — un messaggio della nutrizionista comparirebbe alla cliente come se fosse della sua
  coach. Lì resta il `logger.warn`, che almeno rende visibile il buco.
  **Il titolo dice com'è andata**: al capo arriva «X ha scritto e non ha una nutrizionista
  assegnata», non «una tua cliente ti ha scritto» — che sarebbe falso e lo manderebbe a cercarla fra
  le proprie.
  **La diagnosi, perché il resto non si vede leggendo il codice.** Il percorso è corretto e i test lo
  coprono: quello che manca sta nei dati di quella cliente. `GET /admin/diagnosi-avviso-chat/:id`
  risponde alla domanda che conta — **quale dei sei gradini è rotto per lei**: nutrizionista
  assegnata? scheda collegata a un'utenza? conversazione aperta? ha scritto lì o a Gaia? l'avviso è
  stato scritto? c'è un telefono registrato? Stessa filosofia della «push di prova».
  **⚠️ Si dice il PRIMO gradino rotto, non l'ultimo**: «non ci sono telefoni registrati» detto a una
  cliente senza nutrizionista assegnata manda a cercare nel posto sbagliato.
  Non manda e non scrive niente: è una lettura, e c'è il test che lo verifica. 2046 test verdi.

- `[Sviluppo]` 🔎 **«Dove è usata»: nella riga piccola anche i pasti e l'obiettivo.** Richiesta di
  Simone (12/8) su uno screenshot: quattro righe «Digiuno intermittente (16:8)» identiche, e nessun
  modo di sapere a quale variante appartenesse ciascuna. Ora la riga dice `gg 3 · 5 pasti · dim`.
  Non è decorazione: la stessa dieta esiste in più varianti — 3 e 5 pasti, dimagrimento e
  mantenimento — e col solo nome ripetuto quattro volte quell'elenco non risponde alla domanda per
  cui lo si apre. Abbreviato come chiesto: `gg`, `dim`, `man`, che sta su una riga sola anche nella
  colonna stretta.
  I due campi erano **già nel `JOIN`** della query: costano zero.
  ⚠️ Quello che non si sa non si scrive: un obiettivo mancante lascia il posto vuoto invece di
  inventare «dim», che è il *default del database* e non un dato letto.
  ⚠️ Nel `$queryRaw` le posizioni di `GROUP BY`/`ORDER BY` sono numeri: aggiungere due colonne in
  mezzo sposta `day_index` dalla 4 alla 6, e dimenticarsene avrebbe riordinato l'elenco per un'altra
  colonna senza nessun errore.

- `[Sviluppo]` ⏰ **Gli alert della coach: «gestito» è un rinvio, non una chiusura.** Nato dalla
  domanda di Simone (12/8) — «la correzione sulla coda del nutrizionista mi viene un dubbio, quella
  della coach invece?».
  I pulsanti della coach, al contrario di quelli del nutrizionista, instradavano davvero: `gestito`
  toglie l'alert dalla sua lista, `inoltrato` lo passa al manager, e l'alert si chiude **da solo**
  quando la condizione smette di valere. Il difetto stava altrove: `handled` conta fra gli stati non
  chiusi — giusto, o il ricalcolo notturno ne creerebbe un doppione — ma **nessun codice riapriva mai
  un gestito**. Una coach che segnava «gestito» su una cliente che non fa check-in, e quella
  continuava a non farne, **non lo rivedeva mai più**: spariva dalla sua lista, da quella del
  manager, e restava lì. Il rischio non era il rumore: era il silenzio su chi sta scivolando via.
  **Sette giorni** (scelti da Simone, parametro `alert_gestito_giorni`): è il tempo perché un
  intervento produca un effetto visibile — un check-in, una pesata, una risposta. Se in una settimana
  non è successo niente, quel «gestito» non ha gestito niente.
  **⚠️ Non è un ritorno al difetto dell'11/8.** Le coach avevano segnalato «se clicco su gestito, al
  refresh gli avvisi ricompaiono»: quello era un avviso che tornava **subito**, cioè un pulsante che
  non salvava. Questo torna dopo una settimana, e **solo se il problema c'è ancora**. È la differenza
  fra un pulsante rotto e un promemoria.
  **⚠️ Torna solo se la condizione vale ANCORA**: se la cliente ha ripreso, l'alert non è più fra i
  desiderati e lo chiude la via normale. Riaprirlo insegnerebbe alla coach che quella lista si può
  ignorare.
  **⚠️ Si RIAPRE la riga, non se ne crea una nuova**: stesso id, `createdAt` intatto — è il dato che
  distingue una distrazione da un abbandono — e `handledAt` azzerato, perché è la data di *questo*
  gestito e non dell'ultimo di sempre.
  **⚠️ «Inoltrato» non si tocca**: è sulla scrivania di qualcun altro, che ci sta lavorando adesso.
  **⚠️ Il backfill è su `updated_at`, non su `now()`**: per un alert gestito l'ultima scrittura è
  quasi sempre il momento in cui è stato segnato. Con `now()` si regalerebbe una settimana in più
  proprio alle segnalazioni più vecchie. Conseguenza voluta: al primo ricalcolo l'arretrato torna in
  lista tutto insieme — non è rumore, è quello che era rimasto nascosto.
  Migrazione `20260812230000_alert_gestito_rinvio`. 2033 test verdi.

- `[Sviluppo]` 🔔 **Il tocco sulla notifica porta dentro — dal telefono, dall'app e dal backoffice —
  e «Correggi» smette di mentire anche sul telefono.** Quattro richieste di Simone (12/8) e tre
  difetti veri trovati verificandole.
  **La push ora sa dove portare.** Con la push viaggiava il solo `type`: il tocco apriva l'app sulla
  home e il messaggio andava ritrovato a mano — cioè esattamente quello per cui una notifica esiste.
  Ora viaggiano `threadId`/`clientId`/`visitId` (`notifications/dati-push.ts`) e l'app ha
  l'ascoltatore `pushNotificationActionPerformed`, che prima **non c'era affatto**.
  **⚠️ Il server manda i FATTI, non l'indirizzo.** La stessa notizia ha rotte diverse per chi la
  riceve: la scheda è `/clienti/:id` per la coach e `/pazienti/:id` per la nutrizionista, e la
  cliente non naviga affatto per conversazione (ha una chat sola, con le linguette). Se il server
  componesse l'URL, conoscerebbe le rotte di tre interfacce e il giorno che una cambia l'unico segno
  sarebbe un tocco che non porta da nessuna parte. `lib/rottaNotifica.ts` + 14 test.
  **⚠️ FCM accetta solo stringhe**: un numero o un `null` dentro `data` fa fallire l'invio INTERO, e
  il fallimento si vede solo nei log. Per questo si passa da `datiPush` invece di girare il payload.
  **⚠️ Il tocco può arrivare PRIMA delle rotte**: ad app chiusa il sistema la avvia e consegna
  subito, quando React non ha ancora montato il router. Il tocco si mette da parte e si consuma
  appena qualcuno può raccoglierlo — senza, aprire dall'notifica funzionava solo ad app già aperta,
  cioè nel caso che serve meno.
  **⚠️ TROVATO: la push poteva far fallire l'invio del messaggio.** `sendToUser` legge i token dal
  database **fuori** dal proprio try: un intoppo lì risaliva fino a `postMessage` — messaggio già
  salvato, schermata in errore, e la cliente che lo riscrive. Ora l'invio della push è racchiuso:
  l'avviso è un di più, il messaggio no.
  **⚠️ TROVATO: nel backoffice il clic sulla notifica non portava da nessuna parte.** Segnava letta e
  basta, sia nella campanella sia nella pagina Notifiche — quest'ultima navigava su `payload.url`,
  che **nessuna notifica valorizza**: un rimando che non si è mai acceso.
  **⚠️ TROVATO: `/chat?cliente=…` era già linkato e nessuno lo leggeva.** Lo usava la finestra delle
  azioni del motore: si atterrava sull'elenco con nessuna conversazione aperta. Ora la pagina chat
  del backoffice legge `?cliente=` e `?thread=`, e così fa l'elenco chat nell'app.
  **La campanella si aggiorna da sola**: era già così, ogni 60 secondi. Portata a 30 — un minuto di
  ritardo su «una cliente ti ha scritto» è tanto per chi sta lavorando in un'altra pagina — e il giro
  si salta a scheda nascosta, con ricarica immediata al ritorno.
  **§15.2 sul telefono.** La finestra con le azioni per causa esisteva **solo nel backoffice**: in
  `NutriDiete.tsx` «Correggi» continuava a scrivere l'esito e basta, cioè il difetto che la domanda
  di Nocanty aveva fatto emergere, rimasto in piedi proprio sulla schermata da cui lei guarda la
  coda. 2019 test verdi.

- `[Sviluppo]` 💬 **La chat dello staff: la notifica porta dentro, il pallino dice chi aspetta, le
  ultime stanno in alto.** Tre richieste di Simone (12/8), una per ciascun modo in cui si perdeva un
  messaggio.
  **La notifica porta NELLA CHAT.** Prima il tocco su «Patrizia ti ha scritto» apriva la *scheda*
  della cliente: da lì la chat è un altro tocco, e chi apre una notifica di chat vuole leggere il
  messaggio, non consultare una cartella. Ora nel payload c'è il `threadId`.
  **⚠️ Il thread lo cerca chi manda la notifica, non chi la genera.** Metà delle chiamate arrivano da
  un'escalation, dove la conversazione di *partenza* è quella con Gaia e quella di *destinazione* è
  un'altra: portare la nutrizionista nel thread da cui è partito il messaggio la porterebbe dentro la
  chat con Gaia, dove per giunta non può rispondere. Se il thread non c'è ancora, il tocco ricade
  sulla scheda come prima.
  **Il pallino rosso** su chi ha scritto dall'ultima volta che si è aperta la conversazione. Serviva
  sapere quand'è stata «l'ultima volta», ed era l'unica cosa che non stava da nessuna parte: nuova
  tabella `chat_read` (migrazione `20260812210000_chat_letto`).
  **⚠️ È per PERSONA e non per conversazione**: il capo nutrizionista vede i thread di tutti, e un
  «letto» scritto sul thread vorrebbe dire che la sua occhiata spegne il pallino della collega a cui
  quella paziente è assegnata.
  **⚠️ Conta solo quello che ha scritto la CLIENTE.** Senza quel filtro, rispondere aggiornerebbe
  l'ultimo messaggio del thread e il pallino tornerebbe da sé un istante dopo averlo spento.
  **⚠️ Nessuna riga = mai letta = pallino acceso**, e nessun backfill a `now()`: un pallino di troppo
  costa un tocco, un pallino mancante è un messaggio che nessuno legge più.
  **Le ultime chat in alto — era una parola.** L'ordinamento per `lastMessageAt desc` c'era già, ma
  **in Postgres `ORDER BY x DESC` mette i null PER PRIMI**: le conversazioni mai iniziate stavano in
  cima, sopra a chi aveva appena scritto. `nulls: 'last'`, e il test che lo sorveglia perché è
  esattamente il tipo di riga che qualcuno «semplifica» tornando indietro.
  Aprire la conversazione la segna letta lato server (non con una chiamata a parte dal telefono: una
  chiamata in più è una chiamata che ci si può dimenticare di fare). La cliente no — il suo pallino è
  un'altra cosa. 2010 test verdi.

- `[Sviluppo]` 🍽️ **Gaia impara le sostituzioni anche dalle chat del nutrizionista.** «Gaia dovrebbe
  leggere anche le chat del nutrizionista ed apprendere anche da lì le sostituzioni» (Simone, 12/8).
  Prima una sostituzione concessa per iscritto dalla nutrizionista restava dentro la conversazione —
  che nessun altro pezzo del sistema legge — e la settimana dopo Gaia rispondeva «devo chiedere alla
  tua nutrizionista» su una cosa già concessa. Ora ogni suo messaggio viene riletto e le sostituzioni
  che contiene finiscono nella tabella §16.9 con `origine: 'nutrizionista'`.
  **⚠️ LE DUE DIREZIONI, CHE IN ITALIANO SONO INVERTITE.** «Sostituisci **il pollo** con **il
  tacchino**» e «**il tacchino** al posto **del pollo**» dicono la stessa cosa coi pezzi al
  contrario. Capirla al rovescio non produce un errore: produce una regola **perfettamente formata e
  rovesciata**, che nessuno legge come sbagliata finché non arriva nel piatto di qualcuno. È il primo
  test del file, verificato rosso prima di essere verde.
  **⚠️ NEL DUBBIO NON SI IMPARA** — al contrario della regola delle prenotazioni, perché al contrario
  è il costo dell'errore: una sostituzione mancata è una riga che il nutrizionista scrive a mano, una
  sostituzione inventata è cibo sbagliato proposto con l'autorevolezza di chi la segue. Si scartano
  domande («posso sostituire il pane?» è la cliente che chiede), negazioni, ipotesi, pronomi («al
  posto di quello»), e i **pasti e i giorni** («al posto della cena», «al posto di domani»): chi li
  scrive sta organizzando la giornata, non il piatto. Le alternative multiple si fermano alla prima
  di proposito: perderne una costa un secondo, inventarla no.
  **⚠️ NASCE `da_verificare` ANCHE SE L'HA DETTO LEI.** Sembra una contraddizione — la coda esiste
  perché un umano guardi, e qui l'umano è chi ha scritto la frase. Ma quello che va verificato non è
  la sua decisione: è la **lettura** che ne ha fatto il programma. Per questo la riga si porta dietro
  la **frase esatta** nella nota: si conferma in un secondo, senza ritrovare il messaggio. E nessuna
  notifica: avvisarla di quello che ha scritto tre secondi prima è il modo più rapido per insegnarle
  a ignorare le notifiche.
  **⚠️ La stessa frase scritta dalla CLIENTE non insegna niente**: sarebbe un modo di autorizzarsi da
  sola scrivendo nella chat giusta. Solo `nutritionist` e `head_nutritionist`. Nella tabella l'origine
  si legge «Detta in chat». 2000 test verdi.

- `[Sviluppo]` 📅 **§16.7, seconda metà: la cliente prenota la sua visita.** L'altra faccia della
  settimana tipo: là il nutrizionista scrive la propria agenda, qui la cliente occupa il tempo di
  un'altra persona. Sceglie l'orario dall'app fra quelli aperti dalla **sua** nutrizionista, sposta
  e disdice fino a **24 ore prima**; mail di conferma, notifica al nutrizionista, promemoria a
  **entrambi** poco prima. Al posto del cartello «la prenotazione diretta sta arrivando» c'è la
  schermata vera.
  **⚠️ Il diritto a prenotare nasce dall'acquisto, e nel dubbio si concede.** `Product.visitsGranted`
  dice quante visite dà un prodotto; una quantità mancante o storta nell'ordine vale **1 e non 0**.
  `Order.items` è un JSON scritto da un altro pezzo di codice: leggere «zero visite» da un ordine che
  una visita l'ha pagata vorrebbe dire una cliente che ha pagato e non può prenotare, senza nessun
  errore da nessuna parte. Sbagliando dall'altra parte, il nutrizionista se ne accorge: l'appuntamento
  gli compare in agenda.
  **⚠️ Le visite annullate non consumano il credito.** Conseguenza diretta di «se disdice, lo slot
  torna libero» (Simone, 12/8): se tornasse libero lo slot ma non il diritto, la cliente avrebbe
  pagato una visita e ne avrebbe zero — e la disdetta diventerebbe una trappola.
  **⚠️ Spostare = disdire e riprenotare, e se non riesce il vecchio appuntamento TORNA.** Senza il
  rollback, chi prova a spostare e trova l'orario appena preso resta senza appuntamento avendo solo
  provato a cambiarlo. C'è il test che lo verifica: gli stati scritti sono `['cancelled','scheduled']`.
  **⚠️ La prima visita è sempre in presenza anche da questa strada.** La regola stava in
  `visits.service.create` dal principio; applicata su uno solo dei due ingressi non sarebbe una regola.
  **⚠️ Il promemoria: dedup PER DESTINATARIO, finestra 25 minuti.** Prima l'avviso lo riceveva solo il
  nutrizionista — cioè la persona che quell'appuntamento ce l'ha in agenda tutto il giorno. Simone
  (12/8): «notifica push ad **entrambi** 20 minuti prima». La ricerca del duplicato non guardava a
  *chi*: aggiungendo la cliente, la sua notifica avrebbe fatto sparire quella di lui in silenzio (test
  verificato rosso prima di essere verde). E la finestra è 25 e non 20 perché il cron gira ogni 10:
  con 20 esatti, un appuntamento a 21 minuti sarebbe stato avvisato alla passata dopo, a 11 minuti —
  sistematicamente più tardi del promesso.
  **⚠️ Un calendario solo per tre persone.** `Visit` (la visita clinica) e `Appointment` (la chiamata
  della coach) sono due tabelle che non si parlavano: la coach vedeva un martedì libero per una
  cliente che martedì era dalla nutrizionista, e l'app della cliente leggeva solo la seconda. Ora
  `agenda/calendario.ts` le unisce in lettura — richiesta di Simone del 12/8: «anche la coach deve
  vedere nel suo calendario gli appuntamenti di tutte le sue clienti». È un file di **funzioni** e non
  un servizio: un `@Injectable` in `AgendaModule` chiuderebbe un anello fra Coach, HealthArea e
  Agenda, ed è esattamente il difetto che ha fatto fallire il deploy stamattina. Allo stesso minuto la
  **visita vince** sull'appuntamento (una riga sola, e quella con la stanza video), e le **note
  cliniche non passano di lì**: non vengono nemmeno chieste al database.
  Migrazione `20260812190000_prodotto_visite`. 1963 test verdi.

- `[Sviluppo]` 📅 **§16.7, prima metà: la settimana tipo del nutrizionista.** «Il nutrizionista
  inserisce gli slot in una settimana tipo, esempio lunedì dalle 9 alle 10 poi dalle 10,05 alle
  11.10, col flag "si ripete"» (Simone, 12/8). Questa consegna costruisce **l'offerta**; la
  prenotazione lato cliente è la seconda metà.
  **⚠️ Gli orari sono MINUTI, non date.** Uno slot è «lunedì, dal minuto 540 al 600». Salvato come
  data, quel «9:00» dopo il cambio dell'ora diventerebbe le 8 o le 10 per metà anno e nessuno se ne
  accorgerebbe fino alla prima cliente che si presenta all'ora sbagliata. L'istante vero si calcola
  al momento, con una funzione che sa dov'è il cambio d'ora — e che ha bisogno di **due passate**,
  perché dentro la domenica del cambio l'offset dipende dall'ora: testato su entrambe le domeniche,
  in tutte e due le direzioni.
  **Le festività si calcolano, non si elencano** (`agenda/festivi.ts`): dieci fisse più Pasqua e il
  lunedì dell'Angelo, verificate sulle date vere di sette anni. Una lista scritta a mano vuol dire
  che un anno qualcuno si dimentica di aggiornarla e gli slot di Pasqua tornano prenotabili in
  silenzio. ⚠️ Il patrono no (cambia da città a città, per quello ci sono le ferie) e **la domenica
  non è festiva**: se uno mette uno slot di domenica è perché la domenica riceve.
  **Tre regole, e sono tutte modi di non rovinare un appuntamento a qualcuno:**
  1. **niente sovrapposizioni alla creazione** (Simone: «collisioni impossibili»). Uno slot che si
     accavalla non nasce, e l'errore dice **con quale**. Sorvegliarle alla prenotazione vorrebbe
     dire scoprirle quando due clienti hanno già premuto il pulsante. ⚠️ 9–10 e 10–11 **non** si
     accavallano: trattare il minuto in comune come collisione impedirebbe la giornata più normale
     che esista — quella dell'esempio di Simone. E un ricorrente del lunedì blocca anche uno slot
     straordinario di *un* lunedì, in tutte e due le direzioni;
  2. **un giorno con appuntamenti non si chiude** (decisione del 12/8): le ferie sopra una giornata
     prenotata vengono rifiutate con l'elenco di **chi** e **quando**. Nessuna cliente perde una
     visita a sua insaputa, e a spostarla è chi sa chi sono quelle pazienti. Il controllo arriva a
     **sera** dell'ultimo giorno: fermarsi alla mezzanotte vorrebbe dire non vedere l'appuntamento
     delle 18 e chiudere proprio il giorno che ne aveva uno;
  3. **ritirare un orario non cancella gli appuntamenti presi**: se ci sono visite future lo slot si
     **disattiva** invece di sparire.
  Ferie e festività **non cancellano niente**: tolgono le occorrenze. La settimana tipo resta
  scritta e torna da sé quando le ferie finiscono.
  L'anteprima «prossimi orari liberi» del backoffice esce dalla **stessa funzione** che userà la
  cliente per scegliere: averne una sola è quello che impedisce che l'anteprima mostri una cosa e la
  prenotazione ne offra un'altra.
  Migrazione `20260812170000_agenda_visite_slot`: `visit_slot` (con i CHECK sul database, non solo
  nel codice — una riga sbagliata darebbe uno slot che non compare mai e nessun errore),
  `staff_time_off`, e a `visit` mancavano `ends_at` (una visita era un istante **senza durata**:
  «alle 10» e «alle 10:30» non si sapeva se si accavallassero) e `slot_id`.
  ⚪ Resta per la seconda metà: la prenotazione della cliente, il diritto a prenotare che nasce
  dall'acquisto, l'email di conferma, la push 20 minuti prima, e la **vista unificata** —
  `Visit` e `Appointment` oggi sono due agende che non si parlano, l'app della cliente mostra solo
  la seconda, e la coach deve vedere gli appuntamenti di tutte le sue clienti (Simone, 12/8).
  Verifiche: **127 suite / 1916 test** (+3 suite, +63 test), backoffice e app build verdi.

- `[Sviluppo]` 🤔 **Se cambia quasi ogni giorno, Gaia le propone di fermarsi un attimo. E l'avviso
  «menu sulla dieta vecchia» smette di gridare al lupo sui menu passati.**
  **(1) L'invito a riflettere.** Richiesta di Simone: «se la cliente insiste coi cambiamenti Gaia
  dovrebbe invitarla a riflettere… vuoi confrontarti con la tua coach per vedere se con un altro
  tipo di alimentazione otterrai risultati migliori?».
  Si contano i **giorni diversi** con almeno un cambio, non il numero di cambi: tre scambi in un
  martedì sono un martedì storto, uno al giorno per tre giorni è un'altra cosa — ed è la frequenza
  il segnale. Soglia **3 giorni su 7** (decisa da Simone; la mia proposta era 4, l'obiezione è agli
  atti) e sta in `config_param` `cambi_soglia_giorni`, quindi si corregge senza un deploy.
  Tre regole che tengono il messaggio utile: **non blocca niente** (il cambio si fa, l'invito va in
  coda alla conferma — un invito al posto del cambio è un ricatto gentile); **non si ripete** (max
  una volta ogni 14 giorni: ripetuto ogni giorno diventa rumore, e il rumore si smette di leggere
  esattamente quando conta); **la coach lo sa** (parte insieme una notifica a lei, altrimenti
  «parlane con la tua coach» la manda a bussare a una porta chiusa — con ripiego sulla
  nutrizionista se coach non ce n'è).
  ⚠️ **Una riga del testo l'ho cambiata, e vale la pena scrivere perché.** «Ricordati che ogni
  cambio ti allontana dal tuo obiettivo» non è vero: i cambi che Gaia concede stanno dentro i
  gruppi di equivalenza approvati, a pari grammatura — sono fatti apposta per NON allontanarla.
  Dirle il contrario la fa sentire in colpa per aver usato una funzione che le abbiamo dato noi, e
  il risultato prevedibile non è che smette di cambiare: è che smette di **dircelo**. Il testo ora
  dice l'opposto («non ti allontanano dal tuo obiettivo») e tiene tutto il resto della richiesta —
  l'invito a riflettere, la coach, l'ipotesi di un'alimentazione diversa. Scelto da Simone fra tre
  versioni.
  ⚠️ **La finestra si ferma a oggi**, e non è pigrizia: un cambio «non mi piace» scrive su trenta
  giornate future in un colpo solo, e contando anche il futuro UNA richiesta farebbe risultare
  trenta giorni con un cambio. L'invito partirebbe alla prima cliente che dice «questo non mi
  piace».
  ⚠️ **Non contano le sostituzioni del MOTORE** (allergeni, intolleranze, esclusioni): non le ha
  chieste lei, e contarle vorrebbe dire invitare a riflettere una cliente allergica proprio sulle
  sostituzioni che la tengono al sicuro. Per poterlo fare, le sostituzioni chieste **dal pulsante
  dell'app** ora si marcano `origine: 'app'` anche dentro il menu: prima erano indistinguibili da
  quelle del motore, che non hanno origine.
  **(2) L'avviso «menu ancora sulla dieta precedente».** Simone, guardando la scheda di Patrizia:
  «se il menu è vecchio la segnalazione non ha senso, serve se i futuri saranno sbagliati».
  Confrontava **l'ultima giornata generata**, senza filtro sulla data: su una cliente col percorso
  finito gridava al lupo su un menu che nessuno riceverà più. Ora guarda solo le giornate **da
  ricevere** (`date >= oggi`), con `distinct` sulla dieta perché una rigenerazione parziale può
  lasciarne due diverse: basta che UNA delle prossime sia la vecchia perché valga la pena dirlo.
  Senza giornate future, nessun avviso — non c'è nessuna domanda a cui rispondere.
  Verifiche: **124 suite / 1853 test** (+1 suite, +11 test), backoffice e app build verdi.

- `[Sviluppo]` 🔴 **Il deploy falliva all'avvio: una riga di cablaggio, e il test che l'avrebbe
  vista.** Due deploy di fila rossi su Render («Exited with status 1»): `FoodSwapsModule` (§16.9)
  **non importava** `NotificationsModule`, e `FoodSwapsService` si fa iniettare
  `NotificationsService` per avvisare i capi nutrizionisti quando si promuove una riga a regola.
  La produzione non è mai andata giù — a deploy fallito Render tiene su l'istanza precedente — ma
  due aggiornamenti non sono entrati.
  **La cosa che conta non è la riga: è cosa NON l'ha vista.** Il type-check era verde, perché
  TypeScript guarda i tipi e non il cablaggio dei moduli. 1794 test erano verdi, perché gli spec
  costruiscono i servizi a mano passando i finti — che è giusto per la logica, e cieco per il
  cablaggio. Nest risolve le dipendenze **all'avvio**: il primo posto in cui quell'errore poteva
  comparire era il boot in produzione.
  Quindi oltre alla riga c'è **`src/app.module.spec.ts`**: compila l'`AppModule` vero, con solo
  `PrismaService` sostituito. Non verifica niente di funzionale — verifica che l'applicazione si
  avvii. Rimettendo il difetto, il test cade con **lo stesso identico messaggio** che si legge nei
  log di Render («Nest can't resolve dependencies of the FoodSwapsService … NotificationsService at
  index [2]»): è la prova che serviva, e la ragione per cui questo test vale più dei quattro che
  avrei scritto sul modulo.
  Da qui in avanti vale per **tutti** i moduli: un `imports` dimenticato, un anello fra moduli, un
  provider caduto da un `exports` cadono in CI invece che su Render.
  Verifiche: 123 suite / 1842 test verdi.

- `[Sviluppo]` 👂 **Gaia ascolta meglio — e quando non capisce lo dice, invece di rispondere a
  caso.** Più §16.2: il dialogo sa finalmente di quale GIORNO si sta parlando.
  **La conversazione da cui nasce** (girata da Simone): Gaia elenca i piatti, la cliente scrive
  «Voglio cambiare il menu di oggi **a pranzo** con verdura cruda e tonno al naturale», e Gaia
  risponde «**A cena** (Insalata Tiepida Tacchino e Quinoa) ci sono 50 g di **quinoa cruda**».
  Tre difetti in una riga, e nessuno è «l'AI non ha capito» — quel dialogo è deterministico, quindi
  sono tre righe di codice.
  **(1) Gli aggettivi non sono alimenti.** «Cruda» combaciava benissimo con la quinoa della cena.
  Solo che «cruda» non nomina un cibo: lo descrive. Ora un elenco di QUALIFICATORI (crudo, cotto,
  fresco, naturale, integrale, magro, tiepido…) non identifica più niente **da solo**; in coppia
  restano eccome, perché «verdura cruda» e «tonno naturale» sono nomi di ingredienti veri e le
  coppie si provano per prime.
  **(2) Il pasto nominato vincola la ricerca.** Aveva scritto «a pranzo». Adesso, se nomina un
  pasto, si guarda solo quello — e se lì non c'è niente, la domanda che si ripete è quella mirata
  su quel pasto, non l'elenco di tutta la giornata.
  **(3) «Perdonami, non ho capito. La mia domanda è: …»** — richiesta di Simone, parola per parola.
  La domanda si ripete **identica**: il dialogo si porta dietro `ultimaDomanda` invece di
  ricostruirla, perché riformularla sembra gentile ed è il modo più rapido di confondere chi già
  non aveva capito. Vale nei quattro passi in cui prima si tirava a indovinare.
  **(4) «Sostituisco tutto il pasto con X, Y e Z» non è una sostituzione di ingrediente.** È la
  frase della conversazione del 6/8, quella che l'AI generativa approvava con un «certo, è una
  buona sostituzione!» **senza cambiare niente nel menu**. Ora si apre un **bivio** (chiesto da
  Simone): *1) passo alla nutrizionista · 2) proponimi tu un'alternativa*. Due opzioni numerate e
  non una domanda aperta, in un dialogo che ha appena dimostrato di fraintendere. Al «2» Gaia pesca
  un altro piatto dal ricettario approvato per lei, a pari calorie — e, «ovviamente con altri
  ingredienti», un'alternativa che si chiama quasi come quella rifiutata («…e Farro» al posto di
  «…e Quinoa») finisce in **fondo** alla lista, non fuori: con un ricettario piccolo potrebbe essere
  l'unica.
  **§16.2 — «anche il menu di domani o dopodomani, se lo vedo».** La giornata era cablata su oggi in
  sei punti. Adesso viaggia nella conversazione: la cliente può dirlo a parole («domani», «giovedì»,
  «stasera») **oppure** arrivare dal pulsante «Sostituisci» che ho messo sulla giornata che sta
  guardando nel menu, che porta la data con sé.
  ⚠️ Il riconoscimento del giorno è **volutamente stretto** e NON riusa `leggiData` della data di
  inizio piano: quel parser legge «il 15» come una data, e qui i numeri sono **grammi**. Solo
  oggi/domani/dopodomani/stasera e i nomi dei giorni. E il nome del giorno di oggi significa
  **oggi** — la regola opposta a quella del piano, dove «lunedì» detto di lunedì è fra sette giorni:
  chi guarda il piatto che ha davanti non parla della settimana prossima.
  ⚠️ Solo le giornate che la cliente **vede** (`visibleFrom <= oggi`, la stessa regola dell'app) e
  mai il passato — un menu di ieri è già stato mangiato, e chiedendolo si sente dire quello, non un
  ripiego silenzioso su oggi. `sempre` («non mi piace») parte comunque **da oggi** anche se si
  parlava di giovedì: un cibo che non piace non piace nemmeno stasera.
  **La rete di sicurezza di tutto §16.2**: con la giornata di oggi ogni frase resta identica a
  prima, parola per parola — i valori predefiniti dei testi sono tutti «oggi». È il motivo per cui
  le 674 asserzioni già esistenti su menu e chat sono passate senza toccarne una.
  Verifiche: **122 suite / 1841 test** (+2 suite, +47 test), backoffice e app build verdi.

- `[Sviluppo]` 🔁 **La tabella delle sostituzioni: adesso Gaia impara.** §16.9. «Se non salviamo la
  sua risposta lei non impara» — e infatti non la salvavamo. Un cambio concordato in chat viveva
  **solo** dentro `menu_day.meals`, come elemento di un array JSON: **senza id** (lo si individuava
  per `data|slot|from`, con la stessa chiave riscritta a mano in tre punti diversi) e leggibile solo
  dentro una finestra di **±30/90 giorni**. Quello che una cliente aveva chiesto tre mesi fa non
  esisteva più; quello che avevano chiesto le altre non era una domanda che si potesse porre.
  Ora c'è `food_swap`: **riga = questa cliente, questo piatto, questo alimento → questo sostituto**,
  con stato, chi l'ha validata e quando.
  **La riga non è un'occorrenza**: la stessa richiesta ripetuta incrementa `volte`. È il conteggio a
  rendere la tabella utile invece che un log — «questa cliente toglie le carote da otto piatti» e
  «quaranta clienti tolgono le carote» sono le due domande per cui esiste, e nessuna delle due si
  risponde su un elenco di eventi. A tenerlo in piedi è la `chiave`
  (`cliente|piatto|radice(da)|radice(a)`), che rende l'inserimento un upsert: senza, «Carote» oggi e
  «carota» il mese prossimo sarebbero due righe.
  ⚠️ **Il piatto entra nella chiave di proposito.** «Togliere le carote dal minestrone» e «togliere
  le carote dall'insalata» sono due richieste diverse, e il CONTESTO è esattamente l'informazione
  che i gruppi di equivalenza non sanno tenere. È il motivo per cui §16.9 ha scelto una tabella
  nuova invece di riversare tutto lì: una scelta fatta per una cliente non deve cambiare il motore
  per tutte.
  **«Promuovi a regola»** fa quel salto, un caso per volta e con una persona che decide. Tre
  risposte possibili, in ordine di utilità: esiste già un gruppo **approvato** con dentro tutti e due
  gli alimenti → lo dice e non crea niente (il motore lo sa già); c'è una **bozza** che ne contiene
  uno → ci aggiunge il mancante, invece di lasciare in giro dieci gruppi da due voci; altrimenti ne
  crea uno **in bozza**, con scritta dentro la provenienza.
  ⚠️ **Un gruppo approvato non viene mai modificato da qui**, nemmeno per aggiungere una voce:
  allargarne uno cambierebbe i menu di tutte le clienti a partire dalla notte stessa, per una
  richiesta fatta da una e senza che nessuno l'abbia approvato.
  **Le funzioni che confrontano i nomi di alimento** (`radice`, `combaciaAlimento`, …) sono uscite da
  `menu/sostituzione-chat.ts` e stanno in `common/nomi-alimento.ts`: da oggi non le interroga più
  solo il dialogo in chat, e importare il file della chat da un modulo di backoffice sarebbe stato
  il primo passo verso una seconda copia leggermente diversa — la storia dei metodi di cottura.
  Ri-esportate, quindi nessun import esistente cambia. La chiave usa una radice **un filo più
  aggressiva** (toglie la `h` dura): senza, «pesca» e «pesche» erano due righe e il conteggio si
  spaccava in due. Sta lì e non dentro `radice`, che decide se togliere un ingrediente dal piatto di
  una persona: là il costo di un accorpamento sbagliato è un pasto, qui è una riga contata due volte.
  **Ci finisce anche il pulsante «sostituisci» dell'app**, non solo la chat: è la stessa richiesta
  fatta con due dita invece che con una frase. Una riga per richiesta, non una per giornata toccata
  — `days` ne tocca tre, e contarle tre volte avrebbe fatto mentire proprio il numero che serve a
  decidere cosa promuovere.
  ⚠️ **La scrittura non lancia mai.** Viene dopo che il cambio è già sul menu della cliente: se
  fallisce, lei deve comunque vedere la risposta di Gaia e trovare il piatto giusto domani mattina.
  La memoria è utile, il pasto è necessario.
  Pagina nuova nel backoffice (sotto i Gruppi di equivalenza, che è dove si va a finire), chiave
  permessi `food_swaps` propria — `view` alla coach, `manage` a chi decide — inserimento manuale, e
  la colonna «Volte» ordinata in cima. Migrazione `20260812150000_tabella_sostituzioni`, **nessun
  backfill**: ricostruire all'indietro dai JSON vorrebbe dire inventare `volte` e `prima_volta_il`, e
  una memoria che parte con numeri inventati è peggio di una che parte vuota.
  Verifiche: **120 suite / 1794 test** (+3 suite, +31 test), backoffice e app build verdi.

- `[Sviluppo]` 💶 **Il tetto di guadagno mensile del nutrizionista — sul suo profilo, e applicato
  dove passano tutti gli accrediti.** §16.8, decisa l'11/8: **solo il campo sulla persona**, niente
  parametro globale, niente cascata. Il campo è `Staff.earningsCapCents`, si scrive in euro dalla
  scheda utente del backoffice, e vale su **provvigioni + compensi di un mese**.
  ⚠️ **`null` e `0` significano tutti e due «nessun tetto».** È la cosa che questa voce esisteva per
  non sbagliare: un campo numerico svuotato in un form arriva come `0`, e «tetto zero» letto alla
  lettera vuol dire che quella persona non prende più una provvigione — senza errori, senza avvisi,
  per mesi. Un tetto vero a zero non lo imposta nessuno; il campo svuotato lo fa chiunque. Lo zero
  viene per giunta salvato **come `null`**, così l'ambiguità non entra nemmeno nel database.
  **Dove si applica**: in `creditStaff`, che è l'imbuto unico — catena a percentuali, importi fissi
  legacy, ricalcolo, accantonati risolti all'assegnazione passano tutti di lì. Metterlo altrove
  avrebbe lasciato una strada che lo scavalca senza che nessuno se ne accorgesse.
  **Come si conta il maturato del mese**: sommando il **registro contabile**, non
  `StaffCompensation.amountCents`. Quel contatore viene decrementato con un `Math.max(0, …)` quando
  si storna un acquisto, quindi dopo uno storno più grande del residuo non è più il numero vero. Il
  registro sì, perché lì lo storno è una **riga negativa** — e da questo viene gratis la decisione
  «lo storno si sottrae anche se rientra nel tetto»: stornare **libera spazio** sotto il tetto, che è
  quello che deve succedere. È anche lo stesso numero che la persona vede nel suo portafoglio, ed è
  il motivo per cui `CATEGORIE_COMPENSO` ora sta in un posto solo (`common/tetto-compensi.ts`) invece
  che in due: se le due liste divergono, il tetto taglia su una cifra che lei non vede da nessuna
  parte, e non è spiegabile.
  **L'eccedenza si perde** (decisione presa): non si accantona, non slitta. Ma non sparisce in
  silenzio — riga di audit `provvigione.tetto_mensile`, `logger.warn`, la **nota sulla riga di
  registro** («Tetto mensile € 3.000,00: quota ridotta da … a …») e il campo `tettoTagliatoCents`
  dentro l'item del periodo. A tetto già saturo **non** si scrive una riga da zero euro: sarebbe
  rumore in Contabilità, e l'informazione utile è nell'audit.
  **Si vede in tre posti**, perché un tetto invisibile è una decurtazione a sorpresa: nella scheda
  utente (il campo), in **Compensi** (colonna «Tetto mensile» + pastiglia «raggiunto» — solo quando
  si guarda **un mese**: col filtro «Tutto» il totale è di più mesi e confrontarlo col tetto direbbe
  una bugia), e nell'app staff in **Guadagni** («Tetto del mese · ne restano …»).
  `ricalcolaProvvigioni` ora riporta **quanto ha aggiunto davvero**, non quanto avrebbe voluto:
  `creditStaff` restituisce erogato/tagliato e il messaggio lo dice.
  Migrazione `20260812130000_tetto_guadagno_staff`: la colonna (NULL per tutti, nessun backfill,
  comportamento identico a oggi per chiunque) e un **indice `ledger_entry(staff_id, date)`** che non
  c'era — la domanda «quanto ha maturato questa persona in questo mese» passa da «una volta quando
  guardo il portafoglio» a «una volta per ogni pagamento approvato».
  Verifiche: **117 suite / 1763 test** (+2 suite, +22 test), backend type-check verde con lo stesso
  identico baseline di prima, backoffice e app build verdi, 27 test dell'app.

## 2026-08-11

- `[Sviluppo]` 🍳 **«Piatto freddo» fra i metodi di cottura — e l'elenco smette di vivere in quattro
  posti. Più il «Salva» nelle impostazioni del menu, e «Acceso» rimesso com'era.**
  **(1) §16.6.** Aggiungere la voce era una riga; il lavoro è il motivo per cui non lo era. L'elenco
  stava in **quattro punti già diversi**: tendina del backoffice 3 voci, app 3, motore 5, prompt
  dell'AI 3 scritte a mano dentro la stringa. Quindi «in padella» e «al vapore» **esistevano già nei
  menu** e nella tendina non c'erano — chi apriva quelle ricette vedeva un valore che non poteva
  reinserire — e la cliente leggeva `padella` in minuscolo, con l'aria di un errore. Ora
  `common/metodi-cottura.ts` **decide** (lo usano il ciclo e il prompt, che costruisce l'enum dai
  codici), il backoffice li **chiede** a `/catalog/taxonomy`, e l'app — che non sceglie, mostra —
  tiene le etichette con un **ripiego leggibile** per i codici che non conosce, perché si aggiorna
  dopo il backend. Due danni silenziosi evitati: il metodo già salvato che non è più in elenco resta
  selezionabile (senza, aprire e salvare una ricetta vecchia le cambierebbe la preparazione di
  nascosto) e il ripiego del backoffice vale solo finché la risposta non arriva. Sei test: niente
  codici doppi, ogni voce con un'etichetta scritta per una persona, e un codice sconosciuto che **non
  torna mai grezzo**.
  **(2) «I flag non funzionano».** Il flag funzionava e veniva salvato: era la **barra** a non
  saperlo — legge le preferenze una volta sola, quando si monta, quindi la card si aggiornava e il
  menu restava indietro fino al ricaricamento. Ora c'è **Salva** (più Annulla) e il salvataggio
  **ricarica la pagina**, come chiesto da Simone: dice *quando* il lavoro è finito — riordinare un
  menu sono dieci gesti, non uno — e dà il momento giusto per ricaricare, che è il modo onesto di
  garantire che quello che si vede sia quello che è salvato. ⚠️ Se la scrittura non riesce **non si
  ricarica**: un ricaricamento dopo un errore butterebbe via dieci minuti di riordino senza dire
  perché. In più la barra ora ascolta il cambiamento anche dalle **altre schede** aperte.
  **(3) «Acceso»** rimesso com'era (fondo mela pieno, barra verde scuro): la prova con il mela sulla
  barra e il fondo desaturato, guardata sul vivo, non convinceva. Le variabili `--sidebar-ink` /
  `--sidebar-hover` restano nel CSS generico — non le usa più nessuno, ma i default sono esattamente
  i colori fissi di prima, quindi non cambiano niente e il giorno che serve una barra chiara ci sono.
  Verifiche: **115 suite / 1741 test**, build backoffice e app verdi.

- `[Sviluppo]` 🔔 **Nuovo lead → la manager delle coach lo sa, e ha la sua coda «Lead da
  assegnare».** §16.3. L'avviso (in-app + push) parte quando nasce un lead **senza coach**: dal form
  del sito e dalla registrazione di una cliente. **Non** dall'import di liste — mille righe importate
  non sono mille avvisi — e non dall'inserimento manuale dal backoffice, dove chi lo crea può
  assegnarlo lì. ⚠️ Il ruolo è `sales`, e **se non c'è nessun `sales` attivo l'avviso non si butta
  via: va agli admin.** È la lezione di luglio (tre segnalazioni cliniche senza destinatario, ferme
  venti giorni): *un avviso senza destinatario non è un avviso*. Non fallisce mai — chi chiama sta
  registrando una persona — ma il motivo si **scrive** nei log, perché «nessuno è stato avvisato» è
  esattamente il silenzio che questa voce esiste per togliere. Otto test, e quelli che contano non
  sono «la notifica parte»: sono «senza `sales` va agli admin», «senza nessuno dei due lo dice», «se
  la notifica esplode la registrazione passa lo stesso».
  **La coda**: `/crm/da-assegnare` non è una pagina nuova, è la stessa tabella di Gestione lead (la
  stessa che ora è anche Clienti) con il filtro coach inchiodato su «nessuna» e l'ordine **dal più
  vecchio** — ed è quello che la rende una *coda di lavoro* invece di un elenco: in cima c'è chi
  aspetta da più tempo, cioè chi si sta raffreddando.
  **E le notifiche adesso si aprono**: quelle con un `payload.url` portano alla pagina e lo dicono
  («· apri →»). Una notifica che dice «apri la tabella» e poi non la apre costringe a cercarla nel
  menu. Verifiche: **114 suite / 1735 test**, build backoffice verde.
  📌 La voce non è nel menu: ci si arriva dalla notifica. Metterla è una riga, ma va deciso sotto
  quale gruppo e con quale permesso — oggi la pagina sta dietro `crm_leads`.

- `[Sviluppo]` 🎚️ **I gruppi del menu si aprono a fisarmonica a scelta, e «Acceso» rivisto sul
  vivo.** (1) «CRM è un gruppo comprimibile, riusciamo a mettere a fianco ai titoli un flag che li
  rende solo titoli o comprimibili?» — sì: un interruttore per gruppo, che dice lo stato **a parole**
  («a fisarmonica» / «solo titolo») invece di farlo indovinare da un quadratino. Prima essere
  pieghevole era scritto nel codice e ce l'aveva solo CRM. ⚠️ **Tre stati, non due**: il marcatore
  diventa `#gruppoc:` o `#gruppot:`, e il vecchio `#gruppo:` resta valido e vuol dire **eredita** —
  è lo stato di chi aveva già salvato prima che l'interruttore esistesse, e confonderlo con «solo
  titolo» avrebbe fatto sparire la fisarmonica di CRM senza che l'avesse chiesto nessuno. Difetto
  evitato per un pelo: il filtro delle voci nascoste cercava `#gruppo:` **con i due punti**, e con
  tre marcatori avrebbe preso gli altri due per rotte, riattaccandoli come «orfane» e moltiplicando i
  titoli a ogni salvataggio.
  (2) **«Acceso»**: «sposta il verde più chiaro sulla barra laterale e lo sfondo centrale desatura
  ulteriore 75%». Barra = verde mela `#8db600`, fondo = lo stesso verde desaturato di un altro 75%
  (`#687244`), card e accento invariati. ⭐ La riga che rende leggibile il resto: sopra il mela il
  testo **chiaro** sta a 2,1:1, quindi il colore del testo della barra — fisso nel CSS dal primo
  giorno — diventa una **variabile** (`--sidebar-ink`), e «Acceso» ci mette un verde quasi nero
  (6,8:1). Stessa cosa per il velo del passaggio del mouse (su una barra chiara uno schiarimento non
  si vede) e per le etichette dei gruppi. I temi che non le impostano **non cambiano di una
  virgola**: i default sono i colori fissi di prima. Il testo direttamente sul fondo resta a 3,1:1 —
  è raro, quasi tutto sta in una card, ma è il numero da alzare se qualche etichetta lì sopra fatica.

- `[Sviluppo]` 🔴🔴 **«Modifica scheda» non salvava NIENTE: le operazioni non venivano mai eseguite.**
  La dieta di una cliente spostata **cinque volte** da «Pescetariana» a «Mediterranea» e tornata
  indietro ogni volta. **Non tornava indietro: non era mai partita.**
  ⭐ **La causa, in una riga che non c'era.** `updateClient` costruiva le operazioni Prisma in un
  array `ops` e **non lo eseguiva mai**. Le operazioni di Prisma sono **pigre**: costruirle non le
  esegue. Quindi *ogni* salvataggio della scheda cliente non arrivava al database — non solo la
  dieta: telefono, indirizzo, alias, regime, obiettivo, percorso, intolleranze.
  ⭐ **Perché nessuno se n'era accorto**, ed è la parte che vale più della correzione: tutto il
  *resto* della funzione funzionava e raccontava il contrario. L'audit scriveva «Dieta assegnata:
  Pescetariana → Mediterranea» perché calcola il cambiamento dai valori **richiesti** e non da
  quelli scritti; il cambio del tipo di dieta faceva **rigenerare i menu**, che è la cosa visibile;
  la risposta tornava senza errori. Il log modifiche raccontava cinque modifiche mai avvenute. **È la
  bugia peggiore che possa dire un sistema: non «non ha funzionato», ma «ho fatto».**
  **Come è saltato fuori:** la traccia su `dietFamily` messa poche ore prima. Ha mostrato **una**
  scrittura in ingresso e **nessuna riscrittura** — e lì la domanda ha smesso di essere «chi la
  sovrascrive» ed è diventata «questa scrittura viene eseguita?». Cinque ore di ipotesi (il
  questionario, il senza glutine, il motore, l'app) chiuse da una riga di log con dentro uno stack.
  **I test**: cinque, e non verificano «il salvataggio funziona» — verificano che `$transaction`
  venga **chiamata** con dentro le operazioni. È la differenza fra un test che descrive l'intenzione
  e uno che avrebbe visto questo difetto: quelli che c'erano guardavano l'audit e i menu, cioè le due
  cose che funzionavano. Controprova fatta: togliendo la correzione, quattro su cinque diventano
  rossi. **114 suite / 1735 test.**
  ⚠️ **Da fare dopo il deploy:** ricontrollare le modifiche di scheda degli ultimi giorni — tutto
  quello che è stato salvato da lì non è mai stato scritto, **e il log dice di sì**.

- `[Sviluppo]` 🪤 **La trappola che dice CHI riscrive la dieta della cliente.** La dieta di
  `sim1one.salogni@gmail.com` è stata spostata da «Pescetariana» a «Mediterranea» **cinque volte**, da
  tre persone diverse, e ogni volta è tornata indietro. Nell'audit ci sono i cinque cambi e **nessun
  ritorno**: qualcuno riscrive `dietFamily` senza passare da `updateClient`. La correzione al
  questionario (voce di stanotte) era necessaria ma **non era questa**: dopo il deploy il campo torna
  indietro lo stesso.
  Ho controllato a mano tutti i punti che scrivono su `ClientProfile` — onboarding, senza glutine,
  profilo dell'app, scheda cliente — e nessuno spiega il fatto. ⭐ **A quel punto continuare a leggere
  codice è un modo lento di indovinare**: meglio far dire al codice chi è stato. `traccia-diet-family`
  intercetta ogni `update`/`upsert`/`updateMany` su `clientProfile` in cui compaia `dietFamily` e
  scrive nei log valore, `where` e **stack di chi ha chiamato**. Guarda **entrambi** i rami
  dell'upsert, perché il difetto dell'8/8 e quello dell'11/8 stavano tutti e due nel ramo che nessuno
  rilegge.
  Nota tecnica: `$use` non esiste più in Prisma 6 e `$extends` restituisce un client **nuovo**, che
  non si incastra con l'iniezione di Nest (`PrismaService` *è* il client) — quindi si ombreggia il
  delegato con una proprietà d'istanza e lo si avvolge in un `Proxy`. Sei test, fra cui i due che
  contano: che **taccia** su tutto il resto, e che una traccia rotta **non faccia fallire** la
  scrittura che sta osservando.
  ⚠️ **È diagnostica temporanea**: si spegne con `TRACCIA_DIET_FAMILY=0` e va **tolta** quando il
  colpevole è stato trovato. La voce di registro di quel giorno dovrà dire *chi era*, o fra un mese si
  ricomincia da qui. Verifiche: **113 suite / 1730 test**.

- `[Sviluppo]` ➖ **Via «Ardesia · rame»: il tema che avevo proposto io non si tiene.** Era un secondo
  scuro, freddo, per chi lavora di sera — un'aggiunta mia, non una richiesta. Simone ha scelto di non
  tenerlo, e resta solo quello che ha dettato lui («Acceso»). Tolto dai **tre posti** in cui un tema
  vive, così non resta un id a metà da nessuna parte. Restano sei temi.
  ⚠️ È stato in produzione poche ore: chi l'avesse salvato tiene l'id `slate` sull'account finché non
  ne sceglie un altro — l'interfaccia ripiega su «Chiaro» e nel selettore non risulta selezionato
  niente. Nessun errore, nessun dato perso, si ripara scegliendo un tema: una migrazione per una
  manciata di righe costerebbe più del problema, e cancellare d'ufficio la preferenza di qualcuno
  sarebbe peggio del ripiego.

- `[Sviluppo]` 🎨 **Gruppi del menu personalizzabili, tre temi nuovi, e gli acquisti a € 0 fuori dal
  riquadro.** Tre richieste di Simone, tutte nelle personalizzazioni utente.
  **(1) Il menu**: si rinominano i titoli dei gruppi, si spostano, si aggiungono e si eliminano, e le
  voci passano da un gruppo all'altro; il «Reimposta» sta accanto al titolo della card. I gruppi
  vivono **dentro la stessa lista** già salvata sul profilo (`menuOrder`), come righe che cominciano
  con `#gruppo:` — una rotta comincia sempre con `/`, quindi non possono collidere, e chi ha un
  ordine salvato senza marcatori continua a funzionare com'era: nessuna migrazione. ⚠️ Tre cose che
  potevano far **sparire una voce dal menu**, tutte bloccate: una pagina nuova non nominata dai
  gruppi salvati torna nel gruppo che aveva in origine (senza, chi si è personalizzato il menu non
  l'avrebbe mai vista); le rotte che quel ruolo non vede si riattaccano invece di essere cancellate;
  ed eliminare un gruppo **non elimina le voci**, che passano al gruppo accanto. Frecce e non
  trascinamento — e quando la voce è la prima o l'ultima, la freccia la porta nel gruppo vicino.
  **(2) Due temi nuovi.** *Cipria · fucsia*: il fucsia puro grida dopo mezz'ora, quindi l'accento è
  abbassato a magenta scuro (~5:1 sul bianco) su un cipria appena rosato, testo prugna — il nero puro
  accanto al rosa fa sembrare la pagina una stampa mal calibrata. *Acceso · mela e indaco*, dettato a voce da Simone: verde mela primario **come fondo**,
  lo stesso verde desaturato al 50% come superficie, e l'accento è **lo stesso identico indaco** di
  «Minimal». ⚠️ Unica libertà, e sui numeri: il desaturato *alla stessa luminosità* (`#74882e`) sta al
  buio quanto il mela — due fondi indistinguibili, e le card sparirebbero — quindi è desaturato **e
  schiarito**; e la barra laterale è il verde portato molto giù, perché il mela pieno non regge il
  testo chiaro (2,4:1).
  📌 **Un tema vive in TRE posti**: `THEMES`, il blocco `[data-theme=…]` nel CSS e `ACCOUNT_THEMES`
  nel backend. Se ne manca uno, il tema si applica e torna indietro al primo ricaricamento, oppure la
  pagina resta senza colori.
  **(3) Acquisti a € 0** nascosti di default nel modulo della dashboard, con **la stessa** preferenza
  della tabella Acquisti (`acquisti.mostraZero`): un interruttore solo, valido in due posti. Il
  server manda **dodici** righe invece di cinque proprio perché è il frontend a toglierne — se ne
  arrivassero cinque e quattro fossero a zero, il riquadro ne mostrerebbe una, e sembrerebbe che non
  si venda niente.
  Verifiche: build backoffice e backend verdi, **112 suite / 1724 test**.

- `[Sviluppo]` 🔒 **Il questionario non cambia più la dieta dopo il primo invio — e per questo la
  correzione della nutrizionista tornava indietro da sola.** Trovato collaudando: su
  `sim1one.salogni@gmail.com` la dieta era stata spostata da **Pescetariana a Mediterranea due
  volte**, da due persone diverse, e tutte e due le volte era tornata indietro. Nell'audit della
  scheda si vedevano i due `Pescetariana → Mediterranea` e **nessun ritorno**: il ritorno non
  passava di lì.
  ⭐ **La causa.** `submitAnswers` è un `upsert`, e il ramo `update` riscriveva **ogni volta e senza
  condizioni** `regime`, `dietStyle`, `dietFamily`, `mealsPerDay` e `pathType` dalle risposte del
  questionario. Un secondo invio bastava a cancellare la decisione della nutrizionista e rimettere
  la dieta scelta in registrazione — senza errore e senza traccia, perché formalmente è un'azione
  della cliente sul proprio questionario. È **la stessa lezione dell'8/8** del consenso sanitario
  perso: [[feedback_upsert_due_rami]] — *un upsert sono due scritture, e il ramo `update` è quello
  che nessuno rilegge*. Due volte in quattro giorni, nello stesso file.
  **La regola, dettata da Simone:** «il cliente può fare il questionario **solo una volta**, al primo
  accesso; da lì in poi il nutrizionista, la coach o admin possono cambiare la dieta — il cliente
  non è autorizzato, se vuole cambiarla deve chiedere». Quindi con `onboardingCompletedAt` già
  valorizzato il questionario **non tocca più** il tipo di dieta; tutto il resto (misure, obiettivo,
  preferenze, allergie, consensi) continua ad aggiornarsi — è un congelamento mirato, non un
  rifiuto: bloccare l'invio intero avrebbe rotto flussi che funzionano per punire un campo. E il
  tentativo ignorato **si scrive nell'audit** (`onboarding.tipo_dieta_ignorato`, con proposto e
  attuale): sparire in silenzio è il difetto, la scrittura è la cura.
  ⚠️ **Un caso limite nato dalla correzione stessa**: la finestra del digiuno resta modificabile
  dalla cliente, ma ora guarda il percorso **in vigore** e non quello riproposto — se il reinvio
  dicesse «5 pasti» mentre lo staff l'ha messa a digiuno, `pathType` non cambia più e azzerare la
  finestra avrebbe lasciato una cliente a digiuno **senza sapere quali pasti salta**.
  Verifiche: build verde, **112 suite / 1724 test**, 6 nuovi (il primo invio che *deve* scrivere la
  dieta, il reinvio che non deve, l'audit del tentativo, la finestra del digiuno).
  📌 Nota permessi: «la coach può cambiare la dieta» è un **interruttore in Permessi**
  (`change_diet_type`, oggi acceso di default solo per nutrizionista e admin), non una modifica di
  codice.

- `[Sviluppo]` 🧩 **Clienti e Gestione lead sono la stessa tabella — e la nutrizionista non vede di
  più.** §16.4, seconda metà. `Clienti.tsx` erano 200 righe che rifacevano *quasi* quello che fa
  `LeadsTable`: stessa idea di filtri, ordinamento e ricerca, scritti una seconda volta. Due copie
  non restano uguali — l'ultima divergenza sono stati i **filtri fissi in cima**, che una aveva e
  l'altra no — e ogni richiesta andava applicata due volte o si dimenticava. Ora `Clienti` è **tre
  righe**: la stessa tabella con `modo="clienti"`, che cambia tre cose e nessun'altra — il filtro
  Tipo inchiodato a «Cliente» (`stage = paid`, cioè **chi ha pagato davvero**: è il «acquisto di
  valore maggiore di 0» chiesto da Simone, e non serviva inventare un conteggio nuovo perché
  esisteva già), via le azioni che riguardano i lead e non le clienti, e le parole. Guadagno non
  richiesto ma il più grosso: **ricerca e filtri lavorano sul database** e non sulle 500 righe
  caricate — l'avviso «mostro le 500 più recenti di N» non serve più, perché non è più vero.
  🔴 **La cosa che poteva rompersi in silenzio.** Le due liste **non avevano lo stesso perimetro**:
  `crm.list` restringeva solo per **coach** (`CrmRecord.assignedCoachId`), l'elenco Clienti anche per
  **nutrizionista**. Unificarle senza accorgersene avrebbe dato a ogni nutrizionista la vista su
  *tutte* le clienti dell'azienda — e **una lista più lunga non somiglia a un errore**: nessuno
  l'avrebbe segnalata. Aggiunto il perimetro riusando `perimetroClienti`, la definizione unica già
  usata da Clienti e Acquisti; si filtra sulla **cliente collegata** e non su un campo del CRM,
  perché la nutrizionista è assegnata alle clienti, non ai lead (conseguenza voluta: i contatti senza
  cliente non li vede). **Cinque test nuovi** guardano il `where` che finisce a Prisma: la
  nutrizionista filtrata, quella **senza scheda staff che deve vedere zero e non tutto**, la coach
  che resta com'era (se le arrivasse anche il filtro sulla cliente perderebbe i lead senza cliente
  collegata, cioè quasi tutti i suoi), l'admin senza perimetro, e `tipo=client` = `stage=paid`.
  Aperti due ruoli: `nutritionist` su `GET /crm/leads` e `GET /crm/stages` — senza, aprirebbe la sua
  pagina Clienti e prenderebbe un 403. Non le apre niente: la lista applica il suo perimetro, gli
  stati sono un'anagrafica, «Gestione lead» nel menu resta dietro al permesso `crm_leads` che non ha,
  e la **board della pipeline NON è stata aperta** (quella mostra i lead, e il suo perimetro è ancora
  solo quello della coach).
  Non si perde la pastiglia **«senza glutine»** accanto al nome — l'unico posto in cui si vede chi
  l'ha dichiarato *senza avere ancora la dieta dedicata*: la calcola il server con
  `dichiaraSenzaGlutine`, la regola che sta in un posto solo, perché «senza glutine» letto male vuol
  dire pane a una celiaca.
  Verifiche: build backend verde, **111 suite / 1710 test**, build backoffice verde.

- `[Sviluppo]` 🥗 **Nella scheda cliente si sceglie la DIETA, non lo stile.** §16.10, prima parte.
  Lo **stile non identifica una dieta**: `Mediterranea`, `Mediterranea ipocalorica` e `Pescetariana`
  hanno tutte `style = 'mediterranean'`; `Vegana`, `Vegetariana`, `Flexitariana` e `Flessibile` sono
  tutte `flexible`. E la tendina «Stile» mostrava come etichetta il **nome della prima dieta
  approvata** con quel codice: si leggeva un nome di dieta e si sceglieva un codice che ne copre
  tre. Trovato guardando il profilo di `sim1one.salogni@gmail.com`: «Tipo di alimentazione:
  Mediterranea» e sotto «La tua dieta: Pescetariana» — le due righe si contraddicono e nessuna è
  sbagliata da sola. È lo stesso difetto che `diag:famiglie` cerca su 20 clienti.
  Ora la tendina è **«Dieta»**, e l'unità è la dieta approvata: nuovo `catalog.famiglie()`, esposto
  da `/catalog/taxonomy`. ⚠️ **Scrive due campi**: `dietFamily` e, insieme, lo `dietStyle` di quella
  dieta — non è una comodità, `pickDietFor` cerca famiglia **e** stile insieme, e una famiglia
  lasciata con lo stile di un'altra non trova niente e **ripiega su una dieta vicina**, cioè ricrea
  il difetto che la tendina chiude. La dieta che la cliente ha oggi resta in tendina anche se non è
  più approvata, marcata «(non più in catalogo)»: se sparisse, salvare un altro campo qualsiasi la
  cancellerebbe senza che nessuno l'abbia chiesto.
  **Dove lo stile sparisce dalla vista:** la riga «Stile alimentare» della scheda diventa «Dieta»
  (sotto c'è già «Dieta assegnata», quella che il motore eroga davvero: se le due non combaciano ora
  si vede); in **app** via la riga «Tipo di alimentazione», che diceva lo stile scelto in
  registrazione, non si aggiornava quando la nutrizionista spostava la cliente, e contraddiceva «La
  tua dieta» due centimetri sotto; e via lo stile accanto al nome in «Diete in revisione».
  **Non toccati, di proposito:** la colonna «Stile» nell'elenco Diete e il chip nelle Regole motore
  — lì lo stile è metà dell'identità di una **famiglia del catalogo**, non un attributo della
  cliente, e i form che lo scrivono devono restare (una dieta creata senza stile `pickDietFor` non
  la trova più). E i «?» del questionario e del profilo: le 10 schede con le fonti sono indicizzate
  **per stile**, e toglierlo davvero vorrà dire prima una mappa famiglia → scheda.
  Verifiche: build backend verde, **110 suite / 1705 test**, build backoffice verde, build app verde
  e 27 test. ⚠️ Tocca l'app: per il web basta il deploy, sul nativo entra con la OTA 2.1.8.

- `[Sviluppo]` 🏷️ **Nella tabella Clienti «Stato» diventa lo stadio della pipeline, e le pastiglie si
  vedono.** §16.11, tre rifiniture chieste da Simone. (1) La colonna «Stato» diceva
  `Attivo`/`Sospeso`, cioè lo stato dell'**account** — se la persona riesce a entrare: non è la
  domanda di chi apre l'elenco clienti, ed è «Attivo» anche per chi ha smesso di pagare sei mesi fa.
  Ora è lo **stesso stadio di Gestione lead**, letto da `CrmRecord.stage`. Due dettagli: l'elenco
  **legge** gli stadi da `/crm/stages` e non se li ridefinisce (etichette e colori li decide il
  backoffice, in un posto solo), e il valore ordinato e filtrato è l'**etichetta** — nella tendina si
  legge «Cliente», non `paid`. `null` (nessuna scheda CRM) resta distinto da uno stadio mancante: si
  mostra «—» con la spiegazione nel titolo, invece di farlo sembrare uno stato.
  (2) **Le pastiglie si vedono**: «bello il bordo colorato, ma si vede poco» — era 1px sopra il
  bianco, e in una tabella di venti righe scompare. Ora il colore dello stadio entra anche nello
  **sfondo** (velato al 12%, così il testo resta leggibile), il bordo passa a 2px e il testo prende
  il colore scurito. Sta in `backoffice/src/lib/stadio.ts`, **un posto solo** usato da entrambe le
  tabelle: il colore arriva dal database (`Stage.color`) e quindi non può vivere in un foglio di
  stile, e due copie sarebbero tornate a divergere alla prima correzione fatta su una tabella sola.
  `color-mix` regge nome CSS, `#rgb` e `rgb()` — mescolare a mano avrebbe voluto dire riconoscere tre
  formati e sbagliarne uno; dove non è supportato resta il bordo di prima.
  (3) **Via il filtro «Glutine»**, come chiesto. La *pastiglia* nella cella del nome resta: non è un
  filtro, è il segno che la cliente ha dichiarato il glutine e non ha ancora la dieta dedicata, e
  quello è l'unico posto in cui si vede.
  Verifiche: build backend verde, **110 suite / 1705 test**, build backoffice verde.

- `[Sviluppo]` ✅ **`menu_penalty_repeat` in produzione vale 1: l'allarme di stasera era MIO, non del
  sistema.** Nella ricognizione avevo scritto che la penalità di ripetizione era «quasi certamente
  ancora a 0», perché il seed non sovrascrive il valore di una riga che esiste già
  (`prisma/seed.ts:1279`, `update: { description }`). Il ragionamento è giusto, la conclusione no:
  **letta dal backoffice, la riga vale `1`** (e `menu_repeat_window_days` 14, `menu_variety_min_gap_days`
  2). O la riga non esisteva quando il seed è passato, o l'ha messa qualcuno a mano. ⚠️ Resta vero il
  **meccanismo**: ogni parametro «cambiato nel seed» dopo il primo deploy non arriva in produzione da
  solo — ma prima di dirlo di uno specifico parametro **si legge il valore**, che è a due clic.
  E resta aperta la domanda vera: se la penalità è attiva, perché i menu si ripetevano.

- `[Sviluppo]` 📌 **I filtri delle tabelle non restavano fermi: una `ref` di callback al posto di una
  `useRef`.** §16.5, segnalata **tre volte** e in **tutte** le tabelle. Il meccanismo
  (`useTestaFissa`, `position: sticky`) c'era già ed era giusto: sbagliava **la misura**. Guardato
  nel browser, sulla pagina Clienti in produzione: la riga dei titoli restava (`top: 0`), quella dei
  filtri aveva `top: 0px` invece dei **35px** dell'altezza dei titoli — cioè si incollava *sotto* i
  titoli, che sono opachi e stanno più in alto nello `z-index`, e spariva. Controprova fatta lì:
  forzando `top: 35px` la riga resta in vista.
  ⭐ **Perché la misura era 0.** `useTestaFissa` usava `useRef` + `useLayoutEffect` con dipendenze
  `[attiva, colonne.length]`. **Al primo render la tabella non c'è ancora**: ogni pagina mostra prima
  lo spinner. `rifTesta.current` era `null`, l'effetto usciva subito — e non tornava mai più, perché
  quelle dipendenze non cambiano quando i dati arrivano. Il `ResizeObserver` non veniva nemmeno
  agganciato. Ora `rifTesta` è una **ref di callback**: la misura parte quando la riga entra davvero
  nel DOM. Una riga, e vale per tutte e 30 le tabelle, perché passano tutte da qui.
  Due lezioni: **un difetto che si vede in TUTTE le schermate non sta nelle schermate**, e il posto
  dove si trovava era il **browser**, non il codice — nel codice quella funzione si legge giusta, e
  l'avevo letta due volte dichiarandola a posto.

- `[Sviluppo]` 👁️ **«Entra come» diventa un permesso, e sotto impersonazione si può solo
  GUARDARE.** Prima metà della §16.4, con le tre decisioni prese da Simone l'11/8. (1) **Chi può**:
  `POST /admin/impersonate` era `@Roles('admin')` fisso — una decisione di prodotto scritta nel
  codice, che la matrice dei permessi *non nominava nemmeno*; ora c'è la chiave `impersonate` con la
  guardia che la legge, di default solo admin perché entrare in un account vuol dire vedere dati
  sanitari. E il pulsante nel backoffice era mostrato **senza alcun controllo** in tre schermate: chi
  non era admin lo scopriva premendolo, e riceveva un 403 al posto di un pulsante che non c'è.
  (2) ⭐ **Cosa può fare: solo leggere.** Il token portava `impersonatedBy` ma *nessuna rotta lo
  guardava*: chi entrava nei panni di una cliente poteva agire al posto suo, e l'audit di quelle
  azioni diceva che le aveva fatte lei. Per una persona che ci mette dentro peso, misure e documenti
  sanitari è la differenza fra «qualcuno ha guardato» e «qualcuno ha deciso al posto mio senza che io
  lo sappia». `SolaLetturaImpersonazioneGuard`, globale e ultima della catena, lascia passare solo
  `GET`/`HEAD`/`OPTIONS`; unica scrittura ammessa il **logout**, perché senza «Torna admin» darebbe
  errore proprio mentre si prova a fare la cosa giusta; `POST /auth/switch` **no**, che da una
  sessione impersonata sarebbe una scala. Il rifiuto dice *perché*: davanti a un 403 muto, chi sta
  aiutando una cliente al telefono pensa a un guasto. (3) **Trenta minuti**: `IMPERSONATION_TTL` era
  già il default, qui è stato scritto nel codice perché è una decisione e non un ripiego — scaduti,
  si ricade fuori e per rientrare si preme di nuovo, così ogni ingresso lascia una riga nell'audit
  invece di una sessione aperta a tempo indeterminato. Alla cliente non si scrive niente: resta
  nell'audit interno. Aggiunto anche il pulsante **nella tabella Clienti**, dove mancava — cioè
  nell'unico elenco da cui una coach parte davvero quando una cliente la chiama.
  ⭐ **E il pulsante apre l'APP, non il backoffice.** Collaudato subito dopo il deploy: «Entra come»
  su una cliente portava a **«Accesso non consentito»**. Non è una regressione — *non ha mai
  funzionato* per l'unico caso per cui serve: scambiava la sessione **dentro** il backoffice, e una
  cliente nel backoffice non ha nessuna pagina. Funzionava solo impersonando uno staff, che il
  backoffice ce l'ha. Ora per una cliente si apre la **web app in una scheda nuova**, con il token
  nel **frammento** dell'indirizzo (`/#t=…`, che non viaggia al server e non finisce nel `Referer`,
  e viene cancellato dalla barra appena letto), e la sessione del backoffice **non viene toccata**:
  chi sta aiutando al telefono si tiene la sua scheda di fianco. Due cose che l'app ha dovuto
  imparare: una **barra in cima sempre visibile** («stai guardando l'account di X, sola lettura, si
  chiude da sola dopo 30 minuti»), perché una scheda lasciata aperta assomiglia a qualsiasi altra;
  e la **modalità ospite** nel client API — sotto «Entra come» il 401 **non rinnova**. Senza, alla
  scadenza dei 30 minuti l'app avrebbe rinnovato col refresh token in `localStorage`, che è di
  *un'altra persona*: si sarebbe cambiata identità in silenzio. La scadenza dev'essere una porta che
  si chiude.
  Verifiche: i **quattro job della CI riprodotti in sandbox** col client Prisma vero (vedi la voce
  sul `--no-engine`): build backend verde, **110 suite / 1705 test**, 7 nuovi sulla guardia, build
  backoffice verde, build app verde e 27 test dell'app. ⚠️ Tocca l'app: per il web basta il deploy di `app.metabole.eu`; sul nativo entra con la OTA 2.1.8, a lista finita.
  ⚠️ **Resta la seconda metà** — l'unificazione vera delle due tabelle — e leggendo sono usciti due
  vincoli: «ha speso > 0» **esiste già** ed è il filtro *Tipo = Cliente* di Gestione lead
  (`stage = paid`, scritto dal pagamento), quindi non serve inventare un conteggio nuovo; ma il
  **perimetro non è lo stesso** — l'elenco Clienti restringe per coach **e per nutrizionista**, la
  lista lead **solo per coach**: fonderle senza toccare quello allargherebbe a una nutrizionista la
  vista su *tutte* le clienti.

- `[Sviluppo]` 🔴 **CI rossa su `0d7e72f`: il file consegnato era costruito su un main vecchio e ha
  annullato una correzione già pushata — e adesso la CI si riproduce in sandbox, davvero.**
  Due cause, e la seconda è più importante della prima.
  **La causa immediata**: `catalog.service.ts` ha due transazioni interattive, e tutte e due
  annotavano il client come `PrismaService`. Dentro una `$transaction` il client è un
  `Prisma.TransactionClient` — senza `$transaction`, `$connect` e gli hook di Nest — quindi
  l'overload non combacia, TypeScript ripiega su quello ad array e il risultato diventa `any[]`:
  **quattordici errori da una riga sola**. La correzione (`c890db1`) ne aveva già sistemata una; la
  consegna successiva l'ha riportata indietro insieme all'altra.
  **La causa vera**: il file l'ho costruito su un `origin/main` **precedente** a quella correzione.
  La regola c'era già scritta — «prima di modificare un file confronta con quello del Mac» — e vale
  doppio a fine giornata, quando Simone committa mentre noi lavoriamo. Un file consegnato per intero
  non porta solo le sue modifiche: **riporta indietro tutto quello che non sa**.
  ⭐ **E la scoperta che rende inutile ripetere l'errore**: in sandbox il client Prisma **si può
  generare**. `binaries.prisma.sh` è bloccato, ma quel 403 riguarda i **motori**, non i tipi:
  `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 PRISMA_SCHEMA_ENGINE_BINARY=/bin/true npx prisma generate
  --no-engine` produce il client vero. I motori servono per parlare col database, non per compilare.
  Da lì girano **gli stessi quattro job della CI** — backend build + test, backoffice build, app
  build + test — e si sa se sarà verde **prima** di consegnare, invece di scoprirlo dal pallino
  rosso su GitHub. Finora si usava uno stub con tutto `any`, che compilava anche il codice sbagliato:
  era quello a nascondere entrambe le CI rosse di oggi.
  Verificato adesso, tutti e quattro: build backend verde, 109 suite / 1698 test, backoffice verde,
  app verde con 27 test.
- `[Prodotto]` 📌 **DA FARE — quello che resta aperto all'11/8/2026, in un posto solo.**
  Messo qui su richiesta di Simone: la coda vive in `PUNTO_DELLA_SITUAZIONE.md` §16, questa è la
  fotografia di fine giornata.
  **Decise da Simone, manca solo scriverle** — §16.8 tetto di guadagno del nutrizionista (solo campo
  di profilo, niente blocco) · §16.9 tabella delle sostituzioni di Gaia, contestuale, con «promuovi
  a regola».
  **Aperte, nell'ordine di priorità che aveva dato lui** — §16.2 Gaia deve poter correggere i piatti
  di *tutti* i menu emessi · §16.3 nuovo lead → notifica alla manager delle coach + tabella «Lead da
  assegnare» · §16.4 tabella Clienti uguale a Gestione lead ma solo chi ha speso · §16.6 «Piatto
  Freddo» fra i metodi di cottura · §16.7 slot per le visite creati dal nutrizionista.
  **Chiusa oggi**: §16.5 (i filtri delle tabelle restano fermi) — controllate tutte le tabelle del
  backoffice, le uniche due che disegnano i filtri a mano sono il catalogo ricette e `LeadsTable`, e
  adesso chiedono lo stile all'helper tutte e due.
  **Aspettano una persona, non del codice** — §15.3 il ritmo di calo di sicurezza è un numero da
  decidere con Nocanty · la **quota coach** sulle provvigioni del rinnovo, che blocca il monitoraggio
  a pagamento (numeri in `Decisione_Provvigioni_Rinnovo.md`) · le 12 varianti della
  **Keto-Mediterranea** da generare e validare con la nutrizionista.
  **In coda da prima** — §15.6 due pesate in aumento → i menu che hanno funzionato · revoca consenso
  e cancellazione a 30 giorni · le 14 richieste dei clienti del 5/8 · la sequenza dei menu diversa
  per ogni cliente (dettata l'11/8) · `install-ios.mjs` che rifaccia i quattro passaggi persi a ogni
  rigenerazione di `ios/`.
  **Sui tag, dopo la pulizia di oggi** — restano tre code corte: `npm run fix:tag-settimane` non è
  ancora stato lanciato sui dati esistenti (i `sett:` a database sono ancora quelli vecchi, anche se
  non li legge più nessuno); `diag-dieta.ts` racconta a schermo la **vecchia** semantica di `sett:N`;
  e **rinominare una dieta non aggiorna il tag `dieta:<nome>`**, quindi il generatore smette di
  ritrovarne le ricette orfane e le ricompra dall'AI.
  **A lista finita**: la **OTA 2.1.8** — e con quella arrivano sui telefoni anche le pastiglie dei
  tag tolte dalla scheda ricetta dell'app.

- `[Sviluppo]` 📤 **«Esporta in Excel» su TUTTE le trenta tabelle del backoffice — e le date escono
  come date.** Richiesta di Simone: «il pulsante esporta in excel con i filtri va applicato a tutte
  le tabelle». Ventinove passano da `useTabella` e prendono il pulsante con una riga; la trentesima,
  **Gestione lead**, ha un'esportazione sua perché filtra e pagina sul database: in memoria c'è una
  pagina sola, e scriverla sarebbe cento righe su ottomila senza dirlo. Lì il file si costruisce
  richiedendo al server le stesse pagine con gli stessi filtri, fino a un tetto di 5.000 righe che
  viene **detto prima** di scaricare.
  ⭐ **Le date adesso sono date.** Metà delle tabelle hanno una colonna il cui valore è una stringa
  ISO: scritta com'è, in Excel è testo — non si ordina per data, non si filtra per mese, non si
  raggruppa in una tabella pivot. Ora `excel.ts` la riconosce e scrive una cella data vera, col
  formato italiano. Due trappole trovate provandolo: `new Date('2026-08-11')` è mezzanotte **UTC**,
  quindi letta coi componenti locali diventava «11/08/2026 02:00» a Roma e **il 10 agosto** a New
  York — la cella *sembrava* giusta ma non era **uguale** alla data, e i confronti fallivano; e
  `2026-02-30` ha la forma di una data, `new Date` non protesta e la fa scivolare al 2 marzo, cioè
  un dato sbagliato che diventa un dato plausibile. Le date senza ora si leggono ora dai numeri
  della stringa, e i giorni fuori mese restano testo.
  Undici colonne di **importi** escono in euro e non in centesimi (`1990` sarebbe stato il prezzo di
  un piano da €19,90 — e si sarebbe sommato così).
  **Quello che ha fermato la revisione**, su ventinove inserzioni che compilavano tutte: (1) il
  pulsante non passava l'**avviso di troncamento** su sette tabelle che hanno un tetto lato server —
  `Acquisti` ne carica **200**, e il file si sarebbe chiamato «Acquisti» contenendone 200 su 3.000,
  esattamente il difetto per cui l'avviso era stato scritto la prima volta; (2) sei colonne
  esportavano la **chiave di ordinamento** invece dell'etichetta: uno sconto del 10% usciva
  `1000000010`, quattro colonne «Stato» uscivano `open`/`pending`/`scheduled`/`0`, e una dieta a
  cinque pasti col digiuno usciva `5.5`; (3) in `Valori nutrizionali` la colonna **P / C / G / F**
  spariva dal file — l'unica colonna di dato del backoffice senza `valore`, cioè proprio il motivo
  per cui qualcuno esporta quella tabella; (4) in Gestione lead il conteggio veniva da uno stato
  vecchio di 300 ms, e azzerando i filtri e cliccando subito si otteneva un file di tre righe su
  quarantamila.
  🔑 E una correzione che vale oltre l'esportazione: `crm.service` ordinava i lead per `updatedAt`
  **senza un secondo criterio univoco**. Su lead importati in blocco, che condividono il millisecondo,
  Postgres non garantisce lo stesso ordine fra due query: chi legge a pagine riceve righe ripetute e
  altre che non compaiono in nessuna. A schermo si notava poco, in un file che dichiara di essere
  completo no. Ora c'è `id` come secondo criterio, sempre.
- `[Sviluppo]` 🏷️ **I tag delle ricette spariscono dall'interfaccia, e la cliente non legge più
  `gen:flexible` sotto il suo piatto.** Deciso da Simone dopo la nota `NOTA_Tag_Ricette.md`: «se
  cucina italiana non è utilizzato togliamolo, come anche i tag». Riverificato sul main di oggi:
  `cucina italiana` **non lo legge nessuno** — la preferenza «ricette semplici» della cliente filtra
  su `difficulty === 'semplice'`, non sul tag — e i tag si vedevano in due posti soli, il campo
  libero nella scheda ricetta e le pastiglie in app.
  Via tutti e due, più la spunta «Cucina italiana», che prometteva un effetto che non esisteva.
  ⭐ **E il salvataggio della scheda non manda più `tags`.** `updateRecipe` li scrive solo se
  arrivano, quindi non mandarli vuol dire non toccarli: il tag `dieta:<nome>` — l'unico ancora vivo,
  quello con cui il generatore ritrova le ricette orfane invece di ricomprarle dall'AI — da qui non
  si può più rompere. Prima bastava cancellarlo distrattamente dal campo di testo.
  I tag non escono nemmeno più da `GET /recipes/:id`, che è l'unica rotta del catalogo aperta anche
  alle clienti: toglierli in app non sarebbe bastato, perché il prossimo pezzo di interfaccia che
  stampa quello che riceve li avrebbe rimessi a schermo. Si tolgono dove nascono.
  Restano nel database, e devono restarci: `dieta:` serve al generatore.

- `[Sviluppo]` 🔴 **Il build del backend era rosso: dentro una transazione il client non è
  `PrismaService`.** La CI delle 20:25 si è fermata su `nest build` con **14 errori** in
  `catalog/catalog.service.ts`, tutti figli di una sola annotazione ripetuta due volte:
  `this.prisma.$transaction(async (tx: PrismaService) => …)`. `$transaction` ha due overload — uno
  prende un **array** di promise, l'altro una **callback** che riceve `Prisma.TransactionClient`,
  cioè il client *senza* `$transaction`, `$connect`, `$on`. `PrismaService` quei metodi ce li ha (più
  gli hook di Nest), quindi non è assegnabile al parametro della callback: l'overload giusto viene
  scartato, TypeScript ripiega su quello ad array e l'esito diventa `any[]`. Da lì ogni campo letto
  (`esito.messa`, `esito.sostituito`, `esito.settimanaNuova`, `esito.tolta`, `esito.complete`) è un
  errore a sé — 1 causa, 14 sintomi. Correzione: `type PrismaTx = Prisma.TransactionClient` in testa
  al file, **come già fanno `commerce.service.ts` e `finance.service.ts`**, e le due callback
  annotate con quello. Nessun cambio di comportamento: dentro si usano solo `tx.dietDayTemplate` e
  `tx.recipe`.
  ⭐ **Perché il verde della consegna precedente non l'aveva visto, e cosa si fa d'ora in poi.** Il
  type-check in sandbox gira su uno **stub** di `@prisma/client` che tipa `$transaction` in modo
  largo: l'errore lì non *poteva* comparire, e il confronto col baseline diceva «zero introdotti»
  perché non c'era né prima né dopo. La verifica vera si può fare **sul Mac**, dove il client Prisma
  è generato per davvero: `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` in
  `backend/` ha riprodotto **gli stessi 14 errori della CI**, e dopo la correzione li ha visti
  sparire senza introdurne nessuno. ⚠️ Sul Mac restano **77 righe di errori solo locali**
  (`planHeldAt`, `reasonKey`, `kcalOverride`, `deletionRequest`, `nutrientFact`…): sono campi e
  modelli che stanno in `prisma/schema.prisma` ma **non** nel client generato, fermo a uno schema
  vecchio. In CI non compaiono perché lì il client si rigenera — infatti la CI si è fermata a «Found
  14 error(s)», non a 91. Quindi il metodo è: **si confronta col baseline, non si guarda il totale**.

- `[Sviluppo]` 🔗 **Dal dettaglio della ricetta la si collega alle diete e alle settimane — e la
  revisione ha fermato tre modi di rompere i menu delle clienti.** Richiesta di Simone: «dentro il
  dettaglio in modifica inseriscimi la dieta (posso collegarne più di una) e la settimana (posso
  collegarne più di una o addirittura aggiungerne una nuova)», e poi «ragiona per righe: Low carb
  Settimana 1, Mediterranea Settimana 4, Keto Settimana 8».
  Nel modale c'è **«Dove è usata»**: una riga per dieta e settimana, il giorno come dettaglio sotto,
  «Togli» su ogni riga e un modulo per collegare. Le righe si leggono dalle giornate e **valgono
  subito**, senza «Salva»: toccano le giornate di una dieta, non la ricetta, e tenerle in sospeso
  vorrebbe dire poter chiudere la scheda con dei collegamenti a metà. Scelta la dieta, il server
  propone **la prima settimana con un buco in quel pasto** — che è il posto dove il piatto entra
  senza cacciarne un altro — e se il ciclo è pieno propone una settimana nuova.
  Tre decisioni prese da Simone: il **giorno lo sceglie lui** (l'automatico nasconde quale giornata
  è stata toccata e cosa c'era prima); collegare **non rimanda la dieta in bozza** anche se è
  approvata (declassarla vorrebbe dire toglierla alle clienti che la seguono per una correzione di
  catalogo); si può **creare una settimana nuova**, con l'avviso che le altre sei giornate sono
  vuote.
  ⭐ **Quello che ha fermato la revisione, su codice verde.** (1) La funzione che scrive il pasto lo
  rimetteva **in fondo** all'array — cosa che viene naturale scrivendo `filter` seguito da un
  `push` — e l'ordine dell'array è l'ordine con cui l'app disegna i pasti: collegare una colazione
  alla prima giornata del ciclo avrebbe mostrato «pranzo, cena, colazione» a **tutte** le clienti di
  quella dieta. Nessun test lo vedeva, perché a insiemi la giornata era giusta. (2) Siccome la dieta
  non torna in bozza, `assertActivatable` **non ci ripassa più**: il cancello R8 sugli allergeni
  sarebbe stato scavalcato in modo permanente, e una ricetta con gli allergeni solo *suggeriti*
  sarebbe finita nel piatto di una cliente. Ora il controllo si fa qui. (3) «Togli» lascia la
  giornata monca, e una giornata monca il motore **la scarta**: il ciclo servito si accorcia di una
  giornata per tutte, e sull'ultima giornata completa la dieta resterebbe senza niente da erogare.
  Ora l'ultima è rifiutata, e il messaggio dice il prezzo vero invece di «il pasto resta vuoto».
  Altre correzioni della stessa revisione: lettura e scrittura nella **stessa transazione** (fuori,
  due nutrizionisti sulla stessa giornata si cancellavano il pasto a vicenda, senza errore e con
  l'audit di tutti e due che diceva «fatto»); il **livello** filtrato a 1 (un `findFirst` su
  `{dietId, dayIndex}` poteva scrivere in un ciclo che nessuno eroga); la settimana si crea intera
  **solo se non esiste**, perché riempire i buchi di una settimana parziale allungava di nascosto il
  ciclo di una dieta viva; l'elenco «Dove è usata» passa a una query SQL invece di leggere tutte le
  giornate del catalogo a ogni apertura di scheda; le voci della tendina distinguono le varianti
  (due diete con lo stesso nome e regime ma una col digiuno erano due righe identiche che si
  comportano in modo opposto — il digiuno non ha colazione).
  E una cosa che va detta e prima non si diceva: se dopo il collegamento la giornata è ancora
  monca, l'esito lo scrive — **il piatto è salvato ma non arriva a nessuna cliente**. «Collegata» da
  sola si legge come «in produzione».
  Verifiche: type-check col baseline invariato, 109 suite / 1698 test verdi (22 nuovi su
  `collega-ricetta`), build del backoffice verde.

- `[Sviluppo]` 🔧 **Le colonne Dieta e Settimana mostravano «—»: il 7 della settimana era un
  parametro, e un parametro cambia il tipo.** Segnalazione di Simone a poche ore dalla consegna.
  Nella query, `${GIORNI_SETTIMANA}` finiva come **parametro** e non come costante scritta: Prisma
  manda i numeri JavaScript come `double precision`, quindi `(day_index - 1) / 7` smetteva di essere
  una **divisione fra interi** e diventava una divisione con la virgola — il giorno 3 nella settimana
  1,2857. La lezione vale oltre il caso: *un parametro al posto di una costante cambia il tipo, e col
  tipo cambia il significato dell'operatore*. Il `7` ora è scritto nella query, con un
  `Math.round` come rete di sicurezza sui valori che tornano.
  Nella stessa passata: l'elenco degli id passa da `= ANY($1::text[])` a `IN (Prisma.join(...))`, la
  forma documentata per un elenco di valori, che manda ogni id come parametro suo invece di affidarsi
  a come il driver decide di serializzare un array.
  ⭐ **E soprattutto: l'errore adesso si scrive nei log.** La prima versione lo ingoiava con un
  `catch` muto perché «la pagina deve continuare a funzionare» — giusto — ma senza dire niente a
  nessuno. Risultato: mezz'ora a indovinare perché le colonne mostrassero «—», con tre spiegazioni
  possibili e nessun modo di distinguerle. **Un errore inghiottito trasforma un guasto preciso in un
  mistero**: la degradazione elegante è per l'utente, non per chi ripara. Le due cose stanno
  insieme — la pagina regge *e* nei log di Render c'è scritto cosa è successo.
  Il messaggio in colonna resta a tre stati distinti, ed è quello che ha permesso di restringere il
  campo subito: «—» = non lo so, pastiglia grigia «nessuna» = ricetta orfana, pastiglie coi nomi =
  usata. Se «—» e «nessuna» fossero stati la stessa cosa, il difetto sarebbe sembrato un catalogo
  fatto tutto di ricette orfane.
- `[Sviluppo]` 📌 **Nel catalogo ricette i campi di ricerca delle colonne restano incollati sotto i
  titoli.** Segnalazione di Simone: «devono restare fissati ai titoli, non devono scorrere». È lo
  stesso difetto già corretto in Utenti, ricomparso da un'altra porta: `useTabella` incolla i titoli
  **e** la riga dei filtri, ma solo quando la riga dei filtri la disegna lui. Il catalogo ricette se
  la scrive a mano — i suoi filtri vanno al database, non all'helper — e quindi riceveva lo stile sui
  titoli e non sui filtri. Scorrendo mille ricette i titoli restavano su e i filtri sparivano: per
  cambiarne uno si tornava in cima, ed è la schermata su cui il nutrizionista passa le ore.
  La correzione non è nella pagina ma nell'helper, che ora **espone** lo stile (`t.stileFiltri`)
  invece di tenerlo chiuso dentro: `LeadsTable` — l'altra tabella con la riga dei filtri scritta a
  mano — quello stile lo chiedeva già alla sua versione lato server, e infatti era a posto.
  Controllate tutte le tabelle del backoffice: sono le uniche due che disegnano i filtri da sé, e
  adesso lo chiedono tutte e due.

- `[Sviluppo]` 🏷️ **Nel catalogo ricette via la colonna Tag, dentro «Dieta» e «Settimana n.» — e si
  leggono dalle giornate, non dalle etichette.** Richiesta di Simone: «in questa tabella togli la
  colonna TAG inserisci la colonna dieta e la colonna settimana n.». Non è un cambio di vestito: i
  due dati che si guardavano nella colonna Tag (`dieta:<nome>`, `sett:N`) **rispondono a un'altra
  domanda**. Il generatore scrive `dieta:` alla **nascita** della ricetta, e quando un'altra famiglia
  riusa quel piatto — cosa che fa apposta, perché sono piatti già pagati e spesso già corretti a mano
  — il tag non cambia. Dice dov'è *nata*, non dov'è *usata*. `sett:N` aveva lo stesso difetto ed è già
  costato una diagnosi sbagliata («le mette tutte nella prima settimana» su una dieta distribuita su
  due). Adesso la domanda si fa a chi conosce la risposta: le **giornate**, a ogni richiesta.
  Nuovo `backend/src/catalog/utilizzo-ricette.ts`: una query che apre l'array dei pasti
  (`CROSS JOIN LATERAL jsonb_array_elements`, lo schema già usato in `copertura-catalogo.ts`) e
  torna, per ogni ricetta **mostrata**, le diete che la usano e in che settimane. La colonna
  «Settimana n.» prima esisteva solo dentro una dieta; ora c'è sempre, e le varianti sorelle (3 pasti
  / 5 pasti / digiuno) contano per **una** dieta sola, perché hanno lo stesso nome.
  ⭐ La cosa che vale più delle colonne: **«Dieta = nessuna» è il filtro delle ricette orfane** —
  piatti generati, pagati e riletti che nessuna giornata usa, cioè lavoro che nessuna cliente vedrà
  mai. Prima non c'era modo di chiederlo.
  **Due difetti trovati dalla revisione, che non rompevano niente.** Il primo: `archiveDiet` mette la
  dieta a `rejected` ma **non cancella le sue giornate**, quindi una ricetta usata solo da una dieta
  ritirata sarebbe risultata «in uso» — la colonna avrebbe mancato proprio la classe di ricette che
  l'archiviazione produce. Ora le diete archiviate non contano (le bozze sì: una dieta in
  costruzione la ricetta la usa davvero). Il secondo: con «Dieta = Keto» + «Settimana = 1» si sarebbe
  elencata una ricetta che sta nella settimana 1 della Mediterranea e nella 3 della Keto — due verità
  separate lette come una frase sola, falsa. Ora col filtro Dieta attivo la settimana si guarda
  **dentro quella dieta**, e ogni pastiglia di dieta porta le sue settimane nel titolo.
  **La cache che avevamo deciso non c'è.** L'idea era tenere le giornate in memoria un minuto; la
  revisione ha fatto notare che `render.yaml` ha `numInstances: 2`, quindi due cache indipendenti non
  ritardano: **oscillano**, e la stessa ricetta mostra «Mediterranea» e poi «nessuna» a tasti
  alterni. Chiedere solo le righe che escono (al massimo mille) invece di scandire il catalogo intero
  è più fresco **e** più veloce: la query provata su un Postgres vero con 315 diete e 26.463 giornate
  sta in ~80 ms. E se quella lettura fallisce le due colonne valgono «—», non «nessuna»: un elenco
  vuoto qui è un'affermazione precisa su lavoro pagato, e non va fatta per un errore di rete.
  Verifiche: type-check backend col baseline invariato, 107 suite / 1648 test verdi (9 nuovi),
  `npm run build` del backoffice verde, e la query SQL provata su Postgres 16 con i casi limite —
  varianti sorelle, diete archiviate, confini di settimana 7→1 e 8→2, giornate con `meals` guasto.
- `[Sviluppo]` 📄 **`progetto/NOTA_Tag_Ricette.md` — a cosa servono i tag delle ricette.** Nessun
  documento del progetto li definiva: la specifica backend cita `tags[]` con un esempio e basta, e la
  semantica dei prefissi viveva in una riga di codice. Letto tutto, il quadro è questo: **nessun tag
  influenza la composizione dei menu** (il motore non legge mai `Recipe.tags`), `gen:*` ha un solo
  lettore in uno script di pulizia, `sett:N` nessuno, i tag liberi della nutrizionista nessuno.
  L'unico vivo è `dieta:<nome>`, che serve a ritrovare le ricette orfane per riusarle invece di
  ricomprarle dall'AI. Tre cose meritano una decisione: **`cucina italiana` non fa niente** (le
  «ricette semplici» filtrano su `difficulty`, non sul tag, quindi la spunta promette un effetto che
  non ha); il campo Tag della scheda è **testo libero senza validazione** e un salvataggio distratto
  può cancellare `dieta:` — nessun errore, e il generatore ricompra un piatto che esiste già; e i tag
  interni **si vedono in app**, quindi la cliente legge `gen:flexible` fra i chip del suo piatto.

- `[Sviluppo]` 🥛 **Chi è intollerante al lattosio riceve il delattosato, e i formaggi stagionati non si
  toccano** — richiesta di Simone. `SUBSTITUTION_MAP` mandava `latte → bevanda vegetale`: sbagliato due
  volte, perché la bevanda vegetale **non è latte** (proteine, calcio e sapore diversi, e la giornata è
  bilanciata su quello che c'era prima) e perché non serve — il latte delattosato ha lo **stesso profilo
  nutrizionale**, l'idrolisi scinde il lattosio in glucosio e galattosio senza toccare altro. E
  `parmigiano → parmigiano ben stagionato` sostituiva una cosa con se stessa.
  Ora `menu/lattosio.ts`, applicato in `evaluateMeals`: latte, yogurt, mozzarella, ricotta, panna,
  stracchino… → versione **senza lattosio**; i **formaggi stagionati non si sostituiscono affatto**
  (circolare del Ministero della Salute dell'1/2/2016: 25 DOP con lattosio **sotto lo 0,001%**, cioè
  milligrammi per 100 g — l'EFSA non fissa una soglia unica di tolleranza, la letteratura indica ~12 g
  per dose come generalmente tollerati, quindi millesimi di grammo sono al riparo con qualunque
  margine); il burro resta all'olio evo (il burro delattosato non si trova al supermercato); e ciò che è
  già «senza lattosio» non viene sostituito due volte.
  ⚠️ **L'allergia vince sempre, ed è la parte che conta.** L'intolleranza è un deficit di lattasi;
  l'allergia alle proteine del latte è una reazione immunitaria a caseina e lattoglobuline, che nel
  delattosato **ci sono tutte**: l'idrolisi toglie lo zucchero, non l'allergene. Dare un «latte senza
  lattosio» a un'allergica al latte è mandarle in tavola ciò che le fa male con un'etichetta che la
  rassicura. **Giusy, la cliente da cui nasce la richiesta, ha entrambi i dati**: per lei la regola non
  scatta e resta la strada di prima. I termini di allergia sono volutamente larghi (latte, latticini,
  caseina, siero di latte, APLV…): un falso positivo costa una sostituzione più prudente, un falso
  negativo una reazione allergica, e l'asimmetria decide da sé come scriverli.
  Confronto **per parola** come vuole la regola del progetto: «latteria» non è «latte».
  107 suite / **1667 test verdi** (28 nuovi in `menu/lattosio.spec.ts`); type-check confrontato col
  baseline: zero errori introdotti (⚠️ il verde a zero di `npm run typecheck` va confermato sul Mac).
  Nessuna migrazione, niente da toccare su Render: vale dal deploy, sui menu generati da lì in avanti.
  📌 **Nota**: la richiesta parlava di «gruppo di equivalenza». La tabella `EquivalenceGroup` esiste ma
  il motore la usa in **un punto solo** (il piatto gemello del secondo giorno) e **non** la legge per le
  sostituzioni, che passano tutte da `SUBSTITUTION_MAP`. La regola è stata scritta dove viene davvero
  applicata: riempire quella tabella avrebbe prodotto una configurazione che nessuno legge. Il gruppo
  visibile e modificabile dal backoffice, se serve, è un secondo lavoro.

- `[Prodotto]` 📋 **DA FARE, dettato da Simone l'11/8: la sequenza dei menu deve essere diversa per ogni
  cliente** — «il numero di settimane serve a noi per creare il pool di menu e ricette, ma non vanno
  erogati nella stessa sequenza: rendila random (colazione con colazione, pranzo con pranzo), escludendo
  nell'erogazione successiva quel menu, così ogni cliente ha una sua sequenza. E una volta terminati i
  menu, crei nuove combinazioni basandoti sui gusti e sui risultati ottenuti dalla cliente.»
  Oggi la sequenza è **identica per tutte**: `templates[daysSinceStart % templates.length]`
  (`menu.service.ts` ~554). Varia solo il contenuto dei piatti. ⚠️ E il giro è corto: la dieta di Giusy
  ha **14 giornate tipo**, quindi su 12 settimane la sequenza si ripete **sei volte**.
  Da non sbagliare quando si scrive: il «random» deve essere **riproducibile** (seme per cliente, mai
  `Math.random()` — `deliverIfEligible` gira a ogni apertura dell'app e la stessa data deve dare la
  stessa giornata); guardare `ClientMenuPool`, che esiste già; rendere coerenti le altre due rotazioni
  (`list[dayIndex % list.length]` a ~1470 e il guard `menu_variety_min_gap_days`), o si combattono fra
  loro; e sicurezza, bilanciamento kcal e giornate complete restano prioritari sulla varietà. Il terzo
  punto — combinazioni nuove su gusti e risultati — è un lavoro a sé, da parlare prima di scriverlo.

- `[Sviluppo]` 📊 **«Esporta in Excel» sulla pagina Gestione dieta: esce quello che si vede, filtri
  compresi.** Richiesta di Simone: «nella pagina gestione dieta mi fai un esporta in excel dove mi
  esporti la tabella coi filtri applicati al momento del click». Il pulsante c'è in tutte e tre le
  schede — Catalogo ricette, Allergeni, Gruppi di equivalenza — accanto al contatore delle righe,
  che è il numero che finirà nel file.
  **Le righe esportate sono quelle filtrate e ordinate, di tutte le pagine, non solo di quella
  aperta**: la paginazione è un fatto dello schermo, non del filtro, e un file con le prime cento
  righe di trecento sarebbe un taglio che nessuno può vedere una volta aperto il foglio.
  ⚠️ Per lo stesso motivo, dove la tabella **non ha in mano tutto il dato** l'esportazione lo chiede
  prima di partire: il catalogo ricette ne riceve al massimo 1000 dal server, e se i filtri ne
  trovano di più il pulsante avvisa che il file conterrà quelle mille. Un banner nella pagina non
  segue il file sulla scrivania di nessuno.
  **Come è fatto** — `backoffice/src/lib/excel.ts`, nuovo: un .xlsx vero (zip + XML) scritto a mano,
  **senza aggiungere dipendenze**. Il backoffice ne ha tre in tutto, e SheetJS avrebbe voluto dire un
  `npm install` e un `package-lock.json` rigenerato prima di ogni commit — un passaggio che da GitHub
  Desktop non c'è. Niente CSV: in Excel italiano si apre a colonna unica e i numeri diventano testo.
  Il foglio esce con l'intestazione in grassetto e bloccata, il filtro automatico e le larghezze sul
  contenuto; le kcal sono celle numeriche, quindi si sommano.
  **Dove vive** — dentro `useTabella`, non nelle pagine: l'helper conosce già colonne, filtri e
  ordinamento, quindi l'esportazione è coerente con la tabella per costruzione e le altre trentaquattro
  tabelle del backoffice la ottengono con una riga (`<BottoneExcel tabella={t} />`).
  Una trappola trovata scrivendola: `valore` in metà delle colonne restituisce una **chiave di
  ordinamento** e non l'etichetta — il posto del pasto nella giornata (`0`) invece di «Colazione»,
  `0`/`1` invece di «Attiva»/«Archiviata». Esportare `valore` avrebbe dato un foglio di numeri
  plausibili e sbagliati, senza che niente si rompesse: da qui il campo `esporta` sulla colonna, che
  si dichiara solo dove le due cose divergono.
  Provato per davvero: `tsc -b` e `npm run build` verdi, e i file generati riaperti con un lettore
  xlsx indipendente — tre casi (nessun filtro, filtro su una colonna, ordinamento invertito) per
  controllare che nel foglio finissero le righe giuste, nell'ordine giusto, con le etichette al posto
  delle chiavi e senza la colonna dei pulsanti.
  **E una revisione severa prima di consegnare**, che su codice verde ha trovato cinque cose che
  nessun test avrebbe visto: l'avviso sul troncamento **dichiarava il numero sbagliato** (diceva
  «il file ne conterrà 1000» mentre in Allergeni, che si apre già filtrata su «Da rivedere», ne
  escono un centinaio — un avviso che sbaglia il numero fa più danno del silenzio, perché lo si
  crede); la **nota di sicurezza** dei gruppi di equivalenza («controllare le etichette per
  allergeni») si vedeva a schermo e spariva dal file, cioè proprio il campo con implicazioni
  sanitarie; la settimana usciva come **testo** anche quando era un numero solo, e Excel la ordinava
  in alfabetico («1», «10», «2»); `etichetta` veniva applicata solo ai valori stringa, quindi la
  prossima colonna numerica con una traduzione avrebbe scritto `0` dove la tendina mostra
  «Colazione»; e il `title` che spiega perché il pulsante è spento stava **sul pulsante disabilitato**,
  dove Chrome non lo mostra — il motivo per cui un comando è spento è la metà del comando.

- `[Sviluppo]` 🎬 **«Conosciamoci» si attiva da sola a fine questionario, e la prova comincia col primo
  menu** — §16.1. Finito il questionario la cliente non incontra più il negozio: Gaia le dà il
  benvenuto («dedicami 8 giorni per conoscerti»), le chiede **la data in cui vuole iniziare** — campo
  obbligatorio, che prima non esisteva — e da lì entra nell'app. `attivaBenvenuto`: piano gratuito →
  Subscription **`active`** con date già scritte → `planStartDate` → referral → monitoraggio → audit.
  **Niente `Payment`, niente `Order`** («ora mi intasa la tabella acquisti e basta»).
  Le tre cose fatte con cura, perché l'analisi diceva esattamente dove si rompe: la Subscription nasce
  `active` e non `pending` (una `pending` senza pagamento è **irrecuperabile** e blocca ogni acquisto
  futuro: una cliente che non può più comprare niente, per sempre); la rete di sicurezza sulla durata
  (un `period` scritto male cadrebbe sul fallback a 3 mesi di accesso gratuito → default 8 giorni); la
  **data lontana è permessa**, quindi nessun cap a 60 giorni, con un limite a 12 mesi che non è contro
  la cliente ma contro il refuso dell'anno.
  ⭐ **E «Prova» arriva col primo menu, non con l'attivazione** (correzione di merito chiesta da
  Simone): con la data scelta da lei fra i due momenti passano settimane, e una board piena di «Prova»
  su chi non ha ancora visto un piatto è rumore che la manager delle coach impara a ignorare. I tre
  pezzi si sono spostati **insieme** — `trial_started`, CRM, avviso alla coach — in `provaAttivata`,
  chiamato da `deliverIfEligible` al primo `menuDay` in assoluto, idempotente perché quella funzione
  gira a ogni apertura dell'app.
  ⚠️ **Il buco che lo spostamento apriva**: `trial_converted` scatta solo se `trial_started` esiste, e
  chi compra **prima** del primo menu non l'avrebbe mai avuto — cioè la conversione di chi si
  entusiasma subito non sarebbe stata contata mai. Ora il primo acquisto vero, se trova la prova ma non
  l'evento, lo scrive **a ritroso** marcato `recuperato`, e poi conta la conversione.
  Il piano «Auto Apprendimento Gaia» esce dalla vetrina (cliente **e** pubblica) e l'acquisto viene
  rifiutato anche a chi arriva con l'id in mano (`assertPlanPurchasable`): nascondere non basta, l'elenco
  è un suggerimento e l'acquisto è una POST con dentro un `planId`. Resta nel database, perché serve il
  suo id per attivarlo.
  **Due estrazioni non per eleganza**: `MenuService` non può dipendere né da `CommerceService` né da
  `NotificationsService` (`NotificationsModule` importa `MenuModule`: la freccia opposta chiude un
  cerchio, e un `forwardRef` messo lì per farlo tacere è un rinvio). Quindi `funnelEvent` e il corpo di
  `notify` sono diventati funzioni libere che ricevono `prisma`, e i servizi le chiamano — una regola
  sola: due copie divergono, e quella che smette di avvisare non lo dice a nessuno.
  106 suite / **1639 test verdi** (28 nuovi, scritti sulle otto conseguenze dell'analisi); app a **zero
  errori** di type-check e 27 test verdi; type-check backend confrontato col baseline: **zero errori
  introdotti** ⚠️ da riconfermare col `npm run typecheck` vero sul Mac, perché in sandbox
  `prisma generate` resta appeso sul download dei binari. Nessuna migrazione.
  ✅ **Verificato in produzione l'11/8** (Shell di Render): a €0 esiste **un solo piano**,
  «Conosciamoci», `period '8d'`, attivo e non nascosto. Quindi il fallback trova il piano da sé e
  **`trial_plan_id` non va impostato**; e siccome `'8d'` è un periodo valido, la rete di sicurezza sulla
  durata non entra in gioco: la prova dura esattamente gli 8 giorni che Gaia promette nella pagina di
  benvenuto. Nota: `hidden` resta `false` e va bene — la prova sparisce dalla vetrina per codice
  (`isTrialPlan` in `listPlansForClient` e `listPublicPlans`), non per un flag che qualcuno può
  ribaltare dal Negozio senza sapere cosa comporta.
  Come si rifà, se un giorno serve: che il piano a €0 sia **uno solo**. Il modo più rapido è
  **Backoffice → Negozio**, che elenca tutti i piani col prezzo (anche i nascosti). Dalla Shell di
  Render, nella forma della §11 — `node -e`, **non** `ts-node`, che è in devDependencies e su Render
  non c'è:
  ```
  node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.plan.findMany({where:{priceCents:0},select:{id:true,name:true,period:true,active:true,hidden:true}}).then(r=>console.table(r)).finally(()=>p.$disconnect())'
  ```
  Se sono più di uno il codice **si ferma con un errore parlante** e si indica quale è la prova col
  parametro **`trial_plan_id`**, che vive in `config_param` → **Backoffice → Parametri**, non su Render.
  ⚠️ Nota di metodo: il primo comando scritto in questa voce usava `ts-node`, che su Render non è
  installato (è in `devDependencies`). Un comando che non parte è tempo perso in piedi davanti a una
  shell di produzione: la §11 aveva già la forma giusta, andava riusata invece di inventarne una. ⚠️ La parte app arriva sui telefoni solo con la **OTA 2.1.8**, a lista
  finita: fino a lì il backend è pronto e le clienti vedono ancora il vecchio flusso.
  `PlanFlow.tsx` non è più montato da nessuno: lasciato in piedi, da decidere se togliere.

- `[Sviluppo]` 📦 **OTA 2.1.7 — la correzione del caso Giusy arriva sui telefoni** — la 2.1.6 portava il
  banner della pesata di ciclo, non il modulo che ricompare dopo lo sblocco: quello sta in
  `MeasuresGate.tsx`, cioè nell'app, e senza bundle non esiste per nessuno. Nel 2.1.7 entrano i quattro
  file app toccati dopo il bundle precedente: `MeasuresGate.tsx`, `MenuStatusBanner.tsx`,
  `AppHeader.tsx`, `staff/shared/Notifiche.tsx`.
  Verifiche fatte **sullo zip prima di pubblicare**: `index.html` alla radice; `push-tokens` × 2 e
  listener `registration` × 2 (le push non spente dal build); la stringa `2.1.7` compilata dentro il JS;
  `Serve la tua pesata` e `ti ha riaperto` — cioè **la funzione per cui l'OTA esiste**, che è il solo
  controllo che un `dist/` vecchio ricostruito non passerebbe; `awaiting_cycle_measure` ancora presente,
  per non aver perso la 2.1.6 per strada.
  ⚠️ Nota di metodo: i comandi di verifica erano stati incollati in blocco **con i commenti `#` sulla
  stessa riga**, e la shell li ha presi come argomenti (`wc: #: open: No such file`). I tre `0 total`
  che ne sono usciti sembravano «stringa assente» ed erano errori di sintassi: un controllo che
  fallisce per il motivo sbagliato è peggio di nessun controllo. Rifatti uno per uno sullo zip vero.
  **Bruciate fino alla 2.1.7 compresa: la prossima OTA parte da 2.1.8.**

- `[Sviluppo]` 🚑 **«Riapri l'app» chiedeva le misure e faceva sparire il modulo per inserirle (caso
  Giusy, seconda puntata)** — segnalazione di Simone: «clicca riapri app, le arriva la notifica di
  inserire le misure ma non le fa inserire e si riblocca».
  Il backend faceva già la cosa giusta: dopo lo sblocco `measurementGate` risponde `required: true,
  blocking: false, level: 'promemoria'` — «cade il muro, resta la richiesta». Ma `MeasuresGate.tsx`
  guardava **solo `blocking`**, quindi con il muro caduto spariva anche l'unico posto dove scrivere le
  misure. Lei riceveva la notifica, apriva l'app, non trovava niente, e alla scadenza della finestra
  si ritrovava bloccata come prima. **Una richiesta senza il modo di soddisfarla è un rimprovero, non
  una richiesta.** Ora il modulo compare anche in promemoria — **richiudibile**, con scritto perché
  («la coach ti ha riaperto l'app, ma il prossimo menu parte solo con la pesata») — e si ritrova dal
  banner del Menu.
  E la finestra passa da **48 ore a 4**, come chiesto: 48 ore erano il peggio dei due mondi — troppo
  poche perché la cosa si risolvesse da sé, troppe perché qualcuno se ne accorgesse. La finestra serve
  a fare **una** cosa; se scade a vuoto, il muro che torna è l'informazione che serve alla coach.
  ⚠️ **La correzione è nell'APP: serve una OTA per arrivare sui telefoni.** Le 4 ore, che sono
  backend, valgono dal deploy.

- `[Sviluppo]` 🗑️ **Chi scrive un messaggio lo può cancellare** — richiesta di Simone: una ✕ rossa
  nell'angolo della propria bolla, con conferma prima di cancellare. **Solo l'autore**: non il capo,
  non l'admin. Il senso è rimediare a quello che si è scritto per sbaglio, non moderare quello che ha
  scritto un altro — un capo che cancella il messaggio di una collega dentro la conversazione con una
  paziente è una funzione diversa, con conseguenze diverse.
  La cancellazione è **morbida** (`deletedAt` + `deletedById`) e non un `DELETE`: la conversazione fra
  una cliente e chi la segue è materia sanitaria, e un consiglio dato e poi tolto resta un consiglio
  dato. Sparisce da **tutte** le letture — cliente, staff, contatore dei messaggi del thread e
  riassunti quotidiani, che altrimenti l'avrebbero rimesso in circolo da un'altra porta — e resta in
  tabella per chi un domani debba ricostruire i fatti. La conferma mostra il testo del messaggio: la
  ✕ è piccola e le bolle si somigliano. Cinque test.

- `[Sviluppo]` 🔥 **§15.5 — le calorie le può scrivere il nutrizionista, e resta scritto chi e perché** —
  il fabbisogno stimato è una **stima**: la formula non sa della tiroide, dell'attività dichiarata e
  non fatta, o del fatto che a 1600 kcal si è fermata per tre settimane. Chi lo sa è chi la segue, e
  fino a oggi non aveva un posto dove dirlo.
  **Due leve, scelte da Simone.** Il **deficit imposto** in kcal/giorno, che sostituisce quello dedotto
  dal ritmo dell'obiettivo ed è la leva clinica vera (resta agganciato al fabbisogno: se lei cala, il
  TDEE scende e le calorie scendono con lui, da sole); e la **correzione percentuale** sul totale, il
  ritocco fine per quando il ragionamento è giusto ma il risultato, sulla persona vera, è alto o basso.
  L'ordine è tutto e sta in `menu/correzione-kcal.ts`: `TDEE − deficit → ×(1+correzione) → soglia`.
  Prima del deficit, la percentuale si moltiplicherebbe con esso senza che nessuno se ne accorga; dopo
  la soglia, potrebbe scendere sotto il minimo con il pavimento che ha già dato l'ok. 17 test.
  **I tetti valgono sul deficit dedotto, non su quello prescritto.** Se il motore ricava dal ritmo
  dell'obiettivo un deficit di 1400 kcal/giorno, quello è un obiettivo irreale scritto in onboarding e
  va tagliato; se lo scrive un clinico, l'ha scritto un clinico.
  **Sulla soglia minima Simone ha deciso: la si può scavalcare, ma non per sbaglio e non in silenzio.**
  Il primo tentativo che finisce sotto viene **rifiutato, con dentro il numero** a cui si arriverebbe;
  serve un secondo invio con la conferma esplicita. Quando succede: riga nello storico marcata,
  segnalazione aperta (senza dedupe — ogni discesa è una decisione nuova con un motivo nuovo) e
  notifica ai capi nutrizionisti, perché lo devono **sapere**, non lo devono cercare.
  **Lo storico** (`kcal_override`) tiene i valori nuovi e i precedenti **e** il target in kcal prima e
  dopo: i valori dicono cosa è stato scritto, il target dice cosa è arrivato nel piatto, e non sono la
  stessa cosa perché in mezzo c'è il fabbisogno, che cambia da solo quando cambia il peso. Il **motivo
  è obbligatorio**: un target calorico cambiato senza il suo perché è un numero che nessuno può
  contestare, e in clinica quelli restano sbagliati più a lungo. Anche **azzerare** finisce nello
  storico — «chi gliele ha tolte» è una domanda che si fa quanto «chi gliele ha messe».
  Nella scheda cliente: il numero scomposto, l'**anteprima mentre si digita** (sapere di aver messo
  una cliente a 1000 kcal *dopo* averlo fatto non serve a niente) e lo storico con nome, data e motivo.
  ⚠️ **Verificato su Render prima di scrivere una riga**: `menu_kcal_need_enabled` non ha righe né in
  `config_param` né in `product_rule`, quindi vale il default del codice — **acceso**. Senza questa
  verifica avremmo costruito un campo inerte.
  🔧 **Trovato di striscio, e riparato: `redeliverFutureDays` poteva lasciare una cliente senza menu.**
  Cancellava i giorni futuri e poi rierogava, ma `deliverIfEligible` ha i suoi cancelli (misure
  mancanti, fine piano) e quando uno è chiuso restituisce zero. Risultato: giorni futuri persi e
  nessuno nuovo, per una modifica fatta da altri con tutt'altra intenzione. Ora si tiene una copia e,
  se la rierogazione non produce niente, **si rimettono com'erano** — un menu vecchio è meglio di
  nessun menu — e chi ha fatto la modifica lo legge, invece di credere che sia arrivata nel piatto.
  105 suite, **1611 test verdi**, type-check a zero.

- `[Sviluppo]` 🚨 **Build di produzione rotto, e la ragione per cui i test non potevano vederlo** —
  il commit `298c58f` ha fatto fallire il build su Render con un solo errore, in
  `menu.service.ts:463`: `soloGiornateComplete` dichiarava le giornate come `{ meals?: unknown }[]`
  e il risultato veniva riassegnato a `templates`, che Prisma tipizza `{ id, dayIndex, dietId,
  level, meals }[]`. **Corretto** con due tipi dichiarati a mano — `TemplateGiornata` accanto a
  `DietaPerErogazione` — perché quella variabile deve valere sia per le giornate della dieta
  richiesta sia per quelle della **gemella**, che sono di un'altra dieta.
  Nello stesso punto un secondo difetto, che il compilatore non poteva vedere: la query delle
  gemelle **non selezionava `levels`**, e il target calorico del giorno esce da
  `levelTargetKcal(diet.levels, level)`. Il ripiego avrebbe servito le giornate giuste **con le
  calorie a zero**. Ora `levels` e `objective` sono nella `select`, con un test che controlla la
  forma della query: è lì che il campo si perde, e si perde in silenzio.
  ⚠️ **LA REGOLA «42 ERRORI = VERDE», POI «32 = VERDE», È MORTA: IL VERDE È ZERO.** Quei numeri
  erano rumore dello stub di Prisma in sandbox, dove `npx prisma generate` prende un 403 sui
  binari — e un numero di rumore non distingue il rumore da un errore vero. Questo errore vero è
  passato in mezzo, ha superato **1578 test verdi** e si è visto solo in produzione: i test non
  potevano prenderlo perché montano un Prisma finto, e i tipi finti non hanno tipi.
  Da oggi `cd backend && npm run typecheck`: `prisma generate --no-engine` (per i **tipi** il motore
  di query non serve, serve lo schema) più un mirror finto in locale che risponde al 403 con un .gz
  di byte a caso — la CLI è contenta e genera i tipi **veri**. Verificato che riproduce l'errore di
  Render carattere per carattere, e che con la correzione dà **zero**. Come funziona, e i due file
  finti da 1 KB che lascia in `node_modules`, stanno scritti in testa a
  `backend/scripts/typecheck-reale.mjs`. 104 suite, **1578 test verdi**, type-check a zero.

- `[Sviluppo]` 🍽️ **Le giornate incomplete non arrivano più nel piatto (§15.4)** — il gate del
  catalogo controlla che una dieta abbia tutti i pasti **una volta sola**, quando qualcuno la rende
  visibile; l'erogazione non se l'è mai chiesto e si fermava solo alle giornate **zero**. Quindi una
  giornata con la sola colazione veniva servita e salvata così com'è, senza log e senza avviso: chi
  apriva l'app all'ora di pranzo non trovava niente, e da nessuna parte risultava un problema. Non è
  un caso di scuola — il generatore scrive le giornate direttamente e rompe solo se *tutti* gli slot
  sono vuoti, e due script pubblicano scavalcando il gate: una dieta può diventare incompleta **dopo**
  essere stata dichiarata a posto, e un controllo che si fa una volta sola non se ne accorge.
  Le tre decisioni di Simone, ora nel codice: **si servono le giornate complete** e le monche si
  saltano (un giorno in meno è meglio di un giorno con la sola colazione); se **nessuna** è completa
  si scende sulla **gemella completa della stessa famiglia**, tracciando `diet_meals_fallback` come
  già si fa per lo stile — il ripiego è voluto, il silenzio no; se **nemmeno le gemelle** reggono
  **non si eroga** e si apre una segnalazione, perché «menu in preparazione» è meglio di un pranzo
  che non c'è.
  La regola sta in `catalog/giornate-complete.ts`, usata sia dal gate sia dall'erogazione: era
  scritta a mano dentro il gate, e una regola che vive in un posto solo non può essere applicata in
  due. Sette test sul modulo, tre sull'erogazione.
  ⚠️ **I test del menu montavano giornate finte con un solo pasto** — e con lo slot scritto in
  italiano (`colazione`, `pranzo`, `cena`), che non corrisponde a nessuno slot reale. Restavano
  verdi perché nessuno guardava i pasti: sono stati allineati alla realtà, ed è la ragione per cui
  il difetto è vissuto tanto. Un test che semplifica il dato semplifica anche quello che può trovare.
  104 suite, 1578 test verdi. **`tsc` ora è a 32 e non più a 42**: tipizzando la dieta
  nell'erogazione sono caduti dieci errori che erano artefatti dello stub. Il nuovo riferimento è
  **32**.

- `[Sviluppo]` 💬 **Coach e nutrizionista rispondono dalla scheda cliente** — chiesto da Simone. La
  sezione Conversazioni era di sola lettura: si leggeva il problema con davanti misure, menu e
  segnalazioni, e per rispondere bisognava cambiare pagina. Ora in fondo alla conversazione c'è il
  campo, con invio da Ctrl/⌘+Invio (a capo con Invio: qui si scrivono spiegazioni lunghe, e un invio
  a metà frase parte così com'è).
  **Sul thread di Gaia il campo non compare**, e al suo posto c'è la ragione: una risposta dello
  staff dentro la conversazione con l'assistente arriverebbe alla cliente come se l'avesse scritta
  Gaia. Il backend la rifiutava già — là dentro lo staff ha accesso in sola lettura — ma un campo che
  si può scrivere e non si può inviare è una promessa rotta.
  Chi può scrivere continua a deciderlo il backend: è **chi segue la cliente**, non chi ne risponde
  in gerarchia (una coordinatrice che scrive nel thread «Coach» farebbe comparire alla cliente un
  messaggio che sembra della sua coach). Se rifiuta, si legge il suo motivo invece di un campo che
  sparisce senza spiegazione.

- `[Sviluppo]` 🎨 **Tema indaco: barra dei menu più chiara, e testi delle notifiche leggibili** —
  due segnalazioni di lettura, tutte e due sulla stessa causa: un colore usato fuori dal suo posto.
  La **barra dei menu** prendeva `--deep`, che nel tema indaco è quasi nero. Ora esiste `--sidebar`,
  che di default vale `--deep` — quindi gli altri temi non cambiano di un pixel — e nell'indaco vale
  `#4b4878`: più chiara, ancora abbastanza scura da tenere il testo leggibile. Anche le etichette dei
  gruppi hanno il loro colore per tema: quel verdino fisso, su un fondo schiarito, spariva.
  I **testi delle notifiche** usavano `.muted`, il grigio delle didascalie. Ma in una notifica la
  frase sotto il titolo **è** il contenuto: è la riga che si deve leggere, non un'etichetta accanto a
  un dato. Ora usano `.notif-testo` — colore pieno, appena attenuato per restare sotto il titolo in
  grassetto — nel campanello e nella pagina Notifiche del backoffice, e negli stessi due punti
  dell'app (cliente e staff).

- `[Sviluppo]` 📄 **Il selettore di pagina anche sopra le tabelle di Gestione dieta** — chiesto da
  Simone: con cento righe per pagina, cambiare pagina costava scorrere fino in fondo e poi risalire
  per rileggere le intestazioni. Due scorrimenti interi per ogni pagina, sulla schermata dove il
  nutrizionista passa le ore quando rivede un catalogo.
  Messo su tutt'e tre le tabelle di quella schermata — ricette, allergeni, gruppi di equivalenza —
  perché per chi ci lavora sono la stessa pagina con tre linguette, e sistemarne una sola avrebbe
  spostato il fastidio invece di toglierlo. È lo stesso `<Pager>` collegato allo stesso stato:
  restano d'accordo da soli e spariscono entrambi quando la pagina è una sola.
  Al componente è stata aggiunta una `sopra` che sposta il filo di separazione da sopra a sotto:
  senza, il bordo superiore si sovrapponeva a quello della card e il blocco sembrava staccato dalla
  tabella che comanda.

- `[Sviluppo]` ⚖️ **«Gioia ha ricevuto otto giorni di menu con una pesata sola»** — e non c'era nessun
  difetto: c'era una **regola sbagliata**, che è peggio, perché non lascia tracce.
  La ricostruzione, dall'audit delle erogazioni: puntuali ogni due giorni, sempre due giornate —
  il 7/8 (8-9), il 9/8 (10-11), l'11/8 alle 07:26 (12-13) — con l'ultima pesata del **7 agosto**. Il
  cancello della pesata del ciclo *è* stato interrogato ogni volta e ha lasciato passare, perché la
  prima riga di quella funzione era `if (in vacanza) return false`: la **modalità viaggio esentava
  dalle misure**. Regola «Vacanze in Serenità», scritta apposta. Il risultato è che le ultime quattro
  giornate erano tarate su un peso di quattro giorni prima — e il fabbisogno si calcola sul peso
  attuale, quindi erano tarate male.
  Prima di arrivarci ho fatto due ipotesi sbagliate — che i menu fossero stati erogati prima del gate
  del 10/8, e che `menu_days_delivered` valesse 4 — e le ha smentite entrambe un comando sui dati.
  Vale la pena scriverlo: su una cliente vera l'ipotesi plausibile non basta, e le due volte che ho
  detto «torna tutto» erano le due volte in cui non tornava niente.
  **La regola nuova, decisa da Simone: o ricevi menu e le misure valgono come per tutte, oppure sei
  in pausa — non ricevi menu ed entri nel protocollo di monitoraggio** (che esiste già: peso di
  riferimento, promemoria, avviso alla coach se risale). Niente terza strada in cui i menu arrivano e
  nessuno chiede il peso. Vale anche per la dieta «Vacanze in Serenità», che è una dieta come le
  altre. La modalità viaggio continua a fare l'altra cosa per cui serve — l'agente dieta sceglie
  piatti che al mare la cliente mangerà davvero — e quella col peso non c'entra.
  Tolta l'esenzione dai **due** punti in cui viveva (il popup e l'erogazione). Il blocco di test che
  verificava il comportamento vecchio è stato riscritto per pretendere quello nuovo: restava verde
  certificando la regola che stiamo togliendo.
  **E il `diag:cliente` ora stampa la modalità viaggio e il piano fermato.** È lo strumento che
  esiste per rispondere a «perché riceve/non riceve il menu», e su Gioia taceva proprio sullo stato
  che aveva disattivato la regola: ci abbiamo girato attorno un'ora. Una diagnostica che non nomina
  la causa manda a cercarla altrove, che è peggio del non averla.
  ⚠️ **Da guardare prima del deploy**: le clienti con la modalità viaggio accesa **adesso** si
  vedranno chiedere la pesata al prossimo ciclo. Non è un danno, ma è un cambio di comportamento che
  è meglio sapere in anticipo — il comando per contarle sta in `PUNTO_DELLA_SITUAZIONE` §11.

- `[Sviluppo]` 🎛️ **I due pulsanti della coda ora fanno qualcosa — Consegna B (§15.2 punti 2, 3, 4)** —
  la domanda di Nocanty era «cosa fanno questi due pulsanti?» e la risposta onesta era «niente»:
  scrivevano un esito che nessun altro pezzo di codice leggeva.
  **«Correggi» apre le azioni della causa**, non un modulo generico: calo rapido → autorizza a
  proseguire · scrivi in chat · apri la scheda · blocca il piano; energia bassa → senza
  l'autorizzazione (non c'è nessun punto di partenza da spostare: il segnale viene dai check-in);
  screening → solo i due rimandi. La tabella sta in `engine/causa-decisione.ts` ed è **la regola**,
  non un suggerimento per l'interfaccia: il backend rifiuta un'azione non prevista per quella causa,
  perché una regola che vive solo nei pulsanti si aggira con una POST. «Apri la scheda» e «Scrivi in
  chat» restano rimandi: i cambi dieta non si reimplementano lì, e una seconda strada con controlli
  diversi è il modo in cui nascono i buchi nei permessi.
  **«Autorizza a proseguire» azzera il punto di partenza del calcolo** (`rapidLossBaselineAt`): da
  quel momento l'allarme guarda **solo le pesate successive**, con il pavimento deciso — 4 giorni e
  3 pesate nuove — perché due pesate ravvicinate ricostruiscono una pendenza ripidissima e l'allarme
  risuonerebbe il giorno dopo l'ok. I due numeri sono **parametri** (`rapid_loss_resume_min_days`,
  `rapid_loss_resume_min_measures`, categoria sicurezza): sono clinici, li cambia Nocanty senza
  deploy. Si azzera l'allarme e **non i progressi**: grafico, chili persi, proiezione e tendenza
  continuano a leggere tutta la storia — c'è un test che lo pretende.
  ⚠️ **Il difetto che stavo per consegnare, e che la revisione ha fermato**: il modulo
  `signals/allarme-calo.ts` era scritto, testato con otto test verdi e **non chiamato da nessuno**.
  Il campo veniva scritto dal nutrizionista e mai usato: avrebbe premuto il pulsante e la stessa
  riga sarebbe tornata in coda la notte dopo. Ora è agganciato in **due** punti — `progress.service`
  (l'allarme che riempie la coda) e `signals.service.checkRapidLossGuardrail` (la segnalazione
  clinica, che nasce a ogni pesata salvata: senza, la segnalazione sarebbe ricomparsa lo stesso
  giorno dell'autorizzazione) — con quattro test che guardano **se l'allarme suona**, non se il
  campo viene scritto. Una suite verde certifica la regola, non che sia attaccata.
  **«Blocca il piano» esiste davvero** (`planHeldAt` / `planHeldReason` / `planHeldById`): ferma i
  giorni **nuovi**, e quelli già ricevuti — incluso oggi — restano alla cliente. È il controllo che
  al «piano bloccato» di prima mancava: `dietBlock` è letto da `getMenu` e `menuStatus`, cioè decide
  cosa la cliente *legge*, e non è mai stato letto dall'erogazione. In app c'è uno stato nuovo con
  parole oneste — «la nutrizionista ha messo in pausa i nuovi giorni e ti contatterà; i giorni che
  hai già ricevuto restano disponibili» — invece della frase sulle esclusioni alimentari, che
  davanti a un calo troppo rapido è falsa due volte.
  Lo **sblocco** è di chi l'ha messo, del capo o dell'admin (decisione di Simone). Il pulsante sta
  nella scheda cliente, accanto allo stato del piano: un blocco che si mette da una schermata e si
  toglie solo da un'API è un blocco che resta — anche questo trovato in revisione.
  Tre effetti collaterali chiusi mentre c'ero: la stessa decisione **non si può lavorare due volte**
  (il doppio clic spostava il baseline e cambiava il proprietario del blocco, cioè toglieva a chi
  l'aveva messo il diritto di riattivarlo); l'errore di chiusura della riga **non si ingoia più**;
  e «Rigenera menu» su un piano fermo non cancella più niente — cancellava i giorni futuri senza
  poterli rierogare, cioè toglieva alla cliente proprio quelli che il blocco le lascia.
  103 suite, 1567 test verdi; `tsc` invariato; backoffice e app compilano.

- `[Sviluppo]` 🩺 **«Cristina è onnivora, perché le diamo una dieta vegana a 3 pasti?»** — la scheda
  diceva il falso, e la cosa peggiore è che non rompeva niente. Il profilo di Cristina dice
  `Flessibile · flexible · **omnivore** · 5 pasti`, e di menu non ne ha ricevuto **nessuno**: zero
  giornate erogate, nessun abbonamento, nessuna data di inizio. Quella riga non descriveva niente
  che le stesse succedendo.
  La causa: la scheda cercava la dieta con `findFirst({ where: { name: dietFamily } })` — **per nome
  e basta**. Una famiglia ha fino a diciotto varianti che condividono il nome e si distinguono per
  regime, stile, obiettivo e pasti: quella query pescava la prima che capitava e ne mostrava regime
  e pasti come se fossero della cliente. È la trappola scritta in testa a `pick-diet.ts` — «la
  famiglia da sola potrebbe agganciare l'omonima di un altro stile» — evitata nel motore e mai
  portata qui. Nessun errore, nessun test rosso, una schermata che risponde: solo che dice il falso,
  e manda a cercare un errore di assegnazione che non esiste.
  Ora la riga cerca la variante **esatta** (nome + stile + regime + pasti) e, se non c'è, mostra la
  dieta che il motore **servirebbe davvero**, chiedendola alla stessa `pickDietFor` dell'erogazione.
  Sotto compare cosa manca a catalogo: «non c'è la variante … omnivore · 5 pasti: viene servita …
  Si chiude generando quella variante, **non cambiando il profilo della cliente**» — la chiusa è
  voluta, perché adattare il profilo a ciò che esiste fa sparire il sintomo e lascia il buco.
  Il **regime** ha un messaggio a parte, in rosso: `pickDietFor` non lo lascia mai cadere, quindi un
  regime diverso non è un ripiego ma un dato incoerente, ed è l'unico caso in cui una cliente
  potrebbe trovarsi nel piatto qualcosa che non mangia.
  La regola sta in `clients/scostamento-dieta.ts`, fuori dalla schermata, con sette test: dentro il
  componente sarebbe una riga in mezzo a una `<Row>`, cioè esattamente il posto in cui questo
  difetto è vissuto finora. 103 suite, 1552 test verdi; `tsc` invariato, backoffice compila.
  ⚠️ Resta aperto il **lavoro di catalogo**: se la variante `Flessibile · omnivore · 5 pasti` non
  esiste, il ripiego continua — ora però si vede. `npm run diag:dieta -- "Flessibile"` lo dice.

- `[Sviluppo]` ✅ **La 2.1.6 è sui telefoni — verificato sul manifest, non sul registro** —
  `/api/v1/app-updates/latest.json` risponde `{"version":"2.1.6", "url":".../metabole-2.1.6.zip"}`,
  letto dal browser. È l'unica prova che esista: lo stato dell'OTA vive in una variabile d'ambiente
  su Render, cioè fuori dal repo e fuori da ogni registro — il 6/8 un passaggio dato per fatto non era
  mai stato completato, e nessun documento poteva dirlo. Quindi il banner della pesata **è** sul
  telefono di Giusy, e da lì il suo menu riparte con una pesata.
  Allineati anche i documenti che invecchiano da soli: §1 diceva ancora «ultima OTA 2.1.4» e 1496
  test, la guida `COME_SI_FA_UNA_OTA.md` dichiarava «stato al 9 agosto: package.json 2.1.2, la
  prossima parte da 2.1.3». Quel paragrafo è il più pericoloso della guida — un numero vecchio lì fa
  **riusare una versione bruciata**, che è l'errore che non si può rimediare — quindi ora dice di
  aggiornarlo nello stesso commit del bundle e di fidarsi comunque del manifest. Aggiunto alla guida
  anche il **terzo controllo**: cercare nello zip una stringa della funzione, non solo il numero.

- `[Prodotto]` 🍽️ **Il catalogo delle 12 settimane passa al nutrizionista** — decisione di Simone:
  la generazione delle settimane non è più lavoro in coda allo sviluppo. Il nutrizionista le crea,
  comunica quando ha finito, e **noi verifichiamo** (Copertura catalogo col selettore della settimana:
  ogni pasto previsto verde con 7). Il protocollo di §6 resta scritto, ma cambia destinatario: da
  «cosa devo fare io» a «istruzioni per chi genera, e cosa guardare quando arriva il fatto».
  Cambia anche la domanda sulle ~270 varianti senza clienti: non è più «chi trova 13-14 ore» ma fino a
  dove vale la pena arrivare — e si decide quando sappiamo a che punto è arrivato lui.

- `[Sviluppo]` 🧹 **Quattro comandi lanciati in produzione, quattro volte «niente da fare»** — e la
  lista si accorcia di cinque voci. `fix:consenso-sanitario`: 35 questionari completati, **0** bloccate
  senza consenso (la riparazione dell'8/8 ha tenuto). `pulisci:spezie`: 47 profili esaminati, **nessuna
  spezia** fra i cibi esclusi. `fix:stato-questionario`: **0** schede da spostare, tutte e 35 sono già
  più avanti nella pipeline. `fix:segnalazioni`: **nessuna orfana**, tutte hanno un destinatario — il
  che chiude anche §3.4, le due segnalazioni di Giusy di luglio.
  Vale la pena dire cosa insegna un giro che non cambia niente. Tre di queste quattro voci erano in
  lista perché il lavoro era stato **fatto** l'8/8 e non **riguardato dopo**: una cosa fatta e non
  verificata resta in lista esattamente come una non fatta, e chi legge non ha modo di distinguerle.
  Il costo di guardare era di quattro comandi in dry-run; il costo di non guardare era portarsi dietro
  cinque voci che sembravano lavoro. Tutti e quattro gli script hanno lo stesso disegno — nudi non
  scrivono niente, servono `CONFERMA=1` — ed è questo che rende il controllo gratuito.
  Chiuse in §11 e §3.4 con il numero che hanno stampato, non con «fatto»: il numero è la prova, e fra
  un mese distingue «l'ho lanciato» da «l'ho lanciato e non c'era niente».

- `[Sviluppo]` 📱 **OTA 2.1.6 — il banner della pesata arriva sui telefoni** — quello che stamattina è
  entrato in produzione lato backend era invisibile alle clienti: il pezzo che parla è nell'app, e
  l'app si aggiorna solo con un bundle. Porta le due schermate del caso Giusy: il banner
  `awaiting_cycle_measure`, che dice cosa serve e **ha il pulsante** che apre il modulo della pesata
  (senza, alla cliente riaperta il popup non compare più e il banner sarebbe un rimprovero senza
  rimedio), e lo sblocco della coach che diventa promemoria invece di muro. Dentro c'è anche la
  rimozione di `Placeholder.tsx`.
  Verifiche sullo zip **prima** di committarlo: `index.html` alla radice, **due** occorrenze di
  `push-tokens` e il listener `registration` presenti — cioè le push non sono state spente dal build,
  che è l'incidente del 6/8 — e la versione `2.1.6` compilata dentro il JS.
  Un controllo nuovo rispetto alle volte scorse: **si cerca nel bundle una stringa della funzione che
  la OTA deve portare** (`awaiting_cycle_measure`). Fino alla 2.1.5 si verificava solo che il numero
  fosse quello giusto, il che dimostra che il bundle è nuovo ma non che **contenga la cosa per cui lo
  stai pubblicando**: un `dist/` vecchio ricostruito passerebbe tutti gli altri controlli.
  ⚠️ Al commit manca l'ultimo passo, che vive fuori dal repo: **`OTA_VERSION = 2.1.6` su Render**.
  Finché non è impostata, il bundle è servito ma nessun telefono sa di doverlo prendere — e l'unica
  prova che sia andata è leggere `/api/v1/app-updates/latest.json`, non questo registro.

- `[Sviluppo]` 💶 **Provvigioni e prezzi: due voci chiuse da Simone, e un residuo trovato mentre le
  chiudevo** — le **percentuali** sono verificate sulle vendite reali, i compensi che escono sono
  quelli giusti; i **prezzi** sono quelli del Negozio e da lì si aggiornano ovunque da soli.
  Verificato nel codice prima di chiudere la voce: il report legge sempre `plan.priceCents` dal
  database, con la promo gestita da `listPriceCents` + `promoEndsAt` — nessun prezzo scritto a mano
  sul percorso del report, quindi **si può mandare a una cliente vera**.
  Il residuo: il testo del task che arriva alla coach quando scade il codice personale ha i prezzi
  **dentro la frase** («1 mese €99 · 3 mesi €249», `coach-tasks.service.ts:206`). Quello non segue il
  Negozio: il giorno che il prezzo cambia, la coach legge il vecchio e lo ripete alla cliente. Aperto
  in §4.1, si chiude leggendo il piano come fa il report.
  Resta aperta solo la parte che **nessuna vendita può ancora aver verificato**: chi prende la
  provvigione **al rinnovo** se la coach nel frattempo è cambiata. Non si vede nei compensi già
  erogati perché il primo rinnovo automatico non è mai passato, e il codice paga «chi c'è adesso».

- `[Sviluppo]` 🗓️ **Le date di questo registro erano avanti di due giorni** — e non è una pignoleria:
  è la ragione per cui oggi ho aperto un allarme falso. Credendo che fosse il 13, ho letto la tabella
  delle decisioni del motore — l'ultima è dell'11 — come «il cron è fermo da due notti», e ci ho
  costruito sopra una diagnosi completa, con l'elenco di tutto ciò che sarebbe stato fermo con lui:
  notifiche quotidiane, task della coach, monitoraggio, report, scadenze delle prove. Il cron aveva
  girato quella notte. **Quell'11 non era un buco: era oggi.** Un dato giusto letto con una data
  sbagliata produce un allarme falso esattamente come un clone vecchio di quattro giorni — stessa
  famiglia delle sette voci false, stesso costo: dopo due o tre nessuno crede più alla lista.
  Da dove veniva lo scarto: il lavoro fatto la sera tardi veniva scritto sotto la data del giorno
  dopo, e la cosa si è accumulata. Riallineato su `git log`, l'unica fonte che non dipende da cosa
  credeva il calendario di chi scriveva: l'ex «13» è l'**11** (i commit di stamattina, dalle 06:28
  alle 07:51), l'ex «12» e l'ex «11» sono **entrambe il 10** (notte e pomeriggio), l'ex «10» è il
  **9**. Tre sezioni si sono fuse con quelle sotto. Dall'8/8 all'indietro le date risultano già
  corrette e non sono state toccate.
  Corretti anche i riferimenti dentro ai testi dove erano ancorabili a un commit; per quelli rimasti
  c'è la nota in testa a questo file e a `PUNTO_DELLA_SITUAZIONE.md`, così la prossima sessione non
  ci ricasca. La migrazione consegnata oggi è stata rinominata alla data vera
  (`20260811070000_causa_decisione_motore`), con la cartella vecchia spostata in `_to_delete/`.
  ⚠️ Il nome finisce **prima** di tre migrazioni già applicate, che portano anch'esse date avanti:
  `prisma migrate deploy` la applica lo stesso — guarda quali mancano, non l'ordine — ma un
  `migrate dev` in locale può segnalare l'ordine incoerente.

- `[Sviluppo]` 🗂️ **La coda del nutrizionista: una riga per causa, e solo per chi ha un piano** —
  i punti 5 e 6 delle sei decisioni di `PUNTO_DELLA_SITUAZIONE` §15.2. Non toccano ancora cosa
  fanno «Conferma» e «Correggi»: rendono la coda una lista di cui ci si può fidare, che è la
  condizione perché quei due pulsanti valga la pena costruirli.
  **La causa diventa una colonna** (`EngineDecision.reasonKey`): prima viveva solo dentro il testo
  della segnalazione — `[calo_rapido_energia] frase` — e si interrogava con un `contains`, cioè un
  confronto che si rompe riscrivendo la frase. Serviva per poter chiedere al database «di questa
  cliente, per QUESTA causa, esiste già una riga che nessuno ha guardato?».
  La riga del giorno **si scrive comunque**: serve al messaggio quotidiano, che legge la decisione
  di oggi per darle il tono attenuato, e serve allo storico — sapere che una causa è durata undici
  giorni è un dato clinico, non rumore. Quello che non si ripete è la **chiamata a guardarla**:
  finché la riga aperta non è stata revisionata, le successive nascono senza il flag. Appena il
  nutrizionista la guarda, la notte dopo ricompare — il «il controllo resta armato» di Nocanty.
  La parte che non si vede, ed era il rischio vero: quelle righe non flaggate sarebbero diventate,
  per `menu.service`, **decisioni ordinarie da applicare** — cioè un guardrail che dice «fermati,
  deve guardarci una persona» avrebbe finito per cambiare il piano da solo. Il menu ora legge con
  `flaggedForReview: false` **e** `reasonKey: null`.
  La migrazione fa il **backfill delle sole righe ancora aperte** (otto all'11/8, una per cliente,
  contate su Render). Senza, la funzione nuova nascerebbe rotta il giorno del deploy: quelle righe
  hanno la causa a NULL, il controllo non le troverebbe, e la prima notte nascerebbe un doppione
  permanente per ognuna — esattamente il rumore che la modifica toglie. Sullo storico già
  revisionato non si tocca niente: una causa indovinata su dati vecchi sarebbe un dato inventato
  dentro una cartella clinica.
  **Il motore gira solo su chi ha un piano alimentare attivo.** `runBatch` prendeva tutte le
  clienti col questionario completato senza guardare l'abbonamento: nello screenshot della coda
  c'era Rosaria, piano concluso il 22/07. Filtrare il batch non basta — le righe già scritte
  restano a database — quindi il filtro è anche sulla coda e sul contatore, e **non si cancella
  niente**: quelle righe sono lo storico della cliente, e se torna tornano ad avere senso. Il
  filtro sta in `common/piano-attivo.ts` accanto alla funzione che risponde alla stessa domanda per
  le diagnostiche, ma è un **filtro da innestare nella query** e non una risposta da leggere: con
  la seconda strada i `count()` resterebbero sbagliati, cioè il numero fra parentesi direbbe una
  cosa e l'elenco un'altra.
  Il **monitoraggio è escluso** (abbonamento attivo, ma non è un piano alimentare: chi lo ha non
  riceve menu), e nel codice sta scritto anche **cosa questo spegne**: il guardrail «energia bassa
  cronica» esiste solo dentro il motore, quindi per chi è in monitoraggio o fra due piani non nasce
  più — il calo rapido invece resta coperto da `signals.service`, che non passa di qui. Se si
  decide che va visto comunque, il posto dove metterlo è lì, non riaprendo questo filtro.
  Due cose che combaciavano male da prima: il numero **«Da validare» sul telefono** contava anche
  le decisioni già revisionate (diceva 9, la coda che apriva ne aveva 2), e la coda era ordinata
  **dalla più recente** — che ora vorrebbe dire che più a lungo un problema resta aperto più
  affonda, fino a uscire dalle prime cento. Ora dalla più vecchia.
  101 suite, 1537 test verdi; `tsc` invariato sul baseline del sandbox. Resta aperto, e scritto nel
  codice: per il capo/admin il badge conta i suoi pazienti mentre la coda è globale.

- `[Sviluppo]` ⚖️ **«L'hai sbloccata ieri e non ha generato il menù»** — il caso Giusy, ed erano **tre
  difetti che presi uno per uno si giustificavano, e insieme lasciavano una cliente senza menu, senza
  istruzioni e con una frase che le diceva di aspettare**.
  Sulle misure ci sono due controlli, e non si parlavano. `cycleNeedsMeasure` decide l'**erogazione**:
  senza una pesata dentro il ciclo corrente i giorni nuovi non partono, ed è giusto — è la regola
  del 10/8, «ci serve sempre una misura per erogare il menu». `measurementGate` decide il **popup** che
  glielo chiede. Lo sblocco della coach scrive `measuresUnlockedUntil`, e quel campo era letto **solo dal
  secondo**: sbloccare toglieva la richiesta e lasciava il blocco. Cioè si aiutava la cliente spegnendole
  l'unica istruzione che aveva.
  Terzo pezzo: `menuStatus` non aveva uno stato per quel cancello — controllava solo la misura **di
  partenza** — quindi cadeva su «Menu in preparazione, arriverà a breve». Falso: non arriva niente finché
  non si pesa. Ora c'è `awaiting_cycle_measure`, che dice cosa serve e **ha un pulsante** che apre il
  modulo della pesata da lì; senza quel pulsante il banner sarebbe un rimprovero senza rimedio, perché
  alla cliente riaperta il popup non compare più.
  Lo sblocco resta com'era nella sostanza — la pesata serve comunque — ma ora lo dice: `required: true`,
  `blocking: false`, livello `promemoria`. Cade il muro, resta la domanda. E nel backoffice il pulsante si
  chiama **«Riapri l'app»**, non più «Sblocca app», con scritto che non fa arrivare il menu: il nome
  vecchio prometteva l'altra cosa, ed è il motivo per cui è stato usato aspettandosi un menu.
  Lo stesso buco c'era in `diag:cliente`, cioè nello strumento che serve esattamente a rispondere alla
  domanda «perché non riceve il menu?»: su Giusy avrebbe stampato «idonea, ma le giornate non sono ancora
  state erogate» — vero e inutile. Ora stampa il ciclo corrente, l'ultima pesata, se manca, e se c'è uno
  sblocco attivo con accanto che non eroga.

- `[Sviluppo]` 💚 **Gaia parla di sé al femminile** — segnalato da Simone su un messaggio dell'8/8: «sono
  felicissimo di festeggiare i tuoi progressi», firmato Gaia. Il prompt diceva «Sei l'assistente di
  Metabole»: **senza nome e senza genere**, quindi il modello ripiegava sul maschile. Non è una sfumatura
  di stile — le clienti la chiamano per nome e vedono la sua faccia: una che parla di sé al maschile
  smette di essere una persona e diventa un programma. Ora il prompt dice chi è, e il modello concorda da
  sé per tutta la conversazione, senza bisogno di un controllo sull'uscita. Verificato che nel backend non
  esistano altre frasi fisse al maschile pronunciate da lei.

- `[Sviluppo]` 🧽 **Le piccole cose che mentivano** — cinque voci in una passata, tutte dello stesso
  genere: codice o interfacce che raccontavano una cosa diversa da quella che fanno. Nessuna rompeva
  niente, tutte facevano perdere tempo o prendere decisioni sbagliate.
  **Due chiavi dei permessi che non controllavano niente** — `engine_reviews` e `assignments`: dichiarate,
  con i loro valori di default e la loro etichetta, e **senza nessuna guardia** che le leggesse. La
  seconda era la più insidiosa: l'assegnazione di una cliente passa da `POST /admin/assignments`, che è
  `@Roles('admin')` e ignora la matrice — concedere «assignments» a una coordinatrice non le dava niente,
  e nessun errore lo diceva. Una chiave nella matrice è una **promessa**, e chi la accende crede di aver
  abilitato qualcosa: togliere è più onesto che lasciare un interruttore finto. Se un domani si vuole che
  siano le coordinatrici ad assegnare, la chiave si riaggiunge **e** si aggancia a quell'endpoint — è una
  decisione di prodotto, e sta scritta in testa al file.
  **`monitoring_offer_days`**: letto a ogni giro del cron e usato da nessuno. Serviva ai menu di rientro a
  pagamento e al congelamento di chi non comprava, entrambi rimossi il 7/8. Ora la lettura è via e la
  descrizione nei Parametri dice «NON PIÙ IN USO»: la riga resta a catalogo perché cancellarla dal seed
  non toglie quella già scritta in produzione, e una chiave che sparisce dal codice ma resta a database è
  più difficile da capire di una dichiarata inerte.
  **Tre commenti superati**: `rules-evaluator.ts` diceva che eventi e pause «arriveranno col calendario,
  per ora sempre neutro» — li calcola `signals-collector` da mesi; `agents.service.ts` diceva che il
  runtime degli agenti «arriverà in una fase successiva» — sta nella cartella accanto
  (`agent-orchestrator`, `agent-runner`); `chat/ai-filter.ts` diceva che l'AI generativa «arriverà in
  M10», e leggendolo si concludeva che in chat non ci fosse un modello — c'è, con la banca dati
  nutrizionale a fare da ancora e la guardia sull'uscita.

- `[Sviluppo]` 🏖️ **La scadenza della vacanza è un numero solo** — `statoViaggioAttivo` accetta un tetto
  di giorni per un «in vacanza» senza data di fine, e il gate misure lo chiamava **senza passarlo**:
  valeva il default del helper (30) mentre `DietAgentService` leggeva `travel_max_days` dai Parametri.
  Due numeri per la stessa scadenza. Il giorno in cui qualcuno lo porta a 60 dai Parametri, il gate e
  l'agente non sono più d'accordo su chi è in vacanza — il primo torna a chiedere le misure, il secondo
  la considera ancora via — e non lo dice nessun errore. Ora il parametro si passa in entrambi i punti,
  con un test che lo dimostra: la stessa cliente, in vacanza da 40 giorni senza data di fine, blocca col
  tetto a 30 e non blocca col tetto a 60. Senza il passaggio del parametro quel test resterebbe rosso.

- `[Sviluppo]` 🧹 **Via `Placeholder.tsx` dall'app** — schermata «Questa sezione è in costruzione. Torna
  presto!» che nessuna rotta importava. Un file così non fa danni finché nessuno lo aggancia: il rischio
  è che qualcuno lo trovi e lo usi «per intanto», e una cliente che paga si trovi davanti un cartello di
  lavori in corso. Verificato che nessun file lo nomini, app ricostruita e 27 test verdi. Spostato in
  `_to_delete/` sul Mac: il ponte non può cancellare, quindi la cartella la elimini tu.

- `[Sviluppo]` 🇮🇹 **I messaggi di validazione arrivano in italiano anche quando nessuno li ha scritti** —
  `class-validator` genera i suoi in inglese, quindi un DTO nuovo nasceva sbagliato senza che nessuno
  facesse niente di male: il 7/8 una cliente si è vista rispondere «hipsCm must not be less than 40»
  sotto un pulsante che sembrava rotto — non nella sua lingua, senza dirle cosa fare, col nome di una
  colonna del database dentro. La difesa esistente (un `message` scritto a mano su ogni decoratore, con
  un test che lo pretende) copriva solo i DTO in una lista che si allunga a mano: chat, documenti, buoni
  sconto ed eventi erano scoperti, e il commento di quel test lo diceva già.
  Ora c'è la rete a valle: `exceptionFactory` sulla `ValidationPipe` (`common/messaggi-validazione.ts`).
  Traduce **solo** gli schemi di class-validator — «should not be empty», «must not be less than 40»,
  «must be shorter than or equal to 600 characters», la whitelist, gli array — e **lascia intatto**
  qualunque messaggio scritto da noi: nel dubbio non traduce, perché riscrivere una frase pensata da una
  persona è un danno nuovo, non una correzione. C'è un test dedicato a questo.
  Due scelte che vale la pena ricordare. Il **nome del campo** resta il suo per tutto ciò che non è in un
  dizionario corto dei campi che una persona compila davvero: tradurre tutto il modello dati richiederebbe
  un dizionario che nessuno terrebbe aggiornato, quindi il caso peggiore diventa «italiano un po' tecnico»
  invece di «inglese incomprensibile» — e per questo la regola del `message` scritto a mano **non**
  decade. E la **forma della risposta** resta quella di Nest (`message` come elenco di stringhe), perché
  l'app e il backoffice la leggono così: cambiarla avrebbe rotto ogni schermata che mostra un errore di
  validazione. Gli errori annidati vengono percorsi, altrimenti un oggetto sbagliato dentro il corpo
  produceva un 400 con l'elenco vuoto — un rifiuto che non dice niente.
  100 suite, 1519 test verdi. Aggiornato anche il commento di `messaggi-clienti.spec.ts`, che dichiarava
  l'assenza di questa rete.

- `[Sviluppo]` 🔒 **Il Monitoraggio si vede solo a mantenimento SCADUTO e non rinnovato** — la decisione
  di ieri, ora nel codice. Prima la condizione era «ha già fatto (o sta facendo) il mantenimento»:
  bastava un abbonamento `active`, quindi il monitoraggio compariva dal **primo giorno** e a una cliente
  che aveva appena pagato €49 offrivamo l'opzione da €19 **dentro il mese che aveva appena comprato**.
  Ci vendevamo contro noi stessi.
  `statoMonitoraggio` fa due domande e le mette insieme: esiste un mantenimento con la **fine già
  passata**, e **non** ce n'è uno ancora in corso. Il confronto è per **giorno** — un mantenimento che
  finisce oggi resta in corso fino a domani, altrimenti il monitoraggio comparirebbe a mezzanotte e un
  minuto dell'ultimo giorno pagato. La condizione è la stessa nella vetrina **e** all'acquisto: il
  difetto storico di quest'area è stato proteggere solo la vetrina, e un `planId` in mano basta a saltarla.
  I tre casi al bordo, ognuno con un test: **disdetto con la fine nel futuro** → non si mostra, il mese
  pagato è suo (per questo «in corso» accetta anche `cancelled`, non solo `active`); **rinnovato** → non
  si mostra, il rinnovo sposta la fine in avanti sulla stessa riga; **più mantenimenti** → basta che uno
  sia concluso e nessuno in corso. E due messaggi invece di uno: «finché è in corso continui con quello,
  senza pagare due volte» per chi lo sta usando, «viene dopo il Mantenimento» per chi non l'ha mai fatto —
  dirle la frase sbagliata la manda a chiedere alla coach una cosa che non serve.
  Il finto Prisma dei test è stato riscritto per distinguere le **tre** domande diverse che
  `subscription.findFirst` riceve: con un mock che diceva sì a tutte, la regola sarebbe sembrata
  funzionare qualunque cosa facesse il codice. 1504 test verdi.
  Nota lasciata in `monitoring.service.myStatus`: la stessa domanda vive anche lì e il risultato è già
  corretto, ma per un'altra strada (un mantenimento in corso è un abbonamento attivo, e quel controllo
  c'era). Non sono lo stesso codice perché `CommerceService` dipende già da `MonitoringService`: vanno
  tenute d'accordo a mano, ed è scritto in entrambi i file.

## 2026-08-10

- `[Sviluppo]` 📱 **OTA 2.1.5 pubblicata** — il manifest risponde `2.1.5` col bundle giusto, verificato
  dall'esterno. Porta alle clienti tre cose che erano in produzione e invisibili: **data e ora nei
  messaggi in chat** (separatore del giorno «Oggi»/«Ieri» e ora su ogni bolla), il pulsante **«Sposta la
  data di inizio»** nel profilo, e la **scelta abbonamento / mese singolo nel primo acquisto** — quel
  pulsante al Checkout esisteva già nella 2.1.4, mancava il dato che lo fa comparire.
  Verifiche sullo zip prima di pubblicare: `index.html` alla radice, le tre cose nuove presenti, **una
  sola** stringa di versione, e soprattutto le push intatte (`/me/push-tokens` e listener `registration`
  presenti, **assente** il ramo del build senza `google-services.json`, che avrebbe spento le notifiche a
  chiunque avesse ricevuto l'aggiornamento, in silenzio).

- `[Prodotto]` 🔒 **Il Monitoraggio si mostra solo a mantenimento scaduto e non rinnovato** — decisione di
  Simone, presa dopo che la verifica della sequenza dei piani ha fatto emergere lo scostamento: il codice
  chiede di *aver avuto* il mantenimento contando anche gli abbonamenti attivi, quindi il Monitoraggio
  compariva dal **primo giorno** di mantenimento e una cliente che pagava €49 vedeva già l'opzione da €19.
  La regola nuova: si mostra **dal giorno dopo** che il mantenimento è scaduto e non è stato rinnovato.
  Così il Monitoraggio resta una **scelta di rientro** e non un'alternativa più economica offerta mentre
  sta pagando. Specifica e casi al bordo (disdetta con fine nel futuro, rinnovo, più mantenimenti nella
  storia) scritti in `PUNTO_DELLA_SITUAZIONE.md` §2; **codice da scrivere**, ed è la prima cosa in coda.

- `[Sviluppo]` 🧭 **Un solo documento dice come siamo: `progetto/PUNTO_DELLA_SITUAZIONE.md`** — c'erano
  sei liste di cose aperte (`DA_FARE.md`, tre `DA_RIPRENDERE_*`, `STATO.md`, `STATO_LANCIO.md`) e si
  contraddicevano: `DA_RIPRENDERE_20260809` dice che una cliente sta ricevendo una dieta senza pranzi né
  cene, e quel piano è concluso dal 22 luglio — è la fonte da cui l'allarme falso è arrivato fino alla
  lista del 10/8. Sei liste sono zero liste: nessuno sa quale sia quella vera.
  Il nuovo documento tiene lo stato, gli aperti, chi si aspetta cosa, e — parte che sarebbe morta con
  `STATO.md` — **le regole che non si scoprono leggendo il codice**: l'isolamento dei menu per prodotto,
  la sequenza dei piani, il webhook Stripe fissato a un'API, il thread di Gaia che lo staff legge e non
  scrive, e i controlli già fatti da non rifare.
  **La sequenza dei piani** che Simone ha ridetto oggi (Apprendimento 8 giorni → Dimagrimento → a
  obiettivo raggiunto Mantenimento → dopo un mese Mantenimento o Monitoraggio) è ora scritta come
  invariante da verificare a ogni modifica del Negozio. Verificata nel codice: protetta in **due** punti
  — `listPlansForClient` nasconde, `assertPlanPurchasable` **rifiuta l'acquisto**, ed è chiamata da
  entrambe le strade d'acquisto (nascondere una voce non è una regola, l'acquisto è una POST con un
  `planId` dentro). Emerso uno scostamento da decidere: il Monitoraggio compare dal **primo giorno** di
  mantenimento e non alla sua fine, perché il codice chiede di *aver avuto* il mantenimento.
  Ogni voce controllabile è stata **riletta dal ramo pubblicato** (`origin/main`, `f905a61`) e non da una
  copia locale, con l'elenco di cosa è stato verificato e come in appendice: tredici voci risultano
  davvero aperte. I sei documenti vecchi restano come fotografie, con in testa un rimando qui, e
  `ISTRUZIONI_PER_AI.md` punta al nuovo come prima lettura di ogni sessione.

- `[Sviluppo]` 🛒 **Nel primo acquisto ricompare la scelta abbonamento / pagamento unico** —
  `PlanFlow`, la coda dell'onboarding, è **la strada da cui passa ogni nuova cliente**, e dichiarava il
  piano senza il campo `billing`: quindi non lo passava al carrello, e al Checkout la scelta fra
  abbonamento e mese singolo non compariva **mai**. Per il carrello quel piano era `one_time` qualunque
  cosa dicesse il Negozio. Le altre due strade — il Negozio e il pulsante del report di fine percorso —
  lo passavano da tempo: restava fuori la principale.
  La regola sta ora in `lib/pianoCarrello.ts`, fuori dal componente, e la parte delicata è il valore di
  partenza: su un piano `both` si parte da **un mese solo**. In quella schermata non esiste nessun posto
  in cui la cliente abbia scelto fra le due forme — quello è il Negozio — e mettere in carrello un
  addebito ricorrente per un'opzione che nessuno le ha mostrato è il modo più rapido di trovarsi una
  richiesta di rimborso e di meritarsela. Su `recurring` invece `abbonamento` è vero perché non c'è
  niente da scegliere, e un `billing` assente o sconosciuto vale `one_time`: davanti a un dato che non
  capiamo si sceglie la forma che non le addebita niente a sua insaputa.
  Fuori dal componente per una ragione sola: così si verifica. Dentro `goCheckout` era una riga in mezzo
  a una navigazione, cioè esattamente il tipo di riga in cui questo difetto è vissuto per mesi.
  **Serve un'OTA** perché arrivi alle clienti.
  Nota: l'app **ha** vitest (ora 27 test, 4 file) — un'altra cosa che avevo scritto sbagliata in
  `DA_FARE.md`. Il problema non è il runner: è che la logica sta dentro i componenti.

- `[Sviluppo]` 📈 **Il funnel adesso vede i rinnovi automatici** — `plan_renewed` esisteva solo sul
  percorso manuale/bonifico, dove per capire se un pagamento è un rinnovo bisogna andare a cercare se
  prima c'era un abbonamento pagato. Dentro `invoice.paid` quella domanda non si pone: con
  `billing_reason` diverso da `subscription_create` quel pagamento **è** un rinnovo per definizione — e
  non emettendolo, sui piani ricorrenti (cioè la strategia) la dashboard marketing mostrava **zero
  rinnovi**: un prodotto in cui nessuno rinnova mai.
  L'evento si scrive **dopo** la creazione del pagamento, così è protetto dalla stessa idempotenza e due
  webhook della stessa fattura non producono due rinnovi nei grafici. L'importo sta nel payload e non
  nella condizione: un rinnovo scontato a zero resta un rinnovo del rapporto, e chi legge i numeri lo
  filtra sapendo che c'è. Se il tracciamento fallisce l'incasso prosegue — i soldi valgono più del
  grafico, ed è coperto da un test.

- `[Sviluppo]` 💳 **Un pagamento per fattura di rinnovo, garantito dal database** — l'idempotenza era
  `findFirst` sul `pspRef` e poi `create`. Fra le due righe non c'è niente che tenga: Stripe ritenta i
  webhook e non li manda in fila indiana, quindi due copie della stessa fattura passavano **entrambe**
  il controllo e scrivevano due pagamenti — e con due pagamenti nascono **due provvigioni**, che si
  scoprono solo quando qualcuno confronta i compensi con gli incassi. Nessun vincolo lo impediva:
  `stripe_subscription_id` è unico, `psp_ref` no.
  Ora la garanzia è dove può stare — nel database: indice unico `payment_psp_ref_renewal_key`. È
  **parziale** (`WHERE billing_reason = 'renewal'`) e non su tutta la colonna, perché in `psp_ref`
  finiscono anche l'id della sessione di checkout e il `payment_intent`: riferimenti di natura diversa,
  scritti in momenti diversi, e un vincolo su tutto avrebbe messo una regola che non appartiene a quei
  casi — col primo effetto di rompere il checkout per proteggere i rinnovi. L'invariante vera è
  ristretta: una fattura di rinnovo = un pagamento.
  Il codice si appoggia al **rifiuto** del vincolo: chi arriva secondo si prende `P2002` e quel rifiuto
  *è* la risposta «c'era già», non un errore. Il `findFirst` resta come strada veloce per il caso
  normale (webhook ripetuto) e non come garanzia. Un errore diverso risale invece di essere scambiato
  per un duplicato — inghiottirlo lascerebbe un rinnovo pagato senza pagamento e senza traccia.
  Migrazione riprovata su PostgreSQL 16 con la prova dell'invariante: la seconda fattura identica viene
  rifiutata, due riferimenti di checkout uguali passano.

- `[Sviluppo]` ✅ **Correzione a una mia diagnosi del 10/8: le provvigioni di rinnovo ERANO nel
  codice** — avevo scritto in `DA_FARE.md` che la decisione del 6/8 non era implementata perché
  `billingReason` è selezionato e mai usato. Falso, e l'ho scoperto andando a scriverla:
  `generateCommissions` calcola sempre la catena su `profile.assignedCoachId`, cioè sulla coach
  **attuale**, quindi «al rinnovo paga chi segue la cliente adesso» è vero per costruzione e nessuna
  condizione in più serviva. Resta un'ambiguità vera, ed è di prodotto: lo schema dice «solo se la coach
  è ancora quella assegnata» (che suona come «altrimenti non paga nessuno») e il servizio dice «paga chi
  c'è adesso». Il codice fa la seconda. La domanda è in `DA_FARE.md` §2.2, perché riguarda i soldi e la
  decide Simone.

- `[Sviluppo]` 🔌 **Il credito AI esaurito ora si capisce, e non fa sparare 270 chiamate a vuoto** —
  «ho cliccato ma non ha generato nulla», sulla settimana 10 della senza glutine. Il messaggio c'era,
  ma in cima alla pagina: era il credito Anthropic finito a metà generazione (per questo si era fermata
  alla 9, e non per il numero a due cifre come sembrava ieri). Tre difetti separati, uno dentro l'altro.
  **Cosa leggeva chi ha premuto:** `l'AI ha risposto 400 — {"type":"error","error":{"type":
  "invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please
  go to Plans & Billing to u` — JSON, in inglese, troncato a metà parola. Chi lo legge non ha modo di
  capire che deve ricaricare un credito: quel testo non è scritto per lui. Ora `ai/errori-ai.ts`
  risponde a due domande separate — **cosa dire** in italiano con la strada per uscirne, e **se ha senso
  riprovare** — e il caso vero è congelato nei test. Il credito si riconosce dal **corpo** e non dallo
  stato, perché Anthropic risponde 400 e non 402.
  **Le chiamate a vuoto:** la funzione che genera un pasto riprova tre volte, il giro passa cinque
  pasti, il backoffice passa diciotto varianti — col credito finito sono 270 chiamate destinate tutte
  allo stesso rifiuto, e una barra che avanza per minuti facendo credere che stia succedendo qualcosa.
  Ora sugli errori definitivi (credito, chiave, modello) il ciclo si interrompe, il servizio risponde
  **503** invece di 400, e il backoffice si ferma alla prima variante dicendo che le altre non le ha
  provate.
  **E l'esito si vede dove si è premuto:** i riquadri di `notice`/`error` stanno a inizio pagina, il
  pulsante Genera trecento righe più sotto. Ora l'esito compare anche **sotto il pulsante** — e quando
  niente è stato toccato lo dice in chiaro («nessuna variante è stata toccata: la settimana c'era già su
  tutte e diciotto»), perché «fatta su 0 variante/i» si legge come un successo e non lo è.


- `[Sviluppo]` 📏 **Senza una misura DI QUESTO PIANO il menu non parte — e adesso la chiediamo** — una
  cliente: «non mi sono state richieste le misure, ma i menu li ho ricevuti». Aveva ragione su tutt'e
  due i pezzi, ed erano due difetti diversi.
  Il gate contava `measurement.count({ clientId })`: **nessun filtro sulla data e nessun legame col
  piano**. Lei aveva pesate dal 20 luglio e il piano è partito il 6 agosto, quindi alla partenza il
  controllo risultava già soddisfatto da misure di un'altra stagione della sua storia — niente popup,
  niente blocco, menu dal primo giorno. La regola ora è quella data da Simone: «ci serve **sempre** una
  misura per erogare il menu, anche a costo di registrare due misure consecutive». La finestra entro cui
  una pesata vale non è un parametro nuovo da indovinare: è `menu_visible_days_before_start`, cioè da
  quando il piano comincia a esistere per la cliente. Verso il futuro non c'è limite — chi si pesa al
  terzo giorno ha comunque una partenza.
  Secondo difetto, il più antipatico: **nessuno chiedeva niente**. Il gate sapeva solo bloccare, il
  popup lo vede chi apre l'app, e l'unica notifica che diceva «inserisci le misure» viveva dentro
  `unlockMeasures` — partiva **soltanto dopo** che una coach aveva sbloccato una cliente già murata
  fuori. La richiesta esisteva come punizione, non come richiesta. Ora, finché il menu è trattenuto,
  parte notifica in app **e** push (`measures_required`), ripetuta a distanza di
  `measures_ask_repeat_days` (2 giorni) perché una push sola si perde e una al giorno diventa rumore. Si
  spegne da sé: appena la misura arriva non c'è più niente da chiedere.

- `[Sviluppo]` 🔢 **Generatore: la settimana 10 si bloccava perché il conto lo fa la famiglia e il
  controllo la variante** — «ha generato Mediterranea senza glutine fino alla 9, la 10 no». Non era il
  numero a due cifre: la striscia delle settimane, con la spunta «genera tutte le varianti», conta le
  settimane della **famiglia** (il giorno più alto fra tutte le varianti), mentre il servizio le contava
  sulla **singola variante**. Le due cose divergono appena una variante resta indietro — una settimana
  fallita, o un giro interrotto a metà famiglia — e da quel momento la famiglia dice «la prossima è la
  10» e quella variante dice «la mia è la 9». Il servizio rispondeva con un'eccezione e, non avendo il
  giro un `try` per variante, **quell'eccezione fermava anche tutte le varianti dopo**: diciassette sane
  bloccate da una, senza che dal messaggio si capisse quale.
  Due correzioni. Il servizio, invece di rifiutare, genera `settimaneFatte + 1`: **non crea nessun buco**
  — è esattamente l'invariante che il controllo difendeva — e fa quello che uno intende chiedendo
  «portale alla 10». La risposta porta sia `week` (fatta) sia `settimanaChiesta`, quindi il backoffice
  lo dice: «erano rimaste indietro e hanno recuperato un passo, ripremi Genera». E ogni variante ora
  risponde per sé: quelle che falliscono si annotano («❌ Non riuscite: …»), le altre si generano.

- `[Sviluppo]` 💶 **Il prezzo si legge dal Negozio, non si scrive nel codice** — «dobbiamo prendere il
  prezzo da quello impostato nel negozio, che se lo cambiamo non impazziamo». La notifica di fine
  monitoraggio diceva «mantenimento a **€29/mese**»: il Mantenimento costa **€49**, e il numero era
  scritto a mano da quando il piano costava 29. Un prezzo sbagliato mandato da noi a una cliente vera, e
  l'unico modo di accorgersene era leggere quella riga di codice per caso.
  Ora `commerce/prezzo-piano.ts` legge la riga `Plan` attiva — la stessa che la cliente vede nel Negozio
  e su cui pagherà. Se il piano non si trova torna **`null` e la frase esce senza cifra** («tenere il
  peso col mantenimento»): un valore di riserva nel codice sarebbe lo stesso difetto con un'aria più
  rispettabile, e meglio una parola in meno che una promessa da spiegare. Ripuliti anche i commenti che
  ripetevano «€29» in `plan-report.service.ts` e in `app/pages/Report.tsx` — l'app il prezzo lo prendeva
  già dal piano.

- `[Sviluppo]` 🚨 **Le diagnostiche dicono se il piano è ANCORA attivo** — due falsi allarmi in fila,
  entrambi miei. `diag:menu-incompleti` ha stampato «Rosaria Gruppuso resta senza pranzo e cena» e l'ho
  messa in cima alle urgenze: il suo piano era **scaduto il 22/07**, nessun menu in arrivo, nessun
  danno. Lo script guardava l'ultimo menu *erogato*, che di per sé non dice niente sul presente. Subito
  dopo Simone: «non è che anche questi hanno il piano concluso?» — domanda giusta, e la risposta non
  stava in nessuno script.
  Il difetto è di categoria: **una diagnostica che nomina una cliente senza dire se il suo piano è
  attivo produce allarmi che sembrano urgenti e non lo sono**, e il costo non è il tempo perso ma che
  dopo due o tre non si crede più alla lista. `common/piano-attivo.ts` risponde per un gruppo di clienti
  in una query sola, con quattro stati (attivo · scaduto ma ancora «active», da chiudere · concluso il
  gg/mm · mai avuto un piano). `diag:menu-incompleti` ha una colonna **«di cui attive»**, mette il
  campanello ⚠️ solo se qualcuno la sta ricevendo davvero, e per le altre scrive «nessuna cliente
  attiva: non sta danneggiando nessuno adesso — da sistemare prima che qualcuno la scelga».

- `[Sviluppo]` 🔎 **Copertura catalogo: si guarda DENTRO una settimana, non «quante ne ho»** — «non
  voglio vedere quante settimane ho, voglio filtrare la settimana 1 poi la 2 ecc.». Il filtro messo
  poco prima rispondeva a un'altra domanda: diceva quali varianti hanno 2 settimane, cioè chi è
  rimasto indietro, e non com'è fatta la settimana 3. Sono due domande diverse e serviva la seconda,
  perché il sospetto da verificare è che il generatore ammucchi i piatti nella prima settimana invece
  di distribuirli.
  Ora in cima alla pagina c'è un selettore «Guarda dentro una settimana»: scegliendo la 3, i conteggi
  li rifà il database sulle **sole giornate 15-21** (`day_index BETWEEN`, sia sul conteggio delle
  giornate sia su quello dei pasti — filtrarne uno solo darebbe una riga che parla di due finestre
  diverse). Cambia anche il metro: l'atteso per pasto non è più 7 × le settimane presenti ma **7**,
  altrimenti una variante da 12 settimane mostrerebbe `7/84` su ogni pasto e si leggerebbe «tutto
  magro» dove invece è tutto giusto. «Vuota» dentro il filtro vuol dire «quella settimana non esiste»,
  e lo dice fin dove arriva la variante («arriva alla 4»): è l'informazione che serve per capire se il
  buco è un buco o è la fine del catalogo. Dove le giornate di quella settimana sono meno di sette, la
  colonna lo scrive («4/7 gg»).
  Il selettore sta **sopra** la tabella e non nella riga dei filtri, con un avviso quando è attivo:
  gli altri filtri scelgono quali righe vedere, questo cambia il significato di ogni numero, e un
  numero che vuol dire una cosa diversa senza dirlo è il difetto peggiore di una tabella diagnostica.
  La colonna «Settimane» resta e continua a mostrare il totale della variante.

- `[Sviluppo]` 0️⃣ **Acquisti: gli importi a 0 € nascosti di default, con un flag per riaccenderli** —
  gli acquisti a zero sono le **attivazioni**: prova gratuita e piani messi a mano dalla scheda
  cliente, che per decisione di Simone entrano in Acquisti ma non in contabilità. Sono righe vere e
  servono, ma in mezzo agli incassi sono rumore. Ora sono nascoste all'apertura, con una spunta in
  fondo alla barra dei filtri («Mostra anche i 0 €») che dice **quante** ne sta nascondendo: senza quel
  numero si spegne un filtro senza sapere cosa stava togliendo. La scelta si ricorda sul dispositivo, e
  «Azzera filtri» riporta alla vista di default.
  Il contatore ora scrive **«32 acquisti di 120»** invece di «32 di 120» — il nome in mezzo, e il
  totale è quello della tabella intera, così si vede sempre quanto stanno togliendo flag e filtri. Vale
  per tutte le tabelle, perché il contatore è condiviso.

- `[Sviluppo]` 🏷️ **Il tag `sett:N` ora dice DOVE la ricetta è usata** — «quel tag per me è dove viene
  utilizzato, non mi interessa quando è stato creato». Era il difetto, e ha fatto perdere tempo a
  Simone su una diagnosi sbagliata: il tag lo scriveva il generatore **alla nascita** della ricetta,
  quindi registrava in quale generazione era stata prodotta. Un piatto creato generando la settimana 1
  e poi usato nella settimana 2 continuava a portare `sett:1` — e guardando il catalogo si leggeva
  «le mette tutte nella prima settimana» su una dieta distribuita su due. Un'etichetta che dice una
  cosa diversa da quella che sembra dire è peggio di un'etichetta assente: ci si costruiscono sopra
  dei ragionamenti, ed è successo.
  Ora la settimana si legge da dove è decisa: la **giornata** che usa la ricetta (`dayIndex` 1-7 =
  settimana 1, 8-14 = settimana 2). Il generatore non scrive più `sett:` alla nascita e allinea i tag
  in fondo, dopo aver scritto le giornate (`menu/tag-settimane.ts`). Una ricetta usata in più
  settimane porta più tag (`sett:1`, `sett:3`) — non è un caso da nascondere, è il modo più rapido di
  vedere se il ciclo si ripete invece di allungarsi. Una ricetta che nessuna giornata usa **perde** il
  tag: dire «settimana 1» su un piatto che nessuno serve è l'informazione falsa da cui è nato tutto.
  Le varianti sorelle condividono le ricette, quindi il tag porta l'**unione** delle settimane: un
  conteggio per una dieta sola darebbe un'etichetta che cambia a seconda di chi la guarda.
  Per i dati esistenti: `npm run fix:tag-settimane` (senza `CONFERMA=1` mostra cosa cambierebbe, riga
  per riga, e non scrive).
- `[Sviluppo]` 📅 **Filtro e colonna «Settimana» nel catalogo ricette** — chiesto per verificare
  l'anomalia. Compare solo dentro una dieta, perché fuori la domanda non ha senso: la stessa ricetta
  serve più famiglie in settimane diverse. Si legge dalle giornate e non dal tag, quindi dice la verità
  anche prima di aver girato la correzione. C'è anche la voce «fuori dal ciclo»: le ricette generate
  che nessuna giornata usa, cioè lavoro pagato che non arriva a nessuna cliente.
- `[Sviluppo]` 🔍 **Verifica: la rete si risale fino in cima, in tutte le funzioni** — «visto il
  problema avuto nella chat, verifica in tutte le funzioni che la rete venga risalita fino in cima e
  non solo due livelli». Fatta. Quindici moduli (clienti, acquisti, dashboard, pipeline, avvisi,
  report, compiti coach, CRM, analytics…) leggono la portata da un posto solo — `coachTeamScope`,
  attraverso `perimetroClienti` — e quello adesso risale tutta la rete: la correzione di prima li
  copre tutti. Sul lato nutrizioniste il capo non ha perimetro (vede tutto) e la nutrizionista vede le
  sue, che è la regola voluta.
  Un solo posto climba la rete per conto suo e **resta com'è**: la catena delle provvigioni in
  `finance.service`, che sale di livello in livello (fino a quattro anelli, cicli esclusi) perché lì
  ogni superiore incassa la differenza — è una regola di pagamento, non di visibilità, e allargarla
  cambierebbe i soldi. Tre test nuovi tengono ferma la regola sulla portata: se qualcuno riporta lì una
  query a un livello, diventano rossi.

- `[Sviluppo]` 🕸️ **I permessi di lettura risalgono la rete** — «perché la responsabile delle coach non
  vede le chat? I permessi di lettura devono risalire la rete, quindi coach, coordinatrice,
  responsabile», e poi «anche in chat va risalita la rete come autorizzazioni di lettura».
  Due difetti sovrapposti. In scheda cliente il controllo pretendeva che l'attore fosse **la coach
  assegnata** — cosa che una coordinatrice non è mai — quindi su ogni cliente della sua rete leggeva
  «il tuo ruolo non può leggere le conversazioni di questa cliente»: il ruolo era nell'elenco, la
  condizione era quella sbagliata. E più a monte, `coachTeamScope` scendeva di **un solo livello**
  (`managerId = lei`), mentre la rete è a tre: quindi la responsabile vedeva le sue coordinatrici e non
  le clienti delle coach sotto di loro — era cieca esattamente sulle persone che il suo ruolo esiste
  per seguire.
  Ora la rete si percorre tutta (`common/rete-staff.ts`), per quanti livelli ha e su **entrambi** gli
  archi del dominio: `managerId` (catena delle coach) e `headNutritionistId` (catena delle
  nutrizioniste). Chi sta sopra copre chi sta sotto, a qualunque distanza — e questo vale per la
  visibilità delle clienti in tutte le pagine, non solo per le chat.
  **Solo in lettura**, che è la parola che Simone ha usato due volte: scrivere resta di chi segue la
  cliente, perché una coordinatrice che scrive nel thread «Coach» farebbe comparire alla cliente un
  messaggio che sembra della sua coach — e per parlare al posto di qualcun altro c'è l'impersonazione,
  dichiarata e tracciata. Risalire non vuol dire vedere tutto: una cliente fuori dalla propria rete
  resta chiusa.
  Si scende a **strati** (una query per livello, non una per persona) e i cicli nei dati non mandano in
  loop: nessun vincolo del database impedisce che A risponda a B e B ad A, e senza protezione la
  funzione girerebbe per sempre. 20 test nuovi, ciclo e tetto di profondità compresi.
- `[Sviluppo]` 🔔 **Una cliente scrive alla coach: notifica in dashboard e push** — «se una cliente
  scrive in chat alla coach mandiamo la notifica nella dashboard e via push». Il push c'era già: era la
  **notifica a non nascere**. Il dedup era «una al giorno per tipo», e il tipo è uno solo per tutte le
  clienti: quindi la prima che scriveva generava la notifica e tutte le altre, quel giorno, no. Per una
  coach con quaranta clienti è una notifica su quaranta — la chat sembrava silenziosa mentre si
  riempiva.
  Ora il dedup guarda anche **quale cliente** (`dedupeSuPayload`), quindi è per cliente e non per tipo,
  con la stessa anti-raffica di tre minuti della direzione opposta: tre messaggi di fila restano una
  notifica, tre clienti diverse sono tre notifiche. E il **nome è nel titolo** («Giulia ti ha
  scritto»): senza, la coach deve aprire la scheda per sapere chi. Il testo non riporta il messaggio,
  perché nell'anteprima di un push non ci va niente che possa essere sanitario.
- `[Sviluppo]` 🔑 **«Copertura catalogo» ha il suo permesso** — chiesto da Simone: era agganciata alla
  chiave di «Creazione e validazione». Adesso è `catalog_coverage`, una riga a sé in pagina Permessi:
  quella pagina **genera** il catalogo, questa dice soltanto dove siamo, e guardare lo stato serve
  anche a chi non deve generare niente.

- `[Sviluppo]` 🕐 **Data e ora dei messaggi in chat (app)** — «in app non c'è data e ora delle chat».
  Il dato (`sentAt`) arrivava dal server da sempre e non si vedeva da nessuna parte: una conversazione
  lunga era un muro di bolle senza tempo, e non si capiva se una risposta della coach fosse di dieci
  minuti o di tre giorni prima. Su una chat dove si aspetta la nutrizionista quella è l'informazione
  più importante dopo il testo.
  Il **giorno** compare una volta sola, come riga in mezzo alla conversazione, e cambia solo quando
  cambia: scriverlo su ogni messaggio raddoppierebbe il rumore senza aggiungere niente, perché dentro
  la stessa giornata è sempre lo stesso. L'**ora** sta su ogni bolla, perché quella cambia sempre. E
  si chiamano «Oggi» e «Ieri», che sono le parole che una persona usa: leggere «11 agosto» per
  intendere oggi costringe a fare un calcolo.
  Vale su entrambe le chat dell'app (Assistente e il pannello della coach), da un posto solo
  (`lib/oraChat.ts`). 10 test, mezzanotte compresa — «00:05 di oggi» non deve diventare «ieri» solo
  perché sono passate poche ore. ⚠️ Serve una **pubblicazione OTA** perché le clienti lo vedano.

- `[Sviluppo]` 📐 **Tutte le tabelle impaginate come quella dei Permessi** — «devono scorrere
  liberamente nella finestra e risultare sempre perfettamente leggibili». Il difetto si vedeva in
  Ricette: l'ultima colonna, i pulsanti «Modifica», finiva **fuori dal bordo** della card, sopra il
  fondo della pagina. Non era la colonna sbagliata — era la card che non scorreva in orizzontale e
  quindi non aveva dove metterla.
  Sistemato in un posto solo, con `:has(> table.grid)` nel CSS: ogni card che contiene una tabella ora
  scorre in entrambe le direzioni con un'altezza massima che lascia in vista i filtri sopra e il
  paginatore sotto. Vale per tutte e trentaquattro le pagine senza toccarne nessuna, e per quelle che
  verranno. La larghezza minima è l'altra metà di «leggibile»: senza, su una finestra stretta le
  colonne si schiacciano e i nomi vanno a capo tre volte — con lei la tabella preferisce **scorrere**
  invece di comprimersi. Le tabelle dentro i modali e dentro le schede sono escluse da entrambe le
  regole: forzare 900px in una finestra larga 760 vorrebbe dire una barra di scorrimento su una
  tabella di tre colonne.
  In più, l'intestazione incollata in alto (titoli **e** riga dei filtri) è passata da 4 pagine a
  **tutte**: 22 pagine con una riga a testa, perché la misurazione dello scostamento la fa già
  l'helper.
- `[Sviluppo]` 🟢🟡 **Copertura catalogo: il colore dice se è validato** — «se i pranzi e le cene me li
  metti gialli da validare, verdi da validati, così abbiamo anche questo dato». Ogni cella porta due
  informazioni tenute separate: il **colore** è lo stato della validazione (verde = i piatti sono
  attivi e il motore li usa · giallo = ci sono ma sono in bozza, quindi da fuori la settimana sembra
  vuota · rosso = riferimenti morti o nessun piatto), il **numero** è la quantità, scritto come
  frazione (`60/84`) quando i piatti non bastano per le settimane presenti. Ogni colore ha anche un
  simbolo (✓ ⏳ ✕): un'informazione affidata al solo colore si perde per chi non lo distingue, e in uno
  screenshot su WhatsApp si perde per tutti.
- `[Sviluppo]` 👻 **`compatta:menu` contava i piatti fantasma** — trovato preparando la risposta a «e se
  facciamo girare il comando che porta a riempimento le settimane?». Il comando leggeva i piatti dalle
  giornate e **si fidava**: un `recipeId` di una ricetta cancellata nel frattempo veniva contato come
  piatto buono e rimesso in fila. Quindi il comando che deve mettere in ordine il catalogo era cieco
  esattamente sul difetto peggiore che il catalogo può avere, e dichiarava «settimana piena» una
  settimana con un buco dentro. Ora verifica che ogni ricetta esista, li conta in una colonna a parte
  («rotti esclusi») e li lascia fuori — quindi compattare **ripulisce** quei buchi, perché le giornate
  si riscrivono solo coi piatti veri. Nuova colonna «in bozza»: quanti dei piatti veri il motore non
  usa ancora, che non è un problema di compattazione ma di validazione.

- `[Sviluppo]` 🔍 **Pagina «Copertura catalogo»: dove siamo, a colpo d'occhio** — «crea una tabella con
  tutti i tipi, con le colonne n pranzi, n cene, n merende, n spuntini», nata dalla segnalazione «dice
  settimana creata e validata, poi ci torno sopra ed è vuota». Prima di correggere serviva
  **distinguere le ipotesi**, perché sono tre difetti diversi con tre correzioni opposte: mai generata,
  generata e non validata, oppure generata e con i piatti cancellati sotto.
  Una riga per variante (dieta × regime × obiettivo × struttura pasti) e per ogni pasto **due numeri**:
  i piatti diversi che le giornate nominano, e fra parentesi quanti sono **attivi**, cioè quanti il
  motore usa davvero. `84 (84)` a posto; `84 (0)` = generata e non validata, e da fuori sembra vuota;
  `84 (60)` = validata a metà. Più una terza colonna che prima non si poteva vedere da nessuna parte:
  i **riferimenti rotti**, cioè giornate che nominano ricette che non esistono più. I pasti stanno in un
  campo JSON, quindi nessun vincolo del database impedisce di cancellare una ricetta ancora nominata:
  quando capita la giornata resta in piedi e il pasto è un buco — ed è il candidato numero uno per «era
  vuota».
  I conteggi li fa Postgres (`jsonb_array_elements` + `COUNT(DISTINCT)`), non il codice: leggere tutte
  le giornate di tutte le varianti per contarle in memoria sarebbe lo stesso errore per cui il funnel
  sottostimava. Il join sulle ricette è **LEFT** di proposito: con un join interno i riferimenti rotti
  spariscono dal conteggio invece di comparire, e la tabella direbbe «tutto a posto» esattamente nel
  caso che stiamo cercando.
  Filtri e ordinamento su tutte le colonne, riassunto in testa (complete · magre · da validare · con
  riferimenti rotti · vuote). Le varianti a digiuno intermittente non hanno la colazione e la tabella lo
  sa: un «—» invece di uno zero, altrimenti risulterebbero tutte incomplete. 13 test nuovi, query
  provata su PostgreSQL 16 con dati finti che includono una ricetta cancellata.

- `[Sviluppo]` 🎂 **Gli auguri di compleanno che a qualcuno non arrivavano MAI** — il più antipatico
  dei troncamenti trovati, perché invisibile per costruzione. La query prendeva **500 clienti a caso**
  (`take: 500`, senza nemmeno un `orderBy`) e *poi* guardava in JavaScript chi fosse nato oggi. Con più
  di 500 clienti con la data di nascita in archivio, chi restava fuori da quei 500 non riceveva gli
  auguri mai: non «un anno sì e uno no», mai — e sempre le stesse persone. Nessun errore, nessun log,
  niente di rotto: il codice fa quello che dice, manda gli auguri a tutti quelli che ha guardato. E
  nessuno si accorge di un'email che non arriva, mentre chi la riceve non sa che ad altri non è
  arrivata.
  Ora il giorno lo filtra il **database** (`EXTRACT(MONTH/DAY FROM birth_date)`), quindi il limite di
  500 si applica a chi compie gli anni davvero e non a un campione casuale di clienti. E se una volta
  scattasse, lo **scrive nei log**: reintrodurre un troncamento muto proprio qui sarebbe ridicolo.
  In più, chi è nato il **29 febbraio** con la regola letterale riceveva gli auguri una volta ogni
  quattro anni: negli anni non bisestili ora arrivano il 1° marzo, come fanno i registri civili. La
  regola dell'anno bisestile è quella completa, secoli compresi. 11 test nuovi, e le due query provate
  su PostgreSQL 16 vero con dati finti.
- `[Sviluppo]` 📉 **Il funnel del lancio sottostimava senza dirlo** — i conteggi si facevano **in
  memoria** su `take: 50_000` eventi. Gli eventi del funnel sono uno per ogni prova attivata, misura
  inserita, offerta mandata, rinnovo: cinquantamila si raggiungono, e da quel momento il pannello
  comincia a dire numeri più piccoli del vero. Un pannello che dice «1.200 prove» quando sono 3.000 è
  peggio di un pannello che non c'è, perché su quello si prendono decisioni. E si rompeva dalla parte
  peggiore: senza `orderBy` non era garantito **quali** 50.000 righe arrivassero, quindi gli stessi
  numeri potevano cambiare fra due aperture della stessa pagina.
  Ora conta il database: tre `GROUP BY` con `COUNT(DISTINCT)`, nessun limite, niente in memoria, numeri
  esatti per costruzione. Corretto anche un difetto più piccolo che stava lì dentro: gli eventi senza
  utente (pre-login) venivano contati tutti come **una** persona, quindi un anello con trecento
  anonimi ne mostrava uno. 4 test nuovi, query provate su PostgreSQL vero.

- `[Sviluppo]` 📊 **Banca dati nutrizionale: Gaia non ricorda più, cita** — la risposta alla decisione
  di Simone sul caso basmati: «può affermarlo ma deve prima verificare sulle banche dati e dare dati
  corretti; magari poi li memorizza e arricchisce il suo sapere».
  Ora esiste `nutrient_fact`: ~60 alimenti con indice glicemico e valori per 100 g, **la fonte su ogni
  riga** (CREA per i valori, International Tables / Università di Sydney / Linus Pauling per gli IG) e
  tre cose che una tabella nutrizionale normale non ha:
  · il **range** e l'**affidabilità**, perché l'IG delle patate va da 73 a 111 secondo la fonte e
    quello dell'anguria da 50 a 76: con affidabilità «debole» Gaia dice il range e **non** il numero,
    perché «l'anguria ha IG 72» è una precisione che i dati non hanno — ed è la stessa falsa sicurezza
    dell'errore di partenza;
  · lo **stato** (crudo/bollito/secco): il CREA dà le lenticchie secche a 319 kcal e bollite a 109,
    confonderli sbaglia le calorie di un fattore tre;
  · **chi ha confermato** il valore. Gaia lo usa subito (aspettare l'approvazione vorrebbe dire che
    nei primi tempi ogni domanda finisce comunque alla nutrizionista, cioè il problema di oggi), ma
    finché nessuno l'ha guardato resta nella coda «da confermare». E una riga confermata **nessun
    deploy la sovrascrive**: il seed la salta, come per i parametri.
  **Il controllo che rende tutto questo verificabile:** i valori vanno davanti al modello, e la
  guardia in uscita si capovolge — non più «hai detto un numero?» ma «hai detto un numero che non ti ho
  dato?». Se nella risposta compare una cifra che non è nella scheda, la risposta non parte. È l'unica
  differenza tecnica fra un modello che cita e un modello che ricorda. Restano vietati anche coi dati
  davanti gli effetti fisiologici («sazia meno»: la sazietà non è in tabella) e i giudizi su cosa può
  sostituire cosa, che li decidono i gruppi di equivalenza.
  **Gli alimenti che non abbiamo** non si stimano e non si prendono «da uno simile»: la domanda va alla
  nutrizionista e il termine finisce in `nutrient_lookup_miss` col conteggio delle volte. È la parte
  «arricchisce il suo sapere» fatta senza inventare niente: «tempeh chiesto 40 volte» è la prossima
  riga da scrivere, e non serve indovinarlo.
  Un difetto trovato collegando i pezzi: il filtro in entrata mandava alla nutrizionista **tutto**
  quello che conteneva «glicemi», quindi «il basmati ha un indice glicemico più basso dell'integrale?»
  usciva dalla chat senza risposta — proprio la domanda per cui la tabella esiste. Ora «indice
  glicemico» (proprietà di un alimento) e «glicemia» (valore clinico di una persona) sono due cose
  diverse; se una frase contiene entrambe, vince la persona.
  Nuova pagina **Valori nutrizionali** (permesso `nutrient_facts`): elenco filtrabile, coda «da
  confermare», correzione in linea di IG, range, affidabilità e macro, e l'elenco degli alimenti
  chiesti dalle clienti e mancanti. Correggere **è** confermare: se una nutrizionista mette le mani su
  un numero, quel numero è suo. Le coach la vedono in sola lettura, per sapere su che dato Gaia ha
  risposto a una loro cliente.
  Migrazione validata su PostgreSQL 16. 50 test nuovi, fra cui la domanda del basmati rifatta per
  intero: stessa frase del 1° agosto, risposta corretta col range e con la fonte.

- `[Sviluppo]` 🤫 **Le segnalazioni risolte non si riaprono da sole** — due segnalazioni di Simone
  nello stesso giorno, che erano lo stesso difetto: «se il nutrizionista mette risolta perché
  continui a riaprirle? Se ha risolto basta fino a nuova segnalazione» e «il calo peso se è troppo
  rapido e il nutrizionista dice ok, resta ok, non devi continuare a tediarlo».
  Il motivo: chi apriva una segnalazione controllava **una cosa sola** — «ce n'è già una *aperta*?».
  Giusto, e insufficiente, perché guarda solo il presente: appena la nutrizionista metteva «risolta»
  quel controllo tornava a dire «nessuna», e la condizione clinica nel frattempo non era cambiata —
  una cliente che perde 2,8 kg/settimana continua a perderli anche dopo che qualcuno ha detto «lo so,
  la sto seguendo». Quindi la stessa segnalazione tornava al primo peso del giorno dopo, ogni giorno.
  Il danno non è il fastidio: è che **le segnalazioni smettono di voler dire qualcosa**, e chi le
  riceve impara a chiuderle senza leggerle. Comprese quelle nuove.
  La regola ora sta in un posto solo (`escalations/riapertura.ts`) e vale per tutti i punti che
  aprono segnalazioni: dentro la tregua di `escalation_reopen_days` (14 giorni, da Parametri) una
  segnalazione risolta non si riapre; passata la tregua, se la condizione è ancora lì torna — dopo
  tre settimane non è insistenza, è un problema che non si è risolto.
  **E l'eccezione che rende la regola sicura invece che solo silenziosa:** si riapre comunque se la
  cosa è **peggiorata** oltre `rapid_loss_reopen_worsening_kg` (0,5 kg/settimana). Un calo di 1,8 su
  cui la nutrizionista ha detto «ok» che diventa 3,5 non è la stessa segnalazione che torna: è un
  fatto nuovo, ed è il caso in cui tacere farebbe danno. Le segnalazioni che non hanno un «quanto»
  (piano bloccato, umore, aderenza) usano solo la tregua: inventare un peggioramento dove non è
  definibile sarebbe peggio.
  Due colonne nuove: `resolved_at` (e non `updated_at`, che si muove a ogni modifica — riassegnare
  una segnalazione avrebbe fatto ripartire la tregua da zero) e `severity`, il numero della gravità,
  che prima esisteva solo dentro la frase del motivo e da lì si poteva soltanto estrarre con una
  regex. Migrazione con backfill delle chiusure già fatte: senza, la prima notte dopo il rilascio si
  sarebbero riaperte tutte in blocco — esattamente il difetto che stiamo togliendo. Validata su
  PostgreSQL 16.
  18 test nuovi. Uno era rosso pur essendo giusto il codice: il finto config della suite dei segnali
  risponde `?? 0` alle chiavi che non conosce, quindi la tregua valeva **zero giorni**. È la seconda
  volta che quello zero inganna un test in quel file — ora le chiavi nuove sono dichiarate lì dentro
  con un commento che lo dice.

- `[Sviluppo]` ✏️ **`rinomina:prodotto` — il nome nuovo anche nello storico** — «correggiamo anche le
  vecchie». Rinominare il piano in Gestione negozio aggiorna tutto quello che lo legge via relazione
  (abbonamenti, scheda cliente, Acquisti, pipeline) ma **non** le copie: la descrizione dei pagamenti
  («Abbonamento Prova Gratuita») è testo congelato al momento dell'acquisto, e deve esserlo — una
  ricevuta non cambia da sola sotto gli occhi di chi l'ha ricevuta. Il risultato però è che dopo un
  rinomino Acquisti e Contabilità mostrano il nome vecchio per sempre. Lo script allinea quelle
  copie, e solo la parte del testo che è il nome: importi, date e stati non si toccano. **Parte a
  vuoto**: senza `SCRIVI=1` stampa i testi diversi con quante volte compaiono e cosa diventerebbero,
  e si ferma — su una tabella di contabilità è il minimo. Una `updateMany` per testo e non una per
  riga (i testi diversi sono una decina, i pagamenti migliaia), ed è ripetibile: girato due volte, la
  seconda non trova niente. `DA=… A=… SCRIVI=1 npm run rinomina:prodotto`.
- `[Sviluppo]` 📌 **La riga dei filtri resta in alto anche lei** — segnalato il 10/8 su Utenti: i
  titoli restavano incollati scorrendo, la riga dei filtri no, quindi per cambiare un filtro si
  doveva tornare in cima. Il motivo: la testa fissa la mettevano le *pagine*, scrivendo
  `position: sticky` nello stile di ogni colonna, e quello stile alla riga dei filtri — disegnata
  dentro l'helper — non arrivava. Ora è l'helper a farlo (`testaFissa`), per entrambe le righe, e lo
  scostamento della seconda si **misura**: scritto a mano sbaglia appena un titolo va a capo o cambia
  il carattere. Vale per Utenti, Home coach, Agenti e Posta con una riga a testa.
- `[Sviluppo]` 🔗 **`LeadsTable` condivide la testa con tutte le altre** (punto 3 del DA_FARE) — era
  l'ultima tabella con l'ordinamento copiato a mano, e già divergeva: la freccia c'era, la testa
  incollata no. Ora titoli cliccabili e ordinamento vengono da `useOrdinamentoServer`, che tiene lo
  stato e disegna la testa esattamente come `useTabella`. Il **filtro** resta suo e lato server, e
  non è un lavoro a metà: lì ci sono intervalli di valore e di data su decine di migliaia di lead,
  che un helper tutto in memoria con filtri «testo» o «scelta» non sa né disegnare né sostenere. La
  card ora scorre al suo interno, come in Utenti, altrimenti la testa incollata non ha niente a cui
  incollarsi e finisce sotto la barra del titolo — così restano fermi anche il totale, la ricerca e
  il paginatore.

- `[Sviluppo]` 🔔 **Cambi ed equivalenze nuove: adesso la nutrizionista lo sa** — «quando si creano
  sostituzioni nuove o equivalenze nuove mandiamo una notifica al nutrizionista». Erano due code che
  si riempivano **in silenzio**. Ogni cambio concordato in chat nasce «da verificare» — è giusto, la
  grammatura di un piatto è materia clinica — ma nessuno lo diceva a nessuno: si scopriva aprendo la
  scheda della cliente di propria iniziativa. Un cambio concordato con Gaia e mai verificato non è in
  attesa: è già nel piatto, approvato da nessuno. Stessa cosa per i gruppi di equivalenza, che il
  motore usa **solo se approvati**: un gruppo in bozza è lavoro fatto che non serve a niente finché
  il capo non lo guarda.
  Ora l'avviso parte da entrambi i punti, cambio di ingrediente e cambio di piatto, e dice chi e cosa
  («Giulia ha cambiato «carote» con «biete» a pranzo») — un avviso che dice solo «c'è un cambio»
  costringe ad aprire per sapere. Se alla cliente non è assegnata nessuna nutrizionista l'avviso va
  al **capo**, non nel vuoto: è la lezione di luglio, quando tre segnalazioni gravi sono rimaste
  ferme venti giorni perché non c'era un destinatario. La funzione sta in
  `common/avvisa-nutrizionista.ts`, accanto a quella delle coach. Sui gruppi generati dall'AI alla
  nascita di una dieta parte **un** avviso col totale e non otto uguali: otto notifiche in tre
  secondi non sono otto informazioni, sono una notifica e sette motivi per spegnerle. E non si
  avvisa mai chi ha appena creato la cosa. 17 test nuovi — uno di questi è nato scoprendo che il
  finto Prisma della suite delle sostituzioni non aveva il metodo che l'avviso usa, quindi l'avviso
  falliva in silenzio e il test passava: è esattamente il modo in cui un difetto sopravvive a una
  suite verde.
- `[Ricerca]` 📚 **Banca dati nutrizionale: la ricerca con le fonti** — in
  `progetto/ricerche/valori-nutrizionali-fonti.md` gli indici glicemici di ~50 alimenti dalle
  International Tables (Atkinson/Brand-Miller 2008 e 2021, Università di Sydney, Linus Pauling
  Institute) e i valori nutrizionali dal **CREA — Banca Dati di Composizione degli Alimenti**, ognuno
  con fonte, URL e **affidabilità dichiarata**. Serve a seminare la tabella che Gaia consulterà prima
  di affermare un numero (decisione di Simone del 10/8: non vietarle di dire i dati, ma obbligarla a
  fondarli). La parte più utile della ricerca sono le incertezze: l'IG delle patate va da 73 a 111
  secondo la fonte, quello dell'anguria da 50 a 76, e la cottura conta più della varietà (pasta 46 al
  dente → 58 se cotta venti minuti). Per questo la tabella dovrà portarsi dietro il **range**, non un
  numero secco. E sul caso di partenza: basmati e integrale sono **vicini** (57-67 contro 65, con
  voci a 50), quindi la risposta giusta non era nemmeno il contrario di quella di Gaia.

- `[Sviluppo]` ⛔ **Gaia ha detto una cosa falsa a una cliente, con sicurezza** — «il riso basmati ha
  un indice glicemico più basso dell'integrale, perché dice di no?». Su una conversazione del 1°
  agosto Gaia aveva risposto: «il basmati è più raffinato e ha un indice glicemico più alto
  rispetto all'integrale, quindi sazia meno e fa aumentare più rapidamente la glicemia». È
  **invertito**: il basmati è un chicco lungo ricco di amilosio, IG 50-58; il riso integrale comune
  sta a 65-70. E non ha sbagliato una sfumatura: ha citato un dato come se lo avesse davanti, e poi
  ci ha costruito sopra una motivazione («sazia meno») — che è il modo in cui un errore diventa
  convincente.
  Il filtro che avevamo guardava **solo il messaggio della cliente**: se lei scriveva «glicemia» la
  domanda andava alla nutrizionista, ma se la parola la scriveva **Gaia** non c'era nessun
  controllo. Ora ci sono due cose. Nel prompt: divieto esplicito di affermare dati nutrizionali —
  indice glicemico, calorie, proteine, fibre, confronti fra alimenti, effetti sull'organismo — e
  l'istruzione che se una cliente chiede se un alimento può stare al posto di un altro quella
  decisione è della nutrizionista (le tabelle di equivalenza sono sue), non un'opinione da dare.
  E soprattutto, fuori dal modello: `chat/guardia-risposta-ai.ts` legge la risposta **prima** di
  mandarla e se contiene un'affermazione nutrizionale o clinica non la manda — la cliente legge che
  su questo non si tira a indovinare, e la domanda parte verso la **nutrizionista** (non verso la
  coach, dove finiscono le domande generiche). Un prompt è una richiesta; questo è un cancello.
  La frase scartata resta scritta nel `meta` del messaggio: senza, non sapremmo mai quante volte
  scatta né su cosa. Tarata bassa di proposito — un falso positivo costa una risposta girata alla
  nutrizionista, un falso negativo costa una cliente che mangia secondo un dato inventato. 14 test
  nuovi, il primo è la frase esatta del basmati.

- `[Sviluppo]` 🔑 **Le conversazioni della cliente si accendono dai Permessi** — «la visibilità e la
  scrittura di questa parte devo poterla abilitare dai permessi». La card Conversazioni nella scheda
  cliente stava dietro a `chat`, cioè lo **stesso** interruttore della pagina Chat dell'azienda:
  spegnerla per un ruolo voleva dire togliere alla coach anche la possibilità di scrivere alle sue
  clienti, quindi non si spegneva mai. E la *verifica* di un cambio concordato in chat (conferma,
  correggi i grammi, annulla) non era un permesso affatto: era un elenco di ruoli scritto nel codice
  — `['nutritionist', 'head_nutritionist', 'admin']` — in tre posti diversi (rotta, servizio,
  frontend). Un interruttore che non accende niente è peggio di un interruttore assente, perché chi
  lo tocca crede di aver deciso qualcosa.
  Ora la chiave è **«Conversazioni della cliente»** (`client_conversations`), separata da Chat:
  *vede* = legge i thread (Gaia compresa) e l'elenco dei cambi; *gestisce* = li verifica. Default:
  coach e coordinatrice **leggono**, nutrizionista e capo nutrizionista **verificano** — la grammatura
  di un piatto resta materia clinica — ma da qui in poi la decisione è in pagina Permessi, senza
  rilascio. La risposta a «questo ruolo può?» vive in un posto solo (`permissions/permesso-di-ruolo.ts`,
  usata anche dalla scheda cliente): due copie che divergono vorrebbero dire un permesso che in una
  schermata conta e nell'altra no. Su errore del database si ricade sui **default**, mai su «sì»:
  dietro questo cancello non c'è nient'altro. 8 test nuovi, di cui uno tiene fermo il divorzio da
  `chat` sui decoratori delle rotte — è il tipo di regressione che nessun altro test vedrebbe, perché
  «funziona» resterebbe vero per l'admin e per la nutrizionista.
- `[Sviluppo]` 🧾 **«Con cosa si paga» non compariva in Parametri** — segnalato da Simone: admin, e la
  voce non c'era. Il valore era nel database e l'etichetta nel codice, ma la pagina ordinava i riquadri
  con un elenco fisso di gruppi e **scartava in silenzio** tutto quello che non era in elenco: il
  gruppo «Contabilità» non c'era, quindi la tendina in Contabilità restava vuota e in Parametri non
  c'era niente da correggere. Aggiunto il gruppo, e soprattutto tolto il difetto di classe: adesso
  quell'elenco decide solo **dove** sta un riquadro, e un gruppo che non nomina finisce in coda invece
  di sparire. Un parametro nuovo si vede sempre.
- `[Sviluppo]` 🍝 **«Se nella tabella alternative ho la pasta integrale perché Gaia dice che non ce
  l'ha?»** — quando la cliente chiedeva un cambio, Gaia scartava le alternative che *condividono
  l'alimento base* con il piatto di partenza: una regola giusta per le sostituzioni automatiche (non
  proporre riso al posto del riso) applicata dove non serviva, perché la pasta integrale al posto della
  pasta è esattamente quello che una cliente chiede. Ora la provenienza di ogni candidato viaggia con
  il candidato stesso (`gruppo` = gruppo di equivalenza approvato dal nutrizionista, `mappa` = mappa
  generica): il filtro sull'alimento condiviso vale solo per la mappa generica, mentre quello che il
  nutrizionista ha messo in un gruppo di equivalenza **è già una sua decisione** e Gaia non la
  ridiscute. 206 test nelle suite delle sostituzioni verdi.

- `[Sviluppo]` ⚖️ **La schermata Progressi si congelava dopo quattro mesi di pesate** — trovato
  cercando altri troncamenti come quello della pipeline. `ProgressService` leggeva le misure con
  `orderBy: 'asc', take: 120`: le 120 **più vecchie**. Le misure sono una al giorno, quindi dopo circa
  quattro mesi di costanza la finestra si riempiva di passato e da lì in poi: «misure registrate» fermo
  a 120 per sempre, peso «attuale» quello di mesi prima, chili persi e proiezione della data obiettivo
  sul tratto sbagliato del percorso, e **giorni di stallo su una data ferma** → `stalled: true` falso.
  Lo leggono in tre: l'app della cliente, l'alert di stallo della coach e il motore che decide i menu.
  Non peggiorava col volume del database — peggiorava con la **costanza della cliente**.
  Ora si leggono le 120 più recenti e si rimettono in ordine cronologico; il conteggio arriva da
  `count()`, e il peso di partenza — quando il profilo non lo ha — dalla **prima misura in assoluto**,
  che con `asc` era la stessa cosa e con `desc` non lo è più (altrimenti i chili persi sarebbero quelli
  degli ultimi quattro mesi invece di quelli di tutto il percorso). Il finto Prisma dei test ora
  rispetta `orderBy` e `take`: prima ignorava la query, ed è il motivo per cui il difetto è passato
  inosservato con i test verdi.
- `[Sviluppo]` 🔔 **Percorso concluso: adesso la coach lo sa** — «non avevamo detto che dopo x giorni
  di piano scaduto passavano in automatico in percorso concluso? E soprattutto che mandavamo notifiche
  alla sua coach dello spostamento?». L'automazione c'era (a +7 giorni, nel cron notturno) e non è mai
  mancata; l'**avviso** sì: lo spostamento lasciava solo una riga di audit, la scheda cambiava colonna
  di notte e la coach lo scopriva guardando la board. È l'avviso più utile di tutti, perché arriva
  nella settimana in cui una telefonata fa ancora rinnovare. La funzione che cerca la coach di una
  cliente sta ora in `common/avvisa-coach.ts`, usata anche dai rinnovi e dalle prove: due copie che la
  cercano in due modi smettono di avvisare in momenti diversi, e l'assenza di una notifica non si nota.
- `[Sviluppo]` 🔎 **`diag:percorsi-conclusi`** — quando una scheda col piano scaduto resta dov'è, la
  board mostra solo il risultato: l'automazione ha **quattro** condizioni e non si sa quale l'ha
  fermata. Lo script le dice per ogni cliente: da spostare stanotte · troppo presto (la pastiglia
  «piano scaduto» compare dal primo giorno, la soglia è a sette: fra i due non c'è niente di rotto) ·
  sta tornando (abbonamento attivo o bonifico in attesa) · fuori finestra oltre i 120 giorni · già in
  «Percorso concluso» · senza scheda CRM. `EMAIL=<email>` per una sola.
- `[Sviluppo]` 🔢 **Coda «Da validare»: i numeri fra parentesi erano lunghezze di array** — decisioni
  del motore, diete in revisione e protocolli in attesa erano elencati con `take: 100` e contati con
  `.length`: nel giorno in cui il motore segnala più di cento clienti — quello in cui il numero serve —
  la coda diceva «100» qualunque fosse la verità, e la dashboard della stessa nutrizionista usava già
  `count()` per gli stessi dati, quindi le due schermate potevano dire numeri diversi. Ora il conteggio
  viene dal database e, quando l'elenco è più corto, il titolo dice «100 di 240».

- `[Sviluppo]` 🧾 **«Con cosa si paga»: nessun elenco di ripiego nel codice** — Simone, vedendo cinque
  voci che non aveva scritto lui: «avevo detto che dovevo decidere io le voci da parametri». Le voci
  arrivavano davvero dal parametro, ma esisteva un ripiego nel codice per il caso «parametro vuoto» —
  e con un ripiego **svuotare** il parametro non svuota la tendina: le cinque voci tornavano, e per
  togliere «PayPal» bisognava scriverci qualcos'altro sopra. Un'impostazione che non si può azzerare
  non è un'impostazione. Togliato il ripiego, e il seed non semina più nessuna voce: finché il
  parametro è vuoto la tendina offre solo «non indicato» e il modulo dice dove si scrivono. Chi salva
  un metodo con la tendina vuota riceve un messaggio che indica la pagina, non un errore generico.
- `[Sviluppo]` 📐 **La card del widget non sborda più (per davvero)** — il primo `minWidth: 0` aveva
  sistemato la riga dell'importo, ma la seconda riga (il nome del prodotto, con `nowrap`) continuava a
  contribuire la sua larghezza intera alla dimensione minima del contenitore, poi del grid item, poi
  della card: era la **card** a sfondare la propria colonna. La catena va tagliata sull'antenato che ha
  la larghezza da rispettare, con `overflow: hidden` insieme a `minWidth: 0` — su un contenitore a
  blocco il solo `min-width: 0` non riduce il contributo a contenuto minimo.
- `[Sviluppo]` 🔢 **Pipeline: 100 schede per colonna e scorrimento su tutte** — coi numeri veri sotto
  gli occhi (86.323 schede in tutto, 86.274 in «Nuovo contatto») Simone ha alzato il tetto a 100 e
  chiesto lo scorrimento su **tutte** le colonne, non solo su quelle piene: `maxHeight` è un tetto e
  non un'altezza, quindi una colonna con tre schede resta alta tre schede — e l'altezza della board
  non dipende più da quale colonna è piena oggi.

- `[Sviluppo]` 🖥️ **Dashboard: ognuno si tiene i blocchi che guarda** — «tutti i moduli della
  dashboard, anche portafoglio ecc, devono essere attivabili e disattivabili da impostazioni moduli
  dashboard». I riquadri-anteprima si gestivano già; le parti fisse delle home di coach e nutrizionista
  (portafoglio, scorciatoie, numeri in cima, avvisi, link d'invito, piani in scadenza, tabella clienti,
  «Da validare», «Pazienti», regole del motore) erano scritte nella pagina. Ora sono in Impostazioni,
  in un elenco con l'interruttore.
  La preferenza è **a esclusione** (`dashboardBlocksOff`), non a inclusione come i moduli: questi
  blocchi oggi si vedono tutti, e chi ha già personalizzato la dashboard ha una lista salvata che non
  può contenere id nati oggi — con l'altra scelta le coach avrebbero aperto e non trovato più il
  portafoglio né le loro clienti. Decaduta anche la frase «il portafoglio resta comunque sempre
  visibile» in Impostazioni.
- `[Sviluppo]` 📜 **Tabelle della home scorrevoli, con quante righe vuoi** — «Le mie clienti» con
  quarantadue clienti allungava la home fino a rendere irraggiungibile tutto quello che sta sotto.
  Selettore 10 / 25 / 50 / 100 (default 10) salvato nel profilo, tabella che scorre dentro la card con
  l'intestazione ferma in cima, e «Piani in scadenza» scorrevole con la **stessa** preferenza: sono due
  elenchi della stessa pagina, e due impostazioni per la stessa domanda sarebbero due posti in cui
  cambiare la stessa cosa.
- `[Sviluppo]` 🔢 **Pipeline: la board mostrava un pezzo e il conteggio mentiva** — «perché non c'è più
  Patricia?». Caricava le **500 schede aggiornate più di recente su tutto il CRM** e poi le smistava
  nelle colonne: con le liste storiche importate erano 485 su 500 in «Nuovo contatto», e le clienti
  vere non toccate da qualche giorno cadevano fuori dalla finestra. Patricia era in «Acquisito» con
  349 € incassati, nel database, e la colonna non la mostrava — dicendo «1».
  Ora i **conteggi** vengono da un `groupBy` (esatti, per colonna, sempre) e le **schede** si caricano
  una colonna per volta con un tetto per colonna, così una colonna piena di lead freddi non affama le
  altre. Quando il tetto morde, la colonna lo dichiara invece di sembrare completa. E oltre le 50
  schede la colonna **scorre dentro sé stessa** (scelta di Simone), invece di allungare la pagina.
- `[Sviluppo]` ✅ **«Segna come gestito» adesso resta gestito** — segnalazione delle coach: «se clicco
  su segna come gestito, quando faccio refresh gli avvisi ricompaiono». Una costante sola
  (`open|handled|escalated`) rispondeva a due domande diverse: «devo ricreare questo avviso?» — dove
  `handled` ci sta di diritto, altrimenti l'avviso chiuso rinasce a ogni ricalcolo finché la condizione
  dura — e «cosa resta da fare alla coach?», dove non c'entra niente. La riga spariva perché la pagina
  la togliliava da sé, poi il server la rimandava indietro: indistinguibile da un pulsante che non
  salva. Ora la coda della coach chiede solo gli `open`; gli inoltrati restano a chi ha il perimetro
  completo, che è chi li raccoglie.
- `[Sviluppo]` 📊 **Classifiche per perdita: si scegle il mese** — «mi mostri il mese corrente, poi da
  una casellina a discesa posso selezionare quale mese vedere oppure tutto». Prima erano sempre
  sull'**intero percorso** e includevano chi ha una sola misura, cioè righe a 0,0 kg che non dicono
  «non ha perso» ma «si è pesata una volta»: ora servono almeno due misure nel periodo, ed è scritto
  sotto il titolo. Tutti i periodi (tutto + ultimi dodici mesi) arrivano in un colpo solo: la tendina
  non chiama la rete.
- `[Sviluppo]` 🧾 **Widget della dashboard: il testo non sborda più e l'importo si vede** — erano lo
  stesso difetto. La riga del widget aveva `text-overflow: ellipsis` ma stava in un contenitore flex
  senza `min-width: 0`, e un elemento flex non si stringe sotto la larghezza del suo contenuto: i
  puntini non scattavano mai, la descrizione lunga allargava la riga e **spingeva l'importo fuori
  dall'area visibile**. Nel riquadro Acquisti, inoltre, il nome della cliente è passato in alto e il
  prodotto sotto: cinque righe con la stessa descrizione troncata non distinguevano un acquisto
  dall'altro.

- `[Sviluppo]` 🛒 **Gli Acquisti si aprono alle coach, ma solo sulla loro rete** — richiesta di
  Simone: «la tabella acquisti voglio renderla visibile alle coach, ma devono vedere solo le clienti
  nella loro rete». Erano due cose diverse e mancavano entrambe.
  - **Chi entra.** Il controller aveva `@Roles('admin', 'sales')`: accendere la spunta «vede» sugli
    Acquisti nella pagina Permessi faceva comparire la voce di menu, e poi l'API rispondeva «Ruolo
    non autorizzato per questa risorsa» — una spunta che non fa niente. Ora la decisione sta dove
    Simone la prende: `@RequirePage('purchases')` legge la matrice dei permessi, quindi vale anche per
    i ruoli personalizzati e si cambia senza rilascio.
  - **Quanto vede.** L'elenco è filtrato sul perimetro di chi guarda, e le ricevute PDF sono
    controllate **una per una**: filtrare l'elenco non basta, perché l'id di una riga fuori elenco si
    può sempre chiedere a mano — e una ricevuta contiene nome, indirizzo e importo.
  - Il perimetro («le clienti della mia rete») era scritto dentro `ClientsService` come metodo
    privato: aprire una seconda pagina allo stesso perimetro voleva dire copiarlo. Ora sta in
    `common/perimetro-clienti.ts` e la scheda cliente lo usa da lì — una definizione sola, perché qui
    una divergenza non è un difetto grafico, è una coach che legge i pagamenti delle clienti di
    un'altra. Con test sui casi in cui «non si sa»: coach senza scheda staff, cliente senza coach
    assegnata, profilo mancante → **zero clienti**, non tutte.
  - Le azioni sui soldi (acquisto manuale, storno, eliminazione, ricalcolo provvigioni) restano
    `@Roles('admin')`: aprire la lettura non apre la scrittura.
- `[Sviluppo]` 🔎 **`diag:acquisti-pipeline`** — nasce dalla domanda «gli acquisti non corrispondono
  allo stato che vedo in pipeline, perché?». Le due viste divergono per **tre motivi voluti**, e lo
  script dice per ogni cliente quale dei tre è, invece di lasciarlo dedurre: la prova gratuita è un
  acquisto a € 0 che porta in «Prova» e non in «Acquisito»; l'attivazione manuale dalla scheda cliente
  è registrata a 0 e **non tocca il CRM** (regola chiesta da Simone: altrimenti una cliente al terzo
  percorso verrebbe retrocessa a «Prova»); il «€» sulla scheda della pipeline è `valueCents` — il
  valore della trattativa, che può essere stato scritto a mano — non la somma degli incassi.
  Elenca anche l'unico caso che è davvero da guardare: chi ha incassato e in pipeline non è
  «Acquisito». `EMAIL=<email>` per il dettaglio di una sola.

- `[Sviluppo]` 🧾 **Nei costi si dice con cosa hai pagato** — «manca la voce con cosa hai pagato, che
  dovrebbe essere una casella a discesa con le voci che inserisco io dai Parametri». Colonna nuova su
  `cost_entry` (`paid_with`), tendina nel modulo di registrazione, colonna filtrabile nell'elenco.
  La parte che conta della richiesta è **«le voci che inserisco io»**: stanno nel parametro
  `cost_payment_methods` (Parametri → Contabilità → «Con cosa si paga», una voce per riga), non in un
  elenco dentro il codice — un conto nuovo o una carta chiusa non devono richiedere un rilascio. Non è
  un enum e non è una tabella a parte per lo stesso motivo: l'enum vorrebbe una migrazione a ogni
  voce nuova, la tabella una pagina per gestirla, quando la pagina dei Parametri è quella in cui
  Simone è andato a cercarla.
  Due decisioni dentro: il server **rifiuta** un valore fuori elenco e dice dove si aggiunge (senza
  quel controllo un refuso dall'API creerebbe «Carta azindale» accanto a «Carta aziendale», e il
  filtro le offrirebbe come due conti diversi); rinominare una voce nei Parametri **non riscrive** i
  costi già registrati, che continuano a dire con cosa sono stati pagati allora. I costi registrati
  prima di oggi restano vuoti — con cosa siano stati pagati non si può indovinare, e riempirli con un
  valore plausibile sarebbe inventare un dato contabile.

- `[Sviluppo]` 💸 **Il compenso a visita non esiste più** — Simone, davanti alla pagina Parametri:
  «questo non serve più, lo abbiamo inserito a livello di prodotto» → «togliamolo totalmente».
  `FinanceService.creditVisitCompensation` accreditava alla nutrizionista 40 € fissi al completamento
  di ogni visita, con l'uscita a ledger, leggendo `visit_compensation_amount_cents`. Era l'ultimo
  residuo del modello prima del 14/07: pagava una seconda volta, di lato, una cosa già pagata dalla
  provvigione definita **sul piano** — e lo faceva con un numero che viveva in un parametro globale
  invece che nel prodotto. Tolti il metodo, la chiamata dal completamento visita, la riga nei
  Parametri e la chiave dal seed; con essi la dipendenza da `FinanceService` in `VisitsService`, che
  non serviva ad altro.
  **Cosa NON è stato toccato, di proposito:** la categoria `visit_compensation` resta viva nelle
  etichette di Contabilità, Compensi staff e Prelievi, e `creditStaff` la sa ancora scrivere. Gli
  importi già accreditati sono soldi dovuti o già pagati: togliere l'etichetta li lascerebbe in
  tabella come una categoria senza nome. Non nascono righe nuove, le vecchie si leggono ancora — e
  c'è un test che verifica entrambe le cose.
- `[Sviluppo]` 🧮 **Le quattro copie vecchie dell'ordinamento sono passate all'helper** — `Clienti`,
  `Diete`, `Users` e `Ricette` avevano l'ordinamento da prima di `tabella.tsx`, ognuna con la sua
  copia del blocchetto: ora la copia è una. I filtri che vanno al server restano al server (ruolo e
  archiviati in Utenti, tutti quelli di Ricette, lo stato in Diete): due strati sullo stesso dato si
  contraddicono a vicenda. `LeadsTable` resta fuori, ed è scritto perché (filtra e ordina lato
  server su decine di migliaia di righe).
  Tre difetti trovati rileggendo le venti pagine e corretti: in **Posta**, nella cartella «Inviata»,
  la colonna intestata «Destinatario» mostrava il mittente — cioè la casella dell'ufficio, la stessa
  riga su ogni messaggio, e l'unica informazione utile per ritrovare una mail inviata mancava (il
  dato arrivava dal server da sempre, non era dichiarato nel tipo); in **Buoni sconto** la colonna
  «Sconto» ordinava su un campo che mescola percentuali e centesimi, e ignorava i prezzi target che
  la cella mostra; in **Tag allergeni** la spunta «Solo da rivedere» e il filtro della colonna Stato
  erano due controlli sullo stesso dato — ora è uno, che parte già su «Da rivedere».
  Aggiunto `ordineScelte`: le tendine di stato seguono il ciclo di vita (In attesa → Pagato →
  Rifiutato) invece dell'alfabeto, che le faceva sembrare in ordine casuale.

- `[Sviluppo]` 🗃️ **Lo storico delle assegnazioni dei lead** — chiesto da Simone: «nella tabella lead
  da accettare mettere il flag "mostra accettati" con la cronologia, quindi **tutti i dati vanno
  archiviati**». Il flag era la parte facile: la cronologia non esisteva. Su `crm_record` i tre campi
  dell'assegnazione (`assignedCoachId`, `assignmentStatus`, `assignedAt`) dicono lo stato di **adesso**,
  e ogni passaggio cancellava il precedente — con tre conseguenze che nessuno poteva vedere:
  - il **rifiuto** azzerava la coach: dopo, «chi l'ha rifiutato e perché» era una domanda senza
    risposta possibile;
  - la **scadenza automatica** (cron) faceva lo stesso e non scriveva nemmeno una riga di audit: il
    lead tornava alla responsabile e l'unica traccia era una notifica, che si legge e sparisce;
  - l'**assegnazione in massa** scriveva UN audit con l'id del primo lead: la scheda degli altri
    duecento diceva «nessuno ti ha mai assegnato».
  Ora c'è la tabella `lead_assignment`: una riga per assegnazione, che nasce `pending` e finisce in un
  modo solo (`accepted`, `rejected`, `expired`, `reassigned`), con il motivo del rifiuto e con i nomi
  di coach e assegnante **copiati dentro** — uno storico che dice «assegnato a —» perché quella coach
  non lavora più qui non è uno storico. La migrazione **recupera** lo stato corrente dei lead già
  assegnati, altrimenti il giorno del rilascio il flag mostrava una tabella vuota anche a chi ha
  decine di lead accettati. Validata su PostgreSQL 16 locale, backfill compreso.
- `[Sviluppo]` 🧮 **Filtri e riordino sulle colonne, su tutte le tabelle** — «in quella tabella come in
  quella dei log mettere i filtri e riordino sulle colonne… controllale tutte». Guardandole tutte: 37
  tabelle, **cinque** avevano l'ordinamento, e le cinque erano cinque copie divergenti dello stesso
  blocchetto copiato a mano. Ora c'è `backoffice/src/components/tabella.tsx`: si dichiarano le colonne
  (titolo + come si legge il valore + se ha un filtro) e le celle restano scritte a mano.
  Tre decisioni dentro l'ordinamento, che prima ogni copia prendeva a modo suo: i **vuoti vanno in
  fondo** anche in decrescente (righe vuote in cima nascondono quelle che cerchi); gli **importi si
  ordinano come numeri**, non come «€ 100,00» che viene prima di «€ 20,00»; le tendine dei filtri
  offrono **solo i valori presenti** nelle righe caricate.
  Applicato a 20 pagine. Dove il server manda un tetto di righe la pagina lo **dichiara**: filtrare 200
  righe su 5.000 e non trovare niente non vuol dire che il fatto non c'è. Per lo stesso motivo il tetto
  del log attività è passato da 200 a 1000, con la scelta in pagina.
  - **«Lead da accettare» e «Prelievi» erano elenchi di schede, non tabelle**: convertite in tabella,
    che è l'unico modo di avere filtri e ordinamento per colonna. Nessun dato e nessun pulsante persi,
    ma sono le due pagine che cambiano aspetto: da guardare.
- `[Sviluppo]` 🔎 **Nel log attività si vede COSA è cambiato** — la stessa richiesta del 10/8 sul log
  del lead, applicata al log generale: «Parametro aggiornato» senza dire quale parametro, e da quanto a
  quanto, è una riga che non risponde a nessuna domanda. Colonna nuova, filtrabile, che usa lo stesso
  lettore dei tre formati di metadata della scheda cliente (`righeModifica`).
- `[Sviluppo]` 📅 **La data di inizio si sposta anche dal profilo dell'app** — «dal profilo, cliccando
  sul piano, mi fa modificare la data di inizio fino a 24 ore prima». Stessa azione di Gaia, stessa
  regola letta dallo **stesso** parametro (`plan_start_change_lock_hours`), stesse tre scritture — che
  adesso passano da un solo punto del codice, perché due strade che scrivono due volte le stesse tre
  cose prima o poi ne dimenticano una.
  L'app **chiede prima** al server se si può (`GET /me/plan-start`) e disegna il pulsante solo se sì:
  un pulsante che c'è e poi risponde «non si può» è peggio di un pulsante che non c'è. Quando manca
  poco, al suo posto c'è la strada che resta aperta (la coach in chat). Vale anche sui piani in attesa
  di pagamento. **Serve una OTA** per vederlo.
- `[Sviluppo]` ⚠️ **Avviso sulla matita quando la data manda il piano nel passato** — dal caso di ieri
  mattina: un piano appena attivato non compariva in dashboard perché la data di inizio aveva il mese
  sbagliato e il piano, sommata la durata, risultava finito da giorni. La conclusione era «errore mio»,
  ed era vero: ma il sistema aveva eseguito **in silenzio** un comando che cancellava il percorso della
  cliente, e da fuori era indistinguibile da un difetto. Ora il server si ferma (409) e dice cosa
  succederebbe — la data di fine calcolata, «la cliente vedrà Nessun piano attivo» — e si procede solo
  confermando. Non un divieto: spostare all'indietro un piano finito per davvero resta legittimo.

---

## 2026-08-09

- `[Sviluppo]` 🥗 **Si vede QUALE dieta è collegata a una cliente** — chiesto da Simone davanti alla
  scheda: «di Mediterranea ne ho tre tipi, devo vedere tutta la descrizione così scelgo nel modo
  giusto o capisco se la cliente è in quella corretta».
  - In scheda c'era solo lo **stile** («Mediterranea»), che con tre diete che si chiamano così non
    dice niente: «Mediterranea», «Mediterranea senza glutine» e la Keto-Mediterranea hanno tutte
    `style = mediterranean`. Quello che disambigua è `dietFamily` (= `Diet.name`), che era scritto sul
    profilo e **non compariva da nessuna parte**.
  - Riga nuova **«Dieta assegnata»**: nome vero, **descrizione per esteso e non troncata** (è quella
    che fa scegliere), regime e numero di pasti della variante, ed etichetta rossa se quel nome non è
    in catalogo o è ancora una bozza. Se la descrizione manca lo dice: senza, in app la cliente vede
    solo il nome.
  - Riga **«⚠️ Menu in corso»** quando la dieta assegnata e quella delle giornate già erogate sono
    diverse. È il caso visto stasera: sul profilo «senza glutine», nel menu di domani ancora il pane.
    Con il glutine di mezzo non è una sfumatura da lasciare implicita — e dice anche cosa fare
    («Rigenera menu»).
  - **Nell'app**, `/me/nutrition` dà ora la precedenza alla dieta **assegnata**. Prima il nome veniva
    solo dalla dieta dei menu già erogati: dopo un cambio la cliente leggeva il nome vecchio — corretto
    rispetto a quello che sta mangiando, sbagliato rispetto a quello che è stato deciso, e
    indistinguibile da un'assegnazione fallita. Nessuna OTA serve: il nome arriva dal server. Nel
    payload c'è anche `menuAncoraSullaDietaPrecedente`, che l'app userà alla prossima OTA.
- `[Sviluppo]` 📱 **OTA 2.1.4 pubblicata** — porta sull'app le schermate della serata (card Consenso e
  revoca, pagine `/privacy/*`, «?» sulla dieta, pasti del digiuno a parole, messaggio della data di
  inizio). Verifiche fatte sullo zip **prima** di pubblicarlo: `index.html` alla radice, tutte le
  stringhe delle schermate nuove, unica versione nel JS `2.1.4`, e le **push presenti** — provate nei
  due versi (ci sono `/me/push-tokens` e il listener `registration`, ed è assente la stringa del ramo
  «costruito SENZA google-services.json», eliminata dal build perché `__ENABLE_PUSH__` era true).
- `[Sviluppo]` 🔎 **`diag:cancellazioni`** — elenca le richieste di cancellazione con stato, data
  prevista e giorni rimanenti, ed evidenzia quelle scadute o che scadono oggi. Nasce da una necessità
  immediata: una prova di revoca lasciata a metà non si vede da nessuna parte, e al 31° giorno il cron
  anonimizza l'account per davvero. `FERMA=<id>` la sospende e rimette il consenso, come il link della
  mail; il rinnovo automatico no, perché riabbonare qualcuno da uno script sarebbe peggio.
- `[Prodotto]` 🌾 **Senza glutine attivo in produzione** — variante «Mediterranea senza glutine»
  generata e approvata (9 combinazioni regime × pasti), `assegna:senza-glutine` lanciato: le 2 clienti
  che avevano dichiarato il glutine su 45 risultano assegnate. Resta da premere **«Rigenera menu»** per
  entrambe: finché non si fa, ricevono ancora piatti con glutine. ⚠️ In catalogo le varianti approvate
  risultano **18 = 9 combinazioni duplicate**: non fa danni (il motore prende la prima che combacia) ma
  rende inutilizzabile una tendina di scelta. Da ripulire con `dedupe:diets` prima di aggiungere in
  scheda la scelta della dieta assegnata.

- `[Prodotto]` 📄 **Documento per Nocanty: le grammature dei grassi** —
  `progetto/Metabole_Grammature_Grassi_Domande.md` (+ PDF da mandarle). Spiega il difetto in numeri
  (70 ml di panna → 70 g di olio porta un piatto da 500 a ~890 kcal, +77%), il vincolo che decide la
  risposta — **nel sistema non esiste nessuna tabella di composizione degli alimenti**, quindi il
  fattore o lo dà lei o i grassi escono dai cambi automatici — e le due strade con le conseguenze di
  ciascuna. Chiede **un numero per alimento** (grammi equivalenti a 100 g di un riferimento del
  gruppo), non uno per coppia: il rapporto fra due membri qualsiasi lo ricava il codice, e la
  conversione resta coerente nei due versi. Segnalato anche l'inciampo che nessuno vedrebbe: il
  limite di plausibilità già attivo (un terzo–triplo) **rifiuterebbe** un fattore sotto 0,33, e Gaia
  ripiegherebbe su pari grammatura — cioè sull'errore che stiamo togliendo.
- `[Sviluppo]` 🔒 **Revoca del consenso e cancellazione a 30 giorni** (chiesta l'8/8, decisioni prese
  il 10/8) — nuovo modulo `privacy`, migrazione `richiesta_cancellazione` (validata su PG16, e
  rieseguibile).
  - Nel profilo dell'app una card **«Consenso»** con la data e l'ora in cui è stato dato (il dato
    c'era già in `consents.healthDataConsent.at`, non lo leggeva nessuno), il pulsante «Revoca
    consenso», il popup che dice cosa succede e la parola **ELIMINA** da scrivere a mano. Il pulsante
    di conferma resta spento finché la parola non è quella: l'attrito è il punto, e un pulsante
    premibile prima renderebbe il popup una formalità. Nessuno deve cancellare il proprio percorso
    per una toccata distratta sullo schermo.
  - **Le tre decisioni, e dove sono scritte nel codice.**
    1. **Solo la cliente può sospendere.** Il pulsante sta unicamente nel link mandato al suo
       indirizzo, e la rotta è pubblica proprio per questo: il token *è* l'autorizzazione, quindi
       nessuna sessione dello staff — nemmeno un admin — può arrivarci. Coach e manager ricevono una
       copia con un testo diverso, **senza** il pulsante, che spiega perché non ce l'hanno: un test
       verifica che quel link non finisca mai nella mail allo staff, altrimenti la decisione sarebbe
       scritta nel codice e smentita da un'email.
    2. **La revoca disdice il rinnovo automatico**, riusando `cancelMyRecurring`. Il piano già pagato
       resta valido fino alla scadenza: si ferma il rinnovo, non il servizio. Se poi sospende, il
       rinnovo **non** torna da sé — riabbonare qualcuno senza chiederglielo sarebbe peggio — e
       questo viene detto sia nella mail sia nella pagina che apre col link.
    3. **Le fatture restano, e si dice in tre posti**: nel popup (prima che scriva ELIMINA), nelle due
       mail e in una pagina pubblica `/privacy/cancellazione` con il perché accanto a ogni voce. I
       testi arrivano dal backend, da un'unica fonte: tre copie della stessa frase in tre posti
       divergono sempre, e questa è una frase che deve restare vera.
  - **La cancellazione anonimizza l'utenza, non elimina la riga**, e non è un compromesso al ribasso:
    una fattura appesa a un id che non esiste più è una fattura che in contabilità nessuno sa più
    leggere — e il database la rifiuterebbe comunque (`payment`, `order`, `subscription` hanno vincoli
    verso `user`). Quindi tutto il resto viene distrutto — profilo, misure, menu, conversazioni,
    documenti, note cliniche, notifiche, sessioni — e dell'utenza resta un guscio senza nome, senza
    email vera, senza indirizzo, con la password sostituita da rumore. È la forma in cui l'obbligo
    fiscale e il diritto alla cancellazione stanno insieme senza che uno dei due sia finto.
  - **Cosa non si tocca**, con un test per ciascuna: `payment`, `order`, `subscription`,
    `ledgerEntry`, `pendingCommission`, `staffCompensation`, `discountRedemption`. Le fatture per
    legge; provvigioni e compensi perché sono fatti avvenuti fra noi e persone terze, che non hanno
    chiesto niente — cancellarli falserebbe il conto economico e i compensi di qualcun altro.
  - Ultimo passo del cron notturno, e in fondo di proposito: anonimizza un'utenza, quindi ogni passo
    che girasse dopo lavorerebbe su una persona che non c'è più. Gli avvisi vengono **prima** delle
    cancellazioni: se il cron salta un giorno, chi doveva essere avvisata ieri lo è oggi e non si
    trova cancellata senza preavviso — è l'unica delle due cose che non si può rimediare. Una
    cancellazione che fallisce resta `pending` e ripassa domani: segnarla fatta per far tacere il cron
    sarebbe un adempimento dichiarato e non eseguito.
  - Revocare due volte non fa partire due termini né sposta la data, e non manda una seconda mail. Il
    token in chiaro non si conserva (in tabella solo l'hash, come per i reset password); l'ultimo
    avviso ne genera uno nuovo, così esiste sempre un solo link valido. **+53 test.**
- `[Sviluppo]` 🗣️ **I tre difetti visti nel collaudo dell'OTA 2.1.3, chiusi** — erano in schermata, in
  ordine di quanto si notano.
  - **«non voglio lasciarti con *il* panna fresca nel piatto»**: l'articolo era scritto a mano
    (`il ${p.da}`) e il ricettario ha alimenti di ogni genere. Ora il nome sta fra virgolette, come
    già altrove nello stesso file — nessuna tabella ci dice il genere di «panna fresca». Un test
    scorre tutti i testi che nominano un alimento e cerca l'articolo appiccicato: era una correzione
    da cinque minuti, ma la legge la cliente e tornerebbe alla prima frase nuova.
  - **La controproposta ora si capisce.** Alla conferma la cliente aveva scritto «l'olio mi fa peso
    posso usare il burro vegetale?» e Gaia aveva risposto «Non ho capito: confermi il cambio?».
    Adesso il sostituto proposto **da lei** viene letto e verificato con le stesse regole di
    sicurezza — solo ciò che sta fra gli equivalenti approvati e passa allergeni ed esclusioni. Se
    regge, diventa la proposta; se è un allergene, Gaia dice **perché** no e propone subito
    un'alternativa nello stesso messaggio; se non è in catalogo, la richiesta va alla nutrizionista
    (che è l'unica che può dire sì a una cosa che il ricettario non prevede) invece di finire in un
    «non ho capito». Distinzione che è costata due test rossi: «boh» e «mah» non sono proposte, e
    trattarle come tali apriva alla nutrizionista una richiesta che nessuno aveva fatto.
  - Strada facendo, un difetto **più vecchio**: `terminiCandidati` teneva l'apostrofo dentro la
    parola, quindi «l'olio» non combaciava con «olio evo». Chi scriveva «vorrei togliere l'olio» si
    sentiva rispondere che non lo trovava fra gli ingredienti di oggi, e al secondo tentativo il
    dialogo passava alla coach. In italiano l'elisione è la norma: +6 test.
  - **«Lo voglio diverso» senza dire di cosa**: prima si ripiegava sulla domanda dell'*ingrediente*
    — un'altra domanda, in risposta a una richiesta capita benissimo. Ora Gaia chiede **quale pasto**
    con l'elenco di oggi, e accetta il numero, il nome del pasto o il nome del piatto. La preferenza
    detta due messaggi prima («più proteico») non si perde per strada.
- `[Sviluppo]` 🩺 **La nutrizionista può correggere un cambio nato in chat** — li vedeva in scheda e
  non li poteva toccare: lo stato `corretta` esisteva nel dato e non c'era nessun modo di scriverlo.
  Una verifica che non si può registrare non è una verifica, è una lettura.
  - Tre azioni in scheda cliente (card Conversazioni): **conferma** («va bene così» — è quello che
    svuota l'elenco da verificare), **correggi** (sostituto e/o grammi, con una nota), **annulla**
    (il piatto torna esattamente come era; su un cambio di piatto rimette `recipeId`, nome e kcal di
    prima). `PATCH /staff/clients/:id/sostituzioni-chat`, audit `menu.cambio_chat.verifica`.
  - Due cancelli, diversi da quelli della lettura: la coach questi cambi li **legge** — le servono
    per capire come sta andando — ma non li tocca, perché la grammatura è materia clinica. Più il
    solito controllo di portata sulla cliente.
  - E la cosa che conta più dei cancelli: **la cliente viene avvisata**, con la nota della
    nutrizionista dentro la notifica. Aveva concordato qualcosa con Gaia; se il piatto di domani non
    è quello, deve saperlo da noi e non scoprirlo aprendo il menu. La semplice conferma non manda
    niente: notificare anche «va bene così» insegnerebbe a ignorare queste notifiche.
  - Serve soprattutto sul **gruppo dei grassi**, dove la pari grammatura non regge (70 ml di panna
    ≈ 200 kcal, 70 g di olio ≈ 630): finché la regola non è decisa, la mano umana è la risposta.
- `[Sviluppo]` 📊 **Fatturato e nuove clienti PER GIORNATA** (chiesto l'8/8) — `GET /admin/charts/daily`
  + card in cima alla pagina Grafici. L'asse è a giorni e il cumulato **si azzera ogni mese**; le
  frecce scorrono i mesi storici (quella «avanti» sparisce sul mese in corso, per non portare su un
  mese vuoto e futuro). Sovrapposta, tratteggiata, la linea del **mese precedente**, e in cima il
  confronto **alla stessa giornata**: è quello che risponde alla domanda vera a metà mese, mentre i
  totali — un mese finito contro un mese a metà — sembrano sempre un crollo. Sotto, le nuove clienti
  al giorno a barre (sono conteggi: una linea suggerirebbe mezze clienti).
  - Il giorno è quello di **Europe/Rome**: un incasso delle 00:30 del 1° agosto è di luglio per UTC, e
    finirebbe nel mese sbagliato lasciando giusto il totale — solo i grafici non tornerebbero, e
    nessuno saprebbe perché. La serie ha un punto per **ogni** giorno, vuoti compresi: un grafico che
    salta i giorni senza incassi mente sulla pendenza. Un endpoint suo e non un campo in più su
    `charts`, perché ogni freccia premuta ricalcolerebbe anche le misure. +16 test.
- `[Sviluppo]` ❓ **Il «?» sulla dieta nel profilo dell'app** (chiesto l'8/8) — la cliente leggeva un
  nome nudo, «Flexitariana», mesi dopo averlo scelto in registrazione, dove la spiegazione c'era. Ora
  il pallino apre il foglio: prima la descrizione che la nutrizionista ha scritto **per lei**
  (`Diet.clientDescription`), poi la scheda generale dello stile con le fonti. Lo stile è quello della
  **dieta assegnata**, non quello scelto in registrazione: se la nutrizionista l'ha spostata, il popup
  spiega quella che sta seguendo. Il pallino è diventato una classe (`.info-dot`) usata da entrambe le
  pagine — due copie inline dello stesso pallino divergono, e «come nel questionario» smette di essere vero.
- `[Sviluppo]` 🗓️ **Gaia sposta la data di inizio, parlandone** — completa la richiesta del 10/8: in
  dashboard c'era scritto «se vuoi cambiare la data di inizio, chiedi a Gaia in chat», e Gaia non
  sapeva farlo. Finora la data si spostava **solo** dal backoffice, col permesso `change_plan_start`:
  la cliente che aveva sbagliato il calendario doveva scrivere alla coach e aspettare.
  - **Il confine, deciso con Simone: solo prima che il piano parta.** Finché l'inizio è nel futuro
    spostarlo non butta via niente — nessun menu consegnato, nessuna spesa fatta. A piano avviato Gaia
    non tocca niente e passa la mano alla coach, che è anche la risposta giusta: a quel punto la
    domanda non è «che giorno metto», è «cosa è andato storto».
    Lo stesso confine copre senza un ramo in più il **piano in coda** (`planStartDate` futura ma un
    piano *è* in corso): quella data non è una sua scelta, è la scadenza di quello che sta usando, e
    spostarla sovrapporrebbe due piani.
  - **Il riconoscimento delle date sta in una funzione pura** (`menu/data-inizio-chat.ts`), perché è
    la parte che si sbaglia: «15/9» è il 15 settembre e non il 9 maggio; «lunedì» detto di lunedì è
    il lunedì **prossimo** (chi dice il nome di un giorno intende un giorno che deve ancora venire);
    «il 3» detto il 12 agosto è il 3 **settembre**; «il 3 gennaio» detto a dicembre è dell'anno dopo;
    «fra un mese» conta un mese di calendario, non trenta giorni. Due difetti chiusi dai test appena
    scritti: il «il 3» faceva scorrere l'**anno** invece del mese (sbagliato di undici mesi, e
    plausibile), e il 31 febbraio non veniva rifiutato ma **scivolava** al 3 marzo — una data che
    nessuno aveva detto, che avrebbe passato tutti i controlli a valle.
  - Ogni proposta si rilegge **a parole** («martedì 15 settembre») e nomina anche il giorno di sblocco
    del menu: una data in cifre non si riconosce sbagliata a occhio, una scritta così sì. Due
    tentativi non capiti e passa alla coach invece di insistere.
  - Sul «sì» scrive le stesse tre cose della scheda cliente — `planStartDate`, `subscription.startDate`
    e la fine **ricalcolata** dalla durata — e rigenera i menu con `regenerateFromToday`, **mai**
    `restartFromPlanStart` (che cancella anche lo storico). Su un piano `pending` l'abbonamento non si
    tocca: le sue date le mette `finalizeApproval`, scriverle qui sarebbe attivare un piano non pagato.
  - La data si **ricontrolla alla conferma**, non ci si fida dello stato appeso al messaggio: fra la
    proposta e il «sì» può passare la mezzanotte, o il piano può essere partito.
  - Audit `chat.data_inizio.spostata` + `chat.data_inizio_applicata`. I due dialoghi guidati di Gaia
    (sostituzione e data) non si rubano i turni, e una FAQ vera fatta mentre aspettiamo una data ha la
    sua risposta invece di «non ho capito la data». **+56 test**, suite 1099 verde.
- `[Sviluppo]` 🍽️ **I pasti del digiuno si vedono e si cambiano dalla scheda** — richiesta di Simone
  del 10/8. `fastingWindow` (quali pasti salta chi fa digiuno intermittente) esisteva da tempo, la
  cliente la impostava dal suo profilo, e il backoffice **non la mostrava affatto**: lo staff non
  poteva sapere se una cliente in digiuno saltava la colazione o la cena.
  - In scheda ora c'è in sola lettura («Pasti che salta») e, in modifica, una tendina che compare
    **solo** se il percorso è il digiuno — un campo che non vuol dire niente invita a compilarlo per
    sbaglio. Le tre voci sono scritte con le stesse parole che legge la cliente nel suo profilo: se
    divergessero, al telefono coach e cliente parlerebbero di due cose con lo stesso nome.
  - Permesso dedicato **«Cambia i pasti del digiuno»** (`change_fasting_window`), separato da
    «Cambia tipo di dieta»: è il motivo per cui esiste, poterlo dare alla coach senza darle anche
    regime e stile. Default: coach, coordinatrice, nutrizioniste e admin.
  - Due difetti chiusi strada facendo: il percorso diverso dal digiuno ora **azzera** la finestra
    (restava scritta, e al ritorno al digiuno riprendeva un valore vecchio in silenzio) — e senza
    chiedere il permesso, perché è una conseguenza tecnica del cambio percorso, non una scelta. E il
    permesso si chiede **solo se il valore cambia davvero**: un test rosso ha mostrato che, chiedendolo
    alla presenza del campo, chi non aveva quel flag non poteva più salvare nemmeno un numero di
    telefono, perché il form rimanda tutti i campi ogni volta.
  - Nell'app la cliente **vede a parole** quali pasti salta: prima leggeva la stringa tecnica
    «Digiuno intermittente (finestra skip_breakfast)». Resta lei a poterli cambiare (scelta di
    Simone), con la nota che se non è una preferenza ma un problema — fame, giramenti di testa,
    orari — se ne parla con la coach, che può cambiare anche la finestra. +6 test.
- `[Sviluppo]` 📆 **La data di inizio piano si legge, e la coda non mente più** — chi compra con
  partenza futura vedeva in dashboard «sarà disponibile il 12» avendo scelto di partire il 14, senza
  che nulla spiegasse quel 12 (è la data di **sblocco** del menu, due giorni prima).
  - Il messaggio ora dice **entrambe** le date e perché sono diverse — «il tuo piano parte il 14, e il
    menu si sblocca il 12: due giorni prima, così hai tempo per la spesa» — e invita a **chiedere a
    Gaia** se vuole spostare l'inizio.
  - **Piano in coda**: chi compra un secondo piano mentre uno è in corso parte alla scadenza del
    precedente, e la data scelta veniva ignorata *senza dirlo* — `profile.planStartDate` restava la
    sua, l'abbonamento partiva un'altra volta, e da lì i menu (che seguono il profilo) e la scadenza
    (che segue l'abbonamento) raccontavano due storie. Ora l'accodamento **scrive** la data vera nel
    profilo, con audit `commerce.plan.queued`: banner, gate del menu e scheda dicono la stessa cosa.
  - Al ritorno dal pagamento, se la data è già decisa **non si chiede più**: si comunica, con la
    spiegazione «se avevi già un piano in corso, questo parte quando finisce quello». Niente
    calendario finto (decisione di Simone: «non le chiedo la data, glielo dico»).


- `[Sviluppo]` 🔎 **In elenco clienti si vede chi è senza glutine** — Simone, dopo il primo giro:
  «lo script ha corretto due clienti ma io le vedo in Mediterranea, come faccio a distinguere?».
  Il dato era giusto e la domanda legittima: **la tendina «Stile» non può distinguerle.** Quella
  tendina elenca gli *stili* delle diete approvate (`catalog.service.styles`) e la variante senza
  glutine ha lo stesso stile della Mediterranea — `mediterranean` — perché è la stessa impostazione
  nutrizionale. La differenza sta nella **famiglia** (`dietFamily`), che è il campo «nome dieta» dove
  lui infatti leggeva «Mediterranea senza glutine».
  - Nell'elenco clienti ora c'è una **pastiglia «senza glutine»** accanto al nome, con due stati: se
    la dieta dedicata è assegnata è pulita, se è stata dichiarata ma la dieta è un'altra c'è un ⚠️ e
    il passaggio del mouse dice quale dieta ha davvero. È la distinzione che serve dopo un'assegnazione
    in blocco: chi è a posto e chi aspetta ancora.
  - Nuovo filtro **«Glutine»** con due voci: chi l'ha dichiarato, e — quella utile — chi l'ha
    dichiarato **senza avere la dieta dedicata**. Dopo aver generato la variante, quello è l'elenco
    delle clienti da sistemare.
- `[Sviluppo]` 🌾 **Chi dichiara il glutine riceve la dieta senza glutine, e glielo diciamo** —
  richiesta di Simone del 9/8, nei due versi: da qui in avanti in automatico, e per **chi è già
  iscritto** con una notifica e il cambio.
  - Scatta da tre punti: il **questionario** (appena salvato, prima della base personale — che si
    costruisce sulla dieta, e costruirla su quella sbagliata vorrebbe dire rifarla), la **scheda
    cliente** quando la coach aggiunge l'intolleranza, e lo script per lo storico. Un'unica funzione
    (`menu/senza-glutine.ts`) usata da tutti e tre: la stessa decisione scritta in tre posti diventa
    tre decisioni diverse entro un mese.
  - **La regola che regge tutto: non si promette una dieta che non c'è.** Assegnare vuol dire
    scrivere `dietFamily`, e da lì il motore abbina la variante; ma `pickDietFor` ha una catena di
    ripieghi, e se la variante senza glutine non è in catalogo scende a una dieta **col glutine**,
    senza errori. Quindi l'ordine è: serve? · la variante approvata esiste per il suo regime e numero
    di pasti? · **solo allora** si scrive e si avvisa. Se manca, non si scrive niente, alla cliente
    non si dice niente e nasce una segnalazione per la nutrizionista.
  - Riconoscimento volutamente **stretto**: `glutine`, `gluten`, `celiac`. NON i singoli cereali —
    «farro» fra i cibi non graditi vuol dire «non mi piace il farro», e cambiare la dieta per quello
    sarebbe decidere al posto della cliente su un dato che dice un'altra cosa. Vale sia fra le
    allergie sia fra le intolleranze sia nel testo libero.
  - Il messaggio alla cliente dice cosa cambia (riso, mais, grano saraceno, quinoa, patate, legumi al
    posto di pane e pasta di frumento) e **non promette la certificazione**: noi scegliamo gli
    ingredienti, non garantiamo la filiera né l'assenza di contaminazione. Chi è celiaca legge di
    usare prodotti certificati e di parlarne con la nutrizionista.
  - Se la cliente ha **giornate già erogate** da oggi in avanti, quelle hanno ancora il glutine
    dentro: si conta e si apre una segnalazione perché vanno rigenerate («Rigenera menu» dalla
    scheda). Senza questa riga la cliente riceve «il tuo piano è senza glutine» e per tre giorni
    mangia pasta di grano.
  - Per lo storico: **`npm run assegna:senza-glutine`** — dry-run che elenca chi verrebbe cambiata e
    dice subito se la variante approvata esiste (se non esiste, il lancio non serve a niente e lo
    scrive), `CONFERMA=1` per assegnare e avvisare. Usa la stessa funzione del prodotto.
  - +28 test, fra riconoscimento, testo del messaggio e i casi dell'assegnazione (variante mancante,
    già assegnata, giornate da rifare).

- `[Sviluppo]` 🌾 **«Mediterranea senza glutine» pronta da generare** — alla domanda «abbiamo una
  dieta gluten free?» la risposta era no, e per una ragione scritta: il documento delle regole
  suggerite mette il «senza glutine a scopo terapeutico» fra gli stili **esclusi**, perché la
  celiachia richiede diagnosi e follow-up. Questa variante non cambia quella posizione — è una
  Mediterranea che **non usa fonti di glutine**, per chi lo evita per intolleranza non celiaca o per
  scelta — ma toglie alla nutrizionista il lavoro di partenza.
  - Non è servito codice nuovo: le **note cliniche di un preset finiscono letteralmente nel prompt**
    del generatore (`generaRicetteDiUnPasto`). Il vincolo è scritto lì, in italiano, con l'elenco
    dei cereali vietati **e di quelli ammessi** — riso, mais, grano saraceno, quinoa, miglio,
    amaranto, teff, patate, castagne, legumi e la loro pasta. L'elenco delle alternative è la parte
    che decide se il menu sarà vario o sarà riso ogni giorno.
  - Le `rules` sono **identiche alla Mediterranea**: togliere il glutine non cambia la ripartizione
    dei macro né le tolleranze, e inventare numeri diversi vorrebbe dire scostarsi dalle linee guida
    senza motivo. L'etichetta invece è diversa, e non per estetica: il generatore cerca la famiglia
    per (etichetta, stile, regime, obiettivo), quindi un nome nuovo è ciò che le dà **ricette
    proprie** invece di agganciarla a quelle della Mediterranea, che il glutine ce l'hanno.
  - Nelle note ci sono anche le due cose che si dimenticano: **l'avena solo se certificata** senza
    glutine, e la **fibra** — i sostitutivi senza glutine ne hanno meno dei prodotti integrali,
    quindi legumi, verdura e pseudocereali vanno usati di più.
  - ⚠️ Scritto nel preset perché lo legga chi valida: **non è un prodotto certificato senza
    glutine.** Si escludono gli ingredienti, non si garantisce la filiera né l'assenza di
    contaminazione. Per una cliente celiaca serve la validazione della nutrizionista e l'indicazione
    di prodotti certificati.
  - Il preset arriva col **seed**, quindi compare nel generatore dopo il deploy senza lanciare
    niente, col flag «suggerita». +24 test sulle note: non sono documentazione, sono l'istruzione
    che governa la generazione, e accorciarle romperebbe il vincolo in silenzio.

- `[Sviluppo]` 🕛 **Il CI era rosso per il fuso orario, non per il codice** — dal commit delle 00:09
  in avanti il job «Backend · build + test» falliva: 11 prove su 984, in `menu.service.spec`,
  `notifications.service.spec` e `signals.service.spec`. Il type-check passava, e i commit
  precedenti della stessa serata erano verdi.
  - Il motivo, leggendo il log: i test costruivano «oggi» con `new Date().toISOString()`, cioè il
    giorno **UTC**, mentre il prodotto usa il giorno del fuso **aziendale** (`Europe/Rome`, vedi
    `common/date-only.ts`). Fra le 22:00 e le 24:00 UTC — cioè fra mezzanotte e le 2 in Italia —
    i due giorni non coincidono: il servizio erogava il menu del 9 e il test si aspettava quello
    dell'8. Le prove erano dunque **fragili due ore al giorno**, e lo sono state per mesi senza che
    si vedesse: nessuno pusha a quell'ora.
  - Corretti i tre file usando gli helper del prodotto (`giornoLocale`, `toDateOnly`) invece di
    ricalcolare la data: è la stessa lezione che `date-only.ts` racconta per le misure (una pesata a
    mezzanotte finiva sul giorno prima e sovrascriveva quella vera).
  - La correzione è stata **verificata riproducendo l'ora del guasto**, non a occhio: girando la
    suite con `APP_TIMEZONE` spostato di un giorno (`Pacific/Kiritimati`) le tre suite fallivano
    prima e passano dopo. Un modo per rifare la prova a qualsiasi ora, senza aspettare mezzanotte.

- `[Sviluppo]` 📲 **OTA 2.1.3** — porta sui telefoni il lato app del cambio menu in chat, che finora
  esisteva solo nel backend: il pulsante **«Sostituisci un ingrediente»** della home non apre più il
  pop-up «oggi / questi giorni / per sempre» ma **porta nella chat con Gaia**, che scrive lei il
  primo messaggio (elenca i piatti di oggi e chiede quale alimento cambiare); e nel Menu la
  sostituzione si legge coi grammi e con **l'unità giusta per parte** («70 ml panna fresca → 70 g
  burro»), che mentre si cucina è l'unica cosa che serve sapere.
  - Tre verifiche fatte sul bundle prima della pubblicazione, tutte sull'archivio già costruito:
    ① il numero **`"2.1.3"` è dentro `assets/index-*.js`**, quindi l'app mostra la versione che
    esegue davvero — è l'errore che è costato la 2.1.1, dove sui telefoni compariva «2.1.0»;
    ② **`app/package.json` allineato a 2.1.3** e incluso nel commit (senza quello i due numeri
    tornano a divergere); ③ **le push sono accese**: nel bundle c'è il codice di
    `PushNotifications` e *non* c'è la stringa «bundle costruito SENZA google-services.json»,
    segno che `__ENABLE_PUSH__` era vero al build e il ramo di rinuncia è stato eliminato dal
    minificatore. Un bundle costruito senza quel file spegne le notifiche a chi lo riceve, in
    silenzio e senza errori: è la ragione della guardia in `ota-release.mjs`.
  - Per provarlo in mano c'è **`npm run collaudo:menu-panna -- <email>`**: prepara sul proprio
    profilo la giornata di oggi con «Pasta alla panna (collaudo)» — panna fresca **70 ml**, che è
    il caso che fa emergere l'unità sbagliata — e il gruppo di equivalenza approvato senza cui il
    cambio non partirebbe affatto. Dry-run per default, `PULISCI=1 CONFERMA=1` per rimuovere tutto:
    il gruppo è globale e finché resta vale anche per le altre clienti.
  - **Collaudata sul telefono la notte del 9/8**, giro completo: il pulsante apre la chat, Gaia
    chiede il motivo, il cambio entra nel menu. E il «no» ha fatto quello per cui è nato — «aspetta,
    non voglio lasciarti la panna nel piatto se non la vuoi: dimmi cos'è che non ti va» — invece di
    chiudere la conversazione. Tre difetti visti in schermata (un errore di genere nel testo, la
    controproposta della cliente non riconosciuta, e la conversione ml→g non ancora verificata perché
    il sostituto proposto era l'olio) sono annotati in `progetto/DA_FARE.md`, punto 4.
  - I telefoni lo applicano **al riavvio dell'app**, non mentre è aperta.
  - ⚠️ Alla prossima pubblicazione sugli store va **svuotata `OTA_VERSION`** su Render: altrimenti
    un'installazione fresca scarica un bundle più vecchio del nativo appena installato.
- `[Sviluppo]` 🚨 **Il filtro allergeni non riconosceva i derivati: Gaia ha proposto burro a una
  cliente allergica al latte** — trovato la sera dell'8/8 leggendo il `diag:cliente` di Giusy, che ha
  `allergies: ['latte']`. Nella conversazione di quel pomeriggio Gaia le proponeva **70 g di burro**
  al posto della panna. **L'ha fermata lei, dicendo no.**
  - Il motivo è piccolo e va ricordato: il filtro cerca le parole chiave dell'esclusione dentro il
    nome dell'alimento proposto, e `expandExclusion('latte')` restituiva **solo «latte»** — parola
    che in «burro» non c'è. `INTOLERANCE_MAP` aveva `lattosio` e `latticini` ma **non `latte`**,
    cioè proprio il termine con cui l'allergene si chiama nell'elenco UE e con cui il questionario
    lo salva.
  - Secondo buco sullo stesso profilo: le sue intolleranze dicono **`lactose`**, in inglese, e
    nessuna chiave lo riconosceva. Aggiunta una tabella di **alias** (`milk`, `dairy`, `gluten`,
    `nuts`, `peanuts`, `soy`, `fish`, `shellfish`, `eggs`, `sesame`…): un allergene scritto in una
    lingua che la mappa non conosce si comporta come un'esclusione che non c'è, e non produce
    nessun errore — quindi non se ne accorge nessuno finché non lo racconta una cliente.
  - Completati anche gli altri elenchi (glutine, frutta a guscio, pesce, uova, molluschi, sesamo,
    arachidi) e allineati i derivati del latte al dizionario UE scritto con la nutrizionista, con un
    **test che fallisce se i due elenchi divergono**: sono in due file, e il buco di stasera nasce
    esattamente da un divario del genere. +17 test, con lo scenario di Giusy scritto per nome.
  - ⚠️ **Da guardare dopo il deploy**: più esclusioni vuol dire meno ricette utilizzabili. Su una
    cliente allergica al latte il pool si restringe davvero — è corretto, ma va verificato che non
    diventi un «piano bloccato»: `npm run diag:cliente -- <email di Giusy>` e si guardano le
    giornate erogate.
- `[Sviluppo]` 👥 **Tabella clienti: filtri, riordino e colonna Coach** — richiesta della mattina
  dell'8/8 che era rimasta indietro. L'elenco clienti aveva una sola casella di ricerca e nessun
  ordinamento; per sapere di chi era una cliente si aprivano le schede una per una.
  - Intestazioni **cliccabili** per ordinare (nome, email, coach, stato, iscrizione) e riga di
    **filtri** sotto le intestazioni, come nella board dei lead: coach (compreso «— non assegnata —»,
    che è il filtro che serve davvero) e stato. Più «Azzera filtri» e il contatore «N di M».
  - Nuova **colonna Coach** (`listClients` ora restituisce la coach assegnata) e il nome del
    profilo come ripiego quando l'anagrafica è vuota: prima quelle righe mostravano «—» pur avendo
    il nome nel profilo.
  - Corretto un difetto trovato strada facendo: `total` era `items.length`, cioè **500 sia con 500
    clienti sia con 900**. Ora il conteggio è una query a parte e, se il tetto viene raggiunto, la
    tabella lo dice — filtrare 500 righe credendole tutte è il modo di concludere che una cliente
    «non c'è».
  - Il filtro qui resta **nel browser** (le clienti sono centinaia, non decine di migliaia come i
    lead): la scelta è motivata nel file, insieme al segnale che dirà quando spostarlo sul server.
- `[Sviluppo]` 🧾 **Log delle modifiche del lead: cambi da backoffice E cambi dall'app** — la
  domanda dell'8/8 era «nel log modifiche del lead segnamo anche i cambi dati da backoffice? e i
  cambi da app?». La risposta era **no due volte**, in due modi diversi: dal backoffice l'audit
  esisteva ma registrava **tre campi su diciassette** (nome, email, valore) e **non era visibile da
  nessuna parte** — nella scheda lead c'erano solo lo storico stati e le note; dall'app la riga di
  log c'era ma non diceva *che cosa* fosse cambiato.
  - Nuova card **«Modifiche ai dati»** nella scheda lead: chi, quando, e **campo per campo**
    «prima → dopo» in italiano, con l'importo in euro, i tag come elenco e i sì/no leggibili. Una
    pastiglia dice se è stata **la cliente dall'app** o una persona dello staff: sono due cose
    diverse, e una modifica della cliente non è l'errore di un'operatrice.
  - Il diff sta in `backend/src/common/diff-campi.ts` (+11 test) con le regole che evitano un log
    che mente: si registrano solo i campi **presenti nella richiesta** e solo quelli **davvero
    cambiati**; vuoto, `null` e spazi sono la stessa cosa; i tag si confrontano per contenuto e non
    per ordine. Un salvataggio che non cambia niente non lascia righe.
  - Le modifiche fatte dalla scheda lead ora compaiono **anche nel log della scheda cliente**:
    mancavano dall'elenco delle azioni, quindi non si vedevano da nessuna delle due parti.
  - Il percorso della rotta (`GET /crm/leads/:id/audit`) è fissato da un test: scrivendolo a mano
    nel front-end l'avevo sbagliato, e un percorso sbagliato lì è un 404 che l'utente legge come
    «il log non funziona».
- `[Sviluppo]` 💸 **Il piano attivato a mano non gonfia più il fatturato — questa volta davvero** —
  la correzione precedente teneva pulito il **conto economico** (nessuna riga di ricavo nel ledger)
  ed era incompleta: **i grafici del fatturato non leggono il ledger**, sommano
  `payment.amountCents` di tutti i pagamenti approvati (`analytics.service.ts`, e la dashboard fa
  lo stesso). Il piano del socio da €130 restava dentro «Fatturato / mese» e «Fatturato cumulato».
  Secondo richiamo di Simone sullo stesso punto: «va registrato a costo 0, lo avevo già detto».
  - L'attivazione dalla scheda cliente ora **registra importo 0**. Il listino non si perde: sta
    nella descrizione del pagamento («attivazione interna, senza incasso (listino 130,00 €)») e
    nell'audit, con entrambi i numeri. Un'unica verità per tutte le somme, invece di un'eccezione
    da ricordarsi in ogni punto che conta i soldi.
  - **Nessuna provvigione**: senza incasso non c'è niente da cui pagarla, e il quadratino «Genera
    le provvigioni» è stato **tolto** dal modale della scheda — mostrarlo e ignorarlo sarebbe stato
    peggio. Chi ha incassato davvero registra la vendita da **Acquisti**, dove la scelta resta.
  - Registrare 0 aveva tre effetti collaterali nascosti, tutti dietro lo stesso
    `if (amountCents === 0)`: l'attivazione passava per una **prova**. Chiusi tutti e tre e
    protetti da test: niente evento di funnel (falsava i tassi di conversione del lancio), il CRM
    non si tocca (la cliente sarebbe retrocessa a «Prova» e alla coach sarebbe arrivato «ha attivato
    la settimana di prova»), e la **durata resta quella del piano** — la rete di sicurezza degli 8
    giorni sui piani gratuiti ora guarda il prezzo di listino, non l'importo registrato.
  - Per i pagamenti già registrati: **`npm run fix:attivazioni-manuali`**. Elenca le attivazioni
    manuali approvate con importo > 0, dice quello che sa l'audit sull'origine di ognuna, e azzera
    **solo gli id indicati** (`CONFERMA=1 PAGAMENTI=<id>,<id>`). Non azzera in blocco per una
    ragione precisa: `method: 'manual'` comprende anche le **vendite vere** registrate da Acquisti,
    e farle sparire dai libri sarebbe un danno peggiore di quello che si sta riparando. Serve per
    far tornare veri i grafici di oggi: il codice nuovo vale da qui in avanti.
- `[Sviluppo]` 📅 **I menu dei piani vecchi si possono aprire** — in scheda cliente la finestra
  dei menu era fissa (ultimi 56 giorni + 7 avanti): di una cliente al secondo o terzo percorso
  **lo storico non era raggiungibile da nessuna parte**. Ora in Acquisti c'è **un pulsante per
  ogni piano** — non solo per quello corrente — e premendolo si aprono i menu erogati in quel
  periodo, con le stelline che aveva dato ai piatti. Il piano principale sta per primo ed è
  evidenziato; dentro il popup si legge di quale piano si stanno guardando i menu e c'è la strada
  di ritorno («Periodo corrente»).
  - `GET /admin/clients/:id/menus` accetta `from`/`to`. Senza periodo **la finestra è identica a
    prima**: la vista di ogni giorno non cambia. Il tetto è **400 giorni**, perché il piano più
    lungo in vendita è 12 mesi e i suoi menu vanno aperti tutti; date invertite, mezzo periodo o
    un periodo smisurato vengono rifiutati con una frase leggibile, non trasformati in una query
    enorme. Le regole stanno in `backend/src/clients/finestra-menu.ts`, isolate per poterle
    verificare senza istanziare il servizio (+10 test).
  - `getDetail` restituisce anche l'elenco dei piani (`subscriptions`: nome, stato, periodo). Il
    prezzo resta fuori: non serve a questo pulsante.
- `[Sviluppo]` 🗣️ **Quando la cliente dice «no», Gaia indaga invece di fermarsi** — da una
  conversazione vera dell'8/8. Gaia proponeva «70 ml di burro al posto di 70 ml di panna fresca»,
  la cliente rispondeva «no perché non voglio 70 gr di burro» e Gaia chiudeva con «va bene, non
  cambio niente»: corretto e inutile, perché la panna nel piatto restava. **Un «no» alla proposta
  non è un «no» al cambio**: quasi sempre vuol dire *non quel sostituto*.
  - Se il «no» **nomina il sostituto** o porta un motivo («non mi piace», «non ce l'ho in casa»),
    Gaia propone **subito l'alternativa successiva** con le stesse regole di sicurezza — allergeni
    ed esclusioni non diventano accettabili perché è la seconda proposta — e non ripropone quello
    già scartato. Il motivo del cambio resta quello di prima: non è cambiato il perché.
  - Se il «no» è **secco**, chiede: 1) questo sostituto no, proponimene un altro · 2) preferisco
    cambiare tutto il piatto · 3) ho cambiato idea. «No, lascia stare» resta un annullamento, ed è
    l'unico caso in cui si chiude.
  - **Finite le alternative** la richiesta passa alla nutrizionista con l'elenco di cosa è stato
    rifiutato, non alla rinuncia. Due risposte incomprensibili di fila passano alla coach.
  - Gli alimenti scartati restano **nella conversazione**, non nei cibi non graditi del profilo:
    quel campo restringe i menu futuri, e un'alternativa rifiutata non è un gusto dichiarato su
    quello che ha nel piatto.
- `[Sviluppo]` ⚖️ **«70 ml di burro» non lo dice più** — l'unità del sostituto veniva copiata da
  quella dell'ingrediente sostituito, e su una coppia liquido → solido è sbagliata (l'ha notato la
  cliente prima di noi). Ora da `ml` verso un solido si passa a `g`; fra due liquidi resta `ml`;
  `cl`, `dl` e `l` non si toccano, perché lì tenere lo stesso numero cambiando unità
  moltiplicherebbe la porzione per dieci. L'unità corretta arriva **fino al menu scritto** e alla
  tabella della nutrizionista, non solo alla frase in chat.
- `[Sviluppo]` 🔒 **Sui dati personali Gaia dice che non li vede** — fatture, pagamenti, contratto,
  anagrafica, richieste privacy e cancellazione account finivano nel ramo generico («Bella
  domanda! L'ho girata alla tua coach»): vero, ma sembra una scelta di non rispondere. Ora la
  risposta dice **«ai tuoi dati personali e amministrativi non ho accesso»**, indica la coach e
  conferma che il messaggio è già partito — e arriva comunque nel thread della coach, quindi non si
  perde niente. Questa frase **non passa dall'AI generativa** quando verrà accesa: un modello che
  riformula «non ho i tuoi dati» rischia di rispondere come se li avesse. I temi sensibili restano
  davanti a tutto (+10 test).
- `[Sviluppo]` 📝 **`progetto/DA_FARE.md`** — lista unica delle richieste memorizzate e non ancora
  implementate, ognuna col posto dove va e la decisione che manca: revoca del consenso con
  cancellazione a 30 giorni, il «?» sulla dieta nel profilo, filtri e colonna coach nella tabella
  clienti, log modifiche del lead, correzione di un cambio piatto da parte della nutrizionista.
- `[Sviluppo]` 🍳 **«Voglio una colazione proteica» adesso funziona, dalla richiesta al report.**
  Il cuore era già consegnato; questo è il collegamento, e chiude il caso della conversazione dell'8/8.
  **Il punto esatto in cui Gaia perdeva la richiesta** era il «no» alla conferma. La cliente aveva
  scritto «no, voglio una colazione proteica»: un rifiuto **e** una richiesta nuova, e noi rispondevamo
  soltanto «va bene, non cambio niente» — corretto e inutile, perché la richiesta era già arrivata.
  Ora quel «no» viene riletto: se contiene una richiesta di piatto diverso, il dialogo continua invece
  di chiudersi. Un «no» secco resta un no (c'è il test).
  **Da dove pesca le alternative:** solo dalla **base personale certificata** (`client_menu_pool`),
  che è il catalogo già passato dai filtri di sicurezza. Se quel pool non c'è **non propone niente** e
  passa alla nutrizionista: significa che il piano non è certificato, e pescare dai template
  salterebbe i controlli sugli allergeni per proporre una colazione. Nessuna colazione vale quel rischio.
  La tolleranza sulle kcal la legge da `menu_kcal_balance_tolerance_pct` — la **stessa** con cui il
  motore bilancia le giornate, perché due tolleranze diverse per la stessa cosa sarebbero due verità.
  **E il requisito che si dimentica** («i cambi vanno salvati nella scheda cliente e nel report di
  fine mese»): il cambio **non** è una riscrittura del `recipeId`, è un evento registrato in
  `MealSnapshot.cambioPiatto` — piatto vecchio, kcal vecchie, cosa aveva chiesto, `da_verificare`.
  Senza quel record il piatto vecchio non lascerebbe traccia e in scheda non comparirebbe niente.
  Da lì arriva in due posti: la **scheda cliente**, nella stessa tabella dei cambi di ingrediente ma
  con un'etichetta «piatto» che li distingue a occhio (la nutrizionista non guarda «ha cambiato
  l'olio» e «ha cambiato la colazione» con la stessa attenzione, e fra due piatti le grammature non
  vogliono dire niente); e il **report di fine mese**, come `cambiInChat`. Nel report si contano
  **solo** i cambi con `origine: 'chat'`: le altre sostituzioni le decide il motore per sicurezza, e
  spacciarle per «adattamenti che hai chiesto tu» sarebbe raccontarle una cosa falsa. Zero cambi è un
  numero legittimo e ha una frase sua, che non fa sembrare che sia mancato qualcosa.
  Il finto database dei test è stato **estratto in una fabbrica** condivisa: due copie dello stesso
  Prisma finto divergono, e a quel punto i due gruppi di test misurano due mondi diversi.
  905 test verdi (12 nuovi fra dialogo e conteggio), type-check identico al baseline su backend e
  backoffice.
  ⚠️ Resta da fare, e non è banale: la **correzione del nutrizionista** su un cambio di piatto (oggi
  può solo vederlo), e il caso «lo voglio diverso» quando la cliente non dice **quale** pasto e non se
  ne stava già parlando — lì Gaia torna a chiedere invece di indovinare, che è giusto ma si può fare
  meglio.

- `[Sviluppo]` 💚 **Gaia chiama per nome.** Richiesta di Simone (8/8): «Gaia non potrebbe rispondere
  chiamando per nome la cliente?». Sì, e cambia il tono di tutta la conversazione — ma il modo
  sbagliato di farlo è peggio del non farlo, quindi tre regole: **una volta per messaggio** e in
  testa alla frase, **solo il nome proprio** (mai il cognome: «Ciao Maria Grazia Cerchiara» è una
  raccomandata), e se il nome non c'è **la frase deve restare identica e corretta**.
  Da dove viene il nome: prima `clientProfile.name` — quello con cui vuole essere chiamata — e poi
  `user.firstName`. Il ripiego non è teorico: `sistema:nomi` **svuota** l'alias quando è uguale al
  nome completo, quindi da oggi quel campo è null per parecchie clienti e senza il ripiego Gaia le
  chiamerebbe tutte per «niente».
  Un test ha trovato subito un difetto che rileggendo non avevo visto: togliendo il nome la frase
  cominciava **in minuscolo** («per cambiare un alimento mi serve…»). Da lì `apreFrase`, che sposta
  la maiuscola invece di lasciare un buco. È il genere di dettaglio che non si vede in nessun log:
  lo vede solo la cliente, in chat.
  Scartati per scelta: nome nei messaggi di errore tecnico (suona finto) e nel testo delle
  segnalazioni cliniche (là serve chiarezza, non calore).

- `[Sviluppo]` 🍳 **Cambiare il PIATTO, non l'ingrediente: le decisioni, con i test.** La
  conversazione girata da Simone l'8/8: la cliente rifiuta la sostituzione dell'ingrediente e scrive
  «no, voglio una colazione proteica», poi «lo voglio diverso». Gaia risponde «Puoi dirmi di più?
  Stai cercando di cambiare qualcosa nel tuo menu, nelle abitudini, o nell'approccio al
  dimagrimento?» — una risposta da modulo davanti a una richiesta chiarissima.
  Il motivo non è l'intelligenza, è il **codice**: il dialogo sapeva fare una cosa sola, scambiare un
  ingrediente con uno equivalente dalla mappa sicura. «Una colazione proteica» è un'altra cosa: è un
  **altro piatto**. E la stessa radice spiega anche la proposta precedente, «40 g di olio evo al
  posto di 40 g di burro di macadamia»: corretta a pari grammatura, sbagliata come colazione — la
  regola «stessi grammi» conserva le calorie e non sa cosa sia un pasto.
  `menu/cambio-piatto.ts` (nuovo, puro, 17 test) contiene le decisioni:
  **le calorie non si toccano** (fuori dalla tolleranza il piatto è scartato, non penalizzato: una
  colazione da 340 kcal non diventa una da 700 perché è più proteica — è il vincolo che rende la
  proposta accettabile senza il nutrizionista); si cerca **solo dentro le ricette approvate per
  quella cliente**; «proteica» **pretende** più proteine di adesso, e una ricetta senza macro
  dichiarate non può essere proposta come proteica; il piatto attuale e quelli che ha già oggi negli
  altri slot non sono alternative; a parità vince chi resta più vicino alle calorie di partenza; e se
  non c'è niente dentro le calorie **lo si dice e si passa alla nutrizionista**, invece di proporre
  qualcosa fuori piano.
  Anche qui un test ha fatto il suo lavoro: il riconoscimento dell'intenzione era troppo generoso e
  «quando arriva il menu **nuovo**?» diventava una richiesta di cambiare piatto. Ora l'aggettivo vale
  solo accanto a un pasto o dentro una frase di volontà; «proteica» invece basta da sola, perché in
  una chat sul menu non vuol dire altro.
  ⚠️ **Non è ancora collegato al dialogo**: il pezzo che manca è pescare i candidati dalla base
  personale certificata (`client_menu_pool`), il passo «scegli 1 o 2» e la scrittura sulla giornata.
  E, richiesta di Simone nella stessa sessione, il cambio di piatto deve **finire in due posti**: la
  **scheda cliente** — accanto ai cambi di ingrediente già elencati, con lo stesso `da_verificare`,
  perché è la nutrizionista a ricontrollarlo — e il **report di fine mese**, dove il numero dei cambi
  è un dato di personalizzazione (è il punto 5 di `PROGETTO_gaia-cambio-menu.md`). Quindi il cambio
  non può essere solo una riscrittura del `recipeId`: va **registrato** come evento, o in scheda e nel
  report non comparirà mai.
  Consegnato a parte di proposito: quella parte **scrive nel menu di una cliente**, e a fine di una
  giornata così va scritta e verificata con la testa fresca, non aggiunta di corsa.
  893 test verdi, type-check identico al baseline.

- `[Sviluppo]` 🧹 **Le segnalazioni già orfane si adottano: `npm run fix:segnalazioni`.**
  La correzione di prima vale da adesso; le righe scritte prima restano senza destinatario e senza
  che nessuno le abbia mai ricevute. Sono le più vecchie, quindi le peggiori.
  Lo script prende ogni segnalazione `open`/`in_progress` con `assignedToId` vuoto, la assegna e
  manda le notifiche — «Nutrizionista richiesto» alla coach compresa. Non chiude niente e non cambia
  stato: una segnalazione la si chiude quando è stata gestita, e a deciderlo è una persona.
  Per non far divergere due copie della stessa logica ho **estratto** da `apriSegnalazione` due
  funzioni, `decidiDestinatari` e `avvisaSegnalazione`, e lo script usa quelle. Se domani cambia la
  regola di instradamento, cambia in un posto solo.
  Chi non è assegnabile viene elencato a parte: vuol dire che manca la **persona** che risponde di
  quel ruolo, ed è un problema di organico che nessuno script risolve inventando un nome.
  **La cosa più utile l'hanno detta i test.** Estraendo la decisione l'avevo messa *prima* della
  `create`, senza protezione: sette test sono diventati rossi e mi hanno mostrato che così **la
  segnalazione diventava ostaggio del suo instradamento** — tre letture in più che, se fallivano,
  facevano sparire l'allarme invece di lasciarlo orfano. In produzione sarebbe stato un intoppo del
  database al posto di un allarme clinico. Ora la decisione può fallire e si va avanti; la `create`
  no. È un contratto **migliore** di quello di prima, dove un errore sul profilo annullava tutto: due
  test nuovi lo fissano, e quello vecchio è stato riscritto invece di essere adattato.
  Nei finti database di `signals` ed `engine` mancava la tabella `staff`: completati. In quello di
  `signals` c'erano anche **due chiavi `notification`** nello stesso oggetto — in JS vince la seconda,
  quindi `updateMany` era scomparso e nessuno se n'era accorto perché ts-jest ha le diagnostiche
  spente. Unite: è il tipo di errore che solo `tsc` vede.
  870 test verdi, type-check identico al baseline.

- `[Sviluppo]` 🔐 **«Admin vede tutto» non funzionava, e la colpa era di un secondo cancello.**
  Simone l'ha dovuto segnalare **due volte**: in scheda cliente, da admin, leggeva ancora «Nessuna
  conversazione visibile per il tuo ruolo» — la seconda volta aggiungendo che la cliente aveva usato
  la chat cinque minuti prima. Aveva ragione, e la mia prima diagnosi («allora non ha thread») era
  sbagliata.
  Il ramo per l'admin in `ChatService.assertThreadAccess` era corretto e funzionava. Ma i cancelli
  qui sono **due**: prima la rotta, poi il servizio. E il controller che ho scritto io stamattina
  diceva `@Roles('coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist')` — **senza
  `admin`**. Quindi 403 sul guardiano della rotta, prima che il servizio potesse dire la sua.
  Aggiunto `admin` alla rotta (`sales` resta fuori: vede il commerciale, non il clinico).
  **Ma il difetto che ha reso tutto questo difficile da vedere è un altro**, ed è quello che mi
  interessa di più: nella card delle conversazioni il `.catch` della chiamata faceva
  `setThreads([])`. Cioè **un errore diventava «nessuna conversazione»**. Un 403 travestito da elenco
  vuoto, senza un banner, senza una riga in console: il messaggio accusava il ruolo di chi guardava,
  che è precisamente la spiegazione sbagliata. E il banner d'errore stava *dentro* il ramo «ci sono
  conversazioni», quindi con l'elenco vuoto non poteva comparire nemmeno volendo. Ora l'errore si
  vede, il 403 ha un messaggio suo, e il testo del caso vuoto non dà più la colpa al ruolo quando il
  ruolo vede tutto.
  Test nuovo `guardie-rotte.spec.ts`: legge i **decoratori** del controller e pretende `admin`
  dentro, `sales` e `client` fuori. È l'unico modo di vedere questa classe di errori senza avviare
  l'app — gli 864 test di prima erano tutti verdi mentre la funzione non funzionava, perché
  guardavano i servizi e nessuno guardava le guardie.
  **La lezione, che vale oltre il caso:** *quando un permesso sembra non funzionare, i posti da
  guardare sono due — chi può bussare e cosa può leggere.* E: *un `catch` che finge un risultato
  vuoto nasconde esattamente gli errori che stai cercando.*
  868 test verdi, type-check pulito su backend e backoffice.

- `[Sviluppo]` 🚨 **Le due segnalazioni che nascevano mute, e «nutrizionista richiesto» alla coach.**
  `apriSegnalazione` esisteva già e faceva la cosa giusta, ma **due punti la scavalcavano** ancora,
  scrivendo la riga a mano con `assignedToId: profile?.assignedNutritionistId` — vuoto per quasi
  tutte, perché una nutrizionista assegnata non ce l'ha nessuna — e **senza avvisare nessuno**:
  `signals.service.ts` (calo rapido) e `engine.service.ts` (guardrail di sicurezza). Sono le due
  cliniche, cioè le uniche che non possono aspettare.
  Trovato dal caso di Giusy: **«Calo rapido: 2,87 kg/settimana»** — soglia 1.5,
  quindi quasi il doppio — aperta il **22 luglio** e ancora lì, non assegnata, mai notificata. Tre
  settimane. Il motore aveva fatto il suo lavoro: mancava il destinatario. Un guardrail che nessuno
  riceve è un guardrail spento.
  Entrambi passano ora da `apriSegnalazione`, con `dedupe: false` perché il loro controllo è **più
  fine** di quello per categoria: guarda il motivo (`Calo rapido`, `reasonKey`), e col dedupe per
  categoria una clinica già aperta per un altro motivo avrebbe zittito la nuova.
  **E la regola nuova di Simone**, che cambia il destinatario: oggi c'è **un solo** nutrizionista (il
  capo) e nessuna cliente ne ha una assegnata, quindi «quando necessario un nutrizionista segnaliamo
  alla coach con "nutrizionista richiesto" così aiutano nella gestione». La coach una notifica la
  riceveva già, ma col titolo della categoria («Sicurezza clinica»), che le dice **cosa è successo**
  e non **di chi è la palla**. Ora, quando il ruolo primario è il nutrizionista e non c'è nessuno
  assegnato, alla coach arriva **«Nutrizionista richiesto»** col motivo nel corpo e
  `nutrizionistaRichiesto: true` nel payload (lo leggono backoffice e app staff); al capo
  nutrizionista arriva la segnalazione normale. Se una nutrizionista c'è, tutto torna come prima e il
  capo non viene disturbato.
  ⚠️ Vale da adesso: le segnalazioni **già aperte** restano non assegnate. Serve una riparazione per
  quelle — Giusy ne ha due, dal 17 e dal 22 luglio.
  3 test nuovi sull'instradamento nei tre casi. 864 test verdi, type-check identico al baseline.

- `[Sviluppo]` 🧾 **Un piano attivato a mano dalla scheda non entra più in contabilità.**
  Segnalazione di Simone dell'8/8: aveva attivato a mano il percorso del socio (€130) dalla scheda
  cliente, e in contabilità comparivano **€130 di ricavi mai incassati**. «Se lo attivo a mano da lì
  non deve andare in contabilità.»
  Il trabocchetto: la scheda cliente e la pagina **Acquisti** chiamano lo **stesso** endpoint
  (`POST /admin/purchases`), e da Acquisti si registrano **vendite vere** avvenute fuori dal negozio
  — un bonifico gestito a mano. Escludere tutte le attivazioni manuali avrebbe fatto sparire quegli
  incassi dai libri: un errore peggiore di quello che stavamo correggendo, e nella direzione in cui
  nessuno controlla.
  Quindi la distinzione è **da dove arriva l'attivazione** (scelta di Simone): `origine:
  'scheda_cliente'` → attivazione interna (omaggio, staff, socio, prova), il piano si attiva davvero
  ma **non** scrive ricavi; `origine: 'acquisti'` (default) → vendita vera, contabilizzata come
  sempre. Nessuna casella da ricordarsi di spuntare: il posto da cui si preme *è* la scelta.
  Il default contabilizza **di proposito**: un chiamante che non passa il campo non deve far sparire
  in silenzio un incasso vero.
  Tecnicamente basta non scrivere la riga nel `ledgerEntry` — il conto economico legge quello, non i
  pagamenti — e il `payment` resta a documentare che l'attivazione c'è stata e chi l'ha fatta.
  Nell'audit finiscono `origine` e `contabilizzato`: se un domani un ricavo non torna, c'è scritto se
  quella attivazione doveva entrare nei conti.
  Nel modale è stato corretto anche il testo, che diceva «con il pagamento registrato come già
  incassato»: era vero, e per questo era il problema. Ora c'è un avviso esplicito, perché è l'unico
  punto in cui si può capire **prima** di premere.
  4 test nuovi che tengono ferma la distinzione nei due versi, incluso il caso «senza `origine`».
  861 test verdi, type-check identico al baseline.
  ⚠️ Resta da sistemare a mano la riga già scritta per il piano del socio: quel movimento è ancora
  nel ledger di agosto.

- `[Sviluppo]` 🔎 **`sistema:nomi` dice QUALI righe rileggere, invece di dire «rileggile tutte».**
  Lo script chiudeva con "leggi la colonna «diventa» prima di confermare… i cognomi doppi senza
  particella vengono divisi male, sono pochi". Simone l'ha rimandato indietro, e aveva ragione: su
  centinaia di lead quel consiglio non è praticabile — e «sono pochi» è una speranza, non un numero.
  La divisione però **non è incerta allo stesso modo su tutte le righe**, e questa è la parte che
  mancava. Due parole («Rosa Tinelli») non hanno alternative. Tre o più **con una particella in
  mezzo** («Maria Teresa De Santis») nemmeno: il «De» ancora il cognome e il resto è nome, è
  aritmetica. Il dubbio vive **solo** nei tre-e-più parole senza particella, dove «Maria Grazia
  Cerchiara» (nome composto + cognome) e «Anna Rossi Bianchi» (nome + cognome doppio) hanno la
  stessa forma e nessuna regola può distinguerle — un dizionario dei nomi propri sarebbe una
  scorciatoia che sbaglia su ogni nome straniero, mentre chi conosce quella persona lo vede in un
  secondo.
  Quindi: `certezzaDivisione()` in `common/dividi-nome.ts` (dove sta la regola, non nello script),
  una colonna **`esito`** nella tabella, il conteggio «sicure / da controllare» **prima** di
  confermare, e due interruttori: `CERTEZZA=sicuri` applica solo ciò che non ha alternative,
  `CERTEZZA=dubbi` mostra soltanto le righe da rivedere. Il filtro tocca le due liste in parallelo
  (sono allineate per indice: filtrarne una sola farebbe mentire la tabella).
  Il consiglio finale ora dice dove guardare e cosa cercare, invece di chiedere di rileggere tutto.
  5 test nuovi sulla certezza, compreso il caso della particella in testa o in coda — che non ancora
  niente e lascia il dubbio dov'è. 857 test verdi.

- `[Sviluppo]` 🧱 **Backend su istanza Standard e due istanze, scritte nel blueprint.** L'8/8 alle 17:15 l'istanza è
  stata uccisa e riavviata: `Instance failed — HTTP health check failed (timed out after 5 seconds)
  while running your code`. Non un deploy fallito (i tre dell'8/8 erano tutti andati live), non un
  crash: l'app c'era e non ce la faceva a rispondere a `/health` in 5 secondi. Su un'istanza da
  **512 MB** la spiegazione più probabile sono gli script `ts-node` lanciati nella shell di Render,
  che girano **dentro lo stesso container dell'applicazione** e le portano via memoria e CPU. Per le
  clienti sono stati ~40 secondi di app spenta, e per Simone un «Failed to fetch» sul login del
  backoffice che sembrava un problema di password.
  Simone ha scalato a 2 dalla dashboard alle 17:28 («Service recovered»). Qui la scelta viene
  scritta in `render.yaml`, dove è la verità del servizio.
  **Due chiarimenti che ci sono costati un giro a vuoto.** Primo: *Pro* è il piano del **workspace**,
  `plan:` è il **tipo di istanza** — sono cose diverse, e avere Pro non sposta il servizio da
  starter. Secondo: dei due campi, quello che rischia di tornare indietro è **`plan`**, perché è
  dichiarato nel blueprint (cambiarlo dalla dashboard viene annullato alla sincronizzazione
  successiva); `numInstances`, se assente, viene **conservato** da Render sui servizi esistenti.
  Scriverlo comunque serve a non lasciare la scelta invisibile nel pannello.
  Verificato prima di scrivere, perché sono le due cose che impediscono di scalare: **nessun disco
  persistente** sul servizio, e gli scheduler sono **cron esterni** e non timer nel processo —
  quindi due istanze non fanno partire due volte il giro giornaliero o i solleciti misure.
  `preDeployCommand` (migrazioni + seed) gira una volta per deploy, non una per istanza.
  **Le due righe curano due cose diverse**, e serve saperlo per decidere in futuro:
  `plan: standard` (2 GB / 1 CPU, passato lo stesso giorno) toglie la **causa** — con quattro volte la
  memoria uno script nella shell non soffoca più l'applicazione; `numInstances: 2` toglie il
  **sintomo** di tutto il resto, cioè i riavvii su cui non abbiamo alcun controllo (manutenzione
  della piattaforma, host che riparte, un nostro crash, un picco che sfora il timeout del health
  check). Con una sola istanza ognuno di questi spegne il servizio a tutte le clienti per una
  quarantina di secondi, e lo si scopre da un messaggio WhatsApp di una coach — che è esattamente
  come l'abbiamo scoperto oggi. Con due, non se ne accorge nessuno.
  Effetto collaterale utile: da adesso gli script pesanti nella shell sono innocui per le clienti —
  la shell si attacca a una delle due istanze, l'altra continua a servire il traffico.
  Se un mese passa senza nessun «Instance failed» e si vuole risparmiare, tornare a una istanza è
  difendibile: si cambia la riga in `render.yaml`, non dalla dashboard.

- `[Sviluppo]` 📎 **La fattura si allega al costo, in Contabilità.** Richiesta di Simone dell'8/8:
  «nei costi mi piacerebbe poter allegare le fatture in modo da avere tutto insieme». Un file per
  costo — «la fattura», al singolare, scelta sua: se un giorno serviranno due allegati servirà una
  tabella, non una seconda colonna appiccicata.
  Nella riga del costo un solo pulsante che cambia faccia: la graffetta se la fattura non c'è, e se
  c'è due icone — apri e togli. Aprire scarica e mostra in una scheda nuova (il PDF si legge, la foto
  si vede); se il browser blocca il popup il file viene scaricato invece di non fare niente. Togliere
  la fattura **non** tocca il costo: l'importo resta, cambia solo l'allegato.
  **Come è salvata.** Tre colonne sulla riga (`invoice_data` BYTEA, `invoice_mime`, `invoice_name`),
  file **cifrato AES-256-GCM** con la stessa chiave e lo stesso formato delle contabili dei pagamenti
  (iv + authTag + ciphertext). Una fattura ha dentro partita IVA, indirizzi e importi di un
  fornitore: non c'è motivo di tenerla in chiaro. Il servizio è **fail-closed**: senza
  `FILE_ENCRYPTION_KEY` non parte, invece di cifrare con un ripiego che equivale a non cifrare.
  Non usa la tabella `document` perché quella è legata a un `client_id`: la fattura di un fornitore
  non è il documento di una cliente, e agganciarla lì avrebbe voluto dire rendere nullable una
  relazione che oggi garantisce che ogni documento sanitario abbia una proprietaria.
  **Il dettaglio che conta più del resto:** l'elenco dei costi NON restituisce più la riga intera.
  Prima faceva `findMany` senza `select`, e con la colonna nuova avrebbe spedito al browser **tutti i
  file di tutti i costi a ogni apertura della pagina** — megabyte per riga. Ora c'è una whitelist di
  campi e l'elenco dice solo `fattura: { nome, mime } | null`: che ci sia si sa, il file si scarica
  quando lo si chiede. Anche la lettura è tracciata (`accounting.cost_invoice_downloaded`): è un
  documento fiscale, sapere chi l'ha aperto costa una riga.
  Limiti: PDF, JPG, PNG, HEIC; 5 MB, come le contabili. Arriva in base64 e non in multipart, così
  limite del body e validazione restano quelli di tutta l'API.
  ⚠️ **Contiene una MIGRAZIONE** (`20260809120000_cost_entry_fattura`): tre colonne nullable, i costi
  già registrati restano validi così come sono. La applica il deploy.
  846 → 852 test verdi, type-check pulito su backend e backoffice.

- `[Sviluppo]` 👁️ **L'admin vede tutte le conversazioni della cliente — e prima non ne vedeva
  nessuna.** Simone apre la scheda come admin e legge «Nessuna conversazione visibile per il tuo
  ruolo»: «ADMIN vede tutto». Guardando il codice il difetto era più grande della scelta di cui
  avevamo discusso: l'admin **non era gestito affatto** in `assertThreadAccess`. Non è che gli
  mancasse il thread con Gaia — cadeva sul `Nessuna scheda staff` prima ancora di arrivare ai
  controlli, quindi non vedeva **nemmeno la chat con la sua coach**.
  Ora un ramo esplicito: `role === 'admin'` in lettura passa, e sta **prima** della ricerca della
  scheda staff, perché un admin può non averne una.
  **Due limiti restano, e sono voluti.** L'admin **legge e non scrive**: un suo messaggio nel thread
  della coach arriverebbe alla cliente come se fosse della coach, e per parlare come qualcun altro
  esiste l'impersonazione, che è dichiarata e tracciata. E la **manager delle coach** (`sales`) resta
  fuori dal clinico: vede lead, contatti e metriche, non i sintomi.
  Qui c'era il ragionamento opposto, ed era motivato: `pages.ts` nega all'admin `health_documents`
  con la nota «note cliniche riservate», e nel thread con Gaia c'è esattamente quel materiale. Ha
  deciso Simone, e la contropartita è la **traccia**: `chat.staff_read_messages` registra ogni
  apertura di una conversazione da parte dello staff — chi, quale thread, quale cliente. La cliente
  che rilegge la propria non viene tracciata: sarebbe rumore che nasconde le righe che contano. Un
  errore dell'audit non impedisce la lettura: meglio un messaggio letto senza riga che una scheda che
  non si apre.
  Il test che diceva «l'admin NON legge» è stato riscritto con la decisione nuova invece di essere
  cancellato, e accanto ci sono quelli che tengono i due limiti. 852 test verdi, nessun OTA.

- `[Sviluppo]` 🏷️ **`sistema:nomi` ora sistema anche i LEAD, che erano il grosso del problema.**
  Lanciato in produzione diceva «Clienti esaminate: 41 · già a posto: 41 · Niente da sistemare ✓», e
  Simone: «ma io voglio sistemare i lead anche». Aveva ragione, e il «niente da sistemare» era una
  mezza verità: lo script interrogava `user` con ruolo `client`, cioè **solo chi ha un account**. I
  lead importati dalle liste non ce l'hanno — sono `CrmRecord` con `clientId` a null — quindi non
  erano né sistemati né contati: invisibili, non a posto.
  Su un lead il guasto è più semplice: `firstName`/`lastName` vuoti e il nome intero in `name` (lo
  dice il commento dello schema: restano nullable «perché i lead importati dalle liste storiche hanno
  solo il nome intero»). Senza cognome, in Gestione lead non si ordina e non si cerca per cognome —
  lo stesso problema delle clienti, sulla lista più grande.
  Aggiunta una seconda fase con la stessa regola di divisione, lo stesso dry-run e la stessa
  conferma. Tre scelte che vale la pena aver scritto: il limite numerico vale sul **totale** delle due
  liste (altrimenti «40» diventava «40 clienti E 40 lead», e chi legge trenta righe se ne ritrova
  ottanta scritte); i lead **con** account non vengono rifatti, perché il giro delle clienti già
  allinea la loro scheda CRM; email e telefono non si toccano, sono le chiavi con cui il lead è stato
  importato e riconosciuto. Nuovo interruttore `SOLO=lead` / `SOLO=clienti` per lavorarne una alla
  volta.

- `[Sviluppo]` 📏 **Quando la coach sblocca l'app, le misure si chiedono sul telefono.**
  Richiesta di Simone dell'8/8. Lo sblocco già mandava un avviso, ma con due difetti che si
  sommavano: **annunciava** («App sbloccata 💚») invece di **chiedere**, ed era solo `inapp`, cioè
  nel campanello. Il campanello lo vede chi apre l'app — precisamente quello che la cliente non
  stava facendo, perché l'app era bloccata. L'avviso le arrivava quindi *dopo* che aveva già fatto
  da sé la cosa che le stavamo chiedendo. E lo sblocco da solo non porta nessun menu: quello lo
  sbloccano le misure. Il risultato era una cliente che girava in un'app riaperta e ancora senza
  menu, convinta che il problema fosse un altro.
  Ora il testo chiede le misure e dice cosa succede se le mette («il menu dei prossimi giorni arriva
  subito»), e parte anche come **push**. La notifica nel campanello resta, per chi apre l'app dopo.
  **Il pezzo di architettura, che è la parte interessante.** `PushService` stava dentro
  `NotificationsModule`, e quel modulo **importa** `MenuModule`: chiunque stia nel menu non poteva
  mandare una push senza dipendenza circolare. La soluzione facile era un `forwardRef` messo lì per
  far tacere Nest; quella giusta era estrarre `PushModule` (nuovo), che dipende solo da Prisma e
  ConfigService — entrambi globali — e non porta con sé nient'altro. `NotificationsModule` lo
  **riesporta**, così chi prendeva `PushService` da lì non cambia una riga.
  Un errore delle push non fa fallire lo sblocco: la finestra di grazia è già concessa e la coach ha
  già avuto la sua conferma. C'è un test anche per questo, oltre a quello che pretende la parola
  «misure» nel corpo del messaggio: se un domani qualcuno lo riscrive come «app sbloccata» e basta,
  il test lo ferma.
  Suite: 849 test, 67 suite, verdi; type-check ai 46 errori di baseline dello stub, nessuno nuovo.
  Nessuna migrazione, **nessun OTA**: è tutto backend.
  ⚠️ In coda, come richiesto: i promemoria misure alle **9, 12, 16 e 20**. Non è un'aggiunta banale
  perché il cron su Render gira **una volta al giorno**: la scelta fra un cron più frequente e le
  notifiche programmate va fatta prima di scrivere codice.

- `[Sviluppo]` 🔑 **Il reset password dalla scheda lo fa anche la coach, sulle proprie clienti.**
  Prima la rotta era `@Roles('admin')`: la coach premeva «Reset password» e leggeva «Solo un admin
  può inviare il reset password» — proprio mentre era al telefono con la cliente che non riusciva a
  entrare. Il pulsante era perfino nascosto (`isAdmin &&`), quindi il più delle volte non lo trovava
  nemmeno.
  Non serviva un endpoint nuovo: serviva **togliere il cancello sbagliato e mettere quello giusto**.
  Il controllo di appartenenza esisteva già — `assertClientAccess`, lo stesso che decide se questa
  scheda si può aprire — e ora protegge anche il reset: se la scheda si apre, la cliente è sua.
  Coach → le sue (e la coordinatrice quelle del suo team), nutrizionista → le sue,
  manager/capo/admin → tutte.
  **Un secondo controllo, che prima non serviva e ora sì:** il bersaglio deve avere ruolo `client`.
  `assertClientAccess` lascia passare chi non ha scope (manager, capo, admin), quindi senza quel
  controllo un manager avrebbe potuto far ripartire la password di un **admin** passandone l'id. Non
  era un buco solo perché la rotta era riservata agli admin: togliendo quel guardrail diventa
  obbligatorio. C'è un test che si chiama `ESCALATION` e lo tiene inchiodato — verificato **rosso**
  levando il controllo.
  Resta vero che **nessuno dello staff vede né scrive la password**: parte un link e la scelta è
  della cliente. Per dettarne una a voce esiste `:id/set-password`, dietro il suo permesso.
  Lato backoffice il pulsante è visibile a chiunque possa aprire la scheda, con il messaggio d'errore
  che ora arriva dal backend («questa cliente non è assegnata a te») invece del vecchio testo fisso
  sull'admin. Nessuna migrazione; il backoffice si aggiorna da sé su Vercel, nessun OTA.
  Suite: 846 test, 67 suite, verdi; type-check pulito anche sul backoffice.

- `[Sviluppo]` 🩹 **Tre clienti bloccate al carrello: il questionario perdeva il consenso sanitario.**
  Segnalazione di Simone dell'8/8, tre casi in un pomeriggio (Gioia 12:52, Giusy 14:20,
  Ilaria 16:13), tutte con la **Prova Gratuita** nel carrello e tutte con lo stesso muro:
  «Per il piano serve il consenso ai dati sanitari: completa prima il questionario». La domanda di
  Simone era «come è possibile che una cliente sia arrivata fino all'acquisto senza passare dal
  questionario?» — e la risposta è che **non ci è arrivata senza: il questionario l'ha fatto, ed è
  lui che perdeva il consenso.**
  Il salvataggio del profilo a fine questionario (`onboarding.service.ts`) è un `upsert`, e
  `consents` era scritto **solo nel ramo `create`**. Chi aveva già un profilo finiva nel ramo
  `update`, che scriveva `onboardingCompletedAt` **ma non il consenso**. Da lì due porte chiuse
  che si incastrano: l'app guarda `onboardingCompletedAt` per decidere se mostrare il questionario,
  quindi **non lo mostrava più** («mi dice di compilare il questionario ma non so dove sia»: vero
  alla lettera), e il carrello pretende il consenso, quindi bloccava l'acquisto chiedendo l'unica
  cosa che quella cliente non poteva più raggiungere.
  **Chi aveva già un profilo?** Proprio i lead inseriti dal backoffice: il profilo nasce quando la
  coach manda le credenziali (`agganciaAssegnazioneAlProfilo`). Più il codice invito e la modifica
  cliente. Il commento di quella funzione dice che creare il profilo è sicuro «perché
  `onboardingCompletedAt` resta null e il gate guarda quello» — ed era vero per il gate, ma
  nessuno aveva guardato il ramo `update` del questionario.
  Correzione: i consensi si calcolano **una volta** e si scrivono in **entrambi** i rami, **unendoli**
  a quelli già presenti (un consenso raccolto altrove non si perde se il questionario si rifà).
  Riparazione per chi era già bloccata: `npm run fix:consenso-sanitario` (dry-run; `CONFERMA=1` per
  applicare). **Non inventa consensi**: ripristina solo se `onboardingAnswers.healthDataConsent`
  è `true` — e quelle risposte sono una prova, perché il questionario si rifiuta di partire senza
  quel consenso. Data registrata: quella del questionario, con nota di ripristino. Chi non ha la
  prova viene elencato e non toccato.
  Tutto **backend**: nessun OTA, nessun aggiornamento dell'app.
  **La lezione**, che vale oltre il caso: *un `upsert` sono due scritture diverse travestite da una,
  e il ramo `update` è quello che nessuno rilegge.* Ogni campo che è un cancello per qualcos'altro
  va verificato in entrambi i rami. Tre test nuovi lo fissano — verificati rossi togliendo la
  correzione, non solo verdi mettendola (suite: 840 test, 66 suite, tutte verdi).

- `[Sviluppo]` ✋ **Il passaggio di consegne diceva di rifare una cosa già fatta.** Alla domanda
  di Simone — «controlla bene, hai messo tutto?» — la risposta onesta era no. Il documento era
  stato scritto guardando un clone in sandbox fermo a `8a701d0`, e nel frattempo su `origin/main`
  c'era `2783bce`: **i punti 1 e 2 di Gaia erano già implementati e pushati**. La sessione nuova
  avrebbe riscritto da capo 3.100 righe già in produzione. Corretto rileggendo `origin/main`
  commit per commit e verificando ogni voce nel codice, non nelle liste dei giorni prima.
  Il file ora porta in cima il commit su cui è stato verificato, ha una sezione **«già chiuso —
  non riaprirlo»** con il commit che ha chiuso ogni punto, e dice esplicitamente che il clone in
  sandbox non è la verità: prima di fidarsene va fatto `git fetch && git reset --hard
  origin/main`. È la lezione più utile del giro: **un elenco di cose da fare che nessuno
  riverifica invecchia più in fretta del codice**.
  Il lavoro in cima alla coda cambia di conseguenza: non più il ponte Gaia, ma il **reset
  password dalla scheda coach** e i **punti 3-5** del progetto Gaia.

- `[Sviluppo]` 📖 **Le OTA hanno finalmente istruzioni scritte** — `progetto/guide/COME_SI_FA_UNA_OTA.md`.
  Nasce da una constatazione: ogni sessione nuova rifà gli stessi tre errori, e non per
  distrazione — la procedura ha tre passaggi che nessuno può indovinare. Si lancia **sul Mac**
  dalla radice del progetto (su Render `scripts/` non esiste e non esisterà mai: lì è deployato
  solo `backend/`); serve `app/google-services.json`, che è gitignorato e quindi **non c'è su
  nessun clone** — costruire senza spegne le notifiche push a chi riceve il bundle, in silenzio e
  senza errori; e soprattutto **un numero di versione non si riusa mai**, perché Capgo confronta
  la stringa e un telefono che ha applicato la X non la riscarica più, qualunque cosa ci sia
  dentro lo zip. Nel file anche la tabella dei tre numeri che devono coincidere
  (`app/package.json` · nome dello zip · `OTA_VERSION`), il modo di verificare un bundle senza
  installarlo (il numero è compilato dentro il JS) e una tabella sintomo → causa. È puntato da
  `ISTRUZIONI_PER_AI.md`, così una sessione che segue le istruzioni lo trova **prima** di
  sbagliare invece che dopo.

- `[Sviluppo]` 🤝 **Passaggio di consegne alla sessione nuova** — `progetto/PASSAGGIO_NUOVA_SESSIONE.md`:
  il messaggio d'apertura da incollare, il contesto minimo (come si consegna il codice sul mount e
  perché `cat > destinazione` è obbligatorio, perché `prisma generate` non gira sul Mac, dove si
  lanciano i test) e **tutto quello che resta da fare**, diviso fra codice, verifiche, cose che
  aspettano Simone e cose che aspettano la nutrizionista. L'elenco è stato **riverificato sul
  codice**, non ricopiato dalle liste vecchie: quello che risultava aperto ed è già chiuso non
  compare più, ed è scritto in fondo perché nessuno lo riapra. Serve a non ricomprare ogni volta
  lo stesso mezzo pomeriggio di contesto.
  Dalla riverifica è uscito **un difetto nuovo**: `app/src/pages/PlanFlow.tsx` — l'acquisto del
  primo piano in onboarding — dichiara `interface Plan` senza `billing` e non lo passa a
  `cart.setPlan`, quindi nel Checkout la scelta fra abbonamento e pagamento unico **non compare
  mai**. È lo stesso difetto che era stato corretto sul pulsante del report, ma sulla strada
  d'acquisto principale. Non ancora corretto: prima va verificato quali piani `3m/6m/12m` hanno
  davvero un `billing` diverso da `one_time`.

- `[Prodotto]` 🔔 **Una segnalazione senza destinatario non è una segnalazione.** È la storia di
  una cliente vera, e vale la pena scriverla per intero. Si iscrive il 20 luglio. Dichiara una
  condizione clinica e un'allergia al pesce. Il motore non riesce a comporre un piano sicuro —
  con le sue esclusioni restano **zero pranzi e zero cene** compatibili — e apre tre
  segnalazioni: piano bloccato, screening clinico, e poi un calo di peso anomalo.
  **Nessuna delle tre arriva a nessuno.** Non le era ancora stata assegnata una nutrizionista, e
  il codice che scriveva la segnalazione la lasciava senza destinatario: nessuna notifica,
  nessuna email, visibile solo a chi fosse andato a cercare l'elenco di sua iniziativa.
  Riceve quattro giornate di menu con la sola colazione. La prova gratuita scade il 30 luglio.
  Venti giorni di silenzio, e non un solo errore da nessuna parte.
  Ora `personal-base` e `menu` passano da **`apriSegnalazione`** (senza dipendenze da Nest, come
  `avanza-stato.ts`: importare il servizio delle notifiche dentro MenuModule chiude un anello e
  Nest non parte). Assegna, avvisa, e **se il ruolo che deve prenderla in carico non è
  assegnato la manda a chi ne risponde** — capo nutrizionista o coordinatrice coach — con la
  notifica che dice esplicitamente che nessun altro l'aveva in mano.

- `[Sviluppo]` 🍽️ **«Nel menu ci dev'essere da mangiare»: il controllo che non c'era.**
  Dalla compattazione del catalogo è saltata fuori questa riga:
  `Vacanze in Serenità · onnivora · dimagrimento · 3 pasti → colaz. 5 · pranzo 0 · cena 0`.
  Ventotto giornate erogate, **zero pranzi e zero cene**, dieta «approved · visibile».
  Il gate di pubblicazione controllava allergeni e gruppi di equivalenza — cose serie — e **non
  controllava che nelle giornate ci fosse da mangiare**. Nessun errore da nessuna parte, perché
  nessuno guardava: una persona apre l'app all'ora di pranzo e non trova niente.
  Ora `assertActivatable` rifiuta di rendere visibile una dieta con giornate a cui manca un
  pasto, e il nuovo **`npm run diag:menu-incompleti`** trova quelle già pubblicate **e le
  clienti che le stanno ricevendo** — cercate da `menu_day.diet_id`, cioè dalle giornate
  davvero consegnate, non dalle preferenze scritte nel profilo.

- `[Prodotto]` 🧹 **`npm run compatta:menu` — fare ordine nel catalogo.** Il catalogo si è
  formato a strati: un pezzo col metodo vecchio, un pezzo generato bene settimana per settimana,
  qualche piatto corretto a mano. I piatti ci sono, ma sono **sparsi** — la settimana 6 ha
  quattordici spuntini e la 2 ne ha tre, la 1 usa piatti che compaiono anche nella 5. Contando a
  mano non torna mai niente.
  Il comando **non genera niente e non chiama l'AI**: ridistribuisce quello che c'è. Per ogni
  pasto mette i piatti distinti in fila e ricostruisce le giornate in ordine — sette piatti
  diversi per pasto, dalla settimana 1 in avanti. Quello che avanza resta fuori dal ciclo.
  Il ciclo si accorcia (84 giorni con 44 pranzi diversi diventano 42), e va bene così: quei 42
  giorni sono **tutti diversi**, gli 84 di prima contenevano quaranta ripetizioni.

- `[Sviluppo]` ♻️ **Le ricette avanzate non si buttano.** Il generatore ora, prima di chiamare
  l'AI, ripesca le **ricette orfane** — già generate per quella dieta e quel regime ma fuori dal
  ciclo. Ne nascono compattando il catalogo e rifacendo le settimane: sono piatti pagati,
  scritti e spesso già riletti dal nutrizionista, e chiederne di nuovi all'AI mentre quelli
  stanno lì inutilizzati è spreco doppio — i soldi e il lavoro di chi li ha corretti.
  Il filtro sul **regime** è la parte che non si può sbagliare: una ricetta onnivora dentro una
  dieta vegana sarebbe un errore grave e silenzioso.

- `[Sviluppo]` 🍳 **«Completa» non completava niente, e il pulsante sembrava rotto.** Settimane
  1-4 fatte col metodo vecchio, 5-12 fatte bene, spunta «genera tutte le 18 varianti»: si chiede
  di completare la settimana 1 e non succede niente. Rigenerando, identico.
  Il motivo: le ricette *proprie* venivano filtrate — quei piatti compaiono anche nelle altre
  settimane, quindi non contano — ma subito dopo entravano quelle delle **varianti sorelle**
  (3 pasti, digiuno), che per la settimana 1 hanno esattamente gli stessi piatti presi in
  prestito. Quelle passavano **senza nessun controllo**: `mancanti` tornava a zero, l'AI non
  veniva chiamata, la settimana restava magra. Ora un piatto di una sorella vale solo se questa
  variante non lo sta già usando in un'altra settimana: altrimenti prenderlo qui non aggiunge
  varietà, la toglie.

- `[Sviluppo]` 📊 **La striscia delle settimane ora risponde per tutte le 18 varianti** quando
  la spunta è attiva (`?famiglia=1`). Prima mostrava lo stato della sola variante attiva: una
  settimana poteva essere verde lì e magra su una sorella, e le clienti di quella sorella
  ricevevano un menu che si ripete senza che nessuno lo vedesse. Magra da qualche parte = magra.

- `[Sviluppo]` 📌 **La variante su cui si lavora viene ricordata.** Cliccando sulla famiglia si
  apriva `variants[0]`, cioè la prima che il database restituisce: una a caso, e mai la stessa.
  Chi aveva finito dodici settimane su «onnivora · 5 pasti» usciva, rientrava, e si trovava
  davanti le settimane 1-4 di «vegana · mantenimento · 3 pasti» in giallo — convinto di aver
  perso il lavoro. Ora la variante si ricorda fra le sessioni; se non c'è niente da ricordare si
  apre la **maestra** (onnivora · dimagrimento · 5 pasti), quella da cui le altre riusano i
  piatti; e nel passo 2 ci sono i chip per cambiarla con un clic.

- `[Prodotto]` 🏷️ **«Nome nel percorso» si chiama ALIAS**, ed è il nome con cui la cliente si fa
  chiamare in app. Chiamarlo «nome» invitava a scriverci dentro nome e cognome — ed è
  esattamente quello che ha fatto l'import delle liste storiche: prima parola in *Nome*,
  *Cognome* vuoto, nome intero nell'alias. Risultato: in app veniva chiamata con nome e cognome
  per esteso, come una raccomandata, e in backoffice il cognome non c'era (niente ordinamento,
  niente ricerca). Nuovo comando **`npm run sistema:nomi`** che divide — ultima parola =
  cognome, particelle (De, Di, Della…) attaccate al cognome — mostra la tabella e scrive solo su
  conferma. Il numero opzionale (`-- 30`) limita **il lavoro**, non solo la stampa: limitare la
  sola tabella voleva dire leggerne trenta e scriverne trecento.

- `[Prodotto]` 🏁 **«Percorso concluso» automatico a +7 giorni** dalla fine del piano, senza
  rinnovo (richiesta delle coach, 8/8). La colonna esisteva nella pipeline dal primo giorno e
  **non la scriveva nessuno**: chi finiva restava fermo nella colonna dell'ultima cosa fatta,
  mescolato a chi era ancora in corso. Perché +7 e non subito: il rinnovo arriva quasi sempre
  nei giorni dopo la scadenza, e archiviare qualcuno il giorno stesso vuol dire archiviare una
  persona che sta per tornare. Chi ha un abbonamento attivo **o anche solo un bonifico in
  attesa** non si tocca.

- `[Prodotto]` 🧍 **Nome e Cognome, obbligatori. E un Alias facoltativo.** Nel form «Nuovo lead»
  c'era un solo campo «Nome (facoltativo)»: si potevano inserire lead **senza nome** — che in
  tabella diventano una riga con la sola email, e nessuno sa più chi sia — e chi il nome lo
  scriveva lo scriveva come gli veniva, quindi ordinare per cognome era impossibile.
  Ora sono due campi obbligatori, più un **Alias** facoltativo (come si fa chiamare). In
  Gestione lead ci sono due colonne, **Nome** e **Cognome**, entrambe ordinabili; l'alias in
  tabella non compare.
  Tre scelte dietro, tutte con lo stesso movente — non rompere quello che già funziona:
  · `name` resta e viene tenuto allineato come «Nome Cognome», perché lo leggono tabella,
    pipeline, email, ricevute e import: riscrivere tutti quei punti sarebbe stato un rischio
    senza guadagno;
  · le colonne nuove sono **nullable**: le schede importate hanno solo il nome intero, e
    spezzare «Maria Teresa De Santis» a occhio produrrebbe un cognome sbagliato che poi nessuno
    ricontrolla. Su quelle la scheda mostra ancora il campo intero, finché non le si separa;
  · nome, cognome e alias si correggono **anche dalla scheda**, altrimenti sarebbero dati che si
    scrivono una volta sola.
  Migrazione `20260809090000_lead_nome_cognome_alias` (tre colonne nullable, nessun dato toccato).

- `[Prodotto]` 🛡️ **Il Monitoraggio a €19 adesso è un prodotto vero.** Fin qui erogava gli
  **stessi identici menu** del Mantenimento a €49, perché il motore guardava solo che ci fosse un
  abbonamento attivo, mai quale. Due prezzi molto diversi per la stessa cosa. Deciso (Simone) che
  cosa deve essere, e scritto nel codice:
  · **niente menu di piano** — non è quello che il piano promette;
  · **il peso si chiede, non si impone**: Gaia lo domanda ogni tanto, nessun popup bloccante e
    nessun blocco dell'app (era la trappola peggiore: senza menu in arrivo il gate misure restava
    «mancano le misure iniziali» per sempre, a una persona che paga ogni mese);
  · superata la soglia (+3 kg, parametrico) si prepara **una settimana** di menu scelti fra
    quelli che su di lei hanno fatto perdere di più — erano 8 giorni, numero ereditato dal
    prodotto «Menu di rientro (8 giorni)» che non esiste più (`monitoring_rientro_days`);
  · **tutta l'app e la coach restano raggiungibili**, e in app compare una frase che spiega dove
    si trova invece di un «menu in preparazione» che non arriverà mai.
  Sotto c'era il difetto grosso: **pagare i €19 chiudeva il monitoraggio**. La regola «qualsiasi
  piano a pagamento chiude il monitoraggio in corso» valeva anche per il piano che *è*
  monitoraggio, quindi chi pagava si comprava la fine del servizio che stava comprando — niente
  richieste del peso, e soprattutto **niente menu di rientro**, perché il giro giornaliero lavora
  sui periodi attivi. Senza nessun errore: semplicemente non succedeva più niente.

- `[Sviluppo]` 🛒 **Il pulsante del report vendeva solo il mese singolo.** «Attiva il
  mantenimento» a fine percorso non passava `billing`, quindi nel Checkout non compariva la
  scelta fra abbonamento e mese singolo: la strada principale di conversione convertiva nel modo
  meno redditizio, e in silenzio (dal Negozio la scelta c'era, quindi nessuno se ne accorgeva).

- `[Sviluppo]` 🩹 **«La dieta è in stato approved: non pubblicabile».** Da quando la pagina apre
  da sola una variante, quasi sempre ne apre una già pubblicata su cui è appena stata generata
  una settimana in più — e il pulsante «Approva e pubblica» rispondeva con quell'errore rosso in
  cima alla pagina, che sembrava dire «non puoi più approvare niente». Il lavoro da fare c'era ed
  era un altro: attivare le ricette della settimana nuova, che nascono in bozza. Ora su una
  variante pubblicata il pulsante diventa **«Attiva le ricette nuove»** e la riga sopra dice
  «già pubblicata» invece di «Bozza · stato approved», che era una contraddizione in due parole.

- `[Sviluppo]` 🔗 **L'abbonamento orfano, e i soldi che entrano senza che nessuno se ne accorga.**
  `stripeSubscriptionId` lo scriveva **solo** `checkout.session.completed`. Se quel singolo
  webhook si perdeva — un deploy in corso, un 500, l'endpoint irraggiungibile per dieci minuti —
  la colonna restava `null` **per sempre**. Da lì in poi nessuna fattura ritrovava più la riga:
  la cliente pagava ogni mese, la scadenza non si spostava (quindi prima o poi restava senza
  menu *pur pagando*) e la disdetta dall'app rispondeva «Nessun abbonamento da disdire». Tutto
  con la webhook che risponde 200: nessun errore da nessuna parte.
  Il rimedio era già nei dati e nessuno lo leggeva: alla creazione del checkout i nostri id
  finiscono in `subscription_data.metadata`, e Stripe li rimanda su **ogni** fattura. Ora, se
  l'aggancio manca, si risale da lì e si riscrive — quindi il difetto **si ripara da solo** alla
  prima fattura successiva. Con un limite deliberato: se la riga punta già a un *altro*
  abbonamento Stripe non si tocca niente e resta una segnalazione nell'audit
  (`riaggancio_rifiutato`), perché spostare a mano il filo dei pagamenti di qualcuno è roba da
  persone, non da webhook.

- `[Sviluppo]` 💸 **La provvigione del rinnovo non può più sparire in silenzio.** Il pagamento
  viene creato — e con lui il segno di idempotenza — *prima* di `generateCommissions`. Se quella
  falliva, l'eccezione risaliva alla webhook (500), Stripe riconsegnava, e al secondo giro il
  pagamento risultava già fatto: provvigioni, ricevuta e notifica alla coach **non nascevano
  mai**. Ora l'errore viene fermato e scritto (`commerce.commission.failed`, col rimedio dentro),
  la catena prosegue, e il recupero è il pulsante **↻ Ricalcola provvigioni** di ieri. Stessa
  protezione sul primo pagamento, dov'era identica.

- `[Sviluppo]` 🧾 **La ricevuta del rinnovo ora ha la ricevuta dentro.** Dal secondo mese in poi
  l'email diceva «ecco la tua ricevuta» e non allegava niente: chi paga sei mesi aveva un
  documento buono e cinque email vuote. Ora il PDF è allegato come al primo pagamento.

- `[Sviluppo]` 🔑 **Il lead non sceglie più la password due volte.** L'account creato da
  «Invia credenziali» nasce con `mustChangePassword: true` e riceve un link di reimpostazione;
  la conferma del reset scriveva la password ma lasciava il flag alzato, quindi al primo accesso
  l'app la rimandava a «scegli la password» — la stessa di due minuti prima. Nessun errore, solo
  una persona convinta di aver sbagliato qualcosa.

  692 test verdi (erano 661).

---

## 2026-08-08

- `[Sviluppo]` ✅ **`pubblica:tutto` lanciato in produzione su tutto il catalogo.** 1468 ricette
  attivate, 1477 allergeni confermati, 273 gruppi approvati, 30 diete pubblicate e rese visibili
  alle clienti. Saltate 13: le 12 «Digiuno intermittente (16:8)» archiviate e «Ritorno in
  Equilibrio · onnivora · mantenimento · 3 pasti», che non ha nessuna giornata.
  ⚠️ Fra le 30 pubblicate c'è **`lovcarbciccio · onnivora · dimagrimento · 5 pasti`**, che dal
  nome è una prova: era in bozza, ora è visibile alle clienti e va archiviata. È il prezzo di un
  comando che pubblica «tutto quello che trova»: la prossima volta conviene passargli il nome
  della famiglia. Dettagli in `progetto/DA_RIPRENDERE_20260809.md`.

- `[Sviluppo]` 🧾 **«Valida e pubblica» era sparito — e non era un difetto grafico.**
  Il passo 3 lavora sulla variante selezionata: dopo una pubblicazione quella selezione resta
  vuota, e la pagina rispondeva «Genera un catalogo per iniziare la validazione guidata» con
  diciotto varianti elencate due centimetri più sopra. Ora la variante se la sceglie da sola
  (la prima con dei passi ancora da fare), e il riquadro «Tutta la famiglia in un colpo» è
  uscito da dentro il blocco della singola bozza: c'è sempre.
  Sotto, però, c'era una cosa peggiore: il pulsante **saltava le varianti già pubblicate**.
  Sembrava prudenza — ripubblicare una dieta approvata dà errore — ma è proprio lì che stanno
  le ricette nuove: ogni settimana generata dopo la pubblicazione nasce **in bozza**, con le
  ricette inattive. Su una famiglia interamente pubblicata il pulsante non faceva quindi
  assolutamente niente, e le clienti continuavano a ricevere solo i piatti vecchi mentre il
  backoffice diceva «18 pubblicate». Ora la validazione passa su tutte (attiva le ricette,
  conferma gli allergeni, approva i gruppi) e si salta solo la *ripubblicazione* di chi è già
  approvata. La pagina non si azzera più: dopo l'ultima settimana ci si ripassa ogni volta.

- `[Sviluppo]` ✅ **Comando `npm run pubblica:tutto`** — lo stesso lavoro su tutto il catalogo in
  un colpo, per rimettere in pari le diete generate in questi giorni:
  `npm run pubblica:tutto` mostra cosa farebbe, `CONFERMA=1 npm run pubblica:tutto` applica, e
  con un nome fra virgolette si limita a una famiglia. Non tocca le **archiviate** (sono fuori
  apposta) né le diete senza giornate. Da leggere prima di lanciarlo: marcare gli allergeni
  «confermati» in blocco è una dichiarazione, non una pulizia tecnica — è la stessa cosa che fa
  il pulsante, ma su tutto il catalogo invece che su una famiglia guardata da chi l'ha generata.

- `[Sviluppo]` 💶 **Pulsante «Ricalcola provvigioni» sulla riga dell'acquisto.** Corrette le
  percentuali del piano (sono soglie **cumulative**: 25 / 35 / 45, non 25 / 10 / 10), i
  pagamenti già fatti restavano com'erano. Ora si rilegge il singolo acquisto con le
  percentuali di oggi e si **aggiunge solo quello che manca**: non cancella righe di
  contabilità già registrate e, se qualcuno ha preso più del dovuto, lo segnala senza togliere
  niente — togliere soldi a una persona non è un'operazione da bottone. Rilanciarlo non
  raddoppia: la seconda volta la differenza è zero. Endpoint `POST /admin/purchases/:id/ricalcola-provvigioni`
  (solo admin); da riga di comando resta `npm run ricalcola:provvigioni`, che fa gli stessi
  conti su un'intera cliente o su tutti i pagamenti da una data.

- `[Sviluppo]` 📐 **Pagina Acquisti impaginata.** Colonne a larghezza fissa, nome prodotto su una
  riga sola coi puntini (per intero nel tooltip) e azioni a icone: cinque pulsanti scritti per
  esteso spingevano la tabella oltre il bordo dello schermo e la colonna della ricevuta restava
  tagliata. I due filtri per data sono ora uno sotto l'altro, e la pagina mostra 50 righe.

- `[Prodotto]` 🔔 **Le tre notifiche coach che mancavano, e il clic che apre la scheda.**
  Delle cinque chieste dalle coach, due c'erano già (lead assegnato, nuova registrazione col
  codice). Le altre tre no, e sono i tre momenti in cui una cliente fa un passo avanti:
  · **Questionario completato** — è il momento in cui una telefonata vale di più: ha appena
    raccontato obiettivi, abitudini e paure, e si aspetta che qualcuno le abbia lette;
  · **Prova attivata** — la finestra in cui una chiamata cambia l'esito della settimana;
  · **Rinnovo** — e qui c'era anche un difetto vecchio: la coach vedeva l'incasso **solo del
    primo mese**. Dal secondo in poi il rinnovo passava da `handleInvoicePaid`, che non avvisava
    nessuno: dalla sua parte una cliente che paga da sei mesi sembrava ferma al primo pagamento.
    Ora arrivano due notifiche distinte, perché sono due cose diverse — il rinnovo (un passo del
    percorso) e l'incasso (i suoi soldi).

- `[Sviluppo]` 👆 **Dalla notifica si apre la scheda cliente.** Il `clientId` il backend lo
  mandava **già** nel payload, da sempre: era la lista delle notifiche staff a buttarlo via. Si
  leggeva «Marta ha attivato la prova» e poi bisognava andare a cercare Marta a mano nell'elenco.
  Ora il tocco porta sulla sua scheda — `/clienti/:id` per la coach, `/pazienti/:id` per la
  nutrizionista, che condividono la pagina ma non le rotte — e la riga mostra la freccia solo
  quando c'è davvero dove andare.

- `[Prodotto]` 🔓 **Le segnalazioni arrivano sulla dashboard della nutrizionista, col motivo.**
  Il conteggio c'era già (`openEscalations`), ma serviva solo a gonfiare il badge della
  campanella: **il testo della segnalazione non compariva da nessuna parte** nell'app
  nutrizionista. Il risultato era il peggiore possibile — la cliente leggeva «la nutrizionista
  sta sistemando il tuo menu» e la nutrizionista non sapeva né di doverlo sistemare né perché.
  Ora c'è una sezione **Segnalazioni** in cima, prima delle priorità cliniche, con il motivo per
  esteso. Quelle che bloccano il piano sono in rosso e marcate **«NON RICEVE I MENU»**, e stanno
  per prime: sono le uniche in cui una paziente, in questo momento, non riceve niente. Due sole
  scelte per riga: **Sblocca il piano** e **Apri la scheda** (da lì la chat).

- `[Sviluppo]` 🧩 **«Sblocca» adesso sblocca davvero.** Prima l'unica cosa possibile era cambiare
  lo stato della segnalazione dal backoffice, ed era **cosmetico**: il blocco non è uno stato
  salvato, viene **ricalcolato a ogni composizione del menu**. Chiusa a mano, alla prima apertura
  dell'app la stessa identica segnalazione si riapriva — e nel frattempo la cliente aveva visto
  sparire il messaggio senza ricevere un menu.
  Adesso il pulsante rilancia `buildPersonalBase`, che è la cosa che decide davvero: se riesce,
  risolve i blocchi da sé e i menu ripartono; se non riesce, torna il motivo **aggiornato** — non
  quello vecchio — e la segnalazione resta aperta con l'informazione giusta.

- `[Sviluppo]` 🔒 **Un buco di riservatezza trovato per strada.** L'unico endpoint disponibile,
  `GET /admin/escalations`, restituiva le segnalazioni di **tutte le clienti** a chiunque avesse
  il ruolo — anche a una nutrizionista con tre pazienti, che si sarebbe letta i motivi clinici di
  clienti non sue. Il nuovo `/nutritionist/escalations` è filtrato sui pazienti assegnati; capo e
  admin continuano a vedere tutto.

- `[Prodotto]` 🔔 **La notifica alla cliente quando lo staff le scrive: c'era già.** Verificato
  riga per riga prima di rifarla: `chat.service.ts` crea la notifica in-app
  `chat_reply_nutritionist` / `chat_reply_coach` e chiama subito la push, con anti-raffica di 3
  minuti e rispetto dell'opt-out. Nell'app ci sono icona, deep-link a `/contatti` e interruttore
  nelle preferenze. L'unica condizione è l'app nativa col permesso notifiche: su browser la push
  non esiste, e non è un difetto nostro.

- `[Prodotto]` 🔀 **Le richieste delle coach — primo blocco.** Dodici punti arrivati dalle coach
  l'8/8. **Tre esistevano già** e nessuno lo sapeva: il sollecito questionario a 24 ore
  (`profilo_incompleto`), la mail di compleanno (`ev_compleanno`) e la notifica «nuova
  registrazione col tuo codice». Erano ferme perché il motore delle mail automatiche ha il
  master spento di default.

- `[Sviluppo]` 📬 **Copia alla coach su tutte le mail alle clienti.** Il `MailService` non aveva
  nessun campo cc/bcc: aggiunto il BCC (Brevo lo supporta via API, non era cablato). La coach si
  risale dall'indirizzo della destinataria, non va passata dal chiamante — chi manda l'email
  quasi mai ce l'ha in mano, ce l'ha il database.
  Coperte: ricevuta, bonifico, rimborso, report mensile, copie email delle notifiche, tutte le
  mail del ciclo di vita e le campagne marketing.
  **Escluse di proposito**, ed è la cosa da ricordare: reset password, verifica email, cambio
  email e credenziali del lead. Quei link **aprono la casella e il profilo della cliente**:
  girarli a una terza persona, per quanto fidata, è una porta aperta e non un servizio. Simone
  ha confermato la scelta.
  BCC e non CC per due motivi: la cliente non deve leggere l'indirizzo della sua coach in ogni
  email, e un «rispondi a tutti» finirebbe sulla casella personale della coach invece che in chat.

- `[Sviluppo]` 🧾 **Niente ricevuta sul prodotto gratuito.** `finalizeApproval` mandava la
  ricevuta sempre, anche con `amountCents: 0`: chi attivava la prova riceveva una «Ricevuta di
  pagamento» da **€ 0,00** con tanto di PDF numerato in allegato. Oltre a essere un documento che
  non documenta niente, era la prima email dopo l'iscrizione: parlare di pagamenti a chi non ha
  pagato è il modo più rapido per farle temere un addebito.

- `[Prodotto]` 🪜 **Due stati nuovi in pipeline.** «Questionario completato» (posizione 2, prima
  di Prova) scatta da solo alla fine del questionario: le coach lo avevano chiesto per vedere
  sulla board chi è pronta per la chiamata senza aprire una scheda alla volta.
  «Percorso concluso» esiste come colonna; l'automazione a +7 giorni dalla fine piano arriva nel
  prossimo blocco. Entrambi di sistema, quindi il seed li crea anche sull'installazione già
  avviata. Prova e Acquisito scalano da 2 a 3, **ma solo se sono ancora all'ordine di default**:
  se l'admin ha riordinato la board, la sua scelta vale più della nostra.
  `npm run fix:stato-questionario` sistema le clienti che l'hanno già compilato.

- `[Sviluppo]` ⬆️ **Un avanzamento che non fa retrocedere.** Nuovo `commerce/avanza-stato.ts`:
  sposta la scheda solo se lo stato richiesto è **più avanti** di quello attuale. Prima non
  c'era, e un pagamento approvato riportava sempre ad «Acquisito» anche una scheda che una coach
  aveva già spostato su Follow-up — cancellando un lavoro fatto da una persona.
  Sta in un file senza Nest perché lo usano anche moduli che non devono dipendere da commerce
  (il questionario): l'alternativa era importare CommerceModule dentro OnboardingModule per una
  riga sola, e mettersi in casa un giro di dipendenze che prima o poi si chiude ad anello.

- `[Prodotto]` ✉️ **Mail di fine prova gratuita** (`trial_fine`, nuova). Arriva il giorno in cui
  la prova si chiude, e non parla di sconti: dice quello che è vero e che dall'esterno non si
  vede — in otto giorni il motore ha preparato *N* giornate di menu e ha imparato le sue
  esclusioni, i piatti che ha sostituito, gli orari che le tornano. Se si ferma lì, quel lavoro
  resta fermo. I numeri nell'email sono i suoi, letti a runtime, non un modo di dire.
  Diversa dal win-back, che arriva a piano finito da giorni e riguarda i paganti.

- `[Sviluppo]` 🔌 **`npm run accendi:automazioni`** (una volta, a mano). Accende l'assistente AI
  in chat e il motore delle mail con **solo** i tre inneschi chiesti (sollecito questionario,
  compleanno, fine prova). Tutti gli altri implementati vengono messi **esplicitamente a spento**:
  il motore funziona a opt-out, quindi accendere il master senza quella lista farebbe partire in
  un colpo benvenuto, onboarding, promemoria rinnovo, win-back e anniversario, a clienti che non
  li hanno mai ricevuti.
  È uno script e non un default del seed per una ragione precisa: **il seed gira a ogni deploy**.
  Un «acceso» scritto lì dentro riaccenderebbe da solo un interruttore che qualcuno ha spento dal
  backoffice, e nessuno capirebbe perché. Gli interruttori sono di chi gestisce.
  Lo script controlla anche che i modelli email esistano e siano attivi: un innesco acceso senza
  modello è acceso e non manda niente.

- `[Sviluppo]` 🗓️ **Il pulsante della settimana 9 non c'era.** Segnalato da Simone con uno
  screenshot: con nove settimane in catalogo la pagina scriveva «Genera la settimana 10» su un
  pulsante che non esisteva, perché la fila ne disegnava sempre otto fisse mentre il backend ne
  accetta dodici. Ora la fila è lunga almeno quanto serve: sempre una in più di quelle già fatte.

- `[Prodotto]` 📅 **Il catalogo si genera una settimana per volta.** Aprendo le ricette della Keto
  Mediterranea erano **28 in tutto**, non 28 colazioni + 28 pranzi + 28 cene + 28 merende. Il
  generatore produceva **5 ricette per pasto** e poi *ricombinava quelle* per 28 giornate: il
  commento nel codice lo diceva («ridotto per output AI più piccolo e JSON più affidabile»), e il
  conto tornava — con 5 colazioni su 28 giorni ogni colazione torna cinque o sei volte. **La
  ripetizione non era sfortuna, era aritmetica.**
  Chiedere all'AI 140 ricette in un colpo solo riporterebbe il problema di partenza (JSON enorme e
  rotto). Quindi: **una settimana per volta**, e dentro la settimana **un pasto per volta**. Sette
  richieste piccole invece di una gigante, lanciate in parallelo.
  Nel backoffice il campo «giorni da generare» è sparito: al suo posto ci sono i pulsanti
  **Settimana 1, 2, 3…**, con la spunta su quelle già fatte e la prossima già selezionata. Oltre la
  prossima non si può saltare: settimana 1 e 3 senza la 2 lascerebbe il ciclo con giornate mancanti
  in mezzo, e il motore non sa colmarle.
  Le giornate si compongono **per indice** — giorno 1 la prima ricetta di ogni pasto, giorno 2 la
  seconda — quindi dentro la settimana non si ripete niente **per costruzione**, non per fortuna.
  Alle settimane successive l'elenco dei piatti già in catalogo va nel prompt, così l'AI non li
  ripropone.

- `[Prodotto]` 🍽️ **Le ricette sono della dieta, non della struttura pasti.** Precisazione del
  nutrizionista, e cambia parecchio: la Keto Mediterranea onnivora a **3 pasti**, a **5 pasti** e a
  **digiuno intermittente** mangia gli **stessi piatti** — cambia come sono distribuiti nella
  giornata, non che cosa sono. I piatti cambiano davvero quando cambia il **regime** (vegano,
  vegetariano) o lo **stile** (keto invece di mediterranea).
  Quindi le varianti di struttura ora **condividono le ricette**: si generano una volta sola e le
  giornate delle altre le riusano (una ricetta non appartiene a una dieta, è referenziata dalle
  giornate — condividerla non richiede duplicati). «Genera tutte le varianti» parte dalla variante
  a 5 pasti, che copre tutti i pasti che servono alle altre: le altre due non chiamano più l'AI.
  Da tre generazioni complete a una: meno attesa, meno costo, e soprattutto **le tre varianti
  restano coerenti fra loro** invece di divergere ad ogni rigenerazione.

- `[Prodotto]` 🧷 **Le ricette già corrette a mano non si buttano.** Obiezione di Simone, ed è
  quella giusta: il nutrizionista ne ha sistemate parecchie, e quel lavoro vale più di qualunque
  generazione. Quindi su una settimana che esiste già la modalità normale non è «rigenera» ma
  **«completa»**: si tengono le ricette che ci sono, si chiede all'AI **solo la differenza** per
  arrivare a sette per pasto, e si riscrivono le sette giornate perché nessun piatto torni due
  volte. **Non si cancella niente.**
  Il criterio è semplice: il «magazzino» di ogni pasto si mette in fila nell'ordine in cui i
  piatti compaiono nelle giornate; le prime `(settimana-1)×7` sono impegnate nelle settimane
  precedenti, quelle che restano vanno a questa.
  *Sulla Keto Mediterranea, che ha 5 pranzi spalmati su 28 giorni:* la settimana 1 se li prende
  tutti e cinque e ne chiede **2** nuovi; la settimana 2 trova il magazzino esaurito e ne chiede
  **7**. Alla fine i pranzi sono 28 diversi e i 5 corretti a mano sono ancora lì.
  «Rifai da capo» resta possibile, ma è una spunta da accendere apposta, con una seconda
  conferma che dice a chiare lettere che cancella anche le correzioni. E anche lì non si tocca
  mai una ricetta **già attiva**: attiva vuol dire che il motore l'ha potuta erogare, quindi può
  stare dentro un menu già consegnato. Quel menu è una fotografia e continuerebbe a mostrarsi,
  ma le valutazioni e le sostituzioni cercano la ricetta per id e non la troverebbero più. Si
  buttano solo le bozze mai attivate. Il prezzo è qualche ricetta orfana in catalogo: è il verso
  giusto in cui sbagliare.
  ⚠️ **Le diete già generate col vecchio metodo restano magre.** La Keto Mediterranea ha 28
  giornate, quindi risulta «4 settimane fatte»: vanno **completate** una settimana per volta,
  partendo dalla variante a 5 pasti (le sorelle poi riusano le sue).
  Test: +8 (660 in tutto).

- `[Prodotto]` 📄 **Guida per la nutrizionista** (`progetto/guide/`): cinque pagine, passo per
  passo, scritte per chi non è tecnico — perché i menu si ripetevano, che le sue correzioni non
  si perdono, i sette passi da fare, da quali diete iniziare e le domande che le verranno.
  Nel repo c'è anche lo script che la rigenera, così quando l'interfaccia cambia si rifà il PDF
  invece di riscriverlo.
  Insieme: `npm run diag:settimane`, che stampa le diete **già nell'ordine in cui conviene
  lavorarle** — clienti sopra, giornate, e soprattutto quanti piatti diversi ha il pasto messo
  peggio. È quel numero che conta: 28 giornate con 5 colazioni sono peggio di 7 giornate con 7.

- `[Prodotto]` 🔢 **Il conto vero: 287 varianti, 286 magre, ma solo 16 con qualcuno sopra.** Il
  primo giro di diagnostica ha ridimensionato il lavoro. Rifare tutto a mano non è un lavoro che
  si fa; e non serve, perché **le clienti attive sono 25 su 16 varianti**, che condividendo le
  ricette si riducono a **12 diete**. Nella guida c'è quella lista, in ordine, con quante clienti
  ha ciascuna: sono circa 48 generazioni, meno di un'ora. Le altre 270 varianti non hanno nessuno
  sopra e si rigenerano quando servono, non prima.
  Due cose emerse dal giro, che non sono varietà ma difetti veri:
  · **«Vacanze in Serenità» onnivora dimagrimento 3 pasti ha SOLO le colazioni** — niente pranzo,
    niente cena — e **c'è una cliente che la sta ricevendo**. Va guardata per prima.
  · **«Ritorno in Equilibrio» onnivora mantenimento 3 pasti è del tutto vuota**: zero giornate.
    La diagnostica la contava fra quelle «già a posto» — un difetto suo, corretto: adesso una
    dieta senza giornate esce come *VUOTA* e va in cima, e una a cui mancano interi pasti esce
    marcata *MANCANO INTERI PASTI*, perché lì non è questione di ripetizioni.

- `[Prodotto]` 🌶️ **Le spezie non sono più un cibo da escludere.** La regola l'ha dettata la
  nutrizionista, e nasce dalla cliente che riceveva lo stesso pranzo per quattro giorni di fila.
  Non era un difetto del motore: aveva trenta esclusioni, e fra quelle c'erano **curry** e
  **cumino**. Una spezia è una pizzicata, ma il motore la tratta come tutti gli altri
  ingredienti — cerca la parola nel nome e negli ingredienti e **scarta l'intero piatto**. Così
  «non mi piace il curry» le aveva cancellato dal ricettario ogni piatto speziato, e i pranzi
  utilizzabili erano scesi a **uno su cinque**.
  Da oggi:
  · se scrive il nome di una **spezia precisa** (curry, cumino, cannella, zafferano, paprika,
    peperoncino, e anche le erbe aromatiche) → non entra fra i cibi esclusi, e le risponde un
    pop-up: **«sostituiscila con le spezie che più ti piacciono»**, con la spiegazione del
    perché — la spezia la mette lei in cucina, quindi la scelta resta sua senza costarle metà
    del ricettario;
  · se scrive **«spezie» in generale** → **«contatta la tua coach per analizzare come utilizzare
    i menu senza spezie»**. Non è una preferenza da registrare al volo: è una conversazione.
  Il cancello vale per **tutte** le portate, non solo per «non mi piace»: anche una sostituzione
  di tre giorni farebbe scartare i piatti speziati, che è esattamente il danno da evitare.

- `[Sviluppo]` 🚪 **Il cancello è in tre punti, non in uno.** La strada normale è
  `POST /me/menu/substitute`, ma i cibi non graditi si scrivono anche dal **questionario** e
  dalla **PATCH del profilo** (la sezione "Cibi esclusi" manda la lista intera). Una regola
  messa in un punto solo si aggira dalla finestra, quindi il filtro sta in tutti e tre, e la
  logica sta in **un file solo**: `backend/src/menu/spezie.ts`.
  Due limiti sono voluti e scritti nel file:
  · **allergie e intolleranze non passano mai di qui.** Senape, sesamo e sedano sono allergeni
    UE: quella è sicurezza, non gusto, e resta un'esclusione vera;
  · **il confronto è esatto, non per sottostringa.** «noce moscata» è una spezia, «noce» è
    frutta a guscio; «pepe» è una spezia, «peperoni» sono una verdura. Cercare per sottostringa
    le confonderebbe, ed è il tipo di errore che qui costa caro. Aglio e cipolla restano cibo:
    si usano a peso, non a pizzichi.
  Il testo del pop-up viaggia anche nel campo `message`, così le **app già installate** — dove
  gli aggiornamenti OTA sono spenti dal 6/8 — lo mostrano lo stesso al posto della conferma.
  Test: +13.

- `[Sviluppo]` 🧹 **Chi la spezia ce l'ha già in lista continuava a subirla.** La regola nuova
  protegge chi arriva da qui in avanti; per le altre c'è `npm run pulisci:spezie`, che elenca
  cliente per cliente quali spezie toglie e quanti cibi **veri** restano esclusi dopo. Mostra e
  basta finché non si lancia con `CONFERMA=1`.
  Chi aveva escluso «le spezie» in generale finisce in un elenco a parte: il termine si toglie
  lo stesso (altrimenti continua a svuotarle il ricettario) ma la telefonata della coach va
  fatta lo stesso — non la sostituisce uno script.
  I menu già consegnati non si toccano: si riallineano da soli alla prossima erogazione, e
  rifarli confonderebbe chi ha già fatto la spesa.

- `[Sviluppo]` 🔔 **Notifiche doppie alle coach di notte: corretto.** Prima delle tre cose
  trovate nella revisione di ieri sera, ed è una conseguenza diretta del cambio di "oggi" del 7/8.
  `notifyOncePerDay` confrontava una **mezzanotte** con un **istante**: da quando la mezzanotte è
  quella italiana, fra le 22:00 e le 24:00 UTC quella mezzanotte è già di domani — cioè **nel
  futuro** — e la finestra non trovava le notifiche appena scritte.
  *Cosa vedeva la coach:* una cliente che le scrive alle 00:10 e poi alle 00:50 le faceva arrivare
  **due** notifiche; se riscriveva la mattina dopo, una **terza**.
  Ora si confrontano due grandezze omogenee: si prende l'ultima notifica di quel tipo e si guarda
  se il suo **giorno italiano** è oggi. La finestra mobile (`dedupeWindowMs`) resta un confronto
  fra istanti, che era già giusto. Test: +5.

- `[Sviluppo]` 🎲 **Un test che sarebbe diventato instabile stanotte.** In
  `menu-measurement-gate.spec.ts` l'helper `dayIso` era rimasto sul giorno **UTC** mentre il
  codice sotto test confronta col giorno **romano**: se la CI fosse girata fra le 22:00 e le
  24:00 UTC, il caso «2° giorno nel futuro → non bloccante» sarebbe fallito. Non è successo solo
  per l'orario in cui abbiamo lanciato. Ora l'helper usa `giornoLocale`, cioè la stessa funzione
  del codice che verifica.

---

## 2026-08-07

- `[Sviluppo]` 📱 **Lo stesso difetto delle date era anche nell'app — in sette punti.** Corretto
  il backend, la stessa riga (`new Date().toISOString().slice(0, 10)`, cioè il giorno **UTC**)
  compariva ancora in Home, Percorso, Obiettivo, passi, StartDatePrompt, MenuReviewPopup e
  PaymentResult. Nella finestra fra mezzanotte e le 02:00, per l'app era ancora ieri:
  · il **menu di oggi** in Home e in Percorso veniva cercato alla data sbagliata e quindi **non
    compariva** — schermata vuota su un piano perfettamente attivo;
  · i **passi** finivano sul giorno precedente, e la baseline del contapassi si azzerava male;
  · la pagina Obiettivo credeva che la misura di oggi non fosse stata inviata.
  Va detta anche una cosa scomoda: **correggendo solo il backend avevo peggiorato la
  situazione** in quella finestra. Prima app e server sbagliavano insieme, quindi almeno si
  capivano; dopo, il server registrava il giorno italiano e l'app ne chiedeva un altro. Una
  correzione a metà, su due sistemi che si parlano, può essere peggio di nessuna correzione:
  vale la pena ricordarselo.
  Ora c'è `app/src/lib/giorno.ts`, che dà la **stessa** risposta di `common/date-only.ts` lato
  server.

- `[Sviluppo]` 🧭 **Il giorno è quello del percorso, non quello del telefono.** Scelta esplicita:
  l'app usa il calendario **italiano**, non il fuso del dispositivo. Usare quello del telefono
  sembra più gentile, ma metterebbe di nuovo app e server in disaccordo appena una cliente parte
  per un viaggio: lei chiederebbe il menu di un giorno e il database ne conoscerebbe un altro.
  Il giorno del percorso è uno solo. Se un domani si cambia `APP_TIMEZONE` sul backend, va
  cambiato anche in `giorno.ts` — sta scritto in cima a entrambi i file.
  Corretto anche il **backoffice**, pagina Contabilità: un costo registrato di notte finiva al
  giorno prima, e il 1° gennaio a notte fonda finiva nel **mese e nell'anno precedenti** — cioè
  nel bilancio sbagliato.
  Test: +5 nell'app (10 in tutto, la seconda cosa che i test dell'app intercettano da quando
  esistono, cioè da stamattina).

- `[Sviluppo]` 🌙 **Le misure inserite di notte finivano sul giorno prima — e cancellavano quelle
  del giorno prima.** Cercando altri difetti della stessa famiglia (logica giusta, contorno
  sbagliato) è saltato fuori questo, che è il più serio della giornata perché **perde dati**.
  `toDateOnly()` leggeva il giorno **UTC**. Il server sta a Francoforte, le clienti stanno in
  Italia, e d'estate l'Italia è avanti di due ore: fra la **mezzanotte e le 02:00** — l'01:00
  d'inverno — in Italia è già domani mentre per UTC è ancora ieri.
  Quindi una cliente che si pesa alle 00:30 dell'8 agosto veniva registrata al **7**. E siccome
  le misure hanno un vincolo di unicità per `(cliente, data)` e si salvano in `upsert`, quella
  pesata **sovrascriveva la misura del 7**: il dato del giorno prima spariva. Nessun errore,
  nessun avviso — solo un punto del grafico che cambia valore, e un calo che non torna.
  Stesso effetto su check-in, acqua, passi e sul gate misure, che a quel punto crede che la
  misura di «oggi» ci sia già e non la chiede.
  Ora «oggi» è il giorno del **fuso dell'azienda** (`APP_TIMEZONE`, default `Europe/Rome`,
  cambiabile da Render senza deploy), che è quello che intendono sia la cliente sia la coach.
  Il dato resta salvato a mezzanotte UTC, perché la colonna è un DATE e il confronto deve
  restare stabile.
  Una scelta che vale la pena spiegare: una stringa di **sola data** (`2026-08-08`) si prende
  alla lettera, senza conversione. Non contiene un orario, quindi non c'è niente da convertire —
  e convertirla la sposterebbe di un giorno in tutti i fusi a ovest di Greenwich, cioè
  introdurrebbe lo stesso difetto al contrario.
  ⚠️ Il passato non si tocca: le misure già registrate restano dove sono. Se in un grafico c'è
  un salto strano su una data, adesso si sa da dove può venire.

- `[Sviluppo]` ♻️ **«Che giorno è oggi» era scritto in tre posti, e in tre posti sbagliato.**
  La stessa riga (`toISOString().slice(0,10)`) era copiata in `diet-agent.service`, in
  `conversation-summary.service` e dentro `stato-viaggio.ts`. Tutte e tre leggevano il giorno UTC,
  quindi tutte e tre avevano lo stesso difetto — ma in punti che nessuno avrebbe collegato al caso
  delle misure: lo stato dell'agente dieta, i riassunti delle conversazioni, la scadenza della
  modalità viaggio.
  È il terzo caso in due giorni di logica copiata che diverge — dopo `pickDiet` e la lettura dei
  campi numerici — e la lezione è sempre la stessa: **una definizione, un posto**. Ora tutte
  passano da `date-only.ts`, che è l'unico file dove sta scritto cosa vuol dire «oggi».
  Test: +9 (59 suite, 620 test).

- `[Sviluppo]` 🧹 **Finito il giro sui messaggi delle clienti, e ora c'è un test che li rende
  obbligatori.** Completate le schermate che mancavano: chat con la coach, sostituzione
  ingrediente, lista della spesa, valutazione ricette, caricamento documenti, buono sconto,
  eventi in agenda, richiesta di sospensione, «i miei dati», tema. Erano tutte con i messaggi di
  default di class-validator, in inglese e col nome della colonna del database dentro.
  Qualche esempio di cosa cambia davvero:
  · caricando un'analisi in formato sbagliato, prima arrivava l'elenco dei mime-type
    (`mimeType must be one of the following values: application/pdf, image/jpeg…`); ora c'è
    scritto **cosa fare**: «Puoi caricare un PDF o una foto (JPG, PNG, HEIC). Se hai un altro
    formato, fanne uno scatto».
  · sostituendo un ingrediente, `ingredient must be longer than or equal to 2 characters`
    diventa «Scrivi il nome dell'ingrediente per esteso (almeno 2 lettere)».
  · un messaggio troppo lungo alla coach non è più `body must be shorter than or equal to 4000
    characters` ma «Il messaggio è troppo lungo: dividilo in due, si legge meglio».

- `[Sviluppo]` 🔒 **La regola ora è verificata, non ricordata** (`messaggi-clienti.spec.ts`).
  Il problema di fondo non era in un file: `class-validator` mette il messaggio in inglese **di
  default**, quindi un DTO nuovo nasce sbagliato senza che nessuno faccia niente di male, e ce ne
  accorgiamo solo quando ci sbatte contro una persona vera. È letteralmente quello che è
  successo oggi, due volte.
  Il test nuovo legge i **metadati dei decoratori** dei DTO che le clienti compilano e fallisce
  se trova un vincolo senza `message`. Non controlla il testo — quello resta un mestiere umano —
  ma garantisce che ce ne sia uno. Quando fallisce dice anche cosa scrivere: *cosa fare*, non
  cosa è sbagliato.
  Il limite è dichiarato nel test stesso: **non c'è modo di scoprire da soli quali DTO siano
  client-facing**, quindi la lista si allunga a mano quando nasce una schermata. È comunque
  meglio di una convenzione che nessuno può far rispettare: chi aggiunge un DTO a quella lista
  lo protegge per sempre.
  Test: +10 (58 suite, 611 test).

- `[Sviluppo]` 🔎 **Lo stesso difetto era vivo in altri due posti, e uno era la REGISTRAZIONE.**
  Sistemata la segnalazione di Daniela, ho passato in rassegna tutti i DTO che una **cliente**
  compila (non quelli del backoffice: lì il messaggio in inglese è brutto ma lo legge
  un'operatrice). Il difetto non era in un file, era in un **modo di scrivere i DTO** — campo
  numerico facoltativo + `@Min` + casella vuota che arriva come `0` — e si ripete ogni volta che
  se ne aggiunge uno. Trovato ancora aperto in due punti:
  · **`startWaistCm` e `startHipsCm` del questionario di registrazione.** Chi non si è mai
    misurata li lascia in bianco, e il questionario si rifiutava di partire con
    «startWaistCm must not be less than 40». È il punto peggiore in cui potesse capitare: al
    primo contatto col prodotto un errore incomprensibile non fa perdere una funzione, fa
    perdere la persona. Non so quante si siano fermate lì.
  · **`weightToLoseKg`, `weeks` e `waistToLoseCm` della modifica obiettivo**: svuotare una
    casella per cambiarne un'altra faceva fallire il salvataggio.
  La regola ora sta in un posto solo (`common/validazione.ts`), con **due varianti**, perché la
  differenza conta: sulle circonferenze lo zero è un campo vuoto, ma su «quanti cm di girovita
  voglio perdere» **0 è una risposta** — vuol dire «quella misura non me la pongo». Confonderle
  avrebbe cancellato in silenzio la scelta di una cliente.

- `[Sviluppo]` 🇮🇹 **Messaggi di errore in italiano dove li legge una persona.** Nella stessa
  passata: registrazione, obiettivo, check-in giornaliero, acqua, passi, cambio password, primo
  accesso, cancellazione account e login. Erano tutti quelli di default di class-validator, col
  nome del campo del database dentro — «newPassword must be longer than or equal to 8
  characters» a chi sta cercando di entrare per la prima volta.
  Dove serviva ho scritto **cosa fare**, non cosa è sbagliato: «I passi vanno indicati con un
  numero intero, senza punti (es. 10000)» invece di «steps must be an integer number», che è il
  messaggio che riceve chi scrive «10.000» — cioè chiunque.
  I limiti **non** sono stati allargati: 5 cm di girovita resta rifiutato, il peso resta
  obbligatorio. Tollerare lo zero non vuol dire tollerare tutto.
  Test: +16 (57 suite, 601 test).
  ⚠️ Resta una lacuna nota, e vale la pena scriverla: **non c'è un `exceptionFactory`** nella
  `ValidationPipe`, quindi ogni DTO nuovo nasce con i messaggi in inglese e nessuno se ne accorge
  finché non ci sbatte contro qualcuno. Le parti più esposte sono coperte; il resto (chat,
  documenti, buoni sconto, eventi) è elencato e ordinato per probabilità, da fare quando c'è
  tempo.

- `[Sviluppo]` 🩺 **«Salva correzione» non salvava: la colpa era di una casella VUOTA.**
  Segnalato da una cliente il 7/8, con lo screenshot: correggeva peso e vita, lasciava vuoti i
  **fianchi** perché non li aveva mai misurati, e sotto il pulsante compariva
  `hipsCm must not be less than 40` — in inglese e col nome del campo del database. Da fuori
  sembrava semplicemente un pulsante rotto.
  **La causa è una riga:** `Number('')` fa **0**, e zero è un numero valido a tutti gli effetti.
  La casella vuota partiva quindi come `hipsCm: 0`, il backend la rifiutava — giustamente, 0 cm
  non è una misura — e le rimandava indietro il messaggio di default del validatore.
  La beffa: la **stessa funzione**, nel popup delle misure, aveva il controllo `> 0` e infatti lì
  funzionava. Due copie della stessa lettura, una giusta e una no; la pagina Obiettivo aveva
  quella sbagliata. È il terzo caso in due giorni di logica copiata che diverge, e come gli altri
  si è chiuso unendola: `app/src/lib/misure.ts`, una sola `parseMisura()` usata da entrambe.

- `[Sviluppo]` 🛡️ **Corretto anche il BACKEND, e non è ridondanza: è quello che sistema le
  clienti di oggi.** Idea di Simone — «invece di mandare l'OTA, forziamo lo zero a null lato
  server». Giusta per due ragioni diverse:
  · la correzione lato app arriva solo con una **pubblicazione sugli store** (gli OTA sono spenti
    dal 6/8): fino ad allora, chi ha l'app installata resterebbe bloccato. Il deploy del backend
    invece è immediato e le sistema tutte, qualunque versione abbiano;
  · e comunque **nessun client va creduto sulla parola**. Che l'app non mandi più zeri è una
    promessa dell'app, non una garanzia del server.
  Ora vita, fianchi e cosce passano da un `@Transform`: `0`, `''`, `null` e i negativi diventano
  «campo non compilato». Si può fare senza ambiguità perché una circonferenza di 0 cm non esiste.
  Il **peso resta fuori**: è obbligatorio, e uno zero lì è un errore da segnalare, non una casella
  lasciata in bianco. Un valore assurdo (5 cm) viene ancora rifiutato — tollerare lo zero non
  vuol dire tollerare tutto.
  Nella stessa passata, i **messaggi di validazione delle misure sono in italiano**: quel testo lo
  legge la cliente, e «hipsCm must not be less than 40» non dice cosa fare e sembra un guasto.
  E l'**audit della correzione** ora registra i valori davvero scritti invece di quelli richiesti:
  un campo non compilato arriva come `undefined` e Prisma lo interpreta come «non toccare», quindi
  il vecchio valore resta — scriverci `null` significava annotare una modifica mai avvenuta,
  proprio nel registro che si va a leggere quando qualcosa non torna.
  Test: +10 sul DTO (56 suite, 585 test).
  ⚠️ Nota sul perimetro: l'**app non ha un test runner** (backend e backoffice sì). La `parseMisura`
  è quindi coperta solo dal lato backend, che è il punto dove la richiesta entra davvero — ma è
  una lacuna, ed è il motivo per cui un difetto così banale è arrivato a una cliente.

- `[Sviluppo]` 👀 **Il backfill delle diete ha mostrato una cosa che non sapevamo:
  `npm run diag:famiglie`.** L'anteprima di `fix:diet-family` su 30 profili non ha trovato
  nessun ripiego su uno stile sbagliato — bene — ma ha reso visibile il difetto vero, quello per
  cui era nato tutto il lavoro sulle famiglie:
  · **5 clienti** che avevano chiesto `mediterranean` stanno ricevendo **Pescetariana**, cioè
    menu **senza carne**. Non l'ha chiesto nessuna di loro e non gliel'ha proposto nessuno: con
    quello stile ci sono anche Mediterranea e Mediterranea ipocalorica, e il motore prendeva la
    più recente ad essere approvata;
  · **10 clienti** su `flexible` ricevono **Flexitariana**, una **Vegana**, per lo stesso
    meccanismo;
  · le altre sono univoche e vanno bene (keto, proteica, keto-mediterranea, low carb).
  **Fissarle comunque è la scelta giusta**, ed è quella presa: quelle clienti ricevono
  Pescetariana oggi e continuerebbero a riceverla comunque, perché il motore sceglie sempre la
  stessa. Fissarla non cambia niente per loro — la rende *visibile* e correggibile dalla scheda,
  invece che frutto di un ordinamento per data.
  Ma «visibile» serve solo se qualcuno la guarda, quindi il nuovo script elenca **solo i casi
  ambigui** (stile con più di una famiglia approvata e visibile), con nome, email, cosa riceve
  oggi e le **alternative** accanto. Chi ha uno stile con una famiglia sola non compare: non
  c'era niente da scegliere. Non tocca niente; si corregge dalla scheda cliente, e al ciclo di
  menu successivo l'abbinamento riparte dal prodotto giusto.

- `[Sviluppo]` 📌 **`STATO.md`: «Vacanze in Serenità» risulta già creata in produzione.** La voce
  dei piani stagionali diceva «manca creare i due prodotti dal backoffice»: nell'elenco del
  backfill compare una cliente reale (stile `summer_holiday`) che sta ricevendo proprio
  **«Vacanze in Serenità»**, quindi la dieta esiste, è approvata ed è visibile. Da non
  confondere con «Vacanza estiva», che è il nome del prodotto **di esempio** creato dal seed.
  Di «Ritorno in Equilibrio» non ho evidenza — nessuna cliente su `summer_return` — quindi
  quella metà resta aperta.

- `[Prodotto]` 💶 **Provvigioni del Monitoraggio compilate in Negozio: 25% totale** (deciso da
  Simone il 7/8, «ridotta, 25 totale, proporzionata come le altre»). Scritte a mano nel
  backoffice di produzione, dopo aver **letto** le percentuali vere invece di fidarsi del
  commento nel codice: i percorsi 1/3/6 mesi hanno Coach 25 · Coord. 10 · Mgr 10 · Nutriz. 10 ·
  Capo n. 5 (a differenza), cioè catena coach al **45%**.
  Portare il totale a 25 tenendo le stesse proporzioni dà **Coach 14 · Coordinatrice 19 ·
  Manager 25** (i valori sono cumulativi per livello; a schermo diventano 14% + 5% + 6%),
  nutrizionista e capo nutrizionista a **zero** come sul mantenimento. Su €19 al mese: €2,66
  alla coach, €4,75 all'intera catena, €14,25 + IVA a Metabole prima di Stripe.
  Verificato nella stessa occasione, **senza toccare niente**: il **Mantenimento** era già a
  posto (€49, «A scelta», Coach 25 · Coord. 10 · Mgr 10, nessun nutrizionista) e il **«Menu di
  rientro (8 giorni)»** risulta **Nascosto**, cioè il seed lo ha ritirato davvero al deploy.
  Il perché di quel 25 resta scritto altrove ed è la parte che conta: il monitoraggio è un
  prodotto che dura anni e chiede pochissimo lavoro ricorrente — con la quota piena la rete si
  sarebbe portata via quasi metà di €19.

- `[Sviluppo]` 🗺️ **`STATO_LANCIO.md` rimesso in pari: due righe dicevano il falso.** È la pagina
  che si guarda per sapere «cosa manca per aprire», ed era ferma al 16 luglio.
  · «**Build/test in pipeline (CI)**» risultava ⬜: la CI esiste dal 6/8, compila i tre pacchetti
    e lancia i test, e da quel giorno **senza `continue-on-error`** — un rosso blocca davvero.
    Verificato leggendo `.github/workflows/ci.yml`, non a memoria.
  · «**Rimuovere `_to_delete/schema_1.prisma`**» risultava ⬜ mentre **due righe più su**, nella
    lista delle cose fatte, c'era già «schema_1.prisma rimosso ✅». Aveva ragione la seconda:
    `git ls-files` conferma che non è più tracciato.
  Una pagina di stato che riporta come da fare cose fatte è peggio di una pagina assente: si
  smette di crederle, e allora smette di servire.
  Aggiunta una sezione nuova — **«Abbonamenti ricorrenti: cosa manca per venderne uno»** — che
  separa quello che è chiuso (codice, app, backoffice, configurazione Stripe) da quello che
  resta, cioè **dati**: prezzi e provvigioni dei due piani in Negozio, la verifica con
  `diag:ricorrente`, e il primo addebito ricorrente vero con carta vera. Le provvigioni nascono
  a zero per tutti i ruoli, ed è la cosa che nessuno dei due sistemi segnala da solo: il primo
  rinnovo semplicemente non paga la coach.

- `[Sviluppo]` 🧭 **`npm run diag:ricorrente` — «si può davvero vendere un abbonamento oggi?»**
  Il codice del ricorrente è scritto e testato, ma nessun test può rispondere a quella domanda:
  dipende da **dati** in produzione e da **configurazione**, non da logica. E tutti i modi di
  essere «quasi pronti» sono silenziosi, che è il motivo per cui vale la pena di uno script:
  · il piano esiste ma è rimasto `one_time` → la cliente paga **una volta sola** e non se ne
    accorge nessuno: la schermata dice che è andato tutto bene, e infatti è andato tutto bene —
    solo che il mese dopo non arriva niente;
  · il piano è in abbonamento ma con prezzo **zero** → Stripe rifiuta la sessione e la cliente
    vede un errore generico;
  · le **provvigioni sono a zero per tutti i ruoli**, che è come i piani nascono dal seed: al
    primo rinnovo la coach non prende niente, e se ne accorge lei prima di noi;
  · al piano del monitoraggio è stato cambiato il `period` → torna visibile a chiunque.
  Lo script guarda i dati veri, non tocca niente, e distingue i **problemi** (esce 1) dalle cose
  **da sapere** (piano disattivato di proposito, abbonamenti a mese singolo senza id Stripe:
  giusto che non si rinnovino).
  Quello che **non** può controllare lo dice: eventi della webhook e portale clienti si leggono
  solo dal pannello Stripe, e sono annotati in `STATO.md`.

- `[Sviluppo]` ⚙️ **Stripe configurato: la webhook ora ascolta 5 eventi e il portale clienti
  esiste.** Fatto direttamente nel pannello (Simone ha aperto Stripe e ha dato il via libera).
  · **Webhook** `metabole-backend.onrender.com/api/v1/payments/webhook`: da **1 evento a 5** —
    `checkout.session.completed` (c'era), più `invoice.paid`, `invoice.payment_failed`,
    `customer.subscription.deleted`, `customer.subscription.updated`. Senza questi, tutto il
    codice del ricorrente scritto ieri non avrebbe ricevuto niente da elaborare.
  · **Portale clienti**: prima non esisteva nessuna configurazione, quindi «Aggiorna la carta»
    dal profilo avrebbe risposto errore alla prima cliente che ci provava. Ora c'è la
    configurazione predefinita (`bpc_1U1hiG…`), con aggiornamento dei metodi di pagamento attivo
    e **annullamento a fine periodo di fatturazione** — la stessa regola nostra, non
    l'annullamento immediato.
  · **Nuovo gestore `customer.subscription.updated`**: è il quinto evento, e serve per una porta
    sola. La disdetta si fa dall'app, ma il portale Stripe ha *anche lui* il pulsante «Annulla
    abbonamento». Se una cliente entra per aggiornare la carta e disdice da lì, Stripe imposta
    `cancel_at_period_end` e noi non lo sapremmo: il profilo avrebbe continuato a dire «si
    rinnova il 5 settembre» per un mese intero, su un abbonamento che non si sarebbe rinnovato.
    Il finale sarebbe stato comunque corretto — `customer.subscription.deleted` arriva a
    scadenza — ma per un mese l'app avrebbe detto una cosa falsa alla cliente. Ora quel flag si
    allinea, e solo quello: le altre modifiche (prezzo, piano, stato) restano fuori di proposito,
    perché indovinare cosa farne significherebbe scriverlo su dati di pagamento.

- `[Sviluppo]` 🔍 **Correzione onesta alla voce di ieri sul campo `invoice.subscription`.**
  Aprendo il pannello ho visto una cosa che ieri non sapevo: l'endpoint webhook è **fissato
  all'API `2024-04-10`**, non alla versione dell'SDK. Stripe consegna gli eventi con la versione
  dell'**endpoint**, quindi la fattura sarebbe arrivata nella forma vecchia — con
  `invoice.subscription` presente — e il codice di ieri, così com'era, avrebbe funzionato.
  Quindi: il difetto era reale ma **condizionale**, non certo. Diventava certo nel momento in cui
  qualcuno avesse aggiornato la versione API dell'endpoint (una riga in un menu a tendina) o
  creato un endpoint nuovo, che nasce sulla versione corrente dell'account. La correzione — che
  legge entrambe le forme — resta giusta e anzi ora si sa perché: l'unica versione che conta è
  quella dell'endpoint, e non è quella dell'SDK con cui scriviamo il codice. Ma la voce di ieri
  diceva «ogni rinnovo sarebbe stato perso», e non era esatto: sarebbe stato perso **dopo** un
  cambio di versione fatto senza pensarci.

- `[Sviluppo]` 💣 **Il rinnovo non sarebbe MAI stato registrato — e i soldi arrivavano lo stesso.**
  Trovato rileggendo il ricorrente prima che toccasse un pagamento vero. È il difetto peggiore
  scritto finora, non per quanto è complicato ma per come si sarebbe manifestato: **da nessuna
  parte**.
  Nell'SDK Stripe 22 che abbiamo installato l'API predefinita è `2026-06-24.dahlia`, e da quella
  versione la fattura **non ha più** il campo `invoice.subscription`: l'abbonamento sta in
  `invoice.parent.subscription_details.subscription`. `handleInvoicePaid` leggeva solo il campo
  vecchio, quindi ogni `invoice.paid` di rinnovo usciva alla seconda riga con «fattura non legata
  a un abbonamento».
  Il risultato al primo rinnovo vero: Stripe incassa i €49, la webhook risponde 200, e da noi non
  nasce **niente** — nessun pagamento a database, nessuna provvigione alla coach, nessuna
  ricevuta alla cliente. E soprattutto la **scadenza dell'abbonamento non si sposta**: la cliente
  che paga regolarmente si sarebbe vista scadere il percorso. Un incasso mensile invisibile su
  entrambi i lati del libro.
  Ora si leggono **entrambe le forme**, con la nuova che ha la precedenza: la versione API con
  cui Stripe consegna gli eventi dipende dall'**account** (e da come è configurato l'endpoint),
  non dall'SDK — un account ancora su una versione precedente continua a mandare la forma
  vecchia, e sbagliare al contrario sarebbe stato lo stesso guaio speculare. Stessa correzione su
  `invoice.payment_failed`, e `checkout.session.completed` ora accetta l'abbonamento sia come id
  sia come oggetto espanso.
  Test: +7 in un file dedicato (55 suite, 575 test).
  ⚠️ **Da fare in Stripe prima del primo abbonamento vero** (non è codice, è configurazione):
  l'endpoint webhook oggi è iscritto al solo `checkout.session.completed` — quello che serviva
  per gli acquisti una-tantum. Vanno aggiunti **`invoice.paid`**,
  **`invoice.payment_failed`** e **`customer.subscription.deleted`**: senza, il codice qui sopra
  non riceve niente da elaborare e siamo daccapo. Va anche attivato il **Customer Portal**
  (Impostazioni → Fatturazione → Portale clienti), altrimenti «Aggiorna la carta» dal profilo
  risponde errore.

- `[Sviluppo]` 🏖️ **La modalità viaggio ora la legge anche l'agente dieta — e scade.** Era
  l'ultima cosa aperta dei piani estate (`STATO.md`: «`DietAgentService` non legge
  `travelState`»). Lo stato c'era, con date e stati `in_partenza / in_vacanza / rientrato`, ma
  serviva solo a sospendere il popup misure: il motore continuava a scegliere i menu come se la
  cliente fosse a casa.
  Ora:
  · **in vacanza** → nuovo stato `vacanza`, che **vince su tutto**, plateau compreso. Spingere
    l'efficacia addosso a chi è al mare non produce chili persi, produce menu ignorati. È il
    senso di *Vacanze in Serenità*: si tiene il peso, non si cerca il calo. Nei pesi si comporta
    come il conforto (menu più amati), ma resta uno **stato separato** perché nei log e nelle
    diagnosi «in vacanza» e «giornata storta» non vanno confusi.
  · **in partenza** → `pre_evento`: una partenza è un evento a tutti gli effetti, e riusa i pesi
    già tarati (più proteico) invece di inventarne di nuovi.
  · **rientrata** → `post_evento` per `agent_return_days` giorni (7 di default), che è
    *Ritorno in Equilibrio*.

- `[Sviluppo]` ⏳ **Il bug che ho trovato mentre lo collegavo: «in vacanza» non finiva mai.**
  `travelState` lo scrive un'operatrice dalla scheda cliente e **non lo azzera nessuno** — non
  c'è un lavoro notturno che lo pulisca, e non c'è motivo per cui una coach debba ricordarsene.
  Il codice leggeva il campo grezzo, quindi un «in vacanza» di luglio valeva ancora a novembre.
  Non è un dettaglio estetico: quello stato **sospende il popup misure**, cioè la regola più
  severa che abbiamo (senza pesata, il giorno dopo l'app si blocca). Una vacanza dimenticata la
  spegneva **per sempre** su quella cliente, senza un errore e senza un avviso — e dal di fuori
  sembrava semplicemente che il gate non funzionasse.
  Ora lo stato ha una scadenza (`stato-viaggio.ts`), e le date che l'operatrice inserisce servono
  a qualcosa: con la **data di fine** vale fino a quel giorno compreso; con la sola **partenza**
  vale `travel_max_days` giorni (30 di default, solo come rete di sicurezza per i casi
  dimenticati); **senza nessuna data** vale come prima — inventare una scadenza dal nulla
  spegnerebbe vacanze vere senza che nessuno capisca perché.
  Il **rientro** non passa di lì, perché non è un periodo ma un istante: la sua durata si conta
  dall'evento `travel_return`, che nasce nel momento esatto in cui l'operatrice segna il rientro
  e quindi ha una data vera. Il campo sul profilo, invece, resta scritto per sempre — ed è
  esattamente il motivo per cui non ci si può basare.
  Due parametri nuovi da backoffice: `agent_return_days` (7) e `travel_max_days` (30).
  Test: +14 (54 suite, 569 test).

- `[Sviluppo]` 🩹 **Clienti già registrate: si fissa la dieta che ricevono già** (`npm run
  fix:diet-family`). Domanda di Simone appena finito il lavoro sulle famiglie: «per i clienti
  esistenti cosa facciamo?». Lasciare il campo vuoto **non era neutro**: `pickDiet` ordina per
  `approvedAt desc`, quindi il giorno in cui il nutrizionista approva una dieta nuova con lo
  stesso stile+regime+obiettivo+pasti, quella diventa la vincitrice e la cliente **cambia dieta
  da sola**, senza che nessuno l'abbia deciso. Con 18 diete su pochi codici stile non è un caso
  di scuola: è quello che sarebbe successo alla prossima pubblicazione.
  Non c'è niente da indovinare, perché la dieta vera è scritta: lo script legge l'**ultimo menu
  erogato** (`menu_day.diet_id`) e, se i menu non sono ancora partiti, il **pool ricette**
  personalizzato. Fissa quella famiglia sul profilo — quindi **oggi non cambia nulla per
  nessuna**, e da domani il catalogo può crescere senza spostare le clienti già avviate.
  Due categorie restano fuori, ed è voluto: chi non ha mai ricevuto un menu (nessuna dieta
  "sua" da fissare: resta vuota e continua ad abbinarsi per stile) e chi sta ricevendo una dieta
  di uno **stile diverso** da quello scelto. Quest'ultima lista è preziosa: è il ripiego di
  `pickDiet` quando per lo stile richiesto non esiste una variante approvata — fissarla
  renderebbe permanente un ripiego, mentre quello che serve è **pubblicare la variante
  mancante**. Lo script la stampa a parte, come elenco dei buchi di catalogo da colmare.
  Anteprima di default, scrive solo con `CONFERMA=1`, come `fix:assegnazioni`.

- `[Sviluppo]` 🥗 **In registrazione una card per PRODOTTO, non più una per stile.** È la
  segnalazione di Simone del 6/8: il backoffice mostrava 18 diete, l'app 8. La metà cosmetica
  (il nome vero al posto del codice stile) era già sistemata; questa è la parte strutturale.
  **Il problema non era la vetrina, era l'abbinamento.** La registrazione salvava solo lo
  *stile*, e lo stile non identifica un prodotto: Vegana, Vegetariana, Flexitariana e Flessibile
  hanno tutte `style = flexible`; Mediterranea, Mediterranea ipocalorica e Pescetariana sono
  tutte `mediterranean`. Per questo l'elenco le schiacciava in una voce sola — e togliere il
  raggruppamento senza toccare il motore avrebbe peggiorato le cose: la cliente ne sceglieva una
  e poteva ricevere l'altra, in silenzio.
  Ora sul profilo c'è la **famiglia** (`dietFamily`, cioè `Diet.name`): con lo stile identifica
  il prodotto, ed è la stessa chiave nome+stile che il catalogo del sito usa già. Le varianti
  interne (regime × obiettivo × pasti × digiuno) restano dettagli del motore e si fondono in una
  card sola, tenendo i campi compilati migliori fra le varianti.
  **Nessuna cliente esistente cambia comportamento**: il campo è nullo su chi si è registrata
  prima di oggi e opzionale nel DTO, così anche le app già installate — che mandano solo lo
  stile — continuano a funzionare come sempre.
  Il filtro famiglia è **sempre combinato con lo stile**, e la cosa non è un dettaglio: se un
  nutrizionista corregge lo stile dal backoffice, la vecchia famiglia non trova più niente e
  l'abbinamento scende da solo ai criteri di prima. Senza quel vincolo la correzione non avrebbe
  avuto alcun effetto, e nessuno se ne sarebbe accorto.
  Cambiare la famiglia da backoffice chiede lo stesso permesso di cambiare lo stile
  («Cambia tipo di dieta»), ed è tracciata nell'audit come gli altri due campi.

- `[Sviluppo]` ♻️ **`pickDiet` era scritto due volte, identico: ora è uno solo.** La scala dei
  ripieghi (famiglia → stile → obiettivo → regime → ultimo tentativo ignorando il piano pasti)
  viveva copiata riga per riga in `menu.service.ts` e in `personal-base.service.ts`. Due copie
  della stessa logica prima o poi divergono, e queste due decidono cose che devono coincidere:
  il **menu del giorno** e la **base personalizzata sicura**. Se una avesse iniziato a scegliere
  una dieta diversa dall'altra, il pool ricette approvato dal nutrizionista e i menu erogati si
  sarebbero riferiti a due prodotti diversi — senza errori, senza avvisi.
  Ora la logica sta in `src/catalog/pick-diet.ts`, in una funzione pura che riceve *come*
  interrogare il catalogo e restituisce la dieta: i due servizi la chiamano e basta. Con 10 test
  sull'**ordine** dei ripieghi, che è il punto: quando la famiglia c'è vince, quando manca o non
  trova niente si scende ai criteri di sempre e nessuna cliente resta senza menu.
  Test: +10 (53 suite, 555 test).

- `[Sviluppo]` 🛒 **Gli abbonamenti si possono finalmente comprare: negozio, carrello, profilo.**
  Il backend ricorrente era scritto stamattina ma dall'app non lo raggiungeva nessuno — nessuna
  schermata mandava la scelta. Ora c'è tutto il giro:
  · **Negozio** — sul mantenimento due caselle esplicite, *Abbonamento* (si rinnova da solo) o
    *Un mese solo* (nessun rinnovo), scelte **prima** di aggiungere al carrello; sul monitoraggio,
    che è solo abbonamento, la riga «rinnovo mensile, disdici quando vuoi» sotto il nome. Il
    default è l'abbonamento, ma scritto accanto: un addebito automatico attivato senza vederlo è
    la cosa che fa arrivare i rimborsi.
  · **Carrello** — le tre regole del ricorrente sono dette **prima** di premere paga, non dopo:
    il bonifico sparisce (con la ragione a fianco), il campo buono sconto non compare, e se ci
    sono integratori nel carrello un avviso rosso spiega perché vanno in un secondo ordine — se
    restassero, si pagherebbero ogni mese. Il totale dice «€49 / mese» e sotto cosa succede dopo.
  · **Profilo** — nuova scheda **Abbonamento**: quanto paghi, quando si rinnova, *Aggiorna la
    carta* (portale Stripe: i dati della carta non passano mai da noi) e *Disdici* con una
    conferma sola. Se l'ultimo addebito è fallito lo dice chiaramente **senza** far pensare a una
    disdetta: il piano resta attivo mentre Stripe riprova.
  · **Backoffice** — nel Negozio il campo **«Come si vende»** (pagamento unico / solo abbonamento
    / a scelta della cliente) con la colonna in tabella, più due avvisi: se si sposta il periodo
    `monitoring` e se si mette un abbonamento a €0 (Stripe non apre una sessione senza importo).

- `[Sviluppo]` 🐞 **Tre difetti della push di stamattina, trovati rileggendo il codice prima di
  costruirci sopra.** Nessuno dava errore: è il motivo per cui vale la pena rileggere.
  ① **Rotta doppia.** `GET /me/subscription` era registrato **due volte** — il vecchio (piano,
  date, primo menu) e il nuovo (abbonamento ricorrente). Nest tiene il primo e ignora il secondo
  senza dire niente: **Calendario, Profilo e il promemoria della data d'inizio** avrebbero
  ricevuto il payload sbagliato. Il ricorrente è passato su `/me/subscription/recurring`, e ora
  c'è un test (`rotte-uniche.spec.ts`) che legge i decoratori di **tutti** i controller del
  modulo e fallisce se due metodi finiscono sullo stesso percorso.
  ② **Il monitoraggio durava tre mesi invece di uno.** Il piano nasce col periodo `monitoring`,
  che `subscriptionEnd` non conosceva: cadeva nel fallback muto da 3 mesi. €19 pagati valevano un
  trimestre. Ed era anche **impossibile da salvare dal Negozio**, perché il validatore non
  ammetteva quella parola — identica alla trappola di `maintenance` di due mesi fa, che avevamo
  già documentato. Un periodo nuovo va aggiunto in **tre punti insieme**: validatore,
  `subscriptionEnd`, `isKnownPeriod`. Ora è scritto nel commento del DTO.
  ③ **Il monitoraggio era in vendita a chiunque.** Compariva nello shop e sulla landing accanto
  ai percorsi, a €19, anche a una lead appena registrata. È l'**ultimo** gradino
  (percorso → mantenimento → monitoraggio): ora è fuori dalla vetrina pubblica e visibile solo a
  chi il mantenimento l'ha davvero fatto — e la stessa regola è ripetuta **all'acquisto**, perché
  nascondere un piano non impedisce di comprarlo conoscendone l'id.
  Allineata anche la condizione «ha fatto il mantenimento»: prima bastava un abbonamento
  `pending`, cioè un ordine **non ancora pagato**. Ora servono `active` o `expired`, sia per il
  monitoraggio a pagamento sia per quello in omaggio.
  Test: +19 (52 suite, 546 test).

- `[Sviluppo]` 🔑 **"Invia credenziali" non manda più una password: manda un link.** Fino a stamattina
  il pulsante del lead generava una password provvisoria, la scriveva nel database e la spediva per
  email in chiaro. Due cose sbagliate insieme: la password restava leggibile nella casella di posta
  della cliente per sempre, e su un account **già esistente** la rotazione le buttava fuori — chi
  aveva già cambiato password e stava usando l'app si ritrovava scollegata senza aver fatto niente.
  Ora l'email contiene un **link di attivazione a scadenza** (`ActionToken` di tipo `password_reset`,
  in tabella solo l'hash SHA-256, mai il token): la cliente clicca, sceglie la sua password, il link
  muore. Durata regolabile dal backoffice — parametro `lead_credentials_link_days`, **7 giorni** di
  default; non è una costante nel codice, si cambia da Parametri senza deploy.
  La differenza che conta è sugli account già attivi: **la password non viene toccata e le sessioni
  non vengono revocate**. Se la coach ripreme il pulsante per sbaglio su una cliente che sta usando
  l'app, non succede niente di male — riceve un link che può ignorare. Sugli account nuovi la
  password nasce come hash casuale che **nessuno conosce**, nemmeno noi: l'unico modo di entrare è
  il link. Il segnaposto `{password}` resta nei modelli email per non rompere i testi già scritti,
  ma arriva vuoto; la copia IT/EN è stata riscritta attorno al link.
  File: `crm.service.ts`, `mail.service.ts`, `i18n/messages.ts`, `prisma/seed.ts`.

- `[Sviluppo]` 🧪 **Test rossi per un provider dimenticato — la stessa trappola di ieri, seconda volta.**
  Aggiungendo `ConfigParamsService` al costruttore di `CrmService` ho scordato di registrarlo nel
  modulo di test: 13 test non fallivano su un'asserzione, **non partivano proprio** (`Nest can't
  resolve dependencies of the CrmService … argument ConfigParamsService at index [5]`). Risolto con
  il mock accanto agli altri in `finance-crm.spec.ts`. Vale la pena fissarlo come abitudine: **ogni
  volta che si aggiunge un parametro al costruttore di un service, va aggiunto anche a ogni
  `createTestingModule` che lo istanzia** — `tsc` non se ne accorge, perché il costruttore è
  formalmente corretto ed è Nest a rompersi a runtime.

- `[Sviluppo]` 💳 **Stripe ricorrente: il backend è scritto.** È la voce #10, ferma da settimane su
  una decisione e non su del codice. Ora il mantenimento si vende **in abbonamento o a mese
  singolo** e il monitoraggio **solo in abbonamento**; i percorsi 1/3/6 mesi restano una-tantum e
  non cambiano di una riga.
  Le parti che contano, in ordine di quanto possono fare danno:
  · **Il primo addebito NON si conta due volte.** Stripe manda una fattura anche al primo mese, e
    quella la ignoriamo: è lo stesso incasso già gestito dal checkout. Contarla avrebbe prodotto
    due pagamenti, due provvigioni e due ricevute per un solo addebito. Si riconosce da
    `billing_reason`, non dall'importo o dalla data — che coincidono.
  · **Carta rifiutata ≠ disdetta.** Durante i tentativi di Stripe l'abbonamento resta **attivo** e
    i menu continuano: una carta scaduta non è un addio, e togliere il servizio a chi ha solo
    cambiato bancomat è il modo peggiore di farselo diventare. Si avvisa e basta; è Stripe a
    chiudere quando i tentativi finiscono davvero.
  · **Disdetta dall'app, in autonomia**, valida a fine periodo già pagato e **reversibile** finché
    quel periodo non finisce. La carta si aggiorna dal portale di Stripe: i dati della carta non
    passano mai da noi.
  · Idempotenza ovunque, perché Stripe **riconsegna** i webhook: l'id della fattura fa da chiave,
    e un rinnovo contato due volte è denaro.
  Migrazione `20260807090000_abbonamenti_ricorrenti`. Il campo `plan.billing` è una colonna e non
  due booleani: i tre casi sono mutuamente esclusivi, e con due flag esisterebbe la combinazione
  «né l'uno né l'altro» — che non vuol dire niente e prima o poi qualcuno la salva.
  ⚠️ Il client Prisma va rigenerato **dal Terminale del Mac** (`npx prisma generate`): il VM del
  ponte non ha rete e la sandbox non scarica i binari Prisma (403). Senza, `tsc` gira contro lo
  schema vecchio e fallisce su ogni campo nuovo.

- `[Prodotto]` **Il «Menu di rientro (8 giorni)» a €29 non si vende più: i menu sono INCLUSI**
  (decisione Simone, 7/8). Era il kit che Gaia proponeva quando la cliente riprendeva peso durante
  il monitoraggio: 8 giornate scelte sul suo storico, a pagamento. La logica commerciale non regge
  alla prova dei fatti — chi ha appena ripreso tre chili è la meno disposta a tirare fuori la
  carta, ed è il momento in cui ha più bisogno di una mano.
  Ora i menu si erogano e basta: nel monitoraggio omaggio perché il percorso è già stato pagato,
  in quello a €19/mese perché lo si sta pagando. **Con loro sparisce il CONGELAMENTO** di chi non
  comprava entro la finestra: non c'è più un acquisto da rifiutare, quindi non c'è più nessuno da
  mettere in pausa per non aver speso €29.
  Il piano viene **disattivato, non cancellato**: chi l'ha comprato ha un abbonamento che punta a
  quella riga, e cancellarla porterebbe via la sua storia (oltre a fallire per il vincolo
  `onDelete: Restrict`).
  **Aggiunto quello che mancava:** al **rientro da una sospensione**, se il peso è salito oltre la
  soglia, i menu di rientro arrivano da soli — inclusi. Il modulo pausa dichiarava espressamente
  di non fare proposte commerciali e i menu vivevano solo nell'altro monitoraggio, quindi chi
  tornava da una vacanza non riceveva niente. Si erogano **a fine pausa**, non durante: durante
  una pausa i menu sono sospesi per definizione, e mandarglieli mentre è in vacanza sarebbe il
  contrario del punto di avere una pausa.

- `[Prodotto]` **Il monitoraggio omaggio ora propone quello in abbonamento** (richiesta Simone,
  7/8), e lo fa con l'impianto che c'era già invece di un meccanismo nuovo: due inneschi nel
  **ciclo di vita** (`mon_t8` e `mon_fine`), accendibili e spegnibili dal backoffice come tutti
  gli altri, deduplicati per periodo, con i due modelli email scritti nella voce di casa.
  L'ordine conta: la prima email parte **a -8 giorni, mentre il servizio è ancora attivo** e la
  cliente ne vede il valore; la seconda l'ultimo giorno. Non si insiste oltre — chi non risponde a
  due email non risponde alla terza, e il win-back esiste già. Non si scrive a chi ha già un piano
  attivo: sarebbe vendere una cosa che ha già. Il prezzo nell'email arriva dal **Negozio**, non è
  scritto nel testo: se domani il monitoraggio costa altro, il messaggio si aggiorna da solo
  invece di mentire.

- `[Sviluppo]` **Tre volte il compilatore ha fermato un errore mio**, ed è la ragione per cui vale
  la pena averlo. Il nome `seedMonitoringPlan` era **già occupato** dal «Menu di rientro» — cioè
  dal monitoraggio gratuito: esattamente l'ambiguità fra i due monitoraggi che avevo scritto nella
  nota di listino la sera prima, e mi ha preso in castagna dopo dieci minuti. Poi
  `MonitoringPeriod` **non ha una relazione** verso l'utente (`clientId` è una stringa, il modulo
  è FK-less di proposito), quindi l'`include` che avevo scritto non poteva funzionare. E un tipo
  di ritorno rimasto indietro. `tsc --noEmit` pulito su backend e app, **527 test verdi**.

- `[Sviluppo]` **Verificata la CI dopo averla resa bloccante — e la prima rossa non era nostra.**
  Avendo tolto `continue-on-error` poche ore prima, valeva la pena guardare che i push della notte
  passassero davvero, invece di scoprirlo domani. Uno era rosso: la run **#321** (`bb3d8ed`, il
  push dei test a zero). Non un test: tutti e tre i job — backend, backoffice, app — falliti dopo
  **45 minuti** con *«The job was not acquired by Runner of type hosted even after multiple
  attempts»* e un *Internal server error*. GitHub non riusciva ad assegnare i runner. La run
  successiva è passata in **1m10s**, e quella dei filtri ricette in **58s**: catena sana.
  Vale la pena averlo scritto, perché è il primo effetto collaterale della CI bloccante: **blocca
  anche quando il guasto non è nostro**. Si riconosce da durate assurde e da un errore che parla
  di *Runner* invece che di test, e si risolve con `Re-run jobs` — non rimettendo
  `continue-on-error`, che sarebbe spegnere la rete di sicurezza per un singhiozzo altrui.

- `[Sviluppo]` 🎉 **iOS 2.1 APPROVATA.** Con Android approvata ieri, la 2.1 è pubblicata su
  entrambi gli store. È la versione con le push iOS che funzionano davvero — verificate su
  TestFlight prima dell'invio, dopo l'indagine a cinque anelli del 6/8.
  ⚠️ Promemoria per la prossima build: il numero deve essere **≥ 8**, il 7 è già caricato.

- `[Sviluppo]` **I filtri del catalogo ricette girano sul DATABASE, non su una fetta.** Emerso
  dallo screenshot di Simone del 6/8: il banner di troncamento compariva con il **solo regime
  vegetariano**, cioè quelle ricette avevano già superato le 1000 — il tetto alzato quella
  mattina da 200. Conseguenza: i filtri di colonna cercavano dentro le prime 1000 righe
  scaricate, e una ricetta che c'è ma non compare è **peggio di un errore**, perché chi cerca
  conclude che non esiste e la ricrea. Con il nutrizionista che sta facendo manutenzione alle
  ricette proprio in queste ore, era il momento giusto per toglierlo di mezzo.
  `GET /recipes` ora accetta `difficulty`, `season`, `stato`, `kcalMin`, `kcalMax` oltre a quelli
  che aveva già, e risponde **`{ items, total, troncato }`**: `total` è il conteggio vero sul
  database, quindi la pagina può dire «ne ho trovate 1.240, qui vedi le prime 1000» invece di far
  credere che il catalogo sia grande quanto quello che si vede. La pagina interroga il server a
  ogni cambio di filtro, con 300 ms di pausa perché scrivere un nome non generi una richiesta per
  lettera.
  **Un filtro resta onestamente fuori: il TAG.** È una ricerca per sottostringa dentro un array
  Postgres, che Prisma non sa esprimere, e continua a lavorare sulle righe ricevute. Quando il
  risultato è troncato **il banner lo dice esplicitamente** e suggerisce di restringere prima con
  un altro filtro: preferisco un limite dichiarato a un filtro che sembra funzionare.
  Alzare ancora il tetto sarebbe stato il rattoppo che si ripresenta: era già passato da 200 a
  1000 in un giorno.
  `tsc --noEmit` pulito su backend e backoffice, 527 test verdi.

## 2026-08-06

- `[Sviluppo]` **Ripuliti quattro documenti che dicevano il falso** (secondo giro della giornata:
  il primo era di stamattina, e nel frattempo mezza giornata di lavoro li ha resi vecchi di nuovo).
  · `STATO.md`: Stripe LIVE dato 🔶 «manca il pagamento di prova», fatto il 16/7; **OTA dati
  ancora attivi** quando sono spenti dal pomeriggio; un follow-up di sicurezza sugli endpoint
  `/engine/decisions/:id/confirm|correct` dato aperto quando lo scoping per paziente c'è per ogni
  via (`engine.service.ts:221-238`); «porta un'amica ancora da fare» quando è in Home da stamattina;
  Keto-Mediterranea «da generare» quando l'ha generata il nutrizionista.
  · `Metabole_Checklist_GoLive.md`: il semaforo in fondo dava ancora le **4 conferme 🔴** mentre la
  sezione sopra, nello stesso file, le dà chiuse dal 16/7. Una checklist che si contraddice da sola
  è peggio di nessuna checklist.
  · `NOTA_Handoff_Pubblicazione_2026-08-06.md`: quattro punti superati in giornata (#10 sbloccata,
  OTA già svuotata, Keto generata, `continue-on-error` tolto).
  · `progetto/Audit_Lavori_2026-08-06.md`: intestato come **superato nella stessa giornata**, con
  l'elenco di cosa è caduto. Dentro c'è anche l'ammissione di **due segnalazioni sbagliate**:
  certificazione di unicità e Giudice/Publisher erano dati come «mai iniziati» ed esistono
  entrambi. È lo stesso errore che l'audit del 5/8 aveva fatto tre volte su otto, ed è la ragione
  per cui vale la pena scriverlo invece di correggerlo in silenzio: **un audit che grida al lupo
  si smette di leggere**, e allora tanto vale non farlo.

- `[Prodotto]` 💶 **Listino di mantenimento e monitoraggio fissato** (Simone, 6/8 sera). Non è un
  ritocco di prezzo: definisce cosa deve fare il codice del ricorrente, che parte domattina.
  Il percorso della cliente dopo il peso raggiunto: **mantenimento per quanti mesi vuole**, poi
  **monitoraggio anche per sempre**. Nessuno dei due ha una scadenza imposta.
  · **Mantenimento €49/mese**, in abbonamento **oppure a mese singolo** — entrambe le modalità.
  · **Monitoraggio €19/mese**, solo in abbonamento.
  ⚠️ **Il monitoraggio a pagamento NON è il monitoraggio gratuito.** Quello che si attiva quando
  il piano viene sospeso (pausa vacanza / sorveglianza) resta **gratis**, ed è l'unico che esiste
  oggi nel codice — `monitoring.service.ts` lo descrive come «paracadute GRATUITO». Il €19/mese è
  un prodotto nuovo che segue il mantenimento. Due cose diverse con lo stesso nome: va scritto
  ovunque, perché è esattamente il tipo di ambiguità che produce difetti che nessuno vede.
  ⚠️ Nel seed entrambi i piani sono ancora a **€29**. I prezzi veri si mettono dal **Negozio**,
  non nel seed: il seed aggiorna solo la descrizione, mai il valore già a database.
  Conseguenze già scritte nei documenti: il mantenimento ha **due modalità di acquisto** (non
  basta marcare il piano come ricorrente, serve la scelta nel checkout), e i conti delle
  provvigioni vanno rifatti — a €49 restano a Metabole **€25,96/mese** invece dei €183/anno
  calcolati su €29, quindi il residual «per sempre» pesa meno di quanto sembrasse quando lo
  abbiamo deciso. Resta **un solo numero aperto**: la percentuale coach **sul monitoraggio**,
  dove il 45% di €19 lascerebbe €9,91 su un prodotto che dura anni e chiede pochissimo lavoro.

- `[Sviluppo]` **«Porta un'amica» rifatta: prometteva una cosa e ne faceva un'altra.** Partita da
  due screenshot di Simone e finita per toccare tutta la meccanica. Cinque cose, in ordine di
  gravità:
  **1. Il testo mentiva.** La card diceva «quando un'amica **si iscrive** col tuo codice, il tuo
  percorso si allunga di 10 giorni». Non è vero: `onConvert` è chiamato da un solo punto, dentro
  la catena di **approvazione del pagamento**. La sola iscrizione non dà niente. Una cliente che
  invita tre amiche, le vede registrate e non riceve nulla, non ha un dubbio: ha la prova che
  l'app le ha mentito. Ora c'è scritto «si iscrive **e acquista un percorso**», e il contatore
  dice «con acquisto» invece di «iscritte» (contava già quello).
  **2. La ricompensa poteva sparire per sempre, in silenzio.** `convertedAt` veniva scritto
  **prima** di controllare se la referrer avesse un abbonamento attivo; se non ce l'aveva si
  usciva con un commento «non applicabile ora» — ma quell'«ora» non arrivava mai, perché alla
  chiamata dopo `convertedAt` c'era già. Nessun cron, nessun retry. E colpiva le persone
  sbagliate: chi ha il piano scaduto è la più motivata a portare un'amica per allungarlo. Ora
  resta in sospeso e viene **riscossa alla prima attivazione utile** (`riscuotiSospese`,
  agganciata alla stessa catena pagamenti).
  **3. La referrer non sapeva di aver vinto.** Nessuna notifica, solo una riga di audit. Adesso
  arriva «+10 giorni sul tuo percorso 🎁» nel momento in cui i giorni ci sono davvero.
  **4. La card non compare più dal primo giorno** (decisione di Simone): si mostra dopo
  **15 giorni di percorso**, parametro `referral_card_after_days` — chiedere di consigliare
  Metabole a chi l'ha appena aperta vale poco, e l'invito vale quanto vale chi lo manda. Il gate
  è sul server perché è una regola di prodotto: si cambia da Parametri, senza pubblicare l'app.
  Chi ha già invitato qualcuno continua a vederla comunque.
  **5. Il pulsante «Condividi» usciva dalla card** e copriva il codice: `.btn` nel tema ha
  `width: 100%` e con `flex: none` quella larghezza vince. Serviva `width: auto`.
  Corretta anche l'unica parola inglese dell'app cliente: la sezione «Help» in Home ora si
  chiama «Se ti serve una mano».

- `[Prodotto]` ✅ **L'amica invitata va alla stessa coach della referrer, che quindi incassa le
  provvigioni** (regola di Simone, 6/8). Prima non succedeva: `linkOnRegister` registrava
  l'invito e basta, e l'amica finiva **nel pool dei non assegnati**. Due cose sbagliate insieme —
  l'amica arrivava da una sconosciuta, e la coach che aveva di fatto generato quell'iscrizione non
  prendeva niente. Ora eredita la coach della referrer **subito, senza ciclo di accettazione**:
  come per il ref code di una coach, qui la scelta l'ha già fatta qualcuno. Le provvigioni seguono
  da sole, senza codice nuovo: `finance.generateCommissions` legge `ClientProfile.assignedCoachId`,
  che è esattamente il campo che scriviamo. La coach riceve una notifica, e se l'amica risulta già
  assegnata a qualcun altro non si scavalca nessuno. Solo la **coach**: la nutrizionista continua
  ad assegnarla il capo nutrizionista, perché lì il criterio è clinico, non commerciale.

- `[Sviluppo]` **Il link d'invito ora c'è anche dove serve: nell'app dei professionisti.**
  Segnalazione di Simone, e aveva ragione: il riquadro esisteva **solo nel backoffice da
  desktop** (`CoachHome`), mentre il link lo si manda dal telefono, in chat, mentre si parla con
  qualcuno. Nell'area staff dell'app (`app/src/staff/`) non c'era niente. Nuova `InvitoCard` in
  entrambe le dashboard, coach e nutrizionista, con lo stesso pulsante **Condividi** della card
  cliente — foglio nativo sul telefono, copia su desktop.
  Nel farlo è emersa una mezza funzione: **la nutrizionista era esclusa da `my-invite`**, che
  rispondeva «l'invito è disponibile solo per le coach» — mentre la registrazione **accetta già**
  i suoi ref code e le assegna la cliente. Aveva un codice funzionante che non poteva vedere.
  Aperto a lei e al capo nutrizionista. E quando l'invito non si può generare la card **non
  sparisce in silenzio**: dice cosa manca (la scheda staff) e a chi chiederlo.

- `[Sviluppo]` **La CI nuova ha subito fatto il suo mestiere: ha beccato me.** Le modifiche qui
  sopra hanno rotto tre test — il messaggio di `myInvite` cambiato, il quarto parametro di
  `ReferralService` (le notifiche) e `riscuotiSospese` assente dal finto ReferralService in
  commerce. Prima di stamattina sarebbero passati inosservati con `continue-on-error`, e sarebbero
  diventati il debito di qualcun altro. Sistemati subito: **51 suite, 527 test, tutto verde**,
  `tsc --noEmit` pulito su backend e app.

- `[Prodotto]` ✅ **Provvigioni sul rinnovo: chiuse tutte e tre le domande** (Simone, 6/8).
  Quota coach **piena a ogni rinnovo** (opzione b); provvigione **solo se la coach è ancora quella
  assegnata**; residual **per sempre**, senza scadenza.
  Le ultime due si tengono insieme, ed è la ragione per cui «per sempre» regge: la rendita è
  legata al **rapporto**, non al contratto. Finché quella coach segue la cliente incassa; se la
  smette di seguire, o la cliente viene spostata, il pagamento si ferma da solo. Senza il vincolo
  sull'assegnazione, «per sempre» sarebbe stato un assegno in bianco.
  Il numero da ricordare non è la provvigione ma quello che resta: **€15,26 al mese per cliente,
  per sempre** — non €28,31 dal secondo anno. È la cifra su cui calcolare quanto si può spendere
  in acquisizione.
  **Da qui il codice del ricorrente può partire senza altre domande sulle provvigioni.** Restano
  le sei domande di impianto (piani, intervallo, dunning, disdetta, prova, bonifico), preparate
  con la proposta già scritta in `progetto/Stripe_Ricorrente_Sei_Domande.md` per domattina.

- `[Prodotto]` ✅ **Provvigioni sul rinnovo: decisione chiusa.** Simone: «la quota coach sui rinnovi
  non cambia» → **opzione (b)**, provvigione piena a ogni rinnovo, che con il nutrizionista già a
  zero lascia €15,26 al mese a Metabole e €183 per cliente all'anno. È il modello *residual*: la
  coach guadagna finché la cliente resta, quindi ha interesse a farla restare — e in mantenimento
  serve proprio quello, perché chi molla non protesta, sparisce.
  **Sblocca la voce #10** (monitoraggio a pagamento) e con essa lo Stripe ricorrente, che era
  l'ultimo lavoro grosso fermo su una decisione e non su del codice.
  ⚠️ Restano due interruttori da decidere, e non sono a/b/c: se il residual **dura per sempre o 12
  mesi** (con la (b) «per sempre» significa pagare anche sulla cliente che si rinnova da sola da
  tre anni), e la condizione **«solo se la coach è ancora quella assegnata»**, che va messa
  comunque — altrimenti una coach che se ne va continua a incassare. Vanno decise prima del primo
  rinnovo pagato: dopo diventano una revisione di compensi già erogati.
  Dettagli e numeri: `progetto/Decisione_Provvigioni_Rinnovo.md`.

- `[Prodotto]` ✅ **Keto-Mediterranea creata dal nutrizionista**, dal generatore del backoffice —
  usato come formazione, che era l'idea di Simone quando ha rifiutato lo script. Ora sta facendo
  manutenzione alle ricette. La voce #2 del feedback del 5/8 («ingredienti Keto introvabili») si
  chiude qui: il codice c'era da stamattina, mancava questo. Finché le varianti non sono approvate
  nessuna cliente le vede, quindi la manutenzione può prendersi il tempo che serve.

- `[Sviluppo]` **`continue-on-error` tolto da `ci.yml`: da adesso la CI può fallire** (commit
  `73cc4f2`, fatto dall'editor web di GitHub — i file `.github/` il bridge non li scrive). Via
  anche il nome dello step, «Test (informativo — alcuni test noti falliscono per DI NestJS)»,
  diventato falso: ora è solo «Test». Un test rosso blocca la push, che è il punto.
  Vale la pena tenere insieme le due metà della storia: quella riga era stata messa per non farsi
  bloccare da ~30 test rotti, e proprio perché c'era nessuno ha visto i test diventare 99. Una
  rete di sicurezza disattivata «temporaneamente» non resta ferma: peggiora, in silenzio.

- `[Sviluppo]` **I test rossi erano 99, non «una trentina»: adesso sono 28.** Ho fatto girare la
  suite del backend, cosa che nessuno faceva più da quando `ci.yml` ha `continue-on-error: true` —
  la pipeline non può fallire, quindi nessuno vedeva niente. Nei nostri appunti c'era scritto
  «~30 test rossi in `src/commerce`»: erano **99 in 18 suite**, sparsi su mezzo backend.
  Ma non erano 99 problemi. Guardandoli sono **quattro famiglie**, e una sola ne spiegava l'85%:
  **un provider aggiunto al costruttore di un servizio e dimenticato nel modulo di test.** Quei
  test non fallivano su un'asserzione, **non partivano proprio** — Nest non risolveva le
  dipendenze e la suite intera moriva in `beforeEach`. Sei suite, sei righe: `NotificationsService`
  in auth, catalog e visite, `CrmService` in utenti, `MonitoringService` in commerce, `MailService`
  + `NotificationsService` nel blocco CrmService di finance-crm. **99 → 28**.
  Poi la seconda famiglia, anch'essa meccanica: **il finto Prisma dei test non ha i modelli che il
  servizio ha imparato a leggere nel frattempo**. `coachTeamScope` — la rete coach a tre livelli —
  legge il ruolo da `prisma.user`, e nei mock `user` non c'era proprio: la chiamata esplodeva
  prima di ogni asserzione (coach, alert, promemoria). Stessa storia con `subscription` in signals
  (il check-in ora si propone solo con un piano attivo), `crmReminder` nella board della pipeline,
  `user` nella lista pazienti, `ledgerEntry.aggregate` in contabilità. **28 → 17**, con sette
  suite tornate completamente verdi: auth, utenti, signals, promemoria, pipeline, nutrizionista,
  alert.
  Nessuna delle due famiglie era un difetto del codice: erano test rimasti indietro rispetto a
  modifiche fatte bene. Ma la conseguenza era che **nessuno dei test di quelle suite girava**, e
  quindi non proteggevano più niente da mesi.
  Poi i 17 rimasti, uno per uno, e qui non era più meccanico. **In nessun caso il difetto era nel
  codice: erano test rimasti indietro rispetto a modifiche fatte bene.** Ma tre meritano di essere
  raccontati, perché la riparazione è stata una decisione, non un allineamento:
  · **Gate misure** (`menu-measurement-gate`): si aspettava 0 campi e ne riceveva 3 — `level`,
    `since`, `lockedMessage`, aggiunti oggi col gate severo. Il confronto è rimasto **esaustivo**
    di proposito: se domani il gate cresce ancora, il test lo dice invece di lasciar passare campi
    nuovi che nessuno ha mai guardato.
  · **Ricompensa «porta un'amica»** (`referral`): confrontava una data fissa con l'orologio reale.
    Scritto a luglio era verde; passato il 1° agosto è diventato rosso **da solo**, senza che si
    rompesse niente. Congelato il tempo (`setSystemTime`) e aggiunto il caso opposto, che non
    c'era: abbonamento già scaduto → i giorni si contano da oggi, non dalla scadenza vecchia,
    altrimenti si regalerebbero giorni già passati.
  · **Statistiche pubbliche** (`catalog`): il test diceva che i «clienti seguiti» della home sono
    gli abbonamenti attivati. Non è più così — sono le schede CRM arrivate a `paid` **oppure** con
    un pagamento pregresso (clienti storici), e sul sito vanno solo le diete rese visibili, non
    tutte le approvate. È un numero che sta sulla home: allineato al codice, ma **segnalato**,
    perché se la definizione giusta fosse quella vecchia allora il difetto è nel codice.
  L'ultimo è il più interessante e non era un mock dimenticato. L'approvazione dei pagamenti non
  fa più «leggi lo stato, poi scrivi»: fa una **updateMany atomica** che tocca la riga solo se è
  ancora in attesa e decide dal `count` — così due operatori che cliccano insieme, o un webhook
  Stripe riconsegnato, non producono un doppio accredito. Il finto Prisma però rispondeva sempre
  `count: 1`: **i tre test sull'idempotenza misuravano un mondo che non esiste.** Ora il mock si
  comporta come il database vero. E `cron.controller.spec`, ferma a quando gli step erano due su
  sedici, è stata riscritta intorno a quello che conta adesso: che **uno step rotto non fermi gli
  altri** — la ragione per cui quel codice ha quella forma, e che nessuno verificava.
  **Risultato: 51 suite su 51, 527 test su 527, zero rossi**, con `tsc --noEmit` pulito.
  ⚠️ Resta da togliere `continue-on-error: true` da `.github/workflows/ci.yml` (e il nome dello
  step, «informativo — alcuni test noti falliscono», che adesso è falso). Va fatto dall'editor web
  di GitHub: i file `.github/` il bridge non li scrive. È il momento giusto: da lì in poi la
  pipeline comincia davvero a proteggere, invece di raccontare che tutto va bene.
  Nota di metodo: `continue-on-error` non si toglie perché «ci sono pochi test rossi», si toglie
  quando sono zero. Finché c'è, il numero cresce senza che nessuno se ne accorga — da 30 a 99
  è successo esattamente così.

- `[Sviluppo]` **Un'assegnazione «da accettare» non si porta sul profilo cliente.** Buco aperto
  da me un'ora prima, con la modifica al form Nuovo lead: da lì in poi un lead può essere
  assegnato ma non ancora accettato, e `sendCredentials` portava comunque la coach sul profilo.
  Se poi la coach rifiuta, o scade la finestra, `reject()` e il cron di scadenza svuotano il
  `CrmRecord` — **il profilo no**, e la cliente resterebbe agganciata a una coach che quel lead
  non l'ha mai preso. Nessuno se ne accorgerebbe: nel CRM il lead è tornato alla responsabile,
  nel backoffice la cliente è di qualcun altro.
  Ora l'accettazione implicita viene valutata **prima**, e sul profilo la coach ci arriva solo
  se l'assegnazione risulta accettata; altrimenti ci arriva con l'accettazione, che già propaga.
  La nutrizionista non ha ciclo di accettazione e passa sempre. Stessa regola in
  `fix:assegnazioni`, che ora conta a parte i lead ancora da accettare invece di allinearli
  (uno `assignmentStatus` nullo è dato storico e vale come accettato, altrimenti i casi più
  vecchi non verrebbero riparati proprio).

- `[Sviluppo]` **`install-ios.mjs` rimette da solo le quattro cose che `cap add ios` cancella.**
  Erano il conto della serata: capability Push, `GoogleService-Info.plist` agganciato al target,
  `aps-environment` a `production`, e `CODE_SIGN_IDENTITY = "iPhone Developer"` che il template
  Capacitor rimette e che firma l'archivio in development. Nessuna delle quattro dà errore: la
  build passa, si carica, e le push non arrivano a nessuno. Le abbiamo rimesse a mano una per una,
  in un'ora, e rimetterle a mano ogni volta è la garanzia di riperderle.
  Ora lo script scrive `App.entitlements`, lo aggancia alle **due** configurazioni del target
  (Debug e Release, riconosciute da `INFOPLIST_FILE = App/Info.plist`), mette team
  `TNDPSUPTA8` e firma automatica, **toglie** ogni `CODE_SIGN_IDENTITY`, e aggiunge il plist
  Firebase alla fase *Resources* — copiarlo non basta: fuori dalla fase resta sul disco ma non
  entra dentro l'app, e Firebase all'avvio non lo trova.
  Come per i metodi del delegato, **verifica il proprio risultato prima di dire com'è andata**:
  se gli entitlements non risultano in entrambe le configurazioni, o se un `CODE_SIGN_IDENTITY`
  è sopravvissuto, esce con errore invece di stampare «già a posto». Provato su tre scenari
  costruiti dal progetto Xcode **vero** (letto dal Mac, non immaginato): progetto sano → non
  tocca niente; progetto rigenerato → ricostruisce **esattamente** le stesse righe che avevi
  messo a mano; progetto rotto ad arte → esce 1 e dice quale controllo è saltato. Il primo giro
  del contro-test era invalido — girava sull'albero sbagliato, perché lo script deriva la radice
  dalla propria posizione e non dalla cartella corrente — ed è stato rifatto.
  Resta fuori una cosa sola, che nessuno script può fare: il **certificato Apple Distribution
  scade ogni anno**, e senza quello l'archivio torna a firmarsi in development. Il controllo
  `codesign` prima di caricare è in coda a `build-ios.sh`.

- `[Sviluppo]` **Nuovo lead: c'è la select «Assegna a», e chi la riceve viene avvisato.** Il
  backend accettava `assignedCoachId` in creazione da sempre, ma il DTO non lo dichiarava e il
  form non lo chiedeva: ogni lead inserito da lì nasceva nel pool e andava riassegnato a mano.
  Nel sistemarlo è saltato fuori il difetto vero: quel ramo dava l'assegnazione per **accettata**
  e **non avvisava nessuno** — la coach si ritrovava un lead in carico senza saperlo, e senza il
  ciclo di accettazione che vale ovunque altrove. Ora, quando è la responsabile ad assegnare in
  creazione, il lead nasce «da accettare», la coach riceve la notifica e ha i suoi giorni; se
  scade torna alla responsabile. Quando è una coach a crearsi un lead per sé resta come prima
  (assegnato subito: non c'è niente da accettare).

- `[Sviluppo]` ⚠️ **Un controllo che non girava.** Oggi ho dichiarato più volte «`tsc --noEmit`
  pulito su backend e backoffice». Sul backoffice **non era vero**: il comando era
  `ls node_modules/.bin/tsc && ./node_modules/.bin/tsc …`, `node_modules` nel backoffice non
  esiste sul Mac, l'`&&` tagliava corto e `tsc` non partiva mai — l'«ok» era solo l'`echo`
  successivo. Il controllo è stato poi fatto davvero (dipendenze installate a parte, `tsc`
  eseguito: pulito, oggi come nelle voci precedenti). Vale la pena scriverlo perché è la
  famiglia di difetti di tutta la giornata: **un controllo che non produce errore quando
  fallisce è peggio di nessun controllo**, perché ci si appoggia. Da qui in avanti, per ogni
  verifica, si guarda il **codice di uscita** — non l'ultima riga stampata.

- `[Sviluppo]` **Gestione dieta mostrava le ricette di tutte le diete.** Domanda di Simone: «se sto
  rivedendo i menu di una dieta perché sotto mi riporta anche quelli delle altre?». Aveva ragione a
  trovarlo strano, ma la causa è più interessante del sintomo: **le ricette non appartengono a una
  dieta.** `Recipe` non ha nessun `dietId` — ha regime, pasto, kcal, tag; il legame vive
  dall'altra parte, in `DietDayTemplate.meals` (`[{slot, recipeId}]`), cioè è la *giornata* a
  puntare alla ricetta. Ed è voluto: la stessa insalata vegetariana serve a Basso indice glicemico,
  Mediterranea e Keto-Mediterranea insieme, altrimenti il catalogo andrebbe riscritto per ogni
  famiglia. La pagina però filtrava solo per **regime**, e sotto il nome della dieta aperta
  comparivano piatti `gen:summer_return` e `gen:protein` di altre famiglie.
  Ora il catalogo dentro Gestione dieta parte dalle ricette **di quella dieta** (nuovo parametro
  `dietId` su `GET /recipes`: legge le giornate ed estrae gli id, perché quel JSON il database non
  lo sa interrogare), con l'interruttore **«Tutto il regime»** per quando devi pescarne una nuova
  da aggiungere. Lì compare l'avviso che mancava del tutto ed è la parte che conta:
  **modificare o cancellare una ricetta la cambia ovunque venga usata**, anche nelle diete di
  altre famiglie. La pagina lasciava credere il contrario.
  Effetto collaterale utile: nella vista per dieta il tetto delle 1000 righe non si tocca mai —
  una dieta ha decine di ricette. Resta però il fatto emerso dallo screenshot: **le sole ricette
  vegetariane hanno già superato le 1000**, quindi nel catalogo per regime i filtri di colonna
  lavorano su una fetta. Alzare ancora il tetto è un rattoppo: la strada è portare filtri e
  ordinamento sul server. In lista lavori, non fatto oggi.
  `tsc --noEmit` pulito su backend e backoffice.

- `[Sviluppo]` **`build-ios.sh` diceva il Team sbagliato.** Suggeriva «Mosaico Experiences SA»
  quando quello giusto è **Genius Company SA (TNDPSUPTA8)**: oggi ho quasi corretto il progetto
  Xcode sulla base di quella riga, cioè lo script stava per far sbagliare la firma. Corretta, e
  aggiunto in coda il comando `codesign -d --entitlements` da lanciare **prima** di caricare
  l'archivio, con cosa deve risultare (`aps-environment = production`, `get-task-allow` assente) e
  cosa significa se esce `development` (manca il certificato Apple Distribution, che **scade ogni
  anno**). È la verifica che oggi è costata un'ora a costruire: tenerla in un promemoria a voce
  significa riperderla al prossimo rilascio.

- `[Sviluppo]` **La coach non perde più la cliente quando le manda le credenziali.** Segnalazione
  di Simone: Gioia ha inviato le credenziali a Francesco reale dal pulsante sul lead; il lead
  risulta assegnato a lei, ma aprendolo si finisce su una cliente «non assegnata a nessuno».
  La causa è un ponte mancante fra due mondi: il CRM ragiona per lead
  (`CrmRecord.assignedCoachId`), tutto il resto del backoffice ragiona per profilo
  (`ClientProfile.assignedCoachId`) — liste clienti, chat, attività della coach, provvigioni,
  pausa vacanza filtrano **tutte** sul profilo. `sendCredentials` creava l'account e collegava il
  lead, ma non toccava il profilo; anzi, il profilo **non esisteva proprio**, perché nasce col
  questionario. Quindi non era un'etichetta sbagliata: la coach non riusciva **davvero** ad aprire
  la scheda della cliente appena creata («questo cliente non è assegnato a te»).
  L'aggancio esisteva in due punti soli — l'accettazione del lead e l'onboarding — e mancava
  proprio dove il cliente nasce. Adesso è **una funzione sola**, `src/common/assegnazione-profilo.ts`,
  chiamata da tutti e tre i rami (invio credenziali, accettazione, ref code): il ponte non si può
  più dimenticare in un ramo. Due regole volute: non sovrascrive **mai** un'assegnazione già
  presente (spostare una cliente resta un atto esplicito da Utenti), e crea il profilo se manca —
  sicuro, perché il gate dell'onboarding guarda `onboardingCompletedAt`, non l'esistenza del
  profilo. Corretti anche due `updateMany` che, senza profilo, aggiornavano **zero righe in
  silenzio**: l'accettazione del lead e l'assegnazione via ref code avevano lo stesso buco.
  Seconda parte, stesso difetto: se la coach manda le credenziali a un lead ancora «da accettare»,
  l'accettazione ora è **implicita** — sta già lavorando il lead. Senza, dopo `lead_accept_days`
  il cron di scadenza glielo toglieva di mano proprio mentre lo seguiva: l'anomalia segnalata
  sarebbe tornata da sola due giorni dopo. Vale solo se è la coach assegnata a premere il
  pulsante; se lo fa la responsabile, il lead resta «da accettare».
  Per le clienti già finite in quello stato — Francesco reale compreso — il codice nuovo non basta:
  c'è **`npm run fix:assegnazioni`** (shell di Render, in `~/project/src/backend`), che di suo
  mostra e basta e scrive solo con `CONFERMA=1`. Elenca a parte, senza toccarle, le divergenze in
  cui il profilo ha già un'**altra** coach: quella è la decisione di qualcuno, non un difetto.
  Effetto collaterale voluto: queste clienti rientrano ora anche nell'email di ciclo di vita
  «profilo_incompleto», che prima le saltava perché il profilo non esisteva.
  `tsc --noEmit` pulito. File: `backend/src/common/assegnazione-profilo.ts` (nuovo),
  `crm.service.ts`, `lead-assignment.service.ts`, `prisma/fix-assegnazioni.ts` (nuovo),
  `package.json`.

- `[Sviluppo]` ✅ **PUSH iOS VERIFICATE FUNZIONANTI** su TestFlight, build **2.1 (7)**: push di
  prova inviata dal backoffice e **arrivata sul telefono**. È la chiusura dell'indagine iniziata
  stamattina: dalla 2.0 non arrivavano a nessuno e nessuno poteva accorgersene. La catena completa
  che le teneva spente era di cinque anelli — metodi del delegato mancanti in `AppDelegate`
  (`install-ios.mjs` li inseriva senza verificare), chiave APNs revocata e rifatta, capability
  Push assente nel progetto rigenerato, `GoogleService-Info.plist` non agganciato al target,
  `aps-environment` a `development` perché **mancava il certificato Apple Distribution** (scaduto).
  Ognuno da solo bastava a spegnerle, e nessuno produceva un errore visibile.
  **2.1 inviata in revisione su App Store; Android in approvazione su Play.**
  Lezione generale, la stessa di tutta la giornata: quando un difetto non produce un errore, non
  serve cercarlo meglio — serve **costruire la verifica**. Le tre di oggi sono `codesign -d
  --entitlements` sull'archivio prima di caricare, il `timestamp` di `/health` per accorgersi di
  leggere risposte in cache, e la push di prova da TestFlight prima di pubblicare.

- `[Sviluppo]` **iOS 2.1 caricata su App Store Connect** (17:19), dopo una caccia alla firma durata
  un'ora. La rigenerazione di `ios/` aveva azzerato tre cose che vivono solo nel progetto Xcode —
  capability Push Notifications, `GoogleService-Info.plist` agganciato al target, entitlement
  `aps-environment` — e sotto ce n'erano altre due: il template Capacitor forza
  `CODE_SIGN_IDENTITY = "iPhone Developer"` **in tutte le configurazioni**, archivio compreso, e
  soprattutto **mancava il certificato Apple Distribution** (scaduto: durano un anno, l'ultimo era
  di luglio). Senza quello nessuna modifica al progetto poteva cambiare la firma. Creato da
  Xcode → Apple Accounts → Manage Certificates, e l'upload è passato.
  Unico avviso: **MinimumOSVersion 13.0**, che dalla primavera 2027 non sarà più accettata (minimo
  15.0). Non blocca oggi; messo in `metabole-backlog.md` con la nota che va fatto fare a
  `install-ios.mjs`, come gli altri passaggi che si perdono a ogni rigenerazione.

- `[Sviluppo]` **OTA spento ✓ — e un mio errore da segnare.** `OTA_VERSION` è stata eliminata dal
  servizio su Render (deploy live alle 15:58) e il manifest ora risponde
  `{"version":null,"url":null}`: nessun telefono scarica più bundle, e la 2.1 dello store non
  rischia di ritrovarsi sopra il web della 2.0.1.
  ⚠️ **La caccia è durata un'ora per colpa mia.** Rileggevo il manifest dal sandbox e continuavo a
  vedere `2.0.1` anche dopo che Simone l'aveva già tolta: ho detto due volte, con sicurezza, «non è
  cache» — e gli ho fatto rifare la procedura tre volte. Era cache: `GET /health` restituiva un
  `timestamp` di **due ore e mezza prima**, cioè l'istante della mia prima chiamata a quel dominio.
  Variare la query string (`?t=...`) non serviva a niente. La verifica vera l'ha data il browser,
  che non passa da quel proxy.
  **Regola scritta in memoria** (`feedback_verifiche_endpoint.md`): per sapere «com'è adesso»
  qualcosa che abbiamo appena cambiato — env, deploy, manifest — si legge **dal browser**, non con
  WebFetch; e il `timestamp` di `/health` è il modo da dieci secondi per accorgersi di star
  leggendo roba vecchia. Verificato nella stessa passata che l'unico gruppo di ambiente collegato
  (`metabole-shared`) contiene solo `CRON_SECRET`: nessun'altra sorgente nascosta.

- `[Sviluppo]` **Posta backoffice — «Ricevuta» e «Inviata» erano testo nudo** (segnalato da Simone:
  «così è proprio brutto»). Il markup usava un *segmented control* (`.seg`) copiato dall'app
  cliente, ma quel CSS nel backoffice **non esiste**: le due voci uscivano come due righe di testo
  impilate accanto a due pulsanti veri. Ora sono due pulsanti come gli altri della barra — pieno
  quello attivo, fantasma l'altro, con le icone di posta in arrivo e inviata — e si disabilitano
  durante il caricamento come «Aggiorna». Era l'unico punto del backoffice che usava `.seg`.

- `[Sviluppo]` **Il backend ora si type-checka anche fuori da Render, e il compilatore fa la
  guardia sugli stati.** Finora il type-check del backend esisteva solo dentro il deploy: nel
  sandbox il client Prisma non è generabile, quindi ogni errore di tipo si scopriva a build in
  corso. Sul Mac di Simone bastano `npm install` in `backend/` e
  `./node_modules/.bin/tsc --noEmit -p tsconfig.build.json`: **primo giro fatto oggi, zero
  errori**. Un minuto, e diventa la rete di sicurezza prima di ogni consegna backend
  (annotato in memoria, con la trappola dell'`npx tsc` che scarica un pacchetto omonimo inutile).
  Con quella rete disponibile, tolti i due `as never` dalle query corrette poco fa: erano proprio
  loro a spegnere il controllo del compilatore e a lasciar passare `'paused'` due volte. Ora uno
  stato inesistente **non compila**. La regola generale finisce in memoria: il cast serve per i
  campi Json, non per i valori di enum in un `where`.

- `[Sviluppo]` **500 in produzione sulle attività coach: `'paused'` non è uno stato di
  Subscription** (trovato nei log di Render mentre cercavamo altro). L'enum è
  `pending|active|cancelled|expired` — una pausa non cambia lo stato dell'abbonamento, vive in
  `pause_request`. In `coach-tasks.service.ts` la tripla `['active','pending','paused']` compariva
  in **due** punti: il riepilogo delle attività coach (che l'app ingoia in silenzio: la striscia
  in cima spariva e basta) e il **tick delle prove**, cioè la generazione automatica dei task.
  Introdotto stamattina con `f9900c8`, live da allora.
  ⚠️ **Era già successo**: lo stesso errore era stato corretto in `commerce.service.ts:204`, dove
  faceva 500 su `/me/plans` — e da lì la tripla sbagliata è stata **ricopiata**. Il `as never` che
  serve a far compilare quelle query è anche ciò che spegne il controllo del compilatore: senza
  qualcosa che guardi, l'errore torna.
  Ho provato a scrivere un controllo statico che confrontasse gli stati citati con l'enum, e **l'ho
  buttato**: con query multilinea produceva quattro falsi positivi su sei segnalazioni, e un
  controllo che grida al lupo viene ignorato — sarebbe stato peggio di niente. La strada giusta è
  togliere `as never` da quelle due query e lasciare che sia **il compilatore** a rifiutare uno
  stato inesistente: si fa quando il type-check del backend è eseguibile davvero (sul Mac, dove il
  client Prisma esiste), non a naso.

- `[Sviluppo]` **Controllo pre-build: l'OTA in produzione non è quello che credevamo.** Prima
  delle build ho letto il manifest pubblico invece di fidarmi dei registri:
  `/api/v1/app-updates/latest.json` serve **`2.0.1`**, non `2.0.3`. Il passaggio a 2.0.2/2.0.3
  annunciato stamattina **non è mai stato completato su Render**: la variabile `OTA_VERSION` è
  rimasta ferma sul bundle della prima pubblicazione. Due conseguenze, una già in corso e una
  peggiore: **oggi** i telefoni scaricano quel bundle vecchio; **stasera**, se la variabile resta,
  chi aggiorna alla 2.1 dallo store si ritrova il web della 2.0.1 **sopra** il nativo nuovo, cioè
  vede l'app di ieri dopo aver aggiornato. Da svuotare **prima** della pubblicazione, non dopo:
  svuotarla non fa tornare indietro nessuno, i telefoni tengono il bundle che hanno già.
  Aggiornate note di rilascio e memoria di progetto. **Lezione**: lo stato dell'OTA vive in una
  variabile d'ambiente su Render — fuori dal repo e fuori da ogni registro. L'unico modo di sapere
  cos'è pubblicato è leggere il manifest, e va fatto prima di ogni release.
  Verificato nella stessa passata: backend up e database raggiungibile; `google-services.json` e
  `GoogleService-Info.plist` al loro posto (senza, le push si spengono in silenzio al build);
  `@capacitor/share` installato; versioni allineate a **5 / 2.1**.

- `[Prodotto]` **Ripuliti i quattro documenti che dicevano il falso** (dall'audit di oggi). Una
  checklist che mente si smette di leggere, e da quel momento non protegge più niente.
  ① `Metabole_Checklist_GoLive.md`: i quattro gate di apertura erano ancora 🔴 pur essendo stati
  confermati il **16 luglio** (Stripe LIVE con pagamento reale, DNS Brevo, backoffice, push) —
  chiusi, annotando che le push iOS sono state riparate solo il 6/8.
  ② `RIEPILOGO_Lavori_Collaudo.md`: dal backlog tolte due voci superate — il modulo campagne
  marketing è **fatto dal 15/7**, e il video di presentazione della coach è **annullato da Simone
  il 17/7**: non è un lavoro in coda, è una cosa che non si fa.
  ③ `Metabole_Checklist_Allineamento_STATO.md`: schermate 28-29 da ⬜ «serve il video» ad
  **annullate**, stessa decisione.
  ④ `progetto/STATO.md`: piani stagionali da ⬜ a 🟡 — il segnale di viaggio esiste con date e
  stati (`clients.service.ts:634-653`) e il popup misure è sospeso in vacanza
  (`menu.service.ts:690,715`); manca il collegamento all'agente dieta e la creazione dei due
  prodotti in produzione. Scritto cosa c'è e cosa manca, invece di una casella vuota.

- `[Sviluppo]` **Revisione del lavoro della giornata, e una regressione mia corretta prima che
  facesse danni.** Rivisto tutto il diff di oggi: il backend contro lo schema Prisma (chiamate,
  DTO, rotte, righe nuove del seed) — nessun bloccante, si può deployare — e il frontend cercando
  regressioni di comportamento. Ne è uscita una vera, introdotta stamattina da me: la barra del
  generatore era legata a `busy`, che però è condiviso da **sette** operazioni della pagina
  (archivia, elimina, salva, valida, pubblica, anteprima). Chi archiviava una variante leggeva
  «Sto generando ricette, giornate, alternative e allergeni… può richiedere fino a un minuto» e
  poteva restare ad aspettare per niente — proprio nella sessione di formazione con la
  nutrizionista. Ora la generazione ha uno stato suo (`generando`).
  Corretto anche un buco in `ota.ts`: un manifest che risponde 200 con **JSON malformato**
  finiva nel `catch` del telefono offline, cioè veniva ignorato — esattamente il difetto che il
  commit di stamattina voleva chiudere. Ora la lettura del manifest sta fuori da quel catch e un
  manifest illeggibile si segnala (`manifest_illeggibile`).
  ⚠️ Emerso durante la revisione, utile la prossima volta che un deploy fallisce:
  `tsconfig.build.json` **esclude `prisma/`**, quindi il seed non viene type-checkato, e da oggi
  gira con `--transpile-only`. Un errore di *tipo* nel seed non ferma più il build; un errore a
  *runtime* lì dentro invece blocca il preDeploy. È il primo posto dove guardare.

- `[Sviluppo]` **Audit di fine giornata e chiusura di quattro difetti «interruttore che non c'è»**
  (richiesta Simone: «tutti i lavori sono stati fatti?»). Verificate 18 richieste del 5/8 più i
  ~90 `REGISTRO_*.md`, il backlog, `STATO.md` e le checklist di luglio, ogni voce ri-controllata
  **nel codice**: 16 su 18 chiuse, la #2 aspetta la nutrizionista, la #10 una decisione.
  Rapporto in `progetto/Audit_Lavori_2026-08-06.md`. Corretti i quattro difetti nuovi trovati:
  ① **`menu_daycombo_kcal_target` era un interruttore finto**: nella pagina *Regole motore* si
  poteva cambiare il valore globale credendo di spostare le calorie dei menu, ma il motore prende
  il target dal **fabbisogno della cliente** (o dai livelli della dieta) e quel parametro non lo
  legge mai — l'unica lettura è nel generatore di bozze. Corretta la **descrizione**, non il
  codice: il target deve venire dalla singola cliente, non da un numero globale.
  ② **`menu_kcal_need_enabled`** (kcal dal fabbisogno o dai livelli: una scelta clinica) e
  **`menu_penalty_season`** (la forza della stagionalità costruita oggi) erano leve vere e
  invisibili: portate nel catalogo del motore, quindi regolabili globalmente e per dieta.
  ③ **`refund_receipt`**: stessa dimenticanza dell'email credenziali, una casella più in là.
  ④ **`marketing_require_consent`** — il gate che esclude dalle campagne i lead senza consenso —
  aveva perfino un commento che diceva «si accende da Parametri», e in Parametri non c'era.
  Seminato insieme a `app_store_url`, `play_store_url` e alle altre 13 chiavi che il codice
  leggeva senza che comparissero da nessuna parte (misure, pausa, offerta di fine prova):
  **stessi valori di prima, quindi nessun cambio di comportamento** — cambia che ora si vedono.
  ⑤ E soprattutto: **`npm run diag:parametri`**, che confronta le chiavi lette dal codice con
  quelle dichiarate e **esce con errore** se divergono. Non serve il database, gira ovunque,
  anche in CI. Tre volte lo stesso difetto non è sfortuna: è che nessuno poteva accorgersene.
  Oggi esce pulito.

- `[Prodotto]` **Nota di handoff per la pubblicazione** — `NOTA_Handoff_Pubblicazione_2026-08-06.md`,
  come da regola di progetto (a ogni tornata di modifiche se ne scrive una per chi pubblica).
  Contiene: i 27 commit della giornata, le superfici toccate e quali richiedono un deploy, le
  **cinque migrazioni**, le env (con `OTA_VERSION` **da svuotare dopo** la pubblicazione), il
  `npm install` obbligatorio in `app/` perché `@capacitor/share` è un plugin nativo nuovo, i due
  passi che ci sono già costati cari (**Xcode chiuso** prima di `build-ios.sh`, **`aps-environment`
  a production** prima di archiviare), lo stato dei test con il perché `continue-on-error` non si
  toglie stasera, **quattro verifiche post-deploy** coi comandi pronti, e l'elenco di ciò che
  resta aperto. Serve a chi pubblica fra sei mesi, quando nessuno si ricorderà perché il seed
  andava in out of memory.

- `[Sviluppo]` **Parametri e modelli email: adesso si possono anche CREARE, non solo modificare**
  — la causa comune dietro due difetti di oggi. `config_param` e `email_template` avevano solo
  lettura e aggiornamento di righe che dovevano già esistere: la promessa «configurabile dal
  backoffice» era vera solo se qualcuno si ricordava di mettere la chiave nel seed, e quando se
  ne dimenticava il sistema usava un default scritto nel codice **senza dirlo a nessuno**. È
  successo con i sei parametri del fabbisogno kcal e con il modello dell'email delle credenziali.
  Ora `POST /admin/config` e `POST /admin/email/templates` (solo admin, con audit), più i due
  riquadri in *Parametri* e *Modelli email*. Chiave validata (minuscole, numeri, underscore) e
  409 parlante se esiste già. Nell'interfaccia è scritto chiaro il punto che conta e che non è
  intuitivo: **la chiave deve essere identica a quella che il codice cerca**, altrimenti la riga
  resta lì e non la usa nessuno.

- `[Sviluppo]` **L'email delle credenziali ora si può modificare dal backoffice** (voce d'audit
  rimasta aperta). `lead_credentials` era l'unica transazionale senza riga in `EMAIL_TEMPLATES`:
  il testo arrivava solo dai default i18n, e chi voleva ritoccarlo non trovava il modello in
  *Modelli email*. È proprio l'email che riceve una cliente come primo contatto con il prodotto,
  quindi è l'ultima che dovrebbe essere intoccabile. Aggiunta col testo identico al default,
  `{{storeButtons}}` compreso — i pulsanti App Store / Google Play si possono spostare o togliere
  riscrivendo il modello. ⚠️ Da sapere: quando un modello esiste a DB **vince sui default i18n**,
  quindi da qui in avanti questa email è in italiano per tutte, anche per una cliente con lingua
  inglese. Vale già per tutte le altre transazionali; se un giorno serviranno davvero le lingue,
  la strada è un modello per lingua, non il ritorno agli i18n.

- `[Sviluppo]` **OTA — un aggiornamento che fallisce non sparisce più in silenzio** (voce rimasta
  aperta dall'indagine di stamattina). `initOta` aveva un `catch` vuoto attorno a tutto: un
  manifest che punta a uno zip inesistente, uno zip corrotto o il telefono senza spazio finivano
  nel nulla — dal nostro lato sembrava tutto a posto mentre sui telefoni non cambiava niente. È
  già successo, ed è la stessa lezione degli script di patch che non verificavano il proprio
  risultato. Ora l'errore viaggia come evento analitico **`ota_error`** (stessa strada di tutti
  gli altri) con fase, versione, url e messaggio, e si ripete **solo se cambia**: un bundle rotto
  lo scopriamo al primo avvio, senza ricevere lo stesso errore da ogni telefono a ogni apertura.
  Il telefono semplicemente offline **non** viene segnalato: non è un errore, riprova dopo.
  Aggiunto anche `ota_scaricato`: finora non sapeva nessuno se un OTA fosse arrivato davvero sui
  telefoni. ⚠️ È codice app: entra con la build 2.1 di stasera, non prima.

- `[Sviluppo]` **Pulizia Keto-Mediterranea, per rifarla da zero col nutrizionista** (richiesta
  Simone). Nuovo `backend/prisma/cleanup-keto-mediterranea.ts` (`npm run cleanup:keto-med`):
  cancella le diete con stile `keto_mediterranean` **o** nome che comincia per «Keto-Mediterranea»
  — quindi anche le varianti del vecchio script — con giornate, regole per prodotto, gruppi di
  equivalenza e le **ricette referenziate solo da quelle diete** (voti e pesi compresi).
  Tre paletti scritti nel codice, non nella memoria di chi lo lancia: **non tocca i 12 preset**
  del generatore (servono a rigenerare), **salta le diete con menu già erogati** perché sono la
  storia di una cliente e le elenca invece di cancellarle in silenzio, e **senza `CONFERMA=1`
  fa solo la prova a vuoto** stampando la tabella di cosa sparirebbe. Una cancellazione a catena
  la si guarda prima di farla.

- `[Sviluppo]` **Generatore: la barra di avanzamento c'era, ma si nascondeva da sola** (segnalato
  da Simone). Era legata a `busy && !status`: appena in pagina c'era una bozza già caricata al
  passo 3 — cioè sempre, dalla seconda generazione in poi, e anche riaprendo la pagina con un
  lavoro in corso salvato in `localStorage` — sparivano barra, riga «sto generando» e persino lo
  spinner sul pulsante. Restava un pulsante fermo per minuti, che è il modo più veloce per far
  pensare che qualcosa si sia bloccato e ricaricare la pagina a metà lavoro. Ora la barra si
  mostra **sempre durante la generazione**. In più avanza anche **quando una variante finisce**
  (prima si aggiornava solo prima di partire, quindi si fermava a 11 su 12 e non arrivava mai al
  100%).

- `[Sviluppo]` **Profilo cliente — «La mia alimentazione»** (richiesta Simone 6/8). La cliente
  sceglieva tipo di alimentazione, pasti e regime in registrazione e poi non li rivedeva mai più:
  non sapeva nemmeno cosa stava seguendo. Ora nel Profilo c'è una scheda in **sola lettura** con
  tipo di alimentazione, pasti (o «Digiuno intermittente», con la finestra scelta), **dieta
  assegnata** e regime. Nuovo `GET /me/nutrition`.
  Il nome della dieta è quello da cui le stiamo **davvero servendo i menu** (ultimo giorno
  erogato), non quello che in teoria le spetterebbe: se i due non coincidono è un problema da
  vedere, non da nascondere dietro un'etichetta ottimistica.
  Non è modificabile di proposito — cambiarla cambia i menu, ed è una decisione clinica: dal
  backoffice serve già il permesso `change_diet_type`. Ma invece di un muro c'è la strada:
  «Chiedi un cambio alla coach», che apre la chat con lei, e il testo la chiama per nome quando
  l'assegnazione c'è. Le etichette dei tipi di alimentazione arrivano da `dietInfo.ts`, le stesse
  del "?" in registrazione: un nome solo per la stessa cosa.

- `[Sviluppo]` **Ricette: ogni intestazione ordina, ogni colonna ha il suo filtro, e c'è la colonna
  Stagioni** (richiesta Simone 6/8, dalla pagina Gestione dieta). Con la Keto-Mediterranea che da
  sola porterà centinaia di piatti, scorrere l'elenco a occhio non era più un modo di lavorare.
  Le otto intestazioni sono cliccabili (freccia su/giù) e sotto ognuna c'è il controllo giusto:
  testo per Nome e Tag, tendina per Regime, Pasto, Difficoltà, Stagioni e Stato, min/max per le
  Kcal. Il **pasto si ordina come nella giornata**, non in alfabetico — «Cena, Colazione, Merenda»
  sarebbe corretto e inutile. In alto il conteggio «N su M» con *Azzera filtri*.
  Nuova colonna **Stagioni**: le stagioni impostate come pastiglie, «Tutto l'anno» in grigio se
  vuote — così si vede a colpo d'occhio quali piatti non sono ancora stati stagionati, che è
  esattamente il buco da cui è passato lo spezzatino a luglio (voce #11).
  ⚠️ **Trovato per strada:** `listRecipes` tagliava a **200 ricette** senza dirlo. Filtrare e
  ordinare su una fetta del catalogo, credendo di lavorare su tutto, è peggio che non filtrare:
  tetto portato a **1000** e, quando viene toccato, la pagina lo scrive invece di far finta di
  niente. I filtri della barra in alto (ricerca, regime, pasto) sono spariti: erano gli stessi,
  ora stanno nelle colonne, e un filtro solo è meglio di due che si contraddicono.

- `[Prodotto]` **DECISIONE — su Mantenimento e Monitoraggio il nutrizionista prende 0%** (Simone,
  6/8), sia sul primo addebito sia sui rinnovi; sui percorsi 1/3/6 mesi il 15% resta. Aggiornati
  `progetto/Decisione_Provvigioni_Rinnovo.md` e `progetto/Prezzi_Finali_Provvigioni.md` (la
  domanda aperta dal 17/7 è sciolta). Rifatti i conti: con la sola coach al 45%, dodici mesi di
  una cliente in mantenimento lasciano **€326,67** con provvigione solo al primo addebito,
  **€183,12** con provvigione piena a ogni rinnovo, **€254,84** con la metà — il residual pieno
  passa da €131 a €183 e diventa un'ipotesi praticabile. Resta da decidere la sola quota coach.
  ⚠️ Emerso verificando: i due piani nascono dal seed **senza importi di provvigione**, quindi il
  default è 0 per tutti i ruoli — se in Negozio non sono mai stati compilati a mano, oggi il
  mantenimento non paga provvigioni nemmeno alla coach. Nel documento c'è il comando per
  controllarlo su Render prima di decidere.

- `[Prodotto]` **Provvigioni sul rinnovo: la decisione messa in chiaro, coi numeri veri** — è
  l'unico nodo che tiene ferma la voce #10 e con lei tutti gli abbonamenti ricorrenti. Nuovo
  `progetto/Decisione_Provvigioni_Rinnovo.md`: sul Mantenimento (€29/mese, coach 45% +
  nutrizionista 15%, ~€0,69 di Stripe) dodici mesi di una cliente lasciano a Metabole **€322 con
  la provvigione solo al primo addebito, €131 con la provvigione piena a ogni rinnovo, €227 con
  la metà** — quasi 200 euro di differenza per cliente fra la prima e la seconda ipotesi. Detto
  anche il rovescio di ciascuna: con zero sui rinnovi la coach continua a seguire quella cliente
  gratis, e le clienti in mantenimento sono proprio quelle che si perdono in silenzio. Due
  varianti aggiunte al tavolo: **residual a scadenza** (12 mesi, poi zero) e **provvigione solo a
  coach ancora assegnata**, che conviene comunque, qualunque opzione si scelga. Lato codice serve
  poco e tutto additivo: importi di rinnovo sul `Plan`, distinzione primo pagamento/rinnovo in
  `generateCommissions` (`billing_reason` arriva già da Stripe), un contatore se si sceglie il
  residual a scadenza. I pagamenti una-tantum in produzione non si toccano.
  Aggiornata anche la memoria di progetto (`metabole-riparti-qui.md`) allo stato di stasera.

- `[Prodotto]` **Guida al generatore per la nutrizionista** — Simone genera le 12 varianti
  Keto-Mediterranea dal backoffice invece che da script, usando la sessione come **formazione**.
  Nuovo `progetto/Guida_Generatore_KetoMediterranea.md`: la distinzione fra *definizione* e *dieta
  generata* (eliminarne una non elimina l'altra: è la trappola più comune), perché le varianti sono
  12 e non una, la sequenza dei tre passi, e soprattutto l'avvertenza sul pulsante *Valida e
  pubblica tutte* — segna gli **allergeni come verificati** per tutte le ricette, e quelli proposti
  sono indovinati dagli ingredienti, non revisionati. Il controllo va fatto prima. Segnalato anche
  che il generatore **non compila stagioni e difficoltà**: vuoto vale tutto l'anno, ed è
  esattamente ciò che a luglio produce lo spezzatino (voce #11).

- `[Sviluppo]` **Verifica di fine giornata sulle 18 voci del 5/8, e note di rilascio 2.1.**
  Controllate una per una contro il registro e il codice, non a memoria: **17 su 18 chiuse**.
  Fuori resta solo la **#10** (monitoraggio a pagamento dopo il mantenimento), bloccata dallo
  Stripe ricorrente e dalla decisione sulle provvigioni sul rinnovo. La **#2** (ingredienti Keto
  troppo difficili) è chiusa lato codice con la Keto-Mediterranea nel generatore: restano la
  generazione e la validazione della nutrizionista, che non bloccano la pubblicazione perché una
  dieta non approvata non la vede nessuna cliente. Nuovo `progetto/Note_Rilascio_2.1.md`: testo
  pronto per App Store e Play (entro i 500 caratteri di Play), sequenza della serata e i due
  promemoria che ci sono già costati un incidente — `aps-environment` a **production** prima
  dell'invio iOS, e **`OTA_VERSION` da svuotare** su Render dopo la pubblicazione.

- `[Sviluppo]` **Messa in lista: una card per prodotto e non per stile in registrazione**
  (decisione Simone, 6/8). Voce nuova in `metabole-backlog.md` con diagnosi e piano: oggi
  `GET /onboarding/diet-products` tiene **una dieta per stile**, quindi Vegana, Vegetariana,
  Flexitariana e Flessibile — tutte `flexible` — si vedono come una voce sola (18 famiglie in
  backoffice, 8 card nell'app). Non basta togliere il filtro: la registrazione salva `dietStyle` e
  il motore abbina per stile+regime+obiettivo+pasti, quindi due prodotti dello stesso stile e regime
  sarebbero indistinguibili e la cliente potrebbe ricevere l'altro. Serve salvare **quale prodotto**
  è stato scelto, con ricaduta sullo stile per le clienti già registrate: migrazione + verifica sul
  motore, non un lavoro da sera di pubblicazione. Aggiornato anche
  `progetto/Metabole_KetoMediterranea_Materia_Prima.md`: la dieta ora è nel generatore, il documento
  resta come riferimento sulla materia prima per la revisione della nutrizionista.

- `[Sviluppo]` **Keto-Mediterranea agganciata al generatore esistente** (richiesta Simone: «perché non
  agganci al generatore già creato?»). La dieta ora è una **dieta suggerita** dentro *Creazione e
  validazione*, come tutte le altre: `SUGGESTED_PRESETS` in
  `backend/src/engine-rules/engine-rules.presets.ts` con **12 varianti** — 2 regimi (onnivoro,
  vegetariano) × 2 obiettivi (dimagrimento 1500 kcal, mantenimento 1800 kcal) × 3 strutture pasti
  (3 pasti, 5 pasti, digiuno 16:8). Il capo nutrizionista la richiama, preme *Genera tutte le 12
  varianti* e poi *Valida e pubblica tutte*: stessa strada delle altre diete, nessun percorso
  parallelo. Il vincolo che dà senso al prodotto vive in `clinicalNotes`, che finisce dentro il
  prompt del generatore: chetosi < 50 g carboidrati, grassi di qualità (olio d'oliva, pesce azzurro,
  frutta secca, olive), **solo ingredienti da supermercato italiano** con l'elenco esplicito dei
  vietati-perché-introvabili (farine speciali, dolcificanti particolari, prodotti "keto"
  confezionati, olio MCT, proteine in polvere, addensanti) e la richiesta di ricette semplici.
  **Vegana esclusa di proposito**: senza legumi e senza derivati della soia da negozio specializzato
  non regge né sul fronte proteico né su quello della reperibilità — se servirà è un prodotto a sé.
  Il seeder dei preset ora confronta anche regime/obiettivo/pasti (prima solo stile+etichetta,
  e una famiglia con più varianti si sarebbe fermata alla prima) e scrive il campo `meals`.
  Aggiunta l'etichetta `keto_mediterranean` → «Keto-Mediterranea» nelle sei mappe che la usano
  (catalogo, taxonomy backoffice, regole motore, report di fine piano, email lifecycle, nome del
  percorso consigliato). ⚠️ **Superato lo script `seed:keto-med`**, rimosso: le ricette scritte a
  mano non passavano dal generatore, e due strade per creare la stessa dieta sono una di troppo.
  La variante che aveva già creato si chiama `Keto-Mediterranea (5 pasti)` — nome diverso da quello
  del generatore (`Keto-Mediterranea`), quindi non va in conflitto: è una bozza non visibile alle
  clienti e va semplicemente eliminata da *Catalogo diete*, per non lasciare due prodotti simili.

- `[Sviluppo]` **Registrazione: il "?" mancava su metà dei percorsi, e i nomi non erano quelli del
  backoffice** (segnalato da Simone con due schermate). Due cose diverse.
  *Il "?"*: la scheda informativa esisteva solo per mediterranea, proteica, low-carb e keto, quindi
  DASH, Flessibile, Detossinante, Vacanza estiva e Rientro estivo restavano senza spiegazione.
  Scritte le **cinque schede mancanti** con lo stesso criterio delle altre — cos'è, in pratica, cosa
  dice la ricerca, cosa tenere presente — e fonti **per scheda** dove servono altre fonti (NHLBI per
  la DASH; la revisione critica di Klein & Kiat per il Detox, che dice apertamente che le detox
  commerciali non hanno prove: la scheda lo scrive invece di nasconderlo). Aggiunta in
  `dietInfo.ts` la regola: ogni stile pubblicato deve avere qui la sua scheda.
  *I nomi*: l'app mostrava «Chetogenica», «Dash», «Rientro estivo» perché quelle diete non hanno un
  nome commerciale impostato e si ripiegava sul **codice stile**, mentre in backoffice le stesse
  diete si chiamano «Keto (non terapeutica)», «DASH (anti-ipertensiva)», «Ritorno in Equilibrio».
  Ora `GET /onboarding/diet-products` ripiega sul **nome vero della dieta** e solo in ultima istanza
  sullo stile: un nome solo, quello che la nutrizionista ha scritto.
  ⚠️ **Resta aperto**: la registrazione mostra **una card per stile**, non per dieta. Le famiglie che
  condividono lo stesso stile (Vegana, Vegetariana, Flexitariana e Flessibile sono tutte `flexible`)
  si vedono come una sola voce. Per separarle serve che la registrazione salvi *quale prodotto* è
  stato scelto e non solo lo stile — oggi il motore abbina per stile+regime+obiettivo+pasti. Da
  decidere insieme: non è una modifica da sera di pubblicazione.

- `[Sviluppo]` **`npm run prisma:seed` andava in out of memory su Render** — unico script del
  progetto senza `--transpile-only`: `ts-node` provava a fare il type-check dell'intero progetto in
  memoria e il container non ce la faceva («Reached heap limit»). Il seed quindi non girava, e i
  parametri nuovi (fra cui i sei `kcal_need_*`) non finivano mai in tabella. Aggiunto
  `--transpile-only` come negli altri script.

- `[Sviluppo]` **Keto-Mediterranea inserita nel catalogo come BOZZA** (voce #2, decisione Simone).
  Script `backend/prisma/seed-keto-mediterranea.ts` (`npm run seed:keto-med`): crea la dieta
  `keto_mediterranean` con **30 ricette** (6 per slot) e **7 giornate di rotazione su due livelli**
  (1450 e 1700 kcal), costruite solo con ingredienti da supermercato italiano — niente farine
  speciali, dolcificanti particolari o prodotti "keto" confezionati, che erano la causa della
  segnalazione. Tre criteri presi dalla ricerca e non inventati: grasso principale da olio d'oliva,
  olive, frutta secca e pesce grasso (Harvard: a parità di schema è la **qualità dei grassi** a
  cambiare gli esiti); proteine soprattutto da pesce e uova; verdure a basso contenuto di carboidrati
  in abbondanza, perché le fibre sono il punto debole noto delle chetogeniche. Ripartizione di
  riferimento ~70-75% grassi, ~20-25% proteine, ~5% carboidrati.
  ⚠️ **Nasce `status: draft` e `clientVisible: false`**: il motore serve menu solo da diete
  approvate, quindi **nessuna cliente la riceve** finché la nutrizionista non la approva dal
  backoffice. Le kcal e i macro sono stime coerenti fra loro, utili a far girare il motore ma da
  verificare; `allergensReviewed` resta **false** perché gli allergeni indicati sono quelli ovvi e
  non una revisione clinica. Lo script è idempotente e non sovrascrive il lavoro della nutrizionista.
  Stagioni e difficoltà già compilate piatto per piatto.

- `[Sviluppo]` **Keto-Mediterranea: preparata la materia prima per il catalogo** (voce #2). Il
  problema segnalato non erano le ricette lunghe ma gli **ingredienti introvabili** (farine speciali,
  dolcificanti particolari, prodotti "keto" confezionati). Invece di rattoppare la Keto esistente,
  idea di Simone: un prodotto NUOVO costruito solo su ingredienti da supermercato italiano.
  La combinazione ha una base in letteratura — esiste uno studio italiano su chetogenica mediterranea
  in pazienti con prediabete e diabete di tipo 2, e Harvard segnala che è proprio la **qualità dei
  grassi** a cambiare gli esiti a parità di schema: olio d'oliva, pesce azzurro e frutta secca invece
  di burro e insaccati. Nuovo documento `progetto/Metabole_KetoMediterranea_Materia_Prima.md` con la
  tavolozza di ingredienti per slot, l'elenco di cosa NON usare e i vincoli di inserimento.
  ⚠️ **Non contiene menu**: quelli li compone e valida la nutrizionista (regola ferrea n.1).
  Aggiunta anche la scheda informativa del "?" per lo stile `keto_mediterranean`, pronta per quando
  la dieta verrà pubblicata. **Non serve codice per crearla**: `dietStyle` è una stringa libera, la
  dieta compare da sola in registrazione appena è approvata e visibile al cliente.

- `[Sviluppo]` **Misure non inserite: menu fermo, solleciti ogni 2 ore, app bloccata e sblocco
  dalla coach** (voce #6). Il popup bloccante c'era già e tratteneva il menu, ma ci si conviveva.
  Ora il gate ha due livelli: il primo giorno resta il popup richiudibile; dopo
  `measures_lock_after_hours` (24) **l'app si blocca** con «Contatta la tua coach per sbloccare la
  app» — restando sempre possibile inserire le misure lì e ripartire subito. Nuovo cron **ogni due
  ore** (`/internal/cron/measures-nudge`, aggiunto a `render.yaml`): sollecita la cliente con un
  tono che cambia quando l'app è bloccata, e apre un'attività alla coach **una volta per ciclo**.
  Niente solleciti di notte (finestra 8-22, nei parametri). La coach riapre dalla scheda cliente:
  `POST /staff/clients/:id/measures-unlock` concede una **finestra di grazia a tempo**
  (`measures_unlock_hours`, 48) e non un interruttore permanente — uno sblocco senza scadenza
  equivarrebbe a spegnere la regola per sempre, e nessuno si ricorderebbe di riaccenderla.
  **Flag `is_store_reviewer`**: sugli account dei recensori di Apple e Google il blocco non scatta
  mai. Se si trovassero davanti a un muro rifiuterebbero la pubblicazione.

- `[Sviluppo]` **Motore — stagionalità delle ricette** (voce #11: una cliente si è vista proporre
  lo **spezzatino a luglio**). Nel sistema non esisteva alcuna nozione di stagione: il motore non
  aveva modo di saperlo. Nuovo campo `recipe.seasons`. **Scelta di progetto (Simone, 6/8): la
  stagione sta sulla RICETTA, non sull'ingrediente** — un catalogo degli alimenti coi mesi di
  raccolta sarebbe più preciso ma richiede di classificare centinaia di voci prima di vedere un
  beneficio, mentre il piatto lo si giudica a colpo d'occhio ed è quello che la cliente vede.
  **Regola morbida**: fuori stagione il piatto è penalizzato nel punteggio (`menu_penalty_season`,
  default 0.5), non escluso — con un catalogo da classificare escludere lascerebbe buchi, e un
  piatto fuori stagione è meno grave di una cena mancante. Vuoto = tutto l'anno, quindi finché
  nessuno classifica nulla **il comportamento non cambia**. Stagioni meteorologiche e non
  astronomiche: a fine giugno il calendario direbbe ancora primavera, ma nessuno cucina lo
  spezzatino. Selettore nel backoffice, sulla scheda ricetta.

- `[Sviluppo]` **Registrazione — un "?" accanto a ogni tipo di dieta** (voce #5). Popup che spiega
  il *modo di mangiare*, non quello specifico percorso: cos'è, cosa cambia in pratica, cosa dice la
  ricerca, cosa tenere presente. Testi da fonti istituzionali — **Harvard T.H. Chan School of
  Public Health (The Nutrition Source)** e **Mayo Clinic** — e non promozionali: per ogni stile si
  dice anche il rovescio della medaglia (l'adattamento delle prime settimane nella low-carb, le
  controindicazioni della keto in gravidanza e con problemi renali, la qualità delle fonti
  proteiche), niente promesse e niente numeri di chili. Testi in `app/src/onboarding/dietInfo.ts`,
  con in testa le regole da rispettare per aggiungerne.

- `[Sviluppo]` **Motore — quando lo stile scelto non è disponibile, adesso si sa** (seconda metà
  della #5: «intanto me la devi applicare»). `pickDiet` ha una catena di ripieghi che, se per lo
  stile richiesto non esiste una dieta approvata, ne serve una di un altro stile: meglio un menu
  che nessun menu, ma finora succedeva **in silenzio** — si sceglieva Keto e arrivava Mediterranea.
  Ora resta traccia (log + evento `diet_style_fallback`), così il buco di catalogo si vede.

- `[Sviluppo]` **App — «Porta un'amica» in Home, col foglio di condivisione nativo** (voce #13).
  `GET /me/referral` esisteva già e generava il codice, ma nell'app **non c'era nessun posto in cui
  vederlo**: l'invito funzionava solo se qualcuno ti dettava il codice a voce. Card sotto i
  quadrotti, con codice, conteggio inviti e pulsante Condividi. Nuovo plugin `@capacitor/share`
  (⚠️ **nativo**: richiede una build store) e `lib/share.ts` con tre strade — foglio nativo su app,
  `navigator.share` sui browser che lo supportano, copia negli appunti sul desktop.

- `[Sviluppo]` **Posta — inviata e cestino** (voci #12 e #17). La posta inviata era già servita da
  `GET /me/mailbox/sent` ma nel backoffice nessuno la chiedeva (nell'app staff c'era già). Aggiunte
  le schede Ricevuta/Inviata e il **cestino** sui messaggi ricevuti, in backoffice e nell'app della
  coach. Nuovo `DELETE /me/mailbox/message/:uid`: **non cancella davvero**, sposta nella cartella
  cestino del server. Su una casella condivisa fra operatrici un pulsante che distrugge sarebbe un
  rischio. Se il server rifiuta lo spostamento si ripiega sul flag `\Deleted`.

- `[Sviluppo]` **Email credenziali — pulsanti «Scarica su App Store» e «Scarica su Google Play»**
  (richiesta Simone 6/8, voce #18). Nuovo segnaposto `{storeButtons}` (nei modelli editabili dal
  backoffice: `{{storeButtons}}`), disponibile anche se il testo viene riscritto da lì. Gli URL
  stanno in `config_param` (`app_store_url`, `play_store_url`) e non nel codice: gli store cambiano
  indirizzo e non deve servire un deploy per correggerli. Sono pulsanti di **testo** e non i badge
  ufficiali a immagine, perché quasi tutti i client di posta bloccano le immagini remote finché non
  le sblocchi a mano — e un badge invisibile non lo clicca nessuno.

- `[Sviluppo]` **Onboarding — si chiede il livello di attività fisica** (voce #15). Finora si
  chiedeva soltanto «che lavoro fai?», da cui il fabbisogno calorico ricavava un fattore
  approssimato; chi non passava dal Profilo restava col default 1,4. Fra sedentaria e molto attiva
  ballano 700-900 kcal al giorno: era l'input che sposta di più il risultato, ed era l'unico tirato
  a indovinare mentre peso, altezza ed età erano dati veri.

- `[Sviluppo]` **Seed — i sei parametri del fabbisogno calorico** (voce #16, chiude anche la voce 2
  dell'audit). `kcal_need_floor_female/male`, `deficit_max_pct`, `deficit_max_kcal`, `kcal_per_kg`,
  `default_deficit_pct` erano costanti nel codice: funzionavano, ma dal backoffice non si potevano
  toccare e nessuno sapeva che esistessero. Ora sono in `config_param` con una descrizione che
  spiega cosa fanno.

- `[Sviluppo]` **Motore/App — digiuno intermittente: la cliente sceglie quali pasti saltare, e la
  giornata 20-4 una volta a settimana** (feedback clienti 5/8, voce #7). Finora scegliere «digiuno
  intermittente» selezionava soltanto le diete marcate `fasting`: la finestra alimentare la decideva
  il template del nutrizionista e la cliente non aveva voce in capitolo — ma saltare la colazione o
  saltare la cena sono due vite diverse. Nuovo campo `client_profile.fasting_window`
  (`skip_breakfast` | `skip_breakfast_lunch` | `skip_dinner_breakfast`, NULL = comportamento storico,
  quindi nessuna cliente esistente cambia menu da un giorno all'altro). Gli slot saltati escono
  **prima** della composizione della giornata, non dopo: così il target calorico si ridistribuisce
  sui pasti rimasti invece di lasciare un buco. Lo spuntino del mattino segue sempre la colazione
  (uno spuntino alle dieci riaprirebbe la finestra). Rete di sicurezza: se il filtro svuotasse la
  giornata viene ignorato — meglio un digiuno impreciso che una cliente senza niente da mangiare.
  La domanda compare in onboarding **solo** a chi sceglie il digiuno: per farlo è nato un supporto
  generico ai campi condizionati (`showIf` nello schema del questionario) al posto dell'unico caso
  scritto a mano; i campi nascosti non bloccano più l'avanzamento. La finestra è modificabile anche
  dal Profilo e dal backoffice. Una volta a settimana parte il suggerimento della **20-4**, spiegato
  per esteso nel messaggio (venti ore di digiuno, un solo pasto completo, si beve normalmente, si
  può saltare) e non inviato a chi è in pausa né a chi salta già colazione e pranzo, perché la sta
  già facendo.

- `[Sviluppo]` **Email di lifecycle — `{{primoPasto}}` diceva sempre «colazione»** (voce 1
  dell'audit, segnalata da una cliente). Il controllo guardava `regime`, che vale
  omnivore/vegetarian/vegan/pescetarian: il confronto con `intermittent_fasting` era **sempre
  falso**, quindi a ogni cliente in digiuno le email dicevano di partire proprio dal pasto che salta.
  Ora legge `pathType` e tiene conto della finestra scelta: chi salta colazione e pranzo riparte
  dalla cena, chi salta cena e colazione dal pranzo. Aggiunti i due campi alle query, che non li
  selezionavano.

- `[Sviluppo]` **App/Backend — check-in solo con un piano attivo, e con energia, fame e stress**
  (feedback clienti 5/8, voce #1). `GET /me/today` restituisce ora `hasActivePlan` e `checkinDue`:
  la regola sta nel dominio e non sparsa nel frontend, e a piano scaduto o mai comprato il popup
  «Come ti senti oggi?» non compare più — era una domanda senza seguito, che a una cliente senza
  percorso suonava come un richiamo. Durante una **pausa** il piano resta attivo, quindi il check-in
  continua: è voluto, è l'unico filo teso mentre i menu sono sospesi. Il popup è diventato a due
  passi: primo tap sull'umore come prima (l'abitudine non cambia), poi tre scale 1-5 per **energia,
  fame e stress** con gli estremi scritti a parole. Erano campi già previsti da schema e DTO ma
  quasi sempre vuoti, perché nessuno li chiedeva.

- `[Sviluppo]` **Doc — `progetto/Metabole_Piano_Stripe_Ricorrente.md`** — piano del 20/7 per gli
  abbonamenti ricorrenti, ritrovato e messo nel repo con una nota di verifica: `stripe.service.ts`
  usa tuttora `mode: 'payment'`. È il prerequisito della voce #10 (monitoraggio a pagamento dopo il
  mantenimento). ⚠️ Decisione aperta e delicata: le **provvigioni sul rinnovo** (oggi si generano su
  ogni pagamento approvato, quindi col ricorrente si pagherebbero piene ogni mese).

- `[Sviluppo]` **App — header verde davvero fisso, grafici scorrevoli, card obiettivo col segno giusto**
  (feedback clienti 5/8, voci #8 #9 #14). La causa dell'header non era il `top` dello sticky: `.screen`
  aveva `overflow-y:auto` ma `.app-frame` ha `min-height` (non `height`), quindi `.screen` cresce col
  contenuto e non scorre mai — restava un contenitore di scorrimento fermo a cui l'header si ancorava,
  mentre a scorrere era la finestra. Tolto `overflow-y` da `.screen` e `top: 0` sull'header (era negativo).
  Riprodotto e verificato in Chromium con notch simulato. I grafici: con una sola metrica misurata c'era
  un solo grafico e niente da scorrere, ma la scritta «scorri i grafici» compariva lo stesso; ora appare
  solo con più di un grafico, i pallini sono diventati pulsanti e su desktop compaiono due frecce
  (nuovo `CarouselNav.tsx`). Card «Verso il tuo obiettivo»: i movimenti si stampano col segno esplicito
  (`+1,0 di -6,0 kg`) invece di anteporre un `-` fisso che col peso in aumento produceva `--1,0`; quando
  la misura va contro l'obiettivo la barra si colora e compare una riga di contesto invece di uno 0% muto.

- `[Sviluppo]` **CI «Android APK (debug)» verde per la prima volta** — era rossa da sempre.
  `checkDebugAarMetadata` falliva perché `androidx.work` richiede compileSdk 35+ e il progetto era a 34:
  il workflow rigenera `android/` da zero con `cap add android` (template Capacitor 6) ma non lanciava
  `npm run android:play`, cioè lo script che porta compile/target a 36, minSdk a 23, AGP a 8.9.1 e
  Gradle a 8.11.1. Aggiunta la riga mancante. *Lezione: ogni `install-*.mjs` che patcha il progetto
  nativo va ripetuto in CI, perché lì la cartella nasce vuota a ogni run.*

- `[Sviluppo]` **Sicurezza — chiave APNs privata trovata nel repo PUBBLICO** — `AuthKey_PV537G937B.p8`
  (Team Scoped, valida per tutte le app del team) era committata dal 28/7 e scaricabile da chiunque.
  Chiave revocata e sostituita con una **Topic Specific** su `app.metabole` (Key ID `RB5M26KTPU`),
  caricata su Firebase e tenuta in `~/MetaboleKeys`. File tolto dall'indice; `.gitignore` ora blocca
  `*.p8 *.p12 *.mobileprovision *.keystore *.jks`.

- `[Sviluppo]` **Push iOS: non hanno MAI funzionato dalla 2.0 — causa trovata e corretta** —
  `AppDelegate.swift` non conteneva né `didRegisterForRemoteNotificationsWithDeviceToken` né
  `didFailToRegisterForRemoteNotificationsWithError`. `install-ios.mjs` li cablava con una `replace()`
  su un metodo preesistente: non trovandolo non sostituiva nulla e **non protestava**, stampando
  comunque «Firebase configurato». Così l'app chiedeva il permesso, chiamava `register()`, iOS
  consegnava il token — e non c'era nessuno ad ascoltare: né evento `registration` né errore.
  Ora lo script **inserisce** i metodi se mancano, aggiunge la gestione degli errori e **rilegge il
  file** verificando il risultato, uscendo con errore se il cablaggio non è completo. Verificato:
  la push arriva sull'iPhone. ⚠️ Correzione **nativa**: per le clienti serve una nuova build store.

- `[Sviluppo]` **Strumenti di diagnosi delle push** (nati dall'indagine, restano utili) —
  pulsante **«Push di prova»** nella scheda cliente del backoffice (solo admin,
  `POST /admin/push-test/:userId`): manda un ping ignorando preferenze e il limite «una al giorno»,
  elenca i dispositivi con l'errore di ciascuno e dà una diagnosi in italiano. `push.ts` non ha più il
  listener vuoto: manda il motivo del fallimento a `POST /me/push-tokens/error` (salvato come
  `AnalyticsEvent`, nessuna migrazione) e traccia ogni passo di `initPush`.

- `[Sviluppo]` **OTA — due guardie in `ota-release.mjs` dopo altrettanti incidenti** — (1) senza
  `app/google-services.json` il build riesce ma Vite elimina tutto il codice di registrazione push:
  un OTA così **spegne le push** su ogni telefono che lo riceve, in silenzio; (2) Capgo confronta la
  **stringa** di versione, non il contenuto, quindi ripubblicare un bundle diverso con lo stesso numero
  non raggiunge chi ha già scaricato quel numero — il 6/8 sono usciti tre bundle diversi tutti come
  «2.0.1». Ora lo script si rifiuta di costruire in entrambi i casi.

- `[Sviluppo]` **Repo spostato fuori da iCloud** → `~/Progetti/Metabole`. iCloud teneva i file come
  segnaposto vuoti e corrompeva `.git`. Aggiornati `build-ios.sh`, `build-aab.sh`, `build-apk.sh`, che
  puntavano tutti alla vecchia cartella.

- `[Sviluppo]` **Motore — sorveglianza durante la pausa vacanza** (feedback clienti 5/8, voce #3).
  Finora la pausa sospendeva i menu e spostava la scadenza, ma per tutta la sua durata nessuno chiedeva
  il peso e la coach non sapeva nulla: una cliente poteva sparire per novanta giorni. Il modulo
  `monitoring` faceva già questa vigilanza ma è riservato a chi NON ha un piano attivo, quindi durante
  una pausa era escluso per costruzione. Aggiunti tre campi a `pause_request` (peso di riferimento,
  ultimo promemoria, avviso coach) e un giro giornaliero nel cron: fissa il riferimento all'inizio,
  chiede una pesata ogni `pause_watch_ask_days` (5) con tono da vacanza, e se il peso supera
  `pause_watch_regain_kg` (2) crea un'attività per la coach e la avvisa, **una volta sola per pausa**.
  Nessuna proposta commerciale, per decisione esplicita: la cliente è in vacanza e ha già pagato.

- `[Sviluppo]` **Dato di produzione — piano Mantenimento riparato** — «Mantenimento Metabole» aveva
  `period = 1m` (cambiato il 18/7): per il backend il mantenimento non esisteva, quindi compariva nello
  shop a tutte, il riquadro nel report non appariva, il monitoraggio non si sbloccava. Rimesso a
  `maintenance` dal Negozio, `diag:mantenimento` ora ✓. Zero abbonamenti coinvolti.

## 2026-07-15

- `[Sviluppo]` **Sito — separatore delle migliaia su tutti i contatori** — `fmtN` ora forza il
  raggruppamento (`useGrouping:'always'`): l'italiano per standard CLDR non separa i numeri a 4 cifre
  (6729 restava senza punto mentre 86.310 lo aveva). Ora 6.729+ / 86.310+ in tutte le 9 lingue, con
  fallback regex per browser datati. Solo `Metabole_Sito_Presentazione.html`, da ripubblicare su SiteGround.

- `[Sviluppo]` **Sito — descrizioni card percorsi a 4 righe con "…" e click per espandere** — le note
  cliniche lunghe non allungano più le card: CSS line-clamp a 4 righe con ellissi; click/tap sulla
  descrizione la espande (e richiude). Solo `Metabole_Sito_Presentazione.html`, da ripubblicare su SiteGround.

- `[Sviluppo]` **Sito — contatore "percorsi gestiti" e carosello collegati al catalogo Diete** —
  `GET /public/paths` ora restituisce le diete **APPROVATE** del catalogo (status `approved`, una card
  per dieta, senza dedup per stile) invece delle sole `clientVisible` raggruppate per stile;
  `GET /public/stats.methods` conta le stesse → il numero sulla home cresce quando il nutrizionista
  approva una nuova dieta, senza deploy del sito. Aggiunto alias `desc` accanto a `description` nel
  payload (il carosello del sito legge `p.desc`: ora le card mostrano anche la descrizione).
  **Sotto il nome, in piccolo: note cliniche** — se la dieta non ha una descrizione cliente, la card
  mostra le `clinicalNotes` del RulePreset dello stesso stile (adottati prima dei suggeriti);
  la descrizione cliente, quando compilata, vince. Nuovo campo `clinicalNotes` nel payload.
  Test: + fallback note cliniche.

## 2026-07-14

- `[Sviluppo]` **Modelli email — anteprima renderizzata** — l'editor dei modelli ora mostra l'email **renderizzata** (iframe isolato, come i PDF) con i segnaposto sostituiti da valori d'esempio, e un interruttore **Anteprima / Codice HTML**; finestra più larga, oggetto in anteprima, elenco segnaposto rilevati dal testo. Prima si vedeva solo l'HTML grezzo (inutilizzabile).

- `[Sviluppo]` **Regole motore — generatore AI di catalogo (bozza) dai preset** — su ogni regola suggerita un pulsante **‘Genera catalogo’**: l'AI (Claude) produce **ricette per pasto** (ingredienti, kcal, macro, cotture), **giornate bilanciate**, **gruppi di equivalenza** (alternative) e **pre-tag allergeni** (dagli ingredienti), coerenti con stile/regime/bande del preset. Tutto in **BOZZA e non attivo**: crea una dieta `draft`, ricette `active:false` con allergeni `da confermare` → il nutrizionista rivede/approva (R7) e conferma gli allergeni (R8) prima che il motore le usi. Endpoint `POST /engine-rules/presets/:id/generate-catalog`; `AiService.generateJson`. Serve `AI_API_KEY` su Render. Test +2. ⚠️ v1: la qualità di kcal/macro/ricette va riverificata dal nutrizionista.

- `[Sviluppo]` **Catalogo — tasto Elimina per diete e ricette** — aggiunto il pulsante Elimina in **Catalogo diete**, **Catalogo ricette** e **Allergeni** (le ultime due eliminano la ricetta). Backend: `DELETE /diets/:id` (rimuove giorni+regole; **bloccato** se la dieta è usata in menu già erogati) e `DELETE /recipes/:id` (rimuove anche valutazioni e pesi appresi), con audit; riservati a nutrizionista/capo nutrizionista.

- `[Sviluppo]` **Utenti — scheda cliccabile con anagrafica + reset password** — cliccando l'email in Utenti si apre `/utenti/:id`: avatar, ruolo/stato, **nome mostrato, nome, cognome, telefono, titolo, indirizzo (`addressLine`+`country`), codice referral**, modificabili dall'admin, con il **Reset password** in scheda. Backend: `UpdateUserDto` esteso all'anagrafica, `update()` applica i campi (+ `Staff.displayName`), `PUBLIC_USER_SELECT` include indirizzo/paese.

- `[Sviluppo]` **Email ciclo di vita — 45 modelli nel backoffice** — caricati nel sistema **Modelli email** i **45 modelli** del ciclo di vita/marketing (attivazione, conversione carrello+nurture, retention/onboarding, **12 email per evento**, rinnovo T7/T3/T1+upsell, win-back, transazionali nuove, consensi) dalla copy di `marketing/Metabole_Email_Ciclo_Vita.md` — **editabili dal backoffice** e inviati via Brevo. `prisma/seed_email_marketing.ts` (HTML email-safe, merge tag {{nome}}/{{piano}}/{{evento}}/…, footer preferenze, no claim medici/no numeri di peso); seed **idempotente** (crea se assente, non tocca subject/body già editati). In **italiano** per ora (modello mono-lingua; per il multilingua andrebbe aggiunta la lingua alla tabella). Restano da agganciare gli **inneschi** (eventi immediati facili; le sequenze a tempo con un job giornaliero).

- `[Sviluppo]` **Regole motore — le 12 regole base sotto le regole globali** — aggiunta in cima al tab *Regole globali* la sezione di riferimento con le **12 regole del Metodo del Motore Intelligente**: Fase A (R1–R7, costruzione base = nutrizionista+strumenti) e Fase B (R8–R12, agente AI del percorso). Sola lettura; i parametri fini che le regolano restano negli interruttori sotto. Backend: `BASE_RULES` nel catalogo + nel payload `/engine-rules/catalog`.

- `[Sviluppo]` **Admin — reset password utenti + interruttore seed demo** — ① l'admin può **resettare la password di qualsiasi utente** dalla pagina Utenti (icona chiave): genera una password **provvisoria** (o ne accetta una fornita), obbliga il cambio al primo accesso, **revoca le sessioni attive** e la mostra una volta sola (endpoint `POST /admin/users/:id/reset-password`; la password non finisce mai nei log). Test +2. ② Interruttore **`SEED_DEMO=false`** (variabile d'ambiente Render): ai deploy successivi il seed **non reinserisce** i dati demo (dieta demo, catalogo Keto, piani/prodotti demo, testimonianze); le strutture (permessi, pipeline, gruppi di equivalenza, preset regole, template) restano sempre seminate. Utile dopo la pulizia pre-lancio.

- `[Sviluppo]` **Script di pulizia dati test/demo (reset pre-lancio)** — `backend/prisma/cleanup-demo.ts` (+ `npm run cleanup:demo`): cancella i dati OPERATIVI (lead, clienti, calendario, visite, segnalazioni, chat, acquisti, bonifici, provvigioni, compensi, catalogo diete + tutto il collegato ai clienti: menu, misure, check-in, abbonamenti, notifiche…) **tenendo** staff, config_param, permessi/ruoli, pipeline, gruppi di equivalenza, regole/preset del motore, piani/prodotti, buoni sconto, template email/PDF, testimonianze, caselle staff. **Anteprima di default** (conta soltanto e mostra cosa resta); cancella solo con `METABOLE_CLEANUP_CONFIRM=SI-CANCELLA`, in **una transazione unica** (se un vincolo blocca → rollback totale, nessuna cancellazione parziale). ⚠️ Da lanciare su Render **dopo un backup/branch del DB Neon**. NB: gli 86k lead importati non sono ancora a DB, quindi non vengono toccati.

- `[Sviluppo]` **Regole motore — permesso abilitabile al nutrizionista + PDF istruzioni** — aggiunta l'etichetta ‘Regole motore’ nella tabella permessi (prima compariva senza nome) e la guardia backend ora ammette il ruolo `nutritionist` così che il capo/admin possa **abilitarla dalla tabella permessi**. Di default resta spenta per il nutrizionista; la voce compare nei Permessi **dopo il prossimo deploy** (all'avvio `syncDefaults` crea la riga per la nuova pagina). Preparato **`Metabole_Istruzioni_Nutrizionista.pdf`** (ruolo, home, allergeni/gruppi di equivalenza/grammature, sicurezza ed esclusioni, chat/segnalazioni, cartella clinica, pagina Regole motore per il capo, regola bigiornaliera).

- `[Sviluppo]` **Chat — instradamento segnalazioni sensibili (decisione socio)** — al **nutrizionista** solo i temi MEDICI (sintomi fisici, gravidanza, terapie farmacologiche → categoria `clinical`); tutto il resto emotivo/comportamentale (immagine corporea, umore, abbuffate, condotte di eliminazione, digiuno) va alla **coach** come `mood_risk` — è lei il primo filtro e inoltra al nutrizionista se serve. `ai-filter` sdoppiato (MEDICAL vs BEHAVIORAL), `chat.service` instrada categoria + notifica + assegnazione al professionista giusto. Test chat aggiornati (medico→nutrizionista, emotivo→coach).

- `[Sviluppo]` **Regole motore — override per dieta letto dal motore + audit dashboard** — il motore ora legge gli **override PER DIETA** (ProductRule) per tutti i parametri numerici di scoring/macro (efficacia, gradimento, penalità varietà, tolleranza kcal, banda proteica…), non solo per gli interruttori bigiornaliera/DayCombo; globale come fallback. Test +2. Inoltre **verifica di copertura**: tutte le 28 sezioni del backoffice hanno link a menu, voce nei permessi e **modulo dashboard** — aggiunti i moduli mancanti (ricette, protocolli, regole motore, parametri, modelli/log email, grafica PDF, utenti, ruoli, log), il link ‘Import liste’ nel menu CRM e corretto il modulo ‘Lead da accettare’ sulla chiave `lead_acceptance`.

- `[Sviluppo]` **Regole del motore — pagina del capo nutrizionista + regole suggerite per nutrizione** — nuova sezione `/regole-motore` (permesso `engine_rules`, **solo head_nutritionist**; admin in lettura): ① **regole globali** — catalogo di ~20 parametri del motore, modificabili e attivi subito (config_param); ② **regole base suggerite per tipo di nutrizione** — 14 preset fondati sulla letteratura (5 stili + DASH, Mediterranea ipocalorica, Iperproteica sportiva, Vegetariana, Vegana, Pescetariana, Flexitariana, Basso IG, Digiuno intermittente 16:8) col **flag “suggerita”**, modificabili/aggiungibili e **applicabili a una dieta** (→ ProductRule); ③ **proposte** di regole nuove (testo → sviluppo). Backend: modulo `engine-rules` (catalogo in codice + service/controller/test), modello `RulePreset` + `RuleProposal.dietId` opzionale (mig `20260714270000`), seed dei 14 preset. Modulo dashboard per il capo nutrizionista. Test +7. ⚠️ Le regole **globali** numeriche sono già lette dal motore; l’override **per dieta** è persistito e attivo per gli interruttori (bigiornaliera, DayCombo) — estendere il consumo per-dieta agli altri numerici è un piccolo follow-up. Regole cliniche come cap carboidrati (g), IG, g/kg, sodio richiedono nuovi parametri: elencate nelle note dei preset e proponibili.

- `[Sviluppo]` **Motore R12 — mantenimento a efficacia ridotta (non zero)** — `menu_maintenance_w_eff` portato da 0 a **0,1** (decisione socio: in mantenimento l’efficacia pesa poco ma non è ignorata; a gradimento più alto vince il gusto). Test R12 aggiornati. ⏳ In sospeso il routing delle segnalazioni sensibili in chat (oggi tutte → nutrizionista/clinico): il socio deve confermare se i temi **emotivi** vanno alla coach (`mood_risk`) tenendo i **red-flag medici** (dolore al petto, farmaci, gravidanza) al nutrizionista.

- `[Sviluppo]` **Backoffice — lettura email leggibile** — la posta in arrivo mostra il messaggio **formattato**: se la mail ha l’HTML lo rende in una cornice isolata e sicura (sandbox, niente script, link in nuova scheda), con intestazione mittente pulita (nome + indirizzo) e finestra più larga; per le mail solo-testo, URL cliccabili e tolte le parentesi quadre del formato testo. File: `Posta.tsx`, `ui.tsx` (Modal `wide`).

- `[Sviluppo]` **CRM — codice fiscale e indirizzo su lead/cliente + arricchimento del file d'import** — aggiunti i campi `codiceFiscale` e `address` a `CrmRecord` (migrazione `20260714260000`, entrambi opzionali). Sono modificabili dalla **scheda lead** (con CF in maiuscolo automatico) e vengono letti dall'**import liste** (nuove colonne `codice_fiscale`/`address` del CSV; scritti solo se presenti → re-import idempotente, non cancella un dato già salvato). Dai 6 file clienti storici (Uniti/Dimagriamo/Nutriamo/Mosaico; Nutrilab e Attivi-2024 non contengono i dati reali) ho estratto **8.563 codici fiscali validi** e **6.503 indirizzi**, agganciati al file `Metabole_Import_Pronto_v2.csv` (86.309 righe) per telefono/email. ⚠️ Il file arricchito ha dati personali → **fuori dal repo** (consegnato in chat). Test import +2 (CF normalizzato / campi assenti non scritti); backoffice type-check 0 errori.

- `[Sviluppo]` **Motore — regola "ripetizione bigiornaliera" (`menu_repeat_two_days`, per dieta, OFF di default)** — nuova `ProductRule` che il nutrizionista può attivare su una dieta: quando è ON, il 2° giorno del ciclo ripropone **gli stessi alimenti** del 1° giorno ma con una **ricetta/preparazione diversa** scelta dal motore (la "gemella") — stesso gruppo di equivalenza approvato e kcal in banda (`repeat_twin_kcal_tolerance_pct`, default 15%); a parità sceglie la ricetta col punteggio efficacia+gradimento migliore. Se per un pasto non esiste una gemella, resta il pasto già composto (decisione socio). **Salvaguardia**: la regola è inerte finché il nutrizionista non approva i gruppi di equivalenza (senza gruppi → nessuna gemella → comportamento invariato). Nessun redeploy per accenderla (toggle per dieta). Seed: +2 config_param (`menu_repeat_two_days_default`=false, `repeat_twin_kcal_tolerance_pct`=15). Test menu +3 (OFF/ON/ON-senza-gruppi) verdi; suite menu 40/40 in sandbox (transpile-only, stub Prisma).

- `[Prodotto]` **Sito — sezione app: 4 schermate REALI dal prototipo** (`Metabole_Sito_Presentazione.html`) — sostituito il mockup CSS del telefono con **4 screenshot reali** dell'app presi dal prototipo (`marketing/vignette/app-screens/`: Home, Percorso, Obiettivi, Contatti). Le immagini hanno già la cornice device, quindi tolta la cornice CSS `.phone`; galleria swipe (frecce/puntini/caption) mantenuta. Immagini **ottimizzate e incorporate in base64** (~287 KB totali, file ~432 KB) così restano nel singolo HTML e funzionano al deploy su SiteGround senza upload separati. → da rideployare.

- `[Prodotto]` **Sito — restyling a box uniformi + ® + pulizia** (`Metabole_Sito_Presentazione.html`) — riorganizzato tutto il sito con **sistema a box annidati** e **gerarchia grafica uniforme** a 3 livelli: sezione (bianca, raggio 24), pannello/gruppo (tinta unica #F6FAF8, raggio 18, niente gradienti/ombre), card (bianche, raggio 14). Rimossi gradienti e raggi/ombre incoerenti su recall/cult/feat-art/lead-person/lead-band/app; unificate le fasce band/final solo nel raggio (testo/bg invariati). **Hero invariato.** Box numeri con sottotitolo **"L'esperienza"** (9 lingue) + i 4 dati in un box interno. Rimossa la sezione **"Un giorno con te"**. Aggiunta **® al logo MetaboleAI®** (header e footer). → da rideployare per vederlo live.

- `[Prodotto]` **Sito — galleria app sfogliabile + dicitura contatori con 3 prodotti** (`Metabole_Sito_Presentazione.html`) — (1) la sezione app ora ha una **galleria swipe** (frecce + puntini + caption, touch/scroll-snap, no immagini esterne) con **4 schermate inline**: Home (misure/proposta), Percorso (menu giorno 1 e 2 con cottura diversa), Obiettivi (progressi + cambia obiettivo), Contatti (Gaia + coach + nutrizionista). (2) Dicitura contatori aggiornata in tutte le 9 lingue con l'elenco prodotti esteso: **"tra cui Nutriamo, Dimagriamo, Nutrilab"**. → da deployare per vederle live.

- `[Sviluppo]` **Go-live: Stripe LIVE configurato, sito ripubblicato, pulizie repo** — ① Stripe in modalità live: chiave `sk_live` dedicata e destinazione evento con solo `checkout.session.completed` → `/api/v1/payments/webhook`; `STRIPE_SECRET_KEY`+`STRIPE_WEBHOOK_SECRET` aggiornati su Render, redeploy verificato (nessun prodotto/prezzo in Stripe: il checkout usa `price_data` inline col prezzo del piano dal DB). Resta il pagamento reale di prova nello smoke test. ② `index.html` ripubblicato su SiteGround 1:1 dal repo (nuova dicitura contatori + fallback; lo snippet favicon ormai è nel repo, niente più delta) e cache dinamica svuotata. ③ Pulizie: creato `app/.env.example` (VITE_API_URL), rimosso il backup `backend/prisma/schema_1.prisma`.

- `[Sviluppo]` **Contatori sito con base storica Mosaico** (`/public/stats`, commit `76c0cbf` — voce ripristinata, era andata persa in un risanamento conflitti del diario) — `publicStats()` somma la base storica ai conteggi reali: `clients = stats_clients_base (18.979) + abbonamenti attivati`, `reached = stats_reached_base (85.218) + lead CRM`, `years` da `site_stats_years` (20); parametri in config_param via seed (upsert, gira ad ogni deploy), rimossi gli override assoluti `site_stats_clients/reached`, test aggiornati. **Verificato live**: `{clients:18983, reached:85232, methods:4, years:20}`; home del sito mostra "18.983+ / 85.232+".

- `[Sviluppo]` **Liste CRM Fase B — import liste storiche + campo telefono + fix layout** — ① campo `phone` sul lead CRM (mig. `20260714250000`, + indici su phone/email) come **seconda chiave** insieme all'email. ② Import: `POST /crm/leads/import` (solo admin, a lotti, con `dryRun` per l'anteprima), match/dedup su **telefono O email** (aggiorna se già presente, mai doppioni), **crea da sé le liste mancanti**, assegna la coach se il refcode combacia. UI `/crm/import` (pulsante "Importa" in Gestione lead): carica il CSV, anteprima "creati/uniti/coach/nuove liste", import a lotti con barra. Test +2. ③ Fix layout: a barra nascosta il contenuto usa tutta la larghezza (`.app-shell.nav-closed .content`), così le tabelle larghe non restano tagliate. ④ **ETL una-tantum** (fuori dal repo, dati personali): dai 2 file del socio → `Metabole_Import_Pronto.csv` (**86.309 persone** deduplicate per telefono/email, con liste, stato precedente, `Valore`→totale pagato, coach da Referrer con refusi 01/1 e VITA01→Vita gestiti) + `Metabole_Lead_Senza_Contatto.xlsx` (8.328 senza chiave, esclusi). Type-check app+backoffice 0 errori; suite CRM 17/17.

- `[Sviluppo]` **Backoffice — permessi completi, moduli dashboard, scheda lead** — ① ogni schermata ora è
  controllata dalla tabella permessi: nuova chiave `posta` (staff di default), Dashboard senza bypass,
  Ricette/Allergeni sulla chiave `recipes`; `syncDefaults` completa anche i ruoli personalizzati (ereditano
  il default del ruolo di base per le sezioni nuove). ② Moduli dashboard per tutte le sezioni aggiunte
  (Chat, Posta, Negozio, Buoni sconto, Contabilità, Provvigioni, Prelievi, Testimonianze) con anteprime.
  ③ Nuova **scheda lead** `/crm/lead/:id` (click sul nome del lead puro in Gestione lead e Pipeline):
  anagrafica modificabile, stato, coach, promemoria, storico stati; backend `GET /crm/leads/:id` +
  `PATCH /crm/leads/:id/info`. Test aggiornati (permessi custom role, CRM updateInfo/detail).

- `[Prodotto]` **Documento "Cosa resta da fare" per Simone (PDF)** (`Metabole_Simone_Cosa_Resta.pdf`) — riepilogo completo e prioritizzato: A) gate di lancio (base contatori con snippet, Stripe LIVE + pagamento reale, email/DNS, smoke test); B) config & deploy (CORS/URL, AI key, segreti Render, FCM, Vercel/backoffice); C) pulizie (app/.env.example, rimuovere schema_1.prisma, build/test pipeline, cron); D) post-lancio (motore R8–R12 restante, email→Brevo, marketing/Giudice, blog/Publisher, app dedicate, prodotti dinamici, certificazione unicità). Con ordine consigliato e riferimenti.

- `[Prodotto]` **Estratto traduzioni sensibili RU/ZH/AR per revisore** (`marketing/Traduzioni_Revisione_RU_ZH_AR.md`) — 18 stringhe chiave del sito (claim hero, concept "non una dieta", banda, multiculturalità, CTA, coach/supervisione, testimonianze, form + **consenso privacy**) affiancate IT↔RU, IT↔ZH, IT↔AR, con colonna "Correzione". Nota: pagine legali (privacy/cookie/termini) da rivedere a parte nei loro file. Pronto da mandare a un madrelingua per lingua; manca solo il revisore.

- `[Prodotto]` **Marketing — catalogo email al 100%** (`marketing/Metabole_Email_Ciclo_Vita.md` Parti 6–7 + tracker) — scritte anche le ultime email (obiezione prezzo, valore settimanale, upsell, win-back survey/stagionale, transazionali: verifica/reset/ricevuta/rinnovo/**dunning**/appuntamento, consensi: re-permission/preferenze). Tracker `Elenco_Email_Automatiche.md`: **48 email tutte 🟢** (copy pronta), zero residui. Prossimo passo (Sviluppo): traduzione nelle lingue dell'app + template Brevo agganciati ai trigger.

- `[Prodotto]` **Marketing — completata la copy delle email in bozza** (`marketing/Metabole_Email_Ciclo_Vita.md` Parte 5) — scritte le email che restavano 🟡: conversione (profilo incompleto, **nurture 1–4**), retention (**onboarding G1/G2/G4/G7**, feedback ricette, riattivazione dropout, referral), **win-back T+3/T+7**. Tracker `email_automatiche/Elenco_Email_Automatiche.md` aggiornato: tutte 🟢 tranne le ⚪ (obiezione prezzo, valore settimanale, upsell, win-back survey/stagionale, transazionali/dunning, consensi). Prossimo passo: traduzione + template Brevo con i trigger.

- `[Prodotto]` **Piano Prodotto pre-lancio + primi materiali** — `progetto/Piano_Prodotto_PreLancio.md` (task nostri: team, testimonianze, revisione traduzioni, email, smoke test). Preparati: `marketing/Modulo_Testimonianze_Consenso.md` (raccolta + liberatoria GDPR + linee guida + tracce domanda) e `progetto/Template_Pagina_Team.md` (schede ruolo/CV + specifiche foto). **Rimosso ogni riferimento alle "grammature"** (non esistono nel nostro prodotto: si lavora per piatto e calorie) da Piano, STATO_LANCIO e checklist go-live.

- `[Prodotto]` **Pagina unica STATO LANCIO** (`progetto/STATO_LANCIO.md`) — one-pager sempre aggiornato con "cosa manca per aprire": semaforo, ✅ già fatto (verificato live), 🔴 4 gate (base contatori, Stripe LIVE + pagamento reale, email/DNS, smoke test), 🟠 consigliati (backoffice, FCM, pulizie), 🔵 contenuti [Pr], ⚪ dopo il lancio. Da tenere come riferimento quando si chiede lo stato.

- `[Prodotto]` **Sito — contatori: base storica Mosaico + nuova dicitura (9 lingue)** (`Metabole_Sito_Presentazione.html`) — i contatori partono dai numeri storici di **Mosaico Experiences SA**: **persone raggiunte da 85.218**, **clienti seguiti da 18.979** (default HTML + `STATS`). Nuova **dicitura** sotto i contatori (versione "sobria e chiara", tradotta in tutte le 9 lingue): *"L'esperienza è quella del nostro team. I clienti seguiti e le persone raggiunte sono i numeri che Mosaico Experiences SA ha maturato in 5 anni con diversi prodotti dedicati alla nutrizione."* → **impatto [Sviluppo]:** i numeri vivono nel DB e l'endpoint `/public/stats` sovrascrive i default (oggi mostra ~12/13 perché la base è ~0). Impostare la **base** nel backend/`config_param` così che `reached = 85218 + n° lead` e `clients = 18979 + n° acquisti` (offset di partenza), lasciando l'incremento +1 per lead / +1 per acquisto.

- `[Sviluppo]` **Generazione automatica dei codici col metodo aziendale** — nuovo modulo
  `common/ref-code.ts`: ogni codice generato in automatico segue la regola **5 lettere cognome +
  iniziale nome + progressivo da 01** (es. VOLPEA01). Vale per il ref code coach (admin e "il mio
  invito") e per il codice cliente "porta un'amica" (dal nome della cliente); casuale solo se il
  nome manca. Con la stessa forma nei due spazi, l'**unicità è verificata incrociata** (staff.refCode
  + clientProfile.referralCode), anche per i codici impostati a mano dall'admin. Inserimento
  case-insensitive (già garantito). +6 unit test (lead-assignment e referral).

- `[Prodotto]` **Go-live — verifica LIVE + checklist ridotta** (`Metabole_Checklist_GoLive.md`) — controllo dal vivo: backend up (`/health`, `/plans` = 3 piani reali €297/€497/€797 → DB Neon prod seedato), `/payment-methods` carta+bonifico (Stripe collegato), **app cliente live** su app.metabole.eu, sito live, endpoint lead attivo, utenze staff reali create. Infrastruttura **in piedi**. Restano solo **conferme** (Stripe in modalità LIVE + webhook, deliverability email Brevo/DNS, backoffice raggiungibile, FCM) + **smoke test con pagamento reale** + **contenuti** (team, grammature Keto, traduzioni, testimonianze). Checklist riscritta con spuntato ciò che è live e ridotta ai punti rimasti.

- `[Prodotto]` **Marketing — area "Email automatiche" con elenco-tracker** (`marketing/email_automatiche/Elenco_Email_Automatiche.md`) — nuovo registro di lavoro delle email automatiche in preparazione, con campi **evento (trigger), oggetto, testo (sintesi), segmento, timing, stato** (⚪ da progettare / 🟡 bozza / 🟢 copy pronta / 🔵 da tradurre / ⬛ template Brevo / ✅ live). Raggruppate in 8 aree: attivazione, conversione, retention, **email per evento** (peso obiettivo, morale, plateau, ricorrenze…), rinnovo, win-back, servizio/transazionali, consensi. Rimanda alla copy completa in `Metabole_Email_Ciclo_Vita.md` e alle campagne massive.

- `[Prodotto]` **Marketing — Email per ciclo di vita (per stato utente)** (`marketing/Metabole_Email_Ciclo_Vita.md`) — set completo di email triggered mappate a stati CRM e agente. Le 3 richieste con **copy pronta** (Benvenuto; "Il tuo profilo è pronto" con riepilogo questionario + piano + nutrizionista + coach; "Il tuo piano inizia domani + lista della spesa") + proposta di tutto il resto da agente di marketing: conversione (profilo incompleto, **checkout abbandonato** 3 email, nurture chi non sceglie il piano, obiezione prezzo), retention (onboarding 1–7, milestone, feedback ricette, contenuti valore, **riattivazione dropout_risk**, supporto stato Conforto, **referral**), **rinnovo** in scadenza (T-7/T-3/T-1 + upsell), **win-back** scaduti (grace, novità, survey uscita, stagionale), transazionali/dunning, consensi/preferenze. Con merge tag Brevo, trigger, priorità, A/B, metriche e passaggio dal Giudice. Da tradurre + costruire template Brevo. Nessun invio senza consenso. **Aggiunta copy completa** delle email ad alto impatto (checkout abbandonato A2.1–A2.3, rinnovo C1–C3) e una **Parte 4 — Email per EVENTO** (EV1 obiettivo di peso raggiunto, primo risultato, traguardo intermedio, costanza, **plateau**, **giornata storta/morale**, misure mancanti, rientro, compleanno, anniversario, pre-evento agenda, passaggio a mantenimento) con regole di frequenza e benessere.

- `[Sviluppo]` **Create le 14 utenze staff reali in produzione** — via `POST /admin/users` (admin
  `admin@metabole.eu`, password recuperata col flusso di reset): Giusy (`sales` = Responsabile
  Coach), Antonio Nocera (`head_marketing`) e 12 coach (`coach`), email `nome@metabole.eu`, password
  provvisoria con **obbligo di cambio al primo accesso**, le 12 coach con **manager = Giusy** e **ref
  code personalizzato** (regola: 5 lettere cognome + iniziale nome + 01; inserimento case-insensitive,
  già garantito da `resolveByRefCode`). Verifica live: lista utenti completa, login di prova con flag
  `mustChangePassword=true`. Credenziali provviste fuori repo (repo pubblico).

- `[Prodotto]` **Checklist go-live aggiornata + Runbook operativo PDF** — `Metabole_Checklist_GoLive.md` rivista sullo stato reale: i **3 blocker di codice sono CHIUSI** (endpoint pubblico lead, form sito collegati, scoping per-paziente). Restano solo configurazione (Neon, segreti, Stripe LIVE, Brevo+DNS, CORS, FCM), deploy dei due front-end su Vercel e smoke test. Nuovo `Metabole_Runbook_GoLive.pdf` con l'**ordine esatto 1→9** dei passi (per Simone/Ops) + pulizie [Sv] (`app/.env.example`, rimuovere `schema_1.prisma`, build/test in pipeline) e contenuti [Pr]. Nessun nuovo sviluppo per aprire; chiavi solo nei pannelli, mai nel repo.

- `[Prodotto]` **E1 Agente Esclusioni (R8) — decisioni per Simone** (`Metabole_E1_Agente_Esclusioni_Decisioni.md`) — sciolte Q1/Q2 bloccanti e confermate le proposte di default: **Q1** tag allergeni normalizzati (14 UE) taggati dal nutrizionista, con **pre-tag assistito** da confermare + gate "prodotto non attivabile finché ricette non taggate e gruppi approvati"; **Q2** derivati via tag (un tag = alimento + derivati), tracce rimandate; **Q3** filtro ricette (no generazione automatica); **Q4** base personale = `recipeIds` sicuri; **Q5** veg/vegano ora, religione dopo; **Q6** blocca+escala se un solo **slot principale** scoperto (spuntini/merende non bloccano) + testo messaggio cliente; **Q7** run a fine onboarding + su update profilo + pulsante "rigenera base" + flag rigenerazione su nuova versione base; **Q8** ≥3 opzioni per slot principale in `config_param` (soglia separata per spuntini/merende). Via libera a E1.

- `[Sviluppo]` **Obbligo cambio password al primo accesso + ruolo `sales` → "Responsabile Coach"** — nuovo
  campo `must_change_password` su `user` (migrazione `20260714120000_must_change_password`, validata su
  PG16, default false); `POST /admin/users` accetta `mustChangePassword`, il flag è esposto in `/me`,
  nella lista utenti admin e nella risposta di login; `PATCH /me/password` lo azzera al primo cambio
  riuscito. **Backoffice**: nuova schermata bloccante `CambioPasswordObbligatorio` (gate in `Protected`)
  — finché la password provvisoria non viene cambiata nessuna pagina è raggiungibile; build Vite ok.
  Etichetta del ruolo `sales` unificata a **"Responsabile Coach"** in backend e backoffice (era
  "Commerciale"/"Resp. Coach Team": la voce "commerciale" nella tabella ruoli era un refuso storico).
  +2 unit test su UsersService. Scopo: onboarding delle utenze staff reali (team coach + responsabili)
  con password provvisoria consegnata a voce e cambio obbligatorio.

- `[Sviluppo]` **Sito di presentazione LIVE su metabole.eu + favicon Gaia** — pubblicato su SiteGround
  (`public_html`) il sito v4 completo: home + Blog/Lavora/Privacy/Cookie/Termini; WordPress preinstallato
  accantonato senza cancellarlo (`DirectoryIndex index.html index.php` in `.htaccess`). Collaudo go-live da
  `Istruzioni_Claude_Sito_Metabole.md`: endpoint pubblici 200 con CORS ok da metabole.eu e www, sezioni
  dinamiche popolate (stats/percorsi/testimonianze), form lead → CRM verificato (lead di prova "Test GoLive
  Claude" da cancellare), honeypot che scarta. Aggiunta **favicon Gaia** (`favicon.svg` dalla mascotte
  `#gaiaMascot` + PNG 32px inline) su tutte le pagine. → nota: dopo ogni modifica ai file del sito nel repo,
  ricopiare su SiteGround e svuotare la Cache Dinamica.


- `[Prodotto]` **Risposta al piano R8–R12 di Simone — decisioni per sbloccare l'agente** (`Metabole_Motore_R8_R12_Decisioni.md`) — verificata e confermata la mappatura di Simone sullo schema reale (CycleFeedback/RecipeRating/MenuWeight/EngineDecision/Protocol/Escalation/ProductRule ci sono; ClientProfile senza `allergies`; mancano EquivalenceGroup/ClientCycle/ClientMenuPool). Decise le 5 domande aperte: **D1** Agente (B) genera i menu, motore a protocolli (A) resta guardrail di sicurezza (non si fondono); **D2** gruppi di equivalenza = **modello dedicato** `EquivalenceGroup` del nutrizionista (seed dai 23 gruppi di regola4), non tag; **D3** unicità = seme+collision check+`PersonalizationCertificate` (HMAC/hash-chain) per l'MVP, PKI/auditor esterno rimandato (claim marketing → Antonio); **D4** stati contestuali sul `ClientCycle`, soglie in config_param, guardrail conforto→mood_risk; **D5** aggiungere `ClientProfile.allergies String[]` + domanda onboarding separata. Approvato il piano a fasi E0→E5 e le migrazioni additive sicure (allergies + scheletro modelli). Priorità: prima i blocker go-live.

- `[Prodotto/Sviluppo]` **Keto inserito nel motore + PDF Metodo/Audit + 12 regole nel wizard "Costruisci nuovo percorso"** — (1) **Motore**: base Keto approvata caricata come catalogo **isolato** del prodotto Keto — `backend/prisma/data/keto_catalog.json` (**118 ricette** per pasto con kcal, metodi di cottura, tag keto/veg; **8 giornate bilanciate** ~1450 kcal) + `backend/prisma/seed_keto.ts` (idempotente, crea Recipe + Diet `style:keto` con dayTemplates, isolato per prodotto) agganciato in `seed.ts` (`seedKetoCatalog`). (2) **PDF**: `Metabole_Metodo_Motore_Intelligente.pdf` (Fase A R1–R7 + Fase B R8–R12, mappa "dove agisce l'agente") e `Metabole_Audit_Personalizzazione.pdf` (verifica: ogni menu personalizzato e muta sui bisogni; parità Keto↔Mediterranea; rischi/presidi). (3) **Wizard** `Metabole_Wizard_Crea_Prodotto.html`: nuovo pannello con le **12 regole** in 2 fasi, R8+ marcate come **agente AI**, titolo "Costruisci nuovo percorso · nutrizionista/admin". → impatto [Sviluppo]: rivedere `seed_keto.ts` (grammature reali le fissa il nutrizionista); il seed è idempotente e non tocca cataloghi già popolati.

- `[Prodotto]` **METODO DEL MOTORE INTELLIGENTE — regole canoniche unificate (Keto + Mediterranea) per ogni percorso** (`percorsi/METODO_MOTORE_INTELLIGENTE.md`) — allineate le due serie di regole prendendo da ciascuna ciò che mancava. Stabilite **12 regole in 2 fasi**: **Fase A costruzione base (R1–R7)** = nutrizionista+strumenti (raccolta, catalogo per pasto [×stagione opz.], calorie interne, gruppi equivalenza, cotture, **bilanciamento giornata + porzioni standard/no-fame**, approvazione+isolamento per prodotto); **Fase B motore intelligente (R8–R12)** = **dove interviene l'AGENTE AI, unico per percorso** (R8 esclusioni con **blocca+escala** se non sostituibile; R9 partenza differenziata + **unicità certificata** seme/collision/registro firmato; R10 ciclo bigiornaliero + monitoraggio con **misure obblig., peso vs cm separati, seguito sì/no, gradimento default 5★ = max stelle**; R11 adattamento scoring efficacia×gradimento + **apprendimento che isola il pasto** + **stati** Conforto→Rientro/Pre-Post-evento/Plateau; R12 obiettivo dimagrimento/mantenimento + matrice segnalazioni + RBAC/kcal nascoste/cifratura/config_param). Mappa "dove agisce l'agente". **Audit unicità confermato e rafforzato**: ogni menu resta personalizzato e muta sui bisogni del cliente (parità piena Keto↔Mediterranea). Stato: da validare nutrizionista, no deploy. → impatto [Sviluppo]: standard del motore per ogni nuovo percorso, R8–R12 come componenti riusabili parametrizzati per product_id.

- `[Prodotto]` **Percorso KETO — Regola 10: menu di partenza differenziati per cliente** (`percorsi/keto/regola10_menu_partenza_differenziati.md`) — i menu di partenza sono **diversi per ogni cliente** anche a **pari percorso** e **stessa data d'inizio**: due clienti = due menu di partenza. Meccanismo: **seme personale** derivato da `client_id` che ordina/ruota in modo deterministico ma unico la sequenza pescata dalla **base personalizzata** (R7) → primo menu e ordine diversi per ciascuno. Restano garantiti keto, kcal target, ciclo bigiornaliero con 2 cotture (R6+R8); da lì prosegue l'adattamento (R9). Sequenza di partenza salvata nello storico personale. Stato: 🟡 da validare, no deploy. → impatto [Sviluppo]: generare sequenza di partenza personale (ordinamento con seme da client_id) sulla base personalizzata, salvarla, l'Agente Adattamento prosegue da lì.

- `[Prodotto]` **Percorso KETO — Regola 9: Agente Adattamento (scelta menu successivo + apprendimento personale)** (`percorsi/keto/regola9_agente_adattamento.md`) — l'agente legge la tabella personale (esito misure + gradimento) e decide il menu del ciclo dopo: 📈 **preso peso** → ripropone il **menu che ha fatto perdere di più** al cliente (dal **ranking personale** per Δ peso; a parità, gradimento più alto); ➖ **invariato** / 📉 **sceso** → **nuovo menu** dalla base personalizzata (non recente, gradimento alto, cotture preferite). Logica exploit(sale)/explore(fermo o scende). Mantiene un **ranking menu per client_id** (Δ peso + ★) aggiornato ogni ciclo e registra decisione/motivo/esito nello **storico personale** cifrato. Limiti: aumenti ripetuti/plateau/cali anomali → **escalation nutrizionista**; l'agente non inventa menu né cambia kcal/grammature da solo. Stato: 🟡 da validare, no deploy. → impatto [Sviluppo]: Agente Adattamento con regola di decisione, ranking menu personale, storico cifrato, escalation.

- `[Prodotto]` **Percorso KETO — Regola 8: Agente Monitoraggio (ciclo bigiornaliero)** (`percorsi/keto/regola8_agente_monitoraggio.md`) — man mano che il cliente prova i menu, l'agente registra nella **tabella personale**: **misure obbligatorie** (peso/cm → esito 📉 sceso / ➖ invariato / 📈 salito) e **gradimento piatti opzionale** (se assente → **default 5★**). Unità = **ciclo di 2 giorni** (i menu sono ogni 2 giorni): nei due giorni **stesso menu** con **due metodi di cottura diversi** (Regola 6, kcal invariate). Definiti schema tabella personale (ciclo, menu, cottura g1/g2, Δpeso, Δcm, esito, ★), regole ferme (misure chiudono il ciclo; gradimento mai penalizzante; l'agente solo registra, non adatta ancora), dati sanitari cifrati (accesso cliente+nutrizionista). È la materia prima per la personalizzazione dinamica successiva. Stato: 🟡 da validare, no deploy. → impatto [Sviluppo]: Agente Monitoraggio con ciclo bigiornaliero, schermata misure obbligatoria + gradimento opzionale (default 5★), tabella personale cifrata per client_id, abbinamento menu↔2 cotture.

- `[Prodotto]` **Percorso KETO — Regola 7: Agente Esclusioni → base personalizzata (prima personalizzazione vera)** (`percorsi/keto/regola7_agente_esclusioni.md`) — come per la Mediterranea, un **agente AI** parte dalla copia della base approvata e **rimuove/sostituisce** ciò che il cliente non può/non vuole: **allergie** (blocco duro, incl. tracce/derivati), **intolleranze** (sostituzione con alternativa tollerata), **non graditi** (preferita sostituzione via gruppi di equivalenza Reg.4), **cultura/fede + veg/vegano**. Principio: prima sostituire (varietà), poi rimuovere; sempre **dentro la keto e a pari kcal**. Output = **base personalizzata** del cliente (isolata per `client_id`), punto di partenza delle regole successive. Casi limite (categoria svuotata, allergie gravi, veg+allergie) → **escalation al nutrizionista**, l'agente non inventa. Audit delle esclusioni. Stato: 🟡 da validare, no deploy. → impatto [Sviluppo]: implementare l'Agente Esclusioni (filtra per tag alimento/allergene + gruppi equivalenza), output base personalizzata isolata, log, escalation sotto soglia.

- `[Prodotto]` **Percorso KETO — Regola 6: metodi di cottura → nuovi pasti** (`percorsi/keto/regola6_metodi_cottura.md`) — 1ª regola di personalizzazione: per ogni cibo **3–5 metodi di cottura** (forno, griglia/piastra, cartoccio, umido, vapore, padella, bassa temperatura, crudo/marinato…) che **conservano le kcal del piatto** (a parità di porzione e grasso aggiunto). Matrice metodi per gruppo (pesci grassi/bianchi, crostacei, pollame, carne rossa, uova, tofu, verdure, formaggi) + esempi generati (salmone CE08 ×5, pollo PR01 ×5, bistecca CE10 ×5, branzino PR03 ×5, uova COL02 ×5, gamberi CE13 ×4, tofu CE02 ×4). Regola calorica: **frittura/impanatura escluse** (aggiungono olio → piatto diverso). Effetto: *ingrediente × metodo* moltiplica il catalogo restando keto. Nella base personale il cliente sceglie il **metodo preferito / a rotazione**, senza ricalcolo. Stato: 🟡 da validare nutrizionista, no deploy. → impatto [Sviluppo]: attributo **metodo di cottura** sul modello piatto (varianti a stessa kcal) + filtro preferenza in personalizzazione.

- `[Prodotto]` **Percorso KETO — base APPROVATA dal nutrizionista → si apre la fase "personalizzazione"** — la base Keto (`base_keto_da_approvare.md`) è 🟢 **approvata**: da ora è **immutabile e condivisa** (ogni modifica futura ripassa dal nutrizionista con versione). Nuovo `percorsi/keto/personalizzazione_cliente.md`: cambia la natura delle regole — **fino a qui costruivano la base, d'ora in poi costruiscono la personalizzazione di ogni cliente**. Principio fissato: ogni cliente Keto riceve una **BASE PERSONALE = copia della base approvata**; le regole successive lavorano **solo su quella copia**, senza toccare la base ufficiale né mischiarsi con altri clienti/percorsi. Lo scaffold contiene lo schema (approvata→clona→personale→regole→menu), le dimensioni personalizzabili (grammature/fabbisogno, esclusioni allergie-intolleranze-non graditi, gusti/veg/fede, n° pasti, obiettivo, stato/gradimento) come placeholder, e una **tabella-registro** delle regole di personalizzazione. Stato: pronto a ricevere la 1ª regola, no deploy. → impatto [Sviluppo]: alla scelta "Keto", clonare la base approvata in una base personale del cliente; le regole seguenti operano solo su quella copia.

- `[Prodotto]` **Percorso KETO — base costruita col metodo validato (regole 1–5)** — cartella `percorsi/keto/`: (1) `raccolta_menu_web.md` raccolta menu keto da 5 fonti (~31 giornate/~130 pasti); (2) `catalogo_pasti.md` **118 piatti** deduplicati e **divisi per pasto** (colazioni/pranzi/cene/spuntini/merende); (3) `catalogo_pasti_calorie.md` stessi piatti **con kcal** (senza grammature); (4) `regola4_sostituzioni.md` **23 gruppi di equivalenza** (i 12 del nutrizionista + altri: pesci bianchi, crostacei, salumi, proteine veg, crucifere, basi finto-carbo, frutti keto, dolcificanti…) + ~32 varianti a calorie invariate + "Settimana B"; (5) `base_keto_da_approvare.md` **base isolata (solo Keto)** con workflow di **approvazione del nutrizionista** per categoria (sign-off) → dopo l'ok diventa il **pool per ogni cliente Keto**, mai mischiato con altri percorsi. Metodo riusabile identico per gli altri percorsi (Proteica, Low-carb, gravidanza, menopausa, sportivo, pre-matrimonio…), ciascuno con base separata. Stato: 🟡 in revisione nutrizionista, no deploy. → impatto [Sviluppo]: agganciare il pool al prodotto Keto (isolato); motore compone i giorni del cliente solo da qui + sostituzioni/esclusioni; versioning con approvazione.

- `[Prodotto]` **Marketing — archivio vignette catalogato per l'agente Publisher** — tutte le creative raccolte in **`marketing/vignette/`** con **catalogo machine-readable** `catalogo_vignette.json` (schema `metabole.vignette.catalog/v1`): 8 collezioni (persona: maria/menopausa/post-gravidanza/rientro/giornata storta; punti di forza: persone vere+AI, su misura; app: schermate reali) = **32 varianti/asset**, ognuna con messaggio, caption, hashtag, canale, stato, fonte (Canva `design_id`+preview o PNG) e **compliance/gate Giudice**; 6 voci `in_coda`. Più `README.md` (come lo usa il Publisher), `catalogo_canva.md`, le 3 gallerie HTML e `app-screens/` (5 screenshot reali). → impatto [Sviluppo]: il **Publisher** legge il catalogo, esporta il PNG dal design_id (o usa il PNG), passa dal Giudice, pubblica via API e logga. → in coda: gusto senza fame, sicurezza clinica, trasparenza, gravidanza pre/post, sposa.

- `[Prodotto]` **Marketing — vignette con schermate REALI dell'app** — catturate dal **prototipo ufficiale** via **Chromium headless** nel sandbox (aggirato il blocco `libXdamage` con uno **stub compilato**, asset via proxy allowlisted, navigazione simulata nel flow → app, popup chiusi). 5 screenshot reali in `marketing/app-screens/` (contatti, home, obiettivi, percorso, agenda). La **Contatti** mostra Gaia (assistente AI) + coach (Sara C.) + nutrizionista (Dott.ssa Marini), tutti LIVE. Nuova galleria `../Metabole_Vignette_App_Reali.html` (sostituisce la mockup ricostruita): 4 vignette 1080×1350 con le schermate vere + messaggi. Nota: alcune icone barre/foto CDN non caricate nel rendering headless (perfette in produzione o via Chrome connesso).

- `[Prodotto]` **Marketing — vignette punti di forza (Canva) + vignette app mockup** — sui **punti di forza** generate e archiviate **8 vignette** Canva: *Persone vere + AI* (4) e *Davvero su misura* (4), nella cartella `FAHPU5TzSCs` e nell'indice `../Metabole_Vignette_Archivio.md`. In coda (quota Canva giornaliera raggiunta): gusto senza fame, sicurezza clinica, trasparenza + temi gravidanza pre/post e sposa. Per le **schermate app** (Canva non riproduce la nostra UI/Gaia) creata composizione nostra `../Metabole_Vignette_App_Mockup.html`: 3 vignette 1080×1350 con telefono + schermata reale (Chi ti segue: Coach/Nutrizionista/Gaia; chat; menu "AI propone → nutrizionista valida") e **mascotte Gaia ufficiale**; avatar coach/nutrizionista stock da sostituire con volti reali.

- `[Prodotto]` **Marketing — vignette AI (Canva) persona-target + archivio** — svolta creativa: da concept astratti a **storie vere in prima persona per persona-target** (foto calde, dignità, no pressione estetica). Generati con **Canva** (connettore) 19 design Instagram: **Maria/matrimonio figlia** (3 approvati), **menopausa**, **post-gravidanza**, **rientro vacanze**, **giornata storta** (4 varianti l'una). Tutti esportati in PNG e archiviati nella **cartella Canva** `https://www.canva.com/folder/FAHPU5TzSCs`. Indice riusabile in `../Metabole_Vignette_Archivio.md` (messaggi, caption, hashtag, link modifica/anteprima per riesportare). Compliance: prima persona per occasione/emozione (non "entra nel vestito"), 18+, dal Giudice. → nota: Gaia non la disegna Canva (mascotte inventata) → si aggiunge come asset reale o si compone a parte.

- `[Prodotto]` **Marketing — vignette "grafica reale" (foto + tipografia)** — nuova versione `../Metabole_Vignette_Social_Foto.html`: 10 card 1080×1080 con **foto vere** (Unsplash, sostituibili con scatti nostri) + overlay/tipografia brand, per i post del Lotto 1; testimonianza come quote card (nessun volto reale senza consenso), conformi (no prima/dopo, no numeri, 18+). Affianca la versione illustrata SVG. → Nota: per illustrazioni AI su misura serve un connettore image-generation (da valutare).

- `[Prodotto]` **Marketing — vignette social (Lotto 1) + strategia rientro/nurture** — nuova galleria `../Metabole_Vignette_Social.html`: **12 vignette SVG** (1080×1080, palette brand, mascotte Gaia) dai 10 post del Lotto 1 (cassetto diete ×2, quote "Non una dieta" ×2, caroselli fame/porzioni, reel dietro-le-quinte/assaggio, giornata storta, menopausa, mangi fuori, testimonianza) con caption+hashtag pronti; conformi (no prima/dopo, no numeri, 18+), firme generiche "responsabile scientifico" (no nome Russolillo, come deciso). SVG validati. Nuovo doc `../Metabole_Strategia_Rientro_Nurture.md`: strategia **win-back 20.000 clienti** + **nurture 80.000 lead** — base giuridica LPD/GDPR (re-permission lead, soft opt-in clienti, SPF/DKIM), segmentazione, offerta, canali (email Brevo/SMS/retargeting social con le vignette/WhatsApp), **sequenze A (rientro) e B (nurture)**, aggancio agli stati CRM/agente, KPI, ordine operativo. → impatto [Sviluppo]/[Marketing]: sequenze email in Brevo agganciate agli stati; igiene liste/consensi.

- `[Prodotto]` **Go-live — smoke test (script + piano) + sonda live** — nuovo `scripts/metabole_smoke.sh` (health/plans/products/payment-methods/POST public-leads/endpoint protetto) e `../Metabole_Smoke_Test.md` (piano manuale B1–B7: account+email, onboarding, pagamento Stripe, motore menu, backoffice, sito, sicurezza). **Sonda live 14/7**: backend **up** (`/health` ok, DB up, v0.1.0), `/plans` 3 piani reali, `/payment-methods` card+bonifico ok; `POST /public/leads` non ancora attivo (blocker #1, in carico a Simone). Verifica dei 2 blocker di codice (endpoint lead + fix sicurezza scoping) pianificata via task per il 15/7.

- `[Prodotto]` **Go-live rosso #1 — lead-capture (form sito in sicurezza + handoff endpoint)** — i form `leadForm` (sito) e `jobForm` (Lavora) ora mostrano "Grazie" **solo su risposta 2xx reale**; aggiunti **honeypot** antispam, **messaggio d'errore con fallback `info@metabole.eu`** (tradotto in 9 lingue) così **nessun lead va perso**, e `data-endpoint` collegato a `/api/v1/public/leads`. Nuovo **handoff [Sviluppo]** `../Metabole_Lead_Endpoint_Handoff.md` con **codice pronto**: `PublicLeadDto`, `CrmService.createPublic()` (riusa `CrmRecord`, metadati in `stageDates` → **nessuna migrazione**), `PublicLeadController` (`@Public` + `@Throttle` 5/min + honeypot), registrazione nel `CommerceModule`, note **CORS** (aggiungere dominio sito) e captcha Turnstile opzionale. → **impatto [Sviluppo]:** applicare l'endpoint (2 file nuovi + 1 metodo + 1 riga modulo) e aggiungere l'origine sito a `CORS_ORIGINS`.

- `[Prodotto]` **Verifica pronto-al-lancio + checklist go-live** — revisione dell'intero repo (backend/app/backoffice/sito/legali/deploy). Esito: codice molto avanzato; **blocker** = (1) endpoint pubblico "crea lead" + collegare i form del sito (oggi lead/candidature persi), (2) fix sicurezza scoping `/engine/decisions/:id/confirm|correct` per-paziente, (3) config prod (Stripe LIVE+webhook, Neon URL, Brevo+SPF/DKIM, FCM push, ADMIN/CORS/VITE_API_URL). Nuovo file **`../Metabole_Checklist_GoLive.md`** (spuntabile, con responsabili [Sv]/[Pr]/[Ops]): blocker, config, smoke test, contenuti, e "subito dopo" (endpoint dinamici sito, app coach/nutrizionista dedicate, marketing/Giudice, agenti, blog, social, prodotti dinamici, stagionali, certificazione unicità). → impatto [Sviluppo]: chiudere i blocker prima del go-live.

- `[Prodotto]` **Marketing — testimonianze sul sito + pubblicazione social (spec)** — la sezione **Storie** del sito ora è **dinamica** (`data-testimonials-endpoint`, con fallback alle 3 storie statiche): ogni testimonianza **approvata** nel marketing **compare automaticamente sul sito** oltre a essere usata nei contenuti. Nuovo doc `../Metabole_Testimonianze_Social_Publishing.md`: entità **`Testimonial`** + flusso (raccolta → **Giudice**/consenso → approvazione responsabile marketing → pubblica su sito + marketing); e **Publisher via API** per i social — **Facebook Pagina + Instagram** (Meta Graph / Instagram Content Publishing API: account Business, Pagina collegata, IG professionale, app Meta, permessi `instagram_content_publish`, **App Review** 2–4 sett., pubblicazione in 2 passi), **TikTok** (Content Posting API: App Review, upload a chunk, token 24h, limiti/giorno, no scheduling nativo), + canali **consigliati** (LinkedIn, YouTube, Threads, Pinterest, Google Business, WhatsApp/Telegram). Entità `SocialAccount`/`SocialPost`, adapter per canale, guardrail (Giudice, rate limit, token refresh, audit, segreti su Render). → **impatto [Sviluppo]:** entità Testimonial + endpoint (sito già pronto), Publisher + adapter social, gestione OAuth/token. NB: collegare account e App Review sono **azioni dell'utente/business** (l'AI non fa login/OAuth).

## 2026-07-13


- `[Prodotto]` **Pagine legali multilingua (nota IT vincolante) — complete** — **Cookie**, **Termini** e **Privacy** tradotti **completi in tutte e 9 le lingue** (IT/EN/ES/PT/FR/DE/RU/ZH/AR) con selettore lingua, RTL per l'arabo e nota "traduzione di cortesia, **versione italiana legalmente vincolante**". Privacy verificata: 83 chiavi × 9 lingue tutte presenti. Autorità di controllo localizzata per lingua (IFPDT/FDPIC/EDÖB/PFPDT…), basi legali LPD/nLPD + GDPR. Tutte con hook `data-i18n-endpoint` (traduzioni anche dal DB).

- `[Prodotto]` **Sito — Blog nel menu, box "metodi gestiti", pagine tradotte, spec agenti** — header: aggiunti **Blog** e **Percorsi/Lavora** nel menu in alto; nuovo **4° contatore "metodi gestiti"** nella banda statistiche (dinamico, = n° percorsi, da `data-stats-endpoint`/`data-paths-endpoint`). **Pagine tradotte nelle 9 lingue** con selettore + hook DB: **Blog** (27 chiavi) e **Lavora** (45, incluse opzioni form e placeholder) complete; **Cookie** tradotto con **nota "versione italiana vincolante"** (traduzione di cortesia). → **restano da tradurre Termini e Privacy** (stesso schema + nota IT vincolante). Nuovo doc **`../Metabole_Agenti_AI_Spec_Sviluppo.md`** per lo Sviluppo: entità `Agent`/`AgentRun`/`AgentLog`, orchestrazione, endpoint `/agents`, mapping motore Claude, budget/guardrail, integrazione Giudice/RBAC, seed dei 13 agenti. → impatto [Sviluppo]: implementare pagina backoffice Agenti + runtime; traduzioni/contatori dal DB.

- `[Prodotto]` **Dashboard — nuova sezione "Agenti" (tutti Claude)** — deciso: **standard su agenti Claude** (niente mix di fornitori). Prototipo `../Metabole_Dashboard_Agenti.html`: sezione dashboard che mostra **ogni agente** con **nome · dove lavora · cosa fa · regola · motore** (Haiku 4.5 / Sonnet 5 / Opus 4.8; ElevenLabs per la voce; motore dieta deterministico). 13 agenti su 5 reparti (App/Marketing/Comunicazione/CRM/Sistema), filtro per reparto, e **form "Nuovo agente"** (nome, tipo, dove applicarlo, motore, cosa fa, regola) che aggiunge una card. Mappatura motore→compito valutata per criticità/volume. → **impatto [Sviluppo]:** pagina backoffice `Agenti` + entità `Agent` (name, dept, type, engine, task, rule, enabled) + registrazione/instradamento reale degli agenti; il motore LLM diventa Claude.

- `[Prodotto]` **Sito v4 + Comunicazione/blog + analisi costi agenti** — sito: **mascotte Gaia vera** (SVG dal widget, occhi che sbattono) nell'orbita e nel telefono; **badge App Store + Google Play**; **icona Kosher** sostituita (stella di Davide SVG, mancava in Tabler); **blog** e **lavora con noi** ora **pagine dedicate**, in home solo **articolo in evidenza** e **richiamo**; nuovo box **"Percorsi alimentari"** con i percorsi dell'app (Mediterranea/Proteica/Low-carb/Keto), caricabile da endpoint; **contatori dinamici**: "persone raggiunte" +1 a ogni **lead**, "clienti" +1 a ogni **acquisto piano** (letti dal DB via `data-stats-endpoint`, +1 ottimistico sul form). Nuovo doc **`../Metabole_Comunicazione_Blog_Agente.md`**: sotto-reparto **Comunicazione** nel Marketing con **agente Redattore** (RAG su fonti nutrizione → bozza → **Giudice** → **approvazione responsabile marketing** → **1 articolo/giorno** pubblicato sul blog; entità `Article`, endpoint, cron, escalation claim salute al nutrizionista capo). Nuovo doc **`../Metabole_Agenti_AI_Motori_Costi.md`**: inventario agenti (LLM specializzati con umano-nel-ciclo), motore consigliato (Haiku 4.5 default / Sonnet 5 / Opus raro + ElevenLabs voce + modello immagini) e **stima costi** (~$0,30–0,80 per cliente/mese; ~$360–1.000/mese in avvio, ~$3–8k a 10.000 clienti; marketing/blog quasi trascurabili). → **impatto [Sviluppo]:** endpoint `data-stats-endpoint` (contatori reali: +1 lead / +1 acquisto), `data-paths-endpoint` (percorsi app), `data-blog-endpoint` + entità `Article` + cron pubblicazione 1/giorno; fissare il **motore LLM** nel codice.

- `[Prodotto]` **Sito — revisione grafica + app + mascotte Gaia + blog + lavora + 9 lingue** — `../Metabole_Sito_Presentazione.html` rivisto a fondo: nuova sezione **"Come funziona l'app"** (il cliente inserisce misure e gradimento → l'**AI** registra e propone → il **nutrizionista** valida) con mockup del telefono; **mascotte Gaia** disegnata in SVG (usata nella ruota e nel telefono); nella **ruota hero** ora le linee figura→cliente **si accendono in sequenza** al passaggio di Gaia (come se attivasse l'azione, direzione dalla figura al cliente); **"AI" pulsa sempre** con i colori dell'intelligenza ovunque compaia Metabole**AI**; grafica più viva e **arcobaleno della multinazionalità** (sezione "Per ogni cultura" ora chiara con barra rainbow e icone colorate; tolto il fondo scuro/nero); **blocchi più vicini e con contorni** definiti; **nome Russolillo rimosso** (nome + CV alla pubblicazione). Aggiunte **2 lingue**: **spagnolo e portoghese** (ora IT/EN/ES/PT/FR/DE/RU/ZH/AR = 9). Nuove pagine **`../Metabole_Lavora.html`** ("Sei nutrizionista/coach? Vuoi diventare tutor della nutrizione?" + form candidatura) e **`../Metabole_Blog.html`** (indice articoli). Verificato: JS ok, 146 chiavi × 9 lingue complete, 14 sezioni bilanciate. → **impatto [Sviluppo]:** (1) **le lingue devono vivere nel DB** — predisposto hook `loadRemoteI18N` + attributo `data-i18n-endpoint` sul `<body>`: quando l'endpoint restituisce `{lingua:{chiave:valore}}` sovrascrive le locali (serve endpoint tipo `GET /api/v1/i18n/site`); (2) endpoint **"crea lead"** e **"candidatura lavora con noi"** (`fonte:'lavora_con_noi'`); (3) deploy Vercel/sottodominio. → da confermare: revisione madrelingua ES/PT/RU/ZH/AR; nomi/CV team; contenuti reali del blog.

- `[Sviluppo]` **Prodotti dinamici — Fase A+B (fondazione backend)** — deciso (con Simone) di NON creare una nuova tabella (il nome `Product` è già gli integratori): si **estende `Diet`**, che già possiede i menu isolati per `diet_id`. Aggiunti a `Diet` i campi cliente (`clientName`, `clientDescription`, `highlights`, `seasonalTag`, `objective`, `clientVisible`) + nuovo stile **`keto`** nell'enum `DietStyle`. Due migrazioni additive **validate su Postgres 16 locale** (ADD VALUE enum + ADD COLUMN). Seed idempotente `seedDietProductFields` (campi prodotto su Mediterranea/Proteica/Low-carb + crea **Keto** a menu vuoti). Endpoint **`GET /onboarding/diet-products`** (zero-redeploy, letto a runtime). **Nessun cambiamento visibile nell'app ancora** (è la fondazione; lo schermo 16 dinamico è la Fase C). Piano completo in `../Metabole_Prodotti_Dinamici_Piano_Sviluppo.md`. NB: type-check reale del backend su Render (il campo nuovo non è nel client Prisma locale).

- `[Prodotto]` **Sito — multilingua (7 lingue) + cookie + statistiche + esigenze culturali + pagine legali** — sito rifatto grafico con **animazione "tu al centro"** (Gaia organizza menu/coach/nutrizionista/eventi/imprevisti) e foto reali; ora in **IT/EN/FR/DE/RU/ZH/AR** (selettore lingua, arabo RTL, scelta persistente); **banner cookie** accetta/rifiuta → Cookie Policy; **statistiche** (20+ anni, 20.000+ clienti, 80.000+ persone) con **nota prodotti** (Nutriamo, MetaboleAI · Mosaico Experiences SA); sezione **"Per ogni cultura"** (halal — no maiale/crostacei, kosher/altre fedi, veg/vegan, allergie). Nuove pagine `../Metabole_Cookie.html` e `../Metabole_Termini.html`; privacy/cookie/termini su **base svizzera (LPD)** + GDPR per UE, foro di Lugano; tolto avviso "da validare" (validato dal consulente). → da confermare: numeri, elenco prodotti, foto/nomi team, `info@metabole.eu`; revisione madrelingua RU/ZH/AR. → impatto [Sviluppo]: endpoint "crea lead"; deploy Vercel/sottodominio.
- `[Sviluppo]` **Attivazione — schermo 27 "Il tuo percorso è pronto" + stato checklist 1:1** — allineato lo schermo 27 (PlanFlow) al prototipo: bolla di Gaia col **testo esatto** e i nomi **reali** di coach e nutrizionista (dal team assegnato). Prodotta la mappa `../Metabole_Checklist_Allineamento_STATO.md` con lo stato ✅/🟡/⬜ di tutte le 34 schermate onboarding + dashboard. **Onboarding replicato 1:1** tranne: schermo 16 (prodotti dinamici/Keto), video coach/nutrizionista (28–29), rifiniture assaggio menu (30) e widget tutto pronto (34). Type-check e build ok.

- `[Sviluppo]` **Onboarding — aggiunto schermo 6 "Perché vuoi iniziare adesso?"** — prima domanda della sezione Mente, con le 4 opzioni esatte del prototipo (Sentirmi bene con me stessa · Rientrare nei miei vestiti · Salute ed energia · Un evento importante) e il testo di Gaia. La risposta si salva in `lifestyle.motivation` (campo JSON già esistente → **nessuna migrazione**); aggiunto `motivation` al `LifestyleDto`. Con questo l'ordine delle domande Mente è completo (Perché → Come seguita → Carattere). Type-check app + questions ok.

- `[Sviluppo]` **Onboarding — testi delle domande allineati verbatim al prototipo** — titoli e testo scritto di Gaia (subtitle) di **tutte** le domande copiati esatti dal prototipo: es. identità → "Come vuoi essere chiamata?", carattere → "Quale caratteristica ti contraddistingue quando prendi un impegno?", e i testi lunghi di Gaia per obiettivo, salute, intolleranze, coach, ecc. Aggiornata anche la **palette colori app** (schermo 24) ai 6 colori della direttiva (#F2B807/#E23B3B/#E86FA6/#2F80ED/#12A386/#F2820A). Backend `onboarding.questions.ts` (servito a runtime, nessuna migrazione). **Rimandati** (filone prodotti dinamici): schermo 16 "Stile che preferisci" (Keto + prodotti dall'API) e l'aggiunta della domanda "Perché vuoi iniziare adesso?" (nuovo campo). Type-check del file ok.

- `[Sviluppo]` **App cliente — allineamento 1:1 onboarding (colori sezioni + schermo 25 GDPR)** — seguendo la Direttiva Replica 1:1: le **5 sezioni** hanno ora ordine, nomi, tab e **colori esatti** del prototipo (Mente `#6C4CD6` · Vita `#2F80ED` · Agenda `#E8543C` · Gusto `#E8A11B` · Corpo `#12A386`, con sfondi tenui) e l'ordine corretto **Mente→Vita→Agenda→Gusto→Corpo** (prima il Corpo era in testa). Lo schermo **25 "Trattamento dei dati personali"** ora ha la bolla di Gaia col testo esatto ("Manca solo la tua approvazione…") e pulsante "Accetta e procedi". Verificato che i campi **Età, Altezza, Sesso** (schermo 19) e **Peso/Vita/Fianchi** (schermo 20) erano già definiti a backend e mostrati. Type-check e build ok.
- `[Prodotto]` **Marketing — primo lotto social (vignette + testi)** — `../Metabole_Social_Lotto1.md/.pdf`: 10 post pronti (vignette empatiche, caroselli educativi firmati **dott. Salvatore Russolillo** — capo nutrizionista/tecnologo/coach/psicologo — Reel prodotto, quote, testimonianza) con concept, testi sull'immagine, caption, hashtag e prompt immagine; mini-calendario 2 settimane. Tutti conformi (no prima/dopo, no numeri/garanzie, 18+), passano dal Giudice. Contesto operativo: legale (privacy/cookie) pronto da avvocato; team pronto (Russolillo + 8 coach + 1 supervisore); go-live quasi completo (restano verifiche Stripe LIVE/Brevo/DPA + contenuti menu altre diete + profili coach/nutrizionista in-app).
- `[Prodotto]` **Sito — Informativa privacy** — aggiunta `../Metabole_Privacy.html` (adattata dalla policy Mosaico Experiences SA / nutriamo.ch): Titolare Mosaico Experiences SA (Lugano), email `info@metabole.eu`, servizi tarati sul sito reale (modulo contatti, Google Fonts, log hosting) al posto di quelli WordPress; rimossi riferimenti obsoleti (Privacy Shield). Collegata dal footer e dal consenso del form. Nota: riguarda il **sito**; l'app ha l'informativa dedicata del legale. Testo da validare col consulente privacy.
- `[Prodotto]` **Sito di presentazione — v3 grafico + animazione "tu al centro"** — `../Metabole_Sito_Presentazione.html` rifatto come sito vero, non landing: **animazione orbitale nell'hero** (cliente al centro, Gaia che ruota e connette Menu/Coach/Nutrizionista/Eventi/Imprevisti), **foto reali** (Unsplash con fallback Picsum sicuro), tipografia editoriale (Fraunces+Inter), sezioni ricche (concept, banda foto, team con Russolillo + coach, "un giorno con te", storie con volti, FAQ, CTA immersiva). Tono meno commerciale, più umano. Restano CTA app + form lead (`data-endpoint` da collegare). → da fornire foto reali del team; deploy Vercel/sottodominio.
- `[Prodotto]` **Sito di presentazione — v2 più umano/reale** — `../Metabole_Sito_Presentazione.html` riscritto con meno tono "markettaro" e le **persone** al centro: sezione **team reale** (dott. Salvatore Russolillo responsabile scientifico + le 8 coach e supervisora), **spazi per foto vere** (hero, team, piatti, testimonianze) con etichette che descrivono la foto da inserire, tono caldo. Restano CTA → app.metabole.eu + form lead (`data-endpoint` da collegare al CRM). Compliance ok (no prima/dopo, no numeri/garanzie, 18+). → impatto [Sviluppo]: endpoint pubblico "crea lead"; deploy Vercel/sottodominio. → da fornire: foto reali + nomi coach + ritratto Russolillo.
- `[Prodotto]` **App cliente — pag.16: "Flessibile" → "Keto"** — nella lista prodotti (array `PLANS`) del prototipo (e `docs/`) sostituito il piano *Flessibile* con **Keto** (caratteristiche: pochi carboidrati, grassi buoni, sotto controllo del nutrizionista). Sintassi verificata. *(Nota: elenco demo; in produzione i prodotti arrivano dall'API.)*
- `[Prodotto]` **Checklist allineamento web app ↔ prototipo** — `../Metabole_Checklist_Allineamento.md/.pdf`: 34 schermate onboarding + dashboard + popup, ognuna con casella da spuntare; a supporto della direttiva di replica 1:1.
- `[Prodotto]` **DIRETTIVA per lo Sviluppo — replica 1:1 del prototipo nella web app** — deciso: il prototipo `docs/Metabole_Prototipo_Navigabile.html` è la **versione finale** dell'app cliente; la web app va allineata **1:1** (sezioni Mente/Vita/Agenda/Gusto/Corpo + colori, contenuti, pagine e ordine, testi di Gaia scritti e parlati, dashboard, popup, navigazione). **Unica eccezione: il pagamento Stripe reale** resta quello della web app. Doc `../Metabole_Direttiva_Replica_Prototipo.md/.pdf` con valori esatti (colori sezioni, palette, ordine 34 schermate) + **prompt pronto** da incollare all'AI di Simone. → impatto [Sviluppo]: allineare la web app schermata per schermata al prototipo.
- `[Prodotto]` **App cliente/Onboarding — campi anagrafici + schermata privacy** — nel prototipo (e `docs/`): pag.19 "Come vuoi essere chiamata?" ora mostra **sempre Età + Sesso (Uomo/Donna)** sotto il Nome (prima erano nascosti finché non scrivevi il nome); pag.20 "Il tuo punto di partenza" ha in più il campo **Altezza (cm)**; **nuova schermata "Trattamento dei dati personali"** (GDPR + consenso) inserita **dopo pag.24 (colore)**, con voce di Gaia: *"Manca solo la tua approvazione al trattamento dei dati personali e potrò costruire il tuo percorso personalizzato di MetaboleAI. Clicca su accetta e procedo."* Flusso **35 passi** (conteggio dinamico); verificato a runtime con jsdom. → **voce da rigenerare** (solo `privacy`, testo cambiato): `FORCE=1 ONLY="privacy"`. → impatto [Sviluppo]: replicare campi e schermata consenso nell'app React.
- `[Prodotto]` **Prodotto/Motore — Gestione eventi programmabili** — nuovo `../Metabole_Gestione_Eventi.md/.pdf`: sezione dashboard per programmare gli eventi (matrimonio, vacanze, sgarro, +altri) a fasi Prima/Il giorno/Dopo, con leve configurabili (modalità menu dimagrimento/mantenimento/nessun menu, messaggio Home, integratori prescritti dal nutrizionista non selezionabili, politica misure con/senza blocco, spegnimento consigli, coach più attiva + soglie Δkg/Δcm). Template configurabili da nutrizionista/admin, istanza da agenda cliente; riusa stati agente pre/post_evento e le fasi agenda esistenti; data-driven (zero-redeploy). → impatto [Sviluppo]: entità EventType/EventPhase/ClientEvent/EventSupplementPlan; hook motore fase-attiva; regole alert event-driven.

- `[Prodotto]` **Prototipo — pagina 16 cablata: caratteristiche al tocco** — nel prototipo (e `docs/`) la pagina 16 ora rende i piani da un array `PLANS` (come dall'API) e, al tocco sul nome, apre il pannello **Caratteristiche principali** (un solo pannello per volta, riusa `data-show`/`data-panel`). Verificato a runtime con jsdom (4 piani, apertura/chiusura ok, scelta salvata in `state.plan`). Voce generica invariata. → riferimento visivo per lo Sviluppo dell'app.

- `[Sviluppo]` **Notifiche — campanella in-app collegata al server + preferenze + guida push** — la
  **campanella** nell'header ora mostra le notifiche reali (`GET /me/notifications`): titolo/testo dal
  `payload`, icona per tipo, ora relativa ("5 min fa"), **badge** con le non-lette, tap = segna-letta
  (`PATCH /me/notifications/:id/read`) e "Segna lette" per tutte. In **Profilo** nuova sezione
  **Notifiche**: interruttore "anche via email" + on/off per ogni tipo (`GET/PATCH
  /me/notifications/prefs`); le notifiche di sicurezza e del team restano sempre attive. Type-check e build
  ok. Per il **push sul telefono** (passo successivo scelto: "prima in-app, poi push") ho scritto la guida
  `../Metabole_Notifiche_Push_Setup.md`: Simone crea il progetto **Firebase** (package `app.metabole.client`)
  e passa `google-services.json` + service account (su Render), poi collego app (`@capacitor/push-notifications`)
  e server (modello `PushToken` + invio FCM dentro `notifyOncePerDay`, rispettando le preferenze).
- `[Sviluppo]` **App cliente — Agenda rifatta come nel prototipo** — la schermata Agenda ora segue il
  prototipo: **"Prossimi appuntamenti"** (reali da `GET /me/agenda`: ora/data, coach o nutrizionista, tipo,
  tag "Con la coach"/"Col nutrizionista"), **"Prenota un appuntamento"** (foglio: la prenotazione diretta
  arriva presto → intanto "Chiedi a Gaia"), **"Il tuo piano"** (da `GET /me/subscription`: nome piano,
  "scade tra N gg", **Rinnova** → Shop). Sotto restano i **giorni no-diet** (aggiungi/rimuovi + piano
  prima/durante/dopo) così non si perde la funzione. Type-check e build ok.
- `[Sviluppo]` **App cliente — header comune anche su Menu, Assistente e Profilo** — uniformato l'header
  teal `AppHeader` (MetaboleAI + titolo + notifiche/da-completare/shop/profilo) sulle ultime schermate che
  restavano con la vecchia intestazione: **Menu** ("Il tuo menu"), **Assistente** ("Gaia") e **Profilo**
  ("Profilo", con sotto il blocco avatar/nome). Ora **tutte** le schermate dell'app hanno lo stesso header
  del prototipo. Type-check e build ok. Allineato il workspace alla pull del socio (registro/stato) prima
  di procedere. **Nota:** la decisione navigazione risulta CONFERMATA dal socio (stessa del prototipo),
  quindi il lavoro precedente è validato. Prossimo grande filone [Sviluppo] dalla pull: **prodotti
  dinamici / zero-redeploy** (entità `Product`, wizard backoffice, agente per prodotto, **pagina 16**
  dell'onboarding che legge i prodotti dall'API con voce di Gaia generica) — da pianificare, tocca
  backend + backoffice + app.
- `[Prodotto]` **Prodotto — campo "Caratteristiche principali" del prodotto** — ogni prodotto porta `client_description` + `highlights` (3–5 punti), inseriti nel wizard (step Anagrafica) e **mostrati al cliente** al tocco sul nome del piano a pagina 16. Aggiornati spec sviluppo (modello dati/wizard/pag.16), catalogo (B1) e mockup wizard. Coerente con la voce generica di Gaia. → impatto [Sviluppo]: campi `Product.client_description`/`highlights` + vista dettaglio al tap.
- `[Prodotto]` **Voce/Prodotto — pagina 16 voce generica (zero-redeploy audio)** — la voce di Gaia a pag.16 non elenca più le diete: da "…mediterranea, proteica, low-carb…" a **"Scegli il piano più adatto alle tue esigenze: tocca il nome di un piano per scoprirne le caratteristiche principali."** (prototipo + `docs/` + `tools/genera_voci_gaia.mjs`, chiave `q_stile_che_preferisci`). I nomi prodotti restano solo testo a schermo (dinamici) e sono toccabili per aprire la descrizione. → **voce da rigenerare SOLO quella chiave**: `ONLY=q_stile_che_preferisci` (mai FORCE su tutte). Regola aggiunta in Spec_Prodotti_Dinamici §0.
- `[Prodotto]` **Sviluppo(req) — ZERO-REDEPLOY per i prodotti** — aggiunto requisito in `../Metabole_Spec_Prodotti_Dinamici_Sviluppo.md` §0: creare/modificare un prodotto NON deve mai richiedere ripubblicazione app (web/nativa) né deploy backend. Il client legge i prodotti dall'API a runtime; menu/regole sono dato. → impatto [Sviluppo]: pagina 16 e motore data-driven; niente liste hardcodate.
- `[Prodotto]` **Prodotto — Schede regole (microcopy wizard) + mockup wizard "Crea nuovo prodotto"** — `../Metabole_Schede_Regole_Wizard.md/.pdf` (testo semplice regola-per-regola con domanda di consenso, come lo legge il nutrizionista) e `../Metabole_Wizard_Crea_Prodotto.html` (mockup dei 5 passi: anagrafica → menu → regole → proposta → attivazione con agente dedicato). Riferimenti per lo Sviluppo del wizard.
- `[Prodotto]` **DECISIONI — navigazione app + nome prodotto** — (1) **Navigazione app cliente DECISA**: si adotta quella del prototipo *Home · Percorso · Obiettivi · Contatti · Agenda* (Shop in header); la versione *Menu · Obiettivo · Home · AI · Agenda* è la vecchia, **da sostituire**. → impatto [Sviluppo]: creare Percorso e Contatti, spostare Menu nella Home, trasformare AI in Contatti. (2) **Nome 2° protocollo estate confermato: "Ritorno in Equilibrio"**.
- `[Prodotto]` **Sviluppo(handover)/Motore — Spec prodotti dinamici + obiettivo mantenimento** — nuovo `../Metabole_Spec_Prodotti_Dinamici_Sviluppo.md/.pdf`: modello dati (`Product`, `Menu(product_id)`, `Recipe`, `ProductRule`, `RuleProposal`), wizard backoffice, API bozza, agente per prodotto, pagina 16 dinamica, vincoli (isolamento S1 enforced a DB). Aggiunto obiettivo prodotto **dimagrimento/mantenimento** in `../Metabole_Motore_Personalizzazione.md` §0ter. → impatto [Sviluppo]: è la spec da implementare per "Crea nuovo prodotto".
- `[Prodotto]` **Motore/Prodotto — Catalogo regole motore + wizard "Crea nuovo prodotto"** — nuovo `../Metabole_Regole_Motore_Catalogo.md/.pdf`: tutte le regole del motore numerate e classificate (🔒 sicurezza sempre attive · ⚙️ opzionali con consenso), + spec della sezione dashboard "Crea nuovo prodotto" (nome + menu propri colazione/pranzo/cena + snack, consenso regola-per-regola, proponi nuova regola, un agente AI per prodotto). I due protocolli estate = due prodotti creati così; si scelgono a pag.16. → impatto [Sviluppo]: entità `Product` + `Menu(product_id)` + `ProductRule`; wizard backoffice; agente per prodotto; pag.16 legge i Product attivi.
- `[Prodotto]` **Prodotto — Testi di Gaia & template Coach (protocolli estate)** — copioni pronti (`../Metabole_Testi_Gaia_Coach_Estate.md/.pdf`) per Vacanze in Serenità e Ritorno in Equilibrio: Gaia (attivazione, valigia, quotidiano, gestione strappo, check-in soft, rientro) e Coach (buona partenza, bentornato, call). Tono "equilibrio senza colpa", nessun menu, nessuna promessa. → per lo Sviluppo/voce: nuove chiavi audio suggerite `estate_vac_*` / `estate_rit_*`.
- `[Prodotto]` **Motore/Prodotto — REGOLA: isolamento dei menu per prodotto (BLOCCO)** — ogni prodotto/protocollo ha il PROPRIO catalogo di menu; **mai** mischiare menu tra prodotti diversi, nemmeno per riferimento; a parità di piatti si **duplicano, non si condividono**; i menu li fornisce il nutrizionista, l'AI non li inventa né prende in prestito. Aggiunta in `../Metabole_Motore_Personalizzazione.md` (§0) e in `../Metabole_Piani_Estate` (§0). → impatto [Sviluppo]: menu legati a `product_id`, nessun riferimento/join tra cataloghi di prodotti diversi. I due protocolli estate hanno cataloghi propri, **vuoti** finché il nutrizionista non li popola. Fissata anche come **regola ferrea** in `STATO.md`.
- `[Prodotto]` **Prodotto — Piani d'estate (luglio): Vacanze in Serenità & Ritorno in Equilibrio** — spec dei due percorsi stagionali (`../Metabole_Piani_Estate.md/.pdf`): mantenimento in vacanza (menu freddi/portabili, bussola-ristorante, misure non bloccanti) e ripartenza dolce al rientro (reset 1ª settimana → ritmo 2ª). Costruiti sui mattoni esistenti (stati agente, catalogo estivo, segnali). **Scope**: sono modalità sopra la dieta scelta; menu concreti oggi solo per la **Mediterranea** (unico catalogo reale), altri regimi = logica ma catalogo da costruire. → impatto [Sviluppo]: segnale `travel_mode` (date) che accende mantenimento/rientro; sospendere popup misure in vacanza; evento `rientrato` al CRM. Aggiunto anche `../Metabole_Macchina_Marketing_Schema.svg` (schema visivo della macchina).
- `[Prodotto]` **Marketing — Macchina di marketing completa (8 agenti + Giudice) + integrazione** — aggiunti `../Metabole_Macchina_Marketing_AI`, `../Metabole_Agente_Contesto_Tempismo`, `../Metabole_Libreria_Creativa`, `../Metabole_Specifica_Giudice_Compliance` (.md/.pdf) e `progetto/INTEGRAZIONE_MARKETING.md`. La macchina: Contesto&Tempismo → Stratega → Creativo/Copy → **Giudice** (compliance, blocca prima di pubblicare) → Publisher → Lead → Analista. → impatto [Sviluppo]: implementare il Giudice (ruleset in `config_param` + audit) e gli endpoint agenti (lead/pubblicazione/consensi).
- `[Sviluppo]` **App cliente — navigazione allineata al prototipo navigabile (docs/)** — rifatta la struttura dell'app "dentro" seguendo **schermata per schermata** il prototipo in `docs/Metabole_Prototipo_Navigabile.html` (fotografato in headless per copiarlo fedele). Novità: **header comune `AppHeader`** (barra teal ad angoli arrotondati con "METABOLEAI" + titolo + 4 icone: notifiche, da completare, shop, profilo) su tutte le schermate principali; **tab bar** riordinata a **Home · Percorso · Obiettivi · Contatti · Agenda** (solo icone, quella attiva in un quadrato teal rialzato, come nel prototipo). **Home** semplificata al prototipo: "IL MENU DI OGGI" (carosello pasti + Spesa), "PROSSIMO APPUNTAMENTO", card "GAIA · LA FRASE DI OGGI" — dati reali dal backend. Due **nuove pagine**: **Percorso** ("IL MENU DI OGGI" + "Diario del percorso" con schede *Menu passati* / *Eventi*) e **Contatti** (team Gaia · coach · nutrizionista con stato LIVE e "Conversazioni passate", nota privacy) — nomi reali dal profilo. **Accedi** rifatto come **foglio che sale dal basso** sopra la Landing ("Bentornata", Email o username, Password, Entra, Password dimenticata?), identico allo screenshot. Aggiunti header teal a **Obiettivi** ("I tuoi obiettivi"), **Agenda**, **Shop**. Rotte nuove `/percorso`, `/contatti`, `/shop`. Type-check e build di produzione **ok**; verifica visiva delle schermate fatta in headless (combaciano col prototipo). Note oneste su cosa NON è (ancora) allineato: **Menu, Assistente (chat Gaia) e Profilo** hanno ancora la loro intestazione (non il nuovo header comune); nella "Percorso · Menu passati" non mostro il segno kg perso/preso perché quel dato non è ancora esposto dal backend (mostro "N pasti"); su Home ho tolto la riga acqua/passi e le azioni rapide che nel prototipo non ci sono (si possono rimettere altrove se vuoi); i badge notifiche/da-completare compaiono solo con conteggi reali (niente numeri finti) e per ora aprono un foglio segnaposto. Schermi 27–29 (video coach/nutrizionista, assaggio menu) e 33 (widget) restano fuori: i video li hai chiesti di saltare, gli altri aspettano contenuti reali.
- `[Prodotto]` **Nuovi documenti dal socio (da lavorare come step successivi)** — caricati `Metabole_Libreria_Creativa.pdf` e `Metabole_Integrazione_Marketing_Deploy.pdf`: da leggere e integrare nei prossimi passi (marketing/creatività e integrazione deploy). **TODO prossima sessione.**
- `[Sviluppo]` **App cliente — TypeText esteso a Onboarding e Home + allineamento Home al prototipo** —
  l'effetto "a macchina da scrivere" di Gaia è ora applicato anche: alle **intro di sezione** e alla
  **bolla di ogni domanda** dell'Onboarding (rimonta ad ogni domanda, così ricompone), all'**overview
  "Facciamo conoscenza"** (schermo 4, "cinque punti" in grassetto), e alla **frase del giorno di Gaia in
  Home** (si ricompone ogni volta). Home: etichetta della card allineata al prototipo →
  **"GAIA · LA FRASE DI OGGI"** con icona *sparkles*. Type-check app ok. Consegnati `Onboarding.tsx`,
  `Home.tsx`.
  Aggiunto anche lo **schermo 25 "Sto cucendo il tuo percorso"**: transizione a schermo intero (Gaia
  grande + bolla che si compone + spinner) mostrata mentre il motore calcola, con durata minima ~3,2s
  come nel prototipo (onesta: compare durante il vero calcolo, non è un finto ritardo). Build di
  produzione ok.
  **⚠️ DECISIONE APERTA (serve Simone) — navigazione a tab.** Il prototipo in `docs/` usa la barra
  **Home · Percorso · Obiettivi · Contatti · Agenda** (+ Shop), mentre l'app oggi ha
  **Menu · Obiettivo · Home · AI · Agenda** (e nel codice questa era marcata come "prototipo definitivo").
  Sono due architetture di navigazione diverse: allinearle vorrebbe dire creare le pagine **Percorso** e
  **Contatti** (oggi assenti), spostare **Menu** dentro la Home e trasformare **AI/Assistente**. È un
  cambio strutturale importante e reversibile solo con lavoro: **non l'ho fatto in autonomia**. Da decidere
  insieme quale delle due barre è quella buona prima di procedere.
- `[Sviluppo]` **App cliente — testo "a composizione" (TypeText) + Fase 2 (Crea account)** — come nel
  prototipo, i testi di Gaia si **compongono a macchina da scrivere mentre lei parla**: nuovo componente
  riutilizzabile `TypeText` (rispetta grassetti e `prefers-reduced-motion`, cursore lampeggiante),
  applicato alla card assistente della Landing, alla bolla di "In cosa siamo diversi" e di "Crea account";
  da usare su tutti gli schermi. **Fase 2**: `Register` (schermo 3) allineato al mockup — registrazione
  minimale (Nome/Cognome/Email/Password/Codice invito con nota, l'indirizzo si prende al checkout),
  barra "Passo 3 di 34", "oppure registrati con" Apple/Google (placeholder "in arrivo"). Type-check ok.
  Nota: il prototipo live non è raggiungibile dalla sandbox (rete ristretta) e la copia locale è una
  versione più vecchia (28 step) → animazioni calibrate sul video del socio.
- `[Sviluppo]` **App cliente — allineamento al prototipo "34 schermate" (Fase 1)** — dai riferimenti del
  socio (video del flusso + PDF sequenza esatta + prototipo navigabile) il funnel nuovo cliente è di
  **34 step** con barra "Passo N di 34" e tab di sezione. Ricostruita la **Landing (schermo 1)** fedele al
  mockup: brand **MetaboleAI** (teal+viola), claim "Non una dieta: un'AI…", card assistente Gaia con audio,
  **Accedi/Registrati**, prova sociale (★ 24.000 persone), 2 testimonianze. Nuovo schermo **"In cosa siamo
  diversi" (schermo 2)**: 5 punti (Coach sempre presente, Nutrizionista specializzato, App intelligente,
  Dieta personalizzata, Gaia · supervisore AI) + "Sono pronta/o". Rotta `/diversi`. Type-check app ok.
  Resta da allineare (a fasi): 3 Crea account (+Apple/Google), 4 Facciamo conoscenza, le intro sezione +
  domande (5-23) con chrome "Passo N di 34" + tab, 24 colore app, 25 "Sto cucendo il tuo percorso", 26
  percorso pronto, 27-28 video coach/nutrizionista, 29 assaggio menu, 30 scegli piano, 31 riepilogo, 32
  data inizio, 33 tutto pronto (widget). La logica (onboarding, checkout, plan flow) è già a backend.
- `[Sviluppo]` **App staff role-adattiva — Home Coach e Home Nutrizionista** — deciso (con Simone) di NON
  fare tre app React separate: il backoffice diventa **un'unica app staff che cambia in base al ruolo**
  (l'app cliente resta separata, per sicurezza/GDPR e distribuzione store). La Home (rotta `/`) ora è un
  dispatcher (`Home.tsx`): coach → **`CoachHome`** (KPI clienti/avvisi/piani in scadenza/guadagni, lead da
  accettare con Accetta/Rifiuta, coda avvisi con gestito/escalation, elenco clienti, link d'invito con
  copia), nutrizionista/capo → **`NutritionistHome`** (KPI clinici, coda di validazione decisioni
  motore/diete/protocolli con Conferma/Correggi, pazienti che richiedono attenzione), altri → dashboard
  generale. Tutto sul backend Fasi 4/7 già pronto. Il menu era già filtrato per permessi. Type-check ok.
  Prossimo: rendere le viste comode anche da telefono e rifinire i dettagli cliente per coach/nutrizionista.
- `[Sviluppo]` **Backlog #2 — Invito cliente dalla coach (ref code)** — la pagina di registrazione dell'app
  ora accetta il codice invito dal link (`/register?ref=CODICE`, precompilato e con nota "codice applicato");
  ampliato il campo a 8 caratteri per supportare anche i codici "porta un'amica" (8) oltre a quelli coach (6).
  Nuovo endpoint self-service `GET /crm/my-invite` (ruolo coach): restituisce il proprio ref code (creato se
  manca) + il link di registrazione pronto da condividere (base da `APP_URL`). Così la coach ha subito il suo
  link d'invito (la UI dedicata arriverà con l'app coach). Il backend di auto-assegnazione via ref code
  esisteva già. 3 test nuovi.
- `[Sviluppo]` **Backlog #1 — Assegnazione lead a tempo: soglia in config** — il flusso c'era già
  (assegna→pending, la coach accetta/rifiuta entro N giorni, scadenza via cron con notifica alla responsabile
  per riassegnare). Portata la **finestra di accettazione da hardcodata (2 giorni) a config** `lead_accept_days`
  (default 2), usata sia dal conto alla rovescia in "Lead da accettare" sia dalla scadenza del cron; testo
  della notifica reso dinamico. 2 test nuovi. Con questo il #1 è completo.
- `[Sviluppo]` **Backlog #3 — Numero versione app** — la versione (da `app/package.json`) viene iniettata a
  build-time come costante `__APP_VERSION__` (Vite `define`) e mostrata in piccolo/discreto in fondo alla
  pagina Profilo ("Metabole · v0.1.0"). Solo front-end app cliente.
- `[Sviluppo]` **Backlog #0 — Permessi: pulsante "Salva" con conferma** — la matrice Permessi non salva
  più ogni interruttore all'istante: le modifiche si accumulano in locale (celle evidenziate + barra
  "N modifiche non salvate"), poi **Salva** apre un **modale di conferma** e invia il batch dei PATCH
  (una cella per volta, come da API), con toast di esito; "Annulla" scarta le modifiche. Regola "senza
  vede niente gestisce" mantenuta. Solo front-end.
- `[Sviluppo]` **Fix seed admin da Render (password che "non funzionava")** — `ensureAdminFromEnv` prima
  applicava `ADMIN_PASSWORD` SOLO alla creazione dell'account: se l'admin (`ADMIN_EMAIL`, es.
  `admin@metabole.eu`) esisteva già, la password su Render veniva ignorata → login impossibile. Ora il
  seed: promuove ad admin, e **applica `ADMIN_PASSWORD`** se la password non è mai stata impostata
  (placeholder) o se si imposta `ADMIN_PASSWORD_RESET=true` (reset forzato una tantum, poi si rimuove la
  var); riattiva l'account se sospeso/archiviato. Così `admin@metabole.eu` è l'**admin principale
  recuperabile da Render** (e resta non archiviabile, anti-lockout). Documentato in `render.yaml`.
  Gira nel `preDeployCommand` a ogni deploy.
- `[Sviluppo]` **Ruoli Marketing + archiviazione utenti + foto profilo (pulizia account)** — tre interventi
  a supporto della gestione utenti:
  1) **Ruoli Marketing**: nuovi ruoli RBAC `marketing` e `head_marketing` (Responsabile Marketing) —
     enum Prisma + migrazione, `roles.ts`, permessi di default (dashboard/grafici/CRM in lettura, sezione
     `marketing` gestibile; il capo marketing vede anche modelli email e contabilità incassi), etichette,
     voce di menu "Marketing" (pagina placeholder: il modulo vero è da costruire). Così si può creare un
     account "Responsabile Marketing".
  2) **Archivia/ripristina utente** (soft-delete): `DELETE /admin/users/:id` (imposta `deletedAt` + sospeso
     + revoca sessioni) e `POST /admin/users/:id/restore`. **Protezioni anti-lockout**: non ci si può
     archiviare da soli e non si può archiviare l'admin legato alla variabile Render `ADMIN_EMAIL`.
     La tabella Utenti ha "Mostra archiviati", il pulsante Archivia e il Ripristina. 6 test.
  3) **Foto profilo**: campo `photoUrl` su User + migrazione; in Impostazioni si carica un'immagine
     (ridotta a 256×256 lato client come data URL) usata come **avatar** nel menu utente in alto (altrimenti
     iniziali). PATCH `/me/account` accetta `photoUrl` (solo data URL immagine, o null per rimuoverla).
  4) **Impostazioni** tolte dalla sidebar (ora si aprono dal menu utente/avatar in alto).
  Suite 356 verde; migrazioni validate su PG16.
- `[Sviluppo]` **Backlog #6 — Modulo Contabilità (costi + conto economico)** — nuovo modello `CostEntry`
  (costi ricorrenti + una tantum: infrastruttura, marketing, stipendi, tasse, AI…) + migrazione (validata
  PG16). `AccountingService` con aggregazione **pura e testata** (`buildReport`/`costInMonth`/`monthsBetween`):
  conto economico del periodo — incassi (da `LedgerEntry`) vs costi (uscite a ledger provvigioni/compensi +
  costi manuali), per categoria, serie mensile, e KPI **utile, margine, CAC, ARPU, spesa marketing, nuovi/
  paganti**. I costi ricorrenti annuali sono **ammortizzati /12** per un P&L mensile liscio. Endpoint admin
  `GET /admin/accounting/report?from&to` e CRUD costi `/admin/accounting/costs`. Pagina backoffice
  **Contabilità** (`/contabilita`, chiave permesso `accounting_costs`): selettore periodo, KPI, 3 grafici
  mensili (incassi/costi/utile, un asse per grafico riusando `MiniTrend`), costi per categoria, tabella
  costi con aggiungi/modifica/elimina. 13 test backend, suite 350 verde.
- `[Sviluppo]` **Backlog #5 — Avatar/menu utente (backoffice)** — nell'header, al posto di
  "email · ruolo", ora c'è un **avatar a iniziali** (colore stabile dall'email) cliccabile che apre un
  **menu utente** (email+ruolo, **Impostazioni**, **Esci**), con chiusura su click-fuori/Esc. Nuovo
  componente `UserMenu.tsx` + stili. Foto profilo: futura.
- `[Sviluppo]` **Backlog #7 — Calendario CRM cliccabile** — nel calendario promemoria, cliccando su un
  promemoria si apre un **modale** per **modificarlo**, **spostarlo** (nuova data/ora → `PATCH /crm/reminders/:id`,
  già disponibile), segnarlo completato o eliminarlo, con le **azioni rapide di contatto** (chiama /
  WhatsApp / email) del lead collegato. Estratto un componente `ContactActions` riusato anche in
  creazione. Solo front-end (backend già pronto).
- `[Sviluppo]` **Fase 7 (parte 2) — Coda di validazione (diete/protocolli/decisioni) per-paziente** —
  nuovo `GET /nutritionist/validation-queue`: raccoglie ciò che il nutrizionista deve validare —
  **decisioni del motore** marcate per revisione filtrate PER-PAZIENTE (solo i pazienti assegnati; il
  capo/admin le vede tutte), **diete in revisione** da approvare (solo il capo) e **protocolli** in
  attesa (mai i propri) — con nomi paziente e contesto. Nuovi `POST /nutritionist/decisions/:id/confirm|correct`
  che applicano lo **scoping per-paziente** (un nutrizionista revisiona solo le decisioni dei suoi
  pazienti) e delegano la scrittura all'EngineService (idempotenza + audit già lì); le azioni su
  diete/protocolli riusano gli endpoint esistenti (catalog / protocols). 7 test nuovi, suite 337 verde.
  Nessuna migrazione. (Nota sicurezza: gli endpoint `/engine/decisions/:id/confirm|correct` restano
  NON scoped — vedi follow-up in STATO.)
- `[Sviluppo]` **Fase 6 (completamento) — Agente: post-evento, rientro, guardrail conforto** — estesa
  la macchina a stati `DietAgentService`: nuovi stati **post_evento** (evento concluso negli ultimi N
  giorni → spinta efficacia per il recupero) e **rientro**, con due inneschi: il **guardrail** (troppi
  giorni di conforto consecutivi oltre `agent_comfort_max_days` → si esce dai menu "amati" e si torna
  a spingere l'efficacia) e il **recupero** (umore risalito dopo un periodo difficile entro
  `agent_reentry_days`). La "memoria" dello stato si ricava dallo storico dei check-in (nessuna tabella,
  nessuna migrazione). La selezione menu tratta post_evento/rientro come plateau (boost efficacia).
  Priorità: pre_evento > post_evento > plateau > conforto/guardrail/rientro > normale. Nuove soglie in
  config. **Con questo l'agente della Fase 6 è completo.** 8 test (suite 330 verde).
- `[Sviluppo]` **Fase 5 (avanzata) — Attribuzione causale del pasto** — nuova funzione
  `distinctiveCredits`: alla chiusura di un ciclo il merito/demerito non va più in parti uguali a tutte
  le ricette, ma è pesato per **distintività** — la ricetta rara (quella che è CAMBIATA nel ciclo) è la
  causa più probabile di un esito diverso dal solito e prende più credito, quelle sempre presenti lo
  prendono scontato (peso = 1/(1+alpha·samples), normalizzato). Se tutte hanno la stessa frequenza il
  credito torna uniforme. **Opt-in** via `learning_distinctive_weighting` (default false → comportamento
  v1 naive invariato) + `learning_distinctiveness_alpha`. Non è una prova causale: è un modo trasparente
  per far emergere prima il pasto che sposta l'ago. **Con questo il motore v1 della Fase 5 è completo.**
  9 test (suite 327 verde). Nessuna migrazione.
- `[Sviluppo]` **Fase 5 (avanzata) — Giornate bilanciate automatiche (DayCombo)** — nuovo
  `DayComboService` (algoritmo puro, testabile): compone la giornata scegliendo una ricetta per slot
  DENTRO il pool della dieta approvata, in modo che il totale kcal rientri nella banda del target del
  livello (`Diet.levels`), massimizzando il punteggio efficacia+gradimento (modulato dallo stato) e
  ruotando tra le combinazioni migliori per varietà; penalità soft sulla quota proteica giornaliera.
  Pool piccoli → enumerazione completa; pool grandi → greedy. **Opt-in** via `menu_daycombo_enabled`
  (default false): se spento, o se il livello non ha un target kcal, o se nessuna giornata rientra nella
  banda → fallback ai template composti a mano + selettore per-slot (comportamento attuale invariato).
  Refactor: estratto `buildScoringContext` (pool+punteggio) condiviso da selettore e DayCombo. Non
  allarga mai l'insieme ricette approvato dal nutrizionista. 10 test nuovi, suite 322 verde. Nessuna
  migrazione (usa `Diet.levels` e i campi ricetta già esistenti). Resta l'attribuzione causale del pasto.
- `[Sviluppo]` **Fase 8 (parte 1) — "Porta un'amica" (referral cliente)** — ogni cliente ha un
  `referralCode` (8 caratteri, distinto dai ref code coach a 6) sul profilo; nuovo modello `Referral`
  (FK-less: referrer/referred = userId, una invitata = un solo invito) + migrazione (validata PG16).
  `ReferralService`: `ensureCode`, `myReferral` (codice + inviti/conversioni/ricompense), `isClientCode`,
  `linkOnRegister`, `onConvert`. In **registrazione** il codice coach ha la precedenza; se non è un
  codice coach ma di una cliente, si registra l'invito (prima il codice ignoto veniva rifiutato).
  Alla **prima attivazione dell'abbonamento** dell'invitata (`finalizeApproval`) scatta la ricompensa:
  l'abbonamento attivo della referrer viene esteso di `referral_reward_days` (config, default 30);
  se la referrer non ha un abbonamento attivo la ricompensa resta in sospeso (convertita ma non premiata).
  Endpoint cliente `GET /me/referral`. 8 test nuovi, suite 313 verde. (Il resto della Fase 8 — piani,
  checkout, provvigioni, ledger, payout — era già presente.)
- `[Sviluppo]` **Fase 7 (parte 1) — App Nutrizionista: pazienti + dashboard** — nuovo modulo
  `nutritionist`: `GET /nutritionist/patients` (pazienti assegnati con riepilogo clinico: ultima misura,
  escalation aperte, documenti da revisionare, prossima visita, ordinati per attenzione) e
  `GET /nutritionist/dashboard` (pazienti, documenti pending, escalation aperte, protocolli da validare
  `flaggedForReview`, visite in arrivo, guadagni mese/totale). Il dettaglio clinico è già in `health-area`
  (documenti/note/visite/agenda). Nessuna migrazione. 4 test nuovi, suite 303 verde.
- `[Sviluppo]` **Fase 6 (parte 1) — Agente AI: stati + selezione modulata** — nuovo `DietAgentService.stateFor`
  (pre_evento / plateau / conforto / normale, da eventi, cicli senza calo, umore recente). La selezione
  dei menu è modulata dallo stato: conforto → boost gradimento, plateau → boost efficacia, pre_evento →
  bonus proteine (dai macro). Sicurezza/bilanciamento restano prioritari; pesi in config. Le segnalazioni
  sono già coperte dall'Alert engine. 5 test nuovi, suite 299 verde. Restano Rientro/post-evento/guardrail.
- `[Sviluppo]` **Fase 5 (parte 4) — Selezione menu per efficacia+gradimento** — alla composizione della
  giornata, per ogni slot il motore sceglie la ricetta col punteggio migliore
  (`w_eff·efficacia(MenuWeight) + w_grad·gradimento(stelle)`, default 5★, tie → template), SOLO tra le
  ricette della dieta approvata per quello slot e con vincolo kcal (bilanciamento). Pesi/tolleranza in
  config. Con questo il **nucleo v1 del motore è completo** (esclusioni+sostituzione+learning+selezione).
  1 test nuovo, suite 294 verde.
- `[Sviluppo]` **Backoffice — pagina Chat + auto-riparazione permessi** — nuova pagina `Chat.tsx`
  (staff↔cliente: elenco conversazioni, messaggi, invio) + voce di menu (chiave `chat`) + rotta.
  Risolto anche il problema "sezioni non nel menu" (es. Parametri): `PermissionsService.syncDefaults`
  gira all'avvio e crea le righe permessi mancanti dai default (senza sovrascrivere le modifiche admin),
  così le sezioni aggiunte dopo il seed ricompaiono. Audit menu↔permessi registrato in STATO. Suite 293.
- `[Sviluppo]` **Fase 5 (parte 3) — Learning: esito ciclo + MenuWeight** — nuovi modelli `CycleFeedback`
  (esito peso/cm per ciclo di 2 giorni) e `MenuWeight` (efficacia appresa per ricetta/cliente) +
  migrazione (validata PG16) + soglie config. `DietLearningService.onCycleClose` (trigger da
  `signals.upsertMeasurement`): calcola delta peso/cm vs misura precedente, determina l'esito, e se il
  ciclo è stato seguito aggiorna i MenuWeight delle ricette del ciclo (attribuzione naive). 4 test nuovi,
  suite 292 verde. Manca la selezione per efficacia+gradimento (sostituirà i template fissi).
- `[Sviluppo]` **Fase 5 (parte 2) — Sostituzione equivalente** — se un ingrediente escluso ha un
  sostituto sicuro (mappa: yogurt→senza lattosio, pane→senza glutine, funghi→cavolfiore…) il piatto si
  eroga con la **nota di sostituzione** salvata nello snapshot del pasto e mostrata in Menu; il blocco
  scatta solo se un'intolleranza NON è sostituibile. I cibi non graditi (`dislikedFoods`) si sostituiscono
  ma non bloccano. 2 test nuovi (blocco non-sostituibile / erogazione con sostituzione), suite 288 verde.
- `[Sviluppo]` **Fase 5 (parte 1) — Sicurezza esclusioni (motore menu)** — prima dell'erogazione i piatti
  del ciclo vengono controllati contro le **intolleranze/allergie** della cliente (mappa
  intolleranza→ingredienti, es. lattosio→yogurt/formaggio): se un piatto è incompatibile, il menu NON
  viene erogato e si apre un'**escalation "Piano bloccato" al nutrizionista** (la coach la vede via Alert
  engine, `escalation_open`). `GET /me/menu` ora espone `blocked{active,reason}` e l'app Menu mostra il
  banner "stiamo sistemando il tuo piano". Sostituzione equivalente e giornate/learning = prossimi passi.
  1 test nuovo, suite 287 verde.
- `[Sviluppo]` **App cliente — box "Prossimo appuntamento" in Home** — nuova card nella Home che legge
  `GET /me/agenda?next=1` e mostra tipo/interlocutore/data del prossimo appuntamento; tap → Calendario.
  Type-check app verde.
- `[Sviluppo]` **Fase 4 (parte 3) — Riassunti conversazioni** — nuovo modello `ConversationSummary`
  (titolo AI + data, FK-less) + migrazione (validata PG16). `AiService.summarizeConversation` (titolo
  breve + una frase, con fallback deterministico). `ConversationSummaryService.generateDailyBatch`
  (chiude i thread con messaggi del giorno, upsert per cliente/interlocutore/data) agganciato al cron.
  Endpoint `GET /me/threads/:who/summaries` (cliente) e `GET /staff/threads/:clientId/:who/summaries`
  (staff, con scope; la coach non vede i riassunti col nutrizionista). 4 test nuovi, suite 286 verde.
  Con questo il backend della Fase 4 è sostanzialmente completo.
- `[Sviluppo]` **Fase 4 (parte 2) — Agenda e appuntamenti** — nuova entità `Appointment` (FK-less) +
  migrazione (validata PG16). `GET /coach/agenda` (appuntamenti futuri delle clienti: i propri
  gestibili, quelli col nutrizionista in sola lettura), `POST /appointments` (coach/nutrizionista solo
  per i propri clienti, con validazioni tipo/data), `PATCH /appointments/:id` (solo il proprietario),
  `GET /me/agenda` lato cliente (appuntamenti + scadenza piano; `?next=1` = solo il prossimo, per la
  Home). 7 test nuovi, suite 282 verde.
- `[Sviluppo]` **Fase 4 (parte 1) — App Coach: clienti + dashboard** — nuovo modulo `coach` con
  `GET /coach/clients` (lista clienti assegnate: nome, stato piano, ultima misura, alert aperti,
  ordinata per alert) e `GET /coach/dashboard` (conteggio clienti, piani in scadenza entro
  `expiring_plan_days`, guadagni mese/totale dal ledger, alert aperti). Riusa i guadagni dal
  ledger e l'Alert engine. 4 test nuovi, suite 275 verde. Restano agenda/appuntamenti, chat e
  riassunti conversazioni.
- `[Sviluppo]` **Fase 3 — Alert engine** — nuovo modello `Alert` (coda coach, FK-less) + migrazione
  `alert_engine` (validata PG16) + soglie in config. `AlertsService.recompute(clientId)` sincronizza gli
  alert dai segnali reali (missing_measurements, weight_gain, plateau, inactive, checkin_skipped,
  water_low, low_ratings, dropout_risk, event_incoming, escalation_open, milestone), idempotente e
  auto-risolve quelli non più validi. Endpoint `GET /coach/alerts` (scope coach/manager, ricalcolo lazy)
  e `PUT /alerts/:id` (handled/escalated). Ricalcolo giornaliero nel cron. Refactor Fase 2: il
  `missing_measurements` ora è un Alert vero (rimosso l'avviso via Notification). Suite 271 verde.
- `[Sviluppo]` **Diario di progetto** — creata la cartella `progetto/` (STATO, REGISTRO, README,
  ISTRUZIONI_PER_AI, PROMPT_PER_AI_SOCIO) come
  fonte di verità condivisa; aggiunti al repo i documenti Guida Pubblicazione, Standard CRM/Marketing,
  Schermate Nuovo Cliente. (Nota: il diario sta fuori da `docs/` perché `docs/` è pubblica.)
- `[Prodotto]` **Documenti** — inviati: Guida alla pubblicazione (demo GitHub Pages + deploy produzione),
  Reparto Marketing & Standard CRM (ruolo `head_marketing`, stadi lead, campi, consensi), Schermate
  Nuovo Cliente (sequenza), Punti di forza marketing.
- `[Sviluppo]` **Fase 2 — Misure bloccanti** — l'erogazione del menu richiede la misura del ciclo
  corrente prima di consegnare il ciclo successivo (altrimenti "held"); avviso alla coach
  `missing_measurements` (via Notification); `GET /me/measurement-gate`; sblocco automatico al
  `POST /me/measurements`; popup bloccante nell'app. 6 test nuovi, suite 263 verde. Nessuna migrazione.
- `[Sviluppo]` **Fase 1 — Tracciamento eventi** — modello `AnalyticsEvent` (append-only, idempotente),
  migrazione `analytics_event` (validata su PG16), modulo `tracking` con `POST /api/v1/events` (utente
  dal JWT se presente, sessione+refcod pre-login); client `track()` nell'app (viste, login, register con
  attribuzione refcod, logout). Fix build: campo Json `data` castato `as never` (errore TS su Render).
  7 test nuovi.
- `[Sviluppo]` **Widget su git** — set completo del widget a 3 formati (mascotte Gaia) versionato in
  `docs/android-widget/`; rimozione file spurio `ziSIv8Rd`.
- `[Prodotto]` **Prototipi & docs** — redesign app cliente (nav a icone, header gradiente, 5 sezioni,
  pagina "In cosa siamo diversi"), nuovi prototipi Coach/Nutrizionista, rigenerate le voci Gaia,
  aggiunti 10 documenti di analisi (motore, agente AI, certificazione, mercato, marketing, tracciamento).

## 2026-07-11

- `[Sviluppo]` **Widget home Android** — token widget dedicato (scope widget, 90gg) + endpoint pubblico
  `GET /widget` + file nativi; poi rifatto a 3 formati con la mascotte reale.
- `[Sviluppo]` **AI Claude collegata** — assistente chat con Claude + parametro `ai_assistant_enabled`.
- `[Sviluppo]` **Backoffice** — editor Diete (crea + componi giorni), Ricette (`PATCH /recipes/:id`),
  Protocolli (`PATCH /protocols/:id`); moduli dashboard trascinabili; grafici con assi mesi + tooltip.
- `[Sviluppo]` **App** — Home con dati reali (nome coach, CTA consigli), grafici Obiettivo con date +
  tooltip; guard account staff nell'app cliente (onboarding solo per i clienti).
- `[Sviluppo]` **APK** — progetto Android pronto, build da Android Studio; fix CORS per login da APK
  (origini native `https://localhost` / `capacitor://localhost`).

## Prima dell'11/7 (fondamenta)

- `[Sviluppo]` Backend API-first `/api/v1`: auth JWT+RBAC, onboarding, misure/obiettivi, catalogo,
  erogazione menu, motore a regole (M5), notifiche, CRM/commerce, permessi. Test verdi.
- `[Prodotto]` Prototipo navigabile app cliente, sequenza schermate, specifiche backend, analisi.


## 15 lug — notte (lavoro non presidiato)
- **Sito**: aggiunto blocco SEO/social (canonical, robots, theme-color, OG, Twitter, JSON-LD Organization) + lazy-load su 12 immagini in `Metabole_Sito_Presentazione.html`. Da ricaricare su SiteGround.
- **Diagnosi tasto Genera/anteprima mail**: codice presente e pushato (commit a51cbaa su origin/main); il backoffice live serve una build Vercel vecchia. Serve redeploy/verifica su Vercel (progetto metabole-backoffice). Dettagli in `progetto/BRIEF_MATTINA_20260715.md`.
- **pages.ts**: admin → engine_rules { view, manage } (da committare).
- Rimosso index.lock git bloccato (spostato in `_to_delete/`).
