import { getRoute, getIcebergVelocity } from "../api/client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Anchor,
  Navigation2,
  AlertTriangle,
  Waves,
  Route as RouteIcon,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { COLORS, FONT_MONO } from "../theme";

const GRID = 28;

const LAT_MIN = -75, LAT_MAX = -55, LON_MIN = -70, LON_MAX = -10;

function latLonToGrid(lat, lon) {
  const gx = Math.min(Math.max(((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (GRID - 1), 0), GRID - 1);
  const gy = Math.min(Math.max(((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (GRID - 1), 0), GRID - 1);
  return { gx, gy };
}

function generateIceGrid(day) {
  const cells = [];
  for (let y = 0; y < GRID; y++) {
    const row = [];
    for (let x = 0; x < GRID; x++) {
      const edge = GRID * 0.35 + Math.sin(x * 0.4 + day * 0.6) * 3;
      const dist = y - edge;
      let c =
        dist < 0
          ? 0.05
          : 0.15 + dist * 0.045 + Math.sin(x * 0.5 + y * 0.3) * 0.05;
      c = Math.max(0, Math.min(1, c));
      row.push(c);
    }
    cells.push(row);
  }
  return cells;
}

const BASE_ICEBERGS = [
  { id: "B12", lat: -64.5, lon: -50.0 },
  { id: "C04", lat: -66.0, lon: -40.0 },
  { id: "A21", lat: -63.5, lon: -30.0 },
  { id: "D09", lat: -68.0, lon: -45.0 },
];

const SECONDS_PER_DAY = 86400;

function applyDrift(lat, lon, totalEast, totalNorth, days) {
  const meters_e = totalEast * SECONDS_PER_DAY * days;
  const meters_n = totalNorth * SECONDS_PER_DAY * days;
  const newLat = lat + meters_n / 111320;
  const newLon = lon + meters_e / (111320 * Math.cos((lat * Math.PI) / 180));
  return { lat: newLat, lon: newLon };
}

function planRouteMock(start, goal) {
  // Used only when the backend is unreachable. Real routes come from
  // getRoute() -> Express -> FastAPI's A* endpoint over the actual cost grid.
  const steps = 24;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const gx = start.gx + (goal.gx - start.gx) * t;
    const baseGy = start.gy + (goal.gy - start.gy) * t;
    const bend = Math.sin(t * Math.PI) * 4;
    pts.push({ gx, gy: baseGy - bend });
  }
  return pts;
}

function StatCard({ icon, label, value }) {
  return (
    <div
      className="rounded-md p-4"
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.panelBorder}`,
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{ fontSize: 11.5, color: COLORS.iceMuted, marginBottom: 8 }}
      >
        {icon}
        {label}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}

export default function AntarcticNavDashboard() {
  const [start] = useState(() => ({ lat: -63.2, lon: -57.8, ...latLonToGrid(-63.2, -57.8) }));
  const [goal, setGoal] = useState(() => ({ lat: -68.9, lon: -25.1, ...latLonToGrid(-68.9, -25.1) }));
  const [forecastDay, setForecastDay] = useState(0);
  const [status, setStatus] = useState("idle");
  const [route, setRoute] = useState(null);
  const canvasRef = useRef(null);

  const iceGrid = useMemo(() => generateIceGrid(forecastDay), [forecastDay]);
  const [icebergs, setIcebergs] = useState(
    BASE_ICEBERGS.map((b) => ({ ...b, ...latLonToGrid(b.lat, b.lon) }))
  );
  
  useEffect(() => {
    let cancelled = false;
  
    async function updateIcebergs() {
      const updated = await Promise.all(
        BASE_ICEBERGS.map(async (b) => {
          try {
            // Synthetic current/wind for the demo — swap for real ERA5/Copernicus
            // readings once that ingestion pipeline exists.
            const vel = await getIcebergVelocity({
              lat: b.lat, lon: b.lon,
              curU: 0.1, curV: -0.05,
              windU: 5, windV: -3,
            });
            const { lat, lon } = applyDrift(b.lat, b.lon, vel.total_east, vel.total_north, forecastDay);
            return { ...b, lat, lon, ...latLonToGrid(lat, lon) };
          } catch {
            return { ...b, ...latLonToGrid(b.lat, b.lon) }; // model unreachable — hold position
          }
        })
      );
      if (!cancelled) setIcebergs(updated);
    }
  
    updateIcebergs();
    return () => { cancelled = true; };
  }, [forecastDay]);

  const runRoute = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await getRoute({
        startLat: start.lat,
        startLon: start.lon,
        goalLat: goal.lat,
        goalLon: goal.lon,
        icebergs: icebergs.map((b) => ({ gx: b.gx, gy: b.gy })),
      });
      setRoute(data.route);
      setStatus("ready");
    } catch (e) {
      // Backend not reachable yet — fall back to a preview path so the
      // dashboard is never empty during development.
      setRoute(planRouteMock(start, goal));
      setStatus("ready");
    }
  }, [start, goal, icebergs]);

  useEffect(() => {
    runRoute();
  }, [runRoute]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    const cell = w / GRID;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const c = iceGrid[y][x];
        const alpha = 0.08 + c * 0.55;
        ctx.fillStyle = `rgba(234, 244, 247, ${alpha})`;
        ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
      }
    }

    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(w, i * cell);
      ctx.stroke();
    }

    icebergs.forEach((b) => {
      const px = b.gx * cell;
      const py = b.gy * cell;
      ctx.beginPath();
      ctx.arc(px, py, cell * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(225, 87, 60, 0.12)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.danger;
      ctx.fill();
    });

    if (route && route.length > 1) {
      ctx.beginPath();
      route.forEach((p, i) => {
        const px = p.gx * cell;
        const py = p.gy * cell;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = COLORS.route;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    [start, goal].forEach((p, i) => {
      const px = p.gx * cell;
      const py = p.gy * cell;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? COLORS.safe : COLORS.ice;
      ctx.fill();
      ctx.strokeStyle = COLORS.bg;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, [iceGrid, icebergs, route, start, goal]);

  const avgIce = useMemo(() => {
    const flat = iceGrid.flat();
    return ((flat.reduce((a, b) => a + b, 0) / flat.length) * 100).toFixed(1);
  }, [iceGrid]);

  const routeDistanceKm = useMemo(() => {
    if (!route) return "—";
    let d = 0;
    for (let i = 1; i < route.length; i++) {
      d += Math.hypot(
        route[i].gx - route[i - 1].gx,
        route[i].gy - route[i - 1].gy,
      );
    }
    return Math.round(d * 25);
  }, [route]);

  return (
    <div style={{ color: COLORS.ice, minHeight: 640 }} className="w-full p-5">
      <div
        className="flex items-center justify-between mb-5 pb-4"
        style={{ borderBottom: `1px solid ${COLORS.panelBorder}` }}
      >
        <div className="flex items-center gap-3">
          <Anchor size={22} color={COLORS.accent} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              Antarctic Navigation Console
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.iceMuted }}>
              Sea-ice forecast · iceberg drift · route optimization
            </div>
          </div>
        </div>
        <div
          className="flex items-center gap-2"
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12.5,
            color: COLORS.iceMuted,
          }}
        >
          <span
            className="animate-pulse"
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: COLORS.safe,
              display: "inline-block",
            }}
          />
          model link {status === "ready" ? "ready" : status}
        </div>
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "230px 1fr 220px" }}
      >
        <div
          className="rounded-md p-4 flex flex-col gap-4"
          style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.panelBorder}`,
          }}
        >
          <div>
            <div
              style={{ fontSize: 12, color: COLORS.iceMuted, marginBottom: 6 }}
            >
              Start
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 13 }}>
              {start.lat.toFixed(1)}°, {start.lon.toFixed(1)}°
            </div>
          </div>
          <div>
            <div
              style={{ fontSize: 12, color: COLORS.iceMuted, marginBottom: 6 }}
            >
              Destination
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                value={goal.lat}
                onChange={(e) =>
                  setGoal((g) => {
                    const lat = parseFloat(e.target.value) || 0;
                    return { ...g, lat, ...latLonToGrid(lat, g.lon) };
                  })
                }
                style={{
                  width: "48%",
                  background: COLORS.bg,
                  border: `1px solid ${COLORS.panelBorder}`,
                  color: COLORS.ice,
                  fontFamily: FONT_MONO,
                  fontSize: 12,
                  padding: "5px 6px",
                  borderRadius: 4,
                }}
              />
              <input
                type="number"
                step="0.1"
                value={goal.lon}
                onChange={(e) =>
                  setGoal((g) => {
                    const lon = parseFloat(e.target.value) || 0;
                    return { ...g, lon, ...latLonToGrid(g.lat, lon) };
                  })
                }
                style={{
                  width: "48%",
                  background: COLORS.bg,
                  border: `1px solid ${COLORS.panelBorder}`,
                  color: COLORS.ice,
                  fontFamily: FONT_MONO,
                  fontSize: 12,
                  padding: "5px 6px",
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
          <div>
            <div
              className="flex justify-between"
              style={{ fontSize: 12, color: COLORS.iceMuted, marginBottom: 6 }}
            >
              <span>Forecast horizon</span>
              <span>{forecastDay === 0 ? "today" : `+${forecastDay}d`}</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={1}
              value={forecastDay}
              onChange={(e) => setForecastDay(parseInt(e.target.value, 10))}
              style={{ width: "100%", accentColor: COLORS.accent }}
            />
          </div>
          <button
            onClick={runRoute}
            disabled={status === "loading"}
            className="flex items-center justify-center gap-2 rounded-md"
            style={{
              background: COLORS.accent,
              color: COLORS.bg,
              fontWeight: 600,
              fontSize: 13,
              padding: "9px 0",
              border: "none",
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            {status === "loading" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Navigation2 size={15} />
            )}
            {status === "loading" ? "Planning…" : "Plan route"}
          </button>
          <div
            style={{ fontSize: 11.5, color: COLORS.iceMuted, lineHeight: 1.5 }}
          >
            Calls the backend's{" "}
            <span style={{ fontFamily: FONT_MONO }}>/api/route</span>. Falls
            back to a local preview path if it isn't reachable.
          </div>
        </div>

        <div
          className="rounded-md p-3"
          style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.panelBorder}`,
          }}
        >
          <canvas
            ref={canvasRef}
            width={640}
            height={520}
            style={{
              width: "100%",
              height: "auto",
              borderRadius: 6,
              display: "block",
            }}
          />
          <div
            className="flex items-center gap-4 mt-3"
            style={{ fontSize: 11.5, color: COLORS.iceMuted }}
          >
            <span className="flex items-center gap-1.5">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: COLORS.safe,
                  display: "inline-block",
                }}
              />
              start
            </span>
            <span className="flex items-center gap-1.5">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: COLORS.ice,
                  display: "inline-block",
                }}
              />
              destination
            </span>
            <span className="flex items-center gap-1.5">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: COLORS.danger,
                  display: "inline-block",
                }}
              />
              tracked iceberg
            </span>
            <span className="flex items-center gap-1.5">
              <span
                style={{
                  width: 14,
                  height: 2,
                  background: COLORS.route,
                  display: "inline-block",
                }}
              />
              recommended route
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <StatCard
            icon={<Waves size={16} color={COLORS.accent} />}
            label="Avg. ice concentration"
            value={`${avgIce}%`}
          />
          <StatCard
            icon={<AlertTriangle size={16} color={COLORS.danger} />}
            label="Icebergs tracked"
            value={icebergs.length}
          />
          <StatCard
            icon={<RouteIcon size={16} color={COLORS.route} />}
            label="Route distance"
            value={routeDistanceKm !== "—" ? `${routeDistanceKm} km` : "—"}
          />
          <StatCard
            icon={<ShieldCheck size={16} color={COLORS.safe} />}
            label="Route status"
            value={status === "ready" ? "Clear of ice" : "—"}
          />
        </div>
      </div>
    </div>
  );
}
