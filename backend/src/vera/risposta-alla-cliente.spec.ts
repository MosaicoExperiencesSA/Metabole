import { chiudiSegnalazione, escalationIdDallaChiave, scriviAllaCliente } from './risposta-alla-cliente';
import { PrismaService } from '../prisma/prisma.service';

/**
 * «DA UNA PARTE O DALL'ALTRA IL NUTRIZIONISTA RISPONDE» (Simone, 14/8).
 * Decisione in progetto/NOTA_Vera_Porta_I_Girati_Di_Gaia.md.
 */

describe('escalationIdDallaChiave', () => {
  it('legge l’id della segnalazione dalla chiave della richiesta', () => {
    expect(escalationIdDallaChiave('gaia:esc-1')).toBe('esc-1');
  });

  it('su una chiave di un altro tipo non inventa niente', () => {
    expect(escalationIdDallaChiave('allergia:c1:favismo')).toBeNull();
    expect(escalationIdDallaChiave(null)).toBeNull();
    expect(escalationIdDallaChiave('gaia:')).toBeNull();
  });
});

describe('scriviAllaCliente — la risposta dettata a Vera arriva davvero nel thread', () => {
  const prismaFinto = (over: Record<string, unknown> = {}) => {
    const create = jest.fn().mockResolvedValue({ id: 'msg-1' });
    const upsert = jest.fn().mockResolvedValue({ id: 'th-1' });
    const prisma = {
      chatThread: { upsert, update: jest.fn().mockResolvedValue({}) },
      message: { create },
      ...over,
    } as unknown as PrismaService;
    return { prisma, create, upsert };
  };

  it('scrive nel thread «nutritionist» di QUELLA cliente, firmato da chi ha dettato', async () => {
    const { prisma, create, upsert } = prismaFinto();
    const esito = await scriviAllaCliente(prisma, {
      clienteId: 'c1',
      autoreId: 'lucia',
      ruoloAutore: 'nutritionist',
      testo: 'Il miele va bene, tienilo pure: 10 g al mattino.',
    });
    expect(esito).toBe(true);
    // ⚠️ Il thread si CREA se non c'è: una cliente che non ha mai scritto non deve far fallire
    // la risposta.
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId_counterpart: { clientId: 'c1', counterpart: 'nutritionist' } } }),
    );
    const dati = create.mock.calls[0][0].data;
    expect(dati.threadId).toBe('th-1');
    expect(dati.senderUserId).toBe('lucia');
    expect(dati.senderRole).toBe('nutritionist');
    expect(dati.body).toContain('Il miele va bene');
  });

  it('⚠️ un testo vuoto non manda un messaggio vuoto alla cliente', async () => {
    const { prisma, create } = prismaFinto();
    expect(await scriviAllaCliente(prisma, { clienteId: 'c1', autoreId: 'lucia', ruoloAutore: 'nutritionist', testo: '   ' })).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('⚠️ non lancia mai: se la chat è giù lo si dice a chi chiama, non si perde il giro', async () => {
    const { prisma } = prismaFinto({ chatThread: { upsert: jest.fn().mockRejectedValue(new Error('db giù')), update: jest.fn() } });
    expect(await scriviAllaCliente(prisma, { clienteId: 'c1', autoreId: 'lucia', ruoloAutore: 'nutritionist', testo: 'ciao' })).toBe(false);
  });
});

describe('chiudiSegnalazione — rispondere da Vera chiude anche la pagina', () => {
  it('mette la segnalazione a «risolta», con data e con chi', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = { escalation: { update } } as unknown as PrismaService;
    expect(await chiudiSegnalazione(prisma, 'esc-1', 'lucia')).toBe(true);
    const args = update.mock.calls[0][0];
    expect(args.where).toEqual({ id: 'esc-1' });
    expect(args.data.status).toBe('resolved');
    expect(args.data.resolvedAt).toBeInstanceOf(Date);
  });

  it('⚠️ non lancia mai: la risposta alla cliente è già partita, e quella conta di più', async () => {
    const prisma = { escalation: { update: jest.fn().mockRejectedValue(new Error('boom')) } } as unknown as PrismaService;
    expect(await chiudiSegnalazione(prisma, 'esc-1', 'lucia')).toBe(false);
  });

  it('senza id non si tocca niente', async () => {
    const update = jest.fn();
    const prisma = { escalation: { update } } as unknown as PrismaService;
    expect(await chiudiSegnalazione(prisma, null, 'lucia')).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
