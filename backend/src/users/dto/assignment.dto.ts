import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignmentDto {
  @IsUUID()
  clientId!: string; // user id della cliente

  @IsOptional()
  @IsString()
  coachId?: string; // staff id

  @IsOptional()
  @IsString()
  nutritionistId?: string; // staff id
}
