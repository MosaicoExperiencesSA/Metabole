# Decisioni di Simone — 13 agosto 2026

Scritte **prima** di toccare il codice. Una decisione presa non si ri-discute la settimana prossima,
e chi legge trova il perché senza dover ritrovare la conversazione.

---

## 1. Le allergie: chi le modifica ✅ DECISO

**Domanda di Simone.** «Nella scheda cliente e scheda lead il nutrizionista li deve leggere e poter
modificare, magari mettiamo l'impostazione nei permessi.»

**Risposta: permesso dedicato `change_allergies` («Modifica allergie»).** Di default a
`nutritionist`, `head_nutritionist`, `admin`.

⚠️ Flag suo e **non** «Clienti: gestisci», che ce l'ha anche la coach: un'allergia è un blocco duro,
e chi ne toglie una decide che da domani quella cliente può trovarsi quell'alimento nel piatto.

**Le intolleranze restano dove sono** (già dentro «Clienti: gestisci», già modificabili anche dalla
coach): restringerle sarebbe una perdita di capacità che nessuno ha chiesto.

**Fatto il 13/8.** Scheda cliente e scheda lead, che scrivono dallo **stesso** endpoint.

---

## 2. `'other'` fra le intolleranze ✅ DECISO

**Simone:** «`'other'` si toglie solo se lei ha detto cosa — sì esatto.»

Se ha spuntato «Altro» senza compilare il campo — o se il questionario arriva da un'app vecchia —
la stringa `'other'` **resta**. È inutile per i menu, ma è l'unica traccia del fatto che c'è
qualcosa che non sappiamo, ed è così che si trova chi ricontattare.

**Fatto il 13/8**, insieme alla colonna `intolerancesOther` e al campo nel questionario.

---

## 3. ⚠️ Il via libera clinico: come la nutrizionista dice «può proseguire» ✅ DECISO

**Domanda di Simone.** «Se poi metti Visita obbligatoria e la nutrizionista decide che la cliente può
proseguire, come fa a dircelo? Questo succede per tutte le persone in percorso, parte il messaggio
sorveglianza sanitaria ma lei come fa a dirci ok può proseguire?»

### Cosa c'era già, e perché non bastava

Il canale esiste: chi dichiara patologie o farmaci nel questionario fa nascere una **segnalazione**
(`source: 'screening'`, `category: 'clinical'`) assegnata alla nutrizionista, che la chiude dalla sua
coda. E dall'11/8 c'è `escalations/riapertura.ts`, la regola «se ha risolto basta fino a nuova
segnalazione».

Tre motivi per cui, da solo, non risponde alla domanda:

1. ⚠️ **La tregua dura 14 giorni, poi la segnalazione si riapre.** Per il calo peso è giusto — quella
   condizione può peggiorare. Per «ha un'allergia, serve la visita» no: **un'allergia non passa, e il
   via libera non scade su un timer**. Al quindicesimo giorno ricomparirebbe identica, e a quel punto
   le segnalazioni smettono di voler dire qualcosa (è la lezione già scritta in `riapertura.ts`).
2. ⚠️ **«Risolta» non dice cosa ha deciso.** Registra uno stato e una data: non se ha visitato la
   cliente, se aspetta un certificato, o se ha deciso che la visita non serve. Fra un mese quella
   distinzione non è più ricostruibile.
3. ⚠️ **Il flag `richiedeVisita` del §8 dell'handoff è derivato** («allergie non vuote e nessuna
   visita registrata»): chiudere la segnalazione non lo spegne, quindi si riaccenderebbe da solo per
   sempre.

### Risposta: un pulsante «Idonea a proseguire» sulla scheda cliente

Una **decisione scritta sulla cliente**, non una segnalazione chiusa:

- **cosa** ha deciso — `idonea` oppure `serve_visita`;
- **chi** l'ha decisa e **quando**;
- una **nota** libera (facoltativa).

⚠️ **Non scade.** È il punto della decisione: una valutazione clinica vale finché non arriva un
fatto nuovo, non finché non scadono quattordici giorni.

⚠️ **Un gesto solo, non due.** Quando decide, le segnalazioni cliniche aperte su quella cliente si
chiudono **da sé**: se dovesse fare la stessa cosa in due posti, prima o poi ne farebbe una sola —
e la coda tornerebbe a riempirsi di casi già visti.

⚠️ **Vale per tutta la sorveglianza sanitaria, non solo per le allergie.** Era già la domanda di
Simone: lo screening del questionario parte per chiunque dichiari patologie o farmaci. Un via libera
che risponde solo alle allergie lascerebbe l'altra metà del problema esattamente com'è.

### E nel frattempo: NESSUN BLOCCO

**Il percorso e i menu continuano.** La cliente compare nella coda della nutrizionista con il motivo,
e nella scheda si legge «visita da fare».

⚠️ È la parte su cui l'handoff insiste (§8), e vale la pena tenerla scritta: bloccare l'erogazione
vorrebbe dire **sospendere piani attivi a clienti paganti** per un campo introdotto oggi — e su chi è
già in percorso sarebbe una sospensione di massa il giorno del rilascio. Il blocco, se sarà blocco,
si aggiunge dopo, in una consegna sua, quando è chiaro cosa succede a chi è già dentro.

### Cosa resta fuori da questa decisione

- ⛔ **Quando far partire il «serve la visita» in automatico** (allergia dichiarata → richiesta di
  visita) è materia clinica: lo decide Nocanty. Qui si costruisce il **modo di rispondere**, che
  serve comunque e non dipende da quella soglia.
- ⛔ Il testo che la cliente legge in app resta per la OTA.

---

## 4. Il filtro «solo da valutare» nell'elenco Clienti ✅ DECISO

**Scelta di Simone (13/8, pomeriggio):** fra i lavori pronti, prima questo.

La pastiglia «da valutare» è stata consegnata stamattina, ma da sola **non fa risparmiare
un'apertura di scheda a nessuno**: con 315 clienti in pagine da 100, per trovare quelle in coda
bisogna scorrere l'elenco con l'occhio. Una coda che si legge scorrendo è una coda che si guarda
il primo giorno.

### Le tre scelte dentro questa, e come sono state sciolte

1. **Dove sta il comando.** Non nella riga dei filtri di colonna — «da valutare» non è una colonna,
   la pastiglia vive dentro la cella del nome — ma un **interruttore nella barra in alto**, accanto
   alla ricerca, e **solo nella pagina Clienti**: in «Gestione lead» un contatto senza cliente
   collegata non può essere «da valutare», e un filtro che non toglie mai niente insegna solo a
   diffidare dei filtri.
2. **`serve_visita` resta fuori**, come nella pastiglia e nella scheda. Chi ha già una decisione non
   torna in coda: è tutta la differenza con la segnalazione che dopo quattordici giorni si riapriva.
3. **Il filtro si applica al database, non alla pagina.** Filtrare le 100 righe già scaricate darebbe
   un totale sbagliato in cima e un'esportazione in Excel che dichiara filtri che non ha applicato.

### ⚠️ La regola finisce scritta due volte, e questa volta è inevitabile

`daValutare()` è una funzione che guarda **una** cliente; un filtro che pagina e conta deve diventare
una condizione che Postgres sa leggere. Sono due espressioni della stessa regola, e il modo in cui
questa coppia muore è che una delle due cambi da sola.

Quindi: le due stanno **nello stesso file** (`clients/idoneita.ts`), una sotto l'altra, e un test le
mette a confronto **caso per caso** — se qualcuno domani aggiunge un motivo per essere valutate e lo
scrive in una sola delle due, il test diventa rosso invece di lasciare la nutrizionista con un elenco
che non contiene tutte le sue.

---

## 5. La pagina «Lavori» nel backoffice ✅ DECISO

**Richiesta di Simone (13/8):** «sarebbe fantastico se in app avessi una pagina con modifiche
implementazioni con elenco dei lavori da fare e una volta fatto mettiamo la spunta, magari così è
tutto registrato ed evidente. Visibile solo ad admin.»

**Dove:** nel **backoffice**, non nell'app. Due motivi: è dove guardi già le liste, e ogni modifica a
una schermata dell'app costa una OTA e un numero di versione che non si riusa.

**Cosa contiene all'inizio:** la carico io da quello che è già scritto nei documenti —
`metabole-backlog.md`, `DA_RIPRENDERE_20260813.md`, le decisioni aperte. Oggi quell'elenco vive in
cinque file diversi e in tre teste; il valore della pagina non è la spunta, è **avere un posto solo**.

**La spunta registra chi e quando**, e le voci fatte **non spariscono**: restano in fondo, con la
data. Una lista in cui il fatto sparisce risponde a «cosa resta» e non a «cosa è stato fatto» — e la
seconda è la domanda che ti fai quando qualcuno chiede a che punto siamo.

### ⚠️ Tre cose decise dentro questa, che valgono più della pagina

1. **Il permesso è una chiave della matrice, non `@Roles('admin')` scritto nel codice.** Il commento
   in testa a `permissions/pages.ts` racconta il difetto già successo: `assignments` era una chiave
   accesa nella tabella dei permessi che **non apriva niente**, perché l'endpoint era inchiodato
   all'admin. Qui la chiave nuova (`dev_backlog`) nasce **insieme** alla guardia che la legge, con
   default **solo admin**: oggi la vedi solo tu, e il giorno che vuoi darla a qualcuno si accende
   dalla tabella invece di rifare un rilascio.
2. **Togliere la spunta cancella chi e quando.** Se restassero, una voce riaperta continuerebbe a
   dire «fatta da Simone il 13/8» mentre è da fare: è il tipo di riga che fa perdere fiducia in
   tutta la lista.
3. **Chi aspetta cosa non è un campo, è la categoria.** Metà delle voci aperte non aspettano codice
   ma una decisione clinica di Nocanty o un tuo deploy. Vanno in due categorie loro
   («Aspetta Nocanty», «Aspetta Simone»), perché in un elenco misto sembrano tutte lavoro fermo.

### Aggiunte in corsa (13/8, richieste di Simone mentre si scriveva)

- **Tre colori, e una regola sola che li sceglie.** Verde = fatto, giallo = in attesa di qualcuno,
  rosso = **blocca altro lavoro**. ⚠️ Il rosso non è «importante»: è *«finché questa non si chiude,
  quelle non partono»* — altrimenti in un mese diventa tutto rosso e il colore smette di dire niente.
  Per questo `blocca` è un campo suo e non si deduce dalla categoria: chi lo accende sta dichiarando
  che c'è una fila dietro.
- **Tutto lo storico dentro.** Le 481 voci del `REGISTRO.md` (dall'11/7 a oggi) entrano già spuntate,
  con la loro data e la squadra che le ha scritte. ⚠️ Sono un **estratto**, non una copia: il
  registro resta la fonte, la pagina ne è l'indice. Chi vuole il dettaglio vero apre il registro —
  ed è scritto nella pagina, perché una copia parziale che si crede completa è peggio dell'assenza.
