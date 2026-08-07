import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, MaxLength, MinLength, ValidateIf } from 'class-validator';

/**
 * Formato ammesso per il PERIODO di un piano: `Nd` giorni, `Nw` settimane, `Nm` mesi,
 * `Ny` anni, un numero nudo (= mesi) oppure la parola `maintenance`.
 *
 * Deve restare allineato a `subscriptionEnd` / `isKnownPeriod` in `commerce.service.ts`:
 * quello che il validatore accetta è esattamente ciò che il calcolo della data di fine sa
 * interpretare. Se qui passasse un formato sconosciuto, `subscriptionEnd` userebbe il
 * fallback lungo (3 mesi) senza dirlo a nessuno.
 *
 * ⚠️ Stessa storia con `monitoring` (7/8): il piano nasce dal seed con quel periodo, ma qui non
 * era ammesso — quindi era impossibile toccarne prezzo o provvigioni dal Negozio — e
 * `subscriptionEnd` non lo riconosceva, quindi ogni mese pagato sarebbe valso **3 mesi** di
 * servizio (il fallback muto). Un periodo nuovo va aggiunto in tre punti insieme: qui, in
 * `subscriptionEnd` e in `isKnownPeriod`.
 *
 * Prima al posto di questo c'era `@MaxLength(10)`. `maintenance` è di 11 caratteri: il piano
 * di mantenimento diventava **impossibile da salvare** dal Negozio, perche' il form rimanda
 * sempre anche il periodo. Chi modificava il prezzo si vedeva rifiutare il salvataggio e per
 * uscirne accorciava il Periodo (es. a `1m`) — e da quel momento il mantenimento non era piu'
 * riconosciuto: compariva a tutte nello shop, spariva il riquadro del report, e monitoraggio e
 * attivita' coach dedicate smettevano di scattare. Un limite di lunghezza al posto di un
 * controllo di formato.
 */
// Lo zero e' escluso di proposito: `isKnownPeriod` considera valido solo un numero > 0, quindi un
// «0m» accettato qui sarebbe un periodo formalmente buono che poi finisce nel fallback muto.
export const PLAN_PERIOD_RE = /^(maintenance|monitoring|0*[1-9]\d*\s*[dwmy]?)$/i;
export const PLAN_PERIOD_MSG =
  'Periodo non valido. Usa un numero con l\'unita\' (es. 8d, 2w, 3m, 1y) oppure "maintenance" / "monitoring" per i piani mensili dedicati.';

/**
 * Le 4 quote provvigionali in centesimi di €, condivise da piani e prodotti.
 * Importi fissi (non percentuali); 0 = niente provvigione a quel lato.
 */
class CommissionFields {
  // LEGACY (importi fissi in centesimi): usati solo se le percentuali sono tutte 0.
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) commissionCoachCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) commissionManagerCoachCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) commissionNutritionistCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) commissionHeadNutritionistCents?: number;

  // RETE A DIFFERENZA: percentuali per LIVELLO (0-100) sull'importo pagato.
  // Coach 25 / Coordinatrice 35 / Manager 45 → 25+10+10 a rete completa.
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) commissionCoachPct?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) commissionCoordinatorPct?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) commissionManagerPct?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) commissionNutritionistPct?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) commissionHeadNutritionistPct?: number;
}

export class CreateProductDto extends CommissionFields {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @Type(() => Number) @IsInt() @Min(0) priceCents!: number;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() repurchasable?: boolean;
}

export class UpdateProductDto extends CommissionFields {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceCents?: number;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() repurchasable?: boolean;
}

/**
 * Come si vende un piano. `one_time` = pagamento unico (i percorsi), `recurring` = solo
 * abbonamento con addebito automatico (il monitoraggio), `both` = sceglie la cliente al
 * checkout (il mantenimento: abbonamento o mese singolo).
 */
export const PLAN_BILLING = ['one_time', 'recurring', 'both'] as const;

export class CreatePlanDto extends CommissionFields {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsIn(PLAN_BILLING as unknown as string[]) billing?: string;
  @Type(() => Number) @IsInt() @Min(0) priceCents!: number;
  // Prezzo pieno di listino (barrato) + fine promo: null = nessun barrato / promo senza scadenza.
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsInt() @Min(0) listPriceCents?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() promoEndsAt?: string | null;
  @IsString() @MinLength(1) @MaxLength(20) @Matches(PLAN_PERIOD_RE, { message: PLAN_PERIOD_MSG }) period!: string; // es. 3m | 6m | 12m | maintenance
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) mealsPerDay?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() repurchasable?: boolean;
}

export class UpdatePlanDto extends CommissionFields {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsIn(PLAN_BILLING as unknown as string[]) billing?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceCents?: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsInt() @Min(0) listPriceCents?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() promoEndsAt?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20) @Matches(PLAN_PERIOD_RE, { message: PLAN_PERIOD_MSG }) period?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) mealsPerDay?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() repurchasable?: boolean;
}
