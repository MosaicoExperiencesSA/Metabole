# Metabole — Registro delle modifiche

Log cronologico. **Si aggiunge in cima**, non si cancella. Formato: `data · [Team] · area — cosa`.
Autori: `[Sviluppo]` (Simone + Claude Cowork) · `[Prodotto]` (socio + AI).

> ⚠️ **Date riallineate l'11/8/2026.** Le sezioni erano avanti di uno o due giorni: il lavoro
> fatto la sera tardi veniva scritto sotto la data del giorno dopo, e lo scarto si è accumulato
> fino a due giorni. Le date sono state riportate a quelle vere dei commit su `origin/main`
> (`git log`), e tre sezioni si sono fuse con quelle sotto: l'ex «13» è l'11, l'ex «12» e l'ex «11»
> sono il 10, l'ex «10» è il 9. Da lì all'indietro (8/8 e prima) le date risultano già corrette.
> **Dentro ai testi delle voci del 9 e del 10 può essere rimasto qualche riferimento avanti di un
> giorno**: si controlla su `git log --date=format:'%F %H:%M'`, che è la sola fonte che non
> dipende da cosa credeva il calendario di chi scriveva.
>
> Il costo di non accorgersene: l'11/8, credendo che fosse il 13, ho letto «l'ultima decisione del
> motore è dell'11» come «il cron è fermo da due notti» e ho aperto un allarme su una cosa che
> stava funzionando. **La data si verifica, non si assume** — vale per me come per il resto.

---

## 2026-08-11

- `[Sviluppo]` 🔒 **Il questionario non cambia più la dieta dopo il primo invio — e per questo la
  correzione della nutrizionista tornava indietro da sola.** Trovato collaudando: su
  `sim1one.salogni@gmail.com` la dieta era stata spostata da **Pescetariana a Mediterranea due
  volte**, da due persone diverse, e tutte e due le volte era tornata indietro. Nell'audit della
  scheda si vedevano i due `Pescetariana → Mediterranea` e **nessun ritorno**: il ritorno non
  passava di lì.
  ⭐ **La causa.** `submitAnswers` è un `upsert`, e il ramo `update` riscriveva **ogni volta e senza
  condizioni** `regime`, `dietStyle`, `dietFamily`, `mealsPerDay` e `pathType` dalle risposte del
  questionario. Un secondo invio bastava a cancellare la decisione della nutrizionista e rimettere
  la dieta scelta in registrazione — senza errore e senza traccia, perché formalmente è un'azione
  della cliente sul proprio questionario. È **la stessa lezione dell'8/8** del consenso sanitario
  perso: [[feedback_upsert_due_rami]] — *un upsert sono due scritture, e il ramo `update` è quello
  che nessuno rilegge*. Due volte in quattro giorni, nello stesso file.
  **La regola, dettata da Simone:** «il cliente può fare il questionario **solo una volta**, al primo
  accesso; da lì in poi il nutrizionista, la coach o admin possono cambiare la dieta — il cliente
  non è autorizzato, se vuole cambiarla deve chiedere». Quindi con `onboardingCompletedAt` già
  valorizzato il questionario **non tocca più** il tipo di dieta; tutto il resto (misure, obiettivo,
  preferenze, allergie, consensi) continua ad aggiornarsi — è un congelamento mirato, non un
  rifiuto: bloccare l'invio intero avrebbe rotto flussi che funzionano per punire un campo. E il
  tentativo ignorato **si scrive nell'audit** (`onboarding.tipo_dieta_ignorato`, con proposto e
  attuale): sparire in silenzio è il difetto, la scrittura è la cura.
  ⚠️ **Un caso limite nato dalla correzione stessa**: la finestra del digiuno resta modificabile
  dalla cliente, ma ora guarda il percorso **in vigore** e non quello riproposto — se il reinvio
  dicesse «5 pasti» mentre lo staff l'ha messa a digiuno, `pathType` non cambia più e azzerare la
  finestra avrebbe lasciato una cliente a digiuno **senza sapere quali pasti salta**.
  Verifiche: build verde, **112 suite / 1724 test**, 6 nuovi (il primo invio che *deve* scrivere la
  dieta, il reinvio che non deve, l'audit del tentativo, la finestra del digiuno).
  📌 Nota permessi: «la coach può cambiare la dieta» è un **interruttore in Permessi**
  (`change_diet_type`, oggi acceso di default solo per nutrizionista e admin), non una modifica di
  codice.

- `[Sviluppo]` 🧩 **Clienti e Gestione lead sono la stessa tabella — e la nutrizionista non vede di
  più.** §16.4, seconda metà. `Clienti.tsx` erano 200 righe che rifacevano *quasi* quello che fa
  `LeadsTable`: stessa idea di filtri, ordinamento e ricerca, scritti una seconda volta. Due copie
  non restano uguali — l'ultima divergenza sono stati i **filtri fissi in cima**, che una aveva e
  l'altra no — e ogni richiesta andava applicata due volte o si dimenticava. Ora `Clienti` è **tre
  righe**: la stessa tabella con `modo="clienti"`, che cambia tre cose e nessun'altra — il filtro
  Tipo inchiodato a «Cliente» (`stage = paid`, cioè **chi ha pagato davvero**: è il «acquisto di
  valore maggiore di 0» chiesto da Simone, e non serviva inventare un conteggio nuovo perché
  esisteva già), via le azioni che riguardano i lead e non le clienti, e le parole. Guadagno non
  richiesto ma il più grosso: **ricerca e filtri lavorano sul database** e non sulle 500 righe
  caricate — l'avviso «mostro le 500 più recenti di N» non serve più, perché non è più vero.
  🔴 **La cosa che poteva rompersi in silenzio.** Le due liste **non avevano lo stesso perimetro**:
  `crm.list` restringeva solo per **coach** (`CrmRecord.assignedCoachId`), l'elenco Clienti anche per
  **nutrizionista**. Unificarle senza accorgersene avrebbe dato a ogni nutrizionista la vista su
  *tutte* le clienti dell'azienda — e **una lista più lunga non somiglia a un errore**: nessuno
  l'avrebbe segnalata. Aggiunto il perimetro riusando `perimetroClienti`, la definizione unica già
  usata da Clienti e Acquisti; si filtra sulla **cliente collegata** e non su un campo del CRM,
  perché la nutrizionista è assegnata alle clienti, non ai lead (conseguenza voluta: i contatti senza
  cliente non li vede). **Cinque test nuovi** guardano il `where` che finisce a Prisma: la
  nutrizionista filtrata, quella **senza scheda staff che deve vedere zero e non tutto**, la coach
  che resta com'era (se le arrivasse anche il filtro sulla cliente perderebbe i lead senza cliente
  collegata, cioè quasi tutti i suoi), l'admin senza perimetro, e `tipo=client` = `stage=paid`.
  Aperti due ruoli: `nutritionist` su `GET /crm/leads` e `GET /crm/stages` — senza, aprirebbe la sua
  pagina Clienti e prenderebbe un 403. Non le apre niente: la lista applica il suo perimetro, gli
  stati sono un'anagrafica, «Gestione lead» nel menu resta dietro al permesso `crm_leads` che non ha,
  e la **board della pipeline NON è stata aperta** (quella mostra i lead, e il suo perimetro è ancora
  solo quello della coach).
  Non si perde la pastiglia **«senza glutine»** accanto al nome — l'unico posto in cui si vede chi
  l'ha dichiarato *senza avere ancora la dieta dedicata*: la calcola il server con
  `dichiaraSenzaGlutine`, la regola che sta in un posto solo, perché «senza glutine» letto male vuol
  dire pane a una celiaca.
  Verifiche: build backend verde, **111 suite / 1710 test**, build backoffice verde.

- `[Sviluppo]` 🥗 **Nella scheda cliente si sceglie la DIETA, non lo stile.** §16.10, prima parte.
  Lo **stile non identifica una dieta**: `Mediterranea`, `Mediterranea ipocalorica` e `Pescetariana`
  hanno tutte `style = 'mediterranean'`; `Vegana`, `Vegetariana`, `Flexitariana` e `Flessibile` sono
  tutte `flexible`. E la tendina «Stile» mostrava come etichetta il **nome della prima dieta
  approvata** con quel codice: si leggeva un nome di dieta e si sceglieva un codice che ne copre
  tre. Trovato guardando il profilo di `sim1one.salogni@gmail.com`: «Tipo di alimentazione:
  Mediterranea» e sotto «La tua dieta: Pescetariana» — le due righe si contraddicono e nessuna è
  sbagliata da sola. È lo stesso difetto che `diag:famiglie` cerca su 20 clienti.
  Ora la tendina è **«Dieta»**, e l'unità è la dieta approvata: nuovo `catalog.famiglie()`, esposto
  da `/catalog/taxonomy`. ⚠️ **Scrive due campi**: `dietFamily` e, insieme, lo `dietStyle` di quella
  dieta — non è una comodità, `pickDietFor` cerca famiglia **e** stile insieme, e una famiglia
  lasciata con lo stile di un'altra non trova niente e **ripiega su una dieta vicina**, cioè ricrea
  il difetto che la tendina chiude. La dieta che la cliente ha oggi resta in tendina anche se non è
  più approvata, marcata «(non più in catalogo)»: se sparisse, salvare un altro campo qualsiasi la
  cancellerebbe senza che nessuno l'abbia chiesto.
  **Dove lo stile sparisce dalla vista:** la riga «Stile alimentare» della scheda diventa «Dieta»
  (sotto c'è già «Dieta assegnata», quella che il motore eroga davvero: se le due non combaciano ora
  si vede); in **app** via la riga «Tipo di alimentazione», che diceva lo stile scelto in
  registrazione, non si aggiornava quando la nutrizionista spostava la cliente, e contraddiceva «La
  tua dieta» due centimetri sotto; e via lo stile accanto al nome in «Diete in revisione».
  **Non toccati, di proposito:** la colonna «Stile» nell'elenco Diete e il chip nelle Regole motore
  — lì lo stile è metà dell'identità di una **famiglia del catalogo**, non un attributo della
  cliente, e i form che lo scrivono devono restare (una dieta creata senza stile `pickDietFor` non
  la trova più). E i «?» del questionario e del profilo: le 10 schede con le fonti sono indicizzate
  **per stile**, e toglierlo davvero vorrà dire prima una mappa famiglia → scheda.
  Verifiche: build backend verde, **110 suite / 1705 test**, build backoffice verde, build app verde
  e 27 test. ⚠️ Tocca l'app: per il web basta il deploy, sul nativo entra con la OTA 2.1.8.

- `[Sviluppo]` 🏷️ **Nella tabella Clienti «Stato» diventa lo stadio della pipeline, e le pastiglie si
  vedono.** §16.11, tre rifiniture chieste da Simone. (1) La colonna «Stato» diceva
  `Attivo`/`Sospeso`, cioè lo stato dell'**account** — se la persona riesce a entrare: non è la
  domanda di chi apre l'elenco clienti, ed è «Attivo» anche per chi ha smesso di pagare sei mesi fa.
  Ora è lo **stesso stadio di Gestione lead**, letto da `CrmRecord.stage`. Due dettagli: l'elenco
  **legge** gli stadi da `/crm/stages` e non se li ridefinisce (etichette e colori li decide il
  backoffice, in un posto solo), e il valore ordinato e filtrato è l'**etichetta** — nella tendina si
  legge «Cliente», non `paid`. `null` (nessuna scheda CRM) resta distinto da uno stadio mancante: si
  mostra «—» con la spiegazione nel titolo, invece di farlo sembrare uno stato.
  (2) **Le pastiglie si vedono**: «bello il bordo colorato, ma si vede poco» — era 1px sopra il
  bianco, e in una tabella di venti righe scompare. Ora il colore dello stadio entra anche nello
  **sfondo** (velato al 12%, così il testo resta leggibile), il bordo passa a 2px e il testo prende
  il colore scurito. Sta in `backoffice/src/lib/stadio.ts`, **un posto solo** usato da entrambe le
  tabelle: il colore arriva dal database (`Stage.color`) e quindi non può vivere in un foglio di
  stile, e due copie sarebbero tornate a divergere alla prima correzione fatta su una tabella sola.
  `color-mix` regge nome CSS, `#rgb` e `rgb()` — mescolare a mano avrebbe voluto dire riconoscere tre
  formati e sbagliarne uno; dove non è supportato resta il bordo di prima.
  (3) **Via il filtro «Glutine»**, come chiesto. La *pastiglia* nella cella del nome resta: non è un
  filtro, è il segno che la cliente ha dichiarato il glutine e non ha ancora la dieta dedicata, e
  quello è l'unico posto in cui si vede.
  Verifiche: build backend verde, **110 suite / 1705 test**, build backoffice verde.

- `[Sviluppo]` ✅ **`menu_penalty_repeat` in produzione vale 1: l'allarme di stasera era MIO, non del
  sistema.** Nella ricognizione avevo scritto che la penalità di ripetizione era «quasi certamente
  ancora a 0», perché il seed non sovrascrive il valore di una riga che esiste già
  (`prisma/seed.ts:1279`, `update: { description }`). Il ragionamento è giusto, la conclusione no:
  **letta dal backoffice, la riga vale `1`** (e `menu_repeat_window_days` 14, `menu_variety_min_gap_days`
  2). O la riga non esisteva quando il seed è passato, o l'ha messa qualcuno a mano. ⚠️ Resta vero il
  **meccanismo**: ogni parametro «cambiato nel seed» dopo il primo deploy non arriva in produzione da
  solo — ma prima di dirlo di uno specifico parametro **si legge il valore**, che è a due clic.
  E resta aperta la domanda vera: se la penalità è attiva, perché i menu si ripetevano.

- `[Sviluppo]` 📌 **I filtri delle tabelle non restavano fermi: una `ref` di callback al posto di una
  `useRef`.** §16.5, segnalata **tre volte** e in **tutte** le tabelle. Il meccanismo
  (`useTestaFissa`, `position: sticky`) c'era già ed era giusto: sbagliava **la misura**. Guardato
  nel browser, sulla pagina Clienti in produzione: la riga dei titoli restava (`top: 0`), quella dei
  filtri aveva `top: 0px` invece dei **35px** dell'altezza dei titoli — cioè si incollava *sotto* i
  titoli, che sono opachi e stanno più in alto nello `z-index`, e spariva. Controprova fatta lì:
  forzando `top: 35px` la riga resta in vista.
  ⭐ **Perché la misura era 0.** `useTestaFissa` usava `useRef` + `useLayoutEffect` con dipendenze
  `[attiva, colonne.length]`. **Al primo render la tabella non c'è ancora**: ogni pagina mostra prima
  lo spinner. `rifTesta.current` era `null`, l'effetto usciva subito — e non tornava mai più, perché
  quelle dipendenze non cambiano quando i dati arrivano. Il `ResizeObserver` non veniva nemmeno
  agganciato. Ora `rifTesta` è una **ref di callback**: la misura parte quando la riga entra davvero
  nel DOM. Una riga, e vale per tutte e 30 le tabelle, perché passano tutte da qui.
  Due lezioni: **un difetto che si vede in TUTTE le schermate non sta nelle schermate**, e il posto
  dove si trovava era il **browser**, non il codice — nel codice quella funzione si legge giusta, e
  l'avevo letta due volte dichiarandola a posto.

- `[Sviluppo]` 👁️ **«Entra come» diventa un permesso, e sotto impersonazione si può solo
  GUARDARE.** Prima metà della §16.4, con le tre decisioni prese da Simone l'11/8. (1) **Chi può**:
  `POST /admin/impersonate` era `@Roles('admin')` fisso — una decisione di prodotto scritta nel
  codice, che la matrice dei permessi *non nominava nemmeno*; ora c'è la chiave `impersonate` con la
  guardia che la legge, di default solo admin perché entrare in un account vuol dire vedere dati
  sanitari. E il pulsante nel backoffice era mostrato **senza alcun controllo** in tre schermate: chi
  non era admin lo scopriva premendolo, e riceveva un 403 al posto di un pulsante che non c'è.
  (2) ⭐ **Cosa può fare: solo leggere.** Il token portava `impersonatedBy` ma *nessuna rotta lo
  guardava*: chi entrava nei panni di una cliente poteva agire al posto suo, e l'audit di quelle
  azioni diceva che le aveva fatte lei. Per una persona che ci mette dentro peso, misure e documenti
  sanitari è la differenza fra «qualcuno ha guardato» e «qualcuno ha deciso al posto mio senza che io
  lo sappia». `SolaLetturaImpersonazioneGuard`, globale e ultima della catena, lascia passare solo
  `GET`/`HEAD`/`OPTIONS`; unica scrittura ammessa il **logout**, perché senza «Torna admin» darebbe
  errore proprio mentre si prova a fare la cosa giusta; `POST /auth/switch` **no**, che da una
  sessione impersonata sarebbe una scala. Il rifiuto dice *perché*: davanti a un 403 muto, chi sta
  aiutando una cliente al telefono pensa a un guasto. (3) **Trenta minuti**: `IMPERSONATION_TTL` era
  già il default, qui è stato scritto nel codice perché è una decisione e non un ripiego — scaduti,
  si ricade fuori e per rientrare si preme di nuovo, così ogni ingresso lascia una riga nell'audit
  invece di una sessione aperta a tempo indeterminato. Alla cliente non si scrive niente: resta
  nell'audit interno. Aggiunto anche il pulsante **nella tabella Clienti**, dove mancava — cioè
  nell'unico elenco da cui una coach parte davvero quando una cliente la chiama.
  ⭐ **E il pulsante apre l'APP, non il backoffice.** Collaudato subito dopo il deploy: «Entra come»
  su una cliente portava a **«Accesso non consentito»**. Non è una regressione — *non ha mai
  funzionato* per l'unico caso per cui serve: scambiava la sessione **dentro** il backoffice, e una
  cliente nel backoffice non ha nessuna pagina. Funzionava solo impersonando uno staff, che il
  backoffice ce l'ha. Ora per una cliente si apre la **web app in una scheda nuova**, con il token
  nel **frammento** dell'indirizzo (`/#t=…`, che non viaggia al server e non finisce nel `Referer`,
  e viene cancellato dalla barra appena letto), e la sessione del backoffice **non viene toccata**:
  chi sta aiutando al telefono si tiene la sua scheda di fianco. Due cose che l'app ha dovuto
  imparare: una **barra in cima sempre visibile** («stai guardando l'account di X, sola lettura, si
  chiude da sola dopo 30 minuti»), perché una scheda lasciata aperta assomiglia a qualsiasi altra;
  e la **modalità ospite** nel client API — sotto «Entra come» il 401 **non rinnova**. Senza, alla
  scadenza dei 30 minuti l'app avrebbe rinnovato col refresh token in `localStorage`, che è di
  *un'altra persona*: si sarebbe cambiata identità in silenzio. La scadenza dev'essere una porta che
  si chiude.
  Verifiche: i **quattro job della CI riprodotti in sandbox** col client Prisma vero (vedi la voce
  sul `--no-engine`): build backend verde, **110 suite / 1705 test**, 7 nuovi sulla guardia, build
  backoffice verde, build app verde e 27 test dell'app. ⚠️ Tocca l'app: per il web basta il deploy di `app.metabole.eu`; sul nativo entra con la OTA 2.1.8, a lista finita.
  ⚠️ **Resta la seconda metà** — l'unificazione vera delle due tabelle — e leggendo sono usciti due
  vincoli: «ha speso > 0» **esiste già** ed è il filtro *Tipo = Cliente* di Gestione lead
  (`stage = paid`, scritto dal pagamento), quindi non serve inventare un conteggio nuovo; ma il
  **perimetro non è lo stesso** — l'elenco Clienti restringe per coach **e per nutrizionista**, la
  lista lead **solo per coach**: fonderle senza toccare quello allargherebbe a una nutrizionista la
  vista su *tutte* le clienti.

- `[Sviluppo]` 🔴 **CI rossa su `0d7e72f`: il file consegnato era costruito su un main vecchio e ha
  annullato una correzione già pushata — e adesso la CI si riproduce in sandbox, davvero.**
  Due cause, e la seconda è più importante della prima.
  **La causa immediata**: `catalog.service.ts` ha due transazioni interattive, e tutte e due
  annotavano il client come `PrismaService`. Dentro una `$transaction` il client è un
  `Prisma.TransactionClient` — senza `$transaction`, `$connect` e gli hook di Nest — quindi
  l'overload non combacia, TypeScript ripiega su quello ad array e il risultato diventa `any[]`:
  **quattordici errori da una riga sola**. La correzione (`c890db1`) ne aveva già sistemata una; la
  consegna successiva l'ha riportata indietro insieme all'altra.
  **La causa vera**: il file l'ho costruito su un `origin/main` **precedente** a quella correzione.
  La regola c'era già scritta — «prima di modificare un file confronta con quello del Mac» — e vale
  doppio a fine giornata, quando Simone committa mentre noi lavoriamo. Un file consegnato per intero
  non porta solo le sue modifiche: **riporta indietro tutto quello che non sa**.
  ⭐ **E la scoperta che rende inutile ripetere l'errore**: in sandbox il client Prisma **si può
  generare**. `binaries.prisma.sh` è bloccato, ma quel 403 riguarda i **motori**, non i tipi:
  `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 PRISMA_SCHEMA_ENGINE_BINARY=/bin/true npx prisma generate
  --no-engine` produce il client vero. I motori servono per parlare col database, non per compilare.
  Da lì girano **gli stessi quattro job della CI** — backend build + test, backoffice build, app
  build + test — e si sa se sarà verde **prima** di consegnare, invece di scoprirlo dal pallino
  rosso su GitHub. Finora si usava uno stub con tutto `any`, che compilava anche il codice sbagliato:
  era quello a nascondere entrambe le CI rosse di oggi.
  Verificato adesso, tutti e quattro: build backend verde, 109 suite / 1698 test, backoffice verde,
  app verde con 27 test.
- `[Prodotto]` 📌 **DA FARE — quello che resta aperto all'11/8/2026, in un posto solo.**
  Messo qui su richiesta di Simone: la coda vive in `PUNTO_DELLA_SITUAZIONE.md` §16, questa è la
  fotografia di fine giornata.
  **Decise da Simone, manca solo scriverle** — §16.8 tetto di guadagno del nutrizionista (solo campo
  di profilo, niente blocco) · §16.9 tabella delle sostituzioni di Gaia, contestuale, con «promuovi
  a regola».
  **Aperte, nell'ordine di priorità che aveva dato lui** — §16.2 Gaia deve poter correggere i piatti
  di *tutti* i menu emessi · §16.3 nuovo lead → notifica alla manager delle coach + tabella «Lead da
  assegnare» · §16.4 tabella Clienti uguale a Gestione lead ma solo chi ha speso · §16.6 «Piatto
  Freddo» fra i metodi di cottura · §16.7 slot per le visite creati dal nutrizionista.
  **Chiusa oggi**: §16.5 (i filtri delle tabelle restano fermi) — controllate tutte le tabelle del
  backoffice, le uniche due che disegnano i filtri a mano sono il catalogo ricette e `LeadsTable`, e
  adesso chiedono lo stile all'helper tutte e due.
  **Aspettano una persona, non del codice** — §15.3 il ritmo di calo di sicurezza è un numero da
  decidere con Nocanty · la **quota coach** sulle provvigioni del rinnovo, che blocca il monitoraggio
  a pagamento (numeri in `Decisione_Provvigioni_Rinnovo.md`) · le 12 varianti della
  **Keto-Mediterranea** da generare e validare con la nutrizionista.
  **In coda da prima** — §15.6 due pesate in aumento → i menu che hanno funzionato · revoca consenso
  e cancellazione a 30 giorni · le 14 richieste dei clienti del 5/8 · la sequenza dei menu diversa
  per ogni cliente (dettata l'11/8) · `install-ios.mjs` che rifaccia i quattro passaggi persi a ogni
  rigenerazione di `ios/`.
  **Sui tag, dopo la pulizia di oggi** — restano tre code corte: `npm run fix:tag-settimane` non è
  ancora stato lanciato sui dati esistenti (i `sett:` a database sono ancora quelli vecchi, anche se
  non li legge più nessuno); `diag-dieta.ts` racconta a schermo la **vecchia** semantica di `sett:N`;
  e **rinominare una dieta non aggiorna il tag `dieta:<nome>`**, quindi il generatore smette di
  ritrovarne le ricette orfane e le ricompra dall'AI.
  **A lista finita**: la **OTA 2.1.8** — e con quella arrivano sui telefoni anche le pastiglie dei
  tag tolte dalla scheda ricetta dell'app.

- `[Sviluppo]` 📤 **«Esporta in Excel» su TUTTE le trenta tabelle del backoffice — e le date escono
  come date.** Richiesta di Simone: «il pulsante esporta in excel con i filtri va applicato a tutte
  le tabelle». Ventinove passano da `useTabella` e prendono il pulsante con una riga; la trentesima,
  **Gestione lead**, ha un'esportazione sua perché filtra e pagina sul database: in memoria c'è una
  pagina sola, e scriverla sarebbe cento righe su ottomila senza dirlo. Lì il file si costruisce
  richiedendo al server le stesse pagine con gli stessi filtri, fino a un tetto di 5.000 righe che
  viene **detto prima** di scaricare.
  ⭐ **Le date adesso sono date.** Metà delle tabelle hanno una colonna il cui valore è una stringa
  ISO: scritta com'è, in Excel è testo — non si ordina per data, non si filtra per mese, non si
  raggruppa in una tabella pivot. Ora `excel.ts` la riconosce e scrive una cella data vera, col
  formato italiano. Due trappole trovate provandolo: `new Date('2026-08-11')` è mezzanotte **UTC**,
  quindi letta coi componenti locali diventava «11/08/2026 02:00» a Roma e **il 10 agosto** a New
  York — la cella *sembrava* giusta ma non era **uguale** alla data, e i confronti fallivano; e
  `2026-02-30` ha la forma di una data, `new Date` non protesta e la fa scivolare al 2 marzo, cioè
  un dato sbagliato che diventa un dato plausibile. Le date senza ora si leggono ora dai numeri
  della stringa, e i giorni fuori mese restano testo.
  Undici colonne di **importi** escono in euro e non in centesimi (`1990` sarebbe stato il prezzo di
  un piano da €19,90 — e si sarebbe sommato così).
  **Quello che ha fermato la revisione**, su ventinove inserzioni che compilavano tutte: (1) il
  pulsante non passava l'**avviso di troncamento** su sette tabelle che hanno un tetto lato server —
  `Acquisti` ne carica **200**, e il file si sarebbe chiamato «Acquisti» contenendone 200 su 3.000,
  esattamente il difetto per cui l'avviso era stato scritto la prima volta; (2) sei colonne
  esportavano la **chiave di ordinamento** invece dell'etichetta: uno sconto del 10% usciva
  `1000000010`, quattro colonne «Stato» uscivano `open`/`pending`/`scheduled`/`0`, e una dieta a
  cinque pasti col digiuno usciva `5.5`; (3) in `Valori nutrizionali` la colonna **P / C / G / F**
  spariva dal file — l'unica colonna di dato del backoffice senza `valore`, cioè proprio il motivo
  per cui qualcuno esporta quella tabella; (4) in Gestione lead il conteggio veniva da uno stato
  vecchio di 300 ms, e azzerando i filtri e cliccando subito si otteneva un file di tre righe su
  quarantamila.
  🔑 E una correzione che vale oltre l'esportazione: `crm.service` ordinava i lead per `updatedAt`
  **senza un secondo criterio univoco**. Su lead importati in blocco, che condividono il millisecondo,
  Postgres non garantisce lo stesso ordine fra due query: chi legge a pagine riceve righe ripetute e
  altre che non compaiono in nessuna. A schermo si notava poco, in un file che dichiara di essere
  completo no. Ora c'è `id` come secondo criterio, sempre.
- `[Sviluppo]` 🏷️ **I tag delle ricette spariscono dall'interfaccia, e la cliente non legge più
  `gen:flexible` sotto il suo piatto.** Deciso da Simone dopo la nota `NOTA_Tag_Ricette.md`: «se
  cucina italiana non è utilizzato togliamolo, come anche i tag». Riverificato sul main di oggi:
  `cucina italiana` **non lo legge nessuno** — la preferenza «ricette semplici» della cliente filtra
  su `difficulty === 'semplice'`, non sul tag — e i tag si vedevano in due posti soli, il campo
  libero nella scheda ricetta e le pastiglie in app.
  Via tutti e due, più la spunta «Cucina italiana», che prometteva un effetto che non esisteva.
  ⭐ **E il salvataggio della scheda non manda più `tags`.** `updateRecipe` li scrive solo se
  arrivano, quindi non mandarli vuol dire non toccarli: il tag `dieta:<nome>` — l'unico ancora vivo,
  quello con cui il generatore ritrova le ricette orfane invece di ricomprarle dall'AI — da qui non
  si può più rompere. Prima bastava cancellarlo distrattamente dal campo di testo.
  I tag non escono nemmeno più da `GET /recipes/:id`, che è l'unica rotta del catalogo aperta anche
  alle clienti: toglierli in app non sarebbe bastato, perché il prossimo pezzo di interfaccia che
  stampa quello che riceve li avrebbe rimessi a schermo. Si tolgono dove nascono.
  Restano nel database, e devono restarci: `dieta:` serve al generatore.

- `[Sviluppo]` 🔴 **Il build del backend era rosso: dentro una transazione il client non è
  `PrismaService`.** La CI delle 20:25 si è fermata su `nest build` con **14 errori** in
  `catalog/catalog.service.ts`, tutti figli di una sola annotazione ripetuta due volte:
  `this.prisma.$transaction(async (tx: PrismaService) => …)`. `$transaction` ha due overload — uno
  prende un **array** di promise, l'altro una **callback** che riceve `Prisma.TransactionClient`,
  cioè il client *senza* `$transaction`, `$connect`, `$on`. `PrismaService` quei metodi ce li ha (più
  gli hook di Nest), quindi non è assegnabile al parametro della callback: l'overload giusto viene
  scartato, TypeScript ripiega su quello ad array e l'esito diventa `any[]`. Da lì ogni campo letto
  (`esito.messa`, `esito.sostituito`, `esito.settimanaNuova`, `esito.tolta`, `esito.complete`) è un
  errore a sé — 1 causa, 14 sintomi. Correzione: `type PrismaTx = Prisma.TransactionClient` in testa
  al file, **come già fanno `commerce.service.ts` e `finance.service.ts`**, e le due callback
  annotate con quello. Nessun cambio di comportamento: dentro si usano solo `tx.dietDayTemplate` e
  `tx.recipe`.
  ⭐ **Perché il verde della consegna precedente non l'aveva visto, e cosa si fa d'ora in poi.** Il
  type-check in sandbox gira su uno **stub** di `@prisma/client` che tipa `$transaction` in modo
  largo: l'errore lì non *poteva* comparire, e il confronto col baseline diceva «zero introdotti»
  perché non c'era né prima né dopo. La verifica vera si può fare **sul Mac**, dove il client Prisma
  è generato per davvero: `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` in
  `backend/` ha riprodotto **gli stessi 14 errori della CI**, e dopo la correzione li ha visti
  sparire senza introdurne nessuno. ⚠️ Sul Mac restano **77 righe di errori solo locali**
  (`planHeldAt`, `reasonKey`, `kcalOverride`, `deletionRequest`, `nutrientFact`…): sono campi e
  modelli che stanno in `prisma/schema.prisma` ma **non** nel client generato, fermo a uno schema
  vecchio. In CI non compaiono perché lì il client si rigenera — infatti la CI si è fermata a «Found
  14 error(s)», non a 91. Quindi il metodo è: **si confronta col baseline, non si guarda il totale**.

- `[Sviluppo]` 🔗 **Dal dettaglio della ricetta la si collega alle diete e alle settimane — e la
  revisione ha fermato tre modi di rompere i menu delle clienti.** Richiesta di Simone: «dentro il
  dettaglio in modifica inseriscimi la dieta (posso collegarne più di una) e la settimana (posso
  collegarne più di una o addirittura aggiungerne una nuova)», e poi «ragiona per righe: Low carb
  Settimana 1, Mediterranea Settimana 4, Keto Settimana 8».
  Nel modale c'è **«Dove è usata»**: una riga per dieta e settimana, il giorno come dettaglio sotto,
  «Togli» su ogni riga e un modulo per collegare. Le righe si leggono dalle giornate e **valgono
  subito**, senza «Salva»: toccano le giornate di una dieta, non la ricetta, e tenerle in sospeso
  vorrebbe dire poter chiudere la scheda con dei collegamenti a metà. Scelta la dieta, il server
  propone **la prima settimana con un buco in quel pasto** — che è il posto dove il piatto entra
  senza cacciarne un altro — e se il ciclo è pieno propone una settimana nuova.
  Tre decisioni prese da Simone: il **giorno lo sceglie lui** (l'automatico nasconde quale giornata
  è stata toccata e cosa c'era prima); collegare **non rimanda la dieta in bozza** anche se è
  approvata (declassarla vorrebbe dire toglierla alle clienti che la seguono per una correzione di
  catalogo); si può **creare una settimana nuova**, con l'avviso che le altre sei giornate sono
  vuote.
  ⭐ **Quello che ha fermato la revisione, su codice verde.** (1) La funzione che scrive il pasto lo
  rimetteva **in fondo** all'array — cosa che viene naturale scrivendo `filter` seguito da un
  `push` — e l'ordine dell'array è l'ordine con cui l'app disegna i pasti: collegare una colazione
  alla prima giornata del ciclo avrebbe mostrato «pranzo, cena, colazione» a **tutte** le clienti di
  quella dieta. Nessun test lo vedeva, perché a insiemi la giornata era giusta. (2) Siccome la dieta
  non torna in bozza, `assertActivatable` **non ci ripassa più**: il cancello R8 sugli allergeni
  sarebbe stato scavalcato in modo permanente, e una ricetta con gli allergeni solo *suggeriti*
  sarebbe finita nel piatto di una cliente. Ora il controllo si fa qui. (3) «Togli» lascia la
  giornata monca, e una giornata monca il motore **la scarta**: il ciclo servito si accorcia di una
  giornata per tutte, e sull'ultima giornata completa la dieta resterebbe senza niente da erogare.
  Ora l'ultima è rifiutata, e il messaggio dice il prezzo vero invece di «il pasto resta vuoto».
  Altre correzioni della stessa revisione: lettura e scrittura nella **stessa transazione** (fuori,
  due nutrizionisti sulla stessa giornata si cancellavano il pasto a vicenda, senza errore e con
  l'audit di tutti e due che diceva «fatto»); il **livello** filtrato a 1 (un `findFirst` su
  `{dietId, dayIndex}` poteva scrivere in un ciclo che nessuno eroga); la settimana si crea intera
  **solo se non esiste**, perché riempire i buchi di una settimana parziale allungava di nascosto il
  ciclo di una dieta viva; l'elenco «Dove è usata» passa a una query SQL invece di leggere tutte le
  giornate del catalogo a ogni apertura di scheda; le voci della tendina distinguono le varianti
  (due diete con lo stesso nome e regime ma una col digiuno erano due righe identiche che si
  comportano in modo opposto — il digiuno non ha colazione).
  E una cosa che va detta e prima non si diceva: se dopo il collegamento la giornata è ancora
  monca, l'esito lo scrive — **il piatto è salvato ma non arriva a nessuna cliente**. «Collegata» da
  sola si legge come «in produzione».
  Verifiche: type-check col baseline invariato, 109 suite / 1698 test verdi (22 nuovi su
  `collega-ricetta`), build del backoffice verde.

- `[Sviluppo]` 🔧 **Le colonne Dieta e Settimana mostravano «—»: il 7 della settimana era un
  parametro, e un parametro cambia il tipo.** Segnalazione di Simone a poche ore dalla consegna.
  Nella query, `${GIORNI_SETTIMANA}` finiva come **parametro** e non come costante scritta: Prisma
  manda i numeri JavaScript come `double precision`, quindi `(day_index - 1) / 7` smetteva di essere
  una **divisione fra interi** e diventava una divisione con la virgola — il giorno 3 nella settimana
  1,2857. La lezione vale oltre il caso: *un parametro al posto di una costante cambia il tipo, e col
  tipo cambia il significato dell'operatore*. Il `7` ora è scritto nella query, con un
  `Math.round` come rete di sicurezza sui valori che tornano.
  Nella stessa passata: l'elenco degli id passa da `= ANY($1::text[])` a `IN (Prisma.join(...))`, la
  forma documentata per un elenco di valori, che manda ogni id come parametro suo invece di affidarsi
  a come il driver decide di serializzare un array.
  ⭐ **E soprattutto: l'errore adesso si scrive nei log.** La prima versione lo ingoiava con un
  `catch` muto perché «la pagina deve continuare a funzionare» — giusto — ma senza dire niente a
  nessuno. Risultato: mezz'ora a indovinare perché le colonne mostrassero «—», con tre spiegazioni
  possibili e nessun modo di distinguerle. **Un errore inghiottito trasforma un guasto preciso in un
  mistero**: la degradazione elegante è per l'utente, non per chi ripara. Le due cose stanno
  insieme — la pagina regge *e* nei log di Render c'è scritto cosa è successo.
  Il messaggio in colonna resta a tre stati distinti, ed è quello che ha permesso di restringere il
  campo subito: «—» = non lo so, pastiglia grigia «nessuna» = ricetta orfana, pastiglie coi nomi =
  usata. Se «—» e «nessuna» fossero stati la stessa cosa, il difetto sarebbe sembrato un catalogo
  fatto tutto di ricette orfane.
- `[Sviluppo]` 📌 **Nel catalogo ricette i campi di ricerca delle colonne restano incollati sotto i
  titoli.** Segnalazione di Simone: «devono restare fissati ai titoli, non devono scorrere». È lo
  stesso difetto già corretto in Utenti, ricomparso da un'altra porta: `useTabella` incolla i titoli
  **e** la riga dei filtri, ma solo quando la riga dei filtri la disegna lui. Il catalogo ricette se
  la scrive a mano — i suoi filtri vanno al database, non all'helper — e quindi riceveva lo stile sui
  titoli e non sui filtri. Scorrendo mille ricette i titoli restavano su e i filtri sparivano: per
  cambiarne uno si tornava in cima, ed è la schermata su cui il nutrizionista passa le ore.
  La correzione non è nella pagina ma nell'helper, che ora **espone** lo stile (`t.stileFiltri`)
  invece di tenerlo chiuso dentro: `LeadsTable` — l'altra tabella con la riga dei filtri scritta a
  mano — quello stile lo chiedeva già alla sua versione lato server, e infatti era a posto.
  Controllate tutte le tabelle del backoffice: sono le uniche due che disegnano i filtri da sé, e
  adesso lo chiedono tutte e due.

- `[Sviluppo]` 🏷️ **Nel catalogo ricette via la colonna Tag, dentro «Dieta» e «Settimana n.» — e si
  leggono dalle giornate, non dalle etichette.** Richiesta di Simone: «in questa tabella togli la
  colonna TAG inserisci la colonna dieta e la colonna settimana n.». Non è un cambio di vestito: i
  due dati che si guardavano nella colonna Tag (`dieta:<nome>`, `sett:N`) **rispondono a un'altra
  domanda**. Il generatore scrive `dieta:` alla **nascita** della ricetta, e quando un'altra famiglia
  riusa quel piatto — cosa che fa apposta, perché sono piatti già pagati e spesso già corretti a mano
  — il tag non cambia. Dice dov'è *nata*, non dov'è *usata*. `sett:N` aveva lo stesso difetto ed è già
  costato una diagnosi sbagliata («le mette tutte nella prima settimana» su una dieta distribuita su
  due). Adesso la domanda si fa a chi conosce la risposta: le **giornate**, a ogni richiesta.
  Nuovo `backend/src/catalog/utilizzo-ricette.ts`: una query che apre l'array dei pasti
  (`CROSS JOIN LATERAL jsonb_array_elements`, lo schema già usato in `copertura-catalogo.ts`) e
  torna, per ogni ricetta **mostrata**, le diete che la usano e in che settimane. La colonna
  «Settimana n.» prima esisteva solo dentro una dieta; ora c'è sempre, e le varianti sorelle (3 pasti
  / 5 pasti / digiuno) contano per **una** dieta sola, perché hanno lo stesso nome.
  ⭐ La cosa che vale più delle colonne: **«Dieta = nessuna» è il filtro delle ricette orfane** —
  piatti generati, pagati e riletti che nessuna giornata usa, cioè lavoro che nessuna cliente vedrà
  mai. Prima non c'era modo di chiederlo.
  **Due difetti trovati dalla revisione, che non rompevano niente.** Il primo: `archiveDiet` mette la
  dieta a `rejected` ma **non cancella le sue giornate**, quindi una ricetta usata solo da una dieta
  ritirata sarebbe risultata «in uso» — la colonna avrebbe mancato proprio la classe di ricette che
  l'archiviazione produce. Ora le diete archiviate non contano (le bozze sì: una dieta in
  costruzione la ricetta la usa davvero). Il secondo: con «Dieta = Keto» + «Settimana = 1» si sarebbe
  elencata una ricetta che sta nella settimana 1 della Mediterranea e nella 3 della Keto — due verità
  separate lette come una frase sola, falsa. Ora col filtro Dieta attivo la settimana si guarda
  **dentro quella dieta**, e ogni pastiglia di dieta porta le sue settimane nel titolo.
  **La cache che avevamo deciso non c'è.** L'idea era tenere le giornate in memoria un minuto; la
  revisione ha fatto notare che `render.yaml` ha `numInstances: 2`, quindi due cache indipendenti non
  ritardano: **oscillano**, e la stessa ricetta mostra «Mediterranea» e poi «nessuna» a tasti
  alterni. Chiedere solo le righe che escono (al massimo mille) invece di scandire il catalogo intero
  è più fresco **e** più veloce: la query provata su un Postgres vero con 315 diete e 26.463 giornate
  sta in ~80 ms. E se quella lettura fallisce le due colonne valgono «—», non «nessuna»: un elenco
  vuoto qui è un'affermazione precisa su lavoro pagato, e non va fatta per un errore di rete.
  Verifiche: type-check backend col baseline invariato, 107 suite / 1648 test verdi (9 nuovi),
  `npm run build` del backoffice verde, e la query SQL provata su Postgres 16 con i casi limite —
  varianti sorelle, diete archiviate, confini di settimana 7→1 e 8→2, giornate con `meals` guasto.
- `[Sviluppo]` 📄 **`progetto/NOTA_Tag_Ricette.md` — a cosa servono i tag delle ricette.** Nessun
  documento del progetto li definiva: la specifica backend cita `tags[]` con un esempio e basta, e la
  semantica dei prefissi viveva in una riga di codice. Letto tutto, il quadro è questo: **nessun tag
  influenza la composizione dei menu** (il motore non legge mai `Recipe.tags`), `gen:*` ha un solo
  lettore in uno script di pulizia, `sett:N` nessuno, i tag liberi della nutrizionista nessuno.
  L'unico vivo è `dieta:<nome>`, che serve a ritrovare le ricette orfane per riusarle invece di
  ricomprarle dall'AI. Tre cose meritano una decisione: **`cucina italiana` non fa niente** (le
  «ricette semplici» filtrano su `difficulty`, non sul tag, quindi la spunta promette un effetto che
  non ha); il campo Tag della scheda è **testo libero senza validazione** e un salvataggio distratto
  può cancellare `dieta:` — nessun errore, e il generatore ricompra un piatto che esiste già; e i tag
  interni **si vedono in app**, quindi la cliente legge `gen:flexible` fra i chip del suo piatto.

- `[Sviluppo]` 🥛 **Chi è intollerante al lattosio riceve il delattosato, e i formaggi stagionati non si
  toccano** — richiesta di Simone. `SUBSTITUTION_MAP` mandava `latte → bevanda vegetale`: sbagliato due
  volte, perché la bevanda vegetale **non è latte** (proteine, calcio e sapore diversi, e la giornata è
  bilanciata su quello che c'era prima) e perché non serve — il latte delattosato ha lo **stesso profilo
  nutrizionale**, l'idrolisi scinde il lattosio in glucosio e galattosio senza toccare altro. E
  `parmigiano → parmigiano ben stagionato` sostituiva una cosa con se stessa.
  Ora `menu/lattosio.ts`, applicato in `evaluateMeals`: latte, yogurt, mozzarella, ricotta, panna,
  stracchino… → versione **senza lattosio**; i **formaggi stagionati non si sostituiscono affatto**
  (circolare del Ministero della Salute dell'1/2/2016: 25 DOP con lattosio **sotto lo 0,001%**, cioè
  milligrammi per 100 g — l'EFSA non fissa una soglia unica di tolleranza, la letteratura indica ~12 g
  per dose come generalmente tollerati, quindi millesimi di grammo sono al riparo con qualunque
  margine); il burro resta all'olio evo (il burro delattosato non si trova al supermercato); e ciò che è
  già «senza lattosio» non viene sostituito due volte.
  ⚠️ **L'allergia vince sempre, ed è la parte che conta.** L'intolleranza è un deficit di lattasi;
  l'allergia alle proteine del latte è una reazione immunitaria a caseina e lattoglobuline, che nel
  delattosato **ci sono tutte**: l'idrolisi toglie lo zucchero, non l'allergene. Dare un «latte senza
  lattosio» a un'allergica al latte è mandarle in tavola ciò che le fa male con un'etichetta che la
  rassicura. **Giusy, la cliente da cui nasce la richiesta, ha entrambi i dati**: per lei la regola non
  scatta e resta la strada di prima. I termini di allergia sono volutamente larghi (latte, latticini,
  caseina, siero di latte, APLV…): un falso positivo costa una sostituzione più prudente, un falso
  negativo una reazione allergica, e l'asimmetria decide da sé come scriverli.
  Confronto **per parola** come vuole la regola del progetto: «latteria» non è «latte».
  107 suite / **1667 test verdi** (28 nuovi in `menu/lattosio.spec.ts`); type-check confrontato col
  baseline: zero errori introdotti (⚠️ il verde a zero di `npm run typecheck` va confermato sul Mac).
  Nessuna migrazione, niente da toccare su Render: vale dal deploy, sui menu generati da lì in avanti.
  📌 **Nota**: la richiesta parlava di «gruppo di equivalenza». La tabella `EquivalenceGroup` esiste ma
  il motore la usa in **un punto solo** (il piatto gemello del secondo giorno) e **non** la legge per le
  sostituzioni, che passano tutte da `SUBSTITUTION_MAP`. La regola è stata scritta dove viene davvero
  applicata: riempire quella tabella avrebbe prodotto una configurazione che nessuno legge. Il gruppo
  visibile e modificabile dal backoffice, se serve, è un secondo lavoro.

- `[Prodotto]` 📋 **DA FARE, dettato da Simone l'11/8: la sequenza dei menu deve essere diversa per ogni
  cliente** — «il numero di settimane serve a noi per creare il pool di menu e ricette, ma non vanno
  erogati nella stessa sequenza: rendila random (colazione con colazione, pranzo con pranzo), escludendo
  nell'erogazione successiva quel menu, così ogni cliente ha una sua sequenza. E una volta terminati i
  menu, crei nuove combinazioni basandoti sui gusti e sui risultati ottenuti dalla cliente.»
  Oggi la sequenza è **identica per tutte**: `templates[daysSinceStart % templates.length]`
  (`menu.service.ts` ~554). Varia solo il contenuto dei piatti. ⚠️ E il giro è corto: la dieta di Giusy
  ha **14 giornate tipo**, quindi su 12 settimane la sequenza si ripete **sei volte**.
  Da non sbagliare quando si scrive: il «random» deve essere **riproducibile** (seme per cliente, mai
  `Math.random()` — `deliverIfEligible` gira a ogni apertura dell'app e la stessa data deve dare la
  stessa giornata); guardare `ClientMenuPool`, che esiste già; rendere coerenti le altre due rotazioni
  (`list[dayIndex % list.length]` a ~1470 e il guard `menu_variety_min_gap_days`), o si combattono fra
  loro; e sicurezza, bilanciamento kcal e giornate complete restano prioritari sulla varietà. Il terzo
  punto — combinazioni nuove su gusti e risultati — è un lavoro a sé, da parlare prima di scriverlo.

- `[Sviluppo]` 📊 **«Esporta in Excel» sulla pagina Gestione dieta: esce quello che si vede, filtri
  compresi.** Richiesta di Simone: «nella pagina gestione dieta mi fai un esporta in excel dove mi
  esporti la tabella coi filtri applicati al momento del click». Il pulsante c'è in tutte e tre le
  schede — Catalogo ricette, Allergeni, Gruppi di equivalenza — accanto al contatore delle righe,
  che è il numero che finirà nel file.
  **Le righe esportate sono quelle filtrate e ordinate, di tutte le pagine, non solo di quella
  aperta**: la paginazione è un fatto dello schermo, non del filtro, e un file con le prime cento
  righe di trecento sarebbe un taglio che nessuno può vedere una volta aperto il foglio.
  ⚠️ Per lo stesso motivo, dove la tabella **non ha in mano tutto il dato** l'esportazione lo chiede
  prima di partire: il catalogo ricette ne riceve al massimo 1000 dal server, e se i filtri ne
  trovano di più il pulsante avvisa che il file conterrà quelle mille. Un banner nella pagina non
  segue il file sulla scrivania di nessuno.
  **Come è fatto** — `backoffice/src/lib/excel.ts`, nuovo: un .xlsx vero (zip + XML) scritto a mano,
  **senza aggiungere dipendenze**. Il backoffice ne ha tre in tutto, e SheetJS avrebbe voluto dire un
  `npm install` e un `package-lock.json` rigenerato prima di ogni commit — un passaggio che da GitHub
  Desktop non c'è. Niente CSV: in Excel italiano si apre a colonna unica e i numeri diventano testo.
  Il foglio esce con l'intestazione in grassetto e bloccata, il filtro automatico e le larghezze sul
  contenuto; le kcal sono celle numeriche, quindi si sommano.
  **Dove vive** — dentro `useTabella`, non nelle pagine: l'helper conosce già colonne, filtri e
  ordinamento, quindi l'esportazione è coerente con la tabella per costruzione e le altre trentaquattro
  tabelle del backoffice la ottengono con una riga (`<BottoneExcel tabella={t} />`).
  Una trappola trovata scrivendola: `valore` in metà delle colonne restituisce una **chiave di
  ordinamento** e non l'etichetta — il posto del pasto nella giornata (`0`) invece di «Colazione»,
  `0`/`1` invece di «Attiva»/«Archiviata». Esportare `valore` avrebbe dato un foglio di numeri
  plausibili e sbagliati, senza che niente si rompesse: da qui il campo `esporta` sulla colonna, che
  si dichiara solo dove le due cose divergono.
  Provato per davvero: `tsc -b` e `npm run build` verdi, e i file generati riaperti con un lettore
  xlsx indipendente — tre casi (nessun filtro, filtro su una colonna, ordinamento invertito) per
  controllare che nel foglio finissero le righe giuste, nell'ordine giusto, con le etichette al posto
  delle chiavi e senza la colonna dei pulsanti.
  **E una revisione severa prima di consegnare**, che su codice verde ha trovato cinque cose che
  nessun test avrebbe visto: l'avviso sul troncamento **dichiarava il numero sbagliato** (diceva
  «il file ne conterrà 1000» mentre in Allergeni, che si apre già filtrata su «Da rivedere», ne
  escono un centinaio — un avviso che sbaglia il numero fa più danno del silenzio, perché lo si
  crede); la **nota di sicurezza** dei gruppi di equivalenza («controllare le etichette per
  allergeni») si vedeva a schermo e spariva dal file, cioè proprio il campo con implicazioni
  sanitarie; la settimana usciva come **testo** anche quando era un numero solo, e Excel la ordinava
  in alfabetico («1», «10», «2»); `etichetta` veniva applicata solo ai valori stringa, quindi la
  prossima colonna numerica con una traduzione avrebbe scritto `0` dove la tendina mostra
  «Colazione»; e il `title` che spiega perché il pulsante è spento stava **sul pulsante disabilitato**,
  dove Chrome non lo mostra — il motivo per cui un comando è spento è la metà del comando.

- `[Sviluppo]` 🎬 **«Conosciamoci» si attiva da sola a fine questionario, e la prova comincia col primo
  menu** — §16.1. Finito il questionario la cliente non incontra più il negozio: Gaia le dà il
  benvenuto («dedicami 8 giorni per conoscerti»), le chiede **la data in cui vuole iniziare** — campo
  obbligatorio, che prima non esisteva — e da lì entra nell'app. `attivaBenvenuto`: piano gratuito →
  Subscription **`active`** con date già scritte → `planStartDate` → referral → monitoraggio → audit.
  **Niente `Payment`, niente `Order`** («ora mi intasa la tabella acquisti e basta»).
  Le tre cose fatte con cura, perché l'analisi diceva esattamente dove si rompe: la Subscription nasce
  `active` e non `pending` (una `pending` senza pagamento è **irrecuperabile** e blocca ogni acquisto
  futuro: una cliente che non può più comprare niente, per sempre); la rete di sicurezza sulla durata
  (un `period` scritto male cadrebbe sul fallback a 3 mesi di accesso gratuito → default 8 giorni); la
  **data lontana è permessa**, quindi nessun cap a 60 giorni, con un limite a 12 mesi che non è contro
  la cliente ma contro il refuso dell'anno.
  ⭐ **E «Prova» arriva col primo menu, non con l'attivazione** (correzione di merito chiesta da
  Simone): con la data scelta da lei fra i due momenti passano settimane, e una board piena di «Prova»
  su chi non ha ancora visto un piatto è rumore che la manager delle coach impara a ignorare. I tre
  pezzi si sono spostati **insieme** — `trial_started`, CRM, avviso alla coach — in `provaAttivata`,
  chiamato da `deliverIfEligible` al primo `menuDay` in assoluto, idempotente perché quella funzione
  gira a ogni apertura dell'app.
  ⚠️ **Il buco che lo spostamento apriva**: `trial_converted` scatta solo se `trial_started` esiste, e
  chi compra **prima** del primo menu non l'avrebbe mai avuto — cioè la conversione di chi si
  entusiasma subito non sarebbe stata contata mai. Ora il primo acquisto vero, se trova la prova ma non
  l'evento, lo scrive **a ritroso** marcato `recuperato`, e poi conta la conversione.
  Il piano «Auto Apprendimento Gaia» esce dalla vetrina (cliente **e** pubblica) e l'acquisto viene
  rifiutato anche a chi arriva con l'id in mano (`assertPlanPurchasable`): nascondere non basta, l'elenco
  è un suggerimento e l'acquisto è una POST con dentro un `planId`. Resta nel database, perché serve il
  suo id per attivarlo.
  **Due estrazioni non per eleganza**: `MenuService` non può dipendere né da `CommerceService` né da
  `NotificationsService` (`NotificationsModule` importa `MenuModule`: la freccia opposta chiude un
  cerchio, e un `forwardRef` messo lì per farlo tacere è un rinvio). Quindi `funnelEvent` e il corpo di
  `notify` sono diventati funzioni libere che ricevono `prisma`, e i servizi le chiamano — una regola
  sola: due copie divergono, e quella che smette di avvisare non lo dice a nessuno.
  106 suite / **1639 test verdi** (28 nuovi, scritti sulle otto conseguenze dell'analisi); app a **zero
  errori** di type-check e 27 test verdi; type-check backend confrontato col baseline: **zero errori
  introdotti** ⚠️ da riconfermare col `npm run typecheck` vero sul Mac, perché in sandbox
  `prisma generate` resta appeso sul download dei binari. Nessuna migrazione.
  ✅ **Verificato in produzione l'11/8** (Shell di Render): a €0 esiste **un solo piano**,
  «Conosciamoci», `period '8d'`, attivo e non nascosto. Quindi il fallback trova il piano da sé e
  **`trial_plan_id` non va impostato**; e siccome `'8d'` è un periodo valido, la rete di sicurezza sulla
  durata non entra in gioco: la prova dura esattamente gli 8 giorni che Gaia promette nella pagina di
  benvenuto. Nota: `hidden` resta `false` e va bene — la prova sparisce dalla vetrina per codice
  (`isTrialPlan` in `listPlansForClient` e `listPublicPlans`), non per un flag che qualcuno può
  ribaltare dal Negozio senza sapere cosa comporta.
  Come si rifà, se un giorno serve: che il piano a €0 sia **uno solo**. Il modo più rapido è
  **Backoffice → Negozio**, che elenca tutti i piani col prezzo (anche i nascosti). Dalla Shell di
  Render, nella forma della §11 — `node -e`, **non** `ts-node`, che è in devDependencies e su Render
  non c'è:
  ```
  node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.plan.findMany({where:{priceCents:0},select:{id:true,name:true,period:true,active:true,hidden:true}}).then(r=>console.table(r)).finally(()=>p.$disconnect())'
  ```
  Se sono più di uno il codice **si ferma con un errore parlante** e si indica quale è la prova col
  parametro **`trial_plan_id`**, che vive in `config_param` → **Backoffice → Parametri**, non su Render.
  ⚠️ Nota di metodo: il primo comando scritto in questa voce usava `ts-node`, che su Render non è
  installato (è in `devDependencies`). Un comando che non parte è tempo perso in piedi davanti a una
  shell di produzione: la §11 aveva già la forma giusta, andava riusata invece di inventarne una. ⚠️ La parte app arriva sui telefoni solo con la **OTA 2.1.8**, a lista
  finita: fino a lì il backend è pronto e le clienti vedono ancora il vecchio flusso.
  `PlanFlow.tsx` non è più montato da nessuno: lasciato in piedi, da decidere se togliere.

- `[Sviluppo]` 📦 **OTA 2.1.7 — la correzione del caso Giusy arriva sui telefoni** — la 2.1.6 portava il
  banner della pesata di ciclo, non il modulo che ricompare dopo lo sblocco: quello sta in
  `MeasuresGate.tsx`, cioè nell'app, e senza bundle non esiste per nessuno. Nel 2.1.7 entrano i quattro
  file app toccati dopo il bundle precedente: `MeasuresGate.tsx`, `MenuStatusBanner.tsx`,
  `AppHeader.tsx`, `staff/shared/Notifiche.tsx`.
  Verifiche fatte **sullo zip prima di pubblicare**: `index.html` alla radice; `push-tokens` × 2 e
  listener `registration` × 2 (le push non spente dal build); la stringa `2.1.7` compilata dentro il JS;
  `Serve la tua pesata` e `ti ha riaperto` — cioè **la funzione per cui l'OTA esiste**, che è il solo
  controllo che un `dist/` vecchio ricostruito non passerebbe; `awaiting_cycle_measure` ancora presente,
  per non aver perso la 2.1.6 per strada.
  ⚠️ Nota di metodo: i comandi di verifica erano stati incollati in blocco **con i commenti `#` sulla
  stessa riga**, e la shell li ha presi come argomenti (`wc: #: open: No such file`). I tre `0 total`
  che ne sono usciti sembravano «stringa assente» ed erano errori di sintassi: un controllo che
  fallisce per il motivo sbagliato è peggio di nessun controllo. Rifatti uno per uno sullo zip vero.
  **Bruciate fino alla 2.1.7 compresa: la prossima OTA parte da 2.1.8.**

- `[Sviluppo]` 🚑 **«Riapri l'app» chiedeva le misure e faceva sparire il modulo per inserirle (caso
  Giusy, seconda puntata)** — segnalazione di Simone: «clicca riapri app, le arriva la notifica di
  inserire le misure ma non le fa inserire e si riblocca».
  Il backend faceva già la cosa giusta: dopo lo sblocco `measurementGate` risponde `required: true,
  blocking: false, level: 'promemoria'` — «cade il muro, resta la richiesta». Ma `MeasuresGate.tsx`
  guardava **solo `blocking`**, quindi con il muro caduto spariva anche l'unico posto dove scrivere le
  misure. Lei riceveva la notifica, apriva l'app, non trovava niente, e alla scadenza della finestra
  si ritrovava bloccata come prima. **Una richiesta senza il modo di soddisfarla è un rimprovero, non
  una richiesta.** Ora il modulo compare anche in promemoria — **richiudibile**, con scritto perché
  («la coach ti ha riaperto l'app, ma il prossimo menu parte solo con la pesata») — e si ritrova dal
  banner del Menu.
  E la finestra passa da **48 ore a 4**, come chiesto: 48 ore erano il peggio dei due mondi — troppo
  poche perché la cosa si risolvesse da sé, troppe perché qualcuno se ne accorgesse. La finestra serve
  a fare **una** cosa; se scade a vuoto, il muro che torna è l'informazione che serve alla coach.
  ⚠️ **La correzione è nell'APP: serve una OTA per arrivare sui telefoni.** Le 4 ore, che sono
  backend, valgono dal deploy.

- `[Sviluppo]` 🗑️ **Chi scrive un messaggio lo può cancellare** — richiesta di Simone: una ✕ rossa
  nell'angolo della propria bolla, con conferma prima di cancellare. **Solo l'autore**: non il capo,
  non l'admin. Il senso è rimediare a quello che si è scritto per sbaglio, non moderare quello che ha
  scritto un altro — un capo che cancella il messaggio di una collega dentro la conversazione con una
  paziente è una funzione diversa, con conseguenze diverse.
  La cancellazione è **morbida** (`deletedAt` + `deletedById`) e non un `DELETE`: la conversazione fra
  una cliente e chi la segue è materia sanitaria, e un consiglio dato e poi tolto resta un consiglio
  dato. Sparisce da **tutte** le letture — cliente, staff, contatore dei messaggi del thread e
  riassunti quotidiani, che altrimenti l'avrebbero rimesso in circolo da un'altra porta — e resta in
  tabella per chi un domani debba ricostruire i fatti. La conferma mostra il testo del messaggio: la
  ✕ è piccola e le bolle si somigliano. Cinque test.

- `[Sviluppo]` 🔥 **§15.5 — le calorie le può scrivere il nutrizionista, e resta scritto chi e perché** —
  il fabbisogno stimato è una **stima**: la formula non sa della tiroide, dell'attività dichiarata e
  non fatta, o del fatto che a 1600 kcal si è fermata per tre settimane. Chi lo sa è chi la segue, e
  fino a oggi non aveva un posto dove dirlo.
  **Due leve, scelte da Simone.** Il **deficit imposto** in kcal/giorno, che sostituisce quello dedotto
  dal ritmo dell'obiettivo ed è la leva clinica vera (resta agganciato al fabbisogno: se lei cala, il
  TDEE scende e le calorie scendono con lui, da sole); e la **correzione percentuale** sul totale, il
  ritocco fine per quando il ragionamento è giusto ma il risultato, sulla persona vera, è alto o basso.
  L'ordine è tutto e sta in `menu/correzione-kcal.ts`: `TDEE − deficit → ×(1+correzione) → soglia`.
  Prima del deficit, la percentuale si moltiplicherebbe con esso senza che nessuno se ne accorga; dopo
  la soglia, potrebbe scendere sotto il minimo con il pavimento che ha già dato l'ok. 17 test.
  **I tetti valgono sul deficit dedotto, non su quello prescritto.** Se il motore ricava dal ritmo
  dell'obiettivo un deficit di 1400 kcal/giorno, quello è un obiettivo irreale scritto in onboarding e
  va tagliato; se lo scrive un clinico, l'ha scritto un clinico.
  **Sulla soglia minima Simone ha deciso: la si può scavalcare, ma non per sbaglio e non in silenzio.**
  Il primo tentativo che finisce sotto viene **rifiutato, con dentro il numero** a cui si arriverebbe;
  serve un secondo invio con la conferma esplicita. Quando succede: riga nello storico marcata,
  segnalazione aperta (senza dedupe — ogni discesa è una decisione nuova con un motivo nuovo) e
  notifica ai capi nutrizionisti, perché lo devono **sapere**, non lo devono cercare.
  **Lo storico** (`kcal_override`) tiene i valori nuovi e i precedenti **e** il target in kcal prima e
  dopo: i valori dicono cosa è stato scritto, il target dice cosa è arrivato nel piatto, e non sono la
  stessa cosa perché in mezzo c'è il fabbisogno, che cambia da solo quando cambia il peso. Il **motivo
  è obbligatorio**: un target calorico cambiato senza il suo perché è un numero che nessuno può
  contestare, e in clinica quelli restano sbagliati più a lungo. Anche **azzerare** finisce nello
  storico — «chi gliele ha tolte» è una domanda che si fa quanto «chi gliele ha messe».
  Nella scheda cliente: il numero scomposto, l'**anteprima mentre si digita** (sapere di aver messo
  una cliente a 1000 kcal *dopo* averlo fatto non serve a niente) e lo storico con nome, data e motivo.
  ⚠️ **Verificato su Render prima di scrivere una riga**: `menu_kcal_need_enabled` non ha righe né in
  `config_param` né in `product_rule`, quindi vale il default del codice — **acceso**. Senza questa
  verifica avremmo costruito un campo inerte.
  🔧 **Trovato di striscio, e riparato: `redeliverFutureDays` poteva lasciare una cliente senza menu.**
  Cancellava i giorni futuri e poi rierogava, ma `deliverIfEligible` ha i suoi cancelli (misure
  mancanti, fine piano) e quando uno è chiuso restituisce zero. Risultato: giorni futuri persi e
  nessuno nuovo, per una modifica fatta da altri con tutt'altra intenzione. Ora si tiene una copia e,
  se la rierogazione non produce niente, **si rimettono com'erano** — un menu vecchio è meglio di
  nessun menu — e chi ha fatto la modifica lo legge, invece di credere che sia arrivata nel piatto.
  105 suite, **1611 test verdi**, type-check a zero.

- `[Sviluppo]` 🚨 **Build di produzione rotto, e la ragione per cui i test non potevano vederlo** —
  il commit `298c58f` ha fatto fallire il build su Render con un solo errore, in
  `menu.service.ts:463`: `soloGiornateComplete` dichiarava le giornate come `{ meals?: unknown }[]`
  e il risultato veniva riassegnato a `templates`, che Prisma tipizza `{ id, dayIndex, dietId,
  level, meals }[]`. **Corretto** con due tipi dichiarati a mano — `TemplateGiornata` accanto a
  `DietaPerErogazione` — perché quella variabile deve valere sia per le giornate della dieta
  richiesta sia per quelle della **gemella**, che sono di un'altra dieta.
  Nello stesso punto un secondo difetto, che il compilatore non poteva vedere: la query delle
  gemelle **non selezionava `levels`**, e il target calorico del giorno esce da
  `levelTargetKcal(diet.levels, level)`. Il ripiego avrebbe servito le giornate giuste **con le
  calorie a zero**. Ora `levels` e `objective` sono nella `select`, con un test che controlla la
  forma della query: è lì che il campo si perde, e si perde in silenzio.
  ⚠️ **LA REGOLA «42 ERRORI = VERDE», POI «32 = VERDE», È MORTA: IL VERDE È ZERO.** Quei numeri
  erano rumore dello stub di Prisma in sandbox, dove `npx prisma generate` prende un 403 sui
  binari — e un numero di rumore non distingue il rumore da un errore vero. Questo errore vero è
  passato in mezzo, ha superato **1578 test verdi** e si è visto solo in produzione: i test non
  potevano prenderlo perché montano un Prisma finto, e i tipi finti non hanno tipi.
  Da oggi `cd backend && npm run typecheck`: `prisma generate --no-engine` (per i **tipi** il motore
  di query non serve, serve lo schema) più un mirror finto in locale che risponde al 403 con un .gz
  di byte a caso — la CLI è contenta e genera i tipi **veri**. Verificato che riproduce l'errore di
  Render carattere per carattere, e che con la correzione dà **zero**. Come funziona, e i due file
  finti da 1 KB che lascia in `node_modules`, stanno scritti in testa a
  `backend/scripts/typecheck-reale.mjs`. 104 suite, **1578 test verdi**, type-check a zero.

- `[Sviluppo]` 🍽️ **Le giornate incomplete non arrivano più nel piatto (§15.4)** — il gate del
  catalogo controlla che una dieta abbia tutti i pasti **una volta sola**, quando qualcuno la rende
  visibile; l'erogazione non se l'è mai chiesto e si fermava solo alle giornate **zero**. Quindi una
  giornata con la sola colazione veniva servita e salvata così com'è, senza log e senza avviso: chi
  apriva l'app all'ora di pranzo non trovava niente, e da nessuna parte risultava un problema. Non è
  un caso di scuola — il generatore scrive le giornate direttamente e rompe solo se *tutti* gli slot
  sono vuoti, e due script pubblicano scavalcando il gate: una dieta può diventare incompleta **dopo**
  essere stata dichiarata a posto, e un controllo che si fa una volta sola non se ne accorge.
  Le tre decisioni di Simone, ora nel codice: **si servono le giornate complete** e le monche si
  saltano (un giorno in meno è meglio di un giorno con la sola colazione); se **nessuna** è completa
  si scende sulla **gemella completa della stessa famiglia**, tracciando `diet_meals_fallback` come
  già si fa per lo stile — il ripiego è voluto, il silenzio no; se **nemmeno le gemelle** reggono
  **non si eroga** e si apre una segnalazione, perché «menu in preparazione» è meglio di un pranzo
  che non c'è.
  La regola sta in `catalog/giornate-complete.ts`, usata sia dal gate sia dall'erogazione: era
  scritta a mano dentro il gate, e una regola che vive in un posto solo non può essere applicata in
  due. Sette test sul modulo, tre sull'erogazione.
  ⚠️ **I test del menu montavano giornate finte con un solo pasto** — e con lo slot scritto in
  italiano (`colazione`, `pranzo`, `cena`), che non corrisponde a nessuno slot reale. Restavano
  verdi perché nessuno guardava i pasti: sono stati allineati alla realtà, ed è la ragione per cui
  il difetto è vissuto tanto. Un test che semplifica il dato semplifica anche quello che può trovare.
  104 suite, 1578 test verdi. **`tsc` ora è a 32 e non più a 42**: tipizzando la dieta
  nell'erogazione sono caduti dieci errori che erano artefatti dello stub. Il nuovo riferimento è
  **32**.

- `[Sviluppo]` 💬 **Coach e nutrizionista rispondono dalla scheda cliente** — chiesto da Simone. La
  sezione Conversazioni era di sola lettura: si leggeva il problema con davanti misure, menu e
  segnalazioni, e per rispondere bisognava cambiare pagina. Ora in fondo alla conversazione c'è il
  campo, con invio da Ctrl/⌘+Invio (a capo con Invio: qui si scrivono spiegazioni lunghe, e un invio
  a metà frase parte così com'è).
  **Sul thread di Gaia il campo non compare**, e al suo posto c'è la ragione: una risposta dello
  staff dentro la conversazione con l'assistente arriverebbe alla cliente come se l'avesse scritta
  Gaia. Il backend la rifiutava già — là dentro lo staff ha accesso in sola lettura — ma un campo che
  si può scrivere e non si può inviare è una promessa rotta.
  Chi può scrivere continua a deciderlo il backend: è **chi segue la cliente**, non chi ne risponde
  in gerarchia (una coordinatrice che scrive nel thread «Coach» farebbe comparire alla cliente un
  messaggio che sembra della sua coach). Se rifiuta, si legge il suo motivo invece di un campo che
  sparisce senza spiegazione.

- `[Sviluppo]` 🎨 **Tema indaco: barra dei menu più chiara, e testi delle notifiche leggibili** —
  due segnalazioni di lettura, tutte e due sulla stessa causa: un colore usato fuori dal suo posto.
  La **barra dei menu** prendeva `--deep`, che nel tema indaco è quasi nero. Ora esiste `--sidebar`,
  che di default vale `--deep` — quindi gli altri temi non cambiano di un pixel — e nell'indaco vale
  `#4b4878`: più chiara, ancora abbastanza scura da tenere il testo leggibile. Anche le etichette dei
  gruppi hanno il loro colore per tema: quel verdino fisso, su un fondo schiarito, spariva.
  I **testi delle notifiche** usavano `.muted`, il grigio delle didascalie. Ma in una notifica la
  frase sotto il titolo **è** il contenuto: è la riga che si deve leggere, non un'etichetta accanto a
  un dato. Ora usano `.notif-testo` — colore pieno, appena attenuato per restare sotto il titolo in
  grassetto — nel campanello e nella pagina Notifiche del backoffice, e negli stessi due punti
  dell'app (cliente e staff).

- `[Sviluppo]` 📄 **Il selettore di pagina anche sopra le tabelle di Gestione dieta** — chiesto da
  Simone: con cento righe per pagina, cambiare pagina costava scorrere fino in fondo e poi risalire
  per rileggere le intestazioni. Due scorrimenti interi per ogni pagina, sulla schermata dove il
  nutrizionista passa le ore quando rivede un catalogo.
  Messo su tutt'e tre le tabelle di quella schermata — ricette, allergeni, gruppi di equivalenza —
  perché per chi ci lavora sono la stessa pagina con tre linguette, e sistemarne una sola avrebbe
  spostato il fastidio invece di toglierlo. È lo stesso `<Pager>` collegato allo stesso stato:
  restano d'accordo da soli e spariscono entrambi quando la pagina è una sola.
  Al componente è stata aggiunta una `sopra` che sposta il filo di separazione da sopra a sotto:
  senza, il bordo superiore si sovrapponeva a quello della card e il blocco sembrava staccato dalla
  tabella che comanda.

- `[Sviluppo]` ⚖️ **«Gioia ha ricevuto otto giorni di menu con una pesata sola»** — e non c'era nessun
  difetto: c'era una **regola sbagliata**, che è peggio, perché non lascia tracce.
  La ricostruzione, dall'audit delle erogazioni: puntuali ogni due giorni, sempre due giornate —
  il 7/8 (8-9), il 9/8 (10-11), l'11/8 alle 07:26 (12-13) — con l'ultima pesata del **7 agosto**. Il
  cancello della pesata del ciclo *è* stato interrogato ogni volta e ha lasciato passare, perché la
  prima riga di quella funzione era `if (in vacanza) return false`: la **modalità viaggio esentava
  dalle misure**. Regola «Vacanze in Serenità», scritta apposta. Il risultato è che le ultime quattro
  giornate erano tarate su un peso di quattro giorni prima — e il fabbisogno si calcola sul peso
  attuale, quindi erano tarate male.
  Prima di arrivarci ho fatto due ipotesi sbagliate — che i menu fossero stati erogati prima del gate
  del 10/8, e che `menu_days_delivered` valesse 4 — e le ha smentite entrambe un comando sui dati.
  Vale la pena scriverlo: su una cliente vera l'ipotesi plausibile non basta, e le due volte che ho
  detto «torna tutto» erano le due volte in cui non tornava niente.
  **La regola nuova, decisa da Simone: o ricevi menu e le misure valgono come per tutte, oppure sei
  in pausa — non ricevi menu ed entri nel protocollo di monitoraggio** (che esiste già: peso di
  riferimento, promemoria, avviso alla coach se risale). Niente terza strada in cui i menu arrivano e
  nessuno chiede il peso. Vale anche per la dieta «Vacanze in Serenità», che è una dieta come le
  altre. La modalità viaggio continua a fare l'altra cosa per cui serve — l'agente dieta sceglie
  piatti che al mare la cliente mangerà davvero — e quella col peso non c'entra.
  Tolta l'esenzione dai **due** punti in cui viveva (il popup e l'erogazione). Il blocco di test che
  verificava il comportamento vecchio è stato riscritto per pretendere quello nuovo: restava verde
  certificando la regola che stiamo togliendo.
  **E il `diag:cliente` ora stampa la modalità viaggio e il piano fermato.** È lo strumento che
  esiste per rispondere a «perché riceve/non riceve il menu», e su Gioia taceva proprio sullo stato
  che aveva disattivato la regola: ci abbiamo girato attorno un'ora. Una diagnostica che non nomina
  la causa manda a cercarla altrove, che è peggio del non averla.
  ⚠️ **Da guardare prima del deploy**: le clienti con la modalità viaggio accesa **adesso** si
  vedranno chiedere la pesata al prossimo ciclo. Non è un danno, ma è un cambio di comportamento che
  è meglio sapere in anticipo — il comando per contarle sta in `PUNTO_DELLA_SITUAZIONE` §11.

- `[Sviluppo]` 🎛️ **I due pulsanti della coda ora fanno qualcosa — Consegna B (§15.2 punti 2, 3, 4)** —
  la domanda di Nocanty era «cosa fanno questi due pulsanti?» e la risposta onesta era «niente»:
  scrivevano un esito che nessun altro pezzo di codice leggeva.
  **«Correggi» apre le azioni della causa**, non un modulo generico: calo rapido → autorizza a
  proseguire · scrivi in chat · apri la scheda · blocca il piano; energia bassa → senza
  l'autorizzazione (non c'è nessun punto di partenza da spostare: il segnale viene dai check-in);
  screening → solo i due rimandi. La tabella sta in `engine/causa-decisione.ts` ed è **la regola**,
  non un suggerimento per l'interfaccia: il backend rifiuta un'azione non prevista per quella causa,
  perché una regola che vive solo nei pulsanti si aggira con una POST. «Apri la scheda» e «Scrivi in
  chat» restano rimandi: i cambi dieta non si reimplementano lì, e una seconda strada con controlli
  diversi è il modo in cui nascono i buchi nei permessi.
  **«Autorizza a proseguire» azzera il punto di partenza del calcolo** (`rapidLossBaselineAt`): da
  quel momento l'allarme guarda **solo le pesate successive**, con il pavimento deciso — 4 giorni e
  3 pesate nuove — perché due pesate ravvicinate ricostruiscono una pendenza ripidissima e l'allarme
  risuonerebbe il giorno dopo l'ok. I due numeri sono **parametri** (`rapid_loss_resume_min_days`,
  `rapid_loss_resume_min_measures`, categoria sicurezza): sono clinici, li cambia Nocanty senza
  deploy. Si azzera l'allarme e **non i progressi**: grafico, chili persi, proiezione e tendenza
  continuano a leggere tutta la storia — c'è un test che lo pretende.
  ⚠️ **Il difetto che stavo per consegnare, e che la revisione ha fermato**: il modulo
  `signals/allarme-calo.ts` era scritto, testato con otto test verdi e **non chiamato da nessuno**.
  Il campo veniva scritto dal nutrizionista e mai usato: avrebbe premuto il pulsante e la stessa
  riga sarebbe tornata in coda la notte dopo. Ora è agganciato in **due** punti — `progress.service`
  (l'allarme che riempie la coda) e `signals.service.checkRapidLossGuardrail` (la segnalazione
  clinica, che nasce a ogni pesata salvata: senza, la segnalazione sarebbe ricomparsa lo stesso
  giorno dell'autorizzazione) — con quattro test che guardano **se l'allarme suona**, non se il
  campo viene scritto. Una suite verde certifica la regola, non che sia attaccata.
  **«Blocca il piano» esiste davvero** (`planHeldAt` / `planHeldReason` / `planHeldById`): ferma i
  giorni **nuovi**, e quelli già ricevuti — incluso oggi — restano alla cliente. È il controllo che
  al «piano bloccato» di prima mancava: `dietBlock` è letto da `getMenu` e `menuStatus`, cioè decide
  cosa la cliente *legge*, e non è mai stato letto dall'erogazione. In app c'è uno stato nuovo con
  parole oneste — «la nutrizionista ha messo in pausa i nuovi giorni e ti contatterà; i giorni che
  hai già ricevuto restano disponibili» — invece della frase sulle esclusioni alimentari, che
  davanti a un calo troppo rapido è falsa due volte.
  Lo **sblocco** è di chi l'ha messo, del capo o dell'admin (decisione di Simone). Il pulsante sta
  nella scheda cliente, accanto allo stato del piano: un blocco che si mette da una schermata e si
  toglie solo da un'API è un blocco che resta — anche questo trovato in revisione.
  Tre effetti collaterali chiusi mentre c'ero: la stessa decisione **non si può lavorare due volte**
  (il doppio clic spostava il baseline e cambiava il proprietario del blocco, cioè toglieva a chi
  l'aveva messo il diritto di riattivarlo); l'errore di chiusura della riga **non si ingoia più**;
  e «Rigenera menu» su un piano fermo non cancella più niente — cancellava i giorni futuri senza
  poterli rierogare, cioè toglieva alla cliente proprio quelli che il blocco le lascia.
  103 suite, 1567 test verdi; `tsc` invariato; backoffice e app compilano.

- `[Sviluppo]` 🩺 **«Cristina è onnivora, perché le diamo una dieta vegana a 3 pasti?»** — la scheda
  diceva il falso, e la cosa peggiore è che non rompeva niente. Il profilo di Cristina dice
  `Flessibile · flexible · **omnivore** · 5 pasti`, e di menu non ne ha ricevuto **nessuno**: zero
  giornate erogate, nessun abbonamento, nessuna data di inizio. Quella riga non descriveva niente
  che le stesse succedendo.
  La causa: la scheda cercava la dieta con `findFirst({ where: { name: dietFamily } })` — **per nome
  e basta**. Una famiglia ha fino a diciotto varianti che condividono il nome e si distinguono per
  regime, stile, obiettivo e pasti: quella query pescava la prima che capitava e ne mostrava regime
  e pasti come se fossero della cliente. È la trappola scritta in testa a `pick-diet.ts` — «la
  famiglia da sola potrebbe agganciare l'omonima di un altro stile» — evitata nel motore e mai
  portata qui. Nessun errore, nessun test rosso, una schermata che risponde: solo che dice il falso,
  e manda a cercare un errore di assegnazione che non esiste.
  Ora la riga cerca la variante **esatta** (nome + stile + regime + pasti) e, se non c'è, mostra la
  dieta che il motore **servirebbe davvero**, chiedendola alla stessa `pickDietFor` dell'erogazione.
  Sotto compare cosa manca a catalogo: «non c'è la variante … omnivore · 5 pasti: viene servita …
  Si chiude generando quella variante, **non cambiando il profilo della cliente**» — la chiusa è
  voluta, perché adattare il profilo a ciò che esiste fa sparire il sintomo e lascia il buco.
  Il **regime** ha un messaggio a parte, in rosso: `pickDietFor` non lo lascia mai cadere, quindi un
  regime diverso non è un ripiego ma un dato incoerente, ed è l'unico caso in cui una cliente
  potrebbe trovarsi nel piatto qualcosa che non mangia.
  La regola sta in `clients/scostamento-dieta.ts`, fuori dalla schermata, con sette test: dentro il
  componente sarebbe una riga in mezzo a una `<Row>`, cioè esattamente il posto in cui questo
  difetto è vissuto finora. 103 suite, 1552 test verdi; `tsc` invariato, backoffice compila.
  ⚠️ Resta aperto il **lavoro di catalogo**: se la variante `Flessibile · omnivore · 5 pasti` non
  esiste, il ripiego continua — ora però si vede. `npm run diag:dieta -- "Flessibile"` lo dice.

- `[Sviluppo]` ✅ **La 2.1.6 è sui telefoni — verificato sul manifest, non sul registro** —
  `/api/v1/app-updates/latest.json` risponde `{"version":"2.1.6", "url":".../metabole-2.1.6.zip"}`,
  letto dal browser. È l'unica prova che esista: lo stato dell'OTA vive in una variabile d'ambiente
  su Render, cioè fuori dal repo e fuori da ogni registro — il 6/8 un passaggio dato per fatto non era
  mai stato completato, e nessun documento poteva dirlo. Quindi il banner della pesata **è** sul
  telefono di Giusy, e da lì il suo menu riparte con una pesata.
  Allineati anche i documenti che invecchiano da soli: §1 diceva ancora «ultima OTA 2.1.4» e 1496
  test, la guida `COME_SI_FA_UNA_OTA.md` dichiarava «stato al 9 agosto: package.json 2.1.2, la
  prossima parte da 2.1.3». Quel paragrafo è il più pericoloso della guida — un numero vecchio lì fa
  **riusare una versione bruciata**, che è l'errore che non si può rimediare — quindi ora dice di
  aggiornarlo nello stesso commit del bundle e di fidarsi comunque del manifest. Aggiunto alla guida
  anche il **terzo controllo**: cercare nello zip una stringa della funzione, non solo il numero.

- `[Prodotto]` 🍽️ **Il catalogo delle 12 settimane passa al nutrizionista** — decisione di Simone:
  la generazione delle settimane non è più lavoro in coda allo sviluppo. Il nutrizionista le crea,
  comunica quando ha finito, e **noi verifichiamo** (Copertura catalogo col selettore della settimana:
  ogni pasto previsto verde con 7). Il protocollo di §6 resta scritto, ma cambia destinatario: da
  «cosa devo fare io» a «istruzioni per chi genera, e cosa guardare quando arriva il fatto».
  Cambia anche la domanda sulle ~270 varianti senza clienti: non è più «chi trova 13-14 ore» ma fino a
  dove vale la pena arrivare — e si decide quando sappiamo a che punto è arrivato lui.

- `[Sviluppo]` 🧹 **Quattro comandi lanciati in produzione, quattro volte «niente da fare»** — e la
  lista si accorcia di cinque voci. `fix:consenso-sanitario`: 35 questionari completati, **0** bloccate
  senza consenso (la riparazione dell'8/8 ha tenuto). `pulisci:spezie`: 47 profili esaminati, **nessuna
  spezia** fra i cibi esclusi. `fix:stato-questionario`: **0** schede da spostare, tutte e 35 sono già
  più avanti nella pipeline. `fix:segnalazioni`: **nessuna orfana**, tutte hanno un destinatario — il
  che chiude anche §3.4, le due segnalazioni di Giusy di luglio.
  Vale la pena dire cosa insegna un giro che non cambia niente. Tre di queste quattro voci erano in
  lista perché il lavoro era stato **fatto** l'8/8 e non **riguardato dopo**: una cosa fatta e non
  verificata resta in lista esattamente come una non fatta, e chi legge non ha modo di distinguerle.
  Il costo di guardare era di quattro comandi in dry-run; il costo di non guardare era portarsi dietro
  cinque voci che sembravano lavoro. Tutti e quattro gli script hanno lo stesso disegno — nudi non
  scrivono niente, servono `CONFERMA=1` — ed è questo che rende il controllo gratuito.
  Chiuse in §11 e §3.4 con il numero che hanno stampato, non con «fatto»: il numero è la prova, e fra
  un mese distingue «l'ho lanciato» da «l'ho lanciato e non c'era niente».

- `[Sviluppo]` 📱 **OTA 2.1.6 — il banner della pesata arriva sui telefoni** — quello che stamattina è
  entrato in produzione lato backend era invisibile alle clienti: il pezzo che parla è nell'app, e
  l'app si aggiorna solo con un bundle. Porta le due schermate del caso Giusy: il banner
  `awaiting_cycle_measure`, che dice cosa serve e **ha il pulsante** che apre il modulo della pesata
  (senza, alla cliente riaperta il popup non compare più e il banner sarebbe un rimprovero senza
  rimedio), e lo sblocco della coach che diventa promemoria invece di muro. Dentro c'è anche la
  rimozione di `Placeholder.tsx`.
  Verifiche sullo zip **prima** di committarlo: `index.html` alla radice, **due** occorrenze di
  `push-tokens` e il listener `registration` presenti — cioè le push non sono state spente dal build,
  che è l'incidente del 6/8 — e la versione `2.1.6` compilata dentro il JS.
  Un controllo nuovo rispetto alle volte scorse: **si cerca nel bundle una stringa della funzione che
  la OTA deve portare** (`awaiting_cycle_measure`). Fino alla 2.1.5 si verificava solo che il numero
  fosse quello giusto, il che dimostra che il bundle è nuovo ma non che **contenga la cosa per cui lo
  stai pubblicando**: un `dist/` vecchio ricostruito passerebbe tutti gli altri controlli.
  ⚠️ Al commit manca l'ultimo passo, che vive fuori dal repo: **`OTA_VERSION = 2.1.6` su Render**.
  Finché non è impostata, il bundle è servito ma nessun telefono sa di doverlo prendere — e l'unica
  prova che sia andata è leggere `/api/v1/app-updates/latest.json`, non questo registro.

- `[Sviluppo]` 💶 **Provvigioni e prezzi: due voci chiuse da Simone, e un residuo trovato mentre le
  chiudevo** — le **percentuali** sono verificate sulle vendite reali, i compensi che escono sono
  quelli giusti; i **prezzi** sono quelli del Negozio e da lì si aggiornano ovunque da soli.
  Verificato nel codice prima di chiudere la voce: il report legge sempre `plan.priceCents` dal
  database, con la promo gestita da `listPriceCents` + `promoEndsAt` — nessun prezzo scritto a mano
  sul percorso del report, quindi **si può mandare a una cliente vera**.
  Il residuo: il testo del task che arriva alla coach quando scade il codice personale ha i prezzi
  **dentro la frase** («1 mese €99 · 3 mesi €249», `coach-tasks.service.ts:206`). Quello non segue il
  Negozio: il giorno che il prezzo cambia, la coach legge il vecchio e lo ripete alla cliente. Aperto
  in §4.1, si chiude leggendo il piano come fa il report.
  Resta aperta solo la parte che **nessuna vendita può ancora aver verificato**: chi prende la
  provvigione **al rinnovo** se la coach nel frattempo è cambiata. Non si vede nei compensi già
  erogati perché il primo rinnovo automatico non è mai passato, e il codice paga «chi c'è adesso».

- `[Sviluppo]` 🗓️ **Le date di questo registro erano avanti di due giorni** — e non è una pignoleria:
  è la ragione per cui oggi ho aperto un allarme falso. Credendo che fosse il 13, ho letto la tabella
  delle decisioni del motore — l'ultima è dell'11 — come «il cron è fermo da due notti», e ci ho
  costruito sopra una diagnosi completa, con l'elenco di tutto ciò che sarebbe stato fermo con lui:
  notifiche quotidiane, task della coach, monitoraggio, report, scadenze delle prove. Il cron aveva
  girato quella notte. **Quell'11 non era un buco: era oggi.** Un dato giusto letto con una data
  sbagliata produce un allarme falso esattamente come un clone vecchio di quattro giorni — stessa
  famiglia delle sette voci false, stesso costo: dopo due o tre nessuno crede più alla lista.
  Da dove veniva lo scarto: il lavoro fatto la sera tardi veniva scritto sotto la data del giorno
  dopo, e la cosa si è accumulata. Riallineato su `git log`, l'unica fonte che non dipende da cosa
  credeva il calendario di chi scriveva: l'ex «13» è l'**11** (i commit di stamattina, dalle 06:28
  alle 07:51), l'ex «12» e l'ex «11» sono **entrambe il 10** (notte e pomeriggio), l'ex «10» è il
  **9**. Tre sezioni si sono fuse con quelle sotto. Dall'8/8 all'indietro le date risultano già
  corrette e non sono state toccate.
  Corretti anche i riferimenti dentro ai testi dove erano ancorabili a un commit; per quelli rimasti
  c'è la nota in testa a questo file e a `PUNTO_DELLA_SITUAZIONE.md`, così la prossima sessione non
  ci ricasca. La migrazione consegnata oggi è stata rinominata alla data vera
  (`20260811070000_causa_decisione_motore`), con la cartella vecchia spostata in `_to_delete/`.
  ⚠️ Il nome finisce **prima** di tre migrazioni già applicate, che portano anch'esse date avanti:
  `prisma migrate deploy` la applica lo stesso — guarda quali mancano, non l'ordine — ma un
  `migrate dev` in locale può segnalare l'ordine incoerente.

- `[Sviluppo]` 🗂️ **La coda del nutrizionista: una riga per causa, e solo per chi ha un piano** —
  i punti 5 e 6 delle sei decisioni di `PUNTO_DELLA_SITUAZIONE` §15.2. Non toccano ancora cosa
  fanno «Conferma» e «Correggi»: rendono la coda una lista di cui ci si può fidare, che è la
  condizione perché quei due pulsanti valga la pena costruirli.
  **La causa diventa una colonna** (`EngineDecision.reasonKey`): prima viveva solo dentro il testo
  della segnalazione — `[calo_rapido_energia] frase` — e si interrogava con un `contains`, cioè un
  confronto che si rompe riscrivendo la frase. Serviva per poter chiedere al database «di questa
  cliente, per QUESTA causa, esiste già una riga che nessuno ha guardato?».
  La riga del giorno **si scrive comunque**: serve al messaggio quotidiano, che legge la decisione
  di oggi per darle il tono attenuato, e serve allo storico — sapere che una causa è durata undici
  giorni è un dato clinico, non rumore. Quello che non si ripete è la **chiamata a guardarla**:
  finché la riga aperta non è stata revisionata, le successive nascono senza il flag. Appena il
  nutrizionista la guarda, la notte dopo ricompare — il «il controllo resta armato» di Nocanty.
  La parte che non si vede, ed era il rischio vero: quelle righe non flaggate sarebbero diventate,
  per `menu.service`, **decisioni ordinarie da applicare** — cioè un guardrail che dice «fermati,
  deve guardarci una persona» avrebbe finito per cambiare il piano da solo. Il menu ora legge con
  `flaggedForReview: false` **e** `reasonKey: null`.
  La migrazione fa il **backfill delle sole righe ancora aperte** (otto all'11/8, una per cliente,
  contate su Render). Senza, la funzione nuova nascerebbe rotta il giorno del deploy: quelle righe
  hanno la causa a NULL, il controllo non le troverebbe, e la prima notte nascerebbe un doppione
  permanente per ognuna — esattamente il rumore che la modifica toglie. Sullo storico già
  revisionato non si tocca niente: una causa indovinata su dati vecchi sarebbe un dato inventato
  dentro una cartella clinica.
  **Il motore gira solo su chi ha un piano alimentare attivo.** `runBatch` prendeva tutte le
  clienti col questionario completato senza guardare l'abbonamento: nello screenshot della coda
  c'era Rosaria, piano concluso il 22/07. Filtrare il batch non basta — le righe già scritte
  restano a database — quindi il filtro è anche sulla coda e sul contatore, e **non si cancella
  niente**: quelle righe sono lo storico della cliente, e se torna tornano ad avere senso. Il
  filtro sta in `common/piano-attivo.ts` accanto alla funzione che risponde alla stessa domanda per
  le diagnostiche, ma è un **filtro da innestare nella query** e non una risposta da leggere: con
  la seconda strada i `count()` resterebbero sbagliati, cioè il numero fra parentesi direbbe una
  cosa e l'elenco un'altra.
  Il **monitoraggio è escluso** (abbonamento attivo, ma non è un piano alimentare: chi lo ha non
  riceve menu), e nel codice sta scritto anche **cosa questo spegne**: il guardrail «energia bassa
  cronica» esiste solo dentro il motore, quindi per chi è in monitoraggio o fra due piani non nasce
  più — il calo rapido invece resta coperto da `signals.service`, che non passa di qui. Se si
  decide che va visto comunque, il posto dove metterlo è lì, non riaprendo questo filtro.
  Due cose che combaciavano male da prima: il numero **«Da validare» sul telefono** contava anche
  le decisioni già revisionate (diceva 9, la coda che apriva ne aveva 2), e la coda era ordinata
  **dalla più recente** — che ora vorrebbe dire che più a lungo un problema resta aperto più
  affonda, fino a uscire dalle prime cento. Ora dalla più vecchia.
  101 suite, 1537 test verdi; `tsc` invariato sul baseline del sandbox. Resta aperto, e scritto nel
  codice: per il capo/admin il badge conta i suoi pazienti mentre la coda è globale.

- `[Sviluppo]` ⚖️ **«L'hai sbloccata ieri e non ha generato il menù»** — il caso Giusy, ed erano **tre
  difetti che presi uno per uno si giustificavano, e insieme lasciavano una cliente senza menu, senza
  istruzioni e con una frase che le diceva di aspettare**.
  Sulle misure ci sono due controlli, e non si parlavano. `cycleNeedsMeasure` decide l'**erogazione**:
  senza una pesata dentro il ciclo corrente i giorni nuovi non partono, ed è giusto — è la regola
  del 10/8, «ci serve sempre una misura per erogare il menu». `measurementGate` decide il **popup** che
  glielo chiede. Lo sblocco della coach scrive `measuresUnlockedUntil`, e quel campo era letto **solo dal
  secondo**: sbloccare toglieva la richiesta e lasciava il blocco. Cioè si aiutava la cliente spegnendole
  l'unica istruzione che aveva.
  Terzo pezzo: `menuStatus` non aveva uno stato per quel cancello — controllava solo la misura **di
  partenza** — quindi cadeva su «Menu in preparazione, arriverà a breve». Falso: non arriva niente finché
  non si pesa. Ora c'è `awaiting_cycle_measure`, che dice cosa serve e **ha un pulsante** che apre il
  modulo della pesata da lì; senza quel pulsante il banner sarebbe un rimprovero senza rimedio, perché
  alla cliente riaperta il popup non compare più.
  Lo sblocco resta com'era nella sostanza — la pesata serve comunque — ma ora lo dice: `required: true`,
  `blocking: false`, livello `promemoria`. Cade il muro, resta la domanda. E nel backoffice il pulsante si
  chiama **«Riapri l'app»**, non più «Sblocca app», con scritto che non fa arrivare il menu: il nome
  vecchio prometteva l'altra cosa, ed è il motivo per cui è stato usato aspettandosi un menu.
  Lo stesso buco c'era in `diag:cliente`, cioè nello strumento che serve esattamente a rispondere alla
  domanda «perché non riceve il menu?»: su Giusy avrebbe stampato «idonea, ma le giornate non sono ancora
  state erogate» — vero e inutile. Ora stampa il ciclo corrente, l'ultima pesata, se manca, e se c'è uno
  sblocco attivo con accanto che non eroga.

- `[Sviluppo]` 💚 **Gaia parla di sé al femminile** — segnalato da Simone su un messaggio dell'8/8: «sono
  felicissimo di festeggiare i tuoi progressi», firmato Gaia. Il prompt diceva «Sei l'assistente di
  Metabole»: **senza nome e senza genere**, quindi il modello ripiegava sul maschile. Non è una sfumatura
  di stile — le clienti la chiamano per nome e vedono la sua faccia: una che parla di sé al maschile
  smette di essere una persona e diventa un programma. Ora il prompt dice chi è, e il modello concorda da
  sé per tutta la conversazione, senza bisogno di un controllo sull'uscita. Verificato che nel backend non
  esistano altre frasi fisse al maschile pronunciate da lei.

- `[Sviluppo]` 🧽 **Le piccole cose che mentivano** — cinque voci in una passata, tutte dello stesso
  genere: codice o interfacce che raccontavano una cosa diversa da quella che fanno. Nessuna rompeva
  niente, tutte facevano perdere tempo o prendere decisioni sbagliate.
  **Due chiavi dei permessi che non controllavano niente** — `engine_reviews` e `assignments`: dichiarate,
  con i loro valori di default e la loro etichetta, e **senza nessuna guardia** che le leggesse. La
  seconda era la più insidiosa: l'assegnazione di una cliente passa da `POST /admin/assignments`, che è
  `@Roles('admin')` e ignora la matrice — concedere «assignments» a una coordinatrice non le dava niente,
  e nessun errore lo diceva. Una chiave nella matrice è una **promessa**, e chi la accende crede di aver
  abilitato qualcosa: togliere è più onesto che lasciare un interruttore finto. Se un domani si vuole che
  siano le coordinatrici ad assegnare, la chiave si riaggiunge **e** si aggancia a quell'endpoint — è una
  decisione di prodotto, e sta scritta in testa al file.
  **`monitoring_offer_days`**: letto a ogni giro del cron e usato da nessuno. Serviva ai menu di rientro a
  pagamento e al congelamento di chi non comprava, entrambi rimossi il 7/8. Ora la lettura è via e la
  descrizione nei Parametri dice «NON PIÙ IN USO»: la riga resta a catalogo perché cancellarla dal seed
  non toglie quella già scritta in produzione, e una chiave che sparisce dal codice ma resta a database è
  più difficile da capire di una dichiarata inerte.
  **Tre commenti superati**: `rules-evaluator.ts` diceva che eventi e pause «arriveranno col calendario,
  per ora sempre neutro» — li calcola `signals-collector` da mesi; `agents.service.ts` diceva che il
  runtime degli agenti «arriverà in una fase successiva» — sta nella cartella accanto
  (`agent-orchestrator`, `agent-runner`); `chat/ai-filter.ts` diceva che l'AI generativa «arriverà in
  M10», e leggendolo si concludeva che in chat non ci fosse un modello — c'è, con la banca dati
  nutrizionale a fare da ancora e la guardia sull'uscita.

- `[Sviluppo]` 🏖️ **La scadenza della vacanza è un numero solo** — `statoViaggioAttivo` accetta un tetto
  di giorni per un «in vacanza» senza data di fine, e il gate misure lo chiamava **senza passarlo**:
  valeva il default del helper (30) mentre `DietAgentService` leggeva `travel_max_days` dai Parametri.
  Due numeri per la stessa scadenza. Il giorno in cui qualcuno lo porta a 60 dai Parametri, il gate e
  l'agente non sono più d'accordo su chi è in vacanza — il primo torna a chiedere le misure, il secondo
  la considera ancora via — e non lo dice nessun errore. Ora il parametro si passa in entrambi i punti,
  con un test che lo dimostra: la stessa cliente, in vacanza da 40 giorni senza data di fine, blocca col
  tetto a 30 e non blocca col tetto a 60. Senza il passaggio del parametro quel test resterebbe rosso.

- `[Sviluppo]` 🧹 **Via `Placeholder.tsx` dall'app** — schermata «Questa sezione è in costruzione. Torna
  presto!» che nessuna rotta importava. Un file così non fa danni finché nessuno lo aggancia: il rischio
  è che qualcuno lo trovi e lo usi «per intanto», e una cliente che paga si trovi davanti un cartello di
  lavori in corso. Verificato che nessun file lo nomini, app ricostruita e 27 test verdi. Spostato in
  `_to_delete/` sul Mac: il ponte non può cancellare, quindi la cartella la elimini tu.

- `[Sviluppo]` 🇮🇹 **I messaggi di validazione arrivano in italiano anche quando nessuno li ha scritti** —
  `class-validator` genera i suoi in inglese, quindi un DTO nuovo nasceva sbagliato senza che nessuno
  facesse niente di male: il 7/8 una cliente si è vista rispondere «hipsCm must not be less than 40»
  sotto un pulsante che sembrava rotto — non nella sua lingua, senza dirle cosa fare, col nome di una
  colonna del database dentro. La difesa esistente (un `message` scritto a mano su ogni decoratore, con
  un test che lo pretende) copriva solo i DTO in una lista che si allunga a mano: chat, documenti, buoni
  sconto ed eventi erano scoperti, e il commento di quel test lo diceva già.
  Ora c'è la rete a valle: `exceptionFactory` sulla `ValidationPipe` (`common/messaggi-validazione.ts`).
  Traduce **solo** gli schemi di class-validator — «should not be empty», «must not be less than 40»,
  «must be shorter than or equal to 600 characters», la whitelist, gli array — e **lascia intatto**
  qualunque messaggio scritto da noi: nel dubbio non traduce, perché riscrivere una frase pensata da una
  persona è un danno nuovo, non una correzione. C'è un test dedicato a questo.
  Due scelte che vale la pena ricordare. Il **nome del campo** resta il suo per tutto ciò che non è in un
  dizionario corto dei campi che una persona compila davvero: tradurre tutto il modello dati richiederebbe
  un dizionario che nessuno terrebbe aggiornato, quindi il caso peggiore diventa «italiano un po' tecnico»
  invece di «inglese incomprensibile» — e per questo la regola del `message` scritto a mano **non**
  decade. E la **forma della risposta** resta quella di Nest (`message` come elenco di stringhe), perché
  l'app e il backoffice la leggono così: cambiarla avrebbe rotto ogni schermata che mostra un errore di
  validazione. Gli errori annidati vengono percorsi, altrimenti un oggetto sbagliato dentro il corpo
  produceva un 400 con l'elenco vuoto — un rifiuto che non dice niente.
  100 suite, 1519 test verdi. Aggiornato anche il commento di `messaggi-clienti.spec.ts`, che dichiarava
  l'assenza di questa rete.

- `[Sviluppo]` 🔒 **Il Monitoraggio si vede solo a mantenimento SCADUTO e non rinnovato** — la decisione
  di ieri, ora nel codice. Prima la condizione era «ha già fatto (o sta facendo) il mantenimento»:
  bastava un abbonamento `active`, quindi il monitoraggio compariva dal **primo giorno** e a una cliente
  che aveva appena pagato €49 offrivamo l'opzione da €19 **dentro il mese che aveva appena comprato**.
  Ci vendevamo contro noi stessi.
  `statoMonitoraggio` fa due domande e le mette insieme: esiste un mantenimento con la **fine già
  passata**, e **non** ce n'è uno ancora in corso. Il confronto è per **giorno** — un mantenimento che
  finisce oggi resta in corso fino a domani, altrimenti il monitoraggio comparirebbe a mezzanotte e un
  minuto dell'ultimo giorno pagato. La condizione è la stessa nella vetrina **e** all'acquisto: il
  difetto storico di quest'area è stato proteggere solo la vetrina, e un `planId` in mano basta a saltarla.
  I tre casi al bordo, ognuno con un test: **disdetto con la fine nel futuro** → non si mostra, il mese
  pagato è suo (per questo «in corso» accetta anche `cancelled`, non solo `active`); **rinnovato** → non
  si mostra, il rinnovo sposta la fine in avanti sulla stessa riga; **più mantenimenti** → basta che uno
  sia concluso e nessuno in corso. E due messaggi invece di uno: «finché è in corso continui con quello,
  senza pagare due volte» per chi lo sta usando, «viene dopo il Mantenimento» per chi non l'ha mai fatto —
  dirle la frase sbagliata la manda a chiedere alla coach una cosa che non serve.
  Il finto Prisma dei test è stato riscritto per distinguere le **tre** domande diverse che
  `subscription.findFirst` riceve: con un mock che diceva sì a tutte, la regola sarebbe sembrata
  funzionare qualunque cosa facesse il codice. 1504 test verdi.
  Nota lasciata in `monitoring.service.myStatus`: la stessa domanda vive anche lì e il risultato è già
  corretto, ma per un'altra strada (un mantenimento in corso è un abbonamento attivo, e quel controllo
  c'era). Non sono lo stesso codice perché `CommerceService` dipende già da `MonitoringService`: vanno
  tenute d'accordo a mano, ed è scritto in entrambi i file.

## 2026-08-10

- `[Sviluppo]` 📱 **OTA 2.1.5 pubblicata** — il manifest risponde `2.1.5` col bundle giusto, verificato
  dall'esterno. Porta alle clienti tre cose che erano in produzione e invisibili: **data e ora nei
  messaggi in chat** (separatore del giorno «Oggi»/«Ieri» e ora su ogni bolla), il pulsante **«Sposta la
  data di inizio»** nel profilo, e la **scelta abbonamento / mese singolo nel primo acquisto** — quel
  pulsante al Checkout esisteva già nella 2.1.4, mancava il dato che lo fa comparire.
  Verifiche sullo zip prima di pubblicare: `index.html` alla radice, le tre cose nuove presenti, **una
  sola** stringa di versione, e soprattutto le push intatte (`/me/push-tokens` e listener `registration`
  presenti, **assente** il ramo del build senza `google-services.json`, che avrebbe spento le notifiche a
  chiunque avesse ricevuto l'aggiornamento, in silenzio).

- `[Prodotto]` 🔒 **Il Monitoraggio si mostra solo a mantenimento scaduto e non rinnovato** — decisione di
  Simone, presa dopo che la verifica della sequenza dei piani ha fatto emergere lo scostamento: il codice
  chiede di *aver avuto* il mantenimento contando anche gli abbonamenti attivi, quindi il Monitoraggio
  compariva dal **primo giorno** di mantenimento e una cliente che pagava €49 vedeva già l'opzione da €19.
  La regola nuova: si mostra **dal giorno dopo** che il mantenimento è scaduto e non è stato rinnovato.
  Così il Monitoraggio resta una **scelta di rientro** e non un'alternativa più economica offerta mentre
  sta pagando. Specifica e casi al bordo (disdetta con fine nel futuro, rinnovo, più mantenimenti nella
  storia) scritti in `PUNTO_DELLA_SITUAZIONE.md` §2; **codice da scrivere**, ed è la prima cosa in coda.

- `[Sviluppo]` 🧭 **Un solo documento dice come siamo: `progetto/PUNTO_DELLA_SITUAZIONE.md`** — c'erano
  sei liste di cose aperte (`DA_FARE.md`, tre `DA_RIPRENDERE_*`, `STATO.md`, `STATO_LANCIO.md`) e si
  contraddicevano: `DA_RIPRENDERE_20260809` dice che una cliente sta ricevendo una dieta senza pranzi né
  cene, e quel piano è concluso dal 22 luglio — è la fonte da cui l'allarme falso è arrivato fino alla
  lista del 10/8. Sei liste sono zero liste: nessuno sa quale sia quella vera.
  Il nuovo documento tiene lo stato, gli aperti, chi si aspetta cosa, e — parte che sarebbe morta con
  `STATO.md` — **le regole che non si scoprono leggendo il codice**: l'isolamento dei menu per prodotto,
  la sequenza dei piani, il webhook Stripe fissato a un'API, il thread di Gaia che lo staff legge e non
  scrive, e i controlli già fatti da non rifare.
  **La sequenza dei piani** che Simone ha ridetto oggi (Apprendimento 8 giorni → Dimagrimento → a
  obiettivo raggiunto Mantenimento → dopo un mese Mantenimento o Monitoraggio) è ora scritta come
  invariante da verificare a ogni modifica del Negozio. Verificata nel codice: protetta in **due** punti
  — `listPlansForClient` nasconde, `assertPlanPurchasable` **rifiuta l'acquisto**, ed è chiamata da
  entrambe le strade d'acquisto (nascondere una voce non è una regola, l'acquisto è una POST con un
  `planId` dentro). Emerso uno scostamento da decidere: il Monitoraggio compare dal **primo giorno** di
  mantenimento e non alla sua fine, perché il codice chiede di *aver avuto* il mantenimento.
  Ogni voce controllabile è stata **riletta dal ramo pubblicato** (`origin/main`, `f905a61`) e non da una
  copia locale, con l'elenco di cosa è stato verificato e come in appendice: tredici voci risultano
  davvero aperte. I sei documenti vecchi restano come fotografie, con in testa un rimando qui, e
  `ISTRUZIONI_PER_AI.md` punta al nuovo come prima lettura di ogni sessione.

- `[Sviluppo]` 🛒 **Nel primo acquisto ricompare la scelta abbonamento / pagamento unico** —
  `PlanFlow`, la coda dell'onboarding, è **la strada da cui passa ogni nuova cliente**, e dichiarava il
  piano senza il campo `billing`: quindi non lo passava al carrello, e al Checkout la scelta fra
  abbonamento e mese singolo non compariva **mai**. Per il carrello quel piano era `one_time` qualunque
  cosa dicesse il Negozio. Le altre due strade — il Negozio e il pulsante del report di fine percorso —
  lo passavano da tempo: restava fuori la principale.
  La regola sta ora in `lib/pianoCarrello.ts`, fuori dal componente, e la parte delicata è il valore di
  partenza: su un piano `both` si parte da **un mese solo**. In quella schermata non esiste nessun posto
  in cui la cliente abbia scelto fra le due forme — quello è il Negozio — e mettere in carrello un
  addebito ricorrente per un'opzione che nessuno le ha mostrato è il modo più rapido di trovarsi una
  richiesta di rimborso e di meritarsela. Su `recurring` invece `abbonamento` è vero perché non c'è
  niente da scegliere, e un `billing` assente o sconosciuto vale `one_time`: davanti a un dato che non
  capiamo si sceglie la forma che non le addebita niente a sua insaputa.
  Fuori dal componente per una ragione sola: così si verifica. Dentro `goCheckout` era una riga in mezzo
  a una navigazione, cioè esattamente il tipo di riga in cui questo difetto è vissuto per mesi.
  **Serve un'OTA** perché arrivi alle clienti.
  Nota: l'app **ha** vitest (ora 27 test, 4 file) — un'altra cosa che avevo scritto sbagliata in
  `DA_FARE.md`. Il problema non è il runner: è che la logica sta dentro i componenti.

- `[Sviluppo]` 📈 **Il funnel adesso vede i rinnovi automatici** — `plan_renewed` esisteva solo sul
  percorso manuale/bonifico, dove per capire se un pagamento è un rinnovo bisogna andare a cercare se
  prima c'era un abbonamento pagato. Dentro `invoice.paid` quella domanda non si pone: con
  `billing_reason` diverso da `subscription_create` quel pagamento **è** un rinnovo per definizione — e
  non emettendolo, sui piani ricorrenti (cioè la strategia) la dashboard marketing mostrava **zero
  rinnovi**: un prodotto in cui nessuno rinnova mai.
  L'evento si scrive **dopo** la creazione del pagamento, così è protetto dalla stessa idempotenza e due
  webhook della stessa fattura non producono due rinnovi nei grafici. L'importo sta nel payload e non
  nella condizione: un rinnovo scontato a zero resta un rinnovo del rapporto, e chi legge i numeri lo
  filtra sapendo che c'è. Se il tracciamento fallisce l'incasso prosegue — i soldi valgono più del
  grafico, ed è coperto da un test.

- `[Sviluppo]` 💳 **Un pagamento per fattura di rinnovo, garantito dal database** — l'idempotenza era
  `findFirst` sul `pspRef` e poi `create`. Fra le due righe non c'è niente che tenga: Stripe ritenta i
  webhook e non li manda in fila indiana, quindi due copie della stessa fattura passavano **entrambe**
  il controllo e scrivevano due pagamenti — e con due pagamenti nascono **due provvigioni**, che si
  scoprono solo quando qualcuno confronta i compensi con gli incassi. Nessun vincolo lo impediva:
  `stripe_subscription_id` è unico, `psp_ref` no.
  Ora la garanzia è dove può stare — nel database: indice unico `payment_psp_ref_renewal_key`. È
  **parziale** (`WHERE billing_reason = 'renewal'`) e non su tutta la colonna, perché in `psp_ref`
  finiscono anche l'id della sessione di checkout e il `payment_intent`: riferimenti di natura diversa,
  scritti in momenti diversi, e un vincolo su tutto avrebbe messo una regola che non appartiene a quei
  casi — col primo effetto di rompere il checkout per proteggere i rinnovi. L'invariante vera è
  ristretta: una fattura di rinnovo = un pagamento.
  Il codice si appoggia al **rifiuto** del vincolo: chi arriva secondo si prende `P2002` e quel rifiuto
  *è* la risposta «c'era già», non un errore. Il `findFirst` resta come strada veloce per il caso
  normale (webhook ripetuto) e non come garanzia. Un errore diverso risale invece di essere scambiato
  per un duplicato — inghiottirlo lascerebbe un rinnovo pagato senza pagamento e senza traccia.
  Migrazione riprovata su PostgreSQL 16 con la prova dell'invariante: la seconda fattura identica viene
  rifiutata, due riferimenti di checkout uguali passano.

- `[Sviluppo]` ✅ **Correzione a una mia diagnosi del 10/8: le provvigioni di rinnovo ERANO nel
  codice** — avevo scritto in `DA_FARE.md` che la decisione del 6/8 non era implementata perché
  `billingReason` è selezionato e mai usato. Falso, e l'ho scoperto andando a scriverla:
  `generateCommissions` calcola sempre la catena su `profile.assignedCoachId`, cioè sulla coach
  **attuale**, quindi «al rinnovo paga chi segue la cliente adesso» è vero per costruzione e nessuna
  condizione in più serviva. Resta un'ambiguità vera, ed è di prodotto: lo schema dice «solo se la coach
  è ancora quella assegnata» (che suona come «altrimenti non paga nessuno») e il servizio dice «paga chi
  c'è adesso». Il codice fa la seconda. La domanda è in `DA_FARE.md` §2.2, perché riguarda i soldi e la
  decide Simone.

- `[Sviluppo]` 🔌 **Il credito AI esaurito ora si capisce, e non fa sparare 270 chiamate a vuoto** —
  «ho cliccato ma non ha generato nulla», sulla settimana 10 della senza glutine. Il messaggio c'era,
  ma in cima alla pagina: era il credito Anthropic finito a metà generazione (per questo si era fermata
  alla 9, e non per il numero a due cifre come sembrava ieri). Tre difetti separati, uno dentro l'altro.
  **Cosa leggeva chi ha premuto:** `l'AI ha risposto 400 — {"type":"error","error":{"type":
  "invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please
  go to Plans & Billing to u` — JSON, in inglese, troncato a metà parola. Chi lo legge non ha modo di
  capire che deve ricaricare un credito: quel testo non è scritto per lui. Ora `ai/errori-ai.ts`
  risponde a due domande separate — **cosa dire** in italiano con la strada per uscirne, e **se ha senso
  riprovare** — e il caso vero è congelato nei test. Il credito si riconosce dal **corpo** e non dallo
  stato, perché Anthropic risponde 400 e non 402.
  **Le chiamate a vuoto:** la funzione che genera un pasto riprova tre volte, il giro passa cinque
  pasti, il backoffice passa diciotto varianti — col credito finito sono 270 chiamate destinate tutte
  allo stesso rifiuto, e una barra che avanza per minuti facendo credere che stia succedendo qualcosa.
  Ora sugli errori definitivi (credito, chiave, modello) il ciclo si interrompe, il servizio risponde
  **503** invece di 400, e il backoffice si ferma alla prima variante dicendo che le altre non le ha
  provate.
  **E l'esito si vede dove si è premuto:** i riquadri di `notice`/`error` stanno a inizio pagina, il
  pulsante Genera trecento righe più sotto. Ora l'esito compare anche **sotto il pulsante** — e quando
  niente è stato toccato lo dice in chiaro («nessuna variante è stata toccata: la settimana c'era già su
  tutte e diciotto»), perché «fatta su 0 variante/i» si legge come un successo e non lo è.


- `[Sviluppo]` 📏 **Senza una misura DI QUESTO PIANO il menu non parte — e adesso la chiediamo** — una
  cliente: «non mi sono state richieste le misure, ma i menu li ho ricevuti». Aveva ragione su tutt'e
  due i pezzi, ed erano due difetti diversi.
  Il gate contava `measurement.count({ clientId })`: **nessun filtro sulla data e nessun legame col
  piano**. Lei aveva pesate dal 20 luglio e il piano è partito il 6 agosto, quindi alla partenza il
  controllo risultava già soddisfatto da misure di un'altra stagione della sua storia — niente popup,
  niente blocco, menu dal primo giorno. La regola ora è quella data da Simone: «ci serve **sempre** una
  misura per erogare il menu, anche a costo di registrare due misure consecutive». La finestra entro cui
  una pesata vale non è un parametro nuovo da indovinare: è `menu_visible_days_before_start`, cioè da
  quando il piano comincia a esistere per la cliente. Verso il futuro non c'è limite — chi si pesa al
  terzo giorno ha comunque una partenza.
  Secondo difetto, il più antipatico: **nessuno chiedeva niente**. Il gate sapeva solo bloccare, il
  popup lo vede chi apre l'app, e l'unica notifica che diceva «inserisci le misure» viveva dentro
  `unlockMeasures` — partiva **soltanto dopo** che una coach aveva sbloccato una cliente già murata
  fuori. La richiesta esisteva come punizione, non come richiesta. Ora, finché il menu è trattenuto,
  parte notifica in app **e** push (`measures_required`), ripetuta a distanza di
  `measures_ask_repeat_days` (2 giorni) perché una push sola si perde e una al giorno diventa rumore. Si
  spegne da sé: appena la misura arriva non c'è più niente da chiedere.

- `[Sviluppo]` 🔢 **Generatore: la settimana 10 si bloccava perché il conto lo fa la famiglia e il
  controllo la variante** — «ha generato Mediterranea senza glutine fino alla 9, la 10 no». Non era il
  numero a due cifre: la striscia delle settimane, con la spunta «genera tutte le varianti», conta le
  settimane della **famiglia** (il giorno più alto fra tutte le varianti), mentre il servizio le contava
  sulla **singola variante**. Le due cose divergono appena una variante resta indietro — una settimana
  fallita, o un giro interrotto a metà famiglia — e da quel momento la famiglia dice «la prossima è la
  10» e quella variante dice «la mia è la 9». Il servizio rispondeva con un'eccezione e, non avendo il
  giro un `try` per variante, **quell'eccezione fermava anche tutte le varianti dopo**: diciassette sane
  bloccate da una, senza che dal messaggio si capisse quale.
  Due correzioni. Il servizio, invece di rifiutare, genera `settimaneFatte + 1`: **non crea nessun buco**
  — è esattamente l'invariante che il controllo difendeva — e fa quello che uno intende chiedendo
  «portale alla 10». La risposta porta sia `week` (fatta) sia `settimanaChiesta`, quindi il backoffice
  lo dice: «erano rimaste indietro e hanno recuperato un passo, ripremi Genera». E ogni variante ora
  risponde per sé: quelle che falliscono si annotano («❌ Non riuscite: …»), le altre si generano.

- `[Sviluppo]` 💶 **Il prezzo si legge dal Negozio, non si scrive nel codice** — «dobbiamo prendere il
  prezzo da quello impostato nel negozio, che se lo cambiamo non impazziamo». La notifica di fine
  monitoraggio diceva «mantenimento a **€29/mese**»: il Mantenimento costa **€49**, e il numero era
  scritto a mano da quando il piano costava 29. Un prezzo sbagliato mandato da noi a una cliente vera, e
  l'unico modo di accorgersene era leggere quella riga di codice per caso.
  Ora `commerce/prezzo-piano.ts` legge la riga `Plan` attiva — la stessa che la cliente vede nel Negozio
  e su cui pagherà. Se il piano non si trova torna **`null` e la frase esce senza cifra** («tenere il
  peso col mantenimento»): un valore di riserva nel codice sarebbe lo stesso difetto con un'aria più
  rispettabile, e meglio una parola in meno che una promessa da spiegare. Ripuliti anche i commenti che
  ripetevano «€29» in `plan-report.service.ts` e in `app/pages/Report.tsx` — l'app il prezzo lo prendeva
  già dal piano.

- `[Sviluppo]` 🚨 **Le diagnostiche dicono se il piano è ANCORA attivo** — due falsi allarmi in fila,
  entrambi miei. `diag:menu-incompleti` ha stampato «Rosaria Gruppuso resta senza pranzo e cena» e l'ho
  messa in cima alle urgenze: il suo piano era **scaduto il 22/07**, nessun menu in arrivo, nessun
  danno. Lo script guardava l'ultimo menu *erogato*, che di per sé non dice niente sul presente. Subito
  dopo Simone: «non è che anche questi hanno il piano concluso?» — domanda giusta, e la risposta non
  stava in nessuno script.
  Il difetto è di categoria: **una diagnostica che nomina una cliente senza dire se il suo piano è
  attivo produce allarmi che sembrano urgenti e non lo sono**, e il costo non è il tempo perso ma che
  dopo due o tre non si crede più alla lista. `common/piano-attivo.ts` risponde per un gruppo di clienti
  in una query sola, con quattro stati (attivo · scaduto ma ancora «active», da chiudere · concluso il
  gg/mm · mai avuto un piano). `diag:menu-incompleti` ha una colonna **«di cui attive»**, mette il
  campanello ⚠️ solo se qualcuno la sta ricevendo davvero, e per le altre scrive «nessuna cliente
  attiva: non sta danneggiando nessuno adesso — da sistemare prima che qualcuno la scelga».

- `[Sviluppo]` 🔎 **Copertura catalogo: si guarda DENTRO una settimana, non «quante ne ho»** — «non
  voglio vedere quante settimane ho, voglio filtrare la settimana 1 poi la 2 ecc.». Il filtro messo
  poco prima rispondeva a un'altra domanda: diceva quali varianti hanno 2 settimane, cioè chi è
  rimasto indietro, e non com'è fatta la settimana 3. Sono due domande diverse e serviva la seconda,
  perché il sospetto da verificare è che il generatore ammucchi i piatti nella prima settimana invece
  di distribuirli.
  Ora in cima alla pagina c'è un selettore «Guarda dentro una settimana»: scegliendo la 3, i conteggi
  li rifà il database sulle **sole giornate 15-21** (`day_index BETWEEN`, sia sul conteggio delle
  giornate sia su quello dei pasti — filtrarne uno solo darebbe una riga che parla di due finestre
  diverse). Cambia anche il metro: l'atteso per pasto non è più 7 × le settimane presenti ma **7**,
  altrimenti una variante da 12 settimane mostrerebbe `7/84` su ogni pasto e si leggerebbe «tutto
  magro» dove invece è tutto giusto. «Vuota» dentro il filtro vuol dire «quella settimana non esiste»,
  e lo dice fin dove arriva la variante («arriva alla 4»): è l'informazione che serve per capire se il
  buco è un buco o è la fine del catalogo. Dove le giornate di quella settimana sono meno di sette, la
  colonna lo scrive («4/7 gg»).
  Il selettore sta **sopra** la tabella e non nella riga dei filtri, con un avviso quando è attivo:
  gli altri filtri scelgono quali righe vedere, questo cambia il significato di ogni numero, e un
  numero che vuol dire una cosa diversa senza dirlo è il difetto peggiore di una tabella diagnostica.
  La colonna «Settimane» resta e continua a mostrare il totale della variante.

- `[Sviluppo]` 0️⃣ **Acquisti: gli importi a 0 € nascosti di default, con un flag per riaccenderli** —
  gli acquisti a zero sono le **attivazioni**: prova gratuita e piani messi a mano dalla scheda
  cliente, che per decisione di Simone entrano in Acquisti ma non in contabilità. Sono righe vere e
  servono, ma in mezzo agli incassi sono rumore. Ora sono nascoste all'apertura, con una spunta in
  fondo alla barra dei filtri («Mostra anche i 0 €») che dice **quante** ne sta nascondendo: senza quel
  numero si spegne un filtro senza sapere cosa stava togliendo. La scelta si ricorda sul dispositivo, e
  «Azzera filtri» riporta alla vista di default.
  Il contatore ora scrive **«32 acquisti di 120»** invece di «32 di 120» — il nome in mezzo, e il
  totale è quello della tabella intera, così si vede sempre quanto stanno togliendo flag e filtri. Vale
  per tutte le tabelle, perché il contatore è condiviso.

- `[Sviluppo]` 🏷️ **Il tag `sett:N` ora dice DOVE la ricetta è usata** — «quel tag per me è dove viene
  utilizzato, non mi interessa quando è stato creato». Era il difetto, e ha fatto perdere tempo a
  Simone su una diagnosi sbagliata: il tag lo scriveva il generatore **alla nascita** della ricetta,
  quindi registrava in quale generazione era stata prodotta. Un piatto creato generando la settimana 1
  e poi usato nella settimana 2 continuava a portare `sett:1` — e guardando il catalogo si leggeva
  «le mette tutte nella prima settimana» su una dieta distribuita su due. Un'etichetta che dice una
  cosa diversa da quella che sembra dire è peggio di un'etichetta assente: ci si costruiscono sopra
  dei ragionamenti, ed è successo.
  Ora la settimana si legge da dove è decisa: la **giornata** che usa la ricetta (`dayIndex` 1-7 =
  settimana 1, 8-14 = settimana 2). Il generatore non scrive più `sett:` alla nascita e allinea i tag
  in fondo, dopo aver scritto le giornate (`menu/tag-settimane.ts`). Una ricetta usata in più
  settimane porta più tag (`sett:1`, `sett:3`) — non è un caso da nascondere, è il modo più rapido di
  vedere se il ciclo si ripete invece di allungarsi. Una ricetta che nessuna giornata usa **perde** il
  tag: dire «settimana 1» su un piatto che nessuno serve è l'informazione falsa da cui è nato tutto.
  Le varianti sorelle condividono le ricette, quindi il tag porta l'**unione** delle settimane: un
  conteggio per una dieta sola darebbe un'etichetta che cambia a seconda di chi la guarda.
  Per i dati esistenti: `npm run fix:tag-settimane` (senza `CONFERMA=1` mostra cosa cambierebbe, riga
  per riga, e non scrive).
- `[Sviluppo]` 📅 **Filtro e colonna «Settimana» nel catalogo ricette** — chiesto per verificare
  l'anomalia. Compare solo dentro una dieta, perché fuori la domanda non ha senso: la stessa ricetta
  serve più famiglie in settimane diverse. Si legge dalle giornate e non dal tag, quindi dice la verità
  anche prima di aver girato la correzione. C'è anche la voce «fuori dal ciclo»: le ricette generate
  che nessuna giornata usa, cioè lavoro pagato che non arriva a nessuna cliente.
- `[Sviluppo]` 🔍 **Verifica: la rete si risale fino in cima, in tutte le funzioni** — «visto il
  problema avuto nella chat, verifica in tutte le funzioni che la rete venga risalita fino in cima e
  non solo due livelli». Fatta. Quindici moduli (clienti, acquisti, dashboard, pipeline, avvisi,
  report, compiti coach, CRM, analytics…) leggono la portata da un posto solo — `coachTeamScope`,
  attraverso `perimetroClienti` — e quello adesso risale tutta la rete: la correzione di prima li
  copre tutti. Sul lato nutrizioniste il capo non ha perimetro (vede tutto) e la nutrizionista vede le
  sue, che è la regola voluta.
  Un solo posto climba la rete per conto suo e **resta com'è**: la catena delle provvigioni in
  `finance.service`, che sale di livello in livello (fino a quattro anelli, cicli esclusi) perché lì
  ogni superiore incassa la differenza — è una regola di pagamento, non di visibilità, e allargarla
  cambierebbe i soldi. Tre test nuovi tengono ferma la regola sulla portata: se qualcuno riporta lì una
  query a un livello, diventano rossi.

- `[Sviluppo]` 🕸️ **I permessi di lettura risalgono la rete** — «perché la responsabile delle coach non
  vede le chat? I permessi di lettura devono risalire la rete, quindi coach, coordinatrice,
  responsabile», e poi «anche in chat va risalita la rete come autorizzazioni di lettura».
  Due difetti sovrapposti. In scheda cliente il controllo pretendeva che l'attore fosse **la coach
  assegnata** — cosa che una coordinatrice non è mai — quindi su ogni cliente della sua rete leggeva
  «il tuo ruolo non può leggere le conversazioni di questa cliente»: il ruolo era nell'elenco, la
  condizione era quella sbagliata. E più a monte, `coachTeamScope` scendeva di **un solo livello**
  (`managerId = lei`), mentre la rete è a tre: quindi la responsabile vedeva le sue coordinatrici e non
  le clienti delle coach sotto di loro — era cieca esattamente sulle persone che il suo ruolo esiste
  per seguire.
  Ora la rete si percorre tutta (`common/rete-staff.ts`), per quanti livelli ha e su **entrambi** gli
  archi del dominio: `managerId` (catena delle coach) e `headNutritionistId` (catena delle
  nutrizioniste). Chi sta sopra copre chi sta sotto, a qualunque distanza — e questo vale per la
  visibilità delle clienti in tutte le pagine, non solo per le chat.
  **Solo in lettura**, che è la parola che Simone ha usato due volte: scrivere resta di chi segue la
  cliente, perché una coordinatrice che scrive nel thread «Coach» farebbe comparire alla cliente un
  messaggio che sembra della sua coach — e per parlare al posto di qualcun altro c'è l'impersonazione,
  dichiarata e tracciata. Risalire non vuol dire vedere tutto: una cliente fuori dalla propria rete
  resta chiusa.
  Si scende a **strati** (una query per livello, non una per persona) e i cicli nei dati non mandano in
  loop: nessun vincolo del database impedisce che A risponda a B e B ad A, e senza protezione la
  funzione girerebbe per sempre. 20 test nuovi, ciclo e tetto di profondità compresi.
- `[Sviluppo]` 🔔 **Una cliente scrive alla coach: notifica in dashboard e push** — «se una cliente
  scrive in chat alla coach mandiamo la notifica nella dashboard e via push». Il push c'era già: era la
  **notifica a non nascere**. Il dedup era «una al giorno per tipo», e il tipo è uno solo per tutte le
  clienti: quindi la prima che scriveva generava la notifica e tutte le altre, quel giorno, no. Per una
  coach con quaranta clienti è una notifica su quaranta — la chat sembrava silenziosa mentre si
  riempiva.
  Ora il dedup guarda anche **quale cliente** (`dedupeSuPayload`), quindi è per cliente e non per tipo,
  con la stessa anti-raffica di tre minuti della direzione opposta: tre messaggi di fila restano una
  notifica, tre clienti diverse sono tre notifiche. E il **nome è nel titolo** («Giulia ti ha
  scritto»): senza, la coach deve aprire la scheda per sapere chi. Il testo non riporta il messaggio,
  perché nell'anteprima di un push non ci va niente che possa essere sanitario.
- `[Sviluppo]` 🔑 **«Copertura catalogo» ha il suo permesso** — chiesto da Simone: era agganciata alla
  chiave di «Creazione e validazione». Adesso è `catalog_coverage`, una riga a sé in pagina Permessi:
  quella pagina **genera** il catalogo, questa dice soltanto dove siamo, e guardare lo stato serve
  anche a chi non deve generare niente.

- `[Sviluppo]` 🕐 **Data e ora dei messaggi in chat (app)** — «in app non c'è data e ora delle chat».
  Il dato (`sentAt`) arrivava dal server da sempre e non si vedeva da nessuna parte: una conversazione
  lunga era un muro di bolle senza tempo, e non si capiva se una risposta della coach fosse di dieci
  minuti o di tre giorni prima. Su una chat dove si aspetta la nutrizionista quella è l'informazione
  più importante dopo il testo.
  Il **giorno** compare una volta sola, come riga in mezzo alla conversazione, e cambia solo quando
  cambia: scriverlo su ogni messaggio raddoppierebbe il rumore senza aggiungere niente, perché dentro
  la stessa giornata è sempre lo stesso. L'**ora** sta su ogni bolla, perché quella cambia sempre. E
  si chiamano «Oggi» e «Ieri», che sono le parole che una persona usa: leggere «11 agosto» per
  intendere oggi costringe a fare un calcolo.
  Vale su entrambe le chat dell'app (Assistente e il pannello della coach), da un posto solo
  (`lib/oraChat.ts`). 10 test, mezzanotte compresa — «00:05 di oggi» non deve diventare «ieri» solo
  perché sono passate poche ore. ⚠️ Serve una **pubblicazione OTA** perché le clienti lo vedano.

- `[Sviluppo]` 📐 **Tutte le tabelle impaginate come quella dei Permessi** — «devono scorrere
  liberamente nella finestra e risultare sempre perfettamente leggibili». Il difetto si vedeva in
  Ricette: l'ultima colonna, i pulsanti «Modifica», finiva **fuori dal bordo** della card, sopra il
  fondo della pagina. Non era la colonna sbagliata — era la card che non scorreva in orizzontale e
  quindi non aveva dove metterla.
  Sistemato in un posto solo, con `:has(> table.grid)` nel CSS: ogni card che contiene una tabella ora
  scorre in entrambe le direzioni con un'altezza massima che lascia in vista i filtri sopra e il
  paginatore sotto. Vale per tutte e trentaquattro le pagine senza toccarne nessuna, e per quelle che
  verranno. La larghezza minima è l'altra metà di «leggibile»: senza, su una finestra stretta le
  colonne si schiacciano e i nomi vanno a capo tre volte — con lei la tabella preferisce **scorrere**
  invece di comprimersi. Le tabelle dentro i modali e dentro le schede sono escluse da entrambe le
  regole: forzare 900px in una finestra larga 760 vorrebbe dire una barra di scorrimento su una
  tabella di tre colonne.
  In più, l'intestazione incollata in alto (titoli **e** riga dei filtri) è passata da 4 pagine a
  **tutte**: 22 pagine con una riga a testa, perché la misurazione dello scostamento la fa già
  l'helper.
- `[Sviluppo]` 🟢🟡 **Copertura catalogo: il colore dice se è validato** — «se i pranzi e le cene me li
  metti gialli da validare, verdi da validati, così abbiamo anche questo dato». Ogni cella porta due
  informazioni tenute separate: il **colore** è lo stato della validazione (verde = i piatti sono
  attivi e il motore li usa · giallo = ci sono ma sono in bozza, quindi da fuori la settimana sembra
  vuota · rosso = riferimenti morti o nessun piatto), il **numero** è la quantità, scritto come
  frazione (`60/84`) quando i piatti non bastano per le settimane presenti. Ogni colore ha anche un
  simbolo (✓ ⏳ ✕): un'informazione affidata al solo colore si perde per chi non lo distingue, e in uno
  screenshot su WhatsApp si perde per tutti.
- `[Sviluppo]` 👻 **`compatta:menu` contava i piatti fantasma** — trovato preparando la risposta a «e se
  facciamo girare il comando che porta a riempimento le settimane?». Il comando leggeva i piatti dalle
  giornate e **si fidava**: un `recipeId` di una ricetta cancellata nel frattempo veniva contato come
  piatto buono e rimesso in fila. Quindi il comando che deve mettere in ordine il catalogo era cieco
  esattamente sul difetto peggiore che il catalogo può avere, e dichiarava «settimana piena» una
  settimana con un buco dentro. Ora verifica che ogni ricetta esista, li conta in una colonna a parte
  («rotti esclusi») e li lascia fuori — quindi compattare **ripulisce** quei buchi, perché le giornate
  si riscrivono solo coi piatti veri. Nuova colonna «in bozza»: quanti dei piatti veri il motore non
  usa ancora, che non è un problema di compattazione ma di validazione.

- `[Sviluppo]` 🔍 **Pagina «Copertura catalogo»: dove siamo, a colpo d'occhio** — «crea una tabella con
  tutti i tipi, con le colonne n pranzi, n cene, n merende, n spuntini», nata dalla segnalazione «dice
  settimana creata e validata, poi ci torno sopra ed è vuota». Prima di correggere serviva
  **distinguere le ipotesi**, perché sono tre difetti diversi con tre correzioni opposte: mai generata,
  generata e non validata, oppure generata e con i piatti cancellati sotto.
  Una riga per variante (dieta × regime × obiettivo × struttura pasti) e per ogni pasto **due numeri**:
  i piatti diversi che le giornate nominano, e fra parentesi quanti sono **attivi**, cioè quanti il
  motore usa davvero. `84 (84)` a posto; `84 (0)` = generata e non validata, e da fuori sembra vuota;
  `84 (60)` = validata a metà. Più una terza colonna che prima non si poteva vedere da nessuna parte:
  i **riferimenti rotti**, cioè giornate che nominano ricette che non esistono più. I pasti stanno in un
  campo JSON, quindi nessun vincolo del database impedisce di cancellare una ricetta ancora nominata:
  quando capita la giornata resta in piedi e il pasto è un buco — ed è il candidato numero uno per «era
  vuota».
  I conteggi li fa Postgres (`jsonb_array_elements` + `COUNT(DISTINCT)`), non il codice: leggere tutte
  le giornate di tutte le varianti per contarle in memoria sarebbe lo stesso errore per cui il funnel
  sottostimava. Il join sulle ricette è **LEFT** di proposito: con un join interno i riferimenti rotti
  spariscono dal conteggio invece di comparire, e la tabella direbbe «tutto a posto» esattamente nel
  caso che stiamo cercando.
  Filtri e ordinamento su tutte le colonne, riassunto in testa (complete · magre · da validare · con
  riferimenti rotti · vuote). Le varianti a digiuno intermittente non hanno la colazione e la tabella lo
  sa: un «—» invece di uno zero, altrimenti risulterebbero tutte incomplete. 13 test nuovi, query
  provata su PostgreSQL 16 con dati finti che includono una ricetta cancellata.

- `[Sviluppo]` 🎂 **Gli auguri di compleanno che a qualcuno non arrivavano MAI** — il più antipatico
  dei troncamenti trovati, perché invisibile per costruzione. La query prendeva **500 clienti a caso**
  (`take: 500`, senza nemmeno un `orderBy`) e *poi* guardava in JavaScript chi fosse nato oggi. Con più
  di 500 clienti con la data di nascita in archivio, chi restava fuori da quei 500 non riceveva gli
  auguri mai: non «un anno sì e uno no», mai — e sempre le stesse persone. Nessun errore, nessun log,
  niente di rotto: il codice fa quello che dice, manda gli auguri a tutti quelli che ha guardato. E
  nessuno si accorge di un'email che non arriva, mentre chi la riceve non sa che ad altri non è
  arrivata.
  Ora il giorno lo filtra il **database** (`EXTRACT(MONTH/DAY FROM birth_date)`), quindi il limite di
  500 si applica a chi compie gli anni davvero e non a un campione casuale di clienti. E se una volta
  scattasse, lo **scrive nei log**: reintrodurre un troncamento muto proprio qui sarebbe ridicolo.
  In più, chi è nato il **29 febbraio** con la regola letterale riceveva gli auguri una volta ogni
  quattro anni: negli anni non bisestili ora arrivano il 1° marzo, come fanno i registri civili. La
  regola dell'anno bisestile è quella completa, secoli compresi. 11 test nuovi, e le due query provate
  su PostgreSQL 16 vero con dati finti.
- `[Sviluppo]` 📉 **Il funnel del lancio sottostimava senza dirlo** — i conteggi si facevano **in
  memoria** su `take: 50_000` eventi. Gli eventi del funnel sono uno per ogni prova attivata, misura
  inserita, offerta mandata, rinnovo: cinquantamila si raggiungono, e da quel momento il pannello
  comincia a dire numeri più piccoli del vero. Un pannello che dice «1.200 prove» quando sono 3.000 è
  peggio di un pannello che non c'è, perché su quello si prendono decisioni. E si rompeva dalla parte
  peggiore: senza `orderBy` non era garantito **quali** 50.000 righe arrivassero, quindi gli stessi
  numeri potevano cambiare fra due aperture della stessa pagina.
  Ora conta il database: tre `GROUP BY` con `COUNT(DISTINCT)`, nessun limite, niente in memoria, numeri
  esatti per costruzione. Corretto anche un difetto più piccolo che stava lì dentro: gli eventi senza
  utente (pre-login) venivano contati tutti come **una** persona, quindi un anello con trecento
  anonimi ne mostrava uno. 4 test nuovi, query provate su PostgreSQL vero.

- `[Sviluppo]` 📊 **Banca dati nutrizionale: Gaia non ricorda più, cita** — la risposta alla decisione
  di Simone sul caso basmati: «può affermarlo ma deve prima verificare sulle banche dati e dare dati
  corretti; magari poi li memorizza e arricchisce il suo sapere».
  Ora esiste `nutrient_fact`: ~60 alimenti con indice glicemico e valori per 100 g, **la fonte su ogni
  riga** (CREA per i valori, International Tables / Università di Sydney / Linus Pauling per gli IG) e
  tre cose che una tabella nutrizionale normale non ha:
  · il **range** e l'**affidabilità**, perché l'IG delle patate va da 73 a 111 secondo la fonte e
    quello dell'anguria da 50 a 76: con affidabilità «debole» Gaia dice il range e **non** il numero,
    perché «l'anguria ha IG 72» è una precisione che i dati non hanno — ed è la stessa falsa sicurezza
    dell'errore di partenza;
  · lo **stato** (crudo/bollito/secco): il CREA dà le lenticchie secche a 319 kcal e bollite a 109,
    confonderli sbaglia le calorie di un fattore tre;
  · **chi ha confermato** il valore. Gaia lo usa subito (aspettare l'approvazione vorrebbe dire che
    nei primi tempi ogni domanda finisce comunque alla nutrizionista, cioè il problema di oggi), ma
    finché nessuno l'ha guardato resta nella coda «da confermare». E una riga confermata **nessun
    deploy la sovrascrive**: il seed la salta, come per i parametri.
  **Il controllo che rende tutto questo verificabile:** i valori vanno davanti al modello, e la
  guardia in uscita si capovolge — non più «hai detto un numero?» ma «hai detto un numero che non ti ho
  dato?». Se nella risposta compare una cifra che non è nella scheda, la risposta non parte. È l'unica
  differenza tecnica fra un modello che cita e un modello che ricorda. Restano vietati anche coi dati
  davanti gli effetti fisiologici («sazia meno»: la sazietà non è in tabella) e i giudizi su cosa può
  sostituire cosa, che li decidono i gruppi di equivalenza.
  **Gli alimenti che non abbiamo** non si stimano e non si prendono «da uno simile»: la domanda va alla
  nutrizionista e il termine finisce in `nutrient_lookup_miss` col conteggio delle volte. È la parte
  «arricchisce il suo sapere» fatta senza inventare niente: «tempeh chiesto 40 volte» è la prossima
  riga da scrivere, e non serve indovinarlo.
  Un difetto trovato collegando i pezzi: il filtro in entrata mandava alla nutrizionista **tutto**
  quello che conteneva «glicemi», quindi «il basmati ha un indice glicemico più basso dell'integrale?»
  usciva dalla chat senza risposta — proprio la domanda per cui la tabella esiste. Ora «indice
  glicemico» (proprietà di un alimento) e «glicemia» (valore clinico di una persona) sono due cose
  diverse; se una frase contiene entrambe, vince la persona.
  Nuova pagina **Valori nutrizionali** (permesso `nutrient_facts`): elenco filtrabile, coda «da
  confermare», correzione in linea di IG, range, affidabilità e macro, e l'elenco degli alimenti
  chiesti dalle clienti e mancanti. Correggere **è** confermare: se una nutrizionista mette le mani su
  un numero, quel numero è suo. Le coach la vedono in sola lettura, per sapere su che dato Gaia ha
  risposto a una loro cliente.
  Migrazione validata su PostgreSQL 16. 50 test nuovi, fra cui la domanda del basmati rifatta per
  intero: stessa frase del 1° agosto, risposta corretta col range e con la fonte.

- `[Sviluppo]` 🤫 **Le segnalazioni risolte non si riaprono da sole** — due segnalazioni di Simone
  nello stesso giorno, che erano lo stesso difetto: «se il nutrizionista mette risolta perché
  continui a riaprirle? Se ha risolto basta fino a nuova segnalazione» e «il calo peso se è troppo
  rapido e il nutrizionista dice ok, resta ok, non devi continuare a tediarlo».
  Il motivo: chi apriva una segnalazione controllava **una cosa sola** — «ce n'è già una *aperta*?».
  Giusto, e insufficiente, perché guarda solo il presente: appena la nutrizionista metteva «risolta»
  quel controllo tornava a dire «nessuna», e la condizione clinica nel frattempo non era cambiata —
  una cliente che perde 2,8 kg/settimana continua a perderli anche dopo che qualcuno ha detto «lo so,
  la sto seguendo». Quindi la stessa segnalazione tornava al primo peso del giorno dopo, ogni giorno.
  Il danno non è il fastidio: è che **le segnalazioni smettono di voler dire qualcosa**, e chi le
  riceve impara a chiuderle senza leggerle. Comprese quelle nuove.
  La regola ora sta in un posto solo (`escalations/riapertura.ts`) e vale per tutti i punti che
  aprono segnalazioni: dentro la tregua di `escalation_reopen_days` (14 giorni, da Parametri) una
  segnalazione risolta non si riapre; passata la tregua, se la condizione è ancora lì torna — dopo
  tre settimane non è insistenza, è un problema che non si è risolto.
  **E l'eccezione che rende la regola sicura invece che solo silenziosa:** si riapre comunque se la
  cosa è **peggiorata** oltre `rapid_loss_reopen_worsening_kg` (0,5 kg/settimana). Un calo di 1,8 su
  cui la nutrizionista ha detto «ok» che diventa 3,5 non è la stessa segnalazione che torna: è un
  fatto nuovo, ed è il caso in cui tacere farebbe danno. Le segnalazioni che non hanno un «quanto»
  (piano bloccato, umore, aderenza) usano solo la tregua: inventare un peggioramento dove non è
  definibile sarebbe peggio.
  Due colonne nuove: `resolved_at` (e non `updated_at`, che si muove a ogni modifica — riassegnare
  una segnalazione avrebbe fatto ripartire la tregua da zero) e `severity`, il numero della gravità,
  che prima esisteva solo dentro la frase del motivo e da lì si poteva soltanto estrarre con una
  regex. Migrazione con backfill delle chiusure già fatte: senza, la prima notte dopo il rilascio si
  sarebbero riaperte tutte in blocco — esattamente il difetto che stiamo togliendo. Validata su
  PostgreSQL 16.
  18 test nuovi. Uno era rosso pur essendo giusto il codice: il finto config della suite dei segnali
  risponde `?? 0` alle chiavi che non conosce, quindi la tregua valeva **zero giorni**. È la seconda
  volta che quello zero inganna un test in quel file — ora le chiavi nuove sono dichiarate lì dentro
  con un commento che lo dice.

- `[Sviluppo]` ✏️ **`rinomina:prodotto` — il nome nuovo anche nello storico** — «correggiamo anche le
  vecchie». Rinominare il piano in Gestione negozio aggiorna tutto quello che lo legge via relazione
  (abbonamenti, scheda cliente, Acquisti, pipeline) ma **non** le copie: la descrizione dei pagamenti
  («Abbonamento Prova Gratuita») è testo congelato al momento dell'acquisto, e deve esserlo — una
  ricevuta non cambia da sola sotto gli occhi di chi l'ha ricevuta. Il risultato però è che dopo un
  rinomino Acquisti e Contabilità mostrano il nome vecchio per sempre. Lo script allinea quelle
  copie, e solo la parte del testo che è il nome: importi, date e stati non si toccano. **Parte a
  vuoto**: senza `SCRIVI=1` stampa i testi diversi con quante volte compaiono e cosa diventerebbero,
  e si ferma — su una tabella di contabilità è il minimo. Una `updateMany` per testo e non una per
  riga (i testi diversi sono una decina, i pagamenti migliaia), ed è ripetibile: girato due volte, la
  seconda non trova niente. `DA=… A=… SCRIVI=1 npm run rinomina:prodotto`.
- `[Sviluppo]` 📌 **La riga dei filtri resta in alto anche lei** — segnalato il 10/8 su Utenti: i
  titoli restavano incollati scorrendo, la riga dei filtri no, quindi per cambiare un filtro si
  doveva tornare in cima. Il motivo: la testa fissa la mettevano le *pagine*, scrivendo
  `position: sticky` nello stile di ogni colonna, e quello stile alla riga dei filtri — disegnata
  dentro l'helper — non arrivava. Ora è l'helper a farlo (`testaFissa`), per entrambe le righe, e lo
  scostamento della seconda si **misura**: scritto a mano sbaglia appena un titolo va a capo o cambia
  il carattere. Vale per Utenti, Home coach, Agenti e Posta con una riga a testa.
- `[Sviluppo]` 🔗 **`LeadsTable` condivide la testa con tutte le altre** (punto 3 del DA_FARE) — era
  l'ultima tabella con l'ordinamento copiato a mano, e già divergeva: la freccia c'era, la testa
  incollata no. Ora titoli cliccabili e ordinamento vengono da `useOrdinamentoServer`, che tiene lo
  stato e disegna la testa esattamente come `useTabella`. Il **filtro** resta suo e lato server, e
  non è un lavoro a metà: lì ci sono intervalli di valore e di data su decine di migliaia di lead,
  che un helper tutto in memoria con filtri «testo» o «scelta» non sa né disegnare né sostenere. La
  card ora scorre al suo interno, come in Utenti, altrimenti la testa incollata non ha niente a cui
  incollarsi e finisce sotto la barra del titolo — così restano fermi anche il totale, la ricerca e
  il paginatore.

- `[Sviluppo]` 🔔 **Cambi ed equivalenze nuove: adesso la nutrizionista lo sa** — «quando si creano
  sostituzioni nuove o equivalenze nuove mandiamo una notifica al nutrizionista». Erano due code che
  si riempivano **in silenzio**. Ogni cambio concordato in chat nasce «da verificare» — è giusto, la
  grammatura di un piatto è materia clinica — ma nessuno lo diceva a nessuno: si scopriva aprendo la
  scheda della cliente di propria iniziativa. Un cambio concordato con Gaia e mai verificato non è in
  attesa: è già nel piatto, approvato da nessuno. Stessa cosa per i gruppi di equivalenza, che il
  motore usa **solo se approvati**: un gruppo in bozza è lavoro fatto che non serve a niente finché
  il capo non lo guarda.
  Ora l'avviso parte da entrambi i punti, cambio di ingrediente e cambio di piatto, e dice chi e cosa
  («Giulia ha cambiato «carote» con «biete» a pranzo») — un avviso che dice solo «c'è un cambio»
  costringe ad aprire per sapere. Se alla cliente non è assegnata nessuna nutrizionista l'avviso va
  al **capo**, non nel vuoto: è la lezione di luglio, quando tre segnalazioni gravi sono rimaste
  ferme venti giorni perché non c'era un destinatario. La funzione sta in
  `common/avvisa-nutrizionista.ts`, accanto a quella delle coach. Sui gruppi generati dall'AI alla
  nascita di una dieta parte **un** avviso col totale e non otto uguali: otto notifiche in tre
  secondi non sono otto informazioni, sono una notifica e sette motivi per spegnerle. E non si
  avvisa mai chi ha appena creato la cosa. 17 test nuovi — uno di questi è nato scoprendo che il
  finto Prisma della suite delle sostituzioni non aveva il metodo che l'avviso usa, quindi l'avviso
  falliva in silenzio e il test passava: è esattamente il modo in cui un difetto sopravvive a una
  suite verde.
- `[Ricerca]` 📚 **Banca dati nutrizionale: la ricerca con le fonti** — in
  `progetto/ricerche/valori-nutrizionali-fonti.md` gli indici glicemici di ~50 alimenti dalle
  International Tables (Atkinson/Brand-Miller 2008 e 2021, Università di Sydney, Linus Pauling
  Institute) e i valori nutrizionali dal **CREA — Banca Dati di Composizione degli Alimenti**, ognuno
  con fonte, URL e **affidabilità dichiarata**. Serve a seminare la tabella che Gaia consulterà prima
  di affermare un numero (decisione di Simone del 10/8: non vietarle di dire i dati, ma obbligarla a
  fondarli). La parte più utile della ricerca sono le incertezze: l'IG delle patate va da 73 a 111
  secondo la fonte, quello dell'anguria da 50 a 76, e la cottura conta più della varietà (pasta 46 al
  dente → 58 se cotta venti minuti). Per questo la tabella dovrà portarsi dietro il **range**, non un
  numero secco. E sul caso di partenza: basmati e integrale sono **vicini** (57-67 contro 65, con
  voci a 50), quindi la risposta giusta non era nemmeno il contrario di quella di Gaia.

- `[Sviluppo]` ⛔ **Gaia ha detto una cosa falsa a una cliente, con sicurezza** — «il riso basmati ha
  un indice glicemico più basso dell'integrale, perché dice di no?». Su una conversazione del 1°
  agosto Gaia aveva risposto: «il basmati è più raffinato e ha un indice glicemico più alto
  rispetto all'integrale, quindi sazia meno e fa aumentare più rapidamente la glicemia». È
  **invertito**: il basmati è un chicco lungo ricco di amilosio, IG 50-58; il riso integrale comune
  sta a 65-70. E non ha sbagliato una sfumatura: ha citato un dato come se lo avesse davanti, e poi
  ci ha costruito sopra una motivazione («sazia meno») — che è il modo in cui un errore diventa
  convincente.
  Il filtro che avevamo guardava **solo il messaggio della cliente**: se lei scriveva «glicemia» la
  domanda andava alla nutrizionista, ma se la parola la scriveva **Gaia** non c'era nessun
  controllo. Ora ci sono due cose. Nel prompt: divieto esplicito di affermare dati nutrizionali —
  indice glicemico, calorie, proteine, fibre, confronti fra alimenti, effetti sull'organismo — e
  l'istruzione che se una cliente chiede se un alimento può stare al posto di un altro quella
  decisione è della nutrizionista (le tabelle di equivalenza sono sue), non un'opinione da dare.
  E soprattutto, fuori dal modello: `chat/guardia-risposta-ai.ts` legge la risposta **prima** di
  mandarla e se contiene un'affermazione nutrizionale o clinica non la manda — la cliente legge che
  su questo non si tira a indovinare, e la domanda parte verso la **nutrizionista** (non verso la
  coach, dove finiscono le domande generiche). Un prompt è una richiesta; questo è un cancello.
  La frase scartata resta scritta nel `meta` del messaggio: senza, non sapremmo mai quante volte
  scatta né su cosa. Tarata bassa di proposito — un falso positivo costa una risposta girata alla
  nutrizionista, un falso negativo costa una cliente che mangia secondo un dato inventato. 14 test
  nuovi, il primo è la frase esatta del basmati.

- `[Sviluppo]` 🔑 **Le conversazioni della cliente si accendono dai Permessi** — «la visibilità e la
  scrittura di questa parte devo poterla abilitare dai permessi». La card Conversazioni nella scheda
  cliente stava dietro a `chat`, cioè lo **stesso** interruttore della pagina Chat dell'azienda:
  spegnerla per un ruolo voleva dire togliere alla coach anche la possibilità di scrivere alle sue
  clienti, quindi non si spegneva mai. E la *verifica* di un cambio concordato in chat (conferma,
  correggi i grammi, annulla) non era un permesso affatto: era un elenco di ruoli scritto nel codice
  — `['nutritionist', 'head_nutritionist', 'admin']` — in tre posti diversi (rotta, servizio,
  frontend). Un interruttore che non accende niente è peggio di un interruttore assente, perché chi
  lo tocca crede di aver deciso qualcosa.
  Ora la chiave è **«Conversazioni della cliente»** (`client_conversations`), separata da Chat:
  *vede* = legge i thread (Gaia compresa) e l'elenco dei cambi; *gestisce* = li verifica. Default:
  coach e coordinatrice **leggono**, nutrizionista e capo nutrizionista **verificano** — la grammatura
  di un piatto resta materia clinica — ma da qui in poi la decisione è in pagina Permessi, senza
  rilascio. La risposta a «questo ruolo può?» vive in un posto solo (`permissions/permesso-di-ruolo.ts`,
  usata anche dalla scheda cliente): due copie che divergono vorrebbero dire un permesso che in una
  schermata conta e nell'altra no. Su errore del database si ricade sui **default**, mai su «sì»:
  dietro questo cancello non c'è nient'altro. 8 test nuovi, di cui uno tiene fermo il divorzio da
  `chat` sui decoratori delle rotte — è il tipo di regressione che nessun altro test vedrebbe, perché
  «funziona» resterebbe vero per l'admin e per la nutrizionista.
- `[Sviluppo]` 🧾 **«Con cosa si paga» non compariva in Parametri** — segnalato da Simone: admin, e la
  voce non c'era. Il valore era nel database e l'etichetta nel codice, ma la pagina ordinava i riquadri
  con un elenco fisso di gruppi e **scartava in silenzio** tutto quello che non era in elenco: il
  gruppo «Contabilità» non c'era, quindi la tendina in Contabilità restava vuota e in Parametri non
  c'era niente da correggere. Aggiunto il gruppo, e soprattutto tolto il difetto di classe: adesso
  quell'elenco decide solo **dove** sta un riquadro, e un gruppo che non nomina finisce in coda invece
  di sparire. Un parametro nuovo si vede sempre.
- `[Sviluppo]` 🍝 **«Se nella tabella alternative ho la pasta integrale perché Gaia dice che non ce
  l'ha?»** — quando la cliente chiedeva un cambio, Gaia scartava le alternative che *condividono
  l'alimento base* con il piatto di partenza: una regola giusta per le sostituzioni automatiche (non
  proporre riso al posto del riso) applicata dove non serviva, perché la pasta integrale al posto della
  pasta è esattamente quello che una cliente chiede. Ora la provenienza di ogni candidato viaggia con
  il candidato stesso (`gruppo` = gruppo di equivalenza approvato dal nutrizionista, `mappa` = mappa
  generica): il filtro sull'alimento condiviso vale solo per la mappa generica, mentre quello che il
  nutrizionista ha messo in un gruppo di equivalenza **è già una sua decisione** e Gaia non la
  ridiscute. 206 test nelle suite delle sostituzioni verdi.

- `[Sviluppo]` ⚖️ **La schermata Progressi si congelava dopo quattro mesi di pesate** — trovato
  cercando altri troncamenti come quello della pipeline. `ProgressService` leggeva le misure con
  `orderBy: 'asc', take: 120`: le 120 **più vecchie**. Le misure sono una al giorno, quindi dopo circa
  quattro mesi di costanza la finestra si riempiva di passato e da lì in poi: «misure registrate» fermo
  a 120 per sempre, peso «attuale» quello di mesi prima, chili persi e proiezione della data obiettivo
  sul tratto sbagliato del percorso, e **giorni di stallo su una data ferma** → `stalled: true` falso.
  Lo leggono in tre: l'app della cliente, l'alert di stallo della coach e il motore che decide i menu.
  Non peggiorava col volume del database — peggiorava con la **costanza della cliente**.
  Ora si leggono le 120 più recenti e si rimettono in ordine cronologico; il conteggio arriva da
  `count()`, e il peso di partenza — quando il profilo non lo ha — dalla **prima misura in assoluto**,
  che con `asc` era la stessa cosa e con `desc` non lo è più (altrimenti i chili persi sarebbero quelli
  degli ultimi quattro mesi invece di quelli di tutto il percorso). Il finto Prisma dei test ora
  rispetta `orderBy` e `take`: prima ignorava la query, ed è il motivo per cui il difetto è passato
  inosservato con i test verdi.
- `[Sviluppo]` 🔔 **Percorso concluso: adesso la coach lo sa** — «non avevamo detto che dopo x giorni
  di piano scaduto passavano in automatico in percorso concluso? E soprattutto che mandavamo notifiche
  alla sua coach dello spostamento?». L'automazione c'era (a +7 giorni, nel cron notturno) e non è mai
  mancata; l'**avviso** sì: lo spostamento lasciava solo una riga di audit, la scheda cambiava colonna
  di notte e la coach lo scopriva guardando la board. È l'avviso più utile di tutti, perché arriva
  nella settimana in cui una telefonata fa ancora rinnovare. La funzione che cerca la coach di una
  cliente sta ora in `common/avvisa-coach.ts`, usata anche dai rinnovi e dalle prove: due copie che la
  cercano in due modi smettono di avvisare in momenti diversi, e l'assenza di una notifica non si nota.
- `[Sviluppo]` 🔎 **`diag:percorsi-conclusi`** — quando una scheda col piano scaduto resta dov'è, la
  board mostra solo il risultato: l'automazione ha **quattro** condizioni e non si sa quale l'ha
  fermata. Lo script le dice per ogni cliente: da spostare stanotte · troppo presto (la pastiglia
  «piano scaduto» compare dal primo giorno, la soglia è a sette: fra i due non c'è niente di rotto) ·
  sta tornando (abbonamento attivo o bonifico in attesa) · fuori finestra oltre i 120 giorni · già in
  «Percorso concluso» · senza scheda CRM. `EMAIL=<email>` per una sola.
- `[Sviluppo]` 🔢 **Coda «Da validare»: i numeri fra parentesi erano lunghezze di array** — decisioni
  del motore, diete in revisione e protocolli in attesa erano elencati con `take: 100` e contati con
  `.length`: nel giorno in cui il motore segnala più di cento clienti — quello in cui il numero serve —
  la coda diceva «100» qualunque fosse la verità, e la dashboard della stessa nutrizionista usava già
  `count()` per gli stessi dati, quindi le due schermate potevano dire numeri diversi. Ora il conteggio
  viene dal database e, quando l'elenco è più corto, il titolo dice «100 di 240».

- `[Sviluppo]` 🧾 **«Con cosa si paga»: nessun elenco di ripiego nel codice** — Simone, vedendo cinque
  voci che non aveva scritto lui: «avevo detto che dovevo decidere io le voci da parametri». Le voci
  arrivavano davvero dal parametro, ma esisteva un ripiego nel codice per il caso «parametro vuoto» —
  e con un ripiego **svuotare** il parametro non svuota la tendina: le cinque voci tornavano, e per
  togliere «PayPal» bisognava scriverci qualcos'altro sopra. Un'impostazione che non si può azzerare
  non è un'impostazione. Togliato il ripiego, e il seed non semina più nessuna voce: finché il
  parametro è vuoto la tendina offre solo «non indicato» e il modulo dice dove si scrivono. Chi salva
  un metodo con la tendina vuota riceve un messaggio che indica la pagina, non un errore generico.
- `[Sviluppo]` 📐 **La card del widget non sborda più (per davvero)** — il primo `minWidth: 0` aveva
  sistemato la riga dell'importo, ma la seconda riga (il nome del prodotto, con `nowrap`) continuava a
  contribuire la sua larghezza intera alla dimensione minima del contenitore, poi del grid item, poi
  della card: era la **card** a sfondare la propria colonna. La catena va tagliata sull'antenato che ha
  la larghezza da rispettare, con `overflow: hidden` insieme a `minWidth: 0` — su un contenitore a
  blocco il solo `min-width: 0` non riduce il contributo a contenuto minimo.
- `[Sviluppo]` 🔢 **Pipeline: 100 schede per colonna e scorrimento su tutte** — coi numeri veri sotto
  gli occhi (86.323 schede in tutto, 86.274 in «Nuovo contatto») Simone ha alzato il tetto a 100 e
  chiesto lo scorrimento su **tutte** le colonne, non solo su quelle piene: `maxHeight` è un tetto e
  non un'altezza, quindi una colonna con tre schede resta alta tre schede — e l'altezza della board
  non dipende più da quale colonna è piena oggi.

- `[Sviluppo]` 🖥️ **Dashboard: ognuno si tiene i blocchi che guarda** — «tutti i moduli della
  dashboard, anche portafoglio ecc, devono essere attivabili e disattivabili da impostazioni moduli
  dashboard». I riquadri-anteprima si gestivano già; le parti fisse delle home di coach e nutrizionista
  (portafoglio, scorciatoie, numeri in cima, avvisi, link d'invito, piani in scadenza, tabella clienti,
  «Da validare», «Pazienti», regole del motore) erano scritte nella pagina. Ora sono in Impostazioni,
  in un elenco con l'interruttore.
  La preferenza è **a esclusione** (`dashboardBlocksOff`), non a inclusione come i moduli: questi
  blocchi oggi si vedono tutti, e chi ha già personalizzato la dashboard ha una lista salvata che non
  può contenere id nati oggi — con l'altra scelta le coach avrebbero aperto e non trovato più il
  portafoglio né le loro clienti. Decaduta anche la frase «il portafoglio resta comunque sempre
  visibile» in Impostazioni.
- `[Sviluppo]` 📜 **Tabelle della home scorrevoli, con quante righe vuoi** — «Le mie clienti» con
  quarantadue clienti allungava la home fino a rendere irraggiungibile tutto quello che sta sotto.
  Selettore 10 / 25 / 50 / 100 (default 10) salvato nel profilo, tabella che scorre dentro la card con
  l'intestazione ferma in cima, e «Piani in scadenza» scorrevole con la **stessa** preferenza: sono due
  elenchi della stessa pagina, e due impostazioni per la stessa domanda sarebbero due posti in cui
  cambiare la stessa cosa.
- `[Sviluppo]` 🔢 **Pipeline: la board mostrava un pezzo e il conteggio mentiva** — «perché non c'è più
  Patricia?». Caricava le **500 schede aggiornate più di recente su tutto il CRM** e poi le smistava
  nelle colonne: con le liste storiche importate erano 485 su 500 in «Nuovo contatto», e le clienti
  vere non toccate da qualche giorno cadevano fuori dalla finestra. Patricia era in «Acquisito» con
  349 € incassati, nel database, e la colonna non la mostrava — dicendo «1».
  Ora i **conteggi** vengono da un `groupBy` (esatti, per colonna, sempre) e le **schede** si caricano
  una colonna per volta con un tetto per colonna, così una colonna piena di lead freddi non affama le
  altre. Quando il tetto morde, la colonna lo dichiara invece di sembrare completa. E oltre le 50
  schede la colonna **scorre dentro sé stessa** (scelta di Simone), invece di allungare la pagina.
- `[Sviluppo]` ✅ **«Segna come gestito» adesso resta gestito** — segnalazione delle coach: «se clicco
  su segna come gestito, quando faccio refresh gli avvisi ricompaiono». Una costante sola
  (`open|handled|escalated`) rispondeva a due domande diverse: «devo ricreare questo avviso?» — dove
  `handled` ci sta di diritto, altrimenti l'avviso chiuso rinasce a ogni ricalcolo finché la condizione
  dura — e «cosa resta da fare alla coach?», dove non c'entra niente. La riga spariva perché la pagina
  la togliliava da sé, poi il server la rimandava indietro: indistinguibile da un pulsante che non
  salva. Ora la coda della coach chiede solo gli `open`; gli inoltrati restano a chi ha il perimetro
  completo, che è chi li raccoglie.
- `[Sviluppo]` 📊 **Classifiche per perdita: si scegle il mese** — «mi mostri il mese corrente, poi da
  una casellina a discesa posso selezionare quale mese vedere oppure tutto». Prima erano sempre
  sull'**intero percorso** e includevano chi ha una sola misura, cioè righe a 0,0 kg che non dicono
  «non ha perso» ma «si è pesata una volta»: ora servono almeno due misure nel periodo, ed è scritto
  sotto il titolo. Tutti i periodi (tutto + ultimi dodici mesi) arrivano in un colpo solo: la tendina
  non chiama la rete.
- `[Sviluppo]` 🧾 **Widget della dashboard: il testo non sborda più e l'importo si vede** — erano lo
  stesso difetto. La riga del widget aveva `text-overflow: ellipsis` ma stava in un contenitore flex
  senza `min-width: 0`, e un elemento flex non si stringe sotto la larghezza del suo contenuto: i
  puntini non scattavano mai, la descrizione lunga allargava la riga e **spingeva l'importo fuori
  dall'area visibile**. Nel riquadro Acquisti, inoltre, il nome della cliente è passato in alto e il
  prodotto sotto: cinque righe con la stessa descrizione troncata non distinguevano un acquisto
  dall'altro.

- `[Sviluppo]` 🛒 **Gli Acquisti si aprono alle coach, ma solo sulla loro rete** — richiesta di
  Simone: «la tabella acquisti voglio renderla visibile alle coach, ma devono vedere solo le clienti
  nella loro rete». Erano due cose diverse e mancavano entrambe.
  - **Chi entra.** Il controller aveva `@Roles('admin', 'sales')`: accendere la spunta «vede» sugli
    Acquisti nella pagina Permessi faceva comparire la voce di menu, e poi l'API rispondeva «Ruolo
    non autorizzato per questa risorsa» — una spunta che non fa niente. Ora la decisione sta dove
    Simone la prende: `@RequirePage('purchases')` legge la matrice dei permessi, quindi vale anche per
    i ruoli personalizzati e si cambia senza rilascio.
  - **Quanto vede.** L'elenco è filtrato sul perimetro di chi guarda, e le ricevute PDF sono
    controllate **una per una**: filtrare l'elenco non basta, perché l'id di una riga fuori elenco si
    può sempre chiedere a mano — e una ricevuta contiene nome, indirizzo e importo.
  - Il perimetro («le clienti della mia rete») era scritto dentro `ClientsService` come metodo
    privato: aprire una seconda pagina allo stesso perimetro voleva dire copiarlo. Ora sta in
    `common/perimetro-clienti.ts` e la scheda cliente lo usa da lì — una definizione sola, perché qui
    una divergenza non è un difetto grafico, è una coach che legge i pagamenti delle clienti di
    un'altra. Con test sui casi in cui «non si sa»: coach senza scheda staff, cliente senza coach
    assegnata, profilo mancante → **zero clienti**, non tutte.
  - Le azioni sui soldi (acquisto manuale, storno, eliminazione, ricalcolo provvigioni) restano
    `@Roles('admin')`: aprire la lettura non apre la scrittura.
- `[Sviluppo]` 🔎 **`diag:acquisti-pipeline`** — nasce dalla domanda «gli acquisti non corrispondono
  allo stato che vedo in pipeline, perché?». Le due viste divergono per **tre motivi voluti**, e lo
  script dice per ogni cliente quale dei tre è, invece di lasciarlo dedurre: la prova gratuita è un
  acquisto a € 0 che porta in «Prova» e non in «Acquisito»; l'attivazione manuale dalla scheda cliente
  è registrata a 0 e **non tocca il CRM** (regola chiesta da Simone: altrimenti una cliente al terzo
  percorso verrebbe retrocessa a «Prova»); il «€» sulla scheda della pipeline è `valueCents` — il
  valore della trattativa, che può essere stato scritto a mano — non la somma degli incassi.
  Elenca anche l'unico caso che è davvero da guardare: chi ha incassato e in pipeline non è
  «Acquisito». `EMAIL=<email>` per il dettaglio di una sola.

- `[Sviluppo]` 🧾 **Nei costi si dice con cosa hai pagato** — «manca la voce con cosa hai pagato, che
  dovrebbe essere una casella a discesa con le voci che inserisco io dai Parametri». Colonna nuova su
  `cost_entry` (`paid_with`), tendina nel modulo di registrazione, colonna filtrabile nell'elenco.
  La parte che conta della richiesta è **«le voci che inserisco io»**: stanno nel parametro
  `cost_payment_methods` (Parametri → Contabilità → «Con cosa si paga», una voce per riga), non in un
  elenco dentro il codice — un conto nuovo o una carta chiusa non devono richiedere un rilascio. Non è
  un enum e non è una tabella a parte per lo stesso motivo: l'enum vorrebbe una migrazione a ogni
  voce nuova, la tabella una pagina per gestirla, quando la pagina dei Parametri è quella in cui
  Simone è andato a cercarla.
  Due decisioni dentro: il server **rifiuta** un valore fuori elenco e dice dove si aggiunge (senza
  quel controllo un refuso dall'API creerebbe «Carta azindale» accanto a «Carta aziendale», e il
  filtro le offrirebbe come due conti diversi); rinominare una voce nei Parametri **non riscrive** i
  costi già registrati, che continuano a dire con cosa sono stati pagati allora. I costi registrati
  prima di oggi restano vuoti — con cosa siano stati pagati non si può indovinare, e riempirli con un
  valore plausibile sarebbe inventare un dato contabile.

- `[Sviluppo]` 💸 **Il compenso a visita non esiste più** — Simone, davanti alla pagina Parametri:
  «questo non serve più, lo abbiamo inserito a livello di prodotto» → «togliamolo totalmente».
  `FinanceService.creditVisitCompensation` accreditava alla nutrizionista 40 € fissi al completamento
  di ogni visita, con l'uscita a ledger, leggendo `visit_compensation_amount_cents`. Era l'ultimo
  residuo del modello prima del 14/07: pagava una seconda volta, di lato, una cosa già pagata dalla
  provvigione definita **sul piano** — e lo faceva con un numero che viveva in un parametro globale
  invece che nel prodotto. Tolti il metodo, la chiamata dal completamento visita, la riga nei
  Parametri e la chiave dal seed; con essi la dipendenza da `FinanceService` in `VisitsService`, che
  non serviva ad altro.
  **Cosa NON è stato toccato, di proposito:** la categoria `visit_compensation` resta viva nelle
  etichette di Contabilità, Compensi staff e Prelievi, e `creditStaff` la sa ancora scrivere. Gli
  importi già accreditati sono soldi dovuti o già pagati: togliere l'etichetta li lascerebbe in
  tabella come una categoria senza nome. Non nascono righe nuove, le vecchie si leggono ancora — e
  c'è un test che verifica entrambe le cose.
- `[Sviluppo]` 🧮 **Le quattro copie vecchie dell'ordinamento sono passate all'helper** — `Clienti`,
  `Diete`, `Users` e `Ricette` avevano l'ordinamento da prima di `tabella.tsx`, ognuna con la sua
  copia del blocchetto: ora la copia è una. I filtri che vanno al server restano al server (ruolo e
  archiviati in Utenti, tutti quelli di Ricette, lo stato in Diete): due strati sullo stesso dato si
  contraddicono a vicenda. `LeadsTable` resta fuori, ed è scritto perché (filtra e ordina lato
  server su decine di migliaia di righe).
  Tre difetti trovati rileggendo le venti pagine e corretti: in **Posta**, nella cartella «Inviata»,
  la colonna intestata «Destinatario» mostrava il mittente — cioè la casella dell'ufficio, la stessa
  riga su ogni messaggio, e l'unica informazione utile per ritrovare una mail inviata mancava (il
  dato arrivava dal server da sempre, non era dichiarato nel tipo); in **Buoni sconto** la colonna
  «Sconto» ordinava su un campo che mescola percentuali e centesimi, e ignorava i prezzi target che
  la cella mostra; in **Tag allergeni** la spunta «Solo da rivedere» e il filtro della colonna Stato
  erano due controlli sullo stesso dato — ora è uno, che parte già su «Da rivedere».
  Aggiunto `ordineScelte`: le tendine di stato seguono il ciclo di vita (In attesa → Pagato →
  Rifiutato) invece dell'alfabeto, che le faceva sembrare in ordine casuale.

- `[Sviluppo]` 🗃️ **Lo storico delle assegnazioni dei lead** — chiesto da Simone: «nella tabella lead
  da accettare mettere il flag "mostra accettati" con la cronologia, quindi **tutti i dati vanno
  archiviati**». Il flag era la parte facile: la cronologia non esisteva. Su `crm_record` i tre campi
  dell'assegnazione (`assignedCoachId`, `assignmentStatus`, `assignedAt`) dicono lo stato di **adesso**,
  e ogni passaggio cancellava il precedente — con tre conseguenze che nessuno poteva vedere:
  - il **rifiuto** azzerava la coach: dopo, «chi l'ha rifiutato e perché» era una domanda senza
    risposta possibile;
  - la **scadenza automatica** (cron) faceva lo stesso e non scriveva nemmeno una riga di audit: il
    lead tornava alla responsabile e l'unica traccia era una notifica, che si legge e sparisce;
  - l'**assegnazione in massa** scriveva UN audit con l'id del primo lead: la scheda degli altri
    duecento diceva «nessuno ti ha mai assegnato».
  Ora c'è la tabella `lead_assignment`: una riga per assegnazione, che nasce `pending` e finisce in un
  modo solo (`accepted`, `rejected`, `expired`, `reassigned`), con il motivo del rifiuto e con i nomi
  di coach e assegnante **copiati dentro** — uno storico che dice «assegnato a —» perché quella coach
  non lavora più qui non è uno storico. La migrazione **recupera** lo stato corrente dei lead già
  assegnati, altrimenti il giorno del rilascio il flag mostrava una tabella vuota anche a chi ha
  decine di lead accettati. Validata su PostgreSQL 16 locale, backfill compreso.
- `[Sviluppo]` 🧮 **Filtri e riordino sulle colonne, su tutte le tabelle** — «in quella tabella come in
  quella dei log mettere i filtri e riordino sulle colonne… controllale tutte». Guardandole tutte: 37
  tabelle, **cinque** avevano l'ordinamento, e le cinque erano cinque copie divergenti dello stesso
  blocchetto copiato a mano. Ora c'è `backoffice/src/components/tabella.tsx`: si dichiarano le colonne
  (titolo + come si legge il valore + se ha un filtro) e le celle restano scritte a mano.
  Tre decisioni dentro l'ordinamento, che prima ogni copia prendeva a modo suo: i **vuoti vanno in
  fondo** anche in decrescente (righe vuote in cima nascondono quelle che cerchi); gli **importi si
  ordinano come numeri**, non come «€ 100,00» che viene prima di «€ 20,00»; le tendine dei filtri
  offrono **solo i valori presenti** nelle righe caricate.
  Applicato a 20 pagine. Dove il server manda un tetto di righe la pagina lo **dichiara**: filtrare 200
  righe su 5.000 e non trovare niente non vuol dire che il fatto non c'è. Per lo stesso motivo il tetto
  del log attività è passato da 200 a 1000, con la scelta in pagina.
  - **«Lead da accettare» e «Prelievi» erano elenchi di schede, non tabelle**: convertite in tabella,
    che è l'unico modo di avere filtri e ordinamento per colonna. Nessun dato e nessun pulsante persi,
    ma sono le due pagine che cambiano aspetto: da guardare.
- `[Sviluppo]` 🔎 **Nel log attività si vede COSA è cambiato** — la stessa richiesta del 10/8 sul log
  del lead, applicata al log generale: «Parametro aggiornato» senza dire quale parametro, e da quanto a
  quanto, è una riga che non risponde a nessuna domanda. Colonna nuova, filtrabile, che usa lo stesso
  lettore dei tre formati di metadata della scheda cliente (`righeModifica`).
- `[Sviluppo]` 📅 **La data di inizio si sposta anche dal profilo dell'app** — «dal profilo, cliccando
  sul piano, mi fa modificare la data di inizio fino a 24 ore prima». Stessa azione di Gaia, stessa
  regola letta dallo **stesso** parametro (`plan_start_change_lock_hours`), stesse tre scritture — che
  adesso passano da un solo punto del codice, perché due strade che scrivono due volte le stesse tre
  cose prima o poi ne dimenticano una.
  L'app **chiede prima** al server se si può (`GET /me/plan-start`) e disegna il pulsante solo se sì:
  un pulsante che c'è e poi risponde «non si può» è peggio di un pulsante che non c'è. Quando manca
  poco, al suo posto c'è la strada che resta aperta (la coach in chat). Vale anche sui piani in attesa
  di pagamento. **Serve una OTA** per vederlo.
- `[Sviluppo]` ⚠️ **Avviso sulla matita quando la data manda il piano nel passato** — dal caso di ieri
  mattina: un piano appena attivato non compariva in dashboard perché la data di inizio aveva il mese
  sbagliato e il piano, sommata la durata, risultava finito da giorni. La conclusione era «errore mio»,
  ed era vero: ma il sistema aveva eseguito **in silenzio** un comando che cancellava il percorso della
  cliente, e da fuori era indistinguibile da un difetto. Ora il server si ferma (409) e dice cosa
  succederebbe — la data di fine calcolata, «la cliente vedrà Nessun piano attivo» — e si procede solo
  confermando. Non un divieto: spostare all'indietro un piano finito per davvero resta legittimo.

---

## 2026-08-09

- `[Sviluppo]` 🥗 **Si vede QUALE dieta è collegata a una cliente** — chiesto da Simone davanti alla
  scheda: «di Mediterranea ne ho tre tipi, devo vedere tutta la descrizione così scelgo nel modo
  giusto o capisco se la cliente è in quella corretta».
  - In scheda c'era solo lo **stile** («Mediterranea»), che con tre diete che si chiamano così non
    dice niente: «Mediterranea», «Mediterranea senza glutine» e la Keto-Mediterranea hanno tutte
    `style = mediterranean`. Quello che disambigua è `dietFamily` (= `Diet.name`), che era scritto sul
    profilo e **non compariva da nessuna parte**.
  - Riga nuova **«Dieta assegnata»**: nome vero, **descrizione per esteso e non troncata** (è quella
    che fa scegliere), regime e numero di pasti della variante, ed etichetta rossa se quel nome non è
    in catalogo o è ancora una bozza. Se la descrizione manca lo dice: senza, in app la cliente vede
    solo il nome.
  - Riga **«⚠️ Menu in corso»** quando la dieta assegnata e quella delle giornate già erogate sono
    diverse. È il caso visto stasera: sul profilo «senza glutine», nel menu di domani ancora il pane.
    Con il glutine di mezzo non è una sfumatura da lasciare implicita — e dice anche cosa fare
    («Rigenera menu»).
  - **Nell'app**, `/me/nutrition` dà ora la precedenza alla dieta **assegnata**. Prima il nome veniva
    solo dalla dieta dei menu già erogati: dopo un cambio la cliente leggeva il nome vecchio — corretto
    rispetto a quello che sta mangiando, sbagliato rispetto a quello che è stato deciso, e
    indistinguibile da un'assegnazione fallita. Nessuna OTA serve: il nome arriva dal server. Nel
    payload c'è anche `menuAncoraSullaDietaPrecedente`, che l'app userà alla prossima OTA.
- `[Sviluppo]` 📱 **OTA 2.1.4 pubblicata** — porta sull'app le schermate della serata (card Consenso e
  revoca, pagine `/privacy/*`, «?» sulla dieta, pasti del digiuno a parole, messaggio della data di
  inizio). Verifiche fatte sullo zip **prima** di pubblicarlo: `index.html` alla radice, tutte le
  stringhe delle schermate nuove, unica versione nel JS `2.1.4`, e le **push presenti** — provate nei
  due versi (ci sono `/me/push-tokens` e il listener `registration`, ed è assente la stringa del ramo
  «costruito SENZA google-services.json», eliminata dal build perché `__ENABLE_PUSH__` era true).
- `[Sviluppo]` 🔎 **`diag:cancellazioni`** — elenca le richieste di cancellazione con stato, data
  prevista e giorni rimanenti, ed evidenzia quelle scadute o che scadono oggi. Nasce da una necessità
  immediata: una prova di revoca lasciata a metà non si vede da nessuna parte, e al 31° giorno il cron
  anonimizza l'account per davvero. `FERMA=<id>` la sospende e rimette il consenso, come il link della
  mail; il rinnovo automatico no, perché riabbonare qualcuno da uno script sarebbe peggio.
- `[Prodotto]` 🌾 **Senza glutine attivo in produzione** — variante «Mediterranea senza glutine»
  generata e approvata (9 combinazioni regime × pasti), `assegna:senza-glutine` lanciato: le 2 clienti
  che avevano dichiarato il glutine su 45 risultano assegnate. Resta da premere **«Rigenera menu»** per
  entrambe: finché non si fa, ricevono ancora piatti con glutine. ⚠️ In catalogo le varianti approvate
  risultano **18 = 9 combinazioni duplicate**: non fa danni (il motore prende la prima che combacia) ma
  rende inutilizzabile una tendina di scelta. Da ripulire con `dedupe:diets` prima di aggiungere in
  scheda la scelta della dieta assegnata.

- `[Prodotto]` 📄 **Documento per Nocanty: le grammature dei grassi** —
  `progetto/Metabole_Grammature_Grassi_Domande.md` (+ PDF da mandarle). Spiega il difetto in numeri
  (70 ml di panna → 70 g di olio porta un piatto da 500 a ~890 kcal, +77%), il vincolo che decide la
  risposta — **nel sistema non esiste nessuna tabella di composizione degli alimenti**, quindi il
  fattore o lo dà lei o i grassi escono dai cambi automatici — e le due strade con le conseguenze di
  ciascuna. Chiede **un numero per alimento** (grammi equivalenti a 100 g di un riferimento del
  gruppo), non uno per coppia: il rapporto fra due membri qualsiasi lo ricava il codice, e la
  conversione resta coerente nei due versi. Segnalato anche l'inciampo che nessuno vedrebbe: il
  limite di plausibilità già attivo (un terzo–triplo) **rifiuterebbe** un fattore sotto 0,33, e Gaia
  ripiegherebbe su pari grammatura — cioè sull'errore che stiamo togliendo.
- `[Sviluppo]` 🔒 **Revoca del consenso e cancellazione a 30 giorni** (chiesta l'8/8, decisioni prese
  il 10/8) — nuovo modulo `privacy`, migrazione `richiesta_cancellazione` (validata su PG16, e
  rieseguibile).
  - Nel profilo dell'app una card **«Consenso»** con la data e l'ora in cui è stato dato (il dato
    c'era già in `consents.healthDataConsent.at`, non lo leggeva nessuno), il pulsante «Revoca
    consenso», il popup che dice cosa succede e la parola **ELIMINA** da scrivere a mano. Il pulsante
    di conferma resta spento finché la parola non è quella: l'attrito è il punto, e un pulsante
    premibile prima renderebbe il popup una formalità. Nessuno deve cancellare il proprio percorso
    per una toccata distratta sullo schermo.
  - **Le tre decisioni, e dove sono scritte nel codice.**
    1. **Solo la cliente può sospendere.** Il pulsante sta unicamente nel link mandato al suo
       indirizzo, e la rotta è pubblica proprio per questo: il token *è* l'autorizzazione, quindi
       nessuna sessione dello staff — nemmeno un admin — può arrivarci. Coach e manager ricevono una
       copia con un testo diverso, **senza** il pulsante, che spiega perché non ce l'hanno: un test
       verifica che quel link non finisca mai nella mail allo staff, altrimenti la decisione sarebbe
       scritta nel codice e smentita da un'email.
    2. **La revoca disdice il rinnovo automatico**, riusando `cancelMyRecurring`. Il piano già pagato
       resta valido fino alla scadenza: si ferma il rinnovo, non il servizio. Se poi sospende, il
       rinnovo **non** torna da sé — riabbonare qualcuno senza chiederglielo sarebbe peggio — e
       questo viene detto sia nella mail sia nella pagina che apre col link.
    3. **Le fatture restano, e si dice in tre posti**: nel popup (prima che scriva ELIMINA), nelle due
       mail e in una pagina pubblica `/privacy/cancellazione` con il perché accanto a ogni voce. I
       testi arrivano dal backend, da un'unica fonte: tre copie della stessa frase in tre posti
       divergono sempre, e questa è una frase che deve restare vera.
  - **La cancellazione anonimizza l'utenza, non elimina la riga**, e non è un compromesso al ribasso:
    una fattura appesa a un id che non esiste più è una fattura che in contabilità nessuno sa più
    leggere — e il database la rifiuterebbe comunque (`payment`, `order`, `subscription` hanno vincoli
    verso `user`). Quindi tutto il resto viene distrutto — profilo, misure, menu, conversazioni,
    documenti, note cliniche, notifiche, sessioni — e dell'utenza resta un guscio senza nome, senza
    email vera, senza indirizzo, con la password sostituita da rumore. È la forma in cui l'obbligo
    fiscale e il diritto alla cancellazione stanno insieme senza che uno dei due sia finto.
  - **Cosa non si tocca**, con un test per ciascuna: `payment`, `order`, `subscription`,
    `ledgerEntry`, `pendingCommission`, `staffCompensation`, `discountRedemption`. Le fatture per
    legge; provvigioni e compensi perché sono fatti avvenuti fra noi e persone terze, che non hanno
    chiesto niente — cancellarli falserebbe il conto economico e i compensi di qualcun altro.
  - Ultimo passo del cron notturno, e in fondo di proposito: anonimizza un'utenza, quindi ogni passo
    che girasse dopo lavorerebbe su una persona che non c'è più. Gli avvisi vengono **prima** delle
    cancellazioni: se il cron salta un giorno, chi doveva essere avvisata ieri lo è oggi e non si
    trova cancellata senza preavviso — è l'unica delle due cose che non si può rimediare. Una
    cancellazione che fallisce resta `pending` e ripassa domani: segnarla fatta per far tacere il cron
    sarebbe un adempimento dichiarato e non eseguito.
  - Revocare due volte non fa partire due termini né sposta la data, e non manda una seconda mail. Il
    token in chiaro non si conserva (in tabella solo l'hash, come per i reset password); l'ultimo
    avviso ne genera uno nuovo, così esiste sempre un solo link valido. **+53 test.**
- `[Sviluppo]` 🗣️ **I tre difetti visti nel collaudo dell'OTA 2.1.3, chiusi** — erano in schermata, in
  ordine di quanto si notano.
  - **«non voglio lasciarti con *il* panna fresca nel piatto»**: l'articolo era scritto a mano
    (`il ${p.da}`) e il ricettario ha alimenti di ogni genere. Ora il nome sta fra virgolette, come
    già altrove nello stesso file — nessuna tabella ci dice il genere di «panna fresca». Un test
    scorre tutti i testi che nominano un alimento e cerca l'articolo appiccicato: era una correzione
    da cinque minuti, ma la legge la cliente e tornerebbe alla prima frase nuova.
  - **La controproposta ora si capisce.** Alla conferma la cliente aveva scritto «l'olio mi fa peso
    posso usare il burro vegetale?» e Gaia aveva risposto «Non ho capito: confermi il cambio?».
    Adesso il sostituto proposto **da lei** viene letto e verificato con le stesse regole di
    sicurezza — solo ciò che sta fra gli equivalenti approvati e passa allergeni ed esclusioni. Se
    regge, diventa la proposta; se è un allergene, Gaia dice **perché** no e propone subito
    un'alternativa nello stesso messaggio; se non è in catalogo, la richiesta va alla nutrizionista
    (che è l'unica che può dire sì a una cosa che il ricettario non prevede) invece di finire in un
    «non ho capito». Distinzione che è costata due test rossi: «boh» e «mah» non sono proposte, e
    trattarle come tali apriva alla nutrizionista una richiesta che nessuno aveva fatto.
  - Strada facendo, un difetto **più vecchio**: `terminiCandidati` teneva l'apostrofo dentro la
    parola, quindi «l'olio» non combaciava con «olio evo». Chi scriveva «vorrei togliere l'olio» si
    sentiva rispondere che non lo trovava fra gli ingredienti di oggi, e al secondo tentativo il
    dialogo passava alla coach. In italiano l'elisione è la norma: +6 test.
  - **«Lo voglio diverso» senza dire di cosa**: prima si ripiegava sulla domanda dell'*ingrediente*
    — un'altra domanda, in risposta a una richiesta capita benissimo. Ora Gaia chiede **quale pasto**
    con l'elenco di oggi, e accetta il numero, il nome del pasto o il nome del piatto. La preferenza
    detta due messaggi prima («più proteico») non si perde per strada.
- `[Sviluppo]` 🩺 **La nutrizionista può correggere un cambio nato in chat** — li vedeva in scheda e
  non li poteva toccare: lo stato `corretta` esisteva nel dato e non c'era nessun modo di scriverlo.
  Una verifica che non si può registrare non è una verifica, è una lettura.
  - Tre azioni in scheda cliente (card Conversazioni): **conferma** («va bene così» — è quello che
    svuota l'elenco da verificare), **correggi** (sostituto e/o grammi, con una nota), **annulla**
    (il piatto torna esattamente come era; su un cambio di piatto rimette `recipeId`, nome e kcal di
    prima). `PATCH /staff/clients/:id/sostituzioni-chat`, audit `menu.cambio_chat.verifica`.
  - Due cancelli, diversi da quelli della lettura: la coach questi cambi li **legge** — le servono
    per capire come sta andando — ma non li tocca, perché la grammatura è materia clinica. Più il
    solito controllo di portata sulla cliente.
  - E la cosa che conta più dei cancelli: **la cliente viene avvisata**, con la nota della
    nutrizionista dentro la notifica. Aveva concordato qualcosa con Gaia; se il piatto di domani non
    è quello, deve saperlo da noi e non scoprirlo aprendo il menu. La semplice conferma non manda
    niente: notificare anche «va bene così» insegnerebbe a ignorare queste notifiche.
  - Serve soprattutto sul **gruppo dei grassi**, dove la pari grammatura non regge (70 ml di panna
    ≈ 200 kcal, 70 g di olio ≈ 630): finché la regola non è decisa, la mano umana è la risposta.
- `[Sviluppo]` 📊 **Fatturato e nuove clienti PER GIORNATA** (chiesto l'8/8) — `GET /admin/charts/daily`
  + card in cima alla pagina Grafici. L'asse è a giorni e il cumulato **si azzera ogni mese**; le
  frecce scorrono i mesi storici (quella «avanti» sparisce sul mese in corso, per non portare su un
  mese vuoto e futuro). Sovrapposta, tratteggiata, la linea del **mese precedente**, e in cima il
  confronto **alla stessa giornata**: è quello che risponde alla domanda vera a metà mese, mentre i
  totali — un mese finito contro un mese a metà — sembrano sempre un crollo. Sotto, le nuove clienti
  al giorno a barre (sono conteggi: una linea suggerirebbe mezze clienti).
  - Il giorno è quello di **Europe/Rome**: un incasso delle 00:30 del 1° agosto è di luglio per UTC, e
    finirebbe nel mese sbagliato lasciando giusto il totale — solo i grafici non tornerebbero, e
    nessuno saprebbe perché. La serie ha un punto per **ogni** giorno, vuoti compresi: un grafico che
    salta i giorni senza incassi mente sulla pendenza. Un endpoint suo e non un campo in più su
    `charts`, perché ogni freccia premuta ricalcolerebbe anche le misure. +16 test.
- `[Sviluppo]` ❓ **Il «?» sulla dieta nel profilo dell'app** (chiesto l'8/8) — la cliente leggeva un
  nome nudo, «Flexitariana», mesi dopo averlo scelto in registrazione, dove la spiegazione c'era. Ora
  il pallino apre il foglio: prima la descrizione che la nutrizionista ha scritto **per lei**
  (`Diet.clientDescription`), poi la scheda generale dello stile con le fonti. Lo stile è quello della
  **dieta assegnata**, non quello scelto in registrazione: se la nutrizionista l'ha spostata, il popup
  spiega quella che sta seguendo. Il pallino è diventato una classe (`.info-dot`) usata da entrambe le
  pagine — due copie inline dello stesso pallino divergono, e «come nel questionario» smette di essere vero.
- `[Sviluppo]` 🗓️ **Gaia sposta la data di inizio, parlandone** — completa la richiesta del 10/8: in
  dashboard c'era scritto «se vuoi cambiare la data di inizio, chiedi a Gaia in chat», e Gaia non
  sapeva farlo. Finora la data si spostava **solo** dal backoffice, col permesso `change_plan_start`:
  la cliente che aveva sbagliato il calendario doveva scrivere alla coach e aspettare.
  - **Il confine, deciso con Simone: solo prima che il piano parta.** Finché l'inizio è nel futuro
    spostarlo non butta via niente — nessun menu consegnato, nessuna spesa fatta. A piano avviato Gaia
    non tocca niente e passa la mano alla coach, che è anche la risposta giusta: a quel punto la
    domanda non è «che giorno metto», è «cosa è andato storto».
    Lo stesso confine copre senza un ramo in più il **piano in coda** (`planStartDate` futura ma un
    piano *è* in corso): quella data non è una sua scelta, è la scadenza di quello che sta usando, e
    spostarla sovrapporrebbe due piani.
  - **Il riconoscimento delle date sta in una funzione pura** (`menu/data-inizio-chat.ts`), perché è
    la parte che si sbaglia: «15/9» è il 15 settembre e non il 9 maggio; «lunedì» detto di lunedì è
    il lunedì **prossimo** (chi dice il nome di un giorno intende un giorno che deve ancora venire);
    «il 3» detto il 12 agosto è il 3 **settembre**; «il 3 gennaio» detto a dicembre è dell'anno dopo;
    «fra un mese» conta un mese di calendario, non trenta giorni. Due difetti chiusi dai test appena
    scritti: il «il 3» faceva scorrere l'**anno** invece del mese (sbagliato di undici mesi, e
    plausibile), e il 31 febbraio non veniva rifiutato ma **scivolava** al 3 marzo — una data che
    nessuno aveva detto, che avrebbe passato tutti i controlli a valle.
  - Ogni proposta si rilegge **a parole** («martedì 15 settembre») e nomina anche il giorno di sblocco
    del menu: una data in cifre non si riconosce sbagliata a occhio, una scritta così sì. Due
    tentativi non capiti e passa alla coach invece di insistere.
  - Sul «sì» scrive le stesse tre cose della scheda cliente — `planStartDate`, `subscription.startDate`
    e la fine **ricalcolata** dalla durata — e rigenera i menu con `regenerateFromToday`, **mai**
    `restartFromPlanStart` (che cancella anche lo storico). Su un piano `pending` l'abbonamento non si
    tocca: le sue date le mette `finalizeApproval`, scriverle qui sarebbe attivare un piano non pagato.
  - La data si **ricontrolla alla conferma**, non ci si fida dello stato appeso al messaggio: fra la
    proposta e il «sì» può passare la mezzanotte, o il piano può essere partito.
  - Audit `chat.data_inizio.spostata` + `chat.data_inizio_applicata`. I due dialoghi guidati di Gaia
    (sostituzione e data) non si rubano i turni, e una FAQ vera fatta mentre aspettiamo una data ha la
    sua risposta invece di «non ho capito la data». **+56 test**, suite 1099 verde.
- `[Sviluppo]` 🍽️ **I pasti del digiuno si vedono e si cambiano dalla scheda** — richiesta di Simone
  del 10/8. `fastingWindow` (quali pasti salta chi fa digiuno intermittente) esisteva da tempo, la
  cliente la impostava dal suo profilo, e il backoffice **non la mostrava affatto**: lo staff non
  poteva sapere se una cliente in digiuno saltava la colazione o la cena.
  - In scheda ora c'è in sola lettura («Pasti che salta») e, in modifica, una tendina che compare
    **solo** se il percorso è il digiuno — un campo che non vuol dire niente invita a compilarlo per
    sbaglio. Le tre voci sono scritte con le stesse parole che legge la cliente nel suo profilo: se
    divergessero, al telefono coach e cliente parlerebbero di due cose con lo stesso nome.
  - Permesso dedicato **«Cambia i pasti del digiuno»** (`change_fasting_window`), separato da
    «Cambia tipo di dieta»: è il motivo per cui esiste, poterlo dare alla coach senza darle anche
    regime e stile. Default: coach, coordinatrice, nutrizioniste e admin.
  - Due difetti chiusi strada facendo: il percorso diverso dal digiuno ora **azzera** la finestra
    (restava scritta, e al ritorno al digiuno riprendeva un valore vecchio in silenzio) — e senza
    chiedere il permesso, perché è una conseguenza tecnica del cambio percorso, non una scelta. E il
    permesso si chiede **solo se il valore cambia davvero**: un test rosso ha mostrato che, chiedendolo
    alla presenza del campo, chi non aveva quel flag non poteva più salvare nemmeno un numero di
    telefono, perché il form rimanda tutti i campi ogni volta.
  - Nell'app la cliente **vede a parole** quali pasti salta: prima leggeva la stringa tecnica
    «Digiuno intermittente (finestra skip_breakfast)». Resta lei a poterli cambiare (scelta di
    Simone), con la nota che se non è una preferenza ma un problema — fame, giramenti di testa,
    orari — se ne parla con la coach, che può cambiare anche la finestra. +6 test.
- `[Sviluppo]` 📆 **La data di inizio piano si legge, e la coda non mente più** — chi compra con
  partenza futura vedeva in dashboard «sarà disponibile il 12» avendo scelto di partire il 14, senza
  che nulla spiegasse quel 12 (è la data di **sblocco** del menu, due giorni prima).
  - Il messaggio ora dice **entrambe** le date e perché sono diverse — «il tuo piano parte il 14, e il
    menu si sblocca il 12: due giorni prima, così hai tempo per la spesa» — e invita a **chiedere a
    Gaia** se vuole spostare l'inizio.
  - **Piano in coda**: chi compra un secondo piano mentre uno è in corso parte alla scadenza del
    precedente, e la data scelta veniva ignorata *senza dirlo* — `profile.planStartDate` restava la
    sua, l'abbonamento partiva un'altra volta, e da lì i menu (che seguono il profilo) e la scadenza
    (che segue l'abbonamento) raccontavano due storie. Ora l'accodamento **scrive** la data vera nel
    profilo, con audit `commerce.plan.queued`: banner, gate del menu e scheda dicono la stessa cosa.
  - Al ritorno dal pagamento, se la data è già decisa **non si chiede più**: si comunica, con la
    spiegazione «se avevi già un piano in corso, questo parte quando finisce quello». Niente
    calendario finto (decisione di Simone: «non le chiedo la data, glielo dico»).


- `[Sviluppo]` 🔎 **In elenco clienti si vede chi è senza glutine** — Simone, dopo il primo giro:
  «lo script ha corretto due clienti ma io le vedo in Mediterranea, come faccio a distinguere?».
  Il dato era giusto e la domanda legittima: **la tendina «Stile» non può distinguerle.** Quella
  tendina elenca gli *stili* delle diete approvate (`catalog.service.styles`) e la variante senza
  glutine ha lo stesso stile della Mediterranea — `mediterranean` — perché è la stessa impostazione
  nutrizionale. La differenza sta nella **famiglia** (`dietFamily`), che è il campo «nome dieta» dove
  lui infatti leggeva «Mediterranea senza glutine».
  - Nell'elenco clienti ora c'è una **pastiglia «senza glutine»** accanto al nome, con due stati: se
    la dieta dedicata è assegnata è pulita, se è stata dichiarata ma la dieta è un'altra c'è un ⚠️ e
    il passaggio del mouse dice quale dieta ha davvero. È la distinzione che serve dopo un'assegnazione
    in blocco: chi è a posto e chi aspetta ancora.
  - Nuovo filtro **«Glutine»** con due voci: chi l'ha dichiarato, e — quella utile — chi l'ha
    dichiarato **senza avere la dieta dedicata**. Dopo aver generato la variante, quello è l'elenco
    delle clienti da sistemare.
- `[Sviluppo]` 🌾 **Chi dichiara il glutine riceve la dieta senza glutine, e glielo diciamo** —
  richiesta di Simone del 9/8, nei due versi: da qui in avanti in automatico, e per **chi è già
  iscritto** con una notifica e il cambio.
  - Scatta da tre punti: il **questionario** (appena salvato, prima della base personale — che si
    costruisce sulla dieta, e costruirla su quella sbagliata vorrebbe dire rifarla), la **scheda
    cliente** quando la coach aggiunge l'intolleranza, e lo script per lo storico. Un'unica funzione
    (`menu/senza-glutine.ts`) usata da tutti e tre: la stessa decisione scritta in tre posti diventa
    tre decisioni diverse entro un mese.
  - **La regola che regge tutto: non si promette una dieta che non c'è.** Assegnare vuol dire
    scrivere `dietFamily`, e da lì il motore abbina la variante; ma `pickDietFor` ha una catena di
    ripieghi, e se la variante senza glutine non è in catalogo scende a una dieta **col glutine**,
    senza errori. Quindi l'ordine è: serve? · la variante approvata esiste per il suo regime e numero
    di pasti? · **solo allora** si scrive e si avvisa. Se manca, non si scrive niente, alla cliente
    non si dice niente e nasce una segnalazione per la nutrizionista.
  - Riconoscimento volutamente **stretto**: `glutine`, `gluten`, `celiac`. NON i singoli cereali —
    «farro» fra i cibi non graditi vuol dire «non mi piace il farro», e cambiare la dieta per quello
    sarebbe decidere al posto della cliente su un dato che dice un'altra cosa. Vale sia fra le
    allergie sia fra le intolleranze sia nel testo libero.
  - Il messaggio alla cliente dice cosa cambia (riso, mais, grano saraceno, quinoa, patate, legumi al
    posto di pane e pasta di frumento) e **non promette la certificazione**: noi scegliamo gli
    ingredienti, non garantiamo la filiera né l'assenza di contaminazione. Chi è celiaca legge di
    usare prodotti certificati e di parlarne con la nutrizionista.
  - Se la cliente ha **giornate già erogate** da oggi in avanti, quelle hanno ancora il glutine
    dentro: si conta e si apre una segnalazione perché vanno rigenerate («Rigenera menu» dalla
    scheda). Senza questa riga la cliente riceve «il tuo piano è senza glutine» e per tre giorni
    mangia pasta di grano.
  - Per lo storico: **`npm run assegna:senza-glutine`** — dry-run che elenca chi verrebbe cambiata e
    dice subito se la variante approvata esiste (se non esiste, il lancio non serve a niente e lo
    scrive), `CONFERMA=1` per assegnare e avvisare. Usa la stessa funzione del prodotto.
  - +28 test, fra riconoscimento, testo del messaggio e i casi dell'assegnazione (variante mancante,
    già assegnata, giornate da rifare).

- `[Sviluppo]` 🌾 **«Mediterranea senza glutine» pronta da generare** — alla domanda «abbiamo una
  dieta gluten free?» la risposta era no, e per una ragione scritta: il documento delle regole
  suggerite mette il «senza glutine a scopo terapeutico» fra gli stili **esclusi**, perché la
  celiachia richiede diagnosi e follow-up. Questa variante non cambia quella posizione — è una
  Mediterranea che **non usa fonti di glutine**, per chi lo evita per intolleranza non celiaca o per
  scelta — ma toglie alla nutrizionista il lavoro di partenza.
  - Non è servito codice nuovo: le **note cliniche di un preset finiscono letteralmente nel prompt**
    del generatore (`generaRicetteDiUnPasto`). Il vincolo è scritto lì, in italiano, con l'elenco
    dei cereali vietati **e di quelli ammessi** — riso, mais, grano saraceno, quinoa, miglio,
    amaranto, teff, patate, castagne, legumi e la loro pasta. L'elenco delle alternative è la parte
    che decide se il menu sarà vario o sarà riso ogni giorno.
  - Le `rules` sono **identiche alla Mediterranea**: togliere il glutine non cambia la ripartizione
    dei macro né le tolleranze, e inventare numeri diversi vorrebbe dire scostarsi dalle linee guida
    senza motivo. L'etichetta invece è diversa, e non per estetica: il generatore cerca la famiglia
    per (etichetta, stile, regime, obiettivo), quindi un nome nuovo è ciò che le dà **ricette
    proprie** invece di agganciarla a quelle della Mediterranea, che il glutine ce l'hanno.
  - Nelle note ci sono anche le due cose che si dimenticano: **l'avena solo se certificata** senza
    glutine, e la **fibra** — i sostitutivi senza glutine ne hanno meno dei prodotti integrali,
    quindi legumi, verdura e pseudocereali vanno usati di più.
  - ⚠️ Scritto nel preset perché lo legga chi valida: **non è un prodotto certificato senza
    glutine.** Si escludono gli ingredienti, non si garantisce la filiera né l'assenza di
    contaminazione. Per una cliente celiaca serve la validazione della nutrizionista e l'indicazione
    di prodotti certificati.
  - Il preset arriva col **seed**, quindi compare nel generatore dopo il deploy senza lanciare
    niente, col flag «suggerita». +24 test sulle note: non sono documentazione, sono l'istruzione
    che governa la generazione, e accorciarle romperebbe il vincolo in silenzio.

- `[Sviluppo]` 🕛 **Il CI era rosso per il fuso orario, non per il codice** — dal commit delle 00:09
  in avanti il job «Backend · build + test» falliva: 11 prove su 984, in `menu.service.spec`,
  `notifications.service.spec` e `signals.service.spec`. Il type-check passava, e i commit
  precedenti della stessa serata erano verdi.
  - Il motivo, leggendo il log: i test costruivano «oggi» con `new Date().toISOString()`, cioè il
    giorno **UTC**, mentre il prodotto usa il giorno del fuso **aziendale** (`Europe/Rome`, vedi
    `common/date-only.ts`). Fra le 22:00 e le 24:00 UTC — cioè fra mezzanotte e le 2 in Italia —
    i due giorni non coincidono: il servizio erogava il menu del 9 e il test si aspettava quello
    dell'8. Le prove erano dunque **fragili due ore al giorno**, e lo sono state per mesi senza che
    si vedesse: nessuno pusha a quell'ora.
  - Corretti i tre file usando gli helper del prodotto (`giornoLocale`, `toDateOnly`) invece di
    ricalcolare la data: è la stessa lezione che `date-only.ts` racconta per le misure (una pesata a
    mezzanotte finiva sul giorno prima e sovrascriveva quella vera).
  - La correzione è stata **verificata riproducendo l'ora del guasto**, non a occhio: girando la
    suite con `APP_TIMEZONE` spostato di un giorno (`Pacific/Kiritimati`) le tre suite fallivano
    prima e passano dopo. Un modo per rifare la prova a qualsiasi ora, senza aspettare mezzanotte.

- `[Sviluppo]` 📲 **OTA 2.1.3** — porta sui telefoni il lato app del cambio menu in chat, che finora
  esisteva solo nel backend: il pulsante **«Sostituisci un ingrediente»** della home non apre più il
  pop-up «oggi / questi giorni / per sempre» ma **porta nella chat con Gaia**, che scrive lei il
  primo messaggio (elenca i piatti di oggi e chiede quale alimento cambiare); e nel Menu la
  sostituzione si legge coi grammi e con **l'unità giusta per parte** («70 ml panna fresca → 70 g
  burro»), che mentre si cucina è l'unica cosa che serve sapere.
  - Tre verifiche fatte sul bundle prima della pubblicazione, tutte sull'archivio già costruito:
    ① il numero **`"2.1.3"` è dentro `assets/index-*.js`**, quindi l'app mostra la versione che
    esegue davvero — è l'errore che è costato la 2.1.1, dove sui telefoni compariva «2.1.0»;
    ② **`app/package.json` allineato a 2.1.3** e incluso nel commit (senza quello i due numeri
    tornano a divergere); ③ **le push sono accese**: nel bundle c'è il codice di
    `PushNotifications` e *non* c'è la stringa «bundle costruito SENZA google-services.json»,
    segno che `__ENABLE_PUSH__` era vero al build e il ramo di rinuncia è stato eliminato dal
    minificatore. Un bundle costruito senza quel file spegne le notifiche a chi lo riceve, in
    silenzio e senza errori: è la ragione della guardia in `ota-release.mjs`.
  - Per provarlo in mano c'è **`npm run collaudo:menu-panna -- <email>`**: prepara sul proprio
    profilo la giornata di oggi con «Pasta alla panna (collaudo)» — panna fresca **70 ml**, che è
    il caso che fa emergere l'unità sbagliata — e il gruppo di equivalenza approvato senza cui il
    cambio non partirebbe affatto. Dry-run per default, `PULISCI=1 CONFERMA=1` per rimuovere tutto:
    il gruppo è globale e finché resta vale anche per le altre clienti.
  - **Collaudata sul telefono la notte del 9/8**, giro completo: il pulsante apre la chat, Gaia
    chiede il motivo, il cambio entra nel menu. E il «no» ha fatto quello per cui è nato — «aspetta,
    non voglio lasciarti la panna nel piatto se non la vuoi: dimmi cos'è che non ti va» — invece di
    chiudere la conversazione. Tre difetti visti in schermata (un errore di genere nel testo, la
    controproposta della cliente non riconosciuta, e la conversione ml→g non ancora verificata perché
    il sostituto proposto era l'olio) sono annotati in `progetto/DA_FARE.md`, punto 4.
  - I telefoni lo applicano **al riavvio dell'app**, non mentre è aperta.
  - ⚠️ Alla prossima pubblicazione sugli store va **svuotata `OTA_VERSION`** su Render: altrimenti
    un'installazione fresca scarica un bundle più vecchio del nativo appena installato.
- `[Sviluppo]` 🚨 **Il filtro allergeni non riconosceva i derivati: Gaia ha proposto burro a una
  cliente allergica al latte** — trovato la sera dell'8/8 leggendo il `diag:cliente` di Giusy, che ha
  `allergies: ['latte']`. Nella conversazione di quel pomeriggio Gaia le proponeva **70 g di burro**
  al posto della panna. **L'ha fermata lei, dicendo no.**
  - Il motivo è piccolo e va ricordato: il filtro cerca le parole chiave dell'esclusione dentro il
    nome dell'alimento proposto, e `expandExclusion('latte')` restituiva **solo «latte»** — parola
    che in «burro» non c'è. `INTOLERANCE_MAP` aveva `lattosio` e `latticini` ma **non `latte`**,
    cioè proprio il termine con cui l'allergene si chiama nell'elenco UE e con cui il questionario
    lo salva.
  - Secondo buco sullo stesso profilo: le sue intolleranze dicono **`lactose`**, in inglese, e
    nessuna chiave lo riconosceva. Aggiunta una tabella di **alias** (`milk`, `dairy`, `gluten`,
    `nuts`, `peanuts`, `soy`, `fish`, `shellfish`, `eggs`, `sesame`…): un allergene scritto in una
    lingua che la mappa non conosce si comporta come un'esclusione che non c'è, e non produce
    nessun errore — quindi non se ne accorge nessuno finché non lo racconta una cliente.
  - Completati anche gli altri elenchi (glutine, frutta a guscio, pesce, uova, molluschi, sesamo,
    arachidi) e allineati i derivati del latte al dizionario UE scritto con la nutrizionista, con un
    **test che fallisce se i due elenchi divergono**: sono in due file, e il buco di stasera nasce
    esattamente da un divario del genere. +17 test, con lo scenario di Giusy scritto per nome.
  - ⚠️ **Da guardare dopo il deploy**: più esclusioni vuol dire meno ricette utilizzabili. Su una
    cliente allergica al latte il pool si restringe davvero — è corretto, ma va verificato che non
    diventi un «piano bloccato»: `npm run diag:cliente -- giusy.vita01@gmail.com` e si guardano le
    giornate erogate.
- `[Sviluppo]` 👥 **Tabella clienti: filtri, riordino e colonna Coach** — richiesta della mattina
  dell'8/8 che era rimasta indietro. L'elenco clienti aveva una sola casella di ricerca e nessun
  ordinamento; per sapere di chi era una cliente si aprivano le schede una per una.
  - Intestazioni **cliccabili** per ordinare (nome, email, coach, stato, iscrizione) e riga di
    **filtri** sotto le intestazioni, come nella board dei lead: coach (compreso «— non assegnata —»,
    che è il filtro che serve davvero) e stato. Più «Azzera filtri» e il contatore «N di M».
  - Nuova **colonna Coach** (`listClients` ora restituisce la coach assegnata) e il nome del
    profilo come ripiego quando l'anagrafica è vuota: prima quelle righe mostravano «—» pur avendo
    il nome nel profilo.
  - Corretto un difetto trovato strada facendo: `total` era `items.length`, cioè **500 sia con 500
    clienti sia con 900**. Ora il conteggio è una query a parte e, se il tetto viene raggiunto, la
    tabella lo dice — filtrare 500 righe credendole tutte è il modo di concludere che una cliente
    «non c'è».
  - Il filtro qui resta **nel browser** (le clienti sono centinaia, non decine di migliaia come i
    lead): la scelta è motivata nel file, insieme al segnale che dirà quando spostarlo sul server.
- `[Sviluppo]` 🧾 **Log delle modifiche del lead: cambi da backoffice E cambi dall'app** — la
  domanda dell'8/8 era «nel log modifiche del lead segnamo anche i cambi dati da backoffice? e i
  cambi da app?». La risposta era **no due volte**, in due modi diversi: dal backoffice l'audit
  esisteva ma registrava **tre campi su diciassette** (nome, email, valore) e **non era visibile da
  nessuna parte** — nella scheda lead c'erano solo lo storico stati e le note; dall'app la riga di
  log c'era ma non diceva *che cosa* fosse cambiato.
  - Nuova card **«Modifiche ai dati»** nella scheda lead: chi, quando, e **campo per campo**
    «prima → dopo» in italiano, con l'importo in euro, i tag come elenco e i sì/no leggibili. Una
    pastiglia dice se è stata **la cliente dall'app** o una persona dello staff: sono due cose
    diverse, e una modifica della cliente non è l'errore di un'operatrice.
  - Il diff sta in `backend/src/common/diff-campi.ts` (+11 test) con le regole che evitano un log
    che mente: si registrano solo i campi **presenti nella richiesta** e solo quelli **davvero
    cambiati**; vuoto, `null` e spazi sono la stessa cosa; i tag si confrontano per contenuto e non
    per ordine. Un salvataggio che non cambia niente non lascia righe.
  - Le modifiche fatte dalla scheda lead ora compaiono **anche nel log della scheda cliente**:
    mancavano dall'elenco delle azioni, quindi non si vedevano da nessuna delle due parti.
  - Il percorso della rotta (`GET /crm/leads/:id/audit`) è fissato da un test: scrivendolo a mano
    nel front-end l'avevo sbagliato, e un percorso sbagliato lì è un 404 che l'utente legge come
    «il log non funziona».
- `[Sviluppo]` 💸 **Il piano attivato a mano non gonfia più il fatturato — questa volta davvero** —
  la correzione precedente teneva pulito il **conto economico** (nessuna riga di ricavo nel ledger)
  ed era incompleta: **i grafici del fatturato non leggono il ledger**, sommano
  `payment.amountCents` di tutti i pagamenti approvati (`analytics.service.ts`, e la dashboard fa
  lo stesso). Il piano del socio da €130 restava dentro «Fatturato / mese» e «Fatturato cumulato».
  Secondo richiamo di Simone sullo stesso punto: «va registrato a costo 0, lo avevo già detto».
  - L'attivazione dalla scheda cliente ora **registra importo 0**. Il listino non si perde: sta
    nella descrizione del pagamento («attivazione interna, senza incasso (listino 130,00 €)») e
    nell'audit, con entrambi i numeri. Un'unica verità per tutte le somme, invece di un'eccezione
    da ricordarsi in ogni punto che conta i soldi.
  - **Nessuna provvigione**: senza incasso non c'è niente da cui pagarla, e il quadratino «Genera
    le provvigioni» è stato **tolto** dal modale della scheda — mostrarlo e ignorarlo sarebbe stato
    peggio. Chi ha incassato davvero registra la vendita da **Acquisti**, dove la scelta resta.
  - Registrare 0 aveva tre effetti collaterali nascosti, tutti dietro lo stesso
    `if (amountCents === 0)`: l'attivazione passava per una **prova**. Chiusi tutti e tre e
    protetti da test: niente evento di funnel (falsava i tassi di conversione del lancio), il CRM
    non si tocca (la cliente sarebbe retrocessa a «Prova» e alla coach sarebbe arrivato «ha attivato
    la settimana di prova»), e la **durata resta quella del piano** — la rete di sicurezza degli 8
    giorni sui piani gratuiti ora guarda il prezzo di listino, non l'importo registrato.
  - Per i pagamenti già registrati: **`npm run fix:attivazioni-manuali`**. Elenca le attivazioni
    manuali approvate con importo > 0, dice quello che sa l'audit sull'origine di ognuna, e azzera
    **solo gli id indicati** (`CONFERMA=1 PAGAMENTI=<id>,<id>`). Non azzera in blocco per una
    ragione precisa: `method: 'manual'` comprende anche le **vendite vere** registrate da Acquisti,
    e farle sparire dai libri sarebbe un danno peggiore di quello che si sta riparando. Serve per
    far tornare veri i grafici di oggi: il codice nuovo vale da qui in avanti.
- `[Sviluppo]` 📅 **I menu dei piani vecchi si possono aprire** — in scheda cliente la finestra
  dei menu era fissa (ultimi 56 giorni + 7 avanti): di una cliente al secondo o terzo percorso
  **lo storico non era raggiungibile da nessuna parte**. Ora in Acquisti c'è **un pulsante per
  ogni piano** — non solo per quello corrente — e premendolo si aprono i menu erogati in quel
  periodo, con le stelline che aveva dato ai piatti. Il piano principale sta per primo ed è
  evidenziato; dentro il popup si legge di quale piano si stanno guardando i menu e c'è la strada
  di ritorno («Periodo corrente»).
  - `GET /admin/clients/:id/menus` accetta `from`/`to`. Senza periodo **la finestra è identica a
    prima**: la vista di ogni giorno non cambia. Il tetto è **400 giorni**, perché il piano più
    lungo in vendita è 12 mesi e i suoi menu vanno aperti tutti; date invertite, mezzo periodo o
    un periodo smisurato vengono rifiutati con una frase leggibile, non trasformati in una query
    enorme. Le regole stanno in `backend/src/clients/finestra-menu.ts`, isolate per poterle
    verificare senza istanziare il servizio (+10 test).
  - `getDetail` restituisce anche l'elenco dei piani (`subscriptions`: nome, stato, periodo). Il
    prezzo resta fuori: non serve a questo pulsante.
- `[Sviluppo]` 🗣️ **Quando la cliente dice «no», Gaia indaga invece di fermarsi** — da una
  conversazione vera dell'8/8. Gaia proponeva «70 ml di burro al posto di 70 ml di panna fresca»,
  la cliente rispondeva «no perché non voglio 70 gr di burro» e Gaia chiudeva con «va bene, non
  cambio niente»: corretto e inutile, perché la panna nel piatto restava. **Un «no» alla proposta
  non è un «no» al cambio**: quasi sempre vuol dire *non quel sostituto*.
  - Se il «no» **nomina il sostituto** o porta un motivo («non mi piace», «non ce l'ho in casa»),
    Gaia propone **subito l'alternativa successiva** con le stesse regole di sicurezza — allergeni
    ed esclusioni non diventano accettabili perché è la seconda proposta — e non ripropone quello
    già scartato. Il motivo del cambio resta quello di prima: non è cambiato il perché.
  - Se il «no» è **secco**, chiede: 1) questo sostituto no, proponimene un altro · 2) preferisco
    cambiare tutto il piatto · 3) ho cambiato idea. «No, lascia stare» resta un annullamento, ed è
    l'unico caso in cui si chiude.
  - **Finite le alternative** la richiesta passa alla nutrizionista con l'elenco di cosa è stato
    rifiutato, non alla rinuncia. Due risposte incomprensibili di fila passano alla coach.
  - Gli alimenti scartati restano **nella conversazione**, non nei cibi non graditi del profilo:
    quel campo restringe i menu futuri, e un'alternativa rifiutata non è un gusto dichiarato su
    quello che ha nel piatto.
- `[Sviluppo]` ⚖️ **«70 ml di burro» non lo dice più** — l'unità del sostituto veniva copiata da
  quella dell'ingrediente sostituito, e su una coppia liquido → solido è sbagliata (l'ha notato la
  cliente prima di noi). Ora da `ml` verso un solido si passa a `g`; fra due liquidi resta `ml`;
  `cl`, `dl` e `l` non si toccano, perché lì tenere lo stesso numero cambiando unità
  moltiplicherebbe la porzione per dieci. L'unità corretta arriva **fino al menu scritto** e alla
  tabella della nutrizionista, non solo alla frase in chat.
- `[Sviluppo]` 🔒 **Sui dati personali Gaia dice che non li vede** — fatture, pagamenti, contratto,
  anagrafica, richieste privacy e cancellazione account finivano nel ramo generico («Bella
  domanda! L'ho girata alla tua coach»): vero, ma sembra una scelta di non rispondere. Ora la
  risposta dice **«ai tuoi dati personali e amministrativi non ho accesso»**, indica la coach e
  conferma che il messaggio è già partito — e arriva comunque nel thread della coach, quindi non si
  perde niente. Questa frase **non passa dall'AI generativa** quando verrà accesa: un modello che
  riformula «non ho i tuoi dati» rischia di rispondere come se li avesse. I temi sensibili restano
  davanti a tutto (+10 test).
- `[Sviluppo]` 📝 **`progetto/DA_FARE.md`** — lista unica delle richieste memorizzate e non ancora
  implementate, ognuna col posto dove va e la decisione che manca: revoca del consenso con
  cancellazione a 30 giorni, il «?» sulla dieta nel profilo, filtri e colonna coach nella tabella
  clienti, log modifiche del lead, correzione di un cambio piatto da parte della nutrizionista.
- `[Sviluppo]` 🍳 **«Voglio una colazione proteica» adesso funziona, dalla richiesta al report.**
  Il cuore era già consegnato; questo è il collegamento, e chiude il caso della conversazione dell'8/8.
  **Il punto esatto in cui Gaia perdeva la richiesta** era il «no» alla conferma. La cliente aveva
  scritto «no, voglio una colazione proteica»: un rifiuto **e** una richiesta nuova, e noi rispondevamo
  soltanto «va bene, non cambio niente» — corretto e inutile, perché la richiesta era già arrivata.
  Ora quel «no» viene riletto: se contiene una richiesta di piatto diverso, il dialogo continua invece
  di chiudersi. Un «no» secco resta un no (c'è il test).
  **Da dove pesca le alternative:** solo dalla **base personale certificata** (`client_menu_pool`),
  che è il catalogo già passato dai filtri di sicurezza. Se quel pool non c'è **non propone niente** e
  passa alla nutrizionista: significa che il piano non è certificato, e pescare dai template
  salterebbe i controlli sugli allergeni per proporre una colazione. Nessuna colazione vale quel rischio.
  La tolleranza sulle kcal la legge da `menu_kcal_balance_tolerance_pct` — la **stessa** con cui il
  motore bilancia le giornate, perché due tolleranze diverse per la stessa cosa sarebbero due verità.
  **E il requisito che si dimentica** («i cambi vanno salvati nella scheda cliente e nel report di
  fine mese»): il cambio **non** è una riscrittura del `recipeId`, è un evento registrato in
  `MealSnapshot.cambioPiatto` — piatto vecchio, kcal vecchie, cosa aveva chiesto, `da_verificare`.
  Senza quel record il piatto vecchio non lascerebbe traccia e in scheda non comparirebbe niente.
  Da lì arriva in due posti: la **scheda cliente**, nella stessa tabella dei cambi di ingrediente ma
  con un'etichetta «piatto» che li distingue a occhio (la nutrizionista non guarda «ha cambiato
  l'olio» e «ha cambiato la colazione» con la stessa attenzione, e fra due piatti le grammature non
  vogliono dire niente); e il **report di fine mese**, come `cambiInChat`. Nel report si contano
  **solo** i cambi con `origine: 'chat'`: le altre sostituzioni le decide il motore per sicurezza, e
  spacciarle per «adattamenti che hai chiesto tu» sarebbe raccontarle una cosa falsa. Zero cambi è un
  numero legittimo e ha una frase sua, che non fa sembrare che sia mancato qualcosa.
  Il finto database dei test è stato **estratto in una fabbrica** condivisa: due copie dello stesso
  Prisma finto divergono, e a quel punto i due gruppi di test misurano due mondi diversi.
  905 test verdi (12 nuovi fra dialogo e conteggio), type-check identico al baseline su backend e
  backoffice.
  ⚠️ Resta da fare, e non è banale: la **correzione del nutrizionista** su un cambio di piatto (oggi
  può solo vederlo), e il caso «lo voglio diverso» quando la cliente non dice **quale** pasto e non se
  ne stava già parlando — lì Gaia torna a chiedere invece di indovinare, che è giusto ma si può fare
  meglio.

- `[Sviluppo]` 💚 **Gaia chiama per nome.** Richiesta di Simone (8/8): «Gaia non potrebbe rispondere
  chiamando per nome la cliente?». Sì, e cambia il tono di tutta la conversazione — ma il modo
  sbagliato di farlo è peggio del non farlo, quindi tre regole: **una volta per messaggio** e in
  testa alla frase, **solo il nome proprio** (mai il cognome: «Ciao Maria Grazia Cerchiara» è una
  raccomandata), e se il nome non c'è **la frase deve restare identica e corretta**.
  Da dove viene il nome: prima `clientProfile.name` — quello con cui vuole essere chiamata — e poi
  `user.firstName`. Il ripiego non è teorico: `sistema:nomi` **svuota** l'alias quando è uguale al
  nome completo, quindi da oggi quel campo è null per parecchie clienti e senza il ripiego Gaia le
  chiamerebbe tutte per «niente».
  Un test ha trovato subito un difetto che rileggendo non avevo visto: togliendo il nome la frase
  cominciava **in minuscolo** («per cambiare un alimento mi serve…»). Da lì `apreFrase`, che sposta
  la maiuscola invece di lasciare un buco. È il genere di dettaglio che non si vede in nessun log:
  lo vede solo la cliente, in chat.
  Scartati per scelta: nome nei messaggi di errore tecnico (suona finto) e nel testo delle
  segnalazioni cliniche (là serve chiarezza, non calore).

- `[Sviluppo]` 🍳 **Cambiare il PIATTO, non l'ingrediente: le decisioni, con i test.** La
  conversazione girata da Simone l'8/8: la cliente rifiuta la sostituzione dell'ingrediente e scrive
  «no, voglio una colazione proteica», poi «lo voglio diverso». Gaia risponde «Puoi dirmi di più?
  Stai cercando di cambiare qualcosa nel tuo menu, nelle abitudini, o nell'approccio al
  dimagrimento?» — una risposta da modulo davanti a una richiesta chiarissima.
  Il motivo non è l'intelligenza, è il **codice**: il dialogo sapeva fare una cosa sola, scambiare un
  ingrediente con uno equivalente dalla mappa sicura. «Una colazione proteica» è un'altra cosa: è un
  **altro piatto**. E la stessa radice spiega anche la proposta precedente, «40 g di olio evo al
  posto di 40 g di burro di macadamia»: corretta a pari grammatura, sbagliata come colazione — la
  regola «stessi grammi» conserva le calorie e non sa cosa sia un pasto.
  `menu/cambio-piatto.ts` (nuovo, puro, 17 test) contiene le decisioni:
  **le calorie non si toccano** (fuori dalla tolleranza il piatto è scartato, non penalizzato: una
  colazione da 340 kcal non diventa una da 700 perché è più proteica — è il vincolo che rende la
  proposta accettabile senza il nutrizionista); si cerca **solo dentro le ricette approvate per
  quella cliente**; «proteica» **pretende** più proteine di adesso, e una ricetta senza macro
  dichiarate non può essere proposta come proteica; il piatto attuale e quelli che ha già oggi negli
  altri slot non sono alternative; a parità vince chi resta più vicino alle calorie di partenza; e se
  non c'è niente dentro le calorie **lo si dice e si passa alla nutrizionista**, invece di proporre
  qualcosa fuori piano.
  Anche qui un test ha fatto il suo lavoro: il riconoscimento dell'intenzione era troppo generoso e
  «quando arriva il menu **nuovo**?» diventava una richiesta di cambiare piatto. Ora l'aggettivo vale
  solo accanto a un pasto o dentro una frase di volontà; «proteica» invece basta da sola, perché in
  una chat sul menu non vuol dire altro.
  ⚠️ **Non è ancora collegato al dialogo**: il pezzo che manca è pescare i candidati dalla base
  personale certificata (`client_menu_pool`), il passo «scegli 1 o 2» e la scrittura sulla giornata.
  E, richiesta di Simone nella stessa sessione, il cambio di piatto deve **finire in due posti**: la
  **scheda cliente** — accanto ai cambi di ingrediente già elencati, con lo stesso `da_verificare`,
  perché è la nutrizionista a ricontrollarlo — e il **report di fine mese**, dove il numero dei cambi
  è un dato di personalizzazione (è il punto 5 di `PROGETTO_gaia-cambio-menu.md`). Quindi il cambio
  non può essere solo una riscrittura del `recipeId`: va **registrato** come evento, o in scheda e nel
  report non comparirà mai.
  Consegnato a parte di proposito: quella parte **scrive nel menu di una cliente**, e a fine di una
  giornata così va scritta e verificata con la testa fresca, non aggiunta di corsa.
  893 test verdi, type-check identico al baseline.

- `[Sviluppo]` 🧹 **Le segnalazioni già orfane si adottano: `npm run fix:segnalazioni`.**
  La correzione di prima vale da adesso; le righe scritte prima restano senza destinatario e senza
  che nessuno le abbia mai ricevute. Sono le più vecchie, quindi le peggiori.
  Lo script prende ogni segnalazione `open`/`in_progress` con `assignedToId` vuoto, la assegna e
  manda le notifiche — «Nutrizionista richiesto» alla coach compresa. Non chiude niente e non cambia
  stato: una segnalazione la si chiude quando è stata gestita, e a deciderlo è una persona.
  Per non far divergere due copie della stessa logica ho **estratto** da `apriSegnalazione` due
  funzioni, `decidiDestinatari` e `avvisaSegnalazione`, e lo script usa quelle. Se domani cambia la
  regola di instradamento, cambia in un posto solo.
  Chi non è assegnabile viene elencato a parte: vuol dire che manca la **persona** che risponde di
  quel ruolo, ed è un problema di organico che nessuno script risolve inventando un nome.
  **La cosa più utile l'hanno detta i test.** Estraendo la decisione l'avevo messa *prima* della
  `create`, senza protezione: sette test sono diventati rossi e mi hanno mostrato che così **la
  segnalazione diventava ostaggio del suo instradamento** — tre letture in più che, se fallivano,
  facevano sparire l'allarme invece di lasciarlo orfano. In produzione sarebbe stato un intoppo del
  database al posto di un allarme clinico. Ora la decisione può fallire e si va avanti; la `create`
  no. È un contratto **migliore** di quello di prima, dove un errore sul profilo annullava tutto: due
  test nuovi lo fissano, e quello vecchio è stato riscritto invece di essere adattato.
  Nei finti database di `signals` ed `engine` mancava la tabella `staff`: completati. In quello di
  `signals` c'erano anche **due chiavi `notification`** nello stesso oggetto — in JS vince la seconda,
  quindi `updateMany` era scomparso e nessuno se n'era accorto perché ts-jest ha le diagnostiche
  spente. Unite: è il tipo di errore che solo `tsc` vede.
  870 test verdi, type-check identico al baseline.

- `[Sviluppo]` 🔐 **«Admin vede tutto» non funzionava, e la colpa era di un secondo cancello.**
  Simone l'ha dovuto segnalare **due volte**: in scheda cliente, da admin, leggeva ancora «Nessuna
  conversazione visibile per il tuo ruolo» — la seconda volta aggiungendo che la cliente aveva usato
  la chat cinque minuti prima. Aveva ragione, e la mia prima diagnosi («allora non ha thread») era
  sbagliata.
  Il ramo per l'admin in `ChatService.assertThreadAccess` era corretto e funzionava. Ma i cancelli
  qui sono **due**: prima la rotta, poi il servizio. E il controller che ho scritto io stamattina
  diceva `@Roles('coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist')` — **senza
  `admin`**. Quindi 403 sul guardiano della rotta, prima che il servizio potesse dire la sua.
  Aggiunto `admin` alla rotta (`sales` resta fuori: vede il commerciale, non il clinico).
  **Ma il difetto che ha reso tutto questo difficile da vedere è un altro**, ed è quello che mi
  interessa di più: nella card delle conversazioni il `.catch` della chiamata faceva
  `setThreads([])`. Cioè **un errore diventava «nessuna conversazione»**. Un 403 travestito da elenco
  vuoto, senza un banner, senza una riga in console: il messaggio accusava il ruolo di chi guardava,
  che è precisamente la spiegazione sbagliata. E il banner d'errore stava *dentro* il ramo «ci sono
  conversazioni», quindi con l'elenco vuoto non poteva comparire nemmeno volendo. Ora l'errore si
  vede, il 403 ha un messaggio suo, e il testo del caso vuoto non dà più la colpa al ruolo quando il
  ruolo vede tutto.
  Test nuovo `guardie-rotte.spec.ts`: legge i **decoratori** del controller e pretende `admin`
  dentro, `sales` e `client` fuori. È l'unico modo di vedere questa classe di errori senza avviare
  l'app — gli 864 test di prima erano tutti verdi mentre la funzione non funzionava, perché
  guardavano i servizi e nessuno guardava le guardie.
  **La lezione, che vale oltre il caso:** *quando un permesso sembra non funzionare, i posti da
  guardare sono due — chi può bussare e cosa può leggere.* E: *un `catch` che finge un risultato
  vuoto nasconde esattamente gli errori che stai cercando.*
  868 test verdi, type-check pulito su backend e backoffice.

- `[Sviluppo]` 🚨 **Le due segnalazioni che nascevano mute, e «nutrizionista richiesto» alla coach.**
  `apriSegnalazione` esisteva già e faceva la cosa giusta, ma **due punti la scavalcavano** ancora,
  scrivendo la riga a mano con `assignedToId: profile?.assignedNutritionistId` — vuoto per quasi
  tutte, perché una nutrizionista assegnata non ce l'ha nessuna — e **senza avvisare nessuno**:
  `signals.service.ts` (calo rapido) e `engine.service.ts` (guardrail di sicurezza). Sono le due
  cliniche, cioè le uniche che non possono aspettare.
  Trovato dal caso di `giusy.vita01@gmail.com`: **«Calo rapido: 2,87 kg/settimana»** — soglia 1.5,
  quindi quasi il doppio — aperta il **22 luglio** e ancora lì, non assegnata, mai notificata. Tre
  settimane. Il motore aveva fatto il suo lavoro: mancava il destinatario. Un guardrail che nessuno
  riceve è un guardrail spento.
  Entrambi passano ora da `apriSegnalazione`, con `dedupe: false` perché il loro controllo è **più
  fine** di quello per categoria: guarda il motivo (`Calo rapido`, `reasonKey`), e col dedupe per
  categoria una clinica già aperta per un altro motivo avrebbe zittito la nuova.
  **E la regola nuova di Simone**, che cambia il destinatario: oggi c'è **un solo** nutrizionista (il
  capo) e nessuna cliente ne ha una assegnata, quindi «quando necessario un nutrizionista segnaliamo
  alla coach con "nutrizionista richiesto" così aiutano nella gestione». La coach una notifica la
  riceveva già, ma col titolo della categoria («Sicurezza clinica»), che le dice **cosa è successo**
  e non **di chi è la palla**. Ora, quando il ruolo primario è il nutrizionista e non c'è nessuno
  assegnato, alla coach arriva **«Nutrizionista richiesto»** col motivo nel corpo e
  `nutrizionistaRichiesto: true` nel payload (lo leggono backoffice e app staff); al capo
  nutrizionista arriva la segnalazione normale. Se una nutrizionista c'è, tutto torna come prima e il
  capo non viene disturbato.
  ⚠️ Vale da adesso: le segnalazioni **già aperte** restano non assegnate. Serve una riparazione per
  quelle — Giusy ne ha due, dal 17 e dal 22 luglio.
  3 test nuovi sull'instradamento nei tre casi. 864 test verdi, type-check identico al baseline.

- `[Sviluppo]` 🧾 **Un piano attivato a mano dalla scheda non entra più in contabilità.**
  Segnalazione di Simone dell'8/8: aveva attivato a mano il percorso del socio (€130) dalla scheda
  cliente, e in contabilità comparivano **€130 di ricavi mai incassati**. «Se lo attivo a mano da lì
  non deve andare in contabilità.»
  Il trabocchetto: la scheda cliente e la pagina **Acquisti** chiamano lo **stesso** endpoint
  (`POST /admin/purchases`), e da Acquisti si registrano **vendite vere** avvenute fuori dal negozio
  — un bonifico gestito a mano. Escludere tutte le attivazioni manuali avrebbe fatto sparire quegli
  incassi dai libri: un errore peggiore di quello che stavamo correggendo, e nella direzione in cui
  nessuno controlla.
  Quindi la distinzione è **da dove arriva l'attivazione** (scelta di Simone): `origine:
  'scheda_cliente'` → attivazione interna (omaggio, staff, socio, prova), il piano si attiva davvero
  ma **non** scrive ricavi; `origine: 'acquisti'` (default) → vendita vera, contabilizzata come
  sempre. Nessuna casella da ricordarsi di spuntare: il posto da cui si preme *è* la scelta.
  Il default contabilizza **di proposito**: un chiamante che non passa il campo non deve far sparire
  in silenzio un incasso vero.
  Tecnicamente basta non scrivere la riga nel `ledgerEntry` — il conto economico legge quello, non i
  pagamenti — e il `payment` resta a documentare che l'attivazione c'è stata e chi l'ha fatta.
  Nell'audit finiscono `origine` e `contabilizzato`: se un domani un ricavo non torna, c'è scritto se
  quella attivazione doveva entrare nei conti.
  Nel modale è stato corretto anche il testo, che diceva «con il pagamento registrato come già
  incassato»: era vero, e per questo era il problema. Ora c'è un avviso esplicito, perché è l'unico
  punto in cui si può capire **prima** di premere.
  4 test nuovi che tengono ferma la distinzione nei due versi, incluso il caso «senza `origine`».
  861 test verdi, type-check identico al baseline.
  ⚠️ Resta da sistemare a mano la riga già scritta per il piano del socio: quel movimento è ancora
  nel ledger di agosto.

- `[Sviluppo]` 🔎 **`sistema:nomi` dice QUALI righe rileggere, invece di dire «rileggile tutte».**
  Lo script chiudeva con "leggi la colonna «diventa» prima di confermare… i cognomi doppi senza
  particella vengono divisi male, sono pochi". Simone l'ha rimandato indietro, e aveva ragione: su
  centinaia di lead quel consiglio non è praticabile — e «sono pochi» è una speranza, non un numero.
  La divisione però **non è incerta allo stesso modo su tutte le righe**, e questa è la parte che
  mancava. Due parole («Rosa Tinelli») non hanno alternative. Tre o più **con una particella in
  mezzo** («Maria Teresa De Santis») nemmeno: il «De» ancora il cognome e il resto è nome, è
  aritmetica. Il dubbio vive **solo** nei tre-e-più parole senza particella, dove «Maria Grazia
  Cerchiara» (nome composto + cognome) e «Anna Rossi Bianchi» (nome + cognome doppio) hanno la
  stessa forma e nessuna regola può distinguerle — un dizionario dei nomi propri sarebbe una
  scorciatoia che sbaglia su ogni nome straniero, mentre chi conosce quella persona lo vede in un
  secondo.
  Quindi: `certezzaDivisione()` in `common/dividi-nome.ts` (dove sta la regola, non nello script),
  una colonna **`esito`** nella tabella, il conteggio «sicure / da controllare» **prima** di
  confermare, e due interruttori: `CERTEZZA=sicuri` applica solo ciò che non ha alternative,
  `CERTEZZA=dubbi` mostra soltanto le righe da rivedere. Il filtro tocca le due liste in parallelo
  (sono allineate per indice: filtrarne una sola farebbe mentire la tabella).
  Il consiglio finale ora dice dove guardare e cosa cercare, invece di chiedere di rileggere tutto.
  5 test nuovi sulla certezza, compreso il caso della particella in testa o in coda — che non ancora
  niente e lascia il dubbio dov'è. 857 test verdi.

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
