import { Module } from '@nestjs/common';
import { CompensationController } from './compensation.controller';

@Module({
  controllers: [CompensationController],
})
export class CompensationModule {}
