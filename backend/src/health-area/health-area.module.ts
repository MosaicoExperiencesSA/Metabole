import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClinicalNotesService } from './clinical-notes.service';
import { DocumentsService } from './documents.service';
import {
  DocumentsController,
  MyHealthController,
  NutritionistController,
} from './health-area.controller';
import { VisitsService } from './visits.service';

@Module({
  imports: [CommerceModule, NotificationsModule],
  controllers: [MyHealthController, DocumentsController, NutritionistController],
  providers: [VisitsService, DocumentsService, ClinicalNotesService],
  exports: [VisitsService],
})
export class HealthAreaModule {}
