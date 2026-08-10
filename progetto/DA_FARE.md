> # ⛔ DOCUMENTO CHIUSO — 12 agosto 2026
>
> **Non usare questo file per decidere cosa fare.** Il punto della situazione, verificato sul ramo
> pubblicato, è in **[`PUNTO_DELLA_SITUAZIONE.md`](PUNTO_DELLA_SITUAZIONE.md)**.
>
> Sostituito per non avere **due** liste di cose aperte: era il difetto che questo file era nato per curare. Tutte le sue voci, corrette delle sette false, sono nel nuovo documento.
>
> Resta qui perché è una fotografia di quel giorno e il `REGISTRO.md` ci si appoggia. Quello che valeva
> per il futuro — le regole ferree, le trappole, i controlli già fatti — è stato travasato nel nuovo
> documento: da qui non serve ripescare niente.

---

# Da fare — la lista unica

Tutto quello che è ancora aperto, verificato nel codice l'11/8. Quando una voce viene fatta si sposta
nel `REGISTRO.md` e si cancella da qui.

> **Perché questa lista esiste.** Prima qui c'erano **due** voci, e le altre trentacinque vivevano solo
> nel `REGISTRO.md`, sepolte in mezzo a migliaia di righe di prosa: un log cronologico è il posto
> giusto per raccontare cosa è stato fatto e quello sbagliato per ricordare cosa resta. Il risultato
> era che le cose più urgenti non stavano in nessuna lista.
>
> **Come è stata verificata, e cosa è andato storto la prima volta (12/8).** La versione dell'11/8
> conteneva **sette voci false**, tutte per la stessa ragione: le avevo lette da un clone del
> repository vecchio di quattro giorni, dandolo per attuale. Erano: la cancellazione account (era la
> prova di Simone, già sbloccata), Rosaria senza pranzo e cena (piano concluso), le provvigioni di
> rinnovo (già implementate per costruzione), «l'app non ha un test runner» (ha vitest), il promemoria
> misure ogni due ore (c'è, `metabole-cron-measures-nudge` in `render.yaml`), `app/package.json` non
> allineato all'ultima OTA (è a 2.1.4, allineato), e i due documenti «persi» che invece esistono.
> Un allarme falso costa più del silenzio: dopo due o tre non si crede più alla lista.
>
> Le voci di questa versione sono state verificate **sull'albero vero**, file per file, e non su una
> copia locale. Quelle marcate **[dati]** non sono verificabili da nessun repository: dipendono dal
> database di produzione, e chi le chiude dev'essere sicuro guardando lì.

---

## §0 — Le prime cose (e la lezione: prima di gridare, guardare se il piano è attivo)

> Tre voci di questa sezione erano allarmi **falsi**, scritti l'11/8 da documenti che nominavano una
> cliente senza dire se il suo piano fosse ancora attivo. Da qui `common/piano-attivo.ts` e la colonna
> «di cui attive» in `diag:menu-incompleti`: un allarme falso costa più del silenzio, perché dopo due o
> tre non si crede più alla lista.

### 0.1 La variante «Vacanze in Serenità · onnivora · dimagrimento · 3 pasti» è visibile e non ha pranzi né cene
28 giornate, **zero pranzi e zero cene**. Nessuna cliente attiva la sta ricevendo — l'unica che l'ha
avuta, Rosaria Gruppuso, ha il piano concluso dal 22/07 — quindi non sta danneggiando nessuno **adesso**:
la trappola è armata per la prossima che la sceglie. Si chiude generandole la settimana 1, che è comunque
la prima riga del lavoro sul catalogo (§4).
Sulla stessa lista, tutte senza clienti attive: `Pescetariana · onnivora · dimagrimento · 5 pasti`
(Emanuela Curulli, piano concluso) e altre dieci varianti con una o due giornate monche.

### 0.2 Due clienti senza glutine: verificare se hanno ancora un piano attivo
L'assegnazione è del 10/8, ma i menu già erogati restano finché non si preme **«Rigenera menu»** dalla
scheda. Prima però va guardato se un piano attivo ce l'hanno: se sono concluse, non c'è niente da
rigenerare. Si trovano dalla pastiglia «senza glutine» in Elenco clienti. **[dati]**

### 0.3 Segnalazioni cliniche di luglio che nessuno ha mai ricevuto
Le segnalazioni aperte prima della correzione del routing sono senza destinatario: Giusy ne ha due, del
17 e del 22 luglio, di cui una è «calo rapido 2,87 kg/settimana». `npm run fix:segnalazioni` (a vuoto,
poi con conferma). Chi non è assegnabile va risolto come organico. **[dati]**

### 0.4 Il gruppo di equivalenza del collaudo panna è GLOBALE
Creato per il collaudo del 9/8 e mai ripulito: vale per **tutte** le clienti.
`PULISCI=1 CONFERMA=1 npm run collaudo:menu-panna -- <email>`. **[dati]**

### ~~0.5 La notifica di fine monitoraggio prometteva il mantenimento a €29/mese~~ — FATTA l'11/8
Il prezzo si legge dal Negozio (`commerce/prezzo-piano.ts`); se il piano non si trova la frase esce
senza cifra invece di inventarne una.

---

## §1 — Comandi che aspettano te su Render

Tutti esistono, nessuno risulta lanciato. In dry-run non scrivono niente.

| Comando | Cosa succede se non si lancia |
|---|---|
| `npm run accendi:automazioni` | Sollecito questionario 24h, auguri di compleanno e avviso fine prova **non partono**: il master delle mail automatiche è spento di default. Leggere il riepilogo prima: è a opt-out. |
| `npm run fix:consenso-sanitario` | Clienti bloccate al carrello per il consenso perso (tre casi in un pomeriggio il 9/8). |
| `npm run fix:segnalazioni` | Vedi 0.3. |
| `npm run dedupe:diets` | 18 varianti «senza glutine» approvate = 9 duplicate. Non fa danni al motore, rende inservibile una tendina — e blocca l'aggiunta della scelta dieta in scheda cliente. |
| `npm run pulisci:spezie` | Chi ha curry o cumino fra i cibi esclusi continua a vedersi svuotare il ricettario. Chi ha escluso «le spezie» in generale va chiamato dalla coach: non lo sostituisce uno script. |
| `npm run fix:stato-questionario` | Clienti che l'hanno già compilato risultano in sospeso. |
| `npm run sistema:nomi` (fase lead) | Gli 86k lead importati hanno nome e cognome tutto dentro `name`. |
| `npm run fix:assegnazioni` | Assegnazioni incoerenti rimaste dal 6/8. |
| `npm run diag:ricorrente` | Non sappiamo se il primo rinnovo automatico funzionerà. Vedi §2.1. |
| `npm run diag:cliente -- giusy.vita01@gmail.com` | Verifica mai fatta: dopo il filtro allergeni più severo, che non sia diventato «piano bloccato». |
| `npm run diag:famiglie` | 20 clienti con famiglia di dieta ambigua, mai chiuse. |

Da fare a mano dal backoffice: **archiviare la bozza duplicata `Keto-Mediterranea (5 pasti)`**;
**correggere la riga da €130 nel ledger di agosto** (piano del socio: attivazione manuale che non
doveva contabilizzare — la regola ora è giusta, il movimento già scritto no), con
`CONFERMA=1 PAGAMENTI=<id> npm run fix:attivazioni-manuali` mai in blocco, perché `method: 'manual'`
comprende anche vendite vere. **Creare il prodotto «Ritorno in Equilibrio» in Negozio**: non esiste in
produzione, quindi metà del prodotto estate non è in vendita.

---

## §2 — Soldi: da sistemare PRIMA del primo rinnovo vero

Il momento è adesso: finché nessun rinnovo automatico è passato, si correggono regole. Dopo diventano
revisioni di compensi già erogati.

### 2.1 Il primo addebito ricorrente reale non è mai stato fatto
Codice e Stripe risultano a posto, ma nessun rinnovo vero è mai passato. Serve un acquisto con carta
vera e poi il rimborso. **[dati]**

### 2.2 Provvigioni di rinnovo: serve la tua lettura della decisione del 6/8, non del codice
**Correzione di quello che avevo scritto l'11/8.** Avevo detto che la regola non era nel codice: è
falso, e me ne sono accorto andando a implementarla. `generateCommissions` calcola sempre la catena su
`profile.assignedCoachId`, cioè sulla coach **attuale**: al rinnovo incassa chi segue la cliente
adesso, e se la cliente è stata spostata dal rinnovo dopo incassa la nuova. Nessuna condizione in più
serviva.

Resta però un'ambiguità vera, e riguarda i soldi. Due commenti nel codice dicono cose diverse:

- lo **schema** (`Payment.billingReason`): «le provvigioni sul rinnovo si pagano SOLO se la coach è
  ancora quella assegnata… senza questa colonna un rinnovo è indistinguibile da un primo acquisto e la
  condizione non si potrebbe applicare» — che suona come «se la coach originale non c'è più, **non paga
  nessuno**»;
- il **servizio** (`finance.service.ts`): «la quota si calcola sempre sulla coach ATTUALE… nessuna riga
  in più serve» — cioè **paga chi c'è adesso**.

Il codice fa la seconda. Se intendevi la prima, cambia chi prende i soldi e va scritto. Collegato e già
tuo, deciso il 7/8: al rinnovo di una cliente **senza coach** la provvigione viene accantonata e pagata
a chi verrà assegnato — cioè una rendita costruita da un'altra.
Mancano comunque gli importi di rinnovo sul `Plan` e il contatore.

### 2.3 Percentuali del «Percorso Metabole 3 mesi» e ricalcolo dei pagamenti già fatti
Le soglie sono **cumulative**: 25/35/45 per coach/coordinatrice/manager, non 25/10/10 — col secondo
valore sbagliato il livello sopra calcola una differenza negativa e la catena si ferma alla coach. È un
dato in Negozio. Poi `CONFERMA=1 npm run ricalcola:provvigioni -- 2026-07-01`: aggiunge il mancante,
non toglie niente. **[dati]**

### ~~2.4 Idempotenza del rinnovo non atomica~~ — FATTA il 12/8
Indice unico **parziale** `payment_psp_ref_renewal_key` (una fattura di rinnovo = un pagamento) e
scrittura che si appoggia al rifiuto del vincolo invece di guardare-e-poi-scrivere. Parziale e non su
tutta la colonna perché in `psp_ref` finiscono anche gli id delle sessioni di checkout, che hanno
un'altra natura: un vincolo su tutto avrebbe rotto il checkout per proteggere i rinnovi.

### ~~2.5 `handleInvoicePaid` non emette `plan_renewed`~~ — FATTA il 12/8
L'evento si scrive dentro `invoice.paid`, dopo la creazione del pagamento (quindi coperto dalla stessa
idempotenza). La dashboard marketing legge già `plan_renewed` come «Rinnovi»: dal prossimo rinnovo vero
il numero comparirà da sé.

### ~~2.6 Nel primo acquisto non compare mai la scelta abbonamento / pagamento unico~~ — FATTA il 12/8
`PlanFlow` passa `billing` al carrello attraverso `lib/pianoCarrello.ts`, con i test. Su un piano
`both` si parte da **un mese solo** e la cliente passa all'abbonamento dal Checkout: in quella
schermata nessuno le ha mostrato le due forme, e mettere in carrello un addebito ricorrente per
un'opzione mai vista è il modo più rapido di meritarsi un rimborso.
**Serve un'OTA** perché arrivi alle clienti (§9). E resta da guardare in Negozio quali piani `3m/6m/12m`
hanno `billing` diverso da `one_time`: se sono tutti `one_time` la scelta non comparirà comunque —
correttamente — e quella è una decisione di prodotto, non un difetto. **[dati]**

### 2.7 Prezzi a DB da confermare
Il seed porta ancora 297/497/797 mentre il listino deciso è €99 / €249, e il report cliente cita
€249/€299. Il seed non sovrascrive, quindi i prezzi veri sono quelli messi a mano in Negozio: va
guardato lì. **Finché non è confermato, non mandare il report a una cliente vera.** **[dati]**

### 2.8 Ordini «Menu di rientro (8 giorni)» eventualmente ancora in sospeso
Il prodotto è ritirato e il ramo che erogava le 8 giornate è stato rimosso: se resta un bonifico da €29
in attesa e qualcuno lo approva, la cliente si ritrova 8 giorni di abbonamento senza le giornate.
Guardare in Acquisti. **[dati]**

---

## §3 — Guardrail spenti di default (serve una decisione, non codice)

Tre protezioni esistono e non girano — e sono spente **per scelta**, non per dimenticanza: il catalogo
del motore le descrive come «Di norma OFF» e si accendono da Parametri, senza deploy. Restano in questa
lista perché nessuno se ne accorge: il silenzio di una protezione spenta è indistinguibile da «tutto
bene».

- **`low_adherence_days` = 0**, e zero significa spenta: una cliente che smette di fare check-in non
  genera **nessuna** segnalazione alla coach.
- **`no_progress_escalation` = false**: lo stallo del peso viene calcolato e non segnalato alla
  nutrizionista.
- **`menu_daycombo_enabled` = false**: la composizione della giornata sul fabbisogno calorico è spenta,
  si usa solo il template. Le kcal target del livello non guidano niente finché non si accende per
  dieta. (È anche la precondizione tecnica di §8.2.)

**Verificato oggi, e non è un buco:** `diet_blocked` e `no_progress` **arrivano anche alla coach**, ma
non grazie al campo `also` della tabella di instradamento — `decidiDestinatari` mette fra i destinatari
*sempre* sia la coach sia la nutrizionista assegnate. Quel campo descrive quindi una cosa che accade per
altra via: non manca niente, manca la corrispondenza fra il nome e il meccanismo. Se un domani si
volesse instradare davvero per ruolo, è la riga da cui partire.

Tre controlli nutrizionali dichiarati inerti o approssimati, dello stesso genere:

- **Il vincolo keto** («carboidrati < 50 g/die, 20-30 netti — non negoziabile») vive **solo nel prompt
  all'AI**: nessun parametro del motore lo verifica. È l'unica promessa clinica del prodotto e non è
  applicata dal codice.
- **La regola della ripetizione bigiornaliera** cerca la ricetta gemella solo fra gruppi di
  equivalenza `approved`: finché la nutrizionista non ne approva, il parametro si può accendere e la
  regola resta muta.
- **La quota proteica della giornata** è una media semplice dei piatti, non ponderata sulle kcal
  (`day-combo.service.ts:130`): una giornata può passare `menu_daycombo_protein_min` ed essere sotto
  soglia.
- **La sostituzione in chat propone pari grammatura** e `correggiGrammatura` è dichiarato inerte: vedi
  §5.1, è la stessa questione.

---

## §4 — Il catalogo: le 12 settimane

Stato all'11/8, da `compatta:menu`: Basso indice glicemico a 12 settimane, DASH a 4, Mediterranea senza
glutine a 2, **le altre 17 famiglie a zero settimane piene** (28 giornate costruite con 5 piatti per
pasto, cioè ogni piatto torna cinque o sei volte al mese). Niente da compattare, 1 riferimento rotto
residuo che si pulisce rigenerando.

Il lavoro: ~223 generazioni (una per settimana per famiglia, con la spunta «genera tutte le varianti»),
3-5 minuti ciascuna, **13-14 ore** spalmabili. Protocollo: apri la famiglia → spunta «genera tutte le
varianti» → genera la settimana proposta (avanza da sola) → se compare **pasti incompleti** rigenera
invece di validare → alla fine «Valida e pubblica tutte le varianti» → controlla su **Copertura
catalogo** che le celle siano verdi, settimana per settimana col selettore.

Ordine: prima le varianti con clienti (§0.2), poi le famiglie con clienti, poi il resto.
**Decisione tua ancora aperta:** cosa fare delle ~270 varianti senza nessuna cliente — completarle,
togliere quelle combinazioni dal questionario, o lasciarle magre e non visibili.
**Da verificare mentre si genera:** il sospetto che il generatore ammucchi i piatti nella prima
settimana. Il selettore della settimana su Copertura catalogo serve esattamente a questo.

Aperto e senza soluzione: **«alcune cene come colazioni»**. L'impianto degli slot è corretto, quindi i
piatti nello slot sbagliato arrivano dal modello. Serve una passata di revisione, da costruire su casi
veri quando Nocanty ne segnala.

---

## §5 — In attesa della nutrizionista (Nocanty)

### 5.1 La pari grammatura non regge sui gruppi di grassi
Domande in `progetto/Metabole_Grammature_Grassi_Domande.md` (c'è il PDF pronto da mandarle).
Bloccanti: **Q1** (fattore di conversione, o grassi fuori dall'equivalenza) e **Q3** (la tabella dei
numeri). Il cambio in chat propone sempre pari grammatura: su «carote / biete / spinaci» va bene, sui
grassi no — 70 ml di panna ≈ 200 kcal, 70 g di burro ≈ 500, 70 g di olio ≈ 630, mostrato in schermata
il 9/8. Il controllo `grammaturaAmmessa` guarda il rapporto fra le quantità, non le calorie, e
**rifiuterebbe** un fattore sotto 0,33: va tarato insieme.
Mitigazione già in produzione dal 10/8: la nutrizionista corregge i grammi a mano dalla scheda cliente
e la cliente riceve la nota. Toglie l'urgenza, non la decisione.
**Mai collaudato:** la conversione ml → g su un profilo vero. Serve un'utenza di prova **senza lattosio
fra le esclusioni**, altrimenti il sostituto proposto è l'olio evo, che resta in ml.

### 5.2 La coda «da confermare» dei valori nutrizionali
`nutrient_fact` è seminato con ~60 alimenti e la fonte di ognuno, e Gaia li usa già: ma finché nessuno
li guarda restano «da confermare». E `nutrient_lookup_miss` conta quante volte le clienti hanno chiesto
un alimento che non abbiamo: «tempeh chiesto 40 volte» è la prossima riga da scrivere. Nessuna
scadenza, quindi è il lavoro che si dimentica.

### 5.3 Contenuti e firme
Proteica sportiva ancora «da approvare». Grammature reali e **firma sul Keto**. Le 142 ricette finite su
`Basso indice glicemico · vegana · mantenimento · 3 pasti`, una variante senza clienti. Le 18 diete
«Pescetariana» con regime onnivoro/vegetariano/vegano: nome o regime sbagliato, va deciso quale.

### 5.4 «Questo piatto fa perdere peso» è un'affermazione clinica
Precondizione di §8.2: l'efficacia misurata su una popolazione la valida lei, non noi.

---

## §6 — Richieste tue non ancora fatte

### 6.1 Lista delle coach: quattro voci su dodici
- **Scadenze nel calendario**: oggi nasce un promemoria solo per piani a pagamento in scadenza entro 7
  giorni. Mancano **fine prova gratuita** (è a €0, quindi non entra) e **fine piano** (genera un task,
  non un appunto in agenda).
- **Compleanno in agenda**: la mail parte, l'appuntamento no.
- **Data di nascita nel questionario**: si chiede solo l'età (`onboarding.questions.ts:20`). La data si
  può mettere solo dal profilo app o a mano, quindi **il compleanno lo sappiamo per pochi** — e questo
  limita sia la mail sia l'agenda.
- **«Nuova cliente assegnata da accettare»** quando una cliente **già acquisita** viene riassegnata:
  esiste solo `lead_assigned`. Serve una decisione: se vogliamo l'accettazione anche lì.

### 6.2 Gaia cambio menu, punti 3-4-5 del progetto
- La correzione della nutrizionista **non diventa conoscenza**: la coppia «carote 100 g → biete 150 g»
  non si salva da nessuna parte, quindi la prossima volta si ricomincia.
- Il rifiuto di un piatto per gusto **non scrive su `MenuWeight`**: il motore non impara dal no.
- Il conteggio delle personalizzazioni non entra nel report di fine mese.

### 6.3 Credenziali al lead anche via WhatsApp, passi 2 e 3
Manca il servizio (modelli, opt-out, log) e l'aggancio come secondo canale. Bloccato sul **numero Meta
Business dedicato**. Il passo 1 (link invece della password) è fatto.

---

## §7 — Debito nostro, dichiarato nel codice

- **`ValidationPipe` senza `exceptionFactory`**: ogni DTO nuovo nasce con messaggi d'errore in inglese.
  Le parti esposte sono coperte, il resto (chat, documenti, buoni sconto, eventi) no.
- **L'app ha vitest ma quasi nessun test**: quattro file, tutti in `src/lib/`. Non è «manca il test
  runner» come avevo scritto l'11/8 — è che la logica sta dentro i componenti, dove non si può
  verificare. La strada che funziona l'ha mostrata `pianoCarrello.ts`: si tira fuori la regola, e da
  quel momento è coperta.
- **Nessun error tracker esterno** (né backend né app): un crash della schermata si scopre solo se la
  cliente scrive alla coach. `ErrorBoundary` logga in locale e basta.
- **Il filtro TAG del catalogo ricette lavora in memoria**: su un elenco troncato, ordinare per kcal
  mostra il minimo delle righe scaricate, non del catalogo.
- **Documenti sanitari sul database** invece che su un bucket UE.
- **26 inneschi email su 50 spenti** (`implemented: false`): tutta la catena nurture e gli eventi
  peso/misure/morale. Sono esposti in backoffice come «In arrivo», quindi nessuno li confonde con gli
  attivi.
- **`diet-learning`: l'attribuzione per distintività è opt-in e spenta.** In produzione gira la v1
  naive che dà credito uniforme a tutte le ricette del ciclo, comprese quelle identiche fra un ciclo e
  l'altro: i pesi `MenuWeight` sono più rumorosi di quanto potrebbero.
- **`statoViaggioAttivo` chiamato senza `travel_max_days`** (default 30) mentre l'agente dieta legge il
  parametro: se qualcuno lo porta a 60, gate misure e agente si contraddicono.
- **`monitoring_offer_days` letto e inutile**, con una descrizione nel seed che parla di un
  congelamento rimosso il 7/8.
- **Commenti superati** che fanno sembrare spente cose che funzionano: `rules-evaluator.ts:28`
  (l'agenda è popolata davvero), `agents.service.ts:28` (il runtime esiste), `chat/ai-filter.ts:4`.
  Costano poco e fanno perdere tempo alla prossima ricerca.
- **`app/src/pages/Placeholder.tsx`**: nessuna rotta lo importa. Da togliere prima che qualcuno lo
  agganci e una cliente veda «in costruzione» in un'app a pagamento.
- **Aggiornamenti major** (React 19, Vite, Prisma 7, Capacitor 8): in una finestra dedicata, non a
  spizzichi.

---

## §8 — Filoni grossi non iniziati

1. **Prodotti dinamici / zero-redeploy.** `model Product` è il catalogo integratori, non l'entità
   percorso: non esiste il wizard «Crea nuovo prodotto» né la lettura dinamica nell'app. Meno urgente
   di come lo raccontano i documenti di luglio, perché il pezzo che faceva male — la card per stile
   invece che per prodotto in registrazione — è chiuso dal 7/8 con `dietFamily`. Collegato: **lo
   schermo 16 del questionario è statico**, quindi un prodotto nuovo non è selezionabile in onboarding.
2. **Ricombinare i menu ad alto gradimento** (precondizione: §4).
   Metà esiste già: `DayComboService` compone la giornata prendendo un piatto per pasto dal pool della
   cliente, dentro la banda calorica, massimizzando efficacia + gradimento; e lo stato `conforto`
   (umore basso recente) alza già il peso del gradimento, con il guardrail `agent_comfort_max_days`.
   Manca davvero:
   - **il gradimento collettivo**: `starOf.get(id) ?? 5` — una cliente senza voti vede ogni piatto come
     cinque stelle, quindi i voti delle altre non servono a niente. Vale molto e costa poco;
   - **l'efficacia collettiva**: `MenuWeight` è per cliente, quindi ognuna riparte da zero;
   - **la memoria della combinazione**: il punteggio è la somma dei piatti, «questo pranzo con quella
     cena» non è un'entità che il sistema impara — ed è esattamente la richiesta;
   - **la preselezione per il tetto `maxCombos = 20.000`**: con 84 piatti per pasto le combinazioni sono
     84⁵, si cade in `greedy` che ne prova **una sola**, e la ricombinazione si spegne proprio quando il
     catalogo diventa ricco. Correzione: i migliori 7 per pasto (7⁵ = 16.807) e poi enumerazione.
   Decisioni tue: peso del gradimento collettivo, minimo di voti perché conti, e se toccare le clienti
   già in corso o solo dal ciclo successivo.
3. **Blog automatizzato**: nessun modulo, l'agente redattore esiste solo come riga di catalogo.
4. **Login social Google/Apple**: zero codice, e in registrazione le due voci dicono «in arrivo».
5. **Publisher social**: auto-publish Instagram/Facebook ed export da Canva mancano, bloccati sulle
   credenziali. Oggi si registra a mano, e la UI lo dice.
6. **Rifiniture app**: anteprima menu (schermata 30) e widget «tutto pronto» (34). Video 27-28 e
   schermi 29, 33.
7. **Certificazione unicità**: certificato e collision check esistono; da chiarire se il «registro
   firmato» sia qualcosa in più o solo un modo diverso di dire la stessa cosa.

---

## §9 — Rilascio app: le trappole che si ripetono

- **Serve una OTA 2.1.5.** Tre cose sono nel codice e invisibili alle clienti: data e ora dei messaggi
  in chat, il pulsante «sposta la data di inizio» nel profilo, e `menuAncoraSullaDietaPrecedente`.
  Ultima pubblicata: 2.1.4.
- **`OTA_VERSION` va svuotata su Render PRIMA di ogni pubblicazione sugli store**, altrimenti
  un'installazione fresca scarica un bundle più vecchio del nativo appena installato. È già succeduto
  il 6/8.
- **iOS**: la prossima build deve essere **≥ 8**; il **certificato Apple Distribution scade ogni anno** e
  senza di quello l'archivio si firma in development e le push si spengono in silenzio;
  `MinimumOSVersion` è 13.0 e dalla primavera 2027 il minimo sarà 15.0 — va messo in `install-ios.mjs`,
  perché `ios/` viene rigenerato ogni volta.
- **Le push sono spente a compile-time** se `google-services.json` non c'era al momento del build: la
  funzione esce subito e l'unico segnale è una riga di log lato server.

---

## §10 — Da collaudare a occhio

- **«Lead da accettare» e «Prelievi»**: erano elenchi di schede, ora sono tabelle. Sono le due pagine
  che cambiano aspetto più delle altre.
- **Backoffice con i ruoli reali** (coach, nutrizionista, admin): mai spuntato.
- **Fase 0 dell'onboarding**: che ogni risposta finisca 1:1 su `ClientProfile`.
- **Le due rifiniture R12** (efficacia in mantenimento; guardrail `clinical` vs `mood_risk`): aspettano
  la validazione del socio.

---

## Decisioni che valgono per il futuro (non sono lavori)

- **La testa delle tabelle** si incolla in alto dall'helper (`testaFissa`), titoli **e** riga dei
  filtri: lo scostamento della seconda riga si misura, perché un numero fisso sbaglia appena un titolo
  va a capo.
- **`LeadsTable` condivide la testa, non il filtro.** Lì ci sono intervalli di valore e di data su
  decine di migliaia di lead, che l'helper (tutto in memoria) non sa né disegnare né sostenere. Se un
  giorno servisse unificare, la cosa da aggiungere all'helper è un filtro «intervallo» e una modalità
  che emette parametri di query — non il contrario.
- **Le attivazioni manuali dalla scheda cliente non entrano in contabilità** (`origine:
  'scheda_cliente'`, importo 0): entrano in Acquisti, e in Acquisti sono nascoste di default.
- **Il tag `sett:N` dice dove la ricetta è USATA**, non quando è stata creata. Un'etichetta che dice una
  cosa diversa da quella che sembra dire è peggio di un'etichetta assente.
