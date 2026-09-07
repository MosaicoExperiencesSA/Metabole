import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsArray,
  IsBase64,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePage } from '../common/decorators/require-page.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ClinicalNotesService } from './clinical-notes.service';
import { DocumentsService } from './documents.service';
import { VisitsService } from './visits.service';

class CreateVisitDto {
  @IsUUID()
  clientId!: string;

  @IsIn(['in_person', 'televisit'])
  type!: 'in_person' | 'televisit';

  @IsDateString()
  datetime!: string;
}

class CompleteVisitDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  confirmObjective?: boolean;
}

class UploadDocumentDto {
  // Il file lo sceglie la cliente dal telefono: i formati fuori lista sono la norma, non
  // l'eccezione. Il messaggio deve dire QUALI vanno bene, non elencare i mime-type.
  @IsIn(['blood_test', 'photo', 'other'], { message: 'Indica di che tipo è il documento.' })
  type!: string;

  @IsString({ message: 'Nome del file mancante.' })
  @MinLength(1, { message: 'Nome del file mancante.' })
  @MaxLength(200, { message: 'Nome del file troppo lungo: rinominalo più corto e riprova.' })
  fileName!: string;

  @IsIn(['application/pdf', 'image/jpeg', 'image/png', 'image/heic'], {
    message: 'Puoi caricare un PDF o una foto (JPG, PNG, HEIC). Se hai un altro formato, fanne uno scatto.',
  })
  mimeType!: string;

  @IsBase64({}, { message: 'Non siamo riusciti a leggere il file: riprova a caricarlo.' })
  contentBase64!: string;
}

class ReviewDocumentDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  flags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}

class CreateNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  text!: string;
}

/** Lato cliente. */
@Controller('me')
@Roles('client')
export class MyHealthController {
  constructor(
    private readonly visits: VisitsService,
    private readonly documents: DocumentsService,
  ) {}

  @Get('visits')
  visitsList(@CurrentUser() user: AuthUser) {
    return this.visits.listForClient(user.sub);
  }

  @Post('documents')
  upload(@CurrentUser() user: AuthUser, @Body() dto: UploadDocumentDto) {
    return this.documents.upload(user.sub, dto);
  }

  @Get('documents')
  myDocuments(@CurrentUser() user: AuthUser) {
    return this.documents.listForClient(user.sub);
  }
}

/** Download decifrato: cliente (propri) o staff sanitario (pazienti). */
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get(':id/content')
  download(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.documents.download(user, id);
  }
}

/** Lato nutrizionista / capo. */
@Controller()
@Roles('nutritionist', 'head_nutritionist')
export class NutritionistController {
  constructor(
    private readonly visits: VisitsService,
    private readonly documents: DocumentsService,
    private readonly notes: ClinicalNotesService,
  ) {}

  @Get('agenda')
  agenda(@CurrentUser() user: AuthUser) {
    return this.visits.agenda(user);
  }

  @Post('visits')
  createVisit(@CurrentUser() user: AuthUser, @Body() dto: CreateVisitDto) {
    return this.visits.create(user, dto);
  }

  @HttpCode(200)
  @Post('visits/:id/start')
  startVisit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.visits.start(user, id);
  }

  @HttpCode(200)
  @Post('visits/:id/complete')
  completeVisit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CompleteVisitDto,
  ) {
    return this.visits.complete(user, id, dto);
  }

  /**
   * ⛔ **LA CASELLA `health_documents` ADESSO DECIDE — e la guardia sta sui METODI, non sulla
   * classe** (7/9).
   *
   * ⚠️ Questo controller non serve solo i documenti: dentro ci sono anche l'agenda e le visite, che
   * hanno chiavi loro. Una `@RequirePage('health_documents')` sulla classe le chiuderebbe tutte
   * dietro una chiave che non le riguarda — e nessuno capirebbe perché l'agenda è sparita.
   *
   * ⛔ **E NON va su `GET documents/:id/content`**, che sta nell'altro controller qui sopra: quella
   * rotta la usa anche la **cliente** per scaricare i propri referti, e il ruolo `client` non ha
   * righe in matrice. Agganciarla lì vorrebbe dire un 403 nell'app, su un documento suo. Il cancello
   * di quella rotta è `assertDocumentAccess`, che sa distinguere «è il mio» da «è di una paziente».
   *
   * ⚠️ Costo zero: `nutritionist` e `head_nutritionist` hanno la chiave in `{view, manage}` e sono i
   * soli due nel `@Roles`. Sono i dati più sensibili del sistema, ed è la ragione per cui questa è
   * fra le prime cinque.
   */
  @RequirePage('health_documents')
  @Get('clients/:id/documents')
  patientDocuments(@CurrentUser() user: AuthUser, @Param('id') clientId: string) {
    return this.documents.listForPatient(user, clientId);
  }

  @RequirePage('health_documents', 'manage')
  @HttpCode(200)
  @Post('documents/:id/review')
  reviewDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    return this.documents.review(user, id, dto);
  }

  @RequirePage('health_documents')
  @Get('clients/:id/notes')
  notesList(@CurrentUser() user: AuthUser, @Param('id') clientId: string) {
    return this.notes.list(user, clientId);
  }

  // ⚠️ Scrivere una nota clinica è `manage`: è un dato sanitario che entra nella cartella.
  @RequirePage('health_documents', 'manage')
  @Post('clients/:id/notes')
  createNote(
    @CurrentUser() user: AuthUser,
    @Param('id') clientId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notes.create(user, clientId, dto.text);
  }
}
