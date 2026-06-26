import { Controller, Get, Header, Query } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { IotDashboardService } from "./iot-dashboard.service";

@ApiTags("iot-dashboard")
@Controller("iot-dashboard")
export class IotDashboardController {
  constructor(private readonly iotDashboardService: IotDashboardService) {}

  @Get()
  @Header("content-type", "text/html; charset=utf-8")
  getDashboard() {
    return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pantau Banjir - Data IoT</title>
  <style>
    :root { color-scheme: light; --bg:#f4f7fb; --panel:#fff; --line:#dbe4ee; --text:#172033; --muted:#66758a; --blue:#2563eb; --teal:#0f9eb3; --green:#10b981; --orange:#f97316; --red:#ef4444; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Arial, sans-serif; background:var(--bg); color:var(--text); }
    header { position:sticky; top:0; z-index:2; background:#0f766e; color:#fff; padding:18px 22px; box-shadow:0 8px 24px rgba(15,118,110,.2); }
    header h1 { margin:0; font-size:22px; }
    header p { margin:5px 0 0; opacity:.9; font-size:14px; }
    main { max-width:1180px; margin:0 auto; padding:22px; }
    .toolbar, .grid, .panel { margin-bottom:18px; }
    .toolbar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
    button, select { border:1px solid var(--line); border-radius:8px; background:#fff; color:var(--text); font-size:14px; padding:10px 12px; }
    button { cursor:pointer; background:#14532d; color:#fff; border-color:#14532d; font-weight:700; }
    .grid { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:12px; }
    .card, .panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; box-shadow:0 12px 30px rgba(15,23,42,.06); }
    .card { padding:16px; }
    .label { color:var(--muted); font-size:13px; }
    .value { margin-top:8px; font-size:24px; font-weight:800; }
    .panel { padding:18px; overflow:hidden; }
    .panel h2 { margin:0 0 12px; font-size:18px; }
    canvas { width:100%; height:290px; display:block; border:1px solid var(--line); border-radius:8px; background:#fff; }
    .charts { display:grid; grid-template-columns: 1fr 1fr; gap:14px; }
    table { width:100%; border-collapse:collapse; min-width:980px; }
    th, td { border-bottom:1px solid var(--line); padding:10px 8px; text-align:left; font-size:13px; white-space:nowrap; }
    th { color:#334155; background:#f8fafc; position:sticky; top:0; }
    .table-wrap { overflow:auto; max-height:520px; border:1px solid var(--line); border-radius:8px; }
    .pill { display:inline-block; border-radius:999px; padding:4px 8px; font-weight:700; font-size:12px; }
    .NORMAL { background:#dcfce7; color:#166534; }
    .WARNING { background:#ffedd5; color:#9a3412; }
    .DANGER { background:#fee2e2; color:#991b1b; }
    .STALE { background:#ede9fe; color:#5b21b6; }
    .muted { color:var(--muted); }
    @media (max-width: 820px) { main { padding:14px; } .grid { grid-template-columns:1fr 1fr; } .charts { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <header>
    <h1>Data IoT Pantau Banjir</h1>
    <p>Visual langsung dari PostgreSQL backend. Halaman refresh otomatis tiap 10 detik.</p>
  </header>
  <main>
    <div class="toolbar">
      <button id="refreshBtn">Refresh</button>
      <label class="muted">Jumlah data:</label>
      <select id="limitSelect">
        <option value="50">50 terbaru</option>
        <option value="200" selected>200 terbaru</option>
        <option value="500">500 terbaru</option>
        <option value="1000">1000 terbaru</option>
      </select>
      <span id="status" class="muted">Memuat data...</span>
    </div>

    <section class="grid">
      <div class="card"><div class="label">Total data tersimpan</div><div id="total" class="value">-</div></div>
      <div class="card"><div class="label">Tinggi air terbaru</div><div id="latestWater" class="value">-</div></div>
      <div class="card"><div class="label">Aliran terbaru</div><div id="latestFlow" class="value">-</div></div>
      <div class="card"><div class="label">Data terakhir</div><div id="latestTime" class="value">-</div></div>
    </section>

    <section class="charts">
      <div class="panel">
        <h2>Grafik Ketinggian Air</h2>
        <canvas id="waterChart" width="760" height="290"></canvas>
      </div>
      <div class="panel">
        <h2>Grafik Aliran Air</h2>
        <canvas id="flowChart" width="760" height="290"></canvas>
      </div>
    </section>

    <section class="panel">
      <h2>Tabel Reading IoT</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Waktu</th><th>Sensor</th><th>Area</th><th>Status</th><th>Tinggi</th><th>Flow</th><th>L/min</th><th>Volume</th><th>Ultrasonic</th><th>Pressure</th><th>Pulse</th><th>Prediksi</th>
            </tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    </section>
  </main>
  <script>
    const statusEl = document.getElementById("status");
    const limitSelect = document.getElementById("limitSelect");
    const refreshBtn = document.getElementById("refreshBtn");

    const fmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });
    const fmt4 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 });
    const timeFmt = new Intl.DateTimeFormat("id-ID", { hour:"2-digit", minute:"2-digit", second:"2-digit", day:"2-digit", month:"2-digit" });

    function asNumber(value) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    function formatTime(value) {
      return value ? timeFmt.format(new Date(value)) : "-";
    }

    function drawChart(canvasId, rows, key, unit, color) {
      const canvas = document.getElementById(canvasId);
      const ctx = canvas.getContext("2d");
      const points = [...rows].reverse().map((r) => ({ t: r.measuredAt, v: asNumber(r[key]) })).filter((p) => p.v !== null);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const pad = { left: 54, right: 18, top: 18, bottom: 44 };
      const w = canvas.width - pad.left - pad.right;
      const h = canvas.height - pad.top - pad.bottom;
      ctx.strokeStyle = "#dbe4ee";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (h / 4) * i;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + w, y); ctx.stroke();
      }
      if (points.length === 0) {
        ctx.fillStyle = "#66758a"; ctx.font = "16px Arial"; ctx.fillText("Belum ada data", pad.left, pad.top + 40); return;
      }
      const max = Math.max(...points.map((p) => p.v), 0.001);
      const min = Math.min(...points.map((p) => p.v), 0);
      const range = Math.max(max - min, 0.001);
      ctx.fillStyle = "#66758a";
      ctx.font = "13px Arial";
      for (let i = 0; i <= 4; i++) {
        const value = max - (range / 4) * i;
        const y = pad.top + (h / 4) * i + 4;
        ctx.fillText(fmt4.format(value) + " " + unit, 6, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = pad.left + (points.length === 1 ? w : (w / (points.length - 1)) * i);
        const y = pad.top + h - ((p.v - min) / range) * h;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.fillStyle = color;
      points.forEach((p, i) => {
        const x = pad.left + (points.length === 1 ? w : (w / (points.length - 1)) * i);
        const y = pad.top + h - ((p.v - min) / range) * h;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      });
      const first = points[0], last = points[points.length - 1];
      ctx.fillStyle = "#66758a"; ctx.font = "12px Arial";
      ctx.fillText(formatTime(first.t), pad.left, canvas.height - 16);
      ctx.textAlign = "right";
      ctx.fillText(formatTime(last.t), pad.left + w, canvas.height - 16);
      ctx.textAlign = "left";
    }

    function render(data) {
      const summary = data.summary;
      const rows = data.readings;
      document.getElementById("total").textContent = String(summary.total ?? 0);
      document.getElementById("latestWater").textContent = summary.latestWaterLevelMeters == null ? "-" : fmt.format(summary.latestWaterLevelMeters * 100) + " cm";
      document.getElementById("latestFlow").textContent = summary.latestFlowRateMs == null ? "-" : fmt4.format(summary.latestFlowRateMs) + " m/s";
      document.getElementById("latestTime").textContent = formatTime(summary.latestMeasuredAt);
      drawChart("waterChart", rows, "waterLevelMeters", "m", "#2563eb");
      drawChart("flowChart", rows, "flowRateMs", "m/s", "#0f9eb3");
      document.getElementById("rows").innerHTML = rows.map((r) => \`
        <tr>
          <td>\${formatTime(r.measuredAt)}</td>
          <td>\${r.locationName}</td>
          <td>\${r.areaName}</td>
          <td><span class="pill \${r.severity}">\${r.severity}</span></td>
          <td>\${fmt.format(r.waterLevelCm)} cm</td>
          <td>\${fmt4.format(r.flowRateMs ?? 0)} m/s</td>
          <td>\${r.flowRateLpm == null ? "-" : fmt.format(r.flowRateLpm)}</td>
          <td>\${r.volumeM3 == null ? "-" : fmt4.format(r.volumeM3)} m3</td>
          <td>\${r.ultrasonicValid === true ? "valid" : r.ultrasonicValid === false ? "tidak valid" : "-"}</td>
          <td>\${r.pressureValid === true ? "valid" : r.pressureValid === false ? "tidak valid" : "-"}</td>
          <td>\${r.flowPulseCount ?? "-"}</td>
          <td>\${r.predictionCm == null ? "-" : fmt.format(r.predictionCm) + " cm"}</td>
        </tr>\`).join("");
      statusEl.textContent = "Terakhir refresh: " + formatTime(new Date());
    }

    async function load() {
      statusEl.textContent = "Memuat data...";
      const response = await fetch("iot-dashboard/readings?limit=" + encodeURIComponent(limitSelect.value), { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      render(await response.json());
    }

    refreshBtn.addEventListener("click", () => load().catch((error) => statusEl.textContent = "Gagal memuat: " + error.message));
    limitSelect.addEventListener("change", () => load().catch((error) => statusEl.textContent = "Gagal memuat: " + error.message));
    load().catch((error) => statusEl.textContent = "Gagal memuat: " + error.message);
    setInterval(() => load().catch((error) => statusEl.textContent = "Gagal memuat: " + error.message), 10000);
  </script>
</body>
</html>`;
  }

  @Get("readings")
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Jumlah reading terbaru yang ditampilkan. Default 200, maksimum 1000.",
  })
  @ApiOkResponse({ description: "Data reading IoT dari PostgreSQL." })
  getReadings(@Query("limit") limit?: string) {
    return this.iotDashboardService.getReadings(limit);
  }
}
