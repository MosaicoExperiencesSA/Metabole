import { readFileSync } from 'fs';
import { join } from 'path';
import { inOrdineDiPasto, slotDaComporre } from './struttura-della-giornata';

describe('quanti pasti ha la giornata di questa cliente', () => {
  const cinque = new Set(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']);
  const tre = new Set(['breakfast', 'lunch', 'dinner']);

  /**
   * ⛔ **LA PROVA DEL DIFETTO DELL'1/9.** Il paniere è famiglia × regime: dentro ci sono anche le
   * varianti a 5 pasti. Una cliente a 3 non deve vederne 5 perché il suo paniere è grande.
   */
  it('⛔ una cliente a 3 pasti non ne riceve 5 perché il paniere ne contiene 5', () => {
    const slots = slotDaComporre({ strutturaDellaDieta: tre, chiaviDelPool: cinque });
    expect(slots).toEqual(['breakfast', 'lunch', 'dinner']);
  });

  it('e una cliente a 5 li riceve tutti e cinque, in ordine', () => {
    expect(slotDaComporre({ strutturaDellaDieta: cinque, chiaviDelPool: cinque }))
      .toEqual(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']);
  });

  /**
   * ⚠️ Il verso opposto, ed è quello che si dimentica: il paniere può essere più **povero** della
   * struttura. Lo slot resta nell'elenco e arriva alla composizione **vuoto**, così `compose`
   * torna `null` e si ripiega sulla giornata pre-costruita. Se sparisse, la giornata uscirebbe con
   * un pasto in meno e le kcal ridistribuite come se fosse voluto.
   */
  it('⚠️ uno slot che il paniere non copre resta nell\'elenco, non sparisce', () => {
    const slots = slotDaComporre({
      strutturaDellaDieta: cinque,
      chiaviDelPool: new Set(['breakfast', 'lunch']),
    });
    expect(slots).toEqual(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']);
  });

  it('senza struttura si ricade sulle chiavi del pool, cioè sul comportamento di prima', () => {
    expect(slotDaComporre({ chiaviDelPool: tre })).toEqual(['breakfast', 'lunch', 'dinner']);
    expect(slotDaComporre({ strutturaDellaDieta: new Set(), chiaviDelPool: tre }))
      .toEqual(['breakfast', 'lunch', 'dinner']);
  });

  describe('la finestra del digiuno e gli spuntini tolti', () => {
    it('escono prima della composizione, così le kcal si ridistribuiscono', () => {
      const slots = slotDaComporre({
        strutturaDellaDieta: cinque,
        chiaviDelPool: cinque,
        salta: new Set(['breakfast', 'morning_snack']),
      });
      expect(slots).toEqual(['lunch', 'afternoon_snack', 'dinner']);
    });

    /** ⚠️ Rete di sicurezza: meglio un digiuno impreciso che una cliente senza niente da mangiare. */
    it('⚠️ ma se togliessero tutto, il filtro si ignora invece di lasciarla a digiuno', () => {
      const slots = slotDaComporre({
        strutturaDellaDieta: tre,
        chiaviDelPool: tre,
        salta: new Set(['breakfast', 'lunch', 'dinner']),
      });
      expect(slots).toEqual(['breakfast', 'lunch', 'dinner']);
    });
  });
});

describe('inOrdineDiPasto', () => {
  it('rimette i pasti nell\'ordine della giornata, comunque siano arrivati', () => {
    expect(inOrdineDiPasto(['dinner', 'breakfast', 'lunch'])).toEqual(['breakfast', 'lunch', 'dinner']);
  });

  /** ⚠️ Un pasto che non conosciamo va in fondo, non sparisce: se non si vede non lo verifica nessuno. */
  it('⚠️ uno slot sconosciuto finisce in fondo, nell\'ordine in cui è arrivato', () => {
    expect(inOrdineDiPasto(['spuntino_serale', 'dinner', 'tisana', 'breakfast']))
      .toEqual(['breakfast', 'dinner', 'spuntino_serale', 'tisana']);
  });

  it('un elenco vuoto resta vuoto', () => {
    expect(inOrdineDiPasto([])).toEqual([]);
  });
});

/**
 * ⛔ **La correzione vale solo se chi compone la passa davvero.** Il difetto stava in una riga di
 * `menu.service.ts`, e una funzione giusta che nessuno chiama non corregge niente.
 */
describe('la composizione usa la struttura, non le chiavi del pool', () => {
  it('⛔ `dayComboPools` riceve la struttura letta dalle giornate della cliente', () => {
    const src = readFileSync(join(__dirname, 'menu.service.ts'), 'utf8');
    expect(src).toMatch(/const slots = slotDaComporre\(\{ strutturaDellaDieta, chiaviDelPool: ctx\.slotPool\.keys\(\), salta \}\)/);
    expect(src).toMatch(/for \(const t of templates\) for \(const sl of slotPieni\(/);
    expect(src).toMatch(/this\.dayComboPools\(ctxGiorno, slotSaltati, slotDellaStruttura\)/);
  });
});
