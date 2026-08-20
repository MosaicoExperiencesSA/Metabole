/**
 * GLI ELENCHI SCRITTI A MANO NON DEVONO AVERE DOPPIONI — 20/8.
 *
 * ## Da dove viene
 *
 * Il 20/8 l'import degli alimenti si è fermato perché lo stesso nome compariva in due elenchi e la
 * mappa che doveva accorgersene non si aggiornava. Cercando la stessa forma nel resto del backend
 * ne sono usciti **quattro elenchi scritti a mano** che finiscono tutti nello stesso posto: una
 * `Set`/`Map` costruita per dire «questo c'è già», e poi una `create` per ogni voce che non c'era.
 *
 *   · `BACKOFFICE_PAGES`   (62 voci) → `rolePagePermission.createMany`, chiave `[role, pageKey]`
 *   · `VOCI_INIZIALI`      (130)     → `lavoro.create`, `chiave` è `@unique`
 *   · `VIGNETTE_CATALOG`   (8)       → `socialPost.create` per `collectionId`
 *   · i fogli degli alimenti          → `nutrientFact.create`, `name` è `@unique`
 *
 * ⚠️ **Tutti e quattro sono puliti oggi, e nessuno lo controllava.** Una riga incollata due volte
 * — che è esattamente il modo in cui questi file si modificano: si copia la riga sopra e si cambia
 * il testo — non dà nessun segnale finché non arriva in banca dati, dove diventa o un errore di
 * chiave duplicata a metà scrittura o due righe gemelle che nessuno ha chiesto.
 *
 * ⚠️ Il controllo sta **nei test**, non a runtime: il momento giusto per accorgersene è quando si
 * incolla la riga, non quando parte il seed in produzione. A runtime resta `skipDuplicates`, che è
 * la rete sotto, non il controllo.
 */

/** Le chiavi che compaiono più di una volta, con quante volte. Vuoto = elenco pulito. */
export function doppioni<T>(voci: readonly T[], chiaveDi: (v: T) => string): { chiave: string; volte: number }[] {
  const conta = new Map<string, number>();
  for (const v of voci) {
    const k = chiaveDi(v);
    conta.set(k, (conta.get(k) ?? 0) + 1);
  }
  return [...conta.entries()].filter(([, n]) => n > 1).map(([chiave, volte]) => ({ chiave, volte }));
}
