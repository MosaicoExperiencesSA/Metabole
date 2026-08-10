import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { EquivalenceController } from './equivalence.controller';
import { EquivalenceService } from './equivalence.service';

@Module({
  // `NotificationsModule` serve per avvisare il capo nutrizionista dei gruppi nuovi (11/8). Nessun
  // anello: Notifications non dipende da Equivalence.
  imports: [NotificationsModule],
  controllers: [EquivalenceController],
  providers: [EquivalenceService],
  exports: [EquivalenceService],
})
export class EquivalenceModule {}
