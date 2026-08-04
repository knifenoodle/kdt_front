"""원본 소스 트리를 읽기 전용으로 import 하기 위한 seam.

원칙 (frontendbackend/CLAUDE.md §2):
- 원본 `백엔드/Communication_simulator`는 읽기 전용이다. 이 모듈은 파일을 쓰지 않는다.
- HTTP 계층(CORS·검증·오류·헬스체크·타임아웃)은 100% BFF 코드다.
- 유일한 벤더링은 `server/prompts/prompt_config.ttorang.json` 1건(연령 충돌 A-1).

여기서 하는 일 3가지:
1. sys.path 에 원본 트리를 삽입해 `rule_engine` 을 import 가능하게 한다.
2. `rule_engine.scenario_generator.PROMPT_CONFIG_PATH` 를 벤더링 사본으로 오버라이드한다.
3. CS-010(top_k 컷오프) 을 in-process 래핑으로 회피한다.
"""

from __future__ import annotations

import sys
from pathlib import Path

# ── 원본 소스 트리 위치 ──────────────────────────────────────────────
# 경로에 한글·공백('KDT 해커톤')이 있어 셸/PYTHONPATH 인용 실수가 반복되는 지점이다.
# 절대경로를 이 상수 한 곳에만 두고, 실패 시 헬스체크가 명확히 말하게 한다.
BFF_ROOT = Path(__file__).resolve().parent.parent          # frontendbackend/server
PROJECT_ROOT = BFF_ROOT.parent                              # frontendbackend
UPSTREAM_ROOT = PROJECT_ROOT.parent / "백엔드" / "Communication_simulator"

VENDORED_PROMPT_CONFIG = BFF_ROOT / "prompts" / "prompt_config.ttorang.json"

_initialized = False
_init_error: str | None = None


class UpstreamNotFound(RuntimeError):
    """원본 소스 트리를 찾지 못했을 때. 헬스체크가 이 메시지를 그대로 노출한다."""


def upstream_available() -> bool:
    return (UPSTREAM_ROOT / "rule_engine" / "rule_engine.py").is_file()


def init() -> None:
    """멱등. 앱 시작 시 1회 호출한다."""
    global _initialized, _init_error
    if _initialized:
        return

    if not upstream_available():
        _init_error = (
            f"원본 소스 트리를 찾지 못했습니다: {UPSTREAM_ROOT}\n"
            f"(rule_engine/rule_engine.py 가 있어야 합니다. 경로에 한글·공백이 포함되어 "
            f"있으므로 셸에서 반드시 인용하세요.)"
        )
        raise UpstreamNotFound(_init_error)

    if str(UPSTREAM_ROOT) not in sys.path:
        sys.path.insert(0, str(UPSTREAM_ROOT))

    _apply_prompt_config_override()
    _apply_top_k_wrap()

    _initialized = True
    _init_error = None


# ── seam 1: 프롬프트 설정 오버라이드 ────────────────────────────────
def _apply_prompt_config_override() -> None:
    """벤더링한 만 4~6세용 prompt_config 로 갈아끼운다.

    `scenario_generator.py:21` 이 `from .config import PROMPT_CONFIG_PATH` 로
    **import 시점에 바인딩**하므로, `rule_engine.config` 를 고쳐도 이미 바인딩된
    참조는 바뀌지 않는다. 따라서 scenario_generator 모듈 속성을 직접 교체한다.

    ⚠️ 상류가 import 스타일을 `from . import config` + `config.PROMPT_CONFIG_PATH`
    로 바꾸면 이 오버라이드는 조용히 무력화되고 7~9세 프롬프트로 복귀한다.
    `tests/test_guard_prompt_config.py` 가 그 회귀를 잡는다.
    """
    if not VENDORED_PROMPT_CONFIG.is_file():
        raise UpstreamNotFound(f"벤더링 prompt_config 가 없습니다: {VENDORED_PROMPT_CONFIG}")

    from rule_engine import scenario_generator

    if not hasattr(scenario_generator, "PROMPT_CONFIG_PATH"):
        raise UpstreamNotFound(
            "rule_engine.scenario_generator.PROMPT_CONFIG_PATH 속성이 없습니다. "
            "상류가 import 스타일을 변경했을 가능성이 있습니다 — 오버라이드 seam 재검토 필요."
        )
    scenario_generator.PROMPT_CONFIG_PATH = VENDORED_PROMPT_CONFIG


# ── seam 2: CS-010 top_k 컷오프 회피 ────────────────────────────────
def _apply_top_k_wrap() -> None:
    """활성 규칙이 늘어도 규칙이 조용히 탈락하지 않게 한다.

    🚨 CS-010: `RuleEngine.get_applicable_rules` 의 `top_k` 기본값이 8이고,
    `build_rule_sections`(rule_engine.py:34)가 `top_k` 를 **전달하지 않는다.**
    따라서 호출자가 인자로 넘길 방법이 없다 — in-process 래핑이 유일한 비침습 수단이다.

    현재 활성 9건 / 리트리버 후보 8건 / top_k 8 → 탈락 0건(경계). 규칙이 하나만 더
    active 가 되면(CS-009: GOV-001 TEMPLATE 작성 후 승격) 점수 최하위가 탈락하고,
    그 후보가 GDL-001(만 4~6세 언어수준을 규정하는 유일한 문서)일 수 있다.

    원본 파일은 수정하지 않는다. 프로세스 메모리 안에서만 기본값을 올린다.
    """
    from rule_engine.rule_engine import RuleEngine

    if getattr(RuleEngine.get_applicable_rules, "_ttorang_wrapped", False):
        return

    original = RuleEngine.get_applicable_rules

    def get_applicable_rules(self, scenario_category, keywords=None, top_k=None,
                             purpose="scenario_generation"):
        if top_k is None:
            # 활성 규칙 전체를 담을 수 있게. 상류 기본값 8은 하한으로만 쓴다.
            top_k = max(8, len(self.rules))
        return original(self, scenario_category, keywords=keywords, top_k=top_k, purpose=purpose)

    get_applicable_rules._ttorang_wrapped = True  # type: ignore[attr-defined]
    RuleEngine.get_applicable_rules = get_applicable_rules  # type: ignore[assignment]


# ── 진단 정보 (헬스체크용) ──────────────────────────────────────────
def diagnostics() -> dict:
    """키 값은 절대 반환하지 않는다. 존재 여부 boolean 만."""
    import os

    info: dict = {
        "source_tree_found": upstream_available(),
        "source_tree": str(UPSTREAM_ROOT),
        "prompt_config": "ttorang" if _initialized else None,
        "gemini_key_present": bool(os.environ.get("GEMINI_API_KEY")),
        "init_error": _init_error,
    }
    if not _initialized:
        return info

    engine = get_engine()
    info["rules_loaded"] = len(engine.rules)
    info["active_rules"] = [r.id for r in engine.rules]

    # CS-010 감시: 후보 풀 > top_k 이면 규칙이 조용히 탈락 중이라는 뜻이다.
    pool = engine.get_applicable_rules("ownership_turn", top_k=10_000)
    info["retriever_pool"] = len(pool)
    info["top_k"] = max(8, len(engine.rules))
    info["rules_dropped_by_top_k"] = max(0, len(pool) - info["top_k"])
    return info


_engine = None


def get_engine():
    """규칙 엔진 싱글턴.

    원본 `webapp/main.py:30-37` 은 `/api/rules` 에만 캐시를 쓰고 `/api/generate` 는
    매 요청 `RuleEngine()` 을 새로 만들어(scenario_generator.py:87) 규칙 반영 시점이
    엔드포인트마다 달랐다. BFF 는 헬스체크·진단용으로만 이 싱글턴을 쓰고,
    생성 경로는 상류 동작(매번 새 엔진)을 그대로 존중한다 — 상류 동작을 바꾸지 않는다.
    """
    global _engine
    if _engine is None:
        from rule_engine.rule_engine import RuleEngine

        _engine = RuleEngine()
    return _engine
