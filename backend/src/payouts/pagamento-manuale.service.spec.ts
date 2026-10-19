import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { decryptBuffer, deriveKey } from '../health-area/crypto.util';
import { PayoutsService } from './payouts.service';

/**
 * «REGISTRA PAGAMENTO» DAL BACKOFFICE (19/10).
 *
 * ⚠️ Il finto Prisma FILTRA DAVVERO: per `staffId`, per categoria, per intervallo di date sul
 * registro e per `status` sui prelievi. Il caso che conta è il mese in corso: se il servizio
 * leggesse solo i mesi chiusi (il «prelevabile») invece di tutto il maturato, un finto che ignora
 * le date lo lascerebbe passare — e il pagamento di Simone verrebbe rifiutato in produzione.
 */
describe('PayoutsService — pagamento registrato dall’admin', () => {
  const CHIAVE = 'chiave-di-prova-lunga-abbastanza';
  const giorno = (iso: string) => new Date(`${iso}T12:00:00+02:00`);
  let service: PayoutsService;
  let righe: { staffId: string; category: string; amountCents: number; date: Date }[];
  let prelievi: any[];
  let prisma: any;
  let mail: { sendCommissionWithdrawalPaid: jest.Mock };
  let metodi: string;

  const operatore = { sub: 'u-admin', role: 'admin' } as any;
  const pdf = { fileName: 'contabile.pdf', mimeType: 'application/pdf', contentBase64: Buffer.from('%PDF-bonifico').toString('base64') };

  beforeEach(async () => {
    righe = [];
    prelievi = [];
    metodi = 'Bonifico Unicredit\nContanti';
    const dentro = (r: { date: Date }, d?: { gte?: Date; lt?: Date }) => {
      if (!d) return true;
      if (d.gte && r.date < d.gte) return false;
      if (d.lt && r.date >= d.lt) return false;
      return true;
    };
    const righeDi = (where: any) =>
      righe.filter(
        (r) =>
          (where.staffId === undefined || (typeof where.staffId === 'string' ? r.staffId === where.staffId : true)) &&
          (where.category?.in ? where.category.in.includes(r.category) : true) &&
          dentro(r, where.date),
      );
    const prelieviDi = (where: any) => prelievi.filter((w) => (!where.staffId || w.staffId === where.staffId) && (!where.status || w.status === where.status));
    const raggruppa = <T extends { staffId: string; amountCents: number }>(rows: T[]) => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(r.staffId, (m.get(r.staffId) ?? 0) + r.amountCents);
      return [...m.entries()].map(([staffId, v]) => ({ staffId, _sum: { amountCents: v } }));
    };
    const persone: Record<string, any> = {
      s1: { id: 's1', userId: 'u1', displayName: 'Daniela Moreno', iban: 'IT60X0542811101000000123456', earningsCapCents: null, user: { email: 'daniela@x.it', locale: 'it', role: 'coach' } },
      s2: { id: 's2', userId: 'u2', displayName: 'Ilaria Stefani', iban: null, earningsCapCents: null, user: { email: 'ilaria@x.it', locale: 'it', role: 'coach' } },
      sa: { id: 'sa', userId: 'u-admin', displayName: 'Admin', iban: null, user: null },
    };
    prisma = {
      staff: {
        findUnique: jest.fn(async ({ where }: any) => (where.id ? persone[where.id] : Object.values(persone).find((p) => p.userId === where.userId)) ?? null),
        findMany: jest.fn(async ({ where }: any) => Object.values(persone).filter((p) => where.id.in.includes(p.id))),
      },
      ledgerEntry: {
        aggregate: jest.fn(async ({ where }: any) => ({ _sum: { amountCents: righeDi(where).reduce((a, r) => a + r.amountCents, 0) } })),
        groupBy: jest.fn(async ({ where }: any) => raggruppa(righeDi(where))),
      },
      commissionWithdrawal: {
        aggregate: jest.fn(async ({ where }: any) => ({ _sum: { amountCents: prelieviDi(where).reduce((a, w) => a + w.amountCents, 0) } })),
        groupBy: jest.fn(async ({ where }: any) => raggruppa(prelieviDi(where))),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(async ({ where }: any) => prelievi.find((w) => w.id === where.id) ?? null),
        create: jest.fn(async ({ data }: any) => {
          const w = { id: `w${prelievi.length + 1}`, requestedAt: new Date(), receiptData: null, ...data };
          prelievi.push(w);
          return w;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const w = prelievi.find((x) => x.id === where.id);
          Object.assign(w, data);
          return w;
        }),
      },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    mail = { sendCommissionWithdrawalPaid: jest.fn().mockResolvedValue(true) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => CHIAVE } },
        { provide: MailService, useValue: mail },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: ConfigParamsService, useValue: { getString: jest.fn(async () => metodi) } },
      ],
    }).compile();
    service = moduleRef.get(PayoutsService);
    jest.useFakeTimers().setSystemTime(giorno('2026-10-19'));
  });

  afterEach(() => jest.useRealTimers());

  const compenso = (staffId: string, data: string, amountCents: number, category = 'sales_commission') =>
    righe.push({ staffId, category, amountCents, date: giorno(data) });

  it('si paga anche il MESE IN CORSO: settembre chiuso + ottobre in maturazione, tutto insieme', async () => {
    compenso('s1', '2026-09-20', 100_00);
    compenso('s1', '2026-10-05', 117_25);

    const out: any = await service.registerManualPayment(operatore, {
      staffId: 's1', amountCents: 217_25, paidOn: '2026-10-18', paidWith: 'Bonifico Unicredit', proof: pdf,
    });

    const data = prisma.commissionWithdrawal.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ staffId: 's1', amountCents: 217_25, status: 'paid', manual: true, paidWith: 'Bonifico Unicredit', approvedById: 'sa' });
    // Nessun IBAN scritto: si usa quello salvato sulla persona.
    expect(data.iban).toBe('IT60X0542811101000000123456');
    // Mezzogiorno a Roma del giorno del bonifico, non l'istante in cui si clicca.
    expect(data.paidAt.toISOString()).toBe('2026-10-18T10:00:00.000Z');
    // La contabile è cifrata, e si decifra nel file di partenza.
    expect(Buffer.from(data.proofData).toString()).not.toContain('%PDF');
    expect(decryptBuffer(Buffer.from(data.proofData), deriveKey(CHIAVE)).toString()).toBe('%PDF-bonifico');
    // Fuori escono il «c'è», non i byte.
    expect(out.proofData).toBeUndefined();
    expect(out.hasProof).toBe(true);
    expect(mail.sendCommissionWithdrawalPaid).toHaveBeenCalledWith('daniela@x.it', expect.objectContaining({ amountCents: 217_25, richiesto: false }), 'it');
    expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', type: 'payout_paid' }) }));
  });

  it('oltre quanto resta da pagare: rifiutato, e NON si scrive niente', async () => {
    compenso('s1', '2026-10-05', 217_25);
    await expect(service.registerManualPayment(operatore, { staffId: 's1', amountCents: 217_26, paidOn: '2026-10-19' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.commissionWithdrawal.create).not.toHaveBeenCalled();
    expect(mail.sendCommissionWithdrawalPaid).not.toHaveBeenCalled();
  });

  it('il già pagato conta, e conta solo quello della stessa persona e solo se pagato', async () => {
    compenso('s1', '2026-09-10', 300_00);
    prelievi.push({ id: 'p1', staffId: 's1', amountCents: 200_00, status: 'paid' });
    prelievi.push({ id: 'p2', staffId: 's1', amountCents: 50_00, status: 'requested' }); // in attesa: NON si sottrae
    prelievi.push({ id: 'p3', staffId: 's2', amountCents: 90_00, status: 'paid' }); // di un'altra persona
    await expect(service.registerManualPayment(operatore, { staffId: 's1', amountCents: 100_01, paidOn: '2026-10-19' })).rejects.toThrow(/100,00 €/);
    await service.registerManualPayment(operatore, { staffId: 's1', amountCents: 100_00, paidOn: '2026-10-19' });
    expect(prisma.commissionWithdrawal.create).toHaveBeenCalledTimes(1);
  });

  it('una data nel futuro è un refuso: rifiutata, niente scritto', async () => {
    compenso('s1', '2026-10-05', 217_25);
    await expect(service.registerManualPayment(operatore, { staffId: 's1', amountCents: 100, paidOn: '2026-10-20' })).rejects.toThrow(/futuro/);
    expect(prisma.commissionWithdrawal.create).not.toHaveBeenCalled();
  });

  it('«con cosa» deve essere una voce di Parametri; vuoto va bene', async () => {
    compenso('s1', '2026-10-05', 217_25);
    await expect(service.registerManualPayment(operatore, { staffId: 's1', amountCents: 100, paidOn: '2026-10-19', paidWith: 'Carta azindale' })).rejects.toThrow(/Con cosa si paga/);
    expect(prisma.commissionWithdrawal.create).not.toHaveBeenCalled();
    await service.registerManualPayment(operatore, { staffId: 's1', amountCents: 100, paidOn: '2026-10-19', paidWith: '' });
    expect(prisma.commissionWithdrawal.create.mock.calls[0][0].data.paidWith).toBeNull();
  });

  it('un IBAN scritto si controlla con la cifra di controllo; senza IBAN né salvato, si paga lo stesso', async () => {
    compenso('s2', '2026-10-05', 32_50);
    await expect(service.registerManualPayment(operatore, { staffId: 's2', amountCents: 100, paidOn: '2026-10-19', iban: 'IT60X0542811101000000123457' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.commissionWithdrawal.create).not.toHaveBeenCalled();
    await service.registerManualPayment(operatore, { staffId: 's2', amountCents: 32_50, paidOn: '2026-10-19', paidWith: 'Contanti' });
    expect(prisma.commissionWithdrawal.create.mock.calls[0][0].data.iban).toBe('');
    // E la mail non scrive «IBAN: » vuoto: riceve la stringa vuota e la riga la toglie lei.
    expect(mail.sendCommissionWithdrawalPaid.mock.calls[0][1].iban).toBe('');
  });

  it('la contabile si carica solo su un pagamento fatto', async () => {
    prelievi.push({ id: 'r1', staffId: 's1', amountCents: 10_00, status: 'requested', proofData: null });
    prelievi.push({ id: 'p1', staffId: 's1', amountCents: 10_00, status: 'paid', proofData: null });
    await expect(service.uploadProof(operatore, 'r1', pdf)).rejects.toThrow(/già fatto/);
    expect(prisma.commissionWithdrawal.update).not.toHaveBeenCalled();
    await expect(service.uploadProof(operatore, 'p1', { ...pdf, mimeType: 'text/html' })).rejects.toThrow(/Formato/);
    const out: any = await service.uploadProof(operatore, 'p1', pdf);
    expect(out.hasProof).toBe(true);
    const scaricata = await service.downloadProof('p1');
    expect(Buffer.from(scaricata.contentBase64, 'base64').toString()).toBe('%PDF-bonifico');
    expect(scaricata.fileName).toBe('contabile.pdf');
  });

  it('il portafoglio dice «anticipato» quando il pagato supera i mesi chiusi', async () => {
    compenso('s1', '2026-09-20', 100_00);
    compenso('s1', '2026-10-05', 117_25);
    prelievi.push({ id: 'p1', staffId: 's1', amountCents: 217_25, status: 'paid' });
    const w: any = await service.myWallet('u1');
    expect(w.prelevabileCents).toBe(0);
    expect(w.anticipatoCents).toBe(117_25);
    expect(w.inMaturazioneCents).toBe(117_25);
  });

  it('l’elenco di chi pagare: residuo per persona, chi ha più da avere in cima', async () => {
    compenso('s2', '2026-10-05', 32_50);
    compenso('s1', '2026-09-20', 100_00);
    compenso('s1', '2026-10-05', 117_25, 'visit_compensation');
    compenso('s1', '2026-10-06', 999_00, 'altro'); // non è un compenso: non conta
    prelievi.push({ id: 'p1', staffId: 's1', amountCents: 17_25, status: 'paid' });
    prelievi.push({ id: 'p2', staffId: 's2', amountCents: 10_00, status: 'requested' });
    const out = await service.listPayees();
    expect(out.map((p) => [p.staffId, p.maturatoCents, p.pagatoCents, p.residuoCents, p.richiestaInAttesaCents])).toEqual([
      ['s1', 217_25, 17_25, 200_00, 0],
      ['s2', 32_50, 0, 32_50, 10_00],
    ]);
  });
});
