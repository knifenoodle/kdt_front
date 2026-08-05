# 시나리오 생성 규칙 엔진 (Rule Engine)

또래 갈등 롤플레잉 시나리오를 생성할 때 **법적 규제 / 정부 과제 요구사항 / 윤리·도덕성 / 아동발달 지침**을 자동으로 반영·검증하는 엔진입니다. 각 규칙은 사람이 읽기 쉬운 마크다운 문서(`knowledge_base/`)로 관리되며, 동시에 RAG(LangChain/Chroma 등)가 그대로 임베딩할 수 있는 구조입니다.

## 왜 이렇게 만들었나

- **관심사 분리**: 법률/정책/윤리 판단은 `knowledge_base/*.md` 문서로, 프롬프트 조립·API 호출은 `rule_engine/*.py` 코드로 분리했습니다. 기획/법무 담당자가 코드를 몰라도 마크다운 문서만 수정하면 시나리오 생성 규칙이 바뀝니다.
- **추적 가능성**: 모든 규칙에 ID(`LEGAL-001` 등)와 출처(`source_url`)가 있어, "왜 이 시나리오가 이렇게 제한됐는지"를 항상 역추적할 수 있습니다.
- **이중 방어선**: (1) 시스템 프롬프트에 규칙 주입 → (2) 생성 결과를 `validator.py`로 재검사. LLM이 프롬프트를 무시해도 2차로 걸러냅니다.

## 폴더 구조

```
knowledge_base/
  rules_index.json          # 모든 규칙의 마스터 인덱스 (RAG 검색/필터의 기준점)
  legal/       ⚖️  법적 규제   - 아동복지법, 학교폭력예방법, 개인정보보호법
  government/  🏛️  정부 과제   - 사업 공고문(TODO 템플릿), 교육기관 개인정보 요건, KISDI 가이드라인
  ethics/      🧭  윤리/도덕성 - 과기정통부 AI 윤리기준, 내부 편집 기준
  guideline/   👶  아동발달    - 발달심리 난이도 지침, '장난 vs 폭력' 경계 판단 지침

rule_engine/
  config.py               # 경로/카테고리 라벨 상수
  models.py                # Rule, ScenarioRequest, ValidationReport 데이터 구조
  rule_loader.py            # knowledge_base 문서를 읽어 Rule 객체로 변환
  retriever.py               # 키워드 기반 검색 (+ 선택적 벡터 RAG 업그레이드)
  rule_engine.py              # 카테고리별 규칙을 라벨링해 시스템 프롬프트로 조립
  validator.py                 # 생성된 시나리오를 규칙 위반 여부로 재검증
  scenario_generator.py         # RuleEngine + Gemini API(Google)를 묶은 엔트리포인트

prompts/prompt_config.json    # 시스템 역할, 시나리오 카테고리, 출력 JSON 형식 정의
examples/                       # 실행 예시 (API 키 필요/불필요 버전 각각)

webapp/
  main.py                       # FastAPI 서버 (규칙 엔진을 HTTP API로 노출)
  static/index.html              # 브라우저에서 시나리오를 생성/확인하는 UI
```

## 규칙 문서 형식

각 `knowledge_base/**/*.md` 파일은 YAML frontmatter + 마크다운 본문으로 구성됩니다.

```yaml
---
id: LEGAL-001
category: legal          # legal | government | ethics | guideline
severity: critical        # critical | high | medium | low
title: "..."
source_name: "..."
source_url: "https://..."
tags: [...]
applies_to: [scenario_generation, ...]
---
```

본문 안의 `- **[LEGAL-001-R1]** ...` 형식 줄이 실제로 시스템 프롬프트에 주입되는 구체 규칙입니다. 새 규칙을 추가할 때 이 형식을 따르면 `rule_engine.py`가 자동으로 인식합니다.

## 새 규칙(법률 개정, 신규 정부 요건 등) 추가하는 법

1. 해당 카테고리 폴더(`legal/`, `government/`, `ethics/`, `guideline/`)에 마크다운 파일 생성 (frontmatter 필수).
2. `knowledge_base/rules_index.json`의 `rules` 배열에 메타데이터 항목 추가 (`status: "active"`로 설정해야 실제 생성에 반영됨).
3. 그게 전부입니다 — 코드 수정 불필요.

`GOV-001_정부지원사업_요구사항_TEMPLATE.md`는 아직 실제 사업 공고문 내용을 채우지 않은 자리표시자(`status: "draft"`)입니다. 참여 중인 정부지원사업/해커톤의 실제 요구사항을 채운 뒤 `status`를 `"active"`로 바꿔야 규칙 엔진이 반영합니다.

## 실행 방법

```bash
pip install -r requirements.txt

# 1) API 호출 없이 규칙 엔진만 확인 (어떤 규칙이 어떤 카테고리에 적용되는지)
python examples/inspect_rules_example.py

# 2) 실제 Gemini 호출로 시나리오 생성 (GEMINI_API_KEY 필요)
python examples/generate_scenario_example.py

# 3) 브라우저에서 실행해보기 (GEMINI_API_KEY 필요)
uvicorn webapp.main:app --reload
# 실행 후 http://127.0.0.1:8000 접속
```

기본 모델은 `gemini-flash-latest`(비용 효율적인 등급이면서, 특정 버전이 단종돼도 항상 최신 flash 모델을 가리키는 별칭)이며, `generate_scenarios(..., model="gemini-pro-latest")`처럼 인자로 다른 Gemini 모델을 지정할 수 있습니다. 시나리오 배열은 Gemini의 구조화 출력(`response_mime_type="application/json"` + Pydantic `response_schema`)으로 강제되므로 별도의 "JSON으로만 답하라" 프롬프트나 파싱 재시도 로직이 없습니다. API 키 저장 위치는 [사용가이드.md](사용가이드.md)의 "API 키는 어디에 저장되나요" 항목을 참고하세요.

`webapp/main.py`는 FastAPI로 규칙 엔진을 3개의 HTTP API로 노출합니다 (`GET /api/categories`, `GET /api/rules?category=...`, `POST /api/generate`), `webapp/static/index.html`이 이를 호출하는 단일 페이지 UI입니다. 별도 프론트엔드 빌드 과정 없이 정적 파일 하나로 동작하므로, 실제 서비스의 React/Next.js 프론트엔드로 교체하기 전 빠르게 데모하기에 적합합니다.

## 한계 및 후속 작업

- `ethics/ETH-002`, `guideline/GDL-001`은 팀 자체 초안(`status: "draft"`)이며, 아동상담 전문가 자문 후 정식 승인 필요.
- `government/GOV-001`은 실제 사업 공고문 내용으로 채워야 하는 템플릿입니다.
- `validator.py`의 금지 키워드 목록은 최소 세트이며, 실사용 전 더 포괄적인 유해어 사전으로 확장 권장.
- 벡터 기반 RAG(`retriever.build_vector_retriever`)는 `langchain-community`, `langchain-openai`, `chromadb` 설치 시 자동 활성화되며, 미설치 시 키워드 검색으로 자동 폴백합니다.
