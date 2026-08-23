/**
 * LE ALLERGIE DALLA SCHEDA CLIENTE — richiesta di Simone (13/8): «nella scheda cliente e scheda
 * lead il nutrizionista li deve leggere e poter modificare, magari mettiamo l'impostazione nei
 * permessi».
 *
 * Fino a oggi le allergie le scriveva **un solo punto in tutto il codice**, l'upsert del
 * questionario: non erano nel DTO della scheda, non in `PROFILE_FIELDS`, in nessun DTO dello staff.
 * Aprirle è la cosa giusta — qualcuno deve poter codificare a mano un'allergia scritta in testo
 * libero — ma aprirle *senza permesso* vorrebbe dire darle a chiunque abbia accesso ai clienti,
 * coach comprese. E un'allergia è un blocco duro: chi ne toglie una decide che da domani quella
 * cliente può trovarsi quell'alimento nel piatto.
 *
 * I tre punti che si sbagliano in silenzio, e che questi test tengono fermi:
 *  1. serve il permesso **suo** (`change_allergies`), non «Clienti: gestisci»;
 *  2. il permesso si chiede **solo se l'elenco cambia davvero** — il form rimanda tutti i campi a
 *     ogni salvataggio, quindi controllare la presenza bloccherebbe alla coach anche la modifica
 *     di un numero di telefono;
 *  3. quello che non è un codice UE finisce in `allergiesOther`, cioè «da codificare a mano».
 */

import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { MenuService } from '../menu/menu.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CoachTasksService } from '../coach-tasks/coach-tasks.service';
import { PrenotazioniService } from '../agenda/prenotazioni.service';
import { PauseService } from '../pause/pause.service';
import { ClientsService } from './clients.service';

const PROFILO = {
  allergies: ['latte'],
  allergiesOther: [],
  allergieDichiarateIl: new Date('2026-08-01T00:00:00Z'),
  intolerances: [],
  pathType: 'five',
  objective: 'dimagrimento',
};

async function crea(opzioni?: { permesso?: boolean; profilo?: Record<string, unknown> }) {
  const permesso = opzioni?.permesso ?? true;
  const profilo = { ...PROFILO, ...(opzioni?.profilo ?? {}) };
  const prisma: any = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'cli-1', role: 'client', deletedAt: null }),
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where?.id === 'cli-1' ? { id: 'cli-1', role: 'client' } : { id: where?.id, role: 'coach' }),
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({ ...profilo, assignedCoachId: 'staff-1' }),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    rolePagePermission: {
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(
          where?.role_pageKey?.pageKey === 'change_allergies'
            ? { canView: true, canManage: permesso }
            : { canView: true, canManage: true },
        ),
      ),
    },
    coachTeam: { findMany: jest.fn().mockResolvedValue([]) },
    staffMember: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    diet: { findFirst: jest.fn().mockResolvedValue(null) },
    menuDay: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    notification: { create: jest.fn().mockResolvedValue({}) },
    escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'e1' }) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const moduleRef = await Test.createTestingModule({
    providers: [
      ClientsService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuthService, useValue: {} },
      { provide: AuditService, useValue: audit },
      { provide: NotificationsService, useValue: { notify: jest.fn().mockResolvedValue(undefined) } },
      { provide: MenuService, useValue: { restartFromPlanStart: jest.fn(), regenerateFromToday: jest.fn() } },
      { provide: CoachTasksService, useValue: { apriAttivita: jest.fn().mockResolvedValue(true) } },
      { provide: PrenotazioniService, useValue: { credito: jest.fn().mockResolvedValue({ disponibili: 0, concesse: 0, usate: 0 }) } },
      /**
       * ⚠️ `PauseService` è entrato nel costruttore il 23/8: la modalità viaggio adesso crea una
       * sospensione vera. Qui non è l'oggetto del test, ma i due metodi vanno esposti — la scheda
       * li chiama a ogni salvataggio della card viaggio.
       */
      {
        provide: PauseService,
        useValue: {
          sospendiPerViaggio: jest.fn().mockResolvedValue({ giorni: 0, nuovaScadenza: null, avviso: null }),
          togliSospensioneDaViaggio: jest.fn().mockResolvedValue({ tolta: false, avviso: null }),
        },
      },
    ],
  }).compile();
  return { service: moduleRef.get(ClientsService), prisma, audit };
}

/** I dati scritti sul profilo nell'ultima `upsert`. */
const scritto = (prisma: any) => (prisma.clientProfile.upsert.mock.calls.at(-1)?.[0] as any)?.update ?? {};

describe('le allergie dalla scheda cliente', () => {
  it('col permesso si correggono', async () => {
    const { service, prisma } = await crea({ permesso: true });
    await service.updateClient('cli-1', 'nutri-user', { allergies: ['latte', 'uova'] } as never);
    expect(scritto(prisma).allergies).toEqual(['latte', 'uova']);
  });

  it('⚠️ senza il permesso è rifiutato, e il messaggio dice quale flag serve', async () => {
    const { service } = await crea({ permesso: false });
    await expect(
      service.updateClient('cli-1', 'coach-user', { allergies: ['latte', 'uova'] } as never),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.updateClient('cli-1', 'coach-user', { allergies: [] } as never),
    ).rejects.toThrow(/Modifica allergie/);
  });

  it('⚠️ e TOGLIERLE senza permesso è rifiutato quanto aggiungerle', async () => {
    // È il verso pericoloso: chi toglie un'allergia decide che da domani quella cliente può
    // trovarsi quell'alimento nel piatto.
    const { service } = await crea({ permesso: false });
    await expect(
      service.updateClient('cli-1', 'coach-user', { allergies: [] } as never),
    ).rejects.toThrow(ForbiddenException);
  });

  /**
   * ⚠️ IL CASO CHE ROMPEREBBE LA SCHEDA A TUTTI.
   *
   * Il form rimanda **tutti** i campi a ogni salvataggio, quindi `allergies` arriva sempre.
   * Chiedere il permesso alla presenza del campo, invece che al cambiamento, vorrebbe dire che una
   * coach non riesce più a salvare nemmeno un numero di telefono — con un errore che parla di
   * allergie, cioè incomprensibile.
   */
  it('⚠️ elenco IDENTICO: si salva lo stesso, anche senza il permesso', async () => {
    const { service, prisma } = await crea({ permesso: false });
    await service.updateClient('cli-1', 'coach-user', { allergies: ['latte'], phone: '333' } as never);
    expect(prisma.user.update).toHaveBeenCalled();
    // E il campo non finisce nemmeno nella scrittura: non c'è niente da scrivere.
    expect(scritto(prisma).allergies).toBeUndefined();
  });

  it('⚠️ quello che non è un codice UE resta segnato come «da codificare a mano»', async () => {
    // È il ripopolamento previsto per `allergiesOther`: qui una nutrizionista ha l'elenco davanti e
    // preme Salva, quindi «non è un codice UE ⇒ è testo libero» non è un'ipotesi, è quello che ha
    // appena scritto lei. Finché resta lì, la base personale sicura è bloccata.
    const { service, prisma } = await crea({ permesso: true });
    await service.updateClient('cli-1', 'nutri-user', { allergies: ['latte', 'fragole'] } as never);
    expect(scritto(prisma).allergiesOther).toEqual(['fragole']);
  });

  it('e quando le codifica tutte, la riga «da codificare» si svuota', async () => {
    const { service, prisma } = await crea({ permesso: true, profilo: { allergiesOther: ['frutta secca'] } });
    await service.updateClient('cli-1', 'nutri-user', { allergies: ['latte', 'frutta_a_guscio'] } as never);
    expect(scritto(prisma).allergiesOther).toEqual([]);
  });

  it('correggerle vale come DICHIARARLE: la cliente esce da quelle da ricontattare', async () => {
    const { service, prisma } = await crea({ permesso: true, profilo: { allergieDichiarateIl: null } });
    await service.updateClient('cli-1', 'nutri-user', { allergies: ['latte', 'uova'] } as never);
    expect(scritto(prisma).allergieDichiarateIl).toBeInstanceOf(Date);
  });

  it('⚠️ ma un salvataggio che non le tocca non ri-timbra la data', async () => {
    // Il log modifiche si riempirebbe di righe «Allergie dichiarate il» a ogni Salva, e un log
    // pieno di righe che non dicono niente è un log che si smette di leggere.
    const { service, prisma } = await crea({ permesso: true });
    await service.updateClient('cli-1', 'nutri-user', { allergies: ['latte'], phone: '333' } as never);
    expect(scritto(prisma).allergieDichiarateIl).toBeUndefined();
  });

  it('la modifica finisce nel log con gli altri campi cambiati', async () => {
    const { service, audit } = await crea({ permesso: true });
    await service.updateClient('cli-1', 'nutri-user', { allergies: ['latte', 'pesce'] } as never);
    const riga = (audit.log as jest.Mock).mock.calls.map((c) => c[0]).find((c) => c.action === 'client.update');
    expect((riga?.metadata?.campi ?? []).map((c: { campo: string }) => c.campo)).toContain('allergies');
  });
});
