# 백엔드 실측 스냅샷 (backend-observed)

**원칙: 이 디렉터리의 파일은 손으로 쓰지 않는다.** 실제 원본 백엔드를 띄워 호출한 응답만 저장한다.
문서·브리프의 진술과 실측이 다르면 **실측이 이긴다.**

## 채취 조건

| 항목 | 값 |
|---|---|
| 대상 | `백엔드/Communication_simulator` **원본** (BFF 아님) |
| 기동 | `.venv/bin/uvicorn webapp.main:app --host 127.0.0.1 --port 8000` |
| HEAD | `bdd1bc7` + CS-003/CS-004 패치 적용 상태 (`compliance/upstream-patches/CHANGELOG.md` 참조) |
| 채취일 | 2026-08-04 |
| 의존성 | `.venv` (google-genai 2.16.0, pydantic 2.13.4, PyYAML 6.0.3, fastapi 0.141.1, uvicorn 0.52.1) |

각 파일은 `{_captured, _desc, _status, _note, body}` 봉투를 가지며 `body`가 실제 응답이다.

## 채취 완료 (5종) — 키 불필요

| 파일 | 상태 | 계약상 의미 |
|---|---|---|
| `categories.200.json` | 200 | **래퍼 없는 bare object.** `Record<CategoryId, string>`. 4키 고정 |
| `rules.ownership_turn.200.json` | 200 | `rule_sections`가 **단일 마크다운 문자열**. 구조화 데이터가 아니므로 규칙별 칩·인용 UI는 서버 재구조화 필요 |
| `rules.bogus.200.json` | 200 | **CS-005 증거.** 존재하지 않는 카테고리도 200 + 그럴듯한 규칙 텍스트를 반환. `main.py:58`이 `category: str` 무검증 |
| `generate.422.json` | 422 | **M3 증거.** `detail`이 **배열** (`[{type, loc, msg, input, ctx}]`) |
| `generate.500-nokey.json` | 500 | **M3 증거.** `detail`이 **문자열**. 422와 형태가 호환되지 않으므로 프런트가 단일 분기로 처리 불가 → BFF에서 봉투 통일 |

### M3 확정 근거

```
422 → {"detail": [ {...}, ... ]}     ← 배열
500 → {"detail": "GEMINI_API_KEY …"}  ← 문자열
```
`webapp/static/index.html:304`가 `data.detail || '...'`로 처리하므로 422에서 `[object Object]`가 렌더된다. BFF는 두 형태를 모두 흡수해 `{ok:false, code, message_for_dev}` 단일 봉투로 정규화한다.

## 채취 완료 (2종 추가) — 2026-08-05, 실제 키로

| 파일 | 상태 | 계약상 의미 |
|---|---|---|
| `generate.ownership_turn.200.json` | 200 | `Scenario` 6필드 전부 문자열, 누락 0. `category`가 요청과 동일 → Gemini `response_schema` enum 실동작 확인. `issues: []` |
| `generate.502.json` | 502 | **D-6 확정.** `detail`이 문자열이고 **SDK 예외 원문이 그대로 클라이언트에 도달**한다 — `400 INVALID_ARGUMENT … generativelanguage.googleapis.com …`. BFF 가 이를 차단하고 `{ok,code,message_for_dev,correlation_id}` 봉투로 대체한다. (저장 시 키 문자열은 마스킹함) |

**실측 지연:** 원본 직접 호출 ≈ 7~9초, BFF 경유도 동일 수준.
→ M5 타임아웃 상한 20s 는 타당하다. 다만 **지연 은닉이 선택이 아니라 필수**임이 확인됐다
(인트로 내레이션 6발화 ≈ 15초가 이 지연을 덮는다).

## 미채취 1종 — 재현 실패

`generate.empty.200.json` (= `scenarios: []` + HTTP 200)

> **[가설] 이었고 재현되지 않았다.** 정직하게 기록한다.
>
> 사전 예측: `physical_boundary` 는 라벨 자체가 "장난으로 치고 가기"이고
> `validator.py:12` 에 금칙어 `"때려"` 가 있어 빈 배열 확률이 4개 중 가장 높다.
>
> 실측(2026-08-05, 실제 키):
> - `physical_boundary` × 3회 → **매번 `scenarios=1, issues=0`**
> - `verbal_discomfort` × 4회 (`num_scenarios=2`, ETH-002 금지어 영역) → **매번 `scenarios=2, issues=0`**
> - 총 **7회 호출에서 검증 거부 0건**
>
> 따라서 이 스냅샷은 **손으로 만들지 않는다**(이 디렉터리의 제1원칙).
> BFF 의 빈 배열 처리(M4)는 `server/tests/test_never_fails.py::test_empty_scenarios_is_not_an_error`
> 가 상류를 모킹해 커버한다 — 실측 대신 단위 테스트로 보장된다.

**이 재현 실패가 시사하는 것 (해석에 주의)**
- 거부 0건은 CS-003 수정(ETH-002·GDL-001 을 `draft → active` 로 승격)과 **정합**한다.
  수정 전에는 모델이 ETH-002 규칙을 듣지 못한 채 그 금지어로 `critical` 처벌을 받았고,
  수정 후에는 규칙이 프롬프트에 도달한다(섹션 4,865자).
- 다만 이것은 **상관이지 인과가 아니다.** 승격 전 대조군을 측정하지 않았다.
  엄밀히 하려면 `compliance/upstream-patches/rules_index.json.orig` 로 되돌린 상태에서
  동일 조건 N회를 돌려 거부율을 비교해야 한다 → Phase 2 항목.
- 어느 쪽이든 **빈 배열 경로를 제거해도 된다는 뜻은 아니다.** 구조적으로 가능한 경로이며
  (`scenario_generator.py:143`), 모델·프롬프트·금칙어 중 하나만 바뀌어도 재현될 수 있다.

## 관련 리스크

- **CS-005** — `rules.bogus.200.json`이 증거. `category`/`age_range`가 `system_instruction`까지 무검증 전달됨
- **CS-010** — 활성 규칙 9건, 리트리버 후보 풀 8건, `top_k=8`. 현재 탈락 0건이지만 경계. GOV-001이 active가 되면 1건 탈락
