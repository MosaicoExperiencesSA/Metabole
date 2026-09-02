/**
 * ⛔ **IL SALVATAGGIO CHE DISFACEVA SE STESSO — Patrizia, 31/8.**
 *
 * Quattro cambi di dieta in un'ora — Ipocalorica, Detox, DASH, Keto — tutti registrati come
 * «cambiata da Mediterranea senza glutine a …», e tutti col «prima» già tornato indietro. La pagina
 * diceva «salvato», il registro diceva «cambiata», il database diceva di no.
 *
 * ## Il come, in tre righe
 *
 * In fondo a `updateClient` c'era `assegnaSenzaGlutineEAvvisa(...)`, senza condizioni. Quella
 * funzione, per una cliente che ha dichiarato il glutine, riscrive `dietFamily` e `dietStyle` sulla
 * variante senza glutine; la sua unica difesa è *«se la famiglia è già quella, non faccio niente»*.
 * Quindi appena la nutrizionista la spostava altrove la difesa non valeva più, e il campo tornava
 * indietro **nella stessa richiesta**, tre righe dopo essere stato scritto.
 *
 * ⚠️ Nata il 9/8 per un caso diverso — lo dice il suo stesso commento: *«se la coach ha **appena
 * aggiunto** il glutine»*. Girava su **ogni** salvataggio, quindi da tre settimane nessuna cliente
 * col glutine dichiarato poteva cambiare dieta. Nessuno poteva accorgersene: non diceva niente.
 *
 * ✅ Decisione di Simone: la regola scatta **solo** quando la dichiarazione cambia in questo
 * salvataggio. Il piatto resta protetto dalle esclusioni, che il motore adesso sostituisce.
 */
import { ClientsService } from './clients.service';

function servizio(profiloPrima: Record<string, unknown>) {
  const scritture: Record<string, unknown>[] = [];
  /**
   * ⚠️ Il profilo è **mutabile**, come in banca dati: `assegnaSenzaGlutineEAvvisa` rilegge il
   * profilo per conto suo, e nella richiesta vera lo rilegge DOPO che la transazione ha scritto.
   * Un finto che risponde sempre il «prima» racconterebbe un ordine che non esiste, e la prova
   * misurerebbe l'apparecchio invece del codice.
   */
  const stato: Record<string, unknown> = { ...profiloPrima };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', role: 'client' }), update: jest.fn().mockReturnValue({}) },
    clientProfile: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...stato })),
      upsert: jest.fn().mockImplementation((a: { update: Record<string, unknown> }) => {
        scritture.push(a.update);
        Object.assign(stato, a.update);
        return {};
      }),
      // ⚠️ È la porta che la regola usa per riscrivere la famiglia: se viene chiamata, ha agito.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    diet: { findFirst: jest.fn().mockResolvedValue({ id: 'd-sg', name: 'Mediterranea senza glutine', style: 'mediterranean' }) },
    menuDay: { count: jest.fn().mockResolvedValue(0) },
    notification: { create: jest.fn().mockResolvedValue({}) },
    escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    rolePagePermission: { findUnique: jest.fn().mockResolvedValue({ canManage: true }) },
    $transaction: jest.fn().mockResolvedValue([]),
  } as never;
  const menu = { redeliverFutureDays: jest.fn().mockResolvedValue({ removed: 0, delivered: [] }) };
  const s = new ClientsService(
    prisma, {} as never, { log: jest.fn() } as never, {} as never, menu as never,
    {} as never, {} as never, {} as never, {} as never,
    { buildPersonalBase: jest.fn().mockResolvedValue({}) } as never,
  );
  (s as unknown as { assertClientAccess: () => Promise<void> }).assertClientAccess = () => Promise.resolve();
  (s as unknown as { roleCanManage: () => Promise<boolean> }).roleCanManage = () => Promise.resolve(true);
  return { s, prisma: prisma as unknown as { clientProfile: { updateMany: jest.Mock; upsert: jest.Mock } }, scritture };
}

const CON_GLUTINE = { allergies: ['glutine', 'arachidi'], intolerances: [], dislikedFoods: [], dietFamily: 'Mediterranea senza glutine' };
const SENZA = { allergies: ['arachidi'], intolerances: [], dislikedFoods: [], dietFamily: 'Mediterranea' };

describe('la regola «senza glutine» non disfa più il cambio dieta', () => {
  it('⛔ IL CASO PATRIZIA: chi ha GIÀ il glutine dichiarato può essere spostata su un\'altra dieta', async () => {
    const { s, prisma } = servizio(CON_GLUTINE);
    await s.updateClient('u1', 'head_nutritionist', { dietFamily: 'Keto (non terapeutica)', dietStyle: 'keto' } as never);
    // La porta con cui la regola riscriveva la famiglia non viene toccata.
    expect(prisma.clientProfile.updateMany).not.toHaveBeenCalled();
  });

  it('✅ ma se il glutine viene AGGIUNTO adesso, la regola scatta come sempre', async () => {
    const { s, prisma } = servizio(SENZA);
    await s.updateClient('u1', 'head_nutritionist', { allergies: ['arachidi', 'glutine'] } as never);
    expect(prisma.clientProfile.updateMany).toHaveBeenCalled();
  });

  it('⚠️ e vale anche dalle INTOLLERANZE, non solo dalle allergie', async () => {
    const { s, prisma } = servizio(SENZA);
    await s.updateClient('u1', 'head_nutritionist', { intolerances: ['glutine'] } as never);
    expect(prisma.clientProfile.updateMany).toHaveBeenCalled();
  });

  it('⛔ salvare il TELEFONO di una cliente col glutine non fa scattare niente', async () => {
    // È il salvataggio più comune, ed era quello che riportava indietro la dieta ogni volta.
    const { s, prisma } = servizio({ ...CON_GLUTINE, dietFamily: 'Keto (non terapeutica)' });
    await s.updateClient('u1', 'head_nutritionist', { phone: '+39 333 1112223' } as never);
    expect(prisma.clientProfile.updateMany).not.toHaveBeenCalled();
  });

  it('⚠️ rimandare lo STESSO elenco non è «appena aggiunto»: il form li rimanda tutti a ogni Salva', async () => {
    const { s, prisma } = servizio({ ...CON_GLUTINE, dietFamily: 'Keto (non terapeutica)' });
    await s.updateClient('u1', 'head_nutritionist', { allergies: ['glutine', 'arachidi'] } as never);
    expect(prisma.clientProfile.updateMany).not.toHaveBeenCalled();
  });

  it('una cliente senza glutine che resta senza glutine: nessuna regola, nessun avviso', async () => {
    const { s, prisma } = servizio(SENZA);
    await s.updateClient('u1', 'head_nutritionist', { dietFamily: 'Mediterranea ipocalorica' } as never);
    expect(prisma.clientProfile.updateMany).not.toHaveBeenCalled();
  });
});
