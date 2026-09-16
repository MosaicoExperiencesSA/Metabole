import { segnaEntrataInvitoGaia, TIPO_ENTRATA_INVITO } from './entrata';

type Opz = {
  invito?: { id: string; sentAt: Date | null; enteredAt: Date | null } | null;
  presa?: number;
  coachProfilo?: string | null;
  coachScheda?: string | null;
  staff?: { userId: string; active: boolean; user: { status: string; deletedAt: Date | null } } | null;
  manager?: { id: string }[];
  admin?: { id: string }[];
  nome?: string | null;
  stato?: string | null;
  perIndirizzo?: unknown;
};

function finto(o: Opz = {}) {
  const prisma = {
    crmRecord: {
      findUnique: jest.fn().mockResolvedValue(
        o.invito === null
          ? { id: 'rec-1', name: 'x', firstName: null, email: 'a@b.it', assignedCoachId: null, gaiaInvite: null }
          : {
              id: 'rec-1',
              name: o.nome === undefined ? 'Maria Rossi' : o.nome,
              firstName: null,
              email: 'maria@b.it',
              assignedCoachId: o.coachScheda ?? null,
              assignmentStatus: o.stato === undefined ? 'accepted' : o.stato,
              gaiaInvite: o.invito ?? { id: 'inv-1', sentAt: new Date('2026-09-01'), enteredAt: null },
            },
      ),
    },
    gaiaInvite: {
      updateMany: jest.fn().mockResolvedValue({ count: o.presa ?? 1 }),
      findUnique: jest.fn().mockResolvedValue(o.perIndirizzo ?? null),
    },
    clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: o.coachProfilo ?? null }) },
    staff: { findUnique: jest.fn().mockResolvedValue(o.staff ?? null) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: 'Maria@Example.it' }),
      findMany: jest.fn().mockImplementation(({ where }: { where: { role: string } }) =>
        Promise.resolve(where.role === 'sales' ? (o.manager ?? []) : (o.admin ?? [])),
      ),
    },
  };
  const notify = jest.fn().mockResolvedValue(true);
  const log = { warn: jest.fn() };
  return { prisma, notify, log };
}

const coachAttiva = { userId: 'u-coach', active: true, user: { status: 'active', deletedAt: null } };

describe('invito a Gaia — avviso quando la lead entra (16/9)', () => {
  it('chi non ha ricevuto l invito: niente, nemmeno la scrittura', async () => {
    const f = finto({ invito: null });
    expect(await segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log)).toBe(0);
    expect(f.prisma.gaiaInvite.updateMany).not.toHaveBeenCalled();
    expect(f.notify).not.toHaveBeenCalled();
  });

  it('invito non ancora partito, o avviso già dato: niente', async () => {
    for (const invito of [
      { id: 'i', sentAt: null, enteredAt: null },
      { id: 'i', sentAt: new Date(), enteredAt: new Date() },
    ]) {
      const f = finto({ invito });
      expect(await segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log)).toBe(0);
      expect(f.notify).not.toHaveBeenCalled();
    }
  });

  it('due accessi insieme: avvisa solo chi vince la scrittura', async () => {
    const f = finto({ presa: 0, coachProfilo: 's-1', staff: coachAttiva });
    expect(await segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log)).toBe(0);
    expect(f.prisma.gaiaInvite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-1', enteredAt: null } }),
    );
    expect(f.notify).not.toHaveBeenCalled();
  });

  it('con una coach attiva avvisa lei, e solo lei', async () => {
    const f = finto({ coachProfilo: 's-1', staff: coachAttiva, manager: [{ id: 'u-man' }] });
    expect(await segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log)).toBe(1);
    expect(f.notify).toHaveBeenCalledTimes(1);
    const n = f.notify.mock.calls[0][0];
    expect(n.userId).toBe('u-coach');
    expect(n.type).toBe(TIPO_ENTRATA_INVITO);
    expect(n.body).toContain('Maria Rossi');
    expect(n.payload).toEqual({ clientId: 'u-1', recordId: 'rec-1' });
    expect(f.prisma.staff.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's-1' } }));
  });

  it('la coach del profilo vince su quella della scheda', async () => {
    const f = finto({ coachProfilo: 's-prof', coachScheda: 's-scheda', staff: coachAttiva });
    await segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log);
    expect(f.prisma.staff.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's-prof' } }));
  });

  it('senza profilo usa la coach della scheda', async () => {
    const f = finto({ coachScheda: 's-scheda', staff: coachAttiva });
    await segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log);
    expect(f.notify.mock.calls[0][0].userId).toBe('u-coach');
  });

  it('la coach della scheda ancora da accettare non conta: avvisa la manager', async () => {
    const f = finto({ coachScheda: 's-scheda', stato: 'pending', staff: coachAttiva, manager: [{ id: 'u-man' }] });
    await segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log);
    expect(f.prisma.staff.findUnique).not.toHaveBeenCalled();
    expect(f.notify.mock.calls[0][0].userId).toBe('u-man');
  });

  it('registrata dall app su un altra scheda: l invito si trova per indirizzo', async () => {
    const f = finto({
      invito: null,
      manager: [{ id: 'u-man' }],
      perIndirizzo: {
        crmRecord: {
          id: 'rec-invitata', name: 'Maria Rossi', firstName: null, email: 'maria@example.it',
          assignedCoachId: null, assignmentStatus: null,
          gaiaInvite: { id: 'inv-9', sentAt: new Date('2026-09-01'), enteredAt: null },
        },
      },
    });
    expect(await segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log)).toBe(1);
    expect(f.prisma.gaiaInvite.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'maria@example.it' } }));
    expect(f.prisma.gaiaInvite.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'inv-9', enteredAt: null } }));
    expect(f.notify.mock.calls[0][0].payload).toEqual(expect.objectContaining({ recordId: 'rec-invitata', clientId: 'u-1' }));
  });

  it('collegata alla doppiona scartata (riga senza invio): l invito vero si trova per indirizzo', async () => {
    const f = finto({
      invito: { id: 'inv-scartata', sentAt: null, enteredAt: null },
      manager: [{ id: 'u-man' }],
      perIndirizzo: {
        crmRecord: {
          id: 'rec-invitata', name: 'Maria Rossi', firstName: null, email: 'maria@example.it',
          assignedCoachId: null, assignmentStatus: null,
          gaiaInvite: { id: 'inv-vero', sentAt: new Date('2026-09-01'), enteredAt: null },
        },
      },
    });
    expect(await segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log)).toBe(1);
    expect(f.prisma.gaiaInvite.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'inv-vero', enteredAt: null } }));
  });

  it('nessun invito nemmeno per indirizzo: niente', async () => {
    const f = finto({ invito: null });
    expect(await segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log)).toBe(0);
    expect(f.prisma.gaiaInvite.updateMany).not.toHaveBeenCalled();
  });

  it('senza coach avvisa la manager, con il link ai lead da assegnare', async () => {
    const f = finto({ manager: [{ id: 'u-man1' }, { id: 'u-man2' }] });
    expect(await segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log)).toBe(2);
    expect(f.notify.mock.calls.map((c) => c[0].userId)).toEqual(['u-man1', 'u-man2']);
    expect(f.notify.mock.calls[0][0].payload).toEqual({ url: '/crm/da-assegnare', clientId: 'u-1', recordId: 'rec-1' });
    expect(f.notify.mock.calls[0][0].body).toContain('non ha ancora una coach');
  });

  it('coach sospesa o disattivata: vale come senza coach', async () => {
    for (const staff of [
      { ...coachAttiva, active: false },
      { ...coachAttiva, user: { status: 'suspended', deletedAt: null } },
      { ...coachAttiva, user: { status: 'active', deletedAt: new Date() } },
    ]) {
      const f = finto({ coachProfilo: 's-1', staff, manager: [{ id: 'u-man' }] });
      await segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log);
      expect(f.notify.mock.calls[0][0].userId).toBe('u-man');
    }
  });

  it('nessuna manager: gli admin', async () => {
    const f = finto({ manager: [], admin: [{ id: 'u-adm' }] });
    await segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log);
    expect(f.notify.mock.calls[0][0].userId).toBe('u-adm');
  });

  it('avviso non scritto (spento dalla coach): lo dice nei log', async () => {
    const f = finto({ coachProfilo: 's-1', staff: coachAttiva });
    f.notify.mockResolvedValue(false);
    expect(await segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log)).toBe(0);
    expect(f.log.warn).toHaveBeenCalled();
  });

  it('senza nome usa l email', async () => {
    const f = finto({ nome: null, coachProfilo: 's-1', staff: coachAttiva });
    await segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log);
    expect(f.notify.mock.calls[0][0].body).toContain('maria@b.it');
  });

  it('non lancia mai', async () => {
    const f = finto();
    f.prisma.crmRecord.findUnique.mockRejectedValue(new Error('db giù'));
    await expect(segnaEntrataInvitoGaia(f.prisma as never, { notify: f.notify }, 'u-1', f.log)).resolves.toBe(0);
    expect(f.log.warn).toHaveBeenCalled();
  });
});
