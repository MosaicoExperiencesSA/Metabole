import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Envelope di un evento di tracciamento, come prodotto da track() nel prototipo:
 * { event, ts, session, phase, step, screen, data:{...} }.
 * `event_id` (UUID lato client) è opzionale ma consigliato: garantisce l'idempotenza sui retry.
 */
export class CreateEventDto {
  @IsString()
  @MaxLength(80)
  event!: string;

  /** UUID generato dal client per deduplicare i retry (sendBeacon può ripetere). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  eventId?: string;

  /** Sessione anonima pre-login (riconciliata all'utente alla registrazione). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  session?: string;

  /** Codice referral se l'utente arriva da ?ref=CODICE. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  refcod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phase?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  screen?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  step?: number;

  /** Timestamp epoch (ms) dichiarato dal client. */
  @IsOptional()
  @IsInt()
  @Min(0)
  ts?: number;

  /** Payload libero dell'evento. MAI dati sanitari in chiaro. */
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
