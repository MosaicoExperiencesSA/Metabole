/**
 * IL PREZZO SI LEGGE DAL NEGOZIO, NON SI SCRIVE NEL CODICE.
 *
 * Richiesta di Simone (11/8): «dobbiamo prendere il prezzo da quello impostato nel negozio, che se lo
 * cambiamo non impazziamo».
 *
 * ## Il difetto da cui nasce
 *
 * La notifica di fine monitoraggio diceva «tenere il peso col mantenimento a **€29/mese**». Il
 * Mantenimento costa **€49**: il numero era scritto a mano in `monitoring.service.ts` quando il piano
 * costava 29, e quando il prezzo è cambiato in Negozio nessuno è andato a cercare le frasi che lo
 * ripetevano. Risultato: un prezzo sbagliato mandato dalle nostre notifiche a una cliente vera — e
 * l'unico modo di accorgersene era che qualcuno leggesse quella riga di codice per caso.
 *
 * Un prezzo scritto due volte è un prezzo che prima o poi diverge. Qui si legge dalla riga `Plan`, che
 * è la stessa che la cliente vede nel Negozio e la stessa su cui pagherà: se cambia là, cambia in ogni
 * frase, senza toccare niente.
 *
 * ## Perché torna `null` invece di un valore di riserva
 *
 * La tentazione è `?? '€49'`, cioè un numero di scorta nel codice. Ma un valore di riserva è
 * esattamente il difetto di prima con un'aria più rispettabile: il giorno che il piano non si trova —
 * disattivato, rinominato, non ancora creato in produzione — la cliente riceverebbe di nuovo un prezzo
 * inventato da noi, e di nuovo nessuno se ne accorgerebbe.
 *
 * Quindi qui si torna `null` e **chi scrive la frase la scrive senza il numero**: «tenere il peso col
 * mantenimento» è una frase vera e completa. Meglio una parola in meno che una cifra sbagliata, perché
 * la cifra sbagliata è una promessa che poi qualcuno deve spiegare.
 */

// Si prende il `PrismaService` vero: nel sandbox il client è uno stub e un'interfaccia ristretta non
// gli combacia (alzerebbe la soglia degli errori di compilazione). I test passano un finto con un cast.
import type { PrismaService } from '../prisma/prisma.service';

export interface PrezzoPiano {
  /** Centesimi, come stanno a database. */
  cents: number;
  /** Come si scrive a una cliente: «€49», «€49,50». */
  testo: string;
  nome: string;
}

/**
 * Il prezzo come lo legge una persona. Gli euro tondi restano tondi (**€49**, non «€49,00»): il
 * decimale a zero su un prezzo tondo sembra il residuo di un calcolo, e i nostri piani sono tondi.
 * La virgola, non il punto — è un prezzo in italiano.
 */
export function euro(cents: number): string {
  const v = cents / 100;
  return Number.isInteger(v) ? `€${v}` : `€${v.toFixed(2).replace('.', ',')}`;
}

/**
 * Il prezzo del piano ATTIVO che corrisponde al filtro, `null` se non c'è.
 *
 * Si guarda solo fra i piani `active`: un piano spento non è più il prezzo di niente, e citarlo
 * vorrebbe dire proporre alla cliente una cosa che nel Negozio non può comprare.
 */
export async function prezzoPiano(
  prisma: PrismaService,
  filtro: { period?: string; name?: string; billing?: string },
): Promise<PrezzoPiano | null> {
  const where: Record<string, unknown> = { active: true };
  if (filtro.period) where.period = filtro.period;
  if (filtro.name) where.name = filtro.name;
  if (filtro.billing) where.billing = filtro.billing;
  const piano = (await prisma.plan
    .findFirst({
      where,
      // Se per errore ce ne fossero due (è già successo con le diete duplicate), si prende il più
      // economico: fra due prezzi possibili, quello che la cliente potrebbe rivendicare.
      orderBy: { priceCents: 'asc' },
      select: { name: true, priceCents: true },
    })
    .catch(() => null)) as { name: string; priceCents: number } | null;
  if (!piano || typeof piano.priceCents !== 'number' || piano.priceCents <= 0) return null;
  return { cents: piano.priceCents, testo: euro(piano.priceCents), nome: piano.name };
}

/**
 * Il pezzo di frase «a €49/mese», oppure stringa vuota se il prezzo non si sa.
 *
 * Esiste perché il punto delicato è la concatenazione: chi scrive il messaggio non deve trovarsi a
 * scegliere fra un numero inventato e una frase sgrammaticata. `«col mantenimento${aPrezzoAlMese(p)}»`
 * funziona in entrambi i casi.
 */
export function aPrezzoAlMese(p: PrezzoPiano | null): string {
  return p ? ` a ${p.testo}/mese` : '';
}
