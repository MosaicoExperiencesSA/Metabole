import { Module } from '@nestjs/common';
import { EquivalenceController } from './equivalence.controller';
import { EquivalenceService } from './equivalence.service';

@Module({
  controllers: [EquivalenceController],
  providers: [EquivalenceService],
  exports: [EquivalenceService],
})
export class EquivalenceModule {}
