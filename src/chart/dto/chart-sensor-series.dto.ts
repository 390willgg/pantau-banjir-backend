import { ApiProperty } from "@nestjs/swagger";
import { ChartPointDto } from "./chart-point.dto";

export class ChartSensorSeriesDto {
  @ApiProperty()
  sensorId: string;

  @ApiProperty()
  sensorName: string;

  @ApiProperty()
  currentWaterLevel: number;

  @ApiProperty()
  currentFlowRate: number;

  @ApiProperty()
  currentVolume: number;

  @ApiProperty({ nullable: true })
  lastReadingAt: string | null;

  @ApiProperty({ type: [ChartPointDto] })
  waterLevelData: ChartPointDto[];

  @ApiProperty({ type: [ChartPointDto] })
  flowRateData: ChartPointDto[];

  @ApiProperty({ type: [ChartPointDto] })
  volumeData: ChartPointDto[];
}
