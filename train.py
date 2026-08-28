"""전비 예측 모델 학습 → model/ev_energy_model.joblib 생성.

노트북(notebooks/ev_energy_pj.ipynb)의 모델링 단계를 스크립트로 옮긴 것.
라이브러리 버전이 바뀌어 기존 joblib 로드가 안 될 때 재생성용.
"""
from pathlib import Path

import joblib
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from xgboost import XGBRegressor

ROOT = Path(__file__).parent
DATA = ROOT / "data" / "ev_energy_consumption.csv"
OUT = ROOT / "model" / "ev_energy_model.joblib"

TARGET = "energy_consumption_kwhper100km"
XGB_PARAMS = dict(
    n_estimators=600, max_depth=3, learning_rate=0.03,
    subsample=0.9, colsample_bytree=0.9, random_state=42, n_jobs=-1,
)


def main() -> None:
    df = pd.read_csv(DATA)
    features = [c for c in df.columns if c != TARGET]
    X, y = df[features], df[TARGET]

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)
    pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("model", XGBRegressor(**XGB_PARAMS)),
    ])
    pipe.fit(X_tr, y_tr)
    print(f"holdout R^2 = {pipe.score(X_te, y_te):.4f}")

    # 서비스 배포용: 전체 데이터로 재학습
    pipe_full = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("model", XGBRegressor(**XGB_PARAMS)),
    ]).fit(X, y)

    bundle = {
        "pipeline": pipe_full,
        "model_name": "XGBoost",
        "features": features,
        "feature_range": {c: (float(df[c].min()), float(df[c].max())) for c in features},
        "feature_defaults": {c: float(df[c].median()) for c in features},
    }
    OUT.parent.mkdir(exist_ok=True)
    joblib.dump(bundle, OUT)
    print(f"saved -> {OUT}")


if __name__ == "__main__":
    main()
