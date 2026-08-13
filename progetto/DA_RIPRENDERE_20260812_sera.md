# Da riprendere — 12 agosto 2026, sera

Fotografia di fine giornata, scritta con Simone che chiudeva. **Tutto quello che c'è qui sotto come
«fatto» è già su `origin/main`**: la push è stata fatta prima di sospendere.

Tre elenchi: **cosa aspetta Simone**, **cosa aspetta Nocanty** (decisioni cliniche), **cosa aspetta
il prossimo turno di codice**.

---

## Fatto oggi, in due consegne

### Consegna 1 — le ultime tre delle sette decisioni del 12/8

Le risposte sono in `Decisioni_Simone_20260812.md`, scritte **prima** di toccare il codice.

- **Stelle** (`menu/punteggio.ts`, 17 test) — un piatto mai votato valeva **cinque** stelle, quindi
  nello stato «conforto» (umore basso per tre giorni → menu più amati) arrivavano piatti mai visti
  invece di quelli amati: lo stato faceva il contrario di quello per cui esiste. La formula stava
  dentro una closure e nessun test la guardava. Ora vale zero, con scala `(stelle − 1) / 4`.
- **«Riceve i menu?»** (`common/piano-attivo.ts`, 8 test) — la diagnostica contava fra le «attive che
  ricevono» chi è in Monitoraggio, in pausa vacanza o col piano fermato. Ora usa le stesse tre
  esclusioni di `deliverIfEligible`.
- **«Qual è la dieta assegnata?»** (`catalog/dieta-mostrata.ts`, 8 + 6 test) — la correzione dell'11/8
  (caso Cristina) era stata applicata **solo al backoffice**; nel Profilo dell'app la riga sbagliata
  è rimasta, e lì la legge la cliente. Ora la ricerca è una sola per entrambe le schermate.

### Consegna 2 — allergie e intolleranze, punti A, B, C, D dell'handoff

- **`frutta_a_guscio` non escludeva niente** — il questionario salva l'underscore, la mappa conosce
  gli spazi. Corretto normalizzando dentro `expandExclusion`. Aggiunti `sedano`, `senape`, `lupini`.
- **«altro» non è un alimento** — filtrato lato server, in entrambi i rami dell'upsert.
- **Migrazione `20260812250000_allergie_testo_libero`** — `allergies_other` e
  `allergie_dichiarate_il`. Additiva, applicata e verificata su PG16 insieme a tutte le precedenti.
- **Le allergie si vedono** — riga in sola lettura nel backoffice e nel profilo dell'app, più le
  etichette nel registro modifiche.

Backend **2170 test verdi**, app 50 verdi, `tsc` al baseline sui tre progetti (i soliti 2 errori
pre-esistenti in `prisma/approve-diets.ts` e `prisma/dedupe-diets.ts`).

---

## 1. Cosa aspetta SIMONE

### ⚠️ Il deploy, nell'ordine giusto

L'ordine non è quello in cui è stato scritto il codice:

1. **Migrazione + backend su Render.** ⚠️ Il backend nuovo deve reggere l'**app vecchia**: è già
   verificato che una scrittura senza le colonne nuove funziona (default `{}` e `NULL`), ma il
   collaudo va rifatto in produzione.
2. **Backoffice su Vercel** — le righe delle allergie in sola lettura.
3. **OTA dell'app** — **solo dopo** che il backend è in produzione e verificato. La riga delle
   allergie nel profilo cliente sta lì dentro.

⚠️ Il numero di versione OTA **non si riusa mai**: la prossima parte da **2.1.8**.

### Tre decisioni che bloccano lavoro già scritto

- ✅ **Chi può modificare le allergie** — **deciso e fatto il 13/8.** Permesso `change_allergies`
  («Modifica allergie»): nutrizionista, capo nutrizionista, admin. Scheda cliente **e** scheda lead.
- **La visita obbligatoria in caso di allergia** (§8 dell'handoff). Hai già deciso il principio:
  intolleranza → nessuna visita, allergia → visita medica obbligatoria. Resta aperta la domanda
  meccanica: **una cliente già in piano che ora dichiara un'allergia — il piano si sospende, o
  continua mentre la visita si prenota?** Finché non c'è risposta non va implementato nessun blocco:
  il rischio è sospendere piani attivi a clienti paganti per un campo introdotto oggi.
- **La campagna di ri-domanda** (§7). ⚠️ **Prima di lanciare qualsiasi cosa, contare.** Vanno
  contattate solo tre popolazioni (chi ha `'other'` fra le intolleranze; chi ha allergie a testo
  libero mai codificate; chi ha tutto vuoto e questionario completato). Se la terza fossero 280
  clienti su 315, **non è una campagna: è un difetto del questionario da correggere prima**.

### Cose in sospeso da prima di oggi

- **§15.2 punto 1** — «Conferma» che applica la proposta: aspetta il numero di kcal da Nocanty.
- **Mercoledì 19/8** — rimuovere `traccia-diet-family` (il lavoro programmato esiste, il file c'è
  ancora).
- **Schermate app 30 (assaggio menu) e 27-28 (video onboarding)** — non iniziate, servono decisioni.
- **Aggiornamenti grossi** (React 18, Vite 5, Prisma 6, Capacitor 6) e i thread lunghi del §9.

---

## 2. Cosa aspetta NOCANTY

- ⛔ **L'elenco dei solfiti.** Oggi l'esclusione testuale ha solo la parola letterale, ed è
  dichiarato nel codice e in un test. I solfiti non si scrivono negli ingredienti: stanno nel vino,
  nell'aceto balsamico, nella frutta disidratata, in certi salumi e conserve. Quell'elenco decide
  quali piatti si tolgono dal piatto di una cliente, e **in eccesso si sbaglia facilmente**. Non lo
  scrive chi scrive il codice.
- ⛔ **Il «freno forte»** per le allergie non confermate. La colonna `allergie_dichiarate_il` c'è e
  si scrive, ma **nessun comportamento parte da lì**. La forma minima e sicura sarebbe: segnalare la
  cliente come da rivedere e mostrare «allergie non confermate» nella scheda. Non bloccare piani.
- ⛔ **La scala dei passi.** Partenza per fascia di attività (6.000 sedentaria → 12.000 molto
  attiva), +5% ogni due settimane, tetto a +40%. Per chi ha problemi cardiaci, articolari o è in
  gravidanza, prescrivere passi è materia clinica.
- ⛔ **Il peso dell'efficacia nei menu.** Novità di oggi da segnalarle: con i pesi di default un
  piatto a **5★ ora pareggia esattamente** un piatto efficacissimo bocciato a **1★**. Prima vinceva
  sempre l'efficacia. Per spostare l'ago si alza `menu_select_w_eff` dai Parametri — è una manopola,
  e va girata da lei.

---

## 3. Cosa aspetta il prossimo turno di codice

In ordine di quanto sono pronti.

### Pronti, non bloccati da nessuno

- **`intolerancesOther`** (§1.3 dell'handoff). Le intolleranze hanno l'opzione `'other'` **senza
  nessun campo libero associato**: chi la sceglie si porta in banca dati la stringa `'other'`, che
  non vuol dire niente e non esclude niente. **Chi ha scelto «Altro» ha un'intolleranza che noi non
  sappiamo.** Serve una colonna, un campo nel questionario, e allora `'other'` si può filtrare —
  oggi **non si filtra apposta**, perché è l'unica traccia per ricontattarla.
- **L'opzione «nessuna» fra le allergie del questionario** (§3.1). Le intolleranze ce l'hanno già
  (`'none'`). Finché non c'è, un array vuoto conta come «non risposto», non come «non ne ho».
  ⚠️ È una modifica all'app: va con la OTA.
- ✅ **La trappola dell'upsert** — **fatta il 13/8.** Era vera: chi rifaceva il questionario saltando
  la pagina delle allergie le perdeva tutte. Ora il questionario **aggiunge e non toglie**
  (`common/non-perdere.ts`), con audit e una schermata che lo dice alla cliente. I cibi non graditi
  restano modificabili, perché quelli lei li gestisce dal Profilo.

### Il pezzo grosso: la ri-domanda in chat con Gaia (§7)

Il modello da copiare **non** è «Conosciamoci» (che non è una conversazione), è **`data-inizio-chat`**:
`menu/data-inizio-chat.ts` + `.service.ts`, con `apriDaTesto()` / `avanza()`.

Le trappole già mappate, tutte verificate:

- Lo stato vive nel `meta` dell'ultimo messaggio di Gaia (`chat.service.ts`, `flussiAperti`), e
  **se ne può aprire uno solo alla volta**: il nuovo sarebbe la terza chiave, da inserire
  nell'ordine di precedenza.
- ⚠️ **Il flusso scade dopo un'ora**. Se la cliente apre la notifica il giorno dopo, il dialogo
  **va riaperto, non ripreso**.
- ⚠️ **In chat non esistono pulsanti**: bolle di testo puro e input libero. Serve un parser
  tollerante sul modello di `leggiData`, con la regola dei **due tentativi poi passa alla coach**.
- ⚠️ **Le risposte in testo libero non si salvano come arrivano.** «i latticini», «la frutta secca
  ma solo le noci» vanno trasformate in codici **proponendo e facendo confermare** — «ho capito
  *frutta a guscio*, giusto?». Se il termine non si riconosce va in `allergiesOther` e lo codifica
  la nutrizionista: è la regola di `impara-dalla-chat.ts`, *nel dubbio non si impara*.
- Siamo su un dato sanitario: **transazione e `audit.log`**, non la forma semplice.
- La notifica manda **fatti** nel payload (`counterpart: 'ai'`, `kind: 'allergie_conferma'`), la
  rotta la compone l'app. ⚠️ `title` e `body` **non sono colonne**, vivono dentro `payload`. ⚠️
  `datiPush` passa **solo stringhe**: un numero o un `null` fa fallire l'invio intero.
- Lo script della campagna: template `prisma/assegna-senza-glutine.ts`. **Dry-run di default**,
  scrittura solo con `CONFERMA=1`, registrato in `package.json`. ⚠️ Lezione di
  `accendi-automazioni.ts`: uno script pensato per accenderne tre ne ha **spente venti**, perché
  lavorava a opt-out. Il dry-run si legge riga per riga.

---

## 4. Due cose da non dimenticare, che valgono per chiunque riprenda

- ⚠️ **Non eseguire comandi git sulle cartelle montate del Mac.** Lascia `.git/index.lock` che git
  non riesce a togliere («Operation not permitted») e blocca i commit di Simone. È già successo
  oggi: due lock sono finiti in `_to_delete/git-lock/`.
- ⚠️ **Il testo libero delle allergie resta dentro `allergies`.** `allergiesOther` è un **marcatore**,
  non uno spostamento — sette punti del codice leggono `allergies` per escludere davvero gli
  alimenti. Se qualcuno «pulisce» quella ridondanza, disarma tutti e sette in silenzio. Il perché
  per esteso è in testa a `common/allergie.ts` e a `HANDOFF_Allergie_Intolleranze.md`.
