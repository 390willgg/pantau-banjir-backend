import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AlertStatus } from '../../common/enums/alert-status.enum';
import { FloodSeverity } from '../../common/enums/flood-severity.enum';
import { AreaSummaryDto } from '../../common/dto/area-summary.dto';

export class AlertResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: AreaSummaryDto })
  area: AreaSummaryDto;

  @ApiProperty()
  locationId: string;

  @ApiProperty()
  location: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ enum: FloodSeverity })
  severity: FloodSeverity;

  @ApiProperty({ enum: AlertStatus })
  status: AlertStatus;

  @ApiProperty()
  triggeredAt: string;

  @ApiPropertyOptional()
  acknowledgedAt?: string | null;

  @ApiPropertyOptional()
  resolvedAt?: string | null;
}
