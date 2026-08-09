/**
 * I PASTI DEL DIGIUNO dalla scheda cliente (richiesta di Simone del 10/8).
 *
 * `fastingWindow` decide quali pasti il motore eroga: cambiarla vuol dire che domani mattina quella
 * cliente ha o non ha una colazione. Fino a oggi era invisibile al backoffice — lo staff non poteva
 * sapere se una cliente in digiuno saltava la colazione o la cena — e modificabile senza alcun
 * permesso dedicato, a differenza di regime e stile.
 *
 * Questi test tengono ferme le tre decisioni che si possono sbagliare in silenzio:
 *  1. serve il permesso **suo** («Cambia i pasti del digiuno»), separato da quello del tipo di dieta:
 *     è il motivo per cui esiste, poterlo dare alla coach senza darle anche regime e stile;
 *  2. il permesso si chiede **solo se il valore cambia davvero** — il form della scheda rimanda
 *     tutti i campi a ogni salvataggio, quindi controllare la presenza invece del cambiamento
 *     bloccherebbe qualunque modifica di anagrafica a chi non ha quel flag;
 *  3. se il percorso non è più digiuno, la finestra si **azzera**: restando scritta, al ritorno al
 *     digiuno riprenderebbe un valore vecchio senza che nessuno l'abbia scelto.
 */

import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { MenuService } from '../menu/menu.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientsService } from './clients.service';

const PROFILO = { fastingWindow: 'skip_breakfast', pathType: 'intermittent_fasting' };

async function crea(opzioni?: { permesso?: boolean; profilo?: Record<string, unknown> }) {
  const permesso = opzioni?.permesso ?? true;
  const profilo = { ...PROFILO, ...(opzioni?.profilo ?? {}) };
  const prisma: any = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'cli-1', role: 'client', deletedAt: null }),
      // `findUnique` serve per DUE cose nello stesso metodo: leggere il ruolo dell'attore e
      // verificare che il destinatario sia una cliente. Rispondere sempre «coach» faceva fallire
      // il secondo controllo con «Modificabile solo per i clienti»: si distingue per id.
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where?.id === 'cli-1' ? { id: 'cli-1', role: 'client' } : { id: where?.id, role: 'coach' }),
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({ ...profilo, assignedCoachId: 'staff-1', objective: 'dimagrimento' }),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    rolePagePermission: {
      findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(
          where?.role_pageKey?.pageKey === 'change_fasting_window'
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
    ],
  }).compile();
  return { service: moduleRef.get(ClientsService), prisma, audit };
}

/** I dati scritti sul profilo nell'ultima chiamata a `upsert`. */
const scritto = (prisma: any) => (prisma.clientProfile.upsert.mock.calls.at(-1)?.[0] as any)?.update ?? {};

describe('pasti del digiuno dalla scheda cliente', () => {
  it('con il permesso si cambia, e resta una riga di log dedicata', async () => {
    const { service, prisma, audit } = await crea({ permesso: true });
    await service.updateClient('cli-1', 'coach-user', { fastingWindow: 'skip_breakfast_lunch' } as never);
    expect(scritto(prisma).fastingWindow).toBe('skip_breakfast_lunch');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'client.fasting_window.change',
        metadata: { before: 'skip_breakfast', after: 'skip_breakfast_lunch' },
      }),
    );
  });

  it('senza il permesso il cambio è rifiutato, con un messaggio che dice quale flag serve', async () => {
    const { service } = await crea({ permesso: false });
    await expect(
      service.updateClient('cli-1', 'coach-user', { fastingWindow: 'skip_dinner_breakfast' } as never),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.updateClient('cli-1', 'coach-user', { fastingWindow: 'skip_dinner_breakfast' } as never),
    ).rejects.toThrow(/Cambia i pasti del digiuno/);
  });

  /**
   * Il caso che rompe le schede se si sbaglia: la pagina rimanda TUTTI i campi a ogni salvataggio,
   * quindi `fastingWindow` arriva sempre. Chiedere il permesso alla presenza del campo, e non al
   * suo cambiamento, impedirebbe a chi non ce l'ha di correggere anche solo un numero di telefono.
   */
  it('rimandare lo stesso valore non chiede nessun permesso', async () => {
    const { service, prisma } = await crea({ permesso: false });
    await expect(
      service.updateClient('cli-1', 'coach-user', { fastingWindow: 'skip_breakfast', phone: '333' } as never),
    ).resolves.toEqual({ updated: true });
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('si può svuotare: «li decide la dieta» è una scelta legittima', async () => {
    const { service, prisma } = await crea({ permesso: true });
    await service.updateClient('cli-1', 'coach-user', { fastingWindow: '' } as never);
    expect(scritto(prisma).fastingWindow).toBeNull();
  });

  it('cambiando percorso a 5 pasti la finestra si azzera da sé', async () => {
    const { service, prisma } = await crea({ permesso: true });
    await service.updateClient('cli-1', 'coach-user', { pathType: 'five' } as never);
    expect(scritto(prisma).fastingWindow).toBeNull();
  });

  it('restando nel digiuno, cambiare altro non tocca la finestra', async () => {
    const { service, prisma } = await crea({ permesso: false });
    await service.updateClient('cli-1', 'coach-user', { pathType: 'intermittent_fasting', phone: '333' } as never);
    // Nessun cambio → nessun permesso richiesto e il valore resta quello di prima.
    expect(scritto(prisma).fastingWindow ?? 'skip_breakfast').toBe('skip_breakfast');
  });
});
