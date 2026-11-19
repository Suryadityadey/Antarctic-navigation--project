from pydantic import BaseModel, Field


class IcebergPoint(BaseModel):
    gx: float
    gy: float


class RouteRequest(BaseModel):
    start_lat: float
    start_lon: float
    goal_lat: float
    goal_lon: float
    icebergs: list[IcebergPoint] = []


class RouteCell(BaseModel):
    gx: int
    gy: int


class RouteResponse(BaseModel):
    route: list[RouteCell]
    total_cost: float


class SeaIceForecastRequest(BaseModel):
    # 5 daily concentration grids, each GRID_SIZE x GRID_SIZE, values in [0, 1]
    last_5_days: list[list[list[float]]] = Field(..., min_length=5, max_length=5)


class SeaIceForecastResponse(BaseModel):
    forecast: list[list[float]]


class IcebergVelocityRequest(BaseModel):
    lat: float
    lon: float
    cur_u: float
    cur_v: float
    wind_u: float
    wind_v: float


class IcebergVelocityResponse(BaseModel):
    resid_east: float
    resid_north: float
    base_east: float
    base_north: float
    total_east: float
    total_north: float
