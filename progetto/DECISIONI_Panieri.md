# Panieri — le risposte di Simone (31/8/2026)

Domande poste una alla volta il 31/8, sul piano `PIANO_Panieri_Ricette.md` (27/8).
⚠️ Questo foglio è la fonte delle decisioni: se una cambia, cambia il piano — non si aggiusta a valle.
Foglio APERTO: il giro di domande non è finito.

---

## 1 · Allergeni — dagli ingredienti, in automatico (Fase 8)

Gli allergeni NON li scrive più l'AI: si ricavano dagli ingredienti in modo deterministico, con le
liste che esistono già (`menu/exclusions.ts`, 67 termini per «pesce»; `catalog/allergens.ts`, i 14
codici UE). Una ricetta i cui ingredienti sono **tutti** riconosciuti si auto-approva; una che ne
contiene **uno solo** non classificabile **si ferma** e finisce in una coda che guarda una persona.

La RICETTA resta approvata di default (attiva, in paniere, componibile) — quello era giusto.
Il flag del nutrizionista sopravvive ma cambia mestiere: **giudizio clinico sulla ricetta**, non
ricontrollo degli allergeni.

⚠️ Rischio residuo dichiarato: la qualità dipende da come sono scritti gli ingredienti. Un
ingrediente vago («trancio surgelato misto») ferma la ricetta — comportamento giusto, ma la coda
iniziale potrebbe essere grossa. **È uno dei numeri della Fase 0.**

### ⛔ AGGIORNATA il 31/8 (sera) — la risposta firmata, e cosa si fa davvero

Il foglio è tornato firmato. ⚠️ **La casella di Q1 si legge in due modi**: quella davanti ad «A» è
stata cancellata e la riga dice `A ☐ B X C` — a occhio sembra **B**, nel PDF la X sta nel posto dove
stava la casella di **C**. Simone ha letto **C** («si approva tutto di default, si corregge dopo»).

⛔ **C non si fa così com'è**, e la ragione è misurabile: C e A si comportano diversamente **solo**
sulle ricette di cui il sistema non capisce gli ingredienti. Su tutte le altre fanno la stessa cosa,
e A le sblocca uguale. Quindi C non compra velocità in generale: la compra **proprio dove l'AI ha
tirato a indovinare più che altrove**, che è il posto peggiore in cui fidarsi.

**DECISO (Simone, 31/8 sera): la via di mezzo.**

1. Gli allergeni di una ricetta sono la **somma** di quelli dedotti dagli ingredienti e di quelli
   suggeriti dall'AI. ⛔ Mai l'AI **da sola** dove la deduzione dice di più: fra i due non si sceglie,
   si sommano — un allergene in meno è l'errore che si vede addosso a una persona.
2. Una ricetta con anche **un solo** ingrediente non riconosciuto **non si ferma per tutte**: entra
   in catalogo come in C, e resta fuori **solo dai panieri di chi ha dichiarato un'allergia o
   un'intolleranza**, finché non la guarda qualcuno.
3. La coda delle ricette non riconosciute **resta visibile** e lavorabile, ma non blocca il
   riempimento dei panieri.

⚠️ Così il catalogo parte alla velocità di C, e nessun allergene incerto arriva addosso a chi quel
allergene ce l'ha davvero. Il rischio residuo si sposta su chi **non** ha dichiarato niente — che è
il rischio che C accettava per tutte.

⛔ **Se un giorno si volesse tornare a C secco**, serve una riga di Nocanty che dica «C» **a
lettere**: una X in una casella che si legge in due modi non è una firma su questa decisione.

⚠️ **Aperta, e da decidere prima di scrivere il codice**: il riconoscimento degli ingredienti oggi
passa da `abbinaPerRicetta`, che è tarato sulle **calorie** — torna «non lo so» quando due righe
vanno bene uguale, e non collega «riso» a «riso basmati». Per le calorie è giusto (integrale e
bianco sono due numeri diversi); per gli **allergeni** quell'ambiguità non esiste, qualunque riso dà
la stessa risposta. O si tara il riconoscimento sulla domanda vera — coda più corta, e nessun rischio
in più — o si accetta una coda più lunga di quanto serva.

⚠️ **E resta il limite n° 2 del foglio, dichiarato e non chiuso**: essere in tabella non vuol dire
conoscerne gli allergeni. Su un «pesto pronto» che avesse la sua riga la deduzione direbbe «nessun
allergene» con la stessa faccia. Si chiude dichiarando gli allergeni **sull'alimento**, non
allungando un elenco di parole.

## 2 · La firma del capo nutrizionista — foglio scritto

Preparo io una pagina in linguaggio suo (come `Metabole_Grassi_Domanda_Nocanty.pdf`): cosa decide il
sistema da solo, cosa si ferma e arriva a lui, cosa succede se sbaglia. Lui la rimanda firmata.
⛔ È l'unica decisione del piano che va firmata: qui un difetto non si vede in un menu brutto.

## 3 · Ricette in bozza servite lo stesso — prima si conta (Fase 0)

Il difetto esiste oggi: l'erogazione non controlla `active`, la base personale sì. Non si accende il
controllo alla cieca: **prima la pagina Copertura catalogo** (piatti / attivi / rotti per cella e per
pasto) + `npm run diag:allergeni`. Se gli attivi sono vicini a 84 si accende e non se ne accorge
nessuno; se sono molti meno, il piano cambia **prima** di spendere una consegna.

## 4 · Spuntino e merenda — intercambiabili (Fase 2)

Un piatto delle 10:30 va bene alle 17. Il paniere da 168 è **un elenco solo**, senza tag
mattina/pomeriggio; la fascia oraria decide soltanto in che casella della giornata finisce.
⚠️ Va nel foglio al nutrizionista come cosa **decisa**, non come domanda: se ha un'obiezione clinica
deve arrivare prima della Fase 2, ultimo momento in cui costa poco (dopo sono 168 × 38 assegnazioni).

## 5 · Come si scrive lo slot — decisione tecnica, presa da Claude

`Recipe.mealSlot` diventa una **lista** di slot (non uno slot unico `snack`): lo stesso piatto può
essere merenda in un paniere e cena in un altro senza duplicare la riga. Se in corso d'opera si
rivela complicata, torna a Simone.

## 6 · Il ripiego quando le kcal non tornano — allarga e lo dice (Fase 3)

Il motore prova con la banda giusta; se non entra niente la allarga **per gradi** finché una giornata
ci sta, e **scrive** che l'ha fatto (log + evento, sul modello di `daily_kcal_below_target` del 17/8).
La cliente mangia sempre; noi sappiamo su quali panieri succede e quanto spesso.
⛔ Scartate: comporre fuori banda avvisando la nutrizionista (rumore su una persona ogni volta) e la
giornata di riserva per paniere (38 giornate a mano da mantenere per sempre — è il pezzo del vecchio
modello che il piano voleva togliere).

## 7 · Mantenimento — stesso paniere, senza deficit (Fase 3)

L'obiettivo smette di essere un asse del catalogo: stessi piatti, cambia solo il target. Con questa
decisione sparisce la famiglia «Mediterranea ipocalorica», che era l'obiettivo travestito da famiglia.
Una cliente che passa a mantenimento non cambia mondo: le crescono le porzioni.

## 8 · Tolleranza kcal ±25% — prima si misura (Fase 4)

Non si tocca il parametro alla cieca: `npm run diag:kcal` dice su quante clienti e quante giornate lo
scarto andrebbe oltre il 15% di oggi, e Simone decide col numero in mano.
⚠️ Il cambio vale per TUTTE le clienti attive nel momento in cui si fa, non solo per i panieri nuovi.
⚠️ I tetti di porzione (×1,8 principali, ×1,6 colazione, ×1,25 spuntini) restano il limite vero: il
25% non si vedrà mai tutto.

## 9 · La coppia pranzo/cena — mai la stessa, mai più (Fase 4)

Una coppia già servita a quella cliente non torna. Con 7.056 combinazioni possibili e ~84 giornate per
piano il vincolo è largo e non stringe quasi mai; è anche il più facile da spiegare e da testare.
⛔ **Salvaguardia obbligatoria:** su una cliente con molte esclusioni il paniere può stringersi al
punto che ogni coppia possibile è già stata servita. Lì il motore **non si blocca**: allenta il
vincolo e lo dichiara, come al punto 6. Un vincolo che diventa un cancello è peggio della ripetizione
che voleva evitare.

## 10 · Quali coppie — solo pranzo e cena (Fase 4)

Sono i due piatti «veri» della giornata ed è lì che la ripetizione si nota. Colazione, spuntino e
merenda restano coperti dai quattro meccanismi che già esistono (penalità su 14 giorni, distanza
minima per slot, niente due volte nello stesso giorno, rotazione).

## 11 · Pescetariano — si accende derivato, senza revisione (Fase 5)

Paniere vegetariano della famiglia + i piatti di pesce dell'onnivoro. Nessun piatto nuovo entra in
circolo: le due metà sono già in erogazione oggi su altre clienti. Si corregge dalla pagina Paniere.
⛔ **Nota tecnica che cambia il risultato:** il filtro non è «contiene pesce» ma «contiene pesce **e
non contiene carne**» — altrimenti un piatto con pesce e pancetta finisce nel paniere pescetariano.
Si appoggia ai 67 termini di `menu/exclusions.ts`, non a un elenco nuovo (due elenchi di pesci sono
due elenchi che un giorno divergono).

## 12-13 · Flexitariano — carne max 3 volte a settimana, pesce libero (Fase 5)

`ProductRule` di frequenza sul paniere onnivoro, non un regime. Le 3 volte contano **solo carne e
derivati**: il pesce va quanto il motore vuole (lettura standard: ridurre la carne, non le proteine
animali). Il numero resta modificabile senza rilascio.

## 14 · Keto × vegano e Keto-Med × vegano — blocco netto in backoffice (Fase 5)

La famiglia si assegna dalla **scheda cliente** (staff), non la sceglie la cliente nel questionario:
il blocco vive lì. La scheda non lascia salvare la combinazione e dice perché. Nessuno può creare una
cliente che il motore non sa servire.
⛔ Scartato l'avviso forzabile: sarebbe il caso «motore muto» già visto con Lorena — nessun menu e
nessuno che lo dica.

## 15-16 · Ritorno in Equilibrio — prima il risultato, poi il gusto (Fase 6.1)

Si prendono i menu che hanno funzionato meglio (`MenuWeight`) e fra quelli si mettono avanti i più
graditi (`RecipeRating`). Chi torna da noi torna per il risultato.
**Requisito:** basta un percorso **concluso**. Se i menu buoni non bastano a coprire il mese, i giorni
mancanti si pescano dal paniere normale della sua famiglia — il prodotto è sempre vendibile e la parte
«scelta per lei» è semplicemente più o meno grande.

## 17-18 · Vacanze in Serenità — si controlla alla pesata, soglia 3 kg (Fase 6.2)

Il controllo NON è un cron periodico: scatta **quando la cliente inserisce una pesata** mentre è in
pausa (è lei che decide quando pesarsi). Soglia **3 kg** sopra il peso di riferimento, come il
monitoraggio post-percorso.
⛔ **Parametri SEPARATI, non riuso:** i 4 giorni non possono usare `monitoring_rientro_days` (governa
anche il rientro del monitoraggio post-percorso: portarlo a 4 accorcerebbe anche quello, senza che
nessuno l'abbia chiesto). Stessa cosa per la soglia: valore uguale, parametro suo.
⚠️ Restano valide le due guardie decise il 27/8: porta dichiarata per erogare a piano sospeso, e un
marcatore che dura per il «una volta per mese solare».

## 19 · Pagina Paniere — tutte in lettura, modifica capo + admin (Fase 7)

Chiave di permesso: `panieri` (nasce insieme alla guardia che la legge). Ogni nutrizionista può
guardare da dove escono i piatti delle sue clienti; la composizione la cambiano capo nutrizionista e
admin, perché il catalogo è condiviso e una ricetta tolta sposta le clienti di tutte.

## 20 · Niente stato bozza/approvato — il paniere è sempre vivo

Un paniere è la sua lista di ricette: togliere o aggiungere ha effetto dal menu successivo. Nessun
interruttore che qualcuno dimentica acceso.

## 21 · «Togli» è per paniere — decisione tecnica, presa da Claude

Togliere una ricetta la toglie **solo da quel paniere**; per toglierla ovunque si **disattiva la
ricetta**. Due gesti diversi, e la pagina li dirà con parole diverse.

## 22 · Passaggio clienti — MASSIVO e automatico, poi archivio ⚠️ SOSTITUISCE la decisione del 26/8

Simone (31/8): «quando è tutto finito lo facciamo in modo massivo e automatico, poi nascondiamo tutto
il vecchio in un archivio». Non più «uno per uno» come deciso il 26/8.
**Archiviare, non cancellare:** i menu già erogati sono snapshot e devono restare leggibili.

**Tabella di conversione — le tre famiglie dove la destinazione NON si deduce:**
- Vegana → **Mediterranea × vegano**
- Vegetariana → **Mediterranea × vegetariano**
- Digiuno intermittente 16:8 → **Mediterranea**, struttura digiuno

Nessuna cliente cambia stile di alimentazione: cambia il nome sotto cui è archiviata. Le altre quattro
famiglie si deducono da sole (Mediterranea ipocalorica → Mediterranea, ecc.).
⛔ `ClientProfile.dietFamily` contiene il NOME: il passaggio usa `npm run rinomina:prodotto`, mai una
`updateMany` scritta al momento.

## 23 · Il nome che legge la cliente — famiglia + regime, composto (Fase 9)

«Mediterranea vegana», «Low carb pescetariana»: il nome nasce dai due assi, nessuno scrive 38
etichette a mano. Dice la verità su cosa sta mangiando e resta coerente se un giorno cambia regime.

## 24 · La cliente del digiuno 16:8 — NON si sposta, aspetta il passaggio massivo

Simone (31/8). ⚠️ **Claude non è d'accordo, ed è scritto qui apposta:** quella variante ha 28 giornate
e 12 pranzi diversi — le torna lo stesso pranzo ogni dodici giorni, ed è riconoscibile a occhio nudo.
Da qui al passaggio sono settimane di menu visibilmente povero, il tipo di cosa che una cliente
segnala o per cui se ne va. **Se scrive, si sposta in giornata: è mezza giornata di lavoro.**

## 25 · Mediterranea senza glutine — il filtro si fa DENTRO il piano

Una consegna in più: il senza glutine diventa un filtro sul paniere mediterraneo e la famiglia si
chiude insieme alle altre sei, al passaggio massivo. Un'unica migrazione, un solo momento in cui le
clienti cambiano piano. Fino ad allora `assegnaSenzaGlutine` resta esattamente com'è.

## 26 · Niente carne, pesce e verdure a colazione, spuntino e merenda

Richiesta di Simone, 31/8 sera: «carne, pesce e verdure evitiamole nelle colazioni, merende e
spuntini».

⛔ **La lettura è: il PIATTO non dev'essere di carne, pesce o verdura** — non «nessuna verdura fra
gli ingredienti». Scelta da Simone fra tre, e la differenza vale il catalogo: con la lettura stretta
uscirebbero la frittata con gli spinaci, il pane coi pomodorini, l'avocado toast — colazioni normali
— e il paniere delle colazioni si svuoterebbe. Con questa escono «Petto di pollo alla piastra»,
«Tonno con olive», «Insalata mista», «Vellutata di broccoli».

**Come si decide di cosa è un piatto**: dall'**ingrediente principale**, cioè quello che pesa di più.
⚠️ Non dal nome: «Vellutata di broccoli e patate» e «Purè di patate con broccoli» si chiamano quasi
uguale e sono due piatti diversi. ⛔ E se le grammature non ci sono, **non si indovina**: si risponde
«non lo so», e «non lo so» **non** passa a colazione.

⚠️ Il vocabolario del pesce è quello delle esclusioni (67 termini), letto dalla stessa porta. Quello
della carne **non esisteva** e nasce qui: tagli e animali, non piatti — «polpette» non c'è, perché
esistono quelle di ceci, e a decidere è l'ingrediente principale.

⛔ **NON è ancora applicata.** Prima il numero: `npm run diag:colazioni` dice, per ogni paniere e
per ogni pasto, quante ricette restano e quante escono. Se qualche cella scende sotto le 84 del
piano, applicarla costa un lavoro di riscrittura e va saputo prima — altrimenti il motore compone
più povero e non lo dice nessuno. ⚠️ È la stessa disciplina che il 31/8 ha impedito al paniere DASH
di nascere vuoto.

⚠️ Da decidere dopo il numero: se la regola vale **anche per le ricette già in catalogo** (che escono
da quegli slot) o **solo per quelle nuove** (e il generatore smette di produrle così).

---

# Cosa resta aperto (31/8, fine giro)

1. ✅ **CHIUSA il 31/8 (sera)** — la firma del capo nutrizionista sulla decisione 1 è arrivata, e la
   decisione è la **via di mezzo** scritta lì sopra. ⚠️ Resta da chiedergli una riga a lettere se un
   giorno si volesse davvero C secco: la casella firmata si legge in due modi.
2. **I numeri della Fase 0 e della Fase 8**, e adesso hanno tutti e due il loro strumento:
   `npm run diag:fase0` e `npm run diag:allergeni-deducibili` (sola lettura, shell di Render).
   ⚠️ **Da leggere, non da riportare**: il primo dà due verdetti (su tutte le varianti e sulle sole
   varianti con clienti sopra — il denominatore vero non è 306); il secondo ne dà tre, perché
   «quante ricette si fermano» misura soprattutto quanto è indietro la tabella alimenti (306 righe
   contro 7831 nomi di ingrediente usati), non quanto sono scritte male le ricette.
3. **`npm run diag:kcal`** prima di toccare la tolleranza (decisione 8).

Tutto il resto delle fasi non aspetta più nessuna risposta.
