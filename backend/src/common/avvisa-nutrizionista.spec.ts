import {
  avvisaCapiNutrizionisti,
  avvisaNutrizionistaDellaCliente,
  destinatariNutrizionista,
  destinatariStaffDellaCliente,
} from './avvisa-nutrizionista';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * «QUANDO SI CREANO SOSTITUZIONI NUOVE O EQUIVALENZE NUOVE MANDIAMO UNA NOTIFICA AL NUTRIZIONISTA»
 * (Simone, 11/8).
 *
 * La regola che questi test difendono non è «manda una notifica»: è **non perdere il destinatario**.
 * A luglio tre segnalazioni gravi sono rimaste ferme venti giorni perché la cliente non aveva ancora
 * una nutrizionista assegnata e l'avviso non è andato a nessuno. Da allora la regola è che se il
 * ruolo non è assegnato l'avviso va a chi risponde di quel ruolo.
 */
const finto = (opzioni: {
  assegnata?: string | null;
  staffTrovato?: boolean;
  capi?: string[];
}) => {
  const notification = { create: jest.fn().mockResolvedValue({}) };
  const prisma = {
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue(
        opzioni.assegnata === undefined ? { assignedNutritionistId: 'staff-n' } : { assignedNutritionistId: opzioni.assegnata },
      ),
    },
    staff: {
      findUnique: jest.fn().mockResolvedValue(opzioni.staffTrovato === false ? null : { userId: 'nutri-user' }),
    },
    user: {
      findMany: jest.fn().mockResolvedValue((opzioni.capi ?? ['capo-user']).map((id) => ({ id }))),
    },
    notification,
  } as unknown as PrismaService;
  return { prisma, notification };
};

const avviso = { type: 'menu_cambio_da_verificare', title: 'Cambio da verificare', body: 'Giulia ha cambiato le carote.' };

describe('destinatariNutrizionista', () => {
  it('la nutrizionista assegnata alla cliente', async () => {
    const { prisma } = finto({});
    expect(await destinatariNutrizionista(prisma, 'client-1')).toEqual(['nutri-user']);
  });

  it('nessuna assegnata → i capi nutrizionisti, non il vuoto', async () => {
    const { prisma } = finto({ assegnata: null });
    expect(await destinatariNutrizionista(prisma, 'client-1')).toEqual(['capo-user']);
  });

  it('assegnata ma la scheda staff non esiste più → i capi, non il vuoto', async () => {
    const { prisma } = finto({ assegnata: 'staff-fantasma', staffTrovato: false });
    expect(await destinatariNutrizionista(prisma, 'client-1')).toEqual(['capo-user']);
  });
});

describe('avvisaNutrizionistaDellaCliente', () => {
  it('senza NotificationsService scrive la notifica in tabella, sul canale in-app', async () => {
    const { prisma, notification } = finto({});
    const inviate = await avvisaNutrizionistaDellaCliente(prisma, null, 'client-1', avviso);
    expect(inviate).toBe(1);
    const scritta = notification.create.mock.calls[0][0].data;
    expect(scritta.userId).toBe('nutri-user');
    expect(scritta.type).toBe('menu_cambio_da_verificare');
    expect(scritta.channel).toBe('inapp');
    // Il clientId nel payload è quello che rende la notifica cliccabile fino alla scheda giusta.
    expect(scritta.payload.clientId).toBe('client-1');
    expect(scritta.payload.title).toBe('Cambio da verificare');
  });

  it('col servizio, usa il servizio (che rispetta le preferenze e manda il push)', async () => {
    const { prisma, notification } = finto({});
    const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    await avvisaNutrizionistaDellaCliente(prisma, notifications, 'client-1', avviso);
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'nutri-user', type: 'menu_cambio_da_verificare' }),
    );
    expect(notification.create).not.toHaveBeenCalled();
  });

  it('non esplode mai: chi chiama ha già scritto il menu di domani', async () => {
    const prisma = {
      clientProfile: { findUnique: jest.fn().mockRejectedValue(new Error('database muto')) },
    } as unknown as PrismaService;
    await expect(avvisaNutrizionistaDellaCliente(prisma, null, 'client-1', avviso)).resolves.toBe(0);
  });

  it('e non esplode nemmeno se è la scrittura della notifica a fallire', async () => {
    const { prisma } = finto({});
    (prisma.notification.create as jest.Mock).mockRejectedValue(new Error('tabella piena'));
    await expect(avvisaNutrizionistaDellaCliente(prisma, null, 'client-1', avviso)).resolves.toBe(0);
  });
});

describe('avvisaCapiNutrizionisti (gruppi di equivalenza)', () => {
  const gruppo = { type: 'equivalence_group_new', title: 'Gruppo da approvare', body: '«Pesci bianchi» è in bozza.' };

  it('avvisa tutti i capi', async () => {
    const { prisma, notification } = finto({ capi: ['capo-1', 'capo-2'] });
    expect(await avvisaCapiNutrizionisti(prisma, null, gruppo)).toBe(2);
    expect(notification.create).toHaveBeenCalledTimes(2);
  });

  it('ma NON chi l\'ha appena creato: sarebbe una notifica su quello che ha fatto lui', async () => {
    const { prisma, notification } = finto({ capi: ['capo-1', 'capo-2'] });
    expect(await avvisaCapiNutrizionisti(prisma, null, gruppo, 'capo-1')).toBe(1);
    expect(notification.create.mock.calls[0][0].data.userId).toBe('capo-2');
  });

  it('se il capo è l\'unico e ha creato lui il gruppo, non parte niente', async () => {
    const { prisma, notification } = finto({ capi: ['capo-1'] });
    expect(await avvisaCapiNutrizionisti(prisma, null, gruppo, 'capo-1')).toBe(0);
    expect(notification.create).not.toHaveBeenCalled();
  });
});

/**
 * «Per qualsiasi cosa, se il nutrizionista non è assegnato va ripiegato sul nutrizionista capo»
 * (Simone, 12/8). Prima questa riga era scritta tre volte, in tre modi, e in tre punti era
 * `if (staffIds.length === 0) return;` — cioè silenzio proprio sulle clienti più scoperte.
 */
describe('destinatariStaffDellaCliente', () => {
  const prismaFinto = (over: Record<string, unknown> = {}) => ({
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({ assignedCoachId: 's-c', assignedNutritionistId: 's-n' }),
    },
    staff: { findMany: jest.fn().mockResolvedValue([{ userId: 'u-coach' }, { userId: 'u-nutri' }]) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'u-capo' }]) },
    ...over,
  });

  it('con coach e nutrizionista assegnate, l\'avviso va a tutte e due', async () => {
    const p: any = prismaFinto();
    expect(await destinatariStaffDellaCliente(p, 'c-1')).toEqual(['u-coach', 'u-nutri']);
    expect(p.user.findMany).not.toHaveBeenCalled();
  });

  it('⚠️ senza NESSUNO assegnato si ripiega sui capi, non sul vuoto', async () => {
    const p: any = prismaFinto();
    p.clientProfile.findUnique.mockResolvedValue({ assignedCoachId: null, assignedNutritionistId: null });
    expect(await destinatariStaffDellaCliente(p, 'c-1')).toEqual(['u-capo']);
  });

  it('con la sola coach assegnata NON si disturbano i capi', async () => {
    // Qualcuno c'è: aggiungere il capo a ogni avviso lo abituerebbe a ignorarli.
    const p: any = prismaFinto();
    p.clientProfile.findUnique.mockResolvedValue({ assignedCoachId: 's-c', assignedNutritionistId: null });
    p.staff.findMany.mockResolvedValue([{ userId: 'u-coach' }]);
    expect(await destinatariStaffDellaCliente(p, 'c-1')).toEqual(['u-coach']);
  });

  it('⚠️ schede assegnate ma senza utenza: si ripiega lo stesso', async () => {
    // `assignedNutritionistId` valorizzato non garantisce che dietro ci sia un account.
    const p: any = prismaFinto();
    p.staff.findMany.mockResolvedValue([]);
    expect(await destinatariStaffDellaCliente(p, 'c-1')).toEqual(['u-capo']);
  });

  it('la stessa persona in due ruoli conta una volta sola', async () => {
    const p: any = prismaFinto();
    p.staff.findMany.mockResolvedValue([{ userId: 'u-x' }, { userId: 'u-x' }]);
    expect(await destinatariStaffDellaCliente(p, 'c-1')).toEqual(['u-x']);
  });

  it('senza profilo cliente non si avvisa nessuno', async () => {
    const p: any = prismaFinto();
    p.clientProfile.findUnique.mockResolvedValue(null);
    expect(await destinatariStaffDellaCliente(p, 'c-1')).toEqual([]);
  });

  it('non lancia mai: chi chiama sta facendo il lavoro vero', async () => {
    const p: any = { clientProfile: { findUnique: jest.fn().mockRejectedValue(new Error('db giù')) } };
    await expect(destinatariStaffDellaCliente(p, 'c-1')).resolves.toEqual([]);
  });
});
