import { Transform, Type } from 'class-transformer';
import { numeroOpzionale, numeroOpzionaleConZero } from '../../common/validazione';
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

class LifestylePatchDto {
  @IsOptional()
  @IsIn(['sedentary', 'standing', 'shifts', 'travel'], { message: 'Scelta non valida per il tipo di lavoro.' })
  work?: string;

  @IsOptional()
  @IsIn(['very_little', 'some', 'love_cooking'], { message: 'Scelta non valida per il tempo in cucina.' })
  cookingTime?: string;

  @IsOptional()
  @IsIn(['home', 'canteen', 'out', 'on_the_go'], { message: 'Scelta non valida per il pranzo infrasettimanale.' })
  weekdayLunch?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'Il nome non è valido.' })
  @MinLength(1, { message: 'Scrivi il tuo nome.' })
  @MaxLength(80, { message: 'Nome troppo lungo (massimo 80 caratteri).' })
  name?: string;

  /** Lingua dell'utente (i18n): notifiche ed email arrivano in questa lingua. */
  @IsOptional()
  @IsIn(['it', 'en'], { message: 'Lingua non disponibile.' })
  locale?: string;

  @IsOptional()
  @Transform(numeroOpzionale)
  @IsInt({ message: 'L\'età va indicata con un numero intero (es. 42).' })
  @Min(18, { message: 'Il percorso è per maggiorenni: sotto i 18 anni serve un altro tipo di seguito.' })
  @Max(100, { message: 'Controlla l\'età inserita.' })
  age?: number;

  @IsOptional()
  @Transform(numeroOpzionale)
  @IsInt({ message: 'L\'altezza va indicata in centimetri, con un numero intero (es. 165).' })
  @Min(120, { message: 'L\'altezza sembra troppo bassa: controlla il valore in cm.' })
  @Max(230, { message: 'L\'altezza sembra troppo alta: controlla il valore in cm.' })
  heightCm?: number;

  @IsOptional()
  @IsString({ message: 'Regime non valido.' }) @MaxLength(40, { message: 'Regime non valido.' })
  regime?: string;

  @IsOptional()
  @IsString({ message: 'Stile alimentare non valido.' }) @MaxLength(40, { message: 'Stile alimentare non valido.' })
  dietStyle?: string;

  /** Famiglia (`Diet.name`): con lo stile identifica il prodotto scelto. */
  @IsOptional() @IsString({ message: 'Percorso non riconosciuto.' }) @MaxLength(120, { message: 'Percorso non riconosciuto.' })
  dietFamily?: string;

  @IsOptional()
  @IsIn([3, 4, 5], { message: 'I pasti al giorno possono essere 3, 4 o 5.' })
  mealsPerDay?: number;

  @IsOptional()
  @IsIn(['classic3', 'five', 'supplements', 'intermittent_fasting'], { message: 'Tipo di percorso non valido.' })
  pathType?: string;

  @IsOptional()
  @IsIn(['skip_breakfast', 'skip_breakfast_lunch', 'skip_dinner_breakfast'], { message: 'Finestra del digiuno non valida.' })
  fastingWindow?: string;

  @IsOptional()
  @IsIn(['daily', 'when_needed', 'on_request'], { message: 'Scelta non valida per il tipo di seguito della coach.' })
  coachStyle?: string;

  @IsOptional()
  @IsIn(['follows', 'needs_push', 'perseveres', 'quits'], { message: 'Scelta non valida.' })
  character?: string;

  @IsOptional()
  @IsArray({ message: 'Intolleranze non valide.' })
  @IsString({ each: true, message: 'Intolleranze non valide.' })
  intolerances?: string[];

  @IsOptional()
  @IsArray({ message: 'Elenco dei cibi non graditi non valido.' })
  @IsString({ each: true, message: 'Elenco dei cibi non graditi non valido.' })
  dislikedFoods?: string[];

  /** La cliente preferisce ricette semplici (cucina italiana) quando disponibili. */
  @IsOptional()
  @IsBoolean({ message: 'Valore non valido.' })
  prefersSimpleRecipes?: boolean;

  /** Livello di attività fisica (domanda dedicata): guida il calcolo del fabbisogno calorico. */
  @IsOptional()
  @IsIn(['sedentary', 'light', 'moderate', 'active', 'very_active'], { message: 'Livello di attività non valido.' })
  activityLevel?: string;

  @IsOptional()
  @ValidateNested({ message: 'Abitudini non valide.' })
  @Type(() => LifestylePatchDto)
  lifestyle?: LifestylePatchDto;

  @IsOptional()
  @IsDateString({}, { message: 'Data di inizio non valida: scegline una dal calendario.' })
  planStartDate?: string;

  @IsOptional()
  @IsObject({ message: 'Consensi non validi.' })
  consents?: Record<string, unknown>;
}

export class UpdateThemeDto {
  @IsString({ message: 'Colore non valido.' })
  @MinLength(4, { message: 'Colore non valido.' })
  @MaxLength(9, { message: 'Colore non valido.' })
  color!: string;
}

/**
 * Modifica dell'obiettivo dall'app: sono tutti campi che la cliente **digita**, e tutti
 * facoltativi — cambia quello che vuole e lascia in bianco il resto.
 *
 * Il `@Transform` c'è per la stessa ragione del DTO delle misure: una casella svuotata arriva
 * come `0` e senza di lui il salvataggio falliva con «weightToLoseKg must not be less than 1».
 */
export class UpdateObjectiveDto {
  @IsOptional()
  @Transform(numeroOpzionale)
  @Min(1, { message: 'L\'obiettivo minimo è 1 kg.' })
  @Max(30, { message: 'Sopra i 30 kg l\'obiettivo va rivisto insieme alla nutrizionista.' })
  weightToLoseKg?: number;

  @IsOptional()
  @Transform(numeroOpzionale)
  @IsInt({ message: 'Le settimane vanno indicate con un numero intero (es. 18).' })
  @Min(3, { message: 'Servono almeno 3 settimane.' })
  @Max(52, { message: 'Al massimo 52 settimane. Se serve più tempo lo si allunga strada facendo.' })
  weeks?: number;

  // Qui lo ZERO è legittimo: vuol dire «il girovita non me lo pongo come obiettivo».
  @IsOptional()
  @Transform(numeroOpzionaleConZero)
  @Min(0, { message: 'I centimetri di girovita non possono essere negativi.' })
  @Max(40, { message: 'Più di 40 cm di girovita è un obiettivo da rivedere insieme alla nutrizionista.' })
  waistToLoseCm?: number;
}
