import { ApiProperty } from '@nestjs/swagger';
import { WaterLevelOverviewItemDto } from './water-level-overview-item.dto';

export class WaterLevelOverviewResponseDto {
  @ApiProperty()
  activeDevices: number;

  @ApiProperty()
  monitoredAreas: number;

  @ApiProperty()
  invalidCoordinateCount: number;

  @ApiProperty({ type: WaterLevelOverviewItemDto, isArray: true })
  waterLevels: WaterLevelOverviewItemDto[];
}
