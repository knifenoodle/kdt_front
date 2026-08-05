"""규칙 엔진 + Gemini 시나리오 생성기를 브라우저에서 테스트해보는 최소 웹 서버.

실행:
    uvicorn webapp.main:app --reload
그 다음 브라우저에서 http://127.0.0.1:8000 접속 (GEMINI_API_KEY 환경변수 필요 -
저장 위치는 사용가이드.md의 "API 키는 어디에 저장되나요" 참고).
"""

import json
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from rule_engine.config import PROMPT_CONFIG_PATH
from rule_engine.rule_engine import RuleEngine
from rule_engine.scenario_generator import generate_scenarios

app = FastAPI(title="시나리오 생성 규칙 엔진 데모")

STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

_engine = None


def _get_engine() -> RuleEngine:
    global _engine
    if _engine is None:
        _engine = RuleEngine()
    return _engine


class GenerateRequest(BaseModel):
    category: str
    num_scenarios: int = Field(default=2, ge=1, le=5)
    age_range: Optional[str] = None


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/categories")
def categories():
    config = json.loads(PROMPT_CONFIG_PATH.read_text(encoding="utf-8"))
    return config["scenario_categories"]


@app.get("/api/rules")
def rules(category: str = Query(...)):
    sections = _get_engine().build_rule_sections(category)
    return {"category": category, "rule_sections": sections}


@app.post("/api/generate")
def generate(req: GenerateRequest):
    try:
        result = generate_scenarios(
            category=req.category,
            num_scenarios=req.num_scenarios,
            age_range=req.age_range,
        )
    except RuntimeError as exc:
        # GEMINI_API_KEY가 없는 경우 등 - 사용자가 바로 이해할 수 있는 오류
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI 호출 중 오류가 발생했습니다: {exc}") from exc

    issues = [
        {"rule_id": issue.rule_id, "field": issue.field, "message": issue.message, "severity": issue.severity}
        for report in result["validation_reports"]
        if not report.is_valid
        for issue in report.issues
    ]
    return {"scenarios": result["scenarios"], "issues": issues}
