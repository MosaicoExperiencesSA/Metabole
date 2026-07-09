import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ChatService } from './chat.service';

class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

@Controller('me/threads')
@Roles('client')
export class MyThreadsController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  myThreads(@CurrentUser() user: AuthUser) {
    return this.chat.myThreads(user.sub);
  }
}

@Controller('staff/threads')
@Roles('coach', 'nutritionist', 'head_nutritionist')
export class StaffThreadsController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  staffThreads(@CurrentUser() user: AuthUser) {
    return this.chat.staffThreads(user);
  }
}

/** Messaggi: l'accesso è verificato thread per thread nel service. */
@Controller('threads')
export class ThreadsController {
  constructor(private readonly chat: ChatService) {}

  @Get(':id/messages')
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.listMessages(user, id);
  }

  @Post(':id/messages')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.postMessage(user, id, dto.body);
  }
}
