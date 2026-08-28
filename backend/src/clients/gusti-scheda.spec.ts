/**
 * I GUSTI SCRITTI DALLA SCHEDA — la quarta volta per la stessa riga.
 *
 * `latte` che non si espandeva (8/8), `frutta_a_guscio` (12/8), il tag `"Carne .ceci"` che non
 * escludeva niente (17/8). Ogni volta la correzione ha coperto **il percorso da cui era arrivata la
 * segnalazione**, e questo — la scheda della nutrizionista — è quello che è rimasto fuori: il ciclo
 * su `PROFILE_FIELDS` riempie `profileData` ciecamente, e la scheda manda una stringa spezzata sulle
 * sole virgole.
 *
 * ⚠️ Questi test guardano **cosa arriva nell'upsert**, che è l'unico posto dove la differenza fra
 * «pulito in scrittura» e «sperato pulito» si vede. E guardano anche che gli avvisi **tornino a chi
 * ha premuto Salva**: una voce che sparisce in silenzio è il difetto di cui questa riga è la quarta
 * ripetizione.
 */
import { ClientsService } from './clients.service';

function servizio(attuali: { dislikedFoods?: string[]; intolerances?: string[] } = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'u1', role: 'client' }),
      update: jest.fn().mockReturnValue({ op: 'user.update' }),
    },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        dislikedFoods: attuali.dislikedFoods ?? [],
        intolerances: attuali.intolerances ?? [],
      }),
      upsert: jest.fn().mockReturnValue({ op: 'profile.upsert' }),
    },
    rolePagePermission: { findUnique: jest.fn().mockResolvedValue({ canManage: true }) },
    $transaction: jest.fn().mockResolvedValue([]),
  } as never;
  const s = new ClientsService(prisma, {} as never, { log: jest.fn().mockResolvedValue(undefined) } as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  (s as unknown as { assertClientAccess: () => Promise<void> }).assertClientAccess = () => Promise.resolve();
  (s as unknown as { roleCanManage: () => Promise<boolean> }).roleCanManage = () => Promise.resolve(true);
  return { s, prisma: prisma as unknown as { clientProfile: { upsert: jest.Mock } } };
}

/** Cosa è finito davvero in `update` dell'upsert del profilo. */
const scritto = (prisma: { clientProfile: { upsert: jest.Mock } }): Record<string, unknown> =>
  prisma.clientProfile.upsert.mock.calls[0][0].update as Record<string, unknown>;

describe('updateClient — i cibi non graditi si ripuliscono in scrittura', () => {
  it('⚠️ un tag con più alimenti dentro si SPEZZA: «Carne .ceci» erano due esclusioni, non una parola', async () => {
    const { s, prisma } = servizio();
    await s.updateClient('u1', 'admin', { dislikedFoods: ['Carne .ceci'] } as never);
    expect(scritto(prisma).dislikedFoods).toEqual(['Carne', 'ceci']);
  });

  it('una spezia NON si salva, e il cibo vero che le stava accanto sì', async () => {
    const { s, prisma } = servizio();
    const r = await s.updateClient('u1', 'admin', { dislikedFoods: ['pepe, ceci'] } as never);
    expect(scritto(prisma).dislikedFoods).toEqual(['ceci']);
    // ⚠️ E lo dice: è la parte che rende la pulizia una risposta e non una sparizione.
    expect((r as { avvisiSpezie?: { termine: string }[] }).avvisiSpezie?.map((a) => a.termine)).toEqual(['pepe']);
  });

  it('⚠️ il confronto è per PAROLA, non per sottostringa: «peperoni» non è «pepe» e si salva', async () => {
    const { s, prisma } = servizio();
    const r = await s.updateClient('u1', 'admin', { dislikedFoods: ['peperoni'] } as never);
    expect(scritto(prisma).dislikedFoods).toEqual(['peperoni']);
    expect((r as { avvisiSpezie?: unknown[] }).avvisiSpezie).toBeUndefined();
  });

  it('i cibi veri passano intatti, e «frutta a guscio» NON si spezza sullo spazio', async () => {
    const { s, prisma } = servizio();
    await s.updateClient('u1', 'admin', { dislikedFoods: ['funghi', 'frutta a guscio', 'verza'] } as never);
    expect(scritto(prisma).dislikedFoods).toEqual(['funghi', 'frutta a guscio', 'verza']);
  });

  it('senza il campo nel DTO il profilo non si tocca affatto: salvare un telefono non riscrive i gusti', async () => {
    const { s, prisma } = servizio();
    await s.updateClient('u1', 'admin', { phone: '123' } as never);
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });

  it('una lista svuotata di proposito resta svuotata: togliere tutte le esclusioni è un gesto legittimo', async () => {
    const { s, prisma } = servizio({ dislikedFoods: ['funghi'] });
    await s.updateClient('u1', 'admin', { dislikedFoods: [] } as never);
    expect(scritto(prisma).dislikedFoods).toEqual([]);
  });
});

describe('updateClient — le intolleranze non salvano i non-alimenti', () => {
  it('⚠️ «altro» e «nessuna» non sono intolleranze: il motore andrebbe a cercarle dentro i piatti', async () => {
    const { s, prisma } = servizio();
    await s.updateClient('u1', 'admin', { intolerances: ['lattosio', 'altro', 'nessuna', 'other'] } as never);
    expect(scritto(prisma).intolerances).toEqual(['lattosio']);
  });

  it('maiuscole e spazi non salvano la stessa parola: «Altro » è «altro»', async () => {
    const { s, prisma } = servizio();
    await s.updateClient('u1', 'admin', { intolerances: ['Altro ', ' glutine'] } as never);
    expect(scritto(prisma).intolerances).toEqual(['glutine']);
  });

  it('⚠️ un\'intolleranza NON si spezza: è un codice o un termine clinico, e «frutta a guscio» non va spaccata', async () => {
    const { s, prisma } = servizio();
    await s.updateClient('u1', 'admin', { intolerances: ['frutta a guscio', 'lattosio'] } as never);
    expect(scritto(prisma).intolerances).toEqual(['frutta a guscio', 'lattosio']);
  });

  it('⚠️ e una spezia fra le intolleranze RESTA: quella è sicurezza, non gusto — il cancello spezie non c\'entra', async () => {
    const { s, prisma } = servizio();
    await s.updateClient('u1', 'admin', { intolerances: ['pepe'] } as never);
    expect(scritto(prisma).intolerances).toEqual(['pepe']);
  });
});

/**
 * ⚠️ QUELLO CHE LA REVISIONE HA TROVATO (17/8 sera) — e che è peggio del difetto che si chiudeva.
 *
 * Il form della scheda rimanda TUTTI i campi a ogni salvataggio. Con la pulizia applicata sempre,
 * una coach che correggeva un numero di telefono riscriveva i campi clinici di una cliente, e il
 * log modifiche lo attribuiva a lei. La pulizia vale solo su quello che è stato davvero toccato —
 * la stessa regola di `allergies` e `fastingWindow`.
 */
describe('updateClient — la pulizia NON tocca i campi che nessuno ha modificato', () => {
  it('⚠️ risalvando la scheda con le stesse liste sporche, quelle liste NON si riscrivono', async () => {
    const { s, prisma } = servizio({ dislikedFoods: ['Carne .ceci'], intolerances: ['altro', 'lattosio'] });
    await s.updateClient('u1', 'admin', {
      phone: '123',
      dislikedFoods: ['Carne .ceci'],
      intolerances: ['altro', 'lattosio'],
    } as never);
    // Nessuna delle due liste finisce nell'upsert: nessuno le ha toccate.
    const update = prisma.clientProfile.upsert.mock.calls[0]?.[0]?.update ?? {};
    expect(update.dislikedFoods).toBeUndefined();
    expect(update.intolerances).toBeUndefined();
  });

  it('ma se la tocca davvero, la pulizia scatta', async () => {
    const { s, prisma } = servizio({ dislikedFoods: ['Carne .ceci'] });
    await s.updateClient('u1', 'admin', { dislikedFoods: ['Carne .ceci', 'pepe, funghi'] } as never);
    expect(scritto(prisma).dislikedFoods).toEqual(['Carne', 'ceci', 'funghi']);
  });

  it('⚠️ l\'avviso arriva anche quando la lista finisce identica a com\'era: la sua riga non è passata lo stesso', async () => {
    const { s, prisma } = servizio({ dislikedFoods: ['ceci'] });
    const r = await s.updateClient('u1', 'admin', { dislikedFoods: ['pepe, ceci'] } as never);
    expect((r as { avvisiSpezie?: { termine: string }[] }).avvisiSpezie?.map((a) => a.termine)).toEqual(['pepe']);
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled(); // niente da riscrivere
  });

  it('⚠️ `null` non arriva a Prisma: la colonna è `String[]` e sarebbe un 500', async () => {
    const { s, prisma } = servizio({ dislikedFoods: ['funghi'] });
    await s.updateClient('u1', 'admin', { dislikedFoods: null, intolerances: null, phone: '123' } as never);
    const update = prisma.clientProfile.upsert.mock.calls[0]?.[0]?.update ?? {};
    expect(update.dislikedFoods).toBeUndefined();
    expect(update.intolerances).toBeUndefined();
  });
});
