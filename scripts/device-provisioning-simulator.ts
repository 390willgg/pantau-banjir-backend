import http from 'node:http';
import { URL } from 'node:url';

type ProvisioningState = {
  mode: 'setup' | 'operational';
  provisioned: boolean;
  deviceId: string;
  apSsid: string;
  locationId: string | null;
  lastProvisionedAt: string | null;
  lastPayload: Record<string, unknown> | null;
};

function getArg(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

const port = Number.parseInt(getArg('--port', '8787'), 10);
const deviceId = getArg('--deviceId', 'esp8266-sim-a1');
const apSsid = getArg('--apSsid', 'PantauBanjir-Setup-SIM');

const state: ProvisioningState = {
  mode: 'setup',
  provisioned: false,
  deviceId,
  apSsid,
  locationId: null,
  lastProvisionedAt: null,
  lastPayload: null,
};

function sendJson(
  response: http.ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  response.end(JSON.stringify(body));
}

function collectRequestBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function isValidProvisioningPayload(
  payload: Record<string, unknown>,
): payload is Record<string, unknown> & {
  locationId: string;
  mqtt: { host: string; port?: number; topic: string };
  publishIntervalSeconds?: number;
} {
  const mqtt = payload.mqtt;

  return (
    typeof payload.locationId === 'string' &&
    typeof mqtt === 'object' &&
    mqtt != null &&
    typeof (mqtt as { host?: unknown }).host === 'string' &&
    typeof (mqtt as { topic?: unknown }).topic === 'string'
  );
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    response.end();
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/health') {
    sendJson(response, 200, {
      mode: state.mode,
      provisioned: state.provisioned,
      deviceId: state.deviceId,
      apSsid: state.apSsid,
      locationId: state.locationId,
      lastProvisionedAt: state.lastProvisionedAt,
    });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/config') {
    sendJson(response, 200, {
      mode: state.mode,
      provisioned: state.provisioned,
      locationId: state.locationId,
      lastProvisionedAt: state.lastProvisionedAt,
      lastPayload: state.lastPayload,
    });
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/provision') {
    try {
      const body = await collectRequestBody(request);
      const payload = JSON.parse(body) as Record<string, unknown>;

      if (!isValidProvisioningPayload(payload)) {
        sendJson(response, 400, {
          error:
            'Payload provisioning belum lengkap. locationId, mqtt.host, dan mqtt.topic wajib ada.',
        });
        return;
      }

      state.provisioned = true;
      state.mode = 'operational';
      state.locationId = payload.locationId;
      state.lastProvisionedAt = new Date().toISOString();
      state.lastPayload = payload;

      sendJson(response, 200, {
        ok: true,
        message:
          'Simulator menerima provisioning. Device dianggap pindah ke mode operasional.',
        mode: state.mode,
        provisioned: state.provisioned,
        deviceId: state.deviceId,
        locationId: state.locationId,
        lastProvisionedAt: state.lastProvisionedAt,
      });
      return;
    } catch (error) {
      sendJson(response, 400, {
        error: `Payload provisioning tidak valid: ${String(error)}`,
      });
      return;
    }
  }

  sendJson(response, 404, {
    error: 'Endpoint simulator tidak ditemukan.',
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(
    `Device provisioning simulator listening on http://127.0.0.1:${port}`,
  );
  console.log(`Device ID : ${state.deviceId}`);
  console.log(`AP SSID   : ${state.apSsid}`);
});
