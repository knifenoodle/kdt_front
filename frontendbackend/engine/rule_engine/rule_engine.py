"""시나리오 생성 규칙 엔진(RuleEngine).

역할:
1. knowledge_base/의 법적 규제·정부 요구사항·윤리/도덕성·아동발달 지침 문서를 불러온다.
2. 요청된 시나리오 카테고리/연령에 맞는 규칙만 검색(RAG 검색기)해 시스템 프롬프트에 주입한다.
3. 각 규칙은 카테고리 라벨(⚖️/🏛️/🧭/👶)과 출처(source_name/source_url)를 함께 노출해
   "왜 이 제약이 들어갔는지"를 프롬프트 안에서 바로 추적할 수 있게 한다.
"""

from .config import CATEGORY_LABELS, CATEGORY_ORDER
from .rule_loader import load_rules
from .retriever import KeywordRuleRetriever, build_vector_retriever


class RuleEngine:
    def __init__(self, include_inactive: bool = False, use_vector_retrieval: bool = False):
        self.rules = load_rules(include_inactive=include_inactive)
        self._vector_retriever = build_vector_retriever(self.rules) if use_vector_retrieval else None
        self._keyword_retriever = KeywordRuleRetriever(self.rules)

    def get_applicable_rules(self, scenario_category: str, keywords=None, top_k: int = None, purpose: str = "scenario_generation"):
        # 🚨 CS-010 수정: top_k 기본값을 8 고정에서 "활성 규칙 전체"로 바꾼다.
        #
        # 수정 전에는 top_k=8 고정인데 build_rule_sections() 가 top_k 를 전달하지 않아
        # 호출자가 조정할 방법이 없었다. 활성 규칙이 9건이 되면서 후보 풀이 정확히 8 =
        # 컷오프 경계에 닿았고, 규칙이 하나만 더 active 가 되면 점수 최하위가 조용히 사라진다.
        # 그 후보가 GDL-001(만 4~6세 언어수준을 규정하는 유일한 문서)이면 연령 결정이 무근거가 된다.
        #
        # 규칙 문서는 현재 10개 규모라 전량 주입해도 프롬프트 예산에 여유가 있다.
        # 규모가 커지면 그때 severity 기반 예산 배분을 도입한다.
        if top_k is None:
            top_k = max(8, len(self.rules))
        if self._vector_retriever is not None:
            query = f"{scenario_category} " + " ".join(keywords or [])
            docs = self._vector_retriever.invoke(query)
            doc_ids = {d.metadata["id"] for d in docs}
            selected = [r for r in self.rules if r.id in doc_ids or purpose in r.applies_to]
            # critical 규칙은 벡터 검색 누락 여부와 무관하게 항상 포함한다.
            critical = [r for r in self.rules if r.severity == "critical" and r not in selected]
            return selected + critical
        return self._keyword_retriever.retrieve(scenario_category, keywords=keywords, top_k=top_k, purpose=purpose)

    def build_rule_sections(self, scenario_category: str, keywords=None, purpose: str = "scenario_generation") -> str:
        """카테고리별로 라벨링된 규칙 섹션 텍스트를 만든다 (시스템 프롬프트에 삽입용)."""
        applicable = self.get_applicable_rules(scenario_category, keywords=keywords, purpose=purpose)
        by_category = {cat: [] for cat in CATEGORY_ORDER}
        for rule in applicable:
            by_category.setdefault(rule.category, []).append(rule)

        sections = []
        for category in CATEGORY_ORDER:
            rules_in_cat = by_category.get(category, [])
            if not rules_in_cat:
                continue
            label = CATEGORY_LABELS[category]
            lines = [f"## {label}"]
            for rule in sorted(rules_in_cat, key=lambda r: r.id):
                lines.append(
                    f"- **[{rule.id}]** {rule.title} "
                    f"(출처: {rule.source_name}"
                    + (f", {rule.source_url}" if rule.source_url and rule.source_url != "N/A" else "")
                    + ")"
                )
                # 본문 중 [RULE-ID-Rn] 로 시작하는 구체 규칙 라인만 추출해 프롬프트에 포함.
                for detail in _extract_rule_lines(rule.body):
                    lines.append(f"  - {detail}")
            sections.append("\n".join(lines))
        return "\n\n".join(sections)

    def build_system_prompt(self, base_system_role: str, scenario_category: str, age_range: str, keywords=None) -> str:
        rule_sections = self.build_rule_sections(scenario_category, keywords=keywords)
        return (
            f"{base_system_role}\n\n"
            f"대상 연령: {age_range}\n"
            f"시나리오 카테고리: {scenario_category}\n\n"
            "다음은 이 시나리오를 생성할 때 반드시 참고해야 하는 규칙입니다. "
            "각 규칙에는 근거 문서와 출처가 표기되어 있으니, 규칙을 위반하는 내용은 절대 생성하지 마세요.\n\n"
            f"{rule_sections}"
        )


def _extract_rule_lines(body: str):
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("- **[") and "-R" in stripped:
            yield stripped.lstrip("- ")
