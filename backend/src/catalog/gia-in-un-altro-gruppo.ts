import { combaciaAlimento } from '../common/nomi-alimento';
import { chiaveNome } from './gruppi-omonimi';

/**
 * «QUESTI CIBI STANNO GIÀ IN UN ALTRO GRUPPO: LI ACCORPO?»
 *
 * Richiesta di Simone, 4/9: *«quando da Vera o da inserimento manuale si aggiunge un gruppo e i
 * cibi contenuti sono già in altri gruppi si chiede se possono essere accorpati»*.
 *
 * ⛔ **È la metà che conta**, e la ragione è aritmetica: unire i 2848 gruppi di oggi è un lavoro che
 * si fa una volta, ma se ogni gruppo nuovo può nascere accanto a uno che dice quasi la stessa cosa,
 * fra sei mesi la pagina è di nuovo com'era. La prima metà pulisce, questa tiene pulito.
 *
 * ## ⚠️ Si CHIEDE, non si accorpa
 *
 * Qui si dice soltanto **quali gruppi somigliano** a quello che sta per nascere. Decidere se sono
 * la stessa cosa è una domanda di nutrizione — «Carni bianche» e «Carni bianche magre» hanno gli
 * stessi tre alimenti e non sono lo stesso gruppo — e la risposta la dà la persona che sta
 * scrivendo, che è una nutrizionista.
 *
 * ## ⛔ Perché la soglia è DUE alimenti in comune, e non uno
 *
 * «Petto di pollo» sta in decine di gruppi. Con la soglia a uno, ogni gruppo nuovo farebbe scattare
 * la domanda, e una domanda che compare sempre è una domanda a cui si risponde «no» senza leggerla
 * — cioè peggio di non farla, perché insegna a ignorarla. Con due, la domanda compare quando c'è
 * davvero una sovrapposizione. ⚠️ Il **nome uguale** è l'eccezione: quello basta da solo, perché è
 * il segnale più forte che esista ed è esattamente quello che ha prodotto i doppioni di oggi.
 */
export const MIN_IN_COMUNE = 2;

/** ⚠️ Tre, non quindici: un elenco di somiglianze lungo è una domanda a cui non si risponde. */
export const MAX_PROPOSTE = 3;

export interface GruppoEsistente {
  id: string;
  name: string;
  status: string;
  items: string[];
}

export type Perche = 'stesso nome' | 'alimenti in comune';

export interface Accorpabile {
  id: string;
  nome: string;
  status: string;
  perche: Perche;
  /**
   * Gli alimenti che questo gruppo ha già, **scritti come stanno nel gruppo**.
   *
   * XXBLOCCO Corretto in revisione, 4/9: prima erano i nomi **proposti**, e siccome il confronto è per
   * parola la schermata scriveva «ha già latte di mandorla» di un gruppo che ha soltanto «latte».
   * Una frase falsa su cui una nutrizionista decide se accorpare.
   */
  inComune: string[];
  /** Quelli che l'accorpamento gli aggiungerebbe. */
  daAggiungere: string[];
  /** Quanti alimenti ha adesso: serve a far vedere in cosa si finirebbe. */
  quantiHa: number;
}

/**
 * Due nomi di alimento indicano la stessa cosa.
 *
 * ⚠️ **Nei due versi**, perché `combaciaAlimento` è asimmetrica: «petto di pollo» contro «pollo»
 * risponde sì, «pollo» contro «petto di pollo» no. Guardarne uno solo vorrebbe dire che la domanda
 * compare o non compare a seconda di quale dei due nomi è stato scritto per primo — cioè per caso.
 */
const stessoAlimento = (a: string, b: string): boolean =>
  combaciaAlimento(a, b) || combaciaAlimento(b, a);

/**
 * I gruppi in cui questi alimenti stanno già, in ordine di quanto somigliano.
 *
 * ⚠️ **C'era un `escludiId`** («il gruppo che si sta modificando non somiglia a sé stesso») e
 * l'ho **tolto in revisione, 4/9**: la domanda si fa solo alla creazione, quindi non lo passava
 * nessuno — né la schermata né Vera. Un parametro dichiarato, provato dai test e letto da nessuno è
 * una promessa che il primo che arriva crede mantenuta. Torna il giorno che serve davvero.
 */
export function accorpabili(
  nome: string,
  items: readonly string[],
  gruppi: readonly GruppoEsistente[],
): Accorpabile[] {
  const proposti = items.map((i) => (i ?? '').trim()).filter(Boolean);
  if (!proposti.length) return [];
  const chiave = chiaveNome(nome ?? '');

  const trovati: Accorpabile[] = [];
  for (const g of gruppi) {
    const suoi = (g.items ?? []).map((i) => (i ?? '').trim()).filter(Boolean);
    const inComune = suoi.filter((x) => proposti.some((p) => stessoAlimento(x, p)));
    const stessoNome = !!chiave && chiaveNome(g.name ?? '') === chiave;
    if (!stessoNome && inComune.length < MIN_IN_COMUNE) continue;
    trovati.push({
      id: g.id,
      nome: g.name,
      status: g.status,
      perche: stessoNome ? 'stesso nome' : 'alimenti in comune',
      inComune,
      // ⚠️ Si ricalcola sui suoi, non per differenza da `inComune`: adesso i due elenchi parlano
      // di due cose diverse (i nomi del gruppo e i nomi proposti) e sottrarli darebbe una lista sbagliata.
      daAggiungere: proposti.filter((p) => !suoi.some((x) => stessoAlimento(x, p))),
      quantiHa: suoi.length,
    });
  }

  /**
   * ⚠️ L'ordine è quello con cui una persona guarderebbe l'elenco: prima il nome uguale, poi chi ha
   * più roba in comune. ⛔ E a parità il nome, non l'`id`: due gruppi identici a parte l'`id`
   * darebbero un ordine diverso a ogni chiamata, e la stessa schermata risponderebbe due cose
   * diverse alla stessa domanda.
   */
  return trovati
    .sort(
      (a, b) =>
        Number(b.perche === 'stesso nome') - Number(a.perche === 'stesso nome') ||
        b.inComune.length - a.inComune.length ||
        a.nome.localeCompare(b.nome),
    )
    .slice(0, MAX_PROPOSTE);
}

/**
 * La frase che Vera dice quando ne ha trovati.
 *
 * ⚠️ Dice **cosa cambia davvero**, e la cosa che cambia di più è lo stato: accorpare dentro un
 * gruppo **approvato** vuol dire che quegli alimenti il motore li può usare dal menu della notte,
 * senza che nessun altro li rilegga. Chi accorpa lo deve sapere prima, non dopo.
 */
export function testoChiediAccorpamento(nome: string, trovati: readonly Accorpabile[]): string {
  const righe = trovati.map((t, i) => {
    const stato = t.status === 'approved' ? 'approvato' : 'in bozza';
    const gia = t.inComune.length ? `ha già ${t.inComune.join(', ')}` : 'stesso nome';
    return `${i + 1}) «${t.nome}» (${stato}, ${t.quantiHa} aliment${t.quantiHa === 1 ? 'o' : 'i'}) — ${gia}` +
      (t.daAggiungere.length ? `; ci aggiungerei ${t.daAggiungere.join(', ')}` : '; non ci aggiungerei niente');
  });
  const approvati = trovati.some((t) => t.status === 'approved');
  return (
    `Prima di scrivere «${nome}»: questi alimenti stanno già in ${trovati.length === 1 ? 'un gruppo' : 'altri gruppi'}.\n\n` +
    `${righe.join('\n')}\n\n` +
    (approvati
      ? '⚠️ Accorpare dentro un gruppo **approvato** vuol dire che il motore può usare quegli alimenti ' +
        'dal prossimo menu, senza che nessun altro li rilegga.\n\n'
      : '') +
    'Rispondi col numero per accorparlo lì, oppure «nuovo» per scrivere un gruppo a parte.'
  );
}
