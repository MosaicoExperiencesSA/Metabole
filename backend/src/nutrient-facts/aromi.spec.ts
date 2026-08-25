import { eAroma } from './aromi';
import { NutrientFactsController } from './nutrient-facts.controller';
import { passoFinto } from './passo-notturno.finto';

describe('gli aromi: quello che in una ricetta pesa zero', () => {
  it('i nomi veri dell\'elenco in produzione', () => {
    for (const n of ['aglio', 'sale', 'sale e pepe', 'pepe nero', 'sale marino', 'acqua',
      'prezzemolo fresco', 'basilico fresco', 'timo fresco', 'cannella', 'succo di limone',
      'limone succo', 'scorza di limone', 'noce moscata', 'lievito in polvere']) {
      expect([n, eAroma(n)]).toEqual([n, true]);
    }
  });

  /**
   * ⛔ LA PARTE CHE CONTA. Dire «è un aroma» vuol dire dire «le sue calorie non contano»: questi
   * hanno una grammatura vera, e toglierli dall'elenco li farebbe sparire senza che nessuno li
   * rimetta — il passo notturno non riapre una riga chiusa a mano.
   */
  it('⚠️ la cipolla NON è un aroma: 40 kcal/100 g, e in una ricetta ce ne va un etto', () => {
    expect(eAroma('cipolla')).toBe(false);
    expect(eAroma('cipolla rossa')).toBe(false);
  });

  /**
   * ⛔ IL DIFETTO CHE HA FATTO RIFARE L'ELENCO POCHE ORE DOPO AVERLO SCRITTO.
   *
   * La prima versione aveva `limone` fra le parole-aroma, messo lì per far funzionare «succo di
   * limone». Risultato: `eAroma('limone')` → **true**, e il limone (3146 ricette, un frutto da 11
   * kcal) sarebbe uscito **per sempre** dall'elenco di lavoro al primo «Togli questi N» — il passo
   * notturno non riapre una riga chiusa a mano.
   *
   * ⚠️ *Una parola aggiunta per far passare un caso ne fa passare cento.* Adesso nessun nome di
   * alimento sta fra le parole, e i nomi composti si scrivono per intero.
   */
  it('⚠️ nessun NOME DI ALIMENTO passa come parola-aroma', () => {
    for (const n of ['limone', 'lime', 'noce', 'aceto', 'aceto balsamico', 'lievito']) {
      expect([n, eAroma(n)]).toEqual([n, false]);
    }
  });

  /** ⚠️ E i frammenti di nome nemmeno: «succo» di cosa? «scorza» di cosa? */
  it('⚠️ un frammento di nome non è un aroma', () => {
    for (const n of ['succo', 'scorza', 'buccia', 'estratto', 'spicchio', 'erba', 'chiodi']) {
      expect([n, eAroma(n)]).toEqual([n, false]);
    }
  });

  /** ✅ Ma i nomi INTERI che sono davvero aromi continuano a passare, scritti per esteso. */
  it('i nomi composti che sono aromi si scrivono per intero, e passano', () => {
    for (const n of ['succo di limone', 'scorza di limone', 'noce moscata', 'lievito in polvere',
      'estratto di vaniglia', 'erba cipollina', 'chiodi di garofano', 'spicchio di aglio']) {
      expect([n, eAroma(n)]).toEqual([n, true]);
    }
  });

  it('⚠️ nemmeno il brodo, il sedano e la carota', () => {
    expect(eAroma('brodo vegetale')).toBe(false);
    expect(eAroma('sedano')).toBe(false);
    expect(eAroma('carota')).toBe(false);
  });

  /**
   * ⚠️ TUTTE le parole devono essere conosciute, non basta che una sia un aroma: altrimenti
   * passerebbero i piatti veri che contengono la parola «sale» o «limone».
   */
  it('⚠️ un piatto che CONTIENE un aroma non è un aroma', () => {
    expect(eAroma('pollo al limone')).toBe(false);
    expect(eAroma('riso al curry')).toBe(false);
    expect(eAroma('olio e sale')).toBe(false);
    expect(eAroma('patate al rosmarino')).toBe(false);
  });

  /** ⛔ E «succo» da solo non basta: serve che ci sia anche un aroma vero fra le parole. */
  it('⚠️ «succo di mela» non è un aroma, «succo di limone» sì', () => {
    expect(eAroma('succo di mela')).toBe(false);
    expect(eAroma('succo di limone')).toBe(true);
  });

  /**
   * ⚠️ IL CASO CHE HA BOCCIATO LA PRIMA VERSIONE, e sarebbe passato per una lettera.
   *
   * Avevo messo `mele`, `vino` e `riso` fra le parole innocue, per «aceto di mele» e «aceto di
   * riso». ⛔ Così «riso al curry» diventava un aroma (riso innocuo + curry aroma) e «succo di
   * **mele**» pure — mentre «succo di **mela**», al singolare, no. Due piatti veri tolti
   * dall'elenco per una `e` finale.
   *
   * Adesso nessun nome di alimento sta fra le parole innocue, e gli aceti aromatizzati restano in
   * elenco: li guarda una persona.
   */
  it('⚠️ nessun nome di alimento passa come «parola innocua»', () => {
    expect(eAroma('succo di mele')).toBe(false);
    expect(eAroma('riso al curry')).toBe(false);
    expect(eAroma('aceto di mele')).toBe(false);
  });

  /**
   * ⚠️ CI VUOLE ALMENO UN AROMA VERO — trovato con una mutazione: togliendo questa condizione
   * restavano tutti e dieci i test verdi.
   *
   * Un nome fatto **solo** di parole di contorno («tritato fresco», «q.b.», «foglie») non è un
   * aroma: è un pezzo di nome, o un errore di scrittura nella ricetta. ⛔ Toglierlo dall'elenco
   * come se fosse sale vorrebbe dire buttare via l'unico posto in cui quel nome storto si vede —
   * e i nomi storti nelle ricette sono esattamente quello che questa lista serve a scoprire.
   */
  it('⚠️ un nome fatto SOLO di parole di contorno non è un aroma', () => {
    expect(eAroma('tritato fresco')).toBe(false);
    expect(eAroma('qb')).toBe(false);
    expect(eAroma('nero macinato')).toBe(false);
    expect(eAroma('foglie')).toBe(false);
  });

  it('il vuoto non è niente', () => {
    expect(eAroma('')).toBe(false);
    expect(eAroma('   ')).toBe(false);
  });
});


/**
 * ⚠️ **QUELLO CHE SI APPROVA È QUELLO CHE SUCCEDE.** Il pulsante manda gli id che l'operatrice ha
 * visto, ma il server ricontrolla ognuno contro l'elenco chiuso.
 *
 * ⛔ Fidarsi degli id e basta vorrebbe dire che una pagina rimasta aperta da ieri — o un bottone
 * sbagliato — può togliere dall'elenco un alimento vero, e nessuno lo rimette: il passo notturno
 * non riapre una riga chiusa a mano.
 */
describe('togliere gli aromi in blocco', () => {
  const crea = (righe: { id: string; term: string }[]) => {
    const prisma: any = {
      nutrientLookupMiss: {
        findMany: jest.fn().mockResolvedValue(righe),
        updateMany: jest.fn().mockResolvedValue({ count: righe.length }),
      },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    return { prisma, audit, controller: new NutrientFactsController(prisma, audit as never, passoFinto() as never) };
  };

  it('toglie gli aromi e lo scrive nel registro coi termini, non col numero', async () => {
    const { prisma, audit, controller } = crea([
      { id: 'a', term: 'sale' },
      { id: 'b', term: 'pepe nero' },
    ]);
    const esito = await controller.togliAromi({ ids: ['a', 'b'] }, { sub: 'u1' } as never);
    expect(esito).toEqual({ tolti: 2, saltati: 0 });
    expect(prisma.nutrientLookupMiss.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ignored' } }),
    );
    expect(audit.log.mock.calls[0][0].metadata.termini).toEqual(['sale', 'pepe nero']);
  });

  it('⚠️ un id che NON è un aroma non si tocca, nemmeno se la pagina lo chiede', async () => {
    const { prisma, controller } = crea([
      { id: 'a', term: 'sale' },
      { id: 'b', term: 'cipolla' },
    ]);
    const esito = await controller.togliAromi({ ids: ['a', 'b'] }, { sub: 'u1' } as never);
    expect(esito).toEqual({ tolti: 1, saltati: 1 });
    expect(prisma.nutrientLookupMiss.updateMany.mock.calls[0][0].where.id.in).toEqual(['a']);
  });

  it('senza id non scrive niente', async () => {
    const { prisma, controller } = crea([]);
    expect(await controller.togliAromi({ ids: [] }, { sub: 'u1' } as never)).toEqual({ tolti: 0, saltati: 0 });
    expect(prisma.nutrientLookupMiss.updateMany).not.toHaveBeenCalled();
  });
});
