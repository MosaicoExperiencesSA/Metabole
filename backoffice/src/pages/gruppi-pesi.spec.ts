/**
 * ⛔ **I PESI DEI GRASSI SI SCRIVONO E SI RILEGGONO UGUALI.**
 *
 * La casella degli alimenti accetta `burro = 120` accanto ai nomi semplici. È il posto dove il
 * lavoro di Nocanty si può perdere in silenzio: se il verso di lettura e quello di scrittura non
 * combaciano, riaprendo il gruppo per cambiare una nota i numeri sparirebbero — e nessuno se ne
 * accorgerebbe finché Gaia non ricomincia a proporre i cambi a pari grammatura.
 */
import { describe, expect, it } from 'vitest';
import { leggiRighe, scriviRighe, stoPerCancellareIPesi, NOME_GRUPPO_GRASSI, stoPerRinominareIGrassi } from './GruppiEquivalenza';

describe('⛔ la casella degli alimenti con i pesi', () => {
  it('un nome senza uguale resta un alimento senza peso', () => {
    expect(leggiRighe('salmone\naringa')).toEqual({ items: ['salmone', 'aringa'], pesi: {} });
  });

  it('⛔ «burro = 120» è un alimento CON il peso', () => {
    expect(leggiRighe('burro = 120')).toEqual({ items: ['burro'], pesi: { burro: 120 } });
  });

  it('⚠️ i due si mescolano nella stessa casella: è il caso vero', () => {
    const { items, pesi } = leggiRighe('olio evo = 100\nburro = 120\nstrutto');
    expect(items).toEqual(['olio evo', 'burro', 'strutto']);
    expect(pesi).toEqual({ 'olio evo': 100, burro: 120 });
  });

  /** ⚠️ Su una tastiera italiana il decimale si batte con la virgola. */
  it('⚠️ la virgola decimale si accetta', () => {
    expect(leggiRighe('panna = 285,5').pesi).toEqual({ panna: 285.5 });
  });

  /**
   * ⛔ Un peso illeggibile **non diventa zero**: `Number('')` è 0, e un peso a zero farebbe una
   * divisione per zero dentro la conversione. L'alimento resta, il numero no.
   */
  it('⛔ un peso illeggibile lascia l’alimento e butta il numero', () => {
    expect(leggiRighe('burro = boh')).toEqual({ items: ['burro'], pesi: {} });
    expect(leggiRighe('burro = 0')).toEqual({ items: ['burro'], pesi: {} });
    expect(leggiRighe('burro = -5')).toEqual({ items: ['burro'], pesi: {} });
  });

  it('⚠️ le righe vuote e gli spazi non diventano alimenti', () => {
    expect(leggiRighe('  \n burro = 120 \n\n')).toEqual({ items: ['burro'], pesi: { burro: 120 } });
  });

  it('⚠️ un uguale senza nome davanti si ignora invece di creare un alimento vuoto', () => {
    expect(leggiRighe('= 120')).toEqual({ items: [], pesi: {} });
  });

  /**
   * ⛔ **IL GIRO COMPLETO, che è la prova che conta**: scrivo, rileggo, riscrivo — e il testo è lo
   * stesso. Senza questo, riaprire un gruppo per correggere una nota cancellerebbe i pesi.
   */
  it('⛔ scritto e riletto dà lo stesso testo', () => {
    const testo = 'olio evo = 100\nburro = 120\npanna fresca = 285\nstrutto';
    const { items, pesi } = leggiRighe(testo);
    expect(scriviRighe(items, pesi)).toBe(testo);
  });

  it('⚠️ e un gruppo senza nessun peso torna un elenco semplice', () => {
    expect(scriviRighe(['salmone', 'aringa'], {})).toBe('salmone\naringa');
  });
});

/**
 * ⛔ **CANCELLARE UNA TABELLA DI PESI SI FA APPOSTA, NON PER DISTRAZIONE** — revisione, 25/8.
 *
 * Alimenti e pesi stanno nello stesso riquadro di testo, e va bene così (due elenchi da allineare a
 * mano divergono). Ma vuol dire che **incollare** l'elenco degli alimenti da un'altra parte faceva
 * sparire l'intera tabella dei grammi firmata dal capo nutrizionista, con un salvataggio che diceva
 * «Gruppo aggiornato» e niente altro.
 */
describe('⛔ stoPerCancellareIPesi', () => {
  it('⛔ modificando un gruppo che aveva pesi e adesso non ne ha: ci si ferma', () => {
    expect(stoPerCancellareIPesi({ isEdit: true, aveva: 10, adesso: 0, giaConfermato: false })).toBe(true);
  });

  /**
   * ⛔ **E anche quando ne perde UNO SOLO.** Su tredici righe, toglierne dodici passava in silenzio:
   * il danno non è quante righe si perdono, è che una coppia smetta di convertirsi.
   */
  it('⛔ anche perderne uno solo su tredici ferma il salvataggio', () => {
    expect(stoPerCancellareIPesi({ isEdit: true, aveva: 13, adesso: 12, giaConfermato: false })).toBe(true);
  });

  it('⛔ ma il secondo Salva passa: si può ancora fare, va solo detto', () => {
    expect(stoPerCancellareIPesi({ isEdit: true, aveva: 13, adesso: 12, giaConfermato: true })).toBe(false);
  });

  it('⚠️ se i pesi sono gli stessi, o di più, non si ferma niente', () => {
    expect(stoPerCancellareIPesi({ isEdit: true, aveva: 10, adesso: 10, giaConfermato: false })).toBe(false);
    expect(stoPerCancellareIPesi({ isEdit: true, aveva: 10, adesso: 11, giaConfermato: false })).toBe(false);
  });

  it('⚠️ e su un gruppo che non ne aveva, o su uno nuovo, non c’è niente da perdere', () => {
    expect(stoPerCancellareIPesi({ isEdit: true, aveva: 0, adesso: 0, giaConfermato: false })).toBe(false);
    expect(stoPerCancellareIPesi({ isEdit: false, aveva: 10, adesso: 0, giaConfermato: false })).toBe(false);
  });
});

/**
 * ⛔ **I PESI ORFANI SI VEDONO, invece di sparire alla prima matita.**
 *
 * `scriviRighe` confrontava per stringa esatta: un peso la cui chiave non combaciava con un
 * alimento non compariva nella casella, e `leggiRighe` — che ricostruisce i pesi solo da quello che
 * è scritto — lo cancellava al primo salvataggio. Riprodotto in revisione il 25/8.
 */
describe('⛔ scriviRighe — niente si perde per strada', () => {
  it('⛔ un peso senza il suo alimento si scrive lo stesso, in coda', () => {
    expect(scriviRighe(['burro'], { burro: 120, 'panna fresca': 285 })).toBe('burro = 120\npanna fresca = 285');
  });

  it('⛔ e il nome scritto con altre maiuscole trova il suo peso', () => {
    expect(scriviRighe(['Olio EVO'], { 'olio evo': 100 })).toBe('Olio EVO = 100');
  });

  it('⚠️ il caso normale non cambia: alimento con peso, alimento senza', () => {
    expect(scriviRighe(['burro', 'carote'], { burro: 120 })).toBe('burro = 120\ncarote');
  });

  /** ⚠️ E il giro completo regge: quello che si scrive si rilegge uguale. */
  it('⚠️ andata e ritorno su un peso orfano', () => {
    const testo = scriviRighe(['burro'], { burro: 120, 'panna fresca': 285 });
    expect(leggiRighe(testo).pesi).toEqual({ burro: 120, 'panna fresca': 285 });
    expect(leggiRighe(testo).items).toEqual(['burro', 'panna fresca']);
  });
});

/**
 * ⛔ **RINOMINARE IL GRUPPO DEI GRASSI È UN'ALTRA STRADA PER LO STESSO DANNO.**
 *
 * Il codice cerca la tabella per nome. Rinominare fa smettere le conversioni esattamente come
 * cancellare i pesi — ma passava senza una parola, mentre cancellare i numeri chiedeva conferma.
 */
describe('⛔ stoPerRinominareIGrassi', () => {
  const base = { isEdit: true, nomePrima: NOME_GRUPPO_GRASSI, giaConfermato: false };

  it('⛔ rinominare il gruppo dei grassi ferma il salvataggio', () => {
    expect(stoPerRinominareIGrassi({ ...base, nomeDopo: 'Condimenti' })).toBe(true);
  });

  it('⚠️ ma cambiare solo maiuscole e spazi non è un rename', () => {
    expect(stoPerRinominareIGrassi({ ...base, nomeDopo: '  Oli e Grassi da  Condimento ' })).toBe(false);
  });

  it('⛔ il secondo Salva passa', () => {
    expect(stoPerRinominareIGrassi({ ...base, nomeDopo: 'Condimenti', giaConfermato: true })).toBe(false);
  });

  it('⚠️ e su qualunque altro gruppo non si ferma niente', () => {
    expect(stoPerRinominareIGrassi({ ...base, nomePrima: 'Pesci grassi', nomeDopo: 'Pesci' })).toBe(false);
    expect(stoPerRinominareIGrassi({ ...base, isEdit: false, nomeDopo: 'Condimenti' })).toBe(false);
  });
});
