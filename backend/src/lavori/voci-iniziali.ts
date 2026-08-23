/**
 * LE VOCI DI PARTENZA DELLA PAGINA «LAVORI» — una lista sola, letta da due posti.
 *
 * Stava dentro `prisma/carica-lavori.ts`. È qui perché dal 13/8 la stessa lista serve anche al
 * pulsante «Carica le voci nuove» nella pagina: ⚠️ se il pulsante ne avesse una copia, fra un mese la
 * shell e la pagina caricherebbero due elenchi diversi — ed è la stessa ragione per cui la conta
 * delle allergie e la campagna usano `common/da-ricontattare.ts` invece di due query gemelle.
 *
 * ⚠️ Aggiungere una voce qui NON la fa comparire in produzione: serve un rilascio. Le voci nate
 * dall'uso si scrivono dalla pagina, che è più veloce di noi.
 *
 * ⚠️ Lo STORICO (le 481 righe estratte dal REGISTRO) resta nello script e non entra qui: vive in un
 * file JSON accanto a lui, che in `dist/` non c'è. Un pulsante che dipende da un file che in
 * produzione può non esserci è un pulsante che fallisce proprio il giorno che serve.
 */

export type Voce = {
  chiave: string; titolo: string; dettaglio: string; categoria: string; ordine: number;
  /** ⚠️ Il rosso della pagina: «finché questa non si chiude, dietro c'è una fila ferma». Non «urgente». */
  blocca?: boolean;
  /**
   * IL LAVORO È FINITO (richiesta di Simone, 13/8 sera). Il caricamento SPUNTA la voce in pagina
   * se è ancora aperta — mai il contrario: una spunta tolta a mano non viene riaperta dal file.
   * Così il file resta l'unico posto da aggiornare quando una consegna chiude un lavoro.
   */
  fatta?: boolean;
  /**
   * ⚠️ **Spunta se c'è, ma NON crearla.**
   *
   * Serve a un caso solo, e nasce dalla voce 224: il 13/8 le voci di Vera sono finite due volte nel
   * file, con chiavi diverse per le stesse cose. Il doppione è stato tolto da qui, ma se il
   * caricamento era già girato in mezzo quelle righe sono rimaste **in pagina**, aperte, a
   * duplicare voci che esistono già con un'altra chiave.
   *
   * Marcarle `fatta: true` e basta le spunterebbe — ma se in pagina non ci fossero, il caricamento
   * le **creerebbe**: tre voci nuove già spuntate, cioè spazzatura scritta per pulire spazzatura.
   * Con questo campo il file può dire «questa non è un lavoro, è una riga da chiudere: se la trovi
   * spuntala, altrimenti non è mai esistita».
   */
  soloSeEsiste?: boolean;
  /**
   * QUANDO È NATO IL PUNTO — data e ora, in ISO locale (`'2026-08-19T12:07'`).
   *
   * Richiesta di Simone, 19/8: «voglio che mi segni nell'elenco lavori la data e ora di creazione di
   * quel punto altrimenti non capisco nulla». ⚠️ `createdAt` non risponde: le voci del file entrano
   * tutte insieme al clic su «Aggiorna dal rilascio», quindi cento voci nate in due settimane
   * risulterebbero create nello stesso minuto.
   *
   * ⚠️ **Si scrive solo dove la data si sa davvero** — dal REGISTRO, dal commit o dal testo della
   * voce stessa. Dove non si sa si lascia vuoto e la pagina dice «in elenco dal …», che è un fatto
   * diverso: inventare una data plausibile per riempire una colonna è il modo più veloce di rendere
   * inutile tutta la colonna.
   */
  nata?: string;
  /**
   * La priorità **iniziale**, solo per le voci nuove.
   *
   * ⚠️ **Non riallinea mai una voce già in elenco.** La priorità la dà Simone dalla pagina: un file
   * che gliela riscrive a ogni rilascio gli toglierebbe di mano l'unica leva che ha chiesto — e in
   * silenzio, che è la parte peggiore. Qui serve a un caso solo: una voce che nasce da una revisione
   * mia entra **bassa**, perché l'ha decisa lui il 19/8 («se trovi qualche cosa lo aggiungi in lista
   * con priorità bassa»), non perché io la ritenga meno importante.
   */
  priorita?: 'alta' | 'neutra' | 'bassa';
};

/**
 * Le categorie: servono a separare il lavoro FERMO da quello da fare. In un elenco misto una
 * decisione clinica in attesa sembra codice non scritto.
 */
export const NOCANTY = 'Aspetta Nocanty';
export const SIMONE = 'Aspetta Simone';
export const CODICE = 'Da fare — codice';
export const MANUTENZIONE = 'Manutenzione';
export const DATI = 'Dati e catalogo';

export const VOCI_INIZIALI: Voce[] = [
  {
    chiave: 'diagnostica-erogazione-muta',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-24T09:00',
    titolo: 'La diagnostica dell\'erogazione smette di tacere: le sospensioni in scheda, e un verdetto per ognuna delle 19 uscite',
    dettaglio:
      '⛔ **Il 23/8 una cliente vera è rimasta ferma per ore**, e i due strumenti che dovevano dirlo '
      + 'hanno taciuto tutti e due:\n\n'
      + '· `npm run diag:cliente` rispondeva «idonea» mentre il cancello era una **richiesta di pausa '
      + '17→23/8 auto-approvata**: le sospensioni non le mostrava affatto;\n'
      + '· `npm run prova:erogazione` stampava nove cancelli e poi «NESSUN giorno erogato», senza che '
      + 'niente lo spiegasse. `deliverIfEligible` ha **diciannove** uscite a mano vuota, molte '
      + 'silenziose: il tabulato ne guardava nove, e si fermava proprio dove stava la risposta.\n\n'
      + '✅ **Le sospensioni si leggono una volta sola** (`clients/sospensioni-di-una-cliente.ts`) e la '
      + 'usano in due: la scheda in back office e lo script. Periodi veri con l\'origine, richieste '
      + 'anche già decise con chi ha deciso, storico della card, periodi dichiarati tenuti separati.\n\n'
      + '✅ **E il verdetto li guarda**: rami nuovi per «sospesa» e «visita clinica scaduta». ⛔ La prima '
      + 'stesura aggiungeva la tabella e lasciava la conclusione a «idonea» — cioè il difetto dov\'era, '
      + 'creduto chiuso. ⚠️ E «in corso» non vuol dire «ferma»: nell\'ultimo giorno sospeso la finestra '
      + 'di rientro è aperta e il motore eroga il menu del giorno di rientro.\n\n'
      + '✅ **Un verdetto ✓/⛔ per ognuna delle 19 uscite**, con i numeri e con il valore **grezzo** dei '
      + 'tre parametri. Le domande passano dalle stesse porte del motore: il cancello della pausa '
      + 'confrontava `end_date` con l\'**istante**, quindi dalle 00:00 rispondeva diversamente dal '
      + 'servizio. Sentinella: `menu/una-porta-per-i-cancelli.spec.ts`.\n\n'
      + '⛔ **`Number(\'\')` fa ZERO, non NaN**: una casella svuotata diventava uno zero silenzioso, e '
      + 'su `menu_days_delivered` lo zero spegne l\'erogazione **per tutte** da un\'uscita muta. Ora si '
      + 'ripiega e lo si scrive; `update` rifiuta il vuoto e i soli spazi. Stesso silenzio su '
      + '`getBool`, dove costa di più (una casella vuota su `payment_method_card_enabled` toglie un '
      + 'metodo di pagamento dal carrello).\n\n'
      + '⛔ **Una diagnosi mia ritirata**: avevo scritto che con `menu_visible_days_before_return` a '
      + 'zero «la finestra non si apre mai» e che era la forma del giallo del 23/8. Misurato in '
      + 'revisione: falso — il giorno del rientro `pausaAppenaFinita` eroga lo stesso, quindi si perde '
      + 'un giorno d\'anticipo, non il menu. La correzione resta, la diagnosi è scritta come ipotesi '
      + 'ritirata invece che cancellata.',
  },
  {
    chiave: 'giallo-finestra-di-rientro',
    categoria: 'Da decidere con Simone',
    ordine: 0,
    blocca: false,
    nata: '2026-08-24T09:30',
    titolo: 'Il giallo del 23/8: la finestra di rientro era aperta e l\'erogazione è uscita vuota — non riprodotto',
    dettaglio:
      '⚠️ **Fatti misurati il 23/8 (~9:04 UTC)**: codice nuovo deployato, cliente con piano IN CODA '
      + 'che partiva il 24/8, pausa 17→23/8, pesata del 23/8, anticipo 1. Tutti i cancelli stampati ✓ '
      + 'tranne «pausa attiva ⛔», erogazione uscita VUOTA, zero log, zero blocchi. Subito dopo, '
      + 'troncando la pausa a ieri, la **stessa** `deliverIfEligible` ha erogato 24 e 25.\n\n'
      + '⛔ **Non è spiegato, e non si spiega a tavolino**: su questo caso due ipotesi ragionate sono '
      + 'già andate a vuoto il 23/8, e una terza (il parametro dell\'anticipo a zero) l\'ha smontata la '
      + 'revisione il 24/8 misurandola — con l\'anticipo a zero si perde un giorno d\'anticipo, non il '
      + 'menu, perché il giorno del rientro `pausaAppenaFinita` eroga lo stesso.\n\n'
      + '✅ **Quello che è cambiato è che adesso si legge**: `npm run prova:erogazione -- <email>` dà '
      + 'un verdetto ✓/⛔ per ognuna delle 19 uscite, con i numeri e con il valore grezzo dei '
      + 'parametri. **Se ricapita, la riga ⛔ dice quale.** E se sono tutte ✓, allora è il tabulato a '
      + 'essere incompleto, e va esteso prima di cercare altrove.\n\n'
      + 'Spiegazioni ancora sul tavolo, nessuna esclusa: la finestra di rientro non ancora in '
      + 'produzione in quel momento; `mancaLaPesataDelRientro` (che però manda una push, quindi una '
      + 'traccia la lascia); `menu_days_delivered` a zero o vuoto (uscita davvero muta); date '
      + 'dell\'evento e della richiesta di pausa in disaccordo — che è proprio quello che la sezione '
      + 'SOSPENSIONI nuova renderebbe visibile.',
  },
  {
    chiave: 'tabella-ig-import',
    nata: '2026-08-13',
    titolo: 'Indice glicemico: trascrizione VERIFICATA contro la tabella vera — resta solo da lanciare',
    dettaglio:
      'PDF del 13/8 (Linus Pauling / International Tables 2008): IG con min e max, affidabilità, macro per 100 g, stato e fonte. Il codice c\'era già da allora — `prisma/dati-ig.ts` (96 righe trascritte) e `npm run importa:ig` (anteprima, scrive solo con `CONFERMA=1`). ⚠️ **Il 18/8 Simone ha caricato il file originale in xlsx e ho confrontato riga per riga: 96 righe su 96, ZERO differenze** su nome, categoria, stato, IG, IG min, IG max, kcal, proteine, carboidrati, grassi, fibre e affidabilità. Era la verifica che mancava: 96 righe di dati clinici trascritti a mano, e un refuso su una kcal sarebbe finito in quello che Gaia dice alle clienti. ⚠️ Il crudo/cotto **è sciolto**, ed è la ragione per cui l\'import è sbloccato: ogni riga porta lo **stato esplicito**, e la pasta lì è BOLLITA (158 kcal/100 g) — usare il valore da crudo sbaglierebbe di due volte e mezzo. Si carica **confermato** (`verifiedById` = capo nutrizionista, `verifiedAt` valorizzato), perché «vuoti = da confermare» finirebbe in una coda che nessuno ha chiesto. Le tre sorti di una riga: nome nuovo → si crea; nome già in tabella **senza** IG → si aggiunge **solo** l\'IG (⚠️ le macro esistenti non si toccano: potrebbero essere state curate a mano); nome già in tabella **con** IG → non si tocca niente. ⛔ **Resta solo da lanciarlo in produzione**: `npm run importa:ig` per l\'anteprima, poi `CONFERMA=1`.',
    categoria: DATI,
    ordine: 20,
    blocca: false,
    // ⚠️ CHIUSA: Simone l'ha lanciata sulla shell di Render e in pagina risulta fatta. Restava
    // aperta **solo in questo file**, e il 19/8 gliel'ho ripresentata come se aspettasse ancora lui
    // — «la tabella IG quante volte te la devo dare?». Il file non è lo stato: lo stato è la
    // pagina, e quando i due divergono il file racconta lavoro che non esiste.
    fatta: true,
  },
  {
    chiave: 'vera-regola-dieta-scoperte',
    titolo: 'Le clienti che un divieto di dieta lascerebbe senza un pasto: l\'elenco arriva al capo — verificato il 18/8',
    dettaglio:
      'Decisione di Simone (13/8): chi resta scoperta si salta e si segnala al capo con nome e cognome. ⚠️ **Verificata chiusa il 18/8 rileggendo il codice**: la voce era rimasta aperta ma il lavoro c\'era già. `applica-proposta.ts:213` calcola l\'elenco **nel momento in cui il capo approva** — non dopo, non in una coda — e lo mette nel messaggio che sta leggendo: «⚠️ N clienti resterebbero senza un pasto e per loro il divieto NON vale: …». Finché quell\'elenco non arriva, la regola *sembra* applicata a tutte. ⚠️ E se il conto si rompe **non si finge un elenco vuoto**: si scrive nei log e lo si dice, perché «non lo so» non è «nessuno». La regola vale comunque: perdere la scrittura per un conteggio non partito sarebbe il guasto peggiore.',
    categoria: CODICE,
    ordine: 16,
    fatta: true, // verificata il 18/8: era già implementata
  },
  {
    chiave: 'vera-azione-3-variante-piano',
    titolo: 'Vera: azione 3 — la variante di piano per una cliente (tutti e tre i meccanismi)',
    dettaglio:
      'Chiusa il 14/8, tutte e tre le frasi che Simone aveva chiesto il 13/8. «Togli lo spuntino» → `ClientProfile.pastiEsclusi`, kcal ridistribuite sui pasti rimasti. «Rifai con più proteine» → `ClientProfile.proteinMinPct`, che vince SOLO sul minimo della dieta. «A colazione qualcosa di salato» → `vera/colazioni.ts`, che pesca dal pool per tag `piatto:salato` (il codice c\'è; resta SPENTA finché Lucia non ha confermato abbastanza colazioni — è la voce `colazioni-dolce-salato`, non questa). ⚠️ In tutti e tre i casi si toccano solo i giorni futuri non ancora aperti, e la cliente NON si sposta di dieta.',
    categoria: CODICE,
    ordine: 17,
    blocca: false,
    fatta: true, // chiusa il 14/8: spuntino + proteine + colazione salata
  },
  {
    chiave: 'nocanty-solfiti',
    blocca: true,
    titolo: 'L\'elenco dei solfiti da escludere',
    dettaglio:
      'Oggi l\'esclusione testuale ha solo la parola letterale «solfiti», dichiarato nel codice e in un test. I solfiti non si scrivono negli ingredienti: stanno nel vino, nell\'aceto balsamico, nella frutta disidratata, in certi salumi. Quell\'elenco decide quali piatti si tolgono dal piatto di una cliente, e in eccesso si sbaglia facilmente. Handoff allergie §1.2.',
    categoria: NOCANTY,
    ordine: 10,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'nocanty-soglia-visita',
    blocca: true,
    titolo: 'Quando far partire «serve la visita» in automatico',
    dettaglio:
      'Allergia dichiarata → richiesta di visita: il MODO di rispondere ora c\'è (via libera clinico, 13/8), la soglia è materia clinica. Handoff §8.',
    categoria: NOCANTY,
    ordine: 20,
    fatta: true, // risposta di Nocanty del 13/8: implementata (Decisioni §15)
  },
  {
    chiave: 'nocanty-freno-forte',
    blocca: true,
    titolo: 'Il «freno forte» per le allergie non confermate',
    dettaglio:
      '`allergieDichiarateIl` c\'è e si scrive, ma nessun comportamento parte da lì. Forma minima e sicura proposta: personal-base segnala la cliente come da rivedere e nella scheda compare «allergie non confermate». ⚠️ Non bloccare il piano di 315 clienti perché un campo nuovo è vuoto.',
    categoria: NOCANTY,
    ordine: 30,
    fatta: true, // risposta di Nocanty del 13/8: implementata (Decisioni §15)
  },
  {
    chiave: 'nocanty-scala-passi',
    titolo: 'La scala dei passi: 6.000 sedentaria → 12.000 molto attiva',
    dettaglio:
      '+5% ogni due settimane, tetto a +40% (decisione dell\'8 del 12/8). Per chi ha problemi cardiaci, articolari o è in gravidanza prescrivere passi è materia clinica.',
    categoria: NOCANTY,
    ordine: 40,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'nocanty-peso-efficacia',
    titolo: 'Il peso dell\'efficacia nei menu (`menu_select_w_eff`)',
    dettaglio:
      'Con i pesi di default un piatto a 5★ ora pareggia un piatto efficacissimo bocciato a 1★ (prima vinceva sempre l\'efficacia). È una manopola dei Parametri, e la gira lei.',
    categoria: NOCANTY,
    ordine: 50,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'nocanty-kcal-conferma',
    titolo: '§15.2 punto 1 — la correzione kcal a termine, dettata all\'assistente',
    dettaglio:
      'Chiusa dalla risposta di Nocanty del 13/8 («riduci le kcal del 10% per 7 giorni e poi riprendi col normale ritmo, e vorrei farlo anche dalla mia assistente») e dalla consegna del 14/8: `ClientProfile.kcalAdjustPct` esisteva già, si è aggiunta la DURATA (`kcalAdjustUntil`, migrazione additiva, NULL = per sempre come prima) e Vera la detta a voce con l\'anteprima dei due numeri prima di scrivere. ⚠️ Sotto la soglia minima di sicurezza si ferma: quella conferma si dà dalla scheda.',
    categoria: NOCANTY,
    ordine: 60,
    fatta: true, // risposta 13/8 + consegna 14/8: kcalAdjustUntil e la dettatura a voce
  },
  {
    chiave: 'deploy-allergie-idoneita',
    blocca: true,
    titolo: 'Deploy: migrazione + backend su Render, poi backoffice su Vercel',
    dettaglio:
      '⚠️ L\'ordine conta: migrazione → backend (deve reggere l\'app vecchia) → backoffice → OTA. Le migrazioni del 13/8 sono additive.',
    categoria: SIMONE,
    ordine: 10,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'conta-allergie',
    blocca: true,
    titolo: 'Lanciare `npm run conta:allergie` sulla shell di Render',
    dettaglio:
      'È in sola lettura e non scrive niente. ⚠️ Va letto PRIMA di decidere qualsiasi campagna: se la terza popolazione è la maggioranza, quella non è una campagna ma una pagina del questionario che non raccoglie. Blocca il §7.',
    categoria: SIMONE,
    ordine: 20,
    // ⚠️ CHIUSA: lanciata, e l'esito è arrivato (le 21 clienti da ricontattare). Stessa storia della
    // tabella IG: restava aperta solo qui.
    fatta: true,
  },
  {
    chiave: 'ota-2-1-8',
    titolo: 'OTA dell\'app: si riparte da 2.1.8',
    dettaglio:
      '⚠️ Non prima che il backend sia in produzione e verificato, e il numero di versione non si riusa mai.',
    categoria: SIMONE,
    ordine: 30,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'decisione-blocco-percorso',
    titolo: 'Percorso senza via libera clinico: NON si blocca, i problemi clinici vanno in testa',
    dettaglio:
      'Chiusa dalla risposta di Simone del 13/8: «se ci sono problemi clinici vanno in testa a tutte le richieste di Vera per il nutrizionista». Quindi niente blocco — bloccare vorrebbe dire sospendere piani attivi a clienti paganti — ma priorità: `guidaGiornata` conta le segnalazioni CLINICHE a parte e le mette come prima riga del quadro, prima della coda del capo, delle domande aperte e delle sostituzioni. Consegnato il 14/8.',
    categoria: SIMONE,
    ordine: 40,
    fatta: true, // risposta 13/8 + consegna 14/8: le cliniche in testa a guidaGiornata
  },
  {
    chiave: 'whatsapp-numero',
    titolo: 'Numero WhatsApp dedicato, verificato su Meta Business',
    dettaglio:
      'È la parte lenta delle credenziali via WhatsApp: il passo 1 (link al posto della password) è fatto dal 7/8, il resto aspetta il numero — non il codice.',
    categoria: SIMONE,
    ordine: 60,
  },
  {
    chiave: 'par7-ridomanda-chat',
    titolo: '§7 — la ri-domanda sulle allergie in chat con Gaia',
    dettaglio:
      '⚠️ Non si comincia senza aver letto l\'output di `conta:allergie`. Modello da copiare: `menu/data-inizio-chat.ts` (non «Conosciamoci»). Trappole già mappate: un solo flusso aperto per volta, scadenza a un\'ora (si riapre, non si riprende), niente pulsanti in chat, risposte libere da far confermare, transazione + audit perché è un dato sanitario.',
    categoria: CODICE,
    ordine: 10,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'visita-calendario',
    titolo: '«Serve una visita» adesso lo sa anche la coach: l\'attività si apre da sola',
    dettaglio:
      'Chiusa il 18/8. La nutrizionista sceglieva «serve una visita», scriveva la nota obbligatoria e salvava: da lì in poi la decisione era sul profilo, la nota nella lista note, le segnalazioni cliniche chiuse — e ⚠️ **la visita non la fissava nessuno**. L\'unico modo perché succedesse qualcosa era che qualcuno si ricordasse di riaprire quella scheda, su una decisione **clinica**. ⚠️ **Scartato l\'appuntamento creato da solo**: un appuntamento vuole un orario, e l\'orario dipende dall\'agenda della nutrizionista e da quando può la cliente — scriverne uno a caso vuol dire metterne in calendario uno che qualcuno dovrà disdire. E c\'è un secondo cancello che lo rende impossibile: `prenotazioni.service` lascia prenotare **solo chi una visita l\'ha comprata** (Simone, 12/8), quindi per chi non ce l\'ha la strada non finisce con un orario ma con un acquisto. Ora nasce un\'**attività della coach** (`visita_da_fissare`), come per la finestra del digiuno: è il posto dove in questo progetto una cosa da fare diventa lavoro di qualcuno. ⚠️ Nel testo c\'è **quante visite le restano**, ed è il numero che cambia la telefonata: senza, la coach propone un orario e la cliente si sente rispondere dall\'app «serve prima acquistarla dal negozio» — una figura fatta fare a lei su una cosa che sapevamo già. ⚠️ Tre stati: ne ha · non ne ha · **non lo so** (se il credito non si è potuto contare non si scrive né l\'uno né l\'altro). ⚠️ Il **motivo clinico non si copia** nell\'attività: la nota è già nella lista note con autore e ora, e due copie di un dato sanitario divergono — si dice dov\'è. ⚠️ `refId` è il **giorno della decisione** (`serve_visita:AAAA-MM-GG`, fuso aziendale): due salvataggi dello stesso giorno sono la stessa cosa, una valutazione nuova domani apre la sua. **Correzione della sera stessa**: prima era l\'id della nota, e con una nota creata a ogni salvataggio non poteva collidere mai — quindi risalvare apriva una seconda attività e mandava una seconda push, il contrario di quello che il commento prometteva. ⚠️ L\'attività passa da `apriAttivita`, che è il punto unico da cui nascono le attività **e** da cui parte la push alla coach: una seconda strada avrebbe creato un tipo che non avvisa nessuno, e non si sarebbe visto perché in elenco ci sarebbe stato lo stesso. ⚠️ Sotto `catch`, con l\'errore nei log: un\'attività non aperta è un lavoro in più, un\'eccezione qui sarebbe una decisione clinica che non si salva. E nel backoffice la nutrizionista **legge se è successo**: «Ho aperto un\'attività alla coach» oppure «l\'attività c\'era già da oggi: l\'ho aggiornata» — senza, non avrebbe modo di distinguere «l\'ho detto a qualcuno» da «l\'ho scritto e basta». ⚠️ **E «c\'era già» è un successo, non un errore**: nella prima versione il backoffice traduceva quel caso in «NON risulta aperta», che dal momento in cui `refId` è diventato il giorno è il **secondo salvataggio normale**. ⚠️ La push però nasce con l\'attività e non riparte: se nel frattempo è stata assegnata una coach, la scheda lo dice. 11 test nuovi. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 20,
    fatta: true, // 18/8
  },
  {
    chiave: 'coda-da-validare-b-c',
    nata: '2026-08-13',
    titolo: 'Coda «Da validare»: la B è chiusa (12/8), resta la C — e forse la C non serve più',
    dettaglio:
      '⚠️ **Voce corretta il 18/8 rileggendo il codice**: diceva «restano le consegne B e C», ma la **B era già stata consegnata il 12/8** (REGISTRO 3475-3502) — le azioni per causa, «Autorizza a proseguire» e «Blocca il piano» vivono in `engine/causa-decisione.ts:65-134` (`AZIONI_PER_CAUSA`, `azioneAmmessa`), `nutritionist.service.ts:487` e `:523-541` (`eseguiAzione`, che rifiuta un\'azione non prevista per quella causa) e nei pulsanti di `NutritionistHome.tsx:214-240`. **Resta la C**: «Conferma» dovrebbe applicare la proposta al piano, e oggi scrive soltanto `reviewOutcome` — ⚠️ un campo che in tutto il backend ha **una sola occorrenza**, quella scrittura: nessuno lo legge. Quindi «Conferma» è un registro di «ho letto» con l\'aspetto di un\'azione, che è il difetto di famiglia di questo progetto. ⛔ **Ma prima di farla serve una parola di Simone**, perché la C potrebbe essere stata **superata dalla B**: da quando la coda ha azioni esplicite per causa, «Conferma» che significa «visto, non serve fare niente» è una risposta legittima — e farle applicare da sola l\'azione proposta dal motore vorrebbe dire che un clic di presa visione cambia il piano di una persona. Le due strade erano: **1)** «Conferma» applica la proposta (e allora va rinominato: «Conferma e applica»); **2)** resta presa visione, e si toglie l\'ambiguità dall\'etichetta. ✅ **Il 19/8 Simone ha scelto la 2**: il pulsante si chiama **«Presa visione»** e sopra la lista c\'è una riga che dice cosa fanno tutti e due — l\'ambiguità è tolta, e nessun clic cambia più il piano di una persona per sbaglio. ⛔ **Resta aperta la sola parte 1**: far applicare davvero la proposta al piano. È ferma sul numero di Nocanty — di quanto si alzano le calorie — e non è una decisione di software. ⚠️ Il livello 2 non esiste (315 diete a livello 1): la voce 1 si fa in percentuale.',
    categoria: SIMONE,
    ordine: 30,
  },
  {
    chiave: 'vera-verifica-mac',
    blocca: true,
    titolo: 'Vera Consegna 2: `npm run typecheck` e `app.module.spec` nel terminale del Mac',
    dettaglio:
      '⚠️ Prima serve `npx prisma generate`: il client generato sul Mac è più vecchio dello schema, e senza rigenerarlo il type-check mostra errori che non esistono.',
    categoria: MANUTENZIONE,
    ordine: 10,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'rimuovi-traccia-diet-family',
    titolo: 'La trappola su `dietFamily` è stata tolta: aveva finito il suo lavoro',
    dettaglio:
      'Tolta la notte fra il 18 e il 19/8, e i file erano tre: `src/prisma/traccia-diet-family.ts`, il suo `.spec` e l\'aggancio in `prisma.service.ts`. ⚠️ **La data era un modo di dire una condizione** — «quando il colpevole è stato trovato e corretto» — e la condizione era vera dall\'11/8. **E la risposta resta scritta**, che è la parte che conta e che la trappola stessa chiedeva di non perdere: **nessuno riscriveva `dietFamily`**. Le `ops` di `updateClient` venivano costruite e **mai eseguite**, perché mancava il `$transaction`: le operazioni di Prisma sono pigre. La dieta spostata cinque volte da tre persone non tornava indietro — non era mai partita, e l\'audit raccontava una modifica che non c\'era perché la calcola dai valori **richiesti**. La lezione, che vale più della trappola: quando l\'audit racconta una modifica e il database non la conosce, la domanda non è «chi la sovrascrive» ma «quella scrittura viene eseguita?». Il commento resta in `prisma.service.ts`, dove la trappola stava.',
    fatta: true, // 19/8
    categoria: MANUTENZIONE,
    ordine: 20,
  },
  {
    chiave: 'ios-target-15',
    titolo: 'iOS: il deployment target sale a 15.0, e lo rimette lo script',
    dettaglio:
      'Fatto il 16/8, come avevi detto («alla prossima pubblicazione, la 2.2.0, lo facciamo»). Capacitor genera 13.0; dalla primavera 2027 App Store Connect rifiuta gli upload costruiti su un minimo così basso — è una scadenza, non un\'opinione. ⚠️ Sta in `scripts/install-ios.mjs` e non fatto a mano in Xcode, per la stessa ragione di tutto il resto di quel file: `ios/` viene rigenerato e ogni cosa che vive solo nel progetto Xcode sparisce con lui, senza dare nessun errore — la build passa lo stesso. ⚠️ Si tocca anche il PODFILE: se `platform :ios` resta a 13.0, CocoaPods costruisce i pod per 13 mentre l\'app dichiara 15, ed è il tipo di disallineamento che fa saltare un pod la sera sbagliata. ⚠️ E lo script VERIFICA il proprio risultato: se resta anche un solo target sotto il minimo esce con errore, invece di dire «fatto».',
    categoria: MANUTENZIONE,
    ordine: 30,
    fatta: true, // fatta il 16/8, prima della 2.2
  },
  {
    chiave: 'aggiornamenti-grossi',
    titolo: 'Aggiornamenti grossi: React 18, Vite 5, Prisma 6, Capacitor 6',
    dettaglio: 'Da fare in una sessione tranquilla, non insieme ad altro. ✅ **Chiusa il 20/8: erano già tutti e quattro fatti.** Simone: «c\'è altro che puoi fare?» — e siccome poche righe prima avevo detto che questa era l\'unica voce di codice rimasta mia, sono partito per aggiornare React. ⛔ **React è già alla 18.3.1**, in `app/` e in `backoffice/`; Vite alla **5.4.6**, Prisma alla **6.10.0**, Capacitor alla **6.1.2**. Stavo per aggiornare una libreria a una versione su cui è già. ⚠️ La voce è del 13/8, quando quelli erano i bersagli: sono stati raggiunti strada facendo, dentro altri lavori, e nessuno è tornato a spuntarla. **È la quarta volta in due giorni** che una voce descrive come da fare un lavoro finito — dopo «Schermate app 30», «Vera: rifare i giorni futuri» e il commento bugiardo in `applica-proposta.ts`. ⚠️ *Il costo non è la voce aperta: è che ci si mette a farla.* Le prime tre le ho scoperte leggendo il codice prima di scrivere; questa l\'ho scoperta con `package.json` aperto e le mani già sulla tastiera. ⛔ **Non l\'ho allargata ai major successivi** (React 19, Vite 6, Capacitor 7 esistono): sarebbe un\'altra decisione, non questa — e la voce diceva «una sessione tranquilla, non insieme ad altro», che vale per quella nuova esattamente come valeva per questa.',
    categoria: MANUTENZIONE,
    ordine: 40,
    fatta: true,
  },
  /**
   * ⚠️ QUI C'ERA UNA SECONDA COPIA delle voci di Vera, trascritta il 13/8 dall'altra sessione mentre
   * questa scriveva le sue consegne. Le stesse cose con chiavi diverse (`vera-moduli-dashboard` e
   * `vera-dashboard`, `ai-assistant-enabled` e `vera-ai-assistant-enabled`, …): al primo
   * `carica:lavori` sarebbero diventate quattro righe doppie in pagina — e «due righe per la stessa
   * decisione sono il modo in cui una lista comincia a non essere creduta», che è l'avvertenza
   * scritta proprio sopra quel blocco.
   *
   * Restano le versioni con il dettaglio lungo, qui sotto: dicono anche PERCHÉ, e una voce che non
   * dice perché, in tre settimane, non si sa più se è ancora vera.
   */
  {
    chiave: 'varianti-3-pasti',
    titolo: 'Generare le varianti a 3 pasti e digiuno per le famiglie esistenti',
    dettaglio:
      'Il codice è pronto dal 17/7: restano i DATI. Si aprono le famiglie nel wizard, si spuntano «3 pasti» e «Digiuno intermittente», «Genera tutte le varianti» (aggiunge solo le mancanti), poi validare e pubblicare. Le vecchie diete «Digiuno intermittente (16:8)» a 5 pasti vanno archiviate a mano.',
    categoria: DATI,
    ordine: 10,
    fatta: true, // risposta di Simone in pagina: generate, il team ci sta lavorando (due settimane per variante)
  },
  // ── Vera, l'assistente della nutrizionista (consegne 1-3a + contratto richieste, 12-13/8) ──
  {
    chiave: 'vera-citazione-incollato',
    titolo: 'Vera: il testo INCOLLATO non comanda l\'assistente',
    dettaglio:
      'Chiuso. `separaCitazione` (`capisci.ts`) divide quello che la nutrizionista scrive di suo pugno da quello che ha incollato, e `nuovoGiro` lo usa PRIMA di capire: se dentro la citazione c\'è qualcosa di azionabile e fuori no, l\'agente lo dice e si ferma (`testi.dallaCitazione`). ⚠️ È il cancello che impedisce a un messaggio scritto da qualcun altro di comandare chi ha il potere di scrivere regole su persone vere. Specifica §9.1.',
    categoria: CODICE,
    ordine: 210,
    fatta: true, // verificato nel codice il 16/8: separaCitazione in uso in nuovoGiro
  },
  {
    chiave: 'vera-dashboard',
    titolo: 'Dashboard «quello che aspetta me»: c\'è anche il pool sotto soglia — il quarto modulo',
    dettaglio:
      'La §13.3 chiedeva quattro moduli per la nutrizionista: proposte ferme dal capo, domande di dizionario senza risposta, sostituzioni da verificare e **pool sotto soglia**. I primi tre c\'erano; il quarto no, e la voce diceva «prima va deciso QUANDO calcolarlo», perché contare il pool di 315 clienti a ogni apertura della pagina sembrava caro. ⚠️ **Non lo è, e la ragione è che il pool non è della cliente: è della DIETA.** Le esclusioni sono sue, il pool no — e le diete sono poche. Si leggono i pool **una volta per dieta**, poi il conto per ogni cliente è aritmetica in memoria: la domanda si può fare a ogni apertura, invece che in un lavoro notturno con un numero vecchio di ore. Nuovo `vera/clienti-pool-scoperto.ts` (modulo puro) che riusa `calcolaPool` — non una sua copia, perché due conti della stessa cosa prima o poi divergono e nessuno se ne accorge. ⚠️ **Tre stati, non due**: una cliente **senza dieta** non è una cliente a posto, è una di cui non sappiamo niente, e finisce in `nonValutabili` con una chip sua («N da guardare a mano»); se il conto si rompe la risposta è `null` e la chip dice «pool non calcolato». Contare le non valutabili fra le sane darebbe un numero rassicurante e falso, che è il modo più efficace di non guardare più quel riquadro. ⚠️ Solo clienti con abbonamento **attivo**, e la cache della dieta è per **profilo identico** (senza, sarebbero 315 interrogazioni per un numero in un riquadro). Il tetto per giro è dichiarato: `esaminate` dice sempre quante ne ha davvero guardate. 9 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 211,
    fatta: true, // 18/8
  },
  {
    chiave: 'vera-azioni-raggio-largo',
    titolo: 'Vera: azioni a raggio largo — resta solo la regola su un TIPO DI DIETA (azione 6)',
    dettaglio:
      'Superata. Azione 3 (variante di piano) e azioni 4-5 (ricette dettate, coi macro presi dalla tabella nutrienti e mai inventati, che passano dalla coda del capo) sono fatte. Dell\'elenco originale resta solo l\'azione 6, «nella mediterranea non deve comparire più il tonno», che ha una voce sua con l\'analisi già fatta: `vera-esclusione-di-dieta`. Questa si chiude per non contare due volte la stessa cosa aperta.',
    categoria: CODICE,
    ordine: 212,
    fatta: true, // superata: resta l\'azione 6, che è vera-esclusione-di-dieta
  },
  {
    chiave: 'vera-registro-allargato',
    titolo: 'Vera: il registro mostra tutto ciò che cambia sulle sue clienti',
    dettaglio:
      'Chiuso. `registro-allargato.ts` fonde tre fonti in una riga sola (`unisciRegistro`): le azioni dell\'assistente (`AzioneVera`), le modifiche di scheda (`AuditLog`) e le sostituzioni concordate in chat (`FoodSwap`), tutte filtrate sul perimetro delle sue clienti. Nessuna tabella nuova: lettura e fusione, come diceva la specifica §13.2.',
    categoria: CODICE,
    ordine: 213,
    fatta: true, // verificato nel codice il 16/8: unisciRegistro in registro.service
  },
  {
    chiave: 'vera-frase-presentazione',
    titolo: 'Vera: cambiare la frase di presentazione («ti va di battezzarmi tu?»)',
    dettaglio:
      'Testo dettato da Simone il 13/8: «La prima cosa da fare.... io non ho un nome, ti va di battezzarmi tu? Dimmi il mio nuovo nome.. (se non ti viene in mente niente, dimmi «scegli tu»)». Sta in vera-chat.ts → testi.presentazione. ⚠️ Cambiandola si rompe un test che cerca «come vuoi chiamarmi»: agganciarlo a una parola che resta.',
    categoria: CODICE,
    ordine: 214,
    fatta: true, // riscritta il 13/8 sera: via il «battezzarmi»
  },
  {
    chiave: 'vera-modello-seconda-passata',
    titolo: 'Vera: il modello come seconda passata quando il riconoscitore non capisce',
    dettaglio:
      'Oggi capisci.ts è deterministico, con 16 casi di prova. AiService (Anthropic) c\'è già. La proposta: quando capisci torna null, chiedere al modello una PROPOSTA — che resta una proposta, mostrata e confermata come tutte le altre. ⚠️ Dopo, mai al posto: la scrittura non deve cambiare strada. Serve un sì di Simone perché cambia il costo e il comportamento. ⚠️ AGGIORNATA IL 17/8, con le prove: quel giorno Vera si è rotta TRE volte in una giornata (il nome a inizio frase alle 11:02, la domanda che fa la pastiglia alle 11:52, il refuso «sostitusci» alle 13:41) e tre volte si è aggiunta un\'espressione regolare a mano. La forma precisa della proposta — il modello TRADUCE nella forma canonica, `capisci` DECIDE, la riscrittura si mostra prima di eseguire, `daScartare` gira PRIMA (una domanda col punto interrogativo non arriva nemmeno al modello) — sta in `progetto/NOTA_Vera_Seconda_Lettura.md`, con le tre cose che possono andare storte e cosa le ferma. ⛔ CONSEGNATA il 17/8. `vera/seconda-lettura.ts`, modulo puro. La parte che conta è la GUARDIA: il modello può riordinare le parole della frase, non aggiungerne — ogni parola piena della riscrittura deve venire dalla frase (confronto per radice, così «sostitusci» passa) o essere una delle parole della FORMA, che sono un elenco chiuso. ⚠️ E i numeri si controllano a parte, perché il filtro delle parole scarta quelle sotto le tre lettere: «riduci le calorie a Giulia» → «riduci le calorie del 30% a Giulia» ci passava in mezzo, e `capisci` le percentuali le legge. Trovato da un test, non a ragionamento. Interruttore `vera_seconda_lettura` (nel seed, non solo nel codice): spento, il comportamento è quello di prima.',
    categoria: CODICE,
    ordine: 215,
    fatta: true, // 17/8: sì di Simone la mattina, consegnata la sera — `vera/seconda-lettura.ts`
  },
  {
    chiave: 'vera-ai-assistant-enabled',
    titolo: 'ai_assistant_enabled è «false» in produzione: accenderlo o no',
    dettaglio:
      'Il parametro spegne il ramo AI della chat con le clienti. Vera non ne dipende (il suo riconoscitore è deterministico), ma finché è spento non si può appoggiare niente al modello — compresa la seconda passata qui sopra.',
    categoria: SIMONE,
    ordine: 216,
    fatta: true, // acceso da Simone il 13/8 sera dalla pagina Parametri (con AI_API_KEY su Render)
  },
  {
    chiave: 'vera-dizionario-comune-conflitto',
    titolo: 'Dizionario promosso a comune: il capo conferma sapendo chi ne ha una sua diversa',
    dettaglio:
      'Chiusa dalla risposta di Simone del 13/8 («chiedi conferma al nutrizionista capo attraverso Vera») e dalla consegna del 14/8. Le voci CONVIVONO — la personale vince sempre sulla comune, nessuno viene sovrascritto — e prima del sì il capo legge CHI ne ha già una sua diversa, con nome e differenze, e cosa NON succede. Confronto per radice; chi ce l\'ha identica non compare. Vedi `conflitti-dizionario.ts`.',
    categoria: NOCANTY,
    ordine: 217,
    fatta: true, // risposta 13/8 + consegna 14/8: conflitti-dizionario.ts
  },

  // ── Vera, Consegna 4 (13/8): quello che è nato scrivendo l'avviso, il report e il corpus ──
  {
    chiave: 'vera-report-invio-mensile',
    titolo: 'Vera: il report del mese va anche MANDATO, non solo aperto',
    dettaglio:
      'Il report c\'è (`GET /vera/report`, pulsante nella pagina Assistente per il capo) e si ricalcola ogni volta. Manca la spedizione del 1° del mese al capo nutrizionista: notifica in-app + email. ⚠️ Finché non parte da solo, lo legge chi si ricorda di aprirlo — cioè, dopo la prima settimana, nessuno.',
    categoria: CODICE,
    ordine: 220,
    fatta: true, // il 1° del mese ai capi, notifica + email — cron 'veraReportMensile' (13/8 sera)
  },
  {
    chiave: 'vera-notifica-conflitto-canale',
    titolo: 'Vera: l\'avviso di conflitto sanitario oggi è solo in-app',
    dettaglio:
      'Una regola confermata sopra un vincolo dichiarato avvisa SUBITO i capi nutrizionisti, ma solo con una notifica dentro il backoffice. Se il capo non entra quel giorno, l\'avviso «subito» diventa un avviso «quando capita». Da decidere se aggiungere l\'email — è una scelta di Simone, non di codice.',
    categoria: SIMONE,
    ordine: 221,
    fatta: true, // 13/8 sera: email aggiunta accanto all'in-app, deciso da Simone
  },
  {
    chiave: 'vera-corpus-prima-del-rilascio',
    titolo: 'Le frasi che l\'assistente non ha capito si vedono nella sua pagina',
    dettaglio:
      'Chiuso il 16/8. `GET /vera/corpus` esisteva dal 12/8 e non lo apriva nessuno: era un endpoint, non un posto — e un rituale che nessuno ha l\'abitudine di fare non è un rituale. Ora le frasi non capite compaiono nella pagina dell\'assistente, sotto la chat, dalla più ripetuta, con quante volte e se si è arresa. ⚠️ Il riquadro NON compare quando non ce ne sono (stessa regola di «quello che aspetta me») ed è chiuso di default: è manutenzione, non una cosa che aspetta qualcuno. ⚠️ Le frasi si mostrano COM\'È STATO SCRITTO: ripulirle butterebbe via esattamente l\'informazione che serve, cioè come le viene di dirlo. ⚠️ La lettura sta sotto `catch`: se si rompe non compare il riquadro, non si rompe la pagina.',
    categoria: MANUTENZIONE,
    ordine: 222,
    fatta: true, // chiusa il 16/8: il corpus è in pagina, non più solo un endpoint
  },
  {
    chiave: 'vera-dizionario-alimento-nuovo',
    titolo: 'Vera si accorge quando il dizionario è invecchiato, e lo chiede',
    dettaglio:
      'Chiuso, per una strada diversa da quella immaginata. L\'idea era chiamare `famiglieCheForsePrendono` quando una ricetta viene pubblicata; la strada scelta è il rovescio e funziona meglio: `dizionario.famiglieDaAggiornare` guarda le famiglie contro il catalogo di ADESSO, e `manutenzioneDizionario` porta la domanda in chat — una famiglia per volta, ULTIMA nella coda di `cosaTiPorto`, quando non c\'è niente di più urgente. ⚠️ Al momento della pubblicazione la domanda sarebbe arrivata a chi pubblica (spesso non la nutrizionista che ha scritto la regola) e mentre sta facendo altro. Vedi `dizionario-invecchiato.ts`.',
    categoria: CODICE,
    ordine: 223,
    fatta: true, // verificato nel codice il 16/8: famiglieDaAggiornare in cosaTiPorto
  },
  {
    chiave: 'vera-lavori-doppioni-caricati',
    titolo: 'Le tre voci di Vera doppie in pagina si spuntano dal file, senza crearne di nuove',
    dettaglio:
      'Il 13/8 le voci di Vera sono finite due volte in `voci-iniziali.ts` — due sessioni, chiavi diverse per le stesse cose. Il doppione è stato tolto dal file, ma il caricamento era già girato in mezzo: in pagina restano `vera-moduli-dashboard`, `ai-assistant-enabled` e `dizionario-promossa-a-comune`, aperte, a duplicare voci che esistono già con un\'altra chiave (`vera-dashboard`, `vera-ai-assistant-enabled`, `vera-dizionario-comune-conflitto`). ⚠️ Marcarle `fatta: true` e basta non bastava: se in pagina **non** ci fossero, il caricamento le **creerebbe** — tre voci nuove già spuntate, cioè spazzatura scritta per pulire spazzatura. Nuovo campo `soloSeEsiste` su `Voce`: il file può dire «questa non è un lavoro, è una riga da chiudere — se la trovi spuntala, se non c\'è non è mai esistita». Non si cancella niente, si spunta: in pagina può esserci sopra il commento di qualcuno. E queste righe non compaiono fra i «testi da allineare», che sarebbe rumore. Basta premere «Aggiorna dal rilascio» dopo il prossimo deploy. 4 test.',
    categoria: MANUTENZIONE,
    ordine: 224,
    fatta: true, // 18/8
  },

  {
    chiave: 'vera-dizionario-cibi-diversi',
    titolo: 'Vera chiede quando non conosce una parola — e cosa resta fuori, scritto',
    dettaglio:
      'Chiusa dalla risposta di Simone del 13/8: «deve chiedere quando un cibo o un gruppo non lo conosce, fa domande al nutrizionista guidandolo in modo da apprendere di cosa si tratta». È quello che fa: una parola che il dizionario non ha ferma il giro e diventa una domanda (`famigliaASecco` → `imparaFamiglia`), e la risposta si impara. ⚠️ Resta scritto il limite noto, che NON è un difetto ma una scelta: l\'assistente non propone da sola la burrata accanto alla mozzarella, perché sono due parole diverse per cose simili e nessuna euristica sui nomi le lega. Proporre troppo insegna a rispondere di no senza leggere. Si chiuderebbe solo con una tabella di famiglie merceologiche, che oggi non esiste.',
    categoria: CODICE,
    ordine: 225,
    fatta: true, // risposta 13/8: chiede quando non conosce — il limite resta scritto
  },

  // ── Vera, azioni 4 e 5 fatte il 13/8: quello che è restato fuori ──
  {
    chiave: 'vera-azioni-3-e-6',
    titolo: 'Vera: dell\'elenco 3-6 resta l\'azione 6 (regola su un tipo di dieta)',
    dettaglio:
      'Superata, stessa ragione della voce gemella: l\'azione 3 è chiusa dal 14/8 (spuntino, cambio dieta, più proteine, giornata dettata) e le ricette pure. L\'azione 6 vive in `vera-esclusione-di-dieta`, che ha l\'analisi del contenitore (`ProductRule` con un codice nuovo, letto dove si costruisce il pool) e l\'avvertenza che è l\'unico pezzo di Vera che tocca il percorso del pasto di domani, su 315 clienti.',
    categoria: CODICE,
    ordine: 226,
    fatta: true, // superata: confluita in vera-esclusione-di-dieta
  },
  {
    chiave: 'vera-ricetta-allergeni',
    titolo: 'Vera propone gli allergeni della ricetta appena approvata, e li scrive se il capo conferma',
    dettaglio:
      'Approvare una ricetta la accende ma NON conferma gli allergeni: `allergensReviewed` resta false e `collegaRicetta` si rifiuta di metterla in una giornata — quindi il capo aveva una ricetta accesa e invisibile, e lo scopriva dal fatto che non compariva da nessuna parte. Chiuso il 16/8: subito dopo il sì, Vera mostra gli allergeni letti dagli ingredienti con la PAROLA che li ha fatti scattare («Pesce — da “orata”»), e li scrive solo se lui conferma, da `CatalogService.setRecipeAllergens` (la porta del pulsante in scheda). ⚠️ Tre asimmetrie volute: il «sì» scrive subito perché conferma una lista già letta, mentre un elenco dettato si RILEGGE prima di scriverlo; «sì, aggiungi anche il sesamo» AGGIUNGE ai suggeriti invece di sostituirli (leggerlo come elenco perderebbe pesce e glutine); e un allergene che non era fra i suggeriti si accetta lo stesso, perché `suggestAllergens` può non vederci qualcosa e aggiungerne uno di troppo costa una ricetta, dimenticarne uno costa una cliente. Vale anche per una MODIFICA che cambia gli ingredienti: la conferma di prima parlava di un altro piatto. Decisione in `progetto/NOTA_Vera_Allergeni_Ricetta_Nuova.md`.',
    categoria: CODICE,
    ordine: 227,
    fatta: true, // chiusa il 16/8
  },
  {
    chiave: 'vera-ricetta-crudo-cotto',
    titolo: 'Crudo o cotto: se la tabella ha due stati non si sceglie il primo — si chiede',
    dettaglio:
      'Chiusa il 18/8. Nocanty aveva risposto «file caricato in claude», e il file è arrivato: la scheda **«Crudo ↔ cotto»** dà la misura del problema — **farro perlato: 353 kcal da crudo, 127 da bollito, rapporto 0,36×**. ⚠️ Dire il numero sbagliato non è un\'imprecisione, sbaglia di quasi **tre volte**, e sbaglia sempre nello stesso verso (il crudo pesa più del cotto a parità di grammi). Cosa faceva prima: `ValoriNutrizionaliService.cerca` prendeva **la prima riga che combacia col nome**, quindi con due righe «riso bianco» — una crudo e una bollita — quale rispondeva lo decideva l\'ordine di lettura del database. Nessun errore, nessuna riga rossa, un numero plausibile e sbagliato. Nuovo `nutrient-facts/stato-alimento.ts`: se lo stato è **scritto nella domanda** («riso bollito») sceglie quella riga; se non c\'è e gli stati sono diversi **non sceglie**, e chi risponde dice «dipende» invece di un numero. ⚠️ Il confronto è **per parola**: «crudo» dentro «crudité» non è uno stato. ⚠️ Righe con lo **stesso** stato non sono ambigue — sono duplicati, e trattarle come ambigue avrebbe fatto rispondere «dipende» a una domanda che non dipende da niente. Vale su tutt\'e due le porte: la chat di Gaia (l\'istruzione entra fra i dati e il numero **non** entra fra quelli ammessi, così la guardia in uscita lo ferma comunque) e la ricetta dettata a Vera. ⚠️ **E per strada ne è saltato fuori uno più vecchio e più grave**: `calcolaMacro` raccoglieva gli alimenti fuori tabella in `mancanti` — con un commento sopra che spiegava perché contano — e `raccontaMacro` **non li diceva mai**. Chi dettava una ricetta con dentro un alimento che non abbiamo leggeva un totale kcal **più basso del vero**, e niente glielo diceva. Ora si dicono, e ⚠️ separati dagli ambigui: «non ce l\'ho» e «ce l\'ho due volte» portano a due azioni diverse — aggiungere una riga alla tabella, oppure dire se lo pesa crudo o cotto. 29 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 228,
    fatta: true, // 18/8
  },

  // ── Vera: le due decisioni che restano prima di finirla (13/8) ──
  {
    chiave: 'vera-variante-cosa-significa',
    titolo: 'Vera, azione 3: «variante di piano» = cambiare i pasti futuri, oppure spostare di dieta',
    dettaglio:
      'Chiusa dalla risposta di Simone del 14/8: «la nutrizionista o detta le nuove combinazioni e crea dei menu specifici guidata da Vera, oppure sceglie una diversa dieta; tutto quanto già erogato non cambia salvo diversa istruzione, e alla domanda di Vera “da quando” se risponde “da subito” si corregge il menu dal giorno dopo — quello già fatto, compresa la data odierna, resta fisso». Fatti tutti e due i meccanismi il 14/8: il cambio dieta con la domanda «da quando», e la giornata dettata a parole.',
    categoria: SIMONE,
    ordine: 229,
    fatta: true, // risposta 14/8 + le due consegne dello stesso giorno
  },
  {
    chiave: 'vera-esclusione-di-dieta',
    titolo: 'L\'esclusione a livello di DIETA esiste nel motore — verificato il 18/8, era già fatta',
    dettaglio:
      '«Nella mediterranea non deve comparire più il tonno». ⚠️ **Verificata chiusa il 18/8 rileggendo il codice**: la voce era rimasta aperta ma il lavoro c\'era già. `vera/regola-dieta.ts` (`RULE_CODE_ESCLUSIONI`, `terminiVietati`, `ricetteVietate`) tiene il divieto in `ProductRule` (`{dietId, ruleCode, params: { termini }}`), e agisce in **due punti**: il **filtro a monte** in `menu.service.buildScoringContext:1483-1489` toglie le ricette vietate dal pool, così non vengono nemmeno prese in considerazione; e la **guardia** su `evaluateMeals:808`, che è il punto obbligato di ogni erogazione — lì si evita di servirle. ⚠️ Il termine si cerca nel **nome E negli ingredienti**: senza, «insalata di riso» col tonno dentro sarebbe passata e il divieto sarebbe stato una decorazione. ⚠️ Uno slot che resterebbe **vuoto** non si svuota (decisione di Simone, 13/8): quella cliente resta com\'era e finisce nell\'elenco delle «scoperte» che il capo legge nel momento in cui approva — una giornata senza un pasto è peggio del piatto che si voleva togliere. Anche i **giorni già preparati e non ancora aperti** si rifanno (`applica-proposta.ts:157-190`), con il tetto sul numero di clienti dichiarato invece che silenzioso.',
    categoria: CODICE,
    ordine: 230,
    fatta: true, // verificata il 18/8: era già implementata
  },
  // ── 13/8 pomeriggio: colazioni, battesimo di Vera, campagna allergie a tutti ──
  {
    chiave: 'colazioni-dolce-salato',
    nata: '2026-08-13',
    titolo: 'Colazioni: la pagina «dolce o salata» è su — servono le conferme di Lucia',
    dettaglio:
      'Pagina nuova «Colazioni» nel backoffice (dal menu, sotto Allergeni ricette): il sistema propone dolce/salato dagli ingredienti delle sole ricette di colazione, Lucia conferma — anche in blocco. Il tag scritto È la conferma (`piatto:dolce`/`piatto:salato`), gli incerti restano senza proposta e li decide lei. ⚠️ L\'azione di Vera «a colazione qualcosa di salato» resta SPENTA finché le conferme non bastano: una colazione senza tag non partecipa. Decisione in `Decisioni_Simone_20260813.md` §12. ✅ **Chiusa il 19/8 sera dalla risposta di Simone**: «ci sta lavorando, va bene così chiudiamo il punto». ⚠️ La pagina e il meccanismo ci sono; quello che resta è il lavoro di Lucia sulle conferme, che non è un punto di software e non ha bisogno di una riga in elenco per essere ricordato — lo dice la pagina stessa, con quante ne restano.',
    categoria: CODICE,
    ordine: 232,
    fatta: true,
  },
  {
    chiave: 'vera-battesimo-scaduto',
    titolo: 'Vera: il battesimo non si perde più con la scadenza del dialogo',
    dettaglio:
      'Dagli screenshot di Simone (13/8): il saluto chiedeva il nome, ma lo stato scadeva in 2 ore e dopo la scadenza OGNI risposta cadeva su «non ci arrivo» — per sempre. Ora il battesimo è una condizione sui dati (nome non ancora scelto): «ti chiamerò Vera» funziona anche il giorno dopo. E l\'estrattore non prende più la prima parola («Ciao ti chiamerò Vera» l\'avrebbe battezzata «Ciao»). Bonus: «annulla» a vuoto risponde «non c\'era niente in corso». Finestra della chat portata a ~640px.',
    categoria: CODICE,
    ordine: 233,
    fatta: true, // chiusa il 13/8
  },
  {
    chiave: 'campagna-allergie-a-tutti',
    titolo: 'Campagna allergie: push a TUTTI i 48 (decisione Simone) — si lancia il 14/8 alle 11',
    dettaglio:
      'Due script, nell\'ordine: `chiedi:allergie` (i 3 da codificare, dialogo con Gaia — ora manda anche la PUSH vera, prima c\'era solo la campanella in app) e il nuovo `avvisa:allergie` (gli altri 45: i 24 mai risposto vengono portati alla scheda in home, i 21 già a posto ricevono l\'informativa sul profilo). Tutti e due prima in prova, letti riga per riga, poi CONFERMA=1. ⚠️ Solo DOPO Render + OTA. Decisione in `Decisioni_Simone_20260813.md` §13.',
    categoria: SIMONE,
    ordine: 234,
    fatta: true, // lanciata da Simone il 14/8 alle 11:00 — sua conferma, non il codice
  },
  {
    chiave: 'pasti-esclusi-in-scheda',
    titolo: 'Gli spuntini tolti dall\'assistente si vedono in scheda E nel profilo dell\'app',
    dettaglio:
      '«Togli lo spuntino» (azione 3, 13/8 sera) scrive `ClientProfile.pastiEsclusi` e il motore lo rispetta, ma NESSUNA scheda lo mostrava: né backoffice né app. Lo stesso buco che avevano le allergie — un dato che agisce e non si vede è un dato che prima o poi qualcuno contraddice senza saperlo, e qui quel qualcuno era la cliente stessa che scriveva alla coach «mi manca un pasto». Chiuso il 14/8: il backoffice aveva già la riga, ora `/me/nutrition` manda `pastiEsclusi` (sempre un elenco, mai `null`) e il profilo dell\'app lo dice a parole — «Lo spuntino del mattino», mai il codice del motore — con la nota che risponde all\'unica domanda che quella riga fa nascere: le kcal di quel pasto sono ridistribuite sugli altri. Sola lettura: si cambia solo dettandolo all\'assistente. Modulo puro `app/src/lib/spuntiniEsclusi.ts`, 6 test app + 4 backend.',
    categoria: CODICE,
    ordine: 235,
    fatta: true, // chiusa il 14/8: backoffice (11/8) + profilo dell'app
  },
  {
    chiave: 'vera-famiglia-a-secco',
    titolo: 'Vera: «hai la lista dei formaggi molli?» e «crea la lista» funzionano',
    dettaglio:
      'Dalla prova di Nocanty (13/8, 17:47): il dizionario delle famiglie esisteva solo DENTRO una regola. Ora la consultazione («hai la lista dei…?» — l\'unica domanda che merita risposta, il filtro delle domande resta per le azioni) mostra l\'elenco, e «crea/rifai la lista dei…» apre l\'apprendimento a secco, che si chiude senza toccare nessuna cliente.',
    categoria: CODICE,
    ordine: 236,
    fatta: true, // consegnata la sera stessa
  },
  {
    chiave: 'vera-chat-dimensionabile',
    titolo: 'Vera: la finestra della chat si deve poter ridimensionare',
    dettaglio:
      'Richiesta di Simone (13/8 sera, dagli screenshot delle prove di Nocanty): oggi la chat è a altezza fissa (min(72vh, 640px), alzata ieri da 460). Renderla dimensionabile — trascinamento del bordo inferiore (CSS resize/handle) e altezza ricordata tra una visita e l\'altra. Pagina `backoffice/src/pages/Vera.tsx`.',
    categoria: CODICE,
    ordine: 237,
    fatta: true, // 14/8: bordo inferiore trascinabile, altezza ricordata (localStorage) — Vera.tsx
  },
  {
    chiave: 'vera-guida-giornata',
    titolo: 'Vera guida la giornata: «hai segnalazioni per me?» + campanella del capo sulla proposta nuova',
    dettaglio:
      'Richiesta di Simone (14/8 mattina, dallo screenshot: la domanda cadeva su «non ci arrivo»). Intento `segnalazioni` in `capisci.ts` (forme ancorate: «avvisi Giulia che…» resta un\'istruzione); il quadro si compone dalle tabelle di origine — segnalazioni CLINICHE IN TESTA (risposta di Simone in pagina Lavori), poi le altre, la coda del capo, le domande aperte, le sostituzioni, e la campanella (avvisi non letti, senza contare due volte le code) — e subito dopo Vera porta la prima cosa da fare. Una fonte rotta si dice («non lo so» ≠ «nessuno»). E il capo riceve la notifica `vera_proposta_in_coda` quando il team gli mette una proposta in coda (solo in-app; il conflitto sanitario resta l\'unico con email, e non fa doppia campanella). Decisione in `progetto/NOTA_Vera_Guida_Giornata.md`.',
    categoria: CODICE,
    ordine: 238,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'gaia-colazione-dolce-salata',
    titolo: 'Gaia: sul cambio colazione chiede «dolce o salata?» e filtra per i tag di Lucia',
    dettaglio:
      'Richiesta di Simone (14/8, dallo screenshot della chat di Antonio). Sul cambio della COLAZIONE senza preferenza detta, Gaia chiede il gusto e cerca nel pool certificato solo fra le colazioni taggate `piatto:dolce`/`piatto:salato` (le conferme di Lucia: senza tag non si partecipa), a pari calorie e con ingredienti diversi (le regole del cambio piatto). «Fa lo stesso» = senza filtro; due risposte non capite = senza filtro; niente dentro le calorie = si dice il gusto chiesto e si passa alla nutrizionista. «Una colazione proteica» NON fa la domanda. Decisione in `progetto/NOTA_Gaia_Colazione_Dolce_Salata.md`.',
    categoria: CODICE,
    ordine: 239,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'vera-cambio-dieta-cliente',
    titolo: 'Vera: «sposta Giulia sulla keto» — il cambio di dieta per una cliente, con «da quando?»',
    dettaglio:
      'Risposta di Simone (14/8, pagina Lavori) sulla variante di piano: la nutrizionista «sceglie una diversa dieta». Intento `cambio_dieta` (letto PRIMA della regola di dieta), dieta cercata nel catalogo (zero → nomi disponibili; più d\'una → si chiede), domanda «da quando?» («da subito» = rifaccio da domani; «lascia i giorni già preparati» = la nuova entra coi prossimi menu — flag `dietChangeKeepDeliveredDays` sulla porta della scheda), conferma, scrittura via `updateClient` (permesso `change_diet_type`, rierogazione già dentro, oggi e il passato MAI toccati). Registro `variante_cliente`. Decisione in `progetto/NOTA_Vera_Variante_Piano.md`.',
    categoria: CODICE,
    ordine: 240,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'vera-menu-dettati',
    titolo: 'Vera: la nutrizionista DETTA le combinazioni e crea menu specifici per una cliente',
    dettaglio:
      'Il secondo meccanismo della variante di piano (risposta di Simone, 14/8), fatto con la lettura B decisa da lui: si detta a parole e il sistema traduce. ⚠️ Il rischio della B — «pasta al pomodoro» sono cinque ricette con calorie diverse — si chiude con la regola di casa: una sola combacia → si propone; più d\'una → si CHIEDE, con le kcal accanto; nessuna → si dice. Si cerca solo nel pool certificato della cliente, si mostra il totale contro l\'obiettivo e sopra il ±15% NON si scrive; si tocca un giorno solo, e solo se non è ancora stato aperto. Decisione in `progetto/DECISIONE_Menu_Dettati.md`.',
    categoria: CODICE,
    ordine: 241,
    fatta: true, // 14/8: giornata-dettata.ts (puro) + flusso in vera-chat.service
  },
  {
    chiave: 'coach-task-push-escalation',
    titolo: 'Attività coach: push alla creazione + alla manager delle coach se restano da fare 24h dopo la scadenza',
    dettaglio:
      'Richiesta di Simone (14/8, dagli screenshot della pagina Attività coach). Oggi NESSUNA attività manda push (solo «piano in scadenza» e «ripresa peso» fanno campanella in-app). Da fare: (1) alla creazione l\'attività arriva alla coach anche via push, rispettando le preferenze; (2) se resta «da fare» 24 ore DOPO la scadenza (dueDate — confermato da Simone: «da quando andava fatta») va alla manager delle coach, una volta sola per attività (serve l\'idempotenza: campo `escalatedAt` o dedupe). Nell\'app coach ci sono già dashboard Attività e pagina Notifiche: nessun lavoro app.',
    categoria: CODICE,
    ordine: 242,
    fatta: true, // 14/8: push in ensureTask + escalateAttivitaScadute nel giro del cron (senza migrazione: la notifica è la memoria)
  },
  {
    chiave: 'menu-pasto-mancante-dal-ciclo',
    titolo: 'Il pasto che manca a una giornata si prende dalle settimane successive dello stesso ciclo',
    dettaglio:
      'Regola chiesta da Simone (14/8): «se settimana 2 digiuno intermittente giorno 2 mi manca la cena vado a cercare la cena nelle settimane successive con le giuste caratteristiche». Prima dell\'11/8 una giornata monca si serviva com\'era; dall\'11/8 si scartava intera. Ora, PRIMA di scartare, si ripara: stesso slot, dalle altre giornate della STESSA dieta e livello, guardando avanti per prime (poi indietro), mai un doppione nella giornata, e a parità comanda il target calorico. Le caratteristiche sono garantite dalla provenienza: il piatto è del catalogo di quella dieta, quindi esclusioni/allergeni/stagionalità restano a valle. Se resta monca, la scala di prima (gemella → segnalazione) vale identica. Ripiego dichiarato: log + evento `diet_day_repaired`. ⚠️ Il catalogo va comunque completato. Modulo puro `menu/ripara-giornata.ts`; decisione in `progetto/NOTA_Pasto_Mancante_Dalle_Settimane_Successive.md`.',
    categoria: CODICE,
    ordine: 243,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'vera-porta-i-girati-di-gaia',
    titolo: 'Vera porta le domande che Gaia gira alla nutrizionista, e la risposta parte da lì',
    dettaglio:
      'Richiesta di Simone (14/8): «anche queste notifiche devono arrivare attraverso l\'assistente, poi le lasciamo anche lì, ma da una parte o dall\'altra il nutrizionista risponde». La segnalazione resta dov\'è e si aggiunge una porta: `passaAllaNutrizionista` apre anche una richiesta Vera `girata_da_gaia` con chiave `gaia:<escalationId>` (idempotenza E legame, senza colonne nuove). Vera la porta in chat con la sua domanda (non l\'elenco di alimenti delle allergie); la risposta dettata arriva davvero alla cliente nel thread `nutritionist` (creato se non c\'è, firmato da chi ha dettato) e CHIUDE la segnalazione; «la vedo io» chiude la domanda senza scrivere; se la segnalazione è già stata chiusa dalla pagina la domanda non si fa più. Decisione in `progetto/NOTA_Vera_Porta_I_Girati_Di_Gaia.md`.',
    categoria: CODICE,
    ordine: 244,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'vera-cambi-da-verificare-in-chat',
    titolo: 'Vera porta i cambi concordati in chat e li fa verificare a voce (✓/✗)',
    dettaglio:
      'Decisione di Simone (14/8): la **A** — a voce passano solo ✓ e ✗, i grammi restano in scheda. Vera porta una riga per volta (ordinata per VOLTE, non per data: chiesta tre volte non è un caso), con cliente, piatto, da/a, quantità e quante volte; «va bene» la valida, «no» la annulla e tiene il motivo SOLO se lo dice lei (Vera non lo chiede: in scheda oggi il rifiuto non chiede niente). ⚠️ Il cuore della decisione: un numero dettato — anche dentro un sì, «sì, ma metti 30 g» — NON vale come conferma, non scrive niente e manda in scheda, perché 70 ml di panna sono ~200 kcal contro i ~630 di 70 g di olio. La scrittura passa da `FoodSwapsService.aggiorna`, lo stesso metodo del pulsante in scheda, e la riga si rilegge prima di scrivere (una collega può averla già guardata). Decisione in `progetto/DECISIONE_Verificare_Cambi_A_Voce.md`.',
    categoria: CODICE,
    ordine: 245,
    fatta: true, // consegnata il 14/8
  },
  {
    chiave: 'assistente-del-coach',
    titolo: 'Un assistente per il coach — NON SERVE (chiarito da Simone il 14/8)',
    dettaglio:
      '⚠️ Voce chiusa il giorno stesso in cui è nata: «non serve un assistente per le coach, alle coach devono solo arrivare le notifiche». Era una lettura mia troppo larga dello screenshot di «Attività coach». Le notifiche alla coach ci sono già e sono della stessa mattina (voce 242): push alla creazione di ogni attività ed escalation alla manager se restano da fare il giorno dopo la scadenza. L\'assistente resta della nutrizionista.',
    categoria: CODICE,
    ordine: 246,
    fatta: true, // non si fa: chiarimento di Simone, 14/8
  },
  {
    chiave: 'kcal-correzione-a-termine',
    titolo: 'La correzione calorica ha una durata: «−10% per 7 giorni e poi riprendi»',
    dettaglio:
      'Risposta di Nocanty al §15.2 punto 1 (13/8): «la percentuale la inserisco io nella scheda e memorizzi il mio cambiamento, esempio riduci le kcal del 10% per 7 giorni e poi riprendi col normale ritmo». La percentuale c\'era già dall\'11/8 (§15.5): mancava la durata. Campo nuovo `kcalAdjustUntil` (migrazione additiva, NULL = come prima), scadenza guardata al momento del calcolo (nessun cron azzera niente), ultimo giorno compreso, confronto per GIORNO. Il valore non si cancella alla scadenza: si spegne, e la spiegazione lo dice («fino al 21/8» / «è scaduta: si è tornati al ritmo normale»). Togliere la correzione toglie anche la data. Decisione in `progetto/NOTA_Correzione_Kcal_A_Termine.md`.',
    categoria: CODICE,
    ordine: 247,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'vera-detta-correzione-kcal',
    titolo: 'Vera: «riduci le kcal del 10% a Giulia per 7 giorni» dettato a voce',
    dettaglio:
      'La seconda metà della richiesta di Nocanty: «questa cosa vorrei farla anche dalla mia assistente». Il campo e la scadenza esistono dal 14/8 (voce 247) proprio perché la dettatura possa scriverli senza inventarsi una seconda strada. ⚠️ Tocca i numeri nel piatto: intento in `capisci.ts`, anteprima con il target PRIMA e DOPO (`kcalNeed.estimate` in simulazione), conferma, e la scrittura passa dalla porta che c\'è già (`impostaKcal`, coi suoi permessi, lo storico in `kcal_override` e il rifiuto sotto soglia). A mente fresca.',
    categoria: CODICE,
    ordine: 248,
    fatta: true, // 14/8: intento correzione_kcal + anteprima col numero vero + porta impostaKcal
  },
  {
    chiave: 'dizionario-promossa-conferma-capo',
    titolo: 'Dizionario promosso a comune: il capo conferma vedendo chi ne ha già una sua diversa',
    dettaglio:
      'Domanda di Nocanty (13/8) e risposta di Simone: «chiedi conferma al nutrizionista capo attraverso Vera». La convivenza RESTA (la voce personale vince sempre sulla comune, confermato) e nessuno viene sovrascritto; quello che cambia è che prima del sì il capo legge chi ha già una sua versione diversa, con nome e differenze (alimenti in più nella comune, alimenti che ha solo lei) — e la frase dice anche cosa NON succede: «le loro restano e continuano a valere». Confronto per radice (`chiaveAlimento`), chi ce l\'ha identica non compare. Decisione in `progetto/NOTA_Dizionario_Promosso_Conferma_Capo.md`.',
    categoria: CODICE,
    ordine: 249,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'vera-piu-proteine',
    titolo: '«Rifai con più proteine»: la quota proteica minima di UNA cliente',
    dettaglio:
      'La terza frase dell\'azione 3, decisa da Simone il 14/8 (opzione A del foglio `progetto/DECISIONE_Piu_Proteine.md`). La banda proteica esisteva già ma solo per DIETA (`menu_daycombo_protein_min`, pagina Regole motore): ora `ClientProfile.proteinMinPct` (migrazione additiva, NULL = vale la dieta) vince sul minimo — e SOLO sul minimo, il massimo resta della dieta. Vera la detta con l\'anteprima in percentuale («dal 20% al 30%»), lo scatto di scorta è +10 punti quando il numero non è detto, il tetto è 60%, e si rifanno solo i giorni futuri non ancora aperti. ⚠️ La banda è una penalità morbida nel ranking di DayCombo, non un filtro: un minimo alto non può lasciare una cliente senza cena.',
    categoria: CODICE,
    ordine: 250,
    fatta: true, // consegnata il giorno stesso
  },
  {
    chiave: 'lavori-pulsante-spunte',
    titolo: 'Lavori: il pulsante del rilascio mostrava solo le voci da AGGIUNGERE, non quelle da spuntare',
    dettaglio:
      'Trovato il 14/8 sera, sul vivo: tre consegne finite, zero voci nuove da aggiungere e tre da spuntare — la pagina rispondeva «non c\'è niente di nuovo da caricare» e **non mostrava nemmeno il pulsante Conferma**. Le spunte si sono dovute fare dalla shell di Render. Il server mandava già `spuntate` e `chiuse`: era la pagina a guardare solo `aggiunte`. ⚠️ Il nome del pulsante era parte del difetto — «Carica le voci nuove» diceva metà di quello che fa — ed è diventato «Aggiorna dal rilascio». Ora il riepilogo mostra le due liste separate (cosa aggiungerei, cosa spunterei, coi titoli e non con le chiavi) e ripete sempre che una voce già spuntata non viene mai riaperta.',
    categoria: CODICE,
    ordine: 251,
    fatta: true, // trovata e chiusa la sera stessa
  },
  {
    chiave: 'allergeni-reviewed-non-si-azzera',
    titolo: 'Cambiare gli ingredienti ora AZZERA gli allergeni confermati: gli allergeni vincono sulle modifiche',
    dettaglio:
      'Trovato nel codice il 16/8 scrivendo la voce 227, chiuso il 18/8 con la risposta di Simone: **«gli allergeni vincono sempre sulle modifiche; in caso venga data una sostituzione incompatibile va segnalato»**. Il difetto: `catalog.updateRecipe` scriveva `ingredients` **senza toccare** `allergensReviewed`. Una ricetta con gli allergeni confermati a cui qualcuno cambiava gli ingredienti restava `allergensReviewed: true` — con la firma di **prima**, data su un piatto diverso. Nessun errore, nessuna riga rossa, e `collegaRicetta` la lasciava entrare nelle diete perché il campo diceva di sì. Una conferma è una firma su un contenuto: cambiato il contenuto, la firma non vale più. ⚠️ **Decade sui NOMI degli ingredienti, non su qualunque salvataggio**, ed è il modo di applicare «vincono sempre» che protegge davvero: una quantità non può introdurre né togliere un allergene (80 g o 100 g di farina hanno lo stesso glutine), mentre azzerare per un peso corretto **toglierebbe il piatto dai menu** senza aggiungere un grammo di sicurezza. Quello che cambia gli allergeni è cosa c\'è dentro: un ingrediente aggiunto, tolto o rinominato. ⚠️ Il confronto è fra **insiemi di nomi** normalizzati: l\'ordine non conta (spostare una riga nel form non è una modifica), e stesso numero con uno scambiato **conta** — una scorciatoia sulla lunghezza della lista avrebbe lasciato passare farina→mandorle. ⚠️ E se gli ingredienti non si leggono, si azzera: su un campo di sicurezza «non ho capito» vale «non è confermato», mai il contrario. ⚠️ **Non è retroattivo**: vale dalla prossima modifica, quindi il catalogo non si svuota di colpo e la coda di «Allergeni ricette» si riempie al ritmo con cui qualcuno tocca le ricette. Chi salva lo **legge**: la pagina Ricette dice che la ricetta non entra più nei menu nuovi, dove si riconferma, e che i menu già consegnati non cambiano — e resta nel registro modifiche, perché chi un domani si chiede «perché questa ricetta è sparita dai menu?» deve trovare la risposta. **Sulla seconda metà della risposta** («sostituzione incompatibile va segnalato»): verificato, è già vero su tutt\'e due le porte — il dialogo di Gaia ferma il sostituto che tocca un allergene dichiarato e **passa la mano a una persona** (`sostituzione-chat.service.ts:795-802, 902`), e il pulsante «non gradisco» dell\'app sceglie i sostituti passando da `evaluateMeals`, che è il punto obbligato dove allergeni ed esclusioni si applicano. 15 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 252,
    fatta: true, // 18/8
  },
  {
    chiave: 'app-dati-che-non-legge',
    nata: '2026-08-16',
    titolo: 'App: restano DUE dati che il server manda alla cliente e nessuna schermata mostra (erano sei)',
    dettaglio:
      'Trovati il 16/8 con un giro sistematico su tutte le rotte `/me/*`, cercando il difetto già pagato tre volte in questo progetto — un dato che agisce e non si vede. **Chiusi:** i traguardi raggiunti e il guardrail del calo rapido (16/8); il popup delle valutazioni, che ricostruiva l\'elenco da `/me/menu` e riproponeva piatti già votati invece di leggere `GET /me/ratings/pending` (voce 269, 18/8); e il 18/8 gli ultimi due piccoli — **`since` di `/me/measurement-gate`**, che il backend manda da sempre e nessuno leggeva: il riquadro diceva «App in pausa», uno stato senza storia, e ora dice **da quanto** il menu è fermo («da ieri», «da 5 giorni», «da 2 settimane»), ⚠️ tacendo quando la data non c\'è invece di scrivere «da 0 giorni» — e **`thighsCm`**, la circonferenza cosce che lo staff poteva registrarle e che lei non avrebbe mai visto: il campo c\'era in banca dati, nel form del backoffice e nella risposta di `GET /me/measurements`, e si fermava all\'interfaccia TypeScript dell\'app. ⚠️ Ora la vede **e la può scrivere**: mostrarla soltanto avrebbe lasciato un dato sul suo corpo che governa solo lo staff. Niente barra «verso il tuo obiettivo» per le cosce, perché un `targetThighsCm` non esiste e inventarlo sarebbe una migrazione per una cosa che nessuno ha chiesto: una barra senza traguardo misura la distanza da niente. **⛔ RESTANO I DUE GROSSI, e quelli sì sono SCHERMATE NUOVE — vanno disegnate prima di scriverle: 1)** `GET /me/progress` non lo chiama nessuno — media mobile, chili persi, PROIEZIONE della data obiettivo, giorni di stallo — eppure il calcolo gira e lo leggono il motore e l\'allarme di stallo della coach: agisce su di lei ed è l\'unica a non vederlo. **2)** `GET /me/cycle` mai chiamato: le due cotture del ciclo, le stelle di gradimento (che decidono cosa il motore le ripropone) e l\'esito del ciclo precedente. **3) ✅ CHIUSO il 18/8** — `totalSafe` e `certificate` da `/me/personal-base`. ⚠️ La nota diceva «schermata nuova, va disegnata prima»: **era sbagliata**. Non serviva una schermata, serviva una riga nel Profilo **subito sotto le allergie** — perché è lì che nasce la domanda a cui quel numero risponde: ha appena letto le sue allergie e «le teniamo fuori dai menu sempre», e la domanda che segue è «e allora cosa mi resta?». Ora legge «148 ricette del catalogo sono state certificate sicure per te: il motore pesca solo da lì», con sotto, piccolo, il numero e la firma del certificato — la prova che la personalizzazione è avvenuta, che è la cosa che il prodotto promette. ⚠️ Tre stati: pronta → il numero; bloccata → il testo del socio; lettura fallita → **niente**, perché «0 ricette certificate sicure per te» detto per un errore di rete sarebbe falso e spaventoso. ⚠️ E «pronta con 0 ricette» non è pronta. Restano quindi **DUE**, e quelli sì sono schermate. ⚠️ **L\'analisi è FATTA, la sera del 18/8: `progetto/DECISIONE_Due_Schermate_App.md`** — non va rifatta. Dentro c\'è la scoperta che cambia la domanda sul primo dei due: `Obiettivo.tsx:465` calcola la barra «verso il tuo obiettivo» sull\'**ultima misura**, mentre `/me/progress` la calcola sulla **media mobile** — cioè non è una schermata mancante, sono **due risposte alla stessa domanda** sulla stessa cliente, e la seconda è quella che leggono il motore e l\'allarme della coach. Il lavoro vero è **togliere il conto locale**, non aggiungere una pagina. E sul secondo, due trappole trovate nel codice: ⚠️ `GET /me/cycle` **scrive** (`clientCycle.update/create` a ogni chiamata), e ⚠️ il campo `gradimento` **non è il gradimento** — è il minimo fra le ricette del ciclo del massimo delle loro stelle, con **default 5 quando una ricetta non è mai stata valutata**: mostrarlo come «il tuo gradimento» rifarebbe il difetto delle tre stelle inventate (voce 270) dentro una schermata. ⛔ Il foglio finisce con **cinque decisioni** (la proiezione della data obiettivo si mostra? i giorni di stallo? cosa del ciclo? il GET che scrive si separa?): il codice si scrive dopo.',
    categoria: CODICE,
    ordine: 253,
    // ⚠️ CHIUSI TUTTI E DUE il 19/8: `Obiettivo.tsx` legge `/me/progress` (e la barra non si
    // calcola più in locale sull'ultima pesata — era quello il lavoro vero), `Menu.tsx` legge
    // `/me/cycle` con le cotture e l'esito precedente, col `gradimento` lasciato fuori e la lettura
    // separata dalla scrittura.
    fatta: true,
  },
  {
    chiave: 'vera-handoff-sessione',
    titolo: 'Vera: il passaggio di consegne sta in progetto/HANDOFF_Vera_Sessione.md',
    dettaglio:
      'La chat in cui Vera è stata costruita (12-13/8) è diventata troppo lunga. Tutto quello che serve per riprenderla da un\'altra sessione — cosa c\'è, dove sta, le regole di lavoro, le trappole già pagate e le decisioni aperte — è in `progetto/HANDOFF_Vera_Sessione.md` (308 righe, verificato il 18/8). ⚠️ Va letto **prima** di toccare `backend/src/vera/`: metà delle scelte che sembrano strane lì dentro sono difetti già pagati una volta. Spuntata il 18/8: non è un lavoro da fare, è un cartello, e il cartello c\'è. Resta in elenco perché si legga.',
    categoria: MANUTENZIONE,
    ordine: 231,
    fatta: true, // 18/8 — il file esiste, questa voce è un cartello
  },
  {
    chiave: 'digiuno-catalogo-per-finestra',
    titolo: 'Digiuno: il catalogo servito lo decide la FINESTRA (Sonia riceveva un pasto al giorno)',
    dettaglio:
      'Trovato il 17/8 con `npm run diag:digiuni`: la variante `fasting: true` del catalogo ha tre slot FISSI (pranzo, merenda, cena) — è di fatto la variante «salta la colazione» e nessun campo lo dice — e l\'erogazione toglie da lì gli slot della finestra scelta. Chi salta la cena restava col SOLO PRANZO: Sonia (`<email di Sonia>`), il 45% delle sue calorie, e ⚠️ non lo segnalava niente, perché la rete di `dayComboPools` ferma la giornata vuota e non quella monca. Ora `pickDietFor` chiede un catalogo che ABBIA i pasti che la finestra promette (`catalog/struttura-per-digiuno.ts`, modulo puro): si spostano sul 5 pasti solo «salto la cena» e «salto il pranzo», che sono le due rotte. ⚠️ NON «il digiuno usa sempre il 5 pasti»: nel catalogo digiuno pranzo+merenda+cena valgono il 100% della giornata e nel 5 pasti il 70%, quindi le cinque clienti che stanno bene avrebbero perso un terzo delle calorie in silenzio. ⚠️ La scelta conta i pasti, non elenca le finestre: una riga nuova in `FINESTRE_DIGIUNO` è già coperta. La finestra è stata aggiunta a tutti e cinque i chiamanti di `pickDietFor`. 14 test, nessuna migrazione. Foglio: `progetto/NOTA_Digiuno_E_Riempimento_Varianti.md`.',
    categoria: CODICE,
    ordine: 254,
    fatta: true, // 17/8: consegnata; da confermare con `npm run diag:digiuni` dopo il deploy
  },
  {
    chiave: 'digiuno-porzioni-non-si-scalano',
    titolo: 'Le porzioni si scalano sul fabbisogno: Sonia dal 65% al 100%',
    dettaglio:
      'Chiusa il 18/8 con la decisione di Simone — **«va riproporzionato il pasto correggendo le quantità in base al fabbisogno»**, cioè la strada C del foglio `progetto/DECISIONE_Porzioni_Scalate_Strada_C.md`. Il buco: le ricette nascono dimensionate su una quota della giornata di catalogo (`menu_daycombo_kcal_target`, 1500), l\'erogazione punta al **fabbisogno**, e quando la finestra del digiuno toglieva dei pasti quello che restava **non si ingrandiva** — chi salta la cena riceveva il 65%, chi salta cena e colazione il 45%. Nuovo `menu/porzione-scalata.ts`: fattore **uniforme** con un **tetto per tipo di pasto** (principali ×1,8, colazione ×1,6, spuntini ×1,25, tutti in `config_param`). ⚠️ I tetti per tipo e non uno solo: a ×1,6 uno spuntino da 160 kcal diventa 256 e non è più uno spuntino. ⚠️ E chi non è al tetto cresce **della stessa percentuale** di chiunque altro non sia al tetto — il rapporto fra colazione e pranzo lo ha deciso la dieta, non noi. (Sulla giornata di Sonia: 509/200/891 con la regola giusta, 478/193/929 con la ridistribuzione «in proporzione al margine» che avevo scritto per prima e che un test ha bocciato.) ⚠️ **Non si rimpicciolisce mai**: scalare all\'ingiù toccherebbe il menu di tutte le clienti sotto i 1500 kcal, ed è una decisione clinica diversa da quella presa. ⚠️ La scalatura è **l\'ultimo passo prima della misura**: la giornata la riscrivono la ripetizione bigiornaliera, le «ricette semplici» e il cambio dei piatti non graditi, e tutti e tre ricostruiscono i pasti campo per campo — scrivendo il fattore prima, lo butterebbero via senza un errore. ⚠️ E `daily_kcal_below_target` cambia significato: da oggi vuol dire «resta corta **anche col moltiplicatore al tetto**», più raro e più grave. Toccati insieme: **kcal già scalate** nello snapshot (l\'app somma i totali da lì, in tre schermate: scrivere il fattore a parte le avrebbe rese sbagliate in silenzio), `kcalBase` e `porzione` accanto per non perdere l\'origine, la **lista della spesa** (sommava le grammature di catalogo: la cliente comprava il cibo della porzione piccola e a metà settimana finiva), la riga «porzione più abbondante ×1,8» nel menu dell\'app e la pastiglia «×1,8» nella scheda del backoffice. ⛔ **Cosa resta e va detto:** ~~la scheda ricetta mostra le grammature di catalogo~~ — **chiusa il 18/8 passandole giorno e slot, voce 280**; i giorni **già erogati** non si riscrivono (`menuDay.upsert` ha `update: {}`), quindi vale dai giorni nuovi; il kit di rientro copia `meals` così com\'è; e ⚠️ **i pezzi restano un problema aperto** — ×1,5 di una mela è una mela e mezza, e il numero vero esce così com\'è invece di essere arrotondato di nascosto: accettarlo o togliere le ricette a pezzo dalla scalatura è una decisione da prendere con la nutrizionista. 29 test nuovi. Nessuna migrazione. ⚠️ **E la revisione della notte ha trovato il caso vicino, corretto subito**: il cambio di **piatto** (`swapDislikedDishes`) scrive una sostituzione in cui `from` e `to` sono **nomi di ricetta**, non di ingrediente — dandola a `ingredientiEffettivi` senza dire niente, il suo ripiego «se non trovo l\'origine aggiungo il sostituto» faceva comparire nel carrello una riga che si chiama **«Riso e lenticchie»** in mezzo a farro e zucchine, e un pallino con lo stesso nome in fondo agli ingredienti della scheda. Adesso chi chiama sceglie (`seNonTrovato`): la chat `aggiungi` (le serve a non negare che quell\'alimento esista), la spesa e la scheda `salta`. Il ripiego era stato scritto per **un solo consumatore**, e spostare la funzione senza rileggerlo lo ha trasformato in un\'istruzione di acquisto.',
    categoria: CODICE,
    ordine: 255,
    fatta: true, // 18/8
  },
  {
    chiave: 'digiuno-finestra-mai-chiesta',
    titolo: 'Digiuno senza finestra: la domanda non era mai stata fatta — ora è un\'attività della coach',
    dettaglio:
      'Una cliente ha `pathType: intermittent_fasting` e `fastingWindow` **vuota**. ⚠️ Prima di tutto il resto: **il motore non è rotto**. Senza finestra non si salta nulla e riceve il 16:8 classico, che è il valore di scorta sensato — «dovrebbe ricevere tutti e cinque i pasti» era una frase del mio primo script, non una promessa fatta a lei (falso positivo corretto il 17/8). Il difetto è più difficile da vedere: la finestra decide **quali pasti mangia**, e per lei l\'ha decisa un valore di scorta. **La domanda non le è mai stata fatta.** Il questionario la fa, obbligatoria, dal 5-11/8 (`showIf` sul digiuno): chi si iscrive oggi la sceglie. Restavano fuori le clienti di prima. ⛔ Ho scartato di farla chiedere a Gaia: «quali pasti preferisci saltare?» arrivato a freddo, a chi mangia così da mesi, è una domanda che si risponde male — la risposta giusta dipende da come sta e da cosa le hanno detto in visita. Non è un dato da riempire, è **una conversazione da avere**, e il progetto ha già il posto dove una cosa da fare diventa lavoro di una persona: le attività della coach. Fatto: **1)** nuova attività «Chiedi a [nome] quali pasti salta nel digiuno», generata dal cron notturno per chi è in digiuno senza finestra **e ha un abbonamento attivo** (aprire un\'attività su chi ha finito il percorso mesi fa è il modo più rapido di insegnare alla coach a ignorare la colonna), con `refId` **fisso**: si chiede una volta sola, e se la coach la segna fatta non torna. ⚠️ Il testo dice **cosa succede intanto** — «NON è ferma e non è rotta, riceve tutti i pasti della sua dieta» — perché «manca la finestra» letto da solo suona come un guasto, e una coach che chiama allarmata una cliente che sta bene fa più danno del dato mancante. **2)** Nel backoffice la finestra vuota non si legge più «li decide la dieta», che sembrava una scelta: ora è «⚠️ mai chiesta — intanto riceve tutti i pasti della dieta». Tre stati, non due. **3)** Nell\'app, la card della finestra compariva coi pallini tutti spenti e nessuna spiegazione: ora dice che la domanda non c\'era quando si è iscritta, che intanto non le manca niente, e a cosa serve dirlo. ⚠️ E NON promette che le calorie del pasto saltato finiscono negli altri: non è vero finché la voce 255 è aperta. 8 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 256,
    fatta: true, // 18/8
  },

  {
    chiave: 'piani-attivi-scelta-per-date',
    titolo: 'Due piani attivi: la scheda mostrava quello IN CODA come piano corrente',
    dettaglio:
      '⚠️ La causa vera del caso Lorena, trovata il 17/8 e più precisa della prima ricostruzione: `pickMainSubscription` faceva `find(s => s.status === \'active\')` su una lista `createdAt desc`, quindi fra due righe attive vinceva **la più recente** — che era il piano in coda dal 25/08. La scheda scriveva «Inizio piano: 25/08» e la matita, che usa la stessa funzione, ha spostato quella riga: chi l\'ha aperta ha corretto una data sbagliata. Con lo stesso difetto, senza bisogno di `queued`: `menu.service` faceva `findFirst` **senza `orderBy`** (e da lì escono «piano concluso?» e fino a che giorno arrivano i menu: dipendeva dall\'ordine delle righe nella tabella), `pause.service` ordinava per `createdAt desc` (i giorni di pausa sommati al piano in coda: concessi e mai ricevuti), `coach.service` costruiva una `Map` che tiene l\'ultima riga. Ora la scelta è una funzione sola (`commerce/abbonamento-in-corso.ts`): chi eroga oggi, e fra due sovrapposti quello che finisce più tardi — ⚠️ non «cominciato prima», perché la cliente ha pagato fino alla fine del secondo. ⚠️ Le date sono obbligatorie nel tipo, e il compilatore ha trovato subito un cast in `clients.service` che le buttava via. 18 test, nessuna migrazione. Foglio: `progetto/NOTA_Chi_Sta_Erogando_Adesso.md`.',
    categoria: CODICE,
    ordine: 257,
    fatta: true, // 17/8: consegnata, test visti rossi prima
  },
  {
    chiave: 'queued-stato-abbonamento',
    titolo: '«In coda» è uno STATO — prima metà consegnata il 18/8: lo stato esiste e le letture lo capiscono',
    dettaglio:
      'La causa che resta dopo la voce 257. Un piano messo in fila si scrive `active` con inizio nel futuro, e da questa scelta discende tutto: il database non può vietare due attivi (due attivi sono legittimi), la scheda mostra due «Attivo» identici, e la matita non sa che sta disfacendo una coda. Migrazione **additiva** (un valore in più nell\'enum), `finalizeApproval` scrive `queued`, e un lavoro giornaliero dentro `daily` promuove a `active` i `queued` la cui data è arrivata. ⚠️ **CORREZIONE del 18/8: il censimento del 17/8 diceva 47 letture e ne mancavano parecchie — rifatto, sono circa NOVANTA.** Quello vecchio diceva: **47 letture** di `status: \'active\'` su `Subscription` — 27 «solo active», 15 «anche queued», 5 da decidere (`coach-tasks:201`, `coach:104`, `commerce:1408`, `commerce:1431`, `dashboard:148`), più 5 filtri fatti in memoria. Il pattern: ogni query che filtra **anche sulle date** è solo-active; ogni query che chiede «ha già comprato / ha convertito» va estesa a `queued`, e sono quelle già scritte `status: { in: [\'active\',\'pending\'] }`. ⚠️ Il vincolo in banca dati **non** va nella stessa consegna dello stato: prima lo stato vive e si vede che nessuno è finito nel posto sbagliato. Decisione di Simone (17/8): un piano in coda **conta** come «ha un piano» nelle schermate dello staff, perché è un contratto. ✅ **CONSEGNATA il 18/8 la prima metà**: migrazione additiva, il vocabolario delle quattro domande in `commerce/stati-abbonamento.ts` (⚠️ le letture non chiedevano tutte la stessa cosa: «chi eroga oggi», «ha un piano», «ha già comprato», «c\'è qualcosa in ballo» — finché la coda si scriveva `active` le quattro risposte coincidevano per caso), tutte le letture aggiornate, e `abbonamento-in-corso.ts` che riconosce **le due forme** della coda (lo stato nuovo e le righe vecchie `active` con la partenza nel futuro). ⚠️ **Nessuno scrive ancora `queued`**: la scrittura, la promozione giornaliera e il vincolo sono in `stato-in-coda-scrittura`.',
    categoria: CODICE,
    ordine: 258,
    fatta: true, // prima metà, 18/8 — la scrittura è in `stato-in-coda-scrittura`
  },
  {
    chiave: 'matita-avvisa-sovrapposizione',
    titolo: 'La matita delle date dice cosa sta per rompere',
    dettaglio:
      'Se la data nuova fa sovrapporre questo piano a un altro non concluso, si chiede conferma **con le parole giuste** e si registra chi ha confermato. ⚠️ **Conferma e non divieto**: chi gestisce le schede a volte deve davvero forzare, e un divieto secco si aggira facendo peggio (una riga a mano nel database, che non lascia traccia). §4b di `progetto/NOTA_Due_Piani_Attivi_Lorena.md`. ✅ CONSEGNATA il 17/8 sera: `clients/sovrapposizione-piani.ts` (modulo puro) dice quali piani lo spostamento farebbe sbattere e compone la frase; `updatePlanStart` la restituisce come **409**, cioè lo stesso meccanismo dell\'altro avviso della stessa matita («con questa data il piano risulta già finito»), e la pagina non ha avuto bisogno di una riga: il suo 409 era già generico. ⚠️ La frase dice **tre** cose, e sono le tre che il 16/8 non c\'erano: contro cosa si va a sbattere col NOME, quando quello arriva o finisce, e cosa succede alla cliente — «i menu glieli darà uno solo dei due (quello che finisce più tardi) e i giorni dell\'altro scorreranno senza che riceva niente», che è la conseguenza vera secondo `attivoInCorso`, non un generico «attenzione». ⚠️ Il giorno del passaggio di testimone **è** una sovrapposizione (fine compresa): è il giorno in cui arrivano due menu. ⚠️ Una fine assente è un piano **aperto** e si sovrappone a tutto quello che viene dopo; un `cancelled`/`expired`/`pending` non conta (un pending è un carrello), e nemmeno un `active` con la fine già passata. ⚠️ **Chi supera l\'avviso finisce nel registro** (`sovrapposizioneConfermata` nell\'audit, coi piani coinvolti): senza quella riga, fra un mese una sovrapposizione si rilegge come un difetto del software invece che come una decisione presa. 18 test (15 sul giudizio e sulla frase, 3 sul collegamento: il 409 non scrive niente, `conferma: true` scrive e registra, una data innocua non chiede niente).',
    categoria: CODICE,
    ordine: 259,
    fatta: true, // 17/8 sera
  },
  {
    chiave: 'kcal-giornata-sotto-target-segnale',
    titolo: 'Una giornata sotto il fabbisogno usciva identica a una giusta: ora lo dice',
    dettaglio:
      'Trovato il 17/8 scrivendo il foglio delle porzioni (voce 255), ed è la Consegna 1 di quel foglio — quella che non aspetta nessuna decisione. `menu_kcal_balance_tolerance_pct` (default 15%) esisteva già ma era usata come **filtro** e non come **controllo**: `DayCombo` scarta le combinazioni fuori banda e, quando non ne resta nessuna, torna `null`; da lì `deliverIfEligible` compone col selettore per-slot ed **eroga comunque, senza una riga di log**. Una giornata al 65% del fabbisogno — Sonia, finestra «salto la cena» — usciva identica a una giusta. ⚠️ Nello stesso file, per i **pasti** mancanti, il segnale era stato costruito il 17/8 (`fasting_meals_missing` + `diag:digiuni`): per le **calorie** non esisteva l\'equivalente, ed è la stessa domanda sullo stesso codice. Ora un modulo puro (`menu/giornata-sotto-target.ts`) dà il giudizio e `deliverIfEligible` scrive un `logger.warn` con la giornata peggiore e un `analyticsEvent` **`daily_kcal_below_target`** con tutte: target e sua provenienza (fabbisogno o livello), tolleranza, kcal e quota del target per giornata, slot non erogati, finestra, `pastiEsclusi`, dieta. ⚠️ **Non blocca niente**, come `fasting_meals_missing`: una giornata scarsa è meglio di nessun menu, e il rimedio (le porzioni scalate, strada C) non è nelle mani di chi apre l\'app. ⚠️ **Un evento per erogazione, non uno per giorno**: `deliverIfEligible` gira a ogni apertura dell\'app, e un evento per giornata farebbe contare le aperture invece delle giornate. ⚠️ Il controllo sta **dopo** la ripetizione bigiornaliera, le «ricette semplici» e il cambio dei piatti non graditi — sono tre passaggi che riscrivono la giornata, e prima di loro i pasti non sono ancora quelli che la cliente riceverà. ⚠️ La soglia è la STESSA che il motore usa per comporre, e non una costante nuova: due soglie sulla stessa domanda divergerebbero in un pomeriggio (è già successo il 17/8 fra il motore e `diag:digiuni`). 22 test, nessuna migrazione.',
    categoria: CODICE,
    ordine: 260,
    fatta: true, // 17/8 sera: consegnata, test visti cadere per mutazione (10 sul giudizio, 1 sul collegamento)
  },
  {
    chiave: 'annullamento-permesso-dedicato',
    titolo: 'Il × per annullare un piano non si vedeva dal capo nutrizionista',
    dettaglio:
      'Il pulsante è nato il 17/8 con `@Roles(\'admin\')`, «come lo storno e la cancellazione di un acquisto, che sono i suoi vicini di casa per gravità». La gravità era giusta, il cancello no: chi gestisce i piani ogni giorno è il **capo nutrizionista**, e dalla sua utenza il × non compariva nemmeno. ⚠️ L\'unica strada era entrare come admin — cioè fare la cosa grave con l\'utenza sbagliata, e nel registro dell\'annullamento resta scritto «admin» invece del nome di chi ha deciso. Ora la rotta chiede la chiave della matrice `cancel_subscription` in gestione (`@RequirePage`), **di default solo admin**: gli altri li abilita Simone dalla tabella dei permessi, senza un rilascio. È lo stesso passaggio fatto l\'11/8 per «Entra come» (`impersonate`). ⚠️ Nel backoffice il pulsante era legato a `isAdmin`, che in quella pagina vuol dire «vede la pagina Permessi» e non «è admin»: cambiare solo il backend non l\'avrebbe fatto comparire a nessuno. ⚠️ Il permesso nasce con `view: true` e non solo `manage`, perché `getForRole` filtra su `canView` e un `manage` senza `view` non arriverebbe mai al frontend. 5 test **sui decoratori**, che è l\'unico posto dove «chi può bussare» si vede senza avviare l\'applicazione (la lezione di `chat/guardie-rotte.spec.ts`).',
    categoria: CODICE,
    ordine: 261,
    fatta: true, // 17/8 sera
  },
  {
    chiave: 'pastiglie-piano-inizio-o-fine',
    titolo: 'Due piani attivi, due pastiglie identiche: ora dicono chi eroga e chi è in coda',
    dettaglio:
      'L\'ultimo pezzo visibile del caso Polidoro. In scheda cliente le pastiglie dei piani scrivevano tutte «Piano · Attivo» più la **data d\'inizio**: con due righe attive erano indistinguibili, e l\'unica differenza stava nel tooltip — che a sua volta poteva mostrare un «+7 giorni» calcolato per la finestra dei menu, non una fine vera. Ora `getDetail` manda per ogni abbonamento `inCorso` e `inCoda`, calcolati con `commerce/abbonamento-in-corso.ts` (`staErogando`/`eInCoda`), e la pastiglia dice **«In coda · dal 25/08»** oppure **«Attivo · fino al 25/08»**. ⚠️ La data mostrata cambia perché è quella che serve a distinguerli: di chi eroga interessa **fino a quando** arrivano i menu, della coda **da quando** partirà. ⚠️ Il giudizio NON è stato riscritto nel browser: sarebbe stata la quinta definizione di «chi sta erogando» (le altre le usano motore, pause, coach e `pickMainSubscription`), e il 17/8 due definizioni della stessa domanda sono divergite nello spazio di un\'ora. ⚠️ La fine si scrive solo se esiste: senza scadenza la pastiglia dice «senza scadenza» invece di inventare una data. 4 test sul contratto che il DTO consuma (i due flag non possono essere veri insieme; un `active` con la fine passata non risulta in corso). ⛔ Il DTO stesso e la pagina restano senza test: `getDetail` non ha spec e il backoffice non ha infrastruttura di test.',
    categoria: CODICE,
    ordine: 262,
    fatta: true, // 17/8 sera
  },
  {
    chiave: 'gusti-dalla-scheda-ripuliti',
    titolo: 'I gusti scritti dalla scheda passavano diritti in banca dati (quarta volta)',
    dettaglio:
      'Stessa riga, quarta ripetizione: `latte` che non si espandeva (8/8), `frutta_a_guscio` (12/8), il tag `"Carne .ceci"` che non escludeva niente (17/8). ⚠️ Ogni correzione ha coperto **il percorso da cui era arrivata la segnalazione**, e questo — la scheda della nutrizionista — era quello rimasto fuori: `updateClient` riempie `profileData` **ciecamente** per tutte le `PROFILE_FIELDS`, e la scheda manda una stringa spezzata sulle **sole virgole**. Ora `dislikedFoods` passa da `filtraSpezie` (che **spezza prima di classificare**) e `intolerances` perde i **non-alimenti** (`altro`, `other`, `nessuna`…) come nel questionario. ⚠️ **Due liste, due regole**: un\'intolleranza NON si spezza (è un codice o un termine clinico, «frutta a guscio» non va spaccata) e il cancello spezie non la tocca, perché quella è sicurezza e non gusto. ⚠️ **Le spezie scartate si dicono a chi ha premuto Salva** (`avvisiSpezie` nella risposta, mostrato nel banner della scheda): la risposta della PATCH prima si buttava via, e un «Scheda aggiornata.» che nasconde una riga non scritta fa riscrivere la stessa riga la volta dopo. ⚠️ E la **bonifica** (`npm run pulisci:spezie`) ora passa dalla stessa funzione: prima valutava il termine INTERO, quindi «pepe, ceci» le sfuggiva — ora spezza, e ripulisce anche le liste che cambiano solo forma, che sono le clienti per cui il difetto era invisibile. 10 test su cosa arriva davvero nell\'upsert, visti cadere per mutazione (2 e 2). Nessuna migrazione.',
    categoria: CODICE,
    ordine: 263,
    fatta: true, // 17/8 sera
  },
  {
    chiave: 'gaia-chiude-le-conversazioni-lasciate-a-meta',
    titolo: 'Gaia ripeteva la stessa domanda all\'infinito a chi non rispondeva: ora la chiude lei',
    dettaglio:
      'Segnalato da Simone il 18/8 con la chat di una cliente sotto gli occhi: tre volte di fila «Certo [nome], vediamo insieme. Quale alimento vuoi cambiare?», il 10/8 alle 13:07, l\'11/8 alle 16:00 e ancora — e in mezzo **nessuna risposta**. ⚠️ Ma non era Gaia che insisteva, e la ricostruzione conta perché cambia il rimedio: **nessun cron scrive quel messaggio**, lo scrive il pulsante «Sostituisci» della home (`POST /me/threads/sostituzione`). Erano tre **aperture**: la cliente tocca, legge — nel messaggio c\'è anche il menu del giorno, che è metà del motivo per cui uno lo tocca — e se ne va. Lo stato del dialogo scade dopo un\'ora (`SCADENZA_FLUSSO_MS`), quindi l\'apertura dopo riparte da zero e **non sa** di aver già chiesto. Ora una domanda rimasta senza risposta per 24 ore la chiude Gaia: «capisco che l\'argomento non sia più di tuo interesse, chiudo qui — se cambi idea tocca «Sostituisci» quando vuoi». ⚠️ Chiude il **tempo**, non un altro tocco del pulsante: la strada alternativa (alla terza apertura rispondere con la chiusura) le direbbe «capisco che non ti interessa più» **nell\'istante in cui sta chiedendo**. E chiudendo a tempo la seconda domanda identica non arriva nemmeno. ⚠️ Nessuna tabella nuova: il marcatore **è la riga** — il messaggio di chiusura non porta `meta.sost`, quindi chiude il dialogo e insieme impedisce di richiudere la stessa conversazione domani notte. ⚠️ Due guardie sul primo giro dopo il rilascio, che trova tutto l\'arretrato: finestra di **30 giorni** all\'indietro (svegliare qualcuno per una domanda di marzo non è chiudere una conversazione, è aprirne una) e **tetto di 100 per giro, dichiarato nell\'esito** — un tetto silenzioso fa sembrare finito un giro che ne ha lasciate indietro cento. Soglia in `config_param` (`chat_chiusura_silenzio_ore`, 24). Passo del cron notturno, non dei `reminders` che girano ogni dieci minuti: questo scrive alla cliente. 26 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 277,
    fatta: true, // 18/8
  },
  {
    chiave: 'generatore-catalogo-monitoraggio',
    titolo: 'Il generatore di ricette: un battito a ogni giro, `diag:catalogo`, e il riquadro in cima alle Ricette',
    dettaglio:
      'Due domande di Simone del 18/8, e la seconda è quella che conta. La prima: «come facciamo a sapere se sta lavorando?». La riga nel registro (`engine_rule.preset.generate_catalog`) la lasciava solo la generazione **riuscita**, quindi ⚠️ i tre motivi per cui un giro finisce a mani vuote avevano lo **stesso aspetto — nessuna riga**: catalogo completo (tutto bene), AI fuori uso o credito finito (si riproverà, o mai più), e ⛔ **cron spento su Render** (non gira, e non lo dice nessuno). Il terzo è quello che fa danno, perché un cron che non parte non lascia traccia da nessuna parte. Fatto: **① un battito** `cron.genera_catalogo` scritto **sempre**, col motivo e con l\'errore, in un `try` a parte (perdere una generazione per un battito sarebbe il rimedio peggiore del male); **② `npm run diag:catalogo`**. La seconda domanda è arrivata subito dopo: **«non ho capito da dove vedo se le ricette vengono create»** — e aveva ragione: ⚠️ **una shell non è vedere**, e una diagnostica che nessuno lancia è una diagnostica che non esiste. Quindi **③ un riquadro in cima alla pagina Ricette** con le stesse informazioni, dove si guardano già: ultimo giro ed esito, ricette nate negli ultimi 7 giorni, quante aspettano gli allergeni (**col collegamento**, perché finché sono lì non entrano in nessuna dieta), giri ed errori, settimane rimaste. ⚠️ Il giudizio sta in `stato-generatore.ts` con cinque esiti distinti — `mai_partito`, `lavora`, `niente_da_fare`, `errore`, `fermo` — e **«mai partito» non è «tutto a posto»**: dice di andare a guardare su Render, non nel codice. ⚠️ «Fermo» vince sull\'esito: se l\'ultimo giro è di tre giorni fa, che sia andato bene non importa più. ⚠️ E questo riquadro **non sparisce quando va tutto bene**, a differenza degli altri: la domanda a cui risponde è «sta lavorando?», e un riquadro che compare solo quando c\'è un problema risponde «non lo so» proprio a chi viene a controllare. 12 test. Nessuna migrazione.',
    categoria: MANUTENZIONE,
    ordine: 279,
    fatta: true, // 18/8
  },
  {
    chiave: 'dashboard-moduli-nessuno-fisso',
    titolo: 'Dashboard: nessun modulo è fisso, i predefiniti si riconoscono e c\'è «Ripristina default»',
    dettaglio:
      'Risposta di Simone del 18/8, parola sua: «non esistono blocchi fissi in dashboard, tutti sono attivabili o spegnibili e si possono riorganizzare; solo che abbiamo quelli di default che nella lista moduli sono evidenziati da un colore diverso, poi se un utente si è perso preme il pulsante (ripristina default) e noi provvediamo». ⚠️ È la risposta giusta al problema dei blocchi fissi, e vale la pena dirla: invece di **togliere** a qualcuno la possibilità di spegnere un riquadro «perché poi non lo ritrova più», gli si dà **la strada di ritorno**. Un pulsante che rimette le cose a posto vale più di un divieto — e sapere che una scelta si può disfare cambia quanto si è disposti a provarla. Le prime due parti c\'erano già (tutti i moduli si accendono, si spengono e si trascinano); mancavano le altre due. Fatto: i **predefiniti** hanno il bordo colorato e la scritta «predefinito» nell\'elenco attivo, e la pastiglia colorata fra quelli da aggiungere; nuovo pulsante **«Ripristina default»** in cima al riquadro. ⚠️ Il pulsante **chiede conferma con se stesso** («Sicuro? Premi di nuovo») invece che con un pop-up: spegne e riaccende moduli, e un clic per sbaglio disferebbe la disposizione che qualcuno si è costruito.',
    categoria: CODICE,
    ordine: 278,
    fatta: true, // 18/8
  },
  {
    chiave: 'niente-email-clienti-nel-repository',
    titolo: 'Le email di otto clienti erano nei file del repository (e il repository è pubblico)',
    dettaglio:
      'Trovata il 18/8 controllando \'altro\': gli indirizzi di **otto clienti reali** erano scritti in **21 file versionati** — registri, handoff, commenti del codice e tre file di test — arrivati lì un po\' per volta, ogni volta con la buona ragione di «così si capisce di chi si parla». ⚠️ Il problema non è l\'email da sola: accanto c\'erano **nome, finestra del digiuno, fabbisogno calorico, cibi non graditi**. Email + nome + dato sulla salute è la categoria che il GDPR protegge di più (art. 9), su un repository **pubblico**. ⚠️ E ci ho messo del mio: il 17/8 sera ho scritto io un indirizzo in `COMMIT_parte_bonifica_solo_email.txt`, seguendo la convenzione che trovavo nei file senza fermarmi a chiedermi se fosse giusta. Fatto: le 37 occorrenze sostituite con il **nome di battesimo** (Sonia, Maria, Giusy, Patty, Simona, Lorenzo, Gioia, Ilaria), i comandi d\'esempio con un segnaposto (`cliente@esempio.it` negli script, `<email di Nome>` dove serve sapere di chi si parla), e via anche i **cognomi** dei clienti (\'Lorena Polidoro\' → \'Lorena\'). ⚠️ **Ripulire i file non toglie il dato dallo storico**: `git log -p` ce l\'ha ancora. Le due strade che chiudono davvero sono **rendere privato il repository** (immediata, un clic) o **riscrivere lo storico** con `git filter-repo` (invasiva: cambia tutti gli hash, chi ha un clone deve riclonare) — ⛔ è una scelta di Simone. Nuovo `common/email-nei-file.ts` + una guardia che passa in rassegna i file versionati e **diventa rossa** se un indirizzo di un dominio di posta vero rientra: la regola non deve dipendere dalla memoria di nessuno. 8 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 276,
    fatta: true, // 18/8
  },
  {
    chiave: 'lavori-testo-non-aggiornato',
    titolo: '«Aggiorna dal rilascio» non riscrive il testo delle voci già in elenco: adesso lo dice',
    dettaglio:
      'Nato da una domanda di Simone del 18/8 — «la lista lavori la stai tenendo allineata?» — e la risposta onesta era **sì per il file, no per la pagina**. `caricaVociIniziali` fa due cose: **crea** le voci mancanti e **spunta** quelle che il file dà per finite. Il **testo** no: quando nel file un titolo o un dettaglio cambiano — e succede a ogni giro, perché una voce si riscrive quando si scopre la causa vera — in pagina resta la versione di prima, e chi legge crede di leggere l\'ultima parola. Era un aggiornamento che non arriva e nessuno lo dice: la stessa famiglia di tutto il resto. ⚠️ **Non si riscrive di nascosto**, perché la pagina è **lo stato vivo** e una voce può essere stata corretta a mano dal backoffice: si **mostra**. Il riepilogo del pulsante ora elenca le voci il cui testo nel rilascio è più recente, dicendo che qui non viene riscritto — e il messaggio «non c\'è niente da allineare» non compare più quando invece c\'è qualcosa da sapere. 3 test. ⚠️ Se poi si vuole che il file **riscriva** anche il testo, quella è la voce 275: serve prima decidere cosa fare di una voce corretta a mano in pagina.',
    categoria: CODICE,
    ordine: 274,
    fatta: true, // 18/8
  },
  {
    chiave: 'lavori-file-riscrive-il-testo',
    titolo: 'Il rilascio ora riscrive il testo delle voci — tranne quelle corrette a mano da qui',
    dettaglio:
      'Chiusa il 18/8. ⚠️ **La domanda era scritta male**, e Simone l\'ha detto («non capisco la domanda»): era posta da dentro il codice invece che dal caso vero. Il caso vero è questo — la pagina tiene **la sua copia** del testo di ogni voce, e «Aggiorna dal rilascio» aggiungeva e spuntava senza toccare il testo di quelle già in elenco. Una voce si riscrive **a ogni giro**, perché si riscrive quando si scopre la causa vera di un difetto: in pagina restava la ricostruzione sbagliata, e chi la leggeva credeva di leggere l\'ultima parola. ⚠️ **L\'esempio che l\'ha deciso**: la bonifica delle email del 18/8 ha ripulito il file, e nell\'estratto della pagina l\'indirizzo di una cliente era ancora lì. Ora il testo si riscrive — ⛔ **tranne** dove l\'ha scritto una persona dal backoffice: quelle non si toccano e si dicono a parte, perché una correzione fatta a mano che sparisce al rilascio dopo, in silenzio, sarebbe lo stesso difetto spostato di un metro (ed è la pagina che serve a non farlo succedere altrove). Colonna nuova `testo_a_mano`, additiva con default: nessuna riga esistente cambia comportamento. ⚠️ `updatedAt` **non bastava**, ed è il motivo per cui serve una colonna: lo muovono anche la spunta e la risposta, quindi una voce spuntata sarebbe risultata «toccata a mano» e avrebbe smesso di aggiornarsi — il difetto sarebbe tornato, solo più difficile da vedere. ⚠️ Si riscrivono **solo titolo e dettaglio**: `categoria` e `ordine` restano dove qualcuno li ha messi in pagina, perché riscriverli sposterebbe le voci sotto gli occhi di chi le sta guardando. Il riepilogo del pulsante ora dice tutt\'e due le cose: quali aggiorna e quali lascia stare. 3 test. Migrazione additiva `20260818120000_lavoro_testo_a_mano`.',
    categoria: CODICE,
    ordine: 275,
    fatta: true, // 18/8
  },
  {
    chiave: 'catalogo-una-taglia-sola',
    titolo: 'La taglia del catalogo si calcola sulla mediana del fabbisogno delle clienti',
    dettaglio:
      'Chiusa il 18/8 con la risposta di Simone: **«la taglia calorica va calcolata sulla base del fabbisogno della cliente»**. Il difetto, verificato nel codice e non dedotto dai numeri: il generatore scriveva ogni pasto come `menu_daycombo_kcal_target × quota`, e quel parametro era un numero **fisso** (1500, 1600-1800 in tre preset), mentre l\'erogazione punta al **fabbisogno**. ⇒ ⚠️ chi ha un fabbisogno sopra ~1765 kcal (1500 ÷ 0,85, il bordo della banda) riceveva giornate fuori banda **per costruzione, tutti i giorni** — e per lei nessun moltiplicatore di porzione cambia il fatto che le ricette sono scritte più piccole. Ora `tagliaPerIlCatalogo` prende il fabbisogno delle clienti **in corso** che quel preset descrive (stesso regime, obiettivo, struttura di pasti) e ne fa la **mediana**. ⚠️ **La mediana e non la media**, ed è tutto il modulo: una cliente a 3200 in mezzo a dieci a 1600 sposterebbe la media a 1745 e il catalogo con lei — dieci persone riceverebbero piatti pensati per una. La mediana è la persona in mezzo, e non si lascia spostare da un caso estremo. ⚠️ **Tre stati**: senza nessuna cliente calcolabile resta la taglia del preset **e si dice il motivo**, perché un numero calcolato sul nulla ha lo stesso aspetto di un numero calcolato bene. ⚠️ E si conta **quante restano fuori banda anche con la taglia scelta**, in tutt\'e due i versi — chi sta molto sopra riceve poco, chi sta molto sotto riceve troppo, e contare solo i primi farebbe sembrare che alzare la taglia non costi niente. È il numero che dice se serve una **seconda taglia** (`Diet.levels` nasce per quello, e il livello 2 non è mai stato usato): la domanda resta aperta, ma da oggi ha una cifra davanti invece di un\'impressione. ⚠️ **Vale solo per le bozze nuove**: le diete già approvate e i menu già erogati non cambiano, e la taglia arriva nel piatto quando la nutrizionista **approva** il catalogo generato — cioè con una persona in mezzo. Interruttore in `config_param` (`catalogo_taglia_dal_fabbisogno`, acceso): se qualcosa non torna si spegne senza un rilascio, e si torna al numero del preset. 12 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 273,
    fatta: true, // 18/8
  },
  {
    chiave: 'diag-porzioni-retroattiva',
    titolo: '`npm run diag:porzioni`: misura le giornate GIÀ erogate, senza aspettare che qualcuno apra l\'app',
    dettaglio:
      'Nata da un\'esecuzione vera: `diag:kcal` legge gli **eventi** che l\'erogazione scrive quando eroga, quindi risponde solo per chi ha aperto l\'app dopo il rilascio del segnale — e alla prima prova, giustamente, non sapeva niente (voce 271). Questa guarda invece i **giorni già in banca dati** e risponde subito. ⚠️ Il giudizio **non è riscritto**: chiama `giornateSottoTarget`, la stessa funzione del motore, e il target lo calcola `KcalNeedService`, la stessa classe che usa l\'erogazione — allo script si passa solo la porta per leggere i `config_param`. Due risposte diverse sarebbero un difetto, non un metodo diverso: è la lezione del 17/8, quando motore e `diag:digiuni` si sono contraddetti in un pomeriggio. Stampa per cliente il **perché** (finestra del digiuno, spuntini tolti, o «è il catalogo»), la **quota peggiore**, il **fattore necessario** e se il tetto che stai provando basta — cioè i numeri con cui si rispondono le due domande cliniche della voce 255. ⚠️ Dice **due limiti** invece di lasciarli dedurre: si confrontano giornate già erogate col fabbisogno di **oggi** (se peso o obiettivo sono cambiati, il numero di ieri è misurato col metro di adesso — va bene per scegliere un tetto, non per dire a una cliente cosa ha mangiato), e le clienti **senza fabbisogno calcolabile** (mancano sesso, età, altezza o peso) si contano a parte, perché per loro il motore usa le kcal del livello e da lì non si vede: non è un ✓, è un «non lo so». `TETTO=`, `GIORNI=` e `SOLO=<email>` come le altre. Nessuna scrittura, nessuna migrazione. ⚠️ **Corretta il 18/8 dopo la prima lettura in produzione**, due cose: la colonna «col tetto» giudicava contro il **100%** e non contro la **banda** — con `TETTO=1.6` una cliente al 60% arriva al 96% e leggeva «NON basta», facendo sembrare quel tetto peggiore di quanto sia; e mancavano i numeri che spiegano il caso (**target**, **kcal della giornata più corta**, **sesso**), senza i quali non si capisce se una giornata è corta per la finestra o perché il catalogo è dimensionato più in basso del fabbisogno di quella persona. ⚠️ La prima lettura vera, su 84 giornate e 18 clienti, ha detto proprio questo: **quattro dei cinque casi sono «nessuna esclusione: è il catalogo»**, cioè il moltiplicatore di porzione lì non è la cura giusta.',
    categoria: MANUTENZIONE,
    ordine: 272,
    fatta: true, // 18/8
  },
  {
    chiave: 'diag-kcal-tre-stati',
    titolo: '«Nessuna giornata sotto il fabbisogno ✓» diceva ✓ anche quando non lo sapeva',
    dettaglio:
      'Trovato **alla prima esecuzione in produzione**, il giorno dopo aver scritto `diag:kcal` (voce 268): zero eventi, e lo script ha stampato «Nessuna giornata sotto il fabbisogno negli ultimi 14 giorni ✓». ⚠️ Quel ✓ non era vero, era **«non lo so»**: il segnale scatta **all\'erogazione**, e l\'erogazione gira quando la cliente apre l\'app — senza consegne nella finestra, zero eventi non dice niente sulle calorie di nessuno. Una diagnostica che mostra la faccia del «va tutto bene» quando non sa è il difetto di famiglia di questo progetto, fatto con le nostre mani e a ventiquattr\'ore di distanza dalla riga che lo denuncia. Ora gli stati sono **tre**, e il numero che li distingue è quante **giornate sono state erogate** nella finestra: nessuna erogazione → «non lo so, e non vuol dire che le calorie siano a posto»; erogazioni ma nessun evento → ✓ **col numero delle erogazioni accanto**, che è la prova che il controllo ha avuto occasione di scattare; eventi → la tabella. ⚠️ E la seconda metà: la scrittura dell\'evento era dentro un `.catch(() => undefined)`, quindi un errore di scrittura sarebbe stato **indistinguibile da un ✓**. Ora degrada come prima ma **lo scrive nei log** — e lo stesso è stato fatto al gemello `fasting_meals_missing`, che aveva lo stesso silenzio. Un test in `menu.service.spec` tiene fermo che il menu si eroga lo stesso e che l\'avviso esce: spegnendolo cade.',
    categoria: CODICE,
    ordine: 271,
    fatta: true, // 18/8
  },
  {
    chiave: 'popup-valutazioni-gia-date',
    titolo: 'Il popup «Com\'è andata ieri?» richiedeva le stelle dei piatti già votati',
    dettaglio:
      'Punto 6 della voce 253 (il giro sistematico sulle rotte `/me/*` del 16/8): `GET /me/ratings/pending` esiste dal principio — torna i pasti degli ultimi tre giorni **ancora senza valutazione** — e **non la chiamava nessuno**. Il popup si costruiva l\'elenco da `/me/menu`, cioè dal menu del giorno, e chiedeva le stelle di **tutti** i piatti di ieri. ⚠️ Si vedeva su due strade: chi valuta un piatto da un\'altra schermata se lo ritrova nel popup, e chi apre l\'app da un **secondo dispositivo** ricomincia da capo, perché il «già visto» di oggi vive nel `localStorage` di quel telefono mentre le valutazioni stanno sul server. Ora l\'elenco lo dice il server. ⚠️ Il filtro sul giorno **resta**: la rotta torna tre giorni, il popup ne chiede uno — portare in primo piano anche l\'altro ieri non è una correzione, è una domanda in più a una persona, e va decisa. ⚠️ Lo stesso piatto in due pasti dello stesso giorno si chiede **una volta sola**: la valutazione è unica per `(cliente, ricetta, giorno)`, e chiederla due volte vorrebbe dire far rispondere due volte per scrivere una riga sola, con la seconda risposta che cancella la prima senza dirlo. Regola in un modulo puro (`app/src/lib/valutazioni-da-chiedere.ts`) con 5 test, visti cadere per mutazione. ⚠️ Arriva alle clienti solo con la prossima pubblicazione o OTA.',
    categoria: CODICE,
    ordine: 269,
    fatta: true, // 18/8
  },
  {
    chiave: 'aderenza-senza-stelle-scrive-tre',
    titolo: 'Le stelle mai date non orientano più il motore',
    dettaglio:
      'Chiusa nella notte fra il 18 e il 19/8 con la decisione di Simone: **quel 3 va escluso dal gradimento**. La parte su **cosa si scrive** resta com\'era (sua risposta del 18/8: «se il cliente non specifica metti 3 stelle»), e dal 18/8 il popup marca quei voti col tag `stelle_non_date`. ⚠️ Quel 3 **non è un\'opinione**: è un valore di scorta dell\'app, e finiva nel segnale «gradimento» con cui il motore decide cosa riproporle — una cliente che diceva soltanto «non l\'ho seguita» risultava aver dato **tre stelle** a quel piatto, e se lo rivedeva davanti con la faccia di uno che le era piaciuto. Ora i voti marcati restano fuori da **tre letture**, quelle in cui le stelle **orientano il motore**: il punteggio del pool (`menu.service`, cioè cosa le viene proposto), il gradimento del ciclo (`cycle.service.menuGradimento`) e i segnali del motore (`engine/signals-collector`). ⚠️ **Si filtra nella query e non in memoria**: filtrando dopo bisognerebbe leggere i tag ovunque, e il primo posto che se ne dimentica torna a contare il valore di scorta senza che si veda. ⚠️ **Restano com\'erano** i «piatti più apprezzati» del report e le schermate dello staff — scelta di Simone: là il numero è il resoconto di quello che è stato scritto, non una decisione su cosa arriverà nel piatto. ⚠️ **E i voti senza tag contano**: sono quelli scritti prima del 18/8, e non c\'è modo di sapere quali fossero valori di scorta — trattarli come «non dati» butterebbe via la storia di chi le stelle le ha date davvero. ⚠️ Il prezzo, detto: per chi non valuta quasi mai il motore ha **meno segnale** e torna a scegliere per varietà e calorie invece che per gusto — non peggio di prima, perché prima sceglieva **col segnale sbagliato**, ma diverso. Modulo `menu/stelle-che-contano.ts`, 6 test.',
    fatta: true, // 19/8, notte
    categoria: SIMONE,
    ordine: 270,
  },
  {
    chiave: 'diag-kcal-sotto-target',
    titolo: '`npm run diag:kcal`: quante giornate escono sotto il fabbisogno, e con che tetto si coprono',
    dettaglio:
      'Il segnale `daily_kcal_below_target` esiste dal 17/8 (voce 260) e da allora accumula: mancava il posto dove **leggerlo**. Questa diagnostica di sola lettura lo mette in tabella — cliente, perché le manca (finestra del digiuno, spuntini tolti da Vera, o nessuno dei due), **quota peggiore** della giornata, **fattore necessario**, e quante giornate. ⚠️ Serve a rispondere **con dei numeri** alle due domande cliniche ancora aperte del foglio delle porzioni (voce 255): `TETTO=1.6 npm run diag:kcal` dice quante clienti quel tetto copre e quante restano corte, e di quanto — cioè trasforma «che tetto diamo?» e «cosa si fa quando non basta?» da domande di principio in due conteggi. `GIORNI=` allarga la finestra, `SOLO=<email>` guarda una cliente sola. ⚠️ Si prende l\'evento **più recente** per cliente: quello vecchio racconta una situazione già cambiata. ⚠️ E dice a voce alta il limite che conta: **chi non compare non è detto che stia bene** — vuol dire che in quella finestra non le è stata erogata una giornata sotto banda, o non le è stata erogata affatto (`deliverIfEligible` gira quando la cliente apre l\'app). ⚠️ Segnala a parte le clienti sotto target **senza** digiuno e **senza** spuntini tolti: lì il moltiplicatore di porzione non c\'entra niente, è il catalogo che non ha giornate nella banda, e la strada è `diag:varieta`. Nessuna scrittura, nessuna migrazione.',
    categoria: MANUTENZIONE,
    ordine: 268,
    fatta: true, // 18/8
  },
  {
    chiave: 'esclusioni-con-negazione',
    titolo: 'Le esclusioni scritte come frasi ora vengono dette a chi le scrive, invece di sparire',
    dettaglio:
      'Chiusa il 18/8 con la risposta di Simone: **«le esclusioni devono essere un elenco, ogni parola deve essere seguita da una virgola, aiutiamo le clienti a scrivere in modo corretto»** — la strada 2. Il campo dei cibi non graditi accetta **frasi** e il motore legge **alimenti**: quello che si scrive in mezzo si perdeva in silenzio. I due casi veri, trovati in produzione: ⚠️ **«pesce tranne salmone, tonno»** — come termine intero non esclude niente (il pesce continua ad arrivare), e spezzato sulla virgola rende escluso il **tonno**, che è l\'opposto di quello che aveva scritto: lo elencava fra le eccezioni. E **«Non mi piace la cicoria»**, una frase intera salvata come alimento. Nuovo `common/esclusioni-scritte-bene.ts`: riconosce le **eccezioni** (`tranne`, `eccetto`, `a parte`, `salvo`, `ma non`, …), le **frasi** (`non mi piace`, `non mangio`, `odio`, `niente`, …) e le voci **troppo lunghe**, e torna la frase da mostrare a chi sta scrivendo. ⚠️ **Non corregge niente**, ed è la scelta che conta: su «pesce tranne salmone» la correzione più ovvia — tenere la prima parola — escluderebbe **tutto il pesce, salmone compreso**, cioè di nuovo il contrario. Chi ha scritto la frase è l\'unica persona che sa cosa intendeva, e a lei si **chiede**. Sulle frasi invece il suggerimento c\'è («Volevi scrivere «cicoria»?»), perché lì non è indovinare. ⚠️ Il messaggio dice **cosa succede davvero** («così com\'è non toglie niente dal menu»), non «formato non valido»: chi legge «formato non valido» corregge la forma, chi legge «il pesce continuerà ad arrivarti» capisce cosa sta perdendo. E chiude sempre con **come si scrive**, o è un rimprovero. ⚠️ Una parola di eccezione dentro un\'altra parola non conta («marmellata» non contiene «ma»): senza il confronto per parola l\'avviso avrebbe segnalato mezzo catalogo al primo giro. Attivo su **quattro porte**: profilo in app (la cliente si vede tornare il testo nel campo, così corregge invece di riscrivere), pulsante «non gradisco» dell\'app, scheda del backoffice e scheda coach in app — e ⚠️ l\'avviso delle spezie e questo **si sommano** invece di zittirsi a vicenda, che è un difetto già pagato il 17/8. ⚠️ Il controllo vive nel **backend** e non nell\'app: sarebbe stata la seconda copia di una regola, e il giorno che divergono l\'app direbbe una cosa e il motore ne farebbe un\'altra. ⛔ Resta fuori il **questionario**, che è la porta d\'ingresso vera. 28 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 267,
    fatta: true, // 18/8
  },
  {
    chiave: 'bonifica-spezie-solo-email',
    titolo: 'La bonifica dei cibi esclusi si può applicare a una cliente per volta',
    dettaglio:
      '`npm run pulisci:spezie` scriveva **tutto o niente**, e alla prima esecuzione in produzione (17/8) è bastata la prima anteprima per far vedere perché non basta: due clienti in elenco, una da sistemare subito e una da guardare a mano (la lista con «pesce tranne salmone, tonno», voce 267). La scelta era fra applicare anche quella o non applicare niente. Ora c\'è `SOLO=<email>` — anche più email separate da virgola — che vale sia in anteprima («guarda solo questa») sia con `CONFERMA=1` («applica solo a queste»). ⚠️ E un\'email che non corrisponde a nessun profilo **viene detta**: senza, un refuso darebbe «nessuna spezia da ripulire ✓», cioè la faccia del «va tutto bene» su un lavoro che non è stato fatto. I conteggi in stampa contano i profili **in esame**, non tutti.',
    categoria: MANUTENZIONE,
    ordine: 266,
    fatta: true, // 18/8
  },
  {
    chiave: 'revisione-serata-17-8',
    titolo: 'La revisione delle cinque consegne del 17/8: sette rilievi, tre seri',
    dettaglio:
      'Fatta rileggere la serata da un revisore prima di chiudere la giornata, come dice la regola — e ha trovato sette cose, tutte in codice che compilava e passava i test. ⚠️ **Le tre serie: 1)** la matita contava il **passaggio di testimone** come sovrapposizione (piano A finisce il 25/08, piano B parte il 25/08), ma quella è la coda che `finalizeApproval` costruisce da sola mettendo l\'inizio alla fine del piano in corso: l\'avviso del caso Lorena sarebbe scattato su **ogni rinnovo**, anche risalvando la stessa data — e un avviso che compare sempre è uno che si impara a cliccare via. Ora toccarsi non è sovrapporsi. **2)** Il form della scheda rimanda TUTTI i campi a ogni salvataggio, quindi la pulizia dei gusti riscriveva le intolleranze di una cliente quando una coach correggeva il telefono, col log modifiche che lo attribuiva a lei: ora si pulisce solo ciò che è **davvero cambiato**, la stessa regola di `allergies` e `fastingWindow`. **3)** Togliendo `@Roles(\'admin\')` dall\'annullamento è caduta la premessa del fail-open di `PageGuard` («tanto `@Roles` resta applicato»): un blip del database e una cliente loggata poteva chiamare `POST /admin/subscriptions/:id/cancel` — che non verifica proprietà — e annullare il piano di chiunque. Ora il fail-open vale **solo se la rotta ha ancora un `@Roles`**, altrimenti chiude (vale anche per `impersonate`, aperta dall\'11/8). **Le altre quattro:** i due avvisi della matita si zittivano a vicenda (confermato il primo, il secondo non si vedeva: ora si chiedono in una domanda sola); il giorno era confrontato in **UTC** e non nel fuso aziendale (fra mezzanotte e le due, avvisi fantasma); la scheda coach **in app** ignorava `avvisiSpezie` esattamente come faceva il backoffice prima; un campo mancava nel tipo di `pulisci-spezie.ts`. 10 test nuovi, fra cui quattro sul fail-open del guardiano. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 265,
    fatta: true, // 17/8 notte
  },
  {
    chiave: 'gusti-altre-porte-di-scrittura',
    titolo: 'Vera vince sempre su Gaia: la spezia dettata dalla nutrizionista si scrive (ma il tag si spezza lo stesso)',
    dettaglio:
      'Chiusa il 18/8 con la risposta di Simone alla domanda «se la nutrizionista detta una spezia, cosa si fa?»: **«Vera vince sempre su Gaia»**. Le due porte di Vera — `vera-chat.service.scriviRestrizione` (una cliente) e `applica-proposta.applicaRestrizione` (una coorte) — **non** passano da `filtraSpezie`: chi detta è la professionista che firma le diete, e una sua parola non viene scartata. ⚠️ **Ma l\'altra metà di quella funzione resta, e la distinzione è tutto il lavoro**: `filtraSpezie` fa due cose diverse — **scartare** (una decisione di prodotto, e Vera la vince) e **spezzare** (correggere la forma di un dato perché continui a funzionare). «pepe, ceci» scritto in una riga sola non compare in nessun piatto e da lì in poi non esclude più niente — è il caso del 17/8 con `"Carne .ceci"` — e sulla coorte quel danno si moltiplica per N profili. Confondere le due metà avrebbe dato a Vera il potere di scrivere un tag rotto. ⚠️ E il pool che si stringe resta **detto**: la chat mostra l\'anteprima (`raccontaPool`) prima che scriva, quindi la nutrizionista sceglie sapendo cosa resta — che è la differenza fra accettare una conseguenza e non vederla. ⛔ Restano aperte le altre due porte del censimento: `menu.service.substituteDisliked` con `scope: forever` (ha il cancello spezie ma non spezzava — ⚠️ ora però ha davanti il controllo delle esclusioni scritte male, voce 267) e `sostituzione-chat.service.aggiungiAiNonGraditi` di Gaia, a rischio basso perché il valore è un nome di ingrediente del catalogo. E resta il testo grezzo che finisce nel report PDF della cliente (`plan-report.service.ts:250`). 2 test.',
    categoria: CODICE,
    ordine: 264,
    fatta: true, // 18/8
  },

  {
    chiave: 'vera-coda-approvazioni',
    titolo: 'Vera fa approvare il catalogo una riga per volta: allergeni, ricette, combinazioni',
    dettaglio:
      'Richiesta di Simone del 18/8: «se ci sono ricette da approvare, combinazioni da approvare, allergeni da approvare, vanno tutti inviati a vera che aiuta il nutrizionista a verificare uno per uno». Le tre code esistevano già — sono i tre contatori della pagina di validazione — ma si svuotavano con tre pulsanti che agiscono **in blocco** sull\'intera dieta: ⚠️ un pulsante che verifica sessanta piatti in un colpo non verifica niente. Ora si dice «approvazioni» (o si clicca la pastiglia in cima alla pagina di Vera) e la coda arriva una riga per volta, **con dentro cosa si sta approvando**: ingredienti, alimenti del gruppo, pasto e calorie — perché una domanda che dice solo il nome si risponde «sì» senza guardare. ⚠️ **Gli allergeni vengono prima dell\'accensione e mai insieme sulla stessa ricetta**: finché sono da guardare, la domanda «la accendo?» non compare. ⚠️ Quella domanda non è nuova: è quella della voce 227, che la coda CHIAMA invece di rifarla. ⚠️ «Non lo so» è un **salta**, non un no. ⚠️ Il **no non scrive niente** e dice dove si cambia davvero. ⚠️ Si avanza perché la riga è stata guardata, non perché la scrittura ha detto sì. Scritture dalle porte di sempre: `updateRecipe`, `setRecipeAllergens`, `EquivalenceService.approve`.',
    categoria: CODICE,
    ordine: 265,
    fatta: true, // 18/8
  },
  {
    chiave: 'catalogo-settimane-incomplete',
    titolo: 'Il generatore riempie le settimane a metà invece di rispondere «c\'è già»',
    dettaglio:
      'Simone, 18/8: «le ricette ovviamente vanno sempre a riempimento delle settimane incomplete». Era già la regola del cron, ma la stessa domanda si rispondeva in due punti con due criteri: per il cron «magra» = un pasto con meno di sette piatti **diversi**, per il pulsante *genera* «fatta» = esiste una giornata con quel numero. ⚠️ Il conto delle settimane mente: quattro giornate nella settimana 2 fanno «due settimane fatte», e da lì quella settimana resta a metà **per sempre**. Ora la risposta sta in un modulo solo (`settimana-magra.ts`) che chiamano tutti e due; il generatore legge le giornate e non solo il giorno più alto; la settimana da fare è la prima magra; «c\'è già» si dice solo quando è davvero piena. ⚠️ Col rovescio a test: se la settimana chiesta è piena non si tocca niente.',
    categoria: CODICE,
    ordine: 266,
    fatta: true, // 18/8
  },

  {
    chiave: 'ordine-menu-difetti',
    titolo: 'Ordine del menu: i cinque difetti del foglio del 18/8 — chiusi',
    dettaglio:
      'Foglio `progetto/DIFETTI_Ordine_Menu.md`. ⚠️ Il più grave era **perdita di dati silenziosa**: `menuOrder` passava dalla `clean` comune alle preferenze, che deduplica con un `Set` — giusto per le rotte, ma i **titoli dei gruppi** vivono nella stessa lista, e due gruppi omonimi producevano due righe identiche: la seconda spariva e i due gruppi diventavano uno, senza un errore. Ora `backend/src/users/ordine-menu.ts` deduplica solo le rotte, fa `trim` e taglia a 64 **lato server** (⚠️ la casella ha `maxLength={24}`, ma il limite del browser non è un limite). Poi: l\'**icona segue le voci e non il titolo** (rinominare un gruppo la faceva sparire); via un `?? true` che non scattava mai; il **gruppo vuoto** lo dice nell\'editor invece di sembrare un salvataggio fallito. ⚠️ E il pezzo sotto a tutti: **il backoffice non aveva test** — aggiunti vitest, il passo «Test» in CI e `menuOrder.spec.ts` (14 casi).',
    categoria: CODICE,
    ordine: 267,
    fatta: true, // 18/8
  },
  {
    chiave: 'ordine-menu-difetti-minori',
    nata: '2026-08-18',
    titolo: 'Ordine del menu: resta solo il difetto 6, le righe morte nelle preferenze',
    dettaglio:
      'Il difetto **6**, l\'ultimo dei sette. ⚠️ La numerazione viene dalla rilettura del 18/8 mattina ed è raccontata nella voce del `REGISTRO.md` di quel giorno: il foglio `progetto/DIFETTI_Ordine_Menu.md` che alcuni testi citavano **non esiste nel repository** (corretto la sera stessa, rileggendo). ✅ **Il 7 è chiuso la sera del 18/8**: `conNascosteAlLoroPosto` rimette le voci che questa persona non vede **dove le aveva messe**, invece che in fondo all\'ultimo gruppo — prima venivano tenute (giusto) ma spostate (sbagliato), quindi il giorno che il permesso arrivava la pagina ricompariva in coda al menu e nessuno collegava le due cose. ⚠️ Si lavora sulla **lista salvata** e non sulla vista, perché la vista le voci nascoste non le contiene nemmeno; l\'ancora è preferibilmente una **rotta** e non un titolo, perché due gruppi possono chiamarsi uguale e un\'ancora ambigua rimetterebbe la voce nel gruppo sbagliato; se prima di lei non c\'è nessuna rotta sopravvissuta ci si aggancia al titolo, e se non c\'è nemmeno quello la riga torna in cima. 8 test (22 in tutto nel file). **Resta il 6:** una voce **tolta dal software** resta nelle preferenze di chi l\'aveva ordinata — in lettura viene saltata, ma la riga consuma una delle 80 disponibili finché la persona non risalva. Si chiuderebbe riscrivendo indietro l\'ordine ripulito in lettura, ⚠️ ma è **una scrittura che nessuno ha chiesto**: non ne vale la pena finché il tetto degli 80 non dà fastidio, ed è la stessa ragione per cui era stato lasciato aperto. ✅ **Chiuso il 20/8, e non con la scrittura che la voce temeva.** Simone: «i punti aperti di codice perché non li fai?» — domanda giusta, e la risposta era che «non conviene finché il tetto degli 80 non dà fastidio» è **un\'assunzione mai misurata**, cioè un\'opinione travestita da conclusione. ⚠️ Rileggendo il codice il rimedio è un altro: una rotta salvata che non compare nella vista può essere due cose **diverse**, e finivano nello stesso mucchio — **nascosta** (la pagina esiste, questa persona non ha il permesso → va tenuta dov\'era, è il difetto 7) e **morta** (la pagina non esiste più → consuma una riga per sempre). Distinguendole, la riga morta si toglie **nel momento in cui la persona salva comunque**: nessuna scrittura in più, e il posto liberato è vero. La voce aveva ragione sul rimedio che proponeva e torto sulla conclusione. ⚠️ E la rete: **senza l\'elenco delle rotte non si toglie niente** — un difetto lì cancellerebbe l\'ordine di tutti, e «non lo so» deve costare meno di «ho indovinato».',
    categoria: CODICE,
    ordine: 268,
    fatta: true,
  },

  {
    chiave: 'tabella-capo-valori-mancanti',
    titolo: 'I valori nutrizionali che mancavano: integrati e approvati dal capo (18/8)',
    dettaglio:
      'Il capo nutrizionista ha mandato la tabella completa dei 57 alimenti, tutte le righe «Confermato». ⚠️ Confronto riga per riga prima di toccare niente: **58 differenze, tutte nella stessa direzione** (un buco da noi, un valore da lui), **zero contraddizioni**. Entrano i sei IG che mancavano (borlotti 28, kiwi 52, latte parz. scremato 32, avocado 10, mandorle 15, noci 15) e i valori per 100 g di dieci righe; le note che dicevano «la riga resta senza indice» sono state riscritte, perché accanto a un numero si smentivano da sole. ⚠️ **«Non si applica» non è «non lo so»**: 14 alimenti senza carboidrati hanno N.D. nella sua colonna, e adesso Gaia lo DICE invece di tacere (con zero numeri autorizzati). ⚠️ La tendina in backoffice aveva tre opzioni: salvare una di quelle righe avrebbe riscritto «non lo so» sopra la sua firma — aggiunta la quarta. ⚠️ E il prezzo della firma: da adesso il seed non governa più quelle righe, quindi cambiare un numero nel file non lo cambia più in produzione. `tabella-capo.spec.ts` (61 test) rifà da solo il confronto. ⛔ **Resta da lanciare** `npm run seed:nutrienti` in produzione (gira comunque a ogni deploy).',
    categoria: DATI,
    ordine: 269,
    fatta: true, // 18/8
  },

  {
    chiave: 'stato-in-coda-scrittura',
    titolo: 'Il piano «in coda» adesso si scrive davvero — e dodici letture che dicevano il falso',
    dettaglio:
      'La SECONDA metà della voce 258, chiusa il 19/8. `finalizeApproval` scrive `queued` invece di `active` con la partenza nel futuro, e un passo notturno (`promuoviCodeArrivate`, **primo** del `daily` perché tutti gli altri leggono lo stato) fa partire le code arrivate. ⚠️ **Ma la parte grossa della consegna non è quella**: la revisione avversariale ha trovato che il 18/8 le letture erano state adeguate solo in parte — **dodici punti** confrontavano ancora `status === \'active\'` a mano, e con la scrittura nuova avrebbero fatto danno in silenzio. Il peggiore: `menu.service.menuStatus`, che a una cliente appena pagante con partenza lunedì scriveva «**il tuo piano è terminato, riattiva un piano dal Negozio**» il giorno stesso del pagamento. Poi: l\'erogazione perdeva i due giorni di anteprima; il calcolo della coda non vedeva le code (due piani pagati sovrapposti — il caso Lorena riaperto dalla scrittura nuova); l\'abbonamento Stripe in coda non compariva nel profilo e **la disdetta rispondeva 404** (paga e non può uscire); i giorni di «porta un\'amica» e quelli di pausa si perdevano; scheda cliente, diagnostiche, contatori e check-in tacevano. ⚠️ E **cinque punti scrivevano** la data d\'inizio decidendo ognuno per sé: ora la domanda «attivo o in coda?» ha una risposta sola (`statoPerInizio`). ⚠️ Tre difetti erano **più vecchi della voce**: l\'`actorId: \'system\'` viola la chiave esterna su `user` e il registro non si scriveva (**lo stesso difetto era in produzione da settimane** su `commerce.payment.approve` di tutti i pagamenti con carta: chiuso lo stesso giorno, voce `audit-attore-che-non-esiste`); chi comprava il rinnovo in anticipo **smetteva di ricevere menu** perché la finestra si misurava sulla data del profilo, che l\'acquisto in coda riallinea al piano NUOVO (dal 10/8); la data scelta dopo il pagamento da una cliente **di ritorno** non muoveva l\'abbonamento. ⚠️ Una coda arrivata a scadenza **senza mai partire non si promuove**: da attiva-e-finita prenderebbe, nella stessa notte, il report di fine percorso e la cancellazione della personalizzazione — cose che non si tornano indietro. Resta `queued`, si grida nei log e si vede in `npm run diag:coda`. 3590 test verdi (229 suite), tre ronde di revisione avversariale e due di mutation testing. Nessuna migrazione. **Resta**: il vincolo in banca dati, e le quattro decisioni del foglio `HANDOFF_2026-08-19.md`.',
    categoria: CODICE,
    ordine: 270,
    fatta: true, // 19/8
  },

  {
    chiave: 'ingredienti-nomi-liberi',
    nata: '2026-08-19T17:20',
    priorita: 'bassa',
    titolo: 'I nomi liberi degli ingredienti: l\'abbinamento è acceso, resta il lavoro a mano sulla lista corta',
    dettaglio:
      'Dal primo giro di `npm run diag:crudo-cotto` in produzione (19/8). Gli ingredienti usati nelle ricette **attive** e sconosciuti alla tabella nutrienti sono **7831**. ⚠️ Il numero non si legge come «mancano 7831 righe»: guardando i primi si capisce cosa sono davvero. Ci sono gli **aromi** — aglio (3888 ricette), sale (3296), limone (3146), pepe nero (1755), prezzemolo fresco — che nel conto delle calorie pesano zero e la tabella non li avrà mai tutti. E soprattutto ci sono le **varianti dello stesso nome**: «olio extravergine» (2771), «olio extravergine d oliva» (2486), «olio extravergine oliva» (1237) sono lo stesso olio scritto in tre modi, e in tabella «olio extravergine di oliva» c\'è (3025 ricette lo trovano). ⛔ **La causa è che le ricette generate dall\'AI usano nomi liberi**, e nessuna tabella potrà coprirli: riempire l\'elenco è una battaglia che si perde a ogni generazione nuova. Le strade sono altre, e sono decisioni: (a) **normalizzare in lettura** — un dizionario di sinonimi che porta le tre scritture dell\'olio alla stessa riga, come già si fa per le allergie; (b) **vincolare la generazione** a un elenco chiuso di ingredienti, che è il modo di non avere il problema ma restringe le ricette; (c) **niente**, e si accetta che il conto dei macro salti gli aromi (che è quasi sempre giusto) e ogni tanto un ingrediente vero. ✅ **Fatta la (a) il 19/8, e il danno era più piccolo di come l\'avevo raccontato**: le ricette generate portano le calorie calcolate dall\'**AI**, non sommate dalla tabella — la somma la fa solo Vera quando la nutrizionista detta, e lì quello che manca si dichiara e blocca. Il danno vero era che **Gaia diceva «non ce l\'ho» su alimenti che ci sono**. L\'abbinamento ha **due** regole: le paroline non contano («olio extravergine d oliva» = «olio extravergine di oliva») e la ricetta può aggiungere solo **qualificatori innocui** («spinaci freschi» → «spinaci»). ⚠️ La terza che sembrava ovvia — «manca solo una parolina» — il test l\'ha bocciata prima della produzione: se manca una parola della tabella, quella parola **distingue**. ⚠️ E la prima versione della seconda regola era **sbagliata** e l\'ha mostrato il giro in produzione: accettava qualunque parola in più, e faceva diventare «semi di zucca» la zucca (531 ricette, venti volte le calorie) e «olio di cocco» l\'olio d\'oliva. Ora l\'elenco dei qualificatori è **chiuso**: si legge e si discute, mentre «tutto il resto è innocuo» sbaglia in silenzio. ⛔ **Resta la (b)** — vincolare la generazione a un elenco chiuso di ingredienti — che non si fa: impoverisce le ricette e non sistema le 19347 già generate. ⛔ E resta il lavoro **a mano** sulla lista 3b della diagnostica: le prime 32 righe le ha compilate la nutrizionista il 19/8 (`npm run importa:alimenti`), e «olio extravergine» da solo si chiude con **un sinonimo**, non con una regola. ✅ **E il 19/8 sera `npm run diag:ricerca` ha prodotto la lista 3b in ordine di urgenza, per caso**: cercava le trappole della ricerca e ha trovato che i nomi che le fanno scattare sono tutti nomi **che in tabella non ci sono**. In testa, con quante volte compaiono negli ingredienti delle ricette attive: melanzane/melanzana (1025), olive denocciolate (385 fra denocciolate/denocciolati/snocciolate/snocciolati), melagrana (72), cipollotto (55), piselli sgranati (37), coda di pescatrice (32), datterini (22), fagiolini (15), spinacino (11). ⚠️ Sono alimenti **veri e comuni**, non casi limite, e finché mancano il conto della ricetta li salta e Gaia non ne sa parlare. `QUANTI=60 npm run diag:ricerca` le mostra tutte e quaranta. ✅ **E il 19/8 sera è arrivata la tabella per correggere a mano** (risposta di Simone su questa voce: «crea una tabella dove possiamo correggere a mano»). ⚠️ **Non è una pagina nuova e non è una tabella nuova**: «quali alimenti ci mancano» è **una** domanda, e la risposta arrivava già da due parti — le clienti che li chiedono a Gaia e le ricette che li usano. Due elenchi divergono al primo giorno e fanno lavorare due volte sullo stesso nome. Quindi la riga è la stessa (`nutrient_lookup_miss`) e porta due numeri che **non si sommano** — `times` (quante volte l\'hanno chiesto) e `ricette` (quante ricette attive lo usano) — perché sono unità diverse e un totale inventato farebbe ordinare l\'elenco su un numero che non vuol dire niente. Un passo notturno lo ricalcola dalle ricette attive, ⚠️ **senza toccare `status`**: se una persona ha già detto «non è un alimento» o ha già scritto la riga, l\'automatismo non glielo riapre. Nella pagina **Valori nutrizionali** l\'elenco dice **perché** il conto non sa contarlo — non in tabella · solo da cotto · senza stato, che si chiudono in tre modi diversi — e, quando l\'abbinamento saprebbe dove portare quel nome, offre il pulsante **«è olio extravergine di oliva»**: un clic e il nome diventa un **sinonimo** di quella riga. ⛔ Lo decide una persona: l\'elenco suggerisce, non applica. ⚠️ Il tetto (300 righe scritte, 200 mostrate) **si dichiara**: un tetto in silenzio si legge come «è tutto qui». ⚠️ E l\'elenco **cala**: un nome che nessuna ricetta usa più torna a zero da solo. ✅ **Chiusa il 19/8 sera**: la risposta di Simone («crea una tabella dove possiamo correggere a mano») è consegnata, e con lei la lista in ordine di urgenza dentro la pagina Valori nutrizionali. ⚠️ Il lavoro **a mano** non finisce qui — ma non è più un punto di elenco: è un elenco vero, in pagina, che dice quante righe restano e cala da solo man mano che si chiudono. *Una voce di lavoro che descrive un lavoro continuo resta aperta per sempre, e a forza di restare aperta smette di dire qualcosa.*',
    categoria: SIMONE,
    ordine: 300,
    fatta: true,
  },

  {
    chiave: 'scheda-ricetta-crudo-o-cotto',
    nata: '2026-08-19T16:10',
    // ⚠️ Bassa per la regola del 19/8: la priorità la dà Simone, non io.
    priorita: 'bassa',
    titolo: 'Le grammature delle ricette sono a crudo, e adesso il codice lo rispetta',
    dettaglio:
      'Dalle domande arrivate alla nutrizionista sul **grano saraceno** (19/8). Crudo ~343 kcal, cotto ~92: ⚠️ quasi **quattro volte** — chi pesa dalla parte sbagliata non ha un\'imprecisione, ha un altro pasto. È lo stesso guasto del farro (voce 228). ✅ **Fatto lo strumento** (`npm run diag:crudo-cotto`): dice quali alimenti sono in tabella **senza stato** e usati nelle ricette (Gaia lì dice un numero senza dire da che parte), quali sono usati e **fuori tabella**, e quanti sono già a posto — ordinati per quante ricette attive li usano, che è una priorità oggettiva e non un giudizio clinico. ⚠️ Non indovina nessuno stato: «il grano saraceno delle ricette sarà cotto» è una supposizione, e metterla in banca dati vuol dire far dire a Gaia un numero deciso da chi non è nutrizionista — l\'elenco lo riempie lei dalla pagina Alimenti. ⛔ **Ma il buco vero è a monte**: la scheda ricetta scrive «80 g di grano saraceno» e la grammatura non porta con sé lo stato. Riempire la tabella toglie il numero sbagliato; **dirlo nella scheda toglie la domanda**, che è dove nasce. ✅ **CHIUSA il 19/8 con la convenzione di Simone: «diamo per assodato che gli ingredienti siano a crudo in tutte le ricette, come si fa nei libri».** Nessuno dei tre modi serviva: una convenzione sola vale più di un campo su diciannovemila ricette, ed è quella che una persona si aspetta. Ora la scheda dell\'app lo **dice** sotto gli ingredienti, il form del backoffice lo dice a chi li scrive, e ⚠️ il codice la **rispetta**: `scegliPerRicetta` prende la riga a crudo o a secco, e se in tabella c\'è **solo il cotto** non conta niente e lo dichiara — nella tabella verificata sono 37 righe su 96, e sono le più pesanti del piatto (pasta, riso, quinoa, legumi, patate). ⚠️ Contare «80 g di quinoa» con la riga bollita scriveva **96 kcal dove ce ne sono ~284**, dentro `Recipe.kcal`, che è il campo su cui il motore calcola le giornate. La ricetta dettata a Vera adesso **non si scrive** finché quella riga manca: meglio fermarsi che scrivere un numero tre volte più basso del vero. ⚠️ «Senza stato» non è «cotto», è «non lo so»: si conta e si dichiara, perché rifiutare anche quelle bloccherebbe quasi ogni ricetta.',
    categoria: SIMONE,
    ordine: 299,
    fatta: true, // 19/8
  },

  {
    chiave: 'giorni-da-rifare-tre-definizioni',
    nata: '2026-08-19T15:40',
    // ⚠️ Bassa per la regola del 19/8 («se trovi qualche cosa lo aggiungi con priorità bassa»).
    priorita: 'bassa',
    titolo: '«Quali giorni si possono rifare» ha tre risposte, e una delle tre esclude oggi',
    dettaglio:
      'Trovato il 19/8 rileggendo il codice per verificare la voce sul divieto di dieta. La stessa domanda — «quali menu futuri posso ancora rifare?» — è scritta in **tre posti**: `registro.service.menuDaRifare` (per una cliente), `vera/menu-da-rifare.ts` `giorniDaRifare` (per una dieta, filtrando sui piatti vietati) e `vera/togli-spuntino.ts` `giorniDaRifarePerPasti` (per gli spuntini). Tutte e tre dicono «futuri e mai aperti», ⚠️ **ma il confine di oggi è diverso**: le prime due includono la giornata di oggi se non è stata aperta (`date >= mezzanotte`), la terza la esclude (`date > adesso`). ⚠️ La conseguenza si vede su una cliente che non ha ancora aperto il menu di oggi: se la nutrizionista le toglie lo spuntino, **oggi lo spuntino ce l\'ha ancora**; se le vieta un alimento, oggi cambia. Nessuno dei due comportamenti è scritto come scelta — sono due `where` scritti in momenti diversi. ⛔ La domanda per Simone e la nutrizionista è quale sia quello giusto: rifare la giornata di oggi che non ha ancora aperto è più coerente, ma è anche il giorno in cui potrebbe aver già fatto la spesa. ✅ **CHIUSA il 19/8. Simone: «meglio rifare la giornata di oggi».** Adesso la risposta è **una sola** — `siPuoRifare` in `vera/menu-da-rifare.ts` — e la usano tutti e tre i punti, con il confine (`daQuandoSiPuoRifare`) scritto una volta. ⚠️ Il confine è la **mezzanotte di oggi** e non «adesso»: `MenuDay.date` è una data senza ora, e confrontarla con l\'istante corrente fa sparire la giornata di oggi appena passa mezzanotte, cioè sempre. ⚠️ E la regola vera resta intatta: un giorno **già aperto** non si rifà mai, perché magari ci ha già fatto la spesa — decide `viewedAt`, non il calendario. Due mutazioni provate (confine a domani, giorno già aperto rifatto) e tutte e due fanno fallire i test.',
    categoria: SIMONE,
    ordine: 298,
    fatta: true, // 19/8
  },

  {
    chiave: 'allergeni-bozze-invisibili',
    nata: '2026-08-19T14:20',
    titolo: '«4612 aspettano gli allergeni» e la pagina era vuota: le bozze che nessuno poteva rivedere',
    dettaglio:
      'Segnalazione del nutrizionista, girata da Simone il 19/8. **Tre strati dello stesso difetto, e il primo da solo bastava.** ⚠️ **1)** Il generatore crea le ricette come **bozze** (`active: false`, «non entra nel motore finché non approvata») e la pagina Allergeni chiamava `GET /recipes?includeInactive=false`: le 4612 non entravano nemmeno nella query — riceveva mille ricette **attive** in ordine alfabetico, già confermate quasi tutte. La pagina Ricette chiede `includeInactive: true` e infatti conta 19347: due pagine sullo stesso catalogo con due domande diverse. ⚠️ **2)** Il filtro «Da rivedere» girava **in memoria** sulle mille righe già scelte dal tetto: con 4612 sparse su 19347 pescava in una fetta arbitraria — testualmente il difetto che `listRecipes` racconta di aver chiuso l\'11/8 per la pagina Ricette, «una ricetta che c\'è ma non compare è peggio di un errore». Ora è una condizione del database. ⚠️ **3)** E comunque non si sarebbero potute confermare: `getRecipe` risponde **404 su una ricetta non attiva** — giusto, la usa la cliente dall\'app — e ci passavano sia i suggerimenti sia il salvataggio, cioè le due cose che lavorano **esattamente** sulle bozze. ✅ **Due decisioni di Simone, prese il 19/8: (a)** confermare gli allergeni **fa entrare la ricetta in catalogo** (prima restava bozza, e nessuna schermata diceva quante fossero in quello stato: un secondo cancello senza porta è un magazzino) — ⚠️ ma solo la ricetta **mai confermata prima**, perché una archiviata a mano è archiviata di proposito; **(b) conferma in blocco**, perché il generatore scrive ~4600 ricette a settimana e una per una sono diciannove ore per svuotare un mucchio che nel frattempo si è riempito. ⚠️ Il blocco scrive gli allergeni **riconosciuti dagli ingredienti** e ricalcolati adesso, mai un elenco vuoto. ⛔ **Resta aperta la domanda vera**, che è di prodotto e non di software: con la conferma in blocco il cancello prima del piatto di una cliente è il **riconoscitore automatico**, non una persona. Va bene finché il riconoscitore è buono: nessuno ha ancora misurato quanto lo è.',
    categoria: CODICE,
    ordine: 296,
    fatta: true, // 19/8
  },

  {
    chiave: 'allergeni-quanto-e-buono-il-riconoscitore',
    nata: '2026-08-19T14:25',
    // ⚠️ Bassa perché l'ha deciso Simone («se trovi qualche cosa lo aggiungi con priorità bassa»),
    // non per il suo peso: è la voce che decide se il cancello sugli allergeni tiene.
    priorita: 'bassa',
    titolo: 'Quanto è buono il riconoscitore di allergeni? Da oggi è lui il cancello, e non l\'ha mai misurato nessuno',
    dettaglio:
      'Nasce dalla decisione del 19/8 sulla conferma in blocco. Da oggi migliaia di ricette entrano in catalogo con gli allergeni **dedotti dagli ingredienti** (`suggestAllergens`, per parole chiave) e un nutrizionista che dice «di queste mi fido», non che le guarda una per una. ⚠️ È una scelta ragionevole — l\'alternativa era una coda ferma per sempre — **ma sposta il cancello**: prima davanti al piatto di una cliente allergica c\'era una persona, adesso c\'è un elenco di parole chiave. E quanto sia buono quell\'elenco **non l\'ha misurato nessuno**. ⛔ Il lavoro è misurarlo, non riscriverlo: prendere un campione di ricette confermate a mano dal nutrizionista e confrontarle con quello che il riconoscitore avrebbe detto — quante volte non vede un allergene che c\'è (il caso che fa male) e quante ne vede uno che non c\'è (impoverisce il menu e basta). Con quel numero si decide se il blocco va bene com\'è, se serve una soglia («in blocco solo le ricette senza ingredienti ambigui»), o se certi allergeni restano sempre a mano. ✅ **Chiusa il 19/8 sera dalla risposta di Simone**: «testato col nutrizionista, dice che è ok». ⚠️ **Va scritto con precisione cosa è stato verificato e cosa no**, perché è la differenza fra un punto chiuso bene e uno chiuso in fretta: quello che c\'è è il **giudizio di chi conosce le ricette**, non la misura che questa voce chiedeva — il confronto fra un campione confermato a mano e quello che il riconoscitore avrebbe detto, con i due numeri separati (quante volte non vede un allergene che c\'è, quante ne vede uno che non c\'è). ⛔ Il primo dei due è quello che fa male, e resta non misurato. Chiudere sulla parola di chi sa è una decisione legittima; crederla una misura no. Se un giorno un allergene passa, si riparte da qui.',
    categoria: SIMONE,
    ordine: 297,
    fatta: true,
  },

  {
    chiave: 'lista-lavori-priorita-e-data',
    nata: '2026-08-19T13:30',
    titolo: 'La lista lavori dice da quando esiste un punto, e Simone gli può dare la priorità',
    dettaglio:
      'Due richieste dello stesso messaggio del 19/8 — «pensavo di chiudere la lista lavori ma invece che diminuire aumentano» — e una ragione sola: l\'elenco non si riusciva più a governare. **1) Priorità Alta / Neutra / Bassa**, tre pulsanti su ogni riga che salvano al clic (se servisse aprire-cambiare-salvare, dopo tre voci si smetterebbe di darla). ⚠️ **Non è il rosso**: `blocca` è un fatto verificabile — dietro c\'è una fila ferma — la priorità è un giudizio, e sono due colonne separate proprio perché si possa dire «lo so che ferma la coda, aspetta lo stesso». ⚠️ Il default è **neutra** e non bassa: una voce nuova non è meno importante, è una voce su cui nessuno si è pronunciato. **2) Da quando esiste il punto**: ⚠️ `createdAt` non risponde, perché le voci del file entrano tutte insieme col rilascio e cento voci nate in due settimane risulterebbero create nello stesso minuto — una data falsa è peggio di una assente. Quindi «Aperta il …» quando la data si sa, «In elenco dal …» in corsivo quando si ha solo quella del caricamento, e l\'ora si stampa solo se la sappiamo. ⚠️ Il rilascio **aggiunge** la data mancante e non la riscrive mai; la priorità invece vale solo alla nascita, perché riscrivere il giudizio di Simone a ogni rilascio gli toglierebbe di mano l\'unica leva che ha chiesto.',
    categoria: CODICE,
    ordine: 295,
    fatta: true, // 19/8
  },

  {
    chiave: 'lista-lavori-file-e-pagina',
    nata: '2026-08-19T13:10',
    // ⚠️ BASSA perché l'ha deciso Simone il 19/8 («se trovi qualche cosa lo aggiungi in lista con
    // priorità bassa»), non perché io la ritenga poco importante: la priorità la dà lui.
    priorita: 'bassa',
    titolo: 'Il file e la pagina Lavori divergono: adesso il rilascio lo DICE (resta da decidere se allinearli da solo)',
    dettaglio:
      'Trovato il 19/8 nel modo peggiore: ho fatto a Simone il punto della situazione leggendo `voci-iniziali.ts` invece della pagina, e gli ho ripresentato come aperte la **tabella IG** e la **conta allergie** — due cose che aveva già lanciato lui sulla shell di Render. La sua risposta: «la tabella IG quante volte te la devo dare?». ⚠️ **Il file non è lo stato**: lo stato è la pagina, e il file può solo *chiudere* una voce, mai riaprirla. La conseguenza è che il file resta indietro in silenzio ogni volta che qualcosa si chiude fuori da una consegna — e chi legge il file (io, in ogni sessione nuova) crede di leggere l\'elenco vero. ⚠️ Vale anche al contrario: in pagina ci sono voci scritte a mano da Simone («Moduli fissi in dashboard», «Schermate app 30 e 27-28», «Vera: rifare i giorni futuri») che nel file non esistono, quindi non ricevono né la data di nascita né le riscritture del rilascio. Il pulsante «Copia per Claude» risolve il caso singolo — basta incollarmelo — ma è un gesto che va ricordato ogni volta, e le cose che vanno ricordate ogni volta prima o poi non si ricordano. ✅ **Fatta la strada (a) il 19/8**: «Aggiorna dal rilascio» adesso **dice** quali voci il file crede aperte e la pagina ha già chiuso (col titolo, non con la chiave), e quante voci vivono **solo in pagina** perché scritte a mano. ⚠️ Non corregge niente, di proposito: quale delle due versioni vinca è una decisione di prodotto, e un automatismo che togliesse una spunta messa a mano sarebbe il difetto peggiore di quello che risolve. È la stessa scelta già fatta per i testi cambiati — meglio saperlo che crederle allineate. ⛔ **Resta aperta la (b)**, se un giorno servisse: un `npm run allinea:lavori` che rigenera il file dalla pagina. ⚠️ Fa vincere la pagina su un file che sta nel repository e si legge nei commit, quindi non si fa finché il segnale della (a) non si dimostra insufficiente — e adesso, per la prima volta, si può misurare invece di supporre. ✅ **Chiusa il 19/8 notte, e la (b) si è fatta — ma non come era scritta.** La (b) diceva «un `npm run allinea:lavori` che rigenera il file dalla pagina», e ⛔ quella non si è fatta: farebbe vincere la pagina su un file che sta nel repository e si legge nei commit. Si è fatto il verso opposto e più utile: **l\'allineamento gira da solo a ogni rilascio** (`preDeployCommand`, con un `|| true` intorno perché la contabilità dei nostri compiti non deve far fallire il deploy di un\'app che serve delle clienti), e il file può **chiudere per titolo** anche le voci scritte a mano dal backoffice. ⚠️ La spinta è una frase di Simone: «non devo spuntare io le voci, fallo tu» — e aveva ragione, perché un pulsante da premere dopo ogni consegna *è un lavoro*, e il 19/8 è costato tre indagini su tre punti già fatti. ⛔ Il patto resta quello di sempre: il file può creare e chiudere, **mai riaprire**, mai togliere una spunta, mai riscrivere un testo corretto a mano — e chiudere per titolo solo se il titolo combacia con **una riga sola**.',
    categoria: CODICE,
    ordine: 294,
    fatta: true,
  },

  {
    chiave: 'quattro-decisioni-19-8',
    titolo: 'Il mantenimento sulla tendenza, il «tranne» che diventa una telefonata, e due frasi che dicevano il falso',
    dettaglio:
      'Quattro risposte di Simone del 19/8, chiuse in giornata. **1)** `hasReachedObjective` — che decide se offrirle il **Mantenimento** — guardava l\'ultima pesata: proporlo perché una mattina la bilancia ha detto 69,8 con la media a 70,6 vuol dire venderlo **un attimo prima che il peso risalga**. Ora passa dalla stessa risposta di tutto il resto (`percentuale-obiettivo.ts`). **2)** «Pesce tranne salmone» diventa un\'**attività della coach** (voce 267, chiusa): l\'avviso mentre scrive c\'era dal 18/8 e ⚠️ non corregge — la correzione più ovvia toglierebbe tutto il pesce, salmone compreso — quindi la domanda la fa una persona. ⚠️ Solo le frasi con un\'**eccezione**, le uniche che possono fare l\'opposto; e il riferimento è l\'**impronta dell\'elenco**, così la domanda torna se lo riscrive e non si ripropone se ne hanno parlato. **3)** Nella coda «Da validare», «Conferma» e «Correggi» facevano la stessa cosa — scrivere «ho letto» — mentre la proposta del motore **non viene mai applicata**: il pulsante adesso si chiama **«Presa visione»**, con una riga che dice cosa fanno tutti e due. ⛔ Applicarla davvero resta bloccato sul numero di Nocanty. **4)** Il **Report** resta sul peso **misurato** (è un documento firmato che lei può portare dal medico) ⚠️ ma adesso **dice perché** può non coincidere con l\'app: senza quella riga sarebbero due numeri diversi sulla stessa persona, cioè il difetto tolto da tutto il resto lo stesso giorno. 233 suite, 3635 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 293,
    fatta: true, // 19/8
  },

  {
    chiave: 'due-dati-app',
    titolo: 'I due dati che la cliente non vedeva, e la percentuale che rispondeva in cinque modi',
    dettaglio:
      'Consegnata il 19/8, con le cinque decisioni del foglio `DECISIONE_Due_Schermate_App.md` arrivate da Simone: percentuale sulla **media mobile del server**, proiezione della data e giorni di stallo **fuori** dall\'app, del ciclo si vedono **cotture + esito precedente**, `getActiveCycle` **separato** in lettura e scrittura. ⚠️ Il foglio aveva contato quattro punti che calcolavano la percentuale ognuno per conto suo; la revisione ne ha trovato **un quinto, il peggiore**: i **traguardi**, calcolati sul peso di stamattina mentre la barra — nella **stessa schermata** — usa la media mobile. Si poteva leggere «-5 kg: che traguardo!» sopra una barra che dice 43%, e «Obiettivo raggiunto! 🎉» per una pesata sotto il target con la tendenza ancora sopra — ⚠️ e un traguardo **si scrive una volta sola e non si corregge il giorno dopo**. Ora il conto è uno (`signals/percentuale-obiettivo.ts`), con un **tetto alla finestra** (`moving_average_window` non ha né minimo né massimo nei Parametri, e sopra 120 i chiamanti tornerebbero a divergere). ⚠️ Il prezzo è scritto in pagina: «sulla media degli ultimi giorni, non sul peso di stamattina», perché senza quella riga la cliente pesa 300 g in meno, la barra non si muove e la schermata sembra rotta. **Il ciclo**: una scheda nel Menu con le cotture di questi giorni e com\'è andato quello chiuso; ⚠️ la schermata **non scrive più**; ⛔ il «gradimento» resta fuori — è il minimo del massimo delle stelle con **default 5**, cioè le tre stelle inventate rifatte in una schermata. ⚠️ La revisione ha trovato anche che le **cotture potevano essere inventate** da un ripiego e che «precedente» non voleva dire precedente. 232 suite, 3627 test. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 291,
    fatta: true, // 19/8
  },

  {
    chiave: 'percentuale-obiettivo-punti-rimasti',
    nata: '2026-08-19',
    titolo: 'Resta UN punto che risponde ancora con l\'ultima pesata, ed è clinico (erano quattro)',
    dettaglio:
      'Trovati dalla revisione del 19/8, e lasciati fuori dalla consegna dei due dati **di proposito**: non erano fra i quattro del foglio, e cambiarli è una decisione clinica più che di software. **Chiusi il 19/8, dalle risposte di Simone:** `commerce.hasReachedObjective` — che decide se offrirle il **mantenimento** — è passato alla media mobile, perché proporglielo perché una mattina la bilancia ha detto 69,8 con la media a 70,6 vuol dire venderglielo un attimo prima che il peso risalga; e `reports.service` **resta di proposito sul peso misurato** (il Report è un documento firmato su un periodo, e «il peso a quella data» è un fatto verificabile che lei si può portare dal medico) ⚠️ **ma adesso lo dichiara**, con una riga sotto i numeri: due numeri diversi sulla stessa persona senza nessuno che dica perché erano esattamente il difetto tolto da tutto il resto del prodotto quel giorno. **Chiuso anche `plan-report.service` il 19/8**, e la scoperta ha cambiato la domanda: non alimenta il PDF firmato, alimenta la **schermata Report dentro l\'app** (`app/src/pages/Report.tsx`), quella che lei apre a fine piano. Lì scriveva «−4,2 kg da oggi» sull\'ultima pesata mentre la pagina Obiettivo della stessa app, due schermate più in là, ne diceva un altro sulla media mobile: due numeri sulla stessa persona dentro la stessa app. Simone ha scelto la **media mobile**, e ⚠️ cambia anche la decisione che ci sta sotto — `objectiveReached` sceglie se offrirle il Mantenimento o un piano-obiettivo, ed è la stessa domanda di `commerce.hasReachedObjective`, passata alla tendenza lo stesso giorno. ⚠️ Restano **misurati** i confronti A→B del periodo e i traguardi: raccontano cosa è successo, e la storia di una persona non si ridisegna con una media. **Resta** `menu/kcal-need.service` (`kgToLose`, che è un ingrediente del fabbisogno). ⛔ Il `kcal-need` non si tocca senza la nutrizionista: `kgToLose` entra nel **fabbisogno calorico**, e cambiarne la base cambia quante calorie mangia ogni cliente — è una decisione clinica, non di software. È l\'ultimo punto rimasto.',
    categoria: CODICE,
    ordine: 292,
  },

  {
    chiave: 'coda-ultimi-due-buchi',
    titolo: 'I due punti della coda senza test, e le scadenze che rispondevano in due modi',
    dettaglio:
      'Coda della voce 258, chiusa il 19/8. Nell\'handoff (§4.4) era scritto che due letture erano state corrette **senza un test dedicato**, e che non era una dimenticanza: stava lì perché un giorno qualcuno le avrebbe rilette chiedendosi se erano coperte. **1)** I compiti G0…G7 della prova si contano dal giorno d\'inizio, quindi ci si arriva solo a partenza avvenuta: se lì lo stato dice ancora `queued` vuol dire che la promozione notturna è in ritardo — e intanto quella cliente **sta ricevendo i menu**. Col solo `active` il riquadro la contava fra le «prove attive» e la coach non trovava nessuna riga di lavoro: un numero e una lista che si contraddicono fanno smettere di fidarsi di tutti e due. **2)** `trial_measures_ok` (il punto A del report A→B) non nasceva per una prova in coda, e il funnel del lancio contava meno prove col punto A di quelle vere — ⚠️ differenza invisibile ovunque tranne che nel grafico, mesi dopo. **3)** Le **scadenze in arrivo**: la dashboard della coach le conta comprese le code, l\'appunto in Calendario — stesso identico evento — no. ⚠️ Due schermate che rispondono diversamente alla stessa domanda tolgono credito a tutte e due. 4 test, e in tutti il finto Prisma **filtra come il database vero**: un doppio che risponde uguale a chiunque chieda avrebbe fatto passare i test anche sul codice sbagliato — è successo a metà dei test scritti quel giorno, prima di accorgersene. Nessuna migrazione.',
    categoria: CODICE,
    ordine: 290,
    fatta: true, // 19/8
  },

  {
    chiave: 'messaggio-quotidiano-riga-a-caso',
    titolo: 'Il messaggio quotidiano si decideva su una riga a caso',
    dettaglio:
      'Trovato il 19/8 rifacendo **col grep** il censimento dei `findFirst` su `Subscription`, cioè applicando la lezione della giornata invece di fidarsi di quello che si ricordava. `generateDailyForClient` decideva se mandare «il tuo piano di oggi» con un `findFirst` **senza `orderBy`**: con una riga sola non si vedeva, ma due righe sulla stessa cliente sono legittime — una eroga, una è in coda — e senza ordinamento il database ne restituisce **una a caso**. Bastava uscisse quella sbagliata perché il messaggio quotidiano sparisse a una cliente che il piano ce l\'ha, e tornasse il giorno dopo senza che nessuno capisse perché. ⚠️ È lo stesso difetto del caso Lorena (`abbonamento-in-corso.ts`, 11/8), nella schermata che si guarda ogni mattina — e la scrittura di `queued` lo rendeva **più probabile**, non meno: le righe candidate sono di più. Ora `findMany` + `attivoInCorso`, la stessa funzione dell\'erogazione e della pausa. ⚠️ Il secondo test mette la coda **per prima** di proposito: se qualcuno tornasse a prendere «la prima riga», si vedrebbe. ⚠️ Restano due `findFirst` senza `orderBy` su `Subscription`, ed è giusto così: cercano un `pending` per rispondere «c\'è già una richiesta non pagata?», e quella domanda non dipende da quale riga esce. 2 test, nessuna migrazione.',
    categoria: CODICE,
    ordine: 289,
    fatta: true, // 19/8
  },

  {
    chiave: 'grafici-contabilita-dodici-mesi',
    titolo: 'I grafici della contabilità mostravano un punto solo',
    dettaglio:
      'Segnalazione di Simone del 19/8, con lo screenshot: «il dato numerico va bene ma il grafico dovrebbe darmi l\'anno». I tre grafici — Incassi, Costi, Utile per mese — leggevano la serie del **periodo selezionato**, che è un mese: un pallino con sotto scritto «ago 26», e nemmeno la freccia ▲▼, perché il confronto è col punto precedente e il punto precedente non c\'era. Ora la serie è quella degli **ultimi dodici mesi** che finiscono col mese scelto. ⚠️ **Finestra mobile e non anno solare** (scelta sua): a gennaio l\'anno solare avrebbe riportato lo stesso difetto — un punto e undici caselle vuote. ⚠️ **I numeri grandi restano del mese**: «come è andato agosto» e «come sta andando» sono due domande diverse, e prima avevano la stessa risposta. ⚠️ Una **seconda chiamata** e non un campo nuovo nell\'API — l\'endpoint sa già rispondere su un intervallo qualsiasi e riempie i mesi vuoti da solo — e la serie vive in uno **stato suo**: dentro `report` sarebbe tornata al mese solo. ⚠️ E le **etichette dell\'asse si diradano** (`lib/etichetteAsse.ts`, 6 test): dodici «ago 26» su una scheda da 320 px diventano una riga grigia illeggibile, e un\'etichetta illeggibile è come un\'etichetta assente — solo che sembra messa apposta. Al massimo sei, **contando all\'indietro dall\'ultima**, che è il mese dei numeri grandi in cima. Si dirada l\'etichetta, non il dato: linea e tooltip restano su tutti i punti. Nessuna modifica al backend.',
    categoria: CODICE,
    ordine: 288,
    fatta: true, // 19/8
  },

  {
    chiave: 'audit-attore-che-non-esiste',
    titolo: 'L\'attore che non esiste: i pagamenti con carta non lasciavano una riga di registro',
    dettaglio:
      'Trovato il 19/8 rivedendo la promozione delle code, ed è più vecchio di quella voce. `AuditLog.actorId` è una **chiave esterna su `user`**, ma chi scrive nel registro non sempre ha un utente per le mani e ci mette una stringa che spiega chi è stato: `\'stripe-webhook\'` sull\'audit `commerce.payment.approve` di **tutti i pagamenti con carta**, `\'public\'` sul lead che arriva dal form del sito. L\'INSERT viola il vincolo, `AuditService` assorbe l\'eccezione — ed è giusto, un pagamento non deve fallire per una riga di registro — ⚠️ **ma la riga si perdeva in silenzio**: lo si scopre il giorno in cui si va a leggere il registro di un pagamento, cioè quando serve. ⚠️ **Scartato l\'elenco di stringhe da riconoscere**: il giorno che qualcuno ne inventa una nuova siamo daccapo, ed è quello che è successo fra la prima e la seconda. Ora, se l\'INSERT fallisce e un attore c\'era, si riprova **una volta sola** senza attore, tenendo nel `metadata` chi diceva di essere (`attoreNonUtente`) e lasciando un `warn` — un ripiego che non si vede diventa la norma. ⚠️ Se l\'attore non c\'era non si riprova: il guasto è un altro. Le righe perse **non tornano**. 3 test, nessuna migrazione.',
    categoria: CODICE,
    ordine: 287,
    fatta: true, // 19/8
  },

  {
    chiave: 'coda-vincolo-e-code-scadute',
    titolo: 'Piani sovrapposti: il cron non li crea più. Restano due strade che allungano al buio',
    dettaglio:
      'Quello che resta della voce 258, e il 19/8 sera è cambiato il verdetto. **1) Il vincolo in banca dati** che vieta due piani che erogano insieme: ⛔ **non si mette, e la ragione è una risposta di Simone** — la matita della data d\'inizio oggi permette di sovrapporre due piani *apposta*, con un avviso e una conferma («conferma e non divieto: un divieto secco si aggira cambiando la riga a mano nel database»), e lui ha deciso di **tenerla**. Un vincolo secco la trasformerebbe in un errore in backoffice. ⚠️ E c\'è di peggio: il vincolo farebbe fallire anche **il cron notturno** e **la concessione di una pausa** — cioè un piano pagato che non parte, e un\'operatrice che non riesce a concedere una pausa promessa. *Un vincolo che rompe la cassa e il cron non protegge, sposta il danno.* ✅ **Quindi si è fatto quello che il vincolo doveva ottenere, dove serviva davvero: il cron non crea più sovrapposizioni.** `promuoviCodeArrivate` guardava `id`, `status` e `startDate` e **non le altre righe della cliente**: bastava che il piano precedente si fosse allungato dopo (una pausa, un rinnovo Stripe) e la notte scriveva due piani attivi insieme — il caso Lorena firmato da un automatismo. Ora una coda che finirebbe addosso a un altro piano **non si promuove**, resta `queued` (la cliente continua a ricevere i menu del piano in corso) e si vede in `npm run diag:coda`, che ha una sezione nuova. ⚠️ **Toccarsi non è sovrapporsi**: la coda che parte il giorno in cui finisce il piano prima è il passaggio di testimone normale, ed è il caso più frequente — c\'è un test apposta, perché senza il controllo nuovo avrebbe spento **ogni** rinnovo, in silenzio. ⚠️ E la regola di sovrapposizione è **quella della matita**, importata: due funzioni che rispondono alla stessa domanda divergono, e il giorno che divergono l\'avviso in scheda e il cron raccontano due storie diverse sulla stessa cliente. ⛔ **RESTANO DUE STRADE CHE ALLUNGANO AL BUIO, e sono due domande per Simone**: (a) **la pausa** — `pause.service` somma i giorni alla fine del piano in corso **senza guardare se dietro c\'è una coda già pagata**: è esattamente ciò che nel caso Lorena ha portato il piano #2 al 01/09. Cosa deve fare una pausa che sbatterebbe contro la coda: allungare comunque e **spostare in avanti anche la coda**, rifiutarsi, o allungare e avvisare? (b) **il rinnovo Stripe** — `handleInvoicePaid` riscrive `endDate` alla fine del periodo pagato, incondizionatamente: se dietro c\'è una coda, la scavalca. ⚠️ Nessuna delle due oggi fa danno in produzione (`diag:coda`: zero sovrapposizioni), e da stasera il cron non le trasforma più in due piani attivi — ma restano due modi in cui una data si allunga senza che nessuno lo dica. **2) Le code arrivate a scadenza senza mai partire**: `promuoviCodeArrivate` non le promuove — da attive-e-finite prenderebbero il report di fine percorso, la chiusura CRM e (sulle prove) la cancellazione della personalizzazione, e nessuna delle tre si torna indietro — quindi restano `queued` e si vedono in `diag:coda`. ⛔ Cosa farne è una decisione di Simone, una per una: rimborso, partenza posticipata, o piano nuovo. Oggi in produzione non ce n\'è nessuna. ✅ **Chiusa il 19/8 sera dalla risposta di Simone**: «non ci sono anomalie di questo tipo, l\'unica esistente è stata corretta, quindi se ora vanno in coda il punto è chiuso». ⚠️ E la stessa sera è arrivato il resto: il cron non le crea più (e quando ne trova una **apre una segnalazione**, invece di lasciarla ferma in silenzio), la pausa fa scorrere la coda, il rinnovo Stripe che scavalca lo scrive. Il vincolo in banca dati **non si mette**, ed è una decisione: la matita deve poter sovrapporre due piani apposta.',
    categoria: CODICE,
    ordine: 286,
    fatta: true,
  },

  {
    chiave: 'scheda-ricetta-porzione',
    titolo: 'La scheda della ricetta con le grammature di QUESTA cliente, non quelle di catalogo',
    dettaglio:
      'La coda della voce 255, chiusa il 18/8. `GET /recipes/:id` rispondeva con la ricetta di **catalogo** perché non sapeva di quale giorno si parlasse: chi ha la porzione ingrandita leggeva «Pranzo 891 kcal» nel menu, apriva la ricetta e trovava gli ingredienti per 495. Due numeri che si contraddicono sotto gli occhi della stessa persona, e fino a oggi a turare il buco era una **frase** — «pesa gli ingredienti per 1,8 volte» — cioè un conto a mano chiesto a chi sta cucinando. Ora la richiesta porta **giorno e slot** e il server risponde con le grammature già scalate. ⚠️ **Il fattore NON si passa**: l\'app ce l\'ha, ma accettarlo vorrebbe dire che il telefono decide quanto cibo compare nella scheda — si rilegge dallo snapshot di quella cliente, che è l\'unico posto dove è stato deciso, e il giorno si legge sempre come **proprio** (`user.sub`). ⚠️ **Scala il server e non l\'app**: la regola di arrotondamento è `quantitaScalata`, la stessa della lista della spesa — riscriverla di là sarebbero due risposte alla stessa domanda, e il giorno che la nutrizionista chiedesse di arrotondare i pezzi la lista e la scheda direbbero due numeri diversi. ⚠️ **E la scalatura è a richiesta, non automatica**: finché non esce l\'OTA le clienti hanno l\'app che dice ancora «pesa per 1,8 volte», e riceverle già scalate le farebbe pesare ×3,24. Chi non manda `giorno` riceve esattamente quello che riceveva prima — c\'è un test che tiene ferma proprio questa riga. ⚠️ Tre stati, e il terzo è quello che fa male: se la giornata non si trova — o il piatto compare due volte con fattori diversi e non sappiamo in quale pasto siamo — la scheda resta di catalogo **e lo dice**, rimettendo l\'istruzione di pesare a mano. `PORZIONE_DA_DIRE` (1,05) è la soglia sotto la quale non si scala e non si dice niente, ed è **la stessa** che decide la riga nel menu: un test per parte tiene fermo il numero, perché se divergessero gli ingredienti cambierebbero senza che nessuno spieghi perché. 15 test nuovi. Nessuna migrazione. ⛔ **Della voce 255 restano**: i **giorni già erogati** (`menuDay.upsert` ha `update: {}`) — verificato: sono al massimo `menu_days_delivered` giorni per cliente, quindi il buco si chiude da sé nel giro di un paio di giorni, non è un arretrato; il **kit di rientro**, che copia `meals` così com\'è; la **lista della spesa già in cache** (chiusa a sua volta la sera stessa, voce 281); e ⚠️ **i pezzi**, che è una decisione della nutrizionista.',
    categoria: CODICE,
    ordine: 280,
    fatta: true, // 18/8
  },

  {
    chiave: 'lista-spesa-si-rifa',
    titolo: 'La lista della spesa si rifà a ogni apertura: quello che si conserva sono le spunte',
    dettaglio:
      'Chiusa il 18/8, ed è più vecchia della voce 255. `shoppingList` teneva una riga per `(cliente, dal, al)` e, se la trovava, **la restituiva così com\'era**: nessuno la invalidava mai. Quindi tutto quello che cambia la giornata **dopo** che la lista è nata non arrivava nel carrello — le **porzioni scalate** del 18/8 (chi aveva già la lista continuava a comprare il cibo della porzione piccola), il **piatto cambiato in chat** con Gaia, le «ricette semplici», il piatto non gradito sostituito in erogazione, e la **grammatura corretta in backoffice** dalla nutrizionista. ⚠️ E non lo diceva nessuno: la lista *sembrava* la lista di quei giorni — il difetto di famiglia del progetto, dentro l\'unica schermata che si guarda spingendo un carrello. ⚠️ **Scartata la strada delle date** («se un giorno è stato toccato dopo che la lista è nata, rifalla»), e per due motivi che bastano da soli: `ShoppingList.updatedAt` lo muove **anche la spunta** (è la lezione della voce 275), e `MenuDay.updatedAt` lo muove `deliverIfEligible`, che gira a **ogni apertura dell\'app** — il confronto sarebbe stato sempre vero o sempre falso, e sbagliato in silenzio. Ora la lista si **ricalcola** a ogni lettura (costa la query sulle ricette dei sette giorni, cioè quello che costava comunque la prima volta) e la riga in tabella smette di essere una copia: diventa il posto dove vive l\'unica cosa che il server non sa ricostruire, cioè **cosa hai già messo nel carrello**. ⚠️ Si **scrive solo se è cambiato qualcosa** (`stessaLista`, che confronta per contenuto e non per ordine): la lista si rilegge molte volte al giorno e una scrittura per lettura muoverebbe `updatedAt` senza che sia successo niente. ⚠️ La **quantità non si conserva** insieme alla spunta: se il piatto è cresciuto, i 120 g diventano 216 anche su una riga già spuntata — chi ha già comprato lo vede e decide, tenere il numero vecchio vorrebbe dire nasconderle che gliene serve di più. Modulo puro `menu/lista-della-spesa.ts` (aggrega, conserva le spunte, confronta), 13 test. Nessuna migrazione. ⛔ **Della voce 255 resta solo la decisione sui pezzi**: il kit di rientro è stato chiuso la sera stessa (voce 282).',
    categoria: CODICE,
    ordine: 281,
    fatta: true, // 18/8
  },

  {
    chiave: 'kit-rientro-riporziona',
    titolo: 'Il kit di rientro non ricopia le giornate: le riporziona sul fabbisogno di adesso',
    dettaglio:
      'Chiusa il 18/8, e con lei si chiude la voce 255 tranne la decisione sui **pezzi**. `monitoring.generateRientroMenus` — i menu che arrivano da soli a fine pausa se il peso è risalito — sceglie i giorni che su quella cliente avevano funzionato meglio e li **ricrea nei giorni successivi copiando `meals` così com\'è**. ⚠️ È l\'unico posto del progetto dove una giornata di ieri diventa una giornata di domani **senza passare da `deliverIfEligible`**, e copiarla di peso sbaglia in due modi: **1)** una giornata scritta prima del 18/8 non ha nessun fattore, quindi il kit rimetterebbe nel futuro una giornata al 65% — e ⚠️ **nessuno la aggiusterebbe più**, perché l\'erogazione compone solo le date che non esistono ancora e il suo `upsert` ha `update: {}`: il rimedio delle porzioni scalate le passerebbe accanto senza vederla; **2)** una giornata scalata mesi fa porta un fattore dimensionato su un fabbisogno che oggi non è più il suo. ⚠️ E il modo sbagliato di rimediare è **scalare quello che è già scalato**: 891 × 1,8 fa 1603, cioè ×3,24 sulla ricetta — si torna sempre alla porzione di catalogo prima di riscalare, ed è per questo che `kcalBase` esiste. ⚠️ `porzione` si **toglie** e non si mette a 1: l\'app distingue «assente» da «presente», e un `porzione: 1` direbbe alla cliente che qualcosa è stato deciso sulla sua porzione quando non è vero. ⚠️ **Senza fabbisogno calcolabile non si tocca niente** — riportare la giornata al catalogo «perché non sappiamo» le rimpicciolirebbe il piatto in silenzio, e «non si rimpicciolisce mai» è la regola con cui la strada C è stata decisa — **ma si scrive nei log**, perché chi legge deve sapere che quelle porzioni sono quelle di allora. La scalatura passa da `porzioniScalate`, la stessa funzione dell\'erogazione: se domani i tetti cambiano, il kit di rientro cambia con lei. Modulo puro `menu/riporziona-giornata.ts` (8 test) + il primo test di `generateRientroMenus`, che non ne aveva nessuno (3). `MonitoringModule` importa `MenuModule` per `KcalNeedService` (nessun ciclo). Nessuna migrazione.',
    categoria: CODICE,
    ordine: 282,
    fatta: true, // 18/8
  },

  {
    chiave: 'esclusioni-questionario',
    titolo: 'Le esclusioni scritte come frasi: adesso l\'avviso c\'è anche nel QUESTIONARIO',
    dettaglio:
      'Chiusa il 18/8 sera. La regola («le esclusioni devono essere un elenco, ogni parola seguita da una virgola, aiutiamo le clienti a scrivere in modo corretto» — Simone, 18/8) era arrivata su **quattro porte**: profilo in app, pulsante «non gradisco», scheda backoffice, scheda coach. ⚠️ **Restava fuori proprio il questionario, che è la porta d\'ingresso vera**: è lì che quasi tutte le esclusioni vengono scritte la prima volta, e «pesce tranne salmone» scritto lì non toglieva niente dal menu senza che nessuno glielo dicesse. ⚠️ **Qui non si scarta e non si blocca**, ed è la differenza con le altre quattro: là la voce non viene salvata e il testo torna nel campo, perché lei è a un dito da quel campo; qui siamo dentro il **cancello del carrello**, e fermare il questionario per una frase scritta male vuol dire lasciare una cliente in mezzo al percorso. Si salva quello che ha scritto, si dice cosa succede davvero, e si dice **dove correggerlo** (Profilo → Cibi esclusi). ⚠️ Si guarda quello che arriva **prima** del filtro spezie, come fa il profilo: una frase scritta male non è un problema di spezie. ⚠️ Il campo di risposta è **suo** (`aiutoEsclusioni`) e non dentro `avvisiEsclusioni`: quella lista l\'app la mostra sotto il titolo «Allergie e intolleranze», e questa non è né l\'una né l\'altra — così l\'app pubblicata, che il campo nuovo non lo conosce, non mostra una frase sotto il cartello sbagliato. Le parole restano quelle del server (`common/esclusioni-scritte-bene.ts`), che è l\'unico posto dove la regola vive. 3 test. Nessuna migrazione. ⚠️ Arriva alle clienti con la **prossima pubblicazione o OTA**.',
    categoria: CODICE,
    ordine: 283,
    fatta: true, // 18/8
  },

  {
    chiave: 'sostituzioni-non-scalate',
    titolo: 'Le sostituzioni di Gaia arrivano nel carrello e nella scheda ricetta',
    dettaglio:
      'Aperta e chiusa la notte del 18/8: l\'ha trovata la revisione, ed era un difetto **precedente** alle consegne della sera — sono state loro a renderlo visibile. ⚠️ **La lista della spesa non applicava le sostituzioni**: `aggregaSpesa` leggeva gli ingredienti per `recipeId` e ignorava `pasto.substitutions`, quindi chi aveva concordato «carote → biete» con Gaia comprava le carote (per giunta scalate ×1,8) e zero biete — un errore che non si vede nell\'app e si vede al banco frigo. ⚠️ **E la scheda ricetta faceva lo stesso**: mostrava l\'ingrediente di catalogo a chi ne aveva un altro nel piatto. ⚠️ La funzione giusta **esisteva già** — `ingredientiEffettivi` — ma stava **dentro `sostituzione-chat.service.ts`**, cioè dentro un servizio che si porta dietro audit, config, segnalazioni e Vera: chi aveva bisogno solo di quella regola non poteva chiamarla senza tirarsi dietro tutto il resto, e infatti non la chiamava. **Una funzione difficile da chiamare è una funzione che qualcuno dimenticherà**: adesso vive da sola in `menu/ingredienti-effettivi.ts`, senza dipendenze, e la importano tutti e tre i posti che rispondono alla stessa domanda. ⚠️ **Prima si sostituisce, poi si scala**: invertendo si scalerebbe un ingrediente che quella cliente non ha più. ⚠️ E serviva separare due cose che sembravano una: `pastoDelGiorno` trova il pasto **anche quando non c\'è nessun moltiplicatore**, perché un piatto non scalato può avere lo stesso una sostituzione — chiedendo solo la porzione, la scheda continuava a mostrare le carote. ⚠️ Terza cosa, nell\'app: sul piatto scalato la riga della sostituzione **non dice più le grammature** ma solo «carote → biete». `fromQty`/`toQty` sono scritte una volta sola, al momento dell\'accordo in chat, e sono di catalogo: su un pranzo ×1,8 quella riga diceva «100 g → 120 g» due righe sopra a una scheda che dice 216 e a una riga che dice «nella ricetta trovi già le tue quantità» — tre numeri per la stessa cosa, e chi cucina ne sceglie uno. ⚠️ Non si scalano nell\'app: la regola di arrotondamento vive nel server e riscriverla di là sarebbe la terza copia. 9 test nuovi. Nessuna migrazione.',
    fatta: true, // 18/8, notte
    categoria: CODICE,
    ordine: 284,
  },

  {
    chiave: 'sostituzioni-numeri-altrove',
    nata: '2026-08-18',
    titolo: 'Le grammature delle sostituzioni fuori dall\'app: Gaia, la scheda coach e i passi della ricetta',
    dettaglio:
      'Coda della voce 284, aperta dalla revisione della notte del 18/8. Nell\'app la riga della sostituzione sul piatto scalato non dice più le grammature, perché sono quelle di **catalogo** e la scheda ricetta ne dice altre. ⚠️ **Ma il numero nasce in chat**, e lì non è cambiato niente: Gaia dice «a pranzo metti 120 g biete al posto di 100 g carote» mentre nella ricetta ce ne sono 216 — e la chat è il posto dove la cliente ha detto «sì» e dove torna a controllare (`menu/sostituzione-chat.ts`, sei frasi). ⚠️ Stessa cosa nella **tabella «cambi in chat» del backoffice** (`ClientDetail.tsx`): la nutrizionista che approva o corregge la grammatura ragiona su 120 g mentre nel piatto ce ne sono 216, e da quando l\'app quel numero non lo mostra più, quello del backoffice è rimasto l\'unico «ufficiale» accanto a quello della ricetta. `pasto.porzione` è disponibile in tutti quei punti: non è un dato che manca, è un dato che non si legge. ⚠️ E c\'è un terzo pezzo: la scheda ricetta adesso dice «biete» negli **ingredienti** e «carote» nei **passi di cottura** (`cookingMethods[].steps`, che escono dal catalogo intatti) — riguarda solo le ricette generate dal motore, che i passi ce li hanno. ✅ **CHIUSA il 19/8. Simone ha scelto: il numero del PIATTO.** Gaia e la tabella del backoffice dicono adesso la grammatura scalata sul fabbisogno di quella cliente — l\'unica che può usare in cucina — e l\'arrotondamento passa dalla **stessa** `quantitaScalata` della scheda ricetta e della lista della spesa: due arrotondamenti diversi darebbero «216 g» di là e «215 g» di qua, che si legge come un errore di misura invece che come una regola. ⚠️ In banca dati i numeri restano **di catalogo**: sono quelli scritti sul menu, e il piatto viene scalato al momento di mostrarlo — salvarli già scalati vorrebbe dire scalarli due volte (120 → 216 → 389), e nessuno se ne accorgerebbe finché una cliente non cucina. Il fattore viaggia accanto ai numeri e si applica **solo quando si parla**. ⚠️ Sotto il 5% non si scala niente: è la soglia che decide anche la riga «porzione più abbondante» nel menu, e scalare comunque farebbe dire alla chat un numero che da nessun\'altra parte compare. ⚠️ Nel backoffice si dice anche **che il piatto è scalato**, col numero di catalogo accanto: chi apre il catalogo trova 120 g e deve capire perché qui ne legge 216, invece di pensare a un errore. **Il terzo pezzo — i passi di cottura — si chiude in un altro modo**: ⚠️ i passi **non si riscrivono**, perché cambiare una parola dentro una frase dà «la porro» e «biete tagliate a rondelle», cioè italiano sbagliato e istruzioni sbagliate — la stessa ragione per cui su «pesce tranne salmone» non correggiamo noi. Si **dice**, sopra i passi: «qui sotto trovi ancora «carote»: al loro posto usa «biete»». ⚠️ E solo per gli alimenti **nominati davvero** nei passi, cercati come parola e non come sottostringa: una nota che avverte di un ingrediente che lì non c\'è insegna a saltare le note.',
    categoria: CODICE,
    ordine: 285,
    fatta: true, // 19/8
  },

  /**
   * ⚠️ LE TRE RIGHE DOPPIE DEL 13/8 (voce 224). Non sono lavori: sono duplicati rimasti in pagina
   * con una chiave diversa da quella delle voci vere — che sono, nell'ordine,
   * `vera-dashboard`, `vera-ai-assistant-enabled` e `vera-dizionario-comune-conflitto`.
   * `soloSeEsiste` fa in modo che il caricamento le spunti se le trova e non le inventi se non ci
   * sono. ⚠️ Non si CANCELLANO, si spuntano: in pagina può esserci sopra un commento di qualcuno.
   */
  {
    chiave: 'vera-moduli-dashboard',
    titolo: 'Doppione del 13/8 — vedi «Vera: i moduli in dashboard "quello che aspetta me"»',
    dettaglio: 'Riga duplicata rimasta in pagina: la voce vera ha la chiave `vera-dashboard`. Chiusa il 18/8.',
    categoria: MANUTENZIONE,
    ordine: 900,
    fatta: true,
    soloSeEsiste: true,
  },
  {
    chiave: 'ai-assistant-enabled',
    titolo: 'Doppione del 13/8 — vedi «`ai_assistant_enabled` è "false" in produzione»',
    dettaglio: 'Riga duplicata rimasta in pagina: la voce vera ha la chiave `vera-ai-assistant-enabled`. Chiusa il 18/8.',
    categoria: MANUTENZIONE,
    ordine: 901,
    fatta: true,
    soloSeEsiste: true,
  },
  {
    chiave: 'dizionario-promossa-a-comune',
    titolo: 'Doppione del 13/8 — vedi «Voce di dizionario promossa a comune»',
    dettaglio: 'Riga duplicata rimasta in pagina: la voce vera ha la chiave `vera-dizionario-comune-conflitto`. Chiusa il 18/8.',
    categoria: MANUTENZIONE,
    ordine: 902,
    fatta: true,
    soloSeEsiste: true,
  },

  {
    chiave: 'ricerca-per-sottostringa',
    titolo: 'Gaia trovava «mela» dentro «melanzane»: la ricerca ora va a parole intere',
    dettaglio:
      'Trovata dalla revisione avversariale del 19/8 sera. ⚠️ **Non era un difetto nuovo**: è come la ricerca degli alimenti ha sempre funzionato — per rispondere a «quante calorie ha X?» si cercano i nomi della tabella **dentro** il testo della domanda, come pezzi di testo, e i pezzi di testo si incastrano dove non dovrebbero. ⛔ Il danno era che Gaia rispondeva con le calorie di **un altro alimento**, con un numero plausibile che nessuno contesta. ⚠️ **La ragione per cui non l\'avevo corretta subito era falsa**, e va scritto: avevo detto «a parole intere si perdono i plurali», ed è falso — «melanzana» non è dentro «melanzane», «mela» non è dentro «mele». *Una ragione falsa fa scegliere per il motivo sbagliato, ed è peggio di una scelta sbagliata.* La ragione vera era che lo stesso meccanismo che sbaglia è quello che salva: «pomodorini» trova «pomodori» esattamente come «melanzane» trova «mela». **Quindi ho fatto la misura, non la correzione** (`npm run diag:ricerca`, che confronta i due modi usando il codice di produzione e non una sua copia). ✅ **Il numero, dalla produzione del 19/8 sera: 40 trappole, e tutte e 40 possono scattare** — «melanzane/melanzana»→mela (1025 usi), «denocciolate»→nocciola (385, cioè le olive denocciolate contate come nocciole a 628 kcal), «melagrana»→grana (72, il melograno diventa il parmigiano), «cipollotto»→pollo (55), «pescatrice»→pesca (32), «surgelato/congelato»→gelato (45), «datterini»→datteri (22, 18 kcal contro 280), «fagiolini»→fagioli (15, 31 contro 300). ⚠️ E quelle **giuste** erano tre in tutto: «pomodorini», «pomodorino» → pomodori e «spinacino» → spinaci. Circa **1700 usi sbagliati contro 231 giusti**. ⚠️ Sulle domande vere invece il cambio non toglieva e non aggiungeva niente: in tutta la storia della chat ci sono 210 messaggi di clienti e **una sola** domanda nutrizionale — la trappola era **carica ma non ancora scattata**. ✅ **Simone ha scelto le parole intere il 19/8 sera, e sono in produzione dalla consegna dopo.** Perdere i tre casi buoni non è un danno: quando Gaia non trova «pomodorini» dice «non ce l\'ho» e il termine finisce fra i mancanti, che è **il modo in cui la tabella cresce guidata dalle domande vere** — un «non lo so» si vede e diventa una riga, «44 kcal» detto dalla mela non si vede. ⚠️ **I due modi restano tutti e due nel codice** perché `diag:ricerca` continua a confrontarli: il giorno che la tabella si riempie, la stessa misura dirà se il pezzo di parola è tornato a valere qualcosa. ⚠️ **Resta aperto quello che la misura ha scoperto per caso**: quei 40 nomi non sono in tabella (melanzane, fagiolini, datterini, cipollotto, pescatrice, olive denocciolate…) — è la lista 3b, e sta nella voce dei nomi liberi degli ingredienti.',
    categoria: SIMONE,
    ordine: 610,
    nata: '2026-08-19T22:30',
    priorita: 'bassa',
    fatta: true,
  },

  {
    chiave: 'misure-come-si-prendono',
    titolo: 'Come si prendono le misure: la cliente non lo sa, e per settimane le abbiamo promesso un video che non c\'era',
    dettaglio:
      'Trovato il 19/8 sera cercando tutt\'altro (la voce sulle schermate 30 e 27-28). La pagina delle **misure di partenza** del questionario diceva a ogni cliente: «Se non sai come prenderle, **guarda il video toccando il pulsante**». ⛔ Il pulsante non c\'è e il video non c\'è — in tutta l\'app non esiste nessun `<video>`, nessun asset, nessun handler. La frase veniva dal prototipo, dove le schermate 28-29 erano due video di presentazione: ⚠️ quei video **li ha annullati Simone il 17/07**, e il testo che li citava è rimasto in produzione per settimane. ⚠️ *Un difetto di testo non è un difetto minore quando il testo è una promessa*, e questa stava nel punto più delicato del questionario — le prime misure di una persona. Chi cercava il pulsante e non lo trovava pensava di aver sbagliato lei. ✅ **La bugia è tolta il 19/8 sera**, e al suo posto c\'è una cosa vera: «scrivimelo in chat: te lo spiego io» — la chat c\'è e le risponde una persona. C\'è anche un test che impedisce ai testi del questionario di promettere di nuovo un video o un pulsante che il prodotto non ha. ⛔ **Resta la domanda vera, e non è di software**: vita e fianchi si possono misurare in modi diversi e la differenza è di centimetri, cioè di quello che poi il motore legge come progresso. Come vogliamo dirglielo — un disegno, tre righe di testo scritte dalla nutrizionista, un video vero — lo decidono Simone e Lucia. Finché non è deciso, la chat regge: è lenta ma è onesta.\n\n✅ **CHIUSA il 20/8: il video c\'è.** Simone ha girato e caricato il video di come si prendono vita e fianchi; l\'ho compresso (15,6 MB → 2,1 MB, perché un video che non parte su rete mobile è un video che non c\'è) e messo **nel popup delle misure** dell\'app, sopra i campi Vita e Fianchi. Si apre solo al tocco: chi sa già come si fa non si trova un video che parte da solo. ⛔ **E questa voce è rimasta scritta come se non fosse successo niente per dodici ore**, finché Simone non me l\'ha dovuto dire due volte. È lo stesso difetto che la voce racconta — un testo che promette una cosa che il prodotto non ha più — fatto da me sull\'elenco dei lavori invece che sul questionario. Una voce che descrive male la realtà è peggio di una voce che non c\'è: la prima fa perdere tempo a chi la legge.',
    categoria: SIMONE,
    ordine: 620,
    nata: '2026-08-19T23:40',
    priorita: 'bassa',
    fatta: true,
  },

  /**
   * ⚠️ LE TRE VOCI SCRITTE A MANO IN PAGINA CHE OGGI RISULTAVANO APERTE SU LAVORI GIÀ FATTI.
   *
   * Hanno `chiave: null` in banca dati — le ha scritte Simone dal backoffice — quindi il file non le
   * ha mai viste. Il 19/8 sera mi sono costate tre indagini: ogni volta sono partito per fare il
   * lavoro e ogni volta era già fatto. Da stasera il caricamento le può **chiudere per titolo**
   * (`soloSeEsiste`), che è l'unica cosa che identifica una riga scritta a mano.
   *
   * ⛔ Chiudere, mai creare: se in pagina il titolo non c'è, per il caricamento non esiste.
   */
  {
    chiave: 'pagina-schermate-30-27-28',
    titolo: 'Schermate app 30 (assaggio menu) e 27-28 (video onboarding)',
    dettaglio:
      'Chiusa il 19/8 sera. ⚠️ Erano **due cose già annullate**, e la voce le teneva vive da sola: l\'assaggio del menu (30) non è mai esistito nel codice ed era stato superato da «Conosciamoci» il 13/8; i video erano le schermate **28-29** (non 27-28: la voce mescolava due numerazioni) e li ha annullati Simone il **17/07**. ⚠️ Cercandoli è saltato fuori un difetto vivo: la pagina delle misure di partenza prometteva a ogni cliente «guarda il video toccando il pulsante», e il pulsante non c\'era — corretto lo stesso giorno.',
    categoria: CODICE,
    ordine: 950,
    fatta: true,
    soloSeEsiste: true,
  },
  {
    chiave: 'pagina-vera-giorni-futuri',
    titolo: 'Vera: rifare i giorni futuri non ancora aperti quando il capo approva un divieto di dieta',
    dettaglio:
      'Chiusa il 19/8 sera, ma **era già fatta dal 18/8**: il rifacimento sta in `applica-proposta.ts`, tetto compreso. ⚠️ Non si vedeva per colpa di un commento venti righe sopra il codice che lo fa, che diceva «si rifanno in un secondo momento» e rimandava a una voce di elenco lavori **mai esistita**. *Un commento che descrive come da fare un lavoro fatto è una trappola.* Corretto, e aggiunti i tre test che mancavano sul tetto dei 200 (la regola si scrive comunque · 200 non è «oltre» · il tetto conta le persone, non le giornate).',
    categoria: CODICE,
    ordine: 951,
    fatta: true,
    soloSeEsiste: true,
  },
  {
    chiave: 'pagina-moduli-dashboard',
    titolo: 'Moduli fissi in dashboard',
    dettaglio:
      'Chiusa il 19/8 sera, e **il nucleo era già fatto dal 18/8**: nessun modulo fisso, tutti accendibili, spegnibili e trascinabili, i predefiniti col bordo colorato, il pulsante «Ripristina default» con conferma. ⚠️ Rileggendo la richiesta fino in fondo («se un utente **si è perso** preme il pulsante») è emerso che il pulsante rimetteva **solo i moduli**: chi si era perso spegnendo il portafoglio o la tabella clienti non recuperava niente. Ora rimette tutta la home — moduli, blocchi, grafici e scorciatoie — in una scrittura sola. ⛔ L\'ordine del menu no: ha il suo pulsante nel suo riquadro.',
    categoria: CODICE,
    ordine: 952,
    fatta: true,
    soloSeEsiste: true,
  },

  /**
   * ⚠️ UNA VOCE SOLA PER DUE COSE, e non è pigrizia: le fa la stessa persona, sulla stessa tabella,
   * nella stessa mezz'ora. Due voci separate farebbero crescere l'elenco senza aggiungere una
   * decisione — e un elenco che cresce a ogni consegna smette di dire quanto lavoro c'è davvero.
   */
  {
    chiave: 'tabella-alimenti-igiene',
    titolo: 'Tabella alimenti: cinque righe da dichiarare, e 1350 ricette da capire',
    dettaglio:
      'Due lavori di mezz\'ora sulla tabella alimenti, tutti e due nati guardando la pagina vera il 20/8. **1) Le cinque righe che non hanno uno stato, e non devono averlo.** In cima all\'elenco «Alimenti da correggere» stanno `olio extravergine di oliva` (3025 ricette), `olio evo` (1706), `miele` (1331), più sale e zucchero: risultano «Senza stato». ⚠️ Ma all\'olio lo stato **non si applica** — crudo o cotto è la stessa cosa, 899 kcal restano 899. ⛔ Finché restano vuote fanno due danni invisibili: ogni ricetta dettata a Vera con l\'olio si porta dietro «la tabella non dice se il valore è a crudo» (*un avviso che compare sempre non è un avviso*, e compare sull\'ingrediente più usato del catalogo), e quelle righe occupano i primi posti dell\'elenco **nascondendo quelle da correggere davvero**. ✅ Dal 20/8 il valore c\'è: matita → campo Stato → «non si applica». Cinque righe. ⚠️ **Non si deduce, si dichiara**: nessuna regola indovina quali alimenti non hanno stato, e una che ci provasse sbaglierebbe sul primo caso nuovo in silenzio. **2) «spinaci freschi»: 1350 ricette che non si abbinano.** In elenco risulta «Non in tabella», e non dovrebbe: la regola dice che «freschi» è innocuo quando la riga è a crudo, e gli spinaci in tabella ci sono. ⚠️ L\'ipotesi è che la riga «spinaci» abbia lo **stato vuoto** — dal 19/8 sera «fresco» si accetta solo se combacia con lo stato della riga, e con lo stato vuoto non combacia niente. ⛔ **Ma è un\'ipotesi, e il 20/8 mi ha già morso due volte ragionare su dati immaginati invece che letti**: si legge con `NOME=\'spinaci freschi\' npm run diag:crudo-cotto`, che spiega passo per passo dove finisce quel nome e perché. Se è lo stato vuoto, è un campo — e lo stesso vale probabilmente per «prezzemolo fresco» (1207), «basilico fresco» (826) e «timo fresco» (670), che però sono aromi e pesano zero: quelli si tolgono dall\'elenco, non si correggono.\n\n✅ **20/8 sera — l\'import è andato, e questa voce si è ristretta.** `npm run diag:crudo-cotto` dopo il caricamento dei 277 alimenti: **286 alimenti hanno la riga a crudo** (lista 4), che è la lista che conta. E **«spinaci freschi» c\'è**, a 31 kcal crudo: l\'ipotesi dello stato vuoto era giusta, ma non serve più indagarla — l\'import ha creato la riga.\n\n⛔ **Resta il punto 1, ed è ancora il primo dell\'elenco**: `olio extravergine di oliva` (3024 ricette) e `miele` (1333) risultano «senza stato», più sale e zucchero. ⚠️ E adesso si sa **perché** sono senza stato — il seed li azzera a ogni deploy, vedi `seed-nutrienti-firma-falsa` — quindi scrivere «non si applica» dalla matita **oggi non basta**: al primo deploy tornerebbe vuoto. Questa voce aspetta quella.\n\n⚠️ Sulla lista 1 di `diag:crudo-cotto` una nota per non spaventarsi: delle 19 righe «solo da cotto», quindici sono corrette così — «ceci cotti», «riso integrale cotto», «quinoa cotta»: è la **ricetta** a dire cotto, quindi il valore da cotto è quello giusto. Le altre quattro — `pane di segale (da cotto)`, `zucca (da cotto)`, `ceci (da cotto)`, `lenticchie (da cotto)` — hanno il nome vecchio come sinonimo **apposta**, perché Gaia risponda «dipende» invece di dare un numero solo.',
    categoria: SIMONE,
    ordine: 615,
    nata: '2026-08-20T08:10',
  },

  {
    chiave: 'mese-confine-provvigioni',
    titolo: 'Provvigioni: controllare se il confine di mese sbagliato è già costato qualcosa',
    dettaglio:
      'Il difetto è **chiuso** (20/8): la parte economica prendeva il mese e il giorno nel fuso del **server** — su Render `TZ` non è impostata, quindi UTC — invece che in quello di Roma. Fra mezzanotte e le 02:00 del primo del mese, a Roma è mese nuovo e per il server no. ⛔ Tre conseguenze: **1)** una provvigione accreditata in quelle due ore veniva contata nel **mese precedente**, e per chi ha un tetto di guadagno quel mese era già pieno — l\'importo veniva tagliato e, siccome l\'eccedenza non slitta (decisione dell\'11/8), **perso**, senza una riga a registro e senza un errore; **2)** la finestra prelievi «dal 1 al 7» risultava chiusa nelle prime due ore del giorno 1 e aperta in quelle del giorno 8; **3)** la pagina «Compensi staff» filtrava il mese con un confine diverso da quello con cui il tetto aveva contato le stesse righe. ⚠️ È **lo stesso difetto già chiuso il 7/8 sulle misure** (la pesata delle 00:30 che sovrascriveva quella del giorno prima): sulle date delle clienti era stato corretto, sui soldi no — e il fuso giusto stava già in `common/date-only.ts`. ⛔ **Quello che resta è una misura, non un lavoro**: sapere se è già successo a qualcuno. Un comando, sola lettura, dalla shell di Render: `npm run diag:mese-confine`. Dice quante provvigioni sono nate nella fascia spostata e — la domanda che conta — se il tetto ha mai tagliato qualcosa lì vicino (lo legge dall\'audit, l\'unico posto dove un taglio lascia traccia). Se stampa zero tagli, il punto si chiude in trenta secondi; se ne stampa qualcuno, quei soldi si recuperano con «Ricalcola provvigioni» sul pagamento indicato.\n\n✅ **CHIUSA la sera del 20/8.** Simone ha lanciato `npm run diag:mese-confine`: **nessun taglio del tetto** (\'il tetto non ha mai morso\') e **zero righe** scritte nella fascia spostata, su sei righe di compenso in tutto. La domanda che poteva costare soldi a qualcuno è chiusa: il difetto era reale e corretto, ma non ha fatto in tempo a colpire nessuno. ⚠️ Resta vero il motivo per cui valeva la pena guardare: se le provvigioni fossero state cento invece di sei, la stessa misura non sarebbe stata gratis.',
    categoria: SIMONE,
    ordine: 616,
    nata: '2026-08-20T10:40',
    fatta: true,
  },

  {
    chiave: 'ricalcolo-e-tetto-mensile',
    titolo: 'Il ricalcolo provvigioni può ripagare quello che il tetto aveva tolto: va deciso',
    dettaglio:
      'Una domanda, non un difetto — ma è una decisione tua e finché non la prendi il codice ne applica una implicita. Il **tetto di guadagno** è mensile e l\'eccedenza **si perde** (decisione dell\'11/8: non slitta, non diventa accantonamento). ⛔ Il pulsante **«Ricalcola provvigioni»** però misura il tetto sul mese **in cui lo premi**, non su quello del pagamento: una quota tagliata ad agosto, se il ricalcolo gira a settembre, **viene pagata** sotto il tetto di settembre. Non è un errore di programmazione — è letteralmente cosa vuol dire «aggiungi il mancante» — ma è il modo in cui una decisione di prodotto si disfa con un clic, senza che chi clicca lo sappia. ⚠️ Le due strade: **a)** lasciarlo così (il ricalcolo è un\'azione volontaria di un admin, e se la preme è perché vuole pagare), e allora basta che il messaggio del pulsante lo dica; **b)** far escludere al ricalcolo le quote già tagliate da un tetto di un mese ormai chiuso — si può fare, l\'audit `provvigione.tetto_mensile` tiene la traccia di ogni taglio con importo, mese e `ref`. ⚠️ Non l\'ho scelto io: togliere o dare soldi a una persona non è una decisione di chi scrive il codice. Per intanto sta scritto nel docblock di `ricalcolaProvvigioni`.',
    categoria: SIMONE,
    ordine: 617,
    nata: '2026-08-20T11:20',
  },

  {
    chiave: 'allergie-fuori-dalla-guardia',
    titolo: '⚠️ Le allergie non entrano nella guardia che compone il menu: da decidere come chiuderla',
    dettaglio:
      '⛔ **Il fatto.** `evaluateMeals` — la funzione che i commenti del motore chiamano «la sicurezza» (§2/§7) — costruisce l\'elenco delle esclusioni da **intolleranze** (bloccanti) e **cibi non graditi** (sostituibili). Le **allergie** non ci sono: si leggono solo per la regola del delattosato. E la prima riga della funzione è `if (!intolerances.length && !dislikes.length) return …`, cioè una cliente che ha dichiarato **soltanto allergie** esce di lì senza che si sia guardato niente. ⚠️ Le allergie SONO controllate altrove — nelle sostituzioni di Gaia («su questo non si media»), nel pool delle ricette semplici, e nella base personale, che usa perfino i tag confermati dal nutrizionista. Tre punti su quattro: quello che manca è proprio la composizione del menu. ⚠️ **E i tag allergene confermati** (`Recipe.allergens`, quelli che un nutrizionista ha guardato uno per uno) **il motore dei menu non li legge affatto**: li legge solo la base personale. ⛔ **Perché non l\'ho corretto io.** Aggiungere le allergie all\'elenco bloccante non è una riga: `violations` fa **fermare l\'erogazione** (`return []` più escalation). Se una dieta assegnata contiene l\'allergene di una cliente, da domattina quella cliente **non riceve il menu** invece di riceverne uno sbagliato. Può darsi che sia giusto — ma è una decisione clinica, e chi scrive il codice non la prende da solo. ✅ **Il numero da cui si decide**: `npm run diag:allergeni-piatto` (sola lettura) dice quante clienti e quali piatti, negli ultimi 14 giorni e a venire, per parola chiave **e** per tag. Se è **zero**, le diete assegnate sono già scelte bene e la rete di sicurezza si aggiunge senza cambiare niente a nessuno. Se **non è zero**, quelle righe sono piatti che stanno arrivando adesso a persone che hanno dichiarato un\'allergia.\n\n✅ **CHIUSA la sera del 20/8.** Simone ha lanciato la diagnostica: **9 clienti con allergie dichiarate, 8 senza intolleranze** — cioè otto persone per cui la guardia usciva senza guardare niente — e **zero pasti** con il loro allergene negli ultimi 14 giorni e a venire. Le diete assegnate erano già scelte bene, quindi la rete di sicurezza si è potuta aggiungere senza togliere il menu a nessuno: le allergie entrano nell\'elenco bloccante come le intolleranze, e i **tag allergene confermati** sulla ricetta adesso li legge anche il motore (prima solo la base personale). ⚠️ Resta una scelta di prodotto non presa, scritta nel codice: un allergene con una sostituzione sicura fa erogare il piatto con la sostituzione annotata, esattamente come per un\'intolleranza. La variante più severa — «un allergene non si sostituisce mai» — si fa togliendo una riga, ma è una decisione clinica.',
    categoria: SIMONE,
    ordine: 600,
    nata: '2026-08-20T17:40',
    fatta: true,
  },

  {
    chiave: 'che-giorno-e-oggi-trenta-punti',
    titolo: '«Che giorno è oggi» è ancora calcolato a mano in una trentina di punti, e risponde UTC',
    dettaglio:
      'Misurato il 20/8, non stimato: `grep` su `setHours(0,0,0,0)` e `Date.UTC(d.getUTCFullYear(), …)` trova **una trentina di punti** che si calcolano «oggi» per conto loro. Su Render il processo sta a UTC, quindi fra mezzanotte e le 02:00 in Italia tutti rispondono **ieri**. ⚠️ È lo stesso difetto chiuso il 7/8 sulle misure (la pesata delle 00:30 che sovrascriveva quella del giorno prima) e il 20/8 sui soldi: `common/date-only.ts` esiste apposta, e la maggior parte di questi punti è di prima e non è mai stata ricontrollata. ⛔ **Non li ho corretti tutti in blocco, di proposito**: fra questi ci sono `commerce/stati-abbonamento.ts` e `common/piano-attivo.ts`, che decidono se un piano sta erogando **oggi** — cambiare quel confine tocca chi riceve il menu domattina, e non è una cosa da fare a trenta file insieme senza guardarli uno per uno. ⚠️ Due cron girano dentro la fascia: `reminders` e `genera-catalogo` (ogni 10 minuti) e `measures-nudge` (ogni 2 ore, quindi anche alle 22:00 UTC = mezzanotte a Roma). Il giro giornaliero grosso invece è alle 05:00 UTC, fuori pericolo. ✅ **Già corretti** (20/8, quattro consegne): il mese dei soldi; la scadenza dell\'attività «Misure non inserite», che nasceva con la data di ieri; **gli stati abbonamento e `piano-attivo`** — cioè se una cliente sta ricevendo i menu, il difetto che le diceva «non hai un piano» all\'una di notte del giorno in cui il percorso comincia; **`privacy/cancellazione`**, dove una revoca inviata di notte faceva scadere il termine un giorno prima di quello promesso nella mail; **`menu/correzione-kcal`**, dove «per 7 giorni» ne durava sei se il nutrizionista la scriveva dopo mezzanotte; **`pause.service`**, che rimandava di un giro il menu di rientro. ✅ E **`coach-tasks`** (20/8): «oggi» e «una data salvata» erano mescolati nella stessa funzione `day()` — è il motivo per cui il difetto non si vedeva — e ora sono due, `oggiPiu` e `giornoPiu`; un\'attività aperta all\'una di notte nasceva con la scadenza di oggi invece che di domani, cioè con un giorno di lavoro già bruciato. ✅ E il giro del 20/8 pomeriggio: **`menu/senza-glutine`**, **`vera/*`** (⚠️ «domani» dettato a Vera all\'una di notte finiva su **oggi**: la nutrizionista dice domani e la cliente se lo trova nel piatto stamattina), **`monitoring`**, **`clients`**, **`commerce`**. ⚠️ **`menu/data-inizio-chat` NON era da correggere**: usa già `toDateOnly()` da prima, l\'avevo messo in elenco senza guardarlo — una voce che descrive male la realtà, cioè esattamente la cosa che continuo a trovare negli altri. ⛔ **Restano** solo i posti dove un giorno spostato cambia un grafico e non quello che una persona riceve: `reports`, `marketing/lifecycle`, `agents`, `dashboard`, `analytics`, `crm`. Il perimetro già guardato lo tiene fermo `common/il-giorno-si-chiede.spec.ts`, che legge il sorgente. ⚠️ **E resta la metà grossa**: il giorno di una data **salvata** si continua a leggere in UTC ovunque, di proposito — `Subscription.startDate` è un `DateTime` con istanti veri dentro, e rileggerli a Roma sposterebbe di un giorno i piani già venduti fra le 22:00 e le 24:00 UTC. Si misura con `npm run diag:giorno-piani` e poi si decide.\n\n✅ **20/8 sera — la misura che mancava è arrivata, e dice VIA LIBERA.** `npm run diag:giorno-piani`: 40 abbonamenti, 78 date guardate, **18** con un orario diverso da mezzanotte UTC e **zero** che cambierebbero giorno se lette a Roma. ⚠️ Era l\'unica cosa che teneva ferma la metà grossa del lavoro: temevo che rileggere a Roma spostasse di un giorno i piani già venduti fra le 22:00 e le 24:00 UTC. **Non ce n\'è nessuno.** Quindi la seconda metà — il giorno di una data SALVATA — si può fare, e adesso è un lavoro normale invece che una scommessa. ⚠️ Resta grosso: sono decine di punti, e vanno fatti a gruppi con una misura per gruppo, non tutti insieme. La diagnostica va rilanciata prima di ogni gruppo: zero oggi non è zero fra un mese, perché ogni piano nuovo scrive una data nuova.\n\n✅ **20/8 sera — chiuso anche l\'ultimo gruppo della prima metà, e la frase che diceva cosa restava era sbagliata.** Diceva: «restano fuori l\'analitica, i report, il marketing e gli agenti — dove un giorno spostato cambia un grafico, non quello che una persona riceve». ⛔ Guardandoli davvero era **sbagliata in cinque punti su sei**, ed era scritta a memoria invece che misurata — la stessa cosa che `il-giorno-si-chiede.spec.ts` esiste per impedire.\n · **`marketing/lifecycle`** non cambia un grafico: `dayRange(offset)` decide **a chi parte una email oggi**. Alle 00:30 italiane una cliente la riceveva con un giorno di ritardo. ✅ Corretto.\n · **`agents/agent-orchestrator`** decide se un agente giornaliero **ha già girato oggi**: alle 00:30 rispondeva di no e lo rimetteva in coda. ✅ Corretto.\n · **`reports/plan-report`** aveva **due domande in una funzione sola** (`day0`, chiamata sia su `new Date()` sia su `sub.startDate`) — lo stesso miscuglio di `coach-tasks.day()`, e il motivo per cui il difetto non si vedeva. ✅ Sdoppiata in `oggiGiorno()` e `giornoDelDato()`.\n · **`dashboard` e `crm` non avevano niente da correggere**: li avevo elencati senza guardarli.\n · **`analytics/serie-giornaliera` era già giusto**, col commento che lo spiega.\n · Resta un solo `setHours(0,0,0,0)`, dentro il **generatore dei dati dimostrativi**: lì il giorno esatto non lo legge nessuno.\n⚠️ **Resta la metà grossa** — il giorno di una data **salvata** — che adesso ha il via libera (`diag:giorno-piani`: zero date che cambierebbero giorno) ed è un lavoro normale invece che una scommessa. `common/date-only.ts` ha ora `giornoDelDato(d)`, l\'altra metà di `aGiorno`, che non dipende da come è configurata la macchina. ⚠️ Va fatta a gruppi con una misura per gruppo, e la diagnostica va rilanciata prima di ogni gruppo: zero oggi non è zero fra un mese.',
    categoria: CODICE,
    ordine: 618,
    nata: '2026-08-20T12:10',
  },

  /* ─────────────────  20/8 sera — la revisione delle misure  ───────────────── */

  {
    chiave: 'test-col-difetto-del-fuso',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: true,
    fatta: true, // chiusa il 23/8 — e sotto i test rotti c'erano due difetti di prodotto
    titolo: '⛔ La suite è verde 22 ore su 24 e rossa 2: i test hanno il difetto del fuso',
    dettaglio:
      '⛔ **Alle 00:02 di Roma del 21/8 la suite è diventata rossa**: 13 test in 6 file, tutti con una '
      + 'differenza di **esattamente 86.400.000 ms** — un giorno.\n\n'
      + '    Expected: 1787270400000\n'
      + '    Received: 1787356800000\n\n'
      + '⚠️ I test calcolano «domani» con `setHours(0,0,0,0)` o `new Date().toISOString().slice(0,10)` — '
      + 'il giorno **UTC** — mentre il codice, curato durante il 20/8, risponde col giorno di **Roma**. '
      + 'Fra mezzanotte e le 02:00 italiane le due risposte differiscono di un giorno.\n\n'
      + '⛔ **È il difetto che abbiamo passato la giornata a togliere dal codice, rimasto dentro i test '
      + 'che lo verificano.** Un test che si ricalcola da sé la cosa che sta verificando non la '
      + 'verifica: la ripete — e quando il codice cambia fuso, il test resta indietro **senza dirlo**.\n\n'
      + '⚠️ **Perché blocca:** se un deploy capita in quella fascia la CI fallisce senza motivo '
      + 'apparente, e chi ci sbatte contro perde un\'ora prima di capire che non è colpa sua. È '
      + 'successo davvero: la consegna 78 è rimasta ferma per questo.\n\n'
      + '✅ Corretti tre file — `coach-tasks/apri-attivita`, `menu/sostituzione-chat.service`, '
      + '`nutritionist/nutritionist.service` — e i rossi sono passati da 13 a 8.\n'
      + '⛔ **Restano tre file**: `privacy/privacy.service`, `menu/data-inizio-chat.service`, '
      + '`coach-tasks/compiti-prova-in-coda`. Non toccati **di proposito**: sono test su date con '
      + 'fixture intrecciate, era l\'una di notte, e **rendere verde un test in fretta è il modo di '
      + 'fargli smettere di verificare**.\n\n'
      + 'La correzione è sempre la stessa: il test chiede il giorno **alla stessa porta del codice** '
      + '(`aGiorno`, `giornoLocale`, `toDateOnly` in `src/common/date-only.ts`), non se lo ricalcola. '
      + '⚠️ E vale la pena aggiungere un controllo che legga i sorgenti dei test come fa '
      + '`il-giorno-si-chiede.spec.ts` col codice: finché la regola vale solo per metà del progetto, '
      + 'l\'altra metà la romperà di nuovo.\n\n'
      + '---\n\n'
      + '✅ **CHIUSA il 23/8 — e i test rotti erano la parte piccola.**\n\n'
      + 'Primo fatto: la misura fatta a mano il 21/8 era **sbagliata**. Rifatta con un orologio finto '
      + '(`npm run test:notte`, che gira la suite come se fossero le 00:30 di Roma) i file rossi erano '
      + '**quattro**, non tre: si era aggiunto `notifications/notifications.service`, perché niente '
      + 'impediva di riscrivere il difetto. ⚠️ E la prima versione dell\'orologio finto contava **8 '
      + 'file invece di 4**, perché falsificava l\'ora dentro `beforeEach`, cioè dopo che i moduli '
      + 'erano già caricati: una misura sbagliata manda a correggere codice che funziona.\n\n'
      + '⛔ **Secondo fatto: due dei quattro non erano test rotti. Era il PRODOTTO.**\n\n'
      + '· **La finestra di blocco della data d\'inizio, dichiarata di 24 ore, ne durava 22** (23 '
      + 'd\'inverno). Contava le ore fino alla mezzanotte **UTC** del giorno d\'inizio, ma il piano '
      + 'parte alla mezzanotte di **Roma**, due ore prima. Sbagliava nel verso che costa: nelle ultime '
      + 'due ore utili il pulsante nel profilo era acceso e Gaia si offriva di spostare, e la data si '
      + 'muoveva **dentro** la finestra che il blocco esiste per proteggere — con i menu già sbloccati '
      + 'e magari la spesa già fatta. E lo stesso conto risponde a `oreMancanti`, il numero che la '
      + 'cliente **legge**: le diceva due ore in più di quelle che aveva.\n\n'
      + '· **`statoPerInizio` riceveva un GIORNO e lo confrontava come un ISTANTE.** Quattro dei cinque '
      + 'punti che scrivono la data d\'inizio le passano `toDateOnly(...)`, cioè la mezzanotte UTC del '
      + 'giorno di Roma — che sono **le 02:00 italiane**. Fra la mezzanotte e le due, «comincio oggi» '
      + 'risultava nel futuro e il piano nasceva `queued`: niente menu fino alla passata notturna '
      + 'dopo, cioè **un giorno intero**. ⚠️ È il difetto che la voce 258 dichiarava chiuso: la porta '
      + 'era davvero una sola, ma le si passava la cosa sbagliata. Ora c\'è `statoPerGiornoDiInizio` '
      + 'accanto a `statoPerInizio`, e il confronto per istante resta dov\'è **giusto** (la coda che '
      + 'eredita l\'ora di scadenza del piano in corso).\n\n'
      + '· **E un test verde per la ragione sbagliata**: il dedup «una notifica al giorno» era provato '
      + 'con una riga finta **senza data**, e passava solo perché `Intl.DateTimeFormat.format(undefined)` '
      + 'formatta *adesso*. Si è visto solo fermando l\'orologio, perché `Intl` legge il clock del '
      + 'sistema e i finti timer di jest non lo toccano.\n\n'
      + '⛔ **Il guardiano non è un test che legge i sorgenti: è la CI che gira la suite a quell\'ora.** '
      + 'Un elenco di file dichiarati «guardati» avrebbe coperto i quattro di ieri, non il quinto di '
      + 'domani. Il passo `Test · all\'ora pericolosa` nella CI copre tutto, sempre; '
      + '`common/lora-pericolosa-si-gira.spec.ts` tiene fermo che quel passo ci sia e che l\'orologio '
      + 'sia puntato su un istante in cui i due giorni divergono **davvero** — lo calcola su quattro '
      + 'giorni dell\'anno, compresi i due del cambio dell\'ora, invece di cercarlo scritto.\n\n'
      + '⛔ **E la revisione avversariale ha trovato che la prima stesura era peggio del difetto.** '
      + 'Quattordici rilievi, di cui due bloccanti:\n\n'
      + '· `statoPerGiornoDiInizio` rileggeva la data salvata **nel fuso di Roma** — la porta che '
      + 'quello stesso file vieta centoventi righe più su. Su un valore con dentro un\'ora (e ce ne '
      + 'sono: il DTO del profilo accetta un ISO completo, e la coda eredita la scadenza del piano in '
      + 'corso) anticipava **fino a 24 ore**, cioè riapriva la forma ambigua che la voce 258 esiste '
      + 'per chiudere. Ora la regola sta in un posto solo, `istanteDiPartenza` in `date-only.ts`, e '
      + 'un valore che **non** è un giorno lo rende com\'è invece di fingere;\n'
      + '· **quattro dei cinque punti corretti non erano provati da niente.** Mutandoli tutti e '
      + 'quattro, la suite restava verde su 4729 test su 4730. Adesso ognuno ha il suo caso alle 00:30 '
      + '— questionario, matita della scheda, «Conosciamoci», approvazione del bonifico — e il quinto '
      + '(la coda) ha il caso **contrario**, che la coda deve restare in coda fino all\'ora di '
      + 'scadenza.\n\n'
      + '⚠️ E tre dei rilievi erano su test che **dichiaravano** di verificare qualcosa e non lo '
      + 'facevano: il guardiano dell\'orologio restava verde con la riga commentata via e con '
      + '`doNotFake` tolto del tutto; il test che vietava la «costante −2h» sceglieva l\'unico istante '
      + 'invernale che non la distingue; e il commento che diceva «ci pensa `cancellazione.spec.ts`» '
      + 'era falso — quel file non aveva **nessun** caso fra le 22:00 e le 24:00. Tutti e tre corretti '
      + 'e rimutati.\n\n'
      + '⚠️ L\'orologio finto sposta **l\'ora, non il calendario**: la prima stesura fissava una data '
      + 'assoluta, e dal 2 settembre (vedi la voce sotto) avrebbe detto «rotta di giorno, sana di '
      + 'notte» — il contrario del vero, per sempre.\n\n'
      + '⛔ **E la seconda ronda ne ha trovati altri tre bloccanti**, tutti sulla parte nuova: '
      + 'l\'euristica «mezzanotte UTC esatta = un giorno» sbagliava sul caso **più comune di tutti** '
      + '— `subscriptionEnd` produce proprio mezzanotte UTC esatta, quindi la scadenza che una coda '
      + 'eredita ci passava dentro; il guardiano non guardava mai il valore di `now`, quindi '
      + '`test:notte` poteva diventare un doppione di `test` restando verde; e il quinto punto che '
      + 'scrive (Gaia) era l\'unico rimasto senza una prova che dicesse che ora è. ✅ Corretti: '
      + 'l\'euristica è stata **tolta** dove la provenienza non si sa (l\'approvazione del bonifico '
      + 'torna al confronto fra istanti, e il difetto che le resta è scritto in un test e in una voce '
      + 'a parte), e usata solo dove si sa.\n\n'
      + '4750 test verdi (301 suite) alle 00:30 e alle 01:59 di Roma; ogni correzione verificata per '
      + 'mutazione, guardiani compresi. ⚠️ **La suite non è verde a tutte le date**: dal 2 settembre '
      + 'due file cadono da soli e la notte del 25 ottobre altri tre — sono le due voci qui sotto, '
      + 'misurate e non corrette. Nessuna migrazione.',
  },
  {
    chiave: 'giorno-cancellato-che-non-torna',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-23T18:30',
    titolo: '⛔ Un giorno di menu cancellato «per rifarlo» può non tornare MAI: la cliente trova «menu in preparazione» per sempre',
    dettaglio:
      '⛔ **Trovato in revisione il 23/8, ed è in produzione dal 13/8.** La regola di dieta di Vera '
      + '(«nella mediterranea niente tonno») rifà i menu già preparati **cancellandoli**, contando '
      + 'che l\'erogazione li ricomponga al giro dopo. Non è vero:\n\n'
      + '`deliverIfEligible` (`menu/menu.service.ts:771-786`) legge l\'**ultimo** giorno in calendario '
      + 'e, se è più avanti di oggi, **esce**: `if (last.date > today) return [];`. E i giorni nuovi li '
      + 'appende **dopo l\'ultimo**. Quindi un giorno cancellato **in mezzo** non viene ricomposto né '
      + 'oggi né mai: resta un buco, e quel giorno la cliente apre l\'app e trova «menu in '
      + 'preparazione».\n\n'
      + '⚠️ **Come ci si arriva:** `giorniDaRifare` cancella un **sottoinsieme** (solo i giorni che '
      + 'contengono davvero il piatto vietato, decisione giusta del 13/8) — ed è proprio il '
      + 'sottoinsieme che lascia in piedi un giorno più avanti. Gli altri percorsi di Vera che toccano '
      + 'i menu (proteine, pasti) cancellano **tutta** la coda non aperta e quindi non ci sbattono.\n\n'
      + '✅ **Il modo giusto è già scritto**, con il commento che descrive questo identico guasto: '
      + '`menu.service.redeliverFutureDays` cancella, **rieroga subito** e **rimette i giorni com\'erano** '
      + 'se la rierogazione non produce niente («un menu vecchio è meglio di nessun menu»), dicendo a '
      + 'chi chiama che la modifica non è arrivata nel piatto.\n\n'
      + '⚠️ **Nella regola per la singola cliente è già chiuso** (23/8): si cancella dal primo giorno '
      + 'colpito **in avanti**, e se in mezzo c\'è un giorno già aperto non si tocca niente e lo si '
      + 'dice. Ma `vera/applica-proposta.ts:200` — la regola di **dieta**, che tocca molte clienti in '
      + 'una volta — ha ancora il difetto originale. ⛔ Lì la toppa della coda non basta: bisogna '
      + 'passare dal motore, e `applica-proposta.ts` prende `prisma` e basta **di proposito** (non '
      + 'deve poter far fallire un\'approvazione). Va deciso come: o `MenuModule` esportato a Vera con '
      + 'gli occhi aperti, o un passo notturno che ricompone i buchi.\n\n'
      + '⚠️ **Da guardare anche all\'indietro**: chi ha già approvato una regola di dieta dal 13/8 '
      + 'potrebbe avere clienti con un giorno mancante in calendario. Si trova cercando i `MenuDay` '
      + 'con un salto di data nel futuro.\n\n'
      + '---\n\n'
      + '✅ **CHIUSA IL 24/8, ed era più larga di così.** Misurando i punti che cancellano `MenuDay` '
      + 'sono venuti fuori **sei**: tre sono code per costruzione (le rigenerazioni intere del '
      + 'motore), e **tre** erano rotti, non uno:\n\n'
      + '· la **regola di dieta** — quella scritta qui sopra, dal 13/8;\n'
      + '· **«togli lo spuntino»** — cancellava i giorni che contengono lo spuntino, sparsi;\n'
      + '· **«cambia le proteine»** — cancellava i giorni `viewedAt: null` e lasciava in piedi quelli '
      + 'letti: oltre al buco, l\'erogazione restava ferma **del tutto** finché quel giorno non '
      + 'passava. Era il peggiore dei tre.\n\n'
      + '⛔ **E la riga qui sopra che dice «le proteine e i pasti cancellano tutta la coda e quindi non '
      + 'ci sbattono» era FALSA** — l\'avevo scritta io il 23/8 senza verificarla, ed è finita anche '
      + 'in un commento nel codice consegnato. Il codice era giusto, la ragione scritta accanto no: '
      + 'chi legge una ragione falsa ci costruisce sopra invece di andare a guardare.\n\n'
      + 'Adesso la regola sta scritta **una volta sola** (`vera/menu-da-rifare.ts`, `codaDaRifare`): '
      + 'si cancella dal primo giorno colpito in avanti, tutto; se dentro la coda c\'è un giorno già '
      + 'aperto non si tocca niente **e si dice quale giorno**. I colpiti arrivano come **predicato** '
      + 'e non come secondo elenco, così sono un sottoinsieme per costruzione: la prima stesura, con '
      + 'due array, davanti a un universo incompleto rispondeva «coda vuota, fatto» — la risposta più '
      + 'tranquillizzante possibile davanti al difetto che deve chiudere.\n\n'
      + '⚠️ **Non è servito esportare `MenuModule` a Vera**, che era la strada temuta: la coda si '
      + 'calcola con una query in più (i calendari **interi** delle sole clienti colpite — quella '
      + 'filtrata per dieta e per «mai aperto» non vede né i giorni letti né quelli rimasti da una '
      + 'dieta precedente, cioè proprio le righe che restano in fondo). `applica-proposta.ts` continua '
      + 'a prendere `prisma` e basta.\n\n'
      + '⚠️ **Guardia**: `menu/una-porta-per-i-giorni.spec.ts` — ogni file che cancella `MenuDay` va '
      + 'dichiarato con la ragione per cui è una coda, e la forma esatta del difetto (`deleteMany` con '
      + '`viewedAt: null` dentro) è vietata senza eccezioni.\n\n'
      + '⛔ **RESTA APERTO IL PASSATO** — voce `buchi-gia-aperti-nei-menu`.\n\n'
      + '⚠️ **E UNA CORREZIONE A QUELLO CHE HO SCRITTO IO IERI.** Sopra è scritto «un buco, e quel '
      + 'giorno la cliente apre l\'app e trova menu in preparazione», come se fosse successo a molte. '
      + 'Non l\'avevo misurato. Le cancellazioni sparse toccavano **solo i giorni non ancora "visti"**, '
      + 'e `viewedAt` viene messo dall\'app su tutti i giorni futuri appena la cliente la apre (voce '
      + '`visto-non-vuol-dire-aperto`): quindi con ogni probabilità quei percorsi **non hanno quasi '
      + 'mai cancellato niente**, e i buchi veri sono pochi. Il difetto era reale e andava chiuso — '
      + 'ma l\'allarme era più grande del danno, e l\'ho scritto in tre file prima di contarlo. '
      + '«Misura prima di decidere» vale anche quando la misura fa scendere il numero.',
  },
  {
    chiave: 'visto-non-vuol-dire-aperto',
    categoria: 'Da decidere con Simone',
    ordine: 0,
    blocca: false,
    nata: '2026-08-24T13:00',
    titolo: '⛔ «Visto» vuol dire «gliel\'abbiamo mostrato», non «l\'ha aperto»: «rifai i giorni già preparati» non trova quasi mai niente',
    dettaglio:
      '⛔ **Trovato in revisione il 24/8, leggendo il motore.** `MenuDay.viewedAt` si chiama «visto» e '
      + 'in tutto il progetto viene letto come «l\'ha aperto». Non è quello che ci scrive dentro:\n\n'
      + '· `MenuService.getMenu` restituisce all\'app gli ultimi 30 giorni **visibili**, futuri '
      + 'compresi, e subito dopo chiama `segnaVisti`, che li marca **tutti**;\n'
      + '· i giorni nuovi, dal **secondo ciclo in poi**, nascono `visibleFrom: today` — visibili '
      + 'subito (`visibleFrom: last ? today : visibleFrom`).\n\n'
      + '⛔ Quindi **appena la cliente apre l\'app, tutti i suoi giorni futuri risultano «visti»**. '
      + 'Non perché li abbia guardati: perché erano nella lista.\n\n'
      + '⚠️ **La conseguenza è che «rifai i giorni già preparati» è di fatto morto** su ogni percorso '
      + 'che filtra `viewedAt` (i divieti dettati a Vera — compresa la correzione del caso Lorena del '
      + '23/8 — gli spuntini, le proteine, la regola di dieta). Fra la generazione dei giorni e la '
      + 'prima apertura dell\'app passano minuti: dopo, la nutrizionista detta «niente pesce» e legge '
      + '«Nei giorni già preparati non ce n\'era: non ho toccato niente» mentre il branzino è nel menu '
      + 'di domani. La frase è falsa e non lo sembra — il modo peggiore in cui una funzione può '
      + 'essere rotta.\n\n'
      + '**IL NUMERO PRIMA DELLA DECISIONE**: `npm run diag:visto` dice quanti giorni futuri risultano '
      + 'già «visti», su quante clienti, e in particolare quanti menu **di domani**. In sola lettura.\n\n'
      + '**Deciso da Simone il 24/8 — per adesso non si tocca la semantica**, e le frasi si '
      + 'correggono: Vera non dice più «ha già aperto il menu del 25» ma «il menu del 25 le è già '
      + 'arrivato in app», e indica «Rigenera menu» dicendo che quello rifà **anche** il giorno già '
      + 'ricevuto. Nessun rischio di togliere un menu di mano a nessuno; il prezzo è che il '
      + 'rifacimento automatico resta quasi sempre a vuoto, e va fatto a mano dalla scheda.\n\n'
      + '⚠️ **Le due strade che restano aperte, quando ci sarà il numero:**\n'
      + '1. proteggere solo i giorni **già arrivati** (oggi e passati) e tornare a rifare i futuri: '
      + 'la funzione riprende a funzionare, ma si rischia di cambiare il menu di domani a chi l\'aveva '
      + 'letto e ci aveva fatto la spesa;\n'
      + '2. un segnale vero «ha aperto QUESTO giorno», che è la cosa giusta ma tocca anche l\'app.',
  },
  {
    chiave: 'buchi-gia-aperti-nei-menu',
    categoria: 'Da decidere con Simone',
    ordine: 0,
    blocca: false,
    nata: '2026-08-24T11:00',
    titolo: 'I buchi già aperti nei calendari dal 13/8: quanti sono, e come si riparano',
    dettaglio:
      '⛔ Il codice è a posto da oggi (`giorno-cancellato-che-non-torna`), ma **i buchi già aperti non '
      + 'si richiudono da soli**: chi ha una giornata vuota davanti continuerà a vedere «menu in '
      + 'preparazione» quel giorno, e chi ha l\'ultimo giorno oltre oggi non riceve più niente finché '
      + 'quella data non passa.\n\n'
      + '**Il numero prima della decisione**: `npm run diag:buchi-menu` sul database vero elenca le '
      + 'clienti con un salto di data nel calendario da oggi in avanti, le sospensioni escluse (lì i '
      + 'giorni mancano di proposito), e mette per prime quelle con l\'erogazione ferma. È in sola '
      + 'lettura. Il conto dei buchi ha i suoi test (`menu/buchi-nel-calendario.spec.ts`): uno script '
      + 'che sbagliando risponde «nessun buco» chiuderebbe la domanda invece di aprirla.\n\n'
      + '⚠️ **La riparazione non è automatica di proposito**: rimettere a posto un buco vuol dire '
      + 'cancellare la coda dal buco in avanti, cioè rimescolare giornate che qualcuna potrebbe già '
      + 'aver letto — magari dopo la spesa. Con pochi nomi si fa a mano dalla scheda («Rigenera '
      + 'menu»); se sono tanti serve una decisione di Simone e Lucia su cosa si accetta di perdere.',
  },
  {
    chiave: 'niente-pesce-vuol-dire-niente-pesce',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    fatta: true,
    nata: '2026-08-23T16:40',
    titolo: '«Niente pesce» ora vuol dire niente pesce: 67 voci, i giorni già preparati si rifanno, e Vera spiega cosa ha vietato',
    dettaglio:
      '⛔ **Il caso Lorena Polidoro (23/8)**: regola «niente pesce», e le arrivano un branzino e poi un '
      + 'tonno. Tre difetti diversi sotto lo stesso sintomo:\n\n'
      + '1. **La regola non era mai arrivata al profilo** (campo «Cibi non graditi» vuoto: risolto a '
      + 'mano da Simone). ⚠️ Da capire ancora DOVE si è persa nel dialogo con Vera — il percorso '
      + '«solo per lei» scrive subito, quindi o il dialogo si è fermato alla domanda sull\'ambito, o '
      + 'la risposta è finita in coda approvazioni: si vede dal registro di Vera.\n\n'
      + '2. **L\'elenco del motore per «pesce» aveva 12 voci** — con la tabella delle specie passata '
      + 'da Simone ne mancavano trenta che nei menu si chiamano col loro nome (aringa, nasello, '
      + 'cernia, spigola, verdesca, storione…) più i derivati che non si chiamano pesce (stoccafisso, '
      + 'bottarga, surimi, colatura). Ora sono **67**, controllate parola per parola: «carpa» ha '
      + 'l\'omonima «carpaccio», «razza» ha «terrazza», «rombo» ha «stromboli»; «cappone» (è anche il '
      + 'pollo), «fragolino» (radice = fragoline), «sarda» (alla sarda), «carpione» (marinatura di '
      + 'verdure) sono rimasti FUORI col motivo scritto. ⚠️ E il test dei piatti innocenti ha trovato '
      + 'un falso positivo **preesistente**: «orata» sta dentro ogni participio in «-orata» — una '
      + '«torta decorata», una «cipolla dorata» sparivano da settimane a chiunque escludesse il '
      + 'pesce. Ora ha le sue omonime.\n\n'
      + '3. **La regola per la singola cliente non toccava i giorni già preparati**: scriveva sul '
      + 'profilo e valeva solo per i menu futuri, mentre il branzino già in calendario restava lì. '
      + 'Richiesta di Simone: *«se Vera crea la regola, va applicata su tutto, perché è del '
      + 'nutrizionista assegnato»*. Ora usa la STESSA regola della regola di dieta (`giorniDaRifare`): '
      + 'si rifanno solo i giorni futuri, mai aperti, che contengono davvero un piatto vietato — e la '
      + 'risposta di Vera dice quanti. ⚠️ E se il controllo si rompe, la regola resta scritta e il '
      + 'guasto si dice.\n\n'
      + '⛔ **Trovata anche la NONA copia del confronto**: `ricetteVietate` (regola di dieta, pool, '
      + 'scoperte, rifacimento) usava un `includes` a mano — senza radice né omonime. Con l\'elenco '
      + 'nuovo avrebbe rifatto i giorni col carpaccio di manzo e lasciato passare «triglie» al '
      + 'plurale. Ora passa da `hitsExclusion`, la porta unica: un divieto si comporta uguale da '
      + 'qualunque strada entri.\n\n'
      + '⚠️ **E Vera adesso SPIEGA cosa ha vietato**: «\"pesce\" per il motore vuol dire tonno, '
      + 'salmone, branzino, orata, merluzzo, sgombro e altre 60 voci». Vale per ogni categoria (latte, '
      + 'legumi…): senza, l\'unico modo di scoprire quanto è largo un divieto era vedere cosa '
      + 'sparisce dai piatti.\n\n'
      + '⛔ **E la revisione avversariale ha trovato un bloccante mio, più vecchio della consegna.** '
      + '«Rifare un giorno» voleva dire solo cancellarlo, contando che l\'erogazione lo ricomponesse. '
      + 'Ma `deliverIfEligible` si ferma se in calendario c\'è già un giorno **più avanti di oggi**, e '
      + 'i nuovi li appende **dopo l\'ultimo**: cancellare un giorno in mezzo lascia un buco che **non '
      + 'si richiude mai** — la cliente apre l\'app in quel giorno e trova «menu in preparazione», per '
      + 'sempre. ⚠️ È un difetto che la **regola di dieta ha dal 13/8**: voce '
      + '`giorno-cancellato-che-non-torna`, da chiudere lì con `redeliverFutureDays`, che esiste già e '
      + 'sa rimettere i giorni com\'erano se la rierogazione non produce niente. Qui si cancella dal '
      + 'primo giorno colpito **in avanti** (come già fanno le proteine e i pasti di Vera), così '
      + 'l\'ultimo torna indietro e l\'erogazione riparte; e se in mezzo c\'è un giorno **già aperto** '
      + 'non si tocca niente **e lo si dice**, con la strada da prendere.\n\n'
      + '⛔ **E il caso Lorena vero non era coperto**: con «pesce» già sul profilo (come l\'ha messo '
      + 'Simone a mano) ridettare la regola usciva subito con «erano già tutti esclusi» **senza '
      + 'guardare i giorni** — cioè l\'unica strada per rimediare era l\'unica che non ripuliva niente. '
      + 'Ora i giorni si guardano sempre.\n\n'
      + '⚠️ **Tre voci tolte o corrette in revisione**, con lo stesso criterio con cui ne erano già '
      + 'state scartate altre: **«razza»** (razza chianina/piemontese: chi esclude il pesce perdeva la '
      + 'bistecca), **«sarde»** (prefisso di «Sardegna»), e le omonime di **«orata»** — otto parole '
      + 'contro una famiglia **aperta** («insaporata», «odorata», «ristorata»…). Da lì la regola '
      + 'nuova `SOLO_A_INIZIO_PAROLA`, che chiude la famiglia intera invece di rincorrerla. ⛔ E il '
      + 'giro della **radice** non consultava le omonime: erano **strutturalmente impossibili** per '
      + '`trigli`, `palomb`, `gallinell`, `ricciol` — e un mio commento indicava proprio quella come '
      + 'la via d\'uscita. Adesso esiste.\n\n'
      + '⚠️ E la composizione **taceva**: uno slot che resterebbe a zero per un divieto di dieta si '
      + 'teneva il pool intero — piatti vietati compresi — senza una riga da nessuna parte, mentre il '
      + 'ramo gemello delle esclusioni della cliente lo scrive da sempre.\n\n'
      + '⚠️ Da misurare in produzione dopo il rilascio: `npm run diag:esclusioni` dice quante ricette '
      + 'l\'elenco nuovo toglie davvero — e va chiesto su **triglia, palombo, gallinella, ricciola**, '
      + 'non solo su «riccioli». ✅ Sui 273 piatti dei cataloghi del repo toglie **una ricetta in più** '
      + 'e **zero** falsi positivi. 49 test nuovi sull\'elenco + 6 su Vera; ogni pezzo verificato per '
      + 'mutazione. Nessuna migrazione.',
  },
  {
    chiave: 'via-libera-non-arrivava-al-cliente',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: true,
    fatta: true,
    nata: '2026-08-23T14:05',
    titolo: '⛔ «Può proseguire» non arrivava al cliente: il menu restava fermo per sempre',
    dettaglio:
      '⛔ **Trovato su una persona vera, il 23/8.** Sulla scheda di Gianluca: «Valutazione clinica — '
      + 'Può proseguire · 23/08/2026», con la nota della nutrizionista. Nella sua app, nello stesso '
      + 'momento: «Menu dopo la visita — il menu sarà pronto dopo la visita con il nutrizionista».\n\n'
      + '⛔ **La decisione e il blocco erano due campi diversi, e nessuno dei due chiamava l\'altro.** '
      + 'Il pulsante scrive `idoneita`; il gate del menu, il popup misure e la card leggevano **solo** '
      + '`screeningFlag`, che lo mette il questionario in registrazione. E `screeningFlag` **non lo '
      + 'riazzerava nessuno** — non la valutazione, non la visita, non uno script: cercato in tutto il '
      + 'backend e in `prisma/`. Quindi il via libera clinico, per il cliente, non cambiava '
      + '**assolutamente niente**, e sarebbe restato così per sempre.\n\n'
      + '⚠️ È il caso peggiore fra i possibili: non un errore, non un avviso — due schermate che '
      + 'raccontano due cose diverse alla stessa ora, e quella che il cliente vede è quella sbagliata. '
      + 'Lui aspetta una visita che non serve più; la nutrizionista pensa di aver fatto. Nessuno dei due '
      + 'ha modo di accorgersene se non parlandosi. ⚠️ E la card non aveva **nessun** test: il ramo '
      + '`awaiting_visit` di `menuStatus` non era toccato da niente. È il motivo per cui il difetto è '
      + 'arrivato a una persona invece che a una suite rossa.\n\n'
      + '✅ **La regola adesso sta in un posto solo** (`clients/via-libera-clinico.ts`), e il blocco lo '
      + 'crea lo screening ma a toglierlo è la decisione:\n'
      + '· nessuna decisione → bloccato, non l\'ha guardato nessuno;\n'
      + '· **«Può proseguire»** → libero, e resta libero;\n'
      + '· **«Serve una visita»** → la nutrizionista scrive **entro quando** (campo nuovo, obbligatorio). '
      + 'Fino a quel giorno **compreso** i menu arrivano; dal giorno dopo il percorso si ferma.\n\n'
      + '⚠️ `screeningFlag` **non si tocca**: è un fatto sanitario dichiarato in registrazione, non uno '
      + 'stato da cancellare. Quello che cambia è la risposta alla domanda, non la storia clinica.\n\n'
      + '✅ **E la data arriva a tutti quelli che devono saperla**: nel titolo dell\'attività della coach '
      + '(quindi dentro la push, che parte quando la nutrizionista salva), come **riga di calendario** '
      + 'della coach nel giorno della scadenza (di tutto il giorno, non un appuntamento a un\'ora '
      + 'inventata), nella nota clinica, in scheda cliente, e **al cliente**: un avviso con la data '
      + 'prima che scada, e una card che dice **da quando** e **perché** dopo. Un blocco che non si '
      + 'spiega sembra un guasto.\n\n'
      + '⛔ **La seconda revisione avversariale ha trovato che la prima stesura prometteva e non '
      + 'faceva** — due bloccanti e sei rilievi seri, tutti chiusi:\n'
      + '· il blocco fermava **la card ma non l\'erogazione**: i giorni continuavano a generarsi, il '
      + 'menu restava visibile e nemmeno la card compariva. Ora `deliverIfEligible` si ferma a visita '
      + 'scaduta (i giorni già consegnati non si ritirano: può averci fatto la spesa);\n'
      + '· la riga di calendario **non è mai comparsa**: filtrava le attività per stati che non '
      + 'esistono (`open/in_progress`; i veri sono `todo/done/skipped`) e il test asseriva la stessa '
      + 'stringa sbagliata. Ora legge il **profilo** (`serve_visita` + data), che è anche più giusto: '
      + 'l\'attività si chiude quando la visita è fissata, il blocco cade solo quando la nutrizionista '
      + 'rivaluta, e fra i due momenti la scadenza è ancora vera;\n'
      + '· le scadenze sarebbero finite **nell\'agenda della cliente** («Fissa la visita per Anna» '
      + 'alle 02:00, come prossimo appuntamento): ora entrano solo col flag che passa il calendario '
      + 'dello staff;\n'
      + '· la `dueDate` dell\'attività era diventata la scadenza clinica (fino a 180 giorni): '
      + 'l\'escalation al manager sarebbe scattata **dopo** il blocco dei menu invece del giorno dopo '
      + 'l\'inerzia, e l\'attività finiva in fondo all\'elenco. Tornata a «domani»; la scadenza della '
      + 'visita viaggia nel titolo e in calendario;\n'
      + '· l\'avviso in app sulla pagina Menu stava in un ramo **irraggiungibile**; il promemoria '
      + 'usciva anche su piani scaduti («i menu arrivano normalmente» sotto «il tuo piano è '
      + 'terminato»); la scadenza salvata si rileggeva nel fuso invece che com\'è scritta (un giorno '
      + 'di scarto con un `APP_TIMEZONE` a ovest); e i due campi nuovi non erano provati da niente — '
      + 'due mutazioni sopravvivevano a 4783 test. Tutto chiuso e rimutato.\n\n'
      + '⚠️ **Lo script-toppa è stato buttato**: per lanciarlo su Render serviva comunque un rilascio, '
      + 'cioè non faceva risparmiare niente — e spegnendo `screeningFlag` avrebbe **zittito anche il '
      + 'guardrail del motore**, prendendo da solo la decisione clinica che la voce '
      + '`motore-dopo-il-via-libera` lascia a Lucia. Il caso urgente si è risolto con una riga di SQL '
      + 'dalla shell (Gianluca, 23/8) — con lo stesso effetto collaterale sul motore, segnato per il '
      + 'ripristino post-rilascio.\n\n'
      + '⚠️ **Il confine è un GIORNO, letto nel fuso di Roma.** «Entro il 30» vuol dire che il 30 si '
      + 'mangia (scelta di Simone). Con un confronto fra istanti — la scadenza salvata `…T00:00:00Z` '
      + 'contro adesso — il blocco sarebbe scattato **due ore prima** della mezzanotte vera, cioè un '
      + 'giorno di menu tolto a qualcuno. Provato alle 00:30 e in ora solare.\n\n'
      + '⚠️ **Cosa resta fuori, e perché**: il guardrail del motore (voce `motore-dopo-il-via-libera`, '
      + 'domanda per Lucia) e le `serve_visita` scritte prima di oggi, che senza data restano bloccanti '
      + '— dare loro una finestra aperta vorrebbe dire sbloccare a posteriori delle persone che nessuno '
      + 'ha più guardato.\n\n'
      + '4791 test verdi (303 suite) alle due ore, 113 backoffice, 165 app; ogni pezzo verificato per '
      + 'mutazione — compresi i due che alla prima stesura non lo erano. ⚠️ **Porta una migrazione** '
      + '(`idoneita_visita_entro`, additiva). ⚠️ **Dopo il rilascio**: rimettere `screening_flag = true` '
      + 'al cliente sbloccato a mano il 23/8.',
  },
  {
    chiave: 'mai-valutata-eroga-lo-stesso',
    categoria: 'Da fare — prodotto',
    ordine: 0,
    blocca: false,
    nata: '2026-08-23T16:40',
    titolo: 'Una cliente in screening MAI valutata riceve i menu lo stesso: è voluto? (domanda per Lucia)',
    dettaglio:
      'Scoperto per caso chiudendo il via libera clinico (23/8): il cancello sull\'**erogazione** per '
      + 'il percorso supervisionato **non è mai esistito**. `deliverIfEligible` non ha mai guardato '
      + '`screeningFlag`: il «Menu dopo la visita» viveva solo nella card dell\'app, e i giorni si '
      + 'generavano comunque — la card compariva di rado proprio perché i menu c\'erano.\n\n'
      + '⚠️ Il 23/8 il cancello è stato aggiunto **solo per la visita scaduta** (una data che una '
      + 'nutrizionista ha scritto). Per chi è in screening e non è mai stata valutata NO, di '
      + 'proposito: chiuderlo di rimbalzo avrebbe fermato, in silenzio e in un giorno qualunque, '
      + 'persone che stanno già mangiando — un blocco nuovo deciso mentre se ne correggeva un altro.\n\n'
      + 'La domanda per Lucia è: una cliente che ha dichiarato farmaci o condizioni e che nessuno ha '
      + 'ancora guardato deve ricevere i menu? Se no, il cancello è una riga (`mai_valutata` in '
      + '`deliverIfEligible`) — ma va acceso **sapendo quante sono adesso**, con una diagnostica '
      + 'prima, e con un avviso alle nutrizioniste, non con un rilascio muto.',
  },
  {
    chiave: 'motore-dopo-il-via-libera',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    nata: '2026-08-23T15:10',
    titolo: 'Dopo il «può proseguire», il motore può decidere da solo? (domanda per Lucia)',
    dettaglio:
      'Col via libera clinico del 23/8 il gate del menu ora chiede **la decisione** e non lo screening: '
      + 'una cliente con «Può proseguire» riceve i menu. ⚠️ Ma `engine.service.checkGuardrails` è '
      + 'rimasto com\'era: legge `screeningFlag` da solo, quindi per quella cliente il motore continua '
      + 'a non decidere in autonomia e ogni variazione passa dalla nutrizionista.\n\n'
      + '⚠️ **Non è una svista: è una domanda clinica che non tocca a me.** «Può proseguire» vuol dire '
      + 'che la cliente può fare il percorso — non necessariamente che un motore possa cambiarle le '
      + 'calorie senza che una persona guardi. Le due cose sbagliano in versi opposti: un gate chiuso '
      + 'di troppo le costa **tutto il servizio**, un guardrail chiuso di troppo costa una decisione in '
      + 'più alla nutrizionista.\n\n'
      + 'Da chiedere a Lucia. Se la risposta è sì, la correzione è una riga: `checkGuardrails` chiama '
      + '`attendeIlViaLiberaClinico` invece di leggere il flag, e il collettore le passa anche '
      + '`idoneita` e `idoneitaVisitaEntro`.',
  },
  {
    chiave: 'chat-si-aprono-sull-ultimo-messaggio',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    nata: '2026-08-23T14:30',
    titolo: 'Tutte le chat, Gaia e Vera comprese, all\'apertura devono andare all\'ultimo messaggio',
    dettaglio:
      'Richiesta di Simone, 23/8: aprendo una conversazione si parte dal **primo** messaggio e bisogna '
      + 'scorrere fino in fondo per vedere l\'ultimo. Vale per tutte: la chat con la coach, quella con '
      + 'la nutrizionista, Gaia nell\'app e Vera nel backoffice.\n\n'
      + '⚠️ È il difetto che si nota di più man mano che una conversazione cresce: alla decima riga è '
      + 'un fastidio, alla centesima la chat sembra ferma a mesi fa. E chi risponde da telefono si '
      + 'trova a scorrere prima di poter leggere la domanda a cui deve rispondere.\n\n'
      + '⚠️ Da fare in **un posto solo** se possibile: oggi le liste di messaggi sono almeno quattro '
      + 'componenti diversi, e quattro copie della stessa riga di scorrimento sono quattro punti in cui '
      + 'domani una si comporta diversamente dalle altre.',
  },
  {
    chiave: 'orologio-numeri-tagliati',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    nata: '2026-08-23T08:05',
    titolo: 'Nell\'orologio del digiuno i numeri delle ore si vedono a metà',
    dettaglio:
      'Segnalato dalla capo nutrizionista il 23/8 alle 08:05, con la schermata: *«non si vedono i numeri '
      + 'dell\'orologio»*. Nello screenshot il **00** in cima è tagliato a metà, il **12** in basso '
      + 'idem, e quelli ai lati (`6`, `18`) escono solo in parte — si legge «8» e «0(».\n\n'
      + '⚠️ Non è solo estetica: i numeri sono l\'unica cosa che dice **a che ora** corrisponde il punto '
      + 'del cerchio in cui si trova la lancetta. Senza, il disegno mostra «quanto manca» ma non «quando», '
      + 'e la finestra 12:00–20:00 scritta sotto resta l\'unico riferimento vero — cioè l\'orologio non '
      + 'sta facendo il suo lavoro.\n\n'
      + 'Probabilmente è il `viewBox` dell\'SVG che sta stretto sul cerchio senza lasciare margine alle '
      + 'etichette, oppure un `overflow: hidden` del contenitore. Si guarda in `app/src/components/OrologioDigiuno.tsx`.',
  },
  {
    chiave: 'digiuno-ore-troppo-facili-da-cambiare',
    categoria: 'Da fare — prodotto',
    ordine: 0,
    blocca: false,
    nata: '2026-08-23T08:05',
    titolo: 'Cambiare le ore del digiuno è troppo facile: oggi si può ogni giorno',
    dettaglio:
      'Segnalato dalla capo nutrizionista il 23/8: *«dovrebbe essere più difficile modificare le ore per '
      + 'digiunare, così puoi ogni giorno modificarlo»*. Oggi le cinque durate (14:10, 16:8, 18:6, 20:4, '
      + '23:1) sono cinque pulsanti nella schermata del digiuno, e la cliente può passare dall\'una '
      + 'all\'altra quando vuole.\n\n'
      + '⚠️ **È una richiesta clinica, non di interfaccia**: un protocollo cambiato ogni giorno non è un '
      + 'protocollo, e i numeri che la nutrizionista guarda per capire se sta funzionando diventano la '
      + 'media di cinque cose diverse. ⚠️ Ma è anche il tipo di attrito che, messo male, fa sembrare '
      + 'l\'app una cosa che non ti lascia fare — e chi ha una giornata storta smette di aprirla invece '
      + 'di adattare la finestra.\n\n'
      + '**Da decidere con Lucia prima di scrivere una riga**, e sono tre domande diverse: ogni quanto si '
      + 'può cambiare (una volta a settimana? al ciclo?); chi può farlo fuori da quella regola (la '
      + 'nutrizionista sempre, immagino); e cosa legge la cliente quando non può — che è la parte in cui '
      + 'un divieto diventa una spiegazione o un muro.',
  },
  {
    chiave: 'data-inizio-giorno-o-istante',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    nata: '2026-08-23T03:20',
    titolo: '`planStartDate` contiene due cose diverse — un giorno o un istante — e dal valore non si distinguono',
    dettaglio:
      '⛔ **Il pezzo che il 23/8 NON si è chiuso, e perché.** Quattro dei cinque punti che scrivono la '
      + 'data d\'inizio ricevono un **giorno** (`toDateOnly`: mezzanotte UTC del giorno di Roma) e ora '
      + 'lo traducono correttamente. Il quinto — `finalizeApproval`, l\'approvazione del bonifico — no, '
      + 'perché lì la data arriva da `clientProfile.planStartDate`, **che contiene due cose diverse**: '
      + 'il giorno scelto dalla cliente, oppure la scadenza del piano in corso (un istante), scritta '
      + 'da quella stessa funzione nel ramo della coda.\n\n'
      + '⛔ **E dal valore non si distinguono.** La prima stesura ci aveva provato — «mezzanotte UTC '
      + 'esatta = un giorno» — e la revisione ha mostrato che `subscriptionEnd`, partendo da un giorno, '
      + 'rende **proprio** mezzanotte UTC esatta: l\'euristica sbagliava sul caso più comune di tutti, '
      + 'e faceva nascere piani `active` con la partenza **nel futuro**. Cioè la forma ambigua della '
      + 'voce 258, per giunta invisibile a `promuoviCodeArrivate`, che cerca i `queued`. Tolta.\n\n'
      + '⚠️ **Cosa resta scoperto:** fra la mezzanotte e le 02:00 italiane, una cliente che paga e ha '
      + 'scelto di cominciare **oggi** nasce `queued`, e i menu arrivano alla passata notturna dopo. '
      + 'Fissato in un test che dice «difetto noto», così non cambia in silenzio.\n\n'
      + '⚠️ **La forma della soluzione non è un\'euristica migliore**: è che il campo dica da dove '
      + 'viene. Due campi diversi (`giornoInizioScelto` e `startDate`), o un campo affiancato che '
      + 'segni la provenienza. Poi la traduzione si può fare in tutti e cinque i punti, e la regola '
      + 'diventa una sola. ⚠️ Nota che `menu/data-inizio-chat.service.ts` risolve lo stesso dubbio '
      + 'con l\'informazione che ha — `status === \'queued\'` — e che è una risposta buona lì e non '
      + 'esportabile qui, dove lo stato è quello che si sta decidendo.',
  },
  {
    chiave: 'notte-in-cui-le-lancette-tornano-indietro',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: true,
    nata: '2026-08-23T02:05',
    titolo: '⛔ La notte in cui finisce l\'ora legale i menu si spostano di un giorno',
    dettaglio:
      '⛔ **Misurato il 23/8 con l\'orologio finto, non temuto.** Girando la suite come se fossero le '
      + '00:30 del **25 ottobre 2026** — la notte in cui le lancette tornano indietro, cioè un giorno '
      + 'di **25 ore** — cadono **tre file in più** rispetto a qualunque altra ora:\n\n'
      + '· `menu/menu.service.spec.ts` — cinque casi di erogazione, tutti con lo stesso scarto: '
      + '`Expected -1 / Received +1`. Uno dice «buffer: ha già un menu per un giorno futuro → non eroga '
      + 'altro» e ne eroga **quattro**;\n'
      + '· `menu/menu-measurement-gate.spec.ts` — «2° giorno del ciclo nel futuro → non bloccante» '
      + 'risulta **bloccante**: cioè il popup delle misure comparirebbe a chi non lo deve vedere;\n'
      + '· `menu/data-inizio-chat.service.spec.ts` — i quattro casi della finestra di blocco.\n\n'
      + '⚠️ **Le prove che dice non sono l\'ora:** alle 10:00 dello stesso giorno tutti e tre sono '
      + 'verdi, e la notte di **marzo** (quando le lancette vanno avanti) pure. È il giorno da 25 ore a '
      + 'romperli, e si vede solo in autunno.\n\n'
      + '⛔ **La forma del difetto è quasi certamente `+ n * 86_400_000`** su una mezzanotte locale: '
      + 'sommare 24 ore a una mezzanotte di Roma il 25 ottobre non dà la mezzanotte del 26, dà le 23:00 '
      + 'del 25. È il cugino del difetto chiuso oggi — un giorno trattato come una quantità fissa '
      + 'invece che come una domanda al fuso — e vive negli stessi file.\n\n'
      + '⚠️ **Cosa succederebbe davvero, e quando:** i menu della notte del 25 ottobre si spostano di un '
      + 'giorno, il gate delle misure blocca chi non deve, e la finestra di 24 ore sul cambio data '
      + 'sbaglia. Non è ipotetico e ha una data: **domenica 25 ottobre 2026**. Non è oggi, ma è segnato '
      + 'sul calendario.\n\n'
      + '⚠️ **Non corretto insieme al resto di proposito**: è un\'altra famiglia di casi, dentro '
      + 'l\'erogazione dei menu, e va guardata sapendo cosa ogni fixture vuol dire. Rendere verde un '
      + 'test in fretta è il modo di fargli smettere di verificare.\n\n'
      + 'Si riproduce con `ORA_FINTA=2026-10-24T22:30:00.000Z npm run test:notte`, e il controllo che '
      + 'dimostra che è l\'ora e non la data è `ORA_FINTA=2026-10-25T10:00:00.000Z npm run test:notte`.',
  },
  {
    chiave: 'giorno-nel-fuso-del-processo-piano-prova',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    nata: '2026-08-23T01:10',
    titolo: '`validaDataInizio` calcola il giorno nel fuso del PROCESSO: giusto su Render, sbagliato ovunque altro',
    dettaglio:
      '`commerce/piano-prova.ts:34` — `soloGiorno(d) = new Date(d.getFullYear(), d.getMonth(), d.getDate())` '
      + '— è la mezzanotte del **processo**, non `toDateOnly`. È la stessa formula che '
      + '`il-giorno-si-chiede.spec.ts` vieta come `setHours(0, 0, 0, 0)`, solo scritta in un altro modo, '
      + 'e `commerce/piano-prova.ts` non è nel perimetro di quel guardiano.\n\n'
      + '⚠️ Su Render `TZ` non è impostata, quindi il processo sta a UTC e il risultato è la mezzanotte '
      + 'UTC — **il giorno UTC**, non quello di Roma. Da lì passano due cose: la data d\'inizio scelta '
      + 'in fondo al questionario di «Conosciamoci», e il rifiuto «quel giorno è già passato». Fra la '
      + 'mezzanotte e le 02:00 italiane il giorno UTC è ancora ieri, quindi una cliente che a quell\'ora '
      + 'sceglie **oggi** sta in realtà scegliendo una data che il sistema considera di ieri.\n\n'
      + '⚠️ **Non è rotto oggi** e per questo non blocca: `statoPerGiornoDiInizio` (23/8) su un valore '
      + 'che non è mezzanotte UTC esatta torna al confronto per istanti, cioè al comportamento vecchio, '
      + 'e su Render il valore mezzanotte UTC lo è. Ma è giusto **per com\'è configurata la macchina**, '
      + 'non per come è scritto il codice: basta un `TZ` su Render, o girarlo altrove, e cambia. Ed è la '
      + 'definizione del difetto che non si riproduce.\n\n'
      + 'Da fare: portare `soloGiorno` su `toDateOnly`/`aGiorno`, misurare quante date esistenti '
      + 'cambierebbero giorno (come si è fatto con `diag:giorno-piani`), e mettere `commerce/piano-prova.ts` '
      + 'nel perimetro di `il-giorno-si-chiede.spec.ts`.',
  },
  {
    chiave: 'test-che-scadono-il-2-settembre',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: true,
    nata: '2026-08-23T00:40',
    titolo: '⛔ Il 2 settembre due suite diventano rosse da sole: dei test hanno la data scritta a mano',
    dettaglio:
      '⛔ **Misurato, non temuto.** Con `ORA_FINTA=2026-09-02T10:00:00.000Z npm run test:notte` — cioè '
      + 'la stessa suite girata come se fosse il 2 settembre, in pieno giorno — **due file sono rossi**:\n\n'
      + '· `coach/coach.service.spec.ts` — «la scadenza mostrata è quella del piano CHE EROGA»: si '
      + 'aspetta `2026-09-01`, e da quel giorno riceve `2026-11-01`;\n'
      + '· `monitoring/monitoraggio-abbonamento.spec.ts` — «alla prima pesata FISSA il riferimento»: il '
      + 'periodo finto risulta scaduto e il servizio lo chiude invece di fissare il peso.\n\n'
      + '⚠️ Dal **1 ottobre** se ne aggiunge un terzo, `agenda/agenda.service.spec.ts` («il controllo '
      + 'arriva fino a SERA dell\'ultimo giorno»), che rifiuta il periodo di ferie come già passato.\n\n'
      + '⛔ **È un difetto diverso da quello del fuso, ed è peggiore in un modo:** quello si vedeva due '
      + 'ore al giorno e poi passava; questo, dal 2 settembre, **non passa più**. Una CI rossa per '
      + 'sempre è una CI che si smette di guardare, e allora il primo difetto vero arriva in produzione '
      + 'in mezzo al rumore.\n\n'
      + '⚠️ **Non corretto insieme al fuso di proposito**: sono tre file di test con fixture di date '
      + 'intrecciate e ognuno chiede di capire cosa la sua data vuol dire prima di spostarla. Rendere '
      + 'verde un test in fretta è il modo di fargli smettere di verificare — la stessa ragione per cui '
      + 'il 21/8 questi quattro non erano stati toccati alle due di notte.\n\n'
      + 'La correzione è la stessa famiglia: la data della fixture si costruisce **da adesso** con la '
      + 'porta giusta, invece di essere scritta a mano in un giorno che poi arriva. Si verifica con '
      + '`ORA_FINTA=<data> npm run test:notte`.',
  },
  {
    chiave: 'alimenti-da-correggere-senza-data',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    titolo: 'La pagina «Alimenti da correggere» non dice di quando è: sembra vecchia di un minuto ed è di stanotte',
    dettaglio:
      'Nato da uno spavento vero, il 21/8 all\'una: dopo aver caricato 277 alimenti la pagina mostrava '
      + 'ancora `limone`, `cipolla`, `brodo vegetale`, `spinaci freschi` come **«Non in tabella»**, e la '
      + 'domanda di Simone è stata *«stiamo perdendo pezzi invece di farli?»*.\n\n'
      + '✅ **Nessun pezzo perso, e la spiegazione è misurata sul codice, non dedotta.** '
      + '`aggiornaIngredientiScoperti` è un **passo notturno**: calcola l\'elenco e lo **scrive** in '
      + '`nutrient_lookup_miss`. La pagina legge quelle righe scritte, non un calcolo dal vivo. '
      + 'L\'import è girato alle 19:43; il passo notturno non era ancora passato. Infatti '
      + '`npm run diag:crudo-cotto`, che calcola dal vivo, quei quattro non li segnalava già più.\n\n'
      + '⚠️ E il meccanismo che chiude un termine risolto **esiste già** (`risolto`, scritto il 20/8): '
      + 'la mia prima ipotesi — «le domande vecchie non si chiudono mai» — era **sbagliata**, e l\'ho '
      + 'verificata prima di scriverla qui.\n\n'
      + '⛔ **Quello che manca è una riga di testo**: la pagina non dice **di quando** è l\'elenco. Un '
      + 'elenco che può avere fino a ventiquattr\'ore e sembra vivo fa credere che il lavoro appena '
      + 'fatto non sia servito — ed è esattamente quello che è successo. *Un dato che agisce e non si '
      + 'vede.* Basta la data dell\'ultimo aggiornamento accanto al titolo, e — se si vuole — un '
      + 'pulsante per rilanciare il passo adesso invece di aspettare la notte.',
  },
  {
    chiave: 'digiuno-pubblicazione',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    titolo: 'Pubblicare il digiuno intermittente — le fondamenta sono scritte, restano i tre numeri',
    dettaglio:
      '⚠️ **Questa voce era stata aperta prima di misurare qualsiasi cosa, e lo diceva.** Adesso una '
      + 'parte è misurata e una parte è scritta: il testo di prima resta in fondo, perché una voce '
      + 'superata si riscrive dicendo cos\'è cambiato, non si cancella.\n\n'
      + '## ✅ IN PRODUZIONE dal 21/8 — backend, backoffice e app (OTA 2.2.2)\n\n'
      + '⚠️ **Verificato, non dedotto**: il manifest live risponde `"version": "2.2.2"`, e lo zip '
      + 'su GitHub ha lo stesso md5 di quello costruito (`d611875d…`). Backend e backoffice erano già '
      + 'saliti col commit precedente.\n\n'
      + '⛔ **E la scelta dei pasti è sparita del tutto** (Simone, 21/8): non c\'è più né la domanda '
      + 'del questionario, né la tendina della scheda staff, né i pallini nel profilo dell\'app. La '
      + 'finestra la scrive **solo** l\'orologio della cliente; in scheda si legge, non si tocca.\n\n'
      + '## ✅ Scritto e verde il 21/8 (consegna «orologio del digiuno»)\n\n'
      + 'Alla cliente non si chiede più **quali pasti salta** — una domanda astratta — ma **a che ora '
      + 'mangia**. `fastingWindow` resta il dato che il motore legge: non lo sceglie più nessuno a '
      + 'mano, lo **deriva** `menu/orologio-digiuno.ts` (modulo puro, 39 test).\n\n'
      + '⚠️ **La regola, ed è quella su cui avevo sbagliato la prima volta: la DURATA della finestra '
      + 'dice quanti pasti, la POSIZIONE non dice niente.** Il primo modello ancorava i pasti a ore '
      + 'fisse (colazione 08:00, pranzo 13:00…): provandolo, spostare la finestra di un\'ora cambiava '
      + '*cosa* mangi — e il manuale dice l\'opposto («gli orari si traslano liberamente, conta solo il '
      + 'blocco di digiuno»). Con quel modello l\'adattamento graduale — un\'ora al giorno per quattro '
      + 'giorni — sarebbe stato **quattro cambi di dieta di fila**. Il test lo prova su **tutte e 96 '
      + 'le posizioni** della giornata, non su tre casi scelti bene.\n\n'
      + '✅ **La prova che il modello regge**: 16:8 aperta alle 12:00 → **12:15 · 15:55 · 19:30**. Il '
      + 'piano del manuale (pag. 3) dice **12:00 · 16:00 · 19:30**. Non è tarato: esce dalla regola.\n\n'
      + '✅ **E chi digiuna oggi non si muove**: le tre occasioni della 16:8 danno pranzo, merenda e '
      + 'cena, cioè **esattamente** il catalogo digiuno di oggi (`skip_breakfast`, quote .45/.10/.45). '
      + 'Stessa struttura, stesso catalogo, stesso menu.\n\n'
      + '**Tre righe nuove in `FINESTRE_DIGIUNO`** — `skip_morning_snack` (finestra lunga, 4 pasti), '
      + '`skip_breakfast_and_snacks` (finestra stretta, 2), `skip_all_but_dinner` (OMAD, 1). ⚠️ '
      + '`struttura-per-digiuno.ts` **conta i pasti** invece di elencare le finestre, e infatti le ha '
      + 'accettate senza una riga di codice in più. ⚠️ E `skip_all_but_dinner` **non** è '
      + '`skip_breakfast_lunch`: fra le due c\'è la merenda, cioè un pasto intero — c\'è un test '
      + 'apposta perché nessuno le unifichi.\n\n'
      + '⚠️ **La derivazione cerca la riga DENTRO `FINESTRE_DIGIUNO`**, non con una seconda mappa: il '
      + 'giorno che qualcuno corregge una riga là, `finestraPerPasti` la trova da sé. E se un gruppo '
      + 'di pasti in tabella non c\'è torna `undefined` **senza ripiegare su una finestra vicina** — '
      + 'servire tre pasti a chi ne aspetta due è il difetto che a una cliente ha dato un pasto al '
      + 'giorno, e qui è chiuso dal davanti.\n\n'
      + '⚠️ **Il nome dello slot non è il nome che legge la cliente**: con la finestra 08:00-16:00 il '
      + 'motore chiama `lunch` il pasto delle 08:15, e scriverle «Pranzo alle 08:15» sarebbe dirle una '
      + 'cosa falsa. `etichettaPasto` dà «Primo pasto · Spuntino · Ultimo pasto». I nomi esatti li '
      + 'conferma la nutrizionista, e stanno tutti in quella funzione.\n\n'
      + '**Verificato:** suite intera **4179 su 4179**, **otto mutazioni su otto mordono**, e `npm run '
      + 'build` vero (`tsc -b && vite build`) verde su app e backoffice. ⚠️ `giornata-in-tre-forme` ha '
      + 'morso davvero: le tre forme nuove sono ora **dichiarate col motivo**, nel loro file.\n\n'
      + '## ⛔ Cosa ha trovato la revisione (sette cose, due gravi)\n\n'
      + '⛔ **Il difetto peggiore non era nel modulo nuovo: era nell\'averne pubblicato gli effetti '
      + 'senza le cause.** Le tre righe finivano nella **tendina del questionario**, sotto la domanda '
      + '«quali pasti preferisci saltare?», con due etichette che dicono i pasti che RESTANO: «Solo '
      + 'cena» lì si legge «salto solo la cena» e vuol dire **un pasto al giorno**. ⚠️ Il commento '
      + 'della tabella rivendicava già che quelle righe non si scelgono a mano, ma **nessuna riga di '
      + 'codice lo impediva** — una promessa senza guardia. → campo `selezionabile`, e '
      + '`FINESTRE_SELEZIONABILI` accanto a `VALORI_FINESTRA_DIGIUNO`: «cosa si accetta» e «cosa si '
      + 'propone» sono due domande.\n\n'
      + '⛔ **Nell\'app la card tornava con tutti i pallini spenti e nessuna spiegazione** — la voce '
      + '256 rifatta da un\'altra porta — e un tocco qualsiasi sovrascriveva la finestra derivata. '
      + '⚠️ Nel backoffice la `select` si presentava **vuota**, cioè «non impostata» per chi una '
      + 'finestra ce l\'ha: la protezione giusta esisteva venti righe sopra, su `dietFamily`, che è '
      + 'meno clinico.\n\n'
      + '⚠️ **Un difetto già in produzione, trovato di rimbalzo:** la mail del primo giorno riempiva '
      + '«comincia dal tuo **primo** pasto» con `pastoPrincipale`, che la tabella documenta come '
      + 'l\'**ultimo**. A una cliente 16:8 classica dice **già oggi** «comincia dal tuo primo pasto '
      + '(cena)». → campo `primoPasto` accanto, uno per domanda. E la push della 20-4 prometteva «un '
      + 'solo pasto completo» mentre la finestra ne tiene due.\n\n'
      + '⛔ **E un mio test non mordeva**: usava una finestra a un pasto solo, dove il ramo protetto '
      + 'non passa — tolta la protezione, restava verde. Riscritto, rimutato, adesso morde.\n\n'
      + '⚠️ **Due mie affermazioni erano false, corrette invece che cancellate.** «I nomi si prendono '
      + 'dal fondo della giornata»: a quattro pasti la **colazione** prende il posto dello spuntino '
      + 'del mattino, ed è la scelta che decide il catalogo. E «le clienti che digiunano oggi non si '
      + 'muovono»: vero **solo per `skip_breakfast`**. L\'orologio raggiunge **quattro finestre su '
      + 'otto**; le altre quattro — `skip_dinner` (il caso Sonia), `skip_lunch`, '
      + '`skip_breakfast_lunch`, `skip_dinner_breakfast` — al backfill **cambierebbero catalogo e '
      + 'quote**. `finestreRaggiungibili()` lo calcola e un test lo dichiara per nome: *niente tagli '
      + 'silenziosi*.\n\n'
      + '## ✅ Aggiunto il 21/8 sera — «a chi si chiede la finestra» (consegna 81)\n\n'
      + '**Otto colonne** su `ClientProfile` (protocollo, inizio, i due bersagli dell\'adattamento, i '
      + 'due del sonno, l\'ultimo cambio, e **`fastingSceltoIl`**) più la migrazione, tutte additive e '
      + 'nullable: il giorno del deploy in produzione non succede niente di visibile, ed è voluto.\n\n'
      + '⛔ **Il backfill non c\'è più, e non è un pezzo rimandato: è la decisione.** La specifica '
      + 'prevedeva di scrivere d\'ufficio protocollo e orario nel profilo di ognuna, dedotti dalla '
      + 'finestra storica — una traduzione fatta a tavolino, scritta nel profilo di persone vere mentre '
      + 'dormono. Adesso quella traduzione **esiste ancora ma non si salva**: è il valore con cui la '
      + 'pagina si apre. `fastingSceltoIl` NULL vuol dire «non gliel\'abbiamo ancora chiesto» — diverso '
      + 'da «non digiuna» — ed è quel NULL a far atterrare le sei clienti sulla pagina dell\'orologio al '
      + 'primo avvio. ⚠️ La regola **non guarda il calendario**: nessuna data di rilascio nel codice, si '
      + 'guarda se il dato c\'è. Così una riga sola serve le tre porte del §14 — chi digiuna da prima, '
      + 'chi ci passa domani, e chi ci mette lo staff fra sei mesi.\n\n'
      + '⛔ **Dove non so tradurre, non propongo niente.** Cinque clienti su sei sono su «salta la '
      + 'colazione», che l\'orologio riproduce **esatta**: per loro confermare non cambia un pasto. La '
      + 'sesta è su «salta la cena», che l\'orologio non sa fare: la pagina le si apre **vuota**, come a '
      + 'una cliente nuova, e quando sceglie parte la segnalazione. ⚠️ Nessuna eccezione scritta per lei '
      + 'nel codice: proporle la finestra «più vicina» sarebbe stato il suo stesso difetto rifatto da '
      + 'davanti — servire a qualcuno pasti che non ha chiesto perché somigliano ai suoi.\n\n'
      + '⛔ **`skip_lunch` ritirata** (`diag:digiuni`: zero clienti in digiuno). ⚠️ Ritirata, non '
      + 'cancellata: quel conteggio guardava **solo chi digiuna**, e non sapeva dire se il valore fosse '
      + 'rimasto scritto su qualche profilo passato a un altro percorso. → la riga esce dalle tendine e '
      + 'resta leggibile, e `diag:digiuni` adesso conta le finestre **su tutti i percorsi**: se torna '
      + 'zero anche lì, si toglie davvero. *Misura prima di decidere.*\n\n'
      + '**Verificato:** suite intera **4226 su 4226** (+47), **venti mutazioni su venti mordono** (più una controprova: un nome dentro un commento non deve accendere niente, e infatti non l\'accende), '
      + '`npm run build` verde su backend, app e backoffice.\n\n'
      + '## ⛔ Cosa ha trovato la revisione di questo pezzo (otto cose, tre gravi)\n\n'
      + '⛔ **`hidden` non nascondeva niente.** I pulsanti della finestra, nel profilo dell\'app, '
      + 'stavano su un `<div style={{ display: \'grid\' }}>` con `hidden={…}`. `hidden` funziona perché '
      + 'il foglio di stile **del browser** dice `[hidden] { display: none }` — ma uno stile inline è '
      + 'dell\'autore e **vince sempre**. Risultato: a una cliente con finestra derivata i pulsanti '
      + 'restavano a schermo sotto un riquadro che diceva «per cambiarla sposta la tua finestra», e un '
      + 'tocco qualsiasi la sovrascriveva. Esattamente il difetto che il commento sopra prometteva di '
      + 'impedire. → non si nasconde: **non si disegna**, e un test sul sorgente vieta `hidden={` nei due '
      + 'frontend.\n\n'
      + '⛔ **La ragione falsa era rimasta nel backoffice.** La voce conservata in fondo alla tendina '
      + 'portava un suffisso **fisso** — «dagli orari, non si sceglie qui» — per qualunque valore fuori '
      + 'lista. Vero per le tre che l\'orologio calcola; **falso** per `skip_lunch`, che è ritirata: '
      + 'mandava la coach a cercare un orario da spostare che non esiste. La stessa correzione l\'avevo '
      + 'fatta nell\'app e non qui. → un motivo per finestra, e un test che chiede che le derivate '
      + 'dicano «orari» e la ritirata **no**.\n\n'
      + '⛔ **`primoPasto` non era protetto da niente.** Il campo nato ieri per correggere la mail del '
      + 'primo giorno era scritto a mano su otto righe: rimettendoci il valore sbagliato, **tutti e 4216 '
      + 'i test restavano verdi**. Il difetto si poteva rifare in silenzio. → adesso il valore si '
      + '**ricalcola** da `salta` (un test che ricopia gli stessi otto valori non è una rete, è una '
      + 'seconda copia), e lo stesso per `pastoPrincipale`, che era controllato solo per «non è fra '
      + 'quelli saltati» — vero anche per un valore sbagliato.\n\n'
      + '⚠️ **Due commenti raccontavano cose che il codice non fa.** Le colonne del sonno erano '
      + 'descritte come se **da questa consegna** governassero il silenzio delle push: `fastingSleep` non '
      + 'compare da nessun\'altra parte, e quel silenzio oggi è una finestra **globale** uguale per '
      + 'tutte. Un campo dichiarato attivo e mai letto è un pezzo che nessuno implementa più. E il '
      + '«default 23:00/07:00» non esisteva: la colonna nasce NULL apposta, perché «non me l\'ha detto» '
      + 'non è «dorme dalle 23».\n\n'
      + '⚠️ **Il test del messaggio alla nutrizionista non poteva fallire**: passava il testo già '
      + 'tradotto e poi verificava che non ci fossero codici — vincolava la stringa scritta nel test, non '
      + 'la funzione. E l\'unico dato che il chiamante avrà in mano è `skip_dinner`. → la funzione '
      + 'prende il **valore** e traduce lei; un valore che la tabella non conosce si dice, dichiarandolo '
      + 'come codice. E non dice più «la finestra che **aveva**»: può averla scritta la coach cinque '
      + 'minuti prima.\n\n'
      + '⚠️ **Le etichette dei due frontend erano confrontate solo sulle chiavi**: si poteva cambiare '
      + '«Un pasto solo al giorno» in «Mangi solo a colazione» — falso — e la suite restava verde. Ora si '
      + 'confrontano **parola per parola** con la tabella.\n\n'
      + '⚠️ **E una mia giustificazione era già superata**: avevo scritto che una cliente uscita dal '
      + 'digiuno «si porta dietro la finestra». Non più — tutte e due le porte di scrittura la azzerano. '
      + 'Quello che il conteggio può ancora trovare sono le righe rimaste da **prima** di quella '
      + 'correzione, che è un motivo diverso e più piccolo, e sta scritto così.\n\n'
      + '## ✅ Aggiunto il 21/8 — i due metodi di cambio (consegna 82)\n\n'
      + '`menu/cambio-finestra.ts`: quale dei due metodi del manuale si applica, e cosa si scrive. '
      + '⚠️ **Lo decide la direzione, non la distanza.** Più tardi → il digiuno si allunga → è il '
      + '«reset», permesso subito. Più presto → si accorcerebbe → adattamento graduale, un\'ora al '
      + 'giorno, e il piano **lo esegue il sistema** (bersaglio in profilo + un passo per notte) '
      + 'invece di scriverlo a schermo come consiglio.\n\n'
      + '⚠️ La direzione si misura sulla **strada più corta**: le 08:00 sono quattro ore prima delle '
      + '12:00, non venti dopo, e le due letture portano a due metodi opposti. A dodici ore esatte il '
      + 'pareggio cade dalla parte che **allunga** — una parità non deve mai cadere dalla parte che '
      + 'accorcia.\n\n'
      + '⛔ **La revisione ha trovato sei difetti, quattro con la mutazione che sopravviveva.** Il '
      + 'peggiore: *rimandare non annulla*. A finestra già aperta lo spostamento in avanti vale da '
      + 'domani — giusto, un pasto già fatto non si disfa — ma le quattro ore in più **arrivano lo '
      + 'stesso stanotte**, e il sistema rispondeva «sedici ore» a un digiuno di venti. ⚠️ E il test '
      + 'che avevo scritto **cementava il numero sbagliato**: chi l\'avesse corretto avrebbe visto '
      + 'rosso e pensato di aver rotto qualcosa.\n\n'
      + '⛔ La causa era che tre rami rispondevano in tre modi diversi alla stessa domanda. Adesso c\'è '
      + '**una formula sola**: il digiuno va dall\'ultima chiusura (regola vecchia) alla prossima '
      + 'apertura (regola nuova). Da lì esce anche la proprietà che tiene tutto insieme, e che un '
      + 'test verifica su tutti e cinque i protocolli: **il digiuno in corso lo sposta l\'orario, non '
      + 'il protocollo**.\n\n'
      + '⚠️ Altre due: il passo che arriva da `config_param` non era controllato — a zero la cliente '
      + 'leggeva «in **Infinity** giorni apri alle 08:00» e il cron riscriveva lo stesso orario ogni '
      + 'notte per sempre; e la frase era cablata su «da domani» mentre il profilo veniva scritto per '
      + 'oggi.\n\n'
      + '**Verificato:** 4281 test su 4281, **tredici mutazioni su tredici mordono**.\n\n'
      + '## ✅ Aggiunto il 21/8 — le sei push (consegna 84)\n\n'
      + '`menu/push-digiuno.ts` più il tic `POST internal/cron/digiuno-push`, ogni dieci minuti. ⛔ '
      + '**Sei tipi non vuol dire sei notifiche al giorno**: 14:10, 16:8 e 23:1 ne mandano cinque, e '
      + 'ogni push tolta esce col **motivo scritto** — un silenzio senza spiegazione è '
      + 'indistinguibile da un guasto.\n\n'
      + '⛔ **La revisione ha trovato otto cose, e la prima era una regressione mia su una funzione già '
      + 'in produzione**: infilando la rotta nuova nel controller del cron avevo **rubato i decoratori** '
      + 'a `measures-nudge` (in TypeScript si attaccano all\'elemento che segue), e il sollecito misure '
      + 'sarebbe rimasto senza `@Public()` — 401 dal cron di Render, sollecito fermo. ⛔ E la rotta nuova '
      + 'non l\'avrebbe chiamata nessuno: mancava la voce in `render.yaml`. Adesso due test lo '
      + 'impediscono.\n\n'
      + '⛔ Le push arrivavano anche a chi **non ha più un piano** (o è archiviata, che le lascia i '
      + 'token push): sei notifiche al giorno per sempre.\n\n'
      + '⚠️ **Un difetto preesistente chiuso di rimbalzo**: il silenzio notturno dei solleciti misure '
      + 'era in UTC — «fra le 22 e le 8» voleva dire dalla mezzanotte alle dieci italiane. E il finto '
      + '`ConfigParamsService` dei test ignorava il valore di scorta, quindi in ogni test di quel file '
      + 'la guardia notturna era spenta: è il motivo per cui era sopravvissuto tanto.\n\n'
      + '## ✅ Aggiunto il 21/8 — l\'orologio in mano alla cliente (consegna 85)\n\n'
      + 'La pagina `/digiuno` col quadrante che si trascina, e la scheda in home che porta lì chi non '
      + 'ha ancora scelto. ⚠️ Si sposta **solo l\'apertura**: la durata la scelgono i bottoni, come '
      + 'vuole la Regola d\'Oro del manuale.\n\n'
      + '⛔ **La revisione ha trovato otto cose.** Il conto alla rovescia al centro **diceva il '
      + 'falso**: leggeva la finestra in corso di scelta, quindi mentre la cliente trascinava le '
      + 'diceva «stai digiunando» a chi poteva mangiare per altre sei ore — e la push avrebbe detto '
      + 'il contrario. I pallini dei pasti restavano disegnati **nelle ore di digiuno**. Sul telefono '
      + 'toccare una scritta spostava la finestra. Il quadrante era `role="img"`, quindi per chi usa '
      + 'un lettore di schermo non era **impostabile**. E l\'atterraggio automatico **cancellava il '
      + 'check-in** che stava compilando.\n\n'
      + '⛔ E **due test che non guardavano niente**: il flag `large-arc` dell\'arco SVG veniva letto '
      + 'in posizione 6 — la rotazione dell\'asse, sempre zero — e il flag `sweep` non lo guardava '
      + 'nessuno. Portandolo a zero l\'arco gira al contrario e disegna **le ore in cui non può '
      + 'mangiare**, con la suite tutta verde.\n\n'
      + '⚠️ E il **fuso**: l\'app leggeva l\'ora del telefono, il server ragiona in Europe/Rome. Una '
      + 'cliente in viaggio avrebbe letto una cosa sullo schermo e il contrario nella notifica.\n\n'
      + '## ⛔ Una decisione da prendere, tenuta in vista invece che scoperta fra un mese\n\n'
      + '⛔ **Tre finestre si possono ancora scegliere e l\'orologio non sa riprodurle**: «salta la '
      + 'cena», «salta colazione e pranzo», «salta cena e colazione». Conseguenza concreta: una cliente '
      + 'nuova sceglie oggi «Cena» nel questionario, e al primo avvio la pagina le si apre vuota e parte '
      + 'una segnalazione alla nutrizionista **per una scelta fatta cinque minuti prima**. Vale anche '
      + 'quando è la coach a scriverla: il sistema segnala a Lucia quello che Lucia ha appena deciso — e '
      + 'un avviso che arriva sempre non è un avviso.\n\n'
      + '⚠️ Non è un difetto del codice, che fa quello che deve. È una scelta con peso clinico: **o** '
      + 'quelle tre escono dalle tendine come `skip_lunch`, e allora la nutrizionista non può più '
      + 'prescrivere «salta la cena»; **oppure** la segnalazione va ristretta. Fino ad allora il numero è '
      + 'tenuto **scritto in un test**, che chiunque tocchi le tendine deve attraversare.\n\n'
      + '## ⛔ Cosa resta, e di chi è\n\n'
      + '⛔ **I tre numeri di prima restano quelli, e servono ancora**: `npm run diag:digiuni` (quante '
      + 'clienti e con che finestra — ⚠️ serve anche per decidere se `skip_lunch` si può eliminare: '
      + 'con l\'orologio non è disegnabile, sono due finestre corte); `npm run diag:catalogo` e '
      + '`diag:coda` (quante varianti digiuno approvate e complete); `npm run diag:kcal` (quante '
      + 'giornate sotto il fabbisogno).\n\n'
      + '⛔ **Quattro conferme della nutrizionista**, e la prima è la più urgente: chi dichiara una '
      + 'controindicazione **mentre sta già digiunando** — il caso della migrazione — si sospende '
      + 'subito o si aspetta? (Proposta: subito. I due errori sono asimmetrici, e la giornata piena è '
      + 'il comportamento normale del prodotto, non una misura d\'emergenza.) Poi: le tre domande '
      + 'cliniche e la soglia BMI; le quote per pasto prese dal manuale (**36 · 16 · 48** invece di '
      + '45/10/45 — ⚠️ la cena diventa il pasto più grande, è un cambio di forma della giornata); le '
      + 'soglie di durata → quanti pasti; i nomi che legge la cliente.\n\n'
      + '⛔ **Il resto della consegna**, nell\'ordine (✅ campi Prisma + migrazione: fatti; il backfill '
      + 'non c\'è più ed è la decisione, vedi sopra): '
      + '`PATCH /me/digiuno` coi due metodi di cambio; il cron del piano graduale; le sei push; '
      + 'l\'orologio in React e il widget in home; la scheda staff. Il foglio con tutto è '
      + '`Documents/Metabole/Digiuno_Orologio/` — `05_ALLINEAMENTO_21-8.md` per primo.\n\n'
      + '⚠️ **`pathType` non è protetto da `change_diet_type`** (`clients.service.ts:926`: '
      + '`DIET_TYPE_FIELDS` non lo contiene). Una coach non può cambiare vegetariana→vegana ma **può '
      + 'mettere a digiuno chiunque**, ed è la modifica più clinica delle tre. **Difetto già in '
      + 'produzione, non introdotto da questa consegna.**\n\n'
      + '✅ **Niente rilascio agli store**: `@capacitor/push-notifications` c\'è già, nessun plugin '
      + 'nativo nuovo → **OTA 2.2.1** (sugli store c\'è la 2.2) + deploy backend, che va **per primo** '
      + 'perché la migrazione la applica Render.\n\n'
      + '---\n\n'
      + '*Il testo di quando questa voce è nata, il 21/8, prima di misurare:* quello che c\'è già — '
      + '`menu/finestre-digiuno.ts`, `catalog/struttura-per-digiuno.ts`, le varianti in catalogo, '
      + '`pickDietFor`, l\'attività che chiede la finestra quando manca, le porzioni scalate, '
      + '`diag:digiuni`. E i tre numeri da avere prima di scrivere codice, che sono ancora aperti.',
  },
  {
    chiave: 'seed-nutrienti-firma-falsa',
    categoria: 'Da fare — codice',
    ordine: 0,
    blocca: false,
    titolo: '✅ Il seed azzerava i campi che non ha — corretto. (E la firma NON era falsa: mi ero sbagliato)',
    dettaglio:
      '⛔ **Trovato misurando, il 20/8 sera, mentre cercavo un\'altra cosa.** L\'import degli alimenti aveva '
      + 'creato «burro» con stato `crudo`; un quarto d\'ora dopo in tabella lo stato era `NULL` e la riga '
      + 'risultava **confermata**. Le date lo dicono senza margine: creata 19:43:36, confermata 19:58:07, '
      + 'modificata 20:12:46. In mezzo è passato `npm run seed:nutrienti`.\n\n'
      + '⚠️ `prisma/seed-valori-nutrizionali.ts` riga 301 scrive `state: r.state ?? null`, e su una riga '
      + '**non ancora confermata** riscrive **tutti** i campi — stato, sinonimi, macro — e poi **la firma**. '
      + 'Ha la guardia giusta per le righe già confermate («un deploy non deve disfare una decisione clinica») '
      + 'e **nessuna guardia per i dati più freschi dei suoi**: una riga creata quindici minuti prima da un '
      + 'import, con uno stato che il seed non ha, viene appiattita e timbrata come verificata.\n\n'
      + '⛔ **E quella firma è falsa.** «Confermato» in questa tabella vuol dire «un nutrizionista ha guardato '
      + 'questo numero». Nessuno ha guardato quelle undici righe: le ha firmate un seed. È lo stesso difetto '
      + 'di famiglia di tutta la giornata — qualcosa che dichiara di sapere una cosa che non sa — e qui è '
      + 'peggio del solito, perché la firma è il campo che decide se la riga esce dalla coda «da confermare», '
      + 'cioè se una persona la guarderà mai.\n\n'
      + '⚠️ **Danno vero, oggi:** undici alimenti comuni (burro, mandorle, noci, mela, pera, fragole, avocado, '
      + 'parmigiano, miele, pane integrale, ricotta) hanno perso lo stato che il foglio aveva compilato, e '
      + 'sono usciti dalla coda senza essere stati guardati. I sinonimi sono stati sostituiti con quelli del '
      + 'seed: la nuova «noci» non ne ha nessuno.\n\n'
      + 'Le due strade: **a)** il seed non tocca una riga più recente del suo elenco, e non firma mai — la '
      + 'firma la mette una persona; **b)** il seed scrive solo i campi che ha davvero, invece di azzerare '
      + 'quelli che non conosce (`state: r.state ?? null` diventa «se non ce l\'ho non lo scrivo»). ⚠️ Le due '
      + 'non si escludono, e la seconda è quella che vale anche per il prossimo campo che si aggiunge.\n\n'
      + '⛔ **E NON È UNA COSA CHE HA LANCIATO QUALCUNO: gira da sola a ogni deploy.** `render.yaml` riga 57 '
      + 'ha `preDeployCommand: … && npx prisma db seed && …`, e `prisma/seed.ts` chiama `seedValoriNutrizionali`. '
      + 'Si vede dall\'ora dell\'ultima modifica delle undici righe, che cambia a ogni giro: 20:12:46, poi '
      + '20:38:39. ⚠️ Quindi **il prossimo import subirà la stessa cosa al primo deploy successivo**, '
      + 'qualunque cosa importi: non è l\'incidente di una sera, è il comportamento normale. È il motivo per '
      + 'cui questa voce blocca: finché sta così, ogni riga caricata da uno script nasce con una firma falsa '
      + 'e senza lo stato che chi l\'ha compilata aveva scritto.\n\n'
      + '⚠️ E una conseguenza che vale la pena scrivere: **la coda «da confermare» si svuota da sola**. Quel '
      + 'campo esiste per decidere quali righe una persona deve ancora guardare; se un deploy le firma, '
      + 'quelle righe non le guarderà più nessuno. Un lavoro che sparisce dalla lista senza essere stato '
      + 'fatto è peggio di un lavoro che resta in lista.\n\n⚠️ **LA CODA DEL DIFETTO, misurata a fine serata con `npm run diag:crudo-cotto`.** In lista 2 («senza stato, e usati nelle ricette») ci sono **esattamente le undici righe rimesse a posto**, più l\'olio: `olio extravergine di oliva` 3024 ricette, `miele` 1333, `pane integrale` 931, `noci` 748, `parmigiano reggiano` 339, `burro` 295, `mandorle` 200, `avocado` 177, `mela` 114, `pera` 69, `fragole` 67, `ricotta di vacca` 57. Sono senza stato perché **il seed glielo ha azzerato**, e la riga restaurata è quella che lo stato non l\'ha mai avuto.\n\n✅ **Ma quello stato esiste ancora**, in `prisma/dati-alimenti-20-8.ts`: burro `crudo`, mandorle `secco`, noci `secco`, mela `cruda`, pera `cruda`, fragole `crudo`, avocado `crudo`, parmigiano `fresco`, miele `crudo`, pane integrale `secco`, ricotta `fresco`. Non è una deduzione: è la colonna compilata da chi ha fatto il foglio, cancellata da un `?? null`. Si rimette con uno script, **prova a vuoto prima**, riga per riga — sono 12 campi su alimenti usati in oltre 7.000 ricette. ⚠️ Su olio e miele però la risposta è «non si applica», ed è la voce `tabella-alimenti-igiene`: quella la scrive una persona dalla matita, non uno script.\n\n⚠️ **E una frase falsa stampata a schermo, da correggere.** `ripara:alimenti` dice «tolto il doppione **senza firma**», e non era vero: erano firmate tutte e due — la firma della nuova gliela aveva messa il seed. È rimasta dalla versione precedente della regola. Non ha cambiato niente di quello che è successo, ma **una ragione falsa stampata a schermo è la stessa malattia** di tutto il resto di questa voce, e va tolta insieme.\n\n⛔ **CORREZIONE, la sera stessa: il titolo di questa voce era SBAGLIATO, e la parte sbagliata era l\'accusa.** «La firma è falsa» non è vero. Le 57 righe di `VALORI` stanno dentro una funzione che si chiama `firmateDalCapo`, e sopra c\'è scritto: *«TUTTE LE RIGHE QUI DENTRO SONO NELLA TABELLA FIRMATA DAL CAPO NUTRIZIONISTA IL 18/8. La funzione esiste per una ragione sola: il confine dev\'essere visibile.»* Burro, mandorle, noci, mela, pera, fragole, avocado, parmigiano, miele, pane integrale e ricotta sono in quella tabella: **il capo nutrizionista le ha guardate davvero**. ⚠️ Avevo letto la riga della firma e non le quaranta sopra — lo stesso errore degli stati `liquido` e `fresco` di stamattina, e stavolta l\'accusa era al lavoro di una persona. Resta scritto qui: una voce sbagliata cancellata è una voce che qualcun altro riscriverà uguale.\n\n✅ **IL DIFETTO VERO ERA PIÙ STRETTO, ed è corretto.** `state: r.state ?? null` e `synonyms: r.synonyms ?? []` non vogliono dire «non ho questo campo»: vogliono dire **«azzeralo»**. Un seed è una **fonte**, non una fotografia dello stato finale: se non porta un dato quel dato resta com\'era, se lo porta vince lui. ⚠️ Valeva anche per l\'**indice glicemico**, che arriva da `importa:ig` e che il vecchio codice azzerava su ogni riga senza `gi`. Adesso l\'oggetto si costruisce solo con i campi che ci sono (`datiDellaRiga`), e `seed-non-azzera.spec.ts` lo tiene fermo con 8 test e tre mutazioni che mordono — compresa quella che confonde «campo assente» con «campo a zero», che su `sale` (0 kcal) sarebbe stata la prossima.\n\n⛔ **E UN DIFETTO MIO, trovato subito dopo:** lo script con cui aggiorno queste voci aveva attaccato un pezzo di testo **dentro la `chiave`** invece che nel dettaglio, perché in questa voce `categoria` viene subito dopo `chiave`. La chiave è la colonna su cui `carica:lavori` decide se una voce esiste già: con la chiave storpiata avrebbe creato un **doppione** invece di aggiornare. Corretto, e c\'è un test che pretende che ogni chiave sia una parola sola.',
  },
  {
    chiave: 'alimenti-numeri-copiati',
    titolo: '⛔ 173 righe su 245 del foglio alimenti hanno i valori copiati da un altro alimento',
    dettaglio:
      '⛔ **Il foglio dei 245 alimenti compilati non si può caricare.** La prova a vuoto di `npm run importa:alimenti` sui due elenchi insieme (32 righe del 19/8 + 245 del 20/8) ha mostrato che **173 righe su 245 hanno i valori nutrizionali identici a quelli di un altro alimento**. Non sono numeri sbagliati a caso: sono poche righe vere copiate su molti alimenti. **99 alimenti diversi** — tahina, ghee, miele, tempeh, branzino, polpo, fichi secchi, patate dolci, sesamo, olive nere, pangrattato, cacao amaro, stevia — hanno tutti esattamente «25 kcal, 1,5 proteine, 3,5 carboidrati, 2,5 zuccheri, 0,3 grassi, 2,2 fibre». Altri sette gruppi uguali: 19 fra farine e cereali tutti a 250, 15 latticini a 150, 14 fra frutta secca e semi a 600 (compreso «latte di mandorla non zuccherato», che è ~13), 8 pesci e carni a 120, 7 legumi cotti a 130, 7 frutti a 45, 4 legumi secchi a 320.\n\n⚠️ **Il mio controllo non l\'aveva visto, e non per distrazione.** Prima di farne un modulo avevo passato le 245 righe a un controllo di coerenza (Atwater: 4·proteine + 4·carboidrati + 9·grassi ≈ kcal). Ne segnalò **una**, e io dissi che il foglio era buono. Il controllo non aveva sbagliato: guarda **una riga per volta**, e una riga vera copiata resta coerente con sé stessa ovunque la si incolli. Nessun controllo di plausibilità interna può vedere un riempimento — la copia si vede solo mettendo le righe **accanto**.\n\n✅ **Cosa c\'è adesso.** Una guardia (`gemelli-alimenti.ts`) che raggruppa per valori identici e distingue i due casi che sembrano lo stesso: «pomodoro fresco / pomodori freschi / pomodoro pelato» **sono** la stessa cosa scritta in tre modi e passano, «tahina» e «peperone rosso» no. Gira **prima** di leggere la tabella — un import che parte e poi si accorge è un import che ha già scritto — e le scritture stanno in transazione: tutto o niente.\n\n⛔ **Cosa serve, e non lo può fare il codice**: le 173 righe vanno rifatte da chi ha compilato il foglio. È partito l\'Excel `alimenti_da_rifare_20-8.xlsx`, raggruppato per valore copiato, con le colonne da riempire. ⚠️ Le altre 72 righe erano a posto ma restano in attesa: lo script carica tutto insieme o niente, di proposito — mezza tabella caricata è una tabella di cui non si sa più a che punto era.\n\n✅ **CHIUSA la sera del 20/8: il foglio è stato rifatto e ricaricato.** Le 173 righe sono tornate compilate e questa volta il foglio è passato a **sei controlli** prima di diventare un modulo, non a uno: la **guardia dei gemelli** (la funzione vera del motore) dice **zero riempimenti** — restano 13 gruppi di valori identici e sono tutti lo stesso alimento scritto in modi diversi, «pomodorini / pomodoro ciliegia / pomodoro ciliegino», «filetto di merluzzo / merluzzo filetto» — e poi coerenza Atwater, stati riconosciuti dal motore, affidabilità IG, nomi doppi, valori impossibili. I valori distinti di kcal passano da **50 a 127** su 245 righe.\n\n⚠️ **Due cose misurate e NON corrette, scritte perché si sappiano.** **1)** La colonna dei carboidrati non usa sempre la stessa convenzione: 22 righe hanno più fibra che carboidrati (fibra esclusa, come il CREA), ma tre — `tahina`, `lievito nutrizionale`, `burro di arachidi naturale` — sommano oltre 100 g su 100, cioè lì la fibra è **dentro** i carboidrati. Sono 9, 20 e 6 g su alimenti che si usano a cucchiai: non sposta un piano, e non sono numeri miei da aggiustare. **2)** La colonna `category` è rimasta quella del riempimento: 19 alimenti sopra le 150 kcal sono etichettati «verdura» (tahina, miele, ghee, sesamo, tempeh, cacao, paprika). ✅ Non blocca niente — nel backend `category` serve **solo a ordinare l\'elenco** nella pagina Alimenti, non entra nei macro né nel menu — e si correggono dalla matita quando si passa di lì. ⛔ Non le ho indovinate io: dedurre la categoria dal nome sbaglierebbe sul primo caso nuovo, in silenzio, ed è la stessa cosa che ha prodotto il foglio.\n\n⚠️ **Resta un comando da lanciare**: `npm run importa:alimenti` per la prova a vuoto e poi `CONFERMA=1 npm run importa:alimenti`. Le righe nascono **non confermate** — «confermato» vuol dire «un nutrizionista ha guardato questo numero», e chi ha compilato il foglio non lo so.',
    categoria: DATI,
    ordine: 620,
    blocca: true,
    nata: '2026-08-20T18:30',
    fatta: true,
  },

  {
    chiave: 'esclusioni-radice-inizio-parola',
    titolo: 'La radice delle esclusioni toglieva 721 ricette in più: «olive denocciolate» non è frutta secca',
    dettaglio:
      'La mattina del 20/8 avevo aggiunto la ricerca per **radice** alle esclusioni, perché «mandorle» deve scattare anche su «mandorla». Sulle 118 ricette del catalogo del repo le righe in più erano quattro, tutte vere: **zero falsi positivi**, e l\'ho dichiarato sicuro. ⛔ Poi Simone ha lanciato `npm run diag:esclusioni` sul catalogo di **produzione**: su «frutta secca» la radice toglieva **721 ricette in più**, e a leggerle era sempre la stessa cosa — `⚠️ Filetto di sgombro al forno con limone e olive ← radice nocciol`. Uno sgombro con le olive tolto a chi è allergico alle nocciole. La colpevole è una parola sola: **«olive denocciolate»**, che contiene `nocciol`.\n\n⚠️ **Non è mai arrivato un allergene in tavola**: la radice *toglie* piatti, non ne lascia passare uno sbagliato. Ma a una cliente allergica alla frutta secca spariva **ogni piatto con le olive**, e un pool che si svuota così è un piano che non si riesce più a comporre.\n\n⛔ **E la nota che avevo lasciato nel codice indicava la leva sbagliata**: «se toglie roba che non c\'entra, alza `RADICE_MINIMA`». Non funziona: `nocciol` è già **sette** caratteri, alzare la soglia spegnerebbe la radice proprio sulle nocciole — cioè butterebbe via tutti i casi veri per cui esiste. Avevo in mente `polp`/`polpette`, dove il problema era davvero la lunghezza, e ho scambiato quel caso per la regola. **Il difetto non è quanto è lunga la radice: è DOVE combacia.**\n\n✅ **Corretto la sera del 20/8**: la radice conta solo se **comincia una parola**. `mandorl` in «latte di mandorla» sì, `nocciol` in «denocciolate» no. `RADICE_MINIMA` resta e non è ridondante: «polpette» comincia con `polp` a inizio di parola eccome, e il confine da solo non salverebbe le polpette da chi è allergico ai molluschi — due regole, due domande diverse. ✅ Rimisurato: «frutta secca» da **721 a 445** righe in più, e le 445 che restano dicono tutte una parola vera («mandorla», «nocciola», «arachide»). Le olive sono sparite.\n\n⚠️ **E la diagnostica adesso stampa la PAROLA del piatto**, non solo la radice. Prima diceva `← radice nocciol` e basta: per capire da dove venisse **ho dovuto indovinare** che fosse «denocciolate». Un elenco che va letto a mano deve dire il fatto, non il sospetto.',
    categoria: CODICE,
    ordine: 621,
    nata: '2026-08-20T18:50',
    fatta: true,
  },

  {
    chiave: 'esclusioni-chiave-dentro-parola',
    titolo: 'Le chiavi dentro una parola più lunga: «bovino» è corretto, gli altri casi vanno letti',
    dettaglio:
      '⚠️ **Difetto più vecchio della radice, e più delicato da correggere.** Il primo giro delle esclusioni cerca la parola chiave **intera** dentro il testo del piatto (`includes`), come fa da mesi. `npm run diag:esclusioni` adesso conta a parte quante volte quella chiave combacia **dentro una parola più lunga**: sono **212**.\n\n⛔ **E qui il confine di parola NON è la correzione**, al contrario della radice. Le due parole viste nell\'esito dicono perché:\n · «**aceto**» dentro «**sottaceto**» → **giusto**: il sottaceto l\'aceto ce l\'ha davvero, e mettere un confine di parola **toglierebbe** protezione a chi è sensibile ai solfiti;\n · «**vino**» dentro «**bovino**» → **sbagliato**: uno stracetto di bovino magro non c\'entra niente con i solfiti.\n\n⚠️ La stessa regola darebbe la risposta giusta a una e sbagliata all\'altra. Quindi non è una regola: è una **lista corta** di parole da guardare una per una. La diagnostica adesso le raggruppa per coppia (chiave, parola) invece di stampare una riga per ricetta — la prima versione ne stampava 212 per far scoprire che erano due parole, e un elenco che costringe a contare a mano è un elenco che non si legge.\n\n⚠️ **Non l\'ho toccato**, e non per prudenza generica: correggere il giro della chiave esatta vuol dire cambiare il comportamento che regge le esclusioni da mesi, e la direzione dell\'errore qui è l\'opposta — si rischia di **togliere** una protezione invece di restituire dei piatti. Si legge l\'elenco raggruppato e si decide parola per parola. ⚠️ È la stessa famiglia di «Gaia trovava mela dentro melanzane», chiusa il 19/8 sulla ricerca: lì la risposta fu «a parole intere», qui non può esserlo.\n\n✅ **CORRETTA il 20/8 sera, invece che chiesta.** Aprire una voce per «bovino» era sbagliato: è una parola, non una decisione di prodotto. In `exclusions.ts` c\'è `PAROLE_CHE_NON_SONO`, una lista corta di parole omonime — `vino` → `bovino, bovina, bovini, bovine` — e «sottaceto» resta escluso com\'era giusto. ⚠️ **Ogni riga di quella lista TOGLIE un\'esclusione**, quindi si scrive solo dopo aver letto la parola in un esito vero, mai per analogia: `bovino` l\'ha nominata la diagnostica. ⛔ **Resta da guardare il resto dei 212**: `npm run diag:esclusioni` adesso li raggruppa per coppia (chiave, parola) invece di stampare una riga per ricetta, quindi sono poche righe da leggere. Quelle che sono come «bovino» si aggiungono alla lista; quelle che sono come «sottaceto» si lasciano stare. ⚠️ E «biscotti» non è nessuna delle due: è una delle **due voci larghe** dei solfiti dichiarate nel codice il 13/8 — insieme ad «aceto» — che si tolgono se Lucia dice che sono eccessive.',
    categoria: SIMONE,
    ordine: 622,
    nata: '2026-08-20T19:10',
  },

  {
    chiave: 'pipeline-due-schede-indietro',
    titolo: 'Il rinnovo riporta la scheda a «Acquisito» anche se era più avanti',
    dettaglio:
      '`npm run diag:pipeline-indietro` (20/8 sera): **2 schede su 58** stanno in una colonna precedente a una in cui `stageDates` dice che erano già passate. Una «Acquisito → Prova», una «Da Ricontattare → Prova».\n\n✅ **Il passaggio automatico non può averlo fatto.** `avanzaStatoSeIndietro` rifiuta quando la colonna attuale ha un posto **maggiore o uguale** a quella di destinazione, e «Prova» (posto 4) sta prima di «Acquisito» (posto 6): la porta si è chiusa correttamente. E l\'unica porta che scrive senza guardare (`autoAdvance`) scrive solo `paid`, che è in avanti. ⚠️ Quindi quelle due schede **le ha spostate una persona dalla board**, che è una cosa legittima: la coach sa perché.\n\n⚠️ **Quello che la diagnostica non sa dire è CHI**, e potrebbe: `stageDates` porta il `byUserId` di ogni passaggio. Finché non lo dice, un numero come questo resta ambiguo — «due schede indietro» suona come un difetto e invece è lavoro di qualcuno. È il prossimo miglioramento di quello script, ed è piccolo.\n\n⛔ **Resta però una cosa vera nel codice, misurata e non ancora colpita**: `autoAdvance` scrive lo stato **senza guardare dov\'era la scheda**, e `commerce.service.ts` la chiama a **ogni pagamento sopra lo zero**, non solo al primo. Quindi il rinnovo del mese riporta la scheda a «Acquisito» anche se era a «Prima visita» o «Follow-up» — la cosa esatta che l\'altra porta esiste per impedire, fatta dal punto che la fa più spesso. Oggi non è successo (nessuna delle due schede torna indietro *verso* Acquisito), ma succederà al primo rinnovo di una cliente arrivata più avanti. La regola candidata è scritta nel docblock di `autoAdvance`: «avanza se è indietro, **e risuscita da Percorso concluso**» — chi rinnova dopo aver concluso deve tornare fra le attive, chi è a «Prima visita» e rinnova non deve perdere la visita che ha fatto.\n\n⛔ **VOCE RISTRETTA il 20/8 sera: le due schede non erano un difetto, e non dovevo aprirci una voce.** L\'avevo scritto io stesso nel testo qui sopra — «le ha spostate una persona, ed è legittimo» — e poi l\'ho lasciata aperta lo stesso. Un elenco di lavori che contiene cose che non sono lavori smette di essere un elenco di lavori. ✅ Quello che resta, ed è l\'unica cosa vera, è il comportamento di `autoAdvance` descritto qui sopra: **quello sì va deciso**, ed è una riga di regola. Il titolo adesso dice quello.\n\n✅ CHIUSA il 22/8 — deciso da Simone.\n\n«Sì, il rinnovo è comunque un acquisto, va bene così.» Quindi `autoAdvance` resta com\'è: una scheda che torna ad «Acquisito» quando la cliente paga di nuovo sta dicendo una cosa vera. ⚠️ La conseguenza resta e va saputa: chi rinnova da «Prima visita» o «Follow-up» perde quella posizione sulla board — il passaggio non sparisce (`stageDates` lo tiene con data e autore), la colonna sì. ⛔ La regola candidata («avanza se è indietro, e risuscita da Percorso concluso») è scartata, e resta scritta nel docblock di `autoAdvance` solo perché nessuno la riproponga fra sei mesi come se fosse nuova.',
    categoria: SIMONE,
    ordine: 623,
    nata: '2026-08-20T19:20',
    fatta: true,
  },

  {
    chiave: 'primo-accesso-allineamento',
    titolo: '«Primo accesso effettuato»: la colonna c\'è, restano due schede storiche da spostare',
    dettaglio:
      '✅ La colonna nuova esiste e i passaggi automatici sono a posto: `npm run diag:pipeline-stati` (20/8 sera) mostra «Primo accesso effettuato» al posto 1, fra «Nuovo contatto» e «Questionario completato», e conferma che **tutti** i passaggi automatici possono avvenire nell\'ordine giusto — nessuna colonna sta prima di quella da cui dovrebbe arrivare.\n\n✅ **E l\'allineamento delle schede vecchie è innocuo.** `npm run allinea:primo-accesso` in prova a vuoto: 58 clienti, **43 hanno un accesso o una registrazione nel registro**, e da spostare ce ne sono **due** — tutte e due si chiamano «Test». Le altre 41 sono già lì o più avanti. Si lancia con `CONFERMA=1 npm run allinea:primo-accesso` quando vuoi: sposta due schede di prova.\n\n⚠️ Una cosa vista di sfuggita e che vale la pena sapere: la colonna «Nuovo contatto» ha **86.244 schede**. Sono i lead importati, non clienti — ma è un numero che rende la board di quella colonna inutilizzabile a occhio, e prima o poi va deciso cosa farne.\n\n✅ **CHIUSA il 20/8 sera.** Non è un lavoro: è un comando che sposta due schede di prova. `CONFERMA=1 npm run allinea:primo-accesso` quando vuoi, e se non lo lanci mai non succede niente a nessuno. ⚠️ Resta annotata una cosa sola, che vale la pena sapere ma non è questa voce: la colonna «Nuovo contatto» ha **86.244 schede** (lead importati, non clienti), e a occhio quella colonna è inutilizzabile. Se un giorno diventa un problema si apre allora, con un numero davanti.',
    categoria: SIMONE,
    ordine: 624,
    nata: '2026-08-20T19:25',
    fatta: true,
  },

  {
    chiave: 'clienti-senza-numero-di-pasti',
    titolo: '17 clienti su 56 non hanno il numero di pasti: per loro non si sceglie nessuna dieta',
    dettaglio:
      'Uscito da una misura fatta per un\'altra ragione (`npm run diag:pasti`, 20/8 sera): **24 clienti a tre pasti, 15 a cinque, 17 senza il campo**. ⚠️ `pickDietFor` comincia con `if (!profile.regime || !profile.mealsPerDay) return null`: senza il numero di pasti non c\'è ripiego, non c\'è dieta «larga» — torna **niente**. Probabilmente sono clienti che il questionario non l\'hanno finito, ed è normale che sia così; ma sono **un terzo del totale** e prima di stasera non lo sapeva nessuno. Da guardare: quante di quelle 17 hanno un piano attivo (quelle sì che sono un problema) e quante sono solo iscrizioni ferme.\n\n✅ **E nella stessa misura, una cosa chiusa**: il DTO della scheda cliente accettava `mealsPerDay` = 3, 4 o 5, ma nel catalogo una dieta a **4 pasti** non è mai esistita — le varianti nascono `fasting ? 3 : meals === \'5\' ? 5 : 3`. Una cliente messa a 4 non trovava nessuna variante e `pickDietFor` ricadeva sul «purché sia dello stesso regime», dandole una dieta a 3 o a 5: un numero di pasti diverso da quello scritto sulla sua scheda, senza dirlo a nessuno. **Zero clienti a 4 pasti** in produzione, quindi il `4` è uscito dal DTO e basta — nessuno da spostare, nessuna migrazione.\n\n⚠️ Resta scritto, e non è stato sistemato: la domanda «quali pasti ha una giornata» è in **quattro** funzioni che sul 4 **non dicono la stessa cosa** — `slotsForMeals` restituiva quattro slot con la merenda, le altre tre lo trattavano come un tre, e il generatore non lo conosceva affatto e ricadeva sul cinque. Non lo raggiunge più nessuno, e sistemarlo vorrebbe dire decidere se una giornata da quattro pasti esisterà mai. Se servirà, si ricomincia da lì.\n\n✅ CHIUSA il 22/8 — deciso da Simone.\n\n«Non serve, quando attivano il piano lo chiediamo.» Le 17 senza il campo sono iscrizioni ferme, e il numero di pasti si chiede nel momento in cui serve davvero. ⚠️ Quello che resta vero e scritto: senza `mealsPerDay` `pickDietFor` torna niente, non una dieta larga. Va bene finché quel caso coincide con «non ha ancora un piano»; il giorno che una cliente con un piano attivo si trovasse senza quel campo sarebbe un altro problema, e `npm run diag:pasti` lo conta.',
    categoria: SIMONE,
    ordine: 625,
    nata: '2026-08-20T19:30',
    fatta: true,
  },

  {
    chiave: 'chi-vede-tutte-le-clienti',
    titolo: 'Marketing e Responsabile Marketing: due punti del codice dicono cose diverse su cosa vedono',
    dettaglio:
      'Trovato il 20/8 sera cercando gli elenchi scritti a mano. `const MANAGER_ROLES = [\'admin\', \'head_nutritionist\', \'sales\']` era copiato **identico in quattro servizi** — alert, analytics, dashboard, riassunti delle chat — e in tutti e quattro decide la stessa cosa: se chi guarda vede **tutte** le clienti o solo le sue. ✅ Adesso è una porta sola in `common/perimetro-clienti.ts`, con un test che impedisce che ne rinasca una quinta copia. Il comportamento **non è cambiato**: la consegna sposta e basta.\n\n⛔ **Ma le due risposte non combaciano già adesso.** `perimetroClienti` — la funzione nata l\'11/8 proprio per non avere perimetri copiati — risponde «nessun limite» a **tutto ciò che non è coach e non è nutrizionista**, quindi anche a `marketing` e `head_marketing`. L\'elenco dei quattro servizi no: sono tre ruoli e basta. ⚠️ Per quei due ruoli, quindi, alcune pagine mostrano tutte le clienti e altre no — e non perché qualcuno l\'abbia deciso.\n\n⛔ **Non l\'ho appianata**, e non perché sia difficile: è una decisione su **chi vede i dati delle clienti**, e la prendi tu. Le due strade sono «marketing vede tutto» (allora l\'elenco si allarga) oppure «marketing non vede le clienti» (allora è `perimetroClienti` che va stretta). Il test `perimetro-una-porta-sola.spec.ts` fissa **ruolo per ruolo** cosa rispondono tutte e due oggi, così quando si decide si vede nero su bianco cosa si sta cambiando.\n\n✅ CHIUSA il 22/8 — deciso da Simone.\n\n«Tanto lo definisco dai permessi, chiudi il punto.»\n\n⚠️ Una precisazione, perché la risposta non copre tutto e non voglio lasciarla credere coperta. La pagina Permessi decide QUALI SCHERMATE un ruolo apre; `perimetroClienti` decide QUALI CLIENTI vede dentro quelle schermate. Sono due leve diverse: togliendo a `marketing` una pagina, quella pagina sparisce — ma se un domani gliene si desse una che elenca clienti, `perimetroClienti` continuerebbe a rispondere «nessun limite» mentre i quattro servizi storici rispondono «solo le sue». ⛔ E NON è «resa innocua»: il marketing una pagina con dentro le clienti ce l\'ha GIÀ. `DEFAULT_PERMISSIONS` dà a `marketing` la vista su `crm_leads`, che è la tabella dei lead e passa da `perimetroClienti` — il quale per quel ruolo risponde «nessun limite». Oggi lo ferma soltanto un elenco di ruoli scritto a mano nel controller (`@Roles` su commerce), che la pagina Permessi NON tocca: quindi un utente marketing vede la voce «Gestione lead» nel menu e cliccandoci prende 403. ⚠️ Il giorno che qualcuno aggiunge `marketing` a quel `@Roles` per togliere il 403, si ritrova il reparto marketing dentro l\'intera tabella clienti, in silenzio. `perimetro-una-porta-sola.spec.ts` fissa ruolo per ruolo cosa rispondono oggi tutte e due.',
    categoria: SIMONE,
    ordine: 626,
    nata: '2026-08-20T19:35',
    fatta: true,
  },

  {
    chiave: 'lead-caldo-colonne-di-un-altro-crm',
    titolo: 'Il segmento del funnel si derivava dalle colonne di un altro CRM: dieci colonne su dodici erano ignote',
    dettaglio:
      'L\'elenco delle colonne che contano come «lead caldo» in `funnel-segment.ts` diceva `contacted, interested, recall, appointment, negotiation, trial, paid, won`. ⛔ **Sei di quelle otto in Metabole non esistono**, e **dieci delle dodici colonne vere l\'elenco non le conosceva**. Restavano riconosciute `trial` e `paid`: tutto il resto → **lead freddo**. Una cliente che aveva **già fatto la prima visita** risultava lead freddo in ogni evento del funnel e nelle email del ciclo di vita — cioè riceveva i messaggi pensati per chi non ci ha mai risposto. ⚠️ Non era un errore che si vedeva: era una risposta, sbagliata, data con sicurezza.\n\n✅ **Chiuso il 20/8 con due decisioni di Simone.** *Freddo è solo «Nuovo contatto»*: non più un elenco di colonne calde ma **una sola colonna fredda**, quella in cui una scheda nasce senza che sia successo niente. ⚠️ Ed è il verso giusto proprio per la ragione che ha prodotto il difetto: con un elenco di calde, **ogni colonna nuova nasce fredda** — «Primo accesso effettuato», creata lo stesso giorno, sarebbe nata fredda e nessuno se ne sarebbe accorto. E *«Percorso concluso» è ex cliente*: prima ci si arrivava solo con i soldi spesi **prima** di Metabole, quindi una cliente nata qui e arrivata in fondo al percorso non lo diventava mai — e sono le uniche email che parlano di tornare.\n\n⚠️ Cambia **da adesso in avanti**: gli eventi già scritti tengono il segmento vecchio, quindi nel pannello del funnel si vedrà un gradino il giorno del rilascio. Non è un\'anomalia dei dati, è la data in cui la domanda ha cominciato a essere fatta bene.',
    categoria: CODICE,
    ordine: 627,
    nata: '2026-08-20T19:40',
    fatta: true,
  },

  {
    chiave: 'digiuno-finestre-che-lorologio-non-sa-fare',
    titolo: 'Tre finestre si possono ancora scegliere e l\'orologio non sa riprodurle: o escono dalle tendine, o la segnalazione va ristretta',
    dettaglio:
      '⛔ **Trovato in revisione il 21/8, e tenuto in vista invece che scoperto fra un mese.**\n\n'
      + 'L\'orologio del digiuno sa produrre quattro finestre su otto. Fra quelle che si possono '
      + 'ancora **scegliere** — dal questionario e dalla scheda staff — ce ne sono **tre che non sa '
      + 'riprodurre**: «salta la cena», «salta colazione e pranzo», «salta cena e colazione».\n\n'
      + '⚠️ **Cosa succede in concreto.** Una cliente nuova compila oggi il questionario, sceglie '
      + 'digiuno e risponde «Cena». Al primo avvio la pagina dell\'orologio le si apre **vuota** — '
      + 'giusto, l\'orologio quella finestra non la sa fare — e quando sceglie parte una segnalazione '
      + 'alla nutrizionista. Cioè si segnala una scelta fatta **cinque minuti prima**. E vale anche '
      + 'quando è la coach a scriverla dalla scheda: il sistema segnala a Lucia quello che Lucia ha '
      + 'appena deciso. ⚠️ *Un avviso che compare sempre non è un avviso*, e questo comincerebbe a '
      + 'comparire sempre.\n\n'
      + '⚠️ **Non è un difetto del codice**, che fa quello che deve: la regola «se non so tradurla non '
      + 'la propongo, e lo dico a chi di dovere» è giusta, ed è quella che protegge la cliente su '
      + '«salta la cena» dal ricevere pasti che non ha chiesto. Il problema è che il prodotto '
      + '**continua a offrire** finestre che l\'orologio dichiara intraducibili.\n\n'
      + '⛔ **Le due strade, e hanno peso clinico diverso.** *(a)* Quelle tre escono dalle tendine come '
      + '`skip_lunch` — e allora la nutrizionista **non può più prescrivere «salta la cena»**, che è '
      + 'una limitazione vera e la decide Lucia. *(b)* La segnalazione si restringe a un caso più '
      + 'stretto — ma serve dire quale, senza tornare a guardare il calendario (il «prima del '
      + 'rilascio» è proprio quello che abbiamo tolto perché faceva tre regole al posto di una).\n\n'
      + '⚠️ Fino ad allora il numero è **scritto in un test** (`menu/chiedi-la-finestra.spec.ts`, «TRE, '
      + 'in attesa di decisione»): chiunque tocchi le tendine ci deve passare, invece di scoprirlo '
      + 'dalle segnalazioni. *Niente tagli silenziosi: se si scarta qualcosa, si dice quanto.*\n\n'
      + '⚠️ Entra **bassa** perché nasce da una revisione mia, come da regola del 19/8 — non perché '
      + 'valga poco: diventa urgente il giorno in cui la pagina dell\'orologio va in mano alle '
      + 'clienti, cioè prima del rilascio del pezzo React.\n\n'
      + '✅ **DECISO il 21/8: la (a), «escono dalle tendine».** E il 21/8 stesso sono uscite **tutte** '
      + 'le tendine, non solo quelle tre: la finestra non si sceglie più da nessuna parte, la deriva '
      + 'l\'orologio. Il caso che questa voce descriveva — la segnalazione a Lucia su una scelta fatta '
      + 'cinque minuti prima — non può più nascere, perché non c\'è più la scelta che la faceva '
      + 'nascere.\n\n'
      + '⚠️ Restano **leggibili** tutte e otto, e vale il costo clinico scritto sopra: «salta la cena» '
      + 'non è più prescrivibile. Vedi la voce sulle due porte.',
    categoria: CODICE,
    ordine: 628,
    fatta: true,
    nata: '2026-08-21T08:55',
    priorita: 'bassa',
  },

  {
    chiave: 'allergia-solfiti-sostituzioni',
    titolo: 'Allergia ai solfiti: il tag c\'è, ma il dizionario ne riconosce quattro parole su una dozzina — e le sostituzioni non ci sono',
    dettaglio:
      'Simone, 21/8: «dobbiamo integrare l\'allergia ai solfiti, la nutrizionista mi ha mandato il file con i '
      + 'cibi da sostituire e come sostituirli». **Lavoro in coda, non da fare oggi.** Il file sta in '
      + '`Documents/Metabole/Allergia_Solfiti/Guida_Completa_Allergia_Solfiti.pdf`.\n\n'
      + '## Cosa c\'è già, misurato (21/8)\n\n'
      + '✅ Il tag esiste ed è uno dei 14 UE: `catalog/allergens.ts` riga 25, codice `solfiti`, etichetta '
      + '«Anidride solforosa e solfiti». Quindi la nutrizionista può già taggare una ricetta, e una cliente '
      + 'che dichiara l\'allergia è già protetta **su quello che è taggato**.\n\n'
      + '⛔ **Ma il dizionario che SUGGERISCE il tag ha quattro parole**: `solfiti`, `solfito`, `vino`, '
      + '`aceto di vino`. La guida ne nomina una dozzina di portatori veri, e nessuno di questi verrebbe '
      + 'suggerito: frutta secca disidratata (albicocche, prugne, uvetta), pomodori secchi industriali, '
      + 'patate disidratate, **crostacei** (immersi in bisolfiti contro la melanosi), salsicce e insaccati, '
      + 'carne macinata confezionata, salse pronte (maionese, ketchup, senape), dadi da brodo, aceto '
      + 'balsamico, sidro, birra, succhi da concentrato, conserve di pesce. ⚠️ Il pre-tag **suggerisce** e '
      + 'la nutrizionista conferma (nessun tag automatico): quindi il difetto non è un piatto sbagliato '
      + 'servito in automatico, è che **a chi tagga non viene proposto niente** su una ricetta con l\'uvetta '
      + 'o coi gamberi, e il tag manca in silenzio.\n\n'
      + '## Cosa manca davvero: le SOSTITUZIONI\n\n'
      + '⛔ Il pezzo che la nutrizionista ha mandato non è un elenco di divieti, è un **prontuario di '
      + 'sostituzioni** — e per quello il progetto ha già la forma giusta: `menu/lattosio.ts`, dove '
      + 'l\'intolleranza al lattosio non toglie il latte ma lo sostituisce col delattosato, con scritto '
      + '**perché**. Le sette righe della guida:\n\n'
      + '| con solfiti | al posto |\n|---|---|\n'
      + '| aceto di vino / balsamico | succo di limone fresco, o aceto di mele «senza solfiti aggiunti» |\n'
      + '| vino per sfumare | brodo vegetale casalingo acidulato con limone, o succo di mela acerba |\n'
      + '| dado da brodo industriale | dado vegetale casalingo, o brodo fresco |\n'
      + '| frutta secca industriale | frutta fresca essiccata in casa a bassa temperatura |\n'
      + '| salsicce e insaccati | carne macinata al momento dal macellaio, sale pepe erbe |\n'
      + '| crostacei surgelati | pesce fresco di lisca locale, o crostacei garantiti non trattati |\n\n'
      + '⚠️ **Due di queste sostituzioni cambiano il piatto, non l\'ingrediente** (crostacei → pesce di '
      + 'lisca; insaccati → macinato fresco): non sono equivalenze come il delattosato, e vanno decise da '
      + 'Lucia prima di scriverle. Le altre quattro sono condimenti e si sostituiscono senza toccare il '
      + 'bilanciamento della giornata.\n\n'
      + '⚠️ E **una di esse cade dentro un altro allergene**: «senape» è uno dei 14, e la guida la nomina '
      + 'fra le salse pronte da evitare per i solfiti. Chi tocca questa parte guardi che le due regole non '
      + 'si contraddicano.\n\n'
      + '## Cosa NON è di questo pezzo\n\n'
      + '⛔ La guida parla anche di farmaci (colliri, anestetici con adrenalina, sciroppi col metabisolfito) '
      + 'e di ristorazione. **Fuori perimetro**: qui si decide cosa finisce nel piatto che eroghiamo noi. '
      + 'Metterlo in un menu vorrebbe dire dare un consiglio medico da un\'app di nutrizione.\n\n'
      + '⚠️ Soglia di legge, per chi ci lavorerà: l\'obbligo di dichiarazione in etichetta scatta sopra i '
      + '**10 mg/kg o 10 mg/l** espressi come SO₂ (Reg. UE 1169/2011). Sotto quella soglia i solfiti ci '
      + 'possono essere e **non essere scritti**: è il motivo per cui «leggi l\'etichetta» non basta come '
      + 'risposta, e serve una lista nostra.',
    categoria: DATI,
    ordine: 641,
    nata: '2026-08-21T11:20',
    priorita: 'neutra',
  },

  {
    chiave: 'digiuno-due-porte-per-la-finestra',
    titolo: 'La finestra del digiuno la scrivono in due: la scheda staff a mano, l\'orologio per derivazione — e una disfa l\'altra',
    dettaglio:
      '⛔ **Trovato in revisione il 21/8, e va deciso prima che qualcuno ci si scotti.**\n\n'
      + 'Da quando c\'è l\'orologio, `fastingWindow` — cioè **quali pasti riceve** — si **deriva** da '
      + 'protocollo e orario. Ma la scheda cliente del backoffice continua a scriverla **a mano** dalla '
      + 'tendina «Pasti che salta», che era la porta di prima e serve ancora alla nutrizionista.\n\n'
      + '⚠️ Le due porte non convivono: la correzione fatta dalla scheda dura **fino al primo spostamento '
      + 'della cliente**, che ricalcola la finestra dai suoi orari e la riscrive. E non se ne accorge '
      + 'nessuno — il riferimento dell\'attività di verifica non cambia per una traslazione di un\'ora, '
      + 'quindi non nasce nemmeno una segnalazione nuova. *Se due punti rispondono alla stessa domanda, '
      + 'uno dei due deve chiamare l\'altro.*\n\n'
      + '✅ **Intanto i testi delle attività non mentono più**: dicevano «la finestra si corregge dalla '
      + 'scheda», e adesso dicono che i pasti li decide l\'orologio della cliente. Una ragione falsa è '
      + 'peggio di un ordine sbagliato — ma la contraddizione sotto resta.\n\n'
      + '⛔ **Le strade, e la scelta è tua e di Lucia.** *(a)* La scheda staff smette di scrivere la '
      + 'finestra e scrive **protocollo e orario** (le stesse due leve della cliente): una porta sola, e '
      + 'la nutrizionista continua a poter intervenire. *(b)* La scheda resta com\'è e la sua scrittura '
      + '**vince**: allora serve un modo di dire all\'orologio «questa cliente ce l\'ha impostata a mano», '
      + 'o si torna al punto di partenza. ⚠️ La (a) costa meno e toglie una tendina; la (b) tiene alla '
      + 'nutrizionista una leva che l\'orologio non ha (prescrivere una finestra che l\'orologio non sa '
      + 'disegnare, come «salta la cena»), e quella leva oggi serve a una cliente vera.\n\n'
      + '⚠️ Legata alla decisione già in elenco sulle tre finestre ancora scegliibili che l\'orologio non '
      + 'sa riprodurre: è la stessa domanda vista dall\'altra parte.\n\n'
      + '✅ **DECISO E FATTO il 21/8, e più netto della (a).** Simone: «non ha più senso scegliere i '
      + 'pasti, sono campi che devono proprio sparire, e nella scheda cliente devo leggere le fasce». '
      + 'La porta adesso è **una sola** — l\'orologio della cliente — e la scheda staff **legge**: '
      + 'apertura, chiusura, protocollo, gli orari dei pasti, dalla stessa funzione che disegna '
      + 'l\'orologio in app. Sparita la tendina «Pasti che salta», sparita la domanda del questionario, '
      + 'spariti i pallini nel profilo dell\'app.\n\n'
      + '⚠️ **Non bastava togliere il campo dai DTO**: `PROFILE_FIELDS` è il ciclo cieco che scrive sul '
      + 'profilo, e finché `fastingWindow` era in quell\'elenco un chiamante qualsiasi lo scriveva lo '
      + 'stesso. La guardia sta dove si scrive. ⚠️ E anche uno **script** lo scriveva '
      + '(`prisma/sposta-percorso-cliente.ts`): azzerava la finestra e lasciava l\'orologio, che è lo '
      + 'stato peggiore dei due.\n\n'
      + '⛔ **Quello che si è perso, e va detto:** la nutrizionista non può più **prescrivere** una '
      + 'finestra che l\'orologio non sa disegnare («salta la cena»). Era la leva della strada (b), e '
      + 'oggi serve a una cliente vera. Se Lucia la rivuole, la forma giusta è protocollo + orario '
      + 'scritti dalla scheda — non il ritorno della tendina.\n\n'
      + '⚠️ Chi l\'orologio non l\'ha ancora toccato **si legge lo stesso**, in tutte e due le schede: '
      + 'la sua finestra storica sta decidendo quali pasti riceve, e un dato che agisce e non si vede '
      + 'è il difetto peggiore di questo progetto.\n\n'
      + '⚠️ Il permesso «Cambia i pasti del digiuno» non protegge più nessuna porta. Resta nella tabella '
      + 'dei ruoli: chi ce l\'ha oggi va avvisato prima di toglierglielo.',
    categoria: CODICE,
    ordine: 642,
    nata: '2026-08-21T11:40',
    fatta: true,
  },
  {
    chiave: 'digiuno-resta-corta-non-la-guarda-nessuno',
    titolo: 'La terza condizione della verifica digiuno — quella che guarda le calorie vere — non la calcola nessuno',
    dettaglio:
      '⚠️ **Dichiarato invece che lasciato credere** (revisione del 21/8). Il §3 del foglio decisioni dà '
      + 'tre condizioni per aprire la verifica alla nutrizionista, e dice che la terza è **la migliore**: '
      + '`restaCorta`, cioè «anche coi moltiplicatori delle porzioni al tetto, le calorie della giornata '
      + 'non arrivano al fabbisogno». Le altre due guardano il **nome** del protocollo (20:4, 23:1) e il '
      + 'numero di pasti; questa guarda quello che quella cliente **riceve davvero**.\n\n'
      + '⛔ Oggi le prime due ci sono e girano; **la terza non la calcola nessun punto del percorso.** '
      + 'Tre commenti nel codice dicevano «la aggiunge chi chiama», e chi chiama non la aggiungeva: '
      + 'adesso quei commenti dicono che manca, così nessuno la dà per coperta.\n\n'
      + 'Cosa serve per farla: il segnale esiste già — `menu/porzione-scalata.ts` torna `restaCorta`, e da '
      + 'lì esce `daily_kcal_below_target`. Il pezzo mancante è **collegarlo al momento della scelta**: '
      + 'quando la cliente imposta l\'orologio serve la sua dieta e il suo fabbisogno per sapere se con '
      + 'quella finestra ci arriva. ⚠️ In alternativa (forse meglio) la si aggancia **al segnale che già '
      + 'esiste**, cioè quando il motore compone la giornata e vede che resta corta: è più tardi di un '
      + 'giorno, ma è misurato sui menu veri invece che su una previsione.'
      + '\n\n## ✅ FATTA il 22/8 — agganciata al segnale che esisteva già\n\n'
      + '⚠️ **Non al momento della scelta**, che era la strada che avevo scritto per prima: '
      + '`impostaDigiuno` non ha in mano né la dieta né il fabbisogno, e per dirlo dovrebbe rifare '
      + 'il conto del motore. Due conti sulla stessa domanda divergono — è già successo due volte '
      + 'fra il motore e `diag:digiuni`. ✅ Nasce invece **all\'erogazione**, dove `porzione-scalata` '
      + 'torna già `restaCorta` sui pasti veri, dopo la scalatura: costa un giorno di ritardo e in '
      + 'cambio è **misurata** invece che prevista.\n\n'
      + '⚠️ Il riferimento dell\'attività è la **situazione** (finestra + spuntini tolti + dieta + '
      + 'quota arrotondata al 5%), non la data: `deliverIfEligible` gira a ogni apertura dell\'app, e '
      + 'una data lì dentro avrebbe fatto nascere un\'attività al giorno per la stessa identica cosa.\n\n'
      + '⚠️ **Non solo il digiuno**: una giornata corta col moltiplicatore al tetto è corta anche per '
      + 'chi ha degli spuntini tolti, o quando è il catalogo a non avere giornate sostanziose. Il '
      + 'testo dice **quale delle tre**, perché si chiudono in tre modi diversi — e nel terzo caso le '
      + 'porzioni non c\'entrano niente e manda a `diag:varieta`.\n\n'
      + '⛔ **E agganciandola è saltato fuori un difetto più grosso**: `apriAttivitaCoach` dichiarava '
      + 'da sempre «non lancia mai», e dentro **non aveva nessun `try`**. Mettendola nell\'erogazione '
      + 'del menu, un intoppo su `coachTask` avrebbe fatto fallire la consegna del menu della cliente '
      + '— cioè proprio il lavoro vero che quella funzione dice di non voler fermare. Adesso la '
      + 'promessa è mantenuta, torna `non-riuscita`, e lo scrive: se degradi, dillo.',
    categoria: CODICE,
    ordine: 643,
    nata: '2026-08-21T11:45',
    fatta: true,
  },
  {
    chiave: 'esclusioni-fuori-dal-pool',
    titolo: 'Il motore metteva il polpo nel piatto a un\'allergica ai molluschi, poi si fermava da solo — corretto',
    dettaglio:
      'Dalla domanda del 21/8: «Sonia non riceve i menu». `diag:cliente` in produzione: sei allergie dichiarate (crostacei, pesce, solfiti, lupini, molluschi, soia), **zero giornate erogate**, e una segnalazione «Piano bloccato» aperta lo stesso giorno con dentro «Polpo grigliato: contiene Molluschi» e «Bresaola: incompatibile con allergia solfiti».\n\n⛔ **Il blocco ha fatto il suo mestiere: sbagliata era la scelta.** Il filtro a monte esisteva già — `buildScoringContext` toglie dal pool le ricette vietate **sulla dieta** da Vera, «così non vengono nemmeno prese in considerazione» — ma le allergie e le intolleranze **della cliente** in quel filtro non c\'erano: entravano solo nel veto finale, dove una violazione ferma **tutta** la giornata (`return []`). Il motore pescava il polpo mentre nel pool c\'erano altri piatti.\n\n✅ Adesso ci passano anche loro, con **una funzione sola** per il filtro e per la guardia (`menu/esclusioni-della-cliente.ts`, puro): due copie vorrebbero dire un filtro che toglie un insieme di piatti e una guardia che ne vieta un altro, e la differenza fra i due sarebbe una cliente ferma senza che nessuno capisca perché — c\'è un test che verifica proprio che dicano la stessa cosa su ogni ricetta. ⚠️ Escono solo le ricette con una **violazione**: quelle sostituibili restano, e il piatto si eroga con la sostituzione annotata. ⚠️ **Uno slot che resterebbe vuoto non si svuota** (regola dell\'11/8): a fermare la giornata dev\'essere la guardia, che sa dire cosa e perché.\n\n⛔ **E il rimedio a mano non poteva funzionare:** la nutrizionista le ha dato una sostituzione la mattina del 21/8 e «non è stata comunque applicata» — con zero giornate erogate non c\'è nessun piatto su cui applicarla, e la composizione dopo ricadeva sul piatto successivo. Un piatto per volta contro un pool intero.\n\n⚠️ **Da verificare dopo il deploy**, ed è l\'unico pezzo che il codice non può decidere: `npm run diag:cliente` sulla sua email (che in questo repository non si scrive: `email-nei-file.spec.ts`). Se «Piano bloccato» è ancora aperta, il suo pool non ha alternative sicure per quel pasto — e allora il rimedio è il **catalogo**, o le due voci larghe dei solfiti (`aceto` e `biscotti`, dichiarate a parte in `exclusions.ts` apposta per poterle togliere se Lucia dice che sono eccessive).',
    categoria: CODICE,
    ordine: 629,
    nata: '2026-08-21T09:10',
    fatta: true,
  },

  {
    chiave: 'blocco-piano-non-si-zittisce',
    titolo: 'Chiudere «Piano bloccato» ne spegneva il cartello per quattordici giorni — corretto',
    dettaglio:
      'Trovato leggendo il codice il 21/8, e **non è il caso di Sonia** (la sua riga era aperta): è il caso di chiunque venga sbloccata mentre il motore ancora non compone.\n\nLa tregua dell\'11/8 («se ha risolto, basta fino a nuova segnalazione») è giusta per gli allarmi clinici: un avviso che ritorna da solo insegna a chiuderlo senza leggerlo. Ma la riga «Piano bloccato» **non è un avviso**: è ciò che `dietBlock` legge per dire all\'app `blocked`. Zittirla non toglieva un fastidio, toglieva lo **stato** — cliente ancora senza menu, nessuna riga in elenco, e in app «Menu in preparazione, arriverà a breve», che è falso. ⚠️ E `diet_blocked` non ha `severity`, quindi l\'eccezione «si riapre se peggiora» non la salvava mai.\n\n✅ `statoNonAvviso` in `apri-segnalazione.ts`: dentro la tregua non nasce un doppione — quello è il rumore che la tregua evita, giustamente — ma si **riapre la riga risolta** riscrivendoci il motivo di adesso. Lo usano i due punti che aprono il blocco: `menu.service` e `personal-base`. ⚠️ Sì: se la si richiude e il motore ancora non compone, tornerà. È il punto — il rimedio è far comporre il motore, non spegnere l\'unica cosa che lo dice.',
    categoria: CODICE,
    ordine: 630,
    nata: '2026-08-21T09:12',
    fatta: true,
  },

  {
    chiave: 'clienti-nuove-al-capo-nutrizionista',
    titolo: 'Le clienti nuove le prende il capo nutrizionista, finché è una sola — fatto',
    dettaglio:
      'Richiesta di Simone del 21/8, e Sonia ne è la prova: questionario del **7/8** con sei allergie dichiarate, e al 21/8 `diag:cliente` stampava ancora «Nutrizionista: — nessuna —».\n\n⛔ **E QUI AVEVO SCRITTO UNA COSA SBAGLIATA, smentita dalla misura poche ore dopo.** Avevo scritto che le sue segnalazioni cliniche erano «nate senza destinatario»: non l\'avevo misurato, l\'avevo dedotto dal codice. `npm run assegna:nutrizionista` in produzione dice **zero** segnalazioni aperte e orfane su **39** clienti, perché `apriSegnalazione` instrada già al **capo** quando il ruolo non è assegnato. Resta scritta invece che cancellata: *non spacciare un ragionamento per una misura*.\n\n⚠️ Quello che manca davvero è la **presa in carico della cliente**: senza nutrizionista in scheda, nelle liste, nella chat e nei perimetri quella persona non è di nessuno — e delle 39 **sei** hanno lo screening acceso, cioè un percorso in cui il menu parte *dopo la visita col nutrizionista*. ⛔ Resta anche un buco più piccolo, questo sì letto nel codice: le due `escalation.create` **dirette** in `onboarding.service` (screening e obiettivo irreale) non passano da `apriSegnalazione` e nascerebbero orfane; oggi non ce n\'è nessuna aperta.\n\n⚠️ «Il team non si assegna in automatico» resta la regola giusta quando le nutrizioniste sono più d\'una: distribuire i pazienti è una decisione. Con **una sola** non è una decisione, è un passaggio a mano — e quando salta, la cliente resta senza nessuno che risponda di lei.\n\n✅ Chi finisce il questionario senza nutrizionista sul lead va al **capo** (lo stesso destinatario che sceglie già `apri-segnalazione` quando il ruolo non è assegnato), **la coach no**, e mai sovrascrivendo un\'assegnazione esistente. Vale anche per chi **rifà** il questionario, che finiva nel ramo `update` dove l\'assegnazione non c\'era: «non sovrascrivere» e «non riempire il vuoto» sono due cose diverse.\n\n⚠️ Si spegne con `assign_head_nutritionist_by_default`, e la funzione **conta le altre nutrizioniste**: quando quel numero non è più zero la regola ha fatto il suo tempo e lo scrive nell\'audit, invece di restare accesa per sempre. ✅ `npm run assegna:nutrizionista` (sola lettura; `CONFERMA=1` applica) recupera chi è **già** rimasta senza — al 21/8 sono **39** — e riassegna anche le eventuali segnalazioni aperte e orfane. ⚠️ La prima passata dice anche che **«Dr.ssa Bini» esiste già**: la premessa «finché è una sola» è già scaduta, e la decisione se dividere le clienti è di Simone.',
    categoria: CODICE,
    ordine: 631,
    nata: '2026-08-21T09:14',
    fatta: true,
  },

  {
    chiave: 'diag-cliente-quattro-buchi',
    titolo: '`diag:cliente` ha stampato «Nessun piano attivo» a una cliente che un piano ce l\'ha — corretto',
    dettaglio:
      'Su Sonia, il 21/8, con «Conosciamoci» in coda dal 22/8. Il verdetto guardava `status === \'active\'` invece di `STATI_CON_UN_PIANO`: la regola di prima del 19/8, da quando un piano che comincia più avanti nasce `queued`. ⚠️ Una diagnostica che risponde diversamente dal codice manda a cercare il difetto dove non c\'è — ed è la **seconda volta** che succede proprio sulla domanda «perché non riceve il menu?» (la prima fu Giusy, il 13/8).\n\n✅ Corretti nella stessa direzione altri tre buchi: la misura di partenza era `misure === 0` («una pesata qualsiasi, in tutta la storia») invece di `mancaMisuraDiPartenza`, cioè quella **di questo piano**; `planHeldAt` veniva stampato ma **non era nella scala del verdetto**, quindi un piano fermato dal nutrizionista usciva come «Menu in preparazione»; e si leggevano solo le segnalazioni **aperte**, mentre nel caso della tregua quella che decide è una **risolta** (adesso stampa anche quelle degli ultimi 14 giorni, con quanti giorni fa).\n\n✅ Aggiunti i due stati che mancavano e che il codice ha da tempo — **Monitoraggio** e **finestra di visibilità** — e corretta la frase «si sblocca CHIUDENDO la segnalazione»: non è vero, il blocco si ricalcola a ogni composizione, ed è esattamente il malinteso da cui è partita la giornata.',
    categoria: CODICE,
    ordine: 632,
    nata: '2026-08-21T09:16',
    fatta: true,
  },

  {
    chiave: 'blocco-che-rientra-e-motivo-aggiornato',
    titolo: 'Una segnalazione aperta diceva cosa non andava IERI — corretto, e c\'è lo strumento per chiederlo al motore',
    dettaglio:
      'Dopo il deploy della correzione del pool, `diag:cliente` su Sonia mostrava ancora «Piano bloccato» con gli stessi due piatti. La lettura naturale è «non ha funzionato». ⛔ **E sarebbe stata sbagliata:** `ensureDietBlockedEscalation` cominciava con `if (already) return`, quindi una riga già aperta **non veniva mai aggiornata** — sarebbe rimasta identica anche a motore riparato — e nessuno la chiudeva quando la causa spariva (l\'unica chiusura automatica sta in `personal-base`, che è un\'altra strada).\n\n✅ **Due correzioni.** Se i motivi cambiano, il **motivo si riscrive** sulla riga che c\'è, senza doppioni: è la stessa scelta di `sbloccaPiano`, torna il motivo nuovo. E se l\'erogazione produce dei giorni, le segnalazioni «Piano bloccato» **di origine menu** si chiudono da sé con `resolvedAt`. ⚠️ Solo quelle di origine menu: il motivo comincia con una costante condivisa (`MOTIVO_BLOCCO_MENU`) usata dai tre punti che devono riconoscere la stessa riga — chi la apre, chi la aggiorna, chi la chiude. Quelle della base personalizzata sono un\'altra causa, e spegnerle da qui vorrebbe dire spegnere un allarme non verificato.\n\n✅ **E lo strumento che mancava: `npm run prova:erogazione -- <email>`.** Non c\'era modo di chiedere al motore **se compone**: c\'era solo la fotografia di una segnalazione, che poteva essere di ieri. Chiama `deliverIfEligible`, cioè la funzione che parte quando la cliente apre l\'app. ⚠️ **Eroga per davvero**, e lo dice in testa, ma non forza niente: se un cancello è chiuso non succede nulla e viene detto quale. Distingue i tre casi che prima si confondevano: giorni erogati · nessun giorno con un blocco (col motivo, e se è stato aggiornato adesso) · nessun giorno senza blocco, cioè fermo a un cancello.\n\n✅ **Confermato da Simone in produzione**: «ho fatto rigenera menu ed è andato». Il motore compone, la riga era vecchia.',
    categoria: CODICE,
    ordine: 633,
    nata: '2026-08-21T10:20',
    fatta: true,
  },

  {
    chiave: 'tabelle-frecce-anche-in-alto',
    titolo: 'Nelle tabelle a più pagine le frecce stanno solo in fondo: metterle anche in alto — su tutte',
    dettaglio:
      'Richiesta di Simone del 21/8: «dove ci sono le tabelle con più pagine mettiamo anche in alto le '
      + 'frecce per cambio pagina come in basso, metti in nota per dopo da fare su tutte le tabelle».\n\n'
      + '⚠️ **Perché non è un vezzo.** Su una tabella lunga, per cambiare pagina bisogna scorrere fino '
      + 'in fondo, cliccare, e poi risalire in cima a leggere — due volte per ogni pagina. Chi sfoglia '
      + 'venti pagine di clienti fa quaranta viaggi che non servono a niente. E le frecce in fondo si '
      + 'trovano solo se si sa che ci sono: in cima si vedono.\n\n'
      + '⚠️ **Su TUTTE le tabelle, ed è la parte che si sbaglia**: farlo su quella che si aveva sotto '
      + 'mano lascia il backoffice con due comportamenti diversi per la stessa cosa, che è peggio di '
      + 'nessuno dei due. La strada giusta è **un componente solo** — le frecce, il numero di pagina, '
      + 'lo stato «prima»/«ultima» — usato in alto e in basso dalla stessa tabella: due copie dello '
      + 'stesso blocco divergono, e qui divergerebbero **dentro la stessa schermata**.\n\n'
      + '⚠️ E la barra in alto compare **solo se le pagine sono più d\'una**: due righe di comandi '
      + 'attorno a una tabella di sei righe sono rumore.\n\n'
      + '⚠️ Prima di scrivere: censire dove sono le tabelle paginate oggi, perché la paginazione qui non '
      + 'è un componente ma un pezzo ripetuto a mano — il censimento È metà del lavoro.\n\n'
      + '## ✅ FATTO il 21/8 — e il censimento ha smentito la premessa\n\n'
      + '⚠️ **«La paginazione è un pezzo ripetuto a mano» era falso**, e l\'avevo scritto senza '
      + 'guardare. Il componente condiviso c\'era già (`usePagination` + `<Pager>` + `useTabella`), e '
      + 'sei tabelle su trenta la barra in cima ce l\'avevano dall\'11/8. Il lavoro era molto più '
      + 'piccolo di come l\'avevo descritto: *misura prima di decidere*, anche quando si decide solo '
      + 'quanto costa.\n\n'
      + '✅ **Adesso ce l\'hanno tutte e 27**, più `LeadsTable` — l\'unica paginata lato server, dove '
      + 'la conversione 0-based → 1-based è stata estratta in un posto solo (`pagerLead`): con due '
      + 'barre, un `+1` copiato e un `-1` dimenticato le mostrerebbe su pagine diverse.\n\n'
      + '⛔ **Due difetti veri trovati dal censimento, e non erano cosmetici.** `Agenti` e '
      + '`CoperturaCatalogo` chiamavano `useTabella` con un tetto (500 e 200 righe) e **non '
      + 'disegnavano nessuna barra**: le righe oltre il tetto esistevano, si filtravano, finivano '
      + 'nell\'Excel — e a schermo non c\'erano. Su `CoperturaCatalogo`, che è la schermata che dice '
      + '*cosa manca a catalogo*, voleva dire una copertura incompleta letta come completa.\n\n'
      + '⛔ **E la revisione ha trovato che la mia correzione non funzionava.** La card che contiene '
      + 'una tabella scorre dentro di sé (`theme.css`: `overflow: auto` + `max-height`), quindi una '
      + 'barra messa lì come primo figlio **se ne va al primo movimento di rotella** — invisibile '
      + 'proprio per tutto il tempo in cui serve. Avevo cercato l\'`overflow` nel JSX e stava nel '
      + 'CSS: l\'ho scritto giusto in due file e sbagliato in diciannove. ✅ Corretto in **un posto '
      + 'solo**: `<Pager sopra>` è `sticky` (`top`, `left` e `zIndex` sopra l\'intestazione '
      + 'incollata) — e così si sistemano anche le sei di prima, che avevano lo stesso difetto '
      + 'dall\'11/8 senza che nessuno se ne fosse accorto.\n\n'
      + '⚠️ La regola sta in un test (`frecce-anche-in-cima.spec.ts`) che guarda il sorgente: le due '
      + 'barre appaiate, la posizione rispetto alla tabella, e che chi pagina ne disegni una. ⛔ Le '
      + 'prime due stesure erano aggirabili — una rompeva perfino `npm run build` (leggeva i file con '
      + '`fs`, e il backoffice non ha i tipi di Node), un\'altra non vedeva i `<Pager>` con una '
      + 'freccia grassa nelle props, cioè proprio la forma di `LeadsTable`. Sei mutazioni provate una '
      + 'per una.',
    categoria: CODICE,
    ordine: 644,
    nata: '2026-08-21T13:50',
    fatta: true,
  },

  {
    chiave: 'attivita-nutrizionista-in-app',
    titolo: 'App staff: la nutrizionista non vede le sue attività nella sua dashboard',
    dettaglio:
      '⛔ **La push le arriva, la sua schermata non ce l\'ha.** Dal 21/8 quattro tipi di attività '
      + 'nascono addosso alla nutrizionista (digiuno estremo, finestra non traducibile, pasti non '
      + 'serviti, calorie che restano corte) e la push le arriva davvero. Il 22/8 le abbiamo aperto '
      + 'la pagina **del backoffice** — prima rispondeva 403 — ma l\'app staff no: `NutriDashboard` '
      + 'chiama `/nutritionist/dashboard`, `validation-queue` ed `escalations`, e `/staff/coach-tasks` '
      + 'non lo chiama nessuno. Il pallino sul tab è dietro `isCoachSide`, che non la comprende.\n\n'
      + '⚠️ Nel frattempo la push per i suoi tipi **dice dove si trova davvero** («in CRM › Attività '
      + 'da fare», nel backoffice) invece di «La trovi in Dashboard», che era falso: *se degradi, '
      + 'dillo*. Ma è un ripiego — lei sul telefono ci lavora.\n\n'
      + 'Da fare: una sezione «le tue attività» in `NutriDashboard` che legge `/staff/coach-tasks` '
      + '(l\'endpoint la serve già filtrata ai suoi quattro tipi e alle sue clienti), il pallino sul '
      + 'tab, e poi rimettere «La trovi in Dashboard» nella push.',
    categoria: CODICE,
    ordine: 660,
    nata: '2026-08-22T09:30',
  },
  {
    chiave: 'descrizioni-diete-tabella',
    titolo: 'Nutrizionista: tabella per leggere e correggere le descrizioni delle diete (quelle che la cliente legge in app)',
    dettaglio:
      'Richiesta di Simone del 22/8: *«nella parte del nutrizionista manca una tabella dove si '
      + 'vedono e si possono modificare le descrizioni delle diete, che sono poi quelle che si '
      + 'leggono in app come spiegazione»*.\n\n'
      + '⚠️ Prima di scrivere: **censire dove sta oggi quel testo** e chi lo mostra — la stessa '
      + 'spiegazione potrebbe arrivare da più di un campo, e in quel caso la tabella deve dire quale '
      + 'sta correggendo. Il censimento è metà del lavoro (lezione delle frecce, 21/8: la premessa '
      + 'scritta senza guardare era falsa).\n\n'
      + 'Da decidere con Simone: se la modifica è libera o passa dall\'approvazione del capo, come '
      + 'per le diete a catalogo; e se il cambio va storicizzato nel log (probabile sì: è un testo '
      + 'che la cliente legge).',
    categoria: CODICE,
    ordine: 661,
    nata: '2026-08-22T10:10',
  },
  {
    chiave: 'perimetro-nutrizionista-senza-assegnazione',
    titolo: 'Decisione: la nutrizionista deve vedere anche le clienti SENZA nutrizionista assegnata?',
    dettaglio:
      'Emerso il 22/8 aprendo la pagina Attività alla nutrizionista. Oggi `perimetroClienti` le dà '
      + '**solo le clienti assegnate a lei**; le clienti senza nutrizionista assegnata sono di fatto '
      + 'del **capo** (`nutrizionistaDiRiferimento`), che vede tutto.\n\n'
      + '⚠️ Finché la nutrizionista è una sola, la domanda non morde: il capo copre il vuoto. Con '
      + 'due o più, «le clienti di nessuno» diventano un buco che nessuno guarda per mestiere — ed è '
      + 'lo stesso momento in cui va spento `assign_head_nutritionist_by_default`.\n\n'
      + '⛔ Non l\'ho deciso io: è una decisione su chi vede i dati clinici di chi. Quando si '
      + 'decide, il posto da cambiare è **uno** (`common/perimetro-clienti.ts`) e tutte le pagine '
      + 'seguono.',
    categoria: SIMONE,
    ordine: 662,
    nata: '2026-08-22T10:15',
  },

  {
    chiave: 'markdown-nei-testi-alle-clienti',
    titolo: 'Le clienti leggono «Hai qualche **allergia** alimentare?»: markdown scritto e mai interpretato',
    dettaglio:
      '⛔ **Trovato il 22/8 guardando la pagina vera**, di rimbalzo da un difetto identico sulle '
      + 'attività della nutrizionista. In tutto il progetto **non esiste nessun renderer markdown** — '
      + 'niente `remark`, niente `marked`, nessun `dangerouslySetInnerHTML` — eppure decine di testi '
      + 'sono scritti col grassetto di markdown e mostrati come testo semplice. Gli asterischi si '
      + 'leggono.\n\n'
      + '⚠️ **Cosa vede una cliente, oggi**: in chat, `Hai qualche **allergia** alimentare?` '
      + '(`chat/allergie-chat.ts`, reso in `app/src/components/ChatSheet.tsx` come `{m.body}`). E poi '
      + '`menu/senza-glutine.ts` (corpo di una notifica), `vera/vera-chat.ts` in una decina di punti, '
      + '`menu/cambio-piatto.ts`, `menu/sostituzione-chat.service.ts`, `vera/allergeni-ricetta.ts`, '
      + '`commerce/annulla-abbonamento.ts`.\n\n'
      + '✅ **Già chiuso, e solo lì**: i sei testi delle **attività** (22/8), tenuti fermi da '
      + '`coach-tasks/niente-markdown.spec.ts`. E la pagina **Lavori** — questa — che aveva lo stesso '
      + 'difetto su 103 voci su 155: adesso il grassetto lo disegna `TestoConGrassetto`, che costruisce '
      + 'elementi React e non HTML, perché il dettaglio di un lavoro si scrive a mano dalla pagina.\n\n'
      + '⛔ **Le due strade, e vanno decise insieme.** *(a)* Si tolgono gli asterischi dai testi, come '
      + 'per le attività: è la strada giusta per tutto quello che finisce anche in una **push** o in '
      + 'una **email**, dove un renderer non ci sarà mai. *(b)* Si usa un renderer come quello della '
      + 'pagina Lavori nelle bolle della chat dell\'app: tiene l\'enfasi dove serve davvero (una '
      + 'parola che la cliente non deve saltare, tipo «allergia»). ⚠️ Non è la stessa risposta per '
      + 'tutti i testi: dipende da quante strade fa quella stringa.\n\n'
      + '⚠️ **Serve prima un censimento**, non una stima: un `grep` di `**` dentro le stringhe del '
      + 'backend, diviso per superficie (chat app · notifiche · email · backoffice). Il censimento è '
      + 'metà del lavoro, come per le frecce delle tabelle il 21/8 — dove la premessa scritta senza '
      + 'guardare si era rivelata falsa.',
    categoria: CODICE,
    ordine: 663,
    nata: '2026-08-22T11:30',
  },

  {
    // ⚠️ Chiave accorciata in fusione (23/8): quella originale era di 46 caratteri e il guardiano
    // `chiave-e-una-parola.spec.ts` la rifiuta. Si può ancora rinominare senza doppioni perché la
    // versione lunga NON è mai arrivata a un deploy: viveva solo nel file della sessione viaggio,
    // che la collisione delle consegne aveva tenuto fuori dal commit.
    chiave: 'viaggio-sospende-e-rientro',
    titolo: 'Modalità viaggio: sospende davvero, elenca le date, e il rientro arriva con un giorno d\'anticipo',
    dettaglio:
      'Richiesta di Simone del 23/8, dalla card «Modalità viaggio»: *dove vedo le date delle '
      + 'sospensioni?* e *se la vacanza finisce il 24, il 23 le chiedo le misure ed erogo il menu del '
      + '24*. La risposta alla prima domanda era: da nessuna parte — e la card stessa era un equivoco: '
      + 'scriveva tre campi sul profilo e NON fermava niente, mentre l\'app chiama «modalità viaggio» '
      + 'il `pause_period` creato da tutt\'altre porte.\n\n'
      + '✅ **Consegnato**: (1) la porta unica del rientro (`pause/giorno-di-rientro.ts`): in tabella '
      + 'resta l\'ultimo giorno sospeso, l\'interfaccia parla di «Riprende il» = primo giorno di '
      + 'dieta; (2) la **finestra di rientro** (`menu_visible_days_before_return`, 1): il giorno prima '
      + 'si chiede la pesata (in app, e dal giro notturno per chi l\'app non la apre) e si eroga il '
      + 'menu DEL giorno di rientro, composto con lo stato dell\'agente di QUEL giorno; il cancello '
      + 'sopravvive al giorno del rientro (`pausaAppenaFinita`) e il banner dice la data; (3) la card '
      + '**sospende davvero**: crea il periodo, allunga la scadenza dei soli giorni FUTURI, e un '
      + 'registro (`pauseRequest` con l\'etichetta della card, date mai riscritte all\'indietro) '
      + 'impedisce di regalare due volte gli stessi giorni — due giri di revisione avversariale hanno '
      + 'buttato giù le prime due stesure proprio qui; (4) l\'elenco in scheda '
      + '(`GET /admin/clients/:id/sospensioni`): periodi veri con l\'origine, richieste anche decise, '
      + 'storico della card dal registro (con le date, da oggi), periodi dichiarati in onboarding; '
      + '(5) le regole di Simone: **massimo 20 giorni** dall\'interfaccia, **tregua di 15 giorni** fra '
      + 'due vacanze (`pause_min_gap_days`) che FERMA le porte della cliente e AVVISA la coach in back '
      + 'office; (6) permesso nuovo `travel_mode` (solo admin di default: ⚠️ va acceso in Permessi a '
      + 'chi deve usare la card); (7) `npm run sblocca:sospensione` per chiudere una sospensione '
      + 'dalla shell; (8) il kit «Bentornata» non sovrascrive più giornate già erogate.\n\n'
      + '⚠️ **Restano aperte**: il Calendario in app crea sospensioni che NON allungano la scadenza '
      + '(stessa vacanza, soldi diversi a seconda della porta — da decidere); e il motore esce **muto** '
      + 'quando la dieta scelta non ha giornate al livello richiesto (caso Lorena, 23/8: «Digiuno '
      + '16:8» con la variante fasting a 4 settimane ma nessuna erogazione e nessun log — risolto '
      + 'spostandola su Mediterranea, ma il silenzio è un difetto suo).',
    categoria: CODICE,
    ordine: 664,
    nata: '2026-08-23T10:30',
    fatta: true,
  },

];
