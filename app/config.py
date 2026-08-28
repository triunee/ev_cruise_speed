"""서비스 상수. 모드 → α 매핑과 속도 스윕 범위 등."""
from pathlib import Path

ROOT = Path(__file__).parent.parent
MODEL_PATH = ROOT / "model" / "ev_energy_model.joblib"

# 주행 모드 → α (에너지 가중치). 기획 보고서 §6-2 참조.
#   α ↑  → 에너지 절약 우선 → 저속 추천
#   α ↓  → 도달 시간 우선   → 고속 추천
MODES = {
    "eco":    {"label": "에코",   "alpha": 0.65},
    "normal": {"label": "노멀",   "alpha": 0.40},
    "sport":  {"label": "스포츠", "alpha": 0.15},
}
BASELINE_MODE = "normal"  # 트레이드오프 비교 기준

# 속도 스윕 기본 범위(km/h). 학습 데이터 관측 범위와 동일.
SPEED_MIN = 20.0
SPEED_MAX = 130.0
SPEED_STEP = 1.0

# UI 입력 패널 구성 (기본/고급). key 는 모델 feature 명.
BASIC_INPUTS = [
    {"key": "trip_distance_km", "label": "목적지까지 거리", "unit": "km",  "step": 1},
    {"key": "ambient_temp_C",   "label": "외기 온도",       "unit": "℃",  "step": 1},
    {"key": "road_grade_pct",   "label": "도로 경사도",     "unit": "%",   "step": 0.5},
    {"key": "payload_kg",       "label": "적재 하중",       "unit": "kg",  "step": 10},
    {"key": "hvac_power_kw",    "label": "냉난방 전력",     "unit": "kW",  "step": 0.1},
]
ADVANCED_INPUTS = [
    {"key": "battery_temp_C",      "label": "배터리 온도",   "unit": "℃",  "step": 1},
    {"key": "tire_pressure_bar",   "label": "타이어 공기압", "unit": "bar", "step": 0.05},
    {"key": "driving_style_index", "label": "운전 성향",     "unit": "0~1", "step": 0.05},
]
