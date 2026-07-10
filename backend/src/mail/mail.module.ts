import { Global, Module } from '@nestjs/common';
import { EmailAdminController } from './email-admin.controller';
import { EmailTemplatesService } from './email-templates.service';
import { MailService } from './mail.service';

@Global()
@Module({
  controllers: [EmailAdminController],
  providers: [MailService, EmailTemplatesService],
  exports: [MailService, EmailTemplatesService],
})
export class MailModule {}
