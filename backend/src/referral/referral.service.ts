import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { agganciaAssegnazioneAlProfilo } from '../common/assegnazione-profilo';
import { nextRuleCode, refCodeBase } from '../common/ref-code';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { istantePiuGiorni } from '../common/date-only';
import { PrismaService } from '../prisma/prisma.service';
import { STATI_CON_UN_PIANO } from '../commerce/stati-abbonamento';

// Metodo aziendale (14/7): anche i codici cliente seguono cognome+iniziale+01.
// Stessa forma dei ref code coach → l'unicità si controlla su ENTRAMBI gli
// spazi (staff.refCode e clientProfile.referralCode); in registrazione il
// codice coach ha comunque la precedenza. Alfabeto casuale solo come ripiego.
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
    private readonly notifications: NotificationsService,
  ) {}

  private randomCode(): string {
    let s = '';
    for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    return s;
  }

  /** true se il codice è già usato da un invito cliente O da una coach. */
  private async codeTaken(code: string): Promise<boolean> {
    const [c, s] = await Promise.all([
      this.prisma.clientProfile.findUnique({ where: { referralCode: code }, select: { userId: true } }),
      this.prisma.staff.findUnique({ where: { refCode: code }, select: { id: true } }),
    ]);
    return Boolean(c || s);
  }

  /** Restituisce (creandolo se serve) il codice referral della cliente. */
  async ensureCode(clientId: string): Promise<string> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { referralCode: true },
    });
    if (profile?.referralCode) return profile.referralCode;

    // Metodo aziendale: 5 lettere cognome + iniziale nome + progressivo da 01.
    const user = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: { firstName: true, lastName: true },
    });
    const base = refCodeBase(user?.firstName, user?.lastName);
    let code = base ? await nextRuleCode(base, (c) => this.codeTaken(c)) : null;

    // Ripiego casuale se il nome manca o i progressivi sono esauriti.
    if (!code) {
      code = this.randomCode();
      for (let i = 0; i < 8; i++) {
        if (!(await this.codeTaken(code))) break;
        code = this.randomCode();
      }
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
    await this.ereditaCoach(referrerClientId, referredClientId);
    return true;
  }

  /**
   * L'AMICA VA ALLA STESSA COACH (regola di Simone, 6/8).
   *
   * Chi arriva da "porta un'amica" non è un lead qualunque: arriva perché una cliente di
   * quella coach si è trovata bene. Farla passare dal pool dei non assegnati significava due
   * cose sbagliate insieme — l'amica finiva da una sconosciuta, e la coach che aveva
   * effettivamente generato quell'iscrizione non incassava niente. Ora eredita la coach della
   * referrer, subito e senza ciclo di accettazione: come per il ref code di una coach, qui la
   * scelta è già stata fatta da qualcuno.
   *
   * Le provvigioni seguono da sole: `finance.generateCommissions` legge
   * `ClientProfile.assignedCoachId`, che è esattamente quello che scriviamo qui.
   *
   * Solo la COACH: la nutrizionista resta assegnata dal capo nutrizionista, perché lì il criterio
   * è clinico e non commerciale.
   * Non lancia mai: un invito non deve poter far fallire una registrazione.
   */
  private async ereditaCoach(referrerClientId: string, referredClientId: string): Promise<void> {
    try {
      const prof = (await this.prisma.clientProfile.findUnique({
        where: { userId: referrerClientId },
        select: { assignedCoachId: true },
      })) as { assignedCoachId: string | null } | null;
      const coachId = prof?.assignedCoachId ?? null;
      if (!coachId) return; // la referrer non ha una coach: l'amica resta nel pool, come prima

      const rec = (await this.prisma.crmRecord.findUnique({
        where: { clientId: referredClientId },
        select: { id: true, name: true, assignedCoachId: true },
      })) as { id: string; name: string | null; assignedCoachId: string | null } | null;
      if (!rec || rec.assignedCoachId) return; // già assegnata da qualcun altro: non si scavalca

      await this.prisma.crmRecord.update({
        where: { id: rec.id },
        data: { assignedCoachId: coachId, assignmentStatus: 'accepted', assignedAt: new Date(), assignedById: null },
      });
      await agganciaAssegnazioneAlProfilo(this.prisma, referredClientId, {
        name: rec.name,
        assignedCoachId: coachId,
      });
      await this.audit.log({
        action: 'referral.assign.coach',
        entityType: 'user',
        entityId: referredClientId,
        metadata: { referrerClientId, coachStaffId: coachId },
      });

      // La coach deve saperlo: le è arrivata una cliente, e non da un'assegnazione.
      const coach = (await this.prisma.staff.findUnique({
        where: { id: coachId },
        select: { user: { select: { id: true } } },
      })) as { user: { id: string } | null } | null;
      if (coach?.user?.id) {
        await this.notifications
          .notify({
            userId: coach.user.id,
            type: 'referral_new_client',
            title: 'Nuova cliente da "porta un\'amica"',
            body: `${rec.name ?? 'Una nuova cliente'} si è iscritta su invito di una tua cliente: è già assegnata a te.`,
            payload: { clientId: referredClientId, referrerClientId },
          })
          .catch(() => undefined);
      }
    } catch {
      /* mai bloccante: la registrazione viene prima */
    }
  }

  /** Riepilogo per l'app cliente: codice + inviti + conversioni + ricompensa. */
  async myReferral(clientId: string): Promise<{
    code: string;
    invited: number;
    converted: number;
    rewarded: number;
    rewardDays: number;
    visible: boolean;
    afterDays: number;
  }> {
    const code = await this.ensureCode(clientId);
    const referrals = (await this.prisma.referral.findMany({
      where: { referrerClientId: clientId },
      select: { convertedAt: true, rewardedAt: true },
    })) as { convertedAt: Date | null; rewardedAt: Date | null }[];
    const rewardDays = await this.config.getNumber('referral_reward_days', 30);

    // La card "Porta un'amica" non si mostra dal primo giorno (decisione Simone 6/8): chiedere
    // di consigliare Metabole a chi l'ha appena aperta è chiedere di garantire per una cosa che
    // non ha ancora provato — e l'invito vale quanto vale chi lo manda. Dopo `referral_card_after_days`
    // giorni di percorso la cliente sa di cosa parla. Il gate è sul SERVER perché è una regola di
    // prodotto, non una scelta grafica: così si cambia da Parametri senza pubblicare l'app.
    const afterDays = await this.config.getNumber('referral_card_after_days', 15);
    const profile = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { planStartDate: true },
    })) as { planStartDate: Date | null } | null;
    const giorniDiPercorso = profile?.planStartDate
      ? Math.floor((Date.now() - profile.planStartDate.getTime()) / 86_400_000)
      : -1; // percorso non ancora partito
    // Chi ha già invitato qualcuno continua a vedere la card anche se il gate cambia: toglierle
    // di mano lo strumento a metà sarebbe peggio che non averglielo mai dato.
    const visible = giorniDiPercorso >= afterDays || referrals.length > 0;

    return {
      code,
      invited: referrals.length,
      converted: referrals.filter((r) => r.convertedAt).length,
      rewarded: referrals.filter((r) => r.rewardedAt).length,
      rewardDays,
      visible,
      afterDays,
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

    // Se la referrer non ha un abbonamento attivo la ricompensa NON si perde: resta in sospeso
    // (`convertedAt` sì, `rewardedAt` no) e viene riscossa alla prima attivazione utile —
    // vedi `riscuotiSospese`, chiamata dalla catena di approvazione dei pagamenti.
    // Prima il `return` a questo punto la faceva sparire per sempre, in silenzio: `convertedAt`
    // era già scritto, quindi ogni chiamata successiva usciva subito. E colpiva proprio le
    // persone sbagliate — chi ha il piano scaduto è la più motivata a portare un'amica.
    await this.premia(ref.referrerClientId, ref.id, days, referredClientId);
  }

  /**
   * Applica i giorni di ricompensa all'abbonamento attivo della referrer e la avvisa.
   * Ritorna false se non c'è un abbonamento su cui applicarli: in quel caso l'invito resta
   * senza `rewardedAt` e verrà ripescato da `riscuotiSospese`.
   */
  private async premia(referrerClientId: string, referralId: string, days: number, referredClientId: string): Promise<boolean> {
    /**
     * ⚠️ Anche i piani in coda (19/8, voce 258). `riscuotiSospese` viene chiamata dall'attivazione,
     * **subito dopo** che il piano è stato scritto: se quel piano comincia più avanti è `queued`, e
     * cercando i soli `active` i giorni regalati non si applicavano a niente. Restavano appesi fino
     * al prossimo acquisto — cioè il premio della cliente che porta un'amica dipendeva dal fatto
     * che il suo piano cominciasse oggi.
     *
     * `orderBy endDate desc`: i giorni si aggiungono al piano che finisce più tardi, che è quello
     * che glieli fa durare.
     */
    const sub = (await this.prisma.subscription.findFirst({
      where: { clientId: referrerClientId, status: { in: STATI_CON_UN_PIANO as never } },
      orderBy: { endDate: 'desc' },
      select: { id: true, endDate: true },
    })) as { id: string; endDate: Date | null } | null;
    if (!sub) return false;

    const now = new Date();
    // Se la scadenza è già passata i giorni si contano da OGGI: estendere da una data vecchia
    // regalerebbe giorni già consumati.
    const base = sub.endDate && sub.endDate > now ? sub.endDate : now;
    /**
     * ⚠️ **`istantePiuGiorni`, non `setDate`** (25/8, censimento). `setDate` somma il giorno nel fuso
     * del **processo** conservando l'ora di parete: su Render (`TZ` non impostata) coincide con la
     * somma in millisecondi, ma con `TZ=Europe/Rome` una regalia che attraversa il cambio d'ora di
     * marzo consegna **un'ora in meno** — e in un caso limite un giorno in meno. Qui il giorno non
     * si normalizza: `endDate` è un istante vero e la scadenza deve restare all'ora in cui era.
     */
    const newEnd = istantePiuGiorni(base, days);
    await this.prisma.subscription.update({ where: { id: sub.id }, data: { endDate: newEnd } });
    await this.prisma.referral.update({ where: { id: referralId }, data: { rewardedAt: new Date() } });
    await this.audit.log({
      action: 'referral.reward',
      entityType: 'user',
      entityId: referrerClientId,
      metadata: { referredClientId, days, subscriptionId: sub.id },
    });
    // Senza questa notifica la cliente riceve giorni in regalo e non se ne accorge, a meno che
    // non vada a controllare la data di scadenza. Per una meccanica che vive di passaparola è
    // esattamente il momento in cui glielo vuoi dire.
    await this.notifications
      .notify({
        userId: referrerClientId,
        type: 'referral_rewarded',
        title: `+${days} giorni sul tuo percorso 🎁`,
        body: `Un'amica che hai invitato ha iniziato il suo percorso: il tuo si allunga di ${days} giorni. Grazie!`,
        payload: { days, referredClientId },
      })
      .catch(() => undefined); // la notifica è un di più: non deve mai far fallire la ricompensa
    return true;
  }

  /**
   * RISCOSSIONE DELLE RICOMPENSE IN SOSPESO.
   * Chiamata quando la cliente attiva o rinnova un abbonamento: se nel frattempo un'amica aveva
   * comprato mentre lei era senza piano attivo, i giorni le arrivano adesso — subito, senza
   * aspettare nient'altro. Non lancia mai: è un accessorio della catena pagamenti.
   */
  async riscuotiSospese(referrerClientId: string): Promise<void> {
    try {
      const days = await this.config.getNumber('referral_reward_days', 30);
      if (days <= 0) return;
      const sospese = (await this.prisma.referral.findMany({
        where: { referrerClientId, convertedAt: { not: null }, rewardedAt: null },
        select: { id: true, referredClientId: true },
      })) as { id: string; referredClientId: string }[];
      for (const r of sospese) {
        const ok = await this.premia(referrerClientId, r.id, days, r.referredClientId);
        if (!ok) return; // niente abbonamento attivo: si riproverà alla prossima attivazione
      }
    } catch {
      /* mai bloccante */
    }
  }
}
