# PIANO — Il catalogo diventa **panieri**

**Chiesto da:** il capo nutrizionista, tramite Simone (26/8/2026).
**Domande e risposte:** 15 domande poste il 26/8, tutte risposte fra il 26 e il 27/8.
**Misura di partenza:** `npm run diag:settimane` sul database di produzione, 27/8/2026.
**Stato:** piano da approvare. **Nessuna riga di codice scritta.**
**⚠️ Le decisioni di Simone del 31/8 stanno in `progetto/DECISIONI_Panieri.md`** — 25 risposte, e alcune cambiano questo foglio (il passaggio clienti è massivo e automatico, non uno per uno; il senza glutine entra nel piano; niente stato bozza sui panieri). In caso di disaccordo fra i due fogli, vale quello delle decisioni.

> ⚠️ Questo foglio si legge prima di aprire il primo lavoro. Se una decisione qui dentro
> cambia, cambia il piano — non si aggiusta a valle.

---

## 0 · Il fatto che ribalta il progetto, e va letto per primo

Prima di misurare, la stima era **3.500–5.000 ricette da scrivere**. Era sbagliata.

`diag:settimane` del 27/8 dice che **tutte e dieci le famiglie della lista finale hanno già,
in tutti e tre i regimi di oggi, la variante «5 pasti» con 84 giornate e 84 ricette diverse
per ogni pasto** — colazione, spuntino, pranzo, merenda, cena.

Il numero 84 non è un traguardo: è **già lo standard** che il generatore produce (12 settimane
× 7 giorni). Il capo nutrizionista ha chiesto una cosa che in gran parte esiste.

⛔ **Il problema non è la mancanza: è la moltiplicazione.** In catalogo ci sono **306 varianti**.
Il modello nuovo ne vuole **38**. Fattore 8.

Da cui la natura vera di questo lavoro: **non è un progetto di contenuto, è un progetto di
struttura.** Il contenuto c'è; è il modo in cui è organizzato che va rifatto.

---

## 1 · Il modello, come resta

### 1.1 Le dieci famiglie

Basso indice glicemico · DASH · Detossinante · Flessibile · Iperproteica sportiva /
ricomposizione · Keto (non terapeutica) · Keto-Mediterranea · Low carb · Mediterranea ·
Proteica.

### 1.2 I quattro regimi

Onnivoro · **pescetariano** · vegetariano · vegano.

⚠️ Il pescetariano oggi **non** è fra i regimi attivi: esiste nei preset del generatore ma non
è mai stato acceso. Entra qui, ed è un filtro vero (vegetariano + pesce), quindi si incastra nel
nesting che il codice già usa (vegano ⊂ vegetariano ⊂ pescetariano ⊂ onnivoro).

⛔ **Il flexitariano NON è un regime**, e la ragione va tenuta scritta perché è controintuitiva.
I regimi, nel codice, sono definiti da **cosa si esclude**. Il flexitariano non esclude niente:
dice **quanto spesso** si mangia carne. Come regime filtrerebbe zero ricette, e il paniere
flexitariano nascerebbe identico a quello onnivoro — dieci panieri duplicati che non servono a
nessuno e che qualcuno dovrebbe mantenere per sempre. Diventa una **regola di frequenza** sul
paniere onnivoro (`ProductRule`, meccanismo che esiste già).

### 1.3 I panieri

**10 famiglie × 4 regimi = 40, meno 2 combinazioni dichiarate impossibili = 38 panieri.**

Impossibili: **Keto × vegano** e **Keto-Mediterranea × vegano**. Si bloccano **a priori**: chi ci
finisce sopra legge «combinazione non possibile», non un paniere vuoto. ⚠️ Un paniere vuoto è
peggio di un rifiuto: sembra un problema temporaneo e nessuno lo guarda.

### 1.4 Cosa contiene un paniere

| Pasto | Quante ricette |
|---|---|
| Colazione | 84 |
| Pranzo | 84 |
| Cena | 84 |
| **Spuntino + merenda (paniere unico)** | **168** |

Il paniere da 168 **esiste già**: oggi sono 84 spuntini + 84 merende come voci separate. Non c'è
contenuto da produrre — c'è uno slot da unificare, e la fascia oraria decide quale dei due è.

### 1.5 Le tre cose che il paniere sostituisce

1. **L'obiettivo** (dimagrimento / mantenimento) non è più un asse: il mantenimento usa lo
   **stesso** paniere, senza deficit calorico.
2. **La struttura pasti** (3 pasti / 5 pasti / digiuno) non è più un asse: si **pesca** dal
   paniere quello che serve.
3. **Le giornate pre-costruite** (`DietDayTemplate`) non sono più il modo in cui una ricetta
   appartiene a una dieta.

### 1.6 Catalogo condiviso (strada B)

Una ricetta appartiene a **più panieri**. Un pranzo vegano a basso indice glicemico va benissimo
anche in DASH vegana, Detossinante vegana e Mediterranea vegana: ogni paniere continua ad avere i
suoi 84 pranzi, sono solo in buona parte gli stessi.

⚠️ **È la decisione che vale di più di tutte**, e vale in ricette non scritte:

| | Strada A (panieri separati) | **Strada B (scelta)** |
|---|---|---|
| Dieci panieri pescetariani | ~4.200 ricette da generare | **0** — si derivano |
| Le due celle keto-vegane che chiudiamo | 840 ricette buttate | **0** — tornano in catalogo come vegane |

---

## 2 · Da dove si parte: la fotografia del 27/8

```
Diete in catalogo: 306.  Già a posto: 246.  Da rifare: 60.
Delle 60 da rifare, 1 sola ha clienti sopra (1 cliente in tutto).
```

### 2.1 Le sette famiglie che spariscono, e cosa sono davvero

| Famiglia di oggi | Cos'è davvero | Dove va |
|---|---|---|
| Vegana | un **regime** | asse regime |
| Vegetariana (latto-ovo) | un **regime** | asse regime |
| Digiuno intermittente (16:8) | una **struttura pasti** | asse struttura |
| Mediterranea ipocalorica | Mediterranea + **obiettivo** | asse obiettivo |
| Mediterranea senza glutine | decisione di Simone (27/8) | resta come **paniere**, non come famiglia — vedi §2.2 |
| Ritorno in Equilibrio | una **funzione** sullo storico | vedi §6.1 |
| Vacanze in Serenità | un **protocollo** | vedi §6.2 |

⛔ **Quattro delle sette sono assi travestiti da famiglie.** È lo stesso errore ripetuto quattro
volte, ed è quello che ha portato il catalogo a 306 varianti. Se il modello nuovo non lo rende
**impossibile**, fra sei mesi ci saranno di nuovo.

### 2.2 Mediterranea senza glutine

Simone il 27/8: «eliminiamo anche Mediterranea senza glutine». ⚠️ Ma la misura dice che ha **sei
varianti già piene a 84 ricette per pasto**: eliminarla oggi butterebbe via lavoro fatto, e
soprattutto toglierebbe alle celiache l'unica cosa che le distingue — un menu **pensato** senza
glutine invece di uno a cui è stato tolto tutto (è scritto in `senza-glutine.ts`, ed è la ragione
per cui quella variante esiste).

**Decisione presa (Simone, 27/8):** si tiene il **paniere**, si toglie la **famiglia**. Il senza
glutine diventa un filtro sul paniere mediterraneo, e la famiglia si chiude solo quando quel
filtro funziona. Fino ad allora `assegnaSenzaGlutine` resta esattamente com'è.

### 2.3 L'unica cosa urgente, e non aspetta questo piano

`Digiuno intermittente (16:8) · omnivoro · dimagrimento · digiuno`: **28 giornate, 12 pranzi
diversi, 1 cliente sopra.** Le torna lo stesso pranzo ogni dodici giorni.

Accanto, già a 84, ci sono `Flessibile · omnivoro · dimagrimento · digiuno` e `Flexitariana`
idem. **Si sposta quella cliente e si chiude.** Mezza giornata, e non ha niente a che vedere con
il resto del piano.

⚠️ Le altre 59 varianti magre **non hanno nessuna cliente sopra**: chiudendo le famiglie doppione
la maggior parte sparisce da sola.

### 2.4 Il numero che ancora manca

`diag:settimane` conta i `recipeId` **nominati dalle giornate**. Non dice se quelle ricette sono
**attive** e con gli **allergeni confermati**.

⛔ E qui c'è un difetto che questo piano deve chiudere comunque: **l'erogazione non controlla
`active`**. Una ricetta in bozza, ancora nominata da una giornata, **viene servita**. La base
personale invece la rifiuta. Sono due porte che rispondono alla stessa domanda in due modi
diversi.

Quindi «84» è il massimo, non l'utile. Il numero utile sta nella pagina **Copertura catalogo**
(piatti / attivi / rotti per variante e per pasto). **Va guardato prima della Fase 1**, ed è
l'unico dato che può ancora spostare la stima.

---

## 3 · Il modello dati

### 3.1 Com'è oggi

⛔ **L'appartenenza di una ricetta a una dieta vive dentro un JSON.** Non esiste nessuna tabella
che dica «questa ricetta sta in questo paniere»: sta scritta dentro `DietDayTemplate.meals`
(`[{slot, recipeId}]`), mescolata all'abbinamento della giornata, **senza chiave esterna**.

Tre conseguenze, tutte già visibili:

1. una ricetta perfetta che **nessuna giornata nomina**, il motore **non la vede**;
2. cancellare una ricetta lascia riferimenti morti — per questo la copertura ha la colonna
   «rotti»;
3. per condividere una ricetta fra panieri bisogna nominarla nelle giornate di diete diverse.

### 3.2 Com'è dopo

**Nuovo: `Paniere`** — famiglia × regime, con lo stato (bozza / approvato) e le regole sue.

**Nuovo: `PaniereRicetta`** — la tabella di appartenenza: `(paniereId, recipeId, slot)`, con
chiave esterna vera su tutte e due i lati e `@@unique([paniereId, recipeId, slot])`.
⚠️ Lo `slot` sta **qui** e non solo sulla ricetta: è quello che permette a un piatto di essere
merenda in un paniere e cena in un altro senza duplicare la riga.

**Cambia: `Recipe.mealSlot`** — da valore singolo a lista, oppure si aggiunge lo slot unico
`snack`. ⚠️ È un cambio con **18 punti da toccare**, già censiti in `common/slot-pasto.ts:15-22`.
**Va deciso e fatto prima di riempire**: farlo dopo vuol dire ripassare i panieri.

**Muore: `DietDayTemplate` come portatore di appartenenza.** Le giornate pre-costruite restano
solo finché serve il ripiego (§4.3), poi si chiudono.

**Resta: `Diet`**, ma diventa la **famiglia** e non più la variante. `ClientProfile.dietFamily`
continua a contenere il **nome**, e questo è un rischio da gestire (§7.3).

---

## 4 · Le fasi

I tempi sono in **consegne** — l'unità di lavoro di questo progetto: una consegna = un pacchetto
verificato, con test, revisione avversariale e messaggio di commit. Al ritmo tenuto ad agosto,
**1–2 consegne al giorno** nei giorni pieni.

---

### Fase 0 · La misura che manca — **0 consegne, 1 ora**

1. Pagina **Copertura catalogo** del backoffice: piatti / attivi / rotti, per ogni variante delle
   dieci famiglie, per ogni pasto.
2. `npm run diag:allergeni` — quante ricette hanno gli allergeni confermati.
3. Sposta la cliente di §2.3.

**Perché prima:** se il numero degli «attivi» fosse molto più basso di 84, la Fase 6 non è
zero e il piano cambia. *Misurare prima di decidere.*

**Uscita:** un numero per cella. Se «attivi» ≥ 60 per pasto su tutte le celle, si procede senza
cambiare niente.

---

### Fase 1 · L'appartenenza esce dal JSON — **3–4 consegne**

Il pezzo che tocca tutto, e il solo che non si può spezzare.

**Cosa si fa**
- tabelle `Paniere` e `PaniereRicetta`, con le chiavi esterne;
- migrazione: per ogni variante esistente si legge `DietDayTemplate.meals` e si scrivono le
  righe di appartenenza (una ricetta nominata da una giornata di quella dieta → appartiene al
  paniere corrispondente);
- si riscrivono i **tre punti** che oggi costruiscono il pool leggendo i template:
  `menu.service.ts` (`buildScoringContext`), `personal-base.service.ts`, `copertura-catalogo.ts`;
- si accende il controllo di integrità: una riga di appartenenza che punta a una ricetta che non
  esiste **non si può scrivere** (è la chiave esterna che oggi manca).

**Cosa si rompe se fatto male**
⛔ La migrazione è la parte delicata: se una ricetta si perde per strada, il paniere si assottiglia
e nessuno se ne accorge — il motore continua a comporre, con meno scelta. **Serve un confronto
prima/dopo per cella**: quante ricette per slot aveva la variante, quante ne ha il paniere.
Se il conto non torna, la migrazione si ferma.

**Come si verifica**
- confronto prima/dopo per tutte le 306 varianti;
- una sentinella: nessun file legge più `DietDayTemplate.meals` per costruire un pool
  (stesso modello di `una-porta-per-i-giorni.spec.ts`);
- i «rotti» della copertura devono andare a zero per costruzione.

---

### Fase 2 · Spuntino e merenda diventano un paniere da 168 — ✅ **FATTA (1/9)**

**La domanda era**: *un piatto pensato per le 10:30 va bene anche alle 17?* **Risposta di Simone,
1/9: sì.** Quale dei due sia lo decide l'ora del pasto nella giornata, non la ricetta. Niente tag
mattina/pomeriggio.

**Cosa si è fatto — e cosa NON si è fatto**
⛔ **`Recipe.mealSlot` non è stato toccato**, e nemmeno una riga di catalogo. Il piano prevedeva di
portarlo da singolo a lista con migrazione: non serve. L'unione avviene quando si **sceglie**, in
una porta sola (`common/slot-pasto.ts`), e il dato resta com'è. Costo della strada scelta: zero
migrazioni, zero riassegnazioni, e si torna indietro togliendo una riga.

⚠️ E i «18 punti» erano già raccolti: `slot-pasto.ts` esisteva dal 20/8 con le tre forme di
giornata. La Fase 2 ci ha aggiunto il gruppo scambiabile e le cinque funzioni che lo leggono.

**I cinque punti di scelta** — pool del paniere (da cui la ereditano insieme composizione e base
personale), ricette semplici, ricambio di un piatto non gradito, alternative in chat, soglia di
Vera, controllo del collegamento a una giornata. Sentinella:
`catalog/una-porta-per-gli-slot.spec.ts`, quattro eccezioni dichiarate.

⛔ **La riga che costerebbe un pasto in più**: l'allargamento arricchisce le chiavi che ci sono e
non ne crea di nuove. Far comparire la merenda dove esiste lo spuntino sarebbero kcal aggiunte al
piano di chi la merenda non ce l'ha — `dayComboPools` prende gli slot della giornata proprio da
quelle chiavi.

⚠️ **Coda aperta**: il generatore di `engine-rules.service.ts` conta ancora i due pasti separati e
genererà piatti che nel paniere ci sono già. Non fa male a nessuna cliente (le bozze nascono
spente), costa chiamate all'AI. È la Fase 7, ed è in `voci-iniziali.ts`.

**Misura**: `npm run diag:spuntini` — quanti spuntini, quante merende, quanti dopo l'unione, e in
fondo la somma del pasto messo **peggio** di ogni paniere, che è il numero onesto.

**Perché prima della composizione**
Se la composizione si scrive su due panieri e poi diventano uno, si riscrive due volte.

---

### Fase 3 · Si compone dal paniere — **2–3 consegne**

**Cosa si fa**
- `DayCombo` pesca dal paniere invece che dal pool dei template;
- la struttura pasti (3 / 5 / digiuno) decide **quanti e quali** slot si pescano; la finestra del
  digiuno continua a togliere gli slot **prima** della composizione, così le kcal si
  ridistribuiscono (funziona già così);
- **mantenimento**: stesso paniere, target senza deficit.

⛔ **Il punto delicato è il ripiego.** Oggi, quando `DayCombo` non trova una combinazione dentro
la banda kcal, **ricade sulla giornata pre-costruita**. Nel modello nuovo quelle giornate non
esistono più. Va deciso cosa succede, e **la risposta non può essere «non eroga»**: un cancello
chiuso costa a una cliente tutto il servizio.

Le tre risposte possibili, da scegliere prima di scrivere:
1. **allargare la banda** progressivamente finché una giornata entra, e **dirlo** (log + evento);
2. comporre **fuori banda** e segnalarlo alla nutrizionista;
3. tenere una **giornata di riserva** per paniere, scritta a mano.

La 1 è quella coerente con le regole di casa (*se degradi, dillo*), ma è una decisione, non un
dettaglio.

✅ **DECISA da Simone l'1/9: la 1.** Si allarga la banda a piccoli passi finché una giornata entra,
e ogni allargamento lascia una traccia — log ed evento. ⚠️ La parte che va scritta con attenzione
non è l'allargamento: è **il passo e il tetto**. Una banda che si allarga senza limite non degrada,
mente: a un certo punto compone una giornata che col target non c'entra più niente e dice di averlo
rispettato. Serve un tetto dichiarato, e oltre quello la segnalazione alla nutrizionista — cioè la
2 come ultima spiaggia, non come regola.

---

### Fase 4 · La regola della coppia pranzo/cena — **1–2 consegne**

Richiesta testuale del 26/8: *«se a Simone oggi dai a pranzo spaghetti al pomodoro e cena
branzino al forno, la prossima volta che a pranzo avrò spaghetti al pomodoro mi devi cambiare la
cena»*.

**Cosa c'è già:** quattro meccanismi anti-ripetizione — penalità su 14 giorni, distanza minima 2
giorni per slot, niente due volte nello stesso giorno, rotazione. **Sono tutti per singolo slot.**

**Cosa manca:** una regola sulla **coppia**. Serve uno storico delle coppie servite: oggi si
ricava dagli snapshot dei `MenuDay`, ma non è indicizzato.

⚠️ Il vincolo è largo: con 84 pranzi e 84 cene le coppie possibili sono **7.056**. Non è un muro,
è lavoro.

**Insieme:** la tolleranza kcal da 15% a **±25%** (`menu_kcal_balance_tolerance_pct`, che ammette
fino a 30). ⛔ Ma questo tocca **tutte** le clienti attuali nello stesso momento, non solo i
panieri nuovi: va misurato prima con `npm run diag:kcal`, e i tetti di porzione (×1,8 principali,
×1,6 colazione, ×1,25 spuntini) restano comunque il limite vero.

---

### Fase 5 · Il regime pescetariano e la regola flexitariana — **1–2 consegne**

**Cosa si fa**
- `pescetarian` entra fra i regimi attivi (`config_param diet_regimes`), e nel nesting:
  vegano ⊂ vegetariano ⊂ pescetariano ⊂ onnivoro;
- i dieci panieri pescetariani si **derivano**: paniere vegetariano della stessa famiglia + i
  piatti di pesce di quello onnivoro. È un'assegnazione, non una generazione;
- il flexitariano diventa una `ProductRule` di frequenza sul paniere onnivoro;
- le due celle keto-vegane si dichiarano **non possibili**: chi le chiede legge «combinazione non
  possibile», e le loro 840 ricette restano in catalogo come vegane.

⚠️ **Il pesce è una categoria di esclusione già ricca**: `menu/exclusions.ts` ha 67 termini per
«pesce» (era 12 fino al 23/8). La derivazione del paniere pescetariano si appoggia lì, non a un
elenco nuovo — due elenchi di pesci sono due elenchi che un giorno divergono.

---

### Fase 6 · Le due funzioni che non sono panieri — **3–5 consegne**

#### 6.1 Ritorno in Equilibrio — 1–2 consegne

Simone (27/8): *«per chi ha già fatto un percorso con noi, un mese coi menu scelti tra quelli che
hanno dato migliori risultati e al cliente più graditi»*.

Non è un catalogo: è una **selezione dallo storico personale**. I due segnali esistono già —
`MenuWeight` (efficacia) e `RecipeRating` (gusto). Si scrive la regola di composizione, si chiude
la famiglia, e le sue sei varianti a 84 confluiscono nei panieri delle famiglie corrispondenti.

#### 6.2 Vacanze in Serenità — 2–3 consegne

Simone (27/8): *«mentre il cliente è in vacanza monitora il peso (lo fa inserire quando vuole) e
se vede un grosso aumento gli suggerisce 4 giorni di menu tra quelli che gli hanno reso di più.
Vale solo per chi ha un percorso in corso e sospende.»*

⚠️ **Il motore c'è già, ma scatta nel momento sbagliato.** Oggi (`pause.service.ts` →
`monitoring.generateRientroMenus`): quando la pausa **finisce**, il cron notturno confronta
l'ultima pesata con `refWeightKg` (il peso alla partenza); se lo scarto supera la soglia genera le
giornate migliori dello storico e manda la notifica *«Bentornata: ti ho preparato il rientro 🧰»*.

Mancano tre cose:
1. il controllo **periodico durante** la pausa, non solo dopo la fine;
2. la cliente che inserisce il peso quando vuole mentre è sospesa (il confronto usa già «l'ultima
   pesata», quindi il dato passa: manca il momento del controllo);
3. **4 giornate** invece di 7 (`monitoring_rientro_days`, è un parametro).

**Le due guardie, decise il 27/8:**

⛔ **(a) L'omaggio passa da una porta sua, dichiarata.** Oggi tutto il motore si ferma quando il
piano è sospeso, e quella regola ha una ragione. Se l'eccezione la si mette *dentro* il controllo
«piano fermo», da domani qualunque altro pezzo di codice erogherà a piano fermo senza saperlo.

⛔ **(b) «Una volta per mese solare» ha bisogno di un segno che dura.** Due precedenti buoni nel
progetto: `pauseRequest.rientroMenusAt` («questa pausa l'ho già lavorata») e il report mensile,
dove *«la notifica del mese fa da marcatore»*. Senza, un cron che gira due volte in una notte
regala l'omaggio due volte.

✅ **E una buona notizia verificata:** `planEnd` è una **data** (`subscription.endDate`), non un
conteggio di giornate erogate. **I 4 giorni omaggio non bruciano piano.** Era il rischio peggiore
e non c'è.

---

### Fase 7 · Il backoffice — **2 consegne**

- pagina **Paniere**: le 38 celle, con quante ricette per slot, lo stato, e la possibilità di
  aggiungere/togliere una ricetta da un paniere (è la tabella di appartenenza, resa visibile);
- **copertura per paniere** invece che per variante;
- il **flag «verificata dal nutrizionista»** (§8).

⚠️ Ogni pagina nuova ha la **sua** chiave di permesso, e nasce insieme alla guardia che la legge —
è la regola di progetto in `CLAUDE.md`, e una chiave dichiarata e non letta è già successa.

---

### Fase 8 · Gli allergeni, e il flag di verifica — **1–2 consegne**

Risposta 14 di Simone: *«lo approviamo di default tutto poi creiamo un flag di verifica che il
nutrizionista una volta rivista la ricetta approva»*.

⛔ **Va scomposta in due, perché metà è sicura e metà no.**

`allergensReviewed` è oggi **l'unica cosa che impedisce a un allergene di arrivare in un piatto**:
una ricetta senza quel flag non entra nella base personale di nessuna cliente e blocca
l'attivazione del prodotto (`assertActivatable`). Le ricette generate dall'AI nascono con gli
allergeni **suggeriti dall'AI** e il flag a `false`.

- **Approvare di default la RICETTA** (attiva, in paniere, componibile): sì, è quello che serve e
  non fa male a nessuno.
- **Approvare di default gli ALLERGENI**: no. Su 15.000 ricette basta che l'AI ne sbagli lo 0,1%.
  Il default sbagliato qui non è un menu brutto: è una persona in pronto soccorso.

**La via d'uscita proposta:** gli allergeni si ricavano dagli **ingredienti in modo
deterministico**, non si chiedono all'AI. Il progetto ha già le liste per categoria in
`menu/exclusions.ts` (67 termini per «pesce») e i 14 codici UE in `catalog/allergens.ts`. Una
ricetta i cui ingredienti sono **tutti riconosciuti** si auto-approva; una che contiene un
ingrediente non classificabile **si ferma** e la guarda una persona.

Così il flag di verifica del nutrizionista diventa quello che il capo nutrizionista voleva — **un
giudizio clinico sulla ricetta** — e non un lavoro da impiegato sugli allergeni.

⚠️ **Questa è la decisione più rischiosa del piano** ed è l'unica che va firmata dal capo
nutrizionista per iscritto.

---

### Fase 9 · Chiusura delle famiglie doppione e passaggio clienti — **1–2 consegne + tempo umano**

- si chiudono Vegana, Vegetariana, Digiuno intermittente (16:8), Mediterranea ipocalorica,
  Ritorno in Equilibrio, Vacanze in Serenità;
- ogni cliente sopra viene spostata sul paniere corrispondente (famiglia + regime + obiettivo +
  struttura), **una per una**, come deciso il 26/8: *«ad oggi restano così, quando siamo pronti al
  passaggio li vediamo uno per uno»*.

⛔ `ClientProfile.dietFamily` contiene il **nome** della dieta: chiudere o rinominare una famiglia
**scollega** le clienti che ce l'hanno sopra. Esiste già `npm run rinomina:prodotto` per questo, e
va usato quello — non una `updateMany` scritta al momento.

---

## 5 · Ordine e dipendenze

```
Fase 0 (misura)
   └─> Fase 1 (appartenenza)  ← non si può spezzare né saltare
          ├─> Fase 2 (168)     ← PRIMA della 3, o si riscrive
          │      └─> Fase 3 (composizione dal paniere)
          │             ├─> Fase 4 (coppia pranzo/cena + ±25%)
          │             └─> Fase 5 (pescetariano + flexitariano)
          ├─> Fase 7 (backoffice)      ← può correre in parallelo dalla 3 in poi
          └─> Fase 8 (allergeni)       ← indipendente, si può anticipare
Fase 6 (le due funzioni)   ← indipendente da tutto il resto
Fase 9 (chiusura + passaggio)  ← ultima, e solo a panieri accesi
```

⚠️ **La Fase 8 conviene anticiparla**: sblocca il riempimento e non dipende da niente. Se il
numero della Fase 0 dovesse essere brutto, è quella che salva i tempi.

---

## 6 · I tempi

| Fase | Consegne |
|---|---|
| 0 · Misura | 0 (1 ora) |
| 1 · Appartenenza fuori dal JSON | 3–4 |
| 2 · Paniere spuntini da 168 | 1–2 |
| 3 · Composizione dal paniere | 2–3 |
| 4 · Coppia pranzo/cena + ±25% | 1–2 |
| 5 · Pescetariano + flexitariano | 1–2 |
| 6 · Ritorno in Equilibrio + Vacanze in Serenità | 3–5 |
| 7 · Backoffice | 2 |
| 8 · Allergeni deterministici + flag | 1–2 |
| 9 · Chiusura famiglie + passaggio clienti | 1–2 |
| **Totale** | **15–23 consegne** |

**In calendario: 3–5 settimane** di sviluppo, all'andatura tenuta ad agosto (1–2 consegne al
giorno nei giorni pieni), **se non si aprono altri lavori in mezzo**.

**Riempimento del catalogo: circa zero**, con la strada B. È il risultato della misura del 27/8,
ed è la differenza fra questo piano e quello che sembrava servire ventiquattro ore fa.

**Passaggio delle clienti: tempo umano**, una per una. Non si può accelerare e non è tempo di
sviluppo.

---

## 7 · I rischi, e cosa si guarda per accorgersene

| Rischio | Perché fa male | Come ce ne accorgiamo |
|---|---|---|
| **La migrazione della Fase 1 perde ricette** | il paniere si assottiglia e il motore continua a comporre, con meno scelta e nessun errore | confronto prima/dopo per tutte le 306 varianti, con blocco se il conto non torna |
| **Lo slot unificato si decide dopo** | ripassare 168 × 38 assegnazioni | la Fase 2 sta prima della 3 apposta |
| **Il ripiego della Fase 3 non viene deciso** | una cliente resta senza menu, o riceve una giornata fuori banda in silenzio | l'evento `daily_kcal_below_target` esiste già: va esteso al caso «fuori banda» |
| **Gli allergeni auto-approvati sbagliano** | una persona in pronto soccorso | ingredienti non classificabili → la ricetta si ferma e la guarda un umano |
| **Le clienti si scollegano alla chiusura delle famiglie** | menu fermi, «piano in preparazione» | `rinomina:prodotto`, e il passaggio una per una |
| **L'omaggio dei 4 giorni apre un buco nel «piano fermo»** | altro codice comincerà a erogare a piano sospeso | porta separata e dichiarata, non un'eccezione dentro il controllo esistente |
| **Il numero della Fase 0 è peggiore del previsto** | il riempimento non è zero | si guarda **prima** di aprire la Fase 1 |

---

## 8 · Cosa questo piano NON fa

- **Non tocca i menu già erogati.** `MenuDay` è uno snapshot e l'`upsert` ha `update: {}`: le
  giornate già in calendario restano come sono. Chi vuole rifarle usa «Rigenera menu».
- **Non cambia il fabbisogno né i tetti di porzione.** Restano ×1,8 / ×1,6 / ×1,25 e la regola
  «non si rimpicciolisce mai».
- **Non tocca il generatore AI** oltre alla Fase 8: continua a scrivere bozze come oggi.
- **Non decide se il senza glutine diventa un filtro**: quella è una voce a parte, e finché non è
  fatta la famiglia resta.

---

## 9 · Cosa serve prima di aprire la Fase 1

1. **Il numero della Fase 0** (Copertura catalogo: piatti / attivi / rotti).
2. **La firma del capo nutrizionista sulla Fase 8** (allergeni deterministici + auto-approvazione).
3. **La risposta sulla fascia oraria** (§Fase 2): un piatto delle 10:30 va bene alle 17?
4. **La scelta del ripiego** (§Fase 3): banda allargata, fuori banda dichiarato, o giornata di
   riserva?

Le prime due sono bloccanti. Le altre due servono prima della fase in cui compaiono, non subito.
