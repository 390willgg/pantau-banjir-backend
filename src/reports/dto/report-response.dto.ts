import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  areaId?: string;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  reporterName?: string;

  @ApiProperty()
  createdAt: string;
}
