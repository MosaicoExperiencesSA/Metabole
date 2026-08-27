import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from './menu.service';

/**
 * ⛔ **LE APERTURE NON SI PERDONO E NON SI INVENTANO** — 26/8, voce `visto-non-vuol-dire-aperto`.
 *
 * `apertoDallaClienteIl` e `apertureTracciate` sono le due colonne su cui si regge «questo menu si
 * può ancora rifare?». ⚠️ Il modo in cui una regola così smette di valere non è che qualcuno la
 * cambia: è che un **secondo** punto che scrive `MenuDay` dimentica una colonna, e da lì in poi quei
 * giorni diventano «non lo so» per sempre — senza un errore, senza un log, senza che si veda.
 * Questo file tiene fermi i punti che scrivono.
 */
const providers = (prisma: unknown) => [
  MenuService,
  { provide: PrismaService, useValue: prisma },
  { provide: ConfigParamsService, useValue: { getNumber: jest.fn().mockResolvedValue(2), getString: jest.fn().mockResolvedValue(null) } },
  { provide: AuditService, useValue: { log: jest.fn() } },
  { provide: require('../calendar/events.service').EventsService, useValue: { listForClient: jest.fn().mockResolvedValue([]) } },
  { provide: require('../diet-agent/diet-agent.service').DietAgentService, useValue: { stateFor: jest.fn().mockResolvedValue('normale') } },
  { provide: require('./day-combo.service').DayComboService, useValue: new (require('./day-combo.service').DayComboService)() },
  { provide: require('./kcal-need.service').KcalNeedService, useValue: { computeTargetKcal: jest.fn().mockResolvedValue(null) } },
  { provide: require('../notifications/push.service').PushService, useValue: { sendToUser: jest.fn().mockResolvedValue(undefined) } },
];

const costruisci = async (prisma: unknown): Promise<MenuService> =>
  (await Test.createTestingModule({ providers: providers(prisma) }).compile()).get(MenuService);

describe('⛔ il ripristino di `redeliverFutureDays` non perde le aperture', () => {
  /**
   * ⛔ **UN RIPRISTINO CHE PERDE UNA COLONNA NON È UN RIPRISTINO: è una scrittura nuova travestita.**
   *
   * Qui si cancellano i giorni futuri, si prova a rierogare, e **se non esce niente si rimettono
   * com'erano** — un menu vecchio è meglio di nessun menu. Senza le due colonne, una giornata che la
   * cliente aveva **aperto davvero** tornava indietro come «non lo so»: il rifacimento automatico
   * successivo gliel'avrebbe cambiata sotto, cioè il danno esatto che questo lavoro impedisce.
   */
  it('⛔ rimette `apertoDallaClienteIl` e `apertureTracciate` com\'erano', async () => {
    const aperto = new Date('2026-08-25T07:30:00.000Z');
    const giorno = {
      id: 'g1', clientId: 'u1', date: new Date('2026-08-28T00:00:00.000Z'), dietId: 'd1', level: 1,
      meals: [{ slot: 'lunch', recipeId: 'r1' }], status: 'planned',
      visibleFrom: new Date('2026-08-20T00:00:00.000Z'), sourceRuleId: null,
      apertoDallaClienteIl: aperto, apertureTracciate: true,
    };
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      menuDay: {
        findMany: jest.fn().mockResolvedValue([giorno]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany,
      },
      // Il piano non è fermo, ma la rierogazione non produce niente: è il ramo del ripristino.
      calendarEvent: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      subscription: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = await costruisci(prisma);
    const esito = await service.redeliverFutureDays('u1');

    expect(esito.ripristinati).toBe(1);
    const rimesso = createMany.mock.calls[0][0].data[0];
    expect(rimesso.apertoDallaClienteIl).toEqual(aperto);
    expect(rimesso.apertureTracciate).toBe(true);
  });
});

/**
 * ⛔ **LA LISTA DELLA SPESA È LA TERZA SCHERMATA CHE APRE I GIORNI** — 26/8, trovato in revisione.
 *
 * Il segnale «aperto» lo manda l'app da due schermate: la Home (oggi) e il Menu (il giorno
 * selezionato). ⚠️ Ma la lista della spesa mette in mano alla cliente il contenuto di **sette giorni
 * futuri**, ed è **il caso che la regola cita per giustificarsi**: *«magari ci ha già fatto la
 * spesa»*. Senza questa marcatura, Giulia apriva la Home, toccava «Lista della spesa», comprava per
 * la settimana e non entrava mai nella scheda Menu — poi la nutrizionista dettava «niente pesce» e
 * il motore le rifaceva tutti i giorni comprati. ⛔ È una regressione che prima **non c'era**:
 * `viewedAt` copriva questo caso per sbaglio, e restringere il segnale al giorno guardato lo
 * scopriva.
 */
describe('⛔ la lista della spesa segna aperti i giorni che consegna', () => {
  it('⛔ i sette giorni della lista risultano aperti', async () => {
    const giorno = (n: number) => ({
      id: `g${n}`, date: new Date(`2026-08-2${n}T00:00:00.000Z`), meals: [{ slot: 'lunch', recipeId: 'r1' }],
    });
    const giorni = [giorno(7), giorno(8), giorno(9)];
    const updateMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = {
      menuDay: { findMany: jest.fn().mockResolvedValue(giorni), updateMany },
      clientProfile: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r1', ingredients: [] }]) },
      shoppingList: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ items: [] }) },
    };
    const service = await costruisci(prisma);
    await service.shoppingList('u1');

    // ⚠️ Una sola andata al database per tutti e sette, non una per giorno.
    expect(updateMany).toHaveBeenCalledTimes(1);
    const where = updateMany.mock.calls[0][0].where;
    expect(where.date.in.map((d: Date) => d.toISOString().slice(0, 10))).toEqual(['2026-08-27', '2026-08-28', '2026-08-29']);
    expect(where.apertoDallaClienteIl).toBeNull();
  });
});

describe('⛔ `segnaGiornoAperto`: si segna solo quello che ha davvero potuto vedere', () => {
  const fai = async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const profilo = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = { menuDay: { updateMany }, clientProfile: { updateMany: profilo } };
    const service = await costruisci(prisma);
    return { service, updateMany, profilo };
  };

  /**
   * ⚠️ **`visibleFrom` è la stessa condizione di `getMenu`**: l'app può dichiarare aperto solo un
   * giorno che aveva il permesso di mostrarle. Senza questo filtro una cliente potrebbe dichiarare
   * aperto un giorno che non ha mai visto e renderlo intoccabile per i rifacimenti.
   */
  it('⚠️ il `where` chiede `visibleFrom` e la prima volta soltanto', async () => {
    const { service, updateMany } = await fai();
    await service.segnaGiornoAperto('u1', '2026-08-27');
    const where = updateMany.mock.calls[0][0].where;
    expect(where.clientId).toBe('u1');
    expect(where.apertoDallaClienteIl).toBeNull();
    expect(where.visibleFrom).toHaveProperty('lte');
  });

  /**
   * ⚠️ `apertureDal` si scrive **solo se non c'è già**: è la data da cui sappiamo, e una data che si
   * riscrive a ogni apertura non è una data — sposterebbe il confine in avanti e i giorni composti
   * ieri tornerebbero «non lo so» per sempre.
   */
  it('⚠️ `apertureDal` si scrive solo la prima volta', async () => {
    const { service, profilo } = await fai();
    await service.segnaGiornoAperto('u1', '2026-08-27');
    expect(profilo.mock.calls[0][0].where).toMatchObject({ userId: 'u1', apertureDal: null });
  });

  /**
   * ⛔ **Non lancia mai.** Il menu è il lavoro, questa è la cronaca: se la scrittura va storta, la
   * cliente deve poter leggere il suo menu lo stesso. Al massimo quel giorno resta «non lo so» e
   * nessuno lo rifà — il degrado dalla parte giusta.
   */
  it('⛔ se il database rifiuta, non esplode in faccia a nessuno', async () => {
    const prisma = {
      menuDay: { updateMany: jest.fn().mockRejectedValue(new Error('colonna assente')) },
      clientProfile: { updateMany: jest.fn() },
    };
    const service = await costruisci(prisma);
    await expect(service.segnaGiornoAperto('u1', '2026-08-27')).resolves.toBeUndefined();
  });
});
