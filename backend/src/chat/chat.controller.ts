import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ChatService } from './chat.service';
import { ConversationSummaryService } from './conversation-summary.service';

class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

const COUNTERPARTS = ['ai', 'coach', 'nutritionist'];
function assertCounterpart(who: string): void {
  if (!COUNTERPARTS.includes(who)) throw new BadRequestException('Interlocutore non valido');
}

@Controller('me/threads')
@Roles('client')
export class MyThreadsController {
  constructor(
    private readonly chat: ChatService,
    private readonly summaries: ConversationSummaryService,
  ) {}

  @Get()
  myThreads(@CurrentUser() user: AuthUser) {
    return this.chat.myThreads(user.sub);
  }

  /** Conversazioni passate (riassunti giornalieri) con un interlocutore. */
  @Get(':who/summaries')
  mySummaries(@CurrentUser() user: AuthUser, @Param('who') who: string) {
    assertCounterpart(who);
    return this.summaries.listForClient(user.sub, who);
  }
}

@Controller('staff/threads')
@Roles('coach', 'nutritionist', 'head_nutritionist')
export class StaffThreadsController {
  constructor(
    private readonly chat: ChatService,
    private readonly summaries: ConversationSummaryService,
  ) {}

  @Get()
  staffThreads(@CurrentUser() user: AuthUser) {
    return this.chat.staffThreads(user);
  }

  /** Conversazioni passate di una cliente (staff): scope + niente nutrizionista per la coach. */
  @Get(':clientId/:who/summaries')
  clientSummaries(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Param('who') who: string,
  ) {
    assertCounterpart(who);
    return this.summaries.listForStaff(user, clientId, who);
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
