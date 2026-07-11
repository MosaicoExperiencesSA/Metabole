import { Global, Module } from '@nestjs/common';
import { PdfTemplatesController } from './pdf.controller';
import { PdfService } from './pdf.service';

@Global()
@Module({
  controllers: [PdfTemplatesController],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
