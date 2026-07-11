import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  UpdateObjectiveDto,
  UpdateProfileDto,
  UpdateThemeDto,
} from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@Controller('me')
@Roles('client')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  /**
   * Profilo CLINICO/onboarding completo (regime, stile, coach/nutrizionista, lifestyle).
   * Path distinto da /me/profile (anagrafica, gestita da MeController) per evitare
   * la collisione di rotta: due handler sullo stesso path si oscuravano a vicenda.
   */
  @Get('client-profile')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.profile.getProfile(user.sub);
  }

  @Patch('client-profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.profile.updateProfile(user.sub, dto);
  }

  @Post('theme')
  updateTheme(@CurrentUser() user: AuthUser, @Body() dto: UpdateThemeDto) {
    return this.profile.updateTheme(user.sub, dto.color);
  }

  @Get('objective')
  getObjective(@CurrentUser() user: AuthUser) {
    return this.profile.getObjective(user.sub);
  }

  @Patch('objective')
  updateObjective(@CurrentUser() user: AuthUser, @Body() dto: UpdateObjectiveDto) {
    return this.profile.updateObjective(user.sub, dto);
  }
}
