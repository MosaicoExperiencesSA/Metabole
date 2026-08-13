import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { validateObjective } from '../onboarding/objective-validator';
import { PersonalBaseService } from '../personal-base/personal-base.service';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EU_ALLERGEN_CODES } from '../catalog/allergens';
import { apriRichiestaVera } from '../vera/apri-richiesta';
import { type RispostaAllergie, dichiarazione, haRisposto } from './dichiara-allergie';
import { esclusioniCliente } from './esclusioni-cliente';
import { subscriptionEnd, pickMainSubscription } from '../commerce/commerce.service';
import { campiCambiati } from '../common/diff-campi';
import { EsitoSpezia, filtraSpezie } from '../menu/spezie';
import { UpdateObjectiveDto, UpdateProfileDto } from './dto/update-profile.dto';
import { toDateOnly } from '../common/date-only';
import { dietaMostrataPer, nomePerLaCliente } from '../catalog/dieta-mostrata';

/** Il client dentro una transazione: stessa forma usata in `commerce` e `finance`. */
type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
    private readonly personalBase: PersonalBaseService,
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
    const { lifestyle, consents, planStartDate, locale, ...rest } = dto;
    // Rete di sicurezza sulle spezie: la strada normale è `/me/menu/substitute`, che ha già il
    // suo cancello, ma questa PATCH riceve la lista INTERA dei cibi esclusi (Profilo → "Cibi
    // esclusi", e le app vecchie). Senza il filtro qui, una spezia rientrerebbe dalla finestra.
    // Vedi `menu/spezie.ts`.
    let avvisiSpezie: EsitoSpezia[] = [];
    if (Array.isArray(rest.dislikedFoods)) {
      const filtrati = filtraSpezie(rest.dislikedFoods);
      rest.dislikedFoods = filtrati.tenuti;
      avvisiSpezie = filtrati.avvisi;
    }
    // La data d'inizio piano viene impostata dalla cliente (StartDatePrompt) SOLO la prima volta
    // (quando è ancora vuota). In quel caso va allineata anche la subscription: altrimenti la
    // prova, attivata al pagamento con la data di allora, scade sulle date vecchie mentre l'inizio
    // piano dice un'altra data ("Nessun piano attivo" pur avendo iniziato da poco).
    const firstStartSet = !!planStartDate && !(current as { planStartDate: Date | null }).planStartDate;
    if (locale) {
      await this.prisma.user.update({ where: { id: userId }, data: { locale } });
    }
    const profile = await this.prisma.clientProfile.update({
      where: { userId },
      data: {
        ...(rest as Record<string, unknown>),
        ...(lifestyle ? { lifestyle: lifestyle as never } : {}),
        ...(consents ? { consents: consents as never } : {}),
        ...(planStartDate ? { planStartDate: new Date(planStartDate) } : {}),
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

    // Primo inserimento della data d'inizio → allinea la subscription (date + riattivazione).
    if (firstStartSet && planStartDate) {
      await this.alignSubscriptionToPlanStart(userId, new Date(planStartDate)).catch(() => {
        /* non bloccare il salvataggio del profilo per un errore di allineamento */
      });
    }

    // Se cambiano regime/stile/numero pasti, il prodotto e il pool ricette possono
    // cambiare: rigeneriamo la base personalizzata sicura (non bloccante).
    if (dto.regime !== undefined || dto.dietStyle !== undefined || dto.dietFamily !== undefined || dto.mealsPerDay !== undefined) {
      try {
        await this.personalBase.buildPersonalBase(userId);
      } catch {
        /* non bloccante */
      }
    }
    return avvisiSpezie.length ? { ...profile, avvisiSpezie } : profile;
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
    const reactivate = newEnd.getTime() > Date.now() && (sub.status === 'active' || sub.status === 'expired');
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { startDate: d, endDate: newEnd, ...(reactivate ? { status: 'active' as never } : {}) },
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
        ...(reactivate ? { status: 'active', reactivated: true } : {}),
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
        // ⚠️ `objective` serve alla ricerca della dieta (`pick-diet.ts` ci fa sopra due dei sette
        // ripieghi): senza, la cliente e lo staff cercherebbero con due profili diversi — che è
        // esattamente il difetto che questa riga chiude.
        objective: true,
        assignedCoach: { select: { displayName: true } },
      },
    })) as {
      regime: string | null; dietStyle: string | null; dietFamily: string | null; mealsPerDay: number | null;
      pathType: string | null; fastingWindow: string | null; objective: string | null;
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
}
