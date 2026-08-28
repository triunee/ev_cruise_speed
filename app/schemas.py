"""API 요청/응답 스키마."""
from __future__ import annotations

from pydantic import BaseModel, Field

from .config import SPEED_MAX, SPEED_MIN


class RecommendRequest(BaseModel):
    trip_distance_km: float = Field(100, gt=0, description="목적지까지 거리(km)")

    # 시나리오 조건 — 미입력 시 학습 데이터 중앙값 사용
    ambient_temp_C: float | None = None
    road_grade_pct: float | None = None
    payload_kg: float | None = None
    hvac_power_kw: float | None = None
    battery_temp_C: float | None = None
    tire_pressure_bar: float | None = None
    driving_style_index: float | None = None

    # 속도 스윕 범위 (법정 최고속도 등 반영 가능)
    speed_min_kmh: float = Field(SPEED_MIN, ge=0)
    speed_max_kmh: float = Field(SPEED_MAX, ge=1)

    def scenario(self) -> dict:
        keys = (
            "ambient_temp_C", "road_grade_pct", "payload_kg", "hvac_power_kw",
            "battery_temp_C", "tire_pressure_bar", "driving_style_index",
        )
        return {k: getattr(self, k) for k in keys if getattr(self, k) is not None}


class ModeResult(BaseModel):
    mode: str
    label: str
    energy_tolerance: float
    speed_kmh: int
    speed_kmh_rounded5: int
    energy_kwh_per_100km: float
    total_energy_kwh: float
    time_h: float
    time_min: int
    hit_speed_cap: bool
    delta_time_min_vs_baseline: int
    delta_energy_kwh_vs_baseline: float


class Curve(BaseModel):
    speed_kmh: list[float]
    energy_kwh_per_100km: list[float]
    total_energy_kwh: list[float]
    time_h: list[float]
    energy_budget_by_mode: dict[str, float]


class RecommendResponse(BaseModel):
    model_name: str
    distance_km: float
    baseline_mode: str
    resolved_inputs: dict[str, float]
    modes: list[ModeResult]
    curve: Curve
    warnings: list[str]
