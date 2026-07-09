import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Role } from '../common/roles';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
@Roles('admin')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(
    @Query('role') role?: Role,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.users.list({
      role,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50,
    });
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.users.getById(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.create(dto, actor.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.update(id, dto, actor.sub);
  }
}
