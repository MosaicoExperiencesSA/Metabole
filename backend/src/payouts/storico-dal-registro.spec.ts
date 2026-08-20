import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PayoutsService } from './payouts.service';

/**
 * «STORICO MESI» E «SALDO PRELEVABILE» DEVONO PARLARE DELLO STESSO MESE.
 *
 * Il difetto (20/8): lo storico arrivava da `StaffCompensation`, il resto della schermata dal
 * registro contabile. Il caso che li fa divergere è ordinario — **un rimborso a cavallo di due
 * mesi**: lo storno scrive a registro una riga negativa datata OGGI e insieme decrementa il
 * contatore del mese ORIGINALE. La coach vedeva il saldo calcolato su 100 e, due centimetri sotto,
 * «Agosto € 60,00».
 *
 * ⚠️ **Il finto Prisma qui sotto FILTRA DAVVERO** per `staffId`, `category` e per l'intervallo di
 * date. Un doppione che ignora il `where` restituisce sempre tutte le righe: il test passerebbe
 * anche con il codice vecchio, e non verificherebbe niente. Mi è già successo sei volte in due
 * giorni, e questa volta la cosa che il `where` decide sono i mesi.
 */
describe('PayoutsService — lo storico mesi si legge dal registro', () => {
  let service: PayoutsService;
  let righe: { staffId: string; category: string; amountCents: number; date: Date }[];

  /** Mezzogiorno a Roma del giorno indicato: lontano da qualunque confine, in qualunque stagione. */
  const giorno = (iso: string) => new Date(`${iso}T12:00:00+02:00`);

  beforeEach(async () => {
    righe = [];
    const dentro = (r: { date: Date }, w: Record<string, { gte?: Date; lt?: Date }>) => {
      const d = w.date;
      if (!d) return true;
      if (d.gte && r.date < d.gte) return false;
      if (d.lt && r.date >= d.lt) return false;
      return true;
    };
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 's1', iban: null, earningsCapCents: null }) },
      ledgerEntry: {
        findMany: jest.fn(async ({ where }: any) =>
          righe.filter(
            (r) =>
              r.staffId === where.staffId &&
              (where.category?.in ? where.category.in.includes(r.category) : true) &&
              dentro(r, where),
          ),
        ),
        /**
         * ⚠️ **`aggregate` somma davvero, con lo stesso filtro di `findMany`.** Stubbarlo a zero è
         * quello che ho fatto al primo giro, e il test è diventato rosso su una cosa vera: il
         * portafoglio legge da qui, e un doppione che risponde sempre zero avrebbe fatto sembrare
         * il saldo prelevabile sbagliato. *Un test double che si comporta diversamente
         * dall'originale non verifica niente* — e stavolta lo ha detto il test, non un difetto in
         * produzione.
         */
        aggregate: jest.fn(async ({ where }: any) => ({
          _sum: {
            amountCents: righe
              .filter(
                (r) =>
                  r.staffId === where.staffId &&
                  (where.category?.in ? where.category.in.includes(r.category) : true) &&
                  dentro(r, where),
              )
              .reduce((a, r) => a + r.amountCents, 0),
          },
        })),
      },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: { findMany: jest.fn().mockResolvedValue([]) },
      // ⚠️ C'è, e deve restare a zero: se lo storico tornasse a leggerlo, questo test se ne accorge.
      staffCompensation: { findMany: jest.fn().mockResolvedValue([{ period: '2026-07', amountCents: 99_99 }]) },
      commissionWithdrawal: { aggregate: jest.fn(async () => ({ _sum: { amountCents: 0 } })), findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PayoutsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => 'chiave-di-prova-lunga-abbastanza' } },
        { provide: MailService, useValue: {} },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(PayoutsService);
    jest.useFakeTimers().setSystemTime(giorno('2026-09-15'));
  });

  afterEach(() => jest.useRealTimers());

  const provvigione = (data: string, amountCents: number) =>
    righe.push({ staffId: 's1', category: 'sales_commission', amountCents, date: giorno(data) });

  it('il rimborso di settembre resta a settembre: agosto vale quello che agosto ha incassato', async () => {
    provvigione('2026-08-10', 100_00);
    provvigione('2026-09-05', -40_00); // storno di quell'acquisto, registrato oggi

    const e = (await service.myEarnings('u1')) as { totalCents: number; history: { period: string; amountCents: number }[] };

    // Il mese in corso porta lo storno...
    expect(e.totalCents).toBe(-40_00);
    // ...e agosto resta 100, che è quello su cui è calcolato il saldo prelevabile due righe sotto.
    expect(e.history).toEqual([{ period: '2026-08', amountCents: 100_00 }]);
  });

  it('lo stesso numero del saldo prelevabile: i mesi chiusi sommati fanno il prelevabile', async () => {
    provvigione('2026-07-03', 50_00);
    provvigione('2026-08-10', 100_00);
    provvigione('2026-09-05', -40_00);

    const [e, w] = (await Promise.all([service.myEarnings('u1'), service.myWallet('u1')])) as any[];
    const sommaStorico = e.history.reduce((a: number, h: any) => a + h.amountCents, 0);
    expect(sommaStorico).toBe(w.prelevabileCents);
    expect(w.prelevabileCents).toBe(150_00);
  });

  it('il mese in corso NON compare nello storico (sarebbe lo stesso numero due volte)', async () => {
    provvigione('2026-09-05', 30_00);
    const e = (await service.myEarnings('u1')) as any;
    expect(e.period).toBe('2026-09');
    expect(e.history.map((h: any) => h.period)).not.toContain('2026-09');
    expect(e.totalCents).toBe(30_00);
  });

  it('i mesi tornano dal più recente al più vecchio, e si fermano a sei indietro', async () => {
    provvigione('2026-08-10', 10_00);
    provvigione('2026-07-10', 20_00);
    provvigione('2026-06-10', 30_00);
    provvigione('2026-03-10', 40_00); // sei mesi prima: ci sta ancora
    provvigione('2026-01-10', 50_00); // otto mesi prima: fuori
    const e = (await service.myEarnings('u1')) as any;
    expect(e.history.map((h: any) => h.period)).toEqual(['2026-08', '2026-07', '2026-06', '2026-03']);
  });

  it('un mese con più righe si somma, e un mese con saldo zero non sparisce', async () => {
    provvigione('2026-08-02', 30_00);
    provvigione('2026-08-20', 12_50);
    provvigione('2026-07-02', 20_00);
    provvigione('2026-07-28', -20_00); // stornato dentro lo stesso mese: luglio vale zero, ma è successo
    const e = (await service.myEarnings('u1')) as any;
    expect(e.history).toEqual([
      { period: '2026-08', amountCents: 42_50 },
      { period: '2026-07', amountCents: 0 },
    ]);
  });

  it('⚠️ il contatore aggregato non viene più letto: è la fonte che divergeva', async () => {
    provvigione('2026-08-10', 100_00);
    const e = (await service.myEarnings('u1')) as any;
    // Il finto `staffCompensation` restituisce luglio 99,99 €: se comparisse, lo storico lo sta
    // ancora leggendo.
    expect(e.history).toEqual([{ period: '2026-08', amountCents: 100_00 }]);
  });
});
