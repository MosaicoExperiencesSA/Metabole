/**
 * GLI ALLERGENI VINCONO SEMPRE SULLE MODIFICHE — decisione di Simone, 18/8 (voce 252).
 *
 * ## Il difetto
 *
 * `catalog.updateRecipe` scriveva `ingredients` **senza toccare** `allergensReviewed`. Una ricetta
 * con gli allergeni confermati a cui qualcuno cambia gli ingredienti dalla scheda restava
 * `allergensReviewed: true` — con la conferma di **prima**, data su un piatto diverso. Nessun
 * errore, nessuna riga rossa: il filtro degli allergeni continuava a girare su un'informazione
 * vecchia, e `collegaRicetta` la lasciava entrare nelle diete perché il campo diceva di sì.
 *
 * Una conferma è una firma su un contenuto. Cambiato il contenuto, la firma non vale più.
 *
 * ## ⚠️ Perché sui NOMI e non su qualunque salvataggio
 *
 * Simone ha scritto «gli allergeni vincono sempre sulle modifiche», e questo è il modo di
 * applicarlo che protegge davvero. **Una quantità non può introdurre né togliere un allergene**:
 * 80 g di farina o 100 g di farina hanno lo stesso glutine. Azzerare la conferma perché qualcuno ha
 * corretto un peso non aggiunge un grammo di sicurezza, e intanto **toglie il piatto dai menu**
 * finché qualcuno non lo rivede — cioè paga un costo vero per una protezione che non c'è.
 *
 * Quello che cambia gli allergeni è **cosa c'è dentro**: un ingrediente aggiunto, tolto o
 * rinominato. Lì la conferma decade, sempre, senza eccezioni e senza chiedere.
 *
 * ⚠️ E decade in modo **conservativo**: se gli ingredienti non si riescono a leggere (JSON storto,
 * forma inattesa), si azzera. Su un campo di sicurezza, «non ho capito» vale «non è confermato» —
 * mai il contrario.
 *
 * ## Cosa NON fa
 *
 * Non è retroattivo. Le ricette già in catalogo restano come sono: questo vale dalla prossima
 * modifica in poi, quindi il catalogo non si svuota di colpo e la coda di «Allergeni ricette» si
 * riempie al ritmo con cui qualcuno tocca le ricette.
 */

/** Un ingrediente come sta in `Recipe.ingredients`: `[{ name, qty, unit }]`. */
export interface IngredienteRicetta {
  name?: unknown;
  qty?: unknown;
  unit?: unknown;
}

/**
 * Il nome di un ingrediente, ridotto alla sua forma confrontabile. Minuscole, accenti sciolti,
 * punteggiatura via, spazi normalizzati: «Farina 00» e «farina 00 » sono lo stesso ingrediente, e
 * far decadere una conferma per uno spazio di troppo sarebbe rumore.
 */
export function nomeConfrontabile(valore: unknown): string {
  if (typeof valore !== 'string') return '';
  return valore
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** L'insieme dei nomi, o `null` se la lista non è leggibile (e allora si sta dalla parte sicura). */
function insiemeNomi(lista: unknown): Set<string> | null {
  if (!Array.isArray(lista)) return null;
  const nomi = new Set<string>();
  for (const voce of lista as IngredienteRicetta[]) {
    if (!voce || typeof voce !== 'object') return null;
    const n = nomeConfrontabile((voce as IngredienteRicetta).name);
    // Un ingrediente senza nome non è confrontabile: meglio dichiararsi ciechi che fingere di
    // vedere. Il chiamante azzera, che è la scelta sicura.
    if (!n) return null;
    nomi.add(n);
  }
  return nomi;
}

export type EsitoConfronto = 'uguali' | 'cambiati' | 'illeggibili';

/**
 * Gli ingredienti sono gli stessi? Confronta **gli insiemi dei nomi**: l'ordine non conta (spostare
 * una riga nel form non è una modifica), le quantità e le unità nemmeno.
 */
export function confrontaIngredienti(prima: unknown, dopo: unknown): EsitoConfronto {
  const a = insiemeNomi(prima);
  const b = insiemeNomi(dopo);
  if (!a || !b) return 'illeggibili';
  if (a.size !== b.size) return 'cambiati';
  for (const n of a) if (!b.has(n)) return 'cambiati';
  return 'uguali';
}

/**
 * La conferma degli allergeni decade con questo salvataggio?
 *
 * `dopo === undefined` vuol dire che il salvataggio **non tocca** gli ingredienti (`updateRecipe`
 * aggiorna solo i campi inviati): non c'è niente da far decadere.
 */
export function laConfermaDecade(
  eraConfermata: boolean,
  prima: unknown,
  dopo: unknown | undefined,
): boolean {
  if (!eraConfermata) return false;
  if (dopo === undefined) return false;
  return confrontaIngredienti(prima, dopo) !== 'uguali';
}

/**
 * Cosa legge chi ha appena salvato.
 *
 * ⚠️ Deve dire **la conseguenza**, non l'azione: «conferma allergeni azzerata» è gergo nostro, e chi
 * la legge non capisce che il piatto ha appena smesso di entrare nei menu. E deve dire **dove si
 * rimedia**, o è un avviso che lascia la persona ferma.
 */
export function fraseConfermaDecaduta(nomeRicetta?: string | null): string {
  const chi = (nomeRicetta ?? '').trim() || 'Questa ricetta';
  return (
    `${chi}: hai cambiato gli ingredienti, quindi la conferma degli allergeni non vale più — ` +
    'era stata data su un piatto diverso. ⚠️ Da adesso la ricetta NON entra nei menu nuovi finché ' +
    'non ricontrolli gli allergeni in «Allergeni ricette». I menu già consegnati non cambiano.'
  );
}
