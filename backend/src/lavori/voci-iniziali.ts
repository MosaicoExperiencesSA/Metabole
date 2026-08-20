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
      'Trovato il 19/8 sera cercando tutt\'altro (la voce sulle schermate 30 e 27-28). La pagina delle **misure di partenza** del questionario diceva a ogni cliente: «Se non sai come prenderle, **guarda il video toccando il pulsante**». ⛔ Il pulsante non c\'è e il video non c\'è — in tutta l\'app non esiste nessun `<video>`, nessun asset, nessun handler. La frase veniva dal prototipo, dove le schermate 28-29 erano due video di presentazione: ⚠️ quei video **li ha annullati Simone il 17/07**, e il testo che li citava è rimasto in produzione per settimane. ⚠️ *Un difetto di testo non è un difetto minore quando il testo è una promessa*, e questa stava nel punto più delicato del questionario — le prime misure di una persona. Chi cercava il pulsante e non lo trovava pensava di aver sbagliato lei. ✅ **La bugia è tolta il 19/8 sera**, e al suo posto c\'è una cosa vera: «scrivimelo in chat: te lo spiego io» — la chat c\'è e le risponde una persona. C\'è anche un test che impedisce ai testi del questionario di promettere di nuovo un video o un pulsante che il prodotto non ha. ⛔ **Resta la domanda vera, e non è di software**: vita e fianchi si possono misurare in modi diversi e la differenza è di centimetri, cioè di quello che poi il motore legge come progresso. Come vogliamo dirglielo — un disegno, tre righe di testo scritte dalla nutrizionista, un video vero — lo decidono Simone e Lucia. Finché non è deciso, la chat regge: è lenta ma è onesta.',
    categoria: SIMONE,
    ordine: 620,
    nata: '2026-08-19T23:40',
    priorita: 'bassa',
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
      'Due lavori di mezz\'ora sulla tabella alimenti, tutti e due nati guardando la pagina vera il 20/8. **1) Le cinque righe che non hanno uno stato, e non devono averlo.** In cima all\'elenco «Alimenti da correggere» stanno `olio extravergine di oliva` (3025 ricette), `olio evo` (1706), `miele` (1331), più sale e zucchero: risultano «Senza stato». ⚠️ Ma all\'olio lo stato **non si applica** — crudo o cotto è la stessa cosa, 899 kcal restano 899. ⛔ Finché restano vuote fanno due danni invisibili: ogni ricetta dettata a Vera con l\'olio si porta dietro «la tabella non dice se il valore è a crudo» (*un avviso che compare sempre non è un avviso*, e compare sull\'ingrediente più usato del catalogo), e quelle righe occupano i primi posti dell\'elenco **nascondendo quelle da correggere davvero**. ✅ Dal 20/8 il valore c\'è: matita → campo Stato → «non si applica». Cinque righe. ⚠️ **Non si deduce, si dichiara**: nessuna regola indovina quali alimenti non hanno stato, e una che ci provasse sbaglierebbe sul primo caso nuovo in silenzio. **2) «spinaci freschi»: 1350 ricette che non si abbinano.** In elenco risulta «Non in tabella», e non dovrebbe: la regola dice che «freschi» è innocuo quando la riga è a crudo, e gli spinaci in tabella ci sono. ⚠️ L\'ipotesi è che la riga «spinaci» abbia lo **stato vuoto** — dal 19/8 sera «fresco» si accetta solo se combacia con lo stato della riga, e con lo stato vuoto non combacia niente. ⛔ **Ma è un\'ipotesi, e il 20/8 mi ha già morso due volte ragionare su dati immaginati invece che letti**: si legge con `NOME=\'spinaci freschi\' npm run diag:crudo-cotto`, che spiega passo per passo dove finisce quel nome e perché. Se è lo stato vuoto, è un campo — e lo stesso vale probabilmente per «prezzemolo fresco» (1207), «basilico fresco» (826) e «timo fresco» (670), che però sono aromi e pesano zero: quelli si tolgono dall\'elenco, non si correggono.',
    categoria: SIMONE,
    ordine: 615,
    nata: '2026-08-20T08:10',
  },

  {
    chiave: 'mese-confine-provvigioni',
    titolo: 'Provvigioni: controllare se il confine di mese sbagliato è già costato qualcosa',
    dettaglio:
      'Il difetto è **chiuso** (20/8): la parte economica prendeva il mese e il giorno nel fuso del **server** — su Render `TZ` non è impostata, quindi UTC — invece che in quello di Roma. Fra mezzanotte e le 02:00 del primo del mese, a Roma è mese nuovo e per il server no. ⛔ Tre conseguenze: **1)** una provvigione accreditata in quelle due ore veniva contata nel **mese precedente**, e per chi ha un tetto di guadagno quel mese era già pieno — l\'importo veniva tagliato e, siccome l\'eccedenza non slitta (decisione dell\'11/8), **perso**, senza una riga a registro e senza un errore; **2)** la finestra prelievi «dal 1 al 7» risultava chiusa nelle prime due ore del giorno 1 e aperta in quelle del giorno 8; **3)** la pagina «Compensi staff» filtrava il mese con un confine diverso da quello con cui il tetto aveva contato le stesse righe. ⚠️ È **lo stesso difetto già chiuso il 7/8 sulle misure** (la pesata delle 00:30 che sovrascriveva quella del giorno prima): sulle date delle clienti era stato corretto, sui soldi no — e il fuso giusto stava già in `common/date-only.ts`. ⛔ **Quello che resta è una misura, non un lavoro**: sapere se è già successo a qualcuno. Un comando, sola lettura, dalla shell di Render: `npm run diag:mese-confine`. Dice quante provvigioni sono nate nella fascia spostata e — la domanda che conta — se il tetto ha mai tagliato qualcosa lì vicino (lo legge dall\'audit, l\'unico posto dove un taglio lascia traccia). Se stampa zero tagli, il punto si chiude in trenta secondi; se ne stampa qualcuno, quei soldi si recuperano con «Ricalcola provvigioni» sul pagamento indicato.',
    categoria: SIMONE,
    ordine: 616,
    nata: '2026-08-20T10:40',
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
    chiave: 'che-giorno-e-oggi-trenta-punti',
    titolo: '«Che giorno è oggi» è ancora calcolato a mano in una trentina di punti, e risponde UTC',
    dettaglio:
      'Misurato il 20/8, non stimato: `grep` su `setHours(0,0,0,0)` e `Date.UTC(d.getUTCFullYear(), …)` trova **una trentina di punti** che si calcolano «oggi» per conto loro. Su Render il processo sta a UTC, quindi fra mezzanotte e le 02:00 in Italia tutti rispondono **ieri**. ⚠️ È lo stesso difetto chiuso il 7/8 sulle misure (la pesata delle 00:30 che sovrascriveva quella del giorno prima) e il 20/8 sui soldi: `common/date-only.ts` esiste apposta, e la maggior parte di questi punti è di prima e non è mai stata ricontrollata. ⛔ **Non li ho corretti tutti in blocco, di proposito**: fra questi ci sono `commerce/stati-abbonamento.ts` e `common/piano-attivo.ts`, che decidono se un piano sta erogando **oggi** — cambiare quel confine tocca chi riceve il menu domattina, e non è una cosa da fare a trenta file insieme senza guardarli uno per uno. ⚠️ Due cron girano dentro la fascia: `reminders` e `genera-catalogo` (ogni 10 minuti) e `measures-nudge` (ogni 2 ore, quindi anche alle 22:00 UTC = mezzanotte a Roma). Il giro giornaliero grosso invece è alle 05:00 UTC, fuori pericolo. ✅ Già corretti: il mese dei soldi (consegna del 20/8), la scadenza dell\'attività «Misure non inserite» (nasceva con la data di ieri). ⛔ Restano da guardare, in ordine di quanto costano: gli stati abbonamento e `piano-attivo` (chi riceve il menu), `pause.service` e `menu/data-inizio-chat` (date che la cliente legge), `coach-tasks` (scadenze e «in ritardo»), `privacy/cancellazione` (il termine di legge), `menu/senza-glutine` e `vera/*` (quali giorni si rifanno). Il resto è analitica e non sposta niente.',
    categoria: CODICE,
    ordine: 618,
    nata: '2026-08-20T12:10',
  },

];
