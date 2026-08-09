import { Module } from '@nestjs/common';
// `CommerceModule` serve per una cosa sola: disdire il rinnovo automatico quando la cliente revoca
// (decisione del 10/8). Nessun ciclo — `CommerceModule` non sa niente di questo modulo.
import { CommerceModule } from '../commerce/commerce.module';
import { MyConsentController, PrivacyPublicController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

@Module({
  imports: [CommerceModule],
  controllers: [MyConsentController, PrivacyPublicController],
  providers: [PrivacyService],
  // Esce dal modulo perché lo chiama il cron notturno: gli avvisi del giorno prima e le
  // cancellazioni scadute sono un passo di `internal/cron/daily`.
  exports: [PrivacyService],
})
export class PrivacyModule {}
