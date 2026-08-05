"""생성된 시나리오를 규칙에 대비해 검증하는 후처리 가드레일.

LLM이 시스템 프롬프트의 규칙을 무시할 가능성에 대비한 이중 방어선이다.
프롬프트 주입(rule_engine.py)만으로 안전성을 100% 보장할 수 없으므로,
출력 결과를 다시 규칙 기반으로 스캔한다.
"""

from .models import ValidationIssue, ValidationReport

# 규칙 ID별 금지 키워드. knowledge_base 문서의 규칙 라인과 1:1로 대응된다.
#
# 🚨 오탐 제거: ETH-002 에서 `장애`, `가난` 을 뺐다.
#    부분문자열 매칭으로는 `장애물`·`장애인 배려`·`발달장애 이해` 같은 정당한 용법과
#    구분할 수 없다(실측: "장애물 달리기를 했어요" → is_valid=False).
#    이 규칙의 실체는 "차별 표현 금지"이며 프롬프트 규칙(ETH-002-R1)과
#    프런트 분류기(web/src/lib/riskPatterns.ts)로 이관한다.
#
# ⚠️ 여전히 최소 세트다(RULE_ENGINE_README.md:89 의 자기 인정). 자해·성적 내용·
#    무언어 집단배제는 부분문자열로 잡히지 않으며, 아동에게 도달하는 경로는
#    web/src/lib/riskPatterns.ts 의 정규식 판이 막는다. 통합 분류기는 G2-6.
_BANNED_KEYWORDS = {
    "LEGAL-001": ["칼", "흉기", "때려", "피가", "감금", "죽여", "협박"],
    "LEGAL-002": ["따돌림", "왕따", "단톡방", "돈 뺏", "성폭력", "몰카"],
    "ETH-002": ["바보", "멍청이", "뚱뚱", "못생"],
}

# ETH-002 는 내부 편집 기준이고 법적 강제가 아니므로 critical 이 아니라 high 로 둔다.
# CS-002 수정으로 high 도 차단 대상이 되었으므로 실효 강제력은 유지된다.
# (수정 전에는 ETH-002 규칙이 draft 여서 프롬프트에 도달하지 않는데 critical 처벌만
#  받는 비대칭이 있었다 — CS-003 에서 draft→active 승격으로 해소.)
_KEYWORD_SEVERITY = {
    "LEGAL-001": "critical",
    "LEGAL-002": "critical",
    "ETH-002": "high",
}

_REQUIRED_OUTPUT_FIELDS = [
    "category",
    "scenario_title",
    "background",
    "conflict_trigger",
    "learning_goal",
    "ai_first_message",
]

_ALLOWED_CATEGORIES = {"ownership_turn", "physical_boundary", "verbal_discomfort", "rule_violation"}


def _flatten_text(scenario) -> str:
    """🚨 CS-006 수정: 중첩 구조를 재귀 순회한다.

    수정 전에는 `scenario.values()` 중 top-level `str` 값만 스캔했다. 실측:
        validate_scenario({..., 'x': {'y': '칼로 협박했다'}}) → is_valid=True
    현행 Scenario 스키마는 평면이라 무해했으나, 통합 UI의 세션 모델은 3턴 배열이다.
    스키마가 중첩으로 바뀌는 순간 아이가 듣는 15줄 전부에 금칙어 스캔이 돌지 않게 된다.
    """
    parts = []

    def walk(node):
        if isinstance(node, str):
            parts.append(node)
        elif isinstance(node, dict):
            for v in node.values():
                walk(v)
        elif isinstance(node, (list, tuple, set)):
            for v in node:
                walk(v)

    walk(scenario)
    return " ".join(parts)


def validate_scenario(scenario: dict) -> ValidationReport:
    issues = []

    for field in _REQUIRED_OUTPUT_FIELDS:
        if not scenario.get(field):
            issues.append(
                ValidationIssue(
                    rule_id="OUTPUT_FORMAT",
                    field=field,
                    message="필수 필드가 비어 있거나 누락되었습니다.",
                    severity="high",
                )
            )

    category = scenario.get("category")
    if category and category not in _ALLOWED_CATEGORIES:
        issues.append(
            ValidationIssue(
                rule_id="GDL-002",
                field="category",
                message=f"허용되지 않은 카테고리입니다: {category}",
                # 🚨 CS-002 수정: high → critical.
                # category 는 프롬프트 라벨과 화면 렌더에 동시에 쓰이는 신뢰 경계값이므로
                # 최고 등급이 맞다. GDL-002-R1("정확히 하나의 카테고리")의 집행 지점이다.
                severity="critical",
            )
        )

    text = _flatten_text(scenario)
    for rule_id, banned_words in _BANNED_KEYWORDS.items():
        for word in banned_words:
            if word in text:
                issues.append(
                    ValidationIssue(
                        rule_id=rule_id,
                        field="content",
                        message=f"금지 키워드 '{word}' 감지됨.",
                        severity=_KEYWORD_SEVERITY[rule_id],
                    )
                )

    # 🚨 CS-002 수정: fail-open 제거.
    #
    # 수정 전: is_valid = (critical 없음) AND (OUTPUT_FORMAT 없음)
    # → severity="high" 인 위반은 rule_id 가 OUTPUT_FORMAT 이 아니면 **통과**했다.
    #   실측: 잘못된 category + HTML 페이로드 → is_valid=True
    #
    # 수정 후: severity 기준으로 단일화한다. rule_id 특례를 없애 판정 경로를 하나로 만든다.
    # (OUTPUT_FORMAT 은 severity="high" 이므로 계속 차단된다.)
    _BLOCKING = {"critical", "high"}
    is_valid = not any(i.severity in _BLOCKING for i in issues)
    return ValidationReport(is_valid=is_valid, issues=issues)
