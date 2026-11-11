# Antarctic Sea-Ice, Iceberg Trajectory & Navigation Decision Support System

SIH 2026 · PS ID SIH26059 · Team Binary Brains

This repo wires your existing React dashboard to the two trained models
(sea-ice U-Net forecaster, iceberg drift residual regressor) and an A*
routing engine, through a small Node gateway.

```
project/
├── frontend/                        React dashboard (as supplied — unchanged)
│   └── src/api/client.js            <- defines the exact API contract everything below implements
│
├── backend/
│   ├── ml-service/                  FastAPI · "AI/ML Engine" + "Routing Engine"
│   │   ├── app/
│   │   │   ├── main.py              POST /seaice-forecast, /predict/iceberg_velocity, /route
│   │   │   ├── schemas.py           Pydantic request/response models
│   │   │   ├── models/
│   │   │   │   ├── seaice_unet.py       U-Net matching seaice_model_pt.zip's saved weights
│   │   │   │   └── iceberg_residual.py  physics base drift + your sklearn residual model
│   │   │   └── routing/
│   │   │       ├── grid.py          lat/lon <-> 28x28 dashboard grid
│   │   │       └── astar.py         A* over an ice-risk cost grid
│   │   ├── weights/
│   │   │   ├── seaice_unet.pt               (copied from seaice_model_pt.zip)
│   │   │   └── iceberg_residual_model.pkl
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   └── gateway/                     Node/Express · "Navigation UI" backend, session + persistence
│       ├── src/
│       │   ├── server.js            mounts everything under /api
│       │   ├── db.js                Mongo models: RouteHistory, Iceberg
│       │   └── routes/
│       │       ├── route.js         POST /api/route            -> proxies ml-service, logs history
│       │       ├── seaice.js        POST /api/seaice-forecast   -> proxies ml-service
│       │       ├── iceberg.js       POST /api/predict/iceberg_velocity -> proxies ml-service
│       │       │                    GET  /api/icebergs/active    -> Mongo
│       │       └── history.js       GET  /api/routes/history     -> Mongo
│       ├── package.json
│       ├── .env.example
│       └── Dockerfile
│
├── data/
│   └── route_sample.geojson         your sample A* output, kept as a reference/test fixture
│
├── docker-compose.yml               frontend + gateway + ml-service + mongo
└── README.md
```

## API contract (already defined by your frontend — do not change without updating `src/api/client.js`)

| Method | Path | Body / Query | Response |
|---|---|---|---|
| POST | `/api/route` | `{start_lat, start_lon, goal_lat, goal_lon}` | `{route: [{gx, gy}, ...], total_cost}` |
| POST | `/api/seaice-forecast` | `{last_5_days: [[[...]]]}` (5 grids) | `{forecast: number[][]}` |
| POST | `/api/predict/iceberg_velocity` | `{lat, lon, cur_u, cur_v, wind_u, wind_v}` | `{resid_east, resid_north}` |
| GET | `/api/routes/history` | — | `{routes: [...]}` |
| GET | `/api/icebergs/active` | — | `{icebergs: [...]}` *(new — wire into `IcebergTracker.jsx` in place of `MOCK_ICEBERGS`)* |

## Run it locally (no Docker)

**1. ML service**
```bash
cd backend/ml-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**2. Gateway** (needs MongoDB running locally, or point `MONGO_URI` at Atlas)
```bash
cd backend/gateway
cp .env.example .env
npm install
npm run dev
```

**3. Frontend**
```bash
cd frontend
echo "REACT_APP_API_URL=http://localhost:5000" > .env
npm install
npm run dev
```

## Run it with Docker

```bash
docker compose up --build
```
Frontend → http://localhost:3000, Gateway → http://localhost:5000, ML service → http://localhost:8000.

## Things to finish before this is demo-ready

1. **Grid calibration** (`backend/ml-service/app/routing/grid.py`) — the lat/lon
   bounding box is a first-pass guess reverse-engineered from your dashboard's
   default coordinates. Replace with the real extent of your NSIDC/Copernicus
   grid.
2. **`/route` currently uses a flat placeholder ice grid** — have the gateway
   cache the latest `/seaice-forecast` output and pass it into `find_route()`
   instead of the `TODO` in `main.py`, so routing actually avoids real ice.
3. **`IcebergTracker.jsx` still reads `MOCK_ICEBERGS`** — swap in a
   `getIcebergList()` call to the new `GET /api/icebergs/active` endpoint.
4. **Seed the `Iceberg` collection** — a small ingest script pulling from the
   BYU/NIC iceberg tracking database (mentioned in your slide 6) populates
   `/api/icebergs/active` with real positions instead of an empty list.
5. **Data ingestion pipeline** (NSIDC / Copernicus / ERA5) isn't included
   here — it's what would produce the real `last_5_days` grids fed into
   `/seaice-forecast`. Slide 3 sketches this as a separate scheduled job
   writing into PostGIS; that's a good next module to add under `backend/`.

## Notes on the two trained models

- **`seaice_unet.py`** — architecture was reverse-engineered directly from the
  tensor shapes stored in `seaice_model_pt.zip`'s checkpoint (a small 2-level
  U-Net, 5 input channels → 1 output channel), so it loads with
  `strict=True`. Torch wasn't available in the sandbox this was built in, so
  run a quick sanity check locally:
  ```python
  from app.models.seaice_unet import load_seaice_model
  m = load_seaice_model("weights/seaice_unet.pt")
  print(m)  # should print the 8-layer U-Net with no shape errors
  ```
- **`iceberg_residual.py`** — your `.pkl` is a scikit-learn
  `MultiOutputRegressor(GradientBoostingRegressor)` expecting 6 features
  `[lat, lon, cur_u, cur_v, wind_u, wind_v]` and predicting a 2-output
  residual `[resid_east, resid_north]`. The wrapper adds a standard physics
  base drift (current + 2% wind, Coriolis-deflected) underneath it — this is
  the "Physics Fallback Mode" from your feasibility slide, so the system
  stays operational if the ML residual can't be computed.
# Antarctic-Sea-Ice-Iceberg-Trajectory-and-Navigation-Decision-Support-System
