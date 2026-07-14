import { Module } from '@nestjs/common';
import { PersonalBaseController } from './personal-base.controller';
import { PersonalBaseService } from './personal-base.service';

@Module({
  controllers: [PersonalBaseController],
  providers: [PersonalBaseService],
  exports: [PersonalBaseService],
})
export class PersonalBaseModule {}
