// Centralized API calls. Every component should go through here rather than
// calling fetch() directly, so the base URL and error handling live in one place.

const API_URL = process.env.REACT_APP_API_URL || '';

async function post(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${path} failed with status ${res.status}`);
  }
  return res.json();
}

async function get(path) {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    throw new Error(`${path} failed with status ${res.status}`);
  }
  return res.json();
}

// POST /api/route -> { route: [{ gx, gy }, ...], total_cost }
export function getRoute({ startLat, startLon, goalLat, goalLon, icebergs = [] }) {
  return post('/api/route', {
    start_lat: startLat,
    start_lon: startLon,
    goal_lat: goalLat,
    goal_lon: goalLon,
    icebergs,
  });
}

// POST /api/seaice-forecast -> { forecast: number[][] }
export function getSeaIceForecast(last5Days) {
  return post('/api/seaice-forecast', { last_5_days: last5Days });
}

// POST /api/iceberg-velocity -> { resid_east, resid_north }
export function getIcebergVelocity({ lat, lon, curU, curV, windU, windV }) {
  return post('/api/predict/iceberg_velocity', {
    lat,
    lon,
    cur_u: curU,
    cur_v: curV,
    wind_u: windU,
    wind_v: windV,
  });
}

// GET /api/routes/history -> { routes: [...] }
export function getRouteHistory() {
  return get('/api/routes/history');
}
