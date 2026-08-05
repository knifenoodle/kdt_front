"""레벨시스템 v1.2 §2-3 — 레벨×변이 9종 데크 검증.

참고자료/레벨시스템 심화기획안 v1.2.md 기준으로 저작한
`server/app/deck/ownership_turn/l{level}_v{variation}.json` 9개가
전부 계약(contracts/session-script.schema.json)을 만족하는지, 그리고
레벨/변이가 응답에 그대로 반영되는지 검증한다.

레거시 경로(level/variation 생략)는 `test_never_fails.py`·`test_contract.py`가
이미 고정하고 있으므로 여기서는 건드리지 않는다.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from server.app.main import app

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = PROJECT_ROOT / "contracts" / "session-script.schema.json"

LEVELS = ("1", "2", "3")
VARIATIONS = ("1", "2", "3")
COMBOS = [(l, v) for l in LEVELS for v in VARIATIONS]


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def schema() -> dict:
    s = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(s)
    return s


@pytest.mark.parametrize("level,variation", COMBOS)
def test_level_variation_deck_validates_against_schema(client, schema, level, variation):
    r = client.post(
        "/api/session",
        json={"category": "ownership_turn", "age_band": "5", "scene": "kids", "level": level, "variation": variation},
    )
    assert r.status_code == 200
    body = r.json()
    errors = sorted(Draft202012Validator(schema).iter_errors(body), key=lambda e: e.path)
    assert not errors, [e.message for e in errors]
    assert body["level"] == level
    assert body["variation"] == variation
    # 3턴 고정 + 감정 궤적 불변식(캐릭터_가이드_v1.md §5) — 완화 방향만 허용.
    assert [t["emo"] for t in body["turns"]] == ["angry", "sad", "shy"]
    assert [t["back_emo"] for t in body["turns"]] == ["surprised", "none", "joy"]


def test_legacy_path_unaffected_when_level_omitted(client):
    """level/variation을 생략하면 기존 레거시 데크와 100% 동일하게 동작해야 한다."""
    r = client.post("/api/session", json={"category": "ownership_turn", "age_band": "5", "scene": "kids"})
    assert r.status_code == 200
    body = r.json()
    assert body["level"] is None
    assert body["variation"] is None
    # 레거시 파일의 turns[1].ask 고정 문자열(test_never_fails.py:151과 동일 근거)
    assert body["turns"][1]["ask"]["t"] == "조금만… 잠깐만 빌려주면 안 돼?"
