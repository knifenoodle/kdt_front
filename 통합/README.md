# 또랑 (Ttorang) — 백엔드·UI/UX 통합 1단계

만 4~6세가 AI 캐릭터와 **소리로** 대화하며 거절·경계 표현을 연습하는 앱.
아이는 글자를 읽지 못한다는 전제로 전부 설계한다.

이 저장소는 분리 개발된 두 산출물의 **통합 1단계** 결과물이다.

| 소스 | 정체 |
|---|---|
| `Communication_simulator` (백엔드) | FastAPI + Google Gemini. 또래 갈등 시나리오 **텍스트 배치 생성기** |
| `uiux기획` (UI/UX) | 또랑. 만 4~6세 **음성 전용** 클릭 프로토타입 + 떡 캐릭터 에셋 |

두 산출물은 같은 제품의 앞뒤가 아니었다. 백엔드는 6개 산문 필드 + **첫 대사 1줄**을 emit하는데,
UI는 **3턴 대화 트리**(15줄 + 감정 6태그)를 요구한다. 필드명 불일치가 아니라 **생성 능력의 부재**다.
1단계는 이 간극을 코드로 덮기 전에 **계약으로 확정**하고, 그 계약이 실제로 관통함을 최소 경로로 증명한다.

---

## 빠른 시작

```bash
# 1) BFF
python3 -m venv .venv
./.venv/bin/pip install -r server/requirements.txt
export GEMINI_API_KEY='…'          # 없어도 동작한다 (아래 참조)
./.venv/bin/uvicorn server.app.main:app --host 127.0.0.1 --port 8100

# 2) web (다른 터미널)
cd web && npm install && npm run build && npx next start -p 3000
```

→ `http://127.0.0.1:3000`

Next.js `rewrites`가 `/api/*` → `:8100`으로 프록시하므로 **브라우저는 오리진 하나만 본다**(CORS 불필요).

🚨 `--reload`를 쓰지 않는다. 🚨 `--host`는 `127.0.0.1`로 명시한다 —
`0.0.0.0`/ngrok으로 노출하면 상류의 인증·레이트리밋 부재가 그대로 드러난다.

### ⚠️ 이 저장소는 원본 소스에 의존한다

`server/app/deps.py`가 `../백엔드/Communication_simulator`를 `sys.path`에 삽입해
`rule_engine`을 **읽기 전용으로 import**한다. 원본 트리가 없으면 `/api/health`가 503과 함께
`source_tree_found: false`를 반환한다.

---

## 1단계 합격선: API 키가 죽어도 아이 화면이 끝까지 돈다

`POST /api/session`은 **상류 실패로 실패하지 않는다.**

| 상황 | 결과 |
|---|---|
| `GEMINI_API_KEY` 부재 | 200 + 완전한 3턴 세션, `fallback_reason: "no_api_key"` |
| `scenarios: []` (전부 검증 탈락) | 200 + 저작 폴백. **오류로 승격하지 않는다** |
| 타임아웃 (20s 상한) | 200 + 폴백 |
| 상류 예외 | 200 + 폴백 |

사유는 `source.fallback_reason`에만 남고 **아이 화면은 차이를 인지하지 못한다.**
이건 편의 기능이 아니라 안전 요구사항이기도 하다 — `uiux기획/CLAUDE.md:81` "아이 화면에 오류 색 자체가 없다".

---

## 구조

```
frontendbackend/
├── docs/          분석·계약·작업기록          ← 여기부터 읽는다
├── contracts/     기계가 읽는 계약 (단일 진실 원천)
├── compliance/    규제 산출물 + 원본 패치 기록
├── server/        BFF (FastAPI). 원본을 읽기 전용 import
└── web/           Next.js 15 (App Router + CSS Modules + TS strict)
```

| 먼저 읽을 것 | 내용 |
|---|---|
| `docs/00_작업기록.md` | 판단·되돌린 것·**틀린 것** |
| `docs/01_인터페이스_계약서.md` | 연동의 정본. 필드마다 출처 3분류 라벨 |
| `docs/04_아동안전_규제_리스크_대장.md` | CS-001~010 |
| `docs/05_수직슬라이스_검증절차.md` | 붙여넣고 실행 가능 |
| `docs/08_원본_변동사항.md` | 원본에 무엇을 했는가 (전부) |
| `compliance/CHILD-SAFETY-GATES.md` | 데모 차단 / 실아동 차단 게이트 |

---

## 데이터 흐름 — "아이 목소리가 어디로 갑니까"

**1단계에서 아동의 음성·발화는 기기를 떠나지 않는다.** STT를 범위에서 제외했다.
국외로 나가는 것은 **연습 주제(4값 enum)와 연령대 밴드**뿐이며 둘 다 개인정보가 아니다.

- 수집하지 않음: 이름·생년월일·나이·성별·학교·학년·연락처 → 스키마 차원에서 부재(`extra='forbid'`, 실측 4/4 거부)
- 저장소 0건: DB·세션·쿠키·`localStorage`·파일쓰기 전부 없음
- 마이크 비활성 (렌더는 하되 `disabled`)

상세: `compliance/DATA-FLOW-INVENTORY.md`

---

## 안전 불변식 (기계 검사)

```bash
cd web && node scripts/check-safety-rules.mjs     # 14건
```

| ID | 불변식 |
|---|---|
| S1 | 캐릭터 감정이 아동 발화 평가에 바인딩되지 않는다 ← **최상위** |
| S2 | 오답 경로가 턴을 소비하지 않는다 |
| S3 | 아이 화면에 실패 어휘·오류 색이 없다 |
| S4 | 서버 문자열이 무검증으로 음성 출력에 도달하지 않는다 |
| S5 | 아이 화면에 아동 발화 텍스트가 렌더되지 않는다 |
| S6 | 클라이언트 저장소 사용 0건 |
| S7 | 제스처 금지 · 토큰만 사용 · `Tap` 경유 · 최소 터치 76/88 |
| S8 | AI 고지가 존재하고 실제 재생된다 |
| S9 | 위험 발화 분류 5종 + exhaustive switch |
| S9-골든 | 위험 발화 골든 픽스처 7건 |
| S10 | 연령 문자열이 단일 소스에만 존재 |
| S12 | 사행성·랭킹·스트릭·결제 요소 0건 (**동결**) |

**S1이 최상위인 이유**: `mockup-v1.html:1609-1613` — "송편은 상황에 반응한다. **아이의 발화에는 반응하지 않는다.**
respond 구간에서 표정이 바뀌면 아이는 예외 없이 그것을 '내 대답에 대한 채점'으로 읽는다."

**S9-골든이 가장 가치 있는 이유**: 상류 `validator.py`는 아래 4행을 **모두 반대로** 판정한다.

| 입력 | 상류 | 우리 |
|---|---|---|
| `죽고 싶을 만큼 힘들었어. 자해했어.` | 통과 ❌ | 감지 ✅ |
| `옷 벗어봐. 야한 사진 보여줄게.` | 통과 ❌ | 감지 ✅ |
| `우리 반 전체가 너랑 안 놀 거야. 아무도 말 걸지 마.` | 통과 ❌ | 감지 ✅ |
| `장애물 달리기를 했어요` | 차단 ❌ | 통과 ✅ |

---

## 테스트

```bash
./.venv/bin/python -m pytest -q     # 46건 (키 유무 무관)
cd web && npx tsc --noEmit && node scripts/check-safety-rules.mjs && npm run build
```

---

## 1단계 범위

**포함**: 인터페이스 계약 · BFF · 저작 데크 + 어댑터 · 시작/Talk 화면 · turn 1 · ko-KR TTS · 안전 불변식 · 컴플라이언스 문서

**제외**: 마이크·STT·판정·3턴 완주·보상 화면·보호자 게이트·`ownership_turn` 외 3카테고리

`/api/session`은 `ownership_turn`만 구현한다. 나머지는 **501**을 반환한다 —
조용히 다른 카테고리의 내용을 아이에게 내보내지 않기 위해서다.

---

## 라이선스·귀속

- 백엔드 원본: [Communication_simulator](https://github.com/KyungminChang/Communication_simulator) (MIT)
- 캐릭터 에셋: `uiux기획/캐릭터_에셋` (팀 자체 제작)
