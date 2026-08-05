"""API 호출 없이 규칙 엔진만 단독으로 확인하는 예시 (Gemini API 키 불필요).

특정 시나리오 카테고리에 어떤 규칙(법적/정부/윤리/발달)이 적용되는지,
그리고 실제로 LLM에 주입될 시스템 프롬프트가 어떻게 조립되는지 확인할 때 사용한다.

실행:
    python examples/inspect_rules_example.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rule_engine.rule_engine import RuleEngine


def main():
    engine = RuleEngine()
    for category in ["ownership_turn", "physical_boundary", "verbal_discomfort", "rule_violation"]:
        print(f"\n===== 카테고리: {category} =====")
        print(engine.build_rule_sections(category))


if __name__ == "__main__":
    main()
