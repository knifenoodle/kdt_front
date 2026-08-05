"""🚨 백엔드 팀원의 원본 구조에서 프런트가 실제로 도는가.

가장 급한 질문이다. 우리 사본(`engine/`)에서만 검증하면
**"우리 포크에서만 되는" 상태**가 되고, 합칠 때 터진다.

이 테스트는 팀원의 원본 체크아웃을 **무수정 그대로** 로드해 계약이 성립하는지 본다.
원본이 없는 환경(CI 등)에서는 skip 한다.

실행 방법 (수동):
    TTORANG_ENGINE="/path/to/Communication_simulator" \\
      ./.venv/bin/uvicorn server.app.main:app --port 8100
"""

from __future__ import annotations

import importlib
import subprocess
import sys
from pathlib import Path

import pytest

from server.app import deps

# 🚨 test_guards.py 의 UPSTREAM_ROOT 와 반드시 같은 방식으로 구한다. 이전에는
# 이 파일만 특정 개발자의 Desktop 절대경로를 하드코딩하고 있었다 — 다른 사람이
# 클론해서 pytest 를 돌리면 100% 실패하는 이식성 결함이었다(그 사람의 홈 디렉터리에는
# 해당 경로가 존재하지 않는다). deps.PROJECT_ROOT 기준 상대 경로로 통일한다.
#
# ⚠️ 모노레포로 클론한 경우(백엔드/통합/프론트 가 한 git 저장소 안에 있는 경우)
# 이 상대 경로가 그 저장소 안의 "백엔드/" 사본을 가리킬 수 있다. 그 사본은 별도
# git 저장소가 아니라서 git status 가 저장소 전체를 보고한다 — 이 파일들의
# 검사 대상이 아니다(원 개발자의 로컬 워크플로용). "통합/" 폴더만 남기고
# 클론한 경우(가장 흔한 사용 형태)에는 이 경로가 존재하지 않아 아래 skip 이 정상 작동한다.
UPSTREAM = deps.PROJECT_ROOT.parent / "백엔드" / "Communication_simulator"

pytestmark = pytest.mark.skipif(
    not (UPSTREAM / "rule_engine" / "rule_engine.py").is_file(),
    reason="팀원 원본 체크아웃이 없는 환경",
)


@pytest.fixture(scope="module")
def upstream_engine():
    """원본 트리를 로드한 규칙 엔진.

    `rule_engine` 은 이미 사본 경로로 import 되어 있으므로, 원본 경로를 sys.path
    맨 앞에 넣고 모듈 캐시를 비워 다시 읽는다. 테스트 종료 시 원복한다.
    """
    saved_path = list(sys.path)
    saved_mods = {k: v for k, v in sys.modules.items() if k.startswith("rule_engine")}
    for k in list(saved_mods):
        del sys.modules[k]
    sys.path.insert(0, str(UPSTREAM))
    try:
        from rule_engine.rule_engine import RuleEngine

        yield RuleEngine()
    finally:
        sys.path[:] = saved_path
        for k in [k for k in sys.modules if k.startswith("rule_engine")]:
            del sys.modules[k]
        sys.modules.update(saved_mods)


def test_upstream_is_pristine():
    """전제 확인 — 원본이 수정되지 않은 상태여야 이 테스트가 의미 있다."""
    # "-- ." : 모노레포 클론(백엔드/통합/프론트가 한 저장소 안에 있는 경우)에서
    # 저장소 전체가 아니라 이 폴더로만 스코프를 제한한다.
    r = subprocess.run(
        ["git", "status", "--porcelain", "--", "."],
        cwd=UPSTREAM, capture_output=True, text=True,
    )
    assert r.stdout.strip() == "", f"원본이 수정되어 있습니다:\n{r.stdout}"


def test_upstream_engine_loads(upstream_engine):
    """팀원 원본이 그대로 로드되는가."""
    assert len(upstream_engine.rules) > 0


def test_upstream_produces_rule_sections(upstream_engine):
    """4개 카테고리 전부에서 시스템 프롬프트가 만들어지는가."""
    for cat in ("ownership_turn", "physical_boundary", "verbal_discomfort", "rule_violation"):
        sections = upstream_engine.build_rule_sections(cat)
        assert sections.strip(), f"{cat}: 규칙 섹션이 비어 있습니다"


def test_upstream_contract_is_identical():
    """🚨 핵심: 프런트가 의존하는 계약이 원본에서도 동일한가.

    카테고리 4키·라벨·Scenario 6필드가 다르면 프런트를 고쳐야 한다.
    """
    import json

    saved = {k: v for k, v in sys.modules.items() if k.startswith("rule_engine")}
    for k in list(saved):
        del sys.modules[k]
    sys.path.insert(0, str(UPSTREAM))
    try:
        from rule_engine.scenario_generator import Scenario, ScenarioCategory

        # 카테고리 enum 4값
        assert {c.value for c in ScenarioCategory} == {
            "ownership_turn", "physical_boundary", "verbal_discomfort", "rule_violation",
        }
        # Scenario 6필드
        assert set(Scenario.model_fields) == {
            "category", "scenario_title", "background",
            "conflict_trigger", "learning_goal", "ai_first_message",
        }
        # 라벨 문자열
        cfg = json.loads((UPSTREAM / "prompts" / "prompt_config.json").read_text(encoding="utf-8"))
        assert set(cfg["scenario_categories"]) == {c.value for c in ScenarioCategory}
    finally:
        sys.path.remove(str(UPSTREAM))
        for k in [k for k in sys.modules if k.startswith("rule_engine")]:
            del sys.modules[k]
        sys.modules.update(saved)


def test_upstream_differences_are_known():
    """원본과 사본의 차이가 **예상된 것뿐인가.**

    원본은 ETH-002·GDL-001 이 draft 라 활성 7건, 우리 사본은 승격해서 9건이다.
    이 차이는 아동 안전 개선(CS-003)이며 계약에는 영향이 없다.
    예상 밖의 차이가 생기면 여기서 잡힌다.

    ⚠️ 모듈 캐시를 건드리지 않고 `rules_index.json` 을 직접 읽는다.
    엔진 인스턴스로 비교하면 어느 트리가 로드됐는지에 따라 결과가 흔들린다
    (실제로 그 함정에 빠졌었다).
    """
    import json

    from server.app import deps

    def active_ids(root: Path) -> set[str]:
        idx = json.loads(
            (root / "knowledge_base" / "rules_index.json").read_text(encoding="utf-8")
        )
        return {r["id"] for r in idx["rules"] if r["status"] == "active"}

    upstream_ids = active_ids(UPSTREAM)
    ours_ids = active_ids(deps.PROJECT_ROOT / "engine")

    assert upstream_ids - ours_ids == set(), (
        f"원본에만 있는 활성 규칙(예상 밖): {upstream_ids - ours_ids}"
    )
    assert ours_ids - upstream_ids == {"ETH-002", "GDL-001"}, (
        f"사본에만 있는 활성 규칙이 예상과 다릅니다: {ours_ids - upstream_ids} "
        f"(기대: ETH-002, GDL-001 — CS-003 승격)"
    )


def test_upstream_scenario_fields_match_our_contract():
    """원본 Scenario 6필드가 우리 어댑터의 주입 규칙과 일치하는가.

    프런트가 쓰는 필드가 원본에 없으면 합칠 때 터진다.
    """
    from server.app.adapters.template_deck import TemplateDeckAdapter  # noqa: F401

    # docs/01 §3 주입 표에서 우리가 실제로 읽는 필드
    used = {
        "ai_first_message", "background", "scenario_title",
        "learning_goal", "conflict_trigger", "category",
    }
    saved = {k: v for k, v in sys.modules.items() if k.startswith("rule_engine")}
    for k in list(saved):
        del sys.modules[k]
    sys.path.insert(0, str(UPSTREAM))
    try:
        from rule_engine.scenario_generator import Scenario

        missing = used - set(Scenario.model_fields)
        assert not missing, f"원본 Scenario 에 없는 필드를 주입하고 있습니다: {missing}"
    finally:
        sys.path.remove(str(UPSTREAM))
        for k in [k for k in sys.modules if k.startswith("rule_engine")]:
            del sys.modules[k]
        sys.modules.update(saved)
