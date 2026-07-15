import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { EmailTemplatesService } from './email-templates.service';

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

/** Modelli email e log invii (admin). */
@Controller('admin/email')
@Roles('admin')
export class EmailAdminController {
  constructor(private readonly emails: EmailTemplatesService) {}

  @Get('templates')
  templates() {
    return this.emails.list();
  }

  @Patch('templates/:key')
  update(@Param('key') key: string, @Body() dto: UpdateTemplateDto, @CurrentUser() user: AuthUser) {
    return this.emails.update(key, dto, user.sub);
  }

  @Get('log')
  log() {
    return this.emails.logs();
  }

  @Get('log/:id')
  logDetail(@Param('id') id: string) {
    return this.emails.logDetail(id);
  }
}
