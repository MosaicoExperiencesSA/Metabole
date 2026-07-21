import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { CrmService } from '../commerce/crm.service';
import { LeadAssignmentService } from '../commerce/lead-assignment.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Role } from '../common/roles';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralService } from '../referral/referral.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterDto } from './dto/register.dto';

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
    private readonly crm: CrmService,
    private readonly leadAssignment: LeadAssignmentService,
    private readonly referral: ReferralService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------- Registrazione ----------

  async register(dto: RegisterDto, ip?: string) {
    const normalized = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (existing) throw new ConflictException('Email già registrata');

    // Telefono obbligatorio insieme all'email. Deve essere UNIVOCO sulle cifre, così
    // il login-per-telefono (auth.login) resta non ambiguo: se un numero è già usato
    // — anche solo come suffisso — la registrazione viene rifiutata.
    const phone = dto.phone.trim();
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 6) throw new BadRequestException('Numero di telefono non valido');
    const phoneOwners = (await this.prisma.user.findMany({
      where: { phone: { not: null }, deletedAt: null },
      select: { phone: true },
    })) as { phone: string | null }[];
    const phoneClash = phoneOwners.some((u) => {
      const d = (u.phone ?? '').replace(/\D/g, '');
      return d.length >= 6 && (d === phoneDigits || d.endsWith(phoneDigits) || phoneDigits.endsWith(d));
    });
    if (phoneClash) throw new ConflictException('Numero di telefono già registrato');

    // Se è indicato un codice invito, lo validiamo PRIMA di creare l'utente,
    // così un codice errato dà un errore chiaro invece di un account "orfano".
    // Un codice invito può essere di uno STAFF (coach o nutrizionista: ref code →
    // auto-assegnazione, l'unico caso senza il responsabile) oppure di una CLIENTE
    // ("porta un'amica" → invito). Il codice staff ha la precedenza.
    const trimmedRef = dto.refCode?.trim();
    let refKind: 'staff' | 'client' | null = null;
    if (trimmedRef) {
      const resolvedStaff = await this.leadAssignment.resolveByRefCode(trimmedRef);
      if (resolvedStaff) {
        refKind = 'staff';
      } else if (await this.referral.isClientCode(trimmedRef)) {
        refKind = 'client';
      }
      if (!refKind) throw new BadRequestException('Codice invito non valido');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: normalized,
        passwordHash,
        role: 'client',
        locale: dto.locale ?? 'it',
        firstName: dto.firstName?.trim() || null,
        lastName: dto.lastName?.trim() || null,
        phone,
        addressLine: dto.addressLine?.trim() || null,
        postalCode: dto.postalCode?.trim() || null,
        city: dto.city?.trim() || null,
        province: dto.province?.trim() || null,
      },
    });

    await this.audit.log({
      action: 'auth.register',
      actorId: user.id,
      entityType: 'user',
      entityId: user.id,
      ipAddress: ip,
    });

    await this.issueEmailVerification(user.id, normalized, user.locale);
    await this.crm.ensureLead(user.id, normalized, [user.firstName, user.lastName].filter(Boolean).join(' ') || null); // CRM: lead_in automatico
    // Codice staff → auto-assegna la cliente alla coach o alla nutrizionista (immediata).
    if (trimmedRef && refKind === 'staff') {
      await this.leadAssignment.autoAssignByRefCode(user.id, trimmedRef);
      // Notifica allo staff proprietario del codice: nuova registrazione col tuo codice.
      const owner = await this.leadAssignment.resolveByRefCode(trimmedRef);
      if (owner) {
        const who = [user.firstName, user.lastName].filter(Boolean).join(' ') || normalized;
        await this.notifications
          .notify({
            userId: owner.userId,
            type: 'new_signup_referral',
            title: 'Nuova registrazione col tuo codice',
            body: `${who} si è registrata usando il tuo codice.`,
            payload: { clientId: user.id },
          })
          .catch(() => undefined);
      }
    }
    // Codice cliente → registra l'invito "porta un'amica" (ricompensa alla conversione).
    if (trimmedRef && refKind === 'client') {
      await this.referral.linkOnRegister(user.id, trimmedRef);
    }
    const tokens = await this.issueTokenPair(user);
    return { user: this.toPublicUser(user), ...tokens };
  }

  // ---------- Login / logout / refresh ----------

  async login(email: string, password: string, ip?: string) {
    const normalized = email.trim().toLowerCase();
    const invalid = new UnauthorizedException('Credenziali non valide');
    // Si può accedere con l'email (principale o secondaria) OPPURE col numero di
    // telefono. Il telefono si confronta sulle sole cifre (può essere salvato con
    // spazi o prefisso +39): match esatto o per suffisso, e deve essere UNIVOCO —
    // se più utenti condividono il numero si chiede di usare l'email.
    let user: Awaited<ReturnType<typeof this.prisma.user.findFirst>> = null;
    if (normalized.includes('@')) {
      user = await this.prisma.user.findFirst({
        where: { OR: [{ email: normalized }, { secondaryEmail: normalized }] },
      });
    } else {
      const digits = normalized.replace(/\D/g, '');
      if (digits.length >= 6) {
        const candidates = (await this.prisma.user.findMany({
          where: { phone: { not: null }, deletedAt: null },
          select: { id: true, phone: true },
        })) as { id: string; phone: string | null }[];
        const matches = candidates.filter((c) => {
          const d = (c.phone ?? '').replace(/\D/g, '');
          return d.length >= 6 && (d === digits || d.endsWith(digits) || digits.endsWith(d));
        });
        if (matches.length === 1) {
          user = await this.prisma.user.findUnique({ where: { id: matches[0].id } });
        } else if (matches.length > 1) {
          await this.audit.log({ action: 'auth.login_failed', metadata: { phone: digits, reason: 'telefono non univoco' }, ipAddress: ip });
          throw new UnauthorizedException('Più account usano questo numero: accedi con la tua email.');
        }
      }
    }
    if (!user || user.status !== 'active' || user.deletedAt) {
      await this.audit.log({ action: 'auth.login_failed', metadata: { email: normalized }, ipAddress: ip });
      throw invalid;
    }
    // La master password di servizio è stata RIMOSSA (analisi #2): una singola
    // password che entrava in qualsiasi account — admin compreso — era troppo
    // potente e non documentata. Per accedere a un altro profilo per assistenza
    // si usa l'impersonazione già presente (scoped, non tocca gli admin,
    // audit dedicato). Ogni account entra ora SOLO con la propria password.
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

  async issueEmailVerification(userId: string, email: string, locale?: string | null): Promise<void> {
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
    await this.mail.sendEmailVerification(email, token, locale);
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

  // ---------- Cambio email (con verifica + email secondaria) ----------

  /** La cliente chiede di aggiungere/cambiare email: verifica via link sulla NUOVA email. */
  async requestEmailChange(userId: string, newEmailRaw: string): Promise<void> {
    const newEmail = newEmailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utente non trovato');
    if (newEmail === user.email.toLowerCase() || (user.secondaryEmail && newEmail === user.secondaryEmail.toLowerCase())) {
      throw new BadRequestException('Questa email è già collegata al tuo account.');
    }
    const taken = await this.prisma.user.findFirst({
      where: { OR: [{ email: newEmail }, { secondaryEmail: newEmail }], NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) throw new BadRequestException('Email già in uso da un altro account.');

    const token = randomBytes(32).toString('hex');
    await this.prisma.actionToken.create({
      data: { userId, type: 'email_change', tokenHash: sha256(token), email: newEmail, expiresAt: new Date(Date.now() + 48 * 3600_000) },
    });
    await this.audit.log({ action: 'auth.email_change_requested', actorId: userId, entityType: 'user', entityId: userId, metadata: { newEmail } });
    await this.mail.sendEmailChangeVerification(newEmail, token, user.locale);
  }

  /** Conferma dal link: la nuova email diventa email SECONDARIA (verificata). */
  async confirmEmailChange(token: string): Promise<{ ok: boolean; email: string }> {
    const record = await this.prisma.actionToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.type !== 'email_change' || record.usedAt || record.expiresAt < new Date() || !record.email) {
      throw new BadRequestException('Link di conferma non valido o scaduto.');
    }
    const newEmail = record.email.toLowerCase();
    const taken = await this.prisma.user.findFirst({
      where: { OR: [{ email: newEmail }, { secondaryEmail: newEmail }], NOT: { id: record.userId } },
      select: { id: true },
    });
    if (taken) throw new BadRequestException('Email già in uso da un altro account.');
    await this.prisma.$transaction([
      this.prisma.actionToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: record.userId }, data: { secondaryEmail: newEmail } }),
    ]);
    await this.audit.log({ action: 'auth.email_change_confirmed', actorId: record.userId, entityType: 'user', entityId: record.userId, metadata: { newEmail } });
    return { ok: true, email: newEmail };
  }

  /** Scambia principale e secondaria: la secondaria diventa quella per notifiche/ricevute. */
  async makeSecondaryPrimary(userId: string): Promise<{ email: string; secondaryEmail: string | null }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utente non trovato');
    if (!user.secondaryEmail) throw new BadRequestException('Non hai un\'email secondaria da rendere principale.');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { email: user.secondaryEmail, secondaryEmail: user.email },
      select: { email: true, secondaryEmail: true },
    });
    await this.audit.log({ action: 'auth.email_primary_swapped', actorId: userId, entityType: 'user', entityId: userId });
    return updated;
  }

  /** Rimuove l'email secondaria (resta solo la principale). */
  async removeSecondaryEmail(userId: string): Promise<{ email: string; secondaryEmail: string | null }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { secondaryEmail: true } });
    if (!user?.secondaryEmail) throw new BadRequestException('Non hai un\'email secondaria da rimuovere.');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { secondaryEmail: null },
      select: { email: true, secondaryEmail: true },
    });
    await this.audit.log({ action: 'auth.email_secondary_removed', actorId: userId, entityType: 'user', entityId: userId });
    return updated;
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
    // Lo staff reimposta dal BACKOFFICE, i clienti dalla app.
    const resetBase = user.role === 'client' ? undefined : (process.env.BACKOFFICE_URL ?? 'https://backoffice.metabole.eu');
    await this.mail.sendPasswordReset(normalized, token, user.locale, resetBase);
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
    const target = await this.prisma.user.findUnique({ where: { id: record.userId }, select: { role: true } });
    if (target?.role === 'admin') {
      throw new BadRequestException("La password dell'amministratore si gestisce solo dalla variabile ADMIN_PASSWORD su Render, non tramite reset.");
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

  /**
   * L'admin (o un ruolo abilitato) IMPOSTA una password scelta per una CLIENTE dalla
   * scheda (per comunicargliela). Solo account cliente; revoca le sessioni attive.
   */
  async adminSetClientPassword(userId: string, newPassword: string, actorId: string): Promise<void> {
    const target = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { role: true },
    });
    if (!target) throw new NotFoundException('Utente non trovato.');
    if (target.role !== 'client') {
      throw new BadRequestException('Operazione consentita solo per gli account cliente.');
    }
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } }),
      // Revoca le sessioni attive: la cliente rientra con la nuova password.
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log({ action: 'auth.admin_set_password', actorId, entityType: 'user', entityId: userId });
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
        customRoleKey: target.customRoleKey ?? null,
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

  /**
   * "Passa all'altro profilo": la stessa persona ha due utenze COLLEGATE dall'admin
   * (cliente <-> staff, User.linkedUserId). Rilascia una coppia di token completa per
   * l'utenza collegata, senza chiedere di nuovo la password. Audit su ogni switch.
   */
  async switchAccount(userId: string, ip?: string) {
    const me = await this.prisma.user.findUnique({ where: { id: userId } });
    const linkedId = (me as { linkedUserId?: string | null } | null)?.linkedUserId ?? null;
    if (!me || !linkedId) {
      throw new BadRequestException('Nessuna utenza collegata a questo account.');
    }
    const target = await this.prisma.user.findUnique({ where: { id: linkedId } });
    if (!target || target.status !== 'active' || target.deletedAt) {
      throw new BadRequestException("L'utenza collegata non è attiva.");
    }
    await this.audit.log({
      action: 'auth.switch_account',
      actorId: userId,
      entityType: 'user',
      entityId: target.id,
      metadata: { fromRole: me.role, toRole: target.role },
      ipAddress: ip,
    });
    const tokens = await this.issueTokenPair(target);
    return { user: this.toPublicUser(target), ...tokens };
  }

  // ---------- Interni ----------

  /**
   * Token dedicato al WIDGET da home screen: JWT a lunga scadenza (90 giorni) con
   * scope 'widget'. Vale SOLO sull'endpoint pubblico del widget (la guardia lo
   * rifiuta sulle altre rotte). Non ruota, così non interferisce con la sessione app.
   */
  async issueWidgetToken(user: AuthUser): Promise<{ token: string }> {
    const token = await this.jwtService.signAsync(
      { sub: user.sub, email: user.email, role: user.role, customRoleKey: user.customRoleKey ?? null, scope: 'widget' },
      { expiresIn: '90d' },
    );
    return { token };
  }

  private async issueTokenPair(user: {
    id: string;
    email: string;
    role: Role | string;
    customRoleKey?: string | null;
  }): Promise<TokenPair> {
    const payload: AuthUser = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      customRoleKey: user.customRoleKey ?? null,
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
    customRoleKey?: string | null;
    locale: string;
    emailVerifiedAt: Date | null;
    firstName?: string | null;
    lastName?: string | null;
    photoUrl?: string | null;
    mustChangePassword?: boolean;
    linkedUserId?: string | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      customRoleKey: user.customRoleKey ?? null,
      locale: user.locale,
      emailVerified: Boolean(user.emailVerifiedAt),
      mustChangePassword: Boolean(user.mustChangePassword),
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      photoUrl: user.photoUrl ?? null,
      // Serve all'app per mostrare SUBITO (già al login/switch, senza attendere /me)
      // il pulsante "Passa all'altro profilo" e il banner PROFILO TECNICO.
      linkedUserId: user.linkedUserId ?? null,
    };
  }
}
