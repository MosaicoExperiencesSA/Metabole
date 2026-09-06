import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PdfService } from './pdf.service';
import { RequirePage } from '../common/decorators/require-page.decorator';

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
/**
 * ⛔ **La guardia agganciata il 5/9, primo passo delle 29.** Questa rotta ha il solo elenco dei
 * ruoli, e dentro c'è l'admin e basta: l'admin è superutente e la guardia lo lascia passare senza
 * leggere la matrice, mentre chi admin non è prendeva 403 già ieri. Quindi l'aggancio **non toglie
 * l'accesso a nessuno** — chiude la casella, che finora spegneva la voce di menu e non la porta.
 * ⚠️ L'elenco dei ruoli resta sotto: senza, il fail-open della guardia si rovescia e un singhiozzo
 * del database diventa 403 per tutti (`page.guard.ts`, correzione del 17/8).
 */
@Controller('admin/pdf-templates')
@Roles('admin')
@RequirePage('pdf_templates')
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
  /**
   * ⚠️ **`view` scritto a mano**: l'anteprima è un `@Post` perché manda il modello nel corpo, ma
   * legge e basta. Senza questa riga la guardia dedurrebbe `manage` dal metodo HTTP e chiederebbe
   * il permesso di scrivere per guardare.
   */
  @RequirePage('pdf_templates', 'view')
  @Post(':key/preview')
  preview(@Param('key') key: string, @Body() dto: PreviewPdfTemplateDto) {
    return this.pdf.preview(key, dto.html);
  }
}
