"""가드 테스트 — 안전장치가 조용히 무력화되는 것을 잡는다.

이 파일의 테스트가 깨지면 "규칙 엔진이 회귀했다"는 신호다.
테스트를 고쳐서 통과시키지 말 것.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from server.app import deps

# 원본 저장소 (읽기 전용 — 우리는 engine/ 사본에서 작업한다)
UPSTREAM_ROOT = deps.PROJECT_ROOT.parent / "백엔드" / "Communication_simulator"


@pytest.fixture(scope="module", autouse=True)
def _init():
    deps.init()


# ══════════════════════════════════════════════════════════════════
# 원본 불가침
# ══════════════════════════════════════════════════════════════════
@pytest.mark.skipif(not UPSTREAM_ROOT.is_dir(), reason="원본 저장소가 없는 환경")
def test_upstream_repo_is_untouched():
    """🚨 원본 `백엔드/Communication_simulator` 는 한 바이트도 바뀌지 않아야 한다.

    engine/ 로 복사해 작업하기로 한 이후(2026-08-05), 원본 수정 예외는 폐지됐다.
    이 테스트가 실패하면 누군가 원본을 직접 고친 것이다.
    """
    r = subprocess.run(
        # "-- ." : 모노레포 클론(백엔드/통합/프론트가 한 저장소 안에 있는 경우)에서
        # 저장소 전체가 아니라 이 폴더로만 스코프를 제한한다.
        ["git", "status", "--porcelain", "--", "."],
        cwd=UPSTREAM_ROOT, capture_output=True, text=True,
    )
    assert r.returncode == 0, f"git 실행 실패: {r.stderr}"
    assert r.stdout.strip() == "", (
        f"원본 저장소가 수정되었습니다:\n{r.stdout}\n"
        f"engine/ 에서 작업하고 원본은 되돌리세요: git -C '{UPSTREAM_ROOT}' checkout -- ."
    )


@pytest.mark.skipif(not UPSTREAM_ROOT.is_dir(), reason="원본 저장소가 없는 환경")
def test_backend_contract_keys_match_upstream():
    """🚨 백엔드 절대 기준: 카테고리 4키와 라벨 문자열을 리네이밍하지 않았는가.

    engine/ 이 우리 것이 되었어도 **API 계약(카테고리 enum·라벨)은 백엔드 기준**이다
    (CLAUDE.md §3-2). 여기가 갈라지면 원본과 다른 제품이 된다.
    """
    from rule_engine.scenario_generator import _load_prompt_config

    upstream = json.loads(
        (UPSTREAM_ROOT / "prompts" / "prompt_config.json").read_text(encoding="utf-8")
    )
    ours = _load_prompt_config()
    assert ours["scenario_categories"] == upstream["scenario_categories"]
    assert ours["user_instruction_template"] == upstream["user_instruction_template"]


def test_engine_is_local_not_upstream():
    """engine/ 을 import 하고 있는가 (원본 트리를 참조하고 있지 않은가)."""
    import rule_engine

    engine_path = Path(rule_engine.__file__).resolve().parent.parent
    assert engine_path == deps.ENGINE_ROOT, f"엔진 경로가 예상과 다릅니다: {engine_path}"


# ══════════════════════════════════════════════════════════════════
# D1 — 연령
# ══════════════════════════════════════════════════════════════════
def test_age_target_reaches_the_prompt():
    """만 4~6세 기준이 실제 시스템 프롬프트에 반영되는가."""
    from rule_engine.scenario_generator import _load_prompt_config

    cfg = _load_prompt_config()
    assert "7~9세" not in cfg["system_role"]
    assert "초등" not in cfg["system_role"]
    assert "만 4~6세" in cfg["system_role"]

    sections = deps.get_engine().build_rule_sections("ownership_turn")
    assert "7~9세" not in sections


# ══════════════════════════════════════════════════════════════════
# CS-003 / CS-004 — 규칙 문서 무결성
# ══════════════════════════════════════════════════════════════════
def test_cs003_rules_are_active_and_reach_the_prompt():
    """🚨 CS-003: 가르치지 않은 규칙으로 처벌하던 비대칭이 해소되었는가."""
    engine = deps.get_engine()
    ids = {r.id for r in engine.rules}
    assert {"ETH-002", "GDL-001"} <= ids, "CS-003 승격이 되돌려졌습니다"

    sections = engine.build_rule_sections("ownership_turn")
    for rule_id in ("ETH-002-R1", "ETH-002-R4", "ETH-002-R5", "ETH-002-R6",
                    "GDL-001-R1", "GDL-001-R5", "GDL-001-R8", "GDL-001-R9"):
        assert rule_id in sections, f"{rule_id} 이 프롬프트에 도달하지 않습니다"


def test_cs004_all_rule_docs_parse():
    """🚨 CS-004 + S13: 규칙 문서 10건 전부 frontmatter 파싱에 성공하는가."""
    from rule_engine.rule_loader import _read_markdown

    kb = deps.ENGINE_ROOT / "knowledge_base"
    for md in sorted(kb.rglob("*.md")):
        meta, body = _read_markdown(md)
        assert meta, f"{md.name}: frontmatter 파싱 실패 (침묵 폴백 발생)"
        assert body != md.read_text(encoding="utf-8"), f"{md.name}: 전문 폴백 발생"


def test_cs010_no_rules_dropped_by_top_k():
    """🚨 CS-010: 규칙이 top_k 컷오프로 조용히 탈락하고 있지 않은가.

    탈락 후보 최하위가 GDL-001(만 4~6세 언어수준을 규정하는 유일한 문서)이므로
    탈락이 발생하면 D1 결정이 다시 무근거가 된다.
    """
    d = deps.diagnostics()
    assert d["rules_dropped_by_top_k"] == 0, (
        f"규칙 {d['rules_dropped_by_top_k']}건이 탈락 중입니다 "
        f"(후보 {d['retriever_pool']} > 선택 {d['rules_selected']})"
    )


# ══════════════════════════════════════════════════════════════════
# CS-002 / CS-006 — validator (engine/ 소유 이후 직접 수정)
# ══════════════════════════════════════════════════════════════════
_VALID = {
    "category": "ownership_turn",
    "scenario_title": "제목",
    "background": "배경",
    "conflict_trigger": "트리거",
    "learning_goal": "목표",
    "ai_first_message": "첫 대사",
}


def test_cs002_fail_open_is_fixed():
    """🚨 CS-002: 카테고리 위반이 통과하던 fail-open 이 막혔는가.

    수정 전: is_valid = (critical 없음) AND (OUTPUT_FORMAT 없음)
    → severity="high" 인 GDL-002 카테고리 위반이 **통과**했다.
    실측 재현: 잘못된 category + HTML 페이로드 → is_valid=True
    """
    from rule_engine.validator import validate_scenario

    bad = dict(_VALID, category="<img src=x onerror=1>")
    report = validate_scenario(bad)
    assert not report.is_valid, "카테고리 위반이 여전히 통과합니다 (fail-open 회귀)"
    assert any(i.rule_id == "GDL-002" for i in report.issues)


def test_cs002_high_severity_blocks():
    """severity 기준 단일화 — high 도 차단 대상인가."""
    from rule_engine.validator import validate_scenario

    report = validate_scenario(dict(_VALID, learning_goal=""))  # OUTPUT_FORMAT(high)
    assert not report.is_valid


def test_cs006_nested_fields_are_scanned():
    """🚨 CS-006: 중첩 구조의 금칙어를 잡는가.

    수정 전에는 top-level str 만 스캔해서
    validate_scenario({..., 'x': {'y': '칼로 협박했다'}}) → is_valid=True 였다.
    통합 UI 의 세션 모델이 3턴 배열이므로 이 구멍은 실제 위험이다.
    """
    from rule_engine.validator import validate_scenario

    nested = dict(_VALID, turns=[{"ask": {"t": "칼로 협박했다"}}])
    report = validate_scenario(nested)
    assert not report.is_valid, "중첩 필드가 스캔되지 않습니다"
    assert any(i.rule_id == "LEGAL-001" for i in report.issues)


def test_false_positives_removed():
    """오탐 제거 — '장애물', '가난한 나라' 같은 정당한 용법이 통과하는가."""
    from rule_engine.validator import validate_scenario

    for text in ("장애물 달리기를 했어요", "가난한 나라를 돕는 이야기"):
        report = validate_scenario(dict(_VALID, background=text))
        assert report.is_valid, f"오탐: {text!r} 이 차단되었습니다"


def test_real_violations_still_blocked():
    """오탐을 없애면서 진짜 위반까지 놓치지 않았는가."""
    from rule_engine.validator import validate_scenario

    for text in ("친구를 칼로 협박했다", "우리 반에서 따돌림을 당했다", "너는 바보야"):
        report = validate_scenario(dict(_VALID, background=text))
        assert not report.is_valid, f"미탐: {text!r} 이 통과했습니다"
