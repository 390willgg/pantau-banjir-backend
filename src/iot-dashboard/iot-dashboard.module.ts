import { Module } from "@nestjs/common";
import { IotDashboardController } from "./iot-dashboard.controller";
import { IotDashboardService } from "./iot-dashboard.service";

@Module({
  controllers: [IotDashboardController],
  providers: [IotDashboardService],
})
export class IotDashboardModule {}
