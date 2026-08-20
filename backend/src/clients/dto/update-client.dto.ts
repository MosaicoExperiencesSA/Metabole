import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { VALORI_FINESTRA_DIGIUNO } from '../../menu/finestre-digiuno';

/** Aggiornamento scheda cliente: anagrafica (User) + questionario (ClientProfile). Tutti i campi opzionali. */
export class UpdateClientDto {
  // --- Anagrafica (User) ---
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsOptional() @IsString() @MaxLength(160) addressLine?: string;
  @IsOptional() @IsString() @MaxLength(10) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) province?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(20) codiceFiscale?: string;

  // --- Questionario (ClientProfile) ---
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsInt() @Min(18) @Max(100) age?: number;
  @IsOptional() @IsIn(['female', 'male']) sex?: string;
  @IsOptional() @IsInt() @Min(120) @Max(230) heightCm?: number;
  @IsOptional() @IsNumber() @Min(35) @Max(250) startWeightKg?: number;
  @IsOptional() @IsNumber() @Min(40) @Max(200) startWaistCm?: number;
  @IsOptional() @IsNumber() @Min(40) @Max(200) startHipsCm?: number;
  @IsOptional() @IsString() @MaxLength(40) regime?: string;
  @IsOptional() @IsString() @MaxLength(40) dietStyle?: string;
  /** Famiglia (`Diet.name`): con lo stile identifica il prodotto. Vuota = abbinamento per stile. */
  @IsOptional() @IsString() @MaxLength(120) dietFamily?: string;
  /**
   * «Lascia i giorni già preparati» (Vera, azione 3 — 14/8): col cambio di dieta NON si rifanno i
   * giorni futuri già erogati; la dieta nuova entra coi prossimi menu generati. ⚠️ È un'istruzione
   * per questa scrittura, non un dato: non è in `PROFILE_FIELDS` e non finisce mai sul profilo.
   */
  @IsOptional() @IsBoolean() dietChangeKeepDeliveredDays?: boolean;
  /**
   * ⛔ **IL «4» È STATO TOLTO IL 20/8, dopo averlo contato.**
   *
   * Il DTO accettava `[3, 4, 5]`, ma **nel catalogo una dieta a 4 pasti non è mai esistita**: le
   * varianti nascono con `fasting ? 3 : meals === '5' ? 5 : 3`. Una cliente messa a 4 non trovava
   * nessuna variante e `pickDietFor` ricadeva sul «purché sia dello stesso regime», dandole una
   * dieta a 3 o a 5 — cioè un numero di pasti diverso da quello scritto sulla sua scheda.
   *
   * ⚠️ E la stessa domanda («quali pasti ha una giornata») è scritta in quattro posti che sul 4 non
   * dicono la stessa cosa: `pastiAttesi` e `slotAttesi` lo trattano come un 3, il generatore non lo
   * conosce e ricade sul 5, e solo `slotsForMeals` sa che ha la merenda. Vedi
   * `catalog/quattro-pasti.spec.ts`.
   *
   * ✅ `npm run diag:pasti` in produzione: **zero clienti a 4 pasti** (24 a tre, 15 a cinque, 17
   * senza il campo). Nessuno da spostare, nessuna migrazione: bastava smettere di accettarlo.
   *
   * ⚠️ Se un giorno servirà davvero una giornata da quattro pasti, il posto da cui ricominciare non
   * è questa riga: sono le quattro funzioni e le varianti del catalogo. Rimettere il `4` qui e
   * basta rifarebbe esattamente il buco di prima.
   */
  @IsOptional() @IsIn([3, 5]) mealsPerDay?: number;
  @IsOptional() @IsIn(['classic3', 'five', 'supplements', 'intermittent_fasting']) pathType?: string;
  /**
   * Quali pasti salta chi fa digiuno intermittente. La stringa vuota è ammessa e significa «la
   * decide la dieta»: è il valore che manda la tendina quando si sceglie di non imporre nulla, e
   * senza `''` fra i valori validi svuotare il campo dalla scheda restituiva un 400.
   */
  // `''` = svuota («li decide la dieta»), ed è una scelta legittima. I valori vengono dalla
  // tabella unica: vedi `menu/finestre-digiuno.ts`.
  @IsOptional() @IsIn([...VALORI_FINESTRA_DIGIUNO, '']) fastingWindow?: string;
  @IsOptional() @IsIn(['sedentary', 'light', 'moderate', 'active', 'very_active']) activityLevel?: string;
  /** Account dei recensori degli store: misure mai bloccanti (voce #6f del 5/8). */
  @IsOptional() @IsBoolean() isStoreReviewer?: boolean;
  @IsOptional() @IsIn(['daily', 'when_needed', 'on_request']) coachStyle?: string;
  @IsOptional() @IsIn(['follows', 'needs_push', 'perseveres', 'quits']) character?: string;
  /**
   * ALLERGIE — richiedono il permesso «Modifica allergie» (`change_allergies`).
   *
   * ⚠️ Non stavano in questo DTO, e non era una dimenticanza: fino al 13/8 le scriveva **un solo
   * punto in tutto il codice**, l'upsert del questionario. Ora si aprono alla scheda perché
   * qualcuno deve poter **codificare a mano** un'allergia scritta in testo libero — ma dietro un
   * flag suo, non dentro «Clienti: gestisci», che ce l'ha anche la coach.
   */
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(60, { each: true }) allergies?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) intolerances?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) dislikedFoods?: string[];
  @IsOptional() @IsString() @MaxLength(9) themeColor?: string;
  // Fase attuale del cliente per l'abbinamento dieta (decisione clinica dello staff).
  @IsOptional() @IsIn(['dimagrimento', 'mantenimento']) objective?: string;
}
