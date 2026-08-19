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
import { eInCodaPerStato } from '../commerce/stati-abbonamento';

/**
 * ⚠️ **`in_coda` esiste dal 19/8** (voce 258): un piano comprato che comincia più avanti non è né
 * attivo né concluso. Senza questa voce cadeva nel ramo `else` e le diagnostiche lo scrivevano
 * «concluso il 30/11» — cioè concluso a una data che deve ancora arrivare, con `riceveMenu: false`.
 * È precisamente la categoria di riga falsa per cui questo file è stato scritto.
 */
export type StatoPiano = 'attivo' | 'in_coda' | 'scaduto_da_chiudere' | 'concluso' | 'mai';

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
        /**
         * ⚠️ **`queued` NON entra qui, ed è una scelta** (voce 258, 18/8). Questo filtro dice «il
         * motore vale solo per chi ha un piano attivo», e una cliente il cui piano comincia lunedì
         * non ha menu da correggere: farla entrare vorrebbe dire scrivere decisioni del motore su
         * giornate che non esistono ancora. Vale anche per le due schermate del nutrizionista che
         * usano questo filtro — non c'è niente da validare su un piano non cominciato.
         *
         * Chi cerca «ha un piano» (le liste dello staff, i contatori) usa `STATI_CON_UN_PIANO` in
         * `commerce/stati-abbonamento.ts`, che invece la coda ce l'ha dentro. Sono due domande
         * diverse, e questo commento esiste perché finora avevano per caso la stessa risposta.
         */
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
      // ⚠️ `startDate` serve a riconoscere la coda nella forma VECCHIA (`active` con la partenza nel
      // futuro): finché quelle righe esistono, guardare il solo stato ne racconta metà.
      startDate: true,
      // ⚠️ `period` serve a `riceveMenu`: senza, il Monitoraggio risultava «attivo e riceve menu»
      // mentre l'erogazione non gli manda niente. Vedi sotto.
      plan: { select: { name: true, period: true } },
    },
    // Il più recente per ultimo non basta: si scorre tutto e si tiene il migliore (vedi sotto).
    orderBy: [{ startDate: 'desc' }],
  })) as {
    clientId: string; status: string; startDate: Date | null; endDate: Date | null;
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
    // «Finito» conta solo per una riga che dovrebbe essere viva: uno `expired` è già concluso, e
    // chiamarlo «da chiudere» manderebbe qualcuno a sistemare una riga che sta bene.
    const viva = s.status === 'active' || s.status === 'queued';
    const finito = viva && !!s.endDate && soloData(s.endDate).getTime() < oggi.getTime();
    /**
     * ⚠️ Una coda **già finita** non è «in coda»: è una riga da sistemare, come un `active` con la
     * fine passata. Senza questo controllo usciva scritta «in coda dal 24/08» con la scadenza già
     * passata — una riga falsa, che per giunta batteva il piano concluso della stessa cliente. È
     * precisamente il tipo di riga che questo file esiste per non produrre.
     */
    const stato: StatoPiano = finito
      ? 'scaduto_da_chiudere'
      : s.status === 'queued'
        ? 'in_coda'
        : s.status === 'active'
          ? eInCodaPerStato(s, adesso)
            ? 'in_coda' // la forma vecchia della coda: `active` con la partenza nel futuro
            : 'attivo'
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
      /**
       * ⚠️ **Anche una coda riceve menu** (19/8): nella finestra di anteprima l'erogazione compone
       * i giorni del piano che deve cominciare, e lo faceva già quando la coda era scritta
       * `active`. Segnare `false` avrebbe fatto scrivere alla diagnostica delle diete monche
       * «nessuna cliente attiva: non sta danneggiando nessuno» su una cliente che quei menu li ha
       * in mano. In una diagnostica di sicurezza un falso allarme costa un minuto, un falso
       * silenzio costa il difetto che non si vede.
       */
      riceveMenu:
        (stato === 'attivo' || stato === 'in_coda') &&
        (s.plan?.period ?? '').toLowerCase() !== 'monitoring' &&
        !nonRicevono.has(s.clientId),
      etichetta: stato === 'attivo'
        ? `attivo${s.plan?.name ? ` · ${s.plan.name}` : ''}`
        : stato === 'in_coda'
          ? `in coda dal ${giorno(s.startDate)}${s.plan?.name ? ` · ${s.plan.name}` : ''}`
          : stato === 'scaduto_da_chiudere'
            ? `scaduto il ${giorno(s.endDate)} ma ancora «${s.status}» — da chiudere`
            : `concluso il ${giorno(s.endDate)}`,
    };
    /**
     * Un piano ATTIVO vince sempre su uno concluso: una cliente che ne ha avuti tre e ora ne ha uno
     * vivo va raccontata dal vivo. Fra due conclusi resta il primo trovato, che è il più recente.
     *
     * ⚠️ E una **coda** vince su un concluso, ma perde contro un attivo: «in coda dal 31/08» dice
     * una cosa vera e utile su una cliente che ha pagato, mentre «concluso il 22/07» su quella
     * stessa cliente è la riga che la fa richiamare per rivenderle quello che ha già comprato.
     */
    const forza = (x: StatoPiano): number => (x === 'attivo' ? 2 : x === 'in_coda' ? 1 : 0);
    const attuale = out.get(s.clientId);
    if (!attuale || forza(candidato.stato) > forza(attuale.stato)) {
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
