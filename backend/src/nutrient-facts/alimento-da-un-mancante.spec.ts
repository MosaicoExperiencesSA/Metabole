import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NutrientFactsController } from './nutrient-facts.controller';

/**
 * L'ALIMENTO CHE MANCA, SCRITTO DALLA PAGINA — richiesta di Simone (20/8): «oltre al pulsante togli
 * mettimi anche associa o dettaglio, per inserirti i campi che ti servono».
 *
 * ⚠️ I due pulsanti rispondono a due domande diverse e restano separati: «associa» dice *«questo
 * nome è un altro modo di chiamare una riga che c'è già»*, «dettaglio» dice *«questo alimento in
 * tabella non c'è»*. ⛔ La scelta sbagliata qui non è un fastidio: un sinonimo messo dove serviva
 * una riga **fa sparire il buco senza chiuderlo**.
 */
describe('creare un alimento da un termine mancante', () => {
  const utente = { sub: 'u1' } as never;

  const crea = (over: Record<string, unknown> = {}) => {
    const prisma: any = {
      nutrientLookupMiss: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm1', term: 'melanzane', status: 'open' }),
        update: jest.fn().mockResolvedValue({}),
      },
      nutrientFact: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'nf1', ...data })),
      },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'st1' }) },
      ...over,
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    return { prisma, audit, controller: new NutrientFactsController(prisma, audit as never) };
  };

  it('scrive la riga col nome del termine e chiude il mancante', async () => {
    const { prisma, controller } = crea();
    const esito = await controller.creaDaMancante('m1', { kcal: '18', protein: '0,9', state: 'crudo' }, utente);

    expect(esito).toEqual(expect.objectContaining({ ok: true, nome: 'melanzane' }));
    const scritto = prisma.nutrientFact.create.mock.calls[0][0].data;
    expect(scritto.name).toBe('melanzane');
    expect(scritto.kcal).toBe(18);
    // ⚠️ La virgola è come si scrivono i decimali in italiano: chi compila non deve pensarci.
    expect(scritto.protein).toBe(0.9);
    expect(scritto.state).toBe('crudo');
    // ⚠️ Nasce confermata: l'ha scritta una persona che sa, e rimetterla nella coda «da guardare»
    // vorrebbe dire farle rifare il lavoro che ha appena fatto.
    expect(scritto.verifiedAt).toBeInstanceOf(Date);
    expect(prisma.nutrientLookupMiss.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm1' }, data: { status: 'filled' } }),
    );
  });

  /**
   * ⚠️ **IL NOME LO DECIDE IL TERMINE, NON CHI CHIAMA** — e questo test è nato da una mutazione che
   * non mordeva: assertare «il nome è melanzane» quando nessuno manda un nome diverso non verifica
   * niente, perché il valore giusto arriva comunque.
   *
   * ⛔ Se il nome fosse libero, questa schermata diventerebbe un secondo modo di creare alimenti e
   * il termine resterebbe in elenco, scollegato dalla riga appena scritta: si chiuderebbe il
   * mancante creando un alimento che con quel mancante non c'entra niente.
   */
  it('⚠️ un nome mandato dal client viene ignorato: vale il termine', async () => {
    const { prisma, controller } = crea();
    await controller.creaDaMancante('m1', { name: 'tutt\'altro', kcal: '18' }, utente);
    expect(prisma.nutrientFact.create.mock.calls[0][0].data.name).toBe('melanzane');
  });

  /** I campi lasciati vuoti restano vuoti: `0` e «non lo so» non sono la stessa cosa. */
  it('⚠️ un campo lasciato vuoto NON diventa zero', async () => {
    const { prisma, controller } = crea();
    await controller.creaDaMancante('m1', { kcal: '18', protein: '' }, utente);
    const scritto = prisma.nutrientFact.create.mock.calls[0][0].data;
    expect(scritto.protein).toBeNull();
    expect(scritto.fiber).toBeNull();
  });

  /**
   * ⛔ DUE RIGHE CON LO STESSO NOME SONO L'AMBIGUITÀ CHE FA RISPONDERE GAIA A CASO, ed è la ragione
   * per cui `name` è `@unique`. Meglio un errore che si legge di un vincolo che scatta e lascia chi
   * ha cliccato senza sapere cosa fare.
   */
  it('⚠️ se una riga con quel nome c\'è già, non se ne fa una seconda: dice di associare', async () => {
    /**
     * ⚠️ Il finto risponde **secondo il `where`**, come farebbe il database. Con un finto che
     * rispondeva sempre `{id:'gia'}` questo test passava anche mutando la query — cioè verificava
     * che l'endpoint sa leggere una variabile, non che cerca la riga giusta. È la sesta volta oggi
     * che un doppio che si comporta diversamente dall'originale salta in silenzio quello che
     * dovrebbe verificare, e ogni volta l'ha detto una mutazione, mai il colore della suite.
     */
    const perNomeOSinonimo = (righe: { id: string; name: string; synonyms: string[] }[]) =>
      jest.fn().mockImplementation(({ where }: any) => {
        // ⚠️ Il finto risponde alla domanda VERA: «c'è una riga che si chiama così, O che ha questo
        // nome fra i sinonimi?». Un doppio che guarda solo `where.name` non può accorgersi che il
        // controllo dei sinonimi manca — ed è proprio quello il difetto trovato dalla revisione.
        const cerca = (where?.OR ?? [where]) as { name?: string; synonyms?: { has: string } }[];
        const trovata = righe.find((r) =>
          cerca.some((c) => (c?.name && r.name === c.name) || (c?.synonyms?.has && r.synonyms.includes(c.synonyms.has))),
        );
        return Promise.resolve(trovata ?? null);
      });

    const { controller } = crea({
      nutrientFact: {
        findFirst: perNomeOSinonimo([{ id: 'gia', name: 'melanzane', synonyms: [] }]),
        create: jest.fn(),
      },
    });
    await expect(controller.creaDaMancante('m1', {}, utente)).rejects.toBeInstanceOf(BadRequestException);

    /**
     * ⛔ IL CASO CHE RIMETTEVA IN PIEDI LA VOCE 228, e che il controllo vecchio non vedeva.
     *
     * La collisione vera è **nome contro sinonimo**: `name` è `@unique`, quindi creare una riga
     * chiamata «olio extravergine» quando quel nome è già un **sinonimo** di «olio extravergine di
     * oliva» non viola nessun vincolo. Da lì in poi due righe rispondono a quel nome, e con lo
     * stesso stato quale delle due risponde **lo decide l'ordine di lettura del database**.
     */
    const conSinonimo = crea({
      nutrientLookupMiss: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm2', term: 'olio extravergine', status: 'open' }),
        update: jest.fn(),
      },
      nutrientFact: {
        findFirst: perNomeOSinonimo([{ id: 'olio', name: 'olio extravergine di oliva', synonyms: ['olio extravergine'] }]),
        create: jest.fn(),
      },
    });
    await expect(conSinonimo.controller.creaDaMancante('m2', {}, utente)).rejects.toBeInstanceOf(BadRequestException);
    expect(conSinonimo.prisma.nutrientFact.create).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ **QUALCUN ALTRO PUÒ AVERLO GIÀ CHIUSO.** `miss.status` veniva letto e mai guardato: una
   * pagina aperta da ieri poteva creare una riga per un termine già associato a un'altra.
   */
  it('⚠️ un termine già chiuso da qualcun altro non si può ri-creare', async () => {
    const { prisma, controller } = crea({
      nutrientLookupMiss: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm1', term: 'melanzane', status: 'filled' }),
        update: jest.fn(),
      },
    });
    await expect(controller.creaDaMancante('m1', {}, utente)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.nutrientFact.create).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ «NON LO SO» E «ILLEGGIBILE» NON SONO LA STESSA COSA. Prima qualunque cosa non numerica
   * diventava `null` in silenzio: si scriveva `8OO` nelle kcal e nasceva una riga **senza calorie**,
   * confermata — che toglie il termine dalla lista di lavoro mentre il conto continua a saltarlo.
   */
  it('⚠️ un refuso nelle kcal non diventa «vuoto»: si ferma e lo dice', async () => {
    const { prisma, controller } = crea();
    await expect(controller.creaDaMancante('m1', { kcal: '8OO' }, utente)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.nutrientFact.create).not.toHaveBeenCalled();
  });

  /** ⚠️ E i valori assurdi: `-500` kcal **sottrae** dal totale di una ricetta. */
  it('⚠️ kcal negative o fuori scala non entrano in tabella', async () => {
    const { controller } = crea();
    await expect(controller.creaDaMancante('m1', { kcal: '-500' }, utente)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.creaDaMancante('m1', { kcal: '5000' }, utente)).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.creaDaMancante('m1', { protein: '250' }, utente)).rejects.toBeInstanceOf(BadRequestException);
  });

  /**
   * ⚠️ **SENZA CALORIE NON È CONFERMATA.** Se le kcal mancano, la riga non serve al conto e insieme
   * toglie il termine dalla lista: resta «da confermare», che è il solo posto da cui può tornare
   * sotto gli occhi.
   */
  it('⚠️ una riga senza kcal resta «da confermare»', async () => {
    const { prisma, controller } = crea();
    await controller.creaDaMancante('m1', { state: 'crudo' }, utente);
    expect(prisma.nutrientFact.create.mock.calls[0][0].data.verifiedAt).toBeNull();
  });

  it('un termine non più in elenco non crea niente', async () => {
    const { prisma, controller } = crea({
      nutrientLookupMiss: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    });
    await expect(controller.creaDaMancante('m1', {}, utente)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.nutrientFact.create).not.toHaveBeenCalled();
  });
});
