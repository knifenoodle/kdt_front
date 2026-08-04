"""BFF 단일 오류 봉투.

🚨 계약의 일부: 이 봉투의 문자열은 아이 화면에 절대 도달하지 않는다.
`uiux기획/CLAUDE.md:81` — "빨강은 오류 표시에 쓰지 않는다. 아이 화면에 오류 색 자체가 없다."
오류가 없는 게 아니라 오류 *표현*이 없다. 이 봉투는 /api/health 와 /__dev 경로에만 나타난다.

원본이 두 가지 호환되지 않는 오류 형태를 낸다(M3, 실측 근거 contracts/backend-observed/):
  422 → {"detail": [ {...} ]}      배열
  500 → {"detail": "GEMINI_API_KEY …"}  문자열
  502 → {"detail": "AI 호출 중 오류가 …: {exc}"}  문자열 + SDK 예외 원문 누출
BFF 가 셋을 모두 흡수해 아래 하나로 정규화한다.
"""

from __future__ import annotations

from enum import Enum

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorCode(str, Enum):
    INVALID_CATEGORY = "INVALID_CATEGORY"
    INVALID_REQUEST = "INVALID_REQUEST"
    # 1단계는 ownership_turn 만 저작 데크를 갖는다. 나머지 3종은 조용히 다른 카테고리의
    # 내용을 내보내는 대신 명시적으로 거부한다 — 잘못된 내용을 아이에게 주는 것보다 낫다.
    # 아이는 이 경로에 도달하지 않는다(카테고리 선택은 /__dev 하네스 전용).
    CATEGORY_NOT_IMPLEMENTED = "CATEGORY_NOT_IMPLEMENTED"
    UPSTREAM_UNAVAILABLE = "UPSTREAM_UNAVAILABLE"
    UPSTREAM_TIMEOUT = "UPSTREAM_TIMEOUT"
    UPSTREAM_ERROR = "UPSTREAM_ERROR"
    INTERNAL = "INTERNAL"


class ErrorEnvelope(BaseModel):
    ok: bool = False
    code: ErrorCode
    message_for_dev: str
    correlation_id: str


class BffError(Exception):
    def __init__(self, code: ErrorCode, message_for_dev: str, status_code: int = 400):
        self.code = code
        self.message_for_dev = message_for_dev
        self.status_code = status_code
        super().__init__(message_for_dev)


def _correlation_id() -> str:
    """요청 상관 ID. 아동 식별정보를 포함하지 않는다."""
    import uuid

    return uuid.uuid4().hex[:8]


def envelope(code: ErrorCode, message_for_dev: str) -> dict:
    return ErrorEnvelope(
        code=code, message_for_dev=message_for_dev, correlation_id=_correlation_id()
    ).model_dump(mode="json")


def install(app) -> None:
    """예외 핸들러 등록. 원본의 두 detail 형태를 단일 봉투로 흡수한다."""

    @app.exception_handler(BffError)
    async def _bff_error(request: Request, exc: BffError):
        return JSONResponse(
            status_code=exc.status_code, content=envelope(exc.code, exc.message_for_dev)
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        # 원본은 여기서 detail=배열을 낸다. 배열을 사람이 읽을 한 줄로 접는다.
        parts = []
        for err in exc.errors():
            loc = ".".join(str(x) for x in err.get("loc", []))
            parts.append(f"{loc}: {err.get('msg')}")
        return JSONResponse(
            status_code=422,
            content=envelope(ErrorCode.INVALID_REQUEST, " / ".join(parts) or "요청 형식 오류"),
        )

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        # 🚨 SDK 예외 원문을 클라이언트로 흘리지 않는다.
        # 원본 webapp/main.py:74-75 는 f"…: {exc}" 로 그대로 노출한다(엔드포인트·모델 메타 누출).
        cid = _correlation_id()
        import logging

        logging.getLogger("ttorang.bff").exception("unhandled [%s]", cid)
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "code": ErrorCode.INTERNAL.value,
                "message_for_dev": f"서버 내부 오류. 상세는 서버 로그의 상관 ID {cid} 를 확인하세요.",
                "correlation_id": cid,
            },
        )
