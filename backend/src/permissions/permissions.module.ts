import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import {
  AdminPermissionsController,
  MePermissionsController,
} from './permissions.controller';
import { PermissionsService } from './permissions.service';

@Module({
  imports: [RolesModule],
  controllers: [AdminPermissionsController, MePermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
