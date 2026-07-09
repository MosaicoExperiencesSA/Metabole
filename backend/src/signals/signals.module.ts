import { Module } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { SignalsController } from './signals.controller';
import { SignalsService } from './signals.service';

@Module({
  controllers: [SignalsController],
  providers: [SignalsService, ProgressService],
  exports: [SignalsService, ProgressService],
})
export class SignalsModule {}
