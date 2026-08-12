/**
 * §16.7 — UN CALENDARIO SOLO, per tre persone che guardano lo stesso tempo.
 *
 * ## Il problema che risolve
 *
 * Gli appuntamenti stanno in **due tabelle diverse**, e nessuna delle due sa dell'altra:
 *
 * - `Appointment` — la chiamata della coach, e gli appuntamenti che coach e nutrizionista fissano
 *   a mano dalla scheda della cliente.
 * - `Visit` — la visita clinica: ha le note riservate, la stanza video, il vincolo della prima
 *   visita in presenza, e da oggi anche lo slot prenotato dalla cliente (§16.7).
 *
 * Finché la visita la fissava il nutrizionista, il doppio binario si notava poco. Da quando la
 * cliente prenota da sola, `coachAgenda` — che legge solo `Appointment` — mostrerebbe alla coach un
 * martedì vuoto per una cliente che martedì ha la visita. E la richiesta di Simone (12/8) è
 * esattamente questa: «anche la coach deve vedere nel suo calendario gli appuntamenti di **tutte**
 * le sue clienti».
 *
 * Lo stesso buco, girato, valeva per gli altri due: la cliente non vedeva in agenda le sue visite,
 * e il nutrizionista non vedeva gli appuntamenti presi per lui da un'altra strada.
 *
 * ## Perché è un file di funzioni e non un servizio
 *
 * Perché lo usano `CoachService`, `VisitsService` e la app della cliente. Farne un `@Injectable`
 * dentro `AgendaModule` significherebbe farlo importare da Coach e da HealthArea, e AgendaModule
 * importa già Prisma e Mail: è il modo più rapido di chiudere un anello e scoprirlo in produzione
 * col boot che non parte (è già successo il 12/8, vedi `app.module.spec.ts`). Stessa scelta di
 * `common/avvisa-nutrizionista.ts`.
 */
import type { PrismaService } from '../prisma/prisma.service';

/** Una riga di calendario, comunque sia nata. */
export interface VoceCalendario {
  id: string;
  /** Da quale delle due tabelle viene: serve a chi deve poi aprirla o modificarla. */
  fonte: 'visita' | 'appuntamento';
  clientId: string;
  clientName: string | null;
  /** coach | nutritionist */
  staffRole: string;
  staffId: string | null;
  staffName: string | null;
  /** call | televisit | in_person */
  type: string;
  datetime: string;
  /** Quando finisce, se si sa. Gli `Appointment` non hanno durata: lì è `null`. */
  fine: string | null;
  note: string | null;
  /** Solo per le visite: la stanza si apre da qui. */
  videoRoomId?: string | null;
}

const iso = (d: Date): string => d.toISOString();

/** Due voci sono la stessa cosa se riguardano la stessa cliente, lo stesso staff e lo stesso minuto. */
const chiave = (v: VoceCalendario): string =>
  `${v.clientId}|${v.staffId ?? ''}|${v.datetime.slice(0, 16)}`;

/**
 * Mette insieme le due liste in un calendario solo.
 *
 * ⚠️ **La visita vince sull'appuntamento.** Se un nutrizionista ha fissato la visita dalla scheda
 * clinica e *anche* un appuntamento nello stesso momento — cosa che oggi nessuno impedisce, perché
 * sono due schermate diverse — nel calendario deve comparire **una** riga, e deve essere quella che
 * porta con sé la stanza video e le note. Due righe uguali a mezz'ora di distanza sono il modo più
 * sicuro per far presentare qualcuno all'ora sbagliata.
 */
export function unisciCalendario(voci: VoceCalendario[]): VoceCalendario[] {
  const perChiave = new Map<string, VoceCalendario>();
  for (const v of voci) {
    const k = chiave(v);
    const gia = perChiave.get(k);
    if (!gia || (gia.fonte === 'appuntamento' && v.fonte === 'visita')) perChiave.set(k, v);
  }
  return [...perChiave.values()].sort((a, b) => a.datetime.localeCompare(b.datetime));
}

interface RigaVisita {
  id: string;
  clientId: string;
  nutritionistId: string;
  type: string;
  datetime: Date;
  endsAt: Date | null;
  videoRoomId: string | null;
  nutritionist: { displayName: string } | null;
}

interface RigaAppuntamento {
  id: string;
  clientId: string;
  staffId: string;
  staffRole: string;
  type: string;
  datetime: Date;
  note: string | null;
}

/**
 * Le voci di calendario di un gruppo di clienti, dalle due tabelle.
 *
 * ⚠️ `note` delle visite **non** viene mai letto qui. Sono note cliniche, riservate al
 * nutrizionista e al capo (`Visit.notes` nello schema): un calendario è la cosa più condivisa che
 * esista, e farci passare quel campo vorrebbe dire darle alla coach senza che nessuno l'abbia
 * deciso.
 */
export async function vociCalendario(
  prisma: PrismaService,
  opzioni: {
    clientIds?: string[];
    nutritionistId?: string;
    dal: Date;
    al?: Date;
    nomiCliente?: Map<string, string | null>;
    limite?: number;
  },
): Promise<VoceCalendario[]> {
  const { clientIds, nutritionistId, dal, al, nomiCliente, limite = 200 } = opzioni;
  if (clientIds && clientIds.length === 0) return [];

  const quando = { gte: dal, ...(al ? { lte: al } : {}) };
  const [visite, appuntamenti] = await Promise.all([
    prisma.visit.findMany({
      where: {
        ...(clientIds ? { clientId: { in: clientIds } } : {}),
        ...(nutritionistId ? { nutritionistId } : {}),
        status: 'scheduled' as never,
        datetime: quando,
      },
      orderBy: { datetime: 'asc' },
      take: limite,
      select: {
        id: true, clientId: true, nutritionistId: true, type: true, datetime: true,
        endsAt: true, videoRoomId: true,
        nutritionist: { select: { displayName: true } },
      },
    }) as Promise<unknown> as Promise<RigaVisita[]>,
    prisma.appointment.findMany({
      where: {
        ...(clientIds ? { clientId: { in: clientIds } } : {}),
        ...(nutritionistId ? { staffId: nutritionistId } : {}),
        status: 'scheduled',
        datetime: quando,
      },
      orderBy: { datetime: 'asc' },
      take: limite,
    }) as Promise<unknown> as Promise<RigaAppuntamento[]>,
  ]);

  const idsStaff = [...new Set(appuntamenti.map((a) => a.staffId))];
  const nomiStaff = new Map<string, string>();
  if (idsStaff.length) {
    const righe = (await prisma.staff.findMany({
      where: { id: { in: idsStaff } },
      select: { id: true, displayName: true },
    })) as { id: string; displayName: string }[];
    for (const r of righe) nomiStaff.set(r.id, r.displayName);
  }
  const nome = (clientId: string): string | null => nomiCliente?.get(clientId) ?? null;

  const daVisite: VoceCalendario[] = visite.map((v) => ({
    id: v.id,
    fonte: 'visita',
    clientId: v.clientId,
    clientName: nome(v.clientId),
    staffRole: 'nutritionist',
    staffId: v.nutritionistId,
    staffName: v.nutritionist?.displayName ?? null,
    type: v.type,
    datetime: iso(v.datetime),
    fine: v.endsAt ? iso(v.endsAt) : null,
    note: null,
    videoRoomId: v.videoRoomId ?? null,
  }));

  const daAppuntamenti: VoceCalendario[] = appuntamenti.map((a) => ({
    id: a.id,
    fonte: 'appuntamento',
    clientId: a.clientId,
    clientName: nome(a.clientId),
    staffRole: a.staffRole,
    staffId: a.staffId,
    staffName: nomiStaff.get(a.staffId) ?? null,
    type: a.type,
    datetime: iso(a.datetime),
    fine: null,
    note: a.note,
  }));

  return unisciCalendario([...daVisite, ...daAppuntamenti]);
}
