import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import mqtt, { MqttClient } from "mqtt";
import {
  getMqttClientId,
  getMqttPassword,
  getMqttTopicPattern,
  getMqttUrl,
  getMqttUsername,
  isMqttEnabled,
} from "../config/runtime-config";
import { SensorReadingsService } from "../sensor-readings/sensor-readings.service";
import { mapMqttPayloadToIngestSensorReadingDto } from "./mqtt-reading-payload.mapper";

export type MqttConnectionState =
  | "disabled"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline"
  | "closed"
  | "error";

@Injectable()
export class MqttIngestionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttIngestionService.name);
  private client?: MqttClient;
  private connectionState: MqttConnectionState = isMqttEnabled()
    ? "connecting"
    : "disabled";
  private lastMessageAt: Date | null = null;
  private lastError: string | null = null;

  constructor(private readonly sensorReadingsService: SensorReadingsService) {}

  onModuleInit() {
    if (!isMqttEnabled()) {
      this.connectionState = "disabled";
      this.logger.log("MQTT ingestion is disabled.");
      return;
    }

    this.connect();
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.end(true);
      this.client = undefined;
    }
  }

  getStatus() {
    return {
      enabled: isMqttEnabled(),
      connectionState: this.connectionState,
      brokerUrl: getMqttUrl(),
      clientId: getMqttClientId(),
      topicPattern: getMqttTopicPattern(),
      lastMessageAt: this.lastMessageAt?.toISOString() ?? null,
      lastError: this.lastError,
    };
  }

  private connect() {
    this.connectionState = "connecting";

    this.client = mqtt.connect(getMqttUrl(), {
      clientId: getMqttClientId(),
      username: getMqttUsername(),
      password: getMqttPassword(),
      reconnectPeriod: 5_000,
      connectTimeout: 10_000,
    });

    this.client.on("connect", () => {
      this.connectionState = "connected";
      this.lastError = null;
      this.logger.log(
        `Connected to MQTT broker ${getMqttUrl()} with client ${getMqttClientId()}.`,
      );

      this.client?.subscribe(getMqttTopicPattern(), (error) => {
        if (error) {
          this.connectionState = "error";
          this.lastError = error.message;
          this.logger.error(
            `Failed to subscribe to MQTT topic ${getMqttTopicPattern()}: ${error.message}`,
          );
          return;
        }

        this.logger.log(
          `Subscribed to MQTT topic pattern ${getMqttTopicPattern()}.`,
        );
      });
    });

    this.client.on("reconnect", () => {
      this.connectionState = "reconnecting";
      this.logger.warn("Reconnecting to MQTT broker ...");
    });

    this.client.on("offline", () => {
      this.connectionState = "offline";
      this.logger.warn("MQTT client is offline.");
    });

    this.client.on("close", () => {
      if (this.connectionState !== "disabled") {
        this.connectionState = "closed";
      }
      this.logger.warn("MQTT connection closed.");
    });

    this.client.on("error", (error) => {
      this.connectionState = "error";
      this.lastError = error.message;
      this.logger.error(`MQTT client error: ${error.message}`);
    });

    this.client.on("message", (topic, message, packet) => {
      void this.handleMessage(
        topic,
        message,
        packet.qos ?? 0,
        packet.retain ?? false,
      );
    });
  }

  private async handleMessage(
    topic: string,
    message: Buffer,
    qos: number,
    retain: boolean,
  ) {
    const receivedAt = new Date();
    this.lastMessageAt = receivedAt;

    let payload: unknown;

    try {
      payload = JSON.parse(message.toString("utf-8"));
    } catch {
      this.logger.warn(
        `Ignoring MQTT message on ${topic} because it is not valid JSON.`,
      );
      return;
    }

    let dto;
    try {
      dto = mapMqttPayloadToIngestSensorReadingDto(payload, {
        topic,
        qos,
        retain,
        receivedAt,
      });
    } catch (error) {
      this.logger.warn(
        `Ignoring MQTT message on ${topic}: ${error instanceof Error ? error.message : "Unknown payload error."}`,
      );
      return;
    }

    try {
      const result = await this.sensorReadingsService.ingest(dto);
      this.logger.log(
        `MQTT reading ingested for ${result.locationId} (${result.readingId}) with severity ${result.severity}${
          result.deduplicated ? ", deduplicated" : ""
        }.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to ingest MQTT reading for ${dto.locationId ?? dto.deviceId}: ${error instanceof Error ? error.message : "Unknown error."}`,
      );
    }
  }
}
