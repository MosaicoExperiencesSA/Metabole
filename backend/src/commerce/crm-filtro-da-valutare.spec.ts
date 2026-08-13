/**
 * «SOLO DA VALUTARE» — il filtro deve arrivare al DATABASE, non alla pagina.
 *
 * L'elenco Clienti pagina a cento per volta, stampa un totale in cima ed esporta in Excel tutte le
 * pagine chiedendone dieci di fila. Se il filtro vivesse sulle righe già scaricate, il totale
 * direbbe un numero e la tabella ne mostrerebbe un altro — e l'Excel dichiarerebbe un filtro che non
 * ha applicato. Questi test guardano il `where` che finisce a Prisma: è il punto in cui la
 * differenza è ancora visibile.
 */
import { CrmService } from './crm.service';
import { filtroDaValutare } from '../clients/idoneita';
import type { PrismaService } from '../prisma/prisma.service';

/** Prisma finto che cattura il `where` della lista (stesso stampo di `crm-perimetro-lista.spec`). */
function prismaFinto(ruolo = 'admin') {
  const catturato: { where?: Record<string, unknown> } = {};
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ role: ruolo }) },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 's-io' }), findMany: jest.fn().mockResolvedValue([]) },
    crmRecord: {
      findMany: jest.fn().mockImplementation((args: { where?: Record<string, unknown> }) => {
        catturato.where = args?.where;
        return Promise.resolve([]);
      }),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
  return { prisma, catturato };
}

function servizio(prisma: PrismaService) {
  return new CrmService(prisma, {} as never, {} as never, {} as never, {} as never, {} as never);
}

function condizioni(where: Record<string, unknown> | undefined): Record<string, unknown>[] {
  return (where?.AND as Record<string, unknown>[]) ?? [];
}

describe('crm.list — il filtro «solo da valutare»', () => {
  it('acceso, la condizione arriva a Prisma', async () => {
    const { prisma, catturato } = prismaFinto();
    await servizio(prisma).list({ tipo: 'client', daValutare: true }, 'u-admin');
    expect(condizioni(catturato.where)).toContainEqual({ client: { clientProfile: filtroDaValutare() } });
  });

  it('⚠️ e la condizione è QUELLA di `idoneita.ts`, non una copia scritta qui', async () => {
    // Se questo file se la riscrivesse, l'elenco filtrato e la pastiglia potrebbero contare in modo
    // diverso senza che nessun test se ne accorga: sarebbe il difetto che il filtro doveva chiudere.
    const { prisma, catturato } = prismaFinto();
    await servizio(prisma).list({ tipo: 'client', daValutare: true }, 'u-admin');
    const trovata = condizioni(catturato.where).find((c) => 'client' in c) as
      | { client: { clientProfile: Record<string, unknown> } }
      | undefined;
    expect(trovata?.client.clientProfile).toEqual(filtroDaValutare());
  });

  it('spento, l\'elenco resta esattamente com\'era', async () => {
    const { prisma, catturato } = prismaFinto();
    await servizio(prisma).list({ tipo: 'client' }, 'u-admin');
    expect(JSON.stringify(condizioni(catturato.where))).not.toContain('screeningFlag');
  });

  it('⚠️ non sostituisce gli altri filtri: si somma a loro', async () => {
    // La nutrizionista lo usa dentro il suo perimetro, e chi cerca un nome mentre il filtro è acceso
    // deve cercarlo FRA le da valutare. Un filtro che ne spegne un altro è il modo in cui una
    // ricerca «senza risultati» diventa una cliente che non si trova più.
    const { prisma, catturato } = prismaFinto();
    await servizio(prisma).list({ tipo: 'client', daValutare: true, search: 'bianchi' }, 'u-admin');
    const c = condizioni(catturato.where);
    expect(c).toContainEqual({ client: { clientProfile: filtroDaValutare() } });
    expect(c).toContainEqual({ stage: 'paid' });
    expect(JSON.stringify(c)).toContain('bianchi');
  });
});
