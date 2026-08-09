import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
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

/**
 * La verifica di un cambio nato in chat. Il cambio non ha un id — vive dentro il JSON dei pasti di
 * quella giornata — quindi si individua per **giornata + pasto + alimento**.
 *
 * La validazione è stretta su `stato` e sui grammi per una ragione pratica: questo endpoint scrive
 * nel piatto di una persona, e `toQty` arriva da un campo di testo del backoffice. Un 700 battuto
 * per 70 non deve poter diventare una porzione.
 */
class CorreggiCambioDto {
  @IsISO8601({ strict: true }, { message: 'Data non valida (AAAA-MM-GG).' })
  data!: string;

  @IsString()
  slot!: string;

  @IsIn(['ingrediente', 'piatto'], { message: 'Tipo di cambio non valido.' })
  tipo!: 'ingrediente' | 'piatto';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  from?: string;

  @IsIn(['verificata', 'corretta', 'annullata'], { message: 'Esito non valido.' })
  stato!: 'verificata' | 'corretta' | 'annullata';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  to?: string;

  @IsOptional()
  @IsInt({ message: 'La quantità deve essere un numero intero.' })
  @Min(1, { message: 'La quantità deve essere almeno 1.' })
  @Max(2000, { message: 'Quantità fuori scala: controlla il numero.' })
  toQty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  unitA?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La nota è troppo lunga: la legge anche la cliente.' })
  nota?: string;
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
/**
 * ⚠️ `admin` DEVE stare in questo elenco. Sbagliato una volta, l'8/8: la decisione «l'admin legge
 * tutte le conversazioni» era stata implementata nel servizio (`assertThreadAccess`) e lì funziona,
 * ma il guardiano della ROTTA fermava l'admin prima — 403 — e la scheda mostrava «Nessuna
 * conversazione visibile per il tuo ruolo». Sembrava che il ramo nel servizio non funzionasse, e
 * Simone ha dovuto segnalarlo due volte.
 *
 * La lezione: qui i cancelli sono DUE, la rotta e il servizio, e vanno cambiati insieme. Il primo
 * decide chi può bussare, il secondo cosa può leggere.
 *
 * `sales` (manager delle coach) resta fuori: vede lead, contatti e metriche, non il clinico.
 */
@Controller('staff/clients/:clientId')
@Roles('admin', 'coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist')
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

  /**
   * La VERIFICA di un cambio: conferma, correggi i grammi, o annulla.
   *
   * `@RequirePage('chat', 'manage')` non basta e non è il cancello che conta: la coach ha quel
   * permesso perché deve poter scrivere alle sue clienti. Chi può toccare un cambio è deciso per
   * RUOLO dentro `ChatService.correggiCambioInChatPerStaff` — nutrizionista, capo nutrizionista,
   * admin — perché la grammatura di un piatto è materia clinica. Sono due cancelli, come per la
   * lettura: vedi il commento in testa a questo controller.
   */
  @Patch('sostituzioni-chat')
  @RequirePage('chat', 'manage')
  correggiCambio(
    @CurrentUser() user: AuthUser,
    @Param('clientId') clientId: string,
    @Body() body: CorreggiCambioDto,
  ) {
    return this.chat.correggiCambioInChatPerStaff(user, clientId, body);
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
