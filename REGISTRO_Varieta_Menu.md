# Menu ripetitivi — perché succedeva e cosa è cambiato

Segnalazione: la cliente `patty_moren51@yahoo.it` (Pescetariana, livello 1) lamenta una dieta molto
ripetitiva. Il reclamo è fondato: dal pannello backoffice, colazione **identica per tre giorni di
fila** due volte di seguito (Frittata spinaci e feta dall'1 al 3 agosto, poi Salmone affumicato e
cream cheese dal 4 al 6), e cena ripetuta a coppie, mentre il pranzo cambiava ogni giorno.

## Perché

Tre cause che si sommano, tutte nel motore di composizione dei menu.

**1. La penalità di ripetizione era spenta in produzione.** Nello scoring esiste da sempre un
termine `− penalità × volte_servita_di_recente` che dovrebbe far scendere in fondo alla lista un
piatto appena mangiato. Il parametro `menu_penalty_repeat` è però seminato a `0`, e il seed — per
scelta, così da non sovrascrivere le personalizzazioni dell'admin — aggiorna solo la descrizione dei
parametri già esistenti, **mai il valore**. Risultato: il termine anti-ripetizione non ha mai avuto
effetto su nessuna cliente, dal primo giorno.

**2. I punteggi sono statici e quasi pari.** Una ricetta senza valutazioni prende il gradimento
massimo (5 stelle → 1,0); appena la cliente ne vota una con 3 stelle quella scende a 0,6. Con
l'efficacia appresa quasi sempre a zero, per ogni pasto esiste **un vincitore fisso**, e lo resta
finché non arriva una nuova valutazione. Questo spiega anche lo scalino del 4 agosto: le 3 stelle
date alla frittata tra l'1 e il 3 l'hanno fatta scendere sotto il salmone, che da quel momento si è
insediato al suo posto — ripetendosi a sua volta per tre giorni.

**3. Il compositore ruotava solo tra le prime 3 combinazioni.** `DayComboService` ordina le
giornate possibili per punteggio e prende `valid[dayIndex % 3]`: le prime tre combinazioni però
condividono quasi sempre lo stesso vincitore nei pasti "stretti" (la colazione, dove il pool è più
piccolo) e differiscono solo dove il pool è largo (il pranzo). Da qui il quadro osservato: pranzo
vario, colazione e cena immobili. La modifica recente sul "menu a necessità" ha esteso l'uso del
compositore a tutte le clienti, sostituendo la rotazione per template — che una sua varietà
intrinseca ce l'aveva — con questa selezione a punteggio.

## Cosa è cambiato

**Penalità accesa di default.** `menu_penalty_repeat` passa da 0 a 1 nel seed e nel catalogo delle
regole motore: una ricetta già servita nella finestra recente passa dietro a una mai servita.

**I piatti scelti contano subito.** I due giorni erogati insieme venivano composti con punteggi
identici, quindi ripetevano le stesse scelte. Ora ogni piatto scelto viene marcato come "servito"
(`bump`) e i punteggi si **ricalcolano a ogni giorno** del ciclo, non una volta sola all'inizio.

**Garanzia dura di varietà.** Nuovo parametro `menu_variety_min_gap_days` (default 2): lo stesso
piatto non torna nello stesso pasto prima di quel numero di giorni, **se** il pool della dieta offre
un'alternativa entro la tolleranza kcal. Il vincolo di bilanciamento resta prioritario: se
l'alternativa non c'è, il piatto resta e nessun equilibrio viene forzato. Il guard tiene conto anche
dei giorni **già erogati**, non solo di quelli in composizione, e impedisce lo stesso piatto due
volte nella stessa giornata. Con `0` il comportamento torna quello storico.

Il parametro è regolabile dal backoffice in "Regole motore" e sovrascrivibile **per dieta**.

## Come verificare e come accendere in produzione

Dalla Render Shell, nella cartella `backend`:

    npm run diag:varieta -- --email=patty_moren51@yahoo.it

È in sola lettura. Stampa i parametri attivi (segnalando la penalità spenta), i piatti serviti per
ogni pasto negli ultimi 30 giorni con la serie più lunga dello stesso piatto di fila, e soprattutto
l'**ampiezza del pool**: quante alternative la dieta approvata mette a disposizione per ogni pasto.
Questo terzo dato è quello decisivo — se una dieta ha tre sole colazioni, nessun algoritmo può
produrre varietà e la risposta è aggiungere ricette, non cambiare parametri. Senza `--email` fa il
quadro di flotta: le venti clienti col menu più ripetitivo.

Poi, per accendere la varietà sui parametri live (il seed non lo può fare):

    npm run fix:varieta              # anteprima, non scrive nulla
    npm run fix:varieta -- --apply

Porta `menu_penalty_repeat` da 0 a 1 solo se è rimasto il valore seminato (mai personalizzato dal
backoffice), crea `menu_variety_min_gap_days` = 2 se manca, e segnala eventuali override per dieta
che spengono la varietà. Le giornate già erogate non si toccano: l'effetto si vede dal ciclo
successivo. Conviene rilanciare la diagnostica dopo qualche giorno per confrontare.

## Secondo giro: cosa ha rivelato la diagnostica in produzione

Lanciata la diagnostica sulla cliente è emerso un fatto che il reclamo non lasciava intuire:
**molti piatti erogati non vengono dalla dieta** — 16 su 24 pasti. Nel pool della "Pescetariana"
livello 1 ci sono solo pesce, legumi e verdure, ma nei suoi menu comparivano petto di pollo,
pancetta di maiale, bistecca di vitello e manzo. Il pranzo mostrava addirittura 6 piatti distinti
a fronte di 5 alternative disponibili: impossibile, se i piatti venissero dai template.

**Da dove arrivano.** Dopo la composizione ci sono passaggi che *riscrivono* i pasti pescando
dall'intero catalogo filtrato per **regime della cliente**, non dal pool della dieta. La dieta
"Pescetariana" è però registrata con `regime = omnivore` (lo schema prevede il valore
`pescetarian`), quindi quei passaggi considerano legittima qualsiasi carne.

### Correzione di rotta: la causa non era quella che avevo scritto

Nel primo giro avevo indicato come colpevole la preferenza "ricette semplici". **La diagnostica
in produzione l'ha smentito**: la cliente ha `preferenza "ricette semplici": no`, e 0 dei 10
piatti fuori pool sono marcati "semplice". Quel passaggio non è mai entrato in gioco per lei.
La correzione fatta ad `applySimplePreference` resta un bug vero — ma non è questo bug.

**Il responsabile è `swapDislikedDishes`**, la sostituzione dei cibi non graditi. È l'ULTIMO
passaggio prima del salvataggio, quindi riscrive tutto ciò che il guard di varietà aveva
appena sistemato. La cliente ha **13 cibi non graditi**: Quinoa, Pesce spada, Tonno fresco,
Fegato, Selvaggina, Poca carne rossa, Rucola, Nasello, Broccoli, Avena, Chia, Orzo, Merluzzo.
Applicati al pool della sua dieta cancellano quasi tutto:

| pasto | pool | eliminati dalle esclusioni | superstiti |
|---|---|---|---|
| pranzo | 5 | 4 (rucola, merluzzo, quinoa, broccoli) | **1** |
| cena | 6 | 2 (rucola, nasello) | 4 |
| colazione | 5 | 1 (avena) | 4 |

Il conto torna con la diagnostica al piatto: 7 pranzi sostituiti su 8, 3 cene su 8. E l'unico
pranzo superstite si salva per un caso — lei ha scritto "Tonno fresco", il piatto si chiama
"Pasta integrale con **tonno** e verdure grigliate", e il confronto è per sottostringa esatta.

Due difetti nello stesso passaggio:

**a) Pescava dal catalogo, non dalla dieta.** La query era `where: { mealSlot, active, regime:
profile.regime }` — l'intero catalogo filtrato per il regime *della cliente* (omnivore). È così
che in un piano di pesce sono finiti pollo, maiale, vitello e manzo.

**b) Sceglieva sempre lo stesso sostituto.** Il candidato era il più vicino in kcal, in modo
del tutto deterministico e senza storico: stesso piatto ogni giorno. Da qui le colazioni
identiche per tre giorni di fila. E mancando l'`orderBy`, a parità di kcal l'ordine delle righe
restituito dal database — che Postgres non garantisce — decideva il vincitore: **è
un'ipotesi, non una certezza**, ma spiegherebbe lo scalino del 4 agosto tra frittata e salmone,
entrambi a 380 kcal.

### Cosa è cambiato nella sostituzione

L'alternativa si cerca **prima dentro il pool della dieta**, senza filtro per regime: il pool è
già la volontà del nutrizionista, e filtrarlo per il regime registrato sulla cliente è proprio
ciò che escludeva i piatti di pesce da un piano di pesce. Solo se la dieta non offre nulla di
accettabile si allarga al catalogo — resta una rete di sicurezza, meglio un piatto fuori pool
che un piatto non gradito. A parità di idoneità si scarta ciò che è già stato servito di recente
in quel pasto, con lo stesso storico usato in composizione. Il tie-break sull'id rende la scelta
stabile a parità di kcal.

### Il limite che nessuna modifica al codice supera

Anche cercando prima nella dieta, **alla cliente resta 1 pranzo utilizzabile su 5**. La dieta
assegnata è incompatibile con la sua lista di esclusioni: nessun algoritmo può produrre varietà
da una sola alternativa. Serve un piano diverso o un pool più ampio, ed è una decisione del
nutrizionista. La diagnostica ora lo dice esplicitamente quando un pasto scende sotto le 3
alternative utilizzabili, e in modalità flotta elenca tutte le clienti nella stessa condizione.

### Un problema di dato, non di codice — e più grande del previsto

Delle 238 diete approvate, **18 si chiamano "Pescetariana" e nessuna è registrata
`pescetarian`**: 7 onnivore, 6 vegane, 5 vegetariane. Non è un refuso isolato ma un problema di
importazione. `pickDiet` le abbina per regime, quindi una cliente onnivora può ricevere un piano
chiamato Pescetariana, e viceversa. La correzione è cambiare il regime della dieta (o il suo
nome) dal backoffice: non è una modifica che il motore possa fare da solo, perché solo lo staff
sa quale dei due campi è quello giusto. La diagnostica ora stampa la tabella completa, ordinata
per numero di clienti coinvolte.

### Una domanda che viene prima del codice

A una cliente con un piano chiamato "Pescetariana" sono stati serviti pollo, pancetta, vitello e
manzo per otto giorni. Se è davvero pescetariana, il problema vero non è la ripetitività che ha
segnalato lei. Vale la pena chiederlo a lei o alla sua nutrizionista **prima** di rilasciare
qualsiasi modifica.

## Test

Le suite del motore menu sono verdi (**61 test**, erano 58). Oltre alla suite sulla garanzia di
varietà, ne ho aggiunta una sulla sostituzione dei non graditi: verifica che il sostituto venga
dal pool della dieta e non dal catalogo per regime (con un candidato del catalogo *più vicino in
kcal*, che quindi vincerebbe se il pool-first non funzionasse), che lo stesso sostituto non torni
due giorni di fila, e che il catalogo resti la rete di sicurezza quando la dieta non offre
alternative. Le tre prove sono state validate rompendo il codice: togliendo il pool-first ne
falliscono due, togliendo lo storico fallisce la terza.

Nota a margine: le suite `menu.service.spec.ts`, `menu-measurement-gate.spec.ts` e
`engine-rules.service.spec.ts` erano **già rosse prima di questo intervento** — i mock non erano
stati aggiornati dopo le misure obbligatorie, il fabbisogno calorico e la generazione catalogo a 28
giorni. Le ho allineate. Restano rosse per lo stesso motivo altre suite non collegate al menu
(auth, crm, commerce): le sistemo in un passaggio dedicato quando vuoi.
