/**
 * GLI SPUNTINI CHE LA NUTRIZIONISTA HA TOLTO, DETTI ALLA CLIENTE — voce 235.
 *
 * `ClientProfile.pastiEsclusi` esiste dal 13/8 («togli lo spuntino», azione 3 dell'assistente): il
 * motore lo rispetta e le kcal si ridistribuiscono sui pasti rimasti. Ma finora **nessuna schermata
 * dell'app lo diceva**: la cliente riceveva giornate senza merenda e nessuno le aveva spiegato
 * perché. È lo stesso buco che avevano le allergie — un dato che agisce e non si vede è un dato che
 * prima o poi qualcuno contraddice senza saperlo, e qui quel qualcuno è lei che scrive alla coach
 * «mi manca un pasto» per una cosa decisa apposta.
 *
 * ⚠️ Modulo puro, in `lib/`: i test dell'app girano solo qui (`environment: 'node'`), e una frase
 * che una cliente legge sul proprio piano merita una tabella di casi, non un ternario dentro il JSX.
 */

/** Come si chiamano gli spuntini quando li legge lei — non i codici del motore. */
const NOME: Record<string, string> = {
  morning_snack: 'lo spuntino del mattino',
  afternoon_snack: 'la merenda del pomeriggio',
};

/** L'ordine è quello della giornata, non quello in cui sono finiti in banca dati. */
const ORDINE = ['morning_snack', 'afternoon_snack'];

/** Maiuscola solo sulla prima lettera: il resto della frase resta come è scritto sopra. */
function maiuscola(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * La riga da mostrare in profilo, o `null` se non c'è niente da dire.
 *
 * ⚠️ Uno slot che non so nominare **non diventa un codice sullo schermo di una cliente**: «dinner»
 * in faccia a chi legge non è un'informazione, è un difetto che si vede. Ma nemmeno si nasconde che
 * un pasto è stato tolto — sarebbe la stessa bugia per omissione che questa voce esiste per
 * chiudere. Si dice «un altro pasto», che è vero e leggibile, e lo staff il codice esatto lo vede
 * comunque in scheda.
 */
export function raccontaSpuntiniEsclusi(slots: readonly string[] | null | undefined): string | null {
  const unici = [...new Set((slots ?? []).filter(Boolean))];
  if (!unici.length) return null;

  const noti = unici.filter((s) => NOME[s]).sort((a, b) => ORDINE.indexOf(a) - ORDINE.indexOf(b));
  const ignoti = unici.length - noti.length;

  const pezzi = noti.map((s) => NOME[s]);
  if (ignoti === 1) pezzi.push('un altro pasto');
  else if (ignoti > 1) pezzi.push('altri pasti');

  return maiuscola(pezzi.length === 1 ? pezzi[0] : `${pezzi.slice(0, -1).join(', ')} e ${pezzi[pezzi.length - 1]}`);
}
