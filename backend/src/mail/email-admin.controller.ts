import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { EmailTemplatesService } from './email-templates.service';
import { RequirePage } from '../common/decorators/require-page.decorator';

class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  bodyHtml?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class CreateTemplateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  key!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(300)
  subject!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(20000)
  bodyHtml!: string;
}

/** Modelli email e log invii (admin). */
@Controller('admin/email')
@Roles('admin')
export class EmailAdminController {
  constructor(private readonly emails: EmailTemplatesService) {}

  /**
   * ⛔ **Guardia per METODO e non di classe**: qui dentro convivono due chiavi diverse, e una
   * guardia sulla classe le confonderebbe in una sola — che è il difetto che stiamo chiudendo,
   * rifatto un piano più sopra.
   */
  @RequirePage('email_templates')
  @Get('templates')
  templates() {
    return this.emails.list();
  }

  /** Crea un modello che non esiste ancora (prima si poteva solo aggiornare quelli del seed). */
  @RequirePage('email_templates')
  @Post('templates')
  create(@Body() dto: CreateTemplateDto, @CurrentUser() user: AuthUser) {
    return this.emails.create(dto, user.sub);
  }

  @RequirePage('email_templates')
  @Patch('templates/:key')
  update(@Param('key') key: string, @Body() dto: UpdateTemplateDto, @CurrentUser() user: AuthUser) {
    return this.emails.update(key, dto, user.sub);
  }

  @RequirePage('email_log')
  @Get('log')
  log() {
    return this.emails.logs();
  }

  @RequirePage('email_log')
  @Get('log/:id')
  logDetail(@Param('id') id: string) {
    return this.emails.logDetail(id);
  }
}
