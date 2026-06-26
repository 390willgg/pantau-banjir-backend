import { ApiProperty } from "@nestjs/swagger";

export class ChartPointDto {
  @ApiProperty()
  label: string;

  @ApiProperty()
  value: number;

  @ApiProperty({ required: false })
  bucketStart?: string;

  @ApiProperty({ required: false })
  bucketEnd?: string;

  @ApiProperty({ required: false, type: () => [ChartPointDto] })
  details?: ChartPointDto[];
}
