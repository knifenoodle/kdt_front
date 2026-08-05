"""knowledge_base/ 안의 규칙 문서(마스터 인덱스 + 마크다운)를 읽어 Rule 객체 목록으로 반환한다.

이 모듈이 읽는 대상이 바로 RAG가 임베딩해야 할 원문이다:
- knowledge_base/rules_index.json : 메타데이터 마스터 인덱스
- knowledge_base/<category>/*.md  : frontmatter(YAML) + 본문(마크다운)

별도의 벡터 DB 없이도 이 로더만으로 규칙 엔진이 동작하며,
LangChain 등으로 RAG를 확장할 때도 동일한 .md 파일을 그대로 임베딩하면 된다.
"""

import json
import logging
import re

import yaml

from .config import RULES_INDEX_PATH, KNOWLEDGE_BASE_DIR
from .models import Rule

logger = logging.getLogger(__name__)

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)


def _read_markdown(path):
    text = path.read_text(encoding="utf-8")
    match = _FRONTMATTER_RE.match(text)
    if not match:
        # 🚨 CS-004 근본 수정: 침묵 실패를 경고로 바꾼다.
        #
        # 수정 전에는 예외도 로그도 없이 파일 전문을 body 로 반환했다. 그래서
        # LEGAL-003 첫 줄이 키보드 난타로 오염되어 frontmatter 파싱이 실패하고 있었는데도
        # 아무도 알지 못했다. 규칙 문서가 조용히 깨지는 것이 이 프로젝트에서 가장 위험한
        # 실패 양상이다 — 규칙은 사라졌는데 시스템은 정상 동작하는 것처럼 보인다.
        logger.warning(
            "frontmatter 파싱 실패 — 파일 전문을 body 로 사용합니다: %s "
            "(문서 첫 줄이 '---' 인지 확인하세요)", path
        )
        return {}, text
    frontmatter_raw, body = match.groups()
    metadata = yaml.safe_load(frontmatter_raw) or {}
    return metadata, body.strip()


def load_rules(include_inactive: bool = False) -> list:
    """rules_index.json을 기준으로 각 규칙의 마크다운 본문까지 채워서 반환.

    include_inactive=False면 status="draft"인 규칙(예: GOV-001 TODO 템플릿, 전문가
    자문 전 초안)은 제외한다 — 아직 팀이 확정하지 않은 규칙을 실제 생성에 강제하지 않기 위함.
    """
    index = json.loads(RULES_INDEX_PATH.read_text(encoding="utf-8"))
    rules = []
    for entry in index["rules"]:
        if not include_inactive and entry.get("status") != "active":
            continue
        md_path = KNOWLEDGE_BASE_DIR.parent / entry["file"]
        _, body = _read_markdown(md_path)
        rules.append(
            Rule(
                id=entry["id"],
                category=entry["category"],
                status=entry["status"],
                severity=entry["severity"],
                title=entry["title"],
                file=entry["file"],
                source_name=entry.get("source_name", ""),
                source_url=entry.get("source_url", ""),
                tags=entry.get("tags", []),
                applies_to=entry.get("applies_to", []),
                body=body,
            )
        )
    return rules


def get_rule(rule_id: str, include_inactive: bool = True) -> Rule:
    for rule in load_rules(include_inactive=include_inactive):
        if rule.id == rule_id:
            return rule
    raise KeyError(f"규칙 ID를 찾을 수 없습니다: {rule_id}")
