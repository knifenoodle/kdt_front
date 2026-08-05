/**
 * 무지개떡 6층 누적 진행률 — mockup-v1.html:1858-1878(`S.filled`), :2086(`goHome`) 이식.
 *
 * 🚨 저장하지 않는다(S6, LEGAL-003-R1). 모듈 스코프 변수라 새로고침하면 0으로
 * 돌아간다 — 목업도 `localStorage` 를 쓰지 않았다. 점수·스트릭이 아니라 그날의
 * 완주 자체를 보여주는 장식이며, 6층을 채운 뒤 "다시 하기"를 누르면 다음 라운드를
 * 위해 리셋된다(목업 `goHome()`).
 */

let filled = 0;

export function getFilled(): number {
  return filled;
}

/** 세션 완주 시 호출. 새로 채워진 층 인덱스(pop 연출 대상)를 반환, 이미 6층이면 null. */
export function fillNextLayer(): number | null {
  if (filled >= 6) return null;
  const i = filled;
  filled += 1;
  return i;
}

/** "다시 하기" — 6층을 다 채웠으면 다음 라운드를 위해 리셋한다. */
export function resetIfComplete(): void {
  if (filled >= 6) filled = 0;
}

/**
 * 완성 보상 연출 순환 — mockup:1957-1968(`REWARDS`), `S.rewardIdx`.
 * 매번 같은 연출이면 세 번째부터 의미가 없어 하나씩 돌아가며 나온다.
 */
export const REWARD_KINDS = ['party', 'pool', 'pound'] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];

let rewardIdx = 0;

export function nextRewardKind(): RewardKind {
  const k = REWARD_KINDS[rewardIdx % REWARD_KINDS.length];
  rewardIdx += 1;
  return k;
}
