import { Module } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { SignalsController } from './signals.controller';
import { SignalsService } from './signals.service';
import { WidgetController } from './widget.controller';

@Module({
  controllers: [SignalsController, WidgetController],
  providers: [SignalsService, ProgressService],
  exports: [SignalsService, ProgressService],
})
export class SignalsModule {}
