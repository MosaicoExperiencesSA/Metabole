import { Transform, Type } from 'class-transformer';
// I valori ammessi vengono dalla tabella unica delle finestre: vedi `menu/finestre-digiuno.ts`.
import { VALORI_FINESTRA_DIGIUNO } from '../../menu/finestre-digiuno';
import { numeroOpzionale, numeroOpzionaleConZero } from '../../common/validazione';
import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

class LifestyleDto {
  @IsOptional()
  @IsIn(['sedentary', 'standing', 'shifts', 'travel'], { message: 'Scelta non valida per il tipo di lavoro.' })
  work?: string;

  @IsOptional()
  @IsIn(['very_little', 'some', 'love_cooking'], { message: 'Scelta non valida per il tempo in cucina.' })
  cookingTime?: string;

  @IsOptional()
  @IsIn(['home', 'canteen', 'out', 'on_the_go'], { message: 'Scelta non valida per il pranzo infrasettimanale.' })
  weekdayLunch?: string;

  // Schermo 6 del prototipo: "Perché vuoi iniziare adesso?" (motivazione).
  @IsOptional()
  @IsIn(['wellbeing', 'clothes', 'health', 'event'], { message: 'Scelta non valida per la motivazione.' })
  motivation?: string;
}

class HealthDto {
  @IsIn(['no', 'yes', 'tell_in_visit'], { message: 'Rispondi sulle condizioni di salute.' })
  hasConditions!: string;

  @IsIn(['no', 'yes', 'tell_in_visit'], { message: 'Rispondi sui farmaci che assumi.' })
  takesMedications!: string;
}

class ObjectiveInputDto {
  // Obbligatori: qui lo zero è un errore da segnalare, non una casella lasciata in bianco.
  @IsNumber({}, { message: 'Indica quanti chili vuoi perdere (es. 6).' })
  @Min(1, { message: 'L\'obiettivo minimo è 1 kg.' })
  @Max(40, { message: 'Sopra i 40 kg il percorso va impostato con la nutrizionista: parlane con lei.' })
  weightToLoseKg!: number;

  @IsInt({ message: 'Indica in quante settimane, con un numero intero (es. 18).' })
  @Min(3, { message: 'Servono almeno 3 settimane: sotto non è un percorso, è una dieta lampo.' })
  @Max(52, { message: 'Al massimo 52 settimane. Se serve più tempo lo si allunga strada facendo.' })
  weeks!: number;

  // Facoltativi, e qui lo ZERO è legittimo: vuol dire «quella misura non me la pongo».
  @IsOptional()
  @Transform(numeroOpzionaleConZero)
  @IsNumber({}, { message: 'I centimetri di girovita devono essere un numero (es. 6).' })
  @Min(0, { message: 'I centimetri di girovita non possono essere negativi.' })
  @Max(40, { message: 'Più di 40 cm di girovita è un obiettivo da rivedere insieme alla nutrizionista.' })
  waistToLoseCm?: number;

  @IsOptional()
  @Transform(numeroOpzionaleConZero)
  @IsNumber({}, { message: 'I centimetri di fianchi devono essere un numero (es. 6).' })
  @Min(0, { message: 'I centimetri di fianchi non possono essere negativi.' })
  @Max(40, { message: 'Più di 40 cm di fianchi è un obiettivo da rivedere insieme alla nutrizionista.' })
  hipsToLoseCm?: number;
}

export class SubmitAnswersDto {
  @IsString({ message: 'Scrivi il tuo nome.' })
  @MinLength(1, { message: 'Scrivi il tuo nome.' })
  @MaxLength(80, { message: 'Nome troppo lungo (massimo 80 caratteri).' })
  name!: string;

  @IsInt({ message: 'L\'età va indicata con un numero intero (es. 42).' })
  @Min(18, { message: 'Il percorso è per maggiorenni.' })
  @Max(100, { message: 'Controlla l\'età inserita.' })
  age!: number;

  @IsIn(['female', 'male', 'unspecified'], { message: 'Scelta non valida.' })
  sex!: 'female' | 'male' | 'unspecified';

  @IsInt({ message: 'L\'altezza va indicata in centimetri, con un numero intero (es. 165).' })
  @Min(120, { message: 'L\'altezza sembra troppo bassa: controlla il valore in cm.' })
  @Max(230, { message: 'L\'altezza sembra troppo alta: controlla il valore in cm.' })
  heightCm!: number;

  @IsNumber({}, { message: 'Il peso deve essere un numero (es. 72,4).' })
  @Min(35, { message: 'Il peso sembra troppo basso: controlla il valore in kg.' })
  @Max(250, { message: 'Il peso sembra troppo alto: controlla il valore in kg.' })
  startWeightKg!: number;

  // Facoltative: chi non si è mai misurata le lascia in bianco. Senza il Transform la casella
  // vuota arrivava come 0 e bloccava la REGISTRAZIONE con «startWaistCm must not be less than
  // 40» — lo stesso difetto segnalato il 7/8 sulle misure, ma nel punto peggiore possibile.
  @IsOptional()
  @Transform(numeroOpzionale)
  @IsNumber({}, { message: 'Il girovita deve essere un numero in centimetri (es. 82).' })
  @Min(40, { message: 'Il girovita sembra troppo piccolo: controlla il valore in cm, o lascia il campo vuoto.' })
  @Max(200, { message: 'Il girovita sembra troppo grande: controlla il valore in cm.' })
  startWaistCm?: number;

  @IsOptional()
  @Transform(numeroOpzionale)
  @IsNumber({}, { message: 'I fianchi devono essere un numero in centimetri (es. 98).' })
  @Min(40, { message: 'I fianchi sembrano troppo piccoli: controlla il valore in cm, o lascia il campo vuoto.' })
  @Max(200, { message: 'I fianchi sembrano troppo grandi: controlla il valore in cm.' })
  startHipsCm?: number;

  @IsString({ message: 'Scegli il tuo regime alimentare.' }) @MaxLength(40, { message: 'Regime non valido.' })
  regime!: string;

  /**
   * ⚠️ NON PIÙ OBBLIGATORIO (§16.10, 12/8). Lo stile è una **proprietà del prodotto**, non una
   * domanda: la cliente sceglie «Mediterranea senza glutine», e lo stile lo sa il catalogo. Il DTO
   * lo pretendeva ancora, ed era l'ultimo punto in cui lo stile sopravviveva come cosa che l'app
   * deve conoscere.
   *
   * Resta accettato, e non è retrocompatibilità di cortesia: le app **già installate** mandano solo
   * questo campo e devono continuare a funzionare. Il controllo «almeno uno dei due» sta nel
   * servizio, dove si può dire alla cliente cosa fare invece di elencarle un campo mancante.
   */
  @IsOptional() @IsString({ message: 'Scegli il percorso che preferisci.' }) @MaxLength(40, { message: 'Percorso non valido.' })
  dietStyle?: string;

  /**
   * FAMIGLIA scelta (`Diet.name`): è IL prodotto. Se arriva senza `dietStyle`, lo stile si legge
   * dal catalogo (`stileDellaFamiglia`) — non si smette di scriverlo, si smette di chiederlo.
   */
  @IsOptional() @IsString({ message: 'Percorso non riconosciuto.' }) @MaxLength(120, { message: 'Percorso non riconosciuto.' })
  dietFamily?: string;

  @IsOptional()
  @IsArray({ message: 'Elenco allergie non valido.' })
  @IsString({ each: true, message: 'Elenco allergie non valido.' })
  allergies?: string[];

  /** Allergie fuori dai 14 codici UE: testo libero → forza revisione del nutrizionista. */
  @IsOptional()
  @IsArray({ message: 'Elenco allergie non valido.' })
  @IsString({ each: true, message: 'Elenco allergie non valido.' })
  allergiesOther?: string[];

  @IsOptional()
  @IsArray({ message: 'Elenco intolleranze non valido.' })
  @IsString({ each: true, message: 'Elenco intolleranze non valido.' })
  intolerances?: string[];

  /**
   * Intolleranze scritte a mano. ⚠️ Non esisteva: l'opzione «Altro» del questionario non aveva
   * nessun campo dove dire COSA, quindi chi la sceglieva si portava in banca dati la stringa
   * `'other'` — che non è un alimento e non esclude niente.
   */
  @IsOptional()
  @IsArray({ message: 'Elenco intolleranze non valido.' })
  @IsString({ each: true, message: 'Elenco intolleranze non valido.' })
  intolerancesOther?: string[];

  @IsOptional()
  @IsArray({ message: 'Elenco dei cibi non graditi non valido.' })
  @IsString({ each: true, message: 'Elenco dei cibi non graditi non valido.' })
  dislikedFoods?: string[];

  @IsOptional()
  @ValidateNested({ message: 'Abitudini non valide.' })
  @Type(() => LifestyleDto)
  lifestyle?: LifestyleDto;

  @IsIn([3, 4, 5], { message: 'I pasti al giorno possono essere 3, 4 o 5.' })
  mealsPerDay!: number;

  @IsIn(['classic3', 'five', 'supplements', 'intermittent_fasting'], { message: 'Scegli il tipo di percorso.' })
  pathType!: string;

  @IsOptional()
  @IsIn(VALORI_FINESTRA_DIGIUNO, { message: 'Finestra del digiuno non valida.' })
  fastingWindow?: string;

  @IsOptional()
  @IsIn(['sedentary', 'light', 'moderate', 'active', 'very_active'], { message: 'Livello di attività non valido.' })
  activityLevel?: string;

  @ValidateNested({ message: 'Rispondi alle domande sulla salute.' })
  @Type(() => HealthDto)
  health!: HealthDto;

  @ValidateNested({ message: 'Completa il tuo obiettivo.' })
  @Type(() => ObjectiveInputDto)
  objective!: ObjectiveInputDto;

  @IsIn(['daily', 'when_needed', 'on_request'], { message: 'Scegli come vuoi essere seguita dalla coach.' })
  coachStyle!: string;

  @IsIn(['follows', 'needs_push', 'perseveres', 'quits'], { message: 'Scegli l\'opzione che ti somiglia di più.' })
  character!: string;

  @IsOptional()
  @IsString({ message: 'Colore non valido.' })
  @MaxLength(9, { message: 'Colore non valido.' })
  themeColor?: string;

  @IsOptional()
  @IsObject({ message: 'Consensi non validi.' })
  consents?: Record<string, unknown>;

  /** Accettazione esplicita del trattamento dei dati sanitari (GDPR art. 9). */
  @IsBoolean({ message: 'Per creare il percorso serve il consenso al trattamento dei dati sanitari.' })
  healthDataConsent!: boolean;
}
