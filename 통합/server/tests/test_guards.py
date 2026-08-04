"""가드 테스트 — 상류 변경이 조용히 안전장치를 무력화하는 것을 잡는다.

이 파일의 테스트가 깨지면 "상류가 바뀌었으니 seam 을 재검토하라"는 신호다.
테스트를 고쳐서 통과시키지 말 것.
"""

from __future__ import annotations

import json

import pytest

from server.app import deps


@pytest.fixture(scope="module", autouse=True)
def _init():
    deps.init()


def test_prompt_config_seam_attribute_exists():
    """🚨 오버라이드 seam 이 살아 있는가.

    `scenario_generator.py:21` 이 `from .config import PROMPT_CONFIG_PATH` 로
    import 시점에 바인딩하기 때문에 모듈 속성 교체가 성립한다.
    상류가 `from . import config` + `config.PROMPT_CONFIG_PATH` 로 바꾸면
    오버라이드가 조용히 무력화되고 7~9세 프롬프트로 복귀한다.
    """
    from rule_engine import scenario_generator

    assert hasattr(scenario_generator, "PROMPT_CONFIG_PATH"), (
        "상류가 import 스타일을 변경했습니다. deps._apply_prompt_config_override() 재검토 필요."
    )
    assert scenario_generator.PROMPT_CONFIG_PATH == deps.VENDORED_PROMPT_CONFIG


def test_age_override_actually_reaches_the_prompt():
    """벤더링이 문서상이 아니라 실제 시스템 프롬프트에 반영되는가 (D1)."""
    from rule_engine.scenario_generator import _load_prompt_config

    cfg = _load_prompt_config()
    assert "7~9세" not in cfg["system_role"]
    assert "초등" not in cfg["system_role"]
    assert "만 4~6세" in cfg["system_role"]


def test_backend_category_keys_are_untouched():
    """🚨 백엔드 절대 기준: 카테고리 4키와 라벨 문자열을 리네이밍하지 않았는가.

    벤더링 사본이 원본과 이 부분에서 한 글자라도 다르면 실패한다.
    """
    from rule_engine.scenario_generator import _load_prompt_config

    original = json.loads(
        (deps.UPSTREAM_ROOT / "prompts" / "prompt_config.json").read_text(encoding="utf-8")
    )
    vendored = _load_prompt_config()
    assert vendored["scenario_categories"] == original["scenario_categories"]
    assert vendored["user_instruction_template"] == original["user_instruction_template"]


def test_cs003_rules_are_active_and_reach_the_prompt():
    """🚨 CS-003: 가르치지 않은 규칙으로 처벌하던 비대칭이 해소되었는가.

    ETH-002(수치심 유발 피드백 금지 등)와 GDL-001(만 4~6세 언어수준)이
    실제로 프롬프트에 도달해야 한다. draft 로 되돌아가면 여기서 잡힌다.
    """
    engine = deps.get_engine()
    ids = {r.id for r in engine.rules}
    assert {"ETH-002", "GDL-001"} <= ids, "CS-003 승격이 되돌려졌습니다"

    sections = engine.build_rule_sections("ownership_turn")
    for rule_id in ("ETH-002-R1", "ETH-002-R4", "ETH-002-R5", "ETH-002-R6",
                    "GDL-001-R1", "GDL-001-R4"):
        assert rule_id in sections, f"{rule_id} 이 프롬프트에 도달하지 않습니다"


def test_cs004_legal003_frontmatter_parses():
    """🚨 CS-004 + S13: 규칙 문서 10건 전부 frontmatter 파싱에 성공하는가.

    `rule_loader.py:24-26` 은 파싱 실패 시 예외 없이 전문을 body 로 반환한다(침묵 실패).
    LEGAL-003 1행이 키보드 난타로 오염되어 있던 것이 이 방식으로 숨어 있었다.
    """
    from rule_engine.rule_loader import _read_markdown

    kb = deps.UPSTREAM_ROOT / "knowledge_base"
    for md in sorted(kb.rglob("*.md")):
        meta, body = _read_markdown(md)
        assert meta, f"{md.name}: frontmatter 파싱 실패 (침묵 폴백 발생)"
        assert body != md.read_text(encoding="utf-8"), f"{md.name}: 전문 폴백 발생"


def test_cs010_no_rules_dropped_by_top_k():
    """🚨 CS-010: 규칙이 top_k 컷오프로 조용히 탈락하고 있지 않은가.

    `build_rule_sections`(rule_engine.py:34)가 top_k 를 전달하지 않아 호출자가
    인자로 넘길 수 없다 → deps._apply_top_k_wrap() 의 in-process 래핑이 유일한 수단.
    탈락 후보 최하위가 GDL-001(만 4~6세 언어수준을 규정하는 유일한 문서)이므로
    탈락이 발생하면 D1 결정이 다시 무근거가 된다.
    """
    d = deps.diagnostics()
    assert d["rules_dropped_by_top_k"] == 0, (
        f"규칙 {d['rules_dropped_by_top_k']}건이 탈락 중입니다 "
        f"(후보 {d['retriever_pool']} > top_k {d['top_k']})"
    )


def test_top_k_wrap_is_applied():
    """래핑이 실제로 적용되었는가 (상류 기본값 8 을 넘어섰는가)."""
    from rule_engine.rule_engine import RuleEngine

    assert getattr(RuleEngine.get_applicable_rules, "_ttorang_wrapped", False)
    assert deps.diagnostics()["top_k"] >= deps.diagnostics()["rules_loaded"]


def test_upstream_source_tree_is_not_written_to():
    """원본 트리에 우리가 만든 파일이 없는가 (읽기 전용 원칙).

    D4 로 승인된 예외는 기존 파일 2건의 *내용* 수정뿐이며, 새 파일 생성은 없다.
    """
    forbidden = [".venv", "__pycache__/ttorang", "server", "web", "contracts", "compliance"]
    for name in forbidden:
        assert not (deps.UPSTREAM_ROOT / name).exists(), f"원본 트리에 {name} 이 생성되었습니다"
