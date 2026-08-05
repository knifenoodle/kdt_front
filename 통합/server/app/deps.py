"""규칙 엔진 로딩.

`engine/` 은 원본 `Communication_simulator` 를 이 프로젝트로 복사한 **우리 코드**다.
(포크 기준: `bdd1bc7`. 원본 저장소는 손대지 않는다 — `docs/08_원본_변동사항.md`)

따라서 예전에 있던 우회 장치가 전부 필요 없어졌다:
  - ❌ prompt_config 벤더링 + 모듈 속성 오버라이드 → `engine/prompts/prompt_config.json` 직접 수정
  - ❌ `get_applicable_rules` top_k in-process 래핑 → `engine/rule_engine/rule_engine.py` 직접 수정
  - ❌ 원본 트리 경로 탐색의 취약성 → 프로젝트 내부 상대 경로

BFF 가 계속 담당하는 것은 **HTTP 계층**이다: CORS·enum 검증·오류 정규화·타임아웃·헬스체크.
규칙 엔진 자체는 이제 `engine/` 에서 직접 고친다.
"""

from __future__ import annotations

import sys
from pathlib import Path

BFF_ROOT = Path(__file__).resolve().parent.parent      # frontendbackend/server
PROJECT_ROOT = BFF_ROOT.parent                          # frontendbackend
ENGINE_ROOT = PROJECT_ROOT / "engine"

_initialized = False
_init_error: str | None = None


class EngineNotFound(RuntimeError):
    """`engine/` 을 찾지 못했을 때. 헬스체크가 이 메시지를 그대로 노출한다."""


def engine_available() -> bool:
    return (ENGINE_ROOT / "rule_engine" / "rule_engine.py").is_file()


def init() -> None:
    """멱등. 앱 import 시 1회 호출한다."""
    global _initialized, _init_error
    if _initialized:
        return

    if not engine_available():
        _init_error = (
            f"규칙 엔진을 찾지 못했습니다: {ENGINE_ROOT}\n"
            f"(engine/rule_engine/rule_engine.py 가 있어야 합니다.)"
        )
        raise EngineNotFound(_init_error)

    if str(ENGINE_ROOT) not in sys.path:
        sys.path.insert(0, str(ENGINE_ROOT))

    _initialized = True
    _init_error = None


def diagnostics() -> dict:
    """🚨 키 값·앞자리·길이를 절대 반환하지 않는다. 존재 여부 boolean 만."""
    import os

    info: dict = {
        "engine_found": engine_available(),
        "engine_root": str(ENGINE_ROOT),
        "gemini_key_present": bool(os.environ.get("GEMINI_API_KEY")),
        "init_error": _init_error,
    }
    if not _initialized:
        return info

    engine = get_engine()
    info["rules_loaded"] = len(engine.rules)
    info["active_rules"] = [r.id for r in engine.rules]

    # CS-010 감시: 후보 풀 > 실제 선택이면 규칙이 조용히 탈락 중이라는 뜻이다.
    # engine/rule_engine/rule_engine.py 에서 top_k 기본값을 활성 규칙 수로 고쳤으므로
    # 정상 상태에서는 항상 0 이어야 한다.
    pool = engine.get_applicable_rules("ownership_turn", top_k=10_000)
    selected = engine.get_applicable_rules("ownership_turn")
    info["retriever_pool"] = len(pool)
    info["rules_selected"] = len(selected)
    info["rules_dropped_by_top_k"] = max(0, len(pool) - len(selected))
    return info


_engine = None


def get_engine():
    """규칙 엔진 싱글턴 — 헬스체크·진단 전용.

    생성 경로(`scenario_generator.generate_scenarios`)는 매 호출마다 새 `RuleEngine()` 을
    만든다(상류 동작). 그 덕분에 규칙 문서를 고치면 서버 재시작 없이 반영된다.
    """
    global _engine
    if _engine is None:
        from rule_engine.rule_engine import RuleEngine

        _engine = RuleEngine()
    return _engine
