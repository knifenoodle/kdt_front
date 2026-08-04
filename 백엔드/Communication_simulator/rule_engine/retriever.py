"""규칙 검색기(Retriever).

기본값은 외부 의존성이 없는 키워드 매칭 검색이며, 해커톤처럼 빠르게 동작해야 하는
환경에 적합하다. langchain + chromadb + openai 임베딩 패키지가 설치되어 있으면
VectorRuleRetriever로 실제 임베딩 기반 RAG 검색으로 승격할 수 있다 (동일한
knowledge_base/*.md 파일을 그대로 사용하므로 문서 재작성이 필요 없다).
"""

from .config import SEVERITY_WEIGHT


class KeywordRuleRetriever:
    """critical 규칙은 항상 포함하고, 나머지는 태그/본문 키워드 overlap 점수로 정렬."""

    def __init__(self, rules):
        self.rules = rules

    def retrieve(self, scenario_category: str, keywords=None, top_k: int = 8, purpose: str = "scenario_generation"):
        keywords = set(keywords or [])
        keywords.add(scenario_category)

        scored = []
        for rule in self.rules:
            # severity=critical이면 항상 포함하고, applies_to에는 카테고리(ownership_turn 등)가 아니라
            # 이 호출의 목적(purpose, 예: scenario_generation)이 들어 있으므로 그 값으로 매칭한다.
            always_include = rule.severity == "critical" or purpose in rule.applies_to
            score = SEVERITY_WEIGHT.get(rule.severity, 0)
            text_pool = " ".join(rule.tags) + " " + rule.title + " " + rule.body
            overlap = sum(1 for kw in keywords if kw and kw in text_pool)
            score += overlap
            if always_include or overlap > 0:
                scored.append((score, rule))

        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [rule for _, rule in scored[:top_k]]


def build_vector_retriever(rules, persist_directory: str = ".chroma_rules"):
    """선택적 업그레이드: langchain + chromadb + OpenAI 임베딩으로 실제 벡터 RAG 구성.

    필수 패키지가 없으면 None을 반환하므로, 호출부는 KeywordRuleRetriever로 자연스럽게
    폴백해야 한다 (하드 의존성을 강제하지 않는다).
    """
    try:
        from langchain_community.vectorstores import Chroma
        from langchain_openai import OpenAIEmbeddings
        from langchain_core.documents import Document
    except ImportError:
        return None

    documents = [
        Document(
            page_content=f"{rule.title}\n{rule.body}",
            metadata={
                "id": rule.id,
                "category": rule.category,
                "severity": rule.severity,
                "source_url": rule.source_url,
            },
        )
        for rule in rules
    ]
    store = Chroma.from_documents(
        documents,
        embedding=OpenAIEmbeddings(),
        persist_directory=persist_directory,
    )
    return store.as_retriever()
