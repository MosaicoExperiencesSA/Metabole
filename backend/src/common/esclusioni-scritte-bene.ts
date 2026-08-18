/**
 * AIUTARE A SCRIVERE L'ELENCO, INVECE DI SCARTARE IN SILENZIO — decisione di Simone, 18/8.
 *
 * Parola sua: **«le esclusioni devono essere un elenco, ogni parola deve essere seguita da una
 * virgola, aiutiamo le clienti a scrivere in modo corretto»**.
 *
 * ## I due casi veri, trovati in produzione il 17/8
 *
 * Il campo dei cibi non graditi accetta **frasi**, e il motore legge **alimenti**. Quello che una
 * cliente scrive in mezzo si perde senza che nessuno lo dica:
 *
 * - **«pesce tranne salmone, tonno»** — come termine intero non esclude niente: il pesce continua
 *   ad arrivarle. E spezzato sulla virgola diventa «pesce tranne salmone» + «tonno», cioè rende
 *   escluso il **tonno**, che è l'⚠️ **opposto** di quello che ha scritto: lo elencava fra le
 *   eccezioni. Un'esclusione che fa il contrario è peggio di un'esclusione che non funziona.
 * - **«Non mi piace la cicoria»** — una frase intera salvata come alimento, accanto a «Cicoria»
 *   che invece funziona.
 *
 * ## ⚠️ Cosa fa questo modulo, e cosa NON fa
 *
 * **Non corregge.** Non riscrive il campo, non toglie parole, non decide al posto di nessuno:
 * riconosce che quello che è stato scritto non è un elenco di alimenti, e **restituisce la frase da
 * mostrare a chi sta scrivendo**, con un suggerimento concreto.
 *
 * Correggere da soli sarebbe l'errore peggiore proprio qui: su «pesce tranne salmone» la
 * correzione automatica più ovvia — tenere la prima parola — escluderebbe **tutto il pesce**,
 * salmone compreso, che è di nuovo il contrario di quello che voleva. Chi ha scritto la frase è
 * l'unica persona che sa cosa intendeva, ed è a lei che va fatta la domanda.
 */
import { SEPARATORI_ALIMENTI } from './tag-alimenti';

/**
 * Le parole con cui si dice «non tutto»: sono quelle che rendono una frase l'opposto di un elenco.
 * ⚠️ Con gli spazi intorno nel confronto: «ma» dentro «marmellata» non è una negazione, e un
 * confronto per sottostringa avrebbe segnalato mezzo catalogo.
 */
const PAROLE_DI_ECCEZIONE = ['tranne', 'eccetto', 'a parte', 'salvo', 'escluso', 'esclusa', 'tolto', 'tolta', 'solo se', 'purche', 'purché', 'ma non', 'se non'];

/** I modi di aprire una frase invece di scrivere un alimento. L'ordine conta: i più lunghi prima,
 *  o «non mi» prenderebbe anche «non mi piace» lasciando in mezzo un pezzo di frase. */
const INIZI_DI_FRASE = [
  'non mi piacciono', 'non mi piace', 'non mi va', 'non riesco a mangiare', 'non posso mangiare',
  'non voglio mangiare', 'non voglio', 'non mangio', 'non gradisco', 'non amo', 'non sopporto',
  'non tollero', 'niente', 'evito', 'odio', 'detesto', 'basta con', 'no ',
];

/** Quante parole può avere un alimento vero prima che sia più probabile una frase. «Yogurt greco
 *  intero al naturale» sono cinque: il confine sta oltre, e infatti l'avviso non scatta sulla
 *  lunghezza da sola — serve una parola di frase o di eccezione. */
const PAROLE_PRIMA_DI_INSOSPETTIRSI = 6;

export type TipoProblema = 'eccezione' | 'frase' | 'troppo_lunga';

export interface ProblemaEsclusione {
  /** La voce così com'è stata scritta. */
  voce: string;
  tipo: TipoProblema;
  /** Cosa succede davvero, detto a chi ha scritto. */
  spiegazione: string;
  /** Cosa scrivere invece. `null` quando suggerire sarebbe indovinare. */
  suggerimento: string | null;
}

const normalizza = (t: string): string =>
  (t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Le voci scritte, spezzate sui separatori che il resto del progetto già usa. */
export function vociScritte(valore: string | readonly string[]): string[] {
  const testo = Array.isArray(valore) ? valore.join(', ') : String(valore ?? '');
  return testo
    .split(SEPARATORI_ALIMENTI)
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Il problema di UNA voce, o `null` se è scritta bene.
 *
 * ⚠️ L'ordine dei controlli non è casuale: l'**eccezione** si guarda per prima perché è il caso che
 * fa danno — un'esclusione che esclude il contrario — e perché una frase può contenerle tutte e
 * due («non mi piace il pesce tranne il salmone»).
 */
export function problemaDellaVoce(voce: string): ProblemaEsclusione | null {
  const v = (voce ?? '').trim();
  if (!v) return null;
  const n = ` ${normalizza(v)} `;

  const eccezione = PAROLE_DI_ECCEZIONE.find((p) => n.includes(` ${p} `));
  if (eccezione) {
    return {
      voce: v,
      tipo: 'eccezione',
      spiegazione:
        `«${v}» non è un alimento: contiene un'eccezione («${eccezione}»), e il sistema non sa leggerla. ` +
        'Così com\'è non toglie niente dal menu.',
      // ⚠️ Nessun suggerimento, ed è deliberato: la correzione più ovvia (tenere la prima parola)
      // escluderebbe TUTTO — salmone compreso — cioè il contrario di quello che ha scritto.
      // Qui si chiede, non si indovina.
      suggerimento: null,
    };
  }

  const inizio = INIZI_DI_FRASE.find((p) => n.startsWith(` ${p}`));
  if (inizio) {
    const resto = v
      .replace(new RegExp(`^\\s*${inizio.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '')
      .replace(/^(il|lo|la|i|gli|le|l')\s*/i, '')
      .trim();
    return {
      voce: v,
      tipo: 'frase',
      spiegazione: `«${v}» è una frase, e il sistema legge nomi di alimenti: così com'è non toglie niente dal menu.`,
      suggerimento: resto && resto.length > 1 ? resto : null,
    };
  }

  if (normalizza(v).split(' ').length > PAROLE_PRIMA_DI_INSOSPETTIRSI) {
    return {
      voce: v,
      tipo: 'troppo_lunga',
      spiegazione: `«${v}» è lunga per essere un alimento: se sono più cose, separale con una virgola.`,
      suggerimento: null,
    };
  }

  return null;
}

/** Tutti i problemi di quello che è stato scritto. `[]` = è un elenco di alimenti, e va bene. */
export function problemiEsclusioni(valore: string | readonly string[]): ProblemaEsclusione[] {
  return vociScritte(valore)
    .map(problemaDellaVoce)
    .filter((p): p is ProblemaEsclusione => p !== null);
}

/**
 * La frase da mostrare a chi ha appena scritto.
 *
 * ⚠️ Dice **cosa succede davvero** («non toglie niente dal menu»), non «formato non valido». Chi
 * legge «formato non valido» corregge la forma; chi legge «il pesce continuerà ad arrivarti»
 * capisce cosa sta perdendo — ed è l'unica versione che porta a una lista giusta.
 *
 * ⚠️ E chiude sempre con **come si scrive**, perché un avviso senza la strada d'uscita è un
 * rimprovero.
 */
export function fraseAiutoEsclusioni(problemi: readonly ProblemaEsclusione[]): string | null {
  if (!problemi.length) return null;
  const righe = problemi.map((p) =>
    p.suggerimento ? `${p.spiegazione} Volevi scrivere «${p.suggerimento}»?` : p.spiegazione,
  );
  return (
    `${righe.join('\n')}\n\n` +
    'Scrivi gli alimenti che NON vuoi, uno per virgola — per esempio «cicoria, tonno, panna». ' +
    'Quelli che mangi non serve elencarli.'
  );
}
