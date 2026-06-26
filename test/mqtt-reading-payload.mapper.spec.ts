import { mapMqttPayloadToIngestSensorReadingDto } from "../src/mqtt-ingestion/mqtt-reading-payload.mapper";

describe("mapMqttPayloadToIngestSensorReadingDto", () => {
  const metadata = {
    topic: "pantau-banjir/sensors/A-1/readings",
    qos: 1,
    retain: false,
    receivedAt: new Date("2026-03-22T10:30:00.000Z"),
  };

  it("maps a valid MQTT payload into the existing ingest DTO", () => {
    const dto = mapMqttPayloadToIngestSensorReadingDto(
      {
        locationId: "A-1",
        measuredAt: "2026-03-22T10:29:45.000Z",
        waterLevelMeters: 1.42,
        flowRateMs: 0.85,
        rawPayload: {
          pressureRaw: 512,
          pressureKpa: 13.9,
        },
        batteryVoltage: 3.9,
        rssi: -68,
        gps: {
          latitude: -6.12,
          longitude: 106.89,
        },
      },
      metadata,
    );

    expect(dto).toEqual({
      locationId: "A-1",
      measuredAt: "2026-03-22T10:29:45.000Z",
      waterLevelMeters: 1.42,
      flowRateMs: 0.85,
      rawPayload: {
        pressureRaw: 512,
        pressureKpa: 13.9,
        batteryVoltage: 3.9,
        rssi: -68,
        gps: {
          latitude: -6.12,
          longitude: 106.89,
        },
        mqtt: {
          topic: metadata.topic,
          qos: metadata.qos,
          retain: metadata.retain,
          receivedAt: metadata.receivedAt.toISOString(),
        },
      },
    });
  });

  it("accepts deviceId-only payloads so firmware does not need a locationId", () => {
    const dto = mapMqttPayloadToIngestSensorReadingDto(
      {
        deviceId: "esp8266-sim-a1",
        measuredAt: "2026-03-22T10:29:45.000Z",
        waterLevelMeters: 1.42,
        flowRateMs: 0.85,
      },
      {
        ...metadata,
        topic: "pantau-banjir/devices/esp8266-sim-a1/readings",
      },
    );

    expect(dto.deviceId).toBe("esp8266-sim-a1");
    expect(dto.locationId).toBeUndefined();
  });

  it("rejects payloads without locationId or deviceId", () => {
    expect(() =>
      mapMqttPayloadToIngestSensorReadingDto(
        {
          measuredAt: "2026-03-22T10:29:45.000Z",
          waterLevelMeters: 1.42,
          flowRateMs: 0.85,
        },
        metadata,
      ),
    ).toThrow(/Invalid MQTT sensor payload/i);
  });

  it("rejects invalid MQTT payloads before they enter the ingest pipeline", () => {
    expect(() =>
      mapMqttPayloadToIngestSensorReadingDto(
        {
          locationId: "A-1",
          measuredAt: "not-a-date",
          waterLevelMeters: "high",
          flowRateMs: 0.85,
        },
        metadata,
      ),
    ).toThrow(/Invalid MQTT sensor payload/i);
  });

  it("rejects non-object payloads", () => {
    expect(() =>
      mapMqttPayloadToIngestSensorReadingDto("invalid", metadata),
    ).toThrow("MQTT payload must be a JSON object.");
  });
});
