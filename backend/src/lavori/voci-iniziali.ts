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
    chiave: 'nocanty-solfiti',
    blocca: true,
    titolo: 'L\'elenco dei solfiti da escludere',
    dettaglio:
      'Oggi l\'esclusione testuale ha solo la parola letterale «solfiti», dichiarato nel codice e in un test. I solfiti non si scrivono negli ingredienti: stanno nel vino, nell\'aceto balsamico, nella frutta disidratata, in certi salumi. Quell\'elenco decide quali piatti si tolgono dal piatto di una cliente, e in eccesso si sbaglia facilmente. Handoff allergie §1.2.',
    categoria: NOCANTY,
    ordine: 10,
  },
  {
    chiave: 'nocanty-soglia-visita',
    blocca: true,
    titolo: 'Quando far partire «serve la visita» in automatico',
    dettaglio:
      'Allergia dichiarata → richiesta di visita: il MODO di rispondere ora c\'è (via libera clinico, 13/8), la soglia è materia clinica. Handoff §8.',
    categoria: NOCANTY,
    ordine: 20,
  },
  {
    chiave: 'nocanty-freno-forte',
    blocca: true,
    titolo: 'Il «freno forte» per le allergie non confermate',
    dettaglio:
      '`allergieDichiarateIl` c\'è e si scrive, ma nessun comportamento parte da lì. Forma minima e sicura proposta: personal-base segnala la cliente come da rivedere e nella scheda compare «allergie non confermate». ⚠️ Non bloccare il piano di 315 clienti perché un campo nuovo è vuoto.',
    categoria: NOCANTY,
    ordine: 30,
  },
  {
    chiave: 'nocanty-scala-passi',
    titolo: 'La scala dei passi: 6.000 sedentaria → 12.000 molto attiva',
    dettaglio:
      '+5% ogni due settimane, tetto a +40% (decisione dell\'8 del 12/8). Per chi ha problemi cardiaci, articolari o è in gravidanza prescrivere passi è materia clinica.',
    categoria: NOCANTY,
    ordine: 40,
  },
  {
    chiave: 'nocanty-peso-efficacia',
    titolo: 'Il peso dell\'efficacia nei menu (`menu_select_w_eff`)',
    dettaglio:
      'Con i pesi di default un piatto a 5★ ora pareggia un piatto efficacissimo bocciato a 1★ (prima vinceva sempre l\'efficacia). È una manopola dei Parametri, e la gira lei.',
    categoria: NOCANTY,
    ordine: 50,
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
  },
  {
    chiave: 'vera-notifica-conflitto-canale',
    titolo: 'Vera: l\'avviso di conflitto sanitario oggi è solo in-app',
    dettaglio:
      'Una regola confermata sopra un vincolo dichiarato avvisa SUBITO i capi nutrizionisti, ma solo con una notifica dentro il backoffice. Se il capo non entra quel giorno, l\'avviso «subito» diventa un avviso «quando capita». Da decidere se aggiungere l\'email — è una scelta di Simone, non di codice.',
    categoria: SIMONE,
    ordine: 221,
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

];
