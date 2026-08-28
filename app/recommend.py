"""추천 엔진 — 학습된 전비 모델 위에서 최적 순항 속도를 계산한다.

노트북(§6)의 `predict_speed_profile` / `select_mode_speed` 로직과 동일.
학습은 하지 않고, 저장된 파이프라인을 도구로 사용한다.

선택 방식: 속도만 스윕 → 에너지 최적점(min) 대비 energy_tolerance 만큼의
예산 안에서 가장 빠른 속도를 채택한다. (시간을 목적함수에 섞지 않음)
"""
from __future__ import annotations

import functools

import joblib
import numpy as np
import pandas as pd

from .config import (
    BASELINE_MODE,
    MODEL_PATH,
    MODES,
    SPEED_MAX,
    SPEED_MIN,
    SPEED_STEP,
)


@functools.lru_cache(maxsize=1)
def _load_bundle() -> dict:
    bundle = joblib.load(MODEL_PATH)
    bundle.setdefault("feature_defaults", {})
    return bundle


def model_info() -> dict:
    b = _load_bundle()
    return {
        "model_name": b.get("model_name", "unknown"),
        "features": b["features"],
        "feature_range": b["feature_range"],
        "feature_defaults": b["feature_defaults"],
    }


def clip_inputs(raw: dict) -> tuple[dict, list[str]]:
    """사용자 입력을 학습 데이터 관측 범위로 클리핑. 벗어난 항목은 경고로 반환."""
    b = _load_bundle()
    ranges = b["feature_range"]
    defaults = b["feature_defaults"]
    resolved, warnings = {}, []
    for feat in b["features"]:
        if feat == "speed_kmh":
            continue
        val = raw.get(feat)
        if val is None:
            resolved[feat] = defaults.get(feat)
            continue
        lo, hi = ranges[feat]
        if val < lo or val > hi:
            clipped = min(max(val, lo), hi)
            warnings.append(
                f"{feat}={val:g} 는 학습 범위({lo:g}~{hi:g}) 밖 → {clipped:g} 로 보정"
            )
            val = clipped
        resolved[feat] = float(val)
    return resolved, warnings


def _sweep(resolved: dict, distance_km: float, speed_min: float, speed_max: float):
    b = _load_bundle()
    features = b["features"]
    speeds = np.arange(speed_min, speed_max + 1e-9, SPEED_STEP)
    rows = [
        {**resolved, "speed_kmh": v, "trip_distance_km": distance_km}
        for v in speeds
    ]
    e100 = b["pipeline"].predict(pd.DataFrame(rows)[features])  # kWh/100km
    energy_kwh = e100 * distance_km / 100.0                     # 구간 총 에너지
    time_h = distance_km / speeds                               # 소요 시간
    return speeds, np.asarray(e100, dtype=float), energy_kwh, time_h


def recommend(
    raw_inputs: dict,
    distance_km: float,
    speed_min: float = SPEED_MIN,
    speed_max: float = SPEED_MAX,
) -> dict:
    resolved, warnings = clip_inputs(raw_inputs)

    d_lo, d_hi = _load_bundle()["feature_range"]["trip_distance_km"]
    if distance_km < d_lo or distance_km > d_hi:
        clipped = min(max(distance_km, d_lo), d_hi)
        warnings.append(
            f"trip_distance_km={distance_km:g} 는 학습 범위({d_lo:g}~{d_hi:g}) 밖 → {clipped:g} 로 보정"
        )
        distance_km = clipped

    speeds, e100, energy, time_h = _sweep(resolved, distance_km, speed_min, speed_max)
    min_energy = float(energy.min())
    speed_cap = float(speeds[-1])

    budget_by_mode, mode_results = {}, []
    for key, meta in MODES.items():
        tol = meta["energy_tolerance"]
        budget = min_energy * (1 + tol)
        budget_by_mode[key] = round(budget, 3)

        allowed = np.where(energy <= budget)[0]          # 예산 내 속도 인덱스
        i = int(allowed[np.argmax(speeds[allowed])])     # 그 중 가장 빠른 속도
        mode_results.append({
            "mode": key,
            "label": meta["label"],
            "energy_tolerance": tol,
            "speed_kmh": int(round(speeds[i])),
            "speed_kmh_rounded5": int(round(speeds[i] / 5) * 5),
            "energy_kwh_per_100km": round(float(e100[i]), 2),
            "total_energy_kwh": round(float(energy[i]), 2),
            "time_h": round(float(time_h[i]), 3),
            "time_min": int(round(time_h[i] * 60)),
            "hit_speed_cap": bool(speeds[i] == speed_cap),
        })

    base = next(m for m in mode_results if m["mode"] == BASELINE_MODE)
    for m in mode_results:
        m["delta_time_min_vs_baseline"] = m["time_min"] - base["time_min"]
        m["delta_energy_kwh_vs_baseline"] = round(
            m["total_energy_kwh"] - base["total_energy_kwh"], 2
        )

    return {
        "model_name": _load_bundle().get("model_name", "unknown"),
        "distance_km": distance_km,
        "baseline_mode": BASELINE_MODE,
        "resolved_inputs": {**resolved, "trip_distance_km": distance_km},
        "modes": mode_results,
        "curve": {
            "speed_kmh": [float(s) for s in speeds],
            "energy_kwh_per_100km": [round(float(v), 3) for v in e100],
            "total_energy_kwh": [round(float(v), 3) for v in energy],
            "time_h": [round(float(v), 4) for v in time_h],
            "energy_budget_by_mode": budget_by_mode,
        },
        "warnings": warnings,
    }
