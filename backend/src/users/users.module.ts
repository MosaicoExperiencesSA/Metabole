import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { MeController } from './me.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [AdminUsersController, MeController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
