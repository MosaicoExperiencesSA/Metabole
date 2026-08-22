import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class CreateDietDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString() @MaxLength(40)
  regime!: string;

  @IsString() @MaxLength(40)
  style!: string;

  @IsIn([3, 5])
  mealsPerDay!: number;

  // Digiuno intermittente 16:8 (pasti nella finestra 12-20, niente colazione).
  @IsOptional()
  @IsBoolean()
  fasting?: boolean;

  @IsOptional()
  @IsArray()
  levels?: unknown[];

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;

  // Campi "prodotto" mostrati al cliente (schermo 16).
  @IsOptional() @IsString() @MaxLength(60) clientName?: string;
  @IsOptional() @IsString() @MaxLength(400) clientDescription?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) highlights?: string[];
  @IsOptional() @IsString() @MaxLength(40) seasonalTag?: string;
  @IsOptional() @IsIn(['dimagrimento', 'mantenimento']) objective?: string;
  @IsOptional() @IsBoolean() clientVisible?: boolean;
  @IsOptional() @IsBoolean() siteVisible?: boolean;
  @IsOptional() @IsBoolean() recommended?: boolean;
}

export class RenameDietDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
}

export class UpdateDietDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString() @MaxLength(40)
  regime?: string;

  @IsOptional()
  @IsString() @MaxLength(40)
  style?: string;

  @IsOptional()
  @IsIn([3, 5])
  mealsPerDay?: number;

  // Digiuno intermittente 16:8.
  @IsOptional()
  @IsBoolean()
  fasting?: boolean;

  @IsOptional()
  @IsArray()
  levels?: unknown[];

  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;

  // Campi "prodotto" mostrati al cliente (schermo 16).
  @IsOptional() @IsString() @MaxLength(60) clientName?: string;
  @IsOptional() @IsString() @MaxLength(400) clientDescription?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) highlights?: string[];
  @IsOptional() @IsString() @MaxLength(40) seasonalTag?: string;
  @IsOptional() @IsIn(['dimagrimento', 'mantenimento']) objective?: string;
  @IsOptional() @IsBoolean() clientVisible?: boolean;
  @IsOptional() @IsBoolean() recommended?: boolean;
}

/**
 * Modifica della sola "scheda cliente" (schermo 16), consentita anche su diete approvate.
 *
 * ## ⛔ `siteVisible` MANCAVA, e «pubblica tutta la famiglia» era morta
 *
 * Trovato il 22/8 censendo le descrizioni delle diete. `GestioneDieta.tsx` — il pulsante che
 * pubblica una famiglia intera a clienti **e sito** — manda tre chiamate per variante: `publish`,
 * poi `{ siteVisible: true }`, poi `{ clientVisible: true }`. La seconda non era dichiarata qui, e
 * `main.ts` usa `whitelist: true` **con `forbidNonWhitelisted: true`**: quindi rispondeva **400**.
 *
 * ⛔ E il `catch` che avvolge le tre chiamate faceva il resto: l'errore veniva raccolto, `done` non
 * si incrementava e **la terza chiamata non partiva nemmeno**. Risultato per chi premeva il
 * pulsante: «Completate 0 su 18 varianti», con diciotto righe di errore — e né il sito né le
 * clienti vedevano niente. Non era un caso limite: era **ogni** pubblicazione di famiglia.
 *
 * ⚠️ Il commento nel controller diceva già che questa rotta governa «visibilità clienti/sito»: la
 * regola era scritta giusta e il campo per applicarla non c'era. *Una ragione falsa è peggio di un
 * ordine sbagliato* — qui era una promessa senza il pezzo che la mantiene.
 */
export class UpdateDietProductDto {
  @IsOptional() @IsString() @MaxLength(60) clientName?: string;
  @IsOptional() @IsString() @MaxLength(400) clientDescription?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) highlights?: string[];
  @IsOptional() @IsString() @MaxLength(40) seasonalTag?: string;
  @IsOptional() @IsIn(['dimagrimento', 'mantenimento']) objective?: string;
  @IsOptional() @IsBoolean() clientVisible?: boolean;
  /** ⚠️ La vetrina del sito pubblico (`GET /public/paths`, senza autenticazione). Vedi la nota sopra. */
  @IsOptional() @IsBoolean() siteVisible?: boolean;
  @IsOptional() @IsBoolean() recommended?: boolean;
}

/**
 * ⛔ **I CAMPI CHE NON SONO TESTO — quelli che restano del capo.**
 *
 * Deciso da Simone il 22/8: *«la nutrizionista scrive il testo, il capo la visibilità»*. Il testo
 * (nome, descrizione, punti chiave, tag) è lavoro clinico e lo fa lei; accendere una dieta a clienti
 * e sito è la vetrina, e la decide il capo — la stessa persona che approva.
 *
 * ⛔ **`objective` sta qui, e non è visibilità** (aggiunto in revisione, 22/8). Aprendo la rotta alla
 * nutrizionista ci era passato dentro senza che nessuno lo dicesse, e **non è un campo della
 * scheda**: `pick-diet.ts` filtra le diete su `objective`, quindi cambiarlo su una dieta approvata
 * **sposta a chi il motore la assegna**. Una tendina dentro una form intitolata «Scheda cliente»
 * ridefiniva a chi va il prodotto. La costante quindi non si chiama più «vetrina»: si chiama per
 * quello che è, cioè «tutto quello che non è testo».
 *
 * ⚠️ L'elenco sta **qui** e non dentro un `if` nel service: la domanda «questo campo è testo?» è
 * una sola, e sparsa diventa due risposte. ⛔ E `satisfies keyof UpdateDietProductDto` fa il resto:
 * un nome scritto male non compila. Che un campo NUOVO venga aggiunto all'elenco non lo garantisce
 * il compilatore — lo tiene fermo `scheda-cliente-alla-porta.spec.ts`, che pretende che ogni campo
 * booleano del DTO sia qui dentro.
 */
export const CAMPI_NON_TESTO = ['clientVisible', 'siteVisible', 'recommended', 'objective'] as const satisfies readonly (keyof UpdateDietProductDto)[];

/**
 * La scheda cliente scritta su TUTTA una famiglia in un colpo.
 *
 * ⛔ **Perché non basta la rotta per id.** Una «famiglia» (`Diet.name` + `style`) è fino a 18 righe:
 * regime × obiettivo × numero di pasti. In registrazione e sul sito il codice **tappa i buchi** —
 * basta che una variante sia compilata perché la card lo sia (`onboarding.service.ts`,
 * `catalog.service.publicPaths`) — ma nel **profilo** la cliente legge la **sua variante esatta**
 * (`profile.service.ts` → `dieta-mostrata.ts`). Quindi si può avere un catalogo che sembra a posto e
 * una cliente che nel profilo legge la descrizione di un'ALTRA dieta: `profile.service.ts` ripiega
 * su quella dell'ultimo menu consegnato. ⚠️ Peggio del vuoto, perché sembra una risposta.
 *
 * ⚠️ Chi compila una riga di diciotto crede di aver finito: è il difetto per costruzione di una
 * tabella per variante. Perciò si scrive **per famiglia**, e le diciotto righe le riempie il server
 * in una transazione — non il browser con diciotto chiamate, che è il modo in cui «pubblica la
 * famiglia» falliva a metà senza dirlo (vedi la nota su `siteVisible`).
 *
 * ⛔ **Nessun campo di vetrina qui.** Accendere diciotto diete in un colpo è la cosa che non deve
 * poter succedere per sbaglio: la visibilità resta una scelta per variante, del capo.
 *
 * ⚠️ **E nemmeno `highlights`** (tolto in revisione, 22/8). Nessuna schermata lo manda da qui, e un
 * campo che il DTO accetta e nessuno scrive è superficie senza interfaccia: il giorno che serve, si
 * aggiunge insieme alla casella che lo compila. ⛔ Oggi i «punti chiave» restano il campo
 * per-variante che si scrive da `Diete.tsx` e che nessuno uniforma — e la colonna «Coperte» non li
 * conta, quindi quel buco non si vede. Sta scritto qui invece di essere lasciato credere risolto.
 */
export class UpdateFamilyProductDto {
  /** ⚠️ È `Diet.name`, cioè la CHIAVE con cui il motore ritrova il prodotto: non l'etichetta. */
  @IsString() @MinLength(1) @MaxLength(120) famiglia!: string;
  /** Lo stile (`mediterranean`, `keto`…): la famiglia è la coppia, come in registrazione. */
  @IsString() @MinLength(1) @MaxLength(60) stile!: string;
  /**
   * ⚠️ `null` è ammesso, e vuol dire **svuota**: una descrizione incollata sulla famiglia sbagliata
   * va tolta. `@IsOptional()` lascia passare `null` (a differenza di `@ValidateIf`), quindi il
   * comportamento c'è già — è scritto perché sia una scelta e non un caso.
   */
  @IsOptional() @IsString() @MaxLength(60) clientName?: string | null;
  @IsOptional() @IsString() @MaxLength(400) clientDescription?: string | null;
  @IsOptional() @IsString() @MaxLength(40) seasonalTag?: string | null;
}

/** Una regola del motore attivata/parametrizzata per un prodotto (Fase F). */
export class ProductRuleItemDto {
  @IsString() @MaxLength(20) ruleCode!: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsObject() params?: Record<string, unknown>;
}

export class SetProductRulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductRuleItemDto)
  rules!: ProductRuleItemDto[];
}

export class RuleProposalDto {
  @IsString() @MinLength(4) @MaxLength(500) text!: string;
}

class TemplateMealDto {
  @IsIn(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'])
  slot!: string;

  @IsString()
  recipeId!: string;
}

export class DayTemplateDto {
  @IsInt()
  @Min(1)
  @Max(10)
  level!: number;

  @IsInt()
  @Min(1)
  @Max(28)
  dayIndex!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateMealDto)
  meals!: TemplateMealDto[];
}

/**
 * Collegare/scollegare una ricetta a una giornata del catalogo.
 *
 * `dayIndex` arriva fino a **84** (dodici settimane), non a 28 come in `DayTemplateDto`: quel tetto
 * è di quando il ciclo era di quattro settimane, e i dati veri hanno già ricette in settimana 12.
 * Un limite più basso della realtà non protegge niente: rifiuta il lavoro vero.
 */
export class CollegaRicettaDto {
  @IsString()
  dietId!: string;

  @IsInt()
  @Min(1)
  @Max(84)
  dayIndex!: number;
}

export class SetDayTemplatesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayTemplateDto)
  days!: DayTemplateDto[];
}

class IngredientDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  qty?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}

export class CreateRecipeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString() @MaxLength(40)
  regime!: string;

  @IsIn(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'])
  mealSlot!: string;

  @IsInt()
  @Min(30)
  @Max(2000)
  kcal!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientDto)
  ingredients!: IngredientDto[];

  @IsOptional()
  @IsArray()
  cookingMethods?: unknown[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  macros?: Record<string, number>;

  /** Difficoltà di preparazione: semplice | media | elaborata. */
  @IsOptional()
  @IsIn(['semplice', 'media', 'elaborata'])
  difficulty?: string;

  /**
   * Stagioni in cui il piatto ha senso (voce #11). Vuoto = tutto l'anno.
   * Fuori stagione la ricetta è penalizzata nel punteggio, non esclusa.
   */
  @IsOptional()
  @IsArray()
  @IsIn(['spring', 'summer', 'autumn', 'winter'], { each: true })
  seasons?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** Modifica ricetta: tutti i campi opzionali (si aggiornano solo quelli inviati). */
export class UpdateRecipeDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(40) regime?: string;
  @IsOptional() @IsIn(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']) mealSlot?: string;
  @IsOptional() @IsInt() @Min(30) @Max(2000) kcal?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => IngredientDto) ingredients?: IngredientDto[];
  @IsOptional() @IsArray() cookingMethods?: unknown[];
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsObject() macros?: Record<string, number>;
  @IsOptional() @IsIn(['semplice', 'media', 'elaborata']) difficulty?: string;
  @IsOptional() @IsArray() @IsIn(['spring', 'summer', 'autumn', 'winter'], { each: true }) seasons?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}

export class RejectDietDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
