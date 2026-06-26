import "dotenv/config";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name];
  if (rawValue == null || rawValue.trim().length === 0) {
    return fallback;
  }

  const normalizedValue = rawValue.trim().toLowerCase();
  if (TRUE_VALUES.has(normalizedValue)) {
    return true;
  }

  if (FALSE_VALUES.has(normalizedValue)) {
    return false;
  }

  return fallback;
}

export function getRedisUrl() {
  return process.env.REDIS_URL ?? "redis://localhost:6379";
}

export function isRedisRequired() {
  return readBooleanEnv("REDIS_REQUIRED", false);
}

export function isNotificationsQueueEnabled() {
  return readBooleanEnv("ENABLE_NOTIFICATIONS_QUEUE", false);
}

export function isMqttEnabled() {
  return readBooleanEnv("MQTT_ENABLED", false);
}

export function getMqttUrl() {
  return process.env.MQTT_URL ?? "mqtt://localhost:1883";
}

export function getMqttUsername() {
  return process.env.MQTT_USERNAME?.trim() || undefined;
}

export function getMqttPassword() {
  return process.env.MQTT_PASSWORD?.trim() || undefined;
}

export function getMqttClientId() {
  return (
    process.env.MQTT_CLIENT_ID?.trim() || `pantau-banjir-backend-${process.pid}`
  );
}

export function getMqttTopicPattern() {
  return (
    process.env.MQTT_TOPIC_PATTERN?.trim() || "pantau-banjir/devices/+/readings"
  );
}
