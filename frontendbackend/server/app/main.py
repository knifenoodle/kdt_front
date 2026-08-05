"""또랑 BFF.

`engine/` (우리가 관리하는 규칙 엔진) 을 in-process import 하고,
HTTP 계층 전체(CORS·검증·오류 정규화·헬스체크·타임아웃)를 여기서 담당한다.

실행:
    cd frontendbackend
    ./.venv/bin/uvicorn server.app.main:app --host 127.0.0.1 --port 8100

🚨 --reload 를 쓰지 않는다. 원본 문서(사용가이드.md:188, RULE_ENGINE_README.md:77)가
   비개발자에게 --reload 상시 구동을 안내하지만 디버그 모드를 켠 채 두는 것은 위험하다.
🚨 --host 는 127.0.0.1 로 명시한다. 0.0.0.0/ngrok 으로 노출하는 순간 인증·레이트리밋
   부재(원본 main.py:63-70)의 유일한 완화가 사라진다.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# rule_engine 이 os.environ.get("GEMINI_API_KEY") 를 읽기 전에 .env 를 주입해야 한다.
load_dotenv()

from . import deps, errors
from .adapters.template_deck import (
    IMPLEMENTED_CATEGORIES,
    TemplateDeckAdapter,
)
from .errors import BffError, ErrorCode
from .schemas import SessionRequest, SessionScript

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("ttorang.bff")

# ── 초기화는 import 시점에 한다 ──────────────────────────────────────
# sys.path 삽입이 어떤 `rule_engine` import 보다 먼저 일어나야 하므로 lifespan/startup
# 훅에 맡기지 않는다. (startup 훅은 TestClient 를 context manager 로 쓰지 않으면
# 발화하지 않아, 테스트에서 조용히 폴백 경로만 타는 문제가 실제로 발생했다.)
_init_failed: str | None = None
try:
    deps.init()
except deps.EngineNotFound as exc:
    _init_failed = str(exc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if _init_failed:
        log.error("engine/ 초기화 실패: %s", _init_failed)
    else:
        d = deps.diagnostics()
        log.info(
            "engine/ 연결 OK · 활성 규칙 %s건 · 리트리버 후보 %s · 선택 %s · 탈락 %s · Gemini 키 %s",
            d.get("rules_loaded"), d.get("retriever_pool"), d.get("rules_selected"),
            d.get("rules_dropped_by_top_k"),
            "있음" if d.get("gemini_key_present") else "없음",
        )
        if not d.get("gemini_key_present"):
            log.warning(
                "GEMINI_API_KEY 가 없습니다. /api/session 은 저작 폴백 데크로 200을 반환하며 "
                "아이 화면은 차이를 인지하지 않습니다(설계된 동작). LLM 관통 증명은 보류됩니다."
            )
        if d.get("rules_dropped_by_top_k"):
            log.error("🚨 CS-010: 규칙 %s건이 top_k 컷오프로 탈락 중입니다.",
                      d["rules_dropped_by_top_k"])
    yield


app = FastAPI(
    title="또랑 BFF",
    description="Communication_simulator 규칙 엔진을 만 4~6세 음성 UI 계약으로 변환한다.",
    version="0.1.0",
    lifespan=lifespan,
)

# ── M1: CORS ────────────────────────────────────────────────────────
# 프로덕션/시연에서는 web 정적 산출물을 같은 오리진에서 서브하므로 CORS 가 필요 없다.
# 개발(next dev :3000)에서만 명시적 화이트리스트로 허용한다.
# 🚨 allow_origins=["*"] 를 쓰지 않는다. 원본은 미들웨어 자체가 없는 상태이며
#    그것이 오히려 안전하다 — 되돌리지 말 것.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

errors.install(app)

_adapter = TemplateDeckAdapter()


# ── M6: 헬스체크 ────────────────────────────────────────────────────
@app.get("/api/health")
def health() -> JSONResponse:
    """🚨 키의 값·앞자리·길이를 절대 반환하지 않는다. 존재 여부 boolean 만."""
    d = deps.diagnostics()
    body = {
        "ok": bool(d.get("engine_found")) and _init_failed is None,
        "adapter": _adapter.name,
        "implemented_categories": sorted(IMPLEMENTED_CATEGORIES),
        **d,
    }
    return JSONResponse(status_code=200 if body["ok"] else 503, content=body)


# ── M2 통과: 백엔드 실측 형태 그대로 ─────────────────────────────────
@app.get("/api/categories")
def categories() -> dict:
    """[백엔드 실측] 래퍼 없는 bare object. 형태를 바꾸지 않는다.

    /__dev 하네스 전용이다 — 제품 경로에서 아이는 주제를 고르지 않는다
    (uiux기획/CLAUDE.md:47 글자 없이 작동, :54 한 화면 한 행동).
    """
    if _init_failed:
        raise BffError(ErrorCode.UPSTREAM_UNAVAILABLE, _init_failed, status_code=503)
    import json

    from rule_engine.scenario_generator import PROMPT_CONFIG_PATH

    return json.loads(PROMPT_CONFIG_PATH.read_text(encoding="utf-8"))["scenario_categories"]


# ── 세션 진입점 ─────────────────────────────────────────────────────
@app.post("/api/session", response_model=SessionScript)
async def session(req: SessionRequest) -> SessionScript:
    """🚨 핵심 계약: 이 엔드포인트는 상류 실패로 실패하지 않는다.

    키 부재·빈 배열·타임아웃·상류 예외 전부 저작 폴백 데크로 SessionScript 를
    완성해 200 을 반환하며, 사유는 source.fallback_reason 에만 남는다.
    아이 화면은 백엔드 실패를 인지할 수 없어야 한다 — 1단계 합격선이다.

    예외 2가지(아이가 도달하지 않는 경로):
      - engine/ 미발견 → 503 (개발 환경 구성 오류)
      - 미구현 카테고리 → 501. 다른 카테고리 내용을 조용히 내보내지 않는다
    """
    if _init_failed:
        raise BffError(ErrorCode.UPSTREAM_UNAVAILABLE, _init_failed, status_code=503)

    if req.category not in IMPLEMENTED_CATEGORIES:
        raise BffError(
            ErrorCode.CATEGORY_NOT_IMPLEMENTED,
            f"'{req.category}' 는 1단계 저작 데크가 없습니다. "
            f"구현: {sorted(IMPLEMENTED_CATEGORIES)}. docs/01_인터페이스_계약서.md §6-2 참조.",
            status_code=501,
        )

    return await _adapter.build(req)
