import { Module } from '@nestjs/common';
import { GiudiceService } from './giudice.service';
import { PublisherService } from './publisher.service';
import { SocialController } from './social.controller';

@Module({
  controllers: [SocialController],
  providers: [PublisherService, GiudiceService],
  exports: [PublisherService, GiudiceService],
})
export class SocialModule {}
