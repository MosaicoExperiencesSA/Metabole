/**
 * ⛔ **PROMUOVERE UNA SOSTITUZIONE NON DEVE CANCELLARE LA TABELLA DEI PESI** — revisione, 25/8.
 *
 * `members` è un campo JSON e ci vive più di una cosa: gli `items`, la `note` con la provenienza e —
 * dal 25/8 — i **`fattori`**, cioè i grammi equivalenti firmati dal capo nutrizionista. Il ramo
 * «aggiungi» riscriveva `members` da capo tenendo solo `items` e `note`, quindi buttava via tutto
 * il resto senza dirlo, con un messaggio che diceva «aggiunto al gruppo».
 *
 * ⚠️ **La misura, per non farne una storia più grossa di quello che è** (revisione, 25/8): oggi il
 * gruppo dei grassi seminato nasce **approvato**, e `decidiPromozione` non tocca mai un gruppo
 * approvato — solo le bozze. Quindi la tabella di Nocanty, com'è oggi, da qui non passa: il test
 * infatti costruisce il gruppo in **bozza** per arrivarci. Ma i pesi si possono mettere su qualunque
 * gruppo, comprese le bozze che il capo nutrizionista sta preparando, e quella è la porta.
 *
 * ⚠️ E vale come regola generale, non solo per i grassi: chi scrive un campo di un oggetto condiviso
 * parte da quello che c'è, non da quello che si ricorda.
 */
import { FoodSwapsService } from './food-swaps.service';

const FATTORI = { riferimento: 'olio evo', fonte: 'CREA / USDA', pesi: { 'olio evo': 100, burro: 120 } };

const GRUPPO = {
  id: 'g-grassi',
  name: 'Oli e grassi da condimento',
  status: 'draft',
  productId: null,
  members: { items: ['olio evo', 'burro'], note: 'la nota di prima', fattori: FATTORI },
};

function creaServizio() {
  const aggiornato: { members?: Record<string, unknown> } = {};
  const prisma = {
    foodSwap: {
      findUnique: jest.fn().mockResolvedValue({
        id: 's-1',
        stato: 'verificata',
        fromFood: 'olio evo',
        toFood: 'burro',
        dietId: null,
        dishName: 'Insalata di farro',
        promossaGruppoId: null,
        client: { firstName: 'Giulia', lastName: 'Bianchi', email: 'g@b.it' },
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    equivalenceGroup: {
      findMany: jest.fn().mockResolvedValue([GRUPPO]),
      update: jest.fn().mockImplementation(async ({ data }: { data: { members: Record<string, unknown> } }) => {
        aggiornato.members = data.members;
        return {};
      }),
      create: jest.fn().mockResolvedValue({ id: 'g-nuovo', name: 'nuovo' }),
    },
    staff: { findFirst: jest.fn().mockResolvedValue(null) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const notifications = { creaPerUtenti: jest.fn().mockResolvedValue(undefined), crea: jest.fn().mockResolvedValue(undefined) };
  const service = new FoodSwapsService(prisma as never, audit as never, notifications as never);
  return { service, prisma, aggiornato };
}

describe('⛔ promuovere a regola dentro un gruppo che porta i pesi', () => {
  it('⛔ i fattori restano dov’erano: la tabella non si cancella', async () => {
    const { service, aggiornato } = creaServizio();
    await service.promuovi('u-1', 's-1');
    expect(aggiornato.members?.fattori).toEqual(FATTORI);
  });

  it('⚠️ e la nota di prima resta anche lei', async () => {
    const { service, aggiornato } = creaServizio();
    await service.promuovi('u-1', 's-1');
    expect(aggiornato.members?.note).toBe('la nota di prima');
  });
});
