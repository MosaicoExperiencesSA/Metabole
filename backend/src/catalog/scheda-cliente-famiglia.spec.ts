/**
 * ⛔ **LA SCHEDA CLIENTE: chi la scrive, e su quante righe.**
 *
 * Due decisioni di Simone del 22/8, e tutte e due nascono da un difetto misurato:
 *
 *  1. *«La nutrizionista scrive il testo, il capo la visibilità.»* Fino a ieri la rotta era del solo
 *     capo mentre il pulsante si mostrava anche a lei: apriva «Scheda cliente», scriveva la
 *     descrizione, premeva Salva e prendeva **403**. Un pulsante che si vede e non funziona non
 *     insegna che non puoi, insegna che il sistema si rompe.
 *  2. *«Per famiglia, e scrive su tutte.»* Una famiglia è fino a **18** varianti (regime × obiettivo
 *     × pasti). In registrazione e sul sito il codice tappa i buchi — basta una variante compilata —
 *     ma nel **profilo** la cliente legge la **sua**, e quando manca il codice ripiega sulla descrizione
 *     dell'ultimo menu consegnato: si può avere un catalogo che sembra a posto e una cliente che
 *     legge la spiegazione di un'altra dieta.
 *
 * ⚠️ Qui si prova il **service** con un Prisma finto: quello che conta è quali righe vengono scritte
 * e cosa finisce nel registro. La porta dei campi (`whitelist`) è provata a parte in
 * `scheda-cliente-alla-porta.spec.ts`, perché vive nella `ValidationPipe` e non qui.
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';

/** Le 18 varianti di una famiglia, come stanno a database. */
const VARIANTI = Array.from({ length: 18 }, (_, i) => ({
  id: `v${i}`,
  clientName: null,
  clientDescription: i === 0 ? 'la sola compilata' : null,
  highlights: [],
  seasonalTag: null,
}));

function crea(opzioni?: { varianti?: unknown[] }) {
  const audit = { log: jest.fn() };
  const prisma = {
    diet: {
      /**
       * ⚠️ Il finto torna anche i campi che la guardia confronta: `updateDietProduct` rifiuta solo i
       * campi che **cambiano**, quindi senza un «prima» realistico i test proverebbero un'altra cosa.
       */
      findUnique: jest.fn().mockResolvedValue({
        id: 'd1', name: 'Mediterranea', style: 'mediterranean',
        clientName: null, clientDescription: null, highlights: [], seasonalTag: null,
        objective: 'dimagrimento', clientVisible: false, siteVisible: false, recommended: false,
      }),
      findMany: jest.fn().mockResolvedValue(opzioni?.varianti ?? VARIANTI),
      update: jest.fn((args: unknown) => args),
    },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  };
  /**
   * ⚠️ **L'ordine è quello vero del costruttore** — `(prisma, audit, config, notifications)`.
   * La prima stesura aveva il terzo e il quarto **invertiti**: passava andava e i due metodi provati
   * non li usano, ma il primo che avesse aggiunto un `this.config.getNumber(...)` avrebbe letto
   * «getNumber is not a function» e sarebbe andato a cercare il difetto nel service.
   */
  const service = new CatalogService(
    prisma as never,
    audit as never,
    { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } as never,
    { sendToUser: jest.fn() } as never,
  );
  return { prisma, audit, service };
}

describe('⛔ la vetrina la accende il capo, il testo lo scrive la nutrizionista', () => {
  const testo = { clientDescription: 'Una giornata mediterranea.' };

  it.each([['nutritionist'], ['head_nutritionist'], ['admin']])(
    '⚠️ «%s» può scrivere il TESTO',
    async (ruolo) => {
      const { service } = crea();
      await expect(service.updateDietProduct('u1', 'd1', testo, ruolo)).resolves.toBeTruthy();
    },
  );

  /**
   * ⛔ **I tre campi di vetrina, uno per uno.** Sono quelli che decidono se una dieta **si vede**:
   * accenderne una per sbaglio vuol dire metterla davanti alle clienti e sul sito pubblico.
   */
  it.each([['clientVisible'], ['siteVisible'], ['recommended']])(
    '⛔ la nutrizionista NON accende «%s»',
    async (campo) => {
      const { service } = crea();
      await expect(service.updateDietProduct('u1', 'd1', { [campo]: true }, 'nutritionist'))
        .rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  /** ⚠️ E il capo sì, come prima: questa consegna apre, non sposta. */
  it('⚠️ il capo accende la vetrina come sempre', async () => {
    const { service } = crea();
    await expect(service.updateDietProduct('u1', 'd1', { siteVisible: true }, 'head_nutritionist'))
      .resolves.toBeTruthy();
  });

  /**
   * ⛔ **Il messaggio dice QUALE campo l'ha fermata.** «Non hai il permesso» su una form con sei
   * campi manda a indovinare quale toccare.
   */
  it('⛔ il rifiuto nomina il campo, e dice cosa può fare', async () => {
    const { service } = crea();
    await expect(service.updateDietProduct('u1', 'd1', { clientVisible: true }, 'nutritionist'))
      .rejects.toThrow(/clientVisible/);
    await expect(service.updateDietProduct('u1', 'd1', { clientVisible: true }, 'nutritionist'))
      .rejects.toThrow(/lo puoi scrivere tu/);
  });

  /**
   * ⛔ **IL CASO CHE HA FATTO FALLIRE LA PRIMA STESURA, e nessun test lo copriva.**
   *
   * La modale «Scheda cliente» manda **sempre** tutti i suoi campi — anche `clientVisible` e
   * `recommended`, anche quando la nutrizionista ha toccato solo la descrizione. Una guardia su «il
   * campo è presente» li vedeva e rifiutava: lei correggeva un refuso e leggeva *«la visibilità la
   * decide il capo… il testo lo puoi scrivere tu»*, cioè un messaggio che le dice che può fare
   * esattamente la cosa che le è appena stata negata.
   *
   * ⚠️ La correzione è «solo i campi che **cambiano**», e questo è il test che la tiene: senza,
   * la mutazione che rimette `dto[c] !== undefined` passa verde — provato.
   */
  it('⛔ rimandare indietro gli stessi valori NON è accendere la vetrina', async () => {
    const { prisma, service } = crea();
    // Il corpo esatto della modale: il «prima» del finto ha gli stessi due booleani a `false`.
    await expect(service.updateDietProduct('u1', 'd1', {
      clientName: 'Mediterranea leggera',
      clientDescription: 'Un refuso corretto.',
      clientVisible: false,
      recommended: false,
    }, 'nutritionist')).resolves.toBeTruthy();
    expect(prisma.diet.update).toHaveBeenCalled();
  });

  /** ⛔ Ma cambiarli davvero sì, resta vietato: la guardia guarda il valore, non l'intenzione. */
  it('⛔ e cambiarli davvero resta vietato', async () => {
    const { service } = crea();
    await expect(service.updateDietProduct('u1', 'd1', {
      clientDescription: 'testo', clientVisible: true,
    }, 'nutritionist')).rejects.toBeInstanceOf(ForbiddenException);
  });

  /**
   * ⚠️ **Un testo mandato insieme a un campo di vetrina viene rifiutato tutto**, non salvato a metà:
   * mezza richiesta applicata è la cosa che nessuno riesce a ricostruire dopo.
   */
  it('⚠️ testo + vetrina insieme: si rifiuta tutto', async () => {
    const { prisma, service } = crea();
    await expect(service.updateDietProduct('u1', 'd1', { ...testo, siteVisible: true }, 'nutritionist'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.diet.update).not.toHaveBeenCalled();
  });
});

describe('⛔ scrivere per famiglia: tutte e diciotto, o nessuna', () => {
  const dto = { famiglia: 'Mediterranea', stile: 'mediterranean', clientDescription: 'Nuovo testo.' };

  it('⛔ scrive su TUTTE le varianti della famiglia', async () => {
    const { prisma, service } = crea();
    const esito = await service.updateFamilyProduct('u1', dto);
    expect(prisma.diet.update).toHaveBeenCalledTimes(18);
    expect(esito.aggiornate).toBe(18);
  });

  /**
   * ⛔ **In una transazione, non con diciotto chiamate.** È la differenza fra «o tutte o nessuna» e
   * «otto sì, dieci no, e la famiglia adesso dice due cose diverse» — che è esattamente come
   * falliva «pubblica la famiglia» dal browser.
   */
  it('⛔ e in UNA transazione', async () => {
    const { prisma, service } = crea();
    await service.updateFamilyProduct('u1', dto);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  /** ⛔ Scrive solo i campi mandati: un campo assente non è «svuotalo». */
  it('⛔ non azzera i campi che non hai toccato', async () => {
    const { prisma, service } = crea();
    await service.updateFamilyProduct('u1', dto);
    const primaScrittura = prisma.diet.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(Object.keys(primaScrittura.data)).toEqual(['clientDescription']);
  });

  /** ⛔ Niente campi di vetrina da qui: accendere 18 diete in un colpo non deve poter succedere. */
  it('⛔ la famiglia non ha campi di vetrina nemmeno per il capo', async () => {
    const { prisma, service } = crea();
    await service.updateFamilyProduct('u1', { ...dto, siteVisible: true } as never);
    const scritto = (prisma.diet.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(scritto).not.toHaveProperty('siteVisible');
  });

  /**
   * ⛔ **Famiglia che non c'è: si dice.** Rispondere «fatto» avendo scritto su zero righe è il modo
   * in cui una persona chiude la pagina convinta, e la cliente continua a vedere il vuoto.
   */
  it('⛔ famiglia inesistente: 404, non un «fatto» silenzioso', async () => {
    const { service } = crea({ varianti: [] });
    await expect(service.updateFamilyProduct('u1', dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('⚠️ senza nessun campo da cambiare: lo dice invece di scrivere a vuoto', async () => {
    const { service } = crea();
    await expect(service.updateFamilyProduct('u1', { famiglia: 'Mediterranea', stile: 'mediterranean' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  /**
   * ⛔ **IL «PRIMA» FINISCE NEL REGISTRO.** Diciotto descrizioni sovrascritte in un colpo, senza il
   * valore precedente, sono diciotto testi che nessuno può rimettere: non perché non si vuole, ma
   * perché nessuno sa più com'erano.
   */
  it('⛔ il registro porta il valore precedente di ogni variante', async () => {
    const { audit, service } = crea();
    await service.updateFamilyProduct('u1', dto);
    /**
     * ⛔ **Una riga per variante, non una per famiglia.** La prima stesura ne scriveva una sola,
     * agganciata alla prima variante che tornava dal database: chi apriva il log filtrando sulla
     * dieta #7 — quella su cui era arrivata la segnalazione — non trovava niente, e diciotto diete
     * risultavano cambiate da nessuno.
     */
    expect(audit.log).toHaveBeenCalledTimes(18);
    const righe = audit.log.mock.calls.map(([r]) => r as { action: string; entityId: string; metadata: Record<string, unknown> });
    expect(new Set(righe.map((r) => r.entityId)).size).toBe(18);
    expect(righe[0].action).toBe('catalog.diet.product.famiglia');
    expect(righe[0].metadata.campi).toEqual(['clientDescription']);
    expect((righe[0].metadata.prima as { clientDescription: string | null }).clientDescription)
      .toBe('la sola compilata');
  });

  /**
   * ⛔ **Le varianti ARCHIVIATE non si toccano.** `archiveDiet` non ha uno stato suo: archivia
   * mettendo `status: 'rejected'`. Scriverci sopra spenderebbe il lavoro di una persona su righe che
   * nessuna cliente raggiunge, e le farebbe contare fra le «scoperte» in tabella — un rosso che non
   * si spegne mai.
   */
  it('⛔ la query esclude le varianti archiviate', async () => {
    const { prisma, service } = crea();
    await service.updateFamilyProduct('u1', dto);
    const dove = (prisma.diet.findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;
    expect(dove.status).toEqual({ not: 'rejected' });
  });

  /** ⚠️ E l'ordine è fisso: senza, le righe di registro cambierebbero aggancio a ogni esecuzione. */
  it('⚠️ le varianti si leggono in un ordine deterministico', async () => {
    const { prisma, service } = crea();
    await service.updateFamilyProduct('u1', dto);
    expect((prisma.diet.findMany.mock.calls[0][0] as { orderBy?: unknown }).orderBy).toBeTruthy();
  });
});
