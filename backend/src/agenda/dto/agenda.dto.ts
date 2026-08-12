import { IsBoolean, IsIn, IsISO8601, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

/**
 * Uno slot della settimana tipo (§16.7).
 *
 * Gli orari arrivano come `HH:MM` e non come minuti: li scrive una persona in un campo, e un
 * numero fra 0 e 1439 in un form è un modo di sbagliare senza accorgersene. La conversione la fa
 * il servizio, in un punto solo.
 */
export class CreaSlotDto {
  @Matches(/^\d{1,2}:\d{2}$/, { message: "L'ora di inizio va scritta come 09:30." })
  inizio!: string;

  @Matches(/^\d{1,2}:\d{2}$/, { message: "L'ora di fine va scritta come 10:30." })
  fine!: string;

  /** Vero = vale per tutte le settimane (il flag «si ripete» della richiesta di Simone). */
  @IsBoolean()
  ripete!: boolean;

  /** 0 = domenica … 6 = sabato. Obbligatorio quando `ripete`. */
  @ValidateIf((o: CreaSlotDto) => o.ripete === true)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number | null;

  /** La giornata straordinaria. Obbligatoria quando NON `ripete`. */
  @ValidateIf((o: CreaSlotDto) => o.ripete === false)
  @IsISO8601({ strict: true }, { message: 'Data non valida (AAAA-MM-GG).' })
  data?: string | null;

  @IsOptional()
  @IsIn(['in_person', 'televisit'], { message: 'Tipo di visita non valido.' })
  tipo?: string;
}

/** Un periodo in cui non riceve. Estremi INCLUSI. */
export class CreaFerieDto {
  @IsISO8601({ strict: true }, { message: 'Data di inizio non valida (AAAA-MM-GG).' })
  dal!: string;

  @IsISO8601({ strict: true }, { message: 'Data di fine non valida (AAAA-MM-GG).' })
  al!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  motivo?: string | null;
}
