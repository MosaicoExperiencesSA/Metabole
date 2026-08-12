/**
 * La riga della tabella §16.9 non è un'occorrenza: la stessa richiesta ripetuta deve incrementare
 * `volte`, non aprire la millesima riga uguale. Quello lo fa la chiave. E la scrittura non deve
 * poter rompere il cambio che la cliente ha appena concordato: quello lo fa il `catch`.
 */
import { PrismaService } from '../prisma/prisma.service';
import { chiaveSostituzione, registraSostituzione } from './registra-sostituzione';

describe('registrare una sostituzione', () => {
  describe('la chiave', () => {
    const base = { clientId: 'c1', recipeId: 'r1', from: 'carote', to: 'zucchine' };

    it('la stessa richiesta scritta diversamente è la stessa riga', () => {
      expect(chiaveSostituzione({ ...base, from: 'Carote' })).toBe(chiaveSostituzione({ ...base, from: 'carota' }));
    });

    it('⚠️ lo STESSO alimento in un PIATTO diverso è una riga diversa', () => {
      // È il contesto, cioè tutto il motivo per cui questa tabella non è un gruppo di equivalenza:
      // «togliere le carote dal minestrone» e «dall'insalata» sono due richieste.
      expect(chiaveSostituzione(base)).not.toBe(chiaveSostituzione({ ...base, recipeId: 'r2' }));
    });

    it('clienti diverse non si accorpano mai', () => {
      expect(chiaveSostituzione(base)).not.toBe(chiaveSostituzione({ ...base, clientId: 'c2' }));
    });

    it('un sostituto diverso è una richiesta diversa', () => {
      expect(chiaveSostituzione(base)).not.toBe(chiaveSostituzione({ ...base, to: 'finocchi' }));
    });

    it('senza piatto la chiave esiste comunque (righe scritte a mano)', () => {
      expect(chiaveSostituzione({ clientId: 'c1', from: 'carote', to: 'zucchine' })).toContain('|-|');
    });
  });

  describe('la scrittura', () => {
    const dati = {
      clientId: 'c1' as const,
      tipo: 'ingrediente' as const,
      from: 'Carote',
      to: 'Zucchine',
      recipeId: 'r1',
      dishName: 'Minestrone',
      mealSlot: 'lunch',
      motivo: 'gusto',
    };

    it('scrive le radici accanto ai nomi: sono quelle che rendono cercabile la tabella', async () => {
      const upsert = jest.fn().mockResolvedValue({ id: 'fs1', volte: 1 });
      const prisma = { foodSwap: { upsert } } as unknown as PrismaService;

      await registraSostituzione(prisma, dati);

      const arg = upsert.mock.calls[0][0];
      expect(arg.create.fromFood).toBe('Carote'); // il nome resta com'è: lo legge una persona
      expect(arg.create.fromKey).toBe('carot'); // la radice: la usa la ricerca
      expect(arg.create.toKey).toBe('zucchin');
      expect(arg.create.stato).toBe('da_verificare');
      expect(arg.create.origine).toBe('chat');
    });

    it('la seconda volta incrementa `volte` e NON rimette la riga in coda', async () => {
      // Se ripetere una richiesta già concessa la riportasse «da verificare», la nutrizionista si
      // troverebbe riaperto ogni giorno un lavoro che ha già fatto.
      const upsert = jest.fn().mockResolvedValue({ id: 'fs1', volte: 2 });
      const prisma = { foodSwap: { upsert } } as unknown as PrismaService;

      await registraSostituzione(prisma, dati);

      const arg = upsert.mock.calls[0][0];
      expect(arg.update.volte).toEqual({ increment: 1 });
      expect(arg.update.stato).toBeUndefined();
      expect(arg.update.ultimaVoltaIl).toBeInstanceOf(Date);
    });

    it('⚠️ non lancia MAI: il pasto della cliente non dipende dalla memoria', async () => {
      const prisma = {
        foodSwap: { upsert: jest.fn().mockRejectedValue(new Error('database giù')) },
      } as unknown as PrismaService;

      await expect(registraSostituzione(prisma, dati)).resolves.toBeNull();
    });

    it('senza i due nomi non scrive niente: una riga così non direbbe nulla', async () => {
      const upsert = jest.fn();
      const prisma = { foodSwap: { upsert } } as unknown as PrismaService;

      expect(await registraSostituzione(prisma, { ...dati, to: '  ' })).toBeNull();
      expect(await registraSostituzione(prisma, { ...dati, from: '' })).toBeNull();
      expect(upsert).not.toHaveBeenCalled();
    });
  });
});
