"""규칙 엔진 전역 설정: 경로 및 카테고리 상수."""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
KNOWLEDGE_BASE_DIR = PROJECT_ROOT / "knowledge_base"
RULES_INDEX_PATH = KNOWLEDGE_BASE_DIR / "rules_index.json"
PROMPTS_DIR = PROJECT_ROOT / "prompts"
PROMPT_CONFIG_PATH = PROMPTS_DIR / "prompt_config.json"

CATEGORY_LABELS = {
    "legal": "⚖️ 법적 규제 (반드시 준수 - 위반 시 법적 리스크)",
    "government": "🏛️ 정부 과제/사업 요구사항",
    "ethics": "🧭 윤리/도덕성 기준",
    "guideline": "👶 아동발달·상담 지침",
}

# 표시 순서: 법적 > 정부 > 윤리 > 발달지침
CATEGORY_ORDER = ["legal", "government", "ethics", "guideline"]

SEVERITY_WEIGHT = {"critical": 3, "high": 2, "medium": 1, "low": 0}
