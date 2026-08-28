"""FastAPI 대시보드 — 주행 모드별 맞춤 최적 순항 속도 추천."""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request

from .config import ADVANCED_INPUTS, BASIC_INPUTS, MODES, SPEED_MAX, SPEED_MIN
from .recommend import model_info, recommend
from .schemas import RecommendRequest, RecommendResponse

BASE = Path(__file__).parent
app = FastAPI(title="EV 최적 순항 속도 추천", version="1.0")
app.mount("/static", StaticFiles(directory=BASE / "static"), name="static")
templates = Jinja2Templates(directory=BASE / "templates")


@app.get("/health")
def health() -> dict:
    info = model_info()
    return {"status": "ok", "model": info["model_name"]}


@app.post("/api/recommend", response_model=RecommendResponse)
def api_recommend(req: RecommendRequest) -> RecommendResponse:
    result = recommend(
        raw_inputs=req.scenario(),
        distance_km=req.trip_distance_km,
        speed_min=req.speed_min_kmh,
        speed_max=req.speed_max_kmh,
    )
    return RecommendResponse(**result)


@app.get("/")
def index(request: Request):
    info = model_info()
    ranges = info["feature_range"]
    defaults = info["feature_defaults"]

    def decorate(items):
        out = []
        for it in items:
            lo, hi = ranges[it["key"]]
            out.append({**it, "min": lo, "max": hi, "default": defaults[it["key"]]})
        return out

    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "model_name": info["model_name"],
            "basic_inputs": decorate(BASIC_INPUTS),
            "advanced_inputs": decorate(ADVANCED_INPUTS),
            "modes": MODES,
            "speed_min": SPEED_MIN,
            "speed_max": SPEED_MAX,
        },
    )
