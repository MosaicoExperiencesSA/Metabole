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

## Test

Le tre suite del motore menu sono verdi (56 test). Ho aggiunto una suite dedicata alla garanzia di
varietà, che riproduce esattamente il caso della cliente — un pasto in cui un piatto vince sempre lo
scoring — e verifica che non compaia due giorni di fila quando un'alternativa esiste, che i giorni
già erogati vengano considerati, e che con il parametro a 0 il comportamento resti quello storico.

Nota a margine: le suite `menu.service.spec.ts`, `menu-measurement-gate.spec.ts` e
`engine-rules.service.spec.ts` erano **già rosse prima di questo intervento** — i mock non erano
stati aggiornati dopo le misure obbligatorie, il fabbisogno calorico e la generazione catalogo a 28
giorni. Le ho allineate. Restano rosse per lo stesso motivo altre suite non collegate al menu
(auth, crm, commerce): le sistemo in un passaggio dedicato quando vuoi.
