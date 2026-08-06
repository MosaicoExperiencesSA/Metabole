# Keto-Mediterranea — materia prima per il catalogo

**Per:** la nutrizionista · **Da:** Sviluppo (Simone + Claude Cowork) · **Data:** 6 agosto 2026

---

> **Aggiornamento 6 agosto — la dieta è già nel generatore.**
> Non serve inserire nulla a mano: la Keto-Mediterranea è fra le **diete suggerite** di
> *Creazione e validazione*, con 12 varianti (onnivora/vegetariana × dimagrimento/mantenimento ×
> 3 pasti/5 pasti/digiuno 16:8). Il generatore produce le bozze rispettando i vincoli scritti qui
> sotto — sono nelle note cliniche del preset — e poi tocca a te: revisione delle ricette, conferma
> degli allergeni, gruppi di equivalenza, pubblicazione. Questo documento resta come **riferimento
> sulla materia prima**: serve a controllare che quello che il generatore propone stia dentro la
> tavolozza, e a correggerlo dove non ci sta.

## Perché questo documento

Dal feedback clienti del 5 agosto: *«i menu della Keto hanno ingredienti molto complessi, cercare
soluzioni più semplici»*. Chiarito da Simone il 6 agosto: il problema non è il tempo di preparazione,
sono **ingredienti difficili da reperire** — farine speciali, dolcificanti particolari, prodotti di
nicchia che al supermercato sotto casa non ci sono.

L'idea di Simone è non rattoppare la Keto esistente ma creare un prodotto nuovo: una **Keto-Mediterranea
costruita solo su ingredienti italiani comuni**.

⚠️ **Questo documento NON contiene menu.** I menu li componi e li validi tu: è la regola ferrea n.1 del
progetto (`progetto/STATO.md`). Qui c'è solo la **materia prima** — la tavolozza di ingredienti
compatibili con la chetosi e reperibili in qualunque supermercato italiano — più i vincoli tecnici del
sistema. L'obiettivo è farti risparmiare la parte noiosa, non sostituirti in quella clinica.

---

## L'idea ha una base in letteratura

Non è un'invenzione di marketing: la combinazione esiste ed è studiata.

- Uno studio italiano su pazienti sovrappeso e obesi con prediabete o diabete di tipo 2 usa
  esattamente una **dieta chetogenica mediterranea** ([PMC9610411](https://pmc.ncbi.nlm.nih.gov/articles/PMC9610411/)).
- Esistono studi su chetogeniche **basate sull'olio d'oliva** e sul loro effetto sul profilo lipidico
  ([PubMed 26700799](https://pubmed.ncbi.nlm.nih.gov/26700799/), [PubMed 30497921](https://pubmed.ncbi.nlm.nih.gov/30497921/)).
- Il confronto diretto fra chetogenica e mediterranea (**Keto-Med randomized trial**) mostra che la
  differenza la fa soprattutto l'aderenza nel tempo ([PMC8002540](https://ncbi.nlm.nih.gov/pmc/articles/PMC8002540)).
- Harvard, nella sua scheda sulla chetogenica, sottolinea che **la qualità dei grassi cambia il
  risultato**: olio d'oliva, pesce, frutta secca e avocado sono un'altra cosa rispetto a burro e
  insaccati ([The Nutrition Source](https://nutritionsource.hsph.harvard.edu/healthy-weight/diet-reviews/ketogenic-diet/)).

In sintesi: la parte fragile della keto classica è proprio quella che il mediterraneo risolve. Ed è
anche il motivo per cui gli ingredienti diventano più semplici — il pesce azzurro e l'olio d'oliva si
trovano ovunque, i dolcificanti esotici no.

---

## La tavolozza: ingredienti comuni, per pasto

Tutto quello che segue si trova in un supermercato medio italiano. Le **quantità e i rapporti li
decidi tu**: qui c'è solo l'elenco di cosa è ammesso e reperibile.

### Grassi (base del piatto)
Olio extravergine d'oliva · olive (verdi, nere, taggiasche) · avocado · frutta secca al naturale
(mandorle, noci, nocciole) · semi (girasole, zucca, lino) · burro e panna da cucina *(con parsimonia:
sono i grassi che Harvard segnala come da limitare)*.

### Proteine — pesce
Sgombro · alici e sardine (fresche o sott'olio) · tonno al naturale o sott'olio · salmone · orata ·
branzino · merluzzo · platessa · seppie · calamari · gamberi · cozze e vongole.

### Proteine — carne e uova
Uova · pollo · tacchino · manzo · maiale · coniglio. Salumi solo occasionali (bresaola, prosciutto
crudo): sono comodi ma sono carni lavorate.

### Latticini
Mozzarella · stracchino · ricotta *(⚠️ escludere per chi l'ha fra i cibi non graditi — vedi
`patty_moren51`)* · parmigiano e grana · pecorino · provola · yogurt greco intero al naturale ·
mascarpone.

### Verdure a basso contenuto di carboidrati
Zucchine · melanzane · peperoni · spinaci · bietole · cicoria · catalogna · broccoli · cavolfiore ·
verza · cavolo nero · finocchi · sedano · asparagi · carciofi · funghi · zucchine trombetta ·
insalate (lattuga, rucola, radicchio, songino) · pomodori e cetrioli *(con misura)* · ravanelli ·
cipollotto e porro *(in piccole quantità)*.

### Aromi e condimenti
Aglio · cipolla in piccole quantità · basilico, prezzemolo, rosmarino, salvia, origano, timo · limone
· aceto · capperi · acciughe sotto sale · peperoncino · noce moscata.

### Frutta ammessa, in porzioni piccole
Frutti di bosco (more, lamponi, mirtilli, fragole) · qualche fetta di avocado. Poco altro.

---

## Da NON usare — sono questi che hanno fatto nascere il problema

Farine speciali (mandorle, cocco, lupino, psillio) · dolcificanti particolari (eritritolo, allulosio,
monk fruit) · prodotti "keto" confezionati (pane, biscotti, barrette, pasta di konjac) · olio MCT ·
proteine in polvere · gomma xantana e addensanti · sciroppi senza zucchero.

Non c'è niente di sbagliato in questi prodotti: semplicemente **non si trovano al supermercato sotto
casa**, costano molto, e chiedono alla cliente un giro in negozio specializzato o un ordine online.
Su un percorso che vive di aderenza quotidiana, ogni ostacolo di questo tipo è un motivo per mollare.

**Fuori per definizione** (non è questione di reperibilità): pane, pasta, riso, patate, legumi,
cereali, frutta zuccherina, dolci, bibite.

---

## Vincoli del sistema, per come va inserita nel catalogo

- **Prodotto NUOVO**, non una variante della Keto o della Mediterranea. Regola ferrea n.1: i cataloghi
  non si mischiano mai, nemmeno per riferimento. Anche i piatti identici **si duplicano, non si
  condividono**.
- Codice stile suggerito: **`keto_mediterranean`**. Non serve nessuna modifica al codice: lo stile è
  una stringa libera, quindi la dieta compare da sola nella registrazione appena è `approvata` e
  `visibile al cliente`.
- Servono, come per ogni dieta: **regime**, numero di **pasti al giorno**, i **livelli kcal**
  (`levels`), e i **template giornalieri** con un piatto per slot (colazione, spuntino, pranzo,
  spuntino, cena). La rotazione lavora sui giorni che inserisci.
- Da compilare anche i campi rivolti alla cliente: **nome**, **descrizione** e 3-5 **caratteristiche
  principali** — sono quelli che si leggono nella schermata di scelta.
- ⚠️ **Stagionalità**: da oggi ogni ricetta ha il campo *Stagioni*. Vale la pena compilarlo mentre le
  inserisci: costa dieci secondi a piatto e evita il caso "spezzatino a luglio". Vuoto = va bene tutto
  l'anno.
- ⚠️ **Difficoltà**: c'è già il campo *semplice / media / elaborata*. Se marchi le ricette veloci come
  "semplice", entrano anche nel meccanismo delle alternative per chi ha scelto "preferisco ricette
  semplici".

---

## Una nota clinica, che decidi tu

La chetogenica resta uno schema impegnativo: non è indicata in gravidanza e allattamento, va valutata
con attenzione con problemi renali, epatici, pancreatici o cardiaci, e chi assume farmaci per diabete
o pressione può aver bisogno di aggiustamenti. La versione mediterranea ne migliora il profilo dei
grassi e la reperibilità, **non la rende adatta a tutte**.

Nell'app, alla voce Keto, la scheda informativa dice già queste cose alla cliente. Se pubblichi la
Keto-Mediterranea con un codice stile nuovo, dimmelo e aggiungo la sua scheda: cinque minuti.

---

*Fonti: Harvard T.H. Chan School of Public Health — The Nutrition Source · studi indicizzati su
PubMed/PMC citati sopra. Sono informazioni generali a supporto del tuo lavoro, non un parere clinico:
la composizione dei menu e l'idoneità delle singole clienti restano una tua decisione.*
