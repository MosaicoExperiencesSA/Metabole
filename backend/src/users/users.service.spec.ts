import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { FinanceService } from '../commerce/finance.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService (admin)', () => {
  let service: UsersService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: { updateMany: jest.fn() },
      staff: { create: jest.fn().mockResolvedValue({ id: 'st1' }) },
      clientProfile: { findUnique: jest.fn(), update: jest.fn() },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: FinanceService, useValue: { resolvePendingForAssignment: jest.fn() } },
        { provide: MailService, useValue: { sendClientAssignedToNutritionist: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('crea un utente staff con ruolo scelto e logga in audit', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u2', email: 'coach@metabole.it', role: 'coach' });

    const user = await service.create(
      { email: 'Coach@Metabole.it', password: 'password123', role: 'coach' },
      'admin-1',
    );
    expect(user.role).toBe('coach');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'coach@metabole.it', role: 'coach' }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.user.create', actorId: 'admin-1' }),
    );
    // Per i ruoli staff viene creata anche la scheda Staff
    expect(prisma.staff.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ displayName: 'coach' }),
      }),
    );
  });

  it('per i clienti NON crea la scheda Staff', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u9', email: 'c@b.it', role: 'client' });
    await service.create({ email: 'c@b.it', password: 'password123', role: 'client' }, 'admin-1');
    expect(prisma.staff.create).not.toHaveBeenCalled();
  });

  it('rifiuta email duplicata', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    await expect(
      service.create({ email: 'a@b.it', password: 'password123', role: 'sales' }, 'admin-1'),
    ).rejects.toThrow(ConflictException);
  });

  it('sospendere un utente revoca le sue sessioni', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u3' });
    prisma.user.update.mockResolvedValue({ id: 'u3', status: 'suspended' });

    await service.update('u3', { status: 'suspended' }, 'admin-1');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u3', revokedAt: null } }),
    );
  });

  it('404 su utente inesistente', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.getById('ghost')).rejects.toThrow(NotFoundException);
  });

  it('la lista non espone mai password_hash', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);
    await service.list({});
    const select = prisma.user.findMany.mock.calls[0][0].select;
    expect(select.passwordHash).toBeUndefined();
    expect(select.email).toBe(true);
  });
});
