/**
 * I METODI DI COTTURA — l'elenco sta QUI, e in nessun altro posto.
 *
 * Richiesta di Simone dell'11/8: «"Piatto Freddo" fra i metodi di cottura». Aggiungerlo era una
 * riga; il motivo per cui è una voce di lavoro e non una riga è che l'elenco viveva in **quattro
 * posti diversi**, già divergenti fra loro:
 *
 * - `backoffice/src/pages/Ricette.tsx` — la tendina di chi scrive le ricette: 3 voci;
 * - `app/src/lib/meals.ts` — le etichette che legge la cliente: 3 voci;
 * - `backend/src/cycle/cycle.service.ts` — il ciclo che alterna due preparazioni: 5 voci;
 * - il prompt con cui l'AI genera le ricette: 3 voci, scritte a mano dentro la stringa.
 *
 * Quindi `padella` e `vapore` **esistevano già nei menu** e nella tendina non c'erano: chi apriva
 * una ricetta generata così vedeva un valore che non poteva reinserire. E aggiungere «piatto
 * freddo» in tre punti su quattro avrebbe fatto comparire `piatto_freddo` grezzo da qualche parte —
 * che è esattamente come si sono formate le quattro liste diverse.
 *
 * ## Come resta uno solo
 *
 * I tre progetti non condividono codice (build separate), quindi «un modulo solo» si ottiene così:
 * questo file **decide**, il backoffice lo **chiede** a `/catalog/taxonomy` invece di riscriverlo, e
 * l'app — che non deve scegliere, solo mostrare — tiene le etichette con un **ripiego leggibile**
 * per i codici che non conosce. Un metodo aggiunto qui compare nella tendina senza toccare il
 * backoffice, e nell'app si legge decente anche prima del suo aggiornamento.
 */
export interface MetodoCottura {
  code: string;
  label: string;
}

export const METODI_COTTURA: MetodoCottura[] = [
  { code: 'veloce', label: 'Veloce' },
  { code: 'forno', label: 'Al forno' },
  { code: 'padella', label: 'In padella' },
  { code: 'vapore', label: 'Al vapore' },
  { code: 'meal_prep', label: 'Meal prep' },
  // Richiesta di Simone dell'11/8. Non è «crudo»: è il piatto che si mangia freddo — insalate di
  // cereali, caprese, avanzi del giorno prima — ed è la preparazione che serve d'estate e a chi
  // pranza fuori.
  { code: 'piatto_freddo', label: 'Piatto freddo' },
];

const PER_CODICE = new Map(METODI_COTTURA.map((m) => [m.code, m.label]));

/**
 * L'etichetta da mostrare. Un codice sconosciuto non torna mai grezzo: `piatto_freddo` diventa
 * «Piatto freddo» anche se questo elenco non lo conoscesse — è il ripiego che rende innocuo il
 * giorno in cui qualcuno aggiunge un metodo e si dimentica di scriverlo qui.
 */
export function etichettaMetodo(code: string | null | undefined): string {
  if (!code) return '';
  const nota = PER_CODICE.get(code);
  if (nota) return nota;
  const parole = code.replace(/_/g, ' ').trim();
  return parole.charAt(0).toUpperCase() + parole.slice(1);
}

/** I codici, per il prompt dell'AI e per le validazioni. */
export const CODICI_METODI = METODI_COTTURA.map((m) => m.code);
