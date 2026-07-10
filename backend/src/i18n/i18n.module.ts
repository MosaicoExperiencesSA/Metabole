import { Global, Module } from '@nestjs/common';
import { I18nService } from './i18n.service';

/** Globale: email, notifiche e composer lo usano ovunque senza import ripetuti. */
@Global()
@Module({
  providers: [I18nService],
  exports: [I18nService],
})
export class I18nModule {}
