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
    titolo: 'Importare la tabella dell\'indice glicemico del capo nutrizionista (~94 alimenti)',
    dettaglio:
      'PDF del 13/8 (Linus Pauling / International Tables 2008): IG con min e max, affidabilità, macro per 100 g, stato e fonte. ⚠️ Nessuna migrazione: `NutrientFact` ha già tutti i campi. Simone: si carica CONFERMATO di default (`verifiedById` = capo nutrizionista, `verifiedAt` valorizzato), perché «vuoti = da confermare» e finirebbe in una coda che nessuno ha chiesto. ⚠️ Prima va sciolto il crudo/cotto: la tabella dà la pasta BOLLITA (158 kcal), e una ricetta che dice «80 g di spaghetti» a crudo sbaglia di due volte e mezzo.',
    categoria: DATI,
    ordine: 20,
    blocca: false,
  },
  {
    chiave: 'vera-regola-dieta-scoperte',
    titolo: 'Vera: elenco delle clienti che un divieto di dieta lascerebbe senza un pasto',
    dettaglio:
      'Decisione di Simone (13/8): chi resta scoperta si salta e si segnala al capo con nome e cognome. Il pool oggi non svuota mai uno slot (`regola-dieta.slotScoperti` risponde alla domanda), ma l\'elenco al capo non c\'è ancora: senza, la regola sembra applicata a tutte.',
    categoria: CODICE,
    ordine: 16,
    blocca: false,
    fatta: true, // 14/8: `clientiScoperte` al momento dell'approvazione — nel messaggio del capo E nel dettaglio della riga
  },
  {
    chiave: 'vera-azione-3-variante-piano',
    titolo: 'Vera: azione 3 — la variante di piano per una cliente (tre frasi, tre meccanismi)',
    dettaglio:
      'Simone (13/8): devono funzionare tutte e tre. «Togli lo spuntino» = struttura della giornata (gli slot oggi vengono dalla dieta e dal digiuno, nessuno può toglierne uno per una persona sola); «a colazione qualcosa di salato» = tipo di piatto in UNO slot (oggi si potrebbe fare solo come esclusione, che varrebbe ovunque); «rifai con più proteine» = i numeri del piano (banda proteica/kcal). ⚠️ Si toccano solo i giorni futuri non ancora aperti, e la cliente NON si sposta di dieta.',
    categoria: CODICE,
    ordine: 17,
    blocca: false,
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
    titolo: '§15.2 punto 1 — il numero di kcal per «Conferma»',
    dettaglio: 'Il pulsante «Conferma» che applica la proposta aspetta la soglia in kcal.',
    categoria: NOCANTY,
    ordine: 60,
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
    titolo: 'Decidere se bloccare il percorso senza via libera clinico',
    dettaglio:
      'Oggi non si blocca niente, ed è una scelta scritta: bloccare vorrebbe dire sospendere piani attivi a clienti paganti. Il blocco, se sarà blocco, è una consegna sua.',
    categoria: SIMONE,
    ordine: 40,
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
    titolo: 'La visita nel calendario quando l\'esito è «serve una visita»',
    dettaglio: 'Oggi la decisione si registra ma la visita si prenota a mano.',
    categoria: CODICE,
    ordine: 20,
  },
  {
    chiave: 'coda-da-validare-b-c',
    titolo: 'Coda «Da validare» (§15.2): restano le consegne B e C',
    dettaglio: 'La A è stata consegnata l\'11/8. ⚠️ Il livello 2 non esiste (315 diete a livello 1): la voce 1 si fa in percentuale.',
    categoria: CODICE,
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
    titolo: '19/8 — rimuovere la diagnostica `traccia-diet-family`',
    dettaglio:
      'Tre file, non uno: `src/prisma/traccia-diet-family.ts`, il suo `.spec` e l\'aggancio in `src/prisma/prisma.service.ts`.',
    categoria: MANUTENZIONE,
    ordine: 20,
  },
  {
    chiave: 'ios-target-15',
    titolo: 'iOS: alzare il deployment target da 13.0 a 15.0',
    dettaglio:
      'Oggi non blocca, ma dalla primavera 2027 gli upload vengono rifiutati. Va fatto fare a `scripts/install-ios.mjs`, perché `ios/` viene rigenerato e la modifica si perderebbe.',
    categoria: MANUTENZIONE,
    ordine: 30,
  },
  {
    chiave: 'aggiornamenti-grossi',
    titolo: 'Aggiornamenti grossi: React 18, Vite 5, Prisma 6, Capacitor 6',
    dettaglio: 'Da fare in una sessione tranquilla, non insieme ad altro.',
    categoria: MANUTENZIONE,
    ordine: 40,
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
    titolo: 'Vera: il contenitore «citazione» per il testo incollato',
    dettaglio:
      'Oggi l\'assistente esegue solo ciò che la nutrizionista scrive di suo pugno. Quando le si darà in pasto un messaggio di una cliente o un referto, quel testo va marcato come CITAZIONE: se contiene qualcosa di azionabile si propone, non si esegue. Va fatto PRIMA di aprire quella porta, non dopo. Specifica §9.1.',
    categoria: CODICE,
    ordine: 210,
  },
  {
    chiave: 'vera-dashboard',
    titolo: 'Vera: i moduli in dashboard «quello che aspetta me»',
    dettaglio:
      'Per la nutrizionista: pool sotto soglia, proposte ferme dal capo, domande di dizionario senza risposta, sostituzioni da verificare. Per il capo: la sua coda più gli avvisi immediati. ⚠️ NON «quello che ho fatto»: un contatore delle regole create è una medaglietta che si guarda due volte. Specifica §13.3.',
    categoria: CODICE,
    ordine: 211,
  },
  {
    chiave: 'vera-azioni-raggio-largo',
    titolo: 'Vera: le azioni a raggio largo (variante di piano, ricette, regola su un tipo di dieta)',
    dettaglio:
      'Le azioni 3-6 della specifica. Oggi l\'assistente le RICONOSCE e dice che non le sa fare — che è la risposta giusta finché non ci sono. Le ricette nuove prendono i macro dalla tabella nutrienti, mai inventati, e passano dalla coda. Specifica §4.',
    categoria: CODICE,
    ordine: 212,
  },
  {
    chiave: 'vera-registro-allargato',
    titolo: 'Vera: il registro allargato a tutto ciò che cambia sulle sue clienti',
    dettaglio:
      'Oggi mostra le azioni dell\'assistente. Deve mostrare anche le sostituzioni di Gaia, gli alimenti che la cliente esclude dall\'app e i cambi del motore. ⚠️ Non è una tabella nuova: è il log delle modifiche della scheda cliente allargato a tutte le sue (AuditLog + FoodSwap + le Substitution dentro MenuDay.meals). Lettura e fusione. Specifica §13.2.',
    categoria: CODICE,
    ordine: 213,
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
      'Oggi capisci.ts è deterministico, con 16 casi di prova. AiService (Anthropic) c\'è già. La proposta: quando capisci torna null, chiedere al modello una PROPOSTA — che resta una proposta, mostrata e confermata come tutte le altre. ⚠️ Dopo, mai al posto: la scrittura non deve cambiare strada. Serve un sì di Simone perché cambia il costo e il comportamento.',
    categoria: SIMONE,
    ordine: 215,
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
    titolo: 'Voce di dizionario promossa a comune: sovrascrive le personali o convivono?',
    dettaglio:
      'Oggi convivono e la voce personale vince sempre su quella comune — «pasto leggero» non vuol dire la stessa cosa per due nutrizioniste. Va confermato che è il comportamento voluto, o deciso il contrario. Specifica §5.',
    categoria: NOCANTY,
    ordine: 217,
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
    titolo: 'Vera: rileggere il corpus PRIMA di toccare `capisci.ts`',
    dettaglio:
      '`GET /vera/corpus` restituisce le frasi vere: quelle capite (che devono continuare a passare) e quelle no (le parole da insegnare). ⚠️ È il rituale che tiene in piedi tutto il resto: un traduttore marcisce senza dare nessun errore rosso, e l\'unico modo di accorgersene è un elenco di frasi vere ripassato prima di ogni rilascio. Oggi è un endpoint che nessuno ha ancora l\'abitudine di aprire.',
    categoria: MANUTENZIONE,
    ordine: 222,
  },
  {
    chiave: 'vera-dizionario-alimento-nuovo',
    titolo: 'Vera: quando entra un alimento nuovo in catalogo, il dizionario non lo sa',
    dettaglio:
      '«Formaggi molli» è un elenco di alimenti deciso una volta. Il caciotta che entra in catalogo domani non ci finisce dentro, e la regola della nutrizionista smette silenziosamente di coprire quello che copriva. `dizionario.famiglieCheForsePrendono(alimento)` esiste già e risponde alla domanda giusta: manca chi la chiama quando una ricetta o un ingrediente nuovo viene pubblicato, e la domanda alla nutrizionista che ne segue.',
    categoria: CODICE,
    ordine: 223,
  },
  {
    chiave: 'vera-lavori-doppioni-caricati',
    titolo: 'Lavori: spuntare le voci di Vera doppie, se sono già state caricate',
    dettaglio:
      'Il 13/8 le voci di Vera sono finite due volte in `voci-iniziali.ts` (due sessioni, chiavi diverse per le stesse cose). Il doppione è stato tolto dal file, ma se `CONFERMA=1 npm run carica:lavori` era già girato in mezzo, in pagina restano `vera-moduli-dashboard`, `ai-assistant-enabled` e `dizionario-promossa-a-comune`: si spuntano dalla pagina, non si cancellano. ⚠️ E NON si rilancia il caricamento per «riallineare».',
    categoria: MANUTENZIONE,
    ordine: 224,
  },

  {
    chiave: 'vera-dizionario-cibi-diversi',
    titolo: 'Vera: il dizionario impara le VARIANTI, non i cibi nuovi',
    dettaglio:
      'L\'assistente si accorge che in catalogo è entrato «yogurt magro» e chiede se va dentro «formaggi molli», perché condivide la parola-testa con «yogurt greco» che c\'è già. NON si accorge della burrata accanto alla mozzarella: sono due parole diverse per cose simili, e nessuna euristica sui nomi le lega. ⚠️ Scelta voluta — proporre troppo insegna a rispondere di no senza leggere — ma va saputa: il buco si chiude solo con qualcuno che decide, o con una tabella di famiglie merceologiche che oggi non esiste.',
    categoria: CODICE,
    ordine: 225,
  },

  // ── Vera, azioni 4 e 5 fatte il 13/8: quello che è restato fuori ──
  {
    chiave: 'vera-azioni-3-e-6',
    titolo: 'Vera: restano la variante di piano (azione 3) e la regola su un tipo di dieta (azione 6)',
    dettaglio:
      'Le ricette (4 e 5) sono fatte. Restano: la VARIANTE di piano per una cliente sola, e la REGOLA su un tipo di dieta — «nella mediterranea non deve comparire più il tonno». ⚠️ Per la seconda oggi il filtro delle esclusioni è SOLO per-cliente: non esiste nessun campo o tabella che dica «in questa dieta questo alimento non compare». Il contenitore più diretto sarebbe `ProductRule` (`{dietId, ruleCode, params}`) con un codice nuovo, letto in `menu.service` dove si costruisce il pool. Decisione di Simone del 13/8: per la cliente si applica, la regola generale va come proposta al capo — e quando lui approva, si applica davvero.',
    categoria: CODICE,
    ordine: 226,
  },
  {
    chiave: 'vera-ricetta-allergeni',
    titolo: 'Vera: la ricetta nuova nasce senza allergeni marcati',
    dettaglio:
      'Approvare una ricetta la accende ma NON conferma gli allergeni: `allergensReviewed` resta false, e `collegaRicetta` si rifiuta di metterla in una giornata finché qualcuno non li conferma dalla scheda. È giusto che siano due responsabilità diverse, ma oggi il capo lo scopre dal fatto che la ricetta non compare da nessuna parte. Esiste già `recipeAllergenSuggestions(id)` in catalog: l\'assistente potrebbe proporli al momento dell\'approvazione, restando una proposta.',
    categoria: CODICE,
    ordine: 227,
  },
  {
    chiave: 'vera-ricetta-crudo-cotto',
    titolo: 'Vera: i valori nutrizionali non distinguono crudo e cotto',
    dettaglio:
      '`NutrientFact` ha il campo `state` (crudo | bollito | cotto | secco) e fa parte del significato dei numeri: 80 g di riso crudo e 80 g di riso bollito non sono la stessa cosa. La ricerca per nome prende la prima riga che combacia, quindi una ricetta scritta «riso 80 g» può prendere i valori dello stato sbagliato. ⚠️ Sbaglia in eccesso, non in difetto: il crudo pesa più del cotto a parità di grammi. Va deciso se chiederlo alla nutrizionista quando la tabella ha più stati per lo stesso alimento.',
    categoria: NOCANTY,
    ordine: 228,
  },

  // ── Vera: le due decisioni che restano prima di finirla (13/8) ──
  {
    chiave: 'vera-variante-cosa-significa',
    titolo: 'Vera, azione 3: «una variante di piano per questa cliente» vuol dire cosa?',
    dettaglio:
      'Due letture possibili, molto diverse per chi la usa. (a) Cambiare i PASTI dei giorni futuri di quella persona, lasciandola sulla sua dieta. (b) SPOSTARLA su una dieta diversa (o su una variante della sua). ⚠️ La (b) fa ripartire il piano da capo e cambia tutto quello che ha visto finora; la (a) no, ma non si porta dietro le regole della dieta nuova. Serve la risposta di Simone/Lucia prima di scrivere una riga: è l\'unica azione dove indovinare male non dà nessun errore, dà solo un piano diverso da quello che lei voleva.',
    categoria: SIMONE,
    ordine: 229,
  },
  {
    chiave: 'vera-esclusione-di-dieta',
    titolo: 'Vera, azione 6: l\'esclusione a livello di DIETA non esiste nel motore',
    dettaglio:
      '«Nella mediterranea non deve comparire più il tonno». ⚠️ Verificato sul codice il 13/8: oggi il filtro delle esclusioni è SOLO per-cliente — `menu/exclusions.ts` è agnostico, ma ogni chiamante costruisce le chiavi dal `ClientProfile` e da nient\'altro. Non esiste nessun campo né tabella che dica «in questa dieta questo alimento non compare»: finora si è fatta una dieta variante a mano («Mediterranea senza glutine») e il divieto vive come TESTO in `RulePreset.clinicalNotes`, che nessun codice legge. Il contenitore più diretto sarebbe `ProductRule` (`{dietId, ruleCode, params}`) con un codice nuovo, letto dove si costruisce il pool (`menu.service.buildScoringContext`) e/o in `evaluateMeals`, che è il punto obbligato di ogni erogazione. ⚠️ È l\'unico pezzo di Vera che tocca il percorso che porta il pasto nel piatto di domani, su 315 clienti: si fa a mente fresca, non di sera.',
    categoria: CODICE,
    ordine: 230,
  },
  // ── 13/8 pomeriggio: colazioni, battesimo di Vera, campagna allergie a tutti ──
  {
    chiave: 'colazioni-dolce-salato',
    titolo: 'Colazioni: la pagina «dolce o salata» è su — servono le conferme di Lucia',
    dettaglio:
      'Pagina nuova «Colazioni» nel backoffice (dal menu, sotto Allergeni ricette): il sistema propone dolce/salato dagli ingredienti delle sole ricette di colazione, Lucia conferma — anche in blocco. Il tag scritto È la conferma (`piatto:dolce`/`piatto:salato`), gli incerti restano senza proposta e li decide lei. ⚠️ L\'azione di Vera «a colazione qualcosa di salato» resta SPENTA finché le conferme non bastano: una colazione senza tag non partecipa. Decisione in `Decisioni_Simone_20260813.md` §12.',
    categoria: CODICE,
    ordine: 232,
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
  },
  {
    chiave: 'pasti-esclusi-in-scheda',
    titolo: 'Gli spuntini tolti da Vera non si vedono ancora nella scheda cliente',
    dettaglio:
      '«Togli lo spuntino» (azione 3, 13/8 sera) scrive `ClientProfile.pastiEsclusi` e il motore lo rispetta, ma NESSUNA scheda lo mostra: né backoffice né app. È lo stesso buco che avevano le allergie (§4 dell\'handoff): un dato che agisce e non si vede è un dato che prima o poi qualcuno contraddice senza saperlo. Serve una riga in sola lettura nella scheda cliente (accanto ai pasti del digiuno) e nel profilo dell\'app.',
    categoria: CODICE,
    ordine: 235,
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
      'Il secondo meccanismo della variante di piano (risposta di Simone, 14/8): dettare giornate intere — slot per slot, coi conti di kcal dalla tabella nutrienti — guidata da Vera, per UNA cliente, sui giorni futuri non ancora aperti. È la dettatura di menu, non un cambio di dieta: merita la sua decisione scritta prima (che pasti accetta, come si bilancia la giornata, cosa succede se i conti non tornano).',
    categoria: CODICE,
    ordine: 241,
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
    titolo: 'Vera: i cambi da verificare si potrebbero verificare a voce',
    dettaglio:
      'Il quadro della giornata li conta già e la tabella «Cambi concordati in chat» in scheda ha ✓/✎/✗. Portarli DENTRO la chat vuol dire decidere cosa succede quando la nutrizionista corregge i grammi a voce (i 70 ml di panna ≈ 200 kcal contro i 70 g di olio ≈ 630 sono il caso vero): serve la sua decisione prima del codice. Tenuto fuori dalla consegna del 14/8 di proposito.',
    categoria: CODICE,
    ordine: 245,
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
  },
  {
    chiave: 'vera-handoff-sessione',
    titolo: 'Vera: il passaggio di consegne sta in progetto/HANDOFF_Vera_Sessione.md',
    dettaglio:
      'La chat in cui Vera è stata costruita (12-13/8) è diventata troppo lunga. Tutto quello che serve per riprenderla da un\'altra sessione — cosa c\'è, dove sta, le regole di lavoro, le trappole già pagate e le due decisioni aperte — è in `progetto/HANDOFF_Vera_Sessione.md`. ⚠️ Va letto PRIMA di toccare `backend/src/vera/`: metà delle scelte che sembrano strane lì dentro sono difetti già pagati una volta.',
    categoria: MANUTENZIONE,
    ordine: 231,
  },

];
