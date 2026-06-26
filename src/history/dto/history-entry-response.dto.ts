import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum HistoryEntryType {
  READING = "reading",
  ALERT = "alert",
  OPERATOR_ACTION = "operatorAction",
  REPORT = "report",
}

export class HistoryEntryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: HistoryEntryType })
  type: HistoryEntryType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  recordedAt: string;

  @ApiProperty()
  contextLabel: string;

  @ApiPropertyOptional()
  areaId?: string;

  @ApiPropertyOptional()
  areaName?: string;

  @ApiPropertyOptional()
  locationId?: string;

  @ApiPropertyOptional()
  locationName?: string;

  @ApiPropertyOptional()
  alertId?: string;

  @ApiPropertyOptional()
  reportId?: string;

  @ApiPropertyOptional()
  actorLabel?: string;
}
