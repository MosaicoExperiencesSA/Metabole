import { Module } from '@nestjs/common';
import { LavoriController } from './lavori.controller';
import { LavoriService } from './lavori.service';

@Module({
  controllers: [LavoriController],
  providers: [LavoriService],
  exports: [LavoriService],
})
export class LavoriModule {}
