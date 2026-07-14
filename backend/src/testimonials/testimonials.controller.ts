import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateTestimonialDto, UpdateTestimonialDto } from './dto/testimonial.dto';
import { TestimonialsService } from './testimonials.service';

/** Endpoint pubblico per il sito (data-testimonials-endpoint). Nessuna autenticazione. */
@Controller('public')
export class PublicTestimonialsController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('testimonials')
  list(@Query('locale') locale?: string) {
    return this.testimonials.listPublic(locale);
  }
}

/** Gestione testimonianze dal backoffice (admin). */
@Controller('admin/testimonials')
@Roles('admin')
export class AdminTestimonialsController {
  constructor(private readonly testimonials: TestimonialsService) {}

  @Get()
  list() {
    return this.testimonials.adminList();
  }

  @Post()
  create(@Body() dto: CreateTestimonialDto, @CurrentUser() user: AuthUser) {
    return this.testimonials.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTestimonialDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.testimonials.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.testimonials.remove(user.sub, id);
  }
}
