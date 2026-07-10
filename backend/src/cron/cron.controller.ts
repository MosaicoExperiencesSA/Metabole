import {
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { AuditService } from '../audit/audit.service';
import { Public } from '../common/decorators/public.decorator';
import { EngineService } from '../engine/engine.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Endpoint per Render Cron Jobs: il motore gira ogni giorno e le notifiche
 * vengono generate senza intervento umano. Protetto da segreto condiviso
 * (header x-cron-secret = env CRON_SECRET), non dal JWT.
 */
@SkipThrottle() // protetto dal segreto condiviso, non dal rate limit
@Controller('internal/cron')
export class CronController {
  constructor(
    private readonly config: ConfigService,
    private readonly engine: EngineService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  private assertSecret(secret?: string): void {
    const expected = this.config.get<string>('CRON_SECRET');
    if (!expected || !secret || secret !== expected) {
      throw new ForbiddenException('Cron secret non valido');
    }
  }

  @Public()
  @HttpCode(200)
  @Post('daily')
  async daily(@Headers('x-cron-secret') secret?: string) {
    this.assertSecret(secret);
    const engine = await this.engine.runBatch();
    const notifications = await this.notifications.generateDailyBatch();
    await this.audit.log({
      action: 'cron.daily',
      metadata: { engine, notifications } as Record<string, unknown>,
    });
    return { engine, notifications };
  }
}
