# Metabole — punto della situazione

**Scritto nella notte fra il 10 e l'11 agosto 2026.** Questo documento è **uno**: dove sta il prodotto, cosa è aperto, cosa
aspetta una persona, e le regole che non si scoprono leggendo il codice. Sostituisce
`DA_FARE.md`, i tre `DA_RIPRENDERE_2026080*.md`, `STATO.md` e `STATO_LANCIO.md`, che da oggi portano in
testa un rimando qui.

`REGISTRO.md` **non** viene chiuso: è il log cronologico di cosa è stato fatto, si aggiunge in cima e
non si riscrive. Questo documento risponde a un'altra domanda — «come siamo adesso» — e i due non si
sovrappongono.

> **Se stai riprendendo il lavoro, parti da §16**: è la coda aperta dell'11/8, con le decisioni già
> date da Simone e il codice ancora da scrivere. La più grossa è la **§16.1**, l'attivazione automatica
> di «Conosciamoci» a fine questionario — analisi dei punti di rottura già fatta, non va rifatta.
>
> **Poi §15.** Raccoglie le decisioni prese in conversazione l'11/8
> — la coda del nutrizionista, l'azzeramento del calcolo del calo, il blocco del piano, le varianti con
> giornate incomplete, la soglia del calo di sicurezza — che non stanno in nessun altro file. Sono
> decisioni **già date da Simone**: non vanno richieste di nuovo.
> Vale anche una convenzione nuova: **ogni consegna** esce con summary e description (scritte in
> `progetto/COMMIT.txt`, da usare con `git commit -F progetto/COMMIT.txt`) e una voce nel `REGISTRO.md`,
> **senza che Simone debba chiederle**.

> ⚠️ **Date riallineate l'11/8/2026.** Questo documento e il `REGISTRO` erano avanti di uno o due
> giorni: il lavoro fatto la sera tardi veniva scritto sotto la data del giorno dopo, e lo scarto si
> è accumulato. Le date sono state riportate a quelle vere dei commit su `origin/main` (`git log`):
> quello che qui era «il 13/8» è l'11, «il 12/8» è il 10. **Prima di scrivere una data, guardala.**
> L'11/8, credendo che fosse il 13, ho letto «l'ultima decisione del motore è dell'11» come «il cron
> è fermo da due notti» e ho aperto un allarme su una cosa che stava funzionando: l'assunzione era
> nella data, non nei dati.

---

## Come è stato verificato, e perché la cosa va detta

La lista del 10 agosto conteneva **sette voci false**. Tutte per la stessa ragione: le avevo lette da
un clone del repository vecchio di quattro giorni, dandolo per attuale. Erano la cancellazione account
(era una prova di Simone, già sbloccata), Rosaria senza pranzo e cena (piano concluso il 22/07), le
provvigioni di rinnovo (già implementate per costruzione), «l'app non ha un test runner» (ha vitest),
il promemoria misure (c'è, cron ogni due ore), `app/package.json` non allineato (è allineato), e due
documenti «persi» che invece esistono.

Un allarme falso costa più del silenzio: dopo due o tre non si crede più alla lista. Le voci di questo
documento sono verificate **sul ramo pubblicato** (`origin/main`, commit `f905a61` del 10/8) e non su una
copia locale: per ognuna delle voci controllabili nel codice ho riletto il file **da GitHub** e cercato la
riga. L'elenco di cosa è stato controllato e come sta in appendice (§14). Le voci marcate **[dati]** non
sono verificabili da nessun repository: dipendono dal database di produzione, e chi le chiude deve
guardare lì.

---

## 1. Dove siamo

Il prodotto è **in produzione con clienti vere** (~45), su tre superfici: backend NestJS su Render, web
app e backoffice su Vercel, app nativa iOS/Android con aggiornamenti OTA self-hosted. Ultima OTA
pubblicata: **2.1.6** (11/8), verificata sul manifest — vedi §5.1.

Stato tecnico all'ultimo commit: **1611 test backend verdi** (105 suite), **27 test app**, type-check a
**ZERO errori**, backoffice e app che compilano. Le migrazioni girano da sole a ogni deploy
(`preDeployCommand`), il seed dopo di esse.

⚠️ **La regola «42 errori = verde», poi «32 = verde», NON VALE PIÙ: il verde è ZERO.** Quei numeri
erano rumore dello stub di Prisma in sandbox, e un numero di rumore non distingue il rumore da un
errore vero: l'11/8 un errore vero è passato in mezzo, ha superato 1578 test verdi ed è esploso nel
build di produzione. Da ora il type-check si lancia con **`npm run typecheck`** dentro `backend/`,
che genera i **tipi veri di Prisma** e fa lo stesso controllo di Render. Come funziona (e cosa lascia
in `node_modules`) sta scritto in testa a `backend/scripts/typecheck-reale.mjs`.

Nelle ultime quattro giornate di lavoro (9→10 agosto) sono state chiuse più di novanta voci: il grosso
sta in `REGISTRO.md`. I filoni che hanno cambiato il prodotto: la banca dati nutrizionale che tiene Gaia
ancorata a numeri con una fonte, il cambio piatto in chat con le regole di sicurezza, il senza glutine
in produzione, la revoca del consenso e la cancellazione a 30 giorni, i permessi che risalgono la rete
dello staff, la pagina Copertura catalogo, e sui soldi l'idempotenza del rinnovo garantita dal database.

---

## 2. La sequenza dei piani — l'invariante da non rompere

Deciso da Simone, e va **verificato a ogni modifica del Negozio o del carrello**:

```
Apprendimento (8 giorni gratuiti)
   → Dimagrimento
      → [obiettivo raggiunto] Mantenimento
         → [a mantenimento SCADUTO e non rinnovato] Mantenimento di nuovo, oppure Monitoraggio
```

**Come è protetta oggi (verificato nel codice).** La regola è scritta in **due** punti, e servono
entrambi:

- `listPlansForClient` nasconde il Mantenimento se l'obiettivo non è raggiunto e il Monitoraggio a chi
  non ha fatto il Mantenimento;
- `assertPlanPurchasable` **rifiuta l'acquisto** anche se qualcuno arriva con il `planId` in mano:
  nascondere una voce dalla vetrina non è una regola, è un suggerimento. L'acquisto è una POST, e la
  regola va detta dove si decide davvero. Verificato che sia chiamata da **entrambe** le strade
  d'acquisto (righe 494 e 650 di `commerce.service.ts`): una sola delle due lascerebbe una porta aperta.

«Obiettivo raggiunto» significa: esiste un `Objective` con `targetWeightKg` **e** l'ultima misura è
`<=` a quel peso. Il catalogo pubblico (senza login) non mostra né Mantenimento né Monitoraggio.
L'acquisto manuale da backoffice è **volutamente** esente: lì c'è un'operatrice che sa com'è messa la
cliente (peso misurato in studio e non ancora inserito, per esempio).

### Lo scostamento trovato, e la decisione presa (10/8)

Il codice chiedeva di *aver avuto* il mantenimento, contando anche gli abbonamenti `active`: quindi il
Monitoraggio compariva dal **primo giorno** di mantenimento, e una cliente che pagava €49 oggi vedeva
già l'opzione da €19.

**Deciso da Simone e IMPLEMENTATO l'11/8:** il Monitoraggio si mostra **solo dal giorno dopo che il
mantenimento è scaduto e non è stato rinnovato.** Finché il mantenimento è in corso — o è stato
rinnovato — il Monitoraggio non esiste per lei.

Come è fatto: `statoMonitoraggio` in `commerce.service.ts` fa due domande e le mette insieme — esiste un
mantenimento con la **fine già passata**, e **non** ce n'è uno ancora in corso. Il confronto è per
**giorno**: un mantenimento che finisce oggi resta in corso fino a domani, altrimenti il monitoraggio
comparirebbe a mezzanotte e un minuto dell'ultimo giorno pagato. La stessa condizione vale nella vetrina
**e** all'acquisto, perché il difetto storico di quest'area è stato proteggere solo la vetrina.

I tre casi al bordo, ognuno con un test:
- **disdetto ma con la fine nel futuro** → non si mostra: il mese pagato è suo. Per questo il controllo
  di «in corso» accetta anche `cancelled`, non solo `active`;
- **rinnovato** → non si mostra: il rinnovo sposta la fine in avanti sulla stessa riga;
- **più mantenimenti nella storia** → basta che uno sia concluso e che nessuno sia in corso.

E due messaggi distinti invece di uno: «finché è in corso continui con quello, senza pagare due volte»
per chi lo sta usando, «viene dopo il Mantenimento» per chi non l'ha mai fatto. Dirle la frase sbagliata
la manda a chiedere alla coach una cosa che non serve.

Nota di prodotto, perché la regola non è neutra: così il Monitoraggio è una **scelta di rientro** e non
un'alternativa più economica offerta mentre sta pagando il mantenimento.

Una cosa da sapere per il futuro: la stessa domanda esiste **anche** in `monitoring.service.myStatus`
(la card in app). Lì il risultato è già corretto, ma per un'altra strada — un mantenimento in corso è un
abbonamento attivo, e quel controllo c'era già. Non sono lo stesso codice perché `CommerceService`
dipende già da `MonitoringService` e chiamarlo al contrario chiuderebbe un ciclo fra i moduli: vanno
tenute d'accordo a mano, ed è scritto in entrambi i file.

---

## 3. Le prime cose (nessuna sta danneggiando qualcuno *adesso*)

### ~~3.1 Varianti visibili con giornate incomplete~~ — CHIUSA nel codice l'11/8 (vedi §15.4)
> L'erogazione ora serve **solo le giornate complete**, scende sulla gemella quando la variante non ne
> ha nessuna, e se nemmeno le gemelle reggono non eroga e apre una segnalazione. Restano da
> **completare le giornate a catalogo** — quello è lavoro del nutrizionista, e il codice adesso lo
> dice invece di servire una giornata monca.

`Vacanze in Serenità · onnivora · dimagrimento · 3 pasti`: 28 giornate, **zero pranzi e zero cene**.
Nessuna cliente attiva la riceve — l'unica che l'ha avuta ha il piano concluso dal 22/07 — quindi la
trappola è armata per la prossima che la sceglie. Si chiude generandole la settimana 1, che è comunque
la prima riga del lavoro sul catalogo (§6). Sulla stessa lista, tutte senza clienti attive:
`Pescetariana · onnivora · dimagrimento · 5 pasti` e altre dieci varianti con una o due giornate monche.
Comando: `npm run diag:menu-incompleti` (ha la colonna «di cui attive», che è quella che conta). **[dati]**

### 3.2 `lovcarbciccio` era pubblicata e visibile
Bozza di prova approvata per sbaglio da `pubblica:tutto` del 9/8. **Simone l'ha eliminata l'11/8.**
Resta da archiviare la bozza duplicata `Keto-Mediterranea (5 pasti)`. Non esiste uno script
`archivia:dieta`: si fa da Backoffice → Catalogo diete. **[dati]**

### 3.3 Due clienti senza glutine: prima guardare se hanno un piano attivo
L'assegnazione è del 10/8, ma i menu già erogati restano finché non si preme **«Rigenera menu»** dalla
scheda. Se sono a piano concluso non c'è niente da rigenerare. Si trovano dalla pastiglia «senza
glutine» in Elenco clienti. **[dati]**

### ~~3.4 Segnalazioni cliniche di luglio senza destinatario~~ — CHIUSA l'11/8
`npm run fix:segnalazioni` lanciato in produzione: **nessuna segnalazione orfana, tutte hanno un
destinatario**. Le due di Giusy — del 17 e del 22 luglio, una è «calo rapido 2,87 kg/settimana» —
erano già state adottate dalla passata dell'8/8. La voce restava aperta perché nessuno aveva
riguardato **dopo**: una cosa fatta e non verificata resta in lista esattamente come una non fatta.

### 3.5 Il gruppo di equivalenza del collaudo panna è globale
Creato per il collaudo del 9/8 e mai ripulito: vale per **tutte** le clienti.
`PULISCI=1 CONFERMA=1 npm run collaudo:menu-panna -- <email>`. **[dati]**

---

## 4. Soldi

Il momento è adesso: finché nessun rinnovo automatico è passato si correggono regole. Dopo diventano
revisioni di compensi già erogati.

### 4.1 Decisioni che aspettano te
- ~~**Il Monitoraggio dopo quanto?**~~ **Deciso il 10/8, fatto l'11/8**: solo dal giorno dopo che il
  mantenimento è scaduto e non è stato rinnovato. Vedi §2.
- ~~**Percentuali del «Percorso Metabole 3 mesi»**~~ **CHIUSA l'11/8 da Simone**: verificate sulle
  vendite reali, i compensi che escono sono quelli giusti. Niente ricalcolo da lanciare.
- ~~**Prezzi a DB da confermare**~~ **CHIUSA l'11/8 da Simone**: i prezzi veri sono quelli del
  **Negozio**, e da lì si aggiornano ovunque da soli. Verificato nel codice: il report legge sempre
  `plan.priceCents` dal database, con la promo gestita da `listPriceCents` + `promoEndsAt`
  (`plan-report.service.ts:118`) — non c'è nessun prezzo scritto a mano nel percorso del report, e il
  seed non sovrascrive quello che è già a database. **Il report si può mandare a una cliente vera.**
  ⚠️ **Un residuo, piccolo e vero**: il testo del task che arriva alla coach quando scade il codice
  personale ha i prezzi scritti dentro la frase — «(1 mese €99 · 3 mesi €249)»,
  `coach-tasks.service.ts:206`. Quello **non** segue il Negozio: il giorno che cambi un prezzo, la
  coach legge il vecchio e lo ripete alla cliente. Da leggere dal piano, come fa il report.
- **Provvigioni di rinnovo: resta aperta solo la parte che nessuna vendita può ancora aver
  verificato.** Le percentuali sono confermate (sopra), ma «chi prende i soldi **al rinnovo** se la
  coach nel frattempo è cambiata» non si vede nei compensi già erogati, perché **nessun rinnovo
  automatico è ancora passato** (§4.2). Lo schema dice «solo se la coach è ancora quella assegnata»
  (che suona come *altrimenti non paga nessuno*), il servizio dice «paga chi c'è adesso», e **il
  codice fa la seconda**, per costruzione: la catena si calcola sempre su `profile.assignedCoachId`.
  Se intendevi la prima, si cambia prima che parta il primo rinnovo — dopo diventa una revisione di
  compensi già erogati.
  Collegato e già deciso da te il 7/8: al rinnovo di una cliente **senza coach** la provvigione viene
  accantonata e pagata a chi verrà assegnato — su un rinnovo significa far incassare a una coach futura
  una rendita costruita da un'altra.

### 4.2 Il primo addebito ricorrente vero non è mai passato
Codice e Stripe risultano a posto e l'idempotenza ora è garantita dal database, ma nessun rinnovo reale
è mai avvenuto. Serve un acquisto con carta vera e poi il rimborso. **[dati]**

### 4.3 Aperto, minore
- **Il passaggio al Monitoraggio a pagamento è tracciato nel funnel come «dimagrimento»**
  (`monitoring.service.ts`: `period === 'maintenance' ? 'mantenimento' : 'dimagrimento'`).
- **Ordini «Menu di rientro (8 giorni)» eventualmente in sospeso**: il prodotto è ritirato e il ramo che
  erogava le giornate è stato rimosso; se resta un bonifico da €29 in attesa e qualcuno lo approva, la
  cliente si ritrova 8 giorni di abbonamento senza le giornate. Guardare in Acquisti. **[dati]**
- **La riga da €130 nel ledger di agosto** (piano del socio, attivazione manuale che non doveva
  contabilizzare): la regola ora è giusta, il movimento già scritto no. Con
  `CONFERMA=1 PAGAMENTI=<id> npm run fix:attivazioni-manuali`, **mai in blocco** — `method: 'manual'`
  comprende anche vendite vere. **[dati]**

---

## 5. App e rilascio

### 5.1 La OTA 2.1.6 è PUBBLICATA — 11/8
Il manifest risponde `{"version":"2.1.6", "url":".../bundles/metabole-2.1.6.zip"}`, letto dal browser
sul backend vero. Porta alle clienti il **banner della pesata del ciclo**
(`awaiting_cycle_measure`) **col pulsante che apre il modulo della pesata** — è quello che serve a
Giusy — e lo sblocco della coach che diventa promemoria invece di muro.
Verifiche fatte sullo zip **prima** di pubblicare: `index.html` alla radice, `push-tokens` × 2 e
listener `registration` presenti (le push non spente dal build), la stringa `2.1.6` compilata dentro
il JS, e — controllo nuovo — **una stringa della funzione che l'OTA deve portare**
(`awaiting_cycle_measure`). Il solo numero dimostra che il bundle è nuovo, non che contenga la cosa
per cui lo stai pubblicando: un `dist/` vecchio ricostruito passerebbe tutti gli altri controlli.
**Bruciate fino alla 2.1.6 compresa: la prossima OTA parte da 2.1.7.**

La **2.1.5** (10/8) aveva portato data e ora nei messaggi in chat, il pulsante «Sposta la data di
inizio» nel profilo e la scelta abbonamento / mese singolo nel primo acquisto (il pulsante al Checkout
c'era già nella 2.1.4: mancava il dato che lo fa comparire).

### 5.2 Le trappole che si ripetono
- **`OTA_VERSION` va svuotata su Render PRIMA di ogni pubblicazione sugli store**, altrimenti
  un'installazione fresca scarica un bundle più vecchio del nativo appena installato. È già succeduto il
  6/8.
- **I bundle si costruiscono solo dal Mac**, con `app/google-services.json` presente (è gitignorato): un
  bundle costruito senza quel file **spegne le push** su tutti i telefoni che lo ricevono, in silenzio.
  Lo script si rifiuta di costruirlo, ma la guardia va lasciata dov'è.
- **Un numero di versione non si riusa MAI**: Capgo confronta la stringa, non il contenuto. Il 6/8 tre
  bundle diversi sono usciti tutti come «2.0.1» e chi aveva già scaricato il primo è restato fermo.
- **iOS**: il certificato Apple Distribution **scade ogni anno** e senza quello l'archivio si firma in
  development e le push si spengono in silenzio; `ios/` viene rigenerato a ogni `cap add`, quindi
  capability e plist li rimette `install-ios.mjs` — non a mano.
- La procedura per intero sta in **`progetto/guide/COME_SI_FA_UNA_OTA.md`**, che è aggiornata e copre
  anche la tabella «sintomo → causa».

### 5.3 Lavori app non fatti
- **`menuAncoraSullaDietaPrecedente`**: il backend lo manda in `/me/nutrition`, e nel sorgente dell'app
  **non compare in nessun file** (verificato su `origin/main`, cercandolo in tutti i file di `app/src`). O l'app lo usa (mostrando alla cliente che i menu in corso sono della
  dieta precedente), o il backend smette di mandarlo.
- Rifiniture rimaste: anteprima menu (schermata 30), widget «tutto pronto» (34), video 27-28, schermi 29
  e 33.
- **La logica sta dentro i componenti**, ed è per questo che i test dell'app sono solo quattro file in
  `src/lib/`. Non manca il runner: manca l'abitudine di tirare fuori la regola. La strada che funziona
  l'ha mostrata `pianoCarrello.ts`.

---

## 6. Il catalogo: le 12 settimane

> **Chi lo fa, deciso l'11/8: il catalogo lo crea il NUTRIZIONISTA.** Quando ha finito ce lo comunica
> e noi **verifichiamo** — non è più lavoro in coda allo sviluppo. La verifica è la parte che resta
> nostra, ed è la ragione per cui il protocollo qui sotto va lasciato scritto: su Copertura catalogo,
> col selettore della settimana, ogni pasto previsto deve essere verde con 7. Le voci sotto restano
> come **istruzioni per chi genera** e come promemoria di cosa guardare quando arriva il «fatto».

**Stato**: Basso indice glicemico a 12 settimane · Mediterranea senza glutine **a 12** (fatta il 10/8) ·
DASH a 4 · le altre 16 famiglie a **zero settimane piene** (28 giornate costruite con 5 piatti per pasto,
cioè ogni piatto torna cinque o sei volte al mese). Niente da compattare, 1 riferimento rotto residuo che
si pulisce rigenerando.

**Il lavoro**: ~200 generazioni (una per settimana per famiglia, con la spunta «genera tutte le
varianti»), 3-5 minuti ciascuna: **13-14 ore** spalmabili. Il costo AI è reale e va misurato — la spesa
delle 12 settimane della senza glutine è il campione per stimare il resto.

**Il protocollo, e l'ordine conta il doppio**:
1. partire **sempre dalla variante a 5 pasti** di ogni famiglia: le altre riusano le sue ricette senza
   chiamare l'AI. Partire dalla 3 pasti significa pagare due volte;
2. l'ordine delle famiglie sta in **`progetto/guide/Metabole-Guida-settimane-menu.pdf`**, e
   `npm run diag:settimane` lo ricalcola sui dati di oggi;
3. prima le varianti con **clienti attive**, poi le famiglie con clienti, poi il resto;
4. se compare **pasti incompleti**, quella settimana va rigenerata, non validata;
5. alla fine «Valida e pubblica tutte le varianti», e controllo su **Copertura catalogo** col selettore
   della settimana: verdi con 7 su ogni pasto previsto.

**Le ~270 varianti senza nessuna cliente**: con la generazione in mano al nutrizionista la domanda
cambia — non è più «chi trova 13-14 ore», è **fino a dove vale la pena arrivare**. Restano sul tavolo
togliere dal questionario le combinazioni che non sceglie nessuno, e lo script che le macina in
background (costo AI, e nessuno le rivede prima che una cliente le riceva). Da riprendere quando il
nutrizionista dice a che punto è arrivato: prima non ci sono i numeri per deciderlo.

**Aperto e senza soluzione**: «alcune cene come colazioni». L'impianto degli slot è corretto, quindi i
piatti nello slot sbagliato arrivano dal modello. Serve una passata di revisione, da costruire su casi
veri quando Nocanty ne segnala.

---

## 7. Guardrail spenti per scelta

Tre protezioni esistono e non girano. Sono spente **deliberatamente** — il catalogo del motore le
descrive «Di norma OFF» e si accendono da Parametri, senza deploy. Restano scritte qui perché il silenzio
di una protezione spenta è indistinguibile da «tutto bene».

- **`low_adherence_days` = 0** (zero = spenta): una cliente che smette di fare check-in non genera
  nessuna segnalazione alla coach.
- **`no_progress_escalation` = false**: lo stallo del peso viene calcolato e non segnalato.
- **`menu_daycombo_enabled` = false**: la composizione della giornata sul fabbisogno calorico è spenta,
  si usa solo il template. È anche la precondizione tecnica della personalizzazione (§9.2).

Verificato oggi, e non è un buco: `diet_blocked` e `no_progress` **arrivano anche alla coach**, ma non
grazie al campo `also` della tabella di instradamento — `decidiDestinatari` mette fra i destinatari
sempre sia la coach sia la nutrizionista assegnate. Quel campo descrive una cosa che accade per altra
via.

Tre controlli nutrizionali dichiarati inerti o approssimati:
- **Il vincolo keto** («carboidrati < 50 g/die, 20-30 g netti — vincolo non negoziabile») vive **solo nel
  prompt all'AI** (`engine-rules.presets.ts:58`): nel catalogo del motore non esiste **nessun** parametro
  sui carboidrati, e il file dei preset lo dichiara da sé in testa («le soglie in grammi assoluti…»).
  Verificato oggi: è l'unica promessa clinica del prodotto e non è applicata dal codice — la rispetta chi
  scrive le ricette, o non la rispetta nessuno.
- **La ripetizione bigiornaliera** cerca la ricetta gemella solo fra gruppi di equivalenza `approved`:
  finché la nutrizionista non ne approva, il parametro si può accendere e la regola resta muta.
- **La quota proteica della giornata** è una media semplice dei piatti, non ponderata sulle kcal: una
  giornata può passare `menu_daycombo_protein_min` ed essere sotto soglia.

---

## 8. In attesa di persone

### 8.1 Nocanty (nutrizionista)
- **Le grammature dei grassi**, ed è la più vecchia: serve **un numero per alimento** (grammi
  equivalenti a 100 g di un riferimento del gruppo). Documento e PDF pronti da mandarle in
  `progetto/Metabole_Grammature_Grassi_Domande.md`. Bloccanti: **Q1** e **Q3**. Finché non decide, il
  cambio in chat propone pari grammatura — che su «carote / biete / spinaci» va bene e sui grassi no (70 ml
  di panna ≈ 200 kcal, 70 g di burro ≈ 500, 70 g di olio ≈ 630). Attenzione all'inciampo: il limite di
  plausibilità già attivo (un terzo–triplo) **rifiuterebbe** un fattore sotto 0,33, facendo ripiegare
  Gaia sull'errore che stiamo togliendo. Mitigazione già in produzione: la nutrizionista corregge i
  grammi a mano dalla scheda.
  **Mai collaudata**: la conversione ml → g su un profilo vero. Serve un'utenza di prova **senza
  lattosio** fra le esclusioni, altrimenti il sostituto proposto è l'olio, che resta in ml.
- **La coda «da confermare» dei valori nutrizionali**: ~60 alimenti seminati con la fonte, Gaia li usa
  già, ma nessuno li ha guardati. E `nutrient_lookup_miss` conta quante volte le clienti hanno chiesto
  un alimento che non abbiamo: «tempeh chiesto 40 volte» è la prossima riga da scrivere.
- **Gruppi di equivalenza in bozza**: il motore li usa solo se approvati. L'avviso ora parte.
- **Contenuti**: Proteica sportiva ancora da approvare · grammature reali e **firma sul Keto** · le 142
  ricette da portare su `onnivora · dimagrimento · 5 pasti` · le 18 diete «Pescetariana» con regime
  onnivoro/vegetariano/vegano (nome o regime sbagliato) · per una cliente **celiaca** servono la sua
  validazione e prodotti certificati: il preset esclude gli ingredienti ma non garantisce filiera né
  contaminazione.

### 8.2 Il socio
Validazione delle due rifiniture R12 (efficacia in mantenimento; guardrail `clinical` vs `mood_risk`).

### 8.3 Contenuti e marketing, fermi da luglio e in nessuna lista fino a oggi
- **Foto reali e nome/CV** del responsabile scientifico, delle coach e della nutrizionista sul sito.
- **Revisione madrelingua** delle traduzioni **RU / ZH / AR**: il sito è pubblicato in nove lingue e
  quelle tre non sono state riviste da un madrelingua.
- **Prime testimonianze con consenso** (compaiono in automatico quando ci sono).
- **Modelli email**: 48 testi pronti; da decidere se restano nostri (`ModelliEmail.tsx`) con Brevo come
  solo trasporto. Cosa diversa dai **26 inneschi su 50 spenti** di §10.
- La **mascotte** nella vignetta non è la nostra Gaia.
- Il vincolo vero del lancio resta la **capacità delle coach** e lo scaglionamento degli inviti.

---

## 9. Filoni grossi non iniziati

1. **Prodotti dinamici / zero-redeploy.** `model Product` è il catalogo integratori, non l'entità
   percorso: non esiste il wizard «Crea nuovo prodotto» né la lettura dinamica nell'app. Collegato: lo
   **schermo 16 del questionario è statico**, quindi un prodotto nuovo non è selezionabile in onboarding.
   Meno urgente di come lo raccontano i documenti di luglio: il pezzo che faceva male — la card per stile
   invece che per prodotto in registrazione — è chiuso dal 7/8.
2. **Ricombinare i menu ad alto gradimento** (precondizione: §6 e `menu_daycombo_enabled`).
   Metà esiste già: `DayComboService` compone la giornata prendendo un piatto per pasto dal pool della
   cliente, dentro la banda calorica, massimizzando efficacia + gradimento; e lo stato `conforto` (umore
   basso recente) alza già il peso del gradimento. Manca davvero:
   - **il gradimento collettivo**: una cliente senza voti vede ogni piatto come cinque stelle, quindi i
     voti delle altre non servono a niente. Vale molto e costa poco;
   - **l'efficacia collettiva**: `MenuWeight` è per cliente, quindi ognuna riparte da zero;
   - **la memoria della combinazione**: il punteggio è la somma dei piatti, «questo pranzo con quella
     cena» non è un'entità che il sistema impara — ed è esattamente la richiesta;
   - **la preselezione per il tetto `maxCombos` = 20.000**: con 84 piatti per pasto le combinazioni sono
     84⁵, si cade in `greedy` che ne prova **una sola**, e la ricombinazione si spegne proprio quando il
     catalogo diventa ricco. Correzione: i migliori 7 per pasto (7⁵ = 16.807), poi enumerazione.
   Decisioni tue: peso del gradimento collettivo, minimo di voti perché conti, e se toccare le clienti
   già in corso o solo dal ciclo successivo. E una validazione clinica di Nocanty: «questo piatto fa
   perdere peso», misurato su una popolazione, è un'affermazione che decide lei.
3. **App dedicate Coach e Nutrizionista.** Oggi tutto vive nel backoffice role-adattivo: backend
   completo, restano rifiniture mobile, pagine cliniche dedicate (dettaglio paziente, televisita), agenda
   coach più ricca e chat ottimizzata. È una **decisione di prodotto** prima che un lavoro.
4. **Modulo Marketing, le due parti mancanti**: lo **SLA marketing↔vendite** e la regola di **recycle
   del lead** (riassegnazione a tempo). Il resto del modulo esiste.
5. **Standard lead/pipeline completo**: stadi fino a *a rischio → churn → in rientro*, e sui campi lead
   **consensi email/sms/marketing con timestamp e base giuridica**, fonte/canale, campagna+utm, owner.
   Ha un lato GDPR: da verificare quanto è già implementato prima di stimare.
6. **Blog automatizzato**: nessun modulo, l'agente redattore esiste solo come riga di catalogo.
7. **Login social Google/Apple**: zero codice, e in registrazione le due voci dicono «in arrivo».
8. **Publisher social**: auto-publish Instagram/Facebook ed export da Canva mancano, bloccati sulle
   credenziali. Oggi si registra a mano, e la UI lo dice.
9. **Certificazione unicità**: certificato e collision check esistono; da chiarire se il «registro
   firmato» sia qualcosa in più o un altro modo di dire la stessa cosa.
10. **Le due direzioni dichiarate del motore**: DayCombo che compone dall'**intero catalogo** invece che
    dalle sole ricette dei template, e attribuzione causale con **veri controfattuali** invece
    dell'euristica osservazionale di oggi.

---

## 10. Debito nostro, dichiarato

> Le voci piccole di questa sezione sono state chiuse l'11/8 (commenti superati, parametro morto, due
> chiavi permessi che non controllavano niente, `Placeholder.tsx`, `travel_max_days`, i messaggi di
> validazione). Quelle rimaste **richiedono una tua decisione prima del codice**: un error tracker
> esterno è un servizio da scegliere e pagare, i documenti sanitari su un bucket UE sono una migrazione
> di dati sensibili, gli aggiornamenti major vanno in una finestra dedicata.


- ~~**`ValidationPipe` senza `exceptionFactory`**~~ **FATTO l'11/8**: la rete c'è
  (`common/messaggi-validazione.ts`), traduce gli schemi di class-validator e lascia intatto qualunque
  messaggio scritto a mano. Resta vera la regola del `message` sul decoratore per i DTO che una cliente
  compila: la rete sa dire «la circonferenza fianchi non può essere minore di 40», non sa dire *cosa
  fare*.
- **Nessun error tracker esterno** (né backend né app): un crash di schermata si scopre solo se la
  cliente scrive alla coach.
- **26 inneschi email su 50 spenti** (`implemented: false`): tutta la catena nurture e gli eventi
  peso/misure/morale. Sono esposti in backoffice come «In arrivo», quindi nessuno li confonde con gli
  attivi.
- **`diet-learning`: l'attribuzione per distintività è opt-in e spenta.** In produzione gira la v1 naive
  che dà credito uniforme a tutte le ricette del ciclo: i pesi `MenuWeight` sono più rumorosi del
  necessario.
- **Il filtro TAG del catalogo ricette lavora in memoria**: su un elenco troncato, ordinare per kcal
  mostra il minimo delle righe scaricate, non del catalogo.
- **Documenti sanitari sul database** invece che su un bucket UE.
- **Fase 0 dell'onboarding, metà mancante**: `login → role/home_route` (i quattro percorsi).
- **Aggiornamenti major** (React 19, Vite, Prisma 7, Capacitor 8): in una finestra dedicata.

---

## 11. Comandi che aspettano te su Render

Tutti esistono e in dry-run non scrivono niente.

| Comando | Cosa succede se non si lancia |
|---|---|
| ~~`npm run accendi:automazioni`~~ | **NON SI LANCIA PIÙ.** L'11/8 Simone ha acceso a mano dal backoffice quello che serviva. Lo script lavora a **opt-out**: mette esplicitamente a spento tutto ciò che non è nella sua lista, quindi lanciarlo ora **spegnerebbe** gli inneschi accesi a mano — è già successo l'8/8, quando invece di accenderne tre ne ha spenti venti, promemoria di rinnovo compresi. Per guardare lo stato senza toccare niente: `SOLO_LEGGI=1 npm run accendi:automazioni`. |
| ~~`npm run fix:consenso-sanitario`~~ | **LANCIATO l'11/8: niente da fare.** 35 questionari completati, **0** bloccate senza consenso. La riparazione dell'8/8 ha tenuto. |
| ~~`npm run fix:segnalazioni`~~ | **LANCIATO l'11/8: nessuna segnalazione orfana**, tutte hanno un destinatario. Chiude anche §3.4. |
| `npm run dedupe:diets` | 18 varianti «senza glutine» approvate = 9 duplicate. Non fa danni al motore, rende inservibile una tendina — e blocca l'aggiunta in scheda della scelta della dieta. |
| `npm run fix:tag-settimane` | Allinea i tag `sett:N` sui dati esistenti (dry-run senza `CONFERMA=1`). |
| ~~`npm run pulisci:spezie`~~ | **LANCIATO l'11/8: 47 profili esaminati, nessuna spezia fra i cibi esclusi.** Resta valido il caso «ha escluso le spezie in generale»: quello lo vede solo una coach parlandoci. |
| ~~`npm run fix:stato-questionario`~~ | **LANCIATO l'11/8 (anche con `CONFERMA=1`): 0 schede spostate.** Tutte e 35 sono già più avanti nella pipeline. |
| `npm run sistema:nomi` | Gli 86k lead importati hanno nome e cognome dentro un unico campo. Dice quali righe rileggere (`CERTEZZA=dubbi`). |
| `npm run fix:assegnazioni` | Assegnazioni incoerenti rimaste dal 6/8. |
| `npm run diag:ricorrente` | Non sappiamo se il primo rinnovo automatico funzionerà (§4.2). |
| `npm run diag:cliente -- giusy.vita01@gmail.com` | Verifica mai fatta: dopo il filtro allergeni più severo, che non sia diventato «piano bloccato». |
| `npm run diag:famiglie` | 20 clienti con famiglia di dieta ambigua. |

**Da lanciare PRIMA del deploy che toglie l'esenzione vacanza** (caso Gioia, 11/8): sapere quante
clienti hanno la modalità viaggio accesa adesso, perché al prossimo ciclo si vedranno chiedere la
pesata. Non è un danno — è la regola nuova — ma è un cambio di comportamento che conviene conoscere
prima che arrivi ai telefoni, e alcune di quelle clienti potrebbero avere un «in vacanza» acceso da
settimane che nessuno ha spento.

```
node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.$queryRawUnsafe("select c.travel_state, count(*)::int as clienti, min(c.travel_start)::text as piu_vecchia from client_profile c where c.travel_state in ($1,$2) group by c.travel_state","in_vacanza","in_partenza").then(r=>console.table(r)).finally(()=>p.$disconnect())'
```

Da fare a mano: **creare il prodotto «Ritorno in Equilibrio» in Negozio** (non esiste in produzione,
quindi metà del prodotto estate non è in vendita) — e **generargli le giornate**, perché la variante
`onnivora · mantenimento · 3 pasti` ne ha **zero**: sono due lavori, e farne uno solo mette in vendita un
percorso senza menu.

---

## 12. Da collaudare a occhio

- **«Lead da accettare» e «Prelievi»**: erano elenchi di schede, ora sono tabelle. Sono le due pagine
  che cambiano aspetto più delle altre.
- **Backoffice con i ruoli reali** (coach, nutrizionista, admin): mai spuntato.
- **Il generatore, passo 3**: che resti visibile e che «Valida e pubblica tutte le N varianti» funzioni
  **anche su varianti già pubblicate** (corretto il 9/8, mai verificato in mano).
- **La sequenza dei piani** di §2, dal punto di vista di una cliente vera: che il Mantenimento **non**
  compaia prima dell'obiettivo.
- **Fase 0 dell'onboarding**: che ogni risposta finisca 1:1 su `ClientProfile`.
- **Il sospetto sul generatore**: che ammucchi i piatti nella prima settimana invece di distribuirli. Il
  selettore della settimana su Copertura catalogo serve esattamente a questo.

---

## 13. Le regole che non si scoprono leggendo il codice

Vivevano in `STATO.md`, che da oggi è chiuso: senza di loro qualcuno prima o poi le romperà in buona fede.

- **REGOLA FERREA — i menu sono isolati per prodotto.** Ogni prodotto ha il proprio catalogo: **mai** un
  join né un riferimento fra cataloghi diversi, si **duplica** anche a parità di piatti. I menu li
  fornisce e li valida il nutrizionista; l'AI non li inventa né li prende in prestito da un altro
  prodotto. È l'invariante che §6 e §9.2 presuppongono senza dirlo.
- **La sequenza dei piani** di §2, protetta in due punti e non in uno.
- **Il Monitoraggio a €19 non è un piano alimentare**: niente menu di piano, il peso si chiede e non si
  impone, la coach resta raggiungibile. La decisione è stata presa dentro il codice e vive solo lì.
- **Il webhook Stripe è fissato all'API `2024-04-10`**: cambiarla cambia la *forma* dei payload
  (`invoice.subscription` → `invoice.parent.subscription_details.subscription`). Oggi il codice legge
  entrambe.
- **Il thread di Gaia lo staff lo legge e non lo scrive**: una risposta dello staff travestita da
  assistente ingannerebbe la cliente. Per parlare al posto di qualcuno c'è l'impersonazione, dichiarata
  e tracciata.
- **Le attivazioni manuali dalla scheda cliente non entrano in contabilità** (`origine: 'scheda_cliente'`,
  importo 0): entrano in Acquisti, e lì sono nascoste di default.
- **Il tag `sett:N` dice dove la ricetta è USATA**, non quando è stata creata. Un'etichetta che dice una
  cosa diversa da quella che sembra dire è peggio di un'etichetta assente.
- **`POST /me/menu/substitute` non si rimuove**: lo usano i cibi esclusi del Profilo e le app già
  installate.
- **Header sticky**: `.screen` non deve avere `overflow-y`, o diventa il contenitore di scorrimento e
  l'header si sgancia.
- **«Vacanze in Serenità» ≠ «Vacanza estiva»**: la seconda è il prodotto di esempio del seed.
- **Referral**: il codice coach ha la precedenza su quello cliente, e l'invitata **eredita la coach della
  referrer**.
- **Le tre regole del ricorrente**: solo carta, niente codici sconto, niente prodotti nello stesso
  ordine. E **una carta rifiutata non è una disdetta**.
- **Mai comandi git sulle cartelle montate del Mac**: lasciano un `index.lock` che non si cancella da qui
  e blocca i commit.
- **Ogni consegna porta Summary, Description e la voce in `REGISTRO.md`**, senza che serva chiederlo.

### Controlli già fatti — non rifarli
Percorsi di `pickDietFor` confrontati riga per riga · `@Transform` sui DTO campo per campo · le rotte
esposte · le migrazioni applicate · il comportamento delle app già installate. Erano nella lista del 7/8
che oggi si chiude.

---

## 14. Appendice — cosa è stato verificato su GitHub, e come

Verifica del 10/8 su `origin/main` (commit `f905a61`), rileggendo i file dal ramo pubblicato e non da una
copia locale. Le voci qui sotto risultano **davvero ancora aperte**.

| Voce | Come è stata verificata | Esito |
|---|---|---|
| Sequenza dei piani (§2) | `commerce.service.ts`: filtri in `listPlansForClient` (righe 350-351) e `assertPlanPurchasable` chiamata dalle due strade d'acquisto (494, 650) | **protetta**, con lo scostamento del «dopo un mese» |
| Monitoraggio tracciato come «dimagrimento» (§4.3) | `monitoring.service.ts:318` — `period === 'maintenance' ? 'mantenimento' : 'dimagrimento'` | aperta |
| `menuAncoraSullaDietaPrecedente` inutilizzato (§5.3) | cercato in **tutti** i file di `app/src` sul ramo: nessuna occorrenza | aperta |
| Vincolo keto solo nel prompt (§7) | `engine-rules.catalog.ts`: nessun parametro sui carboidrati; `engine-rules.presets.ts:58` contiene la frase del vincolo | aperta |
| Quota proteica come media semplice (§7) | `day-combo.service.ts:131` — `reduce(... proteinShare) / picks.length` | aperta |
| `ValidationPipe` senza `exceptionFactory` (§10) | `main.ts`: zero occorrenze | aperta |
| `monitoring_offer_days` letto e mai usato (§10) | il nome compare **una volta sola** nel servizio | aperta |
| `statoViaggioAttivo` senza `travel_max_days` (§10) | `menu.service.ts:731` e `:804`, entrambe con un solo argomento | aperta |
| `engine_reviews` / `assignments` senza uso (§10) | ogni chiave compare in **un solo file** (la dichiarazione in `permissions/pages.ts`) | aperta |
| `Placeholder.tsx` orfano (§10) | nessun file di `app/src` lo nomina, a parte se stesso | aperta |
| SLA marketing↔vendite e recycle lead (§9.4) | `recycle` non esiste nel backend; nessuna regola di riassegnazione a tempo | aperta |
| Modulo blog (§9.6) | nessun file sotto `backend/src` con «blog» nel nome | aperta |
| Login social (§9.7) | nessuna occorrenza di `GoogleAuth` / `signInWithGoogle` / apple-signin | aperta |

Non verificabili da GitHub e lasciate marcate **[dati]**: tutto quello che dipende dal database di
produzione (§3 per intero, le percentuali in Negozio, i prezzi, i comandi di §11) e le voci che aspettano
una persona (§8).

---

## 15. Le decisioni dell'11/8 e il lavoro aperto che ne nasce

Questa sezione esiste perché quel giorno le decisioni sono arrivate **in conversazione**, una alla volta,
mentre Simone parlava col nutrizionista e guardava le clienti vere. Non stavano in nessun file, e una
sessione nuova non avrebbe modo di sapere che sono state prese. Sono decisioni **già date**: non vanno
richieste di nuovo.

### 15.1 Fatto e consegnato lo stesso giorno

- **Caso Giusy** (pesata del ciclo). I due controlli sulle misure non si parlavano: lo sblocco della coach
  toglieva il popup e lasciava il blocco dell'erogazione, e `menuStatus` cadeva su «Menu in preparazione»,
  che è falso. Nuovo stato `awaiting_cycle_measure` con pulsante che apre il modulo pesata; lo sblocco ora
  è `required: true, blocking: false` (livello `promemoria`); `diag:cliente` riconosce il caso; il pulsante
  in backoffice si chiama **«Riapri l'app»** e avvisa che non fa arrivare il menu.
  ⚠️ **Il banner nuovo è nell'app: alle clienti arriva solo con una OTA (2.1.6).** Il resto parte col deploy.
- **Gaia al femminile.** Il prompt non aveva né nome né genere → il modello ripiegava sul maschile («sono
  felicissimo», firmato Gaia). Ora dice chi è. Verificato che non esistano altre frasi fisse al maschile.
- **Convenzione nuova: `progetto/COMMIT.txt`.** Il messaggio del commit (summary + description) viene
  scritto lì a ogni consegna, e si usa con `git commit -F progetto/COMMIT.txt`. È in `.gitignore`: non è
  storia del progetto — quella sta in `REGISTRO.md` — e copiarlo dalla chat perdeva accenti e andate a capo.
  **Va riscritto a ogni consegna, senza che Simone lo chieda.**

### 15.2 «Cosa fanno questi due pulsanti?» — la coda del nutrizionista

La domanda di Nocanty sulla card «Da validare · Decisioni del motore». La risposta verificata: **«Conferma»
e «Correggi» fanno la stessa cosa** — scrivono `reviewOutcome` (`confirmed` / `corrected`), `reviewedAt`,
`reviewedById` e una riga di audit — e **nessun altro pezzo di codice legge quel campo**. In particolare
`reviewDecision` non azzera `flaggedForReview`, e il menu legge le decisioni con `flaggedForReview: false`
(`menu.service.ts:342`): **una decisione confermata non viene applicata, mai, nemmeno entro le 48 ore.**
Sono un registro di «ho letto». Intanto la cliente riceve già il messaggio quotidiano con il **tono
attenuato** deciso da quella riga (`notifications.service.ts:319` legge la decisione del giorno *senza* il
filtro del flag): il tono parte, il contenuto nutrizionale aspetta un via libera che non può arrivare.

**Le decisioni prese, da implementare:**

1. **«Conferma» applica la proposta al piano.** Il livello della dieta cambia dal prossimo giorno erogato.
   Il significato che le ha dato Nocanty: «la cliente va avanti, ma il controllo resta armato, quindi domani
   la riga può ricomparire o sparire». Quindi Conferma **non** silenzia la causa: la ri-arma per il giorno
   dopo. Resta da stabilire con lui o con Nocanty **di quanto** si alzano le calorie: l'unica leva letta dal
   motore è `levelDelta` (il `menu: 'increase_calories'` che i guardrail scrivono **non è letto da nessuno**).
2. **«Correggi» apre una finestra con le azioni ammesse per quella causa**, non un modulo generico:
   | Causa | Azioni |
   |---|---|
   | Calo troppo rapido | Autorizza a proseguire · Blocca il piano · Scrivi in chat · Apri la scheda |
   | Energia bassa cronica | Scrivi in chat · Apri la scheda · Blocca il piano |
   | Percorso supervisionato | Apri la scheda · Scrivi in chat |
   «Apri la scheda» **non** reimplementa i cambi dieta: porta dove vivono già, coi loro permessi
   (`change_diet_type`, «Rigenera menu»). Una seconda strada per modificare la dieta con controlli diversi è
   il modo in cui nascono i buchi nei permessi.
3. **«Autorizza a proseguire» azzera il punto di partenza del calcolo del calo.** Parole di Simone: «dal
   momento in cui dà il suo ok il calcolo deve ripartire da quel momento». Quindi non è una sospensione a
   tempo: il ritmo si calcola **solo sulle pesate successive all'autorizzazione**. Pavimento esplicito
   deciso: **4 giorni e almeno 3 pesate nuove** prima che l'allarme possa tornare — altrimenti due pesate
   ravvicinate producono una pendenza enorme e l'allarme risuona il giorno dopo l'ok.
   ⚠️ **Si azzera il calcolo dell'ALLARME, non i progressi della cliente**: grafico, kg persi e proiezione
   continuano a leggere tutta la storia. Campo previsto: `ClientProfile.rapidLossBaselineAt`.
4. **«Blocca il piano» va costruito: oggi la leva non esiste.** Il «piano bloccato» attuale nasce solo dagli
   allergeni, dice alla cliente «la nutrizionista sta sistemando il menu per rispettare le tue esclusioni»
   (che sarebbe una bugia) e **non ferma l'erogazione**: `dietBlock` è letto da `getMenu` e `menuStatus`, non
   da `deliverIfEligible`. Serve un campo vero (`planHeldAt` / `planHeldReason` / `planHeldById`) con il suo
   cartello onesto. **La cliente tiene i giorni già ricevuti, incluso oggi**: si fermano solo i nuovi.
5. **Una riga per cliente per causa, non una al giorno.** Il motore gira ogni notte e ricrea la riga: con
   cinque clienti supervisionate sono ~150 righe al mese di rumore, nella stessa coda dove sta l'unica riga
   che conta. Serve persistere la causa — `EngineDecision.reasonKey`, **oggi non è in nessuna colonna**: vive
   solo dentro il testo della segnalazione (`[reasonKey] frase`) e si interroga con un `LIKE` — e non creare
   una riga nuova finché quella aperta non è stata guardata.
6. **Il motore gira solo su chi ha un piano attivo.** Regola di Simone: «ovviamente tutto questo vale solo
   per chi ha un piano attivo». Oggi `runBatch` (`engine.service.ts:113`) prende **tutte** le clienti con
   questionario completato, senza guardare l'abbonamento: nello screenshot della coda c'era **Rosaria**, che
   ha il piano concluso dal 22/07. La coda va filtrata anche sulle righe già scritte. Riusare
   `common/piano-attivo.ts`, che esiste per questo.

Il modulo puro `engine/causa-decisione.ts` (causa → azioni ammesse → «cosa si aspetta il software») era
stato scritto nel contenitore ma **non consegnato**: la tabella qui sopra è la sua sostanza, va riscritto.

### 15.3 Il ritmo di calo di sicurezza — un numero da decidere con Nocanty

Tre parametri diversi, e vale la pena non confonderli:

| Parametro | Valore | A cosa serve |
|---|---|---|
| `sustainable_rate_max_kg_week` | 0,7 kg/sett | Solo in registrazione: oltre, l'obiettivo è «non sostenibile» |
| `ambitious_rate_max_kg_week` | 1,0 kg/sett | Registrazione: fascia «ambizioso» |
| `max_weight_change_alert_kg_week` | **1,5 kg/sett** | **Soglia clinica**: oltre, `rapidLoss` → segnalazione e guardrail |
| `min_daily_kcal` | 1200 | Pavimento calorico |

Il ritmo **non** è ultima pesata meno precedente: è la pendenza della media mobile (finestra 3) sul tratto
recente, convertita in settimana (`progress.service.ts:113`). Una bilancia sbagliata non fa scattare niente.

Due meccanismi distinti, e la differenza confonde: la **segnalazione clinica** si apre sul ritmo da solo
(`signals.service.ts:214`); la **riga «Da validare»** richiede ritmo oltre soglia **e** energia ≤ 3, o
energia mai dichiarata (`engine.service.ts:146`). Con calo rapido ed energia alta il nutrizionista non vede
niente in coda.

**Il buco segnalato e non ancora chiuso:** fra **0,7** (dichiarato non sostenibile) e **1,5** (allarme) non
succede nulla. Una cliente che perde 1,3 kg/settimana per un mese è fuori dal sostenibile e nessuno lo vede.
Se Nocanty decide di abbassare, **1,0** è il numero coerente col resto, e **si cambia dai Parametri senza
toccare il codice** (Regole motore → categoria «sicurezza» → «Calo rapido (kg/settimana)», da 0,5 a 5).
Per riferimento: la segnalazione di Giusy di luglio era a **2,87 kg/settimana**.

### 15.4 Varianti con giornate incomplete — decisioni prese, lavoro non iniziato

Il buco è più largo di quanto dicesse §3.1: non è una variante, è il meccanismo. Il controllo di
completezza (`catalog.service.ts:315`) scatta **solo** quando si mette `clientVisible: true`, e non torna
più. L'erogazione non lo consulta mai: `pick-diet.ts:51` filtra su `{status:'approved', regime, mealsPerDay}`
e **non guarda nemmeno `clientVisible`**; `menu.service.ts:362` si ferma solo a giornate **zero**, quindi una
giornata con la sola colazione viene servita e salvata così com'è, senza log né avviso.

Tre conseguenze verificate: il **generatore può guastare una dieta già pubblicata** (scrive le giornate
direttamente, `engine-rules.service.ts:522`, e rompe solo se *tutti* gli slot sono vuoti); **nascondere una
variante non la mette al sicuro** (nell'app le card sono per famiglia, e `pickDietFor` può agganciare proprio
la variante nascosta perché incompleta); **due script scavalcano il gate** — `prisma/approve-diets.ts:62`
mette `clientVisible: true` su tutte le diete, e `prisma/pubblica-tutto.ts:147` reimplementa il gate
**vecchio** col commento che dice «stesso gate di `assertActivatable`», che non è più vero (è lo script che
il 9/8 ha pubblicato `lovcarbciccio`).

**Decisioni prese da Simone:**

- Se la variante non ha nessuna giornata completa → **scendere sulla variante gemella completa** della stessa
  famiglia. Rispetta la dieta ma non i pasti al giorno richiesti, quindi la cosa **va tracciata** come il già
  esistente `diet_style_fallback` (`menu.service.ts:323`), non fatta in silenzio.
- Se **nemmeno le gemelle** hanno una giornata completa → **non erogare + segnalazione a noi**. Meglio
  «menu in preparazione» che una giornata con la sola colazione. (Assunzione dichiarata: Simone aveva
  scartato «erogare la giornata monca».)
- Se il generatore o uno script rende incompleta una dieta già visibile → **la nasconde e avvisa**
  (`clientVisible` torna a false da sé).

### 15.5 La correzione calorica la fa il nutrizionista — ✅ FATTA l'11/8

> **✅ IMPLEMENTATA**, e più larga di com'era scritta qui sotto. Simone ha chiesto anche il **deficit**
> modificabile e lo **storico** delle modifiche, e ha scelto **due leve invece di una**: il deficit
> imposto in kcal/giorno *e* la correzione percentuale sul totale. Sulle soglie di sicurezza ha
> deciso che **il nutrizionista le può scavalcare, ma resta scritto** (storico + segnalazione +
> avviso ai capi).
>
> Dove sta: la regola in `menu/correzione-kcal.ts` (17 test), i campi su `ClientProfile`
> (`kcalDeficitOverride`, `kcalAdjustPct`), lo storico nella tabella `kcal_override`, le API in
> `nutritionist.controller` (`GET|POST /nutritionist/clients/:id/kcal`, `POST .../kcal/simula`), e
> la scheda cliente in backoffice con anteprima mentre si digita.
>
> ⚠️ **Verificato su Render prima di scrivere il codice** (era la condizione posta qui sotto):
> `menu_kcal_need_enabled` non ha righe né in `config_param` né in `product_rule`, quindi vale il
> default del codice, che è **acceso**. Il campo non è inerte.

Decisione di Simone dell'11/8, presa dopo la verifica su Render che ha chiuso la voce 15.2 punto 1.

**Il fatto che ha cambiato la domanda:** in produzione ci sono **315 diete e 10.584 giornate, tutte a
livello 1**. Il motore ha una sola leva (`levelDelta`) e la usa così: `livello = 1 + levelDelta`, quindi
solo un livello 2 porterebbe da qualche parte e un `-1` viene schiacciato sull'1. Il livello 2 non esiste
per nessuna dieta, e crearlo vorrebbe dire un secondo catalogo di giornate per ogni prodotto — lavoro
della nutrizionista, non una riga di codice. Aggiungiamo che il commento in `rules-evaluator.ts:47` dice
«-1 alleggerisce/alza kcal, +1 stringe», che è **invertito rispetto al codice**: chi creasse il livello 2
seguendo il commento farebbe togliere calorie a chi ne perde troppe.

**La decisione:** non si passa dai livelli. Il nutrizionista mette una **«Correzione apporto calorico»
nella scheda della cliente, in percentuale, sia in più che in meno**, e il sistema adegua i menu di
conseguenza. È una decisione clinica, e sta dove vivono le altre decisioni cliniche.

Cosa c'è già, verificato:

- **Il fabbisogno per-cliente esiste ed è già quello che comanda i menu.** `menu/kcal-need.service.ts`:
  BMR con Mifflin-St Jeor (sesso, età, altezza, peso attuale) × fattore di attività, meno un deficit
  ricavato dal ritmo dell'obiettivo, con **pavimento di sicurezza** (`min_daily_kcal`, 1200). In
  mantenimento il target è il fabbisogno.
- **L'interruttore che lo attiva**: il parametro `menu_kcal_need_enabled` (default acceso, per-dieta) —
  «se attivo, le calorie del menu vengono dal fabbisogno; se spento, si usano le kcal del livello». Se in
  produzione fosse spento, la correzione non avrebbe effetto: **da verificare prima di scrivere il
  codice.**
- Il target così ottenuto è quello che la selezione ricette insegue, dentro la tolleranza
  `menu_kcal_balance_tolerance_pct` (15%).

Quindi manca **solo** il pezzo per-cliente: un campo sul profilo (`ClientProfile`, tipo
`kcalAdjustPct`) applicato dentro `kcal-need.service` **dopo** il deficit e **prima** del pavimento di
sicurezza — perché una correzione in meno non deve poter scavalcare il minimo clinico, mentre una in più
non ha bisogno di protezioni. Da decidere quando si costruisce: il tetto ammesso (es. ±20%), chi lo può
scrivere (nutrizionista assegnato e capo, come per gli altri campi clinici), e se la modifica va scritta
in audit — sì, per lo stesso motivo per cui ci va un cambio di dieta.

Conseguenza sulla coda: **«Conferma» del 15.2 punto 1 non applica più un livello, applica una
correzione percentuale.** L'entità la decide Nocanty, e diventa un parametro invece che un numero nel
codice.

### 15.6 Due pesate in aumento durante il dimagrimento → i menu che hanno funzionato

Decisione di Simone dell'11/8.

**La regola:** se durante il dimagrimento arrivano **due pesate con il peso in aumento**, alla cliente
vanno mandati menu che la aiutino a calare — scegliendo quelli che nella **sua storia** hanno dato il
risultato migliore.

Cosa c'è già, verificato:

- **La memoria di cosa ha funzionato per quella cliente esiste**: è l'«efficacia appresa» del punteggio
  di selezione delle ricette, pesata da `menu_select_w_eff` (peso 1 di default, 0,1 in mantenimento).
  Non va costruita da zero.
- **Esiste già uno stato che fa esattamente questa cosa**, ma parte da un altro segnale: `plateau` in
  `diet-agent.service.ts` — «nessun calo negli ultimi N cicli → spinge sull'efficacia». Si accende però
  guardando i `CycleFeedback` (`esitoPeso` = `stabile` o `preso`) degli ultimi `agent_plateau_cycles`
  cicli **seguiti**, cioè un feedback che la cliente deve aver dato. La regola di Simone parte invece
  dalle **pesate**, che arrivano comunque.
- Gli stati dell'agente hanno una precedenza esplicita, e va rispettata: `vacanza` vince su tutto
  («spingere l'efficacia addosso a chi è al mare produce menu ignorati, non chili persi»), e `conforto`
  esiste per non far mollare chi ha l'umore basso. Un aumento di peso non deve scavalcare quelle due:
  la regola va inserita nella scala, non sopra.

Da decidere quando si costruisce: se estendere lo stato `plateau` o farne uno nuovo (`risalita`);
**due pesate consecutive in aumento** contate sul dato grezzo o sulla media mobile — tutto il resto del
sistema ragiona sulla media mobile per non far scattare niente per una bilancia sbagliata o un giorno di
ritenzione, e questa regola non dovrebbe essere l'eccezione; e se la cliente vada avvisata o no.

---

## 16. La coda aperta dell'11/8 — decisioni già prese, codice da scrivere

Tutto quello che sta qui **è già stato deciso da Simone in conversazione**. Non va richiesto di nuovo:
va scritto. Le voci sono in ordine di priorità dichiarata da lui.

### 16.1 «Conosciamoci» si attiva da solo a fine questionario — ✅ SCRITTA l'11/8, da pushare

> **Fatta.** `attivaBenvenuto` + pagina `Benvenuto.tsx` al posto di `PlanFlow`, il piano della prova
> fuori dalla vetrina e non acquistabile, e i tre pezzi della prova (`trial_started`, CRM, avviso alla
> coach) spostati al **primo menu** in `provaAttivata`. 1639 test verdi, nessuna migrazione.
> ✅ Il piano a €0 è **uno solo** — «Conosciamoci», `period '8d'` — verificato in produzione l'11/8:
> niente `trial_plan_id` da impostare, e nessun fallback di durata (la prova dura 8 giorni esatti).
> ⚠️ Resta la **OTA 2.1.8**, che porta la parte app sui telefoni — decisione dell'11/8: si fa a lista
> finita, non subito.
> Aperto: `PlanFlow.tsx` non è più montato da nessuno, da decidere se togliere.
>
> Quello che segue è l'analisi con cui è stata scritta: si tiene perché spiega il *perché* di ogni
> scelta, e perché le otto conseguenze elencate sotto sono diventate i casi del test.

**Quello che ha chiesto.** «C'è una complicazione inutile: a tutti i clienti, una volta che completano
il questionario, in automatico attiviamo "conosciamoci" senza passare dallo shop e senza generare un
acquisto.» Il processo che vuole:

1. finisce il questionario;
2. compare una pagina dove **Gaia dà il benvenuto**: «Benvenuto/a, dedicami 8 giorni per conoscerti, in
   questo periodo ci conosceremo a vicenda, al termine potrai scegliere liberamente come proseguire»;
3. **«Inseriscimi la data in cui vuoi iniziare»**, con l'aiuto: *se non la sai inseriscine una molto
   lontana, potrai sempre cambiarla dalla tua dashboard*;
4. da lì si prende la **data di inizio piano**, e parte il processo standard.

**Le tre risposte date da Simone (11/8):**

- dopo la data la cliente **entra dritta nell'app**. Niente negozio, niente scelta del piano: il
  negozio lo incontra alla fine degli 8 giorni, quando la scelta ha senso;
- il prodotto **«Auto Apprendimento Gaia» sparisce dal negozio**. Resta come `Plan` nel database —
  serve l'id per attivarlo — ma non compare in vetrina e l'acquisto va **rifiutato** anche a chi
  arriva con l'id in mano (`assertPlanPurchasable`). Chi l'ha già fatto non cambia niente;
- la **data è obbligatoria**: non si va avanti senza. È il campo che oggi manca del tutto.

**Le tre risposte in più, dopo l'analisi (11/8):**

- **il `Payment` da 0 € si toglie e basta.** «Preferisco: ora mi intasa la tabella acquisti e basta.»
  Quindi niente riga fantasma in Acquisti, e la traccia dell'attivazione resta l'audit più la
  Subscription. Nota: `purchasedIds` conta già le Subscription `active`/`expired`
  (`commerce.service.ts:291-298`), quindi il piano resta correttamente «già fatto» senza il pagamento;
- la pagina di benvenuto va bene così com'è descritta;
- ⭐ **il CRM passa a «Prova» quando alla cliente viene generato il suo PRIMO MENU IN ASSOLUTO**, non
  all'attivazione. È una correzione di merito, non di forma: con la data di inizio scelta da lei, fra
  l'attivazione e il primo menu possono passare settimane, e «Prova» su una che non ha ancora
  cominciato dice il falso — la manager delle coach vedrebbe una colonna piena di gente che non ha
  visto un piatto. Da attaccare all'erogazione (`deliverIfEligible`, primo `menuDay` in assoluto per
  quella cliente), **idempotente** e con la stessa regola di oggi: chi è già `paid` non retrocede.
  ⚠️ Conseguenza da non perdere: anche `trial_started` e l'avviso alla coach vanno spostati lì
  insieme al passaggio di stato, altrimenti i tre pezzi raccontano tre momenti diversi. E `trial_started`
  deve comunque esistere **prima** del primo acquisto vero, o `trial_converted` non scatta mai
  (`commerce.service.ts:1874-1879`).

#### Com'è fatto oggi (verificato nel codice, 11/8)

Il questionario (`onboarding.service.ts:232` e `:265`) scrive `onboardingCompletedAt`, il consenso
sanitario, obiettivo e prima misura, e sposta il CRM a `questionnaire_done` (`:378`). **Non attiva
niente di commerciale.** Poi l'app mostra «Sto cucendo il tuo percorso» (15 secondi forzati,
`app/src/pages/Onboarding.tsx:463`), l'eventuale nota sulle spezie, e `PlanFlow` con **«Scegli il
piano»**. Il gratuito la cliente lo «compra» a €0 dal carrello: `POST /me/checkout` →
`commerce.service.ts:794` (ramo `totalCents === 0`) → `Payment` a 0 `approved` metodo `manual` +
`Subscription` `pending` → `active` via `finalizeApproval`.

⚠️ **Nessun Order:** l'Order si crea solo se ci sono prodotti (`commerce.service.ts:780`). Quindi
«senza generare un acquisto» significa **togliere il Payment a 0**, che oggi esiste per un motivo
solo: far girare `finalizeApproval`.

⚠️ **E c'è un buco che questa modifica CHIUDE.** Nel percorso gratuito `planStartDate` resta **null**:
la schermata che chiede la data esiste solo dopo Stripe (`PaymentResult.tsx:104`), quindi chi non paga
con carta non la vede mai. Il menu resta in `preparing` (`menu.service.ts:209`) finché la cliente non
incontra per caso la card «Quando vuoi iniziare?» in Home (`StartDatePrompt.tsx`). La pagina di
benvenuto non è solo una semplificazione: è il posto che oggi manca.

#### Cosa si romperebbe a saltare il pagamento — verificato punto per punto

**NON si rompe:** le provvigioni (il gratuito è già escluso due volte: `skipCommissions: true` a
`commerce.service.ts:818` e la guardia `finance.service.ts:47`); la sequenza dei piani
(`purchasedIds` conta già le Subscription `active`/`expired`, `commerce.service.ts:291-298`);
l'erogazione dei menu (`menu.service.ts:310` legge solo la Subscription); tutti i cron di scadenza e
purge, che filtrano su `plan.priceCents = 0`; la contabilità.

**SI ROMPE, in ordine di gravità:**

1. **La trappola.** Una Subscription `pending` senza Payment è **irrecuperabile**: l'unico percorso
   che la porta a `cancelled` parte dal pagamento (`commerce.service.ts:2029`), e il `pending` blocca
   ogni acquisto futuro (`:709-712`). **Deve nascere `active`, con `startDate`/`endDate` già scritte.**
2. **`trial_started` → `trial_converted`** (`commerce.service.ts:1870-1879`): il primo acquisto vero
   controlla di aver visto `trial_started` prima di segnare la conversione. Senza, **il tasso di
   conversione della prova va a zero per sempre**.
3. **Il CRM non avanza a «Prova»** (`:1913-1921`): la board resta ferma su `questionnaire_done`.
4. **La coach non viene avvisata** (`:1924-1929`, `client_trial_started`) — e il commento nel codice
   dice che è la finestra in cui una telefonata cambia l'esito della prova.
5. **La rete di sicurezza sul periodo** (`:1813-1814`): senza, un `period` scritto male fa cadere
   `subscriptionEnd` sul fallback a **3 mesi** di accesso gratuito.
6. **Il referral** `onConvert` / `riscuotiSospese` (`:1831`, `:1836`) non scatta.
7. **`planStartDate`**: senza, `deliverIfEligible` non parte (`menu.service.ts:306`).
8. Sparisce l'audit `commerce.payment.approve`: serve un audit equivalente dell'attivazione.

#### Come va fatta

**Non duplicando `finalizeApproval`.** Dentro quella funzione convivono la parte contabile e cinque
cose che contabili non sono, ed è proprio questo che rende rischiosa la separazione. Si estrae un
`provaAttivata(clientId, subscriptionId, byUserId)` con **funnel `trial_started` + CRM `trial` +
avviso alla coach**, chiamato **da entrambe** le strade, e un `attivaBenvenuto(clientId, dataInizio)`
che fa: piano gratuito → Subscription **`active`** con `start = data scelta` ed `end` calcolato con la
rete di sicurezza sul periodo → `planStartDate` → referral → `monitoring.onPlanActivated` →
`provaAttivata` → audit. **Niente Payment, niente Order.**

Punti da non dimenticare:
- **idempotenza**: se la cliente ha già una Subscription per quel piano, o una qualunque attiva, non
  si riattiva. Il questionario si può rifare;
- **la data lontana va permessa** (l'ha detto lui). Il cap dei 60 giorni di `finalizeApproval:1777`
  **non** si applica qui. Serve però un limite alto — 12 mesi — contro il refuso;
- una Subscription `active` che parte fra tre mesi non rompe niente di verificato, ma va provata:
  `expireTrialsAndPurge` guarda `endDate < now`, i task coach G0/G1 guardano `startDate`.

### 16.2 Gaia deve poter correggere i piatti di TUTTI i menu emessi

«Anche il menu di domani o dopodomani se lo vedo.» Se oggi il cambio vale solo sulla giornata di oggi,
una cliente che apre il menu di domani e chiede una sostituzione sta chiedendo una cosa che non le
possiamo dare. Da verificare nel codice quale sia davvero la portata attuale
(`menu/sostituzione-chat.service.ts`, `menu/cambio-piatto.ts`, `scope: 'today'`).

### 16.3 Nuovo lead → notifica alla manager delle coach + tabella «Lead da assegnare»

«La cliente si è registrata e ha attivato conosciamoci: alla manager delle coach deve arrivare
notifica **e push** che dice *hai un nuovo lead da assegnare*. **Tutte le volte** che si registra un
nuovo lead va avvisata. Se clicca sulla notifica le si apre una tabella (da creare) chiamata **Lead da
assegnare**, con tutti i lead **non assegnati**, in ordine **dal più vecchio al più recente**, e li
vede: nome, cognome, mail e coach.»

Nota: il ruolo è `sales` (manager delle coach). L'ordine dal più vecchio non è un dettaglio — è una
coda di lavoro, e il più vecchio è quello che sta aspettando da più tempo.

### 16.4 La tabella Clienti uguale a Gestione lead, ma solo chi ha speso — + «Entra come»

«Deve essere uguale alla Gestione lead, ma contenere **solo gli utenti che hanno effettuato un acquisto
di valore maggiore di 0**.» Quindi non «ha un abbonamento», ma **ha pagato davvero**: con l'attivazione
automatica del §16.1 questo diventa anche il modo naturale di distinguere una prova da una cliente.

**Aggiunto l'11/8:** «uniformare le tabelle Clienti e Gestione lead, devono essere uguali a Gestione
lead». Non «somigliarsi»: **una sola tabella**, stesse colonne, stessi filtri, stesso comportamento,
con il filtro sulla spesa > 0 a distinguerle. Due copie che si somigliano tornano a divergere alla
prima correzione fatta su una sola delle due.

**E il pulsante «Entra come»,** nella tabella Clienti: apre **la web app del cliente** (non l'app
nativa) vista con i suoi occhi. Il pulsante è **visibile o no in base alla tabella dei permessi** —
non al ruolo scritto nel codice.

⚠️ Da decidere prima di scriverlo, perché tocca i dati sanitari e il GDPR:
- entrare come cliente è **sola lettura** o si può anche agire al posto suo? Se si può agire, ogni
  scrittura fatta così va marcata come tale, o l'audit dice che l'ha fatta la cliente;
- la sessione «entrata come» va **a scadenza** e va **scritta nell'audit** all'apertura, con chi e
  perché — dati sanitari accessibili solo a cliente e suo nutrizionista è una regola di progetto;
- la cliente lo vede? (una riga nel suo diario, o niente).

### 16.5 I filtri delle tabelle devono restare fermi — APERTA (l'11/8 l'avevo data per chiusa a torto)

«I filtri nelle tabelle devono restare fermi come le etichette, non scorrere verso l'alto. Correggile
**tutte**.» Ribadita l'11/8: «i filtri delle tabelle non devono scorrere, sono **fissi in alto sotto
il titolo della colonna**, in **tutte** le tabelle».

⚠️ **L'11/8 l'ho dichiarata chiusa, e non lo era.** Quel giorno ho unificato *da dove* le tabelle
prendono i filtri (catalogo ricette e `LeadsTable` li disegnavano a mano, ora li chiedono all'helper):
è un'altra cosa. La richiesta è sul **comportamento allo scorrimento** — la riga dei filtri sta sotto
l'intestazione ma scorre via con il corpo, e va resa `sticky` insieme all'intestazione. Uniformare la
sorgente serviva a poterlo correggere in un punto solo; la correzione va ancora fatta.

### 16.6 «Piatto Freddo» fra i metodi di cottura

La lista dei metodi vive in **quattro** punti: `backoffice/src/pages/Ricette.tsx:34` (`METHOD`),
`app/src/lib/meals.ts:20`, `backend/src/cycle/cycle.service.ts:13`, e il prompt con cui l'AI genera le
ricette (`engine-rules.service.ts:1048`). Aggiungerla in tre su quattro fa comparire `piatto_freddo`
grezzo al posto dell'etichetta: va estratta in un modulo solo, come le finestre del digiuno.

### 16.7 Slot per le visite creati dal nutrizionista

«Il nutrizionista ha necessità di un'interfaccia dove creare gli slot per le visite, in modo che il
cliente che acquista la visita possa scegliere il suo slot.» È la voce più grossa dopo la 16.1
(disponibilità ricorrenti, prenotazione, collisioni, fuso orario, disdette): va parlata prima di
scriverla.

### 16.8 Tetto di guadagno del nutrizionista — ✅ DECISA l'11/8: solo campo di profilo

Simone ha chiesto il campo **nel profilo del nutrizionista**. In una conversazione precedente aveva
però detto che la regola «è di tutti i nutrizionisti», da cui era nata la conclusione «parametro
globale». **Risposta di Simone (11/8): SOLO il campo sul profilo del nutrizionista.** Niente default globale in
`config_param`, niente cascata: il tetto si imposta persona per persona, dove sta il nutrizionista.
L'obiezione («se la regola è uguale per tutti lo cambi 40 volte») è stata posta e scartata.
⚠️ Da tenere presente scrivendolo: un nutrizionista **senza** tetto valorizzato = **nessun tetto**. Il
calcolo delle provvigioni non deve trattare `null` o `0` come «tetto a zero», o gli si azzera il
compenso in silenzio. Decisioni già prese sul resto: l'eccedenza si perde; lo storno si sottrae anche se rientra nei
3.000; la regola vale per tutti i nutrizionisti.

### 16.9 La tabella delle sostituzioni di Gaia — ✅ DECISA l'11/8: tabella nuova + «promuovi a regola»

«Se non salviamo la sua risposta lei non impara.» Serve **una tabella unica trasversale alle clienti**,
con validazione/correzione da parte del nutrizionista **e inserimento manuale di righe**. La scelta
aperta è fra una **tabella nuova contestuale** (riga = questa cliente, questo piatto, questo
ingrediente → sostituito con, più lo stato) e l'**alimentazione dei gruppi di equivalenza esistenti**.
**Risposta di Simone (11/8): la prima** — tabella nuova contestuale (riga = cliente + piatto +
ingrediente → sostituito con + stato + chi e quando), con validazione, correzione e inserimento manuale
del nutrizionista, e un pulsante **«promuovi a regola»** sulla riga validata che la porta nei gruppi di
equivalenza, caso per caso. Il contesto è l'informazione che i gruppi di equivalenza non sanno tenere, e
una scelta fatta per una cliente non deve cambiare il motore per tutte.
⚠️ Il confronto sui nomi di alimento va fatto **per parola, con la radice**: mai per sottostringa
(«pepe»⊂«peperoni»). Serve una migrazione versionata.
