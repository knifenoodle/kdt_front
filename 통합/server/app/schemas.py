"""요청/응답 스키마.

정본은 `contracts/session-script.schema.json` 이다. 이 모듈은 그 미러이며
`tests/test_contract_schema.py` 가 두 정의의 일치를 검증한다.

출처 라벨 (docs/01_인터페이스_계약서.md):
  [백엔드 실측] 변경 금지. 리네이밍·형변환 금지.
  [신설]       백엔드 부재. 어댑터만 삭제하면 되는 형태 유지.
  [UI 요구]    uiux기획 문서 위계가 규정. 아동 안전 축에서 백엔드보다 우선.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

# ── [백엔드 실측] scenario_generator.py:52-56 ScenarioCategory ──────
Category = Literal["ownership_turn", "physical_boundary", "verbal_discomfort", "rule_violation"]

# ── [UI 요구] uiux기획/CLAUDE.md:3 의 5개 사회적 상황 ────────────────
# category 와 다른 축이다. category 를 이 5값으로 덮으면 백엔드 taxonomy 침범(docs/02 A-4).
Skill = Literal["greet", "request", "apologize", "refuse", "take_turns"]

# ── [UI 요구] uiux기획/CLAUDE.md:107 — 연령대만. 생년월일·나이 정수 금지 ──
AgeBand = Literal["4", "5", "6"]

# ── [UI 요구] mockup-v1.html:1411-1423 SCENES ───────────────────────
Scene = Literal["class", "play", "kids", "cvs", "stat", "variety", "dept", "cinema", "futsal", "dojang"]

# ── [UI 요구] mockup-v1.html:1520-1528 ──────────────────────────────
# 값 = 캐릭터_에셋/svg/ 파일명 stem. 한글 표시명은 web 로스터에서 해석.
Partner = Literal["songpyeon"]
Other = Literal["sirutteok", "garaetteok", "injeolmi", "kkultteok", "yakgwa", "baekseolgi"]
Who = Literal["songpyeon", "sirutteok", "garaetteok", "injeolmi", "kkultteok", "yakgwa", "baekseolgi"]

# ── [UI 요구] mockup-v1.html:2137 EMOS ──────────────────────────────
Emotion = Literal["none", "joy", "sad", "angry", "surprised", "shy", "scared"]

AdapterName = Literal["template_deck", "derived", "backend_session"]
FallbackReason = Literal["no_api_key", "empty_scenarios", "upstream_error", "timeout", "invalid_category"]


class Strict(BaseModel):
    """extra='forbid' — 아동 식별정보 필드가 스키마에 스며드는 것을 타입 차원에서 막는다."""

    model_config = ConfigDict(extra="forbid")


class Line(Strict):
    """아이가 듣게 되는 발화 1개.

    🚨 t 가 speak() 에 도달하기 전 반드시 sanitizeForChild() 를 경유해야 한다(S4).
    validator.py:11-15 의 20단어 블랙리스트는 자해·성적 내용·무언어 집단배제를
    전부 통과시킨다(실측). 통합 후에는 글자를 못 읽는 만 4~6세의 귀로 직접 들어가고
    걸러낼 사람이 없다.
    """

    who: Who
    # maxLength 120 = GDL-001-R1(문장 15단어 내외)의 기계적 상한 근사.
    t: str = Field(min_length=1, max_length=120)
    emo: Optional[Emotion] = None


class Turn(Strict):
    emo: Emotion
    # 🚨 아이 발화의 채점이 아니라 상황 전개의 결과다. 3턴에 걸쳐 누그러지는 방향만
    # 허용된다(캐릭터_가이드_v1.md §5). 파트너 감정은 아이 발화에 바인딩되지 않는다(S1).
    back_emo: Emotion
    ask: Line   # turns[0].ask.t 에는 백엔드 ai_first_message 가 가공 없이 그대로 들어간다
    hint: Line  # 지원 0단계
    sup1: Line  # 지원 1단계 (재시도 1회)
    sup2: Line  # 지원 2단계 (재시도 2회 = retry_max). 함께 말하기. 벌이 아니라 지원 상향
    back: Line


class Lines(Strict):
    # [신설·규제 필수] GOV-003-R1 아동 대상 AI 고지. 목업에 없던 항목이다
    # (mockup-v1.html:1701-1705 는 송편/시루떡을 고지 없이 친구로 제시).
    # 첫 세션에서 1회 재생됨을 S8 이 강제한다.
    ai_disclosure: Line
    intro: Line
    demo_in: Line
    demo: list[Line] = Field(min_length=3, max_length=3)
    wait: Line   # thinking 3초 초과 (uiux기획/CLAUDE.md:91)
    cant: Line   # cantHear — 실패가 아니라 캐릭터의 부탁 (uiux기획/CLAUDE.md:95)
    cheer: Line  # 유일한 평가성 발화이며 항상 긍정 (규칙 6)
    party: Line


class DevIssue(Strict):
    """[백엔드 실측] webapp/main.py:77-82 의 issue dict 그대로."""

    rule_id: str
    field: str
    message: str
    severity: Literal["critical", "high"]


class Source(Strict):
    """[신설] 어댑터 교체 시 계약 검증용. 아이 화면에 도달하지 않는다."""

    adapter: AdapterName
    backend_scenario_present: bool
    backend_fields_used: list[str] = Field(default_factory=list)
    fallback_reason: Optional[FallbackReason] = None


class ParentMeta(Strict):
    """🚨 아이 화면 노출 금지. 보호자 게이트 뒤에서만 렌더한다.
    근거: 캐릭터_가이드_v1.md:537-543, uiux기획/CLAUDE.md:101.
    """

    scenario_title: str
    learning_goal: str
    conflict_trigger: str
    # 🚨 개발자 전용. 보호자 노출 금지 —
    # 백엔드 issues[] 는 (a) 시나리오 인덱스가 없어 매핑 불가하고
    # (b) 재시도 간 중복이 누적된다. 보호자에게 띄우면 "당신 아이 세션에서 규칙 위반 3건"
    # 으로 오독되어 LEGAL-002-R4(낙인 금지) 위반 위험.
    dev_issues: list[DevIssue] = Field(default_factory=list)


class SessionScript(Strict):
    schema_version: Literal[1] = 1
    session_id: str = Field(pattern=r"^[0-9a-f]{8}$")
    category: Category
    skill: Skill
    age_band: AgeBand
    scene: Scene
    partner: Partner = "songpyeon"
    other: Other
    # mockup-v1.html:1827 + 캐릭터연출_기획_v1.md:653-663 확정. 임의 상향 차단.
    retry_max: Literal[2] = 2
    lines: Lines
    turns: list[Turn] = Field(min_length=3, max_length=3)
    source: Source
    parent_meta: ParentMeta


class SessionRequest(Strict):
    """🚨 아동 식별정보 필드가 **스키마 차원에서 부재**하다 (M7).

    금지: name, nickname, birthdate, birth_year, child_id, school, grade, gender, phone, email
    근거: uiux기획/CLAUDE.md:107 — "아이 온보딩에서 이름·생년월일을 받지 않는다.
    필요한 건 연령대(4/5/6세)뿐."
    extra='forbid' 이므로 이 필드를 보내면 422 로 거부된다.
    `tests/test_no_pii_fields.py` 가 이를 고정한다.
    """

    category: Category
    age_band: AgeBand = "5"      # 설계 기준 페르소나 (기획서 v4:119)
    scene: Scene = "kids"
