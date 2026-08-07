import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PersonalBaseModule } from '../personal-base/personal-base.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  // NotificationsModule per avvisare la coach a questionario completato. Nessun ciclo:
  // NotificationsModule → MenuModule → Calendar/DietAgent, e nessuno di questi importa
  // OnboardingModule.
  imports: [PersonalBaseModule, NotificationsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
