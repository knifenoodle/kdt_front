"""생성된 시나리오를 규칙에 대비해 검증하는 후처리 가드레일.

LLM이 시스템 프롬프트의 규칙을 무시할 가능성에 대비한 이중 방어선이다.
프롬프트 주입(rule_engine.py)만으로 안전성을 100% 보장할 수 없으므로,
출력 결과를 다시 규칙 기반으로 스캔한다.
"""

from .models import ValidationIssue, ValidationReport

# 규칙 ID별 금지 키워드. knowledge_base 문서의 규칙 라인과 1:1로 대응된다.
_BANNED_KEYWORDS = {
    "LEGAL-001": ["칼", "흉기", "때려", "피가", "감금", "죽여", "협박"],
    "LEGAL-002": ["따돌림", "왕따", "단톡방", "돈 뺏", "성폭력", "몰카"],
    "ETH-002": ["바보", "멍청이", "장애", "뚱뚱", "못생", "가난"],
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


def _flatten_text(scenario: dict) -> str:
    return " ".join(str(v) for v in scenario.values() if isinstance(v, str))


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
                severity="high",
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
                        severity="critical",
                    )
                )

    is_valid = not any(i.severity == "critical" for i in issues) and not any(
        i.rule_id == "OUTPUT_FORMAT" for i in issues
    )
    return ValidationReport(is_valid=is_valid, issues=issues)
