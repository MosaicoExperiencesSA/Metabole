import { Module } from '@nestjs/common';
import { PushModule } from '../notifications/push.module';
import { PersonalBaseController } from './personal-base.controller';
import { PersonalBaseService } from './personal-base.service';

@Module({
  // ⚠️ `PushModule` è autonomo (Prisma + Config): serve alla push di «Piano bloccato», che ferma
  // l'erogazione e che finora si vedeva solo aprendo il backoffice. `MailService` è globale.
  imports: [PushModule],
  controllers: [PersonalBaseController],
  providers: [PersonalBaseService],
  exports: [PersonalBaseService],
})
export class PersonalBaseModule {}
