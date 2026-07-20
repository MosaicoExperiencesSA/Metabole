import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Post,
  Query,
} from '@nestjs/common';
import { IsEmail, MaxLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
} from './dto/password-reset.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

class RequestEmailChangeDto {
  @IsEmail()
  @MaxLength(160)
  newEmail!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // anti-abuso registrazioni
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.auth.register(dto, ip);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // anti brute-force
  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto.email, dto.password, ip);
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Ip() ip: string) {
    return this.auth.refresh(dto.refreshToken, ip);
  }

  @HttpCode(204)
  @Post('logout')
  async logout(
    @Body() dto: RefreshDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    await this.auth.logout(dto.refreshToken, user, ip);
  }

  @Public()
  @HttpCode(200)
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  /** Variante GET per il link nell'email. */
  @Public()
  @Get('verify-email')
  verifyEmailByLink(@Query('token') token: string) {
    return this.auth.verifyEmail(token ?? '');
  }

  // ---------- Cambio email (autenticato) ----------

  /** Chiede il cambio email: invia il link di verifica alla nuova email. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(202)
  @Post('email-change/request')
  async requestEmailChange(@CurrentUser() user: AuthUser, @Body() dto: RequestEmailChangeDto) {
    await this.auth.requestEmailChange(user.sub, dto.newEmail);
    return { message: 'Ti abbiamo inviato un link di conferma alla nuova email.' };
  }

  /** Conferma dal link (pubblico: il token fa da autenticazione). */
  @Public()
  @HttpCode(200)
  @Post('email-change/confirm')
  confirmEmailChange(@Body() dto: VerifyEmailDto) {
    return this.auth.confirmEmailChange(dto.token);
  }

  /** Rende principale l'email secondaria (scambio). */
  @HttpCode(200)
  @Post('email/primary')
  makePrimary(@CurrentUser() user: AuthUser) {
    return this.auth.makeSecondaryPrimary(user.sub);
  }

  /** Rimuove l'email secondaria. */
  @Delete('email/secondary')
  removeSecondary(@CurrentUser() user: AuthUser) {
    return this.auth.removeSecondaryEmail(user.sub);
  }

  /** "Passa all'altro profilo": token per l'utenza collegata (cliente <-> staff), senza logout. */
  @Post('switch')
  switchAccount(@CurrentUser() user: AuthUser, @Ip() ip: string) {
    return this.auth.switchAccount(user.sub, ip);
  }

  /** Token a lunga scadenza per il widget da home screen (app → storage condiviso → widget). */
  @Post('widget-token')
  widgetToken(@CurrentUser() user: AuthUser) {
    return this.auth.issueWidgetToken(user);
  }

  @Public()
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 900_000 } }) // anti-abuso reset
  @Post('password-reset')
  async requestReset(@Body() dto: PasswordResetRequestDto, @Ip() ip: string) {
    await this.auth.requestPasswordReset(dto.email, ip);
    return { message: 'Se l’email esiste, riceverai le istruzioni per il reset.' };
  }

  @Public()
  @HttpCode(200)
  @Post('password-reset/confirm')
  async confirmReset(@Body() dto: PasswordResetConfirmDto, @Ip() ip: string) {
    await this.auth.confirmPasswordReset(dto.token, dto.newPassword, ip);
    return { message: 'Password aggiornata: effettua di nuovo il login.' };
  }
}
