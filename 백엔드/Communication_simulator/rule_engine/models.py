"""규칙 엔진에서 사용하는 데이터 구조."""

from dataclasses import dataclass, field


@dataclass
class Rule:
    id: str
    category: str
    status: str
    severity: str
    title: str
    file: str
    source_name: str
    source_url: str
    tags: list = field(default_factory=list)
    applies_to: list = field(default_factory=list)
    body: str = ""  # 마크다운 본문 (frontmatter 제외)

    @property
    def is_active(self) -> bool:
        return self.status == "active"


@dataclass
class ScenarioRequest:
    category: str  # ownership_turn | physical_boundary | verbal_discomfort | rule_violation
    age_range: str = "초등 1~3학년 (7~9세)"
    keywords: list = field(default_factory=list)
    context_purpose: str = "scenario_generation"


@dataclass
class ValidationIssue:
    rule_id: str
    field: str
    message: str
    severity: str


@dataclass
class ValidationReport:
    is_valid: bool
    issues: list = field(default_factory=list)

    def summary(self) -> str:
        if self.is_valid:
            return "통과: 위반 사항 없음"
        lines = [f"- [{i.rule_id}] ({i.severity}) {i.field}: {i.message}" for i in self.issues]
        return "\n".join(lines)
