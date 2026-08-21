import { Module } from '@nestjs/common';
import { PersonalBaseModule } from '../personal-base/personal-base.module';
import { PushModule } from '../notifications/push.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  // ⚠️ PushModule: l'attività per la nutrizionista del digiuno nasce da `apriAttivitaCoach`, che
  // crea e avvisa nello stesso punto. Un'attività muta è un'attività che nessuno guarda.
  imports: [PersonalBaseModule, PushModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
