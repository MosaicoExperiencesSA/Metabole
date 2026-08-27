import { applicaProposta, ordinaPerRischio, Proposta } from './applica-proposta';
import { PrismaService } from '../prisma/prisma.service';
import { aGiorno } from '../common/date-only';

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');

const proposta = (over: Partial<Proposta> = {}): Proposta => ({
  id: 'a1',
  nutrizionistaId: 'lucia',
  azione: 'restrizione_cliente',
  ambito: 'catalogo',
  soggettoId: 'c1',
  soggettoNome: 'Giulia Rossi',
  dettaglio: { termini: ['tonno'] },
  ...over,
});

/** `role: 'nutritionist'` + una scheda staff → `perimetroClienti` filtra sulle SUE clienti. */
const makePrisma = (profili: { userId: string; dislikedFoods: string[] }[], over: Record<string, unknown> = {}) => {
  const update = jest.fn().mockResolvedValue({});
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'nutritionist' }) },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-lucia' }) },
    clientProfile: { findMany: jest.fn().mockResolvedValue(profili), update },
    ...over,
  } as unknown as PrismaService;
  return { prisma, update };
};

describe('applicaProposta — la restrizione estesa', () => {
  it('scrive su tutte le clienti che ne hanno bisogno, e dice quante sono', async () => {
    const { prisma, update } = makePrisma([
      { userId: 'c1', dislikedFoods: [] },
      { userId: 'c2', dislikedFoods: ['pane'] },
    ]);
    const esito = await applicaProposta(prisma, proposta());
    expect(esito.toccate).toBe(2);
    expect(esito.riepilogo).toContain('Applicata a 2 clienti su 2');
    expect(update.mock.calls[1][0].data.dislikedFoods).toEqual(['pane', 'tonno']);
  });

  /**
   * ⚠️ VERA VINCE SEMPRE SU GAIA — decisione di Simone, 18/8, alla domanda «se la nutrizionista
   * detta una spezia, cosa si fa?».
   *
   * Dal pulsante dell'app e dalla scheda una spezia viene scartata: escluderla svuoterebbe il
   * ricettario invece di togliere un piatto. Qui no: chi detta è la professionista che firma le
   * diete. Il pool che si stringe glielo dice l'anteprima **prima** che scriva, quindi sceglie
   * sapendo — che è la differenza fra accettare una conseguenza e non vederla.
   */
  it('⚠️ una SPEZIA dettata dalla nutrizionista si scrive: non passa da `filtraSpezie`', async () => {
    const { prisma, update } = makePrisma([{ userId: 'c1', dislikedFoods: [] }]);
    const esito = await applicaProposta(prisma, proposta({ dettaglio: { termini: ['pepe'] } }));
    expect(esito.toccate).toBe(1);
    expect(update.mock.calls[0][0].data.dislikedFoods).toEqual(['pepe']);
  });

  /**
   * ⚠️ Ma l'ALTRA metà di `filtraSpezie` resta, e non c'entra col permesso: spezzare è correggere
   * la forma di un dato perché continui a funzionare. «pepe, ceci» scritto in una riga sola non
   * compare in nessun piatto e da lì in poi non esclude più niente — e qui il danno si moltiplica
   * per tutte le clienti della coorte.
   */
  it('⚠️ ma una voce con DUE alimenti dentro viene comunque spezzata in due righe', async () => {
    const { prisma, update } = makePrisma([{ userId: 'c1', dislikedFoods: [] }]);
    await applicaProposta(prisma, proposta({ dettaglio: { termini: ['pepe, ceci'] } }));
    expect(update.mock.calls[0][0].data.dislikedFoods).toEqual(['pepe', 'ceci']);
  });

  it('è idempotente: chi ce l’ha già non viene toccato né contato', async () => {
    // Riapprovare non deve raddoppiare niente, e il conteggio deve restare vero.
    const { prisma, update } = makePrisma([
      { userId: 'c1', dislikedFoods: ['tonno'] },
      { userId: 'c2', dislikedFoods: [] },
    ]);
    const esito = await applicaProposta(prisma, proposta());
    expect(esito.toccate).toBe(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('⚠️ il perimetro è quello di CHI HA PROPOSTO, non di chi approva', async () => {
    // «A tutte» detto da una nutrizionista vuol dire «a tutte le MIE». Il capo che approva ne vede
    // molte di più, e usare il suo perimetro allargherebbe la regola a clienti di altre.
    const { prisma } = makePrisma([{ userId: 'c1', dislikedFoods: [] }]);
    await applicaProposta(prisma, proposta({ nutrizionistaId: 'lucia' }));
    expect((prisma.user.findUnique as jest.Mock).mock.calls[0][0].where.id).toBe('lucia');
    expect((prisma.clientProfile.findMany as jest.Mock).mock.calls[0][0].where.assignedNutritionistId).toEqual({
      in: ['staff-lucia'],
    });
  });

  it('sopra il tetto NON scrive: dice quante sarebbero e si ferma', async () => {
    const molte = Array.from({ length: 201 }, (_, i) => ({ userId: `c${i}`, dislikedFoods: [] }));
    const { prisma, update } = makePrisma(molte);
    const esito = await applicaProposta(prisma, proposta());
    expect(update).not.toHaveBeenCalled();
    expect(esito.toccate).toBe(0);
    expect(esito.riepilogo).toContain('oltre il tetto');
  });

  it('senza alimenti non scrive niente', async () => {
    const { prisma, update } = makePrisma([{ userId: 'c1', dislikedFoods: [] }]);
    const esito = await applicaProposta(prisma, proposta({ dettaglio: { termini: [] } }));
    expect(update).not.toHaveBeenCalled();
    expect(esito.riepilogo).toContain('nessun alimento');
  });
});

describe('applicaProposta — la sostituzione estesa', () => {
  it('scrive la riga per la cliente e MANDA a «promuovi a regola», invece di creare un gruppo', async () => {
    // Una seconda strada per creare gruppi di equivalenza prima o poi decide in modo diverso dalla
    // prima: la promozione resta il gesto che esiste già, premuto da una persona.
    const upsert = jest.fn().mockResolvedValue({ id: 'f1', volte: 1 });
    const { prisma } = makePrisma([], { foodSwap: { upsert }, equivalenceGroup: { create: jest.fn() } });
    const esito = await applicaProposta(
      prisma,
      proposta({ azione: 'sostituzione_cliente', dettaglio: { intento: { tipo: 'sostituzione', from: 'pollo', to: 'tacchino' } } }),
    );
    expect(upsert.mock.calls[0][0].create.stato).toBe('verificata');
    expect(esito.riepilogo).toContain('promuovi a regola');
    expect((prisma as unknown as { equivalenceGroup: { create: jest.Mock } }).equivalenceGroup.create).not.toHaveBeenCalled();
  });
});

describe('ordinaPerRischio', () => {
  it('prima i conflitti sanitari, poi il raggio largo, poi il resto — e a parità la più vecchia', () => {
    // Una coda cronologica fa arrivare per ultima la cosa più importante, e chi la guarda di fretta
    // legge le prime tre.
    const righe = [
      { id: 'cliente-nuova', conflittoSanitario: false, ambito: 'cliente', createdAt: D('2026-08-13') },
      { id: 'catalogo', conflittoSanitario: false, ambito: 'catalogo', createdAt: D('2026-08-13') },
      { id: 'sanitario', conflittoSanitario: true, ambito: 'cliente', createdAt: D('2026-08-13') },
      { id: 'cliente-vecchia', conflittoSanitario: false, ambito: 'cliente', createdAt: D('2026-08-01') },
    ];
    expect(ordinaPerRischio(righe).map((r) => r.id)).toEqual([
      'sanitario',
      'catalogo',
      'cliente-vecchia',
      'cliente-nuova',
    ]);
  });

  it('non modifica l’array che riceve', () => {
    const righe = [
      { conflittoSanitario: false, ambito: 'cliente', createdAt: D('2026-08-13') },
      { conflittoSanitario: true, ambito: 'cliente', createdAt: D('2026-08-13') },
    ];
    ordinaPerRischio(righe);
    expect(righe[0].conflittoSanitario).toBe(false);
  });
});

describe('il divieto su una dieta (§6.2)', () => {
  const proposta = {
    id: 'p1', nutrizionistaId: 's1', azione: 'regola_dieta', ambito: 'dieta',
    soggettoId: 'd1', soggettoNome: 'Mediterranea', dettaglio: { termini: ['Tonno'] },
  };

  it('scrive UNA riga in ProductRule, accesa', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = {
      productRule: { findFirst: jest.fn().mockResolvedValue(null), create, update: jest.fn() },
      recipe: { findMany: jest.fn().mockResolvedValue([]) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([]) },
      menuDay: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    };
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dietId: 'd1', enabled: true, params: { termini: ['tonno'] } }) }),
    );
    expect(esito.riepilogo).toContain('non entreranno più nei menu nuovi');
  });

  it('⚠️ una seconda approvazione UNISCE i termini, non li sostituisce', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      productRule: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pr1', enabled: true, params: { termini: ['salmone'] } }),
        create: jest.fn(),
        update,
      },
      recipe: { findMany: jest.fn().mockResolvedValue([]) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([]) },
      menuDay: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    };
    await applicaProposta(prisma as never, proposta as never);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pr1' }, data: expect.objectContaining({ params: { termini: ['salmone', 'tonno'] } }) }),
    );
  });

  it('⚠️ riapprovare la stessa cosa non riscrive niente', async () => {
    const update = jest.fn();
    const prisma = {
      productRule: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pr1', enabled: true, params: { termini: ['tonno'] } }),
        create: jest.fn(), update,
      },
      recipe: { findMany: jest.fn().mockResolvedValue([]) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([]) },
      menuDay: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    };
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(update).not.toHaveBeenCalled();
    expect(esito.riepilogo).toContain('c\'era già');
  });

  it('senza dieta o senza alimento non scrive', async () => {
    const create = jest.fn();
    const prisma = {
      productRule: { findFirst: jest.fn(), create, update: jest.fn() },
      recipe: { findMany: jest.fn().mockResolvedValue([]) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([]) },
      menuDay: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    };
    await applicaProposta(prisma as never, { ...proposta, soggettoId: null } as never);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('i menu già preparati, quando il divieto entra in vigore', () => {
  const proposta = {
    id: 'p1', nutrizionistaId: 's1', azione: 'regola_dieta', ambito: 'dieta',
    soggettoId: 'd1', soggettoNome: 'Mediterranea', dettaglio: { termini: ['tonno'] },
  };
  const domani = new Date(Date.now() + 86_400_000);

  /**
   * ⚠️ **Due letture diverse, due risposte diverse** (24/8). `applicaRegolaDieta` interroga i menu
   * due volte: prima i **candidati** (filtrati per dieta e non aperti), poi i **calendari interi**
   * delle sole clienti colpite — che è la lettura senza la quale la coda non si può calcolare. Un
   * finto che risponde la stessa cosa a tutt'e due non distingue i due difetti che questo blocco
   * chiude, quindi qui si risponde per `where`: la seconda query è quella con `clientId: { in: … }`.
   */
  function prismaCon(giorni: unknown[], calendari?: unknown[]) {
    const deleteMany = jest.fn().mockResolvedValue({ count: giorni.length });
    /**
     * ⛔ **IL FINTO RISPETTA I FILTRI SULLE APERTURE, e non è un dettaglio** (26/8). Finché li
     * ignorava, mettere o togliere `apertureTracciate: true` dalla query **non faceva fallire
     * niente**: il difetto del 26/8 — la query dei colpiti che il giorno del rilascio rende zero
     * righe per tutte — poteva tornare sotto un test verde. Un finto che non finge il filtro non
     * fa fallire niente: fa passare tutto.
     */
    const findMany = jest.fn().mockImplementation((q: { where?: Record<string, unknown> }) => {
      const w = (q?.where ?? {}) as Record<string, unknown>;
      const righe = ('clientId' in w ? (calendari ?? giorni) : giorni) as Record<string, unknown>[];
      return Promise.resolve(
        righe.filter(
          (r) =>
            (!('apertureTracciate' in w) || r.apertureTracciate === w.apertureTracciate) &&
            (!('apertoDallaClienteIl' in w) || (r.apertoDallaClienteIl ?? null) === w.apertoDallaClienteIl),
        ),
      );
    });
    return {
      deleteMany,
      findMany,
      prisma: {
        productRule: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
        recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Tonno alle olive', ingredients: [] }]) },
        dietDayTemplate: { findMany: jest.fn().mockResolvedValue([]) },
        menuDay: { findMany, deleteMany },
      },
    };
  }

  it('⚠️ i giorni futuri NON ancora aperti col piatto vietato si rifanno', async () => {
    const { prisma, deleteMany } = prismaCon([
      { id: 'g1', clientId: 'c1', date: domani, apertoDallaClienteIl: null, apertureTracciate: true, meals: [{ slot: 'pranzo', recipeId: 'r1' }] },
    ]);
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['g1'] } } });
    /**
     * ⛔ **La frase non nomina un insieme che non sa** (26/8). Il 24/8 diceva «già passate» (falso: il
     * giorno che resta può essere domani), poi «già arrivate in app» — falso a sua volta da oggi,
     * perché le giornate che restano sono le già aperte **oppure** quelle di cui non sappiamo. Qui
     * non ne resta nessuna, quindi la frase non deve nominarne.
     */
    expect(esito.riepilogo).toContain('Ho rifatto 1 giornata (1 cliente).');
    expect(esito.riepilogo).not.toContain('già passate');
    expect(esito.riepilogo).not.toContain('già arrivate in app');
  });

  /**
   * ⚠️ IL TETTO SUL RAMO DIETA — non era coperto da nessun test fino al 19/8 sera, e decide se
   * migliaia di giornate di menu vengono cancellate o no.
   *
   * ⛔ Sopra il tetto **la regola resta e il rifacimento si salta**, e i due pezzi non si possono
   * scambiare: il divieto sui menu nuovi costa zero ed è il motivo per cui la regola esiste; è il
   * rifacimento che è pesante. Un test che guardasse solo «non ha cancellato» passerebbe anche se
   * l'approvazione non avesse scritto niente — cioè se il capo avesse approvato un divieto che non
   * vale.
   */
  it('⚠️ oltre il tetto: la regola SI scrive, i giorni NON si toccano, e lo dice', async () => {
    const molti = Array.from({ length: 201 }, (_, i) => ({
      id: `g${i}`, clientId: `c${i}`, date: domani, apertoDallaClienteIl: null, apertureTracciate: true, meals: [{ slot: 'pranzo', recipeId: 'r1' }],
    }));
    const { prisma, deleteMany } = prismaCon(molti);
    const esito = await applicaProposta(prisma as never, proposta as never);

    expect(deleteMany).not.toHaveBeenCalled();
    // ⚠️ La metà che conta: il divieto vale lo stesso da adesso.
    expect(prisma.productRule.create).toHaveBeenCalled();
    expect(esito.riepilogo).toContain('oltre il tetto di 200');
    // E si dice quante persone restano indietro, invece di far finta di niente.
    expect(esito.riepilogo).toContain('riguarderebbero 201 clienti');
    /**
     * ⚠️ **«Almeno»**: per ognuna si rifà dal primo giorno colpito **in avanti**, quindi le giornate
     * toccate sono sempre di più di quelle che contengono davvero il piatto. Il numero secco farebbe
     * sottostimare la portata proprio a chi deve decidere se procedere a mano.
     */
    expect(esito.riepilogo).toContain('Sarebbero almeno 201 giornate');
    // ⚠️ E l'audit non conta come «toccate» duecento clienti a cui non si è toccato un giorno.
    expect(esito.toccate).toBe(0);
  });

  /**
   * ⚠️ IL CONFINE, ed è dove vive l'errore di uno. «Oltre il tetto» vuol dire **più di** 200: con
   * esattamente 200 clienti si rifà. Senza questo caso, `>` e `>=` sono indistinguibili — e la
   * differenza è duecento persone che ricevono o non ricevono il menu giusto.
   */
  it('⚠️ esattamente 200 clienti NON è «oltre»: si rifà', async () => {
    const esatti = Array.from({ length: 200 }, (_, i) => ({
      id: `g${i}`, clientId: `c${i}`, date: domani, apertoDallaClienteIl: null, apertureTracciate: true, meals: [{ slot: 'pranzo', recipeId: 'r1' }],
    }));
    const { prisma, deleteMany } = prismaCon(esatti);
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(deleteMany).toHaveBeenCalled();
    expect(esito.riepilogo).toContain('200 clienti');
    expect(esito.riepilogo).not.toContain('oltre il tetto');
  });

  /**
   * ⚠️ E il tetto si conta sulle **persone**, non sulle giornate: una cliente con novanta giorni
   * preparati è una cliente. Contare le giornate farebbe scattare il tetto su tre persone con il
   * menu del trimestre già pronto, e il divieto non arriverebbe mai ai loro piatti.
   */
  it('⚠️ il tetto conta le persone, non le giornate: 300 giorni di 2 clienti si rifanno', async () => {
    const tanti = Array.from({ length: 300 }, (_, i) => ({
      id: `g${i}`, clientId: i % 2 ? 'c1' : 'c2', date: domani, apertoDallaClienteIl: null, apertureTracciate: true, meals: [{ slot: 'pranzo', recipeId: 'r1' }],
    }));
    const { prisma, deleteMany } = prismaCon(tanti);
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(deleteMany).toHaveBeenCalled();
    expect(esito.riepilogo).toContain('2 clienti');
  });

  /**
   * ⛔ **I COLPITI CHE RESTANO INDIETRO SI DICONO ANCHE QUI** (26/8, in revisione). `codaDaRifare` li
   * conta, `codePerCliente` li buttava via, e la regola di dieta non poteva dirlo mentre la chat lo
   * diceva: il capo leggeva «ho rifatto 1 giornata» con il tonno ancora nel pranzo di oggi.
   */
  it('⛔ la giornata già aperta col piatto vietato resta, e il capo lo legge', async () => {
    /**
     * ⚠️ **Le due date si costruiscono da `aGiorno`, non da `Date.now()`**: `MenuDay.date` è un
     * giorno senza ora, e il confine di `daQuandoSiPuoRifare` è la **mezzanotte di Roma**. Con
     * `Date.now()` questo test era verde di giorno e rosso alle 00:30 — la giornata «di oggi» cadeva
     * prima del confine e non risultava nemmeno colpita. È la stessa trappola che `menu.service.spec`
     * racconta per esteso: una fixture che mente sulla propria premessa manda a correggere codice
     * che funziona.
     */
    const oggiG = aGiorno(new Date());
    const dopo = (n: number) => new Date(oggiG.getTime() + n * 86_400_000);
    const { prisma, deleteMany } = prismaCon([
      { id: 'g-oggi', clientId: 'c1', date: dopo(0), apertoDallaClienteIl: new Date(), apertureTracciate: true, meals: [{ slot: 'pranzo', recipeId: 'r1' }] },
      { id: 'g-domani', clientId: 'c1', date: dopo(1), apertoDallaClienteIl: null, apertureTracciate: true, meals: [{ slot: 'pranzo', recipeId: 'r1' }] },
    ]);
    const esito = await applicaProposta(prisma as never, proposta as never);
    // ⚠️ Domani si rifà, oggi no: la coda parte dopo l'ultimo intoccabile.
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['g-domani'] } } });
    expect(esito.riepilogo).toContain('Altre 1 giornata col piatto vietato resta');
  });

  it('⚠️ un giorno che NON contiene il piatto vietato non si tocca', async () => {
    const { prisma, deleteMany } = prismaCon([
      { id: 'g2', clientId: 'c1', date: domani, apertoDallaClienteIl: null, apertureTracciate: true, meals: [{ slot: 'cena', recipeId: 'r-altro' }] },
    ]);
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(esito.riepilogo).toContain('non ho toccato niente');
    /**
     * ⛔ **E ADESSO PUÒ DIRLO DAVVERO** (26/8). Il 24/8 questa frase era stata indebolita in «fra
     * quelli che posso ancora rifare», perché i colpiti erano già filtrati su «mai aperto» e —
     * con `getMenu` che marcava tutto alla prima apertura — era il ramo che scattava quasi sempre:
     * «nessun menu conteneva quel piatto» era falso mentre il tonno stava nel pranzo di domani.
     * Adesso i colpiti sono i giorni che **contengono** il piatto, quindi zero colpiti vuol dire
     * davvero zero piatti, e la frase è di nuovo un'affermazione che si può firmare.
     */
    expect(esito.riepilogo).toContain('Nessun menu già preparato da oggi in poi conteneva quel piatto');
  });

  /**
   * ⛔ **IL GIORNO DEL RILASCIO: NESSUNA CLIENTE È «TRACCIATA», E NON SI PUÒ DIRE «NON CE N'ERA».**
   *
   * È il caso che il 26/8 ha fatto riscrivere questo pezzo. La query dei colpiti filtrava
   * `apertureTracciate: true`, che il giorno del rilascio è falso per **ogni riga esistente**: il
   * capo avrebbe letto «non ce n'era nessuno con quel piatto» mentre il tonno stava nel pranzo di
   * domani di tutte. La stessa identica frase del difetto, il primo giorno.
   */
  it('⛔ con le aperture non tracciate il capo legge «non so dirlo», non «non ce n\'era»', async () => {
    const { prisma, deleteMany } = prismaCon([
      { id: 'g9', clientId: 'c1', date: domani, apertoDallaClienteIl: null, apertureTracciate: false, meals: [{ slot: 'pranzo', recipeId: 'r1' }] },
    ]);
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(esito.riepilogo).toMatch(/non so dire se/);
    expect(esito.riepilogo).not.toMatch(/non ho toccato niente/);
    // ⚠️ E non le si dà per «già arrivate in app»: di quella cliente non sappiamo niente.
    expect(esito.riepilogo).not.toMatch(/ha già aperto in app/);
  });
});

/**
 * ⛔ **IL BUCO CHE NON SI RICHIUDE — chiuso il 24/8, aperto dal 13/8** (voce
 * `giorno-cancellato-che-non-torna`).
 *
 * Qui si cancellavano i giorni che contengono il piatto vietato, **sparsi**. Ma il motore riparte
 * dall'**ultimo** giorno rimasto in calendario e appende da lì: chi aveva più avanti una giornata
 * senza quel piatto se la ritrovava come ultima, e i giorni cancellati prima di lei non tornavano
 * **mai**. Una regola di dieta approvata poteva farlo a centinaia di clienti in un colpo solo, e
 * nessuna se ne sarebbe lamentata in modo riconoscibile: si vede «menu in preparazione» e si aspetta.
 */
describe('⛔ la regola di dieta cancella una CODA, per ogni cliente', () => {
  const proposta = {
    id: 'p1', nutrizionistaId: 's1', azione: 'regola_dieta', ambito: 'dieta',
    soggettoId: 'd1', soggettoNome: 'Mediterranea', dettaglio: { termini: ['tonno'] },
  };
  const G = 86_400_000;
  const fra = (n: number) => new Date(Date.now() + n * G);
  const conTonno = (id: string, clientId: string, n: number, aperto: Date | null = null) => ({
    id, clientId, date: fra(n), apertoDallaClienteIl: aperto, apertureTracciate: true, meals: [{ slot: 'pranzo', recipeId: 'r1' }],
  });
  const senzaTonno = (id: string, clientId: string, n: number, aperto: Date | null = null) => ({
    id, clientId, date: fra(n), apertoDallaClienteIl: aperto, apertureTracciate: true, meals: [{ slot: 'cena', recipeId: 'r-altro' }],
  });

  function prismaCon(candidati: unknown[], calendari: unknown[]) {
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    return {
      deleteMany,
      prisma: {
        productRule: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
        recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Tonno alle olive', ingredients: [] }]) },
        dietDayTemplate: { findMany: jest.fn().mockResolvedValue([]) },
        menuDay: {
          deleteMany,
          findMany: jest.fn().mockImplementation((q: { where?: Record<string, unknown> }) =>
            Promise.resolve(q?.where && 'clientId' in q.where ? calendari : candidati),
          ),
        },
      },
    };
  }

  const cancellati = (deleteMany: jest.Mock): string[] =>
    [...((deleteMany.mock.calls[0]?.[0]?.where?.id?.in ?? []) as string[])].sort();

  it('⛔ si porta via anche la giornata INNOCENTE che sta dopo quella col tonno', async () => {
    const { prisma, deleteMany } = prismaCon(
      [conTonno('g1', 'c1', 1)],
      [conTonno('g1', 'c1', 1), senzaTonno('g2', 'c1', 2), senzaTonno('g3', 'c1', 3)],
    );
    await applicaProposta(prisma as never, proposta as never);
    expect(cancellati(deleteMany)).toEqual(['g1', 'g2', 'g3']);
  });

  /**
   * ⛔ **LA SECONDA QUERY È LA METÀ CHE CONTA.** I candidati arrivano filtrati per dieta e per
   * «mai aperto»: da soli non fanno nemmeno vedere il giorno letto che sta in fondo. Se un domani
   * qualcuno togliesse la lettura dei calendari interi, questo test diventa rosso — mentre tutti
   * gli altri resterebbero verdi, perché il finto risponderebbe la stessa cosa a tutt'e due.
   */
  it('⛔ un giorno GIÀ APERTO in fondo ferma il rifacimento di QUELLA cliente, e lo dice', async () => {
    const { prisma, deleteMany } = prismaCon(
      [conTonno('g1', 'c1', 1)],
      [conTonno('g1', 'c1', 1), senzaTonno('g2', 'c1', 2, new Date())],
    );
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(deleteMany).not.toHaveBeenCalled();
    /**
     * ⚠️ **La frase dice quello che il dato sostiene** (24/8, in revisione): diceva «ha già aperto il
     * menu», e `viewedAt` non vuol dire questo — lo mette `getMenu` a ogni apertura dell'app, su
     * tutti i giorni della finestra, futuri compresi. Vedi la voce `visto-non-vuol-dire-aperto`.
     */
    expect(esito.riepilogo).toContain('ha già aperto in app');
    // ⚠️ E il rimedio si dice per quello che fa: «Rigenera menu» cancella anche il giorno ricevuto.
    expect(esito.riepilogo).toContain('rifà anche il giorno che ha già aperto');
    // ⚠️ E la regola vale lo stesso: il divieto sui menu NUOVI è il motivo per cui esiste.
    expect(prisma.productRule.create).toHaveBeenCalled();
  });

  /** ⛔ E una bloccata non blocca le altre: Bea resta indietro da sola, Anna si rifà. */
  it('⛔ una cliente bloccata non ferma le altre', async () => {
    const { prisma, deleteMany } = prismaCon(
      [conTonno('a1', 'anna', 1), conTonno('b1', 'bea', 1)],
      [
        conTonno('a1', 'anna', 1), senzaTonno('a2', 'anna', 2),
        conTonno('b1', 'bea', 1), senzaTonno('b2', 'bea', 2, new Date()),
      ],
    );
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(cancellati(deleteMany)).toEqual(['a1', 'a2']);
    expect(esito.riepilogo).toContain('1 cliente ha già aperto in app');
    // Le rifatte si contano al netto delle bloccate: dire «2 clienti» sarebbe falso per una delle due.
    expect(esito.riepilogo).toContain('(1 cliente)');
  });

  /**
   * ⛔ **LA CODA È DI OGNUNA.** Ad Anna il tonno è domani, a Bea fra tre giorni: una data sola per
   * tutte cancellerebbe a Bea due giornate che nessun divieto tocca.
   */
  it('⛔ ognuna parte dal SUO primo giorno colpito, non da quello della prima', async () => {
    const { prisma, deleteMany } = prismaCon(
      [conTonno('a1', 'anna', 1), conTonno('b3', 'bea', 3)],
      [
        conTonno('a1', 'anna', 1), senzaTonno('a2', 'anna', 2),
        senzaTonno('b1', 'bea', 1), senzaTonno('b2', 'bea', 2), conTonno('b3', 'bea', 3),
      ],
    );
    await applicaProposta(prisma as never, proposta as never);
    expect(cancellati(deleteMany)).toEqual(['a1', 'a2', 'b3']);
  });

  /**
   * ⛔ **LE SCOPERTE SI CONTANO PRIMA DELLA CANCELLAZIONE — bloccante trovato in revisione il 24/8.**
   *
   * `scopertePerDieta` costruisce la coorte da chi ha **menu in calendario da oggi in poi**. Con la
   * cancellazione a coda, alle clienti colpite si porta via tutto il futuro: contando dopo,
   * **sparivano dall'elenco** — e sono proprio quelle giuste, perché chi ha più giorni col piatto
   * vietato è chi rischia di più di restare senza un pasto.
   *
   * ⛔ Cosa leggeva il capo: «fatto, 3 giornate rifatte», e nient'altro. Il motore ricomponeva le
   * stesse tre giornate **col piatto vietato dentro** (è la regola del «non svuotare uno slot»), e
   * nessuno avrebbe più guardato quella cliente. Il messaggio si contraddiceva da solo, in silenzio.
   */
  it('⛔ chi resterebbe senza un pasto compare nell\'elenco anche se le si è appena cancellato il calendario', async () => {
    const soloTonno = [{ id: 'r1', name: 'Tonno alle olive', ingredients: [] }];
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const giorni = [conTonno('g1', 'c1', 1), senzaTonno('g2', 'c1', 2)];
    /**
     * ⚠️ Il finto dei menu **cancella davvero**: senza questo, la coorte resta piena comunque e il
     * test passerebbe anche col difetto dentro — cioè non proverebbe niente.
     */
    let vivi = [...giorni];
    const prisma = {
      productRule: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
      recipe: { findMany: jest.fn().mockResolvedValue(soloTonno) },
      // Il pool del pranzo è fatto solo di tonno: vietandolo, questa cliente resta senza pranzo.
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([{ meals: [{ slot: 'pranzo', recipeId: 'r1' }] }]) },
      clientProfile: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'c1', name: 'Anna', allergies: [], intolerances: [], dislikedFoods: [] }]),
      },
      menuDay: {
        deleteMany: jest.fn().mockImplementation((q: { where?: { id?: { in?: string[] } } }) => {
          const via = new Set(q?.where?.id?.in ?? []);
          vivi = vivi.filter((g) => !via.has(g.id));
          return deleteMany(q);
        }),
        /**
         * ⚠️ **Il finto non filtra quello che il codice non filtra** (26/8). Qui c'era un filtro fisso
         * su «non aperto e tracciato», che la query dei colpiti **non fa più**: era un finto che
         * fingeva una condizione inventata, quindi il caso nuovo — un giorno già aperto che entra
         * fra i colpiti e conta nel tetto e nei lasciati indietro — non veniva mai esercitato.
         */
        findMany: jest.fn().mockImplementation(() => Promise.resolve(vivi)),
      },
    };
    const esito = await applicaProposta(prisma as never, proposta as never);

    expect(deleteMany).toHaveBeenCalled();
    expect(esito.scoperte?.map((s) => s.nome)).toEqual(['Anna']);
    expect(esito.riepilogo).toContain('resterebbe senza un pasto');
  });

  /**
   * ⚠️ **E i giorni di una dieta PRECEDENTE contano lo stesso.** La prima query filtra per `dietId`,
   * quindi una giornata rimasta da una dieta di prima non compare fra i candidati — ma sta in
   * calendario, e se sta in fondo è lei l'ultimo giorno. È il motivo per cui la seconda lettura non
   * filtra per dieta.
   */
  it('⚠️ una giornata di un\'altra dieta, se sta dopo, entra nella coda', async () => {
    const altraDieta = { id: 'g-vecchia', clientId: 'c1', date: fra(4), apertoDallaClienteIl: null, apertureTracciate: true, meals: [{ slot: 'cena', recipeId: 'r-altro' }] };
    const { prisma, deleteMany } = prismaCon(
      [conTonno('g1', 'c1', 1)],
      [conTonno('g1', 'c1', 1), altraDieta],
    );
    await applicaProposta(prisma as never, proposta as never);
    expect(cancellati(deleteMany)).toEqual(['g-vecchia', 'g1']);
  });
});

describe('l\'elenco delle scoperte arriva al capo (voce vera-regola-dieta-scoperte)', () => {
  const proposta = {
    id: 'p1', nutrizionistaId: 's1', azione: 'regola_dieta', ambito: 'dieta',
    soggettoId: 'd1', soggettoNome: 'Mediterranea', dettaglio: { termini: ['tonno'] },
  };

  it('chi resterebbe senza un pasto si dice al capo, con nome e pasto — e per lei il divieto non vale', async () => {
    const prisma = {
      productRule: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), update: jest.fn() },
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r-tonno', name: 'Insalata di tonno', ingredients: [] }]) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([{ meals: [{ slot: 'dinner', recipeId: 'r-tonno' }] }]) },
      // Due letture diverse sulla stessa tabella: il rifacimento (non aperto) e la coorte (distinct).
      menuDay: {
        findMany: jest.fn().mockImplementation((args: { distinct?: string[] }) =>
          Promise.resolve(args?.distinct ? [{ clientId: 'c1' }] : [])),
        deleteMany: jest.fn(),
      },
      clientProfile: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'c1', name: 'Giulia Rossi', allergies: [], intolerances: [], dislikedFoods: [] },
        ]),
      },
    };
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(esito.riepilogo).toContain('Giulia Rossi');
    expect(esito.riepilogo).toContain('cena');
    expect(esito.riepilogo).toContain('NON vale');
    expect(esito.scoperte).toHaveLength(1);
  });

  it('⚠️ se il conto delle scoperte si rompe si DICE — la regola vale, l\'elenco va guardato a mano', async () => {
    // «Non lo so» ≠ «nessuno»: un elenco vuoto per un errore inghiottito è la bugia silenziosa
    // che questa voce esiste per chiudere.
    const prisma = {
      productRule: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), update: jest.fn() },
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r-tonno', name: 'Insalata di tonno', ingredients: [] }]) },
      dietDayTemplate: { findMany: jest.fn().mockRejectedValue(new Error('boom')) },
      menuDay: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    };
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(esito.riepilogo).toContain('Non sono riuscito a calcolare chi resterebbe scoperta');
  });

  it('con tutte le clienti coperte l\'elenco non compare e non sporca il messaggio', async () => {
    const prisma = {
      productRule: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), update: jest.fn() },
      recipe: { findMany: jest.fn().mockResolvedValue([
        { id: 'r-tonno', name: 'Insalata di tonno', ingredients: [] },
        { id: 'r-pollo', name: 'Pollo ai ferri', ingredients: [] },
      ]) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([{ meals: [{ slot: 'dinner', recipeId: 'r-tonno' }, { slot: 'dinner', recipeId: 'r-pollo' }] }]) },
      menuDay: {
        findMany: jest.fn().mockImplementation((args: { distinct?: string[] }) =>
          Promise.resolve(args?.distinct ? [{ clientId: 'c1' }] : [])),
        deleteMany: jest.fn(),
      },
      clientProfile: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'c1', name: 'Giulia Rossi', allergies: [], intolerances: [], dislikedFoods: [] },
        ]),
      },
    };
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(esito.riepilogo).not.toContain('NON vale');
    expect(esito.scoperte ?? []).toHaveLength(0);
  });
});
