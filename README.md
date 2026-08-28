# EV 최적 순항 속도 추천 대시보드

머신러닝 회귀 모델로 **주행 조건별 전비(kWh/100km)**를 예측하고,
운전자가 선택한 모드(에코/노멀/스포츠)의 **에너지–시간 가중치(α)**에 따라
가장 합리적인 타협점이 되는 **최적 순항 속도**를 계산하는 FastAPI 대시보드.

- 예측 모델: XGBoost (holdout R² ≈ 0.945)
- 처방: `cost(v) = α·Ê(v) + (1−α)·T̂(v)` 를 최소화하는 속도 탐색 (α: 에코 0.65 / 노멀 0.40 / 스포츠 0.15)
- 상세 기획: `ev_optimal_speed_project_plan.md`

## 실행

```bash
uv venv
uv pip install -r requirements.txt
uv run uvicorn app.main:app --reload
```

→ http://127.0.0.1:8000 (API 문서: `/docs`)

## 구조

```
app/
  main.py        FastAPI 앱 · 라우트
  config.py      모드→α, 속도 범위, 입력 패널 정의
  recommend.py   추천 엔진 (속도 스윕 + 목적함수 최소화)
  schemas.py     Pydantic 요청/응답
  templates/index.html
  static/app.js, style.css   (외부 CDN 없음)
model/ev_energy_model.joblib  전처리+모델 일체형 파이프라인
data/ev_energy_consumption.csv
notebooks/ev_energy_pj.ipynb  분석 전 과정 (EDA → 모델링 → 최적화)
train.py         모델 재생성 스크립트
```

## API

| 경로 | 설명 |
|---|---|
| `GET /` | 대시보드 |
| `POST /api/recommend` | 조건 + 거리 → 모드별 최적 속도 · `cost(v)` 곡선 · 경고 |
| `GET /health` | 상태 확인 |

`POST /api/recommend` 요청 예:

```json
{ "trip_distance_km": 150, "ambient_temp_C": -3, "road_grade_pct": 3,
  "payload_kg": 150, "hvac_power_kw": 3.0 }
```

미입력 조건은 학습 데이터 중앙값으로 채우고, 관측 범위 밖 값은 클리핑 후 `warnings`로 알린다.

## 모델 재생성

라이브러리 버전이 바뀌어 `model/ev_energy_model.joblib` 로드가 실패하면:

```bash
uv run python train.py
```

## 한계

- 교육용/정제 데이터 · 단일 차종 가정. 추천 속도는 학습 조건 분포 내에서만 유효.
- `speed_kmh`(구간 평균 속도)를 순항 속도로 해석하는 가정.
- α는 팀 설계값 (모드 정의). 법정 최고속도·교통 흐름은 별도 반영 필요.
