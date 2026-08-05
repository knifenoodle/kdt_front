"""RuleEngine + Gemini API를 결합해 시나리오를 생성하고, 생성 결과를 다시 검증하는 엔트리포인트.

prompts/prompt_config.json (출력 형식/카테고리 정의)와
knowledge_base/ (법적/정부/윤리/발달 규칙)를 결합해 시스템 프롬프트를 만든 뒤,
Gemini 호출 -> JSON 파싱 -> validator 검증까지 한 번에 수행한다.

인증: GEMINI_API_KEY 환경변수를 읽어 클라이언트를 구성한다.
API 키가 실제로 어디에 저장되는지는 사용가이드.md의 "API 키는 어디에 저장되나요"
항목을 참고하라 (이 코드는 파일에 키를 쓰지 않고 환경변수만 읽는다).
"""

import json
import os
from enum import Enum
from typing import List, Optional

from google import genai
from google.genai import types
from pydantic import BaseModel

from .config import PROMPT_CONFIG_PATH
from .rule_engine import RuleEngine
from .validator import validate_scenario

# 해커톤 규모 트래픽에 적합한 비용 효율적 모델.
# "-latest" 별칭을 사용해 특정 버전이 단종되더라도 항상 현재 지원되는 flash 모델을 가리키게 한다.
DEFAULT_MODEL = "gemini-flash-latest"

_client = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다. "
                "사용가이드.md의 'API 키는 어디에 저장되나요' 항목을 참고해 설정하세요."
            )
        _client = genai.Client(api_key=api_key)
    return _client


def _load_prompt_config():
    return json.loads(PROMPT_CONFIG_PATH.read_text(encoding="utf-8"))


# Gemini의 구조화 출력(response_schema)에 사용할 스키마.
# Pydantic 모델로 정의하면 google-genai SDK가 내부적으로 Gemini 스키마 형식으로
# 변환해주므로, category 필드가 4개 값 중 하나임을 강제할 수 있다.
class ScenarioCategory(str, Enum):
    ownership_turn = "ownership_turn"
    physical_boundary = "physical_boundary"
    verbal_discomfort = "verbal_discomfort"
    rule_violation = "rule_violation"


class Scenario(BaseModel):
    category: ScenarioCategory
    scenario_title: str
    background: str
    conflict_trigger: str
    learning_goal: str
    ai_first_message: str


class ScenarioBatch(BaseModel):
    scenarios: List[Scenario]


def generate_scenarios(
    category: str,
    num_scenarios: int = 3,
    age_range: Optional[str] = None,
    keywords=None,
    model: str = DEFAULT_MODEL,
    max_retries: int = 1,
):
    """규칙 엔진이 검증한 시나리오 목록을 반환한다.

    반환값: {"scenarios": [...], "validation_reports": [ValidationReport, ...]}
    critical 위반이 있는 시나리오는 최대 max_retries회 재생성을 시도하고,
    그래도 실패하면 결과에서 제외하고 경고를 남긴다 (자동 배포하지 않음).
    """
    config = _load_prompt_config()
    engine = RuleEngine()
    age_range = age_range or "초등 1~3학년 (7~9세)"

    category_label = config["scenario_categories"].get(category, category)
    system_message = engine.build_system_prompt(
        base_system_role=config["system_role"],
        scenario_category=category,
        age_range=age_range,
        keywords=keywords,
    )

    user_message = config["user_instruction_template"].format(
        age_range=age_range,
        category_label=category_label,
        num_scenarios=num_scenarios,
    )

    valid_scenarios = []
    reports = []
    attempts = 0
    contents = [{"role": "user", "parts": [{"text": user_message}]}]

    while attempts <= max_retries and len(valid_scenarios) < num_scenarios:
        response = _get_client().models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_message,
                response_mime_type="application/json",
                response_schema=ScenarioBatch,
            ),
        )
        raw = response.text
        parsed = json.loads(raw)
        candidates = parsed["scenarios"]

        feedback_lines = []
        for scenario in candidates:
            report = validate_scenario(scenario)
            reports.append(report)
            if report.is_valid:
                valid_scenarios.append(scenario)
            else:
                feedback_lines.append(report.summary())

        if len(valid_scenarios) >= num_scenarios or not feedback_lines:
            break
        attempts += 1
        contents.append({"role": "model", "parts": [{"text": raw}]})
        contents.append(
            {
                "role": "user",
                "parts": [{"text": "다음 위반 사항을 수정해서 다시 생성해줘:\n" + "\n".join(feedback_lines)}],
            }
        )

    return {"scenarios": valid_scenarios[:num_scenarios], "validation_reports": reports}
