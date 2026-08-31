# Metabole — Allergeni delle ricette: chi li decide, e cosa ti chiediamo di firmare

**A chi:** Nocanty (capo nutrizionista). **Da:** Sviluppo (Simone + Claude). **Data:** 31 agosto 2026.

**Scopo:** stiamo per rifare il catalogo nei **panieri** che ci hai chiesto. Una sola decisione ha
bisogno della tua firma, ed è **Q1**: come vengono decisi gli allergeni di una ricetta. Le altre due
domande sono informative — abbiamo già deciso, ma se hai un'obiezione clinica questo è il momento in
cui costa poco.

**Tempo di lettura: 5 minuti. Da restituire: una riga di risposta a Q1, firmata.**

---

## 1. Cosa succede oggi

Ogni ricetta ha un contrassegno, `allergeni verificati`. Finché è spento:

- la ricetta **non entra** nella base personale di nessuna cliente;
- **blocca** l'attivazione del prodotto.

È l'unica cosa, in tutto il sistema, che impedisce a un allergene di finire in un piatto. E le
ricette scritte dall'AI nascono con gli allergeni **suggeriti dall'AI** e quel contrassegno **spento**.

Finché le ricette erano poche, il contrassegno lo accendeva una persona. Con i panieri le ricette in
gioco sono circa **quindicimila**: rivederle una per una non è un lavoro che esista.

## 2. Cosa proponiamo (è quello che ti chiediamo di firmare)

**Gli allergeni non li scrive più l'AI: li ricava il sistema dagli ingredienti.**

Abbiamo già gli elenchi che servono: i termini per ciascuna categoria (per il pesce, per esempio,
sono 67 parole) e i 14 allergeni obbligatori per legge.

- Una ricetta i cui ingredienti sono **tutti riconosciuti** → gli allergeni si scrivono da soli, e la
  ricetta è utilizzabile.
- Una ricetta con **anche un solo** ingrediente che il sistema **non sa classificare** → **si ferma**,
  non entra in nessun menu, e finisce in una coda che guarda una persona.

Il tuo contrassegno resta, ma cambia mestiere: non è più «ho ricontrollato gli allergeni», diventa
**«questa ricetta è clinicamente buona»**. Che è il giudizio per cui serve un nutrizionista.

## 3. Cosa NON facciamo, e perché

Nella prima stesura avevamo scritto: *approviamo tutto di default, poi il nutrizionista corregge*.
Su questo ci siamo corretti da soli, e vale la pena che tu sappia perché.

Approvare di default la **ricetta** (renderla utilizzabile) non fa male a nessuno: al massimo un menu
brutto. Approvare di default gli **allergeni suggeriti dall'AI** è un'altra cosa: su quindicimila
ricette basta uno sbaglio ogni mille perché quindici piatti dichiarino il falso. Lì il difetto non si
vede in un menu brutto — si vede addosso a una persona.

Il sistema, con la nostra proposta, **non indovina mai**: o riconosce, o si ferma.

## 4. I limiti, detti prima e non dopo

1. **La deduzione vale quanto gli elenchi.** Un ingrediente scritto in modo vago («trancio misto»,
   «preparato per brodo») non viene riconosciuto e ferma la ricetta. È il comportamento giusto, ma
   all'inizio la coda da guardare potrebbe essere consistente: te lo diremo con un numero prima di
   partire.
2. **Gli ingredienti composti sono il caso rischioso**, ed è per questo che il sistema si ferma invece
   di tirare a indovinare: un «pesto pronto» contiene allergeni che il nome non dice.
3. **Le contaminazioni non le sappiamo.** Il sistema legge gli ingredienti, non i processi di
   produzione: sa dire «contiene», non «può contenere tracce di». Se questa distinzione va scritta da
   qualche parte per le clienti, dicci tu dove e con che parole.
4. **Gli elenchi li puoi allargare tu**, e quando lo fai valgono da subito su tutto il catalogo.

---

## Q1 — [FIRMA RICHIESTA] Come si decidono gli allergeni

### Opzione A — Dagli ingredienti, con arresto sull'ignoto *(la nostra proposta)*

Quella descritta al §2.

- **A favore:** nessun allergene inventato dall'AI arriva in un piatto; il catalogo si sblocca subito;
  il tuo tempo va sul giudizio clinico invece che su un lavoro d'archivio.
- **Contro:** una coda iniziale di ricette ferme, di dimensione ancora da misurare.

### Opzione B — Ogni ricetta la vede una persona

Si tiene il blocco di oggi: niente entra in erogazione senza una conferma umana.

- **A favore:** il massimo della prudenza.
- **Contro:** quindicimila ricette. È tempo che nessuno ha, e nel frattempo i panieri non partono.

### Opzione C — Si approva tutto di default, si corregge dopo

- **A favore:** il più veloce.
- **Contro:** per un periodo, allergeni scritti dall'AI e mai guardati arrivano nei piatti. **Non ce
  la sentiamo di proporla**, e la scriviamo solo perché tu sappia che l'abbiamo considerata e scartata.

**La tua risposta a Q1:** ☐ A  ☐ B  ☐ C — Firma ......................... Data .................

---

## Q2 — [informativa] Spuntino e merenda diventano un elenco solo

Nel modello nuovo lo spuntino di metà mattina e la merenda del pomeriggio **pescano dallo stesso
elenco** di 168 piatti: quello che li distingue è l'ora in cui cadono, non il piatto.

Se secondo te esistono piatti che vanno bene alle 10:30 e **non** alle 17 (o viceversa), dillo adesso:
si può aggiungere una distinzione, come già facciamo per le colazioni dolci e salate. **Dopo costa
molto**, perché vuol dire ripassare l'assegnazione su tutti e 38 i panieri.

_Se non rispondi, procediamo con l'elenco unico._

## Q3 — [informativa] Il flexitariano

Non sarà un tipo di dieta a sé (non esclude niente: dice quanto spesso si mangia carne). Diventa una
regola sul menu onnivoro: **carne al massimo 3 volte a settimana, il pesce senza limite.**

Se il numero giusto secondo te è un altro, basta dirlo: è un'impostazione, si cambia in un minuto e
senza aggiornare l'app.

## Q4 — Chi guarda le ricette che si fermano

Proponiamo che la coda delle ricette ferme (§2) sia visibile **a te e alle nutrizioniste**, così non
si accumula su una scrivania sola. Se preferisci tenerla solo tua, la restringiamo.

---

## 5. Cosa facciamo appena rispondi

- Prima di scrivere una riga di codice ti diamo **due numeri**: quante ricette si fermerebbero, e
  quante sono già in regola. Se il primo numero fosse alto, la proposta la rivediamo insieme.
- Gli elenchi di riconoscimento restano **quelli che il motore già usa** per le esclusioni: non ne
  nasce un secondo, perché due elenchi di allergeni sono due elenchi che un giorno si contraddicono.
- Il tuo contrassegno di verifica clinica resta in ogni scheda ricetta, come oggi.
