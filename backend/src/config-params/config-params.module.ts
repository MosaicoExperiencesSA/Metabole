import { Global, Module } from '@nestjs/common';
import { AdminConfigController } from './admin-config.controller';
import { ConfigParamsService } from './config-params.service';

@Global()
@Module({
  controllers: [AdminConfigController],
  providers: [ConfigParamsService],
  exports: [ConfigParamsService],
})
export class ConfigParamsModule {}
