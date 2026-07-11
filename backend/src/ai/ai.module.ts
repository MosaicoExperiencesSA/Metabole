import { Module } from '@nestjs/common';
import { ConfigParamsModule } from '../config-params/config-params.module';
import { AiService } from './ai.service';

@Module({
  imports: [ConfigParamsModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
