import { Module } from '@nestjs/common';
import { PushService } from './push.service';

/**
 * Le push in un modulo tutto loro.
 *
 * Perché non stanno più dentro `NotificationsModule`: quel modulo importa `MenuModule` (le
 * notifiche del motore hanno bisogno del menu), quindi chiunque stia dentro `MenuModule` non
 * poteva mandare una push senza creare una dipendenza circolare. È il caso dello sblocco misure:
 * la coach riapre l'app e alla cliente va chiesto **subito** di inserire le misure — una notifica
 * nel campanello la vede solo se apre l'app, cioè esattamente la cosa che non stava facendo.
 *
 * `PushService` dipende solo da Prisma e ConfigService, entrambi globali: estrarlo non porta con sé
 * nient'altro. `NotificationsModule` continua a riesportarlo, così chi lo prendeva da lì non cambia.
 */
@Module({
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
