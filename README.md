# Pantau Banjir Backend

Backend ini menyediakan source of truth untuk status banjir, ingestion data sensor, lifecycle alert, laporan lapangan, dan notifikasi.

## Stack

- NestJS untuk API dan modul domain.
- PostgreSQL via Prisma untuk persistence utama.
- Redis untuk queue, cache singkat, dan rate limiting pendukung.
- Firebase Admin untuk verifikasi token dan pengiriman notifikasi FCM.

## Endpoint utama

- `GET /api/v1/water-level/overview`
- `GET /api/v1/alerts`
- `GET /api/v1/locations`
- `GET /api/v1/locations/:id/status`
- `PATCH /api/v1/locations/:id/install`
- `POST /api/v1/devices`
- `POST /api/v1/devices/claim`
- `POST /api/v1/reports`
- `POST /api/v1/sensor-readings`

## Menjalankan lokal

### Mode minimal: PostgreSQL saja

1. Salin `.env.example` menjadi `.env`.
2. Pastikan `REDIS_REQUIRED=false` dan `ENABLE_NOTIFICATIONS_QUEUE=false`.
3. Jalankan container PostgreSQL, misalnya `docker compose up -d postgres`.
4. Jalankan `npm install`.
5. Jalankan `npm run prisma:generate`.
6. Jalankan `npm run prisma:push`.
7. Jalankan `npm run start:dev`.

Dalam mode ini backend tetap hidup tanpa Redis. Cache overview akan dilewati dan dispatch notifikasi akan di-skip dengan warning log.

### Mode penuh: PostgreSQL + Redis + queue

1. Salin `.env.example` menjadi `.env`.
2. Set `REDIS_REQUIRED=true` dan `ENABLE_NOTIFICATIONS_QUEUE=true`.
3. Jalankan `docker compose up -d`.
4. Jalankan `npm install`.
5. Jalankan `npm run prisma:generate`.
6. Jalankan `npm run prisma:push`.
7. Jalankan `npm run start:dev`.

Swagger tersedia di `/docs`.

## Deploy ke Render

Backend ini sudah bisa dideploy lewat Blueprint Render dari file [render.yaml](/c:/Users/Public/pantau_banjir/pantau_banjir/render.yaml:1).

Konfigurasi yang dipakai:

- `rootDir=backend`
- build command: `npm ci && npm run build:render`
- start command: `npm run start:render`
- health check: `/api/v1/health`

`build:render` akan menjalankan:

1. `prisma generate`
2. `prisma db push`
3. `nest build`

Env minimal yang harus diisi di Render:

- `DATABASE_URL`
- `CORS_ALLOWED_ORIGINS`

Env opsional, tergantung fitur yang ingin dinyalakan:

- Firebase auth/notifikasi: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- MQTT ingestion: `MQTT_ENABLED`, `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`
- Redis queue: `REDIS_REQUIRED=true`, `ENABLE_NOTIFICATIONS_QUEUE=true`, `REDIS_URL`

Catatan deploy:

- Untuk deploy paling sederhana di Render, biarkan `REDIS_REQUIRED=false` dan `ENABLE_NOTIFICATIONS_QUEUE=false`.
- Jika memakai Firebase di Render, lebih aman isi credential langsung lewat env daripada file JSON lokal.
- Setelah backend punya URL Render, masukkan origin Flutter web production ke `CORS_ALLOWED_ORIGINS`, misalnya `https://your-frontend.onrender.com`.

### Sinkronisasi schema database

Gunakan `npm run prisma:push` setiap kali `prisma/schema.prisma` berubah. Ini menerapkan tabel dan index baru, termasuk index timeline `History` untuk `SensorReading`, `Alert`, `Report`, dan `AuditLog`.

Flow `tools/dev/start-backend-dev.ps1` sudah menjalankan `npx prisma db push` otomatis sebelum backend dinyalakan, jadi flow dev Windows normal akan ikut menerapkan index terbaru.

Dari root workspace, Anda juga bisa menerapkan schema tanpa menyalakan backend:

```powershell
.\tools\dev\apply-backend-schema.ps1
```

Jika PostgreSQL sudah hidup dan Anda tidak ingin script menyalakan Docker compose:

```powershell
.\tools\dev\apply-backend-schema.ps1 -SkipDockerStart
```

## Live E2E Dev Flow

Untuk flow Windows PowerShell yang langsung menyiapkan backend live untuk Flutter preview, jalankan script dari root workspace:

1. Start backend dev flow:
   ```powershell
   .\tools\dev\start-backend-dev.ps1
   ```
   Pastikan Docker Desktop sudah berjalan sehat sebelum menjalankan script ini, karena PostgreSQL lokal akan dijalankan lewat `docker compose`.
   Override port backend jika `3000` sudah dipakai:
   ```powershell
   .\tools\dev\start-backend-dev.ps1 -Port 3002
   ```
   Jika cold start backend pertama masih lambat, Anda juga bisa memperbesar timeout startup:
   ```powershell
   .\tools\dev\start-backend-dev.ps1 -Port 3002 -StartupTimeoutSeconds 300
   ```

2. Jalankan Flutter preview dari root workspace:
   ```powershell
   .\tools\dev\start-flutter-preview.ps1 -ApiBaseUrl http://localhost:3000 -PreviewTab devices
   ```
   Atau:
   ```powershell
   .\tools\dev\start-flutter-preview.ps1 -ApiBaseUrl http://localhost:3000 -PreviewTab flood-detection
   ```
   Untuk tab monitoring atau alert:
   ```powershell
   .\tools\dev\start-flutter-preview.ps1 -ApiBaseUrl http://localhost:3000 -PreviewTab monitoring
   .\tools\dev\start-flutter-preview.ps1 -ApiBaseUrl http://localhost:3000 -PreviewTab alert
   ```
   Untuk Android emulator, gunakan:
   ```powershell
   .\tools\dev\start-flutter-preview.ps1 -ApiBaseUrl http://10.0.2.2:3000 -PreviewTab devices
   ```
   Override port preview web jika `7357` sedang dipakai:
   ```powershell
   .\tools\dev\start-flutter-preview.ps1 -ApiBaseUrl http://localhost:3000 -PreviewTab devices -WebPort 7360
   ```
   Jika build web pertama masih lambat, Anda juga bisa memperbesar timeout startup:
   ```powershell
   .\tools\dev\start-flutter-preview.ps1 -ApiBaseUrl http://localhost:3000 -PreviewTab flood-detection -StartupTimeoutSeconds 300
   ```
   Untuk verifikasi login interaktif di tab auth, gunakan browser device:
   ```powershell
   .\tools\dev\start-auth-web-preview.ps1 -ApiBaseUrl http://localhost:3000
   ```

3. Jalankan smoke test backend:
   ```powershell
   .\tools\dev\smoke-live-flow.ps1 -ApiBaseUrl http://localhost:3000
   ```
   Jika Firebase Admin credential aktif, sertakan Firebase ID token operator:
   ```powershell
   .\tools\dev\smoke-live-flow.ps1 -ApiBaseUrl http://localhost:3000 -AuthToken '<firebase-id-token>'
   ```
   Untuk menguji jendela timeline yang berbeda:
   ```powershell
   .\tools\dev\smoke-live-flow.ps1 -ApiBaseUrl http://localhost:3000 -HistoryLimit 100 -HistoryDays 30 -ChartLimit 24 -ChartRange day
   ```
   Cara paling praktis mengambil token lokal adalah login lewat `.\tools\dev\start-auth-web-preview.ps1`, lalu copy nilai `Authorization: Bearer ...` dari request terproteksi di browser DevTools.
   Jika backend belum hidup atau URL salah, smoke script akan gagal dengan pesan reachability yang eksplisit.
   Smoke script ini sekarang juga:
   - memverifikasi `GET /api/v1/history?limit=100&days=30`
   - memverifikasi `GET /api/v1/chart/sensor-series?limit=24&range=day`
   - membuat `reading` dan `report`
   - memastikan `acknowledge/resolve` tanpa token gagal `401` saat Firebase Admin aktif
   - memastikan timeline history terbatasi memuat `reading`, `report`, dan `operatorAction` dengan referensi id yang dipakai Flutter
   - memastikan chart live memuat summary dan series point terbaru untuk water level, flow rate, dan volume

4. Hentikan flow:
   ```powershell
   .\tools\dev\stop-live-e2e.ps1
   ```

Flow ini sengaja menonaktifkan Redis queue dengan `REDIS_REQUIRED=false` dan `ENABLE_NOTIFICATIONS_QUEUE=false`, jadi local dev tetap stabil dengan PostgreSQL saja.

## Firebase Admin auth live

Jika Anda ingin menguji route operator yang terproteksi Firebase, backend sekarang mendukung dua sumber credential:
- `backend/.env` dengan `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, dan `FIREBASE_PRIVATE_KEY`
- file lokal `backend/credentials/firebase-admin.local.json`

Cara termudah untuk local dev:
1. Copy `backend/credentials/firebase-admin.local.example.json` menjadi `backend/credentials/firebase-admin.local.json`.
2. Isi file itu dengan service account JSON dari Firebase / Google Cloud.
3. Biarkan `FIREBASE_SERVICE_ACCOUNT_JSON_PATH=credentials/firebase-admin.local.json` di `backend/.env`.

Dari root workspace, Anda bisa cek kesiapan backend dan Flutter web sekaligus dengan:
```powershell
.\tools\dev\check-firebase-auth-readiness.ps1
```

Untuk login Firebase interaktif dari Flutter preview, gunakan:
```powershell
.\tools\dev\start-auth-web-preview.ps1 -ApiBaseUrl http://localhost:3000
```

Tanpa env credentials atau file JSON lokal di atas, backend tetap berjalan tetapi `FirebaseAuthGuard` akan bypass dan route terproteksi belum benar-benar menguji auth live.




## MQTT pilot ingestion

Backend sekarang bisa subscribe langsung ke broker MQTT dan menerjemahkan payload perangkat ke `IngestSensorReadingDto`, lalu tetap masuk ke `SensorReadingsService.ingest(...)` yang sama dengan jalur HTTP.

### Environment baru

Tambahan env di `.env`:

- `MQTT_ENABLED`
- `MQTT_URL`
- `MQTT_USERNAME`
- `MQTT_PASSWORD`
- `MQTT_CLIENT_ID`
- `MQTT_TOPIC_PATTERN`

Contoh baseline lokal sudah ada di `.env.example`.

### HiveMQ Cloud

Untuk pilot cloud, isi `backend/.env` dengan nilai dari dashboard HiveMQ Cloud:

```env
MQTT_ENABLED=true
MQTT_URL=mqtts://YOUR_HIVEMQ_CLUSTER_HOST.s1.eu.hivemq.cloud:8883
MQTT_USERNAME=YOUR_HIVEMQ_USERNAME
MQTT_PASSWORD=YOUR_HIVEMQ_PASSWORD
MQTT_CLIENT_ID=pantau-banjir-backend
MQTT_TOPIC_PATTERN=pantau-banjir/devices/+/readings
```

Firmware ESP8266 memakai host, username, password, port, dan topic prefix yang sama di `firmware/esp8266/pilot_sensor_node/pilot_sensor_node.ino`.

### Menjalankan lokal dengan broker MQTT

1. Set `MQTT_ENABLED=true` di `.env`.
2. Jalankan backend flow dari root workspace:
   ```powershell
   .\tools\dev\start-backend-dev.ps1 -Port 3002
   ```
3. Flow ini akan menyalakan `postgres` dan `mosquitto` jika Docker Desktop sehat.

### Kontrak payload MQTT v1

```json
{
  "deviceId": "esp8266-sim-a1",
  "measuredAt": "2026-03-22T10:30:00Z",
  "waterLevelMeters": 1.42,
  "flowRateMs": 0.85,
  "rawPayload": {
    "pressureRaw": 512,
    "pressureKpa": 13.9,
    "flowPulseCount": 42,
    "batteryVoltage": 3.9,
    "rssi": -68
  }
}
```

Koordinat pemasangan disimpan sekali dari HP installer lewat `PATCH /api/v1/locations/:id/install` atau `POST /api/v1/devices/claim`. Jika suatu saat firmware masih ingin mengirim `gps` di `rawPayload`, field itu tetap diterima sebagai telemetry tambahan, tetapi tidak lagi wajib untuk pilot. Identitas sensor baru adalah `deviceId`; backend resolve ke `locationId` hasil claim device. Payload lama dengan `locationId` masih diterima untuk simulator dan kompatibilitas.

### Simulator lokal

Simulator publisher tersedia di backend:

```powershell
cd backend
npm run mqtt:simulate -- --mqttUrl mqtt://localhost:1883 --topic pantau-banjir/sensors/A-1/readings --locationId A-1 --waterLevelMeters 3.2 --flowRateMs 0.85
```

Atau langsung dari root workspace:

```powershell
.\tools\dev\smoke-mqtt-flow.ps1 -ApiBaseUrl http://localhost:3002
```

### Health endpoint pilot

```text
GET /api/v1/health
```

Endpoint ini dipakai untuk memeriksa:
- koneksi database
- koneksi broker MQTT
- last ingestion age global
- last ingestion age per lokasi

### Artefak pilot perangkat

- kalibrasi: `docs/pilot_sensor_calibration.md`
- sketch ESP8266 referensi: `firmware/esp8266/pilot_sensor_node/pilot_sensor_node.ino`
- simulator provisioning lokal: `npm run device:simulate -- --port 8787`

### Uji provisioning tanpa hardware

Jika alat fisik belum ada, simulator provisioning bisa dipakai untuk memverifikasi flow `GET /health` dan `POST /provision` yang dipakai Flutter saat pemasangan:

```powershell
cd backend
npm run device:simulate -- --port 8787
```

Atau dari root workspace:

```powershell
.\tools\dev\start-device-simulator.ps1
.\tools\dev\smoke-device-provisioning.ps1
```

Base URL simulator default:

```text
http://127.0.0.1:8787
```

Di Flutter `Devices` -> `Pemasangan & Wi-Fi alat`, tekan `Pakai simulator lokal` untuk mengisi base URL ini tanpa mengetik manual.



