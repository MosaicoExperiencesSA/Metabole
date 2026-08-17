/**
 * Le spezie non sono un cibo da escludere.
 *
 * ## Perché esiste questo file
 *
 * Una cliente ha ricevuto lo stesso pranzo per quattro giorni di fila. Non era un difetto del
 * motore: aveva accumulato trenta esclusioni, e fra quelle c'erano **curry** e **cumino**. Una
 * spezia non è un ingrediente in senso proprio — è una pizzicata — ma il motore la tratta come
 * tutti gli altri: cerca la parola nel nome e negli ingredienti e **scarta l'intero piatto**.
 * Il risultato è che "non mi piace il curry" cancella dal ricettario ogni piatto speziato, e il
 * pool si riduce a uno o due piatti che tornano all'infinito.
 *
 * La regola l'ha dettata la nutrizionista:
 *  - **nome di una spezia precisa** (curry, cumino, cannella…) → non entra fra i cibi esclusi, e
 *    rispondiamo «sostituiscila con le spezie che più ti piacciono»: in cucina la spezia la mette
 *    lei, quindi la sostituzione la fa lei, senza togliersi metà del ricettario;
 *  - **"spezie" in generale** → non è una preferenza da registrare al volo ma una conversazione da
 *    fare: «contatta la tua coach per analizzare come utilizzare i menu senza spezie».
 *
 * ## Due limiti che sono voluti
 *
 * 1. **Allergie e intolleranze non passano mai di qui.** Se un termine è un allergene UE
 *    (senape, sesamo, sedano…) la classificazione si ferma: quella è sicurezza, non gusto.
 * 2. **Il confronto è esatto, non per sottostringa.** «noce moscata» è una spezia, «noce» è
 *    frutta a guscio; «pepe» è una spezia, «peperoni» sono una verdura. Cercare per sottostringa
 *    le confonderebbe, ed è esattamente il tipo di errore che qui costa caro.
 *
 * Nest e Prisma non compaiono: gli script di `prisma/` devono poter importare questo file.
 */
import { spezzaTagAlimenti } from '../common/tag-alimenti';


import { EU_ALLERGENS } from '../catalog/allergens';

/** Spezie vere e proprie: si comprano in barattolo e si dosano a pizzichi. */
export const SPEZIE = [
  'pepe', 'pepe di cayenna', 'pepe rosa', 'pepe verde', 'peperoncino', 'peperoncini',
  'paprika', 'paprica', 'curry', 'curcuma', 'cumino', 'coriandolo', 'cannella',
  'chiodi di garofano', 'chiodo di garofano', 'noce moscata', 'macis', 'zafferano',
  'zenzero', 'anice', 'anice stellato', 'cardamomo', 'ginepro', 'bacche di ginepro',
  'sommacco', 'garam masala', 'harissa', 'wasabi', 'pimento', 'vaniglia',
  'semi di finocchio', 'piccante', 'cibi piccanti', 'peperoncino di cayenna',
];

/**
 * Erbe aromatiche. Stanno insieme alle spezie perché hanno lo stesso ruolo nel piatto e la
 * stessa soluzione (si cambiano in cucina), ma restano un elenco a parte: se un domani la
 * nutrizionista decide che il basilico è un'altra cosa, si toglie una riga.
 */
export const ERBE_AROMATICHE = [
  'basilico', 'prezzemolo', 'origano', 'rosmarino', 'salvia', 'timo', 'maggiorana',
  'alloro', 'menta', 'aneto', 'erba cipollina', 'dragoncello', 'santoreggia',
  'finocchietto', 'mirto', 'erbe di provenza', 'erbette aromatiche',
];

/** Modi di dire "le spezie" senza nominarne nessuna: qui la risposta è un'altra. */
export const SPEZIE_GENERICHE = [
  'spezie', 'spezia', 'le spezie', 'spezie varie', 'spezie in generale', 'tutte le spezie',
  'nessuna spezia', 'senza spezie', 'aromi', 'aromi vari', 'erbe aromatiche', 'aromatiche',
  'spezie forti', 'spezie in polvere', 'condimenti speziati',
];

const SPECIFICHE = new Set([...SPEZIE, ...ERBE_AROMATICHE]);
const GENERICHE = new Set(SPEZIE_GENERICHE);

/**
 * Termini che NON possono mai essere classificati come spezia, anche se ci somigliano: sono
 * allergeni UE (o loro parole chiave). Un'allergia alla senape deve restare un'esclusione vera.
 */
const MAI_SPEZIA = new Set<string>(
  EU_ALLERGENS.flatMap((a) => [a.code.replace(/_/g, ' '), ...a.keywords]).map((s) => s.trim()),
);

/** Parole che accompagnano la spezia senza cambiarla: si tolgono dalla coda prima di cercare. */
const CONTORNO = [
  'nero', 'nera', 'neri', 'nere', 'bianco', 'bianca', 'bianchi', 'bianche', 'verde', 'verdi',
  'rosso', 'rossa', 'rossi', 'rosse', 'rosa', 'dolce', 'dolci', 'forte', 'forti',
  'macinato', 'macinata', 'macinati', 'macinate', 'in polvere', 'polvere', 'fresco', 'fresca',
  'freschi', 'fresche', 'secco', 'secca', 'secchi', 'secche', 'essiccato', 'essiccata',
  // «piccante» è anche un termine a sé (vedi SPEZIE): il confronto sulla stringa intera avviene
  // PRIMA della riduzione, quindi «piccante» da solo continua a essere riconosciuto.
  'tritato', 'tritata', 'tritati', 'tritate', 'piccante', 'piccanti', 'varie', 'vari',
];

/** Articoli e preposizioni iniziali: «il curry» e «curry» sono la stessa cosa. */
const TESTA = /^(il|lo|la|i|gli|le|l|un|uno|una|del|della|dei|delle|degli|di|dal|con|senza)\s+/;

function normalizza(raw: string): string {
  let t = (raw ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // via gli accenti
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let prima = '';
  while (t !== prima) {
    prima = t;
    t = t.replace(TESTA, '').trim();
  }
  return t;
}

/** Toglie una parola di contorno dalla coda, ma solo se resta qualcosa da cercare. */
function senzaContorno(t: string): string {
  let out = t;
  let prima = '';
  while (out !== prima) {
    prima = out;
    for (const c of CONTORNO) {
      if (out.endsWith(` ${c}`)) {
        const ridotto = out.slice(0, -(c.length + 1)).trim();
        if (ridotto) out = ridotto;
        break;
      }
    }
  }
  return out;
}

export type TipoSpezia = 'nessuna' | 'specifica' | 'generica';

export interface EsitoSpezia {
  tipo: TipoSpezia;
  /** Il termine come l'ha scritto la cliente, ripulito dagli spazi. Serve per il messaggio. */
  termine: string;
  /** Titolo del pop-up. Vuoto se `tipo` è `nessuna`. */
  titolo: string;
  /** Testo del pop-up, nelle parole della nutrizionista. Vuoto se `tipo` è `nessuna`. */
  testo: string;
}

const NESSUNA = (termine: string): EsitoSpezia => ({ tipo: 'nessuna', termine, titolo: '', testo: '' });

/**
 * Classifica un cibo che la cliente vuole togliere dai menu.
 * Restituisce `nessuna` per tutto ciò che è cibo vero: il chiamante prosegue come sempre.
 */
export function classificaSpezia(raw: string): EsitoSpezia {
  const termine = (raw ?? '').trim();
  const t = normalizza(termine);
  if (!t) return NESSUNA(termine);
  if (MAI_SPEZIA.has(t)) return NESSUNA(termine); // allergeni: mai toccati

  const ridotto = senzaContorno(t);
  if (MAI_SPEZIA.has(ridotto)) return NESSUNA(termine);

  if (GENERICHE.has(t) || GENERICHE.has(ridotto)) {
    return {
      tipo: 'generica',
      termine,
      titolo: 'Le spezie: sentiamo la tua coach',
      testo:
        'Contatta la tua coach per analizzare come utilizzare i menu senza spezie. ' +
        'Togliere tutte le spezie in blocco ridurrebbe di molto i piatti disponibili: ' +
        'meglio decidere insieme come farlo.',
    };
  }

  if (SPECIFICHE.has(t) || SPECIFICHE.has(ridotto)) {
    return {
      tipo: 'specifica',
      termine,
      titolo: `«${termine}»: puoi cambiarla tu`,
      testo:
        'Sostituiscila con le spezie che più ti piacciono. ' +
        'La spezia la aggiungi tu in cucina, quindi non la togliamo dai menu: ' +
        'se la escludessimo sparirebbero anche tutti i piatti che la contengono, ' +
        'e avresti molte meno ricette fra cui scegliere.',
    };
  }

  return NESSUNA(termine);
}

/** Scorciatoia: vero se il termine non deve entrare fra i cibi esclusi. */
export function eUnaSpezia(raw: string): boolean {
  return classificaSpezia(raw).tipo !== 'nessuna';
}

/**
 * Filtra una lista di cibi esclusi: restituisce quelli da salvare davvero e gli avvisi da
 * mostrare per quelli scartati (uno per termine, senza ripetere lo stesso avviso generico).
 */
export function filtraSpezie(termini: (string | null | undefined)[]): {
  tenuti: string[];
  avvisi: EsitoSpezia[];
} {
  const tenuti: string[] = [];
  const avvisi: EsitoSpezia[] = [];
  let genericaGiaDetta = false;
  /**
   * ⚠️ PRIMA SI SPEZZANO LE VOCI CHE CONTENGONO PIÙ ALIMENTI — caso Jolanda Todde, 17/8.
   *
   * Il campo è a tag, una voce per alimento, ma in scheda le è arrivata una voce sola:
   * `"Carne .ceci"`. Da lì in poi non escludeva più niente, perché quella stringa non compare in
   * nessun piatto. Il lato lettura ormai la recupera (`expandExclusion` prova a spezzare un termine
   * che non riconosce); qui si evita di scriverla storta, ed è anche il punto in cui **il controllo
   * sulle spezie comincia a vedere le voci di dentro**: su «pepe, ceci» prima non scattava, perché
   * classificava la stringa intera.
   */
  for (const raw of spezzaTagAlimenti(termini)) {
    const v = (raw ?? '').trim();
    if (!v) continue;
    const esito = classificaSpezia(v);
    if (esito.tipo === 'nessuna') {
      tenuti.push(v);
      continue;
    }
    if (esito.tipo === 'generica') {
      if (genericaGiaDetta) continue;
      genericaGiaDetta = true;
    }
    avvisi.push(esito);
  }
  return { tenuti, avvisi };
}
