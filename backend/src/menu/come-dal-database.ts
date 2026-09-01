/**
 * LE RICETTE COME LE RENDE IL DATABASE — per i finti Prisma dei test.
 *
 * ⛔ **Nasce da 54 test che passavano senza provare niente** (1/9). Il pool del motore chiede
 * `active` nella `select`, quindi dal database vero quel campo **arriva sempre**. I finti scritti
 * prima non lo rendevano: con il filtro nuovo ogni ricetta risultava spenta, ogni slot si svuotava,
 * la regola «uno slot vuoto non si svuota» lo risparmiava — e il pool tornava identico a prima.
 * Verde, e nessuna riga del codice nuovo esercitata.
 *
 * ⚠️ È l'ottava volta che un doppio che risponde diversamente dal database vero copre proprio il
 * codice che dovrebbe provare. Il rimedio non è ricordarselo: è che il finto passi da qui.
 *
 * ⚠️ **Il campo scritto nella fixture vince**: `{ id: 'x', active: false }` resta spento. Serve
 * esattamente per i test che provano il filtro.
 */
export const comeDalDatabase = <T extends object>(ricette: readonly T[]): (T & { active: boolean })[] =>
  ricette.map((r) => ({ active: true, ...r }));
