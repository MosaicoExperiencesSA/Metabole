import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { FinanceService } from '../commerce/finance.service';
import { CrmService } from '../commerce/crm.service';
import { Role } from '../common/roles';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { parseCodiceFiscale } from '../common/codice-fiscale.util';
import { randomBytes } from 'crypto';

/** Password provvisoria leggibile: niente caratteri ambigui (0/O/1/l/I), con cifre. */
function genTempPassword(): string {
  const alpha = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const b = randomBytes(12);
  let s = '';
  for (let i = 0; i < 8; i++) s += alpha[b[i] % alpha.length];
  s += digits[b[8] % digits.length];
  s += digits[b[9] % digits.length];
  return `Mb${s}`; // prefisso per soddisfare requisiti di complessità comuni
}

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  customRoleKey: true,
  customRole: { select: { key: true, label: true, color: true, baseRole: true } },
  locale: true,
  status: true,
  mustChangePassword: true,
  emailVerifiedAt: true,
  firstName: true,
  lastName: true,
  phone: true,
  title: true,
  addressLine: true,
  country: true,
  theme: true,
  photoUrl: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  staff: { select: { id: true, displayName: true, managerId: true, refCode: true } },
} as const;

const ACCOUNT_THEMES = ['light', 'dark', 'taupe', 'white'];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly finance: FinanceService,
    private readonly mail: MailService,
    private readonly crm: CrmService,
  ) {}

  async list(params: { role?: Role; staffOnly?: boolean; includeArchived?: boolean; page?: number; limit?: number }) {
    const take = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const skip = (Math.max(params.page ?? 1, 1) - 1) * take;
    const where = {
      ...(params.includeArchived ? {} : { deletedAt: null }),
      ...(params.role
        ? { role: params.role }
        : params.staffOnly
          ? { role: { not: 'client' as Role } } // solo staff/tecnici; i clienti hanno la loro sezione
          : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: PUBLIC_USER_SELECT,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: params.page ?? 1, limit: take };
  }

  async getById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) throw new NotFoundException('Utente non trovato');
    return user;
  }

  /** Dati anagrafici modificabili dalla cliente nel proprio Profilo (app). */
  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        email: true, secondaryEmail: true, firstName: true, lastName: true,
        addressLine: true, postalCode: true, city: true, province: true, country: true, phone: true,
        birthDate: true, codiceFiscale: true,
        clientProfile: { select: { name: true } },
      },
    });
    if (!user) throw new NotFoundException('Utente non trovato');
    const { clientProfile, birthDate, ...rest } = user;
    return {
      ...rest,
      birthDate: birthDate ? birthDate.toISOString().slice(0, 10) : null,
      nickname: clientProfile?.name ?? null,
    };
  }

  /** La cliente aggiorna i propri dati (mai l'email: quella ha un flusso a parte con verifica). */
  async updateMyProfile(
    userId: string,
    dto: { firstName?: string; lastName?: string; nickname?: string; addressLine?: string; postalCode?: string; city?: string; province?: string; country?: string; phone?: string; birthDate?: string | null; codiceFiscale?: string | null },
  ) {
    const userData: Record<string, string | Date | null> = {};
    for (const k of ['firstName', 'lastName', 'addressLine', 'postalCode', 'city', 'province', 'country', 'phone'] as const) {
      if (dto[k] !== undefined) userData[k] = dto[k]!.trim() || null;
    }
    // Codice fiscale: normalizzato in maiuscolo; se presente e la data di nascita
    // non è stata fornita a mano, la ricaviamo automaticamente dal CF.
    let cfDerivedBirth: Date | null = null;
    if (dto.codiceFiscale !== undefined) {
      const cf = (dto.codiceFiscale || '').trim().toUpperCase() || null;
      userData.codiceFiscale = cf;
      if (cf) cfDerivedBirth = parseCodiceFiscale(cf).birthDate;
    }
    if (dto.birthDate !== undefined) {
      const raw = (dto.birthDate || '').trim();
      if (!raw) {
        userData.birthDate = null;
      } else {
        const d = new Date(`${raw}T00:00:00.000Z`);
        if (!Number.isNaN(d.getTime())) userData.birthDate = d;
        else if (cfDerivedBirth) userData.birthDate = cfDerivedBirth;
      }
    } else if (cfDerivedBirth) {
      userData.birthDate = cfDerivedBirth;
    }
    if (Object.keys(userData).length) {
      await this.prisma.user.update({ where: { id: userId }, data: userData });
    }
    if (dto.nickname !== undefined) {
      // Il nickname vive sul profilo cliente (updateMany: sicuro se il profilo non esiste ancora).
      await this.prisma.clientProfile.updateMany({ where: { userId }, data: { name: dto.nickname.trim() || null } });
    }
    await this.audit.log({ action: 'me.profile.update', actorId: userId, entityType: 'user', entityId: userId });
    return this.getMyProfile(userId);
  }

  /** Impostazioni account (backoffice): l'utente aggiorna i propri dati e il tema. */
  async updateAccount(
    userId: string,
    dto: { firstName?: string; lastName?: string; phone?: string; title?: string; theme?: string; email?: string; photoUrl?: string | null },
  ) {
    const data: Record<string, string | null> = {};
    for (const k of ['firstName', 'lastName', 'phone', 'title'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k]!.trim() || null;
    }
    if (dto.photoUrl !== undefined) {
      // Accetta solo un'immagine come data URL (o null per rimuoverla).
      if (dto.photoUrl !== null && !/^data:image\/(png|jpeg|jpg|webp);base64,/.test(dto.photoUrl)) {
        throw new BadRequestException('Immagine non valida.');
      }
      data.photoUrl = dto.photoUrl;
    }
    if (dto.theme !== undefined) {
      if (!ACCOUNT_THEMES.includes(dto.theme)) throw new BadRequestException('Tema non valido.');
      data.theme = dto.theme;
    }
    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (!email) throw new BadRequestException('Email non valida.');
      const taken = await this.prisma.user.findFirst({
        where: { OR: [{ email }, { secondaryEmail: email }], NOT: { id: userId } },
        select: { id: true },
      });
      if (taken) throw new ConflictException('Email già in uso da un altro account.');
      data.email = email;
    }
    if (Object.keys(data).length === 0) return this.getById(userId);
    await this.prisma.user.update({ where: { id: userId }, data });
    await this.audit.log({ action: 'me.account.update', actorId: userId, entityType: 'user', entityId: userId, metadata: { fields: Object.keys(data) } });
    return this.getById(userId);
  }

  /** Cambio password con verifica di quella attuale. */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) throw new BadRequestException('La nuova password deve avere almeno 8 caratteri.');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, role: true } });
    if (!user) throw new NotFoundException('Utente non trovato');
    if (user.role === 'admin') throw new BadRequestException("La password dell'amministratore si gestisce solo dalla variabile ADMIN_PASSWORD su Render, non dall'app.");
    const ok = await argon2.verify(user.passwordHash, currentPassword).catch(() => false);
    if (!ok) throw new BadRequestException('La password attuale non è corretta.');
    const passwordHash = await argon2.hash(newPassword);
    // Cambio riuscito → l'eventuale obbligo di cambio al primo accesso è assolto.
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } });
    await this.audit.log({ action: 'me.password.change', actorId: userId, entityType: 'user', entityId: userId });
    return { changed: true };
  }

  /**
   * Imposta la password al PRIMO accesso per un account provvisorio
   * (mustChangePassword=true, es. lead creato da backoffice con password di default).
   * A differenza di changePassword NON richiede la password attuale: l'utente è già
   * autenticato e il flag prova che è un primo cambio forzato. Azzera il flag.
   * Se il flag non è attivo, si deve usare il cambio password normale.
   */
  async setInitialPassword(userId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) throw new BadRequestException('La nuova password deve avere almeno 8 caratteri.');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { mustChangePassword: true, role: true } });
    if (!user) throw new NotFoundException('Utente non trovato');
    if (user.role === 'admin') throw new BadRequestException("La password dell'amministratore si gestisce solo dalla variabile ADMIN_PASSWORD su Render, non dall'app.");
    if (!user.mustChangePassword) throw new BadRequestException('La password è già stata impostata: usa il cambio password normale.');
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } });
    await this.audit.log({ action: 'me.password.initial', actorId: userId, entityType: 'user', entityId: userId });
    return { changed: true };
  }

  /** Preferenze UI dell'utente (es. scorciatoie dashboard scelte). */
  async getPreferences(userId: string) {
    const u = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { prefs: true } });
    if (!u) throw new NotFoundException('Utente non trovato');
    const prefs = (u.prefs as Record<string, unknown> | null) ?? {};
    const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null);
    // null = mai personalizzate (il frontend usa i predefiniti)
    return {
      dashboardShortcuts: arr(prefs.dashboardShortcuts),
      dashboardModules: arr(prefs.dashboardModules),
      dashboardCharts: arr(prefs.dashboardCharts),
      menuOrder: arr(prefs.menuOrder),
      showEarnings: typeof prefs.showEarnings === 'boolean' ? prefs.showEarnings : false,
      waterUnit: ['glass', 'bottle05', 'bottle1', 'bottle15'].includes(prefs.waterUnit as string) ? (prefs.waterUnit as string) : 'glass',
    };
  }

  /** Aggiorna scorciatoie / moduli / grafici della dashboard (solo i campi forniti). */
  async updatePreferences(userId: string, input: { dashboardShortcuts?: string[]; dashboardModules?: string[]; dashboardCharts?: string[]; menuOrder?: string[]; showEarnings?: boolean; waterUnit?: string }) {
    const u = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { prefs: true } });
    if (!u) throw new NotFoundException('Utente non trovato');
    const clean = (keys: string[], max = 40) => Array.from(new Set(keys.filter((k) => typeof k === 'string'))).slice(0, max);
    const prefs = { ...((u.prefs as Record<string, unknown> | null) ?? {}) };
    if (input.dashboardShortcuts !== undefined) prefs.dashboardShortcuts = clean(input.dashboardShortcuts);
    if (input.dashboardModules !== undefined) prefs.dashboardModules = clean(input.dashboardModules);
    if (input.dashboardCharts !== undefined) prefs.dashboardCharts = clean(input.dashboardCharts, 3); // max 3 grafici
    if (input.menuOrder !== undefined) prefs.menuOrder = clean(input.menuOrder, 80);
    if (input.showEarnings !== undefined) prefs.showEarnings = !!input.showEarnings;
    if (input.waterUnit !== undefined && ['glass', 'bottle05', 'bottle1', 'bottle15'].includes(input.waterUnit)) prefs.waterUnit = input.waterUnit;
    await this.prisma.user.update({ where: { id: userId }, data: { prefs: prefs as never } });
    return {
      dashboardShortcuts: (prefs.dashboardShortcuts as string[]) ?? null,
      dashboardModules: (prefs.dashboardModules as string[]) ?? null,
      dashboardCharts: (prefs.dashboardCharts as string[]) ?? null,
      menuOrder: (prefs.menuOrder as string[]) ?? null,
      showEarnings: typeof prefs.showEarnings === 'boolean' ? prefs.showEarnings : false,
      waterUnit: ['glass', 'bottle05', 'bottle1', 'bottle15'].includes(prefs.waterUnit as string) ? (prefs.waterUnit as string) : 'glass',
    };
  }

  /** Imposta (o rimuove) il responsabile diretto di un membro dello staff. */
  async setManager(userId: string, managerStaffId: string | null, actorId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { userId }, select: { id: true } });
    if (!staff) throw new BadRequestException('Questo utente non è un membro dello staff.');
    if (managerStaffId) {
      if (managerStaffId === staff.id) {
        throw new BadRequestException('Una persona non può essere responsabile di sé stessa.');
      }
      const manager = await this.prisma.staff.findUnique({ where: { id: managerStaffId }, select: { id: true } });
      if (!manager) throw new NotFoundException('Responsabile non trovato.');
    }
    await this.prisma.staff.update({ where: { id: staff.id }, data: { managerId: managerStaffId } });
    await this.audit.log({
      action: 'admin.staff.manager',
      actorId,
      entityType: 'staff',
      entityId: staff.id,
      metadata: { managerId: managerStaffId },
    });
    return this.getById(userId);
  }

  private static readonly STAFF_ROLES: Role[] = [
    'coach',
    'nutritionist',
    'head_nutritionist',
    'sales',
    'marketing',
    'head_marketing',
  ];

  async create(
    data: {
      email: string;
      password: string;
      role: Role;
      customRoleKey?: string | null;
      locale?: string;
      displayName?: string;
      mustChangePassword?: boolean;
    },
    actorId: string,
  ) {
    const email = data.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email già registrata');

    // Ruolo personalizzato: l'utente prende il ruolo di SISTEMA di base (per i
    // permessi reali) e in più la chiave del ruolo custom (etichetta + menu).
    const { systemRole, customRoleKey } = await this.resolveRole(data.role, data.customRoleKey);

    const passwordHash = await argon2.hash(data.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: systemRole,
        customRoleKey,
        locale: data.locale ?? 'it',
        mustChangePassword: data.mustChangePassword ?? false,
      },
      select: PUBLIC_USER_SELECT,
    });

    // Per i ruoli di staff crea anche la scheda Staff (assegnazioni, agenda, team).
    if (UsersService.STAFF_ROLES.includes(systemRole)) {
      await this.prisma.staff.create({
        data: {
          userId: user.id,
          displayName: data.displayName ?? email.split('@')[0],
        },
      });
    }

    await this.audit.log({
      action: 'admin.user.create',
      actorId,
      entityType: 'user',
      entityId: user.id,
      metadata: { role: systemRole, customRoleKey },
    });
    // Anche i clienti creati da backoffice compaiono in Gestione lead (tutti sono lead).
    if (systemRole === 'client') {
      await this.crm.ensureLead(user.id, email, (data as { displayName?: string }).displayName ?? null);
    }
    return user;
  }

  /**
   * Reset password da parte dell'admin. Imposta una password provvisoria (fornita
   * dall'admin oppure generata), obbliga il cambio al primo accesso e revoca le sessioni
   * attive. Ritorna la password in chiaro UNA VOLTA, così l'admin la comunica all'utente.
   */
  async resetPassword(
    userId: string,
    actorId: string,
    newPassword?: string,
  ): Promise<{ password: string; generated: boolean; email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) throw new NotFoundException('Utente non trovato');

    let password = (newPassword ?? '').trim();
    const generated = password.length === 0;
    if (generated) password = genTempPassword();
    if (password.length < 8) throw new BadRequestException('La password deve avere almeno 8 caratteri.');

    const passwordHash = await argon2.hash(password);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true },
    });
    // Revoca le sessioni attive: l'utente rientra con la nuova password.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      action: 'admin.user.reset_password',
      actorId,
      entityType: 'user',
      entityId: userId,
      metadata: { email: user.email, generated }, // MAI la password nei log
    });
    return { password, generated, email: user.email };
  }

  /** Traduce (ruolo di sistema | ruolo personalizzato) in { systemRole, customRoleKey }. */
  private async resolveRole(
    role: Role,
    customRoleKey?: string | null,
  ): Promise<{ systemRole: Role; customRoleKey: string | null }> {
    if (customRoleKey) {
      const cr = await this.prisma.customRole.findUnique({ where: { key: customRoleKey } });
      if (!cr) throw new NotFoundException('Ruolo personalizzato non trovato');
      return { systemRole: cr.baseRole as Role, customRoleKey: cr.key };
    }
    return { systemRole: role, customRoleKey: null };
  }

  /**
   * Assegna, riassegna o RIMUOVE coach e/o nutrizionista di una cliente.
   * Per ciascun campo: una stringa assegna quello staff, null/"" lo rimuove,
   * assente lo lascia invariato.
   */
  async assign(
    data: { clientId: string; coachId?: string | null; nutritionistId?: string | null },
    actorId: string,
  ) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: data.clientId },
    });
    if (!profile) {
      throw new NotFoundException(
        'Profilo cliente non trovato: la cliente deve completare il questionario.',
      );
    }

    const patch: { assignedCoachId?: string | null; assignedNutritionistId?: string | null } = {};
    if (data.coachId !== undefined) {
      if (data.coachId) {
        await this.assertStaffRole(data.coachId, 'coach');
        patch.assignedCoachId = data.coachId;
      } else {
        patch.assignedCoachId = null;
      }
    }
    if (data.nutritionistId !== undefined) {
      if (data.nutritionistId) {
        await this.assertStaffRole(data.nutritionistId, 'nutritionist');
        patch.assignedNutritionistId = data.nutritionistId;
      } else {
        patch.assignedNutritionistId = null;
      }
    }

    const updated = await this.prisma.clientProfile.update({
      where: { userId: data.clientId },
      data: patch,
      include: {
        assignedCoach: { select: { id: true, displayName: true } },
        assignedNutritionist: { select: { id: true, displayName: true } },
      },
    });
    await this.audit.log({
      action: 'admin.assignment.update',
      actorId,
      entityType: 'client_profile',
      entityId: profile.id,
      metadata: { coachId: data.coachId, nutritionistId: data.nutritionistId },
    });

    // Paga eventuali provvigioni accantonate su questa cliente per il ruolo assegnato.
    if (data.coachId) await this.finance.resolvePendingForAssignment(data.clientId, 'coach', data.coachId);
    if (data.nutritionistId) {
      await this.finance.resolvePendingForAssignment(data.clientId, 'nutritionist', data.nutritionistId);
      // Avvisa il nutrizionista della nuova cliente assegnata.
      try {
        const nutri = await this.prisma.staff.findUnique({
          where: { id: data.nutritionistId },
          select: { user: { select: { email: true, locale: true } } },
        });
        if (nutri?.user?.email) {
          const clientName = profile.name ?? 'una nuova cliente';
          await this.mail.sendClientAssignedToNutritionist(nutri.user.email, clientName, nutri.user.locale);
        }
      } catch {
        /* l'email non deve bloccare l'assegnazione */
      }
    }

    return updated;
  }

  private async assertStaffRole(staffId: string, role: Role): Promise<void> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: { user: { select: { role: true, status: true } } },
    });
    if (!staff || !staff.active || staff.user.status !== 'active' || staff.user.role !== role) {
      throw new NotFoundException(`Staff ${role} non valido o non attivo: ${staffId}`);
    }
  }

  async update(
    id: string,
    data: {
      role?: Role; customRoleKey?: string | null; status?: 'active' | 'suspended'; locale?: string;
      email?: string;
      firstName?: string | null; lastName?: string | null; displayName?: string;
      phone?: string | null; title?: string | null; addressLine?: string | null; country?: string | null;
    },
    actorId: string,
  ) {
    const current = await this.getById(id); // 404 se non esiste

    // Se cambia il ruolo (di sistema o personalizzato) ricalcolo i due campi.
    const roleChange =
      data.role !== undefined || data.customRoleKey !== undefined
        ? await this.resolveRole((data.role ?? current.role) as Role, data.customRoleKey)
        : null;

    // Correzione email di login (solo admin, endpoint già ristretto). Normalizzo,
    // valido il formato e rifiuto se già in uso da un altro utente (come principale
    // o secondaria). Non tocca la protezione dell'admin di sistema.
    let emailChange: string | undefined;
    if (data.email !== undefined) {
      const email = data.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Email non valida.');
      if (email !== current.email.toLowerCase()) {
        if (current.email.toLowerCase() === this.protectedAdminEmail()) {
          throw new BadRequestException('Non si può cambiare l\'email dell\'admin di sistema da qui.');
        }
        const clash = (await this.prisma.user.findFirst({
          where: { OR: [{ email }, { secondaryEmail: email }], NOT: { id } },
          select: { id: true, deletedAt: true },
        })) as { id: string; deletedAt: Date | null } | null;
        if (clash) {
          // Anche gli account ARCHIVIATI bloccano (l'email a DB è unica): senza questo
          // avviso l'admin vede solo "già in uso" e non capisce da dove arrivi.
          throw new BadRequestException(
            clash.deletedAt
              ? 'Questa email appartiene a un account ARCHIVIATO: da Utenti → "Archiviati" ripristinalo e cambiagli email (o eliminalo definitivamente), poi riprova.'
              : 'Esiste già un utente con questa email.',
          );
        }
        emailChange = email;
      }
    }

    const norm = (v?: string | null) => (v === undefined ? undefined : (v?.trim() || null));
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.locale !== undefined ? { locale: data.locale } : {}),
        ...(emailChange !== undefined ? { email: emailChange } : {}),
        ...(roleChange ? { role: roleChange.systemRole, customRoleKey: roleChange.customRoleKey } : {}),
        ...(data.firstName !== undefined ? { firstName: norm(data.firstName) } : {}),
        ...(data.lastName !== undefined ? { lastName: norm(data.lastName) } : {}),
        ...(data.phone !== undefined ? { phone: norm(data.phone) } : {}),
        ...(data.title !== undefined ? { title: norm(data.title) } : {}),
        ...(data.addressLine !== undefined ? { addressLine: norm(data.addressLine) } : {}),
        ...(data.country !== undefined ? { country: norm(data.country) } : {}),
      },
      select: PUBLIC_USER_SELECT,
    });
    // Se l'utente ha la casella di posta collegata (staff), allineo l'indirizzo alla nuova
    // email di login solo se la casella usava ancora quella vecchia (non tocco chi l'ha personalizzata).
    if (emailChange) {
      await this.prisma.mailAccount.updateMany({
        where: { userId: id, email: current.email },
        data: { email: emailChange },
      });
      // Scheda CRM del cliente: allinea l'email (segmenti e campagne usano quella).
      await this.prisma.crmRecord
        .updateMany({ where: { clientId: id }, data: { email: emailChange } })
        .catch(() => undefined);
    }
    // Nome mostrato (scheda Staff), se l'utente ha una scheda staff.
    if (data.displayName !== undefined && user.staff) {
      await this.prisma.staff.update({ where: { id: user.staff.id }, data: { displayName: data.displayName.trim() || user.email.split('@')[0] } });
    }
    if (data.status === 'suspended' || roleChange || emailChange) {
      // Cambi di ruolo, sospensione o email di login: revoca le sessioni attive.
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.log({
      action: 'admin.user.update',
      actorId,
      entityType: 'user',
      entityId: id,
      metadata: data as Record<string, unknown>,
    });
    return user;
  }

  /** Email dell'admin protetto (variabile Render): non archiviabile, per non perdere l'accesso. */
  private protectedAdminEmail(): string {
    return (process.env.ADMIN_EMAIL ?? 'simone.salogni@gmail.com').trim().toLowerCase();
  }

  /**
   * Archivia (soft-delete) un utente: `deletedAt` valorizzato + stato sospeso + sessioni
   * revocate. Reversibile con `restore`. Protezioni: non ci si può archiviare da soli e
   * non si può archiviare l'admin legato alla variabile d'ambiente Render (anti-lockout).
   */
  async archive(id: string, actorId: string) {
    if (id === actorId) throw new BadRequestException('Non puoi archiviare il tuo stesso account.');
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, email: true, deletedAt: true } });
    if (!target) throw new NotFoundException('Utente non trovato');
    if (target.deletedAt) throw new BadRequestException('Utente già archiviato');
    if (target.email.trim().toLowerCase() === this.protectedAdminEmail()) {
      throw new BadRequestException('Questo è l\'admin principale (variabile Render): non è archiviabile.');
    }
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'suspended' },
    });
    await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ action: 'admin.user.archive', actorId, entityType: 'user', entityId: id, metadata: { email: target.email } });
    return { archived: true };
  }

  /** Ripristina un utente archiviato (torna attivo). */
  async restore(id: string, actorId: string) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
    if (!target) throw new NotFoundException('Utente non trovato');
    if (!target.deletedAt) throw new BadRequestException('Utente non archiviato');
    await this.prisma.user.update({ where: { id }, data: { deletedAt: null, status: 'active' } });
    await this.audit.log({ action: 'admin.user.restore', actorId, entityType: 'user', entityId: id });
    return { restored: true };
  }
}
