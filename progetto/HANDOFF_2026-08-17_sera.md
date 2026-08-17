# Passaggio di consegne — Metabole, sera del 17/8/2026 (secondo turno)

Da incollare in cima a una chat nuova. **Sostituisce** `HANDOFF_2026-08-17.md` per le parti che si
sovrappongono; quello resta valido su tutto il resto. Tutto quello che c'è qui è verificato nel codice
o nei dati, non ricordato.

---

## 0. Come si lavora qui (queste regole vengono prima di tutto)

- **Si verifica nel CODICE, non nei documenti.** Se un documento e il codice divergono, ha ragione il
  codice — e lo si dice. Oggi è successo due volte, e in un caso il codice raccontava una storia
  **diversa e peggiore** di quella scritta nella nota (vedi §2.2).
- **Le decisioni si scrivono in un documento PRIMA del codice.** I fogli stanno in `progetto/`.
- **I test nuovi si vedono ROSSI prima.** E dove conta, **controllo per mutazione**: si disattiva la
  riga e si conta quanti test cadono. Oggi un test ha trovato un buco che il ragionamento non aveva
  visto (i numeri nella guardia della seconda lettura, §2.4).
- **Ogni consegna:** `COMMIT_parte_*.txt` + append a `progetto/COMMIT.txt` + voce in cima a
  `progetto/REGISTRO.md` + **Summary e Description in chat** (Simone li copia in GitHub Desktop) +
  **elenco lavori aggiornato** (`backend/src/lavori/voci-iniziali.ts`), senza che lo chieda.
- **File condivisi** (`schema.prisma`, `REGISTRO.md`, `COMMIT.txt`, `voci-iniziali.ts`, `seed.ts`): si
  rileggono dal Mac e non si sovrascrivono mai alla cieca. `REGISTRO.md` e `COMMIT.txt` si scrivono
  con `device_bash` e si **riverificano col grep**.
- ⚠️ **MAI comandi git sulla cartella montata**: lascia `index.lock` non eliminabili. Il commit e il
  push li fa Simone.
- Le migrazioni le applica **Render** al deploy, mai dal Mac.

### ✅ In sandbox si riproduce la CI VERA — l'handoff di stamattina sbagliava

Stamattina c'era scritto «in sandbox il client Prisma è uno stub, la verifica vera è sul Mac». **Non è
così**, e la memoria di progetto lo diceva già. Il client vero si genera in **768 ms**:

```bash
cd backend
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 \
PRISMA_SCHEMA_ENGINE_BINARY=/bin/true \
PRISMA_QUERY_ENGINE_LIBRARY=/bin/true \
CHECKPOINT_DISABLE=1 \
npx prisma generate --no-engine
npm run build && npx jest --ci
```

Da lì: **build verde e 3047 test in 198 suite**, cioè la CI intera, sul codice che tocca Prisma.
⚠️ **NON usare `npm run typecheck`**: fa la stessa cosa con un mirror HTTP finto e in sandbox
`prisma generate` **si pianta per sempre** su quella strada (provato due volte, oltre dieci minuti,
nessun output e nessun errore). Le variabili d'ambiente a mano, mai lo script.
⚠️ Il primo `npm install --ignore-scripts` lascia davvero lo stub: è quel momento a somigliare a un
vincolo. Non lo è.

### Come si consegna un file

Sandbox (clone di `origin/main`) → si scrive → `SendUserFile` → `device_commit_files` sul percorso
reale `/Users/simonesalogni/Progetti/Metabole/...` → **si verificano gli md5 dai due lati**.
⚠️ Prima di modificare un file condiviso, confronta l'md5 del clone con quello del Mac: se divergono,
Simone ha pushato nel frattempo.

---

## 1. Cosa gira adesso

**Il cron che riempie il catalogo** — `POST /internal/cron/genera-catalogo`, ogni 10 minuti. Simone:
**lasciarlo andare senza fretta, non toccarlo.** È temporaneo: si sospende quando il catalogo è pieno.
Quando la risposta smette di dire «N clienti su questa famiglia» e comincia a dire «nessun cliente
sopra», il lavoro utile è finito.

**La seconda lettura di Vera** — accesa da oggi. `AI_API_KEY` su Render **c'è già**: non va messo
niente. ✅ E l'interruttore `vera_seconda_lettura` lo scrive il seed al deploy — vedi la correzione
in §3.1.

---

## 2. Consegnato oggi pomeriggio (quattro push, tutte fatte)

### 2.1 Il digiuno: il catalogo lo decide la finestra — **verificato in produzione**

Sonia (`s.sandri66@libero.it`) riceveva **un pasto al giorno**. La variante `fasting` del catalogo ha
tre slot fissi (pranzo, merenda, cena) — è di fatto «salta la colazione» — e la finestra toglieva da
lì. Ora `pickDietFor` chiede un catalogo che **abbia** i pasti che la finestra promette
(`catalog/struttura-per-digiuno.ts`).

`npm run diag:digiuni` dopo il deploy: **Sonia riceve colazione, spuntino e pranzo**, servita da
`Flexitariana · vegetarian · 5` — stessa famiglia, stesso regime, cambia solo la struttura. Le cinque
su «salto la colazione» sono rimaste su `fasting`, intatte.

⚠️ **Non «il digiuno usa sempre il 5 pasti»**: nel catalogo digiuno quei tre pasti valgono il 100%
della giornata e nel 5 pasti il 70%. La regola **conta i pasti**, non elenca le finestre.

### 2.2 ⚠️ Il caso Lorena: la scheda mostrava il piano IN CODA come piano corrente

Questa è la cosa più importante di oggi, e **contraddice** quello che avevo scritto stamattina.
`pickMainSubscription` faceva `find(s => s.status === 'active')` su una lista `createdAt desc`: fra due
righe attive vinceva **la più recente**, cioè il piano in coda dal 25/08. **La scheda scriveva «Inizio
piano: 25/08»**, e la matita — che usa la stessa funzione — ha spostato quella riga. Chi l'ha aperta ha
corretto una data sbagliata: **ha fatto la cosa giusta con quello che le era stato mostrato.**

Chiusi anche gli altri tre punti che sbagliavano già oggi, senza bisogno di `queued`: `menu.service`
(`findFirst` senza `orderBy` → i giorni di menu dipendevano dall'ordine delle righe),
`pause.service` (i giorni di pausa sommati al piano in coda: concessi e mai ricevuti),
`coach.service` (`new Map` teneva l'ultima riga → `planEndDate` sbagliata in lista clienti).

Ora la scelta è una funzione sola: `commerce/abbonamento-in-corso.ts`. Chi eroga oggi; fra due
sovrapposti **quello che finisce più tardi** (⚠️ non «cominciato prima»: la cliente ha pagato fino alla
fine del secondo). Foglio: `progetto/NOTA_Chi_Sta_Erogando_Adesso.md`.

### 2.3 `diag:digiuni` gridava su un caso sano

Dopo il deploy la riga rossa non era sparita: al posto di Sonia c'era **Maria**, ed era un falso
allarme. ⚠️ E le due risposte avevano divergito **nello spazio di un'ora**: `menu.service` su Maria
taceva (giustamente) e la diagnostica la segnalava. Ora il giudizio lo dà la stessa funzione del
motore (`pastiPromessiCheMancano`), e chi è in digiuno senza finestra ha un elenco suo.

### 2.4 Vera: la seconda lettura

Il modello **riscrive** la frase nella forma canonica quando `capisci` torna `null`, e a decidere resta
`capisci`. ⚠️ **La parte che conta è la guardia** (`riscritturaAccettabile`): il modello può
*riordinare* le parole della frase, non *aggiungerne*.

⚠️ **I numeri si controllano a parte, e l'ha trovato un test**: il filtro delle parole scarta quelle
sotto le tre lettere, quindi «riduci le calorie a Giulia» → «riduci le calorie **del 30%** a Giulia» ci
passava in mezzo, e `capisci` le percentuali le legge. Se si tocca quella funzione, quel controllo non
si tolga.

---

## 3. Aperto

### 3.1 ~~L'interruttore della seconda lettura non è in tabella~~ — ✅ FALSO ALLARME

> ⚠️ **Correzione verificata nel codice** (17/8, chat di ripartenza). Il punto era sbagliato, e lo era
> per la ragione che questo stesso handoff mette al primo posto: era ricordato, non verificato.
> **Il seed gira a ogni deploy** — `render.yaml:48`,
> `preDeployCommand: (npx prisma migrate deploy || …) && npx prisma db seed`, con `package.json:80-82`
> che punta a `prisma/seed.ts`. E `seed.ts:1296-1300` fa `upsert` su tutti i `CONFIG_PARAMS`: `create`
> se la chiave manca, `update` che **non tocca `value`** («l'admin può averlo cambiato»).
> `vera_seconda_lettura` è in quell'elenco, `seed.ts:512-526`. Lo dice anche `REGISTRO.md` alla riga
> 5268: «il seed gira a ogni deploy».
> Quindi la riga in `config_param` **nasce da sola al primo deploy dopo `0ca728f`**: niente da creare
> a mano, niente script. **Resta solo da guardare** che il deploy sia verde e che la chiave si veda
> nella pagina Parametri; se il deploy non è ancora passato, passa col prossimo.

Il testo originale, per memoria: «è stato aggiunto a `prisma/seed.ts`, **ma il seed non gira su un
database che esiste già**» — non è così. L'unico caso in cui un interruttore promesso non arriva in
tabella è quando la chiave **non è nell'elenco del seed**: quello è il difetto vero di cui parla
`config-params.service.create` in testa («è già successo due volte»), e qui non si è ripetuto.

### 3.2 Il foglio della strada C sulle porzioni — DECISA, da scrivere

Simone ha scelto la **strada C**: il menu porta un **moltiplicatore** di porzione («pranzo, ×1,6») e le
calorie tornano con un catalogo solo. Risolve **anche** il buco degli spuntini tolti da Vera
(`pastiEsclusi`: la giornata perde il 20% e la nota in app dice che le kcal «sono ridistribuite», cosa
che il motore non fa).

⚠️ È lavoro su **motore, app e lista della spesa**, non uno script. Nel foglio vanno decise due cose:
il **tetto** del moltiplicatore, e **cosa fare quando il tetto non basta**. Stato di partenza: Sonia ha
i pasti giusti al **65%** del fabbisogno (era 45%). Voce 255.

### 3.3 `queued` come stato — non più urgente

I tre punti che mordevano sono chiusi (§2.2), quindi questo è diventato pulizia della causa. Voce 258.
⚠️ **Il censimento è già fatto, non rifarlo**: **47 letture** di `status: 'active'` su `Subscription` —
27 «solo active», 15 «anche queued», 5 da decidere (`coach-tasks:201`, `coach:104`, `commerce:1408`,
`commerce:1431`, `dashboard:148`), più 5 filtri in memoria. Il pattern: ogni query che filtra **anche
sulle date** è solo-active; ogni query che chiede «ha già comprato / ha convertito» va estesa a
`queued`, e sono quelle già scritte `status: { in: ['active','pending'] }`.
⚠️ Il vincolo in banca dati **non** va nella stessa consegna dello stato.

### 3.4 Le decisioni di Simone del 17/8 — non richiederle più

1. seconda lettura di Vera: **sì** (fatta);
2. due piani attivi: **prima i tre difetti di oggi**, poi `queued` (fatto il primo);
3. un piano in coda **conta** come «ha un piano» nelle schermate staff, perché è un contratto;
4. porzioni del digiuno: **strada C**.

### 3.5 Piccole, già diagnosticate

- **La matita che avvisa** prima di sovrapporre (voce 259): `abbonamentoInCoda` esiste già per poterlo
  dire, manca il pezzo che lo dice.
- Il pulsante × dell'annullamento è `@Roles('admin')`: **da capo nutrizionista non si vede.** ~30 min.
- Le due pastiglie di piano sono **identiche** (mostrano l'inizio, non la fine).
- **Maria** (`mariabonaccorso@hotmail.it`): digiuno senza finestra, mai chiesta. Voce 256.
- `menuDay.upsert` ha `update: {}`: un cibo non gradito dichiarato **dopo** non tocca i giorni già
  erogati, e nessuno lo dice.
- Il backoffice scrive `dislikedFoods` senza passare da `filtraSpezie`.
- Voce 252: `allergensReviewed` va azzerato quando cambiano gli ingredienti dal backoffice? Decide
  Simone, tre strade.
- Dopo il deploy: **«Aggiorna dal rilascio»** nella pagina Lavori (o `CONFERMA=1 npm run carica:lavori`).

---

## 4. I numeri, per non rifare le stesse domande

- **306 diete** in catalogo. Con qualcuno sopra: **16**, per **25 clienti**, in **12 gruppi** di
  ricette. Tutti `dimagrimento`, 11 su 12 `omnivore`: metà della griglia dei 18 non serve nessuno.
- **7 clienti in digiuno**: 5 su «salta colazione» (a posto), 1 su «salta cena» (Sonia, **sistemata**),
  1 senza finestra (Maria, non è un difetto).
- ⚠️ La famiglia **«Digiuno intermittente (16:8)» non ha la variante a 5 pasti** (12 caselle mancanti,
  tutte riempibili **senza AI**). Oggi non morde nessuno; morderebbe se una cliente di quella famiglia
  passasse a «salto la cena».
- ⚠️ **Aggiungere giornate NON aggiunge varietà**: il motore prende le ricette e ricompone
  (`dayComboPools`). Quello che una cliente percepisce è *quante ricette diverse ha ogni pasto*.

---

## 5. Il difetto di famiglia di questo progetto

**«Un dato che agisce e non si vede.»** Pagato ormai otto volte, e oggi due di quelle sono nuove: le
**calorie** di Sonia (i pasti mancanti non erano un errore, erano silenzio) e la **scheda di Lorena**
(mostrava una data vera di un piano sbagliato). Quando qualcosa non torna, la prima domanda utile è
quasi sempre: *questo dato cambia cosa mangia una persona, e c'è una schermata che lo dice?*

E il corollario di oggi: **due definizioni della stessa domanda divergono in un'ora.** Il motore e la
diagnostica sul digiuno si sono contraddetti lo stesso pomeriggio in cui li ho scritti. Se due punti
rispondono alla stessa domanda, uno dei due deve chiamare l'altro.
