/**
 * ASCOLTARE MEGLIO, E AMMETTERE QUANDO NON SI È CAPITO.
 *
 * ## La conversazione da cui nasce (12/8, girata da Simone)
 *
 * Gaia: «Quale alimento vuoi cambiare? Oggi hai — pranzo: Curry di Ceci e Spinaci · spuntino:
 * Cottage Cheese e Ananas Fresco · cena: Insalata Tiepida Tacchino e Quinoa.»
 * Cliente: «Voglio cambiare il menu di oggi **a pranzo** con verdura cruda e tonno al naturale»
 * Gaia: «**A cena** (Insalata Tiepida Tacchino e Quinoa) ci sono 50 g di **quinoa cruda**. Perché lo
 * vuoi cambiare?»
 *
 * Tre errori in una riga sola, e nessuno dei tre è «l'AI non ha capito»: il dialogo qui è
 * deterministico, quindi sono tre righe di codice.
 *
 * 1. **«cruda» è stata trattata come il nome di un alimento.** `combaciaAlimento` confronta per
 *    parola con la radice, e «cruda» combacia benissimo con la «quinoa cruda» della cena. Solo che
 *    «cruda» non nomina un cibo: lo **descrive**. Come «fresco», «naturale», «integrale», «tiepida».
 * 2. **Il pasto che la cliente aveva nominato è stato ignorato.** Aveva scritto «a pranzo», e la
 *    ricerca ha guardato tutti i pasti della giornata, trovando la cena.
 * 3. **Non avendo capito, ha risposto lo stesso.** È la cosa che Simone ha chiesto di cambiare per
 *    prima: «piuttosto che dare risposte a caso meglio chiedere *perdonami non ho capito, la mia
 *    domanda è…* e ripetere la domanda».
 *
 * E c'è un quarto caso, che si vede in una conversazione del 6/8: «potrei sostituire questo menu con
 * insalata iceberg, pomodoro, cipolla, cetriolo e 80 g di tonno al naturale?». Non è una
 * sostituzione di ingrediente: è **un pasto intero riscritto**. Il dialogo non ha modo di
 * concederlo, e fingere di aver capito una richiesta del genere è peggio che dire di no.
 */

const normalizza = (testo: string): string =>
  (testo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Parole che DESCRIVONO un cibo senza nominarlo, in forma di radice (vedi `radice` in
 * `common/nomi-alimento.ts`): una sola voce copre crudo/cruda/crude/crudi.
 *
 * ⚠️ Valgono solo **da sole**. In coppia restano eccome: «verdura cruda» e «tonno naturale» sono
 * nomi di ingredienti veri, e `terminiCandidati` prova le coppie prima delle singole apposta. Il
 * filtro toglie il termine di una parola, non la coppia che lo contiene.
 */
export const QUALIFICATORI = new Set([
  // stato e cottura
  'crud', 'cott', 'fritt', 'grigliat', 'lessat', 'bollit', 'arrost', 'affumicat', 'essiccat',
  'surgelat', 'congelat', 'scongelat', 'stagionat', 'sott', 'marinat',
  // qualità e lavorazione
  'natural', 'fresc', 'secc', 'integral', 'raffinat', 'biologic', 'bio', 'light', 'magr', 'grass',
  'scremat', 'delattosat', 'senza', 'dolc', 'salat', 'piccant', 'tiepid', 'caldo', 'freddo',
  'grand', 'piccol', 'medio', 'intero', 'sfuso', 'confezionat',
]);

/**
 * I pasti, con le parole che la cliente usa davvero per nominarli.
 * L'ordine conta: le voci più lunghe e specifiche prima, o «spuntino» prenderebbe anche
 * «spuntino del pomeriggio».
 */
const PASTI_NOMINATI: { slot: string; pattern: RegExp }[] = [
  // ⚠️ Le chiavi sono quelle di `SLOT_LABEL` in `sostituzione-chat.ts` — `morning_snack`, non
  // `snack_morning`. Sbagliarle non dà nessun errore: dà un filtro che non seleziona mai niente.
  { slot: 'morning_snack', pattern: /\b(spuntino (della |di |del )?mattin\w*|spuntino mattutino|merenda (della |di )?mattin\w*)\b/ },
  { slot: 'afternoon_snack', pattern: /\b(spuntino (del |di )?pomeriggio|merenda (del |di )?pomeriggio|merenda pomeridiana)\b/ },
  { slot: 'breakfast', pattern: /\b(colazione|stamattina|stamane)\b/ },
  { slot: 'lunch', pattern: /\b(pranzo|pranzare)\b/ },
  { slot: 'dinner', pattern: /\b(cena|cenare|stasera)\b/ },
  // Generico: solo se non ha detto quale dei due. Ultimo, o prenderebbe anche gli altri.
  { slot: 'snack', pattern: /\b(spuntino|merenda)\b/ },
];

/**
 * Il pasto che la cliente ha nominato, se l'ha nominato.
 *
 * Serve a **restringere** la ricerca dell'ingrediente, non ad allargarla: chi scrive «a pranzo» sta
 * dicendo dove guardare, e guardare altrove è il modo di rispondere della cena a chi parlava del
 * pranzo. Il chiamante deve comunque verificare che quel pasto esista in quella giornata.
 */
export function pastoNominato(testo: string): string | null {
  const t = normalizza(testo);
  if (!t) return null;
  for (const p of PASTI_NOMINATI) if (p.pattern.test(t)) return p.slot;
  return null;
}

/**
 * «Sostituisco tutto il piatto con X, Y e Z»: una richiesta che il dialogo NON può concedere.
 *
 * Non è una questione di riconoscimento: è che riscrivere un pasto intero con alimenti scelti dalla
 * cliente vuol dire rifare i conti delle calorie e dei macro, ed è mestiere della nutrizionista. La
 * risposta giusta è passargliela con quello che ha scritto — non provare a estrarre un ingrediente
 * dalla frase e far finta di aver capito.
 *
 * ⚠️ Serve il **connettivo**: «vorrei sostituire il pranzo» da solo è un cambio di piatto, che il
 * dialogo sa fare benissimo. È «… **con** insalata, pomodoro e tonno» a renderlo un'altra cosa.
 */
const PIATTO_INTERO: RegExp[] = [
  /\b(sostituir|cambiar|rifar|rifare)\w*\b[^.?!]{0,40}\b(menu|piatto|pasto|pranzo|cena|colazione|spuntino|merenda)\b[^.?!]{0,30}\bcon\b/,
  /\b(al posto (di|del|della) (questo|quel|il|la) (menu|piatto|pasto|pranzo|cena|colazione))\b/,
  /\b(mangiare|fare|farmi|prendere)\b[^.?!]{0,20}\b(al posto (di|del|della))\b[^.?!]{0,20}\b(menu|piatto|pasto|pranzo|cena|colazione)\b/,
];

export function proponeUnPastoIntero(testo: string): boolean {
  const t = normalizza(testo);
  if (!t) return false;
  return PIATTO_INTERO.some((r) => r.test(t));
}

/**
 * «Perdonami, non ho capito. La mia domanda è: …» — con la domanda **identica** a quella di prima.
 *
 * Richiesta di Simone del 12/8, parola per parola: «piuttosto che dare risposte a caso meglio
 * chiedere perdonami non ho capito, la mia domanda è… (e ripetere la domanda)».
 *
 * ⚠️ La domanda si ripete **verbatim**, non riscritta. Riformularla sembra gentile ed è il modo più
 * rapido di confondere: una persona che non ha capito la prima volta rilegge, e se il testo è
 * diverso non sa più se è la stessa domanda o una nuova. Per questo il dialogo si porta dietro
 * l'ultima domanda fatta (`StatoSostituzione.ultimaDomanda`) invece di ricostruirla.
 */
export function nonHoCapito(domanda: string | null | undefined, nome?: string | null): string {
  const chi = nome ? ` ${nome}` : '';
  if (!domanda || !domanda.trim()) {
    // Senza la domanda di prima non si inventa niente: si chiede di ripetere, e basta.
    return `Perdonami${chi}, non ho capito. Me lo riscrivi in altre parole?`;
  }
  return `Perdonami${chi}, non ho capito. La mia domanda è:\n\n${domanda.trim()}`;
}
