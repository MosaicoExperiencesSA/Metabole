# Metabole — Registro delle modifiche

Log cronologico. **Si aggiunge in cima**, non si cancella. Formato: `data · [Team] · area — cosa`.
Autori: `[Sviluppo]` (Simone + Claude Cowork) · `[Prodotto]` (socio + AI).

---

## 2026-08-09

- `[Sviluppo]` 🧱 **Backend su istanza Standard e due istanze, scritte nel blueprint.** L'8/8 alle 17:15 l'istanza è
  stata uccisa e riavviata: `Instance failed — HTTP health check failed (timed out after 5 seconds)
  while running your code`. Non un deploy fallito (i tre dell'8/8 erano tutti andati live), non un
  crash: l'app c'era e non ce la faceva a rispondere a `/health` in 5 secondi. Su un'istanza da
  **512 MB** la spiegazione più probabile sono gli script `ts-node` lanciati nella shell di Render,
  che girano **dentro lo stesso container dell'applicazione** e le portano via memoria e CPU. Per le
  clienti sono stati ~40 secondi di app spenta, e per Simone un «Failed to fetch» sul login del
  backoffice che sembrava un problema di password.
  Simone ha scalato a 2 dalla dashboard alle 17:28 («Service recovered»). Qui la scelta viene
  scritta in `render.yaml`, dove è la verità del servizio.
  **Due chiarimenti che ci sono costati un giro a vuoto.** Primo: *Pro* è il piano del **workspace**,
  `plan:` è il **tipo di istanza** — sono cose diverse, e avere Pro non sposta il servizio da
  starter. Secondo: dei due campi, quello che rischia di tornare indietro è **`plan`**, perché è
  dichiarato nel blueprint (cambiarlo dalla dashboard viene annullato alla sincronizzazione
  successiva); `numInstances`, se assente, viene **conservato** da Render sui servizi esistenti.
  Scriverlo comunque serve a non lasciare la scelta invisibile nel pannello.
  Verificato prima di scrivere, perché sono le due cose che impediscono di scalare: **nessun disco
  persistente** sul servizio, e gli scheduler sono **cron esterni** e non timer nel processo —
  quindi due istanze non fanno partire due volte il giro giornaliero o i solleciti misure.
  `preDeployCommand` (migrazioni + seed) gira una volta per deploy, non una per istanza.
  **Le due righe curano due cose diverse**, e serve saperlo per decidere in futuro:
  `plan: standard` (2 GB / 1 CPU, passato lo stesso giorno) toglie la **causa** — con quattro volte la
  memoria uno script nella shell non soffoca più l'applicazione; `numInstances: 2` toglie il
  **sintomo** di tutto il resto, cioè i riavvii su cui non abbiamo alcun controllo (manutenzione
  della piattaforma, host che riparte, un nostro crash, un picco che sfora il timeout del health
  check). Con una sola istanza ognuno di questi spegne il servizio a tutte le clienti per una
  quarantina di secondi, e lo si scopre da un messaggio WhatsApp di una coach — che è esattamente
  come l'abbiamo scoperto oggi. Con due, non se ne accorge nessuno.
  Effetto collaterale utile: da adesso gli script pesanti nella shell sono innocui per le clienti —
  la shell si attacca a una delle due istanze, l'altra continua a servire il traffico.
  Se un mese passa senza nessun «Instance failed» e si vuole risparmiare, tornare a una istanza è
  difendibile: si cambia la riga in `render.yaml`, non dalla dashboard.

- `[Sviluppo]` 📎 **La fattura si allega al costo, in Contabilità.** Richiesta di Simone dell'8/8:
  «nei costi mi piacerebbe poter allegare le fatture in modo da avere tutto insieme». Un file per
  costo — «la fattura», al singolare, scelta sua: se un giorno serviranno due allegati servirà una
  tabella, non una seconda colonna appiccicata.
  Nella riga del costo un solo pulsante che cambia faccia: la graffetta se la fattura non c'è, e se
  c'è due icone — apri e togli. Aprire scarica e mostra in una scheda nuova (il PDF si legge, la foto
  si vede); se il browser blocca il popup il file viene scaricato invece di non fare niente. Togliere
  la fattura **non** tocca il costo: l'importo resta, cambia solo l'allegato.
  **Come è salvata.** Tre colonne sulla riga (`invoice_data` BYTEA, `invoice_mime`, `invoice_name`),
  file **cifrato AES-256-GCM** con la stessa chiave e lo stesso formato delle contabili dei pagamenti
  (iv + authTag + ciphertext). Una fattura ha dentro partita IVA, indirizzi e importi di un
  fornitore: non c'è motivo di tenerla in chiaro. Il servizio è **fail-closed**: senza
  `FILE_ENCRYPTION_KEY` non parte, invece di cifrare con un ripiego che equivale a non cifrare.
  Non usa la tabella `document` perché quella è legata a un `client_id`: la fattura di un fornitore
  non è il documento di una cliente, e agganciarla lì avrebbe voluto dire rendere nullable una
  relazione che oggi garantisce che ogni documento sanitario abbia una proprietaria.
  **Il dettaglio che conta più del resto:** l'elenco dei costi NON restituisce più la riga intera.
  Prima faceva `findMany` senza `select`, e con la colonna nuova avrebbe spedito al browser **tutti i
  file di tutti i costi a ogni apertura della pagina** — megabyte per riga. Ora c'è una whitelist di
  campi e l'elenco dice solo `fattura: { nome, mime } | null`: che ci sia si sa, il file si scarica
  quando lo si chiede. Anche la lettura è tracciata (`accounting.cost_invoice_downloaded`): è un
  documento fiscale, sapere chi l'ha aperto costa una riga.
  Limiti: PDF, JPG, PNG, HEIC; 5 MB, come le contabili. Arriva in base64 e non in multipart, così
  limite del body e validazione restano quelli di tutta l'API.
  ⚠️ **Contiene una MIGRAZIONE** (`20260809120000_cost_entry_fattura`): tre colonne nullable, i costi
  già registrati restano validi così come sono. La applica il deploy.
  846 → 852 test verdi, type-check pulito su backend e backoffice.

- `[Sviluppo]` 👁️ **L'admin vede tutte le conversazioni della cliente — e prima non ne vedeva
  nessuna.** Simone apre la scheda come admin e legge «Nessuna conversazione visibile per il tuo
  ruolo»: «ADMIN vede tutto». Guardando il codice il difetto era più grande della scelta di cui
  avevamo discusso: l'admin **non era gestito affatto** in `assertThreadAccess`. Non è che gli
  mancasse il thread con Gaia — cadeva sul `Nessuna scheda staff` prima ancora di arrivare ai
  controlli, quindi non vedeva **nemmeno la chat con la sua coach**.
  Ora un ramo esplicito: `role === 'admin'` in lettura passa, e sta **prima** della ricerca della
  scheda staff, perché un admin può non averne una.
  **Due limiti restano, e sono voluti.** L'admin **legge e non scrive**: un suo messaggio nel thread
  della coach arriverebbe alla cliente come se fosse della coach, e per parlare come qualcun altro
  esiste l'impersonazione, che è dichiarata e tracciata. E la **manager delle coach** (`sales`) resta
  fuori dal clinico: vede lead, contatti e metriche, non i sintomi.
  Qui c'era il ragionamento opposto, ed era motivato: `pages.ts` nega all'admin `health_documents`
  con la nota «note cliniche riservate», e nel thread con Gaia c'è esattamente quel materiale. Ha
  deciso Simone, e la contropartita è la **traccia**: `chat.staff_read_messages` registra ogni
  apertura di una conversazione da parte dello staff — chi, quale thread, quale cliente. La cliente
  che rilegge la propria non viene tracciata: sarebbe rumore che nasconde le righe che contano. Un
  errore dell'audit non impedisce la lettura: meglio un messaggio letto senza riga che una scheda che
  non si apre.
  Il test che diceva «l'admin NON legge» è stato riscritto con la decisione nuova invece di essere
  cancellato, e accanto ci sono quelli che tengono i due limiti. 852 test verdi, nessun OTA.

- `[Sviluppo]` 🏷️ **`sistema:nomi` ora sistema anche i LEAD, che erano il grosso del problema.**
  Lanciato in produzione diceva «Clienti esaminate: 41 · già a posto: 41 · Niente da sistemare ✓», e
  Simone: «ma io voglio sistemare i lead anche». Aveva ragione, e il «niente da sistemare» era una
  mezza verità: lo script interrogava `user` con ruolo `client`, cioè **solo chi ha un account**. I
  lead importati dalle liste non ce l'hanno — sono `CrmRecord` con `clientId` a null — quindi non
  erano né sistemati né contati: invisibili, non a posto.
  Su un lead il guasto è più semplice: `firstName`/`lastName` vuoti e il nome intero in `name` (lo
  dice il commento dello schema: restano nullable «perché i lead importati dalle liste storiche hanno
  solo il nome intero»). Senza cognome, in Gestione lead non si ordina e non si cerca per cognome —
  lo stesso problema delle clienti, sulla lista più grande.
  Aggiunta una seconda fase con la stessa regola di divisione, lo stesso dry-run e la stessa
  conferma. Tre scelte che vale la pena aver scritto: il limite numerico vale sul **totale** delle due
  liste (altrimenti «40» diventava «40 clienti E 40 lead», e chi legge trenta righe se ne ritrova
  ottanta scritte); i lead **con** account non vengono rifatti, perché il giro delle clienti già
  allinea la loro scheda CRM; email e telefono non si toccano, sono le chiavi con cui il lead è stato
  importato e riconosciuto. Nuovo interruttore `SOLO=lead` / `SOLO=clienti` per lavorarne una alla
  volta.

- `[Sviluppo]` 📏 **Quando la coach sblocca l'app, le misure si chiedono sul telefono.**
  Richiesta di Simone dell'8/8. Lo sblocco già mandava un avviso, ma con due difetti che si
  sommavano: **annunciava** («App sbloccata 💚») invece di **chiedere**, ed era solo `inapp`, cioè
  nel campanello. Il campanello lo vede chi apre l'app — precisamente quello che la cliente non
  stava facendo, perché l'app era bloccata. L'avviso le arrivava quindi *dopo* che aveva già fatto
  da sé la cosa che le stavamo chiedendo. E lo sblocco da solo non porta nessun menu: quello lo
  sbloccano le misure. Il risultato era una cliente che girava in un'app riaperta e ancora senza
  menu, convinta che il problema fosse un altro.
  Ora il testo chiede le misure e dice cosa succede se le mette («il menu dei prossimi giorni arriva
  subito»), e parte anche come **push**. La notifica nel campanello resta, per chi apre l'app dopo.
  **Il pezzo di architettura, che è la parte interessante.** `PushService` stava dentro
  `NotificationsModule`, e quel modulo **importa** `MenuModule`: chiunque stia nel menu non poteva
  mandare una push senza dipendenza circolare. La soluzione facile era un `forwardRef` messo lì per
  far tacere Nest; quella giusta era estrarre `PushModule` (nuovo), che dipende solo da Prisma e
  ConfigService — entrambi globali — e non porta con sé nient'altro. `NotificationsModule` lo
  **riesporta**, così chi prendeva `PushService` da lì non cambia una riga.
  Un errore delle push non fa fallire lo sblocco: la finestra di grazia è già concessa e la coach ha
  già avuto la sua conferma. C'è un test anche per questo, oltre a quello che pretende la parola
  «misure» nel corpo del messaggio: se un domani qualcuno lo riscrive come «app sbloccata» e basta,
  il test lo ferma.
  Suite: 849 test, 67 suite, verdi; type-check ai 46 errori di baseline dello stub, nessuno nuovo.
  Nessuna migrazione, **nessun OTA**: è tutto backend.
  ⚠️ In coda, come richiesto: i promemoria misure alle **9, 12, 16 e 20**. Non è un'aggiunta banale
  perché il cron su Render gira **una volta al giorno**: la scelta fra un cron più frequente e le
  notifiche programmate va fatta prima di scrivere codice.

- `[Sviluppo]` 🔑 **Il reset password dalla scheda lo fa anche la coach, sulle proprie clienti.**
  Prima la rotta era `@Roles('admin')`: la coach premeva «Reset password» e leggeva «Solo un admin
  può inviare il reset password» — proprio mentre era al telefono con la cliente che non riusciva a
  entrare. Il pulsante era perfino nascosto (`isAdmin &&`), quindi il più delle volte non lo trovava
  nemmeno.
  Non serviva un endpoint nuovo: serviva **togliere il cancello sbagliato e mettere quello giusto**.
  Il controllo di appartenenza esisteva già — `assertClientAccess`, lo stesso che decide se questa
  scheda si può aprire — e ora protegge anche il reset: se la scheda si apre, la cliente è sua.
  Coach → le sue (e la coordinatrice quelle del suo team), nutrizionista → le sue,
  manager/capo/admin → tutte.
  **Un secondo controllo, che prima non serviva e ora sì:** il bersaglio deve avere ruolo `client`.
  `assertClientAccess` lascia passare chi non ha scope (manager, capo, admin), quindi senza quel
  controllo un manager avrebbe potuto far ripartire la password di un **admin** passandone l'id. Non
  era un buco solo perché la rotta era riservata agli admin: togliendo quel guardrail diventa
  obbligatorio. C'è un test che si chiama `ESCALATION` e lo tiene inchiodato — verificato **rosso**
  levando il controllo.
  Resta vero che **nessuno dello staff vede né scrive la password**: parte un link e la scelta è
  della cliente. Per dettarne una a voce esiste `:id/set-password`, dietro il suo permesso.
  Lato backoffice il pulsante è visibile a chiunque possa aprire la scheda, con il messaggio d'errore
  che ora arriva dal backend («questa cliente non è assegnata a te») invece del vecchio testo fisso
  sull'admin. Nessuna migrazione; il backoffice si aggiorna da sé su Vercel, nessun OTA.
  Suite: 846 test, 67 suite, verdi; type-check pulito anche sul backoffice.

- `[Sviluppo]` 🩹 **Tre clienti bloccate al carrello: il questionario perdeva il consenso sanitario.**
  Segnalazione di Simone dell'8/8, tre casi in un pomeriggio (Gioia Lurve 12:52, Giusy 14:20,
  Ilaria Stefani 16:13), tutte con la **Prova Gratuita** nel carrello e tutte con lo stesso muro:
  «Per il piano serve il consenso ai dati sanitari: completa prima il questionario». La domanda di
  Simone era «come è possibile che una cliente sia arrivata fino all'acquisto senza passare dal
  questionario?» — e la risposta è che **non ci è arrivata senza: il questionario l'ha fatto, ed è
  lui che perdeva il consenso.**
  Il salvataggio del profilo a fine questionario (`onboarding.service.ts`) è un `upsert`, e
  `consents` era scritto **solo nel ramo `create`**. Chi aveva già un profilo finiva nel ramo
  `update`, che scriveva `onboardingCompletedAt` **ma non il consenso**. Da lì due porte chiuse
  che si incastrano: l'app guarda `onboardingCompletedAt` per decidere se mostrare il questionario,
  quindi **non lo mostrava più** («mi dice di compilare il questionario ma non so dove sia»: vero
  alla lettera), e il carrello pretende il consenso, quindi bloccava l'acquisto chiedendo l'unica
  cosa che quella cliente non poteva più raggiungere.
  **Chi aveva già un profilo?** Proprio i lead inseriti dal backoffice: il profilo nasce quando la
  coach manda le credenziali (`agganciaAssegnazioneAlProfilo`). Più il codice invito e la modifica
  cliente. Il commento di quella funzione dice che creare il profilo è sicuro «perché
  `onboardingCompletedAt` resta null e il gate guarda quello» — ed era vero per il gate, ma
  nessuno aveva guardato il ramo `update` del questionario.
  Correzione: i consensi si calcolano **una volta** e si scrivono in **entrambi** i rami, **unendoli**
  a quelli già presenti (un consenso raccolto altrove non si perde se il questionario si rifà).
  Riparazione per chi era già bloccata: `npm run fix:consenso-sanitario` (dry-run; `CONFERMA=1` per
  applicare). **Non inventa consensi**: ripristina solo se `onboardingAnswers.healthDataConsent`
  è `true` — e quelle risposte sono una prova, perché il questionario si rifiuta di partire senza
  quel consenso. Data registrata: quella del questionario, con nota di ripristino. Chi non ha la
  prova viene elencato e non toccato.
  Tutto **backend**: nessun OTA, nessun aggiornamento dell'app.
  **La lezione**, che vale oltre il caso: *un `upsert` sono due scritture diverse travestite da una,
  e il ramo `update` è quello che nessuno rilegge.* Ogni campo che è un cancello per qualcos'altro
  va verificato in entrambi i rami. Tre test nuovi lo fissano — verificati rossi togliendo la
  correzione, non solo verdi mettendola (suite: 840 test, 66 suite, tutte verdi).

- `[Sviluppo]` ✋ **Il passaggio di consegne diceva di rifare una cosa già fatta.** Alla domanda
  di Simone — «controlla bene, hai messo tutto?» — la risposta onesta era no. Il documento era
  stato scritto guardando un clone in sandbox fermo a `8a701d0`, e nel frattempo su `origin/main`
  c'era `2783bce`: **i punti 1 e 2 di Gaia erano già implementati e pushati**. La sessione nuova
  avrebbe riscritto da capo 3.100 righe già in produzione. Corretto rileggendo `origin/main`
  commit per commit e verificando ogni voce nel codice, non nelle liste dei giorni prima.
  Il file ora porta in cima il commit su cui è stato verificato, ha una sezione **«già chiuso —
  non riaprirlo»** con il commit che ha chiuso ogni punto, e dice esplicitamente che il clone in
  sandbox non è la verità: prima di fidarsene va fatto `git fetch && git reset --hard
  origin/main`. È la lezione più utile del giro: **un elenco di cose da fare che nessuno
  riverifica invecchia più in fretta del codice**.
  Il lavoro in cima alla coda cambia di conseguenza: non più il ponte Gaia, ma il **reset
  password dalla scheda coach** e i **punti 3-5** del progetto Gaia.

- `[Sviluppo]` 📖 **Le OTA hanno finalmente istruzioni scritte** — `progetto/guide/COME_SI_FA_UNA_OTA.md`.
  Nasce da una constatazione: ogni sessione nuova rifà gli stessi tre errori, e non per
  distrazione — la procedura ha tre passaggi che nessuno può indovinare. Si lancia **sul Mac**
  dalla radice del progetto (su Render `scripts/` non esiste e non esisterà mai: lì è deployato
  solo `backend/`); serve `app/google-services.json`, che è gitignorato e quindi **non c'è su
  nessun clone** — costruire senza spegne le notifiche push a chi riceve il bundle, in silenzio e
  senza errori; e soprattutto **un numero di versione non si riusa mai**, perché Capgo confronta
  la stringa e un telefono che ha applicato la X non la riscarica più, qualunque cosa ci sia
  dentro lo zip. Nel file anche la tabella dei tre numeri che devono coincidere
  (`app/package.json` · nome dello zip · `OTA_VERSION`), il modo di verificare un bundle senza
  installarlo (il numero è compilato dentro il JS) e una tabella sintomo → causa. È puntato da
  `ISTRUZIONI_PER_AI.md`, così una sessione che segue le istruzioni lo trova **prima** di
  sbagliare invece che dopo.

- `[Sviluppo]` 🤝 **Passaggio di consegne alla sessione nuova** — `progetto/PASSAGGIO_NUOVA_SESSIONE.md`:
  il messaggio d'apertura da incollare, il contesto minimo (come si consegna il codice sul mount e
  perché `cat > destinazione` è obbligatorio, perché `prisma generate` non gira sul Mac, dove si
  lanciano i test) e **tutto quello che resta da fare**, diviso fra codice, verifiche, cose che
  aspettano Simone e cose che aspettano la nutrizionista. L'elenco è stato **riverificato sul
  codice**, non ricopiato dalle liste vecchie: quello che risultava aperto ed è già chiuso non
  compare più, ed è scritto in fondo perché nessuno lo riapra. Serve a non ricomprare ogni volta
  lo stesso mezzo pomeriggio di contesto.
  Dalla riverifica è uscito **un difetto nuovo**: `app/src/pages/PlanFlow.tsx` — l'acquisto del
  primo piano in onboarding — dichiara `interface Plan` senza `billing` e non lo passa a
  `cart.setPlan`, quindi nel Checkout la scelta fra abbonamento e pagamento unico **non compare
  mai**. È lo stesso difetto che era stato corretto sul pulsante del report, ma sulla strada
  d'acquisto principale. Non ancora corretto: prima va verificato quali piani `3m/6m/12m` hanno
  davvero un `billing` diverso da `one_time`.

- `[Prodotto]` 🔔 **Una segnalazione senza destinatario non è una segnalazione.** È la storia di
  una cliente vera, e vale la pena scriverla per intero. Si iscrive il 20 luglio. Dichiara una
  condizione clinica e un'allergia al pesce. Il motore non riesce a comporre un piano sicuro —
  con le sue esclusioni restano **zero pranzi e zero cene** compatibili — e apre tre
  segnalazioni: piano bloccato, screening clinico, e poi un calo di peso anomalo.
  **Nessuna delle tre arriva a nessuno.** Non le era ancora stata assegnata una nutrizionista, e
  il codice che scriveva la segnalazione la lasciava senza destinatario: nessuna notifica,
  nessuna email, visibile solo a chi fosse andato a cercare l'elenco di sua iniziativa.
  Riceve quattro giornate di menu con la sola colazione. La prova gratuita scade il 30 luglio.
  Venti giorni di silenzio, e non un solo errore da nessuna parte.
  Ora `personal-base` e `menu` passano da **`apriSegnalazione`** (senza dipendenze da Nest, come
  `avanza-stato.ts`: importare il servizio delle notifiche dentro MenuModule chiude un anello e
  Nest non parte). Assegna, avvisa, e **se il ruolo che deve prenderla in carico non è
  assegnato la manda a chi ne risponde** — capo nutrizionista o coordinatrice coach — con la
  notifica che dice esplicitamente che nessun altro l'aveva in mano.

- `[Sviluppo]` 🍽️ **«Nel menu ci dev'essere da mangiare»: il controllo che non c'era.**
  Dalla compattazione del catalogo è saltata fuori questa riga:
  `Vacanze in Serenità · onnivora · dimagrimento · 3 pasti → colaz. 5 · pranzo 0 · cena 0`.
  Ventotto giornate erogate, **zero pranzi e zero cene**, dieta «approved · visibile».
  Il gate di pubblicazione controllava allergeni e gruppi di equivalenza — cose serie — e **non
  controllava che nelle giornate ci fosse da mangiare**. Nessun errore da nessuna parte, perché
  nessuno guardava: una persona apre l'app all'ora di pranzo e non trova niente.
  Ora `assertActivatable` rifiuta di rendere visibile una dieta con giornate a cui manca un
  pasto, e il nuovo **`npm run diag:menu-incompleti`** trova quelle già pubblicate **e le
  clienti che le stanno ricevendo** — cercate da `menu_day.diet_id`, cioè dalle giornate
  davvero consegnate, non dalle preferenze scritte nel profilo.

- `[Prodotto]` 🧹 **`npm run compatta:menu` — fare ordine nel catalogo.** Il catalogo si è
  formato a strati: un pezzo col metodo vecchio, un pezzo generato bene settimana per settimana,
  qualche piatto corretto a mano. I piatti ci sono, ma sono **sparsi** — la settimana 6 ha
  quattordici spuntini e la 2 ne ha tre, la 1 usa piatti che compaiono anche nella 5. Contando a
  mano non torna mai niente.
  Il comando **non genera niente e non chiama l'AI**: ridistribuisce quello che c'è. Per ogni
  pasto mette i piatti distinti in fila e ricostruisce le giornate in ordine — sette piatti
  diversi per pasto, dalla settimana 1 in avanti. Quello che avanza resta fuori dal ciclo.
  Il ciclo si accorcia (84 giorni con 44 pranzi diversi diventano 42), e va bene così: quei 42
  giorni sono **tutti diversi**, gli 84 di prima contenevano quaranta ripetizioni.

- `[Sviluppo]` ♻️ **Le ricette avanzate non si buttano.** Il generatore ora, prima di chiamare
  l'AI, ripesca le **ricette orfane** — già generate per quella dieta e quel regime ma fuori dal
  ciclo. Ne nascono compattando il catalogo e rifacendo le settimane: sono piatti pagati,
  scritti e spesso già riletti dal nutrizionista, e chiederne di nuovi all'AI mentre quelli
  stanno lì inutilizzati è spreco doppio — i soldi e il lavoro di chi li ha corretti.
  Il filtro sul **regime** è la parte che non si può sbagliare: una ricetta onnivora dentro una
  dieta vegana sarebbe un errore grave e silenzioso.

- `[Sviluppo]` 🍳 **«Completa» non completava niente, e il pulsante sembrava rotto.** Settimane
  1-4 fatte col metodo vecchio, 5-12 fatte bene, spunta «genera tutte le 18 varianti»: si chiede
  di completare la settimana 1 e non succede niente. Rigenerando, identico.
  Il motivo: le ricette *proprie* venivano filtrate — quei piatti compaiono anche nelle altre
  settimane, quindi non contano — ma subito dopo entravano quelle delle **varianti sorelle**
  (3 pasti, digiuno), che per la settimana 1 hanno esattamente gli stessi piatti presi in
  prestito. Quelle passavano **senza nessun controllo**: `mancanti` tornava a zero, l'AI non
  veniva chiamata, la settimana restava magra. Ora un piatto di una sorella vale solo se questa
  variante non lo sta già usando in un'altra settimana: altrimenti prenderlo qui non aggiunge
  varietà, la toglie.

- `[Sviluppo]` 📊 **La striscia delle settimane ora risponde per tutte le 18 varianti** quando
  la spunta è attiva (`?famiglia=1`). Prima mostrava lo stato della sola variante attiva: una
  settimana poteva essere verde lì e magra su una sorella, e le clienti di quella sorella
  ricevevano un menu che si ripete senza che nessuno lo vedesse. Magra da qualche parte = magra.

- `[Sviluppo]` 📌 **La variante su cui si lavora viene ricordata.** Cliccando sulla famiglia si
  apriva `variants[0]`, cioè la prima che il database restituisce: una a caso, e mai la stessa.
  Chi aveva finito dodici settimane su «onnivora · 5 pasti» usciva, rientrava, e si trovava
  davanti le settimane 1-4 di «vegana · mantenimento · 3 pasti» in giallo — convinto di aver
  perso il lavoro. Ora la variante si ricorda fra le sessioni; se non c'è niente da ricordare si
  apre la **maestra** (onnivora · dimagrimento · 5 pasti), quella da cui le altre riusano i
  piatti; e nel passo 2 ci sono i chip per cambiarla con un clic.

- `[Prodotto]` 🏷️ **«Nome nel percorso» si chiama ALIAS**, ed è il nome con cui la cliente si fa
  chiamare in app. Chiamarlo «nome» invitava a scriverci dentro nome e cognome — ed è
  esattamente quello che ha fatto l'import delle liste storiche: prima parola in *Nome*,
  *Cognome* vuoto, nome intero nell'alias. Risultato: in app veniva chiamata con nome e cognome
  per esteso, come una raccomandata, e in backoffice il cognome non c'era (niente ordinamento,
  niente ricerca). Nuovo comando **`npm run sistema:nomi`** che divide — ultima parola =
  cognome, particelle (De, Di, Della…) attaccate al cognome — mostra la tabella e scrive solo su
  conferma. Il numero opzionale (`-- 30`) limita **il lavoro**, non solo la stampa: limitare la
  sola tabella voleva dire leggerne trenta e scriverne trecento.

- `[Prodotto]` 🏁 **«Percorso concluso» automatico a +7 giorni** dalla fine del piano, senza
  rinnovo (richiesta delle coach, 8/8). La colonna esisteva nella pipeline dal primo giorno e
  **non la scriveva nessuno**: chi finiva restava fermo nella colonna dell'ultima cosa fatta,
  mescolato a chi era ancora in corso. Perché +7 e non subito: il rinnovo arriva quasi sempre
  nei giorni dopo la scadenza, e archiviare qualcuno il giorno stesso vuol dire archiviare una
  persona che sta per tornare. Chi ha un abbonamento attivo **o anche solo un bonifico in
  attesa** non si tocca.

- `[Prodotto]` 🧍 **Nome e Cognome, obbligatori. E un Alias facoltativo.** Nel form «Nuovo lead»
  c'era un solo campo «Nome (facoltativo)»: si potevano inserire lead **senza nome** — che in
  tabella diventano una riga con la sola email, e nessuno sa più chi sia — e chi il nome lo
  scriveva lo scriveva come gli veniva, quindi ordinare per cognome era impossibile.
  Ora sono due campi obbligatori, più un **Alias** facoltativo (come si fa chiamare). In
  Gestione lead ci sono due colonne, **Nome** e **Cognome**, entrambe ordinabili; l'alias in
  tabella non compare.
  Tre scelte dietro, tutte con lo stesso movente — non rompere quello che già funziona:
  · `name` resta e viene tenuto allineato come «Nome Cognome», perché lo leggono tabella,
    pipeline, email, ricevute e import: riscrivere tutti quei punti sarebbe stato un rischio
    senza guadagno;
  · le colonne nuove sono **nullable**: le schede importate hanno solo il nome intero, e
    spezzare «Maria Teresa De Santis» a occhio produrrebbe un cognome sbagliato che poi nessuno
    ricontrolla. Su quelle la scheda mostra ancora il campo intero, finché non le si separa;
  · nome, cognome e alias si correggono **anche dalla scheda**, altrimenti sarebbero dati che si
    scrivono una volta sola.
  Migrazione `20260809090000_lead_nome_cognome_alias` (tre colonne nullable, nessun dato toccato).

- `[Prodotto]` 🛡️ **Il Monitoraggio a €19 adesso è un prodotto vero.** Fin qui erogava gli
  **stessi identici menu** del Mantenimento a €49, perché il motore guardava solo che ci fosse un
  abbonamento attivo, mai quale. Due prezzi molto diversi per la stessa cosa. Deciso (Simone) che
  cosa deve essere, e scritto nel codice:
  · **niente menu di piano** — non è quello che il piano promette;
  · **il peso si chiede, non si impone**: Gaia lo domanda ogni tanto, nessun popup bloccante e
    nessun blocco dell'app (era la trappola peggiore: senza menu in arrivo il gate misure restava
    «mancano le misure iniziali» per sempre, a una persona che paga ogni mese);
  · superata la soglia (+3 kg, parametrico) si prepara **una settimana** di menu scelti fra
    quelli che su di lei hanno fatto perdere di più — erano 8 giorni, numero ereditato dal
    prodotto «Menu di rientro (8 giorni)» che non esiste più (`monitoring_rientro_days`);
  · **tutta l'app e la coach restano raggiungibili**, e in app compare una frase che spiega dove
    si trova invece di un «menu in preparazione» che non arriverà mai.
  Sotto c'era il difetto grosso: **pagare i €19 chiudeva il monitoraggio**. La regola «qualsiasi
  piano a pagamento chiude il monitoraggio in corso» valeva anche per il piano che *è*
  monitoraggio, quindi chi pagava si comprava la fine del servizio che stava comprando — niente
  richieste del peso, e soprattutto **niente menu di rientro**, perché il giro giornaliero lavora
  sui periodi attivi. Senza nessun errore: semplicemente non succedeva più niente.

- `[Sviluppo]` 🛒 **Il pulsante del report vendeva solo il mese singolo.** «Attiva il
  mantenimento» a fine percorso non passava `billing`, quindi nel Checkout non compariva la
  scelta fra abbonamento e mese singolo: la strada principale di conversione convertiva nel modo
  meno redditizio, e in silenzio (dal Negozio la scelta c'era, quindi nessuno se ne accorgeva).

- `[Sviluppo]` 🩹 **«La dieta è in stato approved: non pubblicabile».** Da quando la pagina apre
  da sola una variante, quasi sempre ne apre una già pubblicata su cui è appena stata generata
  una settimana in più — e il pulsante «Approva e pubblica» rispondeva con quell'errore rosso in
  cima alla pagina, che sembrava dire «non puoi più approvare niente». Il lavoro da fare c'era ed
  era un altro: attivare le ricette della settimana nuova, che nascono in bozza. Ora su una
  variante pubblicata il pulsante diventa **«Attiva le ricette nuove»** e la riga sopra dice
  «già pubblicata» invece di «Bozza · stato approved», che era una contraddizione in due parole.

- `[Sviluppo]` 🔗 **L'abbonamento orfano, e i soldi che entrano senza che nessuno se ne accorga.**
  `stripeSubscriptionId` lo scriveva **solo** `checkout.session.completed`. Se quel singolo
  webhook si perdeva — un deploy in corso, un 500, l'endpoint irraggiungibile per dieci minuti —
  la colonna restava `null` **per sempre**. Da lì in poi nessuna fattura ritrovava più la riga:
  la cliente pagava ogni mese, la scadenza non si spostava (quindi prima o poi restava senza
  menu *pur pagando*) e la disdetta dall'app rispondeva «Nessun abbonamento da disdire». Tutto
  con la webhook che risponde 200: nessun errore da nessuna parte.
  Il rimedio era già nei dati e nessuno lo leggeva: alla creazione del checkout i nostri id
  finiscono in `subscription_data.metadata`, e Stripe li rimanda su **ogni** fattura. Ora, se
  l'aggancio manca, si risale da lì e si riscrive — quindi il difetto **si ripara da solo** alla
  prima fattura successiva. Con un limite deliberato: se la riga punta già a un *altro*
  abbonamento Stripe non si tocca niente e resta una segnalazione nell'audit
  (`riaggancio_rifiutato`), perché spostare a mano il filo dei pagamenti di qualcuno è roba da
  persone, non da webhook.

- `[Sviluppo]` 💸 **La provvigione del rinnovo non può più sparire in silenzio.** Il pagamento
  viene creato — e con lui il segno di idempotenza — *prima* di `generateCommissions`. Se quella
  falliva, l'eccezione risaliva alla webhook (500), Stripe riconsegnava, e al secondo giro il
  pagamento risultava già fatto: provvigioni, ricevuta e notifica alla coach **non nascevano
  mai**. Ora l'errore viene fermato e scritto (`commerce.commission.failed`, col rimedio dentro),
  la catena prosegue, e il recupero è il pulsante **↻ Ricalcola provvigioni** di ieri. Stessa
  protezione sul primo pagamento, dov'era identica.

- `[Sviluppo]` 🧾 **La ricevuta del rinnovo ora ha la ricevuta dentro.** Dal secondo mese in poi
  l'email diceva «ecco la tua ricevuta» e non allegava niente: chi paga sei mesi aveva un
  documento buono e cinque email vuote. Ora il PDF è allegato come al primo pagamento.

- `[Sviluppo]` 🔑 **Il lead non sceglie più la password due volte.** L'account creato da
  «Invia credenziali» nasce con `mustChangePassword: true` e riceve un link di reimpostazione;
  la conferma del reset scriveva la password ma lasciava il flag alzato, quindi al primo accesso
  l'app la rimandava a «scegli la password» — la stessa di due minuti prima. Nessun errore, solo
  una persona convinta di aver sbagliato qualcosa.

  692 test verdi (erano 661).

---

## 2026-08-08

- `[Sviluppo]` ✅ **`pubblica:tutto` lanciato in produzione su tutto il catalogo.** 1468 ricette
  attivate, 1477 allergeni confermati, 273 gruppi approvati, 30 diete pubblicate e rese visibili
  alle clienti. Saltate 13: le 12 «Digiuno intermittente (16:8)» archiviate e «Ritorno in
  Equilibrio · onnivora · mantenimento · 3 pasti», che non ha nessuna giornata.
  ⚠️ Fra le 30 pubblicate c'è **`lovcarbciccio · onnivora · dimagrimento · 5 pasti`**, che dal
  nome è una prova: era in bozza, ora è visibile alle clienti e va archiviata. È il prezzo di un
  comando che pubblica «tutto quello che trova»: la prossima volta conviene passargli il nome
  della famiglia. Dettagli in `progetto/DA_RIPRENDERE_20260809.md`.

- `[Sviluppo]` 🧾 **«Valida e pubblica» era sparito — e non era un difetto grafico.**
  Il passo 3 lavora sulla variante selezionata: dopo una pubblicazione quella selezione resta
  vuota, e la pagina rispondeva «Genera un catalogo per iniziare la validazione guidata» con
  diciotto varianti elencate due centimetri più sopra. Ora la variante se la sceglie da sola
  (la prima con dei passi ancora da fare), e il riquadro «Tutta la famiglia in un colpo» è
  uscito da dentro il blocco della singola bozza: c'è sempre.
  Sotto, però, c'era una cosa peggiore: il pulsante **saltava le varianti già pubblicate**.
  Sembrava prudenza — ripubblicare una dieta approvata dà errore — ma è proprio lì che stanno
  le ricette nuove: ogni settimana generata dopo la pubblicazione nasce **in bozza**, con le
  ricette inattive. Su una famiglia interamente pubblicata il pulsante non faceva quindi
  assolutamente niente, e le clienti continuavano a ricevere solo i piatti vecchi mentre il
  backoffice diceva «18 pubblicate». Ora la validazione passa su tutte (attiva le ricette,
  conferma gli allergeni, approva i gruppi) e si salta solo la *ripubblicazione* di chi è già
  approvata. La pagina non si azzera più: dopo l'ultima settimana ci si ripassa ogni volta.

- `[Sviluppo]` ✅ **Comando `npm run pubblica:tutto`** — lo stesso lavoro su tutto il catalogo in
  un colpo, per rimettere in pari le diete generate in questi giorni:
  `npm run pubblica:tutto` mostra cosa farebbe, `CONFERMA=1 npm run pubblica:tutto` applica, e
  con un nome fra virgolette si limita a una famiglia. Non tocca le **archiviate** (sono fuori
  apposta) né le diete senza giornate. Da leggere prima di lanciarlo: marcare gli allergeni
  «confermati» in blocco è una dichiarazione, non una pulizia tecnica — è la stessa cosa che fa
  il pulsante, ma su tutto il catalogo invece che su una famiglia guardata da chi l'ha generata.

- `[Sviluppo]` 💶 **Pulsante «Ricalcola provvigioni» sulla riga dell'acquisto.** Corrette le
  percentuali del piano (sono soglie **cumulative**: 25 / 35 / 45, non 25 / 10 / 10), i
  pagamenti già fatti restavano com'erano. Ora si rilegge il singolo acquisto con le
  percentuali di oggi e si **aggiunge solo quello che manca**: non cancella righe di
  contabilità già registrate e, se qualcuno ha preso più del dovuto, lo segnala senza togliere
  niente — togliere soldi a una persona non è un'operazione da bottone. Rilanciarlo non
  raddoppia: la seconda volta la differenza è zero. Endpoint `POST /admin/purchases/:id/ricalcola-provvigioni`
  (solo admin); da riga di comando resta `npm run ricalcola:provvigioni`, che fa gli stessi
  conti su un'intera cliente o su tutti i pagamenti da una data.

- `[Sviluppo]` 📐 **Pagina Acquisti impaginata.** Colonne a larghezza fissa, nome prodotto su una
  riga sola coi puntini (per intero nel tooltip) e azioni a icone: cinque pulsanti scritti per
  esteso spingevano la tabella oltre il bordo dello schermo e la colonna della ricevuta restava
  tagliata. I due filtri per data sono ora uno sotto l'altro, e la pagina mostra 50 righe.

- `[Prodotto]` 🔔 **Le tre notifiche coach che mancavano, e il clic che apre la scheda.**
  Delle cinque chieste dalle coach, due c'erano già (lead assegnato, nuova registrazione col
  codice). Le altre tre no, e sono i tre momenti in cui una cliente fa un passo avanti:
  · **Questionario completato** — è il momento in cui una telefonata vale di più: ha appena
    raccontato obiettivi, abitudini e paure, e si aspetta che qualcuno le abbia lette;
  · **Prova attivata** — la finestra in cui una chiamata cambia l'esito della settimana;
  · **Rinnovo** — e qui c'era anche un difetto vecchio: la coach vedeva l'incasso **solo del
    primo mese**. Dal secondo in poi il rinnovo passava da `handleInvoicePaid`, che non avvisava
    nessuno: dalla sua parte una cliente che paga da sei mesi sembrava ferma al primo pagamento.
    Ora arrivano due notifiche distinte, perché sono due cose diverse — il rinnovo (un passo del
    percorso) e l'incasso (i suoi soldi).

- `[Sviluppo]` 👆 **Dalla notifica si apre la scheda cliente.** Il `clientId` il backend lo
  mandava **già** nel payload, da sempre: era la lista delle notifiche staff a buttarlo via. Si
  leggeva «Marta ha attivato la prova» e poi bisognava andare a cercare Marta a mano nell'elenco.
  Ora il tocco porta sulla sua scheda — `/clienti/:id` per la coach, `/pazienti/:id` per la
  nutrizionista, che condividono la pagina ma non le rotte — e la riga mostra la freccia solo
  quando c'è davvero dove andare.

- `[Prodotto]` 🔓 **Le segnalazioni arrivano sulla dashboard della nutrizionista, col motivo.**
  Il conteggio c'era già (`openEscalations`), ma serviva solo a gonfiare il badge della
  campanella: **il testo della segnalazione non compariva da nessuna parte** nell'app
  nutrizionista. Il risultato era il peggiore possibile — la cliente leggeva «la nutrizionista
  sta sistemando il tuo menu» e la nutrizionista non sapeva né di doverlo sistemare né perché.
  Ora c'è una sezione **Segnalazioni** in cima, prima delle priorità cliniche, con il motivo per
  esteso. Quelle che bloccano il piano sono in rosso e marcate **«NON RICEVE I MENU»**, e stanno
  per prime: sono le uniche in cui una paziente, in questo momento, non riceve niente. Due sole
  scelte per riga: **Sblocca il piano** e **Apri la scheda** (da lì la chat).

- `[Sviluppo]` 🧩 **«Sblocca» adesso sblocca davvero.** Prima l'unica cosa possibile era cambiare
  lo stato della segnalazione dal backoffice, ed era **cosmetico**: il blocco non è uno stato
  salvato, viene **ricalcolato a ogni composizione del menu**. Chiusa a mano, alla prima apertura
  dell'app la stessa identica segnalazione si riapriva — e nel frattempo la cliente aveva visto
  sparire il messaggio senza ricevere un menu.
  Adesso il pulsante rilancia `buildPersonalBase`, che è la cosa che decide davvero: se riesce,
  risolve i blocchi da sé e i menu ripartono; se non riesce, torna il motivo **aggiornato** — non
  quello vecchio — e la segnalazione resta aperta con l'informazione giusta.

- `[Sviluppo]` 🔒 **Un buco di riservatezza trovato per strada.** L'unico endpoint disponibile,
  `GET /admin/escalations`, restituiva le segnalazioni di **tutte le clienti** a chiunque avesse
  il ruolo — anche a una nutrizionista con tre pazienti, che si sarebbe letta i motivi clinici di
  clienti non sue. Il nuovo `/nutritionist/escalations` è filtrato sui pazienti assegnati; capo e
  admin continuano a vedere tutto.

- `[Prodotto]` 🔔 **La notifica alla cliente quando lo staff le scrive: c'era già.** Verificato
  riga per riga prima di rifarla: `chat.service.ts` crea la notifica in-app
  `chat_reply_nutritionist` / `chat_reply_coach` e chiama subito la push, con anti-raffica di 3
  minuti e rispetto dell'opt-out. Nell'app ci sono icona, deep-link a `/contatti` e interruttore
  nelle preferenze. L'unica condizione è l'app nativa col permesso notifiche: su browser la push
  non esiste, e non è un difetto nostro.

- `[Prodotto]` 🔀 **Le richieste delle coach — primo blocco.** Dodici punti arrivati dalle coach
  l'8/8. **Tre esistevano già** e nessuno lo sapeva: il sollecito questionario a 24 ore
  (`profilo_incompleto`), la mail di compleanno (`ev_compleanno`) e la notifica «nuova
  registrazione col tuo codice». Erano ferme perché il motore delle mail automatiche ha il
  master spento di default.

- `[Sviluppo]` 📬 **Copia alla coach su tutte le mail alle clienti.** Il `MailService` non aveva
  nessun campo cc/bcc: aggiunto il BCC (Brevo lo supporta via API, non era cablato). La coach si
  risale dall'indirizzo della destinataria, non va passata dal chiamante — chi manda l'email
  quasi mai ce l'ha in mano, ce l'ha il database.
  Coperte: ricevuta, bonifico, rimborso, report mensile, copie email delle notifiche, tutte le
  mail del ciclo di vita e le campagne marketing.
  **Escluse di proposito**, ed è la cosa da ricordare: reset password, verifica email, cambio
  email e credenziali del lead. Quei link **aprono la casella e il profilo della cliente**:
  girarli a una terza persona, per quanto fidata, è una porta aperta e non un servizio. Simone
  ha confermato la scelta.
  BCC e non CC per due motivi: la cliente non deve leggere l'indirizzo della sua coach in ogni
  email, e un «rispondi a tutti» finirebbe sulla casella personale della coach invece che in chat.

- `[Sviluppo]` 🧾 **Niente ricevuta sul prodotto gratuito.** `finalizeApproval` mandava la
  ricevuta sempre, anche con `amountCents: 0`: chi attivava la prova riceveva una «Ricevuta di
  pagamento» da **€ 0,00** con tanto di PDF numerato in allegato. Oltre a essere un documento che
  non documenta niente, era la prima email dopo l'iscrizione: parlare di pagamenti a chi non ha
  pagato è il modo più rapido per farle temere un addebito.

- `[Prodotto]` 🪜 **Due stati nuovi in pipeline.** «Questionario completato» (posizione 2, prima
  di Prova) scatta da solo alla fine del questionario: le coach lo avevano chiesto per vedere
  sulla board chi è pronta per la chiamata senza aprire una scheda alla volta.
  «Percorso concluso» esiste come colonna; l'automazione a +7 giorni dalla fine piano arriva nel
  prossimo blocco. Entrambi di sistema, quindi il seed li crea anche sull'installazione già
  avviata. Prova e Acquisito scalano da 2 a 3, **ma solo se sono ancora all'ordine di default**:
  se l'admin ha riordinato la board, la sua scelta vale più della nostra.
  `npm run fix:stato-questionario` sistema le clienti che l'hanno già compilato.

- `[Sviluppo]` ⬆️ **Un avanzamento che non fa retrocedere.** Nuovo `commerce/avanza-stato.ts`:
  sposta la scheda solo se lo stato richiesto è **più avanti** di quello attuale. Prima non
  c'era, e un pagamento approvato riportava sempre ad «Acquisito» anche una scheda che una coach
  aveva già spostato su Follow-up — cancellando un lavoro fatto da una persona.
  Sta in un file senza Nest perché lo usano anche moduli che non devono dipendere da commerce
  (il questionario): l'alternativa era importare CommerceModule dentro OnboardingModule per una
  riga sola, e mettersi in casa un giro di dipendenze che prima o poi si chiude ad anello.

- `[Prodotto]` ✉️ **Mail di fine prova gratuita** (`trial_fine`, nuova). Arriva il giorno in cui
  la prova si chiude, e non parla di sconti: dice quello che è vero e che dall'esterno non si
  vede — in otto giorni il motore ha preparato *N* giornate di menu e ha imparato le sue
  esclusioni, i piatti che ha sostituito, gli orari che le tornano. Se si ferma lì, quel lavoro
  resta fermo. I numeri nell'email sono i suoi, letti a runtime, non un modo di dire.
  Diversa dal win-back, che arriva a piano finito da giorni e riguarda i paganti.

- `[Sviluppo]` 🔌 **`npm run accendi:automazioni`** (una volta, a mano). Accende l'assistente AI
  in chat e il motore delle mail con **solo** i tre inneschi chiesti (sollecito questionario,
  compleanno, fine prova). Tutti gli altri implementati vengono messi **esplicitamente a spento**:
  il motore funziona a opt-out, quindi accendere il master senza quella lista farebbe partire in
  un colpo benvenuto, onboarding, promemoria rinnovo, win-back e anniversario, a clienti che non
  li hanno mai ricevuti.
  È uno script e non un default del seed per una ragione precisa: **il seed gira a ogni deploy**.
  Un «acceso» scritto lì dentro riaccenderebbe da solo un interruttore che qualcuno ha spento dal
  backoffice, e nessuno capirebbe perché. Gli interruttori sono di chi gestisce.
  Lo script controlla anche che i modelli email esistano e siano attivi: un innesco acceso senza
  modello è acceso e non manda niente.

- `[Sviluppo]` 🗓️ **Il pulsante della settimana 9 non c'era.** Segnalato da Simone con uno
  screenshot: con nove settimane in catalogo la pagina scriveva «Genera la settimana 10» su un
  pulsante che non esisteva, perché la fila ne disegnava sempre otto fisse mentre il backend ne
  accetta dodici. Ora la fila è lunga almeno quanto serve: sempre una in più di quelle già fatte.

- `[Prodotto]` 📅 **Il catalogo si genera una settimana per volta.** Aprendo le ricette della Keto
  Mediterranea erano **28 in tutto**, non 28 colazioni + 28 pranzi + 28 cene + 28 merende. Il
  generatore produceva **5 ricette per pasto** e poi *ricombinava quelle* per 28 giornate: il
  commento nel codice lo diceva («ridotto per output AI più piccolo e JSON più affidabile»), e il
  conto tornava — con 5 colazioni su 28 giorni ogni colazione torna cinque o sei volte. **La
  ripetizione non era sfortuna, era aritmetica.**
  Chiedere all'AI 140 ricette in un colpo solo riporterebbe il problema di partenza (JSON enorme e
  rotto). Quindi: **una settimana per volta**, e dentro la settimana **un pasto per volta**. Sette
  richieste piccole invece di una gigante, lanciate in parallelo.
  Nel backoffice il campo «giorni da generare» è sparito: al suo posto ci sono i pulsanti
  **Settimana 1, 2, 3…**, con la spunta su quelle già fatte e la prossima già selezionata. Oltre la
  prossima non si può saltare: settimana 1 e 3 senza la 2 lascerebbe il ciclo con giornate mancanti
  in mezzo, e il motore non sa colmarle.
  Le giornate si compongono **per indice** — giorno 1 la prima ricetta di ogni pasto, giorno 2 la
  seconda — quindi dentro la settimana non si ripete niente **per costruzione**, non per fortuna.
  Alle settimane successive l'elenco dei piatti già in catalogo va nel prompt, così l'AI non li
  ripropone.

- `[Prodotto]` 🍽️ **Le ricette sono della dieta, non della struttura pasti.** Precisazione del
  nutrizionista, e cambia parecchio: la Keto Mediterranea onnivora a **3 pasti**, a **5 pasti** e a
  **digiuno intermittente** mangia gli **stessi piatti** — cambia come sono distribuiti nella
  giornata, non che cosa sono. I piatti cambiano davvero quando cambia il **regime** (vegano,
  vegetariano) o lo **stile** (keto invece di mediterranea).
  Quindi le varianti di struttura ora **condividono le ricette**: si generano una volta sola e le
  giornate delle altre le riusano (una ricetta non appartiene a una dieta, è referenziata dalle
  giornate — condividerla non richiede duplicati). «Genera tutte le varianti» parte dalla variante
  a 5 pasti, che copre tutti i pasti che servono alle altre: le altre due non chiamano più l'AI.
  Da tre generazioni complete a una: meno attesa, meno costo, e soprattutto **le tre varianti
  restano coerenti fra loro** invece di divergere ad ogni rigenerazione.

- `[Prodotto]` 🧷 **Le ricette già corrette a mano non si buttano.** Obiezione di Simone, ed è
  quella giusta: il nutrizionista ne ha sistemate parecchie, e quel lavoro vale più di qualunque
  generazione. Quindi su una settimana che esiste già la modalità normale non è «rigenera» ma
  **«completa»**: si tengono le ricette che ci sono, si chiede all'AI **solo la differenza** per
  arrivare a sette per pasto, e si riscrivono le sette giornate perché nessun piatto torni due
  volte. **Non si cancella niente.**
  Il criterio è semplice: il «magazzino» di ogni pasto si mette in fila nell'ordine in cui i
  piatti compaiono nelle giornate; le prime `(settimana-1)×7` sono impegnate nelle settimane
  precedenti, quelle che restano vanno a questa.
  *Sulla Keto Mediterranea, che ha 5 pranzi spalmati su 28 giorni:* la settimana 1 se li prende
  tutti e cinque e ne chiede **2** nuovi; la settimana 2 trova il magazzino esaurito e ne chiede
  **7**. Alla fine i pranzi sono 28 diversi e i 5 corretti a mano sono ancora lì.
  «Rifai da capo» resta possibile, ma è una spunta da accendere apposta, con una seconda
  conferma che dice a chiare lettere che cancella anche le correzioni. E anche lì non si tocca
  mai una ricetta **già attiva**: attiva vuol dire che il motore l'ha potuta erogare, quindi può
  stare dentro un menu già consegnato. Quel menu è una fotografia e continuerebbe a mostrarsi,
  ma le valutazioni e le sostituzioni cercano la ricetta per id e non la troverebbero più. Si
  buttano solo le bozze mai attivate. Il prezzo è qualche ricetta orfana in catalogo: è il verso
  giusto in cui sbagliare.
  ⚠️ **Le diete già generate col vecchio metodo restano magre.** La Keto Mediterranea ha 28
  giornate, quindi risulta «4 settimane fatte»: vanno **completate** una settimana per volta,
  partendo dalla variante a 5 pasti (le sorelle poi riusano le sue).
  Test: +8 (660 in tutto).

- `[Prodotto]` 📄 **Guida per la nutrizionista** (`progetto/guide/`): cinque pagine, passo per
  passo, scritte per chi non è tecnico — perché i menu si ripetevano, che le sue correzioni non
  si perdono, i sette passi da fare, da quali diete iniziare e le domande che le verranno.
  Nel repo c'è anche lo script che la rigenera, così quando l'interfaccia cambia si rifà il PDF
  invece di riscriverlo.
  Insieme: `npm run diag:settimane`, che stampa le diete **già nell'ordine in cui conviene
  lavorarle** — clienti sopra, giornate, e soprattutto quanti piatti diversi ha il pasto messo
  peggio. È quel numero che conta: 28 giornate con 5 colazioni sono peggio di 7 giornate con 7.

- `[Prodotto]` 🔢 **Il conto vero: 287 varianti, 286 magre, ma solo 16 con qualcuno sopra.** Il
  primo giro di diagnostica ha ridimensionato il lavoro. Rifare tutto a mano non è un lavoro che
  si fa; e non serve, perché **le clienti attive sono 25 su 16 varianti**, che condividendo le
  ricette si riducono a **12 diete**. Nella guida c'è quella lista, in ordine, con quante clienti
  ha ciascuna: sono circa 48 generazioni, meno di un'ora. Le altre 270 varianti non hanno nessuno
  sopra e si rigenerano quando servono, non prima.
  Due cose emerse dal giro, che non sono varietà ma difetti veri:
  · **«Vacanze in Serenità» onnivora dimagrimento 3 pasti ha SOLO le colazioni** — niente pranzo,
    niente cena — e **c'è una cliente che la sta ricevendo**. Va guardata per prima.
  · **«Ritorno in Equilibrio» onnivora mantenimento 3 pasti è del tutto vuota**: zero giornate.
    La diagnostica la contava fra quelle «già a posto» — un difetto suo, corretto: adesso una
    dieta senza giornate esce come *VUOTA* e va in cima, e una a cui mancano interi pasti esce
    marcata *MANCANO INTERI PASTI*, perché lì non è questione di ripetizioni.

- `[Prodotto]` 🌶️ **Le spezie non sono più un cibo da escludere.** La regola l'ha dettata la
  nutrizionista, e nasce dalla cliente che riceveva lo stesso pranzo per quattro giorni di fila.
  Non era un difetto del motore: aveva trenta esclusioni, e fra quelle c'erano **curry** e
  **cumino**. Una spezia è una pizzicata, ma il motore la tratta come tutti gli altri
  ingredienti — cerca la parola nel nome e negli ingredienti e **scarta l'intero piatto**. Così
  «non mi piace il curry» le aveva cancellato dal ricettario ogni piatto speziato, e i pranzi
  utilizzabili erano scesi a **uno su cinque**.
  Da oggi:
  · se scrive il nome di una **spezia precisa** (curry, cumino, cannella, zafferano, paprika,
    peperoncino, e anche le erbe aromatiche) → non entra fra i cibi esclusi, e le risponde un
    pop-up: **«sostituiscila con le spezie che più ti piacciono»**, con la spiegazione del
    perché — la spezia la mette lei in cucina, quindi la scelta resta sua senza costarle metà
    del ricettario;
  · se scrive **«spezie» in generale** → **«contatta la tua coach per analizzare come utilizzare
    i menu senza spezie»**. Non è una preferenza da registrare al volo: è una conversazione.
  Il cancello vale per **tutte** le portate, non solo per «non mi piace»: anche una sostituzione
  di tre giorni farebbe scartare i piatti speziati, che è esattamente il danno da evitare.

- `[Sviluppo]` 🚪 **Il cancello è in tre punti, non in uno.** La strada normale è
  `POST /me/menu/substitute`, ma i cibi non graditi si scrivono anche dal **questionario** e
  dalla **PATCH del profilo** (la sezione "Cibi esclusi" manda la lista intera). Una regola
  messa in un punto solo si aggira dalla finestra, quindi il filtro sta in tutti e tre, e la
  logica sta in **un file solo**: `backend/src/menu/spezie.ts`.
  Due limiti sono voluti e scritti nel file:
  · **allergie e intolleranze non passano mai di qui.** Senape, sesamo e sedano sono allergeni
    UE: quella è sicurezza, non gusto, e resta un'esclusione vera;
  · **il confronto è esatto, non per sottostringa.** «noce moscata» è una spezia, «noce» è
    frutta a guscio; «pepe» è una spezia, «peperoni» sono una verdura. Cercare per sottostringa
    le confonderebbe, ed è il tipo di errore che qui costa caro. Aglio e cipolla restano cibo:
    si usano a peso, non a pizzichi.
  Il testo del pop-up viaggia anche nel campo `message`, così le **app già installate** — dove
  gli aggiornamenti OTA sono spenti dal 6/8 — lo mostrano lo stesso al posto della conferma.
  Test: +13.

- `[Sviluppo]` 🧹 **Chi la spezia ce l'ha già in lista continuava a subirla.** La regola nuova
  protegge chi arriva da qui in avanti; per le altre c'è `npm run pulisci:spezie`, che elenca
  cliente per cliente quali spezie toglie e quanti cibi **veri** restano esclusi dopo. Mostra e
  basta finché non si lancia con `CONFERMA=1`.
  Chi aveva escluso «le spezie» in generale finisce in un elenco a parte: il termine si toglie
  lo stesso (altrimenti continua a svuotarle il ricettario) ma la telefonata della coach va
  fatta lo stesso — non la sostituisce uno script.
  I menu già consegnati non si toccano: si riallineano da soli alla prossima erogazione, e
  rifarli confonderebbe chi ha già fatto la spesa.

- `[Sviluppo]` 🔔 **Notifiche doppie alle coach di notte: corretto.** Prima delle tre cose
  trovate nella revisione di ieri sera, ed è una conseguenza diretta del cambio di "oggi" del 7/8.
  `notifyOncePerDay` confrontava una **mezzanotte** con un **istante**: da quando la mezzanotte è
  quella italiana, fra le 22:00 e le 24:00 UTC quella mezzanotte è già di domani — cioè **nel
  futuro** — e la finestra non trovava le notifiche appena scritte.
  *Cosa vedeva la coach:* una cliente che le scrive alle 00:10 e poi alle 00:50 le faceva arrivare
  **due** notifiche; se riscriveva la mattina dopo, una **terza**.
  Ora si confrontano due grandezze omogenee: si prende l'ultima notifica di quel tipo e si guarda
  se il suo **giorno italiano** è oggi. La finestra mobile (`dedupeWindowMs`) resta un confronto
  fra istanti, che era già giusto. Test: +5.

- `[Sviluppo]` 🎲 **Un test che sarebbe diventato instabile stanotte.** In
  `menu-measurement-gate.spec.ts` l'helper `dayIso` era rimasto sul giorno **UTC** mentre il
  codice sotto test confronta col giorno **romano**: se la CI fosse girata fra le 22:00 e le
  24:00 UTC, il caso «2° giorno nel futuro → non bloccante» sarebbe fallito. Non è successo solo
  per l'orario in cui abbiamo lanciato. Ora l'helper usa `giornoLocale`, cioè la stessa funzione
  del codice che verifica.

---

## 2026-08-07

- `[Sviluppo]` 📱 **Lo stesso difetto delle date era anche nell'app — in sette punti.** Corretto
  il backend, la stessa riga (`new Date().toISOString().slice(0, 10)`, cioè il giorno **UTC**)
  compariva ancora in Home, Percorso, Obiettivo, passi, StartDatePrompt, MenuReviewPopup e
  PaymentResult. Nella finestra fra mezzanotte e le 02:00, per l'app era ancora ieri:
  · il **menu di oggi** in Home e in Percorso veniva cercato alla data sbagliata e quindi **non
    compariva** — schermata vuota su un piano perfettamente attivo;
  · i **passi** finivano sul giorno precedente, e la baseline del contapassi si azzerava male;
  · la pagina Obiettivo credeva che la misura di oggi non fosse stata inviata.
  Va detta anche una cosa scomoda: **correggendo solo il backend avevo peggiorato la
  situazione** in quella finestra. Prima app e server sbagliavano insieme, quindi almeno si
  capivano; dopo, il server registrava il giorno italiano e l'app ne chiedeva un altro. Una
  correzione a metà, su due sistemi che si parlano, può essere peggio di nessuna correzione:
  vale la pena ricordarselo.
  Ora c'è `app/src/lib/giorno.ts`, che dà la **stessa** risposta di `common/date-only.ts` lato
  server.

- `[Sviluppo]` 🧭 **Il giorno è quello del percorso, non quello del telefono.** Scelta esplicita:
  l'app usa il calendario **italiano**, non il fuso del dispositivo. Usare quello del telefono
  sembra più gentile, ma metterebbe di nuovo app e server in disaccordo appena una cliente parte
  per un viaggio: lei chiederebbe il menu di un giorno e il database ne conoscerebbe un altro.
  Il giorno del percorso è uno solo. Se un domani si cambia `APP_TIMEZONE` sul backend, va
  cambiato anche in `giorno.ts` — sta scritto in cima a entrambi i file.
  Corretto anche il **backoffice**, pagina Contabilità: un costo registrato di notte finiva al
  giorno prima, e il 1° gennaio a notte fonda finiva nel **mese e nell'anno precedenti** — cioè
  nel bilancio sbagliato.
  Test: +5 nell'app (10 in tutto, la seconda cosa che i test dell'app intercettano da quando
  esistono, cioè da stamattina).

- `[Sviluppo]` 🌙 **Le misure inserite di notte finivano sul giorno prima — e cancellavano quelle
  del giorno prima.** Cercando altri difetti della stessa famiglia (logica giusta, contorno
  sbagliato) è saltato fuori questo, che è il più serio della giornata perché **perde dati**.
  `toDateOnly()` leggeva il giorno **UTC**. Il server sta a Francoforte, le clienti stanno in
  Italia, e d'estate l'Italia è avanti di due ore: fra la **mezzanotte e le 02:00** — l'01:00
  d'inverno — in Italia è già domani mentre per UTC è ancora ieri.
  Quindi una cliente che si pesa alle 00:30 dell'8 agosto veniva registrata al **7**. E siccome
  le misure hanno un vincolo di unicità per `(cliente, data)` e si salvano in `upsert`, quella
  pesata **sovrascriveva la misura del 7**: il dato del giorno prima spariva. Nessun errore,
  nessun avviso — solo un punto del grafico che cambia valore, e un calo che non torna.
  Stesso effetto su check-in, acqua, passi e sul gate misure, che a quel punto crede che la
  misura di «oggi» ci sia già e non la chiede.
  Ora «oggi» è il giorno del **fuso dell'azienda** (`APP_TIMEZONE`, default `Europe/Rome`,
  cambiabile da Render senza deploy), che è quello che intendono sia la cliente sia la coach.
  Il dato resta salvato a mezzanotte UTC, perché la colonna è un DATE e il confronto deve
  restare stabile.
  Una scelta che vale la pena spiegare: una stringa di **sola data** (`2026-08-08`) si prende
  alla lettera, senza conversione. Non contiene un orario, quindi non c'è niente da convertire —
  e convertirla la sposterebbe di un giorno in tutti i fusi a ovest di Greenwich, cioè
  introdurrebbe lo stesso difetto al contrario.
  ⚠️ Il passato non si tocca: le misure già registrate restano dove sono. Se in un grafico c'è
  un salto strano su una data, adesso si sa da dove può venire.

- `[Sviluppo]` ♻️ **«Che giorno è oggi» era scritto in tre posti, e in tre posti sbagliato.**
  La stessa riga (`toISOString().slice(0,10)`) era copiata in `diet-agent.service`, in
  `conversation-summary.service` e dentro `stato-viaggio.ts`. Tutte e tre leggevano il giorno UTC,
  quindi tutte e tre avevano lo stesso difetto — ma in punti che nessuno avrebbe collegato al caso
  delle misure: lo stato dell'agente dieta, i riassunti delle conversazioni, la scadenza della
  modalità viaggio.
  È il terzo caso in due giorni di logica copiata che diverge — dopo `pickDiet` e la lettura dei
  campi numerici — e la lezione è sempre la stessa: **una definizione, un posto**. Ora tutte
  passano da `date-only.ts`, che è l'unico file dove sta scritto cosa vuol dire «oggi».
  Test: +9 (59 suite, 620 test).

- `[Sviluppo]` 🧹 **Finito il giro sui messaggi delle clienti, e ora c'è un test che li rende
  obbligatori.** Completate le schermate che mancavano: chat con la coach, sostituzione
  ingrediente, lista della spesa, valutazione ricette, caricamento documenti, buono sconto,
  eventi in agenda, richiesta di sospensione, «i miei dati», tema. Erano tutte con i messaggi di
  default di class-validator, in inglese e col nome della colonna del database dentro.
  Qualche esempio di cosa cambia davvero:
  · caricando un'analisi in formato sbagliato, prima arrivava l'elenco dei mime-type
    (`mimeType must be one of the following values: application/pdf, image/jpeg…`); ora c'è
    scritto **cosa fare**: «Puoi caricare un PDF o una foto (JPG, PNG, HEIC). Se hai un altro
    formato, fanne uno scatto».
  · sostituendo un ingrediente, `ingredient must be longer than or equal to 2 characters`
    diventa «Scrivi il nome dell'ingrediente per esteso (almeno 2 lettere)».
  · un messaggio troppo lungo alla coach non è più `body must be shorter than or equal to 4000
    characters` ma «Il messaggio è troppo lungo: dividilo in due, si legge meglio».

- `[Sviluppo]` 🔒 **La regola ora è verificata, non ricordata** (`messaggi-clienti.spec.ts`).
  Il problema di fondo non era in un file: `class-validator` mette il messaggio in inglese **di
  default**, quindi un DTO nuovo nasce sbagliato senza che nessuno faccia niente di male, e ce ne
  accorgiamo solo quando ci sbatte contro una persona vera. È letteralmente quello che è
  successo oggi, due volte.
  Il test nuovo legge i **metadati dei decoratori** dei DTO che le clienti compilano e fallisce
  se trova un vincolo senza `message`. Non controlla il testo — quello resta un mestiere umano —
  ma garantisce che ce ne sia uno. Quando fallisce dice anche cosa scrivere: *cosa fare*, non
  cosa è sbagliato.
  Il limite è dichiarato nel test stesso: **non c'è modo di scoprire da soli quali DTO siano
  client-facing**, quindi la lista si allunga a mano quando nasce una schermata. È comunque
  meglio di una convenzione che nessuno può far rispettare: chi aggiunge un DTO a quella lista
  lo protegge per sempre.
  Test: +10 (58 suite, 611 test).

- `[Sviluppo]` 🔎 **Lo stesso difetto era vivo in altri due posti, e uno era la REGISTRAZIONE.**
  Sistemata la segnalazione di Daniela, ho passato in rassegna tutti i DTO che una **cliente**
  compila (non quelli del backoffice: lì il messaggio in inglese è brutto ma lo legge
  un'operatrice). Il difetto non era in un file, era in un **modo di scrivere i DTO** — campo
  numerico facoltativo + `@Min` + casella vuota che arriva come `0` — e si ripete ogni volta che
  se ne aggiunge uno. Trovato ancora aperto in due punti:
  · **`startWaistCm` e `startHipsCm` del questionario di registrazione.** Chi non si è mai
    misurata li lascia in bianco, e il questionario si rifiutava di partire con
    «startWaistCm must not be less than 40». È il punto peggiore in cui potesse capitare: al
    primo contatto col prodotto un errore incomprensibile non fa perdere una funzione, fa
    perdere la persona. Non so quante si siano fermate lì.
  · **`weightToLoseKg`, `weeks` e `waistToLoseCm` della modifica obiettivo**: svuotare una
    casella per cambiarne un'altra faceva fallire il salvataggio.
  La regola ora sta in un posto solo (`common/validazione.ts`), con **due varianti**, perché la
  differenza conta: sulle circonferenze lo zero è un campo vuoto, ma su «quanti cm di girovita
  voglio perdere» **0 è una risposta** — vuol dire «quella misura non me la pongo». Confonderle
  avrebbe cancellato in silenzio la scelta di una cliente.

- `[Sviluppo]` 🇮🇹 **Messaggi di errore in italiano dove li legge una persona.** Nella stessa
  passata: registrazione, obiettivo, check-in giornaliero, acqua, passi, cambio password, primo
  accesso, cancellazione account e login. Erano tutti quelli di default di class-validator, col
  nome del campo del database dentro — «newPassword must be longer than or equal to 8
  characters» a chi sta cercando di entrare per la prima volta.
  Dove serviva ho scritto **cosa fare**, non cosa è sbagliato: «I passi vanno indicati con un
  numero intero, senza punti (es. 10000)» invece di «steps must be an integer number», che è il
  messaggio che riceve chi scrive «10.000» — cioè chiunque.
  I limiti **non** sono stati allargati: 5 cm di girovita resta rifiutato, il peso resta
  obbligatorio. Tollerare lo zero non vuol dire tollerare tutto.
  Test: +16 (57 suite, 601 test).
  ⚠️ Resta una lacuna nota, e vale la pena scriverla: **non c'è un `exceptionFactory`** nella
  `ValidationPipe`, quindi ogni DTO nuovo nasce con i messaggi in inglese e nessuno se ne accorge
  finché non ci sbatte contro qualcuno. Le parti più esposte sono coperte; il resto (chat,
  documenti, buoni sconto, eventi) è elencato e ordinato per probabilità, da fare quando c'è
  tempo.

- `[Sviluppo]` 🩺 **«Salva correzione» non salvava: la colpa era di una casella VUOTA.**
  Segnalato da una cliente il 7/8, con lo screenshot: correggeva peso e vita, lasciava vuoti i
  **fianchi** perché non li aveva mai misurati, e sotto il pulsante compariva
  `hipsCm must not be less than 40` — in inglese e col nome del campo del database. Da fuori
  sembrava semplicemente un pulsante rotto.
  **La causa è una riga:** `Number('')` fa **0**, e zero è un numero valido a tutti gli effetti.
  La casella vuota partiva quindi come `hipsCm: 0`, il backend la rifiutava — giustamente, 0 cm
  non è una misura — e le rimandava indietro il messaggio di default del validatore.
  La beffa: la **stessa funzione**, nel popup delle misure, aveva il controllo `> 0` e infatti lì
  funzionava. Due copie della stessa lettura, una giusta e una no; la pagina Obiettivo aveva
  quella sbagliata. È il terzo caso in due giorni di logica copiata che diverge, e come gli altri
  si è chiuso unendola: `app/src/lib/misure.ts`, una sola `parseMisura()` usata da entrambe.

- `[Sviluppo]` 🛡️ **Corretto anche il BACKEND, e non è ridondanza: è quello che sistema le
  clienti di oggi.** Idea di Simone — «invece di mandare l'OTA, forziamo lo zero a null lato
  server». Giusta per due ragioni diverse:
  · la correzione lato app arriva solo con una **pubblicazione sugli store** (gli OTA sono spenti
    dal 6/8): fino ad allora, chi ha l'app installata resterebbe bloccato. Il deploy del backend
    invece è immediato e le sistema tutte, qualunque versione abbiano;
  · e comunque **nessun client va creduto sulla parola**. Che l'app non mandi più zeri è una
    promessa dell'app, non una garanzia del server.
  Ora vita, fianchi e cosce passano da un `@Transform`: `0`, `''`, `null` e i negativi diventano
  «campo non compilato». Si può fare senza ambiguità perché una circonferenza di 0 cm non esiste.
  Il **peso resta fuori**: è obbligatorio, e uno zero lì è un errore da segnalare, non una casella
  lasciata in bianco. Un valore assurdo (5 cm) viene ancora rifiutato — tollerare lo zero non
  vuol dire tollerare tutto.
  Nella stessa passata, i **messaggi di validazione delle misure sono in italiano**: quel testo lo
  legge la cliente, e «hipsCm must not be less than 40» non dice cosa fare e sembra un guasto.
  E l'**audit della correzione** ora registra i valori davvero scritti invece di quelli richiesti:
  un campo non compilato arriva come `undefined` e Prisma lo interpreta come «non toccare», quindi
  il vecchio valore resta — scriverci `null` significava annotare una modifica mai avvenuta,
  proprio nel registro che si va a leggere quando qualcosa non torna.
  Test: +10 sul DTO (56 suite, 585 test).
  ⚠️ Nota sul perimetro: l'**app non ha un test runner** (backend e backoffice sì). La `parseMisura`
  è quindi coperta solo dal lato backend, che è il punto dove la richiesta entra davvero — ma è
  una lacuna, ed è il motivo per cui un difetto così banale è arrivato a una cliente.

- `[Sviluppo]` 👀 **Il backfill delle diete ha mostrato una cosa che non sapevamo:
  `npm run diag:famiglie`.** L'anteprima di `fix:diet-family` su 30 profili non ha trovato
  nessun ripiego su uno stile sbagliato — bene — ma ha reso visibile il difetto vero, quello per
  cui era nato tutto il lavoro sulle famiglie:
  · **5 clienti** che avevano chiesto `mediterranean` stanno ricevendo **Pescetariana**, cioè
    menu **senza carne**. Non l'ha chiesto nessuna di loro e non gliel'ha proposto nessuno: con
    quello stile ci sono anche Mediterranea e Mediterranea ipocalorica, e il motore prendeva la
    più recente ad essere approvata;
  · **10 clienti** su `flexible` ricevono **Flexitariana**, una **Vegana**, per lo stesso
    meccanismo;
  · le altre sono univoche e vanno bene (keto, proteica, keto-mediterranea, low carb).
  **Fissarle comunque è la scelta giusta**, ed è quella presa: quelle clienti ricevono
  Pescetariana oggi e continuerebbero a riceverla comunque, perché il motore sceglie sempre la
  stessa. Fissarla non cambia niente per loro — la rende *visibile* e correggibile dalla scheda,
  invece che frutto di un ordinamento per data.
  Ma «visibile» serve solo se qualcuno la guarda, quindi il nuovo script elenca **solo i casi
  ambigui** (stile con più di una famiglia approvata e visibile), con nome, email, cosa riceve
  oggi e le **alternative** accanto. Chi ha uno stile con una famiglia sola non compare: non
  c'era niente da scegliere. Non tocca niente; si corregge dalla scheda cliente, e al ciclo di
  menu successivo l'abbinamento riparte dal prodotto giusto.

- `[Sviluppo]` 📌 **`STATO.md`: «Vacanze in Serenità» risulta già creata in produzione.** La voce
  dei piani stagionali diceva «manca creare i due prodotti dal backoffice»: nell'elenco del
  backfill compare una cliente reale (stile `summer_holiday`) che sta ricevendo proprio
  **«Vacanze in Serenità»**, quindi la dieta esiste, è approvata ed è visibile. Da non
  confondere con «Vacanza estiva», che è il nome del prodotto **di esempio** creato dal seed.
  Di «Ritorno in Equilibrio» non ho evidenza — nessuna cliente su `summer_return` — quindi
  quella metà resta aperta.

- `[Prodotto]` 💶 **Provvigioni del Monitoraggio compilate in Negozio: 25% totale** (deciso da
  Simone il 7/8, «ridotta, 25 totale, proporzionata come le altre»). Scritte a mano nel
  backoffice di produzione, dopo aver **letto** le percentuali vere invece di fidarsi del
  commento nel codice: i percorsi 1/3/6 mesi hanno Coach 25 · Coord. 10 · Mgr 10 · Nutriz. 10 ·
  Capo n. 5 (a differenza), cioè catena coach al **45%**.
  Portare il totale a 25 tenendo le stesse proporzioni dà **Coach 14 · Coordinatrice 19 ·
  Manager 25** (i valori sono cumulativi per livello; a schermo diventano 14% + 5% + 6%),
  nutrizionista e capo nutrizionista a **zero** come sul mantenimento. Su €19 al mese: €2,66
  alla coach, €4,75 all'intera catena, €14,25 + IVA a Metabole prima di Stripe.
  Verificato nella stessa occasione, **senza toccare niente**: il **Mantenimento** era già a
  posto (€49, «A scelta», Coach 25 · Coord. 10 · Mgr 10, nessun nutrizionista) e il **«Menu di
  rientro (8 giorni)»** risulta **Nascosto**, cioè il seed lo ha ritirato davvero al deploy.
  Il perché di quel 25 resta scritto altrove ed è la parte che conta: il monitoraggio è un
  prodotto che dura anni e chiede pochissimo lavoro ricorrente — con la quota piena la rete si
  sarebbe portata via quasi metà di €19.

- `[Sviluppo]` 🗺️ **`STATO_LANCIO.md` rimesso in pari: due righe dicevano il falso.** È la pagina
  che si guarda per sapere «cosa manca per aprire», ed era ferma al 16 luglio.
  · «**Build/test in pipeline (CI)**» risultava ⬜: la CI esiste dal 6/8, compila i tre pacchetti
    e lancia i test, e da quel giorno **senza `continue-on-error`** — un rosso blocca davvero.
    Verificato leggendo `.github/workflows/ci.yml`, non a memoria.
  · «**Rimuovere `_to_delete/schema_1.prisma`**» risultava ⬜ mentre **due righe più su**, nella
    lista delle cose fatte, c'era già «schema_1.prisma rimosso ✅». Aveva ragione la seconda:
    `git ls-files` conferma che non è più tracciato.
  Una pagina di stato che riporta come da fare cose fatte è peggio di una pagina assente: si
  smette di crederle, e allora smette di servire.
  Aggiunta una sezione nuova — **«Abbonamenti ricorrenti: cosa manca per venderne uno»** — che
  separa quello che è chiuso (codice, app, backoffice, configurazione Stripe) da quello che
  resta, cioè **dati**: prezzi e provvigioni dei due piani in Negozio, la verifica con
  `diag:ricorrente`, e il primo addebito ricorrente vero con carta vera. Le provvigioni nascono
  a zero per tutti i ruoli, ed è la cosa che nessuno dei due sistemi segnala da solo: il primo
  rinnovo semplicemente non paga la coach.

- `[Sviluppo]` 🧭 **`npm run diag:ricorrente` — «si può davvero vendere un abbonamento oggi?»**
  Il codice del ricorrente è scritto e testato, ma nessun test può rispondere a quella domanda:
  dipende da **dati** in produzione e da **configurazione**, non da logica. E tutti i modi di
  essere «quasi pronti» sono silenziosi, che è il motivo per cui vale la pena di uno script:
  · il piano esiste ma è rimasto `one_time` → la cliente paga **una volta sola** e non se ne
    accorge nessuno: la schermata dice che è andato tutto bene, e infatti è andato tutto bene —
    solo che il mese dopo non arriva niente;
  · il piano è in abbonamento ma con prezzo **zero** → Stripe rifiuta la sessione e la cliente
    vede un errore generico;
  · le **provvigioni sono a zero per tutti i ruoli**, che è come i piani nascono dal seed: al
    primo rinnovo la coach non prende niente, e se ne accorge lei prima di noi;
  · al piano del monitoraggio è stato cambiato il `period` → torna visibile a chiunque.
  Lo script guarda i dati veri, non tocca niente, e distingue i **problemi** (esce 1) dalle cose
  **da sapere** (piano disattivato di proposito, abbonamenti a mese singolo senza id Stripe:
  giusto che non si rinnovino).
  Quello che **non** può controllare lo dice: eventi della webhook e portale clienti si leggono
  solo dal pannello Stripe, e sono annotati in `STATO.md`.

- `[Sviluppo]` ⚙️ **Stripe configurato: la webhook ora ascolta 5 eventi e il portale clienti
  esiste.** Fatto direttamente nel pannello (Simone ha aperto Stripe e ha dato il via libera).
  · **Webhook** `metabole-backend.onrender.com/api/v1/payments/webhook`: da **1 evento a 5** —
    `checkout.session.completed` (c'era), più `invoice.paid`, `invoice.payment_failed`,
    `customer.subscription.deleted`, `customer.subscription.updated`. Senza questi, tutto il
    codice del ricorrente scritto ieri non avrebbe ricevuto niente da elaborare.
  · **Portale clienti**: prima non esisteva nessuna configurazione, quindi «Aggiorna la carta»
    dal profilo avrebbe risposto errore alla prima cliente che ci provava. Ora c'è la
    configurazione predefinita (`bpc_1U1hiG…`), con aggiornamento dei metodi di pagamento attivo
    e **annullamento a fine periodo di fatturazione** — la stessa regola nostra, non
    l'annullamento immediato.
  · **Nuovo gestore `customer.subscription.updated`**: è il quinto evento, e serve per una porta
    sola. La disdetta si fa dall'app, ma il portale Stripe ha *anche lui* il pulsante «Annulla
    abbonamento». Se una cliente entra per aggiornare la carta e disdice da lì, Stripe imposta
    `cancel_at_period_end` e noi non lo sapremmo: il profilo avrebbe continuato a dire «si
    rinnova il 5 settembre» per un mese intero, su un abbonamento che non si sarebbe rinnovato.
    Il finale sarebbe stato comunque corretto — `customer.subscription.deleted` arriva a
    scadenza — ma per un mese l'app avrebbe detto una cosa falsa alla cliente. Ora quel flag si
    allinea, e solo quello: le altre modifiche (prezzo, piano, stato) restano fuori di proposito,
    perché indovinare cosa farne significherebbe scriverlo su dati di pagamento.

- `[Sviluppo]` 🔍 **Correzione onesta alla voce di ieri sul campo `invoice.subscription`.**
  Aprendo il pannello ho visto una cosa che ieri non sapevo: l'endpoint webhook è **fissato
  all'API `2024-04-10`**, non alla versione dell'SDK. Stripe consegna gli eventi con la versione
  dell'**endpoint**, quindi la fattura sarebbe arrivata nella forma vecchia — con
  `invoice.subscription` presente — e il codice di ieri, così com'era, avrebbe funzionato.
  Quindi: il difetto era reale ma **condizionale**, non certo. Diventava certo nel momento in cui
  qualcuno avesse aggiornato la versione API dell'endpoint (una riga in un menu a tendina) o
  creato un endpoint nuovo, che nasce sulla versione corrente dell'account. La correzione — che
  legge entrambe le forme — resta giusta e anzi ora si sa perché: l'unica versione che conta è
  quella dell'endpoint, e non è quella dell'SDK con cui scriviamo il codice. Ma la voce di ieri
  diceva «ogni rinnovo sarebbe stato perso», e non era esatto: sarebbe stato perso **dopo** un
  cambio di versione fatto senza pensarci.

- `[Sviluppo]` 💣 **Il rinnovo non sarebbe MAI stato registrato — e i soldi arrivavano lo stesso.**
  Trovato rileggendo il ricorrente prima che toccasse un pagamento vero. È il difetto peggiore
  scritto finora, non per quanto è complicato ma per come si sarebbe manifestato: **da nessuna
  parte**.
  Nell'SDK Stripe 22 che abbiamo installato l'API predefinita è `2026-06-24.dahlia`, e da quella
  versione la fattura **non ha più** il campo `invoice.subscription`: l'abbonamento sta in
  `invoice.parent.subscription_details.subscription`. `handleInvoicePaid` leggeva solo il campo
  vecchio, quindi ogni `invoice.paid` di rinnovo usciva alla seconda riga con «fattura non legata
  a un abbonamento».
  Il risultato al primo rinnovo vero: Stripe incassa i €49, la webhook risponde 200, e da noi non
  nasce **niente** — nessun pagamento a database, nessuna provvigione alla coach, nessuna
  ricevuta alla cliente. E soprattutto la **scadenza dell'abbonamento non si sposta**: la cliente
  che paga regolarmente si sarebbe vista scadere il percorso. Un incasso mensile invisibile su
  entrambi i lati del libro.
  Ora si leggono **entrambe le forme**, con la nuova che ha la precedenza: la versione API con
  cui Stripe consegna gli eventi dipende dall'**account** (e da come è configurato l'endpoint),
  non dall'SDK — un account ancora su una versione precedente continua a mandare la forma
  vecchia, e sbagliare al contrario sarebbe stato lo stesso guaio speculare. Stessa correzione su
  `invoice.payment_failed`, e `checkout.session.completed` ora accetta l'abbonamento sia come id
  sia come oggetto espanso.
  Test: +7 in un file dedicato (55 suite, 575 test).
  ⚠️ **Da fare in Stripe prima del primo abbonamento vero** (non è codice, è configurazione):
  l'endpoint webhook oggi è iscritto al solo `checkout.session.completed` — quello che serviva
  per gli acquisti una-tantum. Vanno aggiunti **`invoice.paid`**,
  **`invoice.payment_failed`** e **`customer.subscription.deleted`**: senza, il codice qui sopra
  non riceve niente da elaborare e siamo daccapo. Va anche attivato il **Customer Portal**
  (Impostazioni → Fatturazione → Portale clienti), altrimenti «Aggiorna la carta» dal profilo
  risponde errore.

- `[Sviluppo]` 🏖️ **La modalità viaggio ora la legge anche l'agente dieta — e scade.** Era
  l'ultima cosa aperta dei piani estate (`STATO.md`: «`DietAgentService` non legge
  `travelState`»). Lo stato c'era, con date e stati `in_partenza / in_vacanza / rientrato`, ma
  serviva solo a sospendere il popup misure: il motore continuava a scegliere i menu come se la
  cliente fosse a casa.
  Ora:
  · **in vacanza** → nuovo stato `vacanza`, che **vince su tutto**, plateau compreso. Spingere
    l'efficacia addosso a chi è al mare non produce chili persi, produce menu ignorati. È il
    senso di *Vacanze in Serenità*: si tiene il peso, non si cerca il calo. Nei pesi si comporta
    come il conforto (menu più amati), ma resta uno **stato separato** perché nei log e nelle
    diagnosi «in vacanza» e «giornata storta» non vanno confusi.
  · **in partenza** → `pre_evento`: una partenza è un evento a tutti gli effetti, e riusa i pesi
    già tarati (più proteico) invece di inventarne di nuovi.
  · **rientrata** → `post_evento` per `agent_return_days` giorni (7 di default), che è
    *Ritorno in Equilibrio*.

- `[Sviluppo]` ⏳ **Il bug che ho trovato mentre lo collegavo: «in vacanza» non finiva mai.**
  `travelState` lo scrive un'operatrice dalla scheda cliente e **non lo azzera nessuno** — non
  c'è un lavoro notturno che lo pulisca, e non c'è motivo per cui una coach debba ricordarsene.
  Il codice leggeva il campo grezzo, quindi un «in vacanza» di luglio valeva ancora a novembre.
  Non è un dettaglio estetico: quello stato **sospende il popup misure**, cioè la regola più
  severa che abbiamo (senza pesata, il giorno dopo l'app si blocca). Una vacanza dimenticata la
  spegneva **per sempre** su quella cliente, senza un errore e senza un avviso — e dal di fuori
  sembrava semplicemente che il gate non funzionasse.
  Ora lo stato ha una scadenza (`stato-viaggio.ts`), e le date che l'operatrice inserisce servono
  a qualcosa: con la **data di fine** vale fino a quel giorno compreso; con la sola **partenza**
  vale `travel_max_days` giorni (30 di default, solo come rete di sicurezza per i casi
  dimenticati); **senza nessuna data** vale come prima — inventare una scadenza dal nulla
  spegnerebbe vacanze vere senza che nessuno capisca perché.
  Il **rientro** non passa di lì, perché non è un periodo ma un istante: la sua durata si conta
  dall'evento `travel_return`, che nasce nel momento esatto in cui l'operatrice segna il rientro
  e quindi ha una data vera. Il campo sul profilo, invece, resta scritto per sempre — ed è
  esattamente il motivo per cui non ci si può basare.
  Due parametri nuovi da backoffice: `agent_return_days` (7) e `travel_max_days` (30).
  Test: +14 (54 suite, 569 test).

- `[Sviluppo]` 🩹 **Clienti già registrate: si fissa la dieta che ricevono già** (`npm run
  fix:diet-family`). Domanda di Simone appena finito il lavoro sulle famiglie: «per i clienti
  esistenti cosa facciamo?». Lasciare il campo vuoto **non era neutro**: `pickDiet` ordina per
  `approvedAt desc`, quindi il giorno in cui il nutrizionista approva una dieta nuova con lo
  stesso stile+regime+obiettivo+pasti, quella diventa la vincitrice e la cliente **cambia dieta
  da sola**, senza che nessuno l'abbia deciso. Con 18 diete su pochi codici stile non è un caso
  di scuola: è quello che sarebbe successo alla prossima pubblicazione.
  Non c'è niente da indovinare, perché la dieta vera è scritta: lo script legge l'**ultimo menu
  erogato** (`menu_day.diet_id`) e, se i menu non sono ancora partiti, il **pool ricette**
  personalizzato. Fissa quella famiglia sul profilo — quindi **oggi non cambia nulla per
  nessuna**, e da domani il catalogo può crescere senza spostare le clienti già avviate.
  Due categorie restano fuori, ed è voluto: chi non ha mai ricevuto un menu (nessuna dieta
  "sua" da fissare: resta vuota e continua ad abbinarsi per stile) e chi sta ricevendo una dieta
  di uno **stile diverso** da quello scelto. Quest'ultima lista è preziosa: è il ripiego di
  `pickDiet` quando per lo stile richiesto non esiste una variante approvata — fissarla
  renderebbe permanente un ripiego, mentre quello che serve è **pubblicare la variante
  mancante**. Lo script la stampa a parte, come elenco dei buchi di catalogo da colmare.
  Anteprima di default, scrive solo con `CONFERMA=1`, come `fix:assegnazioni`.

- `[Sviluppo]` 🥗 **In registrazione una card per PRODOTTO, non più una per stile.** È la
  segnalazione di Simone del 6/8: il backoffice mostrava 18 diete, l'app 8. La metà cosmetica
  (il nome vero al posto del codice stile) era già sistemata; questa è la parte strutturale.
  **Il problema non era la vetrina, era l'abbinamento.** La registrazione salvava solo lo
  *stile*, e lo stile non identifica un prodotto: Vegana, Vegetariana, Flexitariana e Flessibile
  hanno tutte `style = flexible`; Mediterranea, Mediterranea ipocalorica e Pescetariana sono
  tutte `mediterranean`. Per questo l'elenco le schiacciava in una voce sola — e togliere il
  raggruppamento senza toccare il motore avrebbe peggiorato le cose: la cliente ne sceglieva una
  e poteva ricevere l'altra, in silenzio.
  Ora sul profilo c'è la **famiglia** (`dietFamily`, cioè `Diet.name`): con lo stile identifica
  il prodotto, ed è la stessa chiave nome+stile che il catalogo del sito usa già. Le varianti
  interne (regime × obiettivo × pasti × digiuno) restano dettagli del motore e si fondono in una
  card sola, tenendo i campi compilati migliori fra le varianti.
  **Nessuna cliente esistente cambia comportamento**: il campo è nullo su chi si è registrata
  prima di oggi e opzionale nel DTO, così anche le app già installate — che mandano solo lo
  stile — continuano a funzionare come sempre.
  Il filtro famiglia è **sempre combinato con lo stile**, e la cosa non è un dettaglio: se un
  nutrizionista corregge lo stile dal backoffice, la vecchia famiglia non trova più niente e
  l'abbinamento scende da solo ai criteri di prima. Senza quel vincolo la correzione non avrebbe
  avuto alcun effetto, e nessuno se ne sarebbe accorto.
  Cambiare la famiglia da backoffice chiede lo stesso permesso di cambiare lo stile
  («Cambia tipo di dieta»), ed è tracciata nell'audit come gli altri due campi.

- `[Sviluppo]` ♻️ **`pickDiet` era scritto due volte, identico: ora è uno solo.** La scala dei
  ripieghi (famiglia → stile → obiettivo → regime → ultimo tentativo ignorando il piano pasti)
  viveva copiata riga per riga in `menu.service.ts` e in `personal-base.service.ts`. Due copie
  della stessa logica prima o poi divergono, e queste due decidono cose che devono coincidere:
  il **menu del giorno** e la **base personalizzata sicura**. Se una avesse iniziato a scegliere
  una dieta diversa dall'altra, il pool ricette approvato dal nutrizionista e i menu erogati si
  sarebbero riferiti a due prodotti diversi — senza errori, senza avvisi.
  Ora la logica sta in `src/catalog/pick-diet.ts`, in una funzione pura che riceve *come*
  interrogare il catalogo e restituisce la dieta: i due servizi la chiamano e basta. Con 10 test
  sull'**ordine** dei ripieghi, che è il punto: quando la famiglia c'è vince, quando manca o non
  trova niente si scende ai criteri di sempre e nessuna cliente resta senza menu.
  Test: +10 (53 suite, 555 test).

- `[Sviluppo]` 🛒 **Gli abbonamenti si possono finalmente comprare: negozio, carrello, profilo.**
  Il backend ricorrente era scritto stamattina ma dall'app non lo raggiungeva nessuno — nessuna
  schermata mandava la scelta. Ora c'è tutto il giro:
  · **Negozio** — sul mantenimento due caselle esplicite, *Abbonamento* (si rinnova da solo) o
    *Un mese solo* (nessun rinnovo), scelte **prima** di aggiungere al carrello; sul monitoraggio,
    che è solo abbonamento, la riga «rinnovo mensile, disdici quando vuoi» sotto il nome. Il
    default è l'abbonamento, ma scritto accanto: un addebito automatico attivato senza vederlo è
    la cosa che fa arrivare i rimborsi.
  · **Carrello** — le tre regole del ricorrente sono dette **prima** di premere paga, non dopo:
    il bonifico sparisce (con la ragione a fianco), il campo buono sconto non compare, e se ci
    sono integratori nel carrello un avviso rosso spiega perché vanno in un secondo ordine — se
    restassero, si pagherebbero ogni mese. Il totale dice «€49 / mese» e sotto cosa succede dopo.
  · **Profilo** — nuova scheda **Abbonamento**: quanto paghi, quando si rinnova, *Aggiorna la
    carta* (portale Stripe: i dati della carta non passano mai da noi) e *Disdici* con una
    conferma sola. Se l'ultimo addebito è fallito lo dice chiaramente **senza** far pensare a una
    disdetta: il piano resta attivo mentre Stripe riprova.
  · **Backoffice** — nel Negozio il campo **«Come si vende»** (pagamento unico / solo abbonamento
    / a scelta della cliente) con la colonna in tabella, più due avvisi: se si sposta il periodo
    `monitoring` e se si mette un abbonamento a €0 (Stripe non apre una sessione senza importo).

- `[Sviluppo]` 🐞 **Tre difetti della push di stamattina, trovati rileggendo il codice prima di
  costruirci sopra.** Nessuno dava errore: è il motivo per cui vale la pena rileggere.
  ① **Rotta doppia.** `GET /me/subscription` era registrato **due volte** — il vecchio (piano,
  date, primo menu) e il nuovo (abbonamento ricorrente). Nest tiene il primo e ignora il secondo
  senza dire niente: **Calendario, Profilo e il promemoria della data d'inizio** avrebbero
  ricevuto il payload sbagliato. Il ricorrente è passato su `/me/subscription/recurring`, e ora
  c'è un test (`rotte-uniche.spec.ts`) che legge i decoratori di **tutti** i controller del
  modulo e fallisce se due metodi finiscono sullo stesso percorso.
  ② **Il monitoraggio durava tre mesi invece di uno.** Il piano nasce col periodo `monitoring`,
  che `subscriptionEnd` non conosceva: cadeva nel fallback muto da 3 mesi. €19 pagati valevano un
  trimestre. Ed era anche **impossibile da salvare dal Negozio**, perché il validatore non
  ammetteva quella parola — identica alla trappola di `maintenance` di due mesi fa, che avevamo
  già documentato. Un periodo nuovo va aggiunto in **tre punti insieme**: validatore,
  `subscriptionEnd`, `isKnownPeriod`. Ora è scritto nel commento del DTO.
  ③ **Il monitoraggio era in vendita a chiunque.** Compariva nello shop e sulla landing accanto
  ai percorsi, a €19, anche a una lead appena registrata. È l'**ultimo** gradino
  (percorso → mantenimento → monitoraggio): ora è fuori dalla vetrina pubblica e visibile solo a
  chi il mantenimento l'ha davvero fatto — e la stessa regola è ripetuta **all'acquisto**, perché
  nascondere un piano non impedisce di comprarlo conoscendone l'id.
  Allineata anche la condizione «ha fatto il mantenimento»: prima bastava un abbonamento
  `pending`, cioè un ordine **non ancora pagato**. Ora servono `active` o `expired`, sia per il
  monitoraggio a pagamento sia per quello in omaggio.
  Test: +19 (52 suite, 546 test).

- `[Sviluppo]` 🔑 **"Invia credenziali" non manda più una password: manda un link.** Fino a stamattina
  il pulsante del lead generava una password provvisoria, la scriveva nel database e la spediva per
  email in chiaro. Due cose sbagliate insieme: la password restava leggibile nella casella di posta
  della cliente per sempre, e su un account **già esistente** la rotazione le buttava fuori — chi
  aveva già cambiato password e stava usando l'app si ritrovava scollegata senza aver fatto niente.
  Ora l'email contiene un **link di attivazione a scadenza** (`ActionToken` di tipo `password_reset`,
  in tabella solo l'hash SHA-256, mai il token): la cliente clicca, sceglie la sua password, il link
  muore. Durata regolabile dal backoffice — parametro `lead_credentials_link_days`, **7 giorni** di
  default; non è una costante nel codice, si cambia da Parametri senza deploy.
  La differenza che conta è sugli account già attivi: **la password non viene toccata e le sessioni
  non vengono revocate**. Se la coach ripreme il pulsante per sbaglio su una cliente che sta usando
  l'app, non succede niente di male — riceve un link che può ignorare. Sugli account nuovi la
  password nasce come hash casuale che **nessuno conosce**, nemmeno noi: l'unico modo di entrare è
  il link. Il segnaposto `{password}` resta nei modelli email per non rompere i testi già scritti,
  ma arriva vuoto; la copia IT/EN è stata riscritta attorno al link.
  File: `crm.service.ts`, `mail.service.ts`, `i18n/messages.ts`, `prisma/seed.ts`.

- `[Sviluppo]` 🧪 **Test rossi per un provider dimenticato — la stessa trappola di ieri, seconda volta.**
  Aggiungendo `ConfigParamsService` al costruttore di `CrmService` ho scordato di registrarlo nel
  modulo di test: 13 test non fallivano su un'asserzione, **non partivano proprio** (`Nest can't
  resolve dependencies of the CrmService … argument ConfigParamsService at index [5]`). Risolto con
  il mock accanto agli altri in `finance-crm.spec.ts`. Vale la pena fissarlo come abitudine: **ogni
  volta che si aggiunge un parametro al costruttore di un service, va aggiunto anche a ogni
  `createTestingModule` che lo istanzia** — `tsc` non se ne accorge, perché il costruttore è
  formalmente corretto ed è Nest a rompersi a runtime.

- `[Sviluppo]` 💳 **Stripe ricorrente: il backend è scritto.** È la voce #10, ferma da settimane su
  una decisione e non su del codice. Ora il mantenimento si vende **in abbonamento o a mese
  singolo** e il monitoraggio **solo in abbonamento**; i percorsi 1/3/6 mesi restano una-tantum e
  non cambiano di una riga.
  Le parti che contano, in ordine di quanto possono fare danno:
  · **Il primo addebito NON si conta due volte.** Stripe manda una fattura anche al primo mese, e
    quella la ignoriamo: è lo stesso incasso già gestito dal checkout. Contarla avrebbe prodotto
    due pagamenti, due provvigioni e due ricevute per un solo addebito. Si riconosce da
    `billing_reason`, non dall'importo o dalla data — che coincidono.
  · **Carta rifiutata ≠ disdetta.** Durante i tentativi di Stripe l'abbonamento resta **attivo** e
    i menu continuano: una carta scaduta non è un addio, e togliere il servizio a chi ha solo
    cambiato bancomat è il modo peggiore di farselo diventare. Si avvisa e basta; è Stripe a
    chiudere quando i tentativi finiscono davvero.
  · **Disdetta dall'app, in autonomia**, valida a fine periodo già pagato e **reversibile** finché
    quel periodo non finisce. La carta si aggiorna dal portale di Stripe: i dati della carta non
    passano mai da noi.
  · Idempotenza ovunque, perché Stripe **riconsegna** i webhook: l'id della fattura fa da chiave,
    e un rinnovo contato due volte è denaro.
  Migrazione `20260807090000_abbonamenti_ricorrenti`. Il campo `plan.billing` è una colonna e non
  due booleani: i tre casi sono mutuamente esclusivi, e con due flag esisterebbe la combinazione
  «né l'uno né l'altro» — che non vuol dire niente e prima o poi qualcuno la salva.
  ⚠️ Il client Prisma va rigenerato **dal Terminale del Mac** (`npx prisma generate`): il VM del
  ponte non ha rete e la sandbox non scarica i binari Prisma (403). Senza, `tsc` gira contro lo
  schema vecchio e fallisce su ogni campo nuovo.

- `[Prodotto]` **Il «Menu di rientro (8 giorni)» a €29 non si vende più: i menu sono INCLUSI**
  (decisione Simone, 7/8). Era il kit che Gaia proponeva quando la cliente riprendeva peso durante
  il monitoraggio: 8 giornate scelte sul suo storico, a pagamento. La logica commerciale non regge
  alla prova dei fatti — chi ha appena ripreso tre chili è la meno disposta a tirare fuori la
  carta, ed è il momento in cui ha più bisogno di una mano.
  Ora i menu si erogano e basta: nel monitoraggio omaggio perché il percorso è già stato pagato,
  in quello a €19/mese perché lo si sta pagando. **Con loro sparisce il CONGELAMENTO** di chi non
  comprava entro la finestra: non c'è più un acquisto da rifiutare, quindi non c'è più nessuno da
  mettere in pausa per non aver speso €29.
  Il piano viene **disattivato, non cancellato**: chi l'ha comprato ha un abbonamento che punta a
  quella riga, e cancellarla porterebbe via la sua storia (oltre a fallire per il vincolo
  `onDelete: Restrict`).
  **Aggiunto quello che mancava:** al **rientro da una sospensione**, se il peso è salito oltre la
  soglia, i menu di rientro arrivano da soli — inclusi. Il modulo pausa dichiarava espressamente
  di non fare proposte commerciali e i menu vivevano solo nell'altro monitoraggio, quindi chi
  tornava da una vacanza non riceveva niente. Si erogano **a fine pausa**, non durante: durante
  una pausa i menu sono sospesi per definizione, e mandarglieli mentre è in vacanza sarebbe il
  contrario del punto di avere una pausa.

- `[Prodotto]` **Il monitoraggio omaggio ora propone quello in abbonamento** (richiesta Simone,
  7/8), e lo fa con l'impianto che c'era già invece di un meccanismo nuovo: due inneschi nel
  **ciclo di vita** (`mon_t8` e `mon_fine`), accendibili e spegnibili dal backoffice come tutti
  gli altri, deduplicati per periodo, con i due modelli email scritti nella voce di casa.
  L'ordine conta: la prima email parte **a -8 giorni, mentre il servizio è ancora attivo** e la
  cliente ne vede il valore; la seconda l'ultimo giorno. Non si insiste oltre — chi non risponde a
  due email non risponde alla terza, e il win-back esiste già. Non si scrive a chi ha già un piano
  attivo: sarebbe vendere una cosa che ha già. Il prezzo nell'email arriva dal **Negozio**, non è
  scritto nel testo: se domani il monitoraggio costa altro, il messaggio si aggiorna da solo
  invece di mentire.

- `[Sviluppo]` **Tre volte il compilatore ha fermato un errore mio**, ed è la ragione per cui vale
  la pena averlo. Il nome `seedMonitoringPlan` era **già occupato** dal «Menu di rientro» — cioè
  dal monitoraggio gratuito: esattamente l'ambiguità fra i due monitoraggi che avevo scritto nella
  nota di listino la sera prima, e mi ha preso in castagna dopo dieci minuti. Poi
  `MonitoringPeriod` **non ha una relazione** verso l'utente (`clientId` è una stringa, il modulo
  è FK-less di proposito), quindi l'`include` che avevo scritto non poteva funzionare. E un tipo
  di ritorno rimasto indietro. `tsc --noEmit` pulito su backend e app, **527 test verdi**.

- `[Sviluppo]` **Verificata la CI dopo averla resa bloccante — e la prima rossa non era nostra.**
  Avendo tolto `continue-on-error` poche ore prima, valeva la pena guardare che i push della notte
  passassero davvero, invece di scoprirlo domani. Uno era rosso: la run **#321** (`bb3d8ed`, il
  push dei test a zero). Non un test: tutti e tre i job — backend, backoffice, app — falliti dopo
  **45 minuti** con *«The job was not acquired by Runner of type hosted even after multiple
  attempts»* e un *Internal server error*. GitHub non riusciva ad assegnare i runner. La run
  successiva è passata in **1m10s**, e quella dei filtri ricette in **58s**: catena sana.
  Vale la pena averlo scritto, perché è il primo effetto collaterale della CI bloccante: **blocca
  anche quando il guasto non è nostro**. Si riconosce da durate assurde e da un errore che parla
  di *Runner* invece che di test, e si risolve con `Re-run jobs` — non rimettendo
  `continue-on-error`, che sarebbe spegnere la rete di sicurezza per un singhiozzo altrui.

- `[Sviluppo]` 🎉 **iOS 2.1 APPROVATA.** Con Android approvata ieri, la 2.1 è pubblicata su
  entrambi gli store. È la versione con le push iOS che funzionano davvero — verificate su
  TestFlight prima dell'invio, dopo l'indagine a cinque anelli del 6/8.
  ⚠️ Promemoria per la prossima build: il numero deve essere **≥ 8**, il 7 è già caricato.

- `[Sviluppo]` **I filtri del catalogo ricette girano sul DATABASE, non su una fetta.** Emerso
  dallo screenshot di Simone del 6/8: il banner di troncamento compariva con il **solo regime
  vegetariano**, cioè quelle ricette avevano già superato le 1000 — il tetto alzato quella
  mattina da 200. Conseguenza: i filtri di colonna cercavano dentro le prime 1000 righe
  scaricate, e una ricetta che c'è ma non compare è **peggio di un errore**, perché chi cerca
  conclude che non esiste e la ricrea. Con il nutrizionista che sta facendo manutenzione alle
  ricette proprio in queste ore, era il momento giusto per toglierlo di mezzo.
  `GET /recipes` ora accetta `difficulty`, `season`, `stato`, `kcalMin`, `kcalMax` oltre a quelli
  che aveva già, e risponde **`{ items, total, troncato }`**: `total` è il conteggio vero sul
  database, quindi la pagina può dire «ne ho trovate 1.240, qui vedi le prime 1000» invece di far
  credere che il catalogo sia grande quanto quello che si vede. La pagina interroga il server a
  ogni cambio di filtro, con 300 ms di pausa perché scrivere un nome non generi una richiesta per
  lettera.
  **Un filtro resta onestamente fuori: il TAG.** È una ricerca per sottostringa dentro un array
  Postgres, che Prisma non sa esprimere, e continua a lavorare sulle righe ricevute. Quando il
  risultato è troncato **il banner lo dice esplicitamente** e suggerisce di restringere prima con
  un altro filtro: preferisco un limite dichiarato a un filtro che sembra funzionare.
  Alzare ancora il tetto sarebbe stato il rattoppo che si ripresenta: era già passato da 200 a
  1000 in un giorno.
  `tsc --noEmit` pulito su backend e backoffice, 527 test verdi.

## 2026-08-06

- `[Sviluppo]` **Ripuliti quattro documenti che dicevano il falso** (secondo giro della giornata:
  il primo era di stamattina, e nel frattempo mezza giornata di lavoro li ha resi vecchi di nuovo).
  · `STATO.md`: Stripe LIVE dato 🔶 «manca il pagamento di prova», fatto il 16/7; **OTA dati
  ancora attivi** quando sono spenti dal pomeriggio; un follow-up di sicurezza sugli endpoint
  `/engine/decisions/:id/confirm|correct` dato aperto quando lo scoping per paziente c'è per ogni
  via (`engine.service.ts:221-238`); «porta un'amica ancora da fare» quando è in Home da stamattina;
  Keto-Mediterranea «da generare» quando l'ha generata il nutrizionista.
  · `Metabole_Checklist_GoLive.md`: il semaforo in fondo dava ancora le **4 conferme 🔴** mentre la
  sezione sopra, nello stesso file, le dà chiuse dal 16/7. Una checklist che si contraddice da sola
  è peggio di nessuna checklist.
  · `NOTA_Handoff_Pubblicazione_2026-08-06.md`: quattro punti superati in giornata (#10 sbloccata,
  OTA già svuotata, Keto generata, `continue-on-error` tolto).
  · `progetto/Audit_Lavori_2026-08-06.md`: intestato come **superato nella stessa giornata**, con
  l'elenco di cosa è caduto. Dentro c'è anche l'ammissione di **due segnalazioni sbagliate**:
  certificazione di unicità e Giudice/Publisher erano dati come «mai iniziati» ed esistono
  entrambi. È lo stesso errore che l'audit del 5/8 aveva fatto tre volte su otto, ed è la ragione
  per cui vale la pena scriverlo invece di correggerlo in silenzio: **un audit che grida al lupo
  si smette di leggere**, e allora tanto vale non farlo.

- `[Prodotto]` 💶 **Listino di mantenimento e monitoraggio fissato** (Simone, 6/8 sera). Non è un
  ritocco di prezzo: definisce cosa deve fare il codice del ricorrente, che parte domattina.
  Il percorso della cliente dopo il peso raggiunto: **mantenimento per quanti mesi vuole**, poi
  **monitoraggio anche per sempre**. Nessuno dei due ha una scadenza imposta.
  · **Mantenimento €49/mese**, in abbonamento **oppure a mese singolo** — entrambe le modalità.
  · **Monitoraggio €19/mese**, solo in abbonamento.
  ⚠️ **Il monitoraggio a pagamento NON è il monitoraggio gratuito.** Quello che si attiva quando
  il piano viene sospeso (pausa vacanza / sorveglianza) resta **gratis**, ed è l'unico che esiste
  oggi nel codice — `monitoring.service.ts` lo descrive come «paracadute GRATUITO». Il €19/mese è
  un prodotto nuovo che segue il mantenimento. Due cose diverse con lo stesso nome: va scritto
  ovunque, perché è esattamente il tipo di ambiguità che produce difetti che nessuno vede.
  ⚠️ Nel seed entrambi i piani sono ancora a **€29**. I prezzi veri si mettono dal **Negozio**,
  non nel seed: il seed aggiorna solo la descrizione, mai il valore già a database.
  Conseguenze già scritte nei documenti: il mantenimento ha **due modalità di acquisto** (non
  basta marcare il piano come ricorrente, serve la scelta nel checkout), e i conti delle
  provvigioni vanno rifatti — a €49 restano a Metabole **€25,96/mese** invece dei €183/anno
  calcolati su €29, quindi il residual «per sempre» pesa meno di quanto sembrasse quando lo
  abbiamo deciso. Resta **un solo numero aperto**: la percentuale coach **sul monitoraggio**,
  dove il 45% di €19 lascerebbe €9,91 su un prodotto che dura anni e chiede pochissimo lavoro.

- `[Sviluppo]` **«Porta un'amica» rifatta: prometteva una cosa e ne faceva un'altra.** Partita da
  due screenshot di Simone e finita per toccare tutta la meccanica. Cinque cose, in ordine di
  gravità:
  **1. Il testo mentiva.** La card diceva «quando un'amica **si iscrive** col tuo codice, il tuo
  percorso si allunga di 10 giorni». Non è vero: `onConvert` è chiamato da un solo punto, dentro
  la catena di **approvazione del pagamento**. La sola iscrizione non dà niente. Una cliente che
  invita tre amiche, le vede registrate e non riceve nulla, non ha un dubbio: ha la prova che
  l'app le ha mentito. Ora c'è scritto «si iscrive **e acquista un percorso**», e il contatore
  dice «con acquisto» invece di «iscritte» (contava già quello).
  **2. La ricompensa poteva sparire per sempre, in silenzio.** `convertedAt` veniva scritto
  **prima** di controllare se la referrer avesse un abbonamento attivo; se non ce l'aveva si
  usciva con un commento «non applicabile ora» — ma quell'«ora» non arrivava mai, perché alla
  chiamata dopo `convertedAt` c'era già. Nessun cron, nessun retry. E colpiva le persone
  sbagliate: chi ha il piano scaduto è la più motivata a portare un'amica per allungarlo. Ora
  resta in sospeso e viene **riscossa alla prima attivazione utile** (`riscuotiSospese`,
  agganciata alla stessa catena pagamenti).
  **3. La referrer non sapeva di aver vinto.** Nessuna notifica, solo una riga di audit. Adesso
  arriva «+10 giorni sul tuo percorso 🎁» nel momento in cui i giorni ci sono davvero.
  **4. La card non compare più dal primo giorno** (decisione di Simone): si mostra dopo
  **15 giorni di percorso**, parametro `referral_card_after_days` — chiedere di consigliare
  Metabole a chi l'ha appena aperta vale poco, e l'invito vale quanto vale chi lo manda. Il gate
  è sul server perché è una regola di prodotto: si cambia da Parametri, senza pubblicare l'app.
  Chi ha già invitato qualcuno continua a vederla comunque.
  **5. Il pulsante «Condividi» usciva dalla card** e copriva il codice: `.btn` nel tema ha
  `width: 100%` e con `flex: none` quella larghezza vince. Serviva `width: auto`.
  Corretta anche l'unica parola inglese dell'app cliente: la sezione «Help» in Home ora si
  chiama «Se ti serve una mano».

- `[Prodotto]` ✅ **L'amica invitata va alla stessa coach della referrer, che quindi incassa le
  provvigioni** (regola di Simone, 6/8). Prima non succedeva: `linkOnRegister` registrava
  l'invito e basta, e l'amica finiva **nel pool dei non assegnati**. Due cose sbagliate insieme —
  l'amica arrivava da una sconosciuta, e la coach che aveva di fatto generato quell'iscrizione non
  prendeva niente. Ora eredita la coach della referrer **subito, senza ciclo di accettazione**:
  come per il ref code di una coach, qui la scelta l'ha già fatta qualcuno. Le provvigioni seguono
  da sole, senza codice nuovo: `finance.generateCommissions` legge `ClientProfile.assignedCoachId`,
  che è esattamente il campo che scriviamo. La coach riceve una notifica, e se l'amica risulta già
  assegnata a qualcun altro non si scavalca nessuno. Solo la **coach**: la nutrizionista continua
  ad assegnarla il capo nutrizionista, perché lì il criterio è clinico, non commerciale.

- `[Sviluppo]` **Il link d'invito ora c'è anche dove serve: nell'app dei professionisti.**
  Segnalazione di Simone, e aveva ragione: il riquadro esisteva **solo nel backoffice da
  desktop** (`CoachHome`), mentre il link lo si manda dal telefono, in chat, mentre si parla con
  qualcuno. Nell'area staff dell'app (`app/src/staff/`) non c'era niente. Nuova `InvitoCard` in
  entrambe le dashboard, coach e nutrizionista, con lo stesso pulsante **Condividi** della card
  cliente — foglio nativo sul telefono, copia su desktop.
  Nel farlo è emersa una mezza funzione: **la nutrizionista era esclusa da `my-invite`**, che
  rispondeva «l'invito è disponibile solo per le coach» — mentre la registrazione **accetta già**
  i suoi ref code e le assegna la cliente. Aveva un codice funzionante che non poteva vedere.
  Aperto a lei e al capo nutrizionista. E quando l'invito non si può generare la card **non
  sparisce in silenzio**: dice cosa manca (la scheda staff) e a chi chiederlo.

- `[Sviluppo]` **La CI nuova ha subito fatto il suo mestiere: ha beccato me.** Le modifiche qui
  sopra hanno rotto tre test — il messaggio di `myInvite` cambiato, il quarto parametro di
  `ReferralService` (le notifiche) e `riscuotiSospese` assente dal finto ReferralService in
  commerce. Prima di stamattina sarebbero passati inosservati con `continue-on-error`, e sarebbero
  diventati il debito di qualcun altro. Sistemati subito: **51 suite, 527 test, tutto verde**,
  `tsc --noEmit` pulito su backend e app.

- `[Prodotto]` ✅ **Provvigioni sul rinnovo: chiuse tutte e tre le domande** (Simone, 6/8).
  Quota coach **piena a ogni rinnovo** (opzione b); provvigione **solo se la coach è ancora quella
  assegnata**; residual **per sempre**, senza scadenza.
  Le ultime due si tengono insieme, ed è la ragione per cui «per sempre» regge: la rendita è
  legata al **rapporto**, non al contratto. Finché quella coach segue la cliente incassa; se la
  smette di seguire, o la cliente viene spostata, il pagamento si ferma da solo. Senza il vincolo
  sull'assegnazione, «per sempre» sarebbe stato un assegno in bianco.
  Il numero da ricordare non è la provvigione ma quello che resta: **€15,26 al mese per cliente,
  per sempre** — non €28,31 dal secondo anno. È la cifra su cui calcolare quanto si può spendere
  in acquisizione.
  **Da qui il codice del ricorrente può partire senza altre domande sulle provvigioni.** Restano
  le sei domande di impianto (piani, intervallo, dunning, disdetta, prova, bonifico), preparate
  con la proposta già scritta in `progetto/Stripe_Ricorrente_Sei_Domande.md` per domattina.

- `[Prodotto]` ✅ **Provvigioni sul rinnovo: decisione chiusa.** Simone: «la quota coach sui rinnovi
  non cambia» → **opzione (b)**, provvigione piena a ogni rinnovo, che con il nutrizionista già a
  zero lascia €15,26 al mese a Metabole e €183 per cliente all'anno. È il modello *residual*: la
  coach guadagna finché la cliente resta, quindi ha interesse a farla restare — e in mantenimento
  serve proprio quello, perché chi molla non protesta, sparisce.
  **Sblocca la voce #10** (monitoraggio a pagamento) e con essa lo Stripe ricorrente, che era
  l'ultimo lavoro grosso fermo su una decisione e non su del codice.
  ⚠️ Restano due interruttori da decidere, e non sono a/b/c: se il residual **dura per sempre o 12
  mesi** (con la (b) «per sempre» significa pagare anche sulla cliente che si rinnova da sola da
  tre anni), e la condizione **«solo se la coach è ancora quella assegnata»**, che va messa
  comunque — altrimenti una coach che se ne va continua a incassare. Vanno decise prima del primo
  rinnovo pagato: dopo diventano una revisione di compensi già erogati.
  Dettagli e numeri: `progetto/Decisione_Provvigioni_Rinnovo.md`.

- `[Prodotto]` ✅ **Keto-Mediterranea creata dal nutrizionista**, dal generatore del backoffice —
  usato come formazione, che era l'idea di Simone quando ha rifiutato lo script. Ora sta facendo
  manutenzione alle ricette. La voce #2 del feedback del 5/8 («ingredienti Keto introvabili») si
  chiude qui: il codice c'era da stamattina, mancava questo. Finché le varianti non sono approvate
  nessuna cliente le vede, quindi la manutenzione può prendersi il tempo che serve.

- `[Sviluppo]` **`continue-on-error` tolto da `ci.yml`: da adesso la CI può fallire** (commit
  `73cc4f2`, fatto dall'editor web di GitHub — i file `.github/` il bridge non li scrive). Via
  anche il nome dello step, «Test (informativo — alcuni test noti falliscono per DI NestJS)»,
  diventato falso: ora è solo «Test». Un test rosso blocca la push, che è il punto.
  Vale la pena tenere insieme le due metà della storia: quella riga era stata messa per non farsi
  bloccare da ~30 test rotti, e proprio perché c'era nessuno ha visto i test diventare 99. Una
  rete di sicurezza disattivata «temporaneamente» non resta ferma: peggiora, in silenzio.

- `[Sviluppo]` **I test rossi erano 99, non «una trentina»: adesso sono 28.** Ho fatto girare la
  suite del backend, cosa che nessuno faceva più da quando `ci.yml` ha `continue-on-error: true` —
  la pipeline non può fallire, quindi nessuno vedeva niente. Nei nostri appunti c'era scritto
  «~30 test rossi in `src/commerce`»: erano **99 in 18 suite**, sparsi su mezzo backend.
  Ma non erano 99 problemi. Guardandoli sono **quattro famiglie**, e una sola ne spiegava l'85%:
  **un provider aggiunto al costruttore di un servizio e dimenticato nel modulo di test.** Quei
  test non fallivano su un'asserzione, **non partivano proprio** — Nest non risolveva le
  dipendenze e la suite intera moriva in `beforeEach`. Sei suite, sei righe: `NotificationsService`
  in auth, catalog e visite, `CrmService` in utenti, `MonitoringService` in commerce, `MailService`
  + `NotificationsService` nel blocco CrmService di finance-crm. **99 → 28**.
  Poi la seconda famiglia, anch'essa meccanica: **il finto Prisma dei test non ha i modelli che il
  servizio ha imparato a leggere nel frattempo**. `coachTeamScope` — la rete coach a tre livelli —
  legge il ruolo da `prisma.user`, e nei mock `user` non c'era proprio: la chiamata esplodeva
  prima di ogni asserzione (coach, alert, promemoria). Stessa storia con `subscription` in signals
  (il check-in ora si propone solo con un piano attivo), `crmReminder` nella board della pipeline,
  `user` nella lista pazienti, `ledgerEntry.aggregate` in contabilità. **28 → 17**, con sette
  suite tornate completamente verdi: auth, utenti, signals, promemoria, pipeline, nutrizionista,
  alert.
  Nessuna delle due famiglie era un difetto del codice: erano test rimasti indietro rispetto a
  modifiche fatte bene. Ma la conseguenza era che **nessuno dei test di quelle suite girava**, e
  quindi non proteggevano più niente da mesi.
  Poi i 17 rimasti, uno per uno, e qui non era più meccanico. **In nessun caso il difetto era nel
  codice: erano test rimasti indietro rispetto a modifiche fatte bene.** Ma tre meritano di essere
  raccontati, perché la riparazione è stata una decisione, non un allineamento:
  · **Gate misure** (`menu-measurement-gate`): si aspettava 0 campi e ne riceveva 3 — `level`,
    `since`, `lockedMessage`, aggiunti oggi col gate severo. Il confronto è rimasto **esaustivo**
    di proposito: se domani il gate cresce ancora, il test lo dice invece di lasciar passare campi
    nuovi che nessuno ha mai guardato.
  · **Ricompensa «porta un'amica»** (`referral`): confrontava una data fissa con l'orologio reale.
    Scritto a luglio era verde; passato il 1° agosto è diventato rosso **da solo**, senza che si
    rompesse niente. Congelato il tempo (`setSystemTime`) e aggiunto il caso opposto, che non
    c'era: abbonamento già scaduto → i giorni si contano da oggi, non dalla scadenza vecchia,
    altrimenti si regalerebbero giorni già passati.
  · **Statistiche pubbliche** (`catalog`): il test diceva che i «clienti seguiti» della home sono
    gli abbonamenti attivati. Non è più così — sono le schede CRM arrivate a `paid` **oppure** con
    un pagamento pregresso (clienti storici), e sul sito vanno solo le diete rese visibili, non
    tutte le approvate. È un numero che sta sulla home: allineato al codice, ma **segnalato**,
    perché se la definizione giusta fosse quella vecchia allora il difetto è nel codice.
  L'ultimo è il più interessante e non era un mock dimenticato. L'approvazione dei pagamenti non
  fa più «leggi lo stato, poi scrivi»: fa una **updateMany atomica** che tocca la riga solo se è
  ancora in attesa e decide dal `count` — così due operatori che cliccano insieme, o un webhook
  Stripe riconsegnato, non producono un doppio accredito. Il finto Prisma però rispondeva sempre
  `count: 1`: **i tre test sull'idempotenza misuravano un mondo che non esiste.** Ora il mock si
  comporta come il database vero. E `cron.controller.spec`, ferma a quando gli step erano due su
  sedici, è stata riscritta intorno a quello che conta adesso: che **uno step rotto non fermi gli
  altri** — la ragione per cui quel codice ha quella forma, e che nessuno verificava.
  **Risultato: 51 suite su 51, 527 test su 527, zero rossi**, con `tsc --noEmit` pulito.
  ⚠️ Resta da togliere `continue-on-error: true` da `.github/workflows/ci.yml` (e il nome dello
  step, «informativo — alcuni test noti falliscono», che adesso è falso). Va fatto dall'editor web
  di GitHub: i file `.github/` il bridge non li scrive. È il momento giusto: da lì in poi la
  pipeline comincia davvero a proteggere, invece di raccontare che tutto va bene.
  Nota di metodo: `continue-on-error` non si toglie perché «ci sono pochi test rossi», si toglie
  quando sono zero. Finché c'è, il numero cresce senza che nessuno se ne accorga — da 30 a 99
  è successo esattamente così.

- `[Sviluppo]` **Un'assegnazione «da accettare» non si porta sul profilo cliente.** Buco aperto
  da me un'ora prima, con la modifica al form Nuovo lead: da lì in poi un lead può essere
  assegnato ma non ancora accettato, e `sendCredentials` portava comunque la coach sul profilo.
  Se poi la coach rifiuta, o scade la finestra, `reject()` e il cron di scadenza svuotano il
  `CrmRecord` — **il profilo no**, e la cliente resterebbe agganciata a una coach che quel lead
  non l'ha mai preso. Nessuno se ne accorgerebbe: nel CRM il lead è tornato alla responsabile,
  nel backoffice la cliente è di qualcun altro.
  Ora l'accettazione implicita viene valutata **prima**, e sul profilo la coach ci arriva solo
  se l'assegnazione risulta accettata; altrimenti ci arriva con l'accettazione, che già propaga.
  La nutrizionista non ha ciclo di accettazione e passa sempre. Stessa regola in
  `fix:assegnazioni`, che ora conta a parte i lead ancora da accettare invece di allinearli
  (uno `assignmentStatus` nullo è dato storico e vale come accettato, altrimenti i casi più
  vecchi non verrebbero riparati proprio).

- `[Sviluppo]` **`install-ios.mjs` rimette da solo le quattro cose che `cap add ios` cancella.**
  Erano il conto della serata: capability Push, `GoogleService-Info.plist` agganciato al target,
  `aps-environment` a `production`, e `CODE_SIGN_IDENTITY = "iPhone Developer"` che il template
  Capacitor rimette e che firma l'archivio in development. Nessuna delle quattro dà errore: la
  build passa, si carica, e le push non arrivano a nessuno. Le abbiamo rimesse a mano una per una,
  in un'ora, e rimetterle a mano ogni volta è la garanzia di riperderle.
  Ora lo script scrive `App.entitlements`, lo aggancia alle **due** configurazioni del target
  (Debug e Release, riconosciute da `INFOPLIST_FILE = App/Info.plist`), mette team
  `TNDPSUPTA8` e firma automatica, **toglie** ogni `CODE_SIGN_IDENTITY`, e aggiunge il plist
  Firebase alla fase *Resources* — copiarlo non basta: fuori dalla fase resta sul disco ma non
  entra dentro l'app, e Firebase all'avvio non lo trova.
  Come per i metodi del delegato, **verifica il proprio risultato prima di dire com'è andata**:
  se gli entitlements non risultano in entrambe le configurazioni, o se un `CODE_SIGN_IDENTITY`
  è sopravvissuto, esce con errore invece di stampare «già a posto». Provato su tre scenari
  costruiti dal progetto Xcode **vero** (letto dal Mac, non immaginato): progetto sano → non
  tocca niente; progetto rigenerato → ricostruisce **esattamente** le stesse righe che avevi
  messo a mano; progetto rotto ad arte → esce 1 e dice quale controllo è saltato. Il primo giro
  del contro-test era invalido — girava sull'albero sbagliato, perché lo script deriva la radice
  dalla propria posizione e non dalla cartella corrente — ed è stato rifatto.
  Resta fuori una cosa sola, che nessuno script può fare: il **certificato Apple Distribution
  scade ogni anno**, e senza quello l'archivio torna a firmarsi in development. Il controllo
  `codesign` prima di caricare è in coda a `build-ios.sh`.

- `[Sviluppo]` **Nuovo lead: c'è la select «Assegna a», e chi la riceve viene avvisato.** Il
  backend accettava `assignedCoachId` in creazione da sempre, ma il DTO non lo dichiarava e il
  form non lo chiedeva: ogni lead inserito da lì nasceva nel pool e andava riassegnato a mano.
  Nel sistemarlo è saltato fuori il difetto vero: quel ramo dava l'assegnazione per **accettata**
  e **non avvisava nessuno** — la coach si ritrovava un lead in carico senza saperlo, e senza il
  ciclo di accettazione che vale ovunque altrove. Ora, quando è la responsabile ad assegnare in
  creazione, il lead nasce «da accettare», la coach riceve la notifica e ha i suoi giorni; se
  scade torna alla responsabile. Quando è una coach a crearsi un lead per sé resta come prima
  (assegnato subito: non c'è niente da accettare).

- `[Sviluppo]` ⚠️ **Un controllo che non girava.** Oggi ho dichiarato più volte «`tsc --noEmit`
  pulito su backend e backoffice». Sul backoffice **non era vero**: il comando era
  `ls node_modules/.bin/tsc && ./node_modules/.bin/tsc …`, `node_modules` nel backoffice non
  esiste sul Mac, l'`&&` tagliava corto e `tsc` non partiva mai — l'«ok» era solo l'`echo`
  successivo. Il controllo è stato poi fatto davvero (dipendenze installate a parte, `tsc`
  eseguito: pulito, oggi come nelle voci precedenti). Vale la pena scriverlo perché è la
  famiglia di difetti di tutta la giornata: **un controllo che non produce errore quando
  fallisce è peggio di nessun controllo**, perché ci si appoggia. Da qui in avanti, per ogni
  verifica, si guarda il **codice di uscita** — non l'ultima riga stampata.

- `[Sviluppo]` **Gestione dieta mostrava le ricette di tutte le diete.** Domanda di Simone: «se sto
  rivedendo i menu di una dieta perché sotto mi riporta anche quelli delle altre?». Aveva ragione a
  trovarlo strano, ma la causa è più interessante del sintomo: **le ricette non appartengono a una
  dieta.** `Recipe` non ha nessun `dietId` — ha regime, pasto, kcal, tag; il legame vive
  dall'altra parte, in `DietDayTemplate.meals` (`[{slot, recipeId}]`), cioè è la *giornata* a
  puntare alla ricetta. Ed è voluto: la stessa insalata vegetariana serve a Basso indice glicemico,
  Mediterranea e Keto-Mediterranea insieme, altrimenti il catalogo andrebbe riscritto per ogni
  famiglia. La pagina però filtrava solo per **regime**, e sotto il nome della dieta aperta
  comparivano piatti `gen:summer_return` e `gen:protein` di altre famiglie.
  Ora il catalogo dentro Gestione dieta parte dalle ricette **di quella dieta** (nuovo parametro
  `dietId` su `GET /recipes`: legge le giornate ed estrae gli id, perché quel JSON il database non
  lo sa interrogare), con l'interruttore **«Tutto il regime»** per quando devi pescarne una nuova
  da aggiungere. Lì compare l'avviso che mancava del tutto ed è la parte che conta:
  **modificare o cancellare una ricetta la cambia ovunque venga usata**, anche nelle diete di
  altre famiglie. La pagina lasciava credere il contrario.
  Effetto collaterale utile: nella vista per dieta il tetto delle 1000 righe non si tocca mai —
  una dieta ha decine di ricette. Resta però il fatto emerso dallo screenshot: **le sole ricette
  vegetariane hanno già superato le 1000**, quindi nel catalogo per regime i filtri di colonna
  lavorano su una fetta. Alzare ancora il tetto è un rattoppo: la strada è portare filtri e
  ordinamento sul server. In lista lavori, non fatto oggi.
  `tsc --noEmit` pulito su backend e backoffice.

- `[Sviluppo]` **`build-ios.sh` diceva il Team sbagliato.** Suggeriva «Mosaico Experiences SA»
  quando quello giusto è **Genius Company SA (TNDPSUPTA8)**: oggi ho quasi corretto il progetto
  Xcode sulla base di quella riga, cioè lo script stava per far sbagliare la firma. Corretta, e
  aggiunto in coda il comando `codesign -d --entitlements` da lanciare **prima** di caricare
  l'archivio, con cosa deve risultare (`aps-environment = production`, `get-task-allow` assente) e
  cosa significa se esce `development` (manca il certificato Apple Distribution, che **scade ogni
  anno**). È la verifica che oggi è costata un'ora a costruire: tenerla in un promemoria a voce
  significa riperderla al prossimo rilascio.

- `[Sviluppo]` **La coach non perde più la cliente quando le manda le credenziali.** Segnalazione
  di Simone: Gioia Lurve ha inviato le credenziali a Francesco reale dal pulsante sul lead; il lead
  risulta assegnato a lei, ma aprendolo si finisce su una cliente «non assegnata a nessuno».
  La causa è un ponte mancante fra due mondi: il CRM ragiona per lead
  (`CrmRecord.assignedCoachId`), tutto il resto del backoffice ragiona per profilo
  (`ClientProfile.assignedCoachId`) — liste clienti, chat, attività della coach, provvigioni,
  pausa vacanza filtrano **tutte** sul profilo. `sendCredentials` creava l'account e collegava il
  lead, ma non toccava il profilo; anzi, il profilo **non esisteva proprio**, perché nasce col
  questionario. Quindi non era un'etichetta sbagliata: la coach non riusciva **davvero** ad aprire
  la scheda della cliente appena creata («questo cliente non è assegnato a te»).
  L'aggancio esisteva in due punti soli — l'accettazione del lead e l'onboarding — e mancava
  proprio dove il cliente nasce. Adesso è **una funzione sola**, `src/common/assegnazione-profilo.ts`,
  chiamata da tutti e tre i rami (invio credenziali, accettazione, ref code): il ponte non si può
  più dimenticare in un ramo. Due regole volute: non sovrascrive **mai** un'assegnazione già
  presente (spostare una cliente resta un atto esplicito da Utenti), e crea il profilo se manca —
  sicuro, perché il gate dell'onboarding guarda `onboardingCompletedAt`, non l'esistenza del
  profilo. Corretti anche due `updateMany` che, senza profilo, aggiornavano **zero righe in
  silenzio**: l'accettazione del lead e l'assegnazione via ref code avevano lo stesso buco.
  Seconda parte, stesso difetto: se la coach manda le credenziali a un lead ancora «da accettare»,
  l'accettazione ora è **implicita** — sta già lavorando il lead. Senza, dopo `lead_accept_days`
  il cron di scadenza glielo toglieva di mano proprio mentre lo seguiva: l'anomalia segnalata
  sarebbe tornata da sola due giorni dopo. Vale solo se è la coach assegnata a premere il
  pulsante; se lo fa la responsabile, il lead resta «da accettare».
  Per le clienti già finite in quello stato — Francesco reale compreso — il codice nuovo non basta:
  c'è **`npm run fix:assegnazioni`** (shell di Render, in `~/project/src/backend`), che di suo
  mostra e basta e scrive solo con `CONFERMA=1`. Elenca a parte, senza toccarle, le divergenze in
  cui il profilo ha già un'**altra** coach: quella è la decisione di qualcuno, non un difetto.
  Effetto collaterale voluto: queste clienti rientrano ora anche nell'email di ciclo di vita
  «profilo_incompleto», che prima le saltava perché il profilo non esisteva.
  `tsc --noEmit` pulito. File: `backend/src/common/assegnazione-profilo.ts` (nuovo),
  `crm.service.ts`, `lead-assignment.service.ts`, `prisma/fix-assegnazioni.ts` (nuovo),
  `package.json`.

- `[Sviluppo]` ✅ **PUSH iOS VERIFICATE FUNZIONANTI** su TestFlight, build **2.1 (7)**: push di
  prova inviata dal backoffice e **arrivata sul telefono**. È la chiusura dell'indagine iniziata
  stamattina: dalla 2.0 non arrivavano a nessuno e nessuno poteva accorgersene. La catena completa
  che le teneva spente era di cinque anelli — metodi del delegato mancanti in `AppDelegate`
  (`install-ios.mjs` li inseriva senza verificare), chiave APNs revocata e rifatta, capability
  Push assente nel progetto rigenerato, `GoogleService-Info.plist` non agganciato al target,
  `aps-environment` a `development` perché **mancava il certificato Apple Distribution** (scaduto).
  Ognuno da solo bastava a spegnerle, e nessuno produceva un errore visibile.
  **2.1 inviata in revisione su App Store; Android in approvazione su Play.**
  Lezione generale, la stessa di tutta la giornata: quando un difetto non produce un errore, non
  serve cercarlo meglio — serve **costruire la verifica**. Le tre di oggi sono `codesign -d
  --entitlements` sull'archivio prima di caricare, il `timestamp` di `/health` per accorgersi di
  leggere risposte in cache, e la push di prova da TestFlight prima di pubblicare.

- `[Sviluppo]` **iOS 2.1 caricata su App Store Connect** (17:19), dopo una caccia alla firma durata
  un'ora. La rigenerazione di `ios/` aveva azzerato tre cose che vivono solo nel progetto Xcode —
  capability Push Notifications, `GoogleService-Info.plist` agganciato al target, entitlement
  `aps-environment` — e sotto ce n'erano altre due: il template Capacitor forza
  `CODE_SIGN_IDENTITY = "iPhone Developer"` **in tutte le configurazioni**, archivio compreso, e
  soprattutto **mancava il certificato Apple Distribution** (scaduto: durano un anno, l'ultimo era
  di luglio). Senza quello nessuna modifica al progetto poteva cambiare la firma. Creato da
  Xcode → Apple Accounts → Manage Certificates, e l'upload è passato.
  Unico avviso: **MinimumOSVersion 13.0**, che dalla primavera 2027 non sarà più accettata (minimo
  15.0). Non blocca oggi; messo in `metabole-backlog.md` con la nota che va fatto fare a
  `install-ios.mjs`, come gli altri passaggi che si perdono a ogni rigenerazione.

- `[Sviluppo]` **OTA spento ✓ — e un mio errore da segnare.** `OTA_VERSION` è stata eliminata dal
  servizio su Render (deploy live alle 15:58) e il manifest ora risponde
  `{"version":null,"url":null}`: nessun telefono scarica più bundle, e la 2.1 dello store non
  rischia di ritrovarsi sopra il web della 2.0.1.
  ⚠️ **La caccia è durata un'ora per colpa mia.** Rileggevo il manifest dal sandbox e continuavo a
  vedere `2.0.1` anche dopo che Simone l'aveva già tolta: ho detto due volte, con sicurezza, «non è
  cache» — e gli ho fatto rifare la procedura tre volte. Era cache: `GET /health` restituiva un
  `timestamp` di **due ore e mezza prima**, cioè l'istante della mia prima chiamata a quel dominio.
  Variare la query string (`?t=...`) non serviva a niente. La verifica vera l'ha data il browser,
  che non passa da quel proxy.
  **Regola scritta in memoria** (`feedback_verifiche_endpoint.md`): per sapere «com'è adesso»
  qualcosa che abbiamo appena cambiato — env, deploy, manifest — si legge **dal browser**, non con
  WebFetch; e il `timestamp` di `/health` è il modo da dieci secondi per accorgersi di star
  leggendo roba vecchia. Verificato nella stessa passata che l'unico gruppo di ambiente collegato
  (`metabole-shared`) contiene solo `CRON_SECRET`: nessun'altra sorgente nascosta.

- `[Sviluppo]` **Posta backoffice — «Ricevuta» e «Inviata» erano testo nudo** (segnalato da Simone:
  «così è proprio brutto»). Il markup usava un *segmented control* (`.seg`) copiato dall'app
  cliente, ma quel CSS nel backoffice **non esiste**: le due voci uscivano come due righe di testo
  impilate accanto a due pulsanti veri. Ora sono due pulsanti come gli altri della barra — pieno
  quello attivo, fantasma l'altro, con le icone di posta in arrivo e inviata — e si disabilitano
  durante il caricamento come «Aggiorna». Era l'unico punto del backoffice che usava `.seg`.

- `[Sviluppo]` **Il backend ora si type-checka anche fuori da Render, e il compilatore fa la
  guardia sugli stati.** Finora il type-check del backend esisteva solo dentro il deploy: nel
  sandbox il client Prisma non è generabile, quindi ogni errore di tipo si scopriva a build in
  corso. Sul Mac di Simone bastano `npm install` in `backend/` e
  `./node_modules/.bin/tsc --noEmit -p tsconfig.build.json`: **primo giro fatto oggi, zero
  errori**. Un minuto, e diventa la rete di sicurezza prima di ogni consegna backend
  (annotato in memoria, con la trappola dell'`npx tsc` che scarica un pacchetto omonimo inutile).
  Con quella rete disponibile, tolti i due `as never` dalle query corrette poco fa: erano proprio
  loro a spegnere il controllo del compilatore e a lasciar passare `'paused'` due volte. Ora uno
  stato inesistente **non compila**. La regola generale finisce in memoria: il cast serve per i
  campi Json, non per i valori di enum in un `where`.

- `[Sviluppo]` **500 in produzione sulle attività coach: `'paused'` non è uno stato di
  Subscription** (trovato nei log di Render mentre cercavamo altro). L'enum è
  `pending|active|cancelled|expired` — una pausa non cambia lo stato dell'abbonamento, vive in
  `pause_request`. In `coach-tasks.service.ts` la tripla `['active','pending','paused']` compariva
  in **due** punti: il riepilogo delle attività coach (che l'app ingoia in silenzio: la striscia
  in cima spariva e basta) e il **tick delle prove**, cioè la generazione automatica dei task.
  Introdotto stamattina con `f9900c8`, live da allora.
  ⚠️ **Era già successo**: lo stesso errore era stato corretto in `commerce.service.ts:204`, dove
  faceva 500 su `/me/plans` — e da lì la tripla sbagliata è stata **ricopiata**. Il `as never` che
  serve a far compilare quelle query è anche ciò che spegne il controllo del compilatore: senza
  qualcosa che guardi, l'errore torna.
  Ho provato a scrivere un controllo statico che confrontasse gli stati citati con l'enum, e **l'ho
  buttato**: con query multilinea produceva quattro falsi positivi su sei segnalazioni, e un
  controllo che grida al lupo viene ignorato — sarebbe stato peggio di niente. La strada giusta è
  togliere `as never` da quelle due query e lasciare che sia **il compilatore** a rifiutare uno
  stato inesistente: si fa quando il type-check del backend è eseguibile davvero (sul Mac, dove il
  client Prisma esiste), non a naso.

- `[Sviluppo]` **Controllo pre-build: l'OTA in produzione non è quello che credevamo.** Prima
  delle build ho letto il manifest pubblico invece di fidarmi dei registri:
  `/api/v1/app-updates/latest.json` serve **`2.0.1`**, non `2.0.3`. Il passaggio a 2.0.2/2.0.3
  annunciato stamattina **non è mai stato completato su Render**: la variabile `OTA_VERSION` è
  rimasta ferma sul bundle della prima pubblicazione. Due conseguenze, una già in corso e una
  peggiore: **oggi** i telefoni scaricano quel bundle vecchio; **stasera**, se la variabile resta,
  chi aggiorna alla 2.1 dallo store si ritrova il web della 2.0.1 **sopra** il nativo nuovo, cioè
  vede l'app di ieri dopo aver aggiornato. Da svuotare **prima** della pubblicazione, non dopo:
  svuotarla non fa tornare indietro nessuno, i telefoni tengono il bundle che hanno già.
  Aggiornate note di rilascio e memoria di progetto. **Lezione**: lo stato dell'OTA vive in una
  variabile d'ambiente su Render — fuori dal repo e fuori da ogni registro. L'unico modo di sapere
  cos'è pubblicato è leggere il manifest, e va fatto prima di ogni release.
  Verificato nella stessa passata: backend up e database raggiungibile; `google-services.json` e
  `GoogleService-Info.plist` al loro posto (senza, le push si spengono in silenzio al build);
  `@capacitor/share` installato; versioni allineate a **5 / 2.1**.

- `[Prodotto]` **Ripuliti i quattro documenti che dicevano il falso** (dall'audit di oggi). Una
  checklist che mente si smette di leggere, e da quel momento non protegge più niente.
  ① `Metabole_Checklist_GoLive.md`: i quattro gate di apertura erano ancora 🔴 pur essendo stati
  confermati il **16 luglio** (Stripe LIVE con pagamento reale, DNS Brevo, backoffice, push) —
  chiusi, annotando che le push iOS sono state riparate solo il 6/8.
  ② `RIEPILOGO_Lavori_Collaudo.md`: dal backlog tolte due voci superate — il modulo campagne
  marketing è **fatto dal 15/7**, e il video di presentazione della coach è **annullato da Simone
  il 17/7**: non è un lavoro in coda, è una cosa che non si fa.
  ③ `Metabole_Checklist_Allineamento_STATO.md`: schermate 28-29 da ⬜ «serve il video» ad
  **annullate**, stessa decisione.
  ④ `progetto/STATO.md`: piani stagionali da ⬜ a 🟡 — il segnale di viaggio esiste con date e
  stati (`clients.service.ts:634-653`) e il popup misure è sospeso in vacanza
  (`menu.service.ts:690,715`); manca il collegamento all'agente dieta e la creazione dei due
  prodotti in produzione. Scritto cosa c'è e cosa manca, invece di una casella vuota.

- `[Sviluppo]` **Revisione del lavoro della giornata, e una regressione mia corretta prima che
  facesse danni.** Rivisto tutto il diff di oggi: il backend contro lo schema Prisma (chiamate,
  DTO, rotte, righe nuove del seed) — nessun bloccante, si può deployare — e il frontend cercando
  regressioni di comportamento. Ne è uscita una vera, introdotta stamattina da me: la barra del
  generatore era legata a `busy`, che però è condiviso da **sette** operazioni della pagina
  (archivia, elimina, salva, valida, pubblica, anteprima). Chi archiviava una variante leggeva
  «Sto generando ricette, giornate, alternative e allergeni… può richiedere fino a un minuto» e
  poteva restare ad aspettare per niente — proprio nella sessione di formazione con la
  nutrizionista. Ora la generazione ha uno stato suo (`generando`).
  Corretto anche un buco in `ota.ts`: un manifest che risponde 200 con **JSON malformato**
  finiva nel `catch` del telefono offline, cioè veniva ignorato — esattamente il difetto che il
  commit di stamattina voleva chiudere. Ora la lettura del manifest sta fuori da quel catch e un
  manifest illeggibile si segnala (`manifest_illeggibile`).
  ⚠️ Emerso durante la revisione, utile la prossima volta che un deploy fallisce:
  `tsconfig.build.json` **esclude `prisma/`**, quindi il seed non viene type-checkato, e da oggi
  gira con `--transpile-only`. Un errore di *tipo* nel seed non ferma più il build; un errore a
  *runtime* lì dentro invece blocca il preDeploy. È il primo posto dove guardare.

- `[Sviluppo]` **Audit di fine giornata e chiusura di quattro difetti «interruttore che non c'è»**
  (richiesta Simone: «tutti i lavori sono stati fatti?»). Verificate 18 richieste del 5/8 più i
  ~90 `REGISTRO_*.md`, il backlog, `STATO.md` e le checklist di luglio, ogni voce ri-controllata
  **nel codice**: 16 su 18 chiuse, la #2 aspetta la nutrizionista, la #10 una decisione.
  Rapporto in `progetto/Audit_Lavori_2026-08-06.md`. Corretti i quattro difetti nuovi trovati:
  ① **`menu_daycombo_kcal_target` era un interruttore finto**: nella pagina *Regole motore* si
  poteva cambiare il valore globale credendo di spostare le calorie dei menu, ma il motore prende
  il target dal **fabbisogno della cliente** (o dai livelli della dieta) e quel parametro non lo
  legge mai — l'unica lettura è nel generatore di bozze. Corretta la **descrizione**, non il
  codice: il target deve venire dalla singola cliente, non da un numero globale.
  ② **`menu_kcal_need_enabled`** (kcal dal fabbisogno o dai livelli: una scelta clinica) e
  **`menu_penalty_season`** (la forza della stagionalità costruita oggi) erano leve vere e
  invisibili: portate nel catalogo del motore, quindi regolabili globalmente e per dieta.
  ③ **`refund_receipt`**: stessa dimenticanza dell'email credenziali, una casella più in là.
  ④ **`marketing_require_consent`** — il gate che esclude dalle campagne i lead senza consenso —
  aveva perfino un commento che diceva «si accende da Parametri», e in Parametri non c'era.
  Seminato insieme a `app_store_url`, `play_store_url` e alle altre 13 chiavi che il codice
  leggeva senza che comparissero da nessuna parte (misure, pausa, offerta di fine prova):
  **stessi valori di prima, quindi nessun cambio di comportamento** — cambia che ora si vedono.
  ⑤ E soprattutto: **`npm run diag:parametri`**, che confronta le chiavi lette dal codice con
  quelle dichiarate e **esce con errore** se divergono. Non serve il database, gira ovunque,
  anche in CI. Tre volte lo stesso difetto non è sfortuna: è che nessuno poteva accorgersene.
  Oggi esce pulito.

- `[Prodotto]` **Nota di handoff per la pubblicazione** — `NOTA_Handoff_Pubblicazione_2026-08-06.md`,
  come da regola di progetto (a ogni tornata di modifiche se ne scrive una per chi pubblica).
  Contiene: i 27 commit della giornata, le superfici toccate e quali richiedono un deploy, le
  **cinque migrazioni**, le env (con `OTA_VERSION` **da svuotare dopo** la pubblicazione), il
  `npm install` obbligatorio in `app/` perché `@capacitor/share` è un plugin nativo nuovo, i due
  passi che ci sono già costati cari (**Xcode chiuso** prima di `build-ios.sh`, **`aps-environment`
  a production** prima di archiviare), lo stato dei test con il perché `continue-on-error` non si
  toglie stasera, **quattro verifiche post-deploy** coi comandi pronti, e l'elenco di ciò che
  resta aperto. Serve a chi pubblica fra sei mesi, quando nessuno si ricorderà perché il seed
  andava in out of memory.

- `[Sviluppo]` **Parametri e modelli email: adesso si possono anche CREARE, non solo modificare**
  — la causa comune dietro due difetti di oggi. `config_param` e `email_template` avevano solo
  lettura e aggiornamento di righe che dovevano già esistere: la promessa «configurabile dal
  backoffice» era vera solo se qualcuno si ricordava di mettere la chiave nel seed, e quando se
  ne dimenticava il sistema usava un default scritto nel codice **senza dirlo a nessuno**. È
  successo con i sei parametri del fabbisogno kcal e con il modello dell'email delle credenziali.
  Ora `POST /admin/config` e `POST /admin/email/templates` (solo admin, con audit), più i due
  riquadri in *Parametri* e *Modelli email*. Chiave validata (minuscole, numeri, underscore) e
  409 parlante se esiste già. Nell'interfaccia è scritto chiaro il punto che conta e che non è
  intuitivo: **la chiave deve essere identica a quella che il codice cerca**, altrimenti la riga
  resta lì e non la usa nessuno.

- `[Sviluppo]` **L'email delle credenziali ora si può modificare dal backoffice** (voce d'audit
  rimasta aperta). `lead_credentials` era l'unica transazionale senza riga in `EMAIL_TEMPLATES`:
  il testo arrivava solo dai default i18n, e chi voleva ritoccarlo non trovava il modello in
  *Modelli email*. È proprio l'email che riceve una cliente come primo contatto con il prodotto,
  quindi è l'ultima che dovrebbe essere intoccabile. Aggiunta col testo identico al default,
  `{{storeButtons}}` compreso — i pulsanti App Store / Google Play si possono spostare o togliere
  riscrivendo il modello. ⚠️ Da sapere: quando un modello esiste a DB **vince sui default i18n**,
  quindi da qui in avanti questa email è in italiano per tutte, anche per una cliente con lingua
  inglese. Vale già per tutte le altre transazionali; se un giorno serviranno davvero le lingue,
  la strada è un modello per lingua, non il ritorno agli i18n.

- `[Sviluppo]` **OTA — un aggiornamento che fallisce non sparisce più in silenzio** (voce rimasta
  aperta dall'indagine di stamattina). `initOta` aveva un `catch` vuoto attorno a tutto: un
  manifest che punta a uno zip inesistente, uno zip corrotto o il telefono senza spazio finivano
  nel nulla — dal nostro lato sembrava tutto a posto mentre sui telefoni non cambiava niente. È
  già successo, ed è la stessa lezione degli script di patch che non verificavano il proprio
  risultato. Ora l'errore viaggia come evento analitico **`ota_error`** (stessa strada di tutti
  gli altri) con fase, versione, url e messaggio, e si ripete **solo se cambia**: un bundle rotto
  lo scopriamo al primo avvio, senza ricevere lo stesso errore da ogni telefono a ogni apertura.
  Il telefono semplicemente offline **non** viene segnalato: non è un errore, riprova dopo.
  Aggiunto anche `ota_scaricato`: finora non sapeva nessuno se un OTA fosse arrivato davvero sui
  telefoni. ⚠️ È codice app: entra con la build 2.1 di stasera, non prima.

- `[Sviluppo]` **Pulizia Keto-Mediterranea, per rifarla da zero col nutrizionista** (richiesta
  Simone). Nuovo `backend/prisma/cleanup-keto-mediterranea.ts` (`npm run cleanup:keto-med`):
  cancella le diete con stile `keto_mediterranean` **o** nome che comincia per «Keto-Mediterranea»
  — quindi anche le varianti del vecchio script — con giornate, regole per prodotto, gruppi di
  equivalenza e le **ricette referenziate solo da quelle diete** (voti e pesi compresi).
  Tre paletti scritti nel codice, non nella memoria di chi lo lancia: **non tocca i 12 preset**
  del generatore (servono a rigenerare), **salta le diete con menu già erogati** perché sono la
  storia di una cliente e le elenca invece di cancellarle in silenzio, e **senza `CONFERMA=1`
  fa solo la prova a vuoto** stampando la tabella di cosa sparirebbe. Una cancellazione a catena
  la si guarda prima di farla.

- `[Sviluppo]` **Generatore: la barra di avanzamento c'era, ma si nascondeva da sola** (segnalato
  da Simone). Era legata a `busy && !status`: appena in pagina c'era una bozza già caricata al
  passo 3 — cioè sempre, dalla seconda generazione in poi, e anche riaprendo la pagina con un
  lavoro in corso salvato in `localStorage` — sparivano barra, riga «sto generando» e persino lo
  spinner sul pulsante. Restava un pulsante fermo per minuti, che è il modo più veloce per far
  pensare che qualcosa si sia bloccato e ricaricare la pagina a metà lavoro. Ora la barra si
  mostra **sempre durante la generazione**. In più avanza anche **quando una variante finisce**
  (prima si aggiornava solo prima di partire, quindi si fermava a 11 su 12 e non arrivava mai al
  100%).

- `[Sviluppo]` **Profilo cliente — «La mia alimentazione»** (richiesta Simone 6/8). La cliente
  sceglieva tipo di alimentazione, pasti e regime in registrazione e poi non li rivedeva mai più:
  non sapeva nemmeno cosa stava seguendo. Ora nel Profilo c'è una scheda in **sola lettura** con
  tipo di alimentazione, pasti (o «Digiuno intermittente», con la finestra scelta), **dieta
  assegnata** e regime. Nuovo `GET /me/nutrition`.
  Il nome della dieta è quello da cui le stiamo **davvero servendo i menu** (ultimo giorno
  erogato), non quello che in teoria le spetterebbe: se i due non coincidono è un problema da
  vedere, non da nascondere dietro un'etichetta ottimistica.
  Non è modificabile di proposito — cambiarla cambia i menu, ed è una decisione clinica: dal
  backoffice serve già il permesso `change_diet_type`. Ma invece di un muro c'è la strada:
  «Chiedi un cambio alla coach», che apre la chat con lei, e il testo la chiama per nome quando
  l'assegnazione c'è. Le etichette dei tipi di alimentazione arrivano da `dietInfo.ts`, le stesse
  del "?" in registrazione: un nome solo per la stessa cosa.

- `[Sviluppo]` **Ricette: ogni intestazione ordina, ogni colonna ha il suo filtro, e c'è la colonna
  Stagioni** (richiesta Simone 6/8, dalla pagina Gestione dieta). Con la Keto-Mediterranea che da
  sola porterà centinaia di piatti, scorrere l'elenco a occhio non era più un modo di lavorare.
  Le otto intestazioni sono cliccabili (freccia su/giù) e sotto ognuna c'è il controllo giusto:
  testo per Nome e Tag, tendina per Regime, Pasto, Difficoltà, Stagioni e Stato, min/max per le
  Kcal. Il **pasto si ordina come nella giornata**, non in alfabetico — «Cena, Colazione, Merenda»
  sarebbe corretto e inutile. In alto il conteggio «N su M» con *Azzera filtri*.
  Nuova colonna **Stagioni**: le stagioni impostate come pastiglie, «Tutto l'anno» in grigio se
  vuote — così si vede a colpo d'occhio quali piatti non sono ancora stati stagionati, che è
  esattamente il buco da cui è passato lo spezzatino a luglio (voce #11).
  ⚠️ **Trovato per strada:** `listRecipes` tagliava a **200 ricette** senza dirlo. Filtrare e
  ordinare su una fetta del catalogo, credendo di lavorare su tutto, è peggio che non filtrare:
  tetto portato a **1000** e, quando viene toccato, la pagina lo scrive invece di far finta di
  niente. I filtri della barra in alto (ricerca, regime, pasto) sono spariti: erano gli stessi,
  ora stanno nelle colonne, e un filtro solo è meglio di due che si contraddicono.

- `[Prodotto]` **DECISIONE — su Mantenimento e Monitoraggio il nutrizionista prende 0%** (Simone,
  6/8), sia sul primo addebito sia sui rinnovi; sui percorsi 1/3/6 mesi il 15% resta. Aggiornati
  `progetto/Decisione_Provvigioni_Rinnovo.md` e `progetto/Prezzi_Finali_Provvigioni.md` (la
  domanda aperta dal 17/7 è sciolta). Rifatti i conti: con la sola coach al 45%, dodici mesi di
  una cliente in mantenimento lasciano **€326,67** con provvigione solo al primo addebito,
  **€183,12** con provvigione piena a ogni rinnovo, **€254,84** con la metà — il residual pieno
  passa da €131 a €183 e diventa un'ipotesi praticabile. Resta da decidere la sola quota coach.
  ⚠️ Emerso verificando: i due piani nascono dal seed **senza importi di provvigione**, quindi il
  default è 0 per tutti i ruoli — se in Negozio non sono mai stati compilati a mano, oggi il
  mantenimento non paga provvigioni nemmeno alla coach. Nel documento c'è il comando per
  controllarlo su Render prima di decidere.

- `[Prodotto]` **Provvigioni sul rinnovo: la decisione messa in chiaro, coi numeri veri** — è
  l'unico nodo che tiene ferma la voce #10 e con lei tutti gli abbonamenti ricorrenti. Nuovo
  `progetto/Decisione_Provvigioni_Rinnovo.md`: sul Mantenimento (€29/mese, coach 45% +
  nutrizionista 15%, ~€0,69 di Stripe) dodici mesi di una cliente lasciano a Metabole **€322 con
  la provvigione solo al primo addebito, €131 con la provvigione piena a ogni rinnovo, €227 con
  la metà** — quasi 200 euro di differenza per cliente fra la prima e la seconda ipotesi. Detto
  anche il rovescio di ciascuna: con zero sui rinnovi la coach continua a seguire quella cliente
  gratis, e le clienti in mantenimento sono proprio quelle che si perdono in silenzio. Due
  varianti aggiunte al tavolo: **residual a scadenza** (12 mesi, poi zero) e **provvigione solo a
  coach ancora assegnata**, che conviene comunque, qualunque opzione si scelga. Lato codice serve
  poco e tutto additivo: importi di rinnovo sul `Plan`, distinzione primo pagamento/rinnovo in
  `generateCommissions` (`billing_reason` arriva già da Stripe), un contatore se si sceglie il
  residual a scadenza. I pagamenti una-tantum in produzione non si toccano.
  Aggiornata anche la memoria di progetto (`metabole-riparti-qui.md`) allo stato di stasera.

- `[Prodotto]` **Guida al generatore per la nutrizionista** — Simone genera le 12 varianti
  Keto-Mediterranea dal backoffice invece che da script, usando la sessione come **formazione**.
  Nuovo `progetto/Guida_Generatore_KetoMediterranea.md`: la distinzione fra *definizione* e *dieta
  generata* (eliminarne una non elimina l'altra: è la trappola più comune), perché le varianti sono
  12 e non una, la sequenza dei tre passi, e soprattutto l'avvertenza sul pulsante *Valida e
  pubblica tutte* — segna gli **allergeni come verificati** per tutte le ricette, e quelli proposti
  sono indovinati dagli ingredienti, non revisionati. Il controllo va fatto prima. Segnalato anche
  che il generatore **non compila stagioni e difficoltà**: vuoto vale tutto l'anno, ed è
  esattamente ciò che a luglio produce lo spezzatino (voce #11).

- `[Sviluppo]` **Verifica di fine giornata sulle 18 voci del 5/8, e note di rilascio 2.1.**
  Controllate una per una contro il registro e il codice, non a memoria: **17 su 18 chiuse**.
  Fuori resta solo la **#10** (monitoraggio a pagamento dopo il mantenimento), bloccata dallo
  Stripe ricorrente e dalla decisione sulle provvigioni sul rinnovo. La **#2** (ingredienti Keto
  troppo difficili) è chiusa lato codice con la Keto-Mediterranea nel generatore: restano la
  generazione e la validazione della nutrizionista, che non bloccano la pubblicazione perché una
  dieta non approvata non la vede nessuna cliente. Nuovo `progetto/Note_Rilascio_2.1.md`: testo
  pronto per App Store e Play (entro i 500 caratteri di Play), sequenza della serata e i due
  promemoria che ci sono già costati un incidente — `aps-environment` a **production** prima
  dell'invio iOS, e **`OTA_VERSION` da svuotare** su Render dopo la pubblicazione.

- `[Sviluppo]` **Messa in lista: una card per prodotto e non per stile in registrazione**
  (decisione Simone, 6/8). Voce nuova in `metabole-backlog.md` con diagnosi e piano: oggi
  `GET /onboarding/diet-products` tiene **una dieta per stile**, quindi Vegana, Vegetariana,
  Flexitariana e Flessibile — tutte `flexible` — si vedono come una voce sola (18 famiglie in
  backoffice, 8 card nell'app). Non basta togliere il filtro: la registrazione salva `dietStyle` e
  il motore abbina per stile+regime+obiettivo+pasti, quindi due prodotti dello stesso stile e regime
  sarebbero indistinguibili e la cliente potrebbe ricevere l'altro. Serve salvare **quale prodotto**
  è stato scelto, con ricaduta sullo stile per le clienti già registrate: migrazione + verifica sul
  motore, non un lavoro da sera di pubblicazione. Aggiornato anche
  `progetto/Metabole_KetoMediterranea_Materia_Prima.md`: la dieta ora è nel generatore, il documento
  resta come riferimento sulla materia prima per la revisione della nutrizionista.

- `[Sviluppo]` **Keto-Mediterranea agganciata al generatore esistente** (richiesta Simone: «perché non
  agganci al generatore già creato?»). La dieta ora è una **dieta suggerita** dentro *Creazione e
  validazione*, come tutte le altre: `SUGGESTED_PRESETS` in
  `backend/src/engine-rules/engine-rules.presets.ts` con **12 varianti** — 2 regimi (onnivoro,
  vegetariano) × 2 obiettivi (dimagrimento 1500 kcal, mantenimento 1800 kcal) × 3 strutture pasti
  (3 pasti, 5 pasti, digiuno 16:8). Il capo nutrizionista la richiama, preme *Genera tutte le 12
  varianti* e poi *Valida e pubblica tutte*: stessa strada delle altre diete, nessun percorso
  parallelo. Il vincolo che dà senso al prodotto vive in `clinicalNotes`, che finisce dentro il
  prompt del generatore: chetosi < 50 g carboidrati, grassi di qualità (olio d'oliva, pesce azzurro,
  frutta secca, olive), **solo ingredienti da supermercato italiano** con l'elenco esplicito dei
  vietati-perché-introvabili (farine speciali, dolcificanti particolari, prodotti "keto"
  confezionati, olio MCT, proteine in polvere, addensanti) e la richiesta di ricette semplici.
  **Vegana esclusa di proposito**: senza legumi e senza derivati della soia da negozio specializzato
  non regge né sul fronte proteico né su quello della reperibilità — se servirà è un prodotto a sé.
  Il seeder dei preset ora confronta anche regime/obiettivo/pasti (prima solo stile+etichetta,
  e una famiglia con più varianti si sarebbe fermata alla prima) e scrive il campo `meals`.
  Aggiunta l'etichetta `keto_mediterranean` → «Keto-Mediterranea» nelle sei mappe che la usano
  (catalogo, taxonomy backoffice, regole motore, report di fine piano, email lifecycle, nome del
  percorso consigliato). ⚠️ **Superato lo script `seed:keto-med`**, rimosso: le ricette scritte a
  mano non passavano dal generatore, e due strade per creare la stessa dieta sono una di troppo.
  La variante che aveva già creato si chiama `Keto-Mediterranea (5 pasti)` — nome diverso da quello
  del generatore (`Keto-Mediterranea`), quindi non va in conflitto: è una bozza non visibile alle
  clienti e va semplicemente eliminata da *Catalogo diete*, per non lasciare due prodotti simili.

- `[Sviluppo]` **Registrazione: il "?" mancava su metà dei percorsi, e i nomi non erano quelli del
  backoffice** (segnalato da Simone con due schermate). Due cose diverse.
  *Il "?"*: la scheda informativa esisteva solo per mediterranea, proteica, low-carb e keto, quindi
  DASH, Flessibile, Detossinante, Vacanza estiva e Rientro estivo restavano senza spiegazione.
  Scritte le **cinque schede mancanti** con lo stesso criterio delle altre — cos'è, in pratica, cosa
  dice la ricerca, cosa tenere presente — e fonti **per scheda** dove servono altre fonti (NHLBI per
  la DASH; la revisione critica di Klein & Kiat per il Detox, che dice apertamente che le detox
  commerciali non hanno prove: la scheda lo scrive invece di nasconderlo). Aggiunta in
  `dietInfo.ts` la regola: ogni stile pubblicato deve avere qui la sua scheda.
  *I nomi*: l'app mostrava «Chetogenica», «Dash», «Rientro estivo» perché quelle diete non hanno un
  nome commerciale impostato e si ripiegava sul **codice stile**, mentre in backoffice le stesse
  diete si chiamano «Keto (non terapeutica)», «DASH (anti-ipertensiva)», «Ritorno in Equilibrio».
  Ora `GET /onboarding/diet-products` ripiega sul **nome vero della dieta** e solo in ultima istanza
  sullo stile: un nome solo, quello che la nutrizionista ha scritto.
  ⚠️ **Resta aperto**: la registrazione mostra **una card per stile**, non per dieta. Le famiglie che
  condividono lo stesso stile (Vegana, Vegetariana, Flexitariana e Flessibile sono tutte `flexible`)
  si vedono come una sola voce. Per separarle serve che la registrazione salvi *quale prodotto* è
  stato scelto e non solo lo stile — oggi il motore abbina per stile+regime+obiettivo+pasti. Da
  decidere insieme: non è una modifica da sera di pubblicazione.

- `[Sviluppo]` **`npm run prisma:seed` andava in out of memory su Render** — unico script del
  progetto senza `--transpile-only`: `ts-node` provava a fare il type-check dell'intero progetto in
  memoria e il container non ce la faceva («Reached heap limit»). Il seed quindi non girava, e i
  parametri nuovi (fra cui i sei `kcal_need_*`) non finivano mai in tabella. Aggiunto
  `--transpile-only` come negli altri script.

- `[Sviluppo]` **Keto-Mediterranea inserita nel catalogo come BOZZA** (voce #2, decisione Simone).
  Script `backend/prisma/seed-keto-mediterranea.ts` (`npm run seed:keto-med`): crea la dieta
  `keto_mediterranean` con **30 ricette** (6 per slot) e **7 giornate di rotazione su due livelli**
  (1450 e 1700 kcal), costruite solo con ingredienti da supermercato italiano — niente farine
  speciali, dolcificanti particolari o prodotti "keto" confezionati, che erano la causa della
  segnalazione. Tre criteri presi dalla ricerca e non inventati: grasso principale da olio d'oliva,
  olive, frutta secca e pesce grasso (Harvard: a parità di schema è la **qualità dei grassi** a
  cambiare gli esiti); proteine soprattutto da pesce e uova; verdure a basso contenuto di carboidrati
  in abbondanza, perché le fibre sono il punto debole noto delle chetogeniche. Ripartizione di
  riferimento ~70-75% grassi, ~20-25% proteine, ~5% carboidrati.
  ⚠️ **Nasce `status: draft` e `clientVisible: false`**: il motore serve menu solo da diete
  approvate, quindi **nessuna cliente la riceve** finché la nutrizionista non la approva dal
  backoffice. Le kcal e i macro sono stime coerenti fra loro, utili a far girare il motore ma da
  verificare; `allergensReviewed` resta **false** perché gli allergeni indicati sono quelli ovvi e
  non una revisione clinica. Lo script è idempotente e non sovrascrive il lavoro della nutrizionista.
  Stagioni e difficoltà già compilate piatto per piatto.

- `[Sviluppo]` **Keto-Mediterranea: preparata la materia prima per il catalogo** (voce #2). Il
  problema segnalato non erano le ricette lunghe ma gli **ingredienti introvabili** (farine speciali,
  dolcificanti particolari, prodotti "keto" confezionati). Invece di rattoppare la Keto esistente,
  idea di Simone: un prodotto NUOVO costruito solo su ingredienti da supermercato italiano.
  La combinazione ha una base in letteratura — esiste uno studio italiano su chetogenica mediterranea
  in pazienti con prediabete e diabete di tipo 2, e Harvard segnala che è proprio la **qualità dei
  grassi** a cambiare gli esiti a parità di schema: olio d'oliva, pesce azzurro e frutta secca invece
  di burro e insaccati. Nuovo documento `progetto/Metabole_KetoMediterranea_Materia_Prima.md` con la
  tavolozza di ingredienti per slot, l'elenco di cosa NON usare e i vincoli di inserimento.
  ⚠️ **Non contiene menu**: quelli li compone e valida la nutrizionista (regola ferrea n.1).
  Aggiunta anche la scheda informativa del "?" per lo stile `keto_mediterranean`, pronta per quando
  la dieta verrà pubblicata. **Non serve codice per crearla**: `dietStyle` è una stringa libera, la
  dieta compare da sola in registrazione appena è approvata e visibile al cliente.

- `[Sviluppo]` **Misure non inserite: menu fermo, solleciti ogni 2 ore, app bloccata e sblocco
  dalla coach** (voce #6). Il popup bloccante c'era già e tratteneva il menu, ma ci si conviveva.
  Ora il gate ha due livelli: il primo giorno resta il popup richiudibile; dopo
  `measures_lock_after_hours` (24) **l'app si blocca** con «Contatta la tua coach per sbloccare la
  app» — restando sempre possibile inserire le misure lì e ripartire subito. Nuovo cron **ogni due
  ore** (`/internal/cron/measures-nudge`, aggiunto a `render.yaml`): sollecita la cliente con un
  tono che cambia quando l'app è bloccata, e apre un'attività alla coach **una volta per ciclo**.
  Niente solleciti di notte (finestra 8-22, nei parametri). La coach riapre dalla scheda cliente:
  `POST /staff/clients/:id/measures-unlock` concede una **finestra di grazia a tempo**
  (`measures_unlock_hours`, 48) e non un interruttore permanente — uno sblocco senza scadenza
  equivarrebbe a spegnere la regola per sempre, e nessuno si ricorderebbe di riaccenderla.
  **Flag `is_store_reviewer`**: sugli account dei recensori di Apple e Google il blocco non scatta
  mai. Se si trovassero davanti a un muro rifiuterebbero la pubblicazione.

- `[Sviluppo]` **Motore — stagionalità delle ricette** (voce #11: una cliente si è vista proporre
  lo **spezzatino a luglio**). Nel sistema non esisteva alcuna nozione di stagione: il motore non
  aveva modo di saperlo. Nuovo campo `recipe.seasons`. **Scelta di progetto (Simone, 6/8): la
  stagione sta sulla RICETTA, non sull'ingrediente** — un catalogo degli alimenti coi mesi di
  raccolta sarebbe più preciso ma richiede di classificare centinaia di voci prima di vedere un
  beneficio, mentre il piatto lo si giudica a colpo d'occhio ed è quello che la cliente vede.
  **Regola morbida**: fuori stagione il piatto è penalizzato nel punteggio (`menu_penalty_season`,
  default 0.5), non escluso — con un catalogo da classificare escludere lascerebbe buchi, e un
  piatto fuori stagione è meno grave di una cena mancante. Vuoto = tutto l'anno, quindi finché
  nessuno classifica nulla **il comportamento non cambia**. Stagioni meteorologiche e non
  astronomiche: a fine giugno il calendario direbbe ancora primavera, ma nessuno cucina lo
  spezzatino. Selettore nel backoffice, sulla scheda ricetta.

- `[Sviluppo]` **Registrazione — un "?" accanto a ogni tipo di dieta** (voce #5). Popup che spiega
  il *modo di mangiare*, non quello specifico percorso: cos'è, cosa cambia in pratica, cosa dice la
  ricerca, cosa tenere presente. Testi da fonti istituzionali — **Harvard T.H. Chan School of
  Public Health (The Nutrition Source)** e **Mayo Clinic** — e non promozionali: per ogni stile si
  dice anche il rovescio della medaglia (l'adattamento delle prime settimane nella low-carb, le
  controindicazioni della keto in gravidanza e con problemi renali, la qualità delle fonti
  proteiche), niente promesse e niente numeri di chili. Testi in `app/src/onboarding/dietInfo.ts`,
  con in testa le regole da rispettare per aggiungerne.

- `[Sviluppo]` **Motore — quando lo stile scelto non è disponibile, adesso si sa** (seconda metà
  della #5: «intanto me la devi applicare»). `pickDiet` ha una catena di ripieghi che, se per lo
  stile richiesto non esiste una dieta approvata, ne serve una di un altro stile: meglio un menu
  che nessun menu, ma finora succedeva **in silenzio** — si sceglieva Keto e arrivava Mediterranea.
  Ora resta traccia (log + evento `diet_style_fallback`), così il buco di catalogo si vede.

- `[Sviluppo]` **App — «Porta un'amica» in Home, col foglio di condivisione nativo** (voce #13).
  `GET /me/referral` esisteva già e generava il codice, ma nell'app **non c'era nessun posto in cui
  vederlo**: l'invito funzionava solo se qualcuno ti dettava il codice a voce. Card sotto i
  quadrotti, con codice, conteggio inviti e pulsante Condividi. Nuovo plugin `@capacitor/share`
  (⚠️ **nativo**: richiede una build store) e `lib/share.ts` con tre strade — foglio nativo su app,
  `navigator.share` sui browser che lo supportano, copia negli appunti sul desktop.

- `[Sviluppo]` **Posta — inviata e cestino** (voci #12 e #17). La posta inviata era già servita da
  `GET /me/mailbox/sent` ma nel backoffice nessuno la chiedeva (nell'app staff c'era già). Aggiunte
  le schede Ricevuta/Inviata e il **cestino** sui messaggi ricevuti, in backoffice e nell'app della
  coach. Nuovo `DELETE /me/mailbox/message/:uid`: **non cancella davvero**, sposta nella cartella
  cestino del server. Su una casella condivisa fra operatrici un pulsante che distrugge sarebbe un
  rischio. Se il server rifiuta lo spostamento si ripiega sul flag `\Deleted`.

- `[Sviluppo]` **Email credenziali — pulsanti «Scarica su App Store» e «Scarica su Google Play»**
  (richiesta Simone 6/8, voce #18). Nuovo segnaposto `{storeButtons}` (nei modelli editabili dal
  backoffice: `{{storeButtons}}`), disponibile anche se il testo viene riscritto da lì. Gli URL
  stanno in `config_param` (`app_store_url`, `play_store_url`) e non nel codice: gli store cambiano
  indirizzo e non deve servire un deploy per correggerli. Sono pulsanti di **testo** e non i badge
  ufficiali a immagine, perché quasi tutti i client di posta bloccano le immagini remote finché non
  le sblocchi a mano — e un badge invisibile non lo clicca nessuno.

- `[Sviluppo]` **Onboarding — si chiede il livello di attività fisica** (voce #15). Finora si
  chiedeva soltanto «che lavoro fai?», da cui il fabbisogno calorico ricavava un fattore
  approssimato; chi non passava dal Profilo restava col default 1,4. Fra sedentaria e molto attiva
  ballano 700-900 kcal al giorno: era l'input che sposta di più il risultato, ed era l'unico tirato
  a indovinare mentre peso, altezza ed età erano dati veri.

- `[Sviluppo]` **Seed — i sei parametri del fabbisogno calorico** (voce #16, chiude anche la voce 2
  dell'audit). `kcal_need_floor_female/male`, `deficit_max_pct`, `deficit_max_kcal`, `kcal_per_kg`,
  `default_deficit_pct` erano costanti nel codice: funzionavano, ma dal backoffice non si potevano
  toccare e nessuno sapeva che esistessero. Ora sono in `config_param` con una descrizione che
  spiega cosa fanno.

- `[Sviluppo]` **Motore/App — digiuno intermittente: la cliente sceglie quali pasti saltare, e la
  giornata 20-4 una volta a settimana** (feedback clienti 5/8, voce #7). Finora scegliere «digiuno
  intermittente» selezionava soltanto le diete marcate `fasting`: la finestra alimentare la decideva
  il template del nutrizionista e la cliente non aveva voce in capitolo — ma saltare la colazione o
  saltare la cena sono due vite diverse. Nuovo campo `client_profile.fasting_window`
  (`skip_breakfast` | `skip_breakfast_lunch` | `skip_dinner_breakfast`, NULL = comportamento storico,
  quindi nessuna cliente esistente cambia menu da un giorno all'altro). Gli slot saltati escono
  **prima** della composizione della giornata, non dopo: così il target calorico si ridistribuisce
  sui pasti rimasti invece di lasciare un buco. Lo spuntino del mattino segue sempre la colazione
  (uno spuntino alle dieci riaprirebbe la finestra). Rete di sicurezza: se il filtro svuotasse la
  giornata viene ignorato — meglio un digiuno impreciso che una cliente senza niente da mangiare.
  La domanda compare in onboarding **solo** a chi sceglie il digiuno: per farlo è nato un supporto
  generico ai campi condizionati (`showIf` nello schema del questionario) al posto dell'unico caso
  scritto a mano; i campi nascosti non bloccano più l'avanzamento. La finestra è modificabile anche
  dal Profilo e dal backoffice. Una volta a settimana parte il suggerimento della **20-4**, spiegato
  per esteso nel messaggio (venti ore di digiuno, un solo pasto completo, si beve normalmente, si
  può saltare) e non inviato a chi è in pausa né a chi salta già colazione e pranzo, perché la sta
  già facendo.

- `[Sviluppo]` **Email di lifecycle — `{{primoPasto}}` diceva sempre «colazione»** (voce 1
  dell'audit, segnalata da una cliente). Il controllo guardava `regime`, che vale
  omnivore/vegetarian/vegan/pescetarian: il confronto con `intermittent_fasting` era **sempre
  falso**, quindi a ogni cliente in digiuno le email dicevano di partire proprio dal pasto che salta.
  Ora legge `pathType` e tiene conto della finestra scelta: chi salta colazione e pranzo riparte
  dalla cena, chi salta cena e colazione dal pranzo. Aggiunti i due campi alle query, che non li
  selezionavano.

- `[Sviluppo]` **App/Backend — check-in solo con un piano attivo, e con energia, fame e stress**
  (feedback clienti 5/8, voce #1). `GET /me/today` restituisce ora `hasActivePlan` e `checkinDue`:
  la regola sta nel dominio e non sparsa nel frontend, e a piano scaduto o mai comprato il popup
  «Come ti senti oggi?» non compare più — era una domanda senza seguito, che a una cliente senza
  percorso suonava come un richiamo. Durante una **pausa** il piano resta attivo, quindi il check-in
  continua: è voluto, è l'unico filo teso mentre i menu sono sospesi. Il popup è diventato a due
  passi: primo tap sull'umore come prima (l'abitudine non cambia), poi tre scale 1-5 per **energia,
  fame e stress** con gli estremi scritti a parole. Erano campi già previsti da schema e DTO ma
  quasi sempre vuoti, perché nessuno li chiedeva.

- `[Sviluppo]` **Doc — `progetto/Metabole_Piano_Stripe_Ricorrente.md`** — piano del 20/7 per gli
  abbonamenti ricorrenti, ritrovato e messo nel repo con una nota di verifica: `stripe.service.ts`
  usa tuttora `mode: 'payment'`. È il prerequisito della voce #10 (monitoraggio a pagamento dopo il
  mantenimento). ⚠️ Decisione aperta e delicata: le **provvigioni sul rinnovo** (oggi si generano su
  ogni pagamento approvato, quindi col ricorrente si pagherebbero piene ogni mese).

- `[Sviluppo]` **App — header verde davvero fisso, grafici scorrevoli, card obiettivo col segno giusto**
  (feedback clienti 5/8, voci #8 #9 #14). La causa dell'header non era il `top` dello sticky: `.screen`
  aveva `overflow-y:auto` ma `.app-frame` ha `min-height` (non `height`), quindi `.screen` cresce col
  contenuto e non scorre mai — restava un contenitore di scorrimento fermo a cui l'header si ancorava,
  mentre a scorrere era la finestra. Tolto `overflow-y` da `.screen` e `top: 0` sull'header (era negativo).
  Riprodotto e verificato in Chromium con notch simulato. I grafici: con una sola metrica misurata c'era
  un solo grafico e niente da scorrere, ma la scritta «scorri i grafici» compariva lo stesso; ora appare
  solo con più di un grafico, i pallini sono diventati pulsanti e su desktop compaiono due frecce
  (nuovo `CarouselNav.tsx`). Card «Verso il tuo obiettivo»: i movimenti si stampano col segno esplicito
  (`+1,0 di -6,0 kg`) invece di anteporre un `-` fisso che col peso in aumento produceva `--1,0`; quando
  la misura va contro l'obiettivo la barra si colora e compare una riga di contesto invece di uno 0% muto.

- `[Sviluppo]` **CI «Android APK (debug)» verde per la prima volta** — era rossa da sempre.
  `checkDebugAarMetadata` falliva perché `androidx.work` richiede compileSdk 35+ e il progetto era a 34:
  il workflow rigenera `android/` da zero con `cap add android` (template Capacitor 6) ma non lanciava
  `npm run android:play`, cioè lo script che porta compile/target a 36, minSdk a 23, AGP a 8.9.1 e
  Gradle a 8.11.1. Aggiunta la riga mancante. *Lezione: ogni `install-*.mjs` che patcha il progetto
  nativo va ripetuto in CI, perché lì la cartella nasce vuota a ogni run.*

- `[Sviluppo]` **Sicurezza — chiave APNs privata trovata nel repo PUBBLICO** — `AuthKey_PV537G937B.p8`
  (Team Scoped, valida per tutte le app del team) era committata dal 28/7 e scaricabile da chiunque.
  Chiave revocata e sostituita con una **Topic Specific** su `app.metabole` (Key ID `RB5M26KTPU`),
  caricata su Firebase e tenuta in `~/MetaboleKeys`. File tolto dall'indice; `.gitignore` ora blocca
  `*.p8 *.p12 *.mobileprovision *.keystore *.jks`.

- `[Sviluppo]` **Push iOS: non hanno MAI funzionato dalla 2.0 — causa trovata e corretta** —
  `AppDelegate.swift` non conteneva né `didRegisterForRemoteNotificationsWithDeviceToken` né
  `didFailToRegisterForRemoteNotificationsWithError`. `install-ios.mjs` li cablava con una `replace()`
  su un metodo preesistente: non trovandolo non sostituiva nulla e **non protestava**, stampando
  comunque «Firebase configurato». Così l'app chiedeva il permesso, chiamava `register()`, iOS
  consegnava il token — e non c'era nessuno ad ascoltare: né evento `registration` né errore.
  Ora lo script **inserisce** i metodi se mancano, aggiunge la gestione degli errori e **rilegge il
  file** verificando il risultato, uscendo con errore se il cablaggio non è completo. Verificato:
  la push arriva sull'iPhone. ⚠️ Correzione **nativa**: per le clienti serve una nuova build store.

- `[Sviluppo]` **Strumenti di diagnosi delle push** (nati dall'indagine, restano utili) —
  pulsante **«Push di prova»** nella scheda cliente del backoffice (solo admin,
  `POST /admin/push-test/:userId`): manda un ping ignorando preferenze e il limite «una al giorno»,
  elenca i dispositivi con l'errore di ciascuno e dà una diagnosi in italiano. `push.ts` non ha più il
  listener vuoto: manda il motivo del fallimento a `POST /me/push-tokens/error` (salvato come
  `AnalyticsEvent`, nessuna migrazione) e traccia ogni passo di `initPush`.

- `[Sviluppo]` **OTA — due guardie in `ota-release.mjs` dopo altrettanti incidenti** — (1) senza
  `app/google-services.json` il build riesce ma Vite elimina tutto il codice di registrazione push:
  un OTA così **spegne le push** su ogni telefono che lo riceve, in silenzio; (2) Capgo confronta la
  **stringa** di versione, non il contenuto, quindi ripubblicare un bundle diverso con lo stesso numero
  non raggiunge chi ha già scaricato quel numero — il 6/8 sono usciti tre bundle diversi tutti come
  «2.0.1». Ora lo script si rifiuta di costruire in entrambi i casi.

- `[Sviluppo]` **Repo spostato fuori da iCloud** → `~/Progetti/Metabole`. iCloud teneva i file come
  segnaposto vuoti e corrompeva `.git`. Aggiornati `build-ios.sh`, `build-aab.sh`, `build-apk.sh`, che
  puntavano tutti alla vecchia cartella.

- `[Sviluppo]` **Motore — sorveglianza durante la pausa vacanza** (feedback clienti 5/8, voce #3).
  Finora la pausa sospendeva i menu e spostava la scadenza, ma per tutta la sua durata nessuno chiedeva
  il peso e la coach non sapeva nulla: una cliente poteva sparire per novanta giorni. Il modulo
  `monitoring` faceva già questa vigilanza ma è riservato a chi NON ha un piano attivo, quindi durante
  una pausa era escluso per costruzione. Aggiunti tre campi a `pause_request` (peso di riferimento,
  ultimo promemoria, avviso coach) e un giro giornaliero nel cron: fissa il riferimento all'inizio,
  chiede una pesata ogni `pause_watch_ask_days` (5) con tono da vacanza, e se il peso supera
  `pause_watch_regain_kg` (2) crea un'attività per la coach e la avvisa, **una volta sola per pausa**.
  Nessuna proposta commerciale, per decisione esplicita: la cliente è in vacanza e ha già pagato.

- `[Sviluppo]` **Dato di produzione — piano Mantenimento riparato** — «Mantenimento Metabole» aveva
  `period = 1m` (cambiato il 18/7): per il backend il mantenimento non esisteva, quindi compariva nello
  shop a tutte, il riquadro nel report non appariva, il monitoraggio non si sbloccava. Rimesso a
  `maintenance` dal Negozio, `diag:mantenimento` ora ✓. Zero abbonamenti coinvolti.

## 2026-07-15

- `[Sviluppo]` **Sito — separatore delle migliaia su tutti i contatori** — `fmtN` ora forza il
  raggruppamento (`useGrouping:'always'`): l'italiano per standard CLDR non separa i numeri a 4 cifre
  (6729 restava senza punto mentre 86.310 lo aveva). Ora 6.729+ / 86.310+ in tutte le 9 lingue, con
  fallback regex per browser datati. Solo `Metabole_Sito_Presentazione.html`, da ripubblicare su SiteGround.

- `[Sviluppo]` **Sito — descrizioni card percorsi a 4 righe con "…" e click per espandere** — le note
  cliniche lunghe non allungano più le card: CSS line-clamp a 4 righe con ellissi; click/tap sulla
  descrizione la espande (e richiude). Solo `Metabole_Sito_Presentazione.html`, da ripubblicare su SiteGround.

- `[Sviluppo]` **Sito — contatore "percorsi gestiti" e carosello collegati al catalogo Diete** —
  `GET /public/paths` ora restituisce le diete **APPROVATE** del catalogo (status `approved`, una card
  per dieta, senza dedup per stile) invece delle sole `clientVisible` raggruppate per stile;
  `GET /public/stats.methods` conta le stesse → il numero sulla home cresce quando il nutrizionista
  approva una nuova dieta, senza deploy del sito. Aggiunto alias `desc` accanto a `description` nel
  payload (il carosello del sito legge `p.desc`: ora le card mostrano anche la descrizione).
  **Sotto il nome, in piccolo: note cliniche** — se la dieta non ha una descrizione cliente, la card
  mostra le `clinicalNotes` del RulePreset dello stesso stile (adottati prima dei suggeriti);
  la descrizione cliente, quando compilata, vince. Nuovo campo `clinicalNotes` nel payload.
  Test: + fallback note cliniche.

## 2026-07-14

- `[Sviluppo]` **Modelli email — anteprima renderizzata** — l'editor dei modelli ora mostra l'email **renderizzata** (iframe isolato, come i PDF) con i segnaposto sostituiti da valori d'esempio, e un interruttore **Anteprima / Codice HTML**; finestra più larga, oggetto in anteprima, elenco segnaposto rilevati dal testo. Prima si vedeva solo l'HTML grezzo (inutilizzabile).

- `[Sviluppo]` **Regole motore — generatore AI di catalogo (bozza) dai preset** — su ogni regola suggerita un pulsante **‘Genera catalogo’**: l'AI (Claude) produce **ricette per pasto** (ingredienti, kcal, macro, cotture), **giornate bilanciate**, **gruppi di equivalenza** (alternative) e **pre-tag allergeni** (dagli ingredienti), coerenti con stile/regime/bande del preset. Tutto in **BOZZA e non attivo**: crea una dieta `draft`, ricette `active:false` con allergeni `da confermare` → il nutrizionista rivede/approva (R7) e conferma gli allergeni (R8) prima che il motore le usi. Endpoint `POST /engine-rules/presets/:id/generate-catalog`; `AiService.generateJson`. Serve `AI_API_KEY` su Render. Test +2. ⚠️ v1: la qualità di kcal/macro/ricette va riverificata dal nutrizionista.

- `[Sviluppo]` **Catalogo — tasto Elimina per diete e ricette** — aggiunto il pulsante Elimina in **Catalogo diete**, **Catalogo ricette** e **Allergeni** (le ultime due eliminano la ricetta). Backend: `DELETE /diets/:id` (rimuove giorni+regole; **bloccato** se la dieta è usata in menu già erogati) e `DELETE /recipes/:id` (rimuove anche valutazioni e pesi appresi), con audit; riservati a nutrizionista/capo nutrizionista.

- `[Sviluppo]` **Utenti — scheda cliccabile con anagrafica + reset password** — cliccando l'email in Utenti si apre `/utenti/:id`: avatar, ruolo/stato, **nome mostrato, nome, cognome, telefono, titolo, indirizzo (`addressLine`+`country`), codice referral**, modificabili dall'admin, con il **Reset password** in scheda. Backend: `UpdateUserDto` esteso all'anagrafica, `update()` applica i campi (+ `Staff.displayName`), `PUBLIC_USER_SELECT` include indirizzo/paese.

- `[Sviluppo]` **Email ciclo di vita — 45 modelli nel backoffice** — caricati nel sistema **Modelli email** i **45 modelli** del ciclo di vita/marketing (attivazione, conversione carrello+nurture, retention/onboarding, **12 email per evento**, rinnovo T7/T3/T1+upsell, win-back, transazionali nuove, consensi) dalla copy di `marketing/Metabole_Email_Ciclo_Vita.md` — **editabili dal backoffice** e inviati via Brevo. `prisma/seed_email_marketing.ts` (HTML email-safe, merge tag {{nome}}/{{piano}}/{{evento}}/…, footer preferenze, no claim medici/no numeri di peso); seed **idempotente** (crea se assente, non tocca subject/body già editati). In **italiano** per ora (modello mono-lingua; per il multilingua andrebbe aggiunta la lingua alla tabella). Restano da agganciare gli **inneschi** (eventi immediati facili; le sequenze a tempo con un job giornaliero).

- `[Sviluppo]` **Regole motore — le 12 regole base sotto le regole globali** — aggiunta in cima al tab *Regole globali* la sezione di riferimento con le **12 regole del Metodo del Motore Intelligente**: Fase A (R1–R7, costruzione base = nutrizionista+strumenti) e Fase B (R8–R12, agente AI del percorso). Sola lettura; i parametri fini che le regolano restano negli interruttori sotto. Backend: `BASE_RULES` nel catalogo + nel payload `/engine-rules/catalog`.

- `[Sviluppo]` **Admin — reset password utenti + interruttore seed demo** — ① l'admin può **resettare la password di qualsiasi utente** dalla pagina Utenti (icona chiave): genera una password **provvisoria** (o ne accetta una fornita), obbliga il cambio al primo accesso, **revoca le sessioni attive** e la mostra una volta sola (endpoint `POST /admin/users/:id/reset-password`; la password non finisce mai nei log). Test +2. ② Interruttore **`SEED_DEMO=false`** (variabile d'ambiente Render): ai deploy successivi il seed **non reinserisce** i dati demo (dieta demo, catalogo Keto, piani/prodotti demo, testimonianze); le strutture (permessi, pipeline, gruppi di equivalenza, preset regole, template) restano sempre seminate. Utile dopo la pulizia pre-lancio.

- `[Sviluppo]` **Script di pulizia dati test/demo (reset pre-lancio)** — `backend/prisma/cleanup-demo.ts` (+ `npm run cleanup:demo`): cancella i dati OPERATIVI (lead, clienti, calendario, visite, segnalazioni, chat, acquisti, bonifici, provvigioni, compensi, catalogo diete + tutto il collegato ai clienti: menu, misure, check-in, abbonamenti, notifiche…) **tenendo** staff, config_param, permessi/ruoli, pipeline, gruppi di equivalenza, regole/preset del motore, piani/prodotti, buoni sconto, template email/PDF, testimonianze, caselle staff. **Anteprima di default** (conta soltanto e mostra cosa resta); cancella solo con `METABOLE_CLEANUP_CONFIRM=SI-CANCELLA`, in **una transazione unica** (se un vincolo blocca → rollback totale, nessuna cancellazione parziale). ⚠️ Da lanciare su Render **dopo un backup/branch del DB Neon**. NB: gli 86k lead importati non sono ancora a DB, quindi non vengono toccati.

- `[Sviluppo]` **Regole motore — permesso abilitabile al nutrizionista + PDF istruzioni** — aggiunta l'etichetta ‘Regole motore’ nella tabella permessi (prima compariva senza nome) e la guardia backend ora ammette il ruolo `nutritionist` così che il capo/admin possa **abilitarla dalla tabella permessi**. Di default resta spenta per il nutrizionista; la voce compare nei Permessi **dopo il prossimo deploy** (all'avvio `syncDefaults` crea la riga per la nuova pagina). Preparato **`Metabole_Istruzioni_Nutrizionista.pdf`** (ruolo, home, allergeni/gruppi di equivalenza/grammature, sicurezza ed esclusioni, chat/segnalazioni, cartella clinica, pagina Regole motore per il capo, regola bigiornaliera).

- `[Sviluppo]` **Chat — instradamento segnalazioni sensibili (decisione socio)** — al **nutrizionista** solo i temi MEDICI (sintomi fisici, gravidanza, terapie farmacologiche → categoria `clinical`); tutto il resto emotivo/comportamentale (immagine corporea, umore, abbuffate, condotte di eliminazione, digiuno) va alla **coach** come `mood_risk` — è lei il primo filtro e inoltra al nutrizionista se serve. `ai-filter` sdoppiato (MEDICAL vs BEHAVIORAL), `chat.service` instrada categoria + notifica + assegnazione al professionista giusto. Test chat aggiornati (medico→nutrizionista, emotivo→coach).

- `[Sviluppo]` **Regole motore — override per dieta letto dal motore + audit dashboard** — il motore ora legge gli **override PER DIETA** (ProductRule) per tutti i parametri numerici di scoring/macro (efficacia, gradimento, penalità varietà, tolleranza kcal, banda proteica…), non solo per gli interruttori bigiornaliera/DayCombo; globale come fallback. Test +2. Inoltre **verifica di copertura**: tutte le 28 sezioni del backoffice hanno link a menu, voce nei permessi e **modulo dashboard** — aggiunti i moduli mancanti (ricette, protocolli, regole motore, parametri, modelli/log email, grafica PDF, utenti, ruoli, log), il link ‘Import liste’ nel menu CRM e corretto il modulo ‘Lead da accettare’ sulla chiave `lead_acceptance`.

- `[Sviluppo]` **Regole del motore — pagina del capo nutrizionista + regole suggerite per nutrizione** — nuova sezione `/regole-motore` (permesso `engine_rules`, **solo head_nutritionist**; admin in lettura): ① **regole globali** — catalogo di ~20 parametri del motore, modificabili e attivi subito (config_param); ② **regole base suggerite per tipo di nutrizione** — 14 preset fondati sulla letteratura (5 stili + DASH, Mediterranea ipocalorica, Iperproteica sportiva, Vegetariana, Vegana, Pescetariana, Flexitariana, Basso IG, Digiuno intermittente 16:8) col **flag “suggerita”**, modificabili/aggiungibili e **applicabili a una dieta** (→ ProductRule); ③ **proposte** di regole nuove (testo → sviluppo). Backend: modulo `engine-rules` (catalogo in codice + service/controller/test), modello `RulePreset` + `RuleProposal.dietId` opzionale (mig `20260714270000`), seed dei 14 preset. Modulo dashboard per il capo nutrizionista. Test +7. ⚠️ Le regole **globali** numeriche sono già lette dal motore; l’override **per dieta** è persistito e attivo per gli interruttori (bigiornaliera, DayCombo) — estendere il consumo per-dieta agli altri numerici è un piccolo follow-up. Regole cliniche come cap carboidrati (g), IG, g/kg, sodio richiedono nuovi parametri: elencate nelle note dei preset e proponibili.

- `[Sviluppo]` **Motore R12 — mantenimento a efficacia ridotta (non zero)** — `menu_maintenance_w_eff` portato da 0 a **0,1** (decisione socio: in mantenimento l’efficacia pesa poco ma non è ignorata; a gradimento più alto vince il gusto). Test R12 aggiornati. ⏳ In sospeso il routing delle segnalazioni sensibili in chat (oggi tutte → nutrizionista/clinico): il socio deve confermare se i temi **emotivi** vanno alla coach (`mood_risk`) tenendo i **red-flag medici** (dolore al petto, farmaci, gravidanza) al nutrizionista.

- `[Sviluppo]` **Backoffice — lettura email leggibile** — la posta in arrivo mostra il messaggio **formattato**: se la mail ha l’HTML lo rende in una cornice isolata e sicura (sandbox, niente script, link in nuova scheda), con intestazione mittente pulita (nome + indirizzo) e finestra più larga; per le mail solo-testo, URL cliccabili e tolte le parentesi quadre del formato testo. File: `Posta.tsx`, `ui.tsx` (Modal `wide`).

- `[Sviluppo]` **CRM — codice fiscale e indirizzo su lead/cliente + arricchimento del file d'import** — aggiunti i campi `codiceFiscale` e `address` a `CrmRecord` (migrazione `20260714260000`, entrambi opzionali). Sono modificabili dalla **scheda lead** (con CF in maiuscolo automatico) e vengono letti dall'**import liste** (nuove colonne `codice_fiscale`/`address` del CSV; scritti solo se presenti → re-import idempotente, non cancella un dato già salvato). Dai 6 file clienti storici (Uniti/Dimagriamo/Nutriamo/Mosaico; Nutrilab e Attivi-2024 non contengono i dati reali) ho estratto **8.563 codici fiscali validi** e **6.503 indirizzi**, agganciati al file `Metabole_Import_Pronto_v2.csv` (86.309 righe) per telefono/email. ⚠️ Il file arricchito ha dati personali → **fuori dal repo** (consegnato in chat). Test import +2 (CF normalizzato / campi assenti non scritti); backoffice type-check 0 errori.

- `[Sviluppo]` **Motore — regola "ripetizione bigiornaliera" (`menu_repeat_two_days`, per dieta, OFF di default)** — nuova `ProductRule` che il nutrizionista può attivare su una dieta: quando è ON, il 2° giorno del ciclo ripropone **gli stessi alimenti** del 1° giorno ma con una **ricetta/preparazione diversa** scelta dal motore (la "gemella") — stesso gruppo di equivalenza approvato e kcal in banda (`repeat_twin_kcal_tolerance_pct`, default 15%); a parità sceglie la ricetta col punteggio efficacia+gradimento migliore. Se per un pasto non esiste una gemella, resta il pasto già composto (decisione socio). **Salvaguardia**: la regola è inerte finché il nutrizionista non approva i gruppi di equivalenza (senza gruppi → nessuna gemella → comportamento invariato). Nessun redeploy per accenderla (toggle per dieta). Seed: +2 config_param (`menu_repeat_two_days_default`=false, `repeat_twin_kcal_tolerance_pct`=15). Test menu +3 (OFF/ON/ON-senza-gruppi) verdi; suite menu 40/40 in sandbox (transpile-only, stub Prisma).

- `[Prodotto]` **Sito — sezione app: 4 schermate REALI dal prototipo** (`Metabole_Sito_Presentazione.html`) — sostituito il mockup CSS del telefono con **4 screenshot reali** dell'app presi dal prototipo (`marketing/vignette/app-screens/`: Home, Percorso, Obiettivi, Contatti). Le immagini hanno già la cornice device, quindi tolta la cornice CSS `.phone`; galleria swipe (frecce/puntini/caption) mantenuta. Immagini **ottimizzate e incorporate in base64** (~287 KB totali, file ~432 KB) così restano nel singolo HTML e funzionano al deploy su SiteGround senza upload separati. → da rideployare.

- `[Prodotto]` **Sito — restyling a box uniformi + ® + pulizia** (`Metabole_Sito_Presentazione.html`) — riorganizzato tutto il sito con **sistema a box annidati** e **gerarchia grafica uniforme** a 3 livelli: sezione (bianca, raggio 24), pannello/gruppo (tinta unica #F6FAF8, raggio 18, niente gradienti/ombre), card (bianche, raggio 14). Rimossi gradienti e raggi/ombre incoerenti su recall/cult/feat-art/lead-person/lead-band/app; unificate le fasce band/final solo nel raggio (testo/bg invariati). **Hero invariato.** Box numeri con sottotitolo **"L'esperienza"** (9 lingue) + i 4 dati in un box interno. Rimossa la sezione **"Un giorno con te"**. Aggiunta **® al logo MetaboleAI®** (header e footer). → da rideployare per vederlo live.

- `[Prodotto]` **Sito — galleria app sfogliabile + dicitura contatori con 3 prodotti** (`Metabole_Sito_Presentazione.html`) — (1) la sezione app ora ha una **galleria swipe** (frecce + puntini + caption, touch/scroll-snap, no immagini esterne) con **4 schermate inline**: Home (misure/proposta), Percorso (menu giorno 1 e 2 con cottura diversa), Obiettivi (progressi + cambia obiettivo), Contatti (Gaia + coach + nutrizionista). (2) Dicitura contatori aggiornata in tutte le 9 lingue con l'elenco prodotti esteso: **"tra cui Nutriamo, Dimagriamo, Nutrilab"**. → da deployare per vederle live.

- `[Sviluppo]` **Go-live: Stripe LIVE configurato, sito ripubblicato, pulizie repo** — ① Stripe in modalità live: chiave `sk_live` dedicata e destinazione evento con solo `checkout.session.completed` → `/api/v1/payments/webhook`; `STRIPE_SECRET_KEY`+`STRIPE_WEBHOOK_SECRET` aggiornati su Render, redeploy verificato (nessun prodotto/prezzo in Stripe: il checkout usa `price_data` inline col prezzo del piano dal DB). Resta il pagamento reale di prova nello smoke test. ② `index.html` ripubblicato su SiteGround 1:1 dal repo (nuova dicitura contatori + fallback; lo snippet favicon ormai è nel repo, niente più delta) e cache dinamica svuotata. ③ Pulizie: creato `app/.env.example` (VITE_API_URL), rimosso il backup `backend/prisma/schema_1.prisma`.

- `[Sviluppo]` **Contatori sito con base storica Mosaico** (`/public/stats`, commit `76c0cbf` — voce ripristinata, era andata persa in un risanamento conflitti del diario) — `publicStats()` somma la base storica ai conteggi reali: `clients = stats_clients_base (18.979) + abbonamenti attivati`, `reached = stats_reached_base (85.218) + lead CRM`, `years` da `site_stats_years` (20); parametri in config_param via seed (upsert, gira ad ogni deploy), rimossi gli override assoluti `site_stats_clients/reached`, test aggiornati. **Verificato live**: `{clients:18983, reached:85232, methods:4, years:20}`; home del sito mostra "18.983+ / 85.232+".

- `[Sviluppo]` **Liste CRM Fase B — import liste storiche + campo telefono + fix layout** — ① campo `phone` sul lead CRM (mig. `20260714250000`, + indici su phone/email) come **seconda chiave** insieme all'email. ② Import: `POST /crm/leads/import` (solo admin, a lotti, con `dryRun` per l'anteprima), match/dedup su **telefono O email** (aggiorna se già presente, mai doppioni), **crea da sé le liste mancanti**, assegna la coach se il refcode combacia. UI `/crm/import` (pulsante "Importa" in Gestione lead): carica il CSV, anteprima "creati/uniti/coach/nuove liste", import a lotti con barra. Test +2. ③ Fix layout: a barra nascosta il contenuto usa tutta la larghezza (`.app-shell.nav-closed .content`), così le tabelle larghe non restano tagliate. ④ **ETL una-tantum** (fuori dal repo, dati personali): dai 2 file del socio → `Metabole_Import_Pronto.csv` (**86.309 persone** deduplicate per telefono/email, con liste, stato precedente, `Valore`→totale pagato, coach da Referrer con refusi 01/1 e VITA01→Vita gestiti) + `Metabole_Lead_Senza_Contatto.xlsx` (8.328 senza chiave, esclusi). Type-check app+backoffice 0 errori; suite CRM 17/17.

- `[Sviluppo]` **Backoffice — permessi completi, moduli dashboard, scheda lead** — ① ogni schermata ora è
  controllata dalla tabella permessi: nuova chiave `posta` (staff di default), Dashboard senza bypass,
  Ricette/Allergeni sulla chiave `recipes`; `syncDefaults` completa anche i ruoli personalizzati (ereditano
  il default del ruolo di base per le sezioni nuove). ② Moduli dashboard per tutte le sezioni aggiunte
  (Chat, Posta, Negozio, Buoni sconto, Contabilità, Provvigioni, Prelievi, Testimonianze) con anteprime.
  ③ Nuova **scheda lead** `/crm/lead/:id` (click sul nome del lead puro in Gestione lead e Pipeline):
  anagrafica modificabile, stato, coach, promemoria, storico stati; backend `GET /crm/leads/:id` +
  `PATCH /crm/leads/:id/info`. Test aggiornati (permessi custom role, CRM updateInfo/detail).

- `[Prodotto]` **Documento "Cosa resta da fare" per Simone (PDF)** (`Metabole_Simone_Cosa_Resta.pdf`) — riepilogo completo e prioritizzato: A) gate di lancio (base contatori con snippet, Stripe LIVE + pagamento reale, email/DNS, smoke test); B) config & deploy (CORS/URL, AI key, segreti Render, FCM, Vercel/backoffice); C) pulizie (app/.env.example, rimuovere schema_1.prisma, build/test pipeline, cron); D) post-lancio (motore R8–R12 restante, email→Brevo, marketing/Giudice, blog/Publisher, app dedicate, prodotti dinamici, certificazione unicità). Con ordine consigliato e riferimenti.

- `[Prodotto]` **Estratto traduzioni sensibili RU/ZH/AR per revisore** (`marketing/Traduzioni_Revisione_RU_ZH_AR.md`) — 18 stringhe chiave del sito (claim hero, concept "non una dieta", banda, multiculturalità, CTA, coach/supervisione, testimonianze, form + **consenso privacy**) affiancate IT↔RU, IT↔ZH, IT↔AR, con colonna "Correzione". Nota: pagine legali (privacy/cookie/termini) da rivedere a parte nei loro file. Pronto da mandare a un madrelingua per lingua; manca solo il revisore.

- `[Prodotto]` **Marketing — catalogo email al 100%** (`marketing/Metabole_Email_Ciclo_Vita.md` Parti 6–7 + tracker) — scritte anche le ultime email (obiezione prezzo, valore settimanale, upsell, win-back survey/stagionale, transazionali: verifica/reset/ricevuta/rinnovo/**dunning**/appuntamento, consensi: re-permission/preferenze). Tracker `Elenco_Email_Automatiche.md`: **48 email tutte 🟢** (copy pronta), zero residui. Prossimo passo (Sviluppo): traduzione nelle lingue dell'app + template Brevo agganciati ai trigger.

- `[Prodotto]` **Marketing — completata la copy delle email in bozza** (`marketing/Metabole_Email_Ciclo_Vita.md` Parte 5) — scritte le email che restavano 🟡: conversione (profilo incompleto, **nurture 1–4**), retention (**onboarding G1/G2/G4/G7**, feedback ricette, riattivazione dropout, referral), **win-back T+3/T+7**. Tracker `email_automatiche/Elenco_Email_Automatiche.md` aggiornato: tutte 🟢 tranne le ⚪ (obiezione prezzo, valore settimanale, upsell, win-back survey/stagionale, transazionali/dunning, consensi). Prossimo passo: traduzione + template Brevo con i trigger.

- `[Prodotto]` **Piano Prodotto pre-lancio + primi materiali** — `progetto/Piano_Prodotto_PreLancio.md` (task nostri: team, testimonianze, revisione traduzioni, email, smoke test). Preparati: `marketing/Modulo_Testimonianze_Consenso.md` (raccolta + liberatoria GDPR + linee guida + tracce domanda) e `progetto/Template_Pagina_Team.md` (schede ruolo/CV + specifiche foto). **Rimosso ogni riferimento alle "grammature"** (non esistono nel nostro prodotto: si lavora per piatto e calorie) da Piano, STATO_LANCIO e checklist go-live.

- `[Prodotto]` **Pagina unica STATO LANCIO** (`progetto/STATO_LANCIO.md`) — one-pager sempre aggiornato con "cosa manca per aprire": semaforo, ✅ già fatto (verificato live), 🔴 4 gate (base contatori, Stripe LIVE + pagamento reale, email/DNS, smoke test), 🟠 consigliati (backoffice, FCM, pulizie), 🔵 contenuti [Pr], ⚪ dopo il lancio. Da tenere come riferimento quando si chiede lo stato.

- `[Prodotto]` **Sito — contatori: base storica Mosaico + nuova dicitura (9 lingue)** (`Metabole_Sito_Presentazione.html`) — i contatori partono dai numeri storici di **Mosaico Experiences SA**: **persone raggiunte da 85.218**, **clienti seguiti da 18.979** (default HTML + `STATS`). Nuova **dicitura** sotto i contatori (versione "sobria e chiara", tradotta in tutte le 9 lingue): *"L'esperienza è quella del nostro team. I clienti seguiti e le persone raggiunte sono i numeri che Mosaico Experiences SA ha maturato in 5 anni con diversi prodotti dedicati alla nutrizione."* → **impatto [Sviluppo]:** i numeri vivono nel DB e l'endpoint `/public/stats` sovrascrive i default (oggi mostra ~12/13 perché la base è ~0). Impostare la **base** nel backend/`config_param` così che `reached = 85218 + n° lead` e `clients = 18979 + n° acquisti` (offset di partenza), lasciando l'incremento +1 per lead / +1 per acquisto.

- `[Sviluppo]` **Generazione automatica dei codici col metodo aziendale** — nuovo modulo
  `common/ref-code.ts`: ogni codice generato in automatico segue la regola **5 lettere cognome +
  iniziale nome + progressivo da 01** (es. VOLPEA01). Vale per il ref code coach (admin e "il mio
  invito") e per il codice cliente "porta un'amica" (dal nome della cliente); casuale solo se il
  nome manca. Con la stessa forma nei due spazi, l'**unicità è verificata incrociata** (staff.refCode
  + clientProfile.referralCode), anche per i codici impostati a mano dall'admin. Inserimento
  case-insensitive (già garantito). +6 unit test (lead-assignment e referral).

- `[Prodotto]` **Go-live — verifica LIVE + checklist ridotta** (`Metabole_Checklist_GoLive.md`) — controllo dal vivo: backend up (`/health`, `/plans` = 3 piani reali €297/€497/€797 → DB Neon prod seedato), `/payment-methods` carta+bonifico (Stripe collegato), **app cliente live** su app.metabole.eu, sito live, endpoint lead attivo, utenze staff reali create. Infrastruttura **in piedi**. Restano solo **conferme** (Stripe in modalità LIVE + webhook, deliverability email Brevo/DNS, backoffice raggiungibile, FCM) + **smoke test con pagamento reale** + **contenuti** (team, grammature Keto, traduzioni, testimonianze). Checklist riscritta con spuntato ciò che è live e ridotta ai punti rimasti.

- `[Prodotto]` **Marketing — area "Email automatiche" con elenco-tracker** (`marketing/email_automatiche/Elenco_Email_Automatiche.md`) — nuovo registro di lavoro delle email automatiche in preparazione, con campi **evento (trigger), oggetto, testo (sintesi), segmento, timing, stato** (⚪ da progettare / 🟡 bozza / 🟢 copy pronta / 🔵 da tradurre / ⬛ template Brevo / ✅ live). Raggruppate in 8 aree: attivazione, conversione, retention, **email per evento** (peso obiettivo, morale, plateau, ricorrenze…), rinnovo, win-back, servizio/transazionali, consensi. Rimanda alla copy completa in `Metabole_Email_Ciclo_Vita.md` e alle campagne massive.

- `[Prodotto]` **Marketing — Email per ciclo di vita (per stato utente)** (`marketing/Metabole_Email_Ciclo_Vita.md`) — set completo di email triggered mappate a stati CRM e agente. Le 3 richieste con **copy pronta** (Benvenuto; "Il tuo profilo è pronto" con riepilogo questionario + piano + nutrizionista + coach; "Il tuo piano inizia domani + lista della spesa") + proposta di tutto il resto da agente di marketing: conversione (profilo incompleto, **checkout abbandonato** 3 email, nurture chi non sceglie il piano, obiezione prezzo), retention (onboarding 1–7, milestone, feedback ricette, contenuti valore, **riattivazione dropout_risk**, supporto stato Conforto, **referral**), **rinnovo** in scadenza (T-7/T-3/T-1 + upsell), **win-back** scaduti (grace, novità, survey uscita, stagionale), transazionali/dunning, consensi/preferenze. Con merge tag Brevo, trigger, priorità, A/B, metriche e passaggio dal Giudice. Da tradurre + costruire template Brevo. Nessun invio senza consenso. **Aggiunta copy completa** delle email ad alto impatto (checkout abbandonato A2.1–A2.3, rinnovo C1–C3) e una **Parte 4 — Email per EVENTO** (EV1 obiettivo di peso raggiunto, primo risultato, traguardo intermedio, costanza, **plateau**, **giornata storta/morale**, misure mancanti, rientro, compleanno, anniversario, pre-evento agenda, passaggio a mantenimento) con regole di frequenza e benessere.

- `[Sviluppo]` **Create le 14 utenze staff reali in produzione** — via `POST /admin/users` (admin
  `admin@metabole.eu`, password recuperata col flusso di reset): Giusy Vita (`sales` = Responsabile
  Coach), Antonio Nocera (`head_marketing`) e 12 coach (`coach`), email `nome@metabole.eu`, password
  provvisoria con **obbligo di cambio al primo accesso**, le 12 coach con **manager = Giusy** e **ref
  code personalizzato** (regola: 5 lettere cognome + iniziale nome + 01; inserimento case-insensitive,
  già garantito da `resolveByRefCode`). Verifica live: lista utenti completa, login di prova con flag
  `mustChangePassword=true`. Credenziali provviste fuori repo (repo pubblico).

- `[Prodotto]` **Checklist go-live aggiornata + Runbook operativo PDF** — `Metabole_Checklist_GoLive.md` rivista sullo stato reale: i **3 blocker di codice sono CHIUSI** (endpoint pubblico lead, form sito collegati, scoping per-paziente). Restano solo configurazione (Neon, segreti, Stripe LIVE, Brevo+DNS, CORS, FCM), deploy dei due front-end su Vercel e smoke test. Nuovo `Metabole_Runbook_GoLive.pdf` con l'**ordine esatto 1→9** dei passi (per Simone/Ops) + pulizie [Sv] (`app/.env.example`, rimuovere `schema_1.prisma`, build/test in pipeline) e contenuti [Pr]. Nessun nuovo sviluppo per aprire; chiavi solo nei pannelli, mai nel repo.

- `[Prodotto]` **E1 Agente Esclusioni (R8) — decisioni per Simone** (`Metabole_E1_Agente_Esclusioni_Decisioni.md`) — sciolte Q1/Q2 bloccanti e confermate le proposte di default: **Q1** tag allergeni normalizzati (14 UE) taggati dal nutrizionista, con **pre-tag assistito** da confermare + gate "prodotto non attivabile finché ricette non taggate e gruppi approvati"; **Q2** derivati via tag (un tag = alimento + derivati), tracce rimandate; **Q3** filtro ricette (no generazione automatica); **Q4** base personale = `recipeIds` sicuri; **Q5** veg/vegano ora, religione dopo; **Q6** blocca+escala se un solo **slot principale** scoperto (spuntini/merende non bloccano) + testo messaggio cliente; **Q7** run a fine onboarding + su update profilo + pulsante "rigenera base" + flag rigenerazione su nuova versione base; **Q8** ≥3 opzioni per slot principale in `config_param` (soglia separata per spuntini/merende). Via libera a E1.

- `[Sviluppo]` **Obbligo cambio password al primo accesso + ruolo `sales` → "Responsabile Coach"** — nuovo
  campo `must_change_password` su `user` (migrazione `20260714120000_must_change_password`, validata su
  PG16, default false); `POST /admin/users` accetta `mustChangePassword`, il flag è esposto in `/me`,
  nella lista utenti admin e nella risposta di login; `PATCH /me/password` lo azzera al primo cambio
  riuscito. **Backoffice**: nuova schermata bloccante `CambioPasswordObbligatorio` (gate in `Protected`)
  — finché la password provvisoria non viene cambiata nessuna pagina è raggiungibile; build Vite ok.
  Etichetta del ruolo `sales` unificata a **"Responsabile Coach"** in backend e backoffice (era
  "Commerciale"/"Resp. Coach Team": la voce "commerciale" nella tabella ruoli era un refuso storico).
  +2 unit test su UsersService. Scopo: onboarding delle utenze staff reali (team coach + responsabili)
  con password provvisoria consegnata a voce e cambio obbligatorio.

- `[Sviluppo]` **Sito di presentazione LIVE su metabole.eu + favicon Gaia** — pubblicato su SiteGround
  (`public_html`) il sito v4 completo: home + Blog/Lavora/Privacy/Cookie/Termini; WordPress preinstallato
  accantonato senza cancellarlo (`DirectoryIndex index.html index.php` in `.htaccess`). Collaudo go-live da
  `Istruzioni_Claude_Sito_Metabole.md`: endpoint pubblici 200 con CORS ok da metabole.eu e www, sezioni
  dinamiche popolate (stats/percorsi/testimonianze), form lead → CRM verificato (lead di prova "Test GoLive
  Claude" da cancellare), honeypot che scarta. Aggiunta **favicon Gaia** (`favicon.svg` dalla mascotte
  `#gaiaMascot` + PNG 32px inline) su tutte le pagine. → nota: dopo ogni modifica ai file del sito nel repo,
  ricopiare su SiteGround e svuotare la Cache Dinamica.


- `[Prodotto]` **Risposta al piano R8–R12 di Simone — decisioni per sbloccare l'agente** (`Metabole_Motore_R8_R12_Decisioni.md`) — verificata e confermata la mappatura di Simone sullo schema reale (CycleFeedback/RecipeRating/MenuWeight/EngineDecision/Protocol/Escalation/ProductRule ci sono; ClientProfile senza `allergies`; mancano EquivalenceGroup/ClientCycle/ClientMenuPool). Decise le 5 domande aperte: **D1** Agente (B) genera i menu, motore a protocolli (A) resta guardrail di sicurezza (non si fondono); **D2** gruppi di equivalenza = **modello dedicato** `EquivalenceGroup` del nutrizionista (seed dai 23 gruppi di regola4), non tag; **D3** unicità = seme+collision check+`PersonalizationCertificate` (HMAC/hash-chain) per l'MVP, PKI/auditor esterno rimandato (claim marketing → Antonio); **D4** stati contestuali sul `ClientCycle`, soglie in config_param, guardrail conforto→mood_risk; **D5** aggiungere `ClientProfile.allergies String[]` + domanda onboarding separata. Approvato il piano a fasi E0→E5 e le migrazioni additive sicure (allergies + scheletro modelli). Priorità: prima i blocker go-live.

- `[Prodotto/Sviluppo]` **Keto inserito nel motore + PDF Metodo/Audit + 12 regole nel wizard "Costruisci nuovo percorso"** — (1) **Motore**: base Keto approvata caricata come catalogo **isolato** del prodotto Keto — `backend/prisma/data/keto_catalog.json` (**118 ricette** per pasto con kcal, metodi di cottura, tag keto/veg; **8 giornate bilanciate** ~1450 kcal) + `backend/prisma/seed_keto.ts` (idempotente, crea Recipe + Diet `style:keto` con dayTemplates, isolato per prodotto) agganciato in `seed.ts` (`seedKetoCatalog`). (2) **PDF**: `Metabole_Metodo_Motore_Intelligente.pdf` (Fase A R1–R7 + Fase B R8–R12, mappa "dove agisce l'agente") e `Metabole_Audit_Personalizzazione.pdf` (verifica: ogni menu personalizzato e muta sui bisogni; parità Keto↔Mediterranea; rischi/presidi). (3) **Wizard** `Metabole_Wizard_Crea_Prodotto.html`: nuovo pannello con le **12 regole** in 2 fasi, R8+ marcate come **agente AI**, titolo "Costruisci nuovo percorso · nutrizionista/admin". → impatto [Sviluppo]: rivedere `seed_keto.ts` (grammature reali le fissa il nutrizionista); il seed è idempotente e non tocca cataloghi già popolati.

- `[Prodotto]` **METODO DEL MOTORE INTELLIGENTE — regole canoniche unificate (Keto + Mediterranea) per ogni percorso** (`percorsi/METODO_MOTORE_INTELLIGENTE.md`) — allineate le due serie di regole prendendo da ciascuna ciò che mancava. Stabilite **12 regole in 2 fasi**: **Fase A costruzione base (R1–R7)** = nutrizionista+strumenti (raccolta, catalogo per pasto [×stagione opz.], calorie interne, gruppi equivalenza, cotture, **bilanciamento giornata + porzioni standard/no-fame**, approvazione+isolamento per prodotto); **Fase B motore intelligente (R8–R12)** = **dove interviene l'AGENTE AI, unico per percorso** (R8 esclusioni con **blocca+escala** se non sostituibile; R9 partenza differenziata + **unicità certificata** seme/collision/registro firmato; R10 ciclo bigiornaliero + monitoraggio con **misure obblig., peso vs cm separati, seguito sì/no, gradimento default 5★ = max stelle**; R11 adattamento scoring efficacia×gradimento + **apprendimento che isola il pasto** + **stati** Conforto→Rientro/Pre-Post-evento/Plateau; R12 obiettivo dimagrimento/mantenimento + matrice segnalazioni + RBAC/kcal nascoste/cifratura/config_param). Mappa "dove agisce l'agente". **Audit unicità confermato e rafforzato**: ogni menu resta personalizzato e muta sui bisogni del cliente (parità piena Keto↔Mediterranea). Stato: da validare nutrizionista, no deploy. → impatto [Sviluppo]: standard del motore per ogni nuovo percorso, R8–R12 come componenti riusabili parametrizzati per product_id.

- `[Prodotto]` **Percorso KETO — Regola 10: menu di partenza differenziati per cliente** (`percorsi/keto/regola10_menu_partenza_differenziati.md`) — i menu di partenza sono **diversi per ogni cliente** anche a **pari percorso** e **stessa data d'inizio**: due clienti = due menu di partenza. Meccanismo: **seme personale** derivato da `client_id` che ordina/ruota in modo deterministico ma unico la sequenza pescata dalla **base personalizzata** (R7) → primo menu e ordine diversi per ciascuno. Restano garantiti keto, kcal target, ciclo bigiornaliero con 2 cotture (R6+R8); da lì prosegue l'adattamento (R9). Sequenza di partenza salvata nello storico personale. Stato: 🟡 da validare, no deploy. → impatto [Sviluppo]: generare sequenza di partenza personale (ordinamento con seme da client_id) sulla base personalizzata, salvarla, l'Agente Adattamento prosegue da lì.

- `[Prodotto]` **Percorso KETO — Regola 9: Agente Adattamento (scelta menu successivo + apprendimento personale)** (`percorsi/keto/regola9_agente_adattamento.md`) — l'agente legge la tabella personale (esito misure + gradimento) e decide il menu del ciclo dopo: 📈 **preso peso** → ripropone il **menu che ha fatto perdere di più** al cliente (dal **ranking personale** per Δ peso; a parità, gradimento più alto); ➖ **invariato** / 📉 **sceso** → **nuovo menu** dalla base personalizzata (non recente, gradimento alto, cotture preferite). Logica exploit(sale)/explore(fermo o scende). Mantiene un **ranking menu per client_id** (Δ peso + ★) aggiornato ogni ciclo e registra decisione/motivo/esito nello **storico personale** cifrato. Limiti: aumenti ripetuti/plateau/cali anomali → **escalation nutrizionista**; l'agente non inventa menu né cambia kcal/grammature da solo. Stato: 🟡 da validare, no deploy. → impatto [Sviluppo]: Agente Adattamento con regola di decisione, ranking menu personale, storico cifrato, escalation.

- `[Prodotto]` **Percorso KETO — Regola 8: Agente Monitoraggio (ciclo bigiornaliero)** (`percorsi/keto/regola8_agente_monitoraggio.md`) — man mano che il cliente prova i menu, l'agente registra nella **tabella personale**: **misure obbligatorie** (peso/cm → esito 📉 sceso / ➖ invariato / 📈 salito) e **gradimento piatti opzionale** (se assente → **default 5★**). Unità = **ciclo di 2 giorni** (i menu sono ogni 2 giorni): nei due giorni **stesso menu** con **due metodi di cottura diversi** (Regola 6, kcal invariate). Definiti schema tabella personale (ciclo, menu, cottura g1/g2, Δpeso, Δcm, esito, ★), regole ferme (misure chiudono il ciclo; gradimento mai penalizzante; l'agente solo registra, non adatta ancora), dati sanitari cifrati (accesso cliente+nutrizionista). È la materia prima per la personalizzazione dinamica successiva. Stato: 🟡 da validare, no deploy. → impatto [Sviluppo]: Agente Monitoraggio con ciclo bigiornaliero, schermata misure obbligatoria + gradimento opzionale (default 5★), tabella personale cifrata per client_id, abbinamento menu↔2 cotture.

- `[Prodotto]` **Percorso KETO — Regola 7: Agente Esclusioni → base personalizzata (prima personalizzazione vera)** (`percorsi/keto/regola7_agente_esclusioni.md`) — come per la Mediterranea, un **agente AI** parte dalla copia della base approvata e **rimuove/sostituisce** ciò che il cliente non può/non vuole: **allergie** (blocco duro, incl. tracce/derivati), **intolleranze** (sostituzione con alternativa tollerata), **non graditi** (preferita sostituzione via gruppi di equivalenza Reg.4), **cultura/fede + veg/vegano**. Principio: prima sostituire (varietà), poi rimuovere; sempre **dentro la keto e a pari kcal**. Output = **base personalizzata** del cliente (isolata per `client_id`), punto di partenza delle regole successive. Casi limite (categoria svuotata, allergie gravi, veg+allergie) → **escalation al nutrizionista**, l'agente non inventa. Audit delle esclusioni. Stato: 🟡 da validare, no deploy. → impatto [Sviluppo]: implementare l'Agente Esclusioni (filtra per tag alimento/allergene + gruppi equivalenza), output base personalizzata isolata, log, escalation sotto soglia.

- `[Prodotto]` **Percorso KETO — Regola 6: metodi di cottura → nuovi pasti** (`percorsi/keto/regola6_metodi_cottura.md`) — 1ª regola di personalizzazione: per ogni cibo **3–5 metodi di cottura** (forno, griglia/piastra, cartoccio, umido, vapore, padella, bassa temperatura, crudo/marinato…) che **conservano le kcal del piatto** (a parità di porzione e grasso aggiunto). Matrice metodi per gruppo (pesci grassi/bianchi, crostacei, pollame, carne rossa, uova, tofu, verdure, formaggi) + esempi generati (salmone CE08 ×5, pollo PR01 ×5, bistecca CE10 ×5, branzino PR03 ×5, uova COL02 ×5, gamberi CE13 ×4, tofu CE02 ×4). Regola calorica: **frittura/impanatura escluse** (aggiungono olio → piatto diverso). Effetto: *ingrediente × metodo* moltiplica il catalogo restando keto. Nella base personale il cliente sceglie il **metodo preferito / a rotazione**, senza ricalcolo. Stato: 🟡 da validare nutrizionista, no deploy. → impatto [Sviluppo]: attributo **metodo di cottura** sul modello piatto (varianti a stessa kcal) + filtro preferenza in personalizzazione.

- `[Prodotto]` **Percorso KETO — base APPROVATA dal nutrizionista → si apre la fase "personalizzazione"** — la base Keto (`base_keto_da_approvare.md`) è 🟢 **approvata**: da ora è **immutabile e condivisa** (ogni modifica futura ripassa dal nutrizionista con versione). Nuovo `percorsi/keto/personalizzazione_cliente.md`: cambia la natura delle regole — **fino a qui costruivano la base, d'ora in poi costruiscono la personalizzazione di ogni cliente**. Principio fissato: ogni cliente Keto riceve una **BASE PERSONALE = copia della base approvata**; le regole successive lavorano **solo su quella copia**, senza toccare la base ufficiale né mischiarsi con altri clienti/percorsi. Lo scaffold contiene lo schema (approvata→clona→personale→regole→menu), le dimensioni personalizzabili (grammature/fabbisogno, esclusioni allergie-intolleranze-non graditi, gusti/veg/fede, n° pasti, obiettivo, stato/gradimento) come placeholder, e una **tabella-registro** delle regole di personalizzazione. Stato: pronto a ricevere la 1ª regola, no deploy. → impatto [Sviluppo]: alla scelta "Keto", clonare la base approvata in una base personale del cliente; le regole seguenti operano solo su quella copia.

- `[Prodotto]` **Percorso KETO — base costruita col metodo validato (regole 1–5)** — cartella `percorsi/keto/`: (1) `raccolta_menu_web.md` raccolta menu keto da 5 fonti (~31 giornate/~130 pasti); (2) `catalogo_pasti.md` **118 piatti** deduplicati e **divisi per pasto** (colazioni/pranzi/cene/spuntini/merende); (3) `catalogo_pasti_calorie.md` stessi piatti **con kcal** (senza grammature); (4) `regola4_sostituzioni.md` **23 gruppi di equivalenza** (i 12 del nutrizionista + altri: pesci bianchi, crostacei, salumi, proteine veg, crucifere, basi finto-carbo, frutti keto, dolcificanti…) + ~32 varianti a calorie invariate + "Settimana B"; (5) `base_keto_da_approvare.md` **base isolata (solo Keto)** con workflow di **approvazione del nutrizionista** per categoria (sign-off) → dopo l'ok diventa il **pool per ogni cliente Keto**, mai mischiato con altri percorsi. Metodo riusabile identico per gli altri percorsi (Proteica, Low-carb, gravidanza, menopausa, sportivo, pre-matrimonio…), ciascuno con base separata. Stato: 🟡 in revisione nutrizionista, no deploy. → impatto [Sviluppo]: agganciare il pool al prodotto Keto (isolato); motore compone i giorni del cliente solo da qui + sostituzioni/esclusioni; versioning con approvazione.

- `[Prodotto]` **Marketing — archivio vignette catalogato per l'agente Publisher** — tutte le creative raccolte in **`marketing/vignette/`** con **catalogo machine-readable** `catalogo_vignette.json` (schema `metabole.vignette.catalog/v1`): 8 collezioni (persona: maria/menopausa/post-gravidanza/rientro/giornata storta; punti di forza: persone vere+AI, su misura; app: schermate reali) = **32 varianti/asset**, ognuna con messaggio, caption, hashtag, canale, stato, fonte (Canva `design_id`+preview o PNG) e **compliance/gate Giudice**; 6 voci `in_coda`. Più `README.md` (come lo usa il Publisher), `catalogo_canva.md`, le 3 gallerie HTML e `app-screens/` (5 screenshot reali). → impatto [Sviluppo]: il **Publisher** legge il catalogo, esporta il PNG dal design_id (o usa il PNG), passa dal Giudice, pubblica via API e logga. → in coda: gusto senza fame, sicurezza clinica, trasparenza, gravidanza pre/post, sposa.

- `[Prodotto]` **Marketing — vignette con schermate REALI dell'app** — catturate dal **prototipo ufficiale** via **Chromium headless** nel sandbox (aggirato il blocco `libXdamage` con uno **stub compilato**, asset via proxy allowlisted, navigazione simulata nel flow → app, popup chiusi). 5 screenshot reali in `marketing/app-screens/` (contatti, home, obiettivi, percorso, agenda). La **Contatti** mostra Gaia (assistente AI) + coach (Sara C.) + nutrizionista (Dott.ssa Marini), tutti LIVE. Nuova galleria `../Metabole_Vignette_App_Reali.html` (sostituisce la mockup ricostruita): 4 vignette 1080×1350 con le schermate vere + messaggi. Nota: alcune icone barre/foto CDN non caricate nel rendering headless (perfette in produzione o via Chrome connesso).

- `[Prodotto]` **Marketing — vignette punti di forza (Canva) + vignette app mockup** — sui **punti di forza** generate e archiviate **8 vignette** Canva: *Persone vere + AI* (4) e *Davvero su misura* (4), nella cartella `FAHPU5TzSCs` e nell'indice `../Metabole_Vignette_Archivio.md`. In coda (quota Canva giornaliera raggiunta): gusto senza fame, sicurezza clinica, trasparenza + temi gravidanza pre/post e sposa. Per le **schermate app** (Canva non riproduce la nostra UI/Gaia) creata composizione nostra `../Metabole_Vignette_App_Mockup.html`: 3 vignette 1080×1350 con telefono + schermata reale (Chi ti segue: Coach/Nutrizionista/Gaia; chat; menu "AI propone → nutrizionista valida") e **mascotte Gaia ufficiale**; avatar coach/nutrizionista stock da sostituire con volti reali.

- `[Prodotto]` **Marketing — vignette AI (Canva) persona-target + archivio** — svolta creativa: da concept astratti a **storie vere in prima persona per persona-target** (foto calde, dignità, no pressione estetica). Generati con **Canva** (connettore) 19 design Instagram: **Maria/matrimonio figlia** (3 approvati), **menopausa**, **post-gravidanza**, **rientro vacanze**, **giornata storta** (4 varianti l'una). Tutti esportati in PNG e archiviati nella **cartella Canva** `https://www.canva.com/folder/FAHPU5TzSCs`. Indice riusabile in `../Metabole_Vignette_Archivio.md` (messaggi, caption, hashtag, link modifica/anteprima per riesportare). Compliance: prima persona per occasione/emozione (non "entra nel vestito"), 18+, dal Giudice. → nota: Gaia non la disegna Canva (mascotte inventata) → si aggiunge come asset reale o si compone a parte.

- `[Prodotto]` **Marketing — vignette "grafica reale" (foto + tipografia)** — nuova versione `../Metabole_Vignette_Social_Foto.html`: 10 card 1080×1080 con **foto vere** (Unsplash, sostituibili con scatti nostri) + overlay/tipografia brand, per i post del Lotto 1; testimonianza come quote card (nessun volto reale senza consenso), conformi (no prima/dopo, no numeri, 18+). Affianca la versione illustrata SVG. → Nota: per illustrazioni AI su misura serve un connettore image-generation (da valutare).

- `[Prodotto]` **Marketing — vignette social (Lotto 1) + strategia rientro/nurture** — nuova galleria `../Metabole_Vignette_Social.html`: **12 vignette SVG** (1080×1080, palette brand, mascotte Gaia) dai 10 post del Lotto 1 (cassetto diete ×2, quote "Non una dieta" ×2, caroselli fame/porzioni, reel dietro-le-quinte/assaggio, giornata storta, menopausa, mangi fuori, testimonianza) con caption+hashtag pronti; conformi (no prima/dopo, no numeri, 18+), firme generiche "responsabile scientifico" (no nome Russolillo, come deciso). SVG validati. Nuovo doc `../Metabole_Strategia_Rientro_Nurture.md`: strategia **win-back 20.000 clienti** + **nurture 80.000 lead** — base giuridica LPD/GDPR (re-permission lead, soft opt-in clienti, SPF/DKIM), segmentazione, offerta, canali (email Brevo/SMS/retargeting social con le vignette/WhatsApp), **sequenze A (rientro) e B (nurture)**, aggancio agli stati CRM/agente, KPI, ordine operativo. → impatto [Sviluppo]/[Marketing]: sequenze email in Brevo agganciate agli stati; igiene liste/consensi.

- `[Prodotto]` **Go-live — smoke test (script + piano) + sonda live** — nuovo `scripts/metabole_smoke.sh` (health/plans/products/payment-methods/POST public-leads/endpoint protetto) e `../Metabole_Smoke_Test.md` (piano manuale B1–B7: account+email, onboarding, pagamento Stripe, motore menu, backoffice, sito, sicurezza). **Sonda live 14/7**: backend **up** (`/health` ok, DB up, v0.1.0), `/plans` 3 piani reali, `/payment-methods` card+bonifico ok; `POST /public/leads` non ancora attivo (blocker #1, in carico a Simone). Verifica dei 2 blocker di codice (endpoint lead + fix sicurezza scoping) pianificata via task per il 15/7.

- `[Prodotto]` **Go-live rosso #1 — lead-capture (form sito in sicurezza + handoff endpoint)** — i form `leadForm` (sito) e `jobForm` (Lavora) ora mostrano "Grazie" **solo su risposta 2xx reale**; aggiunti **honeypot** antispam, **messaggio d'errore con fallback `info@metabole.eu`** (tradotto in 9 lingue) così **nessun lead va perso**, e `data-endpoint` collegato a `/api/v1/public/leads`. Nuovo **handoff [Sviluppo]** `../Metabole_Lead_Endpoint_Handoff.md` con **codice pronto**: `PublicLeadDto`, `CrmService.createPublic()` (riusa `CrmRecord`, metadati in `stageDates` → **nessuna migrazione**), `PublicLeadController` (`@Public` + `@Throttle` 5/min + honeypot), registrazione nel `CommerceModule`, note **CORS** (aggiungere dominio sito) e captcha Turnstile opzionale. → **impatto [Sviluppo]:** applicare l'endpoint (2 file nuovi + 1 metodo + 1 riga modulo) e aggiungere l'origine sito a `CORS_ORIGINS`.

- `[Prodotto]` **Verifica pronto-al-lancio + checklist go-live** — revisione dell'intero repo (backend/app/backoffice/sito/legali/deploy). Esito: codice molto avanzato; **blocker** = (1) endpoint pubblico "crea lead" + collegare i form del sito (oggi lead/candidature persi), (2) fix sicurezza scoping `/engine/decisions/:id/confirm|correct` per-paziente, (3) config prod (Stripe LIVE+webhook, Neon URL, Brevo+SPF/DKIM, FCM push, ADMIN/CORS/VITE_API_URL). Nuovo file **`../Metabole_Checklist_GoLive.md`** (spuntabile, con responsabili [Sv]/[Pr]/[Ops]): blocker, config, smoke test, contenuti, e "subito dopo" (endpoint dinamici sito, app coach/nutrizionista dedicate, marketing/Giudice, agenti, blog, social, prodotti dinamici, stagionali, certificazione unicità). → impatto [Sviluppo]: chiudere i blocker prima del go-live.

- `[Prodotto]` **Marketing — testimonianze sul sito + pubblicazione social (spec)** — la sezione **Storie** del sito ora è **dinamica** (`data-testimonials-endpoint`, con fallback alle 3 storie statiche): ogni testimonianza **approvata** nel marketing **compare automaticamente sul sito** oltre a essere usata nei contenuti. Nuovo doc `../Metabole_Testimonianze_Social_Publishing.md`: entità **`Testimonial`** + flusso (raccolta → **Giudice**/consenso → approvazione responsabile marketing → pubblica su sito + marketing); e **Publisher via API** per i social — **Facebook Pagina + Instagram** (Meta Graph / Instagram Content Publishing API: account Business, Pagina collegata, IG professionale, app Meta, permessi `instagram_content_publish`, **App Review** 2–4 sett., pubblicazione in 2 passi), **TikTok** (Content Posting API: App Review, upload a chunk, token 24h, limiti/giorno, no scheduling nativo), + canali **consigliati** (LinkedIn, YouTube, Threads, Pinterest, Google Business, WhatsApp/Telegram). Entità `SocialAccount`/`SocialPost`, adapter per canale, guardrail (Giudice, rate limit, token refresh, audit, segreti su Render). → **impatto [Sviluppo]:** entità Testimonial + endpoint (sito già pronto), Publisher + adapter social, gestione OAuth/token. NB: collegare account e App Review sono **azioni dell'utente/business** (l'AI non fa login/OAuth).

## 2026-07-13


- `[Prodotto]` **Pagine legali multilingua (nota IT vincolante) — complete** — **Cookie**, **Termini** e **Privacy** tradotti **completi in tutte e 9 le lingue** (IT/EN/ES/PT/FR/DE/RU/ZH/AR) con selettore lingua, RTL per l'arabo e nota "traduzione di cortesia, **versione italiana legalmente vincolante**". Privacy verificata: 83 chiavi × 9 lingue tutte presenti. Autorità di controllo localizzata per lingua (IFPDT/FDPIC/EDÖB/PFPDT…), basi legali LPD/nLPD + GDPR. Tutte con hook `data-i18n-endpoint` (traduzioni anche dal DB).

- `[Prodotto]` **Sito — Blog nel menu, box "metodi gestiti", pagine tradotte, spec agenti** — header: aggiunti **Blog** e **Percorsi/Lavora** nel menu in alto; nuovo **4° contatore "metodi gestiti"** nella banda statistiche (dinamico, = n° percorsi, da `data-stats-endpoint`/`data-paths-endpoint`). **Pagine tradotte nelle 9 lingue** con selettore + hook DB: **Blog** (27 chiavi) e **Lavora** (45, incluse opzioni form e placeholder) complete; **Cookie** tradotto con **nota "versione italiana vincolante"** (traduzione di cortesia). → **restano da tradurre Termini e Privacy** (stesso schema + nota IT vincolante). Nuovo doc **`../Metabole_Agenti_AI_Spec_Sviluppo.md`** per lo Sviluppo: entità `Agent`/`AgentRun`/`AgentLog`, orchestrazione, endpoint `/agents`, mapping motore Claude, budget/guardrail, integrazione Giudice/RBAC, seed dei 13 agenti. → impatto [Sviluppo]: implementare pagina backoffice Agenti + runtime; traduzioni/contatori dal DB.

- `[Prodotto]` **Dashboard — nuova sezione "Agenti" (tutti Claude)** — deciso: **standard su agenti Claude** (niente mix di fornitori). Prototipo `../Metabole_Dashboard_Agenti.html`: sezione dashboard che mostra **ogni agente** con **nome · dove lavora · cosa fa · regola · motore** (Haiku 4.5 / Sonnet 5 / Opus 4.8; ElevenLabs per la voce; motore dieta deterministico). 13 agenti su 5 reparti (App/Marketing/Comunicazione/CRM/Sistema), filtro per reparto, e **form "Nuovo agente"** (nome, tipo, dove applicarlo, motore, cosa fa, regola) che aggiunge una card. Mappatura motore→compito valutata per criticità/volume. → **impatto [Sviluppo]:** pagina backoffice `Agenti` + entità `Agent` (name, dept, type, engine, task, rule, enabled) + registrazione/instradamento reale degli agenti; il motore LLM diventa Claude.

- `[Prodotto]` **Sito v4 + Comunicazione/blog + analisi costi agenti** — sito: **mascotte Gaia vera** (SVG dal widget, occhi che sbattono) nell'orbita e nel telefono; **badge App Store + Google Play**; **icona Kosher** sostituita (stella di Davide SVG, mancava in Tabler); **blog** e **lavora con noi** ora **pagine dedicate**, in home solo **articolo in evidenza** e **richiamo**; nuovo box **"Percorsi alimentari"** con i percorsi dell'app (Mediterranea/Proteica/Low-carb/Keto), caricabile da endpoint; **contatori dinamici**: "persone raggiunte" +1 a ogni **lead**, "clienti" +1 a ogni **acquisto piano** (letti dal DB via `data-stats-endpoint`, +1 ottimistico sul form). Nuovo doc **`../Metabole_Comunicazione_Blog_Agente.md`**: sotto-reparto **Comunicazione** nel Marketing con **agente Redattore** (RAG su fonti nutrizione → bozza → **Giudice** → **approvazione responsabile marketing** → **1 articolo/giorno** pubblicato sul blog; entità `Article`, endpoint, cron, escalation claim salute al nutrizionista capo). Nuovo doc **`../Metabole_Agenti_AI_Motori_Costi.md`**: inventario agenti (LLM specializzati con umano-nel-ciclo), motore consigliato (Haiku 4.5 default / Sonnet 5 / Opus raro + ElevenLabs voce + modello immagini) e **stima costi** (~$0,30–0,80 per cliente/mese; ~$360–1.000/mese in avvio, ~$3–8k a 10.000 clienti; marketing/blog quasi trascurabili). → **impatto [Sviluppo]:** endpoint `data-stats-endpoint` (contatori reali: +1 lead / +1 acquisto), `data-paths-endpoint` (percorsi app), `data-blog-endpoint` + entità `Article` + cron pubblicazione 1/giorno; fissare il **motore LLM** nel codice.

- `[Prodotto]` **Sito — revisione grafica + app + mascotte Gaia + blog + lavora + 9 lingue** — `../Metabole_Sito_Presentazione.html` rivisto a fondo: nuova sezione **"Come funziona l'app"** (il cliente inserisce misure e gradimento → l'**AI** registra e propone → il **nutrizionista** valida) con mockup del telefono; **mascotte Gaia** disegnata in SVG (usata nella ruota e nel telefono); nella **ruota hero** ora le linee figura→cliente **si accendono in sequenza** al passaggio di Gaia (come se attivasse l'azione, direzione dalla figura al cliente); **"AI" pulsa sempre** con i colori dell'intelligenza ovunque compaia Metabole**AI**; grafica più viva e **arcobaleno della multinazionalità** (sezione "Per ogni cultura" ora chiara con barra rainbow e icone colorate; tolto il fondo scuro/nero); **blocchi più vicini e con contorni** definiti; **nome Russolillo rimosso** (nome + CV alla pubblicazione). Aggiunte **2 lingue**: **spagnolo e portoghese** (ora IT/EN/ES/PT/FR/DE/RU/ZH/AR = 9). Nuove pagine **`../Metabole_Lavora.html`** ("Sei nutrizionista/coach? Vuoi diventare tutor della nutrizione?" + form candidatura) e **`../Metabole_Blog.html`** (indice articoli). Verificato: JS ok, 146 chiavi × 9 lingue complete, 14 sezioni bilanciate. → **impatto [Sviluppo]:** (1) **le lingue devono vivere nel DB** — predisposto hook `loadRemoteI18N` + attributo `data-i18n-endpoint` sul `<body>`: quando l'endpoint restituisce `{lingua:{chiave:valore}}` sovrascrive le locali (serve endpoint tipo `GET /api/v1/i18n/site`); (2) endpoint **"crea lead"** e **"candidatura lavora con noi"** (`fonte:'lavora_con_noi'`); (3) deploy Vercel/sottodominio. → da confermare: revisione madrelingua ES/PT/RU/ZH/AR; nomi/CV team; contenuti reali del blog.

- `[Sviluppo]` **Prodotti dinamici — Fase A+B (fondazione backend)** — deciso (con Simone) di NON creare una nuova tabella (il nome `Product` è già gli integratori): si **estende `Diet`**, che già possiede i menu isolati per `diet_id`. Aggiunti a `Diet` i campi cliente (`clientName`, `clientDescription`, `highlights`, `seasonalTag`, `objective`, `clientVisible`) + nuovo stile **`keto`** nell'enum `DietStyle`. Due migrazioni additive **validate su Postgres 16 locale** (ADD VALUE enum + ADD COLUMN). Seed idempotente `seedDietProductFields` (campi prodotto su Mediterranea/Proteica/Low-carb + crea **Keto** a menu vuoti). Endpoint **`GET /onboarding/diet-products`** (zero-redeploy, letto a runtime). **Nessun cambiamento visibile nell'app ancora** (è la fondazione; lo schermo 16 dinamico è la Fase C). Piano completo in `../Metabole_Prodotti_Dinamici_Piano_Sviluppo.md`. NB: type-check reale del backend su Render (il campo nuovo non è nel client Prisma locale).

- `[Prodotto]` **Sito — multilingua (7 lingue) + cookie + statistiche + esigenze culturali + pagine legali** — sito rifatto grafico con **animazione "tu al centro"** (Gaia organizza menu/coach/nutrizionista/eventi/imprevisti) e foto reali; ora in **IT/EN/FR/DE/RU/ZH/AR** (selettore lingua, arabo RTL, scelta persistente); **banner cookie** accetta/rifiuta → Cookie Policy; **statistiche** (20+ anni, 20.000+ clienti, 80.000+ persone) con **nota prodotti** (Nutriamo, MetaboleAI · Mosaico Experiences SA); sezione **"Per ogni cultura"** (halal — no maiale/crostacei, kosher/altre fedi, veg/vegan, allergie). Nuove pagine `../Metabole_Cookie.html` e `../Metabole_Termini.html`; privacy/cookie/termini su **base svizzera (LPD)** + GDPR per UE, foro di Lugano; tolto avviso "da validare" (validato dal consulente). → da confermare: numeri, elenco prodotti, foto/nomi team, `info@metabole.eu`; revisione madrelingua RU/ZH/AR. → impatto [Sviluppo]: endpoint "crea lead"; deploy Vercel/sottodominio.
- `[Sviluppo]` **Attivazione — schermo 27 "Il tuo percorso è pronto" + stato checklist 1:1** — allineato lo schermo 27 (PlanFlow) al prototipo: bolla di Gaia col **testo esatto** e i nomi **reali** di coach e nutrizionista (dal team assegnato). Prodotta la mappa `../Metabole_Checklist_Allineamento_STATO.md` con lo stato ✅/🟡/⬜ di tutte le 34 schermate onboarding + dashboard. **Onboarding replicato 1:1** tranne: schermo 16 (prodotti dinamici/Keto), video coach/nutrizionista (28–29), rifiniture assaggio menu (30) e widget tutto pronto (34). Type-check e build ok.

- `[Sviluppo]` **Onboarding — aggiunto schermo 6 "Perché vuoi iniziare adesso?"** — prima domanda della sezione Mente, con le 4 opzioni esatte del prototipo (Sentirmi bene con me stessa · Rientrare nei miei vestiti · Salute ed energia · Un evento importante) e il testo di Gaia. La risposta si salva in `lifestyle.motivation` (campo JSON già esistente → **nessuna migrazione**); aggiunto `motivation` al `LifestyleDto`. Con questo l'ordine delle domande Mente è completo (Perché → Come seguita → Carattere). Type-check app + questions ok.

- `[Sviluppo]` **Onboarding — testi delle domande allineati verbatim al prototipo** — titoli e testo scritto di Gaia (subtitle) di **tutte** le domande copiati esatti dal prototipo: es. identità → "Come vuoi essere chiamata?", carattere → "Quale caratteristica ti contraddistingue quando prendi un impegno?", e i testi lunghi di Gaia per obiettivo, salute, intolleranze, coach, ecc. Aggiornata anche la **palette colori app** (schermo 24) ai 6 colori della direttiva (#F2B807/#E23B3B/#E86FA6/#2F80ED/#12A386/#F2820A). Backend `onboarding.questions.ts` (servito a runtime, nessuna migrazione). **Rimandati** (filone prodotti dinamici): schermo 16 "Stile che preferisci" (Keto + prodotti dall'API) e l'aggiunta della domanda "Perché vuoi iniziare adesso?" (nuovo campo). Type-check del file ok.

- `[Sviluppo]` **App cliente — allineamento 1:1 onboarding (colori sezioni + schermo 25 GDPR)** — seguendo la Direttiva Replica 1:1: le **5 sezioni** hanno ora ordine, nomi, tab e **colori esatti** del prototipo (Mente `#6C4CD6` · Vita `#2F80ED` · Agenda `#E8543C` · Gusto `#E8A11B` · Corpo `#12A386`, con sfondi tenui) e l'ordine corretto **Mente→Vita→Agenda→Gusto→Corpo** (prima il Corpo era in testa). Lo schermo **25 "Trattamento dei dati personali"** ora ha la bolla di Gaia col testo esatto ("Manca solo la tua approvazione…") e pulsante "Accetta e procedi". Verificato che i campi **Età, Altezza, Sesso** (schermo 19) e **Peso/Vita/Fianchi** (schermo 20) erano già definiti a backend e mostrati. Type-check e build ok.
- `[Prodotto]` **Marketing — primo lotto social (vignette + testi)** — `../Metabole_Social_Lotto1.md/.pdf`: 10 post pronti (vignette empatiche, caroselli educativi firmati **dott. Salvatore Russolillo** — capo nutrizionista/tecnologo/coach/psicologo — Reel prodotto, quote, testimonianza) con concept, testi sull'immagine, caption, hashtag e prompt immagine; mini-calendario 2 settimane. Tutti conformi (no prima/dopo, no numeri/garanzie, 18+), passano dal Giudice. Contesto operativo: legale (privacy/cookie) pronto da avvocato; team pronto (Russolillo + 8 coach + 1 supervisore); go-live quasi completo (restano verifiche Stripe LIVE/Brevo/DPA + contenuti menu altre diete + profili coach/nutrizionista in-app).
- `[Prodotto]` **Sito — Informativa privacy** — aggiunta `../Metabole_Privacy.html` (adattata dalla policy Mosaico Experiences SA / nutriamo.ch): Titolare Mosaico Experiences SA (Lugano), email `info@metabole.eu`, servizi tarati sul sito reale (modulo contatti, Google Fonts, log hosting) al posto di quelli WordPress; rimossi riferimenti obsoleti (Privacy Shield). Collegata dal footer e dal consenso del form. Nota: riguarda il **sito**; l'app ha l'informativa dedicata del legale. Testo da validare col consulente privacy.
- `[Prodotto]` **Sito di presentazione — v3 grafico + animazione "tu al centro"** — `../Metabole_Sito_Presentazione.html` rifatto come sito vero, non landing: **animazione orbitale nell'hero** (cliente al centro, Gaia che ruota e connette Menu/Coach/Nutrizionista/Eventi/Imprevisti), **foto reali** (Unsplash con fallback Picsum sicuro), tipografia editoriale (Fraunces+Inter), sezioni ricche (concept, banda foto, team con Russolillo + coach, "un giorno con te", storie con volti, FAQ, CTA immersiva). Tono meno commerciale, più umano. Restano CTA app + form lead (`data-endpoint` da collegare). → da fornire foto reali del team; deploy Vercel/sottodominio.
- `[Prodotto]` **Sito di presentazione — v2 più umano/reale** — `../Metabole_Sito_Presentazione.html` riscritto con meno tono "markettaro" e le **persone** al centro: sezione **team reale** (dott. Salvatore Russolillo responsabile scientifico + le 8 coach e supervisora), **spazi per foto vere** (hero, team, piatti, testimonianze) con etichette che descrivono la foto da inserire, tono caldo. Restano CTA → app.metabole.eu + form lead (`data-endpoint` da collegare al CRM). Compliance ok (no prima/dopo, no numeri/garanzie, 18+). → impatto [Sviluppo]: endpoint pubblico "crea lead"; deploy Vercel/sottodominio. → da fornire: foto reali + nomi coach + ritratto Russolillo.
- `[Prodotto]` **App cliente — pag.16: "Flessibile" → "Keto"** — nella lista prodotti (array `PLANS`) del prototipo (e `docs/`) sostituito il piano *Flessibile* con **Keto** (caratteristiche: pochi carboidrati, grassi buoni, sotto controllo del nutrizionista). Sintassi verificata. *(Nota: elenco demo; in produzione i prodotti arrivano dall'API.)*
- `[Prodotto]` **Checklist allineamento web app ↔ prototipo** — `../Metabole_Checklist_Allineamento.md/.pdf`: 34 schermate onboarding + dashboard + popup, ognuna con casella da spuntare; a supporto della direttiva di replica 1:1.
- `[Prodotto]` **DIRETTIVA per lo Sviluppo — replica 1:1 del prototipo nella web app** — deciso: il prototipo `docs/Metabole_Prototipo_Navigabile.html` è la **versione finale** dell'app cliente; la web app va allineata **1:1** (sezioni Mente/Vita/Agenda/Gusto/Corpo + colori, contenuti, pagine e ordine, testi di Gaia scritti e parlati, dashboard, popup, navigazione). **Unica eccezione: il pagamento Stripe reale** resta quello della web app. Doc `../Metabole_Direttiva_Replica_Prototipo.md/.pdf` con valori esatti (colori sezioni, palette, ordine 34 schermate) + **prompt pronto** da incollare all'AI di Simone. → impatto [Sviluppo]: allineare la web app schermata per schermata al prototipo.
- `[Prodotto]` **App cliente/Onboarding — campi anagrafici + schermata privacy** — nel prototipo (e `docs/`): pag.19 "Come vuoi essere chiamata?" ora mostra **sempre Età + Sesso (Uomo/Donna)** sotto il Nome (prima erano nascosti finché non scrivevi il nome); pag.20 "Il tuo punto di partenza" ha in più il campo **Altezza (cm)**; **nuova schermata "Trattamento dei dati personali"** (GDPR + consenso) inserita **dopo pag.24 (colore)**, con voce di Gaia: *"Manca solo la tua approvazione al trattamento dei dati personali e potrò costruire il tuo percorso personalizzato di MetaboleAI. Clicca su accetta e procedo."* Flusso **35 passi** (conteggio dinamico); verificato a runtime con jsdom. → **voce da rigenerare** (solo `privacy`, testo cambiato): `FORCE=1 ONLY="privacy"`. → impatto [Sviluppo]: replicare campi e schermata consenso nell'app React.
- `[Prodotto]` **Prodotto/Motore — Gestione eventi programmabili** — nuovo `../Metabole_Gestione_Eventi.md/.pdf`: sezione dashboard per programmare gli eventi (matrimonio, vacanze, sgarro, +altri) a fasi Prima/Il giorno/Dopo, con leve configurabili (modalità menu dimagrimento/mantenimento/nessun menu, messaggio Home, integratori prescritti dal nutrizionista non selezionabili, politica misure con/senza blocco, spegnimento consigli, coach più attiva + soglie Δkg/Δcm). Template configurabili da nutrizionista/admin, istanza da agenda cliente; riusa stati agente pre/post_evento e le fasi agenda esistenti; data-driven (zero-redeploy). → impatto [Sviluppo]: entità EventType/EventPhase/ClientEvent/EventSupplementPlan; hook motore fase-attiva; regole alert event-driven.

- `[Prodotto]` **Prototipo — pagina 16 cablata: caratteristiche al tocco** — nel prototipo (e `docs/`) la pagina 16 ora rende i piani da un array `PLANS` (come dall'API) e, al tocco sul nome, apre il pannello **Caratteristiche principali** (un solo pannello per volta, riusa `data-show`/`data-panel`). Verificato a runtime con jsdom (4 piani, apertura/chiusura ok, scelta salvata in `state.plan`). Voce generica invariata. → riferimento visivo per lo Sviluppo dell'app.

- `[Sviluppo]` **Notifiche — campanella in-app collegata al server + preferenze + guida push** — la
  **campanella** nell'header ora mostra le notifiche reali (`GET /me/notifications`): titolo/testo dal
  `payload`, icona per tipo, ora relativa ("5 min fa"), **badge** con le non-lette, tap = segna-letta
  (`PATCH /me/notifications/:id/read`) e "Segna lette" per tutte. In **Profilo** nuova sezione
  **Notifiche**: interruttore "anche via email" + on/off per ogni tipo (`GET/PATCH
  /me/notifications/prefs`); le notifiche di sicurezza e del team restano sempre attive. Type-check e build
  ok. Per il **push sul telefono** (passo successivo scelto: "prima in-app, poi push") ho scritto la guida
  `../Metabole_Notifiche_Push_Setup.md`: Simone crea il progetto **Firebase** (package `app.metabole.client`)
  e passa `google-services.json` + service account (su Render), poi collego app (`@capacitor/push-notifications`)
  e server (modello `PushToken` + invio FCM dentro `notifyOncePerDay`, rispettando le preferenze).
- `[Sviluppo]` **App cliente — Agenda rifatta come nel prototipo** — la schermata Agenda ora segue il
  prototipo: **"Prossimi appuntamenti"** (reali da `GET /me/agenda`: ora/data, coach o nutrizionista, tipo,
  tag "Con la coach"/"Col nutrizionista"), **"Prenota un appuntamento"** (foglio: la prenotazione diretta
  arriva presto → intanto "Chiedi a Gaia"), **"Il tuo piano"** (da `GET /me/subscription`: nome piano,
  "scade tra N gg", **Rinnova** → Shop). Sotto restano i **giorni no-diet** (aggiungi/rimuovi + piano
  prima/durante/dopo) così non si perde la funzione. Type-check e build ok.
- `[Sviluppo]` **App cliente — header comune anche su Menu, Assistente e Profilo** — uniformato l'header
  teal `AppHeader` (MetaboleAI + titolo + notifiche/da-completare/shop/profilo) sulle ultime schermate che
  restavano con la vecchia intestazione: **Menu** ("Il tuo menu"), **Assistente** ("Gaia") e **Profilo**
  ("Profilo", con sotto il blocco avatar/nome). Ora **tutte** le schermate dell'app hanno lo stesso header
  del prototipo. Type-check e build ok. Allineato il workspace alla pull del socio (registro/stato) prima
  di procedere. **Nota:** la decisione navigazione risulta CONFERMATA dal socio (stessa del prototipo),
  quindi il lavoro precedente è validato. Prossimo grande filone [Sviluppo] dalla pull: **prodotti
  dinamici / zero-redeploy** (entità `Product`, wizard backoffice, agente per prodotto, **pagina 16**
  dell'onboarding che legge i prodotti dall'API con voce di Gaia generica) — da pianificare, tocca
  backend + backoffice + app.
- `[Prodotto]` **Prodotto — campo "Caratteristiche principali" del prodotto** — ogni prodotto porta `client_description` + `highlights` (3–5 punti), inseriti nel wizard (step Anagrafica) e **mostrati al cliente** al tocco sul nome del piano a pagina 16. Aggiornati spec sviluppo (modello dati/wizard/pag.16), catalogo (B1) e mockup wizard. Coerente con la voce generica di Gaia. → impatto [Sviluppo]: campi `Product.client_description`/`highlights` + vista dettaglio al tap.
- `[Prodotto]` **Voce/Prodotto — pagina 16 voce generica (zero-redeploy audio)** — la voce di Gaia a pag.16 non elenca più le diete: da "…mediterranea, proteica, low-carb…" a **"Scegli il piano più adatto alle tue esigenze: tocca il nome di un piano per scoprirne le caratteristiche principali."** (prototipo + `docs/` + `tools/genera_voci_gaia.mjs`, chiave `q_stile_che_preferisci`). I nomi prodotti restano solo testo a schermo (dinamici) e sono toccabili per aprire la descrizione. → **voce da rigenerare SOLO quella chiave**: `ONLY=q_stile_che_preferisci` (mai FORCE su tutte). Regola aggiunta in Spec_Prodotti_Dinamici §0.
- `[Prodotto]` **Sviluppo(req) — ZERO-REDEPLOY per i prodotti** — aggiunto requisito in `../Metabole_Spec_Prodotti_Dinamici_Sviluppo.md` §0: creare/modificare un prodotto NON deve mai richiedere ripubblicazione app (web/nativa) né deploy backend. Il client legge i prodotti dall'API a runtime; menu/regole sono dato. → impatto [Sviluppo]: pagina 16 e motore data-driven; niente liste hardcodate.
- `[Prodotto]` **Prodotto — Schede regole (microcopy wizard) + mockup wizard "Crea nuovo prodotto"** — `../Metabole_Schede_Regole_Wizard.md/.pdf` (testo semplice regola-per-regola con domanda di consenso, come lo legge il nutrizionista) e `../Metabole_Wizard_Crea_Prodotto.html` (mockup dei 5 passi: anagrafica → menu → regole → proposta → attivazione con agente dedicato). Riferimenti per lo Sviluppo del wizard.
- `[Prodotto]` **DECISIONI — navigazione app + nome prodotto** — (1) **Navigazione app cliente DECISA**: si adotta quella del prototipo *Home · Percorso · Obiettivi · Contatti · Agenda* (Shop in header); la versione *Menu · Obiettivo · Home · AI · Agenda* è la vecchia, **da sostituire**. → impatto [Sviluppo]: creare Percorso e Contatti, spostare Menu nella Home, trasformare AI in Contatti. (2) **Nome 2° protocollo estate confermato: "Ritorno in Equilibrio"**.
- `[Prodotto]` **Sviluppo(handover)/Motore — Spec prodotti dinamici + obiettivo mantenimento** — nuovo `../Metabole_Spec_Prodotti_Dinamici_Sviluppo.md/.pdf`: modello dati (`Product`, `Menu(product_id)`, `Recipe`, `ProductRule`, `RuleProposal`), wizard backoffice, API bozza, agente per prodotto, pagina 16 dinamica, vincoli (isolamento S1 enforced a DB). Aggiunto obiettivo prodotto **dimagrimento/mantenimento** in `../Metabole_Motore_Personalizzazione.md` §0ter. → impatto [Sviluppo]: è la spec da implementare per "Crea nuovo prodotto".
- `[Prodotto]` **Motore/Prodotto — Catalogo regole motore + wizard "Crea nuovo prodotto"** — nuovo `../Metabole_Regole_Motore_Catalogo.md/.pdf`: tutte le regole del motore numerate e classificate (🔒 sicurezza sempre attive · ⚙️ opzionali con consenso), + spec della sezione dashboard "Crea nuovo prodotto" (nome + menu propri colazione/pranzo/cena + snack, consenso regola-per-regola, proponi nuova regola, un agente AI per prodotto). I due protocolli estate = due prodotti creati così; si scelgono a pag.16. → impatto [Sviluppo]: entità `Product` + `Menu(product_id)` + `ProductRule`; wizard backoffice; agente per prodotto; pag.16 legge i Product attivi.
- `[Prodotto]` **Prodotto — Testi di Gaia & template Coach (protocolli estate)** — copioni pronti (`../Metabole_Testi_Gaia_Coach_Estate.md/.pdf`) per Vacanze in Serenità e Ritorno in Equilibrio: Gaia (attivazione, valigia, quotidiano, gestione strappo, check-in soft, rientro) e Coach (buona partenza, bentornato, call). Tono "equilibrio senza colpa", nessun menu, nessuna promessa. → per lo Sviluppo/voce: nuove chiavi audio suggerite `estate_vac_*` / `estate_rit_*`.
- `[Prodotto]` **Motore/Prodotto — REGOLA: isolamento dei menu per prodotto (BLOCCO)** — ogni prodotto/protocollo ha il PROPRIO catalogo di menu; **mai** mischiare menu tra prodotti diversi, nemmeno per riferimento; a parità di piatti si **duplicano, non si condividono**; i menu li fornisce il nutrizionista, l'AI non li inventa né prende in prestito. Aggiunta in `../Metabole_Motore_Personalizzazione.md` (§0) e in `../Metabole_Piani_Estate` (§0). → impatto [Sviluppo]: menu legati a `product_id`, nessun riferimento/join tra cataloghi di prodotti diversi. I due protocolli estate hanno cataloghi propri, **vuoti** finché il nutrizionista non li popola. Fissata anche come **regola ferrea** in `STATO.md`.
- `[Prodotto]` **Prodotto — Piani d'estate (luglio): Vacanze in Serenità & Ritorno in Equilibrio** — spec dei due percorsi stagionali (`../Metabole_Piani_Estate.md/.pdf`): mantenimento in vacanza (menu freddi/portabili, bussola-ristorante, misure non bloccanti) e ripartenza dolce al rientro (reset 1ª settimana → ritmo 2ª). Costruiti sui mattoni esistenti (stati agente, catalogo estivo, segnali). **Scope**: sono modalità sopra la dieta scelta; menu concreti oggi solo per la **Mediterranea** (unico catalogo reale), altri regimi = logica ma catalogo da costruire. → impatto [Sviluppo]: segnale `travel_mode` (date) che accende mantenimento/rientro; sospendere popup misure in vacanza; evento `rientrato` al CRM. Aggiunto anche `../Metabole_Macchina_Marketing_Schema.svg` (schema visivo della macchina).
- `[Prodotto]` **Marketing — Macchina di marketing completa (8 agenti + Giudice) + integrazione** — aggiunti `../Metabole_Macchina_Marketing_AI`, `../Metabole_Agente_Contesto_Tempismo`, `../Metabole_Libreria_Creativa`, `../Metabole_Specifica_Giudice_Compliance` (.md/.pdf) e `progetto/INTEGRAZIONE_MARKETING.md`. La macchina: Contesto&Tempismo → Stratega → Creativo/Copy → **Giudice** (compliance, blocca prima di pubblicare) → Publisher → Lead → Analista. → impatto [Sviluppo]: implementare il Giudice (ruleset in `config_param` + audit) e gli endpoint agenti (lead/pubblicazione/consensi).
- `[Sviluppo]` **App cliente — navigazione allineata al prototipo navigabile (docs/)** — rifatta la struttura dell'app "dentro" seguendo **schermata per schermata** il prototipo in `docs/Metabole_Prototipo_Navigabile.html` (fotografato in headless per copiarlo fedele). Novità: **header comune `AppHeader`** (barra teal ad angoli arrotondati con "METABOLEAI" + titolo + 4 icone: notifiche, da completare, shop, profilo) su tutte le schermate principali; **tab bar** riordinata a **Home · Percorso · Obiettivi · Contatti · Agenda** (solo icone, quella attiva in un quadrato teal rialzato, come nel prototipo). **Home** semplificata al prototipo: "IL MENU DI OGGI" (carosello pasti + Spesa), "PROSSIMO APPUNTAMENTO", card "GAIA · LA FRASE DI OGGI" — dati reali dal backend. Due **nuove pagine**: **Percorso** ("IL MENU DI OGGI" + "Diario del percorso" con schede *Menu passati* / *Eventi*) e **Contatti** (team Gaia · coach · nutrizionista con stato LIVE e "Conversazioni passate", nota privacy) — nomi reali dal profilo. **Accedi** rifatto come **foglio che sale dal basso** sopra la Landing ("Bentornata", Email o username, Password, Entra, Password dimenticata?), identico allo screenshot. Aggiunti header teal a **Obiettivi** ("I tuoi obiettivi"), **Agenda**, **Shop**. Rotte nuove `/percorso`, `/contatti`, `/shop`. Type-check e build di produzione **ok**; verifica visiva delle schermate fatta in headless (combaciano col prototipo). Note oneste su cosa NON è (ancora) allineato: **Menu, Assistente (chat Gaia) e Profilo** hanno ancora la loro intestazione (non il nuovo header comune); nella "Percorso · Menu passati" non mostro il segno kg perso/preso perché quel dato non è ancora esposto dal backend (mostro "N pasti"); su Home ho tolto la riga acqua/passi e le azioni rapide che nel prototipo non ci sono (si possono rimettere altrove se vuoi); i badge notifiche/da-completare compaiono solo con conteggi reali (niente numeri finti) e per ora aprono un foglio segnaposto. Schermi 27–29 (video coach/nutrizionista, assaggio menu) e 33 (widget) restano fuori: i video li hai chiesti di saltare, gli altri aspettano contenuti reali.
- `[Prodotto]` **Nuovi documenti dal socio (da lavorare come step successivi)** — caricati `Metabole_Libreria_Creativa.pdf` e `Metabole_Integrazione_Marketing_Deploy.pdf`: da leggere e integrare nei prossimi passi (marketing/creatività e integrazione deploy). **TODO prossima sessione.**
- `[Sviluppo]` **App cliente — TypeText esteso a Onboarding e Home + allineamento Home al prototipo** —
  l'effetto "a macchina da scrivere" di Gaia è ora applicato anche: alle **intro di sezione** e alla
  **bolla di ogni domanda** dell'Onboarding (rimonta ad ogni domanda, così ricompone), all'**overview
  "Facciamo conoscenza"** (schermo 4, "cinque punti" in grassetto), e alla **frase del giorno di Gaia in
  Home** (si ricompone ogni volta). Home: etichetta della card allineata al prototipo →
  **"GAIA · LA FRASE DI OGGI"** con icona *sparkles*. Type-check app ok. Consegnati `Onboarding.tsx`,
  `Home.tsx`.
  Aggiunto anche lo **schermo 25 "Sto cucendo il tuo percorso"**: transizione a schermo intero (Gaia
  grande + bolla che si compone + spinner) mostrata mentre il motore calcola, con durata minima ~3,2s
  come nel prototipo (onesta: compare durante il vero calcolo, non è un finto ritardo). Build di
  produzione ok.
  **⚠️ DECISIONE APERTA (serve Simone) — navigazione a tab.** Il prototipo in `docs/` usa la barra
  **Home · Percorso · Obiettivi · Contatti · Agenda** (+ Shop), mentre l'app oggi ha
  **Menu · Obiettivo · Home · AI · Agenda** (e nel codice questa era marcata come "prototipo definitivo").
  Sono due architetture di navigazione diverse: allinearle vorrebbe dire creare le pagine **Percorso** e
  **Contatti** (oggi assenti), spostare **Menu** dentro la Home e trasformare **AI/Assistente**. È un
  cambio strutturale importante e reversibile solo con lavoro: **non l'ho fatto in autonomia**. Da decidere
  insieme quale delle due barre è quella buona prima di procedere.
- `[Sviluppo]` **App cliente — testo "a composizione" (TypeText) + Fase 2 (Crea account)** — come nel
  prototipo, i testi di Gaia si **compongono a macchina da scrivere mentre lei parla**: nuovo componente
  riutilizzabile `TypeText` (rispetta grassetti e `prefers-reduced-motion`, cursore lampeggiante),
  applicato alla card assistente della Landing, alla bolla di "In cosa siamo diversi" e di "Crea account";
  da usare su tutti gli schermi. **Fase 2**: `Register` (schermo 3) allineato al mockup — registrazione
  minimale (Nome/Cognome/Email/Password/Codice invito con nota, l'indirizzo si prende al checkout),
  barra "Passo 3 di 34", "oppure registrati con" Apple/Google (placeholder "in arrivo"). Type-check ok.
  Nota: il prototipo live non è raggiungibile dalla sandbox (rete ristretta) e la copia locale è una
  versione più vecchia (28 step) → animazioni calibrate sul video del socio.
- `[Sviluppo]` **App cliente — allineamento al prototipo "34 schermate" (Fase 1)** — dai riferimenti del
  socio (video del flusso + PDF sequenza esatta + prototipo navigabile) il funnel nuovo cliente è di
  **34 step** con barra "Passo N di 34" e tab di sezione. Ricostruita la **Landing (schermo 1)** fedele al
  mockup: brand **MetaboleAI** (teal+viola), claim "Non una dieta: un'AI…", card assistente Gaia con audio,
  **Accedi/Registrati**, prova sociale (★ 24.000 persone), 2 testimonianze. Nuovo schermo **"In cosa siamo
  diversi" (schermo 2)**: 5 punti (Coach sempre presente, Nutrizionista specializzato, App intelligente,
  Dieta personalizzata, Gaia · supervisore AI) + "Sono pronta/o". Rotta `/diversi`. Type-check app ok.
  Resta da allineare (a fasi): 3 Crea account (+Apple/Google), 4 Facciamo conoscenza, le intro sezione +
  domande (5-23) con chrome "Passo N di 34" + tab, 24 colore app, 25 "Sto cucendo il tuo percorso", 26
  percorso pronto, 27-28 video coach/nutrizionista, 29 assaggio menu, 30 scegli piano, 31 riepilogo, 32
  data inizio, 33 tutto pronto (widget). La logica (onboarding, checkout, plan flow) è già a backend.
- `[Sviluppo]` **App staff role-adattiva — Home Coach e Home Nutrizionista** — deciso (con Simone) di NON
  fare tre app React separate: il backoffice diventa **un'unica app staff che cambia in base al ruolo**
  (l'app cliente resta separata, per sicurezza/GDPR e distribuzione store). La Home (rotta `/`) ora è un
  dispatcher (`Home.tsx`): coach → **`CoachHome`** (KPI clienti/avvisi/piani in scadenza/guadagni, lead da
  accettare con Accetta/Rifiuta, coda avvisi con gestito/escalation, elenco clienti, link d'invito con
  copia), nutrizionista/capo → **`NutritionistHome`** (KPI clinici, coda di validazione decisioni
  motore/diete/protocolli con Conferma/Correggi, pazienti che richiedono attenzione), altri → dashboard
  generale. Tutto sul backend Fasi 4/7 già pronto. Il menu era già filtrato per permessi. Type-check ok.
  Prossimo: rendere le viste comode anche da telefono e rifinire i dettagli cliente per coach/nutrizionista.
- `[Sviluppo]` **Backlog #2 — Invito cliente dalla coach (ref code)** — la pagina di registrazione dell'app
  ora accetta il codice invito dal link (`/register?ref=CODICE`, precompilato e con nota "codice applicato");
  ampliato il campo a 8 caratteri per supportare anche i codici "porta un'amica" (8) oltre a quelli coach (6).
  Nuovo endpoint self-service `GET /crm/my-invite` (ruolo coach): restituisce il proprio ref code (creato se
  manca) + il link di registrazione pronto da condividere (base da `APP_URL`). Così la coach ha subito il suo
  link d'invito (la UI dedicata arriverà con l'app coach). Il backend di auto-assegnazione via ref code
  esisteva già. 3 test nuovi.
- `[Sviluppo]` **Backlog #1 — Assegnazione lead a tempo: soglia in config** — il flusso c'era già
  (assegna→pending, la coach accetta/rifiuta entro N giorni, scadenza via cron con notifica alla responsabile
  per riassegnare). Portata la **finestra di accettazione da hardcodata (2 giorni) a config** `lead_accept_days`
  (default 2), usata sia dal conto alla rovescia in "Lead da accettare" sia dalla scadenza del cron; testo
  della notifica reso dinamico. 2 test nuovi. Con questo il #1 è completo.
- `[Sviluppo]` **Backlog #3 — Numero versione app** — la versione (da `app/package.json`) viene iniettata a
  build-time come costante `__APP_VERSION__` (Vite `define`) e mostrata in piccolo/discreto in fondo alla
  pagina Profilo ("Metabole · v0.1.0"). Solo front-end app cliente.
- `[Sviluppo]` **Backlog #0 — Permessi: pulsante "Salva" con conferma** — la matrice Permessi non salva
  più ogni interruttore all'istante: le modifiche si accumulano in locale (celle evidenziate + barra
  "N modifiche non salvate"), poi **Salva** apre un **modale di conferma** e invia il batch dei PATCH
  (una cella per volta, come da API), con toast di esito; "Annulla" scarta le modifiche. Regola "senza
  vede niente gestisce" mantenuta. Solo front-end.
- `[Sviluppo]` **Fix seed admin da Render (password che "non funzionava")** — `ensureAdminFromEnv` prima
  applicava `ADMIN_PASSWORD` SOLO alla creazione dell'account: se l'admin (`ADMIN_EMAIL`, es.
  `admin@metabole.eu`) esisteva già, la password su Render veniva ignorata → login impossibile. Ora il
  seed: promuove ad admin, e **applica `ADMIN_PASSWORD`** se la password non è mai stata impostata
  (placeholder) o se si imposta `ADMIN_PASSWORD_RESET=true` (reset forzato una tantum, poi si rimuove la
  var); riattiva l'account se sospeso/archiviato. Così `admin@metabole.eu` è l'**admin principale
  recuperabile da Render** (e resta non archiviabile, anti-lockout). Documentato in `render.yaml`.
  Gira nel `preDeployCommand` a ogni deploy.
- `[Sviluppo]` **Ruoli Marketing + archiviazione utenti + foto profilo (pulizia account)** — tre interventi
  a supporto della gestione utenti:
  1) **Ruoli Marketing**: nuovi ruoli RBAC `marketing` e `head_marketing` (Responsabile Marketing) —
     enum Prisma + migrazione, `roles.ts`, permessi di default (dashboard/grafici/CRM in lettura, sezione
     `marketing` gestibile; il capo marketing vede anche modelli email e contabilità incassi), etichette,
     voce di menu "Marketing" (pagina placeholder: il modulo vero è da costruire). Così si può creare un
     account "Responsabile Marketing".
  2) **Archivia/ripristina utente** (soft-delete): `DELETE /admin/users/:id` (imposta `deletedAt` + sospeso
     + revoca sessioni) e `POST /admin/users/:id/restore`. **Protezioni anti-lockout**: non ci si può
     archiviare da soli e non si può archiviare l'admin legato alla variabile Render `ADMIN_EMAIL`.
     La tabella Utenti ha "Mostra archiviati", il pulsante Archivia e il Ripristina. 6 test.
  3) **Foto profilo**: campo `photoUrl` su User + migrazione; in Impostazioni si carica un'immagine
     (ridotta a 256×256 lato client come data URL) usata come **avatar** nel menu utente in alto (altrimenti
     iniziali). PATCH `/me/account` accetta `photoUrl` (solo data URL immagine, o null per rimuoverla).
  4) **Impostazioni** tolte dalla sidebar (ora si aprono dal menu utente/avatar in alto).
  Suite 356 verde; migrazioni validate su PG16.
- `[Sviluppo]` **Backlog #6 — Modulo Contabilità (costi + conto economico)** — nuovo modello `CostEntry`
  (costi ricorrenti + una tantum: infrastruttura, marketing, stipendi, tasse, AI…) + migrazione (validata
  PG16). `AccountingService` con aggregazione **pura e testata** (`buildReport`/`costInMonth`/`monthsBetween`):
  conto economico del periodo — incassi (da `LedgerEntry`) vs costi (uscite a ledger provvigioni/compensi +
  costi manuali), per categoria, serie mensile, e KPI **utile, margine, CAC, ARPU, spesa marketing, nuovi/
  paganti**. I costi ricorrenti annuali sono **ammortizzati /12** per un P&L mensile liscio. Endpoint admin
  `GET /admin/accounting/report?from&to` e CRUD costi `/admin/accounting/costs`. Pagina backoffice
  **Contabilità** (`/contabilita`, chiave permesso `accounting_costs`): selettore periodo, KPI, 3 grafici
  mensili (incassi/costi/utile, un asse per grafico riusando `MiniTrend`), costi per categoria, tabella
  costi con aggiungi/modifica/elimina. 13 test backend, suite 350 verde.
- `[Sviluppo]` **Backlog #5 — Avatar/menu utente (backoffice)** — nell'header, al posto di
  "email · ruolo", ora c'è un **avatar a iniziali** (colore stabile dall'email) cliccabile che apre un
  **menu utente** (email+ruolo, **Impostazioni**, **Esci**), con chiusura su click-fuori/Esc. Nuovo
  componente `UserMenu.tsx` + stili. Foto profilo: futura.
- `[Sviluppo]` **Backlog #7 — Calendario CRM cliccabile** — nel calendario promemoria, cliccando su un
  promemoria si apre un **modale** per **modificarlo**, **spostarlo** (nuova data/ora → `PATCH /crm/reminders/:id`,
  già disponibile), segnarlo completato o eliminarlo, con le **azioni rapide di contatto** (chiama /
  WhatsApp / email) del lead collegato. Estratto un componente `ContactActions` riusato anche in
  creazione. Solo front-end (backend già pronto).
- `[Sviluppo]` **Fase 7 (parte 2) — Coda di validazione (diete/protocolli/decisioni) per-paziente** —
  nuovo `GET /nutritionist/validation-queue`: raccoglie ciò che il nutrizionista deve validare —
  **decisioni del motore** marcate per revisione filtrate PER-PAZIENTE (solo i pazienti assegnati; il
  capo/admin le vede tutte), **diete in revisione** da approvare (solo il capo) e **protocolli** in
  attesa (mai i propri) — con nomi paziente e contesto. Nuovi `POST /nutritionist/decisions/:id/confirm|correct`
  che applicano lo **scoping per-paziente** (un nutrizionista revisiona solo le decisioni dei suoi
  pazienti) e delegano la scrittura all'EngineService (idempotenza + audit già lì); le azioni su
  diete/protocolli riusano gli endpoint esistenti (catalog / protocols). 7 test nuovi, suite 337 verde.
  Nessuna migrazione. (Nota sicurezza: gli endpoint `/engine/decisions/:id/confirm|correct` restano
  NON scoped — vedi follow-up in STATO.)
- `[Sviluppo]` **Fase 6 (completamento) — Agente: post-evento, rientro, guardrail conforto** — estesa
  la macchina a stati `DietAgentService`: nuovi stati **post_evento** (evento concluso negli ultimi N
  giorni → spinta efficacia per il recupero) e **rientro**, con due inneschi: il **guardrail** (troppi
  giorni di conforto consecutivi oltre `agent_comfort_max_days` → si esce dai menu "amati" e si torna
  a spingere l'efficacia) e il **recupero** (umore risalito dopo un periodo difficile entro
  `agent_reentry_days`). La "memoria" dello stato si ricava dallo storico dei check-in (nessuna tabella,
  nessuna migrazione). La selezione menu tratta post_evento/rientro come plateau (boost efficacia).
  Priorità: pre_evento > post_evento > plateau > conforto/guardrail/rientro > normale. Nuove soglie in
  config. **Con questo l'agente della Fase 6 è completo.** 8 test (suite 330 verde).
- `[Sviluppo]` **Fase 5 (avanzata) — Attribuzione causale del pasto** — nuova funzione
  `distinctiveCredits`: alla chiusura di un ciclo il merito/demerito non va più in parti uguali a tutte
  le ricette, ma è pesato per **distintività** — la ricetta rara (quella che è CAMBIATA nel ciclo) è la
  causa più probabile di un esito diverso dal solito e prende più credito, quelle sempre presenti lo
  prendono scontato (peso = 1/(1+alpha·samples), normalizzato). Se tutte hanno la stessa frequenza il
  credito torna uniforme. **Opt-in** via `learning_distinctive_weighting` (default false → comportamento
  v1 naive invariato) + `learning_distinctiveness_alpha`. Non è una prova causale: è un modo trasparente
  per far emergere prima il pasto che sposta l'ago. **Con questo il motore v1 della Fase 5 è completo.**
  9 test (suite 327 verde). Nessuna migrazione.
- `[Sviluppo]` **Fase 5 (avanzata) — Giornate bilanciate automatiche (DayCombo)** — nuovo
  `DayComboService` (algoritmo puro, testabile): compone la giornata scegliendo una ricetta per slot
  DENTRO il pool della dieta approvata, in modo che il totale kcal rientri nella banda del target del
  livello (`Diet.levels`), massimizzando il punteggio efficacia+gradimento (modulato dallo stato) e
  ruotando tra le combinazioni migliori per varietà; penalità soft sulla quota proteica giornaliera.
  Pool piccoli → enumerazione completa; pool grandi → greedy. **Opt-in** via `menu_daycombo_enabled`
  (default false): se spento, o se il livello non ha un target kcal, o se nessuna giornata rientra nella
  banda → fallback ai template composti a mano + selettore per-slot (comportamento attuale invariato).
  Refactor: estratto `buildScoringContext` (pool+punteggio) condiviso da selettore e DayCombo. Non
  allarga mai l'insieme ricette approvato dal nutrizionista. 10 test nuovi, suite 322 verde. Nessuna
  migrazione (usa `Diet.levels` e i campi ricetta già esistenti). Resta l'attribuzione causale del pasto.
- `[Sviluppo]` **Fase 8 (parte 1) — "Porta un'amica" (referral cliente)** — ogni cliente ha un
  `referralCode` (8 caratteri, distinto dai ref code coach a 6) sul profilo; nuovo modello `Referral`
  (FK-less: referrer/referred = userId, una invitata = un solo invito) + migrazione (validata PG16).
  `ReferralService`: `ensureCode`, `myReferral` (codice + inviti/conversioni/ricompense), `isClientCode`,
  `linkOnRegister`, `onConvert`. In **registrazione** il codice coach ha la precedenza; se non è un
  codice coach ma di una cliente, si registra l'invito (prima il codice ignoto veniva rifiutato).
  Alla **prima attivazione dell'abbonamento** dell'invitata (`finalizeApproval`) scatta la ricompensa:
  l'abbonamento attivo della referrer viene esteso di `referral_reward_days` (config, default 30);
  se la referrer non ha un abbonamento attivo la ricompensa resta in sospeso (convertita ma non premiata).
  Endpoint cliente `GET /me/referral`. 8 test nuovi, suite 313 verde. (Il resto della Fase 8 — piani,
  checkout, provvigioni, ledger, payout — era già presente.)
- `[Sviluppo]` **Fase 7 (parte 1) — App Nutrizionista: pazienti + dashboard** — nuovo modulo
  `nutritionist`: `GET /nutritionist/patients` (pazienti assegnati con riepilogo clinico: ultima misura,
  escalation aperte, documenti da revisionare, prossima visita, ordinati per attenzione) e
  `GET /nutritionist/dashboard` (pazienti, documenti pending, escalation aperte, protocolli da validare
  `flaggedForReview`, visite in arrivo, guadagni mese/totale). Il dettaglio clinico è già in `health-area`
  (documenti/note/visite/agenda). Nessuna migrazione. 4 test nuovi, suite 303 verde.
- `[Sviluppo]` **Fase 6 (parte 1) — Agente AI: stati + selezione modulata** — nuovo `DietAgentService.stateFor`
  (pre_evento / plateau / conforto / normale, da eventi, cicli senza calo, umore recente). La selezione
  dei menu è modulata dallo stato: conforto → boost gradimento, plateau → boost efficacia, pre_evento →
  bonus proteine (dai macro). Sicurezza/bilanciamento restano prioritari; pesi in config. Le segnalazioni
  sono già coperte dall'Alert engine. 5 test nuovi, suite 299 verde. Restano Rientro/post-evento/guardrail.
- `[Sviluppo]` **Fase 5 (parte 4) — Selezione menu per efficacia+gradimento** — alla composizione della
  giornata, per ogni slot il motore sceglie la ricetta col punteggio migliore
  (`w_eff·efficacia(MenuWeight) + w_grad·gradimento(stelle)`, default 5★, tie → template), SOLO tra le
  ricette della dieta approvata per quello slot e con vincolo kcal (bilanciamento). Pesi/tolleranza in
  config. Con questo il **nucleo v1 del motore è completo** (esclusioni+sostituzione+learning+selezione).
  1 test nuovo, suite 294 verde.
- `[Sviluppo]` **Backoffice — pagina Chat + auto-riparazione permessi** — nuova pagina `Chat.tsx`
  (staff↔cliente: elenco conversazioni, messaggi, invio) + voce di menu (chiave `chat`) + rotta.
  Risolto anche il problema "sezioni non nel menu" (es. Parametri): `PermissionsService.syncDefaults`
  gira all'avvio e crea le righe permessi mancanti dai default (senza sovrascrivere le modifiche admin),
  così le sezioni aggiunte dopo il seed ricompaiono. Audit menu↔permessi registrato in STATO. Suite 293.
- `[Sviluppo]` **Fase 5 (parte 3) — Learning: esito ciclo + MenuWeight** — nuovi modelli `CycleFeedback`
  (esito peso/cm per ciclo di 2 giorni) e `MenuWeight` (efficacia appresa per ricetta/cliente) +
  migrazione (validata PG16) + soglie config. `DietLearningService.onCycleClose` (trigger da
  `signals.upsertMeasurement`): calcola delta peso/cm vs misura precedente, determina l'esito, e se il
  ciclo è stato seguito aggiorna i MenuWeight delle ricette del ciclo (attribuzione naive). 4 test nuovi,
  suite 292 verde. Manca la selezione per efficacia+gradimento (sostituirà i template fissi).
- `[Sviluppo]` **Fase 5 (parte 2) — Sostituzione equivalente** — se un ingrediente escluso ha un
  sostituto sicuro (mappa: yogurt→senza lattosio, pane→senza glutine, funghi→cavolfiore…) il piatto si
  eroga con la **nota di sostituzione** salvata nello snapshot del pasto e mostrata in Menu; il blocco
  scatta solo se un'intolleranza NON è sostituibile. I cibi non graditi (`dislikedFoods`) si sostituiscono
  ma non bloccano. 2 test nuovi (blocco non-sostituibile / erogazione con sostituzione), suite 288 verde.
- `[Sviluppo]` **Fase 5 (parte 1) — Sicurezza esclusioni (motore menu)** — prima dell'erogazione i piatti
  del ciclo vengono controllati contro le **intolleranze/allergie** della cliente (mappa
  intolleranza→ingredienti, es. lattosio→yogurt/formaggio): se un piatto è incompatibile, il menu NON
  viene erogato e si apre un'**escalation "Piano bloccato" al nutrizionista** (la coach la vede via Alert
  engine, `escalation_open`). `GET /me/menu` ora espone `blocked{active,reason}` e l'app Menu mostra il
  banner "stiamo sistemando il tuo piano". Sostituzione equivalente e giornate/learning = prossimi passi.
  1 test nuovo, suite 287 verde.
- `[Sviluppo]` **App cliente — box "Prossimo appuntamento" in Home** — nuova card nella Home che legge
  `GET /me/agenda?next=1` e mostra tipo/interlocutore/data del prossimo appuntamento; tap → Calendario.
  Type-check app verde.
- `[Sviluppo]` **Fase 4 (parte 3) — Riassunti conversazioni** — nuovo modello `ConversationSummary`
  (titolo AI + data, FK-less) + migrazione (validata PG16). `AiService.summarizeConversation` (titolo
  breve + una frase, con fallback deterministico). `ConversationSummaryService.generateDailyBatch`
  (chiude i thread con messaggi del giorno, upsert per cliente/interlocutore/data) agganciato al cron.
  Endpoint `GET /me/threads/:who/summaries` (cliente) e `GET /staff/threads/:clientId/:who/summaries`
  (staff, con scope; la coach non vede i riassunti col nutrizionista). 4 test nuovi, suite 286 verde.
  Con questo il backend della Fase 4 è sostanzialmente completo.
- `[Sviluppo]` **Fase 4 (parte 2) — Agenda e appuntamenti** — nuova entità `Appointment` (FK-less) +
  migrazione (validata PG16). `GET /coach/agenda` (appuntamenti futuri delle clienti: i propri
  gestibili, quelli col nutrizionista in sola lettura), `POST /appointments` (coach/nutrizionista solo
  per i propri clienti, con validazioni tipo/data), `PATCH /appointments/:id` (solo il proprietario),
  `GET /me/agenda` lato cliente (appuntamenti + scadenza piano; `?next=1` = solo il prossimo, per la
  Home). 7 test nuovi, suite 282 verde.
- `[Sviluppo]` **Fase 4 (parte 1) — App Coach: clienti + dashboard** — nuovo modulo `coach` con
  `GET /coach/clients` (lista clienti assegnate: nome, stato piano, ultima misura, alert aperti,
  ordinata per alert) e `GET /coach/dashboard` (conteggio clienti, piani in scadenza entro
  `expiring_plan_days`, guadagni mese/totale dal ledger, alert aperti). Riusa i guadagni dal
  ledger e l'Alert engine. 4 test nuovi, suite 275 verde. Restano agenda/appuntamenti, chat e
  riassunti conversazioni.
- `[Sviluppo]` **Fase 3 — Alert engine** — nuovo modello `Alert` (coda coach, FK-less) + migrazione
  `alert_engine` (validata PG16) + soglie in config. `AlertsService.recompute(clientId)` sincronizza gli
  alert dai segnali reali (missing_measurements, weight_gain, plateau, inactive, checkin_skipped,
  water_low, low_ratings, dropout_risk, event_incoming, escalation_open, milestone), idempotente e
  auto-risolve quelli non più validi. Endpoint `GET /coach/alerts` (scope coach/manager, ricalcolo lazy)
  e `PUT /alerts/:id` (handled/escalated). Ricalcolo giornaliero nel cron. Refactor Fase 2: il
  `missing_measurements` ora è un Alert vero (rimosso l'avviso via Notification). Suite 271 verde.
- `[Sviluppo]` **Diario di progetto** — creata la cartella `progetto/` (STATO, REGISTRO, README,
  ISTRUZIONI_PER_AI, PROMPT_PER_AI_SOCIO) come
  fonte di verità condivisa; aggiunti al repo i documenti Guida Pubblicazione, Standard CRM/Marketing,
  Schermate Nuovo Cliente. (Nota: il diario sta fuori da `docs/` perché `docs/` è pubblica.)
- `[Prodotto]` **Documenti** — inviati: Guida alla pubblicazione (demo GitHub Pages + deploy produzione),
  Reparto Marketing & Standard CRM (ruolo `head_marketing`, stadi lead, campi, consensi), Schermate
  Nuovo Cliente (sequenza), Punti di forza marketing.
- `[Sviluppo]` **Fase 2 — Misure bloccanti** — l'erogazione del menu richiede la misura del ciclo
  corrente prima di consegnare il ciclo successivo (altrimenti "held"); avviso alla coach
  `missing_measurements` (via Notification); `GET /me/measurement-gate`; sblocco automatico al
  `POST /me/measurements`; popup bloccante nell'app. 6 test nuovi, suite 263 verde. Nessuna migrazione.
- `[Sviluppo]` **Fase 1 — Tracciamento eventi** — modello `AnalyticsEvent` (append-only, idempotente),
  migrazione `analytics_event` (validata su PG16), modulo `tracking` con `POST /api/v1/events` (utente
  dal JWT se presente, sessione+refcod pre-login); client `track()` nell'app (viste, login, register con
  attribuzione refcod, logout). Fix build: campo Json `data` castato `as never` (errore TS su Render).
  7 test nuovi.
- `[Sviluppo]` **Widget su git** — set completo del widget a 3 formati (mascotte Gaia) versionato in
  `docs/android-widget/`; rimozione file spurio `ziSIv8Rd`.
- `[Prodotto]` **Prototipi & docs** — redesign app cliente (nav a icone, header gradiente, 5 sezioni,
  pagina "In cosa siamo diversi"), nuovi prototipi Coach/Nutrizionista, rigenerate le voci Gaia,
  aggiunti 10 documenti di analisi (motore, agente AI, certificazione, mercato, marketing, tracciamento).

## 2026-07-11

- `[Sviluppo]` **Widget home Android** — token widget dedicato (scope widget, 90gg) + endpoint pubblico
  `GET /widget` + file nativi; poi rifatto a 3 formati con la mascotte reale.
- `[Sviluppo]` **AI Claude collegata** — assistente chat con Claude + parametro `ai_assistant_enabled`.
- `[Sviluppo]` **Backoffice** — editor Diete (crea + componi giorni), Ricette (`PATCH /recipes/:id`),
  Protocolli (`PATCH /protocols/:id`); moduli dashboard trascinabili; grafici con assi mesi + tooltip.
- `[Sviluppo]` **App** — Home con dati reali (nome coach, CTA consigli), grafici Obiettivo con date +
  tooltip; guard account staff nell'app cliente (onboarding solo per i clienti).
- `[Sviluppo]` **APK** — progetto Android pronto, build da Android Studio; fix CORS per login da APK
  (origini native `https://localhost` / `capacitor://localhost`).

## Prima dell'11/7 (fondamenta)

- `[Sviluppo]` Backend API-first `/api/v1`: auth JWT+RBAC, onboarding, misure/obiettivi, catalogo,
  erogazione menu, motore a regole (M5), notifiche, CRM/commerce, permessi. Test verdi.
- `[Prodotto]` Prototipo navigabile app cliente, sequenza schermate, specifiche backend, analisi.


## 15 lug — notte (lavoro non presidiato)
- **Sito**: aggiunto blocco SEO/social (canonical, robots, theme-color, OG, Twitter, JSON-LD Organization) + lazy-load su 12 immagini in `Metabole_Sito_Presentazione.html`. Da ricaricare su SiteGround.
- **Diagnosi tasto Genera/anteprima mail**: codice presente e pushato (commit a51cbaa su origin/main); il backoffice live serve una build Vercel vecchia. Serve redeploy/verifica su Vercel (progetto metabole-backoffice). Dettagli in `progetto/BRIEF_MATTINA_20260715.md`.
- **pages.ts**: admin → engine_rules { view, manage } (da committare).
- Rimosso index.lock git bloccato (spostato in `_to_delete/`).
