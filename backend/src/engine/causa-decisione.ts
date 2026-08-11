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
 * Le due che il backend esegue davvero sono `autorizza_proseguire` e `blocca_piano`.
 */
export const AZIONI = {
  /** Azzera il punto di partenza del calcolo del calo: la cliente prosegue, l'allarme si ri-arma dopo. */
  AUTORIZZA_PROSEGUIRE: 'autorizza_proseguire',
  /** Ferma i giorni NUOVI. I giorni già ricevuti, incluso oggi, restano suoi. */
  BLOCCA_PIANO: 'blocca_piano',
  /** Rimando alla chat con la cliente. Nessuna scrittura sul piano. */
  SCRIVI_IN_CHAT: 'scrivi_in_chat',
  /** Rimando alla scheda cliente, dove i cambi dieta vivono già coi loro permessi. */
  APRI_SCHEDA: 'apri_scheda',
} as const;

export type AzioneDecisione = (typeof AZIONI)[keyof typeof AZIONI];

/** Le azioni che il **backend esegue**: le altre due sono navigazione, e non passano di qui. */
export const AZIONI_ESEGUIBILI: AzioneDecisione[] = [AZIONI.AUTORIZZA_PROSEGUIRE, AZIONI.BLOCCA_PIANO];

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
    AZIONI.SCRIVI_IN_CHAT,
    AZIONI.APRI_SCHEDA,
    AZIONI.BLOCCA_PIANO,
  ],
  [CAUSE.ENERGIA_BASSA_CRONICA]: [AZIONI.SCRIVI_IN_CHAT, AZIONI.APRI_SCHEDA, AZIONI.BLOCCA_PIANO],
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
