/**
 * ⛔ **IL METODO DI COTTURA, DETTATO A VOCE — e perché è un passo suo.**
 *
 * Simone, 4/9: *«i nuovi poi chiede Vera l'inserimento della ricetta direttamente da lei guidando
 * passo passo: ingredienti, metodo ecc»*. Fino a oggi Vera chiedeva nome, ingredienti, pasto e
 * regime, e scriveva `cookingMethods: []`: la ricetta entrava in catalogo **senza il modo di
 * prepararla**. Nell'app la cliente apre la scheda e trova gli ingredienti e nient'altro.
 *
 * ## ⚠️ Perché NON si legge dentro il testo della ricetta
 *
 * `ricetta-dettata.ts` legge righe come «tonno 120 g»: un elenco di righe corte, dove ogni riga o è
 * un ingrediente o è contorno. Un passaggio di preparazione è **anche lui** una riga corta —
 * «scaldare il forno a 180°» — e infilarlo in quel parser vorrebbe dire o perdere i passaggi, o
 * trasformare un ingrediente in un passaggio. ⛔ La riga sbagliata qui non è un fastidio: è una
 * grammatura che sparisce dal totale su cui il motore calcola le giornate.
 *
 * Perciò il metodo si **chiede a parte**, quando il resto è completo, e ha il suo parser.
 *
 * ## ⚠️ Il MODO viene dalla prima riga, i PASSAGGI da quelle dopo
 *
 * È la forma in cui una persona lo scrive:
 *
 *     al forno
 *     scaldare il forno a 180°
 *     infornare 20 minuti
 *
 * ⛔ E la parola del modo si cerca **solo nella prima riga**. Cercarla in tutto il testo vorrebbe
 * dire che «poi si lascia raffreddare» rende il piatto «freddo», e «rosolare in padella» al passo
 * tre cambia il modo scelto al passo uno. La prima riga è quella in cui si sta rispondendo alla
 * domanda; le altre raccontano.
 *
 * ⚠️ I codici sono quelli di `common/metodi-cottura.ts` e **non se ne inventano**: è la stessa
 * fonte da cui la scheda costruisce la tendina e da cui il prompt del generatore prende l'elenco.
 * Un settimo codice scritto qui sarebbe un metodo che nessuna schermata sa disegnare.
 */
import { CODICI_METODI, METODI_COTTURA } from '../common/metodi-cottura';

export type EsitoMetodo =
  /** Modo e passaggi: si può scrivere. */
  | { tipo: 'metodo'; metodo: { type: string; steps: string[] } }
  /** Ha detto il modo e basta: mancano i passaggi. */
  | { tipo: 'senza_passi'; type: string }
  /** Ha scritto i passaggi ma non il modo: si chiede quale. */
  | { tipo: 'senza_modo'; steps: string[] }
  /** «lascia stare», «non lo so»: si va avanti senza. Vedi `SALTA`. */
  | { tipo: 'salta' }
  | { tipo: 'non_capito' };

/**
 * ⚠️ **I modi di dire ogni codice.** Sono i sinonimi che una persona usa parlando, non le etichette
 * della tendina: chi detta scrive «in padella», non «In padella». Le etichette vere ci sono lo
 * stesso, perché chi copia dalla scheda scrive quelle.
 */
const SINONIMI: Record<string, string[]> = {
  veloce: ['veloce', 'svelto', 'rapido', 'in fretta', 'due minuti'],
  forno: ['forno', 'infornare', 'infornata', 'gratinare', 'gratinato'],
  padella: ['padella', 'saltare in padella', 'saltato', 'rosolare', 'rosolato', 'wok', 'piastra'],
  vapore: ['vapore', 'vaporiera', 'al vapore'],
  meal_prep: ['meal prep', 'meal-prep', 'mealprep', 'preparazione anticipata', 'da preparare prima', 'batch'],
  piatto_freddo: ['piatto freddo', 'freddo', 'senza cottura', 'crudo', 'non si cuoce'],
};

/**
 * ⛔ **Le parole con cui si SALTA il passo — e devono essere TUTTA la risposta.**
 *
 * ⚠️ **Ancorata anche in fondo (`$`), e questa è la correzione del 4/9** (revisione avversariale,
 * prima della consegna). Con l'ancora solo davanti, `\b` bastava a far scattare la rinuncia su
 * qualunque frase italiana che *comincia* con una di queste parole:
 *
 *     «dopo aver lessato la pasta, saltare in padella»  → saltata
 *     «niente cottura, è un piatto freddo»              → saltata
 *
 * ⛔ E il danno non era perdere il metodo: era **dire il contrario**. Vera rispondeva «Va bene, la
 * scrivo senza i passaggi» a chi glieli aveva appena dettati.
 *
 * ⚠️ «senza» da sola non c'è: «senza cottura» è un modo (piatto freddo), non una rinuncia.
 */
const SALTA = /^(?:salta(?:lo|iamo)?|lascia stare|lascialo|niente|nessuno|non serve|non ora|non adesso|dopo|non lo so|non so|boh)[\s.!]*$/;

/** Minuscolo, senza accenti, spazi normalizzati: la stessa normalizzazione di `allergeni-ricetta`. */
function normalizza(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Il codice nominato in questa riga, o `null`.
 *
 * ⚠️ **Vince il sinonimo PIÙ LUNGO**, e non è un dettaglio di stile: «senza cottura» contiene
 * «cottura» e «piatto freddo» contiene «freddo», ma soprattutto la riga «al vapore in padella» —
 * che una persona scrive davvero — deve dare una risposta sola e sempre la stessa. Senza un
 * criterio, la risposta dipenderebbe dall'ordine in cui è scritto questo elenco.
 */
function modoDellaRiga(riga: string): string | null {
  const t = normalizza(riga);
  let vinto: { code: string; parola: string } | null = null;
  for (const code of CODICI_METODI) {
    for (const parola of SINONIMI[code] ?? []) {
      if (t.includes(parola) && (!vinto || parola.length > vinto.parola.length)) vinto = { code, parola };
    }
  }
  /**
   * ⛔ **E la riga dev'essere SOLO il modo.** «scaldare il forno a 180 gradi» nomina il forno ma è
   * un passaggio: leggerlo come modo se lo mangerebbe. Quando resta un dubbio si torna indietro a
   * chiedere — vedi `eSoloIlModo`.
   */
  if (!vinto || !eSoloIlModo(riga, vinto.parola)) return null;
  return vinto.code;
}

/** Via i trattini, i puntini e la numerazione con cui si scrive un elenco. */
const pulisciPasso = (r: string) => r.replace(/^\s*(?:[-•*·–]|\d+[.)])\s*/u, '').trim();

/**
 * ⛔ **LE PAROLE DI SERVIZIO — e servono a distinguere una RISPOSTA da un PASSAGGIO.**
 *
 * «al forno» è la risposta alla domanda; «scaldare il forno a 180 gradi» è il primo passaggio, e
 * contiene la stessa parola. Prendere il modo da entrambe vorrebbe dire **mangiarsi un passaggio**:
 * la riga sparirebbe dall'elenco e nessuno se ne accorgerebbe, perché il campo risulta compilato.
 *
 * ⚠️ Il criterio è che dopo aver tolto la parola del modo e queste, della riga **non resti niente**.
 * Una risposta è corta per natura; un passaggio ha un verbo e dei numeri, e resta.
 */
const PAROLE_DI_SERVIZIO = new Set([
  'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'in', 'a', 'il', 'lo', 'la', 'i', 'gli', 'le',
  'un', 'uno', 'una', 'di', 'da', 'con', 'e', 'si', 'per', 'va', 'vanno', 'poi', 'tutto',
  /**
   * ⚠️ **I verbi del cuocere ci sono, quelli del preparare no** — ed è la riga su cui si regge la
   * distinzione. «lo cuocio al forno» è una risposta; «scaldare il forno a 180 gradi» è un
   * passaggio. Aggiungere qui `scaldare`, `mettere` o `infornare` farebbe sparire un passaggio
   * dall'elenco senza che nessuno se ne accorga, perché il campo risulterebbe compilato.
   */
  'cuocio', 'cuoce', 'cuociamo', 'cuocere', 'cuoci', 'cotto', 'cotta', 'fatto', 'fatta',
  'metodo', 'modo', 'cottura', 'cucina', 'preparazione', 'prep',
  /**
   * ⚠️ **La temperatura e il tempo stanno nella risposta**: «al forno (180 gradi)» è una risposta,
   * non un passaggio. A separarla da «scaldare il forno a 180 gradi» resta il **verbo**, che è
   * l'unica cosa che conta davvero — infatti quest'ultima continua a non passare.
   */
  'gradi', 'grado', 'minuti', 'minuto', 'ore', 'ora', 'c', '°c', '°',
]);

/** ⚠️ Un numero da solo è servizio: «180» in «al forno 180» non è una parola nuova. */
const eNumero = (w: string) => /^\d+$/u.test(w);

/**
 * Vero se questa riga **è** la risposta «come si cuoce», e non un passaggio che nomina la cottura.
 */
function eSoloIlModo(riga: string, parola: string): boolean {
  /**
   * ⚠️ **La punteggiatura non conta**: «Al forno!» e «al forno (180 gradi)» sono risposte, non
   * passaggi. Prima restavano fuori — il punto esclamativo non era una parola di servizio — e
   * finivano fra i passaggi con una domanda in più addosso.
   */
  const resto = normalizza(riga)
    .replace(parola, ' ')
    .split(/[\s,.;:!?()«»"–—-]+/u)
    .map((w) => w.trim())
    .filter(Boolean);
  return resto.every((w) => PAROLE_DI_SERVIZIO.has(w) || eNumero(w));
}

/**
 * Come si prepara questo piatto.
 *
 * ⚠️ **Un passaggio non si inventa mai**: se ha scritto solo il modo, la risposta è `senza_passi` e
 * la domanda torna indietro. Scrivere `steps: []` sarebbe una ricetta che in app mostra un titolo
 * di sezione e sotto il vuoto — peggio di non avere la sezione.
 */
export function leggiMetodo(frase: string): EsitoMetodo {
  const righe = (frase ?? '').split('\n').map((r) => r.trim()).filter(Boolean);
  if (!righe.length) return { tipo: 'non_capito' };
  if (SALTA.test(normalizza(righe[0]))) return { tipo: 'salta' };

  /**
   * ⚠️ **La prima riga può contenere il modo E il primo passaggio**: «al forno: scaldare a 180°» è
   * come si scrive quando si ha fretta. Si separa **sui due punti e solo su quelli** — su una
   * virgola si spezzerebbe «al forno, poi in padella», che è una riga sola (e che infatti non
   * viene letta come un modo: nomina due cotture, e si richiede).
   */
  const duePunti = righe[0].indexOf(':');
  const testa = duePunti >= 0 ? righe[0].slice(0, duePunti) : righe[0];
  const coda = duePunti >= 0 ? pulisciPasso(righe[0].slice(duePunti + 1)) : '';
  const resto = righe.slice(1).map(pulisciPasso).filter((r) => r.length >= 2);

  const type = modoDellaRiga(testa);
  if (type) {
    const steps = [...(coda.length >= 2 ? [coda] : []), ...resto];
    return steps.length ? { tipo: 'metodo', metodo: { type, steps } } : { tipo: 'senza_passi', type };
  }

  /**
   * ⚠️ **«cottura: al vapore»** — la testa è solo un'etichetta e il modo sta dopo i due punti. È
   * come scrive chi copia dalla scheda, e senza questa riga finiva fra i passaggi.
   *
   * ⛔ Vale **solo se la testa non dice niente**: con «scaldare il forno: 180 gradi» la testa è un
   * passaggio, e la coda non deve promuoverla a modo.
   */
  if (coda && eSoloIlModo(testa, '')) {
    const dallaCoda = modoDellaRiga(coda);
    if (dallaCoda) {
      return resto.length
        ? { tipo: 'metodo', metodo: { type: dallaCoda, steps: resto } }
        : { tipo: 'senza_passi', type: dallaCoda };
    }
  }

  /**
   * ⚠️ Nessun modo riconosciuto ma delle righe ci sono: sono passaggi, e manca solo di sapere
   * **come si cuoce**. Sceglierlo noi — «sarà al forno, parla di forno al passo due» — vorrebbe dire
   * indovinare un campo che poi nessuno rilegge.
   */
  const tutte = righe.map(pulisciPasso).filter((r) => r.length >= 2);
  if (tutte.length) return { tipo: 'senza_modo', steps: tutte };
  return { tipo: 'non_capito' };
}

/** L'etichetta leggibile di un codice, per l'anteprima. Ripiego sul codice: non si tace mai. */
export const etichettaDelMetodo = (code: string): string =>
  METODI_COTTURA.find((m) => m.code === code)?.label ?? code;

/** I modi che si possono nominare, come li si dice a voce. Serve alla domanda. */
export const MODI_DA_DIRE = METODI_COTTURA.map((m) => m.label.toLowerCase()).join(', ');
