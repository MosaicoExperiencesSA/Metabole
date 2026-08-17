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
    titolo: 'Vera: il testo INCOLLATO non comanda l\'assistente',
    dettaglio:
      'Chiuso. `separaCitazione` (`capisci.ts`) divide quello che la nutrizionista scrive di suo pugno da quello che ha incollato, e `nuovoGiro` lo usa PRIMA di capire: se dentro la citazione c\'è qualcosa di azionabile e fuori no, l\'agente lo dice e si ferma (`testi.dallaCitazione`). ⚠️ È il cancello che impedisce a un messaggio scritto da qualcun altro di comandare chi ha il potere di scrivere regole su persone vere. Specifica §9.1.',
    categoria: CODICE,
    ordine: 210,
    fatta: true, // verificato nel codice il 16/8: separaCitazione in uso in nuovoGiro
  },
  {
    chiave: 'vera-dashboard',
    titolo: 'Dashboard «quello che aspetta me»: manca solo il pool sotto soglia',
    dettaglio:
      'Fatto quasi tutto: `/vera/aspetta-me` e il riquadro in cima alla home della nutrizionista mostrano le domande aperte, le proposte che aspettano il capo e le sostituzioni da verificare — e il riquadro sparisce quando sono tutte a zero, invece di dire «niente da fare». ⚠️ Dei quattro moduli della specifica §13.3 manca il POOL SOTTO SOGLIA: `PoolDisponibileService` sa calcolarlo, ma solo dentro l\'anteprima di una singola azione — non esiste un controllo che giri su tutte le clienti e dica «a questa restano tre cene». Prima di scriverlo va deciso QUANDO calcolarlo: a ogni apertura di pagina costa una query per cliente.',
    categoria: CODICE,
    ordine: 211,
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
    titolo: 'Lavori: spuntare le voci di Vera doppie, se sono già state caricate',
    dettaglio:
      'Il 13/8 le voci di Vera sono finite due volte in `voci-iniziali.ts` (due sessioni, chiavi diverse per le stesse cose). Il doppione è stato tolto dal file, ma se `CONFERMA=1 npm run carica:lavori` era già girato in mezzo, in pagina restano `vera-moduli-dashboard`, `ai-assistant-enabled` e `dizionario-promossa-a-comune`: si spuntano dalla pagina, non si cancellano. ⚠️ E NON si rilancia il caricamento per «riallineare».',
    categoria: MANUTENZIONE,
    ordine: 224,
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
    titolo: 'Vera: i valori nutrizionali non distinguono crudo e cotto',
    dettaglio:
      '`NutrientFact` ha il campo `state` (crudo | bollito | cotto | secco) e fa parte del significato dei numeri: 80 g di riso crudo e 80 g di riso bollito non sono la stessa cosa. La ricerca per nome prende la prima riga che combacia, quindi una ricetta scritta «riso 80 g» può prendere i valori dello stato sbagliato. ⚠️ Sbaglia in eccesso, non in difetto: il crudo pesa più del cotto a parità di grammi. Va deciso se chiederlo alla nutrizionista quando la tabella ha più stati per lo stesso alimento.',
    categoria: NOCANTY,
    ordine: 228,
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
    titolo: 'Cambiare gli ingredienti dal backoffice NON azzera gli allergeni confermati',
    dettaglio:
      '⚠️ Verificato nel codice il 16/8 scrivendo la voce 227: `catalog.updateRecipe` (riga 1187) scrive `ingredients` senza toccare `allergensReviewed`. Una ricetta con allergeni confermati a cui qualcuno cambia gli ingredienti dalla scheda resta `allergensReviewed: true` — con la conferma di PRIMA, data su un piatto diverso. Nessun errore, nessuna riga rossa, e il filtro degli allergeni continua a girare su un\'informazione vecchia. ⚠️ NON l\'ho chiuso da solo perché azzerare `allergensReviewed` a ogni modifica di ingredienti TOGLIE DAI MENU ogni ricetta che qualcuno tocca, finché non la si rivede: su 315 clienti è una decisione operativa, non un dettaglio tecnico. La metà che passa da Vera è già chiusa (la modifica approvata in chat rifà la domanda). Serve la decisione di Simone sul resto: azzerare sempre, azzerare solo se cambia la LISTA degli ingredienti e non le quantità, o segnalare senza spegnere.',
    categoria: SIMONE,
    ordine: 252,
  },
  {
    chiave: 'app-dati-che-non-legge',
    titolo: 'App: sei dati che il server manda alla cliente e nessuna schermata mostra',
    dettaglio:
      'Trovati il 16/8 con un giro sistematico su tutte le rotte `/me/*`, cercando il difetto già pagato tre volte in questo progetto — un dato che agisce e non si vede. I due più gravi (i traguardi raggiunti e il guardrail del calo rapido) sono stati chiusi lo stesso giorno; questi restano, e sono SCHERMATE NUOVE, non correzioni: **1)** `GET /me/progress` non lo chiama nessuno — media mobile, chili persi, PROIEZIONE della data obiettivo, giorni di stallo — eppure il calcolo gira e lo leggono il motore e l\'allarme di stallo della coach: agisce su di lei ed è l\'unica a non vederlo. **2)** `GET /me/cycle` mai chiamato: le due cotture del ciclo, le stelle di gradimento (che decidono cosa il motore le ripropone) e l\'esito del ciclo precedente. **3)** `totalSafe` e `certificate` da `/me/personal-base`: quante ricette sono state certificate sicure per lei e la firma del certificato di personalizzazione — la prova numerica che la personalizzazione è avvenuta, e la sola persona a cui interessa non ce l\'ha. **4)** `since` in `/me/measurement-gate`: da quando il menu è fermo (oggi legge «contatta la tua coach» senza sapere da quanto). **5)** `thighsCm`: lo staff può registrarle una circonferenza cosce che lei non vedrà mai. **6)** `GET /me/ratings/pending` esiste e il popup delle valutazioni non lo usa: si ricostruisce l\'elenco da `/me/menu` e ripropone anche i piatti già votati. ⚠️ Le prime tre vanno disegnate prima di scriverle: sono pagine, non righe.',
    categoria: CODICE,
    ordine: 253,
  },
  {
    chiave: 'vera-handoff-sessione',
    titolo: 'Vera: il passaggio di consegne sta in progetto/HANDOFF_Vera_Sessione.md',
    dettaglio:
      'La chat in cui Vera è stata costruita (12-13/8) è diventata troppo lunga. Tutto quello che serve per riprenderla da un\'altra sessione — cosa c\'è, dove sta, le regole di lavoro, le trappole già pagate e le due decisioni aperte — è in `progetto/HANDOFF_Vera_Sessione.md`. ⚠️ Va letto PRIMA di toccare `backend/src/vera/`: metà delle scelte che sembrano strane lì dentro sono difetti già pagati una volta.',
    categoria: MANUTENZIONE,
    ordine: 231,
  },
  {
    chiave: 'digiuno-catalogo-per-finestra',
    titolo: 'Digiuno: il catalogo servito lo decide la FINESTRA (Sonia riceveva un pasto al giorno)',
    dettaglio:
      'Trovato il 17/8 con `npm run diag:digiuni`: la variante `fasting: true` del catalogo ha tre slot FISSI (pranzo, merenda, cena) — è di fatto la variante «salta la colazione» e nessun campo lo dice — e l\'erogazione toglie da lì gli slot della finestra scelta. Chi salta la cena restava col SOLO PRANZO: Sonia (`s.sandri66@libero.it`), il 45% delle sue calorie, e ⚠️ non lo segnalava niente, perché la rete di `dayComboPools` ferma la giornata vuota e non quella monca. Ora `pickDietFor` chiede un catalogo che ABBIA i pasti che la finestra promette (`catalog/struttura-per-digiuno.ts`, modulo puro): si spostano sul 5 pasti solo «salto la cena» e «salto il pranzo», che sono le due rotte. ⚠️ NON «il digiuno usa sempre il 5 pasti»: nel catalogo digiuno pranzo+merenda+cena valgono il 100% della giornata e nel 5 pasti il 70%, quindi le cinque clienti che stanno bene avrebbero perso un terzo delle calorie in silenzio. ⚠️ La scelta conta i pasti, non elenca le finestre: una riga nuova in `FINESTRE_DIGIUNO` è già coperta. La finestra è stata aggiunta a tutti e cinque i chiamanti di `pickDietFor`. 14 test, nessuna migrazione. Foglio: `progetto/NOTA_Digiuno_E_Riempimento_Varianti.md`.',
    categoria: CODICE,
    ordine: 254,
    fatta: true, // 17/8: consegnata; da confermare con `npm run diag:digiuni` dopo il deploy
  },
  {
    chiave: 'digiuno-porzioni-non-si-scalano',
    titolo: 'Digiuno: i pasti sono giusti, le PORZIONI no — Sonia è al 65% del fabbisogno',
    dettaglio:
      'La metà che la correzione del 17/8 (voce 254) NON chiude, e va detta perché tocca le calorie di una persona: le ricette nascono dimensionate su una quota della giornata, e quando la finestra toglie dei pasti quello che resta NON si ingrandisce — `DayCombo` sceglie una ricetta per slot dentro il pool e un moltiplicatore di porzione non esiste da nessuna parte. Chi salta la cena passa dal 45% al 65% del fabbisogno: meglio, non giusto. ⚠️ Lo stesso buco esiste FUORI dal digiuno, in piccolo: quando Vera toglie i due spuntini (`pastiEsclusi`) la giornata perde il 20% e la nota in app dice che le kcal «sono ridistribuite» — cosa che il motore non fa. ✅ **Strada scelta da Simone il 17/8: la C**, la porzione si scala all\'erogazione (un catalogo solo, e risolve anche gli spuntini). Foglio: `progetto/DECISIONE_Porzioni_Scalate_Strada_C.md`, scritto il 17/8 sera. ⚠️ Restano TRE domande sue, tutte cliniche, e sono in testa al foglio: il **tetto** del moltiplicatore (uno solo o uno per tipo di pasto), **cosa si fa quando il tetto non basta** (la finestra «salta cena e colazione» chiede ×2,22: nessun tetto ci arriva), e **se scalano tutti allo stesso modo** o i pasti principali più degli spuntini (col fattore uniforme lo spuntino di Sonia diventa da 246 kcal). Nel foglio c\'è anche il pezzo da consegnare per primo, che non aspetta nessuna decisione: oggi una giornata sotto target esce identica a una giusta — `day-combo` torna `null` e `menu.service` eroga col template senza una riga di log, mentre per i PASTI mancanti il segnale è stato costruito (`fasting_meals_missing`).',
    categoria: SIMONE,
    ordine: 255,
  },
  {
    chiave: 'digiuno-finestra-mai-chiesta',
    titolo: 'Digiuno senza finestra: a Maria non è mai stato chiesto quali pasti salta',
    dettaglio:
      'Maria (`mariabonaccorso@hotmail.it`) ha `pathType: intermittent_fasting` e `fastingWindow` vuota. ⚠️ NON è un difetto del motore e non è un allarme: senza finestra non si salta nulla e riceve il 16:8 classico, che è il default sensato — «dovrebbe ricevere tutti e cinque i pasti» era una frase del mio primo script, non una promessa fatta a lei (falso positivo corretto il 17/8). Il difetto è che **la domanda non le è mai stata fatta**: la finestra decide quali pasti mangia e per lei l\'ha decisa un valore di scorta. Va chiesta — dal questionario per chi si iscrive, e alle clienti già in digiuno senza finestra da Gaia o dalla coach. Nel frattempo `struttura-per-digiuno.ts` NON la sposta di catalogo, di proposito: cambiarle la dieta sotto i piedi per un campo vuoto sarebbe rispondere a una domanda mancata con un\'altra decisione presa al posto suo.',
    categoria: CODICE,
    ordine: 256,
  },

  {
    chiave: 'piani-attivi-scelta-per-date',
    titolo: 'Due piani attivi: la scheda mostrava quello IN CODA come piano corrente',
    dettaglio:
      '⚠️ La causa vera del caso Lorena Polidoro, trovata il 17/8 e più precisa della prima ricostruzione: `pickMainSubscription` faceva `find(s => s.status === \'active\')` su una lista `createdAt desc`, quindi fra due righe attive vinceva **la più recente** — che era il piano in coda dal 25/08. La scheda scriveva «Inizio piano: 25/08» e la matita, che usa la stessa funzione, ha spostato quella riga: chi l\'ha aperta ha corretto una data sbagliata. Con lo stesso difetto, senza bisogno di `queued`: `menu.service` faceva `findFirst` **senza `orderBy`** (e da lì escono «piano concluso?» e fino a che giorno arrivano i menu: dipendeva dall\'ordine delle righe nella tabella), `pause.service` ordinava per `createdAt desc` (i giorni di pausa sommati al piano in coda: concessi e mai ricevuti), `coach.service` costruiva una `Map` che tiene l\'ultima riga. Ora la scelta è una funzione sola (`commerce/abbonamento-in-corso.ts`): chi eroga oggi, e fra due sovrapposti quello che finisce più tardi — ⚠️ non «cominciato prima», perché la cliente ha pagato fino alla fine del secondo. ⚠️ Le date sono obbligatorie nel tipo, e il compilatore ha trovato subito un cast in `clients.service` che le buttava via. 18 test, nessuna migrazione. Foglio: `progetto/NOTA_Chi_Sta_Erogando_Adesso.md`.',
    categoria: CODICE,
    ordine: 257,
    fatta: true, // 17/8: consegnata, test visti rossi prima
  },
  {
    chiave: 'queued-stato-abbonamento',
    titolo: '«In coda» diventa uno STATO: oggi è un `active` con una data futura',
    dettaglio:
      'La causa che resta dopo la voce 257. Un piano messo in fila si scrive `active` con inizio nel futuro, e da questa scelta discende tutto: il database non può vietare due attivi (due attivi sono legittimi), la scheda mostra due «Attivo» identici, e la matita non sa che sta disfacendo una coda. Migrazione **additiva** (un valore in più nell\'enum), `finalizeApproval` scrive `queued`, e un lavoro giornaliero dentro `daily` promuove a `active` i `queued` la cui data è arrivata. ⚠️ **Il censimento è già fatto, non rifarlo** (17/8): **47 letture** di `status: \'active\'` su `Subscription` — 27 «solo active», 15 «anche queued», 5 da decidere (`coach-tasks:201`, `coach:104`, `commerce:1408`, `commerce:1431`, `dashboard:148`), più 5 filtri fatti in memoria. Il pattern: ogni query che filtra **anche sulle date** è solo-active; ogni query che chiede «ha già comprato / ha convertito» va estesa a `queued`, e sono quelle già scritte `status: { in: [\'active\',\'pending\'] }`. ⚠️ Il vincolo in banca dati **non** va nella stessa consegna dello stato: prima lo stato vive e si vede che nessuno è finito nel posto sbagliato. Decisione di Simone (17/8): un piano in coda **conta** come «ha un piano» nelle schermate dello staff, perché è un contratto.',
    categoria: CODICE,
    ordine: 258,
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
    chiave: 'gusti-altre-porte-di-scrittura',
    titolo: 'Restano quattro porte che scrivono i gusti senza spezzare i tag (e due sono di Vera)',
    dettaglio:
      'Censimento fatto il 17/8 sera chiudendo la voce 263: le porte che scrivono `dislikedFoods` sono **otto**, e ora tre sono pulite (questionario, profilo in app, scheda staff) più lo script di bonifica. Le altre: **1)** `menu.service.substituteDisliked` con `scope: \'forever\'` — ha il cancello spezie sul termine ma non spezza, quindi «pepe, ceci» digitato in app supera il cancello e si salva intero; **2)** `sostituzione-chat.service.aggiungiAiNonGraditi` (Gaia) — rischio basso, il valore è un nome di ingrediente del catalogo; **3)** `vera-chat.service.scriviRestrizione` — la nutrizionista detta una restrizione per **una** cliente; **4)** `applica-proposta.applicaRestrizione` — la stessa cosa su una **coorte**, quindi ⚠️ un termine sporco si moltiplica su N profili. ⛔ Le due di Vera non le ho chiuse di mia iniziativa: lì la domanda non è tecnica ed è di Simone — **se la nutrizionista detta una spezia, cosa si fa?** Scartarla in silenzio è il difetto che paghiamo da quattro volte; scartarla dicendolo vuol dire scrivere la frase che Vera risponde (e Vera **ha** una voce, a differenza di un form); tenerla vuol dire accettare che il pool si svuoti — ma chi la detta è la professionista che firma le diete. ⚠️ Il lato **lettura** protegge già dai tag doppi (`expandExclusion` li spezza dal 17/8): quello che resta esposto sono le spezie, e il testo grezzo che finisce nel report PDF della cliente (`plan-report.service.ts:250`).',
    categoria: SIMONE,
    ordine: 264,
  },

];
