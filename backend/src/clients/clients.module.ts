import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MenuModule } from '../menu/menu.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [AuthModule, MenuModule, NotificationsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  /**
   * ⚠️ Esportato per Vera (13/8). Il contratto fra le due sessioni dice che la scrittura delle
   * allergie passa dal **punto unico che esiste già** — `updateClient`, che controlla il permesso
   * `change_allergies`, ricalcola `allergiesOther` e lascia la traccia. Una seconda strada per lo
   * stesso dato sanitario è il difetto che questo campo ha già avuto due volte.
   */
  exports: [ClientsService],
})
export class ClientsModule {}
