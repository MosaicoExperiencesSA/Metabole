/**
 * IL GIRO CHE MANDA LE PUSH DEL DIGIUNO — i test.
 *
 * Il modulo puro sa già **cosa** mandare e cosa no. Qui si prova l'altra metà, che è quella dove i
 * difetti non si vedono: **quando**. Due cose contano più delle altre.
 *
 * ⛔ **La finestra guardata indietro.** Se il tic guardasse solo il minuto esatto, una notifica
 * cadrebbe ogni volta che il giro parte con qualche secondo di ritardo — e nessuno se ne
 * accorgerebbe, perché una push che non arriva non lascia traccia.
 *
 * ⛔ **La mezzanotte.** Un tic alle 00:05 deve guardare anche le 23:55 di ieri, o le push serali di
 * chi ha la finestra a cavallo della mezzanotte non partono mai.
 */
import { NotificationsService } from './notifications.service';
import type { PrismaService } from '../prisma/prisma.service';

const H = (ore: number, minuti = 0): number => ore * 60 + minuti;

function creaServizio(
  profili: Record<string, unknown>[],
  spente: string[] = [],
  opzioni: { senzaPiano?: boolean } = {},
) {
  const inviate: { userId: string; type: string; title: string }[] = [];
  const prisma: any = {
    clientProfile: { findMany: jest.fn().mockResolvedValue(profili) },
    // ⚠️ Il finto risponde come il vero: solo chi ha un piano attivo o in coda.
    subscription: {
      findMany: jest.fn().mockResolvedValue(
        opzioni.senzaPiano ? [] : profili.map((p) => ({ clientId: p.userId })),
      ),
    },
  };
  const service = new NotificationsService(
    prisma as unknown as PrismaService,
    {} as never, {} as never, {} as never, {} as never, {} as never,
  );
  // ⚠️ Si finge il minimo indispensabile: le due porte che questo giro attraversa.
  (service as unknown as { getPrefs: unknown }).getPrefs = jest.fn().mockResolvedValue({ disabledTypes: spente });
  (service as unknown as { notifyOncePerDay: unknown }).notifyOncePerDay = jest.fn(async (i: any) => {
    inviate.push({ userId: i.userId, type: i.type, title: i.title });
    return true;
  });
  return { service, inviate, prisma };
}

/** 18:6 dalle 13:00 → apertura 13:00, chiusura 19:00, dodici ore alle 07:00, sedici alle 11:00. */
const CLIENTE = {
  userId: 'u1',
  fastingProtocol: '18:6',
  fastingStartMin: H(13),
  fastingSleepStart: null,
  fastingSleepEnd: null,
};

const alle = (ore: number, minuti = 0) => new Date(`2026-08-21T${String(ore).padStart(2, '0')}:${String(minuti).padStart(2, '0')}:00+02:00`);

describe('⛔ manda quello il cui momento è appena passato', () => {
  beforeEach(() => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }); });
  afterEach(() => { jest.useRealTimers(); });

  it('all\'ora esatta parte', async () => {
    jest.setSystemTime(alle(13, 0));
    const { service, inviate } = creaServizio([CLIENTE]);
    const esito = await service.digiunoPushTick();
    expect(esito).toMatchObject({ guardate: 1, inviate: 1 });
    expect(inviate[0].type).toBe('digiuno_puoi_mangiare');
  });

  /**
   * ⛔ **Il tic in ritardo.** Il cron parte ogni dieci minuti e non al secondo: se si guardasse solo
   * il minuto esatto, una push su due si perderebbe — e una push che non arriva non lascia traccia
   * da nessuna parte.
   */
  it('⛔ nove minuti dopo parte lo stesso: il giro non è al secondo', async () => {
    jest.setSystemTime(alle(13, 9));
    const { service, inviate } = creaServizio([CLIENTE]);
    await service.digiunoPushTick();
    expect(inviate.map((i) => i.type)).toEqual(['digiuno_puoi_mangiare']);
  });

  /**
   * ⛔ **DIECI MINUTI ESATTI SONO DEL GIRO PRECEDENTE, non di questo.** La finestra è mezza aperta
   * apposta: se l'estremo appartenesse a tutti e due i tic, la stessa push verrebbe valutata due
   * volte. Dentro la giornata il dedup regge; **a cavallo della mezzanotte no** — la chiave è «una
   * al giorno», e alle 00:00 il giorno cambia. Sarebbero due notifiche a dieci minuti di distanza.
   */
  it('⛔ dieci minuti esatti no: l\'estremo appartiene a un tic solo', async () => {
    jest.setSystemTime(alle(13, 10));
    const { service, inviate } = creaServizio([CLIENTE]);
    await service.digiunoPushTick();
    expect(inviate).toHaveLength(0);
  });

  it('⚠️ e undici minuti dopo nemmeno', async () => {
    jest.setSystemTime(alle(13, 11));
    const { service, inviate } = creaServizio([CLIENTE]);
    await service.digiunoPushTick();
    expect(inviate).toHaveLength(0);
  });

  /**
   * ⛔ **Il dedup guarda anche la finestra.** Spostarla a metà giornata è una cosa che la cliente
   * può fare: senza la finestra nel payload, l'ultimo messaggio che le resta in mano sbaglia sia
   * l'ora d'inizio sia quella di fine, e le due push giuste sono zittite fino all'indomani.
   */
  it('⛔ il dedup porta con sé la finestra, non solo il tipo', async () => {
    jest.setSystemTime(alle(13, 0));
    const { service } = creaServizio([CLIENTE]);
    await service.digiunoPushTick();
    const chiamata = ((service as unknown as { notifyOncePerDay: jest.Mock }).notifyOncePerDay).mock.calls[0][0];
    expect(chiamata.dedupeSuPayload).toEqual({ finestra: '18:6@780' });
    expect(chiamata.payload).toEqual({ finestra: '18:6@780' });
  });

  it('⚠️ e prima del momento non parte niente', async () => {
    jest.setSystemTime(alle(12, 55));
    const { service, inviate } = creaServizio([CLIENTE]);
    await service.digiunoPushTick();
    expect(inviate).toHaveLength(0);
  });

  /**
   * ⛔ **La mezzanotte.** Chi chiude la finestra alle 23:55 riceve «inizia il tuo digiuno» a
   * quell'ora: il tic delle 00:05 deve guardare indietro **attraverso** la mezzanotte, o quella
   * push non parte mai. Il conto sul quadrante lo fa; una sottrazione normale darebbe un numero
   * negativo e la salterebbe.
   */
  it('⛔ un tic dopo la mezzanotte guarda anche ieri sera', async () => {
    jest.setSystemTime(alle(0, 2));
    /**
     * ⚠️ Una cliente che fa i turni di notte: dorme dalle 08:00 alle 16:00. È il caso per cui la
     * fascia di silenzio è **la sua** e non un orario fisso — col sonno predefinito 23:00-07:00
     * questa push si salterebbe, ed è giusto che si salti per chi a quell'ora dorme davvero.
     * Finestra 17:55 → 23:55: «inizia il tuo digiuno» alle 23:55, cioè dieci minuti fa.
     */
    const { service, inviate } = creaServizio([
      { ...CLIENTE, fastingStartMin: H(17, 55), fastingSleepStart: H(8), fastingSleepEnd: H(16) },
    ]);
    await service.digiunoPushTick();
    expect(inviate.map((i) => i.type)).toEqual(['digiuno_inizia']);
  });

  /**
   * ⚠️ La controprova: **la stessa cliente col sonno predefinito non riceve niente**, perché le
   * 23:55 cadono dentro 23:00-07:00. Senza questa riga il test sopra proverebbe la mezzanotte e
   * basta, e non si vedrebbe che le due regole si applicano insieme.
   */
  it('⚠️ mentre chi dorme dalle 23 quella push non la riceve', async () => {
    jest.setSystemTime(alle(0, 2));
    const { service, inviate } = creaServizio([{ ...CLIENTE, fastingStartMin: H(17, 55) }]);
    await service.digiunoPushTick();
    expect(inviate).toHaveLength(0);
  });
});

describe('⚠️ il sonno, le preferenze, e chi non si tocca', () => {
  beforeEach(() => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }); });
  afterEach(() => { jest.useRealTimers(); });

  /**
   * ⛔ Il ripiego 23:00–07:00 si applica **qui**, in un punto solo: le colonne nascono NULL perché
   * «non me l'ha detto» non è «dorme dalle 23». Le dodici ore di questa cliente cadono alle 07:00,
   * cioè **fuori** dal sonno predefinito per un minuto: e infatti partono.
   */
  it('⛔ col sonno predefinito le dodici ore delle 07:00 partono', async () => {
    jest.setSystemTime(alle(7, 0));
    const { service, inviate } = creaServizio([CLIENTE]);
    await service.digiunoPushTick();
    expect(inviate.map((i) => i.type)).toEqual(['digiuno_12_ore']);
  });

  it('⚠️ ma se lei dorme fino alle otto, quella push si salta', async () => {
    jest.setSystemTime(alle(7, 0));
    const { service, inviate } = creaServizio([
      { ...CLIENTE, fastingSleepStart: H(23), fastingSleepEnd: H(8) },
    ]);
    await service.digiunoPushTick();
    expect(inviate).toHaveLength(0);
  });

  it('chi ha spento un tipo non lo riceve', async () => {
    jest.setSystemTime(alle(13, 0));
    const { service, inviate } = creaServizio([CLIENTE], ['digiuno_puoi_mangiare']);
    await service.digiunoPushTick();
    expect(inviate).toHaveLength(0);
  });

  /**
   * ⚠️ La query chiede solo chi ha **davvero** un orologio: chi digiuna ma non ha ancora scelto non
   * deve ricevere niente — non c'è nessuna finestra da annunciare.
   */
  it('⚠️ si guardano solo le clienti con protocollo E orario', async () => {
    const { service, prisma } = creaServizio([CLIENTE]);
    await service.digiunoPushTick();
    const where = prisma.clientProfile.findMany.mock.calls[0][0].where;
    expect(where.pathType).toBe('intermittent_fasting');
    expect(where.fastingProtocol).toEqual({ not: null });
    expect(where.fastingStartMin).toEqual({ not: null });
  });

  /**
   * ⛔ **E SOLO CHI HA UN PIANO.** Una cliente col piano finito — o archiviata dall'admin, che le
   * lascia i token push — avrebbe continuato a ricevere sei notifiche al giorno sulla sua finestra
   * di digiuno **per sempre**. Tutti gli altri giri di questo file filtrano così; questo era
   * l'unico che non lo faceva.
   */
  it('⛔ chi non ha più un piano non riceve niente', async () => {
    jest.setSystemTime(alle(13, 0));
    const { service, inviate, prisma } = creaServizio([CLIENTE], [], { senzaPiano: true });
    const esito = await service.digiunoPushTick();
    expect(inviate).toHaveLength(0);
    expect(esito.guardate).toBe(0);
    // ⚠️ E non si legge nemmeno il profilo: senza nessuno da avvisare non c'è niente da chiedere.
    expect(prisma.clientProfile.findMany).not.toHaveBeenCalled();
  });

  /**
   * ⛔ Una cliente storta non ferma le altre: il giro passa ogni dieci minuti, e fermarsi a metà
   * vorrebbe dire che tutte quelle dopo di lei non ricevono niente per tutta la giornata.
   */
  it('⛔ un profilo che esplode non zittisce le altre', async () => {
    jest.setSystemTime(alle(13, 0));
    const { service, inviate } = creaServizio([
      { ...CLIENTE, userId: 'rotta' },
      { ...CLIENTE, userId: 'sana' },
    ]);
    const errore = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (service as unknown as { getPrefs: jest.Mock }).getPrefs
      .mockRejectedValueOnce(new Error('DB giù'))
      .mockResolvedValue({ disabledTypes: [] });
    const esito = await service.digiunoPushTick();
    expect(esito.guardate).toBe(2);
    expect(inviate.map((i) => i.userId)).toEqual(['sana']);
    expect(errore).toHaveBeenCalled();
    errore.mockRestore();
  });
});
