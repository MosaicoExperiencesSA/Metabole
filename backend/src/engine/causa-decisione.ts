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

/** Vero se la stringa è una causa conosciuta (le righe scritte prima del 13/8 non ne hanno). */
export function isCausa(v: string | null | undefined): v is CausaDecisione {
  return !!v && (Object.values(CAUSE) as string[]).includes(v);
}
