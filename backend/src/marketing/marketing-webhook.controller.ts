import { Body, Controller, HttpCode, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { MarketingService } from './marketing.service';

/** Webhook Brevo (pubblico, protetto da token in query): eventi di disiscrizione/bounce → opt-out. */
@SkipThrottle()
@Controller('marketing/webhook')
export class MarketingWebhookController {
  constructor(private readonly service: MarketingService) {}

  @Public()
  @HttpCode(200)
  @Post('brevo')
  brevo(@Query('token') token: string, @Body() body: unknown) {
    return this.service.handleBrevoWebhook(token, body);
  }
}
