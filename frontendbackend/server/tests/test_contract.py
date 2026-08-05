"""계약 테스트 — BFF 응답이 contracts/ 의 정본과 일치하는가."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from server.app.main import app
from server.app.schemas import SessionRequest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = PROJECT_ROOT / "contracts" / "session-script.schema.json"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def script(client) -> dict:
    r = client.post("/api/session", json={"category": "ownership_turn", "age_band": "5", "scene": "kids"})
    assert r.status_code == 200
    return r.json()


def test_session_script_validates_against_json_schema(script):
    """🚨 Pydantic 모델과 JSON Schema 정본이 어긋나지 않는가.

    contracts/session-script.schema.json 이 단일 진실 원천이고
    server/app/schemas.py 는 그 미러다. 둘이 갈라지면 여기서 잡힌다.
    """
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    errors = sorted(Draft202012Validator(schema).iter_errors(script), key=lambda e: e.path)
    assert not errors, "\n".join(f"{list(e.path)}: {e.message}" for e in errors)


# ── M7: 아동 식별정보 필드 부재 ──────────────────────────────────────
PII_FIELDS = [
    "name", "nickname", "birthdate", "birth_year", "birthday",
    "child_id", "school", "grade", "gender", "phone", "email", "age",
]


@pytest.mark.parametrize("field", PII_FIELDS)
def test_request_rejects_pii_fields(client, field):
    """🚨 M7: 아동 식별정보를 스키마 차원에서 받지 않는가.

    uiux기획/CLAUDE.md:107 — "아이 온보딩에서 이름·생년월일을 받지 않는다.
    필요한 건 연령대(4/5/6세)뿐."
    extra='forbid' 이므로 이 필드를 보내면 422 로 거부되어야 한다.
    """
    r = client.post(
        "/api/session",
        json={"category": "ownership_turn", "age_band": "5", field: "x"},
    )
    assert r.status_code == 422, f"{field} 가 조용히 수용되었습니다"


@pytest.mark.parametrize("field", PII_FIELDS)
def test_request_model_has_no_pii_field(field):
    assert field not in SessionRequest.model_fields


def test_age_is_a_band_not_a_number():
    """연령은 '4'|'5'|'6' 밴드다. 정수 나이·생년월일을 받지 않는다."""
    # level/variation = 레벨시스템 v1.2 §2-3 신설 필드(둘 다 Optional, PII 아님).
    assert set(SessionRequest.model_fields) == {"category", "age_band", "scene", "level", "variation"}


# ── M2: 카테고리 enum 강제 ───────────────────────────────────────────
def test_bogus_category_is_rejected(client):
    """🚨 CS-005: 원본은 미지 카테고리에 200 을 주지만(rules.bogus.200.json 실측)
    BFF 는 막는다. 사용자 문자열이 system_instruction 에 도달하는 경로를 차단한다.
    """
    r = client.post("/api/session", json={"category": "bogus", "age_band": "5"})
    assert r.status_code == 422


def test_error_envelope_shape(client):
    """M3: 오류가 단일 봉투로 정규화되는가. 원본의 detail=배열/문자열 이원화를 흡수."""
    r = client.post("/api/session", json={"category": "bogus", "age_band": "5"})
    body = r.json()
    assert set(body) == {"ok", "code", "message_for_dev", "correlation_id"}
    assert body["ok"] is False
    assert isinstance(body["message_for_dev"], str)


def test_unimplemented_category_is_explicit_not_silent(client):
    """1단계 미구현 카테고리는 다른 카테고리 내용을 조용히 내보내지 않는다."""
    r = client.post("/api/session", json={"category": "verbal_discomfort", "age_band": "5"})
    assert r.status_code == 501
    assert r.json()["code"] == "CATEGORY_NOT_IMPLEMENTED"


# ── 백엔드 실측 형태 보존 ────────────────────────────────────────────
def test_categories_passthrough_is_bare_object(client):
    """[백엔드 실측] 래퍼를 추가하지 않는다. contracts/backend-observed/categories.200.json 과 동일."""
    body = client.get("/api/categories").json()
    observed = json.loads(
        (PROJECT_ROOT / "contracts" / "backend-observed" / "categories.200.json").read_text(encoding="utf-8")
    )["body"]
    assert body == observed


def test_health_never_leaks_the_key(client):
    """🚨 키의 값·앞자리·길이를 반환하지 않는다. 존재 여부 boolean 만."""
    body = client.get("/api/health").json()
    assert isinstance(body["gemini_key_present"], bool)
    blob = json.dumps(body, ensure_ascii=False)
    assert "AIzaSy" not in blob
    for k in ("gemini_api_key", "api_key", "key_prefix", "key_length"):
        assert k not in blob.lower()
