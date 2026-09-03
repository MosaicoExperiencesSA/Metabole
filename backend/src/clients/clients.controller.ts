import { Body, Controller, Delete, Get, HttpCode, Ip, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { KcalNeedService } from '../menu/kcal-need.service';
import { ClientsService } from './clients.service';
import { UpdateClientDto } from './dto/update-client.dto';

class AddNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;
}

/**
 * Il via libera clinico. ⚠️ La nota è **obbligatoria** e ha un minimo: una decisione clinica senza
 * una riga che la spieghi è indistinguibile da un clic per sbaglio, e chi la legge fra un mese — la
 * coach, o un'altra nutrizionista — non saprebbe se la cliente è stata valutata o solo sfiorata col
 * mouse. Il controllo vero (con la frase giusta da mostrare) sta in `idoneita.ts`: qui è la rete di
 * sicurezza del DTO.
 */
class IdoneitaDto {
  @IsString()
  @IsIn(['idonea', 'serve_visita'])
  esito!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  nota!: string;

  /**
   * Solo per `serve_visita`: il giorno entro cui la visita va fatta, `AAAA-MM-GG`.
   *
   * ⚠️ **`@IsOptional` qui e obbligatoria in `idoneita.ts`**, non il contrario: la regola «senza
   * data la decisione non si salva» è una regola di dominio, e la frase che la nutrizionista deve
   * leggere («da quel giorno in poi i menu si fermano») non è una frase che sappia scrivere un
   * decoratore. ⛔ E `ValidationPipe` è in `forbidNonWhitelisted`: senza questo campo dichiarato,
   * l'app riceverebbe un **400** invece della data salvata.
   */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  visitaEntro?: string;
}

/**
 * ⚠️ **`rientro` e `end` NON sono la stessa data**, ed è di proposito che convivono.
 *
 * `rientro` è quello che la card manda da oggi: il **primo giorno di dieta** («riprende il 24»).
 * `end` è la forma vecchia — l'**ultimo giorno di vacanza** — e resta accettata perché un
 * backoffice aperto da ieri, con il bundle in cache, continua a mandarla: leggerla come «rientro»
 * sposterebbe di un giorno la vacanza di qualcuno senza che nessuno se ne accorga. Chi manda
 * tutt'e due vince `rientro`. Vedi `pause/giorno-di-rientro.ts`.
 */
class TravelDto {
  @IsOptional() @IsString() @MaxLength(20) state?: string;
  @IsOptional() @IsString() @MaxLength(40) start?: string;
  @IsOptional() @IsString() @MaxLength(40) rientro?: string;
  @IsOptional() @IsString() @MaxLength(40) end?: string;
  /**
   * ⛔ Il MOTIVO della sospensione (Simone, 24/8). ⚠️ `@IsOptional()` qui, e obbligatorio nel
   * servizio: la regola è «serve **quando si sospende davvero**», e un decoratore non conosce lo
   * stato. Pretenderlo qui vorrebbe dire chiederlo anche a chi sta *togliendo* una sospensione.
   */
  @IsOptional() @IsString() @MaxLength(500) motivo?: string;
  /**
   * ⛔ **«STO AGGIUNGENDONE UNA SECONDA», non «sto correggendo questa»** — 25/8, dopo la revisione.
   *
   * Le due cose arrivano qui con la stessa forma — due date e un motivo — e il server non può
   * distinguerle: la card si precompila con la sospensione in corso, quindi **cambiare le date è il
   * gesto naturale per spostarla**. Senza questo campo, aperte le sospensioni consecutive, quel
   * gesto avrebbe creato una SECONDA sospensione e concesso i giorni **due volte**, in silenzio:
   * riprodotto dalla revisione, +20 giorni di scadenza per una vacanza di 10.
   *
   * ⚠️ Lo manda **solo** il pulsante «Aggiungine un'altra». Assente = comportamento di sempre: se
   * c'è già una modalità viaggio aperta su altre date, si rifiuta e si spiega come fare. Il caso
   * pericoloso resta chiuso di default, e la capacità nuova si chiede.
   */
  @IsOptional() @IsBoolean() aggiungi?: boolean;
}

class PlanStartDto {
  @IsString() @MaxLength(10) @MinLength(10) date!: string; // AAAA-MM-GG
  /**
   * «Sì, so che con questa data il piano risulta già finito.» Senza questo flag il server
   * risponde 409 con la frase da mostrare, invece di eseguire in silenzio un comando che
   * fa sparire il piano della cliente.
   */
  @IsOptional() @IsBoolean() conferma?: boolean;
}

class SetPasswordDto {
  @IsString() @MinLength(8) @MaxLength(200) password!: string;
}

/** Correzione misura: le circonferenze accettano anche null (= svuota il dato). */
class FixMeasurementDto {
  @IsOptional() @IsNumber() @Min(25) @Max(400) weightKg?: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber() @Min(20) @Max(300) waistCm?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber() @Min(20) @Max(300) hipsCm?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber() @Min(20) @Max(300) thighsCm?: number | null;
}

/** Scheda cliente (staff che gestisce i clienti). */
@Controller('admin/clients')
@Roles('coach', 'coach_coordinator', 'nutritionist', 'head_nutritionist', 'sales', 'admin')
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly kcalNeed: KcalNeedService,
  ) {}

  /** Fabbisogno calorico stimato dal profilo (per il nutrizionista: trasparenza sul target menu). */
  @Get(':id/kcal-need')
  kcalNeedEstimate(@Param('id') id: string) {
    return this.kcalNeed.estimate(id);
  }

  /** Elenco clienti: coach/nutrizionista vedono SOLO i propri assegnati; manager coach, capo nutrizionista e admin tutti. */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.clients.listClients(user.sub);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clients.getDetail(id, user.sub);
  }

  /** Cronologia delle modifiche al profilo (chi e quando). */
  @Get(':id/audit')
  changeLog(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clients.changeLog(id, user.sub);
  }

  /** Aggiunge una nota al log dello staff sul cliente. */
  @HttpCode(201)
  @Post(':id/note')
  addNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddNoteDto) {
    return this.clients.addNote(id, user.sub, dto.body);
  }

  /**
   * IL VIA LIBERA CLINICO: «può proseguire» / «serve una visita».
   *
   * Permesso `clinical_clearance`, controllato nel servizio insieme all'appartenenza della cliente:
   * qui non c'è `@Roles` fisso, perché quale ruolo lo può fare lo decide la tabella dei permessi —
   * è il motivo per cui Simone l'ha chiesta lì.
   *
   * ⚠️ POST e non PATCH: non modifica un campo, **registra una decisione** — con la nota
   * obbligatoria che la spiega, l'autore e l'ora. Chiede sempre corpo e nota, anche per confermare
   * la stessa decisione di prima: una valutazione clinica ripetuta è una valutazione nuova.
   */
  @HttpCode(200)
  @Post(':id/idoneita')
  decidiIdoneita(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: IdoneitaDto) {
    return this.clients.decidiIdoneita(id, user.sub, dto.esito, dto.nota, dto.visitaEntro);
  }

  /** Elimina una nota dal log: solo admin. */
  @Roles('admin')
  @HttpCode(200)
  @Delete(':id/note/:noteId')
  deleteNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('noteId') noteId: string) {
    return this.clients.deleteNote(id, noteId, user.sub);
  }

  /**
   * Invio email di reset password alla cliente. **Lo fa anche la coach**, ma solo sulle proprie
   * clienti: il controllo di appartenenza è `assertClientAccess` dentro il servizio, lo stesso che
   * decide se questa scheda si può aprire. Prima era `@Roles('admin')` e la coach si trovava
   * davanti «Solo un admin può inviare il reset password» proprio mentre era al telefono con la
   * cliente che non riusciva a entrare (richiesta di Simone dell'8/8).
   * Nessuno dello staff vede né scrive la password: parte un link, la scelta resta alla cliente.
   * Per impostarne una da comunicare a voce c'è `:id/set-password`, dietro il suo permesso.
   */
  @HttpCode(200)
  @Post(':id/reset-password')
  resetPassword(@CurrentUser() user: AuthUser, @Param('id') id: string, @Ip() ip: string) {
    return this.clients.sendPasswordReset(id, user.sub, ip);
  }

  /** Imposta una password scelta per la cliente (da comunicarle): permesso "set_client_password". */
  @RequirePage('set_client_password', 'manage')
  @HttpCode(200)
  @Post(':id/set-password')
  setPassword(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetPasswordDto) {
    return this.clients.setClientPassword(id, user.sub, dto.password);
  }

  /** Modifica anagrafica e questionario del cliente (chi ha accesso alla scheda). */
  @HttpCode(200)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clients.updateClient(id, user.sub, dto);
  }

  /** Menu del cliente (giorni + piatti + stelline del cliente) per la revisione del nutrizionista. */
  /**
   * Menu erogati. Senza `from`/`to` la finestra è quella di sempre (ultimi 56 giorni); con il
   * periodo si aprono i menu di un piano preciso — anche finito da mesi. Vedi `getMenus`.
   */
  @Get(':id/menus')
  menus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.clients.getMenus(id, user.sub, { from, to });
  }

  /**
   * ⛔ **LA STESSA DOMANDA DEL LATO CLIENTE, per chi corregge dal backoffice** (voce
   * `pesata-strana-chiedi-conferma`). Sola lettura: dice se il numero che si sta scrivendo non
   * torna con le pesate confinanti, e **non tocca niente**.
   *
   * ⚠️ Permesso in **sola visione** (`fix_measures` senza `manage`): è una domanda su numeri che
   * chi apre questa scheda vede già in tabella, e chiedere `manage` per leggere renderebbe muta la
   * schermata a chi guarda senza correggere.
   *
   * ⚠️ La `date` è obbligatoria nei fatti anche se opzionale nella firma: qui si corregge anche una
   * riga di due mesi fa, e senza il giorno la domanda si farebbe sulla coppia sbagliata. Senza,
   * vale oggi — lo stesso comportamento della rotta della cliente.
   */
  @RequirePage('fix_measures')
  @Get(':id/measurements/verifica')
  verificaMisura(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('weightKg') weightKg?: string,
    @Query('date') date?: string,
  ) {
    // ⚠️ Parametro assente o vuoto → `NaN` → 400. `Number('')` vale **0**, che è finito: senza
    // questa riga una chiamata senza peso non dava errore, rispondeva una domanda su «0 kg».
    const grezzo = String(weightKg ?? '').trim();
    const n = grezzo ? Number(grezzo.replace(',', '.')) : Number.NaN;
    return this.clients.verificaMisura(id, user.sub, n, date);
  }

  /** Correzione di una misura inserita male dal cliente: permesso dedicato "fix_measures". */
  @RequirePage('fix_measures', 'manage')
  @HttpCode(200)
  @Patch(':id/measurements/:measurementId')
  fixMeasurement(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('measurementId') measurementId: string,
    @Body() dto: FixMeasurementDto,
  ) {
    return this.clients.updateMeasurement(id, user.sub, measurementId, dto);
  }

  /** Cambio della data di inizio del piano: permesso dedicato "change_plan_start". */
  @RequirePage('change_plan_start', 'manage')
  @HttpCode(200)
  @Patch(':id/plan-start')
  planStart(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: PlanStartDto) {
    return this.clients.updatePlanStart(id, user.sub, dto.date, dto.conferma === true);
  }

  /** Rigenera i menu da oggi in poi (corregge menu vecchi sbagliati). Stesso permesso del cambio data inizio. */
  @RequirePage('change_plan_start', 'manage')
  @HttpCode(200)
  @Post(':id/regenerate-menu')
  regenerateMenu(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clients.regenerateMenu(id, user.sub);
  }

  /** Modalità viaggio/estate: in vacanza il popup misure si sospende; al rientro scatta un evento CRM/marketing. */
  /**
   * L'elenco delle sospensioni e dello storico modalità viaggio, per la scheda cliente.
   *
   * ⚠️ `@RequirePage('travel_mode','view')` dal 24/8. Prima il permesso era solo quello della
   * scheda (`assertClientAccess` dentro il servizio), e la metà «vede» dell'interruttore
   * `travel_mode` non accendeva niente: la card compariva **solo** con «Gestisce», quindi dare a
   * una coach la sola lettura delle sospensioni era impossibile. Ora «Vede» mostra la card in sola
   * lettura e «Gestisce» apre il modulo — che è quello che chiede la tabella dei permessi quando
   * mostra due caselle. `assertClientAccess` resta dov'è: dice se QUESTA cliente è sua.
   */
  @RequirePage('travel_mode', 'view')
  @Get(':id/sospensioni')
  sospensioni(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clients.sospensioni(id, user.sub);
  }

  /**
   * ⚠️ `@RequirePage('travel_mode','manage')`: questa PATCH allunga la scadenza di un piano pagato.
   * La chiave è nata insieme alla guardia che la legge — vedi il riquadro in `permissions/pages.ts`.
   */
  @RequirePage('travel_mode', 'manage')
  @Patch(':id/travel')
  setTravel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TravelDto) {
    return this.clients.setTravel(id, user.sub, dto);
  }

  /**
   * ⛔ **TOGLIERE UNA SOSPENSIONE: solo staff** (Simone, 26/8: *«solo la coach, il nutrizionista e
   * admin possono cancellare le sospensioni»*).
   *
   * ⛔ **NIENTE `@Roles` DI METODO, ed è una correzione della revisione del 26/8.** La prima
   * stesura ne metteva uno che escludeva `sales`, con la motivazione «è clinica e contabile, non
   * commerciale». ⚠️ Due cose sbagliate in una riga: `sales` in questo progetto è la **Responsabile
   * Coach** (`common/roles.ts`), non un commerciale — ed è già fra i ruoli che **approvano le
   * richieste di pausa**, cioè che le sospensioni le creano; e soprattutto quel confine **non
   * esisteva**, perché la `PATCH :id/travel` qui accanto toglie la stessa sospensione svuotando le
   * date, e non ha nessun `@Roles` di metodo. Un divieto che si aggira dal pulsante di fianco non è
   * un divieto: è una frase.
   *
   * ✅ Chi può togliere una sospensione lo decide **`travel_mode: manage`** nella tabella dei
   * permessi, che è il posto dove Simone lo cambia senza un rilascio — ed è già il guardiano della
   * porta gemella. Quello che questa consegna chiude davvero è l'unica porta che non era guardata
   * da niente: quella della **cliente**.
   */
  @RequirePage('travel_mode', 'manage')
  @HttpCode(200)
  @Delete(':id/sospensioni/:eventId')
  togliSospensione(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
  ) {
    return this.clients.togliSospensione(id, eventId, user.sub);
  }

  /** Eliminazione definitiva del cliente/lead e di tutto il collegato: SOLO admin. */
  @Roles('admin')
  @HttpCode(200)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clients.hardDelete(id, user.sub);
  }
}
