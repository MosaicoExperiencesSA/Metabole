import { giornoItaliano } from '../common/date-only';
import { PesataPerCoerenza, saltiImpossibili, SALTO_KG_DEFAULT, SALTO_RITMO_DEFAULT } from './peso-incoerente';

/**
 * ⛔ **CHIEDERGLIELO MENTRE DIGITA, INVECE DI TELEFONARLE DOPO** (voce `pesata-strana-chiedi-conferma`).
 *
 * `peso-incoerente.ts` sa già riconoscere due pesate che non possono essere della stessa persona, e
 * `signals.service.ts` ci costruisce sopra il guardrail: il fabbisogno si sospende, si apre una
 * segnalazione clinica, la coach riceve un avviso. Funziona — ⚠️ **ma agisce tutto dopo**. Fra il
 * tasto premuto male e la telefonata che lo ripara ci sono ore in cui quella cliente mangia il
 * livello della sua dieta invece del suo fabbisogno, e c'è una scrivania che si occupa di un refuso.
 *
 * Il posto dove lo stesso errore costa **niente** è il momento in cui il numero viene scritto: lì
 * chi ha sbagliato è ancora davanti alla tastiera e la correzione è un tocco. Qui sta la domanda da
 * fare in quel momento.
 *
 * ## ⛔ È una domanda, non un cancello
 *
 * Questo modulo **non rifiuta niente e non scrive niente**. Risponde a «questo numero torna con le
 * pesate che ci sono già?», e chi lo chiama può solo **chiedere**. Se la risposta della persona è
 * «sì, è giusto», il numero si salva esattamente come oggi e il guardrail fa il suo giro identico:
 * segnalazione aperta, fabbisogno sospeso, coach avvisata.
 *
 * ⚠️ Il motivo è scritto nella voce dei lavori e vale la pena ripeterlo qui, perché è la cosa che
 * una stesura futura sarebbe tentata di «migliorare»: una cliente che pesa davvero quel numero non
 * deve restare fuori dalla sua app perché noi non ci crediamo. *Un cancello chiuso costa a una
 * cliente tutto il servizio; una domanda a cui si risponde «sì» non costa niente a nessuno.*
 *
 * ## ⛔ E non è il browser a decidere se la domanda è stata fatta
 *
 * La tentazione ovvia è mandare al salvataggio un `confermato: true`, così che la segnalazione al
 * nutrizionista possa dire «gliel'abbiamo chiesto e ha confermato». ⚠️ **Non si fa**: sarebbe il
 * browser ad affermare cosa è stato mostrato a una persona, e un browser può affermarlo sempre. La
 * segnalazione direbbe «ha confermato» anche a chi non è stato chiesto niente, cioè scriverebbe al
 * nutrizionista **una ragione falsa** proprio sulla riga che lo deve far decidere se telefonare.
 * È lo stesso errore già pagato col menu a mano, dove `{"bloccata": false}` dal browser faceva
 * passare un allergene. Il testo della segnalazione resta quello che il server sa da sé.
 *
 * ## La regola è quella di là, non una copia
 *
 * Le soglie e il conto stanno in `peso-incoerente.ts` e si leggono da `config_param`: qui si
 * costruisce l'elenco delle pesate **con dentro il numero appena scritto** e si chiama
 * `saltiImpossibili`. ⚠️ Riscrivere il confronto qui — o peggio nel frontend, dove le soglie non
 * arrivano — vorrebbe dire due verità sulla stessa domanda clinica, e fra sei mesi due verità
 * diverse: la schermata direbbe «va bene» e il guardrail aprirebbe la segnalazione un secondo dopo.
 * *Se due punti rispondono alla stessa domanda, uno deve chiamare l'altro.*
 *
 * ## Perché guarda le coppie, e non solo «l'ultima pesata»
 *
 * La voce dei lavori chiede «l'ultima pesata è X del giorno Y», ed è il caso della cliente: lei
 * scrive **oggi**, quindi l'unica coppia nuova è quella con la pesata precedente. ⚠️ Ma dal
 * backoffice si corregge anche una riga **in mezzo alla storia**, e lì le coppie nuove sono due —
 * con quella prima e con quella dopo. Una correzione che sistema il rapporto col giorno prima e ne
 * rompe uno identico col giorno dopo è esattamente il gesto che questa schermata dovrebbe fermare,
 * e guardando solo indietro non lo vedrebbe.
 *
 * ⚠️ E si tengono **solo le coppie che toccano il giorno scritto**: la storia di una cliente può
 * contenere un salto vecchio e già segnalato, e farlo ricomparire a ogni pesata trasformerebbe la
 * domanda in un avviso che compare sempre — cioè in nessun avviso.
 *
 * Modulo **puro**: date e numeri, nessuna dipendenza.
 */

/** L'altra pesata della coppia: quella che c'è già in banca dati. */
export interface AltraPesata {
  date: Date;
  weightKg: number;
}

/** Il numero appena scritto non torna con una pesata che c'è già. */
export interface PesataDaConfermare {
  /** La pesata già registrata con cui non torna. */
  altra: AltraPesata;
  /** Il numero appena scritto, in chili. */
  scritto: number;
  /** Il giorno a cui il numero scritto andrebbe. */
  giorno: Date;
  /** L'altra pesata viene `prima` o `dopo` il giorno che si sta scrivendo. */
  dove: 'prima' | 'dopo';
  /** Giorni fra le due (mai meno di 1: la regola di `peso-incoerente.ts`). */
  giorni: number;
  /** Differenza in chili, sempre positiva. */
  salto: number;
  /** Ritmo implicito in kg/settimana. */
  ritmo: number;
}

/** Mezzanotte UTC del giorno di un `Date` già normalizzato o meno: le misure sono colonne DATE. */
const aMezzanotte = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * La coppia peggiore fra quelle che il numero scritto **crea**, o `null` se non ne crea nessuna.
 *
 * ⚠️ La riga con la **stessa data** viene tolta dall'elenco: se c'è, è quella che il numero scritto
 * sta sostituendo — la cliente che corregge la pesata di oggi, lo staff che corregge una riga. Se
 * restasse dentro, si confronterebbe il numero nuovo con quello vecchio dello stesso giorno e la
 * domanda uscirebbe **proprio mentre qualcuno sta riparando l'errore**: «hai scritto 73, ma il 3
 * settembre eri 113» — cioè si difenderebbe il numero sbagliato.
 */
export function pesataDaConfermare(
  pesate: readonly PesataPerCoerenza[],
  scritto: number,
  quando: Date,
  sogliaKg: number = SALTO_KG_DEFAULT,
  sogliaRitmo: number = SALTO_RITMO_DEFAULT,
): PesataDaConfermare | null {
  if (!Number.isFinite(scritto)) return null;
  if (!(quando instanceof Date) || !Number.isFinite(quando.getTime())) return null;
  const giorno = aMezzanotte(quando);

  /**
   * ⚠️ **Le date si portano tutte a mezzanotte prima del confronto.** In banca dati lo sono già —
   * `Measurement.date` è una colonna DATE — ma `saltiImpossibili` conta i giorni sugli istanti che
   * riceve: una data con dentro un orario (una fixture, un `new Date()` passato per sbaglio) darebbe
   * **un giorno in meno o in più**, cioè un ritmo diverso da quello che calcolerà il guardrail un
   * secondo dopo sulle stesse due righe. Normalizzare qui è di una riga; accorgersene dopo no.
   */
  const altre = (pesate ?? [])
    .filter(
      (p) =>
        p &&
        p.date instanceof Date &&
        Number.isFinite(p.date.getTime()) &&
        Number.isFinite(p.weightKg) &&
        aMezzanotte(p.date).getTime() !== giorno.getTime(),
    )
    .map((p) => ({ date: aMezzanotte(p.date), weightKg: p.weightKg }));
  if (!altre.length) return null;

  const tutte = saltiImpossibili([...altre, { date: giorno, weightKg: scritto }], sogliaKg, sogliaRitmo);
  const nostre = tutte.filter(
    (s) => aMezzanotte(s.dal).getTime() === giorno.getTime() || aMezzanotte(s.al).getTime() === giorno.getTime(),
  );
  if (!nostre.length) return null;

  // Stesso criterio di `saltoPeggiore`: vince il salto in chili, a parità la coppia più recente.
  const peggiore = nostre.reduce((peggio, s) => {
    if (s.salto > peggio.salto) return s;
    if (s.salto === peggio.salto && s.al.getTime() >= peggio.al.getTime()) return s;
    return peggio;
  });

  const altraPrima = aMezzanotte(peggiore.al).getTime() === giorno.getTime();
  return {
    altra: altraPrima
      ? { date: peggiore.dal, weightKg: peggiore.daKg }
      : { date: peggiore.al, weightKg: peggiore.aKg },
    scritto,
    giorno,
    dove: altraPrima ? 'prima' : 'dopo',
    giorni: peggiore.giorni,
    salto: peggiore.salto,
    ritmo: peggiore.ritmo,
  };
}

/**
 * ⚠️ **I numeri si scrivono come li scrive lei**: `73,5`, non `73.5`. Il punto decimale in mezzo a
 * una frase italiana è un numero che chi legge deve tradurre a mente per capire se è il suo.
 */
const kg = (n: number): string => String(n).replace('.', ',');

const giorniScritti = (n: number): string => (n === 1 ? 'un giorno' : `${n} giorni`);

/**
 * La domanda **per la cliente**.
 *
 * ⛔ **Non dice che ha sbagliato**, ed è la riga più importante di questo file. `peso-incoerente.ts`
 * lo scrive già per la coach e per il nutrizionista, e qui vale il doppio: questo codice sa solo che
 * due numeri insieme non stanno in piedi, e quel dominio contiene sia il tasto premuto male (quasi
 * sempre) sia il corpo che è cambiato davvero (raramente). *Una cliente a cui è successo qualcosa di
 * vero e a cui la sua app risponde «hai sbagliato a scrivere» non torna a scriverlo.*
 *
 * ⚠️ Quindi: si ripetono i due numeri, si dice quanto sono lontani, e si chiede. Il verdetto lo dà
 * lei, che è l'unica delle tre parti in causa ad avere la bilancia davanti.
 *
 * ⚠️ E **non si nomina la nutrizionista qui**: qui non è ancora successo niente: se risponde «sì»
 * glielo dice il riquadro dopo il salvataggio, che è il momento in cui la segnalazione esiste
 * davvero. Minacciare una segnalazione per ottenere una correzione è un modo di ottenere «no» dalle
 * persone a cui il numero era giusto.
 */
export function domandaPerLaCliente(p: PesataDaConfermare): string {
  /**
   * ⛔ **Non «l'ultima volta che ti sei pesata»** (corretto in revisione). Questa frase esce anche
   * mentre lei **corregge la pesata di oggi**: lì l'ultima volta che si è pesata è *stamattina*, non
   * il 26 agosto, e la riga di oggi è esclusa dal confronto di proposito. Sarebbe stata
   * un'affermazione falsa in uno dei due rami — *e una ragione falsa è peggio di un ordine
   * sbagliato*. «La pesata che abbiamo» è vero in tutt'e due.
   */
  const quando = p.dove === 'prima' ? 'La pesata che abbiamo prima di questa è del' : 'La tua pesata del';
  return (
    `${quando} ${giornoItaliano(p.altra.date)}: eri ${kg(p.altra.weightKg)} kg. ` +
    `Hai scritto ${kg(p.scritto)} kg: sono ${kg(p.salto)} kg in ${giorniScritti(p.giorni)}. È giusto?`
  );
}

/**
 * ⛔ **QUESTO SALTO RIGUARDA LA PESATA APPENA SCRITTA?** (aggiunta in revisione).
 *
 * `controllaPesoIncoerente` risponde il salto **peggiore dei novanta giorni**, non quello del numero
 * appena salvato — è giusto così per la coda della coach, ⚠️ ma se una schermata dicesse «*questa*
 * pesata è lontana dalle precedenti» ogni volta che quella risposta non è vuota, direbbe una cosa
 * falsa **a ogni pesata per tre mesi**: basta una coppia rotta in mezzo alla storia, anche già
 * guardata e chiusa dal nutrizionista.
 *
 * ⚠️ Il costo non è l'imprecisione: è che *un avviso che compare sempre non è un avviso*, ed è
 * scritto in testa a `peso-incoerente.ts` a proposito delle soglie. E c'è un secondo prezzo, peggio:
 * in app quel riquadro **copre l'allarme del calo rapido** (vedi `esitoPesata`), quindi per quei tre
 * mesi un calo vero e grave non le verrebbe più detto.
 */
export function toccaIlGiorno(s: { dal: Date; al: Date }, giorno: Date): boolean {
  if (!s || !(giorno instanceof Date) || !Number.isFinite(giorno.getTime())) return false;
  const g = aMezzanotte(giorno).getTime();
  return aMezzanotte(s.dal).getTime() === g || aMezzanotte(s.al).getTime() === g;
}

/**
 * La stessa domanda **per lo staff**, che sta correggendo la misura di un'altra persona.
 *
 * ⚠️ Cambiano le parole, non la regola: niente «ti sei pesata» (non è il suo corpo), e il giorno
 * della riga che sta scrivendo va detto — dal backoffice si corregge anche una pesata di due mesi
 * fa, e senza la data non si sa quale delle due righe si sta toccando.
 */
export function domandaPerLoStaff(p: PesataDaConfermare): string {
  return (
    `Il ${giornoItaliano(p.altra.date)} la pesata è ${kg(p.altra.weightKg)} kg. ` +
    `Con ${kg(p.scritto)} kg il ${giornoItaliano(p.giorno)} sarebbero ${kg(p.salto)} kg in ${giorniScritti(p.giorni)} ` +
    `(${kg(p.ritmo)} kg/settimana). Confermi il valore?`
  );
}
