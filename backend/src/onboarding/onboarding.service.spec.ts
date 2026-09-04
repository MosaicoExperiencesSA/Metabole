import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PersonalBaseService } from '../personal-base/personal-base.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { OnboardingService } from './onboarding.service';
import { conOrologioFermo } from '../../test/orologio-fermo';

const baseAnswers = (): SubmitAnswersDto =>
  ({
    name: 'Giulia',
    age: 34,
    sex: 'female',
    heightCm: 168,
    startWeightKg: 68,
    startWaistCm: 80,
    startHipsCm: 99,
    regime: 'omnivore',
    dietStyle: 'mediterranean',
    intolerances: ['none'],
    dislikedFoods: ['funghi'],
    lifestyle: { work: 'sedentary', cookingTime: 'some', weekdayLunch: 'out' },
    mealsPerDay: 5,
    pathType: 'five',
    health: { hasConditions: 'no', takesMedications: 'no' },
    objective: { weightToLoseKg: 6, weeks: 18, waistToLoseCm: 8 },
    coachStyle: 'when_needed',
    character: 'needs_push',
    themeColor: '#12A386',
    healthDataConsent: true,
  }) as SubmitAnswersDto;

describe('OnboardingService', () => {
  let service: OnboardingService;
  let prisma: any;
  let audit: { log: jest.Mock } = { log: jest.fn() };
  // Accessibile ai test: `assign_head_nutritionist_by_default` si deve poter spegnere.
  let configParams: { getNumber: jest.Mock; getString: jest.Mock; getBool: jest.Mock };

  beforeEach(async () => {
    prisma = {
      clientProfile: {
        upsert: jest.fn().mockResolvedValue({ id: 'p1', screeningFlag: false }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          userId: 'u1',
          screeningFlag: false,
          onboardingCompletedAt: new Date(),
          dietStyle: 'mediterranean',
          mealsPerDay: 5,
          pathType: 'five',
          regime: 'omnivore',
          assignedCoach: { id: 's-c', displayName: 'Marta' },
          assignedNutritionist: { id: 's-n', displayName: 'Dr.ssa Bini' },
        }),
      },
      objective: {
        create: jest.fn().mockResolvedValue({ id: 'o1' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'o1', status: 'proposed' }),
      },
      escalation: { create: jest.fn().mockResolvedValue({ id: 'e1' }) },
      /**
       * ⛔ **Mancava, e per questo il difetto del peso di partenza è vissuto fino al 25/8.** La
       * scrittura della prima misura sta dentro un `try/catch` che inghiotte tutto (è best-effort:
       * non deve bloccare il questionario), quindi senza questo finto la chiamata falliva in
       * silenzio a ogni test e **nessuno guardava con che data veniva scritta**. Un finto che manca
       * non fa fallire niente: fa passare tutto.
       */
      measurement: { upsert: jest.fn().mockResolvedValue({ id: 'm1' }) },
      // §16.10: se il questionario manda solo la FAMIGLIA, lo stile si legge dal catalogo.
      diet: { findFirst: jest.fn().mockResolvedValue({ style: 'flexible' }) },
      crmRecord: { findUnique: jest.fn().mockResolvedValue(null) },
      staff: {
        findMany: jest.fn().mockResolvedValue([
          { id: 's-a', displayName: 'A', _count: { clientsAsCoach: 5 } },
          { id: 's-b', displayName: 'B', _count: { clientsAsCoach: 2 } },
        ]),
      },
    };
    configParams = {
      getNumber: jest.fn((key: string) =>
        Promise.resolve(key === 'sustainable_rate_max_kg_week' ? 0.7 : 1.0),
      ),
      // ⚠️ La coach di riserva (4/9) legge `coach_di_riserva` di qui: nel test è spenta.
      getString: jest.fn(async (k: string) => (k === 'coach_di_riserva' ? 'off' : 'warn')),
      // `assign_head_nutritionist_by_default` (21/8): il finto deve avere i metodi che il
      // servizio usa davvero, altrimenti verifica una versione del mondo che non esiste.
      getBool: jest.fn(async (_k: string, d?: boolean) => d ?? false),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: configParams },
        { provide: AuditService, useValue: audit },
        { provide: PersonalBaseService, useValue: { buildPersonalBase: jest.fn().mockResolvedValue(undefined) } },
        // Serve per la notifica alla coach a questionario completato: qui basta che non esploda.
        { provide: NotificationsService, useValue: { notify: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    service = moduleRef.get(OnboardingService);
  });

  it('senza consenso ai dati sanitari rifiuta (GDPR)', async () => {
    const dto = { ...baseAnswers(), healthDataConsent: false };
    await expect(service.submitAnswers('u1', dto)).rejects.toThrow(BadRequestException);
  });

  /**
   * L'8/8 tre clienti sono rimaste bloccate al carrello della Prova Gratuita: il consenso
   * sanitario era scritto SOLO nel ramo `create` dell'upsert, quindi chi aveva già un profilo
   * (i lead a cui la coach manda le credenziali, il codice invito, la modifica da backoffice)
   * finiva nel ramo `update` e restava senza consenso — con `onboardingCompletedAt` scritto, cioè
   * senza più il questionario da cui rimediare. Nessun test e nessun tipo se ne accorgeva.
   */
  describe('consenso sanitario in ENTRAMBI i rami', () => {
    const consensoDi = (ramo: 'create' | 'update') =>
      prisma.clientProfile.upsert.mock.calls[0][0][ramo].consents as {
        healthDataConsent?: { accepted?: boolean };
      };

    it('profilo NUOVO: il consenso è scritto', async () => {
      prisma.clientProfile.findUnique.mockResolvedValueOnce(null);
      await service.submitAnswers('u1', baseAnswers());
      expect(consensoDi('create').healthDataConsent?.accepted).toBe(true);
    });

    it('profilo GIÀ ESISTENTE (lead con credenziali): il consenso è scritto anche nell\'update', async () => {
      await service.submitAnswers('u1', baseAnswers());
      expect(consensoDi('update').healthDataConsent?.accepted).toBe(true);
    });

    it('i consensi raccolti altrove non si perdono quando il questionario si rifà', async () => {
      prisma.clientProfile.findUnique.mockResolvedValueOnce({
        consents: { marketing: { accepted: true }, healthDataConsent: { accepted: true, at: '2026-01-01T00:00:00.000Z' } },
      });
      await service.submitAnswers('u1', baseAnswers());
      const consents = consensoDi('update') as Record<string, unknown>;
      expect(consents.marketing).toEqual({ accepted: true });
      // Il consenso sanitario si riscrive con la data nuova, non si duplica né si perde.
      expect((consents.healthDataConsent as { accepted: boolean }).accepted).toBe(true);
      expect((consents.healthDataConsent as { at: string }).at).not.toBe('2026-01-01T00:00:00.000Z');
    });
  });

  /**
   * ⚠️ «ALTRO» NON È UN ALIMENTO — e il filtro stava solo nel client (12/8).
   *
   * `'altro'` serve a far comparire il campo libero e veniva tolto **soltanto** da
   * `app/src/pages/Onboarding.tsx`. Il server lo salvava: chi chiama l'endpoint direttamente, o
   * usa un'app vecchia, si porta in banca dati un allergene che si chiama «altro», ed
   * `expandExclusion('altro')` va a cercare quella parola nei nomi dei piatti.
   *
   * Il ramo `update` si verifica **separatamente** dal `create`, e non per pignoleria: l'8/8 il
   * consenso sanitario era scritto solo nel `create` e sei clienti sono rimaste bloccate al
   * carrello, senza errore da nessuna parte.
   */
  describe('«altro» non finisce in banca dati come allergene', () => {
    const allergieDi = (ramo: 'create' | 'update') =>
      prisma.clientProfile.upsert.mock.calls[0][0][ramo].allergies as string[];

    it('ramo CREATE: il flag si toglie, il testo libero resta', async () => {
      prisma.clientProfile.findUnique.mockResolvedValueOnce(null);
      await service.submitAnswers('u1', {
        ...baseAnswers(), allergies: ['latte', 'altro'], allergiesOther: ['fragole'],
      });
      expect(allergieDi('create')).toEqual(['latte', 'fragole']);
    });

    it('ramo UPDATE: **anche qui** — è quello che nessuno rilegge', async () => {
      await service.submitAnswers('u1', {
        ...baseAnswers(), allergies: ['latte', 'altro'], allergiesOther: ['fragole'],
      });
      expect(allergieDi('update')).toEqual(['latte', 'fragole']);
    });

    it('e non si perde niente quando «altro» non c\'è', async () => {
      await service.submitAnswers('u1', { ...baseAnswers(), allergies: ['latte', 'uova'] });
      expect(allergieDi('update')).toEqual(['latte', 'uova']);
    });

    it('⚠️ «Non ho allergie» È UNA RISPOSTA: non lascia allergeni, ma la domanda risulta fatta', async () => {
      // È il senso dell'opzione aggiunta il 13/8. Senza, `allergies: []` voleva dire due cose
      // indistinguibili — «non ne ho» e «ho saltato la pagina» — e nessun campo lì è obbligatorio.
      prisma.clientProfile.findUnique.mockResolvedValueOnce(null);
      await service.submitAnswers('u1', { ...baseAnswers(), allergies: ['nessuna'] });
      const creato = prisma.clientProfile.upsert.mock.calls[0][0].create;
      expect(creato.allergies).toEqual([]);
      expect(creato.allergieDichiarateIl).toBeInstanceOf(Date);
    });

    it('⚠️ la pagina SALTATA invece resta senza data: è il caso che la colonna distingue', async () => {
      prisma.clientProfile.findUnique.mockResolvedValueOnce(null);
      const dto = { ...baseAnswers() };
      delete (dto as Record<string, unknown>).allergies;
      await service.submitAnswers('u1', dto);
      expect(prisma.clientProfile.upsert.mock.calls[0][0].create.allergieDichiarateIl).toBeUndefined();
    });

    it('⚠️ ma «other» fra le INTOLLERANZE resta: è l\'unica traccia di quello che non sappiamo', async () => {
      // Non ha un campo libero associato, quindi quella stringa dice «ha un'intolleranza che noi
      // non conosciamo». Toglierla cancellerebbe la sola cosa che permette di ricontattarla — ed è
      // la popolazione più urgente da ricontattare.
      await service.submitAnswers('u1', { ...baseAnswers(), intolerances: ['other'] });
      expect(prisma.clientProfile.upsert.mock.calls[0][0].update.intolerances).toEqual(['other']);
    });
  });

  /**
   * ⚠️ IL QUESTIONARIO PUÒ AGGIUNGERE, NON PUÒ CANCELLARE (12/8).
   *
   * L'upsert è **replace**: il ramo `update` riscrive i campi con quello che arriva. Se il DTO non
   * porta `allergies`, la riga diventava `allergies: []` — e le allergie **sparivano**. Nessun
   * errore, nessuna traccia.
   *
   * Non è un caso di laboratorio: il questionario si rifà, nessun campo di quella pagina è
   * obbligatorio, e un'app vecchia manda solo i campi che conosce. E allergie e intolleranze le
   * scrive **un solo punto in tutto il codice**, questo: cancellate qui, sono cancellate e basta.
   *
   * È il terzo campo che questo stesso upsert perdeva — l'8/8 il consenso sanitario, l'11/8 il tipo
   * di dieta. Stavolta la regola sta fuori (`common/non-perdere.ts`), così vale anche per il quarto.
   */
  describe('un reinvio non cancella allergie e intolleranze', () => {
    const upsert = () => prisma.clientProfile.upsert.mock.calls[0][0];
    /** Una cliente che ha già dichiarato le sue, e rifà il questionario. */
    const conProfilo = (over: Record<string, unknown> = {}) => {
      prisma.clientProfile.findUnique.mockResolvedValue({
        id: 'p1', userId: 'u1', screeningFlag: false, onboardingCompletedAt: new Date(),
        dietStyle: 'mediterranean', mealsPerDay: 5, pathType: 'five', regime: 'omnivore',
        allergies: ['latte', 'uova'], allergiesOther: [], intolerances: ['lattosio'], intolerancesOther: [],
        assignedCoach: { id: 's-c', displayName: 'Marta' },
        assignedNutritionist: { id: 's-n', displayName: 'Dr.ssa Bini' },
        ...over,
      });
    };

    it('⚠️ pagina saltata (campo assente): le allergie NON si azzerano', async () => {
      conProfilo();
      const dto = { ...baseAnswers() };
      delete (dto as Record<string, unknown>).allergies;
      await service.submitAnswers('u1', dto);
      expect(upsert().update.allergies).toEqual(['latte', 'uova']);
    });

    it('⚠️ e nemmeno le intolleranze', async () => {
      conProfilo();
      const dto = { ...baseAnswers() };
      delete (dto as Record<string, unknown>).intolerances;
      await service.submitAnswers('u1', dto);
      expect(upsert().update.intolerances).toEqual(['lattosio']);
    });

    it('⚠️ manda solo una delle due: l\'altra resta', async () => {
      conProfilo();
      await service.submitAnswers('u1', { ...baseAnswers(), allergies: ['latte'] });
      expect(upsert().update.allergies).toEqual(['latte', 'uova']);
    });

    it('quello che aggiunge si aggiunge', async () => {
      conProfilo();
      await service.submitAnswers('u1', { ...baseAnswers(), allergies: ['latte', 'uova', 'pesce'] });
      expect(upsert().update.allergies).toEqual(['latte', 'uova', 'pesce']);
    });

    it('⚠️ non sparisce nei due sensi: resta l\'audit E lo si dice alla cliente', async () => {
      // Tenerle senza dirlo sarebbe metà lavoro: lei crede di averle tolte, i menu continuano a
      // escluderle, e la volta dopo che ne parla con la coach nessuna delle due capisce.
      conProfilo();
      const dto = { ...baseAnswers() };
      delete (dto as Record<string, unknown>).allergies;
      const esito = (await service.submitAnswers('u1', dto)) as { avvisiEsclusioni?: string[] };
      expect(esito.avvisiEsclusioni?.[0]).toContain('latte');
      const righe = audit.log.mock.calls.map((c) => c[0].action);
      expect(righe).toContain('onboarding.esclusioni_non_tolte');
    });

    it('primo questionario: nessun avviso, nessuna riga di audit', async () => {
      prisma.clientProfile.findUnique.mockResolvedValueOnce(null);
      const esito = (await service.submitAnswers('u1', { ...baseAnswers(), allergies: ['latte'] })) as {
        avvisiEsclusioni?: string[];
      };
      expect(esito.avvisiEsclusioni).toBeUndefined();
      expect(upsert().create.allergies).toEqual(['latte']);
    });

    it('⚠️ L\'UNICA sottrazione ammessa: «other» sparisce quando dice COSA', async () => {
      // Non si sta perdendo un dato: si sta sostituendo una domanda con la sua risposta. Tenere il
      // flag «Altro» dopo che l'ha spiegato la lascerebbe per sempre fra quelle da ricontattare
      // per una cosa che ci ha appena detto.
      conProfilo({ intolerances: ['lactose', 'other'] });
      await service.submitAnswers('u1', {
        ...baseAnswers(), intolerances: ['lactose', 'other'], intolerancesOther: ['i latticini di capra'],
      });
      expect(upsert().update.intolerances).toEqual(['lactose', 'i latticini di capra']);
      expect(upsert().update.intolerancesOther).toEqual(['i latticini di capra']);
    });

    it('⚠️ ma se NON dice cosa, «other» resta: è l\'unica traccia di quello che non sappiamo', async () => {
      // È anche il caso di un\'app vecchia, che il campo nuovo non ce l\'ha.
      conProfilo({ intolerances: ['lactose', 'other'] });
      await service.submitAnswers('u1', { ...baseAnswers(), intolerances: ['lactose', 'other'] });
      expect(upsert().update.intolerances).toEqual(['lactose', 'other']);
    });

    it('⚠️ i CIBI NON GRADITI invece si tolgono: quelli li gestisce lei dal Profilo', async () => {
      // L'asimmetria è voluta. Quello che la cliente può rimettere da sola si può togliere; quello
      // che nessuna schermata le permette di rimettere, no.
      conProfilo({ dislikedFoods: ['funghi', 'cavolfiore'] });
      await service.submitAnswers('u1', { ...baseAnswers(), dislikedFoods: ['funghi'] });
      expect(upsert().update.dislikedFoods).toEqual(['funghi']);
    });

    it('⚠️ ma se non manda nemmeno quelli, non si toccano', async () => {
      // Un\'app vecchia che non conosce il campo non deve cancellare la lista che si è costruita.
      conProfilo();
      const dto = { ...baseAnswers() };
      delete (dto as Record<string, unknown>).dislikedFoods;
      await service.submitAnswers('u1', dto);
      expect(upsert().update.dislikedFoods).toBeUndefined();
    });
  });

  /**
   * AIUTARE A SCRIVERE L'ELENCO — ANCHE QUI, che è la porta d'ingresso vera.
   *
   * La regola (Simone, 18/8) era arrivata su quattro porte e restava fuori proprio il questionario,
   * dove quasi tutte le esclusioni vengono scritte la prima volta.
   */
  describe('le esclusioni scritte come frasi si dicono a chi le scrive', () => {
    const upsert = () => prisma.clientProfile.upsert.mock.calls[0][0];
    const conProfilo = () => {
      prisma.clientProfile.findUnique.mockResolvedValue({
        id: 'p1', userId: 'u1', screeningFlag: false, onboardingCompletedAt: new Date(),
        dietStyle: 'mediterranean', mealsPerDay: 5, pathType: 'five', regime: 'omnivore',
        allergies: [], allergiesOther: [], intolerances: [], intolerancesOther: [],
        assignedCoach: { id: 's-c', displayName: 'Marta' },
        assignedNutritionist: { id: 's-n', displayName: 'Dr.ssa Bini' },
      });
    };

    it('⚠️ «pesce tranne salmone» non toglie niente, e adesso glielo diciamo', async () => {
      conProfilo();
      const esito: any = await service.submitAnswers('u1', {
        ...baseAnswers(),
        dislikedFoods: ['pesce tranne salmone', 'tonno'],
      });
      expect(esito.aiutoEsclusioni).toContain('salmone');
      expect(esito.aiutoEsclusioni).toContain('uno per virgola');
    });

    /**
     * ⚠️ QUI NON SI SCARTA E NON SI BLOCCA, ed è la differenza con le altre quattro porte: siamo
     * dentro il cancello del carrello, e fermare il questionario per una frase scritta male vuol
     * dire lasciare una cliente in mezzo al percorso. Si salva quello che ha scritto, e si dice.
     */
    it('⚠️ il questionario NON si blocca: quello che ha scritto viene salvato lo stesso', async () => {
      conProfilo();
      await service.submitAnswers('u1', { ...baseAnswers(), dislikedFoods: ['pesce tranne salmone'] });
      expect(upsert().update.dislikedFoods).toEqual(['pesce tranne salmone']);
    });

    it('un elenco scritto bene non dice niente: un avviso che compare sempre non è un avviso', async () => {
      conProfilo();
      const esito: any = await service.submitAnswers('u1', {
        ...baseAnswers(),
        dislikedFoods: ['funghi', 'cavolfiore'],
      });
      expect(esito.aiutoEsclusioni).toBeUndefined();
    });
  });

  /**
   * IL QUESTIONARIO SI FA UNA VOLTA SOLA, E DOPO NON DECIDE PIÙ LA DIETA.
   *
   * Regola di Simone (11/8): «il cliente può fare il questionario solo una volta, al primo accesso.
   * Da lì in poi il nutrizionista, la coach o admin possono cambiare la dieta. Il cliente non è
   * autorizzato a cambiarla.»
   *
   * Prima il ramo `update` riscriveva il tipo di dieta a ogni invio: su
   * `sim1one.salogni@gmail.com` la dieta era stata spostata da Pescetariana a Mediterranea DUE
   * volte, da due persone diverse, e tutte e due le volte era tornata indietro da sola. Senza
   * errore e senza audit — quindi senza nessuno che potesse accorgersene.
   */
  describe('il tipo di dieta lo decide il PRIMO questionario, poi solo lo staff', () => {
    const ramo = (r: 'create' | 'update') => prisma.clientProfile.upsert.mock.calls[0][0][r] as Record<string, unknown>;

    it('PRIMO invio (nessun profilo): il questionario scrive la dieta', async () => {
      prisma.clientProfile.findUnique.mockResolvedValueOnce(null);
      await service.submitAnswers('u1', baseAnswers());
      expect(ramo('create')).toMatchObject({ regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5, pathType: 'five' });
    });

    it('profilo esistente ma questionario MAI completato: la dieta si scrive ancora', async () => {
      prisma.clientProfile.findUnique.mockResolvedValueOnce({ onboardingCompletedAt: null, pathType: null });
      await service.submitAnswers('u1', baseAnswers());
      expect(ramo('update')).toMatchObject({ regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5, pathType: 'five' });
    });

    it('REINVIO dopo il primo: il tipo di dieta NON viene toccato', async () => {
      prisma.clientProfile.findUnique.mockResolvedValueOnce({
        onboardingCompletedAt: new Date('2026-07-01'),
        regime: 'omnivore', dietStyle: 'mediterranean', dietFamily: 'Mediterranea', mealsPerDay: 3, pathType: 'classic3',
      });
      // La cliente rimanda il questionario chiedendo di nuovo la Pescetariana a 5 pasti.
      await service.submitAnswers('u1', { ...baseAnswers(), dietFamily: 'Pescetariana' } as never);
      const upd = ramo('update');
      for (const campo of ['regime', 'dietStyle', 'dietFamily', 'mealsPerDay', 'pathType']) {
        expect(upd).not.toHaveProperty(campo);
      }
      // ...ma il resto del questionario si aggiorna: non è un rifiuto, è un congelamento mirato.
      expect(upd).toMatchObject({ startWeightKg: 68, character: 'needs_push' });
    });

    it('il tentativo ignorato finisce nell\'AUDIT: sparire in silenzio è il difetto, non la scrittura', async () => {
      const audit = { log: jest.fn() };
      (service as unknown as { audit: typeof audit }).audit = audit;
      prisma.clientProfile.findUnique.mockResolvedValueOnce({
        onboardingCompletedAt: new Date('2026-07-01'),
        regime: 'omnivore', dietStyle: 'mediterranean', dietFamily: 'Mediterranea', mealsPerDay: 3, pathType: 'classic3',
      });
      await service.submitAnswers('u1', { ...baseAnswers(), dietFamily: 'Pescetariana' } as never);
      const chiamata = audit.log.mock.calls.map((c) => c[0]).find((a) => a.action === 'onboarding.tipo_dieta_ignorato');
      expect(chiamata).toBeTruthy();
      expect(chiamata.metadata.campi).toEqual(expect.arrayContaining(['dietFamily', 'mealsPerDay', 'pathType']));
      expect(chiamata.metadata.attuale.dietFamily).toBe('Mediterranea');
      expect(chiamata.metadata.proposto.dietFamily).toBe('Pescetariana');
    });

    it('reinvio IDENTICO: niente da segnalare, nessuna riga di audit', async () => {
      const audit = { log: jest.fn() };
      (service as unknown as { audit: typeof audit }).audit = audit;
      prisma.clientProfile.findUnique.mockResolvedValueOnce({
        onboardingCompletedAt: new Date('2026-07-01'),
        regime: 'omnivore', dietStyle: 'mediterranean', dietFamily: null, mealsPerDay: 5, pathType: 'five',
      });
      await service.submitAnswers('u1', baseAnswers());
      expect(audit.log.mock.calls.map((c) => c[0].action)).not.toContain('onboarding.tipo_dieta_ignorato');
    });

    /**
     * ⛔ **RIFARE IL QUESTIONARIO NON DEVE TOCCARE L'OROLOGIO** (21/8). La finestra non si sceglie
     * più da qui: la imposta la cliente dall'app. Se il reinvio la riscrivesse — anche solo
     * azzerandola — cancellerebbe quello che lei ha impostato, e non lo saprebbe nessuno.
     */
    it('⛔ chi digiuna rifà il questionario e l\'orologio non si tocca', async () => {
      prisma.clientProfile.findUnique.mockResolvedValueOnce({
        onboardingCompletedAt: new Date('2026-07-01'),
        regime: 'omnivore', dietStyle: 'mediterranean', dietFamily: 'Mediterranea', mealsPerDay: 3,
        // Lo staff l'ha messa a digiuno intermittente.
        pathType: 'intermittent_fasting',
      });
      // Il reinvio dice «5 pasti», ma il percorso in vigore è il digiuno.
      await service.submitAnswers('u1', { ...baseAnswers(), pathType: 'five' } as never);
      const scritto = ramo('update');
      for (const campo of ['fastingWindow', 'fastingProtocol', 'fastingStartMin', 'fastingSceltoIl']) {
        expect(Object.prototype.hasOwnProperty.call(scritto, campo)).toBe(false);
      }
    });

    /**
     * ⛔ **Ma se non digiuna più, l'orologio si azzera tutto.** Lasciare `fastingSceltoIl`
     * valorizzato a chi non digiuna più vuol dire che il giorno in cui tornasse al digiuno **non le
     * verrebbe più chiesto niente**: si ritroverebbe la finestra di sei mesi prima, senza che
     * nessuno gliel'abbia chiesta. È il difetto da cui è nata tutta questa parte.
     */
    it('⛔ e chi esce dal digiuno si porta via anche l\'orologio, non solo la finestra', async () => {
      prisma.clientProfile.findUnique.mockResolvedValueOnce({
        onboardingCompletedAt: new Date('2026-07-01'),
        regime: 'omnivore', dietStyle: 'mediterranean', dietFamily: 'Mediterranea', mealsPerDay: 3,
        pathType: 'five',
      });
      await service.submitAnswers('u1', { ...baseAnswers(), pathType: 'five' } as never);
      const scritto = ramo('update');
      expect(scritto.fastingWindow).toBeNull();
      expect(scritto.fastingProtocol).toBeNull();
      expect(scritto.fastingStartMin).toBeNull();
      expect(scritto.fastingSceltoIl).toBeNull();
      expect(scritto.fastingTargetStartMin).toBeNull();
    });
  });

  it('flusso felice: profilo, obiettivo, team, nessuna escalation', async () => {
    const result = await service.submitAnswers('u1', baseAnswers());
    expect(prisma.clientProfile.upsert).toHaveBeenCalled();
    expect(prisma.objective.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ targetWeightKg: 62, status: 'proposed' }),
      }),
    );
    expect(prisma.escalation.create).not.toHaveBeenCalled();
    expect(result.path.name).toBe('Equilibrio Mediterraneo');
    // `coach` è nullable (senza ref code il team non si assegna): l'accesso diretto non
    // compilava più. Con `?.` il test resta severo — se fosse null, 'Marta' non arriverebbe.
    expect(result.team.coach?.displayName).toBe('Marta');
  });

  it('senza ref code la COACH non si assegna in automatico (la assegna il responsabile)', async () => {
    await service.submitAnswers('u1', baseAnswers());
    const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
    expect(createArgs.assignedCoachId).toBeNull();
  });

  /**
   * ⚠️ **QUESTA REGOLA È CAMBIATA IL 21/8, e il test di prima diceva il contrario.**
   *
   * Diceva «senza ref code il team NON si assegna», ed era la regola giusta finché le nutrizioniste
   * sono più d'una: distribuire i pazienti è una decisione. Con **una sola** non è una decisione, è
   * un passaggio a mano — e Sonia, questionario del 7/8 con sei allergie dichiarate, il 21/8
   * risultava ancora senza nessuna nutrizionista, con le sue segnalazioni cliniche nate senza
   * destinatario. La coach resta com'era: cambia solo il ruolo che risponde delle allergie.
   */
  it('⚠️ senza nutrizionista sul lead la prende il CAPO (`assign_head_nutritionist_by_default`)', async () => {
    configParams.getBool.mockResolvedValueOnce(true);
    prisma.staff.findMany.mockResolvedValueOnce([
      { id: 's-capo', userId: 'u-capo', user: { role: 'head_nutritionist' } },
    ]);
    await service.submitAnswers('u1', baseAnswers());
    const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
    expect(createArgs.assignedNutritionistId).toBe('s-capo');
    // La coach no: quella regola non è cambiata.
    expect(createArgs.assignedCoachId).toBeNull();
  });

  it('col parametro spento si torna alla regola di prima: nessuno viene assegnato', async () => {
    configParams.getBool.mockResolvedValueOnce(false);
    await service.submitAnswers('u1', baseAnswers());
    const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
    expect(createArgs.assignedNutritionistId).toBeNull();
    // Spento vuol dire spento: non si va nemmeno a cercare chi sarebbe.
    expect(prisma.staff.findMany).not.toHaveBeenCalled();
  });

  it('se il capo nutrizionista NON esiste, il campo resta vuoto invece di riempirsi a caso', async () => {
    configParams.getBool.mockResolvedValueOnce(true);
    prisma.staff.findMany.mockResolvedValueOnce([
      { id: 's-altra', userId: 'u-altra', user: { role: 'nutritionist' } },
    ]);
    await service.submitAnswers('u1', baseAnswers());
    const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
    expect(createArgs.assignedNutritionistId).toBeNull();
  });

  /**
   * ⛔ **LA COACH DI RISERVA (Simone, 4/9): «tutte le clienti non assegnate ad una coach vanno a
   * Giusy», anche quelle che verranno.** È la gemella della regola del capo nutrizionista qui sopra,
   * e come lei riempie solo il vuoto. ⚠️ Giusy è `sales`: la prova usa quel ruolo apposta.
   */
  describe('⛔ la coach di riserva (`coach_di_riserva`)', () => {
    const giusy = { id: 'st-giusy', userId: 'u-giusy', displayName: 'Giusy Vita', active: true, user: { role: 'sales', status: 'active', deletedAt: null } };

    it('⛔ senza coach sul lead la prende la RISERVA, anche se è una commerciale, e lo scrive nel registro', async () => {
      audit.log.mockClear();
      configParams.getString.mockImplementation(async (k: string) => (k === 'coach_di_riserva' ? 'st-giusy' : 'warn'));
      prisma.staff.findUnique = jest.fn().mockResolvedValue(giusy);
      prisma.clientProfile.findUnique.mockResolvedValueOnce(null); // primo questionario: la scheda nasce qui
      await service.submitAnswers('u1', baseAnswers());
      const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
      expect(createArgs.assignedCoachId).toBe('st-giusy');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'assegnazione.coach_di_riserva',
        entityId: 'u1',
        metadata: expect.objectContaining({ staffId: 'st-giusy', porta: 'onboarding', schedaCreata: true }),
      }));
    });

    /** ⛔ La riga di registro si scrive solo se l'assegnazione c'è davvero (revisione avversariale, 4/9). */
    it('⛔ se il questionario si ferma prima di scrivere, NESSUNA riga di registro', async () => {
      audit.log.mockClear();
      configParams.getString.mockImplementation(async (k: string) => (k === 'coach_di_riserva' ? 'st-giusy' : 'warn'));
      prisma.staff.findUnique = jest.fn().mockResolvedValue(giusy);
      prisma.clientProfile.findUnique.mockResolvedValueOnce(null);
      prisma.clientProfile.upsert.mockRejectedValueOnce(new Error('il database non risponde'));
      await expect(service.submitAnswers('u1', baseAnswers())).rejects.toThrow('non risponde');
      expect(audit.log).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'assegnazione.coach_di_riserva' }));
    });

    it('⛔ sul questionario rifatto con la coach VUOTA la riserva entra dall\'aggancio, e la riga c\'è', async () => {
      audit.log.mockClear();
      configParams.getString.mockImplementation(async (k: string) => (k === 'coach_di_riserva' ? 'st-giusy' : 'warn'));
      prisma.staff.findUnique = jest.fn().mockResolvedValue(giusy);
      prisma.clientProfile.findUnique.mockResolvedValueOnce({ id: 'p1', userId: 'u1', assignedCoachId: null, consents: {} });
      prisma.clientProfile.findUnique.mockResolvedValueOnce({ assignedCoachId: null, assignedNutritionistId: null }); // la lettura dell'aggancio
      prisma.clientProfile.update = jest.fn().mockResolvedValue({});
      await service.submitAnswers('u1', baseAnswers());
      expect(prisma.clientProfile.update).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u1' }, data: expect.objectContaining({ assignedCoachId: 'st-giusy' }) }));
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'assegnazione.coach_di_riserva',
        metadata: expect.objectContaining({ porta: 'onboarding', schedaCreata: false }),
      }));
    });

    it('⛔ col ref code sul lead vince la coach del lead: la riserva riempie solo il vuoto', async () => {
      configParams.getString.mockImplementation(async (k: string) => (k === 'coach_di_riserva' ? 'st-giusy' : 'warn'));
      prisma.staff.findUnique = jest.fn().mockResolvedValue(giusy);
      prisma.crmRecord.findUnique.mockResolvedValue({ assignedCoachId: 's-ref-coach', assignedNutritionistId: null });
      await service.submitAnswers('u1', baseAnswers());
      const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
      expect(createArgs.assignedCoachId).toBe('s-ref-coach');
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });

    /** ⛔ Il questionario rifatto: la coach messa a mano resta, e il registro NON dice il contrario. */
    it('⛔ chi rifà il questionario con una coach già in scheda non passa alla riserva, e non c\'è nessuna riga', async () => {
      audit.log.mockClear();
      configParams.getString.mockImplementation(async (k: string) => (k === 'coach_di_riserva' ? 'st-giusy' : 'warn'));
      prisma.staff.findUnique = jest.fn().mockResolvedValue(giusy);
      prisma.clientProfile.findUnique.mockResolvedValueOnce({ id: 'p1', userId: 'u1', assignedCoachId: 'st-sua-coach', consents: {} });
      await service.submitAnswers('u1', baseAnswers());
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'assegnazione.coach_di_riserva' }));
    });

    it('⚠️ con la riserva spenta la coach resta vuota, e non si legge nemmeno la scheda', async () => {
      prisma.staff.findUnique = jest.fn();
      await service.submitAnswers('u1', baseAnswers());
      const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
      expect(createArgs.assignedCoachId).toBeNull();
      expect(prisma.staff.findUnique).not.toHaveBeenCalled();
    });

    it('⛔ con una riserva NON valida (sospesa) la coach resta vuota: non si riempie a caso', async () => {
      audit.log.mockClear(); // il registro finto è condiviso fra le prove di questo file
      configParams.getString.mockImplementation(async (k: string) => (k === 'coach_di_riserva' ? 'st-giusy' : 'warn'));
      prisma.staff.findUnique = jest.fn().mockResolvedValue({ ...giusy, user: { ...giusy.user, status: 'suspended' } });
      await service.submitAnswers('u1', baseAnswers());
      const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
      expect(createArgs.assignedCoachId).toBeNull();
      expect(audit.log).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'assegnazione.coach_di_riserva' }));
    });
  });

  it('col ref code sul lead, coach e nutrizionista si propagano al profilo', async () => {
    prisma.crmRecord.findUnique.mockResolvedValue({
      assignedCoachId: 's-ref-coach',
      assignedNutritionistId: 's-ref-nutri',
    });
    await service.submitAnswers('u1', baseAnswers());
    const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
    expect(createArgs.assignedCoachId).toBe('s-ref-coach');
    expect(createArgs.assignedNutritionistId).toBe('s-ref-nutri');
  });

  it('patologie dichiarate → screening_flag + escalation al nutrizionista', async () => {
    const dto = baseAnswers();
    dto.health = { hasConditions: 'yes', takesMedications: 'no' } as never;
    await service.submitAnswers('u1', dto);
    const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
    expect(createArgs.screeningFlag).toBe(true);
    expect(prisma.escalation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'screening' }),
      }),
    );
  });

  it('"none" viene rimosso dalle intolleranze salvate', async () => {
    await service.submitAnswers('u1', baseAnswers());
    const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
    expect(createArgs.intolerances).toEqual([]);
  });

  it('obiettivo irreale con action=warn: accettato ma tracciato in validazione', async () => {
    const dto = baseAnswers();
    dto.objective = { weightToLoseKg: 15, weeks: 10 } as never;
    const result = await service.submitAnswers('u1', dto);
    expect((result as any).objectiveValidation.pace).toBe('unreal');
    expect(prisma.objective.create).toHaveBeenCalled();
  });
  /**
   * ⛔ **IL PESO DI PARTENZA, E IL GIORNO CON CUI SI ARCHIVIA** — 25/8, censimento delle date.
   *
   * Qui c'era `new Date()` + `setHours(0, 0, 0, 0)`: il fuso del **processo**, che su Render è UTC.
   * Chi finiva il questionario fra la mezzanotte e le 02:00 italiane si vedeva il peso dichiarato
   * archiviato al **giorno prima**.
   *
   * ⛔ E non era un punto spostato su un grafico: `measurement` ha la chiave unica `(cliente, data)`
   * e qui si scrive in `upsert` con `update: {}`. Se per quel giorno una misura esisteva già — e la
   * scrive `signals.service`, che il giorno lo prende con `toDateOnly()`, cioè **quello di Roma** —
   * il peso dichiarato spariva senza un errore. Due definizioni di giorno sulla stessa chiave unica.
   */
  describe('⛔ il peso di partenza si archivia al giorno di ROMA', () => {
    const giornoScritto = () =>
      (prisma.measurement.upsert.mock.calls[0][0].create.date as Date).toISOString();

    /**
     * ⚠️ **`conOrologioFermo`, e non `useFakeTimers` dentro il test** — corretto in revisione, 25/8.
     * Con la chiamata dentro l'`it` e `useRealTimers()` in fondo, **un `expect` che fallisce salta il
     * ripristino**: l'orologio resta fermo e tutti i test dopo cadono per una ragione che non è la
     * loro. Un fallimento vero diventa una cascata, e si va a cercare nel posto sbagliato — che è
     * esattamente quello che `test/orologio-fermo.ts` esiste per impedire (`beforeEach`+`afterEach`).
     */
    describe('di giorno', () => {
      conOrologioFermo(new Date('2026-08-26T10:00:00.000Z'));

      it('il peso dichiarato finisce sulla data di oggi', async () => {
        await service.submitAnswers('u1', baseAnswers());
        expect(giornoScritto()).toBe('2026-08-26T00:00:00.000Z');
      });

      /** ⚠️ Il peso è quello dichiarato: la data giusta su un numero sbagliato non serve a niente. */
      it('⚠️ e il peso è quello del questionario', async () => {
        await service.submitAnswers('u1', baseAnswers());
        expect(prisma.measurement.upsert.mock.calls[0][0].create.weightKg).toBe(68);
      });
    });

    describe('⛔ alle 00:30 italiane (per UTC è ancora il 25)', () => {
      conOrologioFermo(new Date('2026-08-25T22:30:00.000Z'));

      it('⛔ finisce sul 26, non sul 25 come prima', async () => {
        await service.submitAnswers('u1', baseAnswers());
        expect(giornoScritto()).toBe('2026-08-26T00:00:00.000Z');
      });

      /**
       * ⚠️ E la chiave con cui cerca è la stessa data con cui scrive: se divergessero, l'`upsert`
       * non troverebbe mai la riga che ha appena creato.
       */
      it('⚠️ la chiave dell’upsert e la data scritta sono lo stesso giorno', async () => {
        await service.submitAnswers('u1', baseAnswers());
        const arg = prisma.measurement.upsert.mock.calls[0][0];
        expect((arg.where.clientId_date.date as Date).toISOString()).toBe(giornoScritto());
      });
    });
  });
});


/**
 * §16.10 — «lo STILE sparisce dall'interfaccia» (Simone, 11/8), ultima parte: il questionario non
 * lo pretende più. La cliente sceglie un prodotto, e lo stile lo sa il catalogo.
 */
describe('OnboardingService — lo stile non si chiede più', () => {
  let service: OnboardingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      clientProfile: {
        upsert: jest.fn().mockResolvedValue({ id: 'p1', screeningFlag: false }),
        /**
         * ⚠️ Due letture dello stesso profilo, e devono rispondere cose diverse: la PRIMA è
         * «esiste già un questionario?» (no: è il primo invio, ed è l'unico in cui il tipo di dieta
         * si scrive), la seconda è la rilettura per comporre la risposta, che il profilo ce l'ha.
         */
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValue({
            id: 'p1', userId: 'u1', screeningFlag: false, onboardingCompletedAt: new Date(),
            dietStyle: 'flexible', mealsPerDay: 5, pathType: 'five', regime: 'omnivore',
            assignedCoach: null, assignedNutritionist: null,
          }),
      },
      objective: {
        create: jest.fn().mockResolvedValue({ id: 'o1' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'o1', status: 'proposed' }),
      },
      escalation: { create: jest.fn().mockResolvedValue({ id: 'e1' }) },
      diet: { findFirst: jest.fn().mockResolvedValue({ style: 'flexible' }) },
      crmRecord: { findUnique: jest.fn().mockResolvedValue(null) },
      staff: {
        findMany: jest.fn().mockResolvedValue([
          { id: 's-a', displayName: 'A', _count: { clientsAsCoach: 5 } },
        ]),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigParamsService,
          useValue: {
            getNumber: jest.fn((key: string) => Promise.resolve(key === 'sustainable_rate_max_kg_week' ? 0.7 : 1.0)),
            getString: jest.fn(async (k: string) => (k === 'coach_di_riserva' ? 'off' : 'warn')),
            getBool: jest.fn(async (_k: string, d?: boolean) => d ?? false),
          },
        },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: PersonalBaseService, useValue: { buildPersonalBase: jest.fn().mockResolvedValue(undefined) } },
        { provide: NotificationsService, useValue: { notify: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    service = moduleRef.get(OnboardingService);
  });

  const senzaStile = (extra: Record<string, unknown> = {}) =>
    ({ ...(baseAnswers() as unknown as Record<string, unknown>), dietStyle: undefined, ...extra }) as unknown as SubmitAnswersDto;

  it('⚠️ con la sola FAMIGLIA lo stile si legge dal catalogo e si scrive lo stesso', async () => {
    // Non si smette di scriverlo: `pickDietFor` lo usa come co-filtro della famiglia, e una
    // famiglia senza stile può agganciare l'omonima di un altro stile. Si smette di CHIEDERLO.
    await service.submitAnswers('u1', senzaStile({ dietFamily: 'Mediterranea senza glutine' }));
    expect(prisma.diet.findFirst.mock.calls[0][0].where).toEqual({ status: 'approved', name: 'Mediterranea senza glutine' });
    const scritto = prisma.clientProfile.upsert.mock.calls[0][0].create;
    expect(scritto.dietStyle).toBe('flexible');
    expect(scritto.dietFamily).toBe('Mediterranea senza glutine');
  });

  it('⚠️ le app GIÀ INSTALLATE mandano solo lo stile e continuano a funzionare', async () => {
    await service.submitAnswers('u1', baseAnswers());
    expect(prisma.clientProfile.upsert.mock.calls[0][0].create.dietStyle).toBe('mediterranean');
    // Con lo stile in mano il catalogo non si interroga nemmeno.
    expect(prisma.diet.findFirst).not.toHaveBeenCalled();
  });

  it('⚠️ senza NESSUNO dei due si dice cosa fare, non quale campo manca', async () => {
    // «dietStyle must be a string» non aiuta nessuno: la cliente deve sapere che deve toccare una
    // delle diete proposte.
    await expect(service.submitAnswers('u1', senzaStile())).rejects.toThrow(/tocca una delle diete/);
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });

  it('una famiglia che non esiste a catalogo non passa in silenzio', async () => {
    prisma.diet.findFirst.mockResolvedValue(null);
    await expect(service.submitAnswers('u1', senzaStile({ dietFamily: 'Non esiste' }))).rejects.toThrow(/tocca una delle diete/);
  });

});
