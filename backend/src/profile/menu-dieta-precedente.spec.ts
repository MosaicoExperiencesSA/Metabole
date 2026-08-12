/**
 * «I MENU SONO ANCORA QUELLI DELLA DIETA PRECEDENTE» — la versione che legge la CLIENTE.
 *
 * Il flag esisteva da sempre e l'app non lo usava. Nel collegarlo è venuto fuori che le due
 * versioni della stessa frase — quella dello staff e quella della cliente — usavano **regole
 * diverse**, e quella sbagliata era proprio quella che leggeva lei.
 */
import { ProfileService } from './profile.service';
import type { PrismaService } from '../prisma/prisma.service';

const OGGI = new Date();
const domani = () => { const d = new Date(OGGI); d.setDate(d.getDate() + 1); return d; };
const ieri = () => { const d = new Date(OGGI); d.setDate(d.getDate() - 1); return d; };

const VECCHIA = { name: 'Mediterranea', clientName: null, clientDescription: null, style: 'mediterranean' };
const NUOVA = { name: 'Mediterranea senza glutine', clientName: null, clientDescription: null, style: 'flexible' };

function creaServizio(opts: { ultimo?: unknown; inArrivo?: unknown[] } = {}) {
  const prisma: any = {
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        regime: 'omnivore', dietStyle: 'flexible', dietFamily: 'Mediterranea senza glutine',
        mealsPerDay: 5, pathType: 'five', fastingWindow: null, assignedCoach: null,
      }),
    },
    menuDay: {
      findFirst: jest.fn().mockResolvedValue(opts.ultimo ?? { diet: VECCHIA }),
      findMany: jest.fn().mockResolvedValue(opts.inArrivo ?? []),
    },
    diet: { findFirst: jest.fn().mockResolvedValue(NUOVA) },
  };
  return { service: new ProfileService(prisma as unknown as PrismaService, {} as never, {} as never, {} as never), prisma };
}

describe('l\'avviso alla cliente sui menu della dieta precedente', () => {
  it('⚠️ se le prossime giornate sono della dieta VECCHIA, si dice', async () => {
    const { service } = creaServizio({ inArrivo: [{ diet: VECCHIA }] });
    const n = (await service.nutrition('u1')) as { menuAncoraSullaDietaPrecedente: boolean; dietNameMenuInCorso: string | null };
    expect(n.menuAncoraSullaDietaPrecedente).toBe(true);
    // E si dice QUALE: «la dieta precedente» da sola non le fa capire cosa aspettarsi nel piatto.
    expect(n.dietNameMenuInCorso).toBe('Mediterranea');
  });

  it('⚠️ un menu VECCHIO in archivio NON accende l\'avviso', async () => {
    // È la correzione del 12/8 («se il menu è vecchio la segnalazione non ha senso, serve se i
    // futuri saranno sbagliati»), applicata allora solo al lato staff: la cliente continuava a
    // vedere la versione rumorosa, che confrontava l'ULTIMA giornata erogata.
    const { service } = creaServizio({ ultimo: { diet: VECCHIA }, inArrivo: [] });
    const n = (await service.nutrition('u1')) as { menuAncoraSullaDietaPrecedente: boolean };
    expect(n.menuAncoraSullaDietaPrecedente).toBe(false);
  });

  it('se le prossime giornate sono già quelle giuste, niente avviso', async () => {
    const { service } = creaServizio({ inArrivo: [{ diet: NUOVA }] });
    const n = (await service.nutrition('u1')) as { menuAncoraSullaDietaPrecedente: boolean };
    expect(n.menuAncoraSullaDietaPrecedente).toBe(false);
  });

  it('⚠️ basta UNA delle prossime sulla dieta vecchia', async () => {
    // Una rigenerazione parziale lascia giornate su due diete: se anche una sola è quella vecchia,
    // in quel giorno lei mangerà i piatti sbagliati.
    const { service } = creaServizio({ inArrivo: [{ diet: NUOVA }, { diet: VECCHIA }] });
    const n = (await service.nutrition('u1')) as { menuAncoraSullaDietaPrecedente: boolean };
    expect(n.menuAncoraSullaDietaPrecedente).toBe(true);
  });

  it('guarda solo da OGGI in avanti', async () => {
    const { service, prisma } = creaServizio();
    await service.nutrition('u1');
    const dove = prisma.menuDay.findMany.mock.calls[0][0];
    expect(dove.where.date.gte).toBeInstanceOf(Date);
    expect(dove.where.date.gte.getTime()).toBeLessThanOrEqual(domani().getTime());
    expect(dove.where.date.gte.getTime()).toBeGreaterThan(ieri().getTime() - 86_400_000);
    // `distinct` sulla dieta: bastano poche righe per rispondere alla domanda.
    expect(dove.distinct).toEqual(['dietId']);
  });

  it('giornate senza dieta collegata non fanno cadere niente', async () => {
    const { service } = creaServizio({ inArrivo: [{ diet: null }] });
    const n = (await service.nutrition('u1')) as { menuAncoraSullaDietaPrecedente: boolean };
    expect(n.menuAncoraSullaDietaPrecedente).toBe(false);
  });
});
