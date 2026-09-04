import { BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

/**
 * ⛔ **IL CABLAGGIO DEI DUE CANCELLI, e non la regola.**
 *
 * La regola sta in `ricetta-che-si-puo-scrivere.ts` e ha le sue prove. Queste tengono fermo il
 * **montaggio**, che è dove una revisione avversariale ha misurato che si poteva togliere metà dei
 * due cancelli con la suite intera verde: `ricetta-che-si-puo-scrivere.spec.ts` collauda la
 * funzione pura, e nessuno guardava i due `throw`.
 *
 * ⚠️ *Le prove sul modulo puro non provano il montaggio* — è la lezione del 3/9, e qui il punto di
 * cucitura decide cosa entra in catalogo.
 */

const CON_POLLO = [{ name: 'farro' }, { name: 'petto di pollo' }];

function servizio(esistente?: Record<string, unknown>) {
  const create = jest.fn().mockImplementation(({ data }: never) => Promise.resolve({ id: 'r1', ...(data as object) }));
  const update = jest.fn().mockImplementation(({ data }: never) => Promise.resolve({ id: 'r1', ...(data as object) }));
  const log = jest.fn().mockResolvedValue(undefined);
  const prisma = {
    recipe: {
      create,
      update,
      findUnique: jest.fn().mockResolvedValue(esistente ?? null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    dietDayTemplate: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const audit = { log } as unknown as AuditService;
  const config = { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } as unknown as ConfigParamsService;
  const notifications = {} as unknown as NotificationsService;
  return { s: new CatalogService(prisma, audit, config, notifications), create, update, log };
}

const BASE = { name: 'Insalata tiepida', regime: 'omnivore', mealSlot: 'lunch', kcal: 500, ingredients: CON_POLLO } as never;

describe('⛔ l\'elenco ingredienti vuoto FERMA la creazione', () => {
  it('⛔ non si scrive niente in catalogo', async () => {
    const { s, create } = servizio();
    await expect(s.createRecipe('u1', { ...(BASE as object), ingredients: [] } as never)).rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  /** ⛔ E il caso che `@ArrayMinSize` non vede: le righe ci sono, i nomi no. */
  it('⛔ nemmeno con righe senza nome dentro', async () => {
    const { s, create } = servizio();
    await expect(s.createRecipe('u1', { ...(BASE as object), ingredients: [{ qty: 100 }] } as never))
      .rejects.toThrow(/nessun nome dentro/);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('⚠️ il regime che il contenuto smentisce CHIEDE', () => {
  it('⚠️ al primo tentativo risponde «Da confermare» e non scrive', async () => {
    const { s, create } = servizio();
    await expect(s.createRecipe('u1', { ...(BASE as object), regime: 'vegetarian' } as never))
      .rejects.toThrow(/^Da confermare:.*petto di pollo/s);
    expect(create).not.toHaveBeenCalled();
  });

  /** ⛔ Con la conferma passa: «Polpo di ceci» esiste, e bloccare vorrebbe dire non poterlo scrivere. */
  it('⛔ con la conferma scrive, e la forzatura resta nel registro', async () => {
    const { s, create, log } = servizio();
    await s.createRecipe('u1', { ...(BASE as object), regime: 'vegetarian', confermaRegime: true } as never);
    expect(create).toHaveBeenCalled();
    const scritto = log.mock.calls.find((c) => c[0].action === 'catalog.recipe.create')![0];
    expect(scritto.metadata?.regimeForzato).toContain('petto di pollo');
  });

  /** ⚠️ E quello che non si smentisce non chiede niente. */
  it('⚠️ un piatto coerente passa al primo colpo', async () => {
    const { s, create } = servizio();
    await s.createRecipe('u1', BASE);
    expect(create).toHaveBeenCalled();
  });
});

describe('⛔ in MODIFICA i cancelli valgono solo su chi tocca quelle cose', () => {
  const SBAGLIATA = { id: 'r1', name: 'Insalata tiepida', regime: 'vegetarian', ingredients: CON_POLLO, allergensReviewed: false, verifiedAt: null };

  /**
   * ⛔ **QUESTA È LA PROVA CHE SBLOCCA VERA.** Approvare una ricetta dettata è
   * `updateRecipe(id, { active: true })` (`vera/registro.service.ts`), e quel chiamante non ha
   * nessun modo di mandare `confermaRegime`. Facendo girare il cancello su ogni salvataggio, il capo
   * nutrizionista prendeva un 400 su un difetto che non aveva introdotto, e la proposta restava in
   * coda **per sempre**. L'ha trovato una revisione avversariale.
   */
  it('⛔ accendere una ricetta col regime gia sbagliato in catalogo NON si blocca', async () => {
    const { s, update } = servizio(SBAGLIATA);
    await s.updateRecipe('u1', 'r1', { active: true } as never);
    expect(update).toHaveBeenCalled();
  });

  /** ⚠️ E nemmeno correggere il nome: sistemare il regime è un altro gesto, e lo fa chi lo vede. */
  it('⚠️ nemmeno cambiare il solo nome', async () => {
    const { s, update } = servizio(SBAGLIATA);
    await s.updateRecipe('u1', 'r1', { name: 'Insalata tiepida di farro' } as never);
    expect(update).toHaveBeenCalled();
  });

  /** ⛔ Ma chi tocca il regime o gli ingredienti risponde della coppia che lascia. */
  it('⛔ chi tocca il regime deve confermare', async () => {
    const { s, update } = servizio({ ...SBAGLIATA, regime: 'omnivore' });
    await expect(s.updateRecipe('u1', 'r1', { regime: 'vegetarian' } as never)).rejects.toThrow(/^Da confermare:/);
    expect(update).not.toHaveBeenCalled();
  });

  it('⛔ e chi mette la carne dentro un piatto vegetariano pure', async () => {
    const { s, update } = servizio({ ...SBAGLIATA, ingredients: [{ name: 'farro' }] });
    await expect(s.updateRecipe('u1', 'r1', { ingredients: CON_POLLO } as never)).rejects.toThrow(/^Da confermare:/);
    expect(update).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ **La forzatura resta scritta anche in modifica**, ed è la porta più probabile delle due: il
   * difetto è tipicamente già in catalogo, quindi chi lo forza lo forza modificando.
   */
  it('⚠️ e con la conferma la forzatura finisce nel registro', async () => {
    const { s, update, log } = servizio({ ...SBAGLIATA, regime: 'omnivore' });
    await s.updateRecipe('u1', 'r1', { regime: 'vegetarian', confermaRegime: true } as never);
    expect(update).toHaveBeenCalled();
    const scritto = log.mock.calls.find((c) => c[0].action === 'catalog.recipe.update')![0];
    expect(scritto.metadata?.regimeForzato).toContain('petto di pollo');
  });

  /**
   * ⛔ **E una ricetta che l'elenco vuoto ce l'ha GIÀ non diventa impossibile da correggere**: ce ne
   * sono in catalogo (`diag:senza-ingredienti` le conta), e chi apre quella scheda per sistemare un
   * refuso si troverebbe il salvataggio chiuso proprio sul difetto che sta andando a chiudere.
   */
  it('⛔ una ricetta gia senza ingredienti si puo ancora correggere', async () => {
    const { s, update } = servizio({ id: 'r1', name: 'Branzino al forno', regime: 'pescetarian', ingredients: [], allergensReviewed: false, verifiedAt: null });
    await s.updateRecipe('u1', 'r1', { name: 'Branzino al forno con verdure' } as never);
    expect(update).toHaveBeenCalled();
  });
});
