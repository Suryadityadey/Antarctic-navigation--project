"""
FastAPI ML/routing service — the "AI / ML Engine" + "Routing Engine" layers
from the architecture diagram.

Run with:
    uvicorn app.main:app --host 0.0.0.0 --port 8000

Endpoints (called by the Node gateway, not directly by the browser):
    POST /seaice-forecast
    POST /predict/iceberg_velocity
    POST /route
"""
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models.iceberg_residual import load_iceberg_model
from .models.seaice_unet import load_seaice_model
from .routing.astar import find_route
from .routing.grid import GRID_SIZE, latlon_to_cell
from .schemas import (
    IcebergVelocityRequest,
    IcebergVelocityResponse,
    RouteRequest,
    RouteResponse,
    SeaIceForecastRequest,
    SeaIceForecastResponse,
)

WEIGHTS_DIR = os.path.join(os.path.dirname(__file__), "..", "weights")

app = FastAPI(title="Antarctic Nav — ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to the gateway's origin in production
    allow_methods=["*"],
    allow_headers=["*"],
)

_seaice_model = None
_iceberg_model = None


@app.on_event("startup")
def load_models():
    global _seaice_model, _iceberg_model
    _seaice_model = load_seaice_model(os.path.join(WEIGHTS_DIR, "seaice_unet.pt"))
    _iceberg_model = load_iceberg_model(os.path.join(WEIGHTS_DIR, "iceberg_residual_model.pkl"))


@app.get("/health")
def health():
    return {
        "status": "ok",
        "seaice_model_loaded": _seaice_model is not None,
        "iceberg_model_loaded": _iceberg_model is not None,
    }


@app.post("/seaice-forecast", response_model=SeaIceForecastResponse)
def seaice_forecast(req: SeaIceForecastRequest):
    import torch

    grids = req.last_5_days
    for g in grids:
        if len(g) != len(grids[0]) or any(len(row) != len(g[0]) for row in g):
            raise HTTPException(400, "All 5 grids must share the same H x W shape")

    x = torch.tensor(grids, dtype=torch.float32).unsqueeze(0)  # (1, 5, H, W)
    with torch.no_grad():
        y = _seaice_model(x)  # (1, 1, H, W)

    forecast = y.squeeze(0).squeeze(0).tolist()
    return SeaIceForecastResponse(forecast=forecast)


@app.post("/predict/iceberg_velocity", response_model=IcebergVelocityResponse)
def predict_iceberg_velocity(req: IcebergVelocityRequest):
    pred = _iceberg_model.predict(
        lat=req.lat, lon=req.lon,
        cur_u=req.cur_u, cur_v=req.cur_v,
        wind_u=req.wind_u, wind_v=req.wind_v,
    )
    return IcebergVelocityResponse(
        resid_east=pred.resid_east,
        resid_north=pred.resid_north,
        base_east=pred.base_east,
        base_north=pred.base_north,
        total_east=pred.total_east,
        total_north=pred.total_north,
    )


@app.post("/route", response_model=RouteResponse)
def plan_route(req: RouteRequest):
    start = latlon_to_cell(req.start_lat, req.start_lon)
    goal = latlon_to_cell(req.goal_lat, req.goal_lon)

    # TODO: replace with the latest /seaice-forecast output for this area,
    # cached by the gateway. Flat grid keeps this endpoint runnable standalone.
    flat_ice_grid = [[0.1 for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]

    # TODO: pull live iceberg positions (see backend/gateway/src/routes/iceberg.js)
    icebergs = [(pt.gx, pt.gy) for pt in req.icebergs]

    path, total_cost = find_route(start, goal, flat_ice_grid, icebergs)

    return RouteResponse(
        route=[{"gx": c.gx, "gy": c.gy} for c in path],
        total_cost=round(total_cost, 2),
    )
