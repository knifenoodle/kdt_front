# ADR

결정 기록의 **정본은 `compliance/DECISIONS.md`** 다. 두 곳에 두면 갈라지므로 여기서는 인덱스만 둔다.

| ID | 결정 | 정본 |
|---|---|---|
| D1 | 연령 타깃 = 만 4~6세 (페르소나 5세) | `compliance/DECISIONS.md` §D1 |
| D2 | 1단계 범위 = 분석 + 수직 슬라이스, STT 제외 | 〃 §D2 |
| D3 | 프런트 스택 = Next.js 15 App Router + CSS Modules | 〃 §D3 |
| D4 | **원본 무수정.** `engine/` 사본에서 작업 (2026-08-05 개정) | 〃 §D4, `compliance/engine-fork/FORK-LOG.md` |
| D5 | 부모 리포트 = 지수 유지 (조건부), 축소안 병기 | 〃 §D5 |
| D6 | 우선순위 규칙 안전 예외 | 〃 §D6, `CLAUDE.md` §3-2 |
| D7 | 연출 3건 이미 결정됨 — 재논의 금지 | 〃 §D7, `docs/02` §C |

스키마 갭 해소 전략(옵션 a/b/c 비교와 (b) 전환 선행조건 4건)은 `docs/01_인터페이스_계약서.md` §5 와
`server/app/adapters/base.py` 주석에 있다.
