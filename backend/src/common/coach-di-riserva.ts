import { agganciaAssegnazioneAlProfilo } from './assegnazione-profilo';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * ⛔ **LA COACH DI RISERVA: CHI RESTA SENZA COACH NON RESTA DI NESSUNO.**
 *
 * ## La decisione (Simone, 4/9)
 *
 * `diag:commerciale-e-coach` ha misurato che Giusy Vita (`sales`) ha **zero** clienti sue e 56 con
 * la rete sotto, e che **4 schede** non hanno nessuna coach. Chiudere il perimetro della commerciale
 * su «le sue» voleva dire spegnerle il lavoro. Simone: *«tutte le clienti non assegnate ad una
 * coach vanno a Giusy»*, e *«anche per quelle che verranno, con un parametro»* — così il giorno che
 * la riserva non è più lei si cambia una casella nei Parametri, non il codice.
 *
 * ## ⚠️ È la gemella di `nutrizionista-di-riferimento.ts`, e la forma è la stessa apposta
 *
 * Il capo nutrizionista prende chi finisce il questionario senza nutrizionista; la coach di riserva
 * prende chi resta senza coach. Due regole con la stessa forma: **riempiono solo il vuoto, non
 * sovrascrivono mai**. Spostare una cliente da una coach all'altra resta un atto esplicito
 * (Utenti → assegna), come dice `assegnazione-profilo.ts` dal 6/8.
 *
 * ⛔ **Con una differenza che va detta: la riserva NON è per forza una coach.** Giusy è `sales`, e
 * `users.service.assign` rifiuta come coach chiunque non abbia ruolo `coach`
 * (`assertStaffRole`). Quindi la riserva **non è solo un ripiego automatico**: è anche l'unica via
 * per cui una commerciale può essere scritta in `assignedCoachId` a mano. Chi può fare da riserva
 * sta in `RUOLI_CHE_POSSONO_FARE_DA_RISERVA`, e la porta di `assign` la accetta **solo se è lei**.
 *
 * ## ⛔ Le porte, e perché c'è anche un giro notturno
 *
 * Un profilo nasce o resta senza coach da **più di una porta**: il questionario (`onboarding`), la
 * rimozione a mano (`assign` con coach vuota), l'importazione (`analytics.service`), il ponte
 * lead→profilo quando il lead non ha coach, le due clienti **senza scheda profilo** che il
 * tabulato ha contato. Chiuderne due e lasciare le altre è la forma esatta del difetto
 * `assignments` di `CLAUDE.md`: una porta chiusa e una no non è un cancello, è un cartello.
 *
 * Quindi: le due porte che una persona attraversa (questionario, rimozione) applicano la regola
 * **subito**, e il giro notturno (`cron → coachDiRiserva`) ripesca tutto il resto, comunque sia
 * entrato. Lo script `assegna:coach-di-riserva` è lo stesso giro, lanciato a mano con la lista
 * davanti — per la prima passata sulle clienti di oggi.
 *
 * ## ⚠️ Il giudizio sta qui, non nello script e non nel servizio
 *
 * `giudicaLaRiserva` è pura e ha le sue prove; il servizio Nest e lo script di `prisma/` la
 * chiamano e basta. È la lezione del tabulato dei panieri dell'1/9: un giudizio che decide una
 * scrittura sul catalogo non sta in un file che nessun test guarda.
 */

import { PARAM_COACH_DI_RISERVA, RISERVA_SPENTA, riservaSpenta } from './coach-di-riserva-chiave';

export { PARAM_COACH_DI_RISERVA, RISERVA_SPENTA };

/**
 * ⛔ Chi può fare da riserva. `sales` c'è **per decisione**, non per svista: è il caso di Giusy.
 * Le nutrizioniste no — quel ruolo ha la sua regola in `nutrizionista-di-riferimento.ts`, e una
 * persona scritta in `assignedCoachId` riceve i compiti e gli avvisi **della coach**.
 */
export const RUOLI_CHE_POSSONO_FARE_DA_RISERVA: readonly string[] = ['coach', 'coach_coordinator', 'sales'];

/** Il nome dell'azione nel registro: uno solo per tutte le porte, `metadata.porta` dice quale. */
export const AZIONE_REGISTRO = 'assegnazione.coach_di_riserva';

export type PortaRiserva = 'onboarding' | 'rimozione' | 'giro_notturno' | 'script';

/** Il minimo di una scheda `Staff` che serve per giudicarla. */
export interface SchedaPerRiserva {
  id: string;
  userId: string;
  displayName: string | null;
  active: boolean;
  user: { role: string; status: string; deletedAt: Date | null } | null;
}

export type CoachDiRiserva =
  /** Il parametro dice «nessuna»: la regola non fa niente. */
  | { esito: 'spenta' }
  /**
   * ⛔ Il parametro punta a qualcuno che **non può** fare da riserva: scheda inesistente, sospesa,
   * archiviata, o di un ruolo che non fa da coach. La regola non fa niente, ma **lo dice**: chi
   * legge i log trova il motivo, invece di clienti che restano senza nessuno «per caso».
   */
  | { esito: 'non_valida'; valore: string; motivo: string }
  | { esito: 'ok'; staffId: string; userId: string; displayName: string; role: string };

/**
 * ⛔ **IL GIUDIZIO, PURO.** Dato il valore del parametro e la scheda a cui punta (già letta da chi
 * chiama), dice se c'è una riserva e chi è.
 */
export function giudicaLaRiserva(valore: string | null | undefined, scheda: SchedaPerRiserva | null): CoachDiRiserva {
  const v = String(valore ?? '').trim();
  if (riservaSpenta(v)) return { esito: 'spenta' };
  if (!scheda) return { esito: 'non_valida', valore: v, motivo: 'nessuna scheda staff con questo id' };
  if (!scheda.active) return { esito: 'non_valida', valore: v, motivo: 'la scheda staff è archiviata' };
  if (!scheda.user || scheda.user.deletedAt) return { esito: 'non_valida', valore: v, motivo: 'l\'utente non esiste più' };
  if (scheda.user.status !== 'active') return { esito: 'non_valida', valore: v, motivo: `l'utente è ${scheda.user.status}` };
  if (!RUOLI_CHE_POSSONO_FARE_DA_RISERVA.includes(scheda.user.role)) {
    return { esito: 'non_valida', valore: v, motivo: `il ruolo ${scheda.user.role} non fa da coach` };
  }
  return {
    esito: 'ok',
    staffId: scheda.id,
    userId: scheda.userId,
    displayName: scheda.displayName?.trim() || scheda.user.role,
    role: scheda.user.role,
  };
}

/** Il minimo del client Prisma che serve a leggere la riserva: così è finto in due righe. */
export interface PrismaPerRiserva {
  staff: { findUnique(args: unknown): Promise<SchedaPerRiserva | null> };
}

/** Il minimo di `ConfigParamsService` che serve. */
export interface LettoreParametri {
  getString(key: string, fallback?: string): Promise<string>;
}

/**
 * Legge il parametro e la scheda, e giudica. ⚠️ Il fallback è `off`: una riga che ancora non c'è
 * in `config_param` è una regola spenta, non un errore.
 */
export async function coachDiRiserva(prisma: PrismaPerRiserva, parametri: LettoreParametri): Promise<CoachDiRiserva> {
  const valore = await parametri.getString(PARAM_COACH_DI_RISERVA, RISERVA_SPENTA);
  const v = String(valore ?? '').trim();
  if (riservaSpenta(v)) return giudicaLaRiserva(v, null);
  const scheda = await prisma.staff.findUnique({
    where: { id: v },
    select: { id: true, userId: true, displayName: true, active: true, user: { select: { role: true, status: true, deletedAt: true } } },
  });
  return giudicaLaRiserva(v, scheda);
}

/** Una cliente viva che oggi non ha nessuna coach. */
export interface ClienteSenzaCoach {
  userId: string;
  email: string;
  nome: string | null;
  registrataIl: Date;
  /** ⚠️ `false` = non ha nemmeno la scheda profilo: la crea `agganciaAssegnazioneAlProfilo`. */
  haScheda: boolean;
  questionarioIl: Date | null;
}

/** Il minimo del client Prisma che serve a contare chi è senza coach. */
export interface PrismaPerSenzaCoach {
  user: {
    findMany(args: unknown): Promise<{
      id: string; email: string; createdAt: Date;
      clientProfile: { name: string | null; assignedCoachId: string | null; onboardingCompletedAt: Date | null } | null;
    }[]>;
  };
}

/**
 * ⛔ **Chi è senza coach: si contano le clienti come le conta il backoffice** — utenti con ruolo
 * `client` non cancellati — e non i profili. Il tabulato del 4/9 ha contato **2 clienti senza
 * scheda profilo**, che «non entrano in nessun perimetro, in nessun verso»: contando i profili
 * quelle due non si vedrebbero mai, e resterebbero di nessuno per sempre.
 */
export async function clientiSenzaCoach(prisma: PrismaPerSenzaCoach): Promise<ClienteSenzaCoach[]> {
  const righe = await prisma.user.findMany({
    where: {
      role: 'client',
      deletedAt: null,
      OR: [{ clientProfile: null }, { clientProfile: { assignedCoachId: null } }],
      /**
       * ⛔ **Chi ha un lead con una coach in attesa di accettare NON è «senza coach»**: qualcuno l'ha
       * già scelta, e il ponte lead→profilo scriverà quella quando accetta. Dare la riserva nel
       * frattempo vorrebbe dire un avviso a Giusy per una cliente che fra un giorno è di un'altra.
       */
      NOT: { crmRecord: { assignedCoachId: { not: null } } },
    },
    select: {
      id: true, email: true, createdAt: true,
      clientProfile: { select: { name: true, assignedCoachId: true, onboardingCompletedAt: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return righe.map((u) => ({
    userId: u.id,
    email: u.email,
    nome: u.clientProfile?.name ?? null,
    registrataIl: u.createdAt,
    haScheda: !!u.clientProfile,
    questionarioIl: u.clientProfile?.onboardingCompletedAt ?? null,
  }));
}

/** Una cliente senza coach in scheda che la riserva NON prende, perché il suo lead una coach ce l'ha. */
export interface ClienteConLeadMaSenzaCoach {
  userId: string;
  email: string;
  nome: string | null;
  haScheda: boolean;
  /** `pending` = la coach deve ancora accettare; `accepted` = ha accettato ma la scheda è rimasta vuota. */
  statoLead: string | null;
  coachDelLead: string | null;
}

/** Il minimo del client Prisma che serve a contare chi resta fuori dalla riserva, e perché. */
export interface PrismaPerLeadEsclusi {
  user: {
    findMany(args: unknown): Promise<{
      id: string; email: string;
      clientProfile: { name: string | null; assignedCoachId: string | null } | null;
      crmRecord: { assignedCoachId: string | null; assignmentStatus: string | null; assignedCoach: { displayName: string | null } | null } | null;
    }[]>;
  };
}

/**
 * ⛔ **LO ZERO DEVE PARLARE.** La prima passata del 5/9 ha stampato «0 senza coach» su un catalogo
 * dove il giorno prima erano 4 più 2 senza scheda: o il giro notturno le aveva già prese, o il
 * filtro «lead con una coach» le nascondeva. Un tabulato che non dice quante ne ha lasciate fuori
 * e perché non è un tabulato. Qui si contano quelle: senza coach in scheda **ma** con una coach sul
 * lead.
 *
 * · `pending`: la coach deve ancora accettare, e quando accetta il ponte scrive lei. Non si tocca.
 * · `accepted` con la scheda vuota: è il difetto del 6/8 sulle clienti vecchie, e ha già la sua
 *   riparazione — `npm run fix:assegnazioni`. La riserva non c'entra: quella cliente è di quella
 *   coach, non di Giusy.
 */
export async function clientiConLeadMaSenzaCoach(prisma: PrismaPerLeadEsclusi): Promise<ClienteConLeadMaSenzaCoach[]> {
  const righe = await prisma.user.findMany({
    where: {
      role: 'client',
      deletedAt: null,
      OR: [{ clientProfile: null }, { clientProfile: { assignedCoachId: null } }],
      crmRecord: { assignedCoachId: { not: null } },
    },
    select: {
      id: true, email: true,
      clientProfile: { select: { name: true, assignedCoachId: true } },
      crmRecord: { select: { assignedCoachId: true, assignmentStatus: true, assignedCoach: { select: { displayName: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return righe.map((u) => ({
    userId: u.id,
    email: u.email,
    nome: u.clientProfile?.name ?? null,
    haScheda: !!u.clientProfile,
    statoLead: u.crmRecord?.assignmentStatus ?? null,
    coachDelLead: u.crmRecord?.assignedCoach?.displayName ?? null,
  }));
}

/** Una riga di registro da scrivere: chi chiama decide con che cosa (AuditService o Prisma nudo). */
export interface RigaDiRegistro {
  action: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
}

export interface EsitoGiro {
  /** Quante hanno ricevuto la riserva. */
  assegnate: number;
  /** Di quelle, quante non avevano la scheda profilo e l'hanno avuta adesso. */
  schedeCreate: number;
  /** Quante erano già di qualcuno nel frattempo (fra la lettura e la scrittura): non toccate. */
  giaAssegnate: number;
}

/**
 * ⛔ **SCRIVE LA RISERVA SU CHI È SENZA — attraverso il ponte del 6/8, e per questo non sovrascrive.**
 *
 * `agganciaAssegnazioneAlProfilo` riempie solo il vuoto e crea la scheda se manca: se fra la lettura
 * e la scrittura qualcuno ha assegnato una coach vera, quella vince e qui si conta `giaAssegnate`.
 * Una riga di registro per cliente, con la porta: così fra un mese si sa **perché** quella cliente
 * è di Giusy, e da quale strada è arrivata.
 */
export async function assegnaLaRiserva(
  prisma: PrismaService,
  riserva: { staffId: string; displayName: string },
  clienti: readonly ClienteSenzaCoach[],
  porta: PortaRiserva,
  registra: (riga: RigaDiRegistro) => Promise<void>,
  actorId: string | null = null,
): Promise<EsitoGiro> {
  const esito: EsitoGiro = { assegnate: 0, schedeCreate: 0, giaAssegnate: 0 };
  for (const c of clienti) {
    const fatto = await agganciaAssegnazioneAlProfilo(prisma, c.userId, { name: c.nome, assignedCoachId: riserva.staffId });
    if (fatto === 'gia_assegnato' || fatto === 'niente_da_fare') {
      esito.giaAssegnate += 1;
      continue;
    }
    esito.assegnate += 1;
    if (fatto === 'creato') esito.schedeCreate += 1;
    await registra({
      action: AZIONE_REGISTRO,
      actorId,
      entityType: 'client_profile',
      entityId: c.userId,
      metadata: {
        staffId: riserva.staffId,
        coach: riserva.displayName,
        porta,
        schedaCreata: fatto === 'creato',
        motivo: 'nessuna coach assegnata: presa in carico dalla coach di riserva',
      },
    });
  }
  return esito;
}
