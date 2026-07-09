import { Module } from '@nestjs/common';
import {
  AdminPermissionsController,
  MePermissionsController,
} from './permissions.controller';
import { PermissionsService } from './permissions.service';

@Module({
  controllers: [AdminPermissionsController, MePermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
