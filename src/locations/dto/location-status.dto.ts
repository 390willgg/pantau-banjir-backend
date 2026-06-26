import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FloodSeverity } from '../../common/enums/flood-severity.enum';
import { AreaSummaryDto } from '../../common/dto/area-summary.dto';

export class LocationStatusDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: AreaSummaryDto })
  area: AreaSummaryDto;

  @ApiProperty()
  latitude: number | null;

  @ApiProperty()
  longitude: number | null;

  @ApiProperty()
  waterLevelMeters: number;

  @ApiProperty()
  flowRateMs: number;

  @ApiProperty({ enum: FloodSeverity })
  severity: FloodSeverity;

  @ApiProperty()
  lastUpdated: string | null;

  @ApiProperty()
  warningThreshold: number;

  @ApiProperty()
  dangerThreshold: number;

  @ApiPropertyOptional({
    nullable: true,
    additionalProperties: true,
    description: 'Telemetry mentah terakhir dari perangkat. Dipakai untuk pilot lapangan dan debug device.',
  })
  rawPayload?: Record<string, unknown> | null;
}
