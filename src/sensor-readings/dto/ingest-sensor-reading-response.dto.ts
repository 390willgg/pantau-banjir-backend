import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FloodSeverity } from '../../common/enums/flood-severity.enum';

export class IngestSensorReadingResponseDto {
  @ApiProperty()
  readingId: string;

  @ApiProperty()
  locationId: string;

  @ApiProperty({ enum: FloodSeverity })
  severity: FloodSeverity;

  @ApiProperty()
  deduplicated: boolean;

  @ApiPropertyOptional()
  alertId?: string | null;
}
