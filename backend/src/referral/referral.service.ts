import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';

// Alfabeto senza caratteri ambigui (come i ref code staff). Lunghezza 8 →
// DISTINTA dai ref code coach (6 caratteri): così i due spazi non collidono mai
// e in registrazione il codice coach ha comunque la precedenza.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 8;

/**
 * Invito "porta un'amica" (Fase 8). Ogni cliente ha un `referralCode`; un'altra
 * cliente può indicarlo in registrazione. Alla PRIMA attivazione dell'abbonamento
 * dell'invitata scatta la ricompensa per chi ha invitato (estensione abbonamento).
 * FK-less: referrer/referred sono userId (stringhe).
 */
@Injectable()
export class ReferralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigParamsService,
    private readonly audit: AuditService,
  ) {}

  private randomCode(): string {
    let s = '';
    for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    return s;
  }

  /** Restituisce (creandolo se serve) il codice referral della cliente. */
  async ensureCode(clientId: string): Promise<string> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { referralCode: true },
    });
    if (profile?.referralCode) return profile.referralCode;

    let code = this.randomCode();
    for (let i = 0; i < 8; i++) {
      const exists = await this.prisma.clientProfile.findUnique({
        where: { referralCode: code },
        select: { userId: true },
      });
      if (!exists) break;
      code = this.randomCode();
    }
    // upsert: se il profilo non esiste ancora (invito prima dell'onboarding) lo crea
    // minimale; l'onboarding poi lo completa senza toccare il codice.
    await this.prisma.clientProfile.upsert({
      where: { userId: clientId },
      create: { userId: clientId, referralCode: code },
      update: { referralCode: code },
    });
    return code;
  }

  /** Codice referral → userId della cliente referrer, o null se non è un codice cliente. */
  async isClientCode(code: string): Promise<string | null> {
    const c = (code ?? '').trim().toUpperCase();
    if (!c) return null;
    const profile = await this.prisma.clientProfile.findUnique({
      where: { referralCode: c },
      select: { userId: true },
    });
    return profile?.userId ?? null;
  }

  /**
   * In registrazione: se il codice è di una cliente, registra l'invito.
   * Idempotente (una invitata = un solo invito), non si auto-invita, non lancia mai.
   */
  async linkOnRegister(referredClientId: string, code: string): Promise<boolean> {
    const referrerClientId = await this.isClientCode(code);
    if (!referrerClientId || referrerClientId === referredClientId) return false;
    const existing = await this.prisma.referral.findUnique({
      where: { referredClientId },
      select: { id: true },
    });
    if (existing) return false;
    const normalized = code.trim().toUpperCase();
    await this.prisma.referral.create({
      data: { referrerClientId, referredClientId, code: normalized },
    });
    await this.audit.log({
      action: 'referral.link',
      entityType: 'user',
      entityId: referredClientId,
      metadata: { referrerClientId, code: normalized },
    });
    return true;
  }

  /** Riepilogo per l'app cliente: codice + inviti + conversioni + ricompensa. */
  async myReferral(clientId: string): Promise<{
    code: string;
    invited: number;
    converted: number;
    rewarded: number;
    rewardDays: number;
  }> {
    const code = await this.ensureCode(clientId);
    const referrals = (await this.prisma.referral.findMany({
      where: { referrerClientId: clientId },
      select: { convertedAt: true, rewardedAt: true },
    })) as { convertedAt: Date | null; rewardedAt: Date | null }[];
    const rewardDays = await this.config.getNumber('referral_reward_days', 30);
    return {
      code,
      invited: referrals.length,
      converted: referrals.filter((r) => r.convertedAt).length,
      rewarded: referrals.filter((r) => r.rewardedAt).length,
      rewardDays,
    };
  }

  /**
   * Alla PRIMA attivazione dell'abbonamento dell'invitata: marca l'invito come
   * convertito e premia la referrer estendendo la scadenza del suo abbonamento
   * attivo di `referral_reward_days` (default 30). Idempotente sull'invito; se la
   * referrer non ha un abbonamento attivo la ricompensa resta in sospeso
   * (convertedAt impostato, rewardedAt no). Non blocca mai il flusso pagamenti.
   */
  async onConvert(referredClientId: string): Promise<void> {
    const ref = (await this.prisma.referral.findUnique({
      where: { referredClientId },
    })) as { id: string; referrerClientId: string; convertedAt: Date | null } | null;
    if (!ref || ref.convertedAt) return;
    await this.prisma.referral.update({ where: { id: ref.id }, data: { convertedAt: new Date() } });

    const days = await this.config.getNumber('referral_reward_days', 30);
    if (days <= 0) return;

    const sub = (await this.prisma.subscription.findFirst({
      where: { clientId: ref.referrerClientId, status: 'active' },
      orderBy: { endDate: 'desc' },
      select: { id: true, endDate: true },
    })) as { id: string; endDate: Date | null } | null;
    if (!sub) return; // nessun abbonamento attivo: ricompensa non applicabile ora

    const now = new Date();
    const base = sub.endDate && sub.endDate > now ? sub.endDate : now;
    const newEnd = new Date(base);
    newEnd.setDate(newEnd.getDate() + days);
    await this.prisma.subscription.update({ where: { id: sub.id }, data: { endDate: newEnd } });
    await this.prisma.referral.update({ where: { id: ref.id }, data: { rewardedAt: new Date() } });
    await this.audit.log({
      action: 'referral.reward',
      entityType: 'user',
      entityId: ref.referrerClientId,
      metadata: { referredClientId, days, subscriptionId: sub.id },
    });
  }
}
