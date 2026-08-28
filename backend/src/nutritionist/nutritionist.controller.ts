import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
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

  /**
   * ⚠️ **Il numero di «Alza le calorie»**: la percentuale in più sul totale. Il limite superiore è
   * quello del §15.5 (`ValoriKcalDto`) e per la stessa ragione — oltre il +50% non è una
   * correzione, è un obiettivo da rivedere. Il minimo è **maggiore di zero** e lo controlla il
   * servizio con un messaggio suo: qui `0` è un valore scritto per sbaglio, e dirlo con «deve essere
   * almeno 1» sarebbe più oscuro di «serve di quanto».
   */
  @IsOptional()
  @IsNumber({}, { message: 'La percentuale va scritta come numero (es. 10).' })
  @Min(-50, { message: 'Oltre il −50% non è una correzione: se serve tagliare così, si scrive il deficit.' })
  @Max(50, { message: 'Oltre il +50% non è una correzione: se serve dare così tanto, si rivede l’obiettivo.' })
  correzionePct?: number;

  /** Per quanti giorni vale l'aumento. Assente = finché non lo tolgono. Stessi limiti del §15.5. */
  @IsOptional()
  @IsInt({ message: 'I giorni vanno scritti come numero intero.' })
  @Min(1, { message: 'La durata parte da un giorno.' })
  @Max(90, { message: 'Oltre i 90 giorni non è una correzione a termine: usa il deficit.' })
  perGiorni?: number;

  /** Conferma esplicita se il target finisse sotto la soglia minima di sicurezza. */
  @IsOptional()
  @IsBoolean()
  confermaSottoSoglia?: boolean;
}

/**
 * I due valori del §15.5. I limiti qui NON sono le soglie cliniche — quelle stanno in
 * `correzione-kcal.ts` e il nutrizionista le può scavalcare di proposito. Questi sono i limiti oltre
 * i quali il numero **non vuol dire niente**: un deficit di 4000 kcal o una correzione del −300%
 * sono uno zero di troppo, non una prescrizione.
 */
class ValoriKcalDto {
  @IsOptional()
  @IsInt({ message: 'Il deficit va scritto in kcal intere.' })
  @Min(0, { message: 'Il deficit non può essere negativo: per dare di più si usa la correzione percentuale.' })
  @Max(2000, { message: 'Un deficit oltre le 2000 kcal/giorno non è una prescrizione, è un errore di battitura.' })
  deficitKcal?: number | null;

  @IsOptional()
  @IsNumber({}, { message: 'La correzione va scritta in percentuale.' })
  @Min(-50, { message: 'Oltre il −50% non è una correzione: se serve tagliare così, si scrive il deficit.' })
  @Max(50, { message: 'Oltre il +50% non è una correzione: se serve dare così tanto, si rivede l’obiettivo.' })
  correzionePct?: number | null;
}

class SimulaKcalDto extends ValoriKcalDto {}

class ImpostaKcalDto extends ValoriKcalDto {
  /**
   * Obbligatorio, e non per burocrazia: un target calorico cambiato senza il suo perché è un numero
   * che nessuno può contestare, e in clinica quelli restano sbagliati più a lungo degli altri.
   */
  @IsString({ message: 'Scrivi il motivo della modifica.' })
  @MinLength(3, { message: 'Il motivo va scritto per esteso: fra tre mesi lo leggerà qualcuno che non c’era.' })
  @MaxLength(1000, { message: 'Il motivo non può superare i 1000 caratteri.' })
  motivo!: string;

  /**
   * PER QUANTI GIORNI vale la correzione (Nocanty, 13/8: «riduci le kcal del 10% per 7 giorni e poi
   * riprendi col normale ritmo»). Assente = vale finché non la tolgono, che è il comportamento di
   * prima. ⚠️ Il tetto a 90 non è burocrazia: oltre tre mesi non è più «una settimana di scarico»,
   * è il piano — e quello si scrive come deficit, che segue il peso quando cambia.
   */
  @IsOptional()
  @IsInt({ message: 'I giorni vanno scritti come numero intero.' })
  @Min(1, { message: 'La durata parte da un giorno.' })
  @Max(90, { message: 'Oltre i 90 giorni non è una correzione a termine: usa il deficit.' })
  perGiorni?: number;

  /**
   * Conferma esplicita per scendere sotto la soglia minima di sicurezza. Il primo invio senza
   * questo flag viene rifiutato **con dentro il numero** a cui si arriverebbe: si può andare sotto,
   * ma non per sbaglio.
   */
  @IsOptional()
  @IsBoolean()
  confermaSottoSoglia?: boolean;
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

  /**
   * Esegue l'azione scelta — autorizza a proseguire, blocca il piano, **alza le calorie** — e chiude
   * la riga in coda.
   */
  @HttpCode(200)
  @Post('decisions/:id/azione')
  azione(@Param('id') id: string, @Body() dto: AzioneDecisioneDto, @CurrentUser() user: AuthUser) {
    return this.nutritionist.eseguiAzione(user, id, dto.azione, dto.note, {
      correzionePct: dto.correzionePct,
      perGiorni: dto.perGiorni,
      confermaSottoSoglia: dto.confermaSottoSoglia,
    });
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

  // ---------- §15.5 — Le calorie scritte a mano ----------

  /** Il quadro calorico della cliente: com'è composto il numero di oggi, e chi l'ha cambiato quando. */
  @Get('clients/:clientId/kcal')
  kcal(@Param('clientId') clientId: string, @CurrentUser() user: AuthUser) {
    return this.nutritionist.kcalCliente(user, clientId);
  }

  /**
   * Cosa succederebbe con questi numeri, SENZA salvarli. È un `POST` benché non scriva niente: i
   * valori stanno nel corpo, e mandare i parametri clinici di una paziente in querystring vuol dire
   * scriverli nei log del proxy.
   */
  @HttpCode(200)
  @Post('clients/:clientId/kcal/simula')
  simulaKcal(@Param('clientId') clientId: string, @Body() dto: SimulaKcalDto, @CurrentUser() user: AuthUser) {
    return this.nutritionist.simulaKcal(user, clientId, dto.deficitKcal, dto.correzionePct);
  }

  /** Scrive le calorie a mano. Il motivo è obbligatorio: senza, lo storico non serve a niente. */
  @HttpCode(200)
  @Post('clients/:clientId/kcal')
  impostaKcal(@Param('clientId') clientId: string, @Body() dto: ImpostaKcalDto, @CurrentUser() user: AuthUser) {
    return this.nutritionist.impostaKcal(user, clientId, dto);
  }
}
