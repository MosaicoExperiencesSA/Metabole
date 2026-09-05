import { NutrientFactsController } from './nutrient-facts.controller';

/**
 * ⛔ **QUANDO UNA PERSONA GUARDA GLI ALLERGENI DI UNA RIGA, RESTA SCRITTO CHE LI HA GUARDATI.**
 *
 * Sembra un dettaglio di registro e non lo è: `allergens` vuoto vuol dire «non si sa», e una
 * nutrizionista che apre «mela» e dichiara «li ho guardati, non ne ha» lascia sul database un
 * elenco vuoto **identico** a quello di partenza. Senza il segno, l'agente notturno lo legge come
 * «non lo sa nessuno» e ci scrive sopra la sua ipotesi — cioè l'AI che disfa la decisione di una
 * persona, in silenzio, la notte stessa.
 */

function monta() {
  const prisma = {
    nutrientFact: { update: jest.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'nf-1', ...a.data })) },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'st-1' }) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { prisma, controller: new NutrientFactsController(prisma as never, audit as never, {} as never) };
}

const utente = { sub: 'u-1' } as never;

describe('PATCH /nutrient-facts/:id — gli allergeni scritti a mano', () => {
  it('⛔ scrivere gli allergeni lascia il segno di chi li ha guardati', async () => {
    const { prisma, controller } = monta();
    await controller.update('nf-1', { allergens: ['latte'] }, utente);
    expect(prisma.nutrientFact.update.mock.calls[0][0].data).toMatchObject({
      allergens: ['latte'],
      allergensFilledBy: 'persona',
    });
  });

  it('⛔ vale anche per «li ho guardati, non ne ha»: è la risposta che l\'agente non deve disfare', async () => {
    const { prisma, controller } = monta();
    await controller.update('nf-1', { allergens: [] }, utente);
    expect(prisma.nutrientFact.update.mock.calls[0][0].data).toMatchObject({ allergens: [], allergensFilledBy: 'persona' });
  });

  it('⚠️ chi corregge solo le kcal non tocca il segno degli allergeni: non li ha guardati', async () => {
    const { prisma, controller } = monta();
    await controller.update('nf-1', { kcal: 52 }, utente);
    expect(prisma.nutrientFact.update.mock.calls[0][0].data).not.toHaveProperty('allergensFilledBy');
    expect(prisma.nutrientFact.update.mock.calls[0][0].data).not.toHaveProperty('allergens');
  });

  it('⛔ un codice che non esiste non entra: un allergene che nessuno vedrebbe più', async () => {
    const { prisma, controller } = monta();
    await expect(controller.update('nf-1', { allergens: ['nichel'] }, utente)).rejects.toThrow(/sconosciuto/i);
    expect(prisma.nutrientFact.update).not.toHaveBeenCalled();
  });
});
