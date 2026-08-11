import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { NutritionistService } from './nutritionist.service';

class ReviewDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/**
 * L'azione scelta nella finestra di «Correggi». Quali valori siano ammessi dipende dalla **causa**
 * della decisione, e a controllarlo è il servizio (`azioneAmmessa`): qui si valida solo la forma,
 * così la regola clinica resta scritta in un posto solo invece di essere copiata in un decoratore
 * che nessuno aggiornerà quando la tabella cambia.
 */
class AzioneDecisioneDto {
  @IsString({ message: 'Indica l’azione da eseguire.' })
  @MaxLength(40, { message: 'Azione non valida.' })
  azione!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'La nota non può superare i 1000 caratteri.' })
  note?: string;
}

/** Nota facoltativa allo sblocco del piano. */
class SbloccoDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'La nota non può superare i 1000 caratteri.' })
  note?: string;
}

/** API dell'app Nutrizionista (pazienti, dashboard, coda di validazione). RBAC: nutrizionista + capo + admin. */
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

  /**
   * Segnalazioni aperte sui suoi pazienti, CON IL MOTIVO. Prima l'unico endpoint era
   * `GET /admin/escalations`, che restituiva le segnalazioni di TUTTE le clienti a chiunque
   * avesse il ruolo — anche a una nutrizionista con tre pazienti.
   */
  @Get('escalations')
  segnalazioni(@CurrentUser() user: AuthUser) {
    return this.nutritionist.segnalazioni(user);
  }

  /**
   * Sblocca il piano: chiude la segnalazione e RIPROVA davvero a costruire la base sicura.
   * Chiudere la segnalazione e basta è cosmetico — il blocco si ricalcola a ogni menu.
   */
  @HttpCode(200)
  @Post('escalations/:id/sblocca')
  sblocca(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.nutritionist.sbloccaPiano(user, id);
  }

  /** Coda di validazione: decisioni motore (per-paziente), diete in revisione, protocolli in attesa. */
  @Get('validation-queue')
  validationQueue(@CurrentUser() user: AuthUser) {
    return this.nutritionist.validationQueue(user);
  }

  /** Conferma una decisione del motore (solo pazienti assegnati; capo/admin qualsiasi). */
  @HttpCode(200)
  @Post('decisions/:id/confirm')
  confirm(@Param('id') id: string, @Body() dto: ReviewDecisionDto, @CurrentUser() user: AuthUser) {
    return this.nutritionist.reviewDecision(user, id, 'confirmed', dto.note);
  }

  /** Corregge una decisione del motore (solo pazienti assegnati; capo/admin qualsiasi). */
  @HttpCode(200)
  @Post('decisions/:id/correct')
  correct(@Param('id') id: string, @Body() dto: ReviewDecisionDto, @CurrentUser() user: AuthUser) {
    return this.nutritionist.reviewDecision(user, id, 'corrected', dto.note);
  }

  /** Le azioni ammesse per la causa di questa decisione: è ciò che riempie la finestra di «Correggi». */
  @Get('decisions/:id/azioni')
  azioni(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.nutritionist.azioniDecisione(user, id);
  }

  /** Esegue l'azione scelta (autorizza a proseguire / blocca il piano) e chiude la riga in coda. */
  @HttpCode(200)
  @Post('decisions/:id/azione')
  azione(@Param('id') id: string, @Body() dto: AzioneDecisioneDto, @CurrentUser() user: AuthUser) {
    return this.nutritionist.eseguiAzione(user, id, dto.azione, dto.note);
  }

  /**
   * Riattiva un piano fermato. Solo chi l'ha fermato, il capo o l'admin: il controllo sta nel
   * servizio, perché questa rotta è aperta a tutti e tre i ruoli e la differenza la fa **chi** ha
   * messo il blocco, non che ruolo ha.
   */
  @HttpCode(200)
  @Post('clients/:clientId/plan-hold/release')
  riattivaPianoFermato(@Param('clientId') clientId: string, @Body() dto: SbloccoDto, @CurrentUser() user: AuthUser) {
    return this.nutritionist.riattivaPianoFermato(user, clientId, dto.note);
  }
}
