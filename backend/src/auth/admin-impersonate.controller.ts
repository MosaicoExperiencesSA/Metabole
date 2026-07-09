import { Body, Controller, HttpCode, Ip, Post } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AuthService } from './auth.service';

class ImpersonateDto {
  @IsUUID()
  userId!: string;
}

@Controller('admin/impersonate')
@Roles('admin')
export class AdminImpersonateController {
  constructor(private readonly auth: AuthService) {}

  @HttpCode(200)
  @Post()
  impersonate(
    @Body() dto: ImpersonateDto,
    @CurrentUser() actor: AuthUser,
    @Ip() ip: string,
  ) {
    return this.auth.impersonate(actor.sub, dto.userId, ip);
  }
}
