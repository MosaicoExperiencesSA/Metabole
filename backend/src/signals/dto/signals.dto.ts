import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class CreateMeasurementDto {
  /** Default: oggi. Formato YYYY-MM-DD. */
  @IsOptional()
  @IsDateString()
  date?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(35)
  @Max(250)
  weightKg!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(40)
  @Max(200)
  waistCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(40)
  @Max(200)
  hipsCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(120)
  thighsCm?: number;
}

export class CreateCheckinDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsIn(['great', 'good', 'ok', 'hard', 'stressed'])
  mood!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  energy?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  hunger?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  stress?: number;
}

export class CreateWaterDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsInt()
  @Min(0)
  @Max(30)
  glasses!: number;
}

export class CreateStepsDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsInt()
  @Min(0)
  @Max(150000)
  steps!: number;

  @IsOptional()
  @IsIn(['manual', 'healthkit', 'google_fit'])
  source?: string;
}
