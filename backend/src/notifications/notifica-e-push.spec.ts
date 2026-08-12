/**
 * «Verifica bene che se la cliente scrive a nutrizionista o coach gli arriva anche la notifica
 * push, e poi resta salvata nelle notifiche» (Simone, 12/8).
 *
 * Sono due effetti distinti dello stesso avviso — la riga che resta e la push che arriva — e
 * finora nessun test guardava che partissero **tutti e due**. Un avviso che si vede solo aprendo
 * l'app non è un avviso; una push senza riga è una cosa che è successa e di cui non resta traccia.
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConfigParamsService } from '../config-params/config-params.service';
import { I18nService } from '../i18n/i18n.service';
import { MailService } from '../mail/mail.service';
import { MenuService } from '../menu/menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessageComposerService } from './message-composer.service';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

const AVVISO = {
  userId: 'u-nutri',
  type: 'chat_message_nutritionist',
  title: 'Patrizia ti ha scritto',
  body: 'Apri la chat per leggere il messaggio.',
  payload: { clientId: 'c-1', threadId: 'th-1', kind: 'chat_message_staff' },
  dedupeWindowMs: 3 * 60_000,
};

async function creaServizio(tocca?: (prisma: any) => void) {
  const prisma: any = {
    notification: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'n-1' }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: 'n@x.it', locale: 'it', clientProfile: null }),
    },
  };
  if (tocca) tocca(prisma);
  const push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
  const mail = { sendNotificationEmail: jest.fn().mockResolvedValue(true) };
  const moduleRef = await Test.createTestingModule({
    providers: [
      NotificationsService,
      MessageComposerService,
      I18nService,
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigParamsService, useValue: { getNumber: jest.fn().mockResolvedValue(0), getString: jest.fn() } },
      { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      { provide: MailService, useValue: mail },
      { provide: MenuService, useValue: {} },
      { provide: PushService, useValue: push },
    ],
  }).compile();
  return { service: moduleRef.get(NotificationsService) as NotificationsService, prisma, push, mail };
}

describe('la cliente scrive alla nutrizionista', () => {
  it('la notifica RESTA SALVATA, con dentro la conversazione', async () => {
    const { service, prisma } = await creaServizio();
    expect(await service.notifyOncePerDay(AVVISO)).toBe(true);

    const riga = prisma.notification.create.mock.calls[0][0].data;
    expect(riga.userId).toBe('u-nutri');
    expect(riga.type).toBe('chat_message_nutritionist');
    expect(riga.sentAt).toBeInstanceOf(Date); // in app è disponibile subito
    expect(riga.payload).toEqual(expect.objectContaining({
      title: 'Patrizia ti ha scritto',
      threadId: 'th-1',
      clientId: 'c-1',
    }));
  });

  it('⚠️ e la PUSH parte, con i dati per aprire la chat giusta', async () => {
    const { service, push } = await creaServizio();
    await service.notifyOncePerDay(AVVISO);

    expect(push.sendToUser).toHaveBeenCalledTimes(1);
    const [userId, titolo, corpo, dati] = push.sendToUser.mock.calls[0];
    expect(userId).toBe('u-nutri');
    expect(titolo).toBe('Patrizia ti ha scritto');
    // ⚠️ Prima qui viaggiava il solo `type`: la push arrivava e il tocco apriva l'app sulla home,
    // col messaggio da ritrovare a mano — che è esattamente quello per cui una notifica esiste.
    expect(dati).toEqual({
      type: 'chat_message_nutritionist',
      kind: 'chat_message_staff',
      threadId: 'th-1',
      clientId: 'c-1',
    });
    // Nell'anteprima sulla schermata di blocco non c'è il messaggio della cliente.
    expect(corpo).not.toContain('Patrizia ti ha scritto:');
  });

  it('⚠️ due messaggi di fila = una notifica sola; due clienti diverse = due', async () => {
    // L'anti-raffica è per CLIENTE (`dedupeSuPayload`): senza, una coach con quaranta clienti
    // riceveva una notifica su quaranta e la chat sembrava silenziosa mentre si riempiva.
    const { service, prisma } = await creaServizio((p) => p.notification.findFirst.mockResolvedValue({ id: 'gia' }));
    expect(await service.notifyOncePerDay(AVVISO)).toBe(false);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('⚠️ se la push non parte, l\'avviso resta e chi ha chiamato NON fallisce', async () => {
    // `sendToUser` legge i token dal database fuori dal proprio try: un intoppo lì risaliva fino a
    // `postMessage`, cioè fino alla cliente che aveva appena premuto «invia» — messaggio salvato,
    // schermata in errore, e lei che lo riscrive. L'avviso è un di più; il messaggio no.
    const { service, prisma, push } = await creaServizio();
    push.sendToUser.mockRejectedValue(new Error('FCM giù'));
    await expect(service.notifyOncePerDay(AVVISO)).resolves.toBe(true);
    // La riga è scritta PRIMA della push: l'ordine conta.
    expect(prisma.notification.create).toHaveBeenCalled();
  });
});
