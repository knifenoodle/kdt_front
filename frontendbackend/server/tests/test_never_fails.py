"""🚨 1단계 합격선: API 키가 죽어도 아이 화면이 아무 차이 없이 끝까지 돈다.

`/api/session` 은 상류 실패로 실패하지 않는다. 키 부재·빈 배열·타임아웃·상류 예외
전부 저작 폴백 데크로 SessionScript 를 완성해 200 을 반환하며, 사유는
`source.fallback_reason` 에만 남는다.

여기가 진짜 검증이다 — 정상 경로는 쉽고, 부정 경로가 시연을 죽인다.
"""

from __future__ import annotations

import asyncio
import time

import pytest
from fastapi.testclient import TestClient

from server.app.main import app

REQ = {"category": "ownership_turn", "age_band": "5", "scene": "kids"}

VALID_SCENARIO = {
    "category": "ownership_turn",
    "scenario_title": "내 블록 돌려줘",
    "background": "놀이터에서 블록을 쌓고 있어.",
    "conflict_trigger": "친구가 블록을 가져간다",
    "learning_goal": "싫다고 말하기",
    "ai_first_message": "그 블록 나 줘. 빨리!",
}


class _Report:
    def __init__(self, is_valid, issues=()):
        self.is_valid = is_valid
        self.issues = list(issues)


class _Issue:
    def __init__(self, rule_id, field, message, severity):
        self.rule_id, self.field, self.message, self.severity = rule_id, field, message, severity


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _patch_upstream(monkeypatch, fn):
    import rule_engine.scenario_generator as sg

    monkeypatch.setattr(sg, "generate_scenarios", fn)


def _assert_complete(script: dict, expected_reason):
    """어떤 폴백 경로에서도 세션은 완전해야 한다."""
    assert len(script["turns"]) == 3
    assert script["retry_max"] == 2
    assert script["lines"]["ai_disclosure"]["t"]
    for turn in script["turns"]:
        for slot in ("ask", "hint", "sup1", "sup2", "back"):
            assert turn[slot]["t"], f"{slot} 이 비어 있습니다"
    assert script["source"]["fallback_reason"] == expected_reason


# ── 부정 경로 4종 ────────────────────────────────────────────────────
def test_no_api_key(client, monkeypatch):
    """키가 없어도 200 + 완전한 세션.

    주변 환경에 실제 키가 있든 없든 같은 결과가 나오도록 상류를 명시적으로
    '키 없음' 상태로 만든다 — 테스트가 환경에 의존하면 CI 와 로컬이 갈린다.
    """
    def no_key(**kw):
        raise RuntimeError(
            "GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다. "
            "사용가이드.md의 'API 키는 어디에 저장되나요' 항목을 참고해 설정하세요."
        )

    _patch_upstream(monkeypatch, no_key)
    r = client.post("/api/session", json=REQ)
    assert r.status_code == 200
    s = r.json()
    _assert_complete(s, "no_api_key")
    assert s["source"]["backend_scenario_present"] is False


def test_empty_scenarios_is_not_an_error(client, monkeypatch):
    """🚨 [백엔드 실측] scenarios == [] 인데 HTTP 200 인 정상 동작(M4).

    scenario_generator.py:143 이 valid_scenarios[:n] 을 반환하므로 모든 후보가
    검증 탈락하면 빈 배열이 나온다. 오류로 승격하지 않는다.
    """
    def fake(**kw):
        return {
            "scenarios": [],
            "validation_reports": [
                _Report(False, [_Issue("LEGAL-001", "content", "금지 키워드 '때려' 감지됨.", "critical")])
            ],
        }

    _patch_upstream(monkeypatch, fake)
    r = client.post("/api/session", json=REQ)
    assert r.status_code == 200
    s = r.json()
    _assert_complete(s, "empty_scenarios")
    # issues 는 보호자가 아니라 개발자에게만 간다
    assert s["parent_meta"]["dev_issues"][0]["rule_id"] == "LEGAL-001"


def test_upstream_timeout(client, monkeypatch):
    from server.app.adapters import template_deck

    monkeypatch.setattr(template_deck, "UPSTREAM_TIMEOUT_SEC", 0.05)

    def slow(**kw):
        time.sleep(1.0)
        return {"scenarios": [VALID_SCENARIO], "validation_reports": []}

    _patch_upstream(monkeypatch, slow)
    r = client.post("/api/session", json=REQ)
    assert r.status_code == 200
    _assert_complete(r.json(), "timeout")


def test_upstream_exception(client, monkeypatch):
    """502 를 유발하는 상류 예외(SDK 오류·JSONDecodeError·KeyError)."""
    def boom(**kw):
        raise KeyError("scenarios")

    _patch_upstream(monkeypatch, boom)
    r = client.post("/api/session", json=REQ)
    assert r.status_code == 200
    _assert_complete(r.json(), "upstream_error")


# ── 정상 경로: 주입이 정확한가 ───────────────────────────────────────
def test_ai_first_message_is_injected_verbatim(client, monkeypatch):
    """🚨 수직 슬라이스의 증명 대상: 어댑터가 LLM 문장을 손대지 않았는가.

    turns[0].ask.t 가 백엔드 ai_first_message 와 **문자 단위로 동일**해야 한다.
    """
    _patch_upstream(monkeypatch, lambda **kw: {"scenarios": [VALID_SCENARIO], "validation_reports": []})
    s = client.post("/api/session", json=REQ).json()

    assert s["turns"][0]["ask"]["t"] == VALID_SCENARIO["ai_first_message"]
    assert s["source"]["backend_scenario_present"] is True
    assert s["source"]["fallback_reason"] is None
    assert "ai_first_message" in s["source"]["backend_fields_used"]

    # 나머지 2턴의 ask 는 저작 데크에서 온다 (백엔드는 첫 대사 1줄만 emit)
    assert s["turns"][1]["ask"]["t"] == "조금만… 잠깐만 빌려주면 안 돼?"

    # parent_meta 는 백엔드 값으로 채워지되 아이 화면에는 가지 않는다
    assert s["parent_meta"]["scenario_title"] == VALID_SCENARIO["scenario_title"]


def test_overlong_line_falls_back_instead_of_truncating(client, monkeypatch):
    """🚨 아이가 듣는 문장을 중간에서 자르지 않는다. 저작 폴백을 쓴다.

    Line.t 의 max_length(120) 를 넘는 ai_first_message 가 오면 Pydantic 이 던지므로
    어댑터가 미리 걸러야 세션이 실패하지 않는다(어댑터는 예외를 던지지 않는다는 계약).
    """
    long_scenario = dict(VALID_SCENARIO, ai_first_message="가" * 200)
    _patch_upstream(monkeypatch, lambda **kw: {"scenarios": [long_scenario], "validation_reports": []})

    r = client.post("/api/session", json=REQ)
    assert r.status_code == 200
    s = r.json()
    assert s["turns"][0]["ask"]["t"] == "그거 나 줘. 지금 당장!"       # 저작 폴백
    assert "가가가" not in s["turns"][0]["ask"]["t"]                    # 잘라 쓰지 않았다
    assert "ai_first_message" not in s["source"]["backend_fields_used"]  # 정직하게 기록


def test_age_band_is_translated_to_a_server_defined_label(client, monkeypatch):
    """🚨 CS-005 경계: 사용자 문자열이 system_instruction 에 도달하지 않는다.

    age_band('5') 는 서버 정의 라벨로만 번역되어 상류에 전달된다.
    """
    captured = {}

    def capture(**kw):
        captured.update(kw)
        return {"scenarios": [VALID_SCENARIO], "validation_reports": []}

    _patch_upstream(monkeypatch, capture)
    client.post("/api/session", json=REQ)

    from server.app.adapters.template_deck import AGE_RANGE_LABEL

    assert captured["age_range"] == AGE_RANGE_LABEL["5"]
    assert captured["age_range"] in AGE_RANGE_LABEL.values()
    assert "초등" not in captured["age_range"]
    assert captured["category"] in {"ownership_turn", "physical_boundary",
                                    "verbal_discomfort", "rule_violation"}
