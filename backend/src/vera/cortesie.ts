/**
 * ⛔ **LE CORTESIE — le frasi che non sono istruzioni, e a cui «non ci arrivo» è una risposta stupida.**
 *
 * Dalla pagina «frasi che non ho capito», 31/8: su venticinque frasi in novanta giorni, **quattro**
 * sono cortesie — «ok», «ok ciao», «Quale?», «ok annulla tutto». ⚠️ Sembrano le meno importanti, e
 * sono quelle che fanno sembrare l'agente stupido: *«ok» che riceve «non ci arrivo» è la risposta
 * che una persona racconta agli altri.*
 *
 * ## ⛔ Quando NON deve intervenire, che è la cosa che conta
 *
 * Durante una conferma, «ok» vuol dire **sì** e «annulla» vuol dire **no**: li legge già
 * `leggiConferma`, e leggerli qui come cortesie vorrebbe dire **buttare via una conferma in
 * silenzio** — cioè una regola che la nutrizionista crede scritta e non lo è. Questo modulo si
 * chiama **solo** quando non c'è niente in sospeso, ed è il chiamante a saperlo.
 *
 * ## ⛔ E non deve mangiare un'istruzione
 *
 * «ok, a Giulia niente tonno» è un'istruzione con un «ok» davanti — quello lo toglie già
 * `capisci`, che spoglia saluto e vocativo. Qui si riconosce **solo la frase intera**: se dopo la
 * cortesia resta qualcosa, non è una cortesia. ⚠️ Ancorato ai due capi, non `includes`: è la
 * lezione che questo progetto ha già pagato tre volte, l'ultima con «passata di pomodoro».
 *
 * ## ⚠️ Perché ognuna ha una risposta DIVERSA
 *
 * Un unico «va bene» sarebbe cortese e inutile. Chi scrive «ok» a vuoto **crede** che qualcosa sia
 * in sospeso: dirle che non c'era niente è l'unica risposta che le fa capire cos'è successo. E chi
 * scrive «Quale?» sta rispondendo a una domanda che non vede più: dirle «non ci arrivo» la lascia
 * a chiedersi se ha sbagliato lei.
 */
import { normalizza } from '../common/nomi-alimento';

export type Cortesia =
  /** «ok», «va bene», «perfetto» a vuoto: crede che ci sia qualcosa in sospeso, e non c'è. */
  | 'presa-atto'
  /** «ciao», «ok ciao», «a domani», «buonanotte». */
  | 'saluto'
  /** «grazie», «grazie mille». */
  | 'grazie'
  /** «Quale?», «Chi?», «Cosa?»: una domanda senza la cosa a cui si riferisce. */
  | 'quale';

/**
 * ⚠️ **Si toglie la punteggiatura e le emoji ai due capi, non in mezzo.** «ok!!» e «ok 👍» sono la
 * stessa cortesia; «ok togli il tonno» non lo è, e deve restare intera per non passare.
 */
function nuda(frase: string): string {
  const senzaEmoji = (frase ?? '').replace(/[\p{Extended_Pictographic}️]/gu, ' ');
  return normalizza(senzaEmoji).replace(/^[\s.,;:!?…]+|[\s.,;:!?…]+$/g, '').trim();
}

/** ⚠️ Ogni forma è ancorata ai due capi: se dopo resta qualcosa, non è una cortesia. */
const FORME: [RegExp, Cortesia][] = [
  // ⛔ Il saluto PRIMA della presa d'atto: «ok ciao» è un congedo, non un «va bene».
  [/^(?:ok(?:ay)?\s+)?(?:ciao|arrivederci|a domani|a dopo|a piu tardi|buonanotte|buona notte|buona giornata|buona serata|ci sentiamo|a presto)$/, 'saluto'],
  // ⚠️ E «grazie ciao» è un congedo, non un grazie: l'ultima parola è quella che chiude.
  [/^grazie(?:\s+mille|\s+tante|\s+di\s+tutto)?\s+(?:ciao|a domani|a dopo|buonanotte)$/, 'saluto'],
  [/^(?:ok(?:ay)?\s+)?grazie(?:\s+mille|\s+tante|\s+di\s+tutto|\s+assai)?$/, 'grazie'],
  [/^(?:ok(?:ay)?|va bene|perfetto|d'accordo|daccordo|benissimo|bene|esatto|certo|capito|chiaro|ricevuto|si)$/, 'presa-atto'],
  // ⚠️ Il pronome nudo: una domanda senza la cosa a cui si riferisce.
  [/^(?:quale|quali|chi|cosa|che cosa|come|quando|dove|perche)$/, 'quale'],
];

/**
 * La cortesia, o `null`.
 *
 * ⛔ **`null` non è «non ho capito»**: vuol dire «questa non è una cortesia», e chi chiama continua
 * a provare tutto il resto. Questo modulo non risponde mai al posto del riconoscitore.
 */
/**
 * ⛔ **«FERMATI» VALE OVUNQUE NELLA FRASE, e le cortesie no. Sono due regole diverse.**
 *
 * Le cortesie si riconoscono **solo da sole**: «ok» dentro «ok togli il tonno» è un intercalare, e
 * prenderlo vorrebbe dire mangiarsi l'istruzione. ⚠️ «Annulla» è il contrario — chi lo scrive vuole
 * che ci si fermi, **qualunque cosa venga dopo**, e la frase vera che l'ha insegnato è «lascia
 * stare, ti chiamo Lucia»: whole-phrase l'avrebbe lasciata scivolare fino a proporsi di
 * ribattezzarsi. È un difetto trovato in revisione, e c'è una prova che lo tiene fermo.
 *
 * ⛔ Perciò la riga larga resta larga, e sta **qui accanto** invece che sparsa nel servizio: due
 * regole diverse con lo stesso scopo si scrivono vicine, o divergono.
 */
export function diceDiFermarsi(frase: string): boolean {
  return /\b(annulla|lascia stare|lascia perdere|ferma tutto)\b/i.test(frase ?? '');
}

export function leggiCortesia(frase: string): Cortesia | null {
  const t = nuda(frase);
  if (!t || t.length > 40) return null;
  for (const [re, quale] of FORME) if (re.test(t)) return quale;
  return null;
}

/**
 * Cosa risponde.
 *
 * ⚠️ **Ognuna dice anche come si riparte**, tranne il saluto: una risposta cortese che lascia lo
 * schermo vuoto è gentile e inutile, e la frase d'esempio è la stessa che usa `nonCapito` — chi la
 * legge due volte in due contesti diversi impara la forma.
 */
export function rispostaCortesia(c: Cortesia): string {
  const esempio = 'Per esempio: «a Giulia Rossi niente formaggi molli».';
  switch (c) {
    case 'saluto':
      /** ⚠️ Niente «a presto» promesso: non è lei a decidere quando si torna. */
      return 'Ciao! Quando ti serve sono qui.';
    case 'grazie':
      return `Di niente. ${esempio}`;
    case 'presa-atto':
      /**
       * ⛔ **Si dice che non c'era niente in sospeso.** Un «va bene» e basta lascerebbe credere che
       * qualcosa sia stato confermato: chi scrive «ok» a vuoto quasi sempre pensa di stare
       * rispondendo a una domanda che non vede più.
       */
      return `Va bene — anche se non c'era niente in sospeso da confermare: non stavo per scrivere nulla. ${esempio}`;
    case 'quale':
      /** ⚠️ Non «non ci arrivo»: la frase è chiarissima, è il contesto che manca. */
      return 'Scusa, non so a cosa ti riferisci: non ho niente in sospeso in questo momento. '
        + `Riscrivimi la domanda per intero e ti rispondo. ${esempio}`;
    default:
      return esempio;
  }
}
