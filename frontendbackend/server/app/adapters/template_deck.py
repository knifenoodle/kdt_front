"""1단계 어댑터: 저작 3턴 데크 + 백엔드 값 주입.

주입 규칙은 `docs/01_인터페이스_계약서.md` §3 이 정본이다. 여기 없는 조합은 주입하지 않는다.

  ai_first_message  → turns[0].ask.t        가공 없이 그대로  ← 수직 슬라이스의 증명 대상
  background        → lines.intro.t         저작 문장에 삽입 (길이 초과 시 미사용)
  scenario_title    → parent_meta.scenario_title
  learning_goal     → parent_meta.learning_goal      아이 화면 비노출
  conflict_trigger  → parent_meta.conflict_trigger   아이 화면 비노출
  category          → other(상대역) 선택
  issues[]          → parent_meta.dev_issues         🚨 개발자 전용

아이가 듣는 발화 중 백엔드 유래는 정확히 1줄(turns[0].ask)이고 나머지는 저작물이다.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from pathlib import Path
from typing import Any, Optional

from ..schemas import (
    DevIssue,
    Lines,
    Line,
    ParentMeta,
    SessionRequest,
    SessionScript,
    Source,
    Turn,
)
from .base import SessionScriptAdapter

log = logging.getLogger("ttorang.bff.adapter")

DECK_DIR = Path(__file__).resolve().parent.parent / "deck"

# 1단계 구현 카테고리. 나머지 3종은 저작 데크가 없다(docs/01 §6-2).
# refuse↔ownership_turn 만 UI 5스킬과 매핑이 성립한다.
IMPLEMENTED_CATEGORIES = {"ownership_turn"}

# 🚨 CS-005 경계: 사용자 문자열이 system_instruction 에 도달하지 않게 하는 화이트리스트.
# age_band 는 서버 정의 라벨로만 번역되고, 자유 문자열은 어떤 경로로도 통과하지 않는다.
AGE_RANGE_LABEL = {
    "4": "만 4세 (미취학)",
    "5": "만 5세 (미취학, 취학 직전)",
    "6": "만 6세 (미취학, 취학 직전)",
}

# 아이가 듣는 한 발화의 길이 상한. schemas.Line.t 의 max_length 와 반드시 일치시킨다.
# 근거: GDL-001-R1 (만 4~6세: 1~2문장, 문장당 10단어 내외) 의 기계적 상한 근사.
LINE_MAX = 120

UPSTREAM_TIMEOUT_SEC = 20.0


class DeckNotFound(RuntimeError):
    pass


def load_deck(category: str) -> dict:
    path = DECK_DIR / f"{category}.json"
    if not path.is_file():
        raise DeckNotFound(f"저작 데크가 없습니다: {path.name}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_deck_variant(category: str, level: str, variation: str) -> dict:
    """레벨시스템 v1.2 §2-3 — 레벨×변이 데크. `deck/{category}/l{level}_v{variation}.json`.

    레거시 `load_deck()`과 별도 경로다. 레거시 파일은 `test_never_fails.py:151`이
    문자열을 하드코딩 검증하므로 바이트 단위로 건드리지 않는다 — 이 함수가 그 파일을
    대체하지 않고, level/variation이 둘 다 주어졌을 때만 선택되는 신규 경로다.
    """
    path = DECK_DIR / category / f"l{level}_v{variation}.json"
    if not path.is_file():
        raise DeckNotFound(f"저작 데크가 없습니다: {path.parent.name}/{path.name}")
    return json.loads(path.read_text(encoding="utf-8"))


def _line(raw: dict) -> Line:
    return Line(**{k: v for k, v in raw.items() if k in ("who", "t", "emo")})


class TemplateDeckAdapter(SessionScriptAdapter):
    name = "template_deck"

    async def build(self, req: SessionRequest) -> SessionScript:  # type: ignore[override]
        # 레벨시스템 v1.2 §2-3: level/variation이 둘 다 주어지면 신규 9종 데크,
        # 아니면 레거시 데크(현행 동작과 100% 동일 — 하위호환).
        if req.level and req.variation:
            deck = load_deck_variant(req.category, req.level, req.variation)
        else:
            deck = load_deck(req.category)

        scenario: Optional[dict] = None
        issues: list[dict] = []
        fallback_reason = None

        try:
            scenario, issues = await self._call_upstream(req)
            if scenario is None:
                # 🚨 [백엔드 실측] scenarios == [] 인데 HTTP 200 인 정상 동작.
                # 오류로 승격하지 않는다(M4). 모든 후보가 검증 탈락한 경우다.
                fallback_reason = "empty_scenarios"
        except RuntimeError as exc:
            # scenario_generator._get_client() 의 GEMINI_API_KEY 부재
            if "GEMINI_API_KEY" in str(exc):
                fallback_reason = "no_api_key"
            else:
                fallback_reason = "upstream_error"
            log.warning("상류 호출 실패(%s): %s", fallback_reason, exc)
        except asyncio.TimeoutError:
            fallback_reason = "timeout"
            log.warning("상류 호출 타임아웃 %.0fs", UPSTREAM_TIMEOUT_SEC)
        except Exception as exc:  # noqa: BLE001 — 어떤 예외에도 세션은 완성돼야 한다
            fallback_reason = "upstream_error"
            log.warning("상류 호출 예외: %r", exc)

        return self._assemble(req, deck, scenario, issues, fallback_reason)

    # ── 상류 호출 ────────────────────────────────────────────────────
    async def _call_upstream(self, req: SessionRequest) -> tuple[Optional[dict], list[dict]]:
        """engine 의 generate_scenarios 를 스레드에서 호출한다.

        엔진 함수는 sync def 이고 Gemini 호출이 블로킹이며 타임아웃이 없다(최대 2회 호출).
        to_thread + wait_for 로 이벤트 루프를 막지 않고 상한을 씌운다(M5).
        """
        from rule_engine.scenario_generator import generate_scenarios

        def _run() -> dict:
            return generate_scenarios(
                category=req.category,
                num_scenarios=1,
                age_range=AGE_RANGE_LABEL[req.age_band],
            )

        result = await asyncio.wait_for(asyncio.to_thread(_run), timeout=UPSTREAM_TIMEOUT_SEC)

        scenarios = result.get("scenarios") or []
        # [엔진 실측] webapp/main.py:77-82 와 동일하게 is_valid=False 리포트의 issue 만 모은다.
        issues = [
            {"rule_id": i.rule_id, "field": i.field, "message": i.message, "severity": i.severity}
            for report in result.get("validation_reports", [])
            if not report.is_valid
            for i in report.issues
        ]
        return (scenarios[0] if scenarios else None), issues

    # ── 조립 ─────────────────────────────────────────────────────────
    def _assemble(
        self,
        req: SessionRequest,
        deck: dict,
        scenario: Optional[dict],
        issues: list[dict],
        fallback_reason: Optional[str],
    ) -> SessionScript:
        dl = deck["lines"]
        used: list[str] = []

        # ── lines: 저작 데크 기반 ────────────────────────────────────
        intro = _line(dl["intro"])
        if scenario:
            candidate = self._intro_from_background(scenario.get("background", ""), dl)
            if candidate is not None:
                intro = candidate
                used.append("background")

        lines = Lines(
            ai_disclosure=_line(dl["ai_disclosure"]),
            intro=intro,
            demo_in=_line(dl["demo_in"]),
            demo=[_line(x) for x in dl["demo"]],
            wait=_line(dl["wait"]),
            cant=_line(dl["cant"]),
            cheer=_line(dl["cheer"]),
            party=_line(dl["party"]),
        )

        # ── turns: turns[0].ask.t 만 백엔드 원문으로 교체 ─────────────
        turns: list[Turn] = []
        for idx, t in enumerate(deck["turns"]):
            ask = _line(t["ask"])
            if idx == 0 and scenario:
                injected = self._fit(scenario.get("ai_first_message", ""))
                if injected is not None:
                    # 🚨 가공 없이 그대로. 이 동등성이 T8 의 검증 대상이다.
                    ask = Line(who=ask.who, t=injected, emo=ask.emo)
                    used.append("ai_first_message")
            turns.append(
                Turn(
                    emo=t["emo"],
                    back_emo=t["back_emo"],
                    ask=ask,
                    hint=_line(t["hint"]),
                    sup1=_line(t["sup1"]),
                    sup2=_line(t["sup2"]),
                    back=_line(t["back"]),
                )
            )

        # ── parent_meta: 아이 화면 비노출 ─────────────────────────────
        pm_fb = deck["parent_meta_fallback"]
        if scenario:
            used.extend(["scenario_title", "learning_goal", "conflict_trigger", "category"])
        parent_meta = ParentMeta(
            scenario_title=(scenario or {}).get("scenario_title") or pm_fb["scenario_title"],
            learning_goal=(scenario or {}).get("learning_goal") or pm_fb["learning_goal"],
            conflict_trigger=(scenario or {}).get("conflict_trigger") or pm_fb["conflict_trigger"],
            dev_issues=[DevIssue(**i) for i in issues if i.get("severity") in ("critical", "high")],
        )

        return SessionScript(
            session_id=uuid.uuid4().hex[:8],
            category=req.category,           # type: ignore[arg-type]
            skill=deck["skill"],
            age_band=req.age_band,
            scene=req.scene,
            other=deck["other"],
            level=req.level,
            variation=req.variation,
            lines=lines,
            turns=turns,
            source=Source(
                adapter=self.name,           # type: ignore[arg-type]
                backend_scenario_present=scenario is not None,
                backend_fields_used=sorted(set(used)),
                fallback_reason=fallback_reason,  # type: ignore[arg-type]
            ),
            parent_meta=parent_meta,
        )

    # ── 주입 안전장치 ────────────────────────────────────────────────
    def _fit(self, text: Any) -> Optional[str]:
        """길이·형식이 맞지 않으면 주입하지 않는다.

        🚨 절대 자르지 않는다. 아이가 듣는 문장을 중간에서 끊으면 저작 폴백보다 나쁘다.
        Line.t 의 max_length 를 초과하면 Pydantic 이 던지므로, 여기서 미리 걸러
        세션이 실패하지 않게 한다(어댑터는 예외를 던지지 않는다는 계약).
        """
        if not isinstance(text, str):
            return None
        s = text.strip()
        if not s or len(s) > LINE_MAX:
            if s:
                log.info("주입 생략 — 길이 %d > %d. 저작 폴백 사용", len(s), LINE_MAX)
            return None
        return s

    def _intro_from_background(self, background: Any, dl: dict) -> Optional[Line]:
        """background 를 저작 인트로 문장에 삽입한다. 합쳐서 상한을 넘으면 미사용."""
        bg = background.strip() if isinstance(background, str) else ""
        if not bg:
            return None
        suffix = dl["intro_suffix"]
        combined = f"{bg} {suffix}"
        fitted = self._fit(combined)
        if fitted is None:
            return None
        return Line(who=dl["intro"]["who"], t=fitted)
