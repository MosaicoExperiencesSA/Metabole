/**
 * «QUESTA CLIENTE RICEVE I MENU?» — una domanda, una risposta.
 *
 * Questo file nasce per uccidere i falsi allarmi (il caso Rosaria, in testa a `piano-attivo.ts`), e
 * conteneva **due definizioni che non coincidevano**: il filtro escludeva il Monitoraggio,
 * `pianiDiClienti` lo dava per «attivo e riceve menu». L'autorità vera è `deliverIfEligible`, che a
 * quelle persone non manda niente.
 *
 * Decisione di Simone (12/8): una regola sola, quella dell'erogazione.
 */
import { pianiDiClienti } from './piano-attivo';
import type { PrismaService } from '../prisma/prisma.service';

const OGGI = new Date('2026-08-12T10:00:00Z');
const fra = (g: number) => new Date(OGGI.getTime() + g * 86_400_000);

function prismaFinto(over: Record<string, unknown> = {}) {
  return {
    subscription: {
      findMany: jest.fn().mockResolvedValue([
        { clientId: 'c-1', status: 'active', endDate: fra(30), plan: { name: 'Percorso 3 mesi', period: '3m' } },
      ]),
    },
    event: { findMany: jest.fn().mockResolvedValue([]) },
    clientProfile: { findMany: jest.fn().mockResolvedValue([]) },
    ...over,
  } as unknown as PrismaService;
}

describe('riceveMenu', () => {
  it('un percorso attivo riceve i menu', async () => {
    const out = await pianiDiClienti(prismaFinto(), ['c-1'], OGGI);
    expect(out.get('c-1')).toMatchObject({ stato: 'attivo', riceveMenu: true });
  });

  it('⚠️ il MONITORAGGIO è attivo ma NON riceve menu', async () => {
    // È il falso allarme del caso Rosaria: la diagnostica la contava fra le «attive» e stampava un
    // avviso su una dieta incompleta che a lei non sarebbe mai arrivata.
    const p = prismaFinto({
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          { clientId: 'c-1', status: 'active', endDate: fra(30), plan: { name: 'Monitoraggio', period: 'monitoring' } },
        ]),
      },
    });
    const out = await pianiDiClienti(p, ['c-1'], OGGI);
    expect(out.get('c-1')).toMatchObject({ stato: 'attivo', riceveMenu: false });
  });

  it('⚠️ «Monitoring» con la maiuscola è la stessa cosa', async () => {
    // Il Negozio salva `period` verbatim e accetta le maiuscole: un confronto sensibile alle
    // maiuscole farebbe rientrare la cliente per una lettera.
    const p = prismaFinto({
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          { clientId: 'c-1', status: 'active', endDate: null, plan: { name: 'Monitoraggio', period: 'Monitoring' } },
        ]),
      },
    });
    expect((await pianiDiClienti(p, ['c-1'], OGGI)).get('c-1')?.riceveMenu).toBe(false);
  });

  it('⚠️ in PAUSA vacanza non riceve menu: o ricevi menu, o sei in pausa', async () => {
    const p = prismaFinto({ event: { findMany: jest.fn().mockResolvedValue([{ clientId: 'c-1' }]) } });
    const out = await pianiDiClienti(p, ['c-1'], OGGI);
    // Il piano resta «attivo» — lo è — ma i menu non arrivano: sono due cose diverse.
    expect(out.get('c-1')).toMatchObject({ stato: 'attivo', riceveMenu: false });
  });

  it('⚠️ col piano FERMATO dal nutrizionista non riceve menu', async () => {
    const p = prismaFinto({ clientProfile: { findMany: jest.fn().mockResolvedValue([{ userId: 'c-1' }]) } });
    expect((await pianiDiClienti(p, ['c-1'], OGGI)).get('c-1')?.riceveMenu).toBe(false);
  });

  it('un piano scaduto ma ancora «active» non riceve niente', async () => {
    const p = prismaFinto({
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          { clientId: 'c-1', status: 'active', endDate: fra(-3), plan: { name: 'Percorso', period: '3m' } },
        ]),
      },
    });
    const out = await pianiDiClienti(p, ['c-1'], OGGI);
    expect(out.get('c-1')).toMatchObject({ stato: 'scaduto_da_chiudere', riceveMenu: false });
  });

  it('⚠️ se le due letture in più falliscono, l\'elenco esce lo stesso', async () => {
    // Una diagnostica che non parte perché un controllo accessorio è andato storto non serve a
    // nessuno: nel dubbio si risponde come prima.
    const p = prismaFinto({
      event: { findMany: jest.fn().mockRejectedValue(new Error('db giù')) },
      clientProfile: { findMany: jest.fn().mockRejectedValue(new Error('db giù')) },
    });
    expect((await pianiDiClienti(p, ['c-1'], OGGI)).get('c-1')?.riceveMenu).toBe(true);
  });

  it('nessun cliente: nessuna query', async () => {
    const p = prismaFinto();
    expect((await pianiDiClienti(p, [], OGGI)).size).toBe(0);
    expect((p as unknown as { subscription: { findMany: jest.Mock } }).subscription.findMany).not.toHaveBeenCalled();
  });
});
