import { Module } from '@nestjs/common';
import { MqttIngestionModule } from '../mqtt-ingestion/mqtt-ingestion.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [MqttIngestionModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
