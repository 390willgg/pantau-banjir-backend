import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import {
  getRedisUrl,
  isNotificationsQueueEnabled,
} from "./config/runtime-config";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { AuthModule } from "./auth/auth.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AlertsModule } from "./alerts/alerts.module";
import { LocationsModule } from "./locations/locations.module";
import { DevicesModule } from "./devices/devices.module";
import { ReportsModule } from "./reports/reports.module";
import { SensorReadingsModule } from "./sensor-readings/sensor-readings.module";
import { WaterLevelModule } from "./water-level/water-level.module";
import { MqttIngestionModule } from "./mqtt-ingestion/mqtt-ingestion.module";
import { HealthModule } from "./health/health.module";
import { HistoryModule } from "./history/history.module";
import { ChartModule } from "./chart/chart.module";
import { IotDashboardModule } from "./iot-dashboard/iot-dashboard.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 30),
      },
    ]),
    ...(isNotificationsQueueEnabled()
      ? [
          BullModule.forRoot({
            connection: {
              url: getRedisUrl(),
            },
          }),
        ]
      : []),
    PrismaModule,
    RedisModule,
    AuthModule,
    NotificationsModule,
    AlertsModule,
    LocationsModule,
    DevicesModule,
    ReportsModule,
    SensorReadingsModule,
    WaterLevelModule,
    MqttIngestionModule,
    HealthModule,
    HistoryModule,
    ChartModule,
    IotDashboardModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
