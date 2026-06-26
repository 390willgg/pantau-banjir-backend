-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "FloodSeverity" AS ENUM ('NORMAL', 'WARNING', 'DANGER', 'STALE');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('NEW', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "northLatitude" DOUBLE PRECISION NOT NULL,
    "southLatitude" DOUBLE PRECISION NOT NULL,
    "eastLongitude" DOUBLE PRECISION NOT NULL,
    "westLongitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "maxCapacityMeters" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "warningThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "dangerThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentSeverity" "FloodSeverity" NOT NULL DEFAULT 'NORMAL',
    "currentWaterLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentFlowRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastReadingAt" TIMESTAMP(3),
    "invalidCoordinateCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorReading" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "waterLevelMeters" DOUBLE PRECISION NOT NULL,
    "flowRateMs" DOUBLE PRECISION NOT NULL,
    "severity" "FloodSeverity" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "sourceReadingId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "FloodSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "areaId" TEXT,
    "reporterName" TEXT,
    "message" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "severity" "FloodSeverity",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fcmToken" TEXT NOT NULL,
    "areaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SensorReading_dedupeKey_key" ON "SensorReading"("dedupeKey");

-- CreateIndex
CREATE INDEX "SensorReading_locationId_measuredAt_idx" ON "SensorReading"("locationId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "SensorReading_measuredAt_idx" ON "SensorReading"("measuredAt" DESC);

-- CreateIndex
CREATE INDEX "Alert_locationId_status_idx" ON "Alert"("locationId", "status");

-- CreateIndex
CREATE INDEX "Alert_updatedAt_triggeredAt_idx" ON "Alert"("updatedAt" DESC, "triggeredAt" DESC);

-- CreateIndex
CREATE INDEX "Alert_triggeredAt_idx" ON "Alert"("triggeredAt" DESC);

-- CreateIndex
CREATE INDEX "Alert_acknowledgedAt_idx" ON "Alert"("acknowledgedAt" DESC);

-- CreateIndex
CREATE INDEX "Alert_resolvedAt_idx" ON "Alert"("resolvedAt" DESC);

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_action_createdAt_idx" ON "AuditLog"("entityType", "action", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSubscription_fcmToken_key" ON "NotificationSubscription"("fcmToken");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_sourceReadingId_fkey" FOREIGN KEY ("sourceReadingId") REFERENCES "SensorReading"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

