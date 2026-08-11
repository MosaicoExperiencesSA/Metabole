# Metabole — punto della situazione

**Scritto il 12 agosto 2026.** Questo documento è **uno**: dove sta il prodotto, cosa è aperto, cosa
aspetta una persona, e le regole che non si scoprono leggendo il codice. Sostituisce
`DA_FARE.md`, i tre `DA_RIPRENDERE_2026080*.md`, `STATO.md` e `STATO_LANCIO.md`, che da oggi portano in
testa un rimando qui.

`REGISTRO.md` **non** viene chiuso: è il log cronologico di cosa è stato fatto, si aggiunge in cima e
non si riscrive. Questo documento risponde a un'altra domanda — «come siamo adesso» — e i due non si
sovrappongono.

---

## Come è stato verificato, e perché la cosa va detta

La lista dell'11 agosto conteneva **sette voci false**. Tutte per la stessa ragione: le avevo lette da
un clone del repository vecchio di quattro giorni, dandolo per attuale. Erano la cancellazione account
(era una prova di Simone, già sbloccata), Rosaria senza pranzo e cena (piano concluso il 22/07), le
provvigioni di rinnovo (già implementate per costruzione), «l'app non ha un test runner» (ha vitest),
il promemoria misure (c'è, cron ogni due ore), `app/package.json` non allineato (è allineato), e due
documenti «persi» che invece esistono.

Un allarme falso costa più del silenzio: dopo due o tre non si crede più alla lista. Le voci di questo
documento sono verificate **sul ramo pubblicato** (`origin/main`, commit `f905a61` del 12/8) e non su una
copia locale: per ognuna delle voci controllabili nel codice ho riletto il file **da GitHub** e cercato la
riga. L'elenco di cosa è stato controllato e come sta in appendice (§14). Le voci marcate **[dati]** non
sono verificabili da nessun repository: dipendono dal database di produzione, e chi le chiude deve
guardare lì.

---

## 1. Dove siamo

Il prodotto è **in produzione con clienti vere** (~45), su tre superfici: backend NestJS su Render, web
app e backoffice su Vercel, app nativa iOS/Android con aggiornamenti OTA self-hosted. Ultima OTA
pubblicata: **2.1.4**; la **2.1.5** è costruita, verificata e in attesa dell'ultimo passo (§5.1).

Stato tecnico all'ultimo commit: **1496 test backend verdi** (99 suite), **27 test app**, type-check al
suo valore di riferimento (42 errori, tutti dovuti allo stub di Prisma in sandbox), backoffice e app che
compilano. Le migrazioni girano da sole a ogni deploy (`preDeployCommand`), il seed dopo di esse.

Nelle ultime quattro giornate di lavoro (9→12 agosto) sono state chiuse più di novanta voci: il grosso
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

### Lo scostamento trovato, e la decisione presa (12/8)

Il codice chiedeva di *aver avuto* il mantenimento, contando anche gli abbonamenti `active`: quindi il
Monitoraggio compariva dal **primo giorno** di mantenimento, e una cliente che pagava €49 oggi vedeva
già l'opzione da €19.

**Deciso da Simone e IMPLEMENTATO il 13/8:** il Monitoraggio si mostra **solo dal giorno dopo che il
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

### 3.1 Varianti visibili con giornate incomplete
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

### 3.4 Segnalazioni cliniche di luglio senza destinatario
Aperte prima della correzione del routing: Giusy ne ha due, del 17 e del 22 luglio, una è «calo rapido
2,87 kg/settimana». `npm run fix:segnalazioni` (a vuoto, poi con conferma). Chi non è assegnabile viene
elencato e non toccato: quello è organico, non software. **[dati]**

### 3.5 Il gruppo di equivalenza del collaudo panna è globale
Creato per il collaudo del 9/8 e mai ripulito: vale per **tutte** le clienti.
`PULISCI=1 CONFERMA=1 npm run collaudo:menu-panna -- <email>`. **[dati]**

---

## 4. Soldi

Il momento è adesso: finché nessun rinnovo automatico è passato si correggono regole. Dopo diventano
revisioni di compensi già erogati.

### 4.1 Decisioni che aspettano te
- ~~**Il Monitoraggio dopo quanto?**~~ **Deciso il 12/8, fatto il 13/8**: solo dal giorno dopo che il
  mantenimento è scaduto e non è stato rinnovato. Vedi §2.
- **Provvigioni di rinnovo, due letture della decisione del 6/8.** Lo schema dice «solo se la coach è
  ancora quella assegnata» (che suona come *altrimenti non paga nessuno*), il servizio dice «paga chi
  c'è adesso». **Il codice fa la seconda**, per costruzione: la catena si calcola sempre su
  `profile.assignedCoachId`. Se intendevi la prima, cambia chi prende i soldi.
  Collegato e già deciso da te il 7/8: al rinnovo di una cliente **senza coach** la provvigione viene
  accantonata e pagata a chi verrà assegnato — su un rinnovo significa far incassare a una coach futura
  una rendita costruita da un'altra.
- **Percentuali del «Percorso Metabole 3 mesi»**, da compilare in Negozio. Sono **cumulative**:
  coach 25 / coordinatrice 35 / manager 45; nutrizionista **10** / capo nutrizionista **15**. Col secondo
  valore sbagliato (25/10/10) il livello sopra calcola una differenza negativa e la catena si ferma alla
  coach. Poi il ricalcolo dei pagamenti già fatti: `CONFERMA=1 npm run ricalcola:provvigioni --
  2026-07-01`, che aggiunge il mancante e non toglie niente — oppure riga per riga da Acquisti → ↻. **[dati]**
- **Prezzi a DB da confermare.** Il seed porta ancora 297/497/797 mentre il listino deciso è €99 / €249,
  e il report cliente cita €249/€299. Il seed non sovrascrive, quindi i prezzi veri sono quelli messi a
  mano in Negozio: va guardato lì. **Finché non è confermato, non mandare il report a una cliente
  vera.** **[dati]**

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

### 5.1 La OTA 2.1.5 è PUBBLICATA — sera del 12/8
Il manifest risponde `version: "2.1.5"` con l'URL del bundle giusto (verificato leggendo
`/api/v1/app-updates/latest.json` dall'esterno). I telefoni la scaricano al primo avvio utile e la
attivano al passaggio successivo in background: le clienti vedono **data e ora nei messaggi in chat**, il
pulsante **«Sposta la data di inizio»** nel profilo e la **scelta abbonamento / mese singolo** nel primo
acquisto (il pulsante al Checkout c'era già nella 2.1.4: mancava il dato che lo fa comparire) senza dover
fare niente.
Verifiche fatte sullo zip **prima** di pubblicare, per memoria del metodo: `index.html` alla radice, le
tre cose nuove presenti, **una sola** stringa di versione (`2.1.5`), push intatte (`/me/push-tokens` e
listener `registration` presenti, **assente** il ramo del build senza `google-services.json` — quello che
spegnerebbe le notifiche in silenzio).

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

**Stato**: Basso indice glicemico a 12 settimane · Mediterranea senza glutine **a 12** (fatta il 12/8) ·
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

**Decisione tua ancora aperta**: cosa fare delle ~270 varianti senza nessuna cliente. Tre strade —
completarle a mano (le 13-14 ore), togliere quelle combinazioni dal questionario, oppure **uno script che
le macina in background** (costo AI, e nessuno le rivede prima che una cliente le riceva).

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

- ~~**`ValidationPipe` senza `exceptionFactory`**~~ **FATTO il 13/8**: la rete c'è
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
- **`monitoring_offer_days` letto e inutile**: verificato che il nome compare **una volta sola** in tutto
  il servizio, cioè viene letto e mai usato — e la descrizione nel seed parla di un congelamento rimosso
  il 7/8.
- **Chiavi permessi dichiarate e senza uso**: `engine_reviews`, `assignments`.
- **Fase 0 dell'onboarding, metà mancante**: `login → role/home_route` (i quattro percorsi).
- **Commenti superati** che fanno sembrare spente cose che funzionano (`rules-evaluator.ts`,
  `agents.service.ts`, `chat/ai-filter.ts`).
- **Aggiornamenti major** (React 19, Vite, Prisma 7, Capacitor 8): in una finestra dedicata.

---

## 11. Comandi che aspettano te su Render

Tutti esistono e in dry-run non scrivono niente.

| Comando | Cosa succede se non si lancia |
|---|---|
| `npm run accendi:automazioni` | Sollecito questionario 24h, auguri di compleanno e avviso fine prova **non partono**: il master delle mail automatiche è spento. È a **opt-out**: leggere il riepilogo prima. |
| `npm run fix:consenso-sanitario` | Clienti bloccate al carrello per il consenso perso. Chi non ha la prova viene elencato e non toccato: quei casi restano a mano. |
| `npm run fix:segnalazioni` | Vedi §3.4. |
| `npm run dedupe:diets` | 18 varianti «senza glutine» approvate = 9 duplicate. Non fa danni al motore, rende inservibile una tendina — e blocca l'aggiunta in scheda della scelta della dieta. |
| `npm run fix:tag-settimane` | Allinea i tag `sett:N` sui dati esistenti (dry-run senza `CONFERMA=1`). |
| `npm run pulisci:spezie` | Chi ha curry o cumino fra i cibi esclusi continua a vedersi svuotare il ricettario. Chi ha escluso «le spezie» in generale va chiamato dalla coach. |
| `npm run fix:stato-questionario` | Clienti che l'hanno già compilato risultano in sospeso. |
| `npm run sistema:nomi` | Gli 86k lead importati hanno nome e cognome dentro un unico campo. Dice quali righe rileggere (`CERTEZZA=dubbi`). |
| `npm run fix:assegnazioni` | Assegnazioni incoerenti rimaste dal 6/8. |
| `npm run diag:ricorrente` | Non sappiamo se il primo rinnovo automatico funzionerà (§4.2). |
| `npm run diag:cliente -- giusy.vita01@gmail.com` | Verifica mai fatta: dopo il filtro allergeni più severo, che non sia diventato «piano bloccato». |
| `npm run diag:famiglie` | 20 clienti con famiglia di dieta ambigua. |

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

Verifica del 12/8 su `origin/main` (commit `f905a61`), rileggendo i file dal ramo pubblicato e non da una
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
