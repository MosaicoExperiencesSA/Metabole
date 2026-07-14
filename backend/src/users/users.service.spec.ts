import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
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

  it('imposta mustChangePassword quando richiesto (default false)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u4', email: 'x@y.it', role: 'coach' });
    await service.create(
      { email: 'x@y.it', password: 'password123', role: 'coach', mustChangePassword: true },
      'admin-1',
    );
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ mustChangePassword: true }) }),
    );

    prisma.user.create.mockResolvedValue({ id: 'u5', email: 'z@y.it', role: 'coach' });
    await service.create({ email: 'z@y.it', password: 'password123', role: 'coach' }, 'admin-1');
    expect(prisma.user.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ mustChangePassword: false }) }),
    );
  });

  it('reset password admin: genera provvisoria, forza il cambio, revoca le sessioni, non logga la password', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'coach@metabole.eu' });
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    const r = await service.resetPassword('u1', 'admin-1');
    expect(r.generated).toBe(true);
    expect(r.password.length).toBeGreaterThanOrEqual(10);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: expect.objectContaining({ mustChangePassword: true }) }),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', revokedAt: null } }),
    );
    const call = audit.log.mock.calls.find((c) => c[0].action === 'admin.user.reset_password');
    expect(call).toBeTruthy();
    expect(JSON.stringify(call![0].metadata)).not.toContain(r.password); // MAI la password nei log
  });

  it('reset password admin: se fornita, usa quella (generated=false)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'x@y.it' });
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    const r = await service.resetPassword('u1', 'admin-1', 'SceltaAdmin9');
    expect(r.generated).toBe(false);
    expect(r.password).toBe('SceltaAdmin9');
  });

  it('il cambio password azzera mustChangePassword', async () => {
    const passwordHash = await argon2.hash('vecchia123');
    prisma.user.findUnique.mockResolvedValue({ passwordHash });
    await service.changePassword('u1', 'vecchia123', 'nuovapassword1');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ mustChangePassword: false }),
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

  describe('archive / restore', () => {
    it('non permette di archiviare sé stessi', async () => {
      await expect(service.archive('me', 'me')).rejects.toThrow('tuo stesso account');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('non permette di archiviare l\'admin protetto (variabile Render)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'a1', email: 'simone.salogni@gmail.com', deletedAt: null });
      await expect(service.archive('a1', 'admin-1')).rejects.toThrow('admin principale');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('archivia un utente normale (soft-delete + sospeso + sessioni revocate)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u9', email: 'coach.test@metabole.eu', deletedAt: null });
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({});
      const res = await service.archive('u9', 'admin-1');
      expect(res).toEqual({ archived: true });
      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.deletedAt).toBeInstanceOf(Date);
      expect(data.status).toBe('suspended');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.user.archive' }));
    });

    it('non archivia due volte', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u9', email: 'x@y.z', deletedAt: new Date() });
      await expect(service.archive('u9', 'admin-1')).rejects.toThrow('già archiviato');
    });

    it('ripristina un utente archiviato', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u9', deletedAt: new Date() });
      prisma.user.update.mockResolvedValue({});
      const res = await service.restore('u9', 'admin-1');
      expect(res).toEqual({ restored: true });
      expect(prisma.user.update.mock.calls[0][0].data).toEqual({ deletedAt: null, status: 'active' });
    });

    it('non ripristina un utente non archiviato', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u9', deletedAt: null });
      await expect(service.restore('u9', 'admin-1')).rejects.toThrow('non archiviato');
    });
  });
});
