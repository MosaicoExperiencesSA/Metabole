import { ClientsService } from './clients.service';

/**
 * ⛔ **QUANDO È LO STAFF A TOCCARE UNA PESATA, I SEGNALI DEVONO PARTIRE LO STESSO** (28/8, trovato
 * in revisione della consegna sul blocco delle pesate incoerenti).
 *
 * Il controllo era stato messo su `POST /me/measurements`, che è la rotta **della cliente**
 * (`@Controller('me')`, `@Roles('client')`). Lo staff passa da un'altra porta —
 * `PATCH /admin/clients/:id/measurements/:id` → `updateMeasurement` — e lì non girava niente: né la
 * segnalazione clinica al nutrizionista né il controllo sulle pesate.
 *
 * ⚠️ Il buco non era teorico: quella rotta accetta **25–400 kg** (il DTO della cliente si ferma a
 * 35–250), quindi è proprio il punto in cui una pesata impossibile può *nascere* — dalle mani di chi
 * la sta sistemando. E il rimedio che la consegna documenta («la coach corregge il numero») passa da
 * qui: se qui non gira niente, il giro non si chiude mai.
 */
const servizio = (controlla: jest.Mock) => {
  const prisma = {
    measurement: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'm1', weightKg: 73, waistCm: null, hipsCm: null, thighsCm: null, date: new Date('2026-08-20T00:00:00.000Z'),
      }),
      update: jest.fn().mockImplementation(({ data }: never) => Promise.resolve({ id: 'm1', ...(data as object) })),
    },
  };
  // ⚠️ `MenuService`: dal 28/8 una pesata corretta rifà i giorni futuri — il peso è cambiato, quindi
  // le calorie pure, e se la pesata teneva sospeso il fabbisogno sistemarla lo riaccende.
  const menu = { redeliverFutureDays: jest.fn().mockResolvedValue({ removed: 0, delivered: [] }) };
  const s = new ClientsService(
    prisma as never,
    {} as never,
    { log: jest.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    menu as never,
    {} as never,
    {} as never,
    {} as never,
    { controllaPesoIncoerente: controlla } as never,
    { buildPersonalBase: jest.fn().mockResolvedValue({}) } as never,
  );
  (s as unknown as { assertClientAccess: () => Promise<void> }).assertClientAccess = () => Promise.resolve();
  return { s, prisma, menu };
};

describe('⛔ la pesata corretta dallo staff passa dallo stesso guardrail', () => {
  const SALTO = { dal: new Date('2026-08-13T00:00:00.000Z'), al: new Date('2026-08-20T00:00:00.000Z'), daKg: 73, aKg: 113, giorni: 7, salto: 40, ritmo: 40 };

  it('⛔ dopo la scrittura chiama il controllo sulle pesate incoerenti', async () => {
    const controlla = jest.fn().mockResolvedValue(null);
    const { s, prisma } = servizio(controlla);
    await s.updateMeasurement('cli-1', 'staff-1', 'm1', { weightKg: 74 });
    // ⚠️ Col secondo argomento: l'audit deve dire che l'ha innescato lo staff, non la cliente.
    expect(controlla).toHaveBeenCalledWith('cli-1', 'staff-1');
    // ⚠️ DOPO, non prima: il controllo deve vedere i numeri come sono adesso.
    expect(prisma.measurement.update.mock.invocationCallOrder[0]).toBeLessThan(controlla.mock.invocationCallOrder[0]);
  });

  it('⛔ e la coppia che non torna esce nella risposta, a chi ha appena digitato', async () => {
    const { s } = servizio(jest.fn().mockResolvedValue(SALTO));
    const out = await s.updateMeasurement('cli-1', 'staff-1', 'm1', { weightKg: 113 });
    expect((out as { pesoIncoerente: unknown }).pesoIncoerente).toEqual(SALTO);
  });

  /**
   * ⛔ **E I GIORNI FUTURI SI RIFANNO.** Senza, la correzione della pesata non arriva nel piatto:
   * la cliente continua a mangiare i giorni costruiti sul peso sbagliato. ⚠️ E quando la coppia
   * corretta era quella che teneva il fabbisogno **sospeso**, sistemarla lo riaccende — ma i menu
   * restavano al livello della dieta, e la frase «i menu la prendono appena la pesata sarà corretta»
   * sarebbe stata una promessa vuota.
   */
  it('⛔ e rifà i giorni futuri: una pesata corretta cambia le calorie', async () => {
    const { s, menu } = servizio(jest.fn().mockResolvedValue(null));
    await s.updateMeasurement('cli-1', 'staff-1', 'm1', { weightKg: 74 });
    expect(menu.redeliverFutureDays).toHaveBeenCalledWith('cli-1');
  });

  it('⚠️ e se la rierogazione fallisce la correzione resta salvata lo stesso', async () => {
    const { s } = servizio(jest.fn().mockResolvedValue(null));
    (s as unknown as { menu: { redeliverFutureDays: jest.Mock } }).menu.redeliverFutureDays =
      jest.fn().mockRejectedValue(new Error('menu giù'));
    await expect(s.updateMeasurement('cli-1', 'staff-1', 'm1', { weightKg: 74 })).resolves.toBeDefined();
  });

  /** ⚠️ Un guardrail che cade non deve far fallire la correzione — ma non deve nemmeno tacere. */
  it('⚠️ se il controllo esplode, la correzione va a buon fine lo stesso', async () => {
    const { s } = servizio(jest.fn().mockRejectedValue(new Error('database giù')));
    const out = await s.updateMeasurement('cli-1', 'staff-1', 'm1', { weightKg: 74 });
    expect((out as { pesoIncoerente: unknown }).pesoIncoerente).toBeNull();
  });
});
