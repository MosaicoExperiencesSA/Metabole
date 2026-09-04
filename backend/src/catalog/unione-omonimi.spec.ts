import {
  alimenti,
  firmaFattori,
  membersDiPartenza,
  noteUnite,
  operazioniDiUnione,
  pianiDiUnione,
  type Gruppo,
} from './gruppi-omonimi';

/**
 * ⛔ **L'UNIONE VERA DEI GRUPPI OMONIMI** — decisione di Simone del 4/9: *«i gruppi non devono
 * essere legati alle diete, sono gruppi e stop»*, e lo stato del gruppo unito è **approvato se
 * almeno uno lo era**.
 *
 * ⚠️ Qui si prova il **piano**, non la scrittura: `pianiDiUnione` è puro e non tocca il database.
 * È il punto in cui si decide cosa succede a 2848 righe, e una decisione così non sta dentro uno
 * script di `prisma/` che nessun test guarda.
 */
const g = (o: Partial<Gruppo> & { id: string; name: string }): Gruppo => ({
  productId: null,
  status: 'draft',
  members: { items: [] },
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...o,
});

const il = (giorno: number) => new Date(`2026-01-${String(giorno).padStart(2, '0')}T00:00:00Z`);

describe('pianiDiUnione', () => {
  it('un nome che compare una volta sola non produce nessun piano', () => {
    expect(pianiDiUnione([g({ id: 'a', name: 'Carni bianche', members: { items: ['pollo'] } })])).toEqual([]);
  });

  /**
   * ⚠️ Il capofila è il **più vecchio** perché è quello che oggi vince nella ricerca per nome:
   * l'unione deve arricchire lui, o sposta il comportamento invece di sistemarlo.
   */
  it('tiene il più vecchio e unisce gli elenchi, prima scrittura vince', () => {
    const [p] = pianiDiUnione([
      g({ id: 'nuovo', name: 'Carni bianche', createdAt: il(9), members: { items: ['Pollo', 'coniglio'] } }),
      g({ id: 'vecchio', name: 'carni  bianche', createdAt: il(2), members: { items: ['pollo', 'tacchino'] } }),
    ]);
    expect(p.capofilaId).toBe('vecchio');
    expect(p.nome).toBe('carni  bianche');
    expect(p.daCancellare).toEqual(['nuovo']);
    expect(p.items).toEqual(['pollo', 'tacchino', 'coniglio']);
    expect(p.aggiunti).toBe(1);
  });

  /** ⛔ La decisione di Simone, per iscritto: basta UN approvato perché il gruppo unito lo sia. */
  it('approvato se almeno uno lo era', () => {
    const [p] = pianiDiUnione([
      g({ id: 'a', name: 'Pesci bianchi', createdAt: il(1), status: 'draft', members: { items: ['merluzzo'] } }),
      g({ id: 'b', name: 'Pesci bianchi', createdAt: il(2), status: 'approved', members: { items: ['orata'] } }),
    ]);
    expect(p.status).toBe('approved');
  });

  /**
   * ⚠️ Il confine che la decisione NON copriva, e che vale la prova più di tutte: se nessuno era
   * approvato resta bozza. Approvare d'ufficio migliaia di gruppi che nessuno ha aperto sarebbe
   * un'altra cosa, e non l'ha chiesta nessuno.
   */
  it('se nessuno era approvato resta in bozza', () => {
    const [p] = pianiDiUnione([
      g({ id: 'a', name: 'Legumi', createdAt: il(1), members: { items: ['ceci'] } }),
      g({ id: 'b', name: 'Legumi', createdAt: il(2), members: { items: ['lenticchie'] } }),
    ]);
    expect(p.status).toBe('draft');
  });

  /**
   * ⛔ Due tabelle di pesi diverse FERMANO la famiglia: sceglierne una a caso metterebbe dei grammi
   * non decisi da nessuno nel piatto di una persona.
   */
  it('si ferma quando i pesi non coincidono', () => {
    const [p] = pianiDiUnione([
      g({ id: 'a', name: 'Grassi', createdAt: il(1), members: { items: ['burro'], fattori: { riferimento: 'olio', pesi: { burro: 120 } } } }),
      g({ id: 'b', name: 'Grassi', createdAt: il(2), members: { items: ['burro'], fattori: { riferimento: 'olio', pesi: { burro: 90 } } } }),
    ]);
    expect(p.fermata).toHaveLength(1);
    expect(p.fermata[0]).toContain('tabelle di pesi diverse');
  });

  /** ⚠️ Ma due tabelle **uguali** scritte in ordine diverso sono la stessa tabella: non fermano niente. */
  it('non si ferma se le tabelle dei pesi sono la stessa cosa scritta in ordine diverso', () => {
    const [p] = pianiDiUnione([
      g({ id: 'a', name: 'Grassi', createdAt: il(1), members: { items: ['burro'], fattori: { riferimento: 'olio', pesi: { burro: 120, panna: 285 }, fonte: 'CREA' } } }),
      g({ id: 'b', name: 'Grassi', createdAt: il(2), members: { items: ['panna'], fattori: { riferimento: 'Olio', pesi: { panna: 285, burro: 120 }, fonte: 'crea' } } }),
    ]);
    expect(p.fermata).toEqual([]);
    expect(p.fattori).toEqual({ riferimento: 'olio', pesi: { burro: 120, panna: 285 }, fonte: 'CREA' });
  });

  /** I pesi dell'unico che li aveva sopravvivono all'unione, anche se non è il capofila. */
  it('porta dentro i pesi dell\'unico gruppo che li aveva', () => {
    const [p] = pianiDiUnione([
      g({ id: 'a', name: 'Grassi', createdAt: il(1), members: { items: ['olio'] } }),
      g({ id: 'b', name: 'Grassi', createdAt: il(2), members: { items: ['burro'], fattori: { riferimento: 'olio', pesi: { burro: 120 } } } }),
    ]);
    expect(p.capofilaId).toBe('a');
    expect(p.fattori).toEqual({ riferimento: 'olio', pesi: { burro: 120 } });
  });

  /**
   * ⛔ La normalizzazione si ferma dove deve: «Bevande vegetali» e «Bevande vegetali non zuccherate»
   * restano DUE gruppi. Il secondo esiste apposta, e chi non può avere zuccheri aggiunti si
   * vedrebbe le zuccherate come equivalenti.
   */
  it('non unisce due nomi che sono due gruppi diversi', () => {
    expect(pianiDiUnione([
      g({ id: 'a', name: 'Bevande vegetali', members: { items: ['soia'] } }),
      g({ id: 'b', name: 'Bevande vegetali non zuccherate', members: { items: ['soia non zuccherata'] } }),
    ])).toEqual([]);
  });
});

describe('noteUnite', () => {
  it('tiene le note distinte e butta i doppioni e i vuoti', () => {
    expect(noteUnite(['da Anna', '', 'da Anna', 'da Bea'])).toBe('da Anna · da Bea');
  });

  it('senza note non scrive niente', () => {
    expect(noteUnite(['', '   '])).toBeUndefined();
  });

  /**
   * ⛔ Quello che non entra nei 300 caratteri dell'editor si **conta**, non sparisce in silenzio:
   * una nota è la provenienza, cioè l'unica cosa che fra sei mesi dice perché quella regola esiste.
   */
  it('quando le note non ci stanno, dice quante ne restano fuori', () => {
    const unita = noteUnite(Array.from({ length: 12 }, (_, i) => `Da una sostituzione concordata con la cliente numero ${i} e validata in tabella sostituzioni.`))!;
    expect(unita.length).toBeLessThanOrEqual(300);
    expect(unita).toMatch(/\(\+\d+ note più vecchie, nel log dell'unione\)/);
  });
});

describe('firmaFattori', () => {
  it('una tabella assente o vuota non ha firma', () => {
    expect(firmaFattori({ items: ['a'] })).toBe('');
    expect(firmaFattori({ items: ['a'], fattori: { riferimento: 'olio', pesi: {} } })).toBe('');
    expect(firmaFattori(null)).toBe('');
  });

  it('la fonte non entra nella firma: due tabelle uguali con fonti scritte diverse sono la stessa', () => {
    const a = firmaFattori({ fattori: { riferimento: 'olio', pesi: { burro: 120 }, fonte: 'CREA' } });
    const b = firmaFattori({ fattori: { riferimento: 'olio', pesi: { burro: 120 }, fonte: 'USDA' } });
    expect(a).toBe(b);
  });
});

/**
 * ⛔ **LA METÀ CHE SCRIVE** — rilievo della revisione del 4/9: `pianiDiUnione` era provato, ma
 * l'ordine delle tre scritture su 2848 righe di produzione stava dentro uno script di `prisma/` che
 * nessun test guardava. Adesso è una funzione pura, e queste sono le sue prove.
 */
describe('operazioniDiUnione', () => {
  const piano = pianiDiUnione([
    g({ id: 'vecchio', name: 'Carni bianche', createdAt: il(1), status: 'approved', members: { items: ['pollo'], note: 'da Anna', fattori: { riferimento: 'olio', pesi: { burro: 120 } } } }),
    g({ id: 'nuovo', name: 'Carni bianche', createdAt: il(5), members: { items: ['coniglio'] } }),
  ])[0];

  it('ripunta le righe delle sostituzioni al capofila PRIMA di cancellare', () => {
    const ops = operazioniDiUnione(piano, { items: ['pollo'] });
    expect(ops.ripunta).toEqual({ da: ['nuovo'], a: 'vecchio' });
    expect(ops.cancella).toEqual(['nuovo']);
  });

  it('il capofila diventa globale, con l\'elenco unito e lo stato deciso', () => {
    const ops = operazioniDiUnione(piano, { items: ['pollo'] });
    expect(ops.aggiorna.id).toBe('vecchio');
    expect(ops.aggiorna.productId).toBeNull();
    expect(ops.aggiorna.status).toBe('approved');
    expect(ops.aggiorna.members.items).toEqual(['pollo', 'coniglio']);
  });

  /**
   * ⛔ La prova che morde: quello che c'era dentro `members` e che il piano non conosce — qui una
   * chiave inventata — non si perde. È il difetto con cui il 25/8 si stava per cancellare la
   * tabella dei grassi di Nocanty.
   */
  it('⛔ non butta via le chiavi di `members` che il piano non conosce', () => {
    const ops = operazioniDiUnione(piano, { items: ['pollo'], qualcosaDiFuturo: { a: 1 } });
    expect(ops.aggiorna.members.qualcosaDiFuturo).toEqual({ a: 1 });
    expect(ops.aggiorna.members.note).toBe('da Anna');
    expect(ops.aggiorna.members.fattori).toEqual({ riferimento: 'olio', pesi: { burro: 120 } });
  });

  /**
   * ⛔ **`members` può essere un ARRAY**: la colonna ha `@default("[]")`. `{ ...['ceci'] }` darebbe
   * `{ '0': 'ceci' }`, cioè un `members` malformato scritto sopra un gruppo vero.
   */
  it('⛔ da un `members` che è un array riparte da zero, invece di scrivere chiavi numeriche', () => {
    const ops = operazioniDiUnione(piano, ['ceci', 'lenticchie']);
    expect(ops.aggiorna.members['0']).toBeUndefined();
    expect(ops.aggiorna.members.items).toEqual(['pollo', 'coniglio']);
  });

  it('e `membersDiPartenza` dice la stessa cosa su null, stringhe e numeri', () => {
    for (const x of [null, undefined, 'boh', 7, ['a']]) expect(membersDiPartenza(x)).toEqual({});
    expect(membersDiPartenza({ note: 'x' })).toEqual({ note: 'x' });
  });
});

/** ⚠️ E la forma vecchia — una lista di stringhe — si legge invece di sparire. */
describe('alimenti', () => {
  it('legge sia `{ items: [...] }` sia una lista secca', () => {
    expect(alimenti({ items: ['ceci', 'ceci', 'farro'] })).toEqual(['ceci', 'farro']);
    expect(alimenti(['ceci', 'farro'])).toEqual(['ceci', 'farro']);
    expect(alimenti([])).toEqual([]);
    expect(alimenti(null)).toEqual([]);
  });
});
