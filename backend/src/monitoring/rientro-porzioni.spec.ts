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

  it('⚠️ e le stesse kcal finiscono nel ramo `update`: un giorno già occupato non torna al catalogo', async () => {
    await service.generateRientroMenus('c1');
    const chiamata = prisma.menuDay.upsert.mock.calls[0][0];
    expect(chiamata.update.meals).toEqual(chiamata.create.meals);
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
