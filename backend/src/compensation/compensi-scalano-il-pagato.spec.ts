import { CompensationController } from './compensation.controller';

/**
 * «LE HO PAGATE A STELLA MA NON LE HA SCALATE» (19/10). Il modulo puro è provato a parte: qui si
 * prova che la pagina lo USA, e lo usa col mese giusto e con i pagamenti della persona giusta.
 * ⚠️ Il finto filtra davvero per date, persona e stato: un finto che ignora il `where` renderebbe
 * uguali «ottobre» e «Tutto», e la prova non vedrebbe un mese sbagliato.
 */
describe('Compensi — pagato e da pagare', () => {
  const g = (iso: string) => new Date(`${iso}T12:00:00+02:00`);
  const righe = [
    { staffId: 'stella', amountCents: 99_90, category: 'sales_commission', date: g('2026-10-05') },
    { staffId: 'daniela', amountCents: 100_00, category: 'sales_commission', date: g('2026-09-10') },
    { staffId: 'daniela', amountCents: 217_25, category: 'sales_commission', date: g('2026-10-07') },
  ];
  const pagamenti = [
    { staffId: 'stella', amountCents: 99_90, status: 'paid' },
    { staffId: 'daniela', amountCents: 150_00, status: 'paid' },
    { staffId: 'daniela', amountCents: 999_00, status: 'requested' }, // in attesa: non è pagato
  ];
  const dentro = (d: Date, w?: { gte?: Date; lt?: Date }) => !w || ((!w.gte || d >= w.gte) && (!w.lt || d < w.lt));
  const prisma = {
    ledgerEntry: {
      findMany: jest.fn(async ({ where }: any) =>
        righe.filter((r) => (typeof where.staffId === 'object' && where.staffId.in ? where.staffId.in.includes(r.staffId) : true) && dentro(r.date, where.date)),
      ),
    },
    commissionWithdrawal: {
      groupBy: jest.fn(async ({ where }: any) => {
        const m = new Map<string, number>();
        for (const p of pagamenti) if (p.status === where.status && where.staffId.in.includes(p.staffId)) m.set(p.staffId, (m.get(p.staffId) ?? 0) + p.amountCents);
        return [...m.entries()].map(([staffId, v]) => ({ staffId, _sum: { amountCents: v } }));
      }),
    },
    staff: {
      findMany: jest.fn(async ({ where }: any) => where.id.in.map((id: string) => ({ id, displayName: id, earningsCapCents: null, user: { role: 'coach' } }))),
    },
  };
  const ctrl = new CompensationController(prisma as never);
  const di = (rows: any[], id: string) => rows.find((r) => r.staffId === id);

  it('ottobre: Stella saldata; Daniela ha 150 che coprono prima settembre (100), 50 vanno su ottobre', async () => {
    const rows = await ctrl.list('2026-10');
    expect(di(rows, 'stella')).toMatchObject({ totalCents: 99_90, paidCents: 99_90, dueCents: 0 });
    expect(di(rows, 'daniela')).toMatchObject({ totalCents: 217_25, paidCents: 50_00, dueCents: 167_25 });
  });

  it('settembre: Daniela saldata', async () => {
    const rows = await ctrl.list('2026-09');
    expect(di(rows, 'daniela')).toMatchObject({ totalCents: 100_00, paidCents: 100_00, dueCents: 0 });
    expect(di(rows, 'stella')).toBeUndefined();
  });

  it('«Tutto»: maturato totale meno pagato, le richieste in attesa non contano', async () => {
    const rows = await ctrl.list(undefined);
    expect(di(rows, 'daniela')).toMatchObject({ totalCents: 317_25, paidCents: 150_00, dueCents: 167_25 });
  });
});
