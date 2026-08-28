"""서비스 상수. 모드 → energy_tolerance 매핑과 속도 스윕 범위 등."""
from pathlib import Path

ROOT = Path(__file__).parent.parent
MODEL_PATH = ROOT / "model" / "ev_energy_model.joblib"

# 주행 모드 → energy_tolerance (에너지 허용 초과율). 기획 보고서 §6-2 참조.
#   tol ↑ → 에너지를 더 써도 됨 → 고속 추천
#   tol ↓ → 에너지 최적점에 근접 → 저속 추천
# 전비가 속도에 단조 증가 → 총에너지도 단조 증가 → 에너지 최소점은 최저속도.
# 전체 속도구간 에너지 폭이 ~25%뿐이라 tol은 민감함 (유효 범위 대략 0.03~0.22).
MODES = {
    "eco":    {"label": "에코",   "energy_tolerance": 0.05},
    "normal": {"label": "노멀",   "energy_tolerance": 0.12},
    "sport":  {"label": "스포츠", "energy_tolerance": 0.20},
}
BASELINE_MODE = "normal"  # 트레이드오프 비교 기준

# 속도 스윕 기본 범위(km/h). 학습 데이터 관측 범위와 동일.
SPEED_MIN = 20.0
SPEED_MAX = 130.0
SPEED_STEP = 1.0

# UI 입력 패널 구성 (기본/고급). key 는 모델 feature 명.
BASIC_INPUTS = [
    {"key": "trip_distance_km", "label": "목적지까지 거리", "unit": "km",  "step": 1,   "hint": "출발지에서 도착지까지"},
    {"key": "ambient_temp_C",   "label": "바깥 기온",       "unit": "℃",  "step": 1,   "hint": "낮을수록 전비가 나빠져요"},
    {"key": "road_grade_pct",   "label": "도로 경사",       "unit": "%",   "step": 0.5, "hint": "오르막 +, 내리막 −"},
    {"key": "payload_kg",       "label": "싣는 무게",       "unit": "kg",  "step": 10,  "hint": "사람 + 짐 합계"},
    {"key": "hvac_power_kw",    "label": "냉·난방 세기",    "unit": "kW",  "step": 0.1, "hint": "히터·에어컨 소비 전력"},
]
ADVANCED_INPUTS = [
    {"key": "battery_temp_C",      "label": "배터리 온도",   "unit": "℃",  "step": 1},
    {"key": "tire_pressure_bar",   "label": "타이어 공기압", "unit": "bar", "step": 0.05},
    {"key": "driving_style_index", "label": "운전 성향",     "unit": "0~1", "step": 0.05},
]
