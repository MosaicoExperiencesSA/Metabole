import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { NutritionistService } from './nutritionist.service';

/** API dell'app Nutrizionista (pazienti, dashboard). RBAC: nutrizionista + capo + admin. */
@Controller('nutritionist')
@Roles('nutritionist', 'head_nutritionist', 'admin')
export class NutritionistController {
  constructor(private readonly nutritionist: NutritionistService) {}

  @Get('patients')
  patients(@CurrentUser() user: AuthUser) {
    return this.nutritionist.patients(user);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.nutritionist.dashboard(user);
  }
}
