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

  /**
   * «Ci dici se hai allergie?» — la risposta alla scheda in home (13/8).
   *
   * ⚠️ Una volta sola: chi ha già risposto riceve un rifiuto che spiega di parlarne con la
   * nutrizionista. Non è la porta per correggere, è quella per la prima risposta.
   */
  @Post('allergie')
  dichiaraAllergie(@CurrentUser() user: AuthUser, @Body() body: { allergie?: unknown; altro?: unknown; nessuna?: unknown }) {
    return this.profile.dichiaraAllergie(user.sub, body ?? {});
  }

  /**
   * COSA NON DEVE ARRIVARLE NEL PIATTO — i due elenchi dietro i pulsanti del Profilo (13/8).
   *
   * ⚠️ Sola lettura, e deve restarlo: le allergie le corregge la nutrizionista (permesso
   * `change_allergies`), non la cliente dall'app. Qui si mostra soltanto.
   */
  @Get('esclusioni')
  esclusioni(@CurrentUser() user: AuthUser) {
    return this.profile.esclusioni(user.sub);
  }

  /** Riepilogo di sola lettura dell'alimentazione (tipo, pasti, dieta) per il Profilo. */
  @Get('nutrition')
  nutrition(@CurrentUser() user: AuthUser) {
    return this.profile.nutrition(user.sub);
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
