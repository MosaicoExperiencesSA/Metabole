import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { orologioAzzerato } from '../menu/uscita-dal-digiuno';
import { apriServeVisita } from '../clients/serve-visita';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PersonalBaseService } from '../personal-base/personal-base.service';
import { avanzaStatoSeIndietro } from '../commerce/avanza-stato';
import { NotificationsService } from '../notifications/notifications.service';
import { filtraSpezie } from '../menu/spezie';
import { fraseAiutoEsclusioni, problemiEsclusioni } from '../common/esclusioni-scritte-bene';
import { INTOLLERANZA_IGNOTA, allergieDichiarate, intolleranzeDichiarate } from '../common/allergie';
import { soloSeMandato, unioneSenzaPerdere } from '../common/non-perdere';
import { assegnaSenzaGlutineEAvvisa } from '../menu/senza-glutine';
import { agganciaAssegnazioneAlProfilo } from '../common/assegnazione-profilo';
import { PARAM_CAPO_PREDEFINITO, nutrizionistaDiRiferimento } from '../common/nutrizionista-di-riferimento';
import { toDateOnly } from '../common/date-only';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { ONBOARDING_QUESTIONS } from './onboarding.questions';
import {
  computeScreeningFlag,
  validateObjective,
} from './objective-validator';
import { stileDellaFamiglia } from '../catalog/pick-diet';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
    private readonly audit: AuditService,
    private readonly personalBase: PersonalBaseService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Prodotti (diete) mostrati allo schermo 16: le Diet approvate e visibili al cliente
   * (clientVisible=true + status='approved'), **una per FAMIGLIA** — cioè una per coppia
   * nome+stile, la stessa chiave con cui il sito costruisce le sue card.
   *
   * Prima ne teneva una per STILE, e le famiglie che condividono lo stesso codice si
   * schiacciavano in una voce sola: Vegana, Vegetariana, Flexitariana e Flessibile sono tutte
   * `flexible`; Mediterranea, Mediterranea ipocalorica e Pescetariana sono tutte
   * `mediterranean`. Il backoffice ne mostrava 18, l'app 8 (segnalato da Simone il 6/8).
   *
   * Le varianti interne della stessa famiglia (regime × obiettivo × pasti × digiuno) restano
   * dettagli del motore: qui si fondono in una card sola, tenendo i campi compilati migliori.
   * Data-driven: aggiungere o rinominare un prodotto non richiede deploy.
   */
  async dietProducts() {
    const diets = await this.prisma.diet.findMany({
      where: { clientVisible: true, status: 'approved' } as never,
      // I "Consigliati" (recommended) vengono prima, poi per data di creazione.
      orderBy: [{ recommended: 'desc' }, { createdAt: 'asc' }] as never,
    });
    type Prodotto = {
      id: string; style: string; family: string; name: string; description: string | null;
      highlights: string[]; objective: string; seasonalTag: string | null; recommended: boolean;
    };
    const byFamily = new Map<string, Prodotto>();
    for (const d of diets as unknown as Array<Record<string, unknown>>) {
      const style = String(d.style);
      const family = String(d.name ?? '');
      const key = `${family}\u0000${style}`;
      const clientName = (d.clientName as string) || '';
      const description = (d.clientDescription as string) ?? null;
      const highlights = Array.isArray(d.highlights) ? (d.highlights as string[]) : [];
      const existing = byFamily.get(key);
      if (!existing) {
        byFamily.set(key, {
          id: String(d.id),
          style,
          // `family` è il valore che finisce sul profilo (`Diet.name`): è la CHIAVE con cui il
          // motore ritrova il prodotto, non l'etichetta da mostrare.
          family,
          // Nome mostrato alla cliente: prima il nome commerciale (clientName), poi il nome
          // con cui la dieta e' stata creata in backoffice. MAI il codice stile: col solo codice
          // l'app mostrava "Chetogenica" o "Dash" mentre in backoffice la stessa dieta si chiama
          // "Keto (non terapeutica)" o "DASH (anti-ipertensiva)" - due nomi per la stessa cosa
          // (segnalato da Simone il 6/8).
          name: clientName || family || style,
          description,
          highlights,
          objective: (d.objective as string) ?? 'dimagrimento',
          seasonalTag: (d.seasonalTag as string) ?? null,
          recommended: Boolean(d.recommended),
        });
        continue;
      }
      // Le altre varianti della stessa famiglia completano i buchi: basta che UNA sia compilata
      // bene perché la card lo sia. Idem per "consigliato" e per il tag stagionale.
      if (clientName && existing.name === (existing.family || style)) existing.name = clientName;
      if (!existing.description && description) existing.description = description;
      if (!existing.highlights.length && highlights.length) existing.highlights = highlights;
      if (!existing.seasonalTag && d.seasonalTag) existing.seasonalTag = String(d.seasonalTag);
      if (d.recommended) existing.recommended = true;
    }
    return [...byFamily.values()];
  }

  /** Regimi configurati (config_param diet_regimes) o null se non impostati. */
  private async configuredRegimes(): Promise<{ code: string; label: string }[] | null> {
    const raw = await this.configParams.getString('diet_regimes', '');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { code?: unknown; label?: unknown }[];
      const list = (Array.isArray(parsed) ? parsed : [])
        .filter((r) => r && typeof r.code === 'string' && (r.code as string).trim())
        .map((r) => ({ code: String(r.code).trim(), label: String(r.label ?? r.code).trim() }));
      return list.length ? list : null;
    } catch {
      return null;
    }
  }

  async getQuestions() {
    const regimes = await this.configuredRegimes();
    if (!regimes) return ONBOARDING_QUESTIONS;
    // Clona (dati JSON-safe) e sostituisce le opzioni della domanda "regime".
    const q = JSON.parse(JSON.stringify(ONBOARDING_QUESTIONS)) as typeof ONBOARDING_QUESTIONS;
    const page = q.pages.find((p) => p.key === 'regime');
    const field = page?.fields.find((fl) => (fl as { key?: string }).key === 'regime') as
      | { options?: string[]; labels?: string[] }
      | undefined;
    if (field) {
      field.options = regimes.map((r) => r.code);
      field.labels = regimes.map((r) => r.label);
    }
    return q;
  }

  async submitAnswers(userId: string, dto: SubmitAnswersDto, ip?: string) {
    if (!dto.healthDataConsent) {
      throw new BadRequestException(
        'Per creare il percorso serve il consenso al trattamento dei dati sanitari.',
      );
    }

    // 1. Validazione obiettivo con soglie da config_param.
    const [sustainable, ambitious, unrealAction] = await Promise.all([
      this.configParams.getNumber('sustainable_rate_max_kg_week', 0.7),
      this.configParams.getNumber('ambitious_rate_max_kg_week', 1.0),
      this.configParams.getString('unreal_objective_action', 'warn'),
    ]);
    const validation = validateObjective({
      weightToLoseKg: dto.objective.weightToLoseKg,
      weeks: dto.objective.weeks,
      sustainableRateMaxKgWeek: sustainable,
      ambitiousRateMaxKgWeek: ambitious,
      unrealAction,
    });

    const effectiveWeeks = validation.accepted
      ? dto.objective.weeks
      : (validation.suggestedWeeks ?? dto.objective.weeks);
    const targetDate = new Date(Date.now() + effectiveWeeks * 7 * 86_400_000);

    // 2. Screening sanitario.
    const screeningFlag = computeScreeningFlag(dto.health);

    // 3. Team: coach e nutrizionista NON si assegnano in automatico — li assegna
    // il responsabile dal backoffice. Unica eccezione: il ref code inserito dalla
    // cliente in registrazione (di una coach O di una nutrizionista), già salvato
    // sul lead: qui lo si propaga soltanto al profilo.
    const record = await this.prisma.crmRecord.findUnique({
      where: { clientId: userId },
      select: { assignedCoachId: true, assignedNutritionistId: true },
    });
    const coachId = record?.assignedCoachId ?? null;
    /**
     * ⚠️ **LA NUTRIZIONISTA, SE NESSUNO L'HA ASSEGNATA** (21/8, dal caso Sonia).
     *
     * Il commento qui sopra resta vero il giorno in cui le nutrizioniste sono più d'una: distribuire
     * i pazienti è una decisione, e la prende il responsabile. Con **una sola** non è una decisione,
     * è un passaggio a mano — e quando salta, la cliente resta senza nessuno che risponda di lei:
     * Sonia ha finito il questionario il 7/8 con sei allergie dichiarate, e il 21/8 risultava
     * ancora «Nutrizionista: — nessuna —», con le sue segnalazioni cliniche nate senza destinatario.
     *
     * Chi risponde del ruolo è lo stesso che sceglie già `apri-segnalazione.ts` quando il ruolo non
     * è assegnato: il **capo nutrizionista**. Così le due strade dicono la stessa cosa.
     * Vedi `common/nutrizionista-di-riferimento.ts` per quando si spegne.
     */
    let nutritionistId = record?.assignedNutritionistId ?? null;
    if (!nutritionistId && (await this.configParams.getBool(PARAM_CAPO_PREDEFINITO, true))) {
      const capo = await nutrizionistaDiRiferimento(this.prisma as never);
      if (capo) {
        nutritionistId = capo.staffId;
        await this.audit.log({
          action: 'onboarding.nutrizionista_predefinita',
          actorId: userId,
          entityType: 'client_profile',
          entityId: userId,
          metadata: {
            staffId: capo.staffId,
            motivo: 'nessuna nutrizionista sul lead: presa in carico dal capo nutrizionista',
            // ⚠️ Quando questo numero non è più zero la regola ha fatto il suo tempo: si spegne
            // `assign_head_nutritionist_by_default` e si torna ad assegnare dal backoffice.
            altreNutrizioniste: capo.altre,
          },
        });
      }
    }

    // 4. Profilo (upsert: il questionario si può rifare, aggiorna il profilo).
    /**
     * LE INTOLLERANZE — adesso hanno anche loro il campo libero (13/8).
     *
     * L'opzione «Altro» esisteva senza nessun posto dove scrivere cosa: chi la sceglieva si portava
     * in banca dati la stringa `'other'`, che non è un alimento e non esclude niente. Con il campo,
     * `'other'` torna a essere un flag d'interfaccia e si toglie — ⚠️ **ma solo se lei ha scritto
     * cosa**: senza la risposta, quella stringa è l'unica traccia di un'intolleranza che non
     * sappiamo, ed è così che si trova chi ricontattare.
     */
    const intolleranze = intolleranzeDichiarate(dto.intolerances, dto.intolerancesOther);
    const intolleranzeInviate = intolleranze.intolerances;
    /**
     * LE ALLERGIE — la regola sta in `common/allergie.ts`, non qui.
     *
     * Fa tre cose che il server non faceva: toglie «altro» (un flag d'interfaccia, che veniva
     * filtrato **solo dal client React** — un'app vecchia lo salvava come allergene, ed
     * `expandExclusion('altro')` andava a cercare quella parola nei nomi dei piatti), tiene da
     * parte quali allergie sono **testo libero**, e segna **se la domanda ha avuto risposta**.
     *
     * Sta fuori di qui perché lo stesso calcolo servirà al dialogo con Gaia che ri-chiede le
     * allergie alle clienti già iscritte: due copie di una regola su un dato sanitario è la cosa
     * che si sta smettendo di fare.
     *
     * ⚠️ Si calcola UNA volta e vale per **entrambi i rami** dell'upsert: il ramo `update` è
     * quello che nessuno rilegge — l'8/8 è così che il questionario perdeva il consenso sanitario
     * e sei clienti sono rimaste bloccate al carrello.
     */
    const dichiarate = allergieDichiarate(dto.allergies, dto.allergiesOther, new Date());
    // Le spezie non entrano fra i cibi esclusi: escluderne una cancella dal ricettario tutti i
    // piatti che la contengono, ed è così che una cliente si è ritrovata lo stesso pranzo per
    // quattro giorni. Vedi `menu/spezie.ts`. Gli avvisi tornano alla fine, in coda al risultato.
    const { tenuti: dislikedFoods, avvisi: avvisiSpezie } = filtraSpezie(dto.dislikedFoods ?? []);
    /**
     * ⚠️ AIUTARE A SCRIVERE L'ELENCO ANCHE QUI (decisione di Simone, 18/8: «le esclusioni devono
     * essere un elenco, ogni parola seguita da una virgola, aiutiamo le clienti a scrivere in modo
     * corretto»). Il 18/8 la regola era arrivata su quattro porte — profilo, «non gradisco», scheda
     * backoffice, scheda coach — e **restava fuori proprio il questionario, che è la porta
     * d'ingresso vera**: è lì che quasi tutte le esclusioni vengono scritte la prima volta.
     *
     * ⚠️ Si guarda quello che è arrivato **prima** del filtro spezie, come fa il profilo: una frase
     * scritta male non è un problema di spezie, e vederla per prima è quello che le fa capire cosa
     * sta perdendo.
     *
     * ⚠️ **Qui NON si scarta e NON si blocca**, ed è la differenza con le altre quattro porte. Là
     * la voce non viene salvata e il testo torna nel campo, perché è a un dito da lei; qui siamo
     * dentro il questionario, che è il cancello del carrello: fermarlo per una frase scritta male
     * vorrebbe dire lasciare una cliente in mezzo al percorso. Si salva quello che ha scritto, si
     * dice cosa succede davvero, e le si dice dove correggerlo.
     */
    const aiutoEsclusioni = fraseAiutoEsclusioni(problemiEsclusioni(dto.dislikedFoods ?? []));
    // "Preferisco non specificare" → nessun valore enum (colonna sex nullable).
    const sexValue = (dto.sex === 'unspecified' ? null : dto.sex) as never;
    // CONSENSI — si calcolano UNA volta e valgono per entrambi i rami dell'upsert.
    //
    // Perché non stanno più scritti dentro `create`: ci stavano solo lì, e il ramo `update` li
    // saltava. Chiunque avesse già un profilo prima di compilare il questionario — i lead a cui
    // la coach manda le credenziali (il profilo nasce lì), chi ha ricevuto un codice invito, chi
    // è stato modificato da backoffice — finiva nel ramo `update`: `onboardingCompletedAt` veniva
    // scritto (quindi per l'app il questionario era FATTO e non glielo mostrava più) ma il
    // consenso sanitario no. Poi il carrello lo pretende (`commerce.service.checkout`) e blocca
    // l'acquisto chiedendo «completa prima il questionario»: l'unica cosa che quella cliente non
    // può più raggiungere. Vicolo cieco, e senza errore da nessuna parte.
    // Tre clienti bloccate così l'8/8 (Prova Gratuita nel carrello).
    //
    // Si UNISCE a quelli già presenti invece di sostituirli: un consenso raccolto altrove (marketing,
    // termini) non si perde perché la cliente rifà il questionario.
    const precedente = (await this.prisma.clientProfile.findUnique({
      where: { userId },
      select: {
        consents: true,
        onboardingCompletedAt: true,
        regime: true, dietStyle: true, dietFamily: true, mealsPerDay: true, pathType: true,
        // ⚠️ Servono per NON cancellarle: l'upsert è replace, e un reinvio che salta la pagina
        // delle allergie le azzererebbe. Vedi `common/non-perdere.ts`.
        allergies: true, allergiesOther: true, intolerances: true, intolerancesOther: true,
      },
    })) as {
      consents?: Record<string, unknown> | null;
      onboardingCompletedAt: Date | null;
      regime: string | null; dietStyle: string | null; dietFamily: string | null;
      mealsPerDay: number | null; pathType: string | null;
      allergies: string[]; allergiesOther: string[]; intolerances: string[]; intolerancesOther: string[];
    } | null;
    const consentiPrecedenti = precedente?.consents;

    /**
     * ⚠️ SI AGGIUNGE, NON SI CANCELLA — la regola sta in `common/non-perdere.ts`.
     *
     * L'upsert è **replace**: un reinvio del questionario che salta la pagina delle allergie
     * scriverebbe `allergies: []` e le farebbe sparire. La cliente non le modifica da nessuna
     * parte, quindi non se ne accorgerebbe e non potrebbe rimetterle: rimetterle è un lavoro per
     * un'altra persona, che però non sa di doverlo fare. È la terza volta che questo stesso upsert
     * perde qualcosa (l'8/8 il consenso sanitario, l'11/8 il tipo di dieta), e stavolta la regola
     * sta fuori così vale anche per il prossimo campo.
     *
     * `perse` = quello che il reinvio avrebbe tolto. Non sparisce nei due sensi: va nell'audit e
     * torna alla cliente come avviso.
     */
    const uAllergie = unioneSenzaPerdere(precedente?.allergies, dichiarate.allergies);
    const uAllergieAltro = unioneSenzaPerdere(precedente?.allergiesOther, dichiarate.allergiesOther);
    const uIntolleranze = unioneSenzaPerdere(precedente?.intolerances, intolleranzeInviate);
    const uIntolleranzeAltro = unioneSenzaPerdere(precedente?.intolerancesOther, intolleranze.intolerancesOther);
    const allergies = uAllergie.valori;
    const allergiesOther = uAllergieAltro.valori;
    /**
     * ⚠️ L'UNICA sottrazione ammessa: `'other'` sparisce quando arriva la risposta.
     *
     * `unioneSenzaPerdere` non toglie mai niente, ed è giusto — ma qui non si sta perdendo un dato,
     * si sta **sostituendo una domanda con la sua risposta**. Se lei scrive «i latticini» nel campo
     * nuovo, tenere anche il flag «Altro» vorrebbe dire lasciarla per sempre nell'elenco di quelle
     * da ricontattare per una cosa che ci ha appena detto.
     */
    const intolerances = intolleranze.scioglieIgnota
      ? uIntolleranze.valori.filter((v) => v.toLowerCase() !== INTOLLERANZA_IGNOTA)
      : uIntolleranze.valori;
    const intolerancesOther = uIntolleranzeAltro.valori;
    /** Quello che il questionario avrebbe tolto e che invece è rimasto. Da dire, non da nascondere. */
    const nonTolte = [...uAllergie.perse, ...uIntolleranze.perse];

    /**
     * ⚠️ LO STILE SI LEGGE DAL CATALOGO, NON SI CHIEDE ALLA CLIENTE (§16.10, 12/8).
     *
     * Lei sceglie un prodotto — «Mediterranea senza glutine» — e lo stile è una proprietà di quel
     * prodotto. Il DTO lo pretendeva ancora come campo obbligatorio: era l'ultimo punto in cui lo
     * stile sopravviveva come cosa che l'app deve sapere.
     *
     * ⚠️ Non si smette di SCRIVERLO: `pickDietFor` lo usa come co-filtro della famiglia, e una
     * famiglia senza stile può agganciare l'omonima di un altro stile. Si smette di chiederlo.
     *
     * ⚠️ Almeno uno dei due deve arrivare, e il controllo sta qui e non nel DTO perché qui si può
     * dire alla cliente **cosa fare** invece di elencarle il nome di un campo. Le app già installate
     * mandano solo `dietStyle` e continuano a funzionare senza toccare niente.
     */
    const stileRisolto =
      dto.dietStyle ??
      (await stileDellaFamiglia(
        (where) => this.prisma.diet.findFirst({ where: where as never, select: { style: true } }) as Promise<{ style: string } | null>,
        dto.dietFamily,
      ));
    if (!stileRisolto && !precedente?.onboardingCompletedAt) {
      throw new BadRequestException('Scegli il percorso che preferisci: tocca una delle diete proposte.');
    }

    /**
     * ⚠️ IL QUESTIONARIO SI FA UNA VOLTA SOLA, E DOPO NON DECIDE PIÙ LA DIETA.
     *
     * Regola di Simone (11/8): «il cliente può fare il questionario solo una volta, al primo
     * accesso. Da lì in poi il nutrizionista, la coach o admin possono cambiare la dieta. Il cliente
     * non è autorizzato a cambiarla: se vuole cambiarla deve chiedere a coach o nutrizionista.»
     *
     * Cosa succedeva prima: questo è un `upsert`, e il ramo `update` riscriveva **ogni volta** e
     * senza condizioni `regime`, `dietStyle`, `dietFamily`, `mealsPerDay` e `pathType` prendendoli
     * dalle risposte. Bastava un secondo invio del questionario per **cancellare la decisione della
     * nutrizionista** e rimettere la dieta scelta in registrazione — senza errore, senza riga di
     * audit, perché formalmente è un'azione della cliente sul proprio questionario.
     *
     * Trovato l'11/8 su `sim1one.salogni@gmail.com`: la dieta era stata spostata da Pescetariana a
     * Mediterranea **due volte**, da due persone diverse, e tutte e due le volte era tornata
     * indietro. Nessuno se n'era accorto perché non lasciava traccia.
     *
     * È la stessa lezione dell'8/8 sul consenso sanitario perso: **un upsert sono due scritture, e
     * il ramo `update` è quello che nessuno rilegge.**
     *
     * Il resto del questionario (misure, obiettivo, preferenze, allergie, consensi) continua ad
     * aggiornarsi: qui si congela SOLO il tipo di dieta. E se un reinvio prova a cambiarlo, la cosa
     * si **scrive nell'audit** invece di sparire — la prossima volta si vede in dieci secondi.
     */
    const giaFatto = !!precedente?.onboardingCompletedAt;
    /** Il percorso che vale davvero: quello scritto, se il questionario è già stato fatto. */
    const percorsoInVigore = giaFatto ? precedente?.pathType ?? dto.pathType : dto.pathType;
    const tipoDiDieta = giaFatto
      ? {}
      : {
          regime: dto.regime as never,
          dietStyle: stileRisolto as never,
          // Famiglia scelta: null se l'app è una versione vecchia che manda solo lo stile.
          dietFamily: (dto.dietFamily ?? null) as never,
          mealsPerDay: dto.mealsPerDay,
          pathType: dto.pathType as never,
        };
    if (giaFatto) {
      const proposto = {
        regime: dto.regime ?? null,
        dietStyle: stileRisolto ?? null,
        dietFamily: dto.dietFamily ?? null,
        mealsPerDay: dto.mealsPerDay ?? null,
        pathType: dto.pathType ?? null,
      };
      const attuale = {
        regime: precedente?.regime ?? null,
        dietStyle: precedente?.dietStyle ?? null,
        dietFamily: precedente?.dietFamily ?? null,
        mealsPerDay: precedente?.mealsPerDay ?? null,
        pathType: precedente?.pathType ?? null,
      };
      const diversi = (Object.keys(proposto) as (keyof typeof proposto)[]).filter((k) => proposto[k] !== attuale[k]);
      if (diversi.length) {
        await this.audit.log({
          action: 'onboarding.tipo_dieta_ignorato',
          actorId: userId,
          entityType: 'client_profile',
          entityId: userId,
          metadata: { campi: diversi, proposto, attuale, motivo: 'questionario già completato: il tipo di dieta lo cambia solo lo staff' },
        });
      }
    }
    const consentsPayload = {
      ...(consentiPrecedenti ?? {}),
      ...(dto.consents ?? {}),
      healthDataConsent: { accepted: true, at: new Date().toISOString() },
    };
    const profile = await this.prisma.clientProfile.upsert({
      where: { userId },
      create: {
        userId,
        name: dto.name,
        age: dto.age,
        sex: sexValue,
        heightCm: dto.heightCm,
        startWeightKg: dto.startWeightKg,
        startWaistCm: dto.startWaistCm,
        startHipsCm: dto.startHipsCm,
        regime: dto.regime as never,
        dietStyle: stileRisolto as never,
        // Famiglia scelta: null se l'app è una versione vecchia che manda solo lo stile.
        dietFamily: (dto.dietFamily ?? null) as never,
        mealsPerDay: dto.mealsPerDay,
        pathType: dto.pathType as never,
        /**
         * ⛔ **La finestra NON si scrive più dal questionario** (21/8). Chi sceglie il digiuno finisce
         * qui **senza** finestra, ed è voluto: `fastingSceltoIl` resta NULL, quindi al primo avvio
         * dell'app atterra sulla pagina dell'orologio e la sceglie lì, vedendo la sua giornata
         * invece di una tendina. ⚠️ Intanto non le manca niente: senza finestra il motore non salta
         * nessun pasto.
         */
        // Livello di attività (voce #15): senza questo il fabbisogno gira col fattore di default.
        activityLevel: (dto.activityLevel ?? null) as never,
        coachStyle: dto.coachStyle as never,
        character: dto.character as never,
        allergies,
        allergiesOther,
        // ⚠️ Solo se la domanda ha avuto risposta. Se qui arrivasse `null` su un profilo che ce
        // l'aveva, si perderebbe la data di una dichiarazione vera: `?? undefined` lascia stare
        // il campo invece di azzerarlo (l'upsert è replace, non merge).
        allergieDichiarateIl: dichiarate.allergieDichiarateIl ?? undefined,
        intolerances,
        intolerancesOther,
        dislikedFoods,
        lifestyle: (dto.lifestyle ?? undefined) as never,
        themeColor: dto.themeColor,
        assignedCoachId: coachId,
        assignedNutritionistId: nutritionistId,
        consents: consentsPayload as never,
        screeningFlag,
        onboardingAnswers: dto as never,
        onboardingCompletedAt: new Date(),
      },
      update: {
        name: dto.name,
        age: dto.age,
        sex: sexValue,
        heightCm: dto.heightCm,
        startWeightKg: dto.startWeightKg,
        startWaistCm: dto.startWaistCm,
        startHipsCm: dto.startHipsCm,
        // ⚠️ Il tipo di dieta c'è SOLO al primo invio: vedi il commento su `tipoDiDieta`.
        ...tipoDiDieta,
        /**
         * ⛔ **RIFARE IL QUESTIONARIO NON TOCCA L'OROLOGIO — a meno che non digiuni più.**
         *
         * La finestra non si sceglie più da qui, quindi un reinvio non ha niente da scrivere: se lo
         * facesse, cancellerebbe la finestra che la cliente ha impostato dall'app.
         *
         * ⚠️ **Ma se il percorso in vigore non è più il digiuno, l'orologio si azzera tutto**, e non
         * solo la finestra. Lasciare `fastingSceltoIl` valorizzato a chi non digiuna più vuol dire
         * che il giorno in cui tornasse al digiuno **non le verrebbe più chiesto niente**: si
         * ritroverebbe la finestra di sei mesi prima, senza che nessuno gliel'abbia chiesta. È
         * esattamente il difetto da cui è nata tutta questa parte.
         */
        // ⚠️ L'elenco sta in `menu/uscita-dal-digiuno.ts`, con le altre tre porte che tolgono una
        // cliente dal digiuno: sette nomi copiati in quattro punti divergono per costruzione, e il
        // 21/8 tre di quei quattro erano gia divergenti.
        ...(percorsoInVigore === 'intermittent_fasting' ? {} : orologioAzzerato()),
        // Livello di attività (voce #15): senza questo il fabbisogno gira col fattore di default.
        activityLevel: (dto.activityLevel ?? null) as never,
        coachStyle: dto.coachStyle as never,
        character: dto.character as never,
        allergies,
        allergiesOther,
        // ⚠️ Solo se la domanda ha avuto risposta. Se qui arrivasse `null` su un profilo che ce
        // l'aveva, si perderebbe la data di una dichiarazione vera: `?? undefined` lascia stare
        // il campo invece di azzerarlo (l'upsert è replace, non merge).
        allergieDichiarateIl: dichiarate.allergieDichiarateIl ?? undefined,
        intolerances,
        intolerancesOther,
        /**
         * ⚠️ I cibi non graditi si comportano diversamente dalle allergie, ed è voluto.
         *
         * Questi la cliente **li gestisce da sola** dal Profilo: qui il questionario è un editor
         * legittimo, e se manda un elenco quello vale — togliere un cibo non gradito è una cosa che
         * ha il diritto di fare. Ma se **non manda il campo** (app vecchia, pagina saltata) non si
         * tocca niente: l'assenza non è una risposta.
         */
        dislikedFoods: soloSeMandato(dto.dislikedFoods == null ? undefined : dislikedFoods),
        lifestyle: (dto.lifestyle ?? undefined) as never,
        themeColor: dto.themeColor,
        // Il consenso sanitario va scritto anche qui: è il ramo di chi aveva già un profilo, ed è
        // esattamente quello in cui mancava. Vedi il commento su `consentsPayload`.
        consents: consentsPayload as never,
        screeningFlag,
        onboardingAnswers: dto as never,
        onboardingCompletedAt: new Date(),
      },
    });

    /**
     * ⚠️ **IL RAMO `update` NON ASSEGNA** — e questo è il ramo di chi il questionario lo rifà.
     *
     * L'assegnazione qui sopra sta solo nel `create`, ed è giusto che l'`update` non la tocchi: una
     * cliente spostata a mano non deve tornare indietro perché ha rifatto il questionario. Ma
     * «non sovrascrivere» e «non riempire il vuoto» sono due cose diverse, e finora erano la stessa:
     * chi era arrivata qui senza nessuno restava senza nessuno per sempre.
     *
     * `agganciaAssegnazioneAlProfilo` è la porta unica del 6/8 e fa esattamente la distinzione:
     * riempie solo i campi vuoti, non sovrascrive mai. (Un upsert sono due scritture, e il ramo
     * `update` è quello che nessuno rilegge.)
     */
    await agganciaAssegnazioneAlProfilo(this.prisma, userId, {
      assignedCoachId: coachId,
      assignedNutritionistId: nutritionistId,
    }).catch(() => undefined);

    /**
     * Se il reinvio avrebbe tolto un'allergia o un'intolleranza, resta scritto CHE ci ha provato.
     *
     * È la stessa scelta fatta l'11/8 per il tipo di dieta: non basta impedire la perdita, deve
     * restare la traccia — altrimenti fra un mese nessuno sa se quella cliente ha davvero ancora
     * quell'allergia o se se l'è portata dietro un'app vecchia. Con la riga, si guarda in dieci
     * secondi.
     */
    if (nonTolte.length) {
      await this.audit.log({
        action: 'onboarding.esclusioni_non_tolte',
        actorId: userId,
        entityType: 'client_profile',
        entityId: userId,
        metadata: {
          allergie: uAllergie.perse,
          intolleranze: uIntolleranze.perse,
          motivo: 'il questionario può aggiungere allergie e intolleranze, non toglierle: le toglie la nutrizionista',
        },
      });
    }

    // 5. Obiettivo (status proposed: verrà confermato da coach + nutrizionista).
    const targetWeightKg =
      Math.round((dto.startWeightKg - dto.objective.weightToLoseKg) * 10) / 10;
    const objective = await this.prisma.objective.create({
      data: {
        clientId: userId,
        targetWeightKg,
        targetWaistCm: dto.startWaistCm && dto.objective.waistToLoseCm
          ? dto.startWaistCm - dto.objective.waistToLoseCm
          : null,
        targetHipsCm: dto.startHipsCm && dto.objective.hipsToLoseCm
          ? dto.startHipsCm - dto.objective.hipsToLoseCm
          : null,
        targetDate,
        status: 'proposed',
        history: [
          {
            at: new Date().toISOString(),
            event: 'created_from_onboarding',
            pace: validation.pace,
            ratePerWeek: validation.ratePerWeek,
            requestedWeeks: dto.objective.weeks,
            effectiveWeeks,
          },
        ] as never,
      },
    });

    // 5-bis. Prima misura = punto di partenza dichiarato nell'onboarding.
    // Così la schermata "I tuoi obiettivi" si popola subito (grafici e progressi)
    // invece di restare vuota. Non sovrascrive eventuali misure già inserite.
    try {
      /**
       * ⛔ **IL GIORNO È QUELLO DI ROMA, e qui costava il peso dichiarato** (25/8, censimento).
       *
       * Era `new Date()` + `setHours(0, 0, 0, 0)`: il fuso del **processo**, che su Render è UTC.
       * Fra la mezzanotte e le 02:00 italiane questa riga rispondeva **ieri**, e chi finiva il
       * questionario a quell'ora si vedeva il peso di partenza archiviato al giorno prima.
       *
       * ⛔ Non era solo un punto spostato sul grafico. `measurement` ha la chiave unica
       * `(cliente, data)` e qui si scrive in `upsert` con `update: {}`: se per quel giorno una
       * misura esisteva già, **il peso dichiarato spariva in silenzio**. E sulla stessa colonna
       * `signals.service` scrive con `toDateOnly()` — cioè c'erano **due definizioni di giorno sulla
       * stessa chiave unica**, che è il modo in cui due scritture si scambiano il posto senza che
       * nessuna delle due fallisca.
       *
       * ⚠️ Tocca anche «Non ha seguito» (`commerce/non-ha-seguito.ts`), che riconosce la misura del
       * questionario **dalla sua data**: con la data di ieri non la riconosceva più.
       */
      const startDate = toDateOnly();
      await this.prisma.measurement.upsert({
        where: { clientId_date: { clientId: userId, date: startDate } },
        create: {
          clientId: userId,
          date: startDate,
          weightKg: dto.startWeightKg,
          waistCm: dto.startWaistCm ?? null,
          hipsCm: dto.startHipsCm ?? null,
        },
        update: {},
      });
    } catch {
      /* la misura di partenza è best-effort: non deve bloccare l'onboarding */
    }

    // 6. Screening → presa in carico dal nutrizionista assegnato.
    if (screeningFlag) {
      await this.prisma.escalation.create({
        data: {
          clientId: userId,
          reason:
            'Screening onboarding: condizione clinica o farmaci dichiarati — percorso supervisionato.',
          source: 'screening',
          category: 'clinical' as never,
          assignedToId: nutritionistId ?? undefined,
        },
      });
    }
    /**
     * «Serve la visita» anche per la SOLA ALLERGIA (criteri Nocanty 13/8, Decisioni §15): lo
     * screening sopra copre farmaci e patologie, ma un'allergia dichiarata senza nient'altro non
     * apriva niente. Il dedup di `apriSegnalazione` evita il doppione quando lo screening ha già
     * aperto la sua. Non lancia mai: il questionario è già salvato e tale resta.
     */
    await apriServeVisita(this.prisma, userId, 'questionario');

    if (validation.requiresNutritionist) {
      await this.prisma.escalation.create({
        data: {
          clientId: userId,
          reason: `Obiettivo oltre il ritmo sostenibile (${validation.ratePerWeek} kg/sett.): richiede conferma del nutrizionista.`,
          source: 'screening',
          category: 'clinical' as never,
          assignedToId: nutritionistId ?? undefined,
        },
      });
    }

    await this.audit.log({
      action: 'onboarding.completed',
      actorId: userId,
      entityType: 'client_profile',
      entityId: profile.id,
      metadata: { screeningFlag, pace: validation.pace },
      ipAddress: ip,
    });

    // SENZA GLUTINE: se l'ha dichiarato nel questionario, la variante dedicata gliela assegniamo
    // noi e glielo diciamo (richiesta di Simone del 9/8). Prima dell'agente esclusioni, perché la
    // base personale si costruisce sulla dieta: assegnarla dopo vorrebbe dire costruirla su quella
    // sbagliata e rifarla al primo trigger.
    // Non deve mai far fallire l'onboarding: se la variante non è in catalogo apre una segnalazione
    // alla nutrizionista e non promette niente alla cliente (vedi `senza-glutine.ts`).
    try {
      await assegnaSenzaGlutineEAvvisa(this.prisma as never, userId);
    } catch {
      /* non bloccante: il glutine resta comunque escluso dai menu dalle esclusioni del profilo */
    }

    // R8 — Agente esclusioni: costruisce la base personalizzata sicura. Non deve MAI far
    // fallire l'onboarding: se non è certificabile in automatico apre da sé una segnalazione
    // al nutrizionista, quindi qui assorbiamo eventuali errori imprevisti.
    try {
      await this.personalBase.buildPersonalBase(userId);
    } catch {
      /* non bloccante: la base verrà rigenerata al primo trigger utile */
    }

    // PIPELINE: il questionario è compilato → la scheda passa a "Questionario completato".
    // È la richiesta delle coach dell'8/8: sulla board devono vedere a colpo d'occhio chi è
    // pronta per la chiamata senza aprire una scheda alla volta.
    // Non fa retrocedere: se ha già comprato, o una coach l'ha già spostata avanti a mano,
    // resta dov'è (vedi `commerce/avanza-stato.ts`).
    await avanzaStatoSeIndietro(this.prisma as never, userId, 'questionnaire_done', userId);

    // …e la coach lo scopre subito, non aprendo la board. È il momento in cui una telefonata
    // vale di più: la cliente ha appena raccontato obiettivi, abitudini e paure, e si aspetta
    // che qualcuno le abbia lette. Il `clientId` nel payload apre la scheda con un tocco.
    try {
      const coach = (await this.prisma.clientProfile.findUnique({
        where: { userId },
        select: { name: true, assignedCoach: { select: { userId: true } } },
      })) as { name: string | null; assignedCoach: { userId: string } | null } | null;
      if (coach?.assignedCoach) {
        await this.notifications.notify({
          userId: coach.assignedCoach.userId,
          type: 'client_questionnaire_done',
          title: 'Questionario completato',
          body: `${coach.name ?? 'Una tua cliente'} ha completato il questionario: è pronta per la chiamata.`,
          payload: { clientId: userId },
        });
      }
    } catch {
      /* una notifica mancata non deve far fallire il questionario appena compilato */
    }

    const risultato = await this.buildResult(userId, {
      objectiveValidation: validation,
      objectiveId: objective.id,
    });
    // Se ha scritto una spezia fra i cibi non graditi glielo diciamo qui, con le parole della
    // nutrizionista: il termine non è stato salvato, e deve saperlo lei, non solo il database.
    /**
     * ⚠️ E se il reinvio avrebbe TOLTO un'allergia o un'intolleranza, glielo si dice.
     *
     * Tenerle senza dirlo sarebbe metà lavoro: lei crede di averle tolte, i menu continuano a
     * escluderle, e la prossima volta che ne parla con la coach nessuna delle due capisce.
     * L'audit serve allo staff, questa frase serve a lei.
     */
    const avvisiEsclusioni = nonTolte.length
      ? [
          `Restano registrate: ${nonTolte.join(', ')}. Le allergie e le intolleranze non si tolgono ` +
            'dal questionario — scrivilo alla tua nutrizionista e le corregge lei.',
        ]
      : [];
    return {
      ...risultato,
      ...(avvisiSpezie.length ? { avvisiSpezie } : {}),
      ...(avvisiEsclusioni.length ? { avvisiEsclusioni } : {}),
      // ⚠️ Campo SUO, e non dentro `avvisiEsclusioni`: quella lista l'app la mostra sotto il titolo
      // «Allergie e intolleranze», e questa non è né l'una né l'altra. Un campo nuovo che l'app
      // vecchia ignora è anche il modo di non far comparire una frase sotto il cartello sbagliato
      // finché non esce l'aggiornamento.
      ...(aiutoEsclusioni ? { aiutoEsclusioni } : {}),
    };
  }

  async getResult(userId: string) {
    return this.buildResult(userId, {});
  }

  // ---------- Interni ----------

  private async buildResult(
    userId: string,
    extra: { objectiveValidation?: unknown; objectiveId?: string },
  ) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId },
      include: {
        assignedCoach: { select: { id: true, displayName: true } },
        assignedNutritionist: { select: { id: true, displayName: true } },
      },
    });
    if (!profile || !profile.onboardingCompletedAt) {
      throw new NotFoundException('Onboarding non ancora completato');
    }
    const objective = await this.prisma.objective.findFirst({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      path: this.describePath(profile),
      screeningFlag: profile.screeningFlag,
      supervisedPath: profile.screeningFlag,
      team: {
        coach: profile.assignedCoach,
        nutritionist: profile.assignedNutritionist,
      },
      objective,
      ...(extra.objectiveValidation ? { objectiveValidation: extra.objectiveValidation } : {}),
      profileId: profile.id,
    };
  }

  /** Nome parlante del percorso consigliato (es. "Equilibrio Mediterraneo · 5 pasti"). */
  private describePath(profile: {
    dietStyle: string | null;
    mealsPerDay: number | null;
    pathType: string | null;
    regime: string | null;
  }): { name: string; tags: string[] } {
    const styleNames: Record<string, string> = {
      mediterranean: 'Equilibrio Mediterraneo',
      protein: 'Slancio Proteico',
      low_carb: 'Leggerezza Low-carb',
      flexible: 'Percorso Flessibile',
      keto: 'Percorso Keto',
      keto_mediterranean: 'Percorso Keto-Mediterraneo',
    };
    const pathNames: Record<string, string> = {
      classic3: '3 pasti classico',
      five: '5 pasti',
      supplements: 'con integratori',
      intermittent_fasting: 'digiuno intermittente',
    };
    const regimeNames: Record<string, string> = {
      omnivore: 'onnivoro',
      vegetarian: 'vegetariano',
      vegan: 'vegano',
    };
    const tags = Array.from(
      new Set(
        [
          profile.pathType ? pathNames[profile.pathType] : null,
          profile.regime ? regimeNames[profile.regime] : null,
          profile.mealsPerDay ? `${profile.mealsPerDay} pasti` : null,
        ].filter((t): t is string => Boolean(t)),
      ),
    );
    return {
      name: profile.dietStyle ? (styleNames[profile.dietStyle] ?? 'Percorso personalizzato') : 'Percorso personalizzato',
      tags,
    };
  }

}
