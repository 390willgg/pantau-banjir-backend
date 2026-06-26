import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class DeviceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  claimCode: string;

  @ApiPropertyOptional()
  label: string | null;

  @ApiPropertyOptional()
  assignedLocationId: string | null;

  @ApiPropertyOptional()
  lastSeenAt: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}
