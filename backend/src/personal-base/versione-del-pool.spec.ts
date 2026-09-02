/**
 * ⛔ **LA VERSIONE DEL POOL È DELLA CLIENTE, NON DELLA COPPIA (CLIENTE, DIETA)** — 2/9.
 *
 * Fino a oggi `buildPersonalBase` numerava `where: { clientId, dietId }`, mentre **tutti e quattro**
 * i lettori cercano per sola cliente e prendono la versione più alta:
 *
 * · `getStatus` — lo stato che vede la cliente nell'app;
 * · `sostituzione-chat.candidatiPerSlot` — il cambio di piatto in chat;
 * · `vera-chat.poolDellaCliente` — la giornata dettata dalla nutrizionista;
 * · la verifica del certificato, che cerca `{ clientId, version }`.
 *
 * ⛔ Una cliente con quattro ricostruzioni sulla dieta vecchia (v1…v4) spostata su una famiglia
 * nuova otteneva un pool **v1**: la base si rifaceva, e i lettori continuavano a pescare il v4
 * della dieta vecchia. È il difetto che rendeva **inutile** ogni ricostruzione dopo un cambio di
 * famiglia — compresa quella aggiunta lo stesso giorno alla scheda del backoffice.
 *
 * ⚠️ Questa prova non guarda il `where` nel sorgente: guarda il **numero scritto**, che è la cosa
 * che i lettori leggono davvero.
 */
import { PersonalBaseService } from './personal-base.service';
import type { PrismaService } from '../prisma/prisma.service';

const ricette = () =>
  Array.from({ length: 40 }, (_, i) => ({
    id: `r${i}`,
    mealSlot: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'][i % 5],
    allergens: [] as string[],
    allergensReviewed: true,
    regime: 'omnivore',
    active: true,
    name: `Piatto ${i}`,
  }));

/** ⚠️ `poolEsistenti` è quello che il database RESTITUISCE alla domanda del contatore. */
function servizio(poolEsistenti: { version: number; dietId: string }[], dietaCorrente: string) {
  const scritti: Record<string, unknown>[] = [];
  const prisma = {
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        regime: 'omnivore', dietStyle: 'mediterranean', dietFamily: 'Mediterranea',
        mealsPerDay: 5, pathType: 'five', fastingWindow: null, objective: 'dimagrimento',
        allergies: [], allergiesOther: [], assignedNutritionistId: null,
      }),
    },
    diet: { findFirst: jest.fn().mockResolvedValue({ id: dietaCorrente }) },
    dietDayTemplate: {
      findMany: jest.fn().mockResolvedValue([{ meals: ricette().map((r) => ({ slot: r.mealSlot, recipeId: r.id })) }]),
    },
    recipe: { findMany: jest.fn().mockResolvedValue(ricette()) },
    clientMenuPool: {
      /**
       * ⛔ Il finto si comporta come il database: rispetta il `where` che gli arriva. Un finto che
       * rendesse sempre lo stesso numero non potrebbe distinguere le due versioni del codice, ed è
       * il modo in cui una prova sembra piena e non prova niente.
       */
      findFirst: jest.fn((args: { where: { clientId: string; dietId?: string } }) => {
        const candidati = args.where.dietId
          ? poolEsistenti.filter((p) => p.dietId === args.where.dietId)
          : poolEsistenti;
        const max = candidati.reduce((n, p) => Math.max(n, p.version), 0);
        return Promise.resolve(max ? { version: max } : null);
      }),
      create: jest.fn((args: { data: Record<string, unknown> }) => {
        scritti.push(args.data);
        return Promise.resolve(args.data);
      }),
    },
    personalizationCertificate: { findFirst: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
    escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const service = new PersonalBaseService(
    prisma as unknown as PrismaService,
    { getString: jest.fn(async (_k: string, d?: string) => d), getNumber: jest.fn((_k: string, d?: number) => Promise.resolve(d ?? 3)) } as never,
    { log: jest.fn().mockResolvedValue(undefined) } as never,
  );
  return { service, scritti };
}

describe('⛔ il numero di versione che i lettori leggeranno', () => {
  /**
   * ⛔ **IL CASO CHE ROMPEVA.** Quattro ricostruzioni su `dieta-vecchia`, poi la cliente passa a
   * `dieta-nuova`: il pool nuovo deve avere la versione **più alta di tutte**, o non lo trova
   * nessuno.
   */
  it('⛔ dopo un cambio di famiglia il pool nuovo è il più alto, non riparte da 1', async () => {
    const vecchi = [1, 2, 3, 4].map((version) => ({ version, dietId: 'dieta-vecchia' }));
    const { service, scritti } = servizio(vecchi, 'dieta-nuova');
    await service.buildPersonalBase('c1');
    expect(scritti).toHaveLength(1);
    expect(scritti[0].dietId).toBe('dieta-nuova');
    expect(scritti[0].version).toBe(5);
    /** ⚠️ Il punto vero: chi cerca «la versione più alta di questa cliente» trova il pool nuovo. */
    const piuAlta = Math.max(...vecchi.map((p) => p.version), scritti[0].version as number);
    expect(piuAlta).toBe(scritti[0].version);
  });

  /**
   * ⛔ **Il pareggio era il caso peggiore**: una sola versione vecchia dava v1 contro v1, e vinceva
   * l'ordine del database — cioè a caso, cioè a intermittenza.
   */
  it('⛔ e nemmeno pareggia quando la dieta vecchia ha una versione sola', async () => {
    const { service, scritti } = servizio([{ version: 1, dietId: 'dieta-vecchia' }], 'dieta-nuova');
    await service.buildPersonalBase('c1');
    expect(scritti[0].version).toBe(2);
  });

  it('⚠️ sulla stessa dieta il conto avanza come prima', async () => {
    const { service, scritti } = servizio([{ version: 3, dietId: 'd1' }], 'd1');
    await service.buildPersonalBase('c1');
    expect(scritti[0].version).toBe(4);
  });

  it('⚠️ e la prima base di una cliente è la 1', async () => {
    const { service, scritti } = servizio([], 'd1');
    await service.buildPersonalBase('c1');
    expect(scritti[0].version).toBe(1);
  });
});
