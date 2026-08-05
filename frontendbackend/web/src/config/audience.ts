/**
 * 대상 연령 — 단일 원천 (S10 불변식).
 *
 * 🚨 `초등 1~3학년` / `7~9세` / `만 4~6세` / `만 6~8세` 문자열이
 * 이 파일 밖에 등장하면 `check-safety-rules.mjs` 가 실패한다.
 *
 * 결정 D1 (docs/06_ADR/ADR-003-연령타깃.md):
 *   1순위 대상은 미취학 만 4~6세, 설계 기준 페르소나는 만 5세.
 *   상한은 두지 않으며 초1~3 은 확장 경로다.
 *   근거: 아이디어_개발_기획서_양식반영본_v4.md:119, uiux기획/CLAUDE.md:3
 *
 * 백엔드 `prompt_config.json` 은 초등 저학년 기준이었으나 `age_range` 가
 * enum 없는 Optional[str] 런타임 인자라 백엔드가 이미 호출자에게 결정을 위임했다
 * → 우선순위 규칙의 충돌 사안이 아니다(docs/02 A-1).
 */

export const AGE_BANDS = ['4', '5', '6'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** 설계 기준 페르소나. 기획서 v4:119 */
export const DEFAULT_AGE_BAND: AgeBand = '5';

/**
 * 🚨 아이에게서 수집하는 유일한 연령 정보다.
 * uiux기획/CLAUDE.md:107 — "아이 온보딩에서 이름·생년월일을 받지 않는다.
 * 필요한 건 연령대(4/5/6세)뿐."
 * 생년월일·나이 정수·학년을 절대 받지 않는다.
 */
export const AGE_BAND_LABEL: Record<AgeBand, string> = {
  '4': '네 살',
  '5': '다섯 살',
  '6': '여섯 살',
};

/** 아이에게는 연령 라벨을 노출하지 않는다(기획서 v4:119 — "아동에게는 레벨만"). */
export const SHOW_AGE_TO_CHILD = false;
