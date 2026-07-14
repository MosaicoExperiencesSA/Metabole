import {
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const CHANNELS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'other'];

export class CreateSocialPostDto {
  @IsIn(CHANNELS)
  channel!: string;

  @IsString()
  @MaxLength(2200) // limite caption Instagram
  caption!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  collectionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  imageRef?: string;

  @IsOptional()
  @IsIn(['canva', 'png_locale'])
  imageSource?: string;
}

export class UpdateSocialPostDto {
  @IsOptional()
  @IsIn(CHANNELS)
  channel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2200)
  caption?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  imageRef?: string;

  @IsOptional()
  @IsIn(['canva', 'png_locale'])
  imageSource?: string;
}

export class ScheduleDto {
  @IsISO8601()
  at!: string;
}

export class MarkPublishedDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalId?: string;
}
