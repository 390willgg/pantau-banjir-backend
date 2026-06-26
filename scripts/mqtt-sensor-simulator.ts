import mqtt from 'mqtt';

interface SimulatorOptions {
  mqttUrl: string;
  topic: string;
  locationId: string;
  measuredAt: string;
  waterLevelMeters: number;
  flowRateMs: number;
  pressureRaw: number;
  pressureKpa: number;
  flowPulseCount: number;
  batteryVoltage: number;
  rssi: number;
}

function parseArgs(argv: string[]): SimulatorOptions {
  const args = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) {
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      continue;
    }

    args.set(key.slice(2), next);
  }

  const locationId = args.get('locationId') ?? process.env.LOCATION_ID ?? 'A-1';

  return {
    mqttUrl: args.get('mqttUrl') ?? process.env.MQTT_URL ?? 'mqtt://localhost:1883',
    topic: args.get('topic') ?? process.env.MQTT_TOPIC ?? `pantau-banjir/sensors/${locationId}/readings`,
    locationId,
    measuredAt: args.get('measuredAt') ?? new Date().toISOString(),
    waterLevelMeters: Number(args.get('waterLevelMeters') ?? process.env.WATER_LEVEL_METERS ?? 3.2),
    flowRateMs: Number(args.get('flowRateMs') ?? process.env.FLOW_RATE_MS ?? 0.85),
    pressureRaw: Number(args.get('pressureRaw') ?? process.env.PRESSURE_RAW ?? 512),
    pressureKpa: Number(args.get('pressureKpa') ?? process.env.PRESSURE_KPA ?? 13.9),
    flowPulseCount: Number(args.get('flowPulseCount') ?? process.env.FLOW_PULSE_COUNT ?? 42),
    batteryVoltage: Number(args.get('batteryVoltage') ?? process.env.BATTERY_VOLTAGE ?? 3.9),
    rssi: Number(args.get('rssi') ?? process.env.RSSI ?? -68),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const client = mqtt.connect(options.mqttUrl, {
    clientId: `pantau-banjir-simulator-${Date.now()}`,
  });

  await new Promise<void>((resolve, reject) => {
    client.once('connect', () => resolve());
    client.once('error', (error) => reject(error));
  });

  const payload = {
    locationId: options.locationId,
    measuredAt: options.measuredAt,
    waterLevelMeters: options.waterLevelMeters,
    flowRateMs: options.flowRateMs,
    rawPayload: {
      pressureRaw: options.pressureRaw,
      pressureKpa: options.pressureKpa,
      flowPulseCount: options.flowPulseCount,
      batteryVoltage: options.batteryVoltage,
      rssi: options.rssi,
    },
  };

  await new Promise<void>((resolve, reject) => {
    client.publish(options.topic, JSON.stringify(payload), { qos: 1 }, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  console.log(`Published MQTT payload to ${options.topic}`);
  console.log(JSON.stringify(payload, null, 2));

  client.end(true);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
