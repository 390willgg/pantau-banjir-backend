import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { IngestSensorReadingDto } from './dto/ingest-sensor-reading.dto';
import { IngestSensorReadingResponseDto } from './dto/ingest-sensor-reading-response.dto';
import { SensorReadingsService } from './sensor-readings.service';

@ApiTags('sensor-readings')
@Controller('sensor-readings')
export class SensorReadingsController {
  constructor(private readonly sensorReadingsService: SensorReadingsService) {}

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: IngestSensorReadingResponseDto })
  ingest(@Body() dto: IngestSensorReadingDto) {
    return this.sensorReadingsService.ingest(dto);
  }
}
