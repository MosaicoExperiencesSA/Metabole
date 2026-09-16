import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { Type } from 'class-transformer';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Public } from '../common/decorators/public.decorator';
import { AllegatiChatService } from './allegati-chat.service';
import { ChatService } from './chat.service';
import { ConversationSummaryService } from './conversation-summary.service';

/**
 * Il file allegato a un messaggio (16/9). Qui solo la forma: tipi ammessi, peso e nome li decide
 * `allegati-chat.ts`, che sa dire alla cliente cosa non va.
 */
class AllegatoDto {
  @IsString({ message: 'Il file non ha un nome.' })
  @MaxLength(255, { message: 'Il nome del file è troppo lungo.' })
  nome!: string;

  @IsString({ message: 'Non riesco a capire che file è.' })
  @MaxLength(120, { message: 'Non riesco a capire che file è.' })
  tipo!: string;

  // 8 MB in base64 sono circa 10,7 milioni di caratteri: il tetto vero lo mette `valutaAllegato`.
  @IsString({ message: 'Il file non è arrivato: riprova ad allegarlo.' })
  @MaxLength(11_500_000, { message: 'Il file è troppo grande: il massimo è 8 MB.' })
  base64!: string;
}

class SendMessageDto {
  /**
   * Il messaggio alla coach: testo libero, e i messaggi di errore li legge la cliente.
   * ⚠️ Dal 16/9 può mancare **se c'è un allegato** (una foto senza parole è un messaggio). Il «vuoto»
   * lo guarda il service, che sa anche se c'è il file.
   */
  @ValidateIf((o: { allegato?: unknown; body?: unknown }) => !o.allegato || o.body !== undefined)
  @IsString({ message: 'Scrivi un messaggio.' })
  @MaxLength(4000, { message: 'Il messaggio è troppo lungo: dividilo in due, si legge meglio.' })
  body?: string;

  @IsOptional()
  @ValidateNested({ message: 'Il file allegato non è valido.' })
  @Type(() => AllegatoDto)
  allegato?: AllegatoDto;
}

/**
 * L'indirizzo pubblico del backend. ⚠️ Prima `PUBLIC_API_URL` (lo usano già le email): gli header
 * `x-forwarded-*` li può scrivere chi chiama. Se manca, com'è visto da chi ha chiamato.
 */
export function baseDellaRichiesta(req: Request): string {
  const fisso = process.env.PUBLIC_API_URL?.trim();
  if (fisso) return fisso.replace(/\/$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host || 'localhost';
  return `${proto}://${host}`;
}

/**
 * Da quale giornata la cliente ha premuto «Sostituisci» (§16.2).
 *
 * L'app sa benissimo quale giorno sta guardando — la schermata del menu ha le pillole dei giorni —
 * e finora quell'informazione si perdeva nel passaggio alla chat: Gaia elencava i piatti di oggi a
 * chi stava guardando domani. Facoltativo: senza, è oggi, come è sempre stato.
 */
class AvviaSostituzioneDto {
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Data non valida (AAAA-MM-GG).' })
  data?: string;
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
  avviaSostituzione(@CurrentUser() user: AuthUser, @Body() dto?: AvviaSostituzioneDto) {
    return this.chat.avviaSostituzione(user.sub, dto?.data ?? null);
  }

  /**
   * Apre la ri-domanda sulle allergie (§7 dell'handoff): è quello che chiama l'app quando la
   * cliente tocca la notifica «allergie_conferma».
   *
   * ⚠️ Non prende nessun parametro, e in particolare **non** prende il motivo dalla notifica: lo
   * rilegge dal profilo. Fra l'invio e il tocco possono passare giorni, e nel frattempo la
   * nutrizionista può aver già sistemato tutto dalla scheda.
   */
  @Post('allergie')
  @HttpCode(200)
  avviaAllergie(@CurrentUser() user: AuthUser) {
    return this.chat.avviaAllergie(user.sub);
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
  @RequirePage('client_conversations')
  threads(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.chat.threadsDiUnCliente(user, clientId);
  }

  /**
   * I cambi di menu concordati in chat, con lo stato di verifica. È l'elenco che rende la
   * verifica del nutrizionista una cosa che si può fare davvero: senza, verificare vorrebbe
   * dire rileggere tutte le conversazioni.
   */
  @Get('sostituzioni-chat')
  @RequirePage('client_conversations')
  sostituzioniChat(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    // `user` non è decorativo: il controllo di appartenenza sta nel service. Vedi
    // `ChatService.sostituzioniDiChatPerStaff`.
    return this.chat.sostituzioniDiChatPerStaff(user, clientId);
  }

  /**
   * La VERIFICA di un cambio: conferma, correggi i grammi, o annulla.
   *
   * Il permesso è `client_conversations` e non `chat`, ed è il motivo per cui esiste quella chiave
   * separata: `chat` è la pagina delle conversazioni dell'azienda, e la coach ce l'ha in gestione
   * perché deve poter scrivere alle sue clienti — usarla qui avrebbe voluto dire che chiunque può
   * scrivere in chat può anche correggere i grammi di un piatto.
   *
   * Restano DUE cancelli, come per la lettura: questo, e `manage` verificato di nuovo dentro
   * `ChatService.correggiCambioInChatPerStaff` insieme alla portata sulla cliente. Vedi il commento
   * in testa a questo controller.
   */
  @Patch('sostituzioni-chat')
  @RequirePage('client_conversations', 'manage')
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
  constructor(
    private readonly chat: ChatService,
    private readonly allegati: AllegatiChatService,
  ) {}

  /** ⚠️ Gli allegati escono col LINK firmato per chi legge, mai col contenuto. */
  @Get(':id/messages')
  async list(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    const base = baseDellaRichiesta(req);
    const messaggi = await this.chat.listMessages(user, id);
    return messaggi.map((m) => this.allegati.conLink(m, user.sub, base));
  }

  @Post(':id/messages')
  async send(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @Req() req: Request,
  ) {
    // Il file si controlla PRIMA di scrivere qualunque cosa: un messaggio senza il suo allegato
    // sarebbe una frase che dice «ti mando la foto» senza la foto.
    const allegato = dto.allegato ? this.allegati.prepara(dto.allegato) : undefined;
    const r = await this.chat.postMessage(user, id, dto.body, allegato);
    const base = baseDellaRichiesta(req);
    return {
      ...r,
      message: this.allegati.conLink(r.message, user.sub, base),
      ...('aiReply' in r && r.aiReply ? { aiReply: this.allegati.conLink(r.aiReply, user.sub, base) } : {}),
    };
  }

  /**
   * Cancella un proprio messaggio. Chi lo può fare è deciso nel servizio, ed è **solo l'autore**:
   * qui non c'è nessun `@Roles`, perché la regola non dipende dal ruolo ma da chi ha scritto.
   */
  @Delete(':id/messages/:messageId')
  elimina(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chat.eliminaMessaggio(user, id, messageId);
  }
}

/**
 * ⛔ **IL FILE DI UN ALLEGATO, da un link firmato** (16/9).
 *
 * `@Public` perché un `<img>` e un PDF aperto fuori dall'app non mandano il token: l'accesso lo
 * decide la FIRMA del link (chi, fino a quando) e poi, di nuovo, il cancello delle conversazioni.
 *
 * ⚠️ Tre intestazioni che contano:
 * - `Cross-Origin-Resource-Policy: cross-origin` — helmet mette `same-origin`, e l'app e il
 *   backoffice stanno su un altro dominio: senza, le foto non si vedrebbero;
 * - `X-Content-Type-Options: nosniff` — il browser usa il tipo dichiarato e basta;
 * - `Cache-Control: private` — mai in una cache condivisa (Cloudflare): è un dato di una persona.
 */
@Public()
/**
 * ⚠️ Niente limite per IP: una conversazione piena di foto, aperta da tre persone dello stesso
 * ufficio, lo supererebbe con immagini rotte. Qui a proteggere è la firma, come per i cron.
 */
@SkipThrottle()
@Controller('chat-files')
export class ChatFilesController {
  constructor(
    private readonly chat: ChatService,
    private readonly allegati: AllegatiChatService,
  ) {}

  @Get(':id')
  async apri(
    @Param('id') id: string,
    @Query() q: { e?: string; u?: string; s?: string },
    @Res() res: Response,
  ): Promise<void> {
    const f = await this.allegati.apri(id, q, (utente, threadId) => this.chat.puoLeggereIlThread(utente, threadId));
    res.setHeader('Content-Type', f.tipo);
    res.setHeader('Content-Disposition', f.disposizione);
    res.setHeader('Content-Length', String(f.contenuto.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'private, max-age=1800');
    res.end(f.contenuto);
  }
}

/**
 * PERCHÉ NON È ARRIVATA LA NOTIFICA — strumento di diagnosi, per l'admin.
 *
 * Segnalazione di Simone (12/8): «al nutrizionista continuano a non arrivare le notifiche dei
 * messaggi». Il percorso nel codice è corretto e i test lo coprono: quello che manca si vede solo
 * nei dati di quella cliente. Questa rotta risponde alla domanda che conta — **quale dei sei
 * gradini è rotto per lei** — invece di lasciare che si rifaccia la prova sperando di vederla
 * fallire.
 *
 * Non manda niente e non scrive niente: è solo una lettura.
 */
@Controller('admin/diagnosi-avviso-chat')
@Roles('admin', 'head_nutritionist')
export class DiagnosiAvvisoChatController {
  constructor(private readonly chat: ChatService) {}

  @Get(':clientId')
  diagnosi(@Param('clientId') clientId: string, @Query('chi') chi?: string) {
    const controparte = chi === 'coach' ? 'coach' : 'nutritionist';
    return this.chat.diagnosiAvviso(clientId, controparte);
  }
}
