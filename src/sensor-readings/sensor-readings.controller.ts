import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { IngestSensorReadingDto } from './dto/ingest-sensor-reading.dto';
import { IngestSensorReadingResponseDto } from './dto/ingest-sensor-reading-response.dto';
import { SensorReadingsService } from './sensor-readings.service';

@ApiTags('sensor-readings')
@Controller('sensor-readings')
export class SensorReadingsController {
  constructor(private readonly sensorReadingsService: SensorReadingsService) {}

  @Post()
  @ApiCreatedResponse({ type: IngestSensorReadingResponseDto })
  ingest(@Body() dto: IngestSensorReadingDto) {
    return this.sensorReadingsService.ingest(dto);
  }
}
