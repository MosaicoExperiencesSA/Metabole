import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AssignmentDto } from './dto/assignment.dto';
import { UsersService } from './users.service';

@Controller('admin/assignments')
@Roles('admin')
export class AdminAssignmentsController {
  constructor(private readonly users: UsersService) {}

  @Post()
  assign(@Body() dto: AssignmentDto, @CurrentUser() actor: AuthUser) {
    return this.users.assign(dto, actor.sub);
  }
}
