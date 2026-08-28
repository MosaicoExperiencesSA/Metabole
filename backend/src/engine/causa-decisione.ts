/**
 * LE CAUSE del motore, in un posto solo.
 *
 * Una decisione che finisce nella coda «Da validare» ci finisce **per una ragione**, e quella
 * ragione decide tre cose diverse: la frase che il nutrizionista legge, quali azioni ha davvero
 * senso offrirgli, e — da qui in avanti — se una riga nuova è la stessa cosa di una già aperta.
 *
 * Fino al 13/8 la causa esisteva solo come prefisso dentro il testo della segnalazione
 * (`[calo_rapido_energia] Calo troppo rapido…`) e la si interrogava con un `contains`: un
 * confronto che si rompe riscrivendo la frase, cioè la cosa che si fa più spesso.
 *
 * Modulo **puro**: nessuna dipendenza da Prisma o da Nest, così le regole si leggono e si
 * verificano senza montare mezza applicazione.
 */

/** Le cause che il motore sa produrre. Il valore è quello che finisce a database. */
export const CAUSE = {
  /** Percorso supervisionato (screening sanitario): il motore non decide da solo. */
  SCREENING: 'screening',
  /** Calo troppo rapido con energia non alta. */
  CALO_RAPIDO_ENERGIA: 'calo_rapido_energia',
  /** Energia bassa cronica negli ultimi check-in. */
  ENERGIA_BASSA_CRONICA: 'energia_bassa_cronica',
  /**
   * Una regola approvata ha chiesto la revisione (`action.flagForReview`), senza essere un
   * guardrail di sicurezza. Chiave unica e non `regola:<id>`: due regole diverse che chiedono
   * di guardare la stessa cliente nello stesso periodo sono, per chi legge la coda, la stessa
   * riga da guardare — e l'id nella chiave farebbe ricomparire una riga a ogni regola nuova.
   */
  REGOLA: 'regola',
} as const;

export type CausaDecisione = (typeof CAUSE)[keyof typeof CAUSE];

/** Etichetta breve per le schermate. Il testo lungo resta `flagReason`, che è per-cliente. */
export const ETICHETTA_CAUSA: Record<CausaDecisione, string> = {
  [CAUSE.SCREENING]: 'Percorso supervisionato',
  [CAUSE.CALO_RAPIDO_ENERGIA]: 'Calo troppo rapido',
  [CAUSE.ENERGIA_BASSA_CRONICA]: 'Energia bassa cronica',
  [CAUSE.REGOLA]: 'Regola del motore',
};

/** Vero se la stringa è una causa conosciuta (le righe scritte prima dell'11/8 non ne hanno). */
export function isCausa(v: string | null | undefined): v is CausaDecisione {
  return !!v && (Object.values(CAUSE) as string[]).includes(v);
}

// ---------------------------------------------------------------------------
// LE AZIONI AMMESSE PER OGNI CAUSA
// ---------------------------------------------------------------------------

/**
 * «Correggi» non apre un modulo generico: apre **le azioni che hanno senso per QUELLA causa**
 * (decisione di Simone, §15.2 punto 2).
 *
 * Un modulo generico costringerebbe il nutrizionista a decidere due volte — prima cosa fare, poi
 * come dirlo — e finirebbe per contenere una copia dei cambi dieta, che è il modo in cui nascono i
 * buchi nei permessi: due strade per la stessa modifica, con controlli diversi, e la seconda che
 * nessuno ricorda di aggiornare.
 *
 * Per questo `apri_scheda` **non è un'azione del motore**: è un rimando a dove i cambi dieta vivono
 * già, coi loro permessi (`change_diet_type`, «Rigenera menu»). Lo stesso vale per `scrivi_in_chat`.
 * ⚠️ Quelle che il backend esegue davvero stanno in `AZIONI_ESEGUIBILI` — **tre** dal 28/8 — e chi
 * ha bisogno di saperlo legge quell'elenco invece di ricopiarne i nomi: era già una copia, e con la
 * terza sarebbe diventata una copia sbagliata.
 */
export const AZIONI = {
  /** Azzera il punto di partenza del calcolo del calo: la cliente prosegue, l'allarme si ri-arma dopo. */
  AUTORIZZA_PROSEGUIRE: 'autorizza_proseguire',
  /** Ferma i giorni NUOVI. I giorni già ricevuti, incluso oggi, restano suoi. */
  BLOCCA_PIANO: 'blocca_piano',
  /**
   * ⛔ **ALZA LE CALORIE, per davvero** (28/8, decisione di Simone del 27/8).
   *
   * È l'azione che chiude il buco vecchio di questa coda: il motore **propone** di alzare le
   * calorie (`menu: 'increase_calories'`, `engine.service.ts`), quella proposta non la leggeva
   * nessuno, e i due pulsanti registravano soltanto «l'ho letta». Da oggi il nutrizionista scrive
   * **di quanto**, e il numero arriva nel piatto.
   *
   * ⚠️ **Non reimplementa niente**: chiama `impostaKcal`, la stessa porta della card in scheda e di
   * Vera, con il suo controllo di perimetro, la sua soglia di sicurezza, il suo storico
   * `kcal_override`, il suo audit, l'avviso ai capi e la rigenerazione dei giorni futuri. La regola
   * di casa di questo file — *«non si reimplementano qui: una seconda strada per la stessa modifica,
   * con controlli diversi, è il modo in cui nascono i buchi»* — vale anche per le calorie: per
   * questo `apri_scheda` resta, e questa azione **non** è una scorciatoia che scrive per conto suo.
   *
   * ⚠️ Perché allora esiste, se c'è già `apri_scheda`? Perché la decisione si prende **qui**, davanti
   * alla riga che la motiva, e mandare a un'altra pagina significa perdere per strada il motivo per
   * cui si stava alzando. La differenza con «apri la scheda» non è cosa scrive, è **dove si decide**.
   */
  ALZA_CALORIE: 'alza_calorie',
  /** Rimando alla chat con la cliente. Nessuna scrittura sul piano. */
  SCRIVI_IN_CHAT: 'scrivi_in_chat',
  /** Rimando alla scheda cliente, dove i cambi dieta vivono già coi loro permessi. */
  APRI_SCHEDA: 'apri_scheda',
} as const;

export type AzioneDecisione = (typeof AZIONI)[keyof typeof AZIONI];

/** Le azioni che il **backend esegue**: le altre due sono navigazione, e non passano di qui. */
export const AZIONI_ESEGUIBILI: AzioneDecisione[] = [
  AZIONI.AUTORIZZA_PROSEGUIRE,
  AZIONI.BLOCCA_PIANO,
  AZIONI.ALZA_CALORIE,
];

/**
 * ⚠️ Le azioni che chiedono **un numero** prima di partire: il frontend deve saperlo senza
 * conoscerne l'elenco a memoria, altrimenti la prossima azione con un parametro finisce eseguita
 * a vuoto perché nessuno si è ricordato di aggiungere il campo.
 */
export const AZIONI_CON_NUMERO: AzioneDecisione[] = [AZIONI.ALZA_CALORIE];

/**
 * La tabella decisa con Nocanty. L'ordine conta: è quello in cui le azioni compaiono, dalla più
 * probabile alla più drastica.
 *
 * Perché `autorizza_proseguire` sta **solo** sul calo rapido: è l'unica causa in cui il numero che
 * ha fatto scattare l'allarme è anche quello che va azzerato. Sull'energia bassa non c'è nessun
 * punto di partenza da spostare — il segnale arriva dai check-in, non da una serie storica — e
 * offrirla lì vorrebbe dire far credere di aver messo a tacere qualcosa che continuerà a suonare.
 */
export const AZIONI_PER_CAUSA: Record<CausaDecisione, AzioneDecisione[]> = {
  [CAUSE.CALO_RAPIDO_ENERGIA]: [
    AZIONI.AUTORIZZA_PROSEGUIRE,
    // ⚠️ **Seconda e non prima**, di proposito: la frase del motore per questa causa dice «alzare le
    // calorie e rallentare», quindi metterla in cima sarebbe difendibile — ma «autorizza a
    // proseguire» è il gesto che il nutrizionista fa più spesso, e spostargli il primo pulsante
    // sotto il naso è il modo in cui si preme quello sbagliato. L'ordine di questa tabella si cambia
    // con Nocanty, non di iniziativa.
    AZIONI.ALZA_CALORIE,
    AZIONI.SCRIVI_IN_CHAT,
    AZIONI.APRI_SCHEDA,
    AZIONI.BLOCCA_PIANO,
  ],
  // ⚠️ Qui invece **prima**: l'energia bassa cronica è la causa in cui l'ipotesi «sta mangiando
  // troppo poco» è la prima da guardare, e non c'è nessun «autorizza a proseguire» da premere.
  [CAUSE.ENERGIA_BASSA_CRONICA]: [
    AZIONI.ALZA_CALORIE,
    AZIONI.SCRIVI_IN_CHAT,
    AZIONI.APRI_SCHEDA,
    AZIONI.BLOCCA_PIANO,
  ],
  [CAUSE.SCREENING]: [AZIONI.APRI_SCHEDA, AZIONI.SCRIVI_IN_CHAT],
  // Una regola scritta dal nutrizionista può dire qualunque cosa: si offrono i due rimandi, che
  // non modificano niente. Proporre «blocca il piano» per una regola di cui non sappiamo il
  // contenuto sarebbe offrire la leva più drastica al buio.
  [CAUSE.REGOLA]: [AZIONI.APRI_SCHEDA, AZIONI.SCRIVI_IN_CHAT],
};

/** Etichetta e spiegazione di ogni azione, come le legge il nutrizionista nella finestra. */
export const DESCRIZIONE_AZIONE: Record<AzioneDecisione, { etichetta: string; cosaFa: string }> = {
  [AZIONI.AUTORIZZA_PROSEGUIRE]: {
    etichetta: 'Autorizza a proseguire',
    cosaFa:
      'Il calcolo del ritmo di calo riparta da adesso: contano solo le pesate successive. L’allarme può tornare non prima di qualche giorno, e solo con pesate nuove. I progressi della cliente — grafico, chili persi, proiezione — non cambiano.',
  },
  [AZIONI.BLOCCA_PIANO]: {
    etichetta: 'Blocca il piano',
    cosaFa:
      'Si fermano i giorni NUOVI. Quelli già ricevuti, incluso oggi, restano suoi. La cliente vede scritto che il piano è in pausa in attesa del nutrizionista — non una scusa.',
  },
  [AZIONI.ALZA_CALORIE]: {
    etichetta: 'Alza le calorie',
    cosaFa:
      'Scrive una correzione percentuale sul totale, come dalla scheda cliente: i giorni futuri già consegnati si rigenerano sulle calorie nuove. Se indichi i giorni vale per quelli e poi il piano torna da solo al ritmo normale; se li lasci vuoti vale finché non la togli. Resta scritto nello storico delle calorie e nelle note della scheda, con chi l’ha decisa e la data.',
  },
  [AZIONI.SCRIVI_IN_CHAT]: {
    etichetta: 'Scrivi in chat',
    cosaFa: 'Apre la conversazione con la cliente. Non cambia niente sul piano.',
  },
  [AZIONI.APRI_SCHEDA]: {
    etichetta: 'Apri la scheda',
    cosaFa:
      'Porta alla scheda cliente, dove vivono i cambi dieta con i loro permessi. Non si reimplementano qui: una seconda strada per modificare la dieta, con controlli diversi, è il modo in cui nascono i buchi.',
  },
};

/** Le azioni per una causa; elenco vuoto se la causa non è conosciuta (righe storiche). */
export function azioniPerCausa(causa: string | null | undefined): AzioneDecisione[] {
  return isCausa(causa) ? AZIONI_PER_CAUSA[causa] : [];
}

/** Vero se quell'azione è ammessa per quella causa. È il controllo che fa il backend. */
export function azioneAmmessa(causa: string | null | undefined, azione: string): boolean {
  return (azioniPerCausa(causa) as string[]).includes(azione);
}
