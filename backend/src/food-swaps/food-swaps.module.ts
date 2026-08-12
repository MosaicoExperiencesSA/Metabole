import { Module } from '@nestjs/common';
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
  controllers: [FoodSwapsController],
  providers: [FoodSwapsService],
  exports: [FoodSwapsService],
})
export class FoodSwapsModule {}
