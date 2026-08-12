import { Module } from '@nestjs/common';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';

/**
 * §16.7 — la settimana tipo del nutrizionista e i giorni in cui non riceve.
 *
 * `PrismaService` e `AuditService` sono globali, quindi non serve importare niente. ⚠️ Se un giorno
 * questo servizio dovrà mandare una notifica o un'email, `NotificationsModule` e `MailModule`
 * vanno messi QUI negli `imports`: è la riga che il 12/8 mancava a `FoodSwapsModule` e ha fatto
 * fallire il deploy. `app.module.spec.ts` la sorveglia.
 */
@Module({
  controllers: [AgendaController],
  providers: [AgendaService],
  exports: [AgendaService],
})
export class AgendaModule {}
