/**
 * §16.7 — la prenotazione dal lato della cliente. I test sono tutti su quello che NON deve
 * succedere: prenotare senza aver pagato, prendere un orario che qualcun altro ha appena preso,
 * restare senza appuntamento avendo solo provato a spostarlo.
 */
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgendaService } from './agenda.service';
import { PrenotazioniService } from './prenotazioni.service';

const DOMANI = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
};

const SLOT = { id: 'slot-1', nutritionistId: 'staff-n', startMin: 600, endMin: 660, type: 'in_person', active: true };

async function creaServizio(
  tocca?: (ctx: { prisma: any; agenda: any }) => void,
  mail: any = { sendVisitaPrenotata: jest.fn().mockResolvedValue(true) },
) {
  const prisma: any = {
    clientProfile: {
      // ⚠️ Due lettori diversi dello stesso profilo: il servizio legge `assignedNutritionist`,
      // `destinatariNutrizionista` legge `assignedNutritionistId`. Se il finto ne conosce solo uno,
      // il test passa mentre la notifica in produzione finirebbe (in silenzio) ai capi.
      findUnique: jest.fn().mockResolvedValue({
        assignedNutritionistId: 'staff-n',
        assignedNutritionist: { id: 'staff-n', displayName: 'Dr.ssa Rossi' },
      }),
    },
    staff: { findUnique: jest.fn().mockResolvedValue({ userId: 'u-nutri' }) },
    order: { findMany: jest.fn().mockResolvedValue([{ items: [{ productId: 'p-visita', qty: 1 }] }]) },
    product: { findMany: jest.fn().mockResolvedValue([{ id: 'p-visita', visitsGranted: 1 }]) },
    visit: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'v-1' }),
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    visitSlot: { findUnique: jest.fn().mockResolvedValue(SLOT) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: 'c@x.it', firstName: 'Patrizia', locale: 'it' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    notification: { create: jest.fn().mockResolvedValue({}) },
  };
  const agenda: any = {
    orariLiberi: jest.fn().mockResolvedValue([
      { slotId: 'slot-1', data: DOMANI(), inizio: '10:00', fine: '11:00', inizioIso: '', tipo: 'in_person', festivita: null },
    ]),
  };
  if (tocca) tocca({ prisma, agenda });
  const moduleRef = await Test.createTestingModule({
    providers: [
      PrenotazioniService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      { provide: AgendaService, useValue: agenda },
      { provide: MailService, useValue: mail },
    ],
  }).compile();
  return { service: moduleRef.get(PrenotazioniService) as PrenotazioniService, prisma, agenda };
}

describe('PrenotazioniService — prenotare', () => {
  it('con una visita acquistata e uno slot libero, prenota', async () => {
    const { service, prisma } = await creaServizio();
    const esito = await service.prenota('c-1', { slotId: 'slot-1', data: DOMANI() });
    expect(esito.id).toBe('v-1');
    const data = prisma.visit.create.mock.calls[0][0].data;
    expect(data).toEqual(expect.objectContaining({ clientId: 'c-1', nutritionistId: 'staff-n', slotId: 'slot-1' }));
    // ⚠️ La visita ha una FINE: senza, due appuntamenti non si sa se si accavallano.
    expect(data.endsAt).toBeInstanceOf(Date);
    expect(data.endsAt.getTime()).toBeGreaterThan(data.datetime.getTime());
  });

  it('⚠️ senza aver acquistato una visita non si prenota', async () => {
    const { service, prisma } = await creaServizio(({ prisma: p }) => p.order.findMany.mockResolvedValue([]));
    await expect(service.prenota('c-1', { slotId: 'slot-1', data: DOMANI() })).rejects.toThrow(/acquistane una/);
    expect(prisma.visit.create).not.toHaveBeenCalled();
  });

  it('⚠️ una visita già fissata consuma il credito', async () => {
    const { service } = await creaServizio(({ prisma: p }) => p.visit.count.mockResolvedValue(1));
    await expect(service.prenota('c-1', { slotId: 'slot-1', data: DOMANI() })).rejects.toThrow(/acquistane una/);
  });

  it('senza nutrizionista assegnata si dice cosa fare, non si dà un errore tecnico', async () => {
    const { service } = await creaServizio(({ prisma: p }) => p.clientProfile.findUnique.mockResolvedValue({ assignedNutritionist: null }));
    await expect(service.prenota('c-1', { slotId: 'slot-1', data: DOMANI() })).rejects.toThrow(/scrivi alla tua coach/);
  });

  it('⚠️ uno slot appena preso da un\'altra non si prenota', async () => {
    // Fra il momento in cui ha guardato e quello in cui preme può passare un minuto e una persona.
    const { service, prisma } = await creaServizio(({ agenda }) => agenda.orariLiberi.mockResolvedValue([]));
    await expect(service.prenota('c-1', { slotId: 'slot-1', data: DOMANI() })).rejects.toThrow(/appena stato preso/);
    expect(prisma.visit.create).not.toHaveBeenCalled();
  });

  it('lo slot di un\'altra nutrizionista non si prenota', async () => {
    const { service } = await creaServizio(({ prisma: p }) => p.visitSlot.findUnique.mockResolvedValue({ ...SLOT, nutritionistId: 'staff-altra' }));
    await expect(service.prenota('c-1', { slotId: 'slot-1', data: DOMANI() })).rejects.toThrow(/un'altra nutrizionista/);
  });

  it('uno slot ritirato non si prenota', async () => {
    const { service } = await creaServizio(({ prisma: p }) => p.visitSlot.findUnique.mockResolvedValue({ ...SLOT, active: false }));
    await expect(service.prenota('c-1', { slotId: 'slot-1', data: DOMANI() })).rejects.toThrow(/non è più disponibile/);
  });

  it('⚠️ la PRIMA visita è sempre in presenza, anche da questa strada', async () => {
    // La regola sta in `visits.service.create` dal principio: applicata solo su uno dei due
    // ingressi non sarebbe una regola.
    const { service } = await creaServizio(({ prisma: p, agenda }) => {
      p.visitSlot.findUnique.mockResolvedValue({ ...SLOT, type: 'televisit' });
      agenda.orariLiberi.mockResolvedValue([
        { slotId: 'slot-1', data: DOMANI(), inizio: '10:00', fine: '11:00', inizioIso: '', tipo: 'televisit', festivita: null },
      ]);
    });
    await expect(service.prenota('c-1', { slotId: 'slot-1', data: DOMANI() })).rejects.toThrow(/sempre in presenza/);
  });

  it('avvisa la nutrizionista e manda l\'email alla cliente', async () => {
    const mail = { sendVisitaPrenotata: jest.fn().mockResolvedValue(true) };
    const { service, prisma } = await creaServizio(undefined, mail);
    await service.prenota('c-1', { slotId: 'slot-1', data: DOMANI() });

    // La notifica va a LEI, non ai capi: un avviso che arriva a chi non tiene quell'agenda non serve.
    const avviso = prisma.notification.create.mock.calls[0][0].data;
    expect(avviso.userId).toBe('u-nutri');
    expect(avviso.type).toBe('appointment_created');
    expect(mail.sendVisitaPrenotata).toHaveBeenCalledWith(
      'c@x.it',
      expect.objectContaining({ nutrizionista: 'Dr.ssa Rossi', disdetta: false }),
      'it',
    );
  });

  it('⚠️ se l\'email non parte, la prenotazione resta', async () => {
    // La visita è già scritta: farla fallire per un avviso vorrebbe dire uno slot occupato in
    // agenda e una cliente convinta di non avere l'appuntamento.
    const mail = { sendVisitaPrenotata: jest.fn().mockRejectedValue(new Error('SMTP giù')) };
    const { service } = await creaServizio(undefined, mail);
    await expect(service.prenota('c-1', { slotId: 'slot-1', data: DOMANI() })).resolves.toMatchObject({ id: 'v-1' });
  });
});

describe('PrenotazioniService — disdire e spostare', () => {
  const futura = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return { id: 'v-1', clientId: 'c-1', datetime: d, status: 'scheduled' };
  };
  const fraTreOre = () => {
    const d = new Date();
    d.setHours(d.getHours() + 3);
    return { id: 'v-1', clientId: 'c-1', datetime: d, status: 'scheduled' };
  };

  it('disdire annulla la visita e lo dice', async () => {
    const { service, prisma } = await creaServizio(({ prisma: p }) => p.visit.findUnique.mockResolvedValue(futura()));
    const esito = await service.disdici('c-1', 'v-1');
    expect(prisma.visit.update).toHaveBeenCalledWith({ where: { id: 'v-1' }, data: { status: 'cancelled' } });
    expect(esito.messaggio).toContain('torna libero');
    // ⚠️ E il credito torna: «la visita resta tua».
    expect(esito.messaggio).toContain('resta tua');
  });

  it('⚠️ sotto le 24 ore non si disdice, e si dice quanto manca', async () => {
    const { service, prisma } = await creaServizio(({ prisma: p }) => p.visit.findUnique.mockResolvedValue(fraTreOre()));
    await expect(service.disdici('c-1', 'v-1')).rejects.toThrow(/Mancano 2 ore|Mancano 3 ore/);
    expect(prisma.visit.update).not.toHaveBeenCalled();
  });

  it('l\'appuntamento di un\'altra persona non si tocca', async () => {
    const { service } = await creaServizio(({ prisma: p }) => p.visit.findUnique.mockResolvedValue({ ...futura(), clientId: 'c-2' }));
    await expect(service.disdici('c-1', 'v-1')).rejects.toThrow(/non trovato/);
  });

  it('⚠️ se lo spostamento non riesce, il vecchio appuntamento TORNA', async () => {
    // Senza questo, una cliente che prova a spostare e non ci riesce resta senza appuntamento
    // avendo solo provato a cambiarlo.
    const { service, prisma } = await creaServizio(({ prisma: p, agenda }) => {
      p.visit.findUnique.mockResolvedValue(futura());
      agenda.orariLiberi.mockResolvedValue([]); // il nuovo orario non è più libero
    });
    await expect(service.sposta('c-1', 'v-1', { slotId: 'slot-1', data: DOMANI() })).rejects.toThrow();
    const stati = prisma.visit.update.mock.calls.map((c: any) => c[0].data.status);
    expect(stati).toEqual(['cancelled', 'scheduled']);
  });
});
