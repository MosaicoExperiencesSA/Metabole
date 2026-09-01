import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from './menu.service';
import { aGiorno, giornoLocale } from '../common/date-only';

import { comeDalDatabase } from './come-dal-database';
/**
 * ⛔ **IL RIENTRO DALLA SOSPENSIONE** — richiesta di Simone, 23/8.
 *
 * *«Se la modalità viaggio termina ad esempio il 24 agosto, il 23 le deve chiedere le misure ed
 * erogare il menu per il 24: il primo menu, come all'inizio, va erogato con un giorno d'anticipo.»*
 *
 * Prima l'erogazione tornava vuota per tutta la sospensione, fino all'ultimo minuto. Il 24 la
 * cliente apriva l'app e trovava il menu del 24 appena composto: nessuna spesa fatta, nessun
 * preavviso. All'inizio di un piano non succede — lì il menu si sblocca due giorni prima — e
 * nessuno si era mai chiesto perché il rientro dovesse valere meno di una partenza.
 *
 * Le tre cose che questi test tengono ferme, e che erano tutte e tre sbagliate:
 *  1. **fuori finestra non cambia niente**: una sospensione che finisce fra una settimana resta una
 *     sospensione piena, e nessuno riceve niente in anticipo;
 *  2. **dentro la finestra si CHIEDE**, e finché la pesata non c'è il menu resta trattenuto — con
 *     lo stato che lo dice, non con «menu in preparazione»;
 *  3. **il menu erogato è quello del GIORNO DI RIENTRO**, non quello di oggi. È il difetto più
 *     silenzioso dei tre: erogare «oggi» il 23 vorrebbe dire bruciare un giorno di piano su una
 *     giornata di vacanza, e lasciare il 24 di nuovo scoperto.
 */

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/**
 * ⛔ **N GIORNI DI CALENDARIO, NON N×24 ORE** — 24/8.
 *
 * Questa riga faceva `Date.now() + n * 86_400_000`. Sembra la stessa cosa e non lo è: la notte del
 * **25 ottobre 2026** le lancette tornano indietro e il giorno dura **25 ore**, quindi alle 00:30
 * di Roma sommare ventiquattro ore **non arriva a domani** — resta lo stesso giorno.
 *
 * ⚠️ Il difetto era **qui, non nel prodotto**: misurato il 24/8 con `ORA_FINTA`, quella notte il
 * motore erogava i giorni giusti e il gate bloccava chi doveva. Erano queste fixture a dire una cosa
 * e a prepararne un'altra. Un test che mente sulla propria premessa manda a correggere codice che
 * funziona, ed è più caro di un test che manca.
 *
 * ⚠️ I casi caduti qui sono i tre del **giorno di rientro**: «sospesa fino al 25 → riprende il
 * 26» è la regola, e il prodotto la applicava giusta. Era il test ad aspettarsi il **25**.
 *
 * Adesso si parte da una **mezzanotte UTC** (`aGiorno`, la stessa porta del prodotto) e si somma lì:
 * in UTC non ci sono cambi d'ora, quindi `+ n` giorni è esatto in tutte le stagioni e in tutti i
 * fusi del **processo** — provato su 526.080 istanti. ⚠️ Il giro completo torna al giorno giusto
 * finché il fuso dell'**azienda** (`APP_TIMEZONE`) è a est di Greenwich, come Roma: è una proprietà
 * di `aGiorno`, non di questa riga, ma vale saperlo perché quel fuso si cambia da Render.
 */
const giorniDaOggi = (n: number) => giornoLocale(new Date(aGiorno(new Date()).getTime() + n * 86_400_000));
const oggiIso = giorniDaOggi(0);

const SLOT_5 = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
const template = (dayIndex: number) => ({
  dayIndex,
  level: 1,
  meals: SLOT_5.map((slot, i) => ({ slot, recipeId: `r${i + 1}` })),
});

describe('Menu — la finestra di rientro dalla sospensione', () => {
  let service: MenuService;
  let prisma: any;
  let push: { sendToUser: jest.Mock };

  /**
   * `ultimoGiornoSospeso` è la data scritta in tabella; il rientro è il giorno dopo.
   * `pesataDelRientro` dice se la cliente si è già pesata dentro la finestra.
   */
  const montaScenario = async (opzioni: {
    ultimoGiornoSospeso: number;
    pesataDelRientro: boolean;
  }) => {
    const inizioPiano = D(giorniDaOggi(-30));
    const fineSospensione = D(giorniDaOggi(opzioni.ultimoGiornoSospeso));
    const rientro = D(giorniDaOggi(opzioni.ultimoGiornoSospeso + 1));
    // L'ultima giornata di menu è quella di prima della vacanza.
    const ultimaGiornata = D(giorniDaOggi(-12));

    prisma = {
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: inizioPiano,
          screeningFlag: false,
          planHeldAt: null,
          regime: 'omnivore',
          dietStyle: 'mediterranean',
          mealsPerDay: 5,
          intolerances: [],
          assignedNutritionistId: null,
          travelState: null,
          travelStart: null,
          travelEnd: null,
        }),
      },
      menuDay: {
        findFirst: jest.fn().mockResolvedValue({ id: 'md1', date: ultimaGiornata, level: 1 }),
        /**
         * ⛔ **IL DOPPIO SEGUE L'ORIGINALE** (25/8). Dal 25/8 l'erogazione conta **le giornate di
         * seguito** che la cliente ha davanti (i buchi si riempiono con le nuove): un finto che
         * risponde sempre `[]` racconta un calendario vuoto a un test che ha appena dichiarato una
         * giornata con `findFirst`, e allora il motore compone di nuovo — non perché sbagli, ma
         * perché il finto gli ha mentito. ⚠️ Qui l'elenco si **deriva** da quello che il test dice.
         */
        findMany: jest.fn().mockImplementation(async (arg: any) => {
          if (!arg?.select?.date) return [];
          const ultimo = await prisma.menuDay.findFirst();
          if (!ultimo?.date) return [];
          // Le giornate erogate insieme sono `menu_days_delivered`: il test ne dichiara l'ultima.
          return [{ date: new Date(ultimo.date.getTime() - 86_400_000) }, { date: ultimo.date }];
        }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      /**
       * ⚠️ Il finto distingue le domande dalla `where`, come in `pesata-del-ciclo.spec.ts`: la
       * misura di PARTENZA guarda la finestra dell'inizio piano (trenta giorni fa) e c'è sempre;
       * la **pesata del rientro** guarda da ieri in avanti, ed è quella che il test pilota. Un
       * finto che rispondesse uguale a tutte e due farebbe passare il test qualunque cosa faccia
       * il codice.
       */
      measurement: {
        findFirst: jest.fn().mockImplementation(({ where }: any) => {
          const da: Date | undefined = where?.date?.gte;
          if (!da) return Promise.resolve({ id: 'm-vecchia' });
          const finestraDelRientro = da.getTime() >= D(giorniDaOggi(-1)).getTime();
          if (finestraDelRientro) {
            return Promise.resolve(opzioni.pesataDelRientro ? { id: 'm-rientro' } : null);
          }
          return Promise.resolve({ id: 'm-partenza' });
        }),
        count: jest.fn().mockResolvedValue(3),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sub1', status: 'active' }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'sub1', status: 'active', startDate: inizioPiano, endDate: D(giorniDaOggi(60)), plan: { period: 'month', priceCents: 4900 } },
        ]),
      },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      /**
       * ⚠️ `create` deve tornare una promessa: il servizio ci concatena `.catch(...)`, e un
       * `jest.fn()` nudo torna `undefined` — l'errore che ne esce viene inghiottito dal `catch`
       * esterno e la push non parte mai. Il test rimarrebbe verde raccontando una cosa falsa.
       */
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: {
        findFirst: jest.fn().mockResolvedValue({ id: 'diet1', name: 'Mediterranea', style: 'mediterranean', regime: 'omnivore', mealsPerDay: 5 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([template(1), template(2)]) },
      productRule: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      recipe: {
        findMany: jest.fn().mockResolvedValue(comeDalDatabase([{ id: 'r1', name: 'Farro', kcal: 520 }])),
        findUnique: jest.fn().mockResolvedValue({ id: 'r1' }),
      },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      analyticsEvent: { create: jest.fn() },
      shoppingList: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'sl1', ...data })),
        update: jest.fn(),
      },
    };

    const config = {
      getString: jest.fn(async (_k: string, d?: string) => d),
      getNumber: jest.fn((key: string, def?: number) =>
        Promise.resolve(({
          menu_days_delivered: 2,
          menu_visible_days_before_start: 2,
          menu_visible_days_before_return: 1,
          measures_ask_repeat_days: 2,
          travel_max_days: 30,
        } as Record<string, number>)[key] ?? def),
      ),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = {
      // Nessuna pausa «appena finita»: qui la sospensione è ancora attiva, o lontana.
      pausaAppenaFinita: jest.fn().mockResolvedValue(null),
      activePausePeriod: jest.fn().mockResolvedValue({
        id: 'ev1',
        mode: 'pause_period',
        startDate: D(giorniDaOggi(-12)),
        endDate: fineSospensione,
      }),
    };
    push = { sendToUser: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MenuService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: config },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: require('../calendar/events.service').EventsService, useValue: events },
        { provide: require('../diet-agent/diet-agent.service').DietAgentService, useValue: { stateFor: jest.fn().mockResolvedValue('normale') } },
        { provide: require('./day-combo.service').DayComboService, useValue: new (require('./day-combo.service').DayComboService)() },
        { provide: require('./kcal-need.service').KcalNeedService, useValue: { computeTargetKcal: jest.fn().mockResolvedValue(null) } },
        { provide: require('../notifications/push.service').PushService, useValue: push },
      ],
    }).compile();
    service = moduleRef.get(MenuService);
    return { rientro, fineSospensione };
  };

  describe('fuori finestra: la sospensione resta piena', () => {
    it('non eroga niente e non chiede niente', async () => {
      await montaScenario({ ultimoGiornoSospeso: 6, pesataDelRientro: false });
      expect(await service.deliverIfEligible('c1')).toEqual([]);
      expect(prisma.menuDay.upsert).not.toHaveBeenCalled();
      expect(push.sendToUser).not.toHaveBeenCalled();
    });

    it('lo stato è «in pausa», e da oggi dice ANCHE quando si riprende', async () => {
      await montaScenario({ ultimoGiornoSospeso: 6, pesataDelRientro: false });
      const stato = await service.menuStatus('c1', false);
      expect(stato.state).toBe('paused');
      expect(stato.returnDate).toBe(giorniDaOggi(7));
      // Il menu compare un giorno prima del rientro: due date diverse, come alla partenza.
      expect(stato.availableFrom).toBe(giorniDaOggi(6));
    });
  });

  describe('dentro la finestra, senza pesata del rientro', () => {
    it('trattiene il menu e CHIEDE la pesata, in app e sul telefono', async () => {
      await montaScenario({ ultimoGiornoSospeso: 0, pesataDelRientro: false });
      expect(await service.deliverIfEligible('c1')).toEqual([]);
      expect(prisma.menuDay.upsert).not.toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'measures_return_required' }) }),
      );
      expect(push.sendToUser).toHaveBeenCalledTimes(1);
      // Il testo nomina la data: è quello che fa alzare e prendere la bilancia.
      expect(push.sendToUser.mock.calls[0][2]).toContain('riprendi con la dieta');
    });

    it('non ripete la richiesta se è già partita da poco', async () => {
      await montaScenario({ ultimoGiornoSospeso: 0, pesataDelRientro: false });
      prisma.notification.findFirst.mockResolvedValue({ id: 'n1' });
      await service.deliverIfEligible('c1');
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(push.sendToUser).not.toHaveBeenCalled();
    });

    /**
     * ⚠️ Qui `paused` sarebbe la bugia gentile del caso Giusy: «riprende automaticamente al tuo
     * rientro» a una cliente il cui menu è fermo per un cancello che nessuno le ha nominato.
     */
    /**
     * ⚠️ **Lo stato è `awaiting_cycle_measure` e non uno stato nuovo**, di proposito: uno stato che
     * l'app non conosce cade nel suo `default: null`, cioè **nessun banner** — schermata vuota
     * proprio nel momento in cui deve spiegare perché il menu non c'è. Il testo del rientro lo fa
     * `returnDate`, che le app vecchie ignorano senza rompersi. Il perché per esteso sta in
     * `menu.service.menuStatus` e in `MenuStatusBanner`.
     */
    it('lo stato dice che manca la pesata, e porta con sé il giorno di rientro', async () => {
      await montaScenario({ ultimoGiornoSospeso: 0, pesataDelRientro: false });
      const stato = await service.menuStatus('c1', false);
      expect(stato.state).toBe('awaiting_cycle_measure');
      expect(stato.returnDate).toBe(giorniDaOggi(1));
    });
  });

  describe('dentro la finestra, con la pesata del rientro', () => {
    it('EROGA IL MENU DEL GIORNO DI RIENTRO, non quello di oggi', async () => {
      await montaScenario({ ultimoGiornoSospeso: 0, pesataDelRientro: true });
      const erogati = await service.deliverIfEligible('c1');
      expect(erogati[0]).toBe(giorniDaOggi(1));
      expect(erogati).not.toContain(oggiIso);
      const dateScritte = prisma.menuDay.upsert.mock.calls.map(
        (c: any) => c[0].create.date.toISOString().slice(0, 10),
      );
      expect(dateScritte[0]).toBe(giorniDaOggi(1));
      expect(dateScritte).not.toContain(oggiIso);
    });

    it('il menu del rientro è visibile SUBITO: è il senso dell\'anticipo', async () => {
      await montaScenario({ ultimoGiornoSospeso: 0, pesataDelRientro: true });
      await service.deliverIfEligible('c1');
      const visibileDa = prisma.menuDay.upsert.mock.calls[0][0].create.visibleFrom;
      expect(visibileDa.toISOString().slice(0, 10)).toBe(oggiIso);
    });

    it('non richiede la pesata una seconda volta', async () => {
      await montaScenario({ ultimoGiornoSospeso: 0, pesataDelRientro: true });
      await service.deliverIfEligible('c1');
      expect(prisma.notification.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'measures_return_required' }) }),
      );
    });

    /**
     * ⚠️ L'idempotenza è la cosa che rompe questa consegna se manca: `deliverIfEligible` gira a
     * OGNI apertura dell'app. Il 23, dopo la prima erogazione, l'ultima giornata è il 24 — cioè nel
     * futuro — e il buffer in avanti deve fermare tutto. Senza, ogni apertura comporrebbe un ciclo
     * nuovo e la vacanza finirebbe con una settimana di menu già bruciati.
     */
    it('alla seconda apertura dell\'app non eroga di nuovo', async () => {
      await montaScenario({ ultimoGiornoSospeso: 0, pesataDelRientro: true });
      prisma.menuDay.findFirst.mockResolvedValue({ id: 'md2', date: D(giorniDaOggi(1)), level: 1 });
      expect(await service.deliverIfEligible('c1')).toEqual([]);
      expect(prisma.menuDay.upsert).not.toHaveBeenCalled();
    });
  });
});
