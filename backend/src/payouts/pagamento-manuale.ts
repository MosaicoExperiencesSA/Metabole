/**
 * PAGAMENTO REGISTRATO DAL BACKOFFICE (19/10/2026) — il giudizio, senza Prisma.
 *
 * Simone: «le ho pagate tutte, come faccio a registrare il pagamento» — e la risposta era «non
 * puoi». L'unica strada per segnare un pagamento era la richiesta di prelievo della persona (giorni
 * 1–7, solo il maturato dei mesi chiusi) confermata dall'admin. Chi paga per conto suo, o paga il
 * mese in corso, restava con un bonifico fatto e un portafoglio che diceva «da pagare».
 *
 * ⚠️ **Il tetto è il maturato TOTALE meno il già pagato, non il «prelevabile».** Il prelevabile
 * esclude il mese in corso perché la persona non deve poter chiedere soldi che possono ancora
 * cambiare (uno storno a fine mese). L'admin invece registra un bonifico GIÀ FATTO: rifiutarlo
 * perché «non è ancora prelevabile» non cancella il bonifico, rende solo falso il registro.
 * Il tetto resta per una ragione sola: un refuso (21725 invece di 217,25) si ferma qui.
 *
 * ⚠️ **Le richieste in attesa NON si sottraggono.** Se la persona ha chiesto 100 e l'admin quei 100
 * li ha pagati a mano, sottrarli bloccherebbe proprio la registrazione giusta. La richiesta rimasta
 * aperta non fa danni: la sua conferma ricontrolla il prelevabile e la rifiuta da sé.
 */

export interface SituazionePersona {
  /** Somma di TUTTE le righe di compenso a registro (mesi chiusi + mese in corso). */
  maturatoCents: number;
  /** Somma dei prelievi già pagati (status `paid`). */
  pagatoCents: number;
}

/** Quanto resta da dare a una persona. Mai negativo: un pagamento in eccesso non è un credito. */
export function residuoDaPagare(s: SituazionePersona): number {
  return Math.max(0, s.maturatoCents - s.pagatoCents);
}

const SOLO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Il primo motivo per cui il pagamento NON si può registrare, oppure `null`.
 *
 * `oggi` è il giorno di calendario dell'azienda (`giornoLocale(new Date())`), passato da fuori:
 * il confronto è fra due stringhe `YYYY-MM-DD`, quindi non c'è un fuso da sbagliare qui dentro.
 */
export function motivoRifiutoPagamento(input: {
  amountCents: number;
  pagatoIl: string;
  oggi: string;
  situazione: SituazionePersona;
}): string | null {
  const { amountCents, pagatoIl, oggi, situazione } = input;
  if (!Number.isInteger(amountCents) || amountCents <= 0) return 'Importo non valido.';
  if (!SOLO_DATA.test(pagatoIl) || Number.isNaN(Date.parse(`${pagatoIl}T00:00:00Z`))) return 'Data del pagamento non valida.';
  // Un pagamento con la data di domani è un refuso: il bonifico che si registra è già partito.
  if (pagatoIl > oggi) return 'La data del pagamento non può essere nel futuro.';
  const residuo = residuoDaPagare(situazione);
  if (amountCents > residuo) {
    return `Importo (${euro(amountCents)}) superiore a quanto resta da pagare (${euro(residuo)}): maturato ${euro(situazione.maturatoCents)}, già pagato ${euro(situazione.pagatoCents)}.`;
  }
  return null;
}

function euro(c: number): string {
  return `${(c / 100).toFixed(2).replace('.', ',')} €`;
}
