import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { pickMainSubscription, subscriptionEnd } from '../commerce/commerce.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { toDateOnly } from '../common/date-only';
import { PrismaService } from '../prisma/prisma.service';
import {
  StatoDataInizio,
  leggiData,
  testoAnnullato,
  testoChiediData,
  testoConferma,
  testoDataNonCapita,
  testoDataPassata,
  testoFatto,
  testoNessunPiano,
  testoPianoGiaPartito,
  testoTroppoLontana,
  verificaData,
} from './data-inizio-chat';
import { MenuService } from './menu.service';

/** Cosa deve fare la chat con la risposta del flusso. Stessa forma di `EsitoSostituzione`. */
export interface EsitoDataInizio {
  testo: string;
  /** Stato da appendere al `meta` del messaggio di Gaia. Assente = flusso chiuso. */
  stato?: StatoDataInizio;
  /** Il flusso passa la mano a una persona. */
  inoltraA?: 'coach' | 'nutritionist';
  esito: 'aperto' | 'in_corso' | 'applicata' | 'annullata' | 'arresa' | 'rifiutata';
  /** Riepilogo di ciò che è stato scritto (per il `meta` e per l'audit). */
  applicata?: { da: string | null; a: string; subscriptionId: string | null };
}

/** Lo stato del piano rispetto allo spostamento della data. */
type Situazione =
  | { puo: false; perche: 'nessun_piano' }
  | { puo: false; perche: 'gia_partito'; inizio: string | null }
  | {
      puo: true;
      /** L'inizio come lo vede la cliente: quello dell'abbonamento, o il `planStartDate`. */
      inizio: string | null;
      subscriptionId: string | null;
      period: string | null;
      status: string;
      /**
       * L'abbonamento ha già delle date sue. È diverso da `inizio != null`, che ripiega sul
       * profilo: su un `pending` le date dell'abbonamento sono nulle **di proposito** (le mette
       * `finalizeApproval`) e scriverle qui vorrebbe dire attivare un piano non pagato.
       */
      haDate: boolean;
    };

/**
 * SPOSTARE LA DATA DI INIZIO PARLANDO CON GAIA (richiesta di Simone del 10/8).
 *
 * In dashboard, chi ha comprato con una data futura legge «se vuoi cambiare la data di inizio,
 * chiedi a Gaia in chat». Questo è il servizio che rende vera quella frase: fino a ieri la data si
 * spostava **solo** dal backoffice, col permesso `change_plan_start`, e la cliente che aveva
 * sbagliato il calendario non aveva nessuna strada che non fosse scrivere alla coach e aspettare.
 *
 * ## Il confine: solo PRIMA che il piano parta
 *
 * Deciso con Simone. Finché l'inizio è nel futuro, spostarlo non butta via niente: non c'è nessun
 * menu consegnato, nessuna spesa fatta. A piano avviato Gaia **non tocca niente** e passa la mano
 * alla coach — perché a quel punto la domanda vera non è «che giorno metto», è «cosa è andato
 * storto», e i menu di questi giorni sono lavoro fatto.
 *
 * Lo stesso confine copre, senza un ramo in più, il caso del **piano in coda**: chi ha un piano in
 * corso e ne ha comprato un secondo ha `planStartDate` nel futuro (la data della coda, scritta da
 * `finalizeApproval`), ma un piano *è* partito. Quella data non è una sua scelta — è la scadenza di
 * quello che sta usando — e spostarla di qui sovrapporrebbe due piani.
 *
 * ## Cosa scrive
 *
 * Le stesse tre cose di `updatePlanStart` in scheda cliente, perché le tre devono restare
 * allineate o raccontano storie diverse: `subscription.startDate` + `endDate` (ricalcolata dalla
 * durata del piano), `clientProfile.planStartDate` (la base dei menu) e la rigenerazione.
 *
 * Con una differenza che conta: **`regenerateFromToday` e non `restartFromPlanStart`**. La seconda
 * cancella TUTTI i `MenuDay` della cliente, storico compreso: qui il piano non è ancora partito,
 * quindi non c'è storico da salvare *oggi* — ma se un giorno il confine si allargasse, quella
 * chiamata butterebbe via i menu passati di una cliente per una frase detta in chat.
 */
@Injectable()
export class DataInizioChatService {
  private readonly logger = new Logger(DataInizioChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly menu: MenuService,
    private readonly configParams: ConfigParamsService,
  ) {}

  // ---------- Ingressi ----------

  /**
   * Testo libero: «posso spostare l'inizio a lunedì?». Se la data è già nel messaggio si salta la
   * domanda e si va diritti alla conferma — chi l'ha già detta non deve ridirla.
   */
  async apriDaTesto(clientId: string, testoCliente: string): Promise<EsitoDataInizio> {
    const [situazione, nome] = await Promise.all([this.situazione(clientId), this.nomeDi(clientId)]);
    if (!situazione.puo) return this.rifiuto(clientId, situazione, nome);

    const detta = leggiData(testoCliente, this.oggi());
    if (detta) return this.valutaData(clientId, detta, { passo: 'data', tentativi: 0 }, nome);

    return {
      testo: testoChiediData(situazione.inizio, nome),
      stato: { passo: 'data', tentativi: 0 },
      esito: 'aperto',
    };
  }

  /** Passo successivo, a partire dallo stato appeso all'ultimo messaggio di Gaia. */
  async avanza(clientId: string, stato: StatoDataInizio, testoCliente: string): Promise<EsitoDataInizio> {
    const nome = await this.nomeDi(clientId);
    if (stato.passo === 'conferma') return this.passoConferma(clientId, stato, testoCliente, nome);
    return this.passoData(clientId, stato, testoCliente, nome);
  }

  // ---------- Passi ----------

  private async passoData(
    clientId: string,
    stato: StatoDataInizio,
    testoCliente: string,
    nome: string | null,
  ): Promise<EsitoDataInizio> {
    // Uscita: qui «no» / «lascia stare» è un annullamento e basta — non c'è nessuna domanda a cui
    // possa essere la risposta, a differenza del passo di conferma.
    if (/^(no|niente|lascia stare|lascia perdere|annulla|va bene cosi)[.!]?$/i.test(testoCliente.trim())) {
      return { testo: testoAnnullato(nome), esito: 'annullata' };
    }
    const detta = leggiData(testoCliente, this.oggi());
    if (!detta) {
      const tentativi = (stato.tentativi ?? 0) + 1;
      // Due tentativi e poi si passa alla coach: insistere una terza volta su una data che non si
      // capisce è il modo di far scrivere alla coach *dopo* aver perso cinque minuti.
      if (tentativi >= 2) return { testo: testoDataNonCapita(true), inoltraA: 'coach', esito: 'arresa' };
      return { testo: testoDataNonCapita(false), stato: { ...stato, tentativi }, esito: 'in_corso' };
    }
    return this.valutaData(clientId, detta, stato, nome);
  }

  /** Data riconosciuta: si controlla che sia possibile e si chiede conferma. */
  private async valutaData(
    clientId: string,
    data: string,
    stato: StatoDataInizio,
    nome: string | null,
  ): Promise<EsitoDataInizio> {
    const motivo = verificaData(data, this.oggi());
    if (motivo === 'passata') {
      return { testo: testoDataPassata(nome), stato: { passo: 'data', tentativi: 0 }, esito: 'in_corso' };
    }
    if (motivo === 'troppo_lontana') {
      // Non si arrende e non insiste: la coach può mettere il piano in pausa, che è la risposta
      // giusta a «mi servono tre mesi», e la cliente resta libera di dirne un'altra.
      return { testo: testoTroppoLontana(), stato: { passo: 'data', tentativi: 0 }, esito: 'in_corso' };
    }
    return {
      testo: testoConferma(data, await this.sblocco(data), nome),
      stato: { ...stato, passo: 'conferma', data, tentativi: 0 },
      esito: 'in_corso',
    };
  }

  private async passoConferma(
    clientId: string,
    stato: StatoDataInizio,
    testoCliente: string,
    nome: string | null,
  ): Promise<EsitoDataInizio> {
    const t = testoCliente
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim();
    if (/^(si|s[iì]|ok|okay|va bene|certo|confermo|conferma|perfetto|esatto|yes|d accordo|daccordo)[.!]*$/.test(t)) {
      if (!stato.data) return this.apriDaTesto(clientId, '');
      return this.applica(clientId, stato.data, nome);
    }
    if (/^(no|niente|annulla|lascia stare|lascia perdere|meglio no)[.!]*$/.test(t)) {
      return { testo: testoAnnullato(nome), esito: 'annullata' };
    }
    // Ha risposto con un'ALTRA data invece di sì/no («no, il 20»): è un cambio di proposta, non
    // un'incomprensione. Trattarlo come «non ho capito» la farebbe ripetere una cosa già detta.
    const altra = leggiData(testoCliente, this.oggi());
    if (altra && altra !== stato.data) return this.valutaData(clientId, altra, stato, nome);

    const tentativi = (stato.tentativi ?? 0) + 1;
    if (tentativi >= 2) return { testo: testoAnnullato(nome), esito: 'annullata' };
    return {
      testo: 'Non ho capito: confermi la nuova data di inizio? Rispondi «sì» oppure «no».',
      stato: { ...stato, tentativi },
      esito: 'in_corso',
    };
  }

  // ---------- Applicazione ----------

  /**
   * Scrive la data nuova. Tre scritture insieme, come in scheda cliente: se una sola mancasse, il
   * banner in dashboard, il gate del menu e la scadenza direbbero tre date diverse.
   */
  private async applica(clientId: string, data: string, nome: string | null): Promise<EsitoDataInizio> {
    // Si ricontrolla adesso, non ci si fida dello stato: fra la proposta e il «sì» può essere
    // passata la mezzanotte (la data diventa passata), o l'attivazione può aver fatto partire il
    // piano. Lo stato appeso al messaggio è vecchio per definizione.
    const situazione = await this.situazione(clientId);
    if (!situazione.puo) return this.rifiuto(clientId, situazione, nome);
    const motivo = verificaData(data, this.oggi());
    if (motivo === 'passata') {
      return { testo: testoDataPassata(nome), stato: { passo: 'data', tentativi: 0 }, esito: 'in_corso' };
    }
    if (motivo === 'troppo_lontana') {
      return { testo: testoTroppoLontana(), stato: { passo: 'data', tentativi: 0 }, esito: 'in_corso' };
    }

    const d = toDateOnly(data);
    const scritture: unknown[] = [
      this.prisma.clientProfile.upsert({
        where: { userId: clientId },
        update: { planStartDate: d } as never,
        create: { userId: clientId, planStartDate: d } as never,
      }),
    ];
    // L'abbonamento si tocca solo se ha già delle date. Su un `pending` (pagamento non ancora
    // approvato) sono nulle di proposito: le mette `finalizeApproval`, che legge proprio
    // `planStartDate` — scriverle qui vorrebbe dire attivare un piano non pagato.
    if (situazione.subscriptionId && situazione.haDate) {
      const fine = subscriptionEnd(d, situazione.period ?? '');
      scritture.push(
        this.prisma.subscription.update({
          where: { id: situazione.subscriptionId },
          data: { startDate: d, endDate: fine } as never,
        }),
      );
    }
    await this.prisma.$transaction(scritture as never);

    await this.audit.log({
      action: 'chat.data_inizio.spostata',
      actorId: clientId,
      entityType: 'client_profile',
      entityId: clientId,
      metadata: {
        prima: situazione.inizio,
        dopo: data,
        subscriptionId: situazione.subscriptionId,
        origine: 'chat',
      },
    });

    // I giorni futuri già erogati (l'inizio poteva essere a due giorni, con i menu già visibili)
    // non valgono più: si rigenerano dalla data nuova. `regenerateFromToday` e non
    // `restartFromPlanStart`: vedi il commento in testa alla classe.
    try {
      await this.menu.regenerateFromToday(clientId);
    } catch (err) {
      // Mai far fallire lo spostamento per un errore di rigenerazione: la data nuova è già
      // scritta e il cron di erogazione ripassa.
      this.logger.error(
        'Rigenerazione menu dopo lo spostamento della data non riuscita',
        err instanceof Error ? err.stack : String(err),
      );
    }

    return {
      testo: testoFatto(data, await this.sblocco(data), nome),
      esito: 'applicata',
      applicata: { da: situazione.inizio, a: data, subscriptionId: situazione.subscriptionId },
    };
  }

  // ---------- Lettura ----------

  /** Oggi nel fuso dell'azienda, a mezzanotte UTC: lo stesso «oggi» del resto del prodotto. */
  private oggi(): Date {
    return toDateOnly();
  }

  /** Il giorno in cui il menu si sblocca: `menu_visible_days_before_start` prima dell'inizio. */
  private async sblocco(data: string): Promise<string> {
    const giorni = await this.configParams.getNumber('menu_visible_days_before_start', 2).catch(() => 2);
    return new Date(toDateOnly(data).getTime() - giorni * 86_400_000).toISOString().slice(0, 10);
  }

  /**
   * Può, o non può, e perché. Un piano si considera **partito** quando esiste un abbonamento
   * attivo la cui data di inizio è oggi o prima: è la stessa condizione che fa comparire i menu.
   */
  private async situazione(clientId: string): Promise<Situazione> {
    const oggi = this.oggi();
    const subs = (await this.prisma.subscription.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        plan: { select: { period: true } },
      },
    })) as {
      id: string;
      status: string;
      startDate: Date | null;
      endDate: Date | null;
      plan: { period: string | null } | null;
    }[];

    const profilo = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { planStartDate: true },
    })) as { planStartDate: Date | null } | null;

    // Un piano IN CORSO: attivo, cominciato, non ancora finito. Copre anche il caso della coda —
    // la cliente ha un secondo piano comprato in anticipo, ma la data di quello non è una sua
    // scelta e non si sposta di qui.
    const inCorso = subs.find(
      (s) =>
        s.status === 'active' &&
        !!s.startDate &&
        s.startDate.getTime() <= oggi.getTime() &&
        (!s.endDate || s.endDate.getTime() >= oggi.getTime()),
    );
    if (inCorso) {
      return { puo: false, perche: 'gia_partito', inizio: inCorso.startDate!.toISOString().slice(0, 10) };
    }

    // Niente da spostare: nessun abbonamento, o solo annullati/scaduti. La data di un piano
    // finito non vuol dire niente, e prometterle un cambio sarebbe peggio del dirle la verità.
    const vivi = subs.filter((s) => s.status !== 'cancelled' && s.status !== 'expired');
    const sub = pickMainSubscription(vivi);
    if (!sub) return { puo: false, perche: 'nessun_piano' };

    const inizio =
      sub.startDate?.toISOString().slice(0, 10) ?? profilo?.planStartDate?.toISOString().slice(0, 10) ?? null;
    return {
      puo: true,
      inizio,
      subscriptionId: sub.id,
      period: sub.plan?.period ?? null,
      status: sub.status,
      haDate: !!sub.startDate,
    };
  }

  /** I due «non posso», con l'inoltro giusto: solo il piano già partito riguarda la coach. */
  private async rifiuto(
    clientId: string,
    situazione: Extract<Situazione, { puo: false }>,
    nome: string | null,
  ): Promise<EsitoDataInizio> {
    if (situazione.perche === 'nessun_piano') {
      return { testo: testoNessunPiano(), esito: 'rifiutata' };
    }
    return {
      testo: testoPianoGiaPartito(situazione.inizio, nome),
      inoltraA: 'coach',
      esito: 'arresa',
    };
  }

  /**
   * Come si chiama, per i testi di Gaia. Stesso ordine di `SostituzioneChatService.nomeDi`: prima
   * il nome con cui **vuole** essere chiamata (`clientProfile.name`), poi `user.firstName`.
   */
  private async nomeDi(clientId: string): Promise<string | null> {
    try {
      const [profilo, utente] = await Promise.all([
        this.prisma.clientProfile.findUnique({ where: { userId: clientId }, select: { name: true } }),
        this.prisma.user.findUnique({ where: { id: clientId }, select: { firstName: true } }),
      ]);
      return (profilo?.name ?? null) || ((utente as { firstName?: string | null } | null)?.firstName ?? null);
    } catch {
      return null;
    }
  }
}
