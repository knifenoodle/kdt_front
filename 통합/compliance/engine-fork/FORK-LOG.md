# engine/ 포크 기록

`frontendbackend/engine/` 는 `백엔드/Communication_simulator` 를 이 프로젝트로 **복사한 우리 코드**다.

| 항목 | 값 |
|---|---|
| 상류 저장소 | `https://github.com/KyungminChang/Communication_simulator.git` |
| **포크 기준 커밋** | `bdd1bc706af5d1c7da788cfa7bba5b18f0396087` (`bdd1bc7`) |
| 포크 일자 | 2026-08-05 |
| **원본 상태** | 🚨 **한 바이트도 수정하지 않았다.** working tree clean |

## 왜 복사했는가

당초에는 원본을 직접 수정하되 사본과 변경 기록을 남기는 예외 절차(D4)로 진행했다.
2026-08-05 사용자 결정으로 **"복사해서 작업하고 원본은 원본대로 유지"** 하는 방식으로 전환했다.

이 전환의 이득:
1. **원본 불가침** — 다른 팀원이 원본을 쓰던 방식이 깨지지 않는다
2. **권한 문제 해소** — "상류 PR 권한 확인 필요"로 막혀 있던 CS-002·CS-006 을 **직접 고칠 수 있게 됐다**
3. **우회 장치 제거** — 아래 두 가지가 필요 없어졌다
   - prompt_config 벤더링 + 모듈 속성 오버라이드 → `engine/prompts/prompt_config.json` 직접 수정
   - `get_applicable_rules` top_k in-process 래핑 → `engine/rule_engine/rule_engine.py` 직접 수정

회귀 방지: `server/tests/test_guards.py::test_upstream_repo_is_untouched` 가 원본 저장소의
`git status --porcelain` 이 비어 있는지 검사한다.

## 상류 대비 변경 8개 파일

`*.upstream` 파일은 변경 전 원본 사본이다(diff 대조용).

### 규칙 문서 3건

| 파일 | 변경 | ID |
|---|---|---|
| `knowledge_base/legal/LEGAL-003_…md` | 1~2행 키보드 난타(`ㄴㅁㄴㅇ…A`) 삭제 | CS-004 |
| `knowledge_base/rules_index.json` | ETH-002·GDL-001 `draft` → `active` | CS-003 |
| `knowledge_base/guideline/GDL-001_…md` | **만 4~6세 기준 전면 재작성** (R5~R8 신설) | D1 |

**CS-004** — `rule_loader.py:19` `_FRONTMATTER_RE` 가 선두 앵커라 `.match()` 가 실패하고,
`:24-26` 이 예외 없이 전문을 body 로 반환했다(침묵 실패). 프롬프트 주입은 없었으나
(`_extract_rule_lines` 가 걸러냄) 심사 노출·키워드 점수 오염·벡터 RAG 임베딩 오염이 있었다.

**CS-003** — `rule_loader.py:41` 이 `status != "active"` 를 건너뛰므로 두 문서의 규칙이
프롬프트에 **한 번도 도달하지 않았는데** `validator.py` 는 ETH-002 금지어로 처벌했다.
모델은 기준을 못 듣고 채점만 당하는 비대칭이었다.

**GDL-001 재작성** — CS-003 으로 도달하게 됐으나 본문이 초등 저학년(7~9세) 기준이라
**틀린 기준을 가르치고** 있었다. 주요 변경:

| 규칙 | 변경 |
|---|---|
| R1 | 2~3문장/15단어 → **1~2문장/10단어** |
| R5 신설 | 연습 표현을 **두~다섯 글자 한 마디**로 (통째로 따라 할 수 있어야) |
| R6 신설 | 등장인물 **2~3명** (소리만으로 화자 추적 불가) |
| R7 신설 | **시제 참조 금지** ('지금'/'이따가' 수준만) |
| R8 신설 | **아이 발화 뒤 상황이 나빠지지 않게** |
| R9 | 난이도 상한을 '대안 제시'로. 도움 요청은 초등 확장 |

R8 은 `uiux기획/캐릭터_가이드_v1.md` §5·§9 의 판정을 규칙 엔진 쪽에 옮긴 것이다.
지금까지 이 판정은 **UI 문서에만 있었고 LLM 은 듣지 못했다.**

⚠️ `source_url: "N/A - 전문가 자문으로 대체/보강 필요"` 와 "팀 자체 정리 초안" 문구는
그대로 남겼다. 재작성은 **연령 기준을 맞춘 것이지 전문가 검증을 대체한 것이 아니다**(G2-9).

### 규칙 엔진 코드 3건 — 복사 전환으로 **새로 가능해진 수정**

| 파일 | 변경 | ID |
|---|---|---|
| `rule_engine/validator.py` | fail-open 제거 · 중첩 필드 재귀 스캔 · 오탐 2건 제거 · 카테고리 위반 critical 승격 · ETH-002 severity 분리 | CS-002, CS-006 |
| `rule_engine/rule_engine.py` | `get_applicable_rules` 의 `top_k` 기본값 8 고정 → 활성 규칙 수 | CS-010 |
| `rule_engine/rule_loader.py` | frontmatter 파싱 실패를 **경고 로그**로 (침묵 실패 제거) | CS-004 근본 |

**CS-002 (fail-open)** — 수정 전 `is_valid = (critical 없음) AND (OUTPUT_FORMAT 없음)`.
`severity="high"` 인 GDL-002 카테고리 위반은 두 조건 모두 비해당이라 **통과**했다.
실측: 잘못된 category + HTML 페이로드 → `is_valid=True`.
→ severity 기준으로 단일화(`critical` 또는 `high` → invalid)하고 `rule_id` 특례를 제거했다.
→ 카테고리 위반을 `critical` 로 승격했다 — 프롬프트 라벨과 화면 렌더에 동시에 쓰이는 신뢰 경계값이다.

**CS-006 (중첩 스캔)** — `_flatten_text` 가 top-level `str` 만 스캔했다.
실측: `{'x': {'y': '칼로 협박했다'}}` → `is_valid=True`.
현행 스키마는 평면이라 무해했으나 **통합 UI 세션 모델은 3턴 배열**이다.
→ dict/list/tuple/set/str 을 재귀 순회하도록 고쳤다.

**오탐 제거** — ETH-002 에서 `장애`, `가난` 을 뺐다. 부분문자열로는 `장애물`·`장애인 배려`·
`발달장애 이해` 같은 정당한 용법과 구분할 수 없다(실측: "장애물 달리기를 했어요" → 차단).
차별 표현 금지의 실체는 프롬프트 규칙(ETH-002-R1)과 `web/src/lib/riskPatterns.ts` 로 이관했다.

**ETH-002 severity 분리** — `critical` → `high`. 내부 편집 기준이고 법적 강제가 아니다.
CS-002 수정으로 `high` 도 차단 대상이 되었으므로 실효 강제력은 유지된다.

⚠️ **여전히 최소 세트다.** 자해·성적 내용·무언어 집단배제는 부분문자열로 잡히지 않는다.
아동에게 도달하는 경로는 `web/src/lib/riskPatterns.ts` 의 정규식 판이 막는다(S9-골든 7건).
통합 분류기는 G2-6.

**CS-010 (top_k)** — `top_k=8` 고정인데 `build_rule_sections` 가 이를 전달하지 않아
호출자가 조정할 수 없었다. 활성 규칙 9건이 되면서 후보 풀이 정확히 8 = 컷오프 경계에 닿았다.
규칙이 하나만 더 active 가 되면(CS-009: GOV-001) 점수 최하위가 사라지고, 그 후보가
**GDL-001** 일 수 있다. → 기본값을 활성 규칙 수로 바꿨다.

### 설정·문서 2건

| 파일 | 변경 |
|---|---|
| `prompts/prompt_config.json` | `system_role`·`language_level` 을 만 4~6세로. **`scenario_categories`·`user_instruction_template` 은 원본과 바이트 동일** |
| `README.md` | 평판 문장 4건 + 통계 출처 표기 (CS-008) |

`scenario_categories` 를 건드리지 않은 이유: **API 계약은 백엔드 절대 기준**이다(`CLAUDE.md` §3-2).
engine/ 이 우리 것이 되었어도 이 원칙은 유지한다. `test_backend_contract_keys_match_upstream` 이 감시한다.

**README 변경 4건**
1. `:73` "온라인 에듀테크 **최초의**…" → "음성 대화로 거절·경계 표현을 반복 훈련하는 미취학 아동 대상 플랫폼"
2. `:66` "3,363억 원 중 관계/정서 서비스는 **0원(0%)**" → 정성 서술 + 보류 사유(분류 기준 미확보 / 초등 기준이라 재산출 필요)
3. `:54,56-58` "실시간 **채점**"·"지수 **측정**"·"강점과 보완점 시각화" → "**연습 기록**" + 미구현 표기 + **"심리검사·발달 진단·치료가 아니다" 면책 블록 신설**
4. `:44` "전문 심리상담/아동발달 가이드라인 체계화" → "법령·공개 문헌 근거로 **팀이 자체 정리**한 규칙 세트 (전문가 감수 예정)"
5. §1 상단 **출처 표기 상태 경고 블록** 신설

⚠️ 통계 수치는 **지우지 않았다.** 출처를 지어낼 수 없으므로 "현재 미병기 상태이며 대외 제출 전
명시 또는 삭제"임을 명확히 하는 편이 정직하다. 출처 확보는 팀 몫이다(`CLAIMS-SUBSTANTIATION.md`).

## 상류와 다시 맞추려면

```bash
cd "…/frontendbackend"
diff -rq --exclude='.git' --exclude='__pycache__' \
  "../백엔드/Communication_simulator" engine
```

상류가 갱신되면 위 8개 파일의 변경을 다시 적용해야 한다. 변경이 모두 **아동 안전·연령 기준**
때문이므로, 상류에 PR 로 제안하면 이 부채가 사라진다(권한이 생기면).
