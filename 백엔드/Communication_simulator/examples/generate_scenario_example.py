"""규칙 엔진 사용 예시.

실행 전 GEMINI_API_KEY 환경변수를 설정해야 한다:
    (PowerShell) $env:GEMINI_API_KEY = "여기에 본인의 Gemini API 키"

키를 어디서 발급받고 어디에 저장되는지는 사용가이드.md의
"API 키는 어디에 저장되나요" 항목을 참고.

실행:
    python examples/generate_scenario_example.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rule_engine.scenario_generator import generate_scenarios


def main():
    result = generate_scenarios(category="ownership_turn", num_scenarios=2)
    print(json.dumps(result["scenarios"], ensure_ascii=False, indent=2))

    for report in result["validation_reports"]:
        if not report.is_valid:
            print("--- 검증 실패 ---")
            print(report.summary())


if __name__ == "__main__":
    main()
