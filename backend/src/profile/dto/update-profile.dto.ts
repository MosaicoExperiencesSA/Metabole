import { Transform, Type } from 'class-transformer';
import { numeroOpzionale, numeroOpzionaleConZero } from '../../common/validazione';
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';

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

  /**
   * ⛔ **`fastingWindow` NON SI SCRIVE PIÙ DA QUI** (Simone, 21/8: «non ha più senso scegliere i
   * pasti, sono campi che devono proprio sparire»).
   *
   * Quali pasti riceve chi digiuna lo **deriva l'orologio** dalla durata della finestra, e la
   * finestra la imposta la cliente da `PATCH /me/digiuno`. Finché questo campo restava scrivibile,
   * due porte rispondevano alla stessa domanda: la correzione fatta da qui durava fino al primo
   * spostamento della cliente, che la riscriveva senza avvisare nessuno.
   *
   * ⚠️ La colonna **resta** e resta letta dal motore: è il dato su cui i menu si compongono. A
   * cambiare è **chi lo scrive**, e adesso è uno solo.
   *
   * ## ⛔ Perché il campo è ancora dichiarato qui, se è rifiutato
   *
   * Perché **le app già installate lo mandano ancora**. Questa API ha
   * `forbidNonWhitelisted: true` (`main.ts`): un campo non dichiarato non viene ignorato, fa 400 con
   * *«property fastingWindow should not exist»* — una frase in inglese, per una cliente che ha solo
   * toccato un pallino nel suo profilo. L'aggiornamento arriva con l'OTA, ma non nello stesso
   * istante per tutte, e chi apre l'app durante lo scaricamento vede ancora la schermata vecchia.
   *
   * ⚠️ Dichiararlo e **rifiutarlo con una frase sua** è l'unica delle tre strade che non mente:
   * accettarlo e ignorarlo sarebbe un taglio silenzioso (lei tocca, sembra fatto, il piatto non
   * cambia), rifiutarlo in inglese è un errore che nessuno sa leggere.
   *
   * ⚠️ `IsIn([])` fallisce sempre, di proposito. È il punto: qui non c'è **nessun** valore ammesso.
   *
   * ⛔ **`@ValidateIf` E NON `@IsOptional`** (trovato in revisione, 21/8, provato con `class-validator`
   * vero). `@IsOptional` non vuol dire «se c'è, validalo»: vuol dire «salta i controlli quando il
   * valore è `undefined` **o `null`**». Con `@IsOptional` addosso, `{"fastingWindow": null}` passava
   * il cancello e finiva nel `...rest` che il servizio scrive alla cieca: la colonna andava a NULL
   * mentre protocollo, orario e `fastingSceltoIl` restavano scritti. Le fasce si calcolano da quelli,
   * quindi lo schermo continuava a dire «20:00 – 21:00 · 1 pasto» e il motore le mandava tutti e
   * cinque i pasti. Schermo e piatto che dicono due cose diverse — il difetto che questa consegna
   * esiste per chiudere, rientrato dalla porta del cancello che doveva chiuderlo.
   *
   * ⚠️ `ValidateIf` guarda la **presenza** della chiave e non il valore: assente si salta, presente —
   * `null` compreso — si rifiuta con la frase.
   */
  /**
   * ⛔ **`!== undefined`, e NON `'fastingWindow' in o`** (trovato dal test qui accanto, 21/8 — la
   * seconda stesura di questa riga, e sarebbe stata molto peggio della prima).
   *
   * `ValidationPipe` costruisce l'istanza con `plainToInstance`, che **materializza tutte** le
   * proprietà dichiarate: quelle che nessuno ha mandato ci sono lo stesso, con dentro `undefined`.
   * Quindi `'fastingWindow' in o` è **sempre vero** — e il cancello avrebbe rifiutato *ogni*
   * richiesta a questo endpoint, non solo quelle che mandano la finestra. Un 400 su tutto, con una
   * frase che parla di un campo che il chiamante non ha nemmeno nominato.
   *
   * ⚠️ Con `undefined` si salta, con `null` no: è esattamente la riga che serve, ed è la differenza
   * che `@IsOptional` non sa fare (lui salta tutti e due).
   */
  @ValidateIf((o: Record<string, unknown>) => o.fastingWindow !== undefined)
  @IsIn([], {
    message: 'La tua finestra adesso si sposta trascinando l\'orologio nella home dell\'app. '
      + 'Se non lo vedi, chiudi e riapri l\'app: si aggiorna da sola.',
  })
  fastingWindow?: string | null;

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
  /**
   * ⛔ **IL CAMPO RESTA ANCHE SE NESSUNO LO LEGGE PIÙ** — 2/9.
   *
   * La preferenza «ricette semplici» è stata tolta dal motore (decisione di Simone: *«lo toglierei
   * proprio»*, dopo il caso Patrizia del 31/8). L'interruttore nel Profilo dell'app però c'è
   * ancora, e lo manda a **ogni salvataggio**: un DTO che non lo accetta più risponde 400 a tutte
   * le **app già installate**, e la cliente non riesce più a salvare il profilo — nome, obiettivo,
   * allergie — per un campo che non serve a nessuno.
   *
   * ⚠️ Sparisce dall'app al prossimo rilascio (voce `interruttore-ricette-semplici-in-app`), e di
   * qui quando le versioni vecchie non sono più in giro. Il valore in banca dati si tiene: dice a
   * chi quella preferenza interessava, ed è un dato che non si ricrea.
   */
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
