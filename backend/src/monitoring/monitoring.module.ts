import { Module } from '@nestjs/common';
import { ConfigParamsModule } from '../config-params/config-params.module';
// ⚠️ MenuModule serve per `KcalNeedService`: il kit di rientro riporziona le giornate copiate sul
// fabbisogno di adesso (voce 255), e il fabbisogno lo calcola la stessa classe che usa
// l'erogazione. Nessun ciclo: `MenuModule` non importa questo modulo.
import { MenuModule } from '../menu/menu.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminMonitoringController, MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [ConfigParamsModule, NotificationsModule, MenuModule],
  controllers: [MonitoringController, AdminMonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
