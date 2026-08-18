import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { MenuService } from '../menu/menu.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClientsService } from './clients.service';

/**
 * Reset password dalla scheda cliente (richiesta di Simone dell'8/8): lo fa anche la COACH, ma solo
 * sulle proprie clienti. Prima la rotta era `@Roles('admin')` e la coach leggeva «Solo un admin può
 * inviare il reset password» proprio mentre era al telefono con la cliente che non riusciva a
 * entrare.
 *
 * Togliere quel guardrail sposta tutto il peso su due controlli nel servizio, e questi test
 * esistono per tenerli inchiodati: il secondo in particolare copre un buco che il ruolo admin
 * mascherava — un manager (che NON ha scope, quindi passa `assertClientAccess`) avrebbe potuto far
 * ripartire la password di un ADMIN passandone l'id.
 */
describe('ClientsService.sendPasswordReset — chi può, su chi', () => {
  const COACH_A = 'staff-a';
  const COACH_B = 'staff-b';

  function make(opts: {
    ruoloAttore: string;
    /** Staff a cui la cliente è assegnata (null = nessuno). */
    assegnataA: string | null;
    /** Ruolo dell'utente bersaglio: 'client' o altro (staff/admin). */
    ruoloBersaglio?: string;
  }) {
    const requestPasswordReset = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: opts.ruoloAttore }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'cliente-1',
          email: 'cliente@test.it',
          role: opts.ruoloBersaglio ?? 'client',
        }),
      },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          assignedCoachId: opts.assegnataA,
          assignedNutritionistId: null,
        }),
      },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: COACH_A }) },
    };
    const service = new ClientsService(
      prisma as unknown as PrismaService,
      { requestPasswordReset } as unknown as AuthService,
      { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService,
      {} as unknown as NotificationsService,
      {} as unknown as MenuService,
      {} as never,
      {} as never,
    );
    return { service, prisma, requestPasswordReset };
  }

  it('la coach sulla PROPRIA cliente: la mail parte', async () => {
    const { service, requestPasswordReset } = make({ ruoloAttore: 'coach', assegnataA: COACH_A });
    const res = await service.sendPasswordReset('cliente-1', 'utente-coach-a', '1.2.3.4');
    expect(res).toEqual({ sent: true, email: 'cliente@test.it' });
    // Parte il LINK, non una password: nessuno dello staff la vede né la scrive.
    expect(requestPasswordReset).toHaveBeenCalledWith('cliente@test.it', '1.2.3.4');
  });

  it('la coach su una cliente di un\'ALTRA coach: negato, e nessuna mail', async () => {
    const { service, requestPasswordReset } = make({ ruoloAttore: 'coach', assegnataA: COACH_B });
    await expect(service.sendPasswordReset('cliente-1', 'utente-coach-a')).rejects.toThrow(ForbiddenException);
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('cliente senza coach assegnata: la coach non ci arriva', async () => {
    const { service, requestPasswordReset } = make({ ruoloAttore: 'coach', assegnataA: null });
    await expect(service.sendPasswordReset('cliente-1', 'utente-coach-a')).rejects.toThrow(ForbiddenException);
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('ESCALATION: un manager non può far ripartire la password di un ADMIN', async () => {
    // `sales` (manager coach) non ha scope: `assertClientAccess` lo lascia passare. Se il bersaglio
    // non è una cliente deve fermarlo il controllo sul ruolo, altrimenti è un buco di privilegi.
    const { service, requestPasswordReset } = make({
      ruoloAttore: 'sales',
      assegnataA: null,
      ruoloBersaglio: 'admin',
    });
    await expect(service.sendPasswordReset('un-admin', 'utente-manager')).rejects.toThrow(ForbiddenException);
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('l\'admin sulla cliente di chiunque: passa (nessuno scope)', async () => {
    const { service, requestPasswordReset } = make({ ruoloAttore: 'admin', assegnataA: COACH_B });
    await expect(service.sendPasswordReset('cliente-1', 'utente-admin')).resolves.toMatchObject({ sent: true });
    expect(requestPasswordReset).toHaveBeenCalled();
  });

  it('utente inesistente o archiviato: 404, non un invio a vuoto', async () => {
    const { service, prisma, requestPasswordReset } = make({ ruoloAttore: 'admin', assegnataA: null });
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.sendPasswordReset('non-esiste', 'utente-admin')).rejects.toThrow(NotFoundException);
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });
});
