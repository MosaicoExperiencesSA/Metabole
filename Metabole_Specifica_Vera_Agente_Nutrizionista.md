# Vera — l'agente discorsivo della nutrizionista

**Specifica concordata il 12 agosto 2026** (Simone + Claude), dopo verifica sul codice di `main`.
Nulla di quanto segue è ancora scritto: questo documento è la decisione, non il lavoro fatto.

---

## 1. Da dove nasce

Lucia, la nuova nutrizionista, al telefono il 12/8: **«un sistema che apprende da me in maniera
discorsiva»**. La frase nasce da una sua convinzione sull'AI in generale — *sono stupide, vanno
addestrate* — non da un attrito col nostro prodotto. Quindi non c'è un cronometro da battere: non
stiamo togliendo venti minuti al giorno a nessuno. Stiamo rispondendo a una posizione, che per altro
è largamente corretta.

L'idea: **una Gaia rivolta all'interno**. Stessa forma di quella che parla con le clienti, ma
l'interlocutore è la nutrizionista e gli effetti atterrano sui moduli invece che sul menu di domani.

---

## 2. L'idea in una riga

> La chat è un **compilatore, non un giudice**.

La frase della nutrizionista viene tradotta **una volta** in una regola strutturata; poi il motore la
applica in modo deterministico. Il modello lavora al momento della scrittura e poi esce di scena.
Non esiste nessun punto in cui una regola scritta a parole viene riletta da un'AI a ogni menu: su
315 diete sarebbe ingovernabile.

Corollario che toglie di mezzo l'unico motivo tecnico per cui l'idea poteva essere irrealizzabile:
**«un agente per nutrizionista» non vuol dire N sistemi né N modelli addestrati.** È lo stesso
identico codice, con separati per persona soltanto tre cose — il nome, il dizionario, la memoria
delle decisioni. La seconda nutrizionista costa una riga di configurazione.

---

## 3. ⚠️ Cosa esiste già (e corregge tre nostre assunzioni)

La verifica sul codice ha cambiato la dimensione del progetto. Tre scoperte, in ordine di peso.

### 3.1 Vera esiste già in embrione, ed è stata scritta oggi

`backend/src/food-swaps/impara-dal-nutrizionista.ts` + `impara-dalla-chat.ts`, agganciati a
`chat.service.ts:467`, **leggono già le frasi che la nutrizionista scrive in chat alla cliente e ne
ricavano righe di sostituzione**. Nascono `da_verificare` — non perché la decisione sia dubbia, ma
perché *la lettura* lo è — e si portano dietro la frase esatta.

Questo progetto non parte da zero: è l'estensione naturale di quel seme. Cambiano due cose —
l'interlocutore (Vera parla *con* la nutrizionista invece di origliare) e il raggio (non solo
sostituzioni).

Il file contiene già le lezioni che ci saremmo dovuti pagare da soli, e vanno riusate senza
discutere: le due direzioni invertite dell'italiano («X al posto di Y» dice prima l'arrivo), le
domande che non sono istruzioni, le negazioni, i pronomi, e la regola **nel dubbio non si impara**.

### 3.2 La tabella delle sostituzioni è completa

`FoodSwap` (`schema.prisma:2568-2636`) esiste con tutto: chiave `clientId|recipeId|fromKey|toKey`
con contatore `volte`, stati `da_verificare | verificata | corretta | annullata`, `origine`
(`chat|app|manuale|nutrizionista`), `creataDaId`/`validataDaId`, e il **«promuovi a regola»**
(`food-swaps.service.ts:173-285`, decisione pura in `promuovi-a-regola.ts:42-63`, tre esiti
`gia_regola | aggiungi | crea`, il gruppo nuovo nasce sempre `draft`).

⚠️ Nota terminologica: lo stato che chiamavamo «respinta» qui è **`annullata`**, e ce n'è uno in più,
**`corretta`** (il nutrizionista cambia il sostituto).

### 3.3 ⚠️ Allergie e intolleranze SONO già distinte

Questa corregge una decisione presa oggi al buio. `ClientProfile` ha **tre array separati**
(`schema.prisma:406-408`): `allergies`, `intolerances`, `dislikedFoods`. E la gerarchia è già viva,
codificata come regola R8 (`engine-rules.catalog.ts:102`):

| | Effetto oggi |
|---|---|
| **Allergie** | blocco duro sulla base personale (`personal-base.service.ts`), contro i 14 codici UE (`catalog/allergens.ts`) |
| **Intolleranze** | sostituzione; se non sostituibile → blocca ed escala |
| **Non graditi** | solo sostituzione, non bloccano mai il piano |

Il cantiere «separare allergie e intolleranze» quindi **non è la separazione**: è più piccolo e più
preciso di come l'avevamo immaginato. Restano da fare tre cose sole:

1. Nel questionario `allergies` e `allergiesOther` **vengono fuse in un unico array**
   (`onboarding.service.ts:321,357`): il testo libero perde la sua natura di «fuori dai 14 codici».
2. Le intolleranze usano **chiavi in inglese** (`gluten|lactose|nuts`) riallineate a mano da `ALIAS`
   in `exclusions.ts:56-78`.
3. **La visita medica obbligatoria in caso di allergia non esiste** come regola. Questo sì è nuovo.

Nota utile: **`allergies` è scrivibile solo dall'onboarding** — non compare né in `UpdateProfileDto`
né in `PROFILE_FIELDS` (`clients.service.ts:21`). App e backoffice possono cambiare intolleranze e
non graditi, non le allergie. È una protezione, e va tenuta: Vera non deve poterle scrivere.

### 3.4 Il resto della mappa

- **Gruppi di equivalenza** (`EquivalenceGroup`, `schema.prisma:2071-2088`): ambito **globale o per
  dieta** (`productId`), `status draft|approved`. **Non esiste un gruppo per cliente** — ed è giusto
  così: il per-cliente è `FoodSwap`.
- **Regole del motore**: catalogo in codice (`engine-rules.catalog.ts`), valore globale in
  `ConfigParam`, override per dieta in `ProductRule`, preset in `RulePreset`. E c'è già una coda di
  approvazione per le regole nuove: **`RuleProposal`** (`pending|approved|rejected`).
- **Esclusioni per categoria**: esistono ma **cablate nel codice**, `INTOLERANCE_MAP` in
  `menu/exclusions.ts:20-46`, con confronto **testuale** su nome piatto + ingredienti. Non esiste
  nessun modello Prisma di famiglia alimentare. **Questo è esattamente il buco che il dizionario
  riempie.**
- ⚠️ Due verità diverse sullo stesso pool: `personal-base` filtra per **tag allergene codificato**,
  `menu.service` per **stringhe negli ingredienti**. Vera non deve inventarne una terza.
- ⚠️ `ai_assistant_enabled` è `'false'` in produzione. Va acceso, ed è una decisione a sé.

---

## 4. Le sei azioni

Lista **chiusa**. Fuori da questa lista Vera dice che non sa farlo e manda alla pagina giusta.
Ordinate per **raggio del danno**, che è l'unico ordine che conta.

| # | Azione | Dove atterra | Percorso |
|---|---|---|---|
| 1 | Restrizione su una cliente | `ClientProfile.dislikedFoods` / `intolerances` | scrive dopo conferma |
| 2 | Equivalenza/sostituzione su una cliente | `FoodSwap` (esiste) | scrive dopo conferma |
| 3 | Variante di dieta per una cliente | `MenuDay.meals` / base personale | scrive dopo conferma |
| 4 | Modifica di una ricetta esistente | `Recipe` | **coda «Da validare»** |
| 5 | Ricetta nuova | `Recipe` | **coda «Da validare»** |
| 6 | Regola su un tipo di dieta | `EquivalenceGroup(productId)` / `ProductRule` / `RuleProposal` | **coda «Da validare»** |

⚠️ Vincolo di progetto da non violare (regola ferrea in `progetto/STATO.md`): **la ricetta di
catalogo non si tocca mai per una singola cliente** — è di tutte, non di una. Le personalizzazioni
vivono nel JSON `MenuDay.meals`. L'azione 3 sta lì; l'azione 4 è un'altra cosa e passa dalla coda.

### Su 1, 2, 3: la domanda sull'ambito

Vera chiede sempre **«solo per questa cliente, o la estendo a tutte?»**, con risposta predefinita
**«solo per questa cliente»** — così Lucia può dire «ok» e basta. Se risponde «a tutte», la regola
**va in approvazione**, non viene scritta.

È il «promuovi a regola» del §16.9 spostato all'inizio, nel momento in cui lei sa ancora perché lo
sta dicendo.

### Chi valida

**Nocanty**, il consulente medico: non fa visite né azioni (salvo la fase iniziale), sorveglia il
lavoro delle nutrizioniste. È il `head_nutritionist` dell'RBAC. Ruolo interessante e pulito:
**approva senza poter scrivere**.

### Disambiguazione

Vera **non indovina mai** su chi ricade una regola. «Simone» con 93 omonimi → chiede nome e cognome
o email, e mostra comunque cosa sta per fare prima di scrivere.

---

## 5. Il dizionario — il vero «apprendimento»

Quando Lucia dice una famiglia che non esiste in catalogo («formaggi molli»), Vera **non indovina**:

> «Non conosco questa famiglia. In catalogo ho questi 23 formaggi: quali sono i molli?»

Lei ne spunta nove. Da quel momento «formaggi molli» **esiste**, con quel significato.

**Vera non impara nutrizione — quella la sa Lucia. Impara la sua lingua.** È l'unica cosa che un
modello può imparare qui senza fare danni: il catalogo resta la fonte della verità, lei fornisce solo
le etichette. Ed è misurabile: dopo un mese il dizionario ha quaranta voci o ne ha tre, e sappiamo da
soli se il progetto funziona.

Tecnicamente è **la tabella che oggi manca**: `INTOLERANCE_MAP` in `exclusions.ts` è la stessa cosa,
ma cablata nel codice e uguale per tutti. Il dizionario è la sua versione viva.

- **Ambito**: per nutrizionista. Nocanty può **promuovere una voce a comune** — stesso gesto del
  «promuovi a regola», e le due cose vanno fatte assomigliare.
- ⚠️ **Il dizionario invecchia.** Se entra in catalogo una burrata, la lista dei nove non la contiene
  e la regola smette di funzionare *in silenzio*. Deciso: **quando nasce un alimento nuovo il sistema
  controlla se somiglia a una famiglia nota e chiede** «la burrata la metto fra i formaggi molli?».
- ⚠️ Confronto sui nomi **per parola, con la radice**, mai per sottostringa: «pepe»⊂«peperoni»,
  «mela»⊂«melanzane», «pane»⊂«pancetta». Riusare `common/nomi-alimento` (`chiaveAlimento`,
  `normalizza`), già usato da `impara-dalla-chat`.

---

## 6. Il freno: cosa si mostra prima di scrivere

Due strati, tutti e due obbligatori.

### (b) La regola tradotta

Non la frase riletta — quella è un pappagallo: le stai chiedendo di confermare di aver detto quello
che ha detto, non di aver ottenuto quello che voleva. Si mostra **l'elenco vero**:

> «Vieto: mozzarella, stracchino, crescenza, ricotta, robiola… (9). Tengo: grana padano, parmigiano.»

È qui che si vede l'errore di traduzione. Se nella lista c'è la ricotta e per Lucia non è un formaggio
molle, se ne accorge adesso e non fra tre mesi.

### (c) Il controllo del pool

> «Questa regola toglie 14 ricette dalle 75 del suo pool. Restano 10 menu componibili.»

E **non è un avviso: è un bivio con le vie d'uscita già calcolate.**

> «Attenta: se tolgo la mozzarella restano solo 10 menu. Cosa vuoi fare?
> — ne creo di nuove (→ coda da validare)
> — cambio dieta cercandone una dove il problema non c'è
> — ti propongo la mozzarella senza lattosio»

⚠️ **Le alternative si cercano nel catalogo / tabella nutrienti, mai si immaginano.** Se propone una
porta che non si apre, dopo due volte Lucia smette di fidarsi. Solo se non trova nulla propone «te ne
creo di nuove».

### Fattibilità del controllo del pool

Verificato: **non esiste** oggi un servizio «calcola il pool disponibile per la cliente» riusabile e
senza scritture. Ma **esistono tutti i pezzi**, già read-only:

- `MenuService.buildScoringContext` (`menu.service.ts:1124-1265`) non scrive: solo `findMany`.
- `menu/exclusions.ts` è un modulo **puro**, zero Prisma. Idem `catalog/pick-diet.ts`,
  `day-combo.service.ts:41`, `menu/punteggio.ts`, `cambio-piatto.ts:137`.
- In `deliverIfEligible` (`menu.service.ts:306-723`) **non c'è nessuna `$transaction`**: la linea di
  taglio è la **riga 675**. Fino a lì è tutto in memoria (`daySnapshots`).
- Da neutralizzare per un dry-run le scritture collaterali: `chiediMisureDiPartenza` (373),
  `analyticsEvent.create` (422-432), escalation (483, 651), `audit.log` (692), `provaAttivata` (717).
- **Il modello da imitare esiste già**: `NutritionistService.simulaKcal`
  (`nutritionist.service.ts:724`, endpoint `POST clients/:clientId/kcal/simula`), con tanto di test
  *«la simulazione non salva niente»* (`nutritionist.service.spec.ts:499`).
- E c'è già chi calcola il **pool effettivo** per cliente: `prisma/diag-varieta-menu.ts`
  (`reportEffectivePool:181`, `reportInsufficientPools:430`), che riusa `exclusions.ts` proprio per
  essere «una misura, non una stima». Limite: stampa su console invece di restituire dati.

**Conclusione: è lavoro di estrazione, non di riscrittura.** È comunque il pezzo più grosso del
progetto, e serve anche fuori da Vera.

---

## 7. Precedenze e conflitti

**La regola di Lucia sulla singola cliente vince su tutto, vincoli sanitari compresi.** È un medico:
un sistema che le dice di no su un caso che ha in mano è un sistema che verrà scavalcato o
abbandonato.

**Ma mai in silenzio.** La distinzione non riguarda la sua competenza, riguarda la nostra:

- *Deliberato* — lei sa della patologia e decide. Comanda lei.
- *Inavvertito* — o se n'è dimenticata, o **la traduzione ha allargato l'elenco** e ci è rientrato
  l'allergene. Qui non è il medico che scavalca la medicina: è il nostro parser.

Quindi: quando la regola collide con un vincolo sanitario, Vera **prima glielo ricorda** —

> «Ti ricordi che Simone ha questa patologia? Questa regola gli lascia solo alimenti che la toccano.»

Se conferma, vince lei e il sì resta nel registro con nome, data e frase originale. Se si corregge,
abbiamo evitato un guaio. Il registro serve al sistema, ma soprattutto serve a lei: se un domani
qualcuno chiede conto di quella scelta, c'è scritto che fu una decisione medica consapevole e non un
automatismo.

**Gusti della cliente**: se la regola li contraddice, la cliente **non si trova un divieto muto** —
l'app la invita a contattare la nutrizionista, perché quel vincolo è stato creato apposta per lei.

---

## 8. Retroattività e annullo

- **Annullo di una regola** → si rigenerano **solo i menu non ancora visti** dalla cliente.
- **Regola nuova** → Vera chiede caso per caso, ma **con la conseguenza già calcolata** («12 clienti
  hanno già visto il menu di domani: lo rifaccio o parto da dopodomani?»), con risposta predefinita e
  un **«fai sempre così»** che chiude la domanda per le volte successive. Senza quello, alla ventesima
  volta si clicca a caso, che è peggio del non chiedere.

### ⚠️ Il dato «menu già visto» non esiste

Verificato: nessun campo `viewedAt/seenAt/openedAt` su `MenuDay` (`schema.prisma:1669-1687`).
`MenuDay.status` esiste con default `"planned"` ma **non viene mai aggiornato da nessuna parte**.
Il frontend (`app/src/pages/Menu.tsx`) non emette nessun evento di visualizzazione del menu.

L'approssimazione migliore già disponibile è l'`AnalyticsEvent` `screen_view` con `path = /menu`
(emesso da `app/src/App.tsx:74`): dice che la cliente ha aperto la schermata a un timestamp, non
quale giorno stava guardando.

**Rimedio, ed è piccolo**: aggiungere `viewedAt DateTime?` su `MenuDay` e valorizzarlo in
`MenuService.getMenu` per i giorni restituiti con `visibleFrom <= oggi`. È **l'unico punto di
lettura** (`menu.controller.ts:114`), quindi è una modifica di poche righe. Senza di essa la
decisione presa al §8 non è implementabile come detta.

---

## 9. Sicurezza

### 9.1 Il testo incollato non è un'istruzione

Lucia incollerà in chat messaggi di clienti, referti, mail — è comodo e naturale. Dentro può esserci
scritto «togli tutto tranne il cioccolato».

**Le azioni si eseguono solo da ciò che Lucia scrive di suo pugno.** Il testo incollato entra in un
contenitore marcato **«citazione»**. Se contiene qualcosa di azionabile, Vera lo *propone* — «nel
messaggio Simone chiede X: vuoi che lo faccia?» — e serve comunque la sua conferma.

Non è una finezza da manuale: Vera ha il potere di scrivere regole su clienti vere, e il testo che le
arriva davanti è spessissimo scritto da qualcun altro.

### 9.2 Il tetto ai tentativi

Quando non capisce: **due giri di chiarimento, poi si arrende** — «non ci arrivo, fallo dalla pagina
X». Un agente che insiste è peggio di un agente che ammette.

### 9.3 Cosa Vera non può toccare

- `ClientProfile.allergies` (oggi scrivibile solo dall'onboarding: la protezione resta).
- Le ricette di catalogo per una singola cliente (regola ferrea).
- I gruppi di equivalenza già `approved` (come già fa `promuovi-a-regola`).
- I testi i18n `progress_support` e le frasi di `frasiGaia.ts` fuori dalle regole in testa al file.

---

## 10. Il registro e il collaudo

Il registro tiene **la frase originale**, l'azione che ne è uscita, chi, quando, e un **annulla** su
ogni riga. Obbligatorio comunque per l'audit (GDPR, e già nelle regole di progetto).

Ma serve a una seconda cosa, che è quella che decide se il progetto sopravvive a sé stesso.

Un traduttore non deterministico **marcisce senza che nessuno se ne accorga**. Il giorno in cui
cambiamo il modello, il catalogo o il dizionario, nessuno saprebbe dire se ha smesso di capire le
frasi che prima capiva. Il guasto non è un errore rosso: è che a Lucia comincia a sembrare più scema
di prima, e non capiamo perché.

**Rimedio, e non ne conosco altri che funzionino**: si tiene un elenco di **frasi vere con accanto
l'azione giusta**, e si ripassa prima di ogni rilascio. Se dopo un aggiornamento tre frasi su cento
danno un risultato diverso, lo vediamo prima noi invece che dopo lei.

Il pezzo elegante è da dove esce quell'elenco: **dal registro**. Ogni volta che Lucia corregge Vera —
cambia una spunta, annulla una regola, riformula — quella frase con la sua correzione entra
nell'elenco delle prove. Il sistema si costruisce il proprio collaudo con gli errori che ha già
fatto, e i primi mesi di uso reale diventano il materiale che lo rende affidabile.

**Le frasi originali si conservano.** Deciso.

---

## 11. Il nome

È **Vera stessa a chiedere a Lucia come vuole chiamarla**, al primo incontro: la prima cosa che
impara da lei è il proprio nome. Vive come campo sul profilo della nutrizionista, si può cambiare, e
compare nel registro accanto alle azioni.

Serve un nome di scorta pronto per quando lei risponde «scegli tu»: **Vera** (valutate anche Nora,
Iris). Corto e diverso da Gaia, per non confondere le due.

---

## 12. Il rapporto a Nocanty

Mensile, e **non un elenco di tutto**: un rapporto che dice tutto viene letto il primo mese e
ignorato dal secondo. Solo ciò che merita attenzione:

- regole **annullate poco dopo essere state create** — il segnale più pulito che Vera ha capito
  storto, o che si sta lavorando a tentoni;
- **pool scesi sotto soglia** — clienti che si stanno avviando verso menu poveri, e nessuno se ne
  accorgerebbe da solo;
- **parole non capite** rimaste senza risposta: sono i buchi del dizionario, e sono lavoro da fare;
- quando le nutrizioniste saranno più d'una, le **voci di dizionario su cui non sono d'accordo**.

⚠️ Le **regole confermate sopra un vincolo sanitario** si notificano **subito**, non a fine mese: se
c'è un caso da guardare, trenta giorni dopo è tardi.

Il registro completo resta una pagina consultabile quando serve.

---

## 13. Dove vive Vera — la pagina e i moduli

### 13.1 La pagina dedicata

**Chat sopra, registro sotto, stessa schermata.** Il registro non è un archivio da un'altra parte:
è la memoria della conversazione, e sta lì perché serve nel momento in cui si sta lavorando.

Ogni riga: **data · origine · azione · su chi · stato · annulla**. Il «su chi» è la cliente, il tipo
di dieta o la ricetta. Lo stato è *attiva / in attesa di approvazione / annullata*. E siccome la
frase originale la conserviamo, **cliccando una riga si rivede la frase da cui è nata** — che è il
modo più rapido per capire perché una regola è venuta storta.

### 13.2 Il registro mostra TUTTO quello che cambia sulle sue clienti

Deciso: non solo le azioni fatte tramite Vera. Anche le sostituzioni concordate da Gaia in chat, gli
alimenti che la cliente esclude dall'app, le sostituzioni del motore. Perché sulle sue clienti
scrivono in tanti, e il pezzo che oggi le manca non è «cosa ho fatto io» — è «cosa è cambiato».

⚠️ **Scoperta della verifica: questa vista esiste già, in piccolo.** La scheda cliente ha un «log
delle modifiche» costruito su `AuditLog` filtrato per `entityId`, e — su richiesta di Simone del
10/8, *«altrimenti non serve a nulla»* — `profile.update` registra **i valori cambiati**
(`campiCambiati`, con `origine: 'app'`), non solo i nomi dei campi (`profile.service.ts:70-92`).

Quindi il registro «tutto» **non è una tabella nuova**: è quella vista **allargata da una cliente a
tutte le clienti della nutrizionista**, unita a `FoodSwap` e alle `Substitution` dentro
`MenuDay.meals`. È lavoro di **lettura e fusione**, non di scrittura. Servono filtri per cliente,
tipo e periodo, altrimenti a regime è illeggibile.

### 13.3 Il modulo in dashboard: «quello che aspetta me», non «quello che ho fatto»

Un contatore delle regole create è una medaglietta: la si guarda due volte e poi mai più. Il modulo
non racconta il passato, **dice cosa c'è da fare oggi**.

**Per Lucia**: clienti col pool sceso sotto soglia · proposte ferme in attesa di Nocanty · domande di
dizionario rimaste senza risposta · righe `FoodSwap` ancora `da_verificare`.

**Per Nocanty**: la sua coda — ricette e regole da validare — più gli **avvisi immediati** sulle
regole confermate sopra un vincolo sanitario.

### 13.4 Nocanty ha la stessa interfaccia, con un agente che fa il mestiere opposto

Stessa pagina, stessa forma. Ma il suo agente **non scrive niente**: gli **sottopone le cose da
approvare, una alla volta**, e lui decide parlando. È coerente col suo ruolo — sorveglia, non agisce
— e diventa l'unico ruolo del sistema che **approva senza poter scrivere**.

Il suo agente ha quindi una lista di azioni tutta sua: **approva · respingi · correggi · chiedi
spiegazioni a chi l'ha proposta**. Nessuna azione di scrittura diretta.

Quando sottopone una proposta la porta **già istruita**: la frase originale di Lucia, la regola
tradotta, l'effetto sul pool, chi l'ha chiesta e quando. Così la decisione si prende senza aprire
altre cinque schermate.

⚠️ **L'ordine non è cronologico ma per rischio**: prima le regole confermate sopra un vincolo
sanitario, poi quelle che svuotano un pool, poi il resto. Una coda in ordine di arrivo fa arrivare
per ultima la cosa più importante.

⚠️ **L'approvazione in blocco non esiste** (deciso da Simone il 12/8). Un bottone «approva tutte
quelle di Lucia di oggi» è comodissimo, ed è anche il modo più rapido per svuotare di senso la coda:
in tre settimane diventa l'unico che si preme, e la validazione torna a essere una formalità. Ogni
riga si guarda e si decide da sola.

Anche il suo agente **chiede a lui come vuole chiamarlo**, al primo incontro.

---

## 14. Le consegne

### Consegna 1 — Le fondamenta (nessuna chat, e utile anche da sola)

1. **Tabella dizionario** (famiglia → alimenti, per nutrizionista, con promozione a comune).
2. **`MenuDay.viewedAt`** valorizzato in `getMenu`. Poche righe, un punto solo.
3. **Estrazione del pool a vuoto** da `menu.service.ts` — metodo pubblico che si ferma alla riga 675,
   sul modello di `simulaKcal`, con il test «la simulazione non salva niente». **È il pezzo più
   grosso del progetto**, e serve anche alla pagina Regole motore che esiste già.
4. **Registro** delle azioni con frase originale e annulla.

⚠️ Rischio concentrato qui: le scritture collaterali di `deliverIfEligible` (373, 422-432, 483, 651,
692, 717) vanno rese opzionali senza rompere il percorso vero. Si fa con un revisore che rilegge.

### Consegna 2 — Vera che parla, due azioni sole

La chat nel backoffice nutrizionista; **azione 1** (restrizione per cliente) e **azione 2**
(sostituzione per cliente, che si appoggia su `FoodSwap` già esistente); la disambiguazione della
cliente; il dizionario che chiede invece di indovinare; l'anteprima (b)+(c); la conferma; il registro
con l'annulla; il nome chiesto al primo incontro; il contenitore «citazione».

Riusare senza riscrivere: `impara-dalla-chat.ts` per il riconoscimento, `nomi-alimento` per il
confronto, `registra-sostituzione.ts` per la scrittura.

Più **la pagina** (§13.1): chat sopra, registro sotto — in questa consegna il registro può mostrare
le sole azioni di Vera, e allargarsi a «tutto» nella 3.

**Se ci fermassimo qui, avremmo già qualcosa di solido.**

### Consegna 3 — Le azioni a raggio largo

Azioni 3, 4, 5, 6 come **proposte in coda**; la domanda sull'ambito con «promuovi»; il percorso di
approvazione a Nocanty (appoggiandosi a `RuleProposal` e allo stato `draft` degli
`EquivalenceGroup`); il calcolo dei macro delle ricette nuove dalla tabella nutrienti, mai inventati;
il rifiuto della ricetta se un ingrediente non è in tabella.

Più **la pagina di Nocanty** (§13.4) — stessa interfaccia, agente che sottopone invece di scrivere —
il **registro allargato** a tutto quello che cambia sulle clienti (§13.2, lettura e fusione su
`AuditLog` + `FoodSwap` + `MenuDay.meals`), e i **due moduli in dashboard** (§13.3).

### Consegna 4 — Che non marcisca

Il corpus di prova costruito dal registro e ripassato a ogni rilascio; il rapporto mensile a Nocanty
e l'avviso immediato sui conflitti sanitari; la manutenzione del dizionario quando nasce un alimento.

### Cantiere a parte — Allergie / intolleranze

Ridotto dopo la verifica (§3.3): scindere `allergies` da `allergiesOther`, riallineare le chiavi
inglesi delle intolleranze, e introdurre **la visita medica obbligatoria in caso di allergia**.

Per le clienti già iscritte: **notifica → chat con Gaia**, che spiega («alla tua iscrizione non
abbiamo fatto una distinzione che ora vogliamo migliorare») e fa le due domande. Le risposte in testo
libero si trasformano in campi con lo stesso meccanismo del dizionario: Gaia propone, la cliente
conferma. **Mai salvate come le ha scritte.** Nel frattempo lo stato è **«non specificato», non
«nessuna allergia»**: freno forte finché la risposta non arriva.

---

## 15. Costo

Non è una variabile. Con una nutrizionista, o dieci, siamo nell'ordine di **pochi euro al mese** e
due o tre secondi di attesa per risposta. Il costo di questo progetto è **costruirlo**, non farlo
girare.

---

## 16. Decisioni ancora aperte

1. ⛔ **Priorità**: dove sta Vera rispetto alla coda attuale (§15.2 C, revoca consenso, i tre vuoti
   del 12/8: riorganizzazione della giornata, porta d'ingresso delle situazioni, memoria dei gusti).
2. ⛔ **`ai_assistant_enabled`**: oggi `'false'` in produzione. Accenderlo è una decisione a sé.
3. ⛔ Una cliente **già in piano** che dichiara un'allergia fa scattare la visita obbligatoria: il
   piano si sospende, o continua mentre la visita si prenota?
4. ⛔ Il dizionario: la voce promossa a comune **sovrascrive** quella personale delle altre
   nutrizioniste o convivono?


---

## 17. Il giudizio, in chiaro

**Si può fare**, e dopo la verifica è più piccolo di come sembrava: `FoodSwap`, `EquivalenceGroup`,
`RuleProposal`, la coda «Da validare», il parser delle frasi e il calcolo del pool effettivo
**esistono già**. Il modello fa la parte facile — capire una frase — e ogni volta che potrebbe fare
danni, chiede.

Il lavoro vero è tre cose: **tradurre la lingua di Lucia nel catalogo** (il dizionario), **l'anteprima
che dice cosa succede davvero, incluso quando rompe** (il pool a vuoto), e **il registro con
l'annulla** (che è anche il collaudo). Se facciamo bene quelle tre, anche con due sole azioni,
abbiamo qualcosa di solido. Se facciamo la chat bella e quelle tre a metà, abbiamo un modo
velocissimo per fare danni difficili da vedere.

**Il rischio residuo non è tecnico**: è che dopo due settimane a Lucia risulti più veloce cliccare.
Si misura da solo — se il dizionario cresce e le regole aumentano, funziona; se dopo un mese ha nove
voci e quattro regole, abbiamo costruito una cosa bella che nessuno usa.
