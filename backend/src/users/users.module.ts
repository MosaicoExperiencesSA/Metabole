import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { AdminAssignmentsController } from './admin-assignments.controller';
import { AdminUsersController } from './admin-users.controller';
import { MeController } from './me.controller';
import { UsersService } from './users.service';

@Module({
  imports: [CommerceModule],
  controllers: [AdminUsersController, AdminAssignmentsController, MeController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
