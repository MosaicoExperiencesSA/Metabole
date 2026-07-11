import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PdfService } from './pdf.service';

class UpdatePdfTemplateDto {
  @IsString()
  @MinLength(10)
  @MaxLength(100_000)
  html!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

class PreviewPdfTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  html?: string;
}

/** Editor della grafica dei PDF inviati ai clienti (ricevute, report). Solo admin. */
@Controller('admin/pdf-templates')
@Roles('admin')
export class PdfTemplatesController {
  constructor(private readonly pdf: PdfService) {}

  @Get()
  list() {
    return this.pdf.list();
  }

  @Get(':key')
  one(@Param('key') key: string) {
    return this.pdf.getFull(key);
  }

  @Put(':key')
  update(@CurrentUser() user: AuthUser, @Param('key') key: string, @Body() dto: UpdatePdfTemplateDto) {
    return this.pdf.update(key, dto.html, dto.name, user.sub);
  }

  @HttpCode(200)
  @Post(':key/reset')
  reset(@CurrentUser() user: AuthUser, @Param('key') key: string) {
    return this.pdf.reset(key, user.sub);
  }

  /** Anteprima PDF (base64) con dati d'esempio, usando l'HTML fornito (non salvato). */
  @HttpCode(200)
  @Post(':key/preview')
  preview(@Param('key') key: string, @Body() dto: PreviewPdfTemplateDto) {
    return this.pdf.preview(key, dto.html);
  }
}
