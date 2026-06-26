import { Module } from "@nestjs/common";
import { AlertsModule } from "../alerts/alerts.module";
import { DevicesModule } from "../devices/devices.module";
import { FloodClassificationService } from "../domain/flood-classification.service";
import { SensorReadingsController } from "./sensor-readings.controller";
import { SensorReadingsService } from "./sensor-readings.service";

@Module({
  imports: [AlertsModule, DevicesModule],
  controllers: [SensorReadingsController],
  providers: [SensorReadingsService, FloodClassificationService],
  exports: [SensorReadingsService],
})
export class SensorReadingsModule {}
