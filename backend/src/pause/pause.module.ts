import { Module } from '@nestjs/common';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MePauseController, StaffPauseController } from './pause.controller';
import { PauseService } from './pause.service';

/**
 * Congelamento abbonamento (pausa vacanza). Consuma NotificationsModule come
 * foglia: NON è importato da notifications (evita il ciclo notifications→menu).
 */
@Module({
  // MonitoringModule: i menu di rientro a fine pausa li genera quel modulo (nessun ciclo:
  // monitoring non conosce pause).
  imports: [NotificationsModule, MonitoringModule],
  controllers: [MePauseController, StaffPauseController],
  providers: [PauseService],
  exports: [PauseService],
})
export class PauseModule {}
