# GOV-001 정부지원사업 요구사항 — 채울 항목

`knowledge_base/government/GOV-001_정부지원사업_요구사항_TEMPLATE.md` 는 **자리표시자**다.

> `:14` "⚠️ 이 문서는 자리표시자(placeholder)입니다"
> `:28` `[GOV-001-R1] (TODO)`

`status: "draft"` 이므로 규칙 엔진 프롬프트에도 주입되지 않는다(`rule_loader.py:41`).
**심사 기준 그 자체**이므로 데모 차단(G1-8)이다.

## 🚨 이 문서는 내용을 채울 수 없다

**실제 공고문 원문이 필요하다.** 정부 지원사업의 요구사항은 사업·연도·주관기관마다 다르며,
추측으로 채우면 잘못된 근거를 규칙 엔진에 주입하게 된다. 아래는 **무엇을 어디서 찾아 채울지**의 지시서다.

## 공백 항목 4개

| 원본 위치 | 항목 | 어디서 찾는가 | 우리가 이미 확보한 근거 |
|---|---|---|---|
| `:20` | **콘텐츠 심의 요구사항** | 공고문의 산출물 검수·심의 조항 | `compliance/HUMAN-REVIEW-LOG.md`, `validator.py` 이중 방어선 |
| `:21` | **데이터/국외 이전 조항** (해외 LLM API 사용 시) | 공고문의 개인정보·데이터 협약 조항 | `compliance/DATA-FLOW-INVENTORY.md` — Google Gemini 국외이전 O, 아동 발화 미전송 |
| `:23` | **안전장치 증빙** | 공고문의 안전성 증빙 요구 | `compliance/CHILD-SAFETY-GATES.md` **← 이 문서로 채운다** |
| `:24` | **금지 콘텐츠 목록** | 공고문의 금지 표현·소재 목록 | `validator.py:11-15` + `web/src/lib/riskPatterns.ts` (자해·성적·집단배제 신설판) |

## 작성 절차

1. 공고문 원문에서 위 4개 조항을 발췌한다
2. `GOV-001_…TEMPLATE.md` 본문에 `- **[GOV-001-Rn]** …` 형식으로 기재한다
   (이 형식이어야 `rule_engine.py:71-75` `_extract_rule_lines` 가 프롬프트로 옮긴다)
3. `rules_index.json` 의 GOV-001 `status` 를 `"draft"` → `"active"` 로 바꾼다
4. `source_name` / `source_url` 을 실제 공고문으로 채운다 (현재 TODO)

## 🚨 3번 실행 시 CS-010 이 동시에 터진다

GOV-001 은 `applies_to` 에 `scenario_generation` 이 있어 `always_include=True` 로 리트리버 후보에 들어온다.
현재 후보 풀이 정확히 8건이므로 **9건이 되어 점수 최하위 1건이 탈락한다.**

탈락 후보: `GOV-003`(1점)과 `GDL-001`(1점). **`GDL-001` 은 만 4~6세 언어수준을 규정하는 유일한 문서**이므로
탈락하면 D1 결정이 다시 무근거가 된다.

**완화 이미 적용됨**: `server/app/deps.py::_apply_top_k_wrap()` 이 in-process 로 `top_k = max(8, 규칙수)` 를 적용한다.
`/api/health` 의 `rules_dropped_by_top_k` 가 0이 아니면 즉시 드러난다.
단 **원본 `webapp/main.py` 경로에는 이 완화가 없다** — 원본 데모를 병행 시연한다면 그쪽은 탈락한다.

검증: `server/tests/test_guards.py::test_cs010_no_rules_dropped_by_top_k`
