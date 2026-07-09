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
  @IsIn(['blood_test', 'photo', 'other'])
  type!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName!: string;

  @IsIn(['application/pdf', 'image/jpeg', 'image/png', 'image/heic'])
  mimeType!: string;

  @IsBase64()
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

  @Get('clients/:id/documents')
  patientDocuments(@CurrentUser() user: AuthUser, @Param('id') clientId: string) {
    return this.documents.listForPatient(user, clientId);
  }

  @HttpCode(200)
  @Post('documents/:id/review')
  reviewDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    return this.documents.review(user, id, dto);
  }

  @Get('clients/:id/notes')
  notesList(@CurrentUser() user: AuthUser, @Param('id') clientId: string) {
    return this.notes.list(user, clientId);
  }

  @Post('clients/:id/notes')
  createNote(
    @CurrentUser() user: AuthUser,
    @Param('id') clientId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.notes.create(user, clientId, dto.text);
  }
}
