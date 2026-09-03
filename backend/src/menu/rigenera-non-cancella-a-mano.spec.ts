/**
 * ⛔ **«RIGENERA MENU» NON CANCELLA PIÙ LE GIORNATE SCRITTE A MANO.**
 *
 * È la promessa centrale del menu scritto a mano — *«il giorno scritto a mano è intoccabile dalla
 * passata notturna e da "Rigenera menu"»* — e fino al 3/9 sera **non aveva nessuna prova**: una
 * revisione avversariale ha rimesso `regenerateFromToday` al `deleteMany` secco di prima e
 * duemilacinquecento test sono rimasti verdi.
 *
 * ⚠️ *Le prove sul modulo puro non provano il montaggio.* `senzaQuelleAMano` era provata bene, su
 * un array in memoria; le tre righe che la chiamano — cioè quelle che decidono se il lavoro di una
 * persona sopravvive a un clic — non erano toccate da niente.
 */
import { MenuService } from './menu.service';

const aMano = [{ slot: 'lunch', recipeId: 'p1', name: 'x', kcal: 700, scrittaAMano: { origine: 'nutrizionista', da: 'Lucia', il: '2026-09-03' } }];
const delMotore = [{ slot: 'lunch', recipeId: 'p2', name: 'y', kcal: 700 }];

/**
 * Il minimo perché i tre metodi girino: quello che conta è **quali id finiscono nel `deleteMany`**.
 * `deliverIfEligible` è finto — qui non si prova l'erogazione, si prova cosa viene cancellato.
 */
function servizio(giorni: { id: string; meals: unknown }[]) {
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const createMany = jest.fn().mockResolvedValue({ count: 0 });
  const prisma = {
    clientProfile: { findUnique: jest.fn().mockResolvedValue({ planHeldAt: null }) },
    menuDay: {
      findMany: jest.fn().mockResolvedValue(giorni),
      deleteMany,
      createMany,
    },
  } as never;
  const s = new MenuService(
    prisma, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
  );
  // ⚠️ L'erogazione non è l'oggetto di queste prove: si finge, e si guarda solo la cancellazione.
  (s as unknown as { deliverIfEligible: unknown }).deliverIfEligible = jest.fn().mockResolvedValue([]);
  return { s, deleteMany, createMany };
}

const idCancellati = (deleteMany: jest.Mock): string[] =>
  (deleteMany.mock.calls[0]?.[0]?.where?.id?.in ?? []) as string[];

describe('le tre porte che cancellano giornate risparmiano quelle scritte a mano', () => {
  const GIORNI = [
    { id: 'a-mano', meals: aMano },
    { id: 'del-motore', meals: delMotore },
  ];

  it('⛔ «Rigenera menu» cancella solo quella del motore', async () => {
    const { s, deleteMany } = servizio(GIORNI);
    await s.regenerateFromToday('c1');
    expect(idCancellati(deleteMany)).toEqual(['del-motore']);
  });

  it('⛔ il cambio di tipo dieta idem', async () => {
    const { s, deleteMany } = servizio(GIORNI);
    await s.redeliverFutureDays('c1');
    expect(idCancellati(deleteMany)).toEqual(['del-motore']);
  });

  /** ⛔ E qui più che altrove: questo metodo cancella TUTTI i menu, passati compresi. */
  it('⛔ e la ripartenza dal piano, che cancella tutto', async () => {
    const { s, deleteMany } = servizio(GIORNI);
    await s.restartFromPlanStart('c1');
    expect(idCancellati(deleteMany)).toEqual(['del-motore']);
  });

  /**
   * ⚠️ **La controprova**: senza giornate a mano si cancella tutto, come prima. Senza questa, le tre
   * prove sopra passerebbero anche se il filtro cancellasse sempre niente.
   */
  it('⚠️ e senza giornate a mano si cancella tutto, come prima', async () => {
    const { s, deleteMany } = servizio([{ id: 'x', meals: delMotore }, { id: 'y', meals: delMotore }]);
    await s.regenerateFromToday('c1');
    expect(idCancellati(deleteMany)).toEqual(['x', 'y']);
  });

  /**
   * ⛔ **`origine: 'app'` è la CLIENTE, e non rende intoccabile la giornata.** Una prima stesura la
   * contava: «Rigenera menu» avrebbe saltato in silenzio ogni giornata futura su cui lei ha premuto
   * «Sostituisci» una volta — e «Rigenera menu» è lo strumento che tutti gli altri messaggi del
   * progetto indicano come via d'uscita.
   */
  it('⛔ una sostituzione chiesta dalla CLIENTE non blocca la rigenerazione', async () => {
    const dallApp = [{ ...delMotore[0], substitutions: [{ from: 'a', to: 'b', reason: 'x', origine: 'app' }] }];
    const { s, deleteMany } = servizio([{ id: 'app', meals: dallApp }]);
    await s.regenerateFromToday('c1');
    expect(idCancellati(deleteMany)).toEqual(['app']);
  });

  /** ⚠️ Mentre un cambio concordato in chat con la nutrizionista sì: quello è lavoro di una persona. */
  it('⚠️ un cambio concordato in chat invece resta', async () => {
    const dallaChat = [{ ...delMotore[0], substitutions: [{ from: 'a', to: 'b', reason: 'x', origine: 'chat' }] }];
    const { s, deleteMany } = servizio([{ id: 'chat', meals: dallaChat }]);
    await s.regenerateFromToday('c1');
    expect(idCancellati(deleteMany)).toEqual([]);
  });

  /**
   * ⚠️ **Il ripristino guarda quelle davvero cancellate.** Se tutte le giornate future erano a mano,
   * `daRifare` è vuoto: entrare nel ramo del ripristino farebbe un `createMany` su niente e
   * loggherebbe «0 giorni rimessi com'erano», un messaggio che non descrive niente.
   */
  it('⚠️ con tutte le giornate a mano non si finge un ripristino', async () => {
    const { s, createMany } = servizio([{ id: 'a-mano', meals: aMano }]);
    await s.redeliverFutureDays('c1');
    expect(createMany).not.toHaveBeenCalled();
  });
});
