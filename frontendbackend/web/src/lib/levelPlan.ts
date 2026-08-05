/**
 * 세션 완주 횟수 기반 레벨×변이 순차 진행.
 *
 * 참고자료/레벨시스템 심화기획안 v1.2.md §2-3(3개 중 2개 커버리지) + §2-5 A안(6층=완수 6회)을
 * 그대로 코드화한다. STT·발화 판정·진행도 영속저장은 여전히 범위 밖(D2)이므로 "레벨업"은
 * 실제 발화 평가가 아니라 세션 완주 횟수로만 진행된다 — `progress.ts`의 무지개떡 6층과
 * 정확히 1:1 대응(인덱스 0~5)한다. 진행도는 영속저장하지 않는다.
 *
 * 🚨 레벨당 변이 배정은 무작위 2/3 조합이다(§2-3 "아동마다 다른 조합(1·2 또는 1·3 또는
 * 2·3)이 배정되므로 같은 레벨을 반복해도 동일한 순서가 나오지 않는다"). 라운드(6층 완주)가
 * 끝나 `progress.resetIfComplete()`가 리셋을 알리면 `rerollPlan()`으로 다시 뽑는다 — 그
 * 결과 매번 제외되는 1개 변이가 고정되지 않으므로, 여러 라운드에 걸쳐 변이3 3종도
 * 자연스럽게 등장한다. 이것이 곧 §1-1이 제안한 "복습 모드"(남는 변이를 나중에 재활용)의
 * 취지를 별도 상태 없이 구현하는 방식이다 — 커버리지 카운트(6층)는 항상 "이번 라운드에
 * 뽑힌 2개"만 반영하고, 어떤 2개가 뽑히는지가 라운드마다 달라질 뿐이다.
 */

import type { Level, Scene, Variation } from './api';

export interface PlanEntry {
  level: Level;
  variation: Variation;
  scene: Scene;
}

const LEVELS: readonly Level[] = ['1', '2', '3'];
const VARIATIONS: readonly Variation[] = ['1', '2', '3'];

/** 배경 장소 — 시나리오 제작 시 소재에 맞춰 배정한 값(§3-2). */
const SCENE_BY_LEVEL_VARIATION: Record<Level, Record<Variation, Scene>> = {
  '1': { '1': 'play', '2': 'class', '3': 'kids' },
  '2': { '1': 'futsal', '2': 'stat', '3': 'cvs' },
  '3': { '1': 'dojang', '2': 'variety', '3': 'dept' },
};

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 레벨업 조건(3개 중 2개 완수) × 3레벨 = 필수 완수 6회를 무작위 조합으로 만든다. */
function buildPlan(): PlanEntry[] {
  return LEVELS.flatMap((level) => {
    const [a, b] = shuffle(VARIATIONS).slice(0, 2);
    return [a, b].map((variation) => ({ level, variation, scene: SCENE_BY_LEVEL_VARIATION[level][variation] }));
  });
}

let plan: PlanEntry[] = buildPlan();

/** 라운드(6층 완주) 종료 후 다시 호출한다 — 다음 라운드의 변이 조합을 새로 뽑는다. */
export function rerollPlan(): void {
  plan = buildPlan();
}

/** `getFilled()` 값을 받아 다음에 요청할 시나리오를 반환한다. 6층 완성 후에는 처음부터 순환한다. */
export function nextScenario(filled: number): PlanEntry {
  return plan[filled % plan.length];
}

/** 2층·4층(index 1, 3) 완성 시점 — 레벨1·레벨2 완주. §1-2 마이크로 인터랙션 트리거. */
export function isLevelUp(justFilledIndex: number): boolean {
  return justFilledIndex === 1 || justFilledIndex === 3;
}
