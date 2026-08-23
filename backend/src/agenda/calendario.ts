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
  /**
   * Da dove viene: serve a chi deve poi aprirla o modificarla.
   *
   * ⚠️ **`scadenza` non è un appuntamento**: è il giorno entro cui una visita va fatta, e nessuno
   * si presenta da nessuna parte a quell'ora. Ha una fonte sua per una ragione pratica — chi rende
   * il calendario deve poterla disegnare diversamente e **non** offrire «disdici» o «entra nella
   * stanza» su una riga che non è un incontro.
   */
  fonte: 'visita' | 'appuntamento' | 'scadenza';
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
  /**
   * Riga di tutto il giorno: l'orario dentro `datetime` non vuol dire niente e non si mostra.
   *
   * ⚠️ Esiste perché l'alternativa era mettere una scadenza «alle 9:00», cioè inventare un'ora che
   * qualcuno prima o poi prova a spostare o a disdire. Una data senza ora si disegna come tale.
   */
  tuttoIlGiorno?: boolean;
}

const iso = (d: Date): string => d.toISOString();

/**
 * Due voci sono la stessa cosa se riguardano la stessa cliente, lo stesso staff e lo stesso minuto.
 *
 * ⚠️ **Le scadenze restano fuori dalla deduplica**, e la loro chiave porta dentro l'id: una visita
 * fissata *proprio* il giorno del termine non deve far sparire il promemoria del termine — sono due
 * informazioni diverse («ci vediamo giovedì» e «se giovedì non si fa, i menu si fermano»), e la
 * seconda è quella che ha una conseguenza automatica.
 */
const chiave = (v: VoceCalendario): string =>
  v.fonte === 'scadenza'
    ? `scadenza|${v.id}`
    : `${v.clientId}|${v.staffId ?? ''}|${v.datetime.slice(0, 16)}`;

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

/** Una scadenza in calendario: nasce dalla valutazione clinica, non da un incontro. */
interface RigaScadenza {
  userId: string;
  idoneitaVisitaEntro: Date | null;
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
    /**
     * ⛔ **Le scadenze delle visite entrano SOLO nel calendario dello staff.** `vociCalendario` la
     * chiamano anche `clientAgenda` e l'app della cliente: senza questo cancello la cliente si
     * sarebbe vista in agenda «Fissa la visita per Anna…» alle 02:00 — un appuntamento che non
     * esiste, a un'ora inventata, col testo di un'attività interna. Trovato in revisione **prima**
     * che si vedesse, solo perché un altro difetto teneva la query a zero righe.
     */
    scadenzeVisite?: boolean;
  },
): Promise<VoceCalendario[]> {
  const { clientIds, nutritionistId, dal, al, nomiCliente, limite = 200, scadenzeVisite = false } = opzioni;
  if (clientIds && clientIds.length === 0) return [];

  const quando = { gte: dal, ...(al ? { lte: al } : {}) };
  const [visite, appuntamenti, scadenze] = await Promise.all([
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
    /**
     * ⛔ **LE SCADENZE DELLE VISITE, in calendario** — richiesta di Simone del 23/8.
     *
     * Quando la nutrizionista scrive «serve una visita entro il 30», dal giorno dopo l'erogazione si
     * ferma **da sola**. Finché quella data viveva solo dentro una nota e dentro un'attività in
     * elenco, il giorno del blocco arrivava addosso alla coach nello stesso momento in cui arrivava
     * addosso alla cliente.
     *
     * ⛔ **Si leggono dal PROFILO, non dalle attività — corretto in revisione, due volte.**
     * La prima stesura leggeva `coachTask` filtrando `status: { in: ['open', 'in_progress'] }`: gli
     * stati veri sono `todo | done | skipped`, quindi la query rendeva **zero righe, sempre** — e il
     * cast `as never` aveva zittito il compilatore che lo sapeva. Il test non se n'era accorto
     * perché asseriva la stessa stringa da cui il filtro era stato copiato.
     * ⚠️ E anche corretto lo stato, l'attività resta la fonte sbagliata: si chiude quando la visita è
     * **fissata**, ma il blocco cade solo quando la nutrizionista **rivaluta** — fra i due momenti la
     * scadenza è ancora vera e la riga sarebbe sparita. Il profilo dice la regola; l'attività dice il
     * lavoro. Qui serve la regola.
     */
    scadenzeVisite
      ? (prisma.clientProfile.findMany({
          where: {
            ...(clientIds ? { userId: { in: clientIds } } : {}),
            idoneita: 'serve_visita',
            idoneitaVisitaEntro: quando,
          } as never,
          orderBy: { idoneitaVisitaEntro: 'asc' } as never,
          take: limite,
          select: { userId: true, idoneitaVisitaEntro: true } as never,
        }) as Promise<unknown> as Promise<RigaScadenza[]>)
      : Promise.resolve([] as RigaScadenza[]),
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

  const daScadenze: VoceCalendario[] = scadenze
    // ⚠️ Le decisioni salvate prima del 23/8 non hanno la data: una riga senza giorno non si può
    // disegnare. Si salta, non si inventa.
    .filter((t) => !!t.idoneitaVisitaEntro)
    .map((t) => ({
      id: `visita-entro:${t.userId}`,
      fonte: 'scadenza' as const,
      clientId: t.userId,
      clientName: nome(t.userId),
      // ⚠️ È un promemoria per la coach, nella **sua** agenda: lo staff qui è chi deve muoversi, non
      // chi farà la visita (che è la nutrizionista, e si sa dalla scheda).
      staffRole: 'coach',
      staffId: null,
      staffName: null,
      type: 'scadenza_visita',
      datetime: iso(t.idoneitaVisitaEntro as Date),
      fine: null,
      // ⚠️ Un testo scritto per essere letto in un calendario — non il titolo interno dell'attività.
      note: 'Ultimo giorno per la visita col nutrizionista: da domani i menu si fermano.',
      tuttoIlGiorno: true,
    }));

  return unisciCalendario([...daVisite, ...daAppuntamenti, ...daScadenze]);
}
