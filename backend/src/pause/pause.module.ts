import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { MePauseController, StaffPauseController } from './pause.controller';
import { PauseService } from './pause.service';

/**
 * Congelamento abbonamento (pausa vacanza). Consuma NotificationsModule come
 * foglia: NON è importato da notifications (evita il ciclo notifications→menu).
 */
@Module({
  imports: [NotificationsModule],
  controllers: [MePauseController, StaffPauseController],
  providers: [PauseService],
  exports: [PauseService],
})
export class PauseModule {}
