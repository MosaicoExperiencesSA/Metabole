/**
 * ⛔ **LA SCRITTURA DI MASSA TOCCA SOLO CHI HA UN PERCORSO — e dice quante ne ha saltate.**
 *
 * `applicaRestrizione` è l'unica azione del progetto che scrive sul profilo di **molte persone in
 * una volta**. Fino al 7/9 scriveva `dislikedFoods` a tutte le clienti del perimetro, comprese
 * quelle che avevano chiuso mesi prima: una modifica su qualcuno a cui non stiamo erogando niente,
 * fatta senza che nessuno se ne accorga, che riemerge il giorno che quella persona torna — con un
 * divieto deciso per una coorte a cui in quel momento non apparteneva.
 *
 * ⚠️ **Il filtro sta a valle, non nel `where`, e non è una scorciatoia.** Serve la differenza fra i
 * due numeri: chi approva deve leggere non solo su quante ha scritto, ma su quante **non** ha
 * scritto e perché. Un `where` filtrato avrebbe dato il numero giusto e fatto sparire la portata —
 * e una scrittura di massa di cui non si conosce la portata è esattamente quella che nessuno ferma
 * in tempo.
 */
import { applicaProposta, type Proposta } from './applica-proposta';
import type { PrismaService } from '../prisma/prisma.service';

/** Una proposta di restrizione già approvata, come arriva a `applicaProposta`. */
const proposta = (): Proposta => ({
  id: 'a1',
  nutrizionistaId: 'lucia',
  azione: 'restrizione_cliente',
  ambito: 'catalogo',
  soggettoId: 'c1',
  soggettoNome: 'Giulia Rossi',
  dettaglio: { termini: ['fave'] },
});

/**
 * `perimetro` = tutte le clienti della nutrizionista; `conPercorso` = quelle che hanno un piano.
 * Il finto pretende il filtro nella `where`: senza `subscriptions` risponde «nessuno».
 */
function scenario(perimetro: string[], conPercorso: string[]) {
  const update = jest.fn().mockResolvedValue({});
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ role: 'nutritionist' }),
      findMany: jest.fn().mockImplementation(async ({ where }: any) =>
        (where?.subscriptions
          ? (where?.id?.in ?? []).filter((id: string) => conPercorso.includes(id)).map((id: string) => ({ id }))
          : [])),
    },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-lucia' }) },
    clientProfile: {
      findMany: jest.fn().mockResolvedValue(perimetro.map((userId) => ({ userId, dislikedFoods: [] }))),
      update,
    },
  } as unknown as PrismaService;
  return { prisma, update };
}

describe('applicaRestrizione — solo chi ha un percorso in corso', () => {
  it('⛔ chi ha finito il percorso NON viene toccato', async () => {
    const { prisma, update } = scenario(['viva', 'conclusa'], ['viva']);
    await applicaProposta(prisma, proposta());
    expect(update).toHaveBeenCalledTimes(1);
    expect((update.mock.calls[0][0] as any).where.userId).toBe('viva');
  });

  it('⛔ e il riepilogo DICE quante sono state saltate, e perché', async () => {
    const { prisma } = scenario(['viva', 'c1', 'c2'], ['viva']);
    const esito = (await applicaProposta(prisma, proposta())) as { riepilogo: string; toccate: number };
    expect(esito.toccate).toBe(1);
    expect(esito.riepilogo).toContain('2 sono state saltate perché non hanno un percorso in corso');
  });

  it('⚠️ una sola saltata si dice al singolare: un riepilogo sgrammaticato si smette di leggere', async () => {
    const { prisma } = scenario(['viva', 'conclusa'], ['viva']);
    const esito = (await applicaProposta(prisma, proposta())) as { riepilogo: string };
    expect(esito.riepilogo).toContain('1 è stata saltata perché non ha un percorso in corso');
  });

  it('⚠️ se nessuna nel perimetro ha un percorso non si scrive niente, e non è un errore', async () => {
    const { prisma, update } = scenario(['c1', 'c2'], []);
    const esito = (await applicaProposta(prisma, proposta())) as { riepilogo: string; toccate: number };
    expect(update).not.toHaveBeenCalled();
    expect(esito.toccate).toBe(0);
    expect(esito.riepilogo).toContain('nessuna ha un percorso in corso');
    // ⚠️ E si dice che la regola resta: chi comincia domani la trova già scritta.
    expect(esito.riepilogo).toContain('varrà per chi comincerà');
  });

  it('⛔ il TETTO conta chi verrà toccato davvero: 201 nel perimetro ma 3 con percorso non lo fanno scattare', async () => {
    const perimetro = Array.from({ length: 201 }, (_, i) => `c${i}`);
    const { prisma, update } = scenario(perimetro, ['c0', 'c1', 'c2']);
    const esito = (await applicaProposta(prisma, proposta())) as { riepilogo: string; toccate: number };
    expect(esito.toccate).toBe(3);
    expect(update).toHaveBeenCalledTimes(3);
    expect(esito.riepilogo).not.toContain('oltre il tetto');
    // Le 198 saltate si dicono lo stesso: il perimetro resta un fatto che chi approva deve sapere.
    expect(esito.riepilogo).toContain('198 sono state saltate');
  });
});
