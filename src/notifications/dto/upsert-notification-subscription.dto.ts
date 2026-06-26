import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertNotificationSubscriptionDto {
  @IsString()
  @MinLength(16)
  @MaxLength(4096)
  fcmToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  areaId?: string;
}
