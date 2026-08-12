import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { FoodSwapsController } from './food-swaps.controller';
import { FoodSwapsService } from './food-swaps.service';

/**
 * La tabella delle sostituzioni concordate con le clienti (§16.9).
 *
 * ⚠️ La SCRITTURA delle righe non passa da qui: la fa `registra-sostituzione.ts`, una funzione che
 * prende `prisma` e basta, chiamata da `SostituzioneChatService` subito dopo aver scritto il cambio
 * sul menu. È voluto: iniettare questo servizio dentro il modulo del menu avrebbe legato il
 * percorso del pasto — quello che la cliente vede domani mattina — a un modulo di backoffice.
 */
@Module({
  /**
   * ⚠️ `NotificationsModule` serve perché `promuovi` avvisa i capi nutrizionisti del gruppo nuovo.
   *
   * Mancava, e il 12/8 ha fatto fallire il deploy su Render: Nest risolve le dipendenze
   * all'AVVIO, non alla compilazione — `tsc` era verde, 1794 test erano verdi, e il processo
   * usciva con 1 al primo boot in produzione. Da lì il test `app.module.spec.ts`, che compila
   * l'applicazione intera ed è l'unico capace di vedere questa classe di errore.
   *
   * Nessun anello: `NotificationsModule` importa `MenuModule`, e il menu non importa questo —
   * la scrittura delle righe passa da `registra-sostituzione.ts`, che è una funzione e non un
   * servizio iniettato. È anche il motivo per cui lo è.
   */
  imports: [NotificationsModule],
  controllers: [FoodSwapsController],
  providers: [FoodSwapsService],
  exports: [FoodSwapsService],
})
export class FoodSwapsModule {}
