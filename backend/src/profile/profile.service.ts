import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { combinazioneImpossibile } from '../catalog/appartenenza-panieri';
import { laBaseVaRifatta } from '../common/base-personale-da-rifare';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { validateObjective } from '../onboarding/objective-validator';
import { PersonalBaseService } from '../personal-base/personal-base.service';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EU_ALLERGEN_CODES } from '../catalog/allergens';
import { apriRichiestaVera } from '../vera/apri-richiesta';
import { apriServeVisita } from '../clients/serve-visita';
import { apriSegnalazione } from '../escalations/apri-segnalazione';
import { vaSospesoSubito, type RisposteDigiuno } from '../menu/digiuno-si-puo';
import { STATI_CON_UN_PIANO } from '../commerce/stati-abbonamento';
import { type RispostaAllergie, dichiarazione, haRisposto } from './dichiara-allergie';
import { esclusioniCliente } from './esclusioni-cliente';
import { subscriptionEnd, pickMainSubscription } from '../commerce/commerce.service';
import { ORIGINE_INIZIO } from '../commerce/origine-data-inizio';
import { statoPerGiornoDiInizio } from '../commerce/stati-abbonamento';
import { campiCambiati } from '../common/diff-campi';
import { fraseAiutoEsclusioni, problemiEsclusioni } from '../common/esclusioni-scritte-bene';
import { EsitoSpezia, filtraSpezie } from '../menu/spezie';
import { UpdateObjectiveDto, UpdateProfileDto } from './dto/update-profile.dto';
import { toDateOnly } from '../common/date-only';
import { dietaMostrataPer, nomePerLaCliente } from '../catalog/dieta-mostrata';
// ─── L'orologio del digiuno (21/8) ───────────────────────────────────────────────────────────
import { PushService } from '../notifications/push.service';
import { apriAttivitaCoach } from '../coach-tasks/porta-delle-attivita';
import {
  TIPO_DIGIUNO_ESTREMO,
  TIPO_FINESTRA_NON_TRADUCIBILE,
  riferimentoDigiunoEstremo,
  riferimentoNonTraducibile,
  scadenzaVerifica,
  testoDigiunoEstremo,
  testoFinestraNonTraducibile,
} from '../coach-tasks/verifica-digiuno';
import {
  PASSO_GRADUALE_PREDEFINITO,
  GIORNI_FRA_DUE_PROTOCOLLI,
  decidiCambio,
  passoDiStanotte,
  primaScelta,
  type EsitoCambio,
} from '../menu/cambio-finestra';
import { PROPOSTE_DA_FINESTRA_STORICA, motivoPerLaNutrizionista } from '../menu/chiedi-la-finestra';
import { derivaDaOrologio, oraDelGiorno, protocolloDigiuno } from '../menu/orologio-digiuno';
import { fasceDelDigiuno, vistaOrologio, type ProfiloDigiuno } from '../menu/vista-orologio';
import { orologioAzzerato, restaQualcosaDellOrologio } from '../menu/uscita-dal-digiuno';
import { oraLocaleInMinuti } from '../common/date-only';

/** Il client dentro una transazione: stessa forma usata in `commerce` e `finance`. */
type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
    private readonly personalBase: PersonalBaseService,
    // ⚠️ L'attività della nutrizionista nasce da `apriAttivitaCoach`, che crea e avvisa insieme:
    // senza la push l'attività comparirebbe in elenco e basta, cioè nessuno la vedrebbe.
    private readonly push: PushService,
  ) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId },
      include: {
        assignedCoach: { select: { id: true, displayName: true } },
        assignedNutritionist: { select: { id: true, displayName: true } },
      },
    });
    if (!profile) {
      throw new NotFoundException('Profilo non ancora creato: completa prima il questionario.');
    }
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const current = await this.getProfile(userId); // 404 se manca

    /**
     * ⛔ **LE COMBINAZIONI CHE NON SI POSSONO FARE SI FERMANO QUI** (Fase 5 del piano panieri,
     * decisione del 31/8). Keto e vegano insieme non è una dieta magra di ricette: **non è una
     * dieta**. Fino a oggi chi la sceglieva otteneva un paniere vuoto — che sembra un problema
     * temporaneo, e nessuno lo guarda.
     *
     * ⚠️ Si controlla la coppia che RESTA dopo questa modifica, non quella che arriva: chi cambia
     * solo il regime lascerebbe la famiglia com'era, e guardare il solo campo nuovo farebbe passare
     * proprio il caso in cui la combinazione nasce — una vegana che passa alla keto.
     */
    const famigliaDopo = dto.dietFamily !== undefined ? dto.dietFamily : (current as { dietFamily?: string | null }).dietFamily;
    const regimeDopo = dto.regime !== undefined ? dto.regime : (current as { regime?: string | null }).regime;
    const impossibile = combinazioneImpossibile(famigliaDopo, regimeDopo);
    if (impossibile) throw new BadRequestException(impossibile);
    const { lifestyle, consents, planStartDate, locale, ...rest } = dto;
    // Rete di sicurezza sulle spezie: la strada normale è `/me/menu/substitute`, che ha già il
    // suo cancello, ma questa PATCH riceve la lista INTERA dei cibi esclusi (Profilo → "Cibi
    // esclusi", e le app vecchie). Senza il filtro qui, una spezia rientrerebbe dalla finestra.
    // Vedi `menu/spezie.ts`.
    let avvisiSpezie: EsitoSpezia[] = [];
    /**
     * ⚠️ AIUTARE A SCRIVERE L'ELENCO (decisione di Simone, 18/8): «le esclusioni devono essere un
     * elenco, ogni parola seguita da una virgola, aiutiamo le clienti a scrivere in modo corretto».
     *
     * Si guarda quello che è arrivato **prima** del filtro spezie, e ⚠️ **non si corregge niente**:
     * si torna la frase da mostrare a chi ha appena scritto. Correggere da soli sarebbe l'errore
     * peggiore proprio qui — su «pesce tranne salmone» la correzione più ovvia (tenere la prima
     * parola) escluderebbe TUTTO il pesce, salmone compreso, cioè il contrario di quello che voleva.
     */
    const aiutoEsclusioni = Array.isArray(rest.dislikedFoods)
      ? fraseAiutoEsclusioni(problemiEsclusioni(rest.dislikedFoods))
      : null;
    if (Array.isArray(rest.dislikedFoods)) {
      const filtrati = filtraSpezie(rest.dislikedFoods);
      rest.dislikedFoods = filtrati.tenuti;
      avvisiSpezie = filtrati.avvisi;
    }
    // La data d'inizio piano viene impostata dalla cliente (StartDatePrompt) SOLO la prima volta
    // (quando è ancora vuota). In quel caso va allineata anche la subscription: altrimenti la
    // prova, attivata al pagamento con la data di allora, scade sulle date vecchie mentre l'inizio
    // piano dice un'altra data ("Nessun piano attivo" pur avendo iniziato da poco).
    /**
     * ⚠️ **NON SOLO LA PRIMA VOLTA** (19/8, terza revisione della voce 258). Qui c'era
     * `firstStartSet`: si allineava l'abbonamento solo quando `planStartDate` era ancora vuota. Ma
     * una cliente **di ritorno** ce l'ha già (dal piano vecchio, con una data passata), quindi dopo
     * il pagamento l'app le rimostra il calendario e lei sceglie: la data finiva nel profilo e
     * l'abbonamento restava com'era. Finché la finestra dei menu si misurava sul profilo la cosa
     * passava inosservata; da quando si misura sull'abbonamento — che è giusto, perché il profilo
     * può parlare di un altro piano — la sua scelta non muoveva più niente e i menu partivano
     * quando volevano loro.
     *
     * ⚠️ Solo finché **non ha ricevuto un solo menu**: dopo, la data d'inizio non è più una
     * preferenza ma un fatto, e riscriverla da qui sposterebbe anche la scadenza di un piano già
     * cominciato. Chi vuole spostare un piano partito passa dalla scheda cliente, dove c'è
     * l'avviso delle sovrapposizioni.
     */
    const dataCambiata =
      !!planStartDate &&
      new Date(planStartDate).getTime() !== ((current as { planStartDate: Date | null }).planStartDate?.getTime() ?? NaN);
    if (locale) {
      await this.prisma.user.update({ where: { id: userId }, data: { locale } });
    }
    /**
     * ⛔ **LA QUARTA PORTA SUL DIGIUNO — quella che nessuno aveva chiuso** (revisione 21/8).
     *
     * Questo DTO accetta `pathType`. Quindi una cliente, **col proprio token**, può uscire dal
     * digiuno da qui — e fino a oggi si portava dietro protocollo, orario, bersagli e
     * `fastingSceltoIl` intatti, perché il servizio scrive `...rest` alla cieca.
     *
     * ⚠️ Il ritorno al digiuno, poi, era il difetto per intero: `fastingSceltoIl` pieno vuol dire
     * «gliel'abbiamo già chiesto», quindi la pagina dell'orologio non le si riapriva e si ritrovava
     * addosso la finestra di sei mesi prima senza che nessuno l'avesse decisa.
     *
     * ⚠️ È **la stessa regola** della scheda staff, dell'onboarding e dello script — stesso elenco,
     * stessa domanda. Quattro porte sullo stesso dato: una guardia messa su tre non è una guardia,
     * è una statistica.
     *
     * ⚠️ Nessun permesso e nessun blocco: cambiare percorso è suo diritto. L'azzeramento è una
     * **conseguenza**, e resta scritta nell'audit `profile.update` insieme al resto.
     */
    const usciraDalDigiuno =
      rest.pathType !== undefined
      && rest.pathType !== 'intermittent_fasting'
      && restaQualcosaDellOrologio(current as unknown as Record<string, unknown>);
    const profile = await this.prisma.clientProfile.update({
      where: { userId },
      data: {
        ...(rest as Record<string, unknown>),
        ...(usciraDalDigiuno ? orologioAzzerato() : {}),
        ...(lifestyle ? { lifestyle: lifestyle as never } : {}),
        ...(consents ? { consents: consents as never } : {}),
        ...(planStartDate
          ? {
              planStartDate: new Date(planStartDate),
              // ⚠️ **E da dove viene**: la sceglie lei, quindi è un GIORNO. Senza questa riga la data
              // resta ambigua per chi la deve trasformare in uno stato (`origine-data-inizio.ts`).
              planStartOrigine: ORIGINE_INIZIO.GIORNO,
            }
          : {}),
      } as never,
    });
    /**
     * COSA ha cambiato la cliente dall'app, non solo QUALI campi ha toccato.
     *
     * Prima qui c'era `fields: Object.keys(dto)` — l'elenco dei nomi, senza i valori — e in scheda
     * cliente il log mostrava «Modifica dati (dal cliente)» e nient'altro (richiesta di Simone del
     * 10/8: «altrimenti non serve a nulla»).
     *
     * `entityId` è ora l'**utente** e non il profilo: il log delle modifiche cerca gli audit per
     * `entityId` fra l'id del lead e quello dell'utente, quindi con l'id del profilo queste righe
     * non comparivano affatto nel log del lead. L'id del profilo resta nel metadata.
     */
    const campi = campiCambiati(
      current as unknown as Record<string, unknown>,
      { ...(rest as Record<string, unknown>), ...(planStartDate ? { planStartDate: new Date(planStartDate) } : {}) },
      [...Object.keys(rest), ...(planStartDate ? ['planStartDate'] : [])],
    );
    await this.audit.log({
      action: 'profile.update',
      actorId: userId,
      entityType: 'client_profile',
      entityId: userId,
      metadata: { campi, profileId: profile.id, origine: 'app', nessunCambio: campi.length === 0 },
    });

    // Data d'inizio scelta o cambiata prima del primo menu → allinea la subscription (date + stato).
    const primoMenuGiaErogato = dataCambiata
      ? (await this.prisma.menuDay.count({ where: { clientId: userId } })) > 0
      : true;
    if (dataCambiata && !primoMenuGiaErogato && planStartDate) {
      await this.alignSubscriptionToPlanStart(userId, new Date(planStartDate)).catch(() => {
        /* non bloccare il salvataggio del profilo per un errore di allineamento */
      });
    }

    /**
     * Se cambia qualcosa che sposta **quali ricette** la cliente può ricevere, la base personale
     * sicura si rifà. ⚠️ La condizione sta in `common/base-personale-da-rifare.ts`: qui era scritta
     * a mano e guardava **quattro** campi mentre `buildPersonalBase` ne legge dieci — chi passava da
     * 5 a 3 pasti, o si vedeva aggiungere un'allergia, restava con la base di prima.
     *
     * ⚠️ E si guardano i campi **davvero cambiati** (`campi`, già calcolato per l'audit qui sopra),
     * non quelli mandati: il form rimanda tutto a ogni Salva.
     */
    if (laBaseVaRifatta(campi.map((c) => c.campo))) {
      try {
        await this.personalBase.buildPersonalBase(userId);
      } catch (e) {
        /**
         * ⛔ **Non bloccante, ma non muto.** Il `catch {}` vuoto che c'era qui è il motivo per cui
         * una base non rifatta è invisibile: il salvataggio riesce, la cliente non vede niente, e
         * il disallineamento si scopre contando a mano. Non far fallire la scheda è giusto; non
         * dire niente no.
         */
        this.logger.warn(
          `Base personale non rifatta per ${userId} dopo un salvataggio dall'app: `
          + `${e instanceof Error ? e.message : String(e)}. I cambi in chat pescheranno dai dati di prima.`,
        );
      }
    }
    return {
      ...profile,
      ...(avvisiSpezie.length ? { avvisiSpezie } : {}),
      // ⚠️ Il campo c'è solo quando c'è qualcosa da dire: un avviso che compare sempre non è un avviso.
      ...(aiutoEsclusioni ? { aiutoEsclusioni } : {}),
    };
  }

  /**
   * Allinea l'abbonamento "principale" (attivo > in attesa > scaduto > annullato) alla data
   * d'inizio piano scelta dalla cliente: ricalcola la fine dalla durata del piano e, se la nuova
   * fine è nel futuro e l'abbonamento era già approvato (attivo/scaduto), lo riattiva. Evita che
   * la prova risulti "scaduta" perché attivata con una data diversa da quella poi scelta.
   */
  private async alignSubscriptionToPlanStart(userId: string, d: Date): Promise<void> {
    const subs = (await this.prisma.subscription.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, status: true, startDate: true, endDate: true, plan: { select: { period: true } } },
    })) as { id: string; status: string; startDate: Date | null; endDate: Date | null; plan: { period: string } }[];
    const sub = pickMainSubscription(subs);
    if (!sub) return;
    const newEnd = subscriptionEnd(d, sub.plan.period);
    /**
     * ⚠️ `queued` è fra gli stati che si riscrivono, e lo stato nuovo lo decide `statoPerInizio`
     * (19/8, voce 258): la data scelta dalla cliente in fondo al questionario può essere oggi —
     * e allora il piano deve partire adesso, non alla passata notturna — oppure fra tre settimane,
     * e allora il piano va in coda. Prima qui si scriveva sempre `active`, cioè la parola che dice
     * due cose.
     */
    const daRiscrivere = newEnd.getTime() > Date.now() && ['active', 'queued', 'expired'].includes(sub.status);
    // ⚠️ `d` è un GIORNO (`new Date('2026-08-23')`), non un istante: vedi `statoPerGiornoDiInizio`.
    const statoNuovo = statoPerGiornoDiInizio(d);
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { startDate: d, endDate: newEnd, ...(daRiscrivere ? { status: statoNuovo as never } : {}) },
    });
    await this.audit.log({
      action: 'profile.plan_start.align_subscription',
      actorId: userId,
      entityType: 'subscription',
      entityId: sub.id,
      metadata: {
        clientId: userId,
        startDate: d.toISOString().slice(0, 10),
        endDate: newEnd.toISOString().slice(0, 10),
        ...(daRiscrivere ? { status: statoNuovo, reactivated: statoNuovo === 'active' } : {}),
      },
    });
  }

  async updateTheme(userId: string, color: string) {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      throw new BadRequestException('Colore non valido: usa il formato #RRGGBB');
    }
    return this.prisma.clientProfile.update({
      where: { userId },
      data: { themeColor: color },
      select: { id: true, themeColor: true },
    });
  }

  async getObjective(userId: string) {
    const objective = await this.prisma.objective.findFirst({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!objective) throw new NotFoundException('Nessun obiettivo: completa prima il questionario.');
    return objective;
  }

  /**
   * Aggiorna l'obiettivo con la stessa validazione di ritmo dell'onboarding.
   * Ogni modifica riporta lo status a "proposed" (va riconfermato dal team)
   * e viene tracciata in history.
   */
  async updateObjective(userId: string, dto: UpdateObjectiveDto) {
    const current = await this.getObjective(userId);
    const profile = await this.prisma.clientProfile.findUnique({ where: { userId } });
    if (!profile?.startWeightKg) {
      throw new BadRequestException('Manca il peso di partenza: completa il questionario.');
    }

    const currentTargetKg = current.targetWeightKg ?? profile.startWeightKg;
    const weightToLoseKg =
      dto.weightToLoseKg ??
      Math.max(Math.round((profile.startWeightKg - currentTargetKg) * 10) / 10, 1);
    const weeks =
      dto.weeks ??
      Math.max(
        Math.ceil(
          ((current.targetDate?.getTime() ?? Date.now()) - Date.now()) / (7 * 86_400_000),
        ),
        3,
      );

    const [sustainable, ambitious, unrealAction] = await Promise.all([
      this.configParams.getNumber('sustainable_rate_max_kg_week', 0.7),
      this.configParams.getNumber('ambitious_rate_max_kg_week', 1.0),
      this.configParams.getString('unreal_objective_action', 'warn'),
    ]);
    const validation = validateObjective({
      weightToLoseKg,
      weeks,
      sustainableRateMaxKgWeek: sustainable,
      ambitiousRateMaxKgWeek: ambitious,
      unrealAction,
    });
    if (!validation.accepted) {
      throw new BadRequestException({
        message: validation.message,
        pace: validation.pace,
        suggestedWeeks: validation.suggestedWeeks,
      });
    }

    const history = Array.isArray(current.history) ? [...(current.history as unknown[])] : [];
    history.push({
      at: new Date().toISOString(),
      event: 'updated_by_client',
      pace: validation.pace,
      ratePerWeek: validation.ratePerWeek,
      weightToLoseKg,
      weeks,
    });

    const updated = await this.prisma.objective.update({
      where: { id: current.id },
      data: {
        targetWeightKg: Math.round((profile.startWeightKg - weightToLoseKg) * 10) / 10,
        targetWaistCm:
          profile.startWaistCm && dto.waistToLoseCm !== undefined
            ? profile.startWaistCm - dto.waistToLoseCm
            : current.targetWaistCm,
        targetDate: new Date(Date.now() + weeks * 7 * 86_400_000),
        status: 'proposed', // ogni modifica va riconfermata da coach + nutrizionista
        confirmedByCoachAt: null,
        confirmedByNutritionistAt: null,
        history: history as never,
      },
    });
    await this.audit.log({
      action: 'objective.update',
      actorId: userId,
      entityType: 'objective',
      entityId: updated.id,
      metadata: { pace: validation.pace, weightToLoseKg, weeks },
    });
    return { objective: updated, validation };
  }

  /**
   * Riepilogo di SOLA LETTURA della sua alimentazione, per il Profilo dell'app
   * (richiesta Simone 6/8): tipo di alimentazione, numero di pasti e dieta assegnata.
   * La cliente li vede ma non li tocca — cambiarli cambia i menu, ed è una decisione
   * clinica: dal backoffice servono permessi dedicati (`change_diet_type`), qui si
   * passa dalla coach. Il nome della dieta è quello da cui le stiamo davvero servendo
   * i menu (ultimo giorno erogato), non quello che dovrebbe essere in teoria: se i due
   * non coincidono è un problema da vedere, non da nascondere.
   */
  /**
   * LA RISPOSTA ALLA DOMANDA IN APP — «ci dici se hai allergie?» (13/8).
   *
   * ⚠️ **Si può rispondere una volta sola.** Se `allergieDichiarateIl` è già valorizzato questa porta
   * è chiusa: da lì in poi è una correzione, e la fa la nutrizionista col permesso
   * `change_allergies`. La regola del §5 — la cliente non scrive le allergie — vale per le
   * correzioni; qui il caso è l'opposto, non abbiamo mai chiesto e nessuno può rispondere per lei.
   *
   * ⚠️ **Si scrive in una transazione con l'audit**: è un dato sanitario, e se la riga di audit
   * fallisse dopo la scrittura resterebbe una modifica senza autore.
   */
  async dichiaraAllergie(userId: string, risposta: RispostaAllergie) {
    if (!haRisposto(risposta)) {
      throw new BadRequestException('Scegli le tue allergie, oppure «non ne ho»: senza una risposta non posso registrare niente.');
    }
    const attuale = (await this.prisma.clientProfile.findUnique({
      where: { userId },
      select: { allergies: true, allergieDichiarateIl: true },
    })) as { allergies: string[]; allergieDichiarateIl: Date | null } | null;
    if (!attuale) throw new NotFoundException('Profilo non trovato.');
    if (attuale.allergieDichiarateIl) {
      // ⚠️ Non è un errore tecnico: è la regola. E si dice a chi la incontra cosa fare adesso.
      throw new BadRequestException('Le tue allergie sono già registrate. Per cambiarle parlane con la tua nutrizionista: è lei a poterle correggere.');
    }

    const esito = dichiarazione(attuale.allergies ?? [], risposta, EU_ALLERGEN_CODES);
    const adesso = new Date();
    await this.prisma.$transaction(async (tx: PrismaTx) => {
      await tx.clientProfile.update({
        where: { userId },
        data: {
          allergies: esito.allergie,
          allergiesOther: esito.allergiesOther,
          allergieDichiarateIl: adesso,
        } as never,
      });
      await tx.auditLog.create({
        data: {
          action: 'profilo.allergie_dichiarate',
          actorId: userId,
          entityType: 'client_profile',
          entityId: userId,
          metadata: { allergie: esito.allergie, testoLibero: esito.allergiesOther, daApp: true } as never,
        } as never,
      });
    });

    /**
     * ⚠️ Quello che non sappiamo tradurre diventa una domanda per la nutrizionista, non un silenzio.
     * «Favismo» in banca dati non toglie un solo piatto: senza questa riga la cliente crederebbe di
     * essere protetta. `apriRichiestaVera` non lancia mai e non riapre la stessa domanda due volte.
     */
    for (const termine of esito.daTradurre) {
      await apriRichiestaVera(this.prisma, {
        tipo: 'allergia_da_tradurre',
        clienteId: userId,
        testo: `Una cliente ha dichiarato dall'app un'allergia che non so tradurre: «${termine}». Cosa devo togliere dal suo piatto? Se vale come regola generale, dimmelo: la imparo per tutte.`,
        origine: 'app-allergie',
        chiave: `allergia:${userId}:${termine.toLowerCase()}`,
        termine,
      });
    }

    // «Serve la visita» in automatico (criteri Nocanty, Decisioni §15): l'allergia appena
    // dichiarata mette la cliente davanti a una nutrizionista — se nessuna valutazione è già
    // scritta. Non lancia mai: la risposta della cliente è già salvata e tale resta.
    await apriServeVisita(this.prisma, userId, 'scheda-in-home');

    return { registrate: esito.allergie.length, daTradurre: esito.daTradurre.length };
  }

  /**
   * I due elenchi del Profilo: «Cibi assolutamente vietati» (le allergie) e «Cibi da evitare»
   * (intolleranze e non graditi), già espansi negli alimenti veri.
   *
   * ⚠️ L'espansione la fa `profile/esclusioni-cliente.ts` con le parole di `menu/exclusions.ts`, che
   * è la stessa funzione con cui il motore toglie i piatti: se l'app se ne tenesse una copia, il
   * giorno che la mappa cambia la cliente leggerebbe un elenco e ne mangerebbe un altro.
   */
  async esclusioni(userId: string) {
    const p = (await this.prisma.clientProfile.findUnique({
      where: { userId },
      select: { allergies: true, intolerances: true, dislikedFoods: true },
    })) as { allergies: string[]; intolerances: string[]; dislikedFoods: string[] } | null;
    return esclusioniCliente(p ?? {});
  }

  async nutrition(userId: string) {
    const profile = (await this.prisma.clientProfile.findUnique({
      where: { userId },
      select: {
        regime: true, dietStyle: true, dietFamily: true, mealsPerDay: true, pathType: true, fastingWindow: true,
        /**
         * ⛔ **L'OROLOGIO, anche qui** (21/8). Il riepilogo del profilo scriveva «Digiuno
         * intermittente 16:8» a chiunque digiunasse — una costante nel sorgente dell'app, scritta
         * quando 16:8 era l'unica finestra possibile. Da quando la durata la sceglie la cliente,
         * quella riga è **falsa** per chi sta sulla 14:10 o sulla 18:6: le dice il suo protocollo
         * sbagliato nella schermata che esiste per farle leggere il suo piano.
         *
         * ⚠️ Non si ricalcola niente a mano: si chiama `vistaOrologio`, la stessa funzione di
         * `/me/digiuno` e della scheda cliente. Se due punti rispondono alla stessa domanda, uno dei
         * due deve chiamare l'altro.
         */
        fastingProtocol: true, fastingStartMin: true, fastingSceltoIl: true,
        // ⚠️ `objective` serve alla ricerca della dieta (`pick-diet.ts` ci fa sopra due dei sette
        // ripieghi): senza, la cliente e lo staff cercherebbero con due profili diversi — che è
        // esattamente il difetto che questa riga chiude.
        objective: true,
        /**
         * Gli spuntini che la nutrizionista ha tolto a QUESTA cliente («togli lo spuntino», azione
         * 3 di Vera). Il motore li rispetta già e le kcal si ridistribuiscono sui pasti rimasti:
         * senza questa riga la cliente riceveva giornate senza merenda **senza che niente glielo
         * dicesse** — lo stesso buco che avevano le allergie, e che finisce con lei che scrive alla
         * coach «mi manca un pasto» per una cosa decisa apposta.
         */
        pastiEsclusi: true,
        /**
         * I due vincoli che decidono cosa NON può esserci nel piatto (richiesta di Simone, 16/8).
         * In app c'erano già, ma nel secondo riquadro: qui salgono in sintesi in quello di sopra,
         * accanto alla dieta e al regime — quello che si legge come «il mio piano in una schermata».
         *
         * ⚠️ `allergieDichiarateIl` viene con loro, e non è un di più: distingue «nessuna allergia»
         * da «non gliel'abbiamo mai chiesto». La prima è un'affermazione, la seconda no, e senza
         * questa data l'app non ha modo di dire la differenza.
         */
        allergies: true,
        intolerances: true,
        allergieDichiarateIl: true,
        assignedCoach: { select: { displayName: true } },
      },
    })) as {
      regime: string | null; dietStyle: string | null; dietFamily: string | null; mealsPerDay: number | null;
      pathType: string | null; fastingWindow: string | null; objective: string | null;
      fastingProtocol: string | null; fastingStartMin: number | null; fastingSceltoIl: Date | null;
      pastiEsclusi: string[] | null;
      allergies: string[] | null;
      intolerances: string[] | null;
      allergieDichiarateIl: Date | null;
      assignedCoach: { displayName: string | null } | null;
    } | null;
    if (!profile) throw new NotFoundException('Profilo non ancora creato: completa prima il questionario.');

    const ultimo = (await this.prisma.menuDay.findFirst({
      where: { clientId: userId },
      orderBy: { date: 'desc' },
      // `clientDescription` è la descrizione che il nutrizionista scrive PER la cliente: serve al
      // «?» accanto al nome della dieta nel profilo (richiesta di Simone dell'8/8). Si manda anche
      // lo `style`, che è la chiave delle schede generali in app: la descrizione del prodotto è più
      // specifica ma non sempre compilata, la scheda dello stile c'è sempre e ha le fonti.
      select: { diet: { select: { name: true, clientName: true, clientDescription: true, style: true } } },
    })) as {
      diet: { name: string; clientName: string | null; clientDescription: string | null; style: string | null } | null;
    } | null;

    /**
     * LA DIETA ASSEGNATA, che è quella che conta, e ha la precedenza su quella dei menu erogati.
     *
     * Difetto visto il 10/8 da Simone: assegnata la «Mediterranea senza glutine» a una cliente, in
     * profilo continuava a leggersi «Mediterranea». Il nome veniva **solo** dalla dieta dell'ultima
     * giornata erogata, e quelle giornate restano costruite sulla dieta di prima finché la
     * nutrizionista non le rigenera. Risultato: la cliente leggeva il nome vecchio, e da fuori non
     * si poteva sapere se il cambio fosse andato a buon fine o si fosse perso per strada.
     *
     * `ClientProfile.dietFamily` è `Diet.name` (vedi `pick-diet.ts`), quindi si può cercare la
     * variante e prenderne descrizione e stile.
     *
     * ⚠️ QUI C'ERA LA RIGA CHE MENTIVA (corretta il 12/8, decisione di Simone: «la cliente usa la
     * stessa ricerca dello staff»). Si cercava `findFirst({ where: { name: dietFamily } })` — per
     * **nome e basta** — ed è la stessa trappola trovata l'11/8 nella scheda del backoffice col
     * caso Cristina Urbani, corretta lì e lasciata qui. Una famiglia ha fino a diciotto varianti
     * che condividono il nome: quella query ne pescava una a caso, e da lì uscivano anche lo
     * **stile** (che apre la scheda «cos'è la tua dieta») e la **descrizione** sotto il «?». Una
     * cliente onnivora a 5 pasti poteva leggere la descrizione della variante vegana a 3 pasti.
     *
     * Ora è la stessa funzione dello staff, in `catalog/dieta-mostrata.ts`: variante esatta
     * (nome + stile + regime + pasti, approvata per prima), altrimenti la dieta che l'erogazione
     * servirebbe davvero — la sola che spiega i piatti che ha nel piatto.
     */
    const { dietaMostrata: assegnata } = await dietaMostrataPer(this.prisma, {
      regime: profile.regime,
      dietStyle: profile.dietStyle,
      dietFamily: profile.dietFamily,
      mealsPerDay: profile.mealsPerDay,
      objective: profile.objective,
      pathType: profile.pathType,
      // In digiuno il catalogo lo decide la FINESTRA (`struttura-per-digiuno.ts`): senza questa
      // riga la cliente leggerebbe la descrizione di una dieta diversa da quella che mangia.
      fastingWindow: profile.fastingWindow,
    });

    const nomeConsegnata = ultimo?.diet ? ultimo.diet.clientName || ultimo.diet.name : null;

    /**
     * Le diete delle giornate che deve ANCORA ricevere. `distinct` sulla dieta perché una
     * rigenerazione parziale può lasciare giornate su due diete diverse: basta che UNA delle
     * prossime sia quella vecchia perché valga la pena dirlo.
     */
    const giorniInArrivo = (await this.prisma.menuDay.findMany({
      where: { clientId: userId, date: { gte: toDateOnly() } },
      orderBy: { date: 'asc' },
      distinct: ['dietId'],
      take: 5,
      select: { diet: { select: { name: true, clientName: true } } },
    })) as { diet: { name: string; clientName: string | null } | null }[];
    const nomeAssegnata = nomePerLaCliente(assegnata) ?? profile.dietFamily;
    // La prima delle prossime giornate costruita su una dieta DIVERSA da quella assegnata.
    // `null` = quello che riceverà è già la dieta giusta (o non riceverà più niente).
    const dietaVecchiaInArrivo = nomeAssegnata
      ? giorniInArrivo
          .map((g) => (g.diet ? g.diet.clientName || g.diet.name : null))
          .find((n): n is string => !!n && n !== nomeAssegnata) ?? null
      : null;

    return {
      regime: profile.regime,
      dietStyle: profile.dietStyle,
      dietFamily: profile.dietFamily,
      mealsPerDay: profile.mealsPerDay,
      fasting: profile.pathType === 'intermittent_fasting',
      fastingWindow: profile.fastingWindow,
      /**
       * ⛔ **La finestra in orari, non in nome di pasti.** `attuale` manca finché non ha scelto: in
       * quel caso l'app ripiega su `fastingWindow`, che è quello che il motore sta usando davvero
       * per lei. Non si compone una finestra di scorta — mostrarle un orologio che nessuno ha
       * impostato è la stessa bugia di prima, con più cifre.
       */
      digiuno: fasceDelDigiuno(profile),
      /**
       * ⚠️ Sempre un elenco, mai `null`: il campo è nullable in banca dati, e mandare il null
       * costringerebbe l'app a difendersi da un buco che qui costa un `?? []`. «Nessuno escluso» e
       * «non lo so» sono la stessa cosa per chi legge — ma solo se chi risponde è coerente.
       *
       * Sono soltanto spuntini (`finestre-digiuno.ts` lascia passare solo quelli): i pasti
       * principali saltati stanno in `fastingWindow`, ed è la riga qui sopra. Due dati diversi, due
       * righe diverse in profilo.
       */
      pastiEsclusi: profile.pastiEsclusi ?? [],
      /**
       * ⚠️ Sempre elenchi, mai `null` — come `pastiEsclusi` qui sopra e per la stessa ragione.
       * ⚠️ E `allergieDichiarateIl` va mandata **anche quando è null**: è proprio il null che dice
       * «non gliel'abbiamo mai chiesto», cioè l'unico modo che l'app ha per non scrivere «nessuna
       * allergia» a una persona a cui nessuno l'ha domandato.
       */
      allergies: profile.allergies ?? [],
      intolerances: profile.intolerances ?? [],
      allergieDichiarateIl: profile.allergieDichiarateIl ? profile.allergieDichiarateIl.toISOString() : null,
      // Prima quella assegnata: è la decisione della nutrizionista. Il ripiego resta la dieta dei
      // menu, che è tutto quello che sappiamo delle clienti registrate prima del 7/8 (`dietFamily`
      // è null per loro).
      dietName: nomeAssegnata ?? nomeConsegnata,
      dietDescription: assegnata?.clientDescription ?? ultimo?.diet?.clientDescription ?? null,
      /**
       * Lo stile della DIETA ASSEGNATA, che può non essere quello scelto in registrazione
       * (`profile.dietStyle`): se la nutrizionista l'ha spostata su un'altra dieta, il popup deve
       * spiegare quella che sta seguendo — non quella che aveva chiesto. Ripiega sul profilo.
       */
      dietStyleAssegnato: assegnata?.style ?? ultimo?.diet?.style ?? profile.dietStyle,
      /**
       * I menu che deve ancora ricevere sono ancora quelli della dieta PRECEDENTE: il cambio è
       * stato deciso ma le giornate non sono state rigenerate.
       *
       * Va detto, e non nascosto: è la differenza fra «la tua dieta è cambiata e i menu arrivano
       * appena sono pronti» e una cliente celiaca che legge «senza glutine» in profilo e trova il
       * pane nel menu di domani. Con il glutine di mezzo è una cosa che deve sapere.
       *
       * ⚠️ GUARDA I GIORNI FUTURI, non l'ultimo consegnato. Questa riga confrontava la dieta
       * dell'ULTIMA giornata erogata con quella assegnata: bastava un menu vecchio in archivio per
       * accendere l'avviso su piatti che nessuno riceverà mai più. È la stessa correzione fatta il
       * 12/8 sulla scheda cliente — «se il menu è vecchio la segnalazione non ha senso, serve se i
       * futuri saranno sbagliati» (Simone) — che però era stata applicata solo al lato staff: la
       * cliente continuava a vedere la versione rumorosa. Due regole per la stessa frase, e quella
       * sbagliata era quella che leggeva lei.
       */
      menuAncoraSullaDietaPrecedente: !!dietaVecchiaInArrivo,
      dietNameMenuInCorso: dietaVecchiaInArrivo,
      coachName: profile.assignedCoach?.displayName ?? null,
    };
  }
  // ───────────────────────────────────────────────────────────────────────────────────────────
  // L'OROLOGIO DEL DIGIUNO
  // ───────────────────────────────────────────────────────────────────────────────────────────

  /** I campi del digiuno, in un posto solo: due letture che ne prendono di diversi divergerebbero. */
  private static readonly CAMPI_DIGIUNO = {
    pathType: true, fastingWindow: true, fastingProtocol: true, fastingStartMin: true,
    fastingTargetStartMin: true, fastingTargetProtocol: true, fastingChangedAt: true,
    // ⛔ Il limite settimanale sulle ORE (25/8): colonna sua, vedi `GIORNI_FRA_DUE_PROTOCOLLI`.
    fastingProtocolChangedAt: true,
    fastingSceltoIl: true,
  } as const;

  /** Il passo dell'adattamento graduale, da `config_param`. ⚠️ Il valore lo controlla chi lo usa. */
  private passoGraduale(): Promise<number> {
    return this.configParams.getNumber('digiuno_passo_graduale_min', PASSO_GRADUALE_PREDEFINITO);
  }

  /**
   * Ogni quanti giorni si possono cambiare le **ore** del digiuno (25/8). ⚠️ Il valore lo controlla
   * `decidiCambio`: un parametro svuotato non deve diventare «mai più» né «sempre».
   */
  private giorniFraProtocolli(): Promise<number> {
    return this.configParams.getNumber('fasting_protocol_change_days', GIORNI_FRA_DUE_PROTOCOLLI);
  }

  private async profiloDigiuno(userId: string): Promise<ProfiloDigiuno & { name: string | null }> {
    const p = (await this.prisma.clientProfile.findUnique({
      where: { userId },
      select: { ...ProfileService.CAMPI_DIGIUNO, name: true } as never,
    })) as unknown as (ProfiloDigiuno & { name: string | null }) | null;
    if (!p) throw new NotFoundException('Profilo non trovato.');
    return p;
  }

  /**
   * COM'È MESSA ADESSO, e se le va aperta la pagina dell'orologio.
   *
   * ⚠️ Una lettura sola per tutte e tre le domande dell'app (aprire la pagina, disegnare
   * l'orologio, mostrare il piano in corso): tre chiamate separate avrebbero potuto rispondere su
   * tre istanti diversi, e il piano graduale cambia ogni notte.
   */
  async getDigiuno(userId: string) {
    const profilo = await this.profiloDigiuno(userId);
    // ⚠️ Anche il limite settimanale sulle ore: l'app deve poterlo dire **prima** che scelga.
    return vistaOrologio(profilo, await this.passoGraduale(), undefined, undefined, await this.giorniFraProtocolli());
  }

  /**
   * LA CLIENTE SPOSTA LA SUA FINESTRA — o la sceglie per la prima volta.
   *
   * ⛔ **La prima scelta non è un cambio**, ed è la ragione per cui c'è un ramo apposta. Non ha una
   * finestra da cui partire, quindi non c'è nessuna direzione da misurare e nessun digiuno in corso
   * da allungare o accorciare; e soprattutto il limite di «uno al giorno» non deve poterla fermare
   * proprio mentre risponde a una domanda che non le era mai stata fatta.
   *
   * ⚠️ La cliente **non viene mai bloccata** da una scelta impegnativa: parte, e in parallelo si
   * apre l'attività per la nutrizionista (§3). Gli unici rifiuti sono un valore che non esiste e il
   * secondo spostamento nello stesso giorno — e tutti e due dicono cosa fare adesso.
   */
  async impostaDigiuno(userId: string, dto: { protocollo?: string; inizioMin?: number }) {
    const profilo = await this.profiloDigiuno(userId);
    if (profilo.pathType !== 'intermittent_fasting') {
      throw new BadRequestException(
        'Questa impostazione vale solo per il digiuno intermittente. Se vuoi passare al digiuno, parlane con la tua nutrizionista.',
      );
    }
    const adesso = new Date();
    const primaVolta = !profilo.fastingSceltoIl;
    const passo = await this.passoGraduale();

    const esito = primaVolta
      ? primaScelta(dto, passo)
      : decidiCambio(
          {
            protocollo: profilo.fastingProtocol ?? '',
            inizioMin: profilo.fastingStartMin ?? 0,
            cambiataIl: profilo.fastingChangedAt ?? null,
            protocolloCambiatoIl: profilo.fastingProtocolChangedAt ?? null,
          },
          dto,
          { adesso, oraMin: oraLocaleInMinuti(adesso) },
          // ⚠️ `perStaff` NON si passa: questa è la porta della cliente. La nutrizionista corregge
          // da Vera, che è l'altra porta e ha il suo permesso.
          { passoMin: passo, giorniFraProtocolli: await this.giorniFraProtocolli() },
        );
    if (!esito.permesso) throw new BadRequestException(esito.rifiuto);

    /**
     * ⛔ **UN TOCCO A VUOTO NON È UNO SPOSTAMENTO** (trovato in revisione, 21/8).
     *
     * `PATCH /me/digiuno {}` è valido — i due campi sono facoltativi apposta — e lo mandano il
     * doppio tocco e il retry dell'app. Prima si scriveva comunque `fastingChangedAt: adesso`, e lo
     * spostamento **vero** fatto dieci minuti dopo si beccava «puoi rifarlo fra 20 ore»: il limite
     * si accendeva su un cambio che non c'era stato. E l'audit registrava uno spostamento mai
     * avvenuto, cioè raccontava una cosa falsa a chi un giorno andrà a leggerlo.
     */
    if (esito.metodo === 'nessuno') return { ...vistaOrologio(profilo, passo), esito: { metodo: esito.metodo, daQuando: esito.daQuando, spiegazione: esito.spiegazione, minutiDigiunoStanotte: esito.minutiDigiunoStanotte, giorniDelPiano: esito.giorniDelPiano } };

    /**
     * ⛔ La finestra si deriva da quello che **entra in vigore**, non da quello che ha chiesto: col
     * piano graduale l'inizio resta quello di adesso, e derivarla dal bersaglio le cambierebbe i
     * pasti stasera per un orario a cui arriverà fra quattro giorni.
     *
     * ⚠️ **E va detto che oggi nessun test distingue le due versioni**, perché la finestra dipende
     * solo dalla **durata** — che è la regola d'oro del manuale, «la posizione non dice niente» — e
     * quindi passare l'orario chiesto invece di quello in vigore darebbe lo stesso valore. La riga
     * resta scritta così lo stesso: il giorno che le soglie guardassero anche la posizione, questa
     * sarebbe già giusta invece di essere un difetto da scoprire. *Niente tagli silenziosi: se una
     * cosa non è coperta, si dice.*
     */
    const derivata = derivaDaOrologio(esito.scrivi.inizioMin, esito.scrivi.protocollo);
    const finestraNuova = derivata?.fastingWindow;
    // ⛔ Non si scrive **mezza** impostazione: senza `fastingWindow` il motore non saprebbe quali
    // pasti saltare, e la cliente si troverebbe un orologio impostato e i pasti di prima. Meglio
    // rifiutare e dirlo che salvare uno stato che nessuno sa leggere.
    if (!derivata || !finestraNuova) {
      throw new BadRequestException(
        'Non riesco a calcolare i pasti di questa finestra. Riprova, e se continua dillo alla tua nutrizionista.',
      );
    }

    const finestraPrecedente = profilo.fastingWindow ?? null;
    await this.scriviLOrologio(userId, profilo, esito, finestraNuova, {
      adesso,
      primaVolta,
      finestraPrecedente,
      daApp: true,
    });
    await this.segnalaDigiuno(userId, profilo.name, esito, finestraNuova, primaVolta, finestraPrecedente, adesso);

    /**
     * ⚠️ Si risponde con **la vista aggiornata**, non con un «ok»: l'app ridisegna l'orologio da
     * quello che il server ha davvero scritto, invece di fidarsi di quello che aveva chiesto. Col
     * piano graduale le due cose sono diverse apposta — lei ha chiesto le 08:00, in vigore ci sono
     * ancora le 12:00 — e un `ok` la lascerebbe a guardare un orologio che nessuno ha impostato.
     */
    const aggiornato: ProfiloDigiuno = {
      ...profilo,
      fastingProtocol: esito.scrivi.protocollo,
      fastingStartMin: esito.scrivi.inizioMin,
      fastingTargetStartMin: esito.scrivi.bersaglioInizioMin,
      fastingWindow: finestraNuova,
      fastingChangedAt: adesso,
      fastingSceltoIl: profilo.fastingSceltoIl ?? adesso,
    };
    return {
      ...vistaOrologio(aggiornato, passo),
      /** Quello che l'app dice alla cliente subito dopo il tocco: la frase la scrive il modulo. */
      esito: {
        metodo: esito.metodo,
        daQuando: esito.daQuando,
        spiegazione: esito.spiegazione,
        minutiDigiunoStanotte: esito.minutiDigiunoStanotte,
        giorniDelPiano: esito.giorniDelPiano,
      },
    };
  }


  /**
   * ⛔ **LA NUTRIZIONISTA CAMBIA LE ORE DEL DIGIUNO DI UNA CLIENTE** (25/8) — la porta che la regola
   * della cliente promette.
   *
   * Dal 25/8 la cliente può cambiare le ore **una volta a settimana**, e la frase che legge quando
   * non può le dice *«se ti serve prima, scrivilo alla tua nutrizionista: lo cambia lei»*. Questa è
   * lei. ⛔ Senza questo metodo quella frase manderebbe una persona da qualcuno che non può farci
   * niente: un cancello chiuso, con in più una promessa falsa.
   *
   * ⚠️ **Passa dalle stesse due funzioni della cliente**: `decidiCambio` per decidere (con
   * `perStaff: true`, che toglie i limiti — è il permesso, non una scorciatoia) e `scriviLOrologio`
   * per scrivere. Una seconda stesura avrebbe messo le ore nuove e lasciato i pasti di prima.
   *
   * ⚠️ **Non lancia**: chi chiama è una chat, e a una nutrizionista che ha appena detto «mettila a
   * 16:8» si deve poter rispondere *perché* non si è potuto, non un errore rosso.
   */
  async impostaPerStaff(
    clientUserId: string,
    dati: { protocollo: string },
    attoreId: string,
  ): Promise<{ ok: boolean; perche: string; daQuando: 'oggi' | 'domani' }> {
    try {
      const profilo = await this.profiloDigiuno(clientUserId);
      if (profilo.pathType !== 'intermittent_fasting') {
        return { ok: false, perche: 'non è in digiuno intermittente.', daQuando: 'oggi' };
      }
      /**
       * ⛔ **A CHI NON HA MAI SCELTO LA SUA FINESTRA NON SI SCRIVE DA QUI** — corretto al secondo
       * giro di revisione, 25/8, e i danni erano tre insieme, tutti su una persona che non è nella
       * stanza:
       *  · `decidiCambio` ripiega su `inizioMin: 0`, quindi le si scriveva una finestra **00:00 –
       *    06:00**: mangia dalla mezzanotte alle sei, perché nessuno le ha mai chiesto a che ora
       *    mangia;
       *  · `scriviLOrologio` scrive `fastingSceltoIl`, e da lì in poi la pagina dell'orologio **non
       *    le si apre più** — il commento dice «la domanda gliel'abbiamo fatta», e non gliel'aveva
       *    fatta nessuno;
       *  · l'attività per la nutrizionista «finestra mai chiesta», che nasce proprio da quel campo
       *    vuoto, non sarebbe mai nata.
       *
       * ⚠️ La prima scelta è **sua**, e questa porta serve a *correggere* una scelta fatta, non a
       * farla al posto suo. Le ore senza l'orario non sono una finestra: sono metà di una decisione.
       */
      if (!profilo.fastingProtocol || profilo.fastingStartMin === null || profilo.fastingStartMin === undefined) {
        return {
          ok: false,
          perche: 'non ha ancora scelto la sua finestra dall\'app, quindi non so a che ora mangia: '
            + 'le ore da sole non bastano. Appena la sceglie lei, gliele posso correggere.',
          daQuando: 'oggi',
        };
      }
      const adesso = new Date();
      const esito = decidiCambio(
        {
          protocollo: profilo.fastingProtocol ?? '',
          inizioMin: profilo.fastingStartMin ?? 0,
          cambiataIl: profilo.fastingChangedAt ?? null,
          protocolloCambiatoIl: profilo.fastingProtocolChangedAt ?? null,
        },
        { protocollo: dati.protocollo },
        { adesso, oraMin: oraLocaleInMinuti(adesso) },
        // ⛔ `perStaff`: i limiti valgono per la cliente, non per chi la segue.
        { passoMin: await this.passoGraduale(), perStaff: true },
      );
      if (!esito.permesso) return { ok: false, perche: esito.rifiuto ?? 'non si può fare.', daQuando: 'oggi' };
      /**
       * ⚠️ **«Non c'era niente da cambiare» non è «fatto»** — corretto in revisione, 25/8. Qui si
       * rendeva `ok: true` senza scrivere una riga, e chi chiama scriveva comunque il registro e
       * diceva «Fatto: è a 18:6, ho rifatto le giornate». Serve una corsa fra anteprima e conferma
       * — la cliente che cambia le sue ore in quei secondi — ma è lo stesso schema di difetto già
       * pagato sulle proteine il 24/8, e costa una riga dirlo.
       */
      if (esito.metodo === 'nessuno') {
        return { ok: false, perche: 'era già a quelle ore: non ho toccato niente.', daQuando: esito.daQuando };
      }

      const derivata = derivaDaOrologio(esito.scrivi.inizioMin, esito.scrivi.protocollo);
      // ⛔ Come per la cliente: non si scrive mezza impostazione. Meglio dirlo che lasciare uno stato
      // che nessuno sa leggere — con l'aggravante che qui la persona che lo subisce non c'è.
      if (!derivata?.fastingWindow) {
        return { ok: false, perche: 'non riesco a calcolare i pasti di quella finestra.', daQuando: 'oggi' };
      }

      await this.scriviLOrologio(clientUserId, profilo, esito, derivata.fastingWindow, {
        adesso,
        primaVolta: false,
        finestraPrecedente: profilo.fastingWindow ?? null,
        daApp: false,
        attoreId,
      });
      return { ok: true, perche: '', daQuando: esito.daQuando };
    } catch (err) {
      this.logger.warn(
        `Ore del digiuno non cambiate per ${clientUserId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      /**
       * ⚠️ **Il messaggio vero, quando c'è.** Il `catch` generico inghiottiva anche il lock
       * ottimistico («qualcuno ha scritto nel frattempo») e il profilo mancante, e rispondeva
       * «qualcosa non ha funzionato»: chi legge non sa se riprovare o chiamare qualcuno. Le
       * eccezioni **nostre** portano una frase scritta per una persona; il resto no, e allora si
       * dice che è un guasto — senza fingere di sapere quale.
       */
      const nostra = err instanceof BadRequestException || err instanceof NotFoundException;
      const detto = nostra && err instanceof Error ? err.message : '';
      return {
        ok: false,
        perche: detto || 'qualcosa non ha funzionato mentre scrivevo. Riprova, e se continua dillo a chi segue il sistema.',
        daQuando: 'oggi',
      };
    }
  }

  /**
   * ⛔ **SCRIVERE L'OROLOGIO: UN POSTO SOLO, DUE PORTE.**
   *
   * Dal 25/8 le porte che possono cambiare una finestra sono due: la **cliente** dall'app (una
   * volta al giorno la lancetta, una volta a settimana le ore) e la **nutrizionista** da Vera, che
   * è il permesso che la regola della cliente promette. ⚠️ Regola di casa: *se due punti rispondono
   * alla stessa domanda, uno deve chiamare l'altro*. Qui la domanda è «cosa si scrive nel profilo
   * quando la finestra cambia», e la risposta comprende cose che è facile dimenticare: il bersaglio
   * del piano graduale, il protocollo rimandato a domani, la finestra derivata, la scrittura
   * condizionata che impedisce a due tocchi di sovrascriversi, e il registro.
   *
   * Una seconda stesura per lo staff avrebbe scritto il protocollo e i pasti di prima.
   */
  private async scriviLOrologio(
    userId: string,
    profilo: ProfiloDigiuno & { name: string | null },
    esito: EsitoCambio,
    finestraNuova: string,
    opzioni: { adesso: Date; primaVolta: boolean; finestraPrecedente: string | null; daApp: boolean; attoreId?: string },
  ): Promise<void> {
    const { adesso, primaVolta, finestraPrecedente, daApp } = opzioni;
    /**
     * Le **ore** cambiano? Adesso o da domani: quello che conta è la decisione, non quando entra in
     * vigore. Vedi il riquadro sotto, dentro la `update`.
     */
    const oreCambiate =
      esito.scrivi.protocollo !== profilo.fastingProtocol ||
      (!!esito.scrivi.bersaglioProtocollo && esito.scrivi.bersaglioProtocollo !== profilo.fastingProtocol);
    await this.prisma.$transaction(async (tx: PrismaTx) => {
      /**
       * ⛔ **SI SCRIVE SOLO SE NESSUNO HA SCRITTO NEL FRATTEMPO** (revisione, 21/8).
       *
       * Il profilo l'abbiamo letto **fuori** dalla transazione: due tocchi ravvicinati — l'app che
       * ritenta, due dispositivi — leggono lo stesso stato, passano tutti e due il limite di «uno al
       * giorno» e scrivono tutti e due. Nessuno stato mezzo scritto (l'`update` è uno solo), ma il
       * limite si aggira e l'ultimo vince: un piano graduale appena aperto può sparire, o tornare.
       *
       * `updateMany` con la condizione su `fastingChangedAt` fa fallire il secondo, che riceve una
       * frase che dice cosa fare invece di sovrascrivere in silenzio.
       */
      const scritte = (await tx.clientProfile.updateMany({
        where: { userId, fastingChangedAt: profilo.fastingChangedAt ?? null } as never,
        data: {
          fastingProtocol: esito.scrivi.protocollo,
          fastingStartMin: esito.scrivi.inizioMin,
          fastingTargetStartMin: esito.scrivi.bersaglioInizioMin,
          // ⛔ Il protocollo rimandato a domani: lo applica lo stesso cron del piano graduale.
          fastingTargetProtocol: esito.scrivi.bersaglioProtocollo,
          fastingWindow: finestraNuova,
          /**
           * ⛔ **Il limite giornaliero sulla lancetta è della CLIENTE, e si segna solo se è lei.**
           *
           * ⚠️ Trovato in revisione, 25/8. `scriviLOrologio` scriveva `fastingChangedAt` anche dalla
           * porta staff: se Lucia correggeva le ore di Giulia alle 13:00, alle 20:00 Giulia che
           * voleva spostare la finestra di un'ora perché cena fuori leggeva **«La tua finestra
           * l'hai già spostata da poco: puoi rifarlo fra 19 ore»**. Non l'aveva spostata lei. È la
           * stessa direzione, al rovescio, del difetto già corretto in `cambio-finestra.ts` — il
           * gesto di una persona che blocca quello di un'altra, con una frase falsa in mezzo.
           */
          ...(daApp ? { fastingChangedAt: adesso } : {}),
          /**
           * ⛔ **La data delle ORE si scrive quando le ore CAMBIANO — anche se valgono da domani.**
           *
           * ⚠️ La prima stesura guardava solo `esito.scrivi.protocollo`, cioè quello che entra in
           * vigore **adesso**. Ma quando la finestra di oggi si è già aperta il protocollo nuovo
           * finisce in `bersaglioProtocollo` e lo applica il cron: `scrivi.protocollo` resta quello
           * vecchio, la condizione era falsa, e **la data non si scriveva mai**.
           *
           * ⛔ Il difetto, misurato in revisione il 25/8: una cliente che tocca l'app **dentro la sua
           * finestra di alimentazione** poteva cambiare protocollo tutti i giorni, per sempre — cioè
           * esattamente il «cinque pulsanti, uno al giorno» che questa consegna doveva chiudere. E
           * per una 16:8 quella finestra è aperta otto ore al giorno, proprio le ore in cui una
           * persona pensa al cibo e apre l'app.
           *
           * ✅ Quello che conta è **la decisione**, e la decisione è di oggi: si guarda se le ore
           * cambiano, adesso o da domani. Il resto — che la lancetta non consumi il credito
           * settimanale — resta com'era, perché quello sì dipende dal gesto.
           *
           * ⚠️ E **non nella prima scelta**: `primaVolta` non è un cambio (`fastingProtocol` è
           * `null`), e far partire il credito settimanale mentre lei risponde a una domanda che non
           * le era mai stata fatta è il muro nel momento peggiore. La migrazione e lo schema dicono
           * tutti e due «NULL = non l'ha mai cambiato», ed è questa riga che lo rende vero.
           */
          ...(!primaVolta && oreCambiate ? { fastingProtocolChangedAt: adesso } : {}),
          // ⚠️ Da qui in poi la pagina non le si riapre più: la domanda gliel'abbiamo fatta.
          fastingSceltoIl: profilo.fastingSceltoIl ?? adesso,
        } as never,
      })) as unknown as { count: number };
      if (scritte.count === 0) {
        throw new BadRequestException(
          'Hai appena cambiato la tua finestra da un\'altra parte. Riapri la pagina per vedere com\'è adesso.',
        );
      }
      await tx.auditLog.create({
        data: {
          action: primaVolta ? 'digiuno.prima_scelta' : 'digiuno.finestra_spostata',
          // ⚠️ Chi ha agito, non chi ha subito: dal 25/8 può essere la nutrizionista da Vera. Senza
          // questa riga il registro avrebbe detto che la cliente ha cambiato le sue ore da sola,
          // proprio nel caso in cui non poteva farlo — cioè avrebbe raccontato il contrario.
          actorId: opzioni.attoreId ?? userId,
          entityType: 'client_profile',
          entityId: userId,
          metadata: {
            /**
             * ⚠️ **La frase in chiaro, dentro il log.** Il resto sono numeri che vanno interpretati;
             * questa è la stessa riga che la cliente ha letto prima di confermare, e chi apre la sua
             * scheda fra un mese legge quello che è successo senza dover tradurre `inizioMin: 960`.
             */
            descrizione: esito.spiegazione,
            metodo: esito.metodo,
            protocollo: esito.scrivi.protocollo,
            inizioMin: esito.scrivi.inizioMin,
            bersaglio: esito.scrivi.bersaglioInizioMin,
            finestraPrima: finestraPrecedente,
            finestraDopo: finestraNuova,
            minutiDigiunoStanotte: esito.minutiDigiunoStanotte,
            // ⚠️ Se il passo configurato era da buttare, resta scritto qui: niente tagli silenziosi.
            passoUsatoMin: esito.passoUsatoMin,
            daApp,
            // ⚠️ `daStaff` accanto a `daApp`: fra sei mesi «chi ha spostato questa finestra» si legge
            // qui, e le due porte hanno conseguenze diverse (i limiti valgono per una sola).
            daStaff: !daApp,
          } as never,
        } as never,
      });
    });

  }

  /**
   * ⛔ **IL PASSO DELLA NOTTE** — quello che fa arrivare davvero i cambi rimandati e i piani graduali.
   *
   * Due cose, in un giro solo, perché sono la stessa cosa: **«questo vale dalla prossima apertura»**.
   *
   *  - il **protocollo rimandato** (`fastingTargetProtocol`): la cliente l'ha cambiato a finestra già
   *    aperta, quindi oggi non si è toccato niente. Stanotte entra in vigore, e il campo si azzera;
   *  - il **piano graduale** (`fastingTargetStartMin`): l'orario si avvicina di un passo per notte
   *    finché ci arriva, e allora il bersaglio si azzera.
   *
   * ⚠️ **Va prima del motore**, nel cron: `engine.runBatch()` e la composizione dei menu leggono
   * `fastingWindow`, e una finestra aggiornata dopo che l'hanno letta varrebbe da dopodomani invece
   * che da domani — cioè il rinvio di un giorno diventerebbe di due, in silenzio.
   *
   * ⚠️ Non lancia mai per una cliente sola: un profilo storto non deve fermare il giro di tutte le
   * altre. Quello che salta si conta e si dice — *niente tagli silenziosi*.
   */
  /**
   * ⛔ **LE CONTROINDICAZIONI EMERSE A DIGIUNO GIÀ IN CORSO — sospensione immediata.**
   *
   * Decisione della nutrizionista responsabile, 5/9 (`progetto/guide/Risposte_Cliniche_Lucia_
   * 2026-09-05.pdf`, scheda 7 punto 1): *«sospendere immediatamente il digiuno e ripristinare la
   * giornata piena. Il rischio di mantenere un digiuno controindicato è superiore al ritorno
   * temporaneo alla dieta standard»*. Era il caso della migrazione — una cliente che dichiara una
   * cosa dopo essere già stata messa a digiuno — e finora non succedeva niente.
   *
   * ⚠️ **La cliente torna a `classic3`, non a un percorso inventato**: è la giornata piena, cioè il
   * comportamento normale del prodotto. La finestra si azzera perché non vuol più dire niente, e
   * **resta scritto** cosa è successo (`fastingSospesoIl`, `fastingSospesoPerche`): una cliente che
   * si trova la giornata piena senza una riga che lo spieghi è un guasto, non una protezione.
   *
   * ⚠️ **Si apre una segnalazione clinica**, che va alla nutrizionista e alla coach: rimetterla a
   * digiuno è una decisione di una persona, mai di questo giro.
   */
  async sospendiDigiuniControindicati(): Promise<{ guardate: number; sospese: number; falliti: number; motivi: string[] }> {
    /**
     * ⚠️ **Solo chi ha un piano in corso** (revisione, 5/9). Una cliente uscita a marzo con
     * `pathType: intermittent_fasting` ancora scritto in profilo non deve prendersi una modifica di
     * profilo e una segnalazione clinica stanotte: è la stessa regola della coda della coach —
     * *«aprire un'attività su chi ha finito il percorso mesi fa è il modo più rapido di insegnare a
     * ignorare la colonna»*.
     */
    const profili = (await this.prisma.clientProfile.findMany({
      where: {
        pathType: 'intermittent_fasting',
        user: { subscriptions: { some: { status: { in: [...STATI_CON_UN_PIANO] } } } },
      } as never,
      select: { userId: true, name: true, fastingExclusions: true, fastingSospesoIl: true } as never,
    })) as unknown as {
      userId: string; name: string | null;
      fastingExclusions: RisposteDigiuno | null; fastingSospesoIl: Date | null;
    }[];
    const motivi: string[] = [];
    let sospese = 0;
    let falliti = 0;
    for (const p of profili) {
      /**
       * ⛔ **Un errore su una cliente non ferma le altre** (revisione, 5/9): il ciclo sotto — il
       * piano graduale — ha il suo try/catch e conta i falliti da sempre; questo non ce l'aveva, e
       * una `update` andata giù avrebbe fatto saltare **tutto** il passo notturno del digiuno,
       * sospensioni e adattamenti insieme.
       */
      try {
        const esito = vaSospesoSubito({ risposte: p.fastingExclusions ?? null });
        if (!esito) continue;
        sospese += 1;
        motivi.push(`${p.name ?? p.userId}: ${esito.motivi.join(', ')}`);
        /**
         * ⛔ **`orologioAzzerato()`, non tre colonne a mano** (revisione, 5/9). `uscita-dal-digiuno.ts`
         * esiste proprio perché quattro porte scrivevano queste sette colonne per conto loro e tre
         * divergevano: questa era la quinta, e ne azzerava tre su sette. Lo stato che lasciava è
         * quello che quel file chiama il peggiore — finestra vuota, protocollo e orario ancora
         * scritti, e `fastingSceltoIl` sopravvissuto, cioè la pagina dell'orologio che non si
         * riapre il giorno che la nutrizionista la rimette a digiuno.
         */
        await this.prisma.clientProfile.update({
          where: { userId: p.userId },
          data: {
            pathType: 'classic3',
            ...orologioAzzerato(),
            fastingSospesoIl: new Date(),
            fastingSospesoPerche: esito.frase,
          } as never,
        });
        /**
         * ⛔ **E la base personale va rifatta** (revisione, 5/9). `pathType` e `fastingWindow` sono
         * due dei campi di `CAMPI_CHE_CAMBIANO_LA_BASE`: senza questo, la cliente si sveglia
         * «giornata piena» con il pool costruito su pranzo-merenda-cena, cioè riceve una giornata
         * senza colazione — la protezione l'avrebbe lasciata in uno stato peggiore di prima.
         * ⚠️ Non bloccante e non muta, come nell'altra porta che fa la stessa cosa.
         */
        try {
          await this.personalBase?.buildPersonalBase(p.userId);
        } catch (e) {
          this.logger.warn(`Base personale non rifatta dopo la sospensione di ${p.userId}: ${e instanceof Error ? e.message : String(e)}.`);
        }
        /**
         * ⚠️ **Il dedup guarda il MOTIVO, non la categoria**: con quello standard una qualunque
         * clinica già aperta (un'allergia, un calo rapido) avrebbe zittito proprio l'avviso che dice
         * che a questa cliente abbiamo cambiato il percorso stanotte.
         */
        const aperta = await apriSegnalazione(this.prisma as never, {
          clientId: p.userId,
          category: 'clinical',
          reason: esito.frase,
          source: 'engine',
          dedupe: false,
        });
        if (!aperta) {
          this.logger.warn(`Digiuno sospeso per ${p.userId} ma la segnalazione NON è stata aperta: avvisare a mano.`);
        }
        await this.audit.log({
          action: 'digiuno.sospeso_per_controindicazione',
          entityType: 'client_profile',
          entityId: p.userId,
          metadata: { motivi: esito.motivi, segnalazione: aperta ? 'aperta' : 'non aperta' },
        });
        this.logger.warn(`Digiuno sospeso per ${p.userId}: ${esito.motivi.join(', ')}.`);
      } catch (e) {
        falliti += 1;
        this.logger.error(`Sospensione del digiuno fallita per ${p.userId}: ${e instanceof Error ? e.message : String(e)}.`);
      }
    }
    return { guardate: profili.length, sospese, falliti, motivi };
  }

  async passoNotturnoDigiuno(): Promise<{ guardati: number; protocolliApplicati: number; passiFatti: number; arrivate: number; falliti: number; sospese?: number }> {
    /**
     * ⛔ **PRIMA la sospensione, poi l'adattamento graduale**, e l'ordine non è di stile: avvicinare
     * di un'ora la finestra di una cliente che stanotte esce dal digiuno vuol dire scriverle un
     * orario che domattina non vale più — e la riga nel registro racconterebbe due cose in conflitto.
     */
    const controindicate = await this.sospendiDigiuniControindicati();
    const passo = await this.passoGraduale();
    const profili = (await this.prisma.clientProfile.findMany({
      where: {
        pathType: 'intermittent_fasting',
        OR: [{ fastingTargetStartMin: { not: null } }, { fastingTargetProtocol: { not: null } }],
      } as never,
      select: { ...ProfileService.CAMPI_DIGIUNO, userId: true } as never,
    })) as unknown as (ProfiloDigiuno & { userId: string })[];

    let protocolliApplicati = 0;
    let passiFatti = 0;
    let arrivate = 0;
    let falliti = 0;

    for (const p of profili) {
      try {
        // ⚠️ Il protocollo rimandato entra in vigore PRIMA del passo sull'orario: la finestra si
        // deriva da tutti e due, e applicarli in ordine inverso darebbe una notte di pasti sbagliati.
        const protocollo = p.fastingTargetProtocol ?? p.fastingProtocol ?? '';
        const applicaProtocollo = Boolean(p.fastingTargetProtocol);
        const inizioOra = p.fastingStartMin ?? null;
        if (!protocolloDigiuno(protocollo) || inizioOra === null) {
          // Profilo senza orologio: non c'è niente da avvicinare. Si azzera il bersaglio, o resta
          // lì per sempre a far ricomparire questa cliente ogni notte.
          await this.prisma.clientProfile.update({
            where: { userId: p.userId },
            data: { fastingTargetStartMin: null, fastingTargetProtocol: null } as never,
          });
          continue;
        }

        const passoStanotte = passoDiStanotte(inizioOra, p.fastingTargetStartMin, passo);
        const inizioNuovo = passoStanotte ? passoStanotte.inizioMin : inizioOra;
        const arrivata = !passoStanotte || passoStanotte.arrivata;
        if (!passoStanotte && !applicaProtocollo) {
          // Bersaglio già raggiunto e nessun protocollo da applicare: si pulisce e basta.
          await this.prisma.clientProfile.update({
            where: { userId: p.userId },
            data: { fastingTargetStartMin: null, fastingTargetProtocol: null } as never,
          });
          continue;
        }

        const derivata = derivaDaOrologio(inizioNuovo, protocollo);
        if (!derivata?.fastingWindow) {
          falliti += 1;
          continue;
        }

        await this.prisma.$transaction(async (tx: PrismaTx) => {
          await tx.clientProfile.update({
            where: { userId: p.userId },
            data: {
              fastingProtocol: protocollo,
              fastingStartMin: inizioNuovo,
              fastingWindow: derivata.fastingWindow,
              fastingTargetProtocol: null,
              // ⚠️ Il bersaglio si azzera SOLO quando ci si è arrivati: se resta, domani notte si
              // fa un altro passo. È il piano che si esegue da sé.
              fastingTargetStartMin: arrivata ? null : p.fastingTargetStartMin,
            } as never,
          });
          await tx.auditLog.create({
            data: {
              action: 'digiuno.passo_notturno',
              actorId: null,
              entityType: 'client_profile',
              entityId: p.userId,
              metadata: {
                protocollo,
                protocolloApplicatoOra: applicaProtocollo,
                da: inizioOra,
                a: inizioNuovo,
                bersaglio: p.fastingTargetStartMin,
                arrivata,
                finestra: derivata.fastingWindow,
              } as never,
            } as never,
          });
        });

        if (applicaProtocollo) protocolliApplicati += 1;
        if (passoStanotte) passiFatti += 1;
        if (arrivata) arrivate += 1;
      } catch (e) {
        falliti += 1;
        console.error(`[digiuno] passo notturno fallito per ${p.userId}:`, e);
      }
    }
    return { guardati: profili.length, protocolliApplicati, passiFatti, arrivate, falliti, sospese: controindicate.sospese };
  }

  /**
   * Le due attività per la nutrizionista. ⚠️ **Non lancia mai**: la scelta della cliente è già
   * salvata, e un avviso che non parte non deve trasformarsi in un errore a schermo per chi ha
   * appena deciso una cosa sua.
   */
  private async segnalaDigiuno(
    userId: string,
    nome: string | null,
    esito: EsitoCambio,
    finestraNuova: string,
    primaVolta: boolean,
    finestraPrecedente: string | null,
    adesso: Date,
  ): Promise<void> {
    try {
      if (esito.daVerificare.length) {
        const t = testoDigiunoEstremo(
          nome,
          esito.daVerificare,
          `un digiuno ${esito.scrivi.protocollo} dalle ${oraDelGiorno(esito.scrivi.inizioMin)}`,
        );
        await apriAttivitaCoach(this.prisma, this.push, {
          clientId: userId,
          kind: TIPO_DIGIUNO_ESTREMO,
          refId: riferimentoDigiunoEstremo(esito.scrivi.protocollo, finestraNuova),
          title: t.title,
          description: t.description,
          dueDate: scadenzaVerifica(adesso),
        });
      }
      /**
       * ⛔ La finestra che l'orologio non sapeva riprodurre (§15): si segnala **quando cambia
       * davvero**, non perché era in elenco. Se per caso la scelta nuova coincide con quella di
       * prima, non è successo niente e non c'è niente da dire.
       */
      const eraTraducibile = Boolean(finestraPrecedente) && Boolean(PROPOSTE_DA_FINESTRA_STORICA[finestraPrecedente as string]);
      // ⛔ **Solo alla PRIMA scelta** (corretto in revisione, 21/8). Il testo che parte dice «la
      // pagina le si è aperta vuota e ha scelto…», e quello succede una volta sola. A una cliente a
      // cui la coach aveva scritto «salta la cena» dalla scheda, e che poi sposta la lancetta, si
      // sarebbe raccontata una schermata che non ha mai visto: ha solo mosso un orologio.
      if (primaVolta && finestraPrecedente && !eraTraducibile && finestraPrecedente !== finestraNuova) {
        const t = testoFinestraNonTraducibile(
          nome,
          motivoPerLaNutrizionista(
            finestraPrecedente,
            `${esito.scrivi.protocollo} dalle ${oraDelGiorno(esito.scrivi.inizioMin)}`,
          ),
        );
        await apriAttivitaCoach(this.prisma, this.push, {
          clientId: userId,
          kind: TIPO_FINESTRA_NON_TRADUCIBILE,
          refId: riferimentoNonTraducibile(finestraPrecedente),
          title: t.title,
          description: t.description,
          dueDate: scadenzaVerifica(adesso),
        });
      }
    } catch (e) {
      console.error('[digiuno] la segnalazione alla nutrizionista non è partita:', e);
    }
  }

}
