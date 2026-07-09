import { Body, Controller, Get, Ip, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@Roles('client')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('questions')
  questions() {
    return this.onboarding.getQuestions();
  }

  @Post('answers')
  submit(
    @Body() dto: SubmitAnswersDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.onboarding.submitAnswers(user.sub, dto, ip);
  }

  @Get('result')
  result(@CurrentUser() user: AuthUser) {
    return this.onboarding.getResult(user.sub);
  }
}
