import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { CrmService } from '../commerce/crm.service';
import { LeadAssignmentService } from '../commerce/lead-assignment.service';
import { ReferralService } from '../referral/referral.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: Record<string, jest.Mock>;
    refreshToken: Record<string, jest.Mock>;
    actionToken: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let mail: { sendEmailVerification: jest.Mock; sendPasswordReset: jest.Mock };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      actionToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    // login usa findFirst (OR email/secondaryEmail): stesso mock di findUnique.
    prisma.user.findFirst = prisma.user.findUnique;
    mail = {
      sendEmailVerification: jest.fn().mockResolvedValue(true),
      sendPasswordReset: jest.fn().mockResolvedValue(true),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        { provide: AuditService, useValue: audit },
        { provide: CrmService, useValue: { ensureLead: jest.fn() } },
        {
          provide: LeadAssignmentService,
          useValue: {
            resolveByRefCode: jest.fn().mockResolvedValue(null),
            autoAssignByRefCode: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: ReferralService,
          useValue: {
            isClientCode: jest.fn().mockResolvedValue(null),
            linkOnRegister: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('crea un utente client, invia la verifica email e ritorna i token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'u1', emailVerifiedAt: null, status: 'active', ...data }),
      );
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.actionToken.create.mockResolvedValue({});

      const result = await service.register({ email: 'Test@Example.COM', password: 'password123', firstName: 'Test', lastName: 'User' });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'test@example.com', role: 'client' }),
        }),
      );
      expect(mail.sendEmailVerification).toHaveBeenCalledWith('test@example.com', expect.any(String), 'it');
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toHaveLength(96); // 48 byte hex
      expect(result.user.email).toBe('test@example.com');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.register' }));
    });

    it('rifiuta email già registrata', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(service.register({ email: 'a@b.it', password: 'password123', firstName: 'A', lastName: 'B' })).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('accetta credenziali valide e logga in audit', async () => {
      const passwordHash = await argon2.hash('password123');
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.it',
        role: 'client',
        locale: 'it',
        status: 'active',
        deletedAt: null,
        emailVerifiedAt: null,
        passwordHash,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login('a@b.it', 'password123');
      expect(result.accessToken).toBeDefined();
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login' }));
    });

    it('rifiuta password errata con errore generico e audit login_failed', async () => {
      const passwordHash = await argon2.hash('password123');
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        status: 'active',
        deletedAt: null,
        passwordHash,
      });
      await expect(service.login('a@b.it', 'sbagliata')).rejects.toThrow(UnauthorizedException);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.login_failed' }),
      );
    });

    it('rifiuta utente sospeso', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', status: 'suspended', deletedAt: null });
      await expect(service.login('a@b.it', 'password123')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('ruota il token: revoca il vecchio ed emette una nuova coppia', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 10_000),
        user: { id: 'u1', email: 'a@b.it', role: 'client', status: 'active', deletedAt: null },
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('x'.repeat(96));
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { revokedAt: expect.any(Date) } }),
      );
      expect(result.accessToken).toBe('signed.jwt.token');
    });

    it('rifiuta token revocato', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 10_000),
        user: { status: 'active', deletedAt: null },
      });
      await expect(service.refresh('x'.repeat(96))).rejects.toThrow(UnauthorizedException);
    });

    it('rifiuta token scaduto', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        user: { status: 'active', deletedAt: null },
      });
      await expect(service.refresh('x'.repeat(96))).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('impersonate (master password sicura)', () => {
    const sign = () => (service as any).jwtService.signAsync as jest.Mock;

    it('admin ottiene un token per un utente attivo, con audit', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        email: 'cliente@b.it',
        role: 'client',
        status: 'active',
        deletedAt: null,
      });
      const result = await service.impersonate('admin-1', 'u2');
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.impersonating.id).toBe('u2');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin.impersonate', actorId: 'admin-1' }),
      );
    });

    it('il token contiene impersonatedBy', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        email: 'cliente@b.it',
        role: 'client',
        status: 'active',
        deletedAt: null,
      });
      const moduleJwt = (service as any).jwtService;
      await service.impersonate('admin-1', 'u2');
      expect(moduleJwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ impersonatedBy: 'admin-1', sub: 'u2' }),
        expect.anything(),
      );
    });

    it('non si può impersonare un altro admin', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u3',
        role: 'admin',
        status: 'active',
        deletedAt: null,
      });
      await expect(service.impersonate('admin-1', 'u3')).rejects.toThrow(BadRequestException);
    });

    it('non si può impersonare se stessi né utenti sospesi', async () => {
      await expect(service.impersonate('admin-1', 'admin-1')).rejects.toThrow(BadRequestException);
      prisma.user.findUnique.mockResolvedValue({ id: 'u4', role: 'client', status: 'suspended', deletedAt: null });
      await expect(service.impersonate('admin-1', 'u4')).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifica email e reset password', () => {
    it('verifica email con token valido', async () => {
      prisma.actionToken.findUnique.mockResolvedValue({
        id: 'at1',
        userId: 'u1',
        type: 'email_verification',
        usedAt: null,
        expiresAt: new Date(Date.now() + 10_000),
      });
      const result = await service.verifyEmail('token-valido-lungo-abbastanza');
      expect(result.verified).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('rifiuta token di verifica già usato', async () => {
      prisma.actionToken.findUnique.mockResolvedValue({
        id: 'at1',
        type: 'email_verification',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 10_000),
      });
      await expect(service.verifyEmail('token-usato')).rejects.toThrow(BadRequestException);
    });

    it('richiesta reset per email inesistente non rivela nulla e non invia email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.requestPasswordReset('ghost@b.it')).resolves.toBeUndefined();
      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('conferma reset: aggiorna hash e revoca le sessioni', async () => {
      prisma.actionToken.findUnique.mockResolvedValue({
        id: 'at1',
        userId: 'u1',
        type: 'password_reset',
        usedAt: null,
        expiresAt: new Date(Date.now() + 10_000),
      });
      await service.confirmPasswordReset('token-valido-lungo', 'nuovapassword1');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.password_reset_confirmed' }),
      );
    });
  });
});
