import { PROTOCOLLI_DIGIUNO, protocolloDigiuno } from '../menu/orologio-digiuno';

/**
 * ⛔ **LA NUTRIZIONISTA CAMBIA LE ORE DEL DIGIUNO DI UNA CLIENTE, A VOCE.**
 *
 * ## Perché esiste
 *
 * Dal 25/8 la cliente può cambiare **le ore** (il protocollo: 14:10, 16:8, 18:6, 20:4, 23:1) una
 * volta a settimana — richiesta della capo nutrizionista, decisa da Simone: *«sì, posso cambiare
 * solo una volta a settimana; per cambi ulteriori va richiesto al nutrizionista — attraverso Vera il
 * nutrizionista può correggere»*.
 *
 * ⛔ **La seconda metà di quella frase non esisteva.** Dal 21/8 la tendina della finestra è stata
 * tolta dalla scheda staff: la finestra la *deriva* l'orologio della cliente, e in tutto il backend
 * non c'era **nessuna porta** da cui una nutrizionista potesse cambiare il protocollo di qualcuno.
 * Mettere il limite senza aprire questa porta vorrebbe dire scrivere a una cliente *«se ti serve
 * prima, scrivilo alla tua nutrizionista»* mandandola da una persona che non può farci niente —
 * cioè *un cancello chiuso*, che costa a una cliente tutto il servizio, con una frase che le fa
 * anche credere il contrario.
 *
 * ## Cosa legge questo file, e cosa no
 *
 * Solo la frase: **chi** e **quale protocollo**. Non tocca il database, non cerca nessuno, non
 * decide se si può fare — è lo schema di tutti gli altri lettori di Vera, e per la stessa ragione:
 * la regola si prova senza database, e l'omonimia la scioglie il servizio come per ogni altra
 * azione.
 *
 * ⚠️ **L'ORARIO NON SI LEGGE DA QUI, ed è una scelta.** «Metti Giulia a 16:8» è un fatto clinico;
 * «apri alle 13:00» è la posizione della finestra nella *sua* giornata — quando lavora, quando cena,
 * a che ora si sveglia. Quella la sposta lei dall'app, una volta al giorno, e nessuno la sa meglio
 * di lei. Se un domani servirà anche quello, sarà un campo in più e una domanda in più, non un
 * numero indovinato dentro questa frase.
 */

export interface DigiunoDettato {
  /** Il protocollo, nella forma esatta del catalogo (`16:8`). */
  protocollo: string;
}

/**
 * La frase nomina il digiuno? È il **contesto** che rende sicuro riconoscere le forme corte: senza,
 * «standard» e «14/10» sono una dieta e una data.
 */
const PARLA_DI_DIGIUNO = /\b(digiun\w*|finestra|protocollo)\b/u;

/**
 * ⛔ Serve un **verbo di comando**: senza, «Giulia fa 16:8 da un mese» — una constatazione —
 * diventerebbe un ordine di scrittura sul profilo di una persona. ⚠️ È lo stesso criterio della
 * controproposta in chat: un alimento nominato non è un alimento chiesto.
 */
const VERBO_DI_COMANDO = /\b(mett\w+|cambi\w+|passa\w*|sposta\w*|imposta\w*|port\w+|corregg\w+|rimett\w+)\b/iu;

/** `16 8` → `16:8`, se è un protocollo vero. `null` se non lo è. */
function normalizzaCoppia(a: string, b: string): string | null {
  const v = `${Number(a)}:${Number(b)}`;
  return protocolloDigiuno(v) ? v : null;
}

/**
 * ⛔ **IL PROTOCOLLO SI RICONOSCE, NON SI INDOVINA.**
 *
 * Rende `null` su qualunque frase che non nomini un protocollo **del catalogo**: «mettila a 15:9»
 * non esiste, e accettarlo scriverebbe nel profilo di una persona una finestra che l'orologio non sa
 * disegnare. *Non lo so deve costare meno di ho indovinato.*
 */
export function leggiDigiunoDettato(testo: string): DigiunoDettato | null {
  const t = (testo ?? '').toLowerCase();
  const nominato = PARLA_DI_DIGIUNO.test(t);

  /**
   * ⛔ **IL NOME DEL PROTOCOLLO VALE SOLO SE LA FRASE PARLA DI DIGIUNO** — corretto al secondo giro
   * di revisione, 25/8, ed era un falso positivo grosso.
   *
   * «Standard» è una parola che una nutrizionista scrive tutti i giorni. Cercandola in tutta la
   * frase, *«metti la dieta standard a Giulia»*, *«rimetti la porzione standard»* e *«metti a Giulia
   * il pane standard»* diventavano tutte e tre l'ordine di portarla a **16:8** — e su una cliente
   * già a 16:8 Vera rispondeva «è già così», che a una richiesta sulla dieta è una risposta senza
   * senso. Prima di questa consegna quelle frasi davano `null`, cioè «non ci arrivo»: la risposta
   * sicura. ⚠️ *Una regola che allarga il riconoscimento deve stringere il contesto.*
   */
  if (nominato) {
    for (const p of PROTOCOLLI_DIGIUNO) {
      if (new RegExp(`\\b${p.nome.toLowerCase()}\\b`, 'u').test(t)) return { protocollo: p.valore };
    }
  }

  /**
   * ⛔ **E `14/10` È UNA DATA.** Stesso giro di revisione, stesso tipo di difetto ma peggiore: le
   * **cinque** coppie del catalogo sono tutte date plausibili — 14/10, 16/8, 18/6, 20/4, 23/1 — e
   * *«sposta la visita di Giulia al 14/10»* apriva un'anteprima *«sto per mettere Giulia a 14:10…
   * Confermi?»*. In una chat dove si risponde «sì» di corsa, quello scrive un cambio clinico su una
   * frase che parlava di un appuntamento.
   *
   * ✅ Il **due punti** resta libero: `16:8` non è una data e non è un'ora (le ore si scrivono
   * `16:08`, ed è la riga qui sotto a tenerle fuori). Gli altri separatori — `/`, `-`, lo spazio —
   * si accettano **solo** se la frase nomina il digiuno: lì il contesto ha già detto di cosa si
   * parla, e «cambia il digiuno di Giulia a 16/8» è inequivocabile.
   */
  const conDuePunti = t.match(/\b(\d{1,2})\s*:\s*(\d{1,2})\b/);
  const conAltro = nominato ? t.match(/\b(\d{1,2})\s*[/\-\s]\s*(\d{1,2})\b/) : null;
  const m = conDuePunti ?? conAltro;
  if (!m) return null;
  /**
   * ⚠️ **«16:08» è un orario**: lo zero davanti distingue un orologio da un protocollo — i minuti si
   * scrivono con due cifre, le ore di finestra no.
   */
  if (/^0\d/.test(m[2])) return null;
  const valore = normalizzaCoppia(m[1], m[2]);
  return valore ? { protocollo: valore } : null;
}

/** La frase parla di cambiare il digiuno **di qualcuno**? */
export function chiedeUnCambioDiDigiuno(testo: string): boolean {
  const t = (testo ?? '').toLowerCase();
  if (!VERBO_DI_COMANDO.test(t)) return false;
  /**
   * ⚠️ **O si nomina il digiuno, o si nomina un protocollo VERO.** «Metti Giulia a 18:6» non
   * contiene la parola «digiuno» e vuol dire esattamente questo: pretenderla avrebbe lasciato fuori
   * la forma più corta e più naturale — trovata scrivendo i test del dialogo.
   *
   * ⛔ E il protocollo deve essere **del catalogo** (`leggiDigiunoDettato` lo verifica): è quello
   * che tiene fuori gli orari. «16:8» non è un'ora — le ore si scrivono `16:08` o `16.00` — e
   * `12:12`, che come coppia esiste, non è un protocollo e quindi non apre questa strada.
   */
  return PARLA_DI_DIGIUNO.test(t) || leggiDigiunoDettato(t) !== null;
}

/**
 * ⛔ **IL NOME SUBITO DOPO IL VERBO: «metti Giulia a 18:6».**
 *
 * Il lettore generale dei nomi (`nomePersona` in `capisci.ts`) cerca la persona **dopo una
 * preposizione** — «a Giulia», «per Anna» — perché una parola maiuscola a caso non è un nome, e
 * attribuire una regola alla persona sbagliata è il difetto peggiore che quel file possa avere.
 *
 * ⚠️ Ma qui la forma più naturale mette la preposizione davanti al **protocollo**, non davanti al
 * nome: «metti Giulia **a** 18:6». Trovato scrivendo i test del dialogo — Vera rispondeva «su quale
 * cliente?» a una frase che il nome ce l'aveva scritto in mezzo.
 *
 * ⛔ **Sta qui e non nel lettore generale, ed è voluto.** Allargare `nomePersona` alla forma
 * «verbo + Maiuscola» varrebbe per **tutti** gli intenti — divieti, sostituzioni, kcal — e in quelli
 * la parola dopo il verbo è quasi sempre un alimento («Togli Tonno…»). Qui il rischio non c'è,
 * perché questa strada si apre solo quando nella frase c'è già un **protocollo del catalogo** o la
 * parola digiuno: il contesto ha già detto di cosa si parla.
 */
const NOME = "[A-ZÀ-Ý][\\wÀ-ÿ'’]+(?:\\s+[A-ZÀ-Ý][\\wÀ-ÿ'’]+)?";

export function clienteDopoIlVerbo(testo: string): string | null {
  /**
   * ⛔ **La maiuscola vale per il VERBO, non per il nome.** «Metti» a inizio frase è normale, e senza
   * questo il ramo non scattava mai sulla forma più comune. Ma mettere il flag `i` su tutta
   * l'espressione renderebbe insensibile anche il `NOME` — e allora «metti **il digiuno** a 18:6»
   * darebbe la cliente «il digiuno». La maiuscola del nome è **l'unico segnale** che distingue una
   * persona da una parola qualunque: si allenta il verbo, una lettera per volta, e si lascia stare
   * il resto. È la stessa scelta, con la stessa ragione, del riquadro su `nomePersona`.
   */
  const verbi = VERBO_DI_COMANDO.source
    .replace(/\\b/g, '')
    // ⚠️ Anche dopo la parentesi aperta, non solo dopo `|`: il primo verbo dell'elenco è lì, ed è
    // proprio quello della frase più comune («metti»). Trovato dal test, non dalla lettura.
    .replace(/(^|[(|])([a-zà-ù])/g, (_m, sep: string, c: string) => `${sep}[${c}${c.toUpperCase()}]`);
  /** «metti **Giulia** a 18:6» — il nome attaccato al verbo. */
  const dopoVerbo = new RegExp(`(?:^|[\\s,;.])(?:${verbi.replace(/\(/g, '(?:')})\\s+(${NOME})`, 'u').exec(testo);
  if (dopoVerbo) return dopoVerbo[1].trim();
  /**
   * «il digiuno **di Giulia**» — il possessivo. ⚠️ Anche questo sta qui e non nel lettore generale:
   * là «di» aprirebbe su «il pane **di** segale» e «la crema **di** zucca», che sono alimenti. Qui
   * la frase ha già detto che si parla di digiuno, quindi «di X» è una persona.
   */
  const possessivo = new RegExp(`\\b(?:di|della|del)\\s+(${NOME})`, 'u').exec(testo);
  return possessivo ? possessivo[1].trim() : null;
}

/** Le ore di digiuno di un protocollo, per scriverlo in chiaro: `16:8` → «16 ore di digiuno». */
export function inChiaro(valore: string): string {
  const p = protocolloDigiuno(valore);
  if (!p) return valore;
  return `${valore} (${p.nome}: ${24 - p.oreFinestra} ore di digiuno, ${p.oreFinestra} di finestra)`;
}
