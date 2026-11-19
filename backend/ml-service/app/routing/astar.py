"""
A* route optimization over a risk-weighted grid.

Cost per cell combines:
  - sea-ice concentration (from the U-Net forecast, 0-1) — the dominant term
  - a soft exclusion radius around tracked iceberg positions
  - a small constant to prefer straighter, shorter paths

The result matches the shape the frontend expects from POST /api/route:
    { "route": [{"gx": int, "gy": int}, ...], "total_cost": float }
"""
import heapq
import math
from typing import Iterable

from .grid import GRID_SIZE, Cell

ICE_RISK_WEIGHT = 6.0
ICEBERG_EXCLUSION_RADIUS = 2.0   # cells
ICEBERG_PENALTY = 8.0
IMPASSABLE_ICE_THRESHOLD = 0.92  # concentration above this is not traversable


def build_cost_grid(
    ice_concentration: list[list[float]],
    icebergs: Iterable[tuple[float, float]] = (),
) -> list[list[float]]:
    """ice_concentration: GRID_SIZE x GRID_SIZE, each cell in [0, 1]."""
    grid = [[1.0 for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]

    for y in range(GRID_SIZE):
        for x in range(GRID_SIZE):
            c = ice_concentration[y][x]
            grid[y][x] += ICE_RISK_WEIGHT * (c ** 2)

    for (ix, iy) in icebergs:
        for y in range(GRID_SIZE):
            for x in range(GRID_SIZE):
                dist = math.hypot(x - ix, y - iy)
                if dist < ICEBERG_EXCLUSION_RADIUS:
                    falloff = 1.0 - (dist / ICEBERG_EXCLUSION_RADIUS)
                    grid[y][x] += ICEBERG_PENALTY * falloff

    return grid


def _passable(ice_concentration, x, y) -> bool:
    return ice_concentration[y][x] < IMPASSABLE_ICE_THRESHOLD


def _neighbors(x, y):
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            nx, ny = x + dx, y + dy
            if 0 <= nx < GRID_SIZE and 0 <= ny < GRID_SIZE:
                step_cost = math.hypot(dx, dy)
                yield nx, ny, step_cost


def find_route(
    start: Cell,
    goal: Cell,
    ice_concentration: list[list[float]],
    icebergs: Iterable[tuple[float, float]] = (),
) -> tuple[list[Cell], float]:
    cost_grid = build_cost_grid(ice_concentration, icebergs)

    def h(x, y):
        return math.hypot(x - goal.gx, y - goal.gy)

    start_t, goal_t = (start.gx, start.gy), (goal.gx, goal.gy)
    open_set = [(h(*start_t), 0.0, start_t)]
    came_from = {}
    g_score = {start_t: 0.0}
    visited = set()

    while open_set:
        _, g, current = heapq.heappop(open_set)
        if current in visited:
            continue
        visited.add(current)

        if current == goal_t:
            path = [current]
            while path[-1] in came_from:
                path.append(came_from[path[-1]])
            path.reverse()
            return [Cell(gx=x, gy=y) for x, y in path], g_score[goal_t]

        cx, cy = current
        for nx, ny, step_cost in _neighbors(cx, cy):
            if not _passable(ice_concentration, nx, ny):
                continue
            tentative = g + step_cost * cost_grid[ny][nx]
            neighbor = (nx, ny)
            if tentative < g_score.get(neighbor, math.inf):
                g_score[neighbor] = tentative
                came_from[neighbor] = current
                heapq.heappush(open_set, (tentative + h(nx, ny), tentative, neighbor))

    # No path found (e.g. goal walled in by impassable ice) — fall back to a
    # straight line so the frontend always has something to draw.
    steps = 24
    path = [
        Cell(
            gx=round(start.gx + (goal.gx - start.gx) * i / steps),
            gy=round(start.gy + (goal.gy - start.gy) * i / steps),
        )
        for i in range(steps + 1)
    ]
    return path, math.hypot(goal.gx - start.gx, goal.gy - start.gy) * ICE_RISK_WEIGHT
