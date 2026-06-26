import { ApiProperty } from '@nestjs/swagger';
import { FloodSeverity } from '../../common/enums/flood-severity.enum';

export class WaterLevelOverviewItemDto {
  @ApiProperty()
  sensorName: string;

  @ApiProperty()
  waterLevelMeters: number;

  @ApiProperty()
  fillPercent: number;

  @ApiProperty({ enum: FloodSeverity })
  severity: FloodSeverity;
}
