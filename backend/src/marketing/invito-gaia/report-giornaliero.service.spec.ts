import { InvitoGaiaService } from './invito-gaia.service';

/**
 * Il report del mattino dal servizio (19/10). ⚠️ Il finto Prisma guarda il `where`: quale campo è
 * «not null» decide quale elenco esce, e un finto che restituisse sempre tutto renderebbe uguali
 * «hanno cliccato» e «sono entrate».
 */
describe('InvitoGaiaService.mandaReportGiornaliero', () => {
  const ADESSO = new Date('2026-10-20T05:00:00Z');
  const scheda = (id: string, phone: string | null = null) => ({ id, email: `${id}@x.it`, name: null, firstName: id, lastName: 'Rossi', phone });
  const inviti = [
    { id: 'i1', clickedAt: new Date('2026-10-19T18:00:00Z'), enteredAt: new Date('2026-10-19T19:00:00Z'), email: 'anna@x.it', crmRecord: scheda('anna', '333') },
    { id: 'i2', clickedAt: new Date('2026-10-01T10:00:00Z'), enteredAt: null, email: 'bea@x.it', crmRecord: scheda('bea') },
    { id: 'i3', clickedAt: null, enteredAt: null, email: 'carla@x.it', crmRecord: scheda('carla') },
  ];

  function costruisci(opz: { destinatari?: string; giaInviatiOggi?: string[]; inviti?: typeof inviti } = {}) {
    const elenco = opz.inviti ?? inviti;
    const filtra = (where: Record<string, unknown>) =>
      elenco.filter((i) => Object.keys(where).every((k) => (i as Record<string, unknown>)[k] != null));
    const prisma = {
      gaiaInvite: {
        count: jest.fn(async ({ where }: any) => filtra(where).length),
        findMany: jest.fn(async ({ where }: any) => filtra(where)),
      },
      emailLog: {
        findMany: jest.fn(async ({ where }: any) => {
          expect(where.templateKey).toBe('gaia_report_giornaliero');
          expect(where.status).toBe('sent');
          // Da mezzanotte di Roma: il 20/10 comincia alle 22:00 UTC del 19.
          expect(where.createdAt.gte.toISOString()).toBe('2026-10-19T22:00:00.000Z');
          return (opz.giaInviatiOggi ?? []).filter((t) => where.to.in.includes(t)).map((to) => ({ to }));
        }),
      },
    };
    const mail = { send: jest.fn().mockResolvedValue(true) };
    const config = { get: jest.fn((k: string) => ({ BACKOFFICE_URL: 'https://bo.x/' } as Record<string, string>)[k]) };
    const params = { getString: jest.fn(async (k: string, f: string) => (k === 'gaia_invito_report_destinatari' ? opz.destinatari ?? 'giusy@metabole.eu' : f)) };
    const svc = new InvitoGaiaService(prisma as never, mail as never, {} as never, config as never, params as never, {} as never);
    return { svc, prisma, mail };
  }

  it('manda a Giusy i due elenchi, ciascuno con il suo filtro', async () => {
    const { svc, mail } = costruisci();
    expect(await svc.mandaReportGiornaliero(ADESSO)).toEqual({ inviati: 1, nota: null });
    const m = mail.send.mock.calls[0][0];
    expect(m.to).toBe('giusy@metabole.eu');
    expect(m.templateKey).toBe('gaia_report_giornaliero');
    expect(m.html).toContain('Hanno cliccato: 2');
    expect(m.html).toContain('Sono entrate: 1');
    expect(m.html).toContain('https://bo.x/crm/lead/bea');
    expect(m.html).not.toContain('carla@x.it');
    expect(m.subject).toContain('1 nuovi clic, 1 nuove entrate');
  });

  it('chi l’ha già ricevuto oggi non lo riceve di nuovo; gli altri sì', async () => {
    const { svc, mail } = costruisci({ destinatari: 'giusy@metabole.eu\nsimone@x.it', giaInviatiOggi: ['giusy@metabole.eu'] });
    expect(await svc.mandaReportGiornaliero(ADESSO)).toEqual({ inviati: 1, nota: null });
    expect(mail.send.mock.calls.map((c) => c[0].to)).toEqual(['simone@x.it']);
  });

  it('parametro vuoto = spento, e non si legge nemmeno il database', async () => {
    const { svc, mail, prisma } = costruisci({ destinatari: '  ' });
    expect(await svc.mandaReportGiornaliero(ADESSO)).toEqual({ inviati: 0, nota: 'nessun destinatario' });
    expect(mail.send).not.toHaveBeenCalled();
    expect(prisma.gaiaInvite.findMany).not.toHaveBeenCalled();
  });

  it('se nessuno ha ancora cliccato non parte una mail vuota', async () => {
    const { svc, mail } = costruisci({ inviti: [inviti[2]] });
    expect(await svc.mandaReportGiornaliero(ADESSO)).toEqual({ inviati: 0, nota: 'niente da riferire' });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('un invio fallito si dice', async () => {
    const { svc, mail } = costruisci();
    mail.send.mockResolvedValueOnce(false);
    expect(await svc.mandaReportGiornaliero(ADESSO)).toEqual({ inviati: 0, nota: '1 non partiti (vedi registro email)' });
  });
});
