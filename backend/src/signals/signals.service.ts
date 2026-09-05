import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { DietLearningService } from '../diet-learning/diet-learning.service';
import { apriSegnalazione } from '../escalations/apri-segnalazione';
import { decidiRiapertura } from '../escalations/riapertura';
import { PrismaService } from '../prisma/prisma.service';
import { STATI_CON_UN_PIANO } from '../commerce/stati-abbonamento';
import { avanzamentoPeso, FINESTRA_MASSIMA } from './percentuale-obiettivo';
import { SALTO_ALLARME_KG_DEFAULT, saltoDiPeso, spiegaSaltoDiPeso } from './salto-di-peso';
import {
  CreateCheckinDto,
  CreateMeasurementDto,
  CreateStepsDto,
  CreateWaterDto,
} from './dto/signals.dto';
import { slopePerDay, weeklyLossRate } from './stats';
import { MIN_GIORNI_DEFAULT, MIN_PESATE_DEFAULT, statoAllarmeCalo } from './allarme-calo';
import {
  FINESTRA_GIORNI,
  SALTO_KG_DEFAULT,
  SALTO_RITMO_DEFAULT,
  SaltoImpossibile,
  saltoPeggiore,
  spiegaSalto,
} from './peso-incoerente';
import {
  domandaPerLaCliente,
  domandaPerLoStaff,
  PesataDaConfermare,
  pesataDaConfermare,
  toccaIlGiorno,
} from './pesata-da-confermare';
import { ProgressService } from './progress.service';
import { EscalationRoutingService } from '../escalations/escalation-routing.service';
import { eUnitaAcqua } from '../common/unita-acqua';
import { giornoItaliano, toDateOnly } from '../common/date-only';
import { bicchieriObiettivo } from '../common/obiettivo-acqua';
import { obiettivoPassi } from '../common/obiettivo-passi';
import { MenuService } from '../menu/menu.service';

const MILESTONE_DEFS: { type: string; label: string; lostKg?: number }[] = [
  { type: 'lost_1kg', label: 'Primo chilo andato!', lostKg: 1 },
  { type: 'lost_3kg', label: '-3 kg: si vede!', lostKg: 3 },
  { type: 'lost_5kg', label: '-5 kg: che traguardo!', lostKg: 5 },
];

@Injectable()
export class SignalsService {
  /** Volume di un bicchiere da cucina (ml): stessa base di app/src/lib/water.ts. */
  private static readonly GLASS_ML = 250;
  /** Limiti prudenti dell'obiettivo acqua in bicchieri: 6 = 1,5 L, 16 = 4 L. */
  private static readonly WATER_GOAL_MIN = 6;
  private static readonly WATER_GOAL_MAX = 16;

  /** Serve solo a lasciare traccia quando una segnalazione NON si riapre: vedi il calo rapido. */
  private readonly logger = new Logger(SignalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
    private readonly dietLearning: DietLearningService,
    private readonly progress: ProgressService,
    private readonly routing: EscalationRoutingService,
    private readonly menu: MenuService,
  ) {}

  // ---------- Misure (segnale Corpo) ----------

  async listMeasurements(clientId: string, from?: string, to?: string) {
    return this.prisma.measurement.findMany({
      where: {
        clientId,
        ...(from || to
          ? { date: { ...(from ? { gte: toDateOnly(from) } : {}), ...(to ? { lte: toDateOnly(to) } : {}) } }
          : {}),
      },
      orderBy: { date: 'desc' },
      take: 200,
    });
  }

  async upsertMeasurement(clientId: string, dto: CreateMeasurementDto) {
    const date = toDateOnly(dto.date);
    if (date.getTime() > toDateOnly().getTime()) {
      throw new BadRequestException('Non puoi inserire misure nel futuro');
    }
    const measurement = await this.prisma.measurement.upsert({
      where: { clientId_date: { clientId, date } },
      create: {
        clientId,
        date,
        weightKg: dto.weightKg,
        waistCm: dto.waistCm,
        hipsCm: dto.hipsCm,
        thighsCm: dto.thighsCm,
      },
      update: {
        weightKg: dto.weightKg,
        waistCm: dto.waistCm,
        hipsCm: dto.hipsCm,
        thighsCm: dto.thighsCm,
      },
    });

    // Nota: lo sblocco del gate misure (chiusura dell'alert coach "missing_measurements")
    // avviene ora nell'Alert engine: al prossimo recompute (lettura coda coach o cron)
    // la condizione non vale più e l'alert passa a "resolved".

    /**
     * ⛔ **IL CONTROLLO VA PRIMA DI TUTTO QUELLO CHE PARLA DI QUESTO CORPO** (28/8, secondo giro di
     * revisione — e qui la prima stesura aveva sbagliato l'ordine).
     *
     * Stava sotto ai traguardi. ⚠️ **I traguardi si scrivono una volta sola e restano**: è scritto
     * quaranta righe più giù, in `evaluateMilestones`, insieme al caso peggiore — *«Obiettivo
     * raggiunto! 🎉» dato su una pesata sotto il target*. Con una pesata digitata male (113 al posto
     * di 73) la media crolla sotto il traguardo e quella frase parte: una notifica alla cliente, un
     * avviso alla coach, e nessun modo di tornare indietro. Sarebbe stata *«una frase su un corpo,
     * costruita su un numero digitato male»* — la ragione per cui esiste tutta questa consegna —
     * nell'unico posto **irreversibile** che la consegna toccava senza saperlo.
     *
     * ⚠️ E **prima del calo rapido**, che invece da sé si spegne (vedi lì): la segnalazione che
     * resta è quella che dice la cosa vera.
     */
    const pesoIncoerente = await this.controllaPesoIncoerente(clientId).catch((e) => {
      // ⚠️ **Non in silenzio.** Gli altri `catch` qui attorno sono best-effort su cose che possono
      // mancare; questo è il canale che la consegna dichiara indispensabile — se salta, deve
      // restare scritto da qualche parte che è saltato.
      this.logger.warn(`Controllo pesate incoerenti fallito per ${clientId}: ${String(e)}`);
      return null;
    });

    // Learning motore: la misura chiude un ciclo → calcola esito peso/cm e aggiorna i
    // pesi delle ricette. Non deve mai rompere il salvataggio della misura.
    // ⚠️ Salta se le pesate non stanno in piedi: l'esito di un ciclo misurato su un peso sbagliato
    // insegna al motore la cosa sbagliata. Si ripara (i pesi si riaggiornano), ma intanto sposta i
    // piatti proposti a quella cliente.
    if (!pesoIncoerente) {
      try {
        await this.dietLearning.onCycleClose(clientId, {
          date: measurement.date,
          weightKg: measurement.weightKg,
          waistCm: measurement.waistCm,
          hipsCm: measurement.hipsCm,
        });
      } catch {
        /* learning best-effort */
      }
    }

    const newMilestones = pesoIncoerente ? [] : await this.evaluateMilestones(clientId);
    const alert = await this.checkRapidLossGuardrail(clientId);
    /**
     * ⚠️ I due controlli sono indipendenti: la regola di Lucia dice «ritmo **O** salto». ⛔ Tutti e
     * due però tacciono su una pesata incoerente, che è la terza cosa e ha la sua segnalazione.
     */
    await this.checkSaltoDiPeso(clientId, !!pesoIncoerente).catch(() => undefined);
    await this.checkNoProgress(clientId).catch(() => undefined);
    await this.maybeTrackTrialMeasures(clientId).catch(() => undefined);

    // La misura può SBLOCCARE il menu: sblocca la prova gratuita (misure G0 obbligatorie)
    // e, al 2° giorno del ciclo, il ciclo successivo. Proviamo a erogare subito così menu
    // e lista della spesa (che deriva dai menuDays) risultano aggiornati appena la cliente
    // riapre il menu/dashboard. Best-effort: non deve mai rompere il salvataggio della misura.
    await this.menu.deliverIfEligible(clientId).catch(() => undefined);

    /**
     * ⚠️ `pesoIncoerente` esce **anche di qui**, non solo nella coda della coach: questa è la rotta
     * della cliente (`@Controller('me')`, `@Roles('client')`), e chi la chiama è l'app. Oggi l'app
     * non lo legge — la voce `pesata-strana-chiedi-conferma` è lì per quello — ma il dato esce già,
     * così quando il riquadro si scriverà non servirà toccare il backend.
     *
     * ⛔ **Lo staff non passa di qui**: quando è il backoffice a correggere una misura passa da
     * `ClientsService.updateMeasurement`, che chiama `controllaPesoIncoerente` per conto suo. La
     * prima stesura di questo commento diceva il contrario, ed era falsa.
     */
    return {
      measurement,
      newMilestones,
      rapidLossAlert: alert,
      pesoIncoerente,
      /**
       * ⛔ **«Riguarda la pesata che ha appena scritto?»** (aggiunto in revisione, ed era un difetto
       * grosso). `pesoIncoerente` è il salto **peggiore dei novanta giorni**: una volta che una
       * coppia rotta esiste, quel campo non torna vuoto per tre mesi — anche dopo che il
       * nutrizionista l'ha guardata e chiusa. Una schermata che ci si appoggiasse direbbe «questa
       * pesata è lontana dalle precedenti» **a ogni pesata normale fino a dicembre**, cioè
       * esattamente l'avviso che compare sempre e che nessuno legge più.
       *
       * ⚠️ Il calcolo sta **qui e non nel browser**: le due date sono `Date` veri, il giorno è
       * quello della colonna, e la stessa risposta la legge anche il backoffice.
       */
      pesateDaVerificare: !!pesoIncoerente && toccaIlGiorno(pesoIncoerente, measurement.date as Date),
    };
  }

  /**
   * Correzione della misura di OGGI da parte della cliente: consentita UNA SOLA VOLTA.
   * La misura precedente viene salvata in `replacedSnapshot` (marcata "sostituita"): i valori
   * correnti diventano quelli nuovi, quindi grafici e report (che leggono i valori correnti)
   * non conteggiano la sostituita. Ulteriori correzioni le fa lo staff dal backoffice (permesso
   * "fix_measures"). Registra l'evento audit `measurement.replaced`.
   */
  async correctTodayMeasurement(clientId: string, dto: CreateMeasurementDto) {
    const today = toDateOnly();
    const existing = await this.prisma.measurement.findUnique({
      where: { clientId_date: { clientId, date: today } },
    });
    if (!existing) {
      throw new BadRequestException("Non c'è una misura di oggi da correggere.");
    }
    if ((existing as { replacedSnapshot?: unknown }).replacedSnapshot) {
      throw new BadRequestException('Hai già corretto le misure di oggi. Per altre modifiche scrivi al tuo staff.');
    }
    const snapshot = {
      weightKg: existing.weightKg,
      waistCm: existing.waistCm,
      hipsCm: existing.hipsCm,
      thighsCm: existing.thighsCm,
      replacedAt: new Date().toISOString(),
    };
    const measurement = await this.prisma.measurement.update({
      where: { clientId_date: { clientId, date: today } },
      data: {
        weightKg: dto.weightKg,
        waistCm: dto.waistCm,
        hipsCm: dto.hipsCm,
        thighsCm: dto.thighsCm,
        replacedSnapshot: snapshot as never,
      },
    });
    await this.audit.log({
      action: 'measurement.replaced',
      actorId: clientId,
      entityType: 'measurement',
      entityId: existing.id,
      metadata: {
        date: today.toISOString().slice(0, 10),
        old: snapshot,
        // I valori VERI dopo la scrittura, non quelli richiesti: un campo lasciato in bianco
        // arriva come `undefined` e Prisma lo interpreta come «non toccare», quindi il vecchio
        // valore resta. Registrare qui `null` avrebbe scritto nell'audit una modifica mai
        // avvenuta — e l'audit lo si legge proprio quando qualcosa non torna.
        new: {
          weightKg: measurement.weightKg,
          waistCm: measurement.waistCm,
          hipsCm: measurement.hipsCm,
          thighsCm: measurement.thighsCm,
        },
      },
    });
    // Stessi effetti a valle di un salvataggio misura (learning, milestone, erogazione menu).
    // ⚠️ Il learning resta qui sopra il controllo per una ragione sola: qui la misura di oggi è
    // stata appena **corretta**, quindi il numero nuovo è quello buono per definizione. Se anche
    // così le pesate non stanno in piedi, è una coppia più vecchia — e quella il learning non la
    // guarda, perché `onCycleClose` chiude il ciclo su questa misura.
    try {
      await this.dietLearning.onCycleClose(clientId, {
        date: measurement.date,
        weightKg: measurement.weightKg,
        waistCm: measurement.waistCm,
        hipsCm: measurement.hipsCm,
      });
    } catch {
      /* learning best-effort */
    }
    // ⚠️ **Stesso ordine del salvataggio, e per la stessa ragione**: prima «questi numeri stanno in
    // piedi?», perché sotto ci sono i traguardi, che si scrivono una volta sola.
    const pesoIncoerente = await this.controllaPesoIncoerente(clientId).catch((e) => {
      this.logger.warn(`Controllo pesate incoerenti fallito per ${clientId}: ${String(e)}`);
      return null;
    });
    if (!pesoIncoerente) await this.evaluateMilestones(clientId).catch(() => undefined);
    await this.checkRapidLossGuardrail(clientId).catch(() => undefined);
    await this.checkSaltoDiPeso(clientId, !!(await this.controllaPesoIncoerente(clientId).catch(() => null))).catch(() => undefined);
    await this.menu.deliverIfEligible(clientId).catch(() => undefined);
    // ⚠️ Esce anche di qui: è la rotta con cui la cliente corregge la pesata di oggi, cioè il
    // momento in cui un refuso si ripara da solo — e l'asimmetria con l'altra porta non avrebbe
    // nessuna ragione.
    return {
      measurement,
      pesoIncoerente,
      // ⚠️ Stessa ragione dell'altra porta: qui il salto vecchio è ancora più probabile, perché è
      // proprio il momento in cui si sta riparando qualcosa.
      pesateDaVerificare: !!pesoIncoerente && toccaIlGiorno(pesoIncoerente, measurement.date as Date),
    };
  }

  /**
   * Funnel prova gratuita: alla PRIMA misura inserita con una prova attiva emette
   * `trial_measures_ok` (il punto A del report A→B esiste). Idempotente.
   */
  private async maybeTrackTrialMeasures(clientId: string): Promise<void> {
    const count = await this.prisma.measurement.count({ where: { clientId } });
    if (count !== 1) return; // solo alla prima misura
    // ⚠️ Anche in coda (19/8, voce 258): la misura di partenza si prende nella finestra di
    // anteprima, cioè prima che la prova cominci. È il punto A del report A→B, e senza di lui il
    // funnel del lancio conta meno prove di quelle vere.
    const trial = await this.prisma.subscription.findFirst({
      where: { clientId, status: { in: STATI_CON_UN_PIANO as never }, plan: { priceCents: 0 } } as never,
      select: { id: true },
    });
    if (!trial) return;
    const already = await this.prisma.analyticsEvent.findFirst({ where: { userId: clientId, name: 'trial_measures_ok' } as never, select: { id: true } });
    if (already) return;
    await this.prisma.analyticsEvent.create({
      data: { eventId: randomUUID(), name: 'trial_measures_ok', userId: clientId, phase: 'funnel', data: {} as never } as never,
    });
  }

  /** Le due soglie del salto impossibile, dai Parametri: sono cliniche, non nostre. */
  private async soglieSalto(): Promise<[number, number]> {
    return Promise.all([
      this.configParams.getNumber('weight_jump_impossible_kg', SALTO_KG_DEFAULT),
      this.configParams.getNumber('weight_jump_impossible_kg_week', SALTO_RITMO_DEFAULT),
    ]);
  }

  /**
   * ⛔ **DUE PESATE CHE NON POSSONO ESSERE DELLA STESSA PERSONA: QUALCUNO DEVE GUARDARE** (28/8).
   *
   * Richiesta di Simone, dopo che `diag:fabbisogno-media` aveva trovato quattro clienti con la media
   * mobile lontana 12,2 · 12,8 · 13,5 · 19,7 chili dall'ultima pesata: *«se succede una cosa simile arriva il
   * blocco e deve intervenire la coach o il nutrizionista»*. Quelle quattro erano account di prova,
   * ⚠️ ma il codice non sapeva distinguerle da una cliente vera — e non deve saperlo: deve reggere
   * anche quando sono vere.
   *
   * **I due canali, e perché tutti e due.** La coach lo vede nella sua coda (avviso «Pesate
   * incoerenti», che si chiude da solo quando i numeri tornano a posto) perché è lei che ha il
   * telefono della cliente ed è quasi sempre un numero digitato male. Il nutrizionista lo riceve
   * come segnalazione clinica perché **il cibo è cambiato**: da adesso quella cliente mangia il
   * livello della sua dieta invece del suo fabbisogno, e «cosa mangia» è roba sua. ⚠️ Se il numero
   * è invece **vero**, allora è successo qualcosa al corpo di quella persona in pochi giorni, e
   * allora è ancora più roba sua.
   *
   * ⚠️ **Non si chiude da sola quando il numero viene corretto**, ed è voluto: la segnalazione è la
   * traccia che per qualche giorno abbiamo servito un fabbisogno sbagliato — o che non l'abbiamo
   * servito affatto. Chi corregge la pesata la chiude a mano, e così resta scritto chi ha guardato.
   */
  async controllaPesoIncoerente(clientId: string, attore?: string): Promise<SaltoImpossibile | null> {
    const [sogliaKg, sogliaRitmo] = await this.soglieSalto();
    const daQuando = new Date(Date.now() - FINESTRA_GIORNI * 86_400_000);
    // ⚠️ **La stessa finestra del fabbisogno** (`FINESTRA_GIORNI`, `FINESTRA_MASSIMA`, novanta
    // giorni): se guardassimo righe diverse da quelle che decidono le calorie, esisterebbe una
    // pesata capace di sporcare il piatto senza far suonare niente.
    const pesate = (await this.prisma.measurement.findMany({
      where: { clientId, date: { gte: daQuando } },
      orderBy: { date: 'desc' },
      take: FINESTRA_MASSIMA,
      select: { date: true, weightKg: true },
    })) as { date: Date; weightKg: number }[];

    const salto = saltoPeggiore(pesate, sogliaKg, sogliaRitmo);
    if (!salto) return null;

    const [finestraGiorni, peggioramentoMinimo] = await Promise.all([
      this.configParams.getNumber('escalation_reopen_days', 14),
      this.configParams.getNumber('rapid_loss_reopen_worsening_kg', 0.5),
    ]);
    // Stessa forma del calo rapido: la decisione di riaprire guarda il MOTIVO, non la categoria —
    // altrimenti una qualunque altra segnalazione clinica aperta zittirebbe questa.
    const decisione = await decidiRiapertura(this.prisma as never, {
      clientId,
      motivoContiene: 'Pesate incoerenti',
      gravita: salto.salto,
      finestraGiorni,
      peggioramentoMinimo,
    });
    if (!decisione.apri) {
      this.logger.log(`Pesate incoerenti per ${clientId}: non riaperta — ${decisione.motivo}`);
      return salto;
    }

    const aperta = await apriSegnalazione(this.prisma as never, {
      clientId,
      category: 'clinical',
      /**
       * ⛔ **LE PAROLE DICONO TUTT'E DUE LE POSSIBILITÀ, non la più probabile** (corretto in
       * revisione, 28/8). La prima stesura scriveva «Una delle due misure non può essere vera»:
       * ⚠️ è un **fatto che questo codice non sa**. Sa che il ritmo implicito è oltre soglia, e quel
       * dominio contiene sia gli errori di tastiera (quasi sempre) sia gli eventi clinici veri
       * (raramente). Detta così, davanti a una diuresi vera avrebbe mandato il nutrizionista a
       * cercare un errore di battitura.
       *
       * ⚠️ E dice anche **che il calo rapido non suonerà**, perché sopra queste soglie viene spento
       * apposta: se quel calo è vero, questa è l'unica segnalazione che glielo dice, e deve essere
       * leggibile come tale.
       */
      reason:
        `Pesate incoerenti: ${spiegaSalto(salto)}. O una delle due misure è sbagliata, ` +
        'oppure è successo qualcosa che va guardato: in tutt\'e due i casi, finché non sono verificate, ' +
        'il fabbisogno non viene personalizzato e i menu usano il livello della sua dieta. ' +
        '⚠️ Sopra questo scarto l\'allarme «calo rapido» non suona: se il calo è vero, è questa la segnalazione che lo dice.',
      source: 'engine',
      // La gravità è il salto in chili: è il numero con cui il prossimo controllo capirà se la cosa
      // è peggiorata (un salto più grosso è una storia nuova, non la stessa che ritorna).
      gravita: salto.salto,
      dedupe: false,
    });
    /**
     * ⛔ **SE NON È NATA, L'AUDIT NON DEVE DIRE CHE È NATA** (secondo giro di revisione, 28/8).
     *
     * `apriSegnalazione` ha un `catch { return null }` dentro: la `escalation.create` che va giù —
     * cioè il modo di fallire più probabile — non lancia niente. Il `catch` di chi mi chiama non
     * scatta, quindi la promessa «se salta resta scritto» era vuota proprio nel caso previsto, e
     * subito dopo l'audit scriveva `signals.weight_incoherent` come se fosse andato tutto bene.
     * ⚠️ Un registro che racconta un'apertura mai avvenuta è peggio di nessun registro: lo si legge
     * proprio quando qualcosa non torna.
     */
    if (!aperta) {
      this.logger.warn(
        `Pesate incoerenti per ${clientId}: la segnalazione al nutrizionista NON è stata aperta — ${spiegaSalto(salto)}.`,
      );
      return salto;
    }
    await this.audit.log({
      action: 'signals.weight_incoherent',
      // ⚠️ Chi ha innescato il controllo, che non è sempre la cliente: dal backoffice la pesata la
      // tocca lo staff, e attribuirle un'azione partita da un'altra scrivania rende l'audit inutile
      // proprio sulle righe che qualcuno andrà a rileggere.
      actorId: attore ?? clientId,
      entityType: 'escalation',
      entityId: aperta.id,
      metadata: { ...salto, dal: salto.dal.toISOString(), al: salto.al.toISOString(), sogliaKg, sogliaRitmo, clientId },
    });
    return salto;
  }

  /**
   * ⛔ **LA DOMANDA PRIMA DEL SALVATAGGIO — sola lettura, e deve restarlo** (voce
   * `pesata-strana-chiedi-conferma`).
   *
   * Risponde a «il numero che sto scrivendo torna con le pesate che ci sono già?». La chiamano le
   * due schermate dove un peso si digita: l'app della cliente e il modale «Correggi misura» del
   * backoffice. ⚠️ **Non scrive niente**: nessuna segnalazione, nessun audit, nessun parametro
   * toccato. Chi la chiama può solo mostrare una domanda — se la persona risponde «sì, è giusto» il
   * salvataggio prosegue e `controllaPesoIncoerente` fa il suo giro identico a oggi.
   *
   * ⛔ **Non è un permesso**: un `null` di qui non autorizza niente e un valore non vieta niente.
   * Se un domani qualcuno volesse farne un cancello, il posto è il servizio che scrive — non
   * questo, che per costruzione non sa nemmeno se il salvataggio poi avverrà.
   *
   * ⚠️ **Le stesse soglie e la stessa finestra del guardrail**, lette dai Parametri a ogni chiamata
   * (`soglieSalto`, `FINESTRA_GIORNI`): una domanda che usasse numeri suoi direbbe «va bene» un
   * istante prima che la segnalazione si apra, ed è il modo più veloce per far smettere alla gente
   * di leggere quello che scriviamo.
   *
   * @param chi decide le **parole**, non la regola: `cliente` parla del suo corpo, `staff` della
   *   riga di un'altra persona.
   * @param dataIso il giorno a cui il numero andrebbe (`YYYY-MM-DD`). Serve al backoffice, che
   *   corregge anche righe vecchie; per la cliente è sempre oggi.
   */
  async verificaPesata(
    clientId: string,
    weightKg: number,
    chi: 'cliente' | 'staff',
    dataIso?: string,
  ): Promise<(PesataDaConfermare & { frase: string }) | null> {
    if (!Number.isFinite(weightKg)) throw new BadRequestException('Peso non valido.');
    /**
     * ⛔ **Fuori dai limiti che la porta di scrittura accetta, non si chiede niente** (aggiunto in
     * revisione). Senza questa riga, chi scrive 30 al posto di 80 riceveva prima «…sono 50 kg in 3
     * giorni. È giusto?», rispondeva «sì, è giusto», e **subito dopo** si prendeva «Il peso sembra
     * troppo basso» dal DTO. ⚠️ Due schermate che si contraddicono, nell'ordine peggiore: la
     * seconda smentisce una conferma che le abbiamo appena chiesto.
     *
     * ⚠️ I due limiti sono diversi perché lo sono le due porte: il DTO della cliente si ferma a
     * 35–250 kg, la correzione dello staff arriva a 25–400. Chi chiede deve tacere esattamente dove
     * chi scrive dirà di no.
     */
    const [minimo, massimo] = chi === 'staff' ? [25, 400] : [35, 250];
    if (weightKg < minimo || weightKg > massimo) return null;
    const giorno = toDateOnly(dataIso);
    const [sogliaKg, sogliaRitmo] = await this.soglieSalto();
    const larghezza = FINESTRA_GIORNI * 86_400_000;
    /**
     * ⛔ **Le due righe confinanti, chieste per nome — non le ultime trenta.**
     *
     * `controllaPesoIncoerente` legge la storia con `findMany(desc).take(FINESTRA_MASSIMA)` perché
     * scandisce **tutte** le coppie. Qui la stessa lettura sarebbe un difetto silenzioso: le uniche
     * righe che contano sono le due che confinano col giorno scritto, e «le trenta più recenti»
     * quando si corregge una pesata di due mesi fa **non le contiene** — la domanda sarebbe stata
     * muta proprio sulle correzioni vecchie, cioè quelle fatte a mano da chi sta riparando qualcosa.
     *
     * ⚠️ E la finestra dei novanta giorni si misura **attorno al giorno scritto**, non da oggi, per
     * la stessa ragione: contata da oggi, la riga precedente a una pesata di due mesi fa ci sarebbe
     * caduta fuori.
     *
     * ⚠️ Si guarda anche **dopo**: dal backoffice si corregge una riga in mezzo alla storia, e una
     * correzione che sistema il rapporto col giorno prima e ne rompe uno identico col giorno dopo è
     * esattamente il gesto che questa domanda deve fermare.
     */
    const [prima, dopo] = (await Promise.all([
      this.prisma.measurement.findFirst({
        where: { clientId, date: { gte: new Date(giorno.getTime() - larghezza), lt: giorno } },
        orderBy: { date: 'desc' },
        select: { date: true, weightKg: true },
      }),
      this.prisma.measurement.findFirst({
        where: { clientId, date: { gt: giorno, lte: new Date(giorno.getTime() + larghezza) } },
        orderBy: { date: 'asc' },
        select: { date: true, weightKg: true },
      }),
    ])) as ({ date: Date; weightKg: number } | null)[];

    const pesate = [prima, dopo].filter((x): x is { date: Date; weightKg: number } => !!x);
    const p = pesataDaConfermare(pesate, weightKg, giorno, sogliaKg, sogliaRitmo);
    if (!p) return null;
    return { ...p, frase: chi === 'staff' ? domandaPerLoStaff(p) : domandaPerLaCliente(p) };
  }

  /**
   * Guardrail (spec 7.4): se il ritmo di calo sulle ultime 2 settimane supera
   * max_weight_change_alert_kg_week, apre un'escalation verso il nutrizionista
   * assegnato (una sola aperta per volta).
   */
  /**
   * ⛔ **IL SALTO IMPROVVISO OLTRE 4 KG** — seconda metà della regola di Lucia (5/9): *«ritmo calo
   * > 1.5 kg/settimana per 2+ settimane consecutive **O salto improvviso > 4 kg**»*. La prima metà
   * è `checkRapidLossGuardrail` qui sotto, che c'era già con la soglia giusta; questa mancava, ed è
   * il caso che la voce `pesate-lontane-buco-del-ritmo` chiedeva da agosto — chi sospende, sta ferma
   * venticinque giorni e torna con venti chili in meno.
   *
   * ⚠️ **La finestra è più larga di quella del ritmo** (novanta giorni contro quattordici), e deve
   * esserlo: un salto attraverso una sospensione ha per definizione un buco in mezzo, e cercarlo in
   * due settimane vorrebbe dire non trovarlo mai. È la stessa finestra del fabbisogno
   * (`FINESTRA_GIORNI`), così le due letture guardano lo stesso pezzo di storia.
   *
   * ⚠️ **La segnalazione arriva a tutte e due le figure**, come ha chiesto Lucia (punto 6): non
   * serve niente di speciale — `decidiDestinatari` notifica la coach **e** la nutrizionista
   * assegnate, ed è `primary` a dire solo chi la prende in carico.
   */
  private async checkSaltoDiPeso(clientId: string, pesoIncoerente: boolean): Promise<boolean> {
    /**
     * ⛔ **SU UNA PESATA CHE NON STA IN PIEDI NON SI DICE NIENTE** (revisione, 5/9). È la stessa
     * regola del calo rapido venti righe sotto: una cliente che digita 48 invece di 68 ha un
     * «salto» di venti chili, e la frase «−20 kg fra il 3 e il 5 settembre» sarebbe una frase
     * **falsa su un corpo**. Chi deve saperlo lo sa già dalla segnalazione «Pesate incoerenti».
     */
    if (pesoIncoerente) return false;
    const [soglia, finestraRiapertura] = await Promise.all([
      this.configParams.getNumber('weight_jump_alert_kg', SALTO_ALLARME_KG_DEFAULT),
      this.configParams.getNumber('escalation_reopen_days', 14),
    ]);
    const da = new Date(Date.now() - FINESTRA_GIORNI * 86_400_000);
    const pesate = (await this.prisma.measurement.findMany({
      where: { clientId, date: { gte: da } },
      orderBy: { date: 'desc' },
      take: FINESTRA_MASSIMA,
      select: { date: true, weightKg: true },
    })) as { date: Date; weightKg: number }[];
    const salto = saltoDiPeso(pesate, soglia);
    if (!salto) return false;
    /**
     * ⛔ **IL DEDUP GUARDA IL MOTIVO, NON LA CATEGORIA** — corretto in revisione il 5/9, ed è lo
     * stesso difetto che gli altri due controlli di questo file avevano già pagato. Col dedup
     * standard bastava una qualunque clinica aperta — un'allergia, il calo rapido che gira tre
     * righe prima — per **zittire** proprio la segnalazione che dice le due date e i chili. Sul caso
     * di punta (venti chili al rientro) il calo rapido apre per primo, e questa non nasceva mai.
     * ⚠️ E la tregua è quella configurata (`escalation_reopen_days`), non il default nascosto dentro
     * `apriSegnalazione`: senza, lo stesso salto — che resta nella finestra di novanta giorni —
     * riapriva una segnalazione identica ogni quattordici giorni per tre mesi.
     */
    const decisione = await decidiRiapertura(this.prisma as never, {
      clientId,
      motivoContiene: 'Salto di peso',
      gravita: salto.persi,
      finestraGiorni: finestraRiapertura,
      peggioramentoMinimo: 0,
    });
    if (!decisione.apri) {
      this.logger.log(`Salto di peso per ${clientId}: non riaperta — ${decisione.motivo}`);
      return true;
    }
    const aperta = await apriSegnalazione(this.prisma as never, {
      clientId,
      category: 'clinical',
      reason: spiegaSaltoDiPeso(salto, giornoItaliano),
      source: 'engine',
      gravita: salto.persi,
      dedupe: false,
    });
    /** ⛔ Se non è nata, l'audit non deve dire che è nata: `apriSegnalazione` ritorna `null` e non lancia. */
    if (!aperta) {
      this.logger.warn(`Salto di peso per ${clientId}: la segnalazione NON è stata aperta — −${salto.persi} kg.`);
      return true;
    }
    await this.audit.log({
      action: 'signals.weight_jump_alert',
      actorId: clientId,
      entityType: 'escalation',
      metadata: { persi: salto.persi, giorni: salto.giorni, soglia },
    });
    this.logger.warn(`Salto di peso per ${clientId}: −${salto.persi} kg in ${salto.giorni} giorni.`);
    return true;
  }

  private async checkRapidLossGuardrail(clientId: string): Promise<boolean> {
    const [threshold, minGiorniRiarmo, minPesateRiarmo] = await Promise.all([
      this.configParams.getNumber('max_weight_change_alert_kg_week', 1.5),
      this.configParams.getNumber('rapid_loss_resume_min_days', MIN_GIORNI_DEFAULT),
      this.configParams.getNumber('rapid_loss_resume_min_measures', MIN_PESATE_DEFAULT),
    ]);
    const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000);
    const recent = await this.prisma.measurement.findMany({
      where: { clientId, date: { gte: twoWeeksAgo } },
      orderBy: { date: 'asc' },
      select: { date: true, weightKg: true },
    });
    if (recent.length < 3) return false;

    /**
     * ⛔ **UN CALO CHE NON È MAI AVVENUTO NON È UN CALO RAPIDO** (28/8).
     *
     * Senza questa riga, la prima cliente con una pesata sbagliata riceveva una segnalazione clinica
     * che diceva *«Calo rapido: 40 kg/settimana sulle ultime rilevazioni. Verificare calorie ed
     * energia»* — una frase su un corpo, costruita su un numero digitato male. ⚠️ È esattamente il
     * difetto che la casa chiama per nome: **una ragione falsa è peggio di un ordine sbagliato**. Il
     * nutrizionista avrebbe cercato un problema clinico dove c'era un problema di tastiera, e la
     * volta dopo avrebbe creduto un po' meno a queste segnalazioni.
     *
     * ⚠️ Si guarda **solo dentro le due settimane su cui si calcola la pendenza**: un salto più
     * vecchio non entra in questo conto e non deve poterlo zittire. E non si torna `false` in
     * silenzio — `controllaPesoIncoerente` ha già aperto la segnalazione giusta, che dice la cosa vera.
     */
    const [saltoKg, saltoRitmo] = await this.soglieSalto();
    const incoerente = saltoPeggiore(
      recent.map((m: { date: Date; weightKg: number }) => ({ date: m.date, weightKg: m.weightKg })),
      saltoKg,
      saltoRitmo,
    );
    if (incoerente) {
      this.logger.log(
        `Calo rapido per ${clientId}: non calcolato, le pesate non stanno in piedi — ${spiegaSalto(incoerente)}.`,
      );
      return false;
    }

    /**
     * «AUTORIZZA A PROSEGUIRE» VALE ANCHE QUI, e questo è il punto in cui contava di più.
     *
     * Questa segnalazione nasce a **ogni pesata salvata**, non una volta a notte: se il baseline
     * non venisse letto qui, il nutrizionista autorizzerebbe la cliente a proseguire e si
     * ritroverebbe una segnalazione clinica nuova alla sua prima pesata successiva — cioè lo stesso
     * giorno. La tregua di `riapertura.ts` qui sotto **non basta**: quella impedisce a una
     * segnalazione *già chiusa* di riaprirsi, mentre qui la questione è che l'allarme non deve
     * proprio calcolarsi finché non ci sono pesate nuove a sufficienza.
     */
    const profilo = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { rapidLossBaselineAt: true },
    })) as { rapidLossBaselineAt: Date | null } | null;
    const allarme = statoAllarmeCalo(
      recent.map((m: { date: Date; weightKg: number }) => ({ date: m.date, value: m.weightKg })),
      profilo?.rapidLossBaselineAt ?? null,
      new Date(),
      minGiorniRiarmo,
      minPesateRiarmo,
    );
    if (!allarme.armato) return false;

    const rate = weeklyLossRate(slopePerDay(allarme.pesate));
    if (rate === null || rate <= threshold) return false;

    /**
     * «SE IL NUTRIZIONISTA DICE OK, RESTA OK: NON DEVI CONTINUARE A TEDIARLO» (Simone, 11/8).
     *
     * Il controllo che c'era qui guardava solo `status: 'open'`: appena la nutrizionista metteva
     * «risolta», al primo peso del giorno dopo la segnalazione tornava identica — perché la cliente
     * continuava a perdere 2,8 kg/settimana anche dopo che qualcuno aveva detto «lo so, la sto
     * seguendo». Il risultato non era il fastidio: era che le segnalazioni smettevano di voler dire
     * qualcosa, e chi le riceve impara a chiuderle senza leggerle. Comprese quelle nuove.
     *
     * Ora la decisione sta in `riapertura.ts`, con la tregua da `escalation_reopen_days` — e
     * l'eccezione che la rende sicura: se il ritmo **peggiora** oltre
     * `rapid_loss_reopen_worsening_kg` si riapre comunque, perché 1,8 kg/settimana che diventano 3,5
     * non sono la stessa segnalazione che torna.
     */
    const [finestraGiorni, peggioramentoMinimo] = await Promise.all([
      this.configParams.getNumber('escalation_reopen_days', 14),
      this.configParams.getNumber('rapid_loss_reopen_worsening_kg', 0.5),
    ]);

    // `apriSegnalazione` e non una `create` diretta: quella scriveva la riga con
    // `assignedToId: profile?.assignedNutritionistId` — cioè **vuoto** per quasi tutte, perché una
    // nutrizionista assegnata non ce l'ha nessuna — e non avvisava nessuno. Caso reale trovato
    // l'8/8: una cliente con «Calo rapido: 2,87 kg/settimana» (soglia 1.5) ferma in elenco da **tre
    // settimane**, senza destinatario e senza che sia partita una sola notifica. Il motore aveva
    // fatto il suo lavoro; era il destinatario a non esistere.
    //
    // `dedupe: false` perché il controllo l'abbiamo già fatto qui sopra, ed è più fine del suo:
    // guarda il MOTIVO («Calo rapido»), non la categoria. Col dedupe per categoria una segnalazione
    // clinica aperta per un altro motivo avrebbe zittito questa.
    const decisione = await decidiRiapertura(this.prisma as never, {
      clientId,
      motivoContiene: 'Calo rapido',
      gravita: rate,
      finestraGiorni,
      peggioramentoMinimo,
    });
    if (!decisione.apri) {
      // Si torna `true` comunque: il guardrail ha visto il calo rapido, e chi chiama usa questo
      // valore per sapere se la condizione c'è — non se è partita una notifica.
      this.logger.log(`Calo rapido per ${clientId}: non riaperta — ${decisione.motivo}`);
      return true;
    }

    await apriSegnalazione(this.prisma as never, {
      clientId,
      // R12: calo rapido = sicurezza clinica → nutrizionista, e se non c'è chi ne risponde.
      category: 'clinical',
      reason: `Calo rapido: ${rate} kg/settimana sulle ultime rilevazioni (soglia ${threshold}). Verificare calorie ed energia.`,
      source: 'engine',
      // `gravita` è il ritmo di calo: si scrive sulla riga (`severity`) ed è il numero con cui il
      // prossimo controllo capirà se la cosa è peggiorata.
      gravita: rate,
      // `dedupe: false` perché la decisione l'abbiamo già presa qui sopra, e la nostra è più fine
      // della sua: guarda il MOTIVO («Calo rapido») e non la categoria `clinical`, altrimenti una
      // segnalazione clinica aperta per un altro motivo zittirebbe questa.
      dedupe: false,
    });
    await this.audit.log({
      action: 'signals.rapid_loss_alert',
      actorId: clientId,
      entityType: 'escalation',
      metadata: { rate, threshold },
    });
    return true;
  }

  /** Traguardi automatici: prima misura, -1/-3/-5 kg, metà strada, obiettivo raggiunto. */
  /**
   * R12 — Nessun progresso: se abilitato (config `no_progress_escalation`) e la cliente
   * è in stallo (oltre `stall_days_before_coach_alert`), apre una segnalazione
   * "Nessun progresso" instradata al nutrizionista (coach informata). Idempotente.
   */
  private async checkNoProgress(clientId: string): Promise<void> {
    const enabled = await this.configParams.getBool('no_progress_escalation', false);
    if (!enabled) return;
    try {
      const p = (await this.progress.getProgress(clientId)) as { alerts?: { stalled?: boolean; stallDays?: number } };
      if (!p.alerts?.stalled) return;
      await this.routing.open({
        clientId,
        category: 'no_progress',
        reason: `Nessun progresso: peso fermo da ${p.alerts.stallDays ?? '?'} giorni. Rivedere piano e aderenza.`,
        source: 'engine',
        dedupe: true,
      });
    } catch {
      /* mai bloccare il salvataggio della misura */
    }
  }

  /**
   * R12 — Scarsa aderenza (cron giornaliero): per le clienti attive che avevano un
   * check-in ma non ne fanno da `low_adherence_days` giorni, apre una segnalazione
   * alla coach. Config 0 = spenta. Idempotente per (cliente, categoria).
   */
  async runAdherenceSweep(): Promise<{ opened: number; days: number }> {
    const days = await this.configParams.getNumber('low_adherence_days', 0);
    if (days <= 0) return { opened: 0, days: 0 };
    const since = new Date(Date.now() - days * 86_400_000);
    const clients = (await this.prisma.user.findMany({
      where: { role: 'client', status: 'active', deletedAt: null },
      select: { id: true },
    })) as { id: string }[];
    let opened = 0;
    for (const c of clients) {
      const last = (await this.prisma.dailyCheckin.findFirst({
        where: { clientId: c.id },
        orderBy: { date: 'desc' },
        select: { date: true },
      })) as { date: Date } | null;
      if (!last || last.date >= since) continue; // mai iniziato o check-in recente
      try {
        await this.routing.open({
          clientId: c.id,
          category: 'low_adherence',
          reason: `Scarsa aderenza: nessun check-in da almeno ${days} giorni.`,
          source: 'coach',
          dedupe: true,
        });
        opened++;
      } catch {
        /* prosegue con le altre clienti */
      }
    }
    return { opened, days };
  }

  /**
   * I traguardi appena raggiunti — **con la loro etichetta**, non solo il codice (16/8).
   *
   * ⚠️ Le etichette sono già scritte qui sopra (`MILESTONE_DEFS` e le due dell'obiettivo) e sono
   * parole che legge la cliente: farle uscire di qui è ciò che evita una seconda copia delle stesse
   * frasi dentro l'app — e fra un anno due frasi diverse per lo stesso traguardo.
   */
  private async evaluateMilestones(clientId: string): Promise<{ type: string; label: string }[]> {
    const [profile, objective, count, ultimePesate, finestra] = await Promise.all([
      this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: { startWeightKg: true },
      }),
      this.prisma.objective.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        select: { targetWeightKg: true },
      }),
      this.prisma.measurement.count({ where: { clientId } }),
      /**
       * ⚠️ **Le ultime pesate, non l'ultima** (19/8). I traguardi si calcolavano sul peso di
       * stamattina, mentre la barra «verso il tuo obiettivo» — nella **stessa schermata** — passa
       * dalla media mobile. Risultato: «**-5 kg: che traguardo!**» sopra una barra che dice 43%, e
       * ⚠️ un traguardo **si scrive una volta sola e resta**: il giorno dopo non si corregge.
       *
       * Il caso peggiore è «Obiettivo raggiunto! 🎉» dato su una pesata sotto il target mentre la
       * tendenza è ancora sopra: quella frase, a una persona, si dice una volta.
       */
      this.prisma.measurement.findMany({
        where: { clientId },
        orderBy: { date: 'desc' },
        take: FINESTRA_MASSIMA,
        select: { weightKg: true },
      }),
      this.configParams.getNumber('moving_average_window', 3),
    ]);

    const earned: { type: string; label: string }[] = [];
    if (count >= 1) earned.push({ type: 'first_measurement', label: 'Prima misura registrata: si parte!' });

    // Dalla più recente alla più vecchia → il modulo le vuole in ordine di data.
    const pesi = (ultimePesate as { weightKg: number }[]).map((m) => m.weightKg).reverse();
    const avanzamento = avanzamentoPeso(pesi, profile?.startWeightKg ?? null, objective?.targetWeightKg ?? null, finestra);
    if (profile?.startWeightKg && avanzamento.pesoDiAdesso !== null) {
      const lost = avanzamento.persiKg ?? 0;
      for (const def of MILESTONE_DEFS) {
        if (def.lostKg && lost >= def.lostKg) earned.push({ type: def.type, label: def.label });
      }
      if (objective?.targetWeightKg) {
        const total = profile.startWeightKg - objective.targetWeightKg;
        if (total > 0 && lost >= total / 2) {
          earned.push({ type: 'halfway', label: 'Metà strada: continua così!' });
        }
        if (avanzamento.pesoDiAdesso <= objective.targetWeightKg) {
          earned.push({ type: 'goal_reached', label: 'Obiettivo raggiunto! 🎉' });
        }
      }
    }

    // ⚠️ `skipDuplicates`: un traguardo si raggiunge UNA volta sola, e `result.count` è quello che
    // distingue «l'ha appena raggiunto» da «ce l'aveva già». Solo i primi si dicono.
    const created: { type: string; label: string }[] = [];
    for (const m of earned) {
      const result = await this.prisma.milestone.createMany({
        data: [{ clientId, type: m.type, label: m.label }],
        skipDuplicates: true,
      });
      if (result.count > 0) created.push(m);
    }
    return created;
  }

  async listMilestones(clientId: string) {
    return this.prisma.milestone.findMany({
      where: { clientId },
      orderBy: { achievedAt: 'desc' },
    });
  }

  // ---------- Check-in giornaliero (segnale Testa) ----------

  async listCheckins(clientId: string, from?: string, to?: string) {
    return this.prisma.dailyCheckin.findMany({
      where: {
        clientId,
        ...(from || to
          ? { date: { ...(from ? { gte: toDateOnly(from) } : {}), ...(to ? { lte: toDateOnly(to) } : {}) } }
          : {}),
      },
      orderBy: { date: 'desc' },
      take: 90,
    });
  }

  async upsertCheckin(clientId: string, dto: CreateCheckinDto) {
    const date = toDateOnly(dto.date);
    if (date.getTime() > toDateOnly().getTime()) {
      throw new BadRequestException('Non puoi fare il check-in nel futuro');
    }
    return this.prisma.dailyCheckin.upsert({
      where: { clientId_date: { clientId, date } },
      create: {
        clientId,
        date,
        mood: dto.mood as never,
        energy: dto.energy,
        hunger: dto.hunger,
        stress: dto.stress,
      },
      update: {
        mood: dto.mood as never,
        energy: dto.energy,
        hunger: dto.hunger,
        stress: dto.stress,
      },
    });
  }

  /**
   * "Salta per oggi" sul popup del check-in.
   *
   * Registrato, non tenuto solo in memoria: prima il tasto chiamava `setDismissed(true)` dentro
   * la Home, e quello stato moriva insieme al componente — bastava passare dal Menu e tornare
   * indietro per rivedere il popup, nonostante l'etichetta dicesse "per oggi".
   *
   * Idempotente: `upsert` sulla coppia (cliente, giorno), così riaprire l'app o toccare "Salta"
   * più volte non crea righe doppie. Vale solo per OGGI di proposito — domani il popup torna,
   * perché il check-in resta il segnale "Testa" del percorso e saltarlo una volta non è
   * rinunciarci. Chi non lo vuole più ha l'interruttore "Promemoria del check-in" nelle preferenze.
   */
  async skipCheckinToday(clientId: string) {
    const date = toDateOnly();
    await this.prisma.checkinSkip.upsert({
      where: { clientId_date: { clientId, date } },
      create: { clientId, date },
      update: {},
    });
    return { skipped: true, date: date.toISOString().slice(0, 10) };
  }

  /** Per il popup "una volta al giorno, alla prima apertura". */
  async todayStatus(clientId: string) {
    const today = toDateOnly();
    const [checkin, checkinSkip, measurement, water, steps, profile] = await Promise.all([
      this.prisma.dailyCheckin.findUnique({ where: { clientId_date: { clientId, date: today } } }),
      this.prisma.checkinSkip.findUnique({ where: { clientId_date: { clientId, date: today } } }),
      this.prisma.measurement.findUnique({ where: { clientId_date: { clientId, date: today } } }),
      this.prisma.waterLog.findUnique({ where: { clientId_date: { clientId, date: today } } }),
      this.prisma.stepLog.findUnique({ where: { clientId_date: { clientId, date: today } } }),
      this.prisma.clientProfile.findUnique({ where: { userId: clientId }, select: { objective: true } }),
    ]);
    const [waterGoal, stepsGoal] = await Promise.all([
      this.waterGoalFor(clientId),
      this.stepsGoalFor(clientId),
    ]);
    // Il check-in si chiede SOLO a chi ha un percorso in corso (richiesta Simone 5/8, voce #1).
    // A piano scaduto o mai comprato, «Come ti senti oggi?» è una domanda senza seguito: nessuno
    // legge quella risposta, e alla cliente sembra che l'app le chieda conto di un percorso che
    // non ha. Durante una PAUSA il piano resta attivo, quindi il check-in continua: è voluto,
    // è l'unico filo che resta teso mentre i menu sono sospesi.
    // ⚠️ Anche i piani in coda (19/8, voce 258): «Come ti senti oggi?» ha senso per chi ha comprato
    // e sta per cominciare — ed è quello che succedeva fino al 18/8, quando la coda era scritta
    // `active`. Toglierlo avrebbe spento il check-in a chi ha appena pagato.
    const subs = (await this.prisma.subscription.findMany({
      where: { clientId, status: { in: STATI_CON_UN_PIANO as never } },
      select: { endDate: true },
    })) as { endDate: Date | null }[];
    const hasActivePlan = subs.some((s) => !s.endDate || s.endDate.getTime() >= today.getTime());
    return {
      date: today.toISOString().slice(0, 10),
      checkinDone: Boolean(checkin),
      checkin,
      // Distinto da checkinDone: il popup non si mostra in nessuno dei due casi, ma solo il primo
      // è un check-in. Chi legge l'aderenza deve guardare checkinDone, mai questo.
      checkinSkipped: Boolean(checkinSkip),
      hasActivePlan,
      // Unico interruttore per l'app: se è false, il popup non si mostra. Così la regola sta
      // nel dominio e non sparsa nel frontend.
      checkinDue: hasActivePlan && !checkin && !checkinSkip,
      measurementDone: Boolean(measurement),
      water: water ?? { glasses: 0, goal: waterGoal },
      steps: steps ?? { steps: 0, goal: stepsGoal },
      // Fase attuale del cliente (dimagrimento | mantenimento), gestita dallo staff.
      objective: profile?.objective ?? null,
    };
  }

  // ---------- Acqua e passi (segnale Vita) ----------

  /**
   * Obiettivo giornaliero d'acqua PERSONALIZZATO sul peso della cliente, espresso
   * in BICCHIERI da 250 ml (stessa unità di storage delle unità display: 1 bicchiere
   * = 250 ml, le bottiglie sono solo un modo di visualizzarlo — app/src/lib/water.ts).
   * Formula: ~33 ml/kg (`water_ml_per_kg`, admin-configurabile) diviso il volume di
   * un bicchiere da cucina (250 ml), arrotondato e limitato a un intervallo sensato
   * (6–16 bicchieri = 1,5–4 L). Peso preso dall'ultima misura, poi dal peso iniziale
   * del profilo; se il peso non è noto si usa il globale `water_goal_glasses` (8 = 2 L).
   */
  /**
   * L'OBIETTIVO PASSI DI QUESTA CLIENTE — su misura, non uno per tutte (Simone, 12/8).
   *
   * Parte dalla sua fascia di attività (quella del questionario, la stessa che decide il fabbisogno
   * calorico) e sale del 5% ogni due settimane di percorso, con un tetto. La regola sta in
   * `common/obiettivo-passi.ts` col perché di ogni numero.
   *
   * ⚠️ Non lancia mai: se il profilo non si legge si torna al globale. Un obiettivo passi che fa
   * fallire il salvataggio dei passi sarebbe il modo peggiore di personalizzarlo.
   */
  private async stepsGoalFor(clientId: string): Promise<number> {
    const base = await this.configParams.getNumber('steps_goal', 8000).catch(() => 8000);
    try {
      const p = (await this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: { activityLevel: true, planStartDate: true },
      })) as { activityLevel: string | null; planStartDate: Date | null } | null;
      const giorniDiPercorso = p?.planStartDate
        ? Math.floor((Date.now() - p.planStartDate.getTime()) / 86_400_000)
        : 0;
      return obiettivoPassi({ activityLevel: p?.activityLevel ?? null, giorniDiPercorso }, base);
    } catch {
      return base;
    }
  }

  private async waterGoalFor(clientId: string): Promise<number> {
    const [mlPerKg, fallback] = await Promise.all([
      this.configParams.getNumber('water_ml_per_kg', 33),
      this.configParams.getNumber('water_goal_glasses', 8),
    ]);
    const [lastMeasure, profile] = await Promise.all([
      this.prisma.measurement.findFirst({ where: { clientId }, orderBy: { date: 'desc' }, select: { weightKg: true } }),
      this.prisma.clientProfile.findUnique({ where: { userId: clientId }, select: { startWeightKg: true } }),
    ]);
    const weight = lastMeasure?.weightKg ?? profile?.startWeightKg ?? null;
    // La regola sta in `common/obiettivo-acqua.ts` dal 12/8: la usa anche il report, che prima si
    // calcolava i litri per conto suo con un 30 scritto a mano — due obiettivi diversi per la stessa
    // persona, nella stessa app.
    return bicchieriObiettivo(weight, mlPerKg) ?? fallback;
  }

  /**
   * ⚠️ L'UNITÀ SI SCRIVE SULLA RIGA, come l'obiettivo (vedi `upsertSteps` qui sotto): la
   * preferenza in `prefs.waterUnit` dice come conta ADESSO, e la cliente può cambiarla stasera —
   * leggendo il passato con la preferenza di oggi si racconterebbero in bottiglie giornate contate
   * a bicchieri. Se il tap arriva da un'app che l'unità non la manda, quella già scritta **resta**:
   * cancellarla vorrebbe dire perdere l'unica cosa che quel giorno sapeva di sé.
   */
  async upsertWater(clientId: string, dto: CreateWaterDto) {
    const date = toDateOnly(dto.date);
    const goal = await this.waterGoalFor(clientId);
    const unit = eUnitaAcqua(dto.unit) ? dto.unit : undefined;
    return this.prisma.waterLog.upsert({
      where: { clientId_date: { clientId, date } },
      create: { clientId, date, glasses: dto.glasses, goal, ...(unit ? { unit } : {}) },
      update: { glasses: dto.glasses, ...(unit ? { unit } : {}) },
    });
  }

  async upsertSteps(clientId: string, dto: CreateStepsDto) {
    const date = toDateOnly(dto.date);
    // ⚠️ L'obiettivo si scrive sulla RIGA del giorno: il numero di oggi resta quello di oggi anche
    // quando fra due settimane sale. Senza, guardando indietro sembrerebbe che abbia mancato
    // obiettivi che allora non le erano mai stati chiesti.
    const goal = await this.stepsGoalFor(clientId);
    return this.prisma.stepLog.upsert({
      where: { clientId_date: { clientId, date } },
      create: { clientId, date, steps: dto.steps, goal, source: dto.source ?? 'manual' },
      update: { steps: dto.steps, ...(dto.source ? { source: dto.source } : {}) },
    });
  }

  /**
   * Dati per il WIDGET da home screen (nativo iOS/Android): stato mascotte in base
   * all'ora, saluto, frase del giorno, prossimo pasto, acqua/passi e progresso.
   * Endpoint di sola lettura, pensato per essere chiamato dal widget con il token cliente.
   */
  async widget(clientId: string) {
    const FRASI = [
      'Non è una dieta, è il tuo nuovo stile.',
      'Un passo alla volta è comunque un passo avanti.',
      'I piccoli gesti di oggi sono i risultati di domani.',
      'Bevi, respira, muoviti: il resto viene.',
      'Sii gentile con te: stai già facendo tanto.',
      'La costanza batte la perfezione.',
    ];
    const [profile, user, todayStatus] = await Promise.all([
      this.prisma.clientProfile.findUnique({ where: { userId: clientId }, select: { name: true } }),
      this.prisma.user.findUnique({ where: { id: clientId }, select: { firstName: true, prefs: true } }),
      this.todayStatus(clientId),
    ]);
    const name = (profile?.name ?? user?.firstName ?? '').trim();
    // Unità acqua scelta dal cliente (per il widget: icona + valore come in dashboard).
    const prefs = (user?.prefs as Record<string, unknown> | null) ?? {};
    const waterUnit = ['glass', 'bottle05', 'bottle1', 'bottle15'].includes(prefs.waterUnit as string) ? (prefs.waterUnit as string) : 'glass';
    const now = new Date();
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(now));
    const day = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', day: '2-digit' }).format(now));

    const state = hour < 11 ? 'buongiorno' : hour < 14 ? 'inrotta' : hour < 17 ? 'acqua' : hour < 21 ? 'passi' : 'buonanotte';
    const greetings: Record<string, string> = {
      buongiorno: name ? `Buongiorno, ${name}!` : 'Buongiorno!',
      inrotta: name ? `Sei in rotta, ${name}!` : 'Sei in rotta!',
      acqua: name ? `Bevi un po', ${name}` : 'Bevi un po\'',
      passi: 'Muoviti un po\'!',
      buonanotte: name ? `Buonanotte, ${name}` : 'Buonanotte',
    };
    const phrase = FRASI[day % FRASI.length];

    // Prossimo pasto di oggi in base all'ora.
    const today = toDateOnly();
    const menuDay = await this.prisma.menuDay.findUnique({ where: { clientId_date: { clientId, date: today } } });
    const meals = (menuDay?.meals ?? []) as { slot: string; name: string; kcal: number }[];
    const SLOT_HOURS: [string, number][] = [['breakfast', 10], ['morning_snack', 11], ['lunch', 14], ['afternoon_snack', 17], ['dinner', 21]];
    let nextMeal: { slot: string; name: string; kcal: number } | null = null;
    for (const [slot, h] of SLOT_HOURS) {
      if (hour < h) {
        const m = meals.find((x) => x.slot === slot);
        if (m) { nextMeal = { slot, name: m.name, kcal: m.kcal }; break; }
      }
    }

    /**
     * Progresso verso l'obiettivo peso.
     *
     * ⚠️ **Il conto è quello di `percentuale-obiettivo.ts`** (19/8): qui c'era un calcolo suo,
     * sull'**ultima pesata**, mentre il motore e l'allarme di stallo leggevano la media mobile.
     * Stessa cliente, stessa domanda, due numeri — e quello che vedeva lei era il più ballerino:
     * due etti di ritenzione e la home diceva che era tornata indietro.
     */
    const [misure, objective, finestra, profilo] = await Promise.all([
      this.prisma.measurement.findMany({ where: { clientId }, orderBy: { date: 'asc' }, select: { weightKg: true } }),
      this.prisma.objective.findFirst({ where: { clientId }, orderBy: { createdAt: 'desc' }, select: { targetWeightKg: true } }),
      this.configParams.getNumber('moving_average_window', 3),
      this.prisma.clientProfile.findUnique({ where: { userId: clientId }, select: { startWeightKg: true } }),
    ]);
    const avanzamento = avanzamentoPeso(
      (misure as { weightKg: number }[]).map((m) => m.weightKg),
      (profilo as { startWeightKg: number | null } | null)?.startWeightKg ?? null,
      objective?.targetWeightKg ?? null,
      finestra,
    );
    const weightLostKg = avanzamento.persiKg;
    /**
     * ⚠️ **Intero**, e solo qui: il widget nativo è un riquadro di due centimetri, il suo contratto
     * dice `progressPercent: 60` (`docs/Widget_Nativo_Guida.md`) e «43,3%» lì dentro non ci sta.
     * ⚠️ È un **arrotondamento di presentazione**, non un secondo conto: il numero è quello di
     * `avanzamentoPeso`, e questa riga tocca solo come si scrive.
     */
    const progressPercent = avanzamento.percento === null ? null : Math.round(avanzamento.percento);

    // Streak: giorni consecutivi con check-in fino a oggi.
    const recent = await this.prisma.dailyCheckin.findMany({
      where: { clientId }, orderBy: { date: 'desc' }, take: 60, select: { date: true },
    });
    const done = new Set((recent as { date: Date }[]).map((c) => c.date.toISOString().slice(0, 10)));
    let streak = 0;
    let cur = new Date(today);
    while (done.has(cur.toISOString().slice(0, 10))) {
      streak++;
      cur = new Date(cur.getTime() - 86_400_000);
    }

    return {
      name,
      state,
      greeting: greetings[state],
      phrase,
      nextMeal,
      water: todayStatus.water,
      waterUnit,
      steps: todayStatus.steps,
      weightLostKg,
      progressPercent,
      streak,
      updatedAt: now.toISOString(),
    };
  }
}
