import { ApiProperty } from '@nestjs/swagger';

export class AreaBoundsDto {
  @ApiProperty()
  northLatitude: number;

  @ApiProperty()
  southLatitude: number;

  @ApiProperty()
  eastLongitude: number;

  @ApiProperty()
  westLongitude: number;
}

export class AreaSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: AreaBoundsDto })
  bounds: AreaBoundsDto;
}
