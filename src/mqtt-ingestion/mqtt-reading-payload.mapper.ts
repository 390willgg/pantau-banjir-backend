import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { IngestSensorReadingDto } from "../sensor-readings/dto/ingest-sensor-reading.dto";

export interface MqttMessageMetadata {
  topic: string;
  qos: number;
  retain: boolean;
  receivedAt: Date;
}

export function mapMqttPayloadToIngestSensorReadingDto(
  payload: unknown,
  metadata: MqttMessageMetadata,
): IngestSensorReadingDto {
  if (!isRecord(payload)) {
    throw new Error("MQTT payload must be a JSON object.");
  }

  const {
    locationId,
    deviceId,
    measuredAt,
    waterLevelMeters,
    flowRateMs,
    rawPayload,
    ...extra
  } = payload;
  const dto = plainToInstance(IngestSensorReadingDto, {
    locationId,
    deviceId,
    measuredAt,
    waterLevelMeters,
    flowRateMs,
    rawPayload: buildRawPayload(rawPayload, extra, metadata),
  });

  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    const message = errors
      .map((error) => Object.values(error.constraints ?? {}).join(", "))
      .filter((value) => value.length > 0)
      .join("; ");

    throw new Error(
      `Invalid MQTT sensor payload. ${message || "Validation failed."}`,
    );
  }

  return dto;
}

function buildRawPayload(
  rawPayload: unknown,
  extra: Record<string, unknown>,
  metadata: MqttMessageMetadata,
): Record<string, unknown> | undefined {
  const merged: Record<string, unknown> = {};

  if (isRecord(rawPayload)) {
    Object.assign(merged, rawPayload);
  }

  Object.assign(merged, extra);
  merged.mqtt = {
    topic: metadata.topic,
    qos: metadata.qos,
    retain: metadata.retain,
    receivedAt: metadata.receivedAt.toISOString(),
  };

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
