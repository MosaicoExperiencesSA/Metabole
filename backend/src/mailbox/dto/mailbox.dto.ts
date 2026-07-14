import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SetMailboxDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

export class SendMailDto {
  @IsEmail()
  to!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  subject!: string;

  @IsString()
  @MaxLength(50000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  html?: string;
}
