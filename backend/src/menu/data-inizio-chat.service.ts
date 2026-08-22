import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { pickMainSubscription, subscriptionEnd } from '../commerce/commerce.service';
import { statoPerGiornoDiInizio } from '../commerce/stati-abbonamento';
import { ConfigParamsService } from '../config-params/config-params.service';
import { istanteDiPartenza, toDateOnly } from '../common/date-only';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAX_GIORNI_AVANTI,
  StatoDataInizio,
  leggiData,
  testoAnnullato,
  testoChiediData,
  testoConferma,
  testoDataNonCapita,
  testoDataPassata,
  testoFatto,
  testoTroppoTardi,
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
  /**
   * Il piano non è ancora partito, ma manca troppo poco: siamo dentro le ore di blocco
   * (`plan_start_change_lock_hours`, di default **24**).
   *
   * Confine deciso con Simone l'11/8, in due passi: prima «finché il piano non parte», poi le 24 ore.
   * Il numero sta in configurazione e non nel codice perché è una soglia — regola di progetto — e
   * perché è la manopola con cui si stringe o si allarga senza un deploy.
   *
   * ⚠️ 24 ore è **meno** dell'anticipo con cui il menu si sblocca (2 giorni): significa che nelle
   * ultime 24-48 ore la data si può ancora spostare, e quei menu — che la cliente ha già davanti e
   * su cui può aver fatto la spesa — vengono rifatti. È una scelta di Simone, ed è il motivo per cui
   * la conferma lo dice invece di rigenerare in silenzio.
   */
  | { puo: false; perche: 'troppo_tardi'; inizio: string | null; oreMancanti: number }
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
 * ## Il confine: fino a 24 ore prima dell'inizio
 *
 * Deciso con Simone il 10/8 come «finché il piano non parte», e stretto l'11/8 a **24 ore prima**
 * (`plan_start_change_lock_hours`) quando è comparso lo stesso limite sul pulsante nel profilo
 * dell'app: «il blocco sul cambio piano facciamolo di 24 ore non di 48».
 *
 * Il numero sta in configurazione e **una volta sola**: lo leggono Gaia e il pulsante dell'app, che
 * sono due strade per la stessa azione. Due regole diverse per la stessa azione è come si ottiene
 * «Gaia me la sposta e dall'app non si può», che è il tipo di incoerenza che nessuno segnala come
 * difetto e tutti raccontano come «l'app fa quello che vuole».
 *
 * Dentro le 24 ore, e a piano già avviato, Gaia **non tocca niente** e passa la mano alla coach —
 * che dalla scheda può ancora forzare la data col suo permesso `change_plan_start`.
 *
 * ⚠️ 24 ore è **meno** dei due giorni con cui il menu si sblocca: nelle ultime 24-48 ore la data si
 * può ancora spostare, e quei menu — che la cliente ha già davanti, e su cui può aver fatto la
 * spesa — vengono rifatti. È una scelta di Simone, ed è il motivo per cui la conferma lo dice
 * invece di rigenerare in silenzio.
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

    await this.scrivi(clientId, data, situazione, 'chat');

    return {
      testo: testoFatto(data, await this.sblocco(data), nome),
      esito: 'applicata',
      applicata: { da: situazione.inizio, a: data, subscriptionId: situazione.subscriptionId },
    };
  }

  /**
   * LE TRE SCRITTURE, in un posto solo — perché ora ci sono due strade per arrivarci: la chat e il
   * pulsante nel profilo dell'app. Se una delle due dimenticasse una delle tre, il banner in
   * dashboard, il gate del menu e la scadenza direbbero tre date diverse: è già successo, e la
   * differenza si nota settimane dopo, quando il piano scade nel giorno sbagliato.
   */
  private async scrivi(
    clientId: string,
    data: string,
    situazione: Extract<Situazione, { puo: true }>,
    origine: 'chat' | 'app',
  ): Promise<void> {
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
          data: {
            startDate: d,
            endDate: fine,
            /**
             * ⚠️ **ANCHE LO STATO** (19/8, voce 258): questo era il quinto punto che scrive la data
             * d'inizio di un piano, e l'unico rimasto a non toccare `status`. Da qui passano la
             * chat con Gaia e il pulsante nel profilo, cioè le due strade della cliente.
             *
             * Sbagliava in tutti e due i versi: una coda spostata a **oggi** restava `queued` e i
             * menu non arrivavano fino alla passata notturna; un piano attivo spostato **avanti**
             * restava `active` con la partenza nel futuro — la forma ambigua — e non sarebbe mai
             * entrato nella promozione, che cerca i `queued`.
             */
            // ⚠️ `d` è `toDateOnly(data)`, cioè un GIORNO: vedi `statoPerGiornoDiInizio`.
            status: statoPerGiornoDiInizio(d) as never,
          } as never,
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
        origine,
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
  }

  // ---------- Il pulsante nel profilo dell'app ----------
  //
  // Richiesta di Simone dell'11/8: «dal profilo, cliccando sul piano, mi fa modificare la data di
  // inizio fino a 24 ore prima». È la stessa azione della chat, con la stessa regola e le stesse
  // scritture — cambia solo che qui non c'è nessuna conversazione da interpretare, quindi il server
  // non restituisce frasi ma **fatti**: può o non può, da quando, entro quando, e perché no.
  // I testi li scrive l'app, che è dove vive la sua lingua; i numeri li dà il server, che è dove
  // vive la regola.

  /** Quello che serve all'app per decidere se mostrare il pulsante e cosa scriverci. */
  async statoPerApp(clientId: string): Promise<{
    puo: boolean;
    perche?: 'nessun_piano' | 'gia_partito' | 'troppo_tardi';
    /** L'inizio attuale (AAAA-MM-GG), quando esiste. */
    inizio: string | null;
    /** Solo per `troppo_tardi`: quante ore mancano davvero all'inizio. */
    oreMancanti?: number;
    /** La soglia in vigore (`plan_start_change_lock_hours`): l'app la scrive nel messaggio. */
    oreDiBlocco: number;
    /** Il massimo in avanti, per limitare il calendario invece di far sbagliare e poi negare. */
    massimoGiorniAvanti: number;
    /**
     * Il primo giorno selezionabile: **oggi**.
     *
     * Non «oggi + le 24 ore di blocco», che sarebbe l'errore facile da fare: il blocco riguarda
     * quanto manca all'inizio ATTUALE, cioè se è troppo tardi per rimettere mano al piano. La data
     * NUOVA può essere anche domani o oggi stesso — «vorrei partire subito» è una richiesta
     * legittima, e Gaia la accetta. Se questo campo dicesse dopodomani, l'app e la chat
     * risponderebbero due cose diverse alla stessa domanda.
     */
    minimoSelezionabile: string;
  }> {
    const [situazione, ore] = await Promise.all([this.situazione(clientId), this.oreDiBlocco()]);
    const base = {
      oreDiBlocco: ore,
      massimoGiorniAvanti: MAX_GIORNI_AVANTI,
      minimoSelezionabile: toDateOnly().toISOString().slice(0, 10),
    };
    if (situazione.puo) return { puo: true, inizio: situazione.inizio, ...base };
    return {
      puo: false,
      perche: situazione.perche,
      inizio: situazione.perche === 'nessun_piano' ? null : situazione.inizio,
      ...(situazione.perche === 'troppo_tardi' ? { oreMancanti: situazione.oreMancanti } : {}),
      ...base,
    };
  }

  /**
   * Sposta la data dal profilo dell'app. Rifiuta con un errore parlante invece di una frase di
   * Gaia: qui il messaggio finisce in un banner, non in una conversazione.
   *
   * La situazione si rilegge **adesso**: fra l'apertura della schermata e il tocco su «Salva» può
   * essere passata la mezzanotte, oppure il piano può essere partito. Fidarsi di quello che l'app
   * aveva letto vorrebbe dire lasciare aperta una finestra in cui la regola non vale.
   */
  async spostaDaApp(clientId: string, data: string): Promise<{ inizio: string; sbloccoMenu: string }> {
    const situazione = await this.situazione(clientId);
    if (!situazione.puo) {
      if (situazione.perche === 'nessun_piano') {
        throw new BadRequestException('Non c\'è nessun piano in attesa di partire: non c\'è una data da spostare.');
      }
      if (situazione.perche === 'troppo_tardi') {
        const ore = await this.oreDiBlocco();
        throw new ConflictException(
          `Il piano parte fra meno di ${ore} ore: da qui la data non si sposta più. Scrivi alla tua coach in chat, ` +
            'lei può ancora farlo.',
        );
      }
      throw new ConflictException('Il piano è già partito: la data di inizio non si sposta più. Parlane con la tua coach in chat.');
    }
    const motivo = verificaData(data, this.oggi());
    if (motivo === 'passata') throw new BadRequestException('Quella data è già passata: scegline una nei prossimi giorni.');
    if (motivo === 'troppo_lontana') {
      throw new BadRequestException(
        `Troppo in là: si può spostare fino a ${MAX_GIORNI_AVANTI} giorni da oggi. Se ti serve più tempo, chiedi alla ` +
          'coach di mettere il piano in pausa.',
      );
    }
    // Anche il blocco delle ore va ricontrollato sulla data NUOVA? No: il blocco riguarda quanto
    // manca all'inizio ATTUALE (è quello che rende tardivo lo spostamento), e `situazione.puo`
    // l'ha già verificato. Una data nuova vicina è legittima: sposta l'inizio a domani, non lo
    // sposta «troppo tardi».
    await this.scrivi(clientId, data, situazione, 'app');
    return { inizio: data, sbloccoMenu: await this.sblocco(data) };
  }

  // ---------- Lettura ----------

  /** Oggi nel fuso dell'azienda, a mezzanotte UTC: lo stesso «oggi» del resto del prodotto. */
  private oggi(): Date {
    return toDateOnly();
  }

  /** Le ore entro cui la data non si sposta più da qui. Soglia in configurazione, non nel codice. */
  private async oreDiBlocco(): Promise<number> {
    return this.configParams.getNumber('plan_start_change_lock_hours', 24).catch(() => 24);
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
        // ⚠️ Solo `active`: uno `queued` con la data già arrivata NON è partito — è la promozione
        // notturna a essere in ritardo, e finché non passa la cliente può ancora spostare la data.
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

    /** La data d'inizio come valore, prima di diventare una stringa: serve per sapere QUANDO parte. */
    const quandoInizia = sub.startDate ?? profilo?.planStartDate ?? null;
    const inizio = quandoInizia?.toISOString().slice(0, 10) ?? null;

    /**
     * MANCA TROPPO POCO? Il blocco è in ORE (`plan_start_change_lock_hours`, default 24) e si conta
     * dall'istante, non dal giorno: «manca meno di un giorno» a mezzanotte e alle 23 non è la stessa
     * cosa, e arrotondare al giorno regalerebbe o ruberebbe mezza giornata a seconda dell'ora in cui
     * la cliente apre l'app.
     *
     * ⛔ **E l'istante da cui contare lo dice `istanteDiPartenza`, non `toDateOnly`** (23/8). Era
     * `toDateOnly(inizio)`, che del giorno d'inizio dà le `00:00Z` — cioè **le 02:00 italiane**. Il
     * piano però parte alla mezzanotte che intende la cliente, due ore prima: il blocco dichiarato
     * di 24 ore ne durava **22** (23 d'inverno), tutti i giorni dell'anno.
     *
     * ⚠️ Sbagliava nel verso che costa: chi apriva l'app nelle ultime due ore utili si sentiva dire
     * «si può» — dall'app il pulsante era acceso, in chat Gaia se ne occupava — e la data si spostava
     * dentro la finestra che il blocco esiste per proteggere, cioè **dopo** che i menu erano già
     * sbloccati e magari la spesa era già fatta. E la stessa riga risponde a `oreMancanti`, il numero
     * che il testo mostra alla cliente: le diceva due ore in più di quelle che aveva.
     *
     * ⚠️ **Si conta sul valore, non sulla stringa.** `inizio` è già passato per
     * `toISOString().slice(0, 10)`, che di un istante vero butta via l'ora: per una coda che eredita
     * la scadenza del piano in corso — l'unico caso in cui `startDate` non è un giorno — quel taglio
     * sposterebbe la partenza indietro fino a mezzanotte, e il numero mostrato alla cliente sarebbe
     * di quasi un giorno sbagliato. `istanteDiPartenza` rende quell'istante com'è e traduce solo i
     * valori-giorno. (Trovato in revisione: la prima stesura passava la stringa.)
     *
     * ⚠️ Il difetto si vedeva solo fra le 22:00 e le 24:00 UTC, cioè quando il giorno di Roma e
     * quello UTC divergono: per le altre 22 ore le due mezzanotti cadono dalla stessa parte di
     * «adesso» e lo scarto di due ore non attraversa mai la soglia. Trovato girando la suite con
     * `npm run test:notte`.
     */
    if (inizio && quandoInizia) {
      const ore = await this.oreDiBlocco();
      /**
       * ⛔ **Una CODA porta un istante vero, e si usa com'è.** `Subscription.startDate` di un piano
       * in coda è la **scadenza** di quello di prima, ora compresa — e `subscriptionEnd`, partendo da
       * un giorno, quella scadenza la produce a mezzanotte UTC **esatta**, cioè indistinguibile da un
       * valore-giorno. ⚠️ Trovato in revisione: senza questo ramo il blocco sarebbe scattato un'ora
       * (due d'estate) **prima** del dovuto proprio per le code, che è la direzione che toglie tempo
       * alla cliente. Qui la provenienza si sa — la dice `status` — e sapere batte indovinare.
       */
      const partenza = sub.status === 'queued' ? quandoInizia : istanteDiPartenza(quandoInizia);
      const mancanti = (partenza.getTime() - Date.now()) / 3_600_000;
      if (mancanti <= ore) {
        return { puo: false, perche: 'troppo_tardi', inizio, oreMancanti: Math.max(0, Math.round(mancanti)) };
      }
    }

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
    if (situazione.perche === 'troppo_tardi') {
      return {
        testo: testoTroppoTardi(situazione.inizio, situazione.oreMancanti, nome),
        inoltraA: 'coach',
        esito: 'arresa',
      };
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
