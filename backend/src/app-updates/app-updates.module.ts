import { Module } from '@nestjs/common';
import { AppUpdatesController } from './app-updates.controller';

@Module({
  controllers: [AppUpdatesController],
})
export class AppUpdatesModule {}
