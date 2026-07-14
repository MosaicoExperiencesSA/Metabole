import { Module } from '@nestjs/common';
import { PersonalBaseModule } from '../personal-base/personal-base.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [PersonalBaseModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
