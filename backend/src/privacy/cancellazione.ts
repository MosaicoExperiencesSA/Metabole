/**
 * REVOCA DEL CONSENSO E CANCELLAZIONE A 30 GIORNI — logica pura e testi.
 *
 * Richiesta di Simone dell'8/8: nel profilo dell'app una card «Consenso» con la data in cui è stato
 * dato, un pulsante «Revoca consenso», un popup che avverte, e la parola **ELIMINA** da scrivere a
 * mano. Da lì un termine di 30 giorni, due mail con il pulsante «Sospendi l'eliminazione», e al 31°
 * giorno la cancellazione.
 *
 * ## Le tre decisioni prese il 10/8, e perché stanno scritte qui
 *
 * 1. **Solo la cliente può sospendere.** Coach e manager ricevono le mail per sapere cosa sta
 *    succedendo — una persona che se ne va è una cosa che si vuole sapere — ma il pulsante funziona
 *    unicamente dal link mandato a lei. Il link è la sua firma: nessuno annulla al posto suo una
 *    volontà che riguarda i suoi dati sanitari. È anche la versione che si difende davanti a un
 *    reclamo, che è il momento in cui questa scelta conta davvero.
 * 2. **La revoca disdice il rinnovo automatico.** Sono due volontà diverse, ma lasciare che Stripe
 *    incassi un rinnovo per un percorso che al 31° giorno non esisterà più significa un addebito da
 *    rimborsare e una telefonata sgradevole. Il piano resta valido fino alla scadenza già pagata: si
 *    ferma il rinnovo, non il servizio.
 * 3. **Le fatture restano, e si dice.** Obbligo di legge (dieci anni): la cancellazione riguarda i
 *    dati sanitari e il percorso, non la contabilità. La frase compare nel popup, nelle due mail e in
 *    una pagina che spiega cosa si tiene e per quanto — perché «cancelliamo tutto» detto e poi non
 *    fatto è peggio del distinguo.
 *
 * ## Perché tutto questo sta in un file puro
 *
 * Perché è l'unica parte che si può verificare senza cancellare niente. Il conto dei giorni, la
 * parola di conferma, e soprattutto i **testi**: qui l'errore di una parola non è di stile — è una
 * persona che crede di aver fermato una cancellazione e non l'ha fermata.
 */

/** I giorni di attesa fra la revoca e la cancellazione. */
export const GIORNI_ATTESA = 30;

/** Quello che la cliente deve scrivere a mano perché il termine parta. */
export const PAROLA_CONFERMA = 'ELIMINA';

/**
 * La conferma scritta è valida?
 *
 * Larghi su spazi e maiuscole — chi scrive «elimina» ha capito benissimo, e rifiutarla per una
 * minuscola è una crudeltà burocratica in un momento delicato. Stretti su tutto il resto: deve
 * essere **quella** parola e nient'altro, perché è l'unico attrito prima di un'operazione
 * irreversibile. «Elimina il mio account» non passa: è una frase, non una conferma.
 */
export function confermaValida(testo: string | null | undefined): boolean {
  return (testo ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') === PAROLA_CONFERMA;
}

/**
 * Il giorno della cancellazione: `GIORNI_ATTESA` giorni dopo la richiesta, a mezzanotte.
 *
 * Si scrive una volta e non si ricalcola mai. Se domani cambiassimo il numero di giorni, chi ha già
 * revocato non deve vedersi spostare il termine: quello che le abbiamo scritto nella mail è un
 * impegno preso, e cambiarlo sotto è esattamente ciò che rende un'informativa carta straccia.
 */
export function dataCancellazione(richiestaIl: Date, giorni = GIORNI_ATTESA): Date {
  const giorno = new Date(
    Date.UTC(richiestaIl.getUTCFullYear(), richiestaIl.getUTCMonth(), richiestaIl.getUTCDate()),
  );
  return new Date(giorno.getTime() + giorni * 86_400_000);
}

/** Giorni che restano, mai negativi. `0` = si cancella oggi. */
export function giorniRimanenti(scadenza: Date, adesso: Date): number {
  const oggi = Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth(), adesso.getUTCDate());
  const fine = Date.UTC(scadenza.getUTCFullYear(), scadenza.getUTCMonth(), scadenza.getUTCDate());
  return Math.max(0, Math.round((fine - oggi) / 86_400_000));
}

/** Vero se è il giorno dell'ultimo avviso: manca un giorno. */
export const eIlGiornoPrima = (scadenza: Date, adesso: Date): boolean =>
  giorniRimanenti(scadenza, adesso) === 1;

/** Vero se il termine è scaduto e la cancellazione va eseguita. */
export const eScaduta = (scadenza: Date, adesso: Date): boolean => adesso.getTime() >= scadenza.getTime();

const data = (d: Date): string =>
  d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

// ---------- Cosa si cancella e cosa resta ----------

/**
 * L'elenco che la cliente legge nella pagina di trasparenza, e che deve restare **vero**: se un
 * giorno qui si scrivesse una cosa che il codice non fa, questa lista diventerebbe una bugia
 * documentata. Va tenuta allineata a `PrivacyService.cancella`.
 */
export const COSA_SI_CANCELLA: string[] = [
  'il tuo profilo e le risposte del questionario',
  'peso, misure, foto e documenti che hai caricato',
  'i menu ricevuti, le valutazioni dei piatti e le liste della spesa',
  'check-in, acqua, passi e obiettivi',
  'le conversazioni con Gaia, la coach e la nutrizionista, e le note cliniche',
  'appuntamenti, visite e promemoria',
  'le notifiche e gli accessi salvati sui tuoi dispositivi',
];

export const COSA_RESTA: { cosa: string; perche: string }[] = [
  {
    cosa: 'le fatture e le ricevute dei pagamenti',
    perche: 'obbligo di legge: la documentazione fiscale va conservata dieci anni. Non contiene i tuoi dati sanitari.',
  },
  {
    cosa: 'la registrazione di questa richiesta',
    perche: 'è la prova che la cancellazione è stata fatta, e serve proprio a te se un giorno dovessi contestarla.',
  },
];

// ---------- I testi ----------

/** Il popup, prima della parola da scrivere. È l'ultimo punto in cui si può cambiare idea. */
export function testoPopup(): { titolo: string; corpo: string; fatture: string; richiesta: string } {
  return {
    titolo: 'Revoca del consenso',
    corpo:
      `Sei consapevole che revocando il consenso i tuoi dati verranno cancellati entro ${GIORNI_ATTESA} giorni? ` +
      'Il percorso si interrompe: menu, misure, conversazioni e documenti non saranno più recuperabili, ' +
      'nemmeno da noi.',
    // Decisione del 10/8: il distinguo si dice QUI, non solo nelle mail. Per qualche minuto avrebbe
    // creduto che si cancellasse anche la contabilità, e non è vero.
    fatture:
      'Restano solo le fatture dei pagamenti, che per legge dobbiamo conservare dieci anni: non contengono dati sanitari. ' +
      'Il rinnovo automatico dell\'abbonamento viene disdetto, e il piano che hai già pagato resta valido fino alla scadenza.',
    richiesta: `Per confermare scrivi ${PAROLA_CONFERMA} qui sotto.`,
  };
}

/** La prima mail, subito dopo la revoca. Alla cliente; coach e manager in copia conoscenza. */
export function mailImmediata(
  nome: string | null,
  scadenza: Date,
  linkSospendi: string,
  linkPrivacy: string,
): { oggetto: string; html: string } {
  const chi = nome ? ` ${nome}` : '';
  return {
    oggetto: `La tua richiesta di cancellazione è stata registrata (${data(scadenza)})`,
    html:
      `<p>Ciao${chi},</p>` +
      `<p>abbiamo registrato la tua revoca del consenso. I tuoi dati verranno cancellati il <b>${data(scadenza)}</b>: ` +
      `da quel giorno menu, misure, conversazioni e documenti non saranno più recuperabili, nemmeno da noi.</p>` +
      `<p>Abbiamo anche disdetto il rinnovo automatico dell'abbonamento. Il piano che hai già pagato resta valido ` +
      `fino alla sua scadenza: non perdi giorni che hai pagato.</p>` +
      `<p><b>Se hai cambiato idea</b>, o se hai premuto per sbaglio, puoi fermare tutto da qui:</p>` +
      bottone(linkSospendi, 'Sospendi l\'eliminazione') +
      `<p style="color:#5b6360;font-size:13px">Restano solo le fatture dei pagamenti, che per legge dobbiamo ` +
      `conservare dieci anni: non contengono dati sanitari. ` +
      `<a href="${linkPrivacy}">Qui c'è l'elenco completo</a> di cosa cancelliamo e cosa siamo obbligati a tenere.</p>`,
  };
}

/** L'ultima mail: manca un giorno. Stesso pulsante, e si dice che è l'ultima. */
export function mailUltimoGiorno(
  nome: string | null,
  scadenza: Date,
  linkSospendi: string,
  linkPrivacy: string,
): { oggetto: string; html: string } {
  const chi = nome ? ` ${nome}` : '';
  return {
    oggetto: `Domani cancelliamo i tuoi dati — ultimo avviso`,
    html:
      `<p>Ciao${chi},</p>` +
      `<p>domani, <b>${data(scadenza)}</b>, cancelliamo i tuoi dati come ci hai chiesto. È l'ultimo messaggio ` +
      `che ti mandiamo su questo: dopo non ci sarà più niente da recuperare.</p>` +
      `<p>Se vuoi fermarti, oggi puoi ancora:</p>` +
      bottone(linkSospendi, 'Sospendi l\'eliminazione') +
      `<p style="color:#5b6360;font-size:13px">Restano solo le fatture dei pagamenti (obbligo di legge, dieci anni). ` +
      `<a href="${linkPrivacy}">Cosa cancelliamo e cosa resta</a>.</p>`,
  };
}

/** La copia allo staff. Non ha il pulsante: solo la cliente può fermare il termine. */
export function mailStaff(
  nomeCliente: string,
  emailCliente: string,
  scadenza: Date,
  ultimoAvviso: boolean,
): { oggetto: string; html: string } {
  return {
    oggetto: ultimoAvviso
      ? `[Privacy] Domani si cancellano i dati di ${nomeCliente}`
      : `[Privacy] ${nomeCliente} ha revocato il consenso`,
    html:
      `<p><b>${nomeCliente}</b> (${emailCliente}) ha revocato il consenso al trattamento dei dati sanitari.</p>` +
      `<p>La cancellazione è prevista per il <b>${data(scadenza)}</b>.</p>` +
      `<p>Il pulsante per fermarla è <b>solo nella mail che è stata mandata a lei</b>: è una sua decisione e nessuno ` +
      `la annulla al suo posto. Se ti dice che ha premuto per sbaglio, spiegale che il link nella sua mail ferma ` +
      `tutto — quel messaggio ha per oggetto «La tua richiesta di cancellazione».</p>` +
      `<p style="color:#5b6360;font-size:13px">Questa è una comunicazione di servizio: la ricevi perché la segui. ` +
      `Le fatture non vengono cancellate (obbligo di legge).</p>`,
  };
}

/** Quando la cliente ferma il termine: si dice cosa è tornato come prima e cosa no. */
export function mailSospesa(nome: string | null): { oggetto: string; html: string } {
  const chi = nome ? ` ${nome}` : '';
  return {
    oggetto: 'Cancellazione fermata: i tuoi dati restano',
    html:
      `<p>Ciao${chi},</p>` +
      `<p>è tutto fermo: i tuoi dati non verranno cancellati e il consenso è di nuovo attivo. Il percorso riprende ` +
      `da dov'era, senza che tu debba rifare niente.</p>` +
      // Onestà su ciò che NON torna da sé. È la contropartita della decisione di disdire il rinnovo:
      // rimetterlo in piedi da soli vorrebbe dire riabbonare qualcuno senza chiederglielo.
      `<p>Una cosa non è tornata da sola: il <b>rinnovo automatico</b>, che avevamo disdetto quando hai revocato. ` +
      `Il piano che hai pagato resta valido fino alla scadenza; quando vuoi rinnovarlo dillo alla tua coach o ` +
      `rifallo dall'app — non ti addebitiamo niente senza che tu lo chieda.</p>`,
  };
}

/** Fatto. Una mail sola, e all'indirizzo che tra un attimo non sarà più nostro. */
export function mailFatta(nome: string | null): { oggetto: string; html: string } {
  const chi = nome ? ` ${nome}` : '';
  return {
    oggetto: 'I tuoi dati sono stati cancellati',
    html:
      `<p>Ciao${chi},</p>` +
      `<p>abbiamo cancellato i tuoi dati come ci hai chiesto: profilo, misure, menu, conversazioni e documenti non ` +
      `esistono più nei nostri sistemi.</p>` +
      `<p>Restano le fatture dei pagamenti, che per legge dobbiamo conservare dieci anni, e la registrazione di questa ` +
      `richiesta — che è la prova che l'abbiamo fatto.</p>` +
      `<p>Grazie del tempo che hai passato con noi. Se un giorno vuoi ricominciare, si riparte da zero: ` +
      `dovrai rifare la registrazione, perché di te non abbiamo tenuto niente. 💚</p>`,
  };
}

const bottone = (href: string, testo: string): string =>
  `<p style="margin:18px 0"><a href="${href}" style="display:inline-block;padding:12px 20px;border-radius:10px;` +
  `background:#12A386;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px">${testo}</a></p>`;
