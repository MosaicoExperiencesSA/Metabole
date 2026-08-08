import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ChatService } from './chat.service';
import { ConversationSummaryService } from './conversation-summary.service';

class SendMessageDto {
  // Il messaggio alla coach: testo libero, e i messaggi di errore li legge la cliente.
  @IsString({ message: 'Scrivi un messaggio.' })
  @MinLength(1, { message: 'Scrivi un messaggio.' })
  @MaxLength(4000, { message: 'Il messaggio è troppo lungo: dividilo in due, si legge meglio.' })
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

  /**
   * Apre il dialogo di sostituzione: è quello che chiama il pulsante «Sostituisci un
   * ingrediente» dell'app quando porta la cliente nella chat con Gaia. Gaia scrive il primo
   * messaggio (elenca i piatti di oggi e chiede quale alimento cambiare), così la cliente
   * trova la conversazione già cominciata invece di un campo di testo vuoto.
   *
   * POST e non GET perché scrive un messaggio. Idempotente nella pratica: riaprirlo due volte
   * ripete solo la domanda.
   */
  @Post('sostituzione')
  @HttpCode(200)
  avviaSostituzione(@CurrentUser() user: AuthUser) {
    return this.chat.avviaSostituzione(user.sub);
  }

  /** Conversazioni passate (riassunti giornalieri) con un interlocutore. */
  @Get(':who/summaries')
  mySummaries(@CurrentUser() user: AuthUser, @Param('who') who: string) {
    assertCounterpart(who);
    return this.summaries.listForClient(user.sub, who);
  }
}

@Controller('staff/threads')
@Roles('coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist')
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

/**
 * Le conversazioni di UNA cliente, per la scheda cliente in backoffice — thread con Gaia
 * compreso. Serve un controller a parte perché `/staff/threads` risponde con l'elenco di
 * tutte le proprie clienti e non accetta un cliente: la scheda non aveva modo di chiedere
 * «le chat di questa persona».
 */
@Controller('staff/clients/:clientId')
@Roles('coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist')
export class StaffClientChatController {
  constructor(private readonly chat: ChatService) {}

  /** Thread leggibili da chi chiede (quelli che non può leggere non compaiono). */
  @Get('threads')
  @RequirePage('chat')
  threads(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.chat.threadsDiUnCliente(user, clientId);
  }

  /**
   * I cambi di menu concordati in chat, con lo stato di verifica. È l'elenco che rende la
   * verifica del nutrizionista una cosa che si può fare davvero: senza, verificare vorrebbe
   * dire rileggere tutte le conversazioni.
   */
  @Get('sostituzioni-chat')
  @RequirePage('chat')
  sostituzioniChat(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    // `user` non è decorativo: il controllo di appartenenza sta nel service. Vedi
    // `ChatService.sostituzioniDiChatPerStaff`.
    return this.chat.sostituzioniDiChatPerStaff(user, clientId);
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
