import { Module } from '@nestjs/common';
import { SensorReadingsModule } from '../sensor-readings/sensor-readings.module';
import { MqttIngestionService } from './mqtt-ingestion.service';

@Module({
  imports: [SensorReadingsModule],
  providers: [MqttIngestionService],
  exports: [MqttIngestionService],
})
export class MqttIngestionModule {}
