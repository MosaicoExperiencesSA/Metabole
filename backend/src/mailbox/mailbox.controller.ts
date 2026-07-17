import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { SendMailDto, SetMailboxDto } from './dto/mailbox.dto';
import { MailboxService } from './mailbox.service';

/** Casella di posta @metabole.eu dell'operatore (MVP: staff nel backoffice). */
@Controller('me/mailbox')
@Roles('coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist', 'sales', 'marketing', 'head_marketing', 'admin')
export class MailboxController {
  constructor(private readonly mailbox: MailboxService) {}

  @Get()
  status(@CurrentUser() user: AuthUser) {
    return this.mailbox.status(user.sub);
  }

  @Put()
  set(@Body() dto: SetMailboxDto, @CurrentUser() user: AuthUser) {
    return this.mailbox.setAccount(user.sub, dto.email, dto.password);
  }

  @Delete()
  remove(@CurrentUser() user: AuthUser) {
    return this.mailbox.remove(user.sub);
  }

  @Get('inbox')
  inbox(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.mailbox.listInbox(user.sub, limit ? Number(limit) : 25);
  }

  @Get('message/:uid')
  message(@Param('uid') uid: string, @CurrentUser() user: AuthUser) {
    return this.mailbox.getMessage(user.sub, Number(uid));
  }

  @HttpCode(200)
  @Post('send')
  send(@Body() dto: SendMailDto, @CurrentUser() user: AuthUser) {
    return this.mailbox.send(user.sub, dto);
  }
}
