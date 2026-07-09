import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Role } from '../common/roles';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Registrazione ----------

  async register(email: string, password: string, locale?: string, ip?: string) {
    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (existing) throw new ConflictException('Email già registrata');

    const passwordHash = await argon2.hash(password);
    const user = await this.prisma.user.create({
      data: {
        email: normalized,
        passwordHash,
        role: 'client',
        locale: locale ?? 'it',
      },
    });

    await this.audit.log({
      action: 'auth.register',
      actorId: user.id,
      entityType: 'user',
      entityId: user.id,
      ipAddress: ip,
    });

    await this.issueEmailVerification(user.id, normalized);
    const tokens = await this.issueTokenPair(user);
    return { user: this.toPublicUser(user), ...tokens };
  }

  // ---------- Login / logout / refresh ----------

  async login(email: string, password: string, ip?: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    const invalid = new UnauthorizedException('Credenziali non valide');
    if (!user || user.status !== 'active' || user.deletedAt) {
      await this.audit.log({ action: 'auth.login_failed', metadata: { email: normalized }, ipAddress: ip });
      throw invalid;
    }
    const ok = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!ok) {
      await this.audit.log({
        action: 'auth.login_failed',
        actorId: user.id,
        entityType: 'user',
        entityId: user.id,
        ipAddress: ip,
      });
      throw invalid;
    }

    await this.audit.log({
      action: 'auth.login',
      actorId: user.id,
      entityType: 'user',
      entityId: user.id,
      ipAddress: ip,
    });
    const tokens = await this.issueTokenPair(user);
    return { user: this.toPublicUser(user), ...tokens };
  }

  async refresh(refreshToken: string, ip?: string): Promise<TokenPair> {
    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    const invalid = new UnauthorizedException('Refresh token non valido');
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) throw invalid;
    if (!stored.user || stored.user.status !== 'active' || stored.user.deletedAt) throw invalid;

    // Rotazione: revoca il vecchio, emette una nuova coppia.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      action: 'auth.refresh',
      actorId: stored.userId,
      entityType: 'user',
      entityId: stored.userId,
      ipAddress: ip,
    });
    return this.issueTokenPair(stored.user);
  }

  async logout(refreshToken: string, actor?: AuthUser, ip?: string): Promise<void> {
    const tokenHash = sha256(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      action: 'auth.logout',
      actorId: actor?.sub,
      entityType: 'user',
      entityId: actor?.sub,
      ipAddress: ip,
    });
  }

  // ---------- Verifica email ----------

  async issueEmailVerification(userId: string, email: string): Promise<void> {
    const token = randomBytes(32).toString('hex');
    const ttlHours = 48;
    await this.prisma.actionToken.create({
      data: {
        userId,
        type: 'email_verification',
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + ttlHours * 3600_000),
      },
    });
    await this.mail.sendEmailVerification(email, token);
  }

  async verifyEmail(token: string): Promise<{ verified: boolean }> {
    const record = await this.prisma.actionToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (
      !record ||
      record.type !== 'email_verification' ||
      record.usedAt ||
      record.expiresAt < new Date()
    ) {
      throw new BadRequestException('Token di verifica non valido o scaduto');
    }
    await this.prisma.$transaction([
      this.prisma.actionToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);
    await this.audit.log({
      action: 'auth.email_verified',
      actorId: record.userId,
      entityType: 'user',
      entityId: record.userId,
    });
    return { verified: true };
  }

  // ---------- Reset password ----------

  async requestPasswordReset(email: string, ip?: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    // Risposta sempre identica (nessuna enumerazione degli utenti registrati).
    if (!user || user.status !== 'active' || user.deletedAt) return;

    const token = randomBytes(32).toString('hex');
    await this.prisma.actionToken.create({
      data: {
        userId: user.id,
        type: 'password_reset',
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 3600_000), // 1 ora
      },
    });
    await this.audit.log({
      action: 'auth.password_reset_requested',
      actorId: user.id,
      entityType: 'user',
      entityId: user.id,
      ipAddress: ip,
    });
    await this.mail.sendPasswordReset(normalized, token);
  }

  async confirmPasswordReset(token: string, newPassword: string, ip?: string): Promise<void> {
    const record = await this.prisma.actionToken.findUnique({
      where: { tokenHash: sha256(token) },
    });
    if (
      !record ||
      record.type !== 'password_reset' ||
      record.usedAt ||
      record.expiresAt < new Date()
    ) {
      throw new BadRequestException('Token di reset non valido o scaduto');
    }
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.actionToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      // Revoca tutte le sessioni attive: dopo il reset serve un nuovo login.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.log({
      action: 'auth.password_reset_confirmed',
      actorId: record.userId,
      entityType: 'user',
      entityId: record.userId,
      ipAddress: ip,
    });
  }

  // ---------- Impersonazione (la "master password" sicura) ----------

  /**
   * L'admin ottiene un access token a vita breve per operare come un altro
   * utente (assistenza). Regole: mai su altri admin, mai su se stessi,
   * solo utenti attivi. Nessun refresh token. Tutto tracciato in audit.
   */
  async impersonate(adminId: string, targetUserId: string, ip?: string) {
    if (adminId === targetUserId) {
      throw new BadRequestException('Non puoi impersonare te stesso.');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target || target.status !== 'active' || target.deletedAt) {
      throw new BadRequestException('Utente non impersonabile: inesistente o non attivo.');
    }
    if (target.role === 'admin') {
      throw new BadRequestException('Gli account admin non sono impersonabili.');
    }

    const ttl = this.config.get<string>('IMPERSONATION_TTL') ?? '30m';
    const accessToken = await this.jwtService.signAsync(
      {
        sub: target.id,
        email: target.email,
        role: target.role,
        impersonatedBy: adminId,
      },
      { expiresIn: ttl as never },
    );
    await this.audit.log({
      action: 'admin.impersonate',
      actorId: adminId,
      entityType: 'user',
      entityId: target.id,
      metadata: { targetRole: target.role, ttl },
      ipAddress: ip,
    });
    return {
      accessToken,
      expiresIn: ttl,
      impersonating: { id: target.id, email: target.email, role: target.role },
      note: 'Token di sola sessione: nessun refresh token. Ogni azione resta tracciata.',
    };
  }

  // ---------- Interni ----------

  private async issueTokenPair(user: {
    id: string;
    email: string;
    role: Role | string;
  }): Promise<TokenPair> {
    const payload: AuthUser = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = randomBytes(48).toString('hex');
    const ttlDays = parseInt(this.config.get<string>('REFRESH_TTL_DAYS') ?? '30', 10);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
      },
    });
    return { accessToken, refreshToken };
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    role: string;
    locale: string;
    emailVerifiedAt: Date | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      locale: user.locale,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }
}
