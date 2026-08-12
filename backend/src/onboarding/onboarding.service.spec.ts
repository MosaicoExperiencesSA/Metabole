import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PersonalBaseService } from '../personal-base/personal-base.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { OnboardingService } from './onboarding.service';

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
    const configParams = {
      getNumber: jest.fn((key: string) =>
        Promise.resolve(key === 'sustainable_rate_max_kg_week' ? 0.7 : 1.0),
      ),
      getString: jest.fn().mockResolvedValue('warn'),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: configParams },
        { provide: AuditService, useValue: { log: jest.fn() } },
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

    it('la finestra del digiuno guarda il percorso IN VIGORE, non quello riproposto', async () => {
      prisma.clientProfile.findUnique.mockResolvedValueOnce({
        onboardingCompletedAt: new Date('2026-07-01'),
        regime: 'omnivore', dietStyle: 'mediterranean', dietFamily: 'Mediterranea', mealsPerDay: 3,
        // Lo staff l'ha messa a digiuno intermittente.
        pathType: 'intermittent_fasting',
      });
      // Il reinvio dice «5 pasti»: se si guardasse il DTO, la finestra verrebbe azzerata e la
      // cliente resterebbe a digiuno senza sapere quali pasti salta.
      await service.submitAnswers('u1', { ...baseAnswers(), pathType: 'five', fastingWindow: 'skip_breakfast' } as never);
      expect(ramo('update').fastingWindow).toBe('skip_breakfast');
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

  it('senza ref code il team NON si assegna in automatico (lo assegna il responsabile)', async () => {
    await service.submitAnswers('u1', baseAnswers());
    const createArgs = prisma.clientProfile.upsert.mock.calls[0][0].create;
    expect(createArgs.assignedCoachId).toBeNull();
    expect(createArgs.assignedNutritionistId).toBeNull();
    expect(prisma.staff.findMany).not.toHaveBeenCalled();
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
            getString: jest.fn().mockResolvedValue('warn'),
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
