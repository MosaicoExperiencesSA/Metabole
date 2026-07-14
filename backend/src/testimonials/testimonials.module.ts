import { Module } from '@nestjs/common';
import {
  AdminTestimonialsController,
  PublicTestimonialsController,
} from './testimonials.controller';
import { TestimonialsService } from './testimonials.service';

@Module({
  controllers: [PublicTestimonialsController, AdminTestimonialsController],
  providers: [TestimonialsService],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
