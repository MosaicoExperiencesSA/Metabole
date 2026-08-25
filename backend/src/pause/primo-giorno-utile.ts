import { giornoDelDato } from '../common/date-only';
import { giornoDiRientro, type PeriodoSospeso } from './giorno-di-rientro';

/**
 * ⛔ **DA QUANDO PUÒ COMINCIARE LA PROSSIMA SOSPENSIONE, E PERCHÉ NON PRIMA.**
 *
 * Richiesta di Simone, 25/8: *«se c'è già una sospensione in corso o programmata il sistema deve
 * dare come data inizio della nuova sospensione il primo giorno utile, e non far sovrapporre le
 * sospensioni»*.
 *
 * ## Il difetto che chiude
 *
 * Prima di oggi «primo giorno utile» **non esisteva da nessuna parte**: i campi delle date partivano
 * vuoti su tutte e tre le porte, e la sovrapposizione era gestita in tre modi diversi.
 *  · Dal **back office** si rifiutava — ma si rifiutava *qualunque* modalità viaggio ancora aperta,
 *    anche su date che non si toccano. È il motivo per cui una coach non poteva mettere due
 *    sospensioni consecutive: il codice non guardava la sovrapposizione, guardava l'esistenza.
 *  · Dall'**app** non si rifiutava affatto. `requestPause` controllava solo se c'era una richiesta
 *    `pending`, e la tregua guarda solo le vacanze finite **prima** della nuova: una sospensione
 *    **già programmata nel futuro** era invisibile a tutti e due i controlli. La cliente poteva
 *    sovrapporre, e il piano le si allungava **due volte per lo stesso periodo**.
 *
 * ## Le due risposte, e perché sono due
 *
 * Simone, 25/8, sceglendo fra le opzioni: *«il giorno di rientro in modo che la coach (non la
 * cliente) possa fare le sospensioni continue»*.
 *
 *  · **Coach** (back office): il primo giorno utile è il **giorno di rientro** dell'ultima
 *    sospensione — cioè le sospensioni si possono incatenare, una attaccata all'altra. È il caso
 *    vero: la vacanza si allunga, o ne comincia una seconda appena finita la prima, e chi decide ha
 *    la scheda davanti.
 *  · **Cliente** (richiesta di pausa e Calendario in app): il primo giorno utile è il rientro **più
 *    la tregua** (`pause_min_gap_days`, 15 giorni). La tregua esiste apposta perché due sospensioni
 *    attaccate sono un percorso che non comincia mai (`tregua-fra-vacanze.ts`), e la stessa regola
 *    dice che la seconda ravvicinata «va chiesta alla coach, che attiva lei». Incatenarle è un
 *    potere della coach, non un'operazione che si fa da soli.
 *
 * ⚠️ **Una funzione sola con un parametro**, non due funzioni: la differenza fra le due porte è
 * quanti giorni di tregua si applicano (zero per la coach). Due implementazioni della stessa
 * aritmetica sono due implementazioni che un giorno divergono — e divergerebbero proprio sul numero
 * che le due schermate mostrano alla stessa persona.
 *
 * ⚠️ **Pura, senza database**: si prende i periodi già letti. È lo schema di `tregua-fra-vacanze.ts`
 * e per la stessa ragione — `PauseModule` e `CalendarModule` si importano per vie traverse, e un
 * servizio iniettato qui chiuderebbe un anello fra moduli.
 */

const GIORNO = 86_400_000;

/** Un periodo che occupa dei giorni: un `Event pause_period`, da qualunque porta venga. */
export interface PeriodoOccupato extends PeriodoSospeso {
  /** L'etichetta, solo per poterla dire nel messaggio («Modalità viaggio», «Pausa (vacanza)»). */
  label?: string | null;
}

export interface EsitoPrimoGiorno {
  /** Il primo giorno da cui una nuova sospensione può cominciare. Mezzanotte UTC, come i giorni. */
  giorno: Date;
  /**
   * La sospensione che sposta in avanti la data, se c'è. ⚠️ `null` vuol dire «si può cominciare
   * oggi», non «non ci sono mai state sospensioni»: quelle già finite non spostano niente.
   */
  bloccante: PeriodoOccupato | null;
  /**
   * `true` se a spostare la data è stata la **tregua** e non la sospensione in sé. Serve a dire la
   * cosa giusta: «aspetta che finisca» e «devono passare 15 giorni» sono due frasi diverse, e chi le
   * legge deve sapere quale delle due le sta capitando.
   */
  perTregua: boolean;
}

/**
 * Due periodi si toccano? Estremi **compresi**: una sospensione che finisce il 20 e una che comincia
 * il 20 si sovrappongono per un giorno, e quel giorno verrebbe contato due volte sulla scadenza.
 *
 * ⚠️ È il confronto che mancava all'app. Sta qui e non scritto a mano nei tre servizi per la regola
 * di casa: se due punti rispondono alla stessa domanda, uno deve chiamare l'altro.
 */
export function siSovrappone(a: PeriodoSospeso, b: PeriodoSospeso): boolean {
  const inizioA = giornoDelDato(a.startDate).getTime();
  const fineA = giornoDelDato(a.endDate).getTime();
  const inizioB = giornoDelDato(b.startDate).getTime();
  const fineB = giornoDelDato(b.endDate).getTime();
  return inizioA <= fineB && fineA >= inizioB;
}

/**
 * Fra i periodi dati, quello (o quelli) che si sovrappongono a `nuovo`.
 *
 * ⚠️ Rende **tutti** quelli che si toccano e non il primo: se sono due, dirlo cambia cosa fa chi
 * legge — con uno si sposta la data, con due c'è qualcosa da sistemare prima.
 */
export function sovrapposti(nuovo: PeriodoSospeso, periodi: PeriodoOccupato[]): PeriodoOccupato[] {
  return periodi.filter((p) => siSovrappone(nuovo, p));
}

/**
 * Il primo giorno da cui una nuova sospensione può cominciare.
 *
 * @param oggi il giorno di oggi (mezzanotte UTC del giorno di Roma: `aGiorno(new Date())`).
 * @param periodi le sospensioni della cliente. ⚠️ Vanno passate **tutte**, anche quelle finite: la
 *   tregua si conta dal rientro dell'ultima finita, e filtrarle qui vorrebbe dire che chi chiama
 *   deve sapere quale regola si applica — cioè sapere già la risposta.
 * @param treguaGiorni quanti giorni devono passare fra il rientro e la nuova partenza. **0 per la
 *   coach** (sospensioni continue permesse), il parametro `pause_min_gap_days` per la cliente.
 */
export function primoGiornoUtile(
  oggi: Date,
  periodi: PeriodoOccupato[],
  treguaGiorni = 0,
): EsitoPrimoGiorno {
  const inizio = giornoDelDato(oggi).getTime();
  const tregua = Number.isFinite(treguaGiorni) && treguaGiorni > 0 ? Math.floor(treguaGiorni) : 0;

  let giorno = inizio;
  let bloccante: PeriodoOccupato | null = null;
  let perTregua = false;

  for (const p of periodi) {
    const rientro = giornoDiRientro(p).getTime();
    /**
     * ⚠️ **Due candidati per ogni periodo, e vince il più avanti.** Il rientro è il vincolo «non ti
     * sovrapporre»; il rientro più la tregua è il vincolo «devono passare N giorni». Per la coach il
     * secondo coincide col primo, e allora non c'è nessuna tregua da raccontare.
     */
    if (rientro > giorno) {
      giorno = rientro;
      bloccante = p;
      perTregua = false;
    }
    const dopoLaTregua = rientro + tregua * GIORNO;
    if (tregua > 0 && dopoLaTregua > giorno) {
      giorno = dopoLaTregua;
      bloccante = p;
      perTregua = true;
    }
  }

  return { giorno: new Date(giorno), bloccante, perTregua };
}

/** `2026-09-01` → `01/09/2026`, come lo scrivono tutte le altre frasi di questa area. */
function scritta(d: Date): string {
  return giornoDelDato(d).toLocaleDateString('it-IT', { timeZone: 'UTC' });
}

/**
 * ⛔ **LA FRASE CHE SI LEGGE QUANDO LA DATA NON VA BENE — e dice QUALE data mettere.**
 *
 * Simone, 25/8, scegliendo cosa fare quando si forza: *«Rifiuta e dice il primo giorno utile»*.
 *
 * ⚠️ Il messaggio vecchio del back office diceva solo «questa cliente ha già una modalità viaggio
 * dal X»: vero, e inutile per chi ha una data in mano e deve saperne un'altra. Chi legge deve poter
 * correggere senza andare a cercare, quindi la data da cui si può partire sta **nella frase**.
 *
 * ⛔ **`collisione` si passa, non si deduce da `esito.bloccante`** — corretto in revisione, 25/8.
 * Le due cose sembrano la stessa e non lo sono: `bloccante` è quello che **sposta in avanti** la
 * data, e su un periodo tutto nel passato è `null` (giustamente: non sposta niente). Ma una
 * sovrapposizione con un periodo passato **esiste** — basta chiedere una pausa retroattiva — e la
 * frase scriveva «Hai già una pausa dal **null** e riprendi il **null**». Riprodotto dalla revisione.
 *
 * ⚠️ E la frase cambia a seconda di **chi legge**: la coach può incatenarle e quindi il suo primo
 * giorno utile è il rientro; alla cliente, se a spostarla è la tregua, si dice che la tregua
 * esiste e a chi rivolgersi — se no sembra un errore del sistema invece di una regola.
 */
export function fraseNonSiSovrappone(
  esito: EsitoPrimoGiorno,
  chi: 'coach' | 'cliente',
  collisione?: PeriodoOccupato | null,
): string {
  const tocca = collisione ?? esito.bloccante;
  const dal = tocca ? scritta(tocca.startDate) : null;
  const al = tocca ? scritta(giornoDiRientro(tocca)) : null;
  const utile = scritta(esito.giorno);
  const quale = tocca?.label ? `«${tocca.label}»` : 'una sospensione';
  /** ⚠️ Senza il periodo non si scrivono date inventate: si dice quello che si sa. */
  const quando = dal ? ` (dal ${dal}, riprende il ${al})` : '';

  if (chi === 'coach') {
    return (
      `Le date si sovrappongono a ${quale} che c'è già${quando}: ` +
      `sullo stesso giorno il piano si allungherebbe due volte. ` +
      `Il primo giorno da cui puoi far partire questa è il ${utile} — le sospensioni consecutive vanno bene.`
    );
  }
  if (esito.perTregua) {
    return (
      `Hai già una pausa${quando}, e fra due pause devono passare dei giorni: ` +
      `la prossima la puoi cominciare dal ${utile}. Se ti serve prima, scrivi alla tua coach — ` +
      'la può attivare lei. 💚'
    );
  }
  return (
    `Hai già una pausa${quando}: queste date si sovrappongono. ` +
    `La prossima la puoi cominciare dal ${utile}. 💚`
  );
}
