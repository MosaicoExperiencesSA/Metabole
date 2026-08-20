/**
 * §16.8 — il tetto di guadagno mensile applicato dove passano DAVVERO tutti gli accrediti.
 *
 * `tetto-compensi.spec.ts` verifica l'aritmetica; qui si verifica l'innesto: che `creditStaff`
 * lo consulti, che legga il maturato dal REGISTRO CONTABILE (e non dal contatore
 * `StaffCompensation`, che gli storni azzerano), che a tetto saturo non scriva una riga da zero
 * euro, e soprattutto che un tetto **non impostato** non tocchi niente — è il caso di tutti i
 * nutrizionisti oggi, ed è quello che non deve cambiare comportamento.
 */
import { Test } from '@nestjs/testing';
import { giornoDelMeseLocale } from '../common/date-only';
import { inizioMese } from '../common/tetto-compensi';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceService } from './finance.service';

describe('FinanceService — tetto di guadagno mensile (§16.8)', () => {
  let service: FinanceService;
  let prisma: any;
  let audit: { log: jest.Mock };

  /** Imposta il tetto della persona (in centesimi) e quanto ha già maturato nel mese. */
  function scenario(tettoCents: number | null, maturatoCents: number) {
    prisma.staff.findUnique.mockResolvedValue({ earningsCapCents: tettoCents });
    prisma.ledgerEntry.aggregate.mockResolvedValue({ _sum: { amountCents: maturatoCents } });
  }

  beforeEach(async () => {
    audit = { log: jest.fn() };
    prisma = {
      ledgerEntry: { create: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
      staffCompensation: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      staff: { findUnique: jest.fn().mockResolvedValue({ earningsCapCents: null }) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: { getNumber: jest.fn(() => Promise.resolve(undefined)) } },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(FinanceService);
  });

  const accredita = (amountCents: number) =>
    service.creditStaff({ staffId: 'staff-n', amountCents, kind: 'sales_commission', ref: 'pay-1', clientId: 'c1' });

  it('senza tetto accredita tutto e non va nemmeno a leggere il registro', async () => {
    // Il comportamento di oggi per chiunque: deve restare identico, e costare zero query in più.
    scenario(null, 0);
    const esito = await accredita(44_55);

    expect(esito).toEqual({ erogatoCents: 44_55, tagliatoCents: 0 });
    expect(prisma.ledgerEntry.aggregate).not.toHaveBeenCalled();
    expect(prisma.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amountCents: 44_55, staffId: 'staff-n' }) }),
    );
  });

  it('⚠️ tetto a ZERO vale «nessun tetto»: non azzera il compenso in silenzio', async () => {
    // Il campo svuotato nel form arriva come 0. Se questo test cade, qualcuno smette di essere pagato.
    scenario(0, 2_000_00);
    const esito = await accredita(44_55);
    expect(esito.erogatoCents).toBe(44_55);
    expect(esito.tagliatoCents).toBe(0);
  });

  it('sotto il tetto accredita per intero', async () => {
    scenario(3_000_00, 1_200_00);
    const esito = await accredita(44_55);
    expect(esito).toEqual({ erogatoCents: 44_55, tagliatoCents: 0 });
    expect(prisma.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amountCents: 44_55 }) }),
    );
  });

  it('a cavallo del tetto accredita la parte che ci sta, con la nota che dice perché', async () => {
    scenario(3_000_00, 2_980_00);
    const esito = await accredita(44_55);

    expect(esito).toEqual({ erogatoCents: 20_00, tagliatoCents: 24_55 });
    const riga = prisma.ledgerEntry.create.mock.calls[0][0].data;
    expect(riga.amountCents).toBe(20_00);
    expect(riga.note).toContain('Tetto mensile');
    // Il contatore del periodo cresce dell'importo VERO, non della quota del piano.
    expect(prisma.staffCompensation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ amountCents: { increment: 20_00 } }) }),
    );
  });

  it('tetto saturo: nessuna riga da zero euro nel registro, ma l\'audit resta', async () => {
    scenario(3_000_00, 3_000_00);
    const esito = await accredita(44_55);

    expect(esito).toEqual({ erogatoCents: 0, tagliatoCents: 44_55 });
    expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
    expect(prisma.staffCompensation.upsert).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'provvigione.tetto_mensile',
        entityId: 'staff-n',
        metadata: expect.objectContaining({ tagliatoCents: 44_55, erogatoCents: 0 }),
      }),
    );
  });

  it('l\'eccedenza NON diventa un accantonamento: si perde e basta', async () => {
    // Decisione dell'11/8. Se un giorno si vorrà il contrario, questo test è il posto da cui partire.
    scenario(3_000_00, 3_000_00);
    await accredita(44_55);
    expect(prisma.pendingCommission).toBeUndefined(); // il servizio non l'ha nemmeno cercata
  });

  it('il maturato del mese si legge dal REGISTRO, non dal contatore del periodo', async () => {
    // `StaffCompensation.amountCents` viene decrementato con un `Math.max(0, …)` quando si storna un
    // acquisto: dopo uno storno più grande del residuo non è più il numero vero. Il registro sì,
    // perché lo storno lì è una riga negativa — ed è anche il numero che la persona vede nel suo
    // portafoglio.
    scenario(3_000_00, 1_000_00);
    await accredita(10_00);

    const where = prisma.ledgerEntry.aggregate.mock.calls[0][0].where;
    expect(where.staffId).toBe('staff-n');
    expect(where.category).toEqual({ in: ['sales_commission', 'visit_compensation'] });
    expect(where.date.gte).toBeInstanceOf(Date);
    // Il primo del mese **a Roma**, non nel fuso del processo. La riga era
    // `where.date.gte.getDate()).toBe(1)`, che è la formula stessa che il 20/8 si è rivelata
    // sbagliata: mezzanotte di Roma dell'1 settembre sono le 22:00 UTC del 31 agosto, e su Render
    // `getDate()` risponde 31. Un test che misura con lo strumento rotto certifica il difetto.
    expect(giornoDelMeseLocale(where.date.gte)).toBe(1);
    expect(where.date.gte.getTime()).toBe(inizioMese().getTime());
  });

  it('uno storno libera spazio sotto il tetto: il maturato negativo conta', async () => {
    scenario(3_000_00, 2_900_00 - 100_00);
    const esito = await accredita(150_00);
    expect(esito.erogatoCents).toBe(150_00);
    expect(esito.tagliatoCents).toBe(0);
  });

  it('importo non positivo: esce subito, senza toccare niente', async () => {
    scenario(3_000_00, 0);
    expect(await accredita(0)).toEqual({ erogatoCents: 0, tagliatoCents: 0 });
    expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    expect(prisma.ledgerEntry.create).not.toHaveBeenCalled();
  });
});
