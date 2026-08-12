/**
 * «HAI UN NUOVO LEAD DA ASSEGNARE» — e soprattutto: a CHI arriva quando la manager non c'è.
 *
 * Questi test non verificano che la notifica «parta»: verificano che non finisca **nel vuoto**. È
 * la lezione di luglio (tre segnalazioni cliniche senza destinatario, ferme venti giorni) applicata
 * a un avviso commerciale: un lead che nessuno assegna si raffredda, e nessun errore lo dice.
 */
import { avvisaNuovoLeadDaAssegnare, destinatariManagerCoach } from './avvisa-manager-coach';
import type { PrismaService } from '../prisma/prisma.service';

function prismaFinto(perRuolo: Record<string, string[]>) {
  return {
    user: {
      findMany: jest.fn().mockImplementation((args: { where: { role: string } }) =>
        Promise.resolve((perRuolo[args.where.role] ?? []).map((id) => ({ id }))),
      ),
    },
  } as unknown as PrismaService;
}

const lead = { id: 'rec-1', nome: 'Anna Bianchi', email: 'anna@b.it' };

describe('destinatariManagerCoach', () => {
  it('la manager delle coach (sales) è il destinatario', async () => {
    expect(await destinatariManagerCoach(prismaFinto({ sales: ['u-manager'], admin: ['u-admin'] }))).toEqual(['u-manager']);
  });

  it('se non c\'è nessuna manager attiva, l\'avviso va agli ADMIN e non si perde', async () => {
    expect(await destinatariManagerCoach(prismaFinto({ sales: [], admin: ['u-admin'] }))).toEqual(['u-admin']);
  });

  it('più manager: le avvisa tutte', async () => {
    expect(await destinatariManagerCoach(prismaFinto({ sales: ['a', 'b'] }))).toEqual(['a', 'b']);
  });
});

describe('avvisaNuovoLeadDaAssegnare', () => {
  it('scrive una notifica per destinatario, col link alla tabella dei non assegnati', async () => {
    const notify = jest.fn().mockResolvedValue(undefined);
    const quanti = await avvisaNuovoLeadDaAssegnare(prismaFinto({ sales: ['u1', 'u2'] }), { notify }, lead);
    expect(quanti).toBe(2);
    expect(notify).toHaveBeenCalledTimes(2);
    const primo = notify.mock.calls[0][0];
    expect(primo.type).toBe('lead_da_assegnare');
    expect(primo.payload).toMatchObject({ url: '/crm/da-assegnare', recordId: 'rec-1' });
    expect(primo.body).toContain('Anna Bianchi');
  });

  it('senza nome usa l\'email: «un nuovo contatto» è l\'ultimo ripiego, non il primo', async () => {
    const notify = jest.fn().mockResolvedValue(undefined);
    await avvisaNuovoLeadDaAssegnare(prismaFinto({ sales: ['u1'] }), { notify }, { id: 'r', nome: '   ', email: 'x@y.it' });
    expect(notify.mock.calls[0][0].body).toContain('x@y.it');
  });

  it('NESSUN destinatario: non lancia, ma lo SCRIVE — un catch muto è un mistero', async () => {
    const log = { warn: jest.fn() };
    const quanti = await avvisaNuovoLeadDaAssegnare(prismaFinto({ sales: [], admin: [] }), { notify: jest.fn() }, lead, log);
    expect(quanti).toBe(0);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('non recapitato'));
  });

  it('se la notifica esplode NON fa fallire la registrazione, e il motivo finisce nei log', async () => {
    const log = { warn: jest.fn() };
    const notify = jest.fn().mockRejectedValue(new Error('brevo giù'));
    const quanti = await avvisaNuovoLeadDaAssegnare(prismaFinto({ sales: ['u1'] }), { notify }, lead, log);
    expect(quanti).toBe(0);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('brevo giù'));
  });

  it('senza notificatore non finge di aver avvisato', async () => {
    const log = { warn: jest.fn() };
    expect(await avvisaNuovoLeadDaAssegnare(prismaFinto({ sales: ['u1'] }), null, lead, log)).toBe(0);
    expect(log.warn).toHaveBeenCalled();
  });
});
