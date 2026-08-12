/**
 * «QUESTA CLIENTE HA UN PIANO ATTIVO?» — la domanda che mancava a tutte le diagnostiche.
 *
 * Nasce da due falsi allarmi in fila, l'11/8, entrambi miei.
 *
 * 1. `diag:menu-incompleti` ha stampato «Rosaria Gruppuso — NON HA: pranzo, cena — chi la riceve resta
 *    senza quei pasti», e io l'ho messa in cima alla lista delle urgenze. Il suo piano era **scaduto il
 *    22/07**: nessun menu in arrivo, nessun danno, nessuna urgenza. Lo script guardava l'ultimo menu
 *    *erogato*, che di per sé non dice niente sul presente.
 * 2. Simone, subito dopo: «non è che anche questi hanno il piano concluso?», sulle due clienti senza
 *    glutine per cui la lista chiedeva di premere «Rigenera menu». Domanda giusta, e la risposta non
 *    stava in nessuno dei due script.
 *
 * Il difetto è di categoria, non di script: **una diagnostica che nomina una cliente senza dire se il
 * suo piano è attivo produce allarmi che sembrano urgenti e non lo sono** — e il costo non è il tempo
 * perso, è che dopo due o tre di questi non si crede più alla lista. Meglio nessuna diagnostica che una
 * che grida.
 *
 * ## I tre stati, e perché tre e non due
 *
 * - **attivo** — c'è un abbonamento `active` e la fine non è passata: quello che si vede in app adesso
 *   è quello che la cliente mangia. Qui un difetto è un difetto.
 * - **concluso** — un piano c'è stato ed è finito. La cliente esiste, i suoi dati esistono, ma niente
 *   di ciò che riguarda l'erogazione la tocca più. Va detto **con la data**: «concluso il 22/07» chiude
 *   la domanda, «nessun piano» la lascia aperta.
 * - **mai** — non ne ha mai avuto uno. Distinguerlo da «concluso» conta perché sono due persone
 *   diverse: una da riattivare e una da attivare per la prima volta.
 *
 * Caso di confine tenuto separato: `status = 'active'` con la fine già passata. È il cron in ritardo, e
 * il motore lo tratta come concluso (`menu.service.ts`: niente erogazione). Qui si chiama **«scaduto da
 * chiudere»**, perché a chi legge serve sapere che quella riga è da sistemare e non un piano vivo.
 */

// Si prende il `PrismaService` vero, come `rete-staff.ts`: nel sandbox il client è uno stub e
// un'interfaccia ristretta non gli combacia. I test e gli script passano un finto con un cast.
import type { PrismaService } from '../prisma/prisma.service';

export type StatoPiano = 'attivo' | 'scaduto_da_chiudere' | 'concluso' | 'mai';

export interface PianoDiCliente {
  stato: StatoPiano;
  /** Come si scrive in una riga di diagnostica: «attivo · Percorso 3 mesi», «concluso il 22/07». */
  etichetta: string;
  nomePiano: string | null;
  fine: Date | null;
  /** Vero se quello che la cliente vede in app oggi dipende ancora da questo piano. */
  riceveMenu: boolean;
}

const giorno = (d: Date | null | undefined) =>
  d ? `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}` : '—';

const soloData = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * LA STESSA DOMANDA, ma come filtro da innestare in una query — non come risposta da leggere.
 *
 * `pianiDiClienti` serve a **raccontare** uno stato: prende un elenco di clienti e dice com'è
 * messo ognuno. Qui serve il contrario: restringere una query perché chi non ha un piano attivo
 * **non compaia affatto**. Con la prima strada bisognerebbe caricare tutte le righe e scartarle
 * in memoria, e i conteggi (`count()`) resterebbero comunque sbagliati — cioè il numero fra
 * parentesi nella coda direbbe una cosa e l'elenco un'altra.
 *
 * Si innesta ovunque ci sia una relazione verso `User`:
 *   `where: { client: filtroClienteConPianoAttivo() }`                 (EngineDecision → client)
 *   `where: { user: { ...altro, ...filtroClienteConPianoAttivo() } }`  (ClientProfile → user)
 *
 * **Il monitoraggio è escluso, ed è una scelta.** Un abbonamento `period: 'monitoring'` è attivo
 * e pagato, ma non è un piano alimentare: `deliverIfEligible` non eroga menu a chi è in
 * monitoraggio, quindi una decisione del motore su quella cliente proporrebbe di cambiare un
 * piano che non esiste.
 *
 * ⚠️ **Quello che questo filtro spegne, e va detto invece di lasciarlo scoprire.** I due
 * guardrail del motore non sono coperti allo stesso modo fuori di qui:
 *  - **calo rapido** → resta coperto: `signals.service.checkRapidLossGuardrail` apre la
 *    segnalazione clinica al salvataggio di ogni misura, per tutte, e non passa da qui;
 *  - **energia bassa cronica** → **non è coperto da nessun'altra parte**: `lowEnergyChronic`
 *    esiste solo dentro il motore, quindi da ora una cliente in monitoraggio, o fra due piani,
 *    che dichiara energia bassa per tre check-in di fila non genera più nessuna segnalazione.
 *    I check-in continuano ad arrivare (il promemoria è incondizionato), quindi il dato c'è e
 *    nessuno lo guarda.
 * È una conseguenza della regola «il motore vale solo per chi ha un piano attivo», non un
 * effetto collaterale nascosto: se si decide che l'energia bassa va vista comunque, il posto
 * dove metterla è `signals.service`, accanto al calo rapido — non riaprendo questo filtro.
 *
 * ⚠️ Deve restare d'accordo con `pianiDiClienti`: stesso confronto per **giorno** (un piano che
 * finisce oggi è ancora attivo oggi) e stesso significato di `active`.
 */
export function filtroClienteConPianoAttivo(adesso = new Date()) {
  const oggi = soloData(adesso);
  return {
    subscriptions: {
      some: {
        status: 'active' as const,
        // `mode: 'insensitive'`: il Negozio salva `period` verbatim e il suo controllo di formato
        // accetta le maiuscole, quindi un piano creato come «Monitoring» passerebbe un `not`
        // normale — che su Postgres distingue le maiuscole — e la cliente rientrerebbe nel motore
        // per una lettera. `commerce.service` normalizza per lo stesso motivo.
        plan: { period: { not: 'monitoring', mode: 'insensitive' as const } },
        OR: [{ endDate: null }, { endDate: { gte: oggi } }],
      },
    },
  };
}

/**
 * Lo stato del piano per un gruppo di clienti, in **una** query.
 *
 * Batch e non una chiamata per cliente: queste funzioni le usano gli script che scorrono elenchi, e
 * cento clienti sarebbero cento round-trip verso Neon — cioè una diagnostica che nessuno lancia più
 * perché è lenta.
 */
/** Mezzanotte di oggi: le pause si confrontano per giorno, come tutto il resto qui dentro. */
const oggiPerPausa = (adesso: Date): Date => soloData(adesso);

export async function pianiDiClienti(
  prisma: PrismaService,
  clientIds: string[],
  adesso = new Date(),
): Promise<Map<string, PianoDiCliente>> {
  const out = new Map<string, PianoDiCliente>();
  const ids = [...new Set(clientIds.filter(Boolean))];
  if (ids.length === 0) return out;

  const righe = (await prisma.subscription.findMany({
    where: { clientId: { in: ids } },
    select: {
      clientId: true, status: true, endDate: true,
      // ⚠️ `period` serve a `riceveMenu`: senza, il Monitoraggio risultava «attivo e riceve menu»
      // mentre l'erogazione non gli manda niente. Vedi sotto.
      plan: { select: { name: true, period: true } },
    },
    // Il più recente per ultimo non basta: si scorre tutto e si tiene il migliore (vedi sotto).
    orderBy: [{ startDate: 'desc' }],
  })) as {
    clientId: string; status: string; endDate: Date | null;
    plan: { name: string | null; period: string | null } | null;
  }[];

  /**
   * ⚠️ CHI STA IN PAUSA O COL PIANO FERMATO NON RICEVE MENU — e finora questa funzione diceva di sì.
   *
   * Le due domande si leggono in blocco per tutte le clienti insieme: una per cliente sarebbe
   * cento round-trip verso Neon, cioè una diagnostica che nessuno lancia più perché è lenta — che è
   * lo stesso motivo per cui questa funzione esiste.
   */
  const [inPausa, fermati] = await Promise.all([
    prisma.event
      .findMany({
        where: {
          clientId: { in: ids },
          mode: 'pause_period',
          startDate: { lte: oggiPerPausa(adesso) },
          endDate: { gte: oggiPerPausa(adesso) },
        } as never,
        select: { clientId: true },
      })
      .catch(() => [] as { clientId: string }[]) as Promise<{ clientId: string }[]>,
    prisma.clientProfile
      .findMany({ where: { userId: { in: ids }, planHeldAt: { not: null } } as never, select: { userId: true } })
      .catch(() => [] as { userId: string }[]) as Promise<{ userId: string }[]>,
  ]);
  const nonRicevono = new Set([...inPausa.map((p) => p.clientId), ...fermati.map((p) => p.userId)]);

  const oggi = soloData(adesso);
  for (const s of righe ?? []) {
    const finito = !!s.endDate && soloData(s.endDate).getTime() < oggi.getTime();
    const stato: StatoPiano = s.status === 'active'
      ? (finito ? 'scaduto_da_chiudere' : 'attivo')
      : 'concluso';
    const candidato: PianoDiCliente = {
      stato,
      nomePiano: s.plan?.name ?? null,
      fine: s.endDate ?? null,
      /**
       * ⚠️ NON basta «l'abbonamento è attivo»: dev'essere la stessa risposta di `deliverIfEligible`,
       * o le diagnostiche contano fra le «attive» persone a cui non arriverà mai un menu.
       *
       * È il caso Rosaria citato in testa a questo file: il falso allarme che questo file esiste
       * per impedire, e che si era ripresentato qui dentro. Le esclusioni sono quelle vere
       * dell'erogazione: **Monitoraggio** (non è un piano alimentare), **pausa vacanza** (o ricevi
       * menu, o sei in pausa — non c'è una terza strada) e **piano fermato dal nutrizionista**.
       *
       * Il costo del falso allarme non è il tempo perso a controllarlo: è che dopo due o tre nessuno
       * guarda più la lista — ed è la stessa lista dove un giorno comparirà quello vero.
       */
      riceveMenu:
        stato === 'attivo' &&
        (s.plan?.period ?? '').toLowerCase() !== 'monitoring' &&
        !nonRicevono.has(s.clientId),
      etichetta: stato === 'attivo'
        ? `attivo${s.plan?.name ? ` · ${s.plan.name}` : ''}`
        : stato === 'scaduto_da_chiudere'
          ? `scaduto il ${giorno(s.endDate)} ma ancora «active» — da chiudere`
          : `concluso il ${giorno(s.endDate)}`,
    };
    // Un piano ATTIVO vince sempre su uno concluso: una cliente che ne ha avuti tre e ora ne ha uno
    // vivo va raccontata dal vivo. Fra due conclusi resta il primo trovato, che è il più recente.
    const attuale = out.get(s.clientId);
    if (!attuale || (candidato.stato === 'attivo' && attuale.stato !== 'attivo')) {
      out.set(s.clientId, candidato);
    }
  }

  for (const id of ids) {
    if (!out.has(id)) {
      out.set(id, { stato: 'mai', etichetta: 'nessun piano', nomePiano: null, fine: null, riceveMenu: false });
    }
  }
  return out;
}

/** Scorciatoia per una cliente sola. */
export async function pianoDiCliente(
  prisma: PrismaService,
  clientId: string,
  adesso = new Date(),
): Promise<PianoDiCliente> {
  const m = await pianiDiClienti(prisma, [clientId], adesso);
  return m.get(clientId) ?? { stato: 'mai', etichetta: 'nessun piano', nomePiano: null, fine: null, riceveMenu: false };
}
