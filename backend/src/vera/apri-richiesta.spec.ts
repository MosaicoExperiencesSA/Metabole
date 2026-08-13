import { apriRichiestaVera, chiaveRichiesta, termineDalTesto } from './apri-richiesta';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ⚠️ Il test che conta di più è l'idempotenza.
 *
 * È il §3 del contratto, e la ragione è pratica: il primo lavoro programmato che gira ogni notte
 * chiamerebbe questa funzione ogni notte sulla stessa cliente. Senza la chiave, in una settimana la
 * coda della nutrizionista è illeggibile — e una coda illeggibile è una coda che non si guarda.
 */

const DATI = {
  tipo: 'allergia_da_tradurre' as const,
  clienteId: 'c1',
  testo: 'Mariastella ha dichiarato un’allergia che non so tradurre: «Favismo». Cosa devo togliere?',
  origine: 'personal-base',
  chiave: 'allergia:c1:favismo',
};

const make = (esistente: { id: string } | null, over: Record<string, unknown> = {}) => {
  const create = jest.fn().mockResolvedValue({ id: 'r1' });
  const notifica = jest.fn().mockResolvedValue({});
  const prisma = {
    richiestaVera: { findUnique: jest.fn().mockResolvedValue(esistente), create },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Mariastella', assignedNutritionist: { userId: 'lucia' } }),
    },
    notification: { create: notifica },
    ...over,
  } as unknown as PrismaService;
  return { prisma, create, notifica };
};

describe('apriRichiestaVera', () => {
  it('la prima volta apre la domanda e avvisa la nutrizionista assegnata', async () => {
    const { prisma, create, notifica } = make(null);
    const esito = await apriRichiestaVera(prisma, DATI);
    expect(esito).toEqual({ creata: true, id: 'r1' });
    expect(create.mock.calls[0][0].data.nutrizionistaId).toBe('lucia');
    expect(notifica).toHaveBeenCalledTimes(1);
  });

  it('⚠️ la seconda volta NON fa niente, e non è un errore', async () => {
    const { prisma, create, notifica } = make({ id: 'r1' });
    const esito = await apriRichiestaVera(prisma, DATI);
    expect(esito).toEqual({ creata: false, id: 'r1' });
    expect(create).not.toHaveBeenCalled();
    // ⚠️ E soprattutto: nessuna notifica. Una notifica ripetuta ogni notte per la stessa domanda è
    // il modo più rapido per insegnare a ignorare le notifiche.
    expect(notifica).not.toHaveBeenCalled();
  });

  it('se due chiamate corrono insieme, la seconda perde e va bene così', async () => {
    // Il vincolo unico sulla chiave fa fallire la create: si rilegge, e si risponde «esisteva già».
    const findUnique = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'r1' });
    const { prisma } = make(null, {
      richiestaVera: { findUnique, create: jest.fn().mockRejectedValue(new Error('unique constraint')) },
    });
    expect(await apriRichiestaVera(prisma, DATI)).toEqual({ creata: false, id: 'r1' });
  });

  it('senza nutrizionista assegnata la domanda esiste lo stesso (la vedrà il capo)', async () => {
    // Sparire perché manca un'assegnazione vorrebbe dire perderla proprio nei casi in cui qualcosa
    // è già storto.
    const { prisma, create, notifica } = make(null, {
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ name: 'X', assignedNutritionist: null }) },
    });
    const esito = await apriRichiestaVera(prisma, DATI);
    expect(esito.creata).toBe(true);
    expect(create.mock.calls[0][0].data.nutrizionistaId).toBeNull();
    expect(notifica).not.toHaveBeenCalled();
  });

  it('NON lancia mai: sta in fondo a operazioni che devono riuscire comunque', async () => {
    const { prisma } = make(null, {
      richiestaVera: { findUnique: jest.fn().mockRejectedValue(new Error('database giù')), create: jest.fn() },
    });
    await expect(apriRichiestaVera(prisma, DATI)).resolves.toEqual({ creata: false, id: null });
  });

  it('senza cliente o senza testo non apre niente', async () => {
    const { prisma, create } = make(null);
    expect(await apriRichiestaVera(prisma, { ...DATI, clienteId: '' })).toEqual({ creata: false, id: null });
    expect(await apriRichiestaVera(prisma, { ...DATI, testo: '   ' })).toEqual({ creata: false, id: null });
    expect(create).not.toHaveBeenCalled();
  });

  it('legge la parola fra virgolette quando chi chiama non la passa', async () => {
    const { prisma, create } = make(null);
    await apriRichiestaVera(prisma, DATI);
    expect(create.mock.calls[0][0].data.termine).toBe('Favismo');
  });

  it('il `termine` passato a mano vince su quello letto dal testo', async () => {
    const { prisma, create } = make(null);
    await apriRichiestaVera(prisma, { ...DATI, termine: 'favismo (G6PD)' });
    expect(create.mock.calls[0][0].data.termine).toBe('favismo (G6PD)');
  });
});

describe('chiaveRichiesta e termineDalTesto', () => {
  it('la chiave non dipende da maiuscole e accenti', () => {
    expect(chiaveRichiesta('allergia_da_tradurre', 'c1', 'Favismo')).toBe('allergia:c1:favismo');
    expect(chiaveRichiesta('allergia_da_tradurre', 'c1', 'FAVISMO')).toBe('allergia:c1:favismo');
  });

  it('senza virgolette non si inventa nessuna parola', () => {
    expect(termineDalTesto('non so tradurre questa allergia')).toBeNull();
  });
});
