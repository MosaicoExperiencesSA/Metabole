import { Module } from '@nestjs/common';
import { AgendaModule } from '../agenda/agenda.module';
import { AuthModule } from '../auth/auth.module';
import { CoachTasksModule } from '../coach-tasks/coach-tasks.module';
import { MenuModule } from '../menu/menu.module';
import { NotificationsModule } from '../notifications/notifications.module';
// ⚠️ Nessun anello: `PauseModule` importa notifiche e monitoraggio, e non conosce i clienti.
import { PauseModule } from '../pause/pause.module';
/**
 * ⛔ **La base personale si rifà anche dalla scheda** (2/9): lo staff che cambia dieta o allergie
 * non passa da `profile.service`, e fino a oggi qui non si rifaceva niente. ⚠️ Nessun anello:
 * `PersonalBaseModule` importa solo `PushModule` (dal 4/9, per la push di «Piano bloccato»), che è
 * autonomo — Prisma e Config, entrambi globali. Qui c'era scritto «non importa nessuno», ed è
 * rimasto vero fino a stanotte: una riga così va corretta, non lasciata invecchiare.
 */
import { PersonalBaseModule } from '../personal-base/personal-base.module';
// ⚠️ Le pesate corrette dallo staff devono far scattare gli stessi segnali di quelle inserite dalla
// cliente (28/8). Nessun anello: `SignalsModule` non importa i clienti.
import { SignalsModule } from '../signals/signals.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  /**
   * ⚠️ `CoachTasksModule` e `AgendaModule` servono a «serve una visita» (voce «La visita nel
   * calendario»): l'attività si apre dal punto unico che manda anche la push, e il credito visite
   * lo conta chi lo conta già per l'app. Nessun anello: nessuno dei due importa noi.
   */
  imports: [AuthModule, MenuModule, NotificationsModule, CoachTasksModule, AgendaModule, PauseModule, SignalsModule, PersonalBaseModule],
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
