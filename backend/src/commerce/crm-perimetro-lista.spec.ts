/**
 * IL PERIMETRO DELLA LISTA CRM — quello che l'unificazione delle due tabelle poteva rompere.
 *
 * Dall'11/8 l'elenco **Clienti** del backoffice è la stessa lista di «Gestione lead» con il filtro
 * «ha pagato» (§16.4). Ma le due pagine non avevano lo stesso perimetro: `crm.list` restringeva solo
 * per **coach**, mentre l'elenco Clienti restringe anche per **nutrizionista**. Unificarle senza
 * accorgersene avrebbe dato a ogni nutrizionista la vista su tutte le clienti dell'azienda — in
 * silenzio, perché una lista più lunga non somiglia a un errore.
 *
 * Questi test guardano il `where` che finisce a Prisma, non il risultato: è l'unico punto in cui la
 * regola è visibile prima che i dati escano.
 */
import { CrmService } from './crm.service';
import type { PrismaService } from '../prisma/prisma.service';

const NESSUNO = '00000000-0000-0000-0000-000000000000';

/** Prisma finto che CATTURA il `where` della lista. */
function prismaFinto(ruolo: string, staffId: string | null = 's-io') {
  const catturato: { where?: Record<string, unknown> } = {};
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ role: ruolo }) },
    staff: {
      findUnique: jest.fn().mockResolvedValue(staffId === null ? null : { id: staffId }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    crmRecord: {
      findMany: jest.fn().mockImplementation((args: { where?: Record<string, unknown> }) => {
        catturato.where = args?.where;
        return Promise.resolve([]);
      }),
      count: jest.fn().mockResolvedValue(0),
    },
    // `list` usa $transaction([findMany, count]): qui le due promise sono già risolte.
    $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;
  return { prisma, catturato };
}

function servizio(prisma: PrismaService) {
  return new CrmService(prisma, {} as never, {} as never, {} as never, {} as never, {} as never);
}

/** Le condizioni della lista stanno tutte in `where.AND`. */
function condizioni(where: Record<string, unknown> | undefined): Record<string, unknown>[] {
  return ((where?.AND as Record<string, unknown>[]) ?? []);
}

describe('crm.list — perimetro di chi guarda', () => {
  it('la NUTRIZIONISTA vede solo le clienti assegnate a lei', async () => {
    const { prisma, catturato } = prismaFinto('nutritionist', 's-nutri');
    await servizio(prisma).list({}, 'u-nutri');
    expect(condizioni(catturato.where)).toContainEqual({
      client: { clientProfile: { assignedNutritionistId: { in: ['s-nutri'] } } },
    });
  });

  it("la nutrizionista SENZA scheda staff non vede tutto: non vede niente", async () => {
    const { prisma, catturato } = prismaFinto('nutritionist', null);
    await servizio(prisma).list({}, 'u-nutri');
    expect(condizioni(catturato.where)).toContainEqual({
      client: { clientProfile: { assignedNutritionistId: { in: [NESSUNO] } } },
    });
  });

  it('la COACH resta com\'era: filtrata sul campo del CRM, non sulla cliente collegata', async () => {
    const { prisma, catturato } = prismaFinto('coach', 's-anna');
    await servizio(prisma).list({}, 'u-coach');
    const c = condizioni(catturato.where);
    expect(c).toContainEqual({ assignedCoachId: { in: ['s-anna'] } });
    // ⚠️ Se qui comparisse anche il filtro sulla cliente, la coach perderebbe i lead che una
    // cliente collegata non ce l'hanno ancora: cioè quasi tutti i suoi.
    expect(JSON.stringify(c)).not.toContain('assignedNutritionistId');
  });

  it("l'admin non ha perimetro: nessuna delle due condizioni", async () => {
    const { prisma, catturato } = prismaFinto('admin');
    await servizio(prisma).list({}, 'u-admin');
    const testo = JSON.stringify(condizioni(catturato.where));
    expect(testo).not.toContain('assignedNutritionistId');
    expect(testo).not.toContain('assignedCoachId');
  });

  /**
   * ⚠️ **«Cliente» sono DUE colonne dal 25/8**: «Acquisito» e «In sospensione», dove le schede
   * sostano mentre i menu sono fermi (vacanza, ricovero, esami). Con il confronto vecchio — la sola
   * `paid` — una cliente in vacanza col piano pagato spariva dall'elenco Clienti e compariva fra i
   * **lead**, cioè fra chi non ha ancora comprato.
   */
  it('il filtro «tipo=client» dell\'elenco Clienti prende «Acquisito» E «In sospensione»', async () => {
    const { prisma, catturato } = prismaFinto('admin');
    await servizio(prisma).list({ tipo: 'client' }, 'u-admin');
    expect(condizioni(catturato.where)).toContainEqual({ stage: { in: ['paid', 'in_sospensione'] } });
  });

  it('⛔ e chi è in sospensione NON finisce fra i lead', async () => {
    const { prisma, catturato } = prismaFinto('admin');
    await servizio(prisma).list({ tipo: 'lead' }, 'u-admin');
    const testo = JSON.stringify(condizioni(catturato.where));
    expect(testo).toContain('notIn');
    expect(testo).toContain('in_sospensione');
  });
});
