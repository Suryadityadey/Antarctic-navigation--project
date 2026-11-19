"""
Iceberg drift velocity = physics base drift + ML residual correction.

The physics core is the standard simplified iceberg momentum balance used as
the "physics fallback" mentioned in the pitch deck: a fraction of the ocean
current (assumed ~100% coupling) plus a wind-drag term (~2% of wind speed,
deflected by a small Coriolis-driven turning angle in the Southern
Hemisphere). This alone keeps the system operating if the ML model or
satellite feed is degraded.

weights/iceberg_residual_model.pkl is a scikit-learn
MultiOutputRegressor(GradientBoostingRegressor) trained to predict the
*residual* (what physics alone gets wrong) from 6 features, in this order:

    [lat, lon, cur_u, cur_v, wind_u, wind_v]

and it outputs 2 targets, in this order:

    [resid_east, resid_north]   (m/s)

Final velocity = physics base + ML residual.
"""
import math
from dataclasses import dataclass

import joblib
import numpy as np

WIND_DRAG_COEFF = 0.02       # ~2% of wind speed, standard iceberg drift approximation
CURRENT_COUPLING = 1.0       # icebergs are assumed to move ~1:1 with surface current
CORIOLIS_DEFLECTION_DEG = -20.0  # Southern Hemisphere: wind-driven drift deflects left


@dataclass
class DriftPrediction:
    resid_east: float
    resid_north: float
    base_east: float
    base_north: float
    total_east: float
    total_north: float


class IcebergDriftModel:
    def __init__(self, weights_path: str):
        self._model = joblib.load(weights_path)

    @staticmethod
    def _physics_base(cur_u, cur_v, wind_u, wind_v) -> tuple[float, float]:
        # Current contribution
        base_e = CURRENT_COUPLING * cur_u
        base_n = CURRENT_COUPLING * cur_v

        # Wind contribution, deflected by the Coriolis turning angle
        theta = math.radians(CORIOLIS_DEFLECTION_DEG)
        wind_e = WIND_DRAG_COEFF * (wind_u * math.cos(theta) - wind_v * math.sin(theta))
        wind_n = WIND_DRAG_COEFF * (wind_u * math.sin(theta) + wind_v * math.cos(theta))

        return base_e + wind_e, base_n + wind_n

    def predict(self, lat, lon, cur_u, cur_v, wind_u, wind_v) -> DriftPrediction:
        features = np.array([[lat, lon, cur_u, cur_v, wind_u, wind_v]])
        resid_east, resid_north = self._model.predict(features)[0]

        base_e, base_n = self._physics_base(cur_u, cur_v, wind_u, wind_v)

        return DriftPrediction(
            resid_east=float(resid_east),
            resid_north=float(resid_north),
            base_east=float(base_e),
            base_north=float(base_n),
            total_east=float(base_e + resid_east),
            total_north=float(base_n + resid_north),
        )


def load_iceberg_model(weights_path: str) -> IcebergDriftModel:
    return IcebergDriftModel(weights_path)
