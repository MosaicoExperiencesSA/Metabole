import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { KcalNeedService } from '../menu/kcal-need.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { MonitoringService } from './monitoring.service';

/**
 * IL KIT DI RIENTRO NON RICOPIA, RIPORZIONA (voce 255, ultima coda).
 *
 * `generateRientroMenus` è l'unico posto del progetto dove una giornata di ieri diventa una
 * giornata di domani senza passare da `deliverIfEligible` — quindi è anche l'unico posto dove una
 * giornata scritta prima del 18/8 può rientrare nel futuro **senza porzione**, e restarci.
 */
describe('MonitoringService · le giornate del kit di rientro', () => {
  let service: MonitoringService;
  let prisma: any;
  let kcalNeed: any;

  const ieri = new Date(Date.now() - 86_400_000);
  const giornataVecchia = {
    date: ieri,
    dietId: 'd1',
    level: 1,
    // Nessun `porzione`: è una giornata scritta prima che le porzioni si scalassero.
    meals: [
      { slot: 'breakfast', recipeId: 'r1', name: 'Porridge', kcal: 300 },
      { slot: 'lunch', recipeId: 'r2', name: 'Farro', kcal: 495 },
    ],
  };

  beforeEach(async () => {
    prisma = {
      menuDay: { findMany: jest.fn().mockResolvedValue([giornataVecchia]), upsert: jest.fn().mockResolvedValue({}) },
      // ⚠️ Il kit di rientro legge `apertureDal` per scrivere `apertureTracciate` sulle giornate che
      // crea (26/8): senza questo finto la lettura esplode, e un finto che manca fa passare tutto.
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ apertureDal: new Date('2026-08-01') }) },
      cycleFeedback: { findMany: jest.fn().mockResolvedValue([]) },
      measurement: { findMany: jest.fn().mockResolvedValue([]) },
    };
    kcalNeed = { computeTargetKcal: jest.fn().mockResolvedValue(1200) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        MonitoringService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: { notify: jest.fn() } },
        { provide: ConfigParamsService, useValue: { getNumber: jest.fn(async (k: string, d?: number) => (k === 'monitoring_rientro_days' ? 1 : (d ?? 0))) } },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: KcalNeedService, useValue: kcalNeed },
      ],
    }).compile();
    service = moduleRef.get(MonitoringService);
  });

  const pastiScritti = () => prisma.menuDay.upsert.mock.calls[0][0].create.meals;

  it('⚠️ la giornata vecchia rientra SCALATA sul fabbisogno di adesso, non com\'era', async () => {
    const quanti = await service.generateRientroMenus('c1');
    expect(quanti).toBe(1);
    const pasti = pastiScritti();
    expect(pasti[0].porzione).toBeGreaterThan(1);
    expect(pasti[0].kcalBase).toBe(300);
    // 795 kcal di catalogo contro un fabbisogno di 1200: la giornata cresce.
    expect(pasti.reduce((a: number, m: any) => a + m.kcal, 0)).toBeGreaterThan(795);
  });

  /**
   * ⛔ **CAMBIATO IL 23/8, e questo test diceva prima il contrario.**
   *
   * Chiedeva che il ramo `update` scrivesse le stesse kcal del ramo `create`: nato per impedire che
   * un giorno già occupato tornasse al catalogo **non scalato**, e per quello era giusto. Ma
   * scrivendo `update` il kit **sovrascrive** giornate già erogate, e il commento due righe sopra
   * la `upsert` diceva da sempre «saltando date già occupate»: il codice e la sua descrizione si
   * contraddicevano, e vinceva il codice.
   *
   * Fino a ieri era un difetto silenzioso. Da oggi no: al rientro da una sospensione la pesata è
   * obbligatoria, quindi il confronto con `refWeightKg` c'è sempre, e il kit del cron notturno
   * riscriveva sopra **il menu del rientro appena promesso alla cliente** — le cambiava sotto la
   * giornata per cui aveva appena fatto la spesa.
   *
   * La regola nuova è quella di `deliverIfEligible`: un menu che è già in mano a qualcuno non si
   * tocca. Il kit riempie i giorni vuoti, che è quello che serve.
   */
  /**
   * ⛔ **IL KIT DI RIENTRO È IL SECONDO POSTO CHE CREA `MenuDay`** (26/8, voce
   * `visto-non-vuol-dire-aperto`). Senza copiare `apertureTracciate` dal profilo, queste giornate
   * nascevano «non lo so» **per sempre** — anche per una cliente il cui telefono manda il segnale da
   * mesi. Conseguenza: non si sarebbero mai potute rifare da sole, e avrebbero bloccato la coda di
   * tutte quelle dopo. È così che una regola nuova smette di valere senza che nessuno se ne accorga.
   */
  it('⛔ le giornate del kit dicono se di loro possiamo saperlo', async () => {
    await service.generateRientroMenus('c1');
    expect(prisma.menuDay.upsert.mock.calls[0][0].create.apertureTracciate).toBe(true);
  });

  it('⚠️ e se la sua app non manda ancora il segnale, restano «non lo so»', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue({ apertureDal: null });
    await service.generateRientroMenus('c1');
    expect(prisma.menuDay.upsert.mock.calls[0][0].create.apertureTracciate).toBe(false);
  });

  it('⛔ un giorno già erogato NON si sovrascrive: il ramo `update` è vuoto', async () => {
    await service.generateRientroMenus('c1');
    const chiamata = prisma.menuDay.upsert.mock.calls[0][0];
    expect(chiamata.update).toEqual({});
    // E il ramo `create` resta quello scalato: la protezione originale non si perde.
    expect(chiamata.create.meals[0].kcalBase).toBe(300);
  });

  /**
   * ⚠️ Senza fabbisogno calcolabile le giornate restano com'erano — riportarle al catalogo
   * «perché non sappiamo» rimpicciolirebbe il piatto in silenzio — ma la cosa si SCRIVE: chi legge
   * i log deve sapere che quelle porzioni sono quelle di allora.
   */
  it('⚠️ senza fabbisogno non si tocca niente, e lo si dice nei log', async () => {
    kcalNeed.computeTargetKcal.mockResolvedValue(null);
    const log = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
    await service.generateRientroMenus('c1');
    expect(pastiScritti()).toEqual(giornataVecchia.meals);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('fabbisogno non calcolabile'));
  });
});
