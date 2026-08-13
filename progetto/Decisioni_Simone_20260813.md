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

---

## 6. Le schermate dell'app 28-30: due decisioni che tolgono lavoro ✅ DECISO

Erano nella lista come «servono decisioni». Guardando il codice, una era già stata decisa e l'altra
non ha più il problema per cui era nata.

### 6.1 I video di coach e nutrizionista (28-29): restano annullati

Non è una decisione nuova: **l'avevi già presa il 17/07** ed è scritta in `metabole-backlog.md` —
«il video di presentazione della coach NON si fa». Il codice è d'accordo: nell'app non c'è nessun
player e in `Staff` non esiste nessun campo video.

⚠️ Era rimasta nella lista dei lavori come se fosse un arretrato. Ora è scritta come **decisione**,
e nella pagina Lavori non compare: una decisione presa che continua a girare fra le cose da fare
costa due volte — la prima quando la si ridiscute, la seconda quando qualcuno la fa.

### 6.2 L'«assaggio del menu» (30): non si fa, l'ha superato «Conosciamoci»

La schermata nasceva come vetrina **prima del paywall**: mostrare un piatto a chi non aveva ancora
pagato. Dall'11/8 quel paywall non c'è più — finito il questionario parte «Conosciamoci» in
automatico e la cliente ha un menu **vero**, gratis, per otto giorni. Un assaggio finto davanti a un
menu vero è una schermata in più fra lei e la sua app.

**Il dubbio che restava — e perché non regge.** Chi sceglie una data di inizio lontana non vede il
menu fino a due giorni prima (`menu_visible_days_before_start`). Ma l'app non tace: `MenuStatusBanner`
nello stato `scheduled` dice *«Il tuo piano parte il … e il menu si sblocca il … — due giorni prima,
così hai tempo per la spesa»*, e la invita a chiedere a Gaia se vuole spostare la data. Sa quando,
sa perché, e ha una strada per cambiare idea: è più di quanto darebbe un assaggio.

**Se un giorno la si rifacesse**, la forma è decisa: **una giornata vera costruita col motore sul suo
profilo** — colazione, pranzo, cena e spuntini, la stessa logica dei menu veri. ⚠️ E se il motore non
ce la fa (dieta non ancora assegnata, pool magro) **non si mostra niente**: un assaggio inventato a
mano è esattamente la cosa che il resto del prodotto evita.

---

## 7. Dopo la conta: si fa il §7, e le tre da codificare vanno a Lucia ✅ DECISO

**I numeri veri (13/8, `npm run conta:allergie` su produzione).** 48 clienti attive con profilo:
0 intolleranze ignote · **3** allergie da codificare · **24** che non hanno mai risposto · 21 a posto.

⚠️ **24 su 48 è esattamente metà, e l'avviso dello script non è partito per una persona**: la soglia
era `> 50%`. Corretta in «almeno la metà» (`p3 * 2 >= vive`). Un allarme che tace proprio quando il
numero è così brutto da venire tondo non serve a niente: chi legge conclude «sono solo ventiquattro».

**Cosa dice davvero quella metà**: non è distrazione delle clienti, è la pagina del questionario che
non raccoglieva. La correzione è viva dal 13/8 — l'opzione «Non ho allergie» arriva dal server,
quindi la vedono anche le app non aggiornate, e chi risponde viene timbrata. Il numero deve smettere
di crescere da solo; si rimisura con lo stesso comando.

### 7.1 Il §7 si fa, completo ✅ DECISO

**Scelta di Simone**, sapendo che la popolazione è di 24 persone e che la falla a monte è già chiusa.
L'alternativa in campo era il filtro nel backoffice con la coach che chiede a voce; è stata scartata.

⚠️ Quindi il flusso in chat va costruito per **durare**, non per svuotare una lista di ventiquattro
nomi: è la strada con cui si chiederà una cosa a una cliente ogni volta che serve, e la sua vera
prova non è quante ne recupera questa settimana.

Vincoli già decisi e non ridiscutibili (dall'handoff §7.2, verificati in codice):
- si copia **`data-inizio-chat`**, non «Conosciamoci»;
- lo stato vive nel `meta` dell'ultimo messaggio di Gaia, **uno solo alla volta**: la chiave nuova è
  la terza e va messa nell'ordine di precedenza;
- ⚠️ **scade dopo un'ora**: chi apre la notifica il giorno dopo trova un dialogo **riaperto**, non
  ripreso;
- ⚠️ niente pulsanti in chat: parser tollerante e **due tentativi, poi passa alla coach**;
- ⚠️ le risposte libere **si propongono e si fanno confermare**, mai salvate come arrivano; quello
  che non si riconosce va in `allergiesOther` e lo codifica la nutrizionista (*nel dubbio non si
  impara*);
- dato sanitario: **transazione + `audit.log`**, non la forma semplice;
- la notifica manda **fatti** nel payload, e «gliel'ho già chiesto» si legge dalla notifica stessa;
- lo script della campagna parte in **prova**, scrive solo con `CONFERMA=1`, e usa la **stessa**
  funzione della conta (`common/da-ricontattare.ts`).

### 7.2 Le tre da codificare: nota per Lucia ✅ DECISO

Le corregge lei dalla scheda cliente (permesso `change_allergies`, consegnato il 13/8). La nota è in
`progetto/NOTA_Lucia_Allergie_Da_Codificare.md`.

⚠️ Il fatto che rende la cosa urgente e che nessuno aveva ancora messo per iscritto: **due di quelle
tre esclusioni oggi non escludono niente.** «Favismo» e «Carboidrati» non compaiono in nessun nome di
piatto né in nessun ingrediente, quindi la ricerca testuale non trova nulla — è lo stesso difetto di
`frutta_a_guscio` dell'8/8, ma qui il termine non è traducibile da noi: va tradotto da lei.

---

## 8. Quando comanda l'efficacia e quando comandano le stelle ✅ DECISO

**Risposta di Simone dalla pagina Lavori (13/8):** «se abbiamo un problema di umore vincono le 5
stelle; se il problema è il peso che non scende o che è aumentato vince l'efficacia».

Non è la manopola che aspettavamo — è meglio: **una regola che cambia da sola** in base a cosa sta
succedendo a quella cliente. La manopola (`menu_select_w_eff`) resta dov'è, per chi vuole spostare
l'ago in generale; questa decide **chi comanda oggi**.

### 8.1 «Il peso non scende» = tre pesate consecutive ✅ DECISO

Non tre settimane: **tre pesate registrate di fila**, nessuna più bassa della precedente. Si aggancia
a quando la cliente si pesa davvero, non al calendario.

⚠️ **Soglia secca, scelta da Simone:** conta solo *fermo o salito*. Un calo di cinquanta grammi
azzera il contatore.
**Conseguenza da sapere adesso e non fra un mese:** chi cala pochissimo ma di continuo **non fa mai
scattare l'efficacia**. È il caso «sto dimagrendo pianissimo», e con questa regola resta com'è. Se un
giorno risultasse che è proprio quella la cliente da intercettare, si cambia la soglia — non il
meccanismo.

⚠️ **Cambia il segnale, non lo stato.** Lo stato `plateau` esiste già e già spinge sull'efficacia: da
oggi si accende su **tre pesate** invece che su **due cicli** (`agent_plateau_cycles`). Due regole per
la stessa domanda sono la cosa che questo progetto passa il tempo a togliere: la vecchia sparisce.

### 8.2 Quando ci sono tutti e due: vince l'efficacia, ma resta un giorno ✅ DECISO

Umore basso **e** tre pesate ferme insieme: comanda l'efficacia, e **un giorno a settimana** vincono
le stelle.

⚠️ Il motivo del giorno: togliere ogni piatto amato a chi sta già giù di morale è il modo più rapido
per farla smettere del tutto — ed è la lezione già scritta nello stato «conforto». Il piano deve
tornare a funzionare, ma non contro di lei.

**Il giorno è la domenica**, per tutte. Non a rotazione e non calcolato: un giorno fisso lo si può
dire a voce alla cliente («la domenica vincono i piatti che ami») e la coach può ricordarselo. Un
giorno che si sposta con la data di inizio del piano sarebbe invisibile a tutti e due.

---

## 9. La scala dei passi ✅ CONFERMATA

**Simone (13/8): sì.** 6.000 sedentaria → 12.000 molto attiva, +5% ogni due settimane, tetto +40%.

⚠️ Il codice **c'era già** (`common/obiettivo-passi.ts`, scritto il 12/8) e aspettava solo questa
riga: quello che cambia è che l'avvertenza «da confermare con Nocanty» in testa al file non è più
vera, e va tolta — un file che dichiara di aspettare un permesso che è arrivato fa fermare la
prossima persona che lo legge.

**Il caso clinico invece non si calcola**: per chi ha problemi cardiaci, articolari o è in
gravidanza, la base la chiede la nutrizionista **attraverso Vera** (risposta di Simone). È lo stesso
canale delle allergie che non sappiamo tradurre — vedi `CONTRATTO_Vera_Richieste.md`.

---

## 10. La tabella dell'indice glicemico del capo nutrizionista ✅ DECISO

**Simone (13/8):** «questo elenco va caricato e confermato di default: lo ha preparato il capo
nutrizionista.»

Il PDF (Linus Pauling Institute / International Tables 2008) porta ~94 alimenti con indice glicemico
(valore, minimo, massimo, affidabilità), macro per 100 g, stato (crudo/bollito/cotto/essiccato) e
fonte.

⚠️ **Si incastra senza migrazione**: `NutrientFact` ha già `glycemicIndex`, `glycemicIndexMin`,
`glycemicIndexMax`, `glycemicIndexReliability`, `state`, `source` e i valori per 100 g. Non è un
formato da inventare: è quello che aspettava dei dati.

**«Confermato di default»** vuol dire `verifiedById` = il capo nutrizionista e `verifiedAt` valorizzati
all'import: in `NutrientFact` «vuoti = da confermare», quindi caricarli senza firma li lascerebbe in
una coda di verifica che nessuno ha chiesto.

⚠️ **La trappola da non ignorare: crudo o cotto.** La tabella dà la pasta **bollita** (158 kcal/100 g),
non cruda (~350). Se una ricetta dettata dice «80 g di spaghetti» intendendo il peso a crudo, il
conto esce sbagliato di due volte e mezzo. Per questo la colonna `state` va importata e usata, e
l'ambiguità va risolta **prima** di far dipendere le ricette da questi numeri — è il lavoro
`vera-ricetta-crudo-cotto`, che era già in lista e adesso ha un motivo urgente.

---

## 11. I solfiti: l'elenco è arrivato ✅ DECISO

**Simone (13/8), rispondendo alla voce rossa in pagina Lavori:** «ti ho passato il file».

Il file è la tabella della nutrizionista — *I solfiti negli alimenti*, Reg. UE 1129/2011 e 1169/2011 —
con le categorie e i limiti massimi. Da lì escono le parole, categoria per categoria: frutta essiccata
(2000 mg/kg, il limite più alto di tutti), vino (150-235), aceto di vino e di mele (170), ortaggi
sott'olio e in salamoia (100-500), crostacei freschi e congelati (150-300), pesce essiccato e salato
(200), patate disidratate (400), succhi concentrati (350), senape (250-500).

⚠️ **Due voci sono larghe, e la decisione di tenerle va saputa.** `aceto` toglie quasi ogni insalata
condita e buona parte dei sughi; `biscotti` — che la tabella dà a 50 mg/kg, il limite più basso —
toglie l'intera colazione dolce. Sono nella tabella, quindi ci sono; ma nel codice stanno **su due
righe separate con il loro commento**, così se Lucia dice che è eccessivo si tolgono quelle due e
basta, senza rimettere mano all'elenco.

⚠️ **Cosa NON entra, ed è la parte più importante**: «uva» (l'uva fresca non ha solfiti, l'uvetta sì),
«patate», «pomodoro», «limone». Un divieto sui solfiti che porta via l'insalata di pomodoro non
protegge nessuno: fa smettere di fidarsi dell'elenco, e a quel punto qualcuno lo disattiva. Nel test
c'è un blocco intero dedicato a **quello che non si toglie**.
