import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class ClaimDeviceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  claimCode: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  locationId: string;

  @ApiProperty()
  @IsLatitude()
  latitude: number;

  @ApiProperty()
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}
