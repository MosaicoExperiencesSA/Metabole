/**
 * IL GENERATORE STA LAVORANDO? — letto dai battiti, non dedotto dal silenzio.
 *
 * Nasce da due domande di Simone del 18/8: «come facciamo a sapere se sta lavorando?» e, dopo la
 * prima risposta, «non ho capito da dove vedo se le ricette vengono create». La seconda è la più
 * importante: `npm run diag:catalogo` risponde, ma una shell non è **vedere**. Questo modulo serve
 * al riquadro che sta in cima alla pagina Ricette.
 *
 * ⚠️ La regola che lo governa: **il silenzio non è una risposta**. Prima del battito
 * (`cron.genera_catalogo`, 18/8) i tre motivi per cui un giro finisce a mani vuote — catalogo
 * completo, AI fuori uso, cron spento su Render — avevano tutti lo stesso aspetto. Qui restano
 * separati fino in fondo, e «non lo so» ha un valore suo.
 */

/** Un battito, ridotto a quello che serve. `metadata` è quello che l'endpoint del cron ha scritto. */
export interface BattitoGeneratore {
  createdAt: Date;
  metadata?: unknown;
}

export type VerdettoGeneratore =
  /** ⚠️ Nessun battito: il cron non è mai partito (o gira una versione vecchia del codice). */
  | 'mai_partito'
  /** L'ultimo giro ha generato qualcosa. */
  | 'lavora'
  /** L'ultimo giro non aveva niente da fare: il catalogo è a posto. */
  | 'niente_da_fare'
  /** L'ultimo giro è andato in errore (AI fuori uso, credito finito…). */
  | 'errore'
  /** ⚠️ Gira, ma l'ultimo giro è troppo vecchio: qualche notte è saltata. */
  | 'fermo';

export interface StatoGeneratore {
  verdetto: VerdettoGeneratore;
  /** Quando è stato l'ultimo giro. `null` se non ce n'è mai stato uno. */
  ultimoGiro: Date | null;
  /** Ore dall'ultimo giro, arrotondate. `null` come sopra. */
  oreFa: number | null;
  /** La riga da mostrare: cos'è successo, in italiano. */
  messaggio: string;
  /** Quanti giri e quanti errori nella finestra guardata. */
  giri: number;
  errori: number;
}

/** Oltre queste ore dall'ultimo giro, un cron giornaliero ne ha saltato almeno uno. */
export const ORE_PRIMA_DI_DIRLO_FERMO = 36;

const meta = (b: BattitoGeneratore): Record<string, unknown> =>
  (b.metadata && typeof b.metadata === 'object' ? b.metadata : {}) as Record<string, unknown>;

/**
 * Il verdetto sul generatore, dai battiti.
 *
 * ⚠️ `battiti` va passato **dal più recente**. E se è vuoto la risposta non è «tutto a posto»: è
 * `mai_partito`, che è una cosa da andare a guardare — su Render, non nel codice.
 */
export function statoDaiBattiti(
  battiti: readonly BattitoGeneratore[],
  adesso: Date = new Date(),
  oreMax: number = ORE_PRIMA_DI_DIRLO_FERMO,
): StatoGeneratore {
  const errori = battiti.filter((b) => meta(b).ok === false).length;
  if (!battiti.length) {
    return {
      verdetto: 'mai_partito',
      ultimoGiro: null,
      oreFa: null,
      messaggio:
        'Il generatore non ha mai lasciato traccia: o su Render il cron non esiste (o è spento), ' +
        'oppure è in produzione una versione precedente al 18/8. ⚠️ Non vuol dire che il catalogo sia a posto.',
      giri: 0,
      errori: 0,
    };
  }

  const ultimo = battiti[0];
  const oreFa = Math.round((adesso.getTime() - ultimo.createdAt.getTime()) / 3_600_000);
  const m = meta(ultimo);
  const base = { ultimoGiro: ultimo.createdAt, oreFa, giri: battiti.length, errori };

  if (oreFa > oreMax) {
    return {
      ...base,
      verdetto: 'fermo',
      // ⚠️ Si dice il numero, non «da un po'»: chi legge deve poter decidere se è un caso o un guasto.
      messaggio: `L'ultimo giro è di ${oreFa} ore fa: se il cron è giornaliero ne ha saltato almeno uno.`,
    };
  }
  if (m.ok === false) {
    return {
      ...base,
      verdetto: 'errore',
      messaggio: `L'ultimo giro è fallito: ${String(m.errore ?? 'senza messaggio')}.`,
    };
  }
  if (m.fatto === true) {
    return {
      ...base,
      verdetto: 'lavora',
      messaggio: `Ultimo giro: generata «${String(m.variante ?? '?')}», settimana ${String(m.settimana ?? '?')}.`,
    };
  }
  return {
    ...base,
    verdetto: 'niente_da_fare',
    messaggio: `Ultimo giro: niente da fare — ${String(m.motivo ?? 'senza motivo')}.`,
  };
}
