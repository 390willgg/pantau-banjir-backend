import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";

export class IngestSensorReadingDto {
  @ApiPropertyOptional({
    description:
      "ID lokasi langsung. Masih didukung untuk simulator dan ingestion lama.",
  })
  @ValidateIf((dto: IngestSensorReadingDto) => !dto.deviceId)
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({
    description: "ID alat fisik. Backend akan resolve ke lokasi hasil claim.",
  })
  @ValidateIf((dto: IngestSensorReadingDto) => !dto.locationId)
  @IsString()
  deviceId?: string;

  @ApiProperty()
  @IsDateString()
  measuredAt: string;

  @ApiProperty()
  @IsNumber()
  waterLevelMeters: number;

  @ApiProperty()
  @IsNumber()
  flowRateMs: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;
}
