"""
Maps lat/lon <-> the GRID x GRID cell coordinates the React dashboard draws
on its canvas (see GRID = 28 in AntarcticNavDashboard.jsx).

The bounding box below is a first-pass calibration for the Antarctic
Peninsula / Weddell Sea sector implied by the frontend's default start/goal
points and route_sample.geojson. Replace with your NSIDC/Copernicus grid's
real extent once the ingestion pipeline is wired up — nothing else in the
routing code depends on these exact numbers.
"""
from dataclasses import dataclass

GRID_SIZE = 28

LAT_MIN, LAT_MAX = -75.0, -55.0
LON_MIN, LON_MAX = -70.0, -10.0  # western -> eastern edge


@dataclass(frozen=True)
class Cell:
    gx: int
    gy: int


def latlon_to_cell(lat: float, lon: float) -> Cell:
    gx = (lon - LON_MIN) / (LON_MAX - LON_MIN) * (GRID_SIZE - 1)
    # lat increases northward; gy increases downward on the canvas (row 0 = north edge)
    gy = (LAT_MAX - lat) / (LAT_MAX - LAT_MIN) * (GRID_SIZE - 1)
    gx = min(max(round(gx), 0), GRID_SIZE - 1)
    gy = min(max(round(gy), 0), GRID_SIZE - 1)
    return Cell(gx=gx, gy=gy)


def cell_to_latlon(gx: float, gy: float) -> tuple[float, float]:
    lon = LON_MIN + (gx / (GRID_SIZE - 1)) * (LON_MAX - LON_MIN)
    lat = LAT_MAX - (gy / (GRID_SIZE - 1)) * (LAT_MAX - LAT_MIN)
    return lat, lon
