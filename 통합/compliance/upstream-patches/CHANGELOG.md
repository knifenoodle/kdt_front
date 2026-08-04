# 원본 소스 변경 기록 (upstream patches)

`frontendbackend/CLAUDE.md` §2의 **원본 소스 수정 예외** 절차에 따른 기록.
원본은 읽기 전용이 원칙이며, 아동 안전·규제 결함이 원본 파일 자체에 있는 경우에만 수정한다.

- **대상 저장소:** `/Users/wonwoo_mac/Desktop/KDT 해커톤/백엔드/Communication_simulator`
  (git remote `https://github.com/KyungminChang/Communication_simulator.git`, 수정 전 HEAD `bdd1bc7`, working tree clean)
- **수정 전 사본:** 이 디렉터리의 `*.orig` 파일
- **승인:** 사용자 결정 D4 — "안전 결함만 원본 수정 허용, 수정 전 사본을 만들고 변경 내용은 문서화"
- **적용 일자:** 2026-08-04

## 사본 무결성 (수정 전 원본 SHA-256)

| 사본 | SHA-256 |
|---|---|
| `LEGAL-003_개인정보보호법_아동특례.md.orig` | `8dd6b16bc14417675ec1a1db849f63791a8d5a0d83562458715af77fe91b9b6d` |
| `rules_index.json.orig` | `87795d0ad520c06b94c3fe4248f5dc55b17845c48e8c429651b4ce2beb46e1c3` |

원본 복원이 필요하면:
```
cp "compliance/upstream-patches/LEGAL-003_개인정보보호법_아동특례.md.orig" \
   "../백엔드/Communication_simulator/knowledge_base/legal/LEGAL-003_개인정보보호법_아동특례.md"
cp "compliance/upstream-patches/rules_index.json.orig" \
   "../백엔드/Communication_simulator/knowledge_base/rules_index.json"
```

---

## 변경 #1 — CS-004: PIPA 근거 문서 1행 손상 제거

| 항목 | 내용 |
|---|---|
| **파일:행** | `knowledge_base/legal/LEGAL-003_개인정보보호법_아동특례.md:1-2` |
| **근거 규칙** | LEGAL-003 (개인정보보호법 제22조의2, severity `critical`) |
| **심각도** | MED (잠재) · 분류 `[1]` 배포 코드 |

**변경 전**
```
1: ㄴㅁㄴㅇㅇㅁㅁㅇㄴㄴㅇㅇㄴㅇㅇㄴㅇㄴㅇㅇㄴㅇㄴㄴㅇㅁㅁㅇㅇㅁㄴA
2: (빈 줄)
3: ---
4: id: LEGAL-003
```

**변경 후**
```
1: ---
2: id: LEGAL-003
```

**사유**
`rule_engine/rule_loader.py:19`의 `_FRONTMATTER_RE`는 문서 선두 앵커(`^---`)이고 `:24-26`이 `.match()` 실패 시 **예외 없이** 전문을 `body`로 반환한다. 손상된 1행 때문에 LEGAL-003만 파싱에 실패했다(실측: LEGAL-003 `match=False`, LEGAL-001/002 `match=True`).

피해 범위 — 정확히 기록해 둔다:
- **프롬프트 주입은 일어나지 않았다.** `rule_engine/rule_engine.py:71-75` `_extract_rule_lines`가 `- **[` 로 시작하고 `-R` 을 포함하는 라인만 통과시켜 YAML·난타 문자열을 걸러낸다. R1~R5는 정상 추출되고 있었다.
- 실제 피해: ① 심사·실사에서 프로젝트의 개인정보보호법 근거 문서 첫 줄이 키보드 난타로 보임 ② `rule_engine/retriever.py:28` `text_pool`이 frontmatter로 오염되어 키워드 점수 왜곡 ③ 벡터 RAG 승격 시 `retriever.py:53` `page_content`에 난타+YAML이 임베딩됨

**검증 결과** (`.venv/bin/python`으로 실제 로더 실행)
```
knowledge_base/**/*.md 10건 전부 parsed=True, fallback=False  → S13 PASS
프롬프트에 난타 문자열 잔존: False
프롬프트에 raw YAML(last_verified) 잔존: False
```

**상류 PR 상태:** 미제출. 원본 저장소에 반영 권장 — 사본만 고치면 원본이 손상 상태로 남는다.

---

## 변경 #2 — CS-003: ETH-002 / GDL-001 draft → active

| 항목 | 내용 |
|---|---|
| **파일:행** | `knowledge_base/rules_index.json:97` (ETH-002), `:109` (GDL-001) |
| **근거 규칙** | ETH-002-R1/R4/R5/R6, GDL-001-R1~R5 |
| **심각도** | HIGH · 분류 `[1]` 배포 코드 |

**변경 전 / 후**
```
ETH-002:  "status": "draft"   →   "status": "active"
GDL-001:  "status": "draft"   →   "status": "active"
```
severity는 **변경하지 않았다** (ETH-002 `high`, GDL-001 `medium` 유지) — 전문가 자문 전이므로 상향 근거가 없다.

**사유 — 비대칭 제거**
`rule_engine/rule_loader.py:41`이 `status != "active"`인 항목을 건너뛰므로, 이 두 문서의 규칙은 LLM 프롬프트에 **한 번도 도달하지 않았다.** 그런데 `rule_engine/validator.py:14`는 `ETH-002` 금지어(`바보`,`멍청이`,`장애`,`뚱뚱`,`못생`,`가난`)로 생성물을 `critical` 처벌한다. **모델은 기준을 듣지 못한 채 채점만 당하는 구조**였고, 이는 재시도 낭비와 `scenarios: []` 확률 상승으로 직결된다.

프롬프트에서 누락되어 있던 규칙 중 아동 안전에 직접 관련된 것:
- `ETH-002-R6` — 아동이 실패했을 때도 수치심을 유발하는 피드백이 아니라 재시도를 독려하는 톤
- `ETH-002-R4` — '정답'을 하나로 강요하지 않는다
- `ETH-002-R5` — 도움을 요청할 수 있는 어른이 있다는 메시지를 학습 목표에 포함
- `ETH-002-R1` — 가해 또래 캐릭터를 악마화하지 않는다
- `GDL-001-R1~R5` — 문장 15단어 내외, 학습목표 1개, 추상개념 지양, 반말 대화체, 단계적 난이도

**D1(만 4~6세)과의 관계:** 연령 적합성·언어수준을 규정하는 유일한 규칙 문서가 GDL-001이다. 이것이 draft인 동안은 연령 톤 제어가 `age_range` 문자열 하나에만 의존했고, 4~6세 하향 결정을 규칙 엔진이 뒷받침하지 못했다.

**검증 결과**
```
활성 규칙 7건 → 9건
  ['LEGAL-001','LEGAL-002','LEGAL-003','GOV-002','GOV-003','ETH-001','ETH-002','GDL-001','GDL-002']
build_rule_sections('ownership_turn') 도달 확인:
  ETH-002-R1 도달 / ETH-002-R4 도달 / ETH-002-R5 도달 / ETH-002-R6 도달
  GDL-001-R1 도달 / GDL-001-R4 도달 / LEGAL-003-R1 도달
섹션 길이 4,865자
```

**후속 필요 (원본 미수정, Phase 2 상류 PR 후보)**
`validator.py:14`의 ETH-002 금지어 severity를 `critical` → `high`로 하향. CS-002(fail-open) 수정으로 판정이 severity 단일화되면 `high`도 invalid가 되므로 실효 강제력은 유지되면서 "가르치지 않은 규칙으로 critical 처벌" 모순만 제거된다. 이번 승격으로 규칙이 프롬프트에 도달하게 되었으므로 비대칭 자체는 이미 해소되었고, severity 하향은 선택 사항으로 내린다.

---

## 🚨 이번 변경으로 새로 발견된 리스크

```
[🚨 아동 규제/안전 리스크 감지]
ID       : CS-010
심각도   : MED
분류     : [1] 배포 코드 (승격으로 경계에 도달)
영역     : 유해성·안전
근거     : rule_engine/rule_engine.py:34 (top_k=8), rule_engine/retriever.py:31-35
자사규칙 : ETH-001-R4, GDL-001-R1, GOV-001-R1
현상     : get_applicable_rules 의 top_k 기본값이 8이다. 이번 승격으로 후보 풀이
           정확히 8건이 되어 현재는 탈락이 없지만, 규칙이 하나만 더 active 가 되면
           점수 최하위 규칙이 조용히 프롬프트에서 사라진다.
재현     : 4개 카테고리 전부에서 선택 8건. 후보 풀 = 활성 9건 − GOV-002.
           (GOV-002는 applies_to=[data_handling,b2g_expansion] 이 purpose=
           "scenario_generation" 과 불일치하고 키워드 overlap 0 이라 retriever.py:31
           에서 애초에 후보에 들지 않는다 — 이번 승격과 무관한 기존 문제)
           점수: LEGAL-001/002/003=3, GDL-002=3, GOV-002=2, ETH-001=2, ETH-002=2,
                 GOV-003=1, GDL-001=1
영향     : 다음 탈락 후보가 GOV-003(1점)과 GDL-001(1점)이다. GDL-001 은 만 4~6세
           언어수준을 규정하는 유일한 문서이므로, 탈락하면 D1 결정이 다시 무근거가 된다.
완화     : 현재 후보 풀이 정확히 8건이라 탈락 0건
완화붕괴 : CS-009(GOV-001 TEMPLATE 채운 뒤 active 승격)를 실행하는 순간 붕괴한다.
           GOV-001 은 applies_to 에 scenario_generation 이 있어 always_include=True 로
           후보에 들어오고, 풀이 9건이 되어 1건이 탈락한다.
필요조치 : BFF 가 build_system_prompt 를 호출할 때 top_k 를 명시적으로 활성 규칙 수
           이상으로 넘기거나, severity 하위 규칙이 탈락했을 때 경고를 남긴다.
           근본적으로는 상류에서 top_k 기본값을 올리거나 always_include 규칙을
           top_k 컷오프에서 면제해야 한다.
게이트   : G1 (CS-009 와 동시 처리 필요)
상태     : 미착수
```

---

## 원본 미수정 항목 (래핑/Phase 2로 처리)

아래는 원본을 고치지 않는다. HTTP 계층은 `frontendbackend/server/` BFF에서 처리하고, 규칙 엔진 내부 결함은 상류 PR 후보로 둔다.

| ID | 항목 | 위치 | 처리 |
|---|---|---|---|
| CS-002 | validator fail-open (`GDL-002` high 통과) | `rule_engine/validator.py:71-73` | 상류 PR |
| CS-005 | `category`/`age_range` 무검증 → `system_instruction` 진입 | `webapp/main.py:40-43`, `:58` | **BFF 래핑** |
| CS-006 | `_flatten_text` 중첩 필드 미스캔 | `rule_engine/validator.py:29-30` | 상류 PR (옵션 b 선행조건) |
| CS-010 | `top_k=8` 컷오프 경계 | `rule_engine/rule_engine.py:34` | **BFF 래핑** (top_k 명시 전달) |
| — | 금칙어 사전 미탐/오탐 | `rule_engine/validator.py:11-15` | G2-6 (실사용 분류기) |
| — | 금칙어가 모델 컨텍스트로 재주입 | `validator.py:66` + `scenario_generator.py:136-141` | 상류 PR |
| — | 인증·레이트리밋 부재 | `webapp/main.py:63-70` | **BFF 래핑** |
| — | 예외 텍스트 클라이언트 누출 | `webapp/main.py:74-75` | **BFF 래핑** (오류 봉투) |
| — | 연령 문구 7~9세 | `prompts/prompt_config.json:2` | **벤더링** (`server/prompts/prompt_config.ttorang.json`) |
