import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AlertsService } from '../alerts/alerts.service';
import { AuditService } from '../audit/audit.service';
import { LeadAssignmentService } from '../commerce/lead-assignment.service';
import { ReportsService } from '../reports/reports.service';
import { EngineService } from '../engine/engine.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CronController } from './cron.controller';

describe('CronController (endpoint per Render Cron)', () => {
  let controller: CronController;
  const engine = { runBatch: jest.fn().mockResolvedValue({ total: 1, run: 1, flagged: 0, skipped: 0 }) };
  const notifications = { generateDailyBatch: jest.fn().mockResolvedValue({ clients: 1, notifications: 2, errors: 0 }) };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CronController],
      providers: [
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('segreto-cron') } },
        { provide: EngineService, useValue: engine },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: LeadAssignmentService, useValue: { expireStale: jest.fn().mockResolvedValue({ expired: 0 }) } },
        { provide: ReportsService, useValue: { sendMonthlyBatch: jest.fn().mockResolvedValue({ sent: 0 }) } },
        { provide: AlertsService, useValue: { recomputeAllBatch: jest.fn().mockResolvedValue({ clients: 1, errors: 0 }) } },
      ],
    }).compile();
    controller = moduleRef.get(CronController);
  });

  it('con il segreto giusto esegue motore + notifiche', async () => {
    const result = await controller.daily('segreto-cron');
    expect(result.engine.run).toBe(1);
    expect(result.notifications.notifications).toBe(2);
  });

  it('segreto sbagliato o assente → 403', async () => {
    await expect(controller.daily('sbagliato')).rejects.toThrow(ForbiddenException);
    await expect(controller.daily(undefined)).rejects.toThrow(ForbiddenException);
  });
});
